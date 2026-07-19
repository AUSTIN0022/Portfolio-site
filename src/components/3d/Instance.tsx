'use client';

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic, BlackBase, YellowAccent } from '@/components/materials/materials';

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

const Instance = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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

    // Define port configurations (centered vertically at y = 0.38 inside the main body block)
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "left",
            side: "left",
            position: [-1.0, 0.38, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [1.0, 0.38, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
        {
            id: "top",
            side: "top",
            position: [0, 0.38, -0.6],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "bottom",
            side: "bottom",
            position: [0, 0.38, 0.6],
            normal: [0, 0, 1],
            radius: 0.02,
        },
    ], []);

    // Expose connector port query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Instance`);
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

    // White main body block geometry: 2.0 width x 1.2 depth x 0.76 height
    // Adjusted width/height inputs: 2.46 x 1.66
    const bodyGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.46,
            height: 1.66,
            depth: 0.76,
            radius: 0.24,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Black Base block geometry: 2.0 width x 1.2 depth x 0.20 height
    // Adjusted width/height inputs: 2.46 x 1.66
    const bottomGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.46,
            height: 1.66,
            depth: 0.20,
            radius: 0.24,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Inset separator groove block geometry: 1.95 width x 1.15 depth x 0.04 height
    // Adjusted width/height inputs: 1.95 + 2 * 0.20 - 2 * 0.01 = 2.33 x 1.53
    const grooveGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.33,
            height: 1.53,
            depth: 0.04,
            radius: 0.20,
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

                {/* Layer 3: Main Solid White Rounded Square Body (y = 0.0 to 0.76, center at 0.38) */}
                <mesh
                    geometry={bodyGeometry}
                    position={[0, 0.38, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 2: Separator Groove Seam (y = -0.04 to 0.0, center at -0.02) */}
                <mesh
                    geometry={grooveGeometry}
                    position={[0, -0.02, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                >
                    <BlackBase />
                </mesh>

                {/* Layer 1: Black Base Block (y = -0.24 to -0.04, center at -0.14) */}
                <mesh
                    geometry={bottomGeometry}
                    position={[0, -0.14, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <BlackBase />
                </mesh>

                {/* Typography: INSTANCE (placed flat on front-left vertical face of top block, left-shifted) */}
                {showLabel && (
                    <Text
                        position={[-0.25, 0.38, 0.605]} // left shifted, centered on front face (z = 0.6 + 0.005)
                        rotation={[0, 0, 0]}
                        fontSize={0.14}
                        color="#111111"
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        INSTANCE
                    </Text>
                )}

                {/* Status Indicator LED (yellow dot to the right of INSTANCE text) */}
                <mesh
                    position={[0.45, 0.38, 0.602]}
                    rotation={[Math.PI / 2, 0, 0]} // rotate cylinder to face camera along Z
                    castShadow
                >
                    <cylinderGeometry args={[0.05, 0.05, 0.01, 16]} />
                    <YellowAccent />
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
                    position={[0, 0.26, 0]}
                >
                    <boxGeometry args={[2.1, 1.05, 1.3]} />
                </mesh>
            )}
        </group>
    );
});

Instance.displayName = "Instance";

export default Instance;
