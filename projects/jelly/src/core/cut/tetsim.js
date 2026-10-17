// The XPBD soft-body solver every cut-able jelly shares (the melon and citrus slices, the press's
// fruits): one world of pieces, each a region of a shared rest plane meshed as tets.
//
// Every piece is a region of one shared rest plane (x right, z up the slice,
// y up through the thickness), meshed as tets. Per substep (XPBD small steps):
//   predict -> hand -> (untangle pieces with inside-out tets)
//   -> per-tet co-rotational shape matching + compliant volume
//   -> hand reach (long-range attachment) -> hard edge strain limits -> inter-piece collisions
//   -> world.collider -> floor -> velocities (with floor friction)
//   -> edge damping -> settling damping + speed cap.
// A NaN guard after each step restores the last good state.
/**
 * cfg (all optional):
 *   ZC, RIND_R     tets whose centroid lies farther than RIND_R from (0, ZC) in the rest plane are rind
 *   RIND_GAIN      rind stiffness multiplier (2.5)
 *   DENSITY        simulation mass per unit volume (1)
 *   massScale      grams per simulation mass unit, keScale: microjoules per unit of sum m v^2
 *                  (default: 1 unit = 3.5 cm of gummy at 1.3 g/cm^3)
 *   SUBSTEPS (8), STIFF_K (0.8), COMPRESS_MIN (0.4), RELEASE_V (3)
 *   PIN            particles on the floor (or flagged by a press) can't move vertically in the volume
 *                  constraint, so a squashed slab spreads instead of losing volume
 *   ROLL           rolling resistance on the floor (share of a resting piece's spin removed per substep)
 */
export function tetSim(cfg = {}) {

  // ---- Shared rest-plane geometry (contract with the mesher) ----------------
  const { ZC = 0, RIND_R = Infinity, RIND_GAIN = 2.5, DENSITY = 1 } = cfg;
  const CM_PER_U = 3.5, G_PER_U3 = 1.3 * CM_PER_U ** 3;
  const massScale = cfg.massScale ?? G_PER_U3, keScale = cfg.keScale ?? 0.5 * G_PER_U3 * 1e-3 * (CM_PER_U / 100) ** 2 * 1e6;

  // ---- Solver tuning ---------------------------------------------------------
  const { SUBSTEPS = 8, STIFF_K = 0.8, COMPRESS_MIN = 0.4, RELEASE_V = 3, PIN = false, ROLL = 0 } = cfg;
  const MAX_DT = 1 / 30;           // longer steps are clamped: the solver is tuned for frame-sized steps
  // Strain stiffening: relative goal deviation E0 -> E1 ramps the tet's goal fraction up to STIFF_K.
  const STIFF_E0 = 0.1, STIFF_E1 = 0.35;
  const ROT_ITERS = 1;            // warm-started quaternion iterations per tet per substep
  const STRETCH_MAX = 1.8;        // hard edge limits, x rest length
  const STRETCH2 = STRETCH_MAX * STRETCH_MAX, COMPRESS2 = COMPRESS_MIN * COMPRESS_MIN;
  const STRAIN_ROUNDS = 12;       // max projection rounds per substep
  const MU_S = 0.8, MU_K = 0.5;   // floor friction (static, kinetic)
  const VMAX = 20;                // speed cap, units/s
  const BULK = 2e4;               // volume stiffness: compliance = V0 / BULK
  const SETTLE_V = 0.08;          // rms speed below which a supported piece gets settling damping
  const SETTLE_RATE = 0.12;       // max extra velocity damping per substep when fully still
  const COLL_D = 0.11, COLL_DMIN = 0.03, COLL_PUSH = 0.02;
  const HAND_K = 0.3;             // soft attachment: fraction of the gap closed per substep
  const HAND_REACH = 1.1;         // how far past its grab distance the hand may pull from the centroid
  const HAND_YMIN = 0.02;
  const HELD_W = 0.3;             // patch particles at least this attached are anchors for the strain limits
  const LRA = 1.5;                // held piece: max distance from the grabbed particle, x rest distance
  const NUDGE_V = 3, NUDGE_SPIN = 1.4;
  const NUDGE_FLOOR = 0.01;       // a piece whose lowest particle is this close to the board is on it

  // Firmness 0..100 -> per-tet shape-matching frequency (rad/s), log-interpolated.
  const W_SOFT = 2 * Math.PI * 7, W_SET = 2 * Math.PI * 80;
  // Damping 0..100 -> fraction of relative edge velocity removed per substep.
  const B_LIVELY = 0.004, B_SYRUP = 0.3;
  // Damping 0..100 -> fraction of each particle's deviation from its piece's rigid
  // velocity removed per substep. Edge damping alone barely touches slow bending
  // modes (little strain rate for a lot of motion); this makes 100 properly syrupy.
  const KD_SYRUP = 0.2;
  // Untangling (see step): pull per substep toward the rigid rest shape while a piece has
  // inside-out tets, fading out over UNTANGLE_HOLD substeps (0.5 s) after the last one.
  const UNTANGLE_B = 0.05, UNTANGLE_HOLD = 240;

  // embed(): points this close outside the mesh are extrapolated, if no weight is below -EMBED_W.
  const EMBED_BAND = 0.03, EMBED_W = 0.5;

  const clamp = (a, lo, hi) => (a < lo ? lo : a > hi ? hi : a);
  const px = (p) => (p.x !== undefined ? p.x : p[0]);
  const py = (p) => (p.y !== undefined ? p.y : p[1]);
  const pz = (p) => (p.z !== undefined ? p.z : p[2]);

  // ---- Rotation helpers ------------------------------------------------------

  // Müller et al. 2016, "A Robust Method to Extract the Rotational Part of
  // Deformations": rotates quaternion q[o..o+3] (x, y, z, w) toward the
  // rotational part of A (row-major 3x3). The exact axis-angle step is replaced
  // by the normalised first-order quaternion (w/2, 1): same direction, angle
  // 2*atan(|w|/2), so it still converges and needs no sin/cos.
  function extractRotation(A, q, o, iters) {
    const a00 = A[0], a01 = A[1], a02 = A[2], a10 = A[3], a11 = A[4], a12 = A[5], a20 = A[6], a21 = A[7], a22 = A[8];
    let qx = q[o], qy = q[o + 1], qz = q[o + 2], qw = q[o + 3];
    for (let it = 0; it < iters; it++) {
      const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz;
      const r00 = 1 - 2 * (yy + zz), r01 = 2 * (xy - wz), r02 = 2 * (xz + wy);
      const r10 = 2 * (xy + wz), r11 = 1 - 2 * (xx + zz), r12 = 2 * (yz - wx);
      const r20 = 2 * (xz - wy), r21 = 2 * (yz + wx), r22 = 1 - 2 * (xx + yy);
      const ox = r10 * a20 - r20 * a10 + r11 * a21 - r21 * a11 + r12 * a22 - r22 * a12;
      const oy = r20 * a00 - r00 * a20 + r21 * a01 - r01 * a21 + r22 * a02 - r02 * a22;
      const oz = r00 * a10 - r10 * a00 + r01 * a11 - r11 * a01 + r02 * a12 - r12 * a02;
      const s = 0.5 / (Math.abs(r00 * a00 + r10 * a10 + r20 * a20 + r01 * a01 + r11 * a11 + r21 * a21 + r02 * a02 + r12 * a12 + r22 * a22) + 1e-12);
      const hx = ox * s, hy = oy * s, hz = oz * s;
      if (hx * hx + hy * hy + hz * hz < 1e-22) break;
      const nw = qw - hx * qx - hy * qy - hz * qz;
      const nx = qx + hx * qw + hy * qz - hz * qy;
      const ny = qy + hy * qw + hz * qx - hx * qz;
      const nz = qz + hz * qw + hx * qy - hy * qx;
      const il = 1 / Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
      qx = nx * il; qy = ny * il; qz = nz * il; qw = nw * il;
    }
    q[o] = qx; q[o + 1] = qy; q[o + 2] = qz; q[o + 3] = qw;
  }

  // Rotation maximising trace(R^T A) for A = sum m (x - c)(X - C)^T (row-major), into
  // q[o..o+3] (x, y, z, w). Horn 1987: the top eigenvector of a symmetric 4x4, found by
  // cyclic Jacobi. Global, so unlike a warm-started iteration it cannot sit at a
  // 180-degree saddle (a piece flipped over in one go). Not for the per-tet hot loop.
  const N16 = new Float64Array(16), V16 = new Float64Array(16);
  function bestRotation(A, q, o) {
    // S = A^T: S_ab = sum X_a x_b.
    const xx = A[0], yy = A[4], zz = A[8], xy = A[3], xz = A[6], yx = A[1], yz = A[7], zx = A[2], zy = A[5];
    const N = N16, V = V16;
    N[0] = xx + yy + zz; N[1] = yz - zy; N[2] = zx - xz; N[3] = xy - yx;
    N[5] = xx - yy - zz; N[6] = xy + yx; N[7] = zx + xz;
    N[10] = -xx + yy - zz; N[11] = yz + zy;
    N[15] = -xx - yy + zz;
    N[4] = N[1]; N[8] = N[2]; N[12] = N[3]; N[9] = N[6]; N[13] = N[7]; N[14] = N[11];
    V.fill(0); V[0] = V[5] = V[10] = V[15] = 1;
    let scale = 0;
    for (let k = 0; k < 16; k++) scale += N[k] * N[k];
    for (let sweep = 0; sweep < 30; sweep++) {
      let off = 0;
      for (let r = 0; r < 4; r++) for (let c = r + 1; c < 4; c++) off += N[4 * r + c] * N[4 * r + c];
      if (!(off > 1e-30 * scale)) break;
      for (let p = 0; p < 3; p++) {
        for (let r = p + 1; r < 4; r++) {
          const apr = N[4 * p + r];
          if (apr === 0) continue;
          const th = (N[5 * r] - N[5 * p]) / (2 * apr);
          const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let k = 0; k < 4; k++) {   // N <- N J (columns p, r), V <- V J
            const kp = N[4 * k + p], kr = N[4 * k + r];
            N[4 * k + p] = c * kp - s * kr; N[4 * k + r] = s * kp + c * kr;
            const vp = V[4 * k + p], vr = V[4 * k + r];
            V[4 * k + p] = c * vp - s * vr; V[4 * k + r] = s * vp + c * vr;
          }
          for (let k = 0; k < 4; k++) {   // N <- J^T N (rows p, r)
            const pk = N[4 * p + k], rk = N[4 * r + k];
            N[4 * p + k] = c * pk - s * rk; N[4 * r + k] = s * pk + c * rk;
          }
        }
      }
    }
    let j = 0;
    for (let k = 1; k < 4; k++) if (N[5 * k] > N[5 * j]) j = k;
    let w = V[j], x = V[4 + j], y = V[8 + j], z = V[12 + j];
    const l = Math.hypot(w, x, y, z);
    if (!(l > 0)) { w = 1; x = y = z = 0; }
    else { const sg = (w * q[o + 3] + x * q[o] + y * q[o + 1] + z * q[o + 2] < 0 ? -1 : 1) / l; w *= sg; x *= sg; y *= sg; z *= sg; }
    q[o] = x; q[o + 1] = y; q[o + 2] = z; q[o + 3] = w;
  }

  function quatToMat(q, o, M) {
    const qx = q[o], qy = q[o + 1], qz = q[o + 2], qw = q[o + 3];
    const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz;
    M[0] = 1 - 2 * (yy + zz); M[1] = 2 * (xy - wz); M[2] = 2 * (xz + wy);
    M[3] = 2 * (xy + wz); M[4] = 1 - 2 * (xx + zz); M[5] = 2 * (yz - wx);
    M[6] = 2 * (xz - wy); M[7] = 2 * (yz + wx); M[8] = 1 - 2 * (xx + yy);
  }

  // ---- Point location --------------------------------------------------------

  // Locates points in a rest tet mesh with a uniform grid. Returns the tet and 4
  // barycentric weights per point (they reproduce the point from the tet's corners):
  //  - inside: the containing tet, exact;
  //  - within EMBED_BAND outside (render surfaces sit up to ~0.01 outside the sim mesh,
  //    whose outline is a chord of theirs): the best-shaped tet in the band, extrapolated
  //    (weights >= -EMBED_W), so the point is still exact at rest and follows that tet;
  //  - farther out: the nearest tet, weights of its closest point (clamped, >= 0).
  function embed(X, tets, points) {
    const nt = tets.length >> 2, npts = (points.length / 3) | 0;
    const outTet = new Uint32Array(npts), outW = new Float32Array(npts * 4);
    if (nt === 0) return { tet: outTet, w: outW };

    // Per-tet inverse of [b-a, c-a, d-a]: rows are (e2 x e3, e3 x e1, e1 x e2) / det.
    const inv = new Float64Array(nt * 9), flat = new Uint8Array(nt).fill(1);
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let t = 0; t < nt; t++) {
      const a = tets[4 * t] * 3, b = tets[4 * t + 1] * 3, c = tets[4 * t + 2] * 3, d = tets[4 * t + 3] * 3;
      const e1x = X[b] - X[a], e1y = X[b + 1] - X[a + 1], e1z = X[b + 2] - X[a + 2];
      const e2x = X[c] - X[a], e2y = X[c + 1] - X[a + 1], e2z = X[c + 2] - X[a + 2];
      const e3x = X[d] - X[a], e3y = X[d + 1] - X[a + 1], e3z = X[d + 2] - X[a + 2];
      const c23x = e2y * e3z - e2z * e3y, c23y = e2z * e3x - e2x * e3z, c23z = e2x * e3y - e2y * e3x;
      const det = e1x * c23x + e1y * c23y + e1z * c23z;
      if (Math.abs(det) > 1e-20) {
        const id = 1 / det, o = 9 * t;
        flat[t] = 0;
        inv[o] = c23x * id; inv[o + 1] = c23y * id; inv[o + 2] = c23z * id;
        inv[o + 3] = (e3y * e1z - e3z * e1y) * id; inv[o + 4] = (e3z * e1x - e3x * e1z) * id; inv[o + 5] = (e3x * e1y - e3y * e1x) * id;
        inv[o + 6] = (e1y * e2z - e1z * e2y) * id; inv[o + 7] = (e1z * e2x - e1x * e2z) * id; inv[o + 8] = (e1x * e2y - e1y * e2x) * id;
      }
      for (const k of [a, b, c, d]) {
        if (X[k] < mnx) mnx = X[k]; if (X[k] > mxx) mxx = X[k];
        if (X[k + 1] < mny) mny = X[k + 1]; if (X[k + 1] > mxy) mxy = X[k + 1];
        if (X[k + 2] < mnz) mnz = X[k + 2]; if (X[k + 2] > mxz) mxz = X[k + 2];
      }
    }

    // Grid with roughly 2 tets per cell; tets are binned by their AABB.
    const ex = Math.max(mxx - mnx, 1e-6), ey = Math.max(mxy - mny, 1e-6), ez = Math.max(mxz - mnz, 1e-6);
    const cs = Math.max(Math.cbrt((ex * ey * ez) / nt) * 1.3, Math.max(ex, ey, ez) / 128);
    const gx = Math.ceil(ex / cs) + 1, gy = Math.ceil(ey / cs) + 1, gz = Math.ceil(ez / cs) + 1;
    const cell = (v, mn, g) => clamp(Math.floor((v - mn) / cs), 0, g - 1);
    const start = new Uint32Array(gx * gy * gz + 1);
    const tetBox = new Int32Array(nt * 6), aabb = new Float64Array(nt * 6);
    for (let t = 0; t < nt; t++) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let k = 0; k < 4; k++) {
        const i = tets[4 * t + k] * 3;
        x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]);
        y0 = Math.min(y0, X[i + 1]); y1 = Math.max(y1, X[i + 1]);
        z0 = Math.min(z0, X[i + 2]); z1 = Math.max(z1, X[i + 2]);
      }
      aabb[6 * t] = x0; aabb[6 * t + 1] = y0; aabb[6 * t + 2] = z0; aabb[6 * t + 3] = x1; aabb[6 * t + 4] = y1; aabb[6 * t + 5] = z1;
      const b = tetBox.subarray(6 * t, 6 * t + 6);
      b[0] = cell(x0, mnx, gx); b[1] = cell(y0, mny, gy); b[2] = cell(z0, mnz, gz);
      b[3] = cell(x1, mnx, gx); b[4] = cell(y1, mny, gy); b[5] = cell(z1, mnz, gz);
      for (let i = b[0]; i <= b[3]; i++) for (let j = b[1]; j <= b[4]; j++) for (let k = b[2]; k <= b[5]; k++) start[(i * gy + j) * gz + k + 1]++;
    }
    for (let c = 0; c < gx * gy * gz; c++) start[c + 1] += start[c];
    const fill = start.slice(0, gx * gy * gz), list = new Uint32Array(start[gx * gy * gz]);
    for (let t = 0; t < nt; t++) {
      const o = 6 * t;
      for (let i = tetBox[o]; i <= tetBox[o + 3]; i++) for (let j = tetBox[o + 1]; j <= tetBox[o + 4]; j++) for (let k = tetBox[o + 2]; k <= tetBox[o + 5]; k++) list[fill[(i * gy + j) * gz + k]++] = t;
    }

    const w = new Float64Array(4), wc = new Float64Array(4), tw = new Float64Array(3), wExt = new Float64Array(4), wNear = new Float64Array(4);
    // Unclamped weights of q in tet t into w (a flat tet reports all -1: never inside).
    const bary = (t, qx, qy, qz) => {
      if (flat[t]) { w[0] = w[1] = w[2] = w[3] = -1; return; }
      const a = tets[4 * t] * 3, o = 9 * t;
      const rx = qx - X[a], ry = qy - X[a + 1], rz = qz - X[a + 2];
      w[1] = inv[o] * rx + inv[o + 1] * ry + inv[o + 2] * rz;
      w[2] = inv[o + 3] * rx + inv[o + 4] * ry + inv[o + 5] * rz;
      w[3] = inv[o + 6] * rx + inv[o + 7] * ry + inv[o + 8] * rz;
      w[0] = 1 - w[1] - w[2] - w[3];
    };
    // Closest point of triangle (a, b, c) (offsets into X) to q: its weights into tw,
    // squared distance returned. Ericson, Real-Time Collision Detection 5.1.5.
    const triClosest = (a, b, c, qx, qy, qz) => {
      const abx = X[b] - X[a], aby = X[b + 1] - X[a + 1], abz = X[b + 2] - X[a + 2];
      const acx = X[c] - X[a], acy = X[c + 1] - X[a + 1], acz = X[c + 2] - X[a + 2];
      const apx = qx - X[a], apy = qy - X[a + 1], apz = qz - X[a + 2];
      const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
      const bpx = qx - X[b], bpy = qy - X[b + 1], bpz = qz - X[b + 2];
      const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
      const cpx = qx - X[c], cpy = qy - X[c + 1], cpz = qz - X[c + 2];
      const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
      const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
      let v = 0, u = 0;   // q' = a + v ab + u ac
      if (d1 <= 0 && d2 <= 0) { /* vertex a */ }
      else if (d3 >= 0 && d4 <= d3) v = 1;
      else if (vc <= 0 && d1 >= 0 && d3 <= 0) v = d1 / (d1 - d3);
      else if (d6 >= 0 && d5 <= d6) u = 1;
      else if (vb <= 0 && d2 >= 0 && d6 <= 0) u = d2 / (d2 - d6);
      else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { u = (d4 - d3) / (d4 - d3 + (d5 - d6)); v = 1 - u; }
      else if (va + vb + vc > 0) { const den = 1 / (va + vb + vc); v = vb * den; u = vc * den; }
      tw[0] = 1 - v - u; tw[1] = v; tw[2] = u;
      const dx = abx * v + acx * u - apx, dy = aby * v + acy * u - apy, dz = abz * v + acz * u - apz;
      return dx * dx + dy * dy + dz * dz;
    };
    // Closest point of tet t to q (unclamped weights already in w): weights into wc,
    // squared distance returned. Outside, it lies on a face whose opposite weight is < 0.
    const tetClosest = (t, qx, qy, qz) => {
      if (w[0] >= 0 && w[1] >= 0 && w[2] >= 0 && w[3] >= 0) { wc.set(w); return 0; }
      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        if (w[k] >= 0) continue;
        const i0 = (k + 1) & 3, i1 = (k + 2) & 3, i2 = (k + 3) & 3;
        const d2 = triClosest(tets[4 * t + i0] * 3, tets[4 * t + i1] * 3, tets[4 * t + i2] * 3, qx, qy, qz);
        if (d2 < best) { best = d2; wc[k] = 0; wc[i0] = tw[0]; wc[i1] = tw[1]; wc[i2] = tw[2]; }
      }
      return best;
    };
    const keep = (p, t, W) => {
      let s = 0;
      for (let k = 0; k < 4; k++) s += W[k];
      outTet[p] = t;
      for (let k = 0; k < 4; k++) outW[4 * p + k] = W[k] / s;
    };
    const band2 = EMBED_BAND * EMBED_BAND, maxR = Math.max(gx, gy, gz);

    for (let p = 0; p < npts; p++) {
      const qx = points[3 * p], qy = points[3 * p + 1], qz = points[3 * p + 2];
      if (!Number.isFinite(qx + qy + qz)) { wc.fill(0); wc[0] = 1; keep(p, 0, wc); continue; }
      const ci = cell(qx, mnx, gx), cj = cell(qy, mny, gy), ck = cell(qz, mnz, gz);
      // Inside test: the containing tet is always binned in the point's cell.
      let best = -1, bestMin = -Infinity;
      const c = (ci * gy + cj) * gz + ck;
      for (let s = start[c]; s < start[c + 1]; s++) {
        const t = list[s];
        bary(t, qx, qy, qz);
        const m = Math.min(w[0], w[1], w[2], w[3]);
        if (m > bestMin) { bestMin = m; best = t; }
      }
      if (best >= 0 && bestMin >= -1e-6) {
        bary(best, qx, qy, qz);
        for (let k = 0; k < 4; k++) if (w[k] < 0) w[k] = 0;
        keep(p, best, w);
        continue;
      }
      // Just outside (most render-surface points): the cell's best-shaped tet will do if it is
      // in the band, which saves the ring search.
      if (best >= 0 && bestMin >= -EMBED_W) {
        bary(best, qx, qy, qz);
        if (tetClosest(best, qx, qy, qz) <= band2) { keep(p, best, w); continue; }
      }
      // Outside: rings of cells around the point's cell. A tet is binned in the cell of
      // its closest point, which lies >= (r - 1) cells away for ring r, so the search
      // stops once that bound passes both the nearest distance and the band.
      let nearD = Infinity, near = 0, ext = -1, extMin = -EMBED_W;
      for (let r = 0; r <= maxR; r++) {
        for (let i = Math.max(ci - r, 0); i <= Math.min(ci + r, gx - 1); i++) {
          for (let j = Math.max(cj - r, 0); j <= Math.min(cj + r, gy - 1); j++) {
            for (let k = Math.max(ck - r, 0); k <= Math.min(ck + r, gz - 1); k++) {
              if (Math.max(Math.abs(i - ci), Math.abs(j - cj), Math.abs(k - ck)) !== r) continue;
              const cc = (i * gy + j) * gz + k;
              for (let s = start[cc]; s < start[cc + 1]; s++) {
                const t = list[s], o = 6 * t;
                const bx = Math.max(aabb[o] - qx, qx - aabb[o + 3], 0), by = Math.max(aabb[o + 1] - qy, qy - aabb[o + 4], 0), bz = Math.max(aabb[o + 2] - qz, qz - aabb[o + 5], 0);
                if (bx * bx + by * by + bz * bz > Math.max(nearD, band2)) continue;   // can be neither nearer nor in the band
                bary(t, qx, qy, qz);
                const d2 = tetClosest(t, qx, qy, qz), m = Math.min(w[0], w[1], w[2], w[3]);
                if (d2 < nearD) { nearD = d2; near = t; wNear.set(wc); }
                if (d2 <= band2 && m > extMin) { extMin = m; ext = t; wExt.set(w); }
              }
            }
          }
        }
        if (nearD < Infinity && r * cs >= Math.max(Math.sqrt(nearD), EMBED_BAND)) break;
      }
      if (ext >= 0) keep(p, ext, wExt);
      else keep(p, near, wNear);
    }
    return { tet: outTet, w: outW };
  }

  // Unique edges of a local tet list, returned as global pairs (offset added).
  function uniqueEdges(tl, m, off) {
    const nt = tl.length >> 2, keys = new Float64Array(nt * 6);
    const P = [0, 1, 0, 2, 0, 3, 1, 2, 1, 3, 2, 3];
    for (let t = 0; t < nt; t++) {
      for (let e = 0; e < 6; e++) {
        const i = tl[4 * t + P[2 * e]], j = tl[4 * t + P[2 * e + 1]];
        keys[6 * t + e] = i < j ? i * m + j : j * m + i;
      }
    }
    keys.sort();
    let u = 0;
    for (let k = 0; k < keys.length; k++) if (k === 0 || keys[k] !== keys[k - 1]) keys[u++] = keys[k];
    const out = new Uint32Array(u * 2);
    for (let k = 0; k < u; k++) {
      const i = Math.floor(keys[k] / m);
      out[2 * k] = i + off;
      out[2 * k + 1] = keys[k] - i * m + off;
    }
    return out;
  }

  // ---- World -----------------------------------------------------------------

  function createWorld() {
    const params = { firmness: 50, damping: 30, gravity: 11 };

    // Particles.
    let n = 0;
    let pos = new Float32Array(0), vel = new Float32Array(0), prev = new Float32Array(0), restPos = new Float32Array(0);
    let pieceOf = new Uint16Array(0), mass = new Float32Array(0), invMass = new Float32Array(0);
    // Tets: weights m_k / M, rest offsets q_k from the rest centroid, warm-start quaternions.
    // Weights and offsets are float64: shape matching conserves momentum only if sum w = 1 and
    // sum w q = 0, and in float32 the residue pushes every tet the same way, every substep.
    let nt = 0;
    let tetIdx = new Uint32Array(0), tetW = new Float64Array(0), tetQ = new Float64Array(0);
    let tetRot = new Float64Array(0), tetVol0 = new Float32Array(0), tetRind = new Uint8Array(0), tetIS2 = new Float32Array(0);
    // Edges: rest length and i's share of a mass-weighted correction.
    let ne = 0, edgeIdx = new Uint32Array(0), edgeL0 = new Float32Array(0), edgeW = new Float32Array(0), violated = new Uint32Array(0);
    let edgeSeen = new Uint8Array(0), adjStart = new Uint32Array(1), adjEdge = new Uint32Array(0), dirty = new Uint32Array(0), dirtyFlag = new Uint8Array(0), held = new Uint8Array(0);
    // Pieces.
    let np = 0, pieces = [];
    let pStart = new Uint32Array(0), pCount = new Uint32Array(0), pTetStart = new Uint32Array(0), pTetCount = new Uint32Array(0);
    let pMass = new Float64Array(0), pVol0 = new Float64Array(0), pRestC = new Float64Array(0), pQuat = new Float64Array(0);
    let pInv = new Uint32Array(0), pTangle = new Float32Array(0);   // inside-out tets last substep; untangle pull 0..1
    let pBox = new Float64Array(0), pSupport = new Uint8Array(0), pAcc = new Float64Array(0), pRig = new Float64Array(0), pScale = new Float32Array(0), pOverlap = new Uint8Array(0);
    // Last good state for the NaN guard.
    let bPos = new Float32Array(0), bVel = new Float32Array(0), bRot = new Float64Array(0);
    // Collision spatial hash (linked lists).
    let hHead = new Int32Array(0), hNext = new Int32Array(0), hMask = 0, cand = new Int32Array(0);
    // Scratch for rotation extraction.
    const A9 = new Float64Array(9), M9 = new Float64Array(9), cen = new Float64Array(3);
    let seed = 0x9e3779b9;
    const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

    // Hand state.
    const hand = {
      piece: -1, count: 0, anchor: 0, lra: new Float32Array(0), idx: new Uint32Array(0), w: new Float32Array(0), off: new Float32Array(0),
      tx: 0, ty: 0, tz: 0, sx: 0, sy: 0, sz: 0,         // target, and target at the start of this step
      ax: 0, ay: 1, az: 0, rot: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), reach: 0,
    };

    const world = {
      n: 0, x: pos, v: vel, rest: restPos, piece: pieceOf, pieces, tets: tetIdx, edges: edgeIdx, mass,
      version: 0, params, collider: null, grabbing: false, pinY: new Uint8Array(0),
      setPieces, replacePieces, step, setFirmness, setDamping,
      grabStart, grabMove, grabTwist, grabEnd, nudge, rigidFrame, stats, strain,
    };

    // ---- Construction --------------------------------------------------------

    // specs: [{ X, tets (local), x?, v?, rot? (per-tet quats), pq (piece quat) }]
    function build(specs) {
      let N = 0, NT = 0;
      for (const s of specs) { N += (s.X.length / 3) | 0; NT += s.tets.length >> 2; }
      n = N; nt = NT; np = specs.length;
      pos = new Float32Array(3 * N); vel = new Float32Array(3 * N); prev = new Float32Array(3 * N); restPos = new Float32Array(3 * N);
      pieceOf = new Uint16Array(N); mass = new Float32Array(N); invMass = new Float32Array(N);
      tetIdx = new Uint32Array(4 * NT); tetW = new Float64Array(4 * NT); tetQ = new Float64Array(12 * NT);
      tetRot = new Float64Array(4 * NT); tetVol0 = new Float32Array(NT); tetRind = new Uint8Array(NT); tetIS2 = new Float32Array(NT);
      pStart = new Uint32Array(np); pCount = new Uint32Array(np); pTetStart = new Uint32Array(np); pTetCount = new Uint32Array(np);
      pMass = new Float64Array(np); pVol0 = new Float64Array(np); pRestC = new Float64Array(3 * np); pQuat = new Float64Array(4 * np);
      pBox = new Float64Array(6 * np); pSupport = new Uint8Array(np); pAcc = new Float64Array(16 * np); pRig = new Float64Array(9 * np); pScale = new Float32Array(np);
      pOverlap = new Uint8Array(np * np); pInv = new Uint32Array(np); pTangle = new Float32Array(np);
      pieces = [];

      const edgeLists = [];
      let off = 0, toff = 0;
      for (let p = 0; p < np; p++) {
        const s = specs[p], m = (s.X.length / 3) | 0, mt = s.tets.length >> 2;
        restPos.set(s.X.subarray ? s.X.subarray(0, 3 * m) : s.X, 3 * off);
        pos.set(s.x || restPos.subarray(3 * off, 3 * (off + m)), 3 * off);
        if (s.v) vel.set(s.v, 3 * off);
        pieceOf.fill(p, off, off + m);
        for (let k = 0; k < 4 * mt; k++) tetIdx[4 * toff + k] = s.tets[k] + off;
        if (s.rot) tetRot.set(s.rot, 4 * toff);
        pStart[p] = off; pCount[p] = m; pTetStart[p] = toff; pTetCount[p] = mt;
        pQuat.set(s.pq || [0, 0, 0, 1], 4 * p);
        pieces.push({ start: off, count: m, tetStart: toff, tetCount: mt });
        edgeLists.push(uniqueEdges(s.tets, m, off));
        off += m; toff += mt;
      }

      // Tets are oriented positively (the volume constraint and the inside-out test rely on it),
      // then lumped masses from rest tet volumes.
      for (let t = 0; t < nt; t++) {
        if (restVolume(t) < 0) { const k = tetIdx[4 * t + 2]; tetIdx[4 * t + 2] = tetIdx[4 * t + 3]; tetIdx[4 * t + 3] = k; }
        const V = Math.max(restVolume(t), 1e-12);
        tetVol0[t] = V;
        for (let k = 0; k < 4; k++) mass[tetIdx[4 * t + k]] += (DENSITY * V) / 4;
      }
      for (let i = 0; i < n; i++) {
        if (!(mass[i] > 0)) mass[i] = 1e-6;
        invMass[i] = 1 / mass[i];
      }

      // Per-tet weights, rest offsets and rind flag.
      for (let t = 0; t < nt; t++) {
        let M = 0, cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < 4; k++) M += mass[tetIdx[4 * t + k]];
        for (let k = 0; k < 4; k++) {
          const i = tetIdx[4 * t + k], wk = mass[i] / M;
          tetW[4 * t + k] = wk;
          cx += wk * restPos[3 * i]; cy += wk * restPos[3 * i + 1]; cz += wk * restPos[3 * i + 2];
        }
        for (let k = 0; k < 4; k++) {
          const i = tetIdx[4 * t + k];
          tetQ[12 * t + 3 * k] = restPos[3 * i] - cx;
          tetQ[12 * t + 3 * k + 1] = restPos[3 * i + 1] - cy;
          tetQ[12 * t + 3 * k + 2] = restPos[3 * i + 2] - cz;
        }
        let s2 = 0;
        for (let k = 0; k < 12; k++) s2 += tetQ[12 * t + k] ** 2;
        tetIS2[t] = s2 > 0 ? 1 / s2 : 0;
        tetRind[t] = Math.hypot(cx, cz - ZC) > RIND_R ? 1 : 0;
      }

      // Edges.
      ne = 0;
      for (const e of edgeLists) ne += e.length >> 1;
      edgeIdx = new Uint32Array(2 * ne); edgeL0 = new Float32Array(ne); edgeW = new Float32Array(ne); violated = new Uint32Array(ne);
      let eo = 0;
      for (const e of edgeLists) { edgeIdx.set(e, eo); eo += e.length; }
      for (let e = 0; e < ne; e++) {
        const i = edgeIdx[2 * e], j = edgeIdx[2 * e + 1];
        edgeL0[e] = Math.hypot(restPos[3 * j] - restPos[3 * i], restPos[3 * j + 1] - restPos[3 * i + 1], restPos[3 * j + 2] - restPos[3 * i + 2]);
        edgeW[e] = invMass[i] / (invMass[i] + invMass[j]);
      }
      // Particle -> edge adjacency (CSR) and scratch for the strain-limit rounds.
      edgeSeen = new Uint8Array(ne); dirty = new Uint32Array(N); dirtyFlag = new Uint8Array(N); held = new Uint8Array(N);
      adjStart = new Uint32Array(N + 1); adjEdge = new Uint32Array(2 * ne);
      for (let k = 0; k < 2 * ne; k++) adjStart[edgeIdx[k] + 1]++;
      for (let i = 0; i < N; i++) adjStart[i + 1] += adjStart[i];
      const fillAt = adjStart.slice(0, N);
      for (let e = 0; e < ne; e++) { adjEdge[fillAt[edgeIdx[2 * e]]++] = e; adjEdge[fillAt[edgeIdx[2 * e + 1]]++] = e; }

      // Piece totals.
      for (let p = 0; p < np; p++) {
        let M = 0, cx = 0, cy = 0, cz = 0, V = 0;
        for (let i = pStart[p]; i < pStart[p] + pCount[p]; i++) {
          M += mass[i]; cx += mass[i] * restPos[3 * i]; cy += mass[i] * restPos[3 * i + 1]; cz += mass[i] * restPos[3 * i + 2];
        }
        for (let t = pTetStart[p]; t < pTetStart[p] + pTetCount[p]; t++) V += tetVol0[t];
        pMass[p] = M; pVol0[p] = V;
        pRestC[3 * p] = cx / M; pRestC[3 * p + 1] = cy / M; pRestC[3 * p + 2] = cz / M;
      }

      // Warm-start rotations of new pieces: start from the piece's rigid rotation.
      for (let p = 0; p < np; p++) {
        if (specs[p].rot) continue;
        for (let t = pTetStart[p]; t < pTetStart[p] + pTetCount[p]; t++) {
          tetRot.set(pQuat.subarray(4 * p, 4 * p + 4), 4 * t);
          tetMatrix(t, A9);
          extractRotation(A9, tetRot, 4 * t, 20);
        }
      }

      bPos = pos.slice(); bVel = vel.slice(); bRot = tetRot.slice();
      let hs = 16;
      while (hs < 2 * n) hs <<= 1;
      hHead = new Int32Array(hs); hNext = new Int32Array(n); hMask = hs - 1; cand = new Int32Array(n);

      hand.piece = -1; hand.count = 0; world.grabbing = false;
      Object.assign(world, { n, x: pos, v: vel, rest: restPos, piece: pieceOf, pieces, tets: tetIdx, edges: edgeIdx, mass });
      world.version++;
    }

    function restVolume(t) {
      const a = 3 * tetIdx[4 * t], b = 3 * tetIdx[4 * t + 1], c = 3 * tetIdx[4 * t + 2], d = 3 * tetIdx[4 * t + 3];
      return tripleVolume(restPos, a, b, c, d);
    }

    function tripleVolume(P, a, b, c, d) {
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      const e3x = P[d] - P[a], e3y = P[d + 1] - P[a + 1], e3z = P[d + 2] - P[a + 2];
      return (e1x * (e2y * e3z - e2z * e3y) + e1y * (e2z * e3x - e2x * e3z) + e1z * (e2x * e3y - e2y * e3x)) / 6;
    }

    // Projects edge e back into [COMPRESS_MIN, STRETCH_MAX] x rest length (mass-weighted).
    // Returns whether it was outside by more than a hair.
    function limitEdge(e) {
      const i = 3 * edgeIdx[2 * e], j = 3 * edgeIdx[2 * e + 1], L0 = edgeL0[e], P = pos;
      const ex = P[j] - P[i], ey = P[j + 1] - P[i + 1], ez = P[j + 2] - P[i + 2];
      const L = Math.sqrt(ex * ex + ey * ey + ez * ez);
      let target;
      if (L > STRETCH_MAX * L0) target = STRETCH_MAX * L0 * 0.999;
      else if (L < COMPRESS_MIN * L0) target = COMPRESS_MIN * L0 * 1.001;
      else return false;
      if (L < 1e-12) return false;
      // Firmly held particles act as anchors, so a pull propagates outward in one sweep.
      const hi = held[i / 3], hj = held[j / 3];
      const share = hi === hj ? edgeW[e] : hi ? 0 : 1;
      const corr = (L - target) / L, wi = share * corr, wj = corr - wi;
      P[i] += ex * wi; P[i + 1] += ey * wi; P[i + 2] += ez * wi;
      P[j] -= ex * wj; P[j + 1] -= ey * wj; P[j + 2] -= ez * wj;
      return true;
    }

    // A_pq of one tet (row-major) into out.
    function tetMatrix(t, out) {
      out.fill(0);
      let gx = 0, gy = 0, gz = 0;
      for (let k = 0; k < 4; k++) {
        const i = 3 * tetIdx[4 * t + k], w = tetW[4 * t + k];
        gx += w * pos[i]; gy += w * pos[i + 1]; gz += w * pos[i + 2];
      }
      for (let k = 0; k < 4; k++) {
        const i = 3 * tetIdx[4 * t + k], w = tetW[4 * t + k], q = 12 * t + 3 * k;
        const dx = w * (pos[i] - gx), dy = w * (pos[i + 1] - gy), dz = w * (pos[i + 2] - gz);
        for (let j = 0; j < 3; j++) { out[j] += dx * tetQ[q + j]; out[3 + j] += dy * tetQ[q + j]; out[6 + j] += dz * tetQ[q + j]; }
      }
    }

    // Mass-weighted current centroid of piece p into cen, and its A_pq into A9.
    function pieceMatrix(p) {
      const s = pStart[p], e = s + pCount[p], M = pMass[p];
      let cx = 0, cy = 0, cz = 0;
      for (let i = s; i < e; i++) { cx += mass[i] * pos[3 * i]; cy += mass[i] * pos[3 * i + 1]; cz += mass[i] * pos[3 * i + 2]; }
      cx /= M; cy /= M; cz /= M;
      cen[0] = cx; cen[1] = cy; cen[2] = cz;
      const rx = pRestC[3 * p], ry = pRestC[3 * p + 1], rz = pRestC[3 * p + 2];
      A9.fill(0);
      for (let i = s; i < e; i++) {
        const w = mass[i] / M;
        const dx = w * (pos[3 * i] - cx), dy = w * (pos[3 * i + 1] - cy), dz = w * (pos[3 * i + 2] - cz);
        const qx = restPos[3 * i] - rx, qy = restPos[3 * i + 1] - ry, qz = restPos[3 * i + 2] - rz;
        A9[0] += dx * qx; A9[1] += dx * qy; A9[2] += dx * qz;
        A9[3] += dy * qx; A9[4] += dy * qy; A9[5] += dy * qz;
        A9[6] += dz * qx; A9[7] += dz * qy; A9[8] += dz * qz;
      }
    }

    // Best-fit rotation of piece p into pQuat; centroid into cen.
    function pieceRotation(p) {
      pieceMatrix(p);
      bestRotation(A9, pQuat, 4 * p);
    }

    function setPieces(list) {
      build(list.map((e) => ({ X: e.X, tets: e.tets })));
    }

    function replacePieces(list) {
      // State written from outside since the last step (x, v) may be garbage: start from the last good one.
      let ok = 0;
      for (let i = 0; i < 3 * n; i++) ok += pos[i] + vel[i];
      if (!Number.isFinite(ok)) { pos.set(bPos); vel.set(bVel); tetRot.set(bRot); }
      const specs = [];
      for (const e of list) {
        if (e.keep !== undefined) {
          const p = e.keep;
          if (!(p >= 0 && p < np) || p !== Math.floor(p)) throw new RangeError(`replacePieces: no piece ${p} to keep`);
          const s = pStart[p], c = pCount[p], ts = pTetStart[p], tc = pTetCount[p];
          const tl = new Uint32Array(4 * tc);
          for (let k = 0; k < 4 * tc; k++) tl[k] = tetIdx[4 * ts + k] - s;
          specs.push({
            X: restPos.slice(3 * s, 3 * (s + c)), tets: tl, x: pos.slice(3 * s, 3 * (s + c)), v: vel.slice(3 * s, 3 * (s + c)),
            rot: tetRot.slice(4 * ts, 4 * (ts + tc)), pq: pQuat.slice(4 * p, 4 * p + 4),
          });
          continue;
        }
        const X = e.X, m = (X.length / 3) | 0;
        if (np === 0) { specs.push({ X, tets: e.tets }); continue; }   // nothing to inherit from: at rest
        // The source piece is the one holding most of the new rest points: pieces
        // that were cut apart share boundaries in the rest plane, so per-point
        // lookup alone could pull a boundary point from the wrong neighbour.
        let src = 0;
        if (np > 1) {
          const g = embed(restPos, tetIdx, X), votes = new Uint32Array(np);
          for (let i = 0; i < m; i++) votes[pieceOf[tetIdx[4 * g.tet[i]]]]++;
          for (let p = 1; p < np; p++) if (votes[p] > votes[src]) src = p;
        }
        const s = pStart[src], ts = pTetStart[src], tc = pTetCount[src];
        const tl = new Uint32Array(4 * tc);
        for (let k = 0; k < 4 * tc; k++) tl[k] = tetIdx[4 * ts + k] - s;
        const emb = embed(restPos.subarray(3 * s, 3 * (s + pCount[src])), tl, X);
        const xn = new Float32Array(3 * m), vn = new Float32Array(3 * m);
        for (let i = 0; i < m; i++) {
          const t = emb.tet[i];
          let x0 = 0, x1 = 0, x2 = 0, v0 = 0, v1 = 0, v2 = 0;
          for (let k = 0; k < 4; k++) {
            const w = emb.w[4 * i + k], j = 3 * (s + tl[4 * t + k]);
            x0 += w * pos[j]; x1 += w * pos[j + 1]; x2 += w * pos[j + 2];
            v0 += w * vel[j]; v1 += w * vel[j + 1]; v2 += w * vel[j + 2];
          }
          xn[3 * i] = x0; xn[3 * i + 1] = x1; xn[3 * i + 2] = x2;
          vn[3 * i] = v0; vn[3 * i + 1] = v1; vn[3 * i + 2] = v2;
        }
        pieceRotation(src);
        specs.push({ X, tets: e.tets, x: xn, v: vn, pq: pQuat.slice(4 * src, 4 * src + 4) });
      }
      build(specs);
    }

    // ---- Parameters ----------------------------------------------------------

    function setFirmness(f) { params.firmness = clamp(+f || 0, 0, 100); }
    function setDamping(d) { params.damping = clamp(+d || 0, 0, 100); }

    // ---- Simulation ----------------------------------------------------------

    function step(dt) {
      if (n === 0 || !(dt > 0)) return;
      if (world.pinY.length !== n) world.pinY = new Uint8Array(n);
      if (dt > MAX_DT) dt = MAX_DT;
      const S = SUBSTEPS, h = dt / S, ih = 1 / h;
      const g = +params.gravity || 0;
      const f = clamp(+params.firmness || 0, 0, 100) / 100, dmp = clamp(+params.damping || 0, 0, 100) / 100;
      const wh = W_SOFT * Math.pow(W_SET / W_SOFT, f) * h, wh2 = wh * wh, wh2r = wh2 * RIND_GAIN;
      const kFlesh = wh2 / (1 + wh2), kRind = wh2r / (1 + wh2r);   // XPBD-style per-tet goal fraction
      const volAlpha = 36 / (BULK * h * h);                        // 36 * compliance / h^2 per unit rest volume
      const beta = B_LIVELY * Math.pow(B_SYRUP / B_LIVELY, dmp);
      const kd = KD_SYRUP * dmp * dmp;
      const P = pos, V = vel, Xp = prev, IM = invMass, TI = tetIdx, TW = tetW, TQ = tetQ, TR = tetRot, TV = tetVol0, TRind = tetRind, TS = tetIS2;
      const EI = edgeIdx, EL = edgeL0, EW = edgeW, PO = pieceOf;
      const n3 = 3 * n;

      for (let sub = 0; sub < S; sub++) {
        pSupport.fill(0);

        // Predict.
        for (let i = 0; i < n3; i += 3) {
          Xp[i] = P[i]; Xp[i + 1] = P[i + 1]; Xp[i + 2] = P[i + 2];
          V[i + 1] -= g * h;
          P[i] += V[i] * h; P[i + 1] += V[i + 1] * h; P[i + 2] += V[i + 2] * h;
        }

        // Hand: soft attachment of the held patch to the (interpolated) target. Each
        // pull is capped at the speed limit so the hand cannot outrun the jelly.
        if (hand.count > 0) {
          const s = (sub + 1) / S, maxStep = VMAX * h;
          const tx = hand.sx + (hand.tx - hand.sx) * s, ty = hand.sy + (hand.ty - hand.sy) * s, tz = hand.sz + (hand.tz - hand.sz) * s;
          const Rm = hand.rot, O = hand.off;
          for (let k = 0; k < hand.count; k++) {
            const i = 3 * hand.idx[k], w = HAND_K * hand.w[k], o0 = O[3 * k], o1 = O[3 * k + 1], o2 = O[3 * k + 2];
            let dx = w * (tx + Rm[0] * o0 + Rm[1] * o1 + Rm[2] * o2 - P[i]);
            let dy = w * (ty + Rm[3] * o0 + Rm[4] * o1 + Rm[5] * o2 - P[i + 1]);
            let dz = w * (tz + Rm[6] * o0 + Rm[7] * o1 + Rm[8] * o2 - P[i + 2]);
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > maxStep * maxStep) { const r = maxStep / Math.sqrt(d2); dx *= r; dy *= r; dz *= r; }
            P[i] += dx; P[i + 1] += dy; P[i + 2] += dz;
          }
          pSupport[hand.piece] = 1;
        }

        // Untangling. A tet's own best rotation flips its thinnest axis, which can be the wrong
        // flip for its neighbours: after a violent squash a patch can come back turned over, held
        // there by a seam of inside-out tets that is stable on its own. While a piece has any (and
        // for a moment after), pull it toward its rigid rest shape, which has no such minimum.
        // Conserves momentum (mass centroid) and angular momentum (exact best-fit rotation).
        // Never runs in normal handling, including the knife and the cutters.
        for (let p = 0; p < np; p++) {
          if (pInv[p] > 0) pTangle[p] = 1;
          pInv[p] = 0;
          if (pTangle[p] <= 0) continue;
          pieceRotation(p);
          quatToMat(pQuat, 4 * p, M9);
          const b = UNTANGLE_B * pTangle[p], cx = cen[0], cy = cen[1], cz = cen[2], rx = pRestC[3 * p], ry = pRestC[3 * p + 1], rz = pRestC[3 * p + 2];
          for (let i = 3 * pStart[p], e = 3 * (pStart[p] + pCount[p]); i < e; i += 3) {
            const X0 = restPos[i] - rx, X1 = restPos[i + 1] - ry, X2 = restPos[i + 2] - rz;
            P[i] += b * (cx + M9[0] * X0 + M9[1] * X1 + M9[2] * X2 - P[i]);
            P[i + 1] += b * (cy + M9[3] * X0 + M9[4] * X1 + M9[5] * X2 - P[i + 1]);
            P[i + 2] += b * (cz + M9[6] * X0 + M9[7] * X1 + M9[8] * X2 - P[i + 2]);
          }
          pTangle[p] = Math.max(0, pTangle[p] - 1 / UNTANGLE_HOLD);
        }

        // Per tet: co-rotational shape matching, then compliant volume (Gauss-Seidel).
        for (let t = 0; t < nt; t++) {
          const t4 = t << 2, t12 = t * 12;
          const ia = TI[t4], ib = TI[t4 + 1], ic = TI[t4 + 2], id = TI[t4 + 3];
          const a = ia * 3, b = ib * 3, c = ic * 3, d = id * 3;
          let ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2];
          let cx = P[c], cy = P[c + 1], cz = P[c + 2], dx = P[d], dy = P[d + 1], dz = P[d + 2];
          const wa = TW[t4], wb = TW[t4 + 1], wc = TW[t4 + 2], wd = TW[t4 + 3];
          const gx = wa * ax + wb * bx + wc * cx + wd * dx;
          const gy = wa * ay + wb * by + wc * cy + wd * dy;
          const gz = wa * az + wb * bz + wc * cz + wd * dz;
          const qa0 = TQ[t12], qa1 = TQ[t12 + 1], qa2 = TQ[t12 + 2], qb0 = TQ[t12 + 3], qb1 = TQ[t12 + 4], qb2 = TQ[t12 + 5];
          const qc0 = TQ[t12 + 6], qc1 = TQ[t12 + 7], qc2 = TQ[t12 + 8], qd0 = TQ[t12 + 9], qd1 = TQ[t12 + 10], qd2 = TQ[t12 + 11];
          // A_pq = sum_k w_k (x_k - g) q_k^T
          const pax = wa * (ax - gx), pay = wa * (ay - gy), paz = wa * (az - gz);
          const pbx = wb * (bx - gx), pby = wb * (by - gy), pbz = wb * (bz - gz);
          const pcx = wc * (cx - gx), pcy = wc * (cy - gy), pcz = wc * (cz - gz);
          const pdx = wd * (dx - gx), pdy = wd * (dy - gy), pdz = wd * (dz - gz);
          const a00 = pax * qa0 + pbx * qb0 + pcx * qc0 + pdx * qd0, a01 = pax * qa1 + pbx * qb1 + pcx * qc1 + pdx * qd1, a02 = pax * qa2 + pbx * qb2 + pcx * qc2 + pdx * qd2;
          const a10 = pay * qa0 + pby * qb0 + pcy * qc0 + pdy * qd0, a11 = pay * qa1 + pby * qb1 + pcy * qc1 + pdy * qd1, a12 = pay * qa2 + pby * qb2 + pcy * qc2 + pdy * qd2;
          const a20 = paz * qa0 + pbz * qb0 + pcz * qc0 + pdz * qd0, a21 = paz * qa1 + pbz * qb1 + pcz * qc1 + pdz * qd1, a22 = paz * qa2 + pbz * qb2 + pcz * qc2 + pdz * qd2;

          // Warm-started rotation extraction (inlined extractRotation).
          let qx = TR[t4], qy = TR[t4 + 1], qz = TR[t4 + 2], qw = TR[t4 + 3];
          let r00, r01, r02, r10, r11, r12, r20, r21, r22;
          for (let it = 0; ; it++) {
            const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz;
            r00 = 1 - 2 * (yy + zz); r01 = 2 * (xy - wz); r02 = 2 * (xz + wy);
            r10 = 2 * (xy + wz); r11 = 1 - 2 * (xx + zz); r12 = 2 * (yz - wx);
            r20 = 2 * (xz - wy); r21 = 2 * (yz + wx); r22 = 1 - 2 * (xx + yy);
            if (it === ROT_ITERS) break;
            const ox = r10 * a20 - r20 * a10 + r11 * a21 - r21 * a11 + r12 * a22 - r22 * a12;
            const oy = r20 * a00 - r00 * a20 + r21 * a01 - r01 * a21 + r22 * a02 - r02 * a22;
            const oz = r00 * a10 - r10 * a00 + r01 * a11 - r11 * a01 + r02 * a12 - r12 * a02;
            const s = 0.5 / (Math.abs(r00 * a00 + r10 * a10 + r20 * a20 + r01 * a01 + r11 * a11 + r21 * a21 + r02 * a02 + r12 * a12 + r22 * a22) + 1e-12);
            const hx = ox * s, hy = oy * s, hz = oz * s;
            const nw = qw - hx * qx - hy * qy - hz * qz;
            const nx = qx + hx * qw + hy * qz - hz * qy;
            const ny = qy + hy * qw + hz * qx - hx * qz;
            const nz = qz + hz * qw + hx * qy - hy * qx;
            const il = 1 / Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
            qx = nx * il; qy = ny * il; qz = nz * il; qw = nw * il;
          }
          TR[t4] = qx; TR[t4 + 1] = qy; TR[t4 + 2] = qz; TR[t4 + 3] = qw;

          // Pull each vertex toward its goal g + R q_k, by the same fraction for all four
          // (momentum-conserving). Strain stiffening: a tet deformed far from its rest shape
          // gets stiffer, so big pulls are carried elastically before the hard limits.
          const dax = gx + r00 * qa0 + r01 * qa1 + r02 * qa2 - ax, day = gy + r10 * qa0 + r11 * qa1 + r12 * qa2 - ay, daz = gz + r20 * qa0 + r21 * qa1 + r22 * qa2 - az;
          const dbx = gx + r00 * qb0 + r01 * qb1 + r02 * qb2 - bx, dby = gy + r10 * qb0 + r11 * qb1 + r12 * qb2 - by, dbz = gz + r20 * qb0 + r21 * qb1 + r22 * qb2 - bz;
          const dcx = gx + r00 * qc0 + r01 * qc1 + r02 * qc2 - cx, dcy = gy + r10 * qc0 + r11 * qc1 + r12 * qc2 - cy, dcz = gz + r20 * qc0 + r21 * qc1 + r22 * qc2 - cz;
          const ddx = gx + r00 * qd0 + r01 * qd1 + r02 * qd2 - dx, ddy = gy + r10 * qd0 + r11 * qd1 + r12 * qd2 - dy, ddz = gz + r20 * qd0 + r21 * qd1 + r22 * qd2 - dz;
          const dev2 = (dax * dax + day * day + daz * daz + dbx * dbx + dby * dby + dbz * dbz +
            dcx * dcx + dcy * dcy + dcz * dcz + ddx * ddx + ddy * ddy + ddz * ddz) * TS[t];
          let k = TRind[t] ? kRind : kFlesh;
          if (dev2 > STIFF_E0 * STIFF_E0) {
            const u = Math.min((Math.sqrt(dev2) - STIFF_E0) / (STIFF_E1 - STIFF_E0), 1);
            k += (STIFF_K - k) * u * u;
          }
          ax += k * dax; ay += k * day; az += k * daz;
          bx += k * dbx; by += k * dby; bz += k * dbz;
          cx += k * dcx; cy += k * dcy; cz += k * dcz;
          dx += k * ddx; dy += k * ddy; dz += k * ddz;

          // Compliant volume: C = 6V - 6V0, gradients are the face cross products.
          const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az, e3x = dx - ax, e3y = dy - ay, e3z = dz - az;
          const gbx = e2y * e3z - e2z * e3y, gby = e2z * e3x - e2x * e3z, gbz = e2x * e3y - e2y * e3x;
          const gcx = e3y * e1z - e3z * e1y, gcy = e3z * e1x - e3x * e1z, gcz = e3x * e1y - e3y * e1x;
          const gdx = e1y * e2z - e1z * e2y, gdy = e1z * e2x - e1x * e2z, gdz = e1x * e2y - e1y * e2x;
          const gax = -gbx - gcx - gdx, gay = -gby - gcy - gdy, gaz = -gbz - gcz - gdz;
          const ma = IM[ia], mb = IM[ib], mc = IM[ic], md = IM[id];
          // A particle held by the floor or the press can't move vertically: the volume has to go sideways
          // (else the constraint pushes up, the wall pushes back down, and a squashed slab just loses volume).
          const pin = world.pinY, may = PIN && pin[ia] ? 0 : ma, mby = PIN && pin[ib] ? 0 : mb, mcy = PIN && pin[ic] ? 0 : mc, mdy = PIN && pin[id] ? 0 : md;
          const W = PIN
            ? ma * (gax * gax + gaz * gaz) + may * gay * gay + mb * (gbx * gbx + gbz * gbz) + mby * gby * gby +
              mc * (gcx * gcx + gcz * gcz) + mcy * gcy * gcy + md * (gdx * gdx + gdz * gdz) + mdy * gdy * gdy
            : ma * (gax * gax + gay * gay + gaz * gaz) + mb * (gbx * gbx + gby * gby + gbz * gbz) +
              mc * (gcx * gcx + gcy * gcy + gcz * gcz) + md * (gdx * gdx + gdy * gdy + gdz * gdz);
          const V0 = TV[t];
          const V6 = e1x * gbx + e1y * gby + e1z * gbz;
          if (V6 < 0 && V0 > 1e-9) pInv[PO[ia]]++;   // (a flat rest tet has no inside)
          const lam = -(V6 - 6 * V0) / (W + volAlpha * V0);
          P[a] = ax + lam * ma * gax; P[a + 1] = ay + lam * may * gay; P[a + 2] = az + lam * ma * gaz;
          P[b] = bx + lam * mb * gbx; P[b + 1] = by + lam * mby * gby; P[b + 2] = bz + lam * mb * gbz;
          P[c] = cx + lam * mc * gcx; P[c + 1] = cy + lam * mcy * gcy; P[c + 2] = cz + lam * mc * gcz;
          P[d] = dx + lam * md * gdx; P[d + 1] = dy + lam * mdy * gdy; P[d + 2] = dz + lam * md * gdz;
        }

        // Long-range attachment to the hand: no particle of the held piece may be farther
        // from the grabbed particle than LRA x their rest distance. This carries
        // a hard pull through the whole piece at once instead of edge by edge.
        if (hand.count > 0) {
          const a = 3 * hand.anchor, ax = P[a], ay = P[a + 1], az = P[a + 2], L = hand.lra;
          for (let k = 0, i = 3 * pStart[hand.piece]; k < L.length; k++, i += 3) {
            const dx = P[i] - ax, dy = P[i + 1] - ay, dz = P[i + 2] - az, d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > L[k] * L[k]) { const r = L[k] / Math.sqrt(d2); P[i] = ax + dx * r; P[i + 1] = ay + dy * r; P[i + 2] = az + dz * r; }
          }
        }

        // Hard edge strain limits. One sweep finds the violated edges (no square roots
        // when calm); then Gauss-Seidel rounds project them, re-checking only the edges
        // around particles that moved, since fixing one edge can overstretch the next.
        let nv = 0;
        for (let e = 0; e < ne; e++) {
          const i = 3 * EI[2 * e], j = 3 * EI[2 * e + 1];
          const ex = P[j] - P[i], ey = P[j + 1] - P[i + 1], ez = P[j + 2] - P[i + 2];
          const L2 = ex * ex + ey * ey + ez * ez, L02 = EL[e] * EL[e];
          if (L2 > STRETCH2 * L02 || L2 < COMPRESS2 * L02) violated[nv++] = e;
        }
        for (let round = 0; round < STRAIN_ROUNDS && nv > 0; round++) {
          let nd = 0;
          for (let k = 0; k < nv; k++) {
            const e = violated[k];
            edgeSeen[e] = 0;
            if (!limitEdge(e)) continue;
            const i = EI[2 * e], j = EI[2 * e + 1];
            if (!dirtyFlag[i]) { dirtyFlag[i] = 1; dirty[nd++] = i; }
            if (!dirtyFlag[j]) { dirtyFlag[j] = 1; dirty[nd++] = j; }
          }
          nv = 0;
          for (let d = 0; d < nd; d++) {
            const p = dirty[d];
            dirtyFlag[p] = 0;
            for (let a = adjStart[p], end = adjStart[p + 1]; a < end; a++) {
              const e = adjEdge[a];
              if (edgeSeen[e]) continue;
              const i = 3 * EI[2 * e], j = 3 * EI[2 * e + 1];
              const ex = P[j] - P[i], ey = P[j + 1] - P[i + 1], ez = P[j + 2] - P[i + 2];
              const L2 = ex * ex + ey * ey + ez * ez, L02 = EL[e] * EL[e];
              if (L2 > STRETCH2 * L02 || L2 < COMPRESS2 * L02) { edgeSeen[e] = 1; violated[nv++] = e; }
            }
          }
        }
        for (let k = 0; k < nv; k++) edgeSeen[violated[k]] = 0;

        if (np > 1) collide();

        const col = world.collider;
        if (col) col(P, V, n);

        // Floor at y = 0, then velocities, plus per-piece sums for the rigid velocity field and
        // kinetic energy: [0..2] sum m v, [3..5] sum m x, [6..8] sum m x*v, [9..14] sum m x x^T,
        // [15] sum m v^2. The floor only lifts positions; its static and kinetic friction act on the
        // velocity, so a contact cannot snap a particle back from its neighbours after the strain limits.
        pAcc.fill(0);
        for (let i = 0, p = 0; i < n3; i += 3, p++) {
          let pen = 0;
          world.pinY[p] = (world.pinY[p] & 2) | (P[i + 1] <= 1e-6 ? 1 : 0);   // bit 1: on the floor (bit 2: under the press)
          if (P[i + 1] < 0) {
            pen = -P[i + 1];
            P[i + 1] = 0;
            if (Xp[i + 1] < 0) Xp[i + 1] = 0;   // started below (moved there from outside): placed, not launched
            pSupport[PO[p]] = 1;
          }
          let vx = (P[i] - Xp[i]) * ih, vz = (P[i + 2] - Xp[i + 2]) * ih;
          const vy = (P[i + 1] - Xp[i + 1]) * ih;
          if (pen > 0) {
            const dn = pen * ih, vt2 = vx * vx + vz * vz;
            if (vt2 < MU_S * MU_S * dn * dn) { vx = 0; vz = 0; }
            else { const fr = 1 - Math.min((MU_K * dn) / Math.sqrt(vt2), 1); vx *= fr; vz *= fr; }
          }
          V[i] = vx; V[i + 1] = vy; V[i + 2] = vz;
          const m = mass[p], o = PO[p] << 4, x = P[i], y = P[i + 1], z = P[i + 2];
          pAcc[o] += m * vx; pAcc[o + 1] += m * vy; pAcc[o + 2] += m * vz;
          pAcc[o + 3] += m * x; pAcc[o + 4] += m * y; pAcc[o + 5] += m * z;
          pAcc[o + 6] += m * (y * vz - z * vy); pAcc[o + 7] += m * (z * vx - x * vz); pAcc[o + 8] += m * (x * vy - y * vx);
          pAcc[o + 9] += m * x * x; pAcc[o + 10] += m * y * y; pAcc[o + 11] += m * z * z;
          pAcc[o + 12] += m * x * y; pAcc[o + 13] += m * x * z; pAcc[o + 14] += m * y * z;
          pAcc[o + 15] += m * (vx * vx + vy * vy + vz * vz);
        }

        // Edge damping: only the relative velocity along each edge (conserves linear and angular momentum).
        for (let e = 0; e < ne; e++) {
          const i = 3 * EI[2 * e], j = 3 * EI[2 * e + 1];
          const ex = P[j] - P[i], ey = P[j + 1] - P[i + 1], ez = P[j + 2] - P[i + 2];
          const L2 = ex * ex + ey * ey + ez * ez;
          if (L2 < 1e-20) continue;
          const s = (beta * ((V[j] - V[i]) * ex + (V[j + 1] - V[i + 1]) * ey + (V[j + 2] - V[i + 2]) * ez)) / L2;
          const si = s * EW[e], sj = s - si;
          V[i] += ex * si; V[i + 1] += ey * si; V[i + 2] += ez * si;
          V[j] -= ex * sj; V[j + 1] -= ey * sj; V[j + 2] -= ez * sj;
        }

        // Per piece: rigid velocity field (v_cm, omega about the centroid) and the settling factor.
        for (let p = 0; p < np; p++) {
          const o = p << 4, r = 9 * p, M = pMass[p], iM = 1 / M;
          const vx = pAcc[o] * iM, vy = pAcc[o + 1] * iM, vz = pAcc[o + 2] * iM;
          const cx = pAcc[o + 3] * iM, cy = pAcc[o + 4] * iM, cz = pAcc[o + 5] * iM;
          const lx = pAcc[o + 6] - M * (cy * vz - cz * vy), ly = pAcc[o + 7] - M * (cz * vx - cx * vz), lz = pAcc[o + 8] - M * (cx * vy - cy * vx);
          const sxx = pAcc[o + 9] - M * cx * cx, syy = pAcc[o + 10] - M * cy * cy, szz = pAcc[o + 11] - M * cz * cz;
          const sxy = pAcc[o + 12] - M * cx * cy, sxz = pAcc[o + 13] - M * cx * cz, syz = pAcc[o + 14] - M * cy * cz;
          const a = syy + szz, b = sxx + szz, c = sxx + syy, d = -sxy, e = -sxz, f = -syz;  // inertia tensor
          const c00 = b * c - f * f, c01 = e * f - d * c, c02 = d * f - b * e, c11 = a * c - e * e, c12 = d * e - a * f, c22 = a * b - d * d;
          const det = a * c00 + d * c01 + e * c02;
          let wx = 0, wy = 0, wz = 0;
          if (det > 1e-12 * (a + b + c) ** 3) {
            const id = 1 / det;
            wx = (c00 * lx + c01 * ly + c02 * lz) * id; wy = (c01 * lx + c11 * ly + c12 * lz) * id; wz = (c02 * lx + c12 * ly + c22 * lz) * id;
          }
          pRig[r] = vx; pRig[r + 1] = vy; pRig[r + 2] = vz; pRig[r + 3] = wx; pRig[r + 4] = wy; pRig[r + 5] = wz;
          pRig[r + 6] = cx; pRig[r + 7] = cy; pRig[r + 8] = cz;
          const e2 = pAcc[o + 15] * iM;
          pScale[p] = pSupport[p] && e2 < SETTLE_V * SETTLE_V ? 1 - SETTLE_RATE * (1 - Math.sqrt(e2) / SETTLE_V) : 1;
        }

        // Deformation damping toward the piece's rigid velocity (syrupy end of the damping
        // slider), settling damping, then the speed cap.
        for (let i = 0, p = 0; i < n3; i += 3, p++) {
          const pc = PO[p], r = 9 * pc, sc = pScale[pc];
          const rx = P[i] - pRig[r + 6], ry = P[i + 1] - pRig[r + 7], rz = P[i + 2] - pRig[r + 8];
          let vx = V[i], vy = V[i + 1], vz = V[i + 2];
          vx += kd * (pRig[r] + pRig[r + 4] * rz - pRig[r + 5] * ry - vx);
          vy += kd * (pRig[r + 1] + pRig[r + 5] * rx - pRig[r + 3] * rz - vy);
          vz += kd * (pRig[r + 2] + pRig[r + 3] * ry - pRig[r + 4] * rx - vz);
          if (ROLL && pSupport[pc]) {   // rolling resistance: a piece on the floor spins down instead of rolling away
            vx -= ROLL * (pRig[r + 4] * rz - pRig[r + 5] * ry); vy -= ROLL * (pRig[r + 5] * rx - pRig[r + 3] * rz); vz -= ROLL * (pRig[r + 3] * ry - pRig[r + 4] * rx);
          }
          vx *= sc; vy *= sc; vz *= sc;
          const s2 = vx * vx + vy * vy + vz * vz;
          if (s2 > VMAX * VMAX) { const q = VMAX / Math.sqrt(s2); vx *= q; vy *= q; vz *= q; }
          V[i] = vx; V[i + 1] = vy; V[i + 2] = vz;
        }
      }
      hand.sx = hand.tx; hand.sy = hand.ty; hand.sz = hand.tz;

      // NaN guard: restore the last good state, else remember this one.
      let sum = 0;
      for (let i = 0; i < n3; i++) sum += P[i] + V[i];
      if (Number.isFinite(sum)) { bPos.set(P); bVel.set(V); bRot.set(TR); }
      else { P.set(bPos); V.set(bVel); TR.set(bRot); }
    }

    // Inter-piece particle collisions with per-pair AABB pruning and a spatial hash.
    function collide() {
      const P = pos;
      for (let p = 0; p < np; p++) {
        let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
        for (let i = 3 * pStart[p], e = 3 * (pStart[p] + pCount[p]); i < e; i += 3) {
          const x = P[i], y = P[i + 1], z = P[i + 2];
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (z < z0) z0 = z; if (z > z1) z1 = z;
        }
        const o = 6 * p;
        pBox[o] = x0 - COLL_D; pBox[o + 1] = y0 - COLL_D; pBox[o + 2] = z0 - COLL_D;
        pBox[o + 3] = x1 + COLL_D; pBox[o + 4] = y1 + COLL_D; pBox[o + 5] = z1 + COLL_D;
      }
      let any = false;
      for (let p = 0; p < np; p++) {
        for (let q = p + 1; q < np; q++) {
          const a = 6 * p, b = 6 * q;
          const hit = pBox[a] <= pBox[b + 3] && pBox[b] <= pBox[a + 3] && pBox[a + 1] <= pBox[b + 4] &&
            pBox[b + 1] <= pBox[a + 4] && pBox[a + 2] <= pBox[b + 5] && pBox[b + 2] <= pBox[a + 5] ? 1 : 0;
          pOverlap[p * np + q] = pOverlap[q * np + p] = hit;
          if (hit) any = true;
        }
      }
      if (!any) return;

      // Candidates: particles inside the (padded) box of an overlapping piece.
      hHead.fill(-1);
      let nc = 0;
      const inv = 1 / COLL_D;
      for (let p = 0; p < np; p++) {
        for (let i = pStart[p], e = pStart[p] + pCount[p]; i < e; i++) {
          const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
          for (let q = 0; q < np; q++) {
            if (!pOverlap[p * np + q]) continue;
            const b = 6 * q;
            if (x >= pBox[b] && x <= pBox[b + 3] && y >= pBox[b + 1] && y <= pBox[b + 4] && z >= pBox[b + 2] && z <= pBox[b + 5]) {
              const hsh = (Math.imul(Math.floor(x * inv), 73856093) ^ Math.imul(Math.floor(y * inv), 19349663) ^ Math.imul(Math.floor(z * inv), 83492791)) & hMask;
              hNext[i] = hHead[hsh]; hHead[hsh] = i; cand[nc++] = i;
              break;
            }
          }
        }
      }

      const D2 = COLL_D * COLL_D;
      for (let c = 0; c < nc; c++) {
        const i = cand[c], pi = pieceOf[i];
        const cx = Math.floor(P[3 * i] * inv), cy = Math.floor(P[3 * i + 1] * inv), cz = Math.floor(P[3 * i + 2] * inv);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
          const hsh = (Math.imul(cx + ox, 73856093) ^ Math.imul(cy + oy, 19349663) ^ Math.imul(cz + oz, 83492791)) & hMask;
          for (let j = hHead[hsh]; j >= 0; j = hNext[j]) {
            if (j <= i || pieceOf[j] === pi) continue;
            const a = 3 * i, b = 3 * j;
            let ex = P[b] - P[a], ey = P[b + 1] - P[a + 1], ez = P[b + 2] - P[a + 2];
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 >= D2) continue;
            // (not Math.hypot: V8's variadic builtin allocates, and this is the pair loop)
            const rx = restPos[b] - restPos[a], ry = restPos[b + 1] - restPos[a + 1], rz = restPos[b + 2] - restPos[a + 2];
            const rd = Math.sqrt(rx * rx + ry * ry + rz * rz);
            const dmin = Math.min(COLL_D, Math.max(COLL_DMIN, rd));
            if (d2 >= dmin * dmin) continue;
            let dist = Math.sqrt(d2);
            if (dist < 1e-9) {            // coincident: separate along the rest offset, else up
              if (rd > 1e-9) { ex = rx; ey = ry; ez = rz; dist = rd; }
              else { ex = 0; ey = 1; ez = 0; dist = 1; }
              const L = Math.min(dmin, COLL_PUSH) / dist, wi = invMass[i] / (invMass[i] + invMass[j]);
              P[a] -= ex * L * wi; P[a + 1] -= ey * L * wi; P[a + 2] -= ez * L * wi;
              P[b] += ex * L * (1 - wi); P[b + 1] += ey * L * (1 - wi); P[b + 2] += ez * L * (1 - wi);
            } else {
              const L = Math.min(dmin - dist, COLL_PUSH) / dist, wi = invMass[i] / (invMass[i] + invMass[j]);
              P[a] -= ex * L * wi; P[a + 1] -= ey * L * wi; P[a + 2] -= ez * L * wi;
              P[b] += ex * L * (1 - wi); P[b + 1] += ey * L * (1 - wi); P[b + 2] += ez * L * (1 - wi);
            }
            pSupport[pi] = 1; pSupport[pieceOf[j]] = 1;
          }
        }
      }
    }

    // ---- Hand ----------------------------------------------------------------

    function grabStart(p, opts) {
      if (n === 0 || !p) return false;
      const o = opts || {};
      const gx = px(p), gy = py(p), gz = pz(p);
      if (!Number.isFinite(gx + gy + gz)) return false;
      const r = o.radius > 0 ? o.radius : 0.25;
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) {
        const d2 = (pos[3 * i] - gx) ** 2 + (pos[3 * i + 1] - gy) ** 2 + (pos[3 * i + 2] - gz) ** 2;
        if (d2 < bd) { bd = d2; best = i; }
      }
      const pc = pieceOf[best], idx = [], w = [];
      for (let i = pStart[pc]; i < pStart[pc] + pCount[pc]; i++) {
        const d2 = (pos[3 * i] - gx) ** 2 + (pos[3 * i + 1] - gy) ** 2 + (pos[3 * i + 2] - gz) ** 2;
        if (d2 < r * r) { const u = 1 - d2 / (r * r); idx.push(i); w.push(u * u); }
      }
      if (idx.length === 0) { idx.push(best); w.push(1); }
      held.fill(0);
      for (let k = 0; k < idx.length; k++) if (w[k] >= HELD_W) held[idx[k]] = 1;
      held[best] = 1;
      hand.piece = pc; hand.count = idx.length; hand.anchor = best;
      hand.lra = new Float32Array(pCount[pc]);
      for (let k = 0, i = pStart[pc]; k < pCount[pc]; k++, i++) {
        hand.lra[k] = LRA * Math.hypot(restPos[3 * i] - restPos[3 * best], restPos[3 * i + 1] - restPos[3 * best + 1], restPos[3 * i + 2] - restPos[3 * best + 2]);
      }
      hand.idx = Uint32Array.from(idx); hand.w = Float32Array.from(w); hand.off = new Float32Array(3 * idx.length);
      for (let k = 0; k < idx.length; k++) {
        hand.off[3 * k] = pos[3 * idx[k]] - gx; hand.off[3 * k + 1] = pos[3 * idx[k] + 1] - gy; hand.off[3 * k + 2] = pos[3 * idx[k] + 2] - gz;
      }
      const ax = o.axis ? px(o.axis) : 0, ay = o.axis ? py(o.axis) : 1, az = o.axis ? pz(o.axis) : 0;
      const al = Math.hypot(ax, ay, az);
      if (al > 1e-9 && Number.isFinite(al)) { hand.ax = ax / al; hand.ay = ay / al; hand.az = az / al; }
      else { hand.ax = 0; hand.ay = 1; hand.az = 0; }
      hand.rot.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      pieceMatrix(pc);
      hand.reach = Math.hypot(gx - cen[0], gy - cen[1], gz - cen[2]) + HAND_REACH;
      hand.tx = hand.sx = gx; hand.ty = hand.sy = Math.max(gy, HAND_YMIN); hand.tz = hand.sz = gz;
      world.grabbing = true;
      return true;
    }

    // Moves the hand target, clamped to the reach around the held piece's centroid and above the floor.
    function grabMove(p) {
      if (hand.count === 0 || !p) return;
      let gx = px(p), gy = py(p), gz = pz(p);
      if (!Number.isFinite(gx + gy + gz)) return;
      const pc = hand.piece, M = pMass[pc];
      let cx = 0, cy = 0, cz = 0;
      for (let i = pStart[pc]; i < pStart[pc] + pCount[pc]; i++) { cx += mass[i] * pos[3 * i]; cy += mass[i] * pos[3 * i + 1]; cz += mass[i] * pos[3 * i + 2]; }
      cx /= M; cy /= M; cz /= M;
      const dx = gx - cx, dy = gy - cy, dz = gz - cz, L = Math.hypot(dx, dy, dz);
      if (L > hand.reach) { const s = hand.reach / L; gx = cx + dx * s; gy = cy + dy * s; gz = cz + dz * s; }
      hand.tx = gx; hand.ty = Math.max(gy, HAND_YMIN); hand.tz = gz;
    }

    // Twists the held patch by `angle` radians (absolute, relative to grabStart) about the grab axis.
    function grabTwist(angle) {
      if (hand.count === 0 || !Number.isFinite(angle)) return;
      const a = clamp(angle, -Math.PI, Math.PI), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
      const x = hand.ax, y = hand.ay, z = hand.az, M = hand.rot;
      M[0] = c + t * x * x; M[1] = t * x * y - s * z; M[2] = t * x * z + s * y;
      M[3] = t * x * y + s * z; M[4] = c + t * y * y; M[5] = t * y * z - s * x;
      M[6] = t * x * z - s * y; M[7] = t * y * z + s * x; M[8] = c + t * z * z;
    }

    // Lets go; the held piece's mean speed is capped so a flick cannot launch it.
    function grabEnd() {
      if (hand.count === 0) { world.grabbing = false; return; }
      const pc = hand.piece, s = pStart[pc], e = s + pCount[pc], M = pMass[pc];
      let mx = 0, my = 0, mz = 0;
      for (let i = s; i < e; i++) { mx += mass[i] * vel[3 * i]; my += mass[i] * vel[3 * i + 1]; mz += mass[i] * vel[3 * i + 2]; }
      mx /= M; my /= M; mz /= M;
      const sp = Math.hypot(mx, my, mz);
      const k = sp > RELEASE_V ? 1 - RELEASE_V / sp : 0;
      for (let i = s; i < e; i++) {
        let vx = vel[3 * i] - mx * k, vy = vel[3 * i + 1] - my * k, vz = vel[3 * i + 2] - mz * k;
        const s2 = vx * vx + vy * vy + vz * vz;
        if (s2 > 4 * RELEASE_V * RELEASE_V) { const r = (2 * RELEASE_V) / Math.sqrt(s2); vx *= r; vy *= r; vz *= r; }
        vel[3 * i] = vx; vel[3 * i + 1] = vy; vel[3 * i + 2] = vz;
      }
      hand.count = 0; hand.piece = -1; held.fill(0);
      world.grabbing = false;
    }

    // A bounce plus a little spin, like a knock on the board: only pieces touching the
    // board are kicked (pieces stacked on them are carried by the collisions), and they
    // are topped up to the bounce speed rather than added to. Spamming it therefore
    // cannot pump a piece higher than about one hop of (NUDGE_V * strength)^2 / 2g
    // (plus what a piece landing on its edge or rebounding adds; bounded, not cumulative).
    function nudge(strength = 1) {
      const st = clamp(Number.isFinite(strength) ? strength : 1, 0, 4);
      if (n === 0 || st === 0) return;
      const up = NUDGE_V * st;
      for (let p = 0; p < np; p++) {
        if (p === hand.piece) continue;
        const s = pStart[p], e = s + pCount[p], M = pMass[p];
        let vy = 0, cx = 0, cy = 0, cz = 0, ymin = Infinity;
        for (let i = s; i < e; i++) {
          vy += mass[i] * vel[3 * i + 1]; cx += mass[i] * pos[3 * i]; cy += mass[i] * pos[3 * i + 1]; cz += mass[i] * pos[3 * i + 2];
          if (pos[3 * i + 1] < ymin) ymin = pos[3 * i + 1];
        }
        if (!(ymin <= NUDGE_FLOOR)) continue;
        vy /= M; cx /= M; cy /= M; cz /= M;
        const dv = up - vy;
        if (dv <= 0) continue;
        const ang = rand() * 2 * Math.PI, spin = NUDGE_SPIN * st * (dv / up);
        const wx = Math.cos(ang) * spin, wy = (rand() - 0.5) * spin, wz = Math.sin(ang) * spin;
        for (let i = s; i < e; i++) {
          const rx = pos[3 * i] - cx, ry = pos[3 * i + 1] - cy, rz = pos[3 * i + 2] - cz;
          vel[3 * i] += wy * rz - wz * ry;
          vel[3 * i + 1] += dv + wz * rx - wx * rz;
          vel[3 * i + 2] += wx * ry - wy * rx;
        }
      }
    }

    // ---- Queries -------------------------------------------------------------

    // Best-fit rigid transform of a piece: x ~= R (X - restCentroid) + t.
    // Pass `out` (a previous result) to reuse it and avoid allocation.
    function rigidFrame(p, out) {
      const res = out || { R: new Float64Array(9), t: [0, 0, 0], restCentroid: [0, 0, 0] };
      if (!(p >= 0 && p < np)) { res.R.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); res.t[0] = res.t[1] = res.t[2] = 0; return res; }
      pieceRotation(p);
      quatToMat(pQuat, 4 * p, res.R);
      res.t[0] = cen[0]; res.t[1] = cen[1]; res.t[2] = cen[2];
      if (res.restCentroid) { res.restCentroid[0] = pRestC[3 * p]; res.restCentroid[1] = pRestC[3 * p + 1]; res.restCentroid[2] = pRestC[3 * p + 2]; }
      return res;
    }

    function stats() {
      let ke = 0, V = 0, V0 = 0, M = 0;
      for (let i = 0; i < n; i++) ke += mass[i] * (vel[3 * i] ** 2 + vel[3 * i + 1] ** 2 + vel[3 * i + 2] ** 2);
      const list = [];
      for (let p = 0; p < np; p++) {
        let vp = 0;
        for (let t = pTetStart[p]; t < pTetStart[p] + pTetCount[p]; t++) {
          vp += tripleVolume(pos, 3 * tetIdx[4 * t], 3 * tetIdx[4 * t + 1], 3 * tetIdx[4 * t + 2], 3 * tetIdx[4 * t + 3]);
        }
        pieceRotation(p);
        quatToMat(pQuat, 4 * p, M9);
        const up = [M9[1], M9[4], M9[7]];
        list.push({ massG: pMass[p] * massScale, relVol: vp / pVol0[p], centroid: [cen[0], cen[1], cen[2]], up, flat: Math.abs(up[1]) > 0.9 });
        V += vp; V0 += pVol0[p]; M += pMass[p];
      }
      // KE: 0.5 m v^2 with m in g (x 1e-3 kg) and v in units/s (x 0.035 m/s), in microjoules.
      return { massG: M * massScale, relVol: V0 > 0 ? V / V0 : 1, keUJ: keScale * ke, pieces: list };
    }

    function strain() {
      let s2 = 0, mx = 0;
      for (let e = 0; e < ne; e++) {
        const i = 3 * edgeIdx[2 * e], j = 3 * edgeIdx[2 * e + 1];
        const s = Math.abs(Math.hypot(pos[j] - pos[i], pos[j + 1] - pos[i + 1], pos[j + 2] - pos[i + 2]) / edgeL0[e] - 1);
        s2 += s * s;
        if (s > mx) mx = s;
      }
      return { rms: ne ? Math.sqrt(s2 / ne) : 0, max: mx };
    }

    return world;
  }

  return { createWorld, embed };
}
