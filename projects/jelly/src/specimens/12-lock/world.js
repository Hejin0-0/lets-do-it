// Lock Jelly — the world: the three bodies of water, the tippable block, the lock, bubbles and foam, and
// everything that lives on and around the canal. Fixed steps: 120 Hz for the water and the people,
// 240 Hz for things afloat.
import { createShallowWater, terrainGrid, regionMap } from '@lid/diorama/water.js';
import { createBlock } from '@lid/diorama/block.js';
import { createBubbles } from '@lid/diorama/bubbles.js';
import { pickBlock } from '@lid/diorama/view.js';
import { L } from './layout.js';
import { createLock, createFoam } from './lock.js';
import { createKeeper, benchSpot } from './keeper.js';
import { createBoat, CHAMBER_X, MOORED } from './boat.js';
import { createStory } from './story.js';
import { COTTAGE_CHIMNEY } from './scenery.js';
import { createLife, DUCK_FLOAT } from './life.js';
import { createFloaters } from '@lid/diorama/floaters.js';
import { BOAT } from './boat.js';

export function createWorld(opts = {}) {
  const R = L.rng(opts.seed || 11);
  const T = terrainGrid(L.GN, L.HALF, L.terrainH);
  const water = createShallowWater({ N: L.GN, half: L.HALF, terrain: T, regions: regionMap(L.GN, L.HALF, T, L.regionSeed), levels: [L.LU, L.LU, L.LL] });
  const block = createBlock({ half: L.HALF, tiltMax: L.TILT_MAX, g: L.G });
  const bubbles = createBubbles({ water, rand: R, terrainH: L.terrainH, decor: 40 });
  const foam = createFoam(L.GN, L.HALF);
  const lock = createLock({ water, foam, bubbles, rand: R });
  const events = [];
  const keeper = createKeeper({ lock, events });
  const boat = createBoat({ water, foam });
  const story = createStory({ lock, keeper, boat });
  const moored = MOORED.map((m) => createBoat({ water, foam, len: m.len, beam: 0.13 }));
  const life = createLife({ water, boat, moored, rand: R, events });
  // rubber ducks: floaters stopped by the gates' leaves and the hulls, shoved by Wobble
  const hulls = [boat, ...moored], LEAF_T = 0.026;   // a leaf's half thickness; its hinge sits that far behind the wall's face
  function collide(x, y, z, r, n) {
    let best = 0;
    lock.gates.forEach((G, i) => {
      const g = L.GATES[i], d = L.leafDir(G.th), b = [g.hinge[0] + d[0] * L.LEAF, g.hinge[1] + d[1] * L.LEAF];
      if (y - r > L.TU + 0.035 || y + r < g.sill) return;
      // Beside the leaf's face on its wall side, the leaf and the back wall (its face as far beyond the hinge as the
      // leaf is thick) make a wedge that closes as the gate opens. Put the thing where it fits against both: on the
      // leaf's face, the wall's, or in the wedge's corner (slid out past the tip once the corner is beyond it), so it
      // is squeezed out along the wall instead of over it onto the coping.
      const X = x - g.hinge[0], Z = z - g.hinge[1], c = LEAF_T + r, cs = Math.cos(G.th), sn = Math.sin(G.th);
      const along = X * d[0] + Z * d[1], f1 = -(X * cs + Z * sn) - c, f2 = Z - c;
      if (f1 + c >= 0 && along >= 0 && along <= L.LEAF && Math.hypot(X, Z) <= L.LEAF + c) {
        if (f1 >= 0 && f2 >= 0) return;
        let tx = 0, tz = 0, gap = Infinity;
        const fits = (qx, qz) => -(qx * cs + qz * sn) - c >= -1e-9 && qz - c >= -1e-9;
        const take = (qx, qz) => { const e = Math.hypot(qx - X, qz - Z); if (e < gap && fits(qx, qz)) { gap = e; tx = qx; tz = qz; } };
        if (f1 < 0) take(X + cs * f1, Z + sn * f1);
        if (f2 < 0) take(X, c);
        if (gap === Infinity) { tz = c; tx = cs > 1e-6 ? Math.max(-(c + c * sn) / cs, -(L.LEAF + c)) : -(L.LEAF + c); gap = Math.hypot(tx - X, tz - Z); }
        if (gap > best && gap > 1e-9) { best = gap; n[0] = (tx - X) / gap; n[1] = 0; n[2] = (tz - Z) / gap; }
        return;
      }
      const ex = b[0] - g.hinge[0], ez = b[1] - g.hinge[1], t = Math.max(0, Math.min(1, (X * ex + Z * ez) / (ex * ex + ez * ez)));
      const px = g.hinge[0] + ex * t, pz = g.hinge[1] + ez * t, dx = x - px, dz = z - pz, dd = Math.hypot(dx, dz) || 1e-6, pen = LEAF_T + r - dd;
      if (pen > best) { best = pen; n[0] = dx / dd; n[1] = 0; n[2] = dz / dd; }
    });
    for (const h of hulls) {
      const hd = [Math.cos(h.yaw), Math.sin(h.yaw)], dx = x - h.c[0], dz = z - h.c[1], u = dx * hd[0] + dz * hd[1], w = -dx * hd[1] + dz * hd[0];
      if (y - r > h.y + 0.13 || y + r < h.y - BOAT.draft) continue;
      const pu = h.len / 2 + r - Math.abs(u), pw = h.beam / 2 + r - Math.abs(w);
      if (pu <= 0 || pw <= 0) continue;
      if (pw < pu) { if (pw > best) { best = pw; const s = Math.sign(w) || 1; n[0] = -hd[1] * s; n[1] = 0; n[2] = hd[0] * s; } }
      else if (pu > best) { best = pu; const s = Math.sign(u) || 1; n[0] = hd[0] * s; n[1] = 0; n[2] = hd[1] * s; }
    }
    return best;
  }
  const floaters = createFloaters({ water, block, terrainH: L.terrainH, terrainNormal: L.terrainNormal, half: L.HALF, rand: R, bubbles, collide, wake: 0.3 });
  // chimney smoke: a pool of puffs that rise, drift and swell
  const smoke = Array.from({ length: 40 }, () => ({ on: false, p: [0, 0, 0], age: 0, life: 3 }));
  let puffT = [0, 0];
  const puff = (p) => { const q = smoke.find((s) => !s.on); if (q) { q.on = true; q.p = p.slice(); q.age = 0; q.life = 2.6 + R() * 1.2; } };
  const W = { water, block, bubbles, foam, lock, keeper, boat, story, moored, smoke, life, floaters, time: 0, firm: 0.5, reduced: !!opts.reduced, hurry: false, events, paddleSpeed: 1 };

  W.setFirm = (f) => { W.firm = f; water.firm = f; };
  W.setDamp = (d) => { water.damp = d; };
  W.setHurry = (h) => { W.hurry = !!h; };
  const rate = () => (W.hurry ? 2.4 : 1);
  W.reset = () => {
    water.flat(); block.reset(); foam.clear();
    lock.reset(true, 0);   // the chamber full, the top gate open: the boat lies in the lock
    boat.place(CHAMBER_X, L.ZM, 0);
    MOORED.forEach((m, i) => moored[i].place(m.x, m.z, m.yaw));
    for (const q of smoke) q.on = false;
    floaters.clear(); life.reset();
    keeper.place(benchSpot().p, 0); keeper.rest();
    story.reset();
    bubbles.reset();
    events.length = 0;
  };

  let acc = 0, shimmer = 0.4;
  function stepTick() {
    const dt = 1 / 120;
    block.step(dt, W.firm, W.reduced);
    keeper.rate = rate(); lock.speed = W.paddleSpeed * rate();
    story.tick();
    keeper.step(dt);
    boat.step(dt, rate());
    lock.step(dt);
    boat.feed();
    for (const m of moored) { m.step(dt); m.feed(); }
    // smoke from Wobble's chimney and the cottage's
    if ((puffT[0] -= dt) < 0) { puffT[0] = 0.3 + R() * 0.25; puff(boat.chimney()); }
    if ((puffT[1] -= dt) < 0) { puffT[1] = 0.45 + R() * 0.4; puff(COTTAGE_CHIMNEY); }
    for (const q of smoke) if (q.on) { q.age += dt; q.p[1] += 0.03 * dt; q.p[0] += 0.018 * dt; q.p[2] -= 0.006 * dt; if (q.age > q.life) q.on = false; }
    floaters.feed();
    for (let k = 0; k < 2; k++) floaters.step(dt / 2);
    for (const e of floaters.events) events.push({ type: e.type, x: e.x, z: e.z, speed: e.speed });
    floaters.events.length = 0;
    life.step(dt);
    if (events.length > 300) events.splice(0, events.length - 300);
    const f = (0.6 * water.g()) / L.G;
    water.step(dt, block.g[0] * f, block.g[2] * f);
    if (!W.reduced && (shimmer -= dt) < 0) {   // idle shimmer: the water is never dead flat
      shimmer = 0.3 + R() * 0.8;
      for (let t = 0; t < 10; t++) {
        const x = (R() * 2 - 1) * (L.HALF - 0.1), z = (R() * 2 - 1) * (L.HALF - 0.1);
        if (water.isWet(x, z)) { water.addVolume(x, z, (R() < 0.5 ? -1 : 1) * 0.00012, 0.05); break; }
      }
    }
    bubbles.step(dt, W.time);
    foam.step(dt);
    W.time += dt;
  }
  W.advance = (dt) => {
    acc += Math.min(dt, 0.1);
    let n = 0;
    while (acc >= 1 / 120 && n < 6) { stepTick(); acc -= 1 / 120; n++; }
    if (n === 6) acc = 0;
  };
  W.step = (n = 1) => { for (let i = 0; i < n; i++) stepTick(); };
  W.pick = (o, d) => floaters.pick(o, d) || pickBlock(o, d, { half: L.HALF, top: L.TU + 0.1, terrainH: L.terrainH, water });
  /** A yellow rubber duck dropped into the water (the oldest goes when there are ten). */
  W.dropDuck = () => {
    if (floaters.bodies.length >= 10) floaters.remove(floaters.bodies[0]);
    let x = 0, z = L.ZM;
    for (let t = 0; t < 100; t++) {
      x = -1.6 + R() * 3.2; z = L.ZC + 0.05 + R() * (L.HALF - L.ZC - 0.1);
      if (water.isWet(x, z) && water.surface(x, z) - L.terrainH(x, z) > 0.1 && Math.hypot(x - boat.c[0], z - boat.c[1]) > 0.55) break;
    }
    const a = R() * 6.283, b = floaters.add({ ...DUCK_FLOAT, p: [x, water.surface(x, z) + 0.45, z], q: [0, Math.sin(a / 2), 0, Math.cos(a / 2)] });
    b.w = [(R() - 0.5) * 3, (R() - 0.5) * 2, (R() - 0.5) * 3];
    return b;
  };
  W.toot = () => { events.push({ type: 'horn' }); life.toot(); };
  W.throwBread = () => life.throwBread();
  W.tally = () => ({ trips: story.trips, lockfuls: lock.lockfuls, fed: life.fed });
  W.reset();
  return W;
}
