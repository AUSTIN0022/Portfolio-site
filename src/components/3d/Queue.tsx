'use client';

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic, YellowAccent, Wood } from '@/components/materials/materials';

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

const Queue = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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

    // Define port configurations (centered vertically at y = 0.32)
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "left",
            side: "left",
            position: [-1.0, 0.32, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [1.0, 0.32, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
        {
            id: "top",
            side: "top",
            position: [0, 0.32, -0.6],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "bottom",
            side: "bottom",
            position: [0, 0.32, 0.6],
            normal: [0, 0, 1],
            radius: 0.02,
        },
    ], []);

    // Expose connector port query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Queue`);
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

    // Rounded rectangular block geometry: 2.0 width x 1.2 depth x 0.46 height
    // Adjusted width/height inputs to compensate for rounded box subtraction bug:
    // w_in = 2.0 + 2 * 0.24 - 2 * 0.01 = 2.46
    // h_in = 1.2 + 2 * 0.24 - 2 * 0.01 = 1.66
    const blockGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.46,
            height: 1.66,
            depth: 0.46,
            radius: 0.24,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Yellow base geometry: 2.0 width x 1.2 depth x 0.24 height
    // Adjusted width/height inputs: 2.46 x 1.66
    const baseGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.46,
            height: 1.66,
            depth: 0.24,
            radius: 0.24,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Wood separator geometry: 1.90 width x 1.10 depth x 0.06 height
    // Adjusted width/height inputs: 1.99 x 1.19
    const separatorGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.99,
            height: 1.19,
            depth: 0.06,
            radius: 0.05,
            bevel: 0.005,
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

                {/* Layer 6: White Ceramic Top Block (y = 0.82 to 1.28, center at 1.05) */}
                <mesh
                    geometry={blockGeometry}
                    position={[0, 1.05, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 5: Wood Separator 1 (y = 0.724 to 0.784, center at 0.754) */}
                <mesh
                    geometry={separatorGeometry}
                    position={[0, 0.754, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <Wood />
                </mesh>

                {/* Layer 4: White Ceramic Middle Block (y = 0.228 to 0.688, center at 0.458) */}
                <mesh
                    geometry={blockGeometry}
                    position={[0, 0.458, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 3: Wood Separator 2 (y = 0.132 to 0.192, center at 0.162) */}
                <mesh
                    geometry={separatorGeometry}
                    position={[0, 0.162, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <Wood />
                </mesh>

                {/* Layer 2: White Ceramic Bottom Block (y = -0.364 to 0.096, center at -0.134) */}
                <mesh
                    geometry={blockGeometry}
                    position={[0, -0.134, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 1: Yellow Accent Base Block (y = -0.64 to -0.40, center at -0.52) */}
                <mesh
                    geometry={baseGeometry}
                    position={[0, -0.52, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <YellowAccent />
                </mesh>

                {/* Typography: QUEUE (placed flat on the front-left vertical face of the top block) */}
                {showLabel && (
                    <Text
                        position={[0, 1.05, 0.605]} // centered flat on front face (z = 0.6 + 0.005)
                        rotation={[0, 0, 0]}
                        fontSize={0.14}
                        color="#111111"
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        QUEUE
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
                    position={[0, 0.32, 0]}
                >
                    <boxGeometry args={[2.1, 1.95, 1.3]} />
                </mesh>
            )}
        </group>
    );
});

Queue.displayName = "Queue";

export default Queue;
