// ---------------------------------------------------------------------------
// WholeMelon: a whole watermelon as a signed distance field in one rest frame (1 unit = 10 cm; the long axis
// is x, y is up, the melon lies on its side with a softly flattened belly), its seeds and air bubbles, and
// its pieces: the melon clipped by the half-spaces of the cuts that made them, fresh edges rounded with a
// smooth max. Meshing a piece (a generator, so a cut can be built a few milliseconds per frame):
//   surface nets on a fine grid, evaluated only in blocks near the surface, one Newton step onto it
//   -> a hex lattice in the piece's principal frame, spacing fitted to its extent, boundary nodes snapped
//      onto the surface -> 8-node cells split into 5 tets each -> barycentric embedding of the skin, the
//      seed anchors and the bubbles -> the seeds and bubbles near the cut faces (a seed the knife went
//      through is kept by one side and eased just under the new face).
// ---------------------------------------------------------------------------
export const WholeMelon = (() => {
  const A = 1.6, B = 1.0, C = 1.06;            // semi-axes: 32 cm long
  const BELLY = -0.8, BELLY_K = 0.35;          // the flattened belly: a plane, blended in softly
  const SKIN = 0.035, PITH = 0.11;             // the green skin, then the pale pith band, by depth
  const RIND = SKIN + PITH;
  const ROUND = 0.045;                         // fresh edges: smooth-max radius
  const SURF_H = 0.03, LAT_H = 0.24;           // surface-nets grid; the lattice's largest spacing
  const SEED_N = 700, BUBBLE_N = 260;
  const SEED_NEAR = 0.11, BUBBLE_NEAR = 0.14;  // seeds and bubbles are meshed only this close to a cut face
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const OPT = { keep: 0.35, flat: 0.3, cells: 150, hMax: LAT_H, hMin: 0.09 };                   // a lattice cell is kept if its centre is within keep x spacing of the piece (full coverage of the skin)

  // ----- the field (value and unit gradient) -----
  /** The uncut melon: an ellipsoid (a close, well-behaved bound) with its belly flattened. */
  function melon(x, y, z, out) {
    const px = x / A, py = y / B, pz = z / C, qx = x / (A * A), qy = y / (B * B), qz = z / (C * C);
    const k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1e-9;
    const a = (k0 * (k0 - 1)) / k1, b = BELLY - y;
    const h = clamp(0.5 + (0.5 * (b - a)) / BELLY_K, 0, 1);
    const d = a * (1 - h) + b * h + BELLY_K * h * (1 - h);
    if (out) {   // grad = mix(grad a, grad b, h): exact for the polynomial smooth max
      const gx = (qx / k1) * (1 - h), gy = (qy / k1) * (1 - h) - h, gz = (qz / k1) * (1 - h);
      const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      out[0] = d; out[1] = gx / l; out[2] = gy / l; out[3] = gz / l;
    }
    return d;
  }
  /** A piece: the melon clipped by its cuts ([nx, ny, nz, o]: it keeps n.p <= o), edges rounded. */
  function piece(cuts, x, y, z, out) {
    if (!out) {
      let d = melon(x, y, z);
      for (const c of cuts) {
        const b = c[0] * x + c[1] * y + c[2] * z - c[3], h = clamp(0.5 + (0.5 * (b - d)) / ROUND, 0, 1);
        d = d * (1 - h) + b * h + ROUND * h * (1 - h);
      }
      return d;
    }
    melon(x, y, z, out);
    let d = out[0], gx = out[1], gy = out[2], gz = out[3];
    for (const c of cuts) {
      const b = c[0] * x + c[1] * y + c[2] * z - c[3], h = clamp(0.5 + (0.5 * (b - d)) / ROUND, 0, 1);
      d = d * (1 - h) + b * h + ROUND * h * (1 - h);
      gx = gx * (1 - h) + c[0] * h; gy = gy * (1 - h) + c[1] * h; gz = gz * (1 - h) + c[2] * h;
    }
    const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    out[0] = d; out[1] = gx / l; out[2] = gy / l; out[3] = gz / l;
    return d;
  }
  // where the belly meets the table (the melon is placed so that this point rests on y = 0)
  const BOTTOM = (() => { let lo = -B, hi = 0; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (melon(0, m, 0) > 0) lo = m; else hi = m; } return hi; })();

  // ----- seeds: a three-lobed ring at about two thirds of the radius, teardrops with the wide end outward -----
  function rng(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SEEDS = (() => {
    const r = rng(0x5eed5), out = [], cell = 0.07, grid = new Map(), key = (i, j, k) => `${i},${j},${k}`;
    const gauss = () => { let s = 0; for (let k = 0; k < 4; k++) s += r(); return (s - 2) * 0.866; };
    let tries = 0;
    while (out.length / 10 < SEED_N && tries++ < 80000) {
      const x = (r() * 2 - 1) * 0.86 * A, f = Math.sqrt(Math.max(0, 1 - (x / A) ** 2));
      if (r() > f) continue;   // denser where the melon is fatter
      const th = r() * 2 * Math.PI, ring = 0.6 + 0.085 * Math.cos(3 * th + 0.4) + gauss() * 0.035;
      const y = B * f * ring * Math.cos(th) * 0.97, z = C * f * ring * Math.sin(th);
      if (melon(x, y, z) > -(RIND + 0.1)) continue;
      const i0 = Math.floor(x / cell), j0 = Math.floor(y / cell), k0 = Math.floor(z / cell);
      let near = false;   // no two seeds closer than a seed's width
      for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1 && !near; b++) for (let c = -1; c <= 1 && !near; c++) {
        for (const q of grid.get(key(i0 + a, j0 + b, k0 + c)) || []) if (Math.hypot(q[0] - x, q[1] - y, q[2] - z) < 0.055) { near = true; break; }
      }
      if (near) continue;
      const k = key(i0, j0, k0);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push([x, y, z]);
      // the tip points inward (wide end outward); the seed lies flat in the cross-section, a little tilted
      const rl = Math.hypot(y, z) || 1;
      let X = [(r() - 0.5) * 0.3, -y / rl, -z / rl];
      const xl = Math.hypot(...X); X = X.map((v) => v / xl);
      let Y = [1, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3];
      const d = Y[0] * X[0] + Y[1] * X[1] + Y[2] * X[2]; Y = Y.map((v, i) => v - d * X[i]);
      const yl = Math.hypot(...Y); Y = Y.map((v) => v / yl);
      out.push(x, y, z, ...X, ...Y, 0.85 + 0.3 * r());
    }
    return Float32Array.from(out);
  })();
  const BUBBLES = (() => {
    const r = rng(0xb0bb1e), out = [];
    while (out.length / 4 < BUBBLE_N) {
      const x = (r() * 2 - 1) * A, y = (r() * 2 - 1) * B, z = (r() * 2 - 1) * C;
      if (melon(x, y, z) < -(RIND + 0.06)) out.push(x, y, z, 0.004 + 0.01 * r() * r());
    }
    return Float32Array.from(out);
  })();

  // ----- surface nets (a generator): one vertex per cell the surface crosses, one quad per crossed edge -----
  function* surfaceNets(f, b, h) {
    const nx = Math.ceil((b[3] - b[0]) / h) + 1, ny = Math.ceil((b[4] - b[1]) / h) + 1, nz = Math.ceil((b[5] - b[2]) / h) + 1;
    const at = (i, j, k) => i + nx * (j + ny * k), F = new Float32Array(nx * ny * nz);
    // Narrow band in two levels (blocks of 4h, then 2h): a block whose corners all lie farther from the surface
    // than its diagonal cannot hold any of it (the field is close to 1-Lipschitz), so its points only need a sign.
    const level = (H) => { const mx = Math.ceil((nx - 1) / H) + 1, my = Math.ceil((ny - 1) / H) + 1, mz = Math.ceil((nz - 1) / H) + 1;
      return { H, mx, my, mz, v: new Float32Array(mx * my * mz).fill(NaN), far: new Float32Array((mx - 1) * (my - 1) * (mz - 1)).fill(NaN), lim: 1.3 * Math.sqrt(3) * H * h }; };
    const val = (L, i, j, k) => { const id = i + L.mx * (j + L.my * k); let v = L.v[id]; if (v !== v) v = L.v[id] = f(b[0] + i * L.H * h, b[1] + j * L.H * h, b[2] + k * L.H * h); return v; };
    const farOf = (L, i, j, k) => {
      const id = i + (L.mx - 1) * (j + (L.my - 1) * k);
      const r = L.far[id];
      if (r === r) return r;
      let lo = Infinity, hi = -Infinity, sum = 0;
      for (let c = 0; c < 8; c++) { const v = val(L, i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)); lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
      return (L.far[id] = lo > L.lim || hi < -L.lim ? sum / 8 : 0);
    };
    const L4 = level(4), L2 = level(2);
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        let fv = farOf(L4, Math.min((i / 4) | 0, L4.mx - 2), Math.min((j / 4) | 0, L4.my - 2), Math.min((k / 4) | 0, L4.mz - 2));
        if (fv === 0) fv = farOf(L2, Math.min((i / 2) | 0, L2.mx - 2), Math.min((j / 2) | 0, L2.my - 2), Math.min((k / 2) | 0, L2.mz - 2));
        F[at(i, j, k)] = fv !== 0 ? fv : f(b[0] + i * h, b[1] + j * h, b[2] + k * h);
      }
      if ((k & 3) === 3) yield;
    }
    const cellV = new Int32Array(nx * ny * nz).fill(-1), P = [];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cv = new Float32Array(8);
    for (let k = 0; k < nz - 1; k++) {
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) { cv[c] = F[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; if (cv[c] < 0) inside++; }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, m = 0;
        for (const [a, c] of EDGES) {
          if ((cv[a] < 0) === (cv[c] < 0)) continue;
          const t = cv[a] / (cv[a] - cv[c]);
          sx += (a & 1) + ((c & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((c >> 1) & 1) - ((a >> 1) & 1)) * t; sz += ((a >> 2) & 1) + (((c >> 2) & 1) - ((a >> 2) & 1)) * t; m++;
        }
        cellV[at(i, j, k)] = P.length / 3;
        P.push(b[0] + (i + sx / m) * h, b[1] + (j + sy / m) * h, b[2] + (k + sz / m) * h);
      }
      if ((k & 7) === 7) yield;
    }
    const quads = [], cell = (i, j, k) => cellV[at(i, j, k)];
    const quad = (inFirst, a, bb, c, d) => { if (inFirst) quads.push(a, bb, c, d); else quads.push(a, d, c, bb); };
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const f0 = F[at(i, j, k)], f1 = F[at(i + 1, j, k)];
      if ((f0 < 0) !== (f1 < 0)) quad(f0 < 0, cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k));
    }
    for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const f0 = F[at(i, j, k)], f1 = F[at(i, j + 1, k)];
      if ((f0 < 0) !== (f1 < 0)) quad(f0 < 0, cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1));
    }
    for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const f0 = F[at(i, j, k)], f1 = F[at(i, j, k + 1)];
      if ((f0 < 0) !== (f1 < 0)) quad(f0 < 0, cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k));
    }
    yield;
    // a light relaxation toward the neighbours' mean, then one Newton step onto the surface
    const pos = new Float32Array(P), nv = pos.length / 3, nb = new Array(nv);
    for (let v = 0; v < nv; v++) nb[v] = [];
    for (let q = 0; q < quads.length; q += 4) for (let s = 0; s < 4; s++) nb[quads[q + s]].push(quads[q + (s + 1) % 4]);
    const tmp = new Float32Array(pos.length);
    for (let v = 0; v < nv; v++) {
      let sx = 0, sy = 0, sz = 0;
      for (const u of nb[v]) { sx += pos[3 * u]; sy += pos[3 * u + 1]; sz += pos[3 * u + 2]; }
      const m = nb[v].length || 1;
      tmp[3 * v] = 0.5 * pos[3 * v] + (0.5 * sx) / m; tmp[3 * v + 1] = 0.5 * pos[3 * v + 1] + (0.5 * sy) / m; tmp[3 * v + 2] = 0.5 * pos[3 * v + 2] + (0.5 * sz) / m;
    }
    pos.set(tmp);
    yield;
    const nrm = new Float32Array(pos.length), g = new Float64Array(4);
    for (let v = 0; v < nv; v++) {
      f.grad(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2], g);
      pos[3 * v] -= g[0] * g[1]; pos[3 * v + 1] -= g[0] * g[2]; pos[3 * v + 2] -= g[0] * g[3];
      f.grad(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2], g);
      nrm[3 * v] = g[1]; nrm[3 * v + 1] = g[2]; nrm[3 * v + 2] = g[3];
      if ((v & 4095) === 4095) yield;
    }
    const d2 = (a, c) => (pos[3 * a] - pos[3 * c]) ** 2 + (pos[3 * a + 1] - pos[3 * c + 1]) ** 2 + (pos[3 * a + 2] - pos[3 * c + 2]) ** 2;
    const index = new Uint32Array((quads.length / 4) * 6);
    for (let q = 0, t = 0; q < quads.length; q += 4) {
      const a = quads[q], bb = quads[q + 1], c = quads[q + 2], d = quads[q + 3];
      if (d2(a, c) < d2(bb, d)) index.set([a, bb, c, a, c, d], t); else index.set([a, bb, d, bb, c, d], t);
      t += 6;
    }
    return { pos, nrm, index };
  }

  // ----- the lattice (a generator): a hex grid in the principal frame, fitted to the piece -----
  function sym3eig(S) {   // Jacobi: eigenvectors (the columns of V) of a symmetric 3x3 (row-major)
    const a = S.slice(), V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let sweep = 0; sweep < 24; sweep++) {
      for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
        const apq = a[3 * p + q];
        if (Math.abs(apq) < 1e-14) continue;
        const th = (a[3 * q + q] - a[3 * p + p]) / (2 * apq), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) { const kp = a[3 * k + p], kq = a[3 * k + q]; a[3 * k + p] = c * kp - s * kq; a[3 * k + q] = s * kp + c * kq; }
        for (let k = 0; k < 3; k++) { const pk = a[3 * p + k], qk = a[3 * q + k]; a[3 * p + k] = c * pk - s * qk; a[3 * q + k] = s * pk + c * qk; }
        for (let k = 0; k < 3; k++) { const vp = V[3 * k + p], vq = V[3 * k + q]; V[3 * k + p] = c * vp - s * vq; V[3 * k + q] = s * vp + c * vq; }
      }
    }
    return V;
  }
  const TET_EVEN = [[0, 1, 2, 4], [3, 1, 2, 7], [5, 1, 4, 7], [6, 2, 4, 7], [1, 2, 4, 7]];
  const TET_ODD = [[1, 0, 3, 5], [2, 0, 3, 6], [4, 0, 5, 6], [7, 3, 5, 6], [0, 3, 5, 6]];
  const vol6 = (P, a, b, c, d) => {
    const e1x = P[3 * b] - P[3 * a], e1y = P[3 * b + 1] - P[3 * a + 1], e1z = P[3 * b + 2] - P[3 * a + 2];
    const e2x = P[3 * c] - P[3 * a], e2y = P[3 * c + 1] - P[3 * a + 1], e2z = P[3 * c + 2] - P[3 * a + 2];
    const e3x = P[3 * d] - P[3 * a], e3y = P[3 * d + 1] - P[3 * a + 1], e3z = P[3 * d + 2] - P[3 * a + 2];
    return e1x * (e2y * e3z - e2z * e3y) + e1y * (e2z * e3x - e2x * e3z) + e1z * (e2x * e3y - e2y * e3x);
  };
  function* lattice(f, skin) {
    // the principal frame, from the skin's vertices (the surface-nets grid is uniform, so they weigh by area)
    const P = skin.pos, nv = P.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < nv; v++) { cx += P[3 * v]; cy += P[3 * v + 1]; cz += P[3 * v + 2]; }
    cx /= nv; cy /= nv; cz /= nv;
    const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let v = 0; v < nv; v++) {
      const d0 = P[3 * v] - cx, d1 = P[3 * v + 1] - cy, d2 = P[3 * v + 2] - cz;
      S[0] += d0 * d0; S[1] += d0 * d1; S[2] += d0 * d2; S[4] += d1 * d1; S[5] += d1 * d2; S[8] += d2 * d2;
    }
    S[3] = S[1]; S[6] = S[2]; S[7] = S[5];
    const V = sym3eig(S), E = [0, 1, 2].map((k) => [V[k], V[3 + k], V[6 + k]]);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) {
      const u = (P[3 * v] - cx) * E[k][0] + (P[3 * v + 1] - cy) * E[k][1] + (P[3 * v + 2] - cz) * E[k][2];
      if (u < lo[k]) lo[k] = u; if (u > hi[k]) hi[k] = u;
    }
    // spacing: at most LAT_H, finer for small pieces (a few hundred cells), fitted to the extent per axis
    const ext = [0, 1, 2].map((k) => hi[k] - lo[k]), H = clamp(Math.cbrt((ext[0] * ext[1] * ext[2]) / OPT.cells), OPT.hMin, OPT.hMax);
    const N = ext.map((e) => Math.max(1, Math.round(e / H))), hh = ext.map((e, k) => e / N[k]);
    const nid = (i, j, k) => (i * (N[1] + 1) + j) * (N[2] + 1) + k;
    const at = (u0, u1, u2) => [cx + E[0][0] * u0 + E[1][0] * u1 + E[2][0] * u2, cy + E[0][1] * u0 + E[1][1] * u1 + E[2][1] * u2, cz + E[0][2] * u0 + E[1][2] * u1 + E[2][2] * u2];
    // cells whose centre lies inside (or just outside, so that thin parts keep a layer)
    const keep = [], hmin = Math.min(...hh);
    for (let i = 0; i < N[0]; i++) for (let j = 0; j < N[1]; j++) for (let k = 0; k < N[2]; k++) {
      const c = at(lo[0] + (i + 0.5) * hh[0], lo[1] + (j + 0.5) * hh[1], lo[2] + (k + 0.5) * hh[2]);
      if (f(c[0], c[1], c[2]) < OPT.keep * hmin) keep.push(i, j, k);
    }
    yield;
    // the kept cells' nodes; those outside the piece are snapped onto its surface
    const g = new Float64Array(4), map = new Map(), X = [], orig = [];
    const node = (i, j, k) => {
      const id = nid(i, j, k);
      let v = map.get(id);
      if (v === undefined) {
        v = X.length / 3; map.set(id, v);
        const p = at(lo[0] + i * hh[0], lo[1] + j * hh[1], lo[2] + k * hh[2]);
        orig.push(...p);
        let q = p;
        if (f(p[0], p[1], p[2]) > 0) {
          for (let it = 0; it < 4; it++) { f.grad(q[0], q[1], q[2], g); q = [q[0] - g[0] * g[1], q[1] - g[0] * g[2], q[2] - g[0] * g[3]]; }
        }
        X.push(...q);
      }
      return v;
    };
    let cells = [];
    for (let c = 0; c < keep.length; c += 3) {
      const i = keep[c], j = keep[c + 1], k = keep[c + 2], ids = [];
      for (let b = 0; b < 8; b++) ids.push(node(i + (b & 1), j + ((b >> 1) & 1), k + ((b >> 2) & 1)));
      cells.push({ ids, odd: (i + j + k) & 1 });
    }
    yield;
    // Snapping can flatten or invert a tet where the surface turns sharply (a cell mostly outside, several
    // corners landing close together): such a cell is dropped. Every node left lies on or inside the piece.
    const Xf = Float64Array.from(X);
    const minV = 0.03 * hh[0] * hh[1] * hh[2];
    // A cell squashed flat by snapping (less than OPT.flat of its volume left) fits its rotation badly: dropped too.
    cells = cells.filter((c) => {
      let vs = 0;
      for (const t of c.odd ? TET_ODD : TET_EVEN) {
        const a = c.ids[t[0]], b = c.ids[t[1]], cc = c.ids[t[2]], d = c.ids[t[3]];
        const v = vol6(Xf, a, b, cc, d), v0 = vol6(orig, a, b, cc, d);
        if (Math.abs(v) < minV || Math.sign(v) !== Math.sign(v0)) return false;
        vs += Math.abs(v);
      }
      return vs >= OPT.flat * 6 * hh[0] * hh[1] * hh[2];
    });
    // re-index the nodes the remaining cells use
    const used = new Int32Array(Xf.length / 3).fill(-1), Xo = [];
    const cellIdx = [], tets = [], cellRind = [];
    for (const c of cells) {
      const ids = c.ids.map((v) => { if (used[v] < 0) { used[v] = Xo.length / 3; Xo.push(Xf[3 * v], Xf[3 * v + 1], Xf[3 * v + 2]); } return used[v]; });
      cellIdx.push(...ids);
      for (const t of c.odd ? TET_ODD : TET_EVEN) tets.push(ids[t[0]], ids[t[1]], ids[t[2]], ids[t[3]]);
      let mx = 0, my = 0, mz = 0;
      for (const v of c.ids) { mx += orig[3 * v]; my += orig[3 * v + 1]; mz += orig[3 * v + 2]; }
      cellRind.push(melon(mx / 8, my / 8, mz / 8) > -(RIND + 0.06) ? 1 : 0);   // the rind is firmer than the flesh
    }
    const tetRind = new Uint8Array(tets.length / 4);
    for (let c = 0; c < cellRind.length; c++) for (let t = 0; t < 5; t++) tetRind[5 * c + t] = cellRind[c];
    return { X: Float32Array.from(Xo), tets: Uint32Array.from(tets), cells: Uint32Array.from(cellIdx), cellRind: Uint8Array.from(cellRind), tetRind, frame: { c: [cx, cy, cz], E, h: hh } };
  }

  // ----- seeds and bubbles near the cut faces -----
  // A seed whose body crosses a cut belongs to the side holding its centre and is eased just under that face.
  function nearFaces(cuts, f) {
    const seeds = [], bubbles = [], SL = 0.095 / 2;
    for (let s = 0; s < SEEDS.length; s += 10) {
      let c = [SEEDS[s], SEEDS[s + 1], SEEDS[s + 2]];
      const X = [SEEDS[s + 3], SEEDS[s + 4], SEEDS[s + 5]], Y = [SEEDS[s + 6], SEEDS[s + 7], SEEDS[s + 8]], sc = SEEDS[s + 9];
      const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
      let near = false, ok = true;
      for (const q of cuts) {
        const d = q[0] * c[0] + q[1] * c[1] + q[2] * c[2] - q[3];   // < 0: on this cut's kept side
        if (d > 0) { ok = false; break; }
        if (d > -SEED_NEAR) near = true;
        // how far the seed reaches along the plane's normal: half its length along X, its half widths along Y, Z
        const reach = sc * (SL * Math.abs(X[0] * q[0] + X[1] * q[1] + X[2] * q[2]) + 0.014 * Math.abs(Y[0] * q[0] + Y[1] * q[1] + Y[2] * q[2]) + 0.03 * Math.abs(Z[0] * q[0] + Z[1] * q[1] + Z[2] * q[2]));
        if (d > -(reach + 0.009)) { const m = d + reach + 0.009; c = [c[0] - q[0] * m, c[1] - q[1] * m, c[2] - q[2] * m]; }   // just under the face
      }
      if (!ok || !near || f(c[0], c[1], c[2]) > -0.02) continue;
      seeds.push(...c, ...X, ...Y, sc);
    }
    for (let b = 0; b < BUBBLES.length; b += 4) {
      let near = false, ok = true;
      for (const q of cuts) {
        const d = q[0] * BUBBLES[b] + q[1] * BUBBLES[b + 1] + q[2] * BUBBLES[b + 2] - q[3];
        if (d > -BUBBLES[b + 3] - 0.005) { ok = false; break; }
        if (d > -BUBBLE_NEAR) near = true;
      }
      if (ok && near) bubbles.push(BUBBLES[b], BUBBLES[b + 1], BUBBLES[b + 2], BUBBLES[b + 3]);
    }
    return { seeds: Float32Array.from(seeds), bubbles: Float32Array.from(bubbles) };
  }

  // ----- a piece, built as a generator: yields often, returns the piece -----
  const ANCHOR = 0.04;   // seed frame anchors: centre, centre + X ANCHOR, centre - Y ANCHOR
  function* buildPiece(cuts, embed, bounds) {
    const f = (x, y, z) => piece(cuts, x, y, z);
    f.grad = (x, y, z, out) => piece(cuts, x, y, z, out);
    const b = bounds || [-A - 0.06, BOTTOM - 0.06, -C - 0.06, A + 0.06, B + 0.06, C + 0.06];
    const skin = yield* surfaceNets(f, b, SURF_H);
    if (skin.index.length === 0) return null;
    const lat = yield* lattice(f, skin);
    const near = cuts.length ? nearFaces(cuts, f) : { seeds: new Float32Array(0), bubbles: new Float32Array(0) };
    yield;
    // embed the skin, the seed anchors and the bubbles, a chunk at a time
    const ns = near.seeds.length / 10, nb = near.bubbles.length / 4, nvS = skin.pos.length / 3;
    const pts = new Float32Array(skin.pos.length + 9 * ns + 3 * nb);
    pts.set(skin.pos);
    for (let i = 0, o = skin.pos.length; i < ns; i++, o += 9) {
      const q = 10 * i, sd = near.seeds;
      for (let k = 0; k < 3; k++) { pts[o + k] = sd[q + k]; pts[o + 3 + k] = sd[q + k] + sd[q + 3 + k] * ANCHOR; pts[o + 6 + k] = sd[q + k] - sd[q + 6 + k] * ANCHOR; }
    }
    for (let i = 0, o = skin.pos.length + 9 * ns; i < nb; i++) { pts[o + 3 * i] = near.bubbles[4 * i]; pts[o + 3 * i + 1] = near.bubbles[4 * i + 1]; pts[o + 3 * i + 2] = near.bubbles[4 * i + 2]; }
    const np = pts.length / 3, idx = new Uint32Array(4 * np), w = new Float32Array(4 * np), CH = 6000;
    for (let s = 0; s < np; s += CH) {
      const e = embed(lat.X, lat.tets, pts.subarray(3 * s, 3 * Math.min(np, s + CH)));
      for (let p = 0; p < e.tet.length; p++) for (let k = 0; k < 4; k++) { idx[4 * (s + p) + k] = lat.tets[4 * e.tet[p] + k]; w[4 * (s + p) + k] = e.w[4 * p + k]; }
      yield;
    }
    // volume, by the divergence theorem over the skin
    let vol = 0;
    const I = skin.index, Q = skin.pos;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], c = 3 * I[t + 1], d = 3 * I[t + 2];
      vol += Q[a] * (Q[c + 1] * Q[d + 2] - Q[c + 2] * Q[d + 1]) - Q[a + 1] * (Q[c] * Q[d + 2] - Q[c + 2] * Q[d]) + Q[a + 2] * (Q[c] * Q[d + 1] - Q[c + 1] * Q[d]);
    }
    return { cuts, volume: vol / 6, render: skin, sim: lat, seeds: near.seeds, bubbles: near.bubbles, emb: { idx, w }, nSkin: nvS };
  }
  /** Run a generator to the end (the first build, the tests). */
  function finish(gen) { let r = gen.next(); while (!r.done) r = gen.next(); return r.value; }

  /** Rest-space box to mesh a new piece in: the parent's skin points on the kept side of the plane, and a margin. */
  function boundsOf(P, plane) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) {
      if (plane && plane[0] * P[i] + plane[1] * P[i + 1] + plane[2] * P[i + 2] - plane[3] > 0.02) continue;
      for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], P[i + k]); b[3 + k] = Math.max(b[3 + k], P[i + k]); }
    }
    for (let k = 0; k < 3; k++) { b[k] -= 0.1; b[3 + k] += 0.1; }
    return b;
  }

  return { A, B, C, BELLY, BELLY_K, SKIN, PITH, RIND, ROUND, BOTTOM, SEEDS, BUBBLES, ANCHOR, OPT, melon, piece, buildPiece, finish, boundsOf };
})();
