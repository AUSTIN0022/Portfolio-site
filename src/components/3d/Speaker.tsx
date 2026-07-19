'use client';

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
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

const Speaker = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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
    const wooferRef = useRef<THREE.Group>(null);
    const tweeterRef = useRef<THREE.Group>(null);
    const kickIntensity = useRef(0);
    const [hovered, setHovered] = useState(false);

    // Define port configurations
    const portsList = useMemo((): ConnectorPort[] => [
        {
            id: "front",
            side: "front",
            position: [0, 0, 0.56],
            normal: [0, 0, 1],
            radius: 0.02,
        },
        {
            id: "back",
            side: "back",
            position: [0, 0, -0.56],
            normal: [0, 0, -1],
            radius: 0.02,
        },
        {
            id: "left",
            side: "left",
            position: [-0.6, 0, 0],
            normal: [-1, 0, 0],
            radius: 0.02,
        },
        {
            id: "right",
            side: "right",
            position: [0.6, 0, 0],
            normal: [1, 0, 0],
            radius: 0.02,
        },
    ], []);

    // Expose ports API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Speaker`);
            return port;
        },
        getConnectorPorts: () => portsList,
    }));

    // Resolve default rotation angle
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
    // Unified Warm Cream / Desert Sand color
    const desertSandColor = "#F1DEC4";

    const cabinetMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: desertSandColor,
        roughness: 0.18,
        metalness: 0.08,
    }), []);

    const baffleMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#222222",
        roughness: 0.85,
        metalness: 0.1,
    }), []);

    const darkGreyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: desertSandColor,
        roughness: 0.85,
        metalness: 0.1,
    }), [desertSandColor]);

    const darkBlackMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#111111",
        roughness: 0.7,
        metalness: 0.1,
    }), []);

    const greenLEDMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: "#2ecc71",
        emissive: "#2ecc71",
        emissiveIntensity: 0.8,
        roughness: 0.2,
    }), []);

    // Cabinet geometry: Target Width = 1.20, Height = 1.60, Depth = 1.10
    // Inputs (X: 1.54, Y: 1.94, Z: 1.10)
    const cabinetGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.54,
            height: 1.94,
            depth: 1.10,
            radius: 0.18,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Baffle geometry: Target Width = 1.08, Height = 1.48, Depth = 0.08
    // Inputs (X: 1.35, Y: 1.75, Z: 0.08)
    const baffleGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.35,
            height: 1.75,
            depth: 0.08,
            radius: 0.14,
            bevel: 0.005,
            segments: 16,
        });
    }, []);

    // Green capsule indicator LED geometry
    const greenCapsuleGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 0.156,
            height: 0.086,
            depth: 0.02,
            radius: 0.02,
            bevel: 0.002,
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

    // Pointer down kick trigger
    const triggerKick = () => {
        kickIntensity.current = 1.0;
    };

    // Frame animators
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

        // Rhythmic tempo pulse logic (~100 BPM baseline)
        const bpm = 100;
        const beatDuration = 60 / bpm;
        const beatProgress = (time % beatDuration) / beatDuration;
        const pulse = Math.max(0, Math.exp(-6 * beatProgress) * Math.sin(Math.PI * beatProgress));

        // Decay the click intensity
        kickIntensity.current = THREE.MathUtils.lerp(kickIntensity.current, 0, 0.15);

        // Combined pulse kick value
        const totalBeat = pulse * 0.15 + kickIntensity.current * 0.45;

        // Animate Woofer cone pushing out
        if (wooferRef.current) {
            wooferRef.current.position.z = frontZ + totalBeat * 0.08;
            wooferRef.current.scale.x = 1 + totalBeat * 0.04;
            wooferRef.current.scale.y = 1 + totalBeat * 0.04;
            wooferRef.current.scale.z = 1 - totalBeat * 0.15;
        }

        // Animate Tweeter vibrating at higher frequency
        if (tweeterRef.current) {
            const tweeterVibe = Math.sin(time * 75) * 0.015 * totalBeat;
            tweeterRef.current.position.z = frontZ + tweeterVibe;
        }
    });

    const baffleZ = 0.551;
    const frontZ = 0.591;

    return (
        <group ref={groupRef} position={position} rotation={initialRotation}>
            {/* Animating Hover/Tilt Container */}
            <group ref={hoverRef}>

                {/* 1. Outer Shell (Warm Cream, standing vertically) */}
                <mesh geometry={cabinetGeometry} castShadow receiveShadow>
                    <primitive object={cabinetMaterial} attach="material" />
                </mesh>

                {/* 2. Baffle Front Faceplate (overlayed on front face at z = 0.551) */}
                <mesh geometry={baffleGeometry} position={[0, 0, baffleZ]} castShadow receiveShadow>
                    <primitive object={baffleMaterial} attach="material" />
                </mesh>

                {/* 3. Tweeter Assembly (centered at y = 0.35, z = frontZ) */}
                <group ref={tweeterRef} position={[0, 0.35, frontZ]} rotation={[Math.PI / 2, 0, 0]}>
                    {/* Outer Bezel (funnel shape cone) */}
                    <mesh material={darkGreyMaterial} castShadow>
                        <cylinderGeometry args={[0.30, 0.20, 0.04, 32, 1, true]} />
                    </mesh>
                    {/* Mid surround ring */}
                    <mesh position={[0, -0.015, 0]} material={darkBlackMaterial}>
                        <cylinderGeometry args={[0.18, 0.18, 0.01, 32]} />
                    </mesh>
                    {/* Inner dome bulb (Cream color to match cabinet) */}
                    <mesh position={[0, 0.01, 0]} castShadow>
                        <sphereGeometry args={[0.10, 32, 32]} />
                        <primitive object={cabinetMaterial} attach="material" />
                    </mesh>
                </group>

                {/* 4. Woofer Assembly (centered at y = -0.25, z = frontZ) */}
                <group ref={wooferRef} position={[0, -0.25, frontZ]} rotation={[Math.PI / 2, 0, 0]}>
                    {/* Outer frame ring */}
                    <mesh material={darkGreyMaterial} castShadow>
                        <cylinderGeometry args={[0.45, 0.45, 0.02, 32, 1, true]} />
                    </mesh>
                    {/* Rubber suspension roll surround torus */}
                    <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} material={darkBlackMaterial} castShadow>
                        <torusGeometry args={[0.34, 0.04, 16, 64]} />
                    </mesh>
                    {/* Woofer paper cone (Cream color to match cabinet) */}
                    <mesh position={[0, -0.01, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.11, 0.30, 0.06, 32, 1, true]} />
                        <primitive object={cabinetMaterial} attach="material" />
                    </mesh>
                    {/* Center dust cap dome */}
                    <mesh position={[0, 0.015, 0]} material={darkBlackMaterial} castShadow>
                        <sphereGeometry args={[0.11, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    </mesh>
                </group>

                {/* 5. Bottom Details (Power LED capsule, volume knob, status LED) */}
                {/* Green capsule switch (bottom-left at x = -0.35, y = -0.60, z = frontZ + 0.005) */}
                <mesh
                    geometry={greenCapsuleGeometry}
                    position={[-0.35, -0.60, frontZ + 0.005]}
                    castShadow
                >
                    <primitive object={greenLEDMaterial} attach="material" />
                </mesh>

                {/* Volume Knob (bottom-right at x = 0.35, y = -0.60, z = frontZ) */}
                <group position={[0.35, -0.60, frontZ]} rotation={[Math.PI / 2, 0, 0]}>
                    {/* Main knob cylinder (Beige Ceramic) */}
                    <mesh castShadow>
                        <cylinderGeometry args={[0.08, 0.08, 0.04, 32]} />
                        <primitive object={cabinetMaterial} attach="material" />
                    </mesh>
                    {/* Pointer Slot marker */}
                    <mesh position={[0, 0.021, -0.04]} material={darkGreyMaterial}>
                        <boxGeometry args={[0.008, 0.003, 0.05]} />
                    </mesh>
                </group>

                {/* Tiny status LED (next to knob at x = 0.20, y = -0.60, z = frontZ + 0.005) */}
                <mesh position={[0.20, -0.60, frontZ + 0.005]}>
                    <sphereGeometry args={[0.02, 16, 16]} />
                    <primitive object={cabinetMaterial} attach="material" />
                </mesh>

                {/* 6. Feet (4 cylindrical isolator pads at y = -0.80, standing vertically) */}
                {[
                    [-0.40, -0.80, 0.35],
                    [0.40, -0.80, 0.35],
                    [-0.40, -0.80, -0.35],
                    [0.40, -0.80, -0.35]
                ].map(([fx, fy, fz], idx) => (
                    <mesh key={`foot-${idx}`} position={[fx, fy, fz]} material={darkGreyMaterial} castShadow>
                        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
                    </mesh>
                ))}

            </group>

            {/* Static Invisible Hitbox */}
            {interactive && (
                <mesh
                    visible={false}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        triggerKick();
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        setHovered(true);
                    }}
                    onPointerOut={(e) => {
                        e.stopPropagation();
                        setHovered(false);
                    }}
                    position={[0, 0, 0]}
                >
                    <boxGeometry args={[1.3, 1.8, 1.2]} />
                </mesh>
            )}
        </group>
    );
});

Speaker.displayName = "Speaker";

export default Speaker;
