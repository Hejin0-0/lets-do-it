// Harbor Jelly — the still scenery (part 0): the quay's fenders, bollards, ladders and crane rails; the terminal's
// light towers, office and stacks; the fishing quay's corrugated fish-market shed, lamp posts and timber pier on
// mussel-covered piles; the town climbing the hill (three rows of gabled houses in harbour colours, a white
// church with a green copper spire, round trees); the breakwater's crown wall and rocks and its lighthouse; the
// floor's weed, stones, starfish, an old anchor with its chain and a lost tyre. It also notes the gulls' perches
// and the solid boxes things thrown about bounce off.
import { A, MAT, ICO } from '@lid/diorama/parts.js';
import { H } from './layout.js';
import { buildStacks } from './boxes.js';

const HOUSE_COLS = ['#9e3a2c', '#d39a3a', '#f0ece2', '#9cb8cc', '#a8d4bc', '#e8b4b8', '#8e3128', '#e2c070'];
const ROOF_COLS = ['#5a3a34', '#3e4246', '#6a3428', '#45484c'];
/** Where the lighthouse's lamp turns. */
export const LAMP_AT = [H.LIGHT[0], H.CREST + 0.02 + 0.33 + 0.026, H.LIGHT[1]];
/** The gulls' still perches (more ride on the ship, the tug, the cranes and the yachts). */
export const PERCHES = [];

/** A faceted rock, about s across. */
function rock(B, s, R, flat = 0.7) {
  const S = ICO[1], k = S.P.map(() => 0.75 + 0.5 * R());
  const P = S.P.map((p, i) => [p[0] * s * k[i], p[1] * s * k[i] * flat, p[2] * s * k[i]]);
  for (const [a, b, c] of S.F) B.facet(P[a], P[b], P[c]);
}
/** A gabled roof over a w (x) × d (z) footprint, its ridge along z, eaves at y = 0, rise rh; with its gable ends. */
function gable(B, w, d, rh, wall, col) {
  B.col(wall).mat(MAT.PAINT).prism([[-w / 2, 0], [w / 2, 0], [0, rh]], d);
  const a = Math.atan2(rh, w / 2), l = Math.hypot(rh, w / 2) + 0.012;
  B.col(col).mat(MAT.BRICK);
  for (const s of [-1, 1]) B.at(A.mul(A.t((s * w) / 4, rh / 2 + 0.002, 0), A.rz(-s * a)), () => B.box(l, 0.006, d + 0.022));
}
/** A house standing on the hill at (x, z), its gable or its long side to the harbour: returns its solid box. */
function house(B, x, z, R) {
  const w = 0.13 + 0.05 * R(), d = 0.11 + 0.03 * R(), h = 0.075 + 0.045 * R(), rh = 0.05 + 0.025 * R(), gableFront = R() < 0.6;
  const fw = gableFront ? w : d, fd = gableFront ? d : w;   // the footprint along x and z
  const y0 = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => H.terrainH(x + (a * fw) / 2, z + (b * fd) / 2))) - 0.004;
  const col = HOUSE_COLS[Math.floor(R() * HOUSE_COLS.length)], rc = ROOF_COLS[Math.floor(R() * ROOF_COLS.length)];
  B.at(A.mul(A.t(x, y0, z), A.ry(gableFront ? 0 : Math.PI / 2)), () => {   // built gable to +z; turned, its long side
    B.col(col).mat(MAT.PAINT).slab(-w / 2, 0, -d / 2, w / 2, h, d / 2);
    B.at(A.t(0, h, 0), () => gable(B, w, d, rh, col, rc));
    B.col('#6a5a52').mat(MAT.PAINT).slab(w * 0.18, h + rh * 0.35, -0.01, w * 0.18 + 0.018, h + rh + 0.02, 0.008);   // the chimney
    // windows with white frames all round, a door on the side that faces the harbour
    const win = (u, v, face) => {   // face: 'z+', 'z-', 'x+', 'x-'
      const [ax, sgn] = [face[0], face[1] === '+' ? 1 : -1];
      B.col('#f6f4ee').mat(MAT.PAINT); if (ax === 'z') B.slab(u - 0.011, v - 0.012, sgn * d / 2 - 0.0015, u + 0.011, v + 0.012, sgn * d / 2 + 0.0015); else B.slab(sgn * w / 2 - 0.0015, v - 0.012, u - 0.011, sgn * w / 2 + 0.0015, v + 0.012, u + 0.011);
      B.col('#22303a').mat(MAT.GLASS); if (ax === 'z') B.slab(u - 0.008, v - 0.009, sgn * d / 2 - 0.002, u + 0.008, v + 0.009, sgn * d / 2 + 0.002); else B.slab(sgn * w / 2 - 0.002, v - 0.009, u - 0.008, sgn * w / 2 + 0.002, v + 0.009, u + 0.008);
    };
    const nz = Math.max(2, Math.floor(w / 0.045)), nx = Math.max(2, Math.floor(d / 0.045));
    for (const fy of [0.3, 0.7]) {
      for (let i = 0; i < nz; i++) for (const f of ['z+', 'z-']) if (!(f === 'z+' && gableFront && fy < 0.5 && i === Math.floor(nz / 2))) win(-w / 2 + ((i + 0.5) * w) / nz, h * fy, f);
      for (let i = 0; i < nx; i++) for (const f of ['x+', 'x-']) if (!(f === 'x-' && !gableFront && fy < 0.5 && i === Math.floor(nx / 2))) win(-d / 2 + ((i + 0.5) * d) / nx, h * fy, f);
    }
    B.col('#3a3a44').mat(MAT.PAINT);
    if (gableFront) B.slab(-0.01, 0, d / 2 - 0.0015, 0.01, Math.min(h * 0.55, 0.045), d / 2 + 0.002);
    else B.slab(-w / 2 - 0.002, 0, -0.01, -w / 2 + 0.0015, Math.min(h * 0.55, 0.045), 0.01);
  });
  PERCHES.push([x, y0 + h + rh + 0.008, z]);
  return [x - fw / 2, y0, z - fd / 2, x + fw / 2, y0 + h + rh, z + fd / 2];
}

export function buildStill(B, rand) {
  const R = rand, BOXES = H.BOXES;
  PERCHES.length = 0; BOXES.length = 1;   // the pier's box stays; the rest are made here
  // ----- the quay: crane rails, bollards, fenders, ladders -----
  B.col('#5a5c60').mat(MAT.METAL);
  for (const z of [H.RS, H.RL]) B.slab(-2.56, H.DECK, z - 0.003, 0.42, H.DECK + 0.004, z + 0.003);
  for (let x = -2.45; x < 2.5; x += 0.28) {
    if (Math.abs(x - H.PIER.x) < 0.12) continue;
    B.col('#2a2a2c').mat(MAT.METAL).at(A.t(x, H.DECK, H.QZ - 0.022), () => { B.cyl(0.008, 0.016, 8, 0.007); B.at(A.t(0, 0.016, 0), () => B.cyl(0.011, 0.004, 8)); });
  }
  for (let x = -2.4; x < H.XT - 0.05; x += 0.2) B.col('#1c1c1e').mat(MAT.MATTE).at(A.t(x, H.SL - 0.08, H.QZ + 0.012), () => B.cyl(0.012, H.DECK - H.SL + 0.065, 10));
  for (let x = H.XT + 0.15; x < 2.5; x += 0.24) if (Math.abs(x - H.PIER.x) > 0.12) B.col('#6a5238').mat(MAT.TIMBER).slab(x - 0.012, H.SL - 0.06, H.QZ, x + 0.012, H.DECK - 0.01, H.QZ + 0.012);
  for (const x of [-2.1, -0.95, 0.25, 1.05, 2.3]) {
    B.col('#8a8e92').mat(MAT.METAL);
    for (const s of [-1, 1]) B.slab(x + s * 0.014 - 0.002, H.SL - 0.14, H.QZ + 0.002, x + s * 0.014 + 0.002, H.DECK + 0.02, H.QZ + 0.006);
    for (let y = H.SL - 0.12; y < H.DECK; y += 0.022) B.slab(x - 0.014, y, H.QZ + 0.002, x + 0.014, y + 0.003, H.QZ + 0.006);
  }
  // ----- the terminal: light towers, the office, the stacks -----
  for (const [x, z] of [[-2.52, -1.62], [-1.0, -1.62], [0.4, -1.62]]) {
    B.col('#9a9ea2').mat(MAT.METAL).at(A.t(x, H.DECK, z), () => B.cyl(0.006, 0.55, 8, 0.004));
    B.slab(x - 0.03, H.DECK + 0.55, z - 0.008, x + 0.03, H.DECK + 0.565, z + 0.008);
    B.col('#fff4d8').mat(MAT.GLOW).slab(x - 0.028, H.DECK + 0.545, z + 0.002, x + 0.028, H.DECK + 0.553, z + 0.01);
    PERCHES.push([x, H.DECK + 0.575, z]);
  }
  B.col('#e8e6e0').mat(MAT.PAINT).slab(0.25, H.DECK, -1.35, 0.42, H.DECK + 0.09, -1.22);
  B.col('#2e62b5').slab(0.249, H.DECK + 0.075, -1.351, 0.421, H.DECK + 0.084, -1.219);
  B.col('#22303a').mat(MAT.GLASS);
  for (const y of [0.02, 0.05]) B.slab(0.26, H.DECK + y, -1.2215, 0.41, H.DECK + y + 0.016, -1.2195);
  BOXES.push([0.25, H.DECK, -1.35, 0.42, H.DECK + 0.09, -1.22]);
  BOXES.push(...buildStacks(B, R));
  // ----- the fishing quay: the corrugated shed, crates and barrels, lamps -----
  B.at(A.t(1.02, H.DECK, -1.27), () => {
    B.col('#7a9a8a').mat(MAT.RIBS).slab(-0.3, 0, -0.15, 0.3, 0.1, 0.15);
    B.at(A.mul(A.t(0, 0.1, 0), A.ry(Math.PI / 2)), () => gable(B, 0.3, 0.6, 0.07, '#7a9a8a', '#5a6a68'));
    B.col('#3a4a48').mat(MAT.PAINT);
    for (const x of [-0.18, 0.05]) B.slab(x - 0.05, 0, 0.1495, x + 0.05, 0.08, 0.152);
  });
  BOXES.push([0.72, H.DECK, -1.42, 1.32, H.DECK + 0.17, -1.12]);
  for (let i = 0; i < 7; i++) B.col(['#2f5aa6', '#d4702a', '#e6e1d6'][i % 3]).mat(MAT.PAINT).slab(1.38 + (i % 3) * 0.032, H.DECK + Math.floor(i / 3) * 0.02, -1.08, 1.408 + (i % 3) * 0.032, H.DECK + 0.019 + Math.floor(i / 3) * 0.02, -1.05);
  for (const [x, z] of [[1.46, -1.12], [1.5, -1.1]]) B.col('#6a4a2e').mat(MAT.TIMBER).at(A.t(x, H.DECK, z), () => B.cyl(0.014, 0.034, 10));
  for (const x of [0.62, 1.1, 2.06, 2.46]) {
    B.col('#2a2c30').mat(MAT.METAL).at(A.t(x, H.DECK, H.QZ - 0.08), () => B.cyl(0.0035, 0.14, 6));
    B.col('#fff1c8').mat(MAT.GLOW).at(A.t(x, H.DECK + 0.145, H.QZ - 0.08), () => B.ball(0.009, 0.011, 0.009, 1));
    B.col('#2a2c30').mat(MAT.METAL).at(A.t(x, H.DECK + 0.155, H.QZ - 0.08), () => B.cyl(0.011, 0.005, 8, 0.002));
    PERCHES.push([x, H.DECK + 0.165, H.QZ - 0.08]);
  }
  // ----- the timber pier: deck, stringers, piles crusted with mussels, cross-bracing, bollards -----
  const Pr = H.PIER, px0 = Pr.x - Pr.w / 2, px1 = Pr.x + Pr.w / 2;
  B.col('#8a6a4a').mat(MAT.TIMBER).slab(px0, Pr.deck - 0.012, Pr.z0, px1, Pr.deck, Pr.z1);
  for (const x of [px0 + 0.012, Pr.x, px1 - 0.012]) B.col('#5e4630').slab(x - 0.006, Pr.deck - 0.028, Pr.z0, x + 0.006, Pr.deck - 0.012, Pr.z1);
  const piles = [];
  for (let z = Pr.z0 + 0.06; z < Pr.z1; z += 0.125) for (const x of [px0 + 0.01, px1 - 0.01]) piles.push([x, z]);
  for (const [x, z] of piles) {
    const b = H.terrainH(x, z) - 0.01;
    B.col('#5a4630').mat(MAT.TIMBER).at(A.t(x, b, z), () => B.cyl(0.009, Pr.deck - 0.012 - b, 8));
    B.col('#24262e').mat(MAT.MATTE).at(A.t(x, b, z), () => B.cyl(0.0115, H.SL + 0.012 - b, 8, 0.0105));   // mussels and weed below the tide line
  }
  B.col('#4e3c2a').mat(MAT.TIMBER);
  for (let i = 0; i + 2 < piles.length; i += 2) for (const s of [0, 1]) B.tube([[piles[i + s][0], H.SL + 0.03, piles[i + s][1]], [piles[i + 2 + s][0], Pr.deck - 0.03, piles[i + 2 + s][1]]], 0.0035, 5);
  for (let i = 0; i < piles.length; i += 2) B.tube([[piles[i][0], H.SL + 0.025, piles[i][1]], [piles[i + 1][0], Pr.deck - 0.03, piles[i + 1][1]]], 0.0035, 5);
  for (const z of [Pr.z0 + 0.2, Pr.z0 + 0.45, Pr.z1 - 0.04]) for (const x of [px0 + 0.01, px1 - 0.01]) B.col('#2a2a2c').mat(MAT.METAL).at(A.t(x, Pr.deck, z), () => B.cyl(0.006, 0.014, 8, 0.005));
  // ----- the town on the hill, the church, the trees -----
  const rows = [-1.9, -2.14, -2.39], church = [0.62, -2.15];
  for (const [r, z] of rows.entries()) {
    for (let x = -2.42 + (r % 2) * 0.14; x < 2.45; x += 0.27 + 0.06 * R()) {
      if (r === 1 && Math.abs(x - church[0]) < 0.3) continue;
      BOXES.push(house(B, x + (R() - 0.5) * 0.04, z + (R() - 0.5) * 0.05, R));
    }
  }
  const cy = Math.min(H.terrainH(church[0] - 0.2, church[1] + 0.08), H.terrainH(church[0] + 0.16, church[1] + 0.08)) - 0.004;
  B.at(A.t(church[0], cy, church[1]), () => {
    B.col('#f4f2ec').mat(MAT.PAINT).slab(-0.12, 0, -0.07, 0.16, 0.12, 0.07);
    B.at(A.mul(A.t(0.02, 0.12, 0), A.ry(Math.PI / 2)), () => gable(B, 0.14, 0.28, 0.08, '#f4f2ec', '#4a4a50'));
    B.col('#f4f2ec').mat(MAT.PAINT).slab(-0.2, 0, -0.04, -0.12, 0.27, 0.04);
    B.col('#22303a').mat(MAT.GLASS);
    for (const x of [-0.07, 0.0, 0.07]) B.slab(x - 0.01, 0.04, 0.0695, x + 0.01, 0.09, 0.0715);
    B.col('#2a2a30').slab(-0.17, 0.2, 0.0395, -0.15, 0.24, 0.0415);
    B.col('#5aa88a').mat(MAT.PAINT).at(A.mul(A.t(-0.16, 0.27, 0), A.ry(Math.PI / 4)), () => B.cyl(0.055, 0.2, 4, 0));   // the copper spire
    B.col('#c8a44a').mat(MAT.METAL).at(A.t(-0.16, 0.47, 0), () => B.cyl(0.002, 0.025, 4));
  });
  PERCHES.push([church[0] - 0.16, cy + 0.5, church[1]]);
  BOXES.push([church[0] - 0.2, cy, church[1] - 0.07, church[0] + 0.16, cy + 0.47, church[1] + 0.07]);
  let trees = 0;
  for (let t = 0; t < 400 && trees < 34; t++) {
    const x = -2.5 + R() * 5.0, z = -2.5 + R() * 0.75;
    if (BOXES.some((b) => x > b[0] - 0.05 && x < b[3] + 0.05 && z > b[2] - 0.05 && z < b[5] + 0.05)) continue;
    const y = H.terrainH(x, z) - 0.004, s = 0.03 + 0.025 * R();
    B.col('#5a4434').mat(MAT.MATTE).at(A.t(x, y, z), () => B.cyl(0.005, s * 1.4, 6));
    B.col(['#3e6a34', '#4a7a3a', '#365e30'][trees % 3]).mat(MAT.LEAF).at(A.t(x, y + s * 1.9, z), () => B.ball(s, s * 0.95, s, 1));
    trees++;
  }
  // ----- the breakwater: a crown wall on its seaward edge, rocks along the crest and down its flanks -----
  const [b0, b1] = H.BREAK, len = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]), dx = (b1[0] - b0[0]) / len, dz = (b1[1] - b0[1]) / len;
  const NW = 14, seg = len / NW, sea = [dz, -dx].map((v) => v * (dx < 0 ? 1 : -1));   // across it, toward the open sea (+z)
  for (let i = 0; i < NW; i++) {
    const m = [b0[0] + dx * seg * (i + 0.5) + sea[0] * 0.035, b0[1] + dz * seg * (i + 0.5) + sea[1] * 0.035];
    B.col('#b8b6ae').mat(MAT.MATTE).at(A.mul(A.t(m[0], H.CREST, m[1]), A.ry(Math.atan2(-dz, dx))), () => B.slab(-seg / 2 + 0.002, 0, -0.012, seg / 2 - 0.002, 0.045, 0.012));
  }
  for (let i = 0; i < 70; i++) {
    const u = R() * len, side = R() < 0.5 ? -1 : 1, under = i >= 34, off = under ? 0.2 + R() * 0.2 : 0.08 + R() * 0.07;
    const x = b0[0] + dx * u + sea[0] * side * off, z = b0[1] + dz * u + sea[1] * side * off;
    if (Math.abs(x) > 2.55) continue;
    const y = H.terrainH(x, z), s = under ? 0.018 + 0.015 * R() : 0.028 + 0.025 * R();
    B.col(['#8a8682', '#6e6a66', '#9a958e'][i % 3]).mat(MAT.MATTE).at(A.mul(A.t(x, y + s * 0.3, z), A.ry(R() * 6.28)), () => rock(B, s, R));
    if (under) B.col('#4a6a34').mat(MAT.LEAF).at(A.t(x, y + s * 0.6, z), () => { for (let k = 0; k < 3; k++) B.at(A.ry(k * 2.1 + R()), () => B.quad([-0.004, 0, 0], [0.004, 0, 0], [0.002, 0.035, 0.004], [-0.002, 0.035, 0.004])); });
  }
  // ----- the lighthouse on the head: banded tower, gallery, lantern, red cap (its lamp turns, a part of its own) -----
  B.at(A.t(H.LIGHT[0], H.CREST, H.LIGHT[1]), () => {
    B.col('#c8c6be').mat(MAT.MATTE).cyl(0.065, 0.02, 16);
    for (let k = 0; k < 6; k++) { const r0 = 0.046 - k * 0.0018, r1 = r0 - 0.0018; B.col(k % 2 ? '#f4f2ec' : '#c42e26').mat(MAT.PAINT).at(A.t(0, 0.02 + k * 0.055, 0), () => B.cyl(r0, 0.055, 16, r1, false)); }
    const top = 0.02 + 0.33;
    B.col('#2a2a2c').mat(MAT.METAL).at(A.t(0, top, 0), () => B.cyl(0.058, 0.006, 16));
    const ring = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * 6.2832; ring.push([Math.cos(a) * 0.055, top + 0.022, Math.sin(a) * 0.055]); }
    B.tube(ring, 0.0016, 4);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832; B.slab(Math.cos(a) * 0.055 - 0.001, top, Math.sin(a) * 0.055 - 0.001, Math.cos(a) * 0.055 + 0.001, top + 0.022, Math.sin(a) * 0.055 + 0.001); }
    B.col('#cfe4ea').mat(MAT.GLASS).at(A.t(0, top + 0.006, 0), () => B.cyl(0.03, 0.045, 12, 0.03, false));
    B.col('#c42e26').mat(MAT.PAINT).at(A.t(0, top + 0.05, 0), () => B.cyl(0.034, 0.03, 12, 0.004));
  });
  PERCHES.push([H.LIGHT[0] + 0.05, H.CREST + 0.38, H.LIGHT[1]]);
  // ----- the floor: weed, stones, starfish, an anchor with its chain, a tyre -----
  const wet = (x, z, d = 0.1) => H.SL - H.terrainH(x, z) > d && H.breakDist(x, z) > 0.45;
  for (let i = 0; i < 70; i++) {
    const x = -2.45 + R() * 4.9, z = H.QZ + 0.1 + R() * (2.45 - H.QZ);
    if (!wet(x, z)) continue;
    const y = H.terrainH(x, z) - 0.003;
    if (i % 3) B.col(['#3e6a30', '#5a7a2e', '#2e5a3a'][i % 3]).mat(MAT.LEAF).at(A.mul(A.t(x, y, z), A.ry(R() * 6.3)), () => { for (let k = 0; k < 5; k++) B.at(A.ry(k * 1.26), () => B.quad([-0.003, 0, 0], [0.003, 0, 0], [0.0015, 0.04 + 0.03 * R(), 0.01], [-0.0015, 0.04 + 0.03 * R(), 0.01])); });
    else B.col('#8a8580').mat(MAT.MATTE).at(A.t(x, y + 0.004, z), () => rock(B, 0.012 + 0.012 * R(), R, 0.55));
  }
  for (let i = 0; i < 9; i++) {
    const x = -2.3 + R() * 4.4, z = H.QZ + 0.15 + R() * 2.2;
    if (!wet(x, z)) continue;
    const star = []; for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.2832, r = k % 2 ? 0.006 : 0.016; star.push([Math.cos(a) * r, Math.sin(a) * r]); }
    B.col(['#d4642a', '#c43a5a', '#e08a2a'][i % 3]).mat(MAT.MATTE).at(A.mul(A.t(x, H.terrainH(x, z) + 0.002, z), A.rx(Math.PI / 2), A.rz(R() * 6.3)), () => B.prism(star, 0.004));
  }
  B.at(A.mul(A.t(-1.55, H.terrainH(-1.55, 1.55) + 0.006, 1.55), A.ry(0.6)), () => {   // the anchor lying on its side, its chain trailing
    B.col('#4a3a32').mat(MAT.METAL).at(A.rz(Math.PI / 2), () => B.at(A.t(0, -0.06, 0), () => B.cyl(0.0045, 0.12, 6)));
    const arm = []; for (let i = 0; i <= 8; i++) { const a = -1.1 + (i / 8) * 2.2; arm.push([-0.09 + Math.cos(a) * 0.03, 0, Math.sin(a) * 0.045]); }
    B.tube(arm, 0.0045, 6);
    B.slab(0.055, -0.003, -0.04, 0.061, 0.003, 0.04);
    const chain = []; for (let i = 0; i <= 30; i++) chain.push([0.065 + i * 0.012, 0.002 * Math.sin(i * 1.7), 0.03 * Math.sin(i * 0.35)]);
    B.col('#6a4a34').tube(chain, 0.0028, 5);
  });
  B.col('#1e1e20').mat(MAT.MATTE).at(A.t(0.55, H.terrainH(0.55, 1.75) + 0.008, 1.75), () => {   // the lost tyre
    const prof = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * 6.2832; prof.push([0.026 + Math.cos(a) * 0.01, Math.sin(a) * 0.008]); }
    B.lathe(prof, 16);
  });
  return { perches: PERCHES, boxes: BOXES };
}
