// The rules core's public face (DESIGN §5, §11.3). Pure: no three, no DOM, no clock, no
// Math.random — all randomness is mulberry32 in GameState.rng.
import type { GameState } from '../contract/types.ts'

export { apply, legal, fireTargets } from './apply.ts'
export { forecast } from './forecast.ts'
export { reach, fan } from './movement.ts'
export { newGame } from './setup.ts'
export { IllegalAction, actingSide } from './state.ts'
export type { Step } from './state.ts'
export { TERRAIN_INFO } from './terrain.ts'
export { UNIT_STATS } from './units.ts'
export { describeIntent, footprint, planSlip } from './intents.ts'
export { hexName, parseHex } from './hex.ts'
export { SCENARIOS } from './scenarios/index.ts'
export { threat } from '../ai/maps.ts'
export { FIXTURES } from './fixtures.ts'
export type { FixtureName } from './fixtures.ts'

/** Stable digest of a state, for Undo/Rewind/determinism tests (cyrb53 over its JSON). */
export function stateHash(s: GameState): string {
  const str = JSON.stringify(s)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
export { OBSERVE, observed } from './apply.ts'
