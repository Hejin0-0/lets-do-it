// Iceberg Jelly — life in the bay. 22 Adélie penguins stand on their nests and look about, now and then throw
// an ecstatic display, waddle or toboggan down to the beach, dive in, fly underwater with beating flippers,
// porpoise, leap out onto floes and bergs (and slide off when one tips), chase silverfish and thrown fish, and
// keep clear of the orca. Three Weddell seals haul out on the skerry and on floes, lift their heads and go for
// swims. The orca patrols deep water, surfaces to blow and dives. Schools of silverfish; snow falls.
import { A, MAT } from '@lid/diorama/parts.js';
import { I } from './layout.js';

const H = I.terrainH, TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const N_PENG = 22, N_SEAL = 3, N_SILVER = 36, N_FISH = 8, N_SNOW = 160;
const PS = 1.4;   // the penguins drawn larger than the model, to read at the block's scale

// ----- models (forward +x, up +y) -----
function penguinBody(B) {   // standing 0.046 tall; blue-black back, white shirt front, white eye rings, pink feet
  B.col('#1c2230').mat(MAT.GLOSS).at(A.t(-0.002, 0.02, 0), () => B.ball(0.011, 0.02, 0.0105, 1));
  B.col('#f4f4f0').mat(MAT.MATTE).at(A.t(0.0035, 0.018, 0), () => B.ball(0.0085, 0.017, 0.009, 1));
  B.col('#1c2230').mat(MAT.GLOSS).at(A.t(0.0005, 0.038, 0), () => B.ball(0.0075, 0.0075, 0.007, 1));
  B.col('#f8f8f4').mat(MAT.MATTE);
  for (const s of [-1, 1]) B.at(A.t(0.0045, 0.0395, s * 0.0052), () => B.ball(0.0022, 0.0022, 0.0012, 0));
  B.col('#2a2420').at(A.t(0.008, 0.0375, 0), () => B.ball(0.0045, 0.0016, 0.0016, 0));
  B.col('#e8909a');
  for (const s of [-1, 1]) B.at(A.t(0.003, 0.0006, s * 0.004), () => B.ball(0.0045, 0.0012, 0.0025, 0));
}
function penguinFlipper(B, s) { B.col('#1c2230').mat(MAT.GLOSS).at(A.t(0, -0.008, s * 0.001), () => B.ball(0.0035, 0.0095, 0.0012, 0)); }
// a Weddell seal's body: one smooth spindle, plump behind the shoulders (radius by distance along it, tail to neck)
const SEAL = [[-0.05, 0], [-0.048, 0.006], [-0.04, 0.011], [-0.025, 0.016], [-0.008, 0.019], [0.01, 0.0185], [0.025, 0.016], [0.037, 0.012], [0.044, 0.007], [0.046, 0]];
const SEAL_FLAT = 0.8, SEAL_Y = 0.019 * SEAL_FLAT;   // lying on its belly: a little flattened, resting on the ground
const sealR = (x) => { for (let i = 1; i < SEAL.length; i++) if (x <= SEAL[i][0]) { const [x0, r0] = SEAL[i - 1], [x1, r1] = SEAL[i]; return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0); } return 0; };
function sealBody(B) {   // a spotted grey Weddell seal lying along +x
  B.col('#7a8088').mat(MAT.GLOSS).at(A.mul(A.t(0, SEAL_Y, 0), A.s(1, SEAL_FLAT, 1.05), A.rz(-Math.PI / 2)), () => B.lathe(SEAL.map(([x, r]) => [r, x]), 14));
  B.col('#4a5058');   // dark spots on its back and flanks, on the skin
  const R = I.rng(77);
  for (let k = 0; k < 16; k++) {
    const x = -0.038 + R() * 0.07, th = (R() - 0.5) * 2.4, r = sealR(x) * 0.93;   // (sunk into the skin: patches, not warts)
    B.at(A.t(x, SEAL_Y + Math.cos(th) * r * SEAL_FLAT, Math.sin(th) * r * 1.05), () => B.ball(0.0034, 0.0022, 0.0032, 0));
  }
  B.col('#6a7078').at(A.mul(A.t(-0.058, 0.006, 0), A.ry(Math.PI / 2)), () => B.prism([[-0.012, 0], [0.012, 0], [0, 0.004]], 0.012));   // the hind flippers
}
function sealHead(B) { B.col('#80868e').mat(MAT.GLOSS).at(A.t(0.012, 0, 0), () => B.ball(0.012, 0.01, 0.0105, 1)); B.col('#141414'); for (const s of [-1, 1]) B.at(A.t(0.019, 0.004, s * 0.006), () => B.ball(0.0018, 0.0018, 0.0012, 0)); }
function orcaBody(B) {   // black, a white eye patch and belly, a grey saddle, a tall dorsal fin
  B.col('#121316').mat(MAT.GLOSS).ball(0.15, 0.04, 0.045, 2);
  B.col('#f2f2ee').at(A.t(0.06, -0.012, 0), () => B.ball(0.09, 0.025, 0.03, 1));
  for (const s of [-1, 1]) B.at(A.t(0.11, 0.012, s * 0.03), () => B.ball(0.018, 0.008, 0.016, 1));
  B.col('#8a8e94').at(A.t(-0.03, 0.03, 0), () => B.ball(0.03, 0.012, 0.03, 1));
  B.col('#121316').at(A.mul(A.t(0.0, 0.03, 0), A.ry(Math.PI / 2)), () => B.prism([[-0.022, 0], [0.018, 0], [0.006, 0.075], [0.0, 0.07]], 0.008));
  for (const s of [-1, 1]) B.at(A.mul(A.t(0.06, -0.03, s * 0.04), A.rx(s * 0.6)), () => B.ball(0.025, 0.004, 0.014, 0));
}
function orcaTail(B) { B.col('#121316').mat(MAT.GLOSS).at(A.t(-0.03, 0, 0), () => B.ball(0.035, 0.016, 0.018, 1)); B.at(A.t(-0.07, 0, 0), () => B.ball(0.018, 0.004, 0.045, 1)); }
function silverfish(B) { B.col('#c8d0d6').mat(MAT.FISH).ball(0.012, 0.0028, 0.002, 0); B.sheet(2, 2, (i, j) => [-0.012 - i * 0.004, (j - 0.5) * 0.004 * (1 + i), 0]); }
function flake(B) { B.col('#ffffff').mat(MAT.GLOW).ball(0.0035, 0.0035, 0.0035, 0); }

/** Build the creatures' parts into parts.life. */
export function buildLife(B, parts) {
  const P = { peng: [], seal: [], silver: [], fish: [], snow: [] };
  for (let i = 0; i < N_PENG; i++) { const b = B.newPart(); penguinBody(B); const l = B.newPart(); penguinFlipper(B, 1); const r = B.newPart(); penguinFlipper(B, -1); P.peng.push([b, l, r]); }
  for (let i = 0; i < N_SEAL; i++) { const b = B.newPart(); sealBody(B); const h = B.newPart(); sealHead(B); P.seal.push([b, h]); }
  P.orca = [B.newPart(), 0]; orcaBody(B); P.orca[1] = B.newPart(); orcaTail(B);
  for (let i = 0; i < N_SILVER; i++) { P.silver.push(B.newPart()); silverfish(B); }
  for (let i = 0; i < N_FISH; i++) { P.fish.push(B.newPart()); B.at(A.s(1.8), () => silverfish(B)); }
  for (let i = 0; i < N_SNOW; i++) { P.snow.push(B.newPart()); flake(B); }
  parts.life = P;
}

/** o: { water, ice, floaters, rand, events, puff } */
export function createLife({ water, ice, floaters: F, rand: R, events, puff }) {
  const Lf = { peng: [], seal: [], silver: [], fish: [], snow: [], fed: 0, orca: null, snowfall: 0.35 };
  const surf = (x, z) => water.surface(x, z), floor = (x, z) => H(x, z);
  const deep = (x, z, d = 0.08) => water.isWet(x, z) && surf(x, z) - floor(x, z) > d && Math.abs(x) < I.HALF - 0.05 && Math.abs(z) < I.HALF - 0.05;
  // the highest point of an ice piece (where a penguin or a seal stands), and its tilt
  const TOPS = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  function iceTop(p) {
    const b = p.body, o = F.origin(b), M = b.Rm;
    let best = null;
    for (const d of TOPS) { const r = b.rad * 0.55, l = [d[0] * r, d[1] * r * 0.6, d[2] * r * 0.6]; const w = [o[0] + M[0] * l[0] + M[1] * l[1] + M[2] * l[2], o[1] + M[3] * l[0] + M[4] * l[1] + M[5] * l[2], o[2] + M[6] * l[0] + M[7] * l[1] + M[8] * l[2]]; if (!best || w[1] > best[1]) best = w; }
    return [b.p[0], Math.max(best[1], b.p[1] + 0.01), b.p[2]];
  }
  const tilt = (p) => F.up(p.body)[1];
  const riders = (p) => p.kind !== 'growler' && p.body.state !== 'held';
  const toLocal = (p, w) => { const b = p.body, o = F.origin(b), M = b.Rm, d = [w[0] - o[0], w[1] - o[1], w[2] - o[2]]; return [M[0] * d[0] + M[3] * d[1] + M[6] * d[2], M[1] * d[0] + M[4] * d[1] + M[7] * d[2], M[2] * d[0] + M[5] * d[1] + M[8] * d[2]]; };
  const toWorld = (p, l) => { const b = p.body, o = F.origin(b), M = b.Rm; return [o[0] + M[0] * l[0] + M[1] * l[1] + M[2] * l[2], o[1] + M[3] * l[0] + M[4] * l[1] + M[5] * l[2], o[2] + M[6] * l[0] + M[7] * l[1] + M[8] * l[2]]; };

  function spawnSilver(f) {
    for (let t = 0; t < 100; t++) {
      const x = (R() * 2 - 1) * 2.2, z = -0.2 + R() * 2.6;
      if (!deep(x, z, 0.25)) continue;
      return Object.assign(f, { p: [x, floor(x, z) + 0.08 + R() * 0.15, z], v: [(R() - 0.5) * 0.1, 0, (R() - 0.5) * 0.1] });
    }
    return Object.assign(f, { p: [0.5, I.SL - 0.2, 1.2], v: [0.05, 0, 0] });
  }
  Lf.reset = () => {
    Lf.peng = I.NESTS.slice(0, N_PENG).map((n, i) => ({ i, nest: n, mode: 'nest', p: [n[0], H(n[0], n[1]), n[1]], v: [0, 0, 0], yaw: R() * TAU, t: 3 + R() * 25, look: 0, ecst: 0, flap: R() * 9, ride: null, local: null, target: null, toboggan: 0, porp: 0, pv: 0, home: false }));
    Lf.seal = [0, 1, 2].map((i) => { const s = I.SKERRY[i % 2]; return { mode: 'haul', p: [s[0] + (i === 2 ? 0.05 : 0), 1.075, s[1] + (i === 2 ? -0.06 : 0)], yaw: R() * TAU, t: 10 + R() * 30, lift: 0, liftT: R() * 5, ride: null, local: null }; });
    Lf.orca = { a: 0, p: [0.6, I.SL - 0.14, 1.3], yaw: 0, t: 8, rise: 0, beat: 0 };
    Lf.silver = Array.from({ length: N_SILVER }, (_, i) => spawnSilver({ g: i % 3 }));
    Lf.fish = Array.from({ length: N_FISH }, () => ({ on: false }));
    Lf.snow = Array.from({ length: N_SNOW }, () => ({ p: [(R() * 2 - 1) * I.HALF, 1.0 + R() * 1.6, (R() * 2 - 1) * I.HALF], ph: R() * TAU }));
    Lf.fed = 0;
  };

  // ----- penguins -----
  const BEACH = I.BEACH;
  const plop = (q) => events.push({ type: 'plop', x: q.p[0], z: q.p[2] });
  function stepPenguin(q, dt) {
    q.flap += dt * (q.mode === 'swim' ? 14 : 3);
    const o = Lf.orca;
    if (q.mode === 'nest') {
      q.look = Math.sin(q.flap * 0.4 + q.i) * 0.6;
      if (q.ecst > 0) q.ecst = Math.max(0, q.ecst - dt / 2.2);
      else if (R() < dt / 40) { q.ecst = 1; events.push({ type: 'bray', x: q.p[0], z: q.p[2] }); }
      if ((q.t -= dt) < 0) { q.mode = 'walk'; q.target = [BEACH[0] + (R() - 0.5) * 0.15, BEACH[1] + (R() - 0.5) * 0.2]; q.toboggan = R() < 0.5 ? 1 : 0; }
      return;
    }
    if (q.mode === 'walk') {   // waddle (or toboggan) to the target on land
      const dx = q.target[0] - q.p[0], dz = q.target[1] - q.p[2], d = Math.hypot(dx, dz), sp = q.toboggan ? 0.07 : 0.035;
      q.yaw += wrap(Math.atan2(dz, dx) - q.yaw) * Math.min(1, dt * 4);
      if (d > 0.01) { q.p[0] += (dx / d) * Math.min(d, sp * dt); q.p[2] += (dz / d) * Math.min(d, sp * dt); }
      q.p[1] = H(q.p[0], q.p[2]);
      if (d < 0.015) {
        if (q.home) { q.mode = 'nest'; q.home = false; q.t = 20 + R() * 40; q.toboggan = 0; q.yaw = R() * TAU; }
        else { q.mode = 'hop'; q.v = [Math.cos(q.yaw) * 0.25, 0.35, Math.sin(q.yaw) * 0.25]; q.toboggan = 0; }
      }
      return;
    }
    if (q.mode === 'hop') {   // a dive in: a short arc into the water
      q.v[1] -= 1.6 * dt; for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
      if (q.p[1] < surf(q.p[0], q.p[2]) && water.isWet(q.p[0], q.p[2])) { q.mode = 'swim'; q.t = 25 + R() * 35; plop(q); water.addVolume(q.p[0], q.p[2], -0.00004, 0.02); }
      else if (q.p[1] < H(q.p[0], q.p[2])) { q.p[1] = H(q.p[0], q.p[2]); q.mode = 'walk'; q.target = [q.p[0] + Math.cos(q.yaw) * 0.08, q.p[2] + Math.sin(q.yaw) * 0.08]; }
      return;
    }
    if (q.mode === 'ride') {   // standing on a floe or a berg; when it tips, off it slides
      const p = q.ride;
      if (!ice.pieces.includes(p) || tilt(p) < 0.9 || p.body.state === 'held') { q.mode = 'swim'; q.ride = null; q.v = [Math.cos(q.yaw) * 0.12, -0.05, Math.sin(q.yaw) * 0.12]; q.t = 15 + R() * 20; plop(q); return; }
      q.p = toWorld(p, q.local);
      q.look = Math.sin(q.flap * 0.5) * 0.5;
      if ((q.t -= dt) < 0) { q.mode = 'swim'; q.ride = null; q.v = [Math.cos(q.yaw) * 0.15, 0.1, Math.sin(q.yaw) * 0.15]; q.t = 15 + R() * 20; plop(q); }
      return;
    }
    if (q.mode === 'leap') {   // out of the water and onto a floe
      q.v[1] -= 1.6 * dt; for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
      if (!ice.pieces.includes(q.ride)) { q.mode = 'swim'; q.ride = null; return; }
      const top = iceTop(q.ride);
      if (q.v[1] < 0 && q.p[1] <= top[1] + 0.005) { q.local = toLocal(q.ride, top); q.mode = 'ride'; q.t = 10 + R() * 25; }
      else if (q.p[1] < surf(q.p[0], q.p[2]) - 0.05) { q.mode = 'swim'; q.ride = null; }
      return;
    }
    // swimming: flying underwater with beating flippers; chasing fish; clear of the orca; porpoising; hauling out
    let ty = q.yaw, sp = 0.13, ay = 0;
    const flee = Math.hypot(q.p[0] - o.p[0], q.p[2] - o.p[2]) < 0.55;
    let prey = null, pd = 0.6;
    for (const f of Lf.fish) if (f.on && f.wet) { const d = Math.hypot(f.p[0] - q.p[0], f.p[2] - q.p[2]); if (d < pd + 0.4) { pd = d; prey = f; } }
    if (!prey) for (const f of Lf.silver) { const d = Math.hypot(f.p[0] - q.p[0], f.p[2] - q.p[2]); if (d < pd) { pd = d; prey = f; } }
    if (flee) { ty = Math.atan2(q.p[2] - o.p[2], q.p[0] - o.p[0]); sp = 0.24; }
    else if (prey) {
      ty = Math.atan2(prey.p[2] - q.p[2], prey.p[0] - q.p[0]); sp = 0.18; ay = (prey.p[1] - q.p[1]) * 2;
      if (pd < 0.035 && Math.abs(prey.p[1] - q.p[1]) < 0.04) { if (prey.wet !== undefined) { prey.on = false; Lf.fed++; events.push({ type: 'gulp', x: q.p[0], z: q.p[2] }); } else spawnSilver(prey); }
    } else ty += Math.sin(q.flap * 0.05 + q.i) * 0.04;
    if (!deep(q.p[0] + Math.cos(ty) * 0.1, q.p[2] + Math.sin(ty) * 0.1, 0.05)) ty += 1.8;
    q.yaw += wrap(ty - q.yaw) * Math.min(1, dt * (prey && !flee && pd < 0.2 ? 8 : 3));   // tight turns at the kill
    const s = surf(q.p[0], q.p[2]), f0 = floor(q.p[0], q.p[2]);
    q.v = [Math.cos(q.yaw) * sp, prey && !flee ? ay * 1.5 : (s - 0.05 - q.p[1]) * 0.6, Math.sin(q.yaw) * sp];
    if (q.porp > 0) {   // porpoising: a leap clear of the water
      q.porp -= dt; q.pv -= 1.6 * dt; q.p[1] += q.pv * dt; q.p[0] += q.v[0] * dt; q.p[2] += q.v[2] * dt;
      if (q.p[1] < s - 0.02 && q.pv < 0) { q.porp = 0; plop(q); }
    } else {
      for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
      q.p[1] = Math.max(f0 + 0.015, Math.min(s - 0.012, q.p[1]));
      if (!flee && !prey && R() < dt / 6) { q.porp = 1.2; q.pv = 0.45; q.p[1] = s - 0.01; }
    }
    if (!deep(q.p[0], q.p[2], 0.03)) { q.p[0] -= Math.cos(q.yaw) * sp * dt * 2; q.p[2] -= Math.sin(q.yaw) * sp * dt * 2; }
    q.t -= dt;
    if (!flee && q.porp <= 0 && R() < dt / 12) {   // a floe or a berg near enough to leap onto
      const p = ice.pieces.find((p) => riders(p) && tilt(p) > 0.95 && Math.hypot(p.body.p[0] - q.p[0], p.body.p[2] - q.p[2]) < 0.35);
      if (p) { const top = iceTop(p), T = 0.6; q.mode = 'leap'; q.ride = p; q.p[1] = s; q.v = [(top[0] - q.p[0]) / T, (top[1] - q.p[1]) / T + 0.8 * T, (top[2] - q.p[2]) / T]; q.yaw = Math.atan2(q.v[2], q.v[0]); plop(q); return; }
    }
    if (q.t < 0) {   // home: to the beach, out, and up to the nest
      const dx = BEACH[0] - q.p[0], dz = BEACH[1] + 0.25 - q.p[2];
      q.yaw += wrap(Math.atan2(dz, dx) - q.yaw) * Math.min(1, dt * 3);
      if (Math.hypot(dx, dz) < 0.22) { q.mode = 'walk'; q.home = true; q.target = q.nest; q.p[1] = H(q.p[0], q.p[2]); }
    }
  }

  // ----- seals -----
  function stepSeal(s, dt) {
    if ((s.liftT -= dt) < 0) { s.lift = 1; s.liftT = 4 + R() * 8; }
    s.lift = Math.max(0, s.lift - dt / 2.5);
    if (s.mode === 'haul') {
      if (s.ride) {
        if (!ice.pieces.includes(s.ride) || tilt(s.ride) < 0.85) { s.mode = 'swim'; s.ride = null; s.t = 15 + R() * 20; return; }
        s.p = toWorld(s.ride, s.local);
      }
      if ((s.t -= dt) < 0) { s.mode = 'swim'; s.ride = null; s.t = 18 + R() * 25; s.p[1] = I.SL - 0.04; plop(s); }
      return;
    }
    s.yaw += Math.sin(s.t * 0.7) * dt * 0.8;
    if (!deep(s.p[0] + Math.cos(s.yaw) * 0.15, s.p[2] + Math.sin(s.yaw) * 0.15, 0.08)) s.yaw += 2;
    s.p[0] += Math.cos(s.yaw) * 0.07 * dt; s.p[2] += Math.sin(s.yaw) * 0.07 * dt;
    s.p[1] = Math.max(floor(s.p[0], s.p[2]) + 0.02, surf(s.p[0], s.p[2]) - 0.03 - 0.06 * (0.5 + 0.5 * Math.sin(s.t * 0.9)));
    if ((s.t -= dt) < 0) {   // haul out: on a big floe nearby, or back on the skerry
      const p = ice.pieces.find((p) => riders(p) && (p.kind === 'tabular' || p.kind === 'pancake') && tilt(p) > 0.95 && Math.hypot(p.body.p[0] - s.p[0], p.body.p[2] - s.p[2]) < 0.6);
      if (p) { s.ride = p; s.local = toLocal(p, iceTop(p)); }
      else { const k = I.SKERRY[(R() * 2) | 0]; s.p = [k[0] + (R() - 0.5) * 0.06, 1.075, k[1] + (R() - 0.5) * 0.06]; }
      s.mode = 'haul'; s.t = 20 + R() * 30;
    }
  }

  // ----- the orca: a patrol round the deep water, up to blow now and then -----
  function stepOrca(dt) {
    const o = Lf.orca;
    o.a += dt * 0.12;
    const tx = 0.4 + Math.cos(o.a) * 1.15, tz = 1.0 + Math.sin(o.a * 1.3) * 0.75;
    o.yaw += wrap(Math.atan2(tz - o.p[2], tx - o.p[0]) - o.yaw) * Math.min(1, dt * 1.5);
    o.p[0] += Math.cos(o.yaw) * 0.12 * dt; o.p[2] += Math.sin(o.yaw) * 0.12 * dt;
    o.beat += dt * 4;
    if ((o.t -= dt) < 0) { o.t = 14 + R() * 10; o.rise = 1; }
    if (o.rise > 0) {
      const was = o.rise;
      o.rise = Math.max(0, o.rise - dt / 4);
      if (was >= 0.5 && o.rise < 0.5) { for (let i = 0; i < 6; i++) puff([o.p[0] + Math.cos(o.yaw) * 0.08, I.SL + 0.03, o.p[2] + Math.sin(o.yaw) * 0.08], 'blow'); events.push({ type: 'blow', x: o.p[0], z: o.p[2] }); }
      o.p[1] = surf(o.p[0], o.p[2]) - 0.025 - 0.13 * (1 - Math.sin(o.rise * Math.PI));
    } else o.p[1] += (Math.max(floor(o.p[0], o.p[2]) + 0.08, I.SL - 0.17) - o.p[1]) * Math.min(1, dt);
  }

  // ----- silverfish schools, thrown fish, snow -----
  function stepSilver(dt) {
    for (const f of Lf.silver) {
      let n = 0, cx = 0, cz = 0, vx = 0, vz = 0;
      for (const g of Lf.silver) {
        if (g === f || g.g !== f.g) continue;
        const d = Math.hypot(g.p[0] - f.p[0], g.p[2] - f.p[2]);
        if (d < 0.2) { n++; cx += g.p[0]; cz += g.p[2]; vx += g.v[0]; vz += g.v[2]; if (d < 0.025 && d > 1e-6) { f.v[0] -= ((g.p[0] - f.p[0]) / d) * 0.04; f.v[2] -= ((g.p[2] - f.p[2]) / d) * 0.04; } }
      }
      if (n) { f.v[0] += ((cx / n - f.p[0]) * 0.4 + (vx / n - f.v[0]) * 0.6) * dt; f.v[2] += ((cz / n - f.p[2]) * 0.4 + (vz / n - f.v[2]) * 0.6) * dt; }
      f.v[0] += (R() - 0.5) * 0.08 * dt; f.v[2] += (R() - 0.5) * 0.08 * dt;
      for (const q of Lf.peng) if (q.mode === 'swim') { const dx = f.p[0] - q.p[0], dz = f.p[2] - q.p[2], d = Math.hypot(dx, dz); if (d < 0.12 && d > 1e-6) { f.v[0] += (dx / d) * 0.5 * dt; f.v[2] += (dz / d) * 0.5 * dt; } }
      const sp = Math.hypot(f.v[0], f.v[2]), k = sp > 0.09 ? 0.09 / sp : sp < 0.03 ? 0.03 / (sp + 1e-6) : 1;
      f.v[0] *= k; f.v[2] *= k;
      if (!deep(f.p[0] + f.v[0] * 0.6, f.p[2] + f.v[2] * 0.6, 0.15)) { f.v[0] = -f.v[0]; f.v[2] = -f.v[2]; }
      f.p[0] += f.v[0] * dt; f.p[2] += f.v[2] * dt;
      f.p[1] = Math.max(floor(f.p[0], f.p[2]) + 0.03, Math.min(surf(f.p[0], f.p[2]) - 0.04, f.p[1] + Math.sin(f.p[0] * 3 + f.g) * 0.01 * dt));
    }
  }
  /** A fish thrown from the quay toward the penguins in the water (or off the beach). Returns true if one flew. */
  Lf.throwFish = () => {
    const f = Lf.fish.find((x) => !x.on);
    if (!f) return false;
    const sw = Lf.peng.filter((q) => q.mode === 'swim');
    const t = sw.length ? sw[(R() * sw.length) | 0].p : [BEACH[0] - 0.25 + (R() - 0.5) * 0.2, 0, BEACH[1] + 0.35];
    const from = [1.0 + R() * 0.6, I.QUAY.deck + 0.08, I.QUAY.z], T = 0.9;
    Object.assign(f, { on: true, wet: false, p: from.slice(), v: [(t[0] - from[0]) / T, (I.SL - from[1]) / T + 0.8 * T, (t[2] - from[2]) / T], age: 0 });
    if (!sw.length) for (const q of Lf.peng) if (q.mode === 'nest' && R() < 0.3) q.t = Math.min(q.t, R() * 3);   // the rookery takes notice
    return true;
  };
  function stepFish(dt) {
    for (const f of Lf.fish) {
      if (!f.on) continue;
      f.age += dt;
      if (!f.wet) {
        f.v[1] -= 1.6 * dt; for (let k = 0; k < 3; k++) f.p[k] += f.v[k] * dt;
        if (f.p[1] < surf(f.p[0], f.p[2]) && water.isWet(f.p[0], f.p[2])) { f.wet = true; events.push({ type: 'plop', x: f.p[0], z: f.p[2] }); }
        else if (f.p[1] < H(f.p[0], f.p[2])) f.on = false;
      } else { f.p[1] = Math.max(floor(f.p[0], f.p[2]) + 0.02, f.p[1] - 0.02 * dt); if (f.age > 40) f.on = false; }
    }
  }
  function stepSnow(dt) {
    const n = Math.round(N_SNOW * Lf.snowfall);
    Lf.snow.forEach((s, i) => {
      if (i >= n) return;
      s.p[1] -= 0.07 * dt; s.p[0] += (0.025 + 0.02 * Math.sin(s.ph + s.p[1] * 6)) * dt; s.p[2] += 0.015 * Math.cos(s.ph * 1.3 + s.p[1] * 5) * dt;
      if (s.p[1] < Math.max(H(s.p[0], s.p[2]), water.surface(s.p[0], s.p[2])) || Math.abs(s.p[0]) > I.HALF) s.p = [(R() * 2 - 1) * I.HALF, 2.0 + R() * 0.6, (R() * 2 - 1) * I.HALF];
    });
  }
  Lf.step = (dt) => {
    for (const q of Lf.peng) stepPenguin(q, dt);
    for (const s of Lf.seal) stepSeal(s, dt);
    stepOrca(dt); stepSilver(dt); stepFish(dt); stepSnow(dt);
  };

  // ----- posing -----
  Lf.pose = (buf, P, setPart) => {
    Lf.peng.forEach((q, i) => {
      const [bp, lp, rp] = P.peng[i];
      let M, fl = 0.3;
      if (q.mode === 'swim' || q.mode === 'leap' || (q.mode === 'hop' && q.p[1] < surf(q.p[0], q.p[2]))) {   // flying underwater: along the way, flippers beating
        const pitch = q.porp > 0 ? Math.atan2(q.pv, 0.13) : Math.atan2(q.v[1], 0.13);
        M = A.mul(A.t(...q.p), A.ry(-q.yaw), A.rz(-Math.PI / 2 + pitch), A.s(PS), A.t(0, -0.02, 0));
        fl = 0.9 + Math.sin(q.flap) * 0.9;
      } else if (q.toboggan && q.mode === 'walk') {   // tobogganing on its belly
        M = A.mul(A.t(q.p[0], q.p[1] + 0.009 * PS, q.p[2]), A.ry(-q.yaw), A.rz(-Math.PI / 2 + 0.15), A.s(PS), A.t(0, -0.02, 0));
        fl = 1.2 + Math.sin(q.flap * 3) * 0.4;
      } else {
        const wad = q.mode === 'walk' ? Math.sin(q.flap * 4) * 0.18 : 0, ec = Math.sin(Math.min(1, q.ecst * 1.2) * Math.PI);
        M = A.mul(A.t(...q.p), A.ry(-q.yaw - (q.mode === 'nest' || q.mode === 'ride' ? q.look : 0)), A.rx(wad), A.rz(ec * 0.5), A.s(PS));
        fl = 0.25 + ec * 1.1;
      }
      setPart(buf, bp, M);
      setPart(buf, lp, A.mul(M, A.t(-0.001, 0.03, 0.0105), A.rx(-fl)));
      setPart(buf, rp, A.mul(M, A.t(-0.001, 0.03, -0.0105), A.rx(fl)));
    });
    Lf.seal.forEach((s, i) => {
      const [bp, hp] = P.seal[i], swim = s.mode === 'swim';
      const M = A.mul(A.t(...s.p), A.ry(-s.yaw), A.rz(swim ? Math.sin(s.t * 3) * 0.08 : 0));
      setPart(buf, bp, M);
      setPart(buf, hp, A.mul(M, A.t(0.04, 0.012, 0), A.rz(swim ? 0 : s.lift * 0.9)));
    });
    const o = Lf.orca, OM = A.mul(A.t(...o.p), A.ry(-o.yaw), A.rz(o.rise > 0 ? Math.sin(o.rise * Math.PI * 2) * 0.35 : Math.sin(o.beat) * 0.03));
    setPart(buf, P.orca[0], OM);
    setPart(buf, P.orca[1], A.mul(OM, A.t(-0.12, 0, 0), A.rz(Math.sin(o.beat) * 0.35)));
    Lf.silver.forEach((f, i) => { const sp = Math.hypot(f.v[0], f.v[2]) || 1, X = [f.v[0] / sp, 0, f.v[2] / sp]; setPart(buf, P.silver[i], A.basis(X, [0, 1, 0], [-X[2], 0, X[0]], f.p)); });
    Lf.fish.forEach((f, i) => setPart(buf, P.fish[i], f.on ? A.mul(A.t(...f.p), A.ry(f.age * 3)) : null));
    const n = Math.round(N_SNOW * Lf.snowfall);
    Lf.snow.forEach((s, i) => setPart(buf, P.snow[i], i < n ? A.t(...s.p) : null));
  };
  Lf.reset();
  return Lf;
}
