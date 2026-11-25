// Steam-Flagship Instanced Drama VFX, Living Ecosystem (Koi, Coastal Seagulls, Weather Particles),
// World-Space Diegetic Emote Pops & Refined Bamboo Fishing Rig + 3D Catch Reveal.
// Minimal GPU overhead (~10 batched draw calls total); deterministic Mulberry32 PRNG (seeded-sim compliant).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);

// Subtle drifting firefly beacons above the 5 interactive places (Zero-UI 30s readability)
const STATION_BEACONS = [
  { role: 'book',     pos: b2t(-9.12, -5.10, 1.38), color: 0xb6e4ff },
  { role: 'onsen',    pos: b2t(-10.50, 3.20, 2.25), color: 0xffc876 },
  { role: 'atelier',  pos: b2t(2.85, -5.57, 1.82),  color: 0xffd86e },
  { role: 'campfire', pos: b2t(-8.60, -14.20, -1.10), color: 0xff8c3e },
  { role: 'fishing',  pos: b2t(-3.80, -22.25, -0.75), color: 0xffcf74 },
];

// Anchored directly into the handcrafted Blender Coastal Hinoki Pier rod saddle (X=-3.80, Y=-22.42, Z=-1.40)
const PIER_POS = b2t(-3.80, -22.42, -1.04);
const BOBBER_REST_POS = b2t(-4.05, -26.50, -3.72);
const BOBBER_CAST_POS = b2t(-4.18, -31.80, -3.70);

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

function buildBambooRodGeo() {
  const parts = [];
  // Cork grip handle + brass butt cap + brass reel seat
  parts.push(coloredPart(new THREE.CylinderGeometry(0.025, 0.027, 0.34, 10), 0xc89a66, [0, 0.17, 0]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 10), 0xd4a448, [0, 0.01, 0]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.029, 0.029, 0.08, 10), 0xd4a448, [0, 0.35, 0]));
  // Miniature brass centerpin spinning reel slung cleanly UNDERNEATH the tilted rod (+Z -> down when rotX > 0)
  parts.push(coloredPart(new THREE.BoxGeometry(0.016, 0.04, 0.055), 0xb88c3a, [0, 0.35, 0.045]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.055, 0.055, 0.036, 14), 0xcfa044, [0, 0.35, 0.095], [0, 0, Math.PI * 0.5]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.032, 0.032, 0.042, 12), 0x26292e, [0, 0.35, 0.095], [0, 0, Math.PI * 0.5]));
  // 4-section tapered lacquered bamboo rod blank with dark silk wrappings & brass ferrules
  const segs = [
    { y0: 0.38, len: 0.65, r0: 0.022, r1: 0.018, col: 0xa47036 },
    { y0: 1.03, len: 0.65, r0: 0.018, r1: 0.014, col: 0xb27e42 },
    { y0: 1.68, len: 0.62, r0: 0.014, r1: 0.010, col: 0xbc8848 },
    { y0: 2.30, len: 0.54, r0: 0.010, r1: 0.006, col: 0xc69452 },
  ];
  for (const s of segs) {
    parts.push(coloredPart(new THREE.CylinderGeometry(s.r1, s.r0, s.len, 8), s.col, [0, s.y0 + s.len * 0.5, 0]));
    parts.push(coloredPart(new THREE.CylinderGeometry(s.r0 + 0.003, s.r0 + 0.003, 0.038, 10), 0x241c18, [0, s.y0 + 0.015, 0]));
    parts.push(coloredPart(new THREE.TorusGeometry(0.018, 0.0032, 6, 12), 0xd4a448, [0, s.y0 + s.len * 0.85, 0.026]));
  }
  // Luminous ivory-jade tip eyelet
  parts.push(coloredPart(new THREE.SphereGeometry(0.020, 10, 8), 0x9efce8, [0, 2.84, 0]));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildBobberGeo() {
  const parts = [];
  // Classic Japanese red-lacquer & ivory gourd fishing float (Uki)
  parts.push(coloredPart(new THREE.SphereGeometry(0.115, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), 0xe63b2e, [0, 0.02, 0]));
  parts.push(coloredPart(new THREE.SphereGeometry(0.115, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), 0xf6efe0, [0, 0.02, 0]));
  parts.push(coloredPart(new THREE.TorusGeometry(0.116, 0.011, 6, 16), 0x1c1e22, [0, 0.018, 0], [Math.PI * 0.5, 0, 0]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.014, 0.020, 0.22, 8), 0xf6efe0, [0, 0.16, 0]));
  parts.push(coloredPart(new THREE.SphereGeometry(0.030, 10, 8), 0xffe468, [0, 0.27, 0]));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildCatchTreasureGeo() {
  const parts = [];
  // Corked emerald message bottle + golden wax seal rising from the sea
  parts.push(coloredPart(new THREE.CylinderGeometry(0.075, 0.082, 0.22, 12), 0x2fd8b8, [0, 0, 0]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.034, 0.072, 0.09, 12), 0x42ebd0, [0, 0.15, 0]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.030, 0.030, 0.06, 10), 0xc9965a, [0, 0.21, 0]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.044, 0.044, 0.11, 10), 0xf5e8c4, [0, -0.01, 0]));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildKoiGeo() {
  const parts = [];
  parts.push(coloredPart(new THREE.SphereGeometry(0.12, 10, 8), 0xf46028, [0, 0, 0], null, [0.52, 0.44, 1.55]));
  parts.push(coloredPart(new THREE.ConeGeometry(0.075, 0.18, 6), 0xfcf2dc, [0, 0, -0.22], [-Math.PI * 0.5, 0, 0], [0.35, 1, 1]));
  parts.push(coloredPart(new THREE.BoxGeometry(0.20, 0.012, 0.07), 0xf7b952, [0, -0.02, 0.04]));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildSeagullGeo() {
  const parts = [];
  parts.push(coloredPart(new THREE.SphereGeometry(0.11, 8, 6), 0xf6f8fa, [0, 0, 0], null, [0.55, 0.45, 1.75]));
  parts.push(coloredPart(new THREE.BoxGeometry(0.56, 0.024, 0.16), 0xeef3f8, [-0.30, 0.04, 0.02], [0, 0.12, 0.20]));
  parts.push(coloredPart(new THREE.BoxGeometry(0.56, 0.024, 0.16), 0xeef3f8, [0.30, 0.04, 0.02], [0, -0.12, -0.20]));
  parts.push(coloredPart(new THREE.BoxGeometry(0.24, 0.022, 0.12), 0x3b4450, [-0.62, 0.07, -0.02], [0, 0.18, -0.12]));
  parts.push(coloredPart(new THREE.BoxGeometry(0.24, 0.022, 0.12), 0x3b4450, [0.62, 0.07, -0.02], [0, -0.18, 0.12]));
  parts.push(coloredPart(new THREE.ConeGeometry(0.026, 0.09, 6), 0xf0a630, [0, -0.01, 0.22], [Math.PI * 0.5, 0, 0]));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildYuzuGeo() {
  const parts = [];
  // Fragrant Japanese Yuzu citrus fruit + emerald stem & leaf
  parts.push(coloredPart(new THREE.SphereGeometry(0.125, 12, 10), 0xf6b928, [0, 0, 0], null, [1.05, 0.88, 1.05]));
  parts.push(coloredPart(new THREE.CylinderGeometry(0.012, 0.016, 0.045, 6), 0x3a6e2c, [0, 0.115, 0]));
  parts.push(coloredPart(new THREE.SphereGeometry(0.055, 8, 6), 0x3d8a3c, [0.055, 0.125, 0.01], [0.2, 0.3, -0.45], [1.4, 0.28, 0.72]));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

const EMOTE_ICONS = {
  spark:  { glyph: '⚡', bg: '#fdf5e2', ring: '#d89222' },
  magnet: { glyph: '🧲', bg: '#fdf5e2', ring: '#d84a62' },
  crown:  { glyph: '👑', bg: '#fdf5e2', ring: '#d49a1e' },
  heart:  { glyph: '♥',  bg: '#fff0f3', ring: '#e05882' },
  music:  { glyph: '🎵', bg: '#eefcf9', ring: '#2ea898' },
  splash: { glyph: '💦', bg: '#edf9ff', ring: '#3498d8' },
  star:   { glyph: '✨', bg: '#fffbe8', ring: '#dba224' },
  anger:  { glyph: '💢', bg: '#fff0ec', ring: '#d6342c' },
  stare:  { glyph: '👁', bg: '#f4efe2', ring: '#38261b' },
  jet:    { glyph: '💨', bg: '#eaf9ff', ring: '#2494d8' },
  sleep:  { glyph: 'Zzz', bg: '#f4ecdc', ring: '#5b82b8' },
};

function createEmoteTextureMap() {
  const map = {};
  if (typeof document === 'undefined') return map;
  for (const [key, spec] of Object.entries(EMOTE_ICONS)) {
    const cv = document.createElement('canvas');
    cv.width = 96;
    cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 96, 96);
    // Warm cream parchment cartoon sticker bubble with #3A2618 hand-inked border
    ctx.beginPath();
    ctx.arc(48, 43, 35, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2618';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(48, 43, 31, 0, Math.PI * 2);
    ctx.fillStyle = spec.bg;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = spec.ring;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, 74);
    ctx.lineTo(48, 90);
    ctx.lineTo(56, 74);
    ctx.closePath();
    ctx.fillStyle = '#3a2618';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(43, 73);
    ctx.lineTo(48, 84);
    ctx.lineTo(53, 73);
    ctx.closePath();
    ctx.fillStyle = spec.bg;
    ctx.fill();

    ctx.font = 'bold 36px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3a2618';
    ctx.fillText(spec.glyph, 48, 44);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    map[key] = tex;
  }
  return map;
}

function createSteamPuffTexture() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0.0, 'rgba(255, 252, 244, 0.52)');
  g.addColorStop(0.45, 'rgba(232, 246, 244, 0.24)');
  g.addColorStop(0.78, 'rgba(218, 238, 240, 0.06)');
  g.addColorStop(1.0, 'rgba(210, 232, 238, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDramaVfx(scene) {
  const rng = mulberry32(9913);
  const group = new THREE.Group();
  group.name = 'SanctuaryDramaVfx';
  scene.add(group);

  // 0. Single-draw-call soft volumetric Japanese Onsen Steam puffs over Upper Pool & Lower Grotto
  const STEAM_COUNT = 16;
  const steamGeo = new THREE.PlaneGeometry(2.1, 2.1);
  const steamTex = createSteamPuffTexture();
  const steamMat = new THREE.MeshBasicMaterial({
    map: steamTex,
    color: 0xeaf6f4,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const steamMesh = new THREE.InstancedMesh(steamGeo, steamMat, STEAM_COUNT);
  steamMesh.name = 'OnsenThermalSteam';
  steamMesh.frustumCulled = false;
  group.add(steamMesh);
  const steamPuffs = Array.from({ length: STEAM_COUNT }, (_, i) => {
    const isLower = i >= 11;
    return {
      cx: isLower ? (-1.6 + (i - 11) * 0.82) : (-0.5 + (i % 6) * 1.25),
      cz: isLower ? (12.0 + ((i * 1.7) % 2.8)) : (-2.8 + Math.floor(i / 6) * 2.4),
      baseY: isLower ? -1.85 : 0.15,
      speed: 0.16 + (i % 4) * 0.04,
      phase: i * 0.63,
      scale: isLower ? 1.05 : 1.28,
    };
  });

  // 1. Instanced Motes (Thermal steam + collision/overtake/guitar sparks + fireflies)
  const MAX_MOTES = 128;
  const moteGeo = new THREE.IcosahedronGeometry(0.048, 1);
  const moteMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const moteMesh = new THREE.InstancedMesh(moteGeo, moteMat, MAX_MOTES);
  moteMesh.name = 'DramaMotes';
  moteMesh.frustumCulled = false;
  group.add(moteMesh);

  const motes = Array.from({ length: MAX_MOTES }, () => ({
    alive: false,
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    color: new THREE.Color(0xffffff),
    age: 0,
    life: 1.0,
    size0: 0.8,
    size1: 0.2,
    gravity: 0,
  }));
  let moteCursor = 0;

  function emitMote({ x, y, z, vx = 0, vy = 0.5, vz = 0, hex = 0xffffff, life = 1.1, size0 = 0.7, size1 = 0.1, gravity = 0 }) {
    const m = motes[moteCursor % MAX_MOTES];
    moteCursor++;
    m.alive = true;
    m.p.set(x, y, z);
    m.v.set(vx, vy, vz);
    m.color.setHex(hex);
    m.age = 0;
    m.life = life;
    m.size0 = size0;
    m.size1 = size1;
    m.gravity = gravity;
  }

  function emitBurst(x, y, z, hex = 0xffe484, count = 8, speed = 1.4) {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const spd = (0.45 + rng() * 0.75) * speed;
      emitMote({
        x, y: y + 0.14, z,
        vx: Math.cos(a) * spd * 0.7,
        vy: 0.65 + rng() * speed,
        vz: Math.sin(a) * spd * 0.7,
        hex,
        life: 0.55 + rng() * 0.45,
        size0: 0.58,
        size1: 0.05,
        gravity: -2.4,
      });
    }
  }

  // 2. Instanced Nocturnal & Unexpected Signature Water Halos (glowStrength + magnet rings!)
  const MAX_HALOS = 20;
  const haloGeo = new THREE.RingGeometry(0.16, 0.44, 24);
  haloGeo.rotateX(-Math.PI / 2);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.56,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const haloMesh = new THREE.InstancedMesh(haloGeo, haloMat, MAX_HALOS);
  haloMesh.name = 'NocturnalDuckHalos';
  haloMesh.frustumCulled = false;
  group.add(haloMesh);

  // 3. Handcrafted Lacquered Bamboo Fishing Rod + Smooth 16-Pt Catenary Line + Gourd Bobber + 3D Catch Reveal
  const fishingRig = new THREE.Group();
  fishingRig.name = 'UI_Station_FishingPier';
  fishingRig.position.copy(PIER_POS);

  const vertexColorMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.34,
    metalness: 0.22,
  });

  const rodMesh = new THREE.Mesh(buildBambooRodGeo(), vertexColorMat);
  rodMesh.name = 'BambooFishingRod';
  rodMesh.rotation.x = 1.02;
  fishingRig.add(rodMesh);

  const rodTipAnchor = new THREE.Object3D();
  rodTipAnchor.position.set(0, 2.84, 0);
  rodMesh.add(rodTipAnchor);
  group.add(fishingRig);

  // Floating red-and-ivory traditional wooden bobber + dual delicate wave rings
  const bobberGroup = new THREE.Group();
  bobberGroup.name = 'CoastalFishingBobber';
  const bobberMesh = new THREE.Mesh(buildBobberGeo(), vertexColorMat);
  const bobRing = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.24, 28),
    new THREE.MeshBasicMaterial({ color: 0xbafef4, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
  );
  bobRing.rotation.x = -Math.PI / 2;
  bobRing.position.y = -0.02;
  const bobRingOuter = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.36, 28),
    new THREE.MeshBasicMaterial({ color: 0xbafef4, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  );
  bobRingOuter.rotation.x = -Math.PI / 2;
  bobRingOuter.position.y = -0.025;
  bobberGroup.add(bobberMesh, bobRing, bobRingOuter);
  bobberGroup.position.copy(BOBBER_REST_POS);
  group.add(bobberGroup);

  // Smooth 16-segment catenary fishing line
  const LINE_SEGS = 16;
  const linePts = Array.from({ length: LINE_SEGS + 1 }, () => new THREE.Vector3());
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe6faf6, transparent: true, opacity: 0.62 });
  const fishingLine = new THREE.Line(lineGeo, lineMat);
  fishingLine.frustumCulled = false;
  group.add(fishingLine);

  // 3D Catch Reveal Treasure (lifts out of ocean when reeling in a reward, tinted to species rarity!)
  const catchMat = vertexColorMat.clone();
  const catchMesh = new THREE.Mesh(buildCatchTreasureGeo(), catchMat);
  catchMesh.name = 'CoastalCatchReveal';
  catchMesh.visible = false;
  group.add(catchMesh);
  let catchRevealT = 0;

  function triggerCatchReveal(accentHex = 0xffe680) {
    catchRevealT = 0.001;
    catchMesh.visible = true;
    catchMat.emissive.setHex(accentHex);
    catchMat.emissiveIntensity = 0.52;
    emitBurst(bobberGroup.position.x, bobberGroup.position.y + 0.15, bobberGroup.position.z, accentHex, 20, 2.3);
  }

  // 4. Living Sanctuary Ecosystem — 6 Underwater Golden/Vermilion Koi in Upper Emerald Pool
  const KOI_COUNT = 6;
  const koiMesh = new THREE.InstancedMesh(buildKoiGeo(), vertexColorMat, KOI_COUNT);
  koiMesh.name = 'PoolKoi';
  koiMesh.frustumCulled = false;
  group.add(koiMesh);
  const koiSpecs = Array.from({ length: KOI_COUNT }, (_, i) => ({
    cx: 1.5 + (i % 3) * 3.4,
    cz: -1.6 + Math.floor(i / 3) * 2.2,
    rx: 1.8 + (i % 2) * 0.9,
    rz: 1.2 + ((i + 1) % 2) * 0.7,
    speed: 0.24 + i * 0.035,
    phase: i * 1.15,
    scale: 0.82 + (i % 3) * 0.16,
  }));

  // 5. Living Sanctuary Ecosystem — 4 Gliding Coastal Seagulls Circling Over the Bay
  const GULL_COUNT = 4;
  const gullMesh = new THREE.InstancedMesh(buildSeagullGeo(), vertexColorMat, GULL_COUNT);
  gullMesh.name = 'CoastalSeagulls';
  gullMesh.frustumCulled = false;
  group.add(gullMesh);
  const gullSpecs = Array.from({ length: GULL_COUNT }, (_, i) => ({
    rad: 26 + i * 8.5,
    alt: 10.5 + i * 2.8,
    speed: 0.14 + i * 0.025,
    phase: i * 1.62,
    scale: 0.95 + (i % 2) * 0.22,
  }));

  // 5b. Interactive Floating Onsen Yuzu Citrus Pool Toys (1 instanced draw call; ducks gather around them!)
  const MAX_YUZU = 6;
  const yuzuMesh = new THREE.InstancedMesh(buildYuzuGeo(), vertexColorMat, MAX_YUZU);
  yuzuMesh.name = 'FloatingYuzuToys';
  yuzuMesh.frustumCulled = false;
  group.add(yuzuMesh);
  const yuzuSlots = Array.from({ length: MAX_YUZU }, () => ({
    active: false, x: 0, y: -0.10, z: 0, age: 0, life: 16.0, phase: 0,
  }));
  let yuzuCursor = 0;

  function spawnYuzu(x, y, z) {
    const sl = yuzuSlots[yuzuCursor % MAX_YUZU];
    yuzuCursor++;
    sl.active = true;
    sl.x = x;
    sl.y = y;
    sl.z = z;
    sl.age = 0;
    sl.life = 16.0;
    sl.phase = rng() * Math.PI * 2;
    emitBurst(x, y + 0.12, z, 0xffd858, 10, 1.35);
    return sl;
  }

  function getActiveYuzus() {
    return yuzuSlots.filter((s) => s.active);
  }

  // 6. 3D Atmospheric Weather Particles (Organic Pointed Petals / Sleek Rain Streaks / Mist Wisps)
  const WEATHER_COUNT = 140;
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, -0.095);
  petalShape.quadraticCurveTo(0.072, -0.02, 0.048, 0.068);
  petalShape.quadraticCurveTo(0.0, 0.11, -0.048, 0.068);
  petalShape.quadraticCurveTo(-0.072, -0.02, 0, -0.095);
  const weatherGeo = new THREE.ShapeGeometry(petalShape, 5);
  const weatherMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const weatherMesh = new THREE.InstancedMesh(weatherGeo, weatherMat, WEATHER_COUNT);
  weatherMesh.name = 'WeatherParticles';
  weatherMesh.frustumCulled = false;
  weatherMesh.visible = false;
  group.add(weatherMesh);

  const weatherItems = Array.from({ length: WEATHER_COUNT }, () => ({
    x: (rng() - 0.5) * 34,
    y: rng() * 14,
    z: (rng() - 0.5) * 32,
    speed: 0.75 + rng() * 0.55,
    phase: rng() * Math.PI * 2,
    huePick: rng(),
  }));

  // 7. Pooled World-Space Diegetic Duck Emote Pops (⚡, 🧲, 👑, ♥, 🎵, 💦, ✨)
  const EMOTE_MAX = 10;
  const emoteTextures = createEmoteTextureMap();
  const emotePool = Array.from({ length: EMOTE_MAX }, () => {
    const mat = new THREE.SpriteMaterial({
      map: emoteTextures.star || null,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.visible = false;
    sp.scale.setScalar(0.55);
    group.add(sp);
    return { sprite: sp, mat, age: 0, life: 1.25, active: false, baseY: 0 };
  });
  let emoteCursor = 0;

  function emitEmote(x, y, z, kind = 'star') {
    const tex = emoteTextures[kind] || emoteTextures.star;
    if (!tex) return;
    const e = emotePool[emoteCursor % EMOTE_MAX];
    emoteCursor++;
    e.active = true;
    e.age = 0;
    e.life = 1.20;
    e.baseY = y + 0.44;
    e.mat.map = tex;
    e.mat.opacity = 1.0;
    e.mat.needsUpdate = true;
    e.sprite.position.set(x, e.baseY, z);
    e.sprite.scale.setScalar(0.14);
    e.sprite.visible = true;
  }

  const _m4 = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _euler = new THREE.Euler();
  const _scale = new THREE.Vector3();
  const _col = new THREE.Color();
  const _rodTipWorld = new THREE.Vector3();
  let steamTimer = 0;
  let beaconTimer = 0;
  let poolSteamTimer = 0;

  function update(dt, t, { duckEntries = [], fishingPhase = 'idle', fishingTension = 0.25, fishingProgress = 0, activeBait = 'basic', focusMode = null, night = 0.5, weather = null } = {}) {
    steamTimer += dt;
    beaconTimer += dt;
    poolSteamTimer += dt;

    // 0. Soft rising warm thermal onsen steam wisps over Upper Emerald Pool & Lower Grotto (batched into DramaMotes!)
    if (focusMode !== 'campfire' && focusMode !== 'onsen' && poolSteamTimer >= 0.24) {
      poolSteamTimer = 0;
      const steamChance = 0.42 + night * 0.34;
      if (rng() < steamChance) {
        emitMote({
          x: -0.6 + rng() * 6.8,
          y: -0.08,
          z: -3.1 + rng() * 3.8,
          vx: (rng() - 0.5) * 0.14,
          vy: 0.28 + rng() * 0.16,
          vz: (rng() - 0.5) * 0.12,
          hex: 0xdff6f2,
          life: 2.3,
          size0: 0.72,
          size1: 2.15,
          gravity: 0.03,
        });
      }
      if (rng() < steamChance * 0.65) {
        emitMote({
          x: -1.8 + rng() * 4.2,
          y: -2.05,
          z: 11.4 + rng() * 3.6,
          vx: (rng() - 0.5) * 0.12,
          vy: 0.30 + rng() * 0.18,
          vz: (rng() - 0.5) * 0.12,
          hex: 0xffe9d2,
          life: 2.1,
          size0: 0.68,
          size1: 1.95,
          gravity: 0.04,
        });
      }
    }

    // 1. Thermal steam above hearth ducks + sparkles above magnet / snow-globe ducks
    if (steamTimer >= 0.14) {
      steamTimer = 0;
      for (const d of duckEntries) {
        if (!d.obj.visible || !d.physPose) continue;
        if (d.physPose.emitSteam && rng() < 0.58) {
          emitMote({
            x: d.obj.position.x + (rng() - 0.5) * 0.12,
            y: d.obj.position.y + 0.34,
            z: d.obj.position.z + (rng() - 0.5) * 0.12,
            vx: (rng() - 0.5) * 0.08,
            vy: 0.36 + rng() * 0.18,
            vz: (rng() - 0.5) * 0.08,
            hex: 0xffe9cc,
            life: 1.25,
            size0: 0.55,
            size1: 1.15,
            gravity: 0.08,
          });
        } else if (d.physPose.trait === 'magnet' && rng() < 0.35) {
          emitMote({
            x: d.obj.position.x + (rng() - 0.5) * 0.25,
            y: d.obj.position.y + 0.22,
            z: d.obj.position.z + (rng() - 0.5) * 0.25,
            vx: 0, vy: 0.25, vz: 0,
            hex: 0xff6b7a,
            life: 0.65,
            size0: 0.42,
            size1: 0.05,
          });
        } else if (d.designId === '22-snow-globe' && rng() < 0.32) {
          emitMote({
            x: d.obj.position.x + (rng() - 0.5) * 0.22,
            y: d.obj.position.y + 0.45,
            z: d.obj.position.z + (rng() - 0.5) * 0.22,
            vx: (rng() - 0.5) * 0.08,
            vy: -0.18,
            vz: (rng() - 0.5) * 0.08,
            hex: 0xe6f8ff,
            life: 0.95,
            size0: 0.36,
            size1: 0.12,
          });
        }
      }
    }

    // 2. Zero-UI station fireflies + evening grotto fireflies
    if (!focusMode && beaconTimer >= 0.30) {
      beaconTimer = 0;
      const b = STATION_BEACONS[Math.floor(rng() * STATION_BEACONS.length)];
      emitMote({
        x: b.pos.x + (rng() - 0.5) * 0.55,
        y: b.pos.y + (rng() - 0.5) * 0.22,
        z: b.pos.z + (rng() - 0.5) * 0.55,
        vx: (rng() - 0.5) * 0.09,
        vy: 0.22 + rng() * 0.14,
        vz: (rng() - 0.5) * 0.09,
        hex: b.color,
        life: 1.85,
        size0: 0.48,
        size1: 0.04,
      });
      if (night > 0.38) {
        // Warm golden fireflies dancing over the Lower Grotto ferns at twilight/night
        const fa = rng() * Math.PI * 2;
        const fr = 4.3 + rng() * 1.4;
        emitMote({
          x: 0.2 + Math.cos(fa) * fr,
          y: -1.4 + rng() * 1.1,
          z: 13.2 + Math.sin(fa) * fr,
          vx: (rng() - 0.5) * 0.24,
          vy: 0.12 + (rng() - 0.5) * 0.16,
          vz: (rng() - 0.5) * 0.24,
          hex: 0xffe474,
          life: 2.2,
          size0: 0.52,
          size1: 0.05,
        });
      }
    }

    // Update instanced motes
    for (let i = 0; i < MAX_MOTES; i++) {
      const m = motes[i];
      if (!m.alive) {
        _m4.makeScale(0, 0, 0);
        moteMesh.setMatrixAt(i, _m4);
        continue;
      }
      m.age += dt;
      if (m.age >= m.life) {
        m.alive = false;
        _m4.makeScale(0, 0, 0);
        moteMesh.setMatrixAt(i, _m4);
        continue;
      }
      const u = m.age / m.life;
      m.v.y += m.gravity * dt;
      m.p.addScaledVector(m.v, dt);
      const s = THREE.MathUtils.lerp(m.size0, m.size1, u) * Math.sin(Math.min(1, u * 4) * Math.PI * 0.5);
      _scale.setScalar(Math.max(0.001, s));
      _quat.identity();
      _m4.compose(m.p, _quat, _scale);
      moteMesh.setMatrixAt(i, _m4);
      const fade = 1 - u * u;
      _col.copy(m.color).multiplyScalar(fade);
      moteMesh.setColorAt(i, _col);
    }
    moteMesh.instanceMatrix.needsUpdate = true;
    if (moteMesh.instanceColor) moteMesh.instanceColor.needsUpdate = true;

    // 3. Nocturnal & Magnet/Crown Signature Halos on water
    let hIdx = 0;
    for (const d of duckEntries) {
      if (hIdx >= MAX_HALOS) break;
      if (!d.obj.visible || !d.physPose) continue;
      const isMagnet = d.physPose.trait === 'magnet';
      const isCrown = d.physPose.trait === 'crown';
      const glow = d.physPose.glowStrength || 0;
      if (glow <= 0.08 && !isMagnet && !isCrown) continue;

      const pulse = 0.88 + 0.16 * Math.sin(t * (isMagnet ? 5.2 : 2.8) + d.phase);
      const g = isMagnet ? 0.65 * pulse : isCrown ? 0.42 * pulse : Math.min(1, glow) * pulse;
      _pos.set(d.obj.position.x, d.obj.position.y + 0.035, d.obj.position.z);
      _scale.setScalar((isMagnet ? 1.15 : 0.88) + 0.42 * g);
      _quat.identity();
      _m4.compose(_pos, _quat, _scale);
      haloMesh.setMatrixAt(hIdx, _m4);
      const tintHex = isMagnet ? 0xff647a
        : isCrown ? 0xffd252
        : d.designId === '24-lantern' ? 0xffd27a
        : d.designId === '19-moon' ? 0xa6c8ff
        : 0x8ef7ff;
      _col.setHex(tintHex).multiplyScalar(0.45 + 0.65 * g);
      haloMesh.setColorAt(hIdx, _col);
      hIdx++;
    }
    for (let i = hIdx; i < MAX_HALOS; i++) {
      _m4.makeScale(0, 0, 0);
      haloMesh.setMatrixAt(i, _m4);
    }
    haloMesh.instanceMatrix.needsUpdate = true;
    if (haloMesh.instanceColor) haloMesh.instanceColor.needsUpdate = true;
    haloMesh.visible = hIdx > 0 && focusMode !== 'campfire';

    // 4. Underwater Koi gliding gently beneath Upper Emerald Pool
    const showEco = focusMode !== 'campfire' && focusMode !== 'onsen';
    koiMesh.visible = showEco;
    if (showEco) {
      for (let i = 0; i < KOI_COUNT; i++) {
        const k = koiSpecs[i];
        const a = t * k.speed + k.phase;
        const x = k.cx + Math.cos(a) * k.rx;
        const z = k.cz + Math.sin(a * 2.0) * 0.5 * k.rz;
        const dx = -Math.sin(a) * k.rx * k.speed;
        const dz = Math.cos(a * 2.0) * k.rz * k.speed;
        const yaw = Math.atan2(dx, dz) + Math.sin(t * 7.5 + k.phase) * 0.09;
        _pos.set(x, -0.74 + Math.sin(t * 1.4 + k.phase) * 0.04, z);
        _euler.set(0, yaw, 0);
        _quat.setFromEuler(_euler);
        _scale.setScalar(k.scale);
        _m4.compose(_pos, _quat, _scale);
        koiMesh.setMatrixAt(i, _m4);
      }
      koiMesh.instanceMatrix.needsUpdate = true;
    }

    // 5. Gliding Coastal Seagulls above the bay
    const showGulls = showEco && night < 0.72;
    gullMesh.visible = showGulls;
    if (showGulls) {
      for (let i = 0; i < GULL_COUNT; i++) {
        const g = gullSpecs[i];
        const a = t * g.speed + g.phase;
        const x = Math.cos(a) * g.rad;
        const z = Math.sin(a) * g.rad + 4.0;
        const y = g.alt + Math.sin(t * 1.3 + g.phase) * 1.1;
        const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
        const bank = 0.16 + Math.sin(t * 3.8 + g.phase) * 0.12;
        _pos.set(x, y, z);
        _euler.set(0, yaw, bank);
        _quat.setFromEuler(_euler);
        _scale.setScalar(g.scale);
        _m4.compose(_pos, _quat, _scale);
        gullMesh.setMatrixAt(i, _m4);
      }
      gullMesh.instanceMatrix.needsUpdate = true;
    }

    // 5b. Floating Yuzu Citrus Toys (bobbing & emitting fragrant citrus steam motes)
    let anyYuzu = false;
    for (let i = 0; i < MAX_YUZU; i++) {
      const yz = yuzuSlots[i];
      if (!yz.active) {
        _m4.makeScale(0, 0, 0);
        yuzuMesh.setMatrixAt(i, _m4);
        continue;
      }
      yz.age += dt;
      if (yz.age >= yz.life) {
        yz.active = false;
        _m4.makeScale(0, 0, 0);
        yuzuMesh.setMatrixAt(i, _m4);
        continue;
      }
      anyYuzu = true;
      const u = yz.age / yz.life;
      const dropIn = Math.min(1, yz.age / 0.25);
      const fadeOut = u > 0.88 ? Math.max(0, 1 - (u - 0.88) / 0.12) : 1;
      const bob = Math.sin(t * 2.6 + yz.phase) * 0.025 + (1 - dropIn) * 0.45;
      _pos.set(yz.x, yz.y + bob, yz.z);
      _euler.set(Math.sin(t * 1.5 + yz.phase) * 0.18, t * 0.55 + yz.phase, Math.cos(t * 1.3 + yz.phase) * 0.16);
      _quat.setFromEuler(_euler);
      _scale.setScalar(Math.max(0.01, fadeOut));
      _m4.compose(_pos, _quat, _scale);
      yuzuMesh.setMatrixAt(i, _m4);
      if (steamTimer === 0 && rng() < 0.4) {
        emitMote({ x: yz.x, y: yz.y + 0.18, z: yz.z, vy: 0.28, hex: 0xffe274, life: 0.9, size0: 0.4, size1: 0.05 });
      }
    }
    yuzuMesh.visible = anyYuzu && focusMode !== 'campfire' && focusMode !== 'onsen';
    if (anyYuzu) yuzuMesh.instanceMatrix.needsUpdate = true;

    // 6. 3D Atmospheric Weather Particles (Rain Streaks / Drifting Petals / Mist Wisps)
    const rainAmt = weather?.rain || 0;
    const petalAmt = weather?.petals || 0;
    const mistAmt = weather?.mist || 0;
    const activeWeather = Math.max(rainAmt, petalAmt, mistAmt);
    weatherMesh.visible = showEco && activeWeather > 0.04;
    if (weatherMesh.visible) {
      const isRain = rainAmt >= petalAmt && rainAmt >= mistAmt;
      const isPetals = petalAmt > rainAmt && petalAmt >= mistAmt;
      weatherMat.opacity = isRain ? 0.56 * rainAmt : isPetals ? 0.88 * petalAmt : 0.24 * mistAmt;
      for (let i = 0; i < WEATHER_COUNT; i++) {
        const w = weatherItems[i];
        if (isRain) {
          w.y -= dt * (14.5 * w.speed);
          w.x -= dt * 1.9;
          if (w.y < -3.0) {
            w.y = 12.5 + (w.phase % 2.5);
            w.x = ((i * 7.31) % 34) - 17;
            w.z = ((i * 11.17) % 32) - 14;
          }
          _pos.set(w.x, w.y, w.z);
          _euler.set(0, 0, -0.14);
          _quat.setFromEuler(_euler);
          _scale.set(0.14, 3.4, 1.0);
          _col.setHex(0xc8ecff);
        } else if (isPetals) {
          w.y -= dt * (1.05 * w.speed);
          w.x += Math.sin(t * 1.4 + w.phase) * dt * 1.25 + dt * 0.55;
          w.z += Math.cos(t * 1.1 + w.phase) * dt * 0.65;
          if (w.y < -2.2) {
            w.y = 10.5 + (w.phase % 3.0);
            w.x = ((i * 5.77) % 30) - 15;
            w.z = ((i * 9.37) % 28) - 12;
          }
          _pos.set(w.x, w.y, w.z);
          _euler.set(t * 1.8 + w.phase, t * 1.3 + w.phase, t * 2.1);
          _quat.setFromEuler(_euler);
          _scale.set(1.35, 1.05, 1.0);
          _col.setHex(w.huePick > 0.42 ? 0xd93a4a : 0xffb7cc); // Crimson Japanese maple + soft sakura blush!
        } else {
          w.x += dt * 0.42 * w.speed;
          if (w.x > 18) w.x = -18;
          _pos.set(w.x, 0.4 + (w.phase % 4.5), w.z);
          _euler.set(0, t * 0.1 + w.phase, 0);
          _quat.setFromEuler(_euler);
          _scale.set(5.5, 2.2, 1.0);
          _col.setHex(0xd4e8ee);
        }
        _m4.compose(_pos, _quat, _scale);
        weatherMesh.setMatrixAt(i, _m4);
        weatherMesh.setColorAt(i, _col);
      }
      weatherMesh.instanceMatrix.needsUpdate = true;
      if (weatherMesh.instanceColor) weatherMesh.instanceColor.needsUpdate = true;
    }

    // 7. World-Space Diegetic Emote Pops
    for (let i = 0; i < EMOTE_MAX; i++) {
      const e = emotePool[i];
      if (!e.active) continue;
      e.age += dt;
      if (e.age >= e.life) {
        e.active = false;
        e.sprite.visible = false;
        continue;
      }
      const u = e.age / e.life;
      const pop = u < 0.16 ? Math.sin((u / 0.16) * Math.PI * 0.5) * 1.08 : 1.0 - (u - 0.16) * 0.12;
      e.sprite.position.y = e.baseY + u * 0.38;
      e.sprite.scale.setScalar(0.34 * pop);
      e.mat.opacity = u < 0.7 ? 0.94 : (1.0 - (u - 0.7) / 0.3) * 0.94;
    }

    // 0b. Update soft Japanese Onsen volumetric thermal steam puffs (1 instanced draw call!)
    const showSteam = focusMode !== 'campfire' && focusMode !== 'onsen';
    steamMesh.visible = showSteam;
    if (showSteam) {
      steamMat.opacity = 0.15 + night * 0.11;
      for (let i = 0; i < STEAM_COUNT; i++) {
        const sp = steamPuffs[i];
        const u = (t * sp.speed + sp.phase) % 1;
        const env = Math.sin(u * Math.PI);
        const sx = sp.scale * (0.75 + u * 0.72) * Math.max(0.01, env);
        _pos.set(
          sp.cx + Math.sin(t * 0.55 + sp.phase * 3.0) * 0.42,
          sp.baseY + u * 1.55,
          sp.cz + Math.cos(t * 0.48 + sp.phase * 2.4) * 0.32
        );
        _euler.set(-0.34, Math.sin(t * 0.25 + sp.phase) * 0.35, t * 0.08 + sp.phase);
        _quat.setFromEuler(_euler);
        _scale.set(sx, sx * 0.82, 1);
        _m4.compose(_pos, _quat, _scale);
        steamMesh.setMatrixAt(i, _m4);
      }
      steamMesh.instanceMatrix.needsUpdate = true;
    }

    // 8. 3D Coastal Pier Bamboo Rod, Smooth 16-Segment Catenary Line, Tactile Reeling & 3D Catch Reveal
    const isBiting = fishingPhase === 'biting';
    const isReeling = fishingPhase === 'reeling';
    const isActiveHook = isBiting || isReeling;
    const pullLerp = isReeling ? THREE.MathUtils.clamp(fishingProgress, 0, 1) * 0.36 : 0;
    const targetBob = fishingPhase === 'idle'
      ? BOBBER_REST_POS
      : _pos.lerpVectors(BOBBER_CAST_POS, BOBBER_REST_POS, pullLerp);
    bobberGroup.position.lerp(targetBob, 1 - Math.exp(-dt * (isReeling ? 8.5 : 5.5)));
    const biteDip = isReeling
      ? Math.sin(t * 28) * 0.09 - 0.05
      : isBiting
        ? Math.sin(t * 24) * 0.12 - 0.07
        : Math.sin(t * 2.2) * 0.04;
    bobberGroup.position.y = targetBob.y + biteDip;
    bobberMesh.rotation.z = isActiveHook ? Math.sin(t * 22) * (0.24 + 0.14 * fishingTension) : Math.sin(t * 1.8) * 0.08;

    if (isReeling && steamTimer === 0 && rng() < 0.72) {
      emitMote({
        x: bobberGroup.position.x + (rng() - 0.5) * 0.35,
        y: bobberGroup.position.y + 0.14,
        z: bobberGroup.position.z + (rng() - 0.5) * 0.35,
        vx: (rng() - 0.5) * 0.9,
        vy: 0.75 + rng() * 0.65,
        vz: (rng() - 0.5) * 0.9,
        hex: 0xb6fff4,
        life: 0.52,
        size0: 0.58,
        size1: 0.08,
        gravity: -2.2,
      });
    }

    const baitRingHex = activeBait === 'smore' ? 0xff9248
      : activeBait === 'yuzu' ? 0xffd858
      : activeBait === 'ink' ? 0x7cb8ff
      : 0x9efce8;
    const ringPhase = (t * (isReeling ? 3.1 : isBiting ? 2.4 : 0.75)) % 1;
    bobRing.scale.setScalar(1.05 + ringPhase * (isActiveHook ? 2.85 : 1.55));
    bobRing.material.opacity = (1 - ringPhase) * (isActiveHook ? 0.92 : 0.60);
    bobRing.material.color.setHex(isReeling ? 0x6efce4 : isBiting ? 0xffe268 : baitRingHex);

    const ringPhase2 = (ringPhase + 0.5) % 1;
    bobRingOuter.scale.setScalar(1.05 + ringPhase2 * (isActiveHook ? 2.85 : 1.55));
    bobRingOuter.material.opacity = (1 - ringPhase2) * (isActiveHook ? 0.62 : 0.45);
    bobRingOuter.material.color.setHex(baitRingHex);

    const rodBend = isReeling
      ? 0.18 + 0.26 * fishingTension + Math.sin(t * 26) * 0.055
      : isBiting
        ? Math.sin(t * 20) * 0.085
        : Math.sin(t * 1.3) * 0.014;
    rodMesh.rotation.x = 1.14 + rodBend;
    fishingRig.updateMatrixWorld(true);
    rodTipAnchor.getWorldPosition(_rodTipWorld);

    // Smooth catenary curve from rod tip to bobber eyelet
    const posAttr = lineGeo.attributes.position;
    const sag = isReeling ? 0.025 : isBiting ? 0.06 : 0.52;
    for (let i = 0; i <= LINE_SEGS; i++) {
      const u = i / LINE_SEGS;
      const lx = THREE.MathUtils.lerp(_rodTipWorld.x, bobberGroup.position.x, u);
      const ly = THREE.MathUtils.lerp(_rodTipWorld.y, bobberGroup.position.y + 0.24, u) - Math.sin(u * Math.PI) * sag;
      const lz = THREE.MathUtils.lerp(_rodTipWorld.z, bobberGroup.position.z, u);
      posAttr.setXYZ(i, lx, ly, lz);
    }
    posAttr.needsUpdate = true;

    // 3D Catch Reveal arc rising out of the ocean toward the pier
    if (catchRevealT > 0) {
      catchRevealT += dt * 0.78;
      if (catchRevealT >= 1) {
        catchRevealT = 0;
        catchMesh.visible = false;
      } else {
        const u = catchRevealT;
        const arcY = Math.sin(u * Math.PI) * 2.6;
        catchMesh.position.set(
          THREE.MathUtils.lerp(BOBBER_CAST_POS.x, PIER_POS.x, u),
          THREE.MathUtils.lerp(BOBBER_CAST_POS.y, PIER_POS.y + 0.65, u) + arcY,
          THREE.MathUtils.lerp(BOBBER_CAST_POS.z, PIER_POS.z, u)
        );
        catchMesh.rotation.y = u * Math.PI * 5;
        catchMesh.rotation.z = Math.sin(u * Math.PI * 2) * 0.35;
        catchMesh.scale.setScalar(1.35 * Math.sin(Math.min(1, u * 4) * Math.PI * 0.5));
      }
    }

    fishingRig.visible = focusMode !== 'campfire' && focusMode !== 'onsen';
    bobberGroup.visible = fishingRig.visible;
    fishingLine.visible = fishingRig.visible;
  }

  function emitWaterJet(x, y, z, yaw = 0, power = 1.0) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const count = Math.round(12 + power * 10);
    for (let i = 0; i < count; i++) {
      const spd = (2.4 + rng() * 2.6) * (0.65 + power * 0.55);
      const spreadX = (rng() - 0.5) * 0.55;
      const spreadZ = (rng() - 0.5) * 0.55;
      emitMote(
        x + fx * 0.16,
        y + 0.14,
        z + fz * 0.16,
        fx * spd + spreadX,
        0.95 + rng() * 1.15,
        fz * spd + spreadZ,
        i % 3 === 0 ? 0xffffff : 0x76e8ff,
        0.55 + rng() * 0.35,
      );
    }
  }

  return {
    group,
    fishingRig,
    bobberGroup,
    emitBurst,
    emitMote,
    emitEmote,
    emitWaterJet,
    spawnYuzu,
    getActiveYuzus,
    triggerCatchReveal,
    update,
  };
}
