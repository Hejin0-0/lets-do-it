// Headless checks of the cuts: straight, wavy (crinkle ridges kept), crinkle cubes, cookie cutter,
// rounding limited to the new cut, and the solver's step time. Run: node tests/07-citrus-cutter.test.mjs
import { citrus02 } from './load.mjs'
const { CitrusGeo, CitrusSim } = citrus02
let fails = 0
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }
const G = CitrusGeo, slice = G.sliceRegion(), A = G.WAVE_A, k = (2 * Math.PI) / G.WAVE_L
// outline of a region along a line x = const -> z of the zero crossing nearest to xref
function edgeAt(region, z, xFrom, xTo) {   // walk x at fixed z, return the x where the field crosses 0
  const n = 400
  let prev = G.sample(region.field, xFrom, z)
  for (let i = 1; i <= n; i++) {
    const x = xFrom + (xTo - xFrom) * i / n, f = G.sample(region.field, x, z)
    if ((prev < 0) !== (f < 0)) return x
    prev = f
  }
  return NaN
}
{ // wavy split along x = 0.1 (normal +x, blade direction +z)
  const r = G.splitByWave(slice, 1, 0, -0.1, 0, 1, 0)
  check('wavy cut splits the slice in two', r.ok && r.pieces.length === 2, r.reason || '')
  const right = r.pieces.find((p) => G.sample(p.field, 1.0, -0.2) < 0)
  let lo = Infinity, hi = -Infinity, okCount = 0
  for (let z = -0.45; z < 0.6; z += 0.01) {
    const x = edgeAt(right, z, -0.4, 0.6)
    if (!Number.isFinite(x)) continue
    okCount++
    const ideal = 0.1 + A * Math.sin(k * z)    // the cut face (+ kerf/2)
    lo = Math.min(lo, x - 0.1); hi = Math.max(hi, x - 0.1)
  }
  check('the cut face is crinkled (peak-to-peak ~2A)', okCount > 50 && hi - lo > 1.5 * A && hi - lo < 3.5 * A, `p2p ${(hi - lo).toFixed(3)} vs 2A ${(2 * A).toFixed(3)}`)
  // crinkle cubes: cut the right piece again across (normal +z)
  const r2 = G.splitByWave(right, 0, 1, -0.05, 1, 0, 0)
  check('cutting both ways makes crinkle-cut blocks', r2.ok && r2.pieces.length === 2, r2.reason || '')
}
{ // a straight cut after a wavy cut keeps the old ridges (rounding only near the new cut)
  const r = G.splitByWave(slice, 1, 0, -0.1, 0, 1, 0)
  const right = r.pieces.find((p) => G.sample(p.field, 1.0, -0.2) < 0)
  const before = [], after = []
  for (let z = -0.3; z < 0.3; z += 0.02) before.push(edgeAt(right, z, -0.4, 0.6))
  const s = G.splitByLine(right, 1, 0, 0.9)
  const keep = s.pieces.find((p) => G.sample(p.field, 0.4, 0) < 0)
  for (let z = -0.3; z < 0.3; z += 0.02) after.push(edgeAt(keep, z, -0.4, 0.6))
  const drift = Math.max(...before.map((x, i) => Math.abs(x - after[i])).filter(Number.isFinite))
  check('a later straight cut leaves the old crinkle ridges alone', s.ok && drift < 0.012, `max drift ${drift.toFixed(4)}`)
}
{ // straight and cookie cutter still work
  const s = G.splitByLine(slice, 1, 0, 0.2)
  check('straight cut', s.ok && s.pieces.length === 2)
  const c = G.splitByCutter(slice, G.cutterShapes.star, (x, z, o) => { o[0] = x; o[1] = z + 0.1 }, 0.035)
  check('star cutter stamps an inside and an outside', c.ok && c.inside.length >= 1 && c.outside.length >= 1)
}
{ // the solver at 10 substeps, four pieces
  const r = G.splitByWave(slice, 1, 0, -0.1, 0, 1, 0)
  const parts = r.pieces.flatMap((p) => { const q = G.splitByWave(p, 0, 1, -0.05, 1, 0, 0); return q.ok ? q.pieces : [p] })
  const meshes = parts.map((p) => G.buildPiece(p))
  const world = CitrusSim.createWorld()
  world.setPieces(meshes.map((m) => ({ X: m.sim.X, tets: m.sim.tets })))
  world.setFirmness(50); world.setDamping(30)
  for (let i = 0; i < 30; i++) world.step(1 / 60)
  const t0 = performance.now()
  for (let i = 0; i < 120; i++) world.step(1 / 60)
  const ms = (performance.now() - t0) / 120
  check(`${parts.length} crinkle pieces settle, finite`, world.x.every(Number.isFinite) && world.stats().keUJ < 2, `ke ${world.stats().keUJ.toFixed(3)} µJ`)
  check('a 60 Hz step (10 substeps) fits a frame', ms < 10, ms.toFixed(2) + ' ms')
}
console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exit(fails ? 1 : 0)
