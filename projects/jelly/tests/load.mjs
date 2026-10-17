// The refactored modules under the names the jellies' headless tests use (each test was written
// against its page's own scripts; now they all run against the shared code). Run: npm test
import { tetSim } from '../src/core/cut/tetsim.js';
import { jellySim } from '../src/core/jellysim.js';
import { createCitrus, ZC, R } from '../src/specimens/07-citrus-cutter/geo.js';
import { KNIFE_SMALL, knifeMesh, bladeHalf } from '../src/core/cut/tools.js';
import { SEED_LEN, seedMesh } from '../src/core/jelly/seeds.js';
import * as melon06 from '../src/specimens/06-melon-knife/geo.js';
import { FRUITS, fruitGeo } from '../src/specimens/08-press/fruits.js';
import { Press } from '../src/specimens/08-press/press.js';
import { Fracture } from '../src/specimens/08-press/fracture.js';
import { DiceGeo } from '../src/specimens/09-dice/geo.js';
import { WholeMelon } from '../src/specimens/05-whole-melon/melon.js';
import { IJ } from '../src/specimens/10-island/world.js';

// the citrus slice on the tet solver
export const citrus02 = { CitrusGeo: createCitrus(), CitrusSim: tetSim({ ZC, RIND_R: R - 0.19, DENSITY: 1.05, massScale: 1, keScale: 0.05, SUBSTEPS: 10 }) };

// 06: the melon wedge, its knife and seeds
export const MelonGeo = { ...melon06.createMelon(), ...melon06, SEED_LEN, seedMesh, KNIFE: KNIFE_SMALL, knifeMesh: () => knifeMesh(KNIFE_SMALL), bladeHalf: (y) => bladeHalf(KNIFE_SMALL, y) };
export const MelonSim = tetSim({ ZC: melon06.ZC, RIND_R: melon06.R - 0.16, SUBSTEPS: 10 });

// 08: the press
export const PressGeo = { make: (cfg) => { const K = fruitGeo(cfg); return { ...K, region: K.sliceRegion }; } };
export const PressSim = tetSim({ SUBSTEPS: 8, STIFF_K: 0.08, COMPRESS_MIN: 0.35, RELEASE_V: 7, PIN: true, ROLL: 0.004 });
export { FRUITS, Press, Fracture, IJ };

// 09: the dice
const DiceSim = jellySim({ EMBED_BAND: 0.06, EMBED_W: 0.5, rigidFallback: false });
const DICE_TUNE = { gravity: 18, sleepV: 0.05, landV: 2.2, landHold: 80, landK: 0.3, landKd: 0.03, roll: 0.006, handK: 0.1, handVmax: 5, lra: 1.6,
  releaseV: 2.5, releaseW: 3, releaseKeep: 0.4, stretchMax: 1.6, compressMin: 0.45, tetShare: 0.5, stiffK: 0.3, muS: 0.9, muK: 0.6,
  settleV: 0.04, settleRate: 0.02, clingRelease: 0.45 };
export const dice = {
  JellySim: DiceSim, DiceGeo, TUNE: DICE_TUNE, POKE: { radius: 0.34, depth: 0.09, speed: 2.4, ring: 11 },
  makeWorld(n, opts = {}) {
    const geo = DiceGeo.build(DiceSim.embed);
    const world = DiceSim.createWorld(Object.assign({}, DICE_TUNE, opts));
    world.sdf = (p, x, y, z, out) => DiceGeo.sdf(x, y, z, out);
    world.setFirmness(opts.firmness ?? 30); world.setDamping(opts.damping ?? 20);
    world.collider = DiceGeo.rimCollider(world);
    return { geo, world };
  },
  // x = R X + t, as a spec for setPieces
  placed(geo, Rm, t, v = [0, 0, 0], w = [0, 0, 0]) {
    const X = geo.X, m = X.length / 3, x = new Float32Array(3 * m), vv = new Float32Array(3 * m);
    for (let i = 0; i < m; i++) {
      const a = X[3 * i], b = X[3 * i + 1], c = X[3 * i + 2];
      const px = Rm[0] * a + Rm[1] * b + Rm[2] * c, py = Rm[3] * a + Rm[4] * b + Rm[5] * c, pz = Rm[6] * a + Rm[7] * b + Rm[8] * c;
      x[3 * i] = px + t[0]; x[3 * i + 1] = py + t[1]; x[3 * i + 2] = pz + t[2];
      vv[3 * i] = v[0] + w[1] * pz - w[2] * py; vv[3 * i + 1] = v[1] + w[2] * px - w[0] * pz; vv[3 * i + 2] = v[2] + w[0] * py - w[1] * px;
    }
    return { X, tets: geo.tets, cells: geo.cells, x, v: vv };
  },
  I3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  rotAxis(ax, ang) {
    const l = Math.hypot(...ax), [x, y, z] = ax.map((v) => v / l), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    return [c + t * x * x, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, c + t * y * y, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, c + t * z * z];
  },
  mul3: (A, B) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[3 * i + j] = A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]; return o; },
};

// 05: the whole melon
const MelonJelly = jellySim();
const MELON_TUNE = { substeps: 6, gravity: 30, tetShare: 0, cellShare: 1, stretchMax: 1.6, compressMin: 0.4, stiffK: 0.25,
  sleepV: 0.05, sleepSteps: 30, landV: 3.5, landHold: 60, landK: 0.25, landKd: 0.03, impactV: 1.2, roll: 0.006, muS: 0.8, muK: 0.55,
  handK: 0.12, handVmax: 6, lra: 1.8, handReach: 3.5, releaseV: 4, releaseW: 4, releaseKeep: 0.5,
  contactMargin: 0.012, contactPush: 0.03, contactMuS: 0.6, contactMuK: 0.45, settleV: 0.04, settleRate: 0.03, cmPerU: 10, gPerCm3: 0.96, minMassFrac: 0.25 };
export const wholeMelon = {
  JellySim: MelonJelly, WholeMelon, TUNE: MELON_TUNE,
  makeWorld(opts = {}) {
    const world = MelonJelly.createWorld(Object.assign({}, MELON_TUNE, opts)), pieces = [];
    world.sdf = (p, x, y, z, out) => WholeMelon.piece(pieces[p].cuts, x, y, z, out);
    world.setFirmness(opts.firmness ?? 50); world.setDamping(opts.damping ?? 30);
    return { world, pieces };
  },
  // a piece's rest lattice placed in the world: x = X + t
  spec(pc, t = [0, -WholeMelon.BOTTOM, 0], v = [0, 0, 0]) {
    const X = pc.sim.X, x = new Float32Array(X.length), vv = new Float32Array(X.length);
    for (let i = 0; i < X.length; i += 3) { x[i] = X[i] + t[0]; x[i + 1] = X[i + 1] + t[1]; x[i + 2] = X[i + 2] + t[2]; vv[i] = v[0]; vv[i + 1] = v[1]; vv[i + 2] = v[2]; }
    return { X, tets: pc.sim.tets, cells: pc.sim.cells, cellRind: pc.sim.cellRind, tetRind: pc.sim.tetRind, x, v: vv };
  },
};
