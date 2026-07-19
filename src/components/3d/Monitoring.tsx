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

const Monitoring = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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

    // Define port configurations (centered vertically at y = 0.23 inside the main body block)
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
            if (!port) throw new Error(`Port side "${side}" does not exist on Monitoring`);
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

    // Main white body block geometry: 2.0 width x 2.0 depth x 0.46 height
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

    // Glowing green base geometry: 2.0 width x 2.0 depth x 0.24 height
    // Adjusted width/height inputs: 2.70 x 2.70
    const baseGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.24,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Inset separator groove block geometry: 1.95 width x 1.95 depth x 0.04 height
    // Adjusted width/height inputs: 2.33 x 2.33
    const grooveGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.33,
            height: 2.33,
            depth: 0.04,
            radius: 0.30,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Custom quadrant extruded geometry using a 2D shape to ensure outer corners have 0.36 radius
    // and inner seams are tight (0.04 gap).
    const quadrantGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        // Start near center (leaving a small gap of 0.03 before bevel)
        shape.moveTo(0.03, 0.03);
        // Line to flat outer right edge
        shape.lineTo(0.99, 0.03);
        // Line to start of outer corner arc
        shape.lineTo(0.99, 0.64);
        // Outer corner arc (radius 0.35, center at 0.64, 0.64)
        shape.absarc(0.64, 0.64, 0.35, 0, Math.PI / 2, false);
        // Line to flat outer top edge
        shape.lineTo(0.03, 0.99);
        // Line back to start
        shape.lineTo(0.03, 0.03);

        const extrudeSettings = {
            depth: 0.10,
            bevelEnabled: true,
            bevelSegments: 4,
            steps: 1,
            bevelSize: 0.01,
            bevelThickness: 0.01,
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
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

                {/* Layer 5: Top 4 Quadrants (arranged in 2x2 grid flat on top of body, center y = 0.47) */}
                <group position={[0, 0.47, 0]}>
                    {/* Back-Right Quadrant (theta = 0) */}
                    <mesh geometry={quadrantGeometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    {/* Back-Left Quadrant (theta = PI/2) */}
                    <mesh geometry={quadrantGeometry} rotation={[-Math.PI / 2, 0, Math.PI / 2]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    {/* Front-Left Quadrant (theta = PI) */}
                    <mesh geometry={quadrantGeometry} rotation={[-Math.PI / 2, 0, Math.PI]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    {/* Front-Right Quadrant (theta = -PI/2) */}
                    <mesh geometry={quadrantGeometry} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                </group>

                {/* Layer 4: Main Solid White Rounded Square Body (y = 0.0 to 0.46, center at 0.23) */}
                <mesh
                    geometry={bodyGeometry}
                    position={[0, 0.23, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 3: Separator Groove Seam (y = -0.04 to 0.0, center at -0.02) */}
                <mesh
                    geometry={grooveGeometry}
                    position={[0, -0.02, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                >
                    <BlackBase />
                </mesh>

                {/* Layer 2: Glowing Green Base Block (y = -0.28 to -0.04, center at -0.16) */}
                <mesh
                    geometry={baseGeometry}
                    position={[0, -0.16, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <meshStandardMaterial
                        color="#3ECF8E"
                        emissive="#0a2f12"
                        emissiveIntensity={0.2}
                        roughness={0.15}
                        metalness={0.1}
                    />
                </mesh>

                {/* Typography: MONITORING (placed flat on front-left vertical face of ceramic body) */}
                {showLabel && (
                    <Text
                        position={[0, 0.23, 1.005]} // centered flat on front face (z = 1.0 + 0.005)
                        rotation={[0, 0, 0]}
                        fontSize={0.12} // reduced slightly to fit 10 character text within margins
                        color="#111111"
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        MONITORING
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
                    position={[0, 0.15, 0]}
                >
                    <boxGeometry args={[2.1, 0.90, 2.1]} />
                </mesh>
            )}
        </group>
    );
});

Monitoring.displayName = "Monitoring";

export default Monitoring;
