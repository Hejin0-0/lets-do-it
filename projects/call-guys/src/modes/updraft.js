import { formatTime } from '../physics.js';

/**
 * Updraft — survival. Climb to the top exit before the Fizz reaches you.
 *
 * The one mode where falling is fatal rather than a setback. On a course you
 * fall into a void and there is somewhere to put you back; in a tower the thing
 * below you *is* the hazard, so a fall and a touch are the same event. That
 * makes the whole climb one attempt, which is what a survival round is.
 */
export const updraft = {
  id: 'updraft',
  name: 'Updraft',
  tagline: 'Climb. The Fizz is coming up behind you.',
  usesSparks: false,

  onStart(game) {
    game.course.hazard?.reset();
    game.ui.flashToast('CLIMB!', 1.2);
  },

  onUpdate(game, dt) {
    game.course.hazard?.update(dt, game.time);
  },

  checkWin(game) {
    return game.course.isInFinish(game.player.position);
  },

  checkLose(game) {
    const hazard = game.course.hazard;
    if (!hazard) return false;
    return hazard.touches(game.player.position);
  },

  hud(game) {
    const height = Math.max(0, game.player.position.y);
    const top = game.course.finishZone?.minY ?? 0;
    return {
      timerLabel: 'TIME',
      timer: game.elapsed,
      counterLabel: 'HEIGHT',
      counterValue: `${height.toFixed(0)} / ${top.toFixed(0)}`,
    };
  },

  summarise(game) {
    const won = game.outcome === 'won';
    const peak = Math.max(0, game.player.position.y);
    return {
      kicker: won ? 'TOP OF THE TOWER' : 'THE FIZZ GOT YOU',
      headline: won ? 'DRY AND CLEAR!' : 'GLUB.',
      time: formatTime(game.elapsed),
      stats: [{ label: won ? 'CLIMB' : 'REACHED', value: `${peak.toFixed(1)}` }],
      // Only a completed climb is a time worth keeping.
      ...(won ? { bestSeconds: game.elapsed } : {}),
    };
  },
};
