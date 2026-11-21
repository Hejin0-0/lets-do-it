// Rubber Duck Pool — the rubber ducks: twenty-four designs of one duck (twelve classic and twelve unexpected in models/,
// cut down by npm run assets:ducks into public/ducks: one shared mesh plus unexpected extras and an albedo atlas each,
// drawn by the duck layer, renderer.js), and seven things to wear (a party hat, a top hat, a crown, sunglasses, a bow
// tie, a flower, a pirate's hat) and the flyer's propeller cap, built once into a hat mesh of their own (HAT_MESH) and
// drawn instanced by the hat layer only for the ducks that wear them; the propeller's blades have their own range, to
// spin. The hats were made for the little hand-built duck (its units, scaled by DS); HEAD_FIX moves them onto the
// model's head.
import { partsBuilder, A, MAT } from '@lid/diorama/parts.js';
import { DUCK_SHAPE } from './duck-shape.js';

export const DS = 3.0;   // the hats' size against Lock Jelly's little duck
export const MAX_DUCKS = 40;
/** The designs, in the order of their atlases (public/ducks/<id>.webp) and swatches (<id>-thumb.webp). Tapped, each
 * answers in its own voice (sound.js) and throws off its own burst (fx.js: a shape, its colours, how many, how it
 * drifts: up > 0 floats, < 0 falls), hopping as high as hop. */
export const DESIGNS = [
  { id: '01-classic', label: 'Classic', voice: 'squeak', fx: { shape: 'drop', colours: ['#ffd84a', '#ffffff'], n: 14, up: -1 }, hop: 0.9 },
  { id: '02-mint', label: 'Mint', voice: 'bubbles', fx: { shape: 'bubble', colours: ['#c6f7e6', '#ffffff'], n: 12, up: 0.5 }, hop: 0.8 },
  { id: '03-cherry', label: 'Cherry', voice: 'boing', fx: { shape: 'drop', colours: ['#e8304a', '#5aa83a'], n: 12, up: -1 }, hop: 1.3 },
  { id: '04-daisy', label: 'Daisy', voice: 'trill', fx: { shape: 'petal', colours: ['#ffffff', '#ffd84a'], n: 14, up: 0.15 }, hop: 0.8 },
  { id: '05-lightning', label: 'Lightning', voice: 'zap', fx: { shape: 'bolt', colours: ['#fff35a', '#8fd8ff'], n: 10, up: 0 }, hop: 1.5 },
  { id: '06-cow', label: 'Cow', voice: 'moo', fx: { shape: 'drop', colours: ['#ffffff', '#262626'], n: 12, up: -1 }, hop: 0.5 },
  { id: '07-heart', label: 'Heart', voice: 'kiss', fx: { shape: 'heart', colours: ['#ff5c8a', '#ffa2c4'], n: 9, up: 0.45 }, hop: 0.9 },
  { id: '08-stars', label: 'Stars', voice: 'twinkle', fx: { shape: 'star', colours: ['#ffe066', '#ffffff'], n: 12, up: 0.2 }, hop: 1.0 },
  { id: '09-tiger', label: 'Tiger', voice: 'roar', fx: { shape: 'bolt', colours: ['#ff8a1e', '#1e1e1e'], n: 10, up: -0.5 }, hop: 0.7 },
  { id: '10-lavender', label: 'Lavender', voice: 'chime', fx: { shape: 'petal', colours: ['#c8a8f0', '#8a62c8'], n: 14, up: 0.1 }, hop: 0.8 },
  { id: '11-crown', label: 'Crown', crown: true, voice: 'fanfare', fx: { shape: 'star', colours: ['#ffc83a', '#fff2b0'], n: 14, up: 0.3 }, hop: 1.1 },
  { id: '12-prism', label: 'Prism', voice: 'rainbow', fx: { shape: 'drop', colours: ['#ff4a4a', '#ffa52a', '#ffe94a', '#5ad15a', '#4aa8ff', '#a45aff'], n: 18, up: 0.05 }, hop: 1.0 },
  { id: '13-teapot', label: 'Teapot', unexpected: true, voice: 'chime', fx: { shape: 'bubble', colours: ['#f6f2e8', '#e6941a', '#2b5bb8'], n: 12, up: 0.45 }, hop: 0.75 },
  { id: '14-terrarium', label: 'Terrarium', unexpected: true, voice: 'trill', fx: { shape: 'petal', colours: ['#68b830', '#ffffff', '#ffba14'], n: 14, up: 0.2 }, hop: 0.7 },
  { id: '15-citrus', label: 'Citrus', unexpected: true, voice: 'boing', fx: { shape: 'drop', colours: ['#ff7a08', '#fff0be', '#429e28'], n: 14, up: -0.9 }, hop: 1.25 },
  { id: '16-cloud', label: 'Cloud', unexpected: true, voice: 'zap', fx: { shape: 'bolt', colours: ['#ffb814', '#48a4f4', '#ffffff'], n: 12, up: -0.35 }, hop: 1.35 },
  { id: '17-bookbinder', label: 'Bookbinder', unexpected: true, voice: 'fanfare', fx: { shape: 'star', colours: ['#e89c20', '#ead6b3', '#7a1818'], n: 12, up: 0.25 }, hop: 0.85 },
  { id: '18-ramen', label: 'Ramen', unexpected: true, voice: 'squeak', fx: { shape: 'bubble', colours: ['#f4c668', '#ff5a14', '#fff5e4'], n: 13, up: 0.4 }, hop: 0.95 },
  { id: '19-moon', label: 'Moon', unexpected: true, voice: 'twinkle', fx: { shape: 'star', colours: ['#f5eee6', '#a890c8', '#e8a024'], n: 14, up: 0.35 }, hop: 1.4 },
  { id: '20-radio', label: 'Radio', unexpected: true, voice: 'roar', fx: { shape: 'bolt', colours: ['#e89c20', '#e4ca9c', '#383028'], n: 11, up: 0.1 }, hop: 1.0 },
  { id: '21-magnet', label: 'Magnet', unexpected: true, voice: 'zap', fx: { shape: 'spark', colours: ['#e01818', '#d4d8dc', '#c85018'], n: 14, up: 0.05 }, hop: 1.2 },
  { id: '22-snow-globe', label: 'Snow Globe', unexpected: true, voice: 'rainbow', fx: { shape: 'star', colours: ['#ffffff', '#a6dcff', '#286e38'], n: 15, up: -0.25 }, hop: 0.8 },
  { id: '23-mosaic', label: 'Mosaic', unexpected: true, voice: 'bubbles', fx: { shape: 'drop', colours: ['#1a4ab8', '#f0e6d2', '#48a4f4'], n: 15, up: -0.8 }, hop: 1.05 },
  { id: '24-lantern', label: 'Lantern', unexpected: true, voice: 'kiss', fx: { shape: 'bubble', colours: ['#fff2a6', '#2eaeff', '#0e2878'], n: 13, up: 0.55 }, hop: 0.9 },
];
/** Pick a design index at random from seeded R: unexpected comes 1 time in 4 (each unexpected 1/48, each classic 3/48). */
export function pickDesign(R) {
  const k = Math.floor(R() * 48);
  return k < 36 ? Math.floor(k / 3) : k - 24;
}
/** The design of a duck that arrives by itself (world.js): one not in the pools yet (here: a Set of designs), an
 * unexpected one 1 time in 4 while any is missing; null once every classic design is there, and the arrivals stop. */
export function arrivalDesign(R, here) {
  const classic = [], odd = [];
  DESIGNS.forEach((d, i) => { if (!here.has(i)) (d.unexpected ? odd : classic).push(i); });
  if (!classic.length) return null;
  const from = odd.length && R() < 0.25 ? odd : classic;
  return from[Math.floor(R() * from.length)];
}
/** Which extras a duck of design `colour` shows when wearing `hat` (0 = none): crown for 11-crown, or DUCK_SHAPE.extras[id] parts. */
export function visibleExtras(colour, hat = 0) {
  const d = DESIGNS[colour];
  if (!d) return [];
  if (d.crown) return hat ? [] : [{ name: 'DuckCrown', aboveHead: true, glass: false }];
  const ex = DUCK_SHAPE.extras?.[d.id];
  if (!ex) return [];
  return ex.parts.filter((p) => !hat || !p.aboveHead);
}
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
export const HEAD_FIX = A.mul(A.t(...HEAD), A.s(HEAD_R / OLD_R), A.t(-OLD_HEAD[0], -OLD_HEAD[1], -OLD_HEAD[2]));
const BLADE_PIVOT = PIVOT.map((v) => v * DS);

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
function blades(B) {
  B.col('#2a8ad8').mat(MAT.PAINT).ball(0.0022);
  for (const [s, c] of [[1, '#f2c62a'], [-1, '#3ab89a']]) B.col(c).at(A.rx(s * 0.25), () => B.slab(0, -0.0004, -0.0026, s * 0.016, 0.0004, 0.0026));
}

/** Build each wearable once into its own parts mesh, recording the index range { firstIndex, indexCount } of each hat
 * in HATS (none has indexCount 0) and of the propeller's blades. */
export function buildHatMesh() {
  const B = partsBuilder();
  const hatParts = HATS.map((h) => {
    if (h.id === 'none') return -1;
    const k = B.newPart();
    B.at(A.s(DS), () => hat(B, h.id));
    return k;
  });
  const bladesPart = B.newPart();
  B.at(A.mul(A.s(DS), A.t(...PIVOT)), () => blades(B));
  const mesh = B.done();
  const rangeOf = (part) => {
    if (part < 0) return { firstIndex: 0, indexCount: 0 };
    let firstIndex = -1, indexCount = 0;
    for (let i = 0; i < mesh.index.length; i++) {
      if (mesh.vert[11 * mesh.index[i] + 10] === part) {
        if (firstIndex < 0) firstIndex = i;
        indexCount++;
      }
    }
    return { firstIndex: Math.max(0, firstIndex), indexCount };
  };
  const hats = HATS.map((h, i) => ({ id: h.id, ...rangeOf(hatParts[i]) }));
  const bladesRange = { id: 'blades', ...rangeOf(bladesPart) };
  return { vert: mesh.vert, index: mesh.index, hats, blades: bladesRange };
}
export const HAT_MESH = buildHatMesh();

/** The head transform for a duck whose body transform is m, and the spun transform for its propeller blades. */
export const headTransform = (m) => A.mul(m, HEAD_FIX);
export const bladeTransform = (h, spin = 0) => A.mul(h, A.t(...BLADE_PIVOT), A.ry(spin), A.t(-BLADE_PIVOT[0], -BLADE_PIVOT[1], -BLADE_PIVOT[2]));
