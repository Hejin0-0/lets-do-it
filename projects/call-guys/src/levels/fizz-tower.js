import { PALETTE } from '../palette.js';

/**
 * "Fizz Tower" — a spiral climb for Updraft.
 *
 * The numbers come straight from the jump arc. A jump gains at most ~2.33
 * units of height, and every metre of climb costs horizontal reach, so at a
 * 1.2-unit step each hop has ~5.79 units of reach available and uses about
 * 1.3 of it. That is deliberate slack: on this level the pressure is the Fizz
 * rising underneath you, not the gaps.
 *
 * Falling is fatal here rather than a setback, which is why there is one
 * checkpoint and it is the floor you start on. See `modes/updraft.js`.
 */

const RADIUS = 6;
const STEP_RISE = 1.2;
const STEPS = 21;
const STEP_TURN = Math.PI / 6; // 12 platforms per revolution
const TOP_Y = STEPS * STEP_RISE + 1.2;

const STEP_COLORS = [PALETTE.runway, PALETTE.movingDeck, PALETTE.bumperDeck, PALETTE.ramp];

/** The spiral, generated rather than typed out — the shape is the rule. */
function spiralDecks() {
  const decks = [];
  for (let i = 0; i < STEPS; i += 1) {
    const angle = i * STEP_TURN;
    decks.push({
      x: Math.sin(angle) * RADIUS,
      z: Math.cos(angle) * RADIUS,
      hw: 0.95,
      hd: 0.95,
      y: (i + 1) * STEP_RISE,
      color: STEP_COLORS[i % STEP_COLORS.length],
      thickness: 0.7,
      skirt: false,
    });
  }
  return decks;
}

export const fizzTower = {
  id: 'fizz-tower',
  name: 'Fizz Tower',
  mode: 'updraft',
  modes: ['updraft'],
  progressAxis: 'y',

  camera: { mode: 'tower', centre: { x: 0, z: 0 }, distance: 13, height: 4.2, lookHeight: 1.6 },

  decks: [
    { x: 0, z: 0, hw: 5, hd: 5, y: 0, color: PALETTE.startDeck },
    ...spiralDecks(),
    { x: 0, z: 0, hw: 2.6, hd: 2.6, y: TOP_Y, color: PALETTE.finishDeck, thickness: 0.9 },
  ],

  obstacles: [],

  checkpoints: [
    { x: 0, z: 0, y: 0, halfWidth: 3, label: 'Base', axis: 'y', style: 'pad' },
  ],

  // The Fizz reaches the top pad about 38 s in. A flawless climb takes ~14 s,
  // so the margin is the room you have to make mistakes in — not a formality.
  hazard: { baseY: -4, topY: TOP_Y + 6, radius: 17, speed: 0.85, delay: 2.5 },

  finish: {
    // No gate: the way out is up, and an arch would only block the climb.
    zone: { minX: -2.6, maxX: 2.6, minZ: -2.6, maxZ: 2.6, minY: TOP_Y - 0.3 },
  },

  decor: {
    clouds: { count: 16, zMod: 40, zOffset: -20 },
    balloons: { count: 14, zMod: 34, zOffset: -17 },
  },
};

export const FIZZ_TOWER_TOP_Y = TOP_Y;
