// Gothic oak stacks (DESIGN §9 Room): double-height cases on both long walls (3.2 m lower tier,
// balustraded gallery at 3.4 m, 3.0 m upper tier with pointed-arch crowns and finials), a low
// case under the north lancets, and six freestanding double-sided presses with busts. All
// carcass parts go into the shared static Batch; the shelves are returned as ShelfRuns for Books.
import * as THREE from 'three'
import { Batch, REGION, T, extrude, lancetPath, lancetShape, lathe, spandrelShape } from './Kit.ts'
import type { Region } from './Kit.ts'
import { FIRE_HALF, FIRE_Z, GALLERY_Y, HALL, LOWER_FACE, PRESS_HALF, PRESS_IN, PRESS_Z, STACK_S, UPPER_FACE } from './Layout.ts'

export type Tier = 'lower' | 'upper' | 'press' | 'north'

/** One shelf compartment: local x along [0,len], y up from the shelf top, z out (z = depth is the shelf front). */
export interface ShelfRun { m: THREE.Matrix4; len: number; clear: number; depth: number; tier: Tier }

interface Face {
  origin: [number, number] // world x,z of the back-left corner
  out: [number, number] // outward unit normal in xz
  len: number
  y0: number
  h: number
  depth: number
  shelves: number
  plinth: number
  top: number
  bay: number
  spandrel: boolean
  cornice: boolean
  crest: boolean
  chain: boolean
  tier: Tier
}

const WOOD = 0xb89c80 // carcass tint over the oak texture
const WOOD_DARK = 0x8a7258
const BACK = 0x4a3a2e // shelf backs: dark, books cover them
const REG: Region = REGION.shelves

export const STACK_N = HALL.zN + 0.05

function faceMatrix(f: Face): THREE.Matrix4 {
  const x = new THREE.Vector3(f.out[1], 0, -f.out[0])
  const z = new THREE.Vector3(f.out[0], 0, f.out[1])
  return new THREE.Matrix4().makeBasis(x, new THREE.Vector3(0, 1, 0), z).setPosition(f.origin[0], 0, f.origin[1])
}

function lbox(b: Batch, key: string, M: THREE.Matrix4, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  tint: THREE.ColorRepresentation, region: Region = REG): void {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  b.add(key, g, M, tint, region)
}

const FINIAL: [number, number][] = [[0.034, 0], [0.034, 0.05], [0.026, 0.06], [0.018, 0.08], [0.03, 0.12], [0.028, 0.14], [0.012, 0.22], [0.005, 0.31], [0, 0.33]]

function face(b: Batch, f: Face, runs: ShelfRun[]): void {
  const M = faceMatrix(f)
  const { len, y0, h, depth, plinth, top } = f
  const yTop = y0 + h
  const nb = Math.max(1, Math.round(len / f.bay)), bw = len / nb
  const S = 0.035 // half upright
  lbox(b, 'oakV', M, 0, y0, 0, len, yTop, 0.02, BACK)
  lbox(b, 'oakV', M, 0, y0, 0.015, len, y0 + plinth, depth + 0.03, WOOD_DARK) // plinth
  lbox(b, 'oakV', M, -0.005, y0, depth + 0.03, len + 0.005, y0 + 0.03, depth + 0.045, WOOD_DARK) // toe moulding
  for (let i = 0; i <= nb; i++) {
    const x = Math.min(len - S, Math.max(S, i * bw))
    lbox(b, 'oakV', M, x - S, y0 + plinth, 0, x + S, yTop - (f.cornice ? top * 0.5 : 0), depth + 0.022, WOOD)
    // a thin applied bead on the stile face
    lbox(b, 'oakV', M, x - 0.012, y0 + plinth + 0.04, depth + 0.022, x + 0.012, yTop - top - 0.03, depth + 0.03, WOOD_DARK)
  }
  const pitch = (h - plinth - top) / f.shelves
  for (let k = 0; k < f.shelves; k++) {
    const y = y0 + plinth + k * pitch
    if (k > 0) {
      lbox(b, 'oakV', M, 0, y - 0.026, 0.02, len, y, depth, WOOD)
      lbox(b, 'oakV', M, 0, y - 0.034, depth - 0.004, len, y + 0.004, depth + 0.012, WOOD_DARK) // front lip
    }
    for (let i = 0; i < nb; i++) {
      const x0 = i * bw + S, x1 = (i + 1) * bw - S
      runs.push({ m: M.clone().multiply(T(x0, y, 0)), len: x1 - x0, clear: pitch - 0.03, depth, tier: f.tier })
      if (f.chain) { // brass chain rod along the shelf front, on two tiny brackets
        const [g, m] = rodX(x0, x1, y + 0.035, depth + 0.02, 0.0065)
        b.add('brassV', g, M.clone().multiply(m), 0xffffff, REG)
      }
    }
  }
  // frieze under the top
  lbox(b, 'oakV', M, 0, yTop - top, 0.02, len, yTop - top * 0.35, depth + 0.03, WOOD)
  if (f.spandrel) {
    const fh = Math.min(0.36, pitch * 0.55)
    for (let i = 0; i < nb; i++) {
      const w = bw - 2 * S
      const g = extrude(spandrelShape(w, fh, fh * 0.8, w * 0.72), 0.022)
      b.add('oakV', g, M.clone().multiply(T(i * bw + bw / 2, yTop - top - fh, depth - 0.006)), WOOD, REG)
    }
  }
  if (f.cornice) {
    lbox(b, 'oakV', M, -0.03, yTop - top * 0.35, 0.02, len + 0.03, yTop - 0.04, depth + 0.07, WOOD)
    lbox(b, 'oakV', M, -0.05, yTop - 0.045, 0.02, len + 0.05, yTop, depth + 0.1, WOOD_DARK)
  }
  if (f.crest) crest(b, M, len, nb, bw, yTop, depth + 0.03)
}

function crest(b: Batch, M: THREE.Matrix4, len: number, nb: number, bw: number, y: number, z: number): void {
  for (let i = 0; i < nb; i++) {
    const w = bw * 0.78, hh = Math.min(0.46, bw * 0.5)
    const s = lancetShape(w, hh, w * 0.9)
    s.holes.push(lancetPath(w * 0.56, hh * 0.72, 0, 0.03, w * 0.5))
    b.add('oakV', extrude(s, 0.035), M.clone().multiply(T(i * bw + bw / 2, y, z - 0.05)), WOOD, REG)
  }
  for (let i = 0; i <= nb; i++) {
    const x = Math.min(len - 0.04, Math.max(0.04, i * bw))
    b.add('oakV', lathe(FINIAL, 8), M.clone().multiply(T(x, y, z - 0.04)), WOOD, REG)
  }
}

function rodX(x0: number, x1: number, y: number, z: number, r: number): [THREE.BufferGeometry, THREE.Matrix4] {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, 6)
  return [g, T((x0 + x1) / 2, y, z, 0, 0, Math.PI / 2)]
}

// ---------------------------------------------------------------------------------------------

/** Balustrade + gallery floor + fascia along a long wall from z0 to z1 (sx = −1 west, +1 east). */
function gallery(b: Batch, sx: number, z0: number, z1: number): void {
  const xf = sx * (LOWER_FACE - 0.14), xb = sx * HALL.x, g = GALLERY_Y
  const bx = (a: number, bb: number) => [Math.min(a, bb), Math.max(a, bb)] as const
  const [fx0, fx1] = bx(xf, sx * (LOWER_FACE + 0.45))
  b.box('oakV', fx0, g - 0.34, z0, fx1, g - 0.02, z1, WOOD, REG) // fascia (the lower tier's cornice)
  const [mx0, mx1] = bx(xf - sx * 0.05, sx * (LOWER_FACE + 0.3))
  b.box('oakV', mx0, g - 0.06, z0, mx1, g + 0.01, z1, WOOD_DARK, REG) // nosing
  const [kx0, kx1] = bx(xf - sx * 0.02, xf + sx * 0.06)
  b.box('oakV', kx0, g - 0.3, z0, kx1, g - 0.22, z1, WOOD_DARK, REG) // bead
  const [ffx0, ffx1] = bx(xf, xb)
  b.box('oakV', ffx0, g - 0.02, z0, ffx1, g, z1, 0x6a5440, REG) // floor boards
  // balustrade: base rail, handrail, newels every ~1 m, turned balusters every 0.16 m
  const xr = sx * (LOWER_FACE - 0.05)
  b.box('oakV', xr - 0.045, g, z0, xr + 0.045, g + 0.08, z1, WOOD_DARK, REG)
  b.box('oakV', xr - 0.055, g + 0.9, z0, xr + 0.055, g + 0.97, z1, WOOD, REG)
  b.box('oakV', xr - 0.035, g + 0.97, z0, xr + 0.035, g + 1.0, z1, WOOD_DARK, REG)
  const len = z1 - z0
  const nNewel = Math.max(1, Math.round(len / 1.9))
  for (let i = 0; i <= nNewel; i++) {
    const z = z0 + (len * i) / nNewel
    const zc = Math.min(z1 - 0.05, Math.max(z0 + 0.05, z))
    b.box('oakV', xr - 0.055, g, zc - 0.055, xr + 0.055, g + 1.06, zc + 0.055, WOOD, REG)
    b.add('oakV', lathe(FINIAL, 8), T(xr, g + 1.06, zc, 0, 0, 0, 0.9), WOOD, REG)
  }
  const prof: [number, number][] = [[0.026, 0], [0.026, 0.04], [0.016, 0.07], [0.016, 0.14], [0.03, 0.3], [0.034, 0.4], [0.024, 0.5], [0.014, 0.6], [0.014, 0.7], [0.024, 0.74], [0.024, 0.82]]
  const n = Math.floor(len / 0.16)
  for (let i = 1; i < n; i++) {
    b.add('oakV', lathe(prof, 6), T(xr, g + 0.08, z0 + (len * i) / n), WOOD, REG)
  }
}

export function bust(b: Batch, x: number, y: number, z: number, ry: number, s = 1): void {
  const M = T(x, y, z, 0, ry, 0, s)
  const socle: [number, number][] = [[0.085, 0], [0.085, 0.035], [0.07, 0.045], [0.045, 0.08], [0.045, 0.1], [0.075, 0.115], [0.075, 0.13], [0, 0.13]]
  b.add('marbleV', lathe(socle, 16), M, 0xe8e0d4, REG)
  const chest = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  chest.scale(0.19, 0.17, 0.105); chest.translate(0, 0.13, 0)
  b.add('marbleV', chest, M, 0xf0e8dc, REG)
  b.add('marbleV', new THREE.CylinderGeometry(0.042, 0.05, 0.1, 12).translate(0, 0.33, 0.005), M, 0xece4d8, REG)
  const head = new THREE.SphereGeometry(1, 16, 12)
  head.scale(0.075, 0.098, 0.088); head.translate(0, 0.44, 0.012)
  b.add('marbleV', head, M, 0xf2ebe0, REG)
  const hair = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)
  hair.scale(0.081, 0.09, 0.09); hair.translate(0, 0.46, 0.0)
  b.add('marbleV', hair, M, 0xe0d8cc, REG)
  b.add('marbleV', new THREE.BoxGeometry(0.018, 0.04, 0.03).translate(0, 0.43, 0.1), M, 0xefe7dc, REG) // nose
}

// ---------------------------------------------------------------------------------------------

export interface Stacks { runs: ShelfRun[] }

export function buildStacks(b: Batch): Stacks {
  const runs: ShelfRun[] = []
  const lowerDepth = 0.42
  for (const sx of [-1, 1]) {
    // lower tier, split round the fireplace on the east wall
    const segs: [number, number][] = sx < 0 ? [[STACK_N, STACK_S]] : [[STACK_N, FIRE_Z - FIRE_HALF], [FIRE_Z + FIRE_HALF, STACK_S]]
    for (const [z0, z1] of segs) {
      const back = sx * (LOWER_FACE + lowerDepth)
      // west: out +x, local x runs toward −z, so the origin is the south end; east the reverse
      face(b, {
        origin: sx < 0 ? [back, z1] : [back, z0], out: [-sx, 0], len: z1 - z0,
        y0: 0, h: GALLERY_Y - 0.2, depth: lowerDepth, shelves: 7, plinth: 0.14, top: 0.12, bay: 0.96,
        spandrel: true, cornice: false, crest: false, chain: true, tier: 'lower',
      }, runs)
      // the block behind the lower tier under the gallery (never seen, closes the moonlight)
      b.box('oakV', Math.min(back, sx * HALL.x), 0, z0, Math.max(back, sx * HALL.x), GALLERY_Y - 0.3, z1, 0x2a221a, REG)
      // brass ladder rail on stand-off brackets
      const xr = sx * (LOWER_FACE - 0.07)
      const [g, m] = rodZ(z0 + 0.05, z1 - 0.05, 2.78, xr, 0.013)
      b.add('brassV', g, m, 0xffffff, REG)
      for (let z = z0 + 0.3; z < z1; z += 1.9) b.box('brassV', xr - 0.004, 2.765, z - 0.01, sx * LOWER_FACE, 2.795, z + 0.01, 0xffffff, REG)
    }
    gallery(b, sx, STACK_N, STACK_S)
    // upper tier
    const back = sx * HALL.x
    face(b, {
      origin: sx < 0 ? [back, STACK_S] : [back, STACK_N], out: [-sx, 0], len: STACK_S - STACK_N,
      y0: GALLERY_Y, h: 3.0, depth: HALL.x - UPPER_FACE, shelves: 6, plinth: 0.1, top: 0.26, bay: 1.02,
      spandrel: true, cornice: true, crest: true, chain: false, tier: 'upper',
    }, runs)
    // end panels where the stacks stop in the south bay
    b.box('oakV', Math.min(sx * (LOWER_FACE - 0.14), sx * HALL.x), 0, STACK_S, Math.max(sx * (LOWER_FACE - 0.14), sx * HALL.x), GALLERY_Y + 3.0, STACK_S + 0.08, WOOD, REG)
  }
  // low case under the lancets
  face(b, {
    origin: [-LOWER_FACE, HALL.zN], out: [0, 1], len: 2 * LOWER_FACE,
    y0: 0, h: 2.7, depth: 0.4, shelves: 6, plinth: 0.14, top: 0.24, bay: 1.05,
    spandrel: true, cornice: true, crest: true, chain: true, tier: 'north',
  }, runs)
  // freestanding presses: double-sided, from the lower tier face to |x| = PRESS_IN
  const PH = 2.6
  for (const pz of PRESS_Z) {
    for (const sx of [-1, 1]) {
      const xa = sx * LOWER_FACE, xb = sx * PRESS_IN
      const len = Math.abs(xa - xb)
      for (const oz of [1, -1]) {
        // out +z: local x = +x; out −z: local x = −x
        const startX = oz > 0 ? Math.min(xa, xb) : Math.max(xa, xb)
        face(b, {
          origin: [startX, pz], out: [0, oz], len, y0: 0, h: PH, depth: PRESS_HALF - 0.01,
          shelves: 6, plinth: 0.13, top: 0.2, bay: 0.95,
          spandrel: true, cornice: true, crest: false, chain: true, tier: 'press',
        }, runs)
      }
      // end panel toward the aisle: a blind pointed arch, a desk ledge and a bust above
      const xe = xb - sx * 0.035
      b.box('oakV', xe - 0.035, 0, pz - PRESS_HALF - 0.02, xe + 0.035, PH, pz + PRESS_HALF + 0.02, WOOD, REG)
      const arch = lancetShape(0.46, 1.5, 0.4)
      arch.holes.push(lancetPath(0.34, 1.36, 0, 0.07, 0.3))
      b.add('oakV', extrude(arch, 0.02), T(xe - sx * 0.055, 0.55, pz, 0, sx * Math.PI / 2, 0), WOOD_DARK, REG)
      b.add('oakV', lathe(FINIAL, 8), T(xe, PH + 0.02, pz - PRESS_HALF + 0.03, 0, 0, 0, 1.3), WOOD, REG)
      b.add('oakV', lathe(FINIAL, 8), T(xe, PH + 0.02, pz + PRESS_HALF - 0.03, 0, 0, 0, 1.3), WOOD, REG)
      // central cresting along the press
      crest(b, new THREE.Matrix4().makeTranslation(Math.min(xa, xb) + 0.05, 0, pz), len - 0.1, 2, (len - 0.1) / 2, PH, 0.0325)
      bust(b, xb + sx * 0.3, PH, pz, -sx * Math.PI / 2 + (pz > 0 ? 0.3 : -0.3) * sx)
    }
  }
  return { runs }
}

function rodZ(z0: number, z1: number, y: number, x: number, r: number): [THREE.BufferGeometry, THREE.Matrix4] {
  return [new THREE.CylinderGeometry(r, r, z1 - z0, 8), T(x, y, (z0 + z1) / 2, Math.PI / 2, 0, 0)]
}
