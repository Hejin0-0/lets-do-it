// apply(s, a): the only way a GameState changes. Pure — the input is never mutated — and it
// throws IllegalAction for anything legal() would not list.
import type { GameEvent } from '../contract/events.ts'
import type { Action, GameState, HexId, Side, Unit } from '../contract/types.ts'
import { barrageHex, enterHex, gasHex, gasUnit, hurt, resolveAssault, resolveFire, suppress } from './combat.ts'
import { NEIGH, N_HEX, dist, hexName } from './hex.ts'
import { declare } from './intents.ts'
import { explore, fanFrom, losClear, overwatchBy } from './movement.ts'
import { dawn, dusk, endEnemyOrders, flood, projectIntents, ringBell, toBell } from './phases.ts'
import { SCENARIOS } from './scenarios/index.ts'
import { IllegalAction, actingSide, clone, isSupp, unitAt, waves } from './state.ts'
import type { Step } from './state.ts'
import { UNIT_STATS, canAssault, canCut, canFire, firesAfterMove, stoppedByWire } from './units.ts'
import { checkRout } from './victory.ts'

type Ev = GameEvent[]

const fail = (why: string): never => { throw new IllegalAction(why) }

function ownPiece(s: GameState, id: string): Unit {
  const side = actingSide(s) ?? fail(`no orders in phase ${s.phase}`)
  const u = s.units.find((x) => x.id === id) ?? fail(`no piece ${id}`)
  if (u.side !== side) fail(`${u.name} is not yours to order`)
  if (isSupp(u)) fail(`${u.name} is suppressed`)
  return u
}

/** Touching an unordered piece spends an order; an act marks it done for the round. */
function spend(s: GameState, u: Unit, act: boolean): void {
  if (act && u.acted) fail(`${u.name} has already acted`)
  if (!u.ordered) {
    if (s.ordersLeft <= 0) fail('no orders left')
    s.ordersLeft -= 1
    u.ordered = true
  }
  if (act) u.acted = true
  s.active = u.id
}

const onBoard = (h: HexId): boolean => Number.isInteger(h) && h >= 0 && h < N_HEX
const inIntentPhase = (s: GameState): boolean => s.phase === 'enemy-orders'

export function fireTargets(s: GameState, u: Unit): HexId[] {
  if (u.kind === 'mg') return fanFrom(s, u.hex, u.facing)
  const range = UNIT_STATS[u.kind].range
  const out: HexId[] = []
  for (let h = 0; h < N_HEX; h++) if (h !== u.hex && dist(u.hex, h) <= range && losClear(s, u.hex, h)) out.push(h)
  return out
}

function move(s: GameState, a: Extract<Action, { t: 'move' }>, ev: Ev): void {
  const u = ownPiece(s, a.unit)
  if (u.ordered) fail(`${u.name} has already been ordered`)
  if (u.bogged) fail(`${u.name} is bogged`)
  const r = explore(s, u).get(a.to) ?? fail(`${u.name} cannot reach ${onBoard(a.to) ? hexName(a.to) : a.to}`)
  spend(s, u, false)
  for (const h of r.path.slice(1)) {
    if (u.kind === 'tank' && s.wire[h]) { s.wire[h] = false; ev.push({ e: 'wire-cut', hex: h }) }
  }
  ev.push({ e: 'moved', unit: u.id, path: r.path })
  enterHex(s, u, a.to, ev)
  if (r.stop === 'overwatch') {
    const mg = overwatchBy(s, u, a.to)!
    ev.push({ e: 'attack', kind: 'overwatch', by: mg.id, target: a.to, dmg: Math.min(2, u.str) })
    hurt(s, u, 2, 'overwatch', mg.id, ev)
    suppress(s, u, ev) // pinned
  }
  if (u.str > 0 && s.gas[a.to] > 0) gasUnit(s, u, 'gas', ev)
}

function assault(s: GameState, a: { unit: string; target: HexId }, ev: Ev): void {
  const u = ownPiece(s, a.unit)
  if (!canAssault(u.kind)) fail(`${u.name} cannot assault`)
  if (stoppedByWire(u.kind) && s.wire[u.hex]) fail(`${u.name} is caught in the wire`)
  if (!NEIGH[u.hex].includes(a.target)) fail('assaults go into an adjacent hex')
  const def = unitAt(s, a.target)
  if (!def || def.side === u.side) fail('nothing to assault there')
  spend(s, u, true)
  if (inIntentPhase(s)) {
    ev.push({ e: 'intent', intent: declare(s, u.side, u.id, 'assault', u.hex, a.target) })
    return
  }
  const w = waves(s)
  resolveAssault(s, u, a.target, w[a.target]++, ev)
}

function fire(s: GameState, a: { unit: string; target: HexId }, ev: Ev): void {
  const u = ownPiece(s, a.unit)
  if (!canFire(u.kind)) fail(`${u.name} has no ranged fire`)
  if (u.ordered && !firesAfterMove(u.kind)) fail(`${u.name} cannot fire after moving`)
  if (!fireTargets(s, u).includes(a.target)) fail('target out of range, arc or sight')
  const def = unitAt(s, a.target)
  if (!def || def.side === u.side) fail('nothing to fire at there')
  spend(s, u, true)
  if (inIntentPhase(s)) {
    ev.push({ e: 'intent', intent: declare(s, u.side, u.id, 'fire', u.hex, a.target) })
    return
  }
  resolveFire(s, u, a.target, ev)
}

function cut(s: GameState, a: { unit: string; target: HexId }, ev: Ev): void {
  const u = ownPiece(s, a.unit)
  if (!canCut(u.kind)) fail(`${u.name} cannot cut wire`)
  if (a.target !== u.hex && !NEIGH[u.hex].includes(a.target)) fail('wire must be here or adjacent')
  if (!s.wire[a.target]) fail('no wire there')
  spend(s, u, true)
  s.wire[a.target] = false
  ev.push({ e: 'wire-cut', hex: a.target })
}

function pivot(s: GameState, a: Extract<Action, { t: 'pivot' }>, ev: Ev): void {
  const u = ownPiece(s, a.unit)
  if (u.kind !== 'mg') fail('only MGs pivot')
  if (!Number.isInteger(a.facing) || a.facing < 0 || a.facing > 5 || a.facing === u.facing) fail('pick a new facing')
  spend(s, u, true)
  u.facing = a.facing
  ev.push({ e: 'pivoted', unit: u.id, facing: a.facing })
}

function battery(s: GameState, cost: number, shell: 'he' | 'gas'): void {
  const side = actingSide(s) ?? fail(`no orders in phase ${s.phase}`)
  if (s.ordersLeft <= 0) fail('no orders left')
  if (s.shells[side][shell] < cost) fail(`no ${shell === 'he' ? 'shells' : 'gas shells'} left`)
  s.ordersLeft -= 1
  s.shells[side][shell] -= cost
  s.active = null
}

// OBSERVED FIRE: the battery shells only what a forward observer can see — a hex within
// OBSERVE hexes of one of the side's own pieces. An outside review found every one of the 117
// hexes a legal target, which took the positioning out of the game's second mechanic.
// 5, not 3: at 3 the German battery (rows 1-3) could not see the British trenches at all and the
// both-sides-bleed gate collapsed (S1 0.61, S2 0.22). Selfplay at 5, 100 games a matchup: every
// gate passes except Veteran-vs-General (S1 0.63, S3 0.59; gate 0.30-0.55 — General is a shade
// easy) and S2 bothBleed 0.38 (the German line sits 5 rows from the British start). Known.
export const OBSERVE = 5
export function observed(s: GameState, side: Side, h: HexId): boolean {
  return s.units.some((u) => u.side === side && u.str > 0 && dist(u.hex, h) <= OBSERVE)
}

function barrage(s: GameState, a: Extract<Action, { t: 'barrage' }>, ev: Ev): void {
  if (!onBoard(a.target)) fail('barrage off the map')
  if (!observed(s, actingSide(s)!, a.target)) fail('no observer within ' + OBSERVE + ' hexes of the target')
  if (a.shell !== 'he' && a.shell !== 'gas') fail('unknown shell')
  battery(s, 1, a.shell)
  const side = actingSide(s)!
  if (inIntentPhase(s)) {
    ev.push({ e: 'intent', intent: declare(s, side, 'battery', a.shell === 'gas' ? 'gas' : 'barrage', null, a.target) })
    return
  }
  if (a.shell === 'gas') gasHex(s, a.target, s.wind.now, 'battery', ev)
  else barrageHex(s, a.target, 'battery', ev)
}

/** Three hexes side by side on one map row. */
export function isCreepLine(h: readonly HexId[]): boolean {
  return h.length === 3 && h.every(onBoard) && h[1] === h[0] + 1 && h[2] === h[1] + 1 &&
    Math.floor(h[0] / 13) === Math.floor(h[2] / 13)
}

function creep(s: GameState, a: Extract<Action, { t: 'creep' }>, ev: Ev): void {
  if (!SCENARIOS[s.scenario].creep || actingSide(s) !== 'BR') fail('no creeping barrage in this battle')
  if (s.creep) fail('a creeping barrage is already walking')
  if (!Array.isArray(a.hexes) || !isCreepLine(a.hexes)) fail('a creeping barrage covers three hexes in a row')
  battery(s, 3, 'he')
  s.creep = { hexes: a.hexes.slice(), stepsLeft: 2 }
  for (const h of a.hexes) barrageHex(s, h, 'battery', ev)
}

function sluice(s: GameState, ev: Ev): void {
  if (!SCENARIOS[s.scenario].sluice || actingSide(s) !== 'BR') fail('no sluice in this battle')
  if (s.sluiceUsed) fail('the sluice is already open')
  if (s.ordersLeft <= 0) fail('no orders left')
  s.ordersLeft -= 1
  s.active = null
  flood(s, ev)
}

function endOrders(s: GameState, ev: Ev): void {
  switch (s.phase) {
    case 'player-orders': toBell(s, ev); ringBell(s, ev); break
    case 'bell': ringBell(s, ev); break
    case 'enemy-orders': endEnemyOrders(s, ev); break
    case 'dusk': dusk(s, ev); break
    case 'dawn': dawn(s, ev); break
    case 'over': fail('the battle is over')
  }
}

export function apply(s: GameState, a: Action): Step {
  if (s.phase === 'over') fail('the battle is over')
  if (!a || typeof a !== 'object') fail('no action')
  const t = clone(s)
  const ev: Ev = []
  switch (a.t) {
    case 'move': move(t, a, ev); break
    case 'assault': assault(t, a, ev); break
    case 'fire': fire(t, a, ev); break
    case 'cut': cut(t, a, ev); break
    case 'pivot': pivot(t, a, ev); break
    case 'barrage': barrage(t, a, ev); break
    case 'creep': creep(t, a, ev); break
    case 'sluice': sluice(t, ev); break
    case 'endOrders': endOrders(t, ev); break
    default: fail(`unknown action ${(a as { t: string }).t}`)
  }
  if (t.phase !== 'over') checkRout(t, ev)
  if (t.phase !== 'over' && t.intents.length) projectIntents(t)
  // The 'intent' events carry the projected damage too (they were pushed before projection).
  for (const e of ev) if (e.e === 'intent') e.intent = { ...(t.intents.find((i) => i.id === e.intent.id) ?? e.intent) }
  return { state: t, events: ev }
}


/**
 * Every action apply() accepts right now, for the side whose orders phase it is (just
 * endOrders in the transient bell/dusk/dawn phases, nothing once the battle is over).
 * Mirrors the checks above one for one; the property test holds the two together.
 */
export function legal(s: GameState): Action[] {
  if (s.phase === 'over') return []
  const side = actingSide(s)
  const out: Action[] = []
  if (side) {
    const canOrder = (u: Unit): boolean => u.ordered || s.ordersLeft > 0
    for (const u of s.units) {
      if (u.side !== side || isSupp(u) || !canOrder(u)) continue
      if (!u.ordered && !u.bogged) for (const to of explore(s, u).keys()) out.push({ t: 'move', unit: u.id, to })
      if (u.acted) continue
      const enemyOn = (h: HexId): boolean => { const d = unitAt(s, h); return !!d && d.side !== side }
      if (canAssault(u.kind) && !(stoppedByWire(u.kind) && s.wire[u.hex])) {
        for (const h of NEIGH[u.hex]) if (enemyOn(h)) out.push({ t: 'assault', unit: u.id, target: h })
      }
      if (canFire(u.kind) && !(u.ordered && !firesAfterMove(u.kind))) {
        for (const h of fireTargets(s, u)) if (enemyOn(h)) out.push({ t: 'fire', unit: u.id, target: h })
      }
      if (canCut(u.kind)) for (const h of [u.hex, ...NEIGH[u.hex]]) if (s.wire[h]) out.push({ t: 'cut', unit: u.id, target: h })
      if (u.kind === 'mg') {
        for (let f = 0; f < 6; f++) if (f !== u.facing) out.push({ t: 'pivot', unit: u.id, facing: f as Unit['facing'] })
      }
    }
    if (s.ordersLeft > 0) {
      for (const shell of ['he', 'gas'] as const) {
        if (s.shells[side][shell] >= 1) for (let h = 0; h < N_HEX; h++) if (observed(s, side, h)) out.push({ t: 'barrage', target: h, shell })
      }
      if (side === 'BR' && SCENARIOS[s.scenario].creep && !s.creep && s.shells.BR.he >= 3) {
        for (let h = 0; h + 2 < N_HEX; h++) {
          const hexes: [HexId, HexId, HexId] = [h, h + 1, h + 2]
          if (isCreepLine(hexes)) out.push({ t: 'creep', hexes })
        }
      }
      if (side === 'BR' && SCENARIOS[s.scenario].sluice && !s.sluiceUsed) out.push({ t: 'sluice' })
    }
  }
  out.push({ t: 'endOrders' })
  return out
}
