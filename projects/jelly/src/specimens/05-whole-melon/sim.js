// The whole melon's world as the page runs it; the tests (tests/load.mjs) run the same one.
import { jellySim } from '../../core/jellysim.js';
import { WholeMelon } from './melon.js';

export const WholeMelonSim = jellySim();
export const TUNE = { substeps: 6, gravity: 30, tetShare: 0, cellShare: 1, stretchMax: 1.6, compressMin: 0.4, stiffK: 0.25,
  sleepV: 0.05, sleepSteps: 30, landV: 3.5, landHold: 60, landK: 0.25, landKd: 0.03, impactV: 1.2, roll: 0.006, muS: 0.8, muK: 0.55,
  handK: 0.12, handVmax: 6, lra: 1.8, handReach: 3.5, releaseV: 4, releaseW: 4, releaseKeep: 0.5,
  contactMargin: 0.012, contactPush: 0.03, contactMuS: 0.6, contactMuK: 0.45, settleV: 0.04, settleRate: 0.03, cmPerU: 10, gPerCm3: 0.96, minMassFrac: 0.25 };

/** An empty world and its piece list; mutate pieces in place so world.sdf reads the current cuts. */
export function makeWorld() {
  const world = WholeMelonSim.createWorld(TUNE), pieces = [];
  world.sdf = (p, x, y, z, out) => WholeMelon.piece(pieces[p].cuts, x, y, z, out);
  return { world, pieces };
}
