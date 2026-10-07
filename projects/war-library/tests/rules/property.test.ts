// DESIGN §11.6 property tests over 10,000 random legal actions (all three scenarios):
// forecast equals apply, inputs are never mutated, the same seed gives the same hashes, legal()
// agrees with apply() (every listed action applies, random unlisted ones throw), and the ledger
// always accounts for every figure lost.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Action, GameState, ScenarioId, Side } from '../../src/contract/types.ts'
import { N_HEX } from '../../src/rules/hex.ts'
import { apply, forecast, legal, newGame, stateHash } from '../../src/rules/index.ts'
import { stream } from '../../src/rules/rng.ts'
import { IllegalAction, actingSide } from '../../src/rules/state.ts'
import { UNIT_STATS } from '../../src/rules/units.ts'

const STEPS = 10_000
const SCENARIOS: ScenarioId[] = ['s1', 's2', 's3']

/** Pick a random legal action: a random kind first, so 117 barrage hexes do not drown the rest. */
function pick(acts: Action[], r: () => number): Action {
  const kinds = [...new Set(acts.map((a) => a.t))]
  let kind = kinds[Math.floor(r() * kinds.length)]
  if (kind === 'endOrders' && kinds.length > 1 && r() < 0.6) kind = kinds.filter((k) => k !== 'endOrders')[Math.floor(r() * (kinds.length - 1))]
  const of = acts.filter((a) => a.t === kind)
  return of[Math.floor(r() * of.length)]
}

/** A random action from the whole action space, legal or not (odd hexes and ids included). */
function junk(s: GameState, r: () => number): Action {
  const ids = [...s.units.map((u) => u.id), 'nobody']
  const id = ids[Math.floor(r() * ids.length)]
  const hex = r() < 0.05 ? [-1, N_HEX, 2.5][Math.floor(r() * 3)] : Math.floor(r() * N_HEX)
  switch (Math.floor(r() * 9)) {
    case 0: return { t: 'move', unit: id, to: hex }
    case 1: return { t: 'assault', unit: id, target: hex }
    case 2: return { t: 'fire', unit: id, target: hex }
    case 3: return { t: 'cut', unit: id, target: hex }
    case 4: return { t: 'pivot', unit: id, facing: Math.floor(r() * 7) as 0 }
    case 5: return { t: 'barrage', target: hex, shell: r() < 0.8 ? 'he' : 'gas' }
    case 6: return { t: 'creep', hexes: [hex, hex + 1, hex + (r() < 0.8 ? 2 : 13)] }
    case 7: return { t: 'sluice' }
    default: return { t: 'endOrders' }
  }
}

function checkInvariants(s: GameState, strAtStart: Map<string, number>): void {
  const hexes = new Set<number>()
  for (const u of s.units) {
    assert.ok(!hexes.has(u.hex), `two pieces on hex ${u.hex}`)
    hexes.add(u.hex)
    assert.ok(u.str >= 1 && u.str <= UNIT_STATS[u.kind].str, `${u.id} str ${u.str}`)
    assert.ok(s.terrain[u.hex] !== 'river' && s.terrain[u.hex] !== 'sea', `${u.id} in the water`)
  }
  for (const side of ['BR', 'DE'] as Side[]) assert.ok(s.morale[side] >= 0 && s.morale[side] <= Math.max(s.moraleStart[side], s.morale[side]))
  assert.ok(s.ordersLeft >= 0)
  if (s.phase !== 'over') assert.equal(s.winner, null)
  // The ledger accounts for every figure lost (DESIGN §11.6 D: ledger total = figures lost).
  const lost = new Map<string, number>()
  for (const l of s.ledger) lost.set(l.unit, (lost.get(l.unit) ?? 0) + l.figures)
  for (const [id, start] of strAtStart) {
    const u = s.units.find((x) => x.id === id)
    const pending = s.reinforcements.some((x) => x.unit.id === id)
    const now = u ? u.str : pending ? start : 0
    assert.equal(lost.get(id) ?? 0, start - now, `ledger for ${id}`)
  }
}

function walk(seed: number, steps: number, probe: boolean): string[] {
  const r = stream(seed)
  const hashes: string[] = []
  let game = 0
  let s = newGame(SCENARIOS[0], seed, 'veteran')
  let start = new Map<string, number>()
  const note = (x: GameState): void => {
    start = new Map([...x.units, ...x.reinforcements.map((q) => q.unit)].map((u) => [u.id, u.str]))
  }
  note(s)
  for (let i = 0; i < steps; i++) {
    if (s.phase === 'over') {
      game++
      s = newGame(SCENARIOS[game % 3], seed + game, 'veteran')
      note(s)
    }
    const acts = legal(s)
    assert.ok(acts.length > 0)
    const a = pick(acts, r)
    const before = JSON.stringify(s)
    const f = forecast(s, a)
    const step = apply(s, a)
    assert.equal(JSON.stringify(s), before, 'forecast/apply mutated their input')
    assert.ok(f.legal, `forecast says illegal: ${JSON.stringify(a)} (${f.label})`)
    // An independent tally of the same events.
    const me = actingSide(s)
    const sideOf = new Map<string, Side>([...s.units, ...step.state.units].map((u) => [u.id, u.side]))
    let dealt = 0, taken = 0
    for (const e of step.events) {
      if (e.e === 'figures') { if (sideOf.get(e.unit) === me) taken += e.lost; else dealt += e.lost }
      if (e.e === 'intent') dealt += e.intent.dmg
    }
    assert.deepEqual([f.dmgDealt, f.dmgTaken], [dealt, taken], `forecast != apply for ${JSON.stringify(a)}`)
    checkInvariants(step.state, start)
    if (probe) {
      const keys = new Set(acts.map((x) => JSON.stringify(x)))
      for (let j = 0; j < 3; j++) {
        const z = junk(s, r)
        if (keys.has(JSON.stringify(z))) assert.doesNotThrow(() => apply(s, z), JSON.stringify(z))
        else assert.throws(() => apply(s, z), IllegalAction, `apply accepted unlisted ${JSON.stringify(z)}`)
      }
    }
    s = step.state
    hashes.push(stateHash(s))
  }
  return hashes
}

test(`${STEPS} random legal actions: forecast = apply, no mutation, legal() = apply(), ledger balances`, () => {
  walk(20260927, STEPS, true)
})

test('the same seed gives the same hashes', () => {
  assert.equal(stateHash(newGame('s1', 42, 'recruit')), stateHash(newGame('s1', 42, 'recruit')))
  assert.notEqual(stateHash(newGame('s1', 42, 'recruit')), stateHash(newGame('s1', 43, 'recruit')))
  assert.deepEqual(walk(5, 1500, false), walk(5, 1500, false))
})

test('every legal action of every piece in the opening is accepted', () => {
  for (const sc of SCENARIOS) {
    const s = newGame(sc, 1, 'veteran')
    for (const a of legal(s)) assert.doesNotThrow(() => apply(s, a), `${sc} ${JSON.stringify(a)}`)
  }
})
