// DESIGN §11.6 "A, AI": plans are legal and end with endOrders, the time budgets hold, stickiness
// shells the pinned target; plus the named fixtures, pillar 1 (every British loss was inked or
// forecast) and purity of the rules/AI sources. The §11.7 balance gates run in `npm run selfplay`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Action, GameState, ScenarioId } from '../../src/contract/types.ts'
import { PROFILES, planTurn } from '../../src/ai/index.ts'
import { FIXTURES, apply, footprint, legal, newGame } from '../../src/rules/index.ts'
import type { FixtureName } from '../../src/rules/index.ts'
import { actingSide, unitAt } from '../../src/rules/state.ts'
import { H, blank, put } from './helpers.ts'

const key = (a: Action): string => JSON.stringify(a)

/** Orders-phase positions from seeded Veteran-vs-Recruit games of every scenario. */
function positions(): GameState[] {
  const out: GameState[] = []
  for (const sc of ['s1', 's2', 's3'] as ScenarioId[]) {
    for (const seed of [11, 12]) {
      let s = newGame(sc, seed, 'veteran')
      while (s.phase !== 'over') {
        out.push(s)
        const plan = planTurn(s, actingSide(s) === 'BR' ? PROFILES.veteran : PROFILES.recruit).actions
        for (const a of plan) { s = apply(s, a).state; if (s.phase === 'over') break }
      }
    }
  }
  return out
}
const POS = positions()

test('every plan is legal action by action, ends with endOrders and ends the phase', () => {
  let plans = 0
  for (const p of Object.values(PROFILES)) {
    for (const s0 of POS.filter((_, i) => i % 2 === 0)) {
      const plan = planTurn(s0, p).actions
      assert.equal(plan.at(-1)?.t, 'endOrders')
      let s = s0
      for (const a of plan) {
        assert.ok(legal(s).some((x) => key(x) === key(a)), `illegal ${key(a)}`)
        s = apply(s, a).state
        if (s.phase === 'over') break
      }
      assert.ok(s.phase !== s0.phase || s.round !== s0.round, 'the plan ended the orders phase')
      plans++
    }
  }
  assert.ok(plans > 100, `only ${plans} plans`)
})

test('the same position gives the same plan', () => {
  for (const s of POS.slice(0, 12)) assert.deepEqual(planTurn(s, PROFILES.veteran).actions, planTurn(s, PROFILES.veteran).actions)
})

test('time budgets: median aiMs Veteran <= 50 ms, General <= 150 ms', () => {
  const median = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[xs.length >> 1]
  const vet = POS.map((s) => planTurn(s, PROFILES.veteran).ms)
  const gen = POS.map((s) => planTurn(s, PROFILES.general).ms)
  assert.ok(median(vet) <= 50, `Veteran median ${median(vet).toFixed(1)} ms`)
  assert.ok(median(gen) <= 150, `General median ${median(gen).toFixed(1)} ms`)
})

test('stickiness: with one shell the AI shells the pinned company, not the mobile one', () => {
  const s = blank()
  put(s, 'pinned', 'BR', 'rifle', 'E5', { suppressedUntil: 4 })
  put(s, 'mobile', 'BR', 'rifle', 'I5')
  // the German observer (observed fire: the battery needs eyes within 3 hexes) sees both targets
  put(s, 'far', 'DE', 'rifle', 'G3', { suppressedUntil: 4 }) // pinned: it can watch, not assault
  s.phase = 'enemy-orders'
  s.ordersLeft = 1
  s.shells.DE.he = 1
  for (const d of ['veteran', 'general'] as const) {
    const plan = planTurn(s, PROFILES[d]).actions
    assert.ok(plan.some((a) => a.t === 'barrage' && a.target === H('E5')), `${d}: ${plan.map(key).join(' ')}`)
  }
})

test('red ink never lies: in S1 every British loss is forecast in its own orders or lands on an inked hex', () => {
  for (const seed of [21, 22, 23]) {
    let s = newGame('s1', seed, 'recruit')
    while (s.phase !== 'over') {
      const plan = planTurn(s, actingSide(s) === 'BR' ? PROFILES.recruit : PROFILES.veteran).actions
      for (const a of plan) {
        const inked = new Set(s.intents.map((i) => i.target))
        const phase = s.phase
        const step = apply(s, a)
        for (const e of step.events) {
          if (e.e !== 'figures') continue
          const u = s.units.find((x) => x.id === e.unit)
          if (!u || u.side !== 'BR') continue
          if (phase === 'player-orders' && a.t !== 'endOrders') continue // forecast before the click
          assert.ok(a.t === 'endOrders' && phase === 'player-orders' && inked.has(u.hex),
            `British loss outside the ink: ${e.unit} at ${u.hex} during ${phase}/${a.t}`)
        }
        s = step.state
        if (s.phase === 'over') break
      }
    }
  }
})

test('red ink never lies, gas included: each bell takes exactly the inked figures, only on inked hexes', () => {
  let gasInked = 0, bells = 0
  for (const sc of ['s1', 's3'] as ScenarioId[]) {
    for (const seed of [31, 32, 33, 34]) {
      let s = newGame(sc, seed, 'veteran')
      while (s.phase !== 'over') {
        const side = actingSide(s)!
        const plan = planTurn(s, side === 'BR' ? PROFILES.recruit : PROFILES.veteran).actions
        for (const a of plan) {
          const check = (bell: GameState, label: string): void => {
            const rung = apply(bell, { t: 'endOrders' })
            const lost = rung.events.filter((e) => e.e === 'figures' && bell.units.find((u) => u.id === e.unit)?.side === 'BR')
            const took = lost.reduce((n, e) => n + (e.e === 'figures' ? e.lost : 0), 0)
            assert.equal(took, bell.intents.reduce((n, i) => n + i.dmg, 0), `${sc}/${seed} ${label}: inked vs taken`)
            for (const e of lost) if (e.e === 'figures') assert.ok(new Set(bell.intents.flatMap((i) => footprint(bell, i))).has(bell.units.find((u) => u.id === e.unit)!.hex), `${sc}/${seed} ${label}: loss off the ink`)
            bells++
          }
          if (a.t === 'endOrders' && s.phase === 'player-orders') {
            check(s, `round ${s.round} bell`)
          }
          if (a.t === 'endOrders' && s.phase === 'enemy-orders') {
            gasInked += s.intents.filter((i) => i.kind === 'gas' && i.dmg > 0).length
            // Dusk and dawn pass, the British stand still, the bell rings: the ink inked at the end
            // of the enemy's orders must still be exact (wind turned at dawn, gas drifted).
            const dawned = apply(s, a).state
            if (dawned.phase === 'player-orders') {
              const lands = s.intents.filter((i) => i.dmg > 0).map((i) => i.id)
              for (const i of dawned.intents) if (lands.includes(i.id)) assert.equal(i.dmg, s.intents.find((x) => x.id === i.id)!.dmg, `${sc}/${seed}: ink changed over dawn`)
              check(dawned, `round ${dawned.round} bell after standing still`)
            }
          }
          s = apply(s, a).state
          if (s.phase === 'over') break
        }
      }
    }
  }
  assert.ok(bells > 40, `only ${bells} bells`)
  assert.ok(gasInked > 0, 'no gas intent was inked with damage in S3')
})

test('gas ink covers its target and the two hexes downwind of the wind that blows at the bell', () => {
  const s = blank()
  s.phase = 'enemy-orders'
  s.wind = { now: 0, next: 1 }
  const i = { id: 101, side: 'DE' as const, source: 'battery', kind: 'gas' as const, from: null, target: H('F5'), dmg: 0 }
  assert.deepEqual(footprint(s, i), [H('F5'), H('G5'), H('H4')], 'during enemy orders the wind of the next round (NE) carries it')
  s.phase = 'player-orders'
  s.wind = { now: 1, next: 3 }
  assert.deepEqual(footprint(s, i), [H('F5'), H('G5'), H('H4')], 'after dawn wind.now is that same wind')
  assert.deepEqual(footprint(s, { ...i, kind: 'barrage' }), [H('F5')])
})

test('fixtures are real positions that show what their screenshots need', () => {
  const f = (n: FixtureName): GameState => FIXTURES[n]()
  const pt = f('player-turn')
  assert.equal(pt.phase, 'player-orders')
  assert.equal(pt.round, 1)
  assert.equal(pt.intents[0].target, H('E7'))

  const et = f('enemy-turn')
  assert.equal(et.phase, 'enemy-orders')
  assert.ok(et.round >= 2 && et.intents.filter((i) => i.side === 'DE').length >= 2)
  assert.ok(new Set(et.intents.map((i) => i.target)).size >= 2, 'enemy-turn paints at least two hexes')

  const ar = f('artillery-resolve')
  assert.equal(ar.phase, 'bell')
  assert.ok(ar.intents.some((i) => i.kind === 'barrage' && unitAt(ar, i.target)?.side === 'BR'))
  const rung = apply(ar, { t: 'endOrders' })
  assert.ok(rung.events.some((e) => e.e === 'intent-resolved' && e.outcome === 'hit'))
  assert.ok(rung.events.some((e) => e.e === 'figures'))

  for (const [n, w] of [['victory', 'BR'], ['defeat', 'DE']] as const) {
    const s = f(n)
    assert.equal(s.phase, 'over')
    assert.equal(s.winner, w)
    assert.ok(s.ledger.length >= 4, `${n} has a ledger`)
    assert.deepEqual(legal(s), [])
  }
  const a = f('enemy-turn')
  a.units = []
  assert.ok(f('enemy-turn').units.length > 0, 'each call returns a fresh copy')
})

test('rules and AI are pure: no three, no DOM, no clock or Math.random in a decision', () => {
  const root = new URL('../../src/', import.meta.url).pathname
  const files = ['rules', 'rules/scenarios', 'ai'].flatMap((d) =>
    readdirSync(join(root, d)).filter((f) => f.endsWith('.ts')).map((f) => join(root, d, f)))
  assert.ok(files.length >= 15)
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')
    assert.ok(!/from ['"]three/.test(src), `${f} imports three`)
    assert.ok(!/\b(document|window|localStorage)\./.test(src), `${f} touches the DOM`)
    assert.ok(!/Math\.random|Date\.now|new Date\(/.test(src), `${f} reads a clock or Math.random`)
    if (!f.endsWith('ai/search.ts')) assert.ok(!/performance\.now/.test(src), `${f} reads performance.now`)
  }
})
