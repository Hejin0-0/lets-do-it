// forecast(s, a) is apply(s, a) read back as a hover tag, so it can never disagree with apply.
import type { Action, Forecast, ForecastEffect, GameState, HexId, Side } from '../contract/types.ts'
import { apply } from './apply.ts'
import { DIR_NAMES, hexName } from './hex.ts'
import { explore } from './movement.ts'
import { IllegalAction, actingSide, byId } from './state.ts'
import { TERRAIN_INFO } from './terrain.ts'

export function forecast(s: GameState, a: Action): Forecast {
  let step
  try {
    step = apply(s, a)
  } catch (err) {
    if (err instanceof IllegalAction) return { legal: false, dmgDealt: 0, dmgTaken: 0, effects: [], label: err.message }
    throw err
  }
  const me: Side | null = actingSide(s)
  const sideOf = new Map<string, Side>(s.units.map((u) => [u.id, u.side]))
  for (const u of step.state.units) sideOf.set(u.id, u.side)
  let dmgDealt = 0, dmgTaken = 0
  const effects = new Set<ForecastEffect>()
  let path: HexId[] | undefined
  const unitId = 'unit' in a ? a.unit : null
  for (const e of step.events) {
    switch (e.e) {
      case 'figures': if (sideOf.get(e.unit) === me) dmgTaken += e.lost; else dmgDealt += e.lost; break
      case 'intent': dmgDealt += e.intent.dmg; break
      case 'suppressed': effects.add(sideOf.get(e.unit) === me ? 'pin' : 'suppress'); break
      case 'destroyed': effects.add('destroyed'); break
      case 'captured': if (e.by === me) effects.add('capture'); break
      case 'wire-cut': effects.add('wire-cut'); break
      case 'intent-resolved': if (e.outcome === 'cancelled' && a.t !== 'endOrders') effects.add('cancel-intent'); break
      case 'moved': if (e.unit === unitId && !path) path = e.path; break
      default: break
    }
  }
  let stop = null
  if (a.t === 'move') {
    const u = byId(s, a.unit)
    stop = u ? explore(s, u).get(a.to)?.stop ?? null : null
    if (stop) effects.add('stop')
  }
  const f: Forecast = { legal: true, dmgDealt, dmgTaken, effects: [...effects], label: '' }
  if (path) f.path = path
  f.label = label(s, a, f, stop)
  return f
}

function label(s: GameState, a: Action, f: Forecast, stop: string | null): string {
  const me = actingSide(s)
  const red = (h: HexId): boolean => s.intents.some((i) => i.target === h && i.side !== me)
  switch (a.t) {
    case 'move': {
      const t = TERRAIN_INFO[s.terrain[a.to]]
      const bits = [`${t.label} · cover ${t.cover}`]
      if (stop === 'overwatch') bits.push(`MG fire: ${f.dmgTaken}, pinned`)
      else if (stop === 'wire') bits.push('Wire: stops here')
      else if (stop === 'zoc') bits.push('Enemy adjacent: stops here')
      if (s.gas[a.to] > 0) bits.push('Gas: 1, suppressed')
      if (red(a.to)) bits.push('Red ink: shells land here')
      if (f.effects.includes('capture')) bits.push('Captures')
      if (bits.length === 1) bits.push('safe')
      return bits.join(' · ')
    }
    case 'assault': {
      const bits = [`Assault ${hexName(a.target)}: deal ${f.dmgDealt}, take ${f.dmgTaken}`]
      if (f.effects.includes('destroyed')) bits.push('clears the hex')
      if (f.effects.includes('capture')) bits.push('captures')
      return bits.join(' · ')
    }
    case 'fire': return `Fire on ${hexName(a.target)}: deal ${f.dmgDealt}`
    case 'cut': return `Cut the wire at ${hexName(a.target)}`
    case 'pivot': return `Traverse to the ${DIR_NAMES[a.facing]}`
    case 'barrage': {
      const bits = [`${a.shell === 'gas' ? 'Gas' : 'Barrage'} ${hexName(a.target)}: deal ${f.dmgDealt}`]
      if (f.dmgTaken) bits.push(`own losses ${f.dmgTaken}`)
      if (f.effects.includes('suppress')) bits.push('suppress')
      if (f.effects.includes('cancel-intent')) bits.push('breaks up their attack')
      return bits.join(' · ')
    }
    case 'creep': return `Creeping barrage on ${a.hexes.map(hexName).join('-')}: deal ${f.dmgDealt}`
    case 'sluice': return `Open the sluice: flood the polder · deal ${f.dmgDealt}, take ${f.dmgTaken}`
    case 'endOrders':
      return s.phase === 'player-orders'
        ? `Ring the bell: ${s.intents.length} red ${s.intents.length === 1 ? 'mark lands' : 'marks land'}, you lose ${f.dmgTaken}`
        : 'End orders'
  }
}
