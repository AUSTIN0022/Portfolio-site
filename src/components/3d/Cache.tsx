'use client';

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic, BlackBase } from '@/components/materials/materials';

export interface ConnectorPort {
    id: string;
    side: "left" | "right" | "top" | "bottom";
    position: [number, number, number];
    normal: [number, number, number];
    radius: number;
}

export interface ConnectorConfig {
    id: string;
    active?: boolean;
    color?: string;
}

export interface InfrastructureNodeProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    interactive?: boolean;
    floating?: boolean;
    showLabel?: boolean;
    defaultView?: "front" | "top" | "isometric";
    connectors?: ConnectorConfig[];
    animationToggle?: boolean;
    showPorts?: boolean;
}

export interface InfrastructureNodeRef {
    getConnectorPort: (side: "left" | "right" | "top" | "bottom") => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

const Cache = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
    position = [0, 0, 0],
    rotation,
    scale = 1.0,
    interactive = true,
    floating = true,
    showLabel = true,
    defaultView = "isometric",
    connectors,
    animationToggle = true,
    showPorts = false,
}, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const hoverRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    // Define port configurations (centered vertically at y = 0.23 inside the ceramic block)
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "left",
            side: "left",
            position: [-1.0, 0.23, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [1.0, 0.23, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
        {
            id: "top",
            side: "top",
            position: [0, 0.23, -1.0],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "bottom",
            side: "bottom",
            position: [0, 0.23, 1.0],
            normal: [0, 0, 1],
            radius: 0.02,
        },
    ], []);

    // Expose connector port query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Cache`);
            return port;
        },
        getConnectorPorts: () => portsList,
    }));

    // Resolve camera default isometric angle from reference image (straight vertical axis)
    const initialRotation = useMemo((): [number, number, number] => {
        if (rotation) return rotation;
        switch (defaultView) {
            case "top":
                return [-Math.PI / 2, 0, 0];
            case "front":
                return [0, 0, 0];
            case "isometric":
            default:
                return [0, 35 * Math.PI / 180, 0];
        }
    }, [rotation, defaultView]);

    // Outer solid white rounded square body (2.0 x 2.0 x 0.46, radius 0.36)
    // Adjusted width/height inputs: 2.70 x 2.70
    const bodyGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.46,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Black Base geometry (2.0 x 2.0 x 0.24, radius 0.36)
    // Adjusted width/height inputs: 2.70 x 2.70
    const bottomGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.24,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Outer Glass Shell geometry (2.0 x 2.0 x 0.46, radius 0.36)
    // Adjusted width/height inputs: 2.70 x 2.70
    const glassGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.46,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Inner glowing green core geometry (1.6 x 1.6 x 0.34, radius 0.28)
    // Adjusted width/height inputs: 1.6 + 2 * 0.28 - 2 * 0.01 = 2.14
    const coreGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.14,
            height: 2.14,
            depth: 0.34,
            radius: 0.28,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Entrance scale animation
    useEffect(() => {
        if (groupRef.current) {
            gsap.killTweensOf(groupRef.current.scale);
            gsap.fromTo(
                groupRef.current.scale,
                { x: 0, y: 0, z: 0 },
                {
                    x: scale,
                    y: scale,
                    z: scale,
                    duration: 1.0,
                    ease: 'elastic.out(1, 0.8)',
                }
            );
        }
    }, [scale]);

    // Smooth hover scale transitions (extremely stable scale limit 1.03)
    useEffect(() => {
        if (hoverRef.current && interactive) {
            gsap.to(hoverRef.current.scale, {
                x: hovered ? 1.03 : 1.0,
                y: hovered ? 1.03 : 1.0,
                z: hovered ? 1.03 : 1.0,
                duration: 0.3,
                ease: 'power1.out',
            });
        }
    }, [hovered, interactive]);

    // Float and continuous rotation animation loop
    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        if (groupRef.current) {
            if (floating && animationToggle) {
                groupRef.current.position.y = position[1] + Math.sin(time * 1.5) * 0.03;
                // Slow continuous spin around vertical Y-axis (gentle rotation)
                groupRef.current.rotation.y = initialRotation[1] + time * 0.15;
                groupRef.current.rotation.x = initialRotation[0] + Math.sin(time * 0.4) * 0.01;
            } else {
                groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, position[1], 0.05);
                groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, initialRotation[0], 0.05);
                groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, initialRotation[1], 0.05);
            }
        }

        // Parallax mouse tilt
        if (hoverRef.current && interactive) {
            if (hovered) {
                const targetTiltX = -state.pointer.y * 0.08;
                const targetTiltY = state.pointer.x * 0.08;
                hoverRef.current.rotation.x = THREE.MathUtils.lerp(hoverRef.current.rotation.x, targetTiltX, 0.1);
                hoverRef.current.rotation.z = THREE.MathUtils.lerp(hoverRef.current.rotation.z, -targetTiltY, 0.1);
            } else {
                hoverRef.current.rotation.x = THREE.MathUtils.lerp(hoverRef.current.rotation.x, 0, 0.1);
                hoverRef.current.rotation.z = THREE.MathUtils.lerp(hoverRef.current.rotation.z, 0, 0.1);
            }
        }
    });

    return (
        <group ref={groupRef} position={position} rotation={initialRotation}>
            {/* Animating Hover/Tilt Container */}
            <group ref={hoverRef}>

                {/* Layer 5: Glowing Green Core (Centered inside the glass box at y = 0.69) */}
                <mesh
                    geometry={coreGeometry}
                    position={[0, 0.69, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                >
                    <meshStandardMaterial
                        color="#3ECF8E"
                        emissive="#1b5e20"
                        emissiveIntensity={0.8}
                        roughness={0.2}
                        metalness={0.1}
                    />
                </mesh>

                {/* Layer 4: Transmissive Outer Glass Box (y = 0.46 to 0.92, center at 0.69) */}
                <mesh
                    geometry={glassGeometry}
                    position={[0, 0.69, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <meshPhysicalMaterial
                        color="#e8f7ec" // slightly green-tinted transparent acrylic/glass
                        roughness={0.05}
                        metalness={0.0}
                        transmission={0.92}
                        thickness={0.25}
                        ior={1.5}
                        clearcoat={1.0}
                        clearcoatRoughness={0.05}
                        transparent={true}
                    />
                </mesh>

                {/* Layer 3: Main Solid White Rounded Square Body (y = 0.0 to 0.46, center at 0.23) */}
                <mesh
                    geometry={bodyGeometry}
                    position={[0, 0.23, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Typography: CACHE (placed flat on front-left vertical face of ceramic body) */}
                {showLabel && (
                    <Text
                        position={[0, 0.23, 1.005]} // centered flat on front face (z = 1.0 + 0.005)
                        rotation={[0, 0, 0]}
                        fontSize={0.14}
                        color="#111111"
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        CACHE
                    </Text>
                )}

                {/* Layer 1: Black Base (y = -0.24 to 0.0, center at -0.12) */}
                <mesh
                    geometry={bottomGeometry}
                    position={[0, -0.12, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <BlackBase />
                </mesh>

                {/* Debug Port Spheres */}
                {showPorts && portsList.map((port) => (
                    <mesh key={`debug-port-${port.id}`} position={port.position}>
                        <sphereGeometry args={[0.06, 16, 16]} />
                        <meshBasicMaterial color="#FF3300" depthTest={false} transparent opacity={0.8} />
                    </mesh>
                ))}

            </group>

            {/* Static Invisible Hitbox */}
            {interactive && (
                <mesh
                    visible={false}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        setHovered(true);
                    }}
                    onPointerOut={(e) => {
                        e.stopPropagation();
                        setHovered(false);
                    }}
                    position={[0, 0.34, 0]}
                >
                    <boxGeometry args={[2.1, 1.20, 2.1]} />
                </mesh>
            )}
        </group>
    );
});

Cache.displayName = "Cache";

export default Cache;
