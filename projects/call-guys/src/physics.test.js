/**
 * Self-check for the arcade math. Run with:
 *   node src/physics.test.js
 */
import assert from 'node:assert/strict';
import {
  approach,
  clamp,
  closestPointOnSegment,
  damp,
  deckHeightAt,
  formatTime,
  limitPlanar,
  radialPush,
  rotateAbout,
  shortestAngle,
} from './physics.js';

const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );

// clamp / approach
assert.equal(clamp(5, 0, 3), 3);
assert.equal(clamp(-5, 0, 3), 0);
assert.equal(approach(0, 10, 3), 3);
assert.equal(approach(0, 2, 3), 2, 'must not overshoot the target');
assert.equal(approach(0, -10, 3), -3);

// damp converges and never overshoots
near(damp(0, 10, 8, 0.016), 10 * (1 - Math.exp(-8 * 0.016)));
assert.ok(damp(0, 10, 8, 100) < 10.000001, 'damp must not exceed the target');

// shortestAngle wraps the short way around
near(shortestAngle(0.1, 0.1 + Math.PI * 2), 0, 1e-9);
near(shortestAngle(Math.PI - 0.1, -Math.PI + 0.1), 0.2, 1e-9);
assert.ok(Math.abs(shortestAngle(0, Math.PI * 1.9)) <= Math.PI);

// flat deck
const deck = { x: 0, z: 10, hw: 3, hd: 5, y: 2 };
assert.equal(deckHeightAt(deck, 0, 10), 2);
assert.equal(deckHeightAt(deck, 3.4, 10), null, 'outside the deck reports no support');
assert.equal(deckHeightAt(deck, 3.4, 10, 0.5), 2, 'pad widens the footprint');

// ramp interpolates from the -Z edge to the +Z edge
const ramp = { x: 0, z: 10, hw: 4, hd: 5, y: 0, slope: 3 };
assert.equal(deckHeightAt(ramp, 0, 5), 0, 'bottom of the ramp');
near(deckHeightAt(ramp, 0, 10), 1.5, 1e-9);
assert.equal(deckHeightAt(ramp, 0, 15), 3, 'top of the ramp');

// disc decks are round, not square
const disc = { shape: 'disc', x: 2, z: -1, y: 1.5, radius: 3 };
assert.equal(deckHeightAt(disc, 2, -1), 1.5, 'dead centre');
assert.equal(deckHeightAt(disc, 5, -1), 1.5, 'exactly on the rim');
assert.equal(deckHeightAt(disc, 5.2, -1), null, 'just past the rim');
assert.equal(deckHeightAt(disc, 5.2, -1, 0.3), 1.5, 'pad widens the rim');
// The corner of the bounding box must NOT be standable.
assert.equal(deckHeightAt(disc, 2 + 2.9, -1 + 2.9), null, 'no standing on a corner');

// rotating a rider about a hub
const spun = rotateAbout(1, 0, 0, 0, Math.PI / 2);
near(spun.x, 0, 1e-9);
near(spun.z, 1, 1e-9);
const atHub = rotateAbout(0, 0, 0, 0, 1.2);
near(atHub.x, 0, 1e-9);
near(atHub.z, 0, 1e-9);
// Distance from the hub is preserved, so a rider never drifts inward or out.
const rim = rotateAbout(3, 4, 0, 0, 0.7);
near(Math.hypot(rim.x, rim.z), 5, 1e-9);

// segment distance, including both clamped ends
const mid = closestPointOnSegment(0, 1, -5, 0, 5, 0);
near(mid.distance, 1);
near(mid.t, 0.5);
const past = closestPointOnSegment(9, 0, -5, 0, 5, 0);
near(past.distance, 4);
assert.equal(past.t, 1, 't is clamped to the segment');
const degenerate = closestPointOnSegment(3, 4, 0, 0, 0, 0);
near(degenerate.distance, 5, 1e-9);

// radial push
assert.equal(radialPush(5, 0, 0, 0, 2), null, 'no push when clear');
const push = radialPush(1, 0, 0, 0, 2);
near(push.nx, 1);
near(push.nz, 0);
near(push.depth, 1);
const centred = radialPush(0, 0, 0, 0, 2);
assert.ok(Number.isFinite(centred.nx) && Number.isFinite(centred.nz), 'no NaN at dead centre');
near(Math.hypot(centred.nx, centred.nz), 1, 1e-6);

// speed limiting
const limited = limitPlanar(30, 40, 10);
near(Math.hypot(limited.x, limited.z), 10, 1e-9);
const untouched = limitPlanar(3, 4, 10);
assert.deepEqual(untouched, { x: 3, z: 4 }, 'under the cap it is left alone');
assert.deepEqual(limitPlanar(0, 0, 10), { x: 0, z: 0 }, 'zero vector must not divide by zero');

// clock formatting
assert.equal(formatTime(0), '00:00.00');
assert.equal(formatTime(9.876), '00:09.87');
assert.equal(formatTime(61.5), '01:01.50');
assert.equal(formatTime(-3), '00:00.00', 'negatives clamp instead of rendering "-1:.."');

console.log('physics.test.js — all checks passed');
