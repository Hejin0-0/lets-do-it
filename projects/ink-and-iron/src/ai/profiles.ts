// Difficulty = search settings only (DESIGN §6). Unit stats never change; weights are shared.
import type { Difficulty } from '../contract/types.ts'

export type EvalTerm =
  | 'objectives' | 'morale' | 'material' | 'suppressed' | 'advance' | 'exposure'
  | 'fanCover' | 'wire' | 'intentValue' | 'friendlyFire'

export interface AiProfile {
  beam: number
  k: number
  /** 0 = argmax. Otherwise softmax (Gumbel) noise in units of TEMP_SCALE evaluation points. */
  temperature: number
  replyWeight: number
  /** Re-score this many of the best plans by playing them through the enemy's greedy reply (0 = off). */
  verify: number
  stickiness: boolean
  /** Multiplies the attacker's advance term: how hard it presses toward the objectives. */
  aggression: number
  /** Extra advance by the last round (0 = flat): the attacker loses at dusk, so it presses harder as the candles burn. */
  urgency: number
  w: Record<EvalTerm, number>
}

/** One temperature unit, in evaluation points (a sixth of a rifle figure). Tuned by selfplay. */
export const TEMP_SCALE = 1.5

export const WEIGHTS: Record<EvalTerm, number> = {
  objectives: 40, morale: 6, material: 3, suppressed: 4, advance: 20, exposure: -3,
  fanCover: 3, wire: 1.5, intentValue: 2.5, friendlyFire: -4,
}

// aggression / urgency (selfplay, S1, 40 games a matchup): with neither, the reviewer's "dodger"
// (step off the red ink, fire the suggested shells, never fight) beat the General 100% and the
// Veteran 75% with no man lost — the attacker sat still and lost at dusk. General 1.8 / 2.5: the
// dodger loses 100%, and Veteran-as-British beats the General 62.5% (was 67.5%; 1.6 / 2 gave 35%
// but left the dodger winning every game). Veteran 1 / 1.5 (a push only as dusk nears): the dodger
// loses ~55%, and the cost is the terrain gate — the General-as-British beats this Veteran ~40%
// (was 60%), so that gate is retuned in scripts/selfplay.ts with this note.
// Known gap: in S3 (the Sluice) neither push moves the dodger result (it still wins ~70% against
// the General at 1.8-2.4 / 2.5-4): the German attack there is broken by morale before it lands.
export const PROFILES: Record<Difficulty, AiProfile> = {
  recruit: { beam: 1, k: 3, temperature: 1, replyWeight: 0, verify: 0, stickiness: false, aggression: 1, urgency: 0, w: WEIGHTS },
  veteran: { beam: 4, k: 6, temperature: 0.3, replyWeight: 0.5, verify: 0, stickiness: true, aggression: 1, urgency: 1.5, w: WEIGHTS },
  general: { beam: 8, k: 10, temperature: 0, replyWeight: 1, verify: 8, stickiness: true, aggression: 1.8, urgency: 2.5, w: WEIGHTS },
}

/** The opponent the verify ply imagines: a greedy, noiseless Recruit. */
export const REPLY: AiProfile = { ...PROFILES.recruit, temperature: 0 }
