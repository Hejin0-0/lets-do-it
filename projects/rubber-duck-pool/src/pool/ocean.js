// The open sea round the cliff, as waves: a wind sea and a long swell (a JONSWAP spectrum each, spread about its
// direction), cut into four cascades of 256² Fourier amplitudes, from the swell's patch down to ripples
// (ocean-gpu.js turns them into the surface every frame). A unit of the scene is M metres, so the waves keep the
// sizes and speeds of real ones under a cliff of about 25 m. The same sea every time: it has its own seed.
// oceanAt() follows the biggest waves on the CPU, for a duck that has flown out to sea.
import { P } from './layout.js';

const G = 9.81, TAU = Math.PI * 2;
export const OCEAN = {
  M: 20,                                              // metres in a unit
  N: 256,                                             // each cascade's grid
  L: [60, 8, 1.1, 0.15],                              // each cascade's patch, in units: from the swell down to ripples
  wind: { U: 8, dir: 2.0, fetch: 150e3, gamma: 3.3 }, // m/s; the way the waves run (radians from +x toward +z); m
  swell: { hs: 0.8, T: 10, dir: 1.35, s: 20 },        // m; s; radians; how narrowly it runs
  chop: 0.9,                                          // how far the crests lean over (the sideways displacement)
  seed: 2024,
  probe: 320,                                         // how many of the biggest waves oceanAt() follows
};

// ln Γ(x) for x > 0 (Lanczos, g = 7)
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(TAU) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
/** cos^2s(θ/2) spreading about a direction, normalised over the circle. */
const spread = (th, s) => Math.pow(Math.abs(Math.cos(th / 2)), 2 * s) * Math.exp(lgamma(s + 1) - lgamma(s + 0.5)) / (2 * Math.sqrt(Math.PI));
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
/** The JONSWAP shape (energy per rad/s, m² s) with Phillips constant alpha, peak wp, peak enhancement gamma. */
function jonswap(w, wp, alpha, gamma) {
  const sig = w <= wp ? 0.07 : 0.09, r = Math.exp(-((w - wp) ** 2) / (2 * sig * sig * wp * wp));
  return (alpha * G * G) / w ** 5 * Math.exp(-1.25 * (wp / w) ** 4) * gamma ** r;
}
// the swell's Phillips constant, so that its height comes out at hs (the variance of the sea is hs² / 16)
const SWELL_ALPHA = (() => {
  const wp = TAU / OCEAN.swell.T;
  let sum = 0;
  for (let i = 0; i < 4000; i++) { const w = wp * (0.3 + (5.7 * (i + 0.5)) / 4000); sum += jonswap(w, wp, 1, 6) * (5.7 * wp) / 4000; }
  return (OCEAN.swell.hs ** 2 / 16) / sum;
})();

/** Energy per (rad/m)² at the wave vector (kx, kz) in rad/m: the wind sea and the swell. */
function energy(kx, kz) {
  const k = Math.hypot(kx, kz), w = Math.sqrt(G * k), th = Math.atan2(kz, kx);
  const { U, dir, fetch, gamma } = OCEAN.wind;
  const alpha = 0.076 * Math.pow((U * U) / (fetch * G), 0.22), wp = 22 * Math.pow((G * G) / (U * fetch), 1 / 3);
  const sp = 11.5 * Math.pow((wp * U) / G, -2.5), s = sp * Math.pow(w / wp, w <= wp ? 5 : -2.5);
  let S = jonswap(w, wp, alpha, gamma) * spread(wrap(th - dir), Math.max(s, 0.05));
  const sw = OCEAN.swell;
  S += SWELL_ALPHA * jonswap(w, TAU / sw.T, 1, 6) * spread(wrap(th - sw.dir), sw.s);
  return (S * (G / (2 * w))) / k * Math.exp(-((k * 0.01) ** 2));   // per (ω, θ) to per (kx, kz): dω/dk / k; the shortest damped
}

let memo = null;
/**
 * The sea's spectrum. h0: per cascade c, row z, column x a vec4 (h0(k), h0(-k) as re, im), in units, the wave vector of
 * column x being 2π n / L with n = x, or x - N past N / 2; variance: the slopes' variance along x and z (all the
 * cascades); waves: the biggest, as [kx, kz (rad/unit), ω (rad/s), amplitude (units), phase]; hs: the significant height (m).
 */
export function oceanSpectrum() {
  if (memo) return memo;
  const { N, L, M } = OCEAN, C = L.length, rand = P.rng(OCEAN.seed);
  const gauss = () => { const u = Math.max(rand(), 1e-12), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  const kLo = L.map((l, c) => (c ? 4 : 1) * (TAU / (l * M))), kHi = L.map((l, c) => (c + 1 < C ? kLo[c + 1] : 0.75 * (Math.PI * N) / (l * M)));
  const H = new Float32Array(C * N * N * 2);
  let vx = 0, vz = 0, h2 = 0;
  for (let c = 0; c < C; c++) {
    const dk = TAU / (L[c] * M);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const kx = (x < N / 2 ? x : x - N) * dk, kz = (y < N / 2 ? y : y - N) * dk, k = Math.hypot(kx, kz), i = 2 * ((c * N + y) * N + x);
      const gr = gauss(), gi = gauss();
      if (k < kLo[c] || k >= kHi[c]) continue;
      const a = (Math.sqrt(energy(kx, kz)) * dk) / 2 / M;
      H[i] = gr * a; H[i + 1] = gi * a;
      const m2 = 2 * (H[i] ** 2 + H[i + 1] ** 2);   // this wave's share of the variance
      h2 += m2; vx += m2 * (kx * M) ** 2; vz += m2 * (kz * M) ** 2;
    }
  }
  const h0 = new Float32Array(C * N * N * 4), mag = new Float32Array(C * N * N);
  for (let c = 0; c < C; c++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (c * N + y) * N + x, j = (c * N + ((N - y) % N)) * N + ((N - x) % N);
    h0.set([H[2 * i], H[2 * i + 1], H[2 * j], H[2 * j + 1]], 4 * i);
    mag[i] = Math.hypot(H[2 * i], H[2 * i + 1]);
  }
  const cut = Float32Array.from(mag).sort()[mag.length - OCEAN.probe];
  const waves = [];
  for (let i = 0; i < mag.length && waves.length < OCEAN.probe; i++) {
    if (mag[i] < cut || !mag[i]) continue;
    const c = Math.floor(i / (N * N)), x = i % N, y = Math.floor(i / N) % N, dk = TAU / L[c];
    const kx = (x < N / 2 ? x : x - N) * dk, kz = (y < N / 2 ? y : y - N) * dk;
    waves.push([kx, kz, Math.sqrt((G / M) * Math.hypot(kx, kz)), 2 * mag[i], Math.atan2(H[2 * i + 1], H[2 * i])]);
  }
  memo = { h0, variance: [vx, vz], waves, hs: 4 * Math.sqrt(h2) * M };
  return memo;
}

/** The sea where it is drawn at (x, z) at time t, from its biggest waves: [height, dh/dx, dh/dz] (units). */
export function oceanAt(x, z, t) {
  const { waves } = oceanSpectrum(), ch = OCEAN.chop;
  let dx = 0, dz = 0;   // the crests lean: the water drawn here started out a little way off
  for (const [kx, kz, w, a, ph] of waves) { const s = (a * Math.sin(kx * x + kz * z - w * t + ph) * ch) / Math.hypot(kx, kz); dx += kx * s; dz += kz * s; }
  const x0 = x - dx, z0 = z - dz;
  let h = 0, gx = 0, gz = 0;
  for (const [kx, kz, w, a, ph] of waves) { const th = kx * x0 + kz * z0 - w * t + ph; h += a * Math.cos(th); gx -= a * kx * Math.sin(th); gz -= a * kz * Math.sin(th); }
  return [h, gx, gz];
}
