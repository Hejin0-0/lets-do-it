// Headless physics checks for the sitting gummy bear. Run: node tests/02-gummy-bear.test.mjs
import { BearSim as Sim, bearSdf, BEAR } from '../src/specimens/02-gummy-bear/sim.js'
import { budget } from './budget.mjs'
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const t00 = performance.now()
const s = Sim.create({ tapSeed: +process.env.SEED || 1 })   // the taps land the same each run (SEED=n for others)
const buildMs = performance.now() - t00
console.log(`built in ${buildMs.toFixed(0)} ms: nodes ${s.n} tets ${s.nt} edges ${s.ne} | surface ${s.nv} verts ${s.surf.index.length / 3} tris | bubbles ${s.NB}`)
ok(buildMs < budget(1500), 'builds in well under two seconds')
const run = (sec, f) => { for (let i = 0; i < sec * 120; i++) { f?.(i / 120); s.step() } }

const E = new Map(), I = s.surf.index
for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], key = Math.min(a, b) * 1e6 + Math.max(a, b); const e = E.get(key) || [0, 0]; e[a < b ? 0 : 1]++; E.set(key, e) }
let open = 0; for (const [f, r] of E.values()) if (f !== 1 || r !== 1) open++
ok(open === 0, `surface is closed and consistently wound (${open} bad edges)`)
ok(bearSdf(0, 1.08, 0) < 0 && bearSdf(0.3, 1.37, -0.02) < 0 && bearSdf(0.29, 0.17, 0.62) < 0 && bearSdf(0.38, 0.45, 0.26) < 0, 'head, ears, feet and paws are all there')
ok(bearSdf(...BEAR.eye) > 0, 'the eyes are pressed in')

let t0 = performance.now(); run(2); const ms = (performance.now() - t0) / 240
console.log(`step ${ms.toFixed(2)} ms (${(ms * 2).toFixed(1)} ms per 60 fps frame), mass ${s.stats().massG.toFixed(1)} g`)
ok(s.upAxis()[1] > 0.9, `it sits up by itself (up ${s.upAxis().map((v) => v.toFixed(2)).join(' ')})`)
const airRelax = () => { const g = s.params.grav; s.params.grav = 0; for (let i = 1; i < s.x.length; i += 3) s.x[i] += 1.2; s.v.fill(0); run(s.params.damp < 5 ? 15 : 5); const es = s.edgeStrain(), inv = s.invertedCount(); s.params.grav = g; s.reset(false); run(1); return { es, inv } }
const settles = (label, sec = 5, upright = true) => {
  run(sec)
  const st = s.stats(), es = s.edgeStrain(), c = s.centroid()
  ok(st.keUJ < 0.5 && Math.abs(st.relVol - 1) < 0.03 && s.invertedCount() === 0 && c[1] > 0.2 && c[1] < 0.9 && es.rms < 0.05 && (!upright || s.upAxis()[1] > 0.85),
    `${label}: KE ${st.keUJ.toFixed(3)} uJ, relVol ${st.relVol.toFixed(4)}, strain rms ${es.rms.toFixed(4)}, inv ${s.invertedCount()}, cy ${c[1].toFixed(3)}, up y ${s.upAxis()[1].toFixed(2)}`)
  const ar = airRelax(); ok(ar.es.rms < 0.003 && ar.inv === 0, `${label}: back to its exact rest shape (in-air strain ${ar.es.rms.toExponential(1)})`)
}
const pickFront = (x, y) => s.pick([x, y, 3], [0, 0, -1])
s.reset(true); settles('drop')
// an ear: pull up and out, let go
let p = s.pick([0.3, 3, -0.02], [0, -1, 0]); ok(!!p && p[1] > 1.35, 'an ear is pickable from above')
s.grabStart(p); run(1.2, (t) => s.grabMove([p[0] + 0.12 * Math.min(1, t), p[1] + 0.15 * Math.min(1, t), p[2]])); s.grabEnd(); settles('a gentle tug on an ear: it springs back, still sitting')
s.reset(false); run(0.5); p = s.pick([0.3, 3, -0.02], [0, -1, 0]); s.grabStart(p); run(1.2, (t) => s.grabMove([p[0] + 0.5 * Math.min(1, t), p[1] + 0.5 * Math.min(1, t), p[2]])); s.grabEnd()
settles('a hard yank by the ear: it topples and comes to rest', 5, false); s.reset(false); run(1)
// a foot: pull it forward and twist
p = pickFront(0.29, 0.18); ok(!!p && p[2] > 0.6, 'a foot is pickable from the front')
s.grabStart(p); run(1.2, (t) => { s.grabMove([p[0], p[1] + 0.3 * Math.min(1, t), p[2] + 0.5 * Math.min(1, t)]); s.grabTwist(Math.min(1, t)) }); s.grabEnd(); settles('foot pull and twist')
// the tummy: push it in, let go
p = pickFront(0, 0.5); ok(!!p, 'the tummy is pickable'); s.grabStart(p); run(1, () => s.grabMove([p[0], p[1], p[2] - 0.2])); s.grabEnd(); settles('tummy push')
s.reset(false); run(1); ok(s.flipHop(), 'flip hop starts on the floor'); run(0.12); s.flipSpin([1, 0, 0], Math.PI / 0.86); run(5)
ok(s.upAxis()[1] < 0.5 && s.invertedCount() === 0, `turned over (up y ${s.upAxis()[1].toFixed(2)})`)
s.reset(false); run(1); let top = 0
for (let i = 0; i < 300; i++) { s.nudge(1); s.step(); top = Math.max(top, s.centroid()[1]) }
ok(top < 2.5, `nudge spam stays bounded (peak centroid ${top.toFixed(2)})`); settles('after nudge spam', 5, false)
for (const [f, d] of [[0, 0], [100, 100]]) { s.setFirmness(f); s.setDamping(d); s.reset(true); settles(`firmness ${f} damping ${d}`, f === 0 && d === 0 ? 10 : 6) }
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
