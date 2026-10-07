import { PALETTE } from '../palette.js';

/**
 * "Sugar Steps" — a second race, built from the same vocabulary as The
 * Gauntlet but asking different questions.
 *
 * The Gauntlet is about timing: sweepers to jump, sliders to catch. This one
 * is about holding a line. Belts drag you sideways, pendulums make you pick a
 * side, the staircase drops you faster than you expect, and the last belt runs
 * against you the whole way.
 *
 * No new mechanics were needed for the belts: a static deck that reports a
 * per-frame delta is carried by the same rider logic that carries a slider.
 */

/** Belts tile the runway end to end, so hd * 2 must equal the spacing. */
const BELT_SPEED = 3.4;
const belt = (z, direction) => ({
  x: 0,
  z,
  hw: 6,
  hd: 2,
  y: 0,
  color: direction > 0 ? PALETTE.movingDeck : PALETTE.runway,
  conveyor: { x: BELT_SPEED * direction },
});

/** Four steps down, each a short drop — small enough to walk off, not fall. */
const staircase = () =>
  [0, 1, 2, 3].map((i) => ({
    x: 0,
    z: 56 + i * 3,
    hw: 2.5,
    hd: 1.5,
    y: -0.9 * (i + 1),
    color: i % 2 === 0 ? PALETTE.island : PALETTE.bridge,
    thickness: 0.8,
    skirt: false,
  }));

export const sugarSteps = {
  id: 'sugar-steps',
  name: 'Sugar Steps',
  mode: 'dash',
  modes: ['dash', 'spark-snatch'],

  decks: [
    { x: 0, z: 6, hw: 6, hd: 6, y: 0, color: PALETTE.startDeck, checker: ['#ffd23f', '#fff8ec', 6] },

    // 1 — the belts, alternating so you are corrected every two strides
    belt(14, 1),
    belt(18, -1),
    belt(22, 1),
    belt(26, -1),
    belt(30, 1),

    // 2 — breather and checkpoint
    { x: 0, z: 35, hw: 5, hd: 3, y: 0, color: PALETTE.island },

    // 3 — the pendulum walk, on a deliberately narrow deck. A ball hazard has a
    //     small instantaneous footprint no matter how hard it swings, so on a
    //     wide deck it is scenery. Narrow the floor instead and the dodge is
    //     real: the clear lane is about a unit wide and it keeps moving.
    { x: 0, z: 46, hw: 3.4, hd: 8, y: 0, color: PALETTE.bumperDeck },

    // 4 — down the steps
    ...staircase(),

    // 5 — the uphill belt: it runs against you for the whole span
    {
      x: 0,
      z: 74,
      hw: 2.6,
      hd: 7,
      y: -4.5,
      color: PALETTE.bridge,
      thickness: 0.8,
      conveyor: { z: -2.4 },
    },

    // 6 — climb back out
    { x: 0, z: 87, hw: 4, hd: 5, y: -4.5, slope: 4.5, color: PALETTE.ramp, skirt: false },
    { x: 0, z: 93.5, hw: 4, hd: 1.5, y: 0, color: PALETTE.ramp },
    {
      x: 0,
      z: 102,
      hw: 6,
      hd: 6,
      y: 0,
      color: PALETTE.finishDeck,
      checker: ['#9dff9a', '#fff8ec', 6],
    },
  ],

  obstacles: [
    // A heavy ball on a long rod, swinging shallow so it stays low the whole
    // way across. Amplitude 0.42 on a 6.7 rod sweeps ±2.73 — the full width of
    // the deck below — and the bob never climbs far enough to be walked under.
    //
    // Thirds of a cycle apart, so the lane that is clear keeps moving and
    // hugging one edge through all three does not work.
    ...[0, 1, 2].map((i) => ({
      type: 'pendulum',
      x: 0,
      z: 41 + i * 5,
      pivotY: 7.9,
      length: 6.7,
      bobRadius: 1.3,
      amplitude: 0.42,
      period: 2.8,
      phase: (i * Math.PI * 2) / 3,
    })),
  ],

  checkpoints: [
    { z: 4, halfWidth: 5, label: 'Start' },
    { z: 34, halfWidth: 4.5, label: 'Belts cleared' },
    { z: 53.5, halfWidth: 2.4, label: 'Pendulums' },
    { z: 68, y: -4.5, halfWidth: 2.4, label: 'Uphill belt' },
    { z: 79, y: -4.5, halfWidth: 2.4, label: 'Ramp' },
  ],

  sparks: [
    { x: 0, y: 1.1, z: 9 },
    { x: -3.0, y: 1.1, z: 20 },
    { x: 3.0, y: 1.1, z: 28 },
    // Third lesson about pickups, after "clear of a shove" and "not in a jump's
    // landing zone": a Spark has to sit on the line the hazard's own answer
    // takes. One in the middle of the pendulum walk was safe — it sat in the
    // clear band between two arcs — and still uncollectable, because the way
    // through that section is to hug whichever edge the bob has left, and there
    // is no time to cross back. So this one lives on the belts, where crossing
    // lanes is the mechanic rather than a mistake.
    // Mid-belt, not on a seam: at z=24 two belts meet and the drift reverses
    // underfoot, so the line through that exact point is the one place on the
    // runway nobody holds.
    { x: 0, y: 1.1, z: 22 },
    { x: 0, y: 1.1, z: 35 },
    { x: 0, y: -0.7, z: 59 },
    { x: 0, y: -3.4, z: 72 },
    { x: 0, y: 1.1, z: 100 },
  ],

  finish: {
    gate: { x: 0, y: 0, z: 96, legOffset: 4.4, archRadius: 4.4, glowRadius: 3.1, glowY: 3.4 },
    zone: { minX: -6, maxX: 6, minZ: 97, maxZ: 108, minY: -1 },
    beacons: { offsets: [-4.6, 4.6], y: 1.2, z: 104 },
  },

  decor: {
    clouds: { count: 20, zMod: 130, zOffset: -12 },
    islands: { count: 12, zMod: 118, zOffset: -6 },
    balloons: { count: 14, zMod: 112, zOffset: -4 },
  },
};
