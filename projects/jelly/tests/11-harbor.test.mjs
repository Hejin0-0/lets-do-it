// Headless checks of Harbor Jelly: the ship's whole day (the cranes' work, booms, the tug's tow, the lap, the
// berthing) with no grounding, nothing through the block's faces, the ship and the tug clear of the pier, the
// yachts, the buoys, the fishing boats and each other, the cranes never closer than their width, no box lost
// or doubled; cast off early and call her in; feeding, the horn and the gulls; the tide; a lifebuoy picked up,
// thrown and shoved by the ship; a long soak. Run: node tests/11-harbor.test.mjs
import { H } from '../src/specimens/11-harbor/layout.js'
import { createWorld } from '../src/specimens/11-harbor/world.js'
import { SHIP, TUG, BERTH } from '../src/specimens/11-harbor/ship.js'
import { CRANE } from '../src/specimens/11-harbor/cranes.js'
import { YACHTS, BUOYS, BOATS } from '../src/specimens/11-harbor/moorings.js'
import { buildScene } from '../src/specimens/11-harbor/scene.js'
import { budget } from './budget.mjs'
buildScene()   // as on the page: building the town also lays out the solid boxes (sheds, houses, stacks) things bounce off
let fails = 0
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }
const finite = (W) => [...W.floaters.bodies.flatMap((b) => [...b.p, ...b.q]), ...W.fleet.ship.c, ...W.fleet.tug.c, W.water.energy,
  ...W.life.fish.flatMap((f) => f.p), ...W.life.gulls.flatMap((g) => g.p), ...W.life.jelly.flatMap((j) => j.p), ...W.cranes.list.flatMap((c) => [c.x, c.tz, c.sy, c.boom])].every(Number.isFinite)
/** Every box in exactly one place: 72 of them, no two in one slot. */
const boxesOK = (W) => {
  const key = (x) => (x.at === 'ship' ? `s${x.bay}.${x.row}.${x.tier}` : x.at === 'lane' ? `l${x.lane}.${x.s}.${x.tier}` : `h${x.crane}`);
  const keys = W.boxes.all.map(key);
  return keys.length === 72 && new Set(keys).size === 72;
}
// what the hulls must keep clear of: [name, x, z, radius]
const KEEP = [...YACHTS.map((y, i) => [`yacht ${i + 1}`, ...y.buoy, 0.1 + 0.19]), ...BUOYS.map((b) => [b.kind + ' buoy', ...b.at, 0.03]), ...BOATS.map((b, i) => [`boat ${i + 1}`, ...b.at, 0.13])]
const pierGap = (x, z) => Math.max(Math.abs(x - H.PIER.x) - H.PIER.w / 2, z - H.PIER.z1)

// a whole day, watched every tick
{
  const W = createWorld({ seed: 11 }), S = W.story, { ship, tug } = W.fleet
  const texts = new Set(), clear = {}
  let shallow = { ship: 1, tug: 1 }, face = 1, pier = 1, cranes = 9, together = 1, boxes = true, sec = 0
  const t0 = performance.now()
  for (let i = 0; i < 260 * 120 && S.voyages < 1; i++) {
    W.step(1); sec += 1 / 120
    if (i % 6) continue
    texts.add(S.text)
    for (const [k, v, D] of [['ship', ship, SHIP], ['tug', tug, TUG]]) for (const [x, z] of v.outline()) {
      shallow[k] = Math.min(shallow[k], W.level - H.terrainH(x, z) - D.draft)
      face = Math.min(face, H.HALF - Math.abs(x), H.HALF - Math.abs(z))
      pier = Math.min(pier, pierGap(x, z))
      for (const [n, ox, oz, r] of KEEP) clear[n] = Math.min(clear[n] ?? 1, Math.hypot(x - ox, z - oz) - r)
    }
    if (S.text !== 'Berthing' && S.text !== 'Casting off') for (const [x, z] of tug.outline()) {   // apart, except when working together
      const h = [Math.cos(ship.yaw), Math.sin(ship.yaw)], dx = x - ship.c[0], dz = z - ship.c[1]
      together = Math.min(together, Math.max(Math.abs(dx * h[0] + dz * h[1]) - SHIP.len / 2, Math.abs(-dx * h[1] + dz * h[0]) - SHIP.beam / 2))
    }
    cranes = Math.min(cranes, Math.abs(W.cranes.list[0].x - W.cranes.list[1].x))
    boxes &&= boxesOK(W)
  }
  const ms = (performance.now() - t0) / (sec * 120)
  check('a whole day: back alongside', S.voyages === 1 && Math.hypot(ship.c[0] - BERTH[0], ship.c[1] - BERTH[1]) < 1e-6 && Math.abs(ship.yaw) < 1e-6, sec.toFixed(0) + ' s')
  // ('Tug coming' only shows if the tug is late: it sets off as the loading starts and is at her bow before the booms are up)
  check('the status line runs through the day', ['Booms down', 'Unloading', 'Loading', 'Booms up', 'Casting off', 'At sea', 'Coming in', 'Berthing'].every((t) => texts.has(t)), [...texts].join(' / '))
  check('a day in about a hundred seconds', sec < 100, sec.toFixed(1) + ' s')
  check('the cranes swap sixteen boxes', W.cranes.moved === 16, W.cranes.moved)
  check('no box lost or doubled', boxes && boxesOK(W))
  check('the cranes never closer than their width', cranes >= CRANE.width, cranes.toFixed(3))
  check('the ship never runs aground', shallow.ship > 0.01, shallow.ship.toFixed(3))
  check('nor the tug', shallow.tug > 0.01, shallow.tug.toFixed(3))
  check('nothing swings out through the faces', face > 0.05, face.toFixed(3))
  check('clear of the pier', pier > 0.02, pier.toFixed(3))
  check('clear of the yachts, the buoys and the fishing boats', Object.values(clear).every((d) => d > 0.02), JSON.stringify(Object.fromEntries(Object.entries(clear).map(([k, v]) => [k, +v.toFixed(3)]))))
  check('ship and tug apart but when working together', together > 0.01, together.toFixed(3))
  check('cheap: under 1 ms a tick', ms < budget(1), ms.toFixed(3) + ' ms')
}

// the spreaders swing on their falls as the cranes start and stop, and are steadied as they set a box down
{
  const W = createWorld({ seed: 11 }), cr = W.cranes.list
  let most = 0, atLatch = 0
  for (let i = 0; i < 120 * 40; i++) {
    W.step(1)
    for (const c of cr) most = Math.max(most, Math.hypot(c.sw[0], c.sw[1]))
    for (const e of W.events) if (e.type === 'latch') for (const c of cr) if (Math.abs(c.x - e.x) < 1e-6) atLatch = Math.max(atLatch, Math.hypot(c.sw[0], c.sw[1]))
    W.events.length = 0
  }
  check('the spreaders swing a little as the cranes move', most > 0.01 && most < 0.04, (most * 100).toFixed(1) + ' cm')
  check('and are steady when a box is latched or set down', atLatch < 0.002, (atLatch * 100).toFixed(2) + ' cm')
}

// cast off early: the cranes finish the box in hand and she goes; at sea, call her in
{
  const W = createWorld({ seed: 11 }), S = W.story
  while (S.text !== 'Unloading' || W.cranes.moved < 2) W.step(1)
  check('Cast off: it takes', W.go() && S.early)
  let t = 0
  while (S.phase === 'work' && t < 30) { W.step(1); t += 1 / 120 }
  check('Cast off: the cranes finish the box in hand and stop', S.phase !== 'work' && t < 15 && W.cranes.list.every((c) => !c.box), t.toFixed(1) + ' s')
  check('Cast off: no box lost', boxesOK(W))
  while (S.phase !== 'sea') W.step(1)
  const s0 = W.fleet.ship.s
  W.step(120 * 4)
  const slow = W.fleet.ship.s - s0
  check('Call her in: it takes at sea', W.go() && S.hurry)
  const s1 = W.fleet.ship.s
  W.step(120 * 4)
  check('Call her in: she hurries', W.fleet.ship.s - s1 > slow * 1.3, ((W.fleet.ship.s - s1) / slow).toFixed(2) + '×')
  check('Cast off greys out while busy', (() => { while (S.phase === 'sea') W.step(1); return !W.go() })())
}

// feeding, the horn, the gulls
{
  const W = createWorld({ seed: 11 })
  W.step(120 * 3)
  check('Feed the fish: pellets fly', W.feed() > 0)
  W.step(120 * 25)
  check('Feed the fish: they are eaten', W.life.fed > 0, W.life.fed)
  W.step(120 * 40)
  for (let t = 0; t < 120 * 120 && !W.life.gulls.some((g) => g.mode === 'perch'); t++) W.step(1)   // until one has perched, wherever the day is
  const perched = W.life.gulls.filter((g) => g.mode === 'perch').length
  W.horn(); W.step(2)
  check('Horn: every perched gull takes off', perched > 0 && W.life.gulls.every((g) => g.mode !== 'perch'), perched)
  check('Horn: it sounds', W.events.some((e) => e.type === 'horn'))
  W.step(120 * 40)
  check('the gulls come back to their perches', W.life.gulls.some((g) => g.mode === 'perch'))
}

// the tide: the sea, the ship, the moorings rise and fall
{
  const W = createWorld({ seed: 11 })
  W.setTide(1); W.step(120 * 4)
  const hi = [W.level, W.fleet.ship.y, W.moorings.yachts[0].M[7]]
  W.setTide(-1); W.step(120 * 6)
  const lo = [W.level, W.fleet.ship.y, W.moorings.yachts[0].M[7]]
  check('Tide: the sea level follows', Math.abs(hi[0] - (H.SL + H.TIDE)) < 1e-4 && Math.abs(lo[0] - (H.SL - H.TIDE)) < 1e-4, `${hi[0].toFixed(3)} / ${lo[0].toFixed(3)}`)
  check('Tide: the ship and the yachts follow it', Math.abs(hi[1] - hi[0]) < 0.01 && Math.abs(lo[1] - lo[0]) < 0.01 && Math.abs(hi[2] - hi[0]) < 0.01 && Math.abs(lo[2] - lo[0]) < 0.01)
}

// a lifebuoy: picked up, thrown, back afloat; another shoved aside by the ship as she goes out
{
  const W = createWorld({ seed: 11 }), F = W.floaters, b = W.buoys[0]
  const o = F.origin(b)
  const hit = W.pick([o[0] + 0.021, 3, o[2] + 0.001], [0, -1, 0])
  check('a lifebuoy can be picked', hit && hit.body === b)
  const hole = W.pick([o[0], 3, o[2]], [0, -1, 0])
  check('and by the hole in its middle', hole && hole.body === b)
  {   // dropped onto the biggest shed's roof, it stays up there
    const V = createWorld({ seed: 11 }), lb = V.buoys[1], box = H.BOXES.slice(1).sort((p, q) => (q[3] - q[0]) * (q[5] - q[2]) - (p[3] - p[0]) * (p[5] - p[2]))[0]
    V.floaters.grab(lb); for (let i = 0; i < 30; i++) { V.floaters.hold(lb, [(box[0] + box[3]) / 2, box[4] + 0.15, (box[2] + box[5]) / 2]); V.step(1) }
    V.floaters.throw(lb, [0, 0, 0]); V.step(120 * 3)
    check('a lifebuoy dropped on a shed lands on its roof, not through it', H.BOXES.length > 20 && lb.p[1] > box[4] - 0.005, lb.p[1].toFixed(3))
  }
  F.grab(b)
  for (let i = 0; i < 60; i++) { F.hold(b, [b.p[0], H.SL + 0.4, b.p[2] + 0.2]); W.step(1) }
  check('held: it lifts', b.p[1] > H.SL + 0.2, b.p[1].toFixed(3))
  F.throw(b, [0.3, 0, 0.5])
  W.step(120 * 6)
  check('thrown: it floats again, flat', b.submerged > 0 && Math.abs(b.p[1] - W.level) < 0.03 && F.up(b)[1] > 0.9, b.p[1].toFixed(3))
  const s = W.buoys[2], p0 = s.p.slice()
  while (W.story.phase !== 'sea') W.step(1)
  W.step(120 * 12)
  check('the ship shoves a lifebuoy aside', Math.hypot(s.p[0] - p0[0], s.p[2] - p0[2]) > 0.1 && W.fleet.ship.solid(s.p[0], s.p[1], s.p[2], 0, [0, 0, 0], [0, 0, 0]) === 0, Math.hypot(s.p[0] - p0[0], s.p[2] - p0[2]).toFixed(2))
}

// a long soak with everything going: finite, the sea calm enough, every box accounted for
{
  const W = createWorld({ seed: 5 })
  let bad = 0, eMax = 0, ok = true
  for (let s = 0; s < 600; s++) {
    W.step(120)
    eMax = Math.max(eMax, W.water.energy)
    if (!finite(W)) bad++
    ok &&= boxesOK(W)
    if (s % 90 === 45) W.feed()
    W.events.length = 0
  }
  check('soak: ten minutes, no NaN', bad === 0, bad)
  check('soak: the ship keeps working', W.story.voyages >= 3, W.story.voyages)
  check('soak: every box accounted for', ok)
  check('soak: the sea never runs away', eMax < 1.5, eMax.toFixed(3))
  W.reset()
  check('Reset: back to the start', W.story.voyages === 0 && W.cranes.moved === 0 && W.life.fed === 0 && finite(W) && boxesOK(W))
}

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exitCode = fails ? 1 : 0
