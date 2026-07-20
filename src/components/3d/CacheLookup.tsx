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
// Four passes of 2.2s: HIT, HIT, HIT, MISS. The 3:1 ratio is the point — it has
// to be obvious both that hits are the norm AND that a miss costs visibly more,
// so the two paths differ in LENGTH and in DURATION, not just in colour.
const PASS = 2.2;
const PASS_COUNT = 4;
const LOOP = PASS * PASS_COUNT;
const MISS_PASS = 3;

const ENTRY_X = -1.42;
const CACHE_X = -0.72;
const DB_X = 0.95;
const LANE_Z = 0.42;  // the request lane, along the front
const PIPE_Z = 0;     // the cache↔DB pipe, set back behind it

// HIT: in to the cache and straight back out. Short path, and it finishes early —
// the tail of the pass is dead time, which is what "fast" looks like next to a miss.
const X_HIT: Keyframes = [
    [0, ENTRY_X], [0.26, CACHE_X], [0.40, CACHE_X], [0.66, ENTRY_X], [1, ENTRY_X],
];
const S_HIT: Keyframes = [[0, 0], [0.06, 1], [0.70, 1], [0.76, 0], [1, 0]];

/** The DB's near face, not its centre — a packet sent to DB_X ends up buried
 *  inside the cylinder and simply disappears for the whole fetch. */
const DB_TOUCH = DB_X - 0.45;

// MISS: falls through to the DB and comes all the way back, using the whole pass.
const X_MISS: Keyframes = [
    [0, ENTRY_X], [0.18, CACHE_X], [0.28, CACHE_X], [0.44, DB_TOUCH], [0.60, DB_TOUCH],
    [0.76, CACHE_X], [0.86, CACHE_X], [0.97, ENTRY_X], [1, ENTRY_X],
];
const Z_MISS: Keyframes = [
    [0, LANE_Z], [0.28, LANE_Z], [0.38, PIPE_Z], [0.66, PIPE_Z], [0.80, LANE_Z], [1, LANE_Z],
];
const S_MISS: Keyframes = [[0, 0], [0.06, 1], [0.96, 1], [1, 0]];

/** How populated the cache looks. A miss empties it, and the return trip refills it. */
const CACHE_FILL_MISS: Keyframes = [
    [0, 1], [0.24, 1], [0.32, 0.3], [0.74, 0.3], [0.88, 1], [1, 1],
];

// §2 resting frame: a request mid-flight on the MISS path BETWEEN cache and DB,
// cache half-populated. u=0.37 is that gap — u=0.5 puts the packet at the DB,
// which is a different (and much less informative) moment.
const FROZEN_T = MISS_PASS * PASS + 0.37 * PASS;

/**
 * `cache-lookup` — cache hit vs miss (roadmap C1).
 *
 * Redis sitting in front of PostgreSQL, and what that actually buys. This is a
 * NEW component, not a change to `Cache`: that node is a hero-diagram noun and
 * keeps its job there. The cache and DB forms here are rebuilt in the glyph
 * language rather than composed from the existing nodes, because those bring
 * their own plinths, float and rotation logic, which would fight this one's pose.
 */
const CacheLookup = forwardRef<GlyphRef, GlyphProps>(({
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
    const packetRef = useRef<THREE.Mesh>(null);
    const cacheTopRef = useRef<THREE.Mesh>(null);
    const dbBandRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);

    const ports = useGlyphPorts(1.5, 0.75);
    useImperativeHandle(ref, () => makePortLookup(ports, 'CacheLookup'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        cache: createRoundedBoxGeometry({ width: 0.62, height: 0.62, depth: 0.52, radius: 0.11, bevel: 0.01, segments: 10 }),
        packet: createRoundedBoxGeometry({ width: 0.19, height: 0.19, depth: 0.19, radius: 0.05, bevel: 0.008, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const t = frozen ? FROZEN_T : elapsed % LOOP;
        const pass = Math.floor(t / PASS) % PASS_COUNT;
        const u = (t % PASS) / PASS;
        const miss = pass === MISS_PASS;

        if (packetRef.current) {
            packetRef.current.position.x = track(u, miss ? X_MISS : X_HIT);
            packetRef.current.position.z = miss ? track(u, Z_MISS) : LANE_Z;
            const s = track(u, miss ? S_MISS : S_HIT);
            packetRef.current.scale.setScalar(s);
            packetRef.current.visible = s > 0.01;
        }

        // Cache top: bright when populated, pulsing on a hit, briefly emptied by a
        // miss and refilled on the way back ("now cached").
        const fill = miss ? track(u, CACHE_FILL_MISS) : 1;
        const hitPulse = miss ? 0 : bump(u, 0.24, 0.44, 0.05);
        const populate = miss ? bump(u, 0.8, 0.94, 0.05) : 0;
        setAccent(cacheTopRef.current, 0.25 + fill * 1.1 + hitPulse * 2.2 + populate * 2.0);

        // DB band pulses tan only on the miss — the slow path being paid for.
        setAccent(dbBandRef.current, 0.15 + (miss ? bump(u, 0.44, 0.64, 0.05) * 2.4 : 0));

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={3.0} depth={1.5} />

            {/* Request lane along the front. */}
            <mesh position={[-0.3, BASE_TOP + 0.03, LANE_Z]} receiveShadow>
                <boxGeometry args={[2.0, 0.05, 0.28]} />
                <WhiteCeramic />
            </mesh>

            {/* The pipe from cache down to the database — the fall-through path. */}
            <mesh position={[(CACHE_X + DB_X) / 2, BASE_TOP + 0.22, PIPE_Z]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.07, 0.07, DB_X - CACHE_X, 14]} />
                <WhiteCeramic />
            </mesh>

            {/* Cache — the hot store, green-topped. */}
            <group position={[CACHE_X, 0, 0]}>
                <mesh geometry={geo.cache} position={[0, BASE_TOP + 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <AccentInsert ref={cacheTopRef} color={ACCENT.green} args={[0.42, 0.03, 0.42]} position={[0, BASE_TOP + 0.53, 0]} rest={1.2} />
            </group>

            {/* Database — tan band for persistence. */}
            <group position={[DB_X, 0, 0]}>
                <mesh position={[0, BASE_TOP + 0.34, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.36, 0.36, 0.68, 28]} />
                    <WhiteCeramic />
                </mesh>
                <mesh ref={dbBandRef} position={[0, BASE_TOP + 0.34, 0]}>
                    <cylinderGeometry args={[0.375, 0.375, 0.12, 28]} />
                    <meshStandardMaterial color="#241d16" emissive={ACCENT.tan} emissiveIntensity={0.15} toneMapped={false} />
                </mesh>
            </group>

            {/* The request in flight. */}
            <mesh ref={packetRef} geometry={geo.packet} position={[ENTRY_X, BASE_TOP + 0.22, LANE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.4} toneMapped={false} />
            </mesh>

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.81]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    CACHE
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

CacheLookup.displayName = 'CacheLookup';

export default CacheLookup;
