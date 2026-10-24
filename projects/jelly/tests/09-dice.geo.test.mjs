// Die geometry: lattice, skin closed and outward, embedding exact at rest. Run: node tests/09-dice.geo.test.mjs
import { dice } from './load.mjs'
const { DiceGeo, JellySim } = dice
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const t0 = performance.now(), g = DiceGeo.build(JellySim.embed), ms = performance.now() - t0
const nv = g.skin.pos.length / 3, nt = g.tets.length / 4
console.log(`     nodes ${g.X.length / 3}, cells ${g.cells.length / 8}, tets ${nt}, skin ${nv} verts / ${g.skin.index.length / 3} tris, pips ${g.pip.pos.length / 3} verts, build ${ms.toFixed(0)} ms`)
const vol = (P, I) => { let v = 0; for (let t = 0; t < I.length; t += 3) { const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2]; v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]) } return v / 6 }
// rounded cube volume: 1 - (12 edges x (4 - pi) r^2 x (1 - 2r)) - corners (8 r^3 - 4/3 pi r^3)
const r = DiceGeo.RC, Vexact = 1 - 12 * (4 - Math.PI) * r * r / 4 * (1 - 2 * r) - (8 * r ** 3 - 4 / 3 * Math.PI * r ** 3)
const V = vol(g.skin.pos, g.skin.index)
ok(V > 0 && Math.abs(V / Vexact - 1) < 0.01, `skin wound outward, volume ${V.toFixed(4)} vs rounded cube ${Vexact.toFixed(4)} less dimples`)
const E = new Map(); const I = g.skin.index
for (let t = 0; t < I.length; t += 3) for (let q = 0; q < 3; q++) { const k = I[t + q] + ',' + I[t + (q + 1) % 3]; E.set(k, (E.get(k) || 0) + 1) }
let open = 0; for (const [k, c] of E) { const [a, b] = k.split(','); if ((E.get(b + ',' + a) || 0) !== c) open++ }
ok(open === 0, `skin closed (${open} unpaired edges)`)
let bad = 0; for (let i = 0; i < nv; i++) { const n = [0, 1, 2].map((k) => g.skin.nrm[3 * i + k]), p = [0, 1, 2].map((k) => g.skin.pos[3 * i + k]); if (n[0] * p[0] + n[1] * p[1] + n[2] * p[2] <= 0) bad++ }
ok(bad === 0, `rest normals point outward (${bad} not)`)
ok(vol(g.pip.pos, g.pip.index) > 0, 'pips wound outward')
// embedding reproduces the rest points
const all = new Float32Array([...g.skin.pos, ...g.pip.pos]); let worst = 0, wmin = 0
for (let p = 0; p < all.length / 3; p++) {
  const t = g.emb.tet[p]; let x = 0, y = 0, z = 0
  for (let k = 0; k < 4; k++) { const i = g.tets[4 * t + k], w = g.emb.w[4 * p + k]; x += w * g.X[3 * i]; y += w * g.X[3 * i + 1]; z += w * g.X[3 * i + 2]; wmin = Math.min(wmin, w) }
  worst = Math.max(worst, Math.hypot(x - all[3 * p], y - all[3 * p + 1], z - all[3 * p + 2]))
}
ok(worst < 1e-4 && wmin > -0.5, `embedding exact at rest (worst ${worst.toExponential(1)}, min weight ${wmin.toFixed(3)})`)
// SDF: skin points sit on the surface (outside the dimples)
const S = new Float64Array(4); let sd = 0
for (let i = 0; i < nv; i++) { DiceGeo.sdf(g.skin.pos[3 * i], g.skin.pos[3 * i + 1], g.skin.pos[3 * i + 2], S); sd = Math.max(sd, -S[0] > 0.0215 ? 1 : Math.abs(S[0]) < 1e-4 ? 0 : -S[0] > 0 ? 0 : S[0]) }
ok(sd < 1e-4, 'skin on the SDF surface (dimples within their depth)')
// faces: putting each value on top reads it back
let faces = 0
for (let v = 1; v <= 6; v++) { const R = DiceGeo.faceUp(v), up = [R[3], R[4], R[5]], f = DiceGeo.topFace(up); if (f.value === v && f.align > 0.999) faces++ }
ok(faces === 6, `faceUp/topFace agree for all six faces (${faces})`)
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exitCode = fails ? 1 : 0
