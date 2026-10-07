import type { Scenario } from './index.ts'

// S2 "The Great Dune". The British attack with four orders, a Mark IV and a creeping barrage.
export const S2: Scenario = {
  id: 's2',
  title: 'The Great Dune',
  brief: 'Take two of the church, the château and the blockhouse by dusk.',
  map: [
    '~sss.C..X...,',
    '~ss.V.V......',
    '~s====P======',
    '~s###########',
    '~ss.o..o..o..',
    '~ss.o.o...o..',
    '~s#.###.###.#',
    '~s===========',
    '~ssV.........',
  ],
  attacker: 'BR',
  dusk: { side: 'BR', need: 2 },
  maxRounds: 8,
  orders: { BR: 4, DE: 3 },
  // TUNED by selfplay (DESIGN §8 "starting numbers are tuned with the harness"). The design
  // defaults (DE morale 12, BR HE 8) let the British rout the Germans with shells alone in round
  // 2 — every game, every matchup. At DE 15 / BR HE 7 / DE HE 8 (100 games per matchup): terrain
  // bot 0.80, Veteran vs Recruit 0.95, vs General 0.43, charger loses 100%. bothBleed reads 0.90
  // (gate 0.95): a Veteran British side reads every inked barrage and takes no losses in ~20% of
  // its games — the red ink doing its job, recorded as a known deviation. (2026-10 it read 0.38.
  // Tried: the creeping barrage capped at 1 a hit — the AI British then lost 86% to the General and
  // still bled no more; it shells from range and never assaults. The gap is that attacker doctrine,
  // not the numbers; a human attacker who closes does bleed.)
  morale: { BR: 14, DE: 15 },
  shells: { BR: { he: 7, gas: 0 }, DE: { he: 8, gas: 0 } },
  units: [
    { id: 'br-a', side: 'BR', kind: 'rifle', name: 'A Coy', hex: 'D8' },
    { id: 'br-b', side: 'BR', kind: 'rifle', name: 'B Coy', hex: 'F8' },
    { id: 'br-c', side: 'BR', kind: 'rifle', name: 'C Coy', hex: 'H8' },
    { id: 'br-d', side: 'BR', kind: 'rifle', name: 'D Coy', hex: 'J8' },
    { id: 'br-e', side: 'BR', kind: 'rifle', name: 'E Coy', hex: 'L8' },
    { id: 'br-mg', side: 'BR', kind: 'mg', name: 'Lewis', hex: 'E8', facing: 0 },
    { id: 'br-tank', side: 'BR', kind: 'tank', name: 'Mark IV "Fray Bentos"', hex: 'G9' },
    { id: 'de-mg1', side: 'DE', kind: 'mg', name: 'MG 08 West', hex: 'E3', facing: 3 },
    { id: 'de-mg2', side: 'DE', kind: 'mg', name: 'MG 08 Blockhouse', hex: 'G3', facing: 3 },
    { id: 'de-mg3', side: 'DE', kind: 'mg', name: 'MG 08 East', hex: 'J3', facing: 4 },
    { id: 'de-1', side: 'DE', kind: 'rifle', name: '1st Company', hex: 'C3' },
    { id: 'de-2', side: 'DE', kind: 'rifle', name: '2nd Company', hex: 'I3' },
    { id: 'de-3', side: 'DE', kind: 'rifle', name: '3rd Company', hex: 'L3' },
    { id: 'de-gun', side: 'DE', kind: 'fieldgun', name: '7.7 cm Field Gun', hex: 'H2' },
  ],
  objectives: [
    { hex: 'F1', name: 'Church', holder: 'DE' },
    { hex: 'I1', name: 'Château', holder: 'DE' },
    { hex: 'G3', name: 'Blockhouse', holder: 'DE' },
  ],
  opening: [{ side: 'DE', kind: 'barrage', target: 'F8' }],
  reinforcements: [],
  rainFrom: 5,
  wind: null,
  creep: true,
  sluice: false,
}
