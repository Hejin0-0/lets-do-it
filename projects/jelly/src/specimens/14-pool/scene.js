// Pool Jelly — the pool's things as one parts mesh (src/core/diorama/parts.js). Part 0 is everything that never
// moves (scenery.js); the floating toys, every duck slot in each colour and hat, the ring over the chosen duck,
// the fountain's drops, the hourglass and its sand and the radio are parts of their own, posed every frame.
import { partsBuilder, A, MAT, setPart } from '../../core/diorama/parts.js';
import { buildStill, buildToy, buildGlass, buildSandTop, buildSandHeap, buildRadio } from './scenery.js';
import { buildDuckParts, poseDuck, MAX_DUCKS } from './ducks.js';
import { SPRAY, TOYS } from './world.js';
import { P } from './layout.js';

/** Build the whole mesh. Returns { mesh, parts }. */
export function buildScene() {
  const B = partsBuilder();
  const parts = {};
  B.part(0);
  buildStill(B, P.rng(5));
  parts.toys = TOYS.map((t) => { const k = B.newPart(); buildToy(B, t.kind); return k; });
  parts.ducks = buildDuckParts(B, MAX_DUCKS);
  parts.marker = B.newPart();
  B.col('#fff6c8').mat(MAT.GLOW).lathe(Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [0.05 + Math.cos(a) * 0.006, Math.sin(a) * 0.006]; }), 20);
  B.at(A.t(0, 0.035, 0), () => B.cyl(0.0001, 0.02, 4, 0.012));   // a little arrow down
  parts.spray = Array.from({ length: SPRAY }, () => { const k = B.newPart(); B.col('#eef8fc').mat(MAT.SMOKE).ball(1, 1, 1, 0); return k; });
  parts.glass = B.newPart(); buildGlass(B);
  parts.sandTop = B.newPart(); buildSandTop(B);
  parts.sandHeap = B.newPart(); buildSandHeap(B);
  parts.stream = B.newPart(); B.col('#e8c070').mat(MAT.MATTE).cyl(1, 1, 5, 1, false);
  parts.radio = B.newPart(); buildRadio(B);
  return { mesh: B.done(), parts };
}

/** Pose everything that moves. */
export function poseScene(buf, parts, W) {
  const F = W.floaters, o = [0, 0, 0], bySlot = new Map(W.ducks.map((d) => [d.slot, d]));
  W.toys.forEach((b, i) => setPart(buf, parts.toys[i], A.q(b.q, F.origin(b, o), 1)));
  parts.ducks.forEach((slot, s) => {
    const d = bySlot.get(s);
    poseDuck(buf, slot, d && d.state !== 'pipe' ? A.q(d.body.q, F.origin(d.body, o), 1) : null, d ? d.colour : 0, d ? d.hat : 0, setPart);
  });
  const sel = W.selected && W.ducks.includes(W.selected) ? W.selected.body : null;
  setPart(buf, parts.marker, sel ? A.mul(A.t(sel.p[0], sel.p[1] + 0.2 + 0.01 * Math.sin(W.time * 4), sel.p[2]), A.ry(W.time * 1.5)) : null);
  W.spray.forEach((q, i) => setPart(buf, parts.spray[i], q.on ? A.mul(A.t(...q.p), A.s(q.size)) : null));
  // the hourglass: lifted a little and turned end over end about its middle; the sand runs from the top bulb into the heap
  const g = W.glass, e = g.turn * g.turn * (3 - 2 * g.turn);
  const M = A.mul(A.t(P.HOURGLASS[0], P.TER + 0.25 + 0.06 * Math.sin(Math.PI * g.turn), P.HOURGLASS[1]), A.rx(Math.PI * e), A.t(0, -0.25, 0));
  const top = Math.cbrt(1 - g.s), heap = Math.cbrt(g.s);
  setPart(buf, parts.glass, M);
  setPart(buf, parts.sandTop, top > 0.05 ? A.mul(M, A.t(0, 0.255, 0), A.s(top)) : null);
  setPart(buf, parts.sandHeap, heap > 0.05 ? A.mul(M, A.t(0, 0.035, 0), A.s(heap)) : null);
  setPart(buf, parts.stream, !g.turn && g.s > 0 && g.s < 1 ? A.mul(M, A.seg([0, 0.25, 0], [0, 0.035 + 0.125 * heap, 0], 0.0022)) : null);
  // the radio: bobbing to its own tune while it plays
  const bob = W.radio ? Math.abs(Math.sin(W.time * Math.PI * (112 / 60))) : 0;
  setPart(buf, parts.radio, A.mul(A.t(P.RADIO[0], P.TER + 0.004 * bob, P.RADIO[1]), A.ry(0.4 + 0.03 * Math.sin(W.time * Math.PI * (56 / 60)) * (W.radio ? 1 : 0)), A.s(1, 1 + 0.03 * bob, 1)));
}
