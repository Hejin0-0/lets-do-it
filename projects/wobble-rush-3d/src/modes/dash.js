import { VOID_Y } from '../course.js';
import { formatTime } from '../physics.js';

/**
 * Dash — the original race. Reach the finish zone; falling costs time, not the
 * run. This is the behaviour that used to be hardcoded in `Game`.
 */
export const dash = {
  id: 'dash',
  name: 'Dash',
  tagline: 'Reach the Glow Gate as fast as you can.',
  usesSparks: false,
  onStart() {},

  onUpdate(game) {
    // Falling is a setback, not a loss: pop back and keep the clock running.
    if (game.player.position.y < VOID_Y) game.respawnAtCheckpoint();
  },

  checkWin(game) {
    return game.course.isInFinish(game.player.position);
  },

  checkLose() {
    return false;
  },

  hud(game) {
    return {
      timerLabel: 'TIME',
      timer: game.elapsed,
      counterLabel: 'CHECKPOINT',
      counterValue: `${game.checkpointsReached} / ${game.course.checkpointCount}`,
    };
  },

  summarise(game) {
    return {
      kicker: 'GLOW GATE CLEARED',
      headline: 'NICE WOBBLE!',
      time: formatTime(game.elapsed),
      stats: [{ label: 'FALLS', value: String(game.falls) }],
      // A race is scored in seconds, so this one keeps a personal best.
      bestSeconds: game.elapsed,
    };
  },
};
