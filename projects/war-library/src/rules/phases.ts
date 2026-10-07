// Round flow (DESIGN §5): dawn → player-orders → bell → enemy-orders → dusk → (round+1) dawn …
// The human's endOrders runs the bell; the AI's endOrders runs dusk and dawn.
import type { GameEvent } from '../contract/events.ts'
import type { Dir, GameState, Side } from '../contract/types.ts'
import { barrageHex, gasUnit, hurt, nearestFree } from './combat.ts'
import { N_HEX, step } from './hex.ts'
import { resolveIntents } from './intents.ts'
import { draw } from './rng.ts'
import { SCENARIOS } from './scenarios/index.ts'
import { clone, isSupp, phaseIndex, unitAt, waves } from './state.ts'
import { DIG, isMud } from './terrain.ts'
import { other } from './units.ts'
import { checkAllObjectives, checkRout, duskResult, finish } from './victory.ts'

type Ev = GameEvent[]

/** Suppression that ran to the end of orders phase `idx` lifts. */
export function recover(s: GameState, idx: number, ev: Ev): void {
  for (const u of s.units) {
    if (u.suppressedUntil > 0 && u.suppressedUntil <= idx) {
      u.suppressedUntil = 0
      ev.push({ e: 'recovered', unit: u.id })
    }
  }
}

/** Open an orders phase for `side`: its pieces are fresh, the order count refills. */
export function startOrders(s: GameState, side: Side, ev: Ev): void {
  for (const u of s.units) if (u.side === side) { u.ordered = false; u.acted = false }
  s.phase = side === s.human ? 'player-orders' : 'enemy-orders'
  s.ordersLeft = s.orderLimit[side]
  s.active = null
  waves(s).fill(0)
  ev.push({ e: 'phase', phase: s.phase, round: s.round })
}

/** End of the human's orders: its suppression runs out, then the bell is about to ring. */
export function toBell(s: GameState, ev: Ev): void {
  recover(s, phaseIndex(s, s.human, s.round), ev)
  s.phase = 'bell'
  s.ordersLeft = 0
  s.active = null
  ev.push({ e: 'phase', phase: 'bell', round: s.round })
}

export function ringBell(s: GameState, ev: Ev): void {
  resolveIntents(s, ev)
  if (checkRout(s, ev)) return
  startOrders(s, other(s.human), ev)
}

export function endEnemyOrders(s: GameState, ev: Ev): void {
  recover(s, phaseIndex(s, other(s.human), s.round), ev)
  dusk(s, ev)
}

export function dusk(s: GameState, ev: Ev): void {
  s.phase = 'dusk'
  s.ordersLeft = 0
  s.active = null
  ev.push({ e: 'phase', phase: 'dusk', round: s.round })
  for (const u of s.units) {
    if (u.kind === 'tank') {
      // A Mark IV that ends a round in mud or a crater is stuck for the next one.
      const stuck = !u.bogged && (isMud(s, u.hex) || s.terrain[u.hex] === 'crater')
      u.bogged = stuck
      if (stuck) ev.push({ e: 'bogged', unit: u.id })
    } else if (!u.ordered && !u.dugIn && !isSupp(u) && DIG.has(s.terrain[u.hex])) {
      u.dugIn = true
      ev.push({ e: 'dug-in', unit: u.id })
    }
  }
  if (checkAllObjectives(s, ev)) return
  if (s.round >= s.maxRounds) {
    finish(s, duskResult(s), 'dusk', ev)
    return
  }
  s.round += 1
  dawn(s, ev)
}

const weatherAt = (s: GameState, round: number): 'dry' | 'rain' => {
  const from = SCENARIOS[s.scenario].rainFrom
  return from !== null && round >= from ? 'rain' : 'dry'
}

export function dawn(s: GameState, ev: Ev): void {
  s.phase = 'dawn'
  ev.push({ e: 'phase', phase: 'dawn', round: s.round })
  const [roll, next] = draw(s.rng)
  s.rng = next
  const sc = SCENARIOS[s.scenario]
  if (sc.rainFrom !== null) {
    s.weather = { now: weatherAt(s, s.round), next: weatherAt(s, s.round + 1) }
    ev.push({ e: 'weather', now: s.weather.now, next: s.weather.next })
  }
  if (sc.wind !== null) {
    const shift = roll < 0.25 ? 5 : roll < 0.5 ? 1 : 0 // backs, veers or holds (seeded)
    s.wind = { now: s.wind.next, next: ((s.wind.next + shift) % 6) as Dir }
    ev.push({ e: 'wind', now: s.wind.now, next: s.wind.next })
  }
  if (s.gas.some((g) => g > 0)) {
    const drift = new Array<number>(N_HEX).fill(0)
    for (let h = 0; h < N_HEX; h++) {
      if (s.gas[h] <= 1) continue
      const to = step(h, s.wind.now)
      if (to >= 0) drift[to] = Math.max(drift[to], s.gas[h] - 1)
    }
    s.gas = drift
    const hexes = drift.flatMap((g, h) => (g > 0 ? [h] : []))
    ev.push({ e: 'gas', hexes })
    for (const h of hexes) {
      const u = unitAt(s, h)
      if (u) gasUnit(s, u, 'gas', ev)
    }
  }
  if (s.creep) {
    s.creep.hexes = s.creep.hexes.map((h) => step(h, 0)).filter((h) => h >= 0)
    s.creep.stepsLeft -= 1
    for (const h of s.creep.hexes) barrageHex(s, h, 'battery', ev)
    if (s.creep.stepsLeft <= 0 || s.creep.hexes.length === 0) s.creep = null
  }
  for (const r of s.reinforcements.filter((x) => x.round === s.round)) {
    const at = nearestFree(s, r.unit.hex, () => true)
    if (at < 0) continue
    s.units.push({ ...r.unit, hex: at })
    ev.push({ e: 'reinforce', unit: r.unit.id })
  }
  s.reinforcements = s.reinforcements.filter((x) => x.round !== s.round)
  if (checkRout(s, ev)) return
  startOrders(s, s.human, ev)
}

/** The sluice opens: every polder hex floods for good; pieces there lose a figure and wade out. */
export function flood(s: GameState, ev: Ev): void {
  const hexes: number[] = []
  for (let h = 0; h < N_HEX; h++) if (s.terrain[h] === 'polder') { s.terrain[h] = 'river'; hexes.push(h) }
  s.sluiceUsed = true
  ev.push({ e: 'flood', hexes })
  for (const u of s.units.slice()) {
    if (!hexes.includes(u.hex)) continue
    const from = u.hex
    hurt(s, u, 1, 'flood', 'sluice', ev)
    if (u.str <= 0) continue
    const to = nearestFree(s, from, (x) => x !== from)
    if (to < 0) continue
    u.hex = to
    u.dugIn = false
    ev.push({ e: 'moved', unit: u.id, path: [from, to] })
  }
}

/**
 * Red ink never lies: write into each pending intent the figures it would take off the enemy if
 * nobody moved before the bell. The copy runs the real dusk and dawn (dig-in, wind, gas drift,
 * the creeping barrage, suppression running out), so ink the battle ends before is worth 0.
 */
export function projectIntents(s: GameState): void {
  if (s.intents.length === 0 || (s.phase !== 'player-orders' && s.phase !== 'enemy-orders' && s.phase !== 'bell')) return
  const sim = clone(s)
  const ev: Ev = []
  if (sim.phase === 'enemy-orders') endEnemyOrders(sim, ev)
  if (sim.phase === 'player-orders') toBell(sim, ev)
  const dmg = new Map<number, number>()
  if (sim.phase === 'bell') resolveIntents(sim, ev, (i, dealt) => dmg.set(i.id, dealt))
  for (const i of s.intents) i.dmg = dmg.get(i.id) ?? 0
}
