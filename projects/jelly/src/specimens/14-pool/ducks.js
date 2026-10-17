// Pool Jelly — the rubber ducks: a glossy duck in eight colours and seven things to wear (a party hat, a top
// hat, a crown, sunglasses, a bow tie, a flower, a pirate's hat). The parts mesh bakes its colours, so every
// duck slot carries a body in each colour and each hat, and only the chosen ones are shown.
import { A, MAT } from '@lid/diorama/parts.js';

export const DS = 3.0;   // the ducks' size against Lock Jelly's little one
export const MAX_DUCKS = 40;
export const COLOURS = [
  { id: 'yellow', label: 'Classic', body: '#f7c81e', beak: '#f2731e' },
  { id: 'pink', label: 'Pink', body: '#f59ac0', beak: '#f2731e' },
  { id: 'blue', label: 'Sky', body: '#5ab4f0', beak: '#f2a01e' },
  { id: 'mint', label: 'Mint', body: '#7fdcb4', beak: '#f2731e' },
  { id: 'orange', label: 'Orange', body: '#ff8a2a', beak: '#d8381a' },
  { id: 'purple', label: 'Grape', body: '#9a6ad8', beak: '#f2a01e' },
  { id: 'white', label: 'Cloud', body: '#f6f4ee', beak: '#f2a01e' },
  { id: 'black', label: 'Night', body: '#2c2c32', beak: '#f2731e' },
];
export const HATS = [
  { id: 'none', label: 'None' }, { id: 'party', label: 'Party hat' }, { id: 'tophat', label: 'Top hat' }, { id: 'crown', label: 'Crown' },
  { id: 'shades', label: 'Shades' }, { id: 'bowtie', label: 'Bow tie' }, { id: 'flower', label: 'Flower' }, { id: 'pirate', label: 'Pirate' },
];
/** The duck as a floater: three spheres (body, tail, head), light, so it rides high. */
export const DUCK_FLOAT = {
  spheres: [[0, 0.018, 0, 0.022], [-0.018, 0.022, 0, 0.014], [0.014, 0.044, 0, 0.013]].map((s) => s.map((v) => v * DS)),
  com: [0, 0.01 * DS, 0], rho: 0.32, mu: 0.35, e: 0.4,
};

// ----- models, in the little duck's units (scaled by DS); forward +x, up +y -----
function duck(B, c) {
  B.col(c.body).mat(MAT.GLOSS);
  B.at(A.t(0, 0.018, 0), () => B.ball(0.025, 0.018, 0.02, 1));
  B.at(A.mul(A.t(-0.02, 0.026, 0), A.rz(0.5)), () => B.ball(0.012, 0.008, 0.012, 1));
  B.at(A.t(0.014, 0.044, 0), () => B.ball(0.0135, 0.0135, 0.013, 1));
  B.at(A.mul(A.t(-0.004, 0.026, 0), A.rz(0.15)), () => { for (const s of [-1, 1]) B.at(A.t(0, 0, s * 0.017), () => B.ball(0.012, 0.006, 0.004, 1)); });   // the wings
  B.col(c.beak).at(A.t(0.03, 0.041, 0), () => B.ball(0.008, 0.003, 0.0065, 0));
  B.col(c.id === 'black' ? '#f4f4f0' : '#121212');
  for (const s of [-1, 1]) B.at(A.t(0.022, 0.05, s * 0.0085), () => B.ball(0.0022, 0.0026, 0.0018, 0));
}
const HAT_AT = [0.014, 0.0565, 0];   // the top of the head
function hat(B, id) {
  if (id === 'party') {
    B.at(A.mul(A.t(...HAT_AT), A.rz(-0.25)), () => {
      B.col('#e8406a').mat(MAT.PAINT).cyl(0.0085, 0.009, 12, 0.0052);
      B.col('#40b8e8').at(A.t(0, 0.009, 0), () => B.cyl(0.0052, 0.009, 12, 0.002));
      B.col('#f8e040').at(A.t(0, 0.018, 0), () => B.cyl(0.002, 0.005, 12, 0));
      B.col('#f6f4ee').mat(MAT.MATTE).at(A.t(0, 0.0235, 0), () => B.ball(0.0028));
    });
  } else if (id === 'tophat') {
    B.at(A.t(...HAT_AT), () => {
      B.col('#1c1c20').mat(MAT.PAINT).at(A.t(0, -0.0015, 0), () => B.cyl(0.013, 0.0016, 16));
      B.cyl(0.008, 0.017, 14, 0.0085);
      B.col('#c0302a').cyl(0.0082, 0.004, 14, 0.0083, false);
    });
  } else if (id === 'crown') {
    B.at(A.t(...HAT_AT), () => {
      B.col('#e8b832').mat(MAT.METAL).at(A.t(0, -0.002, 0), () => B.cyl(0.0088, 0.006, 14, 0.0092, false));
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; B.at(A.t(Math.cos(a) * 0.0088, 0.004, Math.sin(a) * 0.0088), () => B.cyl(0.0022, 0.006, 6, 0)); }
      B.col('#d0203a').mat(MAT.GLOSS); for (const a of [0, 2.1, 4.2]) B.at(A.t(Math.cos(a) * 0.0094, 0.001, Math.sin(a) * 0.0094), () => B.ball(0.0016));
    });
  } else if (id === 'shades') {
    B.col('#141418').mat(MAT.GLOSS);
    for (const s of [-1, 1]) B.at(A.t(0.0245, 0.0505, s * 0.0068), () => B.ball(0.0016, 0.0042, 0.0052, 1));
    B.slab(0.0255, 0.0515, -0.003, 0.027, 0.053, 0.003);
    for (const s of [-1, 1]) B.slab(0.008, 0.0515, s * 0.0128 - 0.0006, 0.0245, 0.053, s * 0.0128 + 0.0006);
  } else if (id === 'bowtie') {
    B.at(A.mul(A.t(0.021, 0.031, 0), A.ry(Math.PI / 2)), () => {
      B.col('#d02a3a').mat(MAT.PAINT);
      for (const s of [-1, 1]) B.prism([[0, 0], [s * 0.011, 0.0065], [s * 0.011, -0.0065]], 0.003);
      B.ball(0.0026);
    });
  } else if (id === 'flower') {
    B.at(A.mul(A.t(0.006, 0.054, 0.009), A.rx(-0.6)), () => {
      B.col('#f070a8').mat(MAT.PAINT);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; B.at(A.t(Math.cos(a) * 0.0055, 0, Math.sin(a) * 0.0055), () => B.ball(0.0042, 0.0016, 0.0042)); }
      B.col('#f8d840').at(A.t(0, 0.0012, 0), () => B.ball(0.0028, 0.0018, 0.0028));
    });
  } else if (id === 'pirate') {
    B.at(A.t(...HAT_AT), () => {
      B.col('#1c1c20').mat(MAT.PAINT).at(A.s(1.35, 1, 1), () => B.cyl(0.0105, 0.0022, 16));
      B.at(A.t(0, 0.0015, 0), () => B.ball(0.0078, 0.0085, 0.0078, 1));
      B.at(A.mul(A.t(0, 0.0012, 0), A.s(1.35, 1, 1)), () => { for (const s of [-1, 1]) B.at(A.mul(A.t(0, 0, s * 0.008), A.rx(s * 0.9)), () => B.slab(-0.012, 0, -0.001, 0.012, 0.009, 0.001)); });
      B.col('#f6f4ee').mat(MAT.MATTE).at(A.t(0.0072, 0.006, 0), () => B.ball(0.0018));
    });
  }
}

/** Build every slot: a body in each colour and each hat. Returns per slot { bodies: [k], hats: [k or -1] }. */
export function buildDuckParts(B, n = MAX_DUCKS) {
  return Array.from({ length: n }, () => ({
    bodies: COLOURS.map((c) => { const k = B.newPart(); B.at(A.s(DS), () => duck(B, c)); return k; }),
    hats: HATS.map((h) => { if (h.id === 'none') return -1; const k = B.newPart(); B.at(A.s(DS), () => hat(B, h.id)); return k; }),
  }));
}
/** Show a slot's duck at m (or hide the slot with m null). */
export function poseDuck(buf, slot, m, colour, hatI, setPart) {
  slot.bodies.forEach((k, i) => setPart(buf, k, m && i === colour ? m : null));
  slot.hats.forEach((k, i) => { if (k >= 0) setPart(buf, k, m && i === hatI ? m : null); });
}
