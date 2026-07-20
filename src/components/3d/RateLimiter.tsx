'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic, YellowAccent } from '@/components/materials/materials';
import { track, bump, type Keyframes } from '@/lib/utils/glyphMotion';
import {
    ACCENT, BASE_TOP, Plinth, AccentInsert, setAccent, applyFloat,
    useGlyphReducedMotion, useGlyphPorts, makePortLookup, resolveInitialRotation,
    type GlyphProps, type GlyphRef,
} from '@/components/3d/glyphs/glyphShared';

// ─── The loop ────────────────────────────────────────────────────────────────
// 8s: tokens drip in and requests spend them → a burst drains the bucket faster
// than it refills → the gate shuts and requests visibly PILE UP (backpressure) →
// the refill catches up, the queue drains, normal flow resumes.
const LOOP = 8.0;
const REQUEST_COUNT = 5;

/** Token level in the bucket, 0..1. */
const LEVEL: Keyframes = [
    [0, 0.85], [1.6, 0.95], [2.4, 0.55], [3.2, 0.18], [3.8, 0.04],
    [5.0, 0.06], [6.2, 0.5], [8, 0.85],
];
/** >0.5 means the gate lets requests through. Shut while the bucket is empty. */
const GATE: Keyframes = [
    [0, 1], [3.5, 1], [3.7, 0], [5.9, 0], [6.2, 1], [8, 1],
];

const LANE_X0 = -1.25;
const LANE_X1 = 1.25;
const GATE_U = 0.5;
const GATE_X = LANE_X0 + GATE_U * (LANE_X1 - LANE_X0);
const TOKEN_SLOTS = 6;

// §2 resting frame: bucket about half full and refilling, with requests held at a
// shut gate. The spec's "one consuming while two wait" cannot hold in a single
// frame (a request only consumes when the gate is open), so this picks the moment
// that actually carries the concept: visible backpressure, visible refill.
const FROZEN_P = 0.74;

const BLUE_BODY = new THREE.Color('#1d4ed8');
const BLUE_EMIT = new THREE.Color(ACCENT.blue);
const GREY_BODY = new THREE.Color('#7b8290');
const GREY_EMIT = new THREE.Color('#3f4653');

/**
 * `rate-limiter` — token bucket / backpressure (roadmap B5).
 *
 * Rate limiting and fault tolerance: QuizBuzz's load testing, SmartFormFlow's
 * throughput guards. Requests must spend a yellow token to pass. When the bucket
 * empties they queue at the gate and dim to grey — denied *for now*, not failed,
 * which is the distinction backpressure is all about.
 */
const RateLimiter = forwardRef<GlyphRef, GlyphProps>(({
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
    const requestRefs = useRef<(THREE.Mesh | null)[]>([]);
    const tokenRefs = useRef<(THREE.Mesh | null)[]>([]);
    const gateLedRef = useRef<THREE.Mesh>(null);
    const dripRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => ({ body: new THREE.Color(), emit: new THREE.Color() }), []);

    // Preallocated scratch for the queue ordering. Five requests is small enough
    // that the O(n²) rank scan is free, but it must not allocate per frame.
    const queue = useMemo(() => ({
        u: new Float32Array(REQUEST_COUNT),
        waiting: new Uint8Array(REQUEST_COUNT),
    }), []);

    const ports = useGlyphPorts(1.45, 0.8);
    useImperativeHandle(ref, () => makePortLookup(ports, 'RateLimiter'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        request: createRoundedBoxGeometry({ width: 0.19, height: 0.19, depth: 0.19, radius: 0.05, bevel: 0.008, segments: 8 }),
        post: createRoundedBoxGeometry({ width: 0.12, height: 0.14, depth: 0.5, radius: 0.04, bevel: 0.008, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const p = frozen ? FROZEN_P : (elapsed % LOOP) / LOOP;
        const t = p * LOOP;

        const level = track(t, LEVEL);
        const open = track(t, GATE) > 0.5;

        // Pass 1: where each request would be, and whether the gate stops it.
        for (let i = 0; i < REQUEST_COUNT; i++) {
            const raw = elapsed / LOOP + i * 0.2;
            const u = frozen ? (FROZEN_P + i * 0.2) % 1 : raw % 1;
            queue.u[i] = u;
            queue.waiting[i] = !open && u > GATE_U ? 1 : 0;
        }

        // Pass 2: rank the waiting ones so they stack behind the gate in arrival
        // order — a pile-up only reads as a QUEUE if the order is stable.
        let passFlash = 0;
        for (let i = 0; i < REQUEST_COUNT; i++) {
            const mesh = requestRefs.current[i];
            if (!mesh) continue;
            const u = queue.u[i];

            let x: number;
            if (queue.waiting[i]) {
                let rank = 0;
                for (let j = 0; j < REQUEST_COUNT; j++) {
                    if (j !== i && queue.waiting[j] && queue.u[j] > u) rank++;
                }
                x = GATE_X - 0.13 - rank * 0.24;
            } else {
                x = LANE_X0 + u * (LANE_X1 - LANE_X0);
                if (u > GATE_U) passFlash = Math.max(passFlash, bump(u, GATE_U, GATE_U + 0.1, 0.04));
            }
            mesh.position.x = x;

            // Fade in at the lane entry, out at the exit.
            const s = Math.min(bump(u, 0.02, 0.97, 0.04) + 0.0, 1);
            mesh.scale.setScalar(s);
            mesh.visible = s > 0.02;

            // Held requests dim to grey: denied for now, not failed.
            const held = queue.waiting[i] ? 1 : 0;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.color.copy(scratch.body.copy(BLUE_BODY).lerp(GREY_BODY, held));
            mat.emissive.copy(scratch.emit.copy(BLUE_EMIT).lerp(GREY_EMIT, held));
            mat.emissiveIntensity = held ? 0.35 : 2.4;
        }

        // Gate LED: green go on a pass, dark while shut.
        setAccent(gateLedRef.current, open ? 0.25 + passFlash * 3.2 : 0.08);

        // Token discs: the visible balance in the bucket.
        const filled = level * TOKEN_SLOTS;
        for (let k = 0; k < TOKEN_SLOTS; k++) {
            const disc = tokenRefs.current[k];
            if (!disc) continue;
            const fill = Math.min(Math.max(filled - k, 0), 1);
            disc.scale.set(1, fill, 1);
            disc.visible = fill > 0.03;
        }

        // Drip from the spout — the refill rate, always running.
        if (dripRef.current) {
            const frac = frozen ? 0.4 : (elapsed * 1.4) % 1;
            dripRef.current.position.y = BASE_TOP + 1.42 - frac * 0.34;
            dripRef.current.visible = true;
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.9} depth={1.6} />

            {/* Lane along the front. */}
            <mesh position={[0, BASE_TOP + 0.03, 0.34]} receiveShadow castShadow>
                <boxGeometry args={[2.6, 0.06, 0.34]} />
                <WhiteCeramic />
            </mesh>

            {/* The gate the requests must pass. */}
            {[-0.26, 0.26].map((z) => (
                <mesh key={`gatepost-${z}`} geometry={geo.post} position={[GATE_X, BASE_TOP + 0.25, 0.34 + z]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
                    <WhiteCeramic />
                </mesh>
            ))}
            <AccentInsert ref={gateLedRef} color={ACCENT.green} args={[0.1, 0.025, 0.3]} position={[GATE_X, BASE_TOP + 0.47, 0.34]} rest={0.2} />

            {/* Bucket on its stand, behind and above the gate so the tokens visibly
                feed it. Translucent so the balance is readable at a glance. */}
            <mesh position={[GATE_X, BASE_TOP + 0.3, -0.32]} castShadow receiveShadow>
                <cylinderGeometry args={[0.16, 0.2, 0.6, 16]} />
                <WhiteCeramic />
            </mesh>
            <group position={[GATE_X, BASE_TOP + 0.95, -0.32]}>
                <mesh castShadow>
                    <cylinderGeometry args={[0.4, 0.4, 0.68, 28, 1, true]} />
                    <meshPhysicalMaterial
                        color="#e4e2d9"
                        roughness={0.26}
                        metalness={0}
                        clearcoat={0.6}
                        transparent
                        opacity={0.32}
                        side={THREE.DoubleSide}
                    />
                </mesh>
                <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <torusGeometry args={[0.4, 0.03, 8, 32]} />
                    <WhiteCeramic />
                </mesh>
                <mesh position={[0, -0.32, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.4, 0.4, 0.05, 28]} />
                    <WhiteCeramic />
                </mesh>

                {/* Token discs — yellow, the palette's "work permit". */}
                {Array.from({ length: TOKEN_SLOTS }, (_, k) => (
                    <mesh
                        key={`token-${k}`}
                        ref={(el) => { tokenRefs.current[k] = el; }}
                        position={[0, -0.26 + k * 0.1, 0]}
                        castShadow
                    >
                        <cylinderGeometry args={[0.3, 0.3, 0.07, 20]} />
                        <YellowAccent />
                    </mesh>
                ))}
            </group>

            {/* Spout + drip */}
            <mesh position={[GATE_X, BASE_TOP + 1.52, -0.32]} castShadow>
                <cylinderGeometry args={[0.11, 0.15, 0.16, 16]} />
                <WhiteCeramic />
            </mesh>
            <mesh ref={dripRef} position={[GATE_X, BASE_TOP + 1.3, -0.32]}>
                <sphereGeometry args={[0.05, 10, 10]} />
                <meshStandardMaterial color="#b8a000" emissive={ACCENT.yellow} emissiveIntensity={0.9} toneMapped={false} />
            </mesh>

            {/* Requests */}
            {Array.from({ length: REQUEST_COUNT }, (_, i) => (
                <mesh
                    key={`request-${i}`}
                    ref={(el) => { requestRefs.current[i] = el; }}
                    geometry={geo.request}
                    position={[LANE_X0, BASE_TOP + 0.16, 0.34]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.4} toneMapped={false} />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.86]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    RATE LIMIT
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

RateLimiter.displayName = 'RateLimiter';

export default RateLimiter;
