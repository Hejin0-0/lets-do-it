// evaluate(state) for one side (DESIGN §6). Every term is reported separately so ?debug can show
// why a plan won; weights live in profiles.ts.
import type { GameState, Intent, Side, Unit } from '../contract/types.ts'
import { fanFrom } from '../rules/movement.ts'
import { isSupp, unitAt } from '../rules/state.ts'
import { VALUE, canCapture, other } from '../rules/units.ts'
import { buildMaps, coverAt, dmgAt } from './maps.ts'
import type { Maps } from './maps.ts'
import type { AiProfile, EvalTerm } from './profiles.ts'

export const TERMINAL = 1e6

/**
 * Multiplier on the attacker's advance weight. An outside review watched the German General sit
 * still from round 3 to round 8 and lose at dusk: nothing in the evaluation knew the dusk was
 * coming. Aggression is the difficulty's push; urgency adds to it round by round.
 */
export const drive = (s: GameState, p: AiProfile): number =>
  p.aggression * (1 + p.urgency * (s.round - 1) / Math.max(1, s.maxRounds - 1))

/** Points one figure of `u` is worth: its material value plus the candle it snuffs. */
export const figure = (p: AiProfile, u: Unit): number => p.w.material * VALUE[u.kind] + p.w.morale

/** ⟨G2⟩ how hard the target will find it to step out of the red ink. */
export function stickiness(s: GameState, u: Unit | undefined, p: AiProfile): number {
  if (!p.stickiness) return 1
  if (!u) return 0.3
  if (isSupp(u) || s.wire[u.hex] || u.bogged) return 1
  const held = s.objectives.filter((o) => o.holder === u.side)
  if (u.kind === 'mg' && held.length && fanFrom(s, u.hex, u.facing).some((h) => held.some((o) => o.hex === h))) return 1
  if (s.objectives.some((o) => o.hex === u.hex)) return 0.8
  return 0.3
}

/**
 * Figures `u` standing on `h` stands to lose to the enemy's next orders, discounted by ⟨G2⟩
 * stickiness when `m.dodge` (a mobile piece steps out of red ink before it lands).
 */
export function risk(s: GameState, m: Maps, p: AiProfile, u: Unit, h = u.hex): number {
  const d = dmgAt(s, m, u, h)
  return m.dodge && d > 0 ? d * stickiness(s, h === u.hex ? u : { ...u, hex: h }, p) : d
}

/** Does this intent still land before the battle ends? The AI's round-8 ink never does. */
const lands = (s: GameState, i: Intent): boolean => i.side === s.human || s.phase !== 'enemy-orders' || s.round < s.maxRounds

export function terms(s: GameState, me: Side, p: AiProfile, m: Maps): Record<EvalTerm, number> {
  const op = other(me)
  const t: Record<EvalTerm, number> = {
    objectives: 0, morale: 0, material: 0, suppressed: 0, advance: 0, exposure: 0,
    fanCover: 0, wire: 0, intentValue: 0, friendlyFire: 0,
  }
  for (const o of s.objectives) t.objectives += o.holder === me ? 1 : o.holder === op ? -1 : 0
  t.morale = s.morale[me] - s.morale[op]
  const myHeld = s.objectives.filter((o) => o.holder === me)
  for (const u of s.units) {
    const sign = u.side === me ? 1 : -1
    t.material += sign * u.str * VALUE[u.kind]
    if (u.side === op) { if (isSupp(u)) t.suppressed += 1; continue }
    if (m.attacker && canCapture(u.kind) && m.objDist[u.hex] < Infinity) t.advance += 1 - m.objDist[u.hex] / m.maxDist
    t.exposure += risk(s, m, p, u) * (1 - Math.min(3, coverAt(s, m, u, u.hex)) / 3)
    if (u.kind === 'mg' && !isSupp(u) && myHeld.length) {
      const f = fanFrom(s, u.hex, u.facing)
      t.fanCover += myHeld.filter((o) => f.includes(o.hex)).length
    }
  }
  for (let h = 0; h < s.wire.length; h++) {
    if (!s.wire[h] || m.wireObj[h] < 0) continue
    const holder = s.objectives[m.wireObj[h]].holder
    t.wire += holder === me ? 1 : holder === op ? -1 : 0
  }
  for (const i of s.intents) {
    if (!lands(s, i)) continue
    const target = unitAt(s, i.target)
    if (i.side === me) {
      t.intentValue += i.dmg * stickiness(s, target, p)
      if (target && target.side === me && (i.kind === 'barrage' || i.kind === 'gas')) t.friendlyFire += Math.min(2, target.str)
    } else if (target && target.side === me) {
      // Their ink lands at the bell before I decide again: a certain loss unless I step out.
      t.material -= i.dmg * VALUE[target.kind]
      t.morale -= i.dmg
    }
  }
  for (const k of Object.keys(t) as EvalTerm[]) t[k] *= p.w[k]
  t.advance *= drive(s, p)
  return t
}

export function evaluate(s: GameState, side: Side, p: AiProfile, maps?: Maps): number {
  if (s.winner) return s.winner === side ? TERMINAL : -TERMINAL
  const t = terms(s, side, p, maps ?? buildMaps(s, side))
  let v = 0
  for (const k in t) v += t[k as EvalTerm]
  return v
}

/**
 * The enemy's best single reply, in evaluation points: the most valuable figures one of its orders
 * could take off one of my pieces, or an objective of mine it could walk onto unopposed.
 */
export function bestReplyLoss(s: GameState, me: Side, p: AiProfile, m: Maps): number {
  let worst = 0
  for (const u of s.units) {
    if (u.side !== me) continue
    const d = risk(s, m, p, u) * figure(p, u)
    if (d > worst) worst = d
  }
  for (const o of s.objectives) {
    if (o.holder !== me || !m.capture[o.hex] || unitAt(s, o.hex)) continue
    const loss = 2 * p.w.objectives + 3 * p.w.morale
    if (loss > worst) worst = loss
  }
  return worst
}
