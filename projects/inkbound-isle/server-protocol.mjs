const validSlots = new Set(['hands', 'axe', 'spear', 'torch', 'foundation', 'wall', 'campfire']);
const validBuilds = new Set(['foundation', 'wall', 'campfire']);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const safeId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value);

export const RELAY_MESSAGE_LIMIT = 16_000;
export const CANONICAL_WORLD_LIMITS = Object.freeze({
  resources: 64,
  structures: 96,
  creatures: 32,
});

function upsertRecent(map, key, event, limit) {
  map.delete(key);
  map.set(key, event);
  while (map.size > limit) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

export function applyCanonicalWorldEvent(world, event) {
  if (event.kind === 'gather') {
    upsertRecent(world.resources, event.nodeId, event, CANONICAL_WORLD_LIMITS.resources);
  } else if (event.kind === 'creature') {
    upsertRecent(world.creatures, event.creatureId, event, CANONICAL_WORLD_LIMITS.creatures);
  } else if (event.action === 'remove') {
    world.structures.delete(event.structureId);
  } else {
    upsertRecent(world.structures, event.structureId, event, CANONICAL_WORLD_LIMITS.structures);
  }
}

export function canonicalWorldEvents(world) {
  return [
    ...world.resources.values(),
    ...world.structures.values(),
    ...world.creatures.values(),
  ];
}

export function createWelcomeMessage(id, players, worldEvents, limit = RELAY_MESSAGE_LIMIT) {
  const safePlayers = [...players];
  const safeWorldEvents = [...worldEvents];
  const message = { type: 'welcome', id, players: safePlayers, worldEvents: safeWorldEvents };
  while (JSON.stringify(message).length > limit && safeWorldEvents.length > 0) {
    const oldestBuild = safeWorldEvents.findIndex((event) => event.kind === 'build');
    safeWorldEvents.splice(oldestBuild >= 0 ? oldestBuild : 0, 1);
  }
  while (JSON.stringify(message).length > limit && safePlayers.length > 0) safePlayers.shift();
  return message;
}

export function sanitizeName(value) {
  if (typeof value !== 'string') return 'Scout';
  return value.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 18) || 'Scout';
}

export function validatedState(id, current, message, maxDistance = Infinity) {
  if (!current || !message || typeof message !== 'object') return null;
  const numbers = ['x', 'y', 'z', 'yaw'];
  if (!numbers.every((key) => Number.isFinite(message[key]))) return null;
  if (Number.isFinite(maxDistance)
    && Number.isFinite(current.x)
    && Number.isFinite(current.y)
    && Number.isFinite(current.z)
    && Math.hypot(message.x - current.x, message.y - current.y, message.z - current.z) > maxDistance) return null;
  return {
    id,
    name: current.name,
    x: clamp(message.x, -70, 70),
    y: clamp(message.y, -10, 40),
    z: clamp(message.z, -70, 70),
    yaw: clamp(message.yaw, -Math.PI * 4, Math.PI * 4),
    slot: validSlots.has(message.slot) ? message.slot : 'hands',
  };
}

export function isAllowedOrigin(origin, requestHost) {
  if (typeof origin !== 'string' || typeof requestHost !== 'string') return false;
  try {
    const source = new URL(origin);
    const target = new URL(`http://${requestHost}`);
    return (source.protocol === 'http:' || source.protocol === 'https:') && source.hostname === target.hostname;
  } catch {
    return false;
  }
}

export function createRateLimiter(maxMessages = 45, windowMs = 1_000) {
  let windowStart = 0;
  let count = 0;
  return (now) => {
    if (!Number.isFinite(now)) return false;
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= maxMessages;
  };
}

export function validatedWorldEvent(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.kind === 'gather') {
    if (!safeId(value.nodeId) || !Number.isInteger(value.remaining) || value.remaining < 0 || value.remaining > 20) return null;
    return { kind: 'gather', nodeId: value.nodeId, remaining: value.remaining };
  }
  if (value.kind === 'build') {
    if (!safeId(value.structureId) || !['place', 'remove'].includes(value.action)) return null;
    if (value.action === 'remove') return { kind: 'build', action: 'remove', structureId: value.structureId };
    if (!validBuilds.has(value.buildType)
      || ![value.x, value.y, value.z, value.rotation].every(Number.isFinite)
      || Math.abs(value.x) > 70
      || value.y < -10
      || value.y > 40
      || Math.abs(value.z) > 70
      || Math.abs(value.rotation) > Math.PI * 8) return null;
    return {
      kind: 'build',
      action: 'place',
      structureId: value.structureId,
      buildType: value.buildType,
      x: value.x,
      y: value.y,
      z: value.z,
      rotation: value.rotation,
    };
  }
  if (value.kind === 'creature') {
    if (!safeId(value.creatureId)
      || !Number.isFinite(value.health)
      || value.health < 0
      || value.health > 500
      || typeof value.dead !== 'boolean'
      || typeof value.tamed !== 'boolean'
      || !Number.isInteger(value.trust)
      || value.trust < 0
      || value.trust > 3) return null;
    return {
      kind: 'creature',
      creatureId: value.creatureId,
      health: value.health,
      dead: value.dead,
      tamed: value.tamed,
      trust: value.trust,
    };
  }
  return null;
}
