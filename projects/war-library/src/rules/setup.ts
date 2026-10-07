// newGame: a scenario sheet (DESIGN §8) turned into round 1's player-orders, opening red ink
// already on the map.
import type { Difficulty, GameState, ScenarioId, Unit } from '../contract/types.ts'
import { N_HEX, parseHex } from './hex.ts'
import { declare } from './intents.ts'
import { projectIntents } from './phases.ts'
import { SCENARIOS } from './scenarios/index.ts'
import type { UnitSpec } from './scenarios/index.ts'
import type { RState } from './state.ts'
import { DIG, parseMap } from './terrain.ts'
import { makeUnit } from './units.ts'

const toUnit = (u: UnitSpec): Unit => makeUnit(u.id, u.side, u.kind, u.name, parseHex(u.hex), u.facing)

export function newGame(id: ScenarioId, seed: number, d: Difficulty): GameState {
  const sc = SCENARIOS[id]
  if (!sc) throw new Error(`unknown scenario ${id}`)
  const { terrain, wire } = parseMap(sc.map)
  const units = sc.units.map(toUnit)
  // The line has been held for weeks: pieces that start in a trench or a ruin start dug in.
  for (const u of units) if (u.kind !== 'tank' && DIG.has(terrain[u.hex])) u.dugIn = true
  const rain = (r: number): 'dry' | 'rain' => (sc.rainFrom !== null && r >= sc.rainFrom ? 'rain' : 'dry')
  const wind = sc.wind ?? 1
  const s: RState = {
    scenario: id, difficulty: d, seed, rng: seed >>> 0, round: 1, maxRounds: sc.maxRounds,
    phase: 'player-orders', human: 'BR',
    terrain, wire, gas: new Array<number>(N_HEX).fill(0),
    units, intents: [],
    objectives: sc.objectives.map((o) => ({ hex: parseHex(o.hex), name: o.name, holder: o.holder })),
    orderLimit: { ...sc.orders }, ordersLeft: sc.orders.BR, active: null,
    morale: { ...sc.morale }, moraleStart: { ...sc.morale },
    shells: { BR: { ...sc.shells.BR }, DE: { ...sc.shells.DE } },
    weather: { now: rain(1), next: rain(2) }, wind: { now: wind, next: wind },
    creep: null, sluiceUsed: false,
    reinforcements: sc.reinforcements.map((r) => ({ round: r.round, unit: toUnit(r.unit) })),
    ledger: [], winner: null, endReason: null,
    waves: new Array<number>(N_HEX).fill(0), // always present, so stateHash is path-independent
  }
  for (const o of sc.opening) declare(s, o.side, 'battery', o.kind, null, parseHex(o.target))
  projectIntents(s)
  return s
}
