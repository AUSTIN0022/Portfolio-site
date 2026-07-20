'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic } from '@/components/materials/materials';
import { track, bump, type Keyframes } from '@/lib/utils/glyphMotion';
import {
    ACCENT, BASE_TOP, Plinth, AccentInsert, setAccent, applyFloat,
    useGlyphReducedMotion, useGlyphPorts, makePortLookup, resolveInitialRotation,
    type GlyphProps, type GlyphRef,
} from '@/components/3d/glyphs/glyphShared';

// ─── The loop ────────────────────────────────────────────────────────────────
// A build token advances BUILD → TEST → DEPLOY → LIVE. Each stage it leaves stays
// lit green, so progress ACCUMULATES rather than chasing the token — that is what
// makes it read as a pipeline instead of a dot on a rail.
const LOOP = 8.0;
const STAGE_X = [-1.15, -0.6, -0.05, 0.5] as const;
const SLOT_X = 1.18;

const TOKEN_X: Keyframes = [
    [0, -1.6], [0.08, STAGE_X[0]], [0.18, STAGE_X[0]],
    [0.26, STAGE_X[1]], [0.36, STAGE_X[1]],
    [0.44, STAGE_X[2]], [0.56, STAGE_X[2]],
    [0.66, STAGE_X[3]], [0.78, STAGE_X[3]],
    [0.88, SLOT_X], [1, SLOT_X],
];
const TOKEN_SCALE: Keyframes = [[0, 0], [0.05, 1], [0.9, 1], [0.96, 0], [1, 0]];

/** When each stage is finished with, and therefore when it latches green. */
const STAGE_DONE = [0.18, 0.36, 0.56, 0.78] as const;

// The zero-downtime swap. Both blocks move in the SAME window: the new version
// occupies the live slot at the exact moment the old one vacates it, so there is
// never a frame where the slot is empty. That simultaneity is the whole claim.
const SWAP: readonly [number, number] = [0.56, 0.68];
const NEW_Z: Keyframes = [[0, -0.62], [SWAP[0], -0.62], [SWAP[1], 0], [1, 0]];
const OLD_Z: Keyframes = [[0, 0], [SWAP[0], 0], [SWAP[1], 0.62], [1, 0.62]];
const OLD_SCALE: Keyframes = [[0, 1], [SWAP[0], 1], [SWAP[1], 0.7], [0.8, 0], [1, 0]];

// Roughly every third run TEST fails: the token halts, rolls back, stages go dark.
const FAIL_EVERY = 3;
const FAIL_FLASH: readonly [number, number] = [0.30, 0.44];
const TOKEN_X_FAIL: Keyframes = [
    [0, -1.6], [0.08, STAGE_X[0]], [0.18, STAGE_X[0]],
    [0.26, STAGE_X[1]], [0.34, STAGE_X[1]], [0.52, -1.6], [1, -1.6],
];
const TOKEN_SCALE_FAIL: Keyframes = [[0, 0], [0.05, 1], [0.46, 1], [0.54, 0], [1, 0]];

// §2 resting frame: token at DEPLOY mid-swap, earlier stages green, the two
// version blocks crossing.
const FROZEN_P = 0.62;

const BLUE_EMIT = new THREE.Color(ACCENT.blue);
const RED_EMIT = new THREE.Color(ACCENT.red);
const GREEN_EMIT = new THREE.Color(ACCENT.green);

/**
 * `deploy-pipeline` — CI/CD, zero-downtime (roadmap B4).
 *
 * INFRA's "CI/CD pipelines, zero-downtime deployments". Stages are distinguished
 * by a marker shape rather than text, because text on a 120px card is unreadable
 * and would have to be baked into a texture: BUILD carries a part-assembled cube,
 * TEST a check notch, DEPLOY an up-arrow, LIVE a ring.
 */
const DeployPipeline = forwardRef<GlyphRef, GlyphProps>(({
    position = [0, 0, 0],
    rotation,
    scale = 1.0,
    floating = true,
    showLabel = true,
    defaultView = 'isometric',
    animationToggle = true,
    showPorts = false,
    forceReducedMotion,
}, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const tokenRef = useRef<THREE.Mesh>(null);
    const stageLedRefs = useRef<(THREE.Mesh | null)[]>([]);
    const newBlockRef = useRef<THREE.Group>(null);
    const oldBlockRef = useRef<THREE.Group>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => new THREE.Color(), []);

    const ports = useGlyphPorts(1.55, 0.8);
    useImperativeHandle(ref, () => makePortLookup(ports, 'DeployPipeline'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        stage: createRoundedBoxGeometry({ width: 0.44, height: 0.44, depth: 0.4, radius: 0.09, bevel: 0.01, segments: 10 }),
        version: createRoundedBoxGeometry({ width: 0.34, height: 0.34, depth: 0.36, radius: 0.08, bevel: 0.01, segments: 10 }),
        token: createRoundedBoxGeometry({ width: 0.18, height: 0.18, depth: 0.18, radius: 0.045, bevel: 0.008, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const p = frozen ? FROZEN_P : (elapsed % LOOP) / LOOP;
        // A frozen frame must never show the rollback — a red halted pipeline held
        // still reads as "this is broken", not "this has a guardrail".
        const failing = frozen ? false : Math.floor(elapsed / LOOP) % FAIL_EVERY === 0;

        if (tokenRef.current) {
            tokenRef.current.position.x = track(p, failing ? TOKEN_X_FAIL : TOKEN_X);
            const s = track(p, failing ? TOKEN_SCALE_FAIL : TOKEN_SCALE);
            tokenRef.current.scale.setScalar(s);
            tokenRef.current.visible = s > 0.01;
        }

        const fail = failing ? bump(p, FAIL_FLASH[0], FAIL_FLASH[1], 0.03) : 0;

        for (let j = 0; j < STAGE_X.length; j++) {
            const led = stageLedRefs.current[j];
            if (!led) continue;
            const done = STAGE_DONE[j];

            let lit: number;
            if (failing) {
                // Everything achieved before TEST goes dark on the rollback.
                lit = j === 0 ? track(p, [[done - 0.02, 0], [done + 0.03, 1], [0.44, 1], [0.52, 0], [1, 0]]) : 0;
            } else {
                lit = track(p, [[done - 0.02, 0], [done + 0.03, 1], [0.93, 1], [0.98, 0], [1, 0]]);
            }

            const alarm = j === 1 ? fail : 0;
            const mat = led.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(scratch.copy(GREEN_EMIT).lerp(RED_EMIT, alarm));
            mat.emissiveIntensity = 0.12 + Math.max(lit * 2.4, alarm * 3.2);
        }

        // The swap only happens on a clean run.
        if (newBlockRef.current) {
            newBlockRef.current.position.z = failing ? -0.62 : track(p, NEW_Z);
        }
        if (oldBlockRef.current) {
            oldBlockRef.current.position.z = failing ? 0 : track(p, OLD_Z);
            const s = failing ? 1 : track(p, OLD_SCALE);
            oldBlockRef.current.scale.setScalar(s);
            oldBlockRef.current.visible = s > 0.01;
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={3.1} depth={1.6} />

            {/* Shared rail the token rides. */}
            <mesh position={[-0.3, BASE_TOP + 0.04, 0]} receiveShadow castShadow>
                <boxGeometry args={[2.3, 0.06, 0.3]} />
                <WhiteCeramic />
            </mesh>

            {/* Stages, each with its marker shape and a latch LED on the front. */}
            {STAGE_X.map((x, j) => (
                <group key={`stage-${j}`} position={[x, 0, 0]}>
                    <mesh geometry={geo.stage} position={[0, BASE_TOP + 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    {/* Latch LED on the FRONT face, marker on TOP. Both started on the
                        top face and fought each other: the lit green square swamped the
                        marker, so all four stages read as one repeated block and the
                        pipeline lost its sequence. */}
                    <AccentInsert
                        ref={(el) => { stageLedRefs.current[j] = el; }}
                        color={ACCENT.green}
                        args={[0.24, 0.14, 0.02]}
                        position={[0, BASE_TOP + 0.18, 0.21]}
                        rest={0.12}
                    />
                    {/* Marker: BUILD cube, TEST notch, DEPLOY arrow, LIVE ring. */}
                    {j === 0 && (
                        <mesh position={[0, BASE_TOP + 0.5, 0]} rotation={[0.3, 0.7, 0]} castShadow>
                            <boxGeometry args={[0.19, 0.19, 0.19]} />
                            <WhiteCeramic />
                        </mesh>
                    )}
                    {j === 1 && (
                        <group position={[0, BASE_TOP + 0.47, 0]} rotation={[0, 0, 0]}>
                            <mesh position={[-0.06, -0.03, 0]} rotation={[0, 0, -0.9]} castShadow>
                                <boxGeometry args={[0.13, 0.06, 0.06]} />
                                <WhiteCeramic />
                            </mesh>
                            <mesh position={[0.04, 0.03, 0]} rotation={[0, 0, 0.7]} castShadow>
                                <boxGeometry args={[0.26, 0.06, 0.06]} />
                                <WhiteCeramic />
                            </mesh>
                        </group>
                    )}
                    {j === 2 && (
                        <mesh position={[0, BASE_TOP + 0.55, 0]} castShadow>
                            <coneGeometry args={[0.14, 0.26, 4]} />
                            <WhiteCeramic />
                        </mesh>
                    )}
                    {j === 3 && (
                        <mesh position={[0, BASE_TOP + 0.52, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                            <torusGeometry args={[0.14, 0.042, 8, 24]} />
                            <WhiteCeramic />
                        </mesh>
                    )}
                </group>
            ))}

            {/* The live slot, and the two version blocks that cross through it. */}
            <mesh position={[SLOT_X, BASE_TOP + 0.02, 0]} receiveShadow>
                <boxGeometry args={[0.46, 0.03, 0.46]} />
                <WhiteCeramic />
            </mesh>
            <group ref={newBlockRef} position={[SLOT_X, 0, -0.62]}>
                <mesh geometry={geo.version} position={[0, BASE_TOP + 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
            </group>
            <group ref={oldBlockRef} position={[SLOT_X, 0, 0]}>
                <mesh geometry={geo.version} position={[0, BASE_TOP + 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
            </group>

            {/* The build token. */}
            <mesh ref={tokenRef} geometry={geo.token} position={[-1.6, BASE_TOP + 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#1d4ed8" emissive={BLUE_EMIT} emissiveIntensity={2.6} toneMapped={false} />
            </mesh>

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.86]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    CI / CD
                </Text>
            )}

            {showPorts && ports.map((port) => (
                <mesh key={`debug-port-${port.id}`} position={port.position}>
                    <sphereGeometry args={[0.06, 12, 12]} />
                    <meshBasicMaterial color="#FF3300" depthTest={false} transparent opacity={0.8} />
                </mesh>
            ))}
        </group>
    );
});

DeployPipeline.displayName = 'DeployPipeline';

export default DeployPipeline;
