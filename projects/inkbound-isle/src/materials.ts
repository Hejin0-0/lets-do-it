import * as THREE from 'three';
import { PALETTE } from './palette.ts';

const gradientData = new Uint8Array([42, 88, 142, 199, 255]);
export const TOON_GRADIENT = new THREE.DataTexture(gradientData, 5, 1, THREE.RedFormat);
TOON_GRADIENT.minFilter = THREE.NearestFilter;
TOON_GRADIENT.magFilter = THREE.NearestFilter;
TOON_GRADIENT.generateMipmaps = false;
TOON_GRADIENT.colorSpace = THREE.NoColorSpace;
TOON_GRADIENT.needsUpdate = true;

const TOON_IRRADIANCE_LINE = 'vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;';
const toonLightingChunk = THREE.ShaderChunk.lights_toon_pars_fragment;
const shadowTintChunk = toonLightingChunk.includes(TOON_IRRADIANCE_LINE)
  ? `uniform vec3 uShadowTint;\n${toonLightingChunk.replace(
    TOON_IRRADIANCE_LINE,
    'vec3 celBand = getGradientIrradiance( geometryNormal, directLight.direction );\n\tvec3 irradiance = celBand * mix( uShadowTint, vec3( 1.0 ), celBand ) * directLight.color;',
  )}`
  : null;

const SHADOW_TINTS: Readonly<Record<SurfaceKind, number>> = {
  plain: 0x829bb2,
  wood: 0xa48670,
  stone: 0x718fa8,
  leaf: 0x6f998a,
  skin: 0xb99a91,
  soil: 0x829bb2,
};

function applyShadowTint(material: THREE.MeshToonMaterial, surface: SurfaceKind): void {
  if (!shadowTintChunk) return;
  const uniform = { value: new THREE.Color(SHADOW_TINTS[surface]) };
  material.userData.shadowTint = uniform;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShadowTint = uniform;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_toon_pars_fragment>',
      shadowTintChunk,
    );
  };
  material.customProgramCacheKey = () => `inkbound-shadow-tint-v2-${surface}`;
}

export const SURFACE_KINDS = ['plain', 'wood', 'stone', 'leaf', 'skin', 'soil'] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];

const SURFACE_REPEATS: Record<SurfaceKind, readonly [number, number]> = {
  plain: [1, 1],
  wood: [2, 1],
  stone: [1, 1],
  leaf: [1, 1],
  skin: [2, 2],
  soil: [12, 12],
};

const SURFACE_LEVELS: Readonly<Record<SurfaceKind, readonly [number, number, number]>> = {
  plain: [255, 255, 255],
  wood: [208, 236, 255],
  stone: [226, 243, 255],
  leaf: [226, 244, 255],
  skin: [245, 250, 255],
  soil: [226, 242, 255],
};

function paintSwath(kind: SurfaceKind, u: number, v: number): number {
  switch (kind) {
    case 'wood': return Math.sin(u * 4 + Math.sin(v) * 0.4) + Math.sin(u * 8 + Math.sin(v * 2) * 0.15) * 0.2;
    case 'stone': return Math.sin(u + Math.sin(v) * 0.45) * 0.65 + Math.sin(v * 2 - u) * 0.35;
    case 'leaf': return Math.sin((u - v) * 2) * 0.25 + Math.cos(u) * 0.75;
    case 'skin': return Math.sin(u * 2 + Math.sin(v) * 0.5) * 0.6 + Math.cos(v * 3) * 0.2;
    case 'soil': return Math.sin(u * 2 + Math.sin(v)) * 0.5 + Math.cos(v * 2 - u) * 0.4;
    default: return 1;
  }
}

function createSurfaceTexture(kind: SurfaceKind): THREE.DataTexture {
  const levels = SURFACE_LEVELS[kind];
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const x = index % size;
    const y = Math.floor(index / size);
    const swath = paintSwath(kind, x / size * Math.PI * 2, y / size * Math.PI * 2);
    const value = levels[swath < -0.35 ? 0 : swath < 0.25 ? 1 : 2];
    data.set([value, value, value, 255], index * 4);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = `Inkbound ${kind} surface`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...SURFACE_REPEATS[kind]);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.userData.shared = true;
  texture.needsUpdate = true;
  return texture;
}

const surfaceTextures = Object.fromEntries(
  SURFACE_KINDS.map((kind) => [kind, createSurfaceTexture(kind)]),
) as Record<SurfaceKind, THREE.DataTexture>;

export function surfaceTexture(kind: SurfaceKind = 'plain'): THREE.DataTexture {
  return surfaceTextures[kind];
}

function createContactShadowTexture(): THREE.DataTexture {
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - size * 0.5) / (size * 0.5);
      const dy = (y + 0.5 - size * 0.5) / (size * 0.5);
      const radiusSquared = dx * dx + dy * dy;
      const alpha = radiusSquared <= 0.42 ? 104 : radiusSquared <= 1 ? 48 : 0;
      const offset = (y * size + x) * 4;
      data.set([255, 255, 255, alpha], offset);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'Inkbound two-band contact shadow';
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.userData.shared = true;
  texture.needsUpdate = true;
  return texture;
}

export const CONTACT_SHADOW_TEXTURE = createContactShadowTexture();
const contactShadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const contactShadowMaterial = new THREE.MeshBasicMaterial({
  color: PALETTE.ink,
  map: CONTACT_SHADOW_TEXTURE,
  transparent: true,
  opacity: 0.72,
  alphaTest: 0.01,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  toneMapped: false,
});
contactShadowMaterial.userData.shared = true;

export function createContactShadow(width = 1.4, depth = 0.8): THREE.Mesh {
  const shadow = new THREE.Mesh(contactShadowGeometry, contactShadowMaterial);
  shadow.name = 'Painted contact shadow';
  shadow.position.y = 0.012;
  shadow.scale.set(width, 1, depth);
  shadow.castShadow = false;
  shadow.receiveShadow = false;
  shadow.raycast = () => {};
  shadow.userData.contactShadow = true;
  return shadow;
}

const materialCache = new Map<string, THREE.MeshToonMaterial>();
const unlitMaterialCache = new Map<number, THREE.MeshBasicMaterial>();
const outlineMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide });
outlineMaterial.userData.shared = true;

export interface InkOptions {
  castShadow?: boolean;
  outline?: boolean;
  outlineScale?: number;
  emissive?: number;
  emissiveIntensity?: number;
  surface?: SurfaceKind;
  unlit?: boolean;
}

function unlitMaterial(color: number): THREE.MeshBasicMaterial {
  let material = unlitMaterialCache.get(color);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    material.userData.shared = true;
    unlitMaterialCache.set(color, material);
  }
  return material;
}

export function toonMaterial(color: number, options: InkOptions = {}): THREE.MeshToonMaterial {
  const emissive = options.emissive ?? 0x000000;
  const emissiveIntensity = options.emissiveIntensity ?? 1;
  const surface = options.surface ?? 'plain';
  const key = `${color}|${emissive}|${emissiveIntensity}|${surface}`;
  let material = materialCache.get(key);
  if (!material) {
    material = new THREE.MeshToonMaterial({
      color,
      gradientMap: TOON_GRADIENT,
      map: surfaceTexture(surface),
      emissive,
      emissiveIntensity,
    });
    applyShadowTint(material, surface);
    material.userData.shared = true;
    materialCache.set(key, material);
  }
  return material;
}

export function inkedMesh(
  geometry: THREE.BufferGeometry,
  color: number,
  options: InkOptions = {},
): THREE.Group {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(geometry, options.unlit ? unlitMaterial(color) : toonMaterial(color, options));
  fill.castShadow = options.castShadow ?? options.outline !== false;
  fill.receiveShadow = true;
  fill.userData.inkFill = true;

  if (options.outline === false) group.add(fill);
  else {
    const outline = new THREE.Mesh(geometry, outlineMaterial);
    outline.scale.setScalar(options.outlineScale ?? 1.025);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.raycast = () => {};
    outline.userData.inkOutline = true;
    group.add(outline, fill);
  }
  return group;
}

export function addInkedPart(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: number,
  position: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
  rotation: readonly [number, number, number] = [0, 0, 0],
  options: InkOptions = {},
): THREE.Group {
  const part = inkedMesh(geometry, color, options);
  part.position.set(...position);
  part.scale.set(...scale);
  part.rotation.set(...rotation);
  parent.add(part);
  return part;
}

export function makeGhost(root: THREE.Object3D, valid: boolean): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.inkFill) return;
    const source = child.material as THREE.MeshToonMaterial | THREE.MeshBasicMaterial;
    const material = source.clone();
    material.color.setHex(valid ? PALETTE.amber : PALETTE.danger);
    if (material instanceof THREE.MeshToonMaterial) {
      material.emissive.setHex(valid ? 0x6b3b08 : 0x5c0c06);
      material.emissiveIntensity = 0.7;
    }
    material.transparent = true;
    material.opacity = 0.58;
    material.depthWrite = false;
    child.material = material;
  });
  setGhostValidity(root, valid);
}

export function setGhostValidity(root: THREE.Object3D, valid: boolean): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.inkFill) return;
    const material = child.material as THREE.MeshToonMaterial | THREE.MeshBasicMaterial;
    material.color.setHex(valid ? PALETTE.amber : PALETTE.danger);
    if (material instanceof THREE.MeshToonMaterial) material.emissive.setHex(valid ? 0x6b3b08 : 0x5c0c06);
  });
}
