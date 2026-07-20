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
// 10s, the QuizBuzz event cycle:
//   0.0–1.5   IDLE serving; the live stack is retracted and dark
//   1.5–2.0   the switch throws
//   2.0–4.5   keys stream idle → live across the migration arc; live scales up
//   4.5–6.5   LIVE serving (green), idle dim
//   6.5–7.0   the switch throws back
//   7.0–9.0   keys stream live → idle; the live stack scales down
const LOOP = 10.0;
const KEY_COUNT = 5;

const IDLE_X = -0.95;
const LIVE_X = 0.95;

/** 0 = idle is serving, 1 = live is serving. Also drives the switch lever. */
const MODE: Keyframes = [
    [0, 0], [1.5, 0], [2.0, 1], [6.5, 1], [7.0, 0], [10, 0],
];
/** How far the live stack has scaled up. */
const LIVE_SCALE: Keyframes = [
    [0, 0.12], [1.8, 0.12], [3.6, 1], [6.6, 1], [8.4, 0.12], [10, 0.12],
];
/** Direction and progress of the migration. 1 = flowing idle→live, -1 = live→idle. */
const MIGRATION: Keyframes = [
    [0, 0], [1.9, 0], [2.1, 1], [4.4, 1], [4.6, 0], [6.9, 0], [7.1, -1], [8.9, -1], [9.1, 0], [10, 0],
];

// §2 resting frame: keys mid-flight across the pipe with the live stack
// half-scaled-up. 3.0s is exactly that moment.
const FROZEN_T = 3.0;

// The migration arc, as an ellipse the keys ride. Precomputed constants so the
// per-frame position is two trig calls and no allocation.
const ARC_CX = 0;
const ARC_CY = BASE_TOP + 0.55;
const ARC_RX = 0.95;
const ARC_RY = 0.62;
const ARC_SEGMENTS = 28;

/**
 * `mode-switch` — QuizBuzz idle ⇄ live infrastructure migration (roadmap C4).
 *
 * The most portfolio-specific glyph in the set: two infrastructure stacks with
 * data migrated across at the switch. The two stacks are deliberately asymmetric —
 * idle is one modest block, live is a taller stack that grows — so which one is
 * serving is readable even in a still frame.
 */
const ModeSwitch = forwardRef<GlyphRef, GlyphProps>(({
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
    const keyRefs = useRef<(THREE.Mesh | null)[]>([]);
    const liveStackRef = useRef<THREE.Group>(null);
    const leverRef = useRef<THREE.Group>(null);
    const idleLedRef = useRef<THREE.Mesh>(null);
    const liveLedRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);

    const ports = useGlyphPorts(1.5, 0.7);
    useImperativeHandle(ref, () => makePortLookup(ports, 'ModeSwitch'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 18),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        block: createRoundedBoxGeometry({ width: 0.5, height: 0.5, depth: 0.3, radius: 0.08, bevel: 0.01, segments: 10 }),
        key: createRoundedBoxGeometry({ width: 0.15, height: 0.15, depth: 0.15, radius: 0.04, bevel: 0.008, segments: 8 }),
    }), []);

    // The arc is drawn as a thin tube through sampled ellipse points, so the pipe
    // and the keys provably follow the same curve.
    const arcGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= ARC_SEGMENTS; i++) {
            const a = Math.PI - (i / ARC_SEGMENTS) * Math.PI;
            points.push(new THREE.Vector3(ARC_CX + Math.cos(a) * ARC_RX, ARC_CY + Math.sin(a) * ARC_RY, 0));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), ARC_SEGMENTS, 0.035, 8, false);
    }, []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const t = frozen ? FROZEN_T : elapsed % LOOP;

        const mode = track(t, MODE);
        const liveScale = track(t, LIVE_SCALE);
        const migration = track(t, MIGRATION);

        if (leverRef.current) leverRef.current.rotation.z = -0.55 + mode * 1.1;
        if (liveStackRef.current) liveStackRef.current.scale.y = liveScale;

        // Whichever stack is serving is the green one.
        setAccent(idleLedRef.current, 0.1 + (1 - mode) * 1.8);
        setAccent(liveLedRef.current, 0.1 + mode * 1.8 * liveScale);

        const flowing = Math.abs(migration) > 0.05;
        for (let i = 0; i < KEY_COUNT; i++) {
            const key = keyRefs.current[i];
            if (!key) continue;
            if (!flowing) { key.visible = false; continue; }
            key.visible = true;

            // s runs 0→1 along the arc; a negative migration simply reverses it, so
            // one path serves both directions of the migration.
            let s = ((frozen ? FROZEN_T * 0.5 : elapsed * 0.5) + i / KEY_COUNT) % 1;
            if (migration < 0) s = 1 - s;

            const a = Math.PI - s * Math.PI;
            key.position.x = ARC_CX + Math.cos(a) * ARC_RX;
            key.position.y = ARC_CY + Math.sin(a) * ARC_RY;
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={3.0} depth={1.4} />

            {/* The migration pipe. */}
            <mesh geometry={arcGeometry} castShadow>
                <meshPhysicalMaterial color="#e4e2d9" roughness={0.28} metalness={0} clearcoat={0.6} transparent opacity={0.42} />
            </mesh>

            {/* IDLE stack — one modest block. */}
            <group position={[IDLE_X, 0, 0]}>
                <mesh geometry={geo.block} position={[0, BASE_TOP + 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <mesh ref={idleLedRef} position={[0, BASE_TOP + 0.33, 0]}>
                    <boxGeometry args={[0.3, 0.025, 0.3]} />
                    <meshStandardMaterial color="#15181d" emissive={ACCENT.green} emissiveIntensity={1.8} toneMapped={false} />
                </mesh>
            </group>

            {/* LIVE stack — scales up on the switch. Anchored at the plinth so it
                grows UPWARD out of the base rather than expanding about its middle. */}
            <group ref={liveStackRef} position={[LIVE_X, BASE_TOP, 0]}>
                {[0, 1, 2].map((k) => (
                    <mesh key={`live-${k}`} geometry={geo.block} position={[0, 0.16 + k * 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                ))}
                <mesh ref={liveLedRef} position={[0, 1.01, 0]}>
                    <boxGeometry args={[0.3, 0.025, 0.3]} />
                    <meshStandardMaterial color="#15181d" emissive={ACCENT.green} emissiveIntensity={0.1} toneMapped={false} />
                </mesh>
            </group>

            {/* The throw-switch between them. */}
            <mesh position={[0, BASE_TOP + 0.08, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.22, 0.24, 0.16, 20]} />
                <WhiteCeramic />
            </mesh>
            <group ref={leverRef} position={[0, BASE_TOP + 0.16, 0]}>
                <mesh position={[0, 0.12, 0]} castShadow>
                    <boxGeometry args={[0.07, 0.26, 0.07]} />
                    <WhiteCeramic />
                </mesh>
            </group>

            {/* Migrating keys. */}
            {Array.from({ length: KEY_COUNT }, (_, i) => (
                <mesh
                    key={`key-${i}`}
                    ref={(el) => { keyRefs.current[i] = el; }}
                    geometry={geo.key}
                    position={[IDLE_X, ARC_CY, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.6} toneMapped={false} />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.76]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    IDLE / LIVE
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

ModeSwitch.displayName = 'ModeSwitch';

export default ModeSwitch;
