import test from 'node:test';
import assert from 'node:assert/strict';
import { homeAt, DUSK_SECONDS, DARK_SECONDS, DAWN_SECONDS, startVisit } from '../src/pool/home.js';
import { createWorld } from '../src/pool/world.js';
import { createLogbook } from '../src/pool/logbook.js';

const total = DUSK_SECONDS + DARK_SECONDS + DAWN_SECONDS;
test('home timeline fades through dusk, dark and dawn, advancing daylight only toward night', () => {
  assert.ok(total >= 3 && total <= 5);
  assert.deepEqual(homeAt(0, 15, false), { phase: 'dusk', t: 0, opacity: 0, hour: 15 });
  const mid = homeAt(DUSK_SECONDS / 2, 15, false);
  assert.equal(mid.phase, 'dusk'); assert.equal(mid.t, DUSK_SECONDS / 2); assert.ok(mid.hour > 15 && mid.hour < 20); assert.ok(mid.opacity > 0 && mid.opacity < 1);
  assert.deepEqual(homeAt(DUSK_SECONDS, 15, false), { phase: 'dark', t: 0, opacity: 1, hour: 20 });
  assert.deepEqual(homeAt(DUSK_SECONDS + DARK_SECONDS, 15, false), { phase: 'dawn', t: 0, opacity: 1, hour: null });
  assert.equal(homeAt(total, 15, false), null);
  for (const h of [0, 3, 20, 23]) assert.equal(homeAt(DUSK_SECONDS - .01, h, false).hour, h);
  assert.ok(homeAt(DUSK_SECONDS - .01, 19, false).hour >= 19);
});

test('reduced motion retains the fade and never changes the hour', () => {
  for (const t of [0, 1, DUSK_SECONDS, DUSK_SECONDS + DARK_SECONDS]) assert.equal(homeAt(t, 12, true).hour, null);
  assert.ok(homeAt(1, 12, true).opacity > 0);
});

test('new visit resets world and visit book state while restoring saved pool items', () => {
  const world = createWorld({ seed: 3, visit: 5, ducks: 1, arrivals: false });
  const book = createLogbook(null, { now: () => 123 });
  const kept = 'bottle-first', leaving = 'bottle-second';
  book.observe(world, [{ type: 'collected', ids: [kept, leaving] }, { type: 'summoned', id: kept }, { type: 'summoned', id: leaving }]);
  book.observe(world, [{ type: 'launch' }]); assert.ok(book.fresh.length); assert.ok(book.ducks.length);
  world.summon(kept); world.summon(leaving); world.events.length = 0;
  world.sendBack(leaving); world.step(240);
  world.collectibles.setCollected([kept, leaving]); world.collectibles.arm();
  const before = world.collectibles.list.find(x => x.t !== null).id;
  const oldDuck = world.ducks[0]; world.selected = oldDuck; world.setHour(3); world.setDayRun(false);
  startVisit(world, book, 1);
  assert.deepEqual(book.inPool, [kept]); assert.deepEqual(world.summons.list.map(x => [x.id, x.state]), [[kept, 'floating']]);
  assert.equal(world.summons.gulls.length, 0); assert.equal(world.summons.leaving(leaving), false);
  assert.equal(world.selected, null); assert.notEqual(world.ducks[0], oldDuck); assert.deepEqual(world.day, { hour: 15, run: true });
  assert.equal(book.ducks.length, 0); assert.equal(book.fresh.length, 0);
  assert.ok(book.found(kept) && book.found(leaving));
  world.collectibles.arm();
  assert.notEqual(world.collectibles.list.find(x => x.t !== null).id, before);
});
