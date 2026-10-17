// Meshes of the steel the cut jellies meet: the nakiri knife (any proportions), the crinkle blade
// and the tin-plate cookie cutter; and the melon knife's material. Vertex format: px py pz nx ny nz material u. Each patch has its
// own vertices (hard creases); patches meet at identical positions, so every part is watertight once
// welded by position. Each patch is wound to agree with its vertex normals (outward).
// Materials: 0 blade, 1 ground bevel, 2 bolster, 3 walnut, 4 rivet, 5 tin wall, 6 rolled rim, 7 grip.
const PI = Math.PI;

export function meshBuilder() {
  const v = [], ix = [];
  const vert = (o) => {
    const l = Math.hypot(o[3], o[4], o[5]) || 1;
    v.push(o[0], o[1], o[2], o[3] / l, o[4] / l, o[5] / l, o[6], o[7]);
    return v.length / 8 - 1;
  };
  // Agreement of a triangle's winding with its vertex normals (> 0: outward).
  const agree = (a, b, c) => {
    const A = 8 * a, B = 8 * b, C = 8 * c;
    const ux = v[B] - v[A], uy = v[B + 1] - v[A + 1], uz = v[B + 2] - v[A + 2];
    const wx = v[C] - v[A], wy = v[C + 1] - v[A + 1], wz = v[C + 2] - v[A + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    return nx * (v[A + 3] + v[B + 3] + v[C + 3]) + ny * (v[A + 4] + v[B + 4] + v[C + 4]) + nz * (v[A + 5] + v[B + 5] + v[C + 5]);
  };
  // A patch is wound as a whole (majority vote), so folds in a swept surface stay consistent.
  const emit = (tris) => {
    let s = 0;
    for (let t = 0; t < tris.length; t += 3) s += Math.sign(agree(tris[t], tris[t + 1], tris[t + 2]));
    for (let t = 0; t < tris.length; t += 3) {
      if (s >= 0) ix.push(tris[t], tris[t + 1], tris[t + 2]); else ix.push(tris[t], tris[t + 2], tris[t + 1]);
    }
  };
  // rows x cols vertices from fn(r, c); quads between neighbours, columns optionally wrapped.
  const grid = (rows, cols, wrap, fn) => {
    const base = v.length / 8, tris = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) vert(fn(r, c));
    for (let r = 0; r + 1 < rows; r++) {
      for (let c = 0; c < (wrap ? cols : cols - 1); c++) {
        const c1 = (c + 1) % cols, a = base + r * cols + c, b = base + r * cols + c1;
        tris.push(a, b, b + cols, a, b + cols, a + cols);
      }
    }
    emit(tris);
  };
  // Flat cap: centre + ring (array of [x, y, z]) with one normal.
  const cap = (ring, centre, n, mat, u) => {
    const c = vert([centre[0], centre[1], centre[2], n[0], n[1], n[2], mat, u(centre)]);
    const first = v.length / 8, tris = [];
    for (const p of ring) vert([p[0], p[1], p[2], n[0], n[1], n[2], mat, u(p)]);
    for (let k = 0; k < ring.length; k++) tris.push(c, first + k, first + ((k + 1) % ring.length));
    emit(tris);
  };
  const done = () => ({ vtx: Float32Array.from(v), index: Uint32Array.from(ix) });
  return { grid, cap, done };
}

// Unit rounded octagon in (y, z): octagon with chamfers, Chaikin-rounded (flat-side midpoints kept).
const OCT = (() => {
  const c = 0.42;
  let p = [1, c, c, 1, -c, 1, -1, c, -1, -c, -c, -1, c, -1, 1, -c];
  for (let it = 0; it < 3; it++) {
    const q = [], n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      q.push(0.75 * p[2 * i] + 0.25 * p[2 * j], 0.75 * p[2 * i + 1] + 0.25 * p[2 * j + 1],
             0.25 * p[2 * i] + 0.75 * p[2 * j], 0.25 * p[2 * i + 1] + 0.75 * p[2 * j + 1]);
    }
    p = q;
  }
  return p;
})();

/** Closed loft along x through stations { x, cy, a (half height), b (half width) } with flat caps. */
export function loft(B, st, mat) {
  const n = OCT.length / 2;
  B.grid(st.length, n, true, (r, k) => {
    const S = st[r], km = (k + n - 1) % n, kp = (k + 1) % n;
    const ty = S.a * (OCT[2 * kp] - OCT[2 * km]), tz = S.b * (OCT[2 * kp + 1] - OCT[2 * km + 1]);
    let ny = tz, nz = -ty;
    if (ny * OCT[2 * k] + nz * OCT[2 * k + 1] < 0) { ny = -ny; nz = -nz; }
    return [S.x, S.cy + S.a * OCT[2 * k], S.b * OCT[2 * k + 1], 0, ny, nz, mat, S.x];
  });
  for (const [i, j] of [[0, 1], [st.length - 1, st.length - 2]]) {
    const S = st[i], dir = Math.sign(S.x - st[j].x), ring = [];
    for (let k = 0; k < n; k++) ring.push([S.x, S.cy + S.a * OCT[2 * k], S.b * OCT[2 * k + 1]]);
    B.cap(ring, [S.x, S.cy, 0], [dir, 0, 0], mat, (p) => p[0]);
  }
}

/**
 * Nakiri proportions (local frame: x along the edge, tip +x; y up from the edge; z across).
 * L, HB, YB, RC: blade length, height, top of the ground bevel, nose radius; HE, HSH, HS: half
 * thickness at the edge, the bevel shoulder and the spine; LIFT: the edge rises toward the nose;
 * CY: handle axis height; bolster [x end, a0, a1, b0, b1]; handle { X0, a, b, belly };
 * rivets { xs, r, inset, proud }.
 */
export const KNIFE_LARGE = Object.freeze({
  L: 4.3, HB: 1.3, YB: 0.32, RC: 0.28, HE: 0.002, HSH: 0.017, HS: 0.025, LIFT: 0, CY: 1.13,
  bolster: [-0.32, 0.2, 0.163, 0.06, 0.108], handle: { X0: -2.1, a: 0.15, b: 0.1, belly: 0.06 },
  rivets: { xs: [-0.66, -1.21, -1.76], r: 0.03, inset: 0.02, proud: 0.006 },
});
export const KNIFE_SMALL = Object.freeze({
  L: 1.72, HB: 0.63, YB: 0.1, RC: 0.15, HE: 0.0015, HSH: 0.008, HS: 0.015, LIFT: 0.035, CY: 0.63 - 0.13,
  bolster: [-0.12, 0.1, 0.074, 0.026, 0.05], handle: { X0: -1.18, a: 0.068, b: 0.046, belly: 0.07 },
  rivets: { xs: [-0.36, -0.65, -0.94], r: 0.013, inset: 0.01, proud: 0.003 },
});

/** Blade half-thickness at height y above the edge (the knife's collider). */
export function bladeHalf(K, y) {
  return y <= K.YB ? K.HE + (K.HSH - K.HE) * (y / K.YB) : K.HSH + (K.HS - K.HSH) * Math.min(1, (y - K.YB) / (K.HB - K.YB));
}

/** Rectangular blade with a ground bevel and a rounded nose, polished bolster, oval walnut handle
 *  that swells a little toward the middle, three steel rivets per side. */
export function knifeMesh(K) {
  const B = meshBuilder();
  const { L, HB, YB, RC, HE, HSH, HS, CY } = K;
  const sB = (HSH - HE) / YB, sM = (HS - HSH) / (HB - YB);
  const ht = (y) => (y <= YB ? HE + sB * y : HSH + sM * (y - YB));
  const lift = (x) => { const t = Math.max(0, Math.min(1, (x - 0.62 * L) / (0.38 * L))); return K.LIFT * t * t; };
  const Y = (x, y) => y + lift(x) * (1 - y / HB);          // the lift fades out toward the spine
  // Profile columns: straight spine, then the rounded nose down to x = L.
  const cx = [], top = [], tnx = [], tny = [], NM = 40, NCR = 8;
  for (let i = 0; i <= NM; i++) { cx.push(((L - RC) * i) / NM); top.push(HB); tnx.push(0); tny.push(1); }
  for (let k = 1; k <= NCR; k++) {
    const a = ((k / NCR) * PI) / 2;
    cx.push(k === NCR ? L : L - RC + RC * Math.sin(a)); top.push(k === NCR ? HB - RC : HB - RC + RC * Math.cos(a));
    tnx.push(Math.sin(a)); tny.push(Math.cos(a));
  }
  const NC = cx.length, BR = 4, MR = 6;
  const bevY = (r) => (YB * r) / BR;
  const mainY = (c, r) => (r === MR ? top[c] : YB + ((top[c] - YB) * r) / MR);
  for (const s of [1, -1]) {
    B.grid(BR + 1, NC, false, (r, c) => { const y = bevY(r); return [cx[c], Y(cx[c], y), s * ht(y), 0, -sB, s, 1, cx[c]]; });
    B.grid(MR + 1, NC, false, (r, c) => { const y = mainY(c, r); return [cx[c], Y(cx[c], y), s * ht(y), 0, -sM, s, 0, cx[c]]; });
  }
  B.grid(2, NC, false, (r, c) => [cx[c], Y(cx[c], 0), (r ? -1 : 1) * HE, 0, -1, 0, 1, cx[c]]);                       // cutting edge
  B.grid(2, NC, false, (r, c) => [cx[c], Y(cx[c], top[c]), (r ? -1 : 1) * ht(top[c]), tnx[c], tny[c], 0, 0, cx[c]]); // spine + nose
  for (const [c, nx] of [[0, -1], [NC - 1, 1]]) {                                                                 // heel / nose ends
    const ys = [];
    for (let r = 0; r <= BR; r++) ys.push(bevY(r));
    for (let r = 1; r <= MR; r++) ys.push(mainY(c, r));
    B.grid(ys.length, 2, false, (r, k) => [cx[c], Y(cx[c], ys[r]), (k ? -1 : 1) * ht(ys[r]), nx, 0, 0, 0, cx[c]]);
  }
  // Bolster: lofted from blade-thin to slightly over the handle section.
  const [X1h, a0, a1, b0, b1] = K.bolster, bol = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    bol.push({ x: X1h * t, cy: CY, a: a0 + (a1 - a0) * t, b: b0 + (b1 - b0) * t });
  }
  loft(B, bol, 2);
  // Walnut handle with a gentle belly.
  const { X0: X0h, a: ha, b: hb, belly } = K.handle, bulge = (t) => 1 + belly * Math.sin(PI * t), hnd = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    hnd.push({ x: X0h + (X1h - X0h) * t, cy: CY, a: ha * bulge(t), b: hb * bulge(t) });
  }
  loft(B, hnd, 3);
  // Rivets: short closed cylinders through the side faces, three per side.
  const { xs, r: RR, inset, proud } = K.rivets, NS = 16;
  for (const rx of xs) {
    const bw = hb * bulge((rx - X0h) / (X1h - X0h));
    for (const s of [1, -1]) {
      const zi = s * (bw - inset), zo = s * (bw + proud), ring = (z) => {
        const out = [];
        for (let k = 0; k < NS; k++) out.push([rx + RR * Math.cos((2 * PI * k) / NS), CY + RR * Math.sin((2 * PI * k) / NS), z]);
        return out;
      };
      B.grid(2, NS, true, (r, k) => {
        const a = (2 * PI * k) / NS;
        return [rx + RR * Math.cos(a), CY + RR * Math.sin(a), r ? zo : zi, Math.cos(a), Math.sin(a), 0, 4, rx + RR * Math.cos(a)];
      });
      B.cap(ring(zo), [rx, CY, zo], [0, 0, s], 4, (p) => p[0]);
      B.cap(ring(zi), [rx, CY, zi], [0, 0, -s], 4, (p) => p[0]);
    }
  }
  return B.done();
}

/** Crinkle cutter in the knife's local frame (x along the edge, y up, z across): a corrugated plate,
 *  z = A sin(2π (x - L/2) / WL), in phase at the knife's reference point x = L/2, under a pebbled
 *  sage-green polymer grip (material 7). */
export function wavyKnifeMesh(A, WL) {
  const B = meshBuilder();
  const L = 4.3, XA = 0.6, XB = L - 0.6, HB = 0.86, YB = 0.18;
  const HE = 0.002, HSH = 0.011, HS = 0.015;
  const sB = (HSH - HE) / YB, sM = (HS - HSH) / (HB - YB);
  const ht = (y) => (y <= YB ? HE + sB * y : HSH + sM * (y - YB));
  const k = (2 * PI) / WL, w = (x) => A * Math.sin(k * (x - L / 2)), dw = (x) => A * k * Math.cos(k * (x - L / 2));
  const NC = 180, cx = Array.from({ length: NC + 1 }, (_, i) => XA + ((XB - XA) * i) / NC);
  const BR = 3, MR = 5, bevY = (r) => (YB * r) / BR, mainY = (r) => YB + ((HB - YB) * r) / MR;
  for (const s of [1, -1]) {
    B.grid(BR + 1, NC + 1, false, (r, c) => { const x = cx[c], y = bevY(r); return [x, y, w(x) + s * ht(y), -s * dw(x), -sB, s, 1, x]; });
    B.grid(MR + 1, NC + 1, false, (r, c) => { const x = cx[c], y = mainY(r); return [x, y, w(x) + s * ht(y), -s * dw(x), -sM, s, 0, x]; });
  }
  B.grid(2, NC + 1, false, (r, c) => [cx[c], 0, w(cx[c]) + (r ? -1 : 1) * HE, 0, -1, 0, 1, cx[c]]);   // cutting edge
  for (const [x, nx] of [[XA, -1], [XB, 1]]) {
    const ys = [];
    for (let r = 0; r <= BR; r++) ys.push(bevY(r));
    for (let r = 1; r <= MR; r++) ys.push(mainY(r));
    B.grid(ys.length, 2, false, (r, q) => [x, ys[r], w(x) + (q ? -1 : 1) * ht(ys[r]), nx, 0, 0, 0, x]);
  }
  // the grip: a long rounded bar over the spine, swelling in the middle, the spine buried in it
  const st = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, p = 0.42 + 0.58 * Math.sqrt(Math.sin(PI * t)) + 0.06 * Math.sin(PI * t);
    st.push({ x: XA - 0.12 + (XB - XA + 0.24) * t, cy: HB + 0.1, a: 0.15 * p, b: 0.1 * p });
  }
  loft(B, st, 7);
  return B.done();
}

/** Tin-plate cookie cutter swept along shape.outline: wall, cutting-edge strip, rolled rim. */
export function cutterMesh(shape) {
  const B = meshBuilder(), P = shape.outline, n = P.length >> 1;
  const NXo = new Float64Array(n), NZo = new Float64Array(n);
  for (let i = 0; i < n; i++) {                // outward normal of the CCW outline
    const a = 2 * ((i + n - 1) % n), c = 2 * ((i + 1) % n);
    const tx = P[c] - P[a], tz = P[c + 1] - P[a + 1], l = Math.hypot(tx, tz) || 1;
    NXo[i] = tz / l; NZo[i] = -tx / l;
  }
  const W = 0.0175, RT = 0.045, HT = 0.95, CN = RT - W;     // half wall, rim tube radius, height
  const Y1 = HT - Math.sqrt(RT * RT - (W - CN) * (W - CN)), A0 = Math.atan2(Y1 - HT, W - CN), NA = 20;
  // Profile rows [offset along normal, y, normal-offset component, normal-y component].
  const sweep = (prof, mat) => B.grid(prof.length, n, true, (r, c) => {
    const [o, y, no, ny] = prof[r];
    return [P[2 * c] + o * NXo[c], y, P[2 * c + 1] + o * NZo[c], no * NXo[c], ny, no * NZo[c], mat, y];
  });
  sweep([[-W, 0, 0, -1], [W, 0, 0, -1]], 5);                // cutting edge strip
  sweep([[W, 0, 1, 0], [W, Y1, 1, 0]], 5);                  // outer wall
  const tube = [];
  for (let k = 0; k <= NA; k++) {                           // rolled rim, curling outward
    const a = A0 + ((PI - A0) * k) / NA, ca = Math.cos(a), sa = Math.sin(a);
    tube.push([k === 0 ? W : k === NA ? -W : CN + RT * ca, k === 0 ? Y1 : k === NA ? HT : HT + RT * sa, ca, sa]);
  }
  sweep(tube, 6);
  sweep([[-W, HT, -1, 0], [-W, 0, -1, 0]], 5);              // inner wall
  return B.done();
}

/** The melon knife's steel (05, 06; with PROPS_WGSL, on prop A): brushed with a product-shot gradient,
 *  satin bevel, mirror bolster, walnut, steel rivets. */
export const MELON_KNIFE_WGSL = /* wgsl */`
fn toolM(m: f32) -> mat4x4f { return F.propA; }
fn toolMaterial(m: u32, u: f32, lp: vec3f, N0: vec3f) -> ToolMat {
  var N = N0;
  var base = vec3f(0.62, 0.63, 0.645);
  var rough = 0.3;
  var metal = 1.0;
  if (m == 0u) {          // brushed blade: fine streaks along the length, a dark board reflected low, bright high
    let s = vnoise(vec3f(u * 3.5, lp.y * 800.0, 0.5)) * 0.7 + vnoise(vec3f(u * 1.0, lp.y * 220.0, 3.1)) * 0.3;
    N = normalize(N + vec3f(0.0, (s - 0.5) * 0.18, 0.0));
    base *= (0.9 + 0.16 * s) * mix(0.78, 1.08, smoothstep(0.05, 0.6, lp.y)); rough = 0.24 + 0.1 * s;
  } else if (m == 1u) {   // ground bevel: satin, lighter
    base = vec3f(0.76, 0.77, 0.78); rough = 0.14;
  } else if (m == 2u) {   // bolster: mirror polish
    base = vec3f(0.8, 0.8, 0.81); rough = 0.05;
  } else if (m == 3u) {   // walnut: dark grain along the handle
    let w = sin(u * 38.0 + vnoise(lp * vec3f(2.0, 26.0, 26.0)) * 7.0) * 0.5 + 0.5;
    base = mix(vec3f(0.085, 0.045, 0.025), vec3f(0.2, 0.11, 0.06), w * 0.8 + vnoise(lp * 60.0) * 0.2);
    rough = 0.42; metal = 0.0;
  } else {                // steel rivets
    base = vec3f(0.78, 0.785, 0.8); rough = 0.12;
  }
  return ToolMat(base, rough, metal, N);
}
`;
