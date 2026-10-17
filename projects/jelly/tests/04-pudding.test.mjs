// Headless physics checks for the custard pudding on its plate. Run: node tests/04-pudding.test.mjs
import { PuddingSim as Sim, puddingSdf, PUD } from '../src/specimens/04-pudding/sim.js'
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const t00 = performance.now()
const s = Sim.create({ tapSeed: +process.env.SEED || 1 })   // the taps land the same each run (SEED=n for others)
const buildMs = performance.now() - t00
console.log(`built in ${buildMs.toFixed(0)} ms: nodes ${s.n} tets ${s.nt} edges ${s.ne} | surface ${s.nv} verts ${s.surf.index.length / 3} tris`)
ok(buildMs < 1500, 'builds in well under two seconds')
const run = (sec, f) => { for (let i = 0; i < sec * 120; i++) { f?.(i / 120); s.step() } }

const E = new Map(), I = s.surf.index
for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], key = Math.min(a, b) * 1e6 + Math.max(a, b); const e = E.get(key) || [0, 0]; e[a < b ? 0 : 1]++; E.set(key, e) }
let open = 0; for (const [f, r] of E.values()) if (f !== 1 || r !== 1) open++
ok(open === 0, `surface is closed and consistently wound (${open} bad edges)`)
ok(puddingSdf(0, 0.5, 0) < 0 && puddingSdf(0, PUD.H + 0.1, 0) > 0 && puddingSdf(PUD.Rb - 0.05, 0.05, 0) < 0 && puddingSdf(PUD.Rt + 0.1, PUD.H - 0.05, 0) > 0, 'a frustum: wide at the base, narrower at the top')

let t0 = performance.now(); run(2); const ms = (performance.now() - t0) / 240
console.log(`step ${ms.toFixed(2)} ms (${(ms * 2).toFixed(1)} ms per 60 fps frame), mass ${s.stats().massG.toFixed(0)} g`)
const cy0 = s.centroid()[1]
ok(Math.abs(cy0 - 0.45) < 0.08, `stands on its base (centroid y ${cy0.toFixed(3)})`)
const airRelax = () => { const g = s.params.grav; s.params.grav = 0; for (let i = 1; i < s.x.length; i += 3) s.x[i] += 1.2; s.v.fill(0); run(s.params.damp < 5 ? 15 : 5); const es = s.edgeStrain(), inv = s.invertedCount(); s.params.grav = g; s.reset(false); run(1); return { es, inv } }
const settles = (label, sec = 5) => {
  run(sec)
  const st = s.stats(), es = s.edgeStrain(), c = s.centroid()
  ok(st.keUJ < 1 && Math.abs(st.relVol - 1) < 0.025 && s.invertedCount() === 0 && c[1] > 0.3 && c[1] < 0.55 && es.rms < 0.04,
    `${label}: KE ${st.keUJ.toFixed(3)} uJ, relVol ${st.relVol.toFixed(4)}, strain rms ${es.rms.toFixed(4)}, inv ${s.invertedCount()}, cy ${c[1].toFixed(3)}`)
  const ar = airRelax(); ok(ar.es.rms < 0.003 && ar.inv === 0, `${label}: back to its exact rest shape (in-air strain ${ar.es.rms.toExponential(1)})`)
}
const hit = (x, z) => s.pick([x, 3, z], [0, -1, 0])
s.reset(true); settles('drop onto the plate')
let p = hit(0.2, 0.1); ok(!!p && p[1] > 0.9, 'the top is pickable')
s.grabStart(p); run(1.5, (t) => s.grabMove([p[0] + 0.6 * Math.min(1, t), p[1] + 0.5 * Math.min(1, t), p[2]])); s.grabEnd()
// the sway after letting go: it rocks through the middle several times before it settles
const xs = []; for (let i = 0; i < 360; i++) { s.step(); xs.push(s.centroid()[0]) }
let turns = 0; for (let i = 2; i < xs.length; i++) if ((xs[i] - xs[i - 1]) * (xs[i - 1] - xs[i - 2]) < 0) turns++
ok(turns >= 3, `it shivers: the sway turns ${turns} times in 3 s`)
settles('pull and release')
s.reset(false); run(1); ok(s.flipHop(), 'flip hop starts on the plate'); run(0.12); s.flipSpin([1, 0, 0], Math.PI / 0.86); run(5)
ok(s.upAxis()[1] < -0.8 && s.invertedCount() === 0, `turned over (up y ${s.upAxis()[1].toFixed(2)})`)
s.reset(false); run(1); let top = 0
for (let i = 0; i < 300; i++) { s.nudge(1); s.step(); top = Math.max(top, s.centroid()[1]) }
ok(top < 2.5, `tap spam stays bounded (peak centroid ${top.toFixed(2)})`); settles('after tap spam')
for (const [f, d] of [[0, 0], [100, 100]]) { s.setFirmness(f); s.setDamping(d); s.reset(true); settles(`firmness ${f} damping ${d}`, f === 0 && d === 0 ? 10 : 6) }
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
