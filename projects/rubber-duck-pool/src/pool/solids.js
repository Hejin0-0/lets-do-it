// The props the player sees, as the few simple solids the ducks land on and the pointer hits: each chair its sling (a
// few thin slabs along its curve) and arms, the radio its cabinet, a cooler its box and its lid (shut or open, as the
// world has it), the hourglass its column (turning over with it), a parasol its foot, pole and canopy, a lamp its post.
// The ones that stand still are made once, at load, from the placements that draw them (props.js PLACEMENTS, the
// radio's and the hourglass's spots in layout.js), in block-local coordinates; each world adds the moving ones
// (createSolids). The world gives them to its floating things to collide with and tests its pick ray against them, so
// what is drawn is what a duck lands on and what a click hits. A solid with use (a seat, the radio, the hourglass, a
// cooler) is a thing to click; the rest only block.
import { A } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { PLACEMENTS } from './props.js';
import { LID_OPEN } from './cooler-sites.js';

// ----- each model's solids in its own units (sizes read off its mesh: tools ran over public/props/*.bin) -----
const box = (lo, hi, ground = lo[1] === 0) => ({ type: 'box', c: lo.map((v, k) => (v + hi[k]) / 2), u: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], h: lo.map((v, k) => (hi[k] - v) / 2), ground });
const cyl = (r, y0, y1, ground = y0 === 0) => ({ type: 'cyl', c: [0, (y0 + y1) / 2, 0], u: [0, 1, 0], r, h: (y1 - y0) / 2, ground });
/** A thin slab whose top runs from (x0, y0) to (x1, y1) in the model's xy plane, t thick and 2 hz wide. */
const slab = ([x0, y0], [x1, y1], t, hz) => {
  const l = Math.hypot(x1 - x0, y1 - y0), a = [(x1 - x0) / l, (y1 - y0) / l, 0], n = [-a[1], a[0], 0];
  return { type: 'box', c: [(x0 + x1) / 2 - n[0] * t / 2, (y0 + y1) / 2 - n[1] * t / 2, 0], u: [a, n, [0, 0, 1]], h: [l / 2, t / 2, hz] };
};
/** A canopy: the line from its peak (0, peak) to its rim (rim, y) turned round the pole, t thick. */
const canopy = (peak, rim, y, t) => ({ type: 'cone', peak, rim, y, t });
// a deck chair's sling, sagging at the seat and rising into the back (its top along the middle, read off the mesh)
const SLING = [[-0.27, 0.122], [-0.15, 0.136], [-0.06, 0.174], [0.03, 0.246], [0.12, 0.351], [0.255, 0.55]];
const LID = [-0.161, 0.163, -0.096], LID_HI = [0.161, 0.206, 0.096];
const MODEL = {
  chair: [...SLING.slice(1).map((q, i) => slab(SLING[i], q, 0.04, 0.17)),
    box([-0.21, 0.25, -0.21], [0.15, 0.28, -0.18]), box([-0.21, 0.25, 0.18], [0.15, 0.28, 0.21])],   // the arms
  radio: [box([-0.205, 0, -0.073], [0.205, 0.26, 0.073])],   // ponytail: its handle (a wire arch over the top) is left out, so a duck let go on it sits on the cabinet rather than balancing on the wire and toppling off
  cooler: [box([-0.17, 0, -0.096], [0.17, 0.185, 0.096])],   // its box; the lid is the world's (createSolids)
  parasol: [cyl(0.145, 0, 0.083), cyl(0.03, 0, 0.83), canopy(1.155, 0.5, 0.83, 0.04)],   // its cloth: rim 0.5 out from 0.81 (a short hem) to 0.85, up to the peak
  lantern: [cyl(0.06, 0, 0.73)],
  torch: [cyl(0.045, 0, 1.04)],
};

/** A model's solid s placed by the transform M (uniform scale): in block-local coordinates, with its xz box (lo, hi). */
function place(M, scale, s, use) {
  let w;
  if (s.type === 'cone') {
    const at = A.apply(M, [0, 0, 0]), r = s.rim * scale;
    w = { type: 'cone', x: at[0], z: at[2], r, peak: at[1] + s.peak * scale, y: at[1] + s.y * scale, t: s.t * scale, lo: [at[0] - r, at[2] - r], hi: [at[0] + r, at[2] + r] };
  } else {
    const c = A.apply(M, s.c), axis = (e) => { const p = A.apply(M, s.c.map((v, k) => v + e[k])); return p.map((v, k) => (v - c[k]) / scale); };
    w = s.type === 'box' ? { type: 'box', c, u: s.u.map(axis), h: s.h.map((v) => v * scale) } : { type: 'cyl', c, u: axis(s.u), r: s.r * scale, h: s.h * scale };
    if (s.ground) w.ground = true;
    bound(w);
  }
  if (use) w.use = use;
  return w;
}
/** A box's or a cylinder's xz box (lo, hi) from where it is now. */
function bound(w) {
  let ex0 = 0, ex2 = 0;
  if (w.type === 'box') {
    for (let i = 0; i < w.u.length; i++) {
      ex0 += Math.abs(w.u[i][0]) * w.h[i];
      ex2 += Math.abs(w.u[i][2]) * w.h[i];
    }
  } else {
    const ux = w.u[0], uz = w.u[2];
    ex0 = Math.abs(ux) * w.h + w.r * Math.sqrt(Math.max(0, 1 - ux * ux));
    ex2 = Math.abs(uz) * w.h + w.r * Math.sqrt(Math.max(0, 1 - uz * uz));
  }
  const lo = w.lo || (w.lo = [0, 0]), hi = w.hi || (w.hi = [0, 0]);
  lo[0] = w.c[0] - ex0; lo[1] = w.c[2] - ex2;
  hi[0] = w.c[0] + ex0; hi[1] = w.c[2] + ex2;
}

const COOLERS = PLACEMENTS.filter((p) => p.model === 'cooler').map((p) => ({ i: p.coolerIndex, M: A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale)), scale: p.scale }));
/** The solids that stand still. */
export const SOLIDS = (() => {
  const out = [];
  for (const p of PLACEMENTS) {
    const shapes = MODEL[p.model];
    if (!shapes || (!p.at && p.follow !== 'radio')) continue;
    if (p.follow === 'radio') { out.push(...shapes.map((s) => place(A.mul(A.t(P.RADIO[0], P.TER, P.RADIO[1]), A.ry(0.4)), 1, s, { kind: 'radio' }))); continue; }   // as props.js poses it, at rest
    const seat = p.model === 'chair' ? P.SEATS.findIndex((s) => s.at[0] === p.at[0] && s.at[1] === p.at[2]) : -1;
    const use = seat >= 0 ? { kind: 'seat', seat } : p.model === 'cooler' ? { kind: 'cooler', cooler: p.coolerIndex } : null;
    out.push(...shapes.map((s) => place(A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale)), p.scale, s, use)));
  }
  // each cooler's lid, shut and open: the world counts the one its cooler shows
  for (const { i, M, scale } of COOLERS) for (const open of [false, true]) {
    const w = place(open ? A.mul(M, LID_OPEN) : M, scale, box(LID, LID_HI, !open), { kind: 'cooler', cooler: i });
    w.lid = { cooler: i, open };
    out.push(w);
  }
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
      const topOnly = s.ground && i === 1, room = topOnly ? h - p : h - Math.abs(p);   // a solid on the ground never exits downward
      if (room < inMin) { inMin = room; inI = i; inS = topOnly || p >= 0 ? 1 : -1; }
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
  let dr, dy, R, ux, uy, uz, ax, ay, az;   // in the plane through the axis: across (dr, along ux..) and along it (dy, along ax..)
  if (s.type === 'cyl') {
    const u = s.u, px = x - s.c[0], py = y - s.c[1], pz = z - s.c[2], a = px * u[0] + py * u[1] + pz * u[2];
    const vx = px - a * u[0], vy = py - a * u[1], vz = pz - a * u[2], rho = Math.hypot(vx, vy, vz);
    if (rho - r >= s.r || a + r <= -s.h || a - r >= s.h) return 0;
    if (rho > 1e-9) { ux = vx / rho; uy = vy / rho; uz = vz / rho; } else { ux = 1; uy = 0; uz = 0; }
    ax = u[0]; ay = u[1]; az = u[2];
    if (rho <= s.r && Math.abs(a) <= s.h) {   // the centre inside: out through the nearest of side, top and bottom
      const side = s.r - rho, top = s.ground && ay < -0.5 ? Infinity : s.h - a, bottom = s.ground && ay > 0.5 ? Infinity : a + s.h, m = Math.min(side, top, bottom);
      const k = m === top ? 1 : m === bottom ? -1 : 0;
      if (k) { n[0] = ax * k; n[1] = ay * k; n[2] = az * k; } else { n[0] = ux; n[1] = uy; n[2] = uz; }
      return r + m;
    }
    dr = rho - Math.min(rho, s.r); dy = a - Math.min(Math.max(a, -s.h), s.h); R = r;
  } else {   // the canopy: from the nearest point of its turned line
    const rx = x - s.x, rz = z - s.z, rho = Math.hypot(rx, rz);
    ux = rho > 1e-9 ? rx / rho : 1; uy = 0; uz = rho > 1e-9 ? rz / rho : 0; ax = 0; ay = 1; az = 0;
    const ex = s.r, ey = s.y - s.peak, t = Math.min(1, Math.max(0, (rho * ex + (y - s.peak) * ey) / (ex * ex + ey * ey)));
    dr = rho - ex * t; dy = y - s.peak - ey * t; R = r + s.t / 2;
  }
  const d = Math.hypot(dr, dy);
  if (d >= R) return 0;
  if (d < 1e-9) { n[0] = ax; n[1] = ay; n[2] = az; return R; }
  n[0] = (dr * ux + dy * ax) / d; n[1] = (dr * uy + dy * ay) / d; n[2] = (dr * uz + dy * az) / d;
  return R - d;
}

/** How far along the ray (o, unit d) it meets solid s, or -1: a box or a cylinder where it enters, a canopy where it
 * crosses its sloping cloth (the space under it is open). */
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
  if (s.type === 'cone') {   // rho = k (peak - y) for y from its hem to its peak: a quadratic in t
    const k = s.r / (s.peak - s.y), ox = o[0] - s.x, oz = o[2] - s.z, h = s.peak - o[1];
    const a = d[0] * d[0] + d[2] * d[2] - k * k * d[1] * d[1], b = ox * d[0] + oz * d[2] + k * k * h * d[1], c = ox * ox + oz * oz - k * k * h * h;
    const ts = Math.abs(a) < 1e-12 ? (Math.abs(b) < 1e-12 ? [] : [-c / (2 * b)]) : (() => { const q = b * b - a * c; if (q < 0) return []; const sq = Math.sqrt(q); return [(-b - sq) / a, (-b + sq) / a].sort((p, q2) => p - q2); })();
    for (const t of ts) { const y = o[1] + d[1] * t; if (t > 0 && y >= s.y && y <= s.peak) return t; }
    return -1;
  }
  const u = s.u, px = o[0] - s.c[0], py = o[1] - s.c[1], pz = o[2] - s.c[2], oa = px * u[0] + py * u[1] + pz * u[2], da = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  const vx = px - oa * u[0], vy = py - oa * u[1], vz = pz - oa * u[2], wx = d[0] - da * u[0], wy = d[1] - da * u[1], wz = d[2] - da * u[2];
  const a = wx * wx + wy * wy + wz * wz, b = vx * wx + vy * wy + vz * wz, c = vx * vx + vy * vy + vz * vz - s.r * s.r;
  if (a > 1e-12) { const q = b * b - a * c; if (q < 0) return -1; const sq = Math.sqrt(q); t0 = (-b - sq) / a; t1 = (-b + sq) / a; }
  else if (c > 0) return -1;
  else t0 = -Infinity;
  if (Math.abs(da) > 1e-12) { let a2 = (-s.h - oa) / da, b2 = (s.h - oa) / da; if (a2 > b2) [a2, b2] = [b2, a2]; t0 = Math.max(t0, a2); t1 = Math.min(t1, b2); }
  else if (Math.abs(oa) > s.h) return -1;
  return t0 <= t1 && t0 > 0 ? t0 : -1;
}

// A coarse grid over the island (CELL a side, out to EDGE from the middle): each cell lists the still solids within REACH
// of it, so a sphere tests only those near it; most of the ground has none. A bigger sphere (none floats) tests them all.
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

/** A world's solids: the still ones, the lid each cooler shows (isOpen(i)) and the hourglass as it stands or turns over
 * (glass(): the world's { turn }, as scene.js poses it). pose() moves the hourglass's to now; collide(x, y, z, r, n) is
 * the deepest any goes into a sphere (its outward normal into n), for the floating things; ray(o, d, skip) the nearest one
 * a pick ray meets: { t, use } or null (skip(use): one not to be hit, the seat sat in). */
export function createSolids({ isOpen, glass }) {
  const G = P.SIZE.glass, column = place(A.t(0, 0, 0), G, cyl(0.13, -0.25, 0.25, true), { kind: 'glass' });
  const on = (s) => !s.lid || isOpen(s.lid.cooler) === s.lid.open;
  const pose = () => {
    const turn = glass().turn, e = turn * turn * (3 - 2 * turn), a = Math.PI * e;
    column.c[0] = P.HOURGLASS[0];
    column.c[1] = P.TER + G * (0.25 + 0.06 * Math.sin(Math.PI * turn));
    column.c[2] = P.HOURGLASS[1];
    column.u[0] = 0; column.u[1] = Math.cos(a); column.u[2] = Math.sin(a);
    bound(column);
  };
  pose();
  const collide = (x, y, z, r, n) => {
    let best = 0;
    const list = near(x, z, r);
    for (let i = 0; i <= list.length; i++) {
      const s = i < list.length ? list[i] : column;
      if (x + r < s.lo[0] || x - r > s.hi[0] || z + r < s.lo[1] || z - r > s.hi[1] || !on(s)) continue;
      const pen = penetrate(s, x, y, z, r, nb);
      if (pen > best) { best = pen; n[0] = nb[0]; n[1] = nb[1]; n[2] = nb[2]; }
    }
    return best;
  };
  const ray = (o, d, skip = () => false) => {
    let best = null;
    for (const s of [...SOLIDS, column]) {
      if ((s.use && skip(s.use)) || !on(s)) continue;
      const t = enter(s, o, d);
      if (t > 0 && (!best || t < best.t)) best = { t, use: s.use };
    }
    return best;
  };
  return { pose, collide, ray };
}
