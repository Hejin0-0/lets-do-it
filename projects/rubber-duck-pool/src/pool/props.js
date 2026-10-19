// The things for people, drawn from the models made in Blender (tools/build_props.py: public/props/props.bin, its
// table in prop-shapes.js): where each stands, the one mesh the props layer draws (each vertex knowing its placement),
// and each placement's transform and tint written into inst every frame. The floats, the swan and the radio follow the
// world; the chairs, parasols, palms and the colonnade's arches stand where they are put.
import { A } from '@lid/diorama/parts.js';
import { srgbToLinear } from '@lid/diorama/math.js';
import { PROP_SHAPES } from './prop-shapes.js';
import { COLONNADE } from './scenery.js';
import { STATIONS } from './radio.js';
import { P } from './layout.js';

export const PROP_FLOATS = 16;   // four vec4 a placement: its 3x4 transform as rows, then its tint
const k = (v) => v * P.K;

/** Every placement: { model, tint?, follow? ('toy0' 'toy1' 'toy2' 'swan' 'radio': posed each frame) or at, yaw, scale }. */
export const PLACEMENTS = (() => {
  const R = P.rng(11), list = [{ model: 'flamingo', follow: 'toy0' }, { model: 'palmring', follow: 'toy1' }, { model: 'ball', follow: 'toy2' }, { model: 'swan', follow: 'swan' }, { model: 'radio', follow: 'radio' }];
  const put = (model, x, z, y, yaw = 0, scale = 1, tint) => list.push({ model, at: [x, y ?? P.terrainH(x, z), z], yaw, scale, tint });
  for (const [s, tint] of [[P.SEATS[0], '#f2c62a'], [P.SEATS[1], '#3ab89a']]) put('chair', s.at[0], s.at[1], s.y, s.yaw, 1, tint);   // the seats (P.SEATS)
  put('chair', k(0.95), k(1.65), P.LAWN, -1.75, 1, '#e8405a');
  put('parasol', k(-2.2), k(1.4), P.LAWN, 0.3, 1, '#f2c62a');
  put('parasol', k(0.2), k(2.2), undefined, 1.1, 1, '#e8405a');
  for (const side of [-1, 1]) for (const z of [-1.2, -0.6]) put(z < -1 ? 'palm' : 'palm2', side * k(2.3), k(z), P.TER + 0.08, R() * 6.28, 0.85 + 0.25 * R());   // in the planters
  for (const [x, z] of [[-1.95, 2.15], [-1.7, 2.35], [-1.45, 2.1], [1.3, 2.25], [2.25, 2.0]]) put(R() < 0.5 ? 'palm' : 'palm2', k(x), k(z), undefined, R() * 6.28, 0.8 + 0.3 * R());   // on the beach
  for (let i = 0; i + 1 < COLONNADE.xs.length; i++) put('arch', (COLONNADE.xs[i] + COLONNADE.xs[i + 1]) / 2, COLONNADE.z, COLONNADE.lintel);
  return list;
})();

/** The props' models (props.bin, fetched next to the page) as the one mesh the layer draws: position, normal, colour,
 * kind and the placement's number, 11 floats a vertex. */
export async function loadProps() {
  const r = await fetch(new URL('props/props.bin', document.baseURI));
  if (!r.ok) throw new Error(`props/props.bin: ${r.status}`);
  const bin = await r.arrayBuffer(), nv = PROP_SHAPES.vertices * 10;
  if (bin.byteLength !== (nv + PROP_SHAPES.indices) * 4) throw new Error('props/props.bin does not match prop-shapes.js: run npm run assets:props');
  const V = new Float32Array(bin, 0, nv), I = new Uint32Array(bin, nv * 4, PROP_SHAPES.indices);
  const ms = PLACEMENTS.map((p) => PROP_SHAPES.models[p.model]);
  const vert = new Float32Array(ms.reduce((n, m) => n + m.vertices, 0) * 11), index = new Uint32Array(ms.reduce((n, m) => n + m.indices, 0));
  let v = 0, i = 0;
  ms.forEach((m, pi) => {
    for (let q = 0; q < m.vertices; q++) { vert.set(V.subarray((m.vertex + q) * 10, (m.vertex + q + 1) * 10), (v + q) * 11); vert[(v + q) * 11 + 10] = pi; }
    for (let q = 0; q < m.indices; q++) index[i + q] = I[m.index + q] + v;
    v += m.vertices; i += m.indices;
  });
  return { vert, index };
}

const TINTS = PLACEMENTS.map((p) => (p.tint ? srgbToLinear(p.tint) : [1, 1, 1]));
const FIXED = PLACEMENTS.map((p) => (p.at ? A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale)) : null));

/** Write every placement's transform and tint into buf from base (floats), the moving ones from the world W. */
export function poseProps(buf, base, W) {
  const F = W.floaters, o = [0, 0, 0];
  const bpm = W.station ? STATIONS[W.station - 1].bpm : 0, bob = bpm ? Math.abs(Math.sin(W.time * Math.PI * (bpm / 60))) : 0;
  PLACEMENTS.forEach((p, i) => {
    let m = FIXED[i];
    if (p.follow === 'swan') m = A.q(W.swan.q, F.origin(W.swan, o), 1);
    else if (p.follow === 'radio') m = A.mul(A.t(P.RADIO[0], P.TER + 0.012 * bob, P.RADIO[1]), A.ry(0.4 + 0.03 * Math.sin(W.time * Math.PI * (bpm / 120))), A.s(1, 1 + 0.03 * bob, 1));   // bobbing to its station's beat
    else if (p.follow) { const b = W.toys[+p.follow.slice(3)]; m = A.q(b.q, F.origin(b, o), 1); }
    buf.set(m, base + PROP_FLOATS * i);
    buf.set([...TINTS[i], 0], base + PROP_FLOATS * i + 12);
  });
}
