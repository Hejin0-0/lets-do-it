// The sea in a jelly block: linear shallow water on a staggered grid (heights at cell centres, velocities
// on the faces), a little surface tension so short ripples spring back like jelly, wet and dry cells over
// a terrain. CPU, a few hundred microseconds a step at 168². Coordinates: block-local x, z in [-half, half].
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/**
 * o: { N (cells a side), half (half the footprint), terrain: Float32Array(N*N) cell-centre heights, level,
 *      regions?: Uint8Array(N*N) (a body of water per cell, dry cells too: the body they would join), levels?: [rest level per body] }
 * h: height above the cell's rest level; u[j*(N+1)+i]: face between cells (i-1, j) and (i, j);
 * w[j*N+i]: face between (i, j-1) and (i, j). Faces between two bodies stay shut until link(a, b).
 */
export function createShallowWater({ N, half, terrain, level, regions, levels }) {
  const HALF = half, GDX = (2 * half) / N, n = N * N, NU = (N + 1) * N;
  const T = terrain, D = new Float32Array(n), wet = new Uint8Array(n);
  const h = new Float32Array(n), L = new Float32Array(n);
  const u = new Float32Array(NU), w = new Float32Array(NU), Du = new Float32Array(NU), Dw = new Float32Array(NU);
  const reg = regions || new Uint8Array(n), NR = levels ? levels.length : 1, lev = Float32Array.from(levels || [level]);
  const linked = new Uint8Array(NR * NR), cnt = new Float32Array(NR), sums = new Float64Array(NR);
  for (let k = 0; k < NR; k++) linked[k * NR + k] = 1;
  const W = { N, half, dx: GDX, h, u, w, D, T, wet, level: lev[0], levels: lev, regions: reg, firm: 0.5, damp: 0.3, energy: 0, wetCount: 0, resets: 0 };
  W.g = () => 3.4 * (0.75 + 0.5 * W.firm);
  const open = (a, b) => wet[a] && wet[b] && linked[reg[a] * NR + reg[b]];
  function faces() {
    for (let j = 0; j < N; j++) for (let i = 0; i <= N; i++) {
      const f = j * (N + 1) + i, a = j * N + i - 1, b = j * N + i;
      Du[f] = i > 0 && i < N && open(a, b) ? Math.min(D[a], D[b]) : 0;
      if (!Du[f]) u[f] = 0;
    }
    for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) {
      const f = j * N + i, a = (j - 1) * N + i, b = j * N + i;
      Dw[f] = j > 0 && j < N && open(a, b) ? Math.min(D[a], D[b]) : 0;
      if (!Dw[f]) w[f] = 0;
    }
  }
  /** Set body k's rest level (default the first). */
  W.setLevel = (lv, k = 0) => {
    lev[k] = lv;
    if (k === 0) W.level = lv;
    let c = 0;
    cnt.fill(0);
    for (let q = 0; q < n; q++) { D[q] = lev[reg[q]] - T[q]; wet[q] = D[q] >= 0.012 ? 1 : 0; if (wet[q]) { c++; cnt[reg[q]]++; } else h[q] = 0; }
    W.wetCount = c;
    faces();
  };
  /** Open or shut the way between bodies a and b. */
  W.link = (a, b, on) => { linked[a * NR + b] = linked[b * NR + a] = on ? 1 : 0; faces(); };
  W.isLinked = (a, b) => linked[a * NR + b] === 1;
  W.flat = () => { h.fill(0); u.fill(0); w.fill(0); W.energy = 0; };
  /** One step. fx, fz: in-plane body force (the block's tilt). */
  W.step = (dt, fx, fz) => {
    const g = W.g(), sig = 0.00012 * (0.5 + W.firm), k = Math.exp(-(0.18 + 1.6 * W.damp) * dt), idx = 1 / GDX, idx2 = idx * idx;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {   // Laplacian, Neumann at dry cells and the walls
      const c = j * N + i;
      if (!wet[c]) { L[c] = 0; continue; }
      const hc = h[c];
      const e = i < N - 1 && wet[c + 1] ? h[c + 1] : hc, ww = i > 0 && wet[c - 1] ? h[c - 1] : hc;
      const nn = j < N - 1 && wet[c + N] ? h[c + N] : hc, s = j > 0 && wet[c - N] ? h[c - N] : hc;
      L[c] = (e + ww + nn + s - 4 * hc) * idx2;
    }
    const ax = fx * dt, az = fz * dt;
    for (let j = 0; j < N; j++) {
      const r = j * (N + 1), cr = j * N;
      for (let i = 1; i < N; i++) {
        const f = r + i;
        if (!Du[f]) continue;
        const a = cr + i - 1, b = a + 1;
        u[f] = (u[f] + dt * idx * (-g * (h[b] - h[a]) + sig * (L[b] - L[a])) + ax) * k;
      }
    }
    for (let f = N; f < N * N; f++) {
      if (!Dw[f]) continue;
      const a = f - N;
      w[f] = (w[f] + dt * idx * (-g * (h[f] - h[a]) + sig * (L[f] - L[a])) + az) * k;
    }
    sums.fill(0);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i;
      if (!wet[c]) continue;
      const fu = j * (N + 1) + i;
      let v = h[c] - dt * idx * (Du[fu + 1] * u[fu + 1] - Du[fu] * u[fu] + Dw[c + N] * w[c + N] - Dw[c] * w[c]);
      const lo = -0.9 * D[c];
      v = v < lo ? lo : v > 0.45 ? 0.45 : v;
      h[c] = v; sums[reg[c]] += v;
    }
    // each body drifts back to its rest level
    const kd = Math.min(1, 1.5 * dt);
    for (let k = 0; k < NR; k++) sums[k] = (sums[k] / Math.max(1, cnt[k])) * kd;
    let e2 = 0;
    for (let c = 0; c < n; c++) if (wet[c]) { h[c] -= sums[reg[c]]; e2 += h[c] * h[c]; }
    if (!Number.isFinite(e2)) { W.flat(); W.resets++; return; }   // the sea went bad: reset it silently
    W.energy = e2;
  };
  // sampling (cell-centred bilinear, clamped)
  W.height = (x, z) => {
    const gx = clamp((x + HALF) / GDX - 0.5, 0, N - 1.001), gz = clamp((z + HALF) / GDX - 0.5, 0, N - 1.001);
    const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j, c = j * N + i;
    const a = h[c], b = h[c + 1], cc = h[c + N], d = h[c + N + 1];
    return (a + (b - a) * fx) * (1 - fz) + (cc + (d - cc) * fx) * fz;
  };
  /** The rest level and the body of water at a point. */
  W.levelAt = (x, z) => lev[reg[W.cell(x, z)]];
  W.regionAt = (x, z) => reg[W.cell(x, z)];
  /** The water surface's height at a point (rest level plus the wave). */
  W.surface = (x, z) => W.levelAt(x, z) + W.height(x, z);
  W.grad = (x, z, out = [0, 0]) => {
    out[0] = (W.height(x + GDX, z) - W.height(x - GDX, z)) / (2 * GDX);
    out[1] = (W.height(x, z + GDX) - W.height(x, z - GDX)) / (2 * GDX);
    return out;
  };
  W.cell = (x, z) => clamp(Math.floor((z + HALF) / GDX), 0, N - 1) * N + clamp(Math.floor((x + HALF) / GDX), 0, N - 1);
  W.flow = (x, z, out = [0, 0]) => {
    const c = W.cell(x, z), i = c % N, j = (c / N) | 0, fu = j * (N + 1) + i;
    out[0] = 0.5 * (u[fu] + u[fu + 1]); out[1] = 0.5 * (w[c] + w[c + N]);
    return out;
  };
  W.isWet = (x, z) => wet[W.cell(x, z)] === 1;
  /** A Gaussian bump of exactly `vol` (wet cells only). */
  W.addVolume = (x, z, vol, rad) => {
    const r = Math.min(rad * 2.5, 0.5), i0 = Math.max(0, Math.floor((x - r + HALF) / GDX)), i1 = Math.min(N - 1, Math.floor((x + r + HALF) / GDX));
    const j0 = Math.max(0, Math.floor((z - r + HALF) / GDX)), j1 = Math.min(N - 1, Math.floor((z + r + HALF) / GDX));
    const k2 = -1 / (2 * rad * rad);
    let sum = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * N + i;
      if (!wet[c]) continue;
      const dx = -HALF + (i + 0.5) * GDX - x, dz = -HALF + (j + 0.5) * GDX - z;
      sum += Math.exp((dx * dx + dz * dz) * k2);
    }
    if (sum < 1e-9) return 0;
    const s = vol / (sum * GDX * GDX);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * N + i;
      if (!wet[c]) continue;
      const dx = -HALF + (i + 0.5) * GDX - x, dz = -HALF + (j + 0.5) * GDX - z;
      h[c] += s * Math.exp((dx * dx + dz * dz) * k2);
    }
    return vol;
  };
  W.stir = (x, z, speed) => W.addVolume(x, z, -0.0016 * (0.35 + clamp(speed, 0, 3)), 0.085);
  W.volume = () => { let s = 0; for (let c = 0; c < n; c++) if (wet[c]) s += h[c]; return s * GDX * GDX; };
  /** (surface height, dh/dx, dh/dz, terrain) per cell, for the GPU. A dry cell's surface is its rest level. */
  W.pack = (out) => {
    const i2 = 0.5 / GDX;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = j * N + i, o = 4 * c, hc = h[c], lv = lev[reg[c]];
      if (!wet[c]) { out[o] = lv; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = T[c]; continue; }
      const e = i < N - 1 && wet[c + 1] ? h[c + 1] : hc, ww = i > 0 && wet[c - 1] ? h[c - 1] : hc;
      const nn = j < N - 1 && wet[c + N] ? h[c + N] : hc, s = j > 0 && wet[c - N] ? h[c - N] : hc;
      out[o] = lv + hc; out[o + 1] = (e - ww) * i2; out[o + 2] = (nn - s) * i2; out[o + 3] = T[c];
    }
    return out;
  };
  W.setLevel(lev[0]);
  return W;
}

/** Cell-centre terrain heights for a grid of N² over [-half, half]². */
export function terrainGrid(N, half, terrainH) {
  const T = new Float32Array(N * N), dx = (2 * half) / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) T[j * N + i] = terrainH(-half + (i + 0.5) * dx, -half + (j + 0.5) * dx);
  return T;
}
/** Bodies of water per cell: seed(x, z, terrain) names the body of a cell that holds water (or -1); every other cell joins its nearest. */
export function regionMap(N, half, T, seed) {
  const dx = (2 * half) / N, R = new Uint8Array(N * N).fill(255), q = new Int32Array(N * N);
  let head = 0, tail = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i, k = seed(-half + (i + 0.5) * dx, -half + (j + 0.5) * dx, T[c]);
    if (k >= 0) { R[c] = k; q[tail++] = c; }
  }
  while (head < tail) {
    const c = q[head++], i = c % N, j = (c / N) | 0;
    for (const nb of [i > 0 ? c - 1 : -1, i < N - 1 ? c + 1 : -1, j > 0 ? c - N : -1, j < N - 1 ? c + N : -1]) {
      if (nb >= 0 && R[nb] === 255) { R[nb] = R[c]; q[tail++] = nb; }
    }
  }
  return R;
}
