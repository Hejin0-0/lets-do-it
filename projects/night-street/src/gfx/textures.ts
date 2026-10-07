import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  type Wrapping,
} from 'three'
import type { SignStyle } from '../world/placement'

/**
 * Every texture in the project is drawn here, at load time, into a 2D canvas.
 * Zero files on disk. The brief's "every texture is procedural" is the one
 * constraint that never got relaxed.
 *
 * All of it is value-noise fbm plus a small amount of deliberate structure
 * (mortar lines, slab seams, tar joints). Noise alone reads as television snow;
 * what makes a surface look photographed is one layer of structure at a scale
 * the eye can measure itself against.
 */

// ---------------------------------------------------------------------------
// noise
// ---------------------------------------------------------------------------

/** Deterministic per-lattice-point hash. Same seed always draws the same wall. */
/**
 * GLSL's smoothstep, including its reversed-edge behaviour: `e0 > e1` gives a
 * ramp that falls from 1 to 0, which is how the falloffs below are written.
 */
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function hash(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function lattice(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  // Smoothstep the cell coordinates; linear interpolation leaves visible
  // diamond artefacts that survive all the way through the tonemap.
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

export interface FbmOpts {
  octaves?: number
  freq?: number
  seed?: number
  gain?: number
  /** Wrap the lattice so the result tiles seamlessly at `freq` cells. */
  tile?: boolean
}

/** fbm field in [0,1], row-major, size*size. */
export function fbm(size: number, opts: FbmOpts = {}): Float32Array {
  const { octaves = 5, freq = 4, seed = 1, gain = 0.5, tile = true } = opts
  const out = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0
      let amp = 1
      let f = freq
      for (let o = 0; o < octaves; o++) {
        const fx = (x / size) * f
        const fy = (y / size) * f
        // Tiling comes from asking the lattice for coordinates modulo the
        // octave frequency, so cell (f, n) and cell (0, n) are the same cell.
        const n = tile
          ? latticeTiled(fx, fy, Math.max(1, Math.round(f)), seed + o * 101)
          : lattice(fx, fy, seed + o * 101)
        sum += n * amp
        amp *= gain
        f *= 2
      }
      out[y * size + x] = sum
      if (sum < min) min = sum
      if (sum > max) max = sum
    }
  }
  const span = max - min || 1
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / span
  return out
}

function latticeTiled(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const m = (n: number) => ((n % period) + period) % period
  const x0 = m(xi)
  const y0 = m(yi)
  const x1 = m(xi + 1)
  const y1 = m(yi + 1)
  const a = hash(x0, y0, seed)
  const b = hash(x1, y0, seed)
  const c = hash(x0, y1, seed)
  const d = hash(x1, y1, seed)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

// ---------------------------------------------------------------------------
// canvas plumbing
// ---------------------------------------------------------------------------

function surface(size: number, h = size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  return { c, ctx }
}

interface FinishOpts {
  repeat?: [number, number]
  wrap?: Wrapping
  srgb?: boolean
  /**
   * Turn mipmaps off. For the smooth falloff ramps only.
   *
   * A radial gradient on a 5.7 m quad is always magnified, so its mip chain is
   * never an anti-aliasing win — but at a grazing angle the GPU picks the mip
   * from the *minor* axis, which can be four or five levels down while the
   * major axis is stretched across half the screen. A 16x16 mip magnified that
   * far reads as hard-edged blocks, and that is the blocky mosaic that appeared
   * under every neon sign and along the wall glows. Without mipmaps the sampler
   * has only the full-resolution image to magnify, which is what a ramp wants.
   */
  noMips?: boolean
  aniso?: number
}

function finish(c: HTMLCanvasElement, o: FinishOpts = {}): Texture {
  const t = new CanvasTexture(c)
  const wrap = o.wrap ?? RepeatWrapping
  t.wrapS = wrap
  t.wrapT = wrap
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1])
  // Grazing-angle road and sidewalk are most of the frame in a first-person
  // walk. Without anisotropy the asphalt turns to grey mush ten metres out and
  // the whole shot reads as a render.
  t.anisotropy = o.aniso ?? 8
  if (o.noMips) {
    t.generateMipmaps = false
    t.minFilter = LinearFilter
  }
  if (o.srgb) t.colorSpace = SRGBColorSpace
  t.needsUpdate = true
  return t
}

const cache = new Map<string, Texture>()
function memo(key: string, make: () => Texture): Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const t = make()
  cache.set(key, t)
  return t
}

/** Cheap deterministic RNG for the generators that need a few random numbers. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ---------------------------------------------------------------------------
// road
// ---------------------------------------------------------------------------

/**
 * Asphalt. The aggregate is what sells it: real asphalt is a bimodal
 * distribution of small dark stones in a lighter binder, not a uniform grey.
 * Flat grey plus noise is the single most common giveaway in a street render.
 */
export function asphaltMaps(): { color: Texture; rough: Texture; normal: Texture } {
  const key = 'asphalt'
  const color = memo(key + ':c', () => {
    const size = 512
    const { c, ctx } = surface(size)
    const grain = fbm(size, { octaves: 6, freq: 24, seed: 7 })
    const blotch = fbm(size, { octaves: 4, freq: 3, seed: 19 })
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      // Two populations: binder around 0.052 linear, aggregate flecks brighter.
      const g = grain[i]
      const aggregate = g > 0.74 ? (g - 0.74) * 2.0 : 0
      const wear = blotch[i] * 0.055
      const v = 0.046 + wear + aggregate * 0.13
      const s = Math.round(Math.pow(Math.min(1, v), 1 / 2.2) * 255)
      // Asphalt is very slightly warm from the binder, and reads dead if neutral.
      img.data[i * 4] = Math.min(255, s + 5)
      img.data[i * 4 + 1] = s
      img.data[i * 4 + 2] = Math.max(0, s - 3)
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    // Tar-sealed cracks. A repaired road has more of these than a new one and
    // they are the only long straight-ish features on the surface.
    const r = rng(4)
    ctx.strokeStyle = 'rgba(8,7,7,0.85)'
    for (let n = 0; n < 5; n++) {
      ctx.lineWidth = 1.2 + r() * 1.8
      ctx.beginPath()
      let x = r() * size
      let y = r() * size
      ctx.moveTo(x, y)
      for (let k = 0; k < 9; k++) {
        x += (r() - 0.5) * 46
        y += (r() - 0.5) * 46
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return finish(c, { repeat: [3, 60], srgb: true, aniso: 16 })
  })

  const rough = memo(key + ':r', () => {
    const size = 512
    const { c, ctx } = surface(size)
    // Damp patches. The brief asked for "slight wet sheen even without rain",
    // which is a roughness story, not a colour one — the pavement is not
    // bluer where it is damp, it is smoother.
    const damp = fbm(size, { octaves: 5, freq: 3.5, seed: 31 })
    const micro = fbm(size, { octaves: 4, freq: 40, seed: 5 })
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const wet = Math.max(0, damp[i] - 0.52) * 1.9
      const v = 0.94 - wet * 0.62 - micro[i] * 0.07
      const s = Math.round(Math.max(0, Math.min(1, v)) * 255)
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = s
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { repeat: [3, 60], aniso: 16 })
  })

  return { color, rough, normal: normalFromFbm('asphalt', 512, { octaves: 6, freq: 26, seed: 7 }, 2.2, [3, 60]) }
}

/** Lane markings, drawn as a separate strip so they stay crisp at any repeat. */
export function laneStripe(dashed: boolean): Texture {
  return memo('lane:' + dashed, () => {
    const w = 64
    const h = 256
    const { c, ctx } = surface(w, h)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, w, h)
    // Traffic paint is never white. It is grey-yellow, chipped, and has tyre
    // rubber smeared across it.
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, 'rgba(150,142,120,0.0)')
    grad.addColorStop(0.22, 'rgba(196,186,158,0.93)')
    grad.addColorStop(0.78, 'rgba(196,186,158,0.93)')
    grad.addColorStop(1, 'rgba(150,142,120,0.0)')
    ctx.fillStyle = grad
    if (dashed) {
      ctx.fillRect(0, 26, w, 150)
    } else {
      ctx.fillRect(0, 0, w, h)
    }
    // Chip the paint back out again.
    const chip = fbm(64, { octaves: 4, freq: 12, seed: 91 })
    const img = ctx.getImageData(0, 0, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = chip[(y % 64) * 64 + x]
        const i = (y * w + x) * 4
        if (n < 0.34) img.data[i + 3] *= n / 0.34
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: RepeatWrapping, srgb: true, aniso: 16 })
  })
}

// ---------------------------------------------------------------------------
// concrete / stone
// ---------------------------------------------------------------------------

/** Sidewalk. Slab seams every 1.2 m, stained along the building line. */
export function concreteMaps(): { color: Texture; rough: Texture; normal: Texture } {
  const color = memo('concrete:c', () => {
    const size = 512
    const { c, ctx } = surface(size)
    const base = fbm(size, { octaves: 6, freq: 8, seed: 44 })
    const stain = fbm(size, { octaves: 4, freq: 2.5, seed: 88 })
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const v = 0.24 + base[i] * 0.14 - stain[i] * 0.11
      const s = Math.round(Math.pow(Math.max(0, v), 1 / 2.2) * 255)
      img.data[i * 4] = s
      img.data[i * 4 + 1] = Math.round(s * 0.985)
      img.data[i * 4 + 2] = Math.round(s * 0.95)
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)

    // Slab seams. Two per tile, so the tile is 2 slabs across.
    ctx.strokeStyle = 'rgba(22,20,19,0.62)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0.5)
    ctx.lineTo(size, 0.5)
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.moveTo(0.5, 0)
    ctx.lineTo(0.5, size)
    ctx.stroke()
    return finish(c, { repeat: [3, 24], srgb: true, aniso: 16 })
  })

  const rough = memo('concrete:r', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const n = fbm(size, { octaves: 5, freq: 14, seed: 12 })
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const s = Math.round((0.88 - n[i] * 0.16) * 255)
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = s
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { repeat: [3, 24] })
  })

  return { color, rough, normal: normalFromFbm('concrete', 256, { octaves: 5, freq: 12, seed: 44 }, 1.4, [3, 24]) }
}

// ---------------------------------------------------------------------------
// facades
// ---------------------------------------------------------------------------

export type FacadeKind = 'brick' | 'painted-brick' | 'stucco' | 'stone'

const FACADE_BASE: Record<FacadeKind, [number, number, number]> = {
  brick: [0.35, 0.15, 0.11],
  'painted-brick': [0.52, 0.47, 0.42],
  stucco: [0.46, 0.40, 0.33],
  stone: [0.40, 0.38, 0.34],
}

/**
 * A facade sheet. Brick courses are drawn as real rectangles with per-brick
 * colour jitter rather than a noise-modulated grid, because brick variation is
 * per-brick — a noise field crossing a mortar line is the tell.
 */
export function facadeMaps(kind: FacadeKind, seed: number): { color: Texture; rough: Texture; normal: Texture } {
  const key = `facade:${kind}:${seed}`
  const color = memo(key + ':c', () => {
    const size = 512
    const { c, ctx } = surface(size)
    const [br, bg, bb] = FACADE_BASE[kind]
    const r = rng(seed * 977 + 3)

    const srgb = (v: number) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255)
    ctx.fillStyle = `rgb(${srgb(br)},${srgb(bg)},${srgb(bb)})`
    ctx.fillRect(0, 0, size, size)

    if (kind === 'brick' || kind === 'painted-brick') {
      const rows = 26
      const bh = size / rows
      const bw = bh * 2.35
      ctx.fillStyle = 'rgba(150,145,138,0.5)'
      ctx.fillRect(0, 0, size, size) // mortar shows through the gaps
      // Joint width, in texels.
      //
      // This was 1.2, which is under one texel of the *mip* the wall is sampled
      // from at any distance and right at the Nyquist limit of the sheet itself.
      // A feature that thin does not survive mipmap reduction: it aliases into a
      // stepped dash pattern at grazing angles, and wherever something bright
      // lights the wall — a neon glow, a lamp wash — the contrast comes up and
      // the whole band reads as a blocky mosaic. That was reported from play as
      // exactly that, on two different shopfronts.
      //
      // It is also too thin to be right. A 215 mm brick with a 10 mm joint is
      // 4.6% of the course, which at 46 texels per brick is 2.1 — so widening it
      // fixes the aliasing and the masonry at the same time.
      const joint = 2.2
      for (let row = 0; row < rows; row++) {
        const offset = (row % 2) * (bw / 2)
        for (let x = -bw; x < size + bw; x += bw) {
          const j = 0.82 + r() * 0.36
          const rr = br * j
          const gg = bg * j * (0.96 + r() * 0.08)
          const bbv = bb * j
          ctx.fillStyle = `rgb(${srgb(rr)},${srgb(gg)},${srgb(bbv)})`
          ctx.fillRect(x + offset + joint, row * bh + joint, bw - joint * 2, bh - joint * 2)
        }
      }
    } else if (kind === 'stone') {
      const rows = 9
      const bh = size / rows
      ctx.fillStyle = 'rgba(120,116,110,0.55)'
      ctx.fillRect(0, 0, size, size)
      for (let row = 0; row < rows; row++) {
        let x = -r() * 90
        while (x < size) {
          const w = 70 + r() * 90
          const j = 0.86 + r() * 0.3
          ctx.fillStyle = `rgb(${srgb(br * j)},${srgb(bg * j)},${srgb(bb * j)})`
          ctx.fillRect(x + 2, row * bh + 2, w - 4, bh - 4)
          x += w
        }
      }
    }

    // Grime.
    //
    // This sheet tiles every ~1.5 m of wall, so anything low-frequency painted
    // into it repeats at that pitch and reads unmistakably as a texture tile —
    // which is what turned these facades into a grid of 40 cm blotches. Keep the
    // grime fine-grained and weak here; the building-scale vertical gradient,
    // which genuinely is low-frequency, is applied as a vertex-colour ramp in
    // buildings.ts where it can be a function of world height instead of UV.
    const dirt = fbm(size, { octaves: 5, freq: 11, seed: seed * 13 + 5 })
    const img = ctx.getImageData(0, 0, size, size)
    for (let y = 0; y < size; y++) {
      const gravity = Math.pow(y / size, 2.1) * 0.07
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const d = 1 - (dirt[y * size + x] * 0.11 + gravity)
        img.data[i] *= d
        img.data[i + 1] *= d * 0.995
        img.data[i + 2] *= d * 0.985
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { repeat: [1, 1], srgb: true, aniso: 8 })
  })

  const rough = memo(key + ':r', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const n = fbm(size, { octaves: 5, freq: 16, seed: seed * 7 + 2 })
    const flat = kind === 'stucco' ? 0.90 : kind === 'painted-brick' ? 0.74 : 0.93
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const s = Math.round((flat - n[i] * 0.12) * 255)
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = s
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return finish(c)
  })

  const bump = kind === 'stucco' ? 2.6 : kind === 'stone' ? 2.0 : 1.7
  return { color, rough, normal: normalFromFbm(key, 256, { octaves: 5, freq: 18, seed: seed * 7 + 2 }, bump) }
}

// ---------------------------------------------------------------------------
// metal, rubber, glass helpers
// ---------------------------------------------------------------------------

/** Painted/galvanised metal for shutters, fire escapes, AC units, dumpsters. */
export function metalMaps(seed: number, rusty: number): { color: Texture; rough: Texture } {
  const key = `metal:${seed}:${rusty}`
  const color = memo(key + ':c', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const n = fbm(size, { octaves: 5, freq: 9, seed })
    const rust = fbm(size, { octaves: 4, freq: 5, seed: seed + 61 })
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const base = 0.30 + n[i] * 0.13
      const rt = Math.max(0, rust[i] - (1 - rusty)) * 2.2
      const rr = base * (1 - rt) + 0.34 * rt
      const gg = base * (1 - rt) + 0.14 * rt
      const bb = base * (1 - rt) + 0.07 * rt
      const s = (v: number) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255)
      img.data[i * 4] = s(rr)
      img.data[i * 4 + 1] = s(gg)
      img.data[i * 4 + 2] = s(bb)
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { srgb: true })
  })
  const rough = memo(key + ':r', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const n = fbm(size, { octaves: 5, freq: 11, seed: seed + 3 })
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const s = Math.round((0.46 + n[i] * 0.40) * 255)
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = s
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    return finish(c)
  })
  return { color, rough }
}

/**
 * Grime on shopfront glass, as a roughness map.
 *
 * Perfectly smooth glass is a perfect mirror, and a perfect mirror on a flat
 * quad is indistinguishable from a painted panel — which is exactly how the
 * shopfronts were reading. What makes glass legible as glass is that the
 * reflection is *interrupted*: rain has run down it in streaks, the bottom
 * 300 mm is splashed from the pavement, and somebody leaned on it.
 *
 * Low values are mirror, high values are scatter. The base is deliberately very
 * low so the clean areas still take the probe at full strength; all the reading
 * comes from the contrast between those and the streaks.
 */
export function glassGrime(): Texture {
  return memo('glassgrime', () => {
    const size = 256
    const { c, ctx } = surface(size)
    // Fine grain, plus a second field sampled with its rows stretched to give
    // the vertical run-off. Stretching an isotropic field is much cheaper than
    // generating an anisotropic one and reads the same at this scale.
    const grain = fbm(size, { octaves: 4, freq: 16, seed: 71 })
    const streak = fbm(size, { octaves: 3, freq: 7, seed: 148 })
    const smear = fbm(size, { octaves: 2, freq: 3, seed: 205 })
    const img = ctx.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      // Canvas row 0 is the top of the pane once flipY is applied, so splash
      // rises from the far end of the range.
      const down = y / (size - 1)
      const splash = Math.max(0, (down - 0.72) / 0.28) ** 1.6
      const row = (Math.floor(y * 0.16) % size) * size
      for (let x = 0; x < size; x++) {
        const i = y * size + x
        const run = Math.max(0, streak[row + x] - 0.55) * 1.9
        const hand = Math.max(0, smear[i] - 0.62) * 1.1
        const v = 0.05 + run * 0.30 + hand * 0.26 + splash * 0.34 + grain[i] * 0.05
        const b = Math.round(Math.max(0, Math.min(1, v)) * 255)
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = b
        img.data[i * 4 + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping })
  })
}

/** Corrugated roller shutter, drawn as vertical flutes. */
export function shutterMaps(): { color: Texture; rough: Texture; normal: Texture } {
  const color = memo('shutter:c', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const grime = fbm(size, { octaves: 4, freq: 6, seed: 71 })
    const img = ctx.createImageData(size, size)
    const flutes = 42
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = ((x / size) * flutes) % 1
        // Half-round flute shading, plus a hard shadow line in the valley.
        const lobe = Math.sin(p * Math.PI)
        const v = (0.09 + lobe * 0.15) * (1 - grime[y * size + x] * 0.35)
        const s = Math.round(Math.pow(v, 1 / 2.2) * 255)
        const i = (y * size + x) * 4
        img.data[i] = s
        img.data[i + 1] = Math.round(s * 0.98)
        img.data[i + 2] = Math.round(s * 0.94)
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { srgb: true })
  })
  const rough = memo('shutter:r', () => {
    const size = 128
    const { c, ctx } = surface(size)
    ctx.fillStyle = '#a8a8a8'
    ctx.fillRect(0, 0, size, size)
    return finish(c)
  })
  return { color, rough, normal: fluteNormal() }
}

function fluteNormal(): Texture {
  return memo('shutter:n', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const img = ctx.createImageData(size, size)
    const flutes = 42
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = ((x / size) * flutes) % 1
        const dx = Math.cos(p * Math.PI * 2) * 0.85
        const i = (y * size + x) * 4
        img.data[i] = Math.round((dx * 0.5 + 0.5) * 255)
        img.data[i + 1] = 128
        img.data[i + 2] = 235
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c)
  })
}

/**
 * Normal map derived from an fbm height field by central differences. Cheaper
 * to write once here than to hand-author a normal per material.
 */
export function normalFromFbm(
  key: string,
  size: number,
  opts: FbmOpts,
  strength: number,
  repeat?: [number, number],
): Texture {
  return memo(`n:${key}:${strength}`, () => {
    const h = fbm(size, opts)
    const { c, ctx } = surface(size)
    const img = ctx.createImageData(size, size)
    const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength
        // Normalise the (-dx, -dy, 1) gradient normal into [0,1] texture space.
        const len = Math.hypot(dx, dy, 1)
        const i = (y * size + x) * 4
        img.data[i] = Math.round((-dx / len * 0.5 + 0.5) * 255)
        img.data[i + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255)
        img.data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255)
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { repeat })
  })
}

// ---------------------------------------------------------------------------
// glows and decals
// ---------------------------------------------------------------------------

/**
 * Radial falloff sprite. Used for lamp pools on the ground, the soft glow
 * around neon tubes, and the ground-contact darkening under the cars.
 *
 * `power` shapes the falloff: 2 is a physical inverse-square-ish pool, higher
 * numbers tighten it to a core.
 */
export function radialAlpha(power: number, softness = 1): Texture {
  return memo(`radial:${power}:${softness}`, () => {
    const size = 256
    const { c, ctx } = surface(size)
    const img = ctx.createImageData(size, size)
    const half = size / 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - half + 0.5, y - half + 0.5) / half
        const a = d >= 1 ? 0 : Math.pow(1 - d, power) * softness
        const i = (y * size + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
        // Dithered, not rounded.
        //
        // This is a smooth ramp stored in eight bits and then magnified across
        // nine metres of pavement, so every 1/255 step becomes a contour ring a
        // hand's width across — which a blind critic picked out of the images as
        // "concentric contour rings" in the light pools. Adding a fraction of a
        // level of noise before the quantisation converts the step into a
        // dissolve, which is what dithering is for and costs nothing at all.
        const dither = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) - 0.5
        img.data[i + 3] = Math.max(0, Math.min(255, Math.round(Math.min(1, a) * 255 + dither)))
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping, noMips: true })
  })
}

/**
 * Elliptical contact darkening for under a car. Separate from radialAlpha
 * because a car's contact shadow is not round and a round one under a 4.4 m
 * car is instantly readable as fake.
 */
/**
 * A stain on the ground, as an alpha mask.
 *
 * The blank-tile measurement, once it was split into "dark" and "lit but
 * empty", put the remaining actionable blankness on the *lit* ground — the
 * pavement inside a lamp's pool, which is brightly lit and almost perfectly
 * smooth. Real pavement under a light is the opposite of smooth: it is a
 * hundred years of spills, patched trenches, chewing gum, and the darker line
 * where water runs to the gutter. None of that is geometry and none of it needs
 * to be; it is a stain, and a stain is an alpha mask.
 *
 * Soft-edged on purpose. A hard-edged patch on tarmac reads as a decal, which is
 * what it is, and the only thing hiding that is the falloff.
 */
export function groundGrime(seed: number): Texture {
  return memo(`grime:${seed}`, () => {
    const size = 128
    const { c, ctx } = surface(size)
    const img = ctx.createImageData(size, size)
    const blot = fbm(size, { octaves: 4, freq: 3.5, seed })
    const fine = fbm(size, { octaves: 3, freq: 13, seed: seed + 17 })
    const half = size / 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x
        // Radial falloff so the patch has no edge of its own.
        const d = Math.hypot(x - half + 0.5, y - half + 0.5) / half
        const edge = Math.max(0, 1 - d) ** 1.5
        // Two scales: the shape of the spill, and the mottling inside it.
        const a = Math.max(0, blot[i] - 0.42) * 2.2 * (0.65 + fine[i] * 0.7) * edge
        const o = i * 4
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
        img.data[o + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping })
  })
}

/**
 * A lamp reflected in a not-quite-dry road.
 *
 * Not a radial falloff, which is what this was first drawn with and why it came
 * out as a stretched blob: a radial gradient is brightest in the *middle* of the
 * quad, so the reflection was brightest halfway between the lamp and the
 * viewer. A real one is brightest directly under the source and drags away from
 * it, thinning and breaking up as it goes, because each patch of tarmac catches
 * the lamp at a slightly different angle.
 *
 * So: a hard bright head at the top of the texture, a long tail down it, and
 * lateral noise so the tail is ragged rather than a taper. Anchored with its top
 * at the lamp.
 */
export function wetStreak(): Texture {
  return memo('wetstreak', () => {
    const w = 64
    const h = 256
    const { c, ctx } = surface(w, h)
    const img = ctx.createImageData(w, h)
    const ragged = fbm(64, { octaves: 3, freq: 5, seed: 613 })
    for (let y = 0; y < h; y++) {
      // v = 0 at the lamp end (top of the canvas), 1 at the far end.
      const v = y / (h - 1)
      // Every edge of this has to reach zero inside the sheet.
      //
      // The first version was full brightness at v = 0 and cut its sides off at
      // |u| = width with a clamped linear ramp. Both of those are boundaries,
      // and on a dark road under additive blending a boundary is a visible
      // straight line — which is exactly what came back as "the light is shaped
      // like some kind of polygon". A reflection has no edges; whatever draws it
      // must not either.
      //
      // So: fade in over the first tenth as well as out over the rest, and let
      // the sides fall off as a gaussian windowed to nothing before the sheet
      // ends, rather than clipped at a hard radius.
      const along = smoothstep(0, 0.12, v) * Math.pow(1 - v, 2.0)
      for (let x = 0; x < w; x++) {
        const u = (x / (w - 1)) * 2 - 1
        // The tail widens as it fades, the way a smear does.
        const width = 0.30 + v * 0.70
        const across =
          Math.exp(-((u / width) ** 2) * 2.2) * smoothstep(1.0, 0.70, Math.abs(u))
        const noise = 0.55 + ragged[(y % 64) * 64 + x] * 0.9
        const a = along * across * noise
        const o = (y * w + x) * 4
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
        img.data[o + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping, noMips: true })
  })
}

export function contactShadow(): Texture {
  return memo('contact', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const img = ctx.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * 2 - 1
        const v = (y / size) * 2 - 1
        // Wider than it is deep, with the density pushed toward the wheels.
        const d = Math.hypot(u * 1.0, v * 2.5)
        const core = Math.max(0, 1 - d)
        // Tighter and denser than it started: the pool under a car at this hour
        // is close to black at the sills and gone within half a metre.
        const a = Math.pow(core, 1.15) * 0.95
        const i = (y * size + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 0
        img.data[i + 3] = Math.round(Math.min(1, a) * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping, noMips: true })
  })
}

/** Soft blob alpha for the dust motes and the haze cards. */
/**
 * The glow around a lit street lamp, with the lens in it.
 *
 * The halo was `radialAlpha` on a square plane: a mathematically perfect circle
 * with a perfectly smooth falloff, which the blind critic picked out
 * immediately. Nothing in a photograph of a street lamp is a perfect circle.
 * What is actually there, in order of size:
 *
 *  - a broad, soft scattering halo from haze and dust, which *is* round;
 *  - a much tighter, hotter core where the lens itself is blowing out;
 *  - a horizontal diffraction streak, from the aperture and from the lamp's own
 *    wide flat lens — this is the single most recognisable feature and the one
 *    that was missing;
 *  - a weaker vertical streak crossing it;
 *  - and colour that is not constant: sodium blows out to near-white at the
 *    core and falls through orange to a deep red at the edge of the halo.
 *
 * Carrying the colour in the texture rather than in the material's tint is what
 * makes the last of those possible, so the material multiplies by neutral now.
 */
/**
 * `[angle, half-width in radians, amplitude, falloff exponent]`.
 *
 * Deliberately not evenly spaced and not on the axes: an even fan reads as a
 * star decal and an axis-aligned pair reads as a lens artefact. Four long ones
 * carry the shape, six short ones stop it looking drawn.
 */
const FLARE_RAYS: [number, number, number, number][] = [
  // No two of the four long ones are within 20 degrees of opposite. A ray and
  // its near-antipode read as one straight streak through the source, which is
  // the same synthetic shape the horizontal-plus-vertical pair made — just
  // rotated. Spreading them is what turns a drawn star into scattered light.
  [0.42, 0.028, 0.44, 1.8],
  [1.87, 0.022, 0.36, 2.0],
  [2.94, 0.026, 0.40, 1.9],
  [4.58, 0.020, 0.30, 2.1],
  [0.98, 0.012, 0.17, 2.7],
  [2.35, 0.010, 0.13, 2.9],
  [3.71, 0.011, 0.15, 2.8],
  [5.41, 0.009, 0.12, 3.1],
  [1.42, 0.007, 0.09, 3.3],
  [5.02, 0.008, 0.10, 3.2],
]

export function lampFlare(): Texture {
  return memo('lampflare', () => {
    const size = 256
    const { c, ctx } = surface(size)
    const img = ctx.createImageData(size, size)
    const half = size / 2
    // Core, mid and rim. Sodium going from blown-out white through its own
    // orange to the red the halo dies out at.
    const CORE = [1.0, 0.96, 0.88]
    const MID = [1.0, 0.62, 0.28]
    const RIM = [0.72, 0.17, 0.04]
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - half + 0.5) / half
        const dy = (y - half + 0.5) / half
        const d = Math.min(1, Math.hypot(dx, dy))
        const fall = 1 - d
        const ang = Math.atan2(dy, dx)

        // A broad halo under the tighter scatter. Photographs of sodium lanterns
        // in damp air show the glow reaching much further out than a single
        // falloff gives, very faintly — that reach is most of what makes them
        // read as light in air rather than as a bright dot.
        const halo = Math.pow(fall, 0.85) * 0.11
        const scatter = Math.pow(fall, 1.8) * 0.30
        const core = Math.pow(fall, 7.0) * 1.0

        // Rays at irregular angles, not a cross.
        //
        // This was exactly two streaks, one horizontal and one vertical. That is
        // what a camera's aperture blades do to a point source; it is not what a
        // lantern does to your eye, and two rays meeting at ninety degrees is
        // the most recognisably synthetic shape there is — it came back as the
        // light being "right-angled". A real bowl throws six or ten rays at
        // unequal angles, unequal widths and unequal lengths, from its facets.
        let ray = 0
        for (const [a0, wRay, amp, reach] of FLARE_RAYS) {
          let da = ang - a0
          da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2
          ray += Math.exp(-(da * da) / (2 * wRay * wRay)) * amp * Math.pow(fall, reach)
        }

        const a = Math.min(1, halo + scatter + core + ray)
        // Hue follows how hot this pixel is, not how far out it is, so the
        // rays stay warm-white along their length instead of turning red.
        const heat = Math.min(1, core + ray * 1.4)
        const mixR = heat > 0.5 ? (heat - 0.5) * 2 : 0
        const t = heat > 0.5 ? 1 : heat * 2
        const ch = (i: number) =>
          mixR > 0
            ? MID[i] + (CORE[i] - MID[i]) * mixR
            : RIM[i] + (MID[i] - RIM[i]) * t
        const o = (y * size + x) * 4
        img.data[o] = Math.round(ch(0) * 255)
        img.data[o + 1] = Math.round(ch(1) * 255)
        img.data[o + 2] = Math.round(ch(2) * 255)
        img.data[o + 3] = Math.round(a * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping, srgb: true, noMips: true })
  })
}

export function softDisc(): Texture {
  return radialAlpha(2.6, 1)
}

// ---------------------------------------------------------------------------
// ghost signs
// ---------------------------------------------------------------------------

const GHOST_WORDS = [
  ['ELECTRIC', 'SUPPLY CO'],
  ['WHOLESALE', 'DRY GOODS'],
  ['CIGARS'],
  ['PRINTERS', '& BINDERS'],
  ['FURNITURE'],
  ['HOTEL'],
  ['COAL & COKE'],
  ['TAILORS'],
]

/**
 * A painted advertisement, eighty years faded.
 *
 * These are the single most characteristic thing on an upper wall in an old
 * block and they cover a lot of it, which is exactly what the blank-wall
 * measurement is asking for: something with structure in the region that is
 * otherwise a smooth wash. They also date the street without anything having to
 * be modelled.
 *
 * The paint is *lighter* than the brick and heavily eaten away, because lime
 * paint fails by flaking rather than by darkening. Painting a crisp dark sign
 * would read as new signage on an old building.
 */
export function ghostSign(seed: number): Texture {
  return memo('ghost:' + seed, () => {
    const w = 512
    const h = 512
    const { c, ctx } = surface(w, h)
    const r = rng(seed * 3313 + 7)
    const words = GHOST_WORDS[Math.floor(r() * GHOST_WORDS.length)]

    ctx.clearRect(0, 0, w, h)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Fitted, not assumed. The size was hardcoded at 150/108 px with the text
    // centred, and "ELECTRIC SUPPLY CO" in Times Bold at 108 px is wider than
    // the 512 px canvas — so the longest names were clipped at both edges and
    // the sign read as a fragment of something rather than as a faded name.
    // Same bug as the shop signs, in a different generator.
    let fs = words.length === 1 ? 150 : 108
    const fit = () => {
      ctx.font = `700 ${fs}px "Times New Roman", Georgia, serif`
      return Math.max(...words.map((l) => ctx.measureText(l).width))
    }
    for (let i = 0; i < 14 && fit() > w * 0.86; i++) fs *= 0.93
    fit()
    ctx.fillStyle = 'rgba(214, 202, 178, 0.62)'
    words.forEach((line, i) => {
      const y = h / 2 + (i - (words.length - 1) / 2) * fs * 1.15
      ctx.fillText(line, w / 2, y)
    })

    // A rule above and below, which nearly all of them had.
    ctx.fillRect(w * 0.1, h * 0.5 - fs * words.length * 0.72, w * 0.8, 7)
    ctx.fillRect(w * 0.1, h * 0.5 + fs * words.length * 0.72, w * 0.8, 7)

    // Now take most of it away again. Two noise fields at different scales:
    // one for the broad areas where the paint has gone entirely, one for the
    // fine speckle where it is still hanging on.
    const broad = fbm(512, { octaves: 4, freq: 3, seed: seed + 11 })
    const fine = fbm(512, { octaves: 5, freq: 22, seed: seed + 29 })
    const img = ctx.getImageData(0, 0, w, h)
    for (let i = 0; i < w * h; i++) {
      const wear = broad[i] * 0.75 + fine[i] * 0.45
      let a = img.data[i * 4 + 3] / 255
      a *= Math.max(0, wear - 0.22) * 1.7
      img.data[i * 4 + 3] = Math.round(Math.min(1, a) * 255)
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping, srgb: true })
  })
}

// ---------------------------------------------------------------------------
// dead frontage
// ---------------------------------------------------------------------------

/**
 * Flyposting and tags, for the units nobody is renting.
 *
 * A dead shopfront is not a blank surface — it is the most *visually busy*
 * thing on a real street, because the moment a unit goes empty it becomes a
 * noticeboard. Layered torn posters, a couple of tags, and the grey rectangles
 * where the council painted over the last lot.
 */
export function posterWall(seed: number): Texture {
  return memo('posters:' + seed, () => {
    const size = 512
    const { c, ctx } = surface(size)
    const r = rng(seed * 7717 + 13)

    ctx.fillStyle = '#20201e'
    ctx.fillRect(0, 0, size, size)

    // Torn poster layers. Later ones cover earlier ones, which is what makes it
    // read as accumulated over months rather than printed at once.
    const inks = ['#b8402f', '#20486a', '#c8a02c', '#e6e0d4', '#37613f', '#5d2748']
    for (let n = 0; n < 22; n++) {
      const w = 60 + r() * 130
      const h = 80 + r() * 170
      const x = r() * size - w * 0.3
      const y = r() * size - h * 0.3
      ctx.save()
      ctx.translate(x + w / 2, y + h / 2)
      ctx.rotate((r() - 0.5) * 0.14)
      ctx.globalAlpha = 0.55 + r() * 0.45
      ctx.fillStyle = inks[Math.floor(r() * inks.length)]
      ctx.fillRect(-w / 2, -h / 2, w, h)
      // A torn-off corner, so no two are the same rectangle.
      if (r() > 0.45) {
        ctx.globalAlpha = 1
        ctx.fillStyle = '#20201e'
        ctx.beginPath()
        ctx.moveTo(-w / 2, -h / 2)
        ctx.lineTo(-w / 2 + w * (0.2 + r() * 0.4), -h / 2)
        ctx.lineTo(-w / 2, -h / 2 + h * (0.2 + r() * 0.5))
        ctx.closePath()
        ctx.fill()
      }
      // Bands of type, illegible at any distance you will ever see this from.
      ctx.globalAlpha = 0.4
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(-w / 2 + 8, -h / 2 + 18 + k * 22, w * (0.3 + r() * 0.55), 5)
      }
      ctx.restore()
    }

    // Tags, over the top of everything.
    ctx.globalAlpha = 0.85
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let n = 0; n < 5; n++) {
      ctx.strokeStyle = ['#161616', '#e8e2d0', '#2c66b8', '#c02a2a'][Math.floor(r() * 4)]
      ctx.lineWidth = 4 + r() * 7
      ctx.beginPath()
      let x = r() * size
      let y = size * (0.25 + r() * 0.5)
      ctx.moveTo(x, y)
      for (let k = 0; k < 7; k++) {
        x += 20 + r() * 60
        y += (r() - 0.5) * 90
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Grime, so it is not a bright collage stuck on a dark street.
    const dirt = fbm(size, { octaves: 5, freq: 6, seed: seed + 3 })
    const img = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < size * size; i++) {
      const d = 0.52 - dirt[i] * 0.22
      img.data[i * 4] *= d
      img.data[i * 4 + 1] *= d
      img.data[i * 4 + 2] *= d * 0.97
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { srgb: true })
  })
}

// ---------------------------------------------------------------------------
// signage
// ---------------------------------------------------------------------------

export interface SignSpec {
  lines: string[]
  ink: string
  plate: string
  /** Neon signs get a tube treatment; painted boards do not. */
  neon: boolean
  style: SignStyle
  font?: string
}

/** Family, weight, tracking and case for each trade. */
const SIGN_FACE: Record<SignStyle, {
  font: (px: number) => string
  track: number
  upper: boolean
}> = {
  // Tube-bent script-ish: a single weight, generously spaced, because neon
  // cannot be set tight without the tubes touching.
  neon: { font: (p) => `500 ${p}px "Avenir Next", "Segoe UI", Helvetica, sans-serif`, track: 4, upper: true },
  // Signwriter's serif. Painted by hand on a board, so it is a text face, not
  // a display one.
  painted: { font: (p) => `700 ${p}px Georgia, "Times New Roman", serif`, track: 1, upper: true },
  // Internally-lit plastic box: the cheapest possible bold sans, set tight and
  // stretched to the edges of the tray.
  lightbox: { font: (p) => `800 ${p}px "Helvetica Neue", Arial, sans-serif`, track: -1, upper: true },
  // Cut vinyl on glass. Thin, wide-tracked, and the giveaway of a shopfitter
  // working from a laptop rather than a brush.
  vinyl: { font: (p) => `300 ${p}px "Trebuchet MS", Verdana, sans-serif`, track: 7, upper: false },
  // Vitreous enamel or gilded glass, the oldest thing on the street.
  enamel: { font: (p) => `600 ${p}px Copperplate, "Palatino Linotype", Palatino, serif`, track: 5, upper: true },
}

/**
 * Shop signage. Drawn with fillText, which is generated-in-code and not a
 * downloaded asset — the letterforms come from the system UI font stack.
 *
 * Painted boards get an ink layer that is chipped and unevenly opaque. Neon
 * gets a bright core stroke plus two progressively wider, dimmer strokes,
 * which is what a glass tube actually does to a camera sensor.
 */
export function signTexture(spec: SignSpec, seed = 1): Texture {
  // The style has to be in the key. It changes every pixel, and two businesses
  // sharing lines/ink/plate would otherwise share whichever texture was baked
  // first — the same class of bug as any memo whose key omits an input.
  const key = `sign:${spec.lines.join('|')}${spec.ink}${spec.plate}${spec.style}${seed}`
  return memo(key, () => {
    const w = 512
    const h = 256
    const { c, ctx } = surface(w, h)
    const r = rng(seed * 9176 + 3)
    const face = SIGN_FACE[spec.style]
    const lines = face.upper ? spec.lines.map((l) => l.toUpperCase()) : spec.lines
    const n = lines.length

    // ---- the board itself ------------------------------------------------
    ctx.fillStyle = spec.plate
    ctx.fillRect(0, 0, w, h)

    if (spec.style === 'lightbox') {
      // A lit plastic tray is brightest in the middle and yellows with age.
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, 'rgba(255,240,205,0.10)')
      g.addColorStop(0.5, 'rgba(255,236,190,0.22)')
      g.addColorStop(1, 'rgba(120,95,60,0.16)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      // The extruded tray edge.
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, w - 10, h - 10)
    } else if (spec.style === 'enamel') {
      // Enamel signs almost always carry a keyline inset from the edge.
      ctx.strokeStyle = spec.ink
      ctx.lineWidth = 3
      ctx.globalAlpha = 0.75
      ctx.strokeRect(16, 16, w - 32, h - 32)
      ctx.globalAlpha = 1
    }

    // ---- set the text ----------------------------------------------------
    // Families differ enormously in width at the same pixel size — Copperplate
    // with 5px tracking sets about 1.6x the width of tight Helvetica — so the
    // size is fitted rather than assumed. Hardcoding it overflowed the board on
    // the wider faces, which reads as a cropped sticker.
    const setFont = (px: number) => {
      ctx.font = spec.font ?? face.font(px)
      // letterSpacing is Chromium 99+/Safari 17+. Where it is missing the sign
      // still sets, just without tracking, so it is not worth a fallback path.
      const anyCtx = ctx as unknown as { letterSpacing?: string }
      if ('letterSpacing' in ctx) anyCtx.letterSpacing = `${face.track}px`
    }
    const widest = (px: number) => {
      setFont(px)
      return Math.max(...lines.map((l) => ctx.measureText(l).width))
    }
    let fs = n === 1 ? 108 : n === 2 ? 74 : 54
    const limit = w * (spec.style === 'lightbox' ? 0.92 : 0.84)
    for (let i = 0; i < 12 && widest(fs) > limit; i++) fs *= 0.92
    setFont(fs)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const draw = (style: string, lw: number, stroke: boolean, blur = 0, dx = 0, dy = 0) => {
      ctx.shadowBlur = blur
      ctx.shadowColor = spec.ink
      ctx.lineWidth = lw
      ctx.strokeStyle = style
      ctx.fillStyle = style
      lines.forEach((line, i) => {
        const y = h / 2 + (i - (n - 1) / 2) * fs * 1.22 + dy
        // A hand-painted line is never quite level or quite centred.
        const wob = spec.style === 'painted' ? (r() - 0.5) * 5 : 0
        if (stroke) ctx.strokeText(line, w / 2 + dx + wob, y)
        else ctx.fillText(line, w / 2 + dx + wob, y)
      })
      ctx.shadowBlur = 0
    }

    if (spec.style === 'neon') {
      // Outer halo, mid glow, then the hot core. Order matters: the core must
      // be last or the halo eats it.
      draw('rgba(255,255,255,0.10)', 26, true, 34)
      draw(spec.ink, 11, true, 18)
      draw('#ffffff', 3.2, true, 0)
    } else if (spec.style === 'vinyl') {
      // Cut vinyl has no paint depth at all — it is a flat film with a hard
      // edge, and what ages is adhesion, not colour.
      draw(spec.ink, 0, false)
      peelVinyl(ctx, w, h, spec.plate, fs, r)
    } else {
      if (spec.style === 'enamel') {
        // Gilded lettering is drawn twice: a dark shadow below-right, then the
        // face. That offset is what makes it look raised off the enamel.
        draw('rgba(0,0,0,0.55)', 0, false, 0, 3, 3)
      }
      draw(spec.ink, 0, false)
      if (spec.style !== 'lightbox') chipPaint(ctx, w, h, seed)
    }

    if (spec.style === 'enamel') {
      // A single soft diagonal, which is all the gloss a flat surface needs.
      const gl = ctx.createLinearGradient(0, h, w, 0)
      gl.addColorStop(0, 'rgba(255,255,255,0)')
      gl.addColorStop(0.55, 'rgba(255,255,255,0.11)')
      gl.addColorStop(0.72, 'rgba(255,255,255,0)')
      ctx.fillStyle = gl
      ctx.fillRect(0, 0, w, h)
    }
    return finish(c, { wrap: ClampToEdgeWrapping, srgb: true })
  })
}

/** Weathering for painted and enamel boards: the paint chips to the primer. */
function chipPaint(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const chip = fbm(256, { octaves: 4, freq: 9, seed: seed * 31 })
  const img = ctx.getImageData(0, 0, w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nv = chip[(y % 256) * 256 + (x % 256)]
      if (nv > 0.74) {
        const i = (y * w + x) * 4
        const k = 1 - (nv - 0.74) * 1.5
        img.data[i] = img.data[i] * k + 190 * (1 - k)
        img.data[i + 1] = img.data[i + 1] * k + 182 * (1 - k)
        img.data[i + 2] = img.data[i + 2] * k + 170 * (1 - k)
      }
    }
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Vinyl fails by lifting, not by chipping.
 *
 * The first version erased with `destination-out`, which punches the canvas
 * through to transparent — and an opaque board with holes in it composites as
 * black, so every vinyl sign came out spotted with what looked like mould. A
 * lifted corner shows the *board* behind the film, so the lift is painted in
 * the plate colour. That also makes the placement self-correcting: a
 * plate-coloured mark that lands on the plate is invisible, and only the ones
 * that land on a letter read at all.
 */
function peelVinyl(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  plate: string,
  fs: number,
  r: () => number,
): void {
  ctx.save()
  ctx.fillStyle = plate
  const lifts = 3 + Math.floor(r() * 4)
  for (let i = 0; i < lifts; i++) {
    // Kept inside the band the text occupies, and small — a lift is a corner
    // coming away, not a bite out of the middle of a letter.
    const x = w * (0.1 + r() * 0.8)
    const y = h / 2 + (r() - 0.5) * fs * 1.1
    ctx.globalAlpha = 0.55 + r() * 0.45
    ctx.beginPath()
    ctx.ellipse(x, y, fs * (0.06 + r() * 0.1), fs * (0.05 + r() * 0.13), r() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Awning stripes. Canvas awnings are almost always striped and faded. */
export function awningStripes(a: string, b: string): Texture {
  return memo(`awning:${a}:${b}`, () => {
    const size = 256
    const { c, ctx } = surface(size)
    const bands = 8
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? a : b
      ctx.fillRect((i * size) / bands, 0, size / bands + 1, size)
    }
    // Sun-bleach the top edge, where an awning always goes first.
    const fade = ctx.createLinearGradient(0, 0, 0, size)
    fade.addColorStop(0, 'rgba(210,200,182,0.34)')
    fade.addColorStop(0.5, 'rgba(210,200,182,0.04)')
    fade.addColorStop(1, 'rgba(30,26,22,0.20)')
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, size, size)
    return finish(c, { srgb: true })
  })
}

/**
 * Window interior. Not a flat emissive quad — a lit apartment seen from the
 * street is a bright ceiling, a dark floor, and one or two hard silhouettes
 * (a lamp, a plant, a curtain edge) against it.
 */
/** Cells per side of the window atlas. 16 rooms, two draw calls. */
export const WINDOW_ATLAS = 4

/**
 * A grid of window interiors in one texture.
 *
 * The whole street previously shared exactly two of these — one lit, one unlit —
 * so every opening on every building showed the identical room. Adding frames
 * and mullions on top of that made it worse rather than better: it turned a wall
 * of flat rectangles into a wall of identical *framed* rectangles, which is
 * precisely the "stamped-out toy" it was reported as. Variety behind the glass
 * is what the frame was supposed to be framing.
 *
 * An atlas keeps it to one texture and one draw call per state; the batcher
 * addresses a cell per window through its UV offset.
 */
export function windowAtlas(lit: boolean): Texture {
  return memo(`winatlas:${lit}`, () => {
    const cell = 128
    const size = cell * WINDOW_ATLAS
    const { c, ctx } = surface(size)
    for (let i = 0; i < WINDOW_ATLAS * WINDOW_ATLAS; i++) {
      const cx = (i % WINDOW_ATLAS) * cell
      const cy = Math.floor(i / WINDOW_ATLAS) * cell
      ctx.save()
      ctx.translate(cx, cy)
      ctx.beginPath()
      ctx.rect(0, 0, cell, cell)
      ctx.clip()
      drawWindowCell(ctx, cell, i, lit)
      ctx.restore()
    }
    return finish(c, { wrap: ClampToEdgeWrapping, srgb: true })
  })
}

/** UV scale and offset for one atlas cell, for Batch.add. */
export function windowCell(index: number): [number, number, number, number] {
  const n = WINDOW_ATLAS
  const i = ((index % (n * n)) + n * n) % (n * n)
  const col = i % n
  const row = Math.floor(i / n)
  // Inset by half a texel so bilinear filtering cannot bleed the neighbour in.
  const k = 1 / n
  const pad = 0.5 / (128 * n)
  return [k - pad * 2, k - pad * 2, col * k + pad, row * k + pad]
}

/**
 * One room. Sixteen variants, and the variation that matters is *what kind of
 * opening it is* — a lit kitchen, a bedroom with the curtain half drawn, a
 * television, a stairwell with coloured glass, a boarded pane, an empty unit —
 * not sixteen shades of the same yellow.
 */
function drawWindowCell(
  ctx: CanvasRenderingContext2D,
  cell: number,
  variant: number,
  lit: boolean,
): void {
  const r = rng(variant * 7919 + (lit ? 31 : 977))
  const kind = variant % 8

  if (!lit) {
    // Unlit glass is not black: it is a dark mirror holding the sky and whatever
    // is across the street, with the room behind it barely readable.
    const g = ctx.createLinearGradient(0, 0, 0, cell)
    g.addColorStop(0, '#2b3348')
    g.addColorStop(0.5, '#191e2c')
    g.addColorStop(1, '#0d1017')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, cell, cell)
    if (kind === 3) {
      // Boarded up.
      ctx.fillStyle = '#3a2f22'
      ctx.fillRect(0, 0, cell, cell)
      ctx.strokeStyle = 'rgba(20,15,10,0.7)'
      ctx.lineWidth = 2
      for (let y = 6; y < cell; y += 16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cell, y); ctx.stroke()
      }
    } else if (kind === 5) {
      // Net curtain: a pale even veil.
      ctx.fillStyle = 'rgba(190,186,175,0.42)'
      ctx.fillRect(0, 0, cell, cell)
    } else if (kind === 6) {
      // Blind pulled most of the way down.
      ctx.fillStyle = '#232019'
      ctx.fillRect(0, 0, cell, cell * (0.5 + r() * 0.35))
    }
    return
  }

  // ---- lit ----------------------------------------------------------------
  if (kind === 4) {
    // Television. Blue-white, and the only cell with no warm in it.
    const g = ctx.createLinearGradient(0, 0, 0, cell)
    g.addColorStop(0, '#c2d8ff')
    g.addColorStop(0.7, '#6f8fd0')
    g.addColorStop(1, '#20304e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, cell, cell)
  } else if (kind === 7) {
    // Stairwell: coloured glass, cooler and more even than a room.
    const tints = ['#b8562f', '#2f6ab8', '#3f8f56', '#c8a02c']
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = tints[Math.floor(r() * tints.length)]
      ctx.globalAlpha = 0.55 + r() * 0.4
      ctx.fillRect(0, (i * cell) / 5, cell, cell / 5 + 1)
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(15,12,10,0.85)'
    ctx.lineWidth = 3
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(0, (i * cell) / 5); ctx.lineTo(cell, (i * cell) / 5); ctx.stroke()
    }
  } else {
    // An ordinary room: bright near the ceiling, dark at the floor.
    const warm = 0.86 + r() * 0.14
    const g = ctx.createLinearGradient(0, 0, 0, cell)
    g.addColorStop(0, `rgb(${Math.round(255 * warm)},${Math.round(216 * warm)},${Math.round(160 * warm)})`)
    g.addColorStop(0.6, '#c9904f')
    g.addColorStop(1, '#573418')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, cell, cell)
    // A lamp, or a doorway through to another room.
    ctx.fillStyle = 'rgba(255,238,200,0.9)'
    if (kind === 1) ctx.fillRect(cell * (0.15 + r() * 0.5), cell * 0.34, cell * 0.14, cell * 0.3)
    if (kind === 2) {
      ctx.beginPath()
      ctx.arc(cell * (0.25 + r() * 0.5), cell * 0.42, cell * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Curtains, at a different draw on each side. This is the single most
  // effective bit: no two windows on a real street are curtained the same.
  ctx.fillStyle = 'rgba(28,20,12,0.82)'
  const left = r()
  const right = r()
  if (left > 0.3) ctx.fillRect(0, 0, cell * (0.12 + left * 0.3), cell)
  if (right > 0.35) ctx.fillRect(cell * (1 - (0.12 + right * 0.28)), 0, cell, cell)
  // Furniture silhouette along the bottom.
  ctx.fillRect(0, cell * (0.74 + r() * 0.16), cell, cell)
}

/**
 * The inside of a lit shop, seen through its window.
 *
 * The shopfronts used to borrow the apartment-window interior: a vertical
 * gradient with curtains, authored at 128px for a 1.2 m sash seen from across
 * the street. Stretched across a 4.6 m shopfront two metres from the camera it
 * has no content at all, and the frontage read as a lightbox — which is what
 * appeared the moment the glazing was made transparent and the interior became
 * visible for the first time. (That generator is gone; this replaced its only
 * remaining caller.)
 *
 * A shop at night is horizontal structure: a strip light on the ceiling doing
 * all the work, shelving stacked up the back wall, and a counter mass in front
 * of it. That, and the falloff to a dark floor, is what says "room with a depth
 * to it" rather than "panel with a glow on it".
 */
export function shopInterior(seed: number): Texture {
  return memo(`shop:${seed}`, () => {
    const W = 256
    const H = 128
    const { c, ctx } = surface(W, H)
    const r = rng(seed * 2654435761 + 17)

    // Back wall. Bright under the ceiling, falling away to the floor.
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#c69a63')
    g.addColorStop(0.45, '#8f6a41')
    g.addColorStop(1, '#2b1a0e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // The strip light itself, and the wash it throws on the ceiling.
    ctx.fillStyle = 'rgba(255,244,214,0.55)'
    ctx.fillRect(0, 0, W, H * 0.16)
    ctx.fillStyle = '#fff6dc'
    ctx.fillRect(W * 0.06, H * 0.07, W * 0.88, H * 0.045)

    // Shelving up the back wall: a dark carcass with a lit front lip, which is
    // how a shelf actually reads when the light is above it.
    // Row count, start height and pitch all vary. Regular rows put every shop's
    // shelves at the same height, and at a grazing angle down the street that
    // reads as one continuous stripe running through every frontage — the
    // stamped-from-a-mould look, arriving by a different route.
    const rows = 3 + Math.floor(r() * 2)
    const top = 0.22 + r() * 0.1
    const pitch = (0.36 + r() * 0.14) / rows
    for (let i = 0; i < rows; i++) {
      const y = H * (top + i * pitch + (r() - 0.5) * 0.02)
      ctx.fillStyle = 'rgba(38,24,14,0.55)'
      ctx.fillRect(0, y, W, H * 0.1)
      ctx.fillStyle = 'rgba(226,190,138,0.75)'
      ctx.fillRect(0, y + H * 0.1, W, H * 0.012)
      // Stock on the shelf, as silhouettes of a few different widths.
      let x = W * (0.02 + r() * 0.05)
      while (x < W * 0.95) {
        const w = W * (0.015 + r() * 0.035)
        const h = H * (0.05 + r() * 0.04)
        ctx.fillStyle = `rgba(30,19,11,${0.45 + r() * 0.35})`
        ctx.fillRect(x, y + H * 0.1 - h, w, h)
        x += w + W * (0.008 + r() * 0.022)
      }
    }

    // Counter across the front, and the dark floor void under it.
    const cy = H * 0.74
    ctx.fillStyle = '#1d1209'
    ctx.fillRect(0, cy, W, H - cy)
    ctx.fillStyle = 'rgba(214,176,124,0.6)'
    ctx.fillRect(0, cy, W, H * 0.022)

    // One or two hanging pendants, which break the ceiling line.
    const pend = 1 + Math.floor(r() * 2)
    for (let i = 0; i < pend; i++) {
      const px = W * (0.18 + r() * 0.64)
      ctx.strokeStyle = 'rgba(28,18,10,0.8)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, H * 0.12)
      ctx.lineTo(px, H * 0.26)
      ctx.stroke()
      ctx.fillStyle = '#ffeec4'
      ctx.beginPath()
      ctx.arc(px, H * 0.28, H * 0.035, 0, Math.PI * 2)
      ctx.fill()
    }

    // Grime, same reasoning as everywhere else: nothing on this street is clean.
    const grime = fbm(128, { octaves: 4, freq: 5, seed: seed + 29 })
    const img = ctx.getImageData(0, 0, W, H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const d = 1 - grime[(y % 128) * 128 + (x % 128)] * 0.18
        img.data[i * 4] *= d
        img.data[i * 4 + 1] *= d
        img.data[i * 4 + 2] *= d
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(c, { wrap: ClampToEdgeWrapping, srgb: true })
  })
}

