// Bubbles in a diorama's sea: rising ones (from splashes, sinking things, now and then the seabed) that pop
// into a small ripple at the surface, and still ones caught in the jelly as decor.
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** o: { water, rand, terrainH(x, z), rest? (the level the decor is placed under; default each body's own), max?, decor? } */
export function createBubbles({ water: W, rand: R, terrainH, rest, max = 260, decor = 80 }) {
  const HALF = W.half, MAX = max, ND = decor, restAt = (x, z) => rest ?? W.levelAt(x, z);
  const x = new Float32Array(MAX), y = new Float32Array(MAX), z = new Float32Array(MAX), r = new Float32Array(MAX), ph = new Float32Array(MAX);
  const dec = new Float32Array(ND * 4);
  let n = 0, seabed = 1;
  const Bb = { MAX, ND, popped: 0 };
  Object.defineProperty(Bb, 'count', { get: () => n });
  Bb.emit = (px, py, pz, pr) => {
    if (n >= MAX) return;
    x[n] = clamp(px, -HALF + 0.02, HALF - 0.02); y[n] = py; z[n] = clamp(pz, -HALF + 0.02, HALF - 0.02); r[n] = pr; ph[n] = R() * 6.28; n++;
  };
  Bb.reset = () => {
    n = 0;
    let k = 0;
    for (let tries = 0; k < ND && tries < 4000; tries++) {
      const px = (R() * 2 - 1) * (HALF - 0.1), pz = (R() * 2 - 1) * (HALF - 0.1), t = terrainH(px, pz), lv = restAt(px, pz);
      if (lv - 0.2 - t < 0.22) continue;
      dec.set([px, t + 0.06 + R() * (lv - 0.26 - t), pz, 0.006 + 0.012 * R() * R()], 4 * k++);
    }
    for (; k < ND; k++) dec.set([0, -10, 0, 0], 4 * k);
  };
  Bb.step = (dt, time) => {
    for (let i = 0; i < n; i++) {
      y[i] += (0.16 + 7 * r[i]) * dt;
      x[i] = clamp(x[i] + Math.cos(time * 5.3 + ph[i]) * 0.05 * dt, -HALF + 0.02, HALF - 0.02);
      z[i] = clamp(z[i] + Math.sin(time * 4.1 + ph[i]) * 0.05 * dt, -HALF + 0.02, HALF - 0.02);
      const surf = W.surface(x[i], z[i]);
      if (y[i] + r[i] > surf || !W.isWet(x[i], z[i])) {   // pop into a small ripple
        const v = r[i] * r[i] * r[i] * 40;
        W.addVolume(x[i], z[i], v, 0.03); W.addVolume(x[i], z[i], -v, 0.07);
        n--; x[i] = x[n]; y[i] = y[n]; z[i] = z[n]; r[i] = r[n]; ph[i] = ph[n]; i--;
        Bb.popped++;
      }
    }
    if ((seabed -= dt) < 0) {   // now and then a few from the seabed
      seabed = 1.2 + R() * 2.4;
      for (let tries = 0; tries < 20; tries++) {
        const px = (R() * 2 - 1) * (HALF - 0.1), pz = (R() * 2 - 1) * (HALF - 0.1);
        if (!W.isWet(px, pz) || W.levelAt(px, pz) - terrainH(px, pz) < 0.25) continue;
        const t = terrainH(px, pz), m = 1 + ((R() * 3) | 0);
        for (let q = 0; q < m; q++) Bb.emit(px + (R() - 0.5) * 0.03, t + 0.02 + q * 0.03, pz + (R() - 0.5) * 0.03, 0.006 + 0.008 * R());
        break;
      }
    }
  };
  /** xyz r per bubble: the rising ones, then the decor. */
  Bb.pack = (out) => {
    for (let i = 0; i < n; i++) { out[4 * i] = x[i]; out[4 * i + 1] = y[i]; out[4 * i + 2] = z[i]; out[4 * i + 3] = r[i]; }
    out.set(dec, 4 * n);
    return n + ND;
  };
  return Bb;
}
