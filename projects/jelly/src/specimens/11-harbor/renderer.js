// Harbor Jelly's renderer: the shared diorama renderer in a soft northern light, with the harbour's ground (the
// terminal's asphalt with its painted lines and concrete rail strips; the fishing quay's cobbles; the quay wall,
// concrete on the left and dressed stone on the right, crusted with mussels and weed under the water; the
// breakwater's rubble; the grassy hill; pale sand and drifts of silt on the floor) and its cut faces (candy
// strata, the yard's slab and fill, the breakwater's rubble core). Everything else is parts.
import { createDioramaRenderer } from '../../core/diorama/renderer.js';
import { PARTS_WGSL, partsLayer } from '../../core/diorama/parts.js';
import { H } from './layout.js';

/** Palette slots beyond the core's (0 grass, 1–5 strata, 6–9 pebbles). */
export const PAL = { SAND: 10, SILT: 11, ASPHALT: 12, CONCRETE: 13, COBBLE: 14, STONE: 15, ROCK: 16, MUSSEL: 17, WEED: 18, LINE: 19, RAIL: 20, SOIL: 21 };

const f = (v) => v.toFixed(4);
const WGSL = /* wgsl */ `
const SL: f32 = ${f(H.SL)};
const DECK: f32 = ${f(H.DECK)};
const QZ: f32 = ${f(H.QZ)};
const XT: f32 = ${f(H.XT)};
const HILL: f32 = ${f(H.HILL)};
const RS: f32 = ${f(H.RS)};
const RL: f32 = ${f(H.RL)};
const YZ: f32 = ${f(H.YZ)};
const BR0: vec2f = vec2f(${f(H.BREAK[0][0])}, ${f(H.BREAK[0][1])});
const BR1: vec2f = vec2f(${f(H.BREAK[1][0])}, ${f(H.BREAK[1][1])});
fn breakD(p: vec2f) -> f32 { let e = BR1 - BR0; let t = clamp(dot(p - BR0, e) / dot(e, e), 0.0, 1.0); return length(p - BR0 - e * t); }
// blocks in courses: masonry, cobbles; w and h the block size, j the joint's share
fn courses(u: f32, v: f32, w: f32, h: f32, j: f32, c: vec3f) -> vec3f {
  let row = floor(v / h);
  let uu = u / w + fract(row * 0.5) + 0.31 * hash21(vec2f(row, 1.0));
  let fu = fract(uu); let fv = fract(v / h);
  let joint = max(1.0 - smoothstep(j * 0.5, j, min(fu, 1.0 - fu)), 1.0 - smoothstep(j * 0.7, j * 1.4, min(fv, 1.0 - fv)));
  let b = c * (0.76 + 0.36 * hash21(vec2f(floor(uu), row))) * (0.9 + 0.14 * vnoise(vec2f(u, v) * 240.0));
  return mix(b, b * 0.45, joint);
}
fn rubble(p: vec2f, c: vec3f) -> vec3f {   // rocks with dark gaps between them
  let g = p * 34.0; let i = floor(g); let fp = fract(g) - 0.5;
  let o = vec2f(hash21(i + 3.1), hash21(i + 7.3)) - 0.5;
  let rock = 1.0 - smoothstep(0.38, 0.52, length(fp - o * 0.35));
  return mix(c * 0.35, c * (0.7 + 0.5 * hash21(i)) * (0.85 + 0.2 * vnoise(p * 160.0)), rock);
}
fn groundTop(lp: vec3f, n: vec3f, e: vec4f) -> Surf {
  let x = lp.xz;
  let ws = water(x);
  let under = ws.x - lp.y;
  let nl = normalize((U.Minv * vec4f(n, 0.0)).xyz);
  var s: Surf;
  s.n = n; s.rough = 0.88; s.f0 = 0.03;
  // the hill's grass: two greens, a lighter flush
  var c = U.pal[0].rgb * (0.8 + 0.26 * vnoise(x * 42.0) + 0.14 * vnoise(x * 8.0 + 3.0));
  c = mix(c, c * vec3f(1.1, 1.08, 0.82), smoothstep(0.65, 0.9, vnoise(x * 3.1 + 7.0)) * 0.5);
  let steep = 1.0 - smoothstep(0.35, 0.6, nl.y);
  let bd = breakD(x);
  if (lp.z < QZ + 0.02 && lp.z > HILL - 0.02 && steep < 0.5) {
    if (lp.x < XT) {   // the terminal: asphalt, painted lines, concrete strips with the crane rails, a concrete cope
      c = U.pal[${PAL.ASPHALT}].rgb * (0.8 + 0.3 * vnoise(x * 90.0) + 0.1 * vnoise(x * 9.0));
      let edge = 1.0 - smoothstep(0.002, 0.004, min(abs(lp.z - (YZ + 0.03)), abs(lp.z - (YZ - 0.03))));
      let tick = (1.0 - smoothstep(0.002, 0.004, abs(fract((lp.x + 2.6) / 0.12 + 0.5) - 0.5) * 0.12)) * step(abs(lp.z - YZ), 0.03);
      c = mix(c, U.pal[${PAL.LINE}].rgb, max(edge, tick) * 0.85);
      let strip = max(1.0 - smoothstep(0.022, 0.028, abs(lp.z - RS)), 1.0 - smoothstep(0.022, 0.028, abs(lp.z - RL)));
      c = mix(c, U.pal[${PAL.CONCRETE}].rgb * (0.85 + 0.2 * vnoise(x * 120.0)), max(strip, 1.0 - smoothstep(QZ - 0.045, QZ - 0.035, lp.z)));
      let rail = max(1.0 - smoothstep(0.002, 0.0035, abs(lp.z - RS)), 1.0 - smoothstep(0.002, 0.0035, abs(lp.z - RL)));
      c = mix(c, U.pal[${PAL.RAIL}].rgb, rail);
      s.rough = 0.8;
    } else {   // the fishing quay: cobbles, a dressed-stone cope along the edge
      c = courses(lp.x, lp.z, 0.026, 0.02, 0.12, U.pal[${PAL.COBBLE}].rgb);
      c = mix(c, courses(lp.x, lp.z, 0.08, 0.04, 0.05, U.pal[${PAL.STONE}].rgb), 1.0 - smoothstep(QZ - 0.05, QZ - 0.04, lp.z));
      s.rough = 0.75;
    }
  }
  // the quay wall: concrete in lifts on the terminal, dressed stone on the fishing quay; mussels and weed under water
  if (steep > 0.5 && abs(lp.z - QZ) < 0.05) {
    var w: vec3f;
    if (lp.x < XT) { w = U.pal[${PAL.CONCRETE}].rgb * (0.82 + 0.18 * vnoise(vec2f(lp.x * 80.0, lp.y * 40.0))) * (1.0 - 0.25 * smoothstep(0.49, 0.5, abs(fract(lp.y / 0.06) - 0.5))); }
    else { w = courses(lp.x, lp.y, 0.07, 0.035, 0.06, U.pal[${PAL.STONE}].rgb); }
    let wet = smoothstep(-0.03, 0.01, under);
    let mus = wet * smoothstep(0.35, 0.6, vnoise(vec2f(lp.x * 140.0, lp.y * 90.0)) + 0.4 * smoothstep(0.0, 0.06, under));
    w = mix(w, U.pal[${PAL.MUSSEL}].rgb * (0.7 + 0.6 * hash21(floor(vec2f(lp.x, lp.y) * 400.0))), mus * 0.9);
    w = mix(w, U.pal[${PAL.WEED}].rgb, wet * smoothstep(0.5, 0.75, vnoise(vec2f(lp.x * 50.0, lp.y * 12.0))) * 0.85);
    c = w; s.rough = mix(0.8, 0.45, wet);
  }
  // the breakwater: rubble, a concrete crest, weed below the water
  if (bd < 0.5 && lp.z > QZ + 0.02) {
    var r = rubble(x, U.pal[${PAL.ROCK}].rgb);
    r = mix(r, U.pal[${PAL.CONCRETE}].rgb * (0.85 + 0.2 * vnoise(x * 70.0)), 1.0 - smoothstep(0.06, 0.075, bd));
    r = mix(r, U.pal[${PAL.WEED}].rgb * (0.6 + 0.5 * vnoise(x * 40.0)), smoothstep(-0.01, 0.04, under) * smoothstep(0.4, 0.7, vnoise(x * 18.0)) * 0.8);
    c = mix(c, r, 1.0 - smoothstep(0.42, 0.5, bd));
    s.rough = 0.7;
  }
  // the floor: pale sand with ripples, drifts of silt, the odd pebble
  if (under > 0.02 && bd > 0.42 && steep < 0.5) {
    var sd = U.pal[${PAL.SAND}].rgb * (0.88 + 0.06 * sin(dot(x, vec2f(52.0, 31.0)) + 3.0 * vnoise(x * 4.0)) + 0.1 * vnoise(x * 60.0));
    sd = mix(sd, U.pal[${PAL.SILT}].rgb * (0.85 + 0.2 * vnoise(x * 30.0)), smoothstep(0.45, 0.75, vnoise(x * 1.8 + 4.0)) * 0.8);
    let cell = floor(x * 90.0);
    sd = mix(sd, U.pal[6u + u32(hash21(cell + 2.0) * 3.99)].rgb * 0.8, step(0.975, hash21(cell)));
    c = mix(c, sd, smoothstep(0.02, 0.06, under));
  }
  s.alb = c;
  return s;
}
fn section(lp: vec3f, u: f32, top: f32) -> vec3f {
  let c = strata(u, lp.y, top);
  let ws = water(lp.xz);
  let d = top - lp.y;
  if (breakD(lp.xz) < 0.5 && lp.y > ${f(H.BED - 0.02)} && lp.z > QZ + 0.02) { return rubble(vec2f(u, lp.y), U.pal[${PAL.ROCK}].rgb); }   // the breakwater's rubble core
  if (ws.x > top + 0.012) {   // under the sea: sand over the strata
    if (d < 0.03) { return U.pal[${PAL.SAND}].rgb * (0.8 + 0.3 * hash21(floor(vec2f(u, lp.y) * 160.0))); }
    return c;
  }
  if (lp.z > HILL && d < 0.012) { return select(courses(u, lp.y, 0.05, 0.02, 0.12, U.pal[${PAL.COBBLE}].rgb), U.pal[${PAL.ASPHALT}].rgb, lp.x < XT); }   // the yard's slab or the cobbles
  if (lp.z > HILL && d < 0.1) { return U.pal[${PAL.SOIL}].rgb * (0.75 + 0.35 * hash21(floor(vec2f(u, lp.y) * 120.0))); }   // fill
  if (d < 0.015) { return U.pal[0].rgb * 0.9; }   // the turf on the hill
  return c;
}
${PARTS_WGSL}
`;

/** gpu: { device, context, format } from the page; mesh: the parts. */
export function createRenderer(gpu, canvas, mesh) {
  return createDioramaRenderer(gpu, canvas, {
    N: H.GN, half: H.HALF, terrainH: H.terrainH, terrainNormal: H.terrainNormal,
    wgsl: WGSL, instFloats: mesh.nParts * 12, layers: [partsLayer(mesh)], sunColor: [2.2, 2.12, 2.0], maxBubbles: 400,
  });
}
