import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';
import { HOURS, clockText, createDuckChoice, chooseDuck, chooseHour } from '../src/pool/seat-choices.js';

const world = () => createWorld({ seed: 3, ducks: 0, arrivals: false });

test('hour presets are immutable, named and ordered', () => {
  assert.deepEqual(HOURS.map(({id, hour}) => [id, hour]), [['dawn',6],['noon',12],['dusk',18],['night',23]]);
  assert.ok(Object.isFrozen(HOURS));
  HOURS.forEach((p, i) => { assert.ok(Object.isFrozen(p)); assert.ok(p.label.length); assert.ok(p.hour >= 0 && p.hour < 24); if (i) assert.ok(HOURS[i-1].hour < p.hour); });
});

test('clock text wraps hours and floors minutes', () => {
  for (const [hour, text] of [[0,'00:00'],[5.999,'05:59'],[11.9999,'11:59'],[12,'12:00'],[23.99999,'23:59'],[24,'00:00'],[30,'06:00'],[-.5,'23:30']]) assert.equal(clockText(hour), text);
});

test('live duck labels are unique, including repeated names and existing suffixes', () => {
  const W = world(); W.addDucks(40); while (W.ducks.length < 40) W.step();
  const choice = createDuckChoice(), names = ['Pip','Pip','Pip','Pip (2)'];
  names.forEach((name, i) => { W.ducks[i].name = name; });
  const options = choice.view(W.ducks, null).options;
  assert.equal(options.length, 40); assert.deepEqual(options.map(o => o.id), W.ducks.map(d => d.id));
  assert.equal(options[0].label, 'Pip'); assert.equal(options[3].label, 'Pip (2)');
  assert.equal(new Set(options.map(o => o.label)).size, 40);
  W.ducks[3].name = 'Other';
  assert.deepEqual(choice.view(W.ducks.slice(0,3), null).options.map(o => o.label), ['Pip','Pip (2)','Pip (3)']);
});

test('selection identity, removal notice, deselection and forget', () => {
  const W = world(); W.addDucks(2); while (W.ducks.length < 2) W.step();
  const [a, b] = W.ducks, choice = createDuckChoice();
  assert.equal(choice.view(W.ducks, null).value, null);
  assert.equal(chooseDuck(W, a.id), true); assert.equal(W.selected, a);
  assert.equal(choice.view(W.ducks, W.selected).value, a.id);
  assert.equal(chooseDuck(W, -1), false); assert.equal(W.selected, a);
  assert.equal(chooseDuck(W, null), true); assert.equal(W.selected, null);
  assert.equal(choice.view(W.ducks, W.selected).notice, null);
  assert.equal(choice.view(W.ducks, {...a}).value, null);
  chooseDuck(W, a.id); choice.view(W.ducks, W.selected);
  assert.equal(W.removeDuck(), true); assert.equal(W.selected, null);
  assert.equal(choice.view(W.ducks, W.selected).notice, 'The duck you were watching has left.');
  assert.equal(choice.view(W.ducks, null).notice, 'The duck you were watching has left.');
  chooseDuck(W, b.id); assert.equal(choice.view(W.ducks, W.selected).notice, null);
  W.removeDuck(); assert.equal(choice.view(W.ducks, null).notice, 'The duck you were watching has left.');
  choice.forget(); assert.equal(choice.view(W.ducks, null).notice, null);
});

test('reset replaces objects even when ids are reused', () => {
  const W = createWorld({seed: 3, ducks: 1, arrivals: false}), choice = createDuckChoice();
  const old = W.ducks[0]; choice.view(W.ducks, old); W.reset();
  assert.equal(W.ducks[0].id, old.id); assert.notEqual(W.ducks[0], old);
  assert.equal(choice.view(W.ducks, old).value, null);
  assert.equal(choice.view(W.ducks, old).notice, 'The duck you were watching has left.');
});

test('hour choice uses the world clock and preserves run state', () => {
  const W = world();
  for (const run of [true, false]) {
    W.setDayRun(run);
    for (const preset of HOURS) {
      assert.equal(chooseHour(W, preset.id), preset.hour);
      assert.equal(W.day.hour, preset.hour); assert.equal(clockText(W.day.hour), clockText(preset.hour)); assert.equal(W.day.run, run);
    }
    const before = {...W.day}; assert.equal(chooseHour(W, 'unknown'), null); assert.deepEqual(W.day, before);
  }
});

test('a stale selection never removes the wrong duck or leaves its body behind', () => {
  const W = world(); W.addDucks(3); while (W.ducks.length < 3) W.step();
  const ghost = W.ducks[0]; W.reset(); W.addDucks(3); while (W.ducks.length < 3) W.step();
  const newest = W.ducks[2], kept = W.ducks.slice(0, 2), bodies = W.floaters.bodies.length;
  W.selected = ghost;   // an object from before the reset: not a live duck
  assert.ok(W.removeDuck());
  assert.deepEqual(W.ducks, kept); assert.ok(!W.floaters.bodies.includes(newest.body)); assert.equal(W.floaters.bodies.length, bodies - 1);
  assert.equal(W.selected, null);
});
