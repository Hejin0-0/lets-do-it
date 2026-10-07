// The map's lightness plan (DESIGN §9 "Paint"): every hex belongs to one painted ZONE, and
// neighbouring zones must sit >= 12 L* apart so the board reads in grayscale (the old build's
// "midground murk", audit d8). Pure data + checks; MapPainter and Relief consume it.
//
// The DESIGN numbers collide in three places once real maps are laid out, so they are moved,
// keeping the order and the warm/cool intent:
//   polder 38 sat 2 from German rear 40 and 8 from river 44  -> polder 27 (dark wet meadow)
//   sea 36 sat 8 from river 44 (A8 touches B8)              -> sea 31, river 46
//   bridge/sluice 60 sat 8 from British rear 68             -> painted as river; the deck is 64
//   flooded polder (S3 sluice) is its own dark water zone 28, 12 under German rear 40
// Trench spoil (80) / floor (22) and crater bowls (24) are line/point FEATURES inside a zone, not
// zones: the trench is drawn centre-to-centre so its spoil never touches the dune.
import { COLS, ROWS } from '../contract/types.ts'
import type { HexId, Terrain } from '../contract/types.ts'
import { neighbors, rowOf } from './HexLayout.ts'

export type Zone = 'sea' | 'river' | 'polder' | 'flood' | 'deRear' | 'nml' | 'brRear' | 'dune'
export const ZONE_LIST: Zone[] = ['sea', 'river', 'polder', 'flood', 'deRear', 'nml', 'brRear', 'dune']

// CIE Lab (D65). L drives value; a/b keep the warm British / cool German split.
export const LAB: Record<Zone | 'spoil' | 'floor' | 'bowl' | 'ink' | 'deck', [number, number, number]> = {
  sea: [31, -6, -24],
  river: [46, -20, -9],
  polder: [27, -13, 14],
  flood: [28, -10, -12],
  deRear: [40, -9, 3],
  nml: [52, 9, 30],
  brRear: [68, -3, 30],
  dune: [86, 2, 17],
  spoil: [80, 4, 19],
  floor: [22, 5, 10],
  bowl: [24, 4, 12],
  ink: [20, 2, -5],
  deck: [64, 7, 22],
}

export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200
  const f = (t: number): number => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29))
  const X = 0.95047 * f(fx), Y = f(fy), Z = 1.08883 * f(fz)
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z]
  const g = (c: number): number => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.max(0, Math.min(1, v))
  }
  return [g(lin[0]), g(lin[1]), g(lin[2])]
}

export interface Bands { deLine: number; brLine: number }

// Front lines from the trench rows: the German line is the southern-most trench row in the
// north half, the British line the northern-most in the south half.
export function bandsOf(terrain: Terrain[]): Bands {
  let deLine = 1, brLine = ROWS - 3
  const north: number[] = [], south: number[] = []
  for (let h = 0; h < terrain.length; h++) {
    if (terrain[h] !== 'trench' && terrain[h] !== 'blockhouse') continue
    const r = rowOf(h)
    ;(r < ROWS / 2 ? north : south).push(r)
  }
  if (north.length) deLine = Math.max(...north)
  if (south.length) brLine = Math.min(...south)
  return { deLine, brLine }
}

export function zoneOf(t: Terrain, row: number, b: Bands, flooded: boolean): Zone {
  switch (t) {
    case 'sea': return 'sea'
    case 'river': case 'bridge': case 'sluice': return 'river'
    case 'dune': return 'dune'
    case 'polder': return flooded ? 'flood' : 'polder'
    default: return row <= b.deLine ? 'deRear' : row >= b.brLine ? 'brRear' : 'nml'
  }
}

export function zonesOf(terrain: Terrain[], flooded = false): Zone[] {
  const b = bandsOf(terrain)
  const z = terrain.map((t, h) => zoneOf(t, rowOf(h), b, flooded))
  // A dry hex alone in the polder (S3's farm islands) is a farm, not a scrap of no-man's-land: the
  // orange 'nml' hex in a green field looked like "a rendering leftover" to an outside review.
  const wet = new Set<Zone>(['polder', 'flood', 'river', 'sea'])
  return z.map((v, h) => (v === 'nml' && neighbors(h as HexId).every((n) => wet.has(z[n])) ? 'deRear' : v))
}

// Every pair of different, touching zones with its L* gap; min over them is the gate (>= 12).
export function zoneContrast(terrain: Terrain[], flooded = false): { min: number; pairs: string[] } {
  const z = zonesOf(terrain, flooded)
  const seen = new Map<string, number>()
  for (let h = 0; h < COLS * ROWS; h++) {
    for (const n of neighbors(h as HexId)) {
      if (z[n] === z[h]) continue
      const k = [z[h], z[n]].sort().join('/')
      seen.set(k, Math.abs(LAB[z[h]][0] - LAB[z[n]][0]))
    }
  }
  let min = Infinity
  for (const v of seen.values()) min = Math.min(min, v)
  return { min, pairs: [...seen].map(([k, v]) => `${k} ${v}`) }
}
