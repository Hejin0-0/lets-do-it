// Harbor Jelly — life in the harbour. Mackerel, herring and small orange wrasse school as boids in the water,
// keep under the hulls and off the bed, scatter from fingers, splashes and moving ships, and come to food
// (the wrasse keep near the rocks and the piles). Moon jellyfish drift with the water, their glassy bells
// pulsing. Herring gulls circle, bank and glide, and land on perches (lamps, roof ridges, the spire, the
// lighthouse gallery, the cranes' apexes, the ship's mast, the tug, the yachts' mastheads — a perch that moves
// carries its gull); they all go up when the horn sounds, and some dive at food. Pellets thrown off the pier
// float a moment and sink.
import { A, MAT } from '../../core/diorama/parts.js';
import { H } from './layout.js';
import { SHIP, TUG, MAST_TOP, TUG_MAST } from './ship.js';
import { apexOf } from './cranes.js';

const TAU = Math.PI * 2, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const KINDS = [
  { name: 'mackerel', n: 16, len: 0.05, h: 0.011, back: '#2f6a78', belly: '#dfe4e6', bars: '#14262c' },
  { name: 'herring', n: 18, len: 0.044, h: 0.011, back: '#5a7090', belly: '#e8ecee' },
  { name: 'wrasse', n: 8, len: 0.032, h: 0.011, back: '#e0782a', belly: '#f2b468' },
];
const N_JELLY = 6, N_GULL = 9, N_PELLET = 16;
const WRASSE_HOMES = [[1.4, 0.62], [2.1, 0.68], [H.PIER.x, -0.35], [0.95, 0.75]];

// ----- models (forward +x, up +y) -----
function fishModel(B, K) {
  B.col(K.back).mat(MAT.FISH).ball(K.len / 2, K.h / 2, K.h * 0.32, 1);
  B.col(K.belly).at(A.t(0, -K.h * 0.18, 0), () => B.ball(K.len * 0.44, K.h * 0.34, K.h * 0.3, 1));
  if (K.bars) { B.col(K.bars).mat(MAT.MATTE); for (const x of [-0.012, -0.004, 0.004, 0.012]) B.slab(x - 0.0014, K.h * 0.12, -K.h * 0.3, x + 0.0014, K.h * 0.42, K.h * 0.3); }
  B.col(K.back).mat(MAT.FISH).sheet(3, 2, (i, j) => [-K.len / 2 - 0.002 - i * 0.006, (j - 0.5) * K.h * (0.4 + i * 0.4), 0]);   // the tail
  B.col('#101010').mat(MAT.GLOSS).at(A.t(K.len * 0.34, K.h * 0.08, 0), () => B.ball(0.0016, 0.0016, K.h * 0.34, 0));
}
function jellyModel(B) {
  B.col('#dfeaf2').mat(MAT.GLASS).lathe([[0, 0.022], [0.012, 0.02], [0.021, 0.013], [0.028, 0.002], [0.027, -0.003], [0.02, -0.001]], 14);
  B.col('#e88aa8').mat(MAT.MATTE);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; B.at(A.t(Math.cos(a) * 0.008, 0.011, Math.sin(a) * 0.008), () => B.lathe([[0.0035, 0.0012], [0.005, 0], [0.0035, -0.0012], [0.002, 0], [0.0035, 0.0012]], 8)); }
  B.col('#f2d8e6').mat(MAT.CLOTH);
  for (let k = 0; k < 4; k++) B.at(A.ry((k / 4) * TAU), () => B.quad([0.002, -0.002, 0], [0.006, -0.002, 0], [0.004, -0.045, 0.003], [0.0, -0.04, 0.002]));   // the frilly oral arms
  B.col('#eef4f8');
  for (let k = 0; k < 16; k++) B.at(A.ry((k / 16) * TAU), () => B.quad([0.026, -0.002, -0.0006], [0.026, -0.002, 0.0006], [0.025, -0.03, 0.0006], [0.025, -0.03, -0.0006]));   // the tentacle fringe
}
function gullBody(B) {
  B.col('#f4f4f0').mat(MAT.FEATHER).ball(0.022, 0.0105, 0.011, 1);
  B.at(A.t(0.019, 0.008, 0), () => B.ball(0.0085, 0.008, 0.0075, 1));                                 // the head
  B.col('#f0c030').mat(MAT.GLOSS).at(A.mul(A.t(0.031, 0.007, 0), A.rz(-0.2)), () => B.ball(0.0065, 0.0018, 0.0016, 0));   // the bill
  B.col('#d03020').at(A.t(0.032, 0.005, 0), () => B.ball(0.0012, 0.0012, 0.0017, 0));                    // its red spot
  B.col('#111111').at(A.t(0.023, 0.011, 0), () => B.ball(0.0012, 0.0012, 0.0082, 0));                    // the eyes
  B.col('#9aa2a8').mat(MAT.FEATHER).at(A.t(-0.006, 0.006, 0), () => B.ball(0.016, 0.004, 0.0105, 1));    // the grey mantle
  B.col('#f4f4f0').at(A.mul(A.t(-0.024, 0.002, 0), A.rz(0.25)), () => B.ball(0.008, 0.002, 0.006, 0));    // the tail
  B.col('#e8a8a0').mat(MAT.MATTE);
  for (const s of [-1, 1]) B.slab(-0.002, -0.022, s * 0.004 - 0.001, 0.0, -0.008, s * 0.004 + 0.001);     // pink legs
}
function gullWing(B, s) {   // from the shoulder outward along ±z: grey, black tips with a white spot
  B.col('#9aa2a8').mat(MAT.FEATHER).sheet(3, 5, (i, j) => [0.01 - i * 0.012 - j * j * 0.0016, -0.001 * j, s * (0.004 + j * 0.011)]);
  B.col('#16161a').sheet(2, 3, (i, j) => [-0.032 - i * 0.012, -0.004 - 0.001 * j, s * (0.048 + j * 0.01)]);
  B.col('#f4f4f0').at(A.t(-0.022, -0.0055, s * 0.062), () => B.ball(0.0025, 0.0006, 0.0025, 0));
}
function pelletModel(B) { B.col('#b8864a').mat(MAT.MATTE).ball(0.0035, 0.003, 0.0035, 0); }

export function buildLife(B, parts) {
  const P = (parts.life = { fish: [], jelly: [], gull: [], pellet: [] });
  for (const K of KINDS) for (let i = 0; i < K.n; i++) { P.fish.push(B.newPart()); fishModel(B, K); }
  for (let i = 0; i < N_JELLY; i++) { P.jelly.push(B.newPart()); jellyModel(B); }
  for (let i = 0; i < N_GULL; i++) { const b = B.newPart(); gullBody(B); const l = B.newPart(); gullWing(B, 1); const r = B.newPart(); gullWing(B, -1); P.gull.push([b, l, r]); }
  for (let i = 0; i < N_PELLET; i++) { P.pellet.push(B.newPart()); pelletModel(B); }
}

/** o: { water, fleet, moorings, cranes, events, rand, perches } */
export function createLife({ water, fleet, moorings, cranes, events, rand: R, perches }) {
  const Lf = { fish: [], jelly: [], gulls: [], pellets: [], fed: 0, splashes: [], finger: null };
  const hulls = () => [[fleet.ship, SHIP], [fleet.tug, TUG]];
  const depth = (x, z) => water.surface(x, z) - H.terrainH(x, z);
  const wet = (x, z, d) => Math.abs(x) < H.HALF - 0.04 && Math.abs(z) < H.HALF - 0.04 && water.isWet(x, z) && depth(x, z) > d;
  /** How far (x, z) is outside a hull's footprint (negative inside). */
  const hullGap = (v, D, x, z) => {
    const h = [Math.cos(v.yaw), Math.sin(v.yaw)], dx = x - v.c[0], dz = z - v.c[1];
    return Math.max(Math.abs(dx * h[0] + dz * h[1]) - D.len / 2, Math.abs(-dx * h[1] + dz * h[0]) - D.beam / 2);
  };
  // the perches: still ones from the scenery, and ones that move with their things
  const PER = [...perches.map((p) => ({ at: () => p })),
    ...cranes.list.map((c) => ({ at: () => apexOf(c) })),
    { at: () => A.apply(fleet.ship.matrix(), MAST_TOP) }, { at: () => A.apply(fleet.tug.matrix(), TUG_MAST) },
    ...[0, 1].map((i) => ({ at: () => moorings.mastheads()[i] }))].map((p) => ({ ...p, gull: null }));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function freePerch(near) {
    const free = PER.filter((p) => !p.gull).map((p) => ({ p, s: dist(p.at(), near) + R() * 1.5 })).sort((a, b) => a.s - b.s);
    return free.length ? free[0].p : null;
  }

  function spawnFish(f) {
    for (let t = 0; t < 300; t++) {
      let x, z;
      if (f.home) { x = f.home[0] + (R() - 0.5) * 0.5; z = f.home[1] + (R() - 0.5) * 0.5; } else { x = (R() * 2 - 1) * 2.4; z = H.QZ + 0.1 + R() * (2.45 - H.QZ); }
      if (!wet(x, z, 0.15)) continue;
      const a = R() * TAU;
      Object.assign(f, { p: [x, H.terrainH(x, z) + 0.04 + R() * (depth(x, z) - 0.1), z], v: [Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04], wa: a });
      return;
    }
  }
  Lf.reset = () => {
    Lf.fish = [];
    KINDS.forEach((K, k) => { for (let i = 0; i < K.n; i++) { const f = { k, home: K.name === 'wrasse' ? WRASSE_HOMES[i % WRASSE_HOMES.length] : null }; spawnFish(f); Lf.fish.push(f); } });
    Lf.jelly = Array.from({ length: N_JELLY }, () => { for (;;) { const x = (R() * 2 - 1) * 2.2, z = 0.1 + R() * 2.2; if (wet(x, z, 0.25)) return { p: [x, H.SL - 0.08 - R() * 0.15, z], ph: R() * TAU, yaw: R() * TAU }; } });
    for (const p of PER) p.gull = null;
    Lf.gulls = Array.from({ length: N_GULL }, (_, i) => {
      const g = { i, mode: 'perch', perch: null, p: [0, 1.5, 0], yaw: R() * TAU, vy: 0, bank: 0, flap: R() * 9, t: 5 + R() * 30, look: 0, target: null, orbit: null, food: null, wait: 0 };
      const p = freePerch([R() * 4 - 2, 1.4, -1.5 + R()]);
      if (p) { p.gull = g; g.perch = p; g.p = p.at().slice(); } else takeOff(g, 5);
      return g;
    });
    Lf.pellets = Array.from({ length: N_PELLET }, () => ({ on: false, p: [0, 0, 0], v: [0, 0, 0], wet: false, age: 0 }));
    Lf.fed = 0; Lf.splashes = [];
  };

  // ----- fish -----
  function stepFish(dt, t) {
    const F = Lf.fish;
    for (const f of F) {
      const [x, y, z] = f.p;
      let ax = 0, ay = 0, az = 0, mx = 0.08;
      f.wa += (R() - 0.5) * 3 * dt;
      ax += Math.cos(f.wa) * 0.03; az += Math.sin(f.wa) * 0.03;
      let n = 0, cx = 0, cy = 0, cz = 0, vx = 0, vz = 0;
      for (const g of F) {
        if (g === f || g.k !== f.k) continue;
        const dx = g.p[0] - x, dy = g.p[1] - y, dz = g.p[2] - z, d = Math.hypot(dx, dy, dz);
        if (d > 0.18 || d < 1e-6) continue;
        if (d < 0.035) { ax -= (dx / d) * 0.25; ay -= (dy / d) * 0.1; az -= (dz / d) * 0.25; }
        n++; cx += g.p[0]; cy += g.p[1]; cz += g.p[2]; vx += g.v[0]; vz += g.v[2];
      }
      if (n) { ax += (cx / n - x) * 0.4 + (vx / n - f.v[0]) * 0.8; ay += (cy / n - y) * 0.2; az += (cz / n - z) * 0.4 + (vz / n - f.v[2]) * 0.8; }
      if (f.home) { ax += (f.home[0] - x) * 0.15; az += (f.home[1] - z) * 0.15; }
      // under the hulls; out of the way of a moving one
      let roof = water.surface(x, z) - 0.025;
      for (const [v, D] of hulls()) {
        const gap = hullGap(v, D, x, z);
        if (gap < 0.03) roof = Math.min(roof, v.y - D.draft - 0.025);
        if (gap < 0.25 && v.moving) { const dx = x - v.c[0], dz = z - v.c[1], d = Math.hypot(dx, dz) + 1e-6; ax += (dx / d) * 1.0; az += (dz / d) * 1.0; mx = 0.22; }
      }
      if (y > roof) ay -= 0.6;
      if (y < H.terrainH(x, z) + 0.03) ay += 0.6;
      // fingers and splashes scatter them
      const scare = (sx, sz, r) => { const dx = x - sx, dz = z - sz, d = Math.hypot(dx, dz); if (d < r) { ax += (dx / (d + 1e-3)) * 1.4; az += (dz / (d + 1e-3)) * 1.4; mx = 0.22; } };
      if (Lf.finger && t - Lf.finger[2] < 0.4) scare(Lf.finger[0], Lf.finger[1], 0.3);
      for (const e of Lf.splashes) scare(e[0], e[1], 0.35);
      // food: the nearest pellet in the water
      let food = null, fd = 0.9;
      for (const q of Lf.pellets) if (q.on && q.wet) { const d = Math.hypot(q.p[0] - x, q.p[2] - z); if (d < fd) { fd = d; food = q; } }
      if (food) {
        ax += (food.p[0] - x) * 2.5; ay += (food.p[1] - y) * 2.5; az += (food.p[2] - z) * 2.5; mx = 0.2;
        if (dist(food.p, f.p) < 0.025) { food.on = false; Lf.fed++; events.push({ type: 'gulp', x, z }); }
      }
      f.v[0] += ax * dt; f.v[1] += ay * dt; f.v[2] += az * dt;
      f.v[1] *= 1 - 3 * dt;
      const sp = Math.hypot(f.v[0], f.v[2]), mn = 0.025;
      if (sp > mx) { f.v[0] *= mx / sp; f.v[2] *= mx / sp; } else if (sp < mn) { f.v[0] *= mn / (sp + 1e-6); f.v[2] *= mn / (sp + 1e-6); }
      const nx = x + f.v[0] * 0.5 + Math.sign(f.v[0]) * 0.03, nz = z + f.v[2] * 0.5 + Math.sign(f.v[2]) * 0.03;
      if (!wet(nx, nz, 0.06) || H.boxHit(nx, y, nz, 0.01, [0, 0, 0]) > 0) { f.v[0] = -f.v[0]; f.v[2] = -f.v[2]; f.wa += Math.PI; }
      else { f.p[0] += f.v[0] * dt; f.p[2] += f.v[2] * dt; }
      f.p[1] = Math.max(H.terrainH(f.p[0], f.p[2]) + 0.02, Math.min(roof, water.surface(f.p[0], f.p[2]) - 0.02, f.p[1] + f.v[1] * dt));
      if (!wet(f.p[0], f.p[2], 0.03)) spawnFish(f);   // stranded by a wave or the tide: start again somewhere wet
    }
  }

  // ----- moon jellyfish: drift with the water, pulsing -----
  function stepJelly(dt) {
    const fl = [0, 0];
    for (const j of Lf.jelly) {
      water.flow(j.p[0], j.p[2], fl);
      j.ph += dt * 2.2;
      j.yaw += (R() - 0.5) * 0.3 * dt;
      let nx = j.p[0] + (fl[0] * 0.8 + Math.cos(j.yaw) * 0.004) * dt, nz = j.p[2] + (fl[1] * 0.8 + Math.sin(j.yaw) * 0.004) * dt;
      if (!wet(nx, nz, 0.12)) { j.yaw += Math.PI; nx = j.p[0]; nz = j.p[2]; }
      j.p[0] = nx; j.p[2] = nz;
      const s = water.surface(nx, nz);
      j.p[1] += (Math.max(0, Math.sin(j.ph)) * 0.012 - 0.004 + (s - 0.1 - j.p[1]) * 0.02) * dt;
      j.p[1] = Math.max(H.terrainH(nx, nz) + 0.05, Math.min(s - 0.03, j.p[1]));
    }
  }

  // ----- gulls -----
  function takeOff(g, sec) {
    if (g.perch) g.perch.gull = null;
    if (g.target) g.target.gull = null;
    g.perch = null; g.target = null; g.food = null; g.mode = 'fly'; g.t = sec;
    g.orbit = { c: [(R() - 0.5) * 2.4, 0.2 + R() * 1.4], r: 0.5 + R() * 0.7, y: H.DECK + 0.45 + R() * 0.45, w: R() < 0.5 ? -1 : 1, a: R() * TAU };
    g.vy = 0.3;
  }
  function steer(g, T, dt, speed) {
    const want = Math.atan2(T[2] - g.p[2], T[0] - g.p[0]);
    const turn = Math.max(-1.8, Math.min(1.8, wrap(want - g.yaw) * 2.5));
    g.yaw += turn * dt;
    g.bank += (Math.max(-0.7, Math.min(0.7, -turn * 0.45)) - g.bank) * Math.min(1, dt * 4);
    g.vy += (Math.max(-0.45, Math.min(0.45, (T[1] - g.p[1]) * 1.6)) - g.vy) * Math.min(1, dt * 3);
    g.p[0] += Math.cos(g.yaw) * speed * dt; g.p[2] += Math.sin(g.yaw) * speed * dt; g.p[1] += g.vy * dt;
    g.p[1] = Math.max(g.p[1], water.surface(g.p[0], g.p[2]) + 0.01);
    g.p[0] = Math.max(-H.HALF + 0.05, Math.min(H.HALF - 0.05, g.p[0])); g.p[2] = Math.max(-H.HALF + 0.05, Math.min(H.HALF - 0.05, g.p[2]));
  }
  function stepGulls(dt, t) {
    for (const g of Lf.gulls) {
      g.flap += dt * (g.mode === 'perch' ? 0 : g.vy > 0.05 ? 16 : 5);
      if (g.mode === 'perch') {
        g.p = g.perch.at().slice();
        g.look += (Math.sin(t * 0.7 + g.i * 2.3) * 0.8 - g.look) * Math.min(1, dt);
        if ((g.t -= dt) < 0) { if (R() < 0.5) takeOff(g, 8 + R() * 12); else g.t = 10 + R() * 30; }
        continue;
      }
      if (g.mode === 'dive') {   // hang over the pier end until a pellet is on the water, then go for it
        if (!g.food) {
          if ((g.wait -= dt) > 0) { steer(g, [H.PIER.x, H.PIER.deck + 0.4, 0.3], dt, 0.4); continue; }
          g.food = Lf.pellets.find((p) => p.on && p.wet && p.age < 2.5 && !Lf.gulls.some((o) => o.food === p)) || null;
          if (!g.food) { takeOff(g, 4 + R() * 4); continue; }
        }
        const q = g.food;
        if (!q.on || !q.wet) { takeOff(g, 4 + R() * 4); continue; }
        steer(g, q.p, dt, 0.6);
        if (dist(q.p, g.p) < 0.035) { q.on = false; Lf.fed++; events.push({ type: 'gull', x: g.p[0], z: g.p[2] }); takeOff(g, 5 + R() * 5); }
        continue;
      }
      // flying: circle a while, then find a perch and land on it
      g.t -= dt;
      if (g.t < 0 && !g.target) { const p = freePerch(g.p); if (p) { p.gull = g; g.target = p; } else g.t = 3; }
      if (g.target) {
        const T = g.target.at(), d = dist(T, g.p);
        steer(g, [T[0], T[1] + Math.min(0.15, d * 0.3), T[2]], dt, Math.max(0.12, Math.min(0.5, d * 1.2)));
        if (d < 0.03) { g.mode = 'perch'; g.perch = g.target; g.target = null; g.t = 15 + R() * 35; g.bank = 0; g.vy = 0; }
      } else {
        const O = g.orbit; O.a += (O.w * 0.5 * dt) / O.r;
        steer(g, [O.c[0] + Math.cos(O.a) * O.r, O.y, O.c[1] + Math.sin(O.a) * O.r], dt, 0.5);
      }
    }
  }

  // ----- pellets -----
  function stepPellets(dt) {
    for (const q of Lf.pellets) {
      if (!q.on) continue;
      q.age += dt;
      if (!q.wet) {
        q.v[1] -= 1.6 * dt; for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
        if (q.p[1] < water.surface(q.p[0], q.p[2]) && water.isWet(q.p[0], q.p[2])) { q.wet = true; q.age = 0; events.push({ type: 'plop', x: q.p[0], z: q.p[2] }); }
        else if (q.p[1] < H.terrainH(q.p[0], q.p[2]) || Math.abs(q.p[0]) > H.HALF || Math.abs(q.p[2]) > H.HALF) q.on = false;
      } else {
        q.p[1] = q.age < 2.5 ? water.surface(q.p[0], q.p[2]) - 0.002 : Math.max(H.terrainH(q.p[0], q.p[2]) + 0.003, q.p[1] - 0.02 * dt);
        if (q.age > 30) q.on = false;
      }
    }
  }

  /** One tick; fresh: the events since the last one (splashes scatter the fish, the horn lifts the gulls). */
  Lf.step = (dt, t, fresh = []) => {
    Lf.splashes = Lf.splashes.filter((e) => (e[2] -= dt) > 0);
    for (const e of fresh) {
      if (e.type === 'splash' && e.x !== undefined) Lf.splashes.push([e.x, e.z, 0.8]);
      if (e.type === 'horn') Lf.horn();
    }
    stepFish(dt, t); stepJelly(dt); stepGulls(dt, t); stepPellets(dt);
  };
  /** The horn: every gull up. */
  Lf.horn = () => { for (const g of Lf.gulls) if (g.mode === 'perch' || g.target) takeOff(g, 6 + R() * 6); };
  /** Pellets off the end of the pier; the three nearest gulls come down for them. Returns how many flew. */
  Lf.feed = () => {
    let n = 0;
    for (const q of Lf.pellets) {
      if (q.on || n >= 10) continue;
      Object.assign(q, { on: true, wet: false, age: 0, p: [H.PIER.x + (R() - 0.5) * 0.05, H.PIER.deck + 0.03, H.PIER.z1 - 0.01], v: [(R() - 0.5) * 0.35, 0.25 + R() * 0.2, 0.12 + R() * 0.3] });
      n++;
    }
    if (n) for (const g of [...Lf.gulls].filter((o) => o.mode !== 'dive').sort((a, b) => Math.hypot(a.p[0] - H.PIER.x, a.p[2]) - Math.hypot(b.p[0] - H.PIER.x, b.p[2])).slice(0, 3)) {
      takeOff(g, 0); g.mode = 'dive'; g.wait = 0.8 + R() * 0.8;
    }
    return n;
  };

  // ----- posing -----
  Lf.pose = (buf, P, setPart) => {
    Lf.fish.forEach((f, i) => {
      const yaw = Math.atan2(f.v[2], f.v[0]), pitch = Math.atan2(f.v[1], Math.hypot(f.v[0], f.v[2]) + 1e-6);
      setPart(buf, P.fish[i], A.mul(A.t(...f.p), A.ry(-yaw), A.rz(pitch)));
    });
    Lf.jelly.forEach((j, i) => {
      const sq = 1 + 0.12 * Math.max(0, Math.sin(j.ph));
      setPart(buf, P.jelly[i], A.mul(A.t(...j.p), A.ry(j.yaw), A.s(1.25 / sq, 1.25 * (0.9 + 0.12 * sq), 1.25 / sq)));
    });
    Lf.gulls.forEach((g, i) => {
      const [bp, lp, rp] = P.gull[i], perched = g.mode === 'perch';
      const base = A.mul(A.t(g.p[0], g.p[1] + (perched ? 0.022 : 0), g.p[2]), A.ry(-(g.yaw + (perched ? g.look : 0))), A.rx(perched ? 0 : g.bank), A.rz(perched ? 0.1 : Math.max(-0.4, Math.min(0.4, g.vy * 0.8))));
      setPart(buf, bp, base);
      const fl = perched ? -1.35 : g.vy > 0.05 || g.mode === 'dive' ? Math.sin(g.flap) * 0.8 : 0.08 + Math.sin(g.flap) * 0.1, fold = perched ? 0.35 : 1;
      setPart(buf, lp, A.mul(base, A.t(0.0, 0.006, 0.006), A.rx(-fl), A.s(1, 1, fold)));
      setPart(buf, rp, A.mul(base, A.t(0.0, 0.006, -0.006), A.rx(fl), A.s(1, 1, fold)));
    });
    Lf.pellets.forEach((q, i) => setPart(buf, P.pellet[i], q.on ? A.t(...q.p) : null));
  };
  Lf.reset();
  return Lf;
}
