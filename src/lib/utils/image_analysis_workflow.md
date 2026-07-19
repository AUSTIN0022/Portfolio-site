# 3D Component Image-Analysis & Reconstruction Workflow

This document details the visual engineering workflow used to analyze 2D source product images from `/item-images` and reconstruct them as interactive, pixel-perfect 3D components in React Three Fiber.

---

## 1. Geometry & Dimension Extraction

For any target component, perform a visual analysis to extract bounding dimensions:
1. **Aspect Ratio**: Determine if the component is square (1:1 footprint, e.g., API Layer, Load Balancer) or rectangular (e.g., Instance).
2. **Width & Depth**: Map standard square bases to `2.0 x 2.0` units and rectangles proportionally (e.g., `2.2 x 1.6`).
3. **Corner Radius**: Estimate the corner rounding. Standard blocks have a corner radius of `0.3` to `0.4` units.
4. **Bevel Depth**: Estimate the bevel depth of edges (usually `0.01` to `0.02` units).

---

## 2. Layer & Height Decomposition

Deconstruct stacked components vertically into distinct meshes:
- **Base Height**: Measure the ratio of the black base to the ceramic top (e.g., black base = `0.3` units, ceramic cap = `0.5` units).
- **Spacers**: Identify thin spacer slices (e.g., the yellow trim on `Instance` or `WorkersBlock`) which are typically `0.04` to `0.05` units tall.
- **Engraved Insets**: Check for inset elements (like the recessed center on the `AppServer` or the sloped quadrant on the `Monitoring` module) and model them by combining multiple primitives or using custom extruded paths.

---

## 3. Material Calibration

Ensure exact PBR parameter match for each layer:
1. **White Ceramic**: Use color `#F5F3EF` with `getCeramicTexture()` as the map, roughness `0.65`, metalness `0`.
2. **Wood**: Use `getWoodTexture()` with roughness `0.8`, metalness `0`. Orient grain horizontally.
3. **Black Base**: Use color `#1E1E1E`, roughness `0.9`, metalness `0`.
4. **Yellow Accent**: Use color `#FFD600`, roughness `0.5`, metalness `0`.
5. **Translucent Glass (e.g. Cache)**: Use Drei's `<MeshTransmissionMaterial>` with:
   - `transmission={0.95}`
   - `roughness={0.15}`
   - `thickness={0.5}`
   - `ior={1.45}`
   - `color="#7BF1A8"` (translucent green)

---

## 4. Typography & Label Placement

To match labels on top/front faces:
1. **Font Style**: Use a bold, uppercase, geometric sans-serif font (e.g., Arial, Inter, or Helvetica Bold).
2. **Implementation**: Use Drei's `<Text>` component:
   - Attach directly to the face of the ceramic block.
   - Offset it slightly along the surface normal (e.g., `z={0.005}` or `y={0.005}`) to prevent z-fighting.
   - Adjust `fontSize` (standard size is `0.18` to `0.22` units), `color="black"`, and `anchorX="center"`, `anchorY="middle"`.

---

## 5. Port & Accessory Modeling

Model small connectors and details:
- **Cable Connectors**: Model sockets as small grey rounded boxes (e.g., `0.15` units) with a thin cylinder representing the grey cable extending outwards.
- **Dial Wedges**: For segment lines (like the `Load Balancer` dial), use multiple thin, dark grey cylinders slightly raised above the dial surface, or draw lines using a custom canvas texture mapping.
- **Indicator LEDs**: Use small spheres or capsules with self-emissive materials (e.g., green emissive `#39FF14` with `emissiveIntensity={1.5}`) to represent active indicators.

---

## 6. Interaction & Animation Rigging

Make each component responsive and alive:
1. **GSAP Intro**: On component mount, animate the scale from `0` to `1` with an elastic bounce (`elastic.out(1, 0.75)`) and a subtle rotation.
2. **Idle Float**: Inside a `useFrame` loop, oscillate the component's vertical position and rotation using sine waves:
   - `group.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.05`
   - `group.current.rotation.y += 0.002`
3. **Smooth Hover**: On pointer hover:
   - Scale up the model by `1.05x` using GSAP or Framer Motion / React Spring.
   - Rotate the component slightly toward the user's cursor to create a responsive physical interaction.
   - Restore original state when pointer leaves.

---

## 7. Comparative Visual Verification

Validate against the source image:
- Render the 3D model and place it adjacent to its source image.
- Compare light source angles, shadow softness, text weights, material glossiness/specular highlights, and corners.
- Iterate on spacing, scale parameters, and roughness values until the similarity index exceeds 95%.
