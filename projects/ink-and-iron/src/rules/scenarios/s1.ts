import type { Scenario } from './index.ts'

// S1 "Strandfest: Hold the Bridges", 10 July 1917. The British defend; the Germans attack.
export const S1: Scenario = {
  id: 's1',
  title: 'Strandfest: Hold the Bridges',
  brief: 'Hold two of the three Yser bridges until dusk.',
  map: [
    '~ssV..X....,,',
    '~s=========.,',
    '~s##.#####..,',
    '~s..o...o...,',
    '~s.o...o..o.,',
    '~s####.####.,',
    '~s=========.,',
    '~wwBwwwBwwwBw',
    '~ssV.......,,',
  ],
  attacker: 'DE',
  dusk: { side: 'BR', need: 2 },
  maxRounds: 8,
  orders: { BR: 3, DE: 3 },
  // Tuned by scripts/selfplay.ts (DESIGN §8 started at 9/14 morale and 4 British HE): at those
  // numbers British Veteran beat German General 77% of the time and German Veteran 81%.
  morale: { BR: 10, DE: 18 },
  shells: { BR: { he: 3, gas: 0 }, DE: { he: 6, gas: 0 } },
  units: [
    { id: 'br-a', side: 'BR', kind: 'rifle', name: 'A Coy', hex: 'E7' },
    { id: 'br-b', side: 'BR', kind: 'rifle', name: 'B Coy', hex: 'H7' },
    { id: 'br-c', side: 'BR', kind: 'rifle', name: 'C Coy', hex: 'J7' },
    { id: 'br-mg', side: 'BR', kind: 'mg', name: 'Vickers', hex: 'G7', facing: 0 },
    { id: 'de-1', side: 'DE', kind: 'rifle', name: '1st Company', hex: 'D2' },
    { id: 'de-2', side: 'DE', kind: 'rifle', name: '2nd Company', hex: 'F2' },
    { id: 'de-3', side: 'DE', kind: 'rifle', name: '3rd Company', hex: 'I2' },
    { id: 'de-4', side: 'DE', kind: 'rifle', name: '4th Company', hex: 'K2' },
    { id: 'de-mg1', side: 'DE', kind: 'mg', name: 'MG 08 Dune', hex: 'C2', facing: 2 },
    { id: 'de-mg2', side: 'DE', kind: 'mg', name: 'MG 08 Centre', hex: 'G2', facing: 3 },
  ],
  objectives: [
    { hex: 'D8', name: 'Dune bridge', holder: 'BR' },
    { hex: 'H8', name: 'Centre bridge', holder: 'BR' },
    { hex: 'L8', name: 'Polder bridge', holder: 'BR' },
  ],
  opening: [{ side: 'DE', kind: 'barrage', target: 'E7' }],
  reinforcements: [{ round: 2, unit: { id: 'de-st', side: 'DE', kind: 'stoss', name: 'Stoßtrupp', hex: 'L1' } }],
  rainFrom: null,
  wind: null,
  creep: false,
  sluice: false,
}
