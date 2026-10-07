// The sheet as sampled fields on one 512x421 grid (2.26 mm cells) shared by the painter and the
// relief: which zone each cell shows (hex zones behind a gentle domain warp, so coasts, banks and
// the front lines are hand-drawn curves, not hexagons), a cartographic elevation for contours,
// and distances to water for the engraved water-lining. Pure (no DOM, no three).
import type { Terrain } from '../contract/types.ts'
import { MAP_H, MAP_W, nearestHex } from './HexLayout.ts'
import { createNoise } from './noise.ts'
import { ZONE_LIST, zonesOf } from './zones.ts'
import type { Zone } from './zones.ts'

export const GW = 512
export const GH = 421
export const CELL = MAP_W / GW // ~2.26 mm (MAP_H / GH is within 0.1%)

export interface Fields {
  zone: Uint8Array // ZONE_LIST index per cell
  hex: Int16Array // unwarped hex per cell
  elev: Float32Array // 0..1, drives contour lines (dunes steep, polder flat)
  waterDist: Float32Array // metres to the nearest water cell (0 inside water)
  landDist: Float32Array // metres to the nearest land cell (0 on land)
  wet: Uint8Array // 1 = sea / river / flood
  dune: Float32Array // blurred dune mask 0..1
}

export const cellX = (gx: number): number => -MAP_W / 2 + (gx + 0.5) * MAP_W / GW
export const cellZ = (gy: number): number => -MAP_H / 2 + (gy + 0.5) * MAP_H / GH
export const zoneIdx = (z: Zone): number => ZONE_LIST.indexOf(z)
const WET = new Set([zoneIdx('sea'), zoneIdx('river'), zoneIdx('flood')])

export function buildFields(terrain: Terrain[], flooded: boolean, seed = 7): Fields {
  const n = createNoise(seed)
  const zones = zonesOf(terrain, flooded).map(zoneIdx)
  const N = GW * GH
  const f: Fields = {
    zone: new Uint8Array(N), hex: new Int16Array(N), elev: new Float32Array(N), waterDist: new Float32Array(N),
    landDist: new Float32Array(N), wet: new Uint8Array(N), dune: new Float32Array(N),
  }
  const duneIdx = zoneIdx('dune')
  for (let gy = 0; gy < GH; gy++) {
    const z = cellZ(gy)
    for (let gx = 0; gx < GW; gx++) {
      const x = cellX(gx), i = gy * GW + gx
      const wx = x + 0.012 * n.fbm(x * 8, z * 8, 3), wz = z + 0.012 * n.fbm(x * 8 + 31, z * 8 - 17, 3)
      const zi = zones[nearestHex(wx, wz)]
      f.zone[i] = zi
      f.hex[i] = nearestHex(x, z)
      f.wet[i] = WET.has(zi) ? 1 : 0
      f.dune[i] = zi === duneIdx ? 1 : 0
    }
  }
  blur(f.dune, 6)
  for (let i = 0; i < N; i++) {
    const x = cellX(i % GW), z = cellZ(Math.floor(i / GW))
    const d = f.dune[i]
    f.elev[i] = 0.35 + 0.18 * n.fbm(x * 2.2 + 5, z * 2.2, 3) + d * (0.35 + 0.45 * n.fbm(x * 9, z * 9, 4))
  }
  distance(f.wet, 1, f.waterDist)
  distance(f.wet, 0, f.landDist)
  return f
}

// Separable box blur, radius r cells, three passes ~ gaussian.
export function blur(a: Float32Array, r: number, w = GW, h = GH): void {
  const tmp = new Float32Array(a.length)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let s = 0
      for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = s / (2 * r + 1)
        s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s / (2 * r + 1)
        s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
      }
    }
  }
}

// Two-pass chamfer distance (metres) to the nearest cell where mask == v.
function distance(mask: Uint8Array, v: number, out: Float32Array): void {
  const BIG = 1e9, d1 = CELL, d2 = CELL * Math.SQRT2
  for (let i = 0; i < out.length; i++) out[i] = mask[i] === v ? 0 : BIG
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x
    let d = out[i]
    if (x > 0) d = Math.min(d, out[i - 1] + d1)
    if (y > 0) {
      d = Math.min(d, out[i - GW] + d1)
      if (x > 0) d = Math.min(d, out[i - GW - 1] + d2)
      if (x < GW - 1) d = Math.min(d, out[i - GW + 1] + d2)
    }
    out[i] = d
  }
  for (let y = GH - 1; y >= 0; y--) for (let x = GW - 1; x >= 0; x--) {
    const i = y * GW + x
    let d = out[i]
    if (x < GW - 1) d = Math.min(d, out[i + 1] + d1)
    if (y < GH - 1) {
      d = Math.min(d, out[i + GW] + d1)
      if (x < GW - 1) d = Math.min(d, out[i + GW + 1] + d2)
      if (x > 0) d = Math.min(d, out[i + GW - 1] + d2)
    }
    out[i] = d
  }
}

// Bilinear sample of a field at board-local (x, z).
export function sampleField(a: Float32Array, x: number, z: number): number {
  const fx = Math.max(0, Math.min(GW - 1.001, (x + MAP_W / 2) / MAP_W * GW - 0.5))
  const fy = Math.max(0, Math.min(GH - 1.001, (z + MAP_H / 2) / MAP_H * GH - 0.5))
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
  const i = y0 * GW + x0
  return (a[i] * (1 - tx) + a[i + 1] * tx) * (1 - ty) + (a[i + GW] * (1 - tx) + a[i + GW + 1] * tx) * ty
}
