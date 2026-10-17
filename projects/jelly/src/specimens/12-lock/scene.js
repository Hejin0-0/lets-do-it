// Lock Jelly — the scenery and the lock's gear as one parts mesh (@lid/diorama: parts.js). Part 0 is
// everything that never moves; the gates, the paddle racks, the windmill's sails and the washing are parts
// of their own, posed by the world. Returns the mesh and the part numbers.
import { partsBuilder, A, MAT } from '@lid/diorama/parts.js';
import { L } from './layout.js';
import { buildKeeper } from './keeper.js';
import { narrowboat, steererFigure, LIVERY, MOORED, BOAT } from './boat.js';
import { buildScenery, sails, washing, SAILS_AT, WASHING_AT } from './scenery.js';
import { buildLife, rubberDuck } from './life.js';

const { ZC, XT, XB, TU, LU, LL, BC, BEAM, BETA, LEAF } = L;
const H = L.terrainH;

// ----- the lock's furniture -----
function coping(B) {   // stone coping along every brick edge, proud of the wall over the water
  B.col('#cfc8bb').mat(MAT.MATTE);
  const run = (x0, x1, z) => {   // along x at the wall line z, the water on the +z side
    const n = Math.max(1, Math.round((x1 - x0) / 0.075));
    for (let k = 0; k < n; k++) {
      const a = x0 + ((x1 - x0) * k) / n, b = x0 + ((x1 - x0) * (k + 1)) / n;
      B.slab(a + 0.002, TU - 0.012, z - 0.07, b - 0.002, TU + 0.016, z + 0.014);
    }
  };
  const runZ = (z0, z1, x) => {   // along z at the wall line x, the water on the −x side
    const n = Math.max(1, Math.round((z1 - z0) / 0.075));
    for (let k = 0; k < n; k++) {
      const a = z0 + ((z1 - z0) * k) / n, b = z0 + ((z1 - z0) * (k + 1)) / n;
      B.slab(x - 0.014, TU - 0.012, a + 0.002, x + 0.07, TU + 0.016, b - 0.002);
    }
  };
  run(XT - 0.5, XT - 0.45, ZC); run(XT, XB - 0.45, ZC); run(XB, 1.25, ZC); run(1.25, 1.42, 2.145);
  run(XT - 0.45, XT, ZC - 0.055); run(XB - 0.45, XB, ZC - 0.055);   // behind the recesses
  run(XT - 0.62, XT - 0.5, 2.0);
  runZ(2.0, ZC, XT - 0.5);   // the wing wall
}
function quoins(B) {   // dressed stone at the recess ends, in courses
  B.col('#ddd5c6').mat(MAT.MATTE);
  for (const x of [XT, XT - 0.45, XB, XB - 0.45]) {
    const bed = x <= XT ? L.BU : BC;
    for (let y = bed, k = 0; y < TU - 0.03; y += 0.05, k++) {
      const w = k % 2 ? 0.05 : 0.08;
      B.slab(x - w / 2, y + 0.002, ZC - 0.004, x + w / 2, Math.min(TU - 0.012, y + 0.048), ZC + 0.006);
    }
  }
}
function ladder(B, x) {   // an iron ladder down the chamber wall
  B.col('#2a2c2e').mat(MAT.PAINT);
  for (const dx of [-0.022, 0.022]) B.slab(x + dx - 0.004, BC, ZC - 0.002, x + dx + 0.004, TU + 0.03, ZC + 0.014);
  for (let y = BC + 0.03; y < TU; y += 0.032) B.at(A.mul(A.t(x, y, ZC + 0.01), A.rz(Math.PI / 2), A.t(0, -0.022, 0)), () => B.cyl(0.0028, 0.044, 6));
}
function gauge(B, x) {   // a white board with black marks, read against the chamber's level
  B.col('#f2efe6').mat(MAT.PAINT).slab(x - 0.016, LL - 0.06, ZC + 0.001, x + 0.016, LU + 0.05, ZC + 0.008);
  B.col('#1b1b1b');
  for (let y = LL - 0.05, k = 0; y < LU + 0.04; y += 0.02, k++) B.slab(x - 0.016, y, ZC + 0.008, x - 0.016 + (k % 5 ? 0.012 : 0.022), y + 0.004, ZC + 0.01);
}
function gateLeaf(B, g) {   // in the gate's frame: the heel at the origin, the leaf along +z, the beam back over the lockside
  const y0 = g.sill - 0.01, y1 = TU + 0.035, t = 0.05, len = LEAF;
  for (let k = 0, n = Math.round((y1 - y0) / 0.034); k < n; k++) {   // planks
    const a = y0 + ((y1 - y0) * k) / n, b = y0 + ((y1 - y0) * (k + 1)) / n;
    B.col(k % 2 ? '#4f3e2f' : '#463628').mat(MAT.MATTE).slab(-t / 2, a + 0.0015, 0.02, t / 2, b - 0.0015, len);
  }
  B.col('#3b2d22');
  B.slab(-t / 2 - 0.006, y0, 0, t / 2 + 0.006, y1 + 0.01, 0.05);                 // the heel post
  B.slab(-t / 2 - 0.006, y0, len - 0.035, t / 2 + 0.006, y1, len);               // the head post
  for (const y of [y0 + 0.05, (y0 + y1) / 2, y1 - 0.04]) B.slab(-t / 2 - 0.008, y - 0.014, 0.04, t / 2 + 0.008, y + 0.014, len - 0.03);   // rails
  {   // the diagonal brace
    const a = [y0 + 0.06, len - 0.05], b = [y1 - 0.05, 0.06], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    B.at(A.mul(A.t(-t / 2 - 0.007, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), A.rx(Math.atan2(b[1] - a[1], b[0] - a[0]))), () => B.box(0.012, d, 0.024));
  }
  B.col('#1d1d1f').mat(MAT.PAINT);   // iron straps
  for (const y of [y0 + 0.05, y1 - 0.04]) B.slab(t / 2 + 0.006, y - 0.008, 0.0, t / 2 + 0.01, y + 0.008, 0.16);
  // the walkway and its handrail
  B.col('#6b5844').mat(MAT.MATTE).slab(-t / 2 - 0.035, y1, 0.03, -t / 2, y1 + 0.008, len - 0.02);
  B.col('#e9e6dc').mat(MAT.PAINT);
  for (const z of [0.06, len / 2, len - 0.04]) B.slab(t / 2 + 0.002, y1, z - 0.004, t / 2 + 0.01, y1 + 0.075, z + 0.004);
  B.at(A.mul(A.t(t / 2 + 0.006, y1 + 0.075, 0.04), A.rx(Math.PI / 2)), () => B.cyl(0.0045, len - 0.06, 6));
  // the balance beam: white with black bands, back over the lockside
  const bd = [-Math.sin(BETA), -Math.cos(BETA)];
  B.at(A.mul(A.t(0, y1 + 0.02, 0), A.ry(Math.atan2(bd[0], bd[1]))), () => {
    B.col('#efece4').mat(MAT.PAINT).slab(-0.019, -0.022, -0.02, 0.019, 0.022, BEAM);
    B.col('#18181a');
    for (const z of [BEAM - 0.13, 0.05]) B.slab(-0.0195, -0.0225, z, 0.0195, 0.0225, z + 0.03);
    B.slab(-0.02, -0.023, BEAM - 0.05, 0.02, 0.023, BEAM);
  });
}
function pedestal(B, x, z) {   // a ground-paddle gear: an iron pedestal with a spindle for the windlass, waist high
  B.col('#202224').mat(MAT.PAINT);
  B.at(A.t(x, TU, z), () => {
    B.slab(-0.018, 0, -0.015, 0.018, 0.008, 0.015);
    B.slab(-0.011, 0.008, -0.01, 0.011, 0.05, 0.01);
    B.slab(-0.015, 0.05, -0.013, 0.015, 0.06, 0.013);
    B.col('#9a9a96').mat(MAT.METAL).at(A.mul(A.t(0, 0.042, -0.01), A.rx(-Math.PI / 2)), () => B.cyl(0.0035, 0.016, 6));   // the spindle, toward the keeper
  });
}
function rack(B) {   // the toothed rack that rises as the paddle is drawn, in its own frame
  B.col('#25272a').mat(MAT.PAINT).slab(-0.0045, 0, -0.0045, 0.0045, 0.075, 0.0045);
  B.col('#3a3d40');
  for (let y = 0.006; y < 0.075; y += 0.009) B.slab(0.0045, y, -0.0035, 0.008, y + 0.0045, 0.0035);
}
function bollard(B, x, z) {
  B.col('#1e1f21').mat(MAT.PAINT).at(A.t(x, H(x, z), z), () => B.lathe([[0.0, 0], [0.024, 0], [0.024, 0.006], [0.018, 0.012], [0.016, 0.045], [0.024, 0.058], [0.02, 0.066], [0, 0.068]], 12));
}
function bench(B, x, z) {   // facing +z (the lock)
  B.at(A.t(x, H(x, z), z), () => {
    B.col('#2b2b2c').mat(MAT.PAINT);
    for (const dx of [-0.075, 0.075]) { B.slab(dx - 0.005, 0, -0.025, dx + 0.005, 0.045, 0.025); B.slab(dx - 0.005, 0.045, -0.03, dx + 0.005, 0.1, -0.022); }
    B.col('#8a6a48').mat(MAT.MATTE);
    for (const z0 of [-0.024, -0.008, 0.008]) B.slab(-0.095, 0.045, z0, 0.095, 0.052, z0 + 0.014);
    for (const y0 of [0.064, 0.082]) B.slab(-0.095, y0, -0.03, 0.095, y0 + 0.013, -0.024);
  });
}
function lamp(B, x, z) {   // a gas lamp: a fluted post, a lantern with a glowing mantle
  B.at(A.t(x, H(x, z), z), () => {
    B.col('#1f2a24').mat(MAT.PAINT).lathe([[0.022, 0], [0.022, 0.02], [0.012, 0.035], [0.008, 0.06], [0.006, 0.27], [0.012, 0.275], [0.012, 0.282], [0, 0.283]], 10);
    B.slab(-0.03, 0.235, -0.0025, 0.03, 0.24, 0.0025);   // the ladder bar
    B.at(A.t(0, 0.283, 0), () => {
      B.col('#1f2a24').cyl(0.018, 0.006, 8, 0.024);
      B.col('#e9d9a6').mat(MAT.GLASS).at(A.t(0, 0.006, 0), () => B.cyl(0.022, 0.045, 4, 0.028, false));
      B.col('#ffe6a0').mat(MAT.GLOW).at(A.t(0, 0.02, 0), () => B.ball(0.007, 0.01, 0.007, 1));
      B.col('#1f2a24').mat(MAT.PAINT).at(A.t(0, 0.051, 0), () => B.cyl(0.03, 0.02, 4, 0.004));
    });
  });
}

function cat(B, x, y, z) {   // a ginger cat sitting on a cabin roof, tail curled round
  B.col('#d9822b').mat(MAT.FEATHER).at(A.t(x, y, z), () => {
    B.at(A.t(0, 0.012, 0), () => B.ball(0.011, 0.013, 0.009, 1));
    B.at(A.t(0.006, 0.03, 0), () => B.ball(0.0075, 0.007, 0.007, 1));
    for (const s of [-1, 1]) B.at(A.mul(A.t(0.006, 0.037, s * 0.004), A.rx(s * 0.3)), () => B.cyl(0.0028, 0.006, 4, 0));
    B.tube([[-0.008, 0.003, 0], [-0.013, 0.002, 0.008], [-0.006, 0.002, 0.014], [0.004, 0.002, 0.013]], 0.0022, 5);
    B.col('#f6e6cc').at(A.t(0.011, 0.028, 0), () => B.ball(0.003, 0.003, 0.004, 0));
  });
}
function mooringPins(B) {   // iron pins in the far bank, two to a boat
  B.col('#2a2a2a').mat(MAT.PAINT);
  for (const p of pinSpots()) B.at(A.t(p[0], p[1] - 0.012, p[2]), () => B.cyl(0.0035, 0.026, 6));
}
/** Where the mooring pins stand: two per boat, out along the bank from its bow and stern. */
export function pinSpots() {
  const out = [];
  for (const m of MOORED) for (const s of [-1, 1]) {
    const x = m.x + s * (m.len / 2 + 0.06), z = L.BASIN[1] - 0.04;
    out.push([x, H(x, z) + 0.012, z]);
  }
  return out;
}

/** Build the whole mesh. Returns { mesh, parts }. */
export function buildScene() {
  const B = partsBuilder();
  const parts = {};
  B.part(0);   // the still scenery
  coping(B); quoins(B);
  ladder(B, 0.22); gauge(B, XT + 0.24);
  for (const p of L.PADDLES) pedestal(B, p.at[0], p.at[1]);
  for (const [x, z] of L.BOLLARDS) bollard(B, x, z);
  bench(B, L.BENCH.at[0], L.BENCH.at[1]);
  lamp(B, L.LAMP[0], L.LAMP[1]);
  mooringPins(B);
  buildScenery(B);
  // moving parts
  parts.gates = L.GATES.map((g) => { const k = B.newPart(); gateLeaf(B, g); return k; });
  parts.racks = L.PADDLES.map(() => { const k = B.newPart(); rack(B); return k; });
  parts.sails = B.newPart(); sails(B);
  parts.washing = B.newPart(); washing(B);
  parts.keeper = buildKeeper(B);
  parts.boat = B.newPart(); narrowboat(B, LIVERY.wobble);
  parts.steerer = B.newPart(); steererFigure(B);
  parts.moored = MOORED.map((m) => {
    const k = B.newPart(), r = narrowboat(B, LIVERY[m.livery], { len: m.len, beam: 0.13 });
    if (m.cat) cat(B, r.c0 + 0.06, r.roof, 0.01);
    return k;
  });
  parts.lines = MOORED.flatMap(() => [0, 1].map(() => { const k = B.newPart(); B.col('#d8c9a4').mat(MAT.MATTE).cyl(0.0022, 1, 5, 0.0022, false); return k; }));
  parts.life = buildLife(B);
  parts.ducks = Array.from({ length: 10 }, () => { const k = B.newPart(); rubberDuck(B); return k; });
  parts.puffs = Array.from({ length: 40 }, () => { const k = B.newPart(); B.col('#bdbab4').mat(MAT.SMOKE).ball(1, 1, 1, 1); return k; });
  return { mesh: B.done(), parts };
}

/** A rope from a to b (the unit rope runs up y). */
function rope(a, b) {
  const Y = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...Y) || 1, y = Y.map((v) => v / l);
  let X = [y[1], -y[0], 0]; if (Math.hypot(...X) < 1e-3) X = [1, 0, 0];
  const xl = Math.hypot(...X); X = X.map((v) => v / xl);
  const Z = [X[1] * y[2] - X[2] * y[1], X[2] * y[0] - X[0] * y[2], X[0] * y[1] - X[1] * y[0]];
  return A.basis(X, Y, Z, a);
}
/** Pose everything that moves. */
export function poseAll(buf, parts, W, setPart) {
  const { lock } = W;
  L.GATES.forEach((g, i) => setPart(buf, parts.gates[i], A.mul(A.t(g.hinge[0], 0, g.hinge[1]), A.ry(-lock.gates[i].th))));
  L.PADDLES.forEach((p, i) => setPart(buf, parts.racks[i], A.t(p.at[0] + 0.017, TU + 0.006 + lock.paddles[i].open * 0.045, p.at[1])));
  setPart(buf, parts.sails, A.mul(SAILS_AT(), A.rz(-W.time * 0.55)));
  setPart(buf, parts.washing, WASHING_AT());
  W.keeper.pose(buf, parts.keeper, setPart, W.time);
  const M = W.boat.matrix();
  setPart(buf, parts.boat, M);
  // the steerer ducks as she passes under the bridge
  const near = Math.max(0, 1 - Math.hypot((W.boat.c[0] - L.CHX) / 0.3, (W.boat.c[1] - L.BRIDGE.z) / 0.45));
  W.duck = (W.duck || 0) + (Math.min(1, near * 2.5) - (W.duck || 0)) * 0.15;
  setPart(buf, parts.steerer, A.mul(M, A.t(-BOAT.len / 2 + 0.075, BOAT.gunwale + 0.002, 0), A.s(1, 1 - 0.32 * W.duck, 1), A.rz(-0.35 * W.duck)));
  const pins = pinSpots();
  W.moored.forEach((m, i) => {
    const Mm = m.matrix(), d = MOORED[i], side = Math.cos(d.yaw) > 0 ? -1 : 1;
    setPart(buf, parts.moored[i], Mm);
    [-1, 1].forEach((s, k) => {
      const end = A.apply(Mm, [s * Math.cos(d.yaw) * (d.len / 2 - 0.05), BOAT.gunwale, side * 0.06]);
      setPart(buf, parts.lines[2 * i + k], rope(end, pins[2 * i + k]));
    });
  });
  W.life.pose(buf, parts.life, setPart, W.time);
  parts.ducks.forEach((k, i) => { const b = W.floaters.bodies[i]; setPart(buf, k, b ? A.q(b.q, W.floaters.origin(b)) : null); });
  W.smoke.forEach((q, i) => {
    if (!q.on) { setPart(buf, parts.puffs[i], null); return; }
    const u = q.age / q.life, r = (0.005 + 0.016 * Math.sqrt(u)) * (u > 0.7 ? (1 - u) / 0.3 : 1);
    setPart(buf, parts.puffs[i], A.mul(A.t(...q.p), A.s(r)));
  });
}
