// A soft body for any shape given as a signed distance field: the visual surface by surface nets,
// a lattice of tets filling it, and the XPBD solver every cast jelly shares (elastic edges, a volume per
// lattice cell, hard stretch limits, an inversion guard, the ground with friction, a soft grab with twist).
// Pure JS, no DOM. The mould, the bear, the dolphin and the pudding are each an SDF plus a few numbers.
//
// The surface vertices come first, then the bubbles, then o.points (anchors for what rides inside, skinned
// on the GPU like the surface), then o.landmarks (CPU only). np counts the GPU points.

export function rng(s) {   // mulberry32
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clampi = (v, a, b) => (v < a ? a : v > b ? b : v);

// ----- SDF building blocks -----
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);
/** Ellipsoid (a close, well-behaved bound). */
export function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.sqrt(px * px + py * py + pz * pz), k1 = Math.sqrt(px * px / (rx * rx) + py * py / (ry * ry) + pz * pz / (rz * rz));
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}
/** Capsule from a to b with radius r. */
export function cap(x, y, z, ax, ay, az, bx, by, bz, r) {
  const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

export function vertexNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += cx; n[k + 1] += cy; n[k + 2] += cz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
function orientOutward(pos, idx) {   // flips the winding if inside-out; returns the enclosed volume
  let v = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2];
    v += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (v < 0) for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  return Math.abs(v) / 6;
}

/** The visual surface: surface nets on a fine grid (one vertex per cell the surface crosses, one quad
 *  per crossed grid edge), so the mesh is closed. Vertices are snapped onto the zero set, relaxed
 *  twice and snapped again, then each quad is split along its shorter diagonal. */
export function surfaceNets(f, b, h) {
  const nx = Math.ceil((b[3] - b[0]) / h) + 1, ny = Math.ceil((b[4] - b[1]) / h) + 1, nz = Math.ceil((b[5] - b[2]) / h) + 1;
  const at = (i, j, k) => i + nx * (j + ny * k), F = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[at(i, j, k)] = f(b[0] + i * h, b[1] + j * h, b[2] + k * h);
  const cellV = new Int32Array(nx * ny * nz).fill(-1), P = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
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
  const quads = [], cell = (i, j, k) => cellV[at(i, j, k)];
  const quad = (inFirst, a, bb, c, d) => { if (inFirst) quads.push(a, bb, c, d); else quads.push(a, d, c, bb); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {   // x edges
    const f0 = F[at(i, j, k)], f1 = F[at(i + 1, j, k)];
    if ((f0 < 0) !== (f1 < 0)) quad(f0 < 0, cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k));
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {   // y edges
    const f0 = F[at(i, j, k)], f1 = F[at(i, j + 1, k)];
    if ((f0 < 0) !== (f1 < 0)) quad(f0 < 0, cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1));
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {   // z edges
    const f0 = F[at(i, j, k)], f1 = F[at(i, j, k + 1)];
    if ((f0 < 0) !== (f1 < 0)) quad(f0 < 0, cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k));
  }
  const pos = new Float32Array(P), nv = pos.length / 3, e = 0.002;
  const snap = () => {
    for (let v = 0; v < nv; v++) for (let it = 0; it < 3; it++) {
      const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2], d = f(x, y, z);
      const gx = (f(x + e, y, z) - f(x - e, y, z)) / (2 * e), gy = (f(x, y + e, z) - f(x, y - e, z)) / (2 * e), gz = (f(x, y, z + e) - f(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz || 1;
      pos[3 * v] -= d * gx / g2; pos[3 * v + 1] -= d * gy / g2; pos[3 * v + 2] -= d * gz / g2;
    }
  };
  const nbr = Array.from({ length: nv }, () => new Set());
  for (let q = 0; q < quads.length; q += 4) for (let s = 0; s < 4; s++) { const a = quads[q + s], c = quads[q + (s + 1) % 4]; nbr[a].add(c); nbr[c].add(a); }
  snap();
  const tmp = new Float32Array(pos.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let v = 0; v < nv; v++) {
      let sx = 0, sy = 0, sz = 0;
      for (const u of nbr[v]) { sx += pos[3 * u]; sy += pos[3 * u + 1]; sz += pos[3 * u + 2]; }
      const m = nbr[v].size || 1;
      tmp[3 * v] = pos[3 * v] * 0.5 + sx / m * 0.5; tmp[3 * v + 1] = pos[3 * v + 1] * 0.5 + sy / m * 0.5; tmp[3 * v + 2] = pos[3 * v + 2] * 0.5 + sz / m * 0.5;
    }
    pos.set(tmp); snap();
  }
  const d2 = (a, c) => (pos[3 * a] - pos[3 * c]) ** 2 + (pos[3 * a + 1] - pos[3 * c + 1]) ** 2 + (pos[3 * a + 2] - pos[3 * c + 2]) ** 2;
  const index = new Uint32Array(quads.length / 4 * 6);
  for (let q = 0, t = 0; q < quads.length; q += 4) {
    const [a, bb, c, d] = [quads[q], quads[q + 1], quads[q + 2], quads[q + 3]];
    if (d2(a, c) < d2(bb, d)) index.set([a, bb, c, a, c, d], t); else index.set([a, bb, d, bb, c, d], t);
    t += 6;
  }
  const volume = orientOutward(pos, index);
  return { nv, pos, index, nrm: vertexNormals(pos, index), volume };
}

/** A block of tets filling the shape: grid cells split into the 6 tets of a Kuhn subdivision, kept where
 *  the SDF reaches into them (and wherever a point P must ride). Cells only partly inside stay as light
 *  "ghost" volume. The lattice is centred in x and z on the bounds and starts at y0. */
function buildLattice(f, b, y0, h, P) {
  const nx = Math.ceil((b[3] - b[0]) / h), ny = Math.ceil((b[4] - y0) / h), nz = Math.ceil((b[5] - b[2]) / h);
  const x0 = (b[0] + b[3] - nx * h) / 2, z0 = (b[2] + b[5] - nz * h) / 2, C = (i, j, k) => (i * ny + j) * nz + k;
  const keep = new Uint8Array(nx * ny * nz), fill = new Float32Array(nx * ny * nz), S = 4;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (f(x0 + (i + 0.5) * h, y0 + (j + 0.5) * h, z0 + (k + 0.5) * h) > h) continue;
    let c = 0;
    for (let a = 0; a < S; a++) for (let q = 0; q < S; q++) for (let r = 0; r < S; r++) if (f(x0 + (i + (a + 0.5) / S) * h, y0 + (j + (q + 0.5) / S) * h, z0 + (k + (r + 0.5) / S) * h) <= 0) c++;
    fill[C(i, j, k)] = c / (S * S * S);
    if (c) keep[C(i, j, k)] = 1;
  }
  for (let p = 0; p < P.length; p += 3) keep[C(clampi(Math.floor((P[p] - x0) / h), 0, nx - 1), clampi(Math.floor((P[p + 1] - y0) / h), 0, ny - 1), clampi(Math.floor((P[p + 2] - z0) / h), 0, nz - 1))] = 1;
  const nid = new Int32Array((nx + 1) * (ny + 1) * (nz + 1)).fill(-1), X = [];
  const node = (i, j, k) => { const id = (i * (ny + 1) + j) * (nz + 1) + k; if (nid[id] < 0) { nid[id] = X.length / 3; X.push(x0 + i * h, y0 + j * h, z0 + k * h); } return nid[id]; };
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]], permIndex = {};
  PERMS.forEach((p, i) => { permIndex[p[0] * 9 + p[1] * 3 + p[2]] = i; });
  const tets = [], tetFill = [], cellTet = new Int32Array(nx * ny * nz).fill(-1);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (!keep[C(i, j, k)]) continue;
    cellTet[C(i, j, k)] = tets.length / 4;
    // Kuhn split, mirrored in every odd cell along that axis: all tets leaning along one diagonal turn a
    // vertical squash into a sideways shear (a body walks off after landing). Mirrored cells still share
    // face diagonals, so the mesh stays conforming.
    const at = (c) => node(i + ((i & 1) ? 1 - c[0] : c[0]), j + ((j & 1) ? 1 - c[1] : c[1]), k + ((k & 1) ? 1 - c[2] : c[2]));
    for (const p of PERMS) {
      const c1 = [0, 0, 0]; c1[p[0]] = 1;
      const c2 = c1.slice(); c2[p[1]] = 1;
      tets.push(at([0, 0, 0]), at(c1), at(c2), at([1, 1, 1]));
      tetFill.push(fill[C(i, j, k)]);
    }
  }
  const boxD = (u) => Math.max(0, -u, u - 1);
  function embed(x, y, z) {
    const fx = (x - x0) / h, fy = (y - y0) / h, fz = (z - z0) / h;
    const ci = clampi(Math.floor(fx), 0, nx - 1), cj = clampi(Math.floor(fy), 0, ny - 1), ck = clampi(Math.floor(fz), 0, nz - 1);
    let best = -1, bi = 0, bj = 0, bk = 0, bd = Infinity;
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) for (let dk = -2; dk <= 2; dk++) {
      const i = ci + di, j = cj + dj, k = ck + dk;
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz || cellTet[C(i, j, k)] < 0) continue;
      const d = Math.hypot(boxD(fx - i), boxD(fy - j), boxD(fz - k));
      if (d < bd) { bd = d; best = C(i, j, k); bi = i; bj = j; bk = k; }
    }
    if (best < 0) throw new Error('embed: point outside the lattice');
    const fr = [fx - bi, fy - bj, fz - bk].map((v, a) => ([bi, bj, bk][a] & 1) ? 1 - v : v), fc = fr.map((v) => Math.min(1, Math.max(0, v)));
    const o = [0, 1, 2].sort((a, c) => fc[c] - fc[a] || a - c);   // the Kuhn tet whose axis order matches
    return { tet: cellTet[best] + permIndex[o[0] * 9 + o[1] * 3 + o[2]], w: [1 - fr[o[0]], fr[o[0]] - fr[o[1]], fr[o[1]] - fr[o[2]], fr[o[2]]] };
  }
  const fillAt = (x, y, z) => fill[C(clampi(Math.floor((x - x0) / h), 0, nx - 1), clampi(Math.floor((y - y0) / h), 0, ny - 1), clampi(Math.floor((z - z0) / h), 0, nz - 1))];
  return { X: new Float32Array(X), tets: new Uint32Array(tets), tetFill: new Float32Array(tetFill), embed, fillAt };
}

/**
 * o: { sdf(x, y, z) (negative inside, resting on y = 0), bounds: [x0, y0, z0, x1, y1, z1] (the lattice),
 *      surfBounds? (the surface-nets grid; keep its planes off any flat face), latticeY0? (default bounds[1]),
 *      h (lattice cell), surfH (surface cell), density (g/cm^3), unitCm (cm per unit),
 *      alpha0? (edge compliance at firmness 50), flex?(x, y, z) -> extra compliance (0 = as stiff as the rest),
 *      bubbles?: { count, depth, rMin, rMax } | [{ c, r }], points?: [[x, y, z]], landmarks?: [[x, y, z]],
 *      ground?(x, z) -> floor height, upY? (rest height that splits top from bottom for upAxis),
 *      reach?, wall?, leash?, grabRadius?, drop? (how high a dropped reset starts), roll?, flipHop?, seed? }
 */
export function createSdfBody(o) {
  const { sdf, bounds: B, h, surfH } = o;
  const SUB = 6, DT = 1 / 120;
  const WALL = o.wall ?? 3.2, REACH = o.reach ?? 1.8, LEASH = o.leash ?? 0.9;
  const ground = o.ground || (() => 0);
  const G_PER_U3 = o.density * o.unitCm ** 3;
  const UJ_PER_MV2 = 0.5 * o.density * 1e3 * (o.unitCm / 100) ** 3 * (o.unitCm / 100) ** 2 * 1e6;   // 0.5 m v^2 -> uJ
  const rand = rng(o.seed ?? 0x5eed), jitter = rng(o.tapSeed ?? 1);   // where the taps land: the page passes a fresh seed, tests a fixed one

  const surf = surfaceNets(sdf, o.surfBounds || B, surfH);
  const bubbles = Array.isArray(o.bubbles) ? o.bubbles.slice() : [];
  if (o.bubbles && !Array.isArray(o.bubbles)) {
    const q = o.bubbles;
    for (let tries = 0; bubbles.length < q.count && tries < q.count * 400; tries++) {
      const x = B[0] + rand() * (B[3] - B[0]), y = B[1] + rand() * (B[4] - B[1]), z = B[2] + rand() * (B[5] - B[2]);
      const r = q.rMin + (q.rMax - q.rMin) * rand() * rand();
      if (sdf(x, y, z) < -(q.depth + r)) bubbles.push({ c: [x, y, z], r });
    }
  }
  const extra = o.points || [], marks = o.landmarks || [];
  const nv = surf.nv, NB = bubbles.length, pointBase = nv + NB, np = pointBase + extra.length, NL = marks.length;
  const pts = new Float32Array((np + NL) * 3);
  pts.set(surf.pos);
  bubbles.forEach((q, i) => pts.set(q.c, 3 * (nv + i)));
  extra.forEach((p, i) => pts.set(p, 3 * (pointBase + i)));
  marks.forEach((p, i) => pts.set(p, 3 * (np + i)));
  const L = buildLattice(sdf, B, o.latticeY0 ?? B[1], h, pts);
  const embI = new Uint32Array((np + NL) * 4), embW = new Float32Array((np + NL) * 4);
  for (let p = 0; p < np + NL; p++) {
    const e = L.embed(pts[3 * p], pts[3 * p + 1], pts[3 * p + 2]);
    for (let k = 0; k < 4; k++) { embI[4 * p + k] = L.tets[4 * e.tet + k]; embW[4 * p + k] = e.w[k]; }
  }
  const tri = surf.index, adjOff = new Uint32Array(nv + 1);   // vertex -> triangles (CSR), for GPU normals
  for (let t = 0; t < tri.length; t++) adjOff[tri[t] + 1]++;
  for (let i = 0; i < nv; i++) adjOff[i + 1] += adjOff[i];
  const adjTri = new Uint32Array(tri.length), cur = adjOff.slice(0, nv);
  for (let t = 0; t < tri.length; t++) adjTri[cur[tri[t]]++] = (t / 3) | 0;

  // ----- soft body -----
  const X0 = L.X, T4 = L.tets, n = X0.length / 3, nt = T4.length / 4;
  const x = new Float32Array(X0), pr = new Float32Array(X0), xs = new Float32Array(X0), v = new Float32Array(3 * n);
  const mass = new Float32Array(n), w = new Float32Array(n), V0 = new Float32Array(nt);
  function tetVol(P, t) {
    const a = 3 * T4[4 * t], b = 3 * T4[4 * t + 1], c = 3 * T4[4 * t + 2], d = 3 * T4[4 * t + 3];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const wx = P[d] - P[a], wy = P[d + 1] - P[a + 1], wz = P[d + 2] - P[a + 2];
    return ((uy * vz - uz * vy) * wx + (uz * vx - ux * vz) * wy + (ux * vy - uy * vx) * wz) / 6;
  }
  let restVolW = 0, totalMass = 0;
  for (let t = 0; t < nt; t++) {
    const V = tetVol(X0, t); V0[t] = V;
    const m = Math.abs(V) * Math.max(L.tetFill[t], 0.08);   // ghost cells carry little mass
    for (let k = 0; k < 4; k++) mass[T4[4 * t + k]] += m / 4;
    restVolW += Math.abs(V) * L.tetFill[t];
  }
  for (let i = 0; i < n; i++) { w[i] = 1 / mass[i]; totalMass += mass[i]; }
  const pairs = [0, 1, 0, 2, 0, 3, 1, 2, 1, 3, 2, 3], seen = new Set(), el = [];
  for (let t = 0; t < nt; t++) for (let p = 0; p < 12; p += 2) {
    const a = T4[4 * t + pairs[p]], b = T4[4 * t + pairs[p + 1]], lo = Math.min(a, b), hi = Math.max(a, b), key = lo * 65536 + hi;
    if (!seen.has(key)) { seen.add(key); el.push(lo, hi); }
  }
  const E = new Uint32Array(el), ne = E.length / 2, L0 = new Float32Array(ne), invK = new Float32Array(ne);
  for (let e = 0; e < ne; e++) {
    const a = 3 * E[2 * e], b = 3 * E[2 * e + 1], mx = (X0[a] + X0[b]) / 2, my = (X0[a + 1] + X0[b + 1]) / 2, mz = (X0[a + 2] + X0[b + 2]) / 2;
    L0[e] = Math.hypot(X0[a] - X0[b], X0[a + 1] - X0[b + 1], X0[a + 2] - X0[b + 2]);
    invK[e] = (1 + (o.flex ? o.flex(mx, my, mz) : 0)) / (0.4 + 0.6 * L.fillAt(mx, my, mz));   // ghost edges (and flexible parts) are softer
  }

  const params = { firm: 50, damp: 25, grav: 11 };
  let alpha = 0, kd = 0;
  const alpha0 = o.alpha0 ?? 0.022;
  function setFirmness(f) { params.firm = f; alpha = alpha0 * Math.pow(10, -(f - 50) / 90); }
  function setDamping(d) { params.damp = d; kd = 0.006 + 0.9 * Math.pow(d / 100, 1.6); }   // small floor: never rings forever
  setFirmness(params.firm); setDamping(params.damp);

  // ----- grab: a soft multi-node handle with twist -----
  const grab = { on: false, ids: new Uint32Array(0), wts: new Float32Array(0), off: new Float32Array(0), goal: [0, 0, 0], tgt: [0, 0, 0], axis: [1, 0, 0], ang: 0 };
  function centroid() {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += x[3 * i] * mass[i]; cy += x[3 * i + 1] * mass[i]; cz += x[3 * i + 2] * mass[i]; }
    return [cx / totalMass, cy / totalMass, cz / totalMass];
  }
  function grabStart(p, radius = o.grabRadius ?? 0.24) {
    const ids = [], wts = [];
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(x[3 * i] - p[0], x[3 * i + 1] - p[1], x[3 * i + 2] - p[2]);
      if (d < bd) { bd = d; best = i; }
      if (d < radius) { const q = 1 - (d / radius) ** 2; ids.push(i); wts.push(q * q); }
    }
    if (!ids.length) { ids.push(best); wts.push(1); }
    grab.ids = Uint32Array.from(ids); grab.wts = Float32Array.from(wts); grab.off = new Float32Array(ids.length * 3);
    ids.forEach((i, j) => { for (let k = 0; k < 3; k++) grab.off[3 * j + k] = x[3 * i + k] - p[k]; });
    const c = centroid(), ax = [c[0] - p[0], c[2] - p[2]], l = Math.hypot(ax[0], ax[1]);
    grab.axis = l > 0.05 ? [ax[0] / l, 0, ax[1] / l] : [1, 0, 0];
    grab.ang = 0; grab.goal = p.slice(); grab.tgt = p.slice(); grab.on = true;
  }
  function grabMove(p) {
    grab.goal = [Math.max(-REACH, Math.min(REACH, p[0])), Math.max(0.02, Math.min(REACH + 0.6, p[1])), Math.max(-REACH, Math.min(REACH, p[2]))];
  }
  function grabTwist(a) { grab.ang = Math.max(-1.3, Math.min(1.3, a)); }
  function grabEnd() {
    grab.on = false;
    for (let i = 0; i < 3 * n; i += 3) {   // tame flings so the body stays in the studio
      const s = Math.hypot(v[i], v[i + 1], v[i + 2]);
      if (s > 5) { const k = 5 / s; v[i] *= k; v[i + 1] *= k; v[i + 2] *= k; }
    }
  }
  function solveGrab() {
    const t = grab.tgt, gl = grab.goal, ids = grab.ids, off = grab.off, wts = grab.wts;
    for (let k = 0; k < 3; k++) t[k] += (gl[k] - t[k]) * 0.08;   // low-pass pointer jumps across substeps
    let px = 0, py = 0, pz = 0, ws = 0;   // leash: the handle leads the held patch by at most LEASH
    for (let j = 0; j < ids.length; j++) { const i = 3 * ids[j], q = wts[j]; px += (x[i] - off[3 * j]) * q; py += (x[i + 1] - off[3 * j + 1]) * q; pz += (x[i + 2] - off[3 * j + 2]) * q; ws += q; }
    px /= ws; py /= ws; pz /= ws;
    let lx = t[0] - px, ly = t[1] - py, lz = t[2] - pz;
    const ll = Math.hypot(lx, ly, lz);
    if (ll > LEASH) { const k = LEASH / ll; lx *= k; ly *= k; lz *= k; }
    const tx = px + lx, ty = py + ly, tz = pz + lz;
    const c = Math.cos(grab.ang), s = Math.sin(grab.ang), [kx, ky, kz] = grab.axis;
    for (let j = 0; j < ids.length; j++) {
      const ox = off[3 * j], oy = off[3 * j + 1], oz = off[3 * j + 2], d = kx * ox + ky * oy + kz * oz;
      const rx = ox * c + (ky * oz - kz * oy) * s + kx * d * (1 - c);
      const ry = oy * c + (kz * ox - kx * oz) * s + ky * d * (1 - c);
      const rz = oz * c + (kx * oy - ky * ox) * s + kz * d * (1 - c);
      const i = 3 * ids[j], f = 0.25 * wts[j];
      x[i] += (tx + rx - x[i]) * f; x[i + 1] += (ty + ry - x[i + 1]) * f; x[i + 2] += (tz + rz - x[i + 2]) * f;
    }
  }

  // ----- XPBD: edges (elastic connections), per-cell volume, stretch limits, inversion guard, ground -----
  function solveEdges(hs) {
    const a0 = alpha / (hs * hs);
    for (let e = 0; e < ne; e++) {
      const ia = E[2 * e], ib = E[2 * e + 1], a = 3 * ia, b = 3 * ib;
      let dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      dx /= len; dy /= len; dz /= len;
      const wa = w[ia], wb = w[ib];
      const dl = -(len - L0[e]) / (wa + wb + a0 * invK[e]);
      x[a] += dx * dl * wa; x[a + 1] += dy * dl * wa; x[a + 2] += dz * dl * wa;
      x[b] -= dx * dl * wb; x[b + 1] -= dy * dl * wb; x[b + 2] -= dz * dl * wb;
    }
  }
  // One volume constraint per lattice cell (6 tets): per-tet hard constraints outnumber the degrees
  // of freedom and lock the mesh; per cell keeps the volume and leaves shear free to wobble.
  const gr = new Float32Array(12), ord = [1, 3, 2, 0, 2, 3, 0, 3, 1, 0, 1, 2];
  const nc = nt / 6, sg = new Float32Array(nt), V0c = new Float32Array(nc);
  for (let t = 0; t < nt; t++) { sg[t] = Math.sign(V0[t]); V0c[(t / 6) | 0] += Math.abs(V0[t]); }
  function tetGrad(t, s) {
    for (let j = 0; j < 4; j++) {
      const p0 = 3 * T4[4 * t + ord[3 * j]], p1 = 3 * T4[4 * t + ord[3 * j + 1]], p2 = 3 * T4[4 * t + ord[3 * j + 2]];
      const ux = x[p1] - x[p0], uy = x[p1 + 1] - x[p0 + 1], uz = x[p1 + 2] - x[p0 + 2];
      const vx = x[p2] - x[p0], vy = x[p2 + 1] - x[p0 + 1], vz = x[p2 + 2] - x[p0 + 2];
      gr[3 * j] = s * (uy * vz - uz * vy) / 6; gr[3 * j + 1] = s * (uz * vx - ux * vz) / 6; gr[3 * j + 2] = s * (ux * vy - uy * vx) / 6;
    }
  }
  // Hard limits: no edge longer than 1.8x or shorter than 0.4x its rest length, however hard the pull.
  function limitEdges() {
    for (let e = 0; e < ne; e++) {
      const ia = E[2 * e], ib = E[2 * e + 1], a = 3 * ia, b = 3 * ib;
      const dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2];
      const l2 = dx * dx + dy * dy + dz * dz, Lr = L0[e];
      let target;
      if (l2 > 3.24 * Lr * Lr) target = 1.8 * Lr; else if (l2 < 0.16 * Lr * Lr) target = 0.4 * Lr; else continue;
      const len = Math.sqrt(l2);
      if (len < 1e-9) continue;
      const wa = w[ia], wb = w[ib], k = (len - target) / (len * (wa + wb));
      x[a] -= dx * k * wa; x[a + 1] -= dy * k * wa; x[a + 2] -= dz * k * wa;
      x[b] += dx * k * wb; x[b + 1] += dy * k * wb; x[b + 2] += dz * k * wb;
    }
  }
  // each cell's corners (at most 8) and each tet's corners as indices into them, worked out once
  const cellN = new Uint8Array(nc), cellNode = new Uint32Array(8 * nc), tetLoc = new Uint8Array(4 * nt), Gc = new Float64Array(24);
  for (let c = 0; c < nc; c++) for (let t = 6 * c; t < 6 * c + 6; t++) for (let j = 0; j < 4; j++) {
    const i = T4[4 * t + j];
    let k = 0;
    while (k < cellN[c] && cellNode[8 * c + k] !== i) k++;
    if (k === cellN[c]) cellNode[8 * c + cellN[c]++] = i;
    tetLoc[4 * t + j] = k;
  }
  function solveVolumes(hs) {
    const at = 1e-5 / (hs * hs);   // slightly compliant: livelier, ~1% volume error
    for (let c = 0; c < nc; c++) {
      const m = cellN[c], cn = 8 * c;
      let vol = 0;
      for (let k = 0; k < 3 * m; k++) Gc[k] = 0;
      for (let t = 6 * c; t < 6 * c + 6; t++) {
        // the volume's gradient at each corner: b, c, d from the faces opposite them, a from the other three (they sum to 0)
        const t4 = 4 * t, s = sg[t] / 6, a = 3 * T4[t4], b = 3 * T4[t4 + 1], cc = 3 * T4[t4 + 2], d = 3 * T4[t4 + 3];
        const ax = x[a], ay = x[a + 1], az = x[a + 2];
        const ux = x[b] - ax, uy = x[b + 1] - ay, uz = x[b + 2] - az;
        const vx = x[cc] - ax, vy = x[cc + 1] - ay, vz = x[cc + 2] - az;
        const wx = x[d] - ax, wy = x[d + 1] - ay, wz = x[d + 2] - az;
        const gbx = s * (vy * wz - vz * wy), gby = s * (vz * wx - vx * wz), gbz = s * (vx * wy - vy * wx);
        const gcx = s * (wy * uz - wz * uy), gcy = s * (wz * ux - wx * uz), gcz = s * (wx * uy - wy * ux);
        const gdx = s * (uy * vz - uz * vy), gdy = s * (uz * vx - ux * vz), gdz = s * (ux * vy - uy * vx);
        vol += gdx * wx + gdy * wy + gdz * wz;
        let q = 3 * tetLoc[t4];
        Gc[q] -= gbx + gcx + gdx; Gc[q + 1] -= gby + gcy + gdy; Gc[q + 2] -= gbz + gcz + gdz;
        q = 3 * tetLoc[t4 + 1]; Gc[q] += gbx; Gc[q + 1] += gby; Gc[q + 2] += gbz;
        q = 3 * tetLoc[t4 + 2]; Gc[q] += gcx; Gc[q + 1] += gcy; Gc[q + 2] += gcz;
        q = 3 * tetLoc[t4 + 3]; Gc[q] += gdx; Gc[q + 1] += gdy; Gc[q + 2] += gdz;
      }
      let wsum = 0;
      for (let k = 0; k < m; k++) { const q = 3 * k; wsum += w[cellNode[cn + k]] * (Gc[q] * Gc[q] + Gc[q + 1] * Gc[q + 1] + Gc[q + 2] * Gc[q + 2]); }
      const dl = wsum > 1e-14 ? -(vol - V0c[c]) / (wsum + at) : 0;
      for (let k = 0; k < m; k++) {
        const i = cellNode[cn + k], p = 3 * i, q = 3 * k, sk = dl * w[i];
        x[p] += Gc[q] * sk; x[p + 1] += Gc[q + 1] * sk; x[p + 2] += Gc[q + 2] * sk;
      }
    }
  }
  function guardInversion() {   // only acts when a tet is crushed below 40% of its rest volume
    for (let t = 0; t < nt; t++) {
      const V = sg[t] * tetVol(x, t), lim = 0.4 * Math.abs(V0[t]);
      if (V >= lim) continue;
      tetGrad(t, sg[t]);
      let wsum = 0;
      for (let j = 0; j < 4; j++) wsum += w[T4[4 * t + j]] * (gr[3 * j] ** 2 + gr[3 * j + 1] ** 2 + gr[3 * j + 2] ** 2);
      if (wsum < 1e-14) continue;
      const dl = -(V - lim) / wsum;
      for (let j = 0; j < 4; j++) { const i = T4[4 * t + j], q = 3 * i, s = dl * w[i]; x[q] += gr[3 * j] * s; x[q + 1] += gr[3 * j + 1] * s; x[q + 2] += gr[3 * j + 2] * s; }
    }
  }
  function collide() {
    const mu = 0.55;
    for (let i = 0; i < 3 * n; i += 3) {
      const gy = ground(x[i], x[i + 2]);
      if (x[i + 1] < gy) {   // ground with Coulomb-style position friction
        const pen = gy - x[i + 1];
        x[i + 1] = gy;
        const dx = x[i] - pr[i], dz = x[i + 2] - pr[i + 2], d = Math.hypot(dx, dz);
        if (d < 0.5 * mu * pen) { x[i] = pr[i]; x[i + 2] = pr[i + 2]; }
        else if (d > 0) { const s = mu * pen / d; x[i] -= dx * s; x[i + 2] -= dz * s; }
      }
      if (x[i] > WALL) x[i] = WALL; else if (x[i] < -WALL) x[i] = -WALL;
      if (x[i + 2] > WALL) x[i + 2] = WALL; else if (x[i + 2] < -WALL) x[i + 2] = -WALL;
      if (x[i + 1] > 3.6) x[i + 1] = 3.6;
    }
  }
  // Internal damping acts on velocities only (relative speed along each edge), so it calms the
  // wobble without changing the shape the body rests in. Damping inside XPBD made it sag more.
  function dampEdges() {
    for (let e = 0; e < ne; e++) {
      const ia = E[2 * e], ib = E[2 * e + 1], a = 3 * ia, b = 3 * ib;
      let dx = x[a] - x[b], dy = x[a + 1] - x[b + 1], dz = x[a + 2] - x[b + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      dx /= len; dy /= len; dz /= len;
      const wa = w[ia], wb = w[ib], ws = wa + wb;
      if (ws < 1e-12) continue;
      const dl = -kd * (dx * (v[a] - v[b]) + dy * (v[a + 1] - v[b + 1]) + dz * (v[a + 2] - v[b + 2])) / ws;
      v[a] += dx * dl * wa; v[a + 1] += dy * dl * wa; v[a + 2] += dz * dl * wa;
      v[b] -= dx * dl * wb; v[b + 1] -= dy * dl * wb; v[b + 2] -= dz * dl * wb;
    }
  }
  function substep(hs) {
    const gh = params.grav * hs;
    for (let i = 0; i < 3 * n; i += 3) {
      v[i + 1] -= gh;
      pr[i] = x[i]; pr[i + 1] = x[i + 1]; pr[i + 2] = x[i + 2];
      x[i] += v[i] * hs; x[i + 1] += v[i + 1] * hs; x[i + 2] += v[i + 2] * hs;
    }
    if (grab.on) solveGrab();
    solveEdges(hs);
    solveVolumes(hs);
    limitEdges();
    guardInversion();
    collide();
    guardInversion();
    const ih = (1 - 0.2 * hs) / hs, vmax2 = 144;
    for (let i = 0; i < 3 * n; i += 3) {
      let vx = (x[i] - pr[i]) * ih, vy = (x[i + 1] - pr[i + 1]) * ih, vz = (x[i + 2] - pr[i + 2]) * ih;
      const s2 = vx * vx + vy * vy + vz * vz;
      if (s2 > vmax2) { const k = Math.sqrt(vmax2 / s2); vx *= k; vy *= k; vz *= k; }
      v[i] = vx; v[i + 1] = vy; v[i + 2] = vz;
    }
    dampEdges();
  }
  /** Lowest point above the ground (0: touching). */
  function clearance() {
    let low = Infinity;
    for (let i = 0; i < 3 * n; i += 3) { const c = x[i + 1] - ground(x[i], x[i + 2]); if (c < low) low = c; }
    return low;
  }
  // Rolling resistance: a gummy is tacky and squashes where it touches, so rocking on a round side dies
  // away instead of cradling for ever. While it rests on the ground, bleed off part of its rigid spin
  // (about the centre of mass, so momentum is kept); the jiggle inside is left alone.
  const ROLL = 1 - Math.exp(-(o.roll ?? 1.6) * DT);
  /** The rigid spin about the centre of mass: [cx, cy, cz, wx, wy, wz], or null when degenerate. */
  function rigidSpin() {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { const m = mass[i]; cx += x[3 * i] * m; cy += x[3 * i + 1] * m; cz += x[3 * i + 2] * m; }
    cx /= totalMass; cy /= totalMass; cz /= totalMass;
    let Lx = 0, Ly = 0, Lz = 0, Ixx = 0, Iyy = 0, Izz = 0, Ixy = 0, Ixz = 0, Iyz = 0;
    for (let i = 0; i < n; i++) {
      const m = mass[i], rx = x[3 * i] - cx, ry = x[3 * i + 1] - cy, rz = x[3 * i + 2] - cz, vx = v[3 * i], vy = v[3 * i + 1], vz = v[3 * i + 2];
      Lx += m * (ry * vz - rz * vy); Ly += m * (rz * vx - rx * vz); Lz += m * (rx * vy - ry * vx);
      Ixx += m * (ry * ry + rz * rz); Iyy += m * (rx * rx + rz * rz); Izz += m * (rx * rx + ry * ry);
      Ixy -= m * rx * ry; Ixz -= m * rx * rz; Iyz -= m * ry * rz;
    }
    const a = Iyy * Izz - Iyz * Iyz, b = Ixz * Iyz - Ixy * Izz, c = Ixy * Iyz - Iyy * Ixz;   // cofactors: omega = I^-1 L
    const d = Ixx * Izz - Ixz * Ixz, e = Ixy * Ixz - Ixx * Iyz, f = Ixx * Iyy - Ixy * Ixy, det = Ixx * a + Ixy * b + Ixz * c;
    if (!(det > 1e-12)) return null;
    return [cx, cy, cz, (a * Lx + b * Ly + c * Lz) / det, (b * Lx + d * Ly + e * Lz) / det, (c * Lx + e * Ly + f * Lz) / det];
  }
  function rollResist() {
    if (grab.on || clearance() > 0.004) return;
    const w = rigidSpin();
    if (!w) return;
    const [cx, cy, cz] = w, wx = ROLL * w[3], wy = ROLL * w[4], wz = ROLL * w[5];
    for (let i = 0; i < n; i++) {
      const rx = x[3 * i] - cx, ry = x[3 * i + 1] - cy, rz = x[3 * i + 2] - cz;
      v[3 * i] -= wy * rz - wz * ry; v[3 * i + 1] -= wz * rx - wx * rz; v[3 * i + 2] -= wx * ry - wy * rx;
    }
  }
  let acc = 0;
  function step() {
    xs.set(x);
    for (let s = 0; s < SUB; s++) substep(DT / SUB);
    rollResist();
    for (let i = 0; i < 3 * n; i++) if (!Number.isFinite(x[i])) { reset(false); return; }
  }
  function advance(realDt, speed) {   // fixed timestep accumulator, at most 4 steps per frame
    acc = Math.min(acc + realDt * speed, DT * 4);
    const t0 = performance.now();
    let k = 0;
    while (acc >= DT && k < 4) {
      // past ~10 ms of steps in one frame the machine cannot keep up: drop the debt and run a little slow,
      // rather than take ever more steps a frame and stall (4 steps a frame on a slow CPU is ~20 fps)
      if (k && performance.now() - t0 > 10) { acc %= DT; break; }
      step(); acc -= DT; k++;
    }
    return k;
  }
  function renderNodes(out) {   // interpolate between the last two fixed steps
    const a = Math.min(1, acc / DT);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) out[4 * i + k] = xs[3 * i + k] + (x[3 * i + k] - xs[3 * i + k]) * a;
    return out;
  }
  const upY = o.upY ?? (B[1] + B[4]) / 2;
  function reset(drop) {
    const tz = drop ? 0.02 : 0, tx = drop ? -0.015 : 0, cy = upY;
    const cz = Math.cos(tz), sz = Math.sin(tz), cx = Math.cos(tx), sx = Math.sin(tx);
    let ymin = Infinity;
    for (let i = 0; i < n; i++) {
      let px = X0[3 * i], py = X0[3 * i + 1] - cy, pz = X0[3 * i + 2];
      [px, py] = [px * cz - py * sz, px * sz + py * cz];
      [py, pz] = [py * cx - pz * sx, py * sx + pz * cx];
      x[3 * i] = px; x[3 * i + 1] = py; x[3 * i + 2] = pz; ymin = Math.min(ymin, py);
    }
    const lift = (drop ? (o.drop ?? 0.22) : 0) - ymin + ground(0, 0);
    for (let i = 0; i < n; i++) x[3 * i + 1] += lift;
    pr.set(x); xs.set(x); v.fill(0); grab.on = false; acc = 0;
  }
  function nudge(s = 1) {   // a hop with a little spin, only when resting on the ground (no pumping)
    let vy = 0;
    for (let i = 0; i < n; i++) vy += v[3 * i + 1] * mass[i];
    if (clearance() > 0.03 || Math.abs(vy / totalMass) > 0.25) return false;   // already hopping: no pumping
    const w = rigidSpin();
    if (w && Math.hypot(w[3], w[5]) > 1) return false;   // still rocking (rad/s): a tap now could tip it over
    const c = centroid(), px = c[0] + (jitter() - 0.5) * 0.8, pz = c[2] + (jitter() - 0.5) * 0.8, spin = (jitter() - 0.5) * 2.2;
    for (let i = 0; i < n; i++) {
      const dx = x[3 * i] - px, dz = x[3 * i + 2] - pz, f = Math.exp(-(dx * dx + dz * dz) / 0.08);
      v[3 * i + 1] += s * (1.9 - 3.0 * f);
      v[3 * i] += -s * spin * (x[3 * i + 2] - c[2]) * 0.8;
      v[3 * i + 2] += s * spin * (x[3 * i] - c[0]) * 0.8;
    }
    return true;
  }
  /** Turn it over: a hop, then (once it is clear of the ground) a half turn about a horizontal axis. */
  function flipHop() {
    if (clearance() > 0.05) return false;
    for (let i = 1; i < 3 * n; i += 3) v[i] += o.flipHop ?? 5.6;
    return true;
  }
  function flipSpin(axis, omega) {
    const c = centroid(), [ax, , az] = axis;
    for (let i = 0; i < n; i++) {   // v += omega * (axis x (x - c)), axis horizontal
      const dx = x[3 * i] - c[0], dy = x[3 * i + 1] - c[1], dz = x[3 * i + 2] - c[2];
      v[3 * i] += omega * (-az * dy);
      v[3 * i + 1] += omega * (az * dx - ax * dz);
      v[3 * i + 2] += omega * (ax * dy);
    }
  }

  // ----- queries -----
  const sp = new Float32Array(nv * 3);
  function surfacePositions() {
    for (let p = 0; p < nv; p++) {
      let px = 0, py = 0, pz = 0;
      for (let k = 0; k < 4; k++) { const q = 3 * embI[4 * p + k], wk = embW[4 * p + k]; px += x[q] * wk; py += x[q + 1] * wk; pz += x[q + 2] * wk; }
      sp[3 * p] = px; sp[3 * p + 1] = py; sp[3 * p + 2] = pz;
    }
    return sp;
  }
  /** Ray against the deformed visual surface (Moller-Trumbore). */
  function pick(ro, rd) {
    surfacePositions();
    let best = Infinity;
    for (let t = 0; t < tri.length; t += 3) {
      const a = 3 * tri[t], b = 3 * tri[t + 1], c = 3 * tri[t + 2];
      const e1x = sp[b] - sp[a], e1y = sp[b + 1] - sp[a + 1], e1z = sp[b + 2] - sp[a + 2];
      const e2x = sp[c] - sp[a], e2y = sp[c + 1] - sp[a + 1], e2z = sp[c + 2] - sp[a + 2];
      const px = rd[1] * e2z - rd[2] * e2y, py = rd[2] * e2x - rd[0] * e2z, pz = rd[0] * e2y - rd[1] * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const id = 1 / det, tx = ro[0] - sp[a], ty = ro[1] - sp[a + 1], tz = ro[2] - sp[a + 2];
      const u = (tx * px + ty * py + tz * pz) * id;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const vv = (rd[0] * qx + rd[1] * qy + rd[2] * qz) * id;
      if (vv < 0 || u + vv > 1) continue;
      const d = (e2x * qx + e2y * qy + e2z * qz) * id;
      if (d > 0 && d < best) best = d;
    }
    return best < Infinity ? [ro[0] + rd[0] * best, ro[1] + rd[1] * best, ro[2] + rd[2] * best] : null;
  }
  function stats() {
    let V = 0, ke = 0;
    for (let t = 0; t < nt; t++) V += tetVol(x, t) * sg[t] * L.tetFill[t];
    for (let i = 0; i < n; i++) ke += mass[i] * (v[3 * i] ** 2 + v[3 * i + 1] ** 2 + v[3 * i + 2] ** 2);
    return { massG: restVolW * G_PER_U3, relVol: V / restVolW, keUJ: ke * UJ_PER_MV2 * (restVolW / totalMass) };
  }
  function edgeStrain() {
    let s2 = 0, mx = 0;
    for (let e = 0; e < ne; e++) {
      const a = 3 * E[2 * e], b = 3 * E[2 * e + 1];
      const d = Math.hypot(x[a] - x[b], x[a + 1] - x[b + 1], x[a + 2] - x[b + 2]) / L0[e] - 1;
      s2 += d * d; mx = Math.max(mx, Math.abs(d));
    }
    return { rms: Math.sqrt(s2 / ne), max: mx };
  }
  /** An embedded point (surface, bubble, anchor or landmark index), skinned like the surface. */
  function pointAt(p, out = [0, 0, 0]) {
    out[0] = out[1] = out[2] = 0;
    for (let q = 0; q < 4; q++) { const k = 3 * embI[4 * p + q], wq = embW[4 * p + q]; out[0] += x[k] * wq; out[1] += x[k + 1] * wq; out[2] += x[k + 2] * wq; }
    return out;
  }
  const landmark = (k, out) => pointAt(np + k, out);
  /** Horizontal direction from landmark 0 to landmark 1 (the flip axis), when the shape gives two. */
  const longAxis = NL >= 2 ? () => {
    const a = landmark(0), b = landmark(1), dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1;
    return [dx / l, 0, dz / l];
  } : undefined;
  function invertedCount() { let c = 0; for (let t = 0; t < nt; t++) if (tetVol(x, t) * V0[t] <= 0) c++; return c; }
  /** Up axis of the body: the average rest-up direction carried by the surface vertices above upY. */
  function upAxis() {
    surfacePositions();
    const c = centroid();
    let ux = 0, uy = 0, uz = 0;
    for (let p = 0; p < nv; p++) { const s = surf.pos[3 * p + 1] > upY ? 1 : -1; ux += s * (sp[3 * p] - c[0]); uy += s * (sp[3 * p + 1] - c[1]); uz += s * (sp[3 * p + 2] - c[2]); }
    const l = Math.hypot(ux, uy, uz) || 1;
    return [ux / l, uy / l, uz / l];
  }

  reset(false);
  return {
    n, nt, ne, nv, np, NB, pointBase, surf, bubbles, embI, embW, adjOff, adjTri, E, x, v, params, DT,
    get grabbing() { return grab.on },
    setFirmness, setDamping, advance, step, renderNodes, reset, nudge, flipHop, flipSpin, clearance,
    grabStart, grabMove, grabTwist, grabEnd, pick, centroid, stats, edgeStrain, invertedCount, surfacePositions, upAxis, pointAt, landmark, longAxis,
  };
}
