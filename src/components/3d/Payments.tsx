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
// 6s per payment. AUTH and CAPTURE are two separate latches on purpose: a hold
// then a confirm is what makes this a payment flow rather than a generic pipeline,
// and the certificate is issued only after CAPTURE — the async job completing.
const LOOP = 6.0;
const DECLINE_EVERY = 3;

const ENTRY_X = -1.5;
const GATEWAY_X = -0.8;
const AUTH_X = 0.02;
const CAPTURE_X = 0.66;
const TRAY_X = 1.32;

const X_OK: Keyframes = [
    [0, ENTRY_X], [0.14, GATEWAY_X], [0.26, GATEWAY_X],
    [0.4, AUTH_X], [0.54, AUTH_X], [0.66, CAPTURE_X], [0.8, CAPTURE_X], [0.92, TRAY_X], [1, TRAY_X],
];
const S_OK: Keyframes = [[0, 0], [0.05, 1], [0.86, 1], [0.93, 0], [1, 0]];

// A decline stops at AUTH and leaves the way it came — and crucially no
// certificate is emitted, which is the only thing that really distinguishes it.
const X_DECLINE: Keyframes = [
    [0, ENTRY_X], [0.14, GATEWAY_X], [0.26, GATEWAY_X], [0.4, AUTH_X], [0.58, AUTH_X], [0.86, ENTRY_X], [1, ENTRY_X],
];
const S_DECLINE: Keyframes = [[0, 0], [0.05, 1], [0.9, 1], [0.96, 0], [1, 0]];

const AUTH_WINDOW: readonly [number, number] = [0.4, 0.56];
const CAPTURE_WINDOW: readonly [number, number] = [0.66, 0.82];
const DECLINE_WINDOW: readonly [number, number] = [0.42, 0.6];

/** The certificate tile sliding out of the tray after a successful capture. */
const CERT_SLIDE: Keyframes = [
    [0, 0], [0.78, 0], [0.9, 1], [1, 1],
];

// §2 resting frame: CAPTURE just turned green with a certificate tile
// half-emitted. Never a decline — a frozen red frame reads as a broken checkout.
const FROZEN_U = 0.86;

/**
 * `payments` — SmartFormFlow Razorpay async flow (roadmap C5).
 *
 * Payment → the two-step auth/capture latch → the post-payment job issuing a
 * certificate.
 */
const Payments = forwardRef<GlyphRef, GlyphProps>(({
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
    const paymentRef = useRef<THREE.Mesh>(null);
    const authLedRef = useRef<THREE.Mesh>(null);
    const captureLedRef = useRef<THREE.Mesh>(null);
    const certRef = useRef<THREE.Group>(null);
    const sealRef = useRef<THREE.Mesh>(null);

    const reduced = useGlyphReducedMotion(forceReducedMotion);
    const scratch = useMemo(() => new THREE.Color(), []);
    const AMBER = useMemo(() => new THREE.Color(ACCENT.amber), []);
    const RED = useMemo(() => new THREE.Color(ACCENT.red), []);

    const ports = useGlyphPorts(1.55, 0.7);
    useImperativeHandle(ref, () => makePortLookup(ports, 'Payments'));
    const initialRotation = useMemo(
        () => resolveInitialRotation(rotation, defaultView, 20),
        [rotation, defaultView],
    );

    const geo = useMemo(() => ({
        gateway: createRoundedBoxGeometry({ width: 0.56, height: 0.56, depth: 0.66, radius: 0.11, bevel: 0.01, segments: 10 }),
        latch: createRoundedBoxGeometry({ width: 0.44, height: 0.44, depth: 0.44, radius: 0.09, bevel: 0.01, segments: 10 }),
        tray: createRoundedBoxGeometry({ width: 0.5, height: 0.56, depth: 0.2, radius: 0.07, bevel: 0.01, segments: 10 }),
        payment: createRoundedBoxGeometry({ width: 0.18, height: 0.18, depth: 0.18, radius: 0.045, bevel: 0.008, segments: 8 }),
        cert: createRoundedBoxGeometry({ width: 0.34, height: 0.42, depth: 0.05, radius: 0.03, bevel: 0.006, segments: 8 }),
    }), []);

    useFrame((state) => {
        const elapsed = state.clock.getElapsedTime();
        const frozen = reduced || !animationToggle;
        const u = frozen ? FROZEN_U : (elapsed % LOOP) / LOOP;
        const declined = frozen ? false : Math.floor(elapsed / LOOP) % DECLINE_EVERY === 0;

        if (paymentRef.current) {
            paymentRef.current.position.x = track(u, declined ? X_DECLINE : X_OK);
            const s = track(u, declined ? S_DECLINE : S_OK);
            paymentRef.current.scale.setScalar(s);
            paymentRef.current.visible = s > 0.01;
        }

        // AUTH holds amber on a normal run, and flips red on a decline.
        const authing = bump(u, AUTH_WINDOW[0], AUTH_WINDOW[1], 0.04);
        const declining = declined ? bump(u, DECLINE_WINDOW[0], DECLINE_WINDOW[1], 0.04) : 0;
        if (authLedRef.current) {
            const mat = authLedRef.current.material as THREE.MeshStandardMaterial;
            mat.emissive.copy(scratch.copy(AMBER).lerp(RED, declining));
            mat.emissiveIntensity = 0.12 + Math.max(authing * 2.6, declining * 3.4);
        }

        // CAPTURE only ever fires on a clean run.
        setAccent(captureLedRef.current, 0.12 + (declined ? 0 : bump(u, CAPTURE_WINDOW[0], CAPTURE_WINDOW[1], 0.04) * 3.0));

        // Certificate: issued by the tray only after a capture.
        if (certRef.current) {
            const slide = declined ? 0 : track(u, CERT_SLIDE);
            certRef.current.visible = slide > 0.02;
            certRef.current.position.z = 0.16 + slide * 0.34;
            certRef.current.scale.setScalar(0.4 + slide * 0.6);
        }
        setAccent(sealRef.current, declined ? 0 : 2.2);

        applyFloat(groupRef.current, position[1], elapsed, floating && animationToggle && !reduced);
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation} scale={scale}>
            <Plinth width={3.1} depth={1.4} />

            <mesh position={[0.1, BASE_TOP + 0.03, 0]} receiveShadow>
                <boxGeometry args={[2.6, 0.05, 0.3]} />
                <WhiteCeramic />
            </mesh>

            {/* Gateway, with a card slot cut into its face. */}
            <group position={[GATEWAY_X, 0, 0]}>
                <mesh geometry={geo.gateway} position={[0, BASE_TOP + 0.33, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <mesh position={[0, BASE_TOP + 0.44, 0.29]}>
                    <boxGeometry args={[0.34, 0.05, 0.02]} />
                    <meshStandardMaterial color="#1e2024" roughness={0.6} />
                </mesh>
            </group>

            {/* The two-step latch: AUTH (hold) then CAPTURE (confirm). */}
            <group position={[AUTH_X, 0, 0]}>
                <mesh geometry={geo.latch} position={[0, BASE_TOP + 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <mesh ref={authLedRef} position={[0, BASE_TOP + 0.2, 0.23]}>
                    <boxGeometry args={[0.26, 0.14, 0.02]} />
                    <meshStandardMaterial color="#15181d" emissive={ACCENT.amber} emissiveIntensity={0.12} toneMapped={false} />
                </mesh>
            </group>
            <group position={[CAPTURE_X, 0, 0]}>
                <mesh geometry={geo.latch} position={[0, BASE_TOP + 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>
                <AccentInsert ref={captureLedRef} color={ACCENT.green} args={[0.26, 0.14, 0.02]} position={[0, BASE_TOP + 0.2, 0.23]} rest={0.12} />
            </group>

            {/* Output tray and the certificate it emits. */}
            <mesh geometry={geo.tray} position={[TRAY_X, BASE_TOP + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            <group ref={certRef} position={[TRAY_X, BASE_TOP + 0.26, 0.16]}>
                <mesh geometry={geo.cert} rotation={[-Math.PI / 2 + 0.35, 0, 0]} castShadow>
                    <WhiteCeramic />
                </mesh>
                <mesh ref={sealRef} position={[0, 0.06, 0.04]} rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
                    <cylinderGeometry args={[0.07, 0.07, 0.02, 14]} />
                    <meshStandardMaterial color="#16221c" emissive={ACCENT.green} emissiveIntensity={2.2} toneMapped={false} />
                </mesh>
            </group>

            {/* The payment in flight. */}
            <mesh ref={paymentRef} geometry={geo.payment} position={[ENTRY_X, BASE_TOP + 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#1d4ed8" emissive={ACCENT.blue} emissiveIntensity={2.4} toneMapped={false} />
            </mesh>

            {showLabel && (
                <Text position={[0, BASE_TOP - 0.12, 0.76]} fontSize={0.12} color="#f4f1ec" fontWeight={700} anchorX="center" anchorY="middle">
                    PAYMENTS
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

Payments.displayName = 'Payments';

export default Payments;
