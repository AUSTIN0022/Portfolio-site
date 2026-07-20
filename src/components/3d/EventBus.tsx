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
// An event published at one end travels the bus; each subscriber it passes lights
// and emits its own reaction packet. A second event follows half a period behind,
// because one event alone reads as a pipeline — it's the OVERLAP that says pub/sub.
const EVENT_PERIOD = 3.6;
const EVENT_COUNT = 2;
const SUB_COUNT = 4;

const BUS_X0 = -1.05;
const BUS_X1 = 1.05;
const SUB_X = [-0.75, -0.25, 0.25, 0.75] as const;
const SUB_Z = 0.52;
const BUS_Y = BASE_TOP + 0.34;

const EVENT_X: Keyframes = [[0, BUS_X0], [0.82, BUS_X1], [1, BUS_X1]];
const EVENT_S: Keyframes = [[0, 0], [0.04, 1], [0.8, 1], [0.86, 0], [1, 0]];

/** Where along the event's run each subscriber sits, for the pass-by test. */
const SUB_U = SUB_X.map((x) => ((x - BUS_X0) / (BUS_X1 - BUS_X0)) * 0.82);

// §2 resting frame: an event mid-bus with two subscribers lit.
const FROZEN_U = [0.46, 0.04] as const;

/**
 * `event-bus` — pub/sub fan-out (roadmap C7).
 *
 * Event-driven architecture: one publish, many independent reactions.
 */
const EventBus = forwardRef<GlyphRef, GlyphProps>(({
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
    const eventRefs = useRef<(THREE.Mesh | null)[]>([]);
    const subLedRefs = useRef<(THREE.Mesh | null)[]>([]);
    const reactionRefs = useRef<(THREE.Mesh | null)[]>([]);

    const reduced = useGlyphReducedMotion(forceReducedMotion);

    const ports = useGlyphPorts(1.4, 0.8);
    useImperativeHandle(ref, () => makePortLookup(ports, 'EventBus'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        sub: createRoundedBoxGeometry({ width: 0.4, height: 0.4, depth: 0.4, radius: 0.09, bevel: 0.01, segments: 10 }),
        packet: createRoundedBoxGeometry({ width: 0.17, height: 0.17, depth: 0.17, radius: 0.045, bevel: 0.008, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;

        // Accumulate each subscriber's excitement across BOTH events before writing,
        // so an overlap brightens rather than the later event overwriting the earlier.
        const hit = [0, 0, 0, 0];

        for (let e = 0; e < EVENT_COUNT; e++) {
            const event = eventRefs.current[e];
            if (!event) continue;
            const u = frozen ? FROZEN_U[e] : (elapsed / EVENT_PERIOD + e / EVENT_COUNT) % 1;

            event.position.x = track(u, EVENT_X);
            const s = track(u, EVENT_S);
            event.scale.setScalar(s);
            event.visible = s > 0.01;

            for (let k = 0; k < SUB_COUNT; k++) {
                hit[k] = Math.max(hit[k], bump(u, SUB_U[k] - 0.03, SUB_U[k] + 0.05, 0.03));
            }
        }

        for (let k = 0; k < SUB_COUNT; k++) {
            setAccent(subLedRefs.current[k], 0.1 + hit[k] * 3.0);

            // Each subscriber's own reaction packet, pushed away from the bus. This is
            // the fan-out: the event does not branch, the subscribers independently
            // produce work of their own.
            const reaction = reactionRefs.current[k];
            if (!reaction) continue;
            reaction.visible = hit[k] > 0.05;
            // Local to the subscriber group, which already sits at SUB_Z — adding
            // SUB_Z again here would fling the reaction off the plinth.
            reaction.position.z = 0.28 + (1 - hit[k]) * 0.42;
            reaction.scale.setScalar(hit[k] * 0.9);
        }

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.8} depth={1.7} />

            {/* The spine bus. */}
            <mesh position={[0, BUS_Y, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.3, 0.16, 0.28]} />
                <WhiteCeramic />
            </mesh>

            {/* Subscribers tapped along it. */}
            {SUB_X.map((x, k) => (
                <group key={`sub-${k}`} position={[x, 0, SUB_Z]}>
                    {/* the tap connecting this subscriber back to the bus */}
                    <mesh position={[0, BUS_Y, -0.3]} castShadow>
                        <boxGeometry args={[0.09, 0.08, 0.34]} />
                        <WhiteCeramic />
                    </mesh>
                    <mesh geometry={geo.sub} position={[0, BASE_TOP + 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    <AccentInsert
                        ref={(el) => { subLedRefs.current[k] = el; }}
                        color={ACCENT.green}
                        args={[0.22, 0.025, 0.22]}
                        position={[0, BASE_TOP + 0.41, 0]}
                        rest={0.1}
                    />
                    <mesh
                        ref={(el) => { reactionRefs.current[k] = el; }}
                        geometry={geo.packet}
                        position={[0, BASE_TOP + 0.2, 0.28]}
                        rotation={[-Math.PI / 2, 0, 0]}
                    >
                        <meshStandardMaterial color="#16221c" emissive={ACCENT.green} emissiveIntensity={2.2} toneMapped={false} />
                    </mesh>
                </group>
            ))}

            {/* The events riding the bus. */}
            {Array.from({ length: EVENT_COUNT }, (_, e) => (
                <mesh
                    key={`event-${e}`}
                    ref={(el) => { eventRefs.current[e] = el; }}
                    geometry={geo.packet}
                    position={[BUS_X0, BUS_Y + 0.16, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.6} toneMapped={false} />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.86]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    EVENT BUS
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

EventBus.displayName = 'EventBus';

export default EventBus;
