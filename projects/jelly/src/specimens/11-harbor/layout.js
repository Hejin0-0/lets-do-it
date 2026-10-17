// Harbor Jelly — the layout. Block-local coordinates: y up, base at y = 0, footprint |x|, |z| <= HALF, the front
// face at z = +HALF. A vertical quay wall runs along the back: on the left a container terminal (asphalt yard,
// crane rails, stacks), on the right an old stone fishing quay with a timber pier. Behind them a town climbs a
// grassy hill. A rubble breakwater with a lighthouse on its head shelters the fishing harbour on the right; the
// open basin fills the front. One body of water. 2D points are (x, z).
export const H = (() => {
  const HALF = 2.6, GN = 168, GDX = (2 * HALF) / GN, TILT_MAX = 0.15, G = 9.8;
  const snap = (v) => -HALF + Math.round((v + HALF) / GDX) * GDX;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  // levels: the sea at rest (the tide moves it by up to TIDE), the quay's deck, the basin's bed
  const SL = 1.0, TIDE = 0.06, DECK = 1.13, BED = 0.58;
  // the quay line (water in front, z > QZ), the terminal's east end, the foot of the hill
  const QZ = snap(-0.75), XT = 0.45, HILL = -1.75;
  // the crane rails (seaside, landside), the yard lane under the backreach, the static stacks behind
  const RS = QZ - 0.06, RL = QZ - 0.37, YZ = QZ - 0.5, STACKS = [QZ - 0.69, HILL - 0.03];
  // the timber pier off the fishing quay, the breakwater (root on the right face, head with the lighthouse)
  const PIER = { x: 1.62, w: 0.13, z0: QZ, z1: 0.0, deck: 1.12 };
  const BREAK = [[2.75, 0.62], [1.0, 0.5]], LIGHT = BREAK[1], CREST = 1.12;

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
  function segDist(x, z, a, b) {
    const ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
    return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
  }
  /** Distance from the breakwater's spine. */
  const breakDist = (x, z) => segDist(x, z, BREAK[0], BREAK[1]);

  // ----- the ground -----
  const hill = (x, z) => DECK + 0.52 * ss(HILL, -2.6, z) + 0.05 * (vnoise(x * 1.6 + 3.1, z * 1.6 - 1.7) - 0.5) * ss(HILL, HILL - 0.3, z);
  function terrainH(x, z) {
    if (z < QZ) return z < HILL ? hill(x, z) : DECK;
    let h = BED + 0.035 * (vnoise(x * 1.2 + 5.3, z * 1.2 + 1.1) - 0.5) + 0.012 * (vnoise(x * 5 - 2, z * 5 + 7) - 0.5);
    h += 0.04 * ss(QZ + 0.9, QZ, z) * ss(XT - 0.2, XT + 0.4, x);   // the fishing harbour shoals a little toward its quay
    // the breakwater: a rubble mound with a flat crest, steep flanks down to the bed, a round head
    const d = breakDist(x, z);
    if (d < 0.5) h = Math.max(h, d < 0.07 ? CREST : CREST - (d - 0.07) * 1.55 + 0.02 * (vnoise(x * 30, z * 30) - 0.5));
    return h;
  }
  function terrainNormal(x, z, out = [0, 0, 0]) {
    const e = 0.012, nx = -(terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), nz = -(terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const l = Math.hypot(nx, 1, nz);
    out[0] = nx / l; out[1] = 1 / l; out[2] = nz / l;
    return out;
  }

  // ----- solid boxes for things thrown about: the pier, the sheds and houses, the stacks -----
  // [x0, y0, z0, x1, y1, z1]; houses and the like are added by the scenery as it builds them
  const BOXES = [[PIER.x - PIER.w / 2, 0.5, PIER.z0, PIER.x + PIER.w / 2, PIER.deck, PIER.z1]];
  /** A sphere against the boxes: penetration and outward normal (n), or 0. */
  function boxHit(x, y, z, r, n) {
    let best = 0;
    for (const b of BOXES) {
      const cx = clamp(x, b[0], b[3]), cy = clamp(y, b[1], b[4]), cz = clamp(z, b[2], b[5]);
      const dx = x - cx, dy = y - cy, dz = z - cz, d = Math.hypot(dx, dy, dz);
      let p, nn;
      if (d > 1e-6) { if (d >= r) continue; p = r - d; nn = [dx / d, dy / d, dz / d]; }
      else {   // the centre inside: out the nearest face
        const f = [[x - b[0], -1, 0, 0], [b[3] - x, 1, 0, 0], [y - b[1], 0, -1, 0], [b[4] - y, 0, 1, 0], [z - b[2], 0, 0, -1], [b[5] - z, 0, 0, 1]].sort((u, v) => u[0] - v[0])[0];
        p = r + f[0]; nn = f.slice(1);
      }
      if (p > best) { best = p; n[0] = nn[0]; n[1] = nn[1]; n[2] = nn[2]; }
    }
    return best;
  }

  return { HALF, GN, GDX, TILT_MAX, G, SL, TIDE, DECK, BED, QZ, XT, HILL, RS, RL, YZ, STACKS, PIER, BREAK, LIGHT, CREST, BOXES,
    terrainH, terrainNormal, breakDist, boxHit, hill, clamp, ss, mix, rng, vnoise, segDist, snap, hash2 };
})();
