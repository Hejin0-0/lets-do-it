// Rubber Duck Pool — the world: two bodies of water (the big pool on the stone, the round one on the lawn below
// it) with a steady current in each, the terrace (the engine's block, held level), the rubber ducks (popped out of
// the middle of the big pool, taken away, picked up and thrown, dressed), the water slide that carries them down
// from the big pool to the round one, the round pool's drain and the clear tube that carries them back up, two
// inflatables and a beach ball, the fountain's spray. Fixed steps at 120 Hz (the floating things twice over).
import { createShallowWater, terrainGrid, regionMap } from '@lid/diorama/water.js';
import { createBlock } from '@lid/diorama/block.js';
import { createBubbles } from '@lid/diorama/bubbles.js';
import { createFloaters } from '@lid/diorama/floaters.js';
import { createFoam } from '@lid/diorama/foam.js';
import { pickBlock } from '@lid/diorama/view.js';
import { P } from './layout.js';
import { DUCK_FLOAT, MAX_DUCKS, DESIGNS, PROPELLER, nameOf } from './ducks.js';
import { STATIONS } from './radio.js';

export const SPRAY = 60;
const SPEED = 0.13;   // the current at 100%
const TUBE_SPEED = 0.6;   // up the tube
const SWAN_WAIT = 30;   // seconds between the swan's hops, give or take
const SWAN_HOP = 0.32, SWAN_LEAP = 0.95;   // its sideways speed on a hop, and on the leap into the pool
const SWAN_IN = 0.12, SWAN_OUT = 1 / 45;   // a second's chance that a duck the swan drifts into is scooped in, and that one inside hops out
const HOP_TIME = 0.45;   // a duck's hop over the swan's rim, in seconds
const DAY_SECONDS = 600;   // a whole day goes by in ten minutes
const FLY_WAIT = 25, FLY_OUT = 0.15, FLY_SPEED = 0.45, SEA_TIME = 120;   // a flyer's rest between flights (give or take), the share of flights out to sea, its speed, and how long it is in sight out there
const TAU = Math.PI * 2;
/** The floating toys: a flamingo ring and a sprinkled doughnut in the big pool, a beach ball on the lawn. */
const ring16 = (R, r) => Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * TAU; return [Math.cos(a) * R, 0, Math.sin(a) * R, r]; });
const ring = (R, r) => Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * TAU; return [Math.cos(a) * R, 0, Math.sin(a) * R, r]; });
export const TOYS = [
  { kind: 'flamingo', spheres: ring(0.07, 0.024), rho: 0.12, at: [-0.4, P.LU + 0.02, -0.45] },
  { kind: 'donut', spheres: ring(0.065, 0.026), rho: 0.12, at: [0.35, P.LU + 0.02, -0.15] },
  { kind: 'ball', spheres: [[0, 0, 0, 0.055]], rho: 0.25, at: [-1.45, P.LAWN + 0.06, 1.25] },
];

export function createWorld(opts = {}) {
  const R = P.rng(opts.seed || 14);
  const T = terrainGrid(P.GN, P.HALF, P.terrainH);
  const water = createShallowWater({ N: P.GN, half: P.HALF, terrain: T, regions: regionMap(P.GN, P.HALF, T, P.regionSeed), levels: [P.LU, P.LL] });
  const block = createBlock({ half: P.HALF, tiltMax: P.TILT_MAX, g: P.G });
  block.kick = () => {};   // the terrace is stone: a hard landing never wobbles it
  const bubbles = createBubbles({ water, rand: R, terrainH: P.terrainH, decor: 40, max: 300 });
  const foam = createFoam(P.GN, P.HALF);
  const events = [];
  const W = { water, block, bubbles, foam, events, time: 0, firm: 0.5, reduced: !!opts.reduced, currentK: 1, ducks: [], toys: [], selected: null,
    slides: 0, returns: 0, made: 0, next: { colour: 0, hat: 0 }, rand: R };
  const cur = (x, z, out) => { P.current(x, z, out); out[0] *= SPEED * W.currentK; out[1] *= SPEED * W.currentK; return out; };
  const floaters = createFloaters({ water, block, terrainH: P.terrainH, terrainNormal: P.terrainNormal, half: P.HALF, rand: R, bubbles, wake: 0.35, current: cur });
  W.floaters = floaters;
  // the fountain's spray: little balls flying in an arc into the big pool
  W.spray = Array.from({ length: SPRAY }, () => ({ on: false, p: [0, 0, 0], v: [0, 0, 0], age: 0, size: 0.008 }));
  const spray = (p, v) => { const q = W.spray.find((s) => !s.on); if (q) Object.assign(q, { on: true, p: p.slice(), v, age: 0, size: 0.006 + 0.005 * R() }); };

  // ----- the ducks -----
  const freeSlot = () => { for (let s = 0; s < MAX_DUCKS; s++) if (!W.ducks.some((d) => d.slot === s)) return s; return -1; };
  function makeDuck(p, colour, hat, v = [0, 0, 0]) {
    const slot = freeSlot();
    if (slot < 0) return null;
    const a = R() * TAU, body = floaters.add({ ...DUCK_FLOAT, p, q: [0, Math.sin(a / 2), 0, Math.cos(a / 2)] });
    body.v = v.slice(); body.w = [(R() - 0.5) * 2, (R() - 0.5) * 2, (R() - 0.5) * 2];
    const d = { slot, body, colour, hat, state: 'float', s: 0, vs: 0, wait: 0, laps: 0, id: ++W.made, inRound: 0 };
    d.name = nameOf(d.id);
    body.duck = d;
    W.ducks.push(d);
    return d;
  }
  /** Dropped in from above the middle of the big pool, tumbling a little. */
  function dropIn(d) {
    const b = d.body;
    b.p = [P.DROP[0] + (R() - 0.5) * 0.5, P.DROP[1], P.DROP[2] + (R() - 0.5) * 0.4];
    floaters.throw(b, [0, -0.2, 0]);
    b.w = [(R() - 0.5) * 3, (R() - 0.5) * 3, (R() - 0.5) * 3];
    d.state = 'float';
  }
  let queue = 0, queueT = 0;
  /** n more ducks dropped in, one after another. Returns how many will come. */
  W.addDucks = (n = 1) => { const k = Math.max(0, Math.min(n, MAX_DUCKS - W.ducks.length - queue)); queue += k; return k; };
  /** Take a duck away: the one picked last, or the newest. */
  W.removeDuck = () => {
    const d = W.selected || W.ducks[W.ducks.length - 1];
    if (!d) return false;
    floaters.remove(d.body);
    W.ducks.splice(W.ducks.indexOf(d), 1);
    if (W.selected === d) W.selected = null;
    return true;
  };
  /** Colour or dress the chosen duck (or the ones to come, with none chosen). */
  W.setColour = (i) => { if (W.selected) W.selected.colour = i; else W.next.colour = i; };
  W.setHat = (i) => { if (W.selected) W.selected.hat = i; else W.next.hat = i; };
  W.mixUp = () => { for (const d of W.ducks) { d.colour = Math.floor(R() * DESIGNS.length); if (d.hat !== PROPELLER) d.hat = Math.floor(R() * PROPELLER); } };   // a flyer keeps its propeller
  /** A flyer: a duck in a propeller cap, dropped into the big pool. Now and then it takes off; some flights take it out to sea. */
  W.addFlyer = () => {
    const d = makeDuck(P.DROP.slice(), W.next.colour, PROPELLER);
    if (!d) return null;
    dropIn(d); d.flyT = FLY_WAIT * (0.6 + 0.8 * R());
    events.push({ type: 'squeak', x: P.DROP[0], z: P.DROP[2] });
    return d;
  };
  W.setCurrent = (k) => { W.currentK = Math.max(0, k); };
  W.setDamp = (d) => { water.damp = d; };
  /** The hand the view picks things up with: a duck taken up becomes the chosen one (off the slide, squeaking). */
  W.hand = {
    grab(b) {
      if (b.duck) { W.selected = b.duck; if (b.duck.state === 'slide') b.duck.state = 'float'; events.push({ type: 'squeak', x: b.p[0], z: b.p[2] }); }
      floaters.grab(b);
    },
    hold: (b, p) => floaters.hold(b, p),
    throw: (b, v) => floaters.throw(b, v),
  };

  /** A flyer takes off: to somewhere else in the pools, or (FLY_OUT of the time) out over the open side or the beach to the sea. */
  function takeOff(d) {
    const b = d.body, out = R() < FLY_OUT;
    let to = null, dir = null;
    if (out) {
      const front = R() < 0.5, along = (R() * 2 - 1) * (P.HALF - 0.5), off = P.HALF + 0.6 + 0.6 * R();
      dir = front ? [0, 1] : [1, 0];
      to = front ? [along, -0.02, off] : [off, -0.02, along];
    } else {
      for (let k = 0; k < 30 && !to; k++) {
        const x = (R() * 2 - 1) * (P.HALF - 0.2), z = (R() * 2 - 1) * (P.HALF - 0.2);
        if (water.isWet(x, z) && Math.hypot(x - b.p[0], z - b.p[2]) > 0.5) to = [x, water.surface(x, z) + 0.02, z];
      }
      if (!to) { d.flyT = 5; return; }
    }
    const dist = Math.hypot(to[0] - b.p[0], to[2] - b.p[2]);
    floaters.grab(b); b.ghost = true; d.state = 'fly'; d.s = 0;
    d.fly = { a: b.p.slice(), b: to, T: 1.2 + dist / FLY_SPEED, H: 0.55 + 0.15 * dist, out, dir };
    events.push({ type: 'whee', x: b.p[0], z: b.p[2] });
  }

  // ----- the slide, the drain, the tube back up -----
  let drainT = 3;
  function stepRides(dt) {
    const S = P.slide, gone = [];
    for (const d of W.ducks) {
      const b = d.body;
      if (d.state === 'fly') {   // in the air under its propeller: up, across, down
        const f = d.fly, k = d.s * d.s * (3 - 2 * d.s);
        d.s = Math.min(1, d.s + dt / f.T); d.spin = (d.spin || 0) + dt * 45;
        b.p = [0, 1, 2].map((i) => f.a[i] + (f.b[i] - f.a[i]) * k + (i === 1 ? f.H * Math.sin(Math.PI * d.s) + 0.015 * Math.sin(W.time * 7) : 0));
        const yaw = Math.atan2(f.b[2] - f.a[2], f.b[0] - f.a[0]);
        b.q = [0, Math.sin(-yaw / 2), 0, Math.cos(-yaw / 2)]; b.v = [0, 0, 0]; b.w = [0, 0, 0];
        if (d.s >= 1) {
          if (f.out) { d.state = 'sea'; d.seaT = 0; W.escaped++; events.push({ type: 'escaped', x: b.p[0], z: b.p[2] }); }
          else { d.state = 'float'; b.ghost = false; floaters.throw(b, [0, -0.2, 0]); b.w = [0, 0, 0]; d.flyT = FLY_WAIT * (0.6 + 0.8 * R()); }
        }
        continue;
      }
      if (d.state === 'sea') {   // out on the open sea: bobbing, drifting away from the cliff, in the end out of sight
        d.seaT += dt; d.spin = (d.spin || 0) + dt * 2;
        const t = d.fly.b, [ux, uz] = d.fly.dir;
        b.p = [t[0] + ux * 0.05 * d.seaT, -0.02 + 0.012 * Math.sin(d.seaT * 2.1), t[2] + uz * 0.05 * d.seaT];
        if (d.seaT > SEA_TIME) gone.push(d);
        continue;
      }
      if (d.state === 'slide') {   // down the flume: faster as it goes, facing the way it is going
        d.vs = Math.min(0.9, d.vs + 0.9 * dt);
        d.s += d.vs * dt;
        const p = S.at(d.s), q = S.at(d.s + 0.03), yaw = Math.atan2(q[2] - p[2], q[0] - p[0]);
        b.p = [p[0], p[1] + 0.006, p[2]]; b.v = [0, 0, 0]; b.w = [0, 0, 0]; b.q = [0, Math.sin(-yaw / 2), 0, Math.cos(-yaw / 2)];
        if (d.s >= S.len) {
          d.state = 'float'; W.slides++;
          floaters.throw(b, [((q[0] - p[0]) / 0.03) * d.vs * 0.8, -0.05, ((q[2] - p[2]) / 0.03) * d.vs * 0.8]);
          events.push({ type: 'splash', x: b.p[0], z: b.p[2], speed: 1.2 });
        }
        continue;
      }
      if (d.state === 'hop') {   // over the swan's rim, in an arc
        const h = d.hop, sw = W.swan.p;
        if (h.inRing) h.b = [sw[0] + h.inRing[0], water.surface(sw[0], sw[2]) + 0.01, sw[2] + h.inRing[1]];   // into the ring wherever it has drifted
        d.s = Math.min(1, d.s + dt / HOP_TIME);
        b.p = [0, 1, 2].map((k) => h.a[k] + (h.b[k] - h.a[k]) * d.s + (k === 1 ? 0.16 * Math.sin(Math.PI * d.s) : 0)); b.v = [0, 0, 0]; b.w = [0, 0, 0];
        if (d.s >= 1) { d.state = 'float'; b.ghost = false; floaters.throw(b, [0, -0.1, 0]); b.w = [0, 0, 0]; }
        continue;
      }
      if (d.state === 'tube') {   // pumped up the clear tube, facing the way it is going; out of its mouth into the big pool
        const T = P.tube;
        d.s += TUBE_SPEED * dt;
        const a = T.at(d.s - 0.03), p = T.at(d.s), yaw = Math.atan2(p[2] - a[2], p[0] - a[0]);
        b.p = [p[0], p[1] - P.TUBE_R + 0.025, p[2]]; b.v = [0, 0, 0]; b.w = [0, 0, 0]; b.q = [0, Math.sin(-yaw / 2), 0, Math.cos(-yaw / 2)];
        if (d.s >= T.len) {
          d.state = 'float'; W.returns++; d.laps++; b.ghost = false;
          floaters.throw(b, [((p[0] - a[0]) / 0.03) * TUBE_SPEED, ((p[1] - a[1]) / 0.03) * TUBE_SPEED, ((p[2] - a[2]) / 0.03) * TUBE_SPEED]);
          events.push({ type: 'pop', x: b.p[0], z: b.p[2] });
        }
        continue;
      }
      if (b.state === 'held') continue;
      if (d.hat === PROPELLER && (d.flyT = (d.flyT ?? FLY_WAIT) - dt) < 0) { takeOff(d); continue; }
      const reg = water.isWet(b.p[0], b.p[2]) ? water.regionAt(b.p[0], b.p[2]) : -1;
      // near the slide's mouth, the outflow draws a duck in; one at a time onto the slide
      const dm = Math.hypot(b.p[0] - P.MOUTH[0], b.p[2] - P.MOUTH[1]);
      if (reg === P.UP && dm < 0.45) {
        const k = 0.25 * W.currentK * dt * (1 - dm / 0.45);
        b.v[0] += ((P.MOUTH[0] - b.p[0]) / (dm + 1e-3)) * k; b.v[2] += ((P.MOUTH[1] - b.p[2]) / (dm + 1e-3)) * k;
        if (dm < 0.11 && !W.ducks.some((o) => o.state === 'slide' && o.s < 0.3)) { floaters.grab(b); d.state = 'slide'; d.s = 0; d.vs = 0.15; events.push({ type: 'whee', x: b.p[0], z: b.p[2] }); }
      }
      d.inRound = reg === P.LO ? d.inRound + dt : 0;
    }
    for (const d of gone) { floaters.remove(d.body); W.ducks.splice(W.ducks.indexOf(d), 1); if (W.selected === d) W.selected = null; }
    for (const b of W.toys) {   // the toys float clear of the slide's mouth; one that ends up in the round pool comes back out of the fountain
      const dm = Math.hypot(b.p[0] - P.MOUTH[0], b.p[2] - P.MOUTH[1]);
      const inLo = b.state !== 'held' && b.toy !== 'ball' && water.isWet(b.p[0], b.p[2]) && water.regionAt(b.p[0], b.p[2]) === P.LO;
      b.inRound = inLo ? (b.inRound || 0) + dt : 0;
      if (b.inRound > 15) { b.inRound = 0; b.p = P.SPOUT.slice(); floaters.throw(b, [0, 0.6, 0.7]); events.push({ type: 'pop', x: b.p[0], z: b.p[2] }); }
      if (dm < 0.35 && b.state !== 'held') { const k = 0.3 * dt * (1 - dm / 0.35); b.v[0] += ((b.p[0] - P.MOUTH[0]) / (dm + 1e-3)) * k; b.v[2] += ((b.p[2] - P.MOUTH[1]) / (dm + 1e-3)) * k; }
    }
    // the drain: now and then it takes a duck that has come round to the middle of the round pool; the more
    // there are in the round pool, the oftener, so they don't pile up there while the big pool empties
    if ((drainT -= dt) < 0) {
      const crowd = W.ducks.reduce((n, x) => n + (x.state === 'float' && x.inRound > 0 ? 1 : 0), 0);
      drainT = 2.5 / Math.max(0.3, W.currentK) / Math.max(1, crowd / 6);
      let d = null, best = 0.32;
      for (const x of W.ducks) { const r = Math.hypot(x.body.p[0] - P.ROUND[0], x.body.p[2] - P.ROUND[1]); if (x.state === 'float' && x.body.state !== 'held' && x.inRound > 6 && r < best) { best = r; d = x; } }
      // a duck in the tube touches nothing outside it (ghost) until it drops out of the mouth
      if (d) { floaters.grab(d.body); d.body.ghost = true; d.state = 'tube'; d.s = 0; d.inRound = 0; events.push({ type: 'gurgle', x: P.ROUND[0], z: P.ROUND[1] }); }
    }
  }

  // ----- the swan: on dry stone it creeps toward the big pool a hop at a time, then leaps in; afloat there it is a float
  // like any other (it can sit in the slide's mouth, or hold a duck in its ring); anywhere else (lifted out onto the stone,
  // washed over the rim into the round pool) it makes its way back -----
  /** A duck hops in an arc to 'to', or into the swan's ring at inRing [x, z] from its middle (its body carried, passing through things). */
  function hopDuck(d, to, inRing = null) {
    const sw = W.swan.p;
    if (inRing) to = [sw[0] + inRing[0], water.surface(sw[0], sw[2]) + 0.01, sw[2] + inRing[1]];
    floaters.grab(d.body); d.body.ghost = true; d.state = 'hop'; d.s = 0; d.hop = { a: d.body.p.slice(), b: to, inRing };
    events.push({ type: 'squeak', x: to[0], z: to[2] });
  }
  /** Afloat, the swan scoops in a duck it drifts into (two at most), and now and then one inside hops out. */
  function scoop(dt) {
    const s = W.swan, c = s.p, S = P.SWAN, inner = S.R - S.r;
    const near = W.ducks.filter((d) => d.state === 'float' && d.body.state !== 'held').map((d) => ({ d, dx: d.body.p[0] - c[0], dz: d.body.p[2] - c[2] }));
    let inside = near.filter((q) => Math.hypot(q.dx, q.dz) < inner).length;
    for (const { d, dx, dz } of near) {
      const r = Math.hypot(dx, dz) || 1e-6, ux = dx / r, uz = dz / r;
      if (r < inner) {
        if (R() >= SWAN_OUT * dt) continue;
        for (const turn of [0, 1.6, -1.6, Math.PI]) {   // out over the rim the way it faces, else to the side or back: wherever there is water
          const ax = ux * Math.cos(turn) - uz * Math.sin(turn), az = ux * Math.sin(turn) + uz * Math.cos(turn), to = [c[0] + ax * (S.R + S.r + 0.12), 0, c[2] + az * (S.R + S.r + 0.12)];
          if (!water.isWet(to[0], to[2]) || water.regionAt(to[0], to[2]) !== P.UP) continue;
          to[1] = water.surface(to[0], to[2]) + 0.01; hopDuck(d, to); events.push({ type: 'swanOut', x: to[0], z: to[2] });
          break;
        }
      } else if (r < S.R + S.r + 0.1 && inside < 2) {
        const coming = (s.v[0] - d.body.v[0]) * ux + (s.v[2] - d.body.v[2]) * uz;   // the swan drifting into it
        if (coming > 0.01 && R() < SWAN_IN * dt) { hopDuck(d, null, [ux * 0.05, uz * 0.05]); inside++; events.push({ type: 'swanScoop', x: c[0], z: c[2] }); }
      }
    }
  }
  function stepSwan(dt) {
    const b = W.swan, S = P.SWAN;
    if (b.state === 'held') return;
    const wet = b.submerged > 0 && water.isWet(b.p[0], b.p[2]), home = wet && water.regionAt(b.p[0], b.p[2]) === P.UP;
    if (home) {
      if (W.swanAway > 1.5) events.push({ type: 'swanIn', x: b.p[0], z: b.p[2] });   // back after a real absence, not a bob
      W.swanAway = 0;
      // the rim stands only 0.05 above the water: where the ring rides over it, it is eased back toward the middle,
      // so the current does not wash it over the edge
      const e = 0.02, over = S.R + S.r + P.mainD(b.p[0], b.p[2]);
      if (over > 0) {
        const gx = P.mainD(b.p[0] + e, b.p[2]) - P.mainD(b.p[0] - e, b.p[2]), gz = P.mainD(b.p[0], b.p[2] + e) - P.mainD(b.p[0], b.p[2] - e), gl = Math.hypot(gx, gz) || 1;
        const out = (b.v[0] * gx + b.v[2] * gz) / gl;
        const push = (over * 3 + Math.max(0, out) * 0.4) * dt * 60;
        b.v[0] -= (gx / gl) * push; b.v[2] -= (gz / gl) * push;
      }
      scoop(dt);
      return;
    }
    W.swanAway += dt;
    if ((!wet && b.ground > 0.05) || (W.swanT -= dt) > 0) return;   // a hop from standing on the ground, or a leap out of the round pool
    W.swanT = SWAN_WAIT * (0.7 + 0.6 * R());
    const dx = S.into[0] - b.p[0], dz = S.into[1] - b.p[2], d = Math.hypot(dx, dz) || 1;
    const moved = W.swanLast ? Math.hypot(b.p[0] - W.swanLast[0], b.p[2] - W.swanLast[1]) : 1;
    W.swanLast = [b.p[0], b.p[2]];
    const leap = wet || P.mainD(b.p[0], b.p[2]) < S.R + 0.2 || moved < 0.02;   // out of the round pool, at the edge, or stuck at a step: a leap
    const k = wet ? 1.1 : leap ? SWAN_LEAP : SWAN_HOP, up = wet ? 2.5 : leap ? 1.5 : 0.6;   // up out of the round pool it has 0.2 more to climb
    floaters.throw(b, [(dx / d) * k, up, (dz / d) * k]);
    b.w = [0, 0, 0];   // a hop, not a tumble
    events.push({ type: leap ? 'leap' : 'hop', x: b.p[0], z: b.p[2] });
  }

  // ----- the hourglass (a minute of sand; when it has run out it is turned over, or when clicked) and the radio -----
  const GLASS_RUN = 60, GLASS_TURN = 1.4;
  W.turnGlass = () => { if (W.glass.turn) return false; W.glass.turn = 1e-3; events.push({ type: 'turn', x: P.HOURGLASS[0], z: P.HOURGLASS[1] }); return true; };
  /** The time of day: set the hour (0 to 24), or stop and start the clock. */
  W.setHour = (h) => { W.day.hour = ((h % 24) + 24) % 24; };
  W.setDayRun = (v) => { W.day.run = !!v; };
  /** Turn the radio's dial to the next station, or off after the last. Returns the station (0: off). */
  W.tuneRadio = () => { W.station = (W.station + 1) % (STATIONS.length + 1); W.radio = W.station > 0; events.push({ type: 'radio', x: P.RADIO[0], z: P.RADIO[1] }); return W.station; };
  function stepGlass(dt) {   // s: the share of the sand run down; turn: 0 standing, else how far over it is
    const g = W.glass;
    if (g.turn) { if ((g.turn += dt / GLASS_TURN) >= 1) { g.turn = 0; g.s = 1 - g.s; g.wait = 0; } }
    else if (g.s < 1) g.s = Math.min(1, g.s + dt / GLASS_RUN);
    else if ((g.wait += dt) > 4) W.turnGlass();
  }
  /** A ray against an upright cylinder (centre x, z, radius r, from y0 to y1): how far along it, or -1. */
  function rayCyl(o, d, cx, cz, r, y0, y1) {
    const ox = o[0] - cx, oz = o[2] - cz, a = d[0] * d[0] + d[2] * d[2], b = ox * d[0] + oz * d[2], c = ox * ox + oz * oz - r * r;
    if (a > 1e-9 && b * b - a * c >= 0) for (const t of [(-b - Math.sqrt(b * b - a * c)) / a, (-b + Math.sqrt(b * b - a * c)) / a]) { const y = o[1] + d[1] * t; if (t > 0 && y >= y0 && y <= y1) return t; }
    if (Math.abs(d[1]) > 1e-9) { const t = (y1 - o[1]) / d[1]; if (t > 0 && Math.hypot(o[0] + d[0] * t - cx, o[2] + d[2] * t - cz) <= r) return t; }
    return -1;
  }
  const PROPS = [{ kind: 'glass', at: P.HOURGLASS, r: 0.14, h: 0.5, y: P.TER }, { kind: 'radio', at: P.RADIO, r: 0.065, h: 0.085, y: P.TER },
    ...P.SEATS.map((s, seat) => ({ kind: 'seat', seat, at: s.at, r: 0.09, h: 0.12, y: s.y }))];

  let acc = 0, shimmer = 0.4, sprayT = 0;
  function stepTick() {
    const dt = 1 / 120;
    block.step(dt, W.firm, W.reduced);
    if (queue > 0 && (queueT -= dt) < 0) {   // new ducks dropped into the big pool
      queueT = 0.45; queue--;
      const d = makeDuck(P.DROP.slice(), W.next.colour, W.next.hat);
      if (d) { dropIn(d); events.push({ type: 'squeak', x: P.DROP[0], z: P.DROP[2] }); }
    }
    if (W.day.run) W.day.hour = (W.day.hour + (dt * 24) / DAY_SECONDS) % 24;
    stepRides(dt);
    stepSwan(dt);
    stepGlass(dt);
    floaters.feed();
    for (let k = 0; k < 2; k++) floaters.step(dt / 2);
    for (const e of floaters.events) if (e.type === 'splash' || e.type === 'knock' || e.type === 'land') events.push({ type: e.type, x: e.x, z: e.z, speed: e.speed });
    floaters.events.length = 0;
    for (const x of [...W.ducks.filter((d) => d.state === 'float').map((d) => d.body), ...W.toys, W.swan]) {   // anything lost off the edge comes back into the big pool
      if (x.state !== 'held' && (x.p[1] < 0.4 || !x.p.every(Number.isFinite))) { if (x.duck) dropIn(x.duck); else Object.assign(x, { p: [P.LANDING[0], P.LU + 0.1, P.LANDING[1]], v: [0, 0, 0], w: [0, 0, 0] }); }
    }
    const f = (0.6 * water.g()) / P.G;
    water.step(dt, block.g[0] * f, block.g[2] * f);
    if (!W.reduced && (shimmer -= dt) < 0) {   // idle shimmer: the water is never dead flat
      shimmer = 0.25 + R() * 0.5;
      for (let t = 0; t < 10; t++) {
        const x = (R() * 2 - 1) * (P.HALF - 0.1), z = (R() * 2 - 1) * (P.HALF - 0.1);
        if (water.isWet(x, z)) { water.addVolume(x, z, (R() < 0.5 ? -1 : 1) * 0.00012, 0.05); break; }
      }
    }
    // the slide's water running out onto the round pool; the fountain's arc of spray
    const end = P.SLIDE[P.SLIDE.length - 1];
    foam.add(end[0] - 0.04, end[2] + (R() - 0.5) * 0.06, 0.35, 0.04);
    if (R() < 0.3) bubbles.emit(end[0] - 0.05 - R() * 0.08, P.LL - 0.03 - R() * 0.08, end[2] + (R() - 0.5) * 0.08, 0.003 + 0.006 * R());
    if (!W.reduced && (sprayT -= dt) < 0) {
      sprayT = 0.03;
      spray([P.SPOUT[0], P.SPOUT[1] - 0.02, P.SPOUT[2] + 0.03], [(R() - 0.5) * 0.08, 0.55 + R() * 0.15, 0.55 + R() * 0.15]);
    }
    for (const q of W.spray) if (q.on) {
      q.age += dt; q.v[1] -= 3.2 * dt;
      for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
      if (q.v[1] < 0 && q.p[1] < water.surface(q.p[0], q.p[2]) && water.isWet(q.p[0], q.p[2])) { water.addVolume(q.p[0], q.p[2], -0.00002, 0.03); foam.add(q.p[0], q.p[2], 0.15, 0.03); q.on = false; }
      else if (q.age > 3 || q.p[1] < 0.5) q.on = false;
    }
    bubbles.step(dt, W.time);
    foam.step(dt);
    if (events.length > 300) events.splice(0, events.length - 300);
    W.time += dt;
  }
  W.reset = () => {
    water.flat(); block.reset(); foam.clear(); bubbles.reset();
    for (const b of [...floaters.bodies]) floaters.remove(b);
    W.ducks = []; W.selected = null; W.slides = 0; W.returns = 0; W.made = 0; W.escaped = 0; queue = 0;
    W.glass = { s: 0.35, turn: 0, wait: 0 }; W.radio = false; W.station = 0; W.day = { hour: 15, run: true };
    for (const q of W.spray) q.on = false;
    W.toys = TOYS.map((t) => { const b = floaters.add({ spheres: t.spheres, rho: t.rho, p: t.at.slice(), mu: 0.3, e: 0.5 }); b.toy = t.kind; return b; });
    const S = P.SWAN, yaw = Math.atan2(-(S.into[1] - S.at[1]), S.into[0] - S.at[0]);   // facing the pool
    W.swan = floaters.add({ spheres: ring16(S.R, S.r), rho: 0.1, p: [S.at[0], P.TER + S.r + 0.004, S.at[1]], q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], mu: 0.6, e: 0.2 });
    W.swan.toy = 'swan'; W.swanT = SWAN_WAIT * 0.5; W.swanAway = 9; W.swanLast = null;
    // a dozen ducks already in the water: most in the big pool, a few in the round one
    for (let i = 0; i < (opts.ducks ?? 12); i++) {
      const a = R() * TAU;
      if (i % 4 === 3) makeDuck([P.ROUND[0] + Math.cos(a) * 0.28, P.LL + 0.04, P.ROUND[1] + Math.sin(a) * 0.28], Math.floor(R() * DESIGNS.length), Math.floor(R() * PROPELLER));
      else { const p = P.loop.at(((i * 0.618) % 1) * P.loop.len); makeDuck([p[0] + (R() - 0.5) * 0.15, P.LU + 0.04, p[1] + (R() - 0.5) * 0.15], i < 4 ? 0 : Math.floor(R() * DESIGNS.length), i < 6 ? 0 : Math.floor(R() * PROPELLER)); }   // any hat but the propeller (that is a flyer's)
    }
    events.length = 0;
  };
  W.advance = (dt) => {
    acc += Math.min(dt, 0.1);
    let n = 0;
    while (acc >= 1 / 120 && n < 6) { stepTick(); acc -= 1 / 120; n++; }
    if (n === 6) acc = 0;
  };
  W.step = (n = 1) => { for (let i = 0; i < n; i++) stepTick(); };
  W.pick = (o, d) => {   // a floating thing, the hourglass, the radio or a seat (whichever is nearer), else the open water; the ground is not picked (a drag there looks round)
    const hit = floaters.pick(o, d);
    let prop = null;
    for (const q of PROPS) { const t = rayCyl(o, d, q.at[0], q.at[1], q.r, q.y, q.y + q.h); if (t > 0 && (!prop || t < prop.t)) prop = { kind: q.kind, seat: q.seat, t }; }
    if (prop && (!hit || prop.t < hit.t)) return prop;
    if (hit) return hit;
    const g = pickBlock(o, d, { half: P.HALF, top: P.PORCH + 0.1, terrainH: P.terrainH, water });
    return g && g.kind === 'water' ? g : null;
  };
  W.tally = () => ({ ducks: W.ducks.length, slides: W.slides, returns: W.returns, escaped: W.escaped });
  W.reset();
  return W;
}
