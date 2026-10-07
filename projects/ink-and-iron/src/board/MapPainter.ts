// The painted sheet (DESIGN §9 "Paint"): a 2048x1684 watercolour-and-ink map exactly covering
// the 1.155 x 0.95 m hex grid, plus separate roughness and bump canvases (1024x842, their own
// noise, never derived from the colour). Zones follow the L* plan in zones.ts; line features
// come from features.ts so the relief and the kit sit exactly on the paint.
import { COLS } from '../contract/types.ts'
import type { HexId, ScenarioId, Terrain } from '../contract/types.ts'
import { hexCorners, hexX, hexZ, MAP_H, MAP_W, N_HEX, R, rowOf, colOf, hexId } from './HexLayout.ts'
import { cratersOf, isBuilding, trenchLines, TRENCH, wirePath } from './features.ts'
import type { P2 } from './features.ts'
import { blur, cellX, cellZ, GH, GW } from './fields.ts'
import type { Fields } from './fields.ts'
import { createNoise, hash01 } from './noise.ts'
import { LAB, labToRgb, ZONE_LIST } from './zones.ts'

export const TEX_W = 2048
export const TEX_H = 1684
const S = TEX_W / MAP_W // canvas px per metre (x); TEX_H / MAP_H agrees to 0.05%
const SY = TEX_H / MAP_H
export const toPx = (x: number, z: number): P2 => [(x + MAP_W / 2) * S, (z + MAP_H / 2) * SY]

const rgb = (k: keyof typeof LAB): [number, number, number] => labToRgb(...LAB[k])
const css = (c: [number, number, number], a = 1): string =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`
const INK = css(rgb('ink'))
const SEPIA = 'rgba(92,60,34,0.9)'
const SERIF = 'Georgia, "Times New Roman", Times, serif'

export interface PaintInput {
  terrain: Terrain[]
  wire: boolean[]
  objectives: { hex: HexId; name: string }[]
  flooded: boolean
  fields: Fields
  // 3D plants standing on the sheet (Flora.planFlora): no printed canopy is painted under them, or
  // the map would show every tree twice (the model and its own map symbol beside it).
  plants?: { x: number; z: number; r: number }[]
  scenario?: ScenarioId // the battle, for its history pencilled on the sheet (history())
}

export interface Sheet {
  color: HTMLCanvasElement
  rough: HTMLCanvasElement
  bump: HTMLCanvasElement
  stampCrater(h: HexId): void
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d', { willReadFrequently: false })
  if (!g) throw new Error('2d canvas unavailable')
  return [c, g]
}

export function paintSheet(p: PaintInput): Sheet {
  const t0 = performance.now()
  const [color, g] = canvas(TEX_W, TEX_H)
  const [rough, gr] = canvas(TEX_W / 2, TEX_H / 2)
  const [bump, gb] = canvas(TEX_W / 2, TEX_H / 2)
  const f = p.fields
  basePass(g, f)
  roughBumpPass(gr, gb, f)
  symbols(g, p)
  for (const h of hexesOf(p.terrain, 'crater')) paintCrater(g, gr, gb, h)
  roads(g, p)
  trenches(g, gr, p.terrain)
  buildingsGround(g, p.terrain)
  wireGround(g, p)
  objectives(g, p.objectives)
  hexGrid(g, gr, gb)
  labels(g, p)
  history(g, p)
  neatline(g)
  console.info(`[board] sheet painted in ${Math.round(performance.now() - t0)} ms`)
  return {
    color, rough, bump,
    stampCrater(h) { paintCrater(g, gr, gb, h); hexGridAround(g, h) },
  }
}

const hexesOf = (t: Terrain[], k: Terrain): HexId[] => t.flatMap((v, h) => (v === k ? [h] : []))

// ---------------------------------------------------------------------------------------------
// Per-pixel watercolour: zone colour (bilinear from the 512 grid, so edges are soft washes),
// pigment pooling along zone borders, low-frequency mottling, paper grain, contours and the
// engraved water-lining of the sea and river beds.
function basePass(g: CanvasRenderingContext2D, f: Fields): void {
  const n = createNoise(11)
  const N = GW * GH
  const zc = ZONE_LIST.map((z) => rgb(z))
  const bed = rgb('sea'), bedR = rgb('river')
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N)
  const edge = new Float32Array(N)
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, z = f.zone[i]
    let e = 0
    if (x > 0 && f.zone[i - 1] !== z) e = 1
    if (x < GW - 1 && f.zone[i + 1] !== z) e = 1
    if (y > 0 && f.zone[i - GW] !== z) e = 1
    if (y < GH - 1 && f.zone[i + GW] !== z) e = 1
    edge[i] = e
  }
  blur(edge, 2)
  const seaI = ZONE_LIST.indexOf('sea')
  const nmlI = ZONE_LIST.indexOf('nml'), fieldsI = [ZONE_LIST.indexOf('deRear'), ZONE_LIST.indexOf('brRear')]
  // No-man's-land is churned mud and dry clay, not one orange field; the rear zones are a
  // patchwork of fields (outside reviews: "one uniform orange noise field", "flat palette").
  const MUD: [number, number, number] = [0.44, 0.35, 0.25]
  const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  for (let i = 0; i < N; i++) {
    const x = cellX(i % GW), z = cellZ(Math.floor(i / GW))
    let c = zc[f.zone[i]]
    if (f.zone[i] === nmlI) {
      const m = n.fbm(x * 3.4 + 9, z * 3.4 - 4, 3)
      c = lerp3(c, MUD, Math.max(0, Math.min(1, (m + 0.15) * 1.4)) * 0.6)
    } else if (fieldsI.includes(f.zone[i])) {
      // fields: a soft cellular patchwork of lighter and darker plots
      const p = Math.sin(x * 23 + n(x * 4, z * 4) * 2.2) * Math.sin(z * 19 + n(x * 4 + 7, z * 4) * 2.2)
      const k = 1 + 0.06 * Math.sign(p) * Math.min(1, Math.abs(p) * 3)
      c = [c[0] * k, c[1] * k, c[2] * k]
    }
    if (f.wet[i]) {
      // the bed darkens with depth under the resin water
      const deep = Math.min(1, f.landDist[i] / 0.03)
      const b = f.zone[i] === seaI ? bed : bedR
      c = [b[0] * (1 - 0.35 * deep), b[1] * (1 - 0.3 * deep), b[2] * (1 - 0.22 * deep)]
    }
    const mott = 1 + 0.075 * n.fbm(x * 6, z * 6, 3) + 0.035 * n(x * 31, z * 31)
    const pool = 1 - 0.2 * Math.min(1, edge[i] * 2.2)
    const k = mott * pool
    cr[i] = c[0] * k; cg[i] = c[1] * k; cb[i] = c[2] * k
  }
  // contour gradient per cell (for constant-width lines)
  const grad = new Float32Array(N)
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
    const i = y * GW + x
    grad[i] = Math.hypot(f.elev[i + 1] - f.elev[i - 1], f.elev[i + GW] - f.elev[i - GW]) * 0.5
  }
  const grain = new Float32Array(256 * 256)
  const gn = createNoise(5)
  for (let i = 0; i < grain.length; i++) grain[i] = gn((i & 255) * 0.9, (i >> 8) * 0.9) * 0.6 + gn((i & 255) * 0.23, (i >> 8) * 0.23) * 0.4

  const img = g.createImageData(TEX_W, TEX_H)
  const d = img.data
  const sx = GW / TEX_W, sy = GH / TEX_H
  const LEVELS = 16
  const cont = [0.42, 0.29, 0.16]
  for (let py = 0; py < TEX_H; py++) {
    const fy = Math.max(0, Math.min(GH - 1.001, (py + 0.5) * sy - 0.5))
    const y0 = Math.floor(fy), ty = fy - y0
    for (let px = 0; px < TEX_W; px++) {
      const fx = Math.max(0, Math.min(GW - 1.001, (px + 0.5) * sx - 0.5))
      const x0 = Math.floor(fx), tx = fx - x0
      const i = y0 * GW + x0
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty
      let r = cr[i] * w00 + cr[i + 1] * w10 + cr[i + GW] * w01 + cr[i + GW + 1] * w11
      let gg = cg[i] * w00 + cg[i + 1] * w10 + cg[i + GW] * w01 + cg[i + GW + 1] * w11
      let b = cb[i] * w00 + cb[i + 1] * w10 + cb[i + GW] * w01 + cb[i + GW + 1] * w11
      const gi = ((py & 255) << 8) | (px & 255)
      const k = 1 + 0.05 * grain[gi]
      r *= k; gg *= k; b *= k
      const wet = f.wet[i]
      if (!wet) {
        const e = f.elev[i] * w00 + f.elev[i + 1] * w10 + f.elev[i + GW] * w01 + f.elev[i + GW + 1] * w11
        const gr = grad[i] * LEVELS / (sx * 1) + 1e-5 // level change per canvas px
        const v = e * LEVELS
        const dist = Math.abs(v - Math.round(v)) / gr // px to the nearest contour
        const major = Math.round(v) % 4 === 0
        const w = major ? 1.5 : 0.95
        const a = Math.max(0, 1 - dist / w) * (major ? 0.55 : 0.34)
        if (a > 0) { r += (cont[0] - r) * a; gg += (cont[1] - gg) * a; b += (cont[2] - b) * a }
      } else {
        // water-lining: lines parallel to the bank, tightest near the shore
        const ld = f.landDist[i]
        if (ld < 0.032) {
          const v = Math.sqrt(ld / 0.032) * 7
          const dist = Math.abs(v - Math.round(v)) * 14
          const a = Math.max(0, 1 - dist / 1.1) * 0.4 * (1 - ld / 0.032)
          if (a > 0) { r += (0.93 - r) * a; gg += (0.95 - gg) * a; b += (0.9 - b) * a }
        }
      }
      const o = (py * TEX_W + px) * 4
      d[o] = r * 255; d[o + 1] = gg * 255; d[o + 2] = b * 255; d[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
}

function roughBumpPass(gr: CanvasRenderingContext2D, gb: CanvasRenderingContext2D, f: Fields): void {
  const W = TEX_W / 2, H = TEX_H / 2
  const n = createNoise(23), m = createNoise(29)
  const rough: Record<string, number> = { sea: 0.45, river: 0.45, flood: 0.45, polder: 0.7, deRear: 0.83, nml: 0.9, brRear: 0.8, dune: 0.88 }
  const ri = new Img(gr, W, H), bi = new Img(gb, W, H)
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const gx = Math.min(GW - 1, Math.floor(px * GW / W)), gy = Math.min(GH - 1, Math.floor(py * GH / H))
    const zi = f.zone[gy * GW + gx]
    const x = px / W * MAP_W, z = py / H * MAP_H
    const rv = rough[ZONE_LIST[zi]] + 0.07 * n.fbm(x * 40, z * 40, 3)
    ri.set(px, py, rv)
    // paper tooth + horizontal brush drag (anisotropic) + fine grain
    const bv = 0.5 + 0.22 * m(x * 900, z * 900) + 0.14 * n(x * 25, z * 260) + 0.1 * m.fbm(x * 160, z * 160, 2)
    bi.set(px, py, bv)
  }
  ri.put(); bi.put()
}

class Img {
  private readonly d: ImageData
  private readonly g: CanvasRenderingContext2D
  private readonly w: number
  constructor(g: CanvasRenderingContext2D, w: number, h: number) { this.g = g; this.w = w; this.d = g.createImageData(w, h) }
  set(x: number, y: number, v: number): void {
    const o = (y * this.w + x) * 4, c = Math.max(0, Math.min(255, v * 255))
    this.d.data[o] = c; this.d.data[o + 1] = c; this.d.data[o + 2] = c; this.d.data[o + 3] = 255
  }
  put(): void { this.g.putImageData(this.d, 0, 0) }
}

// ---------------------------------------------------------------------------------------------
// Cartographic symbols per zone: dune stipple and marram, polder ditches and marsh tufts,
// shell-pocked no-man's-land, orchards behind the German line, hedged fields behind the British.
function symbols(g: CanvasRenderingContext2D, p: PaintInput): void {
  const f = p.fields
  const zAt = (x: number, z: number): string => {
    const gx = Math.floor((x + MAP_W / 2) / MAP_W * GW), gy = Math.floor((z + MAP_H / 2) / MAP_H * GH)
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return ''
    return ZONE_LIST[f.zone[gy * GW + gx]]
  }
  const busy = (x: number, z: number): boolean => {
    const h = hexIdAt(x, z)
    return h !== null && (isBuilding(p.terrain[h]) || p.terrain[h] === 'trench')
  }
  let seed = 1
  const rnd = (): number => hash01(seed++, 77)
  const under = plantMask(p.plants ?? [])
  g.lineCap = 'round'
  // scatter on a jittered lattice
  for (let gy = 0; gy < 150; gy++) for (let gx = 0; gx < 182; gx++) {
    const x = -MAP_W / 2 + (gx + 0.2 + rnd() * 0.6) * MAP_W / 182
    const z = -MAP_H / 2 + (gy + 0.2 + rnd() * 0.6) * MAP_H / 150
    const zone = zAt(x, z)
    const [px, py] = toPx(x, z)
    const r = rnd()
    if (zone === 'dune') {
      g.fillStyle = 'rgba(120,96,58,0.45)'
      g.beginPath(); g.arc(px, py, 1.2 + r * 1.3, 0, 7); g.fill()
      if (r > 0.8) tuft(g, px, py, 'rgba(96,104,60,0.8)', 7)
    } else if (zone === 'polder') {
      if (r > 0.55 && !busy(x, z)) tuft(g, px, py, 'rgba(24,48,30,0.85)', 9)
    } else if (zone === 'nml') {
      if (r > 0.72 && !busy(x, z)) {
        const rr = 2.5 + rnd() * 4
        g.strokeStyle = 'rgba(62,40,20,0.55)'; g.lineWidth = 1.4
        g.beginPath(); g.arc(px, py, rr, 0, 7); g.stroke()
        g.fillStyle = 'rgba(40,26,14,0.35)'; g.beginPath(); g.arc(px + rr * 0.2, py + rr * 0.2, rr * 0.55, 0, 7); g.fill()
      } else if (r < 0.12) {
        g.strokeStyle = 'rgba(60,40,22,0.5)'; g.lineWidth = 1.2
        const a = rnd() * 6.3
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * 7, py + Math.sin(a) * 7); g.stroke()
      }
    } else if (zone === 'deRear') {
      // the size is drawn even when the dot is dropped, so the rest of the scatter never shifts
      if (r > 0.9 && !busy(x, z)) { const s = 7 + rnd() * 3; if (!under(x, z)) tree(g, px, py, 'rgba(46,70,58,0.9)', s) }
    } else if (zone === 'brRear') {
      if (r > 0.93 && !busy(x, z)) { const s = 7 + rnd() * 3; if (!under(x, z)) tree(g, px, py, 'rgba(84,98,46,0.9)', s) }
    }
  }
  // polder drainage ditches: ruled lines per polder hex, alternating direction
  g.strokeStyle = 'rgba(28,62,70,0.7)'; g.lineWidth = 1.6
  for (let h = 0; h < N_HEX; h++) {
    if (p.terrain[h] !== 'polder') continue
    const [cx, cy] = toPx(hexX(h), hexZ(h))
    const horiz = hash01(h, 9) > 0.5
    g.save(); clipHex(g, h, 0.97)
    for (let k = -3; k <= 3; k++) {
      g.beginPath()
      if (horiz) { g.moveTo(cx - 110, cy + k * 26); g.lineTo(cx + 110, cy + k * 26 + 4) }
      else { g.moveTo(cx + k * 26, cy - 110); g.lineTo(cx + k * 26 + 4, cy + 110) }
      g.stroke()
    }
    g.restore()
  }
}

// Which sheet points lie under (or within 4 mm of) a 3D plant: a 4 mm occupancy grid.
function plantMask(plants: { x: number; z: number; r: number }[]): (x: number, z: number) => boolean {
  const C = 0.004, W = Math.ceil(MAP_W / C), H = Math.ceil(MAP_H / C), m = new Uint8Array(W * H)
  for (const q of plants) {
    const rr = q.r + 0.004
    for (let j = Math.floor((q.z - rr + MAP_H / 2) / C); j <= Math.floor((q.z + rr + MAP_H / 2) / C); j++) {
      for (let i = Math.floor((q.x - rr + MAP_W / 2) / C); i <= Math.floor((q.x + rr + MAP_W / 2) / C); i++) {
        if (i >= 0 && j >= 0 && i < W && j < H) m[j * W + i] = 1
      }
    }
  }
  return (x, z) => {
    const i = Math.floor((x + MAP_W / 2) / C), j = Math.floor((z + MAP_H / 2) / C)
    return i >= 0 && j >= 0 && i < W && j < H && m[j * W + i] === 1
  }
}

function tuft(g: CanvasRenderingContext2D, x: number, y: number, c: string, s: number): void {
  g.strokeStyle = c; g.lineWidth = 1.3
  g.beginPath()
  for (const a of [-0.5, 0, 0.5]) { g.moveTo(x, y); g.lineTo(x + Math.sin(a) * s * 0.6, y - Math.cos(a) * s) }
  g.moveTo(x - s * 0.5, y); g.lineTo(x + s * 0.5, y)
  g.stroke()
}

function tree(g: CanvasRenderingContext2D, x: number, y: number, c: string, r: number): void {
  g.fillStyle = 'rgba(20,24,20,0.3)'; g.beginPath(); g.arc(x + r * 0.35, y + r * 0.35, r, 0, 7); g.fill()
  g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
  g.strokeStyle = 'rgba(20,26,22,0.8)'; g.lineWidth = 1.2; g.stroke()
}

function hexIdAt(x: number, z: number): HexId | null {
  // local import-free copy of the rounding, via the painter's own grid sampling
  let best: HexId | null = null, bd = Infinity
  const c0 = Math.round((x + MAP_W / 2 - R) / (1.5 * R))
  for (let c = c0 - 1; c <= c0 + 1; c++) for (let r = 0; r < 9; r++) {
    const h = hexId(c, r)
    if (h === null) continue
    const d = Math.hypot(hexX(h) - x, hexZ(h) - z)
    if (d < bd) { bd = d; best = h }
  }
  return bd < R ? best : null
}

function clipHex(g: CanvasRenderingContext2D, h: HexId, s: number): void {
  g.beginPath()
  hexCorners(h, s).forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py) })
  g.closePath(); g.clip()
}

// ---------------------------------------------------------------------------------------------
function paintCrater(g: CanvasRenderingContext2D, gr: CanvasRenderingContext2D, gb: CanvasRenderingContext2D, h: HexId): void {
  const spoil = rgb('spoil'), bowl = rgb('bowl')
  for (const c of cratersOf(h)) {
    const [px, py] = toPx(c.x, c.z), r = c.r * S
    // thrown-out spoil, ragged
    g.fillStyle = css(spoil, 0.55)
    g.beginPath()
    for (let i = 0; i <= 18; i++) {
      const a = i / 18 * Math.PI * 2, rr = r * (1.45 + 0.35 * hash01(h * 31 + i, Math.round(c.r * 1e4)))
      const x = px + Math.cos(a) * rr, y = py + Math.sin(a) * rr
      if (i) g.lineTo(x, y); else g.moveTo(x, y)
    }
    g.fill()
    // rays
    g.strokeStyle = css(spoil, 0.5); g.lineWidth = 2
    for (let i = 0; i < 9; i++) {
      const a = hash01(h, 40 + i) * 6.3, l = r * (1.6 + hash01(h, 60 + i) * 0.9)
      g.beginPath(); g.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke()
    }
    const grd = g.createRadialGradient(px - r * 0.15, py - r * 0.2, r * 0.1, px, py, r)
    grd.addColorStop(0, css(bowl.map((v) => v * 0.7) as [number, number, number]))
    grd.addColorStop(0.75, css(bowl))
    grd.addColorStop(1, css(bowl.map((v) => v * 1.35) as [number, number, number]))
    g.fillStyle = grd
    g.beginPath(); g.arc(px, py, r, 0, 7); g.fill()
    g.strokeStyle = 'rgba(30,20,12,0.85)'; g.lineWidth = 2.2; g.stroke()
    const [rx, ry] = [px / 2, py / 2]
    gr.fillStyle = 'rgb(110,110,110)'; gr.beginPath(); gr.arc(rx, ry, r / 2, 0, 7); gr.fill()
    gb.fillStyle = 'rgba(40,40,40,0.5)'; gb.beginPath(); gb.arc(rx, ry, r / 2 * 0.8, 0, 7); gb.fill()
  }
}

function trenches(g: CanvasRenderingContext2D, gr: CanvasRenderingContext2D, terrain: Terrain[]): void {
  const spoil = rgb('spoil'), floor = rgb('floor')
  g.lineJoin = 'round'; g.lineCap = 'round'
  for (const line of trenchLines(terrain)) {
    const path = (ctx: CanvasRenderingContext2D, k: number): void => {
      ctx.beginPath()
      line.pts.forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) ctx.lineTo(px * k, py * k); else ctx.moveTo(px * k, py * k) })
    }
    // spoil apron, with a ragged darker outer edge
    path(g, 1); g.strokeStyle = 'rgba(70,52,34,0.35)'; g.lineWidth = TRENCH.outer * 2 * S + 6; g.stroke()
    path(g, 1); g.strokeStyle = css(spoil); g.lineWidth = TRENCH.outer * 2 * S; g.stroke()
    path(g, 1); g.strokeStyle = css(spoil.map((v) => v * 0.9) as [number, number, number]); g.lineWidth = TRENCH.parapet * 2 * S; g.stroke()
    // revetment walls then the floor — painted down into its own shade: a 17 mm cut lit like the
    // ground read as a stripe, not a trench (blind A/B: "a flat tabletop; give the trenches depth")
    path(g, 1); g.strokeStyle = 'rgb(70,52,34)'; g.lineWidth = TRENCH.wall * 2 * S; g.stroke()
    path(g, 1); g.strokeStyle = css(floor.map((v) => v * 0.5) as [number, number, number]); g.lineWidth = TRENCH.half * 2 * S; g.stroke()
    path(g, 1); g.strokeStyle = 'rgba(20,14,9,0.55)'; g.lineWidth = TRENCH.half * S; g.stroke()
    path(gr, 0.5); gr.strokeStyle = 'rgb(120,120,120)'; gr.lineWidth = TRENCH.wall * S; gr.stroke()
  }
}

// Cased period roads: a lateral road behind each front (straight-ish at a fixed latitude, a slow
// seeded wobble, never the hex zig-zag) and a spur across every bridge / the sluice.
function roads(g: CanvasRenderingContext2D, p: PaintInput): void {
  g.lineJoin = 'round'; g.lineCap = 'round'
  for (const l of roadLines(p.terrain)) {
    const path = (): void => {
      g.beginPath()
      l.forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py) })
    }
    path(); g.strokeStyle = 'rgba(64,44,28,0.85)'; g.lineWidth = 11; g.stroke()
    path(); g.strokeStyle = 'rgb(222,200,150)'; g.lineWidth = 6.5; g.stroke()
  }
}

// The roads' centrelines, each through its hex waypoints smoothed as quadratic curves between the
// midpoints and sampled densely. Pure and shared: the flora (Flora.ts) lines its poplars along the
// very curve the painter inks, and keeps every plant off it.
// The narrow-gauge light railway (a Decauville line) feeding Nieuwpoort from the east, a hand's
// breadth south of the British rear road. Shared by the kit (ballast, sleepers, rails) and the flora
// (which keeps its poplars off it); null on a map without Nieuwpoort.
export function railLine(t: Terrain[]): P2[] | null {
  const town = t.findIndex((v, h) => v === 'ruin' && rowOf(h) > 4)
  if (town < 0) return null
  const meanZ = (l: P2[]): number => l.reduce((s, p) => s + p[1], 0) / l.length
  const road = roadLines(t).filter((l) => l.length > 8).sort((a, b) => meanZ(b) - meanZ(a))[0]
  if (!road) return null
  const x0 = hexX(town) + 0.012
  const pts = road.filter(([x]) => x >= x0).map(([x, z]): P2 => [x, z + 0.0125])
  return pts.length >= 2 ? pts : null
}

export function roadLines(t: Terrain[]): P2[][] {
  const lines: P2[][] = []
  const crossings = t.flatMap((v, h) => (v === 'bridge' || v === 'sluice' ? [h] : []))
  const lateral = (row: number, dz: number, skip: (v: Terrain) => boolean): P2[] => {
    const z0 = row * 0.1 + 0.025 - (0.1 * 8 + 0.05) / 2 + dz
    const out: P2[] = []
    for (let c = 1; c < COLS; c++) {
      const h = hexId(c, row) as HexId
      if (skip(t[h])) { if (out.length > 1) break; out.length = 0; continue }
      out.push([hexX(h), z0 + 0.007 * Math.sin(c * 1.7 + row)])
    }
    return out
  }
  if (crossings.length) {
    lines.push(lateral(8, 0.03, (v) => v === 'sea'))
    for (const h of crossings) lines.push([[hexX(h), hexZ(h) - 0.07], [hexX(h), hexZ(h) + 0.1]])
  }
  lines.push(lateral(0, -0.022, (v) => v === 'polder' || v === 'sea'))
  return lines.filter((l) => l.length >= 2).map((l) => {
    const out: P2[] = [l[0]]
    let a = l[0]
    for (let i = 1; i < l.length - 1; i++) {
      const c = l[i], b: P2 = [(c[0] + l[i + 1][0]) / 2, (c[1] + l[i + 1][1]) / 2]
      for (let k = 1; k <= 12; k++) {
        const s = k / 12, u = 1 - s
        out.push([u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], u * u * a[1] + 2 * u * s * c[1] + s * s * b[1]])
      }
      a = b
    }
    out.push(l[l.length - 1])
    return out
  })
}

function buildingsGround(g: CanvasRenderingContext2D, t: Terrain[]): void {
  for (let h = 0; h < N_HEX; h++) {
    if (!isBuilding(t[h])) continue
    const cx = hexX(h), cz = hexZ(h)
    // rubble apron and a cobbled yard in front of the facade
    g.fillStyle = 'rgba(120,108,94,0.55)'
    for (let i = 0; i < 40; i++) {
      const x = cx + (hash01(h, i) - 0.5) * 0.08, z = cz - 0.03 + hash01(h, i + 50) * 0.05
      const [px, py] = toPx(x, z)
      g.beginPath(); g.arc(px, py, 1.5 + hash01(h, i + 90) * 3, 0, 7); g.fill()
    }
    const [x0, y0] = toPx(cx - 0.036, cz - 0.058), [x1, y1] = toPx(cx + 0.036, cz - 0.022)
    g.fillStyle = 'rgba(64,52,42,0.55)'; g.fillRect(x0, y0, x1 - x0, y1 - y0)
  }
}

function wireGround(g: CanvasRenderingContext2D, p: PaintInput): void {
  // a faint trampled strip under every wire run (the coil itself is geometry, see TerrainKit)
  g.lineCap = 'round'
  for (let h = 0; h < N_HEX; h++) {
    if (!p.wire[h]) continue
    const pts = wirePath(h)
    g.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py) })
    g.strokeStyle = 'rgba(60,44,30,0.28)'; g.lineWidth = 34; g.stroke()
  }
}

// The cartographer's objective mark: a five-point star in a double ring, in sepia ink (the wax
// seal of whoever holds it sits on the star). Deliberately NOT red rings: red is enemy intent.
function objectives(g: CanvasRenderingContext2D, objs: { hex: HexId }[]): void {
  for (const o of objs) {
    const [px, py] = toPx(...sealSpot(o.hex))
    g.save(); g.translate(px, py)
    g.fillStyle = 'rgba(240,228,198,0.75)'; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill()
    g.strokeStyle = 'rgba(70,44,24,0.95)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke()
    g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.stroke()
    g.fillStyle = 'rgba(70,44,24,0.95)'; g.beginPath()
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r) }
    g.closePath(); g.fill()
    g.restore()
  }
}

// Where an objective's wax seal sits: the hex's south-east corner area, clear of the piece.
export function sealSpot(h: HexId): P2 {
  return [hexX(h) + 0.03, hexZ(h) + 0.036]
}

// Hand-ruled ink grid: each edge drawn once, with a little wobble and pressure variation.
function hexGrid(g: CanvasRenderingContext2D, gr: CanvasRenderingContext2D, gb: CanvasRenderingContext2D): void {
  const n = createNoise(3)
  g.lineCap = 'round'
  const seen = new Set<string>()
  for (let h = 0; h < N_HEX; h++) {
    const cs = hexCorners(h)
    for (let i = 0; i < 6; i++) {
      const a = cs[i], b = cs[(i + 1) % 6]
      const key = [a, b].map(([x, z]) => `${Math.round(x * 1e4)},${Math.round(z * 1e4)}`).sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const [ax, ay] = toPx(...a), [bx, by] = toPx(...b)
      const steps = 6
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps
        const wob = (t: number): P2 => {
          const x = ax + (bx - ax) * t, y = ay + (by - ay) * t
          const o = n(x * 0.02, y * 0.02) * 0.9
          return [x + o, y - o]
        }
        const [x0, y0] = wob(t0), [x1, y1] = wob(t1)
        const w = 3.1 + 0.8 * n(x0 * 0.05 + 3, y0 * 0.05)
        g.strokeStyle = `rgba(29,24,30,${0.78 + 0.12 * n(x0 * 0.01, y0 * 0.01)})`
        g.lineWidth = w
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
      }
      gr.strokeStyle = 'rgb(150,150,150)'; gr.lineWidth = 1.8
      gr.beginPath(); gr.moveTo(ax / 2, ay / 2); gr.lineTo(bx / 2, by / 2); gr.stroke()
      gb.strokeStyle = 'rgba(0,0,0,0.35)'; gb.lineWidth = 1.6
      gb.beginPath(); gb.moveTo(ax / 2, ay / 2); gb.lineTo(bx / 2, by / 2); gb.stroke()
    }
  }
}

function hexGridAround(g: CanvasRenderingContext2D, h: HexId): void {
  g.strokeStyle = 'rgba(29,24,30,0.8)'; g.lineWidth = 3.2; g.lineCap = 'round'
  for (const k of [h]) {
    const cs = hexCorners(k)
    g.beginPath()
    cs.forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py) })
    g.closePath(); g.stroke()
  }
}

// ---------------------------------------------------------------------------------------------
function labels(g: CanvasRenderingContext2D, p: PaintInput): void {
  const t = p.terrain
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const text = (s: string, x: number, z: number, size: number, style = 'italic', col = INK, spacing = 0, rot = 0): void => {
    const [px, py] = toPx(x, z)
    g.save(); g.translate(px, py); g.rotate(rot)
    g.font = `${style} ${size}px ${SERIF}`
    // a paper-coloured halo keeps lettering legible over hatching
    g.lineWidth = size * 0.16; g.strokeStyle = 'rgba(236,224,196,0.55)'; g.lineJoin = 'round'
    if (spacing) {
      const chars = [...s], w = chars.length * spacing
      chars.forEach((ch, i) => { const cx = -w / 2 + (i + 0.5) * spacing; g.strokeText(ch, cx, 0); g.fillStyle = col; g.fillText(ch, cx, 0) })
    } else { g.strokeText(s, 0, 0); g.fillStyle = col; g.fillText(s, 0, 0) }
    g.restore()
  }
  // the sea, lettered down the coast
  text('N O O R D Z E E', -MAP_W / 2 + 0.03, 0.05, 30, 'italic', 'rgba(222,232,238,0.95)', 0, -Math.PI / 2)
  // the river between the bridges
  const riverRow = [...Array(9).keys()].find((r) => t.slice(r * COLS, r * COLS + COLS).filter((v) => v === 'river').length > 4)
  if (riverRow !== undefined) {
    const z = hexZ(riverRow * COLS) + 0.025
    // centred in the widest open stretch between the crossings, never across a bridge deck
    const cols = [...Array(COLS).keys()]
    const wet = cols.filter((c) => t[riverRow * COLS + c] === 'river')
    const cross = cols.filter((c) => t[riverRow * COLS + c] === 'bridge' || t[riverRow * COLS + c] === 'sluice')
    const stops = [hexX(Math.min(...wet)), ...cross.map((c) => hexX(c)), hexX(Math.max(...wet))].sort((a, b) => a - b)
    let lx = 0.02, gap = 0
    for (let i = 0; i < stops.length - 1; i++) if (stops[i + 1] - stops[i] > gap) { gap = stops[i + 1] - stops[i]; lx = (stops[i] + stops[i + 1]) / 2 }
    // One name, not three: the two small repeats read as "smeared and repeated" under the
    // rippled water (outside review).
    text('Y S E R', lx, z, 40, 'italic', 'rgba(230,238,236,0.95)', 38)
  }
  // places
  const named: Partial<Record<Terrain, string>> = { church: 'Kerk', chateau: 'Château', blockhouse: 'Blockhaus' }
  for (let h = 0; h < N_HEX; h++) {
    const v = t[h], x = hexX(h), z = hexZ(h)
    if (v === 'ruin') text(rowOf(h) > 4 ? 'Nieuwpoort' : colOf(h) < 6 ? 'Lombartzijde' : 'Hoeve', x, z + 0.012, 30)
    else if (named[v]) text(named[v] as string, x, z + 0.012, 28)
  }
  const polder = t.findIndex((v, h) => v === 'polder' && rowOf(h) > 1 && rowOf(h) < 6)
  if (polder >= 0) text('Polder', hexX(polder), hexZ(polder), 30, 'italic', 'rgba(210,222,200,0.95)', 0, -Math.PI / 2)
  for (const o of p.objectives) {
    const [x, z] = sealSpot(o.hex)
    text(o.name, x - 0.012, z + 0.018, 20, 'italic', SEPIA)
  }
  compass(g)
}

// History on the board (SPEC-AAA H-05): what really happened here, pencilled on the staff map in
// blue — the British trench-map colour for their own side, and never the red of the enemy's ink.
// Each mark says "as it happened" (docs/history/FACTS.md): the German line the Marines reached at
// dusk on 10 July 1917 (F05, F06, approximate), the attack Hush planned and never made (F10), the
// plain the sluices flooded in 1914 (F01).
const PENCIL = 'rgba(22,44,118,0.95)'
function history(g: CanvasRenderingContext2D, p: PaintInput): void {
  // ponytail: the marks only — their words live in the HUD's despatch (HISTORY_MARK in words.ts):
  // painted on the sheet they blurred at the commander's angle (blind A/B: "a smear")
  const t = p.terrain
  const dashed = (pts: P2[], w = 7): void => {
    g.save(); g.lineCap = 'round'
    g.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = toPx(x, z); if (i) g.lineTo(px, py); else g.moveTo(px, py) })
    g.strokeStyle = 'rgba(244,236,214,0.75)'; g.lineWidth = w + 5; g.stroke() // a paper edge, so it reads over water
    g.strokeStyle = PENCIL; g.lineWidth = w; g.setLineDash([22, 12]); g.stroke()
    g.restore()
  }
  const riverRow = [...Array(9).keys()].find((r) => t.slice(r * COLS, r * COLS + COLS).filter((v) => v === 'river').length > 4)
  const bridges = t.filter((v) => v === 'bridge').length
  const at = (c: number, r: number): HexId => hexId(c, r) ?? 0 // ponytail: every (c, r) below is on the 13 x 9 sheet
  if (p.scenario === 's1' && riverRow !== undefined && bridges >= 3) {
    // the north bank between the coast and the middle bridge: where the British were thrown back
    const pts: P2[] = []
    for (let c = 1; c <= 7; c++) { const zm = (hexZ(at(c, riverRow - 1)) + hexZ(at(c, riverRow))) / 2; pts.push([hexX(at(c, riverRow)), zm + (hexZ(at(c, riverRow)) - zm) * 0.45]) }
    dashed(pts)
  } else if (p.scenario === 's2') {
    // the attack Hush planned up the dunes, and never made
    const from = at(6, 7), to = at(6, 3)
    const a: P2 = [hexX(from), hexZ(from) - 0.03], b: P2 = [hexX(to), hexZ(to) + 0.02]
    dashed([a, [(a[0] + b[0]) / 2 + 0.03, (a[1] + b[1]) / 2], b], 6)
    const [bx, by] = toPx(b[0], b[1])
    g.save(); g.fillStyle = PENCIL; g.beginPath(); g.moveTo(bx, by - 18); g.lineTo(bx - 14, by + 8); g.lineTo(bx + 14, by + 8); g.closePath(); g.fill(); g.restore()
  } else if (p.scenario === 's3') {
    // the polder the 1914 flood covered: its outline, not its water (the sluice here is yours to open)
    const wet = t.flatMap((v, h) => (v === 'polder' ? [h] : []))
    if (wet.length) {
      g.save(); g.strokeStyle = PENCIL; g.lineWidth = 4; g.setLineDash([16, 10])
      for (const h of wet) {
        const c = hexCorners(h)
        for (let i = 0; i < 6; i++) {
          const nb = neighbourAcross(h, i)
          if (nb !== null && t[nb] === 'polder') continue
          const [x0, y0] = toPx(c[i][0], c[i][1]), [x1, y1] = toPx(c[(i + 1) % 6][0], c[(i + 1) % 6][1])
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
        }
      }
      g.restore()
    }
  }
}

/** The hex across corner-edge i of h (the edge from corner i to i+1), or null off the map. */
function neighbourAcross(h: HexId, i: number): HexId | null {
  const c = hexCorners(h), mx = (c[i][0] + c[(i + 1) % 6][0]) / 2, mz = (c[i][1] + c[(i + 1) % 6][1]) / 2
  const x = hexX(h) + (mx - hexX(h)) * 2, z = hexZ(h) + (mz - hexZ(h)) * 2
  let best: HexId | null = null, d = R * 0.6
  for (let k = 0; k < N_HEX; k++) { const dd = Math.hypot(hexX(k) - x, hexZ(k) - z); if (dd < d) { d = dd; best = k as HexId } }
  return best
}

function compass(g: CanvasRenderingContext2D): void {
  const [px, py] = toPx(-MAP_W / 2 + 0.043, -MAP_H / 2 + 0.11)
  g.save(); g.translate(px, py)
  g.strokeStyle = 'rgba(236,228,206,0.95)'; g.fillStyle = 'rgba(236,228,206,0.95)'; g.lineWidth = 2
  g.beginPath(); g.arc(0, 0, 44, 0, 7); g.stroke()
  g.beginPath(); g.arc(0, 0, 38, 0, 7); g.stroke()
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2, l = i % 2 ? 30 : 58, w = i % 2 ? 6 : 9
    g.beginPath()
    g.moveTo(Math.cos(a) * l, Math.sin(a) * l)
    g.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w)
    g.lineTo(0, 0); g.closePath()
    g.fillStyle = i === 0 ? 'rgba(150,40,30,0.95)' : 'rgba(236,228,206,0.95)'; g.fill()
    g.beginPath()
    g.moveTo(Math.cos(a) * l, Math.sin(a) * l)
    g.lineTo(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w)
    g.lineTo(0, 0); g.closePath()
    g.fillStyle = 'rgba(40,52,62,0.9)'; g.fill()
  }
  g.font = `bold 26px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = 'rgba(240,232,210,1)'; g.fillText('N', 0, -74)
  g.restore()
}

function neatline(g: CanvasRenderingContext2D): void {
  g.strokeStyle = 'rgba(29,24,30,0.85)'
  g.lineWidth = 5; g.strokeRect(4, 4, TEX_W - 8, TEX_H - 8)
  g.lineWidth = 1.6; g.strokeRect(13, 13, TEX_W - 26, TEX_H - 26)
}

// ---------------------------------------------------------------------------------------------
// The mount around the sheet: a parchment margin band (MARGIN wide) carrying the column letters
// A-M on the north and south bands and the row numbers 1-9 on the west and east bands, each on
// its hex line, inside a double neatline. Canvas covers the band's outer box.
export const MARGIN = 0.042
export const MOUNT_W = MAP_W + 2 * MARGIN
export const MOUNT_H = MAP_H + 2 * MARGIN
export function paintMargin(): HTMLCanvasElement {
  const W = 2048, H = Math.round(W * MOUNT_H / MOUNT_W)
  const [c, g] = canvas(W, H)
  const k = W / MOUNT_W
  const P = (x: number, z: number): P2 => [(x + MOUNT_W / 2) * k, (z + MOUNT_H / 2) * k]
  const n = createNoise(61)
  const img = g.createImageData(W, H)
  const base = labToRgb(83, 3, 18)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = 1 + 0.05 * n.fbm(x * 0.006, y * 0.006, 3) + 0.025 * n(x * 0.2, y * 0.2)
    // foxing toward the outer edge
    const e = Math.min(x, y, W - 1 - x, H - 1 - y) / (MARGIN * k)
    const age = 1 - 0.1 * Math.max(0, 1 - e) ** 2
    const o = (y * W + x) * 4
    img.data[o] = base[0] * v * age * 255; img.data[o + 1] = base[1] * v * age * 255; img.data[o + 2] = base[2] * v * age * 0.97 * 255; img.data[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
  g.strokeStyle = 'rgba(40,30,26,0.9)'
  const [ix0, iy0] = P(-MAP_W / 2, -MAP_H / 2), [ix1, iy1] = P(MAP_W / 2, MAP_H / 2)
  g.lineWidth = 4; g.strokeRect(ix0 - 6, iy0 - 6, ix1 - ix0 + 12, iy1 - iy0 + 12)
  g.lineWidth = 2; g.strokeRect(14, 14, W - 28, H - 28)
  g.lineWidth = 6; g.strokeRect(24, 24, W - 48, H - 48)
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `bold 34px ${SERIF}`
  const band = 0.0165
  for (let col = 0; col < COLS; col++) {
    const h = hexId(col, 0) as HexId
    const L = String.fromCharCode(65 + col)
    const [x1, yN] = P(hexX(h), -MAP_H / 2 - band), [, yS] = P(hexX(h), MAP_H / 2 + band)
    g.fillText(L, x1, yN + 4); g.fillText(L, x1, yS + 4)
    // tick into the sheet
    g.lineWidth = 2
    g.beginPath(); g.moveTo(x1, iy0 - 6); g.lineTo(x1, iy0 - 16); g.moveTo(x1, iy1 + 6); g.lineTo(x1, iy1 + 16); g.stroke()
  }
  for (let r = 0; r < 9; r++) {
    const h = hexId(0, r) as HexId, he = hexId(COLS - 1, r) as HexId
    const [xW, y1] = P(-MAP_W / 2 - band, hexZ(h)), [xE, y2] = P(MAP_W / 2 + band, hexZ(he))
    g.fillText(String(r + 1), xW, y1 + 3); g.fillText(String(r + 1), xE, y2 + 3)
  }
  return c
}
