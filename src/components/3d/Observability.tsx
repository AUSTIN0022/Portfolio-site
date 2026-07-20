'use client';

import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
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
// 6s: calm baseline → a spike rises → an LED flips amber → a blue trace streaks
// across the panel → the spike subsides and the LED returns to green.
const LOOP = 6.0;
const SPIKE_WINDOW: readonly [number, number] = [0.30, 0.62];
const TRACE_WINDOW: readonly [number, number] = [0.46, 0.70];

// §2 resting frame: graph mid-scroll with a spike, one LED amber, and the trace
// frozen mid-panel.
const FROZEN_P = 0.55;

// Ten bars, not fourteen. On a card the console is only ~40px across, and at
// fourteen each bar came out under 3px wide — present in the scene, invisible to
// the reader. The series has to be chunky enough to have a silhouette.
const BAR_COUNT = 10;
const LED_COUNT = 3;
const PANEL_W = 1.3;
const PANEL_H = 0.66;
const BAR_W = PANEL_W / BAR_COUNT * 0.72;
const BAR_MAX = 0.48;

const GREEN = new THREE.Color(ACCENT.green);
const AMBER = new THREE.Color(ACCENT.amber);

/**
 * A cheap deterministic waveform. Two out-of-phase sines beat against each other
 * so the baseline never visibly repeats over the loop, without a noise texture or
 * any per-frame allocation.
 */
function baseline(x: number): number {
    return 0.3 + Math.sin(x * 3.1) * 0.1 + Math.sin(x * 7.7 + 1.3) * 0.06;
}

/**
 * `observability` — logs / metrics / traces (roadmap B3).
 *
 * The *Observability by default* principle, and the INFRA card's "monitoring".
 * This is a NEW component rather than a change to `Monitoring`: that node is a
 * hero-diagram noun and still has a job there. This keeps its silhouette —
 * ceramic body, black base, green base-strip — but turns the face into a live
 * console: a scrolling series, status LEDs, and a request being traced across it.
 *
 * The series is BARS, not a polyline. A 1px line reads as noise once the card is
 * scaled to 120px, whereas bars hold their shape all the way down — and the spec
 * explicitly allows either.
 */
const Observability = forwardRef<GlyphRef, GlyphProps>(({
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
    const barRefs = useRef<(THREE.Mesh | null)[]>([]);
    const ledRefs = useRef<(THREE.Mesh | null)[]>([]);
    const traceRef = useRef<THREE.Mesh>(null);
    const baseStripRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => new THREE.Color(), []);

    const ports = useGlyphPorts(1.0, 0.75);
    useImperativeHandle(ref, () => makePortLookup(ports, 'Observability'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 18),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        body: createRoundedBoxGeometry({ width: 1.5, height: 0.9, depth: 0.66, radius: 0.12, bevel: 0.012, segments: 12 }),
        bar: createRoundedBoxGeometry({ width: BAR_W, height: BAR_W, depth: 1, radius: 0.012, bevel: 0.004, segments: 6 }),
    }), []);

    const barX = useMemo(
        () => Array.from({ length: BAR_COUNT }, (_, j) => -PANEL_W / 2 + (j + 0.5) * (PANEL_W / BAR_COUNT)),
        [],
    );

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const p = frozen ? FROZEN_P : (elapsed % LOOP) / LOOP;
        // Frozen frames still need a scrolled-looking series, so sample the same
        // clock position the phase implies rather than time zero.
        const scroll = (frozen ? FROZEN_P * LOOP : elapsed) * 1.5;

        const spike = bump(p, SPIKE_WINDOW[0], SPIKE_WINDOW[1], 0.1);

        for (let j = 0; j < BAR_COUNT; j++) {
            const bar = barRefs.current[j];
            if (!bar) continue;
            // Bars sample a window that slides right-to-left over the waveform.
            const x = scroll - j * 0.3;
            // The spike is a travelling gaussian, so it visibly enters and leaves
            // the window instead of the whole series just inflating at once.
            const centre = (1 - spike) * BAR_COUNT;
            const d = (j - centre) / 2.6;
            const value = baseline(x) + spike * Math.exp(-d * d) * 0.62;
            const h = Math.max(0.02, Math.min(1, value)) * BAR_MAX;
            // Grow from the baseline along the bar's OWN extrude axis. The bar group is
            // rotated -90° on X, so the geometry's local +Z is what points up the panel
            // — offsetting on .y instead pushed each bar out through the panel face and
            // left it centred on the baseline, i.e. half-height and half-buried.
            bar.scale.z = h;
            bar.position.z = h / 2;
            // The leading bar carries the blue "now" dot.
            (bar.material as THREE.MeshStandardMaterial).emissiveIntensity = j === BAR_COUNT - 1 ? 1.8 : 0.05;
        }

        // Status LEDs: the middle one flips amber while the anomaly is live.
        for (let k = 0; k < LED_COUNT; k++) {
            const led = ledRefs.current[k];
            if (!led) continue;
            const alerting = k === 1 ? spike : 0;
            const mat = led.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(scratch.copy(GREEN).lerp(AMBER, alerting));
            mat.emissiveIntensity = 0.9 + alerting * 2.2;
        }

        // A single request being traced across the panel.
        const trace = bump(p, TRACE_WINDOW[0], TRACE_WINDOW[1], 0.02);
        if (traceRef.current) {
            const u = (p - TRACE_WINDOW[0]) / (TRACE_WINDOW[1] - TRACE_WINDOW[0]);
            traceRef.current.visible = trace > 0.02;
            traceRef.current.position.x = -PANEL_W / 2 + Math.min(Math.max(u, 0), 1) * PANEL_W;
            setAccent(traceRef.current, trace * 3.4);
        }

        setAccent(baseStripRef.current, 0.9);
        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={2.0} depth={1.5} />

            {/* Body, keeping the Monitoring silhouette. */}
            <mesh geometry={geo.body} position={[0, BASE_TOP + 0.43, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            {/* Green base-strip, carried over from the node this upgrades. */}
            <AccentInsert ref={baseStripRef} color={ACCENT.green} args={[1.1, 0.03, 0.04]} position={[0, BASE_TOP + 0.06, 0.34]} rest={0.9} />

            {/* The console sits near-VERTICAL on the front face, with only a slight
                backward lean. The instinct was a lectern angle (~-0.7 rad, lying back
                on top of the body), but `ProjectObject` already tilts the whole object
                forward ~0.42 rad to reveal top faces — so a laid-back panel ends up
                pointing up and away from the camera and the bars, whose HEIGHT is the
                entire signal, foreshorten into a flat sliver. Near-vertical plus that
                forward tilt lands the panel almost square to the viewer. */}
            <group position={[0, BASE_TOP + 0.5, 0.35]} rotation={[-0.2, 0, 0]}>
                <mesh position={[0, 0, -0.02]} receiveShadow>
                    <boxGeometry args={[PANEL_W + 0.12, PANEL_H + 0.12, 0.04]} />
                    <WhiteCeramic />
                </mesh>
                <mesh position={[0, 0, 0.005]} receiveShadow>
                    <boxGeometry args={[PANEL_W, PANEL_H, 0.02]} />
                    <meshStandardMaterial color="#15181d" roughness={0.5} metalness={0} />
                </mesh>

                {/* Series. The group is rotated so each bar's local +Z grows "up" the
                    panel, which lets one shared unit-depth geometry serve every bar. */}
                <group position={[0, -PANEL_H / 2 + 0.05, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
                    {barX.map((x, j) => (
                        <mesh key={`bar-${j}`} ref={(el) => { barRefs.current[j] = el; }} geometry={geo.bar} position={[x, 0, 0]}>
                            {/* Light ceramic-grey, per §2. The first pass used a mid-grey
                                (#8d949e) and the series vanished into the near-black
                                panel — only the blue leading bar was visible, so the
                                console read as an empty screen with one dot. */}
                            {/* Light ceramic-grey, per §2. A mid-grey (#8d949e) vanished
                                into the near-black panel — only the blue leading bar
                                survived, so the console read as an empty screen. */}
                            <meshStandardMaterial color="#dfe3e9" emissive={ACCENT.blue} emissiveIntensity={0.05} toneMapped={false} />
                        </mesh>
                    ))}
                </group>

                {/* Trace packet streaking across the console. */}
                <mesh ref={traceRef} position={[0, 0.06, 0.04]}>
                    <boxGeometry args={[0.14, 0.03, 0.02]} />
                    <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={0} toneMapped={false} />
                </mesh>

                {/* Status LEDs along the bottom bezel. */}
                {Array.from({ length: LED_COUNT }, (_, k) => (
                    <mesh key={`led-${k}`} ref={(el) => { ledRefs.current[k] = el; }} position={[-0.44 + k * 0.14, -PANEL_H / 2 - 0.03, 0.03]}>
                        <boxGeometry args={[0.07, 0.03, 0.02]} />
                        <meshStandardMaterial color="#15181d" emissive={ACCENT.green} emissiveIntensity={0.9} toneMapped={false} />
                    </mesh>
                ))}
            </group>

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.81]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    OBSERVABILITY
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

Observability.displayName = 'Observability';

export default Observability;
