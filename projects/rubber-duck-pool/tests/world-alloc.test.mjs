import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';
import { garbage } from './garbage.mjs';

// One world in this file: with others made before it in the same process, garbage()'s gc() makes V8 drop the tick's
// optimized code ("weak objects") and the tick reads about 110 KB with nothing wrong in it.

test('world tick allocation stays under budget at noon after warmup', (t) => {
  const W = createWorld();
  W.setHour(12);
  W.setDayRun(false);
  W.step(600);
  const samples = Array.from({ length: 7 }, () => garbage(() => W.step(1), 20));
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  t.diagnostic(`W.step(1) median: ${median.toFixed(1)} B/tick (samples: ${samples.map((v) => v.toFixed(0)).join(', ')})`);
  assert.ok(median < 50 * 1024, `${median.toFixed(1)} B/tick exceeded 51200 B/tick`);
});
