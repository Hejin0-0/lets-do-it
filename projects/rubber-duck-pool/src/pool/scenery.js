// Pool Jelly — the still scenery (part 0), after the user's plan: the back wall and its covered colonnade (bulging
// columns under a straight lintel, a roof over the walk), the left wall pierced with round windows (vines
// hanging from some), the wavy planters with their rims, grass, yellow flowers and palms, the water slide on
// its legs, the round pool's rim, the fountain the ducks come back out of, a radio and an inflatable by the
// pool, a big hourglass on the stone, loungers and towels, the beach's palms and umbrella. The floating toys
// (a flamingo ring, a sprinkled doughnut, a beach ball) are parts of their own.
import { A, MAT } from '@lid/diorama/parts.js';
import { P } from './layout.js';

const T = P.TER, WALL_TOP = T + 0.62, PLASTER = '#e2cbb8', TAU = Math.PI * 2;

/** A striped parasol at (x, z), its canopy r across. */
function parasol(B, x, z, r, cols, y0) {
  B.col('#f4f2ec').mat(MAT.PAINT).at(A.t(x, y0, z), () => B.cyl(0.005, 0.26, 6));
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU;
    B.col(cols[k % 2]).mat(MAT.CLOTH).at(A.t(x, y0 + 0.26, z), () => B.facet([0, 0.06, 0], [Math.cos(a0) * r, 0, Math.sin(a0) * r], [Math.cos(a1) * r, 0, Math.sin(a1) * r]));
  }
}
/** A deck chair at (x, z) turned by yaw: a canvas sling on a wooden frame. */
function deckChair(B, x, z, yaw, col, y0) {
  B.at(A.mul(A.t(x, y0, z), A.ry(yaw)), () => {
    B.col('#9a7a50').mat(MAT.TIMBER);
    for (const s of [-1, 1]) { B.tube([[-0.07, 0, s * 0.035], [0.06, 0.11, s * 0.035]], 0.004, 4); B.tube([[0.07, 0, s * 0.035], [-0.03, 0.06, s * 0.035]], 0.004, 4); }
    B.col(col).mat(MAT.CLOTH).sheet(6, 2, (i, j) => { const t = i / 5; return [-0.06 + t * 0.12, 0.04 + t * 0.07 - 0.02 * Math.sin(Math.PI * t), (j ? 1 : -1) * 0.033]; });
  });
}
function towel(B, x, z, yaw, col, y0) {
  B.at(A.mul(A.t(x, y0 + 0.002, z), A.ry(yaw)), () => {
    B.col(col).mat(MAT.CLOTH).slab(-0.1, 0, -0.05, 0.1, 0.004, 0.05);
    B.col('#f6f4ee'); for (const xx of [-0.07, 0.07]) B.slab(xx - 0.008, 0.004, -0.05, xx + 0.008, 0.005, 0.05);
  });
}
/** A palm at (x, y0, z): a curved trunk, a crown of arched fronds. */
function palm(B, x, z, y0, R, h) {
  const lean = [(R() - 0.5) * 0.18, (R() - 0.5) * 0.18], trunk = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; trunk.push([x + lean[0] * t * t, y0 + h * t, z + lean[1] * t * t]); }
  B.col('#8a6a48').mat(MAT.TIMBER).tube(trunk, trunk.map((_, i) => 0.017 - i * 0.0012), 7);
  const top = trunk[8];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + R() * 0.3, L = 0.18 + 0.05 * R();
    B.col(['#3a8a3a', '#4a9a3e', '#2f7a34'][k % 3]).mat(MAT.LEAF).sheet(7, 3, (i, j) => {
      const t = i / 6, w = (j - 1) * 0.024 * Math.sin(Math.PI * Math.min(1, t * 1.2)), along = t * L;
      return [top[0] + Math.cos(a) * along - Math.sin(a) * w, top[1] + 0.03 * Math.sin(t * 2.2) - 0.09 * t * t, top[2] + Math.sin(a) * along + Math.cos(a) * w];
    });
  }
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

export function buildStill(B, rand) {
  const R = rand;
  // ----- the walls: the back one, the left one with its round windows (rims, vines hanging from two) -----
  B.col(PLASTER).mat(MAT.MATTE).slab(-2.6, P.PORCH, -2.6, 2.6, WALL_TOP + 0.08, -2.5);
  B.col('#f2ece4').mat(MAT.PAINT).slab(-2.6, WALL_TOP + 0.08, -2.62, 2.6, WALL_TOP + 0.1, -2.48);
  const holes = [[-1.65, T + 0.34, 0.15], [-0.9, T + 0.38, 0.07], [-0.3, T + 0.33, 0.12], [0.45, T + 0.22, 0.05], [1.1, T + 0.34, 0.14]];
  B.col(PLASTER).mat(MAT.MATTE);
  wallWithHoles(B, -2.55, -2.5, P.FRONT, T, WALL_TOP + 0.08, 0.1, holes);
  B.col('#f2ece4').mat(MAT.PAINT).slab(-2.62, WALL_TOP + 0.08, -2.5, -2.48, WALL_TOP + 0.1, P.FRONT);
  for (const [z, y, r] of holes) {
    const prof = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * TAU; prof.push([r + 0.008 * Math.cos(a), 0.008 * Math.sin(a)]); }
    for (const s of [-1, 1]) B.col('#f6f2ea').mat(MAT.PAINT).at(A.mul(A.t(-2.55 + s * 0.05, y, z), A.rz(Math.PI / 2)), () => B.lathe(prof, 24));
  }
  for (const [z, y, r] of [holes[0], holes[3]]) {   // vines spilling out of the windows
    for (let k = 0; k < 7; k++) {
      const zz = z + (k / 6 - 0.5) * r * 1.3, len = 0.12 + 0.12 * R(), pts = [];
      for (let i = 0; i <= 6; i++) pts.push([-2.49 + 0.01 * Math.sin(i), y - r * 0.7 - (len * i) / 6, zz + 0.01 * Math.sin(i * 1.7 + k)]);
      B.col(['#4a9a3e', '#5aaa48', '#3a8a3a'][k % 3]).mat(MAT.LEAF).tube(pts, 0.006, 4);
    }
  }
  // ----- the colonnade: bulging columns, a straight lintel, the roof over the walk -----
  const colY = P.PORCH, colH = 0.44, lintel = colY + colH;
  const shaft = [[0.0, 0.0], [0.034, 0.0], [0.034, 0.03], [0.022, 0.04], [0.03, 0.1], [0.036, 0.16], [0.03, 0.24], [0.018, 0.32], [0.02, 0.37], [0.034, 0.4], [0.034, colH], [0, colH]];
  for (let x = -2.24; x < 2.3; x += 0.56) {
    B.col('#f2ece4').mat(MAT.PAINT).at(A.t(x, colY, P.COLS + 0.05), () => B.lathe(shaft, 14));
    B.slab(x - 0.045, colY, P.COLS + 0.005, x + 0.045, colY + 0.03, P.COLS + 0.095);
  }
  B.col('#f2ece4').mat(MAT.PAINT).slab(-2.5, lintel, P.COLS, 2.6, lintel + 0.06, P.COLS + 0.1);
  B.col('#d8bea8').mat(MAT.MATTE).slab(-2.5, lintel + 0.06, -2.5, 2.6, lintel + 0.09, P.COLS + 0.12);   // the roof
  // ----- the planters: low wavy rims, grass, yellow flowers, a palm each -----
  for (const [side, edge] of [[-1, (z) => -1.55 + 0.13 * Math.sin(z * 3.6 + 0.4)], [1, (z) => 1.72 + 0.13 * Math.sin(z * 3.6 + 1.9)]]) {
    const pts = []; for (let i = 0; i <= 24; i++) { const z = -1.9 + (1.95 * i) / 24; pts.push([edge(z), T + 0.05, z]); }
    B.col('#f2ece4').mat(MAT.PAINT).tube(pts, 0.03, 6);
    B.tube([[edge(-1.9), T + 0.05, -1.9], [side * 2.5, T + 0.05, -1.9]], 0.03, 6);
    B.tube([[edge(0.05), T + 0.05, 0.05], [side * 2.5, T + 0.05, 0.05]], 0.03, 6);
    for (let k = 0; k < 40; k++) {
      const z = -1.85 + R() * 1.85, x = side < 0 ? -2.48 + R() * (edge(z) + 2.48 - 0.04) : edge(z) + 0.04 + R() * (2.5 - edge(z) - 0.04);
      if (k % 3 === 0) B.col('#f2c62a').mat(MAT.GLOSS).at(A.t(x, T + 0.11, z), () => B.ball(0.02, 0.018, 0.02, 1));
      else B.col(['#5aaa48', '#4a9a3e'][k % 2]).mat(MAT.GRASS).at(A.mul(A.t(x, T + 0.08, z), A.ry(R() * 6)), () => { for (let q = 0; q < 4; q++) B.at(A.ry(q * 1.6), () => B.quad([-0.004, 0, 0], [0.004, 0, 0], [0.002, 0.05 + 0.03 * R(), 0.006], [-0.002, 0.05 + 0.03 * R(), 0.006])); });
    }
    palm(B, side * 2.15, -1.1, T + 0.08, R, 0.42);
    palm(B, side * 2.25, -0.2, T + 0.08, R, 0.34);
  }
  // ----- the fountain at the pool's head: a pedestal, a shell bowl, a spout -----
  const [sx, sy, sz] = P.SPOUT;
  B.col('#f2ece4').mat(MAT.PAINT).at(A.t(sx, T, sz - 0.03), () => { B.cyl(0.07, 0.03, 16, 0.065); B.cyl(0.03, sy - T - 0.03, 12, 0.022); });
  B.at(A.t(sx, sy - 0.04, sz - 0.03), () => B.lathe([[0.01, -0.02], [0.05, -0.012], [0.075, 0.01], [0.07, 0.016], [0.04, 0.0], [0.0, 0.0]], 16));
  B.col('#c8a44a').mat(MAT.METAL).at(A.mul(A.t(sx, sy, sz - 0.01), A.rx(Math.PI / 2 - 0.5)), () => B.cyl(0.012, 0.06, 10, 0.008));
  // ----- the slide: a blue half-pipe on legs, from the notch down onto the round pool; a rim round the round pool -----
  const S = P.slide, N = 40, sec = (q) => { const p = S.at(q), p2 = S.at(Math.min(S.len, q + 0.02)), p1 = S.at(Math.max(0, q - 0.02)), tx = p2[0] - p1[0], tz = p2[2] - p1[2], l = Math.hypot(tx, tz) || 1; return { p, n: [-tz / l, tx / l] }; };
  for (const [col, r, off] of [['#4ab0e8', 0.06, 0], ['#bfe8f8', 0.05, 0.004]]) {
    B.col(col).mat(off ? MAT.GLASS : MAT.GLOSS).sheet(N + 1, 9, (i, j) => {
      const { p, n } = sec((S.len * i) / N), a = Math.PI * (j / 8);
      return [p[0] + n[0] * Math.cos(a) * r, p[1] - Math.sin(a) * r * 0.8 + off, p[2] + n[1] * Math.cos(a) * r];
    });
  }
  for (const q of [0.35, 0.65, 0.95]) {
    const p = S.at(q);
    B.col('#f2ece4').mat(MAT.PAINT).slab(p[0] - 0.012, P.LAWN, p[2] - 0.012, p[0] + 0.012, p[1] - 0.04, p[2] + 0.012);
  }
  // ----- the tube back up: clear, ringed in blue, out of the lawn by the round pool, over the step and the big pool's rim, on legs -----
  const Tb = P.tube, TR = P.TUBE_R, step = 0.025;
  let q0 = 0; while (q0 < Tb.len && Tb.at(q0)[1] + TR < P.terrainH(...[Tb.at(q0)[0], Tb.at(q0)[2]]) - 0.02) q0 += step;   // from just under the lawn
  const tubePts = []; for (let q = q0; q < Tb.len + step / 2; q += step) tubePts.push(Tb.at(Math.min(q, Tb.len)));
  B.col('#dceef4').mat(MAT.CLEAR).tube(tubePts, TR, 20);
  const ringAt = (q, r) => {   // a hoop round the tube at q
    const p = Tb.at(q), a2 = Tb.at(q - 0.02), b2 = Tb.at(q + 0.02), t = [b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]], tl = Math.hypot(...t);
    const T = t.map((v) => v / tl), up = Math.abs(T[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [T[1] * up[2] - T[2] * up[1], T[2] * up[0] - T[0] * up[2], T[0] * up[1] - T[1] * up[0]]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
    const w = [T[1] * u[2] - T[2] * u[1], T[2] * u[0] - T[0] * u[2], T[0] * u[1] - T[1] * u[0]];
    B.tube(Array.from({ length: 25 }, (_, i) => { const th = (i / 24) * TAU; return [0, 1, 2].map((k) => p[k] + (u[k] * Math.cos(th) + w[k] * Math.sin(th)) * r); }), 0.008, 5);
  };
  B.col('#4ab0e8').mat(MAT.GLOSS);
  for (let q = q0 + 0.08; q < Tb.len - 0.06; q += 0.13) ringAt(q, TR + 0.004);
  ringAt(q0 + 0.03, TR + 0.02); ringAt(Tb.len - 0.01, TR + 0.016);   // a collar where it comes out of the lawn, a lip at its mouth
  for (const q of [q0 + 0.55, q0 + 0.95, Tb.len - 0.3]) {   // legs down to the ground where it runs high
    const p = Tb.at(q), g = P.terrainH(p[0], p[2]);
    if (p[1] - TR - g > 0.03) B.col('#f2ece4').mat(MAT.PAINT).slab(p[0] - 0.01, g, p[2] - 0.01, p[0] + 0.01, p[1] - TR, p[2] + 0.01);
  }
  const rim = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU; rim.push([P.ROUND[0] + Math.cos(a) * (P.ROUND[2] + 0.03), P.LAWN + 0.02, P.ROUND[1] + Math.sin(a) * (P.ROUND[2] + 0.03)]); }
  B.col('#f6f2ea').mat(MAT.PAINT).tube(rim, 0.03, 8);
  // ----- by the pool: an inflatable lying on the stone (the radio is a part of its own: scene.js); a ladder into the deep end -----
  B.at(A.t(P.FLOAT_AT[0], T + 0.03, P.FLOAT_AT[1]), () => {
    for (let q = 0; q < 8; q++) B.col(q % 2 ? '#f6f4ee' : '#2a8ad8').mat(MAT.GLOSS).sheet(5, 9, (i, j) => { const a = ((q + i / 4) / 8) * TAU, b = (j / 8) * TAU; return [Math.cos(a) * (0.11 + Math.cos(b) * 0.03), Math.sin(b) * 0.028, Math.sin(a) * (0.11 + Math.cos(b) * 0.03)]; });
  });
  B.col('#c8d0d8').mat(MAT.METAL);
  for (const s of [-1, 1]) B.tube([[P.MAIN[2] + 0.06, T, -0.6 + s * 0.04], [P.MAIN[2] + 0.06, T + 0.1, -0.6 + s * 0.04], [P.MAIN[2] - 0.03, T + 0.1, -0.6 + s * 0.04], [P.MAIN[2] - 0.03, P.LU - 0.2, -0.6 + s * 0.04]], 0.004, 6);
  // ----- loungers, chairs, towels -----
  deckChair(B, 1.35, -0.25, 2.4, '#f2c62a', T); deckChair(B, 1.32, 0.95, 2.9, '#e8405a', T);
  towel(B, -1.6, 0.75, 0.3, '#2a8ad8', P.LAWN); towel(B, -1.2, 1.5, -0.2, '#e8405a', P.LAWN);
  deckChair(B, -2.05, 1.2, 0.4, '#3ab89a', P.LAWN);
  parasol(B, -1.85, 0.95, 0.18, ['#f2c62a', '#f6f4ee'], P.LAWN);
  // ----- the beach outside: palms, an umbrella, towels -----
  for (const [x, z] of [[-1.95, 2.15], [-1.7, 2.35], [-1.45, 2.1], [1.3, 2.25], [2.25, 2.0]]) palm(B, x, z, P.terrainH(x, z), R, 0.38 + 0.12 * R());
  parasol(B, 0.2, 2.2, 0.2, ['#e8405a', '#f6f4ee'], P.terrainH(0.2, 2.2));
  towel(B, 0.45, 2.3, 0.4, '#f2c62a', P.terrainH(0.45, 2.3)); towel(B, -0.3, 2.15, -0.3, '#3ab89a', P.terrainH(-0.3, 2.15));
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
/** The red radio, its base at the origin. */
export function buildRadio(B) {
  B.col('#d83a3a').mat(MAT.GLOSS).slab(-0.06, 0, -0.022, 0.06, 0.055, 0.022);
  B.col('#222226').mat(MAT.MATTE); for (const x of [-0.033, 0.033]) B.at(A.mul(A.t(x, 0.027, 0.0222), A.rx(Math.PI / 2)), () => B.cyl(0.019, 0.002, 14));
  B.col('#c8d0d8').mat(MAT.METAL).tube([[-0.045, 0.055, 0], [-0.04, 0.08, 0], [0.04, 0.08, 0], [0.045, 0.055, 0]], 0.003, 5);
}

/** A floating toy (centred, flat in xz): a pink flamingo ring, a sprinkled doughnut with a little palm, a beach ball. */
export function buildToy(B, kind) {
  if (kind === 'ball') {
    for (let q = 0; q < 6; q++) B.col(['#e8405a', '#f6f4ee', '#2a8ad8', '#f6f4ee', '#f2c62a', '#f6f4ee'][q]).mat(MAT.GLOSS).sheet(9, 5, (i, j) => { const th = (i / 8) * Math.PI, ph = ((q + j / 4) / 6) * TAU; return [Math.sin(th) * Math.cos(ph) * 0.055, Math.cos(th) * 0.055, Math.sin(th) * Math.sin(ph) * 0.055]; });
    return;
  }
  const flam = kind === 'flamingo', Rr = flam ? 0.07 : 0.065, r = flam ? 0.026 : 0.028;
  B.col(flam ? '#f48aaa' : '#f2c62a').mat(MAT.GLOSS).sheet(25, 9, (i, j) => { const a = (i / 24) * TAU, b = (j / 8) * TAU; return [Math.cos(a) * (Rr + Math.cos(b) * r), Math.sin(b) * r, Math.sin(a) * (Rr + Math.cos(b) * r)]; });
  if (flam) {   // the neck and head
    B.col('#f48aaa').mat(MAT.GLOSS).tube([[Rr, 0.01, 0], [Rr + 0.01, 0.06, 0], [Rr - 0.005, 0.1, 0], [Rr + 0.015, 0.11, 0]], [0.012, 0.01, 0.009, 0.011], 8);
    B.col('#f6f4ee').at(A.t(Rr + 0.03, 0.105, 0), () => B.ball(0.012, 0.006, 0.006, 0));
    B.col('#1a1a1a').at(A.t(Rr + 0.041, 0.1, 0), () => B.ball(0.004, 0.004, 0.004, 0));
  } else {   // pink icing, sprinkles, a tiny palm
    B.col('#f48aaa').mat(MAT.GLOSS).sheet(25, 5, (i, j) => { const a = (i / 24) * TAU, b = (j / 4) * Math.PI; return [Math.cos(a) * (Rr + Math.cos(b) * r * 1.02), Math.sin(b) * r * 1.02 + 0.001, Math.sin(a) * (Rr + Math.cos(b) * r * 1.02)]; });
    for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; B.col(['#2a8ad8', '#3ab89a', '#f6f4ee'][k % 3]).at(A.mul(A.t(Math.cos(a) * Rr, r + 0.002, Math.sin(a) * Rr), A.ry(a * 3)), () => B.slab(-0.004, 0, -0.001, 0.004, 0.002, 0.001)); }
    B.col('#8a6a48').mat(MAT.TIMBER).tube([[Rr, r, 0], [Rr + 0.01, r + 0.06, 0]], 0.004, 5);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; B.col('#3a8a3a').mat(MAT.LEAF).quad([Rr + 0.01, r + 0.06, 0], [Rr + 0.01 + Math.cos(a) * 0.035, r + 0.045, Math.sin(a) * 0.035 + 0.005], [Rr + 0.01 + Math.cos(a) * 0.04, r + 0.04, Math.sin(a) * 0.04], [Rr + 0.01 + Math.cos(a) * 0.035, r + 0.045, Math.sin(a) * 0.035 - 0.005]); }
  }
}
