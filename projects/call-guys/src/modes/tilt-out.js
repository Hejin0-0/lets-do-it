import { formatTime } from '../physics.js';

/**
 * Seconds you have to stay up. The rim starts going at 6, the last collapsing
 * ring at 13, and after that only the seven tiles you burn yourself are left.
 *
 * A bot playing the optimal line — spend the doomed floor first, save the
 * permanent tiles, leave each one as late as possible — lasts 25.2 s. At a
 * 22-second target that left about three seconds of slack for a player who is
 * not optimal, which is not a margin, it is a coin flip. 18 leaves seven.
 */
const SURVIVE = 18;

/**
 * Tilt Out — the final. Outlast the floor.
 *
 * No rivals yet: with one runner the arena itself is the opponent, so the win
 * is a duration rather than a placing. Rivals are a separate phase, and this
 * mode is playable and losable without them — which is the point of shipping
 * it this way round rather than half-building both.
 */
export const tiltOut = {
  id: 'tilt-out',
  name: 'Tilt Out',
  tagline: 'Outlast the floor. Everything you stand on gives way.',
  usesSparks: false,

  onStart(game) {
    game.ui.flashToast(`STAY UP FOR ${SURVIVE}s`, 1.6);
  },

  onUpdate(game, dt) {
    game.course.updateTiles(dt, game.elapsed, game.player.groundDeck, game.effects);
  },

  checkWin(game) {
    return game.elapsed >= SURVIVE;
  },

  checkLose(game) {
    // The floor is the only thing here; below it there is nothing to land on.
    return game.player.position.y < -6;
  },

  hud(game) {
    return {
      timerLabel: 'HOLD ON',
      timer: Math.max(0, SURVIVE - game.elapsed),
      counterLabel: 'FLOOR',
      counterValue: `${game.course.tilesStanding} / ${game.course.tiles.length}`,
    };
  },

  summarise(game) {
    const won = game.outcome === 'won';
    return {
      kicker: won ? 'LAST ONE UP' : 'DOWN YOU GO',
      headline: won ? 'STILL STANDING!' : 'TILTED OUT.',
      time: formatTime(Math.min(game.elapsed, SURVIVE)),
      stats: [
        { label: 'LASTED', value: `${Math.min(game.elapsed, SURVIVE).toFixed(1)}s` },
        { label: 'FLOOR LEFT', value: String(game.course.tilesStanding) },
      ],
    };
  },
};
