// 04's body: a custard pudding turned out of its cup onto a plate, caramel on top. One signed distance
// field (a rounded, slightly domed frustum); createSdfBody makes the surface, the lattice and the solver.
// Specks (vanilla seeds, flecks of tea or berry) are scattered through the custard, each riding on one point.
import { createSdfBody, smax, rng } from '../../core/jelly/sdfbody.js';
import { plateGround } from '../../core/jelly/plate.js';

// height, radius at the base and at the top, the rounding of the top edge, the dome of the top
export const PUD = { H: 1.0, Rb: 0.98, Rt: 0.74, round: 0.17, dome: 0.035 };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The pudding, standing on its wide base at y = 0 (the bottom of the cup is now its top). */
export function puddingSdf(x, y, z) {
  const P = PUD, r = Math.sqrt(x * x + z * z), t = clamp01(y / P.H);
  const R = P.Rb + (P.Rt - P.Rb) * t, cs = P.H / Math.hypot(P.H, P.Rb - P.Rt);   // distance to the slanted side
  const top = P.H + P.dome * (1 - Math.min(1, (r / P.Rt) ** 2));
  return smax(smax((r - R) * cs, y - top, P.round), -y, 0.03);
}

export const SPECKS = 120;

export const PuddingSim = {
  DT: 1 / 120,
  create(opt = {}) {
    const rnd = rng(0x5ec5), points = [], inst = [];
    while (points.length < SPECKS) {   // anywhere in the custard, not right at its skin
      const p = [(rnd() - 0.5) * 2.1, rnd() * 1.05, (rnd() - 0.5) * 2.1];
      if (puddingSdf(...p) < -0.05) { points.push(p); inst.push(0.0065 + 0.0075 * rnd(), rnd(), rnd() * Math.PI, 0); }   // size, shade, turn
    }
    const sim = createSdfBody({
      tapSeed: opt.tapSeed,
      sdf: puddingSdf, bounds: [-1.1, 0, -1.1, 1.1, 1.1, 1.1], surfBounds: [-1.12, -0.0517, -1.12, 1.12, 1.12, 1.12],
      h: 0.16, surfH: 0.028, density: 1.08, unitCm: 4, alpha0: 0.03, upY: 0.5, drop: 0.3, reach: 2.0,
      bubbles: { count: 18, depth: 0.05, rMin: 0.006, rMax: 0.02 }, points, ground: plateGround,
    });
    sim.seedCount = SPECKS;
    sim.seedInst = new Float32Array(inst);
    return sim;
  },
};
