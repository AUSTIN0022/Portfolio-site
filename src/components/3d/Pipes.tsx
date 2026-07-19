'use client';

import React, { useRef, useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { WhiteCeramic } from '@/components/materials/materials';

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

export interface PipesProps {
    type?: "horizontal" | "vertical" | "bent";
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    interactive?: boolean;
    floating?: boolean;
    defaultView?: "front" | "top" | "isometric";
    animationToggle?: boolean;
    showPorts?: boolean;
    /** Straight-run length for the `horizontal` type (default 2.0). Tube radius stays constant. */
    length?: number;
    /** Show the white ceramic collar at the run's centre (default true). */
    showCollar?: boolean;
}

export interface PipesRef {
    getConnectorPort: (side: "left" | "right" | "top" | "bottom") => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

const Pipes = forwardRef<PipesRef, PipesProps>(({
    type = "horizontal",
    position = [0, 0, 0],
    rotation,
    scale = 1.0,
    interactive = true,
    floating = true,
    defaultView = "isometric",
    animationToggle = true,
    showPorts = false,
    length = 2.0,
    showCollar = true,
}, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const hoverRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    // Resolve ports based on pipe type
    const portsList = useMemo((): ConnectorPort[] => {
        switch (type) {
            case "vertical":
                return [
                    {
                        id: "top",
                        side: "top",
                        position: [0, 1.0, 0],
                        normal: [0, 1, 0],
                        radius: 0.02,
                    },
                    {
                        id: "bottom",
                        side: "bottom",
                        position: [0, -1.0, 0],
                        normal: [0, -1, 0],
                        radius: 0.02,
                    },
                ];
            case "bent":
                return [
                    {
                        id: "left",
                        side: "left",
                        position: [-1.0, 0.5, 0],
                        normal: [-1, 0, 0],
                        radius: 0.02,
                    },
                    {
                        id: "bottom",
                        side: "bottom",
                        position: [1.0, -1.0, 0],
                        normal: [0, -1, 0],
                        radius: 0.02,
                    },
                ];
            case "horizontal":
            default:
                return [
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
                ];
        }
    }, [type]);

    // Expose ports query API
    useImperativeHandle(ref, () => ({
        getConnectorPort: (side) => {
            const port = portsList.find(p => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on Pipes type "${type}"`);
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

    // Float and rotation logic
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

    // Connector fitting geometry:
    // Collar: radius 0.15, length 0.24
    // Stepped rings: radius 0.11, length 0.06
    const connectorCollarGeom = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 0.24, 32), []);
    const connectorRingGeom = useMemo(() => new THREE.CylinderGeometry(0.11, 0.11, 0.06, 32), []);

    // Glass material (greyish transparent glass)
    const glassMaterial = (
        <meshPhysicalMaterial
            color="#666666"
            roughness={0.05}
            metalness={0.1}
            transmission={0.92}
            thickness={0.15}
            ior={1.5}
            clearcoat={1.0}
            clearcoatRoughness={0.05}
            transparent={true}
            opacity={0.9}
        />
    );

    // Connector helper component
    const Connector = ({ pos = [0, 0, 0], rot = [0, 0, 0] }: { pos?: [number, number, number], rot?: [number, number, number] }) => (
        <group position={pos} rotation={rot}>
            <mesh geometry={connectorCollarGeom} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            <mesh geometry={connectorRingGeom} position={[0, 0.15, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
            <mesh geometry={connectorRingGeom} position={[0, -0.15, 0]} castShadow receiveShadow>
                <WhiteCeramic />
            </mesh>
        </group>
    );

    return (
        <group ref={groupRef} position={position} rotation={initialRotation}>
            {/* Animating Hover/Tilt Container */}
            <group ref={hoverRef}>

                {/* Render based on pipe type */}
                {type === "horizontal" && (
                    <group>
                        {/* Main Pipe Cylinder — length is configurable, radius stays constant */}
                        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.08, 0.08, length, 32]} />
                            {glassMaterial}
                        </mesh>
                        {/* Center Connector */}
                        {showCollar && <Connector rot={[0, 0, Math.PI / 2]} />}
                    </group>
                )}

                {type === "vertical" && (
                    <group>
                        {/* Main Pipe Cylinder */}
                        <mesh castShadow receiveShadow>
                            <cylinderGeometry args={[0.08, 0.08, 2.0, 32]} />
                            {glassMaterial}
                        </mesh>
                        {/* Center Connector */}
                        <Connector />
                    </group>
                )}

                {type === "bent" && (
                    <group>
                        {/* Horizontal Pipe segment (x = -1.0 to 0.5, centered at -0.25) */}
                        <mesh position={[-0.25, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.08, 0.08, 1.5, 32]} />
                            {glassMaterial}
                        </mesh>
                        {/* Horizontal Connector */}
                        <Connector pos={[-0.25, 0.5, 0]} rot={[0, 0, Math.PI / 2]} />

                        {/* Corner Bend 90 degrees (centered at 0.5, 0.0) */}
                        <mesh position={[0.5, 0.0, 0]} castShadow receiveShadow>
                            <torusGeometry args={[0.5, 0.08, 16, 64, Math.PI / 2]} />
                            {glassMaterial}
                        </mesh>

                        {/* Vertical Pipe segment (y = 0.0 to -1.0, centered at -0.5) */}
                        <mesh position={[1.0, -0.5, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.08, 0.08, 1.0, 32]} />
                            {glassMaterial}
                        </mesh>
                        {/* Vertical Connector */}
                        <Connector pos={[1.0, -0.5, 0]} />
                    </group>
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
                    position={type === "bent" ? [0.25, -0.15, 0] : [0, 0, 0]}
                >
                    <boxGeometry args={type === "bent" ? [2.1, 1.8, 0.5] : [2.1, 2.1, 0.5]} />
                </mesh>
            )}
        </group>
    );
});

// Export helper sub-components for direct semantic usage
export const HorizontalPipe = forwardRef<PipesRef, Omit<PipesProps, "type">>((props, ref) => (
    <Pipes ref={ref} type="horizontal" {...props} />
));
export const VerticalPipe = forwardRef<PipesRef, Omit<PipesProps, "type">>((props, ref) => (
    <Pipes ref={ref} type="vertical" {...props} />
));
export const BentPipe = forwardRef<PipesRef, Omit<PipesProps, "type">>((props, ref) => (
    <Pipes ref={ref} type="bent" {...props} />
));

Pipes.displayName = "Pipes";
HorizontalPipe.displayName = "HorizontalPipe";
VerticalPipe.displayName = "VerticalPipe";
BentPipe.displayName = "BentPipe";

export default Pipes;
export { Pipes as PipesComponent };
