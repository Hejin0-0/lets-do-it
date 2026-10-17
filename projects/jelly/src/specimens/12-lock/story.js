// Lock Jelly — the story, for ever: the boat lies in the full chamber; the keeper shuts the top gate, draws the
// bottom paddles, the chamber empties, he drops them and opens the bottom gate; Wobble leaves, rounds the bend,
// ducks under the bridge, goes round the island and comes back in bow first; he shuts the bottom gate, goes
// round to the top paddles, the chamber fills, he opens the top gate; she goes up the pound, turns in the
// winding hole and comes back. A generator: each tick it runs until it waits, and says what is happening.
import { makeRoute, DOWN, UP_OUT, UP_BACK, WIND_AT } from './boat.js';
import { pushSpot, windSpot } from './keeper.js';
import { L } from './layout.js';

export const ROUTES = { down: makeRoute(DOWN), out: makeRoute(UP_OUT), back: makeRoute(UP_BACK) };
const OPEN = Math.PI / 2, NAME = ['top', 'bottom'];

export function createStory({ lock, keeper, boat }) {
  const S = { who: 'Wobble', text: 'In the lock', pct: -1, trips: 0, step: null };
  const say = (who, text, pct = -1) => { S.who = who; S.text = text; S.pct = pct; };
  function* wait(sec) { for (let t = 0; t < sec; t += 1 / 120) yield; }
  function* keeperDoes(text) { say('Keeper', text); while (keeper.busy()) yield; }
  function* shut(i) {
    keeper.go(pushSpot(i, lock.gates[i].th, false)); yield* keeperDoes(`Off to the ${NAME[i]} gate`);
    keeper.push(i, false); yield* keeperDoes(`Shutting the ${NAME[i]} gate`);
  }
  function* open(i) {
    keeper.go(pushSpot(i, 0, true)); yield* keeperDoes(`To the ${NAME[i]} gate's beam`);
    keeper.push(i, true); yield* keeperDoes(`Opening the ${NAME[i]} gate`);
  }
  function* lockful(k, up) {   // paddle k: 0 the top ones (fill), 1 the bottom ones (empty)
    keeper.go(windSpot(k)); yield* keeperDoes(`Round to the ${NAME[k]} paddles`);
    keeper.wind(k, true); yield* keeperDoes(`Drawing the ${NAME[k]} paddles`);
    const goal = up ? L.LU : L.LL;
    while (lock.level !== goal) { say('Wobble', `${up ? 'Filling' : 'Emptying'} the lock`, Math.round(lock.progress(up) * 100)); yield; }
    keeper.wind(k, false); yield* keeperDoes(`Dropping the ${NAME[k]} paddles`);
  }
  const downText = (s) => (s < 1.3 ? 'Leaving the lock' : s < 3.0 ? 'Round the bend' : s < 3.6 ? 'Under the bridge' : s < ROUTES.down.len - 3.4 ? 'Round the island' : s < ROUTES.down.len - 1.0 ? 'Back up to the lock' : 'Into the lock');
  function* cycle() {
    yield* wait(1.2);
    for (;;) {
      yield* shut(0);
      yield* lockful(1, false);
      yield* open(1);
      boat.follow(ROUTES.down); keeper.rest();
      while (boat.s < ROUTES.down.len - 2.2) { say('Wobble', downText(boat.s)); yield; }
      keeper.go(pushSpot(1, OPEN, false));   // he sets off for the gate as she comes in
      while (!boat.atEnd()) { say('Wobble', downText(boat.s)); yield; }
      yield* shut(1);
      yield* lockful(0, true);
      yield* open(0);
      boat.follow(ROUTES.out); keeper.rest();
      while (!boat.atEnd()) { say('Wobble', 'Up the pound'); yield; }
      boat.turn(WIND_AT[0], WIND_AT[1], Math.PI);
      while (!boat.atEnd()) { say('Wobble', 'Turning in the winding hole'); yield; }
      boat.follow(ROUTES.back);
      while (boat.s < ROUTES.back.len - 1.0) { say('Wobble', 'Back down the pound'); yield; }
      keeper.go(pushSpot(0, OPEN, false));
      while (!boat.atEnd()) { say('Wobble', 'Into the lock'); yield; }
      S.trips++;
    }
  }
  S.reset = () => { S.step = cycle(); S.trips = 0; say('Wobble', 'In the lock'); };
  S.tick = () => S.step.next();
  S.reset();
  return S;
}
