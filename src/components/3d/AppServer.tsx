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

const AppServer = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
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

    // Define port configurations flush on outer surfaces
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
            if (!port) throw new Error(`Port side "${side}" does not exist on AppServer`);
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

    // Layer 1: Black Rounded Base Geometry (100 x 100 x 12, radius 18)
    const bottomGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70, // 2.0 + 2 * 0.36 - 2 * 0.01 = 2.70
            height: 2.70, // 2.0 + 2 * 0.36 - 2 * 0.01 = 2.70
            depth: 0.24,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Layer 2: Main Solid White Rounded Square Body (100 x 100 x 23, radius 18)
    const bodyGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 2.70, // 2.0 + 2 * 0.36 - 2 * 0.01 = 2.70
            height: 2.70, // 2.0 + 2 * 0.36 - 2 * 0.01 = 2.70
            depth: 0.46,
            radius: 0.36,
            bevel: 0.01,
            segments: 16,
        });
    }, []);

    // Layer 3: Outer Border Ring Shape with a hole (100 x 100 x 1, thickness 18.75, radius 18, inner hole 62.5 x 62.5, radius 10)
    const outerBorderGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        const r = 0.36; // 18 * 0.02
        const w = 1.0;
        const c = w - r;

        // Outer boundary (counter-clockwise)
        shape.moveTo(w, -c);
        shape.lineTo(w, c);
        shape.absarc(c, c, r, 0, Math.PI / 2, false);
        shape.lineTo(-c, w);
        shape.absarc(-c, c, r, Math.PI / 2, Math.PI, false);
        shape.lineTo(-w, -c);
        shape.absarc(-c, -c, r, Math.PI, 1.5 * Math.PI, false);
        shape.lineTo(c, -w);
        shape.absarc(c, -c, r, 1.5 * Math.PI, 2 * Math.PI, false);

        // Inner Hole boundary (clockwise, size 1.25 x 1.25, corner radius 0.20)
        const hole = new THREE.Path();
        const hr = 0.20;
        const hw = 0.625;
        const hc = hw - hr;

        hole.moveTo(-hw, -hc);
        hole.lineTo(-hw, hc);
        hole.absarc(-hc, hc, hr, Math.PI, Math.PI / 2, true);
        hole.lineTo(hc, hw);
        hole.absarc(hc, hc, hr, Math.PI / 2, 0, true);
        hole.lineTo(hw, -hc);
        hole.absarc(hc, -hc, hr, 0, 1.5 * Math.PI, true);
        hole.lineTo(-hc, -hw);
        hole.absarc(-hc, -hc, hr, 1.5 * Math.PI, Math.PI, true);
        hole.closePath();

        shape.holes.push(hole);

        return new THREE.ExtrudeGeometry(shape, {
            depth: 0.02, // 1 * 0.02 (reduced by 50%)
            bevelEnabled: false,
            curveSegments: 16,
        });
    }, []);

    // Layer 4: Center Platform Inner Platform (54.5 x 54.5, height 3.9 above outer rim)
    const innerPlatformGeometry = useMemo(() => {
        return createRoundedBoxGeometry({
            width: 1.32, // 1.09 + 2 * 0.12 - 2 * 0.005 = 1.32
            height: 1.32, // 1.09 + 2 * 0.12 - 2 * 0.005 = 1.32
            depth: 0.098,
            radius: 0.12,
            bevel: 0.005,
            segments: 16,
        });
    }, []);

    // Layer 5: Center Platform Outer Ring (from 70.5 to 77)
    const outerPlatformRingGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        const r = 0.28;
        const w = 0.77;
        const c = w - r;

        // Outer boundary (counter-clockwise)
        shape.moveTo(w, -c);
        shape.lineTo(w, c);
        shape.absarc(c, c, r, 0, Math.PI / 2, false);
        shape.lineTo(-c, w);
        shape.absarc(-c, c, r, Math.PI / 2, Math.PI, false);
        shape.lineTo(-w, -c);
        shape.absarc(-c, -c, r, Math.PI, 1.5 * Math.PI, false);
        shape.lineTo(c, -w);
        shape.absarc(c, -c, r, 1.5 * Math.PI, 2 * Math.PI, false);

        // Inner Hole (clockwise, size 1.41 x 1.41)
        const hole = new THREE.Path();
        const hr = 0.24;
        const hw = 0.705;
        const hc = hw - hr;

        hole.moveTo(-hw, -hc);
        hole.lineTo(-hw, hc);
        hole.absarc(-hc, hc, hr, Math.PI, Math.PI / 2, true);
        hole.lineTo(hc, hw);
        hole.absarc(hc, hc, hr, Math.PI / 2, 0, true);
        hole.lineTo(hw, -hc);
        hole.absarc(hc, -hc, hr, 0, 1.5 * Math.PI, true);
        hole.lineTo(-hc, -hw);
        hole.absarc(-hc, -hc, hr, 1.5 * Math.PI, Math.PI, true);
        hole.closePath();

        shape.holes.push(hole);

        return new THREE.ExtrudeGeometry(shape, {
            depth: 0.098,
            bevelEnabled: false,
            curveSegments: 16,
        });
    }, []);

    // Layer 6: Groove Bottom Ring (from 54.5 to 70.5)
    const grooveBottomGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        const r = 0.24;
        const w = 0.705;
        const c = w - r;

        // Outer boundary (counter-clockwise)
        shape.moveTo(w, -c);
        shape.lineTo(w, c);
        shape.absarc(c, c, r, 0, Math.PI / 2, false);
        shape.lineTo(-c, w);
        shape.absarc(-c, c, r, Math.PI / 2, Math.PI, false);
        shape.lineTo(-w, -c);
        shape.absarc(-c, -c, r, Math.PI, 1.5 * Math.PI, false);
        shape.lineTo(c, -w);
        shape.absarc(c, -c, r, 1.5 * Math.PI, 2 * Math.PI, false);

        // Inner Hole (clockwise, size 1.09 x 1.09)
        const hole = new THREE.Path();
        const hr = 0.16;
        const hw = 0.545;
        const hc = hw - hr;

        hole.moveTo(-hw, -hc);
        hole.lineTo(-hw, hc);
        hole.absarc(-hc, hc, hr, Math.PI, Math.PI / 2, true);
        hole.lineTo(hc, hw);
        hole.absarc(hc, hc, hr, Math.PI / 2, 0, true);
        hole.lineTo(hw, -hc);
        hole.absarc(hc, -hc, hr, 0, 1.5 * Math.PI, true);
        hole.lineTo(-hc, -hw);
        hole.absarc(-hc, -hc, hr, 1.5 * Math.PI, Math.PI, true);
        hole.closePath();

        shape.holes.push(hole);

        return new THREE.ExtrudeGeometry(shape, {
            depth: 0.078, // 0.098 - 0.02
            bevelEnabled: false,
            curveSegments: 16,
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

    // Float animation loop
    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        if (groupRef.current) {
            if (floating && animationToggle) {
                groupRef.current.position.y = position[1] + Math.sin(time * 1.5) * 0.03;
                groupRef.current.rotation.y = initialRotation[1] + Math.cos(time * 0.6) * 0.02;
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

    const cutColor = "#D5CEBD";

    return (
        <group ref={groupRef} position={position} rotation={initialRotation}>
            {/* Animating Hover/Tilt Container */}
            <group ref={hoverRef}>

                {/* Layer 2: Main Solid White Rounded Square Body (from y = 0.0 to y = 0.46) */}
                <mesh
                    geometry={bodyGeometry}
                    position={[0, 0.23, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 3: Outer Border Rim (flush on top of body, from y = 0.46 to y = 0.48) */}
                <mesh
                    geometry={outerBorderGeometry}
                    position={[0, 0.46, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 4: Center Platform Outer Ring (rises from y = 0.46 to y = 0.558) */}
                <mesh
                    geometry={outerPlatformRingGeometry}
                    position={[0, 0.46, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 5: Center Platform Inner Platform (rises from y = 0.46 to y = 0.558) */}
                <mesh
                    geometry={innerPlatformGeometry}
                    position={[0, 0.509, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Layer 6: Groove Bottom Ring (rises from y = 0.46 to y = 0.538) */}
                <mesh
                    geometry={grooveBottomGeometry}
                    position={[0, 0.46, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <WhiteCeramic />
                </mesh>

                {/* Decorative Segmentation Cuts (8 lines engraved around perimeter) */}
                <group>
                    {/* Front and Back Vertical Cuts */}
                    {[-0.35, 0.35].map((x) => (
                        <React.Fragment key={`fb-cuts-${x}`}>
                            <mesh position={[x, 0.23, 1.001]} castShadow>
                                <boxGeometry args={[0.008, 0.46, 0.004]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                            <mesh position={[x, 0.4805, 0.885]} castShadow>
                                <boxGeometry args={[0.008, 0.002, 0.23]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                            <mesh position={[x, 0.23, -1.001]} castShadow>
                                <boxGeometry args={[0.008, 0.46, 0.004]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                            <mesh position={[x, 0.4805, -0.885]} castShadow>
                                <boxGeometry args={[0.008, 0.002, 0.23]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                        </React.Fragment>
                    ))}

                    {/* Left and Right Vertical Cuts */}
                    {[-0.35, 0.35].map((z) => (
                        <React.Fragment key={`lr-cuts-${z}`}>
                            <mesh position={[-1.001, 0.23, z]} castShadow>
                                <boxGeometry args={[0.004, 0.46, 0.008]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                            <mesh position={[-0.885, 0.4805, z]} castShadow>
                                <boxGeometry args={[0.23, 0.002, 0.008]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                            <mesh position={[1.001, 0.23, z]} castShadow>
                                <boxGeometry args={[0.004, 0.46, 0.008]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                            <mesh position={[0.885, 0.4805, z]} castShadow>
                                <boxGeometry args={[0.23, 0.002, 0.008]} />
                                <meshBasicMaterial color={cutColor} />
                            </mesh>
                        </React.Fragment>
                    ))}
                </group>

                {/* Layer 7: APP SERVER Typography (centered flat on top of platform) */}
                {showLabel && (
                    <Text
                        position={[0, 0.563, 0]} // sits flat on top of platform (y = 0.558 + 0.005)
                        rotation={[-Math.PI / 2, 0, 0]}
                        fontSize={0.12}
                        color="#111111"
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        APP SERVER
                    </Text>
                )}

                {/* Layer 1: Black Base (from y = -0.24 to y = 0.0) */}
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
                    position={[0, 0.16, 0]}
                >
                    <boxGeometry args={[2.1, 0.80, 2.1]} />
                </mesh>
            )}
        </group>
    );
});

AppServer.displayName = "AppServer";

export default AppServer;
