'use client';

import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

interface ConnectorPortProps {
    /** World-space position of this port */
    position: [number, number, number];
    /** Surface normal direction (used for visual orientation) */
    normal?: [number, number, number];
    /** Port disc radius (default 0.06) */
    radius?: number;
    /** Active ports glow and pulse (default false) */
    active?: boolean;
    /** Accent color when active (default '#00E5FF') */
    color?: string;
    /** Debug mode renders the disc (default false) */
    visible?: boolean;
}

/**
 * ConnectorPort — visual attachment point for Wire connections.
 *
 * When `active`, the port disc pulses with a soft glow ring.
 * When `visible`, a small disc indicator is shown at the port position.
 * Always exists as a scene node for position queries.
 */
export default function ConnectorPort({
    position,
    normal = [0, 1, 0],
    radius = 0.06,
    active = false,
    color = '#00E5FF',
    visible = false,
}: ConnectorPortProps) {
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!ringRef.current || !active) return;
        const t = state.clock.getElapsedTime();
        const pulse = 0.8 + Math.sin(t * 3.0) * 0.2;
        ringRef.current.scale.setScalar(pulse);
        (ringRef.current.material as THREE.MeshStandardMaterial).opacity = pulse * 0.8;
    });

    if (!visible) return null;

    // Compute orientation quaternion from normal
    const up = new THREE.Vector3(0, 0, 1);
    const normalVec = new THREE.Vector3(...normal).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normalVec);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    return (
        <group position={position} rotation={[euler.x, euler.y, euler.z]}>
            {/* Port disc */}
            <mesh>
                <circleGeometry args={[radius, 16]} />
                <meshStandardMaterial
                    color={active ? color : '#888888'}
                    roughness={0.4}
                    metalness={0.2}
                    transparent
                    opacity={active ? 0.9 : 0.5}
                    depthWrite={false}
                />
            </mesh>

            {/* Active pulse ring */}
            {active && (
                <mesh ref={ringRef}>
                    <ringGeometry args={[radius * 1.1, radius * 1.5, 24]} />
                    <meshStandardMaterial
                        color={color}
                        roughness={0.0}
                        emissive={color}
                        emissiveIntensity={1.5}
                        transparent
                        opacity={0.7}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}
