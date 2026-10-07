// DESIGN §5 and §11.6 "A, rules": the locked arithmetic ⟨G1⟩, terrain, movement stops, phases,
// red ink, morale and the three victories. Run: npm run test:rules
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, legal } from '../../src/rules/apply.ts'
import { forecast } from '../../src/rules/forecast.ts'
import { NEIGH, hexName } from '../../src/rules/hex.ts'
import { explore, fan, reach } from '../../src/rules/movement.ts'
import { newGame } from '../../src/rules/setup.ts'
import { IllegalAction, isSupp } from '../../src/rules/state.ts'
import { describeIntent, planSlip } from '../../src/rules/intents.ts'
import { END, H, blank, dummies, put, run, terrain, unit, wire } from './helpers.ts'

const figuresLost = (events: ReturnType<typeof run>['events'], id: string): number =>
  events.reduce((n, e) => n + (e.e === 'figures' && e.unit === id ? e.lost : 0), 0)

test('S1 opens on round 1 with the German barrage inked on A Coy at E7', () => {
  const s = newGame('s1', 42, 'recruit')
  assert.equal(s.phase, 'player-orders')
  assert.equal(s.round, 1)
  assert.equal(s.ordersLeft, 3)
  assert.equal(s.intents.length, 1)
  const i = s.intents[0]
  assert.equal(i.kind, 'barrage')
  assert.equal(hexName(i.target), 'E7')
  assert.equal(i.dmg, 2, 'A Coy would lose 2 if it stayed')
  assert.equal(s.units.find((u) => u.hex === H('E7'))?.name, 'A Coy')
  assert.equal(planSlip(s), "Intercepted, by runner: 'Shell the British fire trench at E7 at first light.'")
  assert.equal(forecast(s, { t: 'move', unit: 'br-a', to: H('D7') }).label, 'Trench · cover 2 · safe')
})

test('G1: a rifle assaulting a dug-in trench rifle deals 0 and loses 1', () => {
  const s = blank(); dummies(s)
  terrain(s, 'trench', 'E5')
  put(s, 'a', 'BR', 'rifle', 'E6')
  put(s, 'd', 'DE', 'rifle', 'E5', { dugIn: true })
  const f = forecast(s, { t: 'assault', unit: 'a', target: H('E5') })
  assert.deepEqual([f.dmgDealt, f.dmgTaken], [0, 1])
  const { state } = run(s, { t: 'assault', unit: 'a', target: H('E5') })
  assert.equal(unit(state, 'd')!.str, 4)
  assert.equal(unit(state, 'a')!.str, 3)
})

test('G1: a barrage then an assault destroys a full company (2, then 2+2-2)', () => {
  const s = blank(); dummies(s)
  terrain(s, 'trench', 'E5')
  put(s, 'a', 'BR', 'rifle', 'E6')
  put(s, 'd', 'DE', 'rifle', 'E5', { dugIn: true })
  let { state, events } = run(s, { t: 'barrage', target: H('E5'), shell: 'he' })
  assert.equal(figuresLost(events, 'd'), 2)
  assert.ok(isSupp(unit(state, 'd')!))
  assert.equal(unit(state, 'd')!.dugIn, false)
  ;({ state, events } = run(state, { t: 'assault', unit: 'a', target: H('E5') }))
  assert.equal(figuresLost(events, 'd'), 2)
  assert.equal(unit(state, 'd'), undefined)
  assert.equal(unit(state, 'a')!.hex, H('E5'), 'the assault advances into the cleared hex')
  assert.equal(unit(state, 'a')!.str, 4)
})

test('G1: a rifle assaulting an unsuppressed trench MG deals 0 and loses 2; barrage first destroys it', () => {
  const s = blank(); dummies(s)
  terrain(s, 'trench', 'E5')
  put(s, 'a', 'BR', 'rifle', 'E6')
  put(s, 'm', 'DE', 'mg', 'E5', { dugIn: true, facing: 3 })
  const bare = run(s, { t: 'assault', unit: 'a', target: H('E5') }).state
  assert.equal(unit(bare, 'm')!.str, 3)
  assert.equal(unit(bare, 'a')!.str, 2)
  const combo = run(s, { t: 'barrage', target: H('E5'), shell: 'he' }, { t: 'assault', unit: 'a', target: H('E5') }).state
  assert.equal(unit(combo, 'm'), undefined)
})

test('G1: enfilade then Wave against a dug-in rifle deals 1, then 2', () => {
  const s = blank(); dummies(s)
  terrain(s, 'trench', 'C7', 'D7', 'E7')
  put(s, 'a', 'BR', 'rifle', 'C7')
  put(s, 'b', 'BR', 'rifle', 'E7')
  put(s, 'd', 'DE', 'rifle', 'D7', { dugIn: true })
  const one = run(s, { t: 'assault', unit: 'a', target: H('D7') })
  assert.equal(figuresLost(one.events, 'd'), 1)
  assert.equal(unit(one.state, 'a')!.str, 4, 'strike back max(0, 2-1-2) = 0')
  const two = run(one.state, { t: 'assault', unit: 'b', target: H('D7') })
  assert.equal(figuresLost(two.events, 'd'), 2)
})

test('blockhouse: cover 3, and a barrage deals 0 there but still suppresses', () => {
  const s = blank(); dummies(s)
  terrain(s, 'blockhouse', 'G3')
  put(s, 'a', 'BR', 'rifle', 'G4')
  put(s, 'm', 'DE', 'mg', 'G3', { facing: 3 })
  const f = forecast(s, { t: 'assault', unit: 'a', target: H('G3') })
  assert.equal(f.dmgDealt, 0)
  const { state, events } = run(s, { t: 'barrage', target: H('G3'), shell: 'he' })
  assert.equal(figuresLost(events, 'm'), 0)
  assert.ok(isSupp(unit(state, 'm')!))
  assert.equal(state.terrain[H('G3')], 'blockhouse', 'no crater in a blockhouse')
  assert.equal(forecast(state, { t: 'assault', unit: 'a', target: H('G3') }).dmgDealt, 1, '2+2-3')
})

test('fan: 15 hexes in the open, clipped by line of sight', () => {
  const s = blank(); dummies(s)
  put(s, 'm', 'DE', 'mg', 'G5', { facing: 0 })
  assert.equal(fan(s, 'm').length, 15)
  terrain(s, 'ruin', 'G4')
  const f = fan(s, 'm')
  assert.ok(f.includes(H('G4')), 'the ruin itself is seen')
  assert.ok(!f.includes(H('G3')) && !f.includes(H('G2')), 'hexes behind it are not')
})

test('overwatch: entering open ground in an MG fan costs 2, pins and stops; trench, suppressed MGs and tanks are exempt', () => {
  const s = blank(); dummies(s)
  put(s, 'm', 'DE', 'mg', 'G2', { facing: 3 })
  put(s, 'r', 'BR', 'rifle', 'G6')
  assert.equal(reach(s, 'r').get(H('G5'))?.stop, 'overwatch')
  const f = forecast(s, { t: 'move', unit: 'r', to: H('G5') })
  assert.equal(f.dmgTaken, 2)
  assert.ok(f.effects.includes('pin') && f.effects.includes('stop'))
  const { state, events } = run(s, { t: 'move', unit: 'r', to: H('G5') })
  assert.ok(events.some((e) => e.e === 'attack' && e.kind === 'overwatch' && e.by === 'm'))
  assert.equal(unit(state, 'r')!.str, 2)
  assert.ok(isSupp(unit(state, 'r')!))
  assert.throws(() => apply(state, { t: 'cut', unit: 'r', target: H('G5') }), IllegalAction)
  assert.ok(!legal(state).some((a) => 'unit' in a && a.unit === 'r'), 'a pinned piece has no orders')

  const dug = blank(); dummies(dug)
  put(dug, 'm', 'DE', 'mg', 'G2', { facing: 3 })
  put(dug, 'r', 'BR', 'rifle', 'G6')
  terrain(dug, 'trench', 'G5')
  assert.equal(unit(run(dug, { t: 'move', unit: 'r', to: H('G5') }).state, 'r')!.str, 4, 'trench never triggers')

  const quiet = blank(); dummies(quiet)
  put(quiet, 'm', 'DE', 'mg', 'G2', { facing: 3, suppressedUntil: 9 })
  put(quiet, 'r', 'BR', 'rifle', 'G6')
  assert.equal(unit(run(quiet, { t: 'move', unit: 'r', to: H('G4') }).state, 'r')!.str, 4, 'a suppressed MG holds fire')

  const tank = blank(); dummies(tank)
  put(tank, 'm', 'DE', 'mg', 'G2', { facing: 3 })
  put(tank, 't', 'BR', 'tank', 'G6')
  assert.equal(unit(run(tank, { t: 'move', unit: 't', to: H('G4') }).state, 't')!.str, 4, 'overwatch deals a tank 0')
})

test('ZOC: a piece stops on entering a hex next to an enemy and never passes through one; the Stoßtrupp ignores it', () => {
  const s = blank(); dummies(s)
  put(s, 'e', 'DE', 'rifle', 'G3')
  put(s, 'r', 'BR', 'rifle', 'G5')
  const zoc = new Set(NEIGH[H('G3')])
  const r = reach(s, 'r')
  assert.equal(r.get(H('G4'))?.stop, 'zoc')
  for (const [, info] of r) for (const h of info.path.slice(1, -1)) assert.ok(!zoc.has(h), `path passes ZOC hex ${hexName(h)}`)
  assert.equal(unit(run(s, { t: 'move', unit: 'r', to: H('G4') }).state, 'r')!.hex, H('G4'))
  const st = blank(); dummies(st)
  put(st, 'e', 'BR', 'rifle', 'G3')
  put(st, 'x', 'DE', 'stoss', 'G5')
  st.phase = 'enemy-orders'
  assert.equal(explore(st, unit(st, 'x')!).get(H('G4'))?.stop, null)
})

test('wire: stops infantry, blocks assaults from it, can be cut; the Stoßtrupp ignores it and a tank crushes it', () => {
  const s = blank(); dummies(s)
  wire(s, 'G4')
  put(s, 'r', 'BR', 'rifle', 'G5')
  put(s, 'e', 'DE', 'rifle', 'G3')
  const r = reach(s, 'r')
  assert.equal(r.get(H('G4'))?.stop, 'wire')
  for (const [, info] of r) assert.ok(!info.path.slice(1, -1).includes(H('G4')))
  const inWire = run(s, { t: 'move', unit: 'r', to: H('G4') }).state
  assert.throws(() => apply(inWire, { t: 'assault', unit: 'r', target: H('G3') }), IllegalAction)
  const cut = run(inWire, { t: 'cut', unit: 'r', target: H('G4') })
  assert.equal(cut.state.wire[H('G4')], false)
  assert.ok(cut.events.some((e) => e.e === 'wire-cut'))

  const t = blank(); dummies(t)
  wire(t, 'G4')
  put(t, 'k', 'BR', 'tank', 'G5')
  const crushed = run(t, { t: 'move', unit: 'k', to: H('G3') }).state
  assert.equal(crushed.wire[H('G4')], false)

  const st = blank(); dummies(st)
  wire(st, 'G4')
  put(st, 'x', 'DE', 'stoss', 'G5')
  st.phase = 'enemy-orders'
  assert.equal(explore(st, unit(st, 'x')!).get(H('G4'))?.stop, null)
  assert.ok(explore(st, unit(st, 'x')!).has(H('G2')))
})

test('mud: rain turns polder and craters to cost 3 (one step is always allowed)', () => {
  const s = blank(); dummies(s)
  terrain(s, 'polder', 'G4')
  put(s, 'r', 'BR', 'rifle', 'G5')
  assert.equal(reach(s, 'r').get(H('G4'))?.cost, 2)
  s.weather = { now: 'rain', next: 'rain' }
  assert.equal(reach(s, 'r').get(H('G4'))?.cost, 3)
  assert.ok(!reach(s, 'r').has(H('G3')))
})

test('bogging: a Mark IV ending a round in a crater cannot move next round, then frees itself', () => {
  const s = blank(); dummies(s)
  terrain(s, 'crater', 'G5')
  put(s, 'k', 'BR', 'tank', 'G5')
  let { state, events } = run(s, END, END)
  assert.ok(events.some((e) => e.e === 'bogged' && e.unit === 'k'))
  assert.equal(state.phase, 'player-orders')
  assert.equal(reach(state, 'k').size, 0)
  assert.ok(!legal(state).some((a) => a.t === 'move' && a.unit === 'k'))
  ;({ state } = run(state, END, END))
  assert.equal(unit(state, 'k')!.bogged, false)
  assert.ok(reach(state, 'k').size > 0)
})

test('suppression expires at the end of the owner\'s next orders phase, whenever it was applied', () => {
  const recovered = (ev: ReturnType<typeof run>['events'], id: string): boolean => ev.some((e) => e.e === 'recovered' && e.unit === id)
  // (a) applied in the player's orders (overwatch pin), lasts through the next player phase.
  let s = blank(); dummies(s)
  put(s, 'm', 'DE', 'mg', 'G2', { facing: 3 })
  put(s, 'r', 'BR', 'rifle', 'G6')
  let x = run(s, { t: 'move', unit: 'r', to: H('G5') }, END, END)
  assert.equal(x.state.round, 2)
  assert.ok(isSupp(unit(x.state, 'r')!), 'still pinned in round 2 orders')
  x = run(x.state, END)
  assert.ok(recovered(x.events, 'r') && !isSupp(unit(x.state, 'r')!))

  // (b) applied at the bell (a German barrage lands), lasts through the next player phase.
  s = blank(); dummies(s)
  put(s, 'r', 'BR', 'rifle', 'G6')
  s.intents.push({ id: 101, side: 'DE', source: 'battery', kind: 'barrage', from: null, target: H('G6'), dmg: 0 })
  x = run(s, END)
  assert.ok(isSupp(unit(x.state, 'r')!))
  x = run(x.state, END)
  assert.ok(isSupp(unit(x.state, 'r')!), 'through dusk and dawn into round 2 orders')
  assert.throws(() => apply(x.state, { t: 'move', unit: 'r', to: H('G7') }), IllegalAction)
  x = run(x.state, END)
  assert.ok(recovered(x.events, 'r'))

  // (c) applied in the enemy's orders (a British Vickers pins a German mover).
  s = blank(); dummies(s)
  put(s, 'v', 'BR', 'mg', 'G7', { facing: 0 })
  put(s, 'g', 'DE', 'rifle', 'G3')
  x = run(s, END)
  x = run(x.state, { t: 'move', unit: 'g', to: H('G4') })
  assert.ok(isSupp(unit(x.state, 'g')!))
  x = run(x.state, END, END)
  assert.equal(x.state.phase, 'enemy-orders')
  assert.ok(isSupp(unit(x.state, 'g')!), 'still pinned in its round 2 orders')
  x = run(x.state, END)
  assert.ok(recovered(x.events, 'g'))

  // (d) applied at dawn (a creeping barrage steps onto a German company).
  s = blank({ scenario: 's2' }); dummies(s)
  put(s, 'g', 'DE', 'rifle', 'G4')
  x = run(s, { t: 'creep', hexes: [H('F5'), H('G5'), H('H5')] }, END, END)
  assert.equal(x.state.round, 2)
  assert.ok(x.events.some((e) => e.e === 'figures' && e.unit === 'g'), 'the creep stepped north onto G4 at dawn')
  assert.ok(isSupp(unit(x.state, 'g')!))
  x = run(x.state, END)
  assert.ok(isSupp(unit(x.state, 'g')!), 'suppressed through its round 2 orders')
  x = run(x.state, END)
  assert.ok(recovered(x.events, 'g'))
})

test('gas ink: the forecast counts every British figure the cloud takes, target and downwind', () => {
  const s = blank({ scenario: 's3' }); dummies(s)
  s.wind = { now: 3, next: 1 } // it will blow north-east at the bell
  put(s, 'a', 'BR', 'rifle', 'F5')
  put(s, 'b', 'BR', 'rifle', 'H4') // two hexes downwind
  put(s, 'g', 'DE', 'rifle', 'G5') // a German caught in its own cloud is not counted
  s.phase = 'enemy-orders'
  s.ordersLeft = 1
  s.shells.DE.gas = 1
  const x = run(s, { t: 'barrage', target: H('F5'), shell: 'gas' })
  const ink = x.state.intents[0]
  assert.equal(ink.kind, 'gas')
  assert.equal(ink.dmg, 2)
  const bell = run(x.state, END, END) // dusk and dawn, then the British stand still and ring
  assert.equal(figuresLost(bell.events, 'a'), 1)
  assert.equal(figuresLost(bell.events, 'b'), 1)
  assert.equal(figuresLost(bell.events, 'g'), 1)
  assert.ok(isSupp(unit(bell.state, 'a')!) && isSupp(unit(bell.state, 'b')!))
})

test('red ink: an intent is cancelled when its source is suppressed, destroyed or has left its hex', () => {
  const declared = (): ReturnType<typeof run> => {
    const s = blank(); dummies(s)
    put(s, 'r', 'BR', 'rifle', 'G6')
    put(s, 'v', 'BR', 'mg', 'H7', { facing: 0 })
    put(s, 'g', 'DE', 'rifle', 'G5')
    s.phase = 'enemy-orders'
    const x = run(s, { t: 'assault', unit: 'g', target: H('G6') })
    assert.equal(x.state.intents.length, 1, 'the AI assault is ink, not an instant attack')
    assert.equal(figuresLost(x.events, 'r'), 0)
    return run(x.state, END)
  }
  const cancelled = (ev: ReturnType<typeof run>['events']): boolean => ev.some((e) => e.e === 'intent-resolved' && e.outcome === 'cancelled')
  // suppressed by a British barrage
  let x = declared()
  x = run(x.state, { t: 'barrage', target: H('G5'), shell: 'he' })
  assert.ok(cancelled(x.events))
  assert.equal(x.state.intents.length, 0)
  // destroyed by the Vickers
  x = declared()
  x.state.units.find((u) => u.id === 'g')!.str = 2
  x = run(x.state, { t: 'fire', unit: 'v', target: H('G5') })
  assert.ok(x.events.some((e) => e.e === 'destroyed' && e.unit === 'g') && cancelled(x.events))
  // left its hex (e.g. washed off by the flood): lands as cancelled at the bell
  x = declared()
  x.state.units.find((u) => u.id === 'g')!.hex = H('F5')
  x = run(x.state, END)
  assert.ok(cancelled(x.events))
  assert.equal(unit(x.state, 'r')!.str, 4)
})

test('G10: an assault on an empty hex advances and captures; red ink only hurts pieces on inked hexes', () => {
  const s = blank(); dummies(s)
  s.objectives = [{ hex: H('G6'), name: 'Bridge', holder: 'BR' }]
  s.morale = { BR: 10, DE: 10 }
  s.moraleStart = { BR: 10, DE: 12 }
  put(s, 'r', 'BR', 'rifle', 'G6')
  put(s, 'q', 'BR', 'rifle', 'I7')
  put(s, 'g', 'DE', 'rifle', 'G5')
  s.phase = 'enemy-orders'
  let x = run(s, { t: 'assault', unit: 'g', target: H('G6') }, { t: 'barrage', target: H('I7'), shell: 'he' }, END)
  assert.equal(x.state.phase, 'player-orders')
  x = run(x.state, { t: 'move', unit: 'r', to: H('F7') })
  const bell = run(x.state, END)
  assert.ok(bell.events.some((e) => e.e === 'intent-resolved' && e.outcome === 'empty'))
  assert.equal(unit(bell.state, 'g')!.hex, H('G6'))
  assert.equal(bell.state.objectives[0].holder, 'DE')
  assert.ok(bell.events.some((e) => e.e === 'captured' && e.by === 'DE'))
  assert.equal(unit(bell.state, 'r')!.str, 4, 'the piece that stepped off the ink is untouched')
  assert.equal(unit(bell.state, 'q')!.str, 2, 'the piece that stayed on it is not')
  assert.equal(bell.state.morale.BR, 10 - 2 - 2, '-2 for the bridge, -1 per figure')
  assert.equal(bell.state.morale.DE, 11, '+1 for the capture')
})

test('morale: -1 per figure, +1 per capture only up to the starting count, rout at 0', () => {
  const s = blank(); dummies(s)
  s.objectives = [{ hex: H('G5'), name: 'Ruin', holder: null }]
  s.morale = { BR: 20, DE: 1 }
  put(s, 'r', 'BR', 'rifle', 'G6')
  const cap = run(s, { t: 'move', unit: 'r', to: H('G5') })
  assert.equal(cap.state.morale.BR, 20, 'capped at the starting count')
  assert.equal(cap.state.objectives[0].holder, 'BR')
  put(s, 'g', 'DE', 'rifle', 'G4')
  const rout = run(s, { t: 'barrage', target: H('G4'), shell: 'he' })
  assert.equal(rout.state.morale.DE, 0)
  assert.equal(rout.state.phase, 'over')
  assert.equal(rout.state.winner, 'BR')
  assert.equal(rout.state.endReason, 'rout')
  assert.ok(rout.events.some((e) => e.e === 'game-over'))
  assert.throws(() => apply(rout.state, END), IllegalAction)
  assert.deepEqual(legal(rout.state), [])
})

test('victory: the attacker holding every objective at a dusk wins at once', () => {
  const s = blank(); dummies(s)
  s.objectives = [{ hex: H('C5'), name: 'A', holder: 'DE' }, { hex: H('K5'), name: 'B', holder: 'BR' }]
  put(s, 'g', 'DE', 'rifle', 'K4')
  s.phase = 'enemy-orders'
  const x = run(s, { t: 'move', unit: 'g', to: H('K5') }, END)
  assert.equal(x.state.winner, 'DE')
  assert.equal(x.state.endReason, 'all-objectives')
})

test('victory: at the last dusk the British need two objectives', () => {
  const at8 = (held: number): ReturnType<typeof run> => {
    const s = blank({ round: 8 }); dummies(s)
    s.objectives = ['D8', 'H8', 'L8'].map((h, i) => ({ hex: H(h), name: h, holder: i < held ? 'BR' as const : 'DE' as const }))
    return run(s, END, END)
  }
  assert.equal(at8(2).state.winner, 'BR')
  assert.equal(at8(2).state.endReason, 'dusk')
  assert.equal(at8(1).state.winner, 'DE')
  assert.equal(at8(1).state.endReason, 'dusk')
})

test('the intercepted slip speaks in the period voice', () => {
  const s = blank(); dummies(s)
  put(s, 'r', 'BR', 'rifle', 'G6')
  put(s, 'g', 'DE', 'rifle', 'G5', { name: '4th Company' })
  s.intents.push({ id: 8, side: 'DE', source: 'g', kind: 'assault', from: H('G5'), target: H('G6'), dmg: 2 })
  assert.equal(describeIntent(s, s.intents[0]), "Intercepted, by pigeon: '4th Company to storm G6 on the bell. Bombs up, bayonets fixed.'")
})
