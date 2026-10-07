// The HUD's words: hex names, scenario lines, the intercepted slip in the 1917 field-message
// voice of the old build (www/src/13-combat.js ORDER_TEXT / VIA_TEXT), ledger causes, the tutor.
// Pure functions of state; no DOM.
import type { ForecastEffect, GameState, HexId, Intent, Rule, Side, Terrain, Unit } from '../contract/types.ts'
import { COLS } from '../contract/types.ts'

export const hexName = (h: HexId): string => String.fromCharCode(65 + (h % COLS)) + (Math.floor(h / COLS) + 1)
export const sideName = (s: Side): string => (s === 'BR' ? 'British' : 'German')
// The collective noun: "the British" (never "Britishs", an outside review's catch), "the Germans".
export const sidePlural = (s: Side): string => (s === 'BR' ? 'British' : 'Germans')
export const other = (s: Side): Side => (s === 'BR' ? 'DE' : 'BR')
// Mirrors Game.ts: a unit is suppressed while suppressedUntil >= round.
export const suppressed = (u: Unit, s: GameState): boolean => u.suppressedUntil >= s.round

export const SCENARIO: Record<GameState['scenario'], { name: string; date: string; goal: string; short: string; need: number; blurb: string }> = {
  s1: { name: 'Strandfest', date: '10 July 1917', goal: 'Hold two of the three Yser bridges until dusk.', short: 'Hold 2 of 3 bridges', need: 2,
    blurb: 'Defend. Three rifle companies and a Vickers hold the Yser bridges.' },
  s2: { name: 'The Great Dune', date: 'August 1917', goal: 'Take two of the church, the château and the blockhouse.', short: 'Take 2 of 3 strongpoints', need: 2,
    blurb: 'Attack with four orders, a Mark IV and a creeping barrage.' },
  s3: { name: 'The Sluice', date: 'Autumn 1917', goal: 'Hold two of the bridge, the sluice and the farm ruin.', short: 'Hold 2 of 3 posts', need: 2,
    blurb: 'Defend against gas and Stoßtrupps. Open the sluice once.' },
}

export const DIFFICULTY: Record<GameState['difficulty'], { name: string; note: string }> = {
  recruit: { name: 'Recruit', note: 'Rewind as often as you like' },
  veteran: { name: 'Veteran', note: 'One rewind' },
  general: { name: 'General', note: 'No rewinds' },
}

export const PHASE_WORDS: Record<GameState['phase'], string> = {
  'dawn': 'Dawn', 'player-orders': 'Your orders', 'bell': 'The bell: red ink lands',
  'enemy-orders': 'Enemy orders', 'dusk': 'Dusk', 'over': 'Cease fire',
}

// What a British officer would call the ground a shell is aimed at.
const GROUND: Record<Terrain, string> = {
  open: 'the open ground', dune: 'the dunes', polder: 'the polder', trench: 'the fire trench',
  crater: 'the crater line', ruin: 'the ruin', church: 'the church', chateau: 'the château',
  blockhouse: 'the blockhouse', bridge: 'the bridge', sluice: 'the sluice', river: 'the river bank', sea: 'the beach',
}
const VIA = ['by runner', 'by telephone', 'by pigeon']

// The enemy's top intent, read as an intercepted order (the Hud words it with rules.planSlip; the
// local orderText is the fallback voice).
export function interceptParts(s: GameState): { via: string; order: string; target: HexId } | null {
  const theirs = s.intents.filter((i) => i.side !== s.human)
  if (theirs.length === 0) return null
  const top = theirs.reduce((a, b) => (b.dmg > a.dmg ? b : a))
  return { via: VIA[top.id % 3], order: orderText(s, top), target: top.target }
}
export function interceptFor(s: GameState): string | null {
  const p = interceptParts(s)
  return p ? `Intercepted, ${p.via}: “${p.order}”` : null
}
function orderText(s: GameState, i: Intent): string {
  const at = hexName(i.target)
  const who = s.units.find((u) => u.id === i.source)?.name ?? 'The battery'
  const foe = sideName(s.human)
  switch (i.kind) {
    case 'barrage': return `Shell the ${foe} in ${GROUND[s.terrain[i.target]] ?? 'the line'} at ${at} at first light.`
    case 'gas': return `Gas on ${at} when the wind serves. Masks on.`
    case 'assault': return `${who} will storm ${at} on the bell. Bayonets fixed.`
    case 'fire': return `${who} to fire on ${at} at the bell.`
  }
}

export const RULE_WORDS: Record<Rule, string> = {
  overwatch: 'MG overwatch', assault: 'assault', 'strike-back': 'strike back', fire: 'fire',
  barrage: 'barrage', gas: 'gas', flood: 'the flood',
}

// DESIGN §7, the first night in five notes. `at` is the note's place in the five; lines sharing an
// `at` are that note reworded for a player who took another road. Game.tutorLine picks one from
// what is actually on the table after every select, order, undo and bell: an outside review fired
// three barrages and was still told "Click A Coy", then sent to the shells with none left. A player
// who follows the notes still reads them in the scripted order. ≤ 100 characters each (two lines).
export type TutorId =
  | 'lift' | 'reach' | 'reach-any' | 'gap' | 'still-red' | 'ring' | 'fell-empty' | 'fell-hit'
  | 'battery' | 'no-shells'
export const TUTOR_STEPS = 5
export const TUTOR: { id: TutorId; at: number; text: string }[] = [
  { id: 'lift', at: 1, text: 'Red ink on E7: shells land there at the bell. Click A Coy, or press Tab, to lift it.' },
  { id: 'reach', at: 2, text: 'Gold dots show its reach. D7 is trench: cover 2, safe. Wire stops you. Move A Coy.' },
  { id: 'reach-any', at: 2, text: 'Gold dots show its reach; wire stops you. Click one to move. A Coy still stands on red ink.' },
  { id: 'gap', at: 3, text: 'Watch the L gap: pivot the Vickers (Q / E) or move C Coy. Then ring the bell (Space).' },
  { id: 'still-red', at: 3, text: 'A piece still stands on red ink, and shells land there at the bell. Move it off, then ring (Space).' },
  { id: 'ring', at: 3, text: 'Every order is given. Ring the bell (Space) and watch the red ink land.' },
  { id: 'fell-empty', at: 4, text: 'The shells fell on empty ground. Red ink never lies.' },
  { id: 'fell-hit', at: 4, text: 'The shells fell just where the ink said. Red ink never lies: step off it next time.' },
  { id: 'battery', at: 5, text: 'Round 2: the battery. Click the shells (B), then a ringed hex: one order and one shell.' },
  { id: 'no-shells', at: 5, text: 'Round 2: the battery is spent. Hold the bridges: Tab through your pieces, then the bell (Space).' },
]
export function tutorIndex(id: TutorId): number {
  const i = TUTOR.findIndex((t) => t.id === id)
  if (i < 0) throw new Error(`tutorIndex: unknown tutor line "${id}"`)
  return i
}

// ---- hover and forecast lines ------------------------------------------------------------------

export const EFFECT_WORDS: Record<ForecastEffect, string> = {
  suppress: 'Suppresses', pin: 'Pinned by an MG', capture: 'Takes the objective', 'cancel-intent': 'Cancels its red ink',
  'wire-cut': 'Cuts the wire', stop: 'Halts on the way', destroyed: 'Wipes it out',
}

// The warning a hex carries for a piece that would stand on it, worst first (DESIGN §7:
// "Trench · cover 2 · safe", "Wire: stops here").
export function hexThreat(s: GameState, h: HexId, enemyFan: ReadonlySet<HexId>, cover: number): { text: string; bad: boolean } | null {
  const ink = s.intents.find((i) => i.side !== s.human && i.target === h)
  if (ink) return { text: ink.kind === 'barrage' || ink.kind === 'gas' ? 'Red ink: shells land here' : 'Red ink: attacked at the bell', bad: true }
  if (s.wire[h]) return { text: 'Wire: stops here', bad: true }
  if (s.gas[h] > 0) return { text: 'Gas: 1 damage, suppressed', bad: true }
  const t = s.terrain[h]
  if (enemyFan.has(h) && t !== 'trench' && t !== 'ruin' && t !== 'church' && t !== 'chateau' && t !== 'blockhouse' &&
    t !== 'bridge' && t !== 'sluice') return { text: 'MG fan: 2 damage on entry', bad: true }
  return cover >= 1 ? { text: 'safe', bad: false } : null
}

export const KEYMAP: [string, string][] = [
  ['Tab', 'next piece with orders'], ['Arrows, Enter', 'move the cursor, give the order'], ['Q / E', 'pivot'],
  ['B', 'the battery'], ['Z', 'undo'], ['Space', 'ring the bell'], ['R', 'rewind'], ['V', 'staff map'],
  ['+ / -', 'zoom'], ['A / D', 'turn the chair'], ['M', 'mute'], ['Esc', 'this book'],
]

export const RULE_CARD = ['Red ink hurts.', 'Wire stops.', 'Trenches shelter.']

export function verdict(s: GameState): { won: boolean; stamp: string; line: string } {
  const won = s.winner === s.human
  const foe = sideName(other(s.human))
  const held = s.objectives.filter((o) => o.holder === s.human).length
  let line: string
  switch (s.endReason) {
    case 'rout': line = won ? `${foe} morale broke. Their line routed.` : 'Your candles are out. The line broke.'; break
    case 'all-objectives': line = won ? 'Every objective is in your hands.' : `The ${foe}s hold every objective.`; break
    case 'dusk': line = `Dusk. You hold ${held} of ${s.objectives.length}.`; break
    default: line = won ? 'The field is yours.' : 'The field is lost.'
  }
  return { won, stamp: won ? 'Victory' : 'Defeat', line }
}

// ---- The campaign: the Yser, 1917, on the real calendar of the coast front --------------------
// Each chapter is a real moment (Unternehmen Strandfest and Operation Hush: Wikipedia, IWM, The
// Long, Long Trail; the Ganzepoot and Hendrik Geeraert: Wikipedia, Visit Nieuwpoort). Each result
// bends what follows: an alternate history, told beside the one that happened.
export interface Chapter {
  head: string
  history: string // what really happened, before the battle
  yours: string // the question the battle asks
  mod: [string, string] // the bend from the chapter before, won / lost ('' for the first)
  then: [string, string] // how your war went, won / lost
  real: string // the real outcome, for the after-action page
  facts: string[] // the docs/history/FACTS.md rows `history` and `real` stand on (the H-08 gate)
}

export const CAMPAIGN = {
  title: 'The Yser, 1917',
  sub: 'Three battles on the real calendar of the coast front. Each result bends the next: a war that might have been.',
  chapters: [
    {
      head: 'Chapter I · Strandfest · 10 July 1917',
      history: 'The British had just taken the Nieuwpoort bridgehead over from the French, to launch Operation Hush up the coast. On 10 July the German Marine Corps struck first: its guns, with some of the first mustard gas of the war, broke the bridges over the Yser near the coast, and the battalions east of the river were cut off and all but destroyed.',
      yours: 'Tonight the bridges are yours to hold until dusk.',
      mod: ['', ''],
      then: ['The bridgehead stood. Hush can go forward from the east bank.', 'As in 1917, the bridgehead fell: Hush must start from the west bank.'],
      real: 'In 1917 the bridgehead fell that night; the 1st Northamptons were almost all killed or captured.',
      facts: ['F03', 'F04', 'F05', 'F06', 'F07'],
    },
    {
      head: 'Chapter II · The Great Dune · August 1917',
      history: 'Hush waited through August and September on the offensive at Ypres, which never came far enough. On 14 October 1917 it was cancelled, and its men and tanks never went in.',
      yours: 'In your war, Hush goes in: four companies, a Mark IV and a creeping barrage against the church, the château and the blockhouse on the dunes.',
      mod: ['The guns across the Yser give your battery one shell more.', 'Without the east bank your battery has one shell fewer.'],
      then: ['The dunes fell; the coast road to Ostend lay open.', 'Hush broke on the dunes, as its planners had feared.'],
      real: 'In 1917 this attack was never made: Hush was cancelled on 14 October.',
      facts: ['F04', 'F10'],
    },
    {
      head: 'Chapter III · The Sluice · Autumn 1917',
      history: 'On 29 October 1914 the Nieuwpoort skipper Hendrik Geeraert and the Belgian engineers opened the sluices at the Ganzepoot: the sea flooded the Yser plain and stopped the German advance. The sluices kept the flood, and the flood held the front.',
      yours: 'Now the Germans come for them, with gas and Stoßtrupps. Hold two of the bridge, the sluice and the farm ruin; you may open the sluice once, as Geeraert did.',
      mod: ['The army that took the dunes holds its nerve: one candle more.', 'After the dunes, nerves are thin: one candle fewer.'],
      then: ['The sluices held, and the flood with them.', 'The sluices fell; the Germans could drain the plain.'],
      real: 'In the real war Belgian engineers held the sluices to the end, and the flood stood until the armistice.',
      facts: ['F01', 'F02'],
    },
  ] as Chapter[],
  real: 'In the war that happened, the Belgian coast stayed German for another year: the Belgian army entered Ostend on 17 October 1918.', // F11
  /**
   * Your war, by what each night decided — bridgehead (I), Hush (II), sluices (III): eight ends,
   * one per way the three battles can fall (SPEC-AAA H-03). Alternate history, never fact.
   */
  ending(won: boolean[]): string {
    const ENDS: Record<string, string> = {
      TTT: 'The bridgehead held, Hush went in and took the dunes, and the sluices stood. The coast and its U-boat ports fell to the Allies a year early; Ostend was free by the winter of 1917.',
      TTF: 'The bridgehead held and Hush took the dunes, but the sluices fell behind it. With the Germans at the floodgates, the advance up the coast stalled at Westende for the winter.',
      TFT: 'The bridgehead held, but Hush broke on the dunes. The sluices stood and the front with them: a thorn east of the Yser, much as the war had been.',
      TFF: 'The bridgehead held, but Hush broke and the sluices fell. The east bank was given up in the winter, and the line drew back behind the flood the Germans now commanded.',
      FTT: 'The bridgehead fell as it did in 1917, yet Hush went in from the west bank and took the dunes, and the sluices held. The coast road lay open by the spring of 1918.',
      FTF: 'The bridgehead fell and the sluices with it, though Hush took the dunes. The landing was cut off from the plain behind it and drew back by the new year.',
      FFT: 'Your war ran much as the real one: the bridgehead fell, Hush failed, and only the sluices stood. The coast stayed German until October 1918.',
      FFF: 'No night went your way. The Germans held the coast and took the sluices: the flood that saved the Yser in 1914 was theirs to drain.',
    }
    return `Your war: ${ENDS[won.map((w) => (w ? 'T' : 'F')).join('')] ?? ENDS.FFT}`
  },
  /** 'Chapter II · The Great Dune' (the head without its date). */
  short(i: number): string { return this.chapters[i].head.split(' · ').slice(0, 2).join(' · ') },
}

// The day each battle keeps, a line a round on the round banner. Strandfest keeps the real one: only
// its two sourced hours carry a clock time (05:30 F08, 20:00 F09), the gas (F05) and the bridges
// (F06) are sourced too; the day between is told loosely around them, with no invented hours. The Dune and the
// Sluice keep the day your war gives them.
export const CHRONICLE: Record<GameState['scenario'], readonly string[]> = {
  s1: ['05:30 — the German guns open on the bridgehead.', 'Morning — shells walk across the bridges.',
    'Mustard gas among the high explosive, among the first of the war.', 'Midday — the bombardment goes on.', 'Afternoon — the bridges are going one by one.',
    'Evening — the guns lift, and fall again.', '20:00 — the Marines come over the dunes.', 'Dusk on the Yser.'],
  s2: ['Zero hour — the barrage opens on the dunes.', '07:00 — the Mark IV is over the first trench.',
    '09:00 — the barrage walks on, the companies behind it.', '11:00 — the dunes are smoking.', '13:00 — the reserves come up.',
    '15:00 — the light is going west.', '17:00 — the last push before dark.', 'Dusk on the dunes.'],
  s3: ['Dawn — the wind sets toward the sluices.', '07:00 — gas shells on the polder.', '09:00 — Stoßtrupps in the craters.',
    '11:00 — the water stands high at the Ganzepoot.', '13:00 — the bombardment goes on.', '15:00 — the wind backs.',
    '16:30 — they come again.', '18:00 — the light is going.', 'Dusk at the sluices.'],
}

// What each battle's blue pencil on the map means (MapPainter.history draws the marks; their words
// live here, in the despatch, where they stay legible). Sourced: F05/F06 (approximate), F10, F01.
export const HISTORY_MARK: Record<GameState['scenario'], string> = {
  s1: '✎ Blue: ≈ the German line at dusk, 10 July 1917',
  s2: '✎ Blue: the attack Hush planned in 1917 — never made',
  s3: '✎ Blue: the plain really flooded in October 1914',
}
