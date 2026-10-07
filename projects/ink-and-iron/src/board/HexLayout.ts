// Hex maths for the war-table (G0 "Coordinates and scale"). Pure: no three, no DOM, so the
// node self-check (board.test.ts) runs it directly.
//   flat-top hexes, odd-q offset (odd columns B, D, F... sit half a hex south),
//   HexId = row*13 + col, row 0 = north, col 0 = west (the sea).
// Board-local frame: +x east, +z south, origin = board centre. The painted surface sits
// BOARD_Y above the tabletop (the map board is a plinth resting ON the table, see requests/B.md).
import { COLS, ROWS } from '../contract/types.ts'
import type { Dir, HexId } from '../contract/types.ts'

export const HEX = 0.1 // across the flats (== HEX_FLAT)
export const R = HEX / Math.sqrt(3) // circumradius
export const DX = 1.5 * R // column spacing
export const N_HEX = COLS * ROWS
export const MAP_W = DX * (COLS - 1) + 2 * R // 1.1547 m
export const MAP_H = HEX * ROWS + HEX / 2 // 0.95 m
const W0 = DX * (COLS - 1) // centre-to-centre spans (the greybox `local()` formula)
const H0 = HEX * (ROWS - 1) + HEX / 2
// The diorama (docs/DIORAMA.md "a slab with a cut edge"): the oak frame and its lettered margin sit
// MOUNT_Y above the tabletop, and the terrain block rises out of it, its painted surface BOARD_Y up,
// so its cut sides — peat, clay, sand and resin water — show all the way round.
export const MOUNT_Y = 0.014 // frame and margin top above the tabletop, metres
export const BOARD_Y = 0.06 // painted surface above the tabletop, metres

export const colOf = (h: HexId): number => h % COLS
export const rowOf = (h: HexId): number => Math.floor(h / COLS)
export const hexId = (c: number, r: number): HexId | null =>
  c < 0 || c >= COLS || r < 0 || r >= ROWS ? null : r * COLS + c

export function hexX(h: HexId): number { return colOf(h) * DX - W0 / 2 }
export function hexZ(h: HexId): number {
  const c = colOf(h)
  return rowOf(h) * HEX + (c & 1 ? HEX / 2 : 0) - H0 / 2
}

// Board-local point -> hex (cube rounding in axial space). Null off the grid.
export function hexFromXZ(x: number, z: number): HexId | null {
  const px = x + W0 / 2, pz = z + H0 / 2
  const qf = (2 / 3) * px / R
  const rf = (-px / 3 + (Math.sqrt(3) / 3) * pz) / R
  const sf = -qf - rf
  let q = Math.round(qf), r = Math.round(rf)
  const s = Math.round(sf)
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  const row = r + (q - (q & 1)) / 2
  return hexId(q, row)
}

// Nearest hex even for points in the edge notches of the grid (for painting the whole sheet).
export function nearestHex(x: number, z: number): HexId {
  const h = hexFromXZ(x, z)
  if (h !== null) return h
  const c = Math.max(0, Math.min(COLS - 1, Math.round((x + W0 / 2) / DX)))
  const r = Math.max(0, Math.min(ROWS - 1, Math.round((z + H0 / 2 - (c & 1 ? HEX / 2 : 0)) / HEX)))
  return r * COLS + c
}

// Direction vectors, Dir 0..5 = N NE SE S SW NW (flat-top: neighbours every 60° from north).
export function dirVec(d: Dir | number): { x: number; z: number } {
  const a = (d * Math.PI) / 3
  return { x: Math.sin(a), z: -Math.cos(a) }
}
// Piece yaw for a facing: model forward is -z (north); rotation.y = -d·60°.
export const yawOf = (d: Dir | number): number => (-d * Math.PI) / 3

export function neighbor(h: HexId, d: Dir | number): HexId | null {
  const c = colOf(h), r = rowOf(h), odd = c & 1
  switch (d) {
    case 0: return hexId(c, r - 1)
    case 3: return hexId(c, r + 1)
    case 1: return hexId(c + 1, odd ? r : r - 1)
    case 2: return hexId(c + 1, odd ? r + 1 : r)
    case 4: return hexId(c - 1, odd ? r + 1 : r)
    default: return hexId(c - 1, odd ? r : r - 1)
  }
}
export function neighbors(h: HexId): HexId[] {
  const out: HexId[] = []
  for (let d = 0; d < 6; d++) { const n = neighbor(h, d); if (n !== null) out.push(n) }
  return out
}

// Flat-top corners, starting east, clockwise seen from above (+z is south).
export function hexCorners(h: HexId, scale = 1): [number, number][] {
  const cx = hexX(h), cz = hexZ(h), out: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    out.push([cx + Math.cos(a) * R * scale, cz + Math.sin(a) * R * scale])
  }
  return out
}

// "E7" <-> HexId (column letter A-M west to east, row 1-9 north to south).
export function hexName(h: HexId): string { return String.fromCharCode(65 + colOf(h)) + (rowOf(h) + 1) }
export function parseHex(name: string): HexId {
  const c = name.charCodeAt(0) - 65, r = Number(name.slice(1)) - 1
  const h = hexId(c, r)
  if (h === null) throw new Error(`bad hex name ${name}`)
  return h
}
