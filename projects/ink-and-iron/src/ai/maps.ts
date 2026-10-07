// Influence maps, built once per turn (DESIGN §6): what the enemy can bring on each hex in its
// next orders phase, how far each hex is from an objective still to take, and the ground's cover.
// The enemy's pieces cannot change during my phase (my attacks are instant for the human side and
// only ink for the AI's), so maps built at the start of a turn stay good for the whole search.
import type { GameState, HexId, Side, Unit } from '../contract/types.ts'
import { NEIGH, N_HEX, dist } from '../rules/hex.ts'
import { explore, fanFrom, losClear } from '../rules/movement.ts'
import { SCENARIOS } from '../rules/scenarios/index.ts'
import { isSupp } from '../rules/state.ts'
import { TERRAIN_INFO, moveCost } from '../rules/terrain.ts'
import { UNIT_STATS, canAssault, canCapture, other, stoppedByWire } from '../rules/units.ts'

export interface Maps {
  me: Side
  attacker: boolean
  /** Best raw attack (Fire + bonus, before cover) an enemy piece can put on each hex. */
  pow: Int8Array
  /** The same, counting only weapons that hurt a tank (field-gun fire already doubled). */
  heavy: Int8Array
  /** An enemy assaulter can reach a trench next to this trench hex (enfilade strips its cover). */
  enf: Uint8Array
  /** Barrage damage the enemy battery can drop anywhere (0 without shells). */
  shell: number
  /** An enemy rifle or Stoßtrupp can walk onto this hex. */
  capture: Uint8Array
  /** Move cost to the nearest objective `me` does not hold (Infinity when none is left). */
  objDist: Float32Array
  maxDist: number
  /** Per hex: the objective index within 3, for the wire term (-1 if none). */
  wireObj: Int8Array
  /**
   * I attack from the human side, so the enemy's fire reaches me as red ink I can step out of before
   * it lands. Without this discount an attacker never crosses a fan (S2 stalled at 0% captures).
   * A defender gains nothing by leaving cover, so it keeps the raw threat (S1 and S3 unchanged).
   */
  dodge: boolean
}

/** Index of `side`'s next orders phase on the 2r (human) / 2r+1 (AI) clock, the current one if it is acting. */
export function nextOrdersIdx(s: GameState, side: Side): number {
  const r = s.round
  const human = side === s.human
  switch (s.phase) {
    case 'dawn': return human ? 2 * r : 2 * r + 1
    case 'player-orders': case 'bell': return human ? (s.phase === 'bell' ? 2 * r + 2 : 2 * r) : 2 * r + 1
    case 'enemy-orders': return human ? 2 * r + 2 : 2 * r + 1
    case 'dusk': case 'over': return human ? 2 * r + 2 : 2 * r + 3
  }
}

/** Can `u` act in its next orders phase (not still suppressed then)? */
export const canActNext = (s: GameState, u: Unit): boolean =>
  !isSupp(u) || u.suppressedUntil < nextOrdersIdx(s, u.side)

export function buildMaps(s: GameState, me: Side): Maps {
  const op = other(me)
  const pow = new Int8Array(N_HEX)
  const heavy = new Int8Array(N_HEX)
  const enf = new Uint8Array(N_HEX)
  const capture = new Uint8Array(N_HEX)
  const put = (h: HexId, p: number, hv: number): void => {
    if (p > pow[h]) pow[h] = p
    if (hv > heavy[h]) heavy[h] = hv
  }
  for (const u of s.units) {
    if (u.side !== op || !canActNext(s, u)) continue
    const fire = UNIT_STATS[u.kind].fire
    const from = u.bogged ? [u.hex] : [u.hex, ...explore(s, u, false).keys()]
    if (canAssault(u.kind)) {
      const p = fire + (u.kind === 'stoss' ? 1 : 0)
      for (const f of from) {
        if (canCapture(u.kind)) capture[f] = 1
        if (stoppedByWire(u.kind) && s.wire[f]) continue
        for (const n of NEIGH[f]) {
          put(n, p, 0)
          if (s.terrain[f] === 'trench' && s.terrain[n] === 'trench') enf[n] = 1
        }
      }
    } else if (u.kind === 'mg') {
      for (const h of fanFrom(s, u.hex, u.facing)) put(h, fire, 0)
    } else {
      const range = UNIT_STATS[u.kind].range
      const shots = u.kind === 'tank' ? from : [u.hex]
      const hv = u.kind === 'fieldgun' ? fire * 2 : fire
      for (const f of shots) for (let h = 0; h < N_HEX; h++) {
        if (h !== f && dist(f, h) <= range && losClear(s, f, h)) put(h, fire, hv)
      }
    }
  }

  // Objective distance: Dijkstra over move cost from every objective `me` has still to take;
  // wire costs two extra (it stops a rifle for a turn).
  const objDist = new Float32Array(N_HEX).fill(Infinity)
  const open: HexId[] = []
  for (const o of s.objectives) if (o.holder !== me) { objDist[o.hex] = 0; open.push(o.hex) }
  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (objDist[open[i]] < objDist[open[bi]]) bi = i
    const c = open.splice(bi, 1)[0]
    for (const n of NEIGH[c]) {
      const d = objDist[c] + moveCost(s, c) + (s.wire[c] ? 2 : 0)
      if (d < objDist[n] && moveCost(s, n) < Infinity) { objDist[n] = d; open.push(n) }
    }
  }
  let maxDist = 1
  for (let h = 0; h < N_HEX; h++) if (objDist[h] < Infinity && objDist[h] > maxDist) maxDist = objDist[h]

  const wireObj = new Int8Array(N_HEX).fill(-1)
  for (let h = 0; h < N_HEX; h++) {
    let best = 4
    s.objectives.forEach((o, i) => { const d = dist(h, o.hex); if (d < best) { best = d; wireObj[h] = i } })
  }

  const attacker = SCENARIOS[s.scenario].attacker === me
  return {
    me, attacker, pow, heavy, enf,
    shell: s.shells[op].he > 0 ? 2 : 0, capture, objDist, maxDist, wireObj, dodge: attacker && me === s.human,
  }
}

/** Cover `u` would have standing on `h` against the enemy in these maps. */
export function coverAt(s: GameState, m: Maps, u: Unit, h: HexId): number {
  if (u.kind === 'tank') return 0
  const t = s.terrain[h]
  return (m.enf[h] && t === 'trench' ? 0 : TERRAIN_INFO[t].cover) + (u.dugIn && h === u.hex ? 1 : 0)
}

/** The most figures one enemy order could take off `u` if it stood on `h` next phase. */
export function dmgAt(s: GameState, m: Maps, u: Unit, h: HexId): number {
  const shell = s.terrain[h] === 'blockhouse' ? 0 : m.shell
  let d: number
  if (u.kind === 'tank') d = Math.max(shell, m.heavy[h] > 0 ? m.heavy[h] + (isSupp(u) ? 4 : 0) : 0)
  else d = Math.max(shell, m.pow[h] > 0 ? m.pow[h] + (isSupp(u) ? 2 : 0) - coverAt(s, m, u, h) : 0)
  return Math.min(u.str, d)
}

/**
 * DESIGN §6 threat map: the most damage a Str-4 rifle (not dug in) on each hex could take from
 * side `by` in its next orders phase.
 */
export function threat(s: GameState, by: Side): Uint8Array {
  const m = buildMaps(s, other(by))
  const probe: Unit = {
    id: '', side: other(by), kind: 'rifle', name: '', hex: -1, str: 4, facing: 0,
    suppressedUntil: 0, dugIn: false, bogged: false, ordered: false, acted: false,
  }
  const out = new Uint8Array(N_HEX)
  for (let h = 0; h < N_HEX; h++) out[h] = dmgAt(s, m, probe, h)
  return out
}
