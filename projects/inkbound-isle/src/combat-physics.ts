export interface PointXZ {
  x: number;
  z: number;
}

export interface Disc extends PointXZ {
  radius: number;
}

export interface FacingPoint extends PointXZ {
  yaw: number;
}

export interface OrientedBox extends PointXZ {
  halfWidth: number;
  halfDepth: number;
  yaw: number;
}

export function orientedBoxesOverlap(left: OrientedBox, right: OrientedBox): boolean {
  const axes = [
    { x: Math.cos(left.yaw), z: -Math.sin(left.yaw) },
    { x: Math.sin(left.yaw), z: Math.cos(left.yaw) },
    { x: Math.cos(right.yaw), z: -Math.sin(right.yaw) },
    { x: Math.sin(right.yaw), z: Math.cos(right.yaw) },
  ];
  const delta = { x: right.x - left.x, z: right.z - left.z };
  const radiusOn = (box: OrientedBox, axis: PointXZ) => {
    const widthAxis = { x: Math.cos(box.yaw), z: -Math.sin(box.yaw) };
    const depthAxis = { x: Math.sin(box.yaw), z: Math.cos(box.yaw) };
    return box.halfWidth * Math.abs(axis.x * widthAxis.x + axis.z * widthAxis.z)
      + box.halfDepth * Math.abs(axis.x * depthAxis.x + axis.z * depthAxis.z);
  };
  return axes.every((axis) => (
    Math.abs(delta.x * axis.x + delta.z * axis.z) < radiusOn(left, axis) + radiusOn(right, axis) - 1e-6
  ));
}

export function orientedBoxIntersectsDisc(box: OrientedBox, disc: Disc): boolean {
  const dx = disc.x - box.x;
  const dz = disc.z - box.z;
  const cosine = Math.cos(box.yaw);
  const sine = Math.sin(box.yaw);
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  const nearestX = Math.max(-box.halfWidth, Math.min(box.halfWidth, localX));
  const nearestZ = Math.max(-box.halfDepth, Math.min(box.halfDepth, localZ));
  return Math.hypot(localX - nearestX, localZ - nearestZ) < disc.radius - 1e-6;
}

export function stepPlanarVelocity(
  current: PointXZ,
  desiredDirection: PointXZ,
  maxSpeed: number,
  acceleration: number,
  deceleration: number,
  seconds: number,
): PointXZ {
  if (!Number.isFinite(seconds) || seconds <= 0) return { ...current };
  const desiredLength = Math.hypot(desiredDirection.x, desiredDirection.z);
  const targetX = desiredLength > 1e-6 ? (desiredDirection.x / desiredLength) * maxSpeed : 0;
  const targetZ = desiredLength > 1e-6 ? (desiredDirection.z / desiredLength) * maxSpeed : 0;
  const dx = targetX - current.x;
  const dz = targetZ - current.z;
  const distance = Math.hypot(dx, dz);
  const maxChange = Math.max(0, desiredLength > 1e-6 ? acceleration : deceleration) * seconds;
  if (distance <= maxChange || distance <= 1e-6) return { x: targetX, z: targetZ };
  return { x: current.x + (dx / distance) * maxChange, z: current.z + (dz / distance) * maxChange };
}

function overlaps(x: number, z: number, radius: number, obstacles: readonly Disc[]): boolean {
  return obstacles.some((obstacle) => (
    Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.radius - 1e-6
  ));
}

function penetration(x: number, z: number, radius: number, obstacles: readonly Disc[]): number {
  return obstacles.reduce((total, obstacle) => (
    total + Math.max(0, radius + obstacle.radius - Math.hypot(x - obstacle.x, z - obstacle.z))
  ), 0);
}

export function resolveDiscStep(
  from: PointXZ,
  to: PointXZ,
  radius: number,
  obstacles: readonly Disc[],
): PointXZ {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const steps = Math.max(1, Math.min(128, Math.ceil(Math.hypot(dx, dz) / Math.max(0.15, radius * 0.45))));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  let x = from.x;
  let z = from.z;
  for (let index = 0; index < steps; index += 1) {
    const nextX = x + stepX;
    const nextZ = z + stepZ;
    const currentPenetration = penetration(x, z, radius, obstacles);
    if (!overlaps(nextX, nextZ, radius, obstacles)
      || penetration(nextX, nextZ, radius, obstacles) < currentPenetration - 1e-6) {
      x = nextX;
      z = nextZ;
      continue;
    }
    if (!overlaps(nextX, z, radius, obstacles)
      || penetration(nextX, z, radius, obstacles) < currentPenetration - 1e-6) x = nextX;
    const afterXPenetration = penetration(x, z, radius, obstacles);
    if (!overlaps(x, nextZ, radius, obstacles)
      || penetration(x, nextZ, radius, obstacles) < afterXPenetration - 1e-6) z = nextZ;
  }
  return { x, z };
}

export function resolvedLocomotionDistance(
  from: PointXZ,
  resolved: PointXZ,
  minimum = 1e-5,
): number {
  const distance = Math.hypot(resolved.x - from.x, resolved.z - from.z);
  return Number.isFinite(distance) && distance > Math.max(0, minimum) ? distance : 0;
}

export function separationVector(left: Disc, right: Disc): PointXZ {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  const distance = Math.hypot(dx, dz);
  const overlap = left.radius + right.radius - distance;
  if (overlap <= 0) return { x: 0, z: 0 };
  if (distance <= 1e-6) return { x: overlap, z: 0 };
  return { x: (dx / distance) * overlap, z: (dz / distance) * overlap };
}

function distanceToSegment(point: PointXZ, start: PointXZ, end: PointXZ): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared <= 1e-9 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

export function canMeleeHit(
  attacker: FacingPoint,
  target: PointXZ,
  range: number,
  halfAngle: number,
  blockers: readonly Disc[] = [],
): boolean {
  const dx = target.x - attacker.x;
  const dz = target.z - attacker.z;
  const distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance) || distance <= 1e-6 || distance > range) return false;
  const facing = (Math.sin(attacker.yaw) * dx + Math.cos(attacker.yaw) * dz) / distance;
  if (facing < Math.cos(halfAngle)) return false;
  return blockers.every((blocker) => distanceToSegment(blocker, attacker, target) >= blocker.radius);
}

export function crossedMeleeHitWindow(
  previousProgress: number,
  progress: number,
  alreadyHit: boolean,
  contactProgress = 0.47,
): boolean {
  if (alreadyHit || ![previousProgress, progress, contactProgress].every(Number.isFinite)) return false;
  if (contactProgress <= 0 || contactProgress > 1) return false;
  return previousProgress < contactProgress && progress >= contactProgress;
}
