// Small builders for rules tests: an empty open board with only the pieces a test places.
import type { Action, GameState, Side, Terrain, Unit, UnitKind } from '../../src/contract/types.ts'
import { apply } from '../../src/rules/apply.ts'
import type { GameEvent } from '../../src/contract/events.ts'
import { parseHex } from '../../src/rules/hex.ts'
import { newGame } from '../../src/rules/setup.ts'
import { makeUnit } from '../../src/rules/units.ts'

export const H = parseHex

/** Round 1, British orders, all open ground, no wire, no pieces, no objectives, no ink. */
export function blank(over: Partial<GameState> = {}): GameState {
  const s = newGame('s1', 7, 'veteran')
  s.terrain = s.terrain.map(() => 'open' as Terrain)
  s.wire = s.wire.map(() => false)
  s.units = []
  s.intents = []
  s.objectives = []
  s.reinforcements = []
  s.shells = { BR: { he: 4, gas: 0 }, DE: { he: 4, gas: 0 } }
  s.morale = { BR: 20, DE: 20 }
  s.moraleStart = { BR: 20, DE: 20 }
  return Object.assign(s, over)
}

/** Place a piece (and, unless `lone`, a far-off dummy for each side so nobody routs by absence). */
export function put(s: GameState, id: string, side: Side, kind: UnitKind, hex: string, extra: Partial<Unit> = {}): Unit {
  const u = { ...makeUnit(id, side, kind, id, H(hex)), ...extra }
  s.units.push(u)
  return u
}

export function dummies(s: GameState): void {
  if (!s.units.some((u) => u.id === 'br-far')) put(s, 'br-far', 'BR', 'rifle', 'A9')
  if (!s.units.some((u) => u.id === 'de-far')) put(s, 'de-far', 'DE', 'rifle', 'M1')
}

export const terrain = (s: GameState, t: Terrain, ...hexes: string[]): void => { for (const h of hexes) s.terrain[H(h)] = t }
export const wire = (s: GameState, ...hexes: string[]): void => { for (const h of hexes) s.wire[H(h)] = true }

export const unit = (s: GameState, id: string): Unit | undefined => s.units.find((u) => u.id === id)

/** Apply a sequence, returning the last state and every event. */
export function run(s: GameState, ...acts: Action[]): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  for (const a of acts) {
    const st = apply(s, a)
    s = st.state
    events.push(...st.events)
  }
  return { state: s, events }
}

export const END: Action = { t: 'endOrders' }
