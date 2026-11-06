// Headless checks of the swan: still on the deck until handled, it creeps to the big pool, leaps in, holds ducks
// for a while and lets them go, and sets off again when lifted back onto the stone.
// Run: node tests/swan.test.mjs
import { P } from '../src/pool/layout.js'
import { createWorld } from '../src/pool/world.js'
import { FULL, EMPTY, check, region, done } from './pool-kit.mjs'

// Passive deck contact must settle, while picking up and throwing the swan must still wake it.
{
  const W=createWorld(EMPTY),b=W.swan;W.swanT=1e6;W.step(120);
  const p=b.p.slice(),q=b.q.slice();let drift=0,spin=0;
  for(let i=0;i<960;i++){W.step(1);drift=Math.max(drift,Math.hypot(...b.p.map((v,k)=>v-p[k])));spin=Math.max(spin,Math.hypot(...b.w));}
  check('Swan: untouched on a flat deck, no chatter or drift',b.sleep&&drift<1e-6&&spin===0,`${drift} drift, ${spin} spin`);
  W.hand.grab(b);W.hand.hold(b,[p[0],p[1]+.4,p[2]]);W.step(1);
  check('Swan: grabbing still lifts it',b.state==='held'&&b.p[1]>p[1]+.1);
  W.hand.throw(b,[0,2,0]);W.step(15);
  check('Swan: a throw still wakes it',!b.sleep&&b.p[1]>p[1]+.2);
}

// the swan: on the stone it creeps toward the big pool a hop at a time, and after a long while leaps in
{
  const W = createWorld(FULL), b = W.swan, x0 = b.p[0]
  let t = 0, inAt = null
  while (t < 600 && inAt === null) { W.step(120); t++; if (W.events.some((e) => e.type === 'swanIn')) inAt = t; W.events.length = 0; if (t === 120) check('Swan: after two minutes it has crept toward the pool, still on the stone', x0 - b.p[0] > 0.1 && !W.water.isWet(b.p[0], b.p[2]), `${(x0 - b.p[0]).toFixed(2)} closer`) }
  W.step(120 * 3)
  check('Swan: in the end it leaps into the big pool, upright', inAt !== null && inAt > 180 && region(W, b) === P.UP && W.floaters.up(b)[1] > 0.9, `at ${inAt} s`)
  // Watch ten minutes: encounters and release are stochastic; one 30-second visit is not guaranteed in five.
  // The residence/circulation requirements remain unchanged when the basin layout changes the encounter times.
  const inner = P.SWAN.R - P.SWAN.r, inRing = (d) => d.state === 'float' && Math.hypot(d.body.p[0] - b.p[0], d.body.p[2] - b.p[2]) < inner
  let held = 0, scoops = 0, outs = 0, longest = 0; const run = new Map(), s0 = W.slides
  for (let k = 0; k < 600 * 4; k++) {
    W.step(30)
    for (const e of W.events) { if (e.type === 'swanScoop') scoops++; if (e.type === 'swanOut') outs++ }
    W.events.length = 0
    for (const d of W.ducks) { const r = inRing(d) ? (run.get(d) || 0) + 0.25 : 0; run.set(d, r); longest = Math.max(longest, r); if (r) held += 0.25 }
  }
  check('Swan: afloat, it scoops up ducks and holds them', scoops >= 1 && held > 30, `${scoops} scooped, ${held} duck-seconds held`)
  check('Swan: and lets them go again (none is held the whole five minutes)', outs >= 1 && longest < 240, `${outs} hopped out, the longest held ${longest} s`)
  check('Swan: the ducks still go round', W.slides - s0 >= 20, W.slides - s0)
  // lifted out onto the stone, it sets off again
  W.hand.grab(b); for (let i = 0; i < 30; i++) { W.hand.hold(b, [P.SWAN.at[0] - 0.2, P.TER + 0.2, P.SWAN.at[1]]); W.step(1) }
  W.hand.throw(b, [0, 0, 0]); const x1 = b.p[0]
  W.step(120 * 120)
  check('Swan: put back on the stone, it creeps toward the pool again', x1 - b.p[0] > 0.1 || region(W, b) === P.UP, `${(x1 - b.p[0]).toFixed(2)} closer`)
}

done()
