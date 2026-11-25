import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';
import { garbage } from './garbage.mjs';

// One world in this file, as in world-alloc.test.mjs: worlds made before it in the same process change what V8 keeps optimized.

test('the floating things at noon leave the collector under 16 KB a step', (t) => {
  const W = createWorld({ ducks: 3, arrivals: false });
  W.setHour(12);
  W.setDayRun(false);
  W.step(600);
  const samples = Array.from({ length: 7 }, () => garbage(() => W.floaters.step(1 / 240), 20));
  const median = [...samples].sort((a, b) => a - b)[3];
  t.diagnostic(`floaters.step(1/240): ${median.toFixed(1)} B a step (samples ${samples.map((v) => v.toFixed(0)).join(', ')}; ${W.floaters.bodies.length} bodies, ${W.floaters.bodies.filter((b) => b.sleep).length} asleep)`);
  assert.ok(median < 16 * 1024, `${median.toFixed(1)} B a step, over 16,384`);
});
