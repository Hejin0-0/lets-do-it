// Red ink (DESIGN §5): the AI's assaults, fire and barrages are declared on hexes and land at
// the next bell, in declaration order.
import type { GameEvent } from '../contract/events.ts'
import type { GameState, HexId, Intent, Side } from '../contract/types.ts'
import { barrageHex, gasCloud, gasHex, resolveAssault, resolveFire } from './combat.ts'
import { N_HEX, hexName } from './hex.ts'
import { byId, isSupp, unitAt } from './state.ts'

type Ev = GameEvent[]

const enemyFigures = (s: GameState, side: Side): number => s.units.reduce((n, u) => n + (u.side === side ? 0 : u.str), 0)

/**
 * Every hex an intent will hit when it lands: its target, and for gas the two hexes downwind of it
 * too. The wind that blows at the bell is `wind.next` until dawn has turned it (DESIGN §5).
 * The board paints red ink on all of these.
 */
export function footprint(s: GameState, i: Intent): HexId[] {
  if (i.kind !== 'gas') return [i.target]
  const w = s.phase === 'enemy-orders' || s.phase === 'dusk' ? s.wind.next : s.wind.now
  return gasCloud(i.target, w)
}

/**
 * Ids are unique per game: the ink of round r's enemy orders is numbered r*100+1…, the opening
 * ink (declared before round 1's player orders) 1…. At most 4 orders a phase, so they never collide.
 */
export function declare(s: GameState, side: Side, source: string, kind: Intent['kind'], from: HexId | null, target: HexId): Intent {
  const base = (s.phase === 'enemy-orders' ? s.round : s.round - 1) * 100
  const id = s.intents.reduce((m, i) => Math.max(m, i.id), base) + 1
  const intent: Intent = { id, side, source, kind, from, target, dmg: 0 }
  s.intents.push(intent)
  return intent
}

/**
 * Land every pending intent in order. `record` receives the figures each one took off the
 * enemy (0 when cancelled or empty). Leaves s.intents empty.
 */
export function resolveIntents(s: GameState, ev: Ev, record?: (i: Intent, dealt: number) => void): void {
  const waves = new Array<number>(N_HEX).fill(0)
  const queue = s.intents.slice()
  for (const intent of queue) {
    if (!s.intents.includes(intent)) { record?.(intent, 0); continue } // cancelled mid-bell
    s.intents = s.intents.filter((i) => i !== intent)
    let dealt = 0
    if (intent.source === 'battery') {
      const hexes = footprint(s, intent)
      ev.push({ e: 'intent-resolved', id: intent.id, outcome: hexes.some((h) => unitAt(s, h)) ? 'hit' : 'empty' })
      const before = enemyFigures(s, intent.side)
      if (intent.kind === 'gas') gasHex(s, intent.target, s.wind.now, 'battery', ev)
      else barrageHex(s, intent.target, 'battery', ev)
      dealt = before - enemyFigures(s, intent.side) // gas counts its whole footprint
    } else {
      const src = byId(s, intent.source)
      const def = unitAt(s, intent.target)
      if (!src || isSupp(src) || src.hex !== intent.from || (def && def.side === src.side)) {
        ev.push({ e: 'intent-resolved', id: intent.id, outcome: 'cancelled' })
      } else if (intent.kind === 'assault') {
        ev.push({ e: 'intent-resolved', id: intent.id, outcome: def ? 'hit' : 'empty' })
        dealt = resolveAssault(s, src, intent.target, waves[intent.target]++, ev)
      } else {
        ev.push({ e: 'intent-resolved', id: intent.id, outcome: def ? 'hit' : 'empty' })
        dealt = resolveFire(s, src, intent.target, ev)
      }
    }
    record?.(intent, dealt)
  }
  s.intents = []
}

// --- The intercepted slip ⟨G9⟩ -------------------------------------------------------------
// The enemy's top intent read back as the order that was written for it, in the period voice of
// the old build's order table (www/src/13-combat.js ORDER_TEXT / VIA_TEXT).

const VIA = ['by telephone', 'by runner', 'by pigeon'] as const // the opening ink (id 1) goes by runner
const GROUND: Record<GameState['terrain'][number], string> = {
  open: 'in the open', dune: 'in the dunes', polder: 'on the polder', trench: 'fire trench',
  crater: 'in the shell holes', ruin: 'in the ruin', church: 'in the church', chateau: 'in the château',
  blockhouse: 'blockhouse', bridge: 'on the bridge', sluice: 'at the sluice', river: 'on the river bank', sea: 'on the beach',
}
const COMPASS = ['north', 'north-east', 'south-east', 'south', 'south-west', 'north-west'] as const

/** One intent as an intercepted order, e.g. "Intercepted, by runner: 'Shell the British fire trench at E7 at first light.'" */
export function describeIntent(s: GameState, i: Intent): string {
  const at = hexName(i.target)
  const foe = i.side === 'DE' ? 'British' : 'German'
  const who = byId(s, i.source)?.name ?? 'The battery'
  const obj = s.objectives.find((o) => o.hex === i.target)
  const t = s.terrain[i.target]
  const there = unitAt(s, i.target)

  let order: string
  switch (i.kind) {
    case 'barrage':
      order = there && there.side !== i.side
        ? `Shell the ${foe} ${GROUND[t]} at ${at} at first light.`
        : s.wire[i.target] ? `Shell the wire at ${at} at first light. Cut a lane for the companies.`
          : `Sperrfeuer on ${at} at first light. Nothing is to cross it.`
      break
    case 'gas':
      order = `Gas on ${at} when the wind serves. It will carry ${COMPASS[s.wind.now]}. Masks on.`
      break
    case 'assault':
      order = obj && obj.holder !== i.side ? `${who} to seize the ${obj.name.toLowerCase()} at ${at} on the bell. Bayonets fixed.`
        : there ? `${who} to storm ${at} on the bell. Bombs up, bayonets fixed.`
          : `${who} to walk into ${at} on the bell and hold it.`
      break
    case 'fire':
      order = `${who} to fire on ${at} at the bell. Gunfire, on my ranging round.`
      break
  }
  return `Intercepted, ${VIA[i.id % 3]}: '${order}'`
}

/** The slip for the enemy's most damaging pending intent (first declared wins ties), or null. */
export function planSlip(s: GameState): string | null {
  let top: Intent | null = null
  for (const i of s.intents) if (i.side !== s.human && (!top || i.dmg > top.dmg)) top = i
  return top ? describeIntent(s, top) : null
}
