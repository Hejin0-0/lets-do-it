// Iceberg Jelly — the still things of the bay: the timber quay, the research station (red and yellow huts on
// stilts, fuel drums, a radio mast with guy wires, a snowmobile, a flag and a turning anemometer), the
// rookery's pebble-ring nests, seracs near the glacier's front, and on the sea floor sponges, sea stars,
// swaying anemones and shells.
import { A, MAT, setPart } from '@lid/diorama/parts.js';
import { I } from './layout.js';

const H = I.terrainH;
function quay(B) {   // a timber deck on piles along the peninsula's front
  const { x0, x1, z, deck } = I.QUAY, z0 = z - 0.07, z1 = z + 0.1;
  B.col('#7a5c40').mat(MAT.MATTE);
  for (let x = x0; x < x1 - 0.01; x += 0.036) B.slab(x + 0.002, deck - 0.006, z0, x + 0.034, deck, z1);
  B.col('#5a4330');
  for (let x = x0 + 0.03; x < x1; x += 0.12) for (const zz of [z + 0.02, z1 - 0.012]) B.at(A.t(x, H(x, zz), zz), () => B.cyl(0.011, deck - H(x, zz) - 0.004, 7));
  B.slab(x0, deck - 0.02, z1 - 0.008, x1, deck - 0.006, z1);   // the stringer
  B.col('#2a2a2a').mat(MAT.MATTE);
  for (let x = x0 + 0.04; x < x1; x += 0.07) B.slab(x - 0.012, deck - 0.05, z1, x + 0.012, deck - 0.005, z1 + 0.012);   // tyre fenders
  B.col('#1f1f1f').mat(MAT.PAINT);
  for (const x of [x0 + 0.12, (x0 + x1) / 2, x1 - 0.12]) B.at(A.t(x, deck, z1 - 0.025), () => B.lathe([[0, 0], [0.014, 0], [0.012, 0.022], [0.017, 0.028], [0, 0.03]], 10));
}
function hut(B, x, z, w, d, h, col, yaw) {   // a hut on stilts with a pitched roof, windows and a door
  const g = H(x, z) + 0.035;
  B.at(A.mul(A.t(x, g, z), A.ry(yaw)), () => {
    B.col('#4a4a4a').mat(MAT.MATTE);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const px = sx * (w / 2 - 0.008), pz = sz * (d / 2 - 0.008); B.slab(px - 0.005, -0.06, pz - 0.005, px + 0.005, 0.004, pz + 0.005); }
    B.col(col).mat(MAT.PAINT).slab(-w / 2, 0, -d / 2, w / 2, h, d / 2);
    B.col('#dfe3e6').at(A.ry(Math.PI / 2), () => B.prism([[-d / 2 - 0.015, h], [d / 2 + 0.015, h], [0, h + d * 0.32]], w + 0.02));
    B.col('#2c3a44').mat(MAT.GLASS);
    for (let k = 0; k < Math.floor(w / 0.08); k++) { const wx = -w / 2 + 0.05 + k * 0.08; B.slab(wx - 0.018, h * 0.5, d / 2, wx + 0.018, h * 0.8, d / 2 + 0.004); }
    B.col('#f2f2ee').mat(MAT.PAINT).slab(w / 2, 0.005, -0.022, w / 2 + 0.004, h * 0.75, 0.022);
    B.col('#7a7a7a').mat(MAT.MATTE).slab(w / 2, -0.06, -0.03, w / 2 + 0.06, -0.05, 0.03);   // the steps
  });
}
function station(B, parts) {
  const S = I.STATION;
  hut(B, S.x - 0.15, S.z - 0.05, 0.34, 0.2, 0.14, '#c8322b', 0.2);
  hut(B, S.x + 0.25, S.z + 0.25, 0.24, 0.17, 0.12, '#e7b62a', -0.4);
  for (let k = 0; k < 6; k++) {   // fuel drums
    const x = S.x + 0.32 + (k % 3) * 0.035, z = S.z - 0.28 + Math.floor(k / 3) * 0.035;
    B.col(k % 2 ? '#2f5f9a' : '#b8352c').mat(MAT.PAINT).at(A.t(x, H(x, z), z), () => B.cyl(0.015, 0.045, 10));
  }
  // the radio mast, red and white, and its guys
  const m = [S.x - 0.42, S.z - 0.32], mb = H(...m);
  for (let k = 0; k < 6; k++) B.col(k % 2 ? '#f4f4f0' : '#d63a2f').mat(MAT.PAINT).at(A.t(m[0], mb + k * 0.096, m[1]), () => B.cyl(0.006, 0.096, 6, 0.005));
  B.col('#2a2a2a').mat(MAT.MATTE);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * 6.283 + 0.4, ax = m[0] + Math.cos(a) * 0.26, az = m[1] + Math.sin(a) * 0.26;
    B.tube([[ax, H(ax, az), az], [m[0], mb + 0.54, m[1]]], 0.0012, 3);
  }
  // the snowmobile
  const sm = [S.x - 0.4, S.z + 0.32];
  B.at(A.mul(A.t(sm[0], H(...sm), sm[1]), A.ry(0.9)), () => {
    B.col('#1f1f1f').mat(MAT.MATTE);
    for (const s of [-1, 1]) B.slab(0.02, 0, s * 0.022 - 0.003, 0.11, 0.004, s * 0.022 + 0.003);
    B.slab(-0.07, 0.004, -0.02, 0.03, 0.02, 0.02);
    B.col('#e2332a').mat(MAT.PAINT).slab(-0.06, 0.015, -0.023, 0.09, 0.04, 0.023);
    B.col('#222222').slab(-0.06, 0.04, -0.016, 0.02, 0.05, 0.016);
    B.col('#9ab4c4').mat(MAT.GLASS).at(A.mul(A.t(0.07, 0.04, 0), A.rz(0.6)), () => B.box(0.004, 0.03, 0.04));
  });
  // the flag pole (the flag is a part) and the anemometer's mast on the red hut (its cups are a part)
  const fp = [S.x + 0.05, S.z + 0.42];
  B.col('#dcdcd8').mat(MAT.PAINT).at(A.t(fp[0], H(...fp), fp[1]), () => B.cyl(0.004, 0.3, 6));
  parts.flagAt = [fp[0], H(...fp) + 0.295, fp[1]];
  const an = [S.x - 0.2, S.z - 0.08], ay = H(S.x - 0.15, S.z - 0.05) + 0.035 + 0.14 + 0.06;
  B.col('#9a9a96').mat(MAT.METAL).at(A.t(an[0], ay, an[1]), () => B.cyl(0.003, 0.09, 5));
  parts.anemoAt = [an[0], ay + 0.09, an[1]];
}
function nests(B) {   // pebble rings
  const R = I.rng(23);
  for (const [x, z] of I.NESTS) for (let k = 0; k < 9; k++) {
    const a = (k / 9) * 6.283 + R() * 0.3, px = x + Math.cos(a) * 0.022, pz = z + Math.sin(a) * 0.022;
    B.col(R() < 0.5 ? '#8a8682' : '#b08a8a').mat(MAT.MATTE).at(A.t(px, H(px, pz) + 0.003, pz), () => B.ball(0.006, 0.0045, 0.006, 0));
  }
}
function seracs(B) {   // tottering ice blocks near the glacier's front
  const R = I.rng(29);
  for (let k = 0; k < 16; k++) {
    const x = I.GX + (R() - 0.5) * I.GW * 1.6, z = I.GZ - 0.06 - R() * 0.34, s = 0.035 + R() * 0.04;
    B.col('#e6f1f6').mat(MAT.ICE).at(A.mul(A.t(x, H(x, z) + s * 0.4, z), A.ry(R() * 6.28), A.rz((R() - 0.5) * 0.5), A.rx((R() - 0.5) * 0.4)), () => B.box(s, s * (1.2 + R()), s * 0.8));
  }
}
function seaFloor(B) {   // sponges, sea stars, anemones (their tentacles sway) and shells
  const R = I.rng(41);
  for (let k = 0, n = 0; k < 600 && n < 90; k++) {
    const x = (R() * 2 - 1) * (I.HALF - 0.05), z = -0.4 + R() * 3.0, y = H(x, z);
    if (I.SL - y < 0.2) continue;
    n++;
    const t = R();
    if (t < 0.25) {   // a sponge: a barrel or a cluster of fingers
      B.col(['#e2b23a', '#e07a3a', '#c9c27a'][(R() * 3) | 0]).mat(MAT.MATTE);
      if (R() < 0.5) B.at(A.t(x, y, z), () => B.lathe([[0.012, 0], [0.018, 0.02], [0.016, 0.045], [0.01, 0.05], [0.006, 0.04]], 8));
      else for (let q = 0; q < 4; q++) B.at(A.mul(A.t(x + (R() - 0.5) * 0.02, y, z + (R() - 0.5) * 0.02), A.rz((R() - 0.5) * 0.5)), () => B.cyl(0.004, 0.025 + R() * 0.02, 5, 0.003));
    } else if (t < 0.5) {   // a sea star
      B.col(['#e0643a', '#9a4ab0', '#e8a23a'][(R() * 3) | 0]).mat(MAT.MATTE).at(A.mul(A.t(x, y + 0.003, z), A.ry(R() * 6.28), A.rx(-Math.PI / 2)), () => {
        const pts = [];
        for (let q = 0; q < 10; q++) { const a = (q / 10) * 6.283, r = q % 2 ? 0.006 : 0.02; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
        B.prism(pts, 0.004);
      });
    } else if (t < 0.8) {   // an anemone: a stalk and a crown of swaying tentacles
      B.col(['#f2ece0', '#f2a46a', '#e86a8a'][(R() * 3) | 0]).mat(MAT.MATTE).at(A.t(x, y, z), () => B.cyl(0.007, 0.022, 7, 0.009));
      B.mat(MAT.GRASS);
      for (let q = 0; q < 9; q++) { const a = (q / 9) * 6.283; B.quad([x + Math.cos(a) * 0.007, y + 0.022, z + Math.sin(a) * 0.007], [x + Math.cos(a + 0.3) * 0.007, y + 0.022, z + Math.sin(a + 0.3) * 0.007], [x + Math.cos(a) * 0.02, y + 0.04, z + Math.sin(a) * 0.02], [x + Math.cos(a) * 0.019, y + 0.04, z + Math.sin(a) * 0.019]); }
    } else {   // a shell
      B.col('#efe6d6').mat(MAT.GLOSS).at(A.mul(A.t(x, y, z), A.ry(R() * 6.28)), () => B.ball(0.008, 0.004, 0.006, 0));
    }
  }
}

/** All the still things into part 0, then the flag and the anemometer as parts. */
export function buildStill(B, parts) {
  quay(B); station(B, parts); nests(B); seracs(B); seaFloor(B);
  parts.flag = B.newPart();
  B.col('#c8322b').mat(MAT.CLOTH).sheet(4, 4, (i, j) => [-0.018 + j * 0.012, -i * 0.022, 0]);
  parts.anemo = B.newPart();
  B.col('#dcdcd8').mat(MAT.PAINT);
  for (let k = 0; k < 3; k++) B.at(A.ry((k / 3) * 6.283), () => { B.slab(0, -0.0015, -0.0015, 0.03, 0.0015, 0.0015); B.at(A.t(0.03, 0, 0), () => B.ball(0.006, 0.006, 0.006, 0)); });
  B.part(0);
}
/** The flag streams out on the wind; the anemometer spins. */
export function poseStation(buf, parts, W) {
  setPart(buf, parts.flag, A.mul(A.t(...parts.flagAt), A.ry(-0.6), A.rz(Math.PI / 2)));
  setPart(buf, parts.anemo, A.mul(A.t(...parts.anemoAt), A.ry(W.time * 7)));
}
