import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COOLER_SHAPES } from '../src/pool/cooler-shapes.js';
import { createCoolerState } from '../src/pool/cooler-state.js';
import { COOLER_SITES } from '../src/pool/cooler-sites.js';
import { createWorld } from '../src/pool/world.js';
import { PLACEMENTS, PROP_FLOATS, poseProps } from '../src/pool/props.js';

test('cooler parts contain the body and a separate lid', () => {
  const { vertices, indices, models } = COOLER_SHAPES;
  assert.ok(models.cooler.vertices > 0 && models.cooler_lid.vertices > 0);
  assert.equal(readFileSync(new URL('../public/props/resort-cooler.bin', import.meta.url)).byteLength, vertices * 40 + indices * 4);
});

test('each cooler opens and closes independently', () => {
  const state = createCoolerState(3);
  assert.deepEqual(state.open, [false, false, false]);
  state.toggle(1);
  assert.deepEqual(state.open, [false, true, false]);
  state.toggle(1);
  assert.deepEqual(state.open, [false, false, false]);
});

test('a ray hitting a cooler identifies its lid and opening changes only that lid pose', () => {
  const world = createWorld({ seed: 14 });
  const s = COOLER_SITES[2];
  const hit = world.pick([s.at[0],s.at[1]+1,s.at[2]], [0,-1,0]);
  assert.equal(hit.kind, 'cooler');
  assert.equal(hit.cooler, 2);
  const before = new Float32Array(PLACEMENTS.length * PROP_FLOATS);
  const after = new Float32Array(before.length);
  poseProps(before,0,world);
  world.coolers.toggle(hit.cooler);
  poseProps(after,0,world);
  const lid = PLACEMENTS.findIndex(p => p.model === 'cooler_lid' && p.coolerIndex === 2);
  const other = PLACEMENTS.findIndex(p => p.model === 'cooler_lid' && p.coolerIndex === 1);
  assert.notDeepEqual(after.slice(lid*16,lid*16+12), before.slice(lid*16,lid*16+12));
  assert.deepEqual(after.slice(other*16,other*16+12), before.slice(other*16,other*16+12));
});
