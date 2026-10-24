// Rubber Duck Pool — the island round the courtyard. The courtyard is the engine's square block (layout.js); the land
// beyond its edges is drawn here: a sandy beach running down from the courtyard's front into the sea (a spit curling
// off its left end), a grassy headland on the right with the jetty, low rocky banks under the back and left walls and
// a rocky point at the back right. The coast is a signed distance (isleSd, negative on land) mirrored in WGSL for the
// sea's shallows and surf; the ground's height (isleH) meets the block's own at its edge, so no cut side shows.
// Nothing here moves or is simulated: the ducks and the floats stay in the block.
import { P } from './layout.js';

const { HALF, SEA, TER, clamp, ss, mix } = P;

// the coast: a box with a radius at each corner (front right, back right, front left, back left), a sand spit and a
// rocky point blended in, and a wiggle that grows away from the courtyard (so the shore never comes within a step of it)
const BOX = { c: [1.125, 0.975], b: [7.075, 6.925], r: [2.0, 1.6, 2.4, 0.9] };
const SPIT = { a: [-4.2, 7.55], b: [-8.6, 8.9], r: 0.5 };
const POINT = { a: [6.6, -5.6], b: [8.3, -6.6], r: 0.6 };
/** How far outside the courtyard's square (x, z) is. */
const outside = (x, z) => Math.hypot(Math.max(Math.abs(x) - HALF, 0), Math.max(Math.abs(z) - HALF, 0));
function sdBox(px, pz) {
  const [bx, bz] = BOX.b, [r0, r1, r2, r3] = BOX.r, r = px > 0 ? (pz > 0 ? r0 : r1) : (pz > 0 ? r2 : r3);
  const qx = Math.abs(px) - bx + r, qz = Math.abs(pz) - bz + r;
  return Math.min(Math.max(qx, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) - r;
}
function sdCap(x, z, { a, b, r }) {
  const ex = b[0] - a[0], ez = b[1] - a[1], t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez), 0, 1);
  return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t) - r;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const wiggle = (x, z) => 0.26 * Math.sin(0.83 * x + 0.6 * z + 1.1) + 0.16 * Math.sin(1.9 * x - 1.3 * z + 2.3) + 0.08 * Math.sin(3.7 * x + 2.9 * z + 0.4);
/** Signed distance to the coast (units, negative on land). */
export function isleSd(x, z) {
  let d = sdBox(x - BOX.c[0], z - BOX.c[1]);
  d = smin(d, sdCap(x, z, SPIT), 1.2);
  d = smin(d, sdCap(x, z, POINT), 0.9);
  return d + wiggle(x, z) * ss(0.25, 1.2, outside(x, z));
}
/** How deep the sea floor lies under the sea's level, at sd out from the coast. */
export const seaDepth = (sd) => 0.55 * (1 - Math.exp(-sd / 0.9)) + 0.04 * sd;

/** How much a place is beach (the front) and spit, which run down to the sea slowly; the rest drops to it within a step. */
function beachness(x, z) { return ss(4.4, 5.6, z) * (1 - ss(5.4, 7.0, x)); }
function spitness(x, z) { return ss(-4.6, -6.2, x) * ss(6.4, 7.4, z); }
/** The ground's height anywhere (inside the courtyard, the courtyard's own). */
export function isleH(x, z) {
  if (Math.abs(x) <= HALF && Math.abs(z) <= HALF) return P.terrainH(x, z);
  const sd = isleSd(x, z);
  if (sd > 0) return SEA - seaDepth(sd);
  const e = outside(x, z), edge = P.terrainH(clamp(x, -HALF, HALF), clamp(z, -HALF, HALF));
  const top = mix(edge, TER + 0.08 * ss(-4.4, -5.2, z) - 0.2 * ss(3.0, 5.0, z), ss(0, 0.6, e));
  const bch = beachness(x, z), spit = spitness(x, z), L = mix(mix(0.55, 2.4, bch), 1.0, spit);
  const t = clamp(Math.max(-sd / L, 1 - e / 0.3), 0, 1), soft = Math.max(bch, spit);
  const p = mix(1 - (1 - t) ** 2.4, t, soft);   // banks drop steeply to the water and round off on top; sand runs straight down
  // the rocky banks broken into knuckles and ledges, most of all midway down
  const knobs = (1 - soft) * 4 * t * (1 - t) * ss(0, 0.4, e) * (P.vnoise(x * 2.6 + 11, z * 2.6) - 0.5 + 0.5 * (P.vnoise(x * 6.3, z * 6.3 + 7) - 0.5));
  return SEA + (top - SEA) * p + 0.22 * knobs;
}
export function isleNormal(x, z) {
  const e = 0.02, nx = -(isleH(x + e, z) - isleH(x - e, z)) / (2 * e), nz = -(isleH(x, z + e) - isleH(x, z - e)) / (2 * e), l = Math.hypot(nx, 1, nz);
  return [nx / l, 1 / l, nz / l];
}
/** What covers the ground beyond the courtyard: [sand, grass, rock] (each 0..1, summing to 1). */
export function isleCover(x, z) {
  const n = isleNormal(x, z), h = isleH(x, z), steep = ss(0.86, 0.68, n[1]);
  const turf = (1 - beachness(x, z)) * (1 - spitness(x, z)) * ss(SEA + 0.22, SEA + 0.4, h);
  const rock = Math.max(steep, (1 - beachness(x, z)) * (1 - spitness(x, z)) * ss(SEA + 0.24, SEA + 0.08, h));
  const grass = (1 - rock) * turf, sand = 1 - rock - grass;
  return [sand, grass, rock];
}

/** The land beyond the courtyard as a mesh on a grid 0.1 across (its lines on the block's edges), down to a little
 * under the sea (the sea is drawn over the rest): position, normal, cover (sand, grass, rock), 9 floats a vertex. */
export function isleMesh() {
  const D = 0.1, X0 = -10.2, X1 = 13.6, Z0 = -9.6, Z1 = 11.6, nx = Math.round((X1 - X0) / D), nz = Math.round((Z1 - Z0) / D);
  const vert = [], index = [], id = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const at = (i, j) => [X0 + i * D, Z0 + j * D].map((v) => Math.round(v * 1e4) / 1e4);   // exact on the block's edges
  const H = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const [x, z] = at(i, j); H[j * (nx + 1) + i] = isleH(x, z); }
  const vtx = (i, j) => {
    const k = j * (nx + 1) + i;
    if (id[k] < 0) {
      const [x, z] = at(i, j), seam = Math.abs(Math.abs(x) - HALF) < 1e-6 || Math.abs(Math.abs(z) - HALF) < 1e-6;
      id[k] = vert.length / 9;
      vert.push(x, H[k] + (seam ? 0.004 : 0), z, ...isleNormal(x, z), ...isleCover(x, z));   // a hair over the block's edge, so no crack shows its cut side
    }
    return id[k];
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const [x, z] = at(i, j), [x1, z1] = at(i + 1, j + 1);
    if (x >= -HALF - 1e-6 && x1 <= HALF + 1e-6 && z >= -HALF - 1e-6 && z1 <= HALF + 1e-6) continue;   // the courtyard's own ground
    const hs = [H[j * (nx + 1) + i], H[j * (nx + 1) + i + 1], H[(j + 1) * (nx + 1) + i], H[(j + 1) * (nx + 1) + i + 1]];
    if (Math.max(...hs) < SEA - 0.32) continue;   // deep under the sea
    const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i, j + 1), d = vtx(i + 1, j + 1);
    index.push(a, c, b, b, c, d);
  }
  return { vert: new Float32Array(vert), index: new Uint32Array(index) };
}

/** The jetty: out from the headland along z = JETTY.z, its deck at y, from the top of its steps at x0 to its end at x1. */
export const JETTY = (() => {
  const z = 1.0, y = 1.0;
  let x0 = HALF + 0.5;
  while (isleH(x0 + 0.15, z) > TER - 0.025) x0 += 0.05;   // the steps start where the headland's edge begins to fall
  return { z, y, x0, bays: 3, x1: x0 + 0.6 + 3 + 1.1 };
})();
/** Out to sea from the courtyard's front (front) or right side, at along: the first place a step past the shore (and
 * past the jetty's end, off the headland). */
export function offshore(front, along) {
  let o = HALF;
  while (isleSd(front ? along : o, front ? o : along) < 1.1 && o < 40) o += 0.05;
  return !front && Math.abs(along - JETTY.z) < 0.8 ? Math.max(o, JETTY.x1 + 0.6) : o;
}

// The same coast in WGSL (the sea's shallows, its surf), and the depth of the sea floor there
const f = (v) => v.toFixed(4);
export const ISLE_WGSL = /* wgsl */ `
fn isleOutside(p: vec2f) -> f32 { return length(max(abs(p) - vec2f(HALF), vec2f(0.0))); }
fn isleBox(p: vec2f) -> f32 {
  var r = select(${f(BOX.r[3])}, ${f(BOX.r[2])}, p.y > 0.0);
  if (p.x > 0.0) { r = select(${f(BOX.r[1])}, ${f(BOX.r[0])}, p.y > 0.0); }
  let q = abs(p) - vec2f(${f(BOX.b[0])}, ${f(BOX.b[1])}) + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}
fn isleCap(p: vec2f, a: vec2f, b: vec2f, r: f32) -> f32 {
  let e = b - a;
  let t = clamp(dot(p - a, e) / dot(e, e), 0.0, 1.0);
  return length(p - a - e * t) - r;
}
fn isleSmin(a: f32, b: f32, k: f32) -> f32 { let h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
fn isleSd(p: vec2f) -> f32 {
  var d = isleBox(p - vec2f(${f(BOX.c[0])}, ${f(BOX.c[1])}));
  d = isleSmin(d, isleCap(p, vec2f(${SPIT.a.map(f)}), vec2f(${SPIT.b.map(f)}), ${f(SPIT.r)}), 1.2);
  d = isleSmin(d, isleCap(p, vec2f(${POINT.a.map(f)}), vec2f(${POINT.b.map(f)}), ${f(POINT.r)}), 0.9);
  let w = 0.26 * sin(0.83 * p.x + 0.6 * p.y + 1.1) + 0.16 * sin(1.9 * p.x - 1.3 * p.y + 2.3) + 0.08 * sin(3.7 * p.x + 2.9 * p.y + 0.4);
  return d + w * smoothstep(0.25, 1.2, isleOutside(p));
}
fn seaDepth(sd: f32) -> f32 { return 0.55 * (1.0 - exp(-max(sd, 0.0) / 0.9)) + 0.04 * max(sd, 0.0); }
`;
