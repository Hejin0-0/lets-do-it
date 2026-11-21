import test from 'node:test';
import assert from 'node:assert/strict';
import { createCritters } from '../src/pool/critters.js';
import { P } from '../src/pool/layout.js';
import { garbage } from './garbage.mjs';

test('noon critters step leaves under 40 KB per step when fireflies are invisible', t => {
  const c = createCritters(P.rng(11));
  const step = () => { c.step(1 / 60, 12); c.events.length = 0; };
  for (let i = 0; i < 1500; i++) step();
  const samples = Array.from({ length: 7 }, () => garbage(step, 20));
  const median = samples.slice().sort((a, b) => a - b)[3];
  const LIMIT = 40 * 1024;
  t.diagnostic(`median ${median.toFixed(1)} B/step (samples ${samples.map(s => s.toFixed(0)).join(', ')}; limit ${LIMIT} B; warmup 1500, batch 20)`);
  assert.ok(median < LIMIT, `noon step allocated ${median.toFixed(1)} B/step (limit ${LIMIT} B/step)`);
});
