// Iceberg Jelly — the bay's things as one parts mesh (@lid/diorama: parts.js). Part 0 is everything that
// never moves (the quay, the station, the nests, the sea floor's life, the seracs); the ice, the ship, the
// creatures, the snow and the puffs are parts of their own, posed every frame.
import { partsBuilder, A, MAT, setPart } from '@lid/diorama/parts.js';
import { buildIce } from './ice.js';
import { PUFFS } from './world.js';
import { buildStill, poseStation } from './station.js';
import { buildShip, buildRadar, SHIP } from './ship.js';
import { buildLife } from './life.js';

/** Build the whole mesh. Returns { mesh, parts }; other models join through extra: [(B, parts) => ...]. */
export function buildScene(extra = []) {
  const B = partsBuilder();
  const parts = {};
  B.part(0);
  buildStill(B, parts);
  parts.ice = buildIce(B);
  parts.white = Array.from({ length: PUFFS.white }, () => { const k = B.newPart(); B.col('#f4f6f8').mat(MAT.SMOKE).ball(1, 1, 1, 1); return k; });
  parts.dark = Array.from({ length: PUFFS.dark }, () => { const k = B.newPart(); B.col('#6a6c70').mat(MAT.SMOKE).ball(1, 1, 1, 1); return k; });
  parts.ship = B.newPart(); buildShip(B);
  parts.radar = B.newPart(); buildRadar(B);
  buildLife(B, parts);
  for (const f of extra) f(B, parts);
  return { mesh: B.done(), parts };
}

/** Pose the ice and the puffs, then whatever else poses itself. */
export function poseScene(buf, parts, W, poses = []) {
  const F = W.floaters, o = [0, 0, 0], used = new Set();
  for (const p of W.ice.pieces) { const b = p.body; used.add(p.k); setPart(buf, parts.ice[p.k], A.q(b.q, F.origin(b, o), b.scale)); }
  parts.ice.forEach((k, i) => { if (!used.has(i)) setPart(buf, k, null); });
  for (const [pool, ids] of [[W.puffs.white, parts.white], [W.puffs.dark, parts.dark]]) pool.forEach((q, i) => {
    if (!q.on) { setPart(buf, ids[i], null); return; }
    const u = q.age / q.life, r = q.size * (0.4 + 0.9 * Math.sqrt(u)) * (u > 0.7 ? (1 - u) / 0.3 : 1);
    setPart(buf, ids[i], A.mul(A.t(...q.p), A.s(r)));
  });
  const M = W.ship.v.matrix();
  setPart(buf, parts.ship, M);
  setPart(buf, parts.radar, A.mul(M, A.t(0.05, SHIP.free + 0.3, 0), A.ry(W.time * 2.5)));
  W.life.pose(buf, parts.life, setPart);
  poseStation(buf, parts, W);
  for (const f of poses) f(buf, parts, W);
}
