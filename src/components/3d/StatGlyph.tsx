'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic } from '@/components/materials/materials';
import { smoothstep } from '@/lib/utils/glyphMotion';
import {
    ACCENT, BASE_TOP, Plinth, applyFloat,
    useGlyphReducedMotion, useGlyphPorts, makePortLookup, resolveInitialRotation,
    type GlyphProps, type GlyphRef,
} from '@/components/3d/glyphs/glyphShared';

export type StatVariant = 'users' | 'systems' | 'experience';

export interface StatGlyphProps extends GlyphProps {
    variant?: StatVariant;
}

// ─── The loop ────────────────────────────────────────────────────────────────
// These sit beside a counting number in the Stats strip, so they COUNT UP and
// hold rather than looping continuously — the motion has to feel like it belongs
// to the number next to it, then get out of the way.
const LOOP = 5.0;
const COUNT_UP = 2.4; // seconds spent rising; the rest is the hold
const DOT_COUNT = 11;
const STACK_COUNT = 5;
const ARC_SEGMENTS = 32;

// §2 resting frame: each at its final count — full swarm / full stack / full ring.
const FROZEN_PROGRESS = 1;

/**
 * Stat glyphs — micro-objects for the Stats strip (roadmap C6).
 *
 * One component, three variants, because they share a loop, a footprint and a
 * plinth and only differ in what accumulates:
 *   users      — a swarm of connection dots multiplying   (blue, energy)
 *   systems    — a stack of shipped blocks standing up    (tan, persistence)
 *   experience — an arc sweeping round as time accrues    (green)
 *
 * These render at ≤80px, far smaller than the card glyphs, which rules out any
 * internal detail: at that size a form is its silhouette and nothing else.
 */
const StatGlyph = forwardRef<GlyphRef, StatGlyphProps>(({
    variant = 'users',
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
    const dotRefs = useRef<(THREE.Mesh | null)[]>([]);
    const blockRefs = useRef<(THREE.Mesh | null)[]>([]);
    const arcRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);

    const ports = useGlyphPorts(0.7, 0.7);
    useImperativeHandle(ref, () => makePortLookup(ports, 'StatGlyph'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 18),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        block: createRoundedBoxGeometry({ width: 0.5, height: 0.5, depth: 0.16, radius: 0.05, bevel: 0.008, segments: 8 }),
    }), []);

    // A fixed pseudo-random swarm. Deterministic so the cluster looks designed
    // rather than different on every mount.
    const swarm = useMemo(
        () => Array.from({ length: DOT_COUNT }, (_, i) => {
            const a = i * 2.39996; // golden angle — even fill, no visible rings
            // Tighter than the first pass: a loose scatter read as dots adrift on a
            // slab, where the concept is a CLUSTER getting denser.
            const r = 0.08 + Math.sqrt(i / DOT_COUNT) * 0.3;
            return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: BASE_TOP + 0.12 + (i % 3) * 0.11 };
        }),
        [],
    );

    // Per-instance, because the draw range is mutated on it each frame.
    const arcGeometry = useMemo(
        () => new THREE.TorusGeometry(0.44, 0.075, 10, ARC_SEGMENTS),
        [],
    );

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const t = elapsed % LOOP;
        const progress = frozen ? FROZEN_PROGRESS : smoothstep(t / COUNT_UP);

        if (variant === 'users') {
            for (let i = 0; i < DOT_COUNT; i++) {
                const dot = dotRefs.current[i];
                if (!dot) continue;
                // Dots pop in one after another as the counter rises.
                const threshold = i / DOT_COUNT;
                const s = smoothstep((progress - threshold) * 6);
                dot.scale.setScalar(s);
                dot.visible = s > 0.02;
            }
        } else if (variant === 'systems') {
            for (let k = 0; k < STACK_COUNT; k++) {
                const block = blockRefs.current[k];
                if (!block) continue;
                const threshold = k / STACK_COUNT;
                const s = smoothstep((progress - threshold) * 6);
                block.scale.setScalar(s);
                block.visible = s > 0.02;
            }
        } else if (arcRef.current) {
            // A TRUE arc sweep, via the index draw range. Scaling the whole torus was
            // the first attempt and it doesn't sweep at all — it just shrinks the ring,
            // so mid-count it read as a small green blob sitting inside the white one
            // rather than time accruing. A torus indexes tubular-segment by
            // tubular-segment, so truncating the draw range reveals it around its
            // circumference. Snapped to whole quads (6 indices) to avoid torn tris.
            const index = arcGeometry.index;
            if (index) {
                const quads = Math.floor((index.count * progress) / 6);
                arcGeometry.setDrawRange(0, Math.max(0, quads) * 6);
            }
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            {/* Tight plinth: at ≤80px a generous base is most of the pixels, and the
                thing that actually has to read is what's standing on it. */}
            <Plinth width={1.2} depth={1.2} />

            {variant === 'users' && swarm.map((d, i) => (
                <mesh key={`dot-${i}`} ref={(el) => { dotRefs.current[i] = el; }} position={[d.x, d.y, d.z]} castShadow>
                    <sphereGeometry args={[0.09, 12, 12]} />
                    <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.2} toneMapped={false} />
                </mesh>
            ))}

            {variant === 'systems' && Array.from({ length: STACK_COUNT }, (_, k) => (
                <mesh
                    key={`block-${k}`}
                    ref={(el) => { blockRefs.current[k] = el; }}
                    geometry={geo.block}
                    position={[0, BASE_TOP + 0.09 + k * 0.19, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    {k % 2 === 1
                        ? <meshStandardMaterial color="#2b2318" emissive={ACCENT.tan} emissiveIntensity={0.7} toneMapped={false} />
                        : <WhiteCeramic />}
                </mesh>
            ))}

            {variant === 'experience' && (
                <>
                    <mesh position={[0, BASE_TOP + 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
                        <torusGeometry args={[0.44, 0.05, 8, ARC_SEGMENTS]} />
                        <WhiteCeramic />
                    </mesh>
                    <mesh ref={arcRef} geometry={arcGeometry} position={[0, BASE_TOP + 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <meshStandardMaterial color="#16221c" emissive={ACCENT.green} emissiveIntensity={2.0} toneMapped={false} />
                    </mesh>
                </>
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

StatGlyph.displayName = 'StatGlyph';

export default StatGlyph;
