// Matrices (column-major, WebGPU clip depth 0..1) and colour, shared by every specimen.

export const M4 = {
  persp(fov, aspect, near, far, o = new Float32Array(16)) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    o.set([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far * nf, -1, 0, 0, near * far * nf, 0]);
    return o;
  },
  ortho(l, r, b, t, n, f, o = new Float32Array(16)) {
    o.set([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -1 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -n / (f - n), 1]);
    return o;
  },
  /** View matrix and the camera's axes (x right, y up, z back). */
  lookAt(e, c, up) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], l = Math.hypot(...z); z = z.map((v) => v / l);
    let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]; l = Math.hypot(...x); x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const d = (a) => a[0] * e[0] + a[1] * e[1] + a[2] * e[2];
    return { m: new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -d(x), -d(y), -d(z), 1]), x, y, z };
  },
  mul(a, b, o = new Float32Array(16)) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },
  inv(m, o = new Float32Array(16)) {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const id = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    o.set([
      (a11 * b11 - a12 * b10 + a13 * b09) * id, (a02 * b10 - a01 * b11 - a03 * b09) * id, (a31 * b05 - a32 * b04 + a33 * b03) * id, (a22 * b04 - a21 * b05 - a23 * b03) * id,
      (a12 * b08 - a10 * b11 - a13 * b07) * id, (a00 * b11 - a02 * b08 + a03 * b07) * id, (a32 * b02 - a30 * b05 - a33 * b01) * id, (a20 * b05 - a22 * b02 + a23 * b01) * id,
      (a10 * b10 - a11 * b08 + a13 * b06) * id, (a01 * b08 - a00 * b10 - a03 * b06) * id, (a30 * b04 - a31 * b02 + a33 * b00) * id, (a21 * b02 - a20 * b04 - a23 * b00) * id,
      (a11 * b07 - a10 * b09 - a12 * b06) * id, (a00 * b09 - a01 * b07 + a02 * b06) * id, (a31 * b01 - a30 * b03 - a32 * b00) * id, (a20 * b03 - a21 * b01 + a22 * b00) * id,
    ]);
    return o;
  },
  /** Rigid model matrix from a 3x3 row-major rotation (or axes) and a translation. */
  model(R, t, o = new Float32Array(16)) {
    o[0] = R[0]; o[1] = R[3]; o[2] = R[6]; o[3] = 0;
    o[4] = R[1]; o[5] = R[4]; o[6] = R[7]; o[7] = 0;
    o[8] = R[2]; o[9] = R[5]; o[10] = R[8]; o[11] = 0;
    o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
    return o;
  },
};

/** '#rrggbb' -> linear RGB. */
export const srgbToLinear = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

/** Khronos PBR Neutral, as in the shaders' present(). */
export function pbrNeutral(c0) {
  let c = c0.slice();
  const x = Math.min(...c), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map((v) => v - off);
  const peak = Math.max(...c);
  if (peak < 0.76) return c;
  const np = 1 - 0.0576 / (peak - 0.52);
  c = c.map((v) => v * np / peak);
  const g = 1 - 1 / (0.15 * (peak - np) + 1);
  return c.map((v) => v + (np - v) * g);
}

const radianceCache = new Map();
/** The backdrop radiance that PBR Neutral turns into exactly the page colour `hex`. */
export function backdropRadiance(hex) {
  if (radianceCache.has(hex)) return radianceCache.get(hex);
  const target = srgbToLinear(hex);
  let c = target.slice();
  for (let it = 0; it < 200; it++) {   // monotone per channel: a damped fixed-point walk converges
    const o = pbrNeutral(c);
    c = c.map((v, k) => v + (target[k] - o[k]) * 1.6);
  }
  radianceCache.set(hex, c);
  return c;
}

/** Inverse of the 3x3 matrix given by its columns, returned as columns. */
export function inv3cols(m) {
  const [a, d, g, b, e, h, c, f, i] = m;   // rows (a b c), (d e f), (g h i)
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, id = 1 / (a * A + b * B + c * C);
  const r = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v * id);
  return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
}
