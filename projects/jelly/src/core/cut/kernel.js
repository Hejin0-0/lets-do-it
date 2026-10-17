// The cut kernel every slice-shaped jelly shares (the melon and citrus slices, the press's fruits).
//
// Every piece of jelly is a region of one shared rest plane (x right, z up the slice), extruded
// through the thickness 0 <= y <= T. A region is { mask: Uint8Array(N), field: Float32Array(N) } on
// GRID, where field is a signed distance (negative inside). The kernel owns the 2D toolkit (EDT,
// morphology, contours, Delaunay), the region booleans for straight, wavy and cookie-cutter cuts, and
// the per-piece meshing (render surface, tet sim mesh). A specimen gives its slice's SDF and what
// rides inside a piece (seeds, membranes, bubbles).

/**
 * spec: { T, ROUND, MIN_AREA, BEVEL, GRID: { h, X0, Z0, NX, NZ, N }, sliceSdf(x, z),
 *         inclusions?(field, kernel) -> { seeds?, membranes?, bubbles? } merged into each piece,
 *         FILLET_RINGS? (4), NEAR?, KERF?, WAVE_A?, WAVE_L?, WAVE_ROUND?, SHAPE_ROUND? }
 */
export function createSliceKernel(spec) {
  const PI = Math.PI;

  /* ================================ Constants ================================ */

  const { T, ROUND, MIN_AREA, BEVEL, GRID, sliceSdf, inclusions = () => ({}) } = spec;
  const {
    NEAR = 0.25,                // rounding only changes cells this close to the new cut (Infinity: all)
    KERF = 0.03,                // gap a straight blade leaves
    WAVE_A = 0.036, WAVE_L = 0.28,   // crinkle blade: amplitude and wavelength of its corrugation
    WAVE_ROUND = 0.026,         // tight rounding of crinkle cuts (a crest's own radius is ~0.055)
    SHAPE_ROUND = ROUND + 0.03, // corner radius of the cookie-cutter shapes (see makeShape)
    FILLET_RINGS = 4,           // rings per fillet (excluding the wall ring)
  } = spec;

  // Meshing parameters.
  const RIM_STEP = 0.03;        // outline resampling (render)
  const MERGE = 0.4 * RIM_STEP; // inset rim points closer than this are merged
  const CAP_LAT = 0.09;         // cap interior lattice spacing
  const SIM_STEP = 0.15;        // sim outline spacing (upper bound)
  const SIM_TOL = 0.01;         // max chord deviation of the sim outline from the render outline
  const SIM_LAT = 0.16;         // sim interior lattice spacing
  const SIM_KEEP = 0.08;        // sim lattice points kept this far inside the outline
  const BLUR = 2;               // [1 2 1] passes on the EDT field near rounded corners

  /* ============================== Small helpers ============================== */

  // Signed area of a closed xz loop (positive = CCW with x right, z up).
  function polyArea(p) {
    let a = 0;
    const n = p.length >> 1;
    for (let i = 0, j = n - 1; i < n; j = i++) a += p[2 * j] * p[2 * i + 1] - p[2 * i] * p[2 * j + 1];
    return a / 2;
  }

  // Squared distance from (x, z) to segment a-b.
  function segDist2(x, z, ax, az, bx, bz) {
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    let t = l2 > 0 ? ((x - ax) * ex + (z - az) * ez) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = ax + t * ex - x, dz = az + t * ez - z;
    return dx * dx + dz * dz;
  }

  // Deterministic 2D integer hash -> [0, 1).
  function hash2(i, j) {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function mulberry32(a) {
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bilinear sample of a cell-centred field on grid g; writes [f, df/dx, df/dz] into out if given.
  // Clamped at the grid border. Allocation free.
  function sampleField(field, g, x, z, out) {
    const NX = g.NX, NZ = g.NZ, h = g.h;
    let u = (x - g.X0) / h - 0.5, v = (z - g.Z0) / h - 0.5;
    if (!(u > 0)) u = 0; else if (u > NX - 1.000001) u = NX - 1.000001;
    if (!(v > 0)) v = 0; else if (v > NZ - 1.000001) v = NZ - 1.000001;
    const i = u | 0, k = v | 0, fu = u - i, fv = v - k, c = i + k * NX;
    const f00 = field[c], f10 = field[c + 1], f01 = field[c + NX], f11 = field[c + NX + 1];
    const a = f00 + (f10 - f00) * fu, b = f01 + (f11 - f01) * fu;
    const f = a + (b - a) * fv;
    if (out) {
      out[0] = f;
      out[1] = ((f10 - f00) * (1 - fv) + (f11 - f01) * fv) / h;
      out[2] = (b - a) / h;
    }
    return f;
  }

  /** Bilinear sample of a GRID field at a rest-plane point. */
  function sample(field, x, z) { return sampleField(field, GRID, x, z, null); }

  /* ================================= Kernel ================================== */

  const BIG = 1e20;                                   // "no source" in squared cell units
  let sq = new Float64Array(GRID.N);                  // EDT scratch (squared cell distances)
  let f1 = new Float64Array(256), d1 = new Float64Array(256), z1 = new Float64Array(257);
  let v1 = new Int32Array(256);

  // 1D squared-distance transform f1[0..n) -> d1 (Felzenszwalb–Huttenlocher lower envelope).
  function dt1(n) {
    let k = 0;
    v1[0] = 0; z1[0] = -Infinity; z1[1] = Infinity;
    for (let q = 1; q < n; q++) {
      const fq = f1[q] + q * q;
      let p = v1[k], s = (fq - f1[p] - p * p) / (2 * (q - p));
      while (s <= z1[k]) { k--; p = v1[k]; s = (fq - f1[p] - p * p) / (2 * (q - p)); }
      k++; v1[k] = q; z1[k] = s; z1[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z1[k + 1] < q) k++;
      const p = v1[k], dq = q - p;
      d1[q] = dq * dq + f1[p];
    }
  }

  // Separable squared EDT in cell units. Sources: mask != 0 (or mask == 0 when invert). Returns
  // the shared scratch buffer, valid until the next call.
  function edtSq(mask, invert, g) {
    const NX = g.NX, NZ = g.NZ, N = g.N, m = Math.max(NX, NZ);
    if (sq.length < N) sq = new Float64Array(N);
    if (f1.length < m) {
      f1 = new Float64Array(m); d1 = new Float64Array(m); v1 = new Int32Array(m); z1 = new Float64Array(m + 1);
    }
    for (let i = 0; i < NX; i++) {
      for (let k = 0, c = i; k < NZ; k++, c += NX) f1[k] = (mask[c] !== 0) !== invert ? 0 : BIG;
      dt1(NZ);
      for (let k = 0, c = i; k < NZ; k++, c += NX) sq[c] = d1[k];
    }
    for (let k = 0, o = 0; k < NZ; k++, o += NX) {
      for (let i = 0; i < NX; i++) f1[i] = sq[o + i];
      dt1(NX);
      for (let i = 0; i < NX; i++) sq[o + i] = d1[i];
    }
    return sq;
  }

  /** Exact Euclidean distance (world units) from each cell centre to the nearest mask cell. */
  function edt(mask, out, g = GRID) {
    const N = g.N;
    if (!out) out = new Float32Array(N);
    const s = edtSq(mask, false, g);
    for (let c = 0; c < N; c++) out[c] = Math.sqrt(s[c]) * g.h;
    return out;
  }

  /** Morphological closing then opening with radius r (exact EDT discs). Returns a new mask. */
  function roundRegion(mask, r, g = GRID) {
    const N = g.N, r2 = (r / g.h) * (r / g.h) + 1e-9;
    const a = new Uint8Array(N), b = new Uint8Array(N);
    let s = edtSq(mask, false, g);                          // closing: dilate ...
    for (let c = 0; c < N; c++) a[c] = s[c] <= r2 ? 1 : 0;
    s = edtSq(a, true, g);                                  // ... then erode
    for (let c = 0; c < N; c++) b[c] = s[c] > r2 ? 1 : 0;
    s = edtSq(b, true, g);                                  // opening: erode ...
    for (let c = 0; c < N; c++) a[c] = s[c] > r2 ? 1 : 0;
    s = edtSq(a, false, g);                                 // ... then dilate
    for (let c = 0; c < N; c++) b[c] = s[c] <= r2 ? 1 : 0;
    return b;
  }

  /** Signed distance, negative inside; zero halfway between inside and outside cell centres. */
  function signedField(mask, g = GRID) {
    const N = g.N, h = g.h, hh = h / 2, out = new Float32Array(N);
    let s = edtSq(mask, false, g);
    for (let c = 0; c < N; c++) if (!mask[c]) out[c] = Math.sqrt(s[c]) * h - hh;
    s = edtSq(mask, true, g);
    for (let c = 0; c < N; c++) if (mask[c]) out[c] = hh - Math.sqrt(s[c]) * h;
    return out;
  }

  let ccSeen = new Uint8Array(GRID.N), ccCells = new Int32Array(GRID.N);

  /** Masks of the 4-connected components with area >= minArea, largest first. */
  function components(mask, minArea = 0, g = GRID) {
    const NX = g.NX, NZ = g.NZ, N = g.N;
    if (ccSeen.length < N) { ccSeen = new Uint8Array(N); ccCells = new Int32Array(N); }
    const seen = ccSeen, cells = ccCells;
    seen.fill(0, 0, N);
    const minCells = minArea / (g.h * g.h) - 1e-9, spans = [];
    let tail = 0;
    for (let s = 0; s < N; s++) {
      if (!mask[s] || seen[s]) continue;
      const start = tail;
      seen[s] = 1; cells[tail++] = s;
      for (let hd = start; hd < tail; hd++) {
        const c = cells[hd], i = c % NX, k = (c - i) / NX;
        if (i > 0 && mask[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; cells[tail++] = c - 1; }
        if (i < NX - 1 && mask[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; cells[tail++] = c + 1; }
        if (k > 0 && mask[c - NX] && !seen[c - NX]) { seen[c - NX] = 1; cells[tail++] = c - NX; }
        if (k < NZ - 1 && mask[c + NX] && !seen[c + NX]) { seen[c + NX] = 1; cells[tail++] = c + NX; }
      }
      if (tail - start >= minCells) spans.push(start, tail);
    }
    const order = [];
    for (let q = 0; q < spans.length; q += 2) order.push(q);
    order.sort((p, q) => (spans[q + 1] - spans[q]) - (spans[p + 1] - spans[p]));
    return order.map((q) => {
      const m = new Uint8Array(N);
      for (let j = spans[q]; j < spans[q + 1]; j++) m[cells[j]] = 1;
      return m;
    });
  }

  let ctNext = new Int32Array(0);

  /**
   * Closed loops at field = 0 (marching squares on cell centres, bilinear crossings, saddles
   * resolved by the cell-centre average). Material is always on the left of the walking
   * direction, so outer boundaries come out CCW and holes CW. Outside the grid counts as empty.
   */
  function contours(field, g = GRID) {
    const NX = g.NX, NZ = g.NZ, h = g.h, X0 = g.X0, Z0 = g.Z0;
    const W = NX + 2, Hh = NZ + 2, nE = 2 * W * Hh;           // padded node lattice, 2 edges/node
    if (ctNext.length < nE) ctNext = new Int32Array(nE);
    const next = ctNext;
    next.fill(-1, 0, nE);
    const val = (I, K) => (I < 1 || K < 1 || I > NX || K > NZ ? h : field[I - 1 + (K - 1) * NX]);
    const v = [0, 0, 0, 0], E = [0, 0, 0, 0];
    for (let K = 0; K < Hh - 1; K++) {
      for (let I = 0; I < W - 1; I++) {
        const a = val(I, K), b = val(I + 1, K), c = val(I + 1, K + 1), d = val(I, K + 1);
        const code = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0);
        if (code === 0 || code === 15) continue;
        v[0] = a; v[1] = b; v[2] = c; v[3] = d;
        // Cell edges in CCW order: bottom (a->b), right (b->c), top (c->d), left (d->a).
        E[0] = 2 * (I + K * W); E[1] = 2 * (I + 1 + K * W) + 1; E[2] = 2 * (I + (K + 1) * W); E[3] = 2 * (I + K * W) + 1;
        const saddle = code === 5 || code === 10, centreIn = a + b + c + d < 0;
        for (let j = 0; j < 4; j++) {
          if (!(v[j] < 0) || v[(j + 1) & 3] < 0) continue;     // segments start on in->out edges
          let e;
          if (saddle) e = centreIn ? (j + 1) & 3 : (j + 3) & 3;
          else for (e = 0; e < 4; e++) if (!(v[e] < 0) && v[(e + 1) & 3] < 0) break;
          next[E[j]] = E[e];
        }
      }
    }
    const loops = [], tmp = [];
    for (let id0 = 0; id0 < nE; id0++) {
      if (next[id0] < 0) continue;
      tmp.length = 0;
      let id = id0;
      do {
        const e = id >> 1, I = e % W, K = (e - I) / W;
        const x0 = X0 + (I - 0.5) * h, z0 = Z0 + (K - 0.5) * h, f0 = val(I, K);
        if (id & 1) tmp.push(x0, z0 + (f0 / (f0 - val(I, K + 1))) * h);
        else tmp.push(x0 + (f0 / (f0 - val(I + 1, K))) * h, z0);
        const n = next[id];
        next[id] = -1;
        id = n;
      } while (id >= 0 && id !== id0);
      if (tmp.length >= 6) loops.push(Float64Array.from(tmp));
    }
    return loops;
  }

  /** Exact even-odd point-in-polygon over a set of loops (Float64Array or { pts }). */
  function inside(x, z, loops) {
    let c = false;
    for (let l = 0; l < loops.length; l++) {
      const p = loops[l].pts || loops[l], n = p.length >> 1;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const zi = p[2 * i + 1], zj = p[2 * j + 1];
        if ((zi > z) !== (zj > z)) {
          const xi = p[2 * i];
          if (x < xi + ((z - zi) * (p[2 * j] - xi)) / (zj - zi)) c = !c;
        }
      }
    }
    return c;
  }

  /* ================================ Delaunay ================================= */
  // Bowyer–Watson with triangle adjacency, walking point location and cavity flood fill, plus
  // optional edge recovery by flips (Sloan) so polygon edges are guaranteed to be present.
  // Triangles are CCW; Tn[3t+k] is the neighbour across the edge opposite vertex k.

  let Px = new Float64Array(0), Pz = new Float64Array(0);
  let Tv = new Int32Array(0), Tn = new Int32Array(0), Tm = new Int32Array(0);
  let Vt = new Int32Array(0), SA = new Int32Array(0), EA = new Int32Array(0);
  let Free = new Int32Array(0), Bad = new Int32Array(0);
  let Eu = new Int32Array(0), Ev = new Int32Array(0), Eo = new Int32Array(0), Et = new Int32Array(0);
  let nTri = 0, nFree = 0, stamp = 0, lastTri = 0;

  function dtReserve(nv) {
    const C = 2 * nv + 16;                       // alive triangles never exceed 2*nv
    if (Px.length < nv) {
      Px = new Float64Array(nv); Pz = new Float64Array(nv);
      Vt = new Int32Array(nv); SA = new Int32Array(nv); EA = new Int32Array(nv);
    }
    if (Tm.length < C) {
      Tv = new Int32Array(3 * C); Tn = new Int32Array(3 * C); Tm = new Int32Array(C);
      Free = new Int32Array(C); Bad = new Int32Array(C);
      Eu = new Int32Array(C); Ev = new Int32Array(C); Eo = new Int32Array(C); Et = new Int32Array(C);
    }
    nTri = 0; nFree = 0;
  }

  function newTri(a, b, c) {
    const t = nFree > 0 ? Free[--nFree] : nTri++, o = 3 * t;
    Tv[o] = a; Tv[o + 1] = b; Tv[o + 2] = c;
    Tn[o] = -1; Tn[o + 1] = -1; Tn[o + 2] = -1;
    Tm[t] = 0;
    return t;
  }

  function orientP(a, b, x, z) { return (Px[b] - Px[a]) * (z - Pz[a]) - (Pz[b] - Pz[a]) * (x - Px[a]); }

  function inCirc(t, x, z) {
    const o = 3 * t, a = Tv[o], b = Tv[o + 1], c = Tv[o + 2];
    const adx = Px[a] - x, adz = Pz[a] - z, bdx = Px[b] - x, bdz = Pz[b] - z, cdx = Px[c] - x, cdz = Pz[c] - z;
    const ad = adx * adx + adz * adz, bd = bdx * bdx + bdz * bdz, cd = cdx * cdx + cdz * cdz;
    return adx * (bdz * cd - bd * cdz) - adz * (bdx * cd - bd * cdx) + ad * (bdx * cdz - bdz * cdx);
  }

  function idxIn(t, v) { const o = 3 * t; return Tv[o] === v ? 0 : Tv[o + 1] === v ? 1 : Tv[o + 2] === v ? 2 : -1; }

  // In triangle t, set the neighbour across directed edge a->b.
  function setNb(t, a, b, nt) {
    const o = 3 * t;
    for (let k = 0; k < 3; k++) if (Tv[o + (k + 1) % 3] === a && Tv[o + (k + 2) % 3] === b) { Tn[o + k] = nt; return; }
  }

  function locate(x, z) {
    let t = lastTri, r = 0;
    for (let it = 0, lim = 4 * nTri + 64; it < lim; it++) {
      const o = 3 * t;
      let nx = -2;
      for (let e = 0; e < 3; e++) {
        const k = (e + r) % 3;
        if (orientP(Tv[o + (k + 1) % 3], Tv[o + (k + 2) % 3], x, z) < 0) { nx = Tn[o + k]; break; }
      }
      if (nx < 0) return t;
      t = nx; r = (r + 1) % 3;                    // rotate the first edge tried to avoid cycles
    }
    for (let q = 0; q < nTri; q++) {             // ponytail: brute-force fallback, never hit in tests
      const o = 3 * q;
      if (Tv[o] < 0) continue;
      if (orientP(Tv[o], Tv[o + 1], x, z) >= 0 && orientP(Tv[o + 1], Tv[o + 2], x, z) >= 0 &&
          orientP(Tv[o + 2], Tv[o], x, z) >= 0) return q;
    }
    return t;
  }

  function insertPoint(p) {
    const x = Px[p], z = Pz[p], t0 = locate(x, z);
    for (let k = 0; k < 3; k++) {
      const v = Tv[3 * t0 + k], dx = Px[v] - x, dz = Pz[v] - z;
      if (dx * dx + dz * dz < 1e-22) return;     // duplicate point: skip
    }
    const st = ++stamp;
    let nb = 0;
    Bad[nb++] = t0; Tm[t0] = st;
    for (let q = 0; q < nb; q++) {               // flood the cavity
      const o = 3 * Bad[q];
      for (let k = 0; k < 3; k++) {
        const nt = Tn[o + k];
        if (nt < 0 || Tm[nt] === st) continue;
        if (inCirc(nt, x, z) > 0) { Tm[nt] = st; Bad[nb++] = nt; }
      }
    }
    let ne = 0;
    for (let q = 0; q < nb; q++) {               // cavity boundary edges (CCW)
      const o = 3 * Bad[q];
      for (let k = 0; k < 3; k++) {
        const nt = Tn[o + k];
        if (nt >= 0 && Tm[nt] === st) continue;
        Eu[ne] = Tv[o + (k + 1) % 3]; Ev[ne] = Tv[o + (k + 2) % 3]; Eo[ne] = nt; ne++;
      }
    }
    for (let q = 0; q < nb; q++) { Tv[3 * Bad[q]] = -1; Free[nFree++] = Bad[q]; }
    for (let e = 0; e < ne; e++) {
      const a = Eu[e], b = Ev[e], nt = Eo[e], t = newTri(a, b, p);
      Tn[3 * t + 2] = nt;
      if (nt >= 0) setNb(nt, b, a, t);
      SA[a] = t; EA[b] = t; Vt[a] = t; Et[e] = t;
    }
    for (let e = 0; e < ne; e++) {               // link the fan around p
      const t = Et[e];
      Tn[3 * t] = SA[Tv[3 * t + 1]];
      Tn[3 * t + 1] = EA[Tv[3 * t]];
    }
    Vt[p] = Et[0]; lastTri = Et[0];
  }

  // Triangle holding directed edge u->v, or -1 (rotates CCW around u).
  function findEdge(u, v) {
    const t0 = Vt[u];
    if (t0 < 0) return -1;
    let t = t0;
    for (let it = 0; it < 512; it++) {
      const k = idxIn(t, u);
      if (k < 0) return -1;
      if (Tv[3 * t + (k + 1) % 3] === v) return t;
      t = Tn[3 * t + (k + 1) % 3];
      if (t < 0 || t === t0) return -1;
    }
    return -1;
  }

  // Flip the edge shared by t1 = (u, v, w1) and t2 = (v, u, w2) into w1-w2.
  function flip(t1, k1, t2, k2, u, v, w1, w2) {
    const o1 = 3 * t1, o2 = 3 * t2;
    const n1a = Tn[o1 + k1], n1b = Tn[o1 + (k1 + 1) % 3], n2a = Tn[o2 + k2], n2b = Tn[o2 + (k2 + 1) % 3];
    Tv[o1] = u; Tv[o1 + 1] = w2; Tv[o1 + 2] = w1; Tn[o1] = t2; Tn[o1 + 1] = n1b; Tn[o1 + 2] = n2a;
    Tv[o2] = w2; Tv[o2 + 1] = v; Tv[o2 + 2] = w1; Tn[o2] = n1a; Tn[o2 + 1] = t1; Tn[o2 + 2] = n2b;
    if (n1a >= 0) setNb(n1a, w1, v, t2);
    if (n2a >= 0) setNb(n2a, w2, u, t1);
    Vt[u] = t1; Vt[w2] = t1; Vt[w1] = t1; Vt[v] = t2;
  }

  function crossesAB(p, q, a, b) {
    const s1 = orientP(a, b, Px[p], Pz[p]), s2 = orientP(a, b, Px[q], Pz[q]);
    if (!(s1 * s2 < 0)) return false;
    return orientP(p, q, Px[a], Pz[a]) * orientP(p, q, Px[b], Pz[b]) < 0;
  }

  // Make a-b an edge of the triangulation (Sloan's flip algorithm).
  function recoverEdge(a, b, depth) {
    if (a === b || depth > 8 || Vt[a] < 0 || Vt[b] < 0) return;
    if (findEdge(a, b) >= 0 || findEdge(b, a) >= 0) return;
    const xa = Px[a], za = Pz[a], xb = Px[b], zb = Pz[b];
    let t = Vt[a], start = -1, Rv = -1, Lv = -1;
    const t0 = t;
    for (let it = 0; it < 512; it++) {           // the triangle at a whose far edge a->b crosses
      const k = idxIn(t, a), o = 3 * t, p1 = Tv[o + (k + 1) % 3], p2 = Tv[o + (k + 2) % 3];
      const s1 = orientP(a, p1, xb, zb);
      if (s1 === 0 && (Px[p1] - xa) * (xb - xa) + (Pz[p1] - za) * (zb - za) > 0) { recoverEdge(p1, b, depth + 1); return; }
      if (s1 > 0 && orientP(a, p2, xb, zb) < 0) { start = t; Rv = p1; Lv = p2; break; }
      t = Tn[o + (k + 1) % 3];
      if (t < 0 || t === t0) break;
    }
    if (start < 0) return;
    const qu = [Rv], qv = [Lv];
    let cur = start, opp = a;
    for (let it = 0; it < 4096; it++) {          // walk along a->b collecting crossed edges
      const nt = Tn[3 * cur + idxIn(cur, opp)];
      if (nt < 0) return;
      const o = 3 * nt;
      const q = Tv[o] !== Rv && Tv[o] !== Lv ? Tv[o] : Tv[o + 1] !== Rv && Tv[o + 1] !== Lv ? Tv[o + 1] : Tv[o + 2];
      if (q === b) break;
      const s = orientP(a, b, Px[q], Pz[q]);
      if (s === 0) { recoverEdge(a, q, depth + 1); recoverEdge(q, b, depth + 1); return; }
      if (s > 0) { opp = Lv; Lv = q; } else { opp = Rv; Rv = q; }
      cur = nt;
      qu.push(Rv); qv.push(Lv);
    }
    for (let head = 0, guard = 0; head < qu.length && guard < 20000; head++, guard++) {
      const u = qu[head], v = qv[head], t1 = findEdge(u, v), t2 = findEdge(v, u);
      if (t1 < 0 || t2 < 0) continue;
      const k1 = idxIn(t1, u), k2 = idxIn(t2, v), w1 = Tv[3 * t1 + (k1 + 2) % 3], w2 = Tv[3 * t2 + (k2 + 2) % 3];
      if (orientP(w1, w2, Px[u], Pz[u]) * orientP(w1, w2, Px[v], Pz[v]) < 0) {
        flip(t1, k1, t2, k2, u, v, w1, w2);
        if (crossesAB(w1, w2, a, b)) { qu.push(w1); qv.push(w2); }
      } else { qu.push(u); qv.push(v); }
    }
  }

  /**
   * Delaunay triangulation of xz pairs; returns CCW triangles (Uint32Array). Optional `cons`
   * (pairs of point indices) are forced into the triangulation by edge flips.
   */
  function delaunay(pts, cons) {
    const n = pts.length >> 1;
    if (n < 3) return new Uint32Array(0);
    dtReserve(n + 3);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pts[2 * i], z = pts[2 * i + 1];
      Px[i] = x; Pz[i] = z; Vt[i] = -1;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    // A far super triangle (1e4 x the extent) keeps hull triangles that a near one would eat;
    // incircle tests against it degrade gracefully into orientation tests in doubles.
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, M = Math.max(x1 - x0, z1 - z0, 1e-6) * 1e4;
    Px[n] = cx - 2 * M; Pz[n] = cz - M;
    Px[n + 1] = cx + 2 * M; Pz[n + 1] = cz - M;
    Px[n + 2] = cx; Pz[n + 2] = cz + 2 * M;
    const t = newTri(n, n + 1, n + 2);
    Vt[n] = Vt[n + 1] = Vt[n + 2] = t; lastTri = t;
    // Boustrophedon band order keeps the walk short.
    const band = Math.sqrt(((x1 - x0) * (z1 - z0) || 1) / n) * 2 || 1, span = 4 * (x1 - x0 + 1);
    const key = new Float64Array(n), order = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const b = Math.floor((Pz[i] - z0) / band);
      key[i] = b * span + (b & 1 ? x1 - Px[i] : Px[i] - x0);
      order[i] = i;
    }
    order.sort((p, q) => key[p] - key[q]);
    for (let q = 0; q < n; q++) insertPoint(order[q]);
    if (cons) for (let e = 0; e + 1 < cons.length; e += 2) recoverEdge(cons[e], cons[e + 1], 0);
    let cnt = 0;
    for (let q = 0; q < nTri; q++) {
      const o = 3 * q;
      if (Tv[o] >= 0 && Tv[o] < n && Tv[o + 1] < n && Tv[o + 2] < n) cnt++;
    }
    const out = new Uint32Array(3 * cnt);
    for (let q = 0, w = 0; q < nTri; q++) {
      const o = 3 * q;
      if (Tv[o] >= 0 && Tv[o] < n && Tv[o + 1] < n && Tv[o + 2] < n) {
        out[w++] = Tv[o]; out[w++] = Tv[o + 1]; out[w++] = Tv[o + 2];
      }
    }
    return out;
  }

  /* ================================= Regions ================================= */

  /** The original slice, sampled from its analytic SDF. */
  function sliceRegion() {
    const { NX, NZ, N, h, X0, Z0 } = GRID;
    const mask = new Uint8Array(N), field = new Float32Array(N);
    for (let k = 0, c = 0; k < NZ; k++) {
      const z = Z0 + (k + 0.5) * h;
      for (let i = 0; i < NX; i++, c++) {
        const f = sliceSdf(X0 + (i + 0.5) * h, z);
        field[c] = f; mask[c] = f < 0 ? 1 : 0;
      }
    }
    return { mask, field };
  }

  function cellCount(m) { let n = 0; for (let c = 0; c < m.length; c++) n += m[c]; return n; }

  // Separable [1 2 1]/4 blur, in place (clamped borders).
  function blur121(f, g, passes) {
    const NX = g.NX, NZ = g.NZ, t = new Float32Array(g.N);
    for (let p = 0; p < passes; p++) {
      for (let k = 0, c = 0; k < NZ; k++) {
        for (let i = 0; i < NX; i++, c++) t[c] = 0.5 * f[c] + 0.25 * (f[i > 0 ? c - 1 : c] + f[i < NX - 1 ? c + 1 : c]);
      }
      for (let k = 0, c = 0; k < NZ; k++) {
        for (let i = 0; i < NX; i++, c++) f[c] = 0.5 * t[c] + 0.25 * (t[k > 0 ? c - NX : c] + t[k < NZ - 1 ? c + NX : c]);
      }
    }
    return f;
  }

  // Field of a rounded mask m. signedField(m) carries the cell staircase in its zero set, so where
  // rounding left the boolean alone we keep the smooth boolean field fb (exact for knife lines,
  // the analytic slice and earlier smooth fields), and fall back to the EDT field only near cells
  // that rounding (or component splitting) changed, blending over a few cells.
  // Discrete discs also flip cells whose centre sits within a hair (|fb| < noise) of a boundary
  // about as round as ROUND or rounder (|laplacian of fb| < 2h^2/ROUND), next to a cell that mask
  // and fb both put on the same side. That is raster noise, not a rounded feature: swapping in the
  // EDT field there rippled a stamped circle by half a cell (8 degrees of wall normal). Such cells
  // keep fb, so sign(field) may differ from the mask on them; a one-cell wedge tip has a larger
  // laplacian and is still rounded away. Cut / stamp results pass noise = NOISE (they intersect
  // rounded sets, so closing never fills a real crack); makeShape passes 0 (polygon notches are).
  const NOISE = 0.3 * GRID.h;
  function fuseField(m, fb, g, noise, round = ROUND) {
    const N = g.N, NX = g.NX, NZ = g.NZ, fe = blur121(signedField(m, g), g, BLUR), ch = new Uint8Array(N);
    const curv = (2 * g.h * g.h) / round;
    let any = false;
    for (let c = 0; c < N; c++) {
      const inB = fb[c] < 0;
      if (inB === (m[c] !== 0)) continue;
      if (fb[c] > -noise && fb[c] < noise) {
        const i = c % NX, k = (c - i) / NX, side = inB ? 1 : 0;
        const l = i > 0 ? c - 1 : c, r = i < NX - 1 ? c + 1 : c, d = k > 0 ? c - NX : c, u = k < NZ - 1 ? c + NX : c;
        const lap = fb[l] + fb[r] + fb[d] + fb[u] - 4 * fb[c];
        if (lap < curv && lap > -curv && ((m[l] === side && (fb[l] < 0) === inB) || (m[r] === side && (fb[r] < 0) === inB) ||
            (m[d] === side && (fb[d] < 0) === inB) || (m[u] === side && (fb[u] < 0) === inB))) continue;
      }
      ch[c] = 1; any = true;
    }
    if (!any) return Float32Array.from(fb);
    const s = edtSq(ch, false, g), a = 1, b = 4;      // blend band, in cells
    for (let c = 0; c < N; c++) {
      const d = Math.sqrt(s[c]);
      if (d <= a) continue;
      const t = d >= b ? 1 : (d - a) / (b - a), w = t * t * (3 - 2 * t);
      fe[c] = w * fb[c] + (1 - w) * fe[c];
    }
    return fe;
  }

  // boolean result -> components -> round each (only near the new cut, so older features survive)
  // -> components again (rounding may pinch a neck) -> field (signedField, smoothed by the boolean
  // field fb where rounding did nothing). Largest first.
  function finishRegions(mask, fb, round = ROUND, near = null) {
    const parts = [];
    for (const comp of components(mask, MIN_AREA)) {
      const r = roundRegion(comp, round);
      if (near) for (let c = 0; c < r.length; c++) if (!near[c]) r[c] = comp[c];
      for (const m of components(r, MIN_AREA)) parts.push({ m, n: cellCount(m) });
    }
    parts.sort((a, b) => b.n - a.n);
    return parts.map((p) => ({ mask: p.m, field: fuseField(p.m, fb, GRID, NOISE, round) }));
  }

  /**
   * Knife: split along {p : nx*x + nz*z = d}, removing a kerf. ok is false with reason 'thin' when
   * either side keeps no piece of area >= MIN_AREA (this includes a line that misses the region).
   * On failure pieces is empty and the caller keeps the original region.
   */
  function splitByLine(region, nx, nz, d, kerf = KERF) {
    const len = Math.hypot(nx, nz) || 1;
    nx /= len; nz /= len; d /= len;
    const { NX, NZ, N, h, X0, Z0 } = GRID, half = kerf / 2, src = region.mask, pf = region.field;
    const A = new Uint8Array(N), B = new Uint8Array(N), fa = new Float32Array(N), fbB = new Float32Array(N), near = new Uint8Array(N);
    for (let k = 0, c = 0; k < NZ; k++) {
      const z = Z0 + (k + 0.5) * h;
      for (let i = 0; i < NX; i++, c++) {
        const s = nx * (X0 + (i + 0.5) * h) + nz * z - d;
        fa[c] = Math.max(pf[c], half - s);              // boolean fields of both sides
        fbB[c] = Math.max(pf[c], half + s);
        near[c] = Math.abs(s) < NEAR ? 1 : 0;
        if (!src[c]) continue;
        if (s > half) A[c] = 1; else if (s < -half) B[c] = 1;
      }
    }
    const pa = finishRegions(A, fa, ROUND, near);
    if (!pa.length) return { pieces: [], ok: false, reason: 'thin' };
    const pb = finishRegions(B, fbB, ROUND, near);
    if (!pb.length) return { pieces: [], ok: false, reason: 'thin' };
    return { pieces: pa.concat(pb), ok: true, reason: null };
  }

  /**
   * Wavy knife: split along f = 0 with f = (nx x + nz z + cs) - WAVE_A sin(2π (tx x + tz z + cu) / WAVE_L),
   * the crinkle blade's corrugated plane carried into the rest plane (n: blade normal, t: blade direction).
   * Signed distance ~ f / |grad f|; a kerf is removed and the new faces get the tight WAVE_ROUND.
   */
  function splitByWave(region, nx, nz, cs, tx, tz, cu, kerf = 0.03) {
    const { NX, NZ, N, h, X0, Z0 } = GRID, half = kerf / 2, src = region.mask, pf = region.field, k = (2 * PI) / WAVE_L;
    const A = new Uint8Array(N), B = new Uint8Array(N), fa = new Float32Array(N), fbB = new Float32Array(N), near = new Uint8Array(N);
    for (let kk = 0, c = 0; kk < NZ; kk++) {
      const z = Z0 + (kk + 0.5) * h;
      for (let i = 0; i < NX; i++, c++) {
        const x = X0 + (i + 0.5) * h, u = k * (tx * x + tz * z + cu), cw = WAVE_A * k * Math.cos(u);
        const s = (nx * x + nz * z + cs - WAVE_A * Math.sin(u)) / (Math.hypot(nx - cw * tx, nz - cw * tz) || 1);
        fa[c] = Math.max(pf[c], half - s);
        fbB[c] = Math.max(pf[c], half + s);
        near[c] = Math.abs(s) < NEAR ? 1 : 0;
        if (!src[c]) continue;
        if (s > half) A[c] = 1; else if (s < -half) B[c] = 1;
      }
    }
    const pa = finishRegions(A, fa, WAVE_ROUND, near);
    if (!pa.length) return { pieces: [], ok: false, reason: 'thin' };
    const pb = finishRegions(B, fbB, WAVE_ROUND, near);
    if (!pb.length) return { pieces: [], ok: false, reason: 'thin' };
    return { pieces: pa.concat(pb), ok: true, reason: null };
  }

  /**
   * Cookie cutter: toLocal(x, z, out2) maps a rest-plane point into shape-local coordinates.
   * inside = region where shape.field < -wall/2, outside = where > +wall/2. reason 'miss' when the
   * ring does not cross the region (region entirely inside or outside the shape).
   */
  const tl2 = new Float64Array(2);
  function splitByCutter(region, shape, toLocal, wall = 0.035) {
    const { NX, NZ, N, h, X0, Z0 } = GRID, hw = wall / 2, src = region.mask, pf = region.field;
    const In = new Uint8Array(N), Out = new Uint8Array(N), fIn = new Float32Array(N), fOut = new Float32Array(N), near = new Uint8Array(N);
    let hasIn = false, hasOut = false;
    for (let k = 0, c = 0; k < NZ; k++) {
      const z = Z0 + (k + 0.5) * h;
      for (let i = 0; i < NX; i++, c++) {
        toLocal(X0 + (i + 0.5) * h, z, tl2);
        const f = shape.field(tl2[0], tl2[1]);
        fIn[c] = Math.max(pf[c], f + hw);
        fOut[c] = Math.max(pf[c], hw - f);
        near[c] = Math.abs(f) < NEAR ? 1 : 0;
        if (!src[c]) continue;
        if (f < 0) hasIn = true; else hasOut = true;
        if (f < -hw) In[c] = 1; else if (f > hw) Out[c] = 1;
      }
    }
    if (!(hasIn && hasOut)) return { inside: [], outside: [], ok: false, reason: 'miss' };
    const inside = finishRegions(In, fIn, ROUND, near), outside = finishRegions(Out, fOut, ROUND, near);
    if (!inside.length && !outside.length) return { inside, outside, ok: false, reason: 'thin' };
    return { inside, outside, ok: true, reason: null };
  }

  /* ============================== Outline loops =============================== */

  // Uniform arc-length resampling of a closed loop at ~spacing.
  function resampleLoop(L, spacing) {
    const m = L.length >> 1, cum = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      cum[i + 1] = cum[i] + Math.hypot(L[2 * j] - L[2 * i], L[2 * j + 1] - L[2 * i + 1]);
    }
    const P = cum[m], n = Math.max(8, Math.round(P / spacing)), out = new Float64Array(2 * n);
    for (let i = 0, j = 0; i < n; i++) {
      const s = (i * P) / n;
      while (j < m - 1 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j], t = seg > 0 ? (s - cum[j]) / seg : 0, j1 = (j + 1) % m;
      out[2 * i] = L[2 * j] + t * (L[2 * j1] - L[2 * j]);
      out[2 * i + 1] = L[2 * j + 1] + t * (L[2 * j1 + 1] - L[2 * j + 1]);
    }
    return out;
  }

  const g3 = new Float64Array(3);

  // Resample, Laplacian-smooth (2 passes), snap to the zero set (2 Newton steps on the bilinear
  // field), then outward normals (right of the walking direction = away from the material).
  function processLoop(raw, field, g, spacing) {
    const pts = resampleLoop(raw, spacing), n = pts.length >> 1, tmp = new Float64Array(2 * n);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const a = 2 * ((i + n - 1) % n), b = 2 * i, c = 2 * ((i + 1) % n);
        tmp[b] = 0.5 * pts[b] + 0.25 * (pts[a] + pts[c]);
        tmp[b + 1] = 0.5 * pts[b + 1] + 0.25 * (pts[a + 1] + pts[c + 1]);
      }
      pts.set(tmp);
    }
    for (let i = 0; i < n; i++) {
      let x = pts[2 * i], z = pts[2 * i + 1];
      for (let it = 0; it < 2; it++) {
        sampleField(field, g, x, z, g3);
        const gg = g3[1] * g3[1] + g3[2] * g3[2];
        if (gg < 1e-12) break;
        let dx = (g3[0] * g3[1]) / gg, dz = (g3[0] * g3[2]) / gg;
        const dl = Math.hypot(dx, dz);
        if (dl > g.h) { dx *= g.h / dl; dz *= g.h / dl; }
        x -= dx; z -= dz;
      }
      pts[2 * i] = x; pts[2 * i + 1] = z;
    }
    const raw2 = new Float64Array(2 * n), nrm = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      const a = 2 * ((i + n - 1) % n), c = 2 * ((i + 1) % n);
      const tx = pts[c] - pts[a], tz = pts[c + 1] - pts[a + 1], l = Math.hypot(tx, tz) || 1;
      raw2[2 * i] = tz / l; raw2[2 * i + 1] = -tx / l;
    }
    for (let i = 0; i < n; i++) {                // one smoothing pass keeps inset rings regular
      const a = 2 * ((i + n - 1) % n), b = 2 * i, c = 2 * ((i + 1) % n);
      const x = raw2[a] + 2 * raw2[b] + raw2[c], z = raw2[a + 1] + 2 * raw2[b + 1] + raw2[c + 1];
      const l = Math.hypot(x, z) || 1;
      nrm[b] = x / l; nrm[b + 1] = z / l;
    }
    return { pts, nrm, hole: polyArea(pts) < 0 };
  }

  function outlineLoops(field, g) {
    const loops = [];
    for (const raw of contours(field, g)) {
      if (Math.abs(polyArea(raw)) < 2e-3) continue;   // ponytail: specks this small cannot survive ROUND
      loops.push(processLoop(raw, field, g, RIM_STEP));
    }
    return loops;
  }

  /* ============================== Cutter shapes ============================== */

  // Scanline even-odd rasterisation of polygons onto grid g (cell centres).
  function rasterize(polys, g) {
    const { NX, NZ, h, X0, Z0 } = g, m = new Uint8Array(g.N), xs = [];
    for (let k = 0; k < NZ; k++) {
      const z = Z0 + (k + 0.5) * h;
      xs.length = 0;
      for (const p of polys) {
        const n = p.length >> 1;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const zi = p[2 * i + 1], zj = p[2 * j + 1];
          if ((zi > z) !== (zj > z)) xs.push(p[2 * i] + ((z - zi) * (p[2 * j] - p[2 * i])) / (zj - zi));
        }
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const i0 = Math.max(0, Math.ceil((xs[q] - X0) / h - 0.5)), i1 = Math.min(NX - 1, Math.floor((xs[q + 1] - X0) / h - 0.5));
        for (let i = i0; i <= i1; i++) m[i + k * NX] = 1;
      }
    }
    return m;
  }

  function ccw(p) {
    if (polyArea(p) >= 0) return p;
    const n = p.length >> 1, q = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) { q[2 * i] = p[2 * (n - 1 - i)]; q[2 * i + 1] = p[2 * (n - 1 - i) + 1]; }
    return q;
  }

  function polar(n, rFn) {
    const p = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      const a = (2 * PI * i) / n, r = rFn(a);
      p[2 * i] = r * Math.cos(a); p[2 * i + 1] = r * Math.sin(a);
    }
    return p;
  }

  // Every corner of a CCW polygon replaced by a circular arc of radius r (seg chords per arc).
  function fillet(p, r, seg) {
    const n = p.length >> 1, out = [];
    for (let i = 0; i < n; i++) {
      const a = (i + n - 1) % n, c = (i + 1) % n, bx = p[2 * i], bz = p[2 * i + 1];
      let ux = p[2 * a] - bx, uz = p[2 * a + 1] - bz, vx = p[2 * c] - bx, vz = p[2 * c + 1] - bz;
      const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
      ux /= lu; uz /= lu; vx /= lv; vz /= lv;
      const half = Math.acos(Math.max(-1, Math.min(1, ux * vx + uz * vz))) / 2, t = r / Math.tan(half), d = r / Math.sin(half);
      const wl = Math.hypot(ux + vx, uz + vz), cx = bx + ((ux + vx) / wl) * d, cz = bz + ((uz + vz) / wl) * d;
      const a1 = Math.atan2(bz + uz * t - cz, bx + ux * t - cx);
      let sw = Math.atan2(bz + vz * t - cz, bx + vx * t - cx) - a1;
      if (sw > PI) sw -= 2 * PI; else if (sw < -PI) sw += 2 * PI;
      for (let k = 0; k <= seg; k++) out.push(cx + r * Math.cos(a1 + (sw * k) / seg), cz + r * Math.sin(a1 + (sw * k) / seg));
    }
    return Float64Array.from(out);
  }

  // Filleted analytically: a raster opening of its sharp tips and obtuse notches is a cell off.
  function starPoly() {
    const p = new Float64Array(20);
    for (let k = 0; k < 10; k++) {
      const a = PI / 2 + (k * PI) / 5, r = k & 1 ? 0.275 : 0.572;   // ~ the size of the old sharper star
      p[2 * k] = r * Math.cos(a); p[2 * k + 1] = r * Math.sin(a);
    }
    return fillet(p, SHAPE_ROUND, 16);
  }

  function heartPoly() {
    const n = 240, p = new Float64Array(2 * n), s = 1 / 32;   // classic heart: 32 wide -> 1.0
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < n; i++) {
      const t = (2 * PI * i) / n, st = Math.sin(t);
      p[2 * i] = 16 * st * st * st * s;
      p[2 * i + 1] = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s;
      zmin = Math.min(zmin, p[2 * i + 1]); zmax = Math.max(zmax, p[2 * i + 1]);
    }
    for (let i = 0; i < n; i++) p[2 * i + 1] -= (zmin + zmax) / 2;
    return ccw(p);
  }

  function flowerPoly() {
    const c = 0.32, rp = 0.18;                   // 6 petal discs around a centre disc: 1.0 across
    return polar(360, (a) => {
      let r = c;
      for (let k = 0; k < 6; k++) {
        const phi = a - (PI / 2 + (k * PI) / 3), sn = Math.sin(phi), disc = rp * rp - c * c * sn * sn;
        if (disc >= 0 && Math.cos(phi) > 0) r = Math.max(r, c * Math.cos(phi) + Math.sqrt(disc));
      }
      return r;
    });
  }

  // Exact signed distance to a polygon near its edges (sign from the raster), EDT farther away.
  function polySdf(poly, raw, g) {
    const f = signedField(raw, g), n = poly.length >> 1, band = 3 * g.h;
    for (let k = 0, c = 0; k < g.NZ; k++) {
      const z = g.Z0 + (k + 0.5) * g.h;
      for (let i = 0; i < g.NX; i++, c++) {
        if (Math.abs(f[c]) > band) continue;
        const x = g.X0 + (i + 0.5) * g.h;
        let d2 = Infinity;
        for (let a = 0, b = n - 1; a < n; b = a++) d2 = Math.min(d2, segDist2(x, z, poly[2 * b], poly[2 * b + 1], poly[2 * a], poly[2 * a + 1]));
        f[c] = raw[c] ? -Math.sqrt(d2) : Math.sqrt(d2);
      }
    }
    return f;
  }

  // Polygon -> raster on a small local grid -> roundRegion(round) -> signed field (exact polygon
  // distance where rounding left it alone) -> smoothed contour. The same rounded field drives both
  // the stamp boolean and the steel ring. A stamp leaves the hole at +wall/2 and the cut-out at
  // -wall/2, whose corners are SHAPE_ROUND -+ wall/2; keeping both above ROUND (plus half a cell for
  // the raster) means the final ROUND pass leaves them alone, so the ring matches what it cuts.
  // An already filleted polygon passes round = 0 and keeps its exact distance field.
  function makeShape(poly, round) {
    const L = 72, x0 = (-L * GRID.h) / 2;
    const g = { h: GRID.h, X0: x0, Z0: x0, NX: L, NZ: L, N: L * L };
    const raw = rasterize([poly], g), field = fuseField(round ? roundRegion(raw, round, g) : raw, polySdf(poly, raw, g), g, 0);
    let best = null;
    for (const lp of contours(field, g)) if (!best || polyArea(lp) > polyArea(best)) best = lp;
    const outline = processLoop(best, field, g, RIM_STEP).pts;
    let extent = 0;
    for (let i = 0; i < outline.length; i += 2) extent = Math.max(extent, Math.hypot(outline[i], outline[i + 1]));
    const lo = x0 + g.h / 2, hi = x0 + (L - 0.5) * g.h;
    return {
      outline,
      extent,
      field(x, z) {                              // off the local grid: clamped sample + distance (continuous)
        const cx = x < lo ? lo : x > hi ? hi : x, cz = z < lo ? lo : z > hi ? hi : z;
        const f = sampleField(field, g, cx, cz, null);
        return cx === x && cz === z ? f : f + Math.hypot(x - cx, z - cz);
      },
    };
  }

  let shapes = null;   // built on first use: only the cookie cutter needs them
  const cutterShapes = () => shapes || (shapes = {
    star: makeShape(starPoly(), 0),
    heart: makeShape(heartPoly(), SHAPE_ROUND),
    flower: makeShape(flowerPoly(), SHAPE_ROUND),
    round: makeShape(polar(128, () => 0.43), SHAPE_ROUND),
  });

  /* ============================== Piece meshing ============================== */

  // Bevel profile rings, bottom rim -> top rim: [inset d, y].
  const PROFILE = (() => {
    const out = [];
    for (let s = FILLET_RINGS; s >= 1; s--) {
      const p = ((s / FILLET_RINGS) * PI) / 2;
      out.push([s === FILLET_RINGS ? BEVEL : BEVEL * (1 - Math.cos(p)), s === FILLET_RINGS ? 0 : BEVEL * (1 - Math.sin(p))]);
    }
    out.push([0, BEVEL], [0, T - BEVEL]);
    for (let s = 1; s <= FILLET_RINGS; s++) {
      const p = ((s / FILLET_RINGS) * PI) / 2;
      out.push([s === FILLET_RINGS ? BEVEL : BEVEL * (1 - Math.cos(p)), s === FILLET_RINGS ? T : T - BEVEL + BEVEL * Math.sin(p)]);
    }
    return out;
  })();
  const NRING = PROFILE.length;

  // Representatives of a rim loop after merging crowded points (indices in loop order).
  function mergeRim(q, n) {
    const m2 = MERGE * MERGE, d2 = (i, j) => (q[2 * i] - q[2 * j]) ** 2 + (q[2 * i + 1] - q[2 * j + 1]) ** 2;
    let s = -1;
    for (let i = 0; i < n; i++) if (d2(i, (i + n - 1) % n) >= m2) { s = i; break; }
    const all = () => Int32Array.from({ length: n }, (_, i) => i);
    if (s < 0) return all();
    const reps = [];
    // The skipped points are closed by a fan from the run's first point, which is only a valid
    // (non-folded) patch where the ring bulges out past the chord; anywhere else the run stays.
    const fanOk = (a, b) => {
      for (let j = (a + 1) % n; j !== b; j = (j + 1) % n) {
        const j1 = (j + 1) % n, A = 2 * a, J = 2 * j, K = 2 * j1;
        if ((q[J] - q[A]) * (q[K + 1] - q[A + 1]) - (q[J + 1] - q[A + 1]) * (q[K] - q[A]) < 4e-9) return false;
      }
      return true;
    };
    for (let i = 0; i < n; ) {
      const a = (s + i) % n;
      let b = i + 1;
      while (b < n && d2(a, (s + b) % n) < m2) b++;
      if (fanOk(a, (s + b) % n)) { reps.push(a); i = b; }
      else for (; i < b; i++) reps.push((s + i) % n);
    }
    return reps.length < 3 ? all() : Int32Array.from(reps);
  }

  function minDist2ToLoops(x, z, polys) {
    let best = Infinity;
    for (const p of polys) {
      const n = p.length >> 1;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const d = segDist2(x, z, p[2 * j], p[2 * j + 1], p[2 * i], p[2 * i + 1]);
        if (d < best) best = d;
      }
    }
    return best;
  }

  function bbox(polys) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of polys) {
      for (let i = 0; i < p.length; i += 2) {
        if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
        if (p[i + 1] < z0) z0 = p[i + 1]; if (p[i + 1] > z1) z1 = p[i + 1];
      }
    }
    return [x0, z0, x1, z1];
  }

  // Hex lattice points (globally anchored, optionally jittered) passing keep(x, z).
  function hexLattice(polys, S, jitter, keep) {
    const [x0, z0, x1, z1] = bbox(polys), dz = (S * Math.sqrt(3)) / 2, J = jitter * S, out = [];
    for (let j = Math.floor(z0 / dz) - 1, j1 = Math.ceil(z1 / dz) + 1; j <= j1; j++) {
      const off = j & 1 ? 0.5 : 0;
      for (let i = Math.floor(x0 / S - off) - 1, i1 = Math.ceil(x1 / S - off) + 1; i <= i1; i++) {
        let x = (i + off) * S, z = j * dz;
        if (J) { x += J * (2 * hash2(i, j) - 1); z += J * (2 * hash2(j + 7919, i) - 1); }
        if (keep(x, z)) out.push(x, z);
      }
    }
    return out;
  }

  // Per-vertex bevel inset: BEVEL, or less where the material is thin. Marching inward along the
  // normal, the field bottoms out at the medial axis (local half-width, or the radius of a tight
  // convex corner); insetting at most 70% of that keeps rims of facing walls from crossing.
  function insetDepths(L, field) {
    const n = L.pts.length >> 1, raw = new Float64Array(n), out = new Float64Array(n);
    const dt = GRID.h / 4, tmax = BEVEL / 0.7 + dt;
    for (let i = 0; i < n; i++) {
      const x = L.pts[2 * i], z = L.pts[2 * i + 1], nx = L.nrm[2 * i], nz = L.nrm[2 * i + 1];
      let best = Infinity, tb = tmax;
      for (let t = dt; t <= tmax + 1e-9; t += dt) {
        const f = sample(field, x - t * nx, z - t * nz);
        if (f < best) { best = f; tb = t; }
      }
      raw[i] = Math.min(BEVEL, 0.7 * tb);
    }
    for (let i = 0; i < n; i++) {                // min over +-2 neighbours, then a 1-2-1 average
      let m = raw[i];
      for (let k = 1; k <= 2; k++) m = Math.min(m, raw[(i + k) % n], raw[(i + n - k) % n]);
      out[i] = m;
    }
    for (let i = 0; i < n; i++) raw[i] = (out[(i + n - 1) % n] + 2 * out[i] + out[(i + 1) % n]) / 4;
    return raw;
  }

  // Tangential relaxation of a closed ring along its own polyline: inset rings bunch up around
  // convex corners; a few Jacobi passes on the arc-length parameter spread them out while every
  // point stays on the inset curve (and in order, so the ring cannot fold).
  function relaxRing(q, n, iters) {
    const S = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      S[i + 1] = S[i] + Math.hypot(q[2 * j] - q[2 * i], q[2 * j + 1] - q[2 * i + 1]);
    }
    const P = S[n];
    let s = S.slice(0, n), t = new Float64Array(n);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        const prev = i > 0 ? s[i - 1] : s[n - 1] - P, next = i < n - 1 ? s[i + 1] : s[0] + P;
        t[i] = 0.5 * s[i] + 0.25 * (prev + next);
      }
      const u = s; s = t; t = u;
    }
    const out = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      const v = ((s[i] % P) + P) % P;
      let lo = 0, hi = n - 1;                     // last segment start with S <= v
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m] <= v) lo = m; else hi = m - 1; }
      const j = (lo + 1) % n, seg = S[lo + 1] - S[lo], f = seg > 0 ? (v - S[lo]) / seg : 0;
      out[2 * i] = q[2 * lo] + f * (q[2 * j] - q[2 * lo]);
      out[2 * i + 1] = q[2 * lo + 1] + f * (q[2 * j + 1] - q[2 * lo + 1]);
    }
    return out;
  }

  // Watertight render surface: beveled walls swept along every loop + Delaunay caps.
  function buildSurface(loops, field) {
    // 1. Inset rims (the fillets' last ring, shared by top and bottom) and their merged polygons.
    const rims = loops.map((L) => {
      const n = L.pts.length >> 1, q0 = new Float64Array(2 * n), dIn = insetDepths(L, field), P = L.pts, N = L.nrm;
      // A corner sharper than the medial-axis guard sees (the field can keep a sub-cell crease)
      // folds the inset ring back on itself; wherever an inset segment no longer runs forward
      // with its outline segment, halve the inset around it and try again.
      for (let pass = 0; pass < 10; pass++) {
        for (let i = 0; i < 2 * n; i++) q0[i] = P[i] - dIn[i >> 1] * N[i];
        let folded = false;
        for (let i = 0; i < n; i++) {
          const a = 2 * i, b = 2 * ((i + 1) % n), ox = P[b] - P[a], oz = P[b + 1] - P[a + 1];
          if ((q0[b] - q0[a]) * ox + (q0[b + 1] - q0[a + 1]) * oz > 0.1 * (ox * ox + oz * oz)) continue;
          for (let k = i - 2; k <= i + 3; k++) dIn[(k + n) % n] *= 0.5;
          folded = true;
        }
        if (!folded) break;
      }
      const q = relaxRing(q0, n, 6), reps = mergeRim(q, n), poly = new Float64Array(2 * reps.length);
      for (let k = 0; k < reps.length; k++) { poly[2 * k] = q[2 * reps[k]]; poly[2 * k + 1] = q[2 * reps[k] + 1]; }
      return { n, q, reps, poly };
    });
    const polys = rims.map((r) => r.poly), keep = 0.5 * CAP_LAT;

    // 2. Jittered interior lattice kept >= keep inside the rim (field prefilter, exact check near it).
    const lat = hexLattice(polys, CAP_LAT, 0.12, (x, z) => {
      const f = sample(field, x, z);
      if (f > -(BEVEL + 0.01)) return false;
      if (f < -(BEVEL + keep + 0.07)) return true;
      return inside(x, z, polys) && minDist2ToLoops(x, z, polys) >= keep * keep;
    });
    const nLat = lat.length >> 1;

    // 3. Constrained Delaunay of rim representatives + lattice.
    let nRep = 0, nRingV = 0;
    for (const r of rims) nRep += r.reps.length;
    const base = rims.map((r) => { const b = nRingV; nRingV += NRING * r.n; return b; });
    const nV = nRingV + 2 * nLat;
    const pts = new Float64Array(2 * (nRep + nLat)), cons = new Uint32Array(2 * nRep);
    const ptBot = new Int32Array(nRep + nLat);  // 2D point -> bottom vertex
    const toTop = new Int32Array(nV);           // bottom vertex -> matching top vertex
    let p = 0;
    rims.forEach((r, li) => {
      const first = p, m = r.reps.length, up = (NRING - 1) * r.n;
      for (let i = 0; i < r.n; i++) toTop[base[li] + i] = base[li] + up + i;
      for (let k = 0; k < m; k++, p++) {
        pts[2 * p] = r.poly[2 * k]; pts[2 * p + 1] = r.poly[2 * k + 1];
        ptBot[p] = base[li] + r.reps[k];
        cons[2 * p] = p; cons[2 * p + 1] = first + ((k + 1) % m);
      }
    });
    pts.set(lat, 2 * nRep);
    for (let l = 0; l < nLat; l++) { ptBot[nRep + l] = nRingV + nLat + l; toTop[nRingV + nLat + l] = nRingV + l; }
    const tri = delaunay(pts, cons), capT = [];  // cap triangles as bottom vertices, CCW in xz
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t], b = tri[t + 1], c = tri[t + 2];
      const cx = (pts[2 * a] + pts[2 * b] + pts[2 * c]) / 3, cz = (pts[2 * a + 1] + pts[2 * b + 1] + pts[2 * c + 1]) / 3;
      if (inside(cx, cz, polys)) capT.push(ptBot[a], ptBot[b], ptBot[c]);
    }
    // Fans close the gap between each merged chord and the full rim ring it skips.
    rims.forEach((r, li) => {
      const m = r.reps.length, o = base[li];
      for (let k = 0; k < m; k++) {
        const a = r.reps[k], b = r.reps[(k + 1) % m];
        for (let j = (a + 1) % r.n; j !== b; j = (j + 1) % r.n) capT.push(o + a, o + j, o + ((j + 1) % r.n));
      }
    });

    // 4. Vertices: rings per loop (bottom rim first), then lattice tops, then lattice bottoms.
    const pos = new Float32Array(3 * nV);
    loops.forEach((L, li) => {
      const n = rims[li].n, q = rims[li].q;
      for (let j = 0; j < NRING; j++) {
        const f = PROFILE[j][0] / BEVEL, y = PROFILE[j][1], rim = j === 0 || j === NRING - 1;
        for (let i = 0, o = 3 * (base[li] + j * n); i < n; i++, o += 3) {
          const px = L.pts[2 * i], pz = L.pts[2 * i + 1];   // ring = outline -> rim, scaled by the profile
          pos[o] = rim ? q[2 * i] : px + f * (q[2 * i] - px);
          pos[o + 1] = y;
          pos[o + 2] = rim ? q[2 * i + 1] : pz + f * (q[2 * i + 1] - pz);
        }
      }
    });
    for (let l = 0; l < nLat; l++) {
      const ot = 3 * (nRingV + l), ob = 3 * (nRingV + nLat + l);
      pos[ot] = pos[ob] = lat[2 * l];
      pos[ot + 1] = T; pos[ob + 1] = 0;
      pos[ot + 2] = pos[ob + 2] = lat[2 * l + 1];
    }

    // 5. Triangles: walls (shorter diagonal), then caps. CCW in xz faces -y, so the bottom cap
    //    keeps the winding and the top cap reverses it.
    let nWall = 0;
    for (const r of rims) nWall += (NRING - 1) * r.n;
    const index = new Uint32Array(6 * nWall + 2 * capT.length);
    let w = 0;
    rims.forEach((r, li) => {
      const n = r.n;
      for (let j = 0; j < NRING - 1; j++) {
        const lo = base[li] + j * n, up = lo + n;
        for (let i = 0; i < n; i++) {
          const i1 = (i + 1) % n, A = lo + i, B = lo + i1, C = up + i1, D = up + i;
          if (d3(pos, A, C) <= d3(pos, B, D)) { index[w++] = A; index[w++] = C; index[w++] = B; index[w++] = A; index[w++] = D; index[w++] = C; }
          else { index[w++] = A; index[w++] = D; index[w++] = B; index[w++] = B; index[w++] = D; index[w++] = C; }
        }
      }
    });
    for (let t = 0; t < capT.length; t += 3) {
      const a = capT[t], b = capT[t + 1], c = capT[t + 2];
      index[w++] = a; index[w++] = b; index[w++] = c;
      index[w++] = toTop[a]; index[w++] = toTop[c]; index[w++] = toTop[b];
    }
    return { pos, index };
  }

  function d3(pos, a, b) {
    const x = pos[3 * a] - pos[3 * b], y = pos[3 * a + 1] - pos[3 * b + 1], z = pos[3 * a + 2] - pos[3 * b + 2];
    return x * x + y * y + z * z;
  }

  // Greedy simplification of a closed loop: chords up to maxLen of arc, deviating <= tol.
  function simplifyLoop(p, maxLen, tol) {
    const n = p.length >> 1, keep = [0], t2 = tol * tol;
    const P = (i) => 2 * (i % n);
    const chordOk = (i, j) => {
      const a = P(i), b = P(j);
      for (let m = i + 1; m < j; m++) {
        const c = P(m);
        if (segDist2(p[c], p[c + 1], p[a], p[a + 1], p[b], p[b + 1]) > t2) return false;
      }
      return true;
    };
    for (let i = 0; ; ) {
      let j = i + 1, len = Math.hypot(p[P(j)] - p[P(i)], p[P(j) + 1] - p[P(i) + 1]);
      while (j < n) {
        const l2 = len + Math.hypot(p[P(j + 1)] - p[P(j)], p[P(j + 1) + 1] - p[P(j) + 1]);
        if (l2 > maxLen || !chordOk(i, j + 1)) break;
        len = l2; j++;
      }
      if (j >= n) break;
      keep.push(j); i = j;
    }
    if (keep.length < 3) { keep.length = 0; for (let k = 0; k < 3; k++) keep.push(Math.floor((k * n) / 3)); }
    const out = new Float64Array(2 * keep.length);
    keep.forEach((k, q) => { out[2 * q] = p[2 * k]; out[2 * q + 1] = p[2 * k + 1]; });
    return out;
  }

  // Tet mesh: coarse outline + hex lattice -> constrained Delaunay -> 2 prism layers -> 3 tets each.
  function buildSim(loops, field) {
    const sl = loops.map((L) => simplifyLoop(L.pts, SIM_STEP * 1.05, SIM_TOL));
    const lat = hexLattice(sl, SIM_LAT, 0, (x, z) => sample(field, x, z) < -SIM_KEEP && inside(x, z, sl));
    let nB = 0;
    for (const p of sl) nB += p.length >> 1;
    const np = nB + (lat.length >> 1), pts = new Float64Array(2 * np), cons = new Uint32Array(2 * nB);
    let q = 0;
    for (const p of sl) {
      const m = p.length >> 1, first = q;
      for (let k = 0; k < m; k++, q++) {
        pts[2 * q] = p[2 * k]; pts[2 * q + 1] = p[2 * k + 1];
        cons[2 * q] = q; cons[2 * q + 1] = first + ((k + 1) % m);
      }
    }
    pts.set(lat, 2 * nB);
    const tri = delaunay(pts, cons), used = new Int32Array(np).fill(-1), kept = [];
    let nv = 0;
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t], b = tri[t + 1], c = tri[t + 2];
      const cx = (pts[2 * a] + pts[2 * b] + pts[2 * c]) / 3, cz = (pts[2 * a + 1] + pts[2 * b + 1] + pts[2 * c + 1]) / 3;
      if (!inside(cx, cz, sl)) continue;
      for (const v of [a, b, c]) if (used[v] < 0) used[v] = nv++;
      kept.push(used[a], used[b], used[c]);
    }
    const X = new Float32Array(9 * nv);
    for (let i = 0; i < np; i++) {
      const v = used[i];
      if (v < 0) continue;
      for (let l = 0; l < 3; l++) {
        const o = 3 * (l * nv + v);
        X[o] = pts[2 * i]; X[o + 1] = (l * T) / 2; X[o + 2] = pts[2 * i + 1];
      }
    }
    // Prism split by vertex order (a < b < c): each quad face is cut from its lower-index bottom
    // vertex to its higher-index top vertex, so neighbouring prisms share faces exactly.
    const tets = new Uint32Array(kept.length * 8);
    let w = 0;
    const put = (a, b, c, d) => {
      if (tetVol(X, a, b, c, d) < 0) { const s = c; c = d; d = s; }
      tets[w++] = a; tets[w++] = b; tets[w++] = c; tets[w++] = d;
    };
    for (let t = 0; t < kept.length; t += 3) {
      let a = kept[t], b = kept[t + 1], c = kept[t + 2], s;
      if (a > b) { s = a; a = b; b = s; }
      if (b > c) { s = b; b = c; c = s; }
      if (a > b) { s = a; a = b; b = s; }
      for (let l = 0; l < 2; l++) {
        const o0 = l * nv, o1 = o0 + nv;
        put(a + o0, b + o0, c + o0, c + o1);
        put(a + o0, b + o0, b + o1, c + o1);
        put(a + o0, a + o1, b + o1, c + o1);
      }
    }
    return { X, tets };
  }

  function tetVol(X, a, b, c, d) {
    const ax = X[3 * a], ay = X[3 * a + 1], az = X[3 * a + 2];
    const bx = X[3 * b] - ax, by = X[3 * b + 1] - ay, bz = X[3 * b + 2] - az;
    const cx = X[3 * c] - ax, cy = X[3 * c + 1] - ay, cz = X[3 * c + 2] - az;
    const dx = X[3 * d] - ax, dy = X[3 * d + 1] - ay, dz = X[3 * d + 2] - az;
    return (bx * (cy * dz - cz * dy) - by * (cx * dz - cz * dx) + bz * (cx * dy - cy * dx)) / 6;
  }

  /** Meshes for one piece: render surface, sim tets, the specimen's inclusions and its outline loops. */
  function buildPiece(region) {
    const loops = outlineLoops(region.field, GRID);
    let area = 0;
    for (const L of loops) area += polyArea(L.pts);
    return {
      area,
      render: buildSurface(loops, region.field),
      sim: buildSim(loops, region.field),
      ...inclusions(region.field, kernel),
      loops,
    };
  }

  const kernel = {
    T, ROUND, MIN_AREA, BEVEL, GRID, WAVE_A, WAVE_L,
    // toolkit
    polyArea, segDist2, hash2, mulberry32, sample, edt, roundRegion, signedField, components, contours, delaunay, inside,
    // regions
    sliceSdf, sliceRegion, splitByLine, splitByWave, splitByCutter, get cutterShapes() { return cutterShapes(); },
    // meshing
    buildPiece, tetVol,
  };
  return kernel;
}
