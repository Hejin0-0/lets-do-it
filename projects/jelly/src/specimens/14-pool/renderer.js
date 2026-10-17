// Pool Jelly's renderer: the shared diorama renderer in bright midday light, with the courtyard's ground (big
// pale travertine pavers, the colonnade's terracotta floor, white stone coping round the pools, the lawn and
// the planters' grass, the beach's sand outside; under the water small glossy tiles with a darker band at the
// waterline and a mosaic rubber duck on the big pool's floor) and its cut faces (the pools' tiled shells and
// concrete, the sand, over candy strata). Everything else is parts.
import { createDioramaRenderer } from '../../core/diorama/renderer.js';
import { PARTS_WGSL, partsLayer } from '../../core/diorama/parts.js';
import { P } from './layout.js';

/** Palette slots beyond the core's (0 grass, 1–5 strata, 6–9 pebbles). */
export const PAL = { TILE: 10, TILE2: 11, GROUT: 12, STONE: 13, STONE2: 14, COPING: 15, MOSAIC: 16, BEAK: 17, CONCRETE: 18, BAND: 19, SAND: 20, TERRACOTTA: 21, TUB: 22 };

const f = (v) => v.toFixed(4);
const WGSL = /* wgsl */ `
const TER: f32 = ${f(P.TER)};
const LU: f32 = ${f(P.LU)};
const LL: f32 = ${f(P.LL)};
const FRONT: f32 = ${f(P.FRONT)};
const COLS: f32 = ${f(P.COLS)};
const MID: vec2f = vec2f(${f(P.HEAD[0])}, -0.38);
const ROUND: vec3f = vec3f(${f(P.ROUND[0])}, ${f(P.ROUND[1])}, ${f(P.ROUND[2])});
// square tiles of side s with grout: each tile's colour varied a little, darker in the joints
fn tiles(uv: vec2f, s: f32, c: vec3f, grout: vec3f, j: f32) -> vec3f {
  let g = uv / s; let fc = fract(g); let id = floor(g);
  let joint = 1.0 - smoothstep(j * 0.5, j, min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y)));
  return mix(c * (0.9 + 0.16 * hash21(id)), grout, joint);
}
// travertine: big pavers, rows offset, faint veins
fn travertine(p: vec2f) -> vec3f {
  let row = floor(p.y / 0.2);
  let q = vec2f(p.x + 0.1 * (row - 2.0 * floor(row * 0.5)), p.y);
  let id = floor(q / 0.2);
  var c = mix(U.pal[${PAL.STONE}].rgb, U.pal[${PAL.STONE2}].rgb, hash21(id));
  c *= 0.92 + 0.1 * vnoise(p * vec2f(9.0, 40.0) + id * 7.0) - 0.06 * smoothstep(0.7, 0.9, vnoise(p * vec2f(3.0, 26.0) + id));
  let fc = fract(q / 0.2);
  let joint = 1.0 - smoothstep(0.01, 0.025, min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y)));
  return mix(c, c * 0.72, joint);
}
// the mosaic duck on the big pool's floor, judged at each tile's middle so it comes out in tiles
fn mosaicDuck(p: vec2f) -> f32 {
  let q = (p - MID) / 0.62;
  let body = length(q * vec2f(1.0, 1.5)) - 0.45;
  let head = length(q - vec2f(0.38, -0.42)) - 0.22;
  let tail = length((q - vec2f(-0.45, -0.2)) * vec2f(1.4, 1.0)) - 0.16;
  return min(min(body, head), tail);
}
fn groundTop(lp: vec3f, n: vec3f, e: vec4f) -> Surf {
  let x = lp.xz;
  let ws = water(x);
  let under = ws.x - lp.y;
  let nl = normalize((U.Minv * vec4f(n, 0.0)).xyz);
  let steep = 1.0 - smoothstep(0.35, 0.6, nl.y);
  var s: Surf;
  s.n = n; s.rough = 0.7; s.f0 = 0.03;
  var c = travertine(x);
  if (lp.z < COLS - 0.005 && lp.y > TER + 0.03) { c = tiles(x, 0.09, U.pal[${PAL.TERRACOTTA}].rgb, U.pal[${PAL.GROUT}].rgb * 0.8, 0.06); }   // the colonnade's floor
  // grass: the lawn and the planters, two greens and a lighter flush
  let grass = U.pal[0].rgb * (0.78 + 0.28 * vnoise(x * 60.0) + 0.12 * vnoise(x * 9.0));
  c = mix(c, mix(grass, grass * vec3f(1.12, 1.08, 0.8), smoothstep(0.6, 0.9, vnoise(x * 2.7 + 5.0)) * 0.5), smoothstep(0.3, 0.7, e.z) * step(0.5, nl.y));
  // the beach: warm sand with wind ripples, the odd shell
  let sand = U.pal[${PAL.SAND}].rgb * (0.9 + 0.08 * sin(dot(x, vec2f(40.0, 23.0)) + 4.0 * vnoise(x * 3.0)) + 0.08 * vnoise(x * 70.0));
  c = mix(c, mix(sand, vec3f(0.95, 0.9, 0.85), step(0.993, hash21(floor(x * 80.0)))), smoothstep(0.3, 0.7, e.w));
  // the coping round the pools: white stone in lengths
  c = mix(c, tiles(vec2f(lp.x + lp.z, 0.0), 0.12, U.pal[${PAL.COPING}].rgb, U.pal[${PAL.GROUT}].rgb, 0.03), smoothstep(0.2, 0.6, e.x));
  // the pools' shells under the water: small glossy tiles (lilac in the round tub), a band at the waterline, the mosaic duck
  if ((ws.x > ws.w + 0.012 || under > -0.004) && lp.y < TER - 0.03 && lp.z < FRONT) {
    var uv = x;
    if (steep > 0.5) { uv = vec2f(select(lp.x, lp.z, abs(nl.x) > abs(nl.z)), lp.y); }
    let tub = 1.0 - step(ROUND.z + 0.04, length(x - ROUND.xy));
    var t = tiles(uv, 0.042, mix(U.pal[${PAL.TILE}].rgb, U.pal[${PAL.TUB}].rgb, tub), U.pal[${PAL.GROUT}].rgb, 0.08);
    if (steep > 0.5) {
      let band = max(1.0 - smoothstep(0.0, 0.004, abs(lp.y - (LU - 0.02)) - 0.02), 1.0 - smoothstep(0.0, 0.004, abs(lp.y - (LL - 0.02)) - 0.02));
      t = mix(t, tiles(uv, 0.021, U.pal[${PAL.BAND}].rgb, U.pal[${PAL.GROUT}].rgb, 0.1), band);
    } else if (tub < 0.5 && lp.y < LU - 0.25) {
      let cell = (floor(x / 0.042) + 0.5) * 0.042;
      let q = (cell - MID) / 0.62;
      let d = mosaicDuck(cell);
      if (d < 0.0) { t = tiles(uv, 0.042, U.pal[${PAL.MOSAIC}].rgb, U.pal[${PAL.GROUT}].rgb, 0.08); }
      if (length(q - vec2f(0.62, -0.42)) < 0.09) { t = tiles(uv, 0.042, U.pal[${PAL.BEAK}].rgb, U.pal[${PAL.GROUT}].rgb, 0.08); }
      if (length(q - vec2f(0.42, -0.5)) < 0.05 || abs(d) < 0.03) { t = tiles(uv, 0.042, U.pal[${PAL.TILE2}].rgb * select(1.0, 0.4, abs(d) >= 0.03), U.pal[${PAL.GROUT}].rgb, 0.08); }
    }
    c = t; s.rough = 0.22; s.f0 = 0.05;
  }
  s.alb = c;
  return s;
}
fn section(lp: vec3f, u: f32, top: f32) -> vec3f {
  let c = strata(u, lp.y, top);
  let d = top - lp.y;
  if (lp.z > FRONT - 0.01) {   // the beach: sand over the strata
    if (d < 0.06) { return U.pal[${PAL.SAND}].rgb * (0.85 + 0.2 * hash21(floor(vec2f(u, lp.y) * 150.0))); }
    return c;
  }
  if (top < TER - 0.03 && water(lp.xz).x > top + 0.012) {   // under the water: the tiled shell on its concrete
    if (d < 0.008) { return U.pal[${PAL.TILE}].rgb; }
    if (d < 0.07) { return U.pal[${PAL.CONCRETE}].rgb * (0.85 + 0.2 * hash21(floor(vec2f(u, lp.y) * 140.0))); }
    return c;
  }
  if (d < 0.015) { return select(U.pal[${PAL.STONE}].rgb, U.pal[0].rgb * 0.85, top < TER - 0.03); }   // paving, or the turf
  if (d < 0.06) { return U.pal[${PAL.CONCRETE}].rgb * (0.8 + 0.2 * hash21(floor(vec2f(u, lp.y) * 140.0))); }
  return c;
}
${PARTS_WGSL}
`;

/** gpu: { device, context, format } from the page; mesh: the parts. */
export function createRenderer(gpu, canvas, mesh) {
  return createDioramaRenderer(gpu, canvas, {
    N: P.GN, half: P.HALF, terrainH: P.terrainH, terrainNormal: P.terrainNormal, groundMask: P.zones,
    wgsl: WGSL, instFloats: mesh.nParts * 12, layers: [partsLayer(mesh)], sunColor: [2.35, 2.25, 2.05], maxBubbles: 400,
  });
}
