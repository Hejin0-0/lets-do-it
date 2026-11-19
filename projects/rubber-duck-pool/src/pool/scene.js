// Pool Jelly — the pool's things as one parts mesh (@lid/diorama: parts.js). Part 0 is everything that never
// moves (scenery.js); the ring over the chosen duck and the hourglass and its sand are parts of their own, posed
// every frame. The ducks and the hats they wear are drawn instanced by their own layers (renderer.js).
import { partsBuilder, A, MAT, setPart } from '@lid/diorama/parts.js';
import { buildStill, buildGlass, buildSandTop, buildSandHeap } from './scenery.js';
import { HAT_MESH, PROPELLER, headTransform, bladeTransform, DESIGNS } from './ducks.js';
import { DUCK_SHAPE } from './duck-shape.js';
import { duckBase, hatBase, HAT_FLOATS } from './renderer.js';
import { P } from './layout.js';

/** Build the whole mesh. Returns { mesh, parts }. */
export function buildScene() {
  const B = partsBuilder();
  const parts = {};
  B.part(0);
  buildStill(B, P.rng(5));
  parts.marker = B.newPart();
  B.col('#fff6c8').mat(MAT.GLOW).lathe(Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [0.05 + Math.cos(a) * 0.006, Math.sin(a) * 0.006]; }), 20);
  B.at(A.t(0, 0.035, 0), () => B.cyl(0.0001, 0.02, 4, 0.012));   // a little arrow down
  parts.glass = B.newPart(); buildGlass(B);
  parts.sandTop = B.newPart(); buildSandTop(B);
  parts.sandHeap = B.newPart(); buildSandHeap(B);
  parts.stream = B.newPart(); B.col('#e8c070').mat(MAT.MATTE).cyl(1, 1, 5, 1, false);
  const mesh = B.done();
  parts.duckBase = duckBase(mesh);   // the ducks' instance data starts after every part's (renderer.js duckBase)
  parts.hatBase = hatBase(mesh);     // the worn hats' and blades' instance data starts after the ducks' (renderer.js hatBase)
  parts.duckRuns = [];
  parts.hatRuns = [];
  return { mesh, parts };
}

/** Pose everything that moves, write each duck's instance data for the duck layer ordered by design, and write one hat
 * instance per duck that wears something ordered by hat (plus one blade instance per propeller wearer). Populates
 * parts.duckRuns and parts.hatRuns. Returns how many ducks. */
export function poseScene(buf, parts, W) {
  const F = W.floaters, o = [0, 0, 0];
  const posed = W.ducks.map((d) => ({ d, m: A.q(d.body.q, F.origin(d.body, o), 1) }));
  const active = posed.slice().sort((a, b) => a.d.colour - b.d.colour);
  const runs = [];
  for (let i = 0; i < active.length; i++) {
    const { d, m } = active[i], spec = DESIGNS[d.colour];
    const at = parts.duckBase + 16 * i;
    for (let k = 0; k < 12; k++) buf[at + k] = m[k];
    buf[at + 12] = d.colour;
    buf[at + 13] = spec?.crown && !d.hat ? 1 : 0;
    buf[at + 14] = spec?.unexpected && !d.hat ? 1 : 0;
    buf[at + 15] = 0;
    if (spec?.unexpected) {
      const ex = DUCK_SHAPE.extras?.[spec.id];
      if (ex && ex.indices > 0) {
        const prev = runs[runs.length - 1];
        if (prev && prev.colour === d.colour) prev.count++;
        else runs.push({ colour: d.colour, id: spec.id, firstInstance: i, count: 1, firstIndex: ex.firstIndex, indices: ex.indices });
      }
    }
  }
  parts.duckRuns = runs;
  const hatted = posed.filter(({ d }) => d.hat > 0 && HAT_MESH.hats[d.hat]?.indexCount > 0).sort((a, b) => a.d.hat - b.d.hat);
  const hatRuns = [], props = [];
  for (let i = 0; i < hatted.length; i++) {
    const { d, m } = hatted[i], spec = HAT_MESH.hats[d.hat], h = headTransform(m);
    const at = parts.hatBase + HAT_FLOATS * i;
    for (let k = 0; k < 12; k++) buf[at + k] = h[k];
    const prev = hatRuns[hatRuns.length - 1];
    if (prev && prev.hat === d.hat) prev.count++;
    else hatRuns.push({ hat: d.hat, id: spec.id, firstInstance: i, count: 1, firstIndex: spec.firstIndex, indexCount: spec.indexCount });
    if (d.hat === PROPELLER) props.push({ d, h });
  }
  if (props.length > 0 && HAT_MESH.blades.indexCount > 0) {
    const firstInstance = hatted.length;
    for (let j = 0; j < props.length; j++) {
      const { d, h } = props[j], b = bladeTransform(h, d.spin || 0);
      const at = parts.hatBase + HAT_FLOATS * (firstInstance + j);
      for (let k = 0; k < 12; k++) buf[at + k] = b[k];
    }
    hatRuns.push({ hat: PROPELLER, id: 'blades', blades: true, firstInstance, count: props.length, firstIndex: HAT_MESH.blades.firstIndex, indexCount: HAT_MESH.blades.indexCount });
  }
  parts.hatRuns = hatRuns;
  const sel = W.selected ? W.selected.body : null;
  setPart(buf, parts.marker, sel ? A.mul(A.t(sel.p[0], sel.p[1] + 0.2 + 0.01 * Math.sin(W.time * 4), sel.p[2]), A.ry(W.time * 1.5)) : null);
  // the hourglass: lifted a little and turned end over end about its middle; the sand runs from the top bulb into the heap
  const g = W.glass, e = g.turn * g.turn * (3 - 2 * g.turn), G = P.SIZE.glass;
  const M = A.mul(A.t(P.HOURGLASS[0], P.TER + G * (0.25 + 0.06 * Math.sin(Math.PI * g.turn)), P.HOURGLASS[1]), A.s(G), A.rx(Math.PI * e), A.t(0, -0.25, 0));
  const top = Math.cbrt(1 - g.s), heap = Math.cbrt(g.s);
  setPart(buf, parts.glass, M);
  setPart(buf, parts.sandTop, top > 0.05 ? A.mul(M, A.t(0, 0.255, 0), A.s(top)) : null);
  setPart(buf, parts.sandHeap, heap > 0.05 ? A.mul(M, A.t(0, 0.035, 0), A.s(heap)) : null);
  setPart(buf, parts.stream, !g.turn && g.s > 0 && g.s < 1 ? A.mul(M, A.seg([0, 0.25, 0], [0, 0.035 + 0.125 * heap, 0], 0.0022)) : null);
  return active.length;
}

/** Issue the duck layer's drawIndexed calls: one draw of the base mesh over all ducks, then one draw per unexpected design run present. */
export function drawDucks(pass, f) {
  const n = f.nDucks ?? f.ducks ?? 0;
  if (n <= 0) return;
  pass.drawIndexed(DUCK_SHAPE.baseIndices, n, 0, 0, 0);
  if (f.duckRuns) {
    for (const r of f.duckRuns) {
      if (r.count > 0 && r.indices > 0) pass.drawIndexed(r.indices, r.count, r.firstIndex, 0, r.firstInstance);
    }
  }
}

/** Issue the hat layer's drawIndexed calls: one draw per hat kind worn over its instance run, plus one for the propeller blades. */
export function drawHats(pass, f) {
  if (!f.hatRuns) return;
  for (const r of f.hatRuns) {
    if (r.count > 0 && r.indexCount > 0) pass.drawIndexed(r.indexCount, r.count, r.firstIndex, 0, r.firstInstance);
  }
}
