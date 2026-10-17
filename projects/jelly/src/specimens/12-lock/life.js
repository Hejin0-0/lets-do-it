// Lock Jelly — life on the cut. Roach, perch and bream school as boids, each in its own body of water (they
// pass between pound and chamber only while a gate stands open), under the surface and the hulls, off the bed,
// scattering from the boat and from splashes. Mallards paddle about, upend now and then, keep out of the
// boat's way and come for bread; a duck leads four ducklings that follow exactly in her trail; a pair of mute
// swans keep to the basin. A grey heron wades in the shallows or stands on a moored boat's roof, stabs at fish
// (and sometimes gets one) and flaps off somewhere quieter when the boat passes or someone toots. Sheep graze.
import { A, MAT } from '@lid/diorama/parts.js';
import { L } from './layout.js';
import { BOAT } from './boat.js';

const H = L.terrainH, TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ----- models (each in its own frame: forward +x, up +y) -----
function fishModel(B, kind) {
  const [body, fin, len, h] = { roach: ['#c9cfd2', '#e04a3a', 0.052, 0.0135], perch: ['#7f8f3a', '#e8782a', 0.05, 0.015], bream: ['#9a7a44', '#5a4a3a', 0.06, 0.024] }[kind];
  B.col(body).mat(MAT.FISH).ball(len / 2, h / 2, h * 0.32, 1);
  B.col(fin).sheet(3, 2, (i, j) => [-len / 2 - 0.002 - i * 0.006, (j - 0.5) * h * (0.4 + i * 0.35), 0]);   // the tail
  B.col(fin).mat(MAT.MATTE).quad([-len * 0.15, h * 0.4, 0], [len * 0.15, h * 0.45, 0], [len * 0.02, h * 0.85, 0], [-len * 0.2, h * 0.7, 0]);   // the dorsal fin
  if (kind === 'perch') { B.col('#2f3a1c'); for (const x of [-0.012, 0.0, 0.012]) B.slab(x - 0.0018, -h * 0.35, -h * 0.33, x + 0.0018, h * 0.42, h * 0.33); }
  B.col('#f4f4f0').mat(MAT.GLOSS).at(A.t(len * 0.34, h * 0.08, 0), () => B.ball(0.0024, 0.0024, h * 0.34, 0));
  B.col('#101010').at(A.t(len * 0.35, h * 0.08, 0), () => B.ball(0.0013, 0.0013, h * 0.36, 0));
}
function mallard(B, drake) {
  const body = drake ? '#a8a49a' : '#8a6a46', breast = drake ? '#6a3a2a' : '#7a5a3a';
  B.col(body).mat(MAT.FEATHER).ball(0.024, 0.012, 0.013, 1);
  B.col(breast).at(A.t(0.012, 0.002, 0), () => B.ball(0.013, 0.011, 0.012, 1));
  B.col(drake ? '#3a3a3a' : '#6a4e32').at(A.mul(A.t(-0.02, 0.006, 0), A.rz(0.5)), () => B.ball(0.008, 0.004, 0.008, 0));   // the tail
  if (drake) B.col('#f2f0ea').at(A.t(0.019, 0.011, 0), () => B.ball(0.0065, 0.002, 0.0065, 0));                      // the white collar
  B.col(drake ? '#1f6a3a' : '#7a5a3a').mat(drake ? MAT.GLOSS : MAT.FEATHER).at(A.t(0.021, 0.02, 0), () => B.ball(0.0075, 0.0075, 0.0065, 1));
  B.col(drake ? '#d8c43a' : '#c8823a').mat(MAT.MATTE).at(A.t(0.031, 0.018, 0), () => B.ball(0.0055, 0.0018, 0.0035, 0));
  B.col('#101010').at(A.t(0.025, 0.022, 0), () => B.ball(0.0012, 0.0012, 0.0066, 0));
  B.col('#3a5ab0').at(A.t(-0.004, 0.008, 0), () => B.ball(0.006, 0.0035, 0.0132, 0));   // the speculum
}
function duckling(B) {
  B.col('#8a6a3a').mat(MAT.FEATHER).ball(0.011, 0.007, 0.0075, 1);
  B.col('#e8c85a').at(A.t(0.004, -0.001, 0), () => B.ball(0.008, 0.005, 0.007, 1));
  B.col('#8a6a3a').at(A.t(0.01, 0.009, 0), () => B.ball(0.0052, 0.005, 0.0048, 1));
  B.col('#3a3020').mat(MAT.MATTE).at(A.t(0.016, 0.008, 0), () => B.ball(0.003, 0.0012, 0.002, 0));
}
function swan(B) {
  B.col('#f7f6f2').mat(MAT.FEATHER).ball(0.042, 0.018, 0.022, 1);
  B.at(A.mul(A.t(-0.022, 0.012, 0), A.rz(0.35)), () => B.ball(0.03, 0.014, 0.024, 1));   // the raised wings
  B.tube([[0.03, 0.005, 0], [0.042, 0.03, 0], [0.036, 0.055, 0], [0.042, 0.068, 0]], [0.008, 0.0055, 0.005, 0.0055], 7);
  B.at(A.t(0.047, 0.068, 0), () => B.ball(0.009, 0.0065, 0.0065, 1));
  B.col('#e86a1a').mat(MAT.MATTE).at(A.t(0.058, 0.065, 0), () => B.ball(0.0085, 0.0028, 0.0035, 0));
  B.col('#1a1a1a').at(A.t(0.052, 0.068, 0), () => B.ball(0.0028, 0.0032, 0.0032, 0));
}
function heronBody(B) {   // the body and its legs
  B.col('#9aa0a6').mat(MAT.FEATHER).ball(0.03, 0.017, 0.016, 1);
  B.col('#c8ccd0').at(A.t(0.012, -0.004, 0), () => B.ball(0.02, 0.012, 0.012, 1));
  B.col('#6a6e72').at(A.mul(A.t(-0.03, 0.002, 0), A.rz(-0.2)), () => B.ball(0.016, 0.005, 0.013, 0));
  B.col('#b89a5a').mat(MAT.MATTE);
  for (const s of [-1, 1]) B.tube([[0, -0.01, s * 0.006], [0.002, -0.05, s * 0.007], [0, -0.09, s * 0.008]], 0.0022, 5);
}
function heronNeck(B) {   // the S-neck and the head, from the shoulders; it stabs by swinging forward
  B.col('#e4e6e8').mat(MAT.FEATHER).tube([[0, 0, 0], [0.012, 0.02, 0], [0.004, 0.035, 0], [0.014, 0.05, 0]], [0.007, 0.006, 0.0055, 0.0055], 7);
  B.col('#e4e6e8').at(A.t(0.018, 0.053, 0), () => B.ball(0.008, 0.0065, 0.0058, 1));
  B.col('#1a1a1a').at(A.mul(A.t(0.01, 0.058, 0), A.rz(0.4)), () => B.ball(0.012, 0.0015, 0.0018, 0));   // the crest
  B.col('#e2b43a').mat(MAT.MATTE).at(A.mul(A.t(0.032, 0.052, 0), A.rz(-0.15)), () => B.ball(0.016, 0.0022, 0.0022, 0));
  B.col('#101010').at(A.t(0.021, 0.055, 0), () => B.ball(0.0015, 0.0015, 0.006, 0));
}
function heronWing(B, s) {   // from the shoulder outward along ±z
  B.col('#8a9096').mat(MAT.FEATHER).sheet(3, 5, (i, j) => [0.012 - i * 0.022 - j * j * 0.002, -0.002 * j, s * (0.004 + j * 0.017)]);
  B.col('#3a3e42').sheet(2, 3, (i, j) => [-0.032 - i * 0.008, -0.004 - 0.002 * j, s * (0.04 + j * 0.016)]);
}
function sheepBody(B) {
  B.col('#f0ece2').mat(MAT.FEATHER);
  for (const [x, y, z, r] of [[0, 0.04, 0, 0.026], [0.018, 0.042, 0.006, 0.02], [-0.018, 0.041, -0.005, 0.021], [0.004, 0.05, -0.008, 0.019], [-0.006, 0.048, 0.01, 0.019]]) B.at(A.t(x, y - 0.022, z), () => B.ball(r, r * 0.85, r * 0.9, 1));
  B.col('#1e1c1a').mat(MAT.MATTE);
  for (const [x, z] of [[0.018, 0.012], [0.018, -0.012], [-0.018, 0.012], [-0.018, -0.012]]) B.at(A.t(x, -0.022, z), () => B.cyl(0.0035, 0.025, 5));
}
function sheepHead(B) {   // from the neck, forward; it dips to graze
  B.col('#1e1c1a').mat(MAT.MATTE).at(A.t(0.016, 0, 0), () => B.ball(0.011, 0.009, 0.0085, 1));
  for (const s of [-1, 1]) B.at(A.mul(A.t(0.01, 0.006, s * 0.009), A.rx(s * 1.2)), () => B.ball(0.006, 0.0025, 0.003, 0));
  B.col('#f0ece2').mat(MAT.FEATHER).at(A.t(0.006, 0.008, 0), () => B.ball(0.008, 0.005, 0.008, 0));
}
/** A yellow rubber duck (forward +x), and the spheres it floats on: weighted low, so it rights itself. */
export function rubberDuck(B) {
  B.col('#f7c81e').mat(MAT.GLOSS);
  B.at(A.t(0, 0.018, 0), () => B.ball(0.025, 0.018, 0.02, 1));
  B.at(A.mul(A.t(-0.02, 0.026, 0), A.rz(0.5)), () => B.ball(0.012, 0.008, 0.012, 1));
  B.at(A.t(0.014, 0.044, 0), () => B.ball(0.0135, 0.0135, 0.013, 1));
  B.col('#f2731e').at(A.t(0.03, 0.041, 0), () => B.ball(0.008, 0.003, 0.0065, 0));
  B.col('#121212');
  for (const s of [-1, 1]) B.at(A.t(0.022, 0.05, s * 0.0085), () => B.ball(0.0022, 0.0026, 0.0018, 0));
}
export const DUCK_FLOAT = { spheres: [[0, 0.018, 0, 0.022], [-0.018, 0.022, 0, 0.014], [0.014, 0.044, 0, 0.013]], com: [0, 0.01, 0], rho: 0.32, mu: 0.4, e: 0.35 };
function crumb(B) { B.col('#e8d8a8').mat(MAT.MATTE).ball(0.004, 0.0025, 0.0035, 0); }

const FISH_N = 26, BREAD_N = 30;
const MALLARDS = [{ drake: true, at: [-1.6, 2.3] }, { drake: false, at: [-1.45, 2.4] }, { drake: true, at: [1.2, 0.2] }, { drake: false, at: [1.35, -0.3] }];
const MOTHER_AT = [0.95, -1.15], SWANS = [[2.05, -0.75], [2.2, -1.1]];
const SHEEP_N = 6, FIELD = [-1.45, -2.38, 0.35, -0.55];
const HERON_SPOTS = [
  { at: [1.3, -0.95], kind: 'wade' }, { at: [0.72, -0.3], kind: 'wade' }, { at: [-2.4, 1.55], kind: 'wade' }, { at: [1.98, -1.18], kind: 'wade' },
  { boat: 0, kind: 'perch' }, { boat: 2, kind: 'perch' },
];

/** Build the creatures' parts; returns their part numbers. */
export function buildLife(B) {
  const P = { fish: [], birds: [], sheep: [], crumbs: [] };
  for (let i = 0; i < FISH_N; i++) { P.fish.push(B.newPart()); fishModel(B, ['roach', 'roach', 'perch', 'bream'][i % 4]); }
  for (const m of MALLARDS) { P.birds.push(B.newPart()); mallard(B, m.drake); }
  P.birds.push(B.newPart()); mallard(B, false);   // the mother
  for (let i = 0; i < 4; i++) { P.birds.push(B.newPart()); duckling(B); }
  for (let i = 0; i < 2; i++) { P.birds.push(B.newPart()); swan(B); }
  P.heron = { body: B.newPart() }; heronBody(B);
  P.heron.neck = B.newPart(); heronNeck(B);
  P.heron.wingL = B.newPart(); heronWing(B, 1);
  P.heron.wingR = B.newPart(); heronWing(B, -1);
  for (let i = 0; i < SHEEP_N; i++) { const b = B.newPart(); sheepBody(B); const h = B.newPart(); sheepHead(B); P.sheep.push([b, h]); }
  for (let i = 0; i < BREAD_N; i++) { P.crumbs.push(B.newPart()); crumb(B); }
  return P;
}

/** The creatures. o: { water, boat, moored, rand, events } */
export function createLife({ water, boat, moored, rand: R, events }) {
  const Lf = { fish: [], birds: [], sheep: [], crumbs: [], fed: 0, caught: 0, heron: null, splashes: [] };
  const lvlOK = (x, z, k) => { const r = water.regionAt(x, z); return water.isWet(x, z) && (r === k || water.isLinked(k, r)); };
  const depth = (x, z) => water.surface(x, z) - H(x, z);
  const boatNear = (x, z, pad) => {   // distance from a point to the boat's hull (a capsule), less pad
    const h = [Math.cos(boat.yaw), Math.sin(boat.yaw)], dx = x - boat.c[0], dz = z - boat.c[1], u = Math.max(-boat.len / 2, Math.min(boat.len / 2, dx * h[0] + dz * h[1]));
    return Math.hypot(dx - h[0] * u, dz - h[1] * u) - boat.beam / 2 - pad;
  };

  function spawnFish(f) {
    for (let t = 0; t < 200; t++) {
      const x = (R() * 2 - 1) * (L.HALF - 0.1), z = (R() * 2 - 1) * (L.HALF - 0.1);
      if (!water.isWet(x, z) || depth(x, z) < 0.14) continue;
      const y = H(x, z) + 0.04 + R() * (depth(x, z) - 0.09), a = R() * TAU;
      Object.assign(f, { p: [x, y, z], v: [Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04], k: water.regionAt(x, z), wa: R() * TAU, gone: 0 });
      return;
    }
  }
  function spotPos(s) { const S = HERON_SPOTS[s]; if (S.kind === 'perch') { const m = moored[S.boat]; return [m.c[0], m.y + 0.13, m.c[1]]; } return [S.at[0], H(S.at[0], S.at[1]) + 0.004, S.at[1]]; }
  Lf.reset = () => {
    Lf.fish = Array.from({ length: FISH_N }, (_, i) => { const f = { kind: i % 4, p: [0, 0, 0], v: [0, 0, 0] }; spawnFish(f); return f; });
    const bird = (at, kind) => ({ kind, p: [at[0], water.surface(at[0], at[1]), at[1]], yaw: R() * TAU, v: 0, k: water.regionAt(at[0], at[1]), up: 0, upT: 8 + R() * 20, wa: R() * TAU, flee: 0, trail: [] });
    Lf.birds = [...MALLARDS.map((m) => bird(m.at, 'mallard')), bird(MOTHER_AT, 'mother'), ...[0, 1, 2, 3].map(() => bird(MOTHER_AT, 'duckling')), ...SWANS.map((s) => bird(s, 'swan'))];
    Lf.sheep = Array.from({ length: SHEEP_N }, () => ({ p: [FIELD[0] + R() * (FIELD[2] - FIELD[0]), FIELD[1] + R() * (FIELD[3] - FIELD[1])], yaw: R() * TAU, graze: R(), t: R() * 5, go: null }));
    Lf.crumbs = Array.from({ length: BREAD_N }, () => ({ on: false, p: [0, 0, 0], v: [0, 0, 0], age: 0, afloat: false }));
    Lf.heron = { spot: 0, p: spotPos(0), yaw: 2, mode: 'stand', t: 3, stab: 0, flap: 0, fly: null, calm: 0 };
    Lf.fed = 0; Lf.caught = 0;
  };

  // ----- fish -----
  function stepFish(dt) {
    const F = Lf.fish;
    for (const f of F) {
      if (f.gone > 0) { if ((f.gone -= dt) <= 0) spawnFish(f); continue; }
      const [x, y, z] = f.p;
      let ax = 0, ay = 0, az = 0;
      f.wa += (R() - 0.5) * 3 * dt;
      ax += Math.cos(f.wa) * 0.03; az += Math.sin(f.wa) * 0.03;
      let n = 0, cx = 0, cy = 0, cz = 0, vx = 0, vz = 0;
      for (const g of F) {
        if (g === f || g.gone > 0 || g.kind !== f.kind) continue;
        const dx = g.p[0] - x, dy = g.p[1] - y, dz = g.p[2] - z, d = Math.hypot(dx, dy, dz);
        if (d > 0.18 || d < 1e-6) continue;
        if (d < 0.04) { ax -= (dx / d) * 0.25; ay -= (dy / d) * 0.1; az -= (dz / d) * 0.25; }
        n++; cx += g.p[0]; cy += g.p[1]; cz += g.p[2]; vx += g.v[0]; vz += g.v[2];
      }
      if (n) { ax += (cx / n - x) * 0.4 + (vx / n - f.v[0]) * 0.8; ay += (cy / n - y) * 0.2; az += (cz / n - z) * 0.4 + (vz / n - f.v[2]) * 0.8; }
      const s = water.surface(x, z), bed = H(x, z), roof = boatNear(x, z, 0.05) < 0 ? Math.min(s, boat.y - BOAT.draft - 0.02) : s - 0.035;
      if (y > roof) ay -= 0.6;
      if (y < bed + 0.03) ay += 0.6;
      const bd = boatNear(x, z, 0);
      if (bd < 0.2 && boat.moving) { const h = [Math.cos(boat.yaw), Math.sin(boat.yaw)], side = Math.sign((x - boat.c[0]) * -h[1] + (z - boat.c[1]) * h[0]) || 1; ax += -h[1] * side * 0.8; az += h[0] * side * 0.8; }
      for (const e of Lf.splashes) { const dx = x - e[0], dz = z - e[1], d = Math.hypot(dx, dz); if (d < 0.35) { ax += (dx / (d + 1e-3)) * 1.2; az += (dz / (d + 1e-3)) * 1.2; } }
      f.v[0] += ax * dt; f.v[1] += ay * dt; f.v[2] += az * dt;
      f.v[1] *= 1 - 3 * dt;
      const sp = Math.hypot(f.v[0], f.v[2]), mx = bd < 0.25 ? 0.2 : 0.07, mn = 0.025;
      if (sp > mx) { f.v[0] *= mx / sp; f.v[2] *= mx / sp; } else if (sp < mn) { f.v[0] *= mn / (sp + 1e-6); f.v[2] *= mn / (sp + 1e-6); }
      // keep to its own water: turn back at a bank, a shut gate, a wall
      const nx = x + f.v[0] * 0.5 + Math.sign(f.v[0]) * 0.03, nz = z + f.v[2] * 0.5 + Math.sign(f.v[2]) * 0.03;
      if (!lvlOK(nx, nz, f.k) || depth(nx, nz) < 0.07) { f.v[0] = -f.v[0]; f.v[2] = -f.v[2]; f.wa += Math.PI; }
      else {
        f.p[0] += f.v[0] * dt; f.p[2] += f.v[2] * dt;
        const r = water.regionAt(f.p[0], f.p[2]); if (r !== f.k && water.isLinked(f.k, r)) f.k = r;
      }
      f.p[1] = Math.max(H(f.p[0], f.p[2]) + 0.02, Math.min(water.surface(f.p[0], f.p[2]) - 0.025, f.p[1] + f.v[1] * dt));
    }
  }

  // ----- birds on the water -----
  function stepBirds(dt) {
    const mother = Lf.birds.find((b) => b.kind === 'mother');
    let di = 0;
    for (const b of Lf.birds) {
      const swan = b.kind === 'swan';
      if (b.kind === 'duckling') {   // exactly along her trail, one behind another
        const T = mother.trail, idx = Math.min(T.length - 1, Math.round((0.035 * (di + 1) + 0.008) / 0.004));
        di++;
        if (T.length > 2) {
          const q = T[idx], q2 = T[Math.max(0, idx - 1)];
          b.p[0] = q[0]; b.p[2] = q[1]; b.yaw = Math.atan2(q2[1] - q[1], q2[0] - q[0]) || b.yaw;
        }
        b.k = water.regionAt(b.p[0], b.p[2]);
        b.p[1] = water.surface(b.p[0], b.p[2]);
        continue;
      }
      // what does it want? bread, out of the boat's way, or a pottering wander
      let ty = b.yaw + Math.sin((b.wa += dt * 0.7)) * 0.6, sp = swan ? 0.035 : 0.045;
      let near = null, nd = swan ? 1.0 : 0.9;
      for (const c of Lf.crumbs) if (c.on && c.afloat) { const d = Math.hypot(c.p[0] - b.p[0], c.p[2] - b.p[2]); if (d < nd && lvlOK(c.p[0], c.p[2], b.k)) { nd = d; near = c; } }
      if (near) {
        ty = Math.atan2(near.p[2] - b.p[2], near.p[0] - b.p[0]); sp = swan ? 0.07 : 0.09;
        if (nd < 0.022) { near.on = false; Lf.fed++; events.push({ type: 'quack', x: b.p[0], z: b.p[2] }); }
      }
      const bd = boatNear(b.p[0], b.p[2], 0);
      if ((boat.moving && bd < 0.3) || b.flee > 0) {   // paddle off, away from the hull
        const h = [Math.cos(boat.yaw), Math.sin(boat.yaw)], side = Math.sign((b.p[0] - boat.c[0]) * -h[1] + (b.p[2] - boat.c[1]) * h[0]) || 1;
        ty = Math.atan2(h[0] * side, -h[1] * side); sp = 0.11; b.flee = Math.max(0, b.flee - dt);
      }
      // keep to water deep enough, of its own body (swans to the basin), clear of the hull
      const look = (a, d) => [b.p[0] + Math.cos(a) * d, b.p[2] + Math.sin(a) * d];
      const ok = (q) => lvlOK(q[0], q[1], b.k) && depth(q[0], q[1]) > 0.02 && (!swan || q[1] < 0.55) && boatNear(q[0], q[1], 0.01) > 0;
      if (!ok(look(ty, 0.06))) { for (const d of [0.6, -0.6, 1.2, -1.2, 2, -2, Math.PI]) if (ok(look(ty + d, 0.06))) { ty += d; break; } }
      b.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, wrap(ty - b.yaw)));
      b.v += (sp - b.v) * Math.min(1, dt * 2);
      const q = look(b.yaw, b.v * dt);
      if (ok(look(b.yaw, 0.03))) { b.p[0] = q[0]; b.p[2] = q[1]; } else b.v *= 0.5;
      if (boatNear(b.p[0], b.p[2], 0.005) < 0) {   // shoved by the hull
        const h = [Math.cos(boat.yaw), Math.sin(boat.yaw)], side = Math.sign((b.p[0] - boat.c[0]) * -h[1] + (b.p[2] - boat.c[1]) * h[0]) || 1;
        b.p[0] += -h[1] * side * 0.004; b.p[2] += h[0] * side * 0.004;
      }
      const r = water.regionAt(b.p[0], b.p[2]); if (r !== b.k && water.isLinked(b.k, r)) b.k = r;
      b.p[1] = water.surface(b.p[0], b.p[2]);
      if (b.up > 0) b.up = Math.max(0, b.up - dt / 2.2);   // upending now and then
      else if ((b.upT -= dt) < 0) { b.upT = 15 + R() * 25; if (!near) b.up = 1; }
      if (b.kind === 'mother') {
        const T = b.trail, last = T[0];
        if (!last || Math.hypot(b.p[0] - last[0], b.p[2] - last[1]) > 0.004) { T.unshift([b.p[0], b.p[2]]); if (T.length > 60) T.pop(); }
      }
    }
  }

  // ----- the heron -----
  function flyOff() {
    const h = Lf.heron, from = h.p.slice();
    let best = h.spot, bestD = -1;
    for (let k = 0; k < HERON_SPOTS.length; k++) {
      if (k === h.spot) continue;
      const p = spotPos(k), d = Math.hypot(p[0] - boat.c[0], p[2] - boat.c[1]) + R() * 0.6;
      if (d > bestD) { bestD = d; best = k; }
    }
    const to = spotPos(best);
    h.fly = { from, to, t: 0, dur: 2.2 + Math.hypot(to[0] - from[0], to[2] - from[2]) * 0.8 };
    h.spot = best; h.mode = 'fly'; h.calm = 6;
    events.push({ type: 'heron' });
  }
  function stepHeron(dt) {
    const h = Lf.heron;
    h.calm = Math.max(0, h.calm - dt);
    if (h.mode === 'fly') {
      const F = h.fly;
      F.t = Math.min(1, F.t + dt / F.dur);
      const e = F.t * F.t * (3 - 2 * F.t);
      h.p = [0, 1, 2].map((i) => F.from[i] + (F.to[i] - F.from[i]) * e);
      h.p[1] += Math.sin(Math.PI * F.t) * 0.35;
      h.yaw = Math.atan2(F.to[2] - F.from[2], F.to[0] - F.from[0]);
      h.flap += dt * 9;
      if (F.t >= 1) { h.mode = 'stand'; h.t = 3 + R() * 4; }
      return;
    }
    if (HERON_SPOTS[h.spot].kind === 'perch') h.p = spotPos(h.spot);
    if (h.calm === 0 && boat.moving && Math.hypot(h.p[0] - boat.c[0], h.p[2] - boat.c[1]) < 0.55) { flyOff(); return; }
    if (h.stab > 0) { h.stab = Math.max(0, h.stab - dt * 2.2); return; }
    if ((h.t -= dt) < 0) {
      h.t = 1.5 + R() * 3;
      if (HERON_SPOTS[h.spot].kind === 'wade') {   // look about; stab at a fish in reach
        const prey = Lf.fish.find((f) => f.gone <= 0 && Math.hypot(f.p[0] - h.p[0], f.p[2] - h.p[2]) < 0.12);
        if (prey) {
          h.yaw = Math.atan2(prey.p[2] - h.p[2], prey.p[0] - h.p[0]); h.stab = 1;
          events.push({ type: 'stab', x: h.p[0], z: h.p[2] });
          if (R() < 0.4) { prey.gone = 25; Lf.caught++; }
        } else h.yaw += (R() - 0.5) * 1.6;
      }
    }
  }
  Lf.toot = () => { if (Lf.heron.mode !== 'fly') flyOff(); for (const b of Lf.birds) b.flee = 1.2; };

  // ----- sheep -----
  function stepSheep(dt) {
    for (const s of Lf.sheep) {
      s.t -= dt;
      if (!s.go && s.t < 0) s.go = [FIELD[0] + R() * (FIELD[2] - FIELD[0]), FIELD[1] + R() * (FIELD[3] - FIELD[1])];
      if (s.go) {
        const dx = s.go[0] - s.p[0], dz = s.go[1] - s.p[1], d = Math.hypot(dx, dz);
        s.yaw += wrap(Math.atan2(dz, dx) - s.yaw) * Math.min(1, dt * 2);
        const st = Math.min(d, 0.02 * dt);
        if (d > 1e-3) { s.p[0] += (dx / d) * st; s.p[1] += (dz / d) * st; }
        s.graze = Math.max(0, s.graze - dt);
        if (d < 0.01) { s.go = null; s.t = 6 + R() * 10; }
      } else s.graze = Math.min(1, s.graze + dt);
    }
  }

  // ----- bread -----
  /** A handful of bread thrown from a bank toward one of the birds. Returns how many crumbs flew. */
  Lf.throwBread = () => {
    const live = Lf.birds.filter((b) => b.kind !== 'duckling'), b = live[(R() * live.length) | 0];
    let from = null;
    for (let t = 0; t < 80 && !from; t++) { const a = R() * TAU, d = 0.25 + R() * 0.3, x = b.p[0] + Math.cos(a) * d, z = b.p[2] + Math.sin(a) * d; if (Math.abs(x) < L.HALF - 0.05 && Math.abs(z) < L.HALF - 0.05 && !water.isWet(x, z)) from = [x, H(x, z) + 0.08, z]; }
    if (!from) from = [b.p[0], b.p[1] + 0.3, b.p[2] - 0.3];
    let n = 0;
    for (const c of Lf.crumbs) {
      if (c.on || n >= 7) continue;
      const tx = b.p[0] + (R() - 0.5) * 0.15, tz = b.p[2] + (R() - 0.5) * 0.15, T = 0.7 + R() * 0.2;
      c.on = true; c.afloat = false; c.age = 0; c.p = from.slice();
      c.v = [(tx - from[0]) / T, (b.p[1] - from[1]) / T + 0.5 * 1.6 * T, (tz - from[2]) / T];
      n++;
    }
    return n;
  };
  function stepCrumbs(dt) {
    for (const c of Lf.crumbs) {
      if (!c.on) continue;
      c.age += dt;
      if (!c.afloat) {
        c.v[1] -= 1.6 * dt;
        for (let i = 0; i < 3; i++) c.p[i] += c.v[i] * dt;
        if (c.p[1] <= water.surface(c.p[0], c.p[2]) && water.isWet(c.p[0], c.p[2])) { c.afloat = true; water.addVolume(c.p[0], c.p[2], -0.00002, 0.02); }
        else if (c.p[1] < H(c.p[0], c.p[2])) c.on = false;   // fell on the bank
      } else {
        const fl = [0, 0]; water.flow(c.p[0], c.p[2], fl);
        c.p[0] += fl[0] * dt; c.p[2] += fl[1] * dt; c.p[1] = water.surface(c.p[0], c.p[2]);
        if (c.age > 40) c.on = false;
      }
    }
  }

  Lf.step = (dt) => {
    Lf.splashes = events.filter((e) => e.type === 'splash').map((e) => [e.x, e.z]);
    stepFish(dt); stepBirds(dt); stepHeron(dt); stepSheep(dt); stepCrumbs(dt);
  };

  // ----- posing -----
  Lf.pose = (buf, P, setPart, time) => {
    Lf.fish.forEach((f, i) => {
      if (f.gone > 0) { setPart(buf, P.fish[i], null); return; }
      const sp = Math.hypot(f.v[0], f.v[2]) || 1, X = [f.v[0] / sp, 0, f.v[2] / sp];
      setPart(buf, P.fish[i], A.basis(X, [0, 1, 0], [-X[2], 0, X[0]], f.p));
    });
    Lf.birds.forEach((b, i) => {
      const bob = Math.sin(time * 3 + i) * 0.0012, up = b.up > 0 ? Math.sin(Math.min(1, b.up * 1.4) * Math.PI) * 1.6 : 0;
      setPart(buf, P.birds[i], A.mul(A.t(b.p[0], b.p[1] + bob - 0.004, b.p[2]), A.ry(-b.yaw), A.rz(-up)));
    });
    const h = Lf.heron, flying = h.mode === 'fly';
    const base = A.mul(A.t(h.p[0], h.p[1] + (flying ? 0 : 0.09), h.p[2]), A.ry(-h.yaw), A.rz(flying ? -0.15 : 0.35));
    setPart(buf, P.heron.body, base);
    const stab = Math.sin(Math.min(1, h.stab) * Math.PI);
    setPart(buf, P.heron.neck, A.mul(base, A.t(0.022, 0.006, 0), A.rz(flying ? -1.1 : -0.45 - stab * 1.1)));
    const fl = flying ? Math.sin(h.flap) * 0.9 : -1.35, fold = flying ? 1 : 0.5;
    setPart(buf, P.heron.wingL, A.mul(base, A.t(0.006, 0.01, 0.004), A.rx(-fl), A.s(1, 1, fold)));
    setPart(buf, P.heron.wingR, A.mul(base, A.t(0.006, 0.01, -0.004), A.rx(fl), A.s(1, 1, fold)));
    Lf.sheep.forEach((s, i) => {
      const M = A.mul(A.t(s.p[0], H(s.p[0], s.p[1]) + 0.022, s.p[1]), A.ry(-s.yaw));
      setPart(buf, P.sheep[i][0], M);
      setPart(buf, P.sheep[i][1], A.mul(M, A.t(0.03, 0.022, 0), A.rz(-0.9 * s.graze + 0.08 * Math.sin(time * 3 + i) * s.graze)));
    });
    Lf.crumbs.forEach((c, i) => setPart(buf, P.crumbs[i], c.on ? A.t(...c.p) : null));
  };
  Lf.reset();
  return Lf;
}
