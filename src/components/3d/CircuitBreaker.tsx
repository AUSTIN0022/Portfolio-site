'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic } from '@/components/materials/materials';
import { track, type Keyframes } from '@/lib/utils/glyphMotion';
import {
    ACCENT, BASE_TOP, Plinth, setAccent, applyFloat,
    useGlyphReducedMotion, useGlyphPorts, makePortLookup, resolveInitialRotation,
    type GlyphProps, type GlyphRef,
} from '@/components/3d/glyphs/glyphShared';

// ─── The loop ────────────────────────────────────────────────────────────────
// 9s through all three states, so each gets long enough to be recognised:
//   0.0–3.5  CLOSED (green)      requests flow through to downstream and return
//   2.6–3.5  downstream starts failing; the breaker has seen enough
//   3.5–6.5  OPEN (red)          requests are rejected AT the breaker and bounce
//                                back fast, never reaching the sick service
//   6.5–8.6  HALF-OPEN (amber)   exactly one trial request is let through
//   8.6–9.0  the trial succeeds → snaps back to CLOSED
const LOOP = 9.0;
const PACKET_COUNT = 3;
const PACKET_PERIOD = 3.0;

const BREAKER_X = 0;
const UPSTREAM_X = -1.15;
const DOWNSTREAM_X = 1.15;
const ENTRY_X = -1.45;

/** Lever angle: flat when closed, thrown when open, part-way when half-open. */
const LEVER: Keyframes = [
    [0, 0], [3.4, 0], [3.62, -0.85], [6.4, -0.85], [6.62, -0.45], [8.5, -0.45], [8.72, 0], [9, 0],
];
const REDNESS: Keyframes = [[3.4, 0], [3.6, 1], [6.4, 1], [6.6, 0], [9, 0]];
const AMBERNESS: Keyframes = [[6.4, 0], [6.6, 1], [8.5, 1], [8.7, 0], [9, 0]];
/** Downstream health — it goes dark while it is the thing that's sick. */
const DOWNSTREAM_HEALTH: Keyframes = [
    [0, 1], [2.4, 1], [2.8, 0.15], [6.6, 0.15], [8.5, 1], [9, 1],
];

// Through path: out to the downstream service and back.
const X_THROUGH: Keyframes = [
    [0, ENTRY_X], [0.32, BREAKER_X], [0.4, BREAKER_X], [0.6, DOWNSTREAM_X],
    [0.7, DOWNSTREAM_X], [0.92, ENTRY_X], [1, ENTRY_X],
];
// Rejected: stopped at the breaker face and returned immediately. The bounce is
// FAST on purpose — failing fast without touching the sick service is the payoff.
const X_BOUNCE: Keyframes = [
    [0, ENTRY_X], [0.32, BREAKER_X - 0.22], [0.4, BREAKER_X - 0.22], [0.62, ENTRY_X], [1, ENTRY_X],
];
const S_PACKET: Keyframes = [[0, 0], [0.05, 1], [0.94, 1], [1, 0]];

// The spec's resting frame is deliberately the OPEN state: unlike the other
// glyphs, here the "failure" IS the feature — a tripped breaker bouncing a request
// away from a dark downstream is the protection working, not a broken system.
const FROZEN_T = 5.0;
const FROZEN_U = [0.36, 0.72, 0.08] as const;

const GREEN = new THREE.Color(ACCENT.green);
const RED = new THREE.Color(ACCENT.red);
const AMBER = new THREE.Color(ACCENT.amber);

/**
 * `circuit-breaker` — trip / half-open / closed (roadmap C2).
 *
 * The *Design-for-failure* principle: degrade without taking the rest down.
 */
const CircuitBreaker = forwardRef<GlyphRef, GlyphProps>(({
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
    const packetRefs = useRef<(THREE.Mesh | null)[]>([]);
    const leverRef = useRef<THREE.Group>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const downstreamRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => new THREE.Color(), []);

    const ports = useGlyphPorts(1.5, 0.7);
    useImperativeHandle(ref, () => makePortLookup(ports, 'CircuitBreaker'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        housing: createRoundedBoxGeometry({ width: 0.66, height: 0.6, depth: 0.6, radius: 0.12, bevel: 0.01, segments: 10 }),
        node: createRoundedBoxGeometry({ width: 0.5, height: 0.5, depth: 0.5, radius: 0.1, bevel: 0.01, segments: 10 }),
        packet: createRoundedBoxGeometry({ width: 0.18, height: 0.18, depth: 0.18, radius: 0.045, bevel: 0.008, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const t = frozen ? FROZEN_T : elapsed % LOOP;

        const red = track(t, REDNESS);
        const amber = track(t, AMBERNESS);
        const open = red > 0.5;
        const halfOpen = amber > 0.5;

        if (leverRef.current) leverRef.current.rotation.z = track(t, LEVER);

        if (ringRef.current) {
            const mat = ringRef.current.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(scratch.copy(GREEN).lerp(RED, red).lerp(AMBER, amber));
            mat.emissiveIntensity = 1.6;
        }

        const health = track(t, DOWNSTREAM_HEALTH);
        if (downstreamRef.current) {
            (downstreamRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05 + health * 0.9;
        }

        for (let i = 0; i < PACKET_COUNT; i++) {
            const packet = packetRefs.current[i];
            if (!packet) continue;
            const u = frozen ? FROZEN_U[i] : (elapsed / PACKET_PERIOD + i / PACKET_COUNT) % 1;

            // While half-open exactly ONE trial request is admitted; the rest still
            // bounce. Letting them all through would say "recovered", which is a
            // different (and much weaker) claim than "cautiously probing".
            const admitted = !open || (halfOpen && i === 0);
            packet.position.x = track(u, admitted ? X_THROUGH : X_BOUNCE);
            const s = track(u, S_PACKET);
            packet.scale.setScalar(s);
            packet.visible = s > 0.01;
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={3.0} depth={1.4} />

            {/* Pipe run the requests travel along. */}
            <mesh position={[0, BASE_TOP + 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.07, 0.07, 2.7, 14]} />
                <WhiteCeramic />
            </mesh>

            {/* Upstream caller */}
            <mesh geometry={geo.node} position={[UPSTREAM_X, BASE_TOP + 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>

            {/* Downstream service — dims when it is the thing failing. */}
            <mesh ref={downstreamRef} geometry={geo.node} position={[DOWNSTREAM_X, BASE_TOP + 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#e8e6dd" roughness={0.34} emissive={ACCENT.green} emissiveIntensity={0.9} toneMapped={false} />
            </mesh>

            {/* Breaker housing, with the status ring around it and the lever on top. */}
            <group position={[BREAKER_X, 0, 0]}>
                <mesh geometry={geo.housing} position={[0, BASE_TOP + 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <mesh ref={ringRef} position={[0, BASE_TOP + 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.4, 0.045, 10, 32]} />
                    <meshStandardMaterial color="#15181d" emissive={ACCENT.green} emissiveIntensity={1.6} toneMapped={false} />
                </mesh>
                {/* Lever pivots about its left end, so the throw reads as a switch
                    being thrown rather than a bar sliding. */}
                <group ref={leverRef} position={[-0.02, BASE_TOP + 0.63, 0]}>
                    <mesh position={[0.17, 0.03, 0]} castShadow>
                        <boxGeometry args={[0.38, 0.08, 0.12]} />
                        <WhiteCeramic />
                    </mesh>
                </group>
                <mesh position={[-0.02, BASE_TOP + 0.63, 0]} castShadow>
                    <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
                    <WhiteCeramic />
                </mesh>
            </group>

            {Array.from({ length: PACKET_COUNT }, (_, i) => (
                <mesh
                    key={`packet-${i}`}
                    ref={(el) => { packetRefs.current[i] = el; }}
                    geometry={geo.packet}
                    position={[ENTRY_X, BASE_TOP + 0.2, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.4} toneMapped={false} />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.76]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    BREAKER
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

CircuitBreaker.displayName = 'CircuitBreaker';

export default CircuitBreaker;
