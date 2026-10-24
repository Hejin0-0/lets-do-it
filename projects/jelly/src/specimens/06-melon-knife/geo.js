// The melon wedge: a sector with its apex C = (0, ZC) pointing up the slice (+z) and the rind arc
// toward -z (ZC puts the sector's centroid at the origin). Every corner is rounded like the slice,
// a cut rounds the whole piece again, and the knife leaves a thin kerf. Black teardrop seeds sit in
// three arcs; a few tiny bubbles keep clear of them.
import { createSliceKernel } from '../../core/cut/kernel.js';
import { SEED_LEN } from '../../core/jelly/seeds.js';

const PI = Math.PI;
export const T = 0.58;               // slab thickness (y)
export const HALF = 32 * PI / 180;   // half-angle of the sector
export const R = 1.78;               // outer radius (skin); the flesh reaches 1.62
export const ZC = 2 * R * Math.sin(HALF) / (3 * HALF);
export const SKIN = 0.06, PALE = 0.1;
const RIND = SKIN + PALE;
const CORNER = 0.17;                 // in-plane rounding radius of every corner (rho)
const ANCHOR = 0.04;                 // a seed rides on three embedded points: centre, along, across

export function createMelon() {
  const WEDGE = (() => {
    const Rp = R - CORNER, sn = Math.sin(HALF), cs = Math.cos(HALF);
    const apex = [0, ZC - CORNER / sn];                        // the two inner edges meet here
    // the right inner edge runs from apex along (sn, -cs) to the circle of radius Rp about C
    const od = (CORNER / sn) * cs, oo = (CORNER / sn) ** 2;    // o = apex - C: o.d and |o|^2
    const t = -od + Math.sqrt(od * od - oo + Rp * Rp);
    const q1 = [sn * t, apex[1] - cs * t];
    return { Rp, apex, q1, sn, cs, a1: Math.atan2(q1[1] - ZC, q1[0]) };
  })();
  let segDist2;
  function sliceSdf(x, z) {
    const W = WEDGE, ax = Math.abs(x), wz = z - ZC, len = Math.hypot(ax, wz);   // mirror-symmetric in x
    const dArc = Math.atan2(wz, ax) <= W.a1 ? Math.abs(len - W.Rp) : Math.hypot(ax - W.q1[0], z - W.q1[1]);
    const dEdge = Math.sqrt(segDist2(ax, z, W.apex[0], W.apex[1], W.q1[0], W.q1[1]));
    const inside = len <= W.Rp && W.cs * ax + W.sn * (z - W.apex[1]) <= 0;
    const d = Math.min(dArc, dEdge);
    return (inside ? -d : d) - CORNER;
  }

  const K = createSliceKernel({
    T, ROUND: CORNER, MIN_AREA: 0.06, BEVEL: 0.13, FILLET_RINGS: 6, NEAR: Infinity, KERF: 0.01, sliceSdf,
    GRID: Object.freeze({ h: 0.025, X0: -1.1, Z0: -0.8, NX: 88, NZ: 80, N: 88 * 80 }),
    inclusions: (field) => ({ seeds: pickSeeds(field), bubbles: pickBubbles(field) }),
  });
  const { sample, mulberry32 } = K;
  segDist2 = K.segDist2;
  {   // the analytic field passes through the construction's landmarks
    const near0 = (v, m) => { if (Math.abs(v) > 1e-6) throw new Error('sliceSdf: ' + m + ' ' + v); };
    near0(sliceSdf(0, ZC - R), 'arc midpoint');
    near0(sliceSdf(0, WEDGE.apex[1] + CORNER), 'rounded tip');
  }

  // Seeds: centre (3), long axis toward the tip (3), flat axis (3), scale (1).
  const SEEDS = (() => {
    const rnd = mulberry32(0x5EED5), out = [];
    const arc = (r, n, spread, layer0) => {
      for (let i = 0; i < n; i++) {
        const th = -PI / 2 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread) + (rnd() - 0.5) * 0.04, rr = r + (rnd() - 0.5) * 0.05;
        const c = [rr * Math.cos(th), [T - 0.11, T / 2, 0.11][(layer0 + i) % 3] + (rnd() - 0.5) * 0.03, ZC + rr * Math.sin(th)];
        const yaw = (rnd() - 0.5) * 0.35, ax = [-Math.cos(th + yaw), (rnd() - 0.5) * 0.12, -Math.sin(th + yaw)];
        const al = Math.hypot(...ax); ax[0] /= al; ax[1] /= al; ax[2] /= al;
        const ay = [-ax[0] * ax[1], 1 - ax[1] * ax[1], -ax[2] * ax[1]], yl = Math.hypot(...ay);   // up, minus its part along ax
        const sc = 1.25 + rnd() * 0.25;
        if (sliceSdf(c[0], c[2]) < -(SEED_LEN * sc / 2 + 0.06)) out.push(...c, ...ax, ay[0] / yl, ay[1] / yl, ay[2] / yl, sc);
      }
    };
    arc(0.86, 3, 0.3, 0); arc(1.12, 5, 0.36, 1); arc(1.36, 6, 0.4, 2);
    return Float32Array.from(out);
  })();
  function pickSeeds(field) {
    const out = [];
    for (let i = 0; i < SEEDS.length; i += 10) {
      const half = SEED_LEN * SEEDS[i + 9] / 2;
      const tip = [SEEDS[i] + SEEDS[i + 3] * half, SEEDS[i + 2] + SEEDS[i + 5] * half], tail = [SEEDS[i] - SEEDS[i + 3] * half, SEEDS[i + 2] - SEEDS[i + 5] * half];
      if (sample(field, tip[0], tip[1]) < -0.04 && sample(field, tail[0], tail[1]) < -0.04 && sample(field, SEEDS[i], SEEDS[i + 2]) < -0.05)
        for (let k = 0; k < 10; k++) out.push(SEEDS[i + k]);
    }
    return Float32Array.from(out);
  }

  // A few tiny air bubbles in the flesh (x y z r), clear of the seeds.
  const BUBBLES = (() => {
    const rnd = mulberry32(0xB0BB1E), out = [];
    for (let tries = 0; out.length < 4 * 14 && tries < 5000; tries++) {
      const r = 0.35 + (R - RIND - 0.55) * rnd(), th = -PI / 2 + (rnd() - 0.5) * 2 * (HALF - 0.1), y = 0.1 + (T - 0.2) * rnd(), rad = 0.006 + 0.01 * rnd() * rnd();
      const x = r * Math.cos(th), z = ZC + r * Math.sin(th);
      if (sliceSdf(x, z) > -(rad + 0.1)) continue;
      let clear = true;
      for (let i = 0; i < SEEDS.length && clear; i += 10) if (Math.hypot(SEEDS[i] - x, SEEDS[i + 1] - y, SEEDS[i + 2] - z) < 0.13) clear = false;
      if (clear) out.push(x, y, z, rad);
    }
    return Float32Array.from(out);
  })();
  function pickBubbles(field) {
    const out = [];
    for (let i = 0; i < BUBBLES.length; i += 4)
      if (sample(field, BUBBLES[i], BUBBLES[i + 2]) < -(BUBBLES[i + 3] + 0.03)) out.push(BUBBLES[i], BUBBLES[i + 1], BUBBLES[i + 2], BUBBLES[i + 3]);
    return Float32Array.from(out);
  }

  return K;
}

/** Seeds ride on three anchors each (instance: scale, tint), then the bubbles (instance: radius). */
export function melonChannels(mesh) {
  const sd = mesh.seeds, ns = sd.length / 10, sp = new Float32Array(9 * ns), si = new Float32Array(4 * ns);
  for (let i = 0; i < ns; i++) {
    const q = 10 * i, o = 9 * i;
    for (let k = 0; k < 3; k++) { sp[o + k] = sd[q + k]; sp[o + 3 + k] = sd[q + k] + sd[q + 3 + k] * ANCHOR; sp[o + 6 + k] = sd[q + k] - sd[q + 6 + k] * ANCHOR; }
    si[4 * i] = sd[q + 9]; si[4 * i + 1] = (Math.abs(Math.sin(sd[q] * 91.7 + sd[q + 2] * 37.3)) * 0.999) % 1;
  }
  const b = mesh.bubbles, nb = b.length / 4, bp = new Float32Array(nb * 3), bi = new Float32Array(nb * 4);
  for (let i = 0; i < nb; i++) { bp.set(b.subarray(4 * i, 4 * i + 3), 3 * i); bi[4 * i] = b[4 * i + 3]; }
  return [{ key: 'seeds', pts: sp, inst: si }, { key: 'bubbles', pts: bp, inst: bi }];
}
