// Beam search over one side's orders (DESIGN §6): one depth level per order; each child is
// scored evaluate(apply(s, a)) − replyWeight × bestReplyLoss; the final pick is a softmax over
// every plan the beam kept, drawn from a stream seeded by state.rng (the state is not touched).
import type { Action, GameState } from '../contract/types.ts'
import { apply } from '../rules/apply.ts'
import { draw } from '../rules/rng.ts'
import { IllegalAction, actingSide } from '../rules/state.ts'
import { candidates } from './candidates.ts'
import { TERMINAL, bestReplyLoss, evaluate, terms } from './evaluate.ts'
import { buildMaps } from './maps.ts'
import { REPLY, TEMP_SCALE } from './profiles.ts'
import type { AiProfile, EvalTerm } from './profiles.ts'

export interface PlanScore { score: number; terms: Record<EvalTerm, number>; plan: Action[] }
export interface Plan { actions: Action[]; ms: number; top: PlanScore[] }

interface Node { s: GameState; plan: Action[]; score: number; key: string }

// ponytail: performance.now() only times the search for the HUD/diagnostics; it never feeds a decision.
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : 0)

const actKey = (a: Action): string => JSON.stringify(a)

/** End my orders, let a greedy enemy answer, and stop when it is my turn again (or the battle ends). */
function playOut(x: GameState): GameState {
  if (x.phase === 'over') return x
  let y = apply(x, { t: 'endOrders' }).state
  if (y.phase === 'over') return y
  for (const a of planTurn(y, REPLY).actions) {
    y = apply(y, a).state
    if (y.phase === 'over') break
  }
  return y
}

export function planTurn(s: GameState, p: AiProfile): Plan {
  const t0 = now()
  const me = actingSide(s)
  if (!me) return { actions: s.phase === 'over' ? [] : [{ t: 'endOrders' }], ms: 0, top: [] }
  const m = buildMaps(s, me)
  let seed = (s.rng ^ Math.imul(s.round, 0x9e3779b1) ^ (me === 'BR' ? 0x5bd1e995 : 0x1b873593)) >>> 0
  const rand = (): number => { const [v, n] = draw(seed); seed = n; return v }
  const gumbel = (): number => -Math.log(-Math.log(rand() * 0.999998 + 1e-6))
  const tau = p.temperature * TEMP_SCALE
  const noisy = (n: Node): number => (tau > 0 ? n.score / tau + gumbel() : n.score)

  const score = (x: GameState): number => {
    if (x.winner) return x.winner === me ? TERMINAL : -TERMINAL
    const t = terms(x, me, p, m)
    let v = 0
    for (const k in t) v += t[k as EvalTerm]
    return v - (p.replyWeight > 0 ? p.replyWeight * bestReplyLoss(x, me, p, m) : 0)
  }

  let beam: Node[] = [{ s, plan: [], score: score(s), key: '' }]
  const kept: Node[] = [...beam]
  const depth = s.ordersLeft
  for (let d = 0; d < depth; d++) {
    const seen = new Set<string>()
    const children: Node[] = []
    for (const node of beam) {
      if (node.s.phase !== s.phase) continue
      for (const c of candidates(node.s, me, m, p)) {
        const plan = [...node.plan, ...c.actions]
        const key = node.key ? [...node.key.split('|'), c.actions.map(actKey).join('+')].sort().join('|') : c.actions.map(actKey).join('+')
        if (seen.has(key)) continue
        seen.add(key)
        let x = node.s
        try {
          for (const a of c.actions) x = apply(x, a).state
        } catch (err) {
          if (err instanceof IllegalAction) continue
          throw err
        }
        children.push({ s: x, plan, score: score(x), key })
      }
    }
    if (!children.length) break
    // Stochastic beam (Gumbel top-k): at temperature 0 this is the plain top `beam`.
    const keyed = children.map((n) => ({ n, k: noisy(n) })).sort((a, b) => b.k - a.k)
    beam = keyed.slice(0, p.beam).map((x) => x.n)
    kept.push(...beam)
  }
  // Softmax over every plan the beam kept (stopping early is a plan too). With `verify`, the best
  // few are first re-scored by playing them on through the bell/dusk and the enemy's greedy reply.
  let pool = kept
  if (p.verify > 0) {
    pool = kept.slice().sort((a, b) => b.score - a.score).slice(0, p.verify)
      .map((n) => ({ ...n, score: evaluate(playOut(n.s), me, p) }))
  }
  let pick = pool[0]
  let best = -Infinity
  for (const n of pool) { const k = noisy(n); if (k > best) { best = k; pick = n } }
  const top = kept.slice().sort((a, b) => b.score - a.score).slice(0, 3)
    .map((n) => ({ score: n.score, terms: terms(n.s, me, p, m), plan: n.plan }))
  return { actions: [...pick.plan, { t: 'endOrders' }], ms: now() - t0, top }
}
