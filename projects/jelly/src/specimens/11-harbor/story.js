// Harbor Jelly — the ship's day, for ever. Alongside, the booms come down and the cranes swap boxes; then the
// trolleys park and the booms swing up; the tug comes round to the bow, passes a line and backs away, pulling
// the bow off the quay; the line is let go, the tug turns on the spot and goes home, and the ship sounds her
// horn and sails a lap of the harbour past the lighthouse. Meanwhile the tug goes out to stand by; when the ship
// stops off the quay it noses in and pushes her sideways onto the fenders, then backs off, and the booms come
// down again. A generator: each tick it runs until it waits, and says what is happening. The tug's errands
// run alongside it.
import { makeRoute } from '../../core/diorama/vessel.js';
import { A } from '../../core/diorama/parts.js';
import { SHIP, TUG, BERTH, TUG_HOME, BOW_LEAD, TUG_BOW } from './ship.js';
import { CRANE } from './cranes.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => t * t * (3 - 2 * t);
export const SWING = 0.45;   // how far the tug pulls her bow off
const STERN = [BERTH[0] - SHIP.len / 2, BERTH[1]];
/** Her pose swung off by th about her stern. */
const swung = (th) => [STERN[0] + Math.cos(th) * SHIP.len / 2, STERN[1] + Math.sin(th) * SHIP.len / 2, th];
// the tow: the line leads out from her bow along U, the tug at the end of it looking back along it
const U = [0.3, 0.954], TOW = 0.15;
const towPose = (th) => {
  const [x, z] = swung(th), lead = [x + Math.cos(th) * BOW_LEAD[0], z + Math.sin(th) * BOW_LEAD[0]], d = TOW + TUG_BOW[0];
  return [lead[0] + U[0] * d, lead[1] + U[1] * d, Math.atan2(-U[1], -U[0])];
};
/** The lap: out past the lighthouse, round the basin, back to stop off the quay a little out from her berth. */
export const OFF = 0.3;
export const LAP = [[-0.55, 0.02], [0.32, 0.6], [0.92, 1.08], [1.72, 1.22], [2.1, 1.66], [1.66, 2.02], [0.6, 2.06], [-0.6, 2.0], [-1.7, 1.8],
  [-2.12, 1.25], [-2.08, 0.46], [-1.84, 0.0], [-1.55, -0.29], [-1.36, BERTH[1] + OFF], [BERTH[0] + SHIP.pivot, BERTH[1] + OFF]];
export const STANDBY = [0.05, 0.08];
const HOME_IN = [TUG_HOME[0] + TUG.pivot, TUG_HOME[1]];
export const TUG_WAYS = {
  toBow: [[0.2, -0.3], [-0.3, -0.08], [-0.58, -0.08]],
  home: [[-0.2, 0.26], [0.32, -0.12], [0.5, -0.6], HOME_IN],
  standby: [[0.4, -0.25], [STANDBY[0] + 0.2, STANDBY[1]], STANDBY],
  toSide: [[-0.6, 0.3], [-1.25, 0.34]],
  homeFromSide: [[-0.6, 0.3], [0.2, -0.2], [0.5, -0.6], HOME_IN],
};

/** o: { fleet, cranes, events, foam } */
export function createStory({ fleet, cranes, events, foam }) {
  const { ship, tug } = fleet;
  const S = { text: '', more: '', voyages: 0, cycle: 0, phase: 'work', early: false, hurry: false, line: false, tugJob: null, dt: 1 / 120, lap: null };
  const say = (text, more = '') => { S.text = text; S.more = more; };
  const pivotOf = (v, p) => [v.c[0] + Math.cos(v.yaw) * p, v.c[1] + Math.sin(v.yaw) * p];
  function* wait(sec) { for (let t = 0; t < sec; t += S.dt) yield; }
  function* until(f) { while (!f()) yield; }
  // the tug's moves
  function* tugRoute(pts) { tug.follow(makeRoute([pivotOf(tug, TUG.pivot), ...pts])); yield* until(tug.atEnd); }
  function* tugMove(x, z, yaw, dur) { tug.moveTo(x, z, yaw, dur); yield* until(tug.atEnd); }
  function* tugTurn(yaw) { const da = wrap(yaw - tug.yaw); if (Math.abs(da) > 0.01) { tug.turn(tug.c[0], tug.c[1], da); yield* until(tug.atEnd); } }
  function* leaveHome() { yield* tugMove(TUG_HOME[0] - 0.12, TUG_HOME[1] + 0.22, Math.PI, 3); }   // off the quay, turning as she goes
  function* goHome(ways) { yield* tugTurn(0.35); yield* tugRoute(ways); yield* tugMove(TUG_HOME[0], TUG_HOME[1], 0, 1.2); }
  function* toStandby() { yield* leaveHome(); yield* tugRoute(TUG_WAYS.standby); }
  const atHome = () => Math.hypot(tug.c[0] - TUG_HOME[0], tug.c[1] - TUG_HOME[1]) < 0.02;
  const atStandby = () => Math.hypot(...pivotOf(tug, TUG.pivot).map((v, i) => v - STANDBY[i])) < 0.05;
  function* toBow() { if (atHome()) yield* leaveHome(); yield* tugRoute(TUG_WAYS.toBow); const [x, z, a] = towPose(0); yield* tugTurn(a); yield* tugMove(x, z, a, 2); }
  function* toSide() { yield* tugRoute(TUG_WAYS.toSide); yield* tugTurn(-Math.PI / 2); }
  const run = (gen) => { S.tugJob = gen; };

  function* cycle() {
    for (;;) {
      // alongside: the cranes' work
      S.phase = 'work'; S.early = false;
      say('Booms down'); cranes.boomsDown(); yield* until(() => cranes.boomsAt(0));
      cranes.planCycle(S.cycle++);
      if (S.early) cranes.finishInHand();
      let tugOff = false;
      while (cranes.busy()) {
        const C = cranes;
        if (!tugOff && !S.tugJob && !S.early && C.unloaded >= C.plan.unload) { tugOff = true; run(toBow()); }   // the tug sets off as the loading starts, and waits at her bow
        if (S.early) say('Casting off soon', 'finishing the box in hand');
        else if (C.unloaded < C.plan.unload) say('Unloading', `${Math.min(C.unloaded + 1, C.plan.unload)} / ${C.plan.unload}`);
        else say('Loading', `${Math.min(C.loaded + 1, C.plan.load)} / ${C.plan.load}`);
        yield;
      }
      S.phase = 'busy';
      // the booms go up, and meanwhile the tug comes round to the bow
      say('Booms up'); cranes.boomsUp();
      if (!tugOff) { yield* until(() => !S.tugJob); run(toBow()); }
      yield* until(() => cranes.boomsAt(CRANE.RAISED));
      say('Tug coming');
      yield* until(() => !S.tugJob);
      say('Casting off', 'line passed'); S.line = true; yield* wait(1);
      say('Casting off', 'pulling her off');
      for (let t = 0; t < 1; t += S.dt / 5) {   // the tug backs away; her bow swings out about her stern
        const e = ease(Math.min(1, t)), [x, z, a] = swung(SWING * e), [tx, tz, ta] = towPose(SWING * e);
        ship.pose(x, z, a, S.dt); tug.pose(tx, tz, ta, S.dt);
        foam.add(...pivotOf(tug, -TUG.len / 2), 0.25, 0.04);
        yield;
      }
      say('Casting off', 'line gone'); S.line = false; yield* wait(0.8);
      run(goHome(TUG_WAYS.home));
      yield* until(() => tug.c[0] > -0.4 || !S.tugJob);   // under way home: by the time she gathers way it is well clear
      events.push({ type: 'horn' });
      yield* wait(1);
      // a lap of the harbour
      S.phase = 'sea'; S.hurry = false; let side = false;
      S.lap = makeRoute([pivotOf(ship, SHIP.pivot), ...LAP]); ship.follow(S.lap);
      while (!ship.atEnd()) {
        ship.speed = S.hurry ? 0.55 : 0.36;
        const p = Math.round((100 * ship.s) / S.lap.len);
        say(S.lap.len - ship.s < 1.7 ? 'Coming in' : 'At sea', `${p}%`);
        if (!S.tugJob && p > 40 && atHome()) run(toStandby());
        if (!S.tugJob && !side && S.lap.len - ship.s < 2.3 && atStandby()) { side = true; run(toSide()); }   // to her side while she comes in
        yield;
      }
      // berthing: the tug noses in amidships and pushes her onto the fenders
      S.phase = 'busy';
      say('Berthing', 'waiting for the tug');
      yield* until(() => !S.tugJob);
      if (!side) {
        if (!atStandby()) { run(toStandby()); yield* until(() => !S.tugJob); }
        run(toSide()); yield* until(() => !S.tugJob);
      }
      say('Berthing', 'tug coming alongside');
      const touch = () => [ship.c[0], ship.c[1] + SHIP.beam / 2 + TUG.len / 2 + 0.004, -Math.PI / 2];
      run((function* () { const [x, z, a] = touch(); yield* tugMove(x, z, a, 1.6); })());
      yield* until(() => !S.tugJob);
      say('Berthing', 'pushing her in');
      const [x0, z0, y0] = [ship.c[0], ship.c[1], ship.yaw];
      for (let t = 0; t < 1; t += S.dt / 4.5) {
        const e = ease(Math.min(1, t));
        ship.pose(x0 + (BERTH[0] - x0) * e, z0 + (BERTH[1] - z0) * e, y0 * (1 - e), S.dt);
        const [x, z, a] = touch(); tug.pose(x, z, a, S.dt);
        foam.add(ship.c[0], ship.c[1] + SHIP.beam / 2 + TUG.len + 0.02, 0.5, 0.05);   // the tug's prop wash
        yield;
      }
      ship.pose(BERTH[0], BERTH[1], 0, S.dt);
      S.voyages++;
      run((function* () { yield* tugMove(tug.c[0], tug.c[1] + 0.3, -Math.PI / 2, 2.5); yield* goHome(TUG_WAYS.homeFromSide); })());
      yield* wait(1.2);   // the booms are high: they come down as the tug backs off
    }
  }
  S.reset = () => { S.step = cycle(); S.tugJob = null; S.voyages = 0; S.cycle = 0; S.line = false; S.early = false; S.hurry = false; S.phase = 'work'; say('Booms down'); };
  S.tick = (dt) => { S.dt = dt; if (S.tugJob && S.tugJob.next().done) S.tugJob = null; S.step.next(); };
  /** Cast off now (alongside, at work), or call her in (at sea). Returns whether it did anything. */
  S.go = () => {
    if (S.phase === 'work' && !S.early) { S.early = true; cranes.finishInHand(); return true; }
    if (S.phase === 'sea' && !S.hurry) { S.hurry = true; return true; }
    return false;
  };
  /** The tow line's ends, while there is one. */
  S.lineEnds = () => (S.line ? [A.apply(ship.matrix(), BOW_LEAD), A.apply(tug.matrix(), TUG_BOW)] : null);
  S.reset();
  return S;
}
