// Tests for MelonSim. Run: node tests/06-melon-knife.sim.test.mjs
import assert from 'node:assert/strict';

import { MelonSim } from './load.mjs';
import { budget } from './budget.mjs'

const T = 0.56, R = 1.58, ZC = -0.67, DT = 1 / 60;   // the test meshes keep the old half-disc: the solver doesn't care
// Readouts use the illustrative scale (1 unit = 3.5 cm, 1.3 g/cm^3): the same motion reads KE_SCALE times
// more microjoules than the 1 cm / 1.05 g/cm^3 these thresholds were written for.
const G_PER_U3 = 1.3 * 3.5 ** 3, UJ_PER_GU2 = 0.5 * 1e-3 * 0.035 ** 2 * 1e6, KE_SCALE = (G_PER_U3 * UJ_PER_GU2) / 0.0525;

// ---- Meshes ------------------------------------------------------------------

// Extrudes a 2D triangulation (x, z pairs) into 2 layers of prisms, 3 tets each.
// Prisms are split by vertex index so shared quad faces get the same diagonal.
function extrude(pts2, tris, layers = 2) {
  const P = pts2.length / 2, X = new Float32Array(3 * P * (layers + 1));
  for (let l = 0; l <= layers; l++) {
    for (let i = 0; i < P; i++) X.set([pts2[2 * i], (T * l) / layers, pts2[2 * i + 1]], 3 * (l * P + i));
  }
  const tets = [];
  for (let l = 0; l < layers; l++) {
    for (let t = 0; t < tris.length; t += 3) {
      const [i, j, k] = [tris[t], tris[t + 1], tris[t + 2]].sort((a, b) => a - b);
      const b = l * P, u = (l + 1) * P;
      tets.push([i + b, j + b, k + b, k + u], [i + b, j + b, j + u, k + u], [i + b, i + u, j + u, k + u]);
    }
  }
  const out = new Uint32Array(tets.length * 4);
  tets.forEach((q, n) => {
    if (tetVolume(X, q[0], q[1], q[2], q[3]) < 0) [q[2], q[3]] = [q[3], q[2]];
    out.set(q, 4 * n);
  });
  return { X, tets: out };
}

function tetVolume(X, a, b, c, d) {
  a *= 3; b *= 3; c *= 3; d *= 3;
  const e1 = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]];
  const e2 = [X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2]];
  const e3 = [X[d] - X[a], X[d + 1] - X[a + 1], X[d + 2] - X[a + 2]];
  return (e1[0] * (e2[1] * e3[2] - e2[2] * e3[1]) + e1[1] * (e2[2] * e3[0] - e2[0] * e3[2]) + e1[2] * (e2[0] * e3[1] - e2[1] * e3[0])) / 6;
}

// Half-disc slice from concentric rings; each half (x < 0, x > 0) is stripped
// separately so the mesh has edges along x = 0 and splits cleanly into halves.
function halfDisc(K = 13) {
  const pts = [0, ZC], rings = [[{ i: 0, th: 0 }]];
  for (let k = 1; k <= K; k++) {
    const r = (R * k) / K, m = Math.max(1, Math.round((k * Math.PI) / 2)), ring = [];
    for (let j = 0; j <= 2 * m; j++) {
      const th = (Math.PI * j) / (2 * m);
      ring.push({ i: pts.length / 2, th });
      pts.push(r * Math.cos(th), ZC + r * Math.sin(th));
    }
    rings.push(ring);
  }
  const tris = [];
  const strip = (A, B) => {
    let i = 0, j = 0;
    while (i < A.length - 1 || j < B.length - 1) {
      if (j === B.length - 1 || (i < A.length - 1 && A[i + 1].th <= B[j + 1].th)) { tris.push(A[i].i, A[i + 1].i, B[j].i); i++; }
      else { tris.push(A[i].i, B[j + 1].i, B[j].i); j++; }
    }
  };
  for (let k = 1; k <= K; k++) {
    const A = rings[k - 1], B = rings[k], mb = (B.length - 1) / 2, ma = (A.length - 1) / 2;
    strip(k === 1 ? A : A.slice(0, ma + 1), B.slice(0, mb + 1));
    strip(k === 1 ? A : A.slice(ma), B.slice(mb));
  }
  return extrude(pts, tris);
}

function box(x0, x1, z0, z1, nx, nz) {
  const pts = [], tris = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pts.push(x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * j) / nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      tris.push(a, b, d, a, d, c);
    }
  }
  return extrude(pts, tris);
}

// Sub-mesh of the given tets, renumbered in the original order.
function subMesh({ X, tets }, list) {
  const n = X.length / 3, map = new Int32Array(n).fill(-1);
  for (const t of list) for (let k = 0; k < 4; k++) map[tets[4 * t + k]] = 0;
  let m = 0;
  for (let i = 0; i < n; i++) if (map[i] === 0) map[i] = m++;
  const Xn = new Float32Array(3 * m);
  for (let i = 0; i < n; i++) if (map[i] >= 0) Xn.set(X.subarray(3 * i, 3 * i + 3), 3 * map[i]);
  const tn = new Uint32Array(4 * list.length);
  list.forEach((t, j) => { for (let k = 0; k < 4; k++) tn[4 * j + k] = map[tets[4 * t + k]]; });
  return { X: Xn, tets: tn };
}

function splitBy(mesh, side) {
  const parts = [[], []];
  for (let t = 0; t < mesh.tets.length / 4; t++) {
    const c = [0, 0, 0];
    for (let k = 0; k < 4; k++) for (let a = 0; a < 3; a++) c[a] += mesh.X[3 * mesh.tets[4 * t + k] + a] / 4;
    parts[side(c) ? 0 : 1].push(t);
  }
  return parts.map((l) => subMesh(mesh, l));
}

// ---- Helpers -----------------------------------------------------------------

const run = (w, frames, each) => { for (let f = 0; f < frames; f++) { w.step(DT); if (each) each(f); } };

function sliceWorld(K = 13) {
  const w = MelonSim.createWorld();
  w.setPieces([halfDisc(K)]);
  return w;
}

// Smallest current/rest volume ratio over all tets (negative = inverted).
function minVolRatio(w) {
  let mn = Infinity;
  for (let t = 0; t < w.tets.length / 4; t++) {
    const q = w.tets.subarray(4 * t, 4 * t + 4);
    mn = Math.min(mn, tetVolume(w.x, ...q) / tetVolume(w.rest, ...q));
  }
  return mn;
}

function allFinite(a) { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; }

function minY(w, piece = -1) {
  let m = Infinity;
  for (let i = 0; i < w.n; i++) if (piece < 0 || w.piece[i] === piece) m = Math.min(m, w.x[3 * i + 1]);
  return m;
}

function maxSpeed(w) {
  let m = 0;
  for (let i = 0; i < w.n; i++) m = Math.max(m, Math.hypot(w.v[3 * i], w.v[3 * i + 1], w.v[3 * i + 2]));
  return m;
}

function momentum(w) {
  const p = [0, 0, 0];
  for (let i = 0; i < w.n; i++) for (let a = 0; a < 3; a++) p[a] += w.mass[i] * w.v[3 * i + a];
  return p;
}

// Rigidly moves piece p: rotate by `ang` about the x axis around its centroid, then translate.
function place(w, p, ang, dx, dy, dz) {
  const { start, count } = w.pieces[p];
  let cy = 0, cz = 0;
  for (let i = start; i < start + count; i++) { cy += w.x[3 * i + 1] / count; cz += w.x[3 * i + 2] / count; }
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let i = start; i < start + count; i++) {
    const y = w.x[3 * i + 1] - cy, z = w.x[3 * i + 2] - cz;
    w.x[3 * i] += dx;
    w.x[3 * i + 1] = cy + y * c - z * s + dy;
    w.x[3 * i + 2] = cz + y * s + z * c + dz;
  }
}

// Minimum over cross-piece particle pairs of distance / required distance.
function minCollisionRatio(w) {
  let worst = Infinity;
  for (let i = 0; i < w.n; i++) {
    for (let j = i + 1; j < w.n; j++) {
      if (w.piece[i] === w.piece[j]) continue;
      const d = Math.hypot(w.x[3 * j] - w.x[3 * i], w.x[3 * j + 1] - w.x[3 * i + 1], w.x[3 * j + 2] - w.x[3 * i + 2]);
      if (d > 0.11) continue;
      const rd = Math.hypot(w.rest[3 * j] - w.rest[3 * i], w.rest[3 * j + 1] - w.rest[3 * i + 1], w.rest[3 * j + 2] - w.rest[3 * i + 2]);
      worst = Math.min(worst, d / Math.min(0.11, Math.max(0.03, rd)));
    }
  }
  return worst;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---- Tests -------------------------------------------------------------------

test('embed: inside points interpolate exactly, outside points clamp to the nearest tet', () => {
  const m = halfDisc(8);
  const pts = new Float32Array([...m.X.subarray(0, 30), 0.3, 0.2, 0.1, 0, 0.28, ZC - 0.5, 0, 3, 0.2]);
  const { tet, w } = MelonSim.embed(m.X, m.tets, pts);
  for (let p = 0; p < pts.length / 3; p++) {
    let s = 0;
    const q = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const wk = w[4 * p + k], i = m.tets[4 * tet[p] + k];
      assert.ok(wk >= -1e-6, 'weights are clamped');
      s += wk;
      for (let a = 0; a < 3; a++) q[a] += wk * m.X[3 * i + a];
    }
    assert.ok(Math.abs(s - 1) < 1e-5);
    const err = Math.hypot(q[0] - pts[3 * p], q[1] - pts[3 * p + 1], q[2] - pts[3 * p + 2]);
    if (p < 11) assert.ok(err < 1e-5, `inside point ${p} reproduced (err ${err})`);
    // 0.5 outside -> on the edge: the clamped point is (0, 0.28, ZC), so its distance to the query is 0.5.
    else if (p === 11) assert.ok(Math.hypot(q[0], q[1] - 0.28, q[2] - ZC) < 0.05, `point below the flat edge lands on the boundary (${q})`);
    else assert.ok(Math.hypot(q[0], q[1] - T, q[2] - 0.2) < 1e-4, `point above lands on its closest point (${q})`);
  }
  return `outside point (0, 3, 0.2) -> clamped onto tet ${tet[12]}`;
});

test('drop and settle: KE ~ 0, volume kept, no inverted tets, resting on the floor', () => {
  const w = sliceWorld();
  place(w, 0, 0.35, 0.2, 1.2, 0);
  run(w, 420);
  const s = w.stats(), mv = minVolRatio(w), y0 = minY(w);
  assert.ok(s.keUJ < 1e-6 * KE_SCALE, `KE ${s.keUJ}`);
  assert.ok(Math.abs(s.relVol - 1) < 0.02, `relVol ${s.relVol}`);
  assert.ok(mv > 0, `min tet volume ratio ${mv}`);
  assert.ok(y0 >= 0 && y0 < 0.005, `min y ${y0}`);
  assert.ok(s.pieces[0].flat, 'lands flat');
  assert.ok(Math.abs(s.pieces[0].centroid[1] - T / 2) < 0.05, `centroid y ${s.pieces[0].centroid[1]}`);
  return `KE ${s.keUJ.toExponential(1)} uJ, relVol ${s.relVol.toFixed(4)}, min tet vol ratio ${mv.toFixed(3)}, mass ${s.massG.toFixed(3)} g`;
});

test('grab, stretch to the edge of reach, twist, release: returns to the rest shape', () => {
  const w = sliceWorld();
  run(w, 10);
  const tip = [0, T, ZC + R];
  assert.ok(w.grabStart(tip, { radius: 0.25, axis: [0, -1, 0] }));
  assert.equal(w.grabbing, true);
  let maxStrain = 0;
  run(w, 60, () => { w.grabMove([0, 2.5, 8]); maxStrain = Math.max(maxStrain, w.strain().max); });
  const stretched = w.strain();
  for (let f = 1; f <= 30; f++) { w.grabTwist((1.2 * f) / 30); w.step(DT); }
  w.grabMove([0, -5, ZC + R]);   // into the floor: target is held at y >= 0.02
  run(w, 30);
  assert.ok(minY(w) >= 0, 'never pushed into the floor');
  w.grabEnd();
  assert.equal(w.grabbing, false);
  assert.ok(maxSpeed(w) <= 6 + 1e-6, 'release speed capped');
  w.params.gravity = 0;
  run(w, 300);
  const s = w.strain(), st = w.stats();
  assert.ok(stretched.rms > 0.01, `was stretched (rms ${stretched.rms})`);
  assert.ok(maxStrain <= 0.8 + 0.03, `strain limit while pulling: ${maxStrain}`);
  assert.ok(s.rms < 0.005, `relaxed strain rms ${s.rms}`);
  assert.ok(Math.abs(st.relVol - 1) < 0.02 && minVolRatio(w) > 0);
  return `stretched rms ${stretched.rms.toFixed(3)} (max ${maxStrain.toFixed(2)}) -> relaxed rms ${s.rms.toFixed(4)}`;
});

test('firmness / damping extremes stay stable and settle', () => {
  const w0 = MelonSim.createWorld();
  assert.deepEqual({ ...w0.params }, { firmness: 50, damping: 30, gravity: 11 });
  w0.setFirmness(500); w0.setDamping(-3);
  assert.equal(w0.params.firmness, 100); assert.equal(w0.params.damping, 0);
  const out = [];
  for (const [f, d] of [[0, 0], [0, 100], [100, 0], [100, 100]]) {
    const w = sliceWorld();
    w.setFirmness(f); w.setDamping(d);
    place(w, 0, -0.5, 0, 1.0, 0);
    run(w, 60);
    w.grabStart([0.5, T, 0], { radius: 0.3 });
    run(w, 40, () => w.grabMove([1.5, 1.2, 0.5]));
    w.grabEnd();
    run(w, 480);
    const s = w.stats(), mv = minVolRatio(w), sr = w.strain().rms;
    assert.ok(allFinite(w.x) && allFinite(w.v));
    assert.ok(mv > 0, `f${f} d${d}: inverted tet (${mv})`);
    assert.ok(s.keUJ < 1e-4 * KE_SCALE, `f${f} d${d}: KE ${s.keUJ}`);
    assert.ok(Math.abs(s.relVol - 1) < 0.03, `f${f} d${d}: relVol ${s.relVol}`);
    assert.ok(sr < 0.02, `f${f} d${d}: strain rms ${sr}`);
    out.push(`f${f}/d${d}: KE ${s.keUJ.toExponential(0)} relVol ${s.relVol.toFixed(3)} strain ${sr.toFixed(4)}`);
  }
  return out.join('; ');
});

test('nudge spam stays bounded and settles', () => {
  MelonSim.createWorld().nudge();          // empty world: no-op
  const w = sliceWorld();
  run(w, 10);
  let top = 0, vmax = 0;
  for (let f = 0; f < 240; f++) {
    w.nudge(f % 10 === 0 ? 5 : 1);
    w.step(DT);
    top = Math.max(top, w.stats().pieces[0].centroid[1]);
    vmax = Math.max(vmax, maxSpeed(w));
  }
  run(w, 600);
  const s = w.stats(), mv = minVolRatio(w);
  assert.ok(allFinite(w.x));
  assert.ok(vmax <= 20 + 1e-3, `speed cap ${vmax}`);
  assert.ok(top < 8, `max height ${top}`);
  assert.ok(mv > 0 && Math.abs(s.relVol - 1) < 0.02, `after spam: vol ${s.relVol}, min ratio ${mv}`);
  assert.ok(s.keUJ < 1e-4 * KE_SCALE, `settles: KE ${s.keUJ}`);
  assert.ok(minY(w) >= 0 && minY(w) < 0.01);
  return `peak centroid y ${top.toFixed(2)}, peak speed ${vmax.toFixed(2)}, final KE ${s.keUJ.toExponential(1)}, flat ${s.pieces[0].flat}`;
});

test('two pieces stacked and colliding do not interpenetrate', () => {
  // Stacked: B dropped onto A.
  const A = box(-1.2, -0.2, -0.5, 0.5, 10, 10), B = box(0.2, 1.2, -0.5, 0.5, 10, 10);
  let w = MelonSim.createWorld();
  w.setPieces([A, B]);
  place(w, 1, 0.1, -1.4, T + 0.4, 0);
  let worst = Infinity;
  run(w, 300, (f) => { if (f % 3 === 0) worst = Math.min(worst, minCollisionRatio(w)); });
  worst = Math.min(worst, minCollisionRatio(w));
  assert.ok(worst >= 0.6, `stacked: min distance ratio ${worst}`);
  assert.ok(minY(w, 1) > T - 0.1, `B rests on A (B min y ${minY(w, 1)})`);
  assert.ok(w.stats().keUJ < 1e-3 * KE_SCALE);
  const stacked = worst;

  // Head-on: A and B slide into each other.
  w = MelonSim.createWorld();
  w.setPieces([A, B]);
  for (let i = 0; i < w.n; i++) { w.v[3 * i] = w.piece[i] === 0 ? 2.5 : -2.5; w.x[3 * i + 1] += 0.01; }
  worst = Infinity;
  run(w, 120, () => { worst = Math.min(worst, minCollisionRatio(w)); });
  assert.ok(worst >= 0.6, `head-on: min distance ratio ${worst}`);
  assert.ok(minVolRatio(w) > 0);
  return `min distance / d: stacked ${stacked.toFixed(2)}, head-on ${worst.toFixed(2)}`;
});

test('replacePieces: split into halves keeps positions and momentum; keep entries are exact', () => {
  const mesh = halfDisc();
  const [left, right] = splitBy(mesh, (c) => c[0] < 0);
  const w = MelonSim.createWorld();
  w.setPieces([mesh]);
  place(w, 0, 0.3, 0, 0.8, 0);
  run(w, 50);
  w.grabStart([0.8, T, 0], { radius: 0.3 });
  run(w, 20, () => w.grabMove([1.6, 1.5, 0.4]));
  w.grabEnd();
  run(w, 3);
  const oldX = w.x.slice(), oldV = w.v.slice(), oldRest = w.rest.slice(), p0 = momentum(w), v0 = w.version;
  let scale = 0;
  for (let i = 0; i < w.n; i++) scale += w.mass[i] * Math.hypot(oldV[3 * i], oldV[3 * i + 1], oldV[3 * i + 2]);
  const byRest = new Map();
  for (let i = 0; i < oldRest.length / 3; i++) byRest.set(`${oldRest[3 * i]},${oldRest[3 * i + 1]},${oldRest[3 * i + 2]}`, i);

  w.replacePieces([left, right]);
  assert.equal(w.version, v0 + 1);
  assert.equal(w.pieces.length, 2);
  assert.equal(w.n, left.X.length / 3 + right.X.length / 3);
  let errX = 0, errV = 0;
  for (let i = 0; i < w.n; i++) {
    const j = byRest.get(`${w.rest[3 * i]},${w.rest[3 * i + 1]},${w.rest[3 * i + 2]}`);
    assert.ok(j !== undefined);
    for (let a = 0; a < 3; a++) {
      errX = Math.max(errX, Math.abs(w.x[3 * i + a] - oldX[3 * j + a]));
      errV = Math.max(errV, Math.abs(w.v[3 * i + a] - oldV[3 * j + a]));
    }
  }
  const p1 = momentum(w), dp = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  assert.ok(errX <= 1e-4, `position error ${errX}`);
  assert.ok(errV <= 1e-3, `velocity error ${errV}`);
  assert.ok(dp <= 1e-4 * scale, `momentum change ${dp} (scale ${scale})`);

  // Keep entries: swapped order, state copied exactly.
  const x1 = w.x.slice(), c0 = w.pieces[0].count;
  w.replacePieces([{ keep: 1 }, { keep: 0 }]);
  assert.equal(w.pieces[1].count, c0);
  assert.deepEqual(w.x.subarray(w.pieces[1].start * 3, (w.pieces[1].start + c0) * 3), x1.subarray(0, c0 * 3));
  w.replacePieces([{ keep: 1 }, { keep: 0 }]);   // back to [left, right]

  // Pull the halves apart, then split the right half again: its points on x = 0
  // must come from the right piece, not from the left piece sharing that boundary.
  run(w, 30);
  for (let i = 0; i < w.pieces[0].count; i++) w.x[3 * i] -= 1;
  run(w, 2);
  const rp = w.pieces[1], rx = w.x.slice(rp.start * 3, (rp.start + rp.count) * 3), rr = w.rest.slice(rp.start * 3, (rp.start + rp.count) * 3);
  const rightMesh = { X: rr, tets: w.tets.slice(rp.tetStart * 4, (rp.tetStart + rp.tetCount) * 4).map((v) => v - rp.start) };
  const [q1, q2] = splitBy(rightMesh, (c) => c[2] < 0);
  w.replacePieces([{ keep: 0 }, q1, q2]);
  let errQ = 0;
  const byRest2 = new Map();
  for (let i = 0; i < rr.length / 3; i++) byRest2.set(`${rr[3 * i]},${rr[3 * i + 1]},${rr[3 * i + 2]}`, i);
  for (let i = w.pieces[1].start; i < w.n; i++) {
    const j = byRest2.get(`${w.rest[3 * i]},${w.rest[3 * i + 1]},${w.rest[3 * i + 2]}`);
    for (let a = 0; a < 3; a++) errQ = Math.max(errQ, Math.abs(w.x[3 * i + a] - rx[3 * j + a]));
  }
  assert.ok(errQ <= 1e-4, `second split position error ${errQ}`);
  run(w, 120);
  assert.ok(allFinite(w.x) && minVolRatio(w) > 0);
  return `max position error ${errX.toExponential(1)}, velocity ${errV.toExponential(1)}, |dp|/sum m|v| ${(dp / scale).toExponential(1)}, second split ${errQ.toExponential(1)}`;
});

test('NaN injection restores the last good state', () => {
  const w = sliceWorld();
  run(w, 20);
  w.nudge();
  run(w, 5);
  const x0 = w.x.slice(), v0 = w.v.slice();
  w.x[10] = NaN;
  w.step(DT);
  assert.deepEqual(w.x, x0); assert.deepEqual(w.v, v0);
  w.v[20] = Infinity;
  w.step(DT);
  assert.deepEqual(w.x, x0);
  let once = true;
  w.collider = (x) => { if (once) { x[33] = NaN; once = false; } };
  w.step(DT);
  assert.deepEqual(w.x, x0);
  w.collider = null;
  w.grabStart([0, T, 0]);
  w.grabMove([NaN, 1, 0]);       // ignored
  run(w, 240);
  w.grabEnd();
  assert.ok(allFinite(w.x) && minVolRatio(w) > 0);
  return 'restored after NaN position, Inf velocity and NaN from a collider';
});

test('hard strain limit holds under an extreme pull', () => {
  const w = sliceWorld();
  w.setFirmness(0); w.setDamping(0);
  w.grabStart([0, T, ZC + R], { radius: 0.1 });
  let mx = 0;
  run(w, 90, (f) => { w.grabMove(f % 2 ? [6, 4, 9] : [-6, 0, 9]); mx = Math.max(mx, w.strain().max); });
  w.grabEnd();
  // Tear the slice apart at the speed cap.
  for (let i = 0; i < w.n; i++) w.v[3 * i] = w.rest[3 * i] < 0 ? -20 : 20;
  run(w, 10, () => { mx = Math.max(mx, w.strain().max); });
  assert.ok(mx <= 0.8 + 0.03, `max edge strain ${mx}`);   // 1.8x stretch / 0.4x compression
  run(w, 300);
  assert.ok(allFinite(w.x) && minVolRatio(w) > 0);
  return `max |strain| ${mx.toFixed(3)} (limit 0.8)`;
});

test('motion after release decays: no endless wobble, no instant snap', () => {
  // Flat edge held by a "fork" (the collider hook), gravity off; the tip is lifted,
  // held, released. Measure the tip height relative to rest.
  const w = sliceWorld();
  w.params.gravity = 0;
  const pin = [];
  for (let i = 0; i < w.n; i++) if (w.rest[3 * i + 2] < ZC + 0.3) pin.push(i);
  w.collider = (x) => { for (const i of pin) { x[3 * i] = w.rest[3 * i]; x[3 * i + 1] = w.rest[3 * i + 1]; x[3 * i + 2] = w.rest[3 * i + 2]; } };
  const tipIdx = [];
  for (let i = 0; i < w.n; i++) if (Math.hypot(w.rest[3 * i], w.rest[3 * i + 1] - T, w.rest[3 * i + 2] - ZC - R) < 0.2) tipIdx.push(i);
  const tipY = () => tipIdx.reduce((s, i) => s + w.x[3 * i + 1] - w.rest[3 * i + 1], 0) / tipIdx.length;
  w.grabStart([0, T, ZC + R]);
  for (let f = 1; f <= 20; f++) { w.grabMove([0, T + 0.03 * f, ZC + R]); w.step(DT); }
  run(w, 40);
  const d0 = tipY();
  w.grabEnd();
  const tr = [];
  run(w, 300, () => tr.push(tipY() / d0));
  const cross = tr.findIndex((v) => v < 0);
  const overshoot = cross >= 0 ? -Math.min(...tr.slice(cross, cross + 60)) : 0;
  let last = 0;
  tr.forEach((v, i) => { if (Math.abs(v) > 0.05) last = i + 1; });
  const decay = last / 60;
  assert.ok(tr[0] > 0.5, `no instant snap: ${(tr[0] * 100).toFixed(0)}% left after one frame`);
  assert.ok(cross >= 2, `first zero crossing at frame ${cross + 1}`);
  assert.ok(overshoot < 0.9, `overshoot ${overshoot}`);
  assert.ok(decay < 3, `decay time ${decay}s`);
  assert.ok(Math.max(...tr.slice(-60).map(Math.abs)) < 0.02, 'no endless oscillation');
  return `lift ${d0.toFixed(2)}: after 1 frame ${(tr[0] * 100).toFixed(0)}%, first crossing ${((cross + 1) * 1000 / 60).toFixed(0)} ms, first overshoot ${(overshoot * 100).toFixed(0)}%, decay to 5% in ${decay.toFixed(2)} s`;
});

test('rigidFrame and stats report the rigid pose, mass and energy', () => {
  const w = sliceWorld();
  const fr0 = w.rigidFrame(0), c = fr0.restCentroid;
  // Flip the slice upside down (180 deg about z) and lift it.
  for (let i = 0; i < w.n; i++) {
    const x = w.rest[3 * i] - c[0], y = w.rest[3 * i + 1] - c[1];
    w.x[3 * i] = -x + c[0]; w.x[3 * i + 1] = -y + c[1] + 1; w.v[3 * i] = 1;
  }
  const fr = w.rigidFrame(0, fr0);
  assert.equal(fr, fr0, 'reuses out');
  const want = [-1, 0, 0, 0, -1, 0, 0, 0, 1];
  for (let k = 0; k < 9; k++) assert.ok(Math.abs(fr.R[k] - want[k]) < 1e-4, `R ${[...fr.R]}`);
  assert.ok(Math.abs(fr.t[1] - c[1] - 1) < 1e-4);
  const s = w.stats();
  let vol = 0;
  for (let t = 0; t < w.tets.length / 4; t++) vol += tetVolume(w.rest, ...w.tets.subarray(4 * t, 4 * t + 4));
  assert.ok(Math.abs(s.massG - G_PER_U3 * vol) < 1e-3 * G_PER_U3, `mass ${s.massG}`);
  assert.ok(Math.abs(s.keUJ - UJ_PER_GU2 * s.massG) < 1e-3 * s.keUJ, `KE ${s.keUJ}`);   // 0.5 m v^2, v = 1 unit/s
  assert.ok(s.pieces[0].up[1] < -0.99 && s.pieces[0].flat);
  return `mass ${s.massG.toFixed(3)} g, up ${s.pieces[0].up.map((v) => v.toFixed(2))}`;
});

test('step cost of a full slice', () => {
  const w = sliceWorld();
  run(w, 120);
  const time = (label) => {
    const ts = [];
    for (let r = 0; r < 7; r++) { const t0 = performance.now(); run(w, 60); ts.push((performance.now() - t0) / 60); }
    ts.sort((a, b) => a - b);
    return { label, min: ts[0], med: ts[3] };
  };
  const rest = time('resting');
  w.grabStart([0, T, ZC + R]);
  w.grabMove([0, 1.2, 1.5]);
  const held = time('held');
  w.grabEnd();
  const parts = MelonSim.createWorld();
  parts.setPieces(splitBy(halfDisc(), (c) => c[0] < 0));
  for (let i = 0; i < 120; i++) parts.step(DT);
  const ts = [];
  for (let r = 0; r < 7; r++) { const t0 = performance.now(); for (let i = 0; i < 60; i++) parts.step(DT); ts.push((performance.now() - t0) / 60); }
  ts.sort((a, b) => a - b);
  assert.ok(rest.min <= budget(3.75) && held.min <= budget(3.75), `step cost ${rest.min} / ${held.min} ms`);   // 10 substeps: the old 8-substep 3 ms budget x 10/8
  return `${w.n} particles, ${w.tets.length / 4} tets, ${w.edges.length / 2} edges: ` +
    `resting ${rest.med.toFixed(2)} ms, held ${held.med.toFixed(2)} ms, two touching halves ${ts[3].toFixed(2)} ms (median of 7x60 steps; budget 3.75 ms)`;
});

// ---- Runner ------------------------------------------------------------------

let failed = 0;
for (const { name, fn } of tests) {
  const t0 = performance.now();
  try {
    const info = fn();
    console.log(`ok   ${name} (${(performance.now() - t0).toFixed(0)} ms)${info ? `\n     ${info}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${e.stack}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exitCode = failed ? 1 : 0;
