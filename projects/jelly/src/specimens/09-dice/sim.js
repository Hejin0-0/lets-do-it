// The dice's world as the page runs it; the tests (tests/load.mjs) run the same one.
import { jellySim } from '../../core/jellysim.js';
import { DiceGeo } from './geo.js';

export const DiceSim = jellySim({ EMBED_BAND: 0.06, EMBED_W: 0.5, rigidFallback: false });
export const TUNE = { gravity: 18, sleepV: 0.05, landV: 2.2, landHold: 80, landK: 0.3, landKd: 0.03, roll: 0.006, handK: 0.1, handVmax: 5, lra: 1.6,
  releaseV: 2.5, releaseW: 3, releaseKeep: 0.4, stretchMax: 1.6, compressMin: 0.45, tetShare: 0.5, stiffK: 0.3, muS: 0.9, muK: 0.6,
  settleV: 0.04, settleRate: 0.02, clingRelease: 0.45 };
export const POKE = { radius: 0.34, depth: 0.09, speed: 2.4, ring: 11 };

/** The die's geometry and an empty world for dice of it; world.setPieces puts them in. */
export function makeWorld() {
  const geo = DiceGeo.build(DiceSim.embed);
  const world = DiceSim.createWorld(TUNE);
  world.sdf = (p, x, y, z, out) => DiceGeo.sdf(x, y, z, out);
  world.collider = DiceGeo.rimCollider(world);
  return { geo, world };
}
