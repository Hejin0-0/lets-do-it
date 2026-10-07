// Candidate orders (DESIGN §6): for each piece, every reachable hex × {stand, each target, cut,
// MG facings}; for the battery, barrages on hexes with an enemy or wire. A cheap maps-only score
// keeps the top K of each; the search then applies them for real.
import type { Action, Dir, GameState, HexId, Side, Unit } from '../contract/types.ts'
import { fireTargets } from '../rules/apply.ts'
import { assaultDamage, barrageDamage, fireDamage, strikeBack } from '../rules/combat.ts'
import { NEIGH, N_HEX } from '../rules/hex.ts'
import { explore, fanFrom } from '../rules/movement.ts'
import { SCENARIOS } from '../rules/scenarios/index.ts'
import { isSupp, objectiveAt, unitAt } from '../rules/state.ts'
import { canAssault, canCapture, canCut, canFire, firesAfterMove, stoppedByWire } from '../rules/units.ts'
import { drive, figure, risk, stickiness } from './evaluate.ts'
import { coverAt } from './maps.ts'
import type { Maps } from './maps.ts'
import type { AiProfile } from './profiles.ts'

export interface Cand { actions: Action[]; quick: number; piece: string | null }

const topK = (xs: Cand[], k: number): Cand[] => xs.sort((a, b) => b.quick - a.quick).slice(0, k)

/** Worth of standing `v` on `h` next phase, from the maps alone. */
function standScore(s: GameState, m: Maps, p: AiProfile, u: Unit, v: Unit, h: HexId): number {
  let q = p.w.exposure * risk(s, m, p, v, h) * (1 - Math.min(3, coverAt(s, m, v, h)) / 3)
  if (m.attacker && canCapture(v.kind) && m.objDist[h] < Infinity) q += p.w.advance * drive(s, p) * (1 - m.objDist[h] / m.maxDist)
  const o = objectiveAt(s, h)
  if (o && o.holder !== v.side && canCapture(v.kind)) q += 2 * p.w.objectives + 3 * p.w.morale
  const left = objectiveAt(s, u.hex)
  if (h !== u.hex && left && left.holder === u.side && m.capture[u.hex]) q -= p.w.objectives
  return q
}

function pieceCands(s: GameState, me: Side, m: Maps, p: AiProfile, u: Unit, intents: boolean): Cand[] {
  const out: Cand[] = []
  const spots: { h: HexId; stop: string | null }[] = [{ h: u.hex, stop: null }]
  if (!u.bogged) for (const [h, r] of explore(s, u)) spots.push({ h, stop: r.stop })
  const base0 = standScore(s, m, p, u, u, u.hex)
  for (const { h, stop } of spots) {
    const moved = h !== u.hex
    const v: Unit = moved ? { ...u, hex: h, dugIn: false } : u
    const mv: Action[] = moved ? [{ t: 'move', unit: u.id, to: h }] : []
    let base = standScore(s, m, p, u, v, h) - base0
    if (stop === 'overwatch') {
      base -= Math.min(2, u.str) * figure(p, u) + p.w.suppressed
      if (moved) out.push({ actions: mv, quick: base, piece: u.id })
      continue // pinned: no act after this move
    }
    if (s.gas[h] > 0) base -= figure(p, u) + p.w.suppressed
    if (moved) out.push({ actions: mv, quick: base, piece: u.id })
    const act = (a: Action, q: number): void => { out.push({ actions: [...mv, a], quick: base + q, piece: u.id }) }
    if (canAssault(u.kind) && !(stoppedByWire(u.kind) && s.wire[h])) {
      for (const n of NEIGH[h]) {
        const def = unitAt(s, n)
        if (!def || def.side === me) continue
        const d = Math.min(def.str, assaultDamage(s, v, h, def, 0))
        const back = d >= def.str || isSupp(def) ? 0 : Math.min(v.str, strikeBack(s, def, v))
        let q = d * figure(p, def) * (intents ? stickiness(s, def, p) : 1) - back * figure(p, u)
        if (d >= def.str) { const o = objectiveAt(s, n); if (o && o.holder !== me) q += 2 * p.w.objectives }
        act({ t: 'assault', unit: u.id, target: n }, q)
      }
    }
    if (canFire(u.kind) && (!moved || firesAfterMove(u.kind))) {
      for (const n of fireTargets(s, v)) {
        const def = unitAt(s, n)
        if (!def || def.side === me) continue
        const d = Math.min(def.str, fireDamage(s, v, def))
        act({ t: 'fire', unit: u.id, target: n }, d * figure(p, def) * (intents ? stickiness(s, def, p) : 1))
      }
    }
    if (canCut(u.kind)) {
      for (const n of [h, ...NEIGH[h]]) {
        if (!s.wire[n]) continue
        act({ t: 'cut', unit: u.id, target: n }, (n === h ? 3 : 0.5) + (m.wireObj[n] >= 0 ? Math.abs(p.w.wire) : 0))
      }
    }
    if (u.kind === 'mg' && !moved) {
      const worth = (f: Dir): number => {
        let q = 0
        for (const x of fanFrom(s, h, f)) {
          const e = unitAt(s, x)
          if (e && e.side !== me) q += 3
          const o = objectiveAt(s, x)
          if (o && o.holder === me) q += p.w.fanCover
          if (m.capture[x]) q += 0.5 // ground the enemy can reach next phase
        }
        return q
      }
      const now = worth(u.facing)
      for (let f = 0; f < 6; f++) if (f !== u.facing) act({ t: 'pivot', unit: u.id, facing: f as Dir }, worth(f as Dir) - now)
    }
  }
  return topK(out, p.k)
}

function batteryCands(s: GameState, me: Side, m: Maps, p: AiProfile, intents: boolean): Cand[] {
  const out: Cand[] = []
  for (const shell of ['he', 'gas'] as const) {
    if (s.shells[me][shell] < 1) continue
    for (let h = 0; h < N_HEX; h++) {
      const u = unitAt(s, h)
      const wire = s.wire[h] && m.wireObj[h] >= 0
      if (!u && !wire) continue
      let q = wire ? Math.abs(p.w.wire) : 0
      if (u) {
        const d = shell === 'gas' ? 1 : barrageDamage(s, h)
        const worth = Math.min(d, u.str) * figure(p, u) + p.w.suppressed
        if (u.side === me) q -= worth + 20
        else {
          q += worth * (intents ? stickiness(s, u, p) : 1)
          for (const i of s.intents) if (i.source === u.id) q += i.dmg * p.w.intentValue // breaks up its attack
        }
      }
      out.push({ actions: [{ t: 'barrage', target: h, shell }], quick: q - (shell === 'gas' ? 1 : 0), piece: null })
    }
  }
  const sc = SCENARIOS[s.scenario]
  if (me === 'BR' && sc.creep && !s.creep && s.shells.BR.he >= 3) {
    for (let h = 0; h + 2 < N_HEX; h++) {
      const line: [HexId, HexId, HexId] = [h, h + 1, h + 2]
      if (Math.floor(h / 13) !== Math.floor((h + 2) / 13)) continue
      let q = 0
      for (const x of line) {
        const u = unitAt(s, x)
        if (u) q += (u.side === me ? -1 : 1) * (Math.min(2, u.str) * figure(p, u) + p.w.suppressed)
        if (s.wire[x] && m.wireObj[x] >= 0) q += Math.abs(p.w.wire)
      }
      if (q > 0) out.push({ actions: [{ t: 'creep', hexes: line }], quick: q * 1.5, piece: null })
    }
  }
  if (me === 'BR' && sc.sluice && !s.sluiceUsed) out.push({ actions: [{ t: 'sluice' }], quick: 0, piece: null })
  return topK(out, p.k)
}

/** Every candidate order for side `me` in state `s` (one list per piece, then the battery). */
export function candidates(s: GameState, me: Side, m: Maps, p: AiProfile): Cand[] {
  if (s.ordersLeft <= 0) return []
  const intents = s.phase === 'enemy-orders'
  const out: Cand[] = []
  for (const u of s.units) {
    if (u.side !== me || u.ordered || isSupp(u)) continue
    out.push(...pieceCands(s, me, m, p, u, intents))
  }
  out.push(...batteryCands(s, me, m, p, intents))
  return out
}
