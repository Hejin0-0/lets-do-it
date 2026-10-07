// FROZEN AT G0 (docs/DESIGN.md §11.3). The rules core emits these; the board, the audio and
// the HUD replay them. Every consumer switches on `e` exhaustively, so adding a variant here is
// a compile error everywhere it is not yet handled — which is the point.
import type { Dir, HexId, Intent, Phase, Rule, Side } from './types.ts'

export type GameEvent =
  | { e: 'phase'; phase: Phase; round: number }
  | { e: 'moved'; unit: string; path: HexId[] }
  | { e: 'pivoted'; unit: string; facing: Dir }
  | { e: 'attack'; kind: Rule; by: string; target: HexId; dmg: number }
  | { e: 'figures'; unit: string; lost: number; left: number }
  | { e: 'destroyed' | 'suppressed' | 'recovered' | 'dug-in' | 'bogged' | 'reinforce'; unit: string }
  | { e: 'intent'; intent: Intent }
  | { e: 'intent-resolved'; id: number; outcome: 'hit' | 'empty' | 'cancelled' }
  | { e: 'crater' | 'wire-cut'; hex: HexId }
  | { e: 'gas' | 'flood'; hexes: HexId[] }
  | { e: 'captured'; hex: HexId; by: Side }
  | { e: 'morale'; side: Side; value: number; delta: number }
  | { e: 'weather'; now: string; next: string }
  | { e: 'wind'; now: Dir; next: Dir }
  | { e: 'game-over'; winner: Side; reason: string }

// The bus carries audio by NAME; audio/cues.ts owns what each name sounds like.
export type CueName =
  | 'select' | 'deselect' | 'place' | 'step' | 'pivot' | 'invalid'
  | 'overwatch' | 'fire' | 'incoming' | 'blast' | 'assault' | 'figure-lost'
  | 'intent' | 'capture' | 'bell' | 'wire-cut' | 'gas' | 'flood' | 'dig-in'
  | 'morale' | 'weather' | 'reinforce' | 'undo' | 'victory' | 'defeat' | 'ui'
