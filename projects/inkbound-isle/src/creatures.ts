import * as THREE from 'three';
import { addInkedPart, createContactShadow, type InkOptions } from './materials.ts';
import { PALETTE } from './palette.ts';

export type Species = 'parasaur' | 'raptor' | 'rex';
export type CreatureRole = 'herbivore' | 'pack-hunter' | 'apex';
export type CompanionCommand = 'follow' | 'stay';
export type HostileSpecies = Exclude<Species, 'parasaur'>;
export type AttackPhase = 'idle' | 'alert' | 'windup' | 'active' | 'recovery';

export interface AttackState {
  phase: AttackPhase;
  remaining: number;
  hitPending: boolean;
}

export interface AttackTiming {
  alert: number;
  windup: number;
  active: number;
  recovery: number;
}

export const ATTACK_EVENT = {
  none: 0,
  alert: 1,
  windup: 2,
  hitWindow: 4,
  recovered: 8,
} as const;

export const ATTACK_TIMINGS: Record<HostileSpecies, AttackTiming> = {
  raptor: { alert: 0.2, windup: 0.34, active: 0.14, recovery: 0.68 },
  rex: { alert: 0.48, windup: 0.82, active: 0.2, recovery: 1.35 },
};

export function createAttackState(): AttackState {
  return { phase: 'idle', remaining: 0, hitPending: false };
}

export function stepAttack(
  state: AttackState,
  seconds: number,
  canStart: boolean,
  species: HostileSpecies,
): number {
  if (!Number.isFinite(seconds) || seconds < 0) return ATTACK_EVENT.none;
  const timing = ATTACK_TIMINGS[species];
  let event = ATTACK_EVENT.none;
  let left = seconds;

  if (state.phase === 'idle') {
    if (!canStart) return event;
    state.phase = 'alert';
    state.remaining = timing.alert;
    state.hitPending = false;
    event |= ATTACK_EVENT.alert;
  }

  while (left >= state.remaining && state.phase !== 'idle') {
    left -= state.remaining;
    if (state.phase === 'alert') {
      state.phase = 'windup';
      state.remaining = timing.windup;
      event |= ATTACK_EVENT.windup;
    } else if (state.phase === 'windup') {
      state.phase = 'active';
      state.remaining = timing.active;
      state.hitPending = true;
      event |= ATTACK_EVENT.hitWindow;
    } else if (state.phase === 'active') {
      state.phase = 'recovery';
      state.remaining = timing.recovery;
      state.hitPending = false;
    } else {
      state.phase = 'idle';
      state.remaining = 0;
      event |= ATTACK_EVENT.recovered;
    }
  }
  if (state.phase !== 'idle') state.remaining -= left;
  return event;
}

export interface CreatureDefinition {
  name: string;
  role: CreatureRole;
  body: number;
  accent: number;
  scale: number;
  maxHealth: number;
  speed: number;
  damage: number;
  aggroRadius: number;
  attackRange: number;
  hostile: boolean;
  tameable: boolean;
}

export const CREATURE_DEFS: Record<Species, CreatureDefinition> = {
  parasaur: {
    name: 'Mosscrest Parasaur',
    role: 'herbivore',
    body: 0x326f63,
    accent: 0x65e0c2,
    scale: 1.08,
    maxHealth: 90,
    speed: 2.6,
    damage: 0,
    aggroRadius: 0,
    attackRange: 0,
    hostile: false,
    tameable: true,
  },
  raptor: {
    name: 'Emberstripe Raptor',
    role: 'pack-hunter',
    body: 0x466867,
    accent: 0xff7a32,
    scale: 0.82,
    maxHealth: 58,
    speed: 6.1,
    damage: 9,
    aggroRadius: 20,
    attackRange: 3.6,
    hostile: true,
    tameable: false,
  },
  rex: {
    name: 'Ink-Jaw Tyrant',
    role: 'apex',
    body: 0x466d71,
    accent: PALETTE.danger,
    scale: 2.15,
    maxHealth: 260,
    speed: 4.1,
    damage: 24,
    aggroRadius: 31,
    attackRange: 9.2,
    hostile: true,
    tameable: false,
  },
};

export interface Creature {
  id: string;
  species: Species;
  definition: CreatureDefinition;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  tail: THREE.Group;
  legs: THREE.Group[];
  feet: THREE.Group[];
  health: number;
  tamed: boolean;
  dead: boolean;
  wanderAngle: number;
  wanderTimer: number;
  attack: AttackState;
  trust: number;
  feedCooldown: number;
  bodyRestX: number;
  command: CompanionCommand;
  gaitDistance: number;
  locomotionWeight: number;
}

export interface CreaturePose {
  motion: number;
  strideLength: number;
  stridePhase: number;
  legSwing: number;
  footLift: number;
  bodyLift: number;
  shoulderRoll: number;
  pelvisRoll: number;
  shoulderDrive: number;
  pelvisDrive: number;
  neckYaw: number;
  headPitch: number;
  bodyPitch: number;
  jawOpen: number;
  tailYaw: number;
}

const LOCOMOTION: Record<Species, {
  strideLength: number;
  maxLegSwing: number;
  maxFootLift: number;
  maxBodyLift: number;
  massSway: number;
  tailSwing: number;
}> = {
  parasaur: { strideLength: 1.35, maxLegSwing: 0.34, maxFootLift: 0.09, maxBodyLift: 0.035, massSway: 0.035, tailSwing: 0.1 },
  raptor: { strideLength: 0.82, maxLegSwing: 0.58, maxFootLift: 0.22, maxBodyLift: 0.075, massSway: 0.08, tailSwing: 0.22 },
  rex: { strideLength: 1.72, maxLegSwing: 0.42, maxFootLift: 0.14, maxBodyLift: 0.055, massSway: 0.045, tailSwing: 0.14 },
};

const ATTACK_WEIGHT: Record<AttackPhase, readonly [number, number, number, number, number, number]> = {
  idle: [0, 0, 0, 0, 0, 0],
  alert: [-0.025, 0.06, -0.025, 0.015, -0.012, 0.01],
  windup: [-0.09, 0.16, -0.06, 0.04, -0.04, 0.035],
  active: [0.025, -0.12, 0.22, -0.1, 0.055, -0.04],
  recovery: [-0.025, 0.06, 0.05, -0.025, -0.02, 0.015],
};

export function sampleCreaturePose(
  species: Species,
  gaitDistance: number,
  moving: boolean | number,
  attackPhase: AttackPhase,
): CreaturePose {
  const locomotion = LOCOMOTION[species];
  const motion = THREE.MathUtils.clamp(typeof moving === 'number' ? moving : Number(moving), 0, 1);
  const stridePhase = motion > 0
    ? (Math.max(0, gaitDistance) / locomotion.strideLength) * Math.PI * 2
    : 0;
  const legSwing = Math.sin(stridePhase) * locomotion.maxLegSwing * motion;
  const footLift = Math.max(0, Math.sin(stridePhase)) * locomotion.maxFootLift * motion;
  const strideWave = Math.sin(stridePhase) * motion;
  const idleApexTurn = species === 'rex' ? 0.09 * (1 - motion) : 0;
  const bodyLift = (motion > 0
    ? (1 - Math.cos(stridePhase * 2)) * locomotion.maxBodyLift * 0.5
      - Math.abs(Math.cos(stridePhase)) * locomotion.maxBodyLift * 0.35
    : 0) * motion;

  const attackPose: Record<AttackPhase, readonly [number, number, number]> = {
    idle: [0, 0, 0],
    alert: [-0.1, -0.02, 0.08],
    windup: [-0.42, -0.08, 0.12],
    active: [0.5, 0.12, species === 'rex' ? 0.58 : 0.72],
    recovery: [0.18, 0.04, 0.2],
  };
  const [headPitch, bodyPitch, jawOpen] = attackPose[attackPhase];
  const hostileWeight = species === 'rex' ? 1 : species === 'raptor' ? 0.75 : 0;
  const [attackLift, attackBrace, shoulderDrive, pelvisDrive, shoulderBrace, pelvisBrace] = ATTACK_WEIGHT[attackPhase];

  return {
    motion,
    strideLength: locomotion.strideLength,
    stridePhase,
    legSwing: legSwing + attackBrace * hostileWeight,
    footLift,
    bodyLift: bodyLift + attackLift * hostileWeight,
    shoulderRoll: strideWave * locomotion.massSway + shoulderBrace * hostileWeight,
    pelvisRoll: strideWave * locomotion.massSway * -0.82 + pelvisBrace * hostileWeight,
    shoulderDrive: shoulderDrive * hostileWeight,
    pelvisDrive: pelvisDrive * hostileWeight,
    neckYaw: strideWave * locomotion.massSway * -1.3 + idleApexTurn,
    headPitch,
    bodyPitch,
    jawOpen,
    tailYaw: strideWave * -locomotion.tailSwing - idleApexTurn,
  };
}

type HeadSection = readonly [z: number, width: number, top: number, bottom: number];

function createHeadLoft(profile: readonly HeadSection[], sectors = 32): THREE.BufferGeometry {
  const rings = (profile.length - 1) * 2 + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < rings; ring += 1) {
    const span = Math.min(profile.length - 2, Math.floor(ring / 2));
    const t = (ring - span * 2) / 2;
    const a = profile[Math.max(0, span - 1)]!;
    const b = profile[span]!;
    const c = profile[span + 1]!;
    const d = profile[Math.min(profile.length - 1, span + 2)]!;
    const sample = (component: 0 | 1 | 2 | 3): number => 0.5 * (
      2 * b[component] + (-a[component] + c[component]) * t
      + (2 * a[component] - 5 * b[component] + 4 * c[component] - d[component]) * t * t
      + (-a[component] + 3 * b[component] - 3 * c[component] + d[component]) * t * t * t
    );
    const z = sample(0);
    const width = sample(1);
    const centerY = (sample(2) + sample(3)) * 0.5;
    const height = (sample(2) - sample(3)) * 0.5;
    for (let sector = 0; sector < sectors; sector += 1) {
      const angle = (sector / sectors) * Math.PI * 2 - Math.PI / 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      positions.push(
        Math.sign(cosine) * Math.abs(cosine) ** 0.85 * width,
        centerY + Math.sign(sine) * Math.abs(sine) ** 0.9 * height,
        z,
      );
      uvs.push(sector / sectors, ring / (rings - 1));
      if (ring === rings - 1) continue;
      const current = ring * sectors + sector;
      const next = ring * sectors + (sector + 1) % sectors;
      indices.push(current, next, current + sectors, next, next + sectors, current + sectors);
    }
  }
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  const startCap = positions.length / 3;
  positions.push(0, (first[2] + first[3]) * 0.5, first[0]);
  positions.push(0, (last[2] + last[3]) * 0.5, last[0]);
  uvs.push(0.5, 0, 0.5, 1);
  for (let sector = 0; sector < sectors; sector += 1) {
    const next = (sector + 1) % sectors;
    const endRing = (rings - 1) * sectors;
    indices.push(startCap, next, sector, startCap + 1, endRing + sector, endRing + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const anatomy = {
  round: new THREE.SphereGeometry(1, 10, 7),
  mouthCavity: new THREE.SphereGeometry(1, 10, 7).scale(1, 1, -1),
  featureRound: new THREE.SphereGeometry(1, 14, 10),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 9),
  rexHead: createHeadLoft([
    [-0.66, 0.14, 0.18, -0.12],
    [-0.55, 0.32, 0.34, -0.24],
    [-0.32, 0.53, 0.47, -0.3],
    [0.02, 0.59, 0.49, -0.28],
    [0.34, 0.54, 0.4, -0.24],
    [0.6, 0.49, 0.24, -0.23],
    [0.96, 0.465, 0.19, -0.22],
    [1.24, 0.415, 0.17, -0.21],
    [1.46, 0.335, 0.14, -0.18],
    [1.59, 0.23, 0.1, -0.14],
    [1.65, 0.1, 0.04, -0.07],
    [1.665, 0.025, -0.005, -0.025],
  ]),
  rexMandible: createHeadLoft([
    [-0.61, 0.12, 0.57, 0.26],
    [-0.46, 0.31, 0.58, 0.17],
    [-0.25, 0.47, 0.42, 0.05],
    [0.02, 0.5, 0.25, -0.07],
    [0.33, 0.475, 0.13, -0.13],
    [0.75, 0.43, 0.1, -0.14],
    [1.09, 0.37, 0.085, -0.12],
    [1.32, 0.29, 0.075, -0.08],
    [1.44, 0.16, 0.055, -0.035],
    [1.47, 0.035, 0.022, 0.003],
  ]),
  parasaurBody: createHeadLoft([
    [-1.63, 0.14, 1.62, 1.23], [-1.36, 0.54, 1.94, 0.91],
    [-0.85, 0.83, 2.12, 0.74], [-0.25, 0.86, 2.1, 0.75],
    [0.35, 0.78, 2.06, 0.85], [0.83, 0.7, 2.16, 1.04],
    [1.21, 0.5, 2.31, 1.38], [1.52, 0.37, 2.34, 1.65],
    [1.78, 0.1, 2.08, 1.79],
  ], 16),
  raptorBody: createHeadLoft([
    [-1.35, 0.1, 1.44, 1.17], [-1.08, 0.33, 1.7, 0.94],
    [-0.7, 0.53, 1.88, 0.82], [-0.26, 0.5, 1.85, 0.87],
    [0.12, 0.44, 1.75, 0.94], [0.47, 0.42, 1.86, 1.11],
    [0.78, 0.29, 1.95, 1.36], [1.08, 0.24, 1.99, 1.54],
    [1.25, 0.1, 1.87, 1.68],
  ], 16),
  rexBody: createHeadLoft([
    [-1.93, 0.13, 1.68, 1.34], [-1.6, 0.55, 2.04, 0.98],
    [-1.13, 0.88, 2.28, 0.86], [-0.64, 0.85, 2.31, 0.97],
    [0, 0.8, 2.5, 1.13], [0.53, 0.93, 2.68, 1.3],
    [0.93, 0.8, 2.7, 1.48], [1.3, 0.58, 2.71, 1.72],
    [1.65, 0.41, 2.66, 2], [1.86, 0.16, 2.49, 2.22],
  ], 16),
  taperedTail: createHeadLoft([
    [-1, 0.004, -0.035, -0.045], [-0.87, 0.035, 0.02, -0.06],
    [-0.66, 0.1, 0.08, -0.12], [-0.42, 0.21, 0.18, -0.21],
    [-0.17, 0.35, 0.28, -0.27], [0.05, 0.44, 0.35, -0.31],
    [0.16, 0.31, 0.24, -0.22],
  ], 16),
  taperedThigh: createHeadLoft([
    [-0.14, 0.18, 0.16, -0.18], [0.04, 0.29, 0.28, -0.22],
    [0.3, 0.28, 0.4, -0.1], [0.6, 0.19, 0.44, 0.13],
    [0.75, 0.1, 0.38, 0.19],
  ], 12).rotateX(Math.PI / 2),
  taperedShin: createHeadLoft([
    [-0.13, 0.15, 0.17, -0.13], [0.02, 0.22, 0.15, -0.19],
    [0.34, 0.17, 0.05, -0.24], [0.69, 0.13, -0.01, -0.25],
    [0.97, 0.1, -0.025, -0.2],
  ], 12).rotateX(Math.PI / 2),
  ankleFoot: createHeadLoft([
    [-0.28, 0.08, 0.3, -0.04], [-0.1, 0.19, 0.59, -0.1],
    [0.17, 0.37, 0.25, -0.11], [0.57, 0.32, 0.1, -0.09],
    [0.84, 0.04, 0.025, -0.035],
  ], 12),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  claw: new THREE.ConeGeometry(0.12, 0.48, 5),
  tooth: new THREE.ConeGeometry(0.055, 0.22, 5),
};

type VectorTuple = readonly [number, number, number];

interface CreatureMotionRig {
  shoulders: THREE.Group;
  pelvis: THREE.Group;
  neck: THREE.Group;
  shoulderRestZ: number;
  pelvisRestZ: number;
}

const creatureMotionRigs = new WeakMap<THREE.Group, CreatureMotionRig>();
const footContacts = new WeakMap<THREE.Group, { points: THREE.Vector3[]; rest: THREE.Vector3; scale: THREE.Vector3; axis: THREE.Vector3; ankle: THREE.Vector3; anchor: THREE.Vector3; reach: number; planted: boolean; initialized: boolean }>();
const groundPoint = new THREE.Vector3();
const groundNatural = new THREE.Vector3();
const groundHip = new THREE.Vector3();
const groundProbe = new THREE.Vector3();
const groundUp = new THREE.Vector3(0, 1, 0);
const groundNormal = new THREE.Vector3();
const groundRotation = new THREE.Quaternion();
const groundParentRotation = new THREE.Quaternion();
const groundRootRotation = new THREE.Quaternion();

function cacheFootContact(foot: THREE.Group): void {
  foot.updateWorldMatrix(true, true);
  const inverse = foot.matrixWorld.clone().invert();
  const points: THREE.Vector3[] = [];
  foot.traverse((part) => {
    if (!(part instanceof THREE.Mesh) || !part.userData.inkFill) return;
    const vertices = part.geometry.getAttribute('position');
    for (let index = 0; index < vertices.count; index += 1) {
      points.push(new THREE.Vector3().fromBufferAttribute(vertices, index).applyMatrix4(part.matrixWorld).applyMatrix4(inverse));
    }
  });
  const lowest = Math.min(...points.map((point) => point.y));
  const scale = foot.parent!.children[0]!.scale.clone();
  const shinVertices = anatomy.taperedShin.getAttribute('position');
  const anchor = foot.getWorldPosition(new THREE.Vector3());
  footContacts.set(foot, {
    points: points.filter((point) => point.y < lowest + 0.08), rest: foot.position.clone(), scale,
    axis: new THREE.Vector3().fromBufferAttribute(shinVertices, shinVertices.count - 1).multiply(scale),
    ankle: new THREE.Vector3(0, 0.22, -0.14).multiply(foot.children[0]!.scale),
    anchor, reach: anchor.distanceTo(foot.parent!.parent!.getWorldPosition(new THREE.Vector3())), planted: false, initialized: false,
  });
}

function plantFeet(creature: Creature, pose: CreaturePose, delta: number, height: (x: number, z: number) => number): void {
  const moving = pose.motion > 0.001;
  creature.root.getWorldQuaternion(groundRootRotation);
  creature.feet.forEach((foot, index) => {
    const contact = footContacts.get(foot)!;
    const parent = foot.parent!;
    foot.position.copy(contact.rest);
    parent.updateWorldMatrix(true, false);
    foot.getWorldPosition(groundPoint);
    groundNatural.copy(groundPoint);
    if (!contact.initialized) {
      contact.anchor.copy(groundNatural);
      contact.initialized = true;
    }
    const side = (index % 2 === 0 ? 1 : -1) * (creature.species === 'parasaur' && index >= 2 ? -1 : 1);
    const swinging = moving && Math.sin(pose.stridePhase) * side > 0;
    if (!moving) {
      contact.planted = true;
    } else if (swinging) {
      contact.planted = false;
      const dx = groundNatural.x - contact.anchor.x;
      const dz = groundNatural.z - contact.anchor.z;
      const distance = Math.hypot(dx, dz);
      const catchUp = Math.min(0.44, delta * creature.definition.speed * 2.1);
      const blend = distance > 0 ? Math.min(1, catchUp / distance) : 1;
      contact.anchor.x += dx * blend;
      contact.anchor.z += dz * blend;
    } else {
      contact.planted = true;
    }
    creature.legs[index]!.getWorldPosition(groundHip);
    const dx = contact.anchor.x - groundHip.x;
    const dz = contact.anchor.z - groundHip.z;
    const distance = Math.hypot(dx, dz);
    const vertical = height(contact.anchor.x, contact.anchor.z) - groundHip.y;
    const horizontalReach = Math.sqrt(Math.max(0, (contact.reach * 1.35) ** 2 - vertical * vertical));
    if (distance > horizontalReach) {
      const scale = horizontalReach / distance;
      contact.anchor.x = groundHip.x + dx * scale;
      contact.anchor.z = groundHip.z + dz * scale;
    }
    groundPoint.x = contact.anchor.x;
    groundPoint.z = contact.anchor.z;
    const { x, z } = groundPoint;
    groundNormal.set(height(x - 0.2, z) - height(x + 0.2, z), 0.4, height(x, z - 0.2) - height(x, z + 0.2)).normalize();
    groundRotation.setFromUnitVectors(groundUp, groundNormal).multiply(groundRootRotation);
    parent.getWorldQuaternion(groundParentRotation);
    foot.quaternion.copy(groundParentRotation).invert().multiply(groundRotation);
    groundPoint.set(x, height(x, z), z);
    foot.position.copy(parent.worldToLocal(groundPoint));
    foot.updateWorldMatrix(false, true);
    let clearance = Infinity;
    for (const point of contact.points) {
      groundProbe.copy(point).applyMatrix4(foot.matrixWorld);
      clearance = Math.min(clearance, groundProbe.y - height(groundProbe.x, groundProbe.z));
    }
    const lift = moving
      ? Math.max(0, Math.sin(pose.stridePhase) * side) * LOCOMOTION[creature.species].maxFootLift * pose.motion
      : 0;
    foot.getWorldPosition(groundPoint);
    groundPoint.y += 0.008 + lift * creature.definition.scale - clearance;
    foot.position.copy(parent.worldToLocal(groundPoint));
    foot.updateWorldMatrix(false, true);
    groundProbe.copy(contact.ankle).applyMatrix4(foot.matrixWorld);
    parent.worldToLocal(groundProbe);
    const shin = parent.children[0]!;
    shin.scale.copy(contact.scale).multiplyScalar(THREE.MathUtils.clamp(groundProbe.length() / contact.axis.length() * 1.08, 0.6, 1.35));
    shin.scale.x = contact.scale.x;
    shin.quaternion.setFromUnitVectors(groundNormal.copy(contact.axis).normalize(), groundProbe.normalize());
    const shadow = creature.root.getObjectByName(`rex-${index === 0 ? 'left' : 'right'}-foot-shadow`);
    if (shadow) {
      foot.getWorldPosition(groundPoint);
      groundPoint.y = height(groundPoint.x, groundPoint.z) + 0.035;
      shadow.position.copy(creature.root.worldToLocal(groundPoint));
      shadow.quaternion.copy(groundRootRotation).invert().multiply(groundRotation);
    }
  });
}

function addSkinPart(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: number,
  position: VectorTuple,
  scale: VectorTuple,
  rotation: VectorTuple = [0, 0, 0],
  options: InkOptions = {},
): THREE.Group {
  const part = addInkedPart(parent, geometry, color, position, scale, rotation, {
    outline: false,
    ...options,
    surface: 'skin',
  });
  part.userData.surface = 'skin';
  part.traverse((child) => {
    if (child.userData.inkFill) child.userData.surface = 'skin';
  });
  return part;
}

function addBodyRig(body: THREE.Group, species: Species): CreatureMotionRig {
  const offsets: Record<Species, readonly [VectorTuple, VectorTuple, VectorTuple]> = {
    parasaur: [[0, 1.48, 0.68], [0, 1.42, -0.25], [0, 1.66, 1.04]],
    raptor: [[0, 1.31, 0.08], [0, 1.32, -0.59], [0, 1.55, 0.75]],
    rex: [[0, 2.02, 0.6], [0, 1.49, -1.05], [0, 2.1, 1.28]],
  };
  const geometry = species === 'parasaur' ? anatomy.parasaurBody : species === 'raptor' ? anatomy.raptorBody : anatomy.rexBody;
  const torso = addSkinPart(body, geometry, species === 'rex' ? 0x4f797b : CREATURE_DEFS[species].body, [0, 0, 0], [1, 1, 1], [0, 0, 0], { outline: true });
  torso.name = `${species}-continuous-torso`;
  const shoulders = new THREE.Group();
  const pelvis = new THREE.Group();
  const neck = new THREE.Group();
  shoulders.name = `${species}-shoulders`;
  pelvis.name = species === 'rex' ? 'rex-wide-pelvis' : `${species}-pelvis`;
  neck.name = species === 'rex' ? 'rex-forward-neck' : `${species}-neck`;
  shoulders.position.set(...offsets[species][0]);
  pelvis.position.set(...offsets[species][1]);
  neck.position.set(...offsets[species][2]);
  body.add(shoulders, pelvis, neck);
  return { shoulders, pelvis, neck, shoulderRestZ: shoulders.position.z, pelvisRestZ: pelvis.position.z };
}

function addExpressiveEyes(
  parent: THREE.Object3D,
  browColor: number,
  y: number,
  z: number,
  spread: number,
  size: number,
  browTilt = 0.16,
): void {
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'left' : 'right';
    const white = addInkedPart(
      parent,
      anatomy.round,
      0xfff1d2,
      [side * spread, y, z],
      [size, size * 0.78, size * 0.5],
      [0, 0, 0],
      { outline: false },
    );
    white.name = `${sideName}-eye-white`;
    const pupil = addInkedPart(
      parent,
      anatomy.round,
      PALETTE.ink,
      [side * spread, y - size * 0.03, z + size * 0.46],
      [size * 0.36, size * 0.45, size * 0.18],
      [0, 0, 0],
      { outline: false },
    );
    pupil.name = `${sideName}-pupil`;
    const brow = addSkinPart(
      parent,
      anatomy.round,
      browColor,
      [side * spread, y + size * 0.72, z - size * 0.02],
      [size * 1.2, size * 0.23, size * 0.34],
      [0, 0, side * browTilt],
    );
    brow.name = `${sideName}-brow`;
  }
}

function addCreatureLeg(
  parent: THREE.Object3D,
  species: Species,
  x: number,
  z: number,
  color: number,
  label: string,
): readonly [THREE.Group, THREE.Group] {
  const settings: Record<Species, readonly [number, number, VectorTuple, VectorTuple, VectorTuple]> = {
    parasaur: [1.3, -0.59, [0.82, 0.9, 0.65], [0.85, 0.9, 0.65], [0.55, 0.65, 0.57]],
    raptor: [1.42, -0.66, [1, 1, 1], [0.85, 0.75, 0.85], [0.46, 1.05, 0.78]],
    rex: [1.74, -0.92, [1.6, 1.03, 1.1], [1.5, 1.15, 1.2], [0.86, 1.18, 0.8]],
  };
  const [height, footY, thighScale, shinScale, footScale] = settings[species];
  const leg = new THREE.Group();
  leg.name = `${label}-${species === 'rex' ? 'heavy-thigh' : species === 'raptor' ? 'digitigrade-thigh' : 'upper-leg'}`;
  leg.position.set(x, height, z);
  addSkinPart(leg, anatomy.taperedThigh, color, [0, 0, 0], thighScale).name = `${label}-${species === 'rex' ? 'knee-mass' : 'thigh-surface'}`;
  const shin = new THREE.Group();
  shin.name = `${label}-${species === 'rex' ? 'shin' : species === 'raptor' ? 'digitigrade-shin' : 'lower-leg'}`;
  shin.position.set(0, -0.66, 0.24);
  shin.rotation.x = species === 'rex' ? 0.34 : 0;
  shin.userData.restRotationX = shin.rotation.x;
  addSkinPart(shin, anatomy.taperedShin, species === 'rex' ? 0x6a908c : color, [0, 0, 0], shinScale).name = `${label}-shin-surface`;
  const foot = new THREE.Group();
  foot.name = `${label}-${species === 'rex' ? 'weight-bearing-foot' : species === 'raptor' ? 'foot-with-sickle-claw' : 'foot'}`;
  foot.position.set(0, footY, species === 'rex' ? 0.25 : 0.1);
  foot.userData.restY = foot.position.y;
  foot.userData.restRotationX = species === 'rex' ? -0.34 : species === 'raptor' ? 0.11 : 0;
  foot.rotation.x = Number(foot.userData.restRotationX);
  addSkinPart(foot, anatomy.ankleFoot, species === 'rex' ? 0x5d8584 : color, [0, 0, 0], footScale);
  for (const toe of species === 'raptor' ? [-1, 1] : [-1, 0, 1]) {
    addInkedPart(foot, anatomy.claw, PALETTE.cloud, [toe * 0.23 * footScale[0], -0.035 * footScale[1], (toe === 0 ? 0.85 : 0.62) * footScale[2]], [0.65 * footScale[0], 0.6 * footScale[2], 0.65 * footScale[0]], [Math.PI / 2, 0, 0], { outline: false });
  }
  if (species === 'raptor') {
    addInkedPart(foot, anatomy.claw, PALETTE.cloud, [-Math.sign(x) * 0.08, 0.1, 0.32], [0.68, 0.68, 0.68], [0.78, 0, 0], { outline: false });
    addInkedPart(foot, anatomy.claw, PALETTE.cloud, [-Math.sign(x) * 0.08, 0.18, 0.44], [0.48, 0.48, 0.48], [1.22, 0, 0], { outline: false });
  }
  shin.add(foot);
  leg.add(shin);
  parent.add(leg);
  return [leg, foot];
}

export function createCreature(species: Species, id: string, position: THREE.Vector3): Creature {
  const definition = CREATURE_DEFS[species];
  const root = new THREE.Group();
  root.name = definition.name;
  root.position.copy(position);
  root.scale.setScalar(definition.scale);
  root.userData.surface = 'skin';

  const body = new THREE.Group();
  body.name = `${species}-body-rig`;
  body.userData.surface = 'skin';
  root.add(body);
  const legs: THREE.Group[] = [];
  const feet: THREE.Group[] = [];
  const arms: THREE.Group[] = [];
  let head: THREE.Group;
  let jaw: THREE.Group;
  let tail: THREE.Group;
  let motionRig: CreatureMotionRig;

  if (species === 'parasaur') {
    motionRig = addBodyRig(body, species);
    head = new THREE.Group();
    head.name = 'parasaur-head';
    head.position.set(0, 1.94, 1.62);
    addSkinPart(head, anatomy.featureRound, definition.body, [0, 0, 0], [0.62, 0.54, 0.72], [0, 0, 0], { outline: true });
    const upperJaw = addSkinPart(head, anatomy.featureRound, 0x4e8b72, [0, -0.14, 0.61], [0.58, 0.24, 0.72]);
    upperJaw.name = 'parasaur-upper-jaw';
    const beak = addSkinPart(head, anatomy.cone, 0x6da186, [0, -0.13, 1.03], [0.46, 0.38, 0.46], [Math.PI / 2, 0, 0]);
    beak.name = 'parasaur-beak';
    jaw = new THREE.Group();
    jaw.name = 'parasaur-lower-jaw';
    jaw.position.set(0, -0.22, 0.11);
    addSkinPart(jaw, anatomy.featureRound, 0x467a68, [0, -0.04, 0.55], [0.57, 0.16, 0.68]);
    head.add(jaw);
    addSkinPart(head, anatomy.capsule, definition.accent, [0, 0.51, -0.08], [0.23, 0.53, 0.23], [-0.72, 0, 0], {
      emissive: 0x123f38,
      emissiveIntensity: 0.35,
    }).name = 'parasaur-tubular-crest-base';
    addSkinPart(head, anatomy.capsule, definition.accent, [0, 0.8, -0.5], [0.18, 0.4, 0.18], [-1.05, 0, 0], {
      emissive: 0x123f38,
      emissiveIntensity: 0.35,
    }).name = 'parasaur-tubular-crest-tip';
    addExpressiveEyes(head, definition.body, 0.16, 0.54, 0.42, 0.14, 0.08);
    body.add(head);
    tail = new THREE.Group();
    tail.name = 'parasaur-tail';
    tail.position.set(0, 1.4, -1.14);
    addSkinPart(tail, anatomy.taperedTail, definition.body, [0, 0, 0], [1.4, 1.4, 2.7], [0, 0, 0], { outline: true });
    body.add(tail);
    for (const [x, z, label] of [
      [-0.54, 0.68, 'left-front'],
      [0.54, 0.68, 'right-front'],
      [-0.62, -0.7, 'left-hind'],
      [0.62, -0.7, 'right-hind'],
    ] as const) {
      const [leg, foot] = addCreatureLeg(body, species, x, z, definition.body, label);
      legs.push(leg);
      feet.push(foot);
    }
  } else if (species === 'raptor') {
    const raptorSignal: InkOptions = { emissive: 0x5b1a05, emissiveIntensity: 0.7 };
    body.rotation.x = -0.11;
    motionRig = addBodyRig(body, species);
    addSkinPart(body, anatomy.round, definition.accent, [0, 1.69, -0.02], [0.37, 0.11, 0.9], [0, 0, 0], raptorSignal).name = 'raptor-dorsal-signal-stripe';
    head = new THREE.Group();
    head.name = 'raptor-head';
    head.position.set(0, 1.79, 1.27);
    addSkinPart(head, anatomy.featureRound, 0x4d706f, [0, 0, 0], [0.49, 0.41, 0.64], [0, 0, 0], { outline: true });
    const upperJaw = addSkinPart(head, anatomy.featureRound, 0x5f7f7a, [0, -0.14, 0.67], [0.39, 0.17, 0.84]);
    upperJaw.name = 'raptor-narrow-upper-jaw';
    jaw = new THREE.Group();
    jaw.name = 'raptor-narrow-lower-jaw';
    jaw.position.set(0, -0.24, 0.15);
    addSkinPart(jaw, anatomy.featureRound, 0x506f6e, [0, -0.03, 0.58], [0.39, 0.13, 0.73]);
    head.add(jaw);
    addSkinPart(jaw, anatomy.round, definition.accent, [0, -0.12, 0.6], [0.31, 0.045, 0.57], [0, 0, 0], raptorSignal).name = 'raptor-jaw-signal-stripe';
    addSkinPart(head, anatomy.round, definition.accent, [0, 0.39, 0.03], [0.43, 0.11, 0.64], [0, 0, 0], raptorSignal).name = 'raptor-face-signal-stripe';
    addExpressiveEyes(head, definition.accent, 0.1, 0.58, 0.35, 0.14, 0.2);
    for (const side of [-1, 1]) {
      for (const z of [0.55, 0.83]) {
        addInkedPart(head, anatomy.tooth, PALETTE.cloud, [side * 0.28, -0.32, z], [1, 1, 1], [0, 0, Math.PI], { outline: false });
      }
    }
    body.add(head);
    tail = new THREE.Group();
    tail.name = 'raptor-counterbalance-tail';
    tail.position.set(0, 1.29, -0.96);
    addSkinPart(tail, anatomy.taperedTail, definition.body, [0, 0, 0], [0.95, 1.05, 3.25], [0, 0, 0], { outline: true });
    body.add(tail);
    for (const [x, label] of [[-0.38, 'left'], [0.38, 'right']] as const) {
      const [leg, foot] = addCreatureLeg(body, species, x, -0.25, definition.body, label);
      legs.push(leg);
      feet.push(foot);
    }
    for (const side of [-1, 1]) {
      const arm = addSkinPart(body, anatomy.taperedThigh, definition.body, [side * 0.32, 1.46, 0.58], [0.3, 0.9, 1.6]);
      arm.name = `raptor-${side < 0 ? 'left' : 'right'}-connected-arm`;
      addInkedPart(arm, anatomy.claw, PALETTE.cloud, [side * 0.1, -0.73, 0.29], [1.26, 0.5, 0.24], [1.05, 0, 0], { outline: false });
      arms.push(arm);
    }
  } else {
    const apexSignal: InkOptions = { emissive: 0x71150b, emissiveIntensity: 0.9 };
    motionRig = addBodyRig(body, species);
    for (const side of [-1, 1]) {
      addSkinPart(body, anatomy.round, definition.accent, [side * 0.92, 2.07, 0.64], [0.085, 0.23, 0.38], [0, 0, side * 0.08], apexSignal).name = side < 0
        ? 'rex-left-shoulder-signal'
        : 'rex-right-shoulder-signal';
    }
    head = new THREE.Group();
    head.name = 'rex-head';
    head.position.set(0, 2.34, 1.86);
    head.rotation.y = 0.04;
    const upperJaw = addSkinPart(head, anatomy.rexHead, 0x6e9693, [0, 0, 0], [1, 1, 1], [0, 0, 0], { outline: true });
    upperJaw.name = 'rex-heavy-upper-jaw';
    upperJaw.children.forEach((child) => {
      if (child.userData.inkFill) child.name = 'rex-cranial-plane';
    });
    jaw = new THREE.Group();
    jaw.name = 'rex-heavy-lower-jaw';
    jaw.position.set(0, -0.61, 0.1);
    addSkinPart(jaw, anatomy.rexMandible, 0x537c7d, [0, 0, 0], [1, 1, 1]).name = 'rex-lower-jaw-mass';
    const mouthLine = new THREE.Group();
    mouthLine.name = 'rex-mouth-line';
    mouthLine.position.set(0, 0.22, 0);
    addInkedPart(mouthLine, anatomy.mouthCavity, PALETTE.ink, [0, 0, 0.72], [0.43, 0.13, 0.7], [0, 0, 0], {
      outline: false,
      unlit: true,
    }).name = 'rex-mouth-cavity';
    addSkinPart(mouthLine, anatomy.featureRound, definition.accent, [0, -0.02, 0.63], [0.34, 0.055, 0.45], [0, 0, 0], apexSignal).name = 'rex-signal-jaw';
    jaw.add(mouthLine);
    head.add(jaw);
    addSkinPart(head, anatomy.cone, definition.accent, [0, 0.59, -0.12], [0.28, 0.44, 0.24], [0, 0, 0], apexSignal).name = 'rex-signal-crest';
    const recessedBrow = new THREE.Group();
    recessedBrow.name = 'rex-recessed-brow';
    head.add(recessedBrow);
    for (const side of [-1, 1]) {
      const sideName = side < 0 ? 'left' : 'right';
      const eyeWhite = addInkedPart(head, anatomy.round, 0xfff1d2, [side * 0.451, 0.303, 0.3], [0.075, 0.06, 0.038], [0, side * 0.35, 0], { outline: false });
      eyeWhite.name = `${sideName}-eye-white`;
      addSkinPart(head, anatomy.round, definition.accent, [side * 0.457, 0.302, 0.335], [0.024, 0.032, 0.016], [0, side * 0.35, 0], apexSignal).name = side < 0
        ? 'rex-left-signal-eye'
        : 'rex-right-signal-eye';
      addSkinPart(recessedBrow, anatomy.cone, 0x355e63, [side * 0.41, 0.357, 0.27], [0.3, 0.12, 0.18], [0, side * 0.15, side * -0.18]).name = `rex-${sideName}-brow-plane`;
      addInkedPart(upperJaw, anatomy.round, PALETTE.ink, [side * 0.185, 0.005, 1.616], [0.052, 0.026, 0.02], [0, side * 0.15, 0], {
        outline: false,
        unlit: true,
      }).name = side < 0 ? 'rex-left-nostril' : 'rex-right-nostril';
    }
    for (const side of [-1, 1]) {
      const sideName = side < 0 ? 'left' : 'right';
      for (const [fangName, z, height] of [
        ['front', 1.28, 1.5],
        ['middle', 0.94, 1.3],
        ['rear', 0.6, 1.1],
      ] as const) {
        addInkedPart(head, anatomy.tooth, PALETTE.cloud, [side * 0.32, -0.265, z], [0.8, height, 0.8], [0, 0, Math.PI], { outline: false }).name = `rex-${sideName}-${fangName}-fang`;
      }
    }
    body.add(head);
    tail = new THREE.Group();
    tail.name = 'rex-muscular-tail';
    tail.position.set(0, 1.56, -1.3);
    addSkinPart(tail, anatomy.taperedTail, definition.body, [0, 0, 0], [1.8, 1.65, 3.6], [0, 0, 0], { outline: true });
    body.add(tail);
    for (const [x, label] of [[-0.78, 'left'], [0.78, 'right']] as const) {
      const [leg, foot] = addCreatureLeg(body, species, x, -0.34 + (x < 0 ? 0.09 : -0.08), definition.body, label);
      legs.push(leg);
      feet.push(foot);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = side < 0 ? 'rex-left-short-arm' : 'rex-right-short-arm';
      arm.position.set(side * 0.78, 1.9, 0.72);
      addSkinPart(arm, anatomy.capsule, definition.body, [0, -0.13, 0.08], [0.12, 0.2, 0.13], [0.86, 0, side * -0.3]);
      const forearm = new THREE.Group();
      forearm.position.set(0, -0.25, 0.18);
      addSkinPart(forearm, anatomy.capsule, definition.body, [0, -0.1, 0.07], [0.09, 0.14, 0.09], [0.92, 0, 0]);
      for (const clawOffset of [-0.045, 0.045]) {
        addInkedPart(forearm, anatomy.claw, PALETTE.cloud, [clawOffset, -0.17, 0.16], [0.3, 0.38, 0.3], [1.15, 0, 0], { outline: false });
      }
      arm.add(forearm);
      body.add(arm);
      arms.push(arm);
    }
  }
  body.updateWorldMatrix(true, true);
  motionRig.neck.attach(head);
  motionRig.pelvis.attach(tail);
  legs.forEach((leg) => motionRig.pelvis.attach(leg));
  arms.forEach((arm) => motionRig.shoulders.attach(arm));
  feet.forEach(cacheFootContact);
  creatureMotionRigs.set(body, motionRig);

  const shadowSize: Record<Species, readonly [number, number]> = {
    parasaur: [2, 3.8],
    raptor: [1.4, 3.3],
    rex: [3.4, 4.4],
  };
  const contactShadow = createContactShadow(...shadowSize[species]);
  contactShadow.name = 'contact-shadow';
  if (species === 'rex') contactShadow.position.y = 0.055;
  root.add(contactShadow);
  if (species === 'rex') {
    for (const [x, z, name] of [
      [-0.9, 0.35, 'rex-left-foot-shadow'],
      [0.9, 0.18, 'rex-right-foot-shadow'],
    ] as const) {
      const footShadow = createContactShadow(1.25, 1.65);
      footShadow.name = name;
      footShadow.position.set(x, 0.05, z);
      root.add(footShadow);
    }
  }

  const creature: Creature = {
    id,
    species,
    definition,
    root,
    body,
    head,
    jaw,
    tail,
    legs,
    feet,
    health: definition.maxHealth,
    tamed: false,
    dead: false,
    wanderAngle: (id.length * 1.71) % (Math.PI * 2),
    wanderTimer: 1 + (id.length % 4),
    attack: createAttackState(),
    trust: 0,
    feedCooldown: 0,
    bodyRestX: body.rotation.x,
    command: 'follow',
    gaitDistance: 0,
    locomotionWeight: 0,
  };
  root.userData.creature = creature;
  return creature;
}

export function createIslandCreatures(heightSampler: (x: number, z: number) => number): Creature[] {
  const placements: ReadonlyArray<readonly [Species, string, number, number]> = [
    ['parasaur', 'parasaur-1', -18, 10],
    ['parasaur', 'parasaur-2', -23, 16],
    ['parasaur', 'parasaur-3', 8, 18],
    ['raptor', 'raptor-1', 30, 22],
    ['raptor', 'raptor-2', 35, 19],
    ['raptor', 'raptor-3', 27, 26],
    ['raptor', 'raptor-4', 38, -8],
    ['rex', 'rex-1', 25, -30],
  ];
  return placements.map(([species, id, x, z]) => createCreature(
    species,
    id,
    new THREE.Vector3(x, heightSampler(x, z), z),
  ));
}

function turnToward(current: number, target: number, amount: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * Math.min(1, amount);
}

export function updateCreature(
  creature: Creature,
  delta: number,
  elapsed: number,
  playerPosition: THREE.Vector3,
  heightSampler: (x: number, z: number) => number,
  night: boolean,
): number {
  if (creature.dead) {
    creature.root.rotation.z = THREE.MathUtils.lerp(creature.root.rotation.z, Math.PI / 2, delta * 2.2);
    return ATTACK_EVENT.none;
  }

  creature.feedCooldown = Math.max(0, creature.feedCooldown - delta);
  const dx = playerPosition.x - creature.root.position.x;
  const dz = playerPosition.z - creature.root.position.z;
  const distance = Math.hypot(dx, dz);
  const aggroRadius = creature.definition.aggroRadius * (night ? 1.35 : 1);
  const attackSpecies: HostileSpecies | null = creature.species === 'raptor' || creature.species === 'rex'
    ? creature.species : null;
  const committed = creature.attack.phase !== 'idle';
  const hunting = creature.definition.hostile && (distance < aggroRadius || committed);
  let attackEvent: number = ATTACK_EVENT.none;
  if (attackSpecies && creature.definition.hostile) {
    attackEvent = stepAttack(
      creature.attack,
      delta,
      distance < creature.definition.attackRange + 0.35,
      attackSpecies,
    );
    attackEvent &= ~ATTACK_EVENT.hitWindow;
  }

  let targetAngle = creature.wanderAngle;
  let speed = creature.definition.speed * 0.22;

  if (creature.tamed) {
    if (creature.command === 'follow') {
      targetAngle = Math.atan2(dx, dz);
      speed = distance > 4.2 ? creature.definition.speed : 0;
    } else {
      targetAngle = creature.root.rotation.y;
      speed = 0;
    }
  } else if (hunting) {
    targetAngle = Math.atan2(dx, dz);
    speed = creature.attack.phase === 'idle'
      ? creature.definition.speed * (night ? 1.12 : 1)
      : creature.attack.phase === 'active' ? creature.definition.speed * 1.35 : 0;
  } else if (creature.species === 'parasaur' && distance < 5) {
    targetAngle = Math.atan2(-dx, -dz);
    speed = creature.definition.speed * 0.8;
  } else {
    creature.wanderTimer -= delta;
    if (creature.wanderTimer <= 0) {
      creature.wanderAngle += Math.sin(elapsed * 0.37 + creature.id.length) * 1.7;
      creature.wanderTimer = 2.5 + ((creature.id.length * 0.73) % 3);
    }
  }

  creature.root.rotation.y = turnToward(creature.root.rotation.y, targetAngle, delta * 2.6);
  const previousX = creature.root.position.x;
  const previousZ = creature.root.position.z;
  let nextX = creature.root.position.x + Math.sin(creature.root.rotation.y) * speed * delta;
  let nextZ = creature.root.position.z + Math.cos(creature.root.rotation.y) * speed * delta;
  if (hunting && creature.attack.phase === 'active') {
    const separation = creature.definition.attackRange;
    const nextDistance = Math.hypot(nextX - playerPosition.x, nextZ - playerPosition.z);
    if (nextDistance < separation && nextDistance > 0) {
      nextX = playerPosition.x + (nextX - playerPosition.x) * separation / nextDistance;
      nextZ = playerPosition.z + (nextZ - playerPosition.z) * separation / nextDistance;
    }
  }
  const nextHeight = heightSampler(nextX, nextZ);
  if (nextHeight > 0.45 && Math.hypot(nextX, nextZ) < 64) {
    creature.root.position.x = nextX;
    creature.root.position.z = nextZ;
    creature.root.position.y = nextHeight;
  } else {
    creature.wanderAngle += Math.PI * 0.8;
  }

  const movedDistance = Math.hypot(
    creature.root.position.x - previousX,
    creature.root.position.z - previousZ,
  );
  creature.gaitDistance += movedDistance;
  const locomotionTarget = movedDistance > 0.0001 ? 1 : 0;
  creature.locomotionWeight = THREE.MathUtils.damp(
    creature.locomotionWeight,
    locomotionTarget,
    locomotionTarget ? 14 : 5.5,
    delta,
  );
  if (Math.abs(creature.locomotionWeight - locomotionTarget) < 0.001) creature.locomotionWeight = locomotionTarget;
  const pose = sampleCreaturePose(creature.species, creature.gaitDistance, creature.locomotionWeight, creature.attack.phase);
  creature.legs.forEach((leg, index) => {
    const diagonal = creature.species === 'parasaur' && index >= 2 ? -1 : 1;
    const side = index % 2 === 0 ? 1 : -1;
    leg.rotation.x = Number(leg.userData.restRotationX ?? 0) + pose.legSwing * side * diagonal;
  });
  creature.tail.rotation.y = pose.tailYaw;
  creature.head.rotation.x = pose.headPitch;
  creature.head.rotation.y = pose.neckYaw * 0.45;
  creature.jaw.rotation.x = pose.jawOpen;
  creature.body.rotation.x = creature.bodyRestX + pose.bodyPitch;
  creature.body.position.y = pose.bodyLift;
  const motionRig = creatureMotionRigs.get(creature.body);
  if (motionRig) {
    motionRig.shoulders.rotation.z = pose.shoulderRoll;
    motionRig.pelvis.rotation.z = pose.pelvisRoll;
    motionRig.shoulders.position.z = motionRig.shoulderRestZ + pose.shoulderDrive;
    motionRig.pelvis.position.z = motionRig.pelvisRestZ + pose.pelvisDrive;
    motionRig.neck.rotation.y = pose.neckYaw;
  }
  plantFeet(creature, pose, delta, heightSampler);

  const resolvedDistance = creature.root.position.distanceTo(playerPosition);
  if (attackSpecies && creature.attack.phase === 'active' && creature.attack.hitPending
    && resolvedDistance <= creature.definition.attackRange + 0.55) {
    attackEvent |= ATTACK_EVENT.hitWindow;
  }

  return attackEvent;
}

export function damageCreature(creature: Creature, amount: number): boolean {
  if (creature.dead || !Number.isFinite(amount) || amount <= 0) return false;
  creature.health = Math.max(0, creature.health - amount);
  if (creature.health === 0) {
    creature.dead = true;
    creature.attack.phase = 'idle';
    creature.attack.remaining = 0;
    creature.attack.hitPending = false;
  }
  return true;
}

export function tameCreature(creature: Creature): boolean {
  if (creature.dead || !creature.definition.tameable || creature.tamed) return false;
  creature.tamed = true;
  creature.command = 'follow';
  creature.definition = { ...creature.definition, hostile: false };
  creature.attack.phase = 'idle';
  creature.attack.remaining = 0;
  creature.attack.hitPending = false;
  return true;
}
