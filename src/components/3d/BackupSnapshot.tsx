'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic } from '@/components/materials/materials';
import { track, bump, type Keyframes } from '@/lib/utils/glyphMotion';
import {
    ACCENT, BASE_TOP, Plinth, setAccent, applyFloat,
    useGlyphReducedMotion, useGlyphPorts, makePortLookup, resolveInitialRotation,
    type GlyphProps, type GlyphRef,
} from '@/components/3d/glyphs/glyphShared';

// ─── The loop ────────────────────────────────────────────────────────────────
// One snapshot per 4s: a tile peels off the DB, flies to the tray, and lands on
// the stack. The stack does NOT grow forever — the oldest tile fades out as each
// new one lands. That retention window is the honest part of the story: backups
// that accumulate without bound are a disk-full incident waiting to happen.
const LOOP = 4.0;
const TILE_COUNT = 4;

const DB_X = -0.72;
const TRAY_X = 0.82;
const TILE_RISE = BASE_TOP + 0.78;

const TILE_X: Keyframes = [[0, DB_X], [0.2, DB_X], [0.62, TRAY_X], [1, TRAY_X]];
const TILE_Y: Keyframes = [
    [0, BASE_TOP + 0.62], [0.2, TILE_RISE], [0.5, TILE_RISE], [0.72, BASE_TOP + 0.2], [1, BASE_TOP + 0.2],
];

// §2 resting frame: a snapshot tile mid-peel above a short stack.
const FROZEN_U = 0.32;

/**
 * `backup-snapshot` — durability / persistence (roadmap C9).
 *
 * Backups, retention, and the *Design-for-failure* line about disks filling up.
 * Like C1 this rebuilds the database form in the glyph language rather than
 * composing the existing `Database` node, which carries its own plinth and pose.
 */
const BackupSnapshot = forwardRef<GlyphRef, GlyphProps>(({
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
    const flyingTileRef = useRef<THREE.Mesh>(null);
    const stackRefs = useRef<(THREE.Mesh | null)[]>([]);
    const dbBandRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);

    const ports = useGlyphPorts(1.35, 0.7);
    useImperativeHandle(ref, () => makePortLookup(ports, 'BackupSnapshot'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        tile: createRoundedBoxGeometry({ width: 0.42, height: 0.42, depth: 0.07, radius: 0.05, bevel: 0.008, segments: 8 }),
        tray: createRoundedBoxGeometry({ width: 0.56, height: 0.56, depth: 0.1, radius: 0.06, bevel: 0.01, segments: 10 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const u = frozen ? FROZEN_U : (elapsed % LOOP) / LOOP;

        if (flyingTileRef.current) {
            flyingTileRef.current.position.x = track(u, TILE_X);
            flyingTileRef.current.position.y = track(u, TILE_Y);
            const s = track(u, [[0, 0], [0.18, 1], [0.74, 1], [0.8, 0], [1, 0]]);
            flyingTileRef.current.scale.setScalar(s);
            flyingTileRef.current.visible = s > 0.02;
        }

        // The stack shuffles down by one each cycle: the newest tile lands on top
        // while the oldest fades off the bottom of the retention window.
        for (let k = 0; k < TILE_COUNT; k++) {
            const tile = stackRefs.current[k];
            if (!tile) continue;
            // k=0 is the newest. It appears exactly as the flying tile lands.
            const age = k === 0 ? smoothLand(u) : 1;
            const fade = k === TILE_COUNT - 1 ? 1 - smoothLand(u) : 1;
            tile.scale.setScalar(Math.min(age, fade));
            tile.visible = Math.min(age, fade) > 0.02;
        }

        // The DB pulses tan as it emits, and green the instant the copy is safe.
        setAccent(dbBandRef.current, 0.15 + bump(u, 0.08, 0.26, 0.04) * 2.2);

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.7} depth={1.4} />

            {/* Database */}
            <group position={[DB_X, 0, 0]}>
                <mesh position={[0, BASE_TOP + 0.32, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.4, 0.4, 0.64, 28]} />
                    <WhiteCeramic />
                </mesh>
                <mesh ref={dbBandRef} position={[0, BASE_TOP + 0.32, 0]}>
                    <cylinderGeometry args={[0.415, 0.415, 0.12, 28]} />
                    <meshStandardMaterial color="#241d16" emissive={ACCENT.tan} emissiveIntensity={0.15} toneMapped={false} />
                </mesh>
            </group>

            {/* Snapshot tray */}
            <mesh geometry={geo.tray} position={[TRAY_X, BASE_TOP + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>

            {/* The retained stack. Newest on top; oldest fades out from the bottom. */}
            {Array.from({ length: TILE_COUNT }, (_, k) => (
                <mesh
                    key={`stack-${k}`}
                    ref={(el) => { stackRefs.current[k] = el; }}
                    geometry={geo.tile}
                    position={[TRAY_X, BASE_TOP + 0.32 - k * 0.09, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    {k === 0
                        ? <meshStandardMaterial color="#2b2318" emissive={ACCENT.green} emissiveIntensity={0.9} toneMapped={false} />
                        : <WhiteCeramic />}
                </mesh>
            ))}

            {/* The snapshot in flight, peeling off the DB. */}
            <mesh
                ref={flyingTileRef}
                geometry={geo.tile}
                position={[DB_X, BASE_TOP + 0.62, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                castShadow
            >
                <meshStandardMaterial color="#2b2318" emissive={ACCENT.tan} emissiveIntensity={1.4} toneMapped={false} />
            </mesh>

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.76]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    SNAPSHOTS
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

/** Landing curve for the newest tile / fade curve for the oldest. */
function smoothLand(u: number): number {
    return u < 0.72 ? 0 : Math.min((u - 0.72) / 0.1, 1);
}

BackupSnapshot.displayName = 'BackupSnapshot';

export default BackupSnapshot;
