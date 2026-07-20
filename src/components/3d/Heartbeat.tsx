'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic } from '@/components/materials/materials';
import { bump } from '@/lib/utils/glyphMotion';
import {
    ACCENT, BASE_TOP, Plinth, AccentInsert, setAccent, applyFloat,
    useGlyphReducedMotion, useGlyphPorts, makePortLookup, resolveInitialRotation,
    type GlyphProps, type GlyphRef,
} from '@/components/3d/glyphs/glyphShared';

// ─── The loop ────────────────────────────────────────────────────────────────
// A steady green pulse every 1.4s. Every 5th beat is MISSED — the ring skips and
// flips amber — then recovers. The miss is what makes this a health probe rather
// than decoration: a pulse that never falters says nothing about liveness.
const BEAT = 1.4;
const BEATS_PER_CYCLE = 5;
const LOOP = BEAT * BEATS_PER_CYCLE;

// §2 resting frame: mid-pulse, ring bright green — never frozen on the miss.
const FROZEN_BEAT_U = 0.22;

const GREEN = new THREE.Color(ACCENT.green);
const AMBER = new THREE.Color(ACCENT.amber);

/**
 * `heartbeat` — liveness / health-check (roadmap C8).
 *
 * Health probes and uptime. The smallest glyph in the set apart from the stat
 * micro-objects, and deliberately so: it is one idea.
 */
const Heartbeat = forwardRef<GlyphRef, GlyphProps>(({
    position = [0, 0, 0],
    rotation,
    scale = 1.0,
    floating = true,
    defaultView = 'isometric',
    animationToggle = true,
    showPorts = false,
    forceReducedMotion,
}, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const coreRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => new THREE.Color(), []);

    const ports = useGlyphPorts(0.85, 0.85);
    useImperativeHandle(ref, () => makePortLookup(ports, 'Heartbeat'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 18),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        node: createRoundedBoxGeometry({ width: 0.56, height: 0.56, depth: 0.44, radius: 0.11, bevel: 0.01, segments: 10 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;

        const beatIndex = frozen ? 0 : Math.floor((elapsed % LOOP) / BEAT);
        const u = frozen ? FROZEN_BEAT_U : (elapsed % BEAT) / BEAT;
        const missed = !frozen && beatIndex === BEATS_PER_CYCLE - 1;

        // On a missed beat the pulse simply does not fire — the absence is the
        // signal, so nothing else needs to change to make it read.
        const pulse = missed ? 0 : bump(u, 0.0, 0.3, 0.09);
        const alarm = missed ? bump(u, 0.15, 0.85, 0.12) : 0;

        if (ringRef.current) {
            const s = 1 + pulse * 0.35;
            ringRef.current.scale.set(s, s, 1);
            const mat = ringRef.current.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(scratch.copy(GREEN).lerp(AMBER, alarm));
            mat.emissiveIntensity = 0.25 + pulse * 3.2 + alarm * 1.6;
        }

        setAccent(coreRef.current, 0.15 + pulse * 2.6 + alarm * 0.8);

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={1.7} depth={1.7} />

            <mesh geometry={geo.node} position={[0, BASE_TOP + 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            <AccentInsert ref={coreRef} color={ACCENT.green} args={[0.3, 0.025, 0.3]} position={[0, BASE_TOP + 0.45, 0]} rest={0.15} />

            {/* The pulsing ring, laid flat on the plinth around the node. */}
            <mesh ref={ringRef} position={[0, BASE_TOP + 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.62, 0.045, 10, 40]} />
                <meshStandardMaterial color="#16221c" emissive={ACCENT.green} emissiveIntensity={0.25} toneMapped={false} />
            </mesh>

            {showPorts && ports.map((port) => (
                <mesh key={`debug-port-${port.id}`} position={port.position}>
                    <sphereGeometry args={[0.06, 12, 12]} />
                    <meshBasicMaterial color="#FF3300" depthTest={false} transparent opacity={0.8} />
                </mesh>
            ))}
        </group>
    );
});

Heartbeat.displayName = 'Heartbeat';

export default Heartbeat;
