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

const LoadBalancer = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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
    const dialGroupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    // Define port configurations (centered at y = 0.0 at the block seam interface)
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "left",
            side: "left",
            position: [-1.0, 0, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [1.0, 0, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
        {
            id: "top",
            side: "top",
            position: [0, 0, -1.0],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "bottom",
            side: "bottom",
            position: [0, 0, 1.0],
            normal: [0, 0, 1],
            radius: 0.02,
        },
    ], []);

    // Expose connector port query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on LoadBalancer`);
            return port;
        },
        getConnectorPorts: () => portsList,
    }));

    // Resolve camera default rotation angle
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

    // Layer Base Geometries: 2.0 width x 2.0 depth x 0.24 height
    // Adjusted width/height inputs: 2.70 x 2.70
    const blockGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70,
            height: 2.70,
            depth: 0.24,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Top Dial Wheel: radius 0.70, height 0.10
    const dialGeometry = useMemo(() => new THREE.CylinderGeometry(0.70, 0.70, 0.10, 64), []);

    // Center dark grey pin: radius 0.08, height 0.12
    const pinGeometry = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 0.12, 32), []);

    // Diameter cuts (intersections to form 6 sectors): width 1.38 x height 0.008 x depth 0.015
    const cutGeometry = useMemo(() => new THREE.BoxGeometry(1.38, 0.008, 0.015), []);

    // Connector sub-geometries:
    const collarGeometry = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 0.20, 32), []);
    // Hexagonal Nut: radialSegments = 6
    const hexNutGeometry = useMemo(() => new THREE.CylinderGeometry(0.14, 0.14, 0.18, 6), []);
    const outerPinGeometry = useMemo(() => new THREE.CylinderGeometry(0.05, 0.05, 0.25, 32), []);

    // Dark grey material for metal pins/details
    const darkGreyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#4a4a4a",
        roughness: 0.4,
        metalness: 0.6,
    }), []);

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

    // Smooth hover scale transitions
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

    // Float, tilt, and continuous rotation loops
    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        if (groupRef.current) {
            if (floating && animationToggle) {
                groupRef.current.position.y = position[1] + Math.sin(time * 1.5) * 0.03;
                groupRef.current.rotation.y = initialRotation[1] + time * 0.15;
                groupRef.current.rotation.x = initialRotation[0] + Math.sin(time * 0.4) * 0.01;
            } else {
                groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, position[1], 0.05);
                groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, initialRotation[0], 0.05);
                groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, initialRotation[1], 0.05);
            }
        }

        // Rotate the dial continuously (distribution visual indicator)
        if (dialGroupRef.current && animationToggle) {
            dialGroupRef.current.rotation.y = time * 0.6;
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

    // Connector Sub-tree component
    const HexConnector = ({ side }: { side: "left" | "right" }) => {
        const rotationZ = side === "left" ? Math.PI / 2 : -Math.PI / 2;
        return (
            <group position={[side === "left" ? -1.0 : 1.0, 0, 0]} rotation={[0, 0, rotationZ]}>
                {/* Main collar cylinder extending out of base */}
                <mesh geometry={collarGeometry} material={darkGreyMaterial} castShadow />
                {/* Opaque White Ceramic Hexagonal coupling nut */}
                <mesh geometry={hexNutGeometry} position={[0, 0.29, 0]} castShadow>
                    <WhiteCeramic />
                </mesh>
                {/* Dark grey pin extending out of hex nut */}
                <mesh geometry={outerPinGeometry} position={[0, 0.50, 0]} material={darkGreyMaterial} castShadow />
            </group>
        );
    };

    return (
        <group ref={groupRef} position={position} rotation={initialRotation}>
            {/* Animating Hover/Tilt Container */}
            <group ref={hoverRef}>

                {/* Top White Ceramic block (y = 0.0 to 0.24, center at 0.12) */}
                <mesh
                    geometry={blockGeometry}
                    position={[0, 0.12, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Bottom Black polymer block (y = -0.24 to 0.0, center at -0.12) */}
                <mesh
                    geometry={blockGeometry}
                    position={[0, -0.12, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <BlackBase />
                </mesh>

                {/* Rotating Dial Group (positioned on top surface of white block y = 0.24) */}
                <group ref={dialGroupRef} position={[0, 0.24, 0]}>
                    {/* Main Dial Cylinder (centered at y = 0.05, spanning from 0.0 to 0.10) */}
                    <mesh geometry={dialGeometry} position={[0, 0.05, 0]} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>

                    {/* 3 Intersecting lines creating 6 equal dial segments (pie sectors) */}
                    {/* Positioned slightly above dial face (y = 0.102) to avoid z-fighting */}
                    <mesh geometry={cutGeometry} position={[0, 0.102, 0]} material={darkGreyMaterial} />
                    <mesh geometry={cutGeometry} position={[0, 0.102, 0]} rotation={[0, Math.PI / 3, 0]} material={darkGreyMaterial} />
                    <mesh geometry={cutGeometry} position={[0, 0.102, 0]} rotation={[0, 2 * Math.PI / 3, 0]} material={darkGreyMaterial} />

                    {/* Center Pin cylinder (centered at y = 0.16, spanning from 0.10 to 0.22) */}
                    <mesh geometry={pinGeometry} position={[0, 0.16, 0]} material={darkGreyMaterial} castShadow />
                </group>

                {/* Left & Right Hex-Nut Connectors */}
                <HexConnector side="left" />
                <HexConnector side="right" />

                {/* Typography: LOAD BALANCER (centered flat on front face of the white top block) */}
                {showLabel && (
                    <Text
                        position={[0, 0.12, 1.005]} // centered flat on front face of white block (z = 1.0 + 0.005)
                        rotation={[0, 0, 0]}
                        fontSize={0.14}
                        color="#1a1a1a" // dark charcoal/black text
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        LOAD BALANCER
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
                    position={[0, 0.11, 0]}
                >
                    <boxGeometry args={[2.1, 0.75, 2.1]} />
                </mesh>
            )}
        </group>
    );
});

LoadBalancer.displayName = "LoadBalancer";

export default LoadBalancer;
