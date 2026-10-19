// Rubber Duck Pool — the rubber ducks: twelve designs of one duck (the models in models/, cut down by npm run
// assets:ducks into public/ducks: one mesh and an albedo atlas each, drawn by the duck layer, renderer.js), and seven
// things to wear (a party hat, a top hat, a crown, sunglasses, a bow tie, a flower, a pirate's hat) and the flyer's
// propeller cap, built here as parts: every duck slot carries each, and only the chosen one is shown; the propeller's
// blades are a part of their own, to spin. The hats were made for the little hand-built duck (its units, scaled by DS);
// HEAD_FIX moves them onto the model's head.
import { A, MAT } from '@lid/diorama/parts.js';
import { DUCK_SHAPE } from './duck-shape.js';

export const DS = 3.0;   // the hats' size against Lock Jelly's little duck
export const MAX_DUCKS = 40;
/** The designs, in the order of their atlases (public/ducks/<id>.webp) and swatches (<id>-thumb.webp). */
export const DESIGNS = [
  { id: '01-classic', label: 'Classic' }, { id: '02-mint', label: 'Mint' }, { id: '03-cherry', label: 'Cherry' },
  { id: '04-daisy', label: 'Daisy' }, { id: '05-lightning', label: 'Lightning' }, { id: '06-cow', label: 'Cow' },
  { id: '07-heart', label: 'Heart' }, { id: '08-stars', label: 'Stars' }, { id: '09-tiger', label: 'Tiger' },
  { id: '10-lavender', label: 'Lavender' }, { id: '11-crown', label: 'Crown', crown: true }, { id: '12-prism', label: 'Prism' },
];
export const HATS = [
  { id: 'none', label: 'None' }, { id: 'party', label: 'Party hat' }, { id: 'tophat', label: 'Top hat' }, { id: 'crown', label: 'Crown' },
  { id: 'shades', label: 'Shades' }, { id: 'bowtie', label: 'Bow tie' }, { id: 'flower', label: 'Flower' }, { id: 'pirate', label: 'Pirate' },
  { id: 'propeller', label: 'Propeller', special: true },   // only a flyer wears it: it is what lets it fly
];
export const PROPELLER = HATS.findIndex((h) => h.id === 'propeller');
/** The ducks' names, ours: a duck's number picks one (17 steps on each time, so forty ducks never share one). */
const NAMES = ['Puddle', 'Biscuit', 'Noodle', 'Pip', 'Waddles', 'Mango', 'Clementine', 'Pickle', 'Bean', 'Dot', 'Olive', 'Sunny',
  'Ziggy', 'Marlow', 'Basil', 'Juniper', 'Pudding', 'Toffee', 'Fig', 'Nutmeg', 'Pebble', 'Hazel', 'Moss', 'Wren', 'Admiral',
  'Sprout', 'Kiwi', 'Peanut', 'Maple', 'Sorbet', 'Doodle', 'Paddle', 'Ripple', 'Squeaks', 'Barnaby', 'Tofu', 'Lemon', 'Captain',
  'Gherkin', 'Plum', 'Crumpet', 'Rosie', 'Bramble', 'Nibbles', 'Fritz', 'Saffron', 'Dumpling', 'Twig'];
export const nameOf = (id) => NAMES[(id * 17) % NAMES.length];
const PIVOT = [0.014, 0.07, 0];   // where the blades turn, above the cap (the little duck's units)
/** The duck as a floater: three spheres (body, tail, head) fitted to the model (duck-shape.js), light, so it rides high. */
export const DUCK_FLOAT = { spheres: DUCK_SHAPE.spheres, com: [0, 0.03, 0], rho: 0.32, mu: 0.35, e: 0.4 };
/** The little duck's head, where the hats were made to sit, onto the model's head: moved and grown to fit. */
const OLD_HEAD = [0.042, 0.132, 0], OLD_R = 0.0405, { centre: HEAD, r: HEAD_R } = DUCK_SHAPE.head;
const HEAD_FIX = A.mul(A.t(...HEAD), A.s(HEAD_R / OLD_R), A.t(-OLD_HEAD[0], -OLD_HEAD[1], -OLD_HEAD[2]));

// ----- the things to wear, in the little duck's units (scaled by DS); forward +x, up +y -----
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
  } else if (id === 'propeller') {   // a cap in two colours with a peak, and the stem the blades turn on
    B.at(A.t(...HAT_AT), () => {
      B.col('#e8405a').mat(MAT.PAINT).at(A.t(0, -0.001, 0), () => B.ball(0.0098, 0.0075, 0.0098));
      B.col('#f2c62a').at(A.mul(A.t(0.008, -0.0008, 0), A.s(1.3, 1, 1)), () => B.cyl(0.0055, 0.0009, 12));
      B.col('#2a8ad8').at(A.t(0, 0.006, 0), () => B.cyl(0.0012, 0.0075, 6));
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

/** Build every slot's things to wear. Returns per slot { hats: [k or -1], blades: k }. */
export function buildDuckParts(B, n = MAX_DUCKS) {
  return Array.from({ length: n }, () => ({
    hats: HATS.map((h) => { if (h.id === 'none') return -1; const k = B.newPart(); B.at(A.s(DS), () => hat(B, h.id)); return k; }),
    blades: (() => { const k = B.newPart(); B.at(A.mul(A.s(DS), A.t(...PIVOT)), () => blades(B)); return k; })(),
  }));
}
function blades(B) {
  B.col('#2a8ad8').mat(MAT.PAINT).ball(0.0022);
  for (const [s, c] of [[1, '#f2c62a'], [-1, '#3ab89a']]) B.col(c).at(A.rx(s * 0.25), () => B.slab(0, -0.0004, -0.0026, s * 0.016, 0.0004, 0.0026));
}
/** Show what a slot's duck wears, on the duck at m (or nothing with m null); spin: the propeller's turn, for a flyer. */
export function poseDuck(buf, slot, m, hatI, setPart, spin = 0) {
  const h = m && A.mul(m, HEAD_FIX);
  slot.hats.forEach((k, i) => { if (k >= 0) setPart(buf, k, h && i === hatI ? h : null); });
  const p = PIVOT.map((v) => v * DS);
  setPart(buf, slot.blades, h && hatI === PROPELLER ? A.mul(h, A.t(...p), A.ry(spin), A.t(-p[0], -p[1], -p[2])) : null);
}
