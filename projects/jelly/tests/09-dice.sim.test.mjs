// Jelly dice physics: landings, pokes, the grab, inversion recovery, rolls, sleep and waking. Run: node tests/09-dice.sim.test.mjs
import { dice } from './load.mjs'
const { makeWorld, placed, rotAxis, mul3, I3, DiceGeo, POKE } = dice
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const dt = 1 / 60
const ext = (w, p = 0) => { const pc = w.pieces[p]; let lo = 9, hi = -9, cx = 0, cy = 0, cz = 0; for (let i = pc.start; i < pc.start + pc.count; i++) { const y = w.x[3 * i + 1]; lo = Math.min(lo, y); hi = Math.max(hi, y); cx += w.x[3 * i]; cy += y; cz += w.x[3 * i + 2] } const n = pc.count; return { lo, hi, h: hi - lo, c: [cx / n, cy / n, cz / n] } }
const inverted = (w) => { let k = 0; const X = w.x, T = w.tets; for (let t = 0; t < T.length; t += 4) { const a = 3 * T[t], b = 3 * T[t + 1], c = 3 * T[t + 2], d = 3 * T[t + 3]; const e1 = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]], e2 = [X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2]], e3 = [X[d] - X[a], X[d + 1] - X[a + 1], X[d + 2] - X[a + 2]]; if (e1[0] * (e2[1] * e3[2] - e2[2] * e3[1]) + e1[1] * (e2[2] * e3[0] - e2[0] * e3[2]) + e1[2] * (e2[0] * e3[1] - e2[1] * e3[0]) < 0) k++ } return k }

// 1. A heavy landing squashes and settles; it does not bounce like rubber. Then it sleeps, and sleeping is still.
{
  const { geo, world } = makeWorld(1)
  world.setPieces([placed(geo, I3, [0, 2.5, 0])])
  let first = -1, minH = 9, lift = 0, sleep = -1
  for (let f = 0; f < 300; f++) { world.step(dt); const e = ext(world); if (first < 0 && e.lo < 0.002) first = f; if (first >= 0) { minH = Math.min(minH, e.h); if (f > first + 6) lift = Math.max(lift, e.lo) } if (sleep < 0 && world.asleep(0)) sleep = f }
  ok(minH < 0.9 && minH > 0.7, `landing squashes the die to ${(minH * 100).toFixed(0)}% of its height`)
  ok(lift < 0.03, `and soaks up the rebound (lifts ${lift.toFixed(3)} after landing)`)
  ok(sleep > 0 && (sleep - first) * dt < 2, `then sleeps ${((sleep - first) * dt).toFixed(2)} s after landing`)
  ok(world.events.some((e) => e.heavy), 'the landing is reported as a heavy impact')
  const snap = world.x.slice(); for (let f = 0; f < 120; f++) world.step(dt)
  ok(world.x.every((v, i) => v === snap[i]), 'asleep: not a single particle moves in 2 s')
}
// 2. A poke squishes and the whole die rings, without launching it.
{
  const { geo, world } = makeWorld(1)
  world.setPieces([placed(geo, I3, [0, 0.5, 0])]); for (let f = 0; f < 120; f++) world.step(dt)
  const c0 = ext(world).c, hs = []
  world.poke([0.1, 1.0, 0.05], [0, -1, 0], POKE)
  let sleep = -1
  for (let f = 0; f < 240; f++) { world.step(dt); if (f < 50) hs.push(ext(world).h); if (sleep < 0 && world.asleep(0)) sleep = f }
  let ext2 = 0; for (let k = 1; k < hs.length - 1; k++) if ((hs[k] - hs[k - 1]) * (hs[k + 1] - hs[k]) < 0) ext2++
  const amp = Math.max(...hs) - Math.min(...hs), c1 = ext(world).c
  ok(amp > 0.03 && ext2 >= 4, `poke: the die rings (${ext2} turning points, height range ${amp.toFixed(3)})`)
  ok(Math.hypot(c1[0] - c0[0], c1[2] - c0[2]) < 0.03 && sleep > 0, `and stays put (moved ${Math.hypot(c1[0] - c0[0], c1[2] - c0[2]).toFixed(3)}), asleep again after ${(sleep * dt).toFixed(2)} s`)
}
// 3. The grab: gentle pulls stretch the jelly while its base clings; firm pulls lift and move it; release is capped.
const pull = (target, frames = 90) => {
  const { geo, world } = makeWorld(1)
  world.setPieces([placed(geo, I3, [0, 0.5, 0])]); for (let f = 0; f < 60; f++) world.step(dt)
  world.grabStart([0.25, 1.0, 0], { radius: 0.4 })
  for (let f = 0; f < frames; f++) { const s = Math.min(1, f / 18); world.grabMove([0.25 + (target[0] - 0.25) * s, 1.0 + (target[1] - 1.0) * s, target[2] * s]); world.step(dt) }
  let slid = 0; for (let i = 0; i < world.n; i++) if (geo.X[3 * i + 1] < -0.49) slid = Math.max(slid, Math.hypot(world.x[3 * i] - geo.X[3 * i], world.x[3 * i + 2] - geo.X[3 * i + 2]))
  return { world, e: ext(world), slid }
}
{
  let r = pull([0.25, 1.35, 0])
  ok(r.e.h > 1.08 && r.e.lo < 0.002 && r.slid < 0.02, `gentle pull up: stretches to ${r.e.h.toFixed(2)} while the base clings (slid ${r.slid.toFixed(3)})`)
  r = pull([0.65, 1.0, 0])
  ok(r.e.c[0] > 0.08 && r.slid < 0.02, `gentle pull sideways: leans (centroid +${r.e.c[0].toFixed(2)}) with the base held`)
  r = pull([0.25, 2.4, 0])
  ok(r.e.lo > 0.5, `firm pull up: lifts it (lowest point ${r.e.lo.toFixed(2)})`)
  r = pull([1.85, 1.0, 0.4])
  ok(r.e.c[0] > 1.2, `firm pull sideways: moves it (centroid x ${r.e.c[0].toFixed(2)})`)
  // a flick: whip the hand fast, then let go
  const { geo, world } = makeWorld(1)
  world.setPieces([placed(geo, I3, [0, 0.5, 0])]); for (let f = 0; f < 30; f++) world.step(dt)
  world.grabStart([0.25, 1.0, 0], { radius: 0.4 })
  for (let f = 0; f < 30; f++) { world.grabMove([0.25 + Math.sin(f * 0.6) * 1.5, 1.6 + f * 0.05, Math.cos(f * 0.6) * 1.5]); world.step(dt) }
  world.grabEnd()
  const rv = world.rigidVelocity(0)
  ok(Math.hypot(rv[0], rv[1], rv[2]) <= 2.5 + 1e-6 && Math.hypot(rv[3], rv[4], rv[5]) <= 3.3, `a flick cannot launch it: release speed ${Math.hypot(rv[0], rv[1], rv[2]).toFixed(2)}, spin ${Math.hypot(rv[3], rv[4], rv[5]).toFixed(2)} rad/s`)
}
// 4. Inverted elements always recover: crush a die flat and turn its top inside out.
{
  const { geo, world } = makeWorld(1)
  world.setPieces([placed(geo, I3, [0, 0.5, 0])]); for (let f = 0; f < 10; f++) world.step(dt)
  for (let i = 0; i < world.n; i++) { const y = world.x[3 * i + 1]; world.x[3 * i + 1] = 0.25 - (y - 0.5) * 0.4 }   // flattened and mirrored: every tet inside out
  const inv0 = inverted(world)
  for (let f = 0; f < 240; f++) world.step(dt)
  const e = ext(world)
  ok(inv0 > 500 && inverted(world) === 0 && Math.abs(e.h - 1) < 0.03, `inside-out die (${inv0} tets) recovers: ${inverted(world)} inverted, height ${e.h.toFixed(3)}`)
}
// 5. Rolls of five: everything settles, flat on a face, nothing overlaps or leaves the plate.
const roll = (seed0, N = 5) => {
  let seed = seed0; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
  const { geo, world } = makeWorld(N)
  const specs = []
  for (let i = 0; i < N; i++) {
    const R = mul3(rotAxis([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], rnd() * 6.28), rotAxis([0, 1, 0], rnd() * 6.28))
    const ax = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], al = Math.hypot(...ax), sp = 7 + rnd() * 6
    specs.push(placed(geo, R, [-1.9 + (rnd() - 0.5) * 0.6 + i * 0.3, 1.2 + i * 0.45, 0.9 + (rnd() - 0.5) * 0.5], [2.3 + rnd() * 1.2, 0.5, -1.2 - rnd() * 0.7], ax.map((a) => (a / al) * sp)))   // as app.js throws them
  }
  world.setPieces(specs)
  let at = -1, worst = 0; const t0 = performance.now(); let steps = 0
  for (let f = 0; f < 600; f++) { const a = performance.now(); world.step(dt); steps++; if (f > 20) worst = Math.max(worst, performance.now() - a); if (world.allAsleep()) { at = f; break } }
  const ms = (performance.now() - t0) / steps
  const S = new Float64Array(4); let deepest = 0, outside = 0
  const frames = [...Array(N).keys()].map((p) => world.rigidFrame(p))
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
    if (a === b) continue
    const R = frames[b].R, t = frames[b].t, pc = world.pieces[a]
    for (let i = pc.start; i < pc.start + pc.count; i++) { const dx = world.x[3 * i] - t[0], dy = world.x[3 * i + 1] - t[1], dz = world.x[3 * i + 2] - t[2]; DiceGeo.sdf(R[0] * dx + R[3] * dy + R[6] * dz, R[1] * dx + R[4] * dy + R[7] * dz, R[2] * dx + R[5] * dy + R[8] * dz, S); deepest = Math.min(deepest, S[0]) }
  }
  const P = DiceGeo.PLATE
  for (let i = 0; i < world.n; i++) if (DiceGeo.sdRoundRect(world.x[3 * i], world.x[3 * i + 2], P.hx - P.wall, P.hz - P.wall, P.r - P.wall) > 0.01) outside++
  const aligns = frames.map((F) => DiceGeo.topFace([F.R[3], F.R[4], F.R[5]]).align)
  return { at, ms, worst, deepest, outside, aligns, world }
}
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const r = roll(seed)
  ok(r.at > 0 && r.at * dt < 6 && r.deepest > -0.03 && r.outside === 0,
    `roll ${seed}: settled in ${(r.at * dt).toFixed(2)} s, deepest overlap ${r.deepest.toFixed(3)}, ${r.outside} outside, top faces ${r.aligns.map((a) => a.toFixed(2)).join(' ')}, ${r.ms.toFixed(2)} ms/step (worst ${r.worst.toFixed(1)})`)
}
// 6. Sleepers wake when an awake die comes close; the pair settles again.
{
  const { geo, world } = makeWorld(2)
  world.setPieces([placed(geo, I3, [0, 0.5, 0]), placed(geo, I3, [-2.2, 0.5, 0])])
  let wokeA = false
  for (let f = 0; f < 90; f++) world.step(dt)
  const sleptFirst = world.allAsleep()
  world.wake(1)   // send B rolling into A
  const pc = world.pieces[1]
  for (let i = pc.start; i < pc.start + pc.count; i++) { const ry = world.x[3 * i + 1] - 0.5; world.v[3 * i] = 3.2 + 4 * ry; world.v[3 * i + 1] = 0.8 }
  for (let f = 0; f < 400; f++) { world.step(dt); if (!world.asleep(0)) wokeA = true; if (wokeA && world.allAsleep()) break }
  ok(sleptFirst && wokeA && world.allAsleep(), `a resting die (asleep: ${sleptFirst}) is woken by one rolling into it, and both sleep again`)
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
