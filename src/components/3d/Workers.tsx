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

const Workers = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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

    // Define port configurations (centered vertically at y = -0.12 inside the black base tray block)
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "left",
            side: "left",
            position: [-1.0, -0.12, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [1.0, -0.12, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
        {
            id: "top",
            side: "top",
            position: [0, -0.12, -1.0],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "bottom",
            side: "bottom",
            position: [0, -0.12, 1.0],
            normal: [0, 0, 1],
            radius: 0.02,
        },
    ], []);

    // Expose connector port query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Workers`);
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

    // Black Base Tray geometry: 2.0 width x 2.0 depth x 0.24 height
    // Adjusted width/height inputs: 2.70 x 2.70
    const trayGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.24,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Yellow Accent spacer geometry: 2.0 width x 2.0 depth x 0.04 height
    // Adjusted width/height inputs: 2.70 x 2.70
    const yellowGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.04,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Black Accent spacer geometry: 2.0 width x 2.0 depth x 0.04 height
    // Adjusted width/height inputs: 2.70 x 2.70
    const blackSpacerGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.04,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Pillar Yellow Accent ring geometry: 0.84 width x 0.84 depth x 0.04 height
    // Adjusted width/height inputs: 0.84 + 2 * 0.20 - 2 * 0.005 = 1.23 x 1.23
    const pillarRingGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.23,
            height: 1.23,
            depth: 0.04,
            radius: 0.20,
            bevel: 0.005,
            segments: 16,
        });
    }, []);

    // Pillar Block top part geometry: 0.84 width x 0.84 depth x 0.58 height
    const pillarTopGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.23,
            height: 1.23,
            depth: 0.58,
            radius: 0.20,
            bevel: 0.005,
            segments: 16,
        });
    }, []);

    // Pillar Grid Layout positions (centered relative to the 2.0x2.0 base tray)
    const pillarPositions = useMemo((): [number, number][] => [
        [-0.46, 0.46],  // Front-Left
        [0.46, 0.46],   // Front-Right
        [-0.46, -0.46], // Back-Left
        [0.46, -0.46],  // Back-Right
    ], []);

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

                {/* 4 Ceramic Pillars starting at the top of the black spacer (y = 0.08) */}
                {pillarPositions.map(([px, pz], idx) => (
                    <group key={`pillar-${idx}`}>
                        {/* Pillar Yellow Glowing base ring (y = 0.08 to 0.12, center at 0.10) */}
                        <mesh
                            geometry={pillarRingGeometry}
                            position={[px, 0.10, pz]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            castShadow
                        >
                            <YellowAccent />
                        </mesh>
                        {/* Pillar Top cap / main column (y = 0.12 to 0.70, center at 0.41) */}
                        <mesh
                            geometry={pillarTopGeometry}
                            position={[px, 0.41, pz]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            castShadow
                            receiveShadow
                        >
                            <WhiteCeramic />
                        </mesh>
                    </group>
                ))}

                {/* Black Accent spacer sheet on top of yellow spacer (y = 0.04 to 0.08, center at 0.06) */}
                <mesh
                    geometry={blackSpacerGeometry}
                    position={[0, 0.06, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <BlackBase />
                </mesh>

                {/* Yellow Accent spacer sheet on top of tray (y = 0.0 to 0.04, center at 0.02) */}
                <mesh
                    geometry={yellowGeometry}
                    position={[0, 0.02, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                >
                    <YellowAccent />
                </mesh>

                {/* Base Tray: Matte Black polymer container (y = -0.24 to 0.0, center at -0.12) */}
                <mesh
                    geometry={trayGeometry}
                    position={[0, -0.12, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <BlackBase />
                </mesh>

                {/* Typography: WORKERS (placed flat on front-left vertical face of black base tray) */}
                {showLabel && (
                    <Text
                        position={[0, -0.12, 1.005]} // centered flat on front face (z = 1.0 + 0.005)
                        rotation={[0, 0, 0]}
                        fontSize={0.14}
                        color="#F4F1EC" // off-white color for contrast on black base tray
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        WORKERS
                    </Text>
                )}

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
                    position={[0, 0.23, 0]}
                >
                    <boxGeometry args={[2.1, 1.00, 2.1]} />
                </mesh>
            )}
        </group>
    );
});

Workers.displayName = "Workers";

export default Workers;
