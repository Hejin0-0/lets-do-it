// Lock Jelly — the lock keeper: flat cap, navy jumper, cords, windlass in hand. An articulated figure (torso,
// head, upper arms, forearms, thighs, shins and the windlass are parts) driven by tasks: walk somewhere by a
// planned route round the bench, the pedestals, the bollards and whatever beam lies across the way; lean on a
// beam and walk it round backwards to swing a gate; wind a paddle with his arm circling the spindle; sit on
// the bench. Local frame: feet on the ground, facing +z (yaw turns +z toward +x).
import { A, MAT } from '../../core/diorama/parts.js';
import { L } from './layout.js';

const { ZC, XT, XB, TU, GATES, PADDLES, BEAM, BENCH, LAMP, BOLLARDS } = L;
// proportions
const HIP = 0.052, THIGH = 0.026, SHIN = 0.026, TORSO = 0.036, UARM = 0.021, FARM = 0.02, SHO = 0.0145, HIPW = 0.0072;
export const KEEPER_R = 0.022;

// ----- the model -----
export function buildKeeper(B) {
  const ids = {};
  const navy = '#1f2a44', cord = '#6b5636', skin = '#e2b08c', boot = '#1a1715';
  ids.torso = B.newPart();
  B.col(navy).mat(MAT.MATTE).at(A.t(0, 0.018, 0), () => B.ball(0.0125, 0.021, 0.0095, 1));
  B.at(A.t(0, 0.033, 0), () => B.ball(0.0135, 0.007, 0.009, 1));   // the shoulders
  B.col(cord).at(A.t(0, 0.002, 0), () => B.ball(0.0115, 0.006, 0.0088, 1));   // the seat of his cords
  ids.head = B.newPart();
  B.col(skin).at(A.t(0, 0.009, 0), () => B.ball(0.0085, 0.0095, 0.0085, 1));
  B.col(skin).at(A.t(0, 0.007, 0.0085), () => B.ball(0.0022, 0.0022, 0.002, 0));   // a nose
  B.col('#4a4038').at(A.t(0, 0.0155, -0.0005), () => B.ball(0.0094, 0.0035, 0.0098, 1));   // the flat cap
  B.at(A.t(0, 0.0145, 0.008), () => B.ball(0.0065, 0.0012, 0.005, 0));                   // its peak
  for (const s of [1, -1]) {
    ids[s > 0 ? 'uarmL' : 'uarmR'] = B.newPart();
    B.col(navy).at(A.t(0, -UARM / 2, 0), () => B.ball(0.0048, UARM / 2 + 0.002, 0.0048, 1));
    ids[s > 0 ? 'farmL' : 'farmR'] = B.newPart();
    B.col(navy).at(A.t(0, -FARM / 2 + 0.002, 0), () => B.ball(0.0042, FARM / 2, 0.0042, 1));
    B.col(skin).at(A.t(0, -FARM - 0.001, 0), () => B.ball(0.0035, 0.004, 0.003, 0));
    ids[s > 0 ? 'thighL' : 'thighR'] = B.newPart();
    B.col(cord).at(A.t(0, -THIGH / 2, 0), () => B.ball(0.0058, THIGH / 2 + 0.002, 0.006, 1));
    ids[s > 0 ? 'shinL' : 'shinR'] = B.newPart();
    B.col(cord).at(A.t(0, -SHIN / 2 + 0.002, 0), () => B.ball(0.0048, SHIN / 2, 0.005, 1));
    B.col(boot).mat(MAT.PAINT).at(A.t(0, -SHIN + 0.001, 0.003), () => B.ball(0.0048, 0.0035, 0.0078, 0));
    B.mat(MAT.MATTE);
  }
  ids.windlass = B.newPart();   // in its own frame: the socket on the spindle axis (−z), the crank along +x, the handle back along +z
  B.col('#5f6266').mat(MAT.METAL);
  B.slab(-0.003, -0.003, -0.012, 0.003, 0.003, 0);
  B.slab(0, -0.0018, -0.0035, 0.028, 0.0018, 0);
  B.at(A.mul(A.t(0.028, 0, -0.001), A.rx(Math.PI / 2)), () => B.cyl(0.0028, 0.014, 6));
  return ids;
}

// ----- the walkable ground round the lock, and routes across it -----
const GX0 = -1.45, GZ0 = 0.95, GS = 0.025, NX = 124, NZ = 52;
function staticBlocked(x, z) {
  if (L.terrainH(x, z) < TU - 0.06) return true;                                   // the water, the banks
  if (z > ZC - 0.05) return true;                                                   // the chamber's edge
  if (z > ZC - 0.1 && ((x > XT - 0.48 && x < XT + 0.03) || (x > XB - 0.48 && x < XB + 0.03))) return true;   // over the recesses
  if (x < XT - 0.48 && z > 1.95) return true;                                       // the pound's bank
  const pts = [...PADDLES.map((p) => [p.at[0], p.at[1], 0.035]), ...BOLLARDS.map((b) => [b[0], b[1], 0.03]), [LAMP[0], LAMP[1], 0.03], ...GATES.map((g) => [g.hinge[0], g.hinge[1], 0.04])];
  for (const [px, pz, r] of pts) if (Math.hypot(x - px, z - pz) < r + KEEPER_R) return true;
  if (Math.abs(x - BENCH.at[0]) < 0.1 + KEEPER_R && z > BENCH.at[1] - 0.035 - KEEPER_R && z < BENCH.at[1] + 0.03 + KEEPER_R) return true;   // the bench
  return false;
}
const STATIC = new Uint8Array(NX * NZ);
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) STATIC[j * NX + i] = staticBlocked(GX0 + (i + 0.5) * GS, GZ0 + (j + 0.5) * GS) ? 1 : 0;
/** Beams as segments (hinge to end) at the gates' current angles. */
export const beamSegs = (lock) => GATES.map((g, i) => { const d = L.beamDir(lock.gates[i].th); return [g.hinge, [g.hinge[0] + d[0] * BEAM, g.hinge[1] + d[1] * BEAM]]; });
/** Can the keeper stand here (given where the beams lie)? */
export function standable(x, z, segs) {
  const i = Math.floor((x - GX0) / GS), j = Math.floor((z - GZ0) / GS);
  if (i < 0 || j < 0 || i >= NX || j >= NZ || STATIC[j * NX + i]) return false;
  for (const [a, b] of segs) if (L.segDist(x, z, a, b) < 0.022 + KEEPER_R) return false;
  return true;
}
/** A* over the grid, then pulled straight where the way is clear. Returns [[x, z], ...] or null. */
export function planPath(from, to, segs) {
  const idx = (x, z) => [Math.min(NX - 1, Math.max(0, Math.floor((x - GX0) / GS))), Math.min(NZ - 1, Math.max(0, Math.floor((z - GZ0) / GS)))];
  const open = (i, j) => standable(GX0 + (i + 0.5) * GS, GZ0 + (j + 0.5) * GS, segs);
  const [si, sj] = idx(...from), [ti, tj] = idx(...to);
  const N = NX * NZ, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const s = sj * NX + si, t = tj * NX + ti;
  g[s] = 0; push(s, 0);
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === t) break;
    const i = k % NX, j = (k / NX) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const nk = nj * NX + ni;
      if (closed[nk] || (nk !== t && !open(ni, nj)) || (di && dj && (!open(i + di, j) || !open(i, j + dj)))) continue;
      const c = g[k] + (di && dj ? Math.SQRT2 : 1);
      if (c < g[nk]) { g[nk] = c; came[nk] = k; push(nk, c + Math.hypot(ni - ti, nj - tj)); }
    }
  }
  if (came[t] < 0 && s !== t) return null;
  const cells = [];
  for (let k = t; k >= 0; k = came[k]) { cells.push([GX0 + ((k % NX) + 0.5) * GS, GZ0 + (((k / NX) | 0) + 0.5) * GS]); if (k === s) break; }
  cells.reverse();
  cells[0] = from.slice(); cells[cells.length - 1] = to.slice();
  const clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.008); for (let q = 1; q < n; q++) { const u = q / n; if (!standable(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, segs)) return false; } return true; };
  const out = [cells[0]];
  for (let a = 0; a < cells.length - 1;) {
    let b = cells.length - 1;
    while (b > a + 1 && !clear(cells[a], cells[b])) b--;
    out.push(cells[b]); a = b;
  }
  return out;
}

// ----- where he stands for each job -----
const OPEN = Math.PI / 2, RC = BEAM - 0.03, OFF = 0.055;
/** The beam's motion direction as the gate opens (th rising). */
const moveDir = (th) => L.rot([Math.cos(th), Math.sin(th)], -L.BETA);
/** Where he stands to push gate i at angle th, facing away from the beam (his back on it). opening: the gate is opening. */
export function pushSpot(i, th, opening) {
  const g = GATES[i], d = L.beamDir(th), m = moveDir(th), s = opening ? -1 : 1;
  const p = [g.hinge[0] + d[0] * RC + m[0] * s * OFF, g.hinge[1] + d[1] * RC + m[1] * s * OFF];
  return { p, yaw: Math.atan2(m[0] * s, m[1] * s) };
}
export const windSpot = (k) => ({ p: [PADDLES[k].at[0] - 0.012, PADDLES[k].at[1] - 0.055], yaw: 0 });
export const benchSpot = () => ({ p: [BENCH.at[0], BENCH.at[1] + 0.05], yaw: 0 });

// ----- the keeper -----
export function createKeeper({ lock, events }) {
  const K = {
    p: benchSpot().p.slice(), yaw: 0, mode: 'stand', task: null, path: null, pi: 0,
    phase: 0, gaitV: 0, sit: 0, windA: 0, rate: 1, walked: 0,
  };
  const turnTo = (yaw, dt, w = 5) => { let d = yaw - K.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); K.yaw += Math.max(-w * dt, Math.min(w * dt, d)); return Math.abs(d) < 0.05; };
  /** Tasks: go (to a spot, facing its way), push (a gate open or shut), wind (a paddle up or down), rest (on the bench). */
  K.go = (spot) => { K.task = { type: 'go', spot }; K.path = null; };
  K.push = (i, opening) => { K.task = { type: 'push', i, opening }; };
  K.wind = (k, up) => { K.task = { type: 'wind', k, up, clicks: 0 }; };
  K.rest = () => { K.task = { type: 'sit' }; K.path = null; };
  K.busy = () => !!K.task && K.task.type !== 'sit';
  K.place = (p, yaw) => { K.p = p.slice(); K.yaw = yaw; K.task = null; K.path = null; K.sit = 0; K.mode = 'stand'; };

  function walk(dt, target, faceYaw) {   // along K.path; true when there and facing the right way
    if (!K.path) {
      K.path = planPath(K.p, target, beamSegs(lock)) || [K.p.slice(), target.slice()];
      K.pi = 1;
    }
    if (K.pi < K.path.length) {
      const q = K.path[K.pi], dx = q[0] - K.p[0], dz = q[1] - K.p[1], d = Math.hypot(dx, dz), v = 0.1 * K.rate;
      const facing = turnTo(Math.atan2(dx, dz), dt, 7);
      const step = Math.min(d, (facing || d < 0.01 ? v : v * 0.3) * dt);
      if (d > 1e-6) { K.p[0] += (dx / d) * step; K.p[1] += (dz / d) * step; }
      K.gaitV = step / dt; K.walked += step;
      if (d - step < 1e-4) K.pi++;
      return false;
    }
    K.gaitV = 0;
    return turnTo(faceYaw, dt, 5);
  }
  K.step = (dt) => {
    const T = K.task;
    K.gaitV = 0;
    if (!T) { K.sit = Math.max(0, K.sit - dt * 2); K.mode = 'stand'; }
    else if (T.type !== 'sit' && K.sit > 0) { K.sit = Math.max(0, K.sit - dt * 2 * K.rate); K.mode = 'sit'; }   // stand up first
    else if (T.type === 'go') {
      K.mode = 'walk';
      if (walk(dt, T.spot.p, T.spot.yaw)) { K.task = null; K.path = null; K.mode = 'stand'; }
    } else if (T.type === 'sit') {
      const s = benchSpot();
      if (K.sit === 0 && !T.there) { K.mode = 'walk'; if (walk(dt, s.p, s.yaw)) { T.there = true; K.path = null; } }
      else { K.mode = 'sit'; K.sit = Math.min(1, K.sit + dt * 1.5); }
    } else if (T.type === 'push') {
      K.mode = 'push';
      const G = lock.gates[T.i], w = 0.4 * K.rate, target = T.opening ? OPEN : 0;
      const th = T.opening ? Math.min(OPEN, G.th + w * dt) : Math.max(0, G.th - w * dt);
      if (lock.setGate(T.i, th) === th) {   // (across a step in the levels it will not move: he waits, leaning)
        if (!T.started) { T.started = true; events.push({ type: 'creak', gate: T.i }); }
        const s = pushSpot(T.i, th, T.opening);
        K.gaitV = -Math.hypot(s.p[0] - K.p[0], s.p[1] - K.p[1]) / dt;   // walking backwards
        K.p = s.p; K.yaw = s.yaw; K.walked += -K.gaitV * dt;
        if (th === target) { K.task = null; K.mode = 'stand'; if (!T.opening) events.push({ type: 'thud', gate: T.i }); }
      }
    } else if (T.type === 'wind') {
      K.mode = 'wind';
      const P = lock.paddles[T.k], rate = 0.45 * K.rate;
      P.open = T.up ? Math.min(1, P.open + rate * dt) : Math.max(0, P.open - rate * dt * 1.6);
      K.windA += (T.up ? 1 : -1) * 7 * K.rate * dt;
      const clicks = Math.floor(Math.abs(K.windA) / (Math.PI / 3));
      if (clicks !== T.clicks) { T.clicks = clicks; events.push({ type: 'ratchet', k: T.k }); }
      if ((T.up && P.open >= 1) || (!T.up && P.open <= 0)) { K.task = null; K.mode = 'stand'; }
    }
    K.phase += (K.gaitV / 0.05) * Math.PI * dt;
  };

  // ----- posing -----
  K.pose = (buf, ids, setPart, time) => {
    const ground = TU, v = K.gaitV, ph = K.phase, walking = Math.min(1, Math.abs(v) / 0.03);
    const swing = 0.5 * Math.sin(ph) * walking, bob = 0.0012 * Math.abs(Math.cos(ph)) * walking;
    let lean = 0.06 * walking, arms = [-swing * 0.8, swing * 0.8], elbows = [-0.35, -0.35], abd = [0.12, 0.12];
    let thighs = [swing, -swing], knees = [Math.max(0, Math.sin(ph + 1.3)) * 0.7 * walking, Math.max(0, -Math.sin(ph + 1.3)) * 0.7 * walking];
    let hipY = HIP + bob, base = [K.p[0], ground, K.p[1]], head = 0;
    if (K.mode === 'push') { lean = -0.32; arms = [-0.9 - swing * 0.1, -0.9 + swing * 0.1]; elbows = [-1.4, -1.4]; abd = [0.35, 0.35]; }   // leaning back on the beam
    if (K.mode === 'wind') { lean = 0.18; head = 0.25; }
    const s = K.sit;
    if (s > 0) {   // sitting down onto the bench: hips back and down, thighs forward, shins down
      const e = s * s * (3 - 2 * s), seat = [BENCH.at[0], ground + 0.036, BENCH.at[1] - 0.004];
      base = [K.p[0] + (seat[0] - K.p[0]) * e, ground, K.p[1] + (seat[2] - K.p[1]) * e];
      hipY = HIP + (seat[1] - ground + 0.004 - HIP) * e;
      thighs = [1.45 * e, 1.45 * e]; knees = [1.45 * e, 1.45 * e]; lean = -0.08 * e;
      arms = [0.55 * e, 0.55 * e]; elbows = [-0.9 * e, -0.9 * e]; abd = [0.1, 0.1];
      head = 0.08 * Math.sin(time * 0.4) * e;
    } else if (walking < 0.05 && K.mode !== 'push' && K.mode !== 'wind') {
      arms = [0.04 * Math.sin(time * 1.3), 0.04 * Math.sin(time * 1.3 + 1)]; head = 0.05 * Math.sin(time * 0.5);
    }
    const pelvis = A.mul(A.t(base[0], base[1], base[2]), A.ry(K.yaw), A.t(0, hipY, 0));
    const torso = A.mul(pelvis, A.rx(lean));
    setPart(buf, ids.torso, torso);
    setPart(buf, ids.head, A.mul(torso, A.t(0, TORSO + 0.004, 0.001), A.rx(head)));
    const hands = [];
    [1, -1].forEach((sd, k) => {
      const sh = A.mul(torso, A.t(sd * SHO, TORSO - 0.004, 0));
      let ua, fa;
      if (K.mode === 'wind' && sd < 0 && s === 0) [ua, fa] = reach(sh, A.apply(windlassMatrix(), [0.028, 0, 0.004]));   // the winding arm, circling the spindle
      else {
        ua = A.mul(sh, A.rx(-arms[k]), A.rz(sd * abd[k]));
        fa = A.mul(ua, A.t(0, -UARM, 0), A.rx(elbows[k]));
      }
      setPart(buf, ids[sd > 0 ? 'uarmL' : 'uarmR'], ua);
      setPart(buf, ids[sd > 0 ? 'farmL' : 'farmR'], fa);
      hands.push(fa);
      const th = A.mul(pelvis, A.t(sd * HIPW, 0, 0), A.rx(-thighs[k]));
      setPart(buf, ids[sd > 0 ? 'thighL' : 'thighR'], th);
      setPart(buf, ids[sd > 0 ? 'shinL' : 'shinR'], A.mul(th, A.t(0, -THIGH, 0), A.rx(knees[k])));
    });
    // the windlass: on the spindle while winding, else in his right hand
    if (K.mode === 'wind' && s === 0) setPart(buf, ids.windlass, windlassMatrix());
    else setPart(buf, ids.windlass, A.mul(hands[1], A.t(0, -FARM - 0.002, 0), A.rx(Math.PI / 2), A.rz(-Math.PI / 2), A.t(-0.028, 0, 0.004)));
  };
  function windlassMatrix() {
    const P = PADDLES[K.task && K.task.type === 'wind' ? K.task.k : 0];
    return A.mul(A.t(P.at[0], TU + 0.042, P.at[1] - 0.026), A.rz(K.windA));
  }
  /** Two-bone reach from the shoulder frame to a point: the upper arm's and the forearm's transforms. */
  function reach(sh, target) {
    const S = A.apply(sh, [0, 0, 0]), D = [target[0] - S[0], target[1] - S[1], target[2] - S[2]], dl = Math.hypot(...D) || 1;
    const d = Math.min(UARM + FARM - 1e-4, dl), dir = D.map((x) => x / dl);
    const a = Math.acos(Math.max(-1, Math.min(1, (UARM * UARM + d * d - FARM * FARM) / (2 * UARM * d))));
    const right = A.dir(sh, [-1, 0, 0]);   // the elbow bends out to his right and down
    let pole = [right[0], right[1] - 0.6, right[2]];
    const pd = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2];
    pole = pole.map((x, i) => x - pd * dir[i]); const pl = Math.hypot(...pole) || 1; pole = pole.map((x) => x / pl);
    const E = [0, 1, 2].map((i) => S[i] + (dir[i] * Math.cos(a) + pole[i] * Math.sin(a)) * UARM);
    const along = (from, to) => {   // a frame whose −y runs from `from` toward `to`
      const y = [from[0] - to[0], from[1] - to[1], from[2] - to[2]], yl = Math.hypot(...y) || 1, Y = y.map((x) => x / yl);
      let X = [Y[1] * pole[2] - Y[2] * pole[1], Y[2] * pole[0] - Y[0] * pole[2], Y[0] * pole[1] - Y[1] * pole[0]]; const xl = Math.hypot(...X) || 1; X = X.map((x) => x / xl);
      const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
      return A.basis(X, Y, Z, from);
    };
    return [along(S, E), along(E, target)];
  }
  return K;
}
