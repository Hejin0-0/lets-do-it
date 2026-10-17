// Pool Jelly — the layout, after the user's plan: a walled courtyard (a covered colonnade along the back, a wall
// with round windows down the left, open on the right) paved in pale stone. In the middle, a rectangular pool
// with a half-round end of steps at the back; wavy planters down both sides; below the pool a step down to a
// lawn with a round pool, the two joined by a water slide; a radio and an inflatable by the pool, a big
// hourglass on the stone at the front right; a beach with palms outside the courtyard at the front. The ducks
// circle the big pool, go down the slide into the round one, are drawn down its drain and pop out of the
// fountain at the big pool's head. Block-local: y up, |x|, |z| <= HALF, the front face at z = +HALF; (x, z).
import { makeRoute } from '@lid/diorama/vessel.js';

export const P = (() => {
  const HALF = 2.6, GN = 168, GDX = (2 * HALF) / GN, TILT_MAX = 0.15, G = 9.8;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  // levels: the stone terrace, the colonnade's floor, the lawn, the beach; the two pools' water; the bodies
  const TER = 1.32, PORCH = 1.4, LAWN = 1.14, BEACH = 1.1, LU = 1.27, LL = 1.09, UP = 0, LO = 1;
  const DECK = TER;
  // the courtyard's front edge (the beach beyond), the colonnade's front, the walls' inner faces
  const FRONT = 1.8, COLS = -2.05, WALL_L = -2.5, WALL_B = -2.5;
  // the big pool: a rectangle, a half-round head of steps at the back
  const MAIN = [-0.87, -1.13, 0.95, 0.41], HEAD = [0.04, -1.13, 0.42];
  // the round pool on the lawn; the lawn; the slide's mouth (a notch in the big pool's front wall)
  const ROUND = [-0.43, 1.11, 0.46], LAWN_R = [-2.45, 0.41, 1.73, FRONT], MOUTH = [0.55, 0.36];
  /** The slide, from the notch in the big pool's front wall down onto the round pool (x, y, z). */
  const SLIDE = [[0.55, LU - 0.01, 0.3], [0.55, LU - 0.012, 0.47], [0.62, 1.245, 0.66], [0.6, 1.205, 0.86], [0.42, 1.16, 1.03], [0.18, 1.125, 1.12], [-0.04, LL + 0.012, 1.12]];
  /** The fountain at the big pool's head the ducks come back out of, and where they land. */
  const SPOUT = [HEAD[0], TER + 0.22, HEAD[1] - HEAD[2] - 0.12], LANDING = [HEAD[0], -0.75];
  const HOURGLASS = [2.13, 1.36], RADIO = [1.12, -0.72], FLOAT_AT = [1.5, 0.15];

  function segDist(x, z, a, b) {
    const ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
  }
  const rect = ([x0, z0, x1, z1], r = 0) => (x, z) => {
    const dx = Math.max(x0 + r - x, x - x1 + r), dz = Math.max(z0 + r - z, z - z1 + r);
    return (dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz)) - r;
  };
  const mainRect = rect(MAIN, 0.06), lawnD = rect(LAWN_R);
  /** Signed distances (negative inside): the big pool (with its notch), the round pool. */
  const mainD = (x, z) => Math.min(mainRect(x, z), z < HEAD[1] + 0.01 ? Math.hypot(x - HEAD[0], z - HEAD[1]) - HEAD[2] : Infinity);
  const notch = (x, z) => Math.abs(x - MOUTH[0]) < 0.075 && z > MAIN[3] - 0.02 && z < MAIN[3] + 0.09;
  const roundD = (x, z) => Math.hypot(x - ROUND[0], z - ROUND[1]) - ROUND[2];
  /** The wavy planters down either side: their inner edges swing in and out. */
  const planterL = (x, z) => z > -1.9 && z < 0.05 && x < -1.55 + 0.13 * Math.sin(z * 3.6 + 0.4);
  const planterR = (x, z) => z > -1.9 && z < 0.05 && x > 1.72 + 0.13 * Math.sin(z * 3.6 + 1.9);

  function hash2(i, j) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z) {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ----- the ground -----
  function terrainH(x, z) {
    if (z > FRONT) return BEACH + 0.03 * vnoise(x * 1.6 + 2, z * 1.6) + 0.02 * ss(FRONT + 0.4, HALF, z);   // the beach outside, above the round pool's water
    if (mainD(x, z) < 0) {   // the big pool: deep in the middle, the head a flight of steps up toward the fountain
      if (z < HEAD[1]) { const r = Math.hypot(x - HEAD[0], z - HEAD[1]) / HEAD[2]; return LU - 0.1 * (1 + Math.floor((1 - r) * 3)) - 0.02; }
      return LU - 0.33 + 0.08 * ss(-1.1, 0.4, z);
    }
    if (notch(x, z)) return LU - 0.035;   // the slide's mouth
    if (mainD(x, z) < 0.07) return TER;   // the big pool's rim, holding its water up above the lawn
    if (roundD(x, z) < 0) return LL - 0.19;   // the round pool: a shallow tub
    if (z < COLS) return z < -2.5 ? PORCH : PORCH;   // the colonnade's floor
    if (z < COLS + 0.2 && x < -1.3) return z < COLS + 0.1 ? TER + 0.053 : TER + 0.027;   // steps down from it at the left
    if (planterL(x, z) || planterR(x, z)) return TER + 0.08;   // the planters' soil
    if (lawnD(x, z) < 0) return LAWN;   // the lawn, a step down from the stone
    return TER;
  }
  function terrainNormal(x, z, out = [0, 0, 0]) {
    const e = 0.012, nx = -(terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), nz = -(terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const l = Math.hypot(nx, 1, nz);
    out[0] = nx / l; out[1] = 1 / l; out[2] = nz / l;
    return out;
  }
  const inMain = (x, z) => mainD(x, z) < 0 || notch(x, z);
  /** Which body a wet cell belongs to. */
  const regionSeed = (x, z, t) => (inMain(x, z) && t < LU - 0.012 ? UP : LO);   // all else the round pool's body: it lies below the lawn and the beach, so they stay dry
  /** The ground's zones for its shading: [the coping round the pools, the planters' and the lawn's grass, the beach]. */
  function zones(x, z) {
    const d = Math.min(inMain(x, z) ? -1 : mainD(x, z), roundD(x, z));
    const cope = d > -0.005 ? 1 - ss(0.0, 0.05, d) : 0;
    const grass = (planterL(x, z) || planterR(x, z) || (lawnD(x, z) < 0 && roundD(x, z) > 0.03 && mainD(x, z) > 0.03)) && z < FRONT ? 1 : 0;
    return [cope, grass, z > FRONT ? 1 : 0];
  }

  // ----- the current: round the big pool (past the slide's mouth), a swirl in the round one; a grid looked up for speed -----
  const loop = makeRoute([[-0.5, -0.82], [0.6, -0.82], [0.62, 0.12], [-0.52, 0.14], [-0.5, -0.82]]);
  const CN = 84, CD = (2 * HALF) / CN, CUR = new Float32Array(CN * CN * 2);
  function along(L, x, z) {
    let best = Infinity, ti = 0;
    for (let i = 0; i + 1 < L.pts.length; i++) { const d = segDist(x, z, L.pts[i], L.pts[i + 1]); if (d < best) { best = d; ti = i; } }
    const a = L.pts[ti], b = L.pts[ti + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, best];
  }
  for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
    const x = -HALF + (i + 0.5) * CD, z = -HALF + (j + 0.5) * CD, c = 2 * (j * CN + i);
    let v = [0, 0];
    if (mainD(x, z) < 0.05) {
      const [tx, tz, d] = along(loop, x, z), k = 0.5 + 0.5 * Math.max(0, 1 - d / 0.45);
      v = [tx * k, tz * k];
    } else if (roundD(x, z) < 0.05) {
      const dx = x - ROUND[0], dz = z - ROUND[1], r = Math.hypot(dx, dz) || 1, sw = 0.5 + 0.4 * Math.min(1, r / 0.3), inw = 0.45;
      v = [(-dz / r) * sw - (dx / r) * inw, (dx / r) * sw - (dz / r) * inw];   // round and in, to the drain (the rim's swirl no faster than the inflow can turn)
    }
    CUR[c] = v[0]; CUR[c + 1] = v[1];
  }
  /** The current at (x, z) for a speed of 1 (bilinear in the grid). */
  function current(x, z, out) {
    const fx = clamp((x + HALF) / CD - 0.5, 0, CN - 1.001), fz = clamp((z + HALF) / CD - 0.5, 0, CN - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, w = fz - j, at = (a, b, k) => CUR[2 * (b * CN + a) + k];
    for (let k = 0; k < 2; k++) out[k] = (at(i, j, k) * (1 - u) + at(i + 1, j, k) * u) * (1 - w) + (at(i, j + 1, k) * (1 - u) + at(i + 1, j + 1, k) * u) * w;
    return out;
  }
  /** The slide as a path through 3D: { len, at(s) -> [x, y, z] }. */
  const slide = (() => {
    const s = [0];
    for (let i = 1; i < SLIDE.length; i++) s.push(s[i - 1] + Math.hypot(...SLIDE[i].map((v, k) => v - SLIDE[i - 1][k])));
    return {
      len: s[s.length - 1], pts: SLIDE,
      at(q) {
        q = clamp(q, 0, s[s.length - 1]);
        let i = 1; while (i < s.length - 1 && s[i] < q) i++;
        const t = (q - s[i - 1]) / (s[i] - s[i - 1] || 1);
        return SLIDE[i - 1].map((v, k) => v + (SLIDE[i][k] - v) * t);
      },
    };
  })();

  return { HALF, GN, GDX, TILT_MAX, G, TER, DECK, PORCH, LAWN, BEACH, LU, LL, UP, LO, FRONT, COLS, WALL_L, WALL_B, MAIN, HEAD, ROUND, LAWN_R, MOUTH, SLIDE, SPOUT, LANDING,
    HOURGLASS, RADIO, FLOAT_AT, loop, slide, terrainH, terrainNormal, regionSeed, zones, current, mainD, roundD, inMain, planterL, planterR, lawnD,
    clamp, ss, mix, rng, hash2, vnoise, segDist };
})();
