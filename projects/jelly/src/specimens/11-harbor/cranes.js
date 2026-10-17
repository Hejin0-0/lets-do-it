// Harbor Jelly — two ship-to-shore gantry cranes on the quay's rails, one red, one blue. Each: portal legs on
// bogies, a backreach with its machinery house, an A-frame with backstays and forestays, a boom whose outreach
// hinges up over the water, a trolley with a hanging cab, a yellow spreader on four wire falls. A move is one
// smooth sequence: travel and trolley to the box, lower onto it (following the ship as she bobs), latch, hoist,
// carry, lower, unlatch, hoist. The red crane works one of the ship's after bays and its lane in the west, the
// blue one a forward bay (at least three bays on) and its lane in the east, so they keep clear of each other;
// an idle crane still gets out of the other's way.
import { A, MAT } from '../../core/diorama/parts.js';
import { H } from './layout.js';
import { BOX, LANES, LANE_MAX, shipSlot, laneSlot } from './boxes.js';

const P = H.DECK + 0.36;   // the portal's top
export const CRANE = {
  half: 0.11, width: 0.25, P, BY: H.DECK + 0.47, AY: H.DECK + 0.74, ZA: H.RS - 0.1, ZB: H.QZ - 0.64,
  OUT: H.QZ + 0.36 - H.RS, TRAVEL: H.DECK + 0.21, PARK_Z: H.RS - 0.13, RAISED: 1.32, COLS: ['#c23a2c', '#2e62b5'],
  HOME: [-1.95, -0.6],
};
const C = CRANE;
/** The bays each cycle: [red, blue], always at least three bays apart. */
const PAIRS = [[0, 4], [1, 5], [0, 3], [2, 5], [1, 4], [0, 5]];

// ----- models: the gantry (x-centred, block y and z), the outreach (from its hinge), the trolley, the spreader -----
export function buildGantry(B, k) {
  const col = C.COLS[k], hx = C.half;
  B.col(col).mat(MAT.PAINT);
  for (const z of [H.RS, H.RL]) for (const s of [-1, 1]) {
    B.slab(s * hx - 0.008, H.DECK + 0.025, z - 0.008, s * hx + 0.008, P, z + 0.008);   // a leg
    B.col('#3a3a3a').mat(MAT.METAL).slab(s * hx - 0.028, H.DECK + 0.004, z - 0.011, s * hx + 0.028, H.DECK + 0.025, z + 0.011);   // its bogie
    B.col(col).mat(MAT.PAINT);
  }
  for (const s of [-1, 1]) {
    B.slab(s * hx - 0.007, H.DECK + 0.03, H.RL, s * hx + 0.007, H.DECK + 0.045, H.RS);   // the sill beam
    B.slab(s * hx - 0.009, P, H.RL - 0.01, s * hx + 0.009, P + 0.022, H.RS + 0.01);      // the portal's side beams
  }
  for (const z of [H.RS, H.RL]) B.slab(-hx - 0.009, P, z - 0.009, hx + 0.009, P + 0.022, z + 0.009);   // its cross beams
  // the boom's fixed part: two girders from the backreach's end to the hinge, cross members, posts
  for (const s of [-1, 1]) B.slab(s * 0.045 - 0.007, C.BY, C.ZB, s * 0.045 + 0.007, C.BY + 0.024, H.RS);
  for (let z = C.ZB + 0.02; z < H.RS; z += 0.07) B.slab(-0.045, C.BY + 0.018, z - 0.004, 0.045, C.BY + 0.024, z + 0.004);
  for (const s of [-1, 1]) for (const z of [H.RS, H.RL]) B.slab(s * hx - 0.006, P + 0.02, z - 0.006, s * hx + 0.006, C.BY + 0.01, z + 0.006);
  for (const z of [H.RS, H.RL]) B.slab(-hx - 0.006, C.BY + 0.004, z - 0.006, hx + 0.006, C.BY + 0.014, z + 0.006);
  // the A-frame and its backstays
  for (const s of [-1, 1]) {
    B.tube([[s * hx, C.BY, H.RS], [s * hx * 0.6, C.AY, C.ZA]], 0.007, 6);
    B.tube([[s * hx, C.BY, H.RL], [s * hx * 0.6, C.AY, C.ZA]], 0.007, 6);
    B.tube([[s * hx * 0.6, C.AY, C.ZA], [s * 0.045, C.BY + 0.024, C.ZB + 0.03]], 0.0025, 4);
  }
  B.slab(-hx * 0.6 - 0.006, C.AY - 0.006, C.ZA - 0.006, hx * 0.6 + 0.006, C.AY + 0.008, C.ZA + 0.006);
  // the machinery house on the backreach
  B.col('#eeeeea').slab(-0.07, C.BY + 0.024, C.ZB, 0.07, C.BY + 0.085, C.ZB + 0.13);
  B.col(col).slab(-0.0705, C.BY + 0.07, C.ZB - 0.0005, 0.0705, C.BY + 0.078, C.ZB + 0.1305);
}
export function buildOutreach(B, k) {
  B.col(C.COLS[k]).mat(MAT.PAINT);
  for (const s of [-1, 1]) B.slab(s * 0.045 - 0.007, 0, 0, s * 0.045 + 0.007, 0.024, C.OUT);
  for (let z = 0.03; z < C.OUT; z += 0.06) B.slab(-0.045, 0.018, z - 0.004, 0.045, 0.024, z + 0.004);
  B.slab(-0.052, 0, C.OUT - 0.012, 0.052, 0.03, C.OUT);
  B.col('#f2c22a').mat(MAT.GLOW).at(A.t(0, 0.034, C.OUT - 0.006), () => B.ball(0.004));   // the boom-tip light
}
export function buildTrolley(B) {
  B.col('#4a4f55').mat(MAT.METAL).slab(-0.038, -0.022, -0.028, 0.038, 0, 0.028);
  B.col('#eeeeea').mat(MAT.PAINT).slab(-0.03, -0.056, 0.004, 0.0, -0.022, 0.034);   // the cab
  B.col('#1e2a33').mat(MAT.GLASS).slab(-0.031, -0.052, 0.0335, 0.001, -0.03, 0.0345);
}
export function buildSpreader(B) {
  B.col('#f2c22a').mat(MAT.PAINT).slab(-BOX.L / 2, 0, -BOX.W / 2 + 0.002, BOX.L / 2, 0.009, BOX.W / 2 - 0.002);
  B.slab(-0.012, 0.009, -0.012, 0.012, 0.02, 0.012);
  B.col('#2a2a2a').mat(MAT.METAL);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.slab(sx * BOX.L / 2 - 0.004, -0.003, sz * BOX.W / 2 - 0.004, sx * BOX.L / 2 + 0.004, 0.001, sz * BOX.W / 2 + 0.004);
}

// ----- the cranes at work -----
/** o: { fleet, boxes, events } */
export function createCranes({ fleet, boxes: K, events }) {
  const ship = fleet.ship;
  const CR = { list: [], moved: 0, unloaded: 0, loaded: 0, plan: { unload: 0, load: 0 }, boomGoal: C.RAISED, dt: 1 / 120 };
  const axis = (s, key, target, vmax, acc, dt) => {   // a smooth drive: accelerate, cruise, brake to stop on the target
    const d = target - s[key], vk = 'v' + key;
    if (Math.abs(d) < 1e-4 && Math.abs(s[vk]) < 0.02) { s[key] = target; s[vk] = 0; return true; }
    const want = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * acc * Math.abs(d)) * 0.95);
    s[vk] += Math.max(-acc * dt, Math.min(acc * dt, want - s[vk]));
    s[key] += s[vk] * dt;
    if ((target - s[key]) * d <= 0) { s[key] = target; s[vk] = 0; return true; }   // no overshoot
    return false;
  };
  /** Where a slot's box floor is, in the block (a ship's slot follows the ship). */
  const slotPos = (r) => (r.at === 'ship' ? A.apply(ship.matrix(), shipSlot(r.bay, r.row, r.tier)) : laneSlot(r.lane, r.s, r.tier));
  const laneDest = (lane) => {   // the lowest stack in the lane
    let best = -1, h = LANE_MAX;
    LANES[lane].forEach((_, s) => { const n = K.stack(lane, s).length; if (n < h) { h = n; best = s; } });
    return best < 0 ? null : { at: 'lane', lane, s: best, tier: h };
  };
  const laneTop = (lane, not) => {   // the top of the tallest stack, rather not one just landed
    for (const pass of [0, 1]) {
      let pick = null, h = 0;
      LANES[lane].forEach((_, s) => { const st = K.stack(lane, s), t = st[st.length - 1]; if (t && st.length > h && (pass || !not.has(t.id))) { h = st.length; pick = t; } });
      if (pick) return pick;
    }
    return null;
  };
  const shipDest = (bay) => {   // the lowest free slot in the bay
    for (let tier = 0; tier < 2; tier++) for (let row = 0; row < 4; row++) if (!K.onShip(bay, row, tier)) return { at: 'ship', bay, row, tier };
    return null;
  };

  function makeCrane(k) {
    const c = { k };
    const other = () => CR.list[1 - k];
    function* driveTo(x, z) {   // up to travel height, then travel and trolley together; wait for room
      c.settle = false;
      while (!axis(c, 'sy', C.TRAVEL + (c.box ? BOX.H : 0), 1.0, 2.4, CR.dt)) yield;
      c.wantX = x;
      while (Math.abs(x - other().x) < C.width) yield;
      for (;;) {
        const a = axis(c, 'x', x, 1.25, 2.0, CR.dt), b = axis(c, 'tz', z, 1.45, 2.5, CR.dt);
        if (a && b) break;
        yield;
      }
      c.wantX = null;
    }
    function* lowerTo(yFn) { c.settle = true; while (!axis(c, 'sy', yFn(), 0.8, 2.0, CR.dt)) yield; }   // (the driver checks the swing as it goes down)
    function* hold(s) { for (let t = 0; t < s; t += CR.dt) yield; }
    function* move(src, destFn) {
      yield* driveTo(...((p) => [p[0], p[2]])(slotPos(src)));
      yield* lowerTo(() => slotPos(src)[1] + BOX.H);
      yield* hold(0.2);
      events.push({ type: 'latch', x: c.x, z: c.tz });
      const fromShip = src.at === 'ship';
      Object.assign(src, { at: 'hook', crane: k }); c.box = src;
      const dst = destFn() || laneDest(k);   // where it goes, chosen now from where things stand
      yield* driveTo(...((p) => [p[0], p[2]])(slotPos(dst)));
      yield* lowerTo(() => slotPos(dst)[1] + BOX.H);
      yield* hold(0.2);
      events.push({ type: 'latch', x: c.x, z: c.tz });
      Object.assign(src, dst, { crane: -1 }); c.box = null;
      CR.moved++;
      if (fromShip) CR.unloaded++; else CR.loaded++;
    }
    function* stepAside() {   // idle: home, or further off if the other wants to stop near it
      const o = other(), home = C.HOME[k];
      const go = o.wantX !== null && Math.abs(c.x - o.wantX) < C.width ? home + (k ? 0.3 : -0.3) : home;
      if (Math.abs(c.x - go) > 1e-3 && c.boom < 1e-3) yield* driveTo(go, C.PARK_Z);
    }
    c.run = function* () {
      for (;;) {
        if (!c.jobs.length) { c.idle = true; yield* stepAside(); yield; continue; }
        c.idle = false;
        const job = c.jobs.shift();
        if (job.kind === 'unload') { if (job.box.at === 'ship') yield* move(job.box, () => laneDest(k)); }
        else if (shipDest(job.bay)) { const src = laneTop(k, job.moved); if (src) yield* move(src, () => shipDest(job.bay)); }
      }
    };
    c.reset = () => { Object.assign(c, { x: C.HOME[k], tz: C.PARK_Z, sy: C.BY - 0.05, boom: C.RAISED, vx: 0, vtz: 0, vsy: 0, vboom: 0, jobs: [], box: null, wantX: null, idle: true, bay: -1, sw: [0, 0, 0, 0], pv: [0, 0], settle: false }); c.gen = c.run(); };
    c.reset();
    return c;
  }
  CR.list = [makeCrane(0), makeCrane(1)];
  CR.busy = () => CR.list.some((c) => c.jobs.length || c.box || !c.idle);
  /** Cycle n's work: each crane unloads the top tier of one bay into its lane, then fills the bay again from the lane. */
  CR.planCycle = (n) => {
    const pair = PAIRS[n % PAIRS.length];
    CR.plan = { unload: 0, load: 0 }; CR.unloaded = 0; CR.loaded = 0;
    CR.list.forEach((c, i) => {
      const bay = (c.bay = pair[i]);
      const on = K.all.filter((x) => x.at === 'ship' && x.bay === bay);
      const top = Math.max(-1, ...on.map((x) => x.tier));
      const take = on.filter((x) => x.tier === top).sort((a, b) => a.row - b.row).slice(0, 4);
      const moved = new Set(take.map((x) => x.id)), loads = Math.min(4, 8 - on.length + take.length);
      for (const box of take) c.jobs.push({ kind: 'unload', box });
      for (let j = 0; j < loads; j++) c.jobs.push({ kind: 'load', bay, moved });
      CR.plan.unload += take.length; CR.plan.load += loads;
    });
  };
  /** Cast off early: each crane finishes the box in its spreader and stops. */
  CR.finishInHand = () => { for (const c of CR.list) c.jobs.length = 0; };
  CR.boomsUp = () => { CR.boomGoal = C.RAISED; };
  CR.boomsDown = () => { CR.boomGoal = 0; };
  CR.boomsAt = (g) => CR.list.every((c) => c.boom === g);
  CR.step = (dt) => {
    CR.dt = dt;
    for (const c of CR.list) {
      if (c.boom === CR.boomGoal || c.jobs.length || c.box) c.gen.next();
      else {   // the booms: the trolley parks landside of the hinge, the spreader goes up, then the outreach swings
        const a = axis(c, 'tz', C.PARK_Z, 0.7, 1.2, dt), b = axis(c, 'sy', C.BY - 0.05, 0.55, 1.1, dt);
        if (a && b) axis(c, 'boom', CR.boomGoal, 0.75, 0.65, dt);
      }
      swing(c, dt);
    }
  };
  /** The spreader swings on its falls like a pendulum, pushed by the gantry's and the trolley's starts and stops;
   *  only drawn (sw: offset x, z and their rates), and damped hard while it is lowered onto a stack. */
  function swing(c, dt) {
    const L = Math.max(0.04, C.BY - c.sy), w = Math.sqrt(9.8 / L), steady = c.settle ? Math.exp(-8 * dt) : 1;
    [c.vx, c.vtz].forEach((v, k) => {
      const a = (v - c.pv[k]) / dt; c.pv[k] = v;
      const acc = -w * w * c.sw[k] - 2 * 0.12 * w * c.sw[k + 2] - a * 0.15;   // small swings (the offset as the angle times the length), pushed gently: a picture of a swing, not a crane driver's nightmare
      c.sw[k + 2] = (c.sw[k + 2] + acc * dt) * steady; c.sw[k] = Math.max(-0.03, Math.min(0.03, (c.sw[k] + c.sw[k + 2] * dt) * steady));
    });
  }
  CR.reset = () => { for (const c of CR.list) c.reset(); CR.moved = 0; CR.unloaded = 0; CR.loaded = 0; CR.boomGoal = C.RAISED; CR.plan = { unload: 0, load: 0 }; };
  return CR;
}

/** Pose a crane's parts: P = { gantry, out, trolley, spreader, falls: [4], stays: [2] }. */
export function poseCrane(buf, P, c, setPart) {
  const ob = A.mul(A.t(c.x, C.BY, H.RS), A.rx(-c.boom));
  setPart(buf, P.gantry, A.t(c.x, 0, 0));
  setPart(buf, P.out, ob);
  setPart(buf, P.trolley, A.t(c.x, C.BY, c.tz));
  const [ox, oz] = c.sw;
  setPart(buf, P.spreader, A.t(c.x + ox, c.sy, c.tz + oz));
  let k = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) setPart(buf, P.falls[k++], A.seg([c.x + sx * 0.03, C.BY - 0.022, c.tz + sz * 0.012], [c.x + ox + sx * 0.035, c.sy + 0.012, c.tz + oz + sz * 0.012], 0.0012));
  const tip = A.apply(ob, [0, 0.02, C.OUT * 0.68]);
  [-1, 1].forEach((s, i) => setPart(buf, P.stays[i], A.seg([c.x + s * C.half * 0.6, C.AY, C.ZA], [tip[0] + s * 0.04, tip[1], tip[2]], 0.0016)));
}
/** The apex of a crane's A-frame: a gull's perch. */
export const apexOf = (c) => [c.x, C.AY + 0.012, C.ZA];
