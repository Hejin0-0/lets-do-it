// Iceberg Jelly — the world: the bay's water, the tippable block, the ice, the icebreaker, the creatures,
// snow, puffs of ice dust, spray and smoke. Fixed steps at 120 Hz (the ice twice over at 240 Hz).
import { createShallowWater, terrainGrid } from '@lid/diorama/water.js';
import { createBlock } from '@lid/diorama/block.js';
import { createBubbles } from '@lid/diorama/bubbles.js';
import { createFloaters } from '@lid/diorama/floaters.js';
import { createFoam } from '@lid/diorama/foam.js';
import { pickBlock } from '@lid/diorama/view.js';
import { I } from './layout.js';
import { createIce } from './ice.js';
import { createShip } from './ship.js';
import { createLife } from './life.js';

export const PUFFS = { white: 70, dark: 30 };

export function createWorld(opts = {}) {
  const R = I.rng(opts.seed || 13);
  const water = createShallowWater({ N: I.GN, half: I.HALF, terrain: terrainGrid(I.GN, I.HALF, I.terrainH), level: I.SL });
  const block = createBlock({ half: I.HALF, tiltMax: I.TILT_MAX, g: I.G });
  const bubbles = createBubbles({ water, rand: R, terrainH: I.terrainH, decor: 50, max: 420 });
  const foam = createFoam(I.GN, I.HALF);
  const events = [];
  const solids = [];   // moving hulls and the like: (x, y, z, r, n, u) -> penetration
  const tn = [0, 0, 0], tu = [0, 0, 0];
  const collide = (x, y, z, r, n, u) => {
    let best = 0;
    for (const S of solids) { tu[0] = tu[1] = tu[2] = 0; const p = S(x, y, z, r, tn, tu); if (p > best) { best = p; for (let k = 0; k < 3; k++) { n[k] = tn[k]; u[k] = tu[k]; } } }
    return best;
  };
  const floaters = createFloaters({ water, block, terrainH: I.terrainH, terrainNormal: I.terrainNormal, half: I.HALF, rand: R, bubbles, wake: 0.35, collide });   // above full ahead: floes shoved by the hull must not bob waves up
  // puffs: ice dust, spray, the orca's blow (white); the ship's smoke (dark)
  const puffs = { white: Array.from({ length: PUFFS.white }, () => ({ on: false })), dark: Array.from({ length: PUFFS.dark }, () => ({ on: false })) };
  const KIND = { dust: ['white', 0.012, 2.2, 0.025], spray: ['white', 0.18, 0.9, 0.012], blow: ['white', 0.25, 1.4, 0.016], smoke: ['dark', 0.03, 3.2, 0.02] };
  const puff = (p, kind) => {
    const [pool, up, life, size] = KIND[kind], q = puffs[pool].find((s) => !s.on);
    if (q) Object.assign(q, { on: true, kind, p: p.slice(), v: [(R() - 0.5) * 0.04, up * (0.6 + 0.8 * R()), (R() - 0.5) * 0.04], age: 0, life: life * (0.7 + 0.6 * R()), size: size * (0.7 + 0.6 * R()) });
  };
  const ice = createIce({ floaters, water, foam, bubbles, puff, rand: R, events });
  const W = { water, block, bubbles, foam, floaters, ice, puffs, events, solids, time: 0, firm: 0.5, reduced: !!opts.reduced, snow: 0.35, rand: R, hooks: [], resets: [] };
  W.puff = puff;

  W.setFirm = (f) => { W.firm = f; water.firm = f; };
  W.setDamp = (d) => { water.damp = d; };
  let acc = 0, shimmer = 0.4;
  function stepTick(quiet) {
    const dt = 1 / 120;
    block.step(dt, W.firm, W.reduced);
    if (!quiet) { ice.step(dt); for (const f of W.hooks) f(dt); }
    floaters.feed();
    for (let k = 0; k < 2; k++) floaters.step(dt / 2);
    for (const e of floaters.events) if (e.type === 'splash' || e.type === 'knock') events.push({ type: e.type, x: e.x, z: e.z, speed: e.speed, body: e.body });
    floaters.events.length = 0;
    const f = (0.6 * water.g()) / I.G;
    water.step(dt, block.g[0] * f, block.g[2] * f);
    if (!W.reduced && (shimmer -= dt) < 0) {   // idle shimmer: the sea is never dead flat
      shimmer = 0.25 + R() * 0.7;
      for (let t = 0; t < 10; t++) {
        const x = (R() * 2 - 1) * (I.HALF - 0.1), z = (R() * 2 - 1) * (I.HALF - 0.1);
        if (water.isWet(x, z)) { water.addVolume(x, z, (R() < 0.5 ? -1 : 1) * 0.00014, 0.05); break; }
      }
    }
    bubbles.step(dt, W.time);
    foam.step(dt);
    for (const pool of [puffs.white, puffs.dark]) for (const q of pool) if (q.on) {
      q.age += dt; if (q.kind === 'spray') q.v[1] -= 0.6 * dt;
      for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
      if (q.age > q.life) q.on = false;
    }
    if (events.length > 300) events.splice(0, events.length - 300);
    W.time += dt;
  }
  W.reset = () => {
    water.flat(); block.reset(); foam.clear();
    for (const pool of [puffs.white, puffs.dark]) for (const q of pool) q.on = false;
    ice.reset();
    for (let i = 0; i < 120 * 6; i++) stepTick(true);   // let the pack find its stable ways up, out of sight
    ice.settled();
    water.flat(); foam.clear(); bubbles.reset();
    for (const f of W.resets) f();
    events.length = 0;
  };
  W.advance = (dt) => {
    acc += Math.min(dt, 0.1);
    let n = 0;
    while (acc >= 1 / 120 && n < 6) { stepTick(false); acc -= 1 / 120; n++; }
    if (n === 6) acc = 0;
  };
  W.step = (n = 1) => { for (let i = 0; i < n; i++) stepTick(false); };
  W.pick = (o, d) => floaters.pick(o, d) || pickBlock(o, d, { half: I.HALF, top: 1.35, terrainH: I.terrainH, water });
  W.calve = () => ice.calve();
  // the icebreaker (her hull a solid for the ice) and the creatures
  const ship = createShip({ water, foam, events, rand: R, puff });
  const life = createLife({ water, ice, floaters, rand: R, events, puff });
  Object.assign(W, { ship, life });
  solids.push(ship.solid);
  // the ice feels her hull: under way, she breaks the pancakes she runs into
  ice.breaker = {
    press: (x, y, z, r, n, u) => (ship.state === 'under way' ? ship.solid(x, y, z, r, n, u) : 0),
    near: (x, z) => Math.hypot(x - ship.v.c[0], z - ship.v.c[1]),
  };
  W.hooks.push((dt) => { ship.step(dt); ship.v.feed(); life.snowfall = W.snow; life.step(dt); });
  W.resets.push(() => { ship.reset(); life.reset(); });
  W.horn = () => events.push({ type: 'horn' });
  W.throwFish = () => life.throwFish();
  W.tally = () => ({ calved: ice.calved, capsized: ice.capsized, broken: ice.broken, fed: life.fed });
  if (!opts.deferReset) W.reset();
  return W;
}
