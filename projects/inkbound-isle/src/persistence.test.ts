import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInitialGameState } from './gameplay.ts';
import { parseSave, SAVE_VERSION, serializeSave, type SaveSnapshot } from './persistence.ts';

const fixture = (): SaveSnapshot => ({
  version: SAVE_VERSION,
  savedAt: 123_456,
  state: {
    ...createInitialGameState(),
    inventory: { wood: 4, stone: 3, fiber: 2, berries: 1 },
    crafted: { axe: true, spear: false, torch: true },
    selectedTool: 'torch',
    structuresPlaced: 1,
  },
  player: { x: 4, y: 2, z: -8, yaw: 0.4, pitch: -0.1 },
  structures: [{ id: 'stable-campfire-1', type: 'campfire', x: 2, y: 1, z: -3, rotation: 1.57 }],
  creatures: [{
    id: 'parasaur-1',
    species: 'parasaur',
    health: 80,
    tamed: true,
    dead: false,
    trust: 3,
    command: 'stay',
    x: 5,
    y: 1,
    z: 6,
  }],
});

describe('versioned local expedition save', () => {
  it('round-trips an allowed snapshot without changing its values', () => {
    const snapshot = fixture();
    assert.deepEqual(parseSave(serializeSave(snapshot)), snapshot);
  });

  it('migrates id-less v1 structures to deterministic stable ids', () => {
    const legacy = fixture() as unknown as Record<string, unknown>;
    legacy.version = 1;
    legacy.structures = [{ type: 'campfire', x: 2, y: 1, z: -3, rotation: 1.57 }];

    const first = parseSave(JSON.stringify(legacy));
    const second = parseSave(JSON.stringify(legacy));
    assert.equal(first?.version, SAVE_VERSION);
    assert.equal(first?.structures[0]?.id, second?.structures[0]?.id);
    assert.match(first?.structures[0]?.id ?? '', /^legacy-structure-/);
  });

  it('rejects corrupt, oversized, or future save data', () => {
    assert.equal(parseSave('{broken'), null);
    assert.equal(parseSave(JSON.stringify({ ...fixture(), version: SAVE_VERSION + 1 })), null);
    assert.equal(parseSave('x'.repeat(100_001)), null);
  });

  it('rejects non-finite coordinates and unknown structure types', () => {
    const unknownBuild = {
      ...fixture(),
      structures: [{ id: 'invalid-build-1', type: 'castle', x: 0, y: 0, z: 0, rotation: 0 }],
    };
    assert.equal(parseSave(JSON.stringify(unknownBuild)), null);

    const invalidPosition = fixture();
    invalidPosition.player.x = 900;
    assert.equal(parseSave(JSON.stringify(invalidPosition)), null);
  });
});
