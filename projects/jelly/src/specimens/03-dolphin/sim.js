// 03's body: a big two-layer gummy dolphin lying on its belly, poured into a mould in two goes: clear
// blue on top, a cream layer at the bottom. One signed distance field; createSdfBody does the rest.
import { createSdfBody, ell, cap, smin, smax } from '../../core/jelly/sdfbody.js';

// base: how deep the cream layer is; eye: where the eyes sit on the surface (and how big they are)
export const DOLPHIN = { base: 0.07, eye: [0.81, 0.27, 0.218], eyeR: 0.034 };

/** A flat, tapering blade from a to b (a fin): half-width w0 at a, w1 at b, rounded to half-thickness t,
 *  lying in the plane with normal n (unit). */
function blade(x, y, z, a, b, w0, w1, t, n) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
  const h = Math.max(0, Math.min(1, (px * abx + py * aby + pz * abz) / (abx * abx + aby * aby + abz * abz)));
  const qx = px - abx * h, qy = py - aby * h, qz = pz - abz * h, qn = qx * n[0] + qy * n[1] + qz * n[2];
  const vx = qx - n[0] * qn, vy = qy - n[1] * qn, vz = qz - n[2] * qn;
  const u = Math.max(Math.sqrt(vx * vx + vy * vy + vz * vz) - (w0 + (w1 - w0) * h), 0);
  return Math.sqrt(u * u + qn * qn) - t;
}
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
/** smin with a blade, skipped when the point is clearly outside the blade's bounding sphere (it could not
 *  change d): most of the field is far from any fin, and the build samples the field a million times. */
function withBlade(d, k, x, y, z, a, b, w0, w1, t, n) {
  const cx = (a[0] + b[0]) / 2 - x, cy = (a[1] + b[1]) / 2 - y, cz = (a[2] + b[2]) / 2 - z;
  const R = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2) / 2 + Math.max(w0, w1) + t;
  if (Math.sqrt(cx * cx + cy * cy + cz * cz) - R > d + k) return d;
  return smin(d, blade(x, y, z, a, b, w0, w1, t, n), k);
}
// the body: ellipsoids down a centreline, [x, centre height, half-height, half-width]; their bellies dip
// just under the floor, so the cut at y = 0 leaves a flat base
const BODY = [[0.72, 0.245, 0.255, 0.25], [0.42, 0.28, 0.3, 0.31], [0.08, 0.285, 0.305, 0.3], [-0.28, 0.25, 0.265, 0.24], [-0.62, 0.19, 0.2, 0.155], [-0.9, 0.13, 0.13, 0.095], [-1.08, 0.1, 0.09, 0.07]];
const FLIP_N = [norm([0.15, 1, 0.35]), norm([0.15, 1, -0.35])], FLUKE_N = [norm([0.25, 1, 0.1]), norm([0.25, 1, -0.1])];

/** The dolphin, lying on its belly along x (beak toward +x), resting on y = 0. */
export function dolphinSdf(x, y, z) {
  let d = Infinity;
  for (const [cx, cy, ry, rz] of BODY) d = smin(d, ell(x, y, z, cx, cy, 0, 0.3, ry, rz), 0.2);
  d = smin(d, ell(x, y, z, 0.93, 0.255, 0, 0.21, 0.16, 0.17), 0.12);                     // the melon (forehead)
  d = smin(d, cap(x, y, z, 0.98, 0.13, 0, 1.3, 0.1, 0, 0.075), 0.1);                      // the beak
  d = withBlade(d, 0.08, x, y, z, [0.16, 0.42, 0], [-0.2, 0.8, 0], 0.17, 0.025, 0.06, [0, 0, 1]);   // dorsal fin
  const s = z < 0 ? 1 : 0, sz = z < 0 ? -1 : 1;
  d = withBlade(d, 0.1, x, y, z, [0.5, 0.13, 0.24 * sz], [0.14, 0.045, 0.56 * sz], 0.09, 0.035, 0.045, FLIP_N[s]);   // flippers
  d = withBlade(d, 0.06, x, y, z, [-1.06, 0.08, 0.02 * sz], [-1.42, 0.17, 0.37 * sz], 0.1, 0.045, 0.045, FLUKE_N[s]);   // flukes
  d = smax(d, -(Math.sqrt((x - 0.68) ** 2 + (y - 0.53) ** 2 + z * z) - 0.036), 0.024);                       // the blowhole
  const [ex, ey, ez] = DOLPHIN.eye;
  d = smin(d, Math.sqrt((x - ex) ** 2 + (y - ey) ** 2 + (Math.abs(z) - ez + 0.012) ** 2) - DOLPHIN.eyeR, 0.03);   // the moulded eyes
  const az = Math.abs(z);
  d = smax(d, -cap(x, y, az, 1.25, 0.088, 0.058, 1.0, 0.097, 0.1, 0.02), 0.022);        // the line of the mouth
  return smax(d, -y, 0.03);                                                               // poured flat into the mould
}

export const DolphinSim = {
  DT: 1 / 120,
  create(opt = {}) {
    return createSdfBody({
      tapSeed: opt.tapSeed,
      sdf: dolphinSdf, bounds: [-1.52, 0, -0.76, 1.42, 0.9, 0.76], surfBounds: [-1.54, -0.0517, -0.78, 1.44, 0.92, 0.78],
      h: 0.12, surfH: 0.022, density: 1.25, unitCm: 7, alpha0: 0.02, upY: 0.25, drop: 0.3, reach: 2.2,
      // the tail and the fins bend more easily than the body
      flex: (x, y, z) => 2.5 * Math.min(1, Math.max(0, (-0.6 - x) / 0.5)) + 1.5 * Math.min(1, Math.max(0, (y - 0.55) / 0.15)) + 1.5 * Math.min(1, Math.max(0, (Math.abs(z) - 0.32) / 0.12)),
      bubbles: { count: 22, depth: 0.05, rMin: 0.006, rMax: 0.026 },
      landmarks: [[-1.2, 0.1, 0], [1.25, 0.1, 0]],   // tail, beak: the axis it rolls over about
    });
  },
};
