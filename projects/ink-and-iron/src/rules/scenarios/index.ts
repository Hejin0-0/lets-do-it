// Scenario data (DESIGN §8). Starting numbers are tuned by scripts/selfplay.ts — unit stats are not.
import type { Dir, ScenarioId, Side, UnitKind } from '../../contract/types.ts'
import { S1 } from './s1.ts'
import { S2 } from './s2.ts'
import { S3 } from './s3.ts'

export interface UnitSpec { id: string; side: Side; kind: UnitKind; name: string; hex: string; facing?: Dir }

export interface Scenario {
  id: ScenarioId
  title: string
  brief: string // the opening slip
  map: readonly string[]
  attacker: Side
  /** At the last dusk `side` wins if it holds at least `need` objectives, else the other side does. */
  dusk: { side: Side; need: number }
  maxRounds: number
  orders: Record<Side, number>
  morale: Record<Side, number>
  shells: Record<Side, { he: number; gas: number }>
  units: UnitSpec[]
  objectives: { hex: string; name: string; holder: Side | null }[]
  opening: { side: Side; kind: 'barrage'; target: string }[]
  reinforcements: { round: number; unit: UnitSpec }[]
  rainFrom: number | null // first rainy round (announced a round ahead)
  wind: Dir | null // S3 only: the direction gas drifts toward
  creep: boolean // British creeping barrage (S2)
  sluice: boolean // British sluice (S3)
}

export const SCENARIOS: Record<ScenarioId, Scenario> = { s1: S1, s2: S2, s3: S3 }
