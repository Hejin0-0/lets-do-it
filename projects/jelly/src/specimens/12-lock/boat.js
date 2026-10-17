// Lock Jelly — narrowboats: the model (a black lofted hull, a painted cabin with its lining-out, brass
// portholes, the cratch, chimney, can, plank and pole, fenders, headlamp and swan-neck tiller), and the
// boat's way through the water. A boat steers like a narrowboat: a pivot point a third of the way back from
// the bow follows the route and the stern trails behind it (so the stern tracks inside a bend rather than
// swinging out). It heaves, pitches and rolls on the local surface and pushes its displacement along.
import { A, MAT } from '../../core/diorama/parts.js';
import { makeRoute, createVessel } from '../../core/diorama/vessel.js';
import { L } from './layout.js';

export const BOAT = { len: 0.85, beam: 0.14, draft: 0.035, pivot: 0.15, gunwale: 0.045 };
export const LIVERY = {
  wobble: { cabin: '#2a6a42', panel: '#2f7a4c', lining: '#c4302b', roof: '#7a2a24' },
  kingfisher: { cabin: '#1f4f8a', panel: '#c43a2f', lining: '#f2c94c', roof: '#2b2b2b', pots: 3 },
  bramble: { cabin: '#7a2234', panel: '#efe3c4', lining: '#2f6b3a', roof: '#5a4a3a', pots: 4 },
  dabchick: { cabin: '#2f6b3a', panel: '#f2c94c', lining: '#c43a2f', roof: '#3a3a3a', pots: 2 },
};
/** The three boats moored along the basin's far bank (the ginger cat lives on Bramble). */
export const MOORED = [
  { x: 0.98, z: -2.2, len: 0.58, yaw: 0, livery: 'kingfisher' },
  { x: 1.62, z: -2.2, len: 0.6, yaw: Math.PI, livery: 'bramble', cat: true },
  { x: 2.2, z: -2.2, len: 0.5, yaw: 0, livery: 'dabchick' },
];

// ----- the model (local frame: bow +x, waterline y = 0, beam along z) -----
/** livery: { cabin, panel, lining, roof, pots? }. Emits into B; returns the roof height and the cabin's extent. */
export function narrowboat(B, livery, { len = BOAT.len, beam = BOAT.beam } = {}) {
  const hl = len / 2, hb = beam / 2, d = BOAT.draft, g = BOAT.gunwale;
  // hull: stations along x, a flat bottom and near-vertical sides with a little tumblehome
  const width = (x) => {
    const u = x / hl;
    if (u > 0.55) return hb * Math.sqrt(Math.max(0, 1 - ((u - 0.55) / 0.45) ** 2)) * 0.96 + hb * 0.04;   // the bow
    if (u < -0.82) return hb * (0.9 + 0.1 * Math.sqrt(Math.max(0, 1 - ((u + 0.82) / 0.18) ** 2)));       // the counter stern
    return hb;
  };
  const bottom = (x) => { const u = x / hl; return -d + (u > 0.7 ? 0.02 * ((u - 0.7) / 0.3) ** 2 : 0) + (u < -0.8 ? 0.025 * ((-0.8 - u) / 0.2) : 0); };
  const NS = 40, prof = [[0, 0], [0.92, 0], [1, 0.12], [1, 0.75], [0.97, 1]];   // (width fraction, height fraction) round the half section
  B.col('#141414').mat(MAT.PAINT);
  B.sheet(NS + 1, prof.length * 2 - 1, (i, j) => {
    const x = -hl + (len * i) / NS, w = width(x), b = bottom(x), k = j < prof.length ? prof.length - 1 - j : j - prof.length + 1, s = j < prof.length ? -1 : 1;
    const [pw, ph] = prof[k];
    return [x, b + (g - b) * ph, s * w * pw];
  });
  // the gunwale's rubbing strake, the decks fore and aft
  B.col('#1c1c1c');
  B.sheet(NS + 1, 2, (i, j) => { const x = -hl + (len * i) / NS; return [x, g, (j ? 1 : -1) * width(x) * 0.97]; });
  B.col('#2a2622').mat(MAT.MATTE);
  for (const s of [-1, 1]) B.sheet(NS + 1, 2, (i, j) => { const x = -hl + (len * i) / NS; return [x, g + 0.006 * j, s * (width(x) + 0.004 * j)]; });
  // the cabin, its roof and the lining-out
  const c0 = -hl * 0.66, c1 = hl * 0.5, cw = hb * 0.86, ch = 0.075;
  B.col(livery.cabin).mat(MAT.PAINT).slab(c0, g, -cw, c1, g + ch, cw);
  B.col(livery.roof).mat(MAT.PAINT).slab(c0 - 0.004, g + ch, -cw - 0.004, c1 + 0.004, g + ch + 0.007, cw + 0.004);
  for (const s of [-1, 1]) {
    B.col(livery.panel).slab(c0 + 0.02, g + 0.012, s * (cw + 0.0006) - 0.0005, c1 - 0.02, g + ch - 0.012, s * (cw + 0.0012));
    B.col(livery.lining);
    for (const [ya, yb] of [[g + 0.014, g + 0.017], [g + ch - 0.017, g + ch - 0.014]]) B.slab(c0 + 0.022, ya, s * cw - 0.0005, c1 - 0.022, yb, s * (cw + 0.0018));
    for (const xx of [c0 + 0.022, c1 - 0.025]) B.slab(xx, g + 0.014, s * cw - 0.0005, xx + 0.003, g + ch - 0.014, s * (cw + 0.0018));
    // brass portholes with dark glass
    for (let k = 0; k < 5; k++) {
      const xx = c0 + 0.06 + ((c1 - c0 - 0.12) * k) / 4;
      B.at(A.mul(A.t(xx, g + ch * 0.55, s * (cw + 0.001)), A.rx((s * Math.PI) / 2)), () => {
        B.col('#c99a3a').mat(MAT.METAL).cyl(0.009, 0.003, 10);
        B.col('#202a30').mat(MAT.GLASS).at(A.t(0, 0.0032, 0), () => B.disc(0.0068, 0, 1, 10));
      });
    }
  }
  // stern doors, a brass swan-neck tiller and the rudder
  B.col(livery.panel).mat(MAT.PAINT).slab(c0 - 0.002, g + 0.01, -cw * 0.7, c0, g + ch - 0.005, cw * 0.7);
  B.col('#c99a3a').mat(MAT.METAL).tube([[-hl + 0.02, g + 0.02, 0], [-hl + 0.02, g + 0.05, 0], [-hl + 0.035, g + 0.068, 0], [-hl + 0.07, g + 0.072, 0], [-hl + 0.1, g + 0.07, 0]], 0.0035, 6);
  B.col('#5a3a24').mat(MAT.MATTE).at(A.mul(A.t(-hl + 0.1, g + 0.07, 0), A.rz(-Math.PI / 2)), () => B.cyl(0.004, 0.025, 6));
  B.col('#141414').mat(MAT.PAINT).slab(-hl - 0.03, -d + 0.005, -0.003, -hl + 0.005, g * 0.4, 0.003);
  // the cratch board and its cover over the well deck
  const k0 = c1, k1 = hl * 0.78;
  B.col(livery.panel).mat(MAT.PAINT).at(A.mul(A.t(k1, g, 0), A.ry(Math.PI / 2)), () => B.prism([[-cw * 0.95, 0], [cw * 0.95, 0], [0, ch + 0.012]], 0.006));
  B.col(livery.lining).at(A.mul(A.t(k1 + 0.0035, g + ch * 0.38, 0), A.ry(Math.PI / 2)), () => B.prism([[0, -0.018], [0.018, 0], [0, 0.018], [-0.018, 0]], 0.002));
  B.col('#2f3d2c').mat(MAT.MATTE);
  B.quad([k0, g + ch + 0.006, -cw], [k1, g + ch * 0.1, -cw * 0.95], [k1, g + ch + 0.012, 0], [k0, g + ch + 0.012, 0]);
  B.quad([k0, g + ch + 0.006, cw], [k1, g + ch * 0.1, cw * 0.95], [k1, g + ch + 0.012, 0], [k0, g + ch + 0.012, 0]);
  // roof things: chimney with brass bands, a Buckby can, plank and pole
  const roof = g + ch + 0.007;
  B.at(A.t(c1 - 0.08, roof, 0), () => {
    B.col('#161616').mat(MAT.PAINT).cyl(0.0085, 0.05, 10);
    B.col('#c99a3a').mat(MAT.METAL);
    for (const y of [0.012, 0.04]) B.at(A.t(0, y, 0), () => B.cyl(0.0095, 0.004, 10));
  });
  B.at(A.t(c1 - 0.2, roof, 0.012), () => {
    B.col(livery.lining).mat(MAT.PAINT).lathe([[0.012, 0], [0.013, 0.004], [0.013, 0.026], [0.009, 0.032], [0.006, 0.034], [0.006, 0.04], [0, 0.04]], 10);
    B.col(livery.cabin).at(A.t(0, 0.012, 0), () => B.cyl(0.0135, 0.008, 10));
    B.col('#f0d070').at(A.t(0, 0.0155, 0), () => B.ball(0.004, 0.003, 0.014, 0));
  });
  B.col('#8a6a46').mat(MAT.MATTE).slab(c0 + 0.03, roof, -cw + 0.004, c1 - 0.12, roof + 0.006, -cw + 0.03);
  B.col('#c8b590').at(A.mul(A.t(c0 + 0.02, roof + 0.008, cw - 0.015), A.rz(-Math.PI / 2)), () => B.cyl(0.0035, c1 - c0 - 0.06, 6));
  // rope fenders at bow and stern, side fenders, the headlamp
  B.col('#b89a6a').mat(MAT.MATTE);
  B.at(A.t(hl + 0.006, g - 0.01, 0), () => B.ball(0.016, 0.02, 0.022, 1));
  B.at(A.t(-hl - 0.004, g - 0.01, 0), () => B.ball(0.014, 0.018, 0.03, 1));
  for (const s of [-1, 1]) for (const xx of [-0.2, 0.15]) B.at(A.t(xx * len, g - 0.012, s * (hb + 0.006)), () => B.ball(0.006, 0.016, 0.006, 0));
  B.at(A.mul(A.t(k1 + 0.006, g + ch * 0.75, 0), A.rz(-Math.PI / 2)), () => { B.col('#1a1a1a').mat(MAT.PAINT).cyl(0.008, 0.012, 8); B.col('#fff2c0').mat(MAT.GLOW).at(A.t(0, 0.012, 0), () => B.disc(0.0065, 0, 1, 8)); });
  // flowerpots for the moored boats
  for (let k = 0; k < (livery.pots || 0); k++) {
    B.at(A.t(c0 + 0.05 + k * 0.07, roof, -cw * 0.4 + (k % 2) * 0.03), () => {
      B.col('#b5572e').mat(MAT.MATTE).cyl(0.009, 0.014, 8, 0.011);
      B.col('#3f7a2a').mat(MAT.LEAF).at(A.t(0, 0.02, 0), () => B.ball(0.013, 0.01, 0.013, 1));
      B.col(['#e8484e', '#f2c53a', '#ffffff', '#d26ad8'][k % 4]).mat(MAT.MATTE);
      for (let q = 0; q < 4; q++) B.at(A.t(Math.cos(q * 1.7) * 0.008, 0.028, Math.sin(q * 1.7) * 0.008), () => B.ball(0.0035, 0.0035, 0.0035, 0));
    });
  }
  return { roof, c0, c1, cw };
}
/** A steerer in a red jumper, standing at the tiller (a part of its own: they duck under bridges). */
export function steererFigure(B) {
  B.col('#2b2d33').mat(MAT.MATTE);
  for (const s of [-1, 1]) B.at(A.t(0, 0, s * 0.008), () => B.cyl(0.0055, 0.05, 6, 0.0065));
  B.col('#c0312b').at(A.t(0, 0.05, 0), () => B.ball(0.012, 0.024, 0.016, 1));
  for (const s of [-1, 1]) B.at(A.mul(A.t(0.004, 0.066, s * 0.017), A.rz(-0.9)), () => B.cyl(0.0045, 0.03, 6, 0.004));
  B.col('#e8b896').at(A.t(0, 0.088, 0), () => B.ball(0.0095, 0.0105, 0.0095, 1));
  B.col('#3a2a20').at(A.t(-0.002, 0.095, 0), () => B.ball(0.0098, 0.006, 0.0098, 1));
}

// ----- routes -----
export { makeRoute };

const { ZM, XT, XB, CHX, BEND } = L;
/** Where the boat lies in the chamber (its middle): clear of the cill and of the bottom gate's sweep. The routes are drawn for the pivot. */
export const CHAMBER_X = -0.05;
const PIV = BOAT.pivot;
const arc = (a0, a1, r = 0.65, n = 8) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [BEND[0] + r * Math.sin(a), BEND[1] + r * Math.cos(a)]; });
/** Down: out of the bottom gate, round the bend, under the bridge, round the island, and back into the chamber bow first. */
export const DOWN = [[CHAMBER_X + PIV, ZM], [XB + 0.2, ZM], ...arc(0, Math.PI / 2, 0.6), [CHX, 0.5],
  [2.18, -0.2], [2.18, -1.45], [1.75, -1.85], [1.12, -1.7], [0.98, -0.9], [1.1, -0.35], [1.5, -0.15], [CHX - 0.1, 0.1], [CHX, 0.6], [CHX, 0.9], [CHX - 0.04, 1.6], ...arc(Math.PI / 2, 0.4, 0.64, 6), [BEND[0] - 0.1, ZM - 0.06], [XB + 0.2, ZM - 0.03], [CHAMBER_X - PIV, ZM]];
/** Up: out of the top gate along the pound to the winding hole; she turns about there and comes back. */
export const UP_OUT = [[CHAMBER_X - PIV, ZM], [XT - 0.3, ZM], [-1.5, ZM - 0.02], [-1.92, ZM - 0.1]];
export const WIND_AT = [-2.02, 2.1];
export const UP_BACK = [[-1.77 + PIV, 2.3], [-1.4, ZM - 0.02], [XT - 0.3, ZM], [CHAMBER_X + PIV, ZM]];

// ----- the boat's way: the shared vessel, slowing by the gates, with a chimney -----
/** A boat on the water: o: { water, foam, len?, beam?, pivot? }. */
export function createBoat({ water, foam, len = BOAT.len, beam = BOAT.beam, pivot = PIV }) {
  const slow = (x, z) => (z > ZM - 0.12 && x > XT - 0.6 && x < XB + 0.45 ? 0.5 : 1);
  const b = createVessel({ water, foam, len, beam, draft: BOAT.draft, pivot, speed: 0.24, slow });
  b.place(CHAMBER_X, ZM, 0);
  /** The top of the chimney, block-local. */
  b.chimney = () => A.apply(b.matrix(), [len / 4 - 0.08, 0.18, 0]);
  return b;
}
