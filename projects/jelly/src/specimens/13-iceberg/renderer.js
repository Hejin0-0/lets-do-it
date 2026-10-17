// Iceberg Jelly's renderer: the shared diorama renderer in a cool polar light, with the bay's ground (dark
// volcanic rock with orange lichen and ragged snow on the flatter, higher ground; the glacier's ice with its
// crevasses and the cliff's runnels and blue bands; grey moraine; the rookery's krill-pink pebbles; gravel and
// shells on the sea floor) and its cut faces (candy strata, basalt columns under the land, layered glacier
// ice with a dirty base under the glacier). Everything else is parts.
import { createDioramaRenderer } from '../../core/diorama/renderer.js';
import { PARTS_WGSL, partsLayer } from '../../core/diorama/parts.js';
import { I } from './layout.js';

/** Palette slots beyond the core's (0 snow, 1–5 strata, 6–9 pebbles). */
export const PAL = { ROCK: 10, LICHEN: 11, ICE: 12, ICEBLUE: 13, MORAINE: 14, PEBBLE: 15, KRILL: 16, GRAVEL: 17, BASALT: 18, DIRT: 19 };

const f = (v) => v.toFixed(4);
const WGSL = /* wgsl */ `
const SL: f32 = ${f(I.SL)};
const GX: f32 = ${f(I.GX)};
const GW: f32 = ${f(I.GW)};
const GZ: f32 = ${f(I.GZ)};
fn valleyFloor(z: f32) -> f32 { return mix(0.36, 1.45, 1.0 - smoothstep(-2.6, GZ, z)); }
fn rockAt(x: vec2f, y: f32, up: f32, under: f32) -> vec3f {
  var c = U.pal[${PAL.ROCK}].rgb * (0.7 + 0.45 * vnoise(x * 38.0) + 0.2 * vnoise(x * 7.0));
  let lichen = smoothstep(0.8, 0.9, vnoise(x * 52.0 + 3.0)) * smoothstep(0.55, 0.8, up) * step(under, -0.02) * 0.7;
  c = mix(c, U.pal[${PAL.LICHEN}].rgb * (0.8 + 0.3 * vnoise(x * 130.0)), lichen * 0.85);
  // snow lies in ragged patches on the flatter, higher ground
  let lie = smoothstep(0.5, 0.85, up) * (0.55 * smoothstep(1.03, 1.12, y) + 0.45 * smoothstep(1.2, 1.5, y)) + 0.25 * smoothstep(1.7, 2.1, y);
  let snow = smoothstep(0.42, 0.58, lie + 0.32 * (vnoise(x * 11.0) - 0.5) + 0.16 * (vnoise(x * 37.0) - 0.5)) * step(under, -0.01);
  return mix(c, U.pal[0].rgb * (0.93 + 0.07 * vnoise(x * 60.0)), snow);
}
fn groundTop(lp: vec3f, n: vec3f, e: vec4f) -> Surf {
  let x = lp.xz;
  let ws = water(x);
  let under = ws.x - lp.y;
  let nl = normalize((U.Minv * vec4f(n, 0.0)).xyz);
  var s: Surf;
  s.n = n; s.rough = 0.85; s.f0 = 0.03;
  var c = rockAt(x, lp.y, nl.y, under);
  // the glacier: crevassed ice on top, the cliff's blue bands and vertical runnels on its face
  if (e.x > 0.01) {
    var ice: vec3f;
    if (nl.y < 0.5) {
      let band = smoothstep(0.6, 0.95, fract(lp.y * 14.0 + 0.25 * vnoise(vec2f(lp.x * 6.0, lp.y * 3.0))));
      let run = 0.5 + 0.5 * sin(lp.x * 140.0 + 2.0 * vnoise(vec2f(lp.x * 20.0, lp.y * 4.0)));
      ice = mix(U.pal[${PAL.ICE}].rgb, U.pal[${PAL.ICEBLUE}].rgb, band * 0.7) * (0.82 + 0.22 * run);
      ice = mix(ice, U.pal[${PAL.DIRT}].rgb, (1.0 - smoothstep(SL - 0.05, SL + 0.05, lp.y)) * 0.25);
      s.rough = 0.25; s.f0 = 0.04;
    } else {
      ice = U.pal[${PAL.ICE}].rgb * (0.9 + 0.12 * vnoise(x * 24.0));
      let ad = abs(lp.x - GX);
      let front = smoothstep(GZ - 0.7, GZ - 0.05, lp.z);
      let trans = smoothstep(0.82, 0.95, fract(lp.z * 11.0 + 0.4 * vnoise(x * 5.0) + ad * 0.8)) * front;          // transverse crevasses near the front
      let chev = smoothstep(0.84, 0.95, fract((lp.z + ad * 1.1) * 9.0 + 0.3 * vnoise(x * 6.0))) * smoothstep(GW * 0.45, GW * 0.85, ad);   // chevrons along the margins
      ice = mix(ice, U.pal[${PAL.ICEBLUE}].rgb * 0.55, max(trans, chev) * 0.85);
      ice = mix(ice, vec3f(0.97, 0.98, 0.99), smoothstep(0.55, 0.8, vnoise(x * 9.0)) * 0.6 * (1.0 - front * 0.5));   // snow on the ice
      s.rough = 0.45;
    }
    c = mix(c, ice, smoothstep(0.2, 0.8, e.x));
  }
  // grey lateral moraine
  c = mix(c, U.pal[${PAL.MORAINE}].rgb * (0.7 + 0.5 * hash21(floor(x * 160.0))), smoothstep(0.2, 0.7, e.z) * step(under, 0.02));
  // the rookery: round pebbles stained pink with krill
  if (e.w > 0.01) {
    let g = x * 120.0;
    let cell = floor(g);
    let fp = fract(g) - 0.5;
    let h = hash21(cell);
    let peb = 1.0 - smoothstep(0.32, 0.46, length(fp + (vec2f(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5) * 0.2));
    var pc = mix(U.pal[${PAL.PEBBLE}].rgb, U.pal[${PAL.KRILL}].rgb, smoothstep(0.3, 0.8, vnoise(x * 9.0)) * 0.85) * (0.75 + 0.4 * h);
    pc = mix(pc * 0.55, pc, peb);
    c = mix(c, pc, smoothstep(0.2, 0.8, e.w));
  }
  // the sea floor: grey gravel, the odd pale shell
  if (under > 0.01) {
    let gv = U.pal[${PAL.GRAVEL}].rgb * (0.7 + 0.45 * hash21(floor(x * 140.0))) * (0.9 + 0.15 * vnoise(x * 20.0));
    let shell = step(0.985, hash21(floor(x * 70.0) + 11.0));
    c = mix(c, mix(gv, vec3f(0.9, 0.86, 0.8), shell), smoothstep(0.01, 0.05, under) * (1.0 - e.x));
  }
  s.alb = c;
  return s;
}
fn section(lp: vec3f, u: f32, top: f32) -> vec3f {
  var c = strata(u, lp.y, top);
  let ws = water(lp.xz);
  let d = top - lp.y;
  if (ws.x > top + 0.012) {   // under the sea: gravel over the strata
    if (d < 0.025) { c = U.pal[${PAL.GRAVEL}].rgb * (0.7 + 0.45 * hash21(floor(vec2f(u, lp.y) * 160.0))); }
    return c;
  }
  if (abs(lp.x - GX) < GW && lp.z < GZ && lp.y > valleyFloor(lp.z)) {   // under the glacier: layered ice, a dirty base
    let k = lp.y - valleyFloor(lp.z);
    let band = 0.5 + 0.5 * sin(lp.y * 90.0 + 2.0 * vnoise(vec2f(u * 8.0, lp.y * 10.0)));
    c = mix(U.pal[${PAL.ICE}].rgb, U.pal[${PAL.ICEBLUE}].rgb, 0.35 + 0.5 * band) * (0.9 + 0.1 * vnoise(vec2f(u * 30.0, lp.y * 60.0)));
    c = mix(U.pal[${PAL.DIRT}].rgb * (0.7 + 0.5 * hash21(floor(vec2f(u, lp.y) * 200.0))), c, smoothstep(0.02, 0.05, k));
    return c;
  }
  if (d < 0.02) { return mix(U.pal[0].rgb, U.pal[${PAL.ROCK}].rgb, step(lp.y, 1.2)); }
  if (lp.y > 0.62) {   // basalt columns under the land
    let col = floor(u / 0.055);
    let fu = fract(u / 0.055);
    let joint = 1.0 - smoothstep(0.02, 0.08, min(fu, 1.0 - fu));
    let crack = 1.0 - smoothstep(0.0, 0.012, abs(fract(lp.y * 9.0 + hash21(vec2f(col, 1.0))) - 0.5) - 0.48);
    c = U.pal[${PAL.BASALT}].rgb * (0.75 + 0.4 * hash21(vec2f(col, 3.0))) * (1.0 - 0.6 * max(joint, crack * 0.5));
  }
  return c;
}
${PARTS_WGSL}
`;

/** gpu: { device, context, format } from the page; mesh: the parts. */
export function createRenderer(gpu, canvas, mesh) {
  return createDioramaRenderer(gpu, canvas, {
    N: I.GN, half: I.HALF, terrainH: I.terrainH, terrainNormal: I.terrainNormal, groundMask: I.zones,
    wgsl: WGSL, instFloats: mesh.nParts * 12, layers: [partsLayer(mesh)], sunColor: [1.95, 2.1, 2.35], maxBubbles: 500,
  });
}
