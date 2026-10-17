// Headless physics checks for the pineapple ring jelly on its plate. Run: node tests/01-pineapple.test.mjs
import { MouldSim as Sim, mouldSdf, MOULD, tidbitMesh } from '../src/specimens/01-pineapple/sim.js'
import { plateGround, PLATE } from '../src/core/jelly/plate.js'
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const t00 = performance.now()
const s = Sim.create({ tapSeed: +process.env.SEED || 1 })   // the taps land the same each run (SEED=n for others)
const buildMs = performance.now() - t00
console.log(`built in ${buildMs.toFixed(0)} ms: nodes ${s.n} tets ${s.nt} edges ${s.ne} | surface ${s.nv} verts ${s.surf.index.length / 3} tris | bubbles ${s.NB} pieces ${s.seedCount}`)
ok(buildMs < 1500, 'builds in well under two seconds')
const run = (sec, f) => { for (let i = 0; i < sec * 120; i++) { f?.(i / 120); s.step() } }

// the visual surface is closed: every edge in exactly two triangles, consistently wound
const E = new Map(), I = s.surf.index
for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], key = Math.min(a, b) * 1e6 + Math.max(a, b); const e = E.get(key) || [0, 0]; e[a < b ? 0 : 1]++; E.set(key, e) }
let open = 0; for (const [f, r] of E.values()) if (f !== 1 || r !== 1) open++
ok(open === 0, `surface is closed and consistently wound (${open} bad edges)`)
let werr = 0, wmin = 1
for (let p = 0; p < s.np; p++) { let sum = 0; for (let k = 0; k < 4; k++) { sum += s.embW[4 * p + k]; wmin = Math.min(wmin, s.embW[4 * p + k]) } werr = Math.max(werr, Math.abs(sum - 1)) }
ok(werr < 1e-4 && wmin > -0.25, `embedding weights sum to 1 (err ${werr.toExponential(1)}, min ${wmin.toFixed(3)})`)
ok(s.seedCount === 12 && s.pieces.every((p) => mouldSdf(...p.c) < -0.15), `${s.seedCount} pineapple pieces, each well inside the jelly`)
const tm = tidbitMesh(); ok(tm.index.length > 300 && tm.vtx.length % 6 === 0, `tidbit mesh (${tm.index.length / 3} tris)`)
ok(mouldSdf(0, 0.5, 0) > 0 && mouldSdf(0.65, 0.5, 0) < 0 && mouldSdf(1.4, 0.5, 0) > 0, 'a ring: the hole and the outside are empty, the wall is jelly')
ok(plateGround(0, 0) === 0 && plateGround(PLATE.rim - 0.01, 0) > 0.1 && plateGround(PLATE.rim + 0.2, 0) === PLATE.table, 'the plate: a flat well, a raised lip, the table beyond')

let t0 = performance.now(); run(2); const ms = (performance.now() - t0) / 240
console.log(`step ${ms.toFixed(2)} ms (${(ms * 2).toFixed(1)} ms per 60 fps frame)`)
const H = MOULD.H, cy0 = s.centroid()[1]
const airRelax = () => { const g = s.params.grav; s.params.grav = 0; for (let i = 1; i < s.x.length; i += 3) s.x[i] += 1.2; s.v.fill(0); run(s.params.damp < 5 ? 15 : 5); const es = s.edgeStrain(), inv = s.invertedCount(); s.params.grav = g; s.reset(false); run(1); return { es, inv } }
const settles = (label, sec = 5) => {
  run(sec)
  const st = s.stats(), es = s.edgeStrain(), c = s.centroid()
  ok(st.keUJ < 2 && Math.abs(st.relVol - 1) < 0.025 && s.invertedCount() === 0 && c[1] > 0.3 * H && c[1] < 0.55 * H && es.rms < 0.04,
    `${label}: KE ${st.keUJ.toFixed(3)} uJ, relVol ${st.relVol.toFixed(4)}, strain rms ${es.rms.toFixed(4)}, inv ${s.invertedCount()}, cy ${c[1].toFixed(3)}`)
  const ar = airRelax(); ok(ar.es.rms < 0.003 && ar.inv === 0, `${label}: back to its exact rest shape (in-air strain ${ar.es.rms.toExponential(1)})`)
}
const hit = (x, z) => s.pick([x, 3, z], [0, -1, 0])
console.log(`mass ${s.stats().massG.toFixed(0)} g`)
ok(Math.abs(s.centroid()[1] - cy0) / cy0 < 0.03, `stands up under its own weight (sag ${((1 - s.centroid()[1] / cy0) * 100).toFixed(1)}%)`)
ok(hit(0, 0) === null, 'a click straight down through the hole hits nothing')
s.reset(true); settles('drop onto the plate')
// the crown: pull up and out, release
let p = hit(0.62, 0.05); ok(!!p && p[1] > 0.8, 'the crown is pickable')
s.grabStart(p); let maxInv = 0
run(1.5, (t) => { s.grabMove([p[0] + 0.5 * Math.min(1, t), p[1] + 0.9 * Math.min(1, t), p[2]]); maxInv = Math.max(maxInv, s.invertedCount()) })
const pc = s.pointAt(s.pointBase), body = s.centroid()
ok(Math.hypot(pc[0] - body[0], pc[2] - body[2]) < 1.6, `pieces ride with the jelly while it is pulled (max inverted ${maxInv})`)
s.grabEnd(); settles('crown pull and release')
// a flute: twist it
p = hit(1.02, 0.08); ok(!!p, 'a flute is pickable'); s.grabStart(p)
run(1.5, (t) => { s.grabMove([p[0] + 0.4 * Math.min(1, t), p[1] + 0.6 * Math.min(1, t), p[2] - 0.3 * Math.min(1, t)]); s.grabTwist(Math.min(1, t)) })
s.grabEnd(); settles('flute lift and twist')
// hauled off the plate and dropped onto the table
s.reset(false); run(0.5); p = hit(0.62, 0.05); s.grabStart(p); run(3, () => s.grabMove([2.0, 1.6, 0])); s.grabEnd(); run(5)
const cOff = s.centroid(); ok(s.invertedCount() === 0 && Number.isFinite(cOff[0]) && s.clearance() > -0.01, `pulled toward the rim and let go: comes to rest (centroid ${cOff.map((v) => v.toFixed(2)).join(' ')})`)
// turn it over
s.reset(false); run(1); ok(s.flipHop(), 'flip hop starts on the plate'); const up0 = s.upAxis()
run(0.12); s.flipSpin([1, 0, 0], Math.PI / 0.86); run(5)
const up1 = s.upAxis(); ok(up1[1] < -0.85, `turned over: up y ${up0[1].toFixed(2)} -> ${up1[1].toFixed(2)}`)
ok(s.invertedCount() === 0 && s.stats().keUJ < 2, 'after the flip: at rest, no inverted tets')
// nudge spam
s.reset(false); run(1); let top = 0
for (let i = 0; i < 300; i++) { s.nudge(1); s.step(); top = Math.max(top, s.centroid()[1]) }
ok(top < 2.5, `nudge spam stays bounded (peak centroid ${top.toFixed(2)})`); settles('after nudge spam')
for (const [f, d] of [[0, 0], [0, 100], [100, 0], [100, 100]]) { s.setFirmness(f); s.setDamping(d); s.reset(true); settles(`firmness ${f} damping ${d}`, f === 0 && d === 0 ? 10 : 6) }
// wobble after release: the centroid height
s.setFirmness(50); s.setDamping(25); s.reset(false); run(1)
p = hit(0.62, 0.05); s.grabStart(p); run(1, () => s.grabMove([p[0], 1.5, p[2]])); s.grabEnd()
const ys = []; for (let i = 0; i < 300; i++) { s.step(); if (i % 5 === 0) ys.push(s.centroid()[1].toFixed(3)) }
console.log('centroid y after release (24 Hz):', ys.join(' '))
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
