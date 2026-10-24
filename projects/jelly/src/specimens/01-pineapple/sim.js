// 01's body: a ring jelly turned out of a fluted mould onto a plate, pineapple pieces set inside it.
// The shape is one signed distance field; createSdfBody makes the surface, the lattice and the solver.
import { createSdfBody, smax, rng, surfaceNets } from '../../core/jelly/sdfbody.js';
import { plateGround } from '../../core/jelly/plate.js';

// height, radius at the base and at the top, the hole at the base and at the top, the flutes, the skirt
export const MOULD = { H: 1.0, Rb: 1.1, Rt: 0.84, hole0: 0.34, hole1: 0.24, lobes: 10, flute: 0.075, skirt: 0.05 };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Round crests, narrow valleys: 1 on a crest, 0 in a valley. */
const lobe = (th) => Math.pow(0.5 + 0.5 * Math.cos(MOULD.lobes * th), 0.45);

/** The mould's shape, resting on its flat base at y = 0. */
export function mouldSdf(x, y, z) {
  const M = MOULD, r = Math.sqrt(x * x + z * z), f = lobe(Math.atan2(z, x)), t = clamp01(y / M.H);
  const Ro = M.Rb + (M.Rt - M.Rb) * Math.pow(t, 1.25) + M.flute * (f - 0.65) + M.skirt * sstep(0.2, 0.12, y);
  const Rh = M.hole0 + (M.hole1 - M.hole0) * t;
  const across = clamp01((r - Rh) / Math.max(0.05, Ro - Rh));   // 0 at the hole, 1 at the outer wall
  // a domed crown; the flutes run on over it as ridges toward the hole
  const top = M.H - 0.16 * (2 * across - 1) ** 2 + 0.05 * (f - 0.65) * sstep(0.15, 0.75, across);
  let d = smax(r - Ro, y - top, 0.24);   // the rounded shoulder
  d = smax(d, Rh - r, 0.1);              // the rolled edge of the hole
  return smax(d, -y, 0.04);              // the flat base
}

// ----- pineapple pieces: tidbits (sectors of a ring slice), in two staggered rings inside the jelly -----
export const TIDBIT = { ri: 0.07, ro: 0.33, half: 0.3, th: 0.05, round: 0.022 };
export const ANCHOR = 0.05;   // a piece rides on three embedded points: centre, along, and across it
const RC = (TIDBIT.ri + TIDBIT.ro) / 2;
function tidbitSdf(x, y, z) {   // local: x along the arc, y through the slice, z out from the core (centred)
  const T = TIDBIT, zz = z + RC, rho = Math.sqrt(x * x + zz * zz), phi = Math.atan2(x, zz);
  const d2 = Math.max(T.ri - rho, rho - T.ro, rho * Math.sin(Math.min(Math.PI / 2, Math.abs(phi) - T.half)));
  const dy = Math.abs(y) - T.th;
  const a = d2 + T.round, b = dy + T.round;
  return Math.min(Math.max(a, b), 0) + Math.hypot(Math.max(a, 0), Math.max(b, 0)) - T.round;
}
/** The tidbit mesh (position + normal), small enough to draw once per piece. */
export function tidbitMesh() {
  const m = surfaceNets(tidbitSdf, [-0.13, -0.075, -0.16, 0.13, 0.075, 0.16], 0.011);
  const vtx = new Float32Array(m.nv * 6);
  for (let v = 0; v < m.nv; v++) vtx.set([m.pos[3 * v], m.pos[3 * v + 1], m.pos[3 * v + 2], m.nrm[3 * v], m.nrm[3 * v + 1], m.nrm[3 * v + 2]], 6 * v);
  return { vtx, index: m.index };
}
function placeTidbits() {
  const rnd = rng(0x9a1e), out = [];
  const ring = (y, r, n, off) => {
    for (let k = 0; k < n; k++) {
      const phi = (k + off) / n * Math.PI * 2 + (rnd() - 0.5) * 0.18;
      let rr = r + (rnd() - 0.5) * 0.06, c;
      for (let tries = 0; tries < 8; tries++, rr -= 0.03) { c = [rr * Math.cos(phi), y + (rnd() - 0.5) * 0.06, rr * Math.sin(phi)]; if (mouldSdf(...c) < -0.19) break; }
      // the narrow end toward the middle of the jelly, tilted a little either way
      const tilt = (rnd() - 0.5) * 0.7, yaw = (rnd() - 0.5) * 0.5, a = phi + yaw;
      const Z = [Math.cos(a), 0, Math.sin(a)], Y = [-Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt)];
      const X = [Y[1] * Z[2] - Y[2] * Z[1], Y[2] * Z[0] - Y[0] * Z[2], Y[0] * Z[1] - Y[1] * Z[0]];   // X = Y x Z, so X x Y = Z
      out.push({ c, X, Y, scale: 0.88 + rnd() * 0.2, tint: rnd() });
    }
  };
  ring(0.3, 0.66, 6, 0); ring(0.62, 0.58, 6, 0.5);
  return out;
}

export const MouldSim = {
  DT: 1 / 120,
  create(opt = {}) {
    const pieces = placeTidbits(), points = [];
    for (const p of pieces) points.push(p.c, p.c.map((v, k) => v + p.X[k] * ANCHOR), p.c.map((v, k) => v - p.Y[k] * ANCHOR));
    const sim = createSdfBody({
      tapSeed: opt.tapSeed,
      sdf: mouldSdf, bounds: [-1.25, 0, -1.25, 1.25, 1.1, 1.25], surfBounds: [-1.27, -0.0517, -1.27, 1.27, 1.12, 1.27],
      h: 0.17, surfH: 0.03, density: 1.04, unitCm: 6, alpha0: 0.016, upY: 0.5, drop: 0.35, reach: 2.0,
      bubbles: { count: 34, depth: 0.06, rMin: 0.006, rMax: 0.034 }, points, ground: plateGround,
    });
    sim.seedCount = pieces.length;
    sim.seedInst = new Float32Array(pieces.flatMap((p) => [p.scale, p.tint, 0, 0]));
    sim.pieces = pieces;
    return sim;
  },
};
