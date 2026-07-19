'use client';

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { getCeramicTexture } from '@/components/materials/materials';

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

const Laptop = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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
    const hingeGroupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const [isOpen, setIsOpen] = useState(true);

    // Target hinge rotation angles
    // 0 = closed (flat), -105 degrees = open (vertical tilt)
    const openAngle = -113 * Math.PI / 180;
    const closedAngle = 0.0;

    // References to keys to animate typing
    const keysRef = useRef<THREE.Group>(null);

    // Define port configurations inside the base plate (centered at y = 0.0)
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "left",
            side: "left",
            position: [-0.8, 0, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [0.8, 0, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
        {
            id: "top",
            side: "top",
            position: [0, 0, -0.55],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "bottom",
            side: "bottom",
            position: [0, 0, 0.55],
            normal: [0, 0, 1],
            radius: 0.02,
        },
    ], []);

    // Expose connector port query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Laptop`);
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

    // Materials
    const bezelColor = "#2c2e30"; // Dark graphite display frame
    const screenColor = "#5e789c"; // Screen soft blue color
    const keyboardRecessColor = "#d8d2c5"; // Recess darker tone
    const keyColor = "#2d3130"; // Dark chiclet key color
    const trackpadColor = "#bebebe"; // Trackpad light grey

    // Load procedural micro-speckled ceramic texture from materials.tsx
    const ceramicTexture = typeof window !== 'undefined' ? getCeramicTexture() : null;

    const baseMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: new THREE.Color('#F4F1EC'), // Premium ceramic off-white
        roughness: 0.65, // Specified in Phase 7
        metalness: 0.0,
        map: ceramicTexture || undefined,
    }), [ceramicTexture]);

    const bezelMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: bezelColor,
        roughness: 0.5,
        metalness: 0.2,
    }), []);

    const screenMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: screenColor,
        roughness: 0.2,
        metalness: 0.1,
        emissive: "#3e5b88", // Soft blue emissive glow
        emissiveIntensity: 0.4,
    }), []);

    const recessMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: keyboardRecessColor,
        roughness: 0.6,
        metalness: 0.1,
    }), []);

    // Glass material for the screen overlay
    const glassMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.25,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.95,
        ior: 1.5,
        thickness: 0.05,
    }), []);

    const keyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: keyColor,
        roughness: 0.5,
        metalness: 0.05,
    }), []);

    const trackpadMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: trackpadColor,
        roughness: 0.4,
        metalness: 0.1,
    }), []);

    // Keyboard layout generation (Spacebar row perfectly centered to trackpad at x = 0.0)
    const keyboardLayout = useMemo(() => {
        const rows = [];
        // Row 1: Function/numbers (10 keys)
        for (let i = 0; i < 10; i++) {
            rows.push({
                x: -0.585 + i * 0.13,
                z: -0.22,
                w: 0.10,
                id: `r1-k${i}`
            });
        }
        // Row 2: QWERTY (9 keys)
        for (let i = 0; i < 9; i++) {
            rows.push({
                x: -0.52 + i * 0.13,
                z: -0.09,
                w: 0.10,
                id: `r2-k${i}`
            });
        }
        // Row 3: ASDFG (8 keys)
        for (let i = 0; i < 8; i++) {
            rows.push({
                x: -0.455 + i * 0.13,
                z: 0.04,
                w: 0.10,
                id: `r3-k${i}`
            });
        }
        // Row 4: Symmetric modifiers + Spacebar centered exactly around x = 0.0
        rows.push({ x: -0.485, z: 0.17, w: 0.10, id: `r4-k-ctrl1` });
        rows.push({ x: -0.355, z: 0.17, w: 0.10, id: `r4-k-alt1` });
        rows.push({ x: 0.0, z: 0.17, w: 0.55, isSpace: true, id: `r4-k-space` }); // Centered spacebar
        rows.push({ x: 0.355, z: 0.17, w: 0.10, id: `r4-k-alt2` });
        rows.push({ x: 0.485, z: 0.17, w: 0.10, id: `r4-k-ctrl2` });

        return rows;
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
                x: hovered ? 1.025 : 1.0,
                y: hovered ? 1.025 : 1.0,
                z: hovered ? 1.025 : 1.0,
                duration: 0.3,
                ease: 'power1.out',
            });
        }
    }, [hovered, interactive]);

    // Smooth open/close hinge animation
    useEffect(() => {
        if (hingeGroupRef.current) {
            const targetRotation = isOpen ? openAngle : closedAngle;
            const targetEmissive = isOpen ? 0.35 : 0.0;

            gsap.to(hingeGroupRef.current.rotation, {
                x: targetRotation,
                duration: 0.8,
                ease: 'power2.out',
            });

            gsap.to(screenMaterial, {
                emissiveIntensity: targetEmissive,
                duration: 0.8,
                ease: 'power2.out',
            });
        }
    }, [isOpen, openAngle, closedAngle, screenMaterial]);

    // Frame loops: Floating and Typing
    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Hover parallax tilt
        if (hoverRef.current && interactive) {
            if (hovered) {
                const targetTiltX = -state.pointer.y * 0.06;
                const targetTiltY = state.pointer.x * 0.06;
                hoverRef.current.rotation.x = THREE.MathUtils.lerp(hoverRef.current.rotation.x, targetTiltX, 0.1);
                hoverRef.current.rotation.z = THREE.MathUtils.lerp(hoverRef.current.rotation.z, -targetTiltY, 0.1);
            } else {
                hoverRef.current.rotation.x = THREE.MathUtils.lerp(hoverRef.current.rotation.x, 0, 0.1);
                hoverRef.current.rotation.z = THREE.MathUtils.lerp(hoverRef.current.rotation.z, 0, 0.1);
            }
        }

        // Floating bounce animation
        if (groupRef.current) {
            if (floating && animationToggle) {
                groupRef.current.position.y = position[1] + Math.sin(time * 1.6) * 0.04;
                groupRef.current.rotation.y = initialRotation[1] + Math.sin(time * 0.3) * 0.03;
            } else {
                groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, position[1], 0.05);
                groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, initialRotation[1], 0.05);
            }
        }

        // Typing effect: individual keys bob up and down
        if (keysRef.current && isOpen && animationToggle) {
            keysRef.current.children.forEach((keyMesh, idx) => {
                const waveOffset = Math.sin(time * 6 + idx * 0.9) * 0.006;
                // Only depress, keep keys flush or lower (sitting on base surface 0.04)
                keyMesh.position.y = 0.045 + Math.min(0, waveOffset);
            });
        } else if (keysRef.current) {
            // Restore key heights
            keysRef.current.children.forEach((keyMesh) => {
                keyMesh.position.y = THREE.MathUtils.lerp(keyMesh.position.y, 0.045, 0.1);
            });
        }
    });

    // Toggle lid position on click
    const toggleLid = (e: ThreeEvent<MouseEvent>) => {
        if (!interactive) return;
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    return (
        <group ref={groupRef} position={position} rotation={initialRotation}>
            {/* Animating Hover/Tilt Container */}
            <group ref={hoverRef}>

                {/* 1. Base Assembly */}
                <group onClick={toggleLid}>
                    {/* Main Base Shell (Ceramic off-white with micro-speckles, radius 0.06 for soft edges) */}
                    <RoundedBox args={[1.6, 1.1, 0.08]} radius={0.06} smoothness={4} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <primitive object={baseMaterial} attach="material" />
                    </RoundedBox>

                    {/* Keyboard Recessed Area (Solid accent color matching base top surface y=0.04) */}
                    <RoundedBox args={[1.4, 0.50, 0.015]} radius={0.04} smoothness={4} position={[0, 0.041, -0.035]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <primitive object={recessMaterial} attach="material" />
                    </RoundedBox>

                    {/* Trackpad (subtle inset: thinner panel, slightly sunken) */}
                    <RoundedBox args={[0.54, 0.30, 0.005]} radius={0.03} smoothness={4} position={[0, 0.037, 0.38]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <primitive object={trackpadMaterial} attach="material" />
                    </RoundedBox>

                    {/* Individual Keyboard Keys */}
                    <group ref={keysRef}>
                        {keyboardLayout.map((key) => (
                            <RoundedBox
                                key={key.id}
                                args={[key.isSpace ? 0.55 : 0.10, 0.10, 0.025]}
                                radius={0.035}
                                smoothness={3}
                                position={[key.x, 0.046, key.z]}
                                rotation={[-Math.PI / 2, 0, 0]}
                                castShadow
                            >
                                <primitive object={keyMaterial} attach="material" />
                            </RoundedBox>
                        ))}
                    </group>
                </group>

                {/* 2. Hinge & Lid Screen Assembly */}
                {/* Hinge axis placed at back-edge: y = 0.04, z = -0.50 */}
                <group ref={hingeGroupRef} position={[0, 0.04, -0.50]} rotation={[openAngle, 0, 0]}>
                    
                    {/* Compact Rounded hinges (matching Dark Graphite frame) */}
                    {/* Left hinge rounded capsule */}
                    <RoundedBox args={[0.14, 0.05, 0.05]} radius={0.02} smoothness={4} position={[-0.40, 0, 0]} castShadow>
                        <primitive object={bezelMaterial} attach="material" />
                    </RoundedBox>
                    {/* Right hinge rounded capsule */}
                    <RoundedBox args={[0.14, 0.05, 0.05]} radius={0.02} smoothness={4} position={[0.40, 0, 0]} castShadow>
                        <primitive object={bezelMaterial} attach="material" />
                    </RoundedBox>
                    {/* Thin connector rod */}
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.78, 16]} />
                        <primitive object={bezelMaterial} attach="material" />
                    </mesh>

                    {/* Lid Frame & Screen */}
                    {/* Center of the 1.04 height lid is at local z = 0.52, and y = 0.03 (offset above hinge base to clear keyboard) */}
                    <group position={[0, 0.03, 0.52]} rotation={[-Math.PI / 2, 0, 0]} onClick={toggleLid}>
                        {/* 2a. Beige Back Cover Layer (thinned to 0.02) */}
                        <RoundedBox args={[1.54, 1.04, 0.02]} radius={0.14} smoothness={4} position={[0, 0, 0.02]} castShadow receiveShadow>
                            <primitive object={baseMaterial} attach="material" />
                        </RoundedBox>

                        {/* 2b. Charcoal/Graphite Inner Front Bezel Layer (thinned to 0.02) */}
                        <RoundedBox args={[1.54, 1.04, 0.02]} radius={0.14} smoothness={4} position={[0, 0, 0.0]} castShadow receiveShadow>
                            <primitive object={bezelMaterial} attach="material" />
                        </RoundedBox>

                        {/* 2c. Screen Active Display Panel — expanded to 1.46×0.96 to reduce visible bezel border */}
                        <RoundedBox args={[1.46, 0.96, 0.005]} radius={0.08} smoothness={4} position={[0, 0, -0.011]} castShadow>
                            <primitive object={screenMaterial} attach="material" />
                        </RoundedBox>

                        {/* 2d. Premium Glass Screen Overlay */}
                        <RoundedBox args={[1.46, 0.96, 0.002]} radius={0.08} smoothness={4} position={[0, 0, -0.0125]} castShadow>
                            <primitive object={glassMaterial} attach="material" />
                        </RoundedBox>

                        {/* 2e. Camera Lens (metallic outer bezel and dark reflective lens core) */}
                        <mesh position={[0, -0.44, -0.0155]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.035, 0.035, 0.002, 32]} />
                            <primitive object={bezelMaterial} attach="material" />
                        </mesh>
                        <mesh position={[0, -0.44, -0.0166]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry args={[0.018, 0.018, 0.002, 32]} />
                            <meshBasicMaterial color="#1a1c1e" />
                        </mesh>
                    </group>
                </group>

                {/* Debug Port Spheres */}
                {showPorts && portsList.map((port) => (
                    <mesh key={`debug-port-${port.id}`} position={port.position}>
                        <sphereGeometry args={[0.04, 16, 16]} />
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
                    position={[0, 0.45, 0]}
                >
                    <boxGeometry args={[1.7, 1.00, 1.2]} />
                </mesh>
            )}
        </group>
    );
});

Laptop.displayName = "Laptop";

export default Laptop;
