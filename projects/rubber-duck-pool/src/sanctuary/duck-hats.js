import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DESIGNS, HATS } from '../pool/ducks.js';
import { patchGouacheMaterial } from './stylized-look.js';

export { DESIGNS, HATS };

export const SIGNATURE_HATS = Object.freeze({
  '01-classic': 'towel',
  '02-mint': 'fern',
  '03-cherry': 'beret',
  '04-daisy': 'ribbon',
  '17-bookbinder': 'archivist',
});

export function getSignatureHatForDesign(designId) {
  return SIGNATURE_HATS[designId] || null;
}

const texLoader = new THREE.TextureLoader();
const atlasCache = new Map();
const mergedHatGeoCache = new Map();
let sharedHatMat = null;
let sharedPropBladeGeo = null;

function getSharedHatMat() {
  if (!sharedHatMat) {
    sharedHatMat = new THREE.MeshStandardMaterial({
      name: 'M_Duck_Accessory_Toon',
      vertexColors: true,
      roughness: 0.56,
      metalness: 0.06,
    });
    patchGouacheMaterial(sharedHatMat, { strength: 0.84, rim: 0.48, specPop: 0.25 });
  }
  return sharedHatMat;
}

function coloredPart(geo, hex, pos = null, rot = null, scale = null) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (scale) g.scale(scale[0], scale[1], scale[2]);
  if (rot) {
    if (rot[0]) g.rotateX(rot[0]);
    if (rot[1]) g.rotateY(rot[1]);
    if (rot[2]) g.rotateZ(rot[2]);
  }
  if (pos) g.translate(pos[0], pos[1], pos[2]);
  if (!g.attributes.normal) g.computeVertexNormals();
  // Strip UVs so mergeGeometries never rejects mixed-attribute primitives
  if (g.attributes.uv) g.deleteAttribute('uv');
  const count = g.attributes.position.count;
  const col = new THREE.Color(hex);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.dispose();
  return g;
}

function getMergedHatGeometry(hatId) {
  if (mergedHatGeoCache.has(hatId)) return mergedHatGeoCache.get(hatId);
  const parts = [];

  if (hatId === 'party') {
    parts.push(coloredPart(new THREE.ConeGeometry(0.058, 0.145, 14), 0xe8406a, [0, 0.435, 0.020], [-0.18, 0, 0]));
    parts.push(coloredPart(new THREE.TorusGeometry(0.055, 0.009, 8, 16), 0x40b8e8, [0, 0.368, 0.028], [Math.PI / 2 - 0.18, 0, 0]));
    parts.push(coloredPart(new THREE.SphereGeometry(0.020, 10, 8), 0xf8f4ee, [0, 0.506, 0.008]));
  } else if (hatId === 'tophat') {
    parts.push(coloredPart(new THREE.CylinderGeometry(0.088, 0.090, 0.012, 18), 0x1c1d22, [0, 0.372, 0.024]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.060, 0.054, 0.118, 16), 0x1c1d22, [0, 0.432, 0.024]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.057, 0.056, 0.024, 16), 0xc22e2a, [0, 0.388, 0.024]));
  } else if (hatId === 'crown') {
    parts.push(coloredPart(new THREE.CylinderGeometry(0.062, 0.056, 0.042, 14, 1, true), 0xf0be34, [0, 0.384, 0.024]));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      parts.push(coloredPart(new THREE.ConeGeometry(0.014, 0.042, 6), 0xf0be34, [Math.cos(a) * 0.058, 0.418, 0.024 + Math.sin(a) * 0.058]));
      if (k % 2 === 0) {
        parts.push(coloredPart(new THREE.SphereGeometry(0.010, 8, 6), 0xd92642, [Math.cos(a) * 0.062, 0.386, 0.024 + Math.sin(a) * 0.062]));
      }
    }
  } else if (hatId === 'shades') {
    for (const s of [-1, 1]) {
      parts.push(coloredPart(new THREE.BoxGeometry(0.044, 0.030, 0.012), 0x121318, [s * 0.042, 0.292, 0.106]));
      parts.push(coloredPart(new THREE.BoxGeometry(0.008, 0.009, 0.095), 0x121318, [s * 0.064, 0.294, 0.058]));
    }
    parts.push(coloredPart(new THREE.BoxGeometry(0.028, 0.008, 0.010), 0x121318, [0, 0.298, 0.108]));
  } else if (hatId === 'bowtie') {
    for (const s of [-1, 1]) {
      parts.push(coloredPart(new THREE.ConeGeometry(0.028, 0.056, 4), 0xd42b3c, [s * 0.026, 0.186, 0.114], [0, 0, s * Math.PI * 0.5]));
    }
    parts.push(coloredPart(new THREE.SphereGeometry(0.014, 8, 8), 0xd42b3c, [0, 0.186, 0.118]));
  } else if (hatId === 'flower') {
    const fgParts = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      fgParts.push(coloredPart(new THREE.SphereGeometry(0.022, 8, 6), 0xf474ad, [Math.cos(a) * 0.028, 0, Math.sin(a) * 0.028], null, [1, 0.42, 1]));
    }
    fgParts.push(coloredPart(new THREE.SphereGeometry(0.016, 8, 6), 0xfbd842, [0, 0.007, 0]));
    const fgMerged = mergeGeometries(fgParts, false);
    fgParts.forEach((p) => p.dispose());
    fgMerged.rotateZ(-0.52);
    fgMerged.rotateY(0.25);
    fgMerged.rotateX(0.35);
    fgMerged.translate(0.058, 0.355, 0.046);
    parts.push(fgMerged);
  } else if (hatId === 'pirate') {
    parts.push(coloredPart(new THREE.CylinderGeometry(0.092, 0.088, 0.014, 16), 0x1e1e24, [0, 0.372, 0.024], null, [1.22, 1, 0.92]));
    parts.push(coloredPart(new THREE.SphereGeometry(0.062, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x1e1e24, [0, 0.375, 0.024]));
    parts.push(coloredPart(new THREE.BoxGeometry(0.155, 0.056, 0.016), 0x1e1e24, [0, 0.405, 0.068], [0.22, 0, 0]));
    parts.push(coloredPart(new THREE.SphereGeometry(0.015, 8, 8), 0xf4f2ec, [0, 0.408, 0.079]));
    parts.push(coloredPart(new THREE.BoxGeometry(0.158, 0.008, 0.018), 0xe6bf46, [0, 0.432, 0.063]));
  } else if (hatId === 'propeller') {
    parts.push(coloredPart(new THREE.SphereGeometry(0.068, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), 0xe8425c, [0, 0.362, 0.024]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.042, 0.042, 0.008, 12), 0xf4c830, [0, 0.364, 0.082], null, [1.1, 1, 1.35]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.008, 0.008, 0.046, 8), 0x2c8ad8, [0, 0.440, 0.024]));
  } else if (hatId === 'towel') {
    // Classic Duck's plump 2-fold white Suanbo onsen bath towel curved gently over crown (PLATE 02-A)
    parts.push(coloredPart(new THREE.SphereGeometry(0.068, 14, 10), 0xf8f3e8, [0, 0.376, 0.022], [0.04, 0.05, 0.05], [1.12, 0.28, 0.88]));
    parts.push(coloredPart(new THREE.SphereGeometry(0.062, 14, 10), 0xf2ead9, [0, 0.394, 0.020], [0.04, 0.05, 0.05], [1.06, 0.24, 0.82]));
    parts.push(coloredPart(new THREE.BoxGeometry(0.118, 0.005, 0.014), 0x5bb8ad, [0, 0.398, 0.052], [0.04, 0.05, 0.05]));
  } else if (hatId === 'fern') {
    // Mint Duck's fresh curled botanical fern leaf tucked beside the temple
    parts.push(coloredPart(new THREE.CylinderGeometry(0.004, 0.006, 0.095, 6), 0x3b8a4e, [0.058, 0.390, 0.036], [0.22, 0.15, -0.58]));
    for (let k = 0; k < 5; k++) {
      const f = k / 4;
      const sx = 0.048 + f * 0.048;
      const sy = 0.368 + f * 0.046;
      const w = 0.024 * (1 - f * 0.35);
      parts.push(coloredPart(new THREE.SphereGeometry(w, 8, 6), 0x52b86a, [sx, sy, 0.038 + f * 0.008], [0.2, 0.25, -0.52], [1.45, 0.32, 0.72]));
      parts.push(coloredPart(new THREE.SphereGeometry(w * 0.88, 8, 6), 0x6dd082, [sx - 0.012, sy + 0.012, 0.026], [0.2, -0.15, -0.45], [1.35, 0.32, 0.72]));
    }
  } else if (hatId === 'beret') {
    // Cherry Duck's plump rose artist beret (intentionally tilted crooked by -11 deg at attach time)
    parts.push(coloredPart(new THREE.SphereGeometry(0.082, 16, 10), 0xe66a88, [0, 0.388, 0.022], null, [1.18, 0.44, 1.12]));
    parts.push(coloredPart(new THREE.TorusGeometry(0.064, 0.012, 8, 18), 0xc74d6c, [0, 0.366, 0.022], [Math.PI / 2, 0, 0]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.005, 0.007, 0.026, 6), 0xc74d6c, [0, 0.428, 0.020], [0.18, 0, -0.22]));
  } else if (hatId === 'ribbon') {
    // Daisy Duck's butter-yellow neck bow ribbon
    parts.push(coloredPart(new THREE.SphereGeometry(0.016, 8, 8), 0xf6c93b, [0, 0.188, 0.118]));
    parts.push(coloredPart(new THREE.SphereGeometry(0.026, 10, 8), 0xfbe068, [-0.030, 0.190, 0.114], [0, 0.18, 0.25], [1.35, 0.85, 0.45]));
    parts.push(coloredPart(new THREE.SphereGeometry(0.026, 10, 8), 0xfbe068, [0.030, 0.190, 0.114], [0, -0.18, -0.25], [1.35, 0.85, 0.45]));
    parts.push(coloredPart(new THREE.BoxGeometry(0.014, 0.044, 0.006), 0xebd04c, [-0.016, 0.162, 0.116], [0, 0, 0.22]));
    parts.push(coloredPart(new THREE.BoxGeometry(0.014, 0.044, 0.006), 0xebd04c, [0.016, 0.162, 0.116], [0, 0, -0.22]));
  } else if (hatId === 'archivist') {
    // Special Archivist (PLATE 03-A): brown fedora + crimson band + gold monocle on Eye_L + tweed collar
    parts.push(coloredPart(new THREE.CylinderGeometry(0.098, 0.102, 0.012, 18), 0x6b4a30, [0, 0.372, 0.022], null, [1.08, 1, 1.15]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.062, 0.070, 0.072, 16), 0x7b5638, [0, 0.410, 0.022]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.067, 0.069, 0.018, 16), 0x9c2824, [0, 0.386, 0.022]));
    parts.push(coloredPart(new THREE.TorusGeometry(0.024, 0.0045, 8, 16), 0xf2c84c, [-0.048, 0.292, 0.105], [0, -0.28, 0]));
    parts.push(coloredPart(new THREE.CylinderGeometry(0.086, 0.104, 0.026, 14), 0x645240, [0, 0.182, 0.036]));
  }

  if (!parts.length) return null;
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (parts.length > 1) parts.forEach((p) => p.dispose());
  mergedHatGeoCache.set(hatId, merged);
  return merged;
}

function getPropellerBladeGeo() {
  if (!sharedPropBladeGeo) {
    const b1 = coloredPart(new THREE.BoxGeometry(0.145, 0.006, 0.024), 0xf4c830, null, [0.22, 0, 0]);
    const b2 = coloredPart(new THREE.BoxGeometry(0.024, 0.006, 0.145), 0x3ab89a, null, [0, 0, -0.22]);
    sharedPropBladeGeo = mergeGeometries([b1, b2], false);
    b1.dispose();
    b2.dispose();
  }
  return sharedPropBladeGeo;
}

/**
 * Load & cache one of the 24 official duck WebP atlases from public/ducks/<id>.webp.
 * Blender glTF UVs use V-down, so flipY MUST be false.
 */
export function loadDuckAtlas(designId, assetUrlFn) {
  if (atlasCache.has(designId)) return atlasCache.get(designId);
  const url = assetUrlFn ? assetUrlFn(`./ducks/${designId}.webp`) : `./ducks/${designId}.webp`;
  const tex = texLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;
  atlasCache.set(designId, tex);
  return tex;
}

export function getDesignByIdOrIndex(idOrIndex) {
  if (typeof idOrIndex === 'number') {
    return DESIGNS[((idOrIndex % DESIGNS.length) + DESIGNS.length) % DESIGNS.length];
  }
  return (
    DESIGNS.find((d) => d.id === idOrIndex || d.id.endsWith(`-${idOrIndex}`)) ||
    DESIGNS[0]
  );
}

/**
 * Apply any of the 24 official duck WebP atlases onto a cloned sanctuary duck root.
 */
export function applyOfficialDuckDesign(duckRoot, idOrIndex, assetUrlFn) {
  const design = getDesignByIdOrIndex(idOrIndex);
  const tex = loadDuckAtlas(design.id, assetUrlFn);
  const isGlowing = design.id === '24-lantern' || design.id === '19-moon' || design.id === '05-lightning';

  duckRoot.traverse((ch) => {
    if (!ch.isMesh || !ch.material) return;
    const arr = Array.isArray(ch.material) ? ch.material : [ch.material];
    const mapped = arr.map((orig) => {
      const nm = `${ch.name} ${orig.name || ''}`.toLowerCase();
      if (nm.includes('eye') || nm.includes('sphere') || nm.includes('beak') || nm.includes('crown')) {
        return orig;
      }
      const m = orig.clone();
      m.map = tex;
      m.color.setHex(0xffffff);
      m.roughness = design.id === '13-teapot' || design.id === '23-mosaic' ? 0.16 : 0.28;
      m.metalness = design.id === '11-crown' || design.id === '21-magnet' ? 0.22 : 0.04;
      if (isGlowing && m.emissive) {
        m.emissive.setHex(design.id === '24-lantern' ? 0xffc66e : design.id === '19-moon' ? 0x99b8ff : 0x5ad6ff);
        m.emissiveIntensity = 0.22;
      }
      m.needsUpdate = true;
      return m;
    });
    ch.material = Array.isArray(ch.material) ? mapped : mapped[0];
  });
  return design;
}

/**
 * Create a single-draw-call merged vertex-colored 3D hat anchored to a sanctuary duck head.
 */
export function createDuckHatMesh(hatId) {
  if (!hatId || hatId === 'none') return null;
  const geo = getMergedHatGeometry(hatId);
  if (!geo) return null;

  const hatMesh = new THREE.Mesh(geo, getSharedHatMat());
  hatMesh.name = `DuckHat_${hatId}`;
  hatMesh.castShadow = false;
  hatMesh.receiveShadow = false;
  // Duck root nodes carry scale 0.38 around 1.0-unit local meshes; un-scale once so hats sit flush on the head.
  hatMesh.scale.setScalar(1 / 0.38);
  const baseTiltRad = hatId === 'beret' ? -(11 * Math.PI) / 180 : hatId === 'towel' ? (3.5 * Math.PI) / 180 : 0;
  hatMesh.userData.baseTiltRad = baseTiltRad;
  hatMesh.rotation.z = baseTiltRad;

  if (hatId === 'propeller') {
    const blades = new THREE.Mesh(getPropellerBladeGeo(), getSharedHatMat());
    blades.name = 'PropellerBlades';
    blades.position.set(0, 0.464, 0.024);
    blades.castShadow = false;
    hatMesh.add(blades);
    hatMesh.userData.blades = blades;
  }
  return hatMesh;
}

export function setDuckHatTilt(hatMesh, extraDeg = 0) {
  if (!hatMesh) return;
  const base = hatMesh.userData?.baseTiltRad || 0;
  hatMesh.rotation.z = base + (extraDeg * Math.PI) / 180;
}

export function attachDuckHat(duckRoot, hatId) {
  if (!duckRoot) return null;
  const old = duckRoot.children.find((c) => c.name && c.name.startsWith('DuckHat_'));
  if (old) duckRoot.remove(old);
  if (!hatId || hatId === 'none') return null;

  const hatMesh = createDuckHatMesh(hatId);
  if (!hatMesh) return null;
  duckRoot.add(hatMesh);
  return hatMesh;
}

export function updateDuckHats(duckEntries, t) {
  for (const d of duckEntries) {
    if (d.hatMesh?.userData?.blades) {
      d.hatMesh.userData.blades.rotation.y = t * 14.0 + (d.phase || 0);
    }
  }
}
