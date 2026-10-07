import { dash } from './dash.js';
import { sparkSnatch } from './spark-snatch.js';
import { updraft } from './updraft.js';
import { tiltOut } from './tilt-out.js';

/**
 * A mode owns the rules of a run: what wins it, what loses it, and what the
 * HUD shows. `Game` drives the simulation and delegates every rule here, so
 * adding a mode never means adding a branch to the loop.
 *
 * Contract:
 *   id, name, tagline
 *   onStart(game)            once, when a run begins
 *   onUpdate(game, dt)       every simulated frame while running
 *   checkWin(game)  -> bool
 *   checkLose(game) -> bool
 *   hud(game)       -> {timerLabel, timer, counterLabel, counterValue}
 *   summarise(game) -> {kicker, headline, time, stats[], bestSeconds?}
 *
 * `hud` replaced the planned `hudFields` list: naming which widgets to show
 * still left `Game` deciding what to put in them, which is the branch-per-mode
 * the abstraction exists to avoid. Returning the values outright removes it.
 */
export const MODES = {
  [dash.id]: dash,
  [sparkSnatch.id]: sparkSnatch,
  [updraft.id]: updraft,
  [tiltOut.id]: tiltOut,
};

export const MODE_IDS = Object.keys(MODES);

export const DEFAULT_MODE_ID = dash.id;

export function getMode(id) {
  const mode = MODES[id];
  if (!mode) {
    throw new Error(`Unknown mode "${id}". Known modes: ${MODE_IDS.join(', ')}`);
  }
  return mode;
}
