// Lock Jelly — the country round the lock: the keeper's whitewashed cottage (slate roof, green door, a
// picket-fenced garden full of flowers, washing flapping on a line), a white tower windmill with turning
// lattice sails on its knoll, oaks, willows, poplars, a hedge, reeds on the soft banks, lily pads in the
// basin's corners, a bicycle on the bed and the humpback brick bridge. The sails and the washing are parts.
import { A, MAT } from '@lid/diorama/parts.js';
import { L } from './layout.js';

const H = L.terrainH;
export const COTTAGE = { x: -0.85, z: 0.12, w: 0.46, d: 0.3, wall: 0.2 };
export const COTTAGE_CHIMNEY = [COTTAGE.x - COTTAGE.w / 2 + 0.07, L.TU + COTTAGE.wall + 0.25, COTTAGE.z];
export const MILL = { x: -1.95, z: -1.6, h: 0.5, face: Math.atan2(0.45, 0.89) };
const GARDEN = [-1.45, -0.2, -0.3, 0.86];

function cottage(B) {
  const { x, z, w, d, wall } = COTTAGE, y = L.TU;
  B.at(A.t(x, y, z), () => {
    B.col('#f2efe6').mat(MAT.MATTE).slab(-w / 2, 0, -d / 2, w / 2, wall, d / 2);
    B.col('#2a2a2a').slab(-w / 2 - 0.004, -0.01, -d / 2 - 0.004, w / 2 + 0.004, 0.018, d / 2 + 0.004);   // a tarred plinth
    // the slate roof, a gable along x
    B.col('#4b5562').at(A.ry(Math.PI / 2), () => B.prism([[-d / 2 - 0.035, wall - 0.005], [d / 2 + 0.035, wall - 0.005], [0, wall + 0.17]], w + 0.05));
    B.col('#3a434e').slab(-w / 2 - 0.028, wall + 0.162, -0.012, w / 2 + 0.028, wall + 0.18, 0.012);   // ridge tiles
    // the chimney stack, brick, with pots
    B.col('#9a5038').mat(MAT.BRICK).slab(-w / 2 + 0.035, wall - 0.02, -0.035, -w / 2 + 0.105, wall + 0.24, 0.035);
    B.col('#b5582e').mat(MAT.MATTE);
    for (const dz of [-0.015, 0.015]) B.at(A.t(-w / 2 + 0.07, wall + 0.24, dz), () => B.cyl(0.011, 0.03, 8, 0.009));
    // the green door with its knob, a porch hood
    B.col('#2f6b3a').mat(MAT.PAINT).slab(-0.025, 0.012, d / 2, 0.025, 0.105, d / 2 + 0.006);
    B.col('#c99a3a').mat(MAT.METAL).at(A.t(0.016, 0.06, d / 2 + 0.008), () => B.ball(0.003, 0.003, 0.003, 0));
    B.col('#4b5562').mat(MAT.MATTE).at(A.mul(A.t(0, 0.112, d / 2 + 0.025), A.ry(Math.PI / 2)), () => B.prism([[-0.025, 0], [0.025, 0], [0, 0.03]], 0.08));
    // windows: dark glass, white frames and glazing bars, stone sills
    for (const [wx, wy, side] of [[-0.14, 0.05, 1], [0.14, 0.05, 1], [-0.14, 0.145, 1], [0.14, 0.145, 1], [0, 0.145, 1], [-0.12, 0.1, -1], [0.12, 0.1, -1]]) {
      const zf = side * (d / 2 + 0.002);
      B.col('#253039').mat(MAT.GLASS).slab(wx - 0.032, wy - 0.03, zf - 0.002, wx + 0.032, wy + 0.03, zf + 0.002);
      B.col('#f7f5ef').mat(MAT.PAINT);
      for (const [a, b, c, e] of [[-0.035, -0.033, 0.035, -0.028], [-0.035, 0.028, 0.035, 0.033], [-0.035, -0.033, -0.03, 0.033], [0.03, -0.033, 0.035, 0.033], [-0.002, -0.03, 0.002, 0.03], [-0.032, -0.002, 0.032, 0.002]]) B.slab(wx + a, wy + b, zf - 0.003, wx + c, wy + e, zf + side * 0.005);
      B.col('#cfc8bb').mat(MAT.MATTE).slab(wx - 0.04, wy - 0.042, zf - 0.004, wx + 0.04, wy - 0.034, zf + side * 0.014);
    }
  });
}
function fence(B) {   // a white picket fence round the garden, with a gap for the path
  const [x0, z0, x1, z1] = GARDEN;
  B.col('#f4f2ea').mat(MAT.PAINT);
  const run = (ax, az, bx, bz, gap) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.024), ux = (bx - ax) / len, uz = (bz - az) / len, rot = Math.atan2(ux, uz);
    for (let k = 0; k <= n; k++) {
      const px = ax + ux * len * (k / n), pz = az + uz * len * (k / n);
      if (gap !== undefined && Math.abs(px - gap) < 0.05) continue;
      B.at(A.mul(A.t(px, H(px, pz), pz), A.ry(rot)), () => { B.slab(-0.0045, 0, -0.0015, 0.0045, 0.045, 0.0015); B.at(A.mul(A.t(0, 0.045, 0), A.rz(Math.PI / 4)), () => B.box(0.0064, 0.0064, 0.003)); });
    }
    const segs = gap !== undefined ? [[0, Math.abs(gap - ax) / len - 0.05 / len], [Math.abs(gap - ax) / len + 0.05 / len, 1]] : [[0, 1]];
    for (const h of [0.012, 0.034]) for (const [a, b] of segs) {
      const pa = [ax + ux * len * a, az + uz * len * a], pb = [ax + ux * len * b, az + uz * len * b], l = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), mx = (pa[0] + pb[0]) / 2, mz = (pa[1] + pb[1]) / 2;
      B.at(A.mul(A.t(mx, H(mx, mz) + h, mz), A.ry(rot)), () => B.box(0.005, 0.005, l));
    }
  };
  run(x0, z1, x1, z1, COTTAGE.x); run(x1, z1, x1, z0); run(x1, z0, x0, z0); run(x0, z0, x0, z1);
}
function flowers(B, R) {   // cottage-garden beds: hollyhocks, delphiniums, marigolds, roses, daisies
  const C = ['#e65a8a', '#5a72d8', '#f28a2a', '#d8283a', '#f7f4ea', '#f2d23a', '#b45ad8'];
  const spots = [];
  for (let x = GARDEN[0] + 0.05; x < GARDEN[2] - 0.04; x += 0.045) if (Math.abs(x - COTTAGE.x) > 0.07) spots.push([x, GARDEN[3] - 0.045]);
  for (let x = COTTAGE.x - COTTAGE.w / 2; x < COTTAGE.x + COTTAGE.w / 2; x += 0.05) if (Math.abs(x - COTTAGE.x) > 0.06) spots.push([x, COTTAGE.z + COTTAGE.d / 2 + 0.035]);
  for (let z = GARDEN[1] + 0.06; z < GARDEN[3] - 0.08; z += 0.05) spots.push([GARDEN[2] - 0.04, z]);
  for (const [x, z] of spots) {
    const y = H(x, z), tall = R() < 0.3, h = tall ? 0.05 + R() * 0.03 : 0.012 + R() * 0.012, c = C[(R() * C.length) | 0];
    B.col(R() < 0.5 ? '#3f7a32' : '#4d8a3a').mat(MAT.LEAF).at(A.t(x, y + h * 0.4, z), () => B.ball(0.016, h * 0.5 + 0.006, 0.016, 1));
    B.col(c).mat(MAT.MATTE);
    const n = tall ? 6 : 5;
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, r = R() * 0.012;
      B.at(A.t(x + Math.cos(a) * r, y + (tall ? h * (0.4 + (0.6 * k) / n) : h + 0.004), z + Math.sin(a) * r), () => B.ball(0.0045, 0.0045, 0.0045, 0));
    }
  }
}
function washingLine(B) {   // the poles are scenery; the washing is a part of its own (it flaps below its line)
  B.col('#8a6a48').mat(MAT.MATTE);
  for (const x of [-1.38, -1.02]) B.at(A.t(x, H(x, 0.62), 0.62), () => B.cyl(0.004, 0.14, 6));
}
/** The washing, in the line's frame: the line along +x from the first pole, clothes hanging below y = 0. */
export function washing(B) {
  B.col('#efeae0').mat(MAT.MATTE).at(A.rz(-Math.PI / 2), () => B.cyl(0.0012, 0.36, 4));
  const items = [[0.03, 0.06, 0.07, '#f7f4ee'], [0.11, 0.045, 0.05, '#4a78c8'], [0.17, 0.03, 0.035, '#e8484e'], [0.215, 0.05, 0.06, '#f2d23a'], [0.28, 0.06, 0.045, '#f7f4ee'], [0.33, 0.018, 0.03, '#2f6b3a']];
  for (const [x, w, h, c] of items) {
    B.col(c).mat(MAT.CLOTH).sheet(4, 4, (i, j) => [x - w / 2 + (w * j) / 3, -(h * i) / 3, 0]);
    B.col('#c9b07a').mat(MAT.MATTE);
    for (const px of [x - w / 2 + 0.003, x + w / 2 - 0.003]) B.slab(px - 0.0015, -0.004, -0.0015, px + 0.0015, 0.004, 0.0015);
  }
}
export const WASHING_AT = () => A.t(-1.38, H(-1.38, 0.62) + 0.13, 0.62);

function windmill(B) {   // a white tower mill: tapering tower, a gallery, a dark cap, a fantail
  const { x, z, h } = MILL, y = H(x, z);
  B.at(A.t(x, y, z), () => {
    B.col('#2b2b2b').mat(MAT.MATTE).cyl(0.118, 0.03, 8, 0.116);
    B.col('#f3f1ea').at(A.t(0, 0.03, 0), () => B.lathe([[0.116, 0], [0.1, h * 0.5], [0.078, h - 0.03]], 8));
    B.col('#2a3a2e').mat(MAT.PAINT).at(A.ry(MILL.face), () => B.slab(-0.02, 0.03, 0.105, 0.02, 0.1, 0.12));   // the door
    B.col('#253039').mat(MAT.GLASS);
    for (const [a, yy] of [[0.4, 0.2], [2.4, 0.28], [-1.4, 0.36]]) B.at(A.mul(A.ry(MILL.face + a), A.t(0, yy, 0.1 - yy * 0.035)), () => B.slab(-0.012, -0.016, -0.004, 0.012, 0.016, 0.006));
    // the gallery and its railing
    B.col('#3b3b3b').mat(MAT.PAINT).at(A.t(0, h * 0.42, 0), () => B.cyl(0.15, 0.008, 16));
    for (let k = 0; k < 20; k++) { const a = (k / 20) * 6.283; B.at(A.t(Math.cos(a) * 0.145, h * 0.42 + 0.008, Math.sin(a) * 0.145), () => B.cyl(0.0018, 0.03, 4)); }
    B.at(A.t(0, h * 0.42 + 0.036, 0), () => B.lathe([[0.146, 0], [0.146, 0.004]], 20));
    // the cap: a boat-shaped dome, the windshaft, a fantail behind
    B.col('#3d4044').mat(MAT.PAINT).at(A.mul(A.t(0, h - 0.03, 0), A.ry(MILL.face)), () => {
      B.ball(0.085, 0.075, 0.1, 2);
      B.col('#6b6e72').mat(MAT.METAL).at(A.mul(A.t(0, 0.035, 0.09), A.rx(Math.PI / 2)), () => B.cyl(0.012, 0.04, 8));
      B.col('#f3f1ea').mat(MAT.PAINT).at(A.t(0, 0.04, -0.12), () => {
        B.slab(-0.003, -0.05, -0.003, 0.003, 0.02, 0.003);
        for (let k = 0; k < 6; k++) B.at(A.mul(A.t(0, 0.02, -0.005), A.rz((k / 6) * Math.PI * 2)), () => B.slab(-0.004, 0, -0.001, 0.004, 0.035, 0.001));
      });
    });
  });
}
/** The sails, in their own frame: the hub at the origin, turning about z. */
export function sails(B) {
  B.col('#3d4044').mat(MAT.PAINT).at(A.rx(Math.PI / 2), () => B.cyl(0.022, 0.02, 10));
  for (let k = 0; k < 4; k++) B.at(A.rz((k * Math.PI) / 2), () => {
    B.col('#efe9dc').mat(MAT.PAINT).slab(-0.006, 0, -0.004, 0.006, 0.34, 0.004);   // the stock
    B.col('#e4ddcc');
    for (let y = 0.06; y <= 0.34; y += 0.028) B.slab(0, y - 0.0018, -0.003, 0.068, y + 0.0018, 0.001);   // the bars
    B.slab(0.064, 0.06, -0.003, 0.07, 0.34, 0.001);
    B.slab(0.03, 0.06, -0.002, 0.033, 0.34, 0.0005);
  });
}
export const SAILS_AT = () => {
  const y = H(MILL.x, MILL.z) + MILL.h - 0.03 + 0.035, f = MILL.face;
  return A.mul(A.t(MILL.x + Math.sin(f) * 0.13, y, MILL.z + Math.cos(f) * 0.13), A.ry(f));
};

function oak(B, x, z, s, R) {
  const y = H(x, z);
  B.col('#5a4330').mat(MAT.MATTE).tube([[x, y - 0.02, z], [x + 0.005 * s, y + 0.12 * s, z], [x - 0.01 * s, y + 0.24 * s, z + 0.01 * s]], [0.022 * s, 0.016 * s, 0.011 * s], 7);
  const G = ['#3f6b2a', '#4b7a31', '#56873a', '#35602a'];
  for (let k = 0; k < 9; k++) {
    const a = R() * 6.28, r = (k ? 0.07 + R() * 0.06 : 0) * s, yy = y + (0.26 + R() * 0.12) * s, rr = (0.07 + R() * 0.05) * s;
    B.col(G[(R() * G.length) | 0]).mat(MAT.LEAF).at(A.t(x + Math.cos(a) * r, yy, z + Math.sin(a) * r), () => B.ball(rr, rr * 0.85, rr, 1));
  }
}
function poplar(B, x, z, s, R) {
  const y = H(x, z);
  B.col('#5f5040').mat(MAT.MATTE).at(A.t(x, y, z), () => B.cyl(0.009 * s, 0.12 * s, 6, 0.006 * s));
  for (let k = 0; k < 4; k++) B.col(['#4a7a34', '#57873a', '#3f6e2e'][k % 3]).mat(MAT.LEAF).at(A.t(x + (R() - 0.5) * 0.01, y + (0.17 + k * 0.1) * s, z + (R() - 0.5) * 0.01), () => B.ball(0.045 * s * (1 - k * 0.12), 0.09 * s, 0.045 * s * (1 - k * 0.12), 1));
}
function willow(B, x, z, s, R) {   // a weeping willow: a leaning trunk, a light crown, curtains of hanging strands
  const y = H(x, z), top = [x + 0.03 * s, y + 0.2 * s, z];
  B.col('#6a5a44').mat(MAT.MATTE).tube([[x, y - 0.02, z], [x + 0.01 * s, y + 0.1 * s, z], top], [0.018 * s, 0.014 * s, 0.01 * s], 7);
  B.col('#8fb04a').mat(MAT.LEAF);
  for (let k = 0; k < 5; k++) { const a = R() * 6.28, r = 0.05 * s * R(); B.at(A.t(top[0] + Math.cos(a) * r, top[1] + 0.03 * s + R() * 0.03 * s, top[2] + Math.sin(a) * r), () => B.ball(0.06 * s, 0.04 * s, 0.06 * s, 1)); }
  for (let k = 0; k < 46; k++) {
    const a = (k / 46) * 6.283 + R() * 0.2, r0 = (0.03 + R() * 0.07) * s, r1 = r0 + (0.03 + R() * 0.03) * s, len = (0.14 + R() * 0.1) * s, w = 0.012 * s;
    const cx = Math.cos(a), cz = Math.sin(a);
    B.col(['#9cbc52', '#86a844', '#a8c860'][k % 3]).sheet(5, 2, (i, j) => {
      const t = i / 4, rr = r0 + (r1 - r0) * Math.sin(t * 1.4), off = (j - 0.5) * w * (1 - t * 0.6);
      return [top[0] + cx * rr - cz * off, top[1] + 0.05 * s - len * t * t * 0.4 - len * t * 0.6, top[2] + cz * rr + cx * off];
    });
  }
}
function hedge(B, pts, R) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / 0.035);
    for (let k = 0; k <= n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n, z = a[1] + ((b[1] - a[1]) * k) / n;
      B.col(R() < 0.5 ? '#2f5a26' : '#386630').mat(MAT.LEAF).at(A.t(x, H(x, z) + 0.035, z), () => B.ball(0.03 + R() * 0.008, 0.04, 0.03 + R() * 0.008, 1));
    }
  }
}
function reeds(B, R) {   // clumps on the soft banks' shelves: blades and the odd bulrush
  const dx = L.GDX * 1.5;
  for (let z = -L.HALF + 0.03; z < L.HALF - 0.03; z += dx) for (let x = -L.HALF + 0.03; x < L.HALF - 0.03; x += dx) {
    const t = H(x, z), lv = L.bodyAt(x, z) === L.LO ? L.LL : L.LU, shelf = Math.abs(t - (lv - 0.03)) < 0.025;
    if (!shelf || L.zones(x, z)[0] > 0.2 || R() > 0.45) continue;
    if (Math.abs(z - L.ZM) < 0.25 && x > -1.7 && x < L.XT) continue;   // keep the boat's way clear
    const n = 4 + ((R() * 4) | 0), px = x + (R() - 0.5) * dx, pz = z + (R() - 0.5) * dx;
    for (let k = 0; k < n; k++) {
      const a = R() * 6.28, lean = 0.15 + R() * 0.35, h = 0.05 + R() * 0.07, bx = px + Math.cos(a) * 0.006, bz = pz + Math.sin(a) * 0.006;
      B.col(R() < 0.7 ? '#5e8a3a' : '#8a8a4a').mat(MAT.GRASS);
      B.quad([bx - 0.002, t, bz], [bx + 0.002, t, bz], [bx + Math.cos(a) * lean * h * 0.5, t + h, bz + Math.sin(a) * lean * h * 0.5], [bx + Math.cos(a) * lean * h * 0.5 - 0.0005, t + h, bz + Math.sin(a) * lean * h * 0.5]);
    }
    if (R() < 0.35) B.col('#5a3a22').mat(MAT.GRASS).at(A.t(px, t + 0.07, pz), () => B.cyl(0.003, 0.018, 5));
  }
}
function lilies(B, R) {   // pads riding the surface in the quiet corners, some in flower
  const patches = [[0.82, 0.38, 0.14], [0.8, -1.45, 0.12], [2.32, -2.0, 0.08], [-2.32, 1.62, 0.12]];
  for (const [cx, cz, r] of patches) for (let k = 0; k < 14; k++) {
    const a = R() * 6.28, d = Math.sqrt(R()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (L.terrainH(x, z) > (L.bodyAt(x, z) === L.LO ? L.LL : L.LU) - 0.02) continue;
    const pr = 0.012 + R() * 0.012;
    B.col(R() < 0.5 ? '#3f7a34' : '#4c8a3c').mat(MAT.FLOAT).at(A.t(x, 0, z), () => B.disc(pr, 0.0015, 1, 12));
    if (R() < 0.25) {
      B.col(R() < 0.5 ? '#f7f2ee' : '#f2a6c0');
      for (let q = 0; q < 6; q++) { const t = (q / 6) * 6.283; B.at(A.mul(A.t(x + Math.cos(t) * 0.004, 0.006, z + Math.sin(t) * 0.004), A.ry(-t), A.rz(0.6)), () => B.box(0.007, 0.003, 0.004)); }
      B.col('#f2d23a').at(A.t(x, 0.008, z), () => B.ball(0.0025, 0.002, 0.0025, 0));
    }
  }
}
function bicycle(B) {   // an old bicycle lying on the basin's bed, rusting
  const x = 1.3, z = -0.42, y = L.terrainH(x, z) + 0.006;
  B.col('#7a4a2a').mat(MAT.MATTE).at(A.mul(A.t(x, y, z), A.ry(0.7), A.rx(Math.PI / 2 - 0.12)), () => {
    for (const cx of [-0.045, 0.045]) { const ring = []; for (let k = 0; k <= 16; k++) { const a = (k / 16) * 6.283; ring.push([cx + Math.cos(a) * 0.032, Math.sin(a) * 0.032, 0]); } B.tube(ring, 0.003, 4); }
    B.tube([[-0.045, 0, 0], [-0.005, 0.03, 0], [0.03, 0.03, 0], [0.045, 0, 0]], 0.0028, 4);
    B.tube([[-0.005, 0.03, 0], [0.005, 0, 0], [-0.045, 0, 0]], 0.0028, 4);
    B.tube([[0.03, 0.03, 0], [0.034, 0.045, 0]], 0.0025, 4);
    B.tube([[0.034, 0.045, -0.015], [0.034, 0.045, 0.015]], 0.0025, 4);
    B.col('#3a2a20').slab(-0.012, 0.034, -0.006, 0.006, 0.039, 0.006);
  });
  B.col('#3f6a2a').mat(MAT.GRASS);
  for (let k = 0; k < 7; k++) { const a = k * 0.9; B.quad([x + Math.cos(a) * 0.04, y, z + Math.sin(a) * 0.04], [x + Math.cos(a) * 0.04 + 0.004, y, z + Math.sin(a) * 0.04], [x + Math.cos(a) * 0.05, y + 0.07, z + Math.sin(a) * 0.05], [x + Math.cos(a) * 0.05 - 0.002, y + 0.07, z + Math.sin(a) * 0.05]); }
}
function bridge(B) {   // a humpback brick bridge carrying the lane over the channel
  const cx = L.CHX, span = L.CHW, z0 = L.BRIDGE.z - L.BRIDGE.half, z1 = L.BRIDGE.z + L.BRIDGE.half, ext = 0.42, rise = 0.21;
  const deck = (x) => { const u = Math.min(1, Math.abs(x - cx) / ext); return Math.max(H(x, L.BRIDGE.z), L.TL) + 0.01 + rise * Math.cos((u * Math.PI) / 2) ** 2; };
  const arch = (x) => { const u = (x - cx) / span; return Math.abs(u) >= 1 ? -1 : L.LL - 0.02 + span * 1.05 * Math.sqrt(1 - u * u); };
  const N = 40, xs = Array.from({ length: N + 1 }, (_, k) => Math.min(L.HALF, cx - ext + (2 * ext * k) / N));
  B.col('#9a5038').mat(MAT.BRICK);
  for (const zf of [z0, z1]) {   // the two faces: from the arch (or the ground) up to the parapet
    B.sheet(2, N + 1, (i, k) => { const x = xs[k], lo = arch(x) > 0 ? arch(x) : Math.min(H(x, zf), deck(x)) - 0.03; return [x, i ? deck(x) + 0.03 : lo, zf]; });
  }
  B.sheet(N + 1, 2, (k, j) => { const x = xs[k], y = arch(x) > 0 ? arch(x) : L.BL; return [x, y, j ? z1 : z0]; });   // the vault
  for (const zf of [z0 + 0.012, z1 - 0.012]) B.sheet(2, N + 1, (i, k) => [xs[k], deck(xs[k]) + (i ? 0.03 : 0), zf]);   // the parapets' inner faces
  B.col('#cfc8bb').mat(MAT.MATTE);
  for (const zf of [z0, z1]) for (let k = 0; k < N; k++) {   // coping on the parapets
    const a = xs[k], b = xs[k + 1], ya = deck(a) + 0.03, yb = deck(b) + 0.03, w = zf === z0 ? 0.016 : -0.016;
    B.quad([a, ya, zf - Math.sign(w) * 0.004], [b, yb, zf - Math.sign(w) * 0.004], [b, yb, zf + w], [a, ya, zf + w]);
  }
  B.col('#b9ab8e').mat(MAT.MATTE).sheet(N + 1, 2, (k, j) => [xs[k], deck(xs[k]), j ? z1 - 0.012 : z0 + 0.012]);   // the lane over it
  B.col('#ddd5c6');   // the arch rings' voussoirs
  for (const zf of [z0 - 0.002, z1 + 0.002]) for (let k = 0; k <= 18; k++) {
    const a = Math.PI * (k / 18), x = cx + Math.cos(a) * span * 0.99, y = L.LL - 0.02 + Math.sin(a) * span * 1.04;
    B.at(A.mul(A.t(x, y, zf), A.rz(a - Math.PI / 2)), () => B.box(0.02, 0.034, 0.006));
  }
}
function tufts(B, R) {   // a sprinkle of grass tufts and buttercups over the fields
  for (let k = 0; k < 260; k++) {
    const x = (R() * 2 - 1) * (L.HALF - 0.04), z = (R() * 2 - 1) * (L.HALF - 0.04), z3 = L.zones(x, z);
    if (z3[0] + z3[1] + z3[2] > 0.1 || H(x, z) < (L.bodyAt(x, z) === L.LO ? L.LL : L.LU) + 0.04) continue;
    if (Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 0.3 || Math.hypot(x - MILL.x, z - MILL.z) < 0.18) continue;
    const y = H(x, z);
    B.col(R() < 0.5 ? '#5a8a36' : '#6a9a40').mat(MAT.GRASS);
    for (let q = 0; q < 4; q++) { const a = R() * 6.28, h = 0.012 + R() * 0.014; B.quad([x - 0.0015, y, z], [x + 0.0015, y, z], [x + Math.cos(a) * 0.006, y + h, z + Math.sin(a) * 0.006], [x + Math.cos(a) * 0.006, y + h, z + Math.sin(a) * 0.006 + 0.0005]); }
    if (R() < 0.25) B.col(R() < 0.7 ? '#f2d23a' : '#f7f4ea').mat(MAT.MATTE).at(A.t(x, y + 0.016, z), () => B.ball(0.0035, 0.002, 0.0035, 0));
  }
}

/** All the still scenery (into part 0). */
export function buildScenery(B) {
  const R = L.rng(5);
  cottage(B); fence(B); flowers(B, R); washingLine(B); windmill(B); bridge(B); bicycle(B);
  for (const [x, z, s] of [[-0.15, -1.25, 1.1], [0.35, -2.2, 1.0], [-2.35, -0.5, 0.9], [0.95, 1.35, 0.8], [-1.25, -2.3, 1.0], [-0.1, 1.3, 0.62]]) oak(B, x, z, s, R);
  for (let k = 0; k < 5; k++) poplar(B, -2.48, -2.3 + k * 0.32, 1.25 + 0.15 * R(), R);
  for (const [x, z, s] of [[0.7, 0.78, 1.0], [2.45, -1.0, 1.0], [L.ISLE[0], L.ISLE[1], 1.15], [-2.42, 1.15, 0.9]]) willow(B, x, z, s, R);
  hedge(B, [[-0.26, 0.86], [0.4, 0.84]], R);
  hedge(B, [[-2.6, 0.86], [-1.5, 0.86]], R);
  reeds(B, R); lilies(B, R); tufts(B, R);
}
