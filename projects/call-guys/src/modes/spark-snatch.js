import { VOID_Y } from '../course.js';
import { formatTime } from '../physics.js';

/** Seconds on the clock. A clean Dash run of the same course takes ~24 s. */
const TIME_LIMIT = 70;

/**
 * Spark Snatch — a hunt. Collect every Spark before the clock runs out.
 *
 * Same course, same physics, different question: Dash asks how fast you can
 * get to the end, this asks whether you can afford the detours on the way.
 */
export const sparkSnatch = {
  id: 'spark-snatch',
  name: 'Spark Snatch',
  tagline: 'Grab every Spark before the clock runs out.',
  usesSparks: true,

  onStart(game) {
    game.ui.flashToast(`${game.course.sparks.length} SPARKS · ${TIME_LIMIT}s`, 1.6);
  },

  onUpdate(game) {
    // Falling costs time, same as Dash — but here time is the whole game.
    if (game.player.position.y < VOID_Y) game.respawnAtCheckpoint();

    const spark = game.course.claimSpark(game.player.position, game.player.height);
    if (!spark) return;

    game.effects.burst('checkpoint', spark.position, { strength: 1.2 });
    if (!game.headless) {
      const left = game.course.sparks.length - game.course.sparksCollected;
      game.ui.flashToast(left === 0 ? 'ALL SPARKS!' : `${left} TO GO`, 0.9);
    }
  },

  checkWin(game) {
    return game.course.sparks.length > 0 && game.course.sparksCollected === game.course.sparks.length;
  },

  checkLose(game) {
    return game.elapsed >= TIME_LIMIT;
  },

  hud(game) {
    return {
      timerLabel: 'LEFT',
      timer: Math.max(0, TIME_LIMIT - game.elapsed),
      counterLabel: 'SPARKS',
      counterValue: `${game.course.sparksCollected} / ${game.course.sparks.length}`,
    };
  },

  summarise(game) {
    const collected = game.course.sparksCollected;
    const total = game.course.sparks.length;
    return {
      headline: collected === total ? 'ALL SPARKS!' : 'OUT OF TIME',
      time: formatTime(game.elapsed),
      stats: [
        { label: 'SPARKS', value: `${collected} / ${total}` },
        { label: 'FALLS', value: String(game.falls) },
      ],
      // A hunt is scored by sparks, not seconds, so it keeps no personal best.
      recordBest: false,
    };
  },
};
