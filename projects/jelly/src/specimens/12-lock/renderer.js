// Lock Jelly's renderer: the shared diorama renderer with the lock's ground (grass, stone setts, brick walls
// slimy between the two levels and weedy below, gravel, garden soil, silt on the bed), its cut faces (turf over
// brown earth over the candy strata; puddle clay under the pounds, a brick invert on concrete under the
// chamber), and everything else as parts: the scenery, the gates, the keeper, the boats, the birds, the fish.
import { createDioramaRenderer } from '../../core/diorama/renderer.js';
import { PARTS_WGSL, partsLayer } from '../../core/diorama/parts.js';
import { L } from './layout.js';

/** Palette slots beyond the core's (0 grass, 1–5 strata, 6–9 pebbles). */
export const PAL = { SETTS: 10, BRICK: 11, GRAVEL: 12, EARTH: 13, CLAY: 14, CONCRETE: 15, SILT: 16, SLIME: 17, WEED: 18, SOIL: 19 };

const f = (v) => v.toFixed(4);
const WGSL = /* wgsl */ `
const LU: f32 = ${f(L.LU)};
const LL: f32 = ${f(L.LL)};
const XT: f32 = ${f(L.XT)};
const XB: f32 = ${f(L.XB)};
const ZC: f32 = ${f(L.ZC)};
fn brick(u: f32, v: f32) -> vec3f {
  let row = floor(v / 0.021);
  let uu = u / 0.05 + 0.5 * fract(row * 0.5) * 2.0;
  let fu = fract(uu);
  let fv = fract(v / 0.021);
  let mortar = max(1.0 - smoothstep(0.03, 0.07, min(fu, 1.0 - fu)), 1.0 - smoothstep(0.06, 0.13, min(fv, 1.0 - fv)));
  let h = hash21(vec2f(floor(uu), row));
  let b = U.pal[${PAL.BRICK}].rgb * (0.74 + 0.4 * h) * (0.9 + 0.14 * vnoise(vec2f(u, v) * 260.0));
  return mix(b, vec3f(0.55, 0.53, 0.5), mortar * 0.8);
}
fn setts(p: vec2f) -> vec3f {
  let row = floor(p.y / 0.032);
  let uu = p.x / 0.045 + 0.37 * row;
  let fu = fract(uu);
  let fv = fract(p.y / 0.032);
  let joint = max(1.0 - smoothstep(0.04, 0.1, min(fu, 1.0 - fu)), 1.0 - smoothstep(0.05, 0.12, min(fv, 1.0 - fv)));
  let h = hash21(vec2f(floor(uu), row));
  let s = U.pal[${PAL.SETTS}].rgb * (0.78 + 0.34 * h) * (0.9 + 0.15 * vnoise(p * 300.0));
  return mix(s, s * 0.45, joint);
}
fn groundTop(lp: vec3f, n: vec3f, e: vec4f) -> Surf {
  let x = lp.xz;
  let ws = water(x);
  let under = ws.x - lp.y;
  let nl = normalize((U.Minv * vec4f(n, 0.0)).xyz);
  var s: Surf;
  s.n = n; s.rough = 0.88; s.f0 = 0.03;
  // grass: two greens, clover, a lighter fringe on the banks
  let g1 = vnoise(x * 42.0);
  let g2 = vnoise(x * 8.0 + 3.0);
  var c = U.pal[0].rgb * (0.8 + 0.26 * g1 + 0.14 * g2);
  c = mix(c, c * vec3f(1.12, 1.08, 0.8), smoothstep(0.65, 0.9, vnoise(x * 3.1 + 7.0)) * 0.5);
  // gravel and the lane
  let gr = U.pal[${PAL.GRAVEL}].rgb * (0.72 + 0.42 * hash21(floor(x * 240.0))) * (0.92 + 0.1 * vnoise(x * 30.0));
  c = mix(c, gr, smoothstep(0.1, 0.6, e.z));
  // the cottage garden: dug beds
  c = mix(c, U.pal[${PAL.SOIL}].rgb * (0.78 + 0.34 * vnoise(x * 80.0)), smoothstep(0.2, 0.8, e.w) * 0.85);
  // masonry: setts on the level, brick walls, a brick invert on the chamber floor
  if (e.x > 0.01) {
    var m: vec3f;
    let steep = 1.0 - smoothstep(0.35, 0.6, nl.y);
    if (steep > 0.5) {
      let u = select(lp.x, lp.z, abs(nl.x) > abs(nl.z));
      m = brick(u, lp.y);
      let inLock = step(XT - 0.02, lp.x) * step(lp.x, XB + 0.02);
      let band = smoothstep(LL - 0.03, LL + 0.01, lp.y) * (1.0 - smoothstep(LU - 0.005, LU + 0.02, lp.y));
      m = mix(m, U.pal[${PAL.SLIME}].rgb * (0.7 + 0.5 * vnoise(vec2f(u * 90.0, lp.y * 30.0))), band * inLock * 0.85);
      let low = select(LL, LU, lp.x < XT);
      let weed = (1.0 - smoothstep(low - 0.08, low - 0.01, lp.y)) * smoothstep(0.35, 0.75, vnoise(vec2f(u * 55.0, lp.y * 14.0)));
      m = mix(m, U.pal[${PAL.WEED}].rgb, weed * 0.8);
    } else if (lp.y < LL) {
      m = brick(lp.x, lp.z) * 0.85;
    } else {
      m = setts(x);
    }
    c = mix(c, m, smoothstep(0.3, 0.7, e.x));
    s.rough = mix(s.rough, 0.7, e.x);
  }
  // the bed under the water: silt with a few stones
  if (under > 0.004 && e.x < 0.5) {
    let silt = U.pal[${PAL.SILT}].rgb * (0.8 + 0.3 * vnoise(x * 26.0)) * (0.9 + 0.2 * step(0.93, hash21(floor(x * 90.0))));
    c = mix(c, silt, smoothstep(0.0, 0.05, under));
  }
  s.alb = c;
  return s;
}
fn section(lp: vec3f, u: f32, top: f32) -> vec3f {
  var c = strata(u, lp.y, top);
  let ws = water(lp.xz);
  let d = top - lp.y;
  if (ws.x > top + 0.012) {   // under the canal
    if (lp.x > XT && lp.x < XB && lp.z > ZC - 0.1) {
      if (d < 0.05) { c = brick(u, lp.y); }
      else if (d < 0.11) { c = U.pal[${PAL.CONCRETE}].rgb * (0.86 + 0.2 * vnoise(vec2f(u, lp.y) * 90.0)); }
    } else if (d < 0.075) {
      c = U.pal[${PAL.CLAY}].rgb * (0.84 + 0.22 * vnoise(vec2f(u * 40.0, lp.y * 120.0)));
    }
    if (d < 0.008) { c = U.pal[${PAL.SILT}].rgb; }
  } else {                     // under the fields: turf over brown earth
    if (d < 0.022) { c = U.pal[0].rgb * (0.7 + 0.25 * vnoise(vec2f(u * 160.0, lp.y * 300.0))); }
    else if (d < 0.12) { c = U.pal[${PAL.EARTH}].rgb * (0.82 + 0.3 * vnoise(vec2f(u * 50.0, lp.y * 90.0))) * (1.0 - 0.25 * smoothstep(0.1, 0.12, d)); }
  }
  return c;
}
${PARTS_WGSL}
`;

/** gpu: { device, context, format } from the page; mesh: the parts (partsBuilder().done()). */
export function createRenderer(gpu, canvas, mesh) {
  return createDioramaRenderer(gpu, canvas, {
    N: L.GN, half: L.HALF, terrainH: L.terrainH, terrainNormal: L.terrainNormal, groundMask: L.zones,
    wgsl: WGSL, instFloats: mesh.nParts * 12, layers: [partsLayer(mesh)],
  });
}
