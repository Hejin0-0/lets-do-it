// Terrain table (DESIGN §5): move cost / cover / line of sight, plus the ASCII map key of §8.
import type { GameState, HexId, Terrain } from '../contract/types.ts'

export const TERRAIN_INFO: Record<Terrain, { label: string; move: number; cover: number; blocksLos: boolean }> = {
  open: { label: 'Open ground', move: 1, cover: 0, blocksLos: false },
  dune: { label: 'Dune', move: 1, cover: 0, blocksLos: false },
  polder: { label: 'Polder', move: 2, cover: 0, blocksLos: false },
  trench: { label: 'Trench', move: 1, cover: 2, blocksLos: false },
  crater: { label: 'Crater', move: 2, cover: 1, blocksLos: false },
  ruin: { label: 'Ruin', move: 2, cover: 1, blocksLos: true },
  church: { label: 'Church', move: 2, cover: 1, blocksLos: true },
  chateau: { label: 'Château', move: 2, cover: 1, blocksLos: true },
  blockhouse: { label: 'Blockhouse', move: 1, cover: 3, blocksLos: false },
  bridge: { label: 'Bridge', move: 1, cover: 0, blocksLos: false },
  sluice: { label: 'Sluice', move: 1, cover: 0, blocksLos: false },
  river: { label: 'River', move: 99, cover: 0, blocksLos: false },
  sea: { label: 'Sea', move: 99, cover: 0, blocksLos: false },
}

export const IMPASSABLE = (t: Terrain): boolean => t === 'river' || t === 'sea'
/** Unordered pieces on these dig in at dusk. */
export const DIG: ReadonlySet<Terrain> = new Set<Terrain>(['trench', 'crater', 'ruin', 'church', 'chateau'])
/** Entering these (or any wired hex) inside an enemy fan draws overwatch. */
export const OW_TRIGGER: ReadonlySet<Terrain> = new Set<Terrain>(['open', 'dune', 'polder', 'crater'])

export const isMud = (s: GameState, h: HexId): boolean =>
  s.weather.now === 'rain' && (s.terrain[h] === 'polder' || s.terrain[h] === 'crater')

export function moveCost(s: GameState, h: HexId): number {
  const t = s.terrain[h]
  if (IMPASSABLE(t)) return Infinity
  return isMud(s, h) ? 3 : TERRAIN_INFO[t].move
}

const KEY: Record<string, Terrain> = {
  '~': 'sea', s: 'dune', '.': 'open', ',': 'polder', '=': 'trench', '#': 'open', o: 'crater',
  w: 'river', V: 'ruin', C: 'church', X: 'chateau', P: 'blockhouse', B: 'bridge', L: 'sluice',
}

/** Nine 13-character rows in the §8 key -> terrain + wire overlay. */
export function parseMap(rows: readonly string[]): { terrain: Terrain[]; wire: boolean[] } {
  const terrain: Terrain[] = []
  const wire: boolean[] = []
  for (const line of rows) {
    if (line.length !== 13) throw new Error(`map row must be 13 wide: "${line}"`)
    for (const ch of line) {
      const t = KEY[ch]
      if (!t) throw new Error(`unknown map key "${ch}"`)
      terrain.push(t)
      wire.push(ch === '#')
    }
  }
  if (terrain.length !== 117) throw new Error('map must be 9 rows')
  return { terrain, wire }
}
