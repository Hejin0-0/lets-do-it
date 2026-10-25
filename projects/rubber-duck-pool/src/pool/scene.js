// Pool Jelly — the pool's things as one parts mesh (@lid/diorama: parts.js). Part 0 is everything that never
// moves (scenery.js); the floating toys, every duck slot in each colour and hat, the ring over the chosen duck,
// the hourglass and its sand and the radio are parts of their own, posed every frame.
import { partsBuilder, A, MAT, setPart } from '@lid/diorama/parts.js';
import { buildStill, buildGlass, buildSandTop, buildSandHeap } from './scenery.js';
import { buildDuckParts, poseDuck, MAX_DUCKS, DESIGNS } from './ducks.js';
import { P } from './layout.js';

/** Build the whole mesh. Returns { mesh, parts }. */
export function buildScene() {
  const B = partsBuilder();
  const parts = {};
  B.part(0);
  buildStill(B, P.rng(5));
  parts.ducks = buildDuckParts(B, MAX_DUCKS);
  parts.marker = B.newPart();
  B.col('#fff6c8').mat(MAT.GLOW).lathe(Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [0.05 + Math.cos(a) * 0.006, Math.sin(a) * 0.006]; }), 20);
  B.at(A.t(0, 0.035, 0), () => B.cyl(0.0001, 0.02, 4, 0.012));   // a little arrow down
  parts.glass = B.newPart(); buildGlass(B);
  parts.sandTop = B.newPart(); buildSandTop(B);
  parts.sandHeap = B.newPart(); buildSandHeap(B);
  parts.stream = B.newPart(); B.col('#e8c070').mat(MAT.MATTE).cyl(1, 1, 5, 1, false);
  const mesh = B.done();
  parts.duckBase = mesh.nParts * 12;   // the ducks' instance data starts after every part's (renderer.js duckBase)
  return { mesh, parts };
}

/** Pose everything that moves, and write each duck's instance data for the duck layer after the parts' (renderer.js:
 * its transform, then its design and whether its crown shows; a duck in a hat has none). Returns how many ducks. */
export function poseScene(buf, parts, W) {
  const F = W.floaters, o = [0, 0, 0], bySlot = new Map(W.ducks.map((d) => [d.slot, d]));
  let nDucks = 0;
  parts.ducks.forEach((slot, s) => {
    const d = bySlot.get(s), m = d ? A.q(d.body.q, F.origin(d.body, o), 1) : null;
    poseDuck(buf, slot, m, d ? d.hat : 0, setPart, d ? d.spin || 0 : 0);
    if (!d) return;
    const at = parts.duckBase + 16 * nDucks++;
    for (let i = 0; i < 12; i++) buf[at + i] = m[i];
    buf[at + 12] = d.colour; buf[at + 13] = DESIGNS[d.colour].crown && !d.hat ? 1 : 0; buf[at + 14] = 0; buf[at + 15] = 0;
  });
  const sel = W.selected && W.ducks.includes(W.selected) ? W.selected.body : null;
  setPart(buf, parts.marker, sel ? A.mul(A.t(sel.p[0], sel.p[1] + 0.2 + 0.01 * Math.sin(W.time * 4), sel.p[2]), A.ry(W.time * 1.5)) : null);
  // the hourglass: lifted a little and turned end over end about its middle; the sand runs from the top bulb into the heap
  const g = W.glass, e = g.turn * g.turn * (3 - 2 * g.turn), G = P.SIZE.glass;
  const M = A.mul(A.t(P.HOURGLASS[0], P.TER + G * (0.25 + 0.06 * Math.sin(Math.PI * g.turn)), P.HOURGLASS[1]), A.s(G), A.rx(Math.PI * e), A.t(0, -0.25, 0));
  const top = Math.cbrt(1 - g.s), heap = Math.cbrt(g.s);
  setPart(buf, parts.glass, M);
  setPart(buf, parts.sandTop, top > 0.05 ? A.mul(M, A.t(0, 0.255, 0), A.s(top)) : null);
  setPart(buf, parts.sandHeap, heap > 0.05 ? A.mul(M, A.t(0, 0.035, 0), A.s(heap)) : null);
  setPart(buf, parts.stream, !g.turn && g.s > 0 && g.s < 1 ? A.mul(M, A.seg([0, 0.25, 0], [0, 0.035 + 0.125 * heap, 0], 0.0022)) : null);
  return nDucks;
}
