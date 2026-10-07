// Victory (DESIGN §5): rout the enemy, the attacker holding every objective at the end of a
// round, or the scenario's dusk condition after the last round.
import type { GameEvent } from '../contract/events.ts'
import type { GameState, Side } from '../contract/types.ts'
import { SCENARIOS } from './scenarios/index.ts'
import { other } from './units.ts'

export function finish(s: GameState, winner: Side, reason: NonNullable<GameState['endReason']>, ev: GameEvent[]): void {
  s.winner = winner
  s.endReason = reason
  s.phase = 'over'
  s.ordersLeft = 0
  s.active = null
  s.intents = []
  ev.push({ e: 'game-over', winner, reason })
  ev.push({ e: 'phase', phase: 'over', round: s.round })
}

const held = (s: GameState, side: Side): number => s.objectives.filter((o) => o.holder === side).length

/** A side at 0 candles (or with no pieces left) routs. If both break at once the defender stands. */
export function checkRout(s: GameState, ev: GameEvent[]): boolean {
  if (s.winner) return true
  const broken = (x: Side): boolean => s.morale[x] <= 0 || !s.units.some((u) => u.side === x)
  const br = broken('BR'), de = broken('DE')
  if (!br && !de) return false
  const attacker = SCENARIOS[s.scenario].attacker
  finish(s, br && de ? other(attacker) : br ? 'DE' : 'BR', 'rout', ev)
  return true
}

export function checkAllObjectives(s: GameState, ev: GameEvent[]): boolean {
  const attacker = SCENARIOS[s.scenario].attacker
  if (s.objectives.length === 0 || held(s, attacker) < s.objectives.length) return false
  finish(s, attacker, 'all-objectives', ev)
  return true
}

export function duskResult(s: GameState): Side {
  const d = SCENARIOS[s.scenario].dusk
  return held(s, d.side) >= d.need ? d.side : other(d.side)
}
