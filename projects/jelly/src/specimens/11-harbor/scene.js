// Harbor Jelly — the harbour's things as one parts mesh (@lid/diorama: parts.js). Part 0 is everything that
// never moves (town.js); the boxes, the cranes' moving parts, the ship (her radar and propeller), the tug and
// the tow line, the lighthouse's lamp, the moorings, the lifebuoys, the puffs and the creatures are parts of
// their own, posed every frame.
import { partsBuilder, A, MAT, setPart } from '@lid/diorama/parts.js';
import { buildStill, LAMP_AT } from './town.js';
import { buildBox, BOX, shipSlot, laneSlot, createBoxes } from './boxes.js';
import { buildGantry, buildOutreach, buildTrolley, buildSpreader, poseCrane } from './cranes.js';
import { buildShip, buildRadar, buildProp, buildTug, RADAR_AT, PROP_AT } from './ship.js';
import { buildMoorings } from './moorings.js';
import { buildLife } from './life.js';
import { PUFFS, LIFEBUOYS } from './world.js';
import { H } from './layout.js';

function lifebuoy(B) {   // orange and white quarters round a torus
  const R = 0.021, r = 0.0075;
  for (let q = 0; q < 4; q++) {
    B.col(q % 2 ? '#f2f0ea' : '#e8592a').mat(MAT.PAINT).sheet(7, 9, (i, j) => {
      const a = ((q + i / 6) * Math.PI) / 2, b = (j / 8) * Math.PI * 2;
      return [Math.cos(a) * (R + Math.cos(b) * r), Math.sin(b) * r * 0.9, Math.sin(a) * (R + Math.cos(b) * r)];
    });
  }
}
function lamp(B) {
  B.col('#2a2a2c').mat(MAT.METAL).slab(-0.006, -0.01, -0.006, 0.006, 0.01, 0.006);
  B.col('#fff2c0').mat(MAT.GLOW);
  for (const s of [-1, 1]) B.slab(s * 0.006 - 0.002, -0.008, -0.009, s * 0.006 + 0.002, 0.008, 0.009);
}

/** Build the whole mesh. Returns { mesh, parts }. */
export function buildScene() {
  const B = partsBuilder();
  const parts = {};
  B.part(0);
  buildStill(B, H.rng(7));
  parts.boxes = createBoxes().all.map((x) => { const k = B.newPart(); buildBox(B, x.livery); return k; });
  parts.cranes = [0, 1].map((k) => {
    const P = { gantry: B.newPart() }; buildGantry(B, k);
    P.out = B.newPart(); buildOutreach(B, k);
    P.trolley = B.newPart(); buildTrolley(B);
    P.spreader = B.newPart(); buildSpreader(B);
    B.col('#2a2a2c').mat(MAT.METAL);
    P.falls = [0, 1, 2, 3].map(() => { const f = B.newPart(); B.cyl(1, 1, 5, 1, false); return f; });
    B.col(['#c23a2c', '#2e62b5'][k]).mat(MAT.PAINT);
    P.stays = [0, 1].map(() => { const f = B.newPart(); B.cyl(1, 1, 5, 1, false); return f; });
    return P;
  });
  parts.ship = B.newPart(); buildShip(B);
  parts.radar = B.newPart(); buildRadar(B);
  parts.prop = B.newPart(); buildProp(B);
  parts.tug = B.newPart(); buildTug(B);
  parts.line = B.newPart(); B.col('#e8e0c8').mat(MAT.MATTE).cyl(1, 1, 5, 1, false);
  parts.lamp = B.newPart(); lamp(B);
  buildMoorings(B, parts);
  parts.rings = LIFEBUOYS.map(() => { const k = B.newPart(); lifebuoy(B); return k; });
  parts.white = Array.from({ length: PUFFS.white }, () => { const k = B.newPart(); B.col('#f4f6f8').mat(MAT.SMOKE).ball(1, 1, 1, 1); return k; });
  parts.dark = Array.from({ length: PUFFS.dark }, () => { const k = B.newPart(); B.col('#55585e').mat(MAT.SMOKE).ball(1, 1, 1, 1); return k; });
  buildLife(B, parts);
  return { mesh: B.done(), parts };
}

/** Pose everything that moves. */
export function poseScene(buf, parts, W) {
  const M = W.fleet.ship.matrix(), cr = W.cranes.list;
  for (const x of W.boxes.all) {
    let m;
    if (x.at === 'ship') m = A.mul(M, A.t(...shipSlot(x.bay, x.row, x.tier)));
    else if (x.at === 'lane') m = A.t(...laneSlot(x.lane, x.s, x.tier));
    else { const c = cr[x.crane]; m = A.t(c.x + c.sw[0], c.sy - BOX.H, c.tz + c.sw[1]); }   // on the hook, swinging with the spreader
    setPart(buf, parts.boxes[x.id], m);
  }
  cr.forEach((c, k) => poseCrane(buf, parts.cranes[k], c, setPart));
  setPart(buf, parts.ship, M);
  setPart(buf, parts.radar, A.mul(M, A.t(...RADAR_AT), A.ry(W.radarA)));
  setPart(buf, parts.prop, A.mul(M, A.t(...PROP_AT), A.rx(W.propA)));
  setPart(buf, parts.tug, W.fleet.tug.matrix());
  const line = W.story.lineEnds();
  setPart(buf, parts.line, line ? A.seg(line[0], line[1], 0.0018) : null);
  setPart(buf, parts.lamp, A.mul(A.t(...LAMP_AT), A.ry(W.lampA)));
  W.moorings.pose(buf, parts, setPart);
  const F = W.floaters, o = [0, 0, 0];
  W.buoys.forEach((b, i) => setPart(buf, parts.rings[i], A.q(b.q, F.origin(b, o), 1)));
  for (const [pool, ids] of [[W.puffs.white, parts.white], [W.puffs.dark, parts.dark]]) pool.forEach((q, i) => {
    if (!q.on) { setPart(buf, ids[i], null); return; }
    const u = q.age / q.life, r = q.size * (0.4 + 0.9 * Math.sqrt(u)) * (u > 0.7 ? (1 - u) / 0.3 : 1);
    setPart(buf, ids[i], A.mul(A.t(...q.p), A.s(r)));
  });
  W.life.pose(buf, parts.life, setPart);
}
