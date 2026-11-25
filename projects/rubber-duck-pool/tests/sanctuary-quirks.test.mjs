import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuirksEngine, TARGET_RESONANCE_TEMP } from '../src/sanctuary/quirks-engine.js';

function makeMemoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

test('brass thermal valve reaches exact 38.4C and triggers synchronized uncanny stare + 0.05s blink', () => {
  const quirks = createQuirksEngine({ store: makeMemoryStore() });
  assert.equal(TARGET_RESONANCE_TEMP, 38.4);
  assert.equal(quirks.getState().waterTempC, 37.6);

  let trig = null;
  for (let i = 0; i < 4; i++) {
    trig = quirks.crankValve(1);
  }
  assert.equal(quirks.getState().waterTempC, 38.4);
  assert.equal(trig.resonanceTriggered, true);
  assert.equal(quirks.getState().stareActive, true);
  assert.ok(quirks.getState().stareRemainingSec > 1.5);

  // Advance across the synchronized 0.05s blink window inside the stare
  let sawSyncBlink = false;
  for (let i = 0; i < 160; i++) {
    const step = quirks.step(0.02);
    if (step.syncBlink) sawSyncBlink = true;
  }
  assert.equal(sawSyncBlink, true);
  assert.equal(quirks.getState().stareActive, false);
});

test('pointless towel tilt increments by 7 deg and slips off with a spring reset at 28 deg', () => {
  const quirks = createQuirksEngine({ store: makeMemoryStore() });
  const r1 = quirks.tiltAccessory('duck-classic');
  assert.equal(r1.deg, 7);
  assert.equal(r1.slipped, false);
  quirks.tiltAccessory('duck-classic');
  quirks.tiltAccessory('duck-classic');
  const r4 = quirks.tiltAccessory('duck-classic');
  assert.equal(r4.slipped, true);
  assert.equal(r4.deg, 0);
  assert.equal(quirks.getAccessoryTiltDeg('duck-classic'), 0);
});

test('holding a rubber duck builds water-jet pressure and releasing fires high-pressure jet + recoil', () => {
  const quirks = createQuirksEngine({ store: makeMemoryStore() });
  quirks.beginSqueeze('duck-classic');
  for (let i = 0; i < 60; i++) quirks.step(1 / 60);
  assert.ok(quirks.getSqueezePressure('duck-classic') > 0.65);

  const rel = quirks.releaseSqueeze('duck-classic');
  assert.equal(rel.firedJet, true);
  assert.ok(rel.power > 0.65);
  assert.equal(quirks.getSqueezePressure('duck-classic'), 0);
});

test('flinging the same duck 3 times triggers stubborn grudge mode with heavy mass and angry squint', () => {
  const quirks = createQuirksEngine({ store: makeMemoryStore() });
  assert.equal(quirks.recordDuckFling('duck-cherry').stubborn, false);
  assert.equal(quirks.recordDuckFling('duck-cherry').stubborn, false);
  const third = quirks.recordDuckFling('duck-cherry');
  assert.equal(third.stubborn, true);
  assert.ok(quirks.getDuckMood('duck-cherry').massMultiplier >= 3.0);
  assert.ok(quirks.getDuckMood('duck-cherry').eyelidSquint >= 0.55);

  // Grudge cools down cleanly after 9 seconds
  for (let i = 0; i < 90; i++) quirks.step(0.1);
  assert.equal(quirks.getDuckMood('duck-cherry').stubborn, false);
});

test('50ms hit-stop, scratchable book redactions, and freeform page stamps persist cleanly', () => {
  const store = makeMemoryStore();
  const q1 = createQuirksEngine({ store });

  q1.triggerHitStop(0.05);
  assert.equal(q1.isHitStopped(), true);
  q1.step(0.03);
  assert.equal(q1.isHitStopped(), true);
  q1.step(0.03);
  assert.equal(q1.isHitStopped(), false);

  assert.equal(q1.isRedacted('classic_mole'), true);
  assert.equal(q1.scratchRedaction('classic_mole'), true);
  assert.equal(q1.isRedacted('classic_mole'), false);

  const st = q1.addPageStamp(0, 'right', 0.42, 0.58, 'suanbo');
  assert.equal(st.kind, 'suanbo');

  const q2 = createQuirksEngine({ store });
  assert.equal(q2.isRedacted('classic_mole'), false);
  assert.equal(q2.getPageStamps(0, 'right').length, 1);
  assert.equal(q2.getPageStamps(0, 'right')[0].kind, 'suanbo');
});
