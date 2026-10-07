// Named states for the Lead's setState hook and the screenshots (DESIGN §11.3/§11.7). Each is a
// real position reached by seeded AI-vs-AI play of S1, so they are always legal and interesting;
// tests/rules/fixtures.test.ts pins what each must show.
import type { GameState } from '../contract/types.ts'
import { PROFILES } from '../ai/profiles.ts'
import type { AiProfile } from '../ai/profiles.ts'
import { planTurn } from '../ai/search.ts'
import { apply } from './apply.ts'
import { projectIntents, toBell } from './phases.ts'
import { newGame } from './setup.ts'
import { actingSide, clone, unitAt } from './state.ts'

export type FixtureName = 'player-turn' | 'enemy-turn' | 'artillery-resolve' | 'victory' | 'defeat'

type Look = (s: GameState) => GameState | null

/**
 * Play S1 from `seed`; after every order (and at each bell about to ring) ask `look` whether this
 * is the position wanted. Returns the first hit, or the finished game if `look` never answers.
 */
export function playS1(seed: number, br: AiProfile, de: AiProfile, look: Look): GameState {
  let s = newGame('s1', seed, 'recruit')
  for (let guard = 0; s.phase !== 'over' && guard < 64; guard++) {
    const side = actingSide(s)!
    const plan = planTurn(s, side === 'BR' ? br : de).actions
    for (const a of plan) {
      if (a.t === 'endOrders' && side === 'BR') {
        const bell = clone(s)
        toBell(bell, [])
        projectIntents(bell)
        const hit = look(bell)
        if (hit) return hit
      }
      s = apply(s, a).state
      const hit = look(s)
      if (hit) return hit
      if (s.phase === 'over') break
    }
  }
  return s
}

function find(seeds: number, br: AiProfile, de: AiProfile, look: Look, what: string): GameState {
  for (let seed = 42; seed < 42 + seeds; seed++) {
    const s = playS1(seed, br, de, look)
    const hit = look(s)
    if (hit) return hit
  }
  throw new Error(`no seed produced the ${what} fixture`)
}

const V = PROFILES.veteran, R = PROFILES.recruit, G = PROFILES.general

const BUILD: Record<FixtureName, () => GameState> = {
  // S1 round 1: the opening German barrage is inked on A Coy at E7.
  'player-turn': () => newGame('s1', 42, 'recruit'),
  // Mid-game, the Germans have spent their orders and red ink covers at least two hexes.
  'enemy-turn': () => find(20, V, V, (s) =>
    s.phase === 'enemy-orders' && s.round >= 2 && s.ordersLeft === 0 && new Set(s.intents.map((i) => i.target)).size >= 2 ? s : null, 'enemy-turn'),
  // The bell is about to ring on a barrage that will hit a British piece (a careless Recruit
  // stood on the ink).
  'artillery-resolve': () => find(20, R, V, (s) =>
    s.phase === 'bell' && s.round >= 2 &&
    s.intents.some((i) => i.kind === 'barrage' && unitAt(s, i.target)?.side === 'BR') ? s : null, 'artillery-resolve'),
  'victory': () => find(40, G, R, (s) => (s.phase === 'over' && s.winner === 'BR' && s.ledger.length >= 4 ? s : null), 'victory'),
  'defeat': () => find(40, R, G, (s) => (s.phase === 'over' && s.winner === 'DE' && s.ledger.length >= 4 ? s : null), 'defeat'),
}

const cache = new Map<FixtureName, GameState>()

export const FIXTURES: Record<FixtureName, () => GameState> = Object.fromEntries(
  (Object.keys(BUILD) as FixtureName[]).map((n) => [n, (): GameState => {
    if (!cache.has(n)) cache.set(n, BUILD[n]())
    return structuredClone(cache.get(n)!)
  }]),
) as Record<FixtureName, () => GameState>
