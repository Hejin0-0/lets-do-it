// Unit table (DESIGN §5). Stats never change with difficulty.
import type { Dir, HexId, Side, Unit, UnitKind } from '../contract/types.ts'

export const UNIT_STATS: Record<UnitKind, { label: string; str: number; move: number; fire: number; range: number }> = {
  rifle: { label: 'Rifle Company', str: 4, move: 2, fire: 2, range: 1 },
  mg: { label: 'MG Section', str: 3, move: 1, fire: 3, range: 3 },
  fieldgun: { label: 'Field Gun', str: 2, move: 1, fire: 3, range: 4 },
  tank: { label: 'Mark IV', str: 4, move: 2, fire: 3, range: 2 },
  stoss: { label: 'Stoßtrupp', str: 3, move: 3, fire: 2, range: 1 },
}

/** Per-figure value for the AI's material term (DESIGN §6). */
export const VALUE: Record<UnitKind, number> = { rifle: 1, stoss: 1.3, mg: 1.5, fieldgun: 1.5, tank: 2.5 }

export const canAssault = (k: UnitKind): boolean => k === 'rifle' || k === 'stoss'
export const canFire = (k: UnitKind): boolean => k === 'mg' || k === 'fieldgun' || k === 'tank'
export const canCapture = (k: UnitKind): boolean => k === 'rifle' || k === 'stoss'
export const canCut = (k: UnitKind): boolean => k === 'rifle'
/** MGs and field guns move or fire, never both. */
export const firesAfterMove = (k: UnitKind): boolean => k === 'tank'
/** Wire stops everything but the tank (crushes it) and the Stoßtrupp (ignores it). */
export const stoppedByWire = (k: UnitKind): boolean => k !== 'tank' && k !== 'stoss'
/** Small arms (rifles, Stoßtrupps, MGs, overwatch) cannot hurt a tank. */
export const smallArms = (k: UnitKind): boolean => k === 'rifle' || k === 'stoss' || k === 'mg'

export const other = (s: Side): Side => (s === 'BR' ? 'DE' : 'BR')

export function makeUnit(id: string, side: Side, kind: UnitKind, name: string, hex: HexId, facing: Dir = side === 'BR' ? 0 : 3): Unit {
  return {
    id, side, kind, name, hex, str: UNIT_STATS[kind].str, facing,
    suppressedUntil: 0, dugIn: false, bogged: false, ordered: false, acted: false,
  }
}
