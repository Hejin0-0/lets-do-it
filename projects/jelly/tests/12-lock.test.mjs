// Headless checks of Lock Jelly: a full round trip, the levels exactly from upper to lower and back, no gate
// opening across a step, the keeper never in the water or through things, the boat never touching a gate leaf
// or crossing the face, and every button. Run: node tests/12-lock.test.mjs
import { L } from '../src/specimens/12-lock/layout.js'
import { createWorld } from '../src/specimens/12-lock/world.js'
import { standable, beamSegs } from '../src/specimens/12-lock/keeper.js'
import { BOAT } from '../src/specimens/12-lock/boat.js'
let fails = 0
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }

// the water: three bodies at their levels, the chamber full with the top gate open
{
  const W = createWorld({ seed: 11 }), w = W.water
  check('the pounds stand at their levels', Math.abs(w.levelAt(-2, L.ZM) - L.LU) < 1e-6 && Math.abs(w.levelAt(1.0, L.ZM) - L.LL) < 1e-6 && Math.abs(w.levelAt(0, L.ZM) - L.LU) < 1e-6)
  check('the chamber starts full, the top gate open, the bottom shut', W.lock.isOpen(0) && W.lock.isShut(1) && w.isLinked(L.UP, L.CH) && !w.isLinked(L.CH, L.LO))
}

// a round trip, watched every tick
const leafSeg = (W, i) => { const g = L.GATES[i], d = L.leafDir(W.lock.gates[i].th); return [g.hinge, [g.hinge[0] + d[0] * L.LEAF, g.hinge[1] + d[1] * L.LEAF]] }
function watch(W, maxSec) {
  const S = { stepOpen: 0, levelsAtOpen: [], keeperBad: 0, keeperWhere: null, boatLeaf: 1, boatShallow: 1, face: 1, ticks: 0 }
  const prevTh = [W.lock.gates[0].th, W.lock.gates[1].th]
  const t0 = performance.now()
  for (let i = 0; i < maxSec * 120 && W.story.trips < 1; i++) {
    W.step(1); S.ticks++
    W.lock.gates.forEach((G, k) => {
      if (G.th > 0 && !W.lock.level0(k)) S.stepOpen++
      if (prevTh[k] === 0 && G.th > 0) S.levelsAtOpen.push([k, W.lock.level])
      prevTh[k] = G.th
    })
    const K = W.keeper
    if (K.sit === 0 && !standable(K.p[0], K.p[1], K.mode === 'push' ? [] : beamSegs(W.lock))) { S.keeperBad++; S.keeperWhere = K.p.map((v) => +v.toFixed(3)).concat(K.mode) }
    for (const [x, z] of W.boat.outline()) {
      const rest = L.bodyAt(x, z) === L.LO ? L.LL : L.bodyAt(x, z) === L.CH ? W.lock.level : L.LU
      S.boatShallow = Math.min(S.boatShallow, rest - L.terrainH(x, z) - BOAT.draft)
      S.face = Math.min(S.face, L.HALF - Math.abs(z), L.HALF - Math.abs(x))
      for (let g = 0; g < 2; g++) { const [a, b] = leafSeg(W, g); S.boatLeaf = Math.min(S.boatLeaf, L.segDist(x, z, a, b) - 0.026) }
    }
  }
  S.ms = (performance.now() - t0) / S.ticks
  S.sec = S.ticks / 120
  return S
}
{
  const W = createWorld({ seed: 11 }), S = watch(W, 420)
  check('a full round trip happens', W.story.trips === 1, S.sec.toFixed(0) + ' s')
  check('two lockfuls', W.lock.lockfuls === 2)
  check('gates open only at exactly the level beyond them', S.levelsAtOpen.length >= 2 && S.levelsAtOpen.every(([k, lv]) => lv === (k === 0 ? L.LU : L.LL)), JSON.stringify(S.levelsAtOpen))
  check('no gate ever stands open across a step', S.stepOpen === 0, S.stepOpen)
  check('the keeper never walks into the water or through anything', S.keeperBad === 0, S.keeperBad ? JSON.stringify(S.keeperWhere) : '')
  check('the boat never touches a gate leaf', S.boatLeaf > 0, S.boatLeaf.toFixed(3))
  check('the hull never runs aground', S.boatShallow > 0.005, S.boatShallow.toFixed(3))
  check('the stern never swings out through the face', S.face > 0.008, S.face.toFixed(3))
  check('cheap: under 1 ms a tick', S.ms < 1, S.ms.toFixed(3) + ' ms')
}

// Hurry speeds the keeper, the paddles and the boat
{
  const W = createWorld({ seed: 11 }); W.setHurry(true)
  const S = watch(W, 300)
  check('Hurry: a round trip in under two minutes', W.story.trips === 1 && S.sec < 120, S.sec.toFixed(0) + ' s')
}

// a gate refuses to open across a step
{
  const W = createWorld({ seed: 11 })
  W.lock.reset(true, -1)                           // all shut, the chamber full: a step at the bottom gate
  check('the bottom gate will not open across the step', W.lock.setGate(1, 0.3) === 0 && W.lock.isShut(1) && W.lock.refused === 1)
  W.lock.paddles[1].open = 1
  for (let i = 0; i < 120 * 30 && W.lock.level !== L.LL; i++) W.lock.step(1 / 120)
  check('drawn bottom paddles bring the chamber exactly to the lower level', W.lock.level === L.LL)
  check('then the bottom gate opens', W.lock.setGate(1, 0.3) === 0.3)
  check('and the top gate will not', W.lock.setGate(0, 0.3) === 0)
}

// the buttons: toot, bread, rubber duck
{
  const W = createWorld({ seed: 11 })
  W.step(120 * 2)
  const spot = W.life.heron.spot
  W.toot()
  check('Toot: the horn sounds', W.events.some((e) => e.type === 'horn'))
  W.step(120 * 6)
  check('Toot: the heron flies off somewhere else', W.life.heron.spot !== spot)
  const fed0 = W.life.fed, n = W.throwBread()
  check('Throw bread: a handful flies', n > 0, n)
  W.step(120 * 25)
  check('Throw bread: the birds eat it', W.life.fed > fed0, W.life.fed - fed0)
  const b = W.dropDuck()
  W.step(120 * 8)
  check('Rubber duck: it floats upright', b.submerged > 0 && b.Rm[4] > 0.9, b.Rm[4].toFixed(2))
  for (let k = 0; k < 12; k++) W.dropDuck()
  check('Rubber duck: no more than ten at once', W.floaters.bodies.length === 10)
  check('everything stays finite', [...W.life.fish.flatMap((f) => f.p), ...W.life.birds.flatMap((x) => x.p), ...W.floaters.bodies.flatMap((x) => x.p)].every(Number.isFinite))
}

// a rubber duck is stopped by a shut gate
{
  const W = createWorld({ seed: 11 })
  W.lock.reset(true, -1)
  const b = W.floaters.add({ spheres: [[0, 0.018, 0, 0.022], [-0.018, 0.022, 0, 0.014], [0.014, 0.044, 0, 0.013]], com: [0, 0.01, 0], rho: 0.32, p: [L.XT - 0.2, L.LU + 0.02, L.ZM] })
  for (let i = 0; i < 120 * 4; i++) { b.v[0] = 0.25; b.sleep = false; W.step(1) }
  check('a rubber duck pushed at the shut top gate stays above it', b.p[0] < L.XT - 0.02, b.p[0].toFixed(3))
}

// rubber ducks caught between an opening leaf and the back wall are squeezed out along the wall, never onto the coping
for (const gi of [0, 1]) {
  const W = createWorld({ seed: 11 })
  W.keeper.step = () => {}; W.story.tick = () => {}   // only the gate moves
  W.boat.place(gi === 0 ? 0.6 : -0.3, 3.5, 0)          // the boat off the block, out of the way
  W.lock.reset(gi === 0, -1)
  const g = L.GATES[gi], ducks = []
  for (let r = 0.08; r <= 0.4; r += 0.08) for (const a of [0.3, 0.8, 1.3]) {
    const x = g.hinge[0] - Math.sin(a) * r, z = g.hinge[1] + Math.cos(a) * r
    if (W.water.surface(x, z) - L.terrainH(x, z) > 0.05) ducks.push(W.floaters.add({ spheres: [[0, 0.018, 0, 0.022], [-0.018, 0.022, 0, 0.014], [0.014, 0.044, 0, 0.013]], com: [0, 0.01, 0], rho: 0.32, p: [x, W.water.surface(x, z) + 0.01, z] }))
  }
  for (let th = 0; th < Math.PI / 2; th += 0.96 / 120) { W.lock.setGate(gi, th); W.step(1) }
  W.lock.setGate(gi, Math.PI / 2); W.step(120 * 3)
  const ashore = ducks.filter((b) => !W.water.isWet(b.p[0], b.p[2]) || b.p[1] - W.water.surface(b.p[0], b.p[2]) > 0.035)
  check(`the ${g.name} gate opening on ${ducks.length} ducks puts none ashore`, ducks.length >= 10 && ashore.length === 0, ashore.map((b) => b.p.map((v) => v.toFixed(2)).join(',')).join(' '))
}

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exitCode = fails ? 1 : 0
