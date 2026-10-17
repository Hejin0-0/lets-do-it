// The press on every fruit: squash, burst, scatter, settle. Run: node tests/08-press.press.test.mjs
import { PressGeo, Fracture, FRUITS, PressSim, Press } from './load.mjs'
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const DT = 1 / 60
for (const F of FRUITS) {
  const G = PressGeo.make({ T: F.T, bevel: F.bevel, sdf: F.sdf }), mesh = G.buildPiece(G.region())
  mesh.render.nrm = Fracture.vertexNormals(mesh.render.pos, mesh.render.index)
  const world = PressSim.createWorld(), press = Press.make(world, 8)
  world.setPieces([{ X: mesh.sim.X, tets: mesh.sim.tets }])
  press.reset(F.T + 0.6)
  const top = () => { let m = 0; for (let i = 1; i < world.x.length; i += 3) m = Math.max(m, world.x[i]); return m }
  const width = () => { let a = Infinity, b = -Infinity; for (let i = 0; i < world.x.length; i += 3) { a = Math.min(a, world.x[i]); b = Math.max(b, world.x[i]) } return b - a }
  for (let i = 0; i < 60; i++) { press.step(DT, false, top()); world.step(DT) }
  const w0 = width(), loads = [], t0 = performance.now(); let steps = 0, minVol = 1, inv = 0
  const breakAt = 0.6   // squash fraction
  while (press.st.y > F.T * (1 - breakAt) && steps < 2000) {
    press.step(DT, true, top()); world.step(DT); steps++
    const s = world.stats(); minVol = Math.min(minVol, s.relVol)
    if (steps % 20 === 0) loads.push(press.st.load)
  }
  const ms = (performance.now() - t0) / steps, w1 = width()
  const sq = 1 - press.st.y / F.T, L = press.st.load
  ok(Number.isFinite(L) && minVol > 0.65 && w1 > w0 * 1.15 && loads.slice(-3).every((v, i, a) => i === 0 || v > a[i - 1] * 0.9), `${F.key}: squashed ${(sq * 100).toFixed(0)}% in ${(steps * DT).toFixed(1)} s, width ${w0.toFixed(2)} -> ${w1.toFixed(2)}, min volume ${(minVol * 100).toFixed(1)}%, load at the end ${L.toFixed(1)}, step ${ms.toFixed(2)} ms`)
  console.log(`     load while pressing: ${loads.map((v) => v.toFixed(1)).join(' ')}`)
  // burst
  const chunks = Fracture.plan(mesh, F.T, (x, z, m) => F.sdf(x, z) < -m, 12345)
  const before = new Float32Array(world.x)
  world.replacePieces(chunks.map((c) => ({ X: c.X, tets: c.tets })))
  // positions inherited: every new particle sits where the jelly was
  let worst = 0
  for (let i = 0; i < world.x.length; i += 3) { let best = Infinity; for (let j = 0; j < before.length; j += 3) best = Math.min(best, (world.x[i] - before[j]) ** 2 + (world.x[i + 1] - before[j + 1]) ** 2 + (world.x[i + 2] - before[j + 2]) ** 2); worst = Math.max(worst, Math.sqrt(best)) }
  ok(world.pieces.length === chunks.length && worst < 1e-4, `${F.key}: burst into ${chunks.length} pieces, positions inherited (worst ${worst.toExponential(1)})`)
  // kick outward and up, chips harder, then raise the press and let everything land
  world.pieces.forEach((pc, k) => {
    let cx = 0, cz = 0; for (let i = pc.start; i < pc.start + pc.count; i++) { cx += world.x[3 * i]; cz += world.x[3 * i + 2] } cx /= pc.count; cz /= pc.count
    const l = Math.hypot(cx, cz) || 1, sp = chunks[k].chip ? 2.6 : 1.3, up = chunks[k].chip ? 3.2 : 1.6
    for (let i = pc.start; i < pc.start + pc.count; i++) { world.v[3 * i] += cx / l * sp; world.v[3 * i + 1] += up; world.v[3 * i + 2] += cz / l * sp }
  })
  press.raise(F.T + 0.6)
  for (let i = 0; i < 360; i++) { press.step(DT, false, top()); world.step(DT) }
  const s = world.stats()
  let lowest = Infinity, out = 0
  for (let i = 0; i < world.x.length; i += 3) { lowest = Math.min(lowest, world.x[i + 1]); if (Math.abs(world.x[i]) > Press.STAGE.x + 1e-3 || world.x[i + 2] > Press.STAGE.zFront + 1e-3 || world.x[i + 2] < Press.STAGE.zBack - 1e-3) out++ }
  ok(s.keUJ < 1 && lowest > -1e-3 && out === 0 && s.relVol > 0.9,   /* a chip may land on the raised platen */ `${F.key}: pieces land and settle: KE ${s.keUJ.toFixed(3)} uJ, volume ${(s.relVol * 100).toFixed(1)}%, lowest ${lowest.toFixed(3)}, outside the stage ${out}`)
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exitCode = fails ? 1 : 0
