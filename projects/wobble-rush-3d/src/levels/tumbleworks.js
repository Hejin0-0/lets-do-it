import { PALETTE } from '../palette.js';

/**
 * "Tumbleworks" — a race through machinery, in four beats.
 *
 *   turntables → a corridor that closes in → lifts → the drum
 *
 * Each beat asks something the other stages do not. A turntable punishes where
 * you land rather than when you jump: the rim travels far faster than the hub,
 * so a wide landing carries you off before you can line up the next one. The
 * narrowing corridor takes away the room to be wrong. The lifts make you wait
 * on a moving floor. The drum turns about the direction of travel, so its walls
 * arrive across the path instead of along it, and jumping does not help.
 */

const DISC_Y = 0.2;
const LIFT_LOW = 0.2;
const LIFT_HIGH = 4.4;

/**
 * Alternating offsets: dead-centre landings would make the spin free. Three
 * different colours because the sky behind them is pink — three pink discs
 * over it read as one shape.
 */
const discs = () =>
  [
    { z: 18, x: -2.2, spin: 0.6, color: PALETTE.runway },
    { z: 26.5, x: 2.2, spin: -0.75, color: PALETTE.movingDeck },
    { z: 35, x: -2.2, spin: 0.9, color: PALETTE.bumperDeck },
  ].map(({ z, x, spin, color }) => ({ type: 'disc', x, z, y: DISC_Y, radius: 3.4, spin, color }));

/** Four sections, each narrower than the last. */
const corridor = () =>
  [4.4, 3.2, 2.2, 1.5].map((hw, i) => ({
    x: 0,
    z: 42.5 + i * 5,
    hw,
    hd: 2.5,
    y: 0,
    color: i % 2 === 0 ? PALETTE.runway : PALETTE.island,
    thickness: 1,
  }));

export const tumbleworks = {
  id: 'tumbleworks',
  name: 'Tumbleworks',
  mode: 'dash',
  modes: ['dash', 'spark-snatch'],

  decks: [
    { x: 0, z: 6, hw: 6, hd: 6, y: 0, color: PALETTE.startDeck, checker: ['#ffd23f', '#fff8ec', 6] },

    // 2 — the turntables sit between here and the corridor, as obstacles
    ...corridor(),

    // 3 — landing shelf after the corridor, at the foot of the lifts
    { x: 0, z: 64, hw: 3.5, hd: 2.5, y: 0, color: PALETTE.bumperDeck },

    // 4 — the upper walkway the lifts deliver you to
    { x: 0, z: 80, hw: 3.5, hd: 3, y: 4.4, color: PALETTE.island },

    // 5 — the drum corridor, deliberately narrow so the panels cover it
    { x: 0, z: 93, hw: 2.4, hd: 10, y: 4.4, color: PALETTE.bridge, thickness: 0.9 },

    // 6 — run out and finish
    { x: 0, z: 107, hw: 4, hd: 4, y: 4.4, color: PALETTE.ramp },
    {
      x: 0,
      z: 118,
      hw: 6,
      hd: 6,
      y: 4.4,
      color: PALETTE.finishDeck,
      checker: ['#9dff9a', '#fff8ec', 6],
    },
  ],

  obstacles: [
    ...discs(),

    // A two-stage lift out of the pit, both moving together so the hop between
    // them is level. Out of phase they would be at different heights every time
    // you tried to cross, which is a coin flip rather than a decision.
    ...[69, 74].map((z) => ({
      type: 'slider',
      axis: 'y',
      x: 0,
      z,
      y: (LIFT_LOW + LIFT_HIGH) / 2,
      hw: 2.2,
      hd: 2,
      range: (LIFT_HIGH - LIFT_LOW) / 2,
      period: 5.2,
      phase: -Math.PI / 2,
    })),

    // Three drums down the walkway, alternating direction so the clear side
    // keeps moving and one lane never carries you through all three.
    ...[0, 1, 2].map((i) => ({
      type: 'rotor',
      x: 0,
      z: 87 + i * 6,
      y: 4.4,
      axisY: 3,
      radius: 3.6,
      innerRadius: 0.7,
      panels: 3,
      speed: i % 2 === 0 ? 0.95 : -0.95,
      depth: 0.9,
    })),
  ],

  checkpoints: [
    { z: 4, halfWidth: 5, label: 'Start' },
    { z: 41, halfWidth: 4, label: 'Turntables' },
    { z: 63.5, halfWidth: 3, label: 'Corridor' },
    { z: 80, y: 4.4, halfWidth: 3, label: 'Up top' },
    { z: 106, y: 4.4, halfWidth: 3.6, label: 'Drums' },
  ],

  sparks: [
    { x: 0, y: 1.1, z: 9 },
    { x: -2.2, y: 1.3, z: 18 },
    { x: -2.2, y: 1.3, z: 35 },
    { x: 0, y: 1.1, z: 47.5 },
    { x: 0, y: 1.1, z: 63.5 },
    { x: 0, y: 5.5, z: 80 },
    { x: 0, y: 5.5, z: 104 },
    { x: 0, y: 5.5, z: 116 },
  ],

  finish: {
    gate: { x: 0, y: 4.4, z: 112, legOffset: 4.4, archRadius: 4.4, glowRadius: 3.1, glowY: 3.4 },
    zone: { minX: -6, maxX: 6, minZ: 113, maxZ: 124, minY: 3.4 },
    beacons: { offsets: [-4.6, 4.6], y: 5.6, z: 120 },
  },

  decor: {
    clouds: { count: 20, zMod: 140, zOffset: -12 },
    islands: { count: 12, zMod: 126, zOffset: -6 },
    balloons: { count: 14, zMod: 120, zOffset: -4 },
  },
};
