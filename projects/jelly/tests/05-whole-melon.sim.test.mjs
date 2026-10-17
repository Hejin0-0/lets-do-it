// Whole melon physics: the drop, cuts swapped in mid-life, many pieces, the hand. Run: node tests/05-whole-melon.sim.test.mjs
import { wholeMelon } from './load.mjs'
import { budget } from './budget.mjs'
const { JellySim, WholeMelon: W, makeWorld, spec } = wholeMelon
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const dt = 1 / 60
const whole = W.finish(W.buildPiece([], JellySim.embed))
const restOf = (pc) => ({ X: pc.sim.X, tets: pc.sim.tets, cells: pc.sim.cells, cellRind: pc.sim.cellRind, tetRind: pc.sim.tetRind })
const height = (w) => { let lo = 9, hi = -9; for (let i = 1; i < w.x.length; i += 3) { lo = Math.min(lo, w.x[i]); hi = Math.max(hi, w.x[i]) } return { lo, hi } }

// 1. The whole melon drops onto the table, wobbles and sleeps, then is perfectly still.
{
  const { world, pieces } = makeWorld(); pieces.push(whole)
  world.setPieces([spec(whole, [0, -W.BOTTOM + 0.3, 0])])
  const hs = []; let first = -1, sleep = -1
  for (let f = 0; f < 300; f++) { world.step(dt); const e = height(world); if (first < 0 && e.lo < 0.002) first = f; if (first >= 0 && f - first < 60) hs.push(e.hi - e.lo); if (sleep < 0 && world.asleep(0)) sleep = f }
  let turns = 0; for (let k = 1; k < hs.length - 1; k++) if ((hs[k] - hs[k - 1]) * (hs[k + 1] - hs[k]) < 0 && Math.abs(hs[k] - hs[k - 1]) > 1e-4) turns++
  ok(turns >= 3, `the drop wobbles (${turns} turning points in the height)`)
  ok(sleep > 0 && (sleep - first) * dt < 3, `and sleeps ${((sleep - first) * dt).toFixed(2)} s after landing`)
  const snap = world.x.slice(); for (let f = 0; f < 60; f++) world.step(dt)
  ok(world.x.every((v, i) => v === snap[i]), 'asleep: perfectly still')
}
// 2. A cut swapped in at rest: the halves inherit the melon's state (no launch), stay on the table, keep their volume.
const N = [0.99, 0, -0.14], o = 0.1
const halves = [[[...N, o]], [[...N.map((v) => -v), -o]]].map((c) => W.finish(W.buildPiece(c, JellySim.embed, W.boundsOf(whole.render.pos, c[0]))))
{
  const { world, pieces } = makeWorld(); pieces.push(whole)
  world.setPieces([spec(whole)]); for (let f = 0; f < 150; f++) world.step(dt)
  world.wake(0); world.replacePieces(halves.map(restOf)); pieces.length = 0; pieces.push(...halves)
  let vmax = 0, below = 0
  for (let f = 0; f < 30; f++) { world.step(dt); for (let k = 0; k < 2; k++) { const r = world.rigidVelocity(k); vmax = Math.max(vmax, Math.hypot(r[0], r[2])) } for (let i = 1; i < world.x.length; i += 3) if (world.x[i] < -1e-4) below++ }
  let at = -1; for (let f = 0; f < 400; f++) { world.step(dt); if (world.allAsleep()) { at = f; break } }
  ok(vmax < 1.0 && below === 0, `swap-in: the halves do not fly apart (fastest drift ${vmax.toFixed(2)} units/s), nothing below the table`)
  ok(at >= 0 && world.stats().relVol > 0.99, `and settle: asleep after ${((at + 30) * dt).toFixed(1)} s, volume ${(world.stats().relVol * 100).toFixed(1)} %`)
}
// 3. Successive cuts into many pieces: valid, quick, settling.
{
  const { world, pieces } = makeWorld(); pieces.push(whole); world.setPieces([spec(whole)])
  for (let f = 0; f < 30; f++) world.step(dt)
  const planes = [[1, 0, 0, 0.1], [0, 0, 1, 0.05], [1, 0, 0, -0.85], [1, 0, 0, 0.95], [0.6, 0, 0.8, 0.5], [1, 0, 0, -0.4]]
  let meshMs = 0
  for (const pl of planes) {
    const list = [], next = []
    pieces.forEach((pc, k) => {
      let pos = 0, neg = 0; const X = pc.sim.X
      for (let i = 0; i < X.length; i += 3) { const d = pl[0] * X[i] + pl[1] * X[i + 1] + pl[2] * X[i + 2] - pl[3]; if (d > 0.05) pos++; else if (d < -0.05) neg++ }
      if (pos < 30 || neg < 30) { list.push({ keep: k }); next.push(pc); return }
      for (const s of [1, -1]) {
        const plane = [s * pl[0], s * pl[1], s * pl[2], s * pl[3]], t = performance.now()
        const np = W.finish(W.buildPiece([...pc.cuts, plane], JellySim.embed, W.boundsOf(pc.render.pos, plane))); meshMs = Math.max(meshMs, performance.now() - t)
        list.push(restOf(np)); next.push(np)
      }
    })
    world.wakeAll(); world.replacePieces(list); pieces.length = 0; pieces.push(...next)
    for (let f = 0; f < 20; f++) world.step(dt)
  }
  world.wakeAll(); world.nudge(1)
  let t0 = performance.now(); for (let f = 0; f < 60; f++) world.step(dt); const ms = (performance.now() - t0) / 60
  let at = -1; for (let f = 0; f < 600; f++) { world.step(dt); if (world.allAsleep()) { at = f; break } }
  let nan = 0; for (const v of world.x) if (!Number.isFinite(v)) nan++
  // no piece deep inside another
  const S = new Float64Array(4); let deepest = 0
  const fr = pieces.map((_, k) => world.rigidFrame(k))
  for (let a = 0; a < pieces.length; a++) for (let b = 0; b < pieces.length; b++) {
    if (a === b) continue
    const R = fr[b].R, t = fr[b].t, C = fr[b].restCentroid, pc = world.pieces[a]
    for (let i = pc.start; i < pc.start + pc.count; i++) { const dx = world.x[3 * i] - t[0], dy = world.x[3 * i + 1] - t[1], dz = world.x[3 * i + 2] - t[2]; W.piece(pieces[b].cuts, R[0] * dx + R[3] * dy + R[6] * dz + C[0], R[1] * dx + R[4] * dy + R[7] * dz + C[1], R[2] * dx + R[5] * dy + R[8] * dz + C[2], S); deepest = Math.min(deepest, S[0]) }
  }
  ok(pieces.length >= 12 && meshMs < budget(300), `${pieces.length} pieces, each meshed in at most ${meshMs.toFixed(0)} ms (spread over frames in the page)`)
  ok(ms < budget(8) && nan === 0, `all awake after a nudge: ${ms.toFixed(2)} ms per step`)
  ok(at >= 0 && deepest > -0.06, `all asleep ${(at * dt).toFixed(1)} s after it; deepest overlap ${deepest.toFixed(3)}`)
}
// 4. The hand drags a half a long way across the table.
{
  const { world, pieces } = makeWorld(); pieces.push(halves[0]); world.setPieces([spec(halves[0])])
  for (let f = 0; f < 60; f++) world.step(dt)
  const c0 = world.rigidVelocity(0).slice(6, 9)
  world.grabStart([c0[0], c0[1] + 0.6, c0[2]], { radius: 0.32 })
  for (let f = 0; f < 120; f++) { world.grabMove([c0[0] + f * 0.025, c0[1] + 0.8, c0[2]]); world.step(dt) }
  world.grabEnd(); for (let f = 0; f < 60; f++) world.step(dt)
  const c1 = world.rigidVelocity(0).slice(6, 9)
  ok(c1[0] - c0[0] > 2, `the hand drags a half ${(c1[0] - c0[0]).toFixed(2)} units across the table`)
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
