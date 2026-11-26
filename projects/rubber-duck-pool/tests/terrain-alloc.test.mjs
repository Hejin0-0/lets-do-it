import test from 'node:test';
import assert from 'node:assert/strict';
import { P } from '../src/pool/layout.js';
import { POOL_KIT } from '../src/pool/map-kit.js';
import { garbage } from './garbage.mjs';

// V8 (Node v22.22.3, batch 20) lands on three plateaus from when TurboFan finishes terrainH against
// notch, planterL, and planterR: 6,841.2 / 7,161.2 / 7,801.2 B/batch after vs 11,321.2 / 11,641.2 /
// 12,281.2 B/batch before (indexing POOL_KIT.steps saves 4,480 B/batch on each).
// 9,000 B leaves 1,198.8 B (+15.4%) above the worst after plateau (7,801.2) and 2,321.2 B (-20.5%)
// below the best before plateau (11,321.2).
const LIMIT = 9000;
// 50,000 batches (~90 ms unthrottled) outlast delayed concurrent compilation (--concurrent-recompilation-delay=50).
const WARMUP = 50000;

// Keep this test in its own file so prior worlds or lookups do not alter V8 JIT state.
test('terrainH lookup batch across pool steps, floor, and terrace stays under allocation budget', (t) => {
  const pts = [];
  const sx = P.POOL.at[0] + POOL_KIT.stepX * P.POOL.scale[0];
  for (let s = 0; s < POOL_KIT.steps.length; s++) {
    const sz = P.POOL.at[2] - POOL_KIT.steps[s][0] * P.POOL.scale[2];
    for (let i = 0; i < 20; i++) {
      pts.push([sx + ((i % 5) - 2) * 0.05, sz + (Math.floor(i / 5) - 1.5) * 0.02]);
    }
  }
  for (let i = 0; i < 20; i++) {
    pts.push([P.POOL.at[0] + ((i % 5) - 2) * 0.3, P.POOL.at[2] + (Math.floor(i / 5) - 1.5) * 0.2]);
  }
  for (let i = 0; i < 20; i++) {
    pts.push([3.3 + (i % 5) * 0.15, -0.4 + Math.floor(i / 5) * 0.25]);
  }
  assert.equal(pts.length, 100);

  const batch = () => {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) sum += P.terrainH(pts[i][0], pts[i][1]);
    return sum;
  };
  for (let i = 0; i < WARMUP; i++) batch();
  const samples = Array.from({ length: 7 }, () => garbage(batch, 20));
  const median = samples.slice().sort((a, b) => a - b)[3];
  t.diagnostic(`P.terrainH 100-point batch median: ${median.toFixed(1)} B/batch (samples: ${samples.map((v) => v.toFixed(0)).join(', ')}; limit: ${LIMIT} B; warmup ${WARMUP}, batch 20)`);
  assert.ok(median < LIMIT, `${median.toFixed(1)} B/batch >= ${LIMIT} B/batch`);
});
