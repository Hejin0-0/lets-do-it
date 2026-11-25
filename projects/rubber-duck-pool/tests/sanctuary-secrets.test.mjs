import assert from 'node:assert/strict';
import test from 'node:test';
import { SANCTUARY_SECRETS, SECRETS_KEY, createSecretTracker } from '../src/sanctuary/secrets.js';

function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    dump: () => Object.fromEntries(map),
  };
}

test('all 4 cozy secrets stay locked until their exact non-stressful trigger holds, then persist cleanly', () => {
  const store = memoryStore();
  const tracker = createSecretTracker(store);

  assert.equal(SANCTUARY_SECRETS.length, 4);
  assert.deepEqual(tracker.getUnlocked(), []);
  assert.ok(tracker.getNextHint('ko').length > 0);
  assert.ok(tracker.getNextHint('en').length > 0);
  assert.ok(tracker.getNextHint('ja').length > 0);

  // Daytime + radio does NOT trigger midnight_radio_roast
  assert.deepEqual(tracker.evaluate({ hour: 14, radioOn: true, goldenRoastUnlocked: true }, 100), []);

  // Nighttime (22:30) + radio + golden roast unlocks 24-lantern once and only once
  const first = tracker.evaluate({ hour: 22.5, radioOn: true, goldenRoastUnlocked: true }, 200);
  assert.equal(first.length, 1);
  assert.equal(first[0].id, 'midnight_radio_roast');
  assert.equal(first[0].unlocks, '24-lantern');
  assert.deepEqual(tracker.evaluate({ hour: 22.5, radioOn: true, goldenRoastUnlocked: true }, 250), []);

  // Painter quartet (customCreated >= 1 && ducksPetted >= 3 -> 17-bookbinder)
  assert.deepEqual(tracker.evaluate({ customCreated: 1, ducksPetted: 2 }, 300), []);
  const second = tracker.evaluate({ customCreated: 1, ducksPetted: 3 }, 310);
  assert.equal(second[0].id, 'painter_quartet');
  assert.equal(second[0].unlocks, '17-bookbinder');

  // Crown court (ridesTaken >= 1 && slideRides >= 1 -> 13-teapot)
  const third = tracker.evaluate({ ridesTaken: 1, slideRides: 1 }, 400);
  assert.equal(third[0].id, 'crown_court');
  assert.equal(third[0].unlocks, '13-teapot');

  // Twilight zen (ecoMode && rainVol > 0.1 && hearthVol > 0.1 -> 19-moon)
  assert.deepEqual(tracker.evaluate({ ecoMode: true, rainVol: 0.05, hearthVol: 0.5 }, 450), []);
  const fourth = tracker.evaluate({ ecoMode: true, rainVol: 0.35, hearthVol: 0.40 }, 500);
  assert.equal(fourth[0].id, 'twilight_zen');
  assert.equal(fourth[0].unlocks, '19-moon');

  // Rehydrating from storage preserves all 4 unlocks and returns the all-found line
  assert.ok(store.getItem(SECRETS_KEY));
  const reloaded = createSecretTracker(store);
  assert.equal(reloaded.getUnlocked().length, 4);
  assert.equal(reloaded.getNextHint('en'), 'Every secret has been found.');
});
