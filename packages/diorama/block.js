// The jelly block a diorama sits in: it can be tipped (a spring toward the held target, or back to level)
// and it wobbles as jelly does, shearing behind its angular acceleration and squashing on landings.
// Block-local coordinates: y up, base at y = 0, footprint |x|, |z| <= half.
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** o: { half, tiltMax (radians), g (gravity) } */
export function createBlock({ half, tiltMax, g }) {
  const HALF = half, TILT_MAX = tiltMax, G = g;
  const B = { t: [0, 0], v: [0, 0], acc: [0, 0], held: false, target: [0, 0],
    shear: [0, 0], shearV: [0, 0], squash: 0, squashV: 0, R: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), lift: 0, g: [0, -G, 0] };
  // t = (tx, tz): rotation vector (tx, 0, tz). The top moves by (-tz, 0, tx) per unit height.
  function update() {
    const [tx, tz] = B.t, th = Math.hypot(tx, tz), R = B.R;
    if (th < 1e-9) R.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    else {
      const kx = tx / th, kz = tz / th, s = Math.sin(th), c = 1 - Math.cos(th);
      // R = I + s K + c K^2 with K the cross matrix of (kx, 0, kz)
      R[0] = 1 - c * kz * kz; R[1] = -s * kz; R[2] = c * kx * kz;
      R[3] = s * kz; R[4] = 1 - c * (kx * kx + kz * kz); R[5] = -s * kx;
      R[6] = c * kx * kz; R[7] = s * kx; R[8] = 1 - c * kx * kx;
    }
    let lo = Infinity;
    for (const cx of [-HALF, HALF]) for (const cz of [-HALF, HALF]) lo = Math.min(lo, R[3] * cx + R[5] * cz);
    B.lift = -lo;
    B.g[0] = -G * R[3]; B.g[1] = -G * R[4]; B.g[2] = -G * R[5];
  }
  B.reset = () => { B.t = [0, 0]; B.v = [0, 0]; B.acc = [0, 0]; B.held = false; B.shear = [0, 0]; B.shearV = [0, 0]; B.squash = 0; B.squashV = 0; update(); };
  B.step = (dt, firm, reduced) => {
    const K = B.held ? 420 : 70, C = B.held ? 38 : 7.5, tg = B.held ? B.target : [0, 0];
    const v0 = B.v[0], v1 = B.v[1];
    for (let k = 0; k < 2; k++) { B.v[k] += dt * (-K * (B.t[k] - tg[k]) - C * B.v[k]); B.t[k] += dt * B.v[k]; }
    const m = Math.hypot(B.t[0], B.t[1]);
    if (m > TILT_MAX) {
      const nx = B.t[0] / m, nz = B.t[1] / m, vr = B.v[0] * nx + B.v[1] * nz;
      B.t[0] = nx * TILT_MAX; B.t[1] = nz * TILT_MAX;
      if (vr > 0) { B.v[0] -= vr * nx; B.v[1] -= vr * nz; }
    }
    B.acc[0] = (B.v[0] - v0) / dt; B.acc[1] = (B.v[1] - v1) / dt;
    const ws = 2 * Math.PI * (2 + 2.2 * firm), wq = 2 * Math.PI * (2.6 + 2.4 * firm);
    const zs = reduced ? 0.24 : 0.1, drive = reduced ? 0.45 : 0.9;
    const dx = drive * B.acc[1], dz = -drive * B.acc[0];   // the top lags behind the block's angular acceleration
    B.shearV[0] += dt * (-ws * ws * B.shear[0] - 2 * zs * ws * B.shearV[0] + dx);
    B.shearV[1] += dt * (-ws * ws * B.shear[1] - 2 * zs * ws * B.shearV[1] + dz);
    B.shear[0] = clamp(B.shear[0] + dt * B.shearV[0], -0.05, 0.05);
    B.shear[1] = clamp(B.shear[1] + dt * B.shearV[1], -0.05, 0.05);
    B.squashV += dt * (-wq * wq * B.squash - 2 * zs * wq * B.squashV);
    B.squash = clamp(B.squash + dt * B.squashV, -0.07, 0.07);
    update();
  };
  B.kick = (dir, squash) => { B.shearV[0] += dir[0] * 0.25; B.shearV[1] += dir[1] * 0.25; B.squashV += squash * 0.3; };
  B.grab = () => { B.held = true; B.target = B.t.slice(); };
  B.release = () => { if (!B.held) return; B.held = false; B.squashV -= Math.hypot(B.v[0], B.v[1]) * 0.5; };
  B.setTarget = (tx, tz) => {
    const m = Math.hypot(tx, tz), s = m > TILT_MAX ? TILT_MAX / m : 1;
    B.target = [tx * s, tz * s];
  };
  /** Local point -> world (no wobble) and back. */
  B.toWorld = (p, o = [0, 0, 0]) => {
    const R = B.R, x = p[0], y = p[1], z = p[2];
    o[0] = R[0] * x + R[1] * y + R[2] * z; o[1] = R[3] * x + R[4] * y + R[5] * z + B.lift; o[2] = R[6] * x + R[7] * y + R[8] * z;
    return o;
  };
  B.toLocal = (p, o = [0, 0, 0]) => {
    const R = B.R, x = p[0], y = p[1] - B.lift, z = p[2];
    o[0] = R[0] * x + R[3] * y + R[6] * z; o[1] = R[1] * x + R[4] * y + R[7] * z; o[2] = R[2] * x + R[5] * y + R[8] * z;
    return o;
  };
  B.dirToLocal = (d, o = [0, 0, 0]) => {
    const R = B.R, x = d[0], y = d[1], z = d[2];
    o[0] = R[0] * x + R[3] * y + R[6] * z; o[1] = R[1] * x + R[4] * y + R[7] * z; o[2] = R[2] * x + R[5] * y + R[8] * z;
    return o;
  };
  /** Column-major 4x4 local -> world, and its inverse. */
  B.matrices = (M, Mi) => {
    const R = B.R, l = B.lift;
    M.set([R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, 0, l, 0, 1]);
    Mi.set([R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, -R[3] * l, -R[4] * l, -R[5] * l, 1]);
  };
  B.reset();
  return B;
}
