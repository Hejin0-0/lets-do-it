import { createSliceKernel } from '../../core/cut/kernel.js';

// ---------------------------------------------------------------------------
// The four jellies: slab outlines (2D signed distance in the rest plane, x right, z toward the viewer),
// thickness, bevel, and the numbers the press and the shaders need.
// ---------------------------------------------------------------------------
export const FRUITS = (() => {
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  // A half-disc lying flat, its cut edge toward the viewer (+z): the rind arc behind. zc puts the centroid at 0.
  const halfDisc = (R, round) => {
    const zc = (4 * R) / (3 * Math.PI);
    return { zc, R, sdf: (x, z) => { const a = Math.hypot(x, z - zc) - (R - round), b = z - zc + round; return Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(Math.max(a, b), 0) - round; } };
  };
  const melon = halfDisc(1.02, 0.08), orange = halfDisc(0.96, 0.08);
  // Fig half: a teardrop, the broad end toward the viewer, the stem end behind.
  const fig = { sdf: (x, z) => smin(Math.hypot(x, z - 0.22) - 0.74, Math.hypot(x, z + 0.68) - 0.3, 0.55) };
  // Pineapple ring.
  const ring = { R: 1.0, r: 0.3, sdf: (x, z) => { const q = Math.hypot(x, z); return Math.max(q - 1.0, 0.3 - q); } };
  return [
    { id: 0, key: 'melon', name: 'Watermelon', T: 0.42, bevel: 0.09, sdf: melon.sdf, shape: [melon.R, melon.zc, 0.05, 0.09], verdict: 'Splat.', barPerLoad: 0.33 },
    { id: 1, key: 'orange', name: 'Orange', T: 0.36, bevel: 0.08, sdf: orange.sdf, shape: [orange.R, orange.zc, 0.06, 0.09], verdict: 'Squeezed.', barPerLoad: 0.48 },
    { id: 2, key: 'fig', name: 'Fig', T: 0.44, bevel: 0.1, sdf: fig.sdf, shape: [0, 0, 0.045, 0.08], verdict: "Well, that's jam.", barPerLoad: 0.19 },
    { id: 3, key: 'pineapple', name: 'Pineapple', T: 0.38, bevel: 0.08, sdf: ring.sdf, shape: [ring.R, ring.r, 0, 0], verdict: 'Crushed.', barPerLoad: 0.28 },
  ];
})();

// How each jelly looks. pal: skin light, skin dark, the pale layer under the skin, inclusions (seeds,
// membranes, fibres); prm[0] = the fruit's shape, prm[1] = (thickness, fruit id, -, -).
const LOOKS = [
  { absorb: [1.1, 8.0, 6.6], scatter: [0.92, 0.05, 0.07], palette: ['#5d8c34', '#163b12', '#e7ebca', '#21150e'] },   // watermelon
  { absorb: [0.32, 2.0, 7.2], scatter: [1.0, 0.48, 0.07], palette: ['#ea842c', '#d2601a', '#f4e9d0', '#f8ead2'] },    // orange
  { absorb: [0.45, 4.6, 2.4], scatter: [1.0, 0.3, 0.42], palette: ['#5a2449', '#2b0f25', '#efe0c4', '#d9a83a'] },     // fig
  { absorb: [0.26, 1.3, 5.6], scatter: [1.0, 0.66, 0.12], palette: ['#c98a1e', '#a86a10', '#fbefc4', '#fff3c0'] },    // pineapple
];
export const looks = FRUITS.map((F) => ({ ...LOOKS[F.id], density: 1, prm: [F.shape, [F.T, F.id, 0, 0]] }));

/** A fruit's slab on the shared slice kernel: rounded like the slice everywhere, a few tiny bubbles. */
export function fruitGeo(F) {
  const K = createSliceKernel({
    T: F.T, BEVEL: F.bevel, ROUND: 0.08, MIN_AREA: 0.02, FILLET_RINGS: 6, NEAR: Infinity, KERF: 0.01, sliceSdf: F.sdf,
    GRID: Object.freeze({ h: 0.025, X0: -1.2, Z0: -1.2, NX: 96, NZ: 96, N: 96 * 96 }),
    inclusions: (field) => ({ bubbles: pickBubbles(field) }),
  });
  const BUBBLES = (() => {
    const rnd = K.mulberry32(0xB0BB1E), out = [];
    for (let tries = 0; out.length < 4 * 10 && tries < 6000; tries++) {
      const x = (rnd() - 0.5) * 2.2, z = (rnd() - 0.5) * 2.2, y = 0.09 + (F.T - 0.18) * rnd(), rad = 0.006 + 0.01 * rnd() * rnd();
      if (F.sdf(x, z) < -(rad + 0.14)) out.push(x, y, z, rad);
    }
    return Float32Array.from(out);
  })();
  function pickBubbles(field) {
    const out = [];
    for (let i = 0; i < BUBBLES.length; i += 4)
      if (K.sample(field, BUBBLES[i], BUBBLES[i + 2]) < -(BUBBLES[i + 3] + 0.03)) out.push(BUBBLES[i], BUBBLES[i + 1], BUBBLES[i + 2], BUBBLES[i + 3]);
    return Float32Array.from(out);
  }
  return K;
}
