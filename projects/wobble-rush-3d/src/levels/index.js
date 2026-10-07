import { gauntlet } from './gauntlet.js';
import { fizzTower } from './fizz-tower.js';
import { sugarSteps } from './sugar-steps.js';
import { tumbleworks } from './tumbleworks.js';
import { theSaucer } from './the-saucer.js';

/** Every playable level, keyed by id. Adding a map means adding one line here. */
export const LEVELS = {
  [gauntlet.id]: gauntlet,
  [sugarSteps.id]: sugarSteps,
  [tumbleworks.id]: tumbleworks,
  [fizzTower.id]: fizzTower,
  [theSaucer.id]: theSaucer,
};

export const LEVEL_IDS = Object.keys(LEVELS);

export const DEFAULT_LEVEL_ID = gauntlet.id;

export function getLevel(id) {
  const level = LEVELS[id];
  if (!level) {
    throw new Error(`Unknown level "${id}". Known levels: ${LEVEL_IDS.join(', ')}`);
  }
  return level;
}
