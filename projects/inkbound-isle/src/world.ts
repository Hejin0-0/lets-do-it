import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BuildType, Resource } from './gameplay.ts';
import { addInkedPart, createContactShadow, makeGhost, toonMaterial, TOON_GRADIENT, type SurfaceKind } from './materials.ts';
import { BIOME_COLORS, PALETTE } from './palette.ts';

export const WORLD_SIZE = 140;
export const WORLD_SEED = 2718;
export const SEA_LEVEL = 0;
export type Biome = 'jungle' | 'plains' | 'coast' | 'highlands';

export interface ResourceSpawn {
  kind: Resource;
  x: number;
  z: number;
}

export type DetailKind = 'grass' | 'brush' | 'rock' | 'log' | 'mushroom';

export interface DetailSpawn {
  kind: DetailKind;
  biome: Biome;
  x: number;
  z: number;
  scale: number;
  yaw: number;
  variant: number;
}

export interface GroundDabSpawn {
  x: number;
  z: number;
  scaleX: number;
  scaleZ: number;
  yaw: number;
  tone: 0 | 1;
}

export interface ResourceNode {
  id: string;
  root: THREE.Group;
  kind: Resource;
  amount: number;
  active: boolean;
}

export interface WorldVisuals {
  root: THREE.Group;
  resources: ResourceNode[];
  interactables: THREE.Object3D[];
  updateDay: (timeOfDay: number) => void;
  update: (elapsed: number) => void;
  detailCount: number;
  landmarkCount: number;
}

const fract = (value: number) => value - Math.floor(value);

function hash2(x: number, z: number, seed: number): number {
  return fract(Math.sin(x * 127.1 + z * 311.7 + seed * 0.017) * 43758.5453);
}

export function heightAt(x: number, z: number, seed = WORLD_SEED): number {
  const radius = Math.hypot(x, z) / (WORLD_SIZE * 0.5);
  const island = 8.4 * (1 - radius * radius) - 2.4;
  const broad = Math.sin(x * 0.11 + seed * 0.013) * 0.8
    + Math.cos(z * 0.09 - seed * 0.008) * 0.65
    + Math.sin((x + z) * 0.05 + seed * 0.003) * 0.55;
  const highland = Math.exp(-(((x - 23) ** 2 + (z + 25) ** 2) / 620)) * 4.6;
  return island + broad + highland;
}

export function shoreRadiusAt(angle: number, seed = WORLD_SEED): number {
  let dry = 38;
  let wet = WORLD_SIZE * 0.55;
  for (let index = 0; index < 12; index += 1) {
    const radius = (dry + wet) * 0.5;
    const height = heightAt(Math.sin(angle) * radius, Math.cos(angle) * radius, seed);
    if (height > 0.08) dry = radius;
    else wet = radius;
  }
  return (dry + wet) * 0.5;
}

export function biomeAt(x: number, z: number, seed = WORLD_SEED): Biome {
  const height = heightAt(x, z, seed);
  if (height < 1.25 || Math.hypot(x, z) > WORLD_SIZE * 0.43) return 'coast';
  if (z < -14 && x > -15) return 'highlands';
  if (x < -7 || z > 24) return 'jungle';
  return 'plains';
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function insideApexSetpieceClearance(x: number, z: number): boolean {
  if (Math.hypot(x - 25, z + 30) < 13 || Math.hypot(x - 10, z + 27) < 7.5) return true;
  const startX = 19;
  const startZ = -8;
  const dx = 6;
  const dz = -22;
  const t = THREE.MathUtils.clamp(((x - startX) * dx + (z - startZ) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - (startX + dx * t), z - (startZ + dz * t)) < 6.2;
}

export function generateResourceSpawns(seed = WORLD_SEED): ResourceSpawn[] {
  const random = seededRandom(seed);
  const plan: ReadonlyArray<readonly [Resource, number]> = [
    ['wood', 16],
    ['stone', 12],
    ['fiber', 12],
    ['berries', 10],
  ];
  const accepted: Record<Resource, readonly Biome[]> = {
    wood: ['jungle', 'plains'],
    stone: ['highlands', 'plains', 'coast'],
    fiber: ['plains', 'coast', 'jungle'],
    berries: ['jungle', 'plains'],
  };
  const spawns: ResourceSpawn[] = [];

  for (const [kind, count] of plan) {
    let placed = 0;
    for (let attempt = 0; attempt < 1_000 && placed < count; attempt += 1) {
      const x = (random() - 0.5) * (WORLD_SIZE - 12);
      const z = (random() - 0.5) * (WORLD_SIZE - 12);
      if (heightAt(x, z, seed) <= 0.7 || Math.hypot(x, z) < 9 || insideApexSetpieceClearance(x, z)) continue;
      if (!accepted[kind].includes(biomeAt(x, z, seed))) continue;
      if (spawns.some((spawn) => Math.hypot(spawn.x - x, spawn.z - z) < 2.4)) continue;
      spawns.push({ kind, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
      placed += 1;
    }
  }
  return spawns;
}

export function generateDetailSpawns(seed = WORLD_SEED): DetailSpawn[] {
  const random = seededRandom(seed + 401);
  const plan: ReadonlyArray<readonly [DetailKind, number, readonly Biome[]]> = [
    ['grass', 720, ['jungle', 'plains', 'coast', 'highlands']],
    ['brush', 140, ['jungle', 'plains']],
    ['rock', 95, ['highlands', 'coast', 'plains']],
    ['log', 45, ['jungle', 'plains']],
    ['mushroom', 55, ['jungle', 'highlands']],
  ];
  const spawns: DetailSpawn[] = [];
  for (const [kind, count, accepted] of plan) {
    let placed = 0;
    let cluster: { x: number; z: number; remaining: number } | null = null;
    for (let attempt = 0; attempt < count * 60 && placed < count; attempt += 1) {
      const currentCluster: { x: number; z: number; remaining: number } | null = cluster;
      const useCluster: boolean = currentCluster !== null && currentCluster.remaining > 0 && random() < 0.82;
      const angle = random() * Math.PI * 2;
      const radius = 0.75 + random() * 3.4;
      const x: number = useCluster && currentCluster ? currentCluster.x + Math.sin(angle) * radius : (random() - 0.5) * (WORLD_SIZE - 8);
      const z: number = useCluster && currentCluster ? currentCluster.z + Math.cos(angle) * radius : (random() - 0.5) * (WORLD_SIZE - 8);
      const biome = biomeAt(x, z, seed);
      // ponytail: bounded 1,055-instance scan; use a spatial hash only if the density budget grows.
      if (heightAt(x, z, seed) <= 0.35
        || Math.hypot(x, z) <= 6
        || insideApexSetpieceClearance(x, z)
        || !accepted.includes(biome)
        || spawns.some((spawn) => spawn.kind === kind && Math.hypot(spawn.x - x, spawn.z - z) < 0.42)) continue;
      spawns.push({
        kind,
        biome,
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
        scale: Math.round((0.72 + random() * 0.7) * 100) / 100,
        yaw: Math.round(random() * Math.PI * 2 * 1_000) / 1_000,
        variant: Math.floor(random() * 3),
      });
      placed += 1;
      if (useCluster && cluster) cluster.remaining -= 1;
      else cluster = { x, z, remaining: 3 + Math.floor(random() * 6) };
    }
  }
  return spawns;
}

export function generateGroundDabSpawns(seed = WORLD_SEED): GroundDabSpawn[] {
  const random = seededRandom(seed + 1_103);
  const routes = [
    [0, 8, 24, -28],
    [0, 8, -30, 30],
    [0, 8, 34, 12],
    [19, -9.5, 25, -30],
  ] as const;
  const spawns: GroundDabSpawn[] = [];

  routes.forEach(([startX, startZ, endX, endZ], routeIndex) => {
    const dx = endX - startX;
    const dz = endZ - startZ;
    const length = Math.hypot(dx, dz);
    for (let index = 0; index < 32; index += 1) {
      const t = (index + 0.25 + random() * 0.5) / 32;
      const offset = (random() - 0.5) * 3.2 + Math.sin(t * Math.PI * 2 + routeIndex) * 0.65;
      const x = startX + dx * t - (dz / length) * offset;
      const z = startZ + dz * t + (dx / length) * offset;
      if (heightAt(x, z, seed) <= 0.35) continue;
      spawns.push({
        x: Math.round(x * 100) / 100,
        z: Math.round(z * 100) / 100,
        scaleX: Math.round((0.35 + random() * 0.48) * 100) / 100,
        scaleZ: Math.round((0.09 + random() * 0.13) * 100) / 100,
        yaw: Math.round(Math.atan2(-dz, dx) * 1_000) / 1_000,
        tone: random() < 0.5 ? 0 : 1,
      });
    }
  });

  for (let attempt = 0; attempt < 2_000 && spawns.length < 180; attempt += 1) {
    const x = (random() - 0.5) * (WORLD_SIZE - 16);
    const z = (random() - 0.5) * (WORLD_SIZE - 16);
    if (heightAt(x, z, seed) <= 0.45) continue;
    spawns.push({
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      scaleX: Math.round((0.3 + random() * 0.62) * 100) / 100,
      scaleZ: Math.round((0.09 + random() * 0.14) * 100) / 100,
      yaw: Math.round(random() * Math.PI * 2 * 1_000) / 1_000,
      tone: random() < 0.5 ? 0 : 1,
    });
  }
  return spawns;
}

function compound(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error('Unable to compose procedural prop geometry');
  geometry.computeVertexNormals();
  return geometry;
}

function createGrassBlade(height: number, width: number, bend: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  [0, 0.34, 0.7].forEach((t, index) => {
    const halfWidth = width * [0.16, 1, 0.62][index]!;
    for (const side of [-1, 1]) {
      positions.push(bend * t * t, 0.01 + height * (t - t * t * 0.12), side * halfWidth);
      uvs.push((side + 1) / 2, t);
    }
  });
  positions.push(bend, height * 0.82, 0);
  uvs.push(0.5, 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  geometry.computeVertexNormals();
  return geometry;
}

function createBroadLeaf(height: number, width: number, bend: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const normal = new THREE.Vector3(-height, bend * 0.65, 0).normalize();
  for (const t of [0, 0.52]) {
    const x = bend * t * t;
    const y = 0.025 + height * t;
    const halfWidth = t === 0 ? 0.015 : width;
    const thickness = t === 0 ? 0.009 : width * 0.12;
    positions.push(x, y, halfWidth, x + normal.x * thickness, y + normal.y * thickness, 0,
      x, y, -halfWidth, x - normal.x * thickness, y - normal.y * thickness, 0);
    uvs.push(0, t, 0.5, t, 1, t, 0.5, t);
  }
  positions.push(bend, height * 0.82, 0);
  uvs.push(0.5, 1);
  const indices = [0, 1, 2, 0, 2, 3];
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    indices.push(side, side + 4, next, next, side + 4, next + 4, side + 4, 8, next + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFireTongue(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const profile = [[0, 0.08], [0.14, 0.29], [0.36, 0.32], [0.64, 0.21], [0.87, 0.11]] as const;
  profile.forEach(([y, radius], ring) => {
    for (let side = 0; side < 12; side += 1) {
      const angle = side / 12 * Math.PI * 2;
      positions.push(Math.sin(angle) * radius + y * y * 0.2, y, Math.cos(angle) * radius + Math.sin(y * 4) * 0.045);
      const a = ring * 12 + side;
      const b = ring * 12 + (side + 1) % 12;
      if (ring < profile.length - 1) indices.push(a, b, a + 12, b, b + 12, a + 12);
      else indices.push(a, b, 61);
      if (ring === 0) indices.push(60, b, a);
    }
  });
  positions.push(0, 0, 0, 0.27, 1.12, -0.055);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const broadLeafPlan = [
  [0.66, 0.23, 0.66, -0.3], [0.82, 0.2, 0.48, 1.05], [0.58, 0.25, 0.72, 2.26],
  [0.76, 0.22, 0.57, 3.6], [0.62, 0.24, 0.64, 4.88],
] as const;

const geometries = {
  trunk: compound([
    new THREE.CylinderGeometry(0.24, 0.36, 2.5, 10),
    new THREE.CylinderGeometry(0.13, 0.2, 1.05, 8).rotateZ(-0.72).translate(0.38, 0.56, 0),
    new THREE.CylinderGeometry(0.12, 0.19, 0.95, 8).rotateX(0.68).translate(0, 0.48, 0.34),
  ]),
  crown: compound([
    new THREE.SphereGeometry(1, 9, 6).scale(1.02, 0.88, 0.92).translate(-0.12, 0.04, 0),
    new THREE.SphereGeometry(0.82, 9, 6).scale(1.06, 0.88, 1).translate(0.68, -0.15, 0.12),
    new THREE.SphereGeometry(0.76, 9, 6).scale(1.08, 0.92, 0.94).translate(-0.72, -0.12, -0.08),
    new THREE.SphereGeometry(0.68, 9, 6).scale(0.95, 0.9, 0.9).translate(0.08, 0.66, -0.06),
  ]),
  rock: new THREE.IcosahedronGeometry(0.72, 1),
  stem: new THREE.CylinderGeometry(0.06, 0.09, 0.75, 8),
  fiber: compound([
    new THREE.SphereGeometry(1, 7, 5).scale(0.13, 0.55, 0.09).rotateZ(-0.5).translate(-0.23, 0.44, 0),
    new THREE.SphereGeometry(1, 7, 5).scale(0.14, 0.62, 0.09).rotateZ(0.44).translate(0.22, 0.49, 0.03),
    new THREE.SphereGeometry(1, 7, 5).scale(0.13, 0.66, 0.1).translate(0, 0.56, -0.03),
    new THREE.SphereGeometry(1, 7, 5).scale(0.12, 0.5, 0.09).rotateX(-0.52).translate(-0.04, 0.4, -0.22),
    new THREE.SphereGeometry(1, 7, 5).scale(0.12, 0.46, 0.09).rotateX(0.58).translate(0.04, 0.38, 0.22),
  ]),
  berries: compound(broadLeafPlan.map(([height, , bend, yaw], index) => new THREE.SphereGeometry(0.12 + index % 2 * 0.015, 7, 5)
    .translate(Math.cos(yaw) * bend * 0.52 ** 2 * 1.45, (0.025 + height * 0.52) * 1.35 + 0.095, -Math.sin(yaw) * bend * 0.52 ** 2 * 1.25))),
  plank: new RoundedBoxGeometry(1, 1, 1, 3, 0.12),
  flame: new THREE.OctahedronGeometry(0.42, 0),
  campfireFlame: compound([
    createFireTongue(),
    createFireTongue().scale(0.52, 0.66, 0.54).rotateZ(0.3).translate(-0.2, 0, -0.02),
    createFireTongue().scale(0.48, 0.53, 0.56).rotateZ(-0.35).translate(0.19, 0, 0.01),
  ]).toNonIndexed(),
};

const flameColors = new Float32Array(geometries.campfireFlame.getAttribute('position').count * 3);
const flameNormals = geometries.campfireFlame.getAttribute('normal');
const flameTone = new THREE.Color();
for (let vertex = 0; vertex < flameNormals.count; vertex += 3) {
  const facing = flameNormals.getX(vertex) * 0.6 + flameNormals.getY(vertex) * 0.15 + flameNormals.getZ(vertex) * 0.75;
  flameTone.setHex(facing > 0.5 ? 0xff982e : facing < -0.18 ? 0xe84c24 : 0xff7028);
  for (let corner = 0; corner < 3; corner += 1) flameTone.toArray(flameColors, (vertex + corner) * 3);
}
geometries.campfireFlame.setAttribute('color', new THREE.BufferAttribute(flameColors, 3));
const fireMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
fireMaterial.userData.shared = true;
const fireRing = compound(Array.from({ length: 7 }, (_, index) => {
  const angle = index / 7 * Math.PI * 2;
  return geometries.rock.clone().scale(0.35 + index % 2 * 0.04, 0.3 + index % 3 * 0.015, 0.37)
    .rotateY(index * 0.7).translate(Math.sin(angle) * 0.8, 0.25, Math.cos(angle) * 0.8);
}));
const fireLogs = compound([-1, 1].map((side) => new THREE.CylinderGeometry(0.12, 0.16, 1.55, 8, 2)
  .rotateZ(Math.PI / 2).rotateY(side * Math.PI / 4).translate(0, side === -1 ? 0.19 : 0.41, 0)));
const fireLogEnds = compound([-1, 1].flatMap((side) => [-1, 1].map((end) => new THREE.CircleGeometry(end === -1 ? 0.12 : 0.16, 8)
  .rotateY(end * Math.PI / 2).translate(end * 0.777, 0, 0).rotateY(side * Math.PI / 4).translate(0, side === -1 ? 0.19 : 0.41, 0))));
const fireCoals = compound(Array.from({ length: 7 }, (_, index) => {
  const angle = index / 7 * Math.PI * 2;
  return new THREE.IcosahedronGeometry(0.13, 0).scale(1.2, 0.42, 0.8)
    .translate(Math.sin(angle) * 0.35, 0.09, Math.cos(angle) * 0.35);
}));
const fireEmbers = compound(Array.from({ length: 5 }, (_, index) => new THREE.OctahedronGeometry(0.025, 0)
  .scale(0.7, 1.4, 0.7).translate(Math.sin(index * 2.4) * 0.26, 1.18 + index * 0.11, Math.cos(index * 2.4) * 0.19)));

const detailGeometries: Record<DetailKind, THREE.BufferGeometry> = {
  grass: compound([
    createGrassBlade(0.88, 0.11, 0.4).rotateY(-1.25).translate(-0.045, 0, 0),
    createGrassBlade(0.98, 0.105, 0.34).rotateY(0.82).translate(0.035, 0, 0.025),
    createGrassBlade(0.78, 0.12, 0.42).rotateY(2.9).translate(0.01, 0, -0.035),
  ]),
  brush: compound(broadLeafPlan.map(([height, width, bend, yaw]) => createBroadLeaf(height, width, bend).rotateY(yaw))),
  rock: new THREE.IcosahedronGeometry(0.5, 1).scale(1.08, 0.62, 0.9).translate(0, 0.29, 0),
  log: new THREE.CylinderGeometry(0.12, 0.16, 1.8, 8).rotateZ(Math.PI / 2).translate(0, 0.16, 0),
  mushroom: compound([
    new THREE.CylinderGeometry(0.09, 0.13, 0.34, 6).translate(0, 0.17, 0),
    new THREE.SphereGeometry(0.32, 6, 4).scale(1, 0.42, 1).translate(0, 0.42, 0),
  ]),
};
detailGeometries.grass.name = 'Three-direction leaf ribbon cluster';
detailGeometries.brush.name = 'Five curved broad leaves';
const leafMaterial = toonMaterial(0xffffff, { surface: 'leaf' });
const grassMaterial = leafMaterial.clone();
grassMaterial.side = THREE.DoubleSide;
grassMaterial.onBeforeCompile = leafMaterial.onBeforeCompile;
grassMaterial.customProgramCacheKey = leafMaterial.customProgramCacheKey;

const detailColors: Record<DetailKind, Record<Biome, readonly [number, number, number]>> = {
  grass: {
    jungle: [0x173f2b, 0x2e7043, 0x55a655],
    plains: [0x805f2f, 0xb98134, 0xd4a84c],
    coast: [0x9b8649, 0xc4ad63, 0xe0c982],
    highlands: [0x315d68, 0x4f7f87, 0x74a3a0],
  },
  brush: {
    jungle: [0x163d2b, 0x285f39, 0x3f7f46],
    plains: [0x6f542b, 0x947036, 0xb88d43],
    coast: [0x877744, 0xaa9650, 0xc2ad62],
    highlands: [0x31545f, 0x47717b, 0x638c91],
  },
  rock: {
    jungle: [0x526361, 0x677a75, 0x7f8f84],
    plains: [0x765f4b, 0x8d7458, 0xa58b67],
    coast: [0x817b68, 0x99927d, 0xb0a98e],
    highlands: [0x405c69, 0x587786, 0x78939c],
  },
  log: {
    jungle: [0x4b321f, 0x654429, 0x805735],
    plains: [0x604024, 0x7a512d, 0x95683b],
    coast: [0x6f5639, 0x876c47, 0xa18458],
    highlands: [0x4a4540, 0x615951, 0x786d61],
  },
  mushroom: {
    jungle: [0xd94f69, 0xe8a83e, 0x65e0c2],
    plains: [0xd66a47, 0xe8a83e, 0xd8c66c],
    coast: [0xe8a83e, 0xf0e5ca, 0x65e0c2],
    highlands: [0x65e0c2, 0x8cb8d4, 0xd94f69],
  },
};

const detailSurfaces: Record<DetailKind, SurfaceKind> = {
  grass: 'leaf',
  brush: 'leaf',
  rock: 'stone',
  log: 'wood',
  mushroom: 'skin',
};

function createDetailField(spawns: DetailSpawn[], seed: number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Instanced illustrated ground cover';
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  for (const kind of ['grass', 'brush', 'rock', 'log', 'mushroom'] as const) {
    const instances = spawns.filter((spawn) => spawn.kind === kind);
    const fill = new THREE.InstancedMesh(
      detailGeometries[kind],
      kind === 'grass' ? grassMaterial : toonMaterial(0xffffff, { surface: detailSurfaces[kind] }),
      instances.length,
    );
    fill.name = `Instanced ${kind}`;
    fill.castShadow = false;
    fill.receiveShadow = true;
    for (let index = 0; index < instances.length; index += 1) {
      const spawn = instances[index];
      if (!spawn) continue;
      position.set(spawn.x, heightAt(spawn.x, spawn.z, seed) + 0.025, spawn.z);
      const coastalGrass = kind === 'grass' && spawn.biome === 'coast';
      const spread = coastalGrass ? 0.8 + hash2(spawn.x, spawn.z, seed + 929) * 0.55 : 1;
      euler.set(
        coastalGrass ? (spawn.variant - 1) * 0.1 : 0,
        spawn.yaw,
        coastalGrass ? (hash2(spawn.z, spawn.x, seed + 383) - 0.5) * 0.3 : 0,
      );
      rotation.setFromEuler(euler);
      const grassShape: readonly [number, number, number] = coastalGrass
        ? spawn.variant === 0 ? [0.86 * spread, 0.48, 1.05]
          : spawn.variant === 1 ? [0.68 * spread, 0.7, 0.7] : [1.05 * spread, 0.4, 0.86]
        : spawn.variant === 0 ? [0.46, 0.92, 0.72]
          : spawn.variant === 1 ? [0.7, 1.16, 0.5] : [0.58, 0.78, 0.88];
      const shape: readonly [number, number, number] = kind === 'grass' ? grassShape
        : kind === 'brush' ? [1.25, 0.72, 1]
          : kind === 'rock' ? [1.1, 0.62, 0.88]
            : kind === 'log' ? [1, 1, 1] : [0.75, 1, 0.75];
      scale.set(shape[0] * spawn.scale, shape[1] * spawn.scale, shape[2] * spawn.scale);
      matrix.compose(position, rotation, scale);
      fill.setMatrixAt(index, matrix);
      const palette = detailColors[kind][spawn.biome];
      fill.setColorAt(index, color.setHex(palette[spawn.variant] ?? palette[0]));
    }
    fill.instanceMatrix.needsUpdate = true;
    if (fill.instanceColor) fill.instanceColor.needsUpdate = true;
    fill.computeBoundingSphere();
    root.add(fill);
  }
  root.add(createDetailContactField(spawns, seed));
  return root;
}

function createDetailContactField(spawns: DetailSpawn[], seed: number): THREE.InstancedMesh {
  const grounded = spawns.filter((spawn) => spawn.kind === 'rock' || spawn.kind === 'log');
  const template = createContactShadow();
  const field = new THREE.InstancedMesh(template.geometry, template.material, grounded.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < grounded.length; index += 1) {
    const spawn = grounded[index];
    if (!spawn) continue;
    position.set(spawn.x, heightAt(spawn.x, spawn.z, seed) + 0.018, spawn.z);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, spawn.yaw);
    scale.set(
      (spawn.kind === 'rock' ? 1.2 : 1.65) * spawn.scale,
      1,
      (spawn.kind === 'rock' ? 0.85 : 0.38) * spawn.scale,
    );
    matrix.compose(position, rotation, scale);
    field.setMatrixAt(index, matrix);
  }
  field.instanceMatrix.needsUpdate = true;
  field.computeBoundingSphere();
  field.name = 'Instanced rock and log contact shadows';
  field.castShadow = false;
  field.receiveShadow = false;
  field.raycast = () => {};
  return field;
}

function createCoastalFraming(seed: number): THREE.InstancedMesh {
  const plan = [
    [-43, -6], [-39, -10], [-45, -12], [-36, -14], [-34, -20], [-40, -2], [-38, -6],
    [-44, -2], [-41, -15], [-37, -18], [-42, -9], [-35, -11], [-33, -16],
  ] as const;
  const random = seededRandom(seed + 2_149);
  const field = new THREE.InstancedMesh(
    detailGeometries.brush,
    toonMaterial(0xffffff, { surface: 'leaf' }),
    plan.length,
  );
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const colors = [0x315d4a, 0x4f7b4c, 0x7b8248, 0x9b8649] as const;
  plan.forEach(([baseX, baseZ], index) => {
    const x = baseX + (random() - 0.5) * 0.32;
    const z = baseZ + (random() - 0.5) * 0.32;
    position.set(x, heightAt(x, z, seed) + 0.02, z);
    euler.set((index % 3 - 1) * 0.07, random() * Math.PI * 2, (index % 2 === 0 ? -1 : 1) * (0.08 + random() * 0.12));
    rotation.setFromEuler(euler);
    scale.set(0.95 + random() * 1.45, 0.58 + random() * 0.76, 0.82 + random() * 1.1);
    matrix.compose(position, rotation, scale);
    field.setMatrixAt(index, matrix);
    field.setColorAt(index, color.setHex(colors[index % colors.length] ?? colors[0]));
  });
  field.instanceMatrix.needsUpdate = true;
  if (field.instanceColor) field.instanceColor.needsUpdate = true;
  field.computeBoundingSphere();
  field.name = 'Coastal framing brush masses';
  field.castShadow = false;
  field.receiveShadow = true;
  field.raycast = () => {};
  return field;
}

function createScenicDepthMasses(seed: number): THREE.InstancedMesh {
  const plan = [
    [-7, 4, 2, 1.2, 1.5, 0x315d42], [11, 2, 2.2, 1.45, 1.8, 0x6a7944],
    [-8, -3, 1.8, 1.8, 1.6, 0x28573d], [9, -5, 1.65, 1.55, 1.7, 0x7a713d],
    [-15, -17, 3.2, 2.7, 2.5, 0x244c39], [12, -16, 2.7, 2.25, 2.1, 0x52633e],
    [4.9, -21.35, 2.6, 2.2, 1.8, 0x3f6570], [31.6, -14.8, 2.5, 2, 1.8, 0x527681],
    [0.8, -33.2, 3.4, 3.1, 2.4, 0x345966], [39.2, -21.8, 3, 2.7, 2.2, 0x64858a],
    [-57.3, 7.9, 2.2, 1, 1.5, 0x315b66], [-45.2, -5.4, 1.9, 1.5, 1.6, 0x63754c],
    [-67.2, 0.8, 3.3, 1.45, 2, 0x294f5d], [-52.9, -16.1, 3, 1.2, 1.9, 0x3d6970],
  ] as const;
  const random = seededRandom(seed + 3_017);
  const material = toonMaterial(0xffffff, { surface: 'leaf', emissive: 0x183033, emissiveIntensity: 0.08 });
  material.emissiveIntensity = 0.08;
  const field = new THREE.InstancedMesh(geometries.crown, material, plan.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  plan.forEach(([baseX, baseZ, scaleX, scaleY, scaleZ, tint], index) => {
    const x = baseX + (random() - 0.5) * 0.32;
    const z = baseZ + (random() - 0.5) * 0.32;
    const size = 0.94 + random() * 0.12;
    scale.set(scaleX * size * 0.58, scaleY * size * 0.68, scaleZ * size * 0.58);
    position.set(x, Math.max(SEA_LEVEL, heightAt(x, z, seed)) + scale.y * 0.88 + 0.02, z);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, random() * Math.PI * 2);
    matrix.compose(position, rotation, scale);
    field.setMatrixAt(index, matrix);
    field.setColorAt(index, color.setHex(tint));
  });
  field.instanceMatrix.needsUpdate = true;
  if (field.instanceColor) field.instanceColor.needsUpdate = true;
  field.computeBoundingSphere();
  field.name = 'Layered scenic depth masses';
  field.castShadow = false;
  field.receiveShadow = true;
  field.raycast = () => {};
  return field;
}

function createGroundDabField(spawns: GroundDabSpawn[], seed: number): THREE.InstancedMesh {
  const geometry = new THREE.CircleGeometry(1, 12);
  const vertices = geometry.getAttribute('position');
  const radii = [1, 0.96, 1.03, 0.98, 1.02, 0.95, 1.04, 0.97, 1.02, 0.96, 1.03, 0.98] as const;
  for (let index = 1; index < vertices.count; index += 1) {
    const radius = radii[(index - 1) % radii.length] ?? 1;
    vertices.setXY(index, vertices.getX(index) * radius, vertices.getY(index) * radius);
  }
  geometry.rotateX(-Math.PI / 2);
  const material = toonMaterial(0xffffff).clone();
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  const field = new THREE.InstancedMesh(geometry, material, spawns.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const yaw = new THREE.Quaternion();
  const color = new THREE.Color();
  const accent = new THREE.Color();
  for (let index = 0; index < spawns.length; index += 1) {
    const spawn = spawns[index];
    if (!spawn) continue;
    position.set(spawn.x, heightAt(spawn.x, spawn.z, seed) + 0.035, spawn.z);
    normal.set(
      heightAt(spawn.x - 0.35, spawn.z, seed) - heightAt(spawn.x + 0.35, spawn.z, seed),
      0.7,
      heightAt(spawn.x, spawn.z - 0.35, seed) - heightAt(spawn.x, spawn.z + 0.35, seed),
    ).normalize();
    rotation.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, normal)
      .multiply(yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, spawn.yaw));
    scale.set(spawn.scaleX, 1, spawn.scaleZ);
    matrix.compose(position, rotation, scale);
    field.setMatrixAt(index, matrix);
    const palette = BIOME_COLORS[biomeAt(spawn.x, spawn.z, seed)];
    color.setHex(palette[1]).lerp(accent.setHex(palette[spawn.tone === 0 ? 0 : 2]), 0.16);
    field.setColorAt(index, color);
  }
  field.instanceMatrix.needsUpdate = true;
  if (field.instanceColor) field.instanceColor.needsUpdate = true;
  field.name = 'Instanced painted ground dabs';
  field.castShadow = false;
  field.receiveShadow = false;
  field.renderOrder = 1;
  field.raycast = () => {};
  return field;
}

function createApexDressing(seed: number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Apex arena dressing';
  const random = seededRandom(seed + 1_771);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  const grass = new THREE.InstancedMesh(
    detailGeometries.grass,
    grassMaterial,
    48,
  );
  grass.name = 'Apex approach grass';
  const clusterT = [0.12, 0.42, 0.75, 0.94] as const;
  for (let index = 0; index < grass.count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const t = THREE.MathUtils.clamp(
      (clusterT[Math.floor(index / 2) % clusterT.length] ?? 0.5) + (random() - 0.5) * 0.13,
      0.03,
      1,
    );
    const edge = 5.35 + random() * 4.7;
    const x = 19 + 6 * t + side * 0.965 * edge;
    const z = -8 - 22 * t + side * 0.263 * edge;
    position.set(x, heightAt(x, z, seed) + 0.025, z);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, random() * Math.PI * 2);
    const size = 0.62 + random() * 1.05;
    scale.set(size * (0.48 + random() * 0.38), size, size * (0.5 + random() * 0.32));
    matrix.compose(position, rotation, scale);
    grass.setMatrixAt(index, matrix);
    const palette = detailColors.grass[biomeAt(x, z, seed)];
    grass.setColorAt(index, color.setHex(palette[index % 3] ?? palette[0]));
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  grass.computeBoundingSphere();
  grass.castShadow = false;
  grass.receiveShadow = true;

  const stonePlan = [
    [16.5, -32, 1.45, 4, 1.25, -0.14, 0],
    [15.95, -32.18, 1.08, 3, 1.02, 0.12, 1.55],
    [16.2, -32.08, 0.82, 2.2, 0.76, -0.1, 2.3],
    [33.3, -27.4, 1.5, 4.2, 1.3, 0.12, 0],
    [33.72, -27.16, 1.1, 3.1, 1.02, -0.12, 1.65],
    [33.45, -27.35, 0.82, 2.25, 0.76, 0.15, 2.45],
    [13.9, -27.4, 1.05, 2.8, 1.1, 0.2, 0],
    [35.7, -33.5, 1.1, 3, 1.05, -0.18, 0],
    [19.2, -40.3, 1.2, 2.6, 1.1, 0.08, 0],
    [29.3, -40.6, 1.15, 2.8, 1.05, -0.1, 0],
    [11.6, -35.8, 0.82, 2.2, 0.9, -0.22, 0],
    [38.2, -23.5, 0.86, 2.35, 0.92, 0.18, 0],
  ] as const;
  const stoneMaterial = toonMaterial(0xffffff, { surface: 'stone' });
  const stones = new THREE.InstancedMesh(detailGeometries.rock, stoneMaterial, stonePlan.length);
  const stoneOutlines = new THREE.InstancedMesh(
    detailGeometries.rock,
    new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide }),
    stonePlan.length,
  );
  stones.name = 'Apex framing stones';
  stoneOutlines.name = 'Apex framing stone ink';
  stonePlan.forEach(([x, z, sx, sy, sz, yaw, lift], index) => {
    position.set(x, heightAt(x, z, seed) + 0.02 + lift, z);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    scale.set(sx, sy, sz);
    matrix.compose(position, rotation, scale);
    stones.setMatrixAt(index, matrix);
    stones.setColorAt(index, color.setHex(index < 6 ? 0x365664 : index < 10 ? 0x4b7185 : 0x668895));
    scale.multiplyScalar(1.045);
    matrix.compose(position, rotation, scale);
    stoneOutlines.setMatrixAt(index, matrix);
  });
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
  stoneOutlines.instanceMatrix.needsUpdate = true;
  stones.computeBoundingSphere();
  stoneOutlines.computeBoundingSphere();
  stones.castShadow = false;
  stones.receiveShadow = true;
  stoneOutlines.castShadow = false;
  stoneOutlines.raycast = () => {};

  const signals = new THREE.InstancedMesh(
    geometries.flame,
    toonMaterial(PALETTE.amber, { emissive: 0x5c3108, emissiveIntensity: 0.75 }),
    10,
  );
  const signalOutlines = new THREE.InstancedMesh(
    geometries.flame,
    new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide }),
    signals.count,
  );
  signals.name = 'Apex amber signals';
  signalOutlines.name = 'Apex amber signal ink';
  const signalPlan = [
    [16.2, -32.08, 3.62], [33.45, -27.35, 3.82],
    [15, -24, 0.17], [36, -36, 0.17], [22, -41, 0.17], [30, -39, 0.17],
    [13, -34, 0.17], [38, -27, 0.17], [18.5, -36.5, 0.17], [32, -22, 0.17],
  ] as const;
  for (let index = 0; index < signals.count; index += 1) {
    const signal = signalPlan[index]!;
    const angle = (index / signals.count) * Math.PI * 2;
    const [x, z, lift] = signal;
    const y = heightAt(x, z, seed) + lift;
    position.set(x, y, z);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    scale.set(0.22, index < 2 ? 0.58 : 0.38, 0.22);
    matrix.compose(position, rotation, scale);
    signals.setMatrixAt(index, matrix);
    scale.multiplyScalar(1.1);
    matrix.compose(position, rotation, scale);
    signalOutlines.setMatrixAt(index, matrix);
  }
  signals.instanceMatrix.needsUpdate = true;
  signalOutlines.instanceMatrix.needsUpdate = true;
  signals.computeBoundingSphere();
  signalOutlines.computeBoundingSphere();
  signals.castShadow = false;
  signalOutlines.castShadow = false;
  signalOutlines.raycast = () => {};

  const shadowTemplate = createContactShadow();
  const shadows = new THREE.InstancedMesh(shadowTemplate.geometry, shadowTemplate.material, stonePlan.length);
  shadows.name = 'Apex framing stone contact shadows';
  stonePlan.forEach(([x, z, sx, , sz, yaw, lift], index) => {
    if (lift > 0) {
      scale.set(0, 0, 0);
      matrix.compose(position.set(x, heightAt(x, z, seed), z), rotation, scale);
      shadows.setMatrixAt(index, matrix);
      return;
    }
    position.set(x, heightAt(x, z, seed) + 0.018, z);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    scale.set(sx * 1.2, 1, sz);
    matrix.compose(position, rotation, scale);
    shadows.setMatrixAt(index, matrix);
  });
  shadows.instanceMatrix.needsUpdate = true;
  shadows.computeBoundingSphere();
  shadows.raycast = () => {};

  const arenaStrokes = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    14,
  );
  arenaStrokes.name = 'Apex arena ink strokes';
  for (let index = 0; index < arenaStrokes.count; index += 1) {
    const angle = (index / arenaStrokes.count) * Math.PI * 2 + (random() - 0.5) * 0.22;
    const radius = index < 6 ? 1.4 + random() * 2.2 : 4.2 + random() * 4.8;
    const x = 25 + Math.sin(angle) * radius;
    const z = -30 + Math.cos(angle) * radius;
    position.set(x, heightAt(x, z, seed) + 0.04, z);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle + (random() - 0.5) * 0.42);
    scale.set(0.58 + random() * 1.18, 1, 0.1 + random() * 0.14);
    matrix.compose(position, rotation, scale);
    arenaStrokes.setMatrixAt(index, matrix);
    arenaStrokes.setColorAt(index, color.setHex(index % 4 === 0 ? 0x345c69 : 0x466d78));
  }
  arenaStrokes.instanceMatrix.needsUpdate = true;
  if (arenaStrokes.instanceColor) arenaStrokes.instanceColor.needsUpdate = true;
  arenaStrokes.computeBoundingSphere();
  arenaStrokes.castShadow = false;
  arenaStrokes.receiveShadow = false;
  arenaStrokes.renderOrder = 1;
  arenaStrokes.raycast = () => {};

  root.add(arenaStrokes, grass, stoneOutlines, stones, signalOutlines, signals, shadows);
  return root;
}

function createLandmarks(seed: number): THREE.Group {
  const landmarks = new THREE.Group();
  landmarks.name = 'Expedition landmarks';

  const wreck = new THREE.Group();
  wreck.name = 'Sunken field skiff';
  wreck.add(createContactShadow(4.2, 2.7));
  wreck.position.set(-8, heightAt(-8, 13, seed), 13);
  wreck.rotation.y = -0.55;
  for (let index = -1; index <= 1; index += 1) {
    addInkedPart(wreck, geometries.plank, index === 0 ? PALETTE.woodLight : PALETTE.wood, [index * 0.72, 0.45 + Math.abs(index) * 0.18, 0], [0.58, 0.28, 3.4], [0, 0, index * 0.12], { surface: 'wood' });
  }
  addInkedPart(wreck, geometries.plank, PALETTE.ink, [0.35, 2.1, -0.2], [0.16, 3.4, 0.16], [0, 0, -0.2]);
  addInkedPart(wreck, geometries.plank, PALETTE.amber, [0.95, 2.6, -0.15], [1.15, 0.7, 0.08], [0, 0, -0.12], { emissive: 0x4d2705, emissiveIntensity: 0.4 });

  const gate = new THREE.Group();
  gate.name = 'Inkstone apex gate';
  gate.add(createContactShadow(5.4, 2.4));
  gate.position.set(10, heightAt(10, -27, seed), -27);
  for (const side of [-1, 1]) {
    addInkedPart(gate, geometries.rock, 0x354d59, [side * 2.25, 1.5, 0], [1.15, 2.8, 1.1], [0, 0, side * -0.08], { surface: 'stone' });
    addInkedPart(gate, geometries.rock, 0x4f7180, [side * 2.1, 3.7, 0], [0.8, 1.5, 0.82], [0, 0, 0], { surface: 'stone' });
  }
  addInkedPart(gate, geometries.plank, 0x26383b, [0, 4.45, 0], [4.8, 0.48, 0.55]);
  addInkedPart(gate, geometries.flame, PALETTE.danger, [0, 4.3, 0.42], [0.75, 0.75, 0.4], [0, 0, Math.PI / 4], { emissive: PALETTE.danger, emissiveIntensity: 0.8 });

  landmarks.add(wreck, gate);
  return landmarks;
}

function createNightSky(seed: number): { stars: THREE.Points; moon: THREE.Group } {
  const random = seededRandom(seed + 812);
  const positions = new Float32Array(220 * 3);
  for (let index = 0; index < 220; index += 1) {
    positions[index * 3] = (random() - 0.5) * 190;
    positions[index * 3 + 1] = 24 + random() * 66;
    positions[index * 3 + 2] = (random() - 0.5) * 190;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: PALETTE.cloud,
    size: 0.7,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    fog: false,
  }));
  stars.name = 'Flat night stars';

  const moon = new THREE.Group();
  moon.name = 'Inked moon';
  const moonGeometry = new THREE.SphereGeometry(4.2, 12, 8);
  const outline = new THREE.Mesh(moonGeometry, new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide, fog: false }));
  outline.scale.setScalar(1.06);
  moon.add(outline, new THREE.Mesh(moonGeometry, new THREE.MeshBasicMaterial({ color: PALETTE.cloud, fog: false })));
  moon.position.set(-48, 43, -65);
  return { stars, moon };
}

function createWaterMarks(seed: number): THREE.InstancedMesh {
  const random = seededRandom(seed + 191);
  const marks = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 0.14).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
    90,
  );
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  for (let index = 0; index < 90; index += 1) {
    const western = index < 60;
    const angle = western ? -1.28 - random() * 1.3 : random() * Math.PI * 2;
    const radius = western ? 50 + random() * 26 : WORLD_SIZE * (0.43 + random() * 0.11);
    position.set(Math.sin(angle) * radius, SEA_LEVEL + 0.16, Math.cos(angle) * radius);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle + (random() - 0.5) * 0.55);
    scale.set((western ? 1.2 : 0.8) + random() * (western ? 3.8 : 2.6), 1, 0.7 + random() * 0.8);
    matrix.compose(position, rotation, scale);
    marks.setMatrixAt(index, matrix);
    marks.setColorAt(index, color.setHex(index % 4 === 0 ? 0x2e8798 : index % 3 === 0 ? 0x82c8c8 : PALETTE.waterLight));
  }
  marks.instanceMatrix.needsUpdate = true;
  if (marks.instanceColor) marks.instanceColor.needsUpdate = true;
  marks.name = 'Chunky illustrated wave marks';
  marks.renderOrder = 1;
  marks.raycast = () => {};
  return marks;
}

function createArcRibbonGeometry(arc = Math.PI * 0.54, segments = 10): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments - 0.5) * arc;
    for (const radius of [1, 0.91]) positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    if (index === segments) continue;
    const outer = index * 2;
    indices.push(outer, outer + 2, outer + 1, outer + 2, outer + 3, outer + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCoastalOceanGeometry(seed: number): THREE.BufferGeometry {
  const segments = 256;
  const waterY = SEA_LEVEL + 0.12;
  const rings = Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    const shore = shoreRadiusAt(angle, seed);
    const radii = [
      shore - 0.56 - Math.sin(angle * 7 + seed * 0.013) * 0.17 - Math.cos(angle * 17) * 0.08,
      shore - 0.18,
      shore + 0.16 + Math.sin(angle * 19 + seed * 0.017) * 0.1,
      shore + 1.35 + Math.sin(angle * 3 + seed * 0.011) * 0.4 + Math.cos(angle * 8) * 0.23 + Math.sin(angle * 13) * 0.17,
      shore + 6.2 + Math.sin(angle * 4 + seed * 0.019) * 1.25 + Math.cos(angle * 7) * 0.65,
      WORLD_SIZE * 2,
    ];
    return radii.map((radius) => {
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      return new THREE.Vector3(x, Math.max(waterY, heightAt(x, z, seed) + 0.018) - waterY, z);
    });
  });
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tones = [0x9b8558, 0xe4e7d5, 0x168f8b, 0x277f98, 0x245f83] as const;
  const opacity = [0.92, 0.68, 0.72, 1, 1] as const;
  const color = new THREE.Color();
  for (let band = 0; band < tones.length; band += 1) {
    for (let index = 0; index < segments; index += 1) {
      const a = rings[index]!;
      const b = rings[(index + 1) % segments]!;
      const angle = index / segments * Math.PI * 2;
      const quietSwash = band === 1 && Math.sin(angle * 11 + seed * 0.019) + Math.cos(angle * 23 - 0.7) * 0.45 < -0.35;
      color.setHex(quietSwash ? tones[2] : tones[band]!);
      const alpha = quietSwash ? 0.36 : opacity[band]!;
      const start = positions.length / 3;
      for (const point of [a[band]!, b[band]!, a[band + 1]!, b[band + 1]!]) {
        positions.push(point.x, point.y, point.z);
        colors.push(color.r, color.g, color.b, alpha);
      }
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = 'Contour-following five-band ocean';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCoastalRibbonGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, 0, 0.11, -1, 0, -0.11,
    -0.34, 0, -0.01, -0.34, 0, -0.19,
    0.34, 0, -0.01, 0.34, 0, -0.19,
    1, 0, 0.11, 1, 0, -0.11,
  ], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6]);
  geometry.computeVertexNormals();
  return geometry;
}

function createCoastalVista(seed: number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Western coastal vista';
  const random = seededRandom(seed + 1_987);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  const swells = new THREE.InstancedMesh(
    createCoastalRibbonGeometry(),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false }),
    24,
  );
  swells.name = 'Layered coastal swell ribbons';
  for (let index = 0; index < swells.count; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const angle = -1.3 - column * 0.39 + (random() - 0.5) * 0.1;
    const radius = 51.5 + row * 4.25 + random() * 1.8;
    position.set(Math.sin(angle) * radius, SEA_LEVEL + 0.205, Math.cos(angle) * radius);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    scale.set(1.25 + random() * 1.45, 1, 0.72 + random() * 0.55);
    matrix.compose(position, rotation, scale);
    swells.setMatrixAt(index, matrix);
    swells.setColorAt(index, color.setHex(index % 3 === 0 ? 0x1f6e80 : index % 2 === 0 ? 0x8ccfd0 : PALETTE.waterLight));
  }
  swells.instanceMatrix.needsUpdate = true;
  if (swells.instanceColor) swells.instanceColor.needsUpdate = true;
  swells.computeBoundingSphere();
  swells.renderOrder = 2;
  swells.raycast = () => {};

  const islandGeometry = compound([
    new THREE.SphereGeometry(1, 7, 4).scale(1.12, 0.4, 0.72).translate(-0.78, 0.08, 0),
    new THREE.SphereGeometry(1, 7, 4).scale(1.18, 0.62, 0.82).translate(0.04, 0.22, 0),
    new THREE.SphereGeometry(1, 7, 4).scale(0.94, 0.34, 0.68).translate(0.9, 0.05, 0),
  ]);
  const islandFills = new THREE.InstancedMesh(
    islandGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    3,
  );
  const islandInk = new THREE.InstancedMesh(
    islandGeometry,
    new THREE.MeshBasicMaterial({ color: 0x203b43, side: THREE.BackSide }),
    islandFills.count,
  );
  const islandWaterline = new THREE.InstancedMesh(
    createArcRibbonGeometry(Math.PI * 1.18, 12),
    new THREE.MeshBasicMaterial({ color: 0xc5e0dc, transparent: true, opacity: 0.58, depthWrite: false }),
    islandFills.count,
  );
  islandFills.name = 'Distant coastal island silhouettes';
  islandInk.name = 'Distant coastal island ink';
  islandWaterline.name = 'Distant island waterline foam';
  islandInk.userData.inkOutline = true;
  const islandPlan = [
    [-64, -13, 2.75, 1.22, 1.78],
    [-73, -2, 2.05, 0.86, 1.42],
    [-58, -28, 1.9, 0.78, 1.5],
  ] as const;
  islandPlan.forEach(([x, z, sx, sy, sz], index) => {
    position.set(x + (random() - 0.5) * 0.9, SEA_LEVEL + 0.035, z + (random() - 0.5) * 0.9);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, (random() - 0.5) * 0.35);
    scale.set(sx, sy, sz);
    matrix.compose(position, rotation, scale);
    islandFills.setMatrixAt(index, matrix);
    islandFills.setColorAt(index, color.setHex(index === 0 ? 0x355d67 : index === 1 ? 0x294d5a : 0x416b70));
    scale.multiplyScalar(1.035);
    matrix.compose(position, rotation, scale);
    islandInk.setMatrixAt(index, matrix);
    position.y = SEA_LEVEL + 0.215;
    scale.set(sx * 1.82, 1, sz * 0.78);
    matrix.compose(position, rotation, scale);
    islandWaterline.setMatrixAt(index, matrix);
  });
  islandFills.instanceMatrix.needsUpdate = true;
  islandInk.instanceMatrix.needsUpdate = true;
  islandWaterline.instanceMatrix.needsUpdate = true;
  if (islandFills.instanceColor) islandFills.instanceColor.needsUpdate = true;
  islandFills.computeBoundingSphere();
  islandInk.computeBoundingSphere();
  islandWaterline.computeBoundingSphere();
  islandFills.raycast = () => {};
  islandInk.raycast = () => {};
  islandWaterline.renderOrder = 3;
  islandWaterline.raycast = () => {};

  const islandTreeGeometry = compound([
    geometries.stem.clone().scale(1.6, 2.8, 1.6).translate(0, 1.05, 0),
    detailGeometries.brush.clone().scale(1.4, 1.25, 1.2).translate(0, 2, 0),
  ]);
  const islandTrees = new THREE.InstancedMesh(
    islandTreeGeometry,
    new THREE.MeshBasicMaterial({ color: 0x294c4b }),
    6,
  );
  const treePlan = [
    [-64.8, -13.1, 0.82], [-62.7, -13.45, 0.64], [-73, -2, 0.62],
    [-58.6, -28.2, 0.72], [-56.9, -27.55, 0.54], [-59.35, -27.4, 0.48],
  ] as const;
  treePlan.forEach(([x, z, size], index) => {
    position.set(x + (random() - 0.5) * 0.24, SEA_LEVEL + 0.34, z + (random() - 0.5) * 0.24);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, random() * Math.PI * 2);
    scale.set(size * (0.78 + random() * 0.28), size, size * (0.76 + random() * 0.3));
    matrix.compose(position, rotation, scale);
    islandTrees.setMatrixAt(index, matrix);
  });
  islandTrees.instanceMatrix.needsUpdate = true;
  islandTrees.computeBoundingSphere();
  islandTrees.name = 'Offshore island tree silhouettes';
  islandTrees.castShadow = false;
  islandTrees.raycast = () => {};

  const mist = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 12),
    new THREE.MeshBasicMaterial({ color: 0x8ebbc1, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide }),
    4,
  );
  mist.name = 'Cool offshore mist bands';
  const mistPlan = [[-65, -15, 6.8], [-74, -4, 5.2], [-59, -30, 5.5], [-69, -24, 7.2]] as const;
  mistPlan.forEach(([x, z, width], index) => {
    position.set(x + (random() - 0.5) * 0.6, 0.58 + index * 0.07, z + (random() - 0.5) * 0.6);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(position.x, position.z));
    scale.set(width, 0.28 + index * 0.04, 1);
    matrix.compose(position, rotation, scale);
    mist.setMatrixAt(index, matrix);
  });
  mist.instanceMatrix.needsUpdate = true;
  mist.computeBoundingSphere();
  mist.renderOrder = 1;
  mist.raycast = () => {};

  root.add(swells, islandInk, islandFills, islandTrees, islandWaterline, mist);
  return root;
}

function createHorizonBands(): THREE.InstancedMesh {
  const bands = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.BackSide }),
    2,
  );
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const plan: ReadonlyArray<readonly [number, number, number]> = [[0.95, 1.5, 0x589ba5], [2.25, 1.15, 0x75adb8]];
  plan.forEach(([y, height, tint], index) => {
    matrix.compose(position.set(0, y, 0), rotation, scale.set(WORLD_SIZE * 0.64, height, WORLD_SIZE * 0.64));
    bands.setMatrixAt(index, matrix);
    bands.setColorAt(index, color.setHex(tint));
  });
  bands.instanceMatrix.needsUpdate = true;
  if (bands.instanceColor) bands.instanceColor.needsUpdate = true;
  bands.computeBoundingSphere();
  bands.name = 'Flat horizon depth bands';
  bands.renderOrder = -1;
  bands.raycast = () => {};
  return bands;
}

function createDistantRidge(seed: number): THREE.InstancedMesh {
  const plan: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-42, -52, 4.2, 1.55, 2.6], [-28, -57, 5.1, 1.9, 3], [-14, -61, 4.4, 1.7, 2.7],
    [0, -64, 5.4, 2.05, 3.2], [15, -61, 4.6, 1.75, 2.8], [30, -57, 5.2, 1.9, 3], [44, -52, 4, 1.5, 2.5],
  ];
  const random = seededRandom(seed + 2_711);
  const ridge = new THREE.InstancedMesh(
    geometries.crown,
    new THREE.MeshBasicMaterial({ color: 0x416b74 }),
    plan.length,
  );
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  plan.forEach(([baseX, baseZ, sx, sy, sz], index) => {
    position.set(baseX + (random() - 0.5) * 0.8, -0.05, baseZ + (random() - 0.5) * 0.8);
    rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, random() * Math.PI * 2);
    scale.set(sx * (0.92 + random() * 0.16), sy, sz * (0.92 + random() * 0.16));
    matrix.compose(position, rotation, scale);
    ridge.setMatrixAt(index, matrix);
  });
  ridge.instanceMatrix.needsUpdate = true;
  ridge.computeBoundingSphere();
  ridge.name = 'Distant moonlit canopy ridge';
  ridge.castShadow = false;
  ridge.raycast = () => {};
  return ridge;
}

function createTerrain(seed: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 84, 84);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    positions.setY(index, heightAt(positions.getX(index), positions.getZ(index), seed));
  }
  geometry.computeVertexNormals();

  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const palette = BIOME_COLORS[biomeAt(x, z, seed)];
    const height = positions.getY(index);
    const macro = THREE.MathUtils.clamp(0.5
      + Math.sin(x * 0.04 + seed * 0.01) * 0.22
      + Math.cos(z * 0.035 - seed * 0.006) * 0.18
      + Math.sin((x - z) * 0.022) * 0.1
      + THREE.MathUtils.clamp((height - 1) / 8, 0, 1) * 0.12, 0, 1);
    const band = height < 0.55 || macro < 0.38 ? 0 : macro > 0.7 ? 2 : 1;
    color.setHex(palette[band]);
    color.toArray(colors, index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrain = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: TOON_GRADIENT,
  }));
  terrain.name = 'Procedural four-biome island';
  terrain.receiveShadow = false;
  terrain.userData.ground = true;
  return terrain;
}

function createClouds(seed: number): THREE.Group {
  const clouds = new THREE.Group();
  clouds.name = 'Cel-shaded cloud field';
  const undersideGeometry = compound([
    new THREE.SphereGeometry(1, 10, 7).scale(1.5, 0.46, 0.72).translate(-1.15, -0.18, 0),
    new THREE.SphereGeometry(1, 10, 7).scale(1.55, 0.5, 0.76).translate(0, -0.25, 0.02),
    new THREE.SphereGeometry(1, 10, 7).scale(1.45, 0.44, 0.7).translate(1.15, -0.16, 0),
  ]);
  const topGeometry = compound([
    new THREE.SphereGeometry(1, 10, 7).scale(1.1, 0.7, 0.76).translate(-1.4, 0.03, 0),
    new THREE.SphereGeometry(1, 10, 7).scale(1.32, 1, 0.88).translate(-0.48, 0.36, 0.02),
    new THREE.SphereGeometry(1, 10, 7).scale(1.24, 0.9, 0.84).translate(0.62, 0.34, 0),
    new THREE.SphereGeometry(1, 10, 7).scale(1.02, 0.66, 0.72).translate(1.5, 0.04, 0),
  ]);
  const topMaterial = new THREE.MeshBasicMaterial({ color: 0xf3eddf, fog: false, toneMapped: false });
  const undersideMaterial = new THREE.MeshBasicMaterial({ color: 0xaac5cc, fog: false, toneMapped: false });
  const plan = [
    [-104, 27.5, -50, 2.05, 0.16, 1.18, 0.86, -0.025],
    [-17, 30.5, -58, 1.72, 0.21, 0.82, 1.08, 0.018],
    [-3, 25.5, -72, 2.28, 0.14, 1.12, 0.74, -0.012],
    [34, 29.5, -57, 1.9, 0.24, 0.94, 1.02, 0.026],
    [56, 26.5, -70, 2.16, 0.18, 1.1, 0.84, -0.02],
    [-82, 31, -50, 1.82, 0.2, 0.88, 1.12, 0.014],
  ] as const;
  for (const [x, y, z, size, drift, width, height, tilt] of plan) {
    const cloud = new THREE.Group();
    const underside = new THREE.Mesh(undersideGeometry, undersideMaterial);
    const top = new THREE.Mesh(topGeometry, topMaterial);
    underside.name = 'Cool cloud underside';
    top.name = 'Bright cloud top';
    underside.castShadow = false;
    underside.receiveShadow = false;
    top.castShadow = false;
    top.receiveShadow = false;
    cloud.add(underside, top);
    cloud.position.set(x, y, z);
    cloud.scale.set(size * width, size * height, size);
    cloud.rotation.z = tilt;
    cloud.userData.drift = drift;
    cloud.userData.startX = x;
    clouds.add(cloud);
  }
  clouds.userData.topMaterial = topMaterial;
  clouds.userData.undersideMaterial = undersideMaterial;
  return clouds;
}

function createResource(spawn: ResourceSpawn, seed: number, index: number): ResourceNode {
  const root = new THREE.Group();
  const biome = biomeAt(spawn.x, spawn.z, seed);
  root.add(createContactShadow(
    spawn.kind === 'wood' ? 2.2 : spawn.kind === 'stone' ? 1.8 : 1.25,
    spawn.kind === 'wood' ? 1.45 : spawn.kind === 'stone' ? 1.25 : 0.9,
  ));
  if (spawn.kind === 'wood') {
    addInkedPart(root, geometries.trunk, PALETTE.wood, [0, 1.25, 0], [1, 1, 1], [0, 0, 0], { surface: 'wood' });
    const canopyColor = biome === 'jungle' ? PALETTE.jungle : 0x6d8a43;
    addInkedPart(root, geometries.crown, canopyColor, [0, 2.72, 0], [1.08, 1.08, 1.04], [0, 0, 0], { surface: 'leaf' });
  } else if (spawn.kind === 'stone') {
    addInkedPart(root, geometries.rock, biome === 'highlands' ? 0x6f8e99 : PALETTE.stone, [0, 0.48, 0], [1.25, 0.82, 1], [0, 0, 0], { surface: 'stone' });
    addInkedPart(root, geometries.rock, 0x93a2a3, [0.58, 0.28, 0.25], [0.62, 0.48, 0.54], [0, 0, 0], { surface: 'stone' });
  } else if (spawn.kind === 'fiber') {
    addInkedPart(root, geometries.fiber, PALETTE.fiber, [0, 0, 0], [1, 1, 1], [0, 0, 0], { surface: 'leaf' });
  } else {
    addInkedPart(root, detailGeometries.brush, PALETTE.jungle, [0, 0, 0], [1.45, 1.35, 1.25], [0, 0, 0], { surface: 'leaf' });
    addInkedPart(root, geometries.berries, PALETTE.berry, [0, 0, 0], [1, 1, 1], [0, 0, 0], {
      emissive: 0x4a0713,
      emissiveIntensity: 0.25,
      surface: 'skin',
    });
  }

  root.position.set(spawn.x, heightAt(spawn.x, spawn.z, seed), spawn.z);
  root.rotation.y = hash2(spawn.x, spawn.z, seed) * Math.PI * 2;
  root.name = `${spawn.kind} resource`;
  const node: ResourceNode = {
    id: `${spawn.kind}-${index}`,
    root,
    kind: spawn.kind,
    amount: spawn.kind === 'wood' ? 4 : spawn.kind === 'stone' ? 3 : 2,
    active: true,
  };
  root.userData.resourceNode = node;
  return node;
}

export function createStructureVisual(type: BuildType, ghost = false): THREE.Group {
  const root = new THREE.Group();
  root.name = `${type}${ghost ? ' placement preview' : ''}`;
  root.userData.buildType = type;
  if (!ghost) root.userData.structureRoot = root;
  if (!ghost) root.add(createContactShadow(
    type === 'foundation' ? 3.4 : type === 'wall' ? 3.3 : 2.1,
    type === 'foundation' ? 3.1 : type === 'wall' ? 0.72 : 1.55,
  ));
  if (type === 'foundation') {
    for (let index = -2; index <= 2; index += 1) {
      addInkedPart(root, geometries.plank, PALETTE.woodLight, [index * 0.62, 0.16, 0], [0.57, 0.28, 3.2], [0, 0, 0], { surface: 'wood' });
    }
  } else if (type === 'wall') {
    addInkedPart(root, geometries.plank, PALETTE.wood, [-1.45, 1.25, 0], [0.3, 2.5, 0.34], [0, 0, 0], { surface: 'wood' });
    addInkedPart(root, geometries.plank, PALETTE.wood, [1.45, 1.25, 0], [0.3, 2.5, 0.34], [0, 0, 0], { surface: 'wood' });
    for (let index = 0; index < 4; index += 1) {
      addInkedPart(root, geometries.plank, PALETTE.woodLight, [0, 0.35 + index * 0.62, 0], [2.7, 0.48, 0.24], [0, 0, 0], { surface: 'wood' });
    }
  } else {
    addInkedPart(root, fireRing, PALETTE.stone, [0, 0, 0], [1, 1, 1], [0, 0, 0], { surface: 'stone' });
    addInkedPart(root, fireLogs, 0x443126, [0, 0, 0], [1, 1, 1], [0, 0, 0], { surface: 'wood' }).name = 'Charred round firewood';
    addInkedPart(root, fireLogEnds, 0xb28a59, [0, 0, 0], [1, 1, 1], [0, 0, 0], { surface: 'wood', outline: false });
    addInkedPart(root, fireCoals, 0xe76527, [0, 0, 0], [1, 1, 1], [0, 0, 0], { unlit: true, outline: false }).name = 'Campfire ember bed';
    const flame = new THREE.Group();
    flame.position.y = 0.34;
    flame.userData.flame = true;
    const outerFlame = new THREE.Mesh(geometries.campfireFlame, fireMaterial);
    outerFlame.name = 'Sculpted outer flame';
    outerFlame.userData.inkFill = true;
    flame.add(outerFlame);
    addInkedPart(flame, geometries.campfireFlame, 0xffd269, [-0.035, 0, 0.21], [0.51, 0.68, 0.55], [0, 0.12, -0.1], {
      outline: false,
      unlit: true,
    });
    root.add(flame);
    addInkedPart(root, fireEmbers, 0xffc164, [0, 0, 0], [1, 1, 1], [0, 0, 0], { unlit: true, outline: false }).name = 'Airborne illustrated embers';
    if (!ghost) {
      const glow = new THREE.PointLight(0xff9b52, 5.2, 5.6, 2);
      glow.name = 'Campfire warm glow';
      glow.position.set(0, 1.1, 0);
      glow.castShadow = false;
      root.add(glow);
    }
  }
  if (ghost) makeGhost(root, true);
  return root;
}

export function createWorld(scene: THREE.Scene, seed = WORLD_SEED): WorldVisuals {
  const root = new THREE.Group();
  root.name = 'Inkbound Isle';
  const terrain = createTerrain(seed);
  const groundDabs = createGroundDabField(generateGroundDabSpawns(seed), seed);
  const water = new THREE.Mesh(
    createCoastalOceanGeometry(seed),
    new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: TOON_GRADIENT,
      transparent: true,
      depthWrite: false,
    }),
  );
  water.position.y = SEA_LEVEL + 0.12;
  water.name = 'Flat illustrated sea';
  water.receiveShadow = false;
  const waterMarks = createWaterMarks(seed);
  const coastalVista = createCoastalVista(seed);
  const coastalSwells = coastalVista.getObjectByName('Layered coastal swell ribbons') as THREE.InstancedMesh;
  const horizonBands = createHorizonBands();
  const coastalFraming = createCoastalFraming(seed);
  const scenicDepth = createScenicDepthMasses(seed);
  const distantRidge = createDistantRidge(seed);

  const sun = new THREE.DirectionalLight(PALETTE.warmLight, 3.85);
  sun.name = 'Warm cel key';
  sun.position.set(-32, 50, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  const ambient = new THREE.HemisphereLight(0xcbe8ec, 0x584735, 0.78);
  ambient.name = 'Soft sky ambience';
  const rim = new THREE.DirectionalLight(0x83cde3, 1.05);
  rim.name = 'Cool cel rim';
  rim.position.set(34, 22, -38);
  const clouds = createClouds(seed);
  const detailSpawns = generateDetailSpawns(seed);
  const details = createDetailField(detailSpawns, seed);
  const apexDressing = createApexDressing(seed);
  const landmarks = createLandmarks(seed);
  const { stars, moon } = createNightSky(seed);
  const resources = generateResourceSpawns(seed).map((spawn, index) => createResource(spawn, seed, index));
  root.add(terrain, groundDabs, water, waterMarks, coastalVista, horizonBands, distantRidge, stars, moon, sun, ambient, rim, clouds, details, coastalFraming, scenicDepth, apexDressing, landmarks, ...resources.map((node) => node.root));
  scene.add(root);

  const background = new THREE.Color(PALETTE.skyDay);
  const horizonColor = new THREE.Color();
  scene.background = background;
  scene.fog = new THREE.Fog(PALETTE.skyDay, 30, 94);

  const updateDay = (timeOfDay: number) => {
    const time = ((timeOfDay % 1) + 1) % 1;
    let sky: number = PALETTE.skyDay;
    let intensity = 3.85;
    let ambientIntensity = 0.78;
    let rimIntensity = 1.05;
    let cloudTop = 0xf3eddf;
    let cloudUnderside = 0xaac5cc;
    let horizonLow = 0x4f99a6;
    let horizonHigh = 0x83bac3;
    let ridgeColor = 0x416b74;
    if (time < 0.18 || time >= 0.86) {
      sky = PALETTE.skyNight;
      intensity = 0.38;
      ambientIntensity = 0.48;
      rimIntensity = 0.42;
      cloudTop = 0x52657b;
      cloudUnderside = 0x30445e;
      horizonLow = 0x20374c;
      horizonHigh = 0x304b61;
      ridgeColor = 0x243c50;
    } else if (time < 0.3) {
      sky = PALETTE.skyDawn;
      intensity = 2.75;
      ambientIntensity = 0.7;
      rimIntensity = 0.82;
      cloudTop = 0xf3c7a0;
      cloudUnderside = 0xa77f89;
      horizonLow = 0xc88970;
      horizonHigh = 0xd5a08c;
      ridgeColor = 0x665c69;
    } else if (time >= 0.72) {
      sky = PALETTE.skyDusk;
      intensity = 2.25;
      ambientIntensity = 0.62;
      rimIntensity = 0.95;
      cloudTop = 0xd99b91;
      cloudUnderside = 0x706d82;
      horizonLow = 0x9b6570;
      horizonHigh = 0xb27e83;
      ridgeColor = 0x4d4f61;
    }
    background.setHex(sky);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(sky);
    sun.intensity = intensity;
    ambient.intensity = ambientIntensity;
    rim.intensity = rimIntensity;
    (clouds.userData.topMaterial as THREE.MeshBasicMaterial).color.setHex(cloudTop);
    (clouds.userData.undersideMaterial as THREE.MeshBasicMaterial).color.setHex(cloudUnderside);
    horizonBands.setColorAt(0, horizonColor.setHex(horizonLow));
    horizonBands.setColorAt(1, horizonColor.setHex(horizonHigh));
    if (horizonBands.instanceColor) horizonBands.instanceColor.needsUpdate = true;
    (distantRidge.material as THREE.MeshBasicMaterial).color.setHex(ridgeColor);
    const solarAngle = (time - 0.25) * Math.PI * 2;
    sun.position.set(Math.cos(solarAngle) * 42, Math.max(8, Math.sin(solarAngle) * 48), Math.sin(solarAngle) * 30);
    const nightVisible = time < 0.2 || time >= 0.78;
    (scenicDepth.material as THREE.MeshToonMaterial).emissiveIntensity = nightVisible ? 0.32 : time < 0.3 || time >= 0.72 ? 0.14 : 0.08;
    stars.visible = nightVisible;
    moon.visible = nightVisible;
  };

  const update = (elapsed: number) => {
    waterMarks.rotation.y = -elapsed * 0.005;
    waterMarks.position.y = Math.sin(elapsed * 0.7) * 0.025;
    coastalSwells.position.y = Math.sin(elapsed * 0.55) * 0.018;
    for (const cloud of clouds.children) {
      const span = WORLD_SIZE * 1.1;
      const travel = (cloud.userData.startX as number) + elapsed * (cloud.userData.drift as number);
      cloud.position.x = ((travel + span * 0.5) % span) - span * 0.5;
    }
  };

  return {
    root,
    resources,
    interactables: resources.map((node) => node.root),
    updateDay,
    update,
    detailCount: detailSpawns.length,
    landmarkCount: landmarks.children.length,
  };
}
