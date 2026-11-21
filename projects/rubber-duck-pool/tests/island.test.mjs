import test from 'node:test';
import assert from 'node:assert/strict';
import { isleH, isleCover } from '../src/pool/island.js';
import { P } from '../src/pool/layout.js';

// At e >= 0.05 outside the courtyard, edgeH averages 16 samples across 2w = 1.2 * ss(0, 0.1, e) >= 0.60,
// bounding the largest courtyard edge step (TER - BEACH = 0.22 at P.FRONT) to ~0.22 / 16 = 0.0138
// (measured courtyard peak 0.01297 at e = 0.05; 0.02 gives ~54% margin). The front-left outer bank
// (x = -5.2, z = 4.8) drops toward the sea at 0.01527 and gets its own 0.025 bound (~64% margin).
const STEP = 0.02;
const MAX_STEP_DIFF = 0.02;
const MAX_BANK_DIFF = 0.025;
// On isleMesh's 0.1 grid rows (e = 0.1, 0.2) outside the sea-facing front-left bank (x <= -4.4, z >= 4.7),
// edgeH keeps the courtyard edge gentle enough that isleCover paints 0 rock (tolerance 0.005).
const GRID = 0.1;
const MAX_EDGE_ROCK = 0.005;
const round4 = (v) => Math.round(v * 1e4) / 1e4;

function maxDiffAlong(x0, z0, dx, dz, count) {
  let worst = 0;
  let prev = isleH(x0, z0);
  for (let i = 1; i <= count; i++) {
    const cur = isleH(x0 + dx * i, z0 + dz * i);
    worst = Math.max(worst, Math.abs(cur - prev));
    prev = cur;
  }
  return worst;
}

test('isleCover paints no rock on the first mesh rows outside the courtyard', () => {
  const H = P.HALF;
  const n = Math.round(H / GRID);
  for (const e of [0.1, 0.2]) {
    for (let i = -n; i <= n; i++) {
      const t = i * GRID;
      for (const [rx, rz] of [[-(H + e), t], [H + e, t], [t, -(H + e)], [t, H + e]]) {
        const x = round4(rx), z = round4(rz);
        if (x <= -4.4 + 1e-6 && z >= 4.7 - 1e-6) continue;
        const rock = isleCover(x, z)[2];
        assert.ok(rock <= MAX_EDGE_ROCK, `(${x}, ${z}) e=${e}: rock weight ${rock.toFixed(4)} > ${MAX_EDGE_ROCK}`);
      }
    }
  }
});

test('isleH is smooth across the courtyard edge and step transitions', () => {
  const H = P.HALF;
  for (const e of [0.05, 0.1, 0.2]) {
    const count = Math.round(9.6 / STEP);
    for (const s of [-1, 1]) {
      const alongX = maxDiffAlong(s * (H + e), -4.8, 0, STEP, count);
      assert.ok(alongX <= MAX_STEP_DIFF, `x=${(s * (H + e)).toFixed(2)}: max diff ${alongX.toFixed(5)} > ${MAX_STEP_DIFF}`);
      const alongZ = maxDiffAlong(-4.8, s * (H + e), STEP, 0, count);
      assert.ok(alongZ <= MAX_STEP_DIFF, `z=${(s * (H + e)).toFixed(2)}: max diff ${alongZ.toFixed(5)} > ${MAX_STEP_DIFF}`);
    }
  }

  for (const zStep of [-3.8, -0.5, 3.6]) {
    for (const s of [-1, 1]) {
      const diag = maxDiffAlong(s * (H + 0.05), zStep - 0.15, s * 0.01, 0.015, 20);
      assert.ok(diag <= MAX_STEP_DIFF, `diag near (${(s * H).toFixed(1)}, ${zStep}): max diff ${diag.toFixed(5)} > ${MAX_STEP_DIFF}`);
    }
  }

  for (const z of [-4.8, -4.4, -2.5, -1.2, 0.5, 2.5, 4.3, 4.8]) {
    for (const s of [-1, 1]) {
      const cross = maxDiffAlong(s * (H - 0.1), z, s * STEP, 0, 17);
      const limit = s === -1 && z === 4.8 ? MAX_BANK_DIFF : MAX_STEP_DIFF;
      assert.ok(cross <= limit, `cross x=${(s * H).toFixed(1)} at z=${z}: max diff ${cross.toFixed(5)} > ${limit}`);
    }
  }
  for (const x of [-4, -2, 0, 2, 4]) {
    for (const s of [-1, 1]) {
      const cross = maxDiffAlong(x, s * (H - 0.1), 0, s * STEP, 17);
      assert.ok(cross <= MAX_STEP_DIFF, `cross z=${(s * H).toFixed(1)} at x=${x}: max diff ${cross.toFixed(5)} > ${MAX_STEP_DIFF}`);
    }
  }
});
