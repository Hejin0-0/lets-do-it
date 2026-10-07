import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyCanonicalWorldEvent,
  canonicalWorldEvents,
  CANONICAL_WORLD_LIMITS,
  createWelcomeMessage,
  createRateLimiter,
  isAllowedOrigin,
  RELAY_MESSAGE_LIMIT,
  sanitizeName,
  validatedState,
  validatedWorldEvent,
} from './server-protocol.mjs';

describe('multiplayer trust boundary', () => {
  it('rejects incomplete and non-finite player snapshots', () => {
    const current = { name: 'Scout-123' };
    assert.equal(validatedState('p1', current, { x: 0, y: 1, z: 2 }), null);
    assert.equal(validatedState('p1', current, { x: Infinity, y: 1, z: 2, yaw: 0 }), null);
  });

  it('clamps position, rotation, and unrecognized hotbar slots', () => {
    const snapshot = validatedState(
      'p1',
      { name: 'Scout-123' },
      { x: 900, y: -50, z: -900, yaw: 99, slot: '<script>' },
    );
    assert.deepEqual(snapshot, {
      id: 'p1', name: 'Scout-123', x: 70, y: -10, z: -70,
      yaw: Math.PI * 4, slot: 'hands',
    });
  });

  it('removes control characters and caps display names', () => {
    assert.equal(sanitizeName('<b>Scout_123</b>'), 'bScout123b');
    assert.equal(sanitizeName('A'.repeat(30)).length, 18);
    assert.equal(sanitizeName('%%%'), 'Scout');
  });

  it('rejects movement beyond the server velocity envelope', () => {
    const current = { name: 'Scout-123', x: 0, y: 1, z: 0 };
    assert.equal(validatedState(
      'p1',
      current,
      { x: 20, y: 1, z: 0, yaw: 0, slot: 'hands' },
      2,
    ), null);
  });

  it('allows only same-host browser origins and bounds message rate', () => {
    assert.equal(isAllowedOrigin('http://localhost:4173', 'localhost:4174'), true);
    assert.equal(isAllowedOrigin('https://192.168.1.20:4173', '192.168.1.20:4174'), true);
    assert.equal(isAllowedOrigin('https://evil.example', 'localhost:4174'), false);
    assert.equal(isAllowedOrigin('not a url', 'localhost:4174'), false);

    const allow = createRateLimiter(2, 1_000);
    assert.equal(allow(0), true);
    assert.equal(allow(1), true);
    assert.equal(allow(2), false);
    assert.equal(allow(1_001), true);
  });

  it('whitelists bounded gather, build, and creature session events', () => {
    assert.deepEqual(validatedWorldEvent({
      kind: 'gather', nodeId: 'wood-2', remaining: 1,
    }), { kind: 'gather', nodeId: 'wood-2', remaining: 1 });
    assert.deepEqual(validatedWorldEvent({
      kind: 'build',
      action: 'place',
      structureId: 'p1-structure-2',
      buildType: 'campfire',
      x: 2,
      y: 1,
      z: -4,
      rotation: 1.57,
    }), {
      kind: 'build',
      action: 'place',
      structureId: 'p1-structure-2',
      buildType: 'campfire',
      x: 2,
      y: 1,
      z: -4,
      rotation: 1.57,
    });
    assert.deepEqual(validatedWorldEvent({
      kind: 'creature',
      creatureId: 'rex-1',
      health: 226,
      dead: false,
      tamed: false,
      trust: 0,
    }), {
      kind: 'creature',
      creatureId: 'rex-1',
      health: 226,
      dead: false,
      tamed: false,
      trust: 0,
    });
    assert.equal(validatedWorldEvent({ kind: 'gather', nodeId: '<script>', remaining: 1 }), null);
    assert.equal(validatedWorldEvent({ kind: 'build', action: 'place', structureId: 'x', buildType: 'castle', x: 0, y: 0, z: 0, rotation: 0 }), null);
  });

  it('bounds more than 112 canonical builds and emits a receivable recent welcome', () => {
    const world = { resources: new Map(), structures: new Map(), creatures: new Map() };
    for (let index = 0; index < 140; index += 1) {
      applyCanonicalWorldEvent(world, {
        kind: 'build',
        action: 'place',
        structureId: `structure-${String(index).padStart(3, '0')}-${'x'.repeat(20)}`,
        buildType: index % 3 === 0 ? 'campfire' : index % 2 === 0 ? 'wall' : 'foundation',
        x: index % 60,
        y: 1,
        z: -(index % 60),
        rotation: (index % 4) * (Math.PI / 2),
      });
    }

    assert.equal(world.structures.size, CANONICAL_WORLD_LIMITS.structures);
    assert.equal(world.structures.has(`structure-000-${'x'.repeat(20)}`), false);
    assert.equal(world.structures.has(`structure-139-${'x'.repeat(20)}`), true);

    const players = Array.from({ length: 23 }, (_, index) => ({
      id: `player-${index}`,
      name: `Scout-${String(index).padStart(3, '0')}`,
      x: index,
      y: 2,
      z: -index,
      yaw: 0,
      slot: 'hands',
    }));
    const welcome = createWelcomeMessage('new-player', players, canonicalWorldEvents(world));
    const encoded = JSON.stringify(welcome);
    const buildIds = welcome.worldEvents
      .filter((event) => event.kind === 'build')
      .map((event) => event.structureId);

    assert.ok(encoded.length <= RELAY_MESSAGE_LIMIT, `welcome length: ${encoded.length}`);
    assert.ok(buildIds.includes(`structure-139-${'x'.repeat(20)}`));
    assert.equal(buildIds.includes(`structure-000-${'x'.repeat(20)}`), false);
  });
});
