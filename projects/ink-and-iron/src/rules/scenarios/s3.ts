import type { Scenario } from './index.ts'

// S3 "The Sluice". The British defend with a once-per-battle flood; the Germans bring gas.
export const S3: Scenario = {
  id: 's3',
  title: 'The Sluice',
  brief: 'Hold two of the bridge, the sluice and the farm ruin until dusk.',
  map: [
    '~s.....,,,,,,',
    '~s====..,,,,,',
    '~s####..,,.,,',
    '~s.o..o.,,,,,',
    '~s####..,,.,,',
    '~s====....,,,',
    '~s..V.......,',
    '~wwBwwwLwwwww',
    '~ss.......,,,',
  ],
  attacker: 'DE',
  dusk: { side: 'BR', need: 2 },
  // TUNED by selfplay (80 games a matchup). At 8 rounds and 3 German orders the reviewer's dodger
  // (hold still, step off the red ink, fire the suggested shells) held two posts until dusk in
  // ~76% of games against the General. More German shells, morale, a reinforcement, no wire in
  // front of their own trench and a harder AI push all left that at ~70-75%: the attack simply
  // ran out of daylight. 4 orders and a 9th round: the dodger loses ~71% to the General, the
  // Veteran-as-British beats the General ~46% (was 81%). Known deviation: the dodger still beats
  // the Veteran (~13%, gate 40%) — passive defence holds the Sluice below the top difficulty.
  maxRounds: 9,
  orders: { BR: 3, DE: 4 },
  morale: { BR: 10, DE: 16 },
  shells: { BR: { he: 4, gas: 0 }, DE: { he: 4, gas: 3 } },
  units: [
    { id: 'br-a', side: 'BR', kind: 'rifle', name: 'A Coy', hex: 'C6' },
    { id: 'br-b', side: 'BR', kind: 'rifle', name: 'B Coy', hex: 'E6' },
    { id: 'br-c', side: 'BR', kind: 'rifle', name: 'C Coy', hex: 'J7' },
    { id: 'br-mg', side: 'BR', kind: 'mg', name: 'Vickers West', hex: 'D6', facing: 0 },
    { id: 'br-mg2', side: 'BR', kind: 'mg', name: 'Vickers East', hex: 'G6', facing: 1 },
    { id: 'de-st1', side: 'DE', kind: 'stoss', name: 'Stoßtrupp Rohr', hex: 'F2' },
    { id: 'de-st2', side: 'DE', kind: 'stoss', name: 'Stoßtrupp Nord', hex: 'H1' },
    { id: 'de-1', side: 'DE', kind: 'rifle', name: '1st Company', hex: 'C2' },
    { id: 'de-2', side: 'DE', kind: 'rifle', name: '2nd Company', hex: 'E2' },
    { id: 'de-3', side: 'DE', kind: 'rifle', name: '3rd Company', hex: 'J2' },
    { id: 'de-mg1', side: 'DE', kind: 'mg', name: 'MG 08 West', hex: 'D2', facing: 3 },
    { id: 'de-mg2', side: 'DE', kind: 'mg', name: 'MG 08 Farm Road', hex: 'F1', facing: 3 },
  ],
  objectives: [
    { hex: 'D8', name: 'Bridge', holder: 'BR' },
    { hex: 'H8', name: 'Sluice', holder: 'BR' },
    { hex: 'E7', name: 'Farm ruin', holder: 'BR' },
  ],
  opening: [{ side: 'DE', kind: 'barrage', target: 'E6' }],
  reinforcements: [],
  rainFrom: null,
  wind: 1,
  creep: false,
  sluice: true,
}
