// Headless soak: a full pool of forty for five minutes on each handoff seed keeps going round, cheaply.
// Run: node tests/crowd.test.mjs
import { createWorld } from '../src/pool/world.js'
import { MAX_DUCKS } from '../src/pool/ducks.js'
import { check, finite, watch, done } from './pool-kit.mjs'
import { budget } from './budget.mjs'

// A full pool of forty for five minutes, including all handoff seeds.
for (const seed of [3, 5, 7]) {
  console.log(`forty-duck seed ${seed}`)
  const W = createWorld({ seed, ducks: MAX_DUCKS })
  const t0 = performance.now()
  const S = watch(W, 300)
  const ms = (performance.now() - t0) / (300 * 120)
  check('forty ducks: all finite', finite(W))
  check('forty ducks: still going round', W.slides >= 40 && W.returns >= 35, `${W.slides} slides, ${W.returns} returns`)
  check('forty ducks: no jam', S.still < 45, S.still.toFixed(1) + ' s')
  check('forty ducks: none stranded', S.dry < 3, S.dry.toFixed(1) + ' s')
  check('forty ducks: no float stays in the slide\'s mouth', S.mouth < 5, S.mouth.toFixed(2) + ' s at most')
  check('forty ducks: still cheap', ms < budget(2), ms.toFixed(3) + ' ms')
  W.reset()
  check('Reset: back to the start', W.ducks.length === MAX_DUCKS && W.slides === 0 && W.returns === 0 && finite(W), W.ducks.length)
}

done()
