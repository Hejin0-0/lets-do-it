import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';
import { PLACEMENTS, PROP_FLOATS, poseProps, setMural } from '../src/pool/props.js';

test('mural selection shows exactly one wall and preserves its placement on return', () => {
  const world = createWorld({ seed: 14, ducks: 0, arrivals: false });
  const buf = new Float32Array(PLACEMENTS.length * PROP_FLOATS);
  const matrix = name => {
    const i = PLACEMENTS.findIndex(p => p.model === name) * PROP_FLOATS;
    return Array.from(buf.subarray(i, i + 12));
  };
  const hidden = m => m.every(v => v === 0);
  poseProps(buf, 0, world);
  const cartoon = matrix('mural');
  assert.ok(!hidden(cartoon));
  assert.ok(hidden(matrix('art_wall')));
  assert.equal(setMural(world, 'artwall'), 'artwall');
  poseProps(buf, 0, world);
  assert.ok(hidden(matrix('mural')));
  assert.ok(!hidden(matrix('art_wall')));
  assert.ok(buf.every(Number.isFinite));
  assert.throws(() => setMural(world, 'unknown'), RangeError);
  assert.equal(world.mural, 'artwall');
  setMural(world, 'cartoon');
  poseProps(buf, 0, world);
  assert.deepEqual(matrix('mural'), cartoon);
  assert.ok(hidden(matrix('art_wall')));
});
