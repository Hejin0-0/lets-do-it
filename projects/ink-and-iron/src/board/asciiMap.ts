// The DESIGN §8 scenario maps as data, for the board harness and the node self-check only.
// ponytail: the game gets terrain from rules/newGame(); this exists so the board can be built
// and judged before Worker-A's scenarios land. Delete once newGame returns real terrain.
import { COLS, ROWS } from '../contract/types.ts'
import type { Dir, GameState, ScenarioId, Side, Terrain, Unit, UnitKind } from '../contract/types.ts'
import { parseHex } from './HexLayout.ts'

export const MAPS: Record<ScenarioId, string[]> = {
  s1: ['~ssV..X....,,', '~s=========.,', '~s##.#####..,', '~s..o...o...,', '~s.o...o..o.,',
    '~s####.####.,', '~s=========.,', '~wwBwwwBwwwBw', '~ssV.......,,'],
  s2: ['~sss.C..X...,', '~ss.V.V......', '~s====P======', '~s###########', '~ss.o..o..o..',
    '~ss.o.o...o..', '~s#.###.###.#', '~s===========', '~ssV.........'],
  s3: ['~s.....,,,,,,', '~s====..,,,,,', '~s####..,,.,,', '~s.o..o.,,,,,', '~s####..,,.,,',
    '~s====....,,,', '~s..V.......,', '~wwBwwwLwwwww', '~ss.......,,,'],
}

const KEY: Record<string, Terrain> = {
  '~': 'sea', s: 'dune', '.': 'open', ',': 'polder', '=': 'trench', '#': 'open', o: 'crater',
  w: 'river', V: 'ruin', C: 'church', X: 'chateau', P: 'blockhouse', B: 'bridge', L: 'sluice',
}

export function parseMap(rows: string[]): { terrain: Terrain[]; wire: boolean[] } {
  if (rows.length !== ROWS) throw new Error('map needs 9 rows')
  const terrain: Terrain[] = [], wire: boolean[] = []
  for (const row of rows) {
    if (row.length !== COLS) throw new Error(`map row "${row}" is not 13 wide`)
    for (const ch of row) {
      const t = KEY[ch]
      if (!t) throw new Error(`unknown map glyph ${ch}`)
      terrain.push(t)
      wire.push(ch === '#')
    }
  }
  return { terrain, wire }
}

type Spec = [id: string, side: Side, kind: UnitKind, name: string, hex: string, facing: Dir, str?: number]
const UNITS: Record<ScenarioId, Spec[]> = {
  s1: [['A Coy', 'BR', 'rifle', 'A Company', 'E7', 0], ['B Coy', 'BR', 'rifle', 'B Company', 'H7', 0],
    ['C Coy', 'BR', 'rifle', 'C Company', 'J7', 0], ['Vickers', 'BR', 'mg', 'Vickers Section', 'G7', 0],
    ['1 Kp', 'DE', 'rifle', '1. Kompanie', 'D2', 3], ['2 Kp', 'DE', 'rifle', '2. Kompanie', 'F2', 3],
    ['3 Kp', 'DE', 'rifle', '3. Kompanie', 'I2', 3], ['4 Kp', 'DE', 'rifle', '4. Kompanie', 'K2', 3],
    ['MG G2', 'DE', 'mg', 'MG 08', 'G2', 3], ['MG C2', 'DE', 'mg', 'MG 08', 'C2', 2]],
  s2: [['A', 'BR', 'rifle', 'A Coy', 'D8', 0], ['B', 'BR', 'rifle', 'B Coy', 'F8', 0], ['C', 'BR', 'rifle', 'C Coy', 'H8', 0],
    ['D', 'BR', 'rifle', 'D Coy', 'J8', 0], ['E', 'BR', 'rifle', 'E Coy', 'L8', 0], ['Lewis', 'BR', 'mg', 'Lewis', 'E8', 0],
    ['Tank', 'BR', 'tank', 'Mark IV', 'G9', 0], ['MG1', 'DE', 'mg', 'MG 08', 'E3', 3], ['MG2', 'DE', 'mg', 'MG 08', 'G3', 3],
    ['MG3', 'DE', 'mg', 'MG 08', 'J3', 4], ['K1', 'DE', 'rifle', '1. Kp', 'C3', 3], ['K2', 'DE', 'rifle', '2. Kp', 'I3', 3],
    ['K3', 'DE', 'rifle', '3. Kp', 'L3', 3], ['FK', 'DE', 'fieldgun', 'Feldkanone', 'H2', 3]],
  s3: [['A', 'BR', 'rifle', 'A Coy', 'C6', 0], ['B', 'BR', 'rifle', 'B Coy', 'E6', 0], ['C', 'BR', 'rifle', 'C Coy', 'J7', 0],
    ['V1', 'BR', 'mg', 'Vickers', 'D6', 0], ['V2', 'BR', 'mg', 'Vickers', 'G6', 1], ['S1', 'DE', 'stoss', 'Stoßtrupp', 'F2', 3],
    ['S2', 'DE', 'stoss', 'Stoßtrupp', 'H1', 3], ['K1', 'DE', 'rifle', '1. Kp', 'C2', 3], ['K2', 'DE', 'rifle', '2. Kp', 'E2', 3],
    ['K3', 'DE', 'rifle', '3. Kp', 'J2', 3], ['MG1', 'DE', 'mg', 'MG 08', 'D2', 3], ['MG2', 'DE', 'mg', 'MG 08', 'F1', 3]],
}
const STR: Record<UnitKind, number> = { rifle: 4, mg: 3, fieldgun: 2, tank: 4, stoss: 3 }
const OBJ: Record<ScenarioId, [string, string, Side | null][]> = {
  s1: [['D8', 'Crowder Bridge', 'BR'], ['H8', 'Vauxhall Bridge', 'BR'], ['L8', 'Putney Bridge', 'BR']],
  s2: [['F1', 'The Church', 'DE'], ['I1', 'The Château', 'DE'], ['G3', 'The Blockhouse', 'DE']],
  s3: [['D8', 'The Bridge', 'BR'], ['H8', 'The Sluice', 'BR'], ['E7', 'The Farm Ruin', 'BR']],
}
const MORALE: Record<ScenarioId, [number, number]> = { s1: [9, 14], s2: [14, 12], s3: [10, 16] }

export function unitOf(s: Spec): Unit {
  return { id: s[0], side: s[1], kind: s[2], name: s[3], hex: parseHex(s[4]), str: s[6] ?? STR[s[2]], facing: s[5],
    suppressedUntil: 0, dugIn: false, bogged: false, ordered: false, acted: false }
}

export function asciiState(id: ScenarioId): GameState {
  const { terrain, wire } = parseMap(MAPS[id])
  const [br, de] = MORALE[id]
  const stoss = unitOf(['Stoss', 'DE', 'stoss', 'Stoßtrupp', 'L1', 3])
  return {
    scenario: id, difficulty: 'recruit', seed: 42, rng: 42, round: 1, maxRounds: 8, phase: 'player-orders', human: 'BR',
    terrain, wire, gas: new Array(COLS * ROWS).fill(0), units: UNITS[id].map(unitOf),
    intents: id === 's1' ? [{ id: 1, side: 'DE', source: 'battery', kind: 'barrage', from: null, target: parseHex('E7'), dmg: 2 }] : [],
    objectives: OBJ[id].map(([h, name, holder]) => ({ hex: parseHex(h), name, holder })),
    orderLimit: { BR: id === 's2' ? 4 : 3, DE: 3 }, ordersLeft: id === 's2' ? 4 : 3, active: null,
    morale: { BR: br, DE: de }, moraleStart: { BR: br, DE: de },
    shells: { BR: { he: id === 's2' ? 8 : 4, gas: 0 }, DE: { he: id === 's3' ? 4 : 6, gas: id === 's3' ? 3 : 0 } },
    weather: { now: 'dry', next: 'dry' }, wind: { now: 4, next: 4 }, creep: null, sluiceUsed: false,
    reinforcements: id === 's1' ? [{ round: 3, unit: stoss }] : [], ledger: [], winner: null, endReason: null,
  }
}
