// Harbor Jelly — the world: the harbour's water (its level follows the tide), the tippable block, the ship and
// the tug, the boxes and the cranes, the ship's day, the things at their moorings, three lifebuoys to throw
// about, the fish, the jellyfish and the gulls, smoke and steam. Fixed steps at 120 Hz (the lifebuoys twice over).
import { createShallowWater, terrainGrid } from '../../core/diorama/water.js';
import { createBlock } from '../../core/diorama/block.js';
import { createBubbles } from '../../core/diorama/bubbles.js';
import { createFloaters } from '../../core/diorama/floaters.js';
import { createFoam } from '../../core/diorama/foam.js';
import { pickBlock } from '../../core/diorama/view.js';
import { A } from '../../core/diorama/parts.js';
import { H } from './layout.js';
import { createFleet, FUNNEL_TOP, TUG_FUNNEL, SHIP, TUG } from './ship.js';
import { createBoxes } from './boxes.js';
import { createCranes } from './cranes.js';
import { createStory } from './story.js';
import { createMoorings } from './moorings.js';
import { createLife } from './life.js';
import { PERCHES } from './town.js';

export const PUFFS = { white: 40, dark: 40 };
/** A lifebuoy: a flat ring of spheres. */
const RING = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return [Math.cos(a) * 0.021, 0, Math.sin(a) * 0.021, 0.0085]; });
export const LIFEBUOYS = [[1.25, -0.15], [2.15, 0.12], [0.15, 0.32]];

export function createWorld(opts = {}) {
  const R = H.rng(opts.seed || 11);
  const water = createShallowWater({ N: H.GN, half: H.HALF, terrain: terrainGrid(H.GN, H.HALF, H.terrainH), level: H.SL });
  const block = createBlock({ half: H.HALF, tiltMax: H.TILT_MAX, g: H.G });
  const bubbles = createBubbles({ water, rand: R, terrainH: H.terrainH, decor: 40, max: 300 });
  const foam = createFoam(H.GN, H.HALF);
  const events = [];
  const fleet = createFleet({ water, foam });
  // the lifebuoys bounce off the hulls (which shove them along) and the pier, the sheds, the houses, the stacks
  const tn = [0, 0, 0], tu = [0, 0, 0];
  const collide = (x, y, z, r, n, u) => {
    let best = 0;
    for (const [v, D] of [[fleet.ship, SHIP], [fleet.tug, TUG]]) {
      tu[0] = tu[1] = tu[2] = 0;
      const p = v.solid(x, y, z, r, tn, tu, D.free);
      if (p > best) { best = p; for (let k = 0; k < 3; k++) { n[k] = tn[k]; u[k] = tu[k]; } }
    }
    const p = H.boxHit(x, y, z, r, tn);
    if (p > best) { best = p; for (let k = 0; k < 3; k++) { n[k] = tn[k]; u[k] = 0; } }
    return best;
  };
  const floaters = createFloaters({ water, block, terrainH: H.terrainH, terrainNormal: H.terrainNormal, half: H.HALF, rand: R, bubbles, wake: 0.3, collide });
  const boxes = createBoxes();
  const cranes = createCranes({ fleet, boxes, events });
  const story = createStory({ fleet, cranes, events, foam });
  const moorings = createMoorings({ water });
  const life = createLife({ water, fleet, moorings, cranes, events, rand: R, perches: PERCHES });
  // puffs: steam on the horn (white); funnel smoke (dark)
  const puffs = { white: Array.from({ length: PUFFS.white }, () => ({ on: false })), dark: Array.from({ length: PUFFS.dark }, () => ({ on: false })) };
  const KIND = { steam: ['white', 0.1, 1.8, 0.016], smoke: ['dark', 0.035, 3.0, 0.016] };
  const puff = (p, kind) => {
    const [pool, up, life_, size] = KIND[kind], q = puffs[pool].find((s) => !s.on);
    if (q) Object.assign(q, { on: true, kind, p: p.slice(), v: [(R() - 0.5) * 0.03 + 0.012, up * (0.6 + 0.8 * R()), (R() - 0.5) * 0.03], age: 0, life: life_ * (0.7 + 0.6 * R()), size: size * (0.7 + 0.6 * R()) });
  };
  const W = { water, block, bubbles, foam, floaters, fleet, boxes, cranes, story, moorings, life, puffs, events, time: 0, firm: 0.5, reduced: !!opts.reduced,
    tide: 0, level: H.SL, propA: 0, radarA: 0, lampA: 0, finger: null, rand: R, buoys: [] };

  W.setFirm = (f) => { W.firm = f; water.firm = f; };
  W.setDamp = (d) => { water.damp = d; };
  /** The tide, -1..1 (low to high water). */
  W.setTide = (t) => { W.tide = Math.max(-1, Math.min(1, t)); };
  // a finger in the water: the fish scatter from it
  const stir = water.stir;
  water.stir = (x, z, s) => { W.finger = [x, z, W.time]; return stir(x, z, s); };
  let acc = 0, shimmer = 0.4, seen = 0, smokeS = 0, smokeT = 0;
  function stepTick(quiet) {
    const dt = 1 / 120;
    if (seen > events.length) seen = 0;
    block.step(dt, W.firm, W.reduced);
    const { ship, tug } = fleet;
    if (!quiet) {
      ship.step(dt); tug.step(dt);
      story.tick(dt);
      cranes.step(dt);
      ship.feed(); tug.feed();
    }
    moorings.step(W.time);
    floaters.feed();
    for (let k = 0; k < 2; k++) floaters.step(dt / 2);
    for (const e of floaters.events) if (e.type === 'splash' || e.type === 'knock') events.push({ type: e.type, x: e.x, z: e.z, speed: e.speed });
    floaters.events.length = 0;
    const f = (0.6 * water.g()) / H.G;
    water.step(dt, block.g[0] * f, block.g[2] * f);
    if (!W.reduced && (shimmer -= dt) < 0) {   // idle shimmer: the sea is never dead flat
      shimmer = 0.25 + R() * 0.7;
      for (let t = 0; t < 10; t++) {
        const x = (R() * 2 - 1) * (H.HALF - 0.1), z = H.QZ + 0.1 + R() * (H.HALF - 0.1 - H.QZ);
        if (water.isWet(x, z)) { water.addVolume(x, z, (R() < 0.5 ? -1 : 1) * 0.00014, 0.05); break; }
      }
    }
    // the tide comes and goes slowly (3 cm a second at most)
    const d = H.SL + W.tide * H.TIDE - W.level;
    if (d !== 0) { W.level += Math.sign(d) * Math.min(Math.abs(d), 0.03 * dt); water.setLevel(W.level); }
    bubbles.step(dt, W.time);
    foam.step(dt);
    // smoke from the funnels, steam on the horn
    if (!quiet) {
      if ((smokeS -= dt) < 0) { smokeS = ship.moving ? 0.22 : 1.1; puff(A.apply(ship.matrix(), FUNNEL_TOP), 'smoke'); }
      if ((smokeT -= dt) < 0) { smokeT = tug.moving ? 0.3 : 1.5; puff(A.apply(tug.matrix(), TUG_FUNNEL), 'smoke'); }
    }
    for (const pool of [puffs.white, puffs.dark]) for (const q of pool) if (q.on) {
      q.age += dt;
      for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
      if (q.age > q.life) q.on = false;
    }
    const fresh = events.slice(seen);
    for (const e of fresh) if (e.type === 'horn') for (let i = 0; i < 7; i++) puff(A.apply(ship.matrix(), [FUNNEL_TOP[0] + 0.02, FUNNEL_TOP[1] + 0.005 * i, 0]), 'steam');
    if (!quiet) { life.finger = W.finger; life.step(dt, W.time, fresh); }
    seen = events.length;
    W.propA += (ship.moving ? Math.max(0.6, ship.v * 3) : 0.05) * dt * 20;
    W.radarA += dt * 2.4; W.lampA += dt * 0.7;
    if (events.length > 300) { events.splice(0, events.length - 300); seen = events.length; }
    W.time += dt;
  }
  W.reset = () => {
    water.flat(); block.reset(); foam.clear(); bubbles.reset();
    for (const pool of [puffs.white, puffs.dark]) for (const q of pool) q.on = false;
    fleet.reset(); boxes.reset(); cranes.reset(); story.reset();
    for (const b of [...floaters.bodies]) floaters.remove(b);
    W.buoys = LIFEBUOYS.map(([x, z]) => floaters.add({ spheres: RING, rho: 0.3, p: [x, W.level + 0.004, z], mu: 0.3, e: 0.3 }));
    life.reset();
    events.length = 0; seen = 0;
  };
  W.advance = (dt) => {
    acc += Math.min(dt, 0.1);
    let n = 0;
    while (acc >= 1 / 120 && n < 6) { stepTick(false); acc -= 1 / 120; n++; }
    if (n === 6) acc = 0;
  };
  W.step = (n = 1) => { for (let i = 0; i < n; i++) stepTick(false); };
  W.pick = (o, d) => floaters.pick(o, d) || pickBlock(o, d, { half: H.HALF, top: 1.75, terrainH: H.terrainH, water });
  /** Cast off early (alongside) or call her in (at sea). */
  W.go = () => story.go();
  W.horn = () => events.push({ type: 'horn' });
  W.feed = () => life.feed();
  W.tally = () => ({ moved: cranes.moved, voyages: story.voyages, fed: life.fed });
  W.reset();
  return W;
}
