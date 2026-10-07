// Seeded 2-D value noise + fBm for the painted map, the relief and cosmetic jitter. Views may
// use cosmetic randomness, but it is seeded so captures reproduce (G0 house rules).
import { createSeededRandom } from '../utils/random.ts'

export interface Noise2 {
  (x: number, y: number): number // -1..1
  fbm(x: number, y: number, oct?: number): number // about -1..1
}

export function createNoise(seed: number): Noise2 {
  const rnd = createSeededRandom(seed)
  const N = 256
  const perm = new Uint8Array(N * 2)
  const val = new Float32Array(N)
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = rnd() * 2 - 1 }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i]
  const at = (ix: number, iy: number): number => val[perm[(perm[ix & 255] + iy) & 511]]
  const n = ((x: number, y: number): number => {
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const fx = x - x0, fy = y - y0
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }) as Noise2
  n.fbm = (x, y, oct = 4) => {
    let s = 0, amp = 0.5, f = 1, norm = 0
    for (let i = 0; i < oct; i++) { s += amp * n(x * f + i * 17.3, y * f - i * 9.1); norm += amp; amp *= 0.5; f *= 2.03 }
    return s / norm
  }
  return n
}

// Integer hash -> [0,1), for per-hex deterministic choices (crater layout, building variant).
export function hash01(a: number, b = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
