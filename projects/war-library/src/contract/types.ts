// FROZEN AT G0 (docs/DESIGN.md §11.3). Pure data: every value here survives structuredClone,
// so the rules core, Undo, Rewind, the AI and headless self-play can all copy a state freely.
// A change to this file is a contract change — raise it with the Lead, do not edit in place.

export type Side = 'BR' | 'DE'
export type HexId = number // row*13+col
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 // N NE SE S SW NW
export type Terrain =
  | 'open' | 'dune' | 'polder' | 'trench' | 'crater' | 'ruin' | 'church' | 'chateau'
  | 'blockhouse' | 'bridge' | 'sluice' | 'river' | 'sea'
export type UnitKind = 'rifle' | 'mg' | 'fieldgun' | 'tank' | 'stoss'
export type Phase = 'dawn' | 'player-orders' | 'bell' | 'enemy-orders' | 'dusk' | 'over'
export type ScenarioId = 's1' | 's2' | 's3'
export type Difficulty = 'recruit' | 'veteran' | 'general'
export type Rule = 'overwatch' | 'assault' | 'strike-back' | 'fire' | 'barrage' | 'gas' | 'flood'

export const COLS = 13
export const ROWS = 9

export interface Unit {
  id: string
  side: Side
  kind: UnitKind
  name: string
  hex: HexId
  str: number
  facing: Dir
  suppressedUntil: number
  dugIn: boolean
  bogged: boolean
  ordered: boolean
  acted: boolean
}

export interface Intent {
  id: number
  side: Side
  source: string // unit id | 'battery'
  kind: 'assault' | 'fire' | 'barrage' | 'gas'
  from: HexId | null
  target: HexId
  dmg: number
}

export interface GameState {
  scenario: ScenarioId
  difficulty: Difficulty
  seed: number
  rng: number
  round: number
  maxRounds: number
  phase: Phase
  human: Side
  terrain: Terrain[]
  wire: boolean[]
  gas: number[]
  units: Unit[]
  intents: Intent[]
  objectives: { hex: HexId; name: string; holder: Side | null }[]
  orderLimit: Record<Side, number>
  ordersLeft: number
  active: string | null
  morale: Record<Side, number>
  moraleStart: Record<Side, number>
  shells: Record<Side, { he: number; gas: number }>
  weather: { now: 'dry' | 'rain'; next: 'dry' | 'rain' }
  wind: { now: Dir; next: Dir }
  creep: { hexes: HexId[]; stepsLeft: number } | null
  sluiceUsed: boolean
  reinforcements: { round: number; unit: Unit }[]
  ledger: { round: number; unit: string; figures: number; hex: HexId; rule: Rule; by: string }[]
  winner: Side | null
  endReason: 'rout' | 'all-objectives' | 'dusk' | null
}

export type Action =
  | { t: 'move'; unit: string; to: HexId }
  | { t: 'assault' | 'fire' | 'cut'; unit: string; target: HexId }
  | { t: 'pivot'; unit: string; facing: Dir }
  | { t: 'barrage'; target: HexId; shell: 'he' | 'gas' }
  | { t: 'creep'; hexes: [HexId, HexId, HexId] }
  | { t: 'sluice' }
  | { t: 'endOrders' }

export type ForecastEffect =
  | 'suppress' | 'pin' | 'capture' | 'cancel-intent' | 'wire-cut' | 'stop' | 'destroyed'

export interface Forecast {
  legal: boolean
  dmgDealt: number
  dmgTaken: number
  path?: HexId[]
  effects: ForecastEffect[]
  label: string
}
