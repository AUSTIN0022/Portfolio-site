'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic } from '@/components/materials/materials';

export interface RoundedInfrastructureBlockProps {
  width?: number;
  depth?: number;
  height?: number;
  radius?: number;
  groove?: boolean;
  grooveDepth?: number;
  grooveWidth?: number;
  centerPlatform?: boolean;
  segmentation?: boolean;
  position?: [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  children?: React.ReactNode;
}

export default function RoundedInfrastructureBlock({
  width = 2.0,
  depth = 2.0,
  height = 0.38,
  radius = 0.45,
  groove = true,
  grooveDepth = 0.04,
  grooveWidth = 0.025,
  centerPlatform = true,
  segmentation = true,
  position = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
  children,
}: RoundedInfrastructureBlockProps) {
  // Proportional metrics
  const borderThickness = 0.125 * width; // 0.25 for width=2.0
  const mainSlabHeight = height - (groove ? grooveDepth : 0);

  // Main solid white body geometry (Layer 2)
  const bodyGeometry = useMemo(() => {
    return createRoundedBoxGeometry({
      width: width,
      height: depth,
      depth: mainSlabHeight,
      radius: radius,
      bevel: 0.02,
      segments: 16,
    });
  }, [width, depth, mainSlabHeight, radius]);

  // Outer border ring geometry with optional slots (Layer 3)
  const outerBorderGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const halfW = width / 2;
    const halfD = depth / 2;
    const arcCenterOffsetW = halfW - radius;
    const arcCenterOffsetD = halfD - radius;

    const slotW = 0.008 * (width / 2.0);
    const slotD = borderThickness;

    // Detour coordinates (scaled by dimension factor)
    const dVal = 0.3 * (width / 2.0);

    // Start at bottom-right corner outer edge (clockwise rotation mapping)
    shape.moveTo(halfW, -arcCenterOffsetD);

    // Right Edge (going up)
    if (segmentation) {
      shape.lineTo(halfW, -dVal - slotW / 2);
      shape.lineTo(halfW - slotD, -dVal - slotW / 2);
      shape.lineTo(halfW - slotD, -dVal + slotW / 2);
      shape.lineTo(halfW, -dVal + slotW / 2);

      shape.lineTo(halfW, -slotW / 2);
      shape.lineTo(halfW - slotD, -slotW / 2);
      shape.lineTo(halfW - slotD, slotW / 2);
      shape.lineTo(halfW, slotW / 2);

      shape.lineTo(halfW, dVal - slotW / 2);
      shape.lineTo(halfW - slotD, dVal - slotW / 2);
      shape.lineTo(halfW - slotD, dVal + slotW / 2);
      shape.lineTo(halfW, dVal + slotW / 2);
    }
    shape.lineTo(halfW, arcCenterOffsetD);

    // Top-Right Corner Arc
    shape.absarc(arcCenterOffsetW, arcCenterOffsetD, radius, 0, Math.PI / 2, false);

    // Top Edge (going left)
    if (segmentation) {
      shape.lineTo(dVal + slotW / 2, halfD);
      shape.lineTo(dVal + slotW / 2, halfD - slotD);
      shape.lineTo(dVal - slotW / 2, halfD - slotD);
      shape.lineTo(dVal - slotW / 2, halfD);

      shape.lineTo(slotW / 2, halfD);
      shape.lineTo(slotW / 2, halfD - slotD);
      shape.lineTo(-slotW / 2, halfD - slotD);
      shape.lineTo(-slotW / 2, halfD);

      shape.lineTo(-dVal + slotW / 2, halfD);
      shape.lineTo(-dVal + slotW / 2, halfD - slotD);
      shape.lineTo(-dVal - slotW / 2, halfD - slotD);
      shape.lineTo(-dVal - slotW / 2, halfD);
    }
    shape.lineTo(-arcCenterOffsetW, halfD);

    // Top-Left Corner Arc
    shape.absarc(-arcCenterOffsetW, arcCenterOffsetD, radius, Math.PI / 2, Math.PI, false);

    // Left Edge (going down)
    if (segmentation) {
      shape.lineTo(-halfW, dVal + slotW / 2);
      shape.lineTo(-halfW + slotD, dVal + slotW / 2);
      shape.lineTo(-halfW + slotD, dVal - slotW / 2);
      shape.lineTo(-halfW, dVal - slotW / 2);

      shape.lineTo(-halfW, slotW / 2);
      shape.lineTo(-halfW + slotD, slotW / 2);
      shape.lineTo(-halfW + slotD, -slotW / 2);
      shape.lineTo(-halfW, -slotW / 2);

      shape.lineTo(-halfW, -dVal + slotW / 2);
      shape.lineTo(-halfW + slotD, -dVal + slotW / 2);
      shape.lineTo(-halfW + slotD, -dVal - slotW / 2);
      shape.lineTo(-halfW, -dVal - slotW / 2);
    }
    shape.lineTo(-halfW, -arcCenterOffsetD);

    // Bottom-Left Corner Arc
    shape.absarc(-arcCenterOffsetW, -arcCenterOffsetD, radius, Math.PI, 1.5 * Math.PI, false);

    // Bottom Edge (going right)
    if (segmentation) {
      shape.lineTo(-dVal - slotW / 2, -halfD);
      shape.lineTo(-dVal - slotW / 2, -halfD + slotD);
      shape.lineTo(-dVal + slotW / 2, -halfD + slotD);
      shape.lineTo(-dVal + slotW / 2, -halfD);

      shape.lineTo(-slotW / 2, -halfD);
      shape.lineTo(-slotW / 2, -halfD + slotD);
      shape.lineTo(slotW / 2, -halfD + slotD);
      shape.lineTo(slotW / 2, -halfD);

      shape.lineTo(dVal - slotW / 2, -halfD);
      shape.lineTo(dVal - slotW / 2, -halfD + slotD);
      shape.lineTo(dVal + slotW / 2, -halfD + slotD);
      shape.lineTo(dVal + slotW / 2, -halfD);
    }
    shape.lineTo(arcCenterOffsetW, -halfD);

    // Bottom-Right Corner Arc
    shape.absarc(arcCenterOffsetW, -arcCenterOffsetD, radius, 1.5 * Math.PI, 2 * Math.PI, false);

    // Inner Hole for platform gap (drawn clockwise to subtract)
    const hole = new THREE.Path();
    const holeRadius = radius * (halfW - borderThickness) / halfW;
    const holeW = halfW - borderThickness;
    const holeD = halfD - borderThickness;
    const holeCenterW = holeW - holeRadius;
    const holeCenterD = holeD - holeRadius;

    hole.moveTo(-holeW, -holeCenterD);
    hole.lineTo(-holeW, holeCenterD);
    hole.absarc(-holeCenterW, holeCenterD, holeRadius, Math.PI, Math.PI / 2, true);
    hole.lineTo(holeCenterW, holeD);
    hole.absarc(holeCenterW, holeCenterD, holeRadius, Math.PI / 2, 0, true);
    hole.lineTo(holeW, -holeCenterD);
    hole.absarc(holeCenterW, -holeCenterD, holeRadius, 0, 1.5 * Math.PI, true);
    hole.lineTo(-holeCenterW, -holeD);
    hole.absarc(-holeCenterW, -holeCenterD, holeRadius, 1.5 * Math.PI, Math.PI, true);
    hole.closePath();

    shape.holes.push(hole);

    const bevel = 0.012;
    return new THREE.ExtrudeGeometry(shape, {
      depth: grooveDepth - 2 * bevel,
      bevelEnabled: true,
      bevelSegments: 8,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 12,
    });
  }, [width, depth, radius, borderThickness, grooveDepth, segmentation]);

  // Layer 4: Large Raised Center Platform geometry
  const centerPlatformGeometry = useMemo(() => {
    const pWidth = width - 2 * borderThickness - grooveWidth;
    const pDepth = depth - 2 * borderThickness - grooveWidth;
    return createRoundedBoxGeometry({
      width: pWidth,
      height: pDepth,
      depth: grooveDepth,
      radius: radius * (pWidth / width),
      bevel: 0.012,
      segments: 12,
    });
  }, [width, depth, borderThickness, grooveWidth, grooveDepth, radius]);

  // Calculate vertical Y offsets
  const bodyY = mainSlabHeight / 2 - height / 2;
  const borderY = mainSlabHeight + grooveDepth / 2 - height / 2;

  return (
    <group position={position}>
      {/* Layer 2: Main Solid White Body */}
      <mesh
        geometry={bodyGeometry}
        position={[0, bodyY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      >
        <WhiteCeramic />
      </mesh>

      {/* Layer 3 & 4: Border Ring & Center Platform */}
      {groove && (
        <>
          <mesh
            geometry={outerBorderGeometry}
            position={[0, borderY, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            <WhiteCeramic />
          </mesh>

          {centerPlatform && (
            <mesh
              geometry={centerPlatformGeometry}
              position={[0, borderY, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              castShadow={castShadow}
              receiveShadow={receiveShadow}
            >
              <WhiteCeramic />
            </mesh>
          )}
        </>
      )}

      {/* Render children (like text labels) relative to the top surface face */}
      <group position={[0, height / 2, 0]}>
        {children}
      </group>
    </group>
  );
}
