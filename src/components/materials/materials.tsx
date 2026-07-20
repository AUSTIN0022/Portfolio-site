import * as THREE from 'three';

// Procedural maps are authored at 1024² rather than 512². The hero blocks fill a
// large part of a 2x-DPR canvas, so at 512 the ceramic speckle and wood grain were
// being magnified past their texel density and read as mush.
const TEX_SIZE = 1024;

/**
 * Shared finishing pass for every procedurally-drawn map.
 *
 * The critical bit is `colorSpace`. A 2D canvas is painted in sRGB, but since
 * three r152 a texture defaults to `NoColorSpace` — i.e. three assumes the values
 * are ALREADY linear and skips the sRGB→linear decode. Feeding sRGB bytes into the
 * lighting math unconverted is what made the ceramic read washed-out and faintly
 * blue-grey instead of warm off-white. Albedo maps must be tagged SRGBColorSpace.
 *
 * Anisotropy matters here too: the hero camera views the blocks at a shallow
 * isometric angle, exactly the case where isotropic mip filtering over-blurs.
 * three clamps this to the device's real max at upload, so 8 is safe everywhere.
 */
function finishTexture(texture: THREE.CanvasTexture): THREE.CanvasTexture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Procedural Ceramic Texture (Speckled off-white)
let cachedCeramicTexture: THREE.CanvasTexture | null = null;
export function getCeramicTexture(): THREE.CanvasTexture | null {
  if (typeof window === 'undefined') return null;
  if (cachedCeramicTexture) return cachedCeramicTexture;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const S = TEX_SIZE;
  // Density factors keep the grain/speckle SIZE constant in texel-space as the
  // texture resolution grows, so a bigger map means finer detail, not bigger blobs.
  const k = (S / 512) ** 2;

  // Base off-white ceramic: #F4F1EC (warm beige premium tone)
  ctx.fillStyle = '#F4F1EC';
  ctx.fillRect(0, 0, S, S);

  // Subtle warm beige noise/grain
  ctx.fillStyle = 'rgba(215, 200, 180, 0.05)';
  for (let i = 0; i < 40000 * k; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.fillRect(x, y, 1, 1);
  }

  // Soft barely-visible speckles (warm brown/stone speckles)
  ctx.fillStyle = 'rgba(150, 135, 115, 0.06)';
  for (let i = 0; i < 1000 * k; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const size = (Math.random() * 1.2 + 0.4) * (S / 512);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  cachedCeramicTexture = finishTexture(new THREE.CanvasTexture(canvas));
  return cachedCeramicTexture;
}

// Procedural Oak Wood Texture
let cachedWoodTexture: THREE.CanvasTexture | null = null;
export function getWoodTexture(): THREE.CanvasTexture | null {
  if (typeof window === 'undefined') return null;
  if (cachedWoodTexture) return cachedWoodTexture;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const S = TEX_SIZE;
  const s = S / 512; // scale factor so the grain keeps its proportions at any size
  ctx.lineJoin = 'round';

  // Background light oak warm color: #E5C296
  ctx.fillStyle = '#E5C296';
  ctx.fillRect(0, 0, S, S);

  // Broad grain waves
  ctx.strokeStyle = 'rgba(165, 110, 60, 0.2)';
  ctx.lineWidth = 3 * s;
  for (let i = -10; i < 110; i++) {
    ctx.beginPath();
    const startY = (i / 100) * S;
    ctx.moveTo(0, startY);
    // Step in 5px screen-space increments so the sine is sampled finely enough
    // that the grain stays a smooth curve instead of visible line segments.
    for (let x = 0; x <= S; x += 5) {
      const y = startY + Math.sin((x / s) * 0.015) * 12 * s + Math.cos((x / s) * 0.005) * 8 * s;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Fine dark grain lines
  ctx.strokeStyle = 'rgba(110, 70, 35, 0.3)';
  ctx.lineWidth = 1 * s;
  for (let i = 0; i < 40 * s; i++) {
    ctx.beginPath();
    const startY = Math.random() * (600 * s) - 50 * s;
    ctx.moveTo(0, startY);
    for (let x = 0; x <= S; x += 5) {
      const y = startY + Math.sin((x / s) * 0.015) * 12 * s + Math.cos((x / s) * 0.005) * 8 * s;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  cachedWoodTexture = finishTexture(new THREE.CanvasTexture(canvas));
  return cachedWoodTexture;
}

// Pre-configured shared materials
let materialsInitialized = false;
export let WhiteCeramicMaterial: THREE.MeshStandardMaterial;
export let WoodMaterial: THREE.MeshStandardMaterial;
export let BlackBaseMaterial: THREE.MeshStandardMaterial;
export let YellowAccentMaterial: THREE.MeshStandardMaterial;
export let MetalMaterial: THREE.MeshStandardMaterial;
export let RubberMaterial: THREE.MeshStandardMaterial;
export let PlasticMaterial: THREE.MeshStandardMaterial;
export let GlowMaterial: THREE.MeshStandardMaterial;
export let GlassMaterial: THREE.MeshStandardMaterial;
export let ScreenMaterial: THREE.MeshStandardMaterial;

export function initSharedMaterials() {
  if (typeof window === 'undefined' || materialsInitialized) return;

  const ceramicMap = getCeramicTexture();
  const woodMap = getWoodTexture();

  // Roughness values are tuned against the studio IBL rig in HeroScene. Glazed
  // ceramic is not a chalky diffuse surface — it holds a broad soft specular
  // sheen, which is what separates the faces of a block and makes the rounded
  // edges read. envMapIntensity drives how much of that sheen the rig produces.
  WhiteCeramicMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F4F1EF'),
    roughness: 0.45,
    metalness: 0.0,
    envMapIntensity: 0.9,
    map: ceramicMap || undefined,
  });

  WoodMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.0,
    envMapIntensity: 0.6,
    map: woodMap,
  });

  // The black bases are the scene's anchor — they read as soft-touch moulded
  // plastic. Pure 0.9 roughness killed every highlight and flattened them into
  // silhouettes; a tighter roughness lets the top edge catch the key light.
  BlackBaseMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#141414'),
    roughness: 0.55,
    metalness: 0.0,
    envMapIntensity: 0.7,
  });

  YellowAccentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFF100'),
    roughness: 0.4,
    metalness: 0.0,
    envMapIntensity: 0.8,
  });

  MetalMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9EA4AB'), // brushed steel
    roughness: 0.28,
    metalness: 0.88,
  });

  RubberMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1C1C1C'), // matte black rubber
    roughness: 0.96,
    metalness: 0.0,
  });

  PlasticMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E8E4DC'), // warm off-white plastic
    roughness: 0.55,
    metalness: 0.0,
  });

  GlowMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#86E280'),
    roughness: 0.0,
    metalness: 0.0,
    emissive: new THREE.Color('#86E280'),
    emissiveIntensity: 1.8,
  });

  GlassMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5A7FAF'), // monitor screen blue-grey
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88,
  });

  ScreenMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4A6D9C'),
    roughness: 0.15,
    metalness: 0.0,
    emissive: new THREE.Color('#3A5C8A'),
    emissiveIntensity: 0.3,
  });

  materialsInitialized = true;
}

// React wrappers that attach the materials to a mesh parent.
//
// `dispose={null}` is load-bearing, not decoration. R3F disposes the object
// behind a <primitive> when that primitive unmounts. These materials are
// module-level singletons guarded by `materialsInitialized`, so the sequence
// under React Strict Mode's dev-only double-mount was:
//   mount   -> initSharedMaterials() creates the materials
//   unmount -> R3F calls .dispose() on every one of them
//   remount -> initSharedMaterials() early-returns (flag is still true),
//              so every mesh re-attaches an ALREADY-DISPOSED material
// which is exactly why the hero rendered blank in `next dev` but was fine in a
// production build, where nothing double-mounts. Opting out of disposal keeps
// the singletons valid for the lifetime of the page.
export function WhiteCeramic() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={WhiteCeramicMaterial} attach="material" dispose={null} />;
}

export function Wood() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={WoodMaterial} attach="material" dispose={null} />;
}

export function BlackBase() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={BlackBaseMaterial} attach="material" dispose={null} />;
}

export function YellowAccent() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={YellowAccentMaterial} attach="material" dispose={null} />;
}

export function Metal() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={MetalMaterial} attach="material" dispose={null} />;
}

export function Rubber() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={RubberMaterial} attach="material" dispose={null} />;
}

export function Plastic() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={PlasticMaterial} attach="material" dispose={null} />;
}

export function Glow() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={GlowMaterial} attach="material" dispose={null} />;
}

export function Glass() { if (typeof window !== 'undefined') initSharedMaterials(); return <primitive object={GlassMaterial} attach="material" dispose={null} />; }
export function Screen() { if (typeof window !== 'undefined') initSharedMaterials(); return <primitive object={ScreenMaterial} attach="material" dispose={null} />; }
