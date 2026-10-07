// Hex geometry: flat-top hexes, odd-q offset (odd columns sit half a hex south), HexId = row*13+col.
// Everything is computed in axial/cube coordinates and cached; nothing here reads a GameState.
import { COLS, ROWS } from '../contract/types.ts'
import type { Dir, HexId } from '../contract/types.ts'

export const N_HEX = COLS * ROWS
export const col = (h: HexId): number => h % COLS
export const row = (h: HexId): number => (h / COLS) | 0
export const hexId = (c: number, r: number): HexId => r * COLS + c
export const onBoard = (c: number, r: number): boolean => c >= 0 && c < COLS && r >= 0 && r < ROWS

/** 'E7' -> HexId (column letter, 1-based row). */
export function parseHex(name: string): HexId {
  const c = name.charCodeAt(0) - 65
  const r = Number(name.slice(1)) - 1
  if (!onBoard(c, r)) throw new Error(`bad hex ${name}`)
  return hexId(c, r)
}
export const hexName = (h: HexId): string => String.fromCharCode(65 + col(h)) + (row(h) + 1)

export function axial(h: HexId): [number, number] {
  const c = col(h)
  return [c, row(h) - ((c - (c & 1)) >> 1)]
}
function fromAxial(q: number, r: number): HexId {
  const rr = r + ((q - (q & 1)) >> 1)
  return onBoard(q, rr) ? hexId(q, rr) : -1
}

// N NE SE S SW NW, as axial deltas.
const DIRS: readonly [number, number][] = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]]
export const DIR_NAMES = ['north', 'north-east', 'south-east', 'south', 'south-west', 'north-west'] as const

/** The neighbour of h in direction d, or -1 off the board. */
export function step(h: HexId, d: Dir): HexId {
  const [q, r] = axial(h)
  return fromAxial(q + DIRS[d][0], r + DIRS[d][1])
}

export const NEIGH: readonly (readonly HexId[])[] = Array.from({ length: N_HEX }, (_, h) =>
  ([0, 1, 2, 3, 4, 5] as Dir[]).map((d) => step(h, d)).filter((n) => n >= 0))

export function dist(a: HexId, b: HexId): number {
  const [aq, ar] = axial(a)
  const [bq, br] = axial(b)
  const dq = aq - bq, dr = ar - br
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** Hex centre in hex-radius units, +x east, +y south. */
export function center(h: HexId): [number, number] {
  const [q, r] = axial(h)
  return [1.5 * q, Math.sqrt(3) * (r + q / 2)]
}

/** Compass bearing from a to b in degrees, clockwise from north, in [0, 360). */
export function bearing(a: HexId, b: HexId): number {
  const [ax, ay] = center(a)
  const [bx, by] = center(b)
  const deg = (Math.atan2(bx - ax, -(by - ay)) * 180) / Math.PI
  return (deg + 360) % 360
}

/** Every hex within n steps of h, excluding h. */
export function within(h: HexId, n: number): HexId[] {
  const out: HexId[] = []
  for (let x = 0; x < N_HEX; x++) if (x !== h && dist(h, x) <= n) out.push(x)
  return out
}

function cubeRound(x: number, z: number): HexId {
  const y = -x - z
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z)
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy > dz) ry = -rx - rz
  else rz = -rx - ry
  return fromAxial(rx, rz)
}

// Intermediate hexes (endpoints excluded) of the a->b line, nudged both ways off hex edges.
// The same nudge is added to both ends, so line(a,b) and line(b,a) visit the same hexes.
const lineCache = new Map<number, [HexId[], HexId[]]>()
export function lines(a: HexId, b: HexId): [HexId[], HexId[]] {
  const key = a < b ? a * N_HEX + b : b * N_HEX + a
  let hit = lineCache.get(key)
  if (hit) return hit
  const [aq, ar] = axial(a)
  const [bq, br] = axial(b)
  const n = dist(a, b)
  const trace = (e: number): HexId[] => {
    const out: HexId[] = []
    for (let i = 1; i < n; i++) {
      const t = i / n
      const h = cubeRound(aq + e + (bq - aq) * t, ar - 2 * e + (br - ar) * t)
      if (h >= 0 && h !== a && h !== b && !out.includes(h)) out.push(h)
    }
    return out
  }
  hit = [trace(1e-6), trace(-1e-6)]
  lineCache.set(key, hit)
  return hit
}

// Fan geometry: every hex within 3 of h whose bearing lies within ±60° of the facing
// (15 hexes when nothing clips it). Line of sight is applied by the caller.
const fanCache = new Map<number, HexId[]>()
export function fanGeometry(h: HexId, facing: Dir): HexId[] {
  const key = h * 6 + facing
  let hit = fanCache.get(key)
  if (hit) return hit
  hit = within(h, 3).filter((x) => {
    const d = Math.abs(((bearing(h, x) - facing * 60 + 540) % 360) - 180)
    return d <= 60 + 1e-6
  })
  fanCache.set(key, hit)
  return hit
}

/** The facing (0..5) closest to the bearing from a to b. */
export function facingToward(a: HexId, b: HexId): Dir {
  return (Math.round(bearing(a, b) / 60) % 6) as Dir
}
