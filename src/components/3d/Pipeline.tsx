'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic, BlackBase, YellowAccent } from '@/components/materials/materials';
import { track, bump, type Keyframes } from '@/lib/utils/glyphMotion';
import type { ConnectorPort, ConnectorConfig } from '@/types';

export interface PipelineProps {
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

export interface PipelineRef {
    getConnectorPort: (side: 'left' | 'right' | 'top' | 'bottom') => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

// ─── Layout ──────────────────────────────────────────────────────────────────
const LANE_Y = -0.4;
const PACKET_Y = -0.28;
const HOPPER_X = -1.2;
const WORKER_X = [-0.25, 0.42] as const;
const EXIT_X = 1.12;
const TRAY_X = 1.15;
const BIN_X = 0.62;
const BIN_Z = 0.6;
const PACKET_COUNT = 4;
const PACKET_PERIOD = 4.2; // seconds for one packet to traverse the lane

// ─── The loop ────────────────────────────────────────────────────────────────
// Each packet runs its own normalised 0→1 cycle, offset by a quarter so the lane
// always has work on it. The dwells (flat segments) are where a worker holds the
// packet — without them the lane reads as a conveyor, not a queue being consumed.
const X_OK: Keyframes = [
    [0, -1.12], [0.10, -0.25], [0.24, -0.25], [0.38, 0.42], [0.52, 0.42], [0.70, EXIT_X], [1.0, EXIT_X],
];
const SCALE_OK: Keyframes = [
    [0, 0], [0.04, 1], [0.74, 1], [0.82, 0], [1, 0],
];

// The failure variant: after the second worker the packet bounces sideways into
// the dead-letter bin, then is re-injected UPSTREAM of a worker and retried —
// the point being that it is not lost, and the retry is safe to run again.
const X_FAIL: Keyframes = [
    [0, -1.12], [0.10, -0.25], [0.24, -0.25], [0.38, 0.42], [0.52, 0.42],
    [0.60, BIN_X], [0.68, BIN_X], [0.80, -0.25], [0.88, -0.25], [0.97, EXIT_X], [1, EXIT_X],
];
const Z_FAIL: Keyframes = [
    [0, 0], [0.52, 0], [0.60, BIN_Z], [0.70, BIN_Z], [0.80, 0], [1, 0],
];
const Y_FAIL: Keyframes = [
    [0, PACKET_Y], [0.52, PACKET_Y], [0.62, -0.4], [0.70, -0.4], [0.80, PACKET_Y], [1, PACKET_Y],
];
const SCALE_FAIL: Keyframes = [
    [0, 0], [0.04, 1], [0.965, 1], [0.995, 0], [1, 0],
];

// Windows, in packet-cycle space.
const WORKER_WINDOW: readonly (readonly [number, number])[] = [[0.10, 0.24], [0.38, 0.52]];
const SUCCESS_FLASH: readonly [number, number] = [0.68, 0.78];
const BIN_FLASH: readonly [number, number] = [0.59, 0.71];
const RETRY_AMBER: readonly [number, number] = [0.56, 0.82];

/** Roughly one failure per ~9 packet passes — a guardrail you notice, not a broken system. */
const FAILURE_EVERY = 9;

// §2 resting frame: a packet held mid-pulse over each worker, one leaving the lane.
const FROZEN_P = 0.17;

const BLUE = new THREE.Color('#3b82f6');
const AMBER = new THREE.Color('#f59e0b');
const BLUE_BODY = new THREE.Color('#1d4ed8');
const AMBER_BODY = new THREE.Color('#b45309');

/**
 * `pipeline` — the SYSTEMS glyph (roadmap A2).
 *
 * Replaces `Workers` (a 2×2 block of cubes) on the SYSTEMS card. The cubes were a
 * fair stand-in for "distributed" but showed no queue, no async hand-off and no
 * failure path — the three things the copy actually claims. This lane shows all
 * three: yellow intake → workers pulling and pulsing → green completion, with an
 * occasional dead-letter bounce and retry.
 *
 * Note this does not replace the hero `Workers` node; it's a systems-story variant.
 */
const Pipeline = forwardRef<PipelineRef, PipelineProps>(({
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
    // The worker's whole head (lintel + LED) is what pulses, so this refs the group.
    const workerRefs = useRef<(THREE.Group | null)[]>([]);
    const workerLedRefs = useRef<(THREE.Mesh | null)[]>([]);
    const trayStripRef = useRef<THREE.Mesh>(null);
    const binRimRef = useRef<THREE.Mesh>(null);

    const systemReduced = useReducedMotion();
    const reduced = forceReducedMotion ?? systemReduced ?? false;

    // Scratch colours — mutated in place each frame so the loop allocates nothing.
    const scratch = useMemo(() => ({ emissive: new THREE.Color(), body: new THREE.Color() }), []);

    const portsList = useMemo((): ConnectorPort[] => [
        { id: 'left', side: 'left', position: [-1.45, PACKET_Y, 0], normal: [-1, 0, 0], radius: 0.02 },
        { id: 'right', side: 'right', position: [1.45, PACKET_Y, 0], normal: [1, 0, 0], radius: 0.02 },
        { id: 'top', side: 'top', position: [0, PACKET_Y, -0.85], normal: [0, 0, -1], radius: 0.02 },
        { id: 'bottom', side: 'bottom', position: [0, PACKET_Y, 0.85], normal: [0, 0, 1], radius: 0.02 },
    ], []);

    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find((p) => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Pipeline`);
            return port;
        },
        getConnectorPorts: () => portsList,
    }));

    const initialRotation = useMemo((): [number, number, number] => {
        if (rotation) return rotation;
        switch (defaultView) {
            case 'top': return [-Math.PI / 2, 0, 0];
            case 'front': return [0, 0, 0];
            default: return [0, (22 * Math.PI) / 180, 0];
        }
    }, [rotation, defaultView]);

    // `createRoundedBoxGeometry` extrudes along Z and every mesh below is rotated
    // -90° on X, so the args read: width = X, height = Z (depth on screen),
    // depth = Y (height off the plinth).
    //
    // These are the SECOND pass. The first used thin legs under a small cube per
    // worker, and at card size the legs and cube merged into a single thin mast —
    // two of them plus a hopper read as a boat with masts, not a job pipeline. A
    // worker is now a chunky PORTAL (two posts + a heavy lintel) that the packet
    // visibly travels through, which survives being shrunk to 120px.
    const geo = useMemo(() => ({
        base: createRoundedBoxGeometry({ width: 2.9, height: 1.7, depth: 0.24, radius: 0.1, bevel: 0.01, segments: 12 }),
        lane: createRoundedBoxGeometry({ width: 2.4, height: 0.56, depth: 0.16, radius: 0.06, bevel: 0.008, segments: 10 }),
        lintel: createRoundedBoxGeometry({ width: 0.46, height: 0.86, depth: 0.34, radius: 0.09, bevel: 0.01, segments: 10 }),
        hopper: createRoundedBoxGeometry({ width: 0.5, height: 0.56, depth: 0.62, radius: 0.1, bevel: 0.01, segments: 10 }),
        hopperCap: createRoundedBoxGeometry({ width: 0.4, height: 0.46, depth: 0.1, radius: 0.05, bevel: 0.008, segments: 10 }),
        tray: createRoundedBoxGeometry({ width: 0.54, height: 0.54, depth: 0.26, radius: 0.07, bevel: 0.01, segments: 10 }),
        bin: createRoundedBoxGeometry({ width: 0.4, height: 0.4, depth: 0.36, radius: 0.08, bevel: 0.01, segments: 10 }),
        packet: createRoundedBoxGeometry({ width: 0.2, height: 0.2, depth: 0.2, radius: 0.05, bevel: 0.008, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();

        // Accumulate the frame's flash intensities across packets, then write once.
        let successFlash = 0;
        let binFlash = 0;
        let worker0 = 0;
        let worker1 = 0;

        for (let i = 0; i < PACKET_COUNT; i++) {
            const packet = packetRefs.current[i];
            if (!packet) continue;

            const raw = elapsed / PACKET_PERIOD + i * 0.25;
            const p = reduced || !animationToggle ? (FROZEN_P + i * 0.25) % 1 : raw % 1;
            // Frozen frames never show a failure — a dead-letter bounce held still
            // reads as "broken", which is the opposite of the point.
            const failing = reduced || !animationToggle
                ? false
                : (Math.floor(raw) * PACKET_COUNT + i) % FAILURE_EVERY === 0;

            packet.position.x = track(p, failing ? X_FAIL : X_OK);
            packet.position.z = failing ? track(p, Z_FAIL) : 0;
            packet.position.y = failing ? track(p, Y_FAIL) : PACKET_Y;

            const s = track(p, failing ? SCALE_FAIL : SCALE_OK);
            packet.scale.setScalar(s);
            packet.visible = s > 0.01;

            // Amber only while it's in the retry detour; blue the rest of the time.
            const amber = failing ? bump(p, RETRY_AMBER[0], RETRY_AMBER[1], 0.05) : 0;
            const mat = packet.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(scratch.emissive.copy(BLUE).lerp(AMBER, amber));
            mat.color.copy(scratch.body.copy(BLUE_BODY).lerp(AMBER_BODY, amber));

            worker0 = Math.max(worker0, bump(p, WORKER_WINDOW[0][0], WORKER_WINDOW[0][1]));
            worker1 = Math.max(worker1, bump(p, WORKER_WINDOW[1][0], WORKER_WINDOW[1][1]));
            if (!failing) successFlash = Math.max(successFlash, bump(p, SUCCESS_FLASH[0], SUCCESS_FLASH[1], 0.03));
            if (failing) binFlash = Math.max(binFlash, bump(p, BIN_FLASH[0], BIN_FLASH[1], 0.03));
        }

        // Workers squash slightly while holding a packet — the "processing" tell.
        const activity = [worker0, worker1];
        for (let w = 0; w < 2; w++) {
            const cube = workerRefs.current[w];
            if (cube) {
                cube.scale.set(1 + activity[w] * 0.06, 1 - activity[w] * 0.05, 1 + activity[w] * 0.06);
            }
            const led = workerLedRefs.current[w];
            if (led) {
                // Rest value stays low on purpose: these are un-tonemapped, so even 0.3
                // paints a solid blue lid on the most camera-facing face of the worker.
                (led.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12 + activity[w] * 3.0;
            }
        }

        if (trayStripRef.current) {
            (trayStripRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + successFlash * 4;
        }
        if (binRimRef.current) {
            (binRimRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + binFlash * 3;
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
            <mesh geometry={geo.base} position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <BlackBase />
            </mesh>

            {/* Lane. The recessed dark channel is what makes this read as a queue LANE
                rather than a bench — it draws the left-to-right through-line the eye
                needs to follow, and gives the blue packets something to sit in. */}
            <mesh geometry={geo.lane} position={[0, LANE_Y - 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
                <WhiteCeramic />
            </mesh>
            <mesh position={[0, LANE_Y - 0.005, 0]} receiveShadow>
                <boxGeometry args={[2.3, 0.02, 0.3]} />
                <meshStandardMaterial color="#1e2024" roughness={0.6} metalness={0} />
            </mesh>

            {/* Intake hopper — yellow marks the queue, per the palette's "pending work".
                The accent is an inset cap, not an overhanging plate: at card size a
                full-footprint yellow top became the loudest thing in the frame and the
                glyph read as "a yellow table". */}
            <group position={[HOPPER_X, -0.22, 0]}>
                <mesh geometry={geo.hopper} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <mesh geometry={geo.hopperCap} position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
                    <YellowAccent />
                </mesh>
            </group>

            {/* Workers: a portal straddling the lane, so a packet is seen entering,
                being held, and leaving on the far side. */}
            {WORKER_X.map((x, w) => (
                <group key={`worker-${w}`} position={[x, 0, 0]}>
                    {[-0.33, 0.33].map((z) => (
                        <mesh key={`post-${z}`} position={[0, -0.22, z]} castShadow>
                            <boxGeometry args={[0.13, 0.36, 0.15]} />
                            <WhiteCeramic />
                        </mesh>
                    ))}
                    <group ref={(el) => { workerRefs.current[w] = el; }}>
                        <mesh geometry={geo.lintel} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                            <WhiteCeramic />
                        </mesh>
                        {/* A dark recessed strip that IGNITES, not a painted blue panel.
                            Started as a saturated blue plate and every worker read as
                            having a blue roof — permanent colour where the palette wants
                            an event, so the pulse had nothing left to say. */}
                        <mesh ref={(el) => { workerLedRefs.current[w] = el; }} position={[0, 0.32, 0]}>
                            <boxGeometry args={[0.14, 0.025, 0.26]} />
                            <meshStandardMaterial color="#15181d" emissive="#3b82f6" emissiveIntensity={0.1} toneMapped={false} />
                        </mesh>
                    </group>
                </group>
            ))}

            {/* Output tray — green strip flashes on a completed job. */}
            <group position={[TRAY_X, LANE_Y - 0.02, 0]}>
                <mesh geometry={geo.tray} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                {/* A small inset, not a full-face plate. A near-full-width strip on a thin
                    body meant the object simply *was* the accent — the tray read as "a
                    green table" and the completion flash had nowhere to go. */}
                <mesh ref={trayStripRef} position={[0, 0.14, 0]}>
                    <boxGeometry args={[0.24, 0.02, 0.24]} />
                    <meshStandardMaterial color="#1b201d" emissive="#3ecf8e" emissiveIntensity={0.12} toneMapped={false} />
                </mesh>
            </group>

            {/* Dead-letter bin */}
            <group position={[BIN_X, -0.32, BIN_Z]}>
                <mesh geometry={geo.bin} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <mesh ref={binRimRef} position={[0, 0.19, 0]}>
                    <boxGeometry args={[0.18, 0.025, 0.18]} />
                    <meshStandardMaterial color="#241d16" emissive="#f59e0b" emissiveIntensity={0.1} toneMapped={false} />
                </mesh>
            </group>

            {/* Job packets */}
            {Array.from({ length: PACKET_COUNT }, (_, i) => (
                <mesh
                    key={`packet-${i}`}
                    ref={(el) => { packetRefs.current[i] = el; }}
                    geometry={geo.packet}
                    position={[-1.12, PACKET_Y, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="#1d4ed8" emissive="#3b82f6" emissiveIntensity={2.6} toneMapped={false} />
                </mesh>
            ))}

            {showLabel && (
                <Text position={[0, -0.62, 0.86]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    PIPELINE
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

Pipeline.displayName = 'Pipeline';

export default Pipeline;
