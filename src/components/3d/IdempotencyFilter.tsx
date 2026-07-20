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
// Packets arrive stamped with an id and meet the membrane at p≈0.46.
//   NEW  → passes through with a green flash, and the ledger above ticks up.
//   DUPE → presses against the membrane, dims to grey, and dissolves. It never
//          reaches the out-tray, so nothing downstream is emitted twice.
// One in three arrivals is a duplicate: frequent enough that "dupes are absorbed"
// is unmistakable, rare enough that the happy path still reads as the norm.
const PACKET_PERIOD = 4.0;
const PACKET_COUNT = 4;
const DUPLICATE_EVERY = 3;

const MEMBRANE_X = 0;
const IN_X = -1.12;
const OUT_X = 1.12;

const X_NEW: Keyframes = [
    [0, IN_X], [0.46, MEMBRANE_X], [0.56, MEMBRANE_X], [0.88, OUT_X], [1, OUT_X],
];
const SCALE_NEW: Keyframes = [
    [0, 0], [0.05, 1], [0.9, 1], [0.97, 0], [1, 0],
];

// The duplicate presses INTO the membrane (slightly past its face) and stops —
// being physically stopped is what sells rejection; a fade alone reads as a bug.
const X_DUPE: Keyframes = [
    [0, IN_X], [0.46, -0.09], [0.54, -0.05], [1, -0.05],
];
const SCALE_DUPE: Keyframes = [
    [0, 0], [0.05, 1], [0.5, 1], [0.56, 1.12], [0.74, 0], [1, 0],
];

const PASS_FLASH: readonly [number, number] = [0.44, 0.58];
const LEDGER_TABS = 4;

// §2 resting frame: one packet mid-pass (green) and one duplicate pinned and
// dissolving at the membrane.
const FROZEN_P = 0.5;

const BLUE_BODY = new THREE.Color('#1d4ed8');
const BLUE_EMIT = new THREE.Color(ACCENT.blue);
const GREY_BODY = new THREE.Color('#6b7280');
const GREY_EMIT = new THREE.Color('#4b5563');

/**
 * `idempotency-filter` — dedupe / "safe to run twice" (roadmap B2).
 *
 * The *Idempotency is non-negotiable* principle, and SmartFormFlow's global
 * contact deduplication. A gate that remembers what it has already seen: first
 * sighting passes and is recorded on the tan ledger, a repeat dies quietly at the
 * membrane. Rejected duplicates get NO accent colour — they fade to grey, because
 * a duplicate being dropped is the system working, not an error worth flagging.
 */
const IdempotencyFilter = forwardRef<GlyphRef, GlyphProps>(({
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
    const membraneRef = useRef<THREE.Mesh>(null);
    const ledgerRefs = useRef<(THREE.Mesh | null)[]>([]);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => ({ body: new THREE.Color(), emit: new THREE.Color() }), []);

    const ports = useGlyphPorts(1.45, 0.7);
    useImperativeHandle(ref, () => makePortLookup(ports, 'IdempotencyFilter'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        tray: createRoundedBoxGeometry({ width: 0.46, height: 0.6, depth: 0.3, radius: 0.08, bevel: 0.01, segments: 10 }),
        ledger: createRoundedBoxGeometry({ width: 0.5, height: 0.44, depth: 0.24, radius: 0.07, bevel: 0.01, segments: 10 }),
        packet: createRoundedBoxGeometry({ width: 0.2, height: 0.2, depth: 0.2, radius: 0.05, bevel: 0.008, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        let passFlash = 0;
        let ledgerTick = 0;

        for (let i = 0; i < PACKET_COUNT; i++) {
            const packet = packetRefs.current[i];
            if (!packet) continue;

            const raw = elapsed / PACKET_PERIOD + i * 0.25;
            const p = frozen ? (FROZEN_P + i * 0.25) % 1 : raw % 1;
            const cycle = frozen ? i : Math.floor(raw) * PACKET_COUNT + i;
            const duplicate = cycle % DUPLICATE_EVERY === 2;

            packet.position.x = track(p, duplicate ? X_DUPE : X_NEW);
            const s = track(p, duplicate ? SCALE_DUPE : SCALE_NEW);
            packet.scale.setScalar(s);
            packet.visible = s > 0.01;

            // A duplicate loses its colour as it is absorbed.
            const dying = duplicate ? bump(p, 0.46, 1.0, 0.06) : 0;
            const mat = packet.material as THREE.MeshStandardMaterial;
            mat.color.copy(scratch.body.copy(BLUE_BODY).lerp(GREY_BODY, dying));
            mat.emissive.copy(scratch.emit.copy(BLUE_EMIT).lerp(GREY_EMIT, dying));
            mat.emissiveIntensity = 2.4 * (1 - dying * 0.9);

            if (!duplicate) {
                passFlash = Math.max(passFlash, bump(p, PASS_FLASH[0], PASS_FLASH[1], 0.04));
                ledgerTick = Math.max(ledgerTick, cycle);
            }
        }

        // Membrane flashes green only when it lets something through.
        setAccent(membraneRef.current, 0.1 + passFlash * 3.2);

        // Ledger tabs fill in sequence as new ids are recorded — the persistence
        // that makes the rejection possible in the first place.
        const filled = frozen ? 2 : ledgerTick % (LEDGER_TABS + 1);
        for (let k = 0; k < LEDGER_TABS; k++) {
            setAccent(ledgerRefs.current[k], k < filled ? 1.0 : 0.1);
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.9} depth={1.4} />

            {/* In-tray / out-tray */}
            <mesh geometry={geo.tray} position={[-1.15, BASE_TOP + 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            <mesh geometry={geo.tray} position={[1.15, BASE_TOP + 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>

            {/* The gate: two ceramic uprights with the membrane spanning between.
                These are plain boxes on purpose. Built from the rounded-box helper
                they came out lying flat ALONG the lane instead of standing across it —
                the helper extrudes on Z, so the "height" arg is depth-on-screen, and a
                Y-rotation swings the extrusion into the lane axis. */}
            {[-0.46, 0.46].map((z) => (
                <mesh key={`post-${z}`} position={[0, BASE_TOP + 0.36, z]} castShadow>
                    <boxGeometry args={[0.13, 0.72, 0.15]} />
                    <WhiteCeramic />
                </mesh>
            ))}
            {/* Lintel, which also carries the ledger above it. */}
            <mesh position={[0, BASE_TOP + 0.76, 0]} castShadow>
                <boxGeometry args={[0.13, 0.1, 1.07]} />
                <WhiteCeramic />
            </mesh>
            {/* The membrane is a SOLID wall with exactly one opening, built from four
                panels around the slot. It began as a translucent sheet the packets
                passed through, which is closer to the idea but reads as empty air at
                card size — you cannot see a barrier that isn't there, so a duplicate
                stopping against it looked like a packet halting for no reason. A wall
                with a hole states the rule before anything even moves. */}
            {[
                { pos: [0, BASE_TOP + 0.11, 0], size: [0.06, 0.22, 0.92] },
                { pos: [0, BASE_TOP + 0.59, 0], size: [0.06, 0.26, 0.92] },
                { pos: [0, BASE_TOP + 0.34, -0.305], size: [0.06, 0.24, 0.31] },
                { pos: [0, BASE_TOP + 0.34, 0.305], size: [0.06, 0.24, 0.31] },
            ].map((panel, k) => (
                <mesh key={`wall-${k}`} position={panel.pos as [number, number, number]} castShadow receiveShadow>
                    <boxGeometry args={panel.size as [number, number, number]} />
                    <WhiteCeramic />
                </mesh>
            ))}
            {/* The slot sill: the only way through, and what flashes on an accept. */}
            <AccentInsert ref={membraneRef} color={ACCENT.green} args={[0.07, 0.025, 0.3]} position={[0, BASE_TOP + 0.215, 0]} rest={0.1} />

            {/* Ledger — the tan tally of ids already seen. Perched ON the lintel rather
                than floating above the gate, which read as an unrelated object. */}
            <group position={[0, BASE_TOP + 0.93, 0]}>
                <mesh geometry={geo.ledger} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                {Array.from({ length: LEDGER_TABS }, (_, k) => (
                    <AccentInsert
                        key={`tab-${k}`}
                        ref={(el) => { ledgerRefs.current[k] = el; }}
                        color={ACCENT.tan}
                        args={[0.3, 0.02, 0.06]}
                        position={[0, 0.13, -0.15 + k * 0.1]}
                        rest={0.12}
                    />
                ))}
            </group>

            {/* Packets, each carrying its id stamp. */}
            {Array.from({ length: PACKET_COUNT }, (_, i) => (
                <mesh
                    key={`packet-${i}`}
                    ref={(el) => { packetRefs.current[i] = el; }}
                    geometry={geo.packet}
                    position={[IN_X, BASE_TOP + 0.34, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.4} toneMapped={false} />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.76]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    IDEMPOTENT
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

IdempotencyFilter.displayName = 'IdempotencyFilter';

export default IdempotencyFilter;
