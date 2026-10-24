// Iceberg Jelly — the layout of the polar bay. Block-local coordinates: y up, base at y = 0, |x|, |z| <= HALF,
// the front face at z = +HALF. A glacier comes down a valley at the back left between a peaky range and a
// spur and ends in an ice cliff standing in deep water, its tongue flanked by moraine banks; a snowy ridge runs
// along the back; at the back right a low peninsula carries the penguin rookery, a research station and a
// timber quay; a ragged skerry of two low rocks lies off to the front right. 2D points are (x, z).
export const I = (() => {
  const HALF = 2.6, GN = 168, GDX = (2 * HALF) / GN, TILT_MAX = 0.15, G = 9.8;
  const SL = 1.0;                                  // the sea level
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  function hash2(i, j) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z) {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  const ridged = (x, z) => 1 - Math.abs(vnoise(x, z) * 2 - 1);
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ----- the glacier: its tongue, its surface, the cliff -----
  const GX = -1.3, GW = 0.55, GZ = -0.55;          // the tongue's middle, half width, and where the cliff stands
  const glacierTop = (x, z) => 1.3 + 0.56 * Math.pow(clamp((GZ - z) / (2.6 + GZ), 0, 1), 0.75) + 0.02 * Math.cos(((x - GX) / GW) * 1.6);
  const valleyFloor = (z) => mix(0.36, 1.45, ss(GZ, -2.6, z));   // the rock bed under the ice
  const inTongue = (x) => 1 - ss(GW - 0.06, GW + 0.02, Math.abs(x - GX));
  // ----- the land round the bay -----
  const PEAKS = [[-2.35, -2.2, 2.32, 0.42], [-2.3, -1.2, 2.05, 0.38], [-2.25, -0.45, 1.72, 0.34], [-0.35, -2.25, 2.0, 0.34], [-0.4, -1.4, 1.72, 0.3], [0.1, -2.45, 1.85, 0.3]];
  const PEN = { x0: 0.3, z1: -0.55 };               // the peninsula: x beyond x0, z behind z1
  const SKERRY = [[1.6, 1.55, 0.17], [1.96, 1.86, 0.12]];
  function land(x, z) {
    // the sea floor: deep in the bay, deeper under the cliff
    let h = 0.42 - 0.08 * Math.exp(-((x - GX) ** 2 + (z - GZ - 0.3) ** 2) / 0.35) + 0.04 * (vnoise(x * 1.7 + 3, z * 1.7 - 1) - 0.5);
    // the mountains: a peaky range on the left, a spur right of the glacier, a snowy ridge along the back
    let m = 0;
    for (const [px, pz, ph, pr] of PEAKS) { const d = Math.hypot(x - px, z - pz) / pr; m = Math.max(m, (ph - 0.6) * Math.exp(-d * d * 1.4)); }
    const left = ss(-1.75, -2.05, x) * ss(0.45, -0.1, z), spur = ss(-0.95, -0.65, x) * ss(0.25, -0.05, x) * ss(-0.6, -0.9, z), back = ss(-1.9, -2.3, z) * ss(0.5, 0.1, x);
    const range = Math.max(left * (1.3 + 0.25 * ridged(x * 2.2, z * 2.2)), spur * (1.25 + 0.2 * ridged(x * 2.6 + 4, z * 2.6)), back * (1.55 + 0.25 * ridged(x * 2.4 - 3, z * 1.8)));
    h = Math.max(h, Math.max(range, (0.6 + m) * Math.max(left, spur, back)) + 0.05 * (ridged(x * 6, z * 6) - 0.5));
    // the peninsula: low, rounded at its edges, with a beach on its west shore
    const pd = Math.min(x - PEN.x0, PEN.z1 - z), beach = ss(0.0, 0.5, PEN.x0 + 0.5 - x) * ss(-0.6, -1.3, z);
    h = Math.max(h, (pd > 0 ? 1.1 + 0.05 * ss(0, 0.6, pd) : mix(0.42, 1.1, ss(-0.22 - beach * 0.3, 0, pd))) + 0.025 * (vnoise(x * 3, z * 3) - 0.5));
    // the skerry
    for (const [sx, sz, sr] of SKERRY) {
      const d = Math.hypot(x - sx, z - sz) / sr, a = Math.atan2(z - sz, x - sx), r = 1 + 0.18 * Math.sin(5 * a + sx * 7) + 0.1 * Math.sin(9 * a);
      h = Math.max(h, 1.07 - 0.65 * ss(0.6 * r, 1.25 * r, d) + 0.02 * ridged(x * 30, z * 30));
    }
    return h;
  }
  function terrainH(x, z) {
    let h = land(x, z);
    const t = inTongue(x), ad = Math.abs(x - GX);
    if (z < GZ && t > 0) h = mix(h, glacierTop(x, z), t);   // the ice fills its valley, ending in the cliff
    // moraine banks along both margins, running on past the cliff into the water
    const mor = Math.exp(-((ad - GW - 0.02) ** 2) / 0.004) * (z < -2.4 ? 0 : 1);
    if (mor > 0.01) { const top = z < GZ ? glacierTop(x, z) + 0.035 : mix(1.12, 0.6, ss(GZ, GZ + 0.35, z)); h = Math.max(h, mix(h, top, mor)); }
    return h;
  }
  function terrainNormal(x, z, out = [0, 0, 0]) {
    const e = 0.012, nx = -(terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), nz = -(terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const l = Math.hypot(nx, 1, nz);
    out[0] = nx / l; out[1] = 1 / l; out[2] = nz / l;
    return out;
  }
  /** The ground's zones for its shading: glacier ice, moraine, the rookery's pebbles. */
  const ROOK = [1.5, -1.3];
  function zones(x, z) {
    const ice = z < GZ + 0.004 ? inTongue(x) : 0;
    const mor = Math.exp(-((Math.abs(x - GX) - GW - 0.02) ** 2) / 0.003) * (z < GZ + 0.35 ? 1 : 0);
    const a = Math.atan2(z - ROOK[1], x - ROOK[0]), r = 0.42 * (1 + 0.22 * Math.sin(3 * a + 1) + 0.12 * Math.sin(7 * a - 2));
    const rook = 1 - ss(r * 0.85, r, Math.hypot((x - ROOK[0]) / 1.15, z - ROOK[1]));
    return [ice, Math.min(1, mor) * (1 - ice * 0.7), rook];
  }
  // ----- places -----
  const QUAY = { x0: 0.82, x1: 1.78, z: PEN.z1 + 0.02, deck: 1.09 };   // the timber quay along the peninsula's front
  const SLABS = [GX - 0.27, GX, GX + 0.27];                             // where the calving slabs stand along the cliff
  const STATION = { x: 2.1, z: -2.05 };
  const BEACH = [0.42, -0.95];                                         // where the penguins go down to the water
  const NESTS = (() => {   // pebble rings on the rookery's patch
    const R = rng(17), out = [];
    for (let k = 0; k < 400 && out.length < 22; k++) {
      const x = ROOK[0] + (R() - 0.5) * 0.85, z = ROOK[1] + (R() - 0.5) * 0.7;
      if (zones(x, z)[2] < 0.7 || out.some((n) => Math.hypot(n[0] - x, n[1] - z) < 0.07)) continue;
      out.push([x, z]);
    }
    return out;
  })();
  return { HALF, GN, GDX, TILT_MAX, G, SL, GX, GW, GZ, PEN, SKERRY, QUAY, SLABS, STATION, BEACH, NESTS, ROOK,
    terrainH, terrainNormal, glacierTop, valleyFloor, zones, clamp, ss, mix, rng, vnoise };
})();
