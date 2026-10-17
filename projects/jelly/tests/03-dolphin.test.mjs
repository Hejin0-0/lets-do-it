// Headless physics checks for the two-layer gummy dolphin. Run: node tests/03-dolphin.test.mjs
import { DolphinSim as Sim, dolphinSdf, DOLPHIN } from '../src/specimens/03-dolphin/sim.js'
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const t00 = performance.now()
const s = Sim.create({ tapSeed: +process.env.SEED || 1 })   // the taps land the same each run (SEED=n for others)
const buildMs = performance.now() - t00
console.log(`built in ${buildMs.toFixed(0)} ms: nodes ${s.n} tets ${s.nt} edges ${s.ne} | surface ${s.nv} verts ${s.surf.index.length / 3} tris | bubbles ${s.NB}`)
ok(buildMs < 1500, 'builds in well under two seconds')
const run = (sec, f) => { for (let i = 0; i < sec * 120; i++) { f?.(i / 120); s.step() } }

const E = new Map(), I = s.surf.index
for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], key = Math.min(a, b) * 1e6 + Math.max(a, b); const e = E.get(key) || [0, 0]; e[a < b ? 0 : 1]++; E.set(key, e) }
let open = 0; for (const [f, r] of E.values()) if (f !== 1 || r !== 1) open++
ok(open === 0, `surface is closed and consistently wound (${open} bad edges)`)
// the parts are there and the thin ones are still thick enough for the lattice to carry
const thick = (x, y, z, d) => { let n = 0; for (let t = -0.3; t < 0.3; t += 0.002) if (dolphinSdf(x + d[0] * t, y + d[1] * t, z + d[2] * t) < 0) n++; return n * 0.002 }
ok(dolphinSdf(1.25, 0.1, 0) < 0 && dolphinSdf(-0.05, 0.68, 0) < 0 && dolphinSdf(-1.3, 0.14, 0.25) < 0 && dolphinSdf(0.3, 0.07, 0.45) < 0, 'beak, dorsal fin, flukes and flippers are all there')
ok(thick(-0.05, 0.65, 0, [0, 0, 1]) > 0.09 && thick(-1.3, 0.13, 0.25, [0, 1, 0]) > 0.08 && thick(0.3, 0.08, 0.42, [0, 1, 0]) > 0.08, 'the fins and flukes are thick enough to hold their colour')
ok(dolphinSdf(...DOLPHIN.eye) > -0.03 && dolphinSdf(...DOLPHIN.eye) < 0.03, 'the eyes sit on the surface')

let t0 = performance.now(); run(2); const ms = (performance.now() - t0) / 240
console.log(`step ${ms.toFixed(2)} ms (${(ms * 2).toFixed(1)} ms per 60 fps frame), mass ${s.stats().massG.toFixed(0)} g`)
const airRelax = () => { const g = s.params.grav; s.params.grav = 0; for (let i = 1; i < s.x.length; i += 3) s.x[i] += 1.2; s.v.fill(0); run(s.params.damp < 5 ? 15 : 5); const es = s.edgeStrain(), inv = s.invertedCount(); s.params.grav = g; s.reset(false); run(1); return { es, inv } }
const settles = (label, sec = 5, rolled = false) => {
  run(sec)
  const st = s.stats(), es = s.edgeStrain(), c = s.centroid()
  ok(st.keUJ < 1 && Math.abs(st.relVol - 1) < 0.025 && s.invertedCount() === 0 && c[1] > 0.1 && c[1] < 0.5 && es.rms < 0.05,
    `${label}: KE ${st.keUJ.toFixed(3)} uJ, relVol ${st.relVol.toFixed(4)}, strain rms ${es.rms.toFixed(4)}, inv ${s.invertedCount()}, cy ${c[1].toFixed(3)}`)
  if (!rolled) { const ar = airRelax(); ok(ar.es.rms < 0.003 && ar.inv === 0, `${label}: back to its exact rest shape (in-air strain ${ar.es.rms.toExponential(1)})`) }
}
const hit = (x, z) => s.pick([x, 3, z], [0, -1, 0])
s.reset(true); settles('drop')
// the tail: lift it high and swing it round, then let go; it springs back
let p = hit(-1.3, 0.22); ok(!!p, 'a fluke is pickable')
const tail0 = s.landmark(0).slice()
s.grabStart(p); run(1.5, (t) => s.grabMove([p[0] + 0.2, p[1] + 1.0 * Math.min(1, t), p[2] + 0.6 * Math.min(1, t)]))
const tail1 = s.landmark(0).slice(); ok(tail1[1] - tail0[1] > 0.35, `the tail bends up when pulled (${tail0[1].toFixed(2)} -> ${tail1[1].toFixed(2)})`)
s.grabEnd(); settles('tail bend and release')
p = hit(-0.05, 0); ok(!!p && p[1] > 0.55, 'the dorsal fin is pickable')
s.grabStart(p); run(1.2, (t) => { s.grabMove([p[0], p[1] + 0.3, p[2] + 0.5 * Math.min(1, t)]); s.grabTwist(Math.min(1, t)) }); s.grabEnd(); settles('dorsal fin pull and twist')
// roll it over about its long axis: the cream belly comes up
s.reset(false); run(1); ok(s.flipHop(), 'roll hop starts on the floor'); run(0.12); s.flipSpin(s.longAxis(), Math.PI / 0.86); run(5)
// its dorsal fin keeps it off its back: it comes to rest leaning on the fin and a flipper, cream side up
ok(s.upAxis()[1] < 0, `rolled over past its side, cream side up (up y ${s.upAxis()[1].toFixed(2)})`)
settles('rolled over', 4, true)
s.reset(false); run(1); let top = 0
for (let i = 0; i < 300; i++) { s.nudge(1); s.step(); top = Math.max(top, s.centroid()[1]) }
ok(top < 2.5, `nudge spam stays bounded (peak centroid ${top.toFixed(2)})`); settles('after nudge spam', 9)   // it may land on its side and rock a while
for (const [f, d] of [[0, 0], [100, 100]]) { s.setFirmness(f); s.setDamping(d); s.reset(true); settles(`firmness ${f} damping ${d}`, f === 0 && d === 0 ? 10 : 6) }
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
