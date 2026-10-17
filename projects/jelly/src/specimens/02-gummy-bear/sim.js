// 02's body: a gummy bear sitting up, legs out in front, paws on its tummy. One signed distance field
// (smooth unions, so every part blends without seams); createSdfBody makes the surface, lattice and solver.
import { createSdfBody, ell, cap, smin, smax } from '../../core/jelly/sdfbody.js';

export const BEAR = { H: 1.52, eye: [0.15, 1.15, 0.31] };

/** The bear, sitting on y = 0, facing +z. Mirror-symmetric in x. */
export function bearSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = ell(x, y, z, 0, 0.5, -0.02, 0.42, 0.5, 0.36);                              // body
  d = smin(d, ell(x, y, z, 0, 0.32, 0.04, 0.46, 0.33, 0.38), 0.12);                  // the sitting bottom, a little wider
  d = smin(d, ell(x, y, z, 0, 0.47, 0.17, 0.3, 0.32, 0.2), 0.1);                     // a round tummy
  d = smin(d, ell(x, y, z, 0, 1.08, 0.0, 0.42, 0.37, 0.36), 0.16);                   // head
  d = smin(d, ell(x, y, z, 0, 0.98, 0.29, 0.19, 0.14, 0.13), 0.07);                  // muzzle
  d = smin(d, ell(x, y, z, 0, 1.04, 0.41, 0.075, 0.055, 0.05), 0.03);                // nose
  d = smin(d, Math.hypot(ax - 0.3, y - 1.37, z + 0.02) - 0.13, 0.08);                // ears
  d = smax(d, -(Math.hypot(ax - 0.31, y - 1.38, z - 0.1) - 0.065), 0.04);            // their hollows
  d = smin(d, cap(ax, y, z, 0.33, 0.72, 0.04, 0.38, 0.42, 0.27, 0.115), 0.09);      // arms, paws on the tummy
  d = smin(d, cap(ax, y, z, 0.22, 0.2, 0.08, 0.28, 0.13, 0.52, 0.15), 0.1);         // thighs, out in front
  d = smin(d, ell(ax, y, z, 0.29, 0.17, 0.6, 0.14, 0.16, 0.11), 0.06);               // feet, soles forward
  const [ex, ey, ez] = BEAR.eye;
  d = smax(d, -(Math.hypot(ax - ex, y - ey, z - ez) - 0.056), 0.03);                 // eyes, pressed in
  return smax(d, -y, 0.03);                                                          // sitting flat
}

export const BearSim = {
  DT: 1 / 120,
  create(opt = {}) {
    return createSdfBody({
      tapSeed: opt.tapSeed,
      sdf: bearSdf, bounds: [-0.66, 0, -0.46, 0.66, 1.56, 0.8], surfBounds: [-0.6831, -0.0517, -0.48217, 0.68, 1.58, 0.82],   // ponytail: grid offset chosen so the small eye and ear hollows mesh cleanly (the test checks)
      h: 0.12, surfH: 0.024, density: 1.25, unitCm: 1.5, alpha0: 0.02, upY: 0.7, drop: 0.25,
      flex: (x, y, z) => 1.2 * Math.min(1, Math.max(0, (z - 0.3) / 0.2)) + 0.8 * Math.min(1, Math.max(0, (Math.abs(x) - 0.3) / 0.12)),   // feet and arms give first
      bubbles: { count: 16, depth: 0.06, rMin: 0.006, rMax: 0.022 },
    });
  },
};
