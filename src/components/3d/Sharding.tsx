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
// Records fall into the router, which deflects each one left / centre / right by
// its key. The same key colour ALWAYS lands in the same shard — that consistency
// is the whole idea, so the routing is derived from the record's key rather than
// from anything time-based that could drift.
const LOOP = 6.0;
const RECORD_COUNT = 6;
const RECORD_PERIOD = 2.4;

const SHARD_X = [-0.8, 0, 0.8] as const;
const SHARD_Z = 0.5;
const ROUTER_Z = -0.45;
const ROUTER_Y = BASE_TOP + 0.95;

/** One muted accent per shard, so a record's destination is legible on arrival. */
const SHARD_ACCENT = [ACCENT.tan, ACCENT.green, ACCENT.amber] as const;

const Y_PATH: Keyframes = [
    [0, BASE_TOP + 1.5], [0.4, ROUTER_Y], [0.54, ROUTER_Y], [0.9, BASE_TOP + 0.5], [1, BASE_TOP + 0.5],
];
const Z_PATH: Keyframes = [
    [0, -1.0], [0.4, ROUTER_Z], [0.54, ROUTER_Z], [0.9, SHARD_Z], [1, SHARD_Z],
];
const S_PATH: Keyframes = [[0, 0], [0.06, 1], [0.9, 1], [0.96, 0], [1, 0]];

// §2 resting frame: three records frozen mid-deflection into their shards. Picked
// explicitly rather than derived from a phase, so the still image is composed.
const FROZEN_U = [0.72, 0.4, 0.86, 0.15, 0.62, 0.3] as const;

/**
 * `sharding` — partitioning by key (roadmap C3).
 *
 * Horizontal scale and data partitioning: a router that always sends the same key
 * to the same shard, with the shards filling evenly over time.
 */
const Sharding = forwardRef<GlyphRef, GlyphProps>(({
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
    const recordRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardBandRefs = useRef<(THREE.Mesh | null)[]>([]);

    const reduced = useGlyphReducedMotion(forceReducedMotion);

    const ports = useGlyphPorts(1.4, 1.0);
    useImperativeHandle(ref, () => makePortLookup(ports, 'Sharding'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 16),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        router: createRoundedBoxGeometry({ width: 1.1, height: 0.44, depth: 0.34, radius: 0.09, bevel: 0.01, segments: 10 }),
        record: createRoundedBoxGeometry({ width: 0.17, height: 0.17, depth: 0.17, radius: 0.045, bevel: 0.008, segments: 8 }),
    }), []);

    // A record's key is fixed for its whole life, so its shard is decided once,
    // before it ever reaches the router.
    const keyOf = (recordIndex: number, cycle: number) => (cycle * RECORD_COUNT + recordIndex) % 3;

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;

        for (let i = 0; i < RECORD_COUNT; i++) {
            const record = recordRefs.current[i];
            if (!record) continue;

            const raw = elapsed / RECORD_PERIOD + i / RECORD_COUNT;
            const u = frozen ? FROZEN_U[i] : raw % 1;
            const cycle = frozen ? 0 : Math.floor(raw);
            const shard = keyOf(i, cycle);

            // Deflection only begins after the router: before it, every record shares
            // the same intake, which is what makes the split legible as a decision.
            record.position.x = track(u, [[0, 0], [0.54, 0], [0.9, SHARD_X[shard]], [1, SHARD_X[shard]]]);
            record.position.y = track(u, Y_PATH);
            record.position.z = track(u, Z_PATH);

            const s = track(u, S_PATH);
            record.scale.setScalar(s);
            record.visible = s > 0.01;

            // The record wears its key's colour so you can match it to the shard it
            // lands in without following the whole trajectory.
            const mat = record.material as THREE.MeshStandardMaterial;
            mat.emissive.set(SHARD_ACCENT[shard]);
            mat.emissiveIntensity = 2.0;
        }

        // Shards brighten as they accumulate, and level off together — even fill.
        const fillPhase = frozen ? 0.6 : (elapsed % LOOP) / LOOP;
        for (let k = 0; k < 3; k++) {
            setAccent(shardBandRefs.current[k], 0.3 + fillPhase * 1.5);
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.7} depth={2.0} />

            {/* Router, raised at the back so the fan-out reads downward and forward. */}
            <mesh geometry={geo.router} position={[0, ROUTER_Y, ROUTER_Z]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            <mesh position={[0, BASE_TOP + 0.42, ROUTER_Z]} castShadow>
                <cylinderGeometry args={[0.09, 0.11, 0.72, 12]} />
                <WhiteCeramic />
            </mesh>

            {/* Three shards, each with its own accent band. */}
            {SHARD_X.map((x, k) => (
                <group key={`shard-${k}`} position={[x, 0, SHARD_Z]}>
                    <mesh position={[0, BASE_TOP + 0.28, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.3, 0.3, 0.56, 24]} />
                        <WhiteCeramic />
                    </mesh>
                    <mesh ref={(el) => { shardBandRefs.current[k] = el; }} position={[0, BASE_TOP + 0.2, 0]}>
                        <cylinderGeometry args={[0.315, 0.315, 0.1, 24]} />
                        <meshStandardMaterial color="#1c1f24" emissive={SHARD_ACCENT[k]} emissiveIntensity={0.6} toneMapped={false} />
                    </mesh>
                </group>
            ))}

            {Array.from({ length: RECORD_COUNT }, (_, i) => (
                <mesh
                    key={`record-${i}`}
                    ref={(el) => { recordRefs.current[i] = el; }}
                    geometry={geo.record}
                    position={[0, BASE_TOP + 1.5, -1.0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="#2b2f36" emissive={ACCENT.tan} emissiveIntensity={2.0} toneMapped={false} />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 1.06]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    SHARDING
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

Sharding.displayName = 'Sharding';

export default Sharding;
