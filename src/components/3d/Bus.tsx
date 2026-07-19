'use client';

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic } from '@/components/materials/materials';

export interface ConnectorPort {
    id: string;
    side: "left" | "right" | "top" | "bottom" | "front" | "back";
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
    color?: "red" | "yellow" | "blue";
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
    getConnectorPort: (side: "left" | "right" | "top" | "bottom" | "front" | "back") => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

const Bus = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
    color = "red",
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

    // Define port configurations (centered at y = 0.125)
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "front",
            side: "front",
            position: [0, 0.125, 1.2],
            normal: [0, 0, 1],
            radius: 0.02,
        },
        {
            id: "back",
            side: "back",
            position: [0, 0.125, -1.2],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "left",
            side: "left",
            position: [-0.65, 0.125, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [0.65, 0.125, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
    ], []);

    // Expose connector port query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Bus`);
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

    // Map color configurations
    const chassisColor = useMemo(() => {
        switch (color) {
            case "yellow":
                return "#f1c40f";
            case "blue":
                return "#3498db";
            case "red":
            default:
                return "#e74c3c";
        }
    }, [color]);

    // Custom glossy chassis paint material
    const chassisPaintMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: chassisColor,
        roughness: 0.15,
        metalness: 0.1,
    }), [chassisColor]);

    // Dark grey polymer material
    const darkGreyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#2c3e50",
        roughness: 0.5,
        metalness: 0.3,
    }), []);

    // High gloss white wheel hub material
    const whiteRimMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#fafafa",
        roughness: 0.1,
        metalness: 0.1,
    }), []);

    // Premium transmissive black glass window material
    const windowMaterial = (
        <meshPhysicalMaterial
            color="#111111"
            roughness={0.05}
            transmission={0.85}
            thickness={0.1}
            ior={1.5}
            clearcoat={1.0}
            clearcoatRoughness={0.05}
            transparent={true}
            opacity={0.8}
        />
    );

    // Premium transmissive clear glass cover for headlights
    const clearGlassMaterial = (
        <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.05}
            transmission={0.95}
            thickness={0.05}
            ior={1.5}
            clearcoat={1.0}
            transparent={true}
            opacity={0.9}
        />
    );

    // Lower Chassis block geometry: width 1.3, depth 2.4, height 0.5
    // Smoother corner radius: radius 0.22, bevel 0.01 (Input X: 1.72, Y: 0.92, Z: 2.40)
    const chassisGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.72,
            height: 0.92,
            depth: 2.40,
            radius: 0.22,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Upper Cabin block geometry: width 1.26, depth 2.34, height 0.5
    // Smoother corner radius: radius 0.22, bevel 0.01 (Input X: 1.68, Y: 0.92, Z: 2.34)
    const cabinGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.68,
            height: 0.92,
            depth: 2.34,
            radius: 0.22,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Roof Cap geometry: width 1.22, depth 2.26, height 0.16
    // Smoother corner radius: radius 0.16, bevel 0.01 (Input X: 1.52, Y: 0.46, Z: 2.26)
    const roofGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.52,
            height: 0.46,
            depth: 2.26,
            radius: 0.16,
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

    // Smooth hover transitions
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

    // Floating and tilt frame updates
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

                {/* 1. Upper Cabin (White Ceramic, centered at y = 0.48) */}
                <mesh geometry={cabinGeometry} position={[0, 0.48, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>

                {/* 2. Lower Chassis (Colored Paint, centered at y = 0.0) */}
                <mesh geometry={chassisGeometry} position={[0, 0, 0]} castShadow receiveShadow>
                    <primitive object={chassisPaintMaterial} attach="material" />
                </mesh>

                {/* 3. Roof Cap (White Ceramic, centered at y = 0.76) */}
                <mesh geometry={roofGeometry} position={[0, 0.76, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>

                {/* 4. Front Windshield (centered at y = 0.48, z = 1.171) */}
                <mesh position={[0, 0.48, 1.171]} castShadow>
                    <boxGeometry args={[1.05, 0.35, 0.02]} />
                    {windowMaterial}
                </mesh>

                {/* 5. Headlights & Bezel (x = +-0.36, y = -0.05, z = 1.205) */}
                {[-0.36, 0.36].map((hx, idx) => (
                    <group key={`headlight-${idx}`}>
                        {/* Outer bezel ring */}
                        <mesh position={[hx, -0.05, 1.205]} rotation={[Math.PI / 2, 0, 0]} material={darkGreyMaterial} castShadow>
                            <cylinderGeometry args={[0.14, 0.14, 0.02, 32]} />
                        </mesh>
                        {/* Tinted yellow headlight lens/bulb */}
                        <mesh position={[hx, -0.05, 1.21]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                            <cylinderGeometry args={[0.11, 0.11, 0.02, 32]} />
                            <meshStandardMaterial color="#f1c40f" emissive="#f1c40f" emissiveIntensity={0.8} roughness={0.1} />
                        </mesh>
                        {/* Clear transparent glass cover in front of the bulb */}
                        <mesh position={[hx, -0.05, 1.221]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.12, 0.12, 0.005, 32]} />
                            {clearGlassMaterial}
                        </mesh>
                        {/* Amber indicator lights */}
                        <mesh position={[hx, -0.22, 1.205]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                            <cylinderGeometry args={[0.05, 0.05, 0.02, 32]} />
                            <meshStandardMaterial color="#f39c12" emissive="#f39c12" emissiveIntensity={0.4} roughness={0.2} />
                        </mesh>
                    </group>
                ))}

                {/* 6. Front Grill & Slats (x = 0, y = -0.12, z = 1.205) */}
                <group position={[0, -0.12, 1.205]}>
                    {/* Grill backplate */}
                    <mesh material={darkGreyMaterial} castShadow>
                        <boxGeometry args={[0.45, 0.22, 0.02]} />
                    </mesh>
                    {/* Slats */}
                    {[-0.05, 0.0, 0.05].map((sy, idx) => (
                        <mesh key={`slat-${idx}`} position={[0, sy, 0.015]} material={darkGreyMaterial}>
                            <boxGeometry args={[0.38, 0.02, 0.01]} />
                        </mesh>
                    ))}
                </group>

                {/* 7. Side Windows (x = +-0.63, y = 0.48) */}
                {/* Driver/Front Side: z = 0.6. Rear side windows: z = -0.2 and z = -0.8 */}
                {[-0.631, 0.631].map((wx) => (
                    <group key={`side-windows-${wx}`}>
                        {/* Driver Side window */}
                        <mesh position={[wx, 0.48, 0.6]} castShadow>
                            <boxGeometry args={[0.01, 0.35, 0.5]} />
                            {windowMaterial}
                        </mesh>
                        {/* Rear side window 1 */}
                        <mesh position={[wx, 0.48, -0.2]} castShadow>
                            <boxGeometry args={[0.01, 0.35, 0.45]} />
                            {windowMaterial}
                        </mesh>
                        {/* Rear side window 2 */}
                        <mesh position={[wx, 0.48, -0.8]} castShadow>
                            <boxGeometry args={[0.01, 0.35, 0.45]} />
                            {windowMaterial}
                        </mesh>
                    </group>
                ))}

                {/* 8. Rear Windshield (z = -1.171, y = 0.48) */}
                <mesh position={[0, 0.48, -1.171]} castShadow>
                    <boxGeometry args={[0.9, 0.35, 0.02]} />
                    {windowMaterial}
                </mesh>

                {/* 9. Side view Mirrors (x = +-0.68, y = 0.40, z = 0.9) */}
                {[-0.68, 0.68].map((mx) => (
                    <group key={`mirror-${mx}`} position={[mx, 0.40, 0.9]}>
                        {/* Support brackets */}
                        <mesh rotation={[0, 0, mx > 0 ? Math.PI / 2 : -Math.PI / 2]} material={darkGreyMaterial}>
                            <cylinderGeometry args={[0.015, 0.015, 0.12, 16]} />
                        </mesh>
                        {/* Mirror Box */}
                        <mesh position={[mx > 0 ? 0.04 : -0.04, 0, 0]} material={darkGreyMaterial} castShadow>
                            <boxGeometry args={[0.04, 0.14, 0.08]} />
                        </mesh>
                    </group>
                ))}

                {/* 10. Wheels (Front x = +-0.64, z = 0.7; Rear x = +-0.64, z = -0.7; y = -0.25) */}
                {[
                    [-0.64, -0.25, 0.7],  // Front Left
                    [0.64, -0.25, 0.7],   // Front Right
                    [-0.64, -0.25, -0.7], // Rear Left
                    [0.64, -0.25, -0.7]   // Rear Right
                ].map(([wx, wy, wz], idx) => (
                    <group key={`wheel-${idx}`} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
                        {/* Tire cylinder */}
                        <mesh material={darkGreyMaterial} castShadow receiveShadow>
                            <cylinderGeometry args={[0.24, 0.24, 0.16, 32]} />
                        </mesh>
                        {/* Hubcap inner white cylinder (bright glossy white rims) */}
                        <mesh position={[0, wx > 0 ? 0.01 : -0.01, 0]} material={whiteRimMaterial} castShadow>
                            <cylinderGeometry args={[0.13, 0.13, 0.18, 32]} />
                        </mesh>
                    </group>
                ))}

                {/* 11. Front & Rear Bumpers & Side Skirts */}
                {/* Front bumper (y = -0.22, z = 1.24) */}
                <mesh position={[0, -0.22, 1.24]} material={darkGreyMaterial} castShadow>
                    <boxGeometry args={[1.2, 0.12, 0.12]} />
                </mesh>
                {/* Rear bumper (y = -0.18, z = -1.24) */}
                <mesh position={[0, -0.18, -1.24]} material={darkGreyMaterial} castShadow>
                    <boxGeometry args={[1.1, 0.12, 0.12]} />
                </mesh>
                {/* Side runners / skirts (x = +-0.62, y = -0.24, z = 0) */}
                {[-0.62, 0.62].map((sx) => (
                    <mesh key={`skirt-${sx}`} position={[sx, -0.24, 0]} material={darkGreyMaterial}>
                        <boxGeometry args={[0.08, 0.06, 1.1]} />
                    </mesh>
                ))}

                {/* Typography: BUS label printed on rear side panel (optional / showLabel) */}
                {showLabel && (
                    <Text
                        position={[0, -0.10, -1.245]} // Centered on the back panel below the bumper/windshield
                        rotation={[0, Math.PI, 0]} // oriented to face backwards
                        fontSize={0.14}
                        color="#1a1a1a"
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        BUS
                    </Text>
                )}

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
                    position={[0, 0.28, 0]}
                >
                    <boxGeometry args={[1.4, 1.15, 2.5]} />
                </mesh>
            )}
        </group>
    );
});

Bus.displayName = "Bus";

export default Bus;
