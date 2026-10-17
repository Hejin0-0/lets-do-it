// Headless checks of the diorama's floating bodies in a flat-bottomed pool. Run: node tests/diorama-floaters.test.mjs
import { createShallowWater, terrainGrid } from './water.js'
import { createBlock } from './block.js'
import { createFloaters } from './floaters.js'
let fails = 0
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }

const N = 64, HALF = 2, FLOOR = 0.2, LEVEL = 1.0, terrainH = () => FLOOR
const lcg = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647
function pool() {
  const water = createShallowWater({ N, half: HALF, terrain: terrainGrid(N, HALF, terrainH), level: LEVEL })
  const block = createBlock({ half: HALF, tiltMax: 0.17, g: 9.8 })
  const F = createFloaters({ water, block, terrainH, half: HALF, rand: lcg(1) })
  let tick = 0
  const run = (sec, each) => {
    for (let n = Math.round(sec * 240); n > 0; n--) {
      if (tick++ % 2 === 0) { block.step(1 / 120, 0.5, false); F.feed(); water.step(1 / 120, block.g[0] * 0.35, block.g[2] * 0.35) }
      F.step(1 / 240)
      each?.()
    }
  }
  return { water, block, F, run }
}
const turn = (axis, a) => [axis[0] * Math.sin(a / 2), axis[1] * Math.sin(a / 2), axis[2] * Math.sin(a / 2), Math.cos(a / 2)]
// a duck: a round body, a head forward and up, the weight low in the belly
const DUCK = { spheres: [[0, 0.07, 0, 0.11], [-0.07, 0.08, 0, 0.08], [0.09, 0.2, 0, 0.065], [0.16, 0.19, 0, 0.03]], com: [0, 0.03, 0], rho: 0.3 }

// a ball floats at its draft
for (const rho of [0.25, 0.5, 0.8]) {
  const { F, run } = pool(), r = 0.12
  const b = F.add({ spheres: [[0, 0, 0, r]], rho, p: [0.3, LEVEL + 0.4, -0.2] })
  run(8)
  // depth d with cap(d) = rho * sphere
  let lo = 0, hi = 2 * r
  for (let i = 0; i < 50; i++) { const d = (lo + hi) / 2; if ((Math.PI * d * d * (3 * r - d)) / 3 < rho * (4 / 3) * Math.PI * r ** 3) lo = d; else hi = d }
  const want = LEVEL + r - lo, got = b.p[1]   // centre = surface + r − depth
  check(`ball of rho ${rho} floats at its draft`, Math.abs(got - want) < 0.012, `${got.toFixed(3)} vs ${want.toFixed(3)}`)
}

// what a body displaces goes to the sea (which then spreads it and drifts back to its rest level)
{
  const { water, F } = pool(), v0 = water.volume()
  const b = F.add({ ...DUCK, p: [0.3, LEVEL, 0.2] })
  F.grab(b); F.step(1 / 240); F.feed()
  const dv = water.volume() - v0
  check('displaced volume goes to the sea', b.submerged > 0 && Math.abs(dv - b.submerged) / b.submerged < 0.01, `${dv.toFixed(5)} vs ${b.submerged.toFixed(5)}`)
}

// a duck dropped upside down rights itself and sits level
{
  const { F, run } = pool()
  const b = F.add({ ...DUCK, p: [0, LEVEL + 0.5, 0], q: turn([1, 0, 0], 3.0) })
  run(10)
  const up = F.up(b)
  check('capsized duck rights itself', up[1] > 0.97, up.map((v) => v.toFixed(2)).join(','))
  check('duck rests at the surface', Math.abs(b.p[1] - LEVEL) < 0.08 && b.submerged > 0, (b.p[1] - LEVEL).toFixed(3))
}

// a top-heavy body capsizes to a stable pose (weight high: it floats upside down)
{
  const { F, run } = pool()
  const b = F.add({ spheres: [[0, 0, 0, 0.12], [0, 0.18, 0, 0.06]], com: [0, 0.2, 0], rho: 0.5, p: [0, LEVEL + 0.3, 0], q: turn([0, 0, 1], 0.2) })
  run(10)
  check('top-heavy body turns over', F.up(b)[1] < -0.9, F.up(b)[1].toFixed(2))
  check('and comes to rest', Math.hypot(...b.w) < 0.2, Math.hypot(...b.w).toFixed(3))
}

// a floating duck rides a passing wave: up and down, and back near where it was
{
  const { water, F, run } = pool()
  const b = F.add({ ...DUCK, p: [0, LEVEL + 0.1, 0] })
  run(5)
  const y0 = b.p[1], x0 = b.p[0]
  water.addVolume(-0.8, 0, 0.02, 0.15)
  let lo = 9, hi = -9
  run(3, () => { lo = Math.min(lo, b.p[1]); hi = Math.max(hi, b.p[1]) })
  check('duck rides the wave', hi - y0 > 0.006 && y0 - lo > 0.004, `+${(hi - y0).toFixed(3)} −${(y0 - lo).toFixed(3)}`)
  check('without drifting far', Math.hypot(b.p[0] - x0, b.p[2]) < 0.35, Math.hypot(b.p[0] - x0, b.p[2]).toFixed(3))
}

// heavy things sink and rest on the floor
{
  const { F, run } = pool()
  const stone = F.add({ spheres: [[0, 0, 0, 0.09]], rho: 2.4, p: [0.5, LEVEL + 0.5, 0.5] })
  run(6)
  check('stone sinks to the floor', Math.abs(stone.p[1] - (FLOOR + 0.09)) < 0.01, stone.p[1].toFixed(3))
  check('and sleeps there', stone.sleep)
}

// a crowd thrown in, the block tipped and stirred: everything stays finite, inside, and apart
{
  const { water, block, F, run } = pool()
  const R = lcg(9)
  for (let k = 0; k < 24; k++) {
    const ax = [R() - 0.5, R() - 0.5, R() - 0.5], l = Math.hypot(...ax)
    const b = F.add({ ...DUCK, p: [(R() * 2 - 1) * 1.5, LEVEL + 0.3 + R() * 1.5, (R() * 2 - 1) * 1.5], q: turn(ax.map((v) => v / l), R() * 6) })
    F.throw(b, [(R() - 0.5) * 6, -R() * 3, (R() - 0.5) * 6])
  }
  const t0 = performance.now()
  block.grab(); block.setTarget(0.17, -0.1)
  run(2, () => { if (R() < 0.05) water.stir((R() * 2 - 1) * 1.6, (R() * 2 - 1) * 1.6, 3) })
  block.release()
  run(6)
  const ms = (performance.now() - t0) / (8 * 240)
  check('everything is finite', F.bodies.every((b) => [...b.p, ...b.v, ...b.w, ...b.q].every(Number.isFinite)))
  check('everything inside the walls', F.bodies.every((b) => b.x.every((X, i) => Math.abs(X[0]) <= HALF - b.r[i] + 1e-3 && Math.abs(X[2]) <= HALF - b.r[i] + 1e-3)))
  let worst = 0
  for (let i = 0; i < F.bodies.length; i++) for (let j = i + 1; j < F.bodies.length; j++) {
    const a = F.bodies[i], b = F.bodies[j]
    a.x.forEach((A, s) => b.x.forEach((C, t) => { worst = Math.max(worst, a.r[s] + b.r[t] - Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2])) }))
  }
  check('bodies keep apart', worst < 0.02, worst.toFixed(4))
  const upright = F.bodies.filter((b) => F.up(b)[1] > 0.9).length
  check('ducks end upright', upright >= 22, upright + '/24')
  check('24 ducks cost under 0.4 ms a body step', ms < 0.4, ms.toFixed(3) + ' ms')
}

// picking and the hand
{
  const { F, run } = pool()
  const b = F.add({ ...DUCK, p: [0, LEVEL + 0.1, 0] })
  run(2)
  const hit = F.pick([0, LEVEL + 3, 0.001], [0, -1, 0])
  check('a ray from above picks the duck', hit && hit.body === b)
  F.grab(b); F.hold(b, [1, LEVEL + 1, 1]); run(0.5)
  check('held: stays in the hand', Math.abs(b.p[1] - (LEVEL + 1)) < 1e-6)
  F.throw(b, [0, 2, 0]); run(4)
  check('thrown: lands back in the water', b.submerged > 0 && Math.abs(b.p[1] - LEVEL) < 0.1, b.p[1].toFixed(3))
}

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exitCode = fails ? 1 : 0
