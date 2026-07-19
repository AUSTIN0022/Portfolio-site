import * as THREE from 'three';

// Procedural Ceramic Texture (Speckled off-white)
let cachedCeramicTexture: THREE.CanvasTexture | null = null;
export function getCeramicTexture(): THREE.CanvasTexture | null {
  if (typeof window === 'undefined') return null;
  if (cachedCeramicTexture) return cachedCeramicTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base off-white ceramic: #F4F1EC (warm beige premium tone)
  ctx.fillStyle = '#F4F1EC';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle warm beige noise/grain
  ctx.fillStyle = 'rgba(215, 200, 180, 0.05)';
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillRect(x, y, 1, 1);
  }

  // Soft barely-visible speckles (warm brown/stone speckles)
  ctx.fillStyle = 'rgba(150, 135, 115, 0.06)';
  for (let i = 0; i < 1000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = Math.random() * 1.2 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cachedCeramicTexture = texture;
  return texture;
}

// Procedural Oak Wood Texture
let cachedWoodTexture: THREE.CanvasTexture | null = null;
export function getWoodTexture(): THREE.CanvasTexture | null {
  if (typeof window === 'undefined') return null;
  if (cachedWoodTexture) return cachedWoodTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background light oak warm color: #E5C296
  ctx.fillStyle = '#E5C296';
  ctx.fillRect(0, 0, 512, 512);

  // Broad grain waves
  ctx.strokeStyle = 'rgba(165, 110, 60, 0.2)';
  ctx.lineWidth = 3;
  for (let i = -10; i < 110; i++) {
    ctx.beginPath();
    const startY = (i / 100) * 512;
    ctx.moveTo(0, startY);
    for (let x = 0; x <= 512; x += 10) {
      const y = startY + Math.sin(x * 0.015) * 12 + Math.cos(x * 0.005) * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Fine dark grain lines
  ctx.strokeStyle = 'rgba(110, 70, 35, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const startY = Math.random() * 600 - 50;
    ctx.moveTo(0, startY);
    for (let x = 0; x <= 512; x += 10) {
      const y = startY + Math.sin(x * 0.015) * 12 + Math.cos(x * 0.005) * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cachedWoodTexture = texture;
  return texture;
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

  WhiteCeramicMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F4F1EC'),
    roughness: 0.72,
    metalness: 0.0,
    map: ceramicMap || undefined,
  });

  WoodMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.8,
    metalness: 0.0,
    map: woodMap,
  });

  BlackBaseMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1E1E1E'),
    roughness: 0.9,
    metalness: 0.0,
  });

  YellowAccentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFD600'),
    roughness: 0.5,
    metalness: 0.0,
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
    color: new THREE.Color('#00FF88'),
    roughness: 0.0,
    metalness: 0.0,
    emissive: new THREE.Color('#00FF88'),
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

// React wrappers that attach the materials to a mesh parent
export function WhiteCeramic() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={WhiteCeramicMaterial} attach="material" />;
}

export function Wood() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={WoodMaterial} attach="material" />;
}

export function BlackBase() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={BlackBaseMaterial} attach="material" />;
}

export function YellowAccent() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={YellowAccentMaterial} attach="material" />;
}

export function Metal() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={MetalMaterial} attach="material" />;
}

export function Rubber() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={RubberMaterial} attach="material" />;
}

export function Plastic() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={PlasticMaterial} attach="material" />;
}

export function Glow() {
  if (typeof window !== 'undefined') initSharedMaterials();
  return <primitive object={GlowMaterial} attach="material" />;
}

export function Glass()  { if (typeof window !== 'undefined') initSharedMaterials(); return <primitive object={GlassMaterial}  attach="material" />; }
export function Screen() { if (typeof window !== 'undefined') initSharedMaterials(); return <primitive object={ScreenMaterial} attach="material" />; }
