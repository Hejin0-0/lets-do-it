// Seeded canvas textures (Worker-C). Every surface in the room is baked here from noise: no files,
// no network. Colour, roughness and bump are separate channels with their own seeds and
// frequencies (digest_3d-assets §c.2) so highlights never simply trace the colour map.
// Roughness and bump share ONE texture (three reads roughness from G and bump height from R), so
// a set costs two GPU textures, not three (§11.5 texture budget).
import * as THREE from 'three'
import { createSeededRandom } from '@lid/random'

export interface TexSet {
  map: THREE.CanvasTexture
  /** packed data texture: R = bump height, G = roughness. roughnessMap === bumpMap. */
  roughnessMap: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
}

type Noise = (x: number, y: number) => number

/** Tileable value noise on a px × py lattice, output in [0,1]. */
export function valueNoise(seed: number, px: number, py = px): Noise {
  const r = createSeededRandom(seed)
  const g = new Float32Array(px * py)
  for (let i = 0; i < g.length; i++) g[i] = r()
  return (x, y) => {
    const xf = Math.floor(x), yf = Math.floor(y)
    let fx = x - xf, fy = y - yf
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    const x0 = ((xf % px) + px) % px, y0 = ((yf % py) + py) % py
    const x1 = x0 + 1 === px ? 0 : x0 + 1, y1 = y0 + 1 === py ? 0 : y0 + 1
    const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
}

/** Tileable fBm over (u,v) in [0,1): `oct` octaves from `bx × by` cells, doubling each octave. */
export function fbm(seed: number, bx: number, oct: number, by = bx): Noise {
  const ns = Array.from({ length: oct }, (_, o) => valueNoise(seed * 31 + o * 7919, bx << o, by << o))
  return (u, v) => {
    let s = 0, a = 0.5, n = 0
    for (let o = 0; o < oct; o++) { s += ns[o](u * (bx << o), v * (by << o)) * a; n += a; a *= 0.5 }
    return s / n
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('2d canvas unavailable')
  return [c, ctx]
}

function tex(c: HTMLCanvasElement, color: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

/** One pass that writes colour (sRGB 0..1), roughness and bump for each pixel. */
type Shader = (u: number, v: number, x: number, y: number, o: Float32Array) => void // o = [r,g,b,rough,bump]

function bake(w: number, h: number, f: Shader): TexSet {
  const [cc, cx] = canvas(w, h), [dc, dx] = canvas(w, h)
  const ci = cx.createImageData(w, h), di = dx.createImageData(w, h)
  const o = new Float32Array(5)
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h
    for (let x = 0; x < w; x++) {
      f((x + 0.5) / w, v, x, y, o)
      const i = (y * w + x) * 4
      ci.data[i] = o[0] * 255; ci.data[i + 1] = o[1] * 255; ci.data[i + 2] = o[2] * 255; ci.data[i + 3] = 255
      di.data[i] = o[4] * 255; di.data[i + 1] = o[3] * 255; di.data[i + 2] = 0; di.data[i + 3] = 255
    }
  }
  cx.putImageData(ci, 0, 0); dx.putImageData(di, 0, 0)
  const data = tex(dc, false)
  return { map: tex(cc, true), roughnessMap: data, bumpMap: data }
}

// ---------------------------------------------------------------------------------------------
// Oak: flat-sawn cathedral grain along u, open pores as long dark streaks, quarter-sawn ray flecks.
// 1024 × 512 covers 1.6 × 0.8 m (640 px/m, the table margin's density in the commander view).
export const OAK_TILE: [number, number] = [1.6, 0.8]
export function oakSet(seed = 11): TexSet {
  const warp = fbm(seed, 2, 3, 3), fine = fbm(seed + 1, 6, 3, 24)
  const pores = fbm(seed + 2, 5, 2, 220), tone = fbm(seed + 3, 3, 3, 2)
  const ray = fbm(seed + 4, 30, 1, 60), gloss = fbm(seed + 5, 4, 3, 3), streak = fbm(seed + 6, 1, 3, 14)
  return bake(1024, 512, (u, v, _x, _y, o) => {
    // growth rings: irregular spacing and a gentle lateral warp (flat-sawn, not cartoon waves)
    const st = streak(u, v)
    const rc = v * 34 + warp(u, v) * 2.4 + fine(u, v) * 0.9
    const ring = rc - Math.floor(rc)
    const late = smooth(0.55, 0.97, ring) * (0.55 + 0.45 * st)
    const pore = Math.max(0, pores(u, v) - 0.58) * 2.6
    const fleck = Math.max(0, ray(u, v) - 0.76) * 2.0
    // the rings stay in the colour but barely in gloss and relief: at a grazing look across the
    // table top every ring caught the light as a hard streak (blind A/B: "wood grain looks streaky")
    const L = clamp01(0.58 - late * 0.15 - pore * 0.22 + fleck * 0.12 + (tone(u, v) - 0.5) * 0.24 + (st - 0.5) * 0.12)
    o[0] = mix(0.2, 0.62, L); o[1] = mix(0.135, 0.46, L); o[2] = mix(0.08, 0.3, L)
    o[3] = clamp01(0.42 + pore * 0.3 + late * 0.03 + (gloss(u, v) - 0.5) * 0.25)
    o[4] = clamp01(0.55 + late * 0.08 - pore * 0.45 + fleck * 0.08)
  })
}

// ---------------------------------------------------------------------------------------------
// Ashlar: six 0.35 m courses of sandstone blocks per 2.4 × 2.1 m tile, pillowed faces, chipped
// arrises, recessed lime mortar.
export const ASHLAR_TILE: [number, number] = [2.4, 2.1]
export function ashlarSet(seed = 21): TexSet {
  const r = createSeededRandom(seed)
  const courses = 6
  const joints: number[][] = [], tints: number[][] = []
  for (let c = 0; c < courses; c++) {
    const js: number[] = []
    let x = r() * 0.3
    while (x < 1 + 1e-6) { js.push(x % 1); x += 0.2 + r() * 0.17 }
    js.sort((a, b) => a - b)
    joints.push(js)
    tints.push(js.map(() => r()))
  }
  const grain = fbm(seed + 1, 8, 4, 7), blot = fbm(seed + 2, 3, 3), pit = fbm(seed + 3, 48, 1, 42)
  return bake(512, 448, (u, v, _x, _y, o) => {
    const cv = v * courses, ci = Math.floor(cv) % courses, fy = cv - Math.floor(cv)
    const js = joints[ci]
    let k = js.length - 1
    for (let i = 0; i < js.length; i++) if (u >= js[i]) k = i
    const a = js[k], b = k + 1 < js.length ? js[k + 1] : js[0] + 1
    const uu = u < a ? u + 1 : u
    const dx = Math.min(uu - a, b - uu) * 2.4, dy = Math.min(fy, 1 - fy) * 0.35 // metres to joint
    const d = Math.min(dx, dy)
    const n = grain(u, v), bl = blot(u, v)
    const chip = (pit(u, v) - 0.5) * 0.02
    const mortar = d + chip < 0.008
    const t = tints[ci][k]
    const edge = smooth(0.0, 0.07, d) // darker toward the joints (grime + AO)
    const L = mortar ? 0.26 : (0.46 + (t - 0.5) * 0.26 + (n - 0.5) * 0.22 + (bl - 0.5) * 0.3) * (0.66 + 0.34 * edge)
    const warm = mortar ? 0 : (t - 0.5) * 0.06
    o[0] = clamp01(L * 1.08 + warm); o[1] = clamp01(L * 1.0); o[2] = clamp01(L * 0.86 - warm)
    o[3] = mortar ? 0.97 : clamp01(0.84 + (n - 0.5) * 0.18)
    o[4] = mortar ? 0.12 : clamp01(0.45 + 0.35 * smooth(0, 0.05, d) + (n - 0.5) * 0.25)
  })
}

// ---------------------------------------------------------------------------------------------
// Floor: one non-repeating 11 × 16 m canvas of limestone flags (96 px/m). The central aisle is worn
// smooth (roughness 0.35 against 0.8 on the flags either side), grime gathers along the stacks.
export const FLOOR_W = 11, FLOOR_D = 16
export function floorSet(seed = 31, pressZ: number[] = []): TexSet {
  const W = 1056, H = 1536, pxm = W / FLOOR_W
  const r = createSeededRandom(seed)
  // rows of flags along z; every row gets its own joints in x (running bond)
  const rowEdge: number[] = [0]
  while (rowEdge[rowEdge.length - 1] < FLOOR_D) rowEdge.push(rowEdge[rowEdge.length - 1] + 0.55 + r() * 0.35)
  const rowJoints: number[][] = [], rowTint: number[][] = []
  for (let i = 0; i < rowEdge.length; i++) {
    const js = [0]
    let x = 0.2 + r() * 0.5
    while (x < FLOOR_W) { js.push(x); x += 0.55 + r() * 0.55 }
    js.push(FLOOR_W + 5)
    rowJoints.push(js); rowTint.push(js.map(() => r()))
  }
  const rowOf = new Int32Array(H)
  for (let y = 0, k = 0; y < H; y++) { const z = (y + 0.5) / pxm; while (rowEdge[k + 1] <= z) k++; rowOf[y] = k }
  const speck = fbm(seed + 1, 300, 1, 440), cloud = fbm(seed + 2, 6, 4, 9), wear = fbm(seed + 3, 10, 3, 14)
  const chip = fbm(seed + 4, 180, 1, 260)
  return bake(W, H, (u, v, _x, y, o) => {
    const X = u * FLOOR_W - FLOOR_W / 2, Z = v * FLOOR_D // Z from the north wall
    const zw = Z - 9 // world z
    const k = rowOf[y], js = rowJoints[k]
    const xx = u * FLOOR_W
    let j = 0
    while (js[j + 1] <= xx) j++
    const dx = Math.min(xx - js[j], js[j + 1] - xx), dz = Math.min(Z - rowEdge[k], rowEdge[k + 1] - Z)
    const d = Math.min(dx, dz) + (chip(u, v) - 0.5) * 0.012
    const grout = d < 0.006
    const t = rowTint[k][j]
    const aisle = 1 - smooth(1.05, 1.55, Math.abs(X))
    const walk = aisle * (0.55 + 0.45 * wear(u, v))
    // grime: toward the lower stacks (x = ±4.2) and the presses' footprints
    let grime = smooth(3.6, 4.2, Math.abs(X))
    for (const pz of pressZ) grime = Math.max(grime, (1 - smooth(0.3, 0.75, Math.abs(zw - pz))) * smooth(1.9, 2.4, Math.abs(X)))
    const n = cloud(u, v), s = speck(u, v)
    const bevel = smooth(0.004, 0.03, d)
    let L = 0.36 + (t - 0.5) * 0.12 + (n - 0.5) * 0.1 + (s - 0.5) * 0.05 - walk * 0.03
    L *= (0.8 + 0.2 * bevel) * (1 - grime * 0.35)
    const hue = (t - 0.5) * 0.08
    if (grout) { o[0] = 0.12; o[1] = 0.105; o[2] = 0.09 } else { o[0] = clamp01(L * (1.06 + hue)); o[1] = clamp01(L * 0.98); o[2] = clamp01(L * (0.86 - hue)) }
    const rough = mix(0.8 + (n - 0.5) * 0.14, 0.35 + (1 - walk) * 0.08, aisle)
    o[3] = grout ? 0.96 : clamp01(rough + grime * 0.1)
    o[4] = grout ? 0.08 : clamp01(0.35 + 0.4 * bevel + (n - 0.5) * 0.18 + (s - 0.5) * 0.1)
  })
}

// ---------------------------------------------------------------------------------------------
export function parchmentSet(seed = 41): TexSet {
  const blot = fbm(seed, 3, 4), fibre = fbm(seed + 1, 12, 2, 180), fox = fbm(seed + 2, 40, 1), grain = fbm(seed + 3, 32, 2)
  return bake(512, 512, (u, v, _x, _y, o) => {
    const b = blot(u, v), f = fibre(u, v), s = fox(u, v)
    const stain = smooth(0.55, 0.85, b) * 0.1
    const dot = smooth(0.8, 0.97, s) * 0.07
    const L = 0.9 - stain - dot + (f - 0.5) * 0.06
    o[0] = clamp01(L); o[1] = clamp01(L * 0.9 - stain * 0.2); o[2] = clamp01(L * 0.72 - stain * 0.3)
    o[3] = clamp01(0.82 + (grain(u, v) - 0.5) * 0.16)
    o[4] = clamp01(0.5 + (f - 0.5) * 0.5 + (grain(u, v) - 0.5) * 0.3)
  })
}

export function leatherSet(seed = 51): TexSet {
  const cell = fbm(seed, 28, 2), cell2 = fbm(seed + 1, 56, 1), wear = fbm(seed + 2, 4, 3)
  return bake(512, 512, (u, v, _x, _y, o) => {
    const c = Math.abs(cell(u, v) - 0.5) * 2, c2 = Math.abs(cell2(u, v) - 0.5) * 2
    const crease = Math.pow(1 - Math.min(c, c2 + 0.2), 6)
    const w = wear(u, v)
    const L = 0.78 - crease * 0.25 + (w - 0.5) * 0.3
    o[0] = o[1] = o[2] = clamp01(L)
    o[3] = clamp01(0.58 + crease * 0.2 - smooth(0.5, 0.8, w) * 0.2)
    o[4] = clamp01(0.62 - crease * 0.55)
  })
}

/** Handled-metal smudges and fine scratches: roughness and bump only (colour is flat grey). */
export function metalSet(seed = 61): TexSet {
  const sm = fbm(seed, 4, 4), scratch = fbm(seed + 1, 2, 2, 220), pit = fbm(seed + 2, 64, 1)
  return bake(256, 256, (u, v, _x, _y, o) => {
    const s = sm(u, v), sc = Math.max(0, scratch(u, v) - 0.6) * 2.5, p = pit(u, v)
    o[0] = o[1] = o[2] = clamp01(0.85 + (s - 0.5) * 0.3)
    // satin, handled metal: roughness 0.48..0.80 (x the role's factor), so a candle or the key
    // never mirrors as a pinpoint that blooms to white on the table's brass
    o[3] = clamp01(0.58 + (s - 0.5) * 0.2 + sc * 0.12)
    o[4] = clamp01(0.5 - sc * 0.3 - (p > 0.8 ? 0.2 : 0))
  })
}

export function marbleSet(seed = 71): TexSet {
  const warp = fbm(seed, 3, 5), cloud = fbm(seed + 1, 5, 3)
  return bake(512, 512, (u, v, _x, _y, o) => {
    const w = warp(u, v)
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 2 + v * 1 + w * 5) * Math.PI)), 18)
    const L = 0.86 - vein * 0.32 + (cloud(u, v) - 0.5) * 0.08
    o[0] = clamp01(L); o[1] = clamp01(L * 0.99); o[2] = clamp01(L * 0.95)
    o[3] = clamp01(0.24 + vein * 0.2 + (cloud(u, v) - 0.5) * 0.1)
    o[4] = clamp01(0.5 - vein * 0.2)
  })
}

// ---------------------------------------------------------------------------------------------
/**
 * Book spine atlas: 16 rows of 64 px, each a different binding laid on its side (u runs up the
 * spine, v across it). Data channels: R = leather value, G = gilt mask, B = roughness offset.
 */
export const SPINE_ROWS = 16
export function spineAtlas(seed = 81): THREE.CanvasTexture {
  const W = 256, RH = 64, H = RH * SPINE_ROWS
  const [c, ctx] = canvas(W, H)
  const img = ctx.createImageData(W, H)
  const r = createSeededRandom(seed)
  const grain = fbm(seed + 1, 32, 2, 8), rub = fbm(seed + 2, 6, 3, 2)
  for (let row = 0; row < SPINE_ROWS; row++) {
    const bands = 2 + Math.floor(r() * 4) // raised bands
    const style = row % 4 // 0 gilt title panel, 1 dark label, 2 gilt tooling only, 3 plain vellum-ish
    const labelLo = 0.62 + r() * 0.08, labelHi = labelLo + 0.12 + r() * 0.06
    const doubleRule = r() < 0.6
    const text: [number, number, number][] = []
    for (let i = 0; i < 7; i++) text.push([labelLo + 0.015 + r() * (labelHi - labelLo - 0.04), 0.012 + r() * 0.02, 0.25 + r() * 0.5])
    const fleurons = r() < 0.7
    for (let y = 0; y < RH; y++) {
      const v = (y + 0.5) / RH, across = Math.abs(v - 0.5) * 2 // 0 centre of spine, 1 at the joint
      for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W
        const gu = u, gv = (row * RH + y) / H
        let L = 0.72 + (grain(gu, gv) - 0.5) * 0.3 + (rub(gu, gv) - 0.5) * 0.25
        L *= 1 - across * across * 0.35 // round spine falls off toward the joints
        let gilt = 0, rough = 0.5
        // raised bands between the panels, with a gilt rule each side
        for (let b = 1; b <= bands; b++) {
          const bu = 0.12 + (b / (bands + 1)) * 0.46
          const d = Math.abs(u - bu)
          if (d < 0.012) { L *= 0.75 + (0.012 - d) * 30; rough = 0.35 }
          if (style !== 3 && Math.abs(d - 0.02) < 0.004) gilt = 1
        }
        // head and tail rules
        if (style !== 3) {
          if (u > 0.955 && u < 0.965) gilt = 1
          if (doubleRule && u > 0.935 && u < 0.941) gilt = 1
          if (u > 0.035 && u < 0.045) gilt = 1
        }
        // title panel
        if (u > labelLo && u < labelHi && across < 0.8) {
          if (style === 1) L *= 0.45
          if (style === 0 || style === 1) {
            const edge = Math.min(u - labelLo, labelHi - u)
            if (edge < 0.006 || (across > 0.66 && across < 0.74)) gilt = 1
            for (const [tu, tw, th] of text) if (Math.abs(u - tu) < tw * 0.5 && across < th * 0.9) gilt = Math.max(gilt, 0.85)
          }
        }
        // fleurons in the other panels
        if (fleurons && style !== 3 && u < 0.58 && u > 0.1) {
          const pu = ((u - 0.1) * (bands + 1) / 0.46) % 1
          const dd = Math.hypot((pu - 0.5) * 2.2, across * 1.3)
          if (dd < 0.28 && dd > 0.16) gilt = 1
          if (dd < 0.07) gilt = 1
        }
        if (style === 3) L = 0.95 + (L - 0.72) * 0.4 // pale vellum
        const i = ((row * RH + y) * W + x) * 4
        img.data[i] = clamp01(L) * 255
        img.data[i + 1] = gilt * (0.75 + rub(gu * 3, gv) * 0.5) * 255
        img.data[i + 2] = rough * 255
        img.data[i + 3] = 255
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = tex(c, false)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

// ---------------------------------------------------------------------------------------------
/** A Ushak-style "Turkey" carpet: madder field, indigo medallion, ivory guards, worn pile. */
// W x H: the war-table's rug is 1024 x 768; a tall canvas is an aisle runner (a row of medallions).
export function rugTexture(seed = 91, W = 1024, H = 768): THREE.CanvasTexture {
  const tall = H > W, sc = Math.min(W, H) / 768 * (tall ? 0.62 : 1)
  const [c, ctx] = canvas(W, H)
  const r = createSeededRandom(seed)
  const madder = '#8a2a1f', indigo = '#1f2c4a', ivory = '#d9c9a0', ochre = '#c08a32', green = '#4a5a34', brown = '#3a2418'
  ctx.fillStyle = madder; ctx.fillRect(0, 0, W, H)
  // borders: outer brown, ivory guard, wide indigo band with repeating ochre rosettes, ivory guard
  const band = (inset: number, w: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(inset, inset, W - 2 * inset, w); ctx.fillRect(inset, H - inset - w, W - 2 * inset, w); ctx.fillRect(inset, inset, w, H - 2 * inset); ctx.fillRect(W - inset - w, inset, w, H - 2 * inset) }
  band(0, 14, brown); band(14, 8, ivory); band(22, 58, indigo); band(80, 8, ivory); band(88, 6, ochre)
  ctx.fillStyle = ochre
  const rosette = (x: number, y: number, s: number, col: string) => {
    ctx.fillStyle = col
    ctx.beginPath()
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = k % 2 ? s * 0.45 : s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) }
    ctx.closePath(); ctx.fill()
  }
  for (let x = 60; x < W - 40; x += 56) { rosette(x, 51, 20, ochre); rosette(x, H - 51, 20, ochre); rosette(x, 51, 7, madder); rosette(x, H - 51, 7, madder) }
  for (let y = 110; y < H - 90; y += 56) { rosette(51, y, 20, ochre); rosette(W - 51, y, 20, ochre); rosette(51, y, 7, madder); rosette(W - 51, y, 7, madder) }
  // field: scattered small motifs
  for (let i = 0; i < 90; i++) {
    const x = 120 + r() * (W - 240), y = 120 + r() * (H - 240)
    const col = [ivory, indigo, ochre, green][Math.floor(r() * 4)]
    ctx.fillStyle = col
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4)
    ctx.fillRect(-6, -6, 12, 12); ctx.restore()
    ctx.fillStyle = madder; ctx.fillRect(x - 2, y - 2, 4, 4)
  }
  // central lobed medallion + two pendants
  const medal = (cx: number, cy: number, rx: number, ry: number, col: string) => {
    ctx.fillStyle = col; ctx.beginPath()
    for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2, lobe = 1 + 0.12 * Math.cos(a * 8); ctx.lineTo(cx + Math.cos(a) * rx * lobe, cy + Math.sin(a) * ry * lobe) }
    ctx.closePath(); ctx.fill()
  }
  for (let j = 0, m = tall ? 3 : 1; j < m; j++) {
    const cx = W / 2, cy = H * (j + 0.5) / m
    for (const [rx, ry, col] of [[250, 170, ivory], [236, 158, indigo], [150, 96, madder], [70, 44, ochre], [30, 20, indigo]] as const) medal(cx, cy, rx * sc, ry * sc, col)
  }
  if (!tall) for (const s of [-1, 1]) { medal(W / 2 + s * 300, H / 2, 40, 60, indigo); medal(W / 2 + s * 300, H / 2, 22, 34, ochre) }
  // spandrels in the corners of the field
  ctx.fillStyle = indigo
  const sp = Math.min(1, Math.min(W, H) / 768)
  for (const [x, y, sx, sy] of [[94, 94, 1, 1], [W - 94, 94, -1, 1], [94, H - 94, 1, -1], [W - 94, H - 94, -1, -1]] as const) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sx * 190 * sp, y); ctx.quadraticCurveTo(x + sx * 90 * sp, y + sy * 40 * sp, x, y + sy * 150 * sp); ctx.closePath(); ctx.fill()
  }
  // pile: fibre noise, abrash (dye lots in horizontal bands) and wear along the centre
  const img = ctx.getImageData(0, 0, W, H)
  const fib = fbm(seed + 1, 256, 1, 192), abr = fbm(seed + 2, 1, 2, 12), wr = fbm(seed + 3, 6, 3, 5)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, i = (y * W + x) * 4
    const k = 0.84 + (fib(u, v) - 0.5) * 0.3 + (abr(u, v) - 0.5) * 0.14
    const worn = smooth(0.55, 0.85, wr(u, v)) * (1 - Math.abs(v - 0.5) * 1.4) * 0.18
    for (let ch = 0; ch < 3; ch++) img.data[i + ch] = Math.min(255, img.data[i + ch] * k + worn * 120)
  }
  ctx.putImageData(img, 0, 0)
  return tex(c, true)
}

// ---------------------------------------------------------------------------------------------
/**
 * Leaded lancet glass, moonlit from outside: diamond quarries of pale green-grey glass with a few
 * jewel panes, a coloured border and a roundel. Used as colour AND emission (MeshBasicMaterial),
 * so values are the light the pane passes. Maps the lancet's bounding box (w × h metres).
 */
export function leadedGlass(seed: number, wM: number, hM: number): THREE.CanvasTexture {
  const W = 256, H = Math.round((256 * hM) / wM)
  const [c, ctx] = canvas(W, H)
  const r = createSeededRandom(seed)
  const pxm = W / wM
  const q = 0.16 * pxm // quarry half-diagonal
  // sky gradient behind the glass: brighter toward the top (moon high to the north)
  for (let i = 0; i * q < H + q; i++) {
    for (let j = -1; j * q < W + q; j++) {
      const cx = j * q + (i % 2 ? q / 2 : 0), cy = i * (q / 2) * 2
      const t = 1 - cy / H
      const jewel = r()
      const g0 = r() * 0.08
      let col: [number, number, number] = [0.4 + g0, 0.47 + g0 + r() * 0.04, 0.5 + g0 + r() * 0.05]
      if (jewel < 0.012) col = [0.5, 0.16, 0.13]
      else if (jewel < 0.024) col = [0.18, 0.25, 0.48]
      else if (jewel < 0.036) col = [0.58, 0.46, 0.2]
      const k = 0.45 + t * 0.6
      ctx.fillStyle = `rgb(${(col[0] * k * 255) | 0},${(col[1] * k * 255) | 0},${(col[2] * k * 255) | 0})`
      ctx.beginPath(); ctx.moveTo(cx, cy - q / 2); ctx.lineTo(cx + q / 2, cy); ctx.lineTo(cx, cy + q / 2); ctx.lineTo(cx - q / 2, cy); ctx.closePath(); ctx.fill()
    }
  }
  // lead cames on the diagonals
  ctx.strokeStyle = 'rgb(10,10,12)'; ctx.lineWidth = 2.2
  for (let k = -H; k < W + H; k += q) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H, H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k - H, H); ctx.stroke()
  }
  // coloured border strip and its came
  const bw = 0.09 * pxm
  const grad = ['#5a2a24', '#6a5630', '#2e3a52']
  for (let y = 0; y < H; y += bw * 1.6) {
    ctx.fillStyle = grad[Math.floor(r() * 3)]
    ctx.fillRect(0, y, bw, bw * 1.6); ctx.fillRect(W - bw, y, bw, bw * 1.6)
  }
  ctx.fillStyle = 'rgb(10,10,12)'; ctx.fillRect(bw - 1.5, 0, 3, H); ctx.fillRect(W - bw - 1.5, 0, 3, H)
  // roundel two-thirds up: ruby ring, gold star, blue field
  const ry = H * 0.36, rr = W * 0.3
  ctx.fillStyle = '#5a221c'; ctx.beginPath(); ctx.arc(W / 2, ry, rr, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#26324e'; ctx.beginPath(); ctx.arc(W / 2, ry, rr * 0.8, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#a08040'; ctx.beginPath()
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 - Math.PI / 2, rad = k % 2 ? rr * 0.3 : rr * 0.7; ctx.lineTo(W / 2 + Math.cos(a) * rad, ry + Math.sin(a) * rad) }
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgb(10,10,12)'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(W / 2, ry, rr, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(W / 2, ry, rr * 0.8, 0, Math.PI * 2); ctx.stroke()
  // iron saddle bars every 0.55 m
  ctx.fillStyle = 'rgb(6,6,8)'
  for (let y = H - 0.55 * pxm; y > 0; y -= 0.55 * pxm) ctx.fillRect(0, y - 2, W, 4)
  return tex(c, true)
}

// ---------------------------------------------------------------------------------------------
export function globeTexture(seed = 101): THREE.CanvasTexture {
  const W = 1024, H = 512
  const [c, ctx] = canvas(W, H)
  const img = ctx.createImageData(W, H)
  const land = fbm(seed, 4, 5, 2), stain = fbm(seed + 1, 3, 3, 2)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, i = (y * W + x) * 4
    const lat = Math.abs(v - 0.5) * 2
    const n = land(u, v) - lat * 0.12
    const coast = Math.abs(n - 0.52) < 0.006
    const isLand = n > 0.52
    const s = stain(u, v)
    let R = isLand ? 0.62 : 0.78, G = isLand ? 0.5 : 0.68, B = isLand ? 0.32 : 0.5
    if (isLand) { const hills = smooth(0.58, 0.7, n) * 0.15; R -= hills; G -= hills; B -= hills * 0.8 }
    const grat = (Math.abs(((u * 24) % 1) - 0.5) > 0.485 || Math.abs(((v * 12) % 1) - 0.5) > 0.48) ? 0.8 : 1
    const k = (0.85 + s * 0.25) * grat * (coast ? 0.35 : 1)
    img.data[i] = clamp01(R * k) * 255; img.data[i + 1] = clamp01(G * k) * 255; img.data[i + 2] = clamp01(B * k) * 255; img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const t = tex(c, true)
  t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** Soft radial sprite (alpha in all channels) for halos and contact shadows. */
export function radialSprite(size = 64, falloff = 2): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
    const a = Math.pow(clamp01(1 - d), falloff) * 255, i = (y * size + x) * 4
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a
  }
  ctx.putImageData(img, 0, 0)
  const t = tex(c, false)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** Vertical flame ramp for mat('flame'): white-hot base, orange body, transparent tip (along v). */
export function flameRamp(): THREE.CanvasTexture {
  const [c, ctx] = canvas(8, 64)
  const g = ctx.createLinearGradient(0, 64, 0, 0)
  g.addColorStop(0, 'rgba(120,150,255,0.9)'); g.addColorStop(0.12, 'rgba(255,245,215,1)')
  g.addColorStop(0.55, 'rgba(255,190,90,1)'); g.addColorStop(1, 'rgba(255,110,30,0.2)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 64)
  const t = tex(c, true)
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}
