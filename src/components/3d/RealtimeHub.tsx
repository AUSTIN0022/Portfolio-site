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
// 4.5s: broadcast → fan-out → ack → surge → settle.
//   0.10  the hub emits: its crown flashes blue
//   0.10–0.40  a broadcast ring expands outward to the connection ring
//   0.34–0.50  each dot lights as the wave reaches it (slight angular stagger,
//              so it reads as a sweep around the crowd rather than one flat blink)
//   0.50–0.66  dots settle back to green (connected/healthy); hub acks green
//   0.55–0.95  a surge: six more clients connect, then drop away again
const LOOP = 4.5;

const RING_RADIUS: Keyframes = [[0.10, 0.3], [0.40, 1.02], [0.48, 1.18]];
const RING_GLOW: Keyframes = [[0.08, 0], [0.12, 3.0], [0.34, 2.2], [0.48, 0]];
const SURGE: Keyframes = [
    [0, 0], [0.55, 0], [0.63, 1.12], [0.68, 1.0], [0.88, 1.0], [0.95, 0], [1, 0],
];

// Mid-broadcast: the wave has reached the ring and the crowd is lit. A frame that
// shows the fan-out actually happening, not an idle ring of dots.
const FROZEN_P = 0.42;

// ─── Geometry ────────────────────────────────────────────────────────────────
const DOT_COUNT = 18;
const DOT_RADIUS = 0.95;
/** Every third dot is a surge client — present only during the burst. */
const isSurgeDot = (i: number) => i % 3 === 2;

const BLUE = new THREE.Color(ACCENT.blue);
const GREEN = new THREE.Color(ACCENT.green);

/**
 * `realtime-hub` — the QUIZBUZZ glyph (roadmap A3).
 *
 * The `Laptop` currently on that card is clear but generic: it says "an app". The
 * QuizBuzz headline is 10,000 concurrent WebSocket users, so this shows the shape
 * of that instead — a hub broadcasting to a ring of clients, the crowd lighting in
 * a wave, and the ring visibly thickening under a surge before settling.
 */
const RealtimeHub = forwardRef<GlyphRef, GlyphProps>(({
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
    const dotRefs = useRef<(THREE.Mesh | null)[]>([]);
    const ringRef = useRef<THREE.Mesh>(null);
    const crownRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => new THREE.Color(), []);

    const ports = useGlyphPorts(1.25, 1.1);
    useImperativeHandle(ref, () => makePortLookup(ports, 'RealtimeHub'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 18),
        [rotation, defaultView],
    );

    // Sized against the 1.9-diameter client ring: a smaller hub let the ring win and
    // the glyph read as a bare circle of dots with a peg in it. The hub has to look
    // like the thing doing the broadcasting.
    const hubGeometry = useMemo(() => createRoundedBoxGeometry({
        width: 0.82, height: 0.82, depth: 0.68, radius: 0.14, bevel: 0.012, segments: 12,
    }), []);

    // Angles precomputed: nothing in the frame loop may allocate or call trig on
    // fresh objects, and 18 dots × 60fps is exactly where that would show.
    const dots = useMemo(
        () => Array.from({ length: DOT_COUNT }, (_, i) => {
            const a = (i / DOT_COUNT) * Math.PI * 2;
            return { x: Math.cos(a) * DOT_RADIUS, z: Math.sin(a) * DOT_RADIUS, t: i / DOT_COUNT, surge: isSurgeDot(i) };
        }),
        [],
    );

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const p = reduced || !animationToggle ? FROZEN_P : (elapsed % LOOP) / LOOP;

        // The expanding broadcast wavefront.
        if (ringRef.current) {
            const r = track(p, RING_RADIUS);
            ringRef.current.scale.set(r, r, 1);
            setAccent(ringRef.current, track(p, RING_GLOW));
        }

        const surge = track(p, SURGE);

        for (let i = 0; i < DOT_COUNT; i++) {
            const dot = dotRefs.current[i];
            if (!dot) continue;
            const d = dots[i];

            if (d.surge) {
                dot.scale.setScalar(surge);
                dot.visible = surge > 0.02;
                if (!dot.visible) continue;
            }

            // The wave sweeps around the ring rather than hitting every dot at once.
            const lit = bump(p, 0.34 + d.t * 0.05, 0.50 + d.t * 0.05, 0.05);
            const mat = dot.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(scratch.copy(GREEN).lerp(BLUE, lit));
            mat.emissiveIntensity = 0.22 + lit * 2.4;
        }

        // Hub crown: blue on emit, green on ack.
        setAccent(crownRef.current, 0.15 + bump(p, 0.06, 0.16, 0.04) * 3.0 + bump(p, 0.62, 0.72, 0.05) * 1.6);

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.5} depth={2.3} />

            {/* The connection ring the clients sit on — reads as "these belong to the
                hub" without paying for 18 individual spokes, which would be mush at
                thumbnail size anyway. */}
            <mesh position={[0, BASE_TOP + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
                <torusGeometry args={[DOT_RADIUS, 0.03, 8, 56]} />
                <WhiteCeramic />
            </mesh>

            {/* Hub */}
            <mesh geometry={hubGeometry} position={[0, BASE_TOP + 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            <AccentInsert ref={crownRef} color={ACCENT.blue} args={[0.42, 0.025, 0.42]} position={[0, BASE_TOP + 0.69, 0]} rest={0.15} />

            {/* The expanding broadcast wavefront. Scaled on X/Y then laid flat, so one
                unit-radius torus serves every frame of the expansion. */}
            <mesh ref={ringRef} position={[0, BASE_TOP + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1, 0.022, 8, 48]} />
                <meshStandardMaterial color={ACCENT.blue} emissive={ACCENT.blue} emissiveIntensity={0} toneMapped={false} transparent opacity={0.9} />
            </mesh>

            {/* Clients. A ceramic body that glows rather than a dark dot that lights:
                the Skills section is pure black, and an unlit dark dot there is
                invisible until the wave reaches it — the crowd has to exist first for
                the fan-out to mean anything. */}
            {dots.map((d, i) => (
                <mesh
                    key={`dot-${i}`}
                    ref={(el) => { dotRefs.current[i] = el; }}
                    position={[d.x, BASE_TOP + 0.08, d.z]}
                >
                    <cylinderGeometry args={[0.075, 0.085, 0.16, 12]} />
                    <meshStandardMaterial
                        color="#e8e6dd"
                        roughness={0.32}
                        emissive={ACCENT.green}
                        emissiveIntensity={0.22}
                        toneMapped={false}
                    />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 1.16]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    REALTIME
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

RealtimeHub.displayName = 'RealtimeHub';

export default RealtimeHub;
