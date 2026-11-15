// The props the player sees, as the few simple solids the ducks land on and the pointer hits: each chair its seat and
// its back, the radio its cabinet, a cooler its box, the hourglass its column, a parasol its foot, pole and
// canopy, a lamp its post. Made once, at load, from the placements that draw them (props.js PLACEMENTS, the radio's
// and the hourglass's spots in layout.js), in block-local coordinates. The world gives them to its floating things to
// collide with (collide) and tests its pick ray against them (ray), so what is drawn is what a duck lands on and what a
// click hits. A solid with use (a seat, the radio, the hourglass, a cooler) is a thing to click; the rest only block.
import { A } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { PLACEMENTS } from './props.js';

// ----- each model's solids in its own units (sizes read off its mesh: tools ran over public/props/*.bin) -----
const box = (lo, hi) => ({ type: 'box', c: lo.map((v, k) => (v + hi[k]) / 2), u: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], h: lo.map((v, k) => (hi[k] - v) / 2) });
const cyl = (r, y0, y1) => ({ type: 'cyl', r, y0, y1 });
/** A sloping slab from (x0, y0) to (x1, y1) in the model's xy plane, t thick and 2 hz wide: a reclining chair's back. */
const slab = ([x0, y0], [x1, y1], t, hz) => {
  const l = Math.hypot(x1 - x0, y1 - y0), a = [(x1 - x0) / l, (y1 - y0) / l, 0];
  return { type: 'box', c: [(x0 + x1) / 2, (y0 + y1) / 2, 0], u: [a, [-a[1], a[0], 0], [0, 0, 1]], h: [l / 2, t / 2, hz] };
};
/** A canopy: the line from its peak (0, peak) to its rim (rim, y) turned round the pole, t thick. */
const canopy = (peak, rim, y, t) => ({ type: 'cone', peak, rim, y, t });
const MODEL = {
  chair: [box([-0.24, 0, -0.2], [0.17, 0.28, 0.2]), slab([0.07, 0.28], [0.26, 0.57], 0.05, 0.2)],   // the back leans away over +x
  radio: [box([-0.205, 0, -0.073], [0.205, 0.26, 0.073])],   // ponytail: its handle (a wire arch over the top) is left out, so a duck let go on it sits on the cabinet rather than balancing on the wire and toppling off
  cooler: [box([-0.17, 0, -0.096], [0.17, 0.206, 0.096])],   // with its lid shut
  parasol: [cyl(0.145, 0, 0.083), cyl(0.03, 0, 0.79), canopy(1.155, 0.5, 0.78, 0.04)],
  lantern: [cyl(0.06, 0, 0.73)],
  torch: [cyl(0.045, 0, 1.04)],
};

/** Every solid in block-local coordinates: { type, use?, ... } with its xz box (lo, hi) for a quick test first. */
export const SOLIDS = (() => {
  const out = [];
  const place = (M, scale, shapes, use) => {
    const at = A.apply(M, [0, 0, 0]);
    for (const s of shapes) {
      let w;
      if (s.type === 'box') {
        const c = A.apply(M, s.c), u = s.u.map((e) => { const p = A.apply(M, s.c.map((v, k) => v + e[k])); return p.map((v, k) => (v - c[k]) / scale); });
        const h = s.h.map((v) => v * scale), ex = [0, 2].map((k) => u.reduce((sum, e, i) => sum + Math.abs(e[k]) * h[i], 0));
        w = { type: 'box', c, u, h, lo: [c[0] - ex[0], c[2] - ex[1]], hi: [c[0] + ex[0], c[2] + ex[1]] };
      } else {
        const r = (s.type === 'cyl' ? s.r : s.rim) * scale;
        w = s.type === 'cyl' ? { type: 'cyl', x: at[0], z: at[2], r, y0: at[1] + s.y0 * scale, y1: at[1] + s.y1 * scale }
          : { type: 'cone', x: at[0], z: at[2], r, peak: at[1] + s.peak * scale, y: at[1] + s.y * scale, t: s.t * scale };
        w.lo = [at[0] - r, at[2] - r]; w.hi = [at[0] + r, at[2] + r];
      }
      if (use) w.use = use;
      out.push(w);
    }
  };
  for (const p of PLACEMENTS) {
    const shapes = MODEL[p.model];
    if (!shapes || (!p.at && p.follow !== 'radio')) continue;
    if (p.follow === 'radio') { place(A.mul(A.t(P.RADIO[0], P.TER, P.RADIO[1]), A.ry(0.4)), 1, shapes, { kind: 'radio' }); continue; }   // as props.js poses it, at rest
    const seat = p.model === 'chair' ? P.SEATS.findIndex((s) => s.at[0] === p.at[0] && s.at[1] === p.at[2]) : -1;
    const use = seat >= 0 ? { kind: 'seat', seat } : p.model === 'cooler' ? { kind: 'cooler', cooler: p.coolerIndex } : null;
    place(A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale)), p.scale, shapes, use);
  }
  // the hourglass (scene.js draws it, P.SIZE.glass times scenery.js's): its two round plates, the posts and the glass between
  const G = P.SIZE.glass;
  place(A.t(P.HOURGLASS[0], P.TER, P.HOURGLASS[1]), G, [cyl(0.13, 0, 0.5)], { kind: 'glass' });
  return out;
})();

const nb = [0, 0, 0], tl = [0, 0, 0];
/** How deep a sphere (centre x, y, z, radius r) is in solid s, its outward normal into n; 0 when clear. */
function penetrate(s, x, y, z, r, n) {
  if (s.type === 'box') {
    const dx = x - s.c[0], dy = y - s.c[1], dz = z - s.c[2];
    let out = 0, inMin = Infinity, inI = 0, inS = 1;
    n[0] = n[1] = n[2] = 0;
    for (let i = 0; i < 3; i++) {
      const e = s.u[i], p = dx * e[0] + dy * e[1] + dz * e[2], h = s.h[i], q = p > h ? p - h : p < -h ? p + h : 0;
      tl[i] = q; out += q * q;
      const room = h - Math.abs(p);
      if (room < inMin) { inMin = room; inI = i; inS = p < 0 ? -1 : 1; }
    }
    if (out > 0) {   // the centre outside: from the box's nearest point
      const d = Math.sqrt(out);
      if (d >= r) return 0;
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) n[k] += (s.u[i][k] * tl[i]) / d;
      return r - d;
    }
    for (let k = 0; k < 3; k++) n[k] = s.u[inI][k] * inS;   // the centre inside: out through the nearest face
    return r + inMin;
  }
  const rx = x - s.x, rz = z - s.z, rho = Math.hypot(rx, rz), ux = rho > 1e-9 ? rx / rho : 1, uz = rho > 1e-9 ? rz / rho : 0;
  let dr, dy, R;
  if (s.type === 'cyl') {
    if (rho - r >= s.r || y + r <= s.y0 || y - r >= s.y1) return 0;
    if (rho <= s.r && y >= s.y0 && y <= s.y1) {   // the centre inside: out through the nearest of side, top and bottom
      const side = s.r - rho, top = s.y1 - y, bottom = y - s.y0, m = Math.min(side, top, bottom);
      if (m === top) { n[0] = 0; n[1] = 1; n[2] = 0; } else if (m === bottom) { n[0] = 0; n[1] = -1; n[2] = 0; } else { n[0] = ux; n[1] = 0; n[2] = uz; }
      return r + m;
    }
    dr = rho - Math.min(rho, s.r); dy = y - Math.min(Math.max(y, s.y0), s.y1); R = r;
  } else {   // the canopy: from the nearest point of its turned line
    const ex = s.r, ey = s.y - s.peak, t = Math.min(1, Math.max(0, (rho * ex + (y - s.peak) * ey) / (ex * ex + ey * ey)));
    dr = rho - ex * t; dy = y - s.peak - ey * t; R = r + s.t / 2;
  }
  const d = Math.hypot(dr, dy);
  if (d >= R) return 0;
  if (d < 1e-9) { n[0] = 0; n[1] = 1; n[2] = 0; return R; }
  n[0] = (dr / d) * ux; n[1] = dy / d; n[2] = (dr / d) * uz;
  return R - d;
}

// A coarse grid over the island (CELL a side, out to EDGE from the middle): each cell lists the solids within REACH of it,
// so a sphere tests only those near it; most of the ground has none. A bigger sphere (none floats) tests them all.
const CELL = 1, EDGE = 10, REACH = 0.6, CELLS = Math.ceil((2 * EDGE) / CELL);
const GRID = Array.from({ length: CELLS * CELLS }, (_, c) => {
  const x0 = -EDGE + (c % CELLS) * CELL, z0 = -EDGE + Math.floor(c / CELLS) * CELL;
  return SOLIDS.filter((s) => s.lo[0] - REACH < x0 + CELL && s.hi[0] + REACH > x0 && s.lo[1] - REACH < z0 + CELL && s.hi[1] + REACH > z0);
});
const NONE = [];
const near = (x, z, r) => {
  if (r > REACH) return SOLIDS;
  const i = Math.floor((x + EDGE) / CELL), j = Math.floor((z + EDGE) / CELL);
  return i < 0 || j < 0 || i >= CELLS || j >= CELLS ? NONE : GRID[j * CELLS + i];
};

/** The deepest any solid goes into a sphere (centre x, y, z, radius r), its outward normal into n: the floating things'
 * collide (floaters.js). */
export function collide(x, y, z, r, n) {
  let best = 0;
  for (const s of near(x, z, r)) {
    if (x + r < s.lo[0] || x - r > s.hi[0] || z + r < s.lo[1] || z - r > s.hi[1]) continue;
    const pen = penetrate(s, x, y, z, r, nb);
    if (pen > best) { best = pen; n[0] = nb[0]; n[1] = nb[1]; n[2] = nb[2]; }
  }
  return best;
}

/** How far along the ray (o, unit d) it enters solid s, or -1 (a canopy is hit as the round slab it spans). */
function enter(s, o, d) {
  let t0 = 0, t1 = Infinity;
  if (s.type === 'box') {
    for (let i = 0; i < 3; i++) {
      const e = s.u[i], p = (o[0] - s.c[0]) * e[0] + (o[1] - s.c[1]) * e[1] + (o[2] - s.c[2]) * e[2], v = d[0] * e[0] + d[1] * e[1] + d[2] * e[2];
      if (Math.abs(v) < 1e-12) { if (Math.abs(p) > s.h[i]) return -1; continue; }
      let a = (-s.h[i] - p) / v, b = (s.h[i] - p) / v;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return -1;
    }
    return t0 > 0 ? t0 : -1;
  }
  const y0 = s.type === 'cyl' ? s.y0 : s.y, y1 = s.type === 'cyl' ? s.y1 : s.peak;
  const ox = o[0] - s.x, oz = o[2] - s.z, a = d[0] * d[0] + d[2] * d[2], b = ox * d[0] + oz * d[2], c = ox * ox + oz * oz - s.r * s.r;
  if (a > 1e-12) { const q = b * b - a * c; if (q < 0) return -1; const sq = Math.sqrt(q); t0 = (-b - sq) / a; t1 = (-b + sq) / a; }
  else if (c > 0) return -1;
  else t0 = -Infinity;
  if (Math.abs(d[1]) > 1e-12) { let a2 = (y0 - o[1]) / d[1], b2 = (y1 - o[1]) / d[1]; if (a2 > b2) [a2, b2] = [b2, a2]; t0 = Math.max(t0, a2); t1 = Math.min(t1, b2); }
  else if (o[1] < y0 || o[1] > y1) return -1;
  return t0 <= t1 && t0 > 0 ? t0 : -1;
}

/** The nearest solid the ray (o, unit d) enters: { t, use } (use: the thing to click, or undefined for scenery that only
 * blocks), or null. skip(use): a solid not to be hit (the seat sat in). */
export function ray(o, d, skip = () => false) {
  let best = null;
  for (const s of SOLIDS) {
    if (s.use && skip(s.use)) continue;
    const t = enter(s, o, d);
    if (t > 0 && (!best || t < best.t)) best = { t, use: s.use };
  }
  return best;
}
