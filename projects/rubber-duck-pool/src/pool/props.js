// The things for people and the island's dressing, drawn from the models made in Blender (tools/build_props.py:
// public/props/props.bin, its table in prop-shapes.js): where each stands, the one mesh the props layer draws (each
// vertex knowing its placement), and each placement's transform and tint written into inst every frame. The floats,
// the swan, the radio and the boat by the jetty follow the world; the rest stand where they are put: by hand round the
// pools (clear of the ducks' circuit and the swan's way), scattered over the island beyond (rocks along the rocky
// shores, shrubs on the turf, dune grass on the beach), so that the same few models make a varied place.
import { A, MAT, partsBuilder } from '@lid/diorama/parts.js';
import { srgbToLinear } from '@lid/diorama/math.js';
import { PROP_SHAPES } from './prop-shapes.js';
import { COLONNADE, buildArchitecture } from './scenery.js';
import { STATIONS } from './radio.js';
import { P } from './layout.js';
import { isleH, isleSd, isleCover, JETTY } from './island.js';
import { oceanAt } from './ocean.js';

export const PROP_FLOATS = 16;   // four vec4 a placement: its 3x4 transform as rows, then its tint
const k = (v) => v * P.K;

/** Every placement: { model, tint?, follow? ('toy0' 'toy1' 'toy2' 'swan' 'radio': posed each frame) or at, yaw, scale }; an
 * inflatable's ring [R, r, side] (its tube's radius and thickness, the side its neck or palm stands on) lets the props
 * layer let the air out of it (the world's deflate, in place of a tint). */
export const PLACEMENTS = (() => {
  const R = P.rng(11), list = [{ model: 'flamingo', follow: 'toy0', ring: [0.3, 0.103, 1] }, { model: 'palmring', follow: 'toy1', ring: [0.28, 0.11, -1] }, { model: 'ball', follow: 'toy2' },
    { model: 'swan', follow: 'swan', ring: [P.SWAN.R, P.SWAN.r, 1] }, { model: 'radio', follow: 'radio' }];
  const put = (model, x, z, y, yaw = 0, scale = 1, tint) => list.push({ model, at: [x, y ?? P.terrainH(x, z), z], yaw, scale, tint });
  for (const [s, tint] of [[P.SEATS[0], '#f2c62a'], [P.SEATS[1], '#3ab89a']]) put('chair', s.at[0], s.at[1], s.y, s.yaw, 1, tint);   // the seats (P.SEATS)
  put('chair', k(0.95), k(1.65), P.LAWN, -1.75, 1, '#e8405a');
  put('parasol', k(-2.2), k(1.4), P.LAWN, 0.3, 1, '#f2c62a');
  put('parasol', k(0.2), k(2.2), undefined, 1.1, 1, '#e8405a');
  for (const side of [-1, 1]) for (const z of [-1.2, -0.6]) put(z < -1 ? 'palm' : 'palm2', side * k(2.3), k(z), P.TER + 0.08, R() * 6.28, 0.85 + 0.25 * R());   // in the planters
  for (const [x, z] of [[-1.95, 2.15], [-1.7, 2.35], [-1.45, 2.1], [1.3, 2.25], [2.25, 2.0]]) put(R() < 0.5 ? 'palm' : 'palm2', k(x), k(z), undefined, R() * 6.28, 0.8 + 0.3 * R());   // on the beach
  for (let i = 0; i + 1 < COLONNADE.xs.length; i++) put('arch', (COLONNADE.xs[i] + COLONNADE.xs[i + 1]) / 2, COLONNADE.z, COLONNADE.lintel);
  list.push({ model: 'architecture', at: [0, 0, 0], yaw: 0, scale: 1 });   // the walls and the colonnade (built in scenery.js), lit by the lamps
  dress(list);
  return list;
})();

/** Where a lamp's light comes from in its model (x, y, z) and how strong it is. */
const LIGHT = { lantern: [[0, 0.56, 0], 1.0], hanglamp: [[0, -0.27, 0], 0.8], sconce: [[0.11, 0.05, 0], 0.8], torch: [[0, 0.98, 0], 1.0] };

/** The island's dressing (appended to list): the colonnade's lounge, pots and lamps round the pools, the pool house and
 * the jetty on the headland, the beach's things, then rocks and plants scattered where they belong. */
function dress(list) {
  const Q = P.rng(12), TAU = Math.PI * 2, H = P.HALF;
  const taken = [];   // [x, z, r]: kept clear (what stands there, and the ways through)
  const free = (x, z, r) => taken.every(([a, b, q]) => Math.hypot(x - a, z - b) > r + q);
  const put = (model, x, z, y, yaw = 0, scale = 1, tint, keep = 0) => { list.push({ model, at: [x, y ?? isleH(x, z), z], yaw, scale, tint }); if (keep) taken.push([x, z, keep]); };
  const out = (x, z, m = 0.05) => Math.abs(x) > H + m || Math.abs(z) > H + m;   // beyond the courtyard
  const pick = (a) => a[Math.floor(Q() * a.length)];
  // ----- the colonnade: daybeds against the back wall, pots between them, a lantern hung in every arch, flowers over its eaves -----
  const bays = COLONNADE.xs.slice(1).map((x, i) => (x + COLONNADE.xs[i]) / 2), wallZ = P.WALL_B + 0.27;
  bays.forEach((x, i) => {
    if (i % 2) put('daybed', x, wallZ, P.PORCH, 0, 1, ['#2a7fc8', '#e0a826', '#2aa08a', '#d8485a'][(i >> 1) % 4]);
    else put(['potpalm', 'potflower', 'potshrub', 'potpalm'][(i >> 1) % 4], x, wallZ - 0.05, P.PORCH, Q() * TAU, 1.1, ['#e8405a', '#f2a03a', '#f6efe2', '#d8307a'][(i >> 1) % 4]);
    put('hanglamp', x, COLONNADE.z, COLONNADE.lintel - 0.18);
  });
  for (const x of [-4.48, -2.24, 2.24]) put('bougain', x, P.COLS + 0.31, P.TER + 1.67, -Math.PI / 2, 0.75, '#d8307a');
  // ----- the left wall: bougainvillea over its top between the windows, lanterns on it -----
  const wallTop = P.TER + 1.63, wallIn = P.WALL_L + 0.04;
  for (const [z, s, c] of [[-2.45, 1, '#d8307a'], [0.15, 1, '#e0589a'], [3.12, 0.8, '#d8307a']]) put('bougain', wallIn, z, wallTop, 0, s, c);
  for (const [z, y] of [[-1.22, 2.2], [1.48, 2.0], [-4.55, 2.3]]) put('sconce', P.WALL_L, z, y);
  // and over the walls' outer faces, seen from the sea (between the round windows and the palms behind)
  for (const [x, c] of [[-4.3, '#d8307a'], [-1.6, '#e0589a'], [2.2, '#d8307a'], [4.7, '#e0589a']]) put('bougain', x, -H - 0.04, wallTop, Math.PI / 2, 1.1, c);
  for (const [z, c] of [[-4.45, '#e0589a'], [1.35, '#d8307a']]) put('bougain', -H - 0.04, z, wallTop, Math.PI, 1, c);
  // ----- round the pools: pots on the stone and lanterns at the lawn's corners, clear of the swan's way and the toys -----
  put('potflower', 3.05, -3.35, P.TER, 0.4, 1.1, '#f2a03a');
  put('potflower', 4.55, -0.22, P.TER, 1.3, 1.0, '#e8405a');
  put('potpalm', 4.86, 1.66, P.TER, 2.0, 1.15);
  put('potshrub', 3.86, 1.52, P.TER, 0.7, 1.0);
  for (const [x, z] of [[-4.72, 3.36], [3.22, 3.4], [4.96, 3.36]]) put('lantern', x, z);
  // ----- the headland: a gate in the planting, a stepping-stone path to the pool house and the jetty -----
  for (const z of [-0.15, 1.75]) put('lantern', H + 0.22, z, undefined, 0, 1, undefined, 0.3);
  const house = [6.55, -2.6];
  put('poolhouse', house[0], house[1], P.TER - 0.02, -Math.PI / 2, 1, '#2a9ab0');
  taken.push([house[0] - 0.5, house[1], 1.05], [house[0] + 0.5, house[1], 1.05], [house[0], -1.5, 0.45]);
  put('sconce', house[0] + 0.5, house[1] + 0.71, 1.95, -Math.PI / 2);
  const path = (pts, step) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < n; j++) {
        const t = j / n, x = a[0] + (b[0] - a[0]) * t + (Q() - 0.5) * 0.05, z = a[1] + (b[1] - a[1]) * t + (Q() - 0.5) * 0.05;
        put('stepstone', x, z, isleH(x, z) - 0.012, Math.atan2(b[1] - a[1], b[0] - a[0]) + (Q() - 0.5) * 0.5, 0.95 + 0.15 * Q(), '#ffffff', 0.32);
      }
    }
  };
  path([[H + 0.3, 0.8], [6.1, 0.85], [6.8, 1.0], [JETTY.x0 - 0.15, JETTY.z]], 0.36);
  path([[6.1, 0.72], [6.45, 0.0], [6.55, -0.75], [house[0], -1.42]], 0.36);
  // the jetty: steps down onto the deck, three bays, the end with its ladder; lanterns along it; a rowing boat tied up
  put('jettysteps', JETTY.x0, JETTY.z, JETTY.y);
  for (let b = 0; b < JETTY.bays; b++) put('jetty', JETTY.x0 + 0.6 + b, JETTY.z, JETTY.y);
  put('jettyend', JETTY.x0 + 0.6 + JETTY.bays, JETTY.z, JETTY.y);
  for (const [x, s] of [[JETTY.x0 + 1.65, -1], [JETTY.x0 + 3.6, 1], [JETTY.x1 - 0.12, -1]]) put('lantern', x, JETTY.z + s * 0.4, JETTY.y);
  list.push({ model: 'boat', follow: 'boat', at: [JETTY.x1 - 0.55, P.SEA, JETTY.z + 0.84], yaw: 0.05, scale: 1 });
  taken.push([JETTY.x0 + 2.4, JETTY.z, 0.5], [JETTY.x0 + 3.4, JETTY.z, 0.5], [JETTY.x0 + 4.4, JETTY.z, 0.6]);
  // ----- the beach: a cabana, loungers under parasols facing the sea, torches, driftwood, rock pools on the spit -----
  put('cabana', 4.35, 6.05, isleH(4.35, 6.05) - 0.035, 0.25, 1, '#2a9ab0', 0.85);
  for (const [x, z, c] of [[-1.05, 6.2, '#f2c62a'], [-0.25, 6.2, '#2a8ad8'], [2.3, 6.3, '#e8405a']]) put('lounger', x, z, isleH(x, z) + 0.01, Math.PI / 2 + (Q() - 0.5) * 0.15, 1, c, 0.55);
  put('parasol', -0.65, 5.85, undefined, 0.4, 1, '#3ab89a', 0.3);
  put('parasol', 2.95, 6.05, undefined, 1.4, 1, '#f2c62a', 0.3);
  for (const [x, z] of [[-3.3, 6.4], [-1.9, 6.85], [1.0, 6.9], [3.4, 6.95], [5.75, 6.7]]) put('torch', x, z, undefined, Q() * TAU, 1, undefined, 0.2);
  put('driftwood', -6.2, 8.0, undefined, 0.5, 1.3, undefined, 0.5);
  put('driftwood', 2.1, 7.25, undefined, 2.6, 1.0, undefined, 0.4);
  put('rockpool', -7.35, 8.52, undefined, 0.9, 1.4, '#ffffff', 0.5);
  put('rockpool', -5.3, 7.85, undefined, 2.2, 1.0, '#ffffff', 0.4);
  // ----- palms: tall ones behind the walls (their crowns over the colonnade and the window wall, leaning out), some on the headland -----
  for (const [x, z, yaw, s, m] of [[-3.3, -5.62, Math.PI / 2, 1.42, 'palm'], [0.55, -5.66, Math.PI / 2 + 0.4, 1.3, 'palm2'], [3.75, -5.58, Math.PI / 2 - 0.3, 1.45, 'palm'],
    [-5.66, -0.35, Math.PI + 0.3, 1.35, 'palm'], [-5.6, 2.55, Math.PI - 0.2, 1.25, 'palm2'], [7.35, 2.75, -0.6, 1.15, 'palm'], [6.45, 3.55, 0.9, 1.0, 'palm2'],
    [7.75, -0.95, 0.2, 1.2, 'palm2'], [5.95, -4.35, -1.2, 1.1, 'palm'], [-6.9, 8.25, 2.6, 0.95, 'palm'], [6.3, 5.9, -0.3, 0.9, 'palm2']]) put(m, x, z, isleH(x, z) - 0.02, yaw, s, undefined, 0.35);
  // ----- scattered: what grows and lies where -----
  const scatter = (models, n, box, ok, { r = 0.25, scale = [0.8, 1.2], sink = 0, tints } = {}) => {
    for (let i = 0, t = 0; i < n && t < n * 200; t++) {
      const x = box[0] + Q() * (box[2] - box[0]), z = box[1] + Q() * (box[3] - box[1]), s = scale[0] + Q() * (scale[1] - scale[0]);
      if (!ok(x, z) || !free(x, z, r * s)) continue;
      taken.push([x, z, r * s]);
      put(pick(models), x, z, isleH(x, z) - sink * s, Q() * TAU, s, tints ? pick(tints) : undefined);
      i++;
    }
  };
  const ISLE = [-9.4, -8.0, 9.4, 10.0], sd = isleSd, cover = isleCover;
  const sandy = (x, z) => z > 4.2 && x > -7.4 && x < 6.4;   // the beach and the spit (but its tip)
  const turf = (x, z) => out(x, z, 0.12) && cover(x, z)[1] > 0.8;
  const bank = (x, z) => turf(x, z) || (out(x, z) && cover(x, z)[2] > 0.5 && sd(x, z) < -0.25);
  const stone = ['#ffffff', '#f2ece2', '#e4ddd2', '#fff8ee', '#d8d2c8'], blooms = ['#e8405a', '#f2a6c8', '#f6efe2', '#f08ab0'];
  scatter(['shrub', 'flowerbush', 'oleander', 'shrub', 'fern'], 16, [H + 0.1, -4.6, H + 0.9, 3.6], (x, z) => turf(x, z) && (z < 0.05 || z > 2.0), { r: 0.2, scale: [0.9, 1.3], tints: blooms });
  scatter(['shrub', 'shrub2', 'flowerbush', 'fern', 'agave', 'oleander'], 30, [H, -5.0, 8.6, 4.4], turf, { r: 0.3, scale: [0.8, 1.3], tints: blooms });
  scatter(['agave', 'shrub2', 'tuft', 'fern', 'agave'], 26, [-7.0, -7.0, 6.0, -5.2], bank, { r: 0.22, scale: [0.8, 1.3] });
  scatter(['agave', 'shrub2', 'tuft', 'fern'], 18, [-7.2, -5.2, -5.2, 4.6], bank, { r: 0.22, scale: [0.8, 1.3] });
  scatter(['rock', 'rock2', 'ledge'], 18, [5.4, -7.4, 9.4, -4.0], (x, z) => out(x, z) && sd(x, z) > -0.7 && sd(x, z) < 0.35, { r: 0.28, scale: [1.0, 2.4], sink: 0.12, tints: stone });
  scatter(['rock', 'rock2', 'rock', 'ledge'], 140, ISLE, (x, z) => out(x, z) && !sandy(x, z) && sd(x, z) > -0.32 && sd(x, z) < 0.3, { r: 0.2, scale: [0.6, 2.2], sink: 0.12, tints: stone });
  scatter(['ledge', 'rock', 'rock2'], 50, ISLE, (x, z) => out(x, z, 0.25) && !sandy(x, z) && sd(x, z) > -0.6 && sd(x, z) < -0.12 && cover(x, z)[2] > 0.3, { r: 0.2, scale: [0.7, 1.8], sink: 0.1, tints: stone });
  scatter(['rock2', 'rock'], 8, [-9.2, 7.6, -7.2, 9.8], (x, z) => sd(x, z) > -0.4 && sd(x, z) < 0.25, { r: 0.22, scale: [0.6, 1.4], sink: 0.12, tints: stone });
  scatter(['ledge', 'rock'], 7, [5.4, -4.5, 8.4, 4.0], (x, z) => out(x, z, 0.3) && cover(x, z)[1] > 0.9, { r: 0.4, scale: [0.9, 1.5], sink: 0.16, tints: stone });
  scatter(['tuft'], 34, [-6.0, 5.22, 6.6, 6.4], (x, z) => out(x, z, 0.02) && sd(x, z) < -0.9, { r: 0.16, scale: [0.8, 1.5] });
  scatter(['tuft'], 8, [-8.6, 7.2, -4.2, 9.4], (x, z) => sd(x, z) < -0.3, { r: 0.16, scale: [0.7, 1.2] });
  scatter(['shell', 'shell', 'starfish', 'shell'], 16, [-8.0, 6.6, 6.0, 8.6], (x, z) => sandy(x, z) && sd(x, z) < -0.12 && sd(x, z) > -0.7, { r: 0.12, scale: [0.9, 1.4] });
}

/** The props' models (props.bin, fetched next to the page) as the one mesh the layer draws: position, normal, colour,
 * kind and the placement's number, 11 floats a vertex. */
export async function loadProps() {
  const r = await fetch(new URL('props/props.bin', document.baseURI));
  if (!r.ok) throw new Error(`props/props.bin: ${r.status}`);
  const bin = await r.arrayBuffer(), nv = PROP_SHAPES.vertices * 10;
  if (bin.byteLength !== (nv + PROP_SHAPES.indices) * 4) throw new Error('props/props.bin does not match prop-shapes.js: run npm run assets:props');
  const models = { ...Object.fromEntries(Object.entries(PROP_SHAPES.models).map(([k, m]) => [k, { ...m, V: new Float32Array(bin, 0, nv), I: new Uint32Array(bin, nv * 4, PROP_SHAPES.indices) }])), architecture: architecture() };
  const ms = PLACEMENTS.map((p) => models[p.model]);
  const vert = new Float32Array(ms.reduce((n, m) => n + m.vertices, 0) * 11), index = new Uint32Array(ms.reduce((n, m) => n + m.indices, 0));
  let v = 0, i = 0;
  ms.forEach((m, pi) => {
    for (let q = 0; q < m.vertices; q++) { vert.set(m.V.subarray((m.vertex + q) * 10, (m.vertex + q + 1) * 10), (v + q) * 11); vert[(v + q) * 11 + 10] = pi; }
    for (let q = 0; q < m.indices; q++) index[i + q] = m.I[m.index + q] + v;
    v += m.vertices; i += m.indices;
  });
  return { vert, index };
}
/** The courtyard's walls and colonnade (scenery.js) as a model of the props' kind: plaster where they are matte, plastic where painted. */
function architecture() {
  const B = partsBuilder();
  buildArchitecture(B);
  const { vert: pv, index: I } = B.done(), n = pv.length / 11, V = new Float32Array(n * 10);
  for (let q = 0; q < n; q++) { V.set(pv.subarray(q * 11, q * 11 + 9), q * 10); V[q * 10 + 9] = pv[q * 11 + 9] === MAT.MATTE ? 6 : 4; }
  return { vertex: 0, vertices: n, index: 0, indices: I.length, V, I };
}

/** Where each lamp's light comes from (block-local x, y, z) and how strong it is: the renderer lights the ground, the grass
 * and the props round them by night. */
export const LAMPS = PLACEMENTS.filter((p) => LIGHT[p.model]).map((p) => [...A.apply(A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale)), LIGHT[p.model][0]), LIGHT[p.model][1]]);

const TINTS = PLACEMENTS.map((p) => (p.tint ? srgbToLinear(p.tint) : [1, 1, 1]));
const FIXED = PLACEMENTS.map((p) => (p.at ? A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale)) : null));

/** The boat by the jetty, riding the sea as it is drawn there (the waves summed as a flyer's, calmed as the shallows calm them). */
function boatAt(p, t) {
  const [x, , z] = p.at, calm = 0.4 + 0.6 * P.ss(0, 1, isleSd(x, z)), [h, gx, gz] = oceanAt(x, z, t);
  return A.mul(A.t(x, P.SEA + h * calm, z), A.ry(p.yaw + 0.04 * Math.sin(t * 0.3)), A.rz(Math.atan(gx * calm) * 0.8), A.rx(-Math.atan(gz * calm) * 0.8));
}

/** Write every placement's transform and tint into buf from base (floats), the moving ones from the world W. */
export function poseProps(buf, base, W) {
  const F = W.floaters, o = [0, 0, 0];
  const bpm = W.station ? STATIONS[W.station - 1].bpm : 0, bob = bpm ? Math.abs(Math.sin(W.time * Math.PI * (bpm / 60))) : 0;
  PLACEMENTS.forEach((p, i) => {
    let m = FIXED[i], body = null;
    if (p.follow === 'swan') { body = W.swan; m = A.q(W.swan.q, F.origin(W.swan, o), 1); }
    else if (p.follow === 'radio') m = A.mul(A.t(P.RADIO[0], P.TER + 0.012 * bob, P.RADIO[1]), A.ry(0.4 + 0.03 * Math.sin(W.time * Math.PI * (bpm / 120))), A.s(1, 1 + 0.03 * bob, 1));   // bobbing to its station's beat
    else if (p.follow === 'boat') m = boatAt(p, W.time);
    else if (p.follow) { body = W.toys[+p.follow.slice(3)]; m = A.q(body.q, F.origin(body, o), 1); }
    buf.set(m, base + PROP_FLOATS * i);
    buf.set(p.ring ? [...p.ring, body.deflate] : [...TINTS[i], 0], base + PROP_FLOATS * i + 12);
  });
}
