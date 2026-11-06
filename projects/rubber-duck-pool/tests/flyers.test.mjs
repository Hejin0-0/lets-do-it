// Headless checks of the flyers: a duck in a propeller cap flies now and then, to a pool or out to sea; a plain
// duck never flies, and none starts in a cap.
// Run: node tests/flyers.test.mjs
import { P } from '../src/pool/layout.js'
import { createWorld } from '../src/pool/world.js'
import { MAX_DUCKS, PROPELLER } from '../src/pool/ducks.js'
import { oceanAt } from '../src/pool/ocean.js'
import { check, done } from './pool-kit.mjs'

// flyers: a duck in a propeller cap flies now and then; some flights land in a pool, some take it out over the island
// to the sea, where it remains available for rescue; a plain duck never flies
{
  const W = createWorld({ seed: 14, arrivals: false }), flyers = [0, 1, 2, 3].map(() => W.addFlyer())
  let landed = 0, high = 0, was = new Map()
  for (let k = 0; k < 240 * 4; k++) {   // four minutes: a flight out to sea now crosses the island's beach or headland, some 20 to 30 s
    W.step(30)
    for (const d of flyers) {
      if (d.state === 'fly') high = Math.max(high, d.body.p[1] - P.LU)
      if (was.get(d) === 'fly' && d.state === 'float') landed++
      was.set(d, d.state)
    }
  }
  const atSea = flyers.filter((d) => d.state === 'sea' && W.ducks.includes(d))
  check('Flyers: each wears the propeller', flyers.every((d) => d.hat === PROPELLER))
  check('Flyers: they fly up over the pool and land back in it', landed >= 1 && high > 0.4, `${landed} landings, up to ${high.toFixed(2)} over the water`)
  const onWaves = (d) => Math.abs(d.body.p[1] - (P.SEA + oceanAt(d.body.p[0], d.body.p[2], W.time - 1 / 120)[0] - 0.02)) < 1e-9   // placed in the tick before the clock moved on
  check('Flyers: some fly out over the cliff to the sea, and ride its waves', W.escaped >= 1 && atSea.every((d) => Math.max(Math.abs(d.body.p[0]), Math.abs(d.body.p[2])) > P.HALF && onWaves(d)), `${W.escaped} out to sea`)
  if (atSea[0]) {
    let lo = Infinity, hi = -Infinity
    for (let s = 0; s < 40; s++) { W.step(30); lo = Math.min(lo, atSea[0].body.p[1]); hi = Math.max(hi, atSea[0].body.p[1]) }
    check('Flyers: out at sea one rises and falls with the swell', hi - lo > 0.02, `${(hi - lo).toFixed(3)} up and down in 10 s`)
  }
  W.mixUp()
  check('Flyers: mixing them up keeps their propellers', W.ducks.filter((d) => d.hat === PROPELLER).length === flyers.filter((d) => W.ducks.includes(d)).length)
  const out = atSea[0], n = W.ducks.length
  W.step(120 * 125)
  check('Flyers: a stranded duck remains at sea for rescue', !out || (W.ducks.includes(out) && out.state === 'sea' && W.ducks.length === n), `${n} -> ${W.ducks.length} ducks`)
  const V = createWorld({ seed: 14 }); let flew = false
  for (let k = 0; k < 180 * 4; k++) { V.step(30); flew ||= V.ducks.some((d) => d.state === 'fly') }
  check('Flyers: a plain duck never flies', !flew && V.escaped === 0)
  let caps = 0; for (let seed = 1; seed <= 20; seed++) caps += createWorld({ seed, ducks: MAX_DUCKS }).ducks.filter((d) => d.hat === PROPELLER).length
  check('Flyers: no duck starts in a propeller cap (20 pools of forty)', caps === 0, caps)
}

done()
