// Iceberg Jelly — the icebreaker Polaris: a red hull with a spoon bow, a white superstructure, a yellow funnel
// with smoke, a turning radar, a helideck. She lies at the quay; now and then (or on demand) she casts off,
// shoulders round the bay through the pack, pushing floes and bergs aside, and comes back alongside. Her hull
// is a moving solid for the ice (its surface velocity goes into the contacts).
import { A, MAT } from '../../core/diorama/parts.js';
import { createVessel, makeRoute } from '../../core/diorama/vessel.js';
import { I } from './layout.js';

export const SHIP = { len: 0.85, beam: 0.19, draft: 0.06, pivot: 0.18, free: 0.07 };
export const BERTH = [1.3, I.QUAY.z + 0.1 + SHIP.beam / 2 + 0.018];
const PIV = SHIP.pivot;
/** Round the bay and back to just off the quay, bow to the west; then she is warped in alongside. */
const OFF = BERTH[1] + 0.12;
export const ROUND = [[BERTH[0] - PIV, BERTH[1]], [0.55, BERTH[1] + 0.06], [-0.1, 0.3], [-0.38, 1.05], [-0.05, 1.85], [0.7, 2.12], [1.2, 1.25],
  [1.95, 0.85], [2.25, 0.35], [2.05, -0.02], [1.65, OFF], [BERTH[0] - PIV, OFF]];

// ----- the model (local: bow +x, waterline 0, beam along z) -----
export function buildShip(B) {
  const hl = SHIP.len / 2, hb = SHIP.beam / 2, d = SHIP.draft, f = SHIP.free;
  const width = (x) => {
    const u = x / hl;
    if (u > 0.35) return hb * Math.sqrt(Math.max(0, 1 - ((u - 0.35) / 0.65) ** 2.2)) * 0.97 + hb * 0.03;   // the spoon bow
    if (u < -0.85) return hb * 0.92;                                                                 // the transom
    return hb;
  };
  const bottom = (x) => { const u = x / hl; return -d + (u > 0.3 ? 0.075 * ((u - 0.3) / 0.7) ** 1.6 : 0) + (u < -0.8 ? 0.02 * ((-0.8 - u) / 0.2) : 0); };
  const rake = (x, t) => (x / hl > 0.8 ? 0.04 * t * ((x / hl - 0.8) / 0.2) : 0);   // the stem leans forward going up
  const NS = 44, prof = [[0, 0], [0.85, 0], [1, 0.25], [1, 1]];
  const hull = (from, to, col) => {   // the hull between two heights (fractions from the bottom to the deck)
    B.col(col).mat(MAT.PAINT);
    B.sheet(NS + 1, prof.length * 2 - 1, (i, j) => {
      const x = -hl + (SHIP.len * i) / NS, w = width(x), b = bottom(x), k = j < prof.length ? prof.length - 1 - j : j - prof.length + 1, s = j < prof.length ? -1 : 1;
      const t = from + (to - from) * prof[k][1];
      return [x + rake(x, t), b + (f - b) * t, s * w * (from > 0 ? 1 : prof[k][0])];
    });
  };
  hull(0, 0.42, '#6e1d1a');    // below the waterline
  hull(0.42, 1, '#c8302a');    // the topsides
  B.col('#f2f2ee').mat(MAT.PAINT);
  B.sheet(NS + 1, 2, (i, j) => { const x = -hl + (SHIP.len * i) / NS; return [x + rake(x, 1), f, (j ? 1 : -1) * width(x) * 0.98]; });   // the sheer line
  B.col('#8a8a86').mat(MAT.MATTE);
  B.sheet(NS + 1, 2, (i, j) => { const x = -hl + (SHIP.len * i) / NS; return [x + rake(x, 1), f + 0.002, (j ? 1 : -1) * width(x) * 0.96]; });   // the deck
  // the superstructure, the bridge with its windows and wings
  B.col('#f4f4f0').mat(MAT.PAINT).slab(-0.17, f, -hb * 0.8, 0.1, f + 0.12, hb * 0.8);
  B.slab(-0.02, f + 0.12, -hb * 0.75, 0.11, f + 0.175, hb * 0.75);
  B.slab(0.02, f + 0.16, -hb - 0.02, 0.09, f + 0.168, hb + 0.02);
  B.col('#1f2a33').mat(MAT.GLASS).slab(0.108, f + 0.135, -hb * 0.7, 0.113, f + 0.162, hb * 0.7);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) B.slab(-0.15 + k * 0.06, f + 0.045, s * hb * 0.8 - 0.002, -0.12 + k * 0.06, f + 0.065, s * hb * 0.8 + 0.002);
  // the funnel, yellow with a black top
  B.col('#f2c230').mat(MAT.PAINT).at(A.mul(A.t(-0.09, f + 0.12, 0), A.s(1.4, 1, 1)), () => B.cyl(0.03, 0.09, 12, 0.026));
  B.col('#1a1a1a').at(A.mul(A.t(-0.09, f + 0.21, 0), A.s(1.4, 1, 1)), () => B.cyl(0.0262, 0.018, 12));
  // the foremast (the radar turns on it, a part of its own)
  B.col('#f4f4f0').mat(MAT.PAINT).at(A.t(0.05, f + 0.175, 0), () => B.cyl(0.005, 0.12, 6));
  // the helideck aft, with its H
  B.col('#4a5a4a').mat(MAT.MATTE).slab(-hl + 0.02, f + 0.07, -hb * 0.95, -0.17, f + 0.077, hb * 0.95);
  B.col('#f4f4f0');
  B.slab(-0.33, f + 0.0775, -0.04, -0.318, f + 0.079, 0.04); B.slab(-0.282, f + 0.0775, -0.04, -0.27, f + 0.079, 0.04); B.slab(-0.33, f + 0.0775, -0.006, -0.27, f + 0.079, 0.006);
  for (const s of [-1, 1]) B.slab(-hl + 0.02, f + 0.05, s * hb * 0.9 - 0.002, -0.17, f + 0.07, s * hb * 0.9 + 0.002);
  // orange lifeboats, the anchors
  B.col('#f07a1a').mat(MAT.PAINT);
  for (const s of [-1, 1]) B.at(A.t(-0.05, f + 0.135, s * (hb * 0.8 + 0.02)), () => B.ball(0.04, 0.014, 0.015, 1));
  B.col('#202020').mat(MAT.METAL);
  for (const s of [-1, 1]) B.slab(hl * 0.78, f - 0.035, s * width(hl * 0.78) - 0.004, hl * 0.78 + 0.025, f - 0.015, s * width(hl * 0.78) + 0.004);
}
export function buildRadar(B) { B.col('#f4f4f0').mat(MAT.PAINT).slab(-0.004, -0.003, -0.03, 0.004, 0.003, 0.03); B.col('#2a2a2a').slab(-0.003, -0.006, -0.004, 0.003, 0.0, 0.004); }

// ----- her day -----
/** o: { water, foam, events, rand, puff } — the ship, her schedule, and her hull as a solid for the ice. */
export function createShip({ water, foam, events, rand: R, puff }) {
  const v = createVessel({ water, foam, len: SHIP.len, beam: SHIP.beam, draft: SHIP.draft, pivot: PIV, speed: 0.17, push: 6, wash: 1.6 });   // push well past her true displacement: at her speed that wave would barely show
  const route = makeRoute(ROUND);
  const S = { v, route, state: 'alongside', wait: 35, trips: 0, full: false, breaking: 0, smokeT: 0, t: 0 };
  S.reset = () => { v.place(BERTH[0], BERTH[1], Math.PI); S.state = 'alongside'; S.wait = 35; S.trips = 0; S.full = false; S.breaking = 0; };
  /** Cast off now (alongside), or full ahead (under way). */
  S.go = () => {
    if (S.state === 'alongside') { S.state = 'casting'; S.t = 0; events.push({ type: 'horn' }); }
    else S.full = true;
  };
  S.step = (dt) => {
    S.breaking = Math.max(0, S.breaking - dt);
    if (S.state === 'alongside') { if ((S.wait -= dt) < 0) S.go(); }
    else if (S.state === 'casting') { if ((S.t += dt) > 2) { S.state = 'under way'; v.follow(route); } }
    else if (S.state === 'under way' && v.atEnd()) { S.state = 'warping'; v.moveTo(BERTH[0], BERTH[1], Math.PI, 5); }   // lines ashore: drawn in sideways and straightened against the quay
    v.speed = S.full ? 0.3 : 0.17;
    v.step(dt, 1);
    if (S.state === 'warping' && v.atEnd()) { v.place(BERTH[0], BERTH[1], Math.PI); S.state = 'alongside'; S.wait = 60 + R() * 30; S.trips++; S.full = false; }
    if ((S.smokeT -= dt) < 0) { S.smokeT = v.moving ? 0.18 : 0.5; puff(A.apply(v.matrix(), [-0.09, SHIP.free + 0.23, 0]), 'smoke'); }
  };
  /** What the status line says. */
  S.status = () => {
    if (S.state === 'alongside') return { text: 'Alongside', more: `casting off in ${Math.ceil(Math.max(0, S.wait))} s` };
    if (S.state === 'casting') return { text: 'Casting off', more: '' };
    if (S.state === 'warping') return { text: 'Coming alongside', more: '100%' };
    const p = Math.round((100 * v.s) / route.len);
    if (route.len - v.s < 0.9) return { text: 'Coming alongside', more: `${p}%` };
    if (S.breaking > 0) return { text: 'Breaking ice', more: `${p}%` };
    return { text: S.full ? 'Full ahead' : 'Under way', more: `${p}%` };
  };
  /** The hull as a solid for the ice; shoving ice aside while under way is breaking ice. */
  S.solid = (x, y, z, r, n, u) => {
    const p = v.solid(x, y, z, r, n, u, SHIP.free);
    if (p > 0 && Math.hypot(u[0], u[2]) > 0.02) S.breaking = 1.5;
    return p;
  };
  S.reset();
  return S;
}
