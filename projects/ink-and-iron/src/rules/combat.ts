// Combat (DESIGN §5): damage = max(0, Fire + bonus − cover). No dice. Every effect helper
// mutates the working copy it is given and appends the GameEvents that describe it.
import type { GameEvent } from '../contract/events.ts'
import type { Dir, GameState, HexId, Rule, Side, Unit } from '../contract/types.ts'
import { NEIGH, step } from './hex.ts'
import { IMPASSABLE, TERRAIN_INFO } from './terrain.ts'
import { UNIT_STATS, canCapture, smallArms } from './units.ts'
import { isSupp, objectiveAt, suppressUntil, unitAt } from './state.ts'

type Ev = GameEvent[]

/** Terrain cover + 1 if dug in; tanks get none. `enfilade` strips trench cover. */
export function coverOf(s: GameState, u: Unit, enfilade = false): number {
  if (u.kind === 'tank') return 0
  const t = s.terrain[u.hex]
  return (enfilade && t === 'trench' ? 0 : TERRAIN_INFO[t].cover) + (u.dugIn ? 1 : 0)
}

/** An assault from an adjacent trench into a trench rolls up the line. */
export const enfilades = (s: GameState, from: HexId, to: HexId): boolean =>
  s.terrain[from] === 'trench' && s.terrain[to] === 'trench'

export function assaultDamage(s: GameState, att: Unit, from: HexId, def: Unit, priorWaves: number): number {
  if (def.kind === 'tank' && smallArms(att.kind)) return 0
  let bonus = 0
  if (isSupp(def)) bonus += 2
  if (priorWaves > 0) bonus += 1
  if (att.kind === 'stoss') bonus += 1
  const dmg = Math.max(0, UNIT_STATS[att.kind].fire + bonus - coverOf(s, def, enfilades(s, from, def.hex)))
  return att.kind === 'fieldgun' && def.kind === 'tank' ? dmg * 2 : dmg
}

/** A defender that survives unsuppressed hits back for max(0, Fire − 1 − attacker cover). */
export function strikeBack(s: GameState, def: Unit, att: Unit): number {
  if (isSupp(def)) return 0
  if (att.kind === 'tank' && smallArms(def.kind)) return 0
  const dmg = Math.max(0, UNIT_STATS[def.kind].fire - 1 - coverOf(s, att))
  return def.kind === 'fieldgun' && att.kind === 'tank' ? dmg * 2 : dmg
}

export function fireDamage(s: GameState, att: Unit, def: Unit): number {
  if (def.kind === 'tank' && smallArms(att.kind)) return 0
  const dmg = Math.max(0, UNIT_STATS[att.kind].fire + (isSupp(def) ? 2 : 0) - coverOf(s, def))
  return att.kind === 'fieldgun' && def.kind === 'tank' ? dmg * 2 : dmg
}

export const barrageDamage = (s: GameState, h: HexId): number => (s.terrain[h] === 'blockhouse' ? 0 : 2)

export function moraleDelta(s: GameState, side: Side, delta: number, ev: Ev): void {
  const value = Math.max(0, Math.min(delta > 0 ? s.moraleStart[side] : Infinity, s.morale[side] + delta))
  const d = value - s.morale[side]
  if (d === 0) return
  s.morale[side] = value
  ev.push({ e: 'morale', side, value, delta: d })
}

export function cancelIntentsOf(s: GameState, unit: string, ev: Ev): void {
  if (!s.intents.some((i) => i.source === unit)) return
  s.intents = s.intents.filter((i) => {
    if (i.source !== unit) return true
    ev.push({ e: 'intent-resolved', id: i.id, outcome: 'cancelled' })
    return false
  })
}

/** Remove figures; writes the ledger, drains a candle per figure, removes a wiped-out piece. */
export function hurt(s: GameState, u: Unit, dmg: number, rule: Rule, by: string, ev: Ev): number {
  const lost = Math.min(Math.max(0, dmg), u.str)
  if (lost === 0) return 0
  u.str -= lost
  ev.push({ e: 'figures', unit: u.id, lost, left: u.str })
  s.ledger.push({ round: s.round, unit: u.id, figures: lost, hex: u.hex, rule, by })
  moraleDelta(s, u.side, -lost, ev)
  if (u.str === 0) {
    s.units = s.units.filter((x) => x !== u)
    ev.push({ e: 'destroyed', unit: u.id })
    cancelIntentsOf(s, u.id, ev)
  }
  return lost
}

export function suppress(s: GameState, u: Unit, ev: Ev): void {
  if (u.str <= 0) return
  const until = suppressUntil(s, u.side)
  const was = isSupp(u)
  u.suppressedUntil = Math.max(u.suppressedUntil, until)
  u.dugIn = false
  if (!was) ev.push({ e: 'suppressed', unit: u.id })
  cancelIntentsOf(s, u.id, ev)
}

/** A piece arrives on `h`: a rifle or Stoßtrupp captures an objective its side does not hold. */
export function enterHex(s: GameState, u: Unit, h: HexId, ev: Ev): void {
  u.hex = h
  u.dugIn = false
  const o = objectiveAt(s, h)
  if (!o || o.holder === u.side || !canCapture(u.kind)) return
  const prev = o.holder
  o.holder = u.side
  ev.push({ e: 'captured', hex: h, by: u.side })
  if (prev) moraleDelta(s, prev, -2, ev)
  moraleDelta(s, u.side, 1, ev)
}

/** 2 to everyone in the hex (0 in a blockhouse); always suppresses, craters and cuts wire. */
export function barrageHex(s: GameState, h: HexId, by: string, ev: Ev): number {
  const u = unitAt(s, h)
  const dmg = barrageDamage(s, h)
  ev.push({ e: 'attack', kind: 'barrage', by, target: h, dmg: u ? Math.min(dmg, u.str) : 0 })
  let lost = 0
  if (u) {
    lost = hurt(s, u, dmg, 'barrage', by, ev)
    suppress(s, u, ev)
  }
  const t = s.terrain[h]
  if (t === 'open' || t === 'dune' || t === 'polder') {
    s.terrain[h] = 'crater'
    ev.push({ e: 'crater', hex: h })
  }
  if (s.wire[h]) {
    s.wire[h] = false
    ev.push({ e: 'wire-cut', hex: h })
  }
  return lost
}

/** Gas pieces take 1 and are suppressed. */
export function gasUnit(s: GameState, u: Unit, by: string, ev: Ev): void {
  ev.push({ e: 'attack', kind: 'gas', by, target: u.hex, dmg: Math.min(1, u.str) })
  hurt(s, u, 1, 'gas', by, ev)
  suppress(s, u, ev)
}

/** The target and the two hexes downwind of it (fewer at the map edge). */
export function gasCloud(h: HexId, wind: Dir): HexId[] {
  const hexes: HexId[] = [h]
  for (let i = 0, c = h; i < 2; i++) {
    c = step(c, wind)
    if (c < 0) break
    hexes.push(c)
  }
  return hexes
}

/** A gas shell covers the target and two hexes downwind for two rounds. */
export function gasHex(s: GameState, h: HexId, wind: Dir, by: string, ev: Ev): HexId[] {
  const hexes = gasCloud(h, wind)
  for (const x of hexes) s.gas[x] = 2
  ev.push({ e: 'gas', hexes })
  for (const x of hexes) {
    const u = unitAt(s, x)
    if (u) gasUnit(s, u, by, ev)
  }
  return hexes
}

/**
 * Resolve an assault from `att` (standing on `from`) into `target`. An empty target is simply
 * taken (⟨G10⟩, only reachable through an intent). Returns figures dealt.
 */
export function resolveAssault(s: GameState, att: Unit, target: HexId, priorWaves: number, ev: Ev): number {
  const def = unitAt(s, target)
  const from = att.hex
  if (!def) {
    ev.push({ e: 'moved', unit: att.id, path: [from, target] })
    enterHex(s, att, target, ev)
    return 0
  }
  const dmg = assaultDamage(s, att, from, def, priorWaves)
  ev.push({ e: 'attack', kind: 'assault', by: att.id, target, dmg: Math.min(dmg, def.str) })
  const dealt = hurt(s, def, dmg, 'assault', att.id, ev)
  if (def.str <= 0) {
    ev.push({ e: 'moved', unit: att.id, path: [from, target] })
    enterHex(s, att, target, ev)
  } else if (!isSupp(def)) {
    const back = strikeBack(s, def, att)
    ev.push({ e: 'attack', kind: 'strike-back', by: def.id, target: from, dmg: Math.min(back, att.str) })
    hurt(s, att, back, 'strike-back', def.id, ev)
  }
  return dealt
}

export function resolveFire(s: GameState, att: Unit, target: HexId, ev: Ev): number {
  const def = unitAt(s, target)
  if (!def) return 0
  const dmg = fireDamage(s, att, def)
  ev.push({ e: 'attack', kind: 'fire', by: att.id, target, dmg: Math.min(dmg, def.str) })
  return hurt(s, def, dmg, 'fire', att.id, ev)
}

/** Nearest empty, passable, dry hex to `h` (breadth first), for floods and reinforcements. */
export function nearestFree(s: GameState, h: HexId, ok: (x: HexId) => boolean): HexId {
  const seen = new Set([h])
  const q = [h]
  while (q.length) {
    const c = q.shift()!
    if (ok(c) && !IMPASSABLE(s.terrain[c]) && !unitAt(s, c)) return c
    for (const n of NEIGH[c]) if (!seen.has(n)) { seen.add(n); q.push(n) }
  }
  return -1
}
