// Harbor Jelly — the feeder ship and the tug. The ship: navy topsides, red antifouling under a black boot-top,
// hatch covers under her six bays of boxes, a white accommodation block aft with bridge wings, a funnel with a
// yellow band, a turning radar, a foremast, a propeller you can see turning through the jelly. The tug: a black
// hull with a tyre fender all round and a big bow fender, a white wheelhouse with a red band, a red funnel.
// Both are vessels on the sea (src/core/diorama/vessel.js); the story moves them.
import { A, MAT } from '../../core/diorama/parts.js';
import { createVessel } from '../../core/diorama/vessel.js';
import { SHIP_BAYS } from './boxes.js';
import { H } from './layout.js';

export const SHIP = { len: 1.1, beam: 0.21, draft: 0.075, free: 0.065, pivot: 0.2 };
export const TUG = { len: 0.3, beam: 0.11, draft: 0.05, free: 0.042, pivot: 0.06 };
/** Alongside: bow east, fenders against the quay. */
export const BERTH = [-1.25, H.QZ + 0.03 + SHIP.beam / 2];
/** The tug's own berth against the fishing quay, bow east. */
export const TUG_HOME = [0.9, H.QZ + 0.03 + TUG.beam / 2];

// ----- a hull: a sheet per colour band, by height, round in the bilge -----
export function hull(B, { len, beam, draft, free }, bands, bowAt = 0.45, sternFlat = 0.9) {
  const hl = len / 2, hb = beam / 2;
  const width = (x) => {
    const u = x / hl;
    if (u > bowAt) return hb * Math.sqrt(Math.max(0, 1 - ((u - bowAt) / (1 - bowAt)) ** 2.2)) * 0.96 + hb * 0.04;
    if (u < -sternFlat) return hb * 0.9;
    return hb;
  };
  const bottom = (x) => { const u = x / hl; return -draft + (u > 0.55 ? draft * 0.75 * ((u - 0.55) / 0.45) ** 1.6 : 0) + (u < -0.8 ? draft * 0.4 * ((-0.8 - u) / 0.2) : 0); };
  const NS = 40, NY = 4;
  for (const [y0, y1, col, mat] of bands) {
    B.col(col).mat(mat);
    B.sheet(NS + 1, NY * 2 + 1, (i, j) => {
      const x = -hl + (len * i) / NS, b = bottom(x), s = j < NY ? -1 : 1, k = j < NY ? NY - j : j - NY;
      const y = Math.max(b, y0 + ((y1 - y0) * k) / NY), g = 0.5 + 0.5 * Math.min(1, (y - b) / 0.03);
      return [x, Math.min(free, y), s * width(x) * (j === NY ? 0 : g)];
    });
  }
  B.col('#4d5650').mat(MAT.MATTE).sheet(NS + 1, 2, (i, j) => { const x = -hl + (len * i) / NS; return [x, free, (j ? 1 : -1) * width(x) * 0.98]; });   // the deck
  return width;
}

/** The feeder ship (local: bow +x, waterline 0). */
export function buildShip(B) {
  const { len, beam, free } = SHIP, hl = len / 2, hb = beam / 2;
  const width = hull(B, SHIP, [[-0.2, -0.006, '#a3302a', MAT.PAINT], [-0.006, 0.009, '#1a1a1a', MAT.PAINT], [0.009, free, '#1d2b4f', MAT.PAINT]]);
  // the forecastle and its bulwark, the hatch covers
  B.col('#1d2b4f').mat(MAT.PAINT);
  for (const s of [-1, 1]) B.sheet(13, 2, (i, j) => { const x = 0.34 + (i / 12) * (hl - 0.34); return [x, free + j * 0.03, s * width(x) * 0.99]; });
  B.col('#4d5650').mat(MAT.MATTE).sheet(13, 2, (i, j) => { const x = 0.34 + (i / 12) * (hl - 0.34); return [x, free + 0.028, (j ? 1 : -1) * width(x) * 0.97]; });
  B.col('#6a7076').mat(MAT.PAINT);
  for (const x of SHIP_BAYS) B.slab(x - 0.051, free, -hb * 0.86, x + 0.051, free + 0.012, hb * 0.86);
  // the accommodation block, four decks up, the bridge with its wings and windows
  B.col('#f1f0ea').mat(MAT.PAINT);
  B.slab(-0.52, free, -hb * 0.88, -0.37, free + 0.13, hb * 0.88);
  B.slab(-0.5, free + 0.13, -hb - 0.02, -0.375, free + 0.165, hb + 0.02);
  B.col('#1e2a33').mat(MAT.GLASS);
  B.slab(-0.376, free + 0.14, -hb * 0.95, -0.372, free + 0.16, hb * 0.95);
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) B.slab(-0.51, free + 0.018 + k * 0.03, s * hb * 0.88 - 0.002, -0.38, free + 0.03 + k * 0.03, s * hb * 0.88 + 0.002);
  // the funnel with its yellow band, the radar mast, the foremast
  B.col('#1d2b4f').mat(MAT.PAINT).at(A.mul(A.t(-0.475, free + 0.13, 0), A.s(1.5, 1, 1)), () => B.cyl(0.024, 0.11, 12, 0.021));
  B.col('#f0c020').at(A.mul(A.t(-0.475, free + 0.2, 0), A.s(1.5, 1, 1)), () => B.cyl(0.0225, 0.02, 12, 0.0222, false));
  B.col('#f1f0ea').at(A.t(-0.41, free + 0.165, 0), () => B.cyl(0.004, 0.06, 6));
  B.col('#f1f0ea').at(A.t(0.47, free + 0.028, 0), () => B.cyl(0.0045, 0.13, 6));
  B.slab(0.465, free + 0.12, -0.03, 0.475, free + 0.125, 0.03);
  // the rudder (the propeller turns, a part of its own)
  B.col('#a3302a').mat(MAT.PAINT).slab(-hl + 0.005, -0.07, -0.003, -hl + 0.04, -0.012, 0.003);
}
export const MAST_TOP = [0.47, SHIP.free + 0.16, 0];
export const RADAR_AT = [-0.41, SHIP.free + 0.226, 0];
export const PROP_AT = [-SHIP.len / 2 + 0.05, -0.045, 0];
export const FUNNEL_TOP = [-0.475, SHIP.free + 0.25, 0];
export const BOW_LEAD = [SHIP.len / 2 - 0.02, SHIP.free + 0.03, 0];
export function buildRadar(B) { B.col('#f1f0ea').mat(MAT.PAINT).slab(-0.004, -0.003, -0.032, 0.004, 0.003, 0.032); B.col('#2a2a2a').slab(-0.003, -0.007, -0.004, 0.003, 0, 0.004); }
export function buildProp(B) {
  B.col('#c8a04a').mat(MAT.METAL);
  for (let k = 0; k < 4; k++) B.at(A.rx((k * Math.PI) / 2 + 0.3), () => B.at(A.mul(A.t(0, 0.016, 0), A.ry(0.5)), () => B.box(0.004, 0.026, 0.012)));
  B.at(A.rz(Math.PI / 2), () => B.cyl(0.006, 0.012, 8, 0.004));
}

/** The tug (local: bow +x, waterline 0). */
export function buildTug(B) {
  const { len, free } = TUG, hl = len / 2;
  const width = hull(B, TUG, [[-0.2, 0.006, '#a3302a', MAT.PAINT], [0.006, free, '#161616', MAT.PAINT]], 0.35, 0.85);
  // the tyre fender along the sheer, the bow fender
  const ring = [];
  for (let i = 0; i <= 24; i++) { const x = -hl + 0.01 + ((len - 0.03) * i) / 24; ring.push([x, free - 0.006, width(x) + 0.004]); }
  B.col('#222222').mat(MAT.MATTE);
  B.tube(ring, 0.006, 6); B.tube(ring.map(([x, y, z]) => [x, y, -z]), 0.006, 6);
  B.at(A.t(hl - 0.005, free - 0.012, 0), () => B.at(A.rx(Math.PI / 2), () => B.at(A.t(0, -0.035, 0), () => B.cyl(0.016, 0.07, 10))));
  // the wheelhouse, white with a red band, windows all round; the funnel; the mast; the bitts
  B.col('#f1f0ea').mat(MAT.PAINT).slab(-0.06, free, -0.034, 0.05, free + 0.035, 0.034);
  B.slab(-0.02, free + 0.035, -0.03, 0.045, free + 0.065, 0.03);
  B.col('#c0302a').slab(-0.021, free + 0.06, -0.031, 0.046, free + 0.068, 0.031);
  B.col('#1e2a33').mat(MAT.GLASS).slab(-0.019, free + 0.042, -0.0312, 0.0462, free + 0.056, 0.0312);
  B.col('#c0302a').mat(MAT.PAINT).at(A.t(-0.05, free + 0.035, 0), () => B.cyl(0.011, 0.04, 10));
  B.col('#161616').at(A.t(-0.05, free + 0.075, 0), () => B.cyl(0.0112, 0.008, 10));
  B.col('#f1f0ea').at(A.t(0.02, free + 0.068, 0), () => B.cyl(0.0025, 0.05, 6));
  B.col('#2a2a2a').mat(MAT.METAL).at(A.t(hl - 0.035, free, 0), () => B.cyl(0.005, 0.014, 8));
  B.at(A.t(-hl + 0.03, free, 0), () => B.cyl(0.005, 0.014, 8));
}
export const TUG_BOW = [TUG.len / 2 - 0.035, TUG.free + 0.012, 0];
export const TUG_FUNNEL = [-0.05, TUG.free + 0.085, 0];
export const TUG_MAST = [0.02, TUG.free + 0.12, 0];

/** o: { water, foam } — the ship and the tug as vessels, berthed. */
export function createFleet({ water, foam }) {
  const ship = createVessel({ water, foam, len: SHIP.len, beam: SHIP.beam, draft: SHIP.draft, pivot: SHIP.pivot, speed: 0.27, push: 5, wash: 1.6 });   // push well past her true displacement, or her bow wave would barely show
  const tug = createVessel({ water, foam, len: TUG.len, beam: TUG.beam, draft: TUG.draft, pivot: TUG.pivot, speed: 0.5, push: 3, wash: 1.3, spin: 1.4 });
  const F = { ship, tug };
  F.reset = () => { ship.place(BERTH[0], BERTH[1], 0); tug.place(TUG_HOME[0], TUG_HOME[1], 0); };
  F.reset();
  return F;
}
