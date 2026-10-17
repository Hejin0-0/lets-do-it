// ---------------------------------------------------------------------------
// DiceGeo: one gummy die in its rest frame (centred at the origin, edge 2A).
//  - a hex lattice of NL^3 nodes, boundary nodes snapped onto the rounded box, 8-node cells, each
//    split into 5 tets (alternating parity, so the split conforms across faces);
//  - the render skin: six face grids spaced evenly in arc length (so the rounded edges get their
//    share), projected onto the rounded box, with shallow concave dimples at the pips; welded;
//  - the pips: flattened ivory lenses just under each dimple;
//  - the exact rounded-box SDF (for contacts) and which face is which.
// ---------------------------------------------------------------------------
export const DiceGeo = (() => {
  const A = 0.5, RC = 0.17, NL = 6, G = 52;
  const PIP = { s: 0.215, rd: 0.088, depth: 0.02, r: 0.064, ht: 0.013, gap: 0.006 };
  // faces: outward normal N, in-face axes U, V (U x V = N), value (opposite faces sum to 7)
  const FACES = [
    { N: [1, 0, 0], U: [0, 1, 0], V: [0, 0, 1], value: 2 },
    { N: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0], value: 5 },
    { N: [0, 1, 0], U: [0, 0, 1], V: [1, 0, 0], value: 1 },
    { N: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1], value: 6 },
    { N: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0], value: 3 },
    { N: [0, 0, -1], U: [0, 1, 0], V: [1, 0, 0], value: 4 },
  ];
  const PATTERN = (v) => {
    const s = PIP.s;
    return {
      1: [[0, 0]], 2: [[-s, -s], [s, s]], 3: [[-s, -s], [0, 0], [s, s]], 4: [[-s, -s], [-s, s], [s, -s], [s, s]],
      5: [[-s, -s], [-s, s], [0, 0], [s, -s], [s, s]], 6: [[-s, -s], [-s, 0], [-s, s], [s, -s], [s, 0], [s, s]],
    }[v];
  };

  // Rounded box: the points within RC of the inner box [-(A-RC), A-RC]^3.
  const IN = A - RC;
  const clampIn = (v) => (v < -IN ? -IN : v > IN ? IN : v);
  /** A point on (or near) the cube's surface, onto the rounded box: [point, outward normal]. */
  function project(p) {
    const q = [clampIn(p[0]), clampIn(p[1]), clampIn(p[2])], d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const n = [d[0] / L, d[1] / L, d[2] / L];
    return [[q[0] + n[0] * RC, q[1] + n[1] * RC, q[2] + n[2] * RC], n];
  }
  /** Exact SDF of the rounded box: out[0] = distance, out[1..3] = unit gradient. */
  function sdf(x, y, z, out) {
    const qx = Math.abs(x) - IN, qy = Math.abs(y) - IN, qz = Math.abs(z) - IN;
    const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0), L = Math.sqrt(mx * mx + my * my + mz * mz);
    if (L > 0) {
      out[0] = L - RC; out[1] = (mx / L) * Math.sign(x); out[2] = (my / L) * Math.sign(y); out[3] = (mz / L) * Math.sign(z);
    } else {   // inside the inner box: out through the nearest face
      const m = Math.max(qx, qy, qz);
      out[0] = m - RC; out[1] = out[2] = out[3] = 0;
      if (m === qx) out[1] = Math.sign(x) || 1; else if (m === qy) out[2] = Math.sign(y) || 1; else out[3] = Math.sign(z) || 1;
    }
    return out;
  }

  // Face coordinate in [-A, A] for u in [-1, 1], evenly spaced in arc length once projected.
  const LF = IN + (RC * Math.PI) / 4;
  function faceCoord(u) {
    const t = Math.abs(u) * LF, s = t <= IN ? t : IN + RC * Math.tan((t - IN) / RC);
    return Math.sign(u) * Math.min(s, A);
  }

  function build(embed) {
    // ----- lattice -----
    const h = (2 * A) / (NL - 1), X = new Float32Array(NL * NL * NL * 3), id = (i, j, k) => (i * NL + j) * NL + k;
    for (let i = 0; i < NL; i++) for (let j = 0; j < NL; j++) for (let k = 0; k < NL; k++) {
      let p = [-A + i * h, -A + j * h, -A + k * h];
      if (i === 0 || j === 0 || k === 0 || i === NL - 1 || j === NL - 1 || k === NL - 1) p = project(p)[0];
      X.set(p, 3 * id(i, j, k));
    }
    const cells = [], tets = [], edgeSet = new Set();
    // the 5-tet split of a cube with corners c[bits zyx]; odd cells use the mirrored split
    const EVEN = [[0, 1, 2, 4], [3, 1, 2, 7], [5, 1, 4, 7], [6, 2, 4, 7], [1, 2, 4, 7]];
    const ODD = [[1, 0, 3, 5], [2, 0, 3, 6], [4, 0, 5, 6], [7, 3, 5, 6], [0, 3, 5, 6]];
    for (let i = 0; i < NL - 1; i++) for (let j = 0; j < NL - 1; j++) for (let k = 0; k < NL - 1; k++) {
      const c = [];
      for (let b = 0; b < 8; b++) c.push(id(i + (b & 1), j + ((b >> 1) & 1), k + ((b >> 2) & 1)));
      cells.push(...c);
      for (const t of (i + j + k) & 1 ? ODD : EVEN) tets.push(c[t[0]], c[t[1]], c[t[2]], c[t[3]]);
      for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) {
        edgeSet.add(Math.min(c[a], c[b]) * 4096 + Math.max(c[a], c[b]));
      }
    }
    const latticeEdges = new Uint32Array(edgeSet.size * 2);
    let e = 0;
    for (const key of edgeSet) { latticeEdges[e++] = Math.floor(key / 4096); latticeEdges[e++] = key % 4096; }

    // ----- skin -----
    const pos = [], nrm = [], index = [], weld = new Map(), coords = [];
    for (let g = 0; g <= G; g++) coords.push(faceCoord((2 * g) / G - 1));
    const D = PIP.depth, RD = PIP.rd;
    for (const f of FACES) {
      const pips = PATTERN(f.value), ids = [];
      for (let r = 0; r <= G; r++) for (let c = 0; c <= G; c++) {
        const a = coords[r], b = coords[c];
        let [p, n] = project([0, 1, 2].map((k) => f.N[k] * A + f.U[k] * a + f.V[k] * b));
        // dimples (in the flat region): p -= N delta(u, v), n ~ N + delta_u U + delta_v V
        let du = 0, dv = 0, dl = 0;
        for (const [pu, pv] of pips) {
          const x = a - pu, y = b - pv, rho = Math.hypot(x, y);
          if (rho >= RD) continue;
          const t = 1 - (rho / RD) ** 2;
          dl += D * t * t;
          if (rho > 1e-9) { const dd = (-4 * D * rho * t) / (RD * RD); du += (dd * x) / rho; dv += (dd * y) / rho; }
        }
        if (dl > 0) {
          p = p.map((v, k) => v - f.N[k] * dl);
          const m = [0, 1, 2].map((k) => f.N[k] + du * f.U[k] + dv * f.V[k]), L = Math.hypot(...m);
          n = m.map((v) => v / L);
        }
        const key = p.map((v) => Math.round(v * 1e5)).join(',');
        let vi = weld.get(key);
        if (vi === undefined) { vi = pos.length / 3; weld.set(key, vi); pos.push(...p); nrm.push(...n); }
        ids.push(vi);
      }
      for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
        const i00 = ids[r * (G + 1) + c], i10 = ids[(r + 1) * (G + 1) + c], i11 = ids[(r + 1) * (G + 1) + c + 1], i01 = ids[r * (G + 1) + c + 1];
        // split along the shorter diagonal (cleaner on the rounded edges)
        if (dist2(pos, i00, i11) <= dist2(pos, i10, i01)) index.push(i00, i10, i11, i00, i11, i01);
        else index.push(i00, i10, i01, i10, i11, i01);
      }
    }

    // ----- pips: flattened lenses just under each dimple, the face normal as their axis -----
    const pipPos = [], pipNrm = [], pipIndex = [], ST = 8, SL = 16;
    for (const f of FACES) for (const [pu, pv] of PATTERN(f.value)) {
      const top = A - D - PIP.gap, c = [0, 1, 2].map((k) => f.N[k] * (top - PIP.ht) + f.U[k] * pu + f.V[k] * pv);
      const base = pipPos.length / 3;
      for (let i = 0; i <= ST; i++) {
        const th = (i / ST) * Math.PI, ct = Math.cos(th), st = Math.sin(th);
        for (let j = 0; j < SL; j++) {
          const ph = (j / SL) * 2 * Math.PI, lx = PIP.r * st * Math.cos(ph), ly = PIP.r * st * Math.sin(ph), lz = PIP.ht * ct;
          for (let k = 0; k < 3; k++) pipPos.push(c[k] + f.U[k] * lx + f.V[k] * ly + f.N[k] * lz);
          const m = [0, 1, 2].map((k) => f.U[k] * (lx / PIP.r ** 2) + f.V[k] * (ly / PIP.r ** 2) + f.N[k] * (lz / PIP.ht ** 2)), L = Math.hypot(...m) || 1;
          pipNrm.push(...m.map((v) => v / L));
        }
      }
      for (let i = 0; i < ST; i++) for (let j = 0; j < SL; j++) {
        const a = base + i * SL + j, b = base + i * SL + ((j + 1) % SL);
        pipIndex.push(a, a + SL, b + SL, a, b + SL, b);
      }
    }
    for (let t = 0; t < pipIndex.length; t += 3) {   // wind outward, agreeing with the normals
      const a = pipIndex[t], b = pipIndex[t + 1], c = pipIndex[t + 2];
      const n = cross3(sub3(pipPos, b, a), sub3(pipPos, c, a));
      const m = [0, 1, 2].map((k) => pipNrm[3 * a + k] + pipNrm[3 * b + k] + pipNrm[3 * c + k]);
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) { pipIndex[t + 1] = c; pipIndex[t + 2] = b; }
    }

    const tetsU = Uint32Array.from(tets);
    const skin = { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), index: Uint32Array.from(index) };
    const pip = { pos: Float32Array.from(pipPos), nrm: Float32Array.from(pipNrm), index: Uint32Array.from(pipIndex) };
    const all = new Float32Array(skin.pos.length + pip.pos.length);   // skin points, then pip points
    all.set(skin.pos); all.set(pip.pos, skin.pos.length);
    const emb = embed ? embed(X, tetsU, all) : null;
    return { X, tets: tetsU, cells: Uint32Array.from(cells), latticeEdges, skin, pip, emb };
  }
  const dist2 = (P, i, j) => (P[3 * i] - P[3 * j]) ** 2 + (P[3 * i + 1] - P[3 * j + 1]) ** 2 + (P[3 * i + 2] - P[3 * j + 2]) ** 2;
  const sub3 = (P, i, j) => [P[3 * i] - P[3 * j], P[3 * i + 1] - P[3 * j + 1], P[3 * i + 2] - P[3 * j + 2]];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /** The face pointing most along `up` (a unit vector in the die's rest frame): { value, align }. */
  function topFace(up) {
    let best = FACES[0], bd = -Infinity;
    for (const f of FACES) { const d = f.N[0] * up[0] + f.N[1] * up[1] + f.N[2] * up[2]; if (d > bd) { bd = d; best = f; } }
    return { value: best.value, align: bd };
  }
  /** Rotation (row-major 3x3, rest -> world) that puts face `value` on top (Rodrigues, n onto +y). */
  function faceUp(value) {
    const [n0, c, n2] = FACES.find((q) => q.value === value).N;
    if (c < -0.5) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
    const s = 1 / (1 + c);
    return [c + n2 * n2 * s, -n0, -n0 * n2 * s, n0, c, n2, -n0 * n2 * s, -n2, c + n0 * n0 * s];
  }
  // The frosted-glass plate: its top is the floor (y = 0); a rolled rim stands round a rounded rectangle.
  // The rim's inner face is the wall the dice meet (as tall as it needs to be: they never leave the plate).
  const PLATE = { hx: 2.95, hz: 2.05, r: 0.55, thick: 0.12, rimR: 0.1, wall: 0.22, rimY: 0.035 };   // wall: inset of the rim's inner face; rimY: its tube centre
  const sdRoundRect = (x, z, hx, hz, r) => {
    const qx = Math.abs(x) - hx + r, qz = Math.abs(z) - hz + r;
    const ax = Math.max(qx, 0), az = Math.max(qz, 0);
    return Math.sqrt(ax * ax + az * az) + Math.min(Math.max(qx, qz), 0) - r;
  };
  /** Collider for the plate's rim: pushes awake particles back inside its inner face. */
  function rimCollider(world) {
    const P0 = PLATE, hx = P0.hx - P0.wall, hz = P0.hz - P0.wall, r = P0.r - P0.wall, e = 1e-4;
    return (P, V, n) => {
      const aw = world.awake, pc = world.piece;
      for (let p = 0; p < n; p++) {
        if (!aw[pc[p]]) continue;
        const i = 3 * p, x = P[i], z = P[i + 2], d = sdRoundRect(x, z, hx, hz, r);
        if (d <= 0) continue;
        const gx = (sdRoundRect(x + e, z, hx, hz, r) - sdRoundRect(x - e, z, hx, hz, r)) / (2 * e);
        const gz = (sdRoundRect(x, z + e, hx, hz, r) - sdRoundRect(x, z - e, hx, hz, r)) / (2 * e);
        const gl = Math.hypot(gx, gz) || 1;
        P[i] -= (gx / gl) * d; P[i + 2] -= (gz / gl) * d;
      }
    };
  }
  return { A, RC, NL, G, PIP, FACES, PLATE, build, sdf, topFace, faceUp, project, rimCollider, sdRoundRect };
})();
