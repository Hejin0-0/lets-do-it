// Lock Jelly — the layout. Block-local coordinates: y up, base at y = 0, footprint |x|, |z| <= HALF, the front
// face at z = +HALF. The canal runs along the front so the face cuts it lengthways: the upper pound on the left
// with its winding hole, the lock chamber in the middle, the tail and the lower pound bending away to the
// right under a bridge into a basin with an island. The ground steps down from an upper terrace to a lower one.
// Three bodies of water: 0 the upper pound, 1 the chamber, 2 the lower pound. 2D points are (x, z).
export const L = (() => {
  const HALF = 2.6, GN = 168, GDX = (2 * HALF) / GN, TILT_MAX = 0.15, G = 9.8;
  const snap = (v) => -HALF + Math.round((v + HALF) / GDX) * GDX;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  // levels: the water, the terraces, the beds
  const LU = 1.36, LL = 1.0, TU = 1.48, TL = 1.12, BU = 1.05, BC = 0.7, BL = 0.7, BB = 0.68;
  const UP = 0, CH = 1, LO = 2;
  // the lock: the chamber's back wall, the two gate lines (on cell faces), the canal's middle, the cill
  // (single-leaf gates sweep a quarter circle as wide as the chamber: the chamber is long enough for the boat to lie clear of it)
  const ZC = snap(2.2), XT = snap(-0.78), XB = snap(0.92), ZM = (ZC + HALF) / 2, CILL = XT + 0.12;

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
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ----- signed distances (negative inside) -----
  const rect = (x0, z0, x1, z1) => (x, z) => {
    const dx = Math.max(x0 - x, x - x1), dz = Math.max(z0 - z, z - z1);
    return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz);
  };
  const circ = (cx, cz, r) => (x, z) => Math.hypot(x - cx, z - cz) - r;
  const rrect = (x0, z0, x1, z1, r) => { const f = rect(x0 + r, z0 + r, x1 - r, z1 - r); return (x, z) => f(x, z) - r; };
  function segDist(x, z, a, b) {
    const ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
  }
  const lineDist = (pts) => (x, z) => { let d = Infinity; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i], pts[i + 1])); return d; };

  // ----- the water's shapes: walled (brick, vertical) or soft (a sloping bank with a shelf for the reeds) -----
  // Where a soft shape meets a walled one in the water, it runs on into it (a soft edge in open water would leave a ridge).
  // The lower pound is a walled cut: the tail, a wide quarter-round bend (its outer edge on the face, wide
  // enough for a boat's stern to track inside it) and the channel back to the basin.
  const BEND = [1.62, 1.75], BEND_R = [0, 0.85], CHX = BEND[0] + 0.65, CHW = 0.24;
  const BASIN = [0.62, -2.42, 2.53, 0.62], ISLE = [1.62, -1.0, 0.26], BRIDGE = { z: 0.98, half: 0.12 };
  const WIND = [-2.0, 1.98, 0.64];
  const SHAPES = [
    { d: rect(-3, 2.0, XT - 0.5, 3), bed: BU, lv: LU, soft: true },                        // the upper pound
    { d: circ(...WIND), bed: BU, lv: LU, soft: true },                                    // its winding hole
    { d: rect(XT - 0.72, 2.0, XT - 0.5, 3), bed: BU, lv: LU },                              // the wing walls
    { d: rect(XT - 0.5, ZC, XT, 3), bed: BU, lv: LU },                                    // the top approach
    { d: rect(XT - 0.45, ZC - 0.055, XT, ZC + 0.02), bed: BU, lv: LU },                   // the top gate's recess
    { d: rect(XT, ZC, XB, 3), bed: (x) => (x < CILL ? BU : BC), lv: LU },                // the chamber, with the cill under the top gate
    { d: rect(XB - 0.45, ZC - 0.055, XB, ZC + 0.02), bed: BC, lv: LU },                  // the bottom gate's recess
    { d: rect(XB, ZC, BEND[0] + 0.02, 3), bed: BL, lv: LL },                              // the tail
    { d: rect(1.25, 2.145, BEND[0] + 0.02, ZC + 0.02), bed: BL, lv: LL },                  // its widening into the bend (room for a swinging stern)
    { d: (x, z) => Math.max(Math.abs(Math.hypot(x - BEND[0], z - BEND[1]) - (BEND_R[0] + BEND_R[1]) / 2) - (BEND_R[1] - BEND_R[0]) / 2, BEND[0] - 0.2 - x, BEND[1] - 0.25 - z), bed: BL, lv: LL },   // the bend: a quarter-round pool
    { d: rect(CHX - CHW, 0.4, CHX + CHW, BEND[1] + 0.25), bed: BL, lv: LL },              // the channel to the basin
    { d: rrect(...BASIN, 0.22), bed: BB, lv: LL, soft: true },                            // the basin
  ];
  const isle = circ(...ISLE);

  // ----- the ground -----
  const bankX = (z) => mix(0.45, 1.62, ss(0.7, 1.5, z));   // where the upper terrace ends
  const SETTS = rect(XT - 0.62, ZC - 0.55, XB + 0.68, ZC + 0.05);
  function ground(x, z) {
    let g = mix(TU, TL, ss(bankX(z), bankX(z) + 0.32, x));
    g += 0.014 * (vnoise(x * 1.3 + 4.1, z * 1.3 - 2.3) - 0.5) + 0.005 * (vnoise(x * 4.1 - 1.7, z * 4.1 + 3.3) - 0.5);
    g += 0.11 * Math.exp(-((x + 1.95) ** 2 + (z + 1.6) ** 2) / (2 * 0.5 * 0.5));   // the windmill's knoll
    g += 0.03 * Math.exp(-((x - 0.2) ** 2 + (z + 1.6) ** 2) / (2 * 0.7 * 0.7));   // the sheep's field
    return mix(g, TU, 1 - ss(0, 0.03, SETTS(x, z)));   // the setts round the lock are level
  }
  function soft(d, bed, lv, g) {
    if (d <= -0.13) return bed;
    if (d >= 0.02) return g;
    const shelf = lv - 0.035;
    return d < -0.06 ? mix(bed, shelf, ss(-0.13, -0.06, d)) : mix(shelf, g, ss(-0.06, 0.02, d));
  }
  function terrainH(x, z) {
    const g = ground(x, z);
    let h = g;
    for (const S of SHAPES) {
      const d = S.d(x, z);
      if (d > 0.03) continue;
      const bed = typeof S.bed === 'function' ? S.bed(x) : S.bed;
      h = Math.min(h, S.soft ? soft(d, bed, S.lv, g) : d < 0 ? bed : g);
    }
    const di = isle(x, z);   // the island in the basin: low, with a reedy shelf
    if (di < 0.1) h = Math.max(h, di < -0.06 ? LL + 0.07 + 0.03 * Math.exp(-((di + 0.3) ** 2) * 20) : di < 0.02 ? mix(LL + 0.07, LL - 0.035, ss(-0.06, 0.02, di)) : mix(LL - 0.035, BB, ss(0.02, 0.1, di)));
    return h;
  }
  function terrainNormal(x, z, out = [0, 0, 0]) {
    const e = 0.012, nx = -(terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), nz = -(terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const l = Math.hypot(nx, 1, nz);
    out[0] = nx / l; out[1] = 1 / l; out[2] = nz / l;
    return out;
  }
  /** The body of water a place belongs to. */
  const bodyAt = (x, z) => (x < XT ? UP : x < XB && z > ZC - 0.08 ? CH : LO);
  const regionSeed = (x, z, t) => { const k = bodyAt(x, z); return t < (k === LO ? LL : LU) - 0.012 ? k : -1; };

  // ----- the ground's zones (masonry, paths, garden) for its shading -----
  const TOWPATH = lineDist([[-2.62, 1.86], [-2.52, 1.5], [-2.28, 1.2], [-1.85, 1.1], [-1.42, 1.2], [-1.2, 1.5], [-1.18, 1.84], [XT - 0.6, 1.86]]);
  const LANE = lineDist([[-2.62, 0.98], [-0.6, 0.98], [0.6, 0.94], [CHX - 0.5, BRIDGE.z], [2.62, BRIDGE.z]]);
  const PATHS = lineDist([[0.05, 1.0], [0.05, ZC - 0.53]]), DOOR = lineDist([[-0.85, 1.0], [-0.85, 0.55]]);
  const GARDEN = rect(-1.45, -0.2, -0.3, 0.86), WALLED = SHAPES.filter((S) => !S.soft);
  function zones(x, z) {
    let mas = 1 - ss(-0.01, 0.02, SETTS(x, z));
    for (const S of WALLED) mas = Math.max(mas, 1 - ss(0, 0.02, S.d(x, z)));
    const path = Math.max(1 - ss(0.05, 0.075, TOWPATH(x, z)), 1 - ss(0.07, 0.095, LANE(x, z)), 1 - ss(0.04, 0.06, PATHS(x, z)), 1 - ss(0.035, 0.05, DOOR(x, z)));
    const gar = 1 - ss(-0.02, 0.0, GARDEN(x, z));
    return [mas, path * (1 - mas), gar * (1 - path)];
  }

  // ----- the lock's gear -----
  // A gate's leaf turns on its heel at the back wall: shut it spans the canal (+z), open it lies in its recess (−x).
  // The balance beam points back over the lockside, turned 15° away from the water so a keeper fits between.
  const BEAM = 0.45, BETA = (15 * Math.PI) / 180, LEAF = HALF - ZC + 0.02;
  const GATES = [
    { name: 'top', x: XT, hinge: [XT, ZC - 0.026], bodies: [UP, CH], sill: BU },
    { name: 'bottom', x: XB, hinge: [XB, ZC - 0.026], bodies: [CH, LO], sill: BC },
  ];
  const rot = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  /** The leaf's direction and the beam's at an opening angle th (0 shut, PI/2 open). */
  const leafDir = (th) => [-Math.sin(th), Math.cos(th)];
  const beamDir = (th) => rot([Math.sin(th), -Math.cos(th)], -BETA);
  const PADDLES = [{ name: 'top', at: [XT - 0.3, ZC - 0.17] }, { name: 'bottom', at: [XB - 0.3, ZC - 0.17] }];
  const BENCH = { at: [0.3, 1.55] }, LAMP = [-0.02, 1.72];   // both out of the beams' sweeps
  const BOLLARDS = [[0.1, ZC - 0.09], [-1.6, 1.93]];

  return { HALF, GN, GDX, TILT_MAX, G, LU, LL, TU, TL, BU, BC, BL, BB, UP, CH, LO, ZC, XT, XB, ZM, CILL, BEND, BEND_R, CHW, CHX, BASIN, ISLE, BRIDGE, WIND,
    BEAM, BETA, LEAF, GATES, PADDLES, BENCH, LAMP, BOLLARDS, SETTS,
    terrainH, terrainNormal, ground, bodyAt, regionSeed, zones, leafDir, beamDir, rot, clamp, ss, mix, rng, vnoise, segDist, snap };
})();
