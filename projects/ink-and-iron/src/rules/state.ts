// Shared state helpers for the rules core. Pure: nothing here touches three, the DOM or a clock.
import type { GameEvent } from '../contract/events.ts'
import type { GameState, HexId, Side, Unit } from '../contract/types.ts'
import { N_HEX } from './hex.ts'
import { other } from './units.ts'

export interface Step { state: GameState; events: GameEvent[] }

export class IllegalAction extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'IllegalAction'
  }
}

// The Wave bonus needs "assaults on this hex so far this phase" to survive between apply()
// calls. The frozen contract has no field for it, so it rides along as an optional extra
// array (structuredClone/JSON safe). Requested as a contract field in docs/requests/A.md.
export type RState = GameState & { waves?: number[] }

export function waves(s: GameState): number[] {
  const r = s as RState
  if (!r.waves) r.waves = new Array<number>(N_HEX).fill(0)
  return r.waves
}

/** A deep copy that is several times faster than structuredClone (the AI calls this a lot). */
export function clone(s: GameState): GameState {
  const r = s as RState
  const out: RState = {
    ...s,
    terrain: s.terrain.slice(),
    wire: s.wire.slice(),
    gas: s.gas.slice(),
    units: s.units.map((u) => ({ ...u })),
    intents: s.intents.map((i) => ({ ...i })),
    objectives: s.objectives.map((o) => ({ ...o })),
    orderLimit: { ...s.orderLimit },
    morale: { ...s.morale },
    moraleStart: { ...s.moraleStart },
    shells: { BR: { ...s.shells.BR }, DE: { ...s.shells.DE } },
    weather: { ...s.weather },
    wind: { ...s.wind },
    creep: s.creep ? { hexes: s.creep.hexes.slice(), stepsLeft: s.creep.stepsLeft } : null,
    reinforcements: s.reinforcements.map((x) => ({ round: x.round, unit: { ...x.unit } })),
    ledger: s.ledger.slice(), // entries are never mutated after they are written
  }
  if (r.waves) out.waves = r.waves.slice()
  return out
}

export const isSupp = (u: Unit): boolean => u.suppressedUntil > 0
export const unitAt = (s: GameState, h: HexId): Unit | undefined => s.units.find((u) => u.hex === h)
export const byId = (s: GameState, id: string): Unit | undefined => s.units.find((u) => u.id === id)

/** The side that gives orders in this phase, or null outside the two orders phases. */
export function actingSide(s: GameState): Side | null {
  if (s.phase === 'player-orders') return s.human
  if (s.phase === 'enemy-orders') return other(s.human)
  return null
}

/** Index of an orders phase on a monotonic clock: the human's of round r is 2r, the AI's 2r+1. */
export const phaseIndex = (s: GameState, side: Side, round: number): number => 2 * round + (side === s.human ? 0 : 1)

/** Suppression applied now lasts to the end of the owner's next orders phase that starts after now. */
export function suppressUntil(s: GameState, side: Side): number {
  const human = side === s.human
  const r = s.round
  switch (s.phase) {
    case 'dawn': return phaseIndex(s, side, r)
    case 'player-orders': case 'bell': return human ? 2 * r + 2 : 2 * r + 1
    case 'enemy-orders': case 'dusk': return human ? 2 * r + 2 : 2 * r + 3
    case 'over': return 2 * r + 3
  }
}

export function objectiveAt(s: GameState, h: HexId): GameState['objectives'][number] | undefined {
  return s.objectives.find((o) => o.hex === h)
}
