// Headless checks of Iceberg Jelly: a calm start with the pack settled upright, calving with its crack, plunge
// and capsize, a full round trip of the icebreaker without grounding, feeding, picking up and throwing a floe,
// and a long soak that stays finite. Run: node tests/13-iceberg.test.mjs
import { I } from '../src/specimens/13-iceberg/layout.js'
import { createWorld } from '../src/specimens/13-iceberg/world.js'
import { SHIP, BERTH } from '../src/specimens/13-iceberg/ship.js'
import { budget } from './budget.mjs'
let fails = 0
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }
const finite = (W) => [...W.floaters.bodies.flatMap((b) => [...b.p, ...b.v, ...b.q]), ...W.ship.v.c, W.ship.v.yaw, W.water.energy,
  ...W.life.peng.flatMap((q) => q.p), ...W.life.seal.flatMap((s) => s.p), ...W.life.orca.p].every(Number.isFinite)

// a calm start: nothing capsizes, the sea barely moves, every piece floats its stable way up
{
  const W = createWorld({ seed: 13 })
  W.ice.auto = false
  let eMax = 0
  const t0 = performance.now()
  for (let i = 0; i < 20 * 120; i++) { W.step(1); eMax = Math.max(eMax, W.water.energy) }
  const ms = (performance.now() - t0) / 2400
  check('calm start: nothing capsizes', W.ice.capsized === 0)
  check('calm start: the water stays still', eMax < 0.02, eMax.toFixed(4))
  const ups = W.ice.pieces.filter((p) => !p.slab).map((p) => W.floaters.up(p.body)[1])
  check('calm start: the pack floats upright', ups.every((u) => u > 0.8), Math.min(...ups).toFixed(2))
  check('three slabs stand ready at the cliff', W.ice.slots.filter((s) => s.piece).length === 3 && W.ice.ready())
  check('cheap: under 1 ms a tick', ms < budget(1), ms.toFixed(3) + ' ms')
}

// calving: a crack, the slab topples out, plunges, and settles a new way up
{
  const W = createWorld({ seed: 13 })
  W.ice.auto = false
  W.step(120)
  check('Calve: a slab breaks off', W.calve() && W.ice.calved === 1)
  const seen = new Set()
  for (let i = 0; i < 30 * 120; i++) { W.step(1); for (const e of W.events) seen.add(e.type); W.events.length = 0 }
  check('Calve: crack, splash and groan', ['crack', 'splash', 'groan'].every((t) => seen.has(t)), [...seen].join(','))
  check('Calve: the slab capsizes to a stable pose', W.ice.capsized >= 1, W.ice.capsized)
  check('Calve: waves spread', W.water.energy > 0)
  check('Calve: the glacier pushes a new slab out', W.ice.slots.every((s) => s.piece))
  let n = 0
  while (W.calve()) n++
  check('Calve: Wait… once no slab is ready', !W.ice.ready() && !W.calve(), n)
}

// the icebreaker: casts off, goes round through the pack, comes back alongside, never touching ground
{
  const W = createWorld({ seed: 13 })
  W.ice.auto = false
  W.ship.go()
  const texts = new Set()
  let shallow = 1, face = 1, sec = 0
  for (let i = 0; i < 400 * 120 && W.ship.trips < 1; i++) {
    W.step(1); sec += 1 / 120
    if (i % 12 === 0) texts.add(W.ship.status().text)
    for (const [x, z] of W.ship.v.outline()) {
      shallow = Math.min(shallow, I.SL - I.terrainH(x, z) - SHIP.draft)
      face = Math.min(face, I.HALF - Math.abs(x), I.HALF - Math.abs(z))
    }
  }
  texts.add(W.ship.status().text)
  check('Cast off: a full round trip', W.ship.trips === 1, sec.toFixed(0) + ' s')
  check('the status line runs through the whole round', ['Casting off', 'Under way', 'Coming alongside', 'Alongside'].every((t) => texts.has(t)), [...texts].join(' / '))
  check('she breaks ice on the way', texts.has('Breaking ice'))
  check('she never runs aground', shallow > 0.005, shallow.toFixed(3))
  check('she never swings out through the face', face > 0.01, face.toFixed(3))
  check('back alongside at the berth', Math.hypot(W.ship.v.c[0] - BERTH[0], W.ship.v.c[1] - BERTH[1]) < 1e-6 && W.ship.state === 'alongside')
  W.ship.go(); W.step(120 * 4); W.ship.go()
  check('Full ahead: under way, she goes faster', W.ship.full && W.ship.status().text !== 'Alongside')
}

// feeding, the horn
{
  const W = createWorld({ seed: 13 })
  W.horn()
  check('Horn: it sounds', W.events.some((e) => e.type === 'horn'))
  let thrown = 0
  for (let k = 0; k < 6; k++) { thrown += W.throwFish() ? 1 : 0; W.step(120 * 3) }
  W.step(120 * 30)
  check('Throw fish: they fly', thrown > 0, thrown)
  check('Throw fish: the penguins eat them', W.life.fed > 0, W.life.fed)
}

// picking up a floe and throwing it
{
  const W = createWorld({ seed: 13 })
  W.ice.auto = false
  const p = W.ice.pieces.find((q) => q.kind === 'tabular'), b = p.body
  const hit = W.pick([b.p[0], 3, b.p[2] + 0.001], [0, -1, 0])
  check('a ray from above picks the berg', hit && hit.body === b)
  W.floaters.grab(b)
  for (let i = 0; i < 60; i++) { W.floaters.hold(b, [b.p[0], I.SL + 0.5, b.p[2]]); W.step(1) }
  check('held: it lifts out of the water', b.p[1] > I.SL + 0.2, b.p[1].toFixed(3))
  W.floaters.throw(b, [0, -1, 0.3])
  let wake = 0
  for (let i = 0; i < 6 * 120; i++) { W.step(1); wake = Math.max(wake, W.water.energy) }
  check('thrown: it lands back in the water and floats', b.submerged > 0 && Math.abs(b.p[1] - I.SL) < 0.2, b.p[1].toFixed(3))
  check('thrown: its plunge makes waves', wake > 0.05, wake.toFixed(4))
}

// a long soak with everything on (auto calving, the ship's rounds, the creatures, snow): stays finite and sane
{
  const W = createWorld({ seed: 7 })
  W.snow = 1
  let bad = 0, eMax = 0, inside = true
  for (let s = 0; s < 600; s++) {
    W.step(120)
    eMax = Math.max(eMax, W.water.energy)
    if (!finite(W)) bad++
    for (const b of W.floaters.bodies) if (Math.abs(b.p[0]) > I.HALF + 0.1 || Math.abs(b.p[2]) > I.HALF + 0.1 || b.p[1] < 0.5) inside = false
    W.events.length = 0
  }
  check('soak: ten minutes, no NaN', bad === 0, bad)
  check('soak: the ice stays in the block', inside)
  check('soak: the glacier calves on its own', W.ice.calved >= 6, W.ice.calved)
  check('soak: the ship does her rounds', W.ship.trips >= 1, W.ship.trips)
  check('soak: the sea never runs away', eMax < 1, eMax.toFixed(3))
  W.reset()
  check('Reset: back to a calm bay', W.ice.calved === 0 && W.ship.state === 'alongside' && W.life.fed === 0 && finite(W))
}

// the icebreaker breaks the pancakes she shoves: shards drift aside and melt, new pancakes freeze in their place
{
  const W = createWorld({ seed: 5 }), pancakes = () => W.ice.pieces.filter((p) => p.kind === 'pancake' && !p.shard).length
  const n0 = pancakes()
  W.ship.go()
  let shards = 0
  for (let s = 0; s < 60 && W.ship.trips < 1; s++) { W.step(120); shards = Math.max(shards, W.ice.pieces.filter((p) => p.shard).length) }
  check('Breaking ice: she breaks a pancake or two on her way round', W.ice.broken >= 1 && pancakes() === n0 - W.ice.broken && shards >= 2, `${W.ice.broken} broken, ${shards} shards`)
  W.step(120 * 200)
  check('Breaking ice: the shards melt and new pancakes freeze', W.ice.pieces.filter((p) => p.shard).length === 0 && pancakes() >= n0 - W.ice.refreeze.length && W.ice.pieces.every((p) => p.body.p.every(Number.isFinite)), `${pancakes()} pancakes, ${W.ice.refreeze.length} to freeze`)
}

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exitCode = fails ? 1 : 0
