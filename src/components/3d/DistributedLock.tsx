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
// Three 3-second turns, one per worker, so the hand-off is a clean round-robin
// and the viewer can predict it — the whole claim is that this does NOT deadlock.
// Within a turn (local 0→1):
//   0.10–0.28  the holder slides in and acquires; the token snaps to it, goes green
//   0.28–0.72  it holds; the other two press in and STOP SHORT, dimmed (contention)
//   0.72–0.90  it releases; the token returns to centre for the next worker
const TURN = 3.0;
const WORKER_COUNT = 3;
const LOOP = TURN * WORKER_COUNT;

/** Holder: slides in from the rest radius and back out again. */
const HOLDER_RADIUS: Keyframes = [
    [0, 0.86], [0.22, 0.62], [0.78, 0.62], [0.94, 0.86], [1, 0.86],
];
/** Waiter: presses in and is visibly held short of the token. */
const WAITER_RADIUS: Keyframes = [
    [0, 0.86], [0.3, 0.78], [0.68, 0.78], [0.86, 0.86], [1, 0.86],
];
/** Token: centre → in front of the holder → back to centre. */
const TOKEN_RADIUS: Keyframes = [
    [0, 0], [0.16, 0], [0.30, 0.38], [0.74, 0.38], [0.88, 0], [1, 0],
];

/** Roughly every third turn one waiter gives up waiting and backs off amber. */
const TIMEOUT_EVERY = 3;

// §2 resting frame: one worker holding the green token, the other two held short.
const FROZEN_LOCAL = 0.5;
const FROZEN_SLOT = 0;

const REST_RADIUS = 0.86;
const WORKER_ANGLE = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3] as const;

const GREEN = new THREE.Color(ACCENT.green);
const AMBER = new THREE.Color(ACCENT.amber);

/**
 * `lock` — distributed lock / mutual exclusion (roadmap B1).
 *
 * The concurrency-safety story: Redis-backed locking that hands off cleanly
 * instead of deadlocking. Exactly one worker can hold the token at a time, and
 * the two that can't are shown being *held back* rather than simply idle — the
 * contention is the point, and without it this would just look like three cubes
 * taking turns for no reason.
 */
const DistributedLock = forwardRef<GlyphRef, GlyphProps>(({
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
    const workerRefs = useRef<(THREE.Group | null)[]>([]);
    const workerLedRefs = useRef<(THREE.Mesh | null)[]>([]);
    const tokenRef = useRef<THREE.Group>(null);
    const tokenMeshRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => new THREE.Color(), []);

    const ports = useGlyphPorts(1.15, 1.15);
    useImperativeHandle(ref, () => makePortLookup(ports, 'DistributedLock'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 16),
        [rotation, defaultView],
    );

    // Workers carry the story (who holds, who is blocked), so they have to out-weigh
    // the pedestal. At 0.42 against a 0.56 pedestal they read as accessories to it.
    const geo = useMemo(() => ({
        worker: createRoundedBoxGeometry({ width: 0.5, height: 0.5, depth: 0.5, radius: 0.1, bevel: 0.01, segments: 10 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const t = frozen ? FROZEN_SLOT * TURN + FROZEN_LOCAL * TURN : elapsed % LOOP;
        const slot = Math.floor(t / TURN) % WORKER_COUNT;
        const local = (t % TURN) / TURN;
        const turnIndex = frozen ? 0 : Math.floor(elapsed / TURN);

        // One waiter occasionally times out. Never in a frozen frame: an amber
        // give-up held still reads as a stuck lock, the exact opposite of the claim.
        const timeoutWorker = !frozen && turnIndex % TIMEOUT_EVERY === 0
            ? (slot + 1) % WORKER_COUNT
            : -1;

        for (let w = 0; w < WORKER_COUNT; w++) {
            const group = workerRefs.current[w];
            if (!group) continue;
            const holding = w === slot;
            const angle = WORKER_ANGLE[w];

            let radius = track(local, holding ? HOLDER_RADIUS : WAITER_RADIUS);
            const timedOut = w === timeoutWorker ? bump(local, 0.42, 0.64, 0.06) : 0;
            // A timed-out waiter backs OFF rather than pressing in.
            radius += timedOut * 0.14;

            group.position.x = Math.cos(angle) * radius;
            group.position.z = Math.sin(angle) * radius;

            const led = workerLedRefs.current[w];
            if (led) {
                const mat = led.material as THREE.MeshStandardMaterial;
                mat.emissive.copy(scratch.copy(GREEN).lerp(AMBER, timedOut));
                // Holder burns bright; waiters go nearly dark. The first pass used
                // 0.1 for waiters, and against a near-black insert that still read as
                // "lit green" — all three looked like holders and the mutual exclusion
                // (the entire claim) was invisible.
                mat.emissiveIntensity = holding
                    ? 0.15 + bump(local, 0.24, 0.78, 0.06) * 3.4
                    : 0.03 + timedOut * 3.0;
            }
        }

        // Token rides out to whichever worker currently holds it.
        if (tokenRef.current) {
            const r = track(local, TOKEN_RADIUS);
            const angle = WORKER_ANGLE[slot];
            tokenRef.current.position.x = Math.cos(angle) * r;
            tokenRef.current.position.z = Math.sin(angle) * r;
        }
        setAccent(tokenMeshRef.current, 0.35 + bump(local, 0.26, 0.8, 0.06) * 2.6);

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.3} depth={2.3} />

            {/* Pedestal with the token socket recessed dead centre. */}
            <mesh position={[0, BASE_TOP + 0.09, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.48, 0.5, 0.18, 32]} />
                <WhiteCeramic />
            </mesh>
            <mesh position={[0, BASE_TOP + 0.185, 0]} receiveShadow>
                <cylinderGeometry args={[0.17, 0.17, 0.02, 20]} />
                <meshStandardMaterial color="#1e2024" roughness={0.6} metalness={0} />
            </mesh>

            {/* The token — the one thing that glows. */}
            <group ref={tokenRef} position={[0, 0, 0]}>
                <mesh ref={tokenMeshRef} position={[0, BASE_TOP + 0.30, 0]} castShadow>
                    <cylinderGeometry args={[0.11, 0.11, 0.22, 16]} />
                    <meshStandardMaterial color="#16221c" emissive={ACCENT.green} emissiveIntensity={0.35} toneMapped={false} />
                </mesh>
            </group>

            {/* Three contending workers at 120°. */}
            {WORKER_ANGLE.map((angle, w) => (
                <group
                    key={`worker-${w}`}
                    ref={(el) => { workerRefs.current[w] = el; }}
                    position={[Math.cos(angle) * REST_RADIUS, 0, Math.sin(angle) * REST_RADIUS]}
                    rotation={[0, -angle, 0]}
                >
                    <mesh geometry={geo.worker} position={[0, BASE_TOP + 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    <AccentInsert
                        ref={(el) => { workerLedRefs.current[w] = el; }}
                        color={ACCENT.green}
                        args={[0.24, 0.025, 0.24]}
                        position={[0, BASE_TOP + 0.51, 0]}
                        rest={0.03}
                    />
                </group>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 1.18]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    LOCK
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

DistributedLock.displayName = 'DistributedLock';

export default DistributedLock;
