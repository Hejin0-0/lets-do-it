// What the headless pool checks share: the dozen-duck and empty pools, the pass/fail tally, and watching the ducks.
import { P } from '../src/pool/layout.js'
import { DUCK_FLOAT } from '../src/pool/ducks.js'
let fails = 0
export const FULL = { seed: 14, ducks: 12, arrivals: false }, EMPTY = { seed: 14, ducks: 0, arrivals: false }   // a dozen ducks, or none, and no more coming
export const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }
export const finite = (W) => [...W.ducks, ...W.toys.map((body) => ({ body }))].every((d) => [...d.body.p, ...d.body.q].every(Number.isFinite)) && Number.isFinite(W.water.energy)
export const region = (W, b) => (W.water.isWet(b.p[0], b.p[2]) ? W.water.regionAt(b.p[0], b.p[2]) : -1)
/** Watch the ducks for sec seconds: the longest any one sat still afloat, the longest any was out of the water,
 * the longest a float stayed in the slide's mouth (passing through it is fine; staying would jam the slide), and how
 * stirred the water was on average over the last third (a splash comes and goes; shaking keeps it up). */
export function watch(W, sec) {
  const last = new Map(), atMouth = new Map()
  let still = 0, dry = 0, mouth = 0, stir = 0, n = 0
  for (let s = 0; s < sec * 4; s++) {
    W.step(30)
    if (s >= sec * 4 * 2 / 3) { stir += W.water.energy; n++ }
    for (const b of W.toys.filter((b) => b.toy !== 'ball')) {
      const t = Math.hypot(b.p[0] - P.MOUTH[0], b.p[2] - P.MOUTH[1]) < 0.12 ? (atMouth.get(b) || 0) + 0.25 : 0
      atMouth.set(b, t); mouth = Math.max(mouth, t)
    }
    for (const d of W.ducks) {
      const r = last.get(d) || { p: d.body.p.slice(), t: 0, dry: 0 }
      last.set(d, r)
      const busy = d.state !== 'float' || d.body.state === 'held'
      if (busy || Math.hypot(d.body.p[0] - r.p[0], d.body.p[2] - r.p[2]) > 0.06) { r.p = d.body.p.slice(); r.t = 0 } else r.t += 0.25
      still = Math.max(still, r.t)
      r.dry = busy || (region(W, d.body) >= 0 && d.body.submerged > 0) ? 0 : r.dry + 0.25
      dry = Math.max(dry, r.dry)
    }
  }
  return { still, dry, mouth, stir: stir / Math.max(1, n) }
}
/** A duck put down by hand at p. */
export function duckAt(W, p) {
  const b = W.floaters.add({ ...DUCK_FLOAT, p })
  const d = { stats: { slides: 0, lifts: 0, laps: 0, bestLap: null, lastLap: null, flights: 0, seaTrips: 0, rescued: 0 }, slot: W.ducks.length, body: b, colour: 0, hat: 0, state: 'float', s: 0, vs: 0, wait: 0, laps: 0, id: 99, inRound: 0 }
  b.duck = d; W.ducks.push(d)
  return d
}
/** Print the tally and fail the run if any check failed. */
export function done() { console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exitCode = fails ? 1 : 0 }
