// Harbor Jelly — things that ride at their moorings: two small yachts (white hulls with a coloured stripe, fin
// keels you can see through the jelly, furled sails) swinging to the breeze and the current round their yellow
// buoys, a spare mooring buoy, the green channel buoy off the lighthouse, and two fishing boats lying alongside
// the pier. They bob, pitch and roll on the waves (and rise and fall with the tide).
import { A, MAT } from '../../core/diorama/parts.js';
import { H } from './layout.js';
import { hull } from './ship.js';

const YACHT = { len: 0.2, beam: 0.064, draft: 0.016, free: 0.022 };
const BOAT = { len: 0.24, beam: 0.08, draft: 0.022, free: 0.03 };
export const YACHTS = [{ buoy: [-0.75, 0.85], col: '#2b5aa6', wind: 0.6, ph: 0 }, { buoy: [-0.05, 1.3], col: '#c4352b', wind: 0.75, ph: 2.1 }];
export const BUOYS = [{ at: [-1.35, 1.2], kind: 'mooring' }, { at: [0.5, 1.32], kind: 'channel' }];
export const BOATS = [{ at: [H.PIER.x - H.PIER.w / 2 - BOAT.beam / 2 - 0.012, -0.42], col: '#2f6a9a', top: '#f0ece2' }, { at: [H.PIER.x + H.PIER.w / 2 + BOAT.beam / 2 + 0.012, -0.3], col: '#b8402e', top: '#e8d8a8' }];
const RIDE = 0.1 + 0.09;   // a yacht's middle from her buoy: chain plus half her length

function buildYacht(B, col) {
  hull(B, YACHT, [[-0.2, 0.012, '#f2f2ee', MAT.GLOSS], [0.012, 0.017, col, MAT.PAINT], [0.017, YACHT.free, '#f2f2ee', MAT.GLOSS]], 0.3, 0.85);
  B.col('#2a2a2c').mat(MAT.PAINT).slab(-0.012, -0.065, -0.002, 0.016, -0.012, 0.002);   // the fin keel and its bulb
  B.at(A.t(0.0, -0.063, 0), () => B.ball(0.018, 0.005, 0.005, 1));
  B.slab(-0.098, -0.035, -0.0015, -0.085, -0.004, 0.0015);   // the rudder
  B.col('#f2f2ee').mat(MAT.GLOSS).slab(-0.035, YACHT.free, -0.02, 0.03, YACHT.free + 0.014, 0.02);   // the coachroof
  B.col('#c8ccd0').mat(MAT.METAL).at(A.t(0.02, YACHT.free, 0), () => B.cyl(0.0025, 0.24, 6));
  B.at(A.mul(A.t(0.02, YACHT.free + 0.035, 0), A.rz(Math.PI / 2)), () => B.at(A.t(0, -0.09, 0), () => B.cyl(0.002, 0.09, 6)));   // the boom
  B.col(col).mat(MAT.CLOTH).at(A.mul(A.t(-0.025, YACHT.free + 0.04, 0), A.rz(Math.PI / 2)), () => B.at(A.t(0, -0.04, 0), () => B.cyl(0.006, 0.08, 8, 0.004)));   // the sail cover
  B.col('#c8ccd0').mat(MAT.METAL).tube([[0.02, YACHT.free + 0.235, 0], [0.098, YACHT.free + 0.002, 0]], 0.0008, 4);   // the forestay
}
const MASTHEAD = [0.02, YACHT.free + 0.245, 0];
function buildBoat(B, col, top) {
  hull(B, BOAT, [[-0.2, 0.008, '#4a3a34', MAT.PAINT], [0.008, BOAT.free - 0.008, col, MAT.PAINT], [BOAT.free - 0.008, BOAT.free, top, MAT.PAINT]], 0.35, 0.8);
  B.col('#f0ece2').mat(MAT.PAINT).slab(-0.09, BOAT.free, -0.026, -0.03, BOAT.free + 0.045, 0.026);   // the wheelhouse
  B.col('#22303a').mat(MAT.GLASS).slab(-0.031, BOAT.free + 0.024, -0.022, -0.029, BOAT.free + 0.038, 0.022);
  B.col(col).mat(MAT.PAINT).slab(-0.093, BOAT.free + 0.045, -0.029, -0.027, BOAT.free + 0.051, 0.029);
  B.col('#c8ccd0').mat(MAT.METAL).at(A.t(0.04, BOAT.free, 0), () => B.cyl(0.0025, 0.1, 6));
  B.col('#8a6a4a').mat(MAT.TIMBER).slab(0.0, BOAT.free, -0.01, 0.07, BOAT.free + 0.012, 0.01);   // fish boxes
}
function buildBuoy(B, kind) {
  if (kind === 'channel') {   // a green can: a hull under the water, a can with a cone on top
    B.col('#2e8a4c').mat(MAT.GLOSS).at(A.t(0, -0.02, 0), () => B.cyl(0.02, 0.05, 12, 0.018));
    B.at(A.t(0, 0.03, 0), () => B.cyl(0.012, 0.03, 10, 0));
    B.col('#f2f2ee').mat(MAT.PAINT).at(A.t(0, 0.012, 0), () => B.cyl(0.0185, 0.006, 12, 0.0182, false));
  } else {
    B.col('#f0c020').mat(MAT.GLOSS).at(A.t(0, 0.004, 0), () => B.ball(0.014, 0.012, 0.014, 1));
    B.col('#3a3a3c').mat(MAT.METAL).at(A.t(0, 0.016, 0), () => B.cyl(0.003, 0.006, 6));
  }
}
export function buildMoorings(B, parts) {
  parts.yachts = YACHTS.map((y) => { const k = B.newPart(); buildYacht(B, y.col); return k; });
  parts.buoys = [...YACHTS.map(() => 'mooring'), ...BUOYS.map((b) => b.kind)].map((kind) => { const k = B.newPart(); buildBuoy(B, kind); return k; });
  parts.boats = BOATS.map((b) => { const k = B.newPart(); buildBoat(B, b.col, b.top); return k; });
}

/** o: { water } — the moorings' poses each tick. */
export function createMoorings({ water }) {
  const M = { yachts: YACHTS.map((y) => ({ ...y, c: [0, 0], yaw: 0, M: null })), buoys: [], boats: [] };
  /** A floating thing's frame: on the surface at (x, z), heading yaw, pitched and rolled with the waves. */
  function ride(x, z, yaw, len, beam) {
    const h = [Math.cos(yaw), Math.sin(yaw)], n = [-h[1], h[0]], s = (u, w) => water.surface(x + h[0] * u + n[0] * w, z + h[1] * u + n[1] * w);
    const pitch = Math.atan2(s(len / 2, 0) - s(-len / 2, 0), len), roll = Math.atan2(s(0, beam / 2) - s(0, -beam / 2), beam);
    return A.mul(A.t(x, s(0, 0), z), A.ry(-yaw), A.rz(pitch * 0.8), A.rx(-roll * 0.8));
  }
  M.step = (t) => {
    const f = [0, 0];
    for (const y of M.yachts) {   // downwind of her buoy, nudged by the current, bow to the buoy
      water.flow(y.buoy[0], y.buoy[1], f);
      const wa = y.wind + 0.5 * Math.sin(0.07 * t + y.ph) + 0.15 * Math.sin(0.23 * t + y.ph * 2) + Math.atan2(f[1], f[0] + 1e-6) * Math.min(1, Math.hypot(...f) * 20) * 0.3;
      y.c = [y.buoy[0] + Math.cos(wa) * RIDE, y.buoy[1] + Math.sin(wa) * RIDE]; y.yaw = wa + Math.PI;
      y.M = ride(y.c[0], y.c[1], y.yaw, YACHT.len, YACHT.beam);
    }
    M.buoys = [...M.yachts.map((y) => y.buoy), ...BUOYS.map((b) => b.at)].map(([x, z], i) => ride(x, z, i * 1.3 + 0.2 * Math.sin(t * 0.8 + i), 0.03, 0.03));
    M.boats = BOATS.map((b, i) => ride(b.at[0], b.at[1] + 0.006 * Math.sin(t * 0.6 + i * 2), -Math.PI / 2, BOAT.len, BOAT.beam));
  };
  M.pose = (buf, P, setPart) => {
    M.yachts.forEach((y, i) => setPart(buf, P.yachts[i], y.M));
    M.buoys.forEach((m, i) => setPart(buf, P.buoys[i], m));
    M.boats.forEach((m, i) => setPart(buf, P.boats[i], m));
  };
  /** The yachts' mastheads: gulls' perches that move. */
  M.mastheads = () => M.yachts.map((y) => A.apply(y.M, MASTHEAD));
  M.step(0);
  return M;
}
