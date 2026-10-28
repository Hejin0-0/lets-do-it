import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIsland } from '../src/pool/status-island.js';
import { nameOf } from '../src/pool/ducks.js';
import { createWorld } from '../src/pool/world.js';
import { budget } from './budget.mjs';

const world = () => ({ ducks: [], boat: { state: 'moored', aboard: [] }, race: { running: false, ids: [], results: [], t: 0 } });
const stamp = i => ({ id: String(i), title: `Stamp ${i}`, text: 'description' });

test('race, sea and boat display their current state and stable keys', () => {
  const w = world(), island = createIsland();
  w.race = { running: true, t: 83, ids: [1, 2, 3], results: [{ id: 1, place: null, time: null }, { id: 2, place: 1, time: 76 }, { id: 3, place: null, time: null }] };
  w.ducks = [{ id: 1, state: 'sea' }, { id: 3, state: 'sea' }];
  island.update(w, { now: 0 });
  assert.deepEqual(island.items, [
    { key: 'race', kind: 'race', title: 'Race 1:23', detail: `${nameOf(2)} leads`, rows: [{ place: 1, name: nameOf(2), time: 76 }, { place: null, name: nameOf(1), time: null }, { place: null, name: nameOf(3), time: null }] },
    { key: 'sea', kind: 'sea', title: '2 ducks at sea', action: 'sendBoat' },
  ]);
  w.race.results[1].place = null; w.race.results[1].time = null; w.ducks.pop();
  island.update(w, { now: 1 });
  assert.equal(island.items[0].detail, '3 racing'); assert.equal(island.items[1].title, '1 duck at sea');
  w.boat.state = 'out'; island.update(w, { now: 2 });
  assert.deepEqual(island.items[1], { key: 'boat', kind: 'boat', title: 'The boat is out', detail: 'on its way' });
  w.boat.aboard = [1, 3]; island.update(w, { now: 3 }); assert.equal(island.items[1].detail, '2 ducks aboard');
  w.boat.aboard = [1]; island.update(w, { now: 4 }); assert.equal(island.items[1].detail, '1 duck aboard');
});

test('stamp notices are bounded, sequential, and take priority', () => {
  const w = world(), island = createIsland(); w.ducks = [{ state: 'sea' }];
  w.race = { running: true, ids: [1, 2], t: 0, results: [{ id: 1, place: null, time: null }, { id: 2, place: null, time: null }] };
  island.update(w, { now: 0, fresh: [1, 2, 3, 4, 5, 6].map(stamp) });
  assert.equal(island.items.length, 2); assert.equal(island.items[0].detail, 'Stamp 1'); assert.equal(island.items[1].kind, 'race');
  const keys = [island.items[0].key];
  for (let i = 1; i <= 3; i++) { island.update(w, { now: i * 3 }); keys.push(island.items[0].key); assert.equal(island.items[0].detail, i < 3 ? `Stamp ${i + 1}` : '+3 more stamps'); }
  assert.equal(new Set(keys).size, 4);
  island.update(w, { now: 12 }); assert.deepEqual(island.items.map(i => i.kind), ['race', 'sea']);
});

test('real race end is detected without events once and expires by page time', () => {
  const w = createWorld({ seed: 5, ducks: 3, arrivals: false }), island = createIsland();
  assert.equal(w.startRace(w.ducks.map(d => d.id)), true); island.update(w, { now: 10 });
  while (w.race.running) w.step(120);
  w.events.length = 0; island.update(w, { now: 11 });
  const winner = w.race.results.find(r => r.place === 1);
  assert.equal(island.items[0].title, `${nameOf(winner.id)} wins`);
  assert.match(island.items[0].detail, /^\d+:\d\d$/);
  island.update(w, { now: 16 }); assert.equal(island.items.length, 0);
  island.update(w, { now: 100 }); assert.equal(island.items.length, 0);
});

test('an unobserved completed race and no finisher are still noticed', () => {
  const w = world(), island = createIsland(); w.race = { running: false, endedAt: 99, results: [{ id: 1, place: null, time: null }], ids: [1], t: 600 };
  island.update(w, { now: 0 }); assert.equal(island.items[0].title, 'No one finished');
  island.update(w, { now: 5 }); assert.deepEqual(island.items, []);
});

test('forty ducks remain cheap', t => {
  const w = world(), island = createIsland(); w.ducks = Array.from({ length: 40 }, (_, id) => ({ id, state: id % 2 ? 'sea' : 'float' }));
  const start = performance.now(), steps = 20000;
  for (let i = 0; i < steps; i++) island.update(w, { now: i / 60 });
  const ms = (performance.now() - start) / steps; t.diagnostic(`${ms.toFixed(4)} ms/update`); assert.ok(ms < budget(.2));
});

test('a single overflow stamp uses singular grammar', () => {
  const island = createIsland(), w = world();
  island.update(w, { now: 0, fresh: [1, 2, 3, 4].map(stamp) });
  for (const now of [3, 6, 9]) island.update(w, { now });
  assert.equal(island.items[0].detail, '+1 more stamp');
});
