// Fracture plans for every fruit: closed chunks, volume kept, tets all accounted for. Run: node tests/08-press.fracture.test.mjs
import { PressGeo, Fracture, FRUITS, PressSim, Press } from './load.mjs'
let fails = 0
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++ }
const volume = (pos, idx) => { let v = 0; for (let t = 0; t < idx.length; t += 3) { const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2]; v += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]) } return v / 6 }
const openEdges = (pos, idx, tol) => {   // weld by position, then count edges not paired with an opposite one
  const key = (i) => `${Math.round(pos[3 * i] / tol)},${Math.round(pos[3 * i + 1] / tol)},${Math.round(pos[3 * i + 2] / tol)}`
  const id = new Map(), w = new Int32Array(pos.length / 3)
  for (let i = 0; i < w.length; i++) { const k = key(i); if (!id.has(k)) id.set(k, id.size); w[i] = id.get(k) }
  const E = new Map()
  for (let t = 0; t < idx.length; t += 3) for (let q = 0; q < 3; q++) { const a = w[idx[t + q]], b = w[idx[t + (q + 1) % 3]]; if (a === b) continue; const k = a + ',' + b; E.set(k, (E.get(k) || 0) + 1) }
  let bad = 0
  for (const [k, c] of E) { const [a, b] = k.split(','); if ((E.get(b + ',' + a) || 0) !== c) bad++ }
  return bad
}
for (const F of FRUITS) {
  const G = PressGeo.make({ T: F.T, bevel: F.bevel, sdf: F.sdf }), mesh = G.buildPiece(G.region())
  mesh.render.nrm = Fracture.vertexNormals(mesh.render.pos, mesh.render.index)
  const V0 = volume(mesh.render.pos, mesh.render.index), nt = mesh.sim.tets.length / 4
  const inside = (x, z, m) => F.sdf(x, z) < -m
  let worstOpen = 0, worstVol = 0, counts = [], chips = 0, ms = 0, smallest = Infinity
  for (let seed = 1; seed <= 8; seed++) {
    const t0 = performance.now(), ch = Fracture.plan(mesh, F.T, inside, seed * 7919); ms = Math.max(ms, performance.now() - t0)
    let V = 0, T = 0
    for (const c of ch) { V += volume(c.pos, c.index); T += c.tets.length / 4; worstOpen = Math.max(worstOpen, openEdges(c.pos, c.index, 2e-4)); smallest = Math.min(smallest, c.tets.length / 4); if (c.chip) chips++ }
    worstVol = Math.max(worstVol, Math.abs(V / V0 - 1))
    if (T !== nt) ok(false, `${F.key} seed ${seed}: tets ${T} of ${nt}`)
    counts.push(ch.length)
  }
  console.log(`     ${F.key}: ${mesh.render.pos.length / 3} render verts, ${nt} tets; chunks per burst ${counts.join(' ')}, chips ${chips}, smallest chunk ${smallest} tets, plan ${ms.toFixed(0)} ms`)
  ok(worstOpen === 0, `${F.key}: every chunk closed (worst open edges ${worstOpen})`)
  ok(worstVol < 0.02, `${F.key}: chunk volumes add up (worst ${(worstVol * 100).toFixed(2)} %)`)
  ok(Math.min(...counts) >= 5 && Math.max(...counts) <= 23 && chips > 0, `${F.key}: 5..23 chunks, some chips`)
}
console.log(fails ? `${fails} FAILED` : 'all passed')
process.exitCode = fails ? 1 : 0
