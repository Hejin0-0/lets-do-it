// Tests for geo.js (MelonGeo). Run: node tests/06-melon-knife.geo.test.mjs
import assert from 'node:assert/strict';

import { MelonGeo as G } from './load.mjs';
const { T, GRID } = G;
const now = () => performance.now();

/* ------------------------------- mesh checks ------------------------------- */

// Every edge shared by exactly 2 triangles with opposite directions, no degenerate triangles,
// positive enclosed volume. Returns { volume, minArea }.
function checkClosed(pos, index, label) {
  const nv = pos.length / 3, nt = index.length / 3;
  assert.ok(nt > 0, `${label}: no triangles`);
  const dir = new Set();
  let vol = 0, minArea = Infinity;
  for (let t = 0; t < nt; t++) {
    const a = index[3 * t], b = index[3 * t + 1], c = index[3 * t + 2];
    assert.ok(a < nv && b < nv && c < nv, `${label}: index out of range`);
    assert.ok(a !== b && b !== c && a !== c, `${label}: repeated vertex in triangle ${t}`);
    const ax = pos[3 * a], ay = pos[3 * a + 1], az = pos[3 * a + 2];
    const ux = pos[3 * b] - ax, uy = pos[3 * b + 1] - ay, uz = pos[3 * b + 2] - az;
    const wx = pos[3 * c] - ax, wy = pos[3 * c + 1] - ay, wz = pos[3 * c + 2] - az;
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    minArea = Math.min(minArea, Math.hypot(cx, cy, cz) / 2);
    vol += (ax * cx + ay * cy + az * cz) / 6;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = u * nv + v;
      assert.ok(!dir.has(k), `${label}: directed edge ${u}->${v} used twice (non-manifold or flipped)`);
      dir.add(k);
    }
  }
  for (const k of dir) {
    const u = Math.floor(k / nv), v = k % nv;
    assert.ok(dir.has(v * nv + u), `${label}: open edge ${u}-${v}`);
  }
  assert.ok(minArea > 1e-10, `${label}: degenerate triangle (area ${minArea})`);
  assert.ok(vol > 0, `${label}: signed volume ${vol} <= 0`);
  return { volume: vol, minArea };
}

// Tool meshes use separate vertices per patch (hard normals): weld by position, then check.
function weld(vtx, index) {
  const map = new Map(), pos = [], remap = new Uint32Array(vtx.length / 8);
  for (let i = 0; i < remap.length; i++) {
    const key = [0, 1, 2].map((k) => Math.round(vtx[8 * i + k] * 1e5)).join(',');
    let id = map.get(key);
    if (id === undefined) { id = pos.length / 3; map.set(key, id); pos.push(vtx[8 * i], vtx[8 * i + 1], vtx[8 * i + 2]); }
    remap[i] = id;
  }
  return { pos: Float32Array.from(pos), index: index.map((i) => remap[i]) };
}

function tetVol(X, a, b, c, d) {
  const ax = X[3 * a], ay = X[3 * a + 1], az = X[3 * a + 2];
  const bx = X[3 * b] - ax, by = X[3 * b + 1] - ay, bz = X[3 * b + 2] - az;
  const cx = X[3 * c] - ax, cy = X[3 * c + 1] - ay, cz = X[3 * c + 2] - az;
  const dx = X[3 * d] - ax, dy = X[3 * d + 1] - ay, dz = X[3 * d + 2] - az;
  return (bx * (cy * dz - cz * dy) - by * (cx * dz - cz * dx) + bz * (cx * dy - cy * dx)) / 6;
}

// Every render vertex inside the sim rest volume or within tol of it. The sim mesh is a prism
// extrusion over [0, T], so its footprint is the set of boundary tet faces lying in y = 0.
function checkRenderInSim(piece, label, tol = 0.02) {
  const { X, tets } = piece.sim, nX = X.length / 3;
  const faces = new Map();
  const key = (a, b, c) => { const s = [a, b, c].sort((p, q) => p - q); return (s[0] * nX + s[1]) * nX + s[2]; };
  for (let t = 0; t < tets.length; t += 4) {
    const [a, b, c, d] = tets.subarray(t, t + 4);
    for (const f of [[a, b, c], [a, b, d], [a, c, d], [b, c, d]]) {
      const k = key(...f);
      const e = faces.get(k);
      if (e) e.n++; else faces.set(k, { n: 1, f });
    }
  }
  const tri = [];
  for (const { n, f } of faces.values()) if (n === 1 && f.every((v) => Math.abs(X[3 * v + 1]) < 1e-6)) tri.push(f);
  assert.ok(tri.length > 0, `${label}: empty sim footprint`);
  // bucket footprint triangles
  const B = 0.1, buckets = new Map(), bk = (i, j) => i * 100003 + j;
  for (const f of tri) {
    const xs = f.map((v) => X[3 * v]), zs = f.map((v) => X[3 * v + 2]);
    for (let i = Math.floor(Math.min(...xs) / B); i <= Math.floor(Math.max(...xs) / B); i++)
      for (let j = Math.floor(Math.min(...zs) / B); j <= Math.floor(Math.max(...zs) / B); j++) {
        const k = bk(i, j);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(f);
      }
  }
  // footprint boundary edges
  const ec = new Map();
  for (const f of tri) for (const [u, v] of [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]]) {
    const k = Math.min(u, v) * nX + Math.max(u, v);
    ec.set(k, (ec.get(k) || 0) + 1);
  }
  const bEdges = [...ec].filter(([, n]) => n === 1).map(([k]) => [Math.floor(k / nX), k % nX]);
  const inTri = (x, z, f) => {
    const [a, b, c] = f.map((v) => [X[3 * v], X[3 * v + 2]]);
    const o = (p, q) => (q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]);
    const s1 = o(a, b), s2 = o(b, c), s3 = o(c, a);
    return (s1 >= -1e-12 && s2 >= -1e-12 && s3 >= -1e-12) || (s1 <= 1e-12 && s2 <= 1e-12 && s3 <= 1e-12);
  };
  const { pos } = piece.render;
  let worst = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    assert.ok(y >= -tol && y <= T + tol, `${label}: render y ${y} outside slab`);
    const cand = buckets.get(bk(Math.floor(x / B), Math.floor(z / B))) || [];
    if (cand.some((f) => inTri(x, z, f))) continue;
    let d2 = Infinity;
    for (const [u, v] of bEdges) {
      const ax = X[3 * u], az = X[3 * u + 2], ex = X[3 * v] - ax, ez = X[3 * v + 2] - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
      d2 = Math.min(d2, (ax + t * ex - x) ** 2 + (az + t * ez - z) ** 2);
    }
    worst = Math.max(worst, Math.sqrt(d2));
  }
  assert.ok(worst <= tol, `${label}: render vertex ${worst.toFixed(4)} outside the sim volume`);
  return worst;
}

const stats = { pieces: 0, minArea: Infinity, worstOut: 0, maxParticles: 0, maxTets: 0 };

function checkPiece(piece, label) {
  const r = checkClosed(piece.render.pos, piece.render.index, `${label} render`);
  const { X, tets } = piece.sim;
  assert.ok(tets.length > 0 && tets.length % 4 === 0, `${label}: no tets`);
  let minV = Infinity;
  for (let t = 0; t < tets.length; t += 4) minV = Math.min(minV, tetVol(X, tets[t], tets[t + 1], tets[t + 2], tets[t + 3]));
  assert.ok(minV > 1e-7, `${label}: tet volume ${minV} not positive`);
  const out = checkRenderInSim(piece, label);
  assert.ok(piece.area > 0, `${label}: area ${piece.area}`);
  assert.equal(piece.seeds.length % 10, 0);
  assert.equal(piece.bubbles.length % 4, 0);
  stats.pieces++;
  stats.minArea = Math.min(stats.minArea, r.minArea);
  stats.worstOut = Math.max(stats.worstOut, out);
  stats.maxParticles = Math.max(stats.maxParticles, X.length / 3);
  stats.maxTets = Math.max(stats.maxTets, tets.length / 4);
  return piece;
}

const build = (region, label) => checkPiece(G.buildPiece(region), label);

/* ------------------------------ helpers ------------------------------ */

function rot(cx, cz, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return (x, z, out) => { const dx = x - cx, dz = z - cz; out[0] = c * dx + s * dz; out[1] = -s * dx + c * dz; };
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomCell(rng, region) {
  const cells = [];
  for (let c = 0; c < region.mask.length; c++) if (region.mask[c]) cells.push(c);
  const c = cells[Math.floor(rng() * cells.length)], i = c % GRID.NX, k = (c - i) / GRID.NX;
  return [GRID.X0 + (i + 0.5) * GRID.h, GRID.Z0 + (k + 0.5) * GRID.h];
}

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); }
  catch (e) { failures++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

/* -------------------------------- kernel -------------------------------- */

test('edt matches brute force', () => {
  const rng = mulberry32(7), m = new Uint8Array(GRID.N);
  for (let n = 0; n < 40; n++) m[Math.floor(rng() * GRID.N)] = 1;
  const d = G.edt(m);
  for (let s = 0; s < 300; s++) {
    const c = Math.floor(rng() * GRID.N), i = c % GRID.NX, k = (c - i) / GRID.NX;
    let best = Infinity;
    for (let q = 0; q < GRID.N; q++) if (m[q]) { const qi = q % GRID.NX, qk = (q - qi) / GRID.NX; best = Math.min(best, Math.hypot(qi - i, qk - k) * GRID.h); }
    assert.ok(Math.abs(d[c] - best) < 1e-5, `cell ${c}: ${d[c]} vs ${best}`);
  }
});

test('delaunay: CCW, empty circumcircles, recovers constraints', () => {
  const rng = mulberry32(3), n = 400, p = new Float64Array(2 * n);
  for (let i = 0; i < 2 * n; i++) p[i] = rng() * 2 - 1;
  const t = G.delaunay(p);
  assert.equal(t.length / 3, 2 * n - 2 - hullCount(p));
  for (let q = 0; q < t.length; q += 3) {
    const [a, b, c] = [t[q], t[q + 1], t[q + 2]];
    const ar = (p[2 * b] - p[2 * a]) * (p[2 * c + 1] - p[2 * a + 1]) - (p[2 * b + 1] - p[2 * a + 1]) * (p[2 * c] - p[2 * a]);
    assert.ok(ar > 0, 'triangle not CCW');
  }
  for (let q = 0; q < t.length; q += 3 * 13) {           // spot-check the empty-circle property
    const [a, b, c] = [t[q], t[q + 1], t[q + 2]];
    for (let d = 0; d < n; d++) {
      if (d === a || d === b || d === c) continue;
      const m = [a, b, c].map((v) => [p[2 * v] - p[2 * d], p[2 * v + 1] - p[2 * d + 1]]);
      const det = m.reduce((s, [x, z], i) => {
        const [x1, z1] = m[(i + 1) % 3], [x2, z2] = m[(i + 2) % 3];
        return s + (x * x + z * z) * (x1 * z2 - x2 * z1);
      }, 0);
      assert.ok(det <= 1e-12, 'point inside a circumcircle');
    }
  }
  // a zig-zag polygon whose edges are not all Delaunay
  const zz = [];
  for (let i = 0; i <= 20; i++) zz.push(i * 0.1, i & 1 ? 0.05 : 0);
  for (let i = 20; i >= 0; i--) zz.push(i * 0.1, 0.12 + (i & 1 ? 0 : 0.05));
  const zp = Float64Array.from(zz), m = zp.length / 2, cons = [];
  for (let i = 0; i < m; i++) cons.push(i, (i + 1) % m);
  const zt = G.delaunay(zp, cons), edges = new Set();
  for (let q = 0; q < zt.length; q += 3) for (let e = 0; e < 3; e++) { const u = zt[q + e], v = zt[q + (e + 1) % 3]; edges.add(Math.min(u, v) * m + Math.max(u, v)); }
  for (let i = 0; i < m; i++) { const u = i, v = (i + 1) % m; assert.ok(edges.has(Math.min(u, v) * m + Math.max(u, v)), `constraint ${u}-${v} missing`); }
});

function hullCount(p) {                                   // monotone chain hull size
  const n = p.length / 2, idx = [...Array(n).keys()].sort((a, b) => p[2 * a] - p[2 * b] || p[2 * a + 1] - p[2 * b + 1]);
  const cr = (o, a, b) => (p[2 * a] - p[2 * o]) * (p[2 * b + 1] - p[2 * o + 1]) - (p[2 * a + 1] - p[2 * o + 1]) * (p[2 * b] - p[2 * o]);
  const half = (ids) => { const h = []; for (const i of ids) { while (h.length >= 2 && cr(h[h.length - 2], h[h.length - 1], i) <= 0) h.pop(); h.push(i); } h.pop(); return h; };
  return half(idx).length + half(idx.slice().reverse()).length;
}

test('contours: outer CCW, hole CW', () => {
  const m = new Uint8Array(GRID.N);
  for (let k = 10; k < 50; k++) for (let i = 20; i < 80; i++) m[i + k * GRID.NX] = 1;
  for (let k = 25; k < 35; k++) for (let i = 40; i < 60; i++) m[i + k * GRID.NX] = 0;
  const loops = G.contours(G.signedField(m));
  assert.equal(loops.length, 2);
  const area = (p) => { let a = 0; for (let i = 0, j = p.length / 2 - 1; i < p.length / 2; j = i++) a += p[2 * j] * p[2 * i + 1] - p[2 * i] * p[2 * j + 1]; return a / 2; };
  const areas = loops.map(area).sort((a, b) => b - a);
  assert.ok(areas[0] > 0 && areas[1] < 0);
  assert.ok(Math.abs(areas[0] - 60 * 40 * GRID.h ** 2) < 0.01 && Math.abs(areas[1] + 20 * 10 * GRID.h ** 2) < 0.01);
  assert.ok(G.inside(GRID.X0 + 30.5 * GRID.h, GRID.Z0 + 20.5 * GRID.h, loops));
  assert.ok(!G.inside(GRID.X0 + 50.5 * GRID.h, GRID.Z0 + 30.5 * GRID.h, loops));
});

test('components and roundRegion', () => {
  const m = new Uint8Array(GRID.N);
  for (let k = 10; k < 30; k++) for (let i = 10; i < 30; i++) m[i + k * GRID.NX] = 1;      // 0.25 u^2
  for (let k = 40; k < 44; k++) for (let i = 60; i < 64; i++) m[i + k * GRID.NX] = 1;      // 0.01 u^2
  m[29 + 30 * GRID.NX] = 1;                                                              // spur
  const cs = G.components(m, 0.03);
  assert.equal(cs.length, 1);
  const r = G.roundRegion(cs[0], G.ROUND);
  assert.equal(r[29 + 30 * GRID.NX], 0, 'opening removes the spur');
  assert.equal(r[10 + 10 * GRID.NX], 0, 'corner rounded');
  assert.equal(r[20 + 20 * GRID.NX], 1);
});

/* --------------------------------- pieces -------------------------------- */

let slicePiece;
test('full slice: watertight, sim budget', () => {
  slicePiece = build(G.sliceRegion(), 'slice');
  const np = slicePiece.sim.X.length / 3, nt = slicePiece.sim.tets.length / 4;
  assert.ok(np <= 1100 && nt <= 3000, `budget: ${np} particles, ${nt} tets`);
  assert.ok(Math.abs(slicePiece.area - 1.737) < 0.02, `area ${slicePiece.area}`);
  assert.ok(slicePiece.seeds.length / 10 >= 12 && slicePiece.bubbles.length / 4 >= 10, 'seeds and bubbles');
  console.log(`     slice: ${slicePiece.render.pos.length / 3} render verts, ${slicePiece.render.index.length / 3} tris, ` +
    `${np} particles, ${nt} tets, ${slicePiece.seeds.length / 10} seeds, ${slicePiece.bubbles.length / 4} bubbles`);
});

test('two knife splits', () => {
  const a = G.splitByLine(G.sliceRegion(), 1, 0, 0.2);
  assert.ok(a.ok);
  assert.equal(a.pieces.length, 2);
  const big = a.pieces[0];
  const b = G.splitByLine(big, Math.cos(1), Math.sin(1), 0.1);
  assert.ok(b.ok, b.reason);
  for (const [i, p] of [...a.pieces.slice(1), ...b.pieces].entries()) build(p, `knife ${i}`);
  assert.equal(G.splitByLine(G.sliceRegion(), 1, 0, 5).reason, 'thin');
  assert.equal(G.splitByLine(G.sliceRegion(), 1, 0, 0.84).reason, 'thin');   // a sliver at the side
});

test('a cut keeps seeds whole: each seed lands in at most one piece, none straddles the cut', () => {
  const all = slicePiece.seeds.length / 10;
  for (const d of [-0.3, 0, 0.25]) {
    const res = G.splitByLine(G.sliceRegion(), 1, 0, d);
    assert.ok(res.ok, res.reason);
    const pcs = res.pieces.map((r) => G.buildPiece(r));
    const kept = pcs.reduce((n, p) => n + p.seeds.length / 10, 0);
    assert.ok(kept <= all && kept >= all - 4, `cut at x = ${d}: ${kept} of ${all} seeds kept`);
    for (const p of pcs) for (let i = 0; i < p.seeds.length; i += 10) {
      const half = G.SEED_LEN * p.seeds[i + 9] / 2;
      for (const t of [-1, 1]) assert.ok(Math.abs(p.seeds[i] + t * p.seeds[i + 3] * half - d) > 0.02, 'a seed crosses the cut');
    }
  }
});

test('20 random sequences of 4 cuts', () => {
  const rng = mulberry32(20261010);
  let ops = 0, built = 0;
  for (let seq = 0; seq < 20; seq++) {
    let pieces = [G.sliceRegion()];
    for (let step = 0; step < 4; step++) {
      const pi = Math.floor(rng() * pieces.length), region = pieces[pi];
      const [x, z] = randomCell(rng, region);
      const a = rng() * Math.PI, nx = Math.cos(a), nz = Math.sin(a), res = G.splitByLine(region, nx, nz, nx * x + nz * z);
      if (res.ok) { pieces.splice(pi, 1, ...res.pieces); ops++; }
    }
    for (const [i, p] of pieces.entries()) { build(p, `seq ${seq} piece ${i}`); built++; }
  }
  console.log(`     ${ops} successful ops, ${built} pieces checked`);
});

/* ------------------------------- tool meshes ------------------------------ */

function checkTool(mesh, label, mats) {
  assert.equal(mesh.vtx.length % 8, 0);
  const seen = new Set();
  for (let i = 0; i < mesh.vtx.length; i += 8) {
    const l = Math.hypot(mesh.vtx[i + 3], mesh.vtx[i + 4], mesh.vtx[i + 5]);
    assert.ok(Math.abs(l - 1) < 1e-4, `${label}: normal not unit`);
    seen.add(mesh.vtx[i + 6]);
  }
  assert.deepEqual([...seen].sort(), mats, `${label}: materials`);
  const w = weld(mesh.vtx, mesh.index);
  return checkClosed(w.pos, w.index, label);
}

test('knife mesh watertight', () => {
  const k = G.knifeMesh(), r = checkTool(k, 'knife', [0, 1, 2, 3, 4]);
  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < k.vtx.length; i += 8) { x0 = Math.min(x0, k.vtx[i]); x1 = Math.max(x1, k.vtx[i]); y1 = Math.max(y1, k.vtx[i + 1]); }
  assert.ok(Math.abs(x0 + 1.18) < 1e-6 && Math.abs(x1 - 1.72) < 1e-6 && y1 < 0.66 && y1 > 0.6, `knife extent ${x0} .. ${x1}, top ${y1}`);
  console.log(`     knife: ${k.vtx.length / 8} verts, ${k.index.length / 3} tris, volume ${r.volume.toFixed(3)}`);
});

test('seed mesh: closed teardrop, pointed toward +x', () => {
  const m = G.seedMesh(), pos = new Float32Array(m.vtx.length / 2);
  for (let v = 0; v < pos.length / 3; v++) pos.set(m.vtx.subarray(6 * v, 6 * v + 3), 3 * v);
  const w = weld(Float32Array.from(Array.from({ length: pos.length / 3 }, (_, v) => [...pos.subarray(3 * v, 3 * v + 3), 0, 1, 0, 0, 0]).flat()), m.index);
  const r = checkClosed(w.pos, w.index, 'seed');
  assert.ok(r.volume > 0, 'outward');
});

/* --------------------------------- timing --------------------------------- */

test('timings', () => {
  const slice = G.sliceRegion();
  const med = (f) => { const ts = []; for (let i = 0; i < 7; i++) { const t0 = now(); f(); ts.push(now() - t0); } return ts.sort((a, b) => a - b)[3]; };
  const tb = med(() => G.buildPiece(slice));
  const tk = med(() => { const r = G.splitByLine(slice, 1, 0, 0.2); G.buildPiece(r.pieces[0]); G.buildPiece(r.pieces[1]); });
  const tt = med(() => { G.knifeMesh(); G.seedMesh(); });
  console.log(`     buildPiece(slice) ${tb.toFixed(1)} ms | knife split + 2 builds ${tk.toFixed(1)} ms | knife + seed meshes ${tt.toFixed(1)} ms`);
  assert.ok(tb <= 40, `buildPiece(slice) ${tb} ms`);
  assert.ok(tk <= 80, `split + builds ${tk} ms`);
});

console.log(`\n${stats.pieces} pieces checked; min render triangle area ${stats.minArea.toExponential(2)}; ` +
  `worst render vertex outside sim ${stats.worstOut.toFixed(4)}; max ${stats.maxParticles} particles / ${stats.maxTets} tets per piece`);
if (failures) { console.log(`${failures} test(s) failed`); process.exit(1); }
console.log('all tests passed');
