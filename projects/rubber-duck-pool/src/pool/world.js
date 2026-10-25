// Rubber Duck Pool — the world: two bodies of water (the big pool on the stone, the round one on the lawn below
// it) with a steady current in each, the terrace (the engine's block, held level), the rubber ducks (popped out of
// the middle of the big pool, taken away, picked up and thrown, dressed), the water slide that carries them down
// from the big pool to the round one, the round pool's drain and the clear tube that carries them back up, two
// inflatables and a beach ball. Fixed steps at 120 Hz (the floating things twice over).
import { createShallowWater, terrainGrid, regionMap } from '@lid/diorama/water.js';
import { createBlock } from '@lid/diorama/block.js';
import { createBubbles } from '@lid/diorama/bubbles.js';
import { createFloaters } from '@lid/diorama/floaters.js';
import { createFoam } from '@lid/diorama/foam.js';
import { pickBlock } from '@lid/diorama/view.js';
import { P } from './layout.js';
import { DUCK_FLOAT, MAX_DUCKS, DESIGNS, PROPELLER, nameOf } from './ducks.js';
import { STATIONS } from './radio.js';
import { oceanAt } from './ocean.js';
import { offshore, isleH, isleNormal, isleSd } from './island.js';

const SPEED = 0.2;   // the current at 100%
const TUBE_SPEED = 1.8;   // the pump current carries ducks briskly through the clear return tube
const TUBE_EXIT_SPEED = 4.8;   // build the outlet speed inside the tube, then follow its downward mouth
const ARRIVE = [10, 20];   // a new duck every 10 to 20 seconds, of a design not in the pools yet, till all of them are
const DEFLATE = 4, REFILL = 45;
const ISLE_HALF = 9.8;   // the island's land reaches 9.55 from the middle   // seconds a held inflatable takes to go flat, and one let go to fill again
const SWAN_WAIT = 24;   // seconds between the swan's hops, give or take
const SWAN_HOP = 0.6, SWAN_LEAP = 1.3;   // its sideways speed on a hop, and on the leap into the pool
const SWAN_IN = 0.12, SWAN_OUT = 1 / 45;   // a second's chance that a duck the swan drifts into is scooped in, and that one inside hops out
const HOP_TIME = 0.45;   // a duck's hop over the swan's rim, in seconds
const DAY_SECONDS = 600;   // a whole day goes by in ten minutes
const FLY_WAIT = 25, FLY_OUT = 0.15, FLY_SPEED = 0.45, SEA_TIME = 120;   // a flyer's rest between flights (give or take), the share of flights out to sea, its speed, and how long it is in sight out there
const TAU = Math.PI * 2;
/** The floating toys, sized for people (their looks: props.js, made in Blender): a flamingo ring and a yellow ring
 * with an inflatable palm in the big pool, a beach ball on the lawn. */
const ring16 = (R, r) => Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * TAU; return [Math.cos(a) * R, 0, Math.sin(a) * R, r]; });
const ring = (R, r) => Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * TAU; return [Math.cos(a) * R, 0, Math.sin(a) * R, r]; });
export const TOYS = [
  { kind: 'flamingo', spheres: ring(0.3, 0.103), rho: 0.12, at: [-0.5 * P.K, P.LU + 0.02, -0.55 * P.K] },
  { kind: 'palmring', spheres: ring(0.28, 0.11), rho: 0.12, at: [0.6 * P.K, P.LU + 0.02, -0.2 * P.K] },
  { kind: 'ball', spheres: [[0, 0, 0, 0.165]], rho: 0.25, at: [-1.45 * P.K, P.LAWN + 0.17, 1.35 * P.K] },
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
  // things thrown or carried out of the courtyard land on the island round it (its ground, out to ISLE_HALF) and stop at
  // its coast, as at a wall: they never go into the sea (only a flyer does)
  const inYard = (x, z) => Math.abs(x) <= P.HALF && Math.abs(z) <= P.HALF;
  const groundN = (x, z, out) => (inYard(x, z) ? P.terrainNormal(x, z, out) : isleNormal(x, z));
  const coast = (x, y, z, r, n) => {
    if (inYard(x, z)) return 0;
    const pen = isleSd(x, z) + r;
    if (pen <= 0) return 0;
    const e = 0.02, gx = isleSd(x + e, z) - isleSd(x - e, z), gz = isleSd(x, z + e) - isleSd(x, z - e), gl = Math.hypot(gx, gz) || 1;
    n[0] = -gx / gl; n[1] = 0; n[2] = -gz / gl;
    return pen;
  };
  const floaters = createFloaters({ water, block, terrainH: isleH, terrainNormal: groundN, half: ISLE_HALF, rand: R, bubbles, wake: 0.35, current: cur, collide: coast });
  W.floaters = floaters;
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
    b.p = [P.DROP[0] + (R() - 0.5) * 1.2, P.DROP[1], P.DROP[2] + (R() - 0.5) * 0.9];
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
    events.push({ type: 'arrive', x: P.DROP[0], z: P.DROP[2], colour: d.colour, id: d.id });
    return d;
  };
  W.setCurrent = (k) => { W.currentK = Math.max(0, k); };
  W.setDamp = (d) => { water.damp = d; };
  /** The hand the view picks things up with: a duck taken up becomes the chosen one, off the slide. */
  W.hand = {
    grab(b) {
      if (b.duck) { W.selected = b.duck; if (['slide','pump','tube'].includes(b.duck.state)){b.duck.state='float';b.ghost=false;} events.push({ type: 'squeak', x: b.p[0], z: b.p[2], id: b.duck.id }); }
      floaters.grab(b);
    },
    hold: (b, p) => { const q = p.slice(), n = [0, 0, 0]; for (let k = 0, pen; k < 3 && (pen = coast(q[0], q[1], q[2], b.rad, n)) > 0; k++) { q[0] += n[0] * pen; q[2] += n[2] * pen; } floaters.hold(b, q); },   // never out over the sea
    throw: (b, v) => floaters.throw(b, v),
    /** A tap: a duck hops and spins with its design's visual burst ('voice' event: fx.js); a float bobs. */
    tap(b) {
      const d = b.duck;
      if (!d || d.state !== 'float') { b.v[1] += 0.8; events.push({ type: 'plop', x: b.p[0], z: b.p[2] }); return; }
      W.selected = d;
      b.v[1] = 2 * DESIGNS[d.colour].hop; b.w = [b.w[0], (R() < 0.5 ? -1 : 1) * (6 + 6 * R()), b.w[2]];
      events.push({ type: 'voice', colour: d.colour, id: d.id, x: b.p[0], y: b.p[1], z: b.p[2] });
    },
  };

  /** A flyer takes off: to somewhere else in the pools, or (FLY_OUT of the time) out over the open side or the beach to the sea. */
  function takeOff(d) {
    const b = d.body, out = R() < FLY_OUT;
    let to = null, dir = null;
    if (out) {
      const front = R() < 0.5, along = (R() * 2 - 1) * (P.HALF - 0.5), off = offshore(front, along) + 0.6 * R();   // past the island's shore
      dir = front ? [0, 1] : [1, 0];
      to = front ? [along, P.SEA - 0.02, off] : [off, P.SEA - 0.02, along];
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
      if (d.state === 'sea') {   // out on the open sea: riding the waves, drifting away from the cliff, in the end out of sight
        d.seaT += dt; d.spin = (d.spin || 0) + dt * 2;
        const t = d.fly.b, [ux, uz] = d.fly.dir, x = t[0] + ux * 0.05 * d.seaT, z = t[2] + uz * 0.05 * d.seaT, [h, gx, gz] = oceanAt(x, z, W.time);
        b.p = [x, P.SEA + h - 0.02, z];
        // tilted with the wave under it, still facing the way it flew
        const n = [-gx, 1, -gz], nl = Math.hypot(...n), c = Math.sqrt((1 + n[1] / nl) / 2), s = Math.sqrt((1 - n[1] / nl) / 2) / (Math.hypot(n[0], n[2]) || 1);
        const yaw = Math.atan2(uz, ux), qy = [0, Math.sin(-yaw / 2), 0, Math.cos(-yaw / 2)], qt = [n[2] * s, 0, -n[0] * s, c];
        b.q = [qt[3] * qy[0] + qt[0] * qy[3] + qt[1] * qy[2] - qt[2] * qy[1], qt[3] * qy[1] - qt[0] * qy[2] + qt[1] * qy[3] + qt[2] * qy[0], qt[3] * qy[2] + qt[0] * qy[1] - qt[1] * qy[0] + qt[2] * qy[3], qt[3] * qy[3] - qt[0] * qy[0] - qt[1] * qy[1] - qt[2] * qy[2]];
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
      if (d.state === 'pump') {
        d.s=Math.min(1,d.s+dt/.6);const a=d.pumpFrom,t=P.tube.at(0),k=d.s*d.s*(3-2*d.s);
        b.p=a.map((v,i)=>v+(t[i]-v)*k);b.v=[0,0,0];b.w=[0,0,0];
        if(d.s>=1){d.state='tube';d.s=0;d.vs=.8;}
        continue;
      }
      if (d.state === 'tube') {   // pumped up the clear tube, facing the way it is going; out of its mouth into the big pool
        const T = P.tube;
        const atOutlet = T.len - d.s < .65;
        d.vs = Math.min(atOutlet ? TUBE_EXIT_SPEED : TUBE_SPEED, d.vs + (atOutlet ? 18 : 2) * dt);
        d.s += d.vs * dt;
        const a = T.at(d.s - 0.03), p = T.at(d.s), yaw = Math.atan2(p[2] - a[2], p[0] - a[0]);
        const tangent=T.at(Math.min(T.len,d.s+.03)).map((v,i)=>v-a[i]),len=Math.hypot(...tangent)||1;
        const floorOffset=(-P.TUBE_R+.025)*Math.sqrt(Math.max(0,1-(tangent[1]/len)**2));
        b.p = [p[0], p[1] + floorOffset, p[2]]; b.v = [0, 0, 0]; b.w = [0, 0, 0]; b.q = [0, Math.sin(-yaw / 2), 0, Math.cos(-yaw / 2)];
        if (d.s >= T.len) {
          d.state = 'float'; W.returns++; d.laps++; b.ghost = false;
          // Keep the speed and full mouth direction; no separate upward kick or animated flight path.
          const end=T.at(T.len),back=T.at(T.len-.08),direction=end.map((v,i)=>v-back[i]),length=Math.hypot(...direction)||1;
          floaters.throw(b, direction.map(v=>v/length*d.vs));
          events.push({ type: 'pop', x: b.p[0], z: b.p[2] });
        }
        continue;
      }
      if (b.state === 'held') continue;
      if (d.hat === PROPELLER && (d.flyT = (d.flyT ?? FLY_WAIT) - dt) < 0) { takeOff(d); continue; }
      const reg = water.isWet(b.p[0], b.p[2]) ? water.regionAt(b.p[0], b.p[2]) : -1;
      // A duck touching the shallow entry step is carried back toward deep water, rather than left on the tile.
      if(reg===P.UP&&P.terrainH(b.p[0],b.p[2])>P.LU-.10){
        const dx=P.DROP[0]-b.p[0],dz=P.DROP[2]-b.p[2],len=Math.hypot(dx,dz)||1;
        b.v[0]+=dx/len*.65*W.currentK*dt;b.v[2]+=dz/len*.65*W.currentK*dt;
      }
      // near the slide's mouth, the outflow draws a duck in; one at a time onto the slide
      const dm = Math.hypot(b.p[0] - P.MOUTH[0], b.p[2] - P.MOUTH[1]);
      if (reg === P.UP && dm < 0.45) {
        const k = 0.25 * W.currentK * dt * (1 - dm / 0.45);
        b.v[0] += ((P.MOUTH[0] - b.p[0]) / (dm + 1e-3)) * k; b.v[2] += ((P.MOUTH[1] - b.p[2]) / (dm + 1e-3)) * k;
        const atIntake=dm<.11||(Math.abs(b.p[0]-P.MOUTH[0])<.14&&b.p[2]>P.MOUTH[1]);
        if(atIntake){
          if(!W.ducks.some(o=>o.state==='slide'&&o.s<.3)){
            floaters.grab(b);d.state='slide';d.s=0;d.vs=.15;
            events.push({type:'whee',x:b.p[0],z:b.p[2]});
          }else{
            // The intake gate holds the next duck in the pool until the preceding rider clears the flume.
            b.p[2]=Math.min(b.p[2],P.MOUTH[1]);b.v[2]=Math.min(0,b.v[2]);
          }
        }
      }
      d.inRound = reg === P.LO ? d.inRound + dt : 0;
    }
    for (const d of gone) { floaters.remove(d.body); W.ducks.splice(W.ducks.indexOf(d), 1); if (W.selected === d) W.selected = null; }
    for (const b of W.toys) {   // the toys float clear of the slide's mouth and the rim; one that ends up in the round pool comes back out of the fountain
      const dm = Math.hypot(b.p[0] - P.MOUTH[0], b.p[2] - P.MOUTH[1]);
      if (b.state !== 'held' && water.isWet(b.p[0], b.p[2]) && water.regionAt(b.p[0], b.p[2]) === P.UP) easeOffRim(b, b.reach, dt);
      const inLo = b.state !== 'held' && b.toy !== 'ball' && water.isWet(b.p[0], b.p[2]) && water.regionAt(b.p[0], b.p[2]) === P.LO;
      b.inRound = inLo ? (b.inRound || 0) + dt : 0;
      if (b.inRound > 15) { b.inRound = 0; b.p = [P.LANDING[0],P.LU+.12,P.LANDING[1]]; floaters.throw(b, [0, 0.1, 0.15]); events.push({ type: 'pop', x: b.p[0], z: b.p[2] }); }
      if (dm < 0.6 && b.state !== 'held') { const k = 0.3 * dt * (1 - dm / 0.6); b.v[0] += ((b.p[0] - P.MOUTH[0]) / (dm + 1e-3)) * k; b.v[2] += ((b.p[2] - P.MOUTH[1]) / (dm + 1e-3)) * k; }
    }
    // the drain: now and then it takes a duck that has come round to the middle of the round pool; the more
    // there are in the round pool, the oftener, so they don't pile up there while the big pool empties
    if ((drainT -= dt) < 0) {
      const crowd = W.ducks.reduce((n, x) => n + (x.state === 'float' && x.inRound > 0 ? 1 : 0), 0);
      drainT = 2.5 / Math.max(0.3, W.currentK) / Math.max(1, crowd / 6);
      let d = null, best = P.ROUND[2] * 0.7;
      for (const x of W.ducks) { const r = Math.hypot(x.body.p[0] - P.PUMP.at[0], x.body.p[2] - P.PUMP.at[1]); if (x.state === 'float' && x.body.state !== 'held' && x.inRound > 6 && r < best) { best = r; d = x; } }
      // a duck in the tube touches nothing outside it (ghost) until it drops out of the mouth
      if (d) { floaters.grab(d.body); d.body.ghost = true; d.pumpFrom=d.body.p.slice();d.state = 'pump'; d.s = 0; d.inRound = 0; events.push({ type: 'gurgle', x: P.PUMP.at[0], z: P.PUMP.at[1] }); }
    }
  }

  /** The big pool's rim stands only 0.05 above its water: a float reaching within a hand of it (reach: its outer
   * radius) is eased back toward the middle before it touches, so the current never holds it against the rim, where
   * it shook on the stone (or washes it over). */
  function easeOffRim(b, reach, dt) {
    const e = 0.02, over = reach + 0.06 + P.mainD(b.p[0], b.p[2]);
    if (over <= 0) return;
    const gx = P.mainD(b.p[0] + e, b.p[2]) - P.mainD(b.p[0] - e, b.p[2]), gz = P.mainD(b.p[0], b.p[2] + e) - P.mainD(b.p[0], b.p[2] - e), gl = Math.hypot(gx, gz) || 1;
    const out = (b.v[0] * gx + b.v[2] * gz) / gl;
    const push = (over * 3 + Math.max(0, out) * 0.4) * dt * 60;
    b.v[0] -= (gx / gl) * push; b.v[2] -= (gz / gl) * push;
  }

  // ----- the swan: on dry stone it creeps toward the big pool a hop at a time, then leaps in; afloat there it is a float
  // like any other (it can sit in the slide's mouth, or hold a duck in its ring); anywhere else (lifted out onto the stone,
  // washed over the rim into the round pool) it makes its way back -----
  /** A duck hops in an arc to 'to', or into the swan's ring at inRing [x, z] from its middle (its body carried, passing through things). */
  function hopDuck(d, to, inRing = null) {
    const sw = W.swan.p;
    if (inRing) to = [sw[0] + inRing[0], water.surface(sw[0], sw[2]) + 0.01, sw[2] + inRing[1]];
    floaters.grab(d.body); d.body.ghost = true; d.state = 'hop'; d.s = 0; d.hop = { a: d.body.p.slice(), b: to, inRing };
    events.push({ type: 'squeak', x: to[0], z: to[2], id: d.id });
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
      easeOffRim(b, S.R + S.r, dt);
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
    const k = wet ? 1.1 : leap ? SWAN_LEAP : SWAN_HOP, up = wet ? 2.5 : leap ? 1.5 : 0.9;   // up out of the round pool it has 0.2 more to climb
    floaters.throw(b, [(dx / d) * k, up, (dz / d) * k]);
    b.w = [0, 0, 0];   // a hop, not a tumble
    events.push({ type: leap ? 'leap' : 'hop', x: b.p[0], z: b.p[2] });
  }

  // The ring's many ground contacts can keep trading tiny angular impulses forever on a flat deck.
  // Settle that passive contact only; thrown/held bodies, slopes and buoyancy keep the full solver.
  function settleSwanOnDeck(dt) {
    const b=W.swan;
    if(b.state==='held'||b.sleep||b.submerged>0||b.ground>.02||Math.hypot(...b.v)>.16||Math.hypot(...b.w)>1.2||floaters.up(b)[1]<.98) { b.deckQuiet=0;return; }
    const heights=b.x.map(p=>isleH(p[0],p[2]));
    if(Math.max(...heights)-Math.min(...heights)>.004) { b.deckQuiet=0;return; }
    b.deckQuiet=(b.deckQuiet||0)+dt;
    if(b.deckQuiet<.2)return;
    const yaw=2*Math.atan2(b.q[1],b.q[3]);
    b.q=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];
    b.p[1]=Math.max(...heights)+P.SWAN.r+.0005;
    b.v=[0,0,0];b.w=[0,0,0];b.sleep=true;b.still=1;b.wetSleep=false;b.hSleep=-9;
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
  const PROPS = [{ kind: 'glass', at: P.HOURGLASS, r: 0.14 * P.SIZE.glass, h: 0.5 * P.SIZE.glass, y: P.TER }, { kind: 'radio', at: P.RADIO, r: 0.065 * P.SIZE.radio, h: 0.085 * P.SIZE.radio, y: P.TER },
    ...P.SEATS.map((s, seat) => ({ kind: 'seat', seat, at: s.at, r: 0.09 * P.SIZE.chair, h: 0.12 * P.SIZE.chair, y: s.y }))];

  let acc = 0, shimmer = 0.4;
  function stepTick() {
    const dt = 1 / 120;
    block.step(dt, W.firm, W.reduced);
    if (queue > 0 && (queueT -= dt) < 0) {   // new ducks dropped into the big pool
      queueT = 0.45; queue--;
      const d = makeDuck(P.DROP.slice(), W.next.colour, W.next.hat);
      if (d) { dropIn(d); events.push({ type: 'arrive', x: P.DROP[0], z: P.DROP[2], colour: d.colour, id: d.id }); }
    }
    if (W.arrivals && (W.arriveT -= dt) < 0) {   // now and then a duck of a design not in the pools yet drops in
      W.arriveT = ARRIVE[0] + (ARRIVE[1] - ARRIVE[0]) * R();
      const free = DESIGNS.map((_, i) => i).filter((i) => !W.ducks.some((d) => d.colour === i));
      const d = free.length ? makeDuck(P.DROP.slice(), free[Math.floor(R() * free.length)], 0) : null;
      if (d) { dropIn(d); events.push({ type: 'arrive', x: d.body.p[0], z: d.body.p[2], colour: d.colour, id: d.id }); }
    }
    // the inflatables (the rings and the swan): held, pressed or carried, the air goes out of them; let go, they fill again
    for (const b of W.inflatables) {
      const held = b.state === 'held';
      b.deflate = held ? Math.min(1, b.deflate + dt / DEFLATE) : Math.max(0, b.deflate - dt / REFILL);
    }
    if (W.day.run) W.day.hour = (W.day.hour + (dt * 24) / DAY_SECONDS) % 24;
    stepRides(dt);
    stepSwan(dt);
    stepGlass(dt);
    floaters.feed();
    for (let k = 0; k < 2; k++) floaters.step(dt / 2);
    settleSwanOnDeck(dt);
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
    // the slide's water running out onto the round pool
    const end = P.SLIDE[P.SLIDE.length - 1];
    foam.add(end[0] - 0.04, end[2] + (R() - 0.5) * 0.06, 0.35, 0.04);
    if (R() < 0.3) bubbles.emit(end[0] - 0.05 - R() * 0.08, P.LL - 0.03 - R() * 0.08, end[2] + (R() - 0.5) * 0.08, 0.003 + 0.006 * R());
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
    W.toys = TOYS.map((t) => { const b = floaters.add({ spheres: t.spheres, rho: t.rho, p: t.at.slice(), mu: 0.3, e: 0.5 }); b.toy = t.kind; b.reach = Math.max(...t.spheres.map(([x, , z, r]) => Math.hypot(x, z) + r)); return b; });
    const S = P.SWAN, yaw = Math.atan2(-(S.into[1] - S.at[1]), S.into[0] - S.at[0]);   // facing the pool
    W.swan = floaters.add({ spheres: ring16(S.R, S.r), rho: 0.1, p: [S.at[0], P.TER + S.r + 0.004, S.at[1]], q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], mu: 0.6, e: 0.2 });
    W.swan.toy = 'swan'; W.swanT = SWAN_WAIT * 0.5; W.swanAway = 9; W.swanLast = null;
    W.inflatables = [...W.toys.filter((b) => b.toy !== 'ball'), W.swan];
    for (const b of W.inflatables) b.deflate = 0;   // 0 full of air, 1 flat
    // the ducks already in the water (one, unless asked for more): most in the big pool, every fourth in the round one;
    // the first twelve each a design of its own; then more come in their own time (arrivals)
    const designs = DESIGNS.map((_, i) => i);
    for (let i = designs.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [designs[i], designs[j]] = [designs[j], designs[i]]; }
    for (let i = 0; i < (opts.ducks ?? 1); i++) {
      const a = R() * TAU, colour = i < designs.length ? designs[i] : Math.floor(R() * DESIGNS.length), hat = i < 6 ? 0 : Math.floor(R() * PROPELLER);   // any hat but the propeller (that is a flyer's)
      if (i % 4 === 3) makeDuck([P.ROUND[0] + Math.cos(a) * P.ROUND[2] * 0.6, P.LL + 0.04, P.ROUND[1] + Math.sin(a) * P.ROUND[2] * 0.6], colour, hat);
      else { const p = P.loop.at(((i * 0.618) % 1) * P.loop.len); makeDuck([p[0] + (R() - 0.5) * 0.15, P.LU + 0.04, p[1] + (R() - 0.5) * 0.15], colour, hat); }
    }
    W.arrivals = opts.arrivals !== false; W.arriveT = ARRIVE[0] + (ARRIVE[1] - ARRIVE[0]) * R();
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
