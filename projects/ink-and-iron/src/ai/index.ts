// The AI opponent (DESIGN §6): pure TypeScript on the rules core, side-agnostic, so the British
// self-play bot is the same code. planTurn(s, p) returns the acting side's orders, ending with endOrders.
export { PROFILES, WEIGHTS, TEMP_SCALE } from './profiles.ts'
export type { AiProfile, EvalTerm } from './profiles.ts'
export { planTurn } from './search.ts'
export type { Plan, PlanScore } from './search.ts'
export { evaluate, terms, bestReplyLoss, stickiness } from './evaluate.ts'
export { buildMaps, threat } from './maps.ts'
export type { Maps } from './maps.ts'
