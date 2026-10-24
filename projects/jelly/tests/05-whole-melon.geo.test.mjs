// The whole melon and its pieces: build time, closed skins, valid lattices, exact embedding, volumes that add up,
// seeds near the cut faces. Run: node tests/05-whole-melon.geo.test.mjs
import { wholeMelon } from './load.mjs'
const { JellySim, WholeMelon: W } = wholeMelon
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const time = (fn) => { const t = performance.now(), r = fn(); return [r, performance.now() - t] }
const closed = (I) => { const E = new Map(); for (let t = 0; t < I.length; t += 3) for (let q = 0; q < 3; q++) { const k = I[t + q] + ',' + I[t + (q + 1) % 3]; E.set(k, (E.get(k) || 0) + 1) } let o = 0; for (const [k, c] of E) { const [a, b] = k.split(','); if ((E.get(b + ',' + a) || 0) !== c) o++ } return o }
const tetCheck = (X, T) => { let neg = 0, min = Infinity; for (let t = 0; t < T.length; t += 4) { const P = (i) => [X[3 * i], X[3 * i + 1], X[3 * i + 2]]; const [a, b, c, d] = [P(T[t]), P(T[t + 1]), P(T[t + 2]), P(T[t + 3])]; const e1 = b.map((v, k) => v - a[k]), e2 = c.map((v, k) => v - a[k]), e3 = d.map((v, k) => v - a[k]); const v = e1[0] * (e2[1] * e3[2] - e2[2] * e3[1]) + e1[1] * (e2[2] * e3[0] - e2[0] * e3[2]) + e1[2] * (e2[0] * e3[1] - e2[1] * e3[0]); min = Math.min(min, Math.abs(v)); if (v < 0) neg++ } return { neg, min } }
const embErr = (pc) => { const X = pc.sim.X, P = pc.render.pos; let worst = 0, wmin = 0; for (let p = 0; p < pc.nSkin; p++) { let x = 0, y = 0, z = 0; for (let k = 0; k < 4; k++) { const i = pc.emb.idx[4 * p + k], w = pc.emb.w[4 * p + k]; x += w * X[3 * i]; y += w * X[3 * i + 1]; z += w * X[3 * i + 2]; wmin = Math.min(wmin, w) } worst = Math.max(worst, Math.hypot(x - P[3 * p], y - P[3 * p + 1], z - P[3 * p + 2])) } return { worst, wmin } }
const describe = (pc) => `${pc.render.pos.length / 3} skin verts, ${pc.sim.X.length / 3} nodes, ${pc.sim.cells.length / 8} cells (${pc.sim.cellRind.reduce((a, b) => a + b, 0)} rind), ${pc.sim.tets.length / 4} tets, ${pc.seeds.length / 10} seeds, ${pc.bubbles.length / 4} bubbles, volume ${pc.volume.toFixed(3)}`

console.log(`     ${W.SEEDS.length / 10} seeds, ${W.BUBBLES.length / 4} bubbles, belly at y = ${W.BOTTOM.toFixed(3)}`)
ok(W.SEEDS.length / 10 >= 680, 'about 700 seeds placed')
const [whole, tw] = time(() => W.finish(W.buildPiece([], JellySim.embed)))
console.log(`     whole: ${describe(whole)}, ${tw.toFixed(0)} ms`)
const Vell = 4 / 3 * Math.PI * W.A * W.B * W.C
ok(whole.volume > 0.9 * Vell && whole.volume < Vell, `whole melon: volume ${whole.volume.toFixed(3)} (ellipsoid ${Vell.toFixed(3)}, less the flattened belly)`)
ok(closed(whole.render.index) === 0, 'whole melon: skin closed')
let tc = tetCheck(whole.sim.X, whole.sim.tets)
ok(tc.min > 1e-5, `whole melon: no flat tets (smallest |6V| ${tc.min.toExponential(1)})`)
let ee = embErr(whole)
ok(ee.worst < 1e-4 && ee.wmin > -0.95, `whole melon: embedding exact at rest (worst ${ee.worst.toExponential(1)}, min weight ${ee.wmin.toFixed(2)})`)
// a cut across the middle, a little off-axis: two halves
const n = [0.97, 0, 0.24], nl = Math.hypot(...n), N = n.map((v) => v / nl), o = 0.15
const cuts = [[[...N, o]], [[...N.map((v) => -v), -o]]]
const halves = cuts.map((c) => { const [pc, t] = time(() => W.finish(W.buildPiece(c, JellySim.embed, W.boundsOf(whole.render.pos, c[0])))); console.log(`     half: ${describe(pc)}, ${t.toFixed(0)} ms`); return pc })
ok(Math.abs(halves[0].volume + halves[1].volume - whole.volume) / whole.volume < 0.03, `halves add up: ${(halves[0].volume + halves[1].volume).toFixed(3)} vs ${whole.volume.toFixed(3)} (the rounded edges take a little)`)
for (const h of halves) {
  ok(closed(h.render.index) === 0, 'half: skin closed')
  tc = tetCheck(h.sim.X, h.sim.tets); ee = embErr(h)
  ok(ee.worst < 1e-4 && ee.wmin > -0.95, `half: embedding exact (worst ${ee.worst.toExponential(1)}, min weight ${ee.wmin.toFixed(2)}), smallest |6V| ${tc.min.toExponential(1)}`)
  ok(h.seeds.length / 10 > 20, `half: ${h.seeds.length / 10} seeds just under the cut face`)
}
// every seed near the plane belongs to exactly one half, and lies wholly under its face
const key = (s, i) => `${s[i + 3].toFixed(4)},${s[i + 4].toFixed(4)},${s[i + 5].toFixed(4)}`
const A0 = new Set(), dup = []
for (let i = 0; i < halves[0].seeds.length; i += 10) A0.add(key(halves[0].seeds, i))
for (let i = 0; i < halves[1].seeds.length; i += 10) if (A0.has(key(halves[1].seeds, i))) dup.push(i)
ok(dup.length === 0, `no seed in both halves (${dup.length})`)
let above = 0
for (const [h, c] of [[halves[0], cuts[0][0]], [halves[1], cuts[1][0]]]) for (let i = 0; i < h.seeds.length; i += 10) if (c[0] * h.seeds[i] + c[1] * h.seeds[i + 1] + c[2] * h.seeds[i + 2] - c[3] > -0.009) above++
ok(above === 0, 'seeds the cut went through sit just under the new face')
// a thin slice
const thin = [[1, 0, 0, 1.0], [-1, 0, 0, -0.78]]
const [sl, ts] = time(() => W.finish(W.buildPiece(thin, JellySim.embed, W.boundsOf(whole.render.pos, null))))
console.log(`     slice 0.22 thick: ${describe(sl)}, ${ts.toFixed(0)} ms`)
tc = tetCheck(sl.sim.X, sl.sim.tets); ee = embErr(sl)
ok(closed(sl.render.index) === 0 && sl.sim.cells.length > 0 && ee.worst < 1e-4, `thin slice: closed skin, ${sl.sim.cells.length / 8} cells, embedding exact`)
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
