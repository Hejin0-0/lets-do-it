// Pool Jelly — the layout, after the user's plan: a walled courtyard (a covered colonnade along the back, a wall
// with round windows down the left, open on the right) paved in pale stone. In the middle, a rectangular pool
// with a half-round end of steps at the back; wavy planters down both sides; below the pool a step down to a
// lawn with a round pool, the two joined by a water slide; a radio and an inflatable by the pool, a big
// hourglass on the stone at the front right; a beach with palms outside the courtyard at the front. The ducks
// circle the big pool, go down the slide into the round one, are drawn down its drain and ride a clear tube
// back up over the lawn into the big pool; new ducks drop into the middle of the big pool. Block-local: y up, |x|, |z| <= HALF, the front face at z = +HALF; (x, z).
import { makeRoute } from '@lid/diorama/vessel.js';
import { POOL_KIT, bowlHeight } from './map-kit.js';

export const P = (() => {
  // K: the courtyard's plan was drawn on a block 2.6 from its middle to its edge, and is made K times wider and
  // deeper. The ducks keep their size (about 0.21 long), so the big pool is some two dozen ducks long; the things
  // people would use (chairs, floats, palms, walls) are sized as for people (H: a unit is about two metres).
  const K = 2, k = (v) => v * K, kp = ([x, y, z]) => [x * K, y, z * K], H = 0.5;
  const HALF = k(2.6), GN = 260, GDX = (2 * HALF) / GN, TILT_MAX = 0.15, G = 9.8;   // a water cell 0.04 across
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  // levels: the stone terrace, the colonnade's floor, the lawn, the beach; the two pools' water; the bodies; the open
  // sea, a step below the beach (a shore, the terrace about a metre over the water)
  const TER = 1.32, PORCH = 1.4, LAWN = 1.14, BEACH = 1.1, LU = 1.27, LL = 1.09, UP = 0, LO = 1, SEA = 0.75;
  const DECK = TER;
  // the courtyard's front edge (the beach beyond), the colonnade's front, the walls' inner faces
  const FRONT = k(1.8), COLS = k(-2.05), WALL_L = k(-2.5), WALL_B = k(-2.5);
  // the big pool: a rectangle, a half-round head of steps at the back; the rim round it (stone, wide enough to sit on)
  const MAIN = [-1.4, -1.3, 1.4, 0.45].map(k), HEAD = [0.05, -1.3, 0.5].map(k), RIM = 0.14;
  // the round pool on the lawn; the lawn; the slide's mouth (a notch in the big pool's front wall)
  const ROUND = [-0.43, 1.13, 0.46].map(k), LAWN_R = [...[-2.45, 0.45, 1.73].map(k), FRONT], MOUTH = [0.55, 0.4].map(k);
  const POOL = { at: [(MAIN[0]+MAIN[2])/2, TER-POOL_KIT.rim*.5, (MAIN[1]+MAIN[3])/2],
    scale: [(MAIN[2]-MAIN[0])/POOL_KIT.inner[0], .5, (MAIN[3]-MAIN[1])/POOL_KIT.inner[1]] };
  const poolFloor = POOL.at[1] + POOL_KIT.floor * POOL.scale[1];
  /** The slide, from the notch in the big pool's front wall down onto the round pool (x, y, z). */
  const SLIDE = [[0.55, LU - 0.01, 0.34], [0.55, 1.258, 0.53], [0.62, 1.257, 0.7], [0.6, 1.256, 0.9], [0.42, 1.255, 1.05], [0.18, 1.254, 1.13], [0.04, 1.252, 1.13], [-0.04, LL + 0.012, 1.13]].map(kp);
  /** The tube back up: from the round pool's drain, under its rim, up out of the lawn, over the step and the big
   * pool's left rim, its mouth over the water (control points; the path is a smooth curve through them). */
  const PUMP = { at:[ROUND[0]-.35,ROUND[1]], mouth:LL+.32, crest:LAWN+1.65 };
  const TUBE = [[PUMP.at[0],PUMP.mouth,PUMP.at[1]], [PUMP.at[0],LAWN+1.05,PUMP.at[1]],
    [PUMP.at[0]-.12,PUMP.crest,PUMP.at[1]-.15],[-1.9,PUMP.crest-.08,1.70],
    [-2.7,TER+.85,.85],[-2.8,TER+.40,.25],[-2.5,TER+.30,-.05],[-2.04,LU+.22,-.2]];
  const TUBE_R = 0.17;   // the ducks are about 0.21 long and 0.17 tall
  /** How much bigger than the shapes in scenery.js the things people use are drawn (and picked). */
  const SIZE = { chair: 6, radio: 3.2, glass: 2, palm: 4, towel: 5, parasol: 5, fountain: 2.5, ladder: 3.5 };
  /** Where new ducks drop in: above the middle of the big pool. */
  const DROP = [(MAIN[0] + MAIN[2]) / 2, LU + 0.8, (MAIN[1] + MAIN[3]) / 2];
  /** The fountain at the big pool's head (a toy lost in the round pool comes back out of it), and where it lands. */
  const SPOUT = [HEAD[0], TER + 0.5, MAIN[1] - 0.25], LANDING = [HEAD[0], k(-0.75)];
  const HOURGLASS = [2.13, 1.36].map(k), RADIO = [1.62, -1.15].map(k);
  /** The big swan float: it starts on the stone at the courtyard's right, creeps a hop at a time toward the big
   * pool (into: the point it heads for) and in the end leaps in. A ring wide enough to hold ducks. */
  const SWAN = { at: [2.25, 0.35].map(k), into: [0.9, 0.2].map(k), R: 0.45, r: 0.108 };   // past the planter's end, clear of the lawn's edge and the hourglass
  const TOWELS = [[-2.3,3.2,.3,'#2a8ad8'],[1.3,3,-.2,'#e8405a'],[.9,4.6,.4,'#f2c62a'],[-.6,4.3,-.3,'#3ab89a']];
  /** The two deck chairs you can sit in: one on the stone looking over the big pool, one on the lawn looking out
   * over the round pool and the beach to the sea. at: the chair (x, z) on the ground at y; look: what you see from it;
   * eye: just behind and above the chair, as you would sit. The chair faces its look. */
  const SEATS = [
    { id: 'pool', label: 'Pool chair', at: [1.68, -0.55].map(k), y: TER, look: kp([0.1, LU - 0.05, -0.5]) },
    { id: 'sea', label: 'Sea chair', at: [-1.95, 0.9].map(k), y: LAWN, look: kp([-1.6, 0.75, 3.8]) },
  ].map((s) => {
    const dx = s.look[0] - s.at[0], dz = s.look[2] - s.at[1], l = Math.hypot(dx, dz);
    return { ...s, yaw: Math.atan2(dz / l, -dx / l), eye: [s.at[0] - (dx / l) * 0.45, s.y + 0.75, s.at[1] - (dz / l) * 0.45] };
  });

  function segDist(x, z, a, b) {
    const ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
  }
  const rect = ([x0, z0, x1, z1], r = 0) => (x, z) => {
    const dx = Math.max(x0 + r - x, x - x1 + r), dz = Math.max(z0 + r - z, z - z1 + r);
    return (dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz)) - r;
  };
  const innerRect=rect([-3.7,-2.2,3.7,2.2],.35);
  const mainRect = (x,z) => innerRect((x-POOL.at[0])/POOL.scale[0],(z-POOL.at[2])/POOL.scale[2])*Math.min(POOL.scale[0],POOL.scale[2]), lawnD = rect(LAWN_R);
  /** Signed distances (negative inside): the big pool (with its notch), the round pool. */
  const mainD = mainRect;
  const notch = (x, z) => Math.abs(x - MOUTH[0]) < 0.14 && z > MAIN[3] - 0.02 && z < MAIN[3] + 0.30;
  const roundD = (x, z) => Math.hypot(x - ROUND[0], z - ROUND[1]) - ROUND[2];
  /** The wavy planters down either side (side -1 left, 1 right), from z PLANTER[0] to PLANTER[1]: their inner edges swing in and out. */
  const PLANTER = [k(-1.9), k(-0.25)];   // ending short of the front, so the stone there is wide enough for the swan
  const planterEdge = (side, z) => (side < 0 ? k(-1.85 + 0.13 * Math.sin((z / K) * 3.6 + 0.4)) : k(1.95 + 0.13 * Math.sin((z / K) * 3.6 + 1.9)));
  const planterL = (x, z) => z > PLANTER[0] && z < PLANTER[1] && x < planterEdge(-1, z);
  const planterR = (x, z) => z > PLANTER[0] && z < PLANTER[1] && x > planterEdge(1, z);

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
    if (mainD(x, z) < 0) {   // same floor and three entry steps as the fitted Blender basin
      const px = (x-POOL.at[0])/POOL.scale[0], py = -(z-POOL.at[2])/POOL.scale[2];
      for (const [y,h] of POOL_KIT.steps) if (Math.abs(px-POOL_KIT.stepX)<POOL_KIT.stepWidth/2 && Math.abs(py-y)<POOL_KIT.stepDepth/2)
        return poolFloor+h*POOL.scale[1];
      return poolFloor;
    }
    if (notch(x, z)) return LU - 0.125;   // below the flume's visible floor at the slide port
    if (mainD(x, z) < RIM) return TER;   // the big pool's rim, holding its water up above the lawn
    if (roundD(x, z) < 0) return bowlHeight(Math.hypot(x-ROUND[0],z-ROUND[1]));
    if (z < COLS) return z < -2.5 ? PORCH : PORCH;   // the colonnade's floor
    if (z < COLS + 0.2 && x < k(-1.3)) return z < COLS + 0.1 ? TER + 0.053 : TER + 0.027;   // steps down from it at the left
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
    const cope = d > -0.005 ? 1 - ss(0.0, RIM, d) : 0;
    const grass = (planterL(x, z) || planterR(x, z) || (lawnD(x, z) < 0 && roundD(x, z) > 0.03 && mainD(x, z) > 0.03)) && z < FRONT ? 1 : 0;
    return [cope, grass, z > FRONT ? 1 : 0];
  }

  // ----- the current: round the big pool (past the slide's mouth), a swirl in the round one; a grid looked up for speed -----
  const loop = makeRoute([[-0.95, -0.85], [0.95, -0.85], [0.95, 0.12], [-0.97, 0.12], [-0.95, -0.85]].map((p) => p.map(k)));
  const LOOP_MID = [k(0), k(-0.365)], LOOP_HALF = [k(0.95), k(0.485)];   // the loop's middle and half its size   // the curve overshoots its corners: kept in from the rims
  const CN = 168, CD = (2 * HALF) / CN, CUR = new Float32Array(CN * CN * 2);
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
      const [tx, tz, d] = along(loop, x, z), f = 0.5 + 0.5 * Math.max(0, 1 - d / k(0.45));
      v = [tx * f, tz * f];
      // inside the loop the flow either side of its middle runs opposite ways: a still line where a duck can sit for
      // a minute; there it drifts out toward the loop instead
      const ox = x - LOOP_MID[0], oz = z - LOOP_MID[1], ol = Math.hypot(ox, oz) || 1, out = 0.12 * clamp((d - k(0.32)) / k(0.12), 0, 1);
      if (Math.abs(ox) < LOOP_HALF[0] && Math.abs(oz) < LOOP_HALF[1]) { v[0] += (ox / ol) * out; v[1] += (oz / ol) * out; }
    } else if (roundD(x, z) < 0.05) {
      const dx = x - ROUND[0], dz = z - ROUND[1], r = Math.hypot(dx, dz) || 1, sw = 0.5 + 0.4 * Math.min(1, r / k(0.3)), inw = 0.45;
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
  /** A polyline through 3D as a path: { len, pts, at(s) -> [x, y, z] } by arc length. */
  function path3(pts) {
    const s = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(...pts[i].map((v, k) => v - pts[i - 1][k])));
    return {
      len: s[s.length - 1], pts,
      at(q) {
        q = clamp(q, 0, s[s.length - 1]);
        let i = 1; while (i < s.length - 1 && s[i] < q) i++;
        const t = (q - s[i - 1]) / (s[i] - s[i - 1] || 1);
        return pts[i - 1].map((v, k) => v + (pts[i][k] - v) * t);
      },
    };
  }
  /** Catmull-Rom through control points, n samples between each pair. */
  function smooth(c, n) {
    const out = [];
    for (let i = 0; i + 1 < c.length; i++) {
      const a = c[Math.max(0, i - 1)], b = c[i], d = c[i + 1], e = c[Math.min(c.length - 1, i + 2)];
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        out.push(b.map((_, k) => 0.5 * (2 * b[k] + (d[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * d[k] - e[k]) * t2 + (3 * b[k] - a[k] - 3 * d[k] + e[k]) * t3)));
      }
    }
    out.push(c[c.length - 1].slice());
    return out;
  }
  const slide = path3(SLIDE), tube = path3(smooth(TUBE, 8));

  return { K, H, HALF, GN, GDX, TILT_MAX, G, TER, DECK, PORCH, LAWN, BEACH, LU, LL, UP, LO, SEA, FRONT, COLS, WALL_L, WALL_B, MAIN, HEAD, RIM, ROUND, LAWN_R, MOUTH, SLIDE, TUBE, TUBE_R, PUMP, TOWELS, SIZE, DROP, SPOUT, LANDING, POOL, poolFloor,
    HOURGLASS, RADIO, SWAN, SEATS, PLANTER, loop, slide, tube, terrainH, terrainNormal, regionSeed, zones, current, mainD, roundD, inMain, planterEdge, planterL, planterR, lawnD,
    clamp, ss, mix, rng, hash2, vnoise, segDist };
})();
