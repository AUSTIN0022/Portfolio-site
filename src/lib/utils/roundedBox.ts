import * as THREE from 'three';

export interface RoundedBoxParams {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  bevel?: number;
  segments?: number;
}

/**
 * Creates a THREE.ExtrudeGeometry that forms a box with rounded edges and corners.
 * This is mathematically calibrated so the final dimensions match width, height, and depth.
 */
export function createRoundedBoxGeometry({
  width = 1,
  height = 1,
  depth = 1,
  radius = 0.1,
  bevel = 0.01,
  segments = 8
}: RoundedBoxParams = {}): THREE.ExtrudeGeometry {
  // Clamp radius and bevel to avoid negative or invalid geometries
  const safeRadius = Math.max(0, radius);
  const safeBevel = Math.max(0, Math.min(bevel, safeRadius));
  
  // The radius of the 2D shape's corner arcs
  const shapeRadius = Math.max(0, safeRadius - safeBevel);
  
  // Define 2D shape dimensions accounting for the corner radius
  const w = Math.max(0.001, width - 2 * safeRadius);
  const h = Math.max(0.001, height - 2 * safeRadius);
  const d = Math.max(0.001, depth - 2 * safeBevel);

  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;

  if (shapeRadius > 0) {
    shape.moveTo(x + shapeRadius, y);
    shape.lineTo(x + w - shapeRadius, y);
    shape.absarc(x + w - shapeRadius, y + shapeRadius, shapeRadius, Math.PI * 1.5, Math.PI * 2, false);
    shape.lineTo(x + w, y + h - shapeRadius);
    shape.absarc(x + w - shapeRadius, y + h - shapeRadius, shapeRadius, 0, Math.PI * 0.5, false);
    shape.lineTo(x + shapeRadius, y + h);
    shape.absarc(x + shapeRadius, y + h - shapeRadius, shapeRadius, Math.PI * 0.5, Math.PI, false);
    shape.lineTo(x, y + shapeRadius);
    shape.absarc(x + shapeRadius, y + shapeRadius, shapeRadius, Math.PI, Math.PI * 1.5, false);
  } else {
    // If shape radius is 0, draw a standard rectangle
    shape.moveTo(x, y);
    shape.lineTo(x + w, y);
    shape.lineTo(x + w, y + h);
    shape.lineTo(x, y + h);
    shape.closePath();
  }

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: d,
    steps: 1,
    bevelEnabled: safeBevel > 0,
    bevelSegments: segments,
    bevelSize: safeBevel,
    bevelThickness: safeBevel,
    curveSegments: segments,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  return geometry;
}
