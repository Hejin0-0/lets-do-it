import * as THREE from 'three';
import type { Biome } from './world.ts';
import { PALETTE } from './palette.ts';

export const EFFECT_KINDS = ['stepDust', 'lightHit', 'heavyHit', 'tame'] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];
export type EffectShape = 'shard' | 'puff';
type Range = readonly [number, number];
type TrailStyle = 'dust' | 'foliage' | 'splash' | 'ray';

export interface EffectRecipe {
  readonly count: number;
  readonly life: Range;
  readonly size: Range;
  readonly gravity: number;
  readonly verticalForce: Range;
  readonly horizontalForce: Range;
  readonly shape: EffectShape;
}

export interface EffectDirection {
  readonly x: number;
  readonly z: number;
}

export interface EffectEmissionOptions {
  readonly direction?: EffectDirection;
  readonly impactScale?: number;
  readonly seed?: number;
}

export interface EffectParticleSample {
  readonly life: number;
  readonly size: number;
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly velocityZ: number;
  readonly spinX: number;
  readonly spinY: number;
  readonly spinZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
}

export const MAX_PARTICLES = 260;
const SHAPE_CAPACITY = MAX_PARTICLES / 2;
const IMPACT_WORLD_SCALE = 0.6;
const RECIPES: Readonly<Record<EffectKind, EffectRecipe>> = {
  stepDust: {
    count: 7,
    life: [0.28, 0.46],
    size: [0.2, 0.36],
    gravity: 1.1,
    verticalForce: [0.08, 0.26],
    horizontalForce: [0.52, 0.9],
    shape: 'puff',
  },
  lightHit: {
    count: 10,
    life: [0.36, 0.68],
    size: [0.12, 0.27],
    gravity: 7.8,
    verticalForce: [1.2, 3.1],
    horizontalForce: [1, 3],
    shape: 'shard',
  },
  heavyHit: {
    count: 18,
    life: [0.5, 0.86],
    size: [0.19, 0.42],
    gravity: 9.2,
    verticalForce: [2.2, 4.7],
    horizontalForce: [2, 4.9],
    shape: 'shard',
  },
  tame: {
    count: 12,
    life: [0.78, 1.18],
    size: [0.2, 0.34],
    gravity: 0.3,
    verticalForce: [0.75, 1.1],
    horizontalForce: [0.24, 0.55],
    shape: 'puff',
  },
};

export function recipe(kind: EffectKind): EffectRecipe {
  return RECIPES[kind];
}

function unitSample(seed: number, index: number, channel: number): number {
  let value = (Math.trunc(Number.isFinite(seed) ? seed : 0)
    ^ Math.imul(Math.trunc(Number.isFinite(index) ? index : 0) + 1, 0x9e3779b1)
    ^ Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000;
}

function rangeSample([minimum, maximum]: Range, unit: number): number {
  return THREE.MathUtils.lerp(minimum, maximum, unit);
}

export function sampleEffectParticle(
  kind: EffectKind,
  index: number,
  seed: number,
  direction?: EffectDirection,
  force = 1,
): EffectParticleSample {
  const effect = recipe(kind);
  let channel = 0;
  const random = () => unitSample(seed, index, channel++);
  const directionLength = direction && Number.isFinite(direction.x) && Number.isFinite(direction.z)
    ? Math.hypot(direction.x, direction.z)
    : 0;
  const angle = kind === 'tame'
    ? index / effect.count * Math.PI * 2
    : directionLength > 1e-6
      ? Math.atan2(direction!.x, direction!.z) + (random() - 0.5) * Math.PI * 0.7
      : random() * Math.PI * 2;
  const safeForce = Number.isFinite(force) ? THREE.MathUtils.clamp(Math.abs(force), 0.15, 1.5) : 1;
  const horizontal = rangeSample(effect.horizontalForce, random()) * safeForce;
  const spread = kind === 'stepDust' ? 0.7 : 0.45;
  const spin = effect.shape === 'shard' ? 10 : 3;
  const radius = kind === 'tame' ? 0.48 + index % 2 * 0.14 : 0;

  return {
    life: rangeSample(effect.life, random()),
    size: rangeSample(effect.size, random()),
    offsetX: kind === 'tame' ? Math.sin(angle) * radius : (random() - 0.5) * spread,
    offsetZ: kind === 'tame' ? Math.cos(angle) * radius : (random() - 0.5) * spread,
    velocityX: Math.sin(angle) * horizontal,
    velocityY: rangeSample(effect.verticalForce, random()) * safeForce,
    velocityZ: Math.cos(angle) * horizontal,
    spinX: (random() - 0.5) * spin,
    spinY: (random() - 0.5) * spin,
    spinZ: (random() - 0.5) * spin,
    rotationX: random() * Math.PI,
    rotationY: random() * Math.PI,
    rotationZ: random() * Math.PI,
  };
}

interface Particle {
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  rotation: THREE.Euler;
  size: number;
  gravity: number;
  kind: EffectKind;
  core: boolean;
  groundY: number;
  trailStyle: TrailStyle;
}

interface ShapePool {
  mesh: THREE.InstancedMesh;
  particles: Particle[];
  cursor: number;
}

function particle(): Particle {
  return {
    life: 0,
    maxLife: 1,
    position: new THREE.Vector3(0, -999, 0),
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    size: 0.2,
    gravity: 0,
    kind: 'lightHit',
    core: false,
    groundY: 0,
    trailStyle: 'dust',
  };
}

export class ChunkEffects {
  private readonly pools: Record<EffectShape, ShapePool>;
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private readonly highlight = new THREE.Color(PALETTE.cloud);
  private emissionSeed = 0x51f15e;

  constructor(scene: THREE.Scene) {
    // Instance colors supply the whole flat FX palette; there is no vertex-color attribute.
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    const puffGeometry = new THREE.BufferGeometry()
      .copy(new THREE.IcosahedronGeometry(0.55, 0)).scale(1, 0.78, 0.72);
    const shardGeometry = new THREE.BufferGeometry()
      .copy(new THREE.OctahedronGeometry(0.6, 0)).scale(0.48, 1.08, 0.22);
    this.pools = {
      puff: this.createPool(
        puffGeometry,
        material,
        'Rounded illustrated puffs',
      ),
      shard: this.createPool(
        shardGeometry,
        material,
        'Graphic impact shards',
      ),
    };

    for (const pool of Object.values(this.pools)) {
      for (let index = 0; index < SHAPE_CAPACITY; index += 1) {
        pool.mesh.setColorAt(index, this.color.setHex(PALETTE.cloud));
        this.writeParticle(pool, index);
      }
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
      scene.add(pool.mesh);
    }
  }

  burst(
    position: THREE.Vector3,
    color: number,
    count = 10,
    force = 1,
    options: EffectEmissionOptions = {},
  ): void {
    if (![position.x, position.y, position.z].every(Number.isFinite)) return;
    const safeCount = Number.isFinite(count)
      ? THREE.MathUtils.clamp(Math.round(count), 0, SHAPE_CAPACITY)
      : recipe('lightHit').count;
    const safeForce = Number.isFinite(force) ? THREE.MathUtils.clamp(Math.abs(force), 0.15, 1.5) : 1;
    this.emit(position, color, 'lightHit', safeCount, safeForce, options);
  }

  play(kind: EffectKind, position: THREE.Vector3, color: number, options: EffectEmissionOptions = {}): void {
    this.emit(position, color, kind, recipe(kind).count, 1, options, 'dust', true);
  }

  trail(
    position: THREE.Vector3,
    biome: Biome,
    inWater: boolean,
    options: EffectEmissionOptions = {},
  ): void {
    const color = inWater ? PALETTE.waterLight : {
      coast: PALETTE.coast,
      jungle: PALETTE.jungle,
      plains: PALETTE.plains,
      highlands: PALETTE.highlands,
    }[biome];
    this.emit(position, color, 'stepDust', recipe('stepDust').count, 1, options,
      inWater ? 'splash' : biome === 'jungle' ? 'foliage' : 'dust');
  }

  update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    for (const pool of Object.values(this.pools)) {
      for (let index = 0; index < pool.particles.length; index += 1) {
        const item = pool.particles[index];
        if (!item || item.life <= 0) continue;
        item.life -= delta;
        item.velocity.y -= item.gravity * delta;
        item.position.addScaledVector(item.velocity, delta);
        if (item.kind === 'stepDust' && item.position.y < item.groundY) {
          item.position.y = item.groundY;
          item.velocity.y = 0;
        }
        item.rotation.x += item.spin.x * delta;
        item.rotation.y += item.spin.y * delta;
        item.rotation.z += item.spin.z * delta;
        this.writeParticle(pool, index);
      }
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private createPool(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): ShapePool {
    const mesh = new THREE.InstancedMesh(geometry, material, SHAPE_CAPACITY);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.raycast = () => {};
    return {
      mesh,
      particles: Array.from({ length: SHAPE_CAPACITY }, particle),
      cursor: 0,
    };
  }

  private emit(
    position: THREE.Vector3,
    color: number,
    kind: EffectKind,
    count = recipe(kind).count,
    force = 1,
    options: EffectEmissionOptions = {},
    trailStyle: TrailStyle = 'dust',
    hasContact = false,
  ): void {
    if (![position.x, position.y, position.z].every(Number.isFinite)) return;
    const effect = recipe(kind);
    const tint = Number.isFinite(color) ? color : PALETTE.cloud;
    const seed = options.seed ?? this.emissionSeed++;
    const rayCount = kind === 'heavyHit' ? 5 : 3;
    const requestedImpactScale = options.impactScale ?? IMPACT_WORLD_SCALE;
    const impactScale = hasContact && (kind === 'lightHit' || kind === 'heavyHit')
      ? Number.isFinite(requestedImpactScale)
        ? THREE.MathUtils.clamp(requestedImpactScale, 0.25, 0.75)
        : IMPACT_WORLD_SCALE
      : 1;
    for (let index = 0; index < count; index += 1) {
      const core = hasContact && index === 0 && (kind === 'lightHit' || kind === 'heavyHit');
      const ray = hasContact && index > 0 && index <= rayCount && (kind === 'lightHit' || kind === 'heavyHit');
      const shape = core ? 'puff' : kind === 'tame'
        ? index % 3 === 0 ? 'shard' : 'puff'
        : kind === 'stepDust' && trailStyle === 'foliage' ? 'shard' : effect.shape;
      const pool = this.pools[shape];
      const particleIndex = pool.cursor;
      const item = pool.particles[particleIndex];
      if (!item) continue;
      pool.cursor = (pool.cursor + 1) % SHAPE_CAPACITY;
      const sample = sampleEffectParticle(kind, index, seed, options.direction, force);
      item.core = core;
      item.trailStyle = ray ? 'ray' : trailStyle;
      item.groundY = position.y;
      item.life = core ? kind === 'heavyHit' ? 0.38 : 0.3 : ray ? 0.32 : sample.life;
      item.maxLife = item.life;
      item.position.set(
        position.x + (core || ray ? 0 : sample.offsetX),
        position.y + (kind === 'tame' ? Math.sin(index / (count - 1) * Math.PI) * 0.24 : 0),
        position.z + (core || ray ? 0 : sample.offsetZ),
      );
      const rayAngle = (index - 1) / rayCount * Math.PI * 2;
      item.velocity.set(
        core || ray ? 0 : sample.velocityX,
        core || ray ? 0 : trailStyle === 'splash' ? sample.velocityY * 3 + 0.35 : sample.velocityY,
        core || ray ? 0 : sample.velocityZ,
      );
      item.spin.set(sample.spinX, sample.spinY, sample.spinZ);
      item.rotation.set(sample.rotationX, sample.rotationY, sample.rotationZ);
      if (ray) item.rotation.set(0, 0, -rayAngle);
      else if (kind === 'tame') {
        item.rotation.set(0, index / count * Math.PI * 2, index % 2 ? -0.34 : 0.34);
      }
      if (kind === 'stepDust' && trailStyle !== 'foliage') {
        item.spin.set(0, sample.spinY, 0);
        item.rotation.set(0, sample.rotationY, 0);
      }
      item.size = (core ? kind === 'heavyHit' ? 0.58 : 0.34 : ray ? kind === 'heavyHit' ? 0.28 : 0.21 : sample.size)
        * impactScale;
      item.gravity = core || ray ? 0 : trailStyle === 'splash' ? 3.4 : effect.gravity;
      item.kind = kind;

      this.color.setHex(tint);
      if (core) this.color.lerp(this.highlight, 0.86);
      else if (ray) this.color.setHex(index % 2 ? PALETTE.warmLight : PALETTE.cloud);
      else if (kind === 'tame') this.color.lerp(this.highlight, index % 4 === 0 ? 0.72 : 0.1 + index % 3 * 0.1);
      else if (effect.shape === 'shard') this.color.lerp(this.highlight, 0.12 + index % 3 * 0.14);
      else if (kind === 'stepDust') this.color.lerp(this.highlight, 0.12 + index % 3 * 0.18);
      pool.mesh.setColorAt(particleIndex, this.color);
      this.writeParticle(pool, particleIndex);
    }
    for (const pool of Object.values(this.pools)) {
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
    }
  }

  private writeParticle(pool: ShapePool, index: number): void {
    const item = pool.particles[index];
    if (!item) return;
    const visible = item.life > 0;
    if (!visible) item.position.set(0, -999, 0);
    const remaining = visible ? THREE.MathUtils.clamp(item.life / item.maxLife, 0, 1) : 0;
    const envelope = item.core ? Math.min(1, remaining * 3)
      : item.kind === 'stepDust'
        ? 0.35 + Math.sin((1 - remaining) * Math.PI) * 0.65
        : Math.max(0.12, remaining);
    const size = visible ? item.size * envelope : 0;
    this.quaternion.setFromEuler(item.rotation);
    if (item.core) this.scale.set(size * 1.16, size, size * 0.58);
    else if (item.trailStyle === 'ray') this.scale.set(size * 0.28, size * 2.25, size * 0.2);
    else if (item.kind === 'stepDust' && item.trailStyle === 'splash') this.scale.set(size * 0.52, size * 1.85, size * 0.52);
    else if (item.kind === 'stepDust' && item.trailStyle === 'foliage') this.scale.set(size * 1.15, size * 0.65, size * 0.8);
    else if (item.kind === 'stepDust') this.scale.set(size * 1.35, size * 0.76, size * 1.08);
    else if (item.kind === 'tame' && pool === this.pools.puff) this.scale.set(size * 1.08, size, size * 0.82);
    else if (item.kind === 'tame') this.scale.set(size * 0.58, size * 1.5, size * 0.28);
    else this.scale.set(size, size * 1.35, size * 0.72);
    this.matrix.compose(item.position, this.quaternion, this.scale);
    pool.mesh.setMatrixAt(index, this.matrix);
  }
}
