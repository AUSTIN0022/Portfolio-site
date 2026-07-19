'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface WireProps {
    /** Start world-space position */
    from: [number, number, number];
    /** End world-space position */
    to: [number, number, number];
    /** Surface normal at `from` (for arc tangent direction) */
    fromNormal?: [number, number, number];
    /** Surface normal at `to` (for arc tangent direction) */
    toNormal?: [number, number, number];
    /** Tube radius (default 0.018) */
    thickness?: number;
    /** Wire colour (default '#888E9A') */
    color?: string;
    /** Number of tube segments (default 32) */
    segments?: number;
    /** Animate a travelling energy pulse along the wire (default false) */
    animated?: boolean;
    /** Pulse speed (default 1.2) */
    pulseSpeed?: number;
    /** Pulse colour (default '#00E5FF') */
    pulseColor?: string;
}

/**
 * Wire — smooth catmull-rom tube connecting two attachment points.
 *
 * The control points bow outward along each surface normal so the
 * wire arcs cleanly away from the faces rather than cutting through corners.
 *
 * @example
 * <Wire
 *   from={[-1.5, 0.1, 0]}
 *   to={[1.5, 0.1, 0]}
 *   fromNormal={[-1,0,0]}
 *   toNormal={[1,0,0]}
 *   animated
 * />
 */
export default function Wire({
    from,
    to,
    fromNormal = [0, 1, 0],
    toNormal = [0, 1, 0],
    thickness = 0.018,
    color = '#888E9A',
    segments = 32,
    animated = false,
    pulseSpeed = 1.2,
    pulseColor = '#00E5FF',
}: WireProps) {
    const pulseRef = useRef<THREE.Mesh>(null);

    // Build catmull-rom curve with outward control handles
    const curve = useMemo(() => {
        const s = new THREE.Vector3(...from);
        const e = new THREE.Vector3(...to);
        const d = s.distanceTo(e);
        const handleLength = Math.min(d * 0.4, 0.8);

        const sn = new THREE.Vector3(...fromNormal).normalize().multiplyScalar(handleLength);
        const en = new THREE.Vector3(...toNormal).normalize().multiplyScalar(handleLength);

        const c1 = s.clone().add(sn);
        const c2 = e.clone().add(en);

        return new THREE.CatmullRomCurve3([s, c1, c2, e]);
    }, [from, to, fromNormal, toNormal]);

    const tubeGeometry = useMemo(
        () => new THREE.TubeGeometry(curve, segments, thickness, 8, false),
        [curve, segments, thickness]
    );

    // Compute a small travelling sphere position along the curve
    useFrame((state) => {
        if (!pulseRef.current || !animated) return;
        const t = (state.clock.getElapsedTime() * pulseSpeed) % 1;
        const pos = curve.getPointAt(t);
        pulseRef.current.position.copy(pos);
    });

    return (
        <group>
            {/* Main wire tube */}
            <mesh geometry={tubeGeometry}>
                <meshStandardMaterial
                    color={color}
                    roughness={0.65}
                    metalness={0.15}
                />
            </mesh>

            {/* Travelling energy pulse sphere */}
            {animated && (
                <mesh ref={pulseRef}>
                    <sphereGeometry args={[thickness * 2.2, 8, 8]} />
                    <meshStandardMaterial
                        color={pulseColor}
                        emissive={pulseColor}
                        emissiveIntensity={2.5}
                        roughness={0.0}
                        metalness={0.0}
                    />
                </mesh>
            )}
        </group>
    );
}
