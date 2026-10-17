// Props for a diorama, all in one mesh and one draw: every vertex names its part, and each part has a
// 3×4 transform in the instance buffer (part 0 is the still scenery and stays at the identity; a part with
// a zero transform is hidden). Gates, people, boats, birds are parts posed every frame. A vertex carries its
// colour and material, so one shader draws paint, leaves, brass, glass, washing, fish, smoke.
// Vertex: position, normal, linear colour, material, part (11 floats).
import { srgbToLinear } from './math.js';

export const MAT = { MATTE: 0, PAINT: 1, LEAF: 2, METAL: 3, GLASS: 4, CLOTH: 5, FISH: 6, GLOSS: 7, GLOW: 8, SMOKE: 9, FEATHER: 10, GRASS: 11, BRICK: 12, FLOAT: 13, ICE: 14, RIBS: 15, TIMBER: 16, CLEAR: 17 };

// ----- 3×4 affine transforms, row-major: [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz] -----
export const A = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  t: (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z],
  s: (x, y = x, z = x) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0],
  rx: (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; },
  ry: (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; },
  rz: (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; },
  /** a·b (b first). Any number of arguments: A.mul(a, b, c) = a·b·c. */
  mul(...ms) {
    return ms.reduce((a, b) => {
      const o = new Array(12);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) o[4 * i + j] = a[4 * i] * b[j] + a[4 * i + 1] * b[4 + j] + a[4 * i + 2] * b[8 + j];
        o[4 * i + 3] = a[4 * i] * b[3] + a[4 * i + 1] * b[7] + a[4 * i + 2] * b[11] + a[4 * i + 3];
      }
      return o;
    });
  },
  /** From a quaternion (x, y, z, w), a position and a uniform scale. */
  q: (q, p = [0, 0, 0], s = 1) => {
    const [x, y, z, w] = q;
    return [s * (1 - 2 * (y * y + z * z)), s * 2 * (x * y - z * w), s * 2 * (x * z + y * w), p[0],
      s * 2 * (x * y + z * w), s * (1 - 2 * (x * x + z * z)), s * 2 * (y * z - x * w), p[1],
      s * 2 * (x * z - y * w), s * 2 * (y * z + x * w), s * (1 - 2 * (x * x + y * y)), p[2]];
  },
  /** Columns: x axis, y axis, z axis, origin. */
  basis: (X, Y, Z, o) => [X[0], Y[0], Z[0], o[0], X[1], Y[1], Z[1], o[1], X[2], Y[2], Z[2], o[2]],
  apply: (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]],
  dir: (m, d) => [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[4] * d[0] + m[5] * d[1] + m[6] * d[2], m[8] * d[0] + m[9] * d[1] + m[10] * d[2]],
  /** A unit cylinder (radius 1, y from 0 to 1) stretched from a to b with radius r: a cable, a wire, a stay. */
  seg(a, b, r) {
    const Y = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...Y) || 1e-6, t = Y.map((v) => v / l);
    const ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let X = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]]; const xl = Math.hypot(...X); X = X.map((v) => (v / xl) * r);
    const Z = [t[1] * X[2] - t[2] * X[1], t[2] * X[0] - t[0] * X[2], t[0] * X[1] - t[1] * X[0]];
    return A.basis(X, Y, Z, a);
  },
};

export const ICO = (() => {   // unit icospheres by subdivision: { P: points, F: faces }
  const out = [];
  const t = (1 + Math.sqrt(5)) / 2;
  let P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((v) => v / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  out.push({ P: P.map((p) => p.slice()), F: F.map((f) => f.slice()) });
  for (let s = 0; s < 3; s++) {
    const cache = new Map(), mid = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!cache.has(k)) { const m = P[a].map((v, i) => v + P[b][i]), l = Math.hypot(...m); P.push(m.map((v) => v / l)); cache.set(k, P.length - 1); }
      return cache.get(k);
    };
    F = F.flatMap(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
    out.push({ P: P.map((p) => p.slice()), F: F.map((f) => f.slice()) });
  }
  return out;
})();

export function partsBuilder() {
  const V = [], I = [];
  let M = A.id(), col = [0.5, 0.5, 0.5], mat = 0, part = 0, nParts = 1;
  const nrmOf = (m) => [   // cofactor of the 3×3: normals under any invertible transform
    m[5] * m[10] - m[6] * m[9], m[6] * m[8] - m[4] * m[10], m[4] * m[9] - m[5] * m[8],
    m[2] * m[9] - m[1] * m[10], m[0] * m[10] - m[2] * m[8], m[1] * m[8] - m[0] * m[9],
    m[1] * m[6] - m[2] * m[5], m[2] * m[4] - m[0] * m[6], m[0] * m[5] - m[1] * m[4]];
  let C = nrmOf(M);
  const vert = (p, n) => {
    const q = A.apply(M, p), nx = C[0] * n[0] + C[1] * n[1] + C[2] * n[2], ny = C[3] * n[0] + C[4] * n[1] + C[5] * n[2], nz = C[6] * n[0] + C[7] * n[1] + C[8] * n[2], l = Math.hypot(nx, ny, nz) || 1;
    V.push(q[0], q[1], q[2], nx / l, ny / l, nz / l, col[0], col[1], col[2], mat, part);
    return V.length / 11 - 1;
  };
  // triangles wound to face their vertices' normals
  const tri = (a, b, c) => {
    const P = (k) => [V[11 * k], V[11 * k + 1], V[11 * k + 2]], pa = P(a), pb = P(b), pc = P(c);
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const s = n[0] * (V[11 * a + 3] + V[11 * b + 3] + V[11 * c + 3]) + n[1] * (V[11 * a + 4] + V[11 * b + 4] + V[11 * c + 4]) + n[2] * (V[11 * a + 5] + V[11 * b + 5] + V[11 * c + 5]);
    if (s >= 0) I.push(a, b, c); else I.push(a, c, b);
  };
  const B = {
    /** Colour ('#rrggbb' or linear [r, g, b]), material, part. */
    col(c) { col = typeof c === 'string' ? srgbToLinear(c) : c; return B; },
    mat(m) { mat = m; return B; },
    part(k) { part = k; nParts = Math.max(nParts, k + 1); return B; },
    /** Start a new part; returns its index. */
    newPart() { B.part(nParts); return part; },
    get nParts() { return nParts; },
    /** Emit fn() under the extra transform m. */
    at(m, fn) { const M0 = M, C0 = C; M = A.mul(M, m); C = nrmOf(M); fn(); M = M0; C = C0; return B; },
    /** A box centred on the origin. */
    box(w, h, d) {
      const x = w / 2, y = h / 2, z = d / 2;
      for (const [n, u, v] of [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]]) {
        const c = [n[0] * x, n[1] * y, n[2] * z], du = [u[0] * x, u[1] * y, u[2] * z], dv = [v[0] * x, v[1] * y, v[2] * z];
        const k = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => vert([c[0] + a * du[0] + b * dv[0], c[1] + a * du[1] + b * dv[1], c[2] + a * du[2] + b * dv[2]], n));
        tri(k[0], k[1], k[2]); tri(k[0], k[2], k[3]);
      }
      return B;
    },
    /** A box from corner to corner. */
    slab(x0, y0, z0, x1, y1, z1) { return B.at(A.t((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), () => B.box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))); },
    /** A surface of revolution about y: profile [[r, y], ...], smooth. */
    lathe(prof, seg = 14) {
      const base = V.length / 11;
      for (let i = 0; i < prof.length; i++) {
        const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)], dr = b[0] - a[0], dy = b[1] - a[1];
        for (let s = 0; s <= seg; s++) {
          const th = (s / seg) * 2 * Math.PI, c = Math.cos(th), sn = Math.sin(th);
          vert([prof[i][0] * c, prof[i][1], prof[i][0] * sn], [dy * c, -dr, dy * sn]);
        }
      }
      for (let i = 0; i + 1 < prof.length; i++) for (let s = 0; s < seg; s++) {
        const a = base + i * (seg + 1) + s, b = a + seg + 1;
        tri(a, b, a + 1); tri(a + 1, b, b + 1);
      }
      return B;
    },
    /** A cylinder (or cone) on y from 0 to h, with flat caps. */
    cyl(r, h, seg = 12, r1 = r, caps = true) {
      B.lathe([[r, 0], [r1, h]], seg);
      if (caps) {
        if (r > 0) B.disc(r, 0, -1, seg);
        if (r1 > 0) B.disc(r1, h, 1, seg);
      }
      return B;
    },
    disc(r, y, up, seg = 12) {
      const c = vert([0, y, 0], [0, up, 0]), first = V.length / 11;
      for (let s = 0; s < seg; s++) { const th = (s / seg) * 2 * Math.PI; vert([r * Math.cos(th), y, r * Math.sin(th)], [0, up, 0]); }
      for (let s = 0; s < seg; s++) tri(c, first + s, first + ((s + 1) % seg));
      return B;
    },
    /** An ellipsoid (smooth icosphere). */
    ball(rx, ry = rx, rz = rx, sub = 1) {
      const S = ICO[sub], base = V.length / 11;
      for (const p of S.P) vert([p[0] * rx, p[1] * ry, p[2] * rz], [p[0] / rx, p[1] / ry, p[2] / rz]);
      for (const [a, b, c] of S.F) tri(base + a, base + b, base + c);
      return B;
    },
    /** A tube along a polyline, with a radius (or one per point). */
    tube(pts, r, seg = 8) {
      const base = V.length / 11, n = pts.length;
      let ref = [0, 1, 0];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const tl = Math.hypot(...t) || 1; t = t.map((v) => v / tl);
        if (Math.abs(t[0] * ref[0] + t[1] * ref[1] + t[2] * ref[2]) > 0.95) ref = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
        let u = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
        const w = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]];
        ref = w;
        const ri = Array.isArray(r) ? r[i] : r;
        for (let s = 0; s <= seg; s++) {
          const th = (s / seg) * 2 * Math.PI, c = Math.cos(th), sn = Math.sin(th), d = [u[0] * c + w[0] * sn, u[1] * c + w[1] * sn, u[2] * c + w[2] * sn];
          vert([pts[i][0] + d[0] * ri, pts[i][1] + d[1] * ri, pts[i][2] + d[2] * ri], d);
        }
      }
      for (let i = 0; i + 1 < n; i++) for (let s = 0; s < seg; s++) {
        const a = base + i * (seg + 1) + s, b = a + seg + 1;
        tri(a, b, a + 1); tri(a + 1, b, b + 1);
      }
      return B;
    },
    /** A polygon in the xy plane (fanned from its first point), extruded by depth along z. */
    prism(poly, depth) {
      const n = poly.length, z0 = -depth / 2, z1 = depth / 2;
      for (const [z, nz] of [[z1, 1], [z0, -1]]) {
        const k = poly.map(([x, y]) => vert([x, y, z], [0, 0, nz]));
        for (let i = 1; i + 1 < n; i++) tri(k[0], k[i], k[i + 1]);
      }
      let area = 0;
      for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
      const sg = area > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n], nx = (b[1] - a[1]) * sg, ny = (a[0] - b[0]) * sg;
        const k = [vert([a[0], a[1], z0], [nx, ny, 0]), vert([b[0], b[1], z0], [nx, ny, 0]), vert([b[0], b[1], z1], [nx, ny, 0]), vert([a[0], a[1], z1], [nx, ny, 0])];
        tri(k[0], k[1], k[2]); tri(k[0], k[2], k[3]);
      }
      return B;
    },
    /** A flat triangle, its normal facing away from the model's origin (faceted, star-shaped solids). */
    facet(a, b, c) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      if (n[0] * (a[0] + b[0] + c[0]) + n[1] * (a[1] + b[1] + c[1]) + n[2] * (a[2] + b[2] + c[2]) < 0) n = n.map((v) => -v);
      tri(vert(a, n), vert(b, n), vert(c, n));
      return B;
    },
    /** A flat quad (a, b, c, d in order); drawn two-sided. */
    quad(a, b, c, d) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const k = [a, b, c, d].map((p) => vert(p, n));
      tri(k[0], k[1], k[2]); tri(k[0], k[2], k[3]);
      return B;
    },
    /** A grid surface from fn(i, j) -> [x, y, z] (rows × cols points), smooth normals from neighbours. */
    sheet(rows, cols, fn) {
      const P = [];
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) P.push(fn(i, j));
      const at = (i, j) => P[Math.min(rows - 1, Math.max(0, i)) * cols + Math.min(cols - 1, Math.max(0, j))];
      const base = V.length / 11;
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const a = at(i + 1, j), b = at(i - 1, j), c = at(i, j + 1), d = at(i, j - 1);
        const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
        vert(P[i * cols + j], [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
      }
      for (let i = 0; i + 1 < rows; i++) for (let j = 0; j + 1 < cols; j++) {
        const a = base + i * cols + j;
        tri(a, a + cols, a + 1); tri(a + 1, a + cols, a + cols + 1);
      }
      return B;
    },
    done: () => ({ vert: Float32Array.from(V), index: Uint32Array.from(I), nParts }),
  };
  return B;
}

/** Write part k's transform (12 floats) into the instance array; null hides it. */
export function setPart(buf, k, m) {
  if (!m) { buf.fill(0, 12 * k, 12 * k + 12); return; }
  for (let i = 0; i < 12; i++) buf[12 * k + i] = m[i];
}

export const VB_PARTS = [{ arrayStride: 44, attributes: [
  { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
  { shaderLocation: 2, offset: 24, format: 'float32x3' }, { shaderLocation: 3, offset: 36, format: 'float32x2' }] }];

/** The parts layer for createDioramaRenderer (the parts' transforms are the instance data). */
export const partsLayer = (mesh) => ({ vs: 'vsParts', fs: 'fsParts', buffers: VB_PARTS, vert: mesh.vert, index: mesh.index, shadow: true });

export const PARTS_WGSL = /* wgsl */ `
// ----- parts: one mesh, a 3×4 transform per part in inst -----
struct PtOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) lp: vec3f, @location(2) n: vec3f, @location(3) c: vec3f,
  @location(4) @interpolate(flat) m: u32, @location(5) mp: vec3f }
fn partAt(k: u32, p: vec3f, w: f32) -> vec3f {
  let a = inst[3u * k]; let b = inst[3u * k + 1u]; let c = inst[3u * k + 2u];
  return vec3f(dot(a.xyz, p) + a.w * w, dot(b.xyz, p) + b.w * w, dot(c.xyz, p) + c.w * w);
}
@vertex fn vsParts(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) mk: vec2f) -> PtOut {
  let m = u32(mk.x + 0.5);
  let k = u32(mk.y + 0.5);
  let t = U.eye.w;
  let ph = f32(k) * 1.618;
  var q = p;
  if (m == ${MAT.FISH}u) { q.z += sin(t * 13.0 + ph * 5.0 + p.x * 70.0) * 0.012 * smoothstep(0.01, -0.04, p.x); }   // the tail beats
  if (m == ${MAT.CLOTH}u) { q.z += (sin(t * 5.5 + ph + p.x * 30.0) * 0.5 + sin(t * 9.1 + p.x * 51.0) * 0.12) * max(-p.y, 0.0); }   // washing flaps below its line
  var lp = partAt(k, q, 1.0);
  if (m == ${MAT.FLOAT}u) { lp.y = water(lp.xz).x + q.y; }   // riding the surface: y is the height above the water
  if (m == ${MAT.LEAF}u || m == ${MAT.GRASS}u) {   // the breeze: more the higher above the ground
    let hgt = clamp(lp.y - water(lp.xz).w, 0.0, 1.2);
    let a = select(0.008, 0.02, m == ${MAT.GRASS}u) * hgt * hgt;
    lp.x += (sin(t * 1.3 + lp.z * 2.1 + lp.x * 1.3) + 0.4 * sin(t * 3.7 + lp.x * 9.0)) * a;
    lp.z += (cos(t * 1.1 + lp.x * 1.9) + 0.4 * sin(t * 4.3 + lp.z * 8.0)) * a * 0.7;
  }
  var o: PtOut;
  let w = toWorld(lp);
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.lp = lp; o.n = nWorld(partAt(k, n, 0.0)); o.c = c; o.m = m; o.mp = p;
  return o;
}
// brickwork in courses over the block-local position, its colour the vertex's
fn partBrick(c: vec3f, lp: vec3f, n: vec3f) -> vec3f {
  let nl = abs(normalize((U.Minv * vec4f(n, 0.0)).xyz));
  var uv = vec2f(lp.x, lp.y);
  if (nl.x > nl.z && nl.x > nl.y) { uv = vec2f(lp.z, lp.y); }
  if (nl.y > nl.x && nl.y > nl.z) { uv = lp.xz; }
  let row = floor(uv.y / 0.021);
  let uu = uv.x / 0.05 + fract(row * 0.5);
  let fu = fract(uu);
  let fv = fract(uv.y / 0.021);
  let mortar = max(1.0 - smoothstep(0.03, 0.07, min(fu, 1.0 - fu)), 1.0 - smoothstep(0.06, 0.13, min(fv, 1.0 - fv)));
  let b = c * (0.76 + 0.38 * hash21(vec2f(floor(uu), row))) * (0.9 + 0.14 * vnoise(uv * 260.0));
  return mix(b, vec3f(0.55, 0.53, 0.5), mortar * 0.8);
}
@fragment fn fsParts(i: PtOut) -> FOut {
  let ribS = (i.mp.x + i.mp.z) * 900.0;
  let ribW = fwidth(ribS);   // out here: derivatives need uniform control flow
  let v = normalize(V.eye.xyz - i.wp);
  var n = normalize(i.n);
  if (dot(n, v) < 0.0) { n = -n; }   // thin things are two-sided
  let m = i.m;
  var alb = i.c;
  var rough = 0.8;
  var f0 = 0.035;
  var wrap = 0.2;
  var sun = shadowAt(i.wp, n);
  if (m == ${MAT.PAINT}u) { rough = 0.38; f0 = 0.045; }
  if (m == ${MAT.GLOSS}u || m == ${MAT.FISH}u || m == ${MAT.FLOAT}u) { rough = 0.22; f0 = 0.05; }
  if (m == ${MAT.FEATHER}u) { rough = 0.6; wrap = 0.35; }
  if (m == ${MAT.GLASS}u || m == ${MAT.CLEAR}u) { rough = 0.06; f0 = 0.09; }
  if (m == ${MAT.BRICK}u) { alb = partBrick(alb, i.lp, i.n); rough = 0.75; }
  if (m == ${MAT.RIBS}u) {   // corrugated sheet (containers, sheds): ribs across the model's x + z, fading where they'd shimmer
    alb *= 1.0 - 0.24 * (0.5 + 0.5 * sin(ribS)) * clamp(1.6 - ribW * 0.5, 0.0, 1.0);
    rough = 0.45; f0 = 0.045;
  }
  if (m == ${MAT.TIMBER}u) {   // weathered timber: grain and plank to plank variation
    alb *= (0.72 + 0.4 * vnoise(vec2f((i.mp.x + i.mp.z) * 30.0, i.mp.y * 420.0 + (i.mp.x - i.mp.z) * 90.0))) * (0.85 + 0.25 * hash21(floor(i.mp.xz * 60.0)));
    rough = 0.85;
  }
  // in the water: wet and darker, caustics under the surface
  let ws = water(i.lp.xz);
  let under = ws.x - i.lp.y;
  if (ws.x > ws.w + 0.012 && under > -0.012) {
    alb *= 0.74; rough = min(rough, 0.4);
    if (under > 0.0) { sun *= mix(1.0, caustic(i.lp.xz) * 1.1, 0.9 * exp(-under * 1.3)); }
  }
  var c: vec3f;
  if (m == ${MAT.ICE}u) {   // faceted ice: chalky snow on the tops, blue bands in the sides, glassy blue under water, sparkles
    let up = normalize((U.Minv * vec4f(n, 0.0)).xyz).y;
    let sub = smoothstep(-0.01, 0.03, under) * step(ws.w + 0.012, ws.x);
    let band = smoothstep(0.55, 0.9, fract(i.mp.y * 22.0 + 0.3 * vnoise(i.mp.xz * 30.0))) * (1.0 - smoothstep(0.5, 0.8, up));
    let snow = smoothstep(0.45, 0.8, up) * (1.0 - sub);
    var ice = mix(i.c, vec3f(0.42, 0.68, 0.86), band * 0.55);
    ice = mix(ice, vec3f(0.3, 0.62, 0.85), sub * 0.75);
    let a = mix(ice, vec3f(0.96, 0.97, 0.98), snow);
    c = lit(a, n, v, mix(0.18, 0.85, snow), 0.035, sun, 0.4);
    let back = pow(max(dot(-v, U.sun.xyz), 0.0), 2.0) * 0.7 + 0.35 * pow(1.0 - abs(dot(n, v)), 2.0);
    c += vec3f(0.35, 0.6, 0.8) * SUNC * 0.35 * back * (1.0 - snow);   // light through the ice
    let f = floor(i.mp * 140.0);
    let g = step(0.93, hash21(f.xy + f.z * 7.1)) * pow(max(dot(reflect(-v, n), U.sun.xyz), 0.0), 60.0) * sun;
    c += vec3f(g * 3.0);
  } else if (m == ${MAT.METAL}u) {
    let r = reflect(-v, n);
    c = lit(alb * 0.25, n, v, 0.3, 0.0, sun, 0.1) + alb * (env(r) * 0.75 + SUNC * specGGX(n, v, U.sun.xyz, 0.28) * sun);
  } else if (m == ${MAT.GLOW}u) {
    c = alb * 3.0;
  } else if (m == ${MAT.SMOKE}u) {
    c = alb * (ambient(n) * 1.5 + SUNC * 0.35 * (0.5 + 0.5 * dot(n, U.sun.xyz)) * (0.5 + 0.5 * sun));
  } else {
    c = lit(alb, n, v, rough, f0, sun, wrap);
    if (m == ${MAT.LEAF}u || m == ${MAT.GRASS}u || m == ${MAT.CLOTH}u) {   // sun through leaves and cloth
      let back = pow(max(dot(-v, U.sun.xyz), 0.0), 3.0) * 0.8 + 0.25 * pow(1.0 - abs(dot(n, v)), 2.0);
      c += alb * alb * SUNC * 0.5 * back * (0.3 + 0.7 * sun);
    }
  }
  var o = opaque(c, i.wp);
  if (m == ${MAT.CLEAR}u) { o.c.a = 0.3 + 0.55 * pow(1.0 - abs(dot(n, v)), 3.0); }   // clear glass (by alpha to coverage): see-through, more of a mirror at a glancing angle
  return o;
}
`;
