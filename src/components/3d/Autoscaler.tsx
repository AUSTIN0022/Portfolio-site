'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic, BlackBase, YellowAccent } from '@/components/materials/materials';
import { track, type Keyframes } from '@/lib/utils/glyphMotion';
import type { ConnectorPort, ConnectorConfig } from '@/types';

export interface AutoscalerProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    interactive?: boolean;
    floating?: boolean;
    showLabel?: boolean;
    defaultView?: 'front' | 'top' | 'isometric';
    connectors?: ConnectorConfig[];
    animationToggle?: boolean;
    showPorts?: boolean;
    /** Test hook for the /lab/playground harness — overrides the media query. */
    forceReducedMotion?: boolean;
}

export interface AutoscalerRef {
    getConnectorPort: (side: 'left' | 'right' | 'top' | 'bottom') => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

// ─── The loop ────────────────────────────────────────────────────────────────
// One 7-second story: pressure builds → it scales out → it absorbs → it relaxes.
// Beat 1 (0.0–2.0s)  requests pour in, the vessel fills past the high-water tick
// Beat 2 (2.0–2.6s)  a second instance scales out; the fill DROPS (load spread)
// Beat 3 (2.6–3.9s)  pressure returns, fill climbs again
// Beat 4 (3.9–4.5s)  a third instance scales out; fill drops again
// Beat 5 (4.5–7.0s)  traffic eases, the extra instances retract, fill settles low
const LOOP = 7.0;

const FILL: Keyframes = [
    [0, 0.15], [2.0, 0.95], [2.55, 0.42], [3.9, 0.9], [4.45, 0.4], [5.4, 0.28], [7, 0.15],
];

// The small overshoot before settling (1.12 → 1.0) IS the ceramic "settle" — an
// instance popping in should feel like a physical block landing, not a fade-in.
const INSTANCE_2: Keyframes = [
    [0, 0], [2.0, 0], [2.32, 1.12], [2.5, 1.0], [5.6, 1.0], [5.78, 1.06], [6.05, 0], [7, 0],
];
const INSTANCE_3: Keyframes = [
    [0, 0], [3.9, 0], [4.22, 1.12], [4.4, 1.0], [4.95, 1.0], [5.1, 1.06], [5.35, 0], [7, 0],
];

/** How hard the spout is running — drives drop visibility, so the calm phase reads as calm. */
const POUR: Keyframes = [
    [0, 0.85], [1.8, 1.0], [2.55, 0.9], [3.7, 1.0], [4.45, 0.55], [5.1, 0.12], [6.5, 0.12], [7, 0.85],
];

// §2 requires a resting frame that is *representative*, never ambiguous. 2.65s is
// the spec's frame: vessel ~42% full with two instances standing.
const FROZEN_T = 2.65;

// ─── Geometry constants ──────────────────────────────────────────────────────
// Proportions are set by the 120px test, not by realism. The first pass used a
// tall vessel beside 0.38-cube instances, and at thumbnail size the instances
// vanished behind the vessel — the glyph read as "a bucket", losing the half of
// the story that makes it an AUTOscaler. So: vessel shorter, instances taller
// than they are wide (they have to read as *servers*), plinth hugging both.
const BASE_TOP = -0.5;
const VESSEL_X = -0.7;
const VESSEL_R = 0.42;
const VESSEL_H = 0.86;
const FILL_R = 0.36;
const FILL_FLOOR = -0.46; // inner floor of the vessel
const FILL_MAX_H = 0.8;
const HIGH_WATER = 0.78; // fraction of FILL_MAX_H
const VESSEL_RIM_Y = BASE_TOP + VESSEL_H;
const INSTANCE_X = [0.2, 0.7, 1.2] as const;
const INSTANCE_W = 0.4;
const INSTANCE_H = 0.62;
const DROP_COUNT = 5;
const SPOUT_Y = 0.82;

/**
 * `autoscaler` — the INFRA glyph (roadmap A1).
 *
 * Replaces `LoadBalancer` on the INFRA card, which rendered as an anonymous
 * gadget. This one *acts out* elastic capacity: a vessel taking blue request
 * units, a yellow high-water threshold, and instance blocks that scale out when
 * the threshold is crossed and retract when the pressure passes.
 */
const Autoscaler = forwardRef<AutoscalerRef, AutoscalerProps>(({
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
    const fillRef = useRef<THREE.Mesh>(null);
    const dropsRef = useRef<(THREE.Mesh | null)[]>([]);
    const instanceRefs = useRef<(THREE.Group | null)[]>([]);

    const systemReduced = useReducedMotion();
    const reduced = forceReducedMotion ?? systemReduced ?? false;

    const portsList = useMemo((): ConnectorPort[] => [
        { id: 'left', side: 'left', position: [-1.35, 0, 0], normal: [-1, 0, 0], radius: 0.02 },
        { id: 'right', side: 'right', position: [1.35, 0, 0], normal: [1, 0, 0], radius: 0.02 },
        { id: 'top', side: 'top', position: [0, 0, -0.7], normal: [0, 0, -1], radius: 0.02 },
        { id: 'bottom', side: 'bottom', position: [0, 0, 0.7], normal: [0, 0, 1], radius: 0.02 },
    ], []);

    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find((p) => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Autoscaler`);
            return port;
        },
        getConnectorPorts: () => portsList,
    }));

    const initialRotation = useMemo((): [number, number, number] => {
        if (rotation) return rotation;
        switch (defaultView) {
            case 'top': return [-Math.PI / 2, 0, 0];
            case 'front': return [0, 0, 0];
            default: return [0, (25 * Math.PI) / 180, 0];
        }
    }, [rotation, defaultView]);

    const baseGeometry = useMemo(() => createRoundedBoxGeometry({
        width: 2.85, height: 1.25, depth: 0.24, radius: 0.1, bevel: 0.01, segments: 12,
    }), []);

    const instanceGeometry = useMemo(() => createRoundedBoxGeometry({
        width: INSTANCE_W, height: INSTANCE_W, depth: INSTANCE_H,
        radius: 0.08, bevel: 0.01, segments: 10,
    }), []);

    // Empty socket pads. Without these the plinth is a bare runway whenever the
    // extra instances are retracted, which reads as "unfinished" rather than
    // "headroom" — and a scale-out that fills a visible empty slot is a much
    // clearer beat than a block appearing out of nowhere.
    const socketGeometry = useMemo(() => createRoundedBoxGeometry({
        width: INSTANCE_W + 0.1, height: INSTANCE_W + 0.1, depth: 0.035,
        radius: 0.09, bevel: 0.008, segments: 10,
    }), []);

    // Fixed per-drop jitter so the pour looks like a stream, not a metronome.
    // Precomputed once — nothing in the frame loop may allocate.
    const dropOffsets = useMemo(
        () => Array.from({ length: DROP_COUNT }, (_, i) => ({
            x: (((i * 37) % 11) / 11 - 0.5) * 0.22,
            z: (((i * 53) % 7) / 7 - 0.5) * 0.22,
            phase: i / DROP_COUNT,
        })),
        [],
    );

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const t = reduced || !animationToggle ? FROZEN_T : elapsed % LOOP;

        const fill = track(t, FILL);
        const pour = reduced || !animationToggle ? 0 : track(t, POUR);
        const fillTop = FILL_FLOOR + fill * FILL_MAX_H;

        // Liquid column grows from the vessel floor.
        if (fillRef.current) {
            const f = Math.max(fill, 0.02);
            fillRef.current.scale.y = f;
            fillRef.current.position.y = FILL_FLOOR + (f * FILL_MAX_H) / 2;
        }

        // Instance 1 is always up (baseline capacity); 2 and 3 are the elastic ones.
        const presence2 = track(t, INSTANCE_2);
        const presence3 = track(t, INSTANCE_3);
        const g2 = instanceRefs.current[1];
        const g3 = instanceRefs.current[2];
        if (g2) { g2.scale.setScalar(presence2); g2.visible = presence2 > 0.01; }
        if (g3) { g3.scale.setScalar(presence3); g3.visible = presence3 > 0.01; }

        // Falling request units, recycled between spout and the liquid surface.
        for (let i = 0; i < DROP_COUNT; i++) {
            const drop = dropsRef.current[i];
            if (!drop) continue;
            if (pour < 0.25) { drop.visible = false; continue; }
            drop.visible = true;
            const frac = (elapsed * 1.5 + dropOffsets[i].phase) % 1;
            drop.position.y = SPOUT_Y - frac * (SPOUT_Y - fillTop);
            // Shrink on impact so it reads as absorbed into the column, not clipping through it.
            const s = 1 - Math.max(0, (frac - 0.88) / 0.12);
            drop.scale.setScalar(s);
        }

        if (groupRef.current) {
            if (floating && animationToggle && !reduced) {
                groupRef.current.position.y = position[1] + Math.sin(elapsed * 1.5) * 0.03;
            } else {
                groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, position[1], 0.05);
            }
        }
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            {/* Black plinth */}
            <mesh geometry={baseGeometry} position={[0, BASE_TOP - 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <BlackBase />
            </mesh>

            {/* ── The vessel ── */}
            <group position={[VESSEL_X, 0, 0]}>
                {/* Translucent open-top tank. DoubleSide so the far wall reads through the near one. */}
                <mesh position={[0, BASE_TOP + VESSEL_H / 2, 0]} castShadow>
                    <cylinderGeometry args={[VESSEL_R, VESSEL_R, VESSEL_H, 32, 1, true]} />
                    <meshPhysicalMaterial
                        color="#e4e2d9"
                        roughness={0.28}
                        metalness={0}
                        clearcoat={0.6}
                        clearcoatRoughness={0.3}
                        transparent
                        opacity={0.34}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Solid ceramic rim + floor give the transparent shell its silhouette at 120px. */}
                <mesh position={[0, VESSEL_RIM_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <torusGeometry args={[VESSEL_R, 0.035, 10, 40]} />
                    <WhiteCeramic />
                </mesh>
                <mesh position={[0, BASE_TOP + 0.03, 0]} receiveShadow castShadow>
                    <cylinderGeometry args={[VESSEL_R, VESSEL_R, 0.06, 32]} />
                    <WhiteCeramic />
                </mesh>

                {/* The rising request fill. Blue is the palette's data-in-motion accent,
                    but a volume this large cannot be treated like the hero packet: at
                    emissiveIntensity 1.6 with toneMapped off it clipped to a flat plastic
                    blob and swallowed the vessel. A liquid reads as a liquid when it is
                    tone-mapped and translucent — the bright un-tonemapped treatment is
                    reserved for the small drops, where it stays a highlight. */}
                <mesh ref={fillRef}>
                    <cylinderGeometry args={[FILL_R, FILL_R, FILL_MAX_H, 28]} />
                    <meshStandardMaterial
                        color="#2563eb"
                        emissive="#3b82f6"
                        emissiveIntensity={0.5}
                        roughness={0.25}
                        transparent
                        opacity={0.82}
                    />
                </mesh>

                {/* Yellow high-water tick: the threshold that triggers a scale-out. */}
                <mesh position={[0, FILL_FLOOR + HIGH_WATER * FILL_MAX_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[VESSEL_R + 0.015, 0.022, 8, 32]} />
                    <YellowAccent />
                </mesh>

                {/* Spout */}
                <mesh position={[0, SPOUT_Y + 0.12, 0]} castShadow>
                    <cylinderGeometry args={[0.13, 0.17, 0.16, 20]} />
                    <WhiteCeramic />
                </mesh>

                {/* Falling request units */}
                {dropOffsets.map((o, i) => (
                    <mesh
                        key={`drop-${i}`}
                        ref={(el) => { dropsRef.current[i] = el; }}
                        position={[o.x, SPOUT_Y, o.z]}
                    >
                        <sphereGeometry args={[0.055, 10, 10]} />
                        <meshStandardMaterial color="#1d4ed8" emissive="#3b82f6" emissiveIntensity={3} toneMapped={false} />
                    </mesh>
                ))}
            </group>

            {/* ── Instance slots: a socket pad each, baseline block + two elastic ── */}
            {INSTANCE_X.map((x, i) => (
                <group key={`slot-${i}`} position={[x, BASE_TOP, 0]}>
                    <mesh geometry={socketGeometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    <group ref={(el) => { instanceRefs.current[i] = el; }}>
                        <mesh geometry={instanceGeometry} position={[0, INSTANCE_H / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                            <WhiteCeramic />
                        </mesh>
                    </group>
                </group>
            ))}

            {showLabel && (
                <Text
                    position={[0, BASE_TOP - 0.12, 0.71]}
                    fontSize={0.12}
                    color="#f4f1ec"
                    fontWeight={700}
                    anchorX="center"
                    anchorY="middle"
                >
                    AUTOSCALER
                </Text>
            )}

            {showPorts && portsList.map((port) => (
                <mesh key={`debug-port-${port.id}`} position={port.position}>
                    <sphereGeometry args={[0.06, 12, 12]} />
                    <meshBasicMaterial color="#FF3300" depthTest={false} transparent opacity={0.8} />
                </mesh>
            ))}
        </group>
    );
});

Autoscaler.displayName = 'Autoscaler';

export default Autoscaler;
