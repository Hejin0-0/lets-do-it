import { PALETTE } from '../palette.js';

/**
 * "The Gauntlet" — the original course, moved verbatim from `Course`.
 *
 * Six beats running along +Z: start apron → sweeper runway → moving-platform
 * gap → bumper yard → narrow bridge → launch ramp through the Glow Gate.
 *
 * Every number here was tuned and verified against the fairness rules in
 * `validate.js`. The two load-bearing constraints are commented at their
 * obstacle; changing them without re-running `test.html` will break the course.
 */
export const gauntlet = {
  id: 'gauntlet',
  name: 'The Gauntlet',
  mode: 'dash',
  // Which games this stage can host. Updraft is absent because the level has
  // no rising hazard to climb away from — the mode would never be losable.
  modes: ['dash', 'spark-snatch'],

  // Build order matters — it is the draw order of the slabs.
  decks: [
    { x: 0, z: 7, hw: 7, hd: 7, y: 0, color: PALETTE.startDeck, checker: ['#ffd23f', '#fff8ec', 7] },
    { x: 0, z: 27, hw: 6, hd: 13, y: 0, color: PALETTE.runway },
    { x: 0, z: 53, hw: 3.5, hd: 2.6, y: 0.2, color: PALETTE.island },
    { x: 0, z: 72, hw: 5, hd: 6, y: 0, color: PALETTE.bumperDeck },
    { x: 0, z: 90, hw: 1.6, hd: 12, y: 0, color: PALETTE.bridge, thickness: 0.8 },
    { x: 0, z: 104.5, hw: 4, hd: 2.5, y: 0, color: PALETTE.island },
    { x: 0, z: 112, hw: 4, hd: 5, y: 0, slope: 3, color: PALETTE.ramp, skirt: false },
    { x: 0, z: 118.5, hw: 4, hd: 1.5, y: 3, color: PALETTE.ramp },
    {
      x: 0,
      z: 128,
      hw: 6.5,
      hd: 6,
      y: 3,
      color: PALETTE.finishDeck,
      checker: ['#9dff9a', '#fff8ec', 6],
    },
  ],

  obstacles: [
    // Sweeper placement is bounded at both ends. A post at `z` sweeps
    // `z ± reach`, plus the player's own radius. The first must not reach back
    // onto the start apron (ends at z=14) and the last must leave a safe ledge
    // before the void (starts at z=40) to time the slider jump from — a bar
    // that owns the whole runway has no fair answer. Enforced by R3.
    { type: 'sweeper', x: 0, z: 19.8, reach: 5.5, arms: 2, speed: 1.5 },
    { type: 'sweeper', x: 0, z: 25, reach: 5.5, arms: 2, speed: -1.95 },
    { type: 'sweeper', x: 0, z: 30.2, reach: 5.5, arms: 2, speed: 2.35 },

    // Slider A is approached off a narrow ledge you cannot stop on, so it must
    // never demand timing: range < hw means its deck always covers the centre
    // lane, and running straight off the ledge always lands. Slider B is the
    // timing beat, and it sits after a static island you can wait on.
    // Enforced by R4.
    { type: 'slider', x: 0, z: 45.5, y: 0.2, hw: 3.4, hd: 3.4, range: 2.6, period: 6.4 },
    { type: 'slider', x: 0, z: 60.5, y: 0.2, hw: 3, hd: 3, range: 4, period: 5.4, phase: Math.PI },

    { type: 'bumper', x: -2.5, z: 70.5, radius: 0.85, height: 1.5 },
    { type: 'bumper', x: 2.4, z: 71.8, radius: 0.85, height: 1.5 },
    { type: 'bumper', x: -1.0, z: 74.2, radius: 0.85, height: 1.5 },
    { type: 'bumper', x: 3.0, z: 75.4, radius: 0.85, height: 1.5 },

    // Far enough down the bridge that the bridge checkpoint (spawn z=81.1)
    // never drops you back inside the sweep. Enforced by R2.
    { type: 'sweeper', x: 0, z: 87, reach: 3.2, arms: 2, speed: 1.1, height: 0.85 },
    { type: 'bumper', x: -0.75, z: 94.5, radius: 0.55, height: 1.15 },
  ],

  checkpoints: [
    { z: 4, halfWidth: 5, label: 'Start' },
    { z: 38, halfWidth: 5, label: 'Runway cleared' },
    { z: 53, y: 0.2, halfWidth: 3, label: 'Halfway island' },
    { z: 68, halfWidth: 4.5, label: 'Bumper yard' },
    { z: 80, halfWidth: 1.8, label: 'Bridge' },
    { z: 104, halfWidth: 3.6, label: 'Ramp' },
  ],

  // Pickups for Spark Snatch. Ignored by Dash. Three placement rules, each
  // learned the hard way from a Spark the bot could never touch:
  //   - clear of every bumper's shove radius (R6), or reaching for it is a fall
  //   - on ground the player runs along, not in a jump's landing zone, since
  //     you arc high over the first few units after a big gap
  //   - within a stride of the running line, so it is a detour and not a trip
  sparks: [
    { x: 0, y: 1.1, z: 10 },
    { x: -2.0, y: 1.1, z: 22.5 },
    { x: 2.0, y: 1.1, z: 36 },
    { x: 0, y: 1.3, z: 53 },
    { x: 0.2, y: 1.1, z: 71.5 },
    { x: 0, y: 1.1, z: 81 },
    { x: 0, y: 1.1, z: 104.5 },
    { x: 0, y: 4.1, z: 127 },
  ],

  // Decorative only — the bridge reads as narrow without narrowing the path.
  props: [
    {
      kind: 'postRow',
      fromZ: 79,
      toZ: 101,
      step: 2.4,
      offsets: [-1.5, 1.5],
      y: 0.35,
      color: PALETTE.cream,
    },
  ],

  finish: {
    gate: { x: 0, y: 3, z: 121, legOffset: 4.4, archRadius: 4.4, glowRadius: 3.1, glowY: 3.4 },
    zone: { minX: -6.5, maxX: 6.5, minZ: 123, maxZ: 134, minY: 1.5 },
    beacons: { offsets: [-5, 5], y: 4.2, z: 130 },
  },

  // Sky dressing. The moduli are what make the placement look scattered; they
  // are values, not derivations, so they live here with the rest of the level.
  decor: {
    clouds: { count: 22, zMod: 165, zOffset: -14 },
    islands: { count: 14, zMod: 150, zOffset: -8 },
    balloons: { count: 16, zMod: 140, zOffset: -4 },
  },
};
