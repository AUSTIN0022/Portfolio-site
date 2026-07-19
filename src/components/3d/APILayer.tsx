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

const APILayer = forwardRef<InfrastructureNodeRef, InfrastructureNodeProps>(({
  position = [0, 0, 0],
  rotation,
  scale = 1,
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

  // Define port configurations
  const portsList = useMemo((): ConnectorPort[] => [
    {
      id: "left",
      side: "left",
      position: [-1.0, -0.2, 0],
      normal: [-1, 0, 0],
      radius: 0.02,
    },
    {
      id: "right",
      side: "right",
      position: [1.0, -0.2, 0],
      normal: [1, 0, 0],
      radius: 0.02,
    },
    {
      id: "top",
      side: "top",
      position: [0, -0.2, -1.0],
      normal: [0, 0, -1],
      radius: 0.02,
    },
    {
      id: "bottom",
      side: "bottom",
      position: [0, -0.2, 1.0],
      normal: [0, 0, 1],
      radius: 0.02,
    },
  ], []);

  // Expose connector port query API
  useImperativeHandle(ref, () => ({
    getConnectorPort: (side) => {
      const port = portsList.find(p => p.side === side);
      if (!port) throw new Error(`Port side "${side}" does not exist on APILayer`);
      return port;
    },
    getConnectorPorts: () => portsList,
  }));

  // Resolve camera default isometric angle from reference image
  const initialRotation = useMemo((): [number, number, number] => {
    if (rotation) return rotation;
    switch (defaultView) {
      case "top":
        return [-Math.PI / 2, 0, 0];
      case "front":
        return [0, 0, 0];
      case "isometric":
      default:
        return [-20 * Math.PI / 180, 35 * Math.PI / 180, 0];
    }
  }, [rotation, defaultView]);

  // Memoize geometries for high-end rendering performance
  // NOTE: createRoundedBoxGeometry's width/height inputs render smaller than
  // passed in — it subtracts 2*radius then adds back 2*bevel, so the actual
  // final size is `input - 2*radius + 2*bevel`. Every sibling component
  // (AppServer, Cache, Workers, Monitoring, Queue) already compensates for
  // this (e.g. AppServer passes width:2.70 for a 2.0 final size); these two
  // were the one place in the file that didn't, so this block rendered at
  // 1.14 instead of the intended 2.0 — undersized relative to its own
  // portsList below (which is authored assuming a true 2.0 footprint).
  const topGeometry = useMemo(() => {
    return createRoundedBoxGeometry({
      width: 2.86, // 2.0 + 2*0.45 - 2*0.02
      height: 2.86,
      depth: 0.38,
      radius: 0.45,
      bevel: 0.02,
      segments: 16,
    });
  }, []);

  const bottomGeometry = useMemo(() => {
    return createRoundedBoxGeometry({
      width: 2.86,
      height: 2.86,
      depth: 0.28,
      radius: 0.45,
      bevel: 0.02,
      segments: 16,
    });
  }, []);

  const portGeometry = useMemo(() => {
    return createRoundedBoxGeometry({
      width: 0.12,
      height: 0.12,
      depth: 0.12,
      radius: 0.02,
      bevel: 0.005,
      segments: 4,
    });
  }, []);

  const connectorGeometry = useMemo(() => {
    return createRoundedBoxGeometry({
      width: 0.15,
      height: 0.15,
      depth: 0.15,
      radius: 0.03,
      bevel: 0.005,
      segments: 4,
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

  return (
    <group ref={groupRef} position={position} rotation={initialRotation}>
      {/* Animating Hover/Tilt Container */}
      <group ref={hoverRef}>
        
        {/* 1. Top White Ceramic Slab */}
        <mesh
          geometry={topGeometry}
          position={[0, 0.14, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <WhiteCeramic />
        </mesh>

        {/* 2. API LAYER Drei Text */}
        {showLabel && (
          <Text
            position={[0, 0.335, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.2}
            color="#111111"
            fontWeight={700}
            anchorX="center"
            anchorY="middle"
          >
            API LAYER
          </Text>
        )}

        {/* 3. Bottom Black Base Slab */}
        <mesh
          geometry={bottomGeometry}
          position={[0, -0.2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <BlackBase />
        </mesh>

        {/* 4. Detailed Port Connection Assembly (Right Side) */}
        <group position={[1.0, -0.2, 0]}>
          {/* Socket (Inset slightly into the black base) */}
          <mesh geometry={portGeometry} position={[-0.04, 0, 0]} castShadow>
            <meshStandardMaterial color="#333333" roughness={0.7} />
          </mesh>

          {/* Connector Plug (Light grey ceramic/plastic sleeve) */}
          <mesh geometry={connectorGeometry} position={[0.08, 0, 0]} castShadow>
            <meshStandardMaterial color="#CCCCCC" roughness={0.5} />
          </mesh>
        </group>

        {/* 5. Debug Port Spheres */}
        {showPorts && portsList.map((port) => (
          <mesh key={`debug-port-${port.id}`} position={port.position}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#FF3300" depthTest={false} transparent opacity={0.8} />
          </mesh>
        ))}

      </group>

      {/* 6. Static Invisible Hitbox */}
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
          position={[0, 0.065, 0]}
        >
          <boxGeometry args={[2.1, 0.75, 2.1]} />
        </mesh>
      )}
    </group>
  );
});

APILayer.displayName = "APILayer";

export default APILayer;
