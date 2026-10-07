// Movement (DESIGN §5): Dijkstra on move cost; a piece stops on entering wire (infantry), a hex
// next to an enemy (ZOC), an overwatch hit, or gas. A piece may always take one step.
import type { GameState, HexId, Side, Unit } from '../contract/types.ts'
import { NEIGH, N_HEX, dist, fanGeometry, lines } from './hex.ts'
import { IMPASSABLE, OW_TRIGGER, TERRAIN_INFO, moveCost } from './terrain.ts'
import { UNIT_STATS, stoppedByWire } from './units.ts'
import { byId, isSupp } from './state.ts'

export type Stop = 'zoc' | 'wire' | 'overwatch' | null
export interface ReachInfo { cost: number; path: HexId[]; stop: Stop }

export function losClear(s: GameState, a: HexId, b: HexId): boolean {
  if (dist(a, b) <= 1) return true
  const [l1, l2] = lines(a, b)
  const blocked = (l: HexId[]): boolean => l.some((h) => TERRAIN_INFO[s.terrain[h]].blocksLos)
  return !(blocked(l1) && blocked(l2))
}

/** An MG's field of fire from `hex` at `facing`: within 3, ±60°, clipped by line of sight. */
export function fanFrom(s: GameState, hex: HexId, facing: Unit['facing']): HexId[] {
  return fanGeometry(hex, facing).filter((h) => losClear(s, hex, h))
}

export function fan(s: GameState, unit: string): HexId[] {
  const u = byId(s, unit)
  return u && u.kind === 'mg' ? fanFrom(s, u.hex, u.facing) : []
}

/** Per hex: the first unsuppressed MG of side `by` whose fan covers it (or -1). */
export function owMap(s: GameState, by: Side): Int16Array {
  const m = new Int16Array(N_HEX).fill(-1)
  s.units.forEach((u, i) => {
    if (u.side !== by || u.kind !== 'mg' || isSupp(u)) return
    for (const h of fanFrom(s, u.hex, u.facing)) if (m[h] < 0) m[h] = i
  })
  return m
}

export const owTrigger = (s: GameState, h: HexId): boolean => OW_TRIGGER.has(s.terrain[h]) || s.wire[h]

/** The enemy MG that fires on `mover` entering `h`, if any. Tanks are immune. */
export function overwatchBy(s: GameState, mover: Unit, h: HexId): Unit | undefined {
  if (mover.kind === 'tank' || !owTrigger(s, h)) return undefined
  return s.units.find((u) => u.side !== mover.side && u.kind === 'mg' && !isSupp(u) &&
    fanFrom(s, u.hex, u.facing).includes(h))
}

export function inZoc(s: GameState, side: Side, h: HexId): boolean {
  return NEIGH[h].some((n) => s.units.some((u) => u.hex === n && u.side !== side))
}

/**
 * Every hex `u` could end a move on, ignoring whose turn it is and whether it was ordered.
 * `overwatch` false skips the fan stops (used by the AI's threat maps for enemy pieces).
 */
export function explore(s: GameState, u: Unit, overwatch = true): Map<HexId, ReachInfo> {
  const occ = new Int8Array(N_HEX) // 1 friend, 2 enemy
  for (const o of s.units) occ[o.hex] = o.side === u.side ? 1 : 2
  const zoc = new Uint8Array(N_HEX)
  if (u.kind !== 'stoss') for (let h = 0; h < N_HEX; h++) if (occ[h] === 2) for (const n of NEIGH[h]) zoc[n] = 1
  const ow = overwatch && u.kind !== 'tank' ? owMap(s, u.side === 'BR' ? 'DE' : 'BR') : null
  const budget = UNIT_STATS[u.kind].move
  const wireStops = stoppedByWire(u.kind)

  const best = new Array<number>(N_HEX).fill(Infinity)
  const prev = new Int16Array(N_HEX).fill(-1)
  const stop: Stop[] = new Array<Stop>(N_HEX).fill(null)
  const terminal = new Uint8Array(N_HEX)
  const done = new Uint8Array(N_HEX)
  best[u.hex] = 0
  const open: HexId[] = [u.hex]
  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (best[open[i]] < best[open[bi]]) bi = i
    const c = open.splice(bi, 1)[0]
    if (done[c]) continue
    done[c] = 1
    if (terminal[c] && c !== u.hex) continue
    for (const n of NEIGH[c]) {
      if (occ[n] === 2 || IMPASSABLE(s.terrain[n])) continue
      const cost = best[c] + moveCost(s, n)
      if (cost > budget && c !== u.hex) continue // one step is always allowed
      if (cost >= best[n]) continue
      let st: Stop = null
      if (ow && ow[n] >= 0 && owTrigger(s, n)) st = 'overwatch'
      else if (wireStops && s.wire[n]) st = 'wire'
      else if (zoc[n]) st = 'zoc'
      const halts = st !== null || s.gas[n] > 0
      if (halts && occ[n] === 1) continue // cannot stop there, cannot pass
      best[n] = cost
      prev[n] = c
      stop[n] = st
      terminal[n] = halts ? 1 : 0
      open.push(n)
    }
  }
  const out = new Map<HexId, ReachInfo>()
  for (let h = 0; h < N_HEX; h++) {
    if (h === u.hex || best[h] === Infinity || occ[h] === 1) continue
    const path: HexId[] = [h]
    for (let p = prev[h]; p >= 0; p = prev[p]) path.unshift(p)
    out.set(h, { cost: best[h], path, stop: stop[h] })
  }
  return out
}

/** Where a piece can move right now (empty if it is suppressed, bogged or already ordered). */
export function reach(s: GameState, unit: string): Map<HexId, ReachInfo> {
  const u = byId(s, unit)
  if (!u || u.ordered || isSupp(u) || u.bogged) return new Map()
  return explore(s, u)
}
