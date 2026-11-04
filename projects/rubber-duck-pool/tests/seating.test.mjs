import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { P } from '../src/pool/layout.js';
import { createSeating } from '../src/pool/seating.js';
import { budget } from './budget.mjs';

const make = (duration = 1.1) => createSeating({ seats: P.SEATS, duration });
const event = (type, seat, from = null, reason = null) => ({ type, seat, from, reason });

test('state invariants, event order, and snapshots visible to listeners', () => {
  const s = make(), seen = [];
  s.on(e => seen.push([e, s.state]));
  assert.deepEqual(s.state, { phase: 'standing', seat: null, t: 0 });
  assert.equal(s.sit(0), true);
  s.update(1.1);
  assert.equal(s.stand('button'), true);
  assert.deepEqual(seen, [
    [event('sit', 0), { phase: 'moving', seat: 0, t: 0 }],
    [event('arrive', 0), { phase: 'seated', seat: 0, t: 1.1 }],
    [event('stand', null, 0, 'button'), { phase: 'standing', seat: null, t: 0 }],
  ]);
  const copy = s.state; copy.phase = 'seated'; copy.seat = 100; copy.t = 10;
  assert.equal(s.phase, 'standing'); assert.equal(s.seat, null);
});

test('invalid and repeated seats are no-ops, switching restarts time', () => {
  const s = make(), events = []; s.on(e => events.push(e));
  for (const i of [-1, 2, 0.5, NaN, Infinity, '0', null, undefined]) assert.equal(s.sit(i), false);
  assert.equal(s.sit(0), true); s.update(0.8);
  assert.equal(s.sit(0), false); assert.equal(s.state.t, 0.8);
  assert.equal(s.sit(1), true); assert.deepEqual(s.state, { phase: 'moving', seat: 1, t: 0 });
  s.update(1.1); assert.equal(s.sit(1), false);
  assert.equal(s.sit(0), true); assert.deepEqual(s.state, { phase: 'moving', seat: 0, t: 0 });
  assert.deepEqual(events, [event('sit', 0), event('sit', 1, 0), event('arrive', 1), event('sit', 0, 1)]);
});

test('stand interrupts transition, ignores late updates and preserves or normalizes reason', () => {
  const s = make(), events = []; s.on(e => events.push(e));
  assert.equal(s.stand(), false); s.sit(0); s.update(0.5);
  assert.equal(s.stand('escape'), true); s.update(20); assert.equal(s.stand('button'), false);
  for (const reason of ['button', 'moved', 'reset', '', 0, null, {}]) { s.sit(1); s.stand(reason); }
  assert.deepEqual(s.state, { phase: 'standing', seat: null, t: 0 });
  assert.deepEqual(events.filter(e => e.type === 'stand').map(e => e.reason), ['escape', 'button', 'moved', 'reset', '', 'stand', 'stand', 'stand']);
  assert.equal(events.some(e => e.type === 'arrive'), false);
});

test('listeners survive exceptions and removals during dispatch', () => {
  const s = make(), calls = [];
  let unsubscribe;
  s.on(() => { calls.push('first'); unsubscribe(); throw new Error('listener'); });
  unsubscribe = s.on(() => calls.push('second'));
  s.on(() => calls.push('third'));
  assert.equal(s.sit(0), true); assert.deepEqual(calls, ['first', 'second', 'third']);
  calls.length = 0; s.update(1.1); assert.deepEqual(calls, ['first', 'third']);
  unsubscribe();
});

test('invalid steps are ignored, long steps arrive once, tiny steps do not drift', () => {
  const s = make(1), events = []; s.on(e => events.push(e)); s.sit(0);
  for (const dt of [0, -1, NaN, Infinity, -Infinity, '1', null]) s.update(dt);
  assert.equal(s.state.t, 0);
  for (let i = 0; i < 9999; i++) s.update(0.0001);
  assert.equal(s.phase, 'moving'); assert.ok(s.state.t < 1);
  s.update(0.0001); assert.equal(s.phase, 'seated'); assert.equal(s.state.t, 1);
  s.update(10); assert.equal(events.filter(e => e.type === 'arrive').length, 1);
  s.sit(1); s.update(5); s.update(5);
  assert.equal(events.filter(e => e.type === 'arrive').length, 2);
});

test('the same calls produce the same events and states', () => {
  const run = () => {
    const s = make(), result = []; s.on(e => result.push([e, s.state]));
    s.sit(1); s.update(0.2); s.sit(0); s.update(1.2); s.stand('moved'); s.update(1);
    return [result, s.state];
  };
  assert.deepEqual(run(), run());
});

test('forty independent seatings and 200,000 updates remain cheap', () => {
  const all = Array.from({ length: 40 }, () => make(10000));
  all.forEach((s, i) => s.sit(i % 2));
  const start = performance.now();
  for (let i = 0; i < 5000; i++) for (const s of all) s.update(0.01);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < budget(500), `${elapsed.toFixed(1)}ms exceeds budget`);
  all.forEach((s, i) => { assert.equal(s.phase, 'moving'); assert.equal(s.seat, i % 2); assert.equal(s.state.t, 50); });
});

test('bad configuration is rejected at the boundary', () => {
  for (const duration of [0, -1, NaN, Infinity, '1']) assert.throws(() => make(duration), RangeError);
  assert.throws(() => createSeating({ seats: null }), TypeError);
});
