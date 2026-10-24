// Pool Jelly — the still scenery, after the user's plan. The architecture (buildArchitecture: the back wall and its
// covered colonnade of bulging columns under a straight lintel, a roof over the walk, the arches under it being props;
// the left wall pierced with round windows) is drawn by the props layer, where the lamps light it by night. Part 0
// (buildStill): the wavy planters with their rims, grass and yellow flowers, the
// water slide on its legs, the round pool's kerb, the fountain the ducks come back out of, the ladder, towels; and the
// hourglass, a part of its own. The things for people and the island's dressing are models made in Blender (props.js).
import { A, MAT } from '@lid/diorama/parts.js';
import { P } from './layout.js';

const T = P.TER, WALL_TOP = T + 1.5, PLASTER = '#f1e2d0', TAU = Math.PI * 2, Z = P.SIZE;
const k = (v) => v * P.K;   // a place on the plan (layout.js: K), drawn on the 2.6 block
/** The colonnade along the back: its columns' x, their z, the lintel's underside (the props' arches stand between them). */
export const COLONNADE = { xs: Array.from({ length: 9 }, (_, i) => k(-2.24 + 0.56 * i)), z: P.COLS + 0.12, lintel: P.PORCH + 1.35 };

function towel(B, x, z, yaw, col, y0) {
  B.at(A.mul(A.t(x, y0 + 0.002, z), A.ry(yaw), A.s(Z.towel, 1, Z.towel)), () => {
    B.col(col).mat(MAT.CLOTH).slab(-0.1, 0, -0.05, 0.1, 0.004, 0.05);
    B.col('#f6f4ee'); for (const xx of [-0.07, 0.07]) B.slab(xx - 0.008, 0.004, -0.05, xx + 0.008, 0.005, 0.05);
  });
}
/** A wall in the yz plane at x (from z0 to z1, y0 to y1, thick th), with round windows [z, y, r] cut through it. */
function wallWithHoles(B, x, z0, z1, y0, y1, th, holes) {
  const step = 0.02;
  for (let y = y0; y < y1 - 1e-6; y += step) {
    const yc = y + step / 2;
    let start = z0;
    const cuts = holes.filter(([, hy, r]) => Math.abs(yc - hy) < r).map(([hz, hy, r]) => { const w = Math.sqrt(r * r - (yc - hy) ** 2); return [hz - w, hz + w]; }).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of cuts) { if (a > start) B.slab(x - th / 2, y, start, x + th / 2, y + step, a); start = Math.max(start, b); }
    if (z1 > start) B.slab(x - th / 2, y, start, x + th / 2, y + step, z1);
  }
}

const HOLES = [[k(-1.65), T + 1.18, 0.36], [k(-0.9), T + 1.3, 0.17], [k(-0.3), T + 1.22, 0.29], [k(0.45), T + 1.1, 0.12], [k(1.1), T + 1.2, 0.34]];   // the left wall's round windows [z, y, r], high up: the duck mural runs under them (build_props.py MW)

/** The courtyard's architecture: the back wall, the left one with its round windows and their rims, the colonnade
 * (bulging columns under a straight lintel, a roof over the walk). Built here, drawn by the props layer (props.js), so
 * that the lamps light it by night (MATTE plaster and PAINT become its plaster and plastic). */
export function buildArchitecture(B) {
  const WX = (P.WALL_L - P.HALF) / 2, WTH = P.HALF + P.WALL_L;   // the left wall's middle and thickness, from the block's edge to its inner face
  B.col(PLASTER).mat(MAT.MATTE).slab(-P.HALF, P.PORCH, -P.HALF, P.HALF, WALL_TOP + 0.08, P.WALL_B);
  B.col('#f2ece4').mat(MAT.PAINT).slab(-P.HALF, WALL_TOP + 0.08, -P.HALF - 0.04, P.HALF, WALL_TOP + 0.13, P.WALL_B + 0.04);
  B.col(PLASTER).mat(MAT.MATTE);
  wallWithHoles(B, WX, P.WALL_B, P.FRONT, T, WALL_TOP + 0.08, WTH, HOLES);
  B.col('#f2ece4').mat(MAT.PAINT).slab(-P.HALF - 0.04, WALL_TOP + 0.08, P.WALL_B, P.WALL_L + 0.04, WALL_TOP + 0.13, P.FRONT);
  for (const [z, y, r] of HOLES) {
    const prof = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU; prof.push([r + 0.02 * Math.cos(a), 0.02 * Math.sin(a)]); }
    for (const s of [-1, 1]) B.col('#f6f2ea').mat(MAT.PAINT).at(A.mul(A.t(WX + s * WTH / 2, y, z), A.rz(Math.PI / 2)), () => B.lathe(prof, 24));
  }
  const colY = P.PORCH, colH = COLONNADE.lintel - colY, lintel = COLONNADE.lintel, cs = colH / 0.44, cr = 2.2;   // the shaft drawn 0.44 tall, made colH
  const shaft = [[0.0, 0.0], [0.034, 0.0], [0.034, 0.03], [0.022, 0.04], [0.03, 0.1], [0.036, 0.16], [0.03, 0.24], [0.018, 0.32], [0.02, 0.37], [0.034, 0.4], [0.034, 0.44], [0, 0.44]].map(([r, y]) => [r * cr, y * cs]);
  for (const x of COLONNADE.xs) {
    B.col('#f2ece4').mat(MAT.PAINT).at(A.t(x, colY, COLONNADE.z), () => B.lathe(shaft, 14));
    B.slab(x - 0.1, colY, P.COLS + 0.02, x + 0.1, colY + 0.07, P.COLS + 0.22);
  }
  B.col('#f2ece4').mat(MAT.PAINT).slab(P.WALL_L, lintel, P.COLS, P.HALF, lintel + 0.16, P.COLS + 0.24);
  B.col('#d8bea8').mat(MAT.MATTE).slab(P.WALL_L, lintel + 0.16, P.WALL_B, P.HALF, lintel + 0.24, P.COLS + 0.3);   // the roof
}

export function buildStill(B, rand) {
  const R = rand;
  // ----- the planters: low wavy rims, grass, yellow flowers, a palm each -----
  const [z0, z1] = P.PLANTER;
  for (const side of [-1, 1]) {
    const edge = (z) => P.planterEdge(side, z), out = side * k(2.5);
    const pts = []; for (let i = 0; i <= 24; i++) { const z = z0 + ((z1 - z0) * i) / 24; pts.push([edge(z), T + 0.05, z]); }
    B.col('#f2ece4').mat(MAT.PAINT).tube(pts, 0.06, 6);
    B.tube([[edge(z0), T + 0.05, z0], [out, T + 0.05, z0]], 0.06, 6);
    B.tube([[edge(z1), T + 0.05, z1], [out, T + 0.05, z1]], 0.06, 6);
    for (let n = 0; n < 90; n++) {
      const z = z0 + 0.05 + R() * (z1 - z0 - 0.1), x = side < 0 ? out + 0.02 + R() * (edge(z) - out - 0.06) : edge(z) + 0.04 + R() * (out - edge(z) - 0.04);
      if (n % 3 === 0) B.col(['#f7e6a0', '#f4a6c0', '#fbf6ee'][n % 9 / 3 | 0]).mat(MAT.MATTE).at(A.t(x, T + 0.12, z), () => B.ball(0.022, 0.012, 0.022, 1));   // a small flower head
      else B.col(['#5aaa48', '#4a9a3e'][n % 2]).mat(MAT.GRASS).at(A.mul(A.t(x, T + 0.08, z), A.ry(R() * 6), A.s(2.2)), () => { for (let q = 0; q < 4; q++) B.at(A.ry(q * 1.6), () => B.quad([-0.004, 0, 0], [0.004, 0, 0], [0.002, 0.05 + 0.03 * R(), 0.006], [-0.002, 0.05 + 0.03 * R(), 0.006])); });
    }
  }
  // (the fountain at the pool's head is the spa: props.js, build_props.py)
  // ----- the slide: a blue half-pipe on legs, from the notch down onto the round pool; a rim round the round pool -----
  const S = P.slide, N = 40, sec = (q) => { const p = S.at(q), p2 = S.at(Math.min(S.len, q + 0.02)), p1 = S.at(Math.max(0, q - 0.02)), tx = p2[0] - p1[0], tz = p2[2] - p1[2], l = Math.hypot(tx, tz) || 1; return { p, n: [-tz / l, tx / l] }; };
  for (const [col, r, off] of [['#f2b41e', 0.075, 0], ['#ffe08a', 0.065, 0.004]]) {   // yellow
    B.col(col).mat(off ? MAT.GLASS : MAT.GLOSS).sheet(N + 1, 9, (i, j) => {
      const { p, n } = sec((S.len * i) / N), a = Math.PI * (j / 8);
      return [p[0] + n[0] * Math.cos(a) * r, p[1] - Math.sin(a) * r * 0.8 + off, p[2] + n[1] * Math.cos(a) * r];
    });
  }
  for (const q of [0.35, 0.65, 0.95]) {
    const p = S.at(k(q));
    B.col('#f2ece4').mat(MAT.PAINT).slab(p[0] - 0.02, P.LAWN, p[2] - 0.02, p[0] + 0.02, p[1] - 0.04, p[2] + 0.02);
  }
  // ----- the tube back up: clear, ringed in blue, out of the lawn by the round pool, over the step and the big pool's rim, on legs -----
  const Tb = P.tube, TR = P.TUBE_R, step = 0.025;
  let q0 = 0; while (q0 < Tb.len && Tb.at(q0)[1] + TR < P.terrainH(...[Tb.at(q0)[0], Tb.at(q0)[2]]) - 0.02) q0 += step;   // from just under the lawn
  const tubePts = []; for (let q = q0; q < Tb.len + step / 2; q += step) tubePts.push(Tb.at(Math.min(q, Tb.len)));
  B.col('#8fcfe0').mat(MAT.CLEAR).tube(tubePts, TR, 20);   // clear glass with a tint of the water it carries
  const ringAt = (q, r) => {   // a hoop round the tube at q
    const p = Tb.at(q), a2 = Tb.at(q - 0.02), b2 = Tb.at(q + 0.02), t = [b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]], tl = Math.hypot(...t);
    const T = t.map((v) => v / tl), up = Math.abs(T[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [T[1] * up[2] - T[2] * up[1], T[2] * up[0] - T[0] * up[2], T[0] * up[1] - T[1] * up[0]]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
    const w = [T[1] * u[2] - T[2] * u[1], T[2] * u[0] - T[0] * u[2], T[0] * u[1] - T[1] * u[0]];
    B.tube(Array.from({ length: 25 }, (_, i) => { const th = (i / 24) * TAU; return [0, 1, 2].map((k) => p[k] + (u[k] * Math.cos(th) + w[k] * Math.sin(th)) * r); }), 0.014, 5);
  };
  B.col('#2a8ae8').mat(MAT.NEON);   // blue rings, neon by night
  for (let q = q0 + 0.12; q < Tb.len - 0.08; q += 0.24) ringAt(q, TR + 0.008);
  ringAt(q0 + 0.04, TR + 0.03); ringAt(Tb.len - 0.015, TR + 0.025);   // a collar where it comes out of the lawn, a lip at its mouth
  for (const q of [q0 + k(0.55), q0 + k(0.95), Tb.len - k(0.3)]) {   // chrome legs down to the ground where it runs high, a clamp round the tube on each
    const p = Tb.at(q), g = P.terrainH(p[0], p[2]);
    if (p[1] - TR - g > 0.03) {
      B.col('#c8ccd2').mat(MAT.METAL).slab(p[0] - 0.018, g, p[2] - 0.018, p[0] + 0.018, p[1] - TR, p[2] + 0.018);
      B.slab(p[0] - 0.05, g, p[2] - 0.05, p[0] + 0.05, g + 0.012, p[2] + 0.05);
      ringAt(q, TR + 0.012);
    }
  }
  // (the round pool's rim and drain are props: props.js, build_props.py)
  // ----- by the pool: a ladder into the deep end (the radio and the swan are parts of their own: scene.js) -----
  B.col('#c8d0d8').mat(MAT.METAL);
  const lz = k(-0.6), L = Z.ladder, lx = P.MAIN[2];
  for (const s of [-1, 1]) B.tube([[lx + 0.06 * L, T, lz + s * 0.04 * L], [lx + 0.06 * L, T + 0.1 * L, lz + s * 0.04 * L], [lx - 0.03 * L, T + 0.1 * L, lz + s * 0.04 * L], [lx - 0.03 * L, P.LU - 0.5, lz + s * 0.04 * L]], 0.004 * L, 6);
  // ----- loungers, chairs, towels -----
  towel(B, k(-1.15), k(1.6), 0.3, '#2a8ad8', P.LAWN); towel(B, k(0.65), k(1.5), -0.2, '#e8405a', P.LAWN);
  // ----- the beach outside: palms, an umbrella, towels -----
  const beach = (x, z) => [k(x), k(z), P.terrainH(k(x), k(z))];
  towel(B, k(0.45), k(2.3), 0.4, '#f2c62a', beach(0.45, 2.3)[2]); towel(B, k(-0.3), k(2.15), -0.3, '#3ab89a', beach(-0.3, 2.15)[2]);
}

// ----- the hourglass on the stone at the front right (turned over now and then) and the radio by the pool: parts of their own -----
/** The hourglass's frame and glass, standing on its base at the origin (0.5 tall, its neck at 0.25). */
export function buildGlass(B) {
  B.col('#8a6a48').mat(MAT.TIMBER).cyl(0.13, 0.03, 16); B.at(A.t(0, 0.47, 0), () => B.cyl(0.13, 0.03, 16));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; B.at(A.t(Math.cos(a) * 0.11, 0.03, Math.sin(a) * 0.11), () => B.cyl(0.012, 0.44, 8)); }
  B.col('#dceef4').mat(MAT.CLEAR).lathe([[0.0, 0.03], [0.08, 0.035], [0.095, 0.1], [0.07, 0.19], [0.012, 0.25], [0.07, 0.31], [0.095, 0.4], [0.08, 0.465], [0.0, 0.47]], 18);
}
/** The sand left in the top bulb, from the neck (the origin) up; scaled down toward the neck as it runs out. */
export function buildSandTop(B) { B.col('#e8c070').mat(MAT.MATTE).lathe([[0.0, 0.005], [0.012, 0.005], [0.062, 0.06], [0.074, 0.1], [0.0, 0.1]], 16); }
/** The heap in the bottom bulb, from its floor (the origin) up; scaled up from nothing as the sand comes down. */
export function buildSandHeap(B) { B.col('#e8c070').mat(MAT.MATTE).lathe([[0.0, 0.0], [0.078, 0.005], [0.085, 0.055], [0.0, 0.125]], 16); }
