// Rubber Duck Pool's renderer: the shared diorama renderer in bright midday light, with the courtyard's ground
// (big pale travertine pavers, the colonnade's terracotta floor, white stone coping round the pools, the lawn and
// the planters' grass, the beach's sand outside; under the water small glossy tiles with a darker band at the
// waterline and a mosaic rubber duck on the big pool's floor), its cut faces as a cliff of bedded rock, and in
// place of the studio a sky and the open sea to the horizon. Everything else is parts.
import { createDioramaRenderer } from '@lid/diorama/renderer.js';
import { PARTS_WGSL, partsLayer } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { MAX_DUCKS } from './ducks.js';

/** Palette slots beyond the core's ground (0 grass). SKY's w is how far into night it is (0 day, 1 night). */
export const PAL = { TILE: 10, TILE2: 11, GROUT: 12, STONE: 13, STONE2: 14, COPING: 15, MOSAIC: 16, BEAK: 17, CONCRETE: 18, BAND: 19, SAND: 20, TERRACOTTA: 21, TUB: 22,
  SKY: 23, HAZE: 24, SEA: 25, SHALLOW: 26, ROCK: 27, ROCK2: 28, WEED: 29 };

// The sea is the plane y = 0, the block's base: the terrace stands on a cliff out of it.
const BACKDROP = /* wgsl */ `
fn fbm(p: vec2f) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < 5; i++) { s += a * vnoise(q); q = q * 2.03 + vec2f(1.7, 9.2); a *= 0.5; }
  return s;
}
// the sky: deep overhead, pale at the horizon, a glow round the sun
fn skyBase(rd: vec3f) -> vec3f {
  var c = mix(U.pal[${PAL.HAZE}].rgb, U.pal[${PAL.SKY}].rgb, pow(max(rd.y, 0.0), 0.32));
  let sd = max(dot(rd, U.sun.xyz), 0.0);
  return c + sunC() * (0.04 * pow(sd, 4.0) + 0.16 * pow(sd, 48.0));
}
// fair-weather clouds on a layer overhead, drifting, thinning toward the horizon
fn sky(rd: vec3f) -> vec3f {
  var c = skyBase(rd);
  if (rd.y > 0.0) {
    let p = rd.xz / (rd.y + 0.1) * 1.4 + vec2f(U.eye.w * 0.006, U.eye.w * 0.002);
    let d = fbm(p);
    let a = smoothstep(0.5, 0.78, d) * smoothstep(0.0, 0.14, rd.y);
    let lit = 0.9 + 0.35 * clamp((fbm(p + U.sun.xz * 0.12) - d) * -4.0 + 0.5, 0.0, 1.0);
    let night = U.pal[${PAL.SKY}].w;
    c = mix(c, mix(U.pal[${PAL.HAZE}].rgb, vec3f(1.25, 1.22, 1.18), 0.6 * (1.0 - night)) * lit * (1.0 - 0.7 * night), a * 0.9);
    // stars, by night, where there is no cloud
    let q = floor(rd * 260.0);
    let h = hash21(q.xy + q.z * 17.31);
    c += vec3f(1.0, 0.97, 0.9) * step(0.9972, h) * smoothstep(0.03, 0.2, rd.y) * night * (1.0 - a) * (0.7 + 0.5 * sin(U.eye.w * 2.3 + h * 60.0));
  }
  let sd = dot(rd, U.sun.xyz);
  return c + sunC() * 5.0 * smoothstep(0.99975, 0.9999, sd);
}
// the swell and the chop as a slope (dh/dx, dh/dz); k fades the fine waves out with distance
fn swell(p: vec2f, d: vec2f, len: f32, steep: f32) -> vec2f {
  let k = 2.0 * PI / len;
  let ph = k * dot(d, p) - sqrt(9.8 * k) * 0.35 * U.eye.w;
  return d * (steep * cos(ph));
}
fn seaSlope(p: vec2f, k: f32) -> vec2f {
  var g = swell(p, vec2f(0.8, 0.6), 5.3, 0.03) + swell(p, vec2f(-0.45, 0.89), 3.1, 0.03);
  g += (swell(p, vec2f(0.28, 0.96), 1.7, 0.035) + swell(p, vec2f(0.96, -0.28), 1.1, 0.03) + swell(p, vec2f(-0.85, -0.53), 0.7, 0.025)) * k;
  let q = p * 4.0 + vec2f(U.eye.w * 0.3, -U.eye.w * 0.2);
  let e = 0.05;
  let n0 = vnoise(q);
  g += vec2f(vnoise(q + vec2f(e, 0.0)) - n0, vnoise(q + vec2f(0.0, e)) - n0) / e * 0.09 * k;
  return g;
}
// what reflections see: the sky above, the sea below the horizon
fn env(r: vec3f) -> vec3f {
  if (r.y > 0.0) { return skyBase(r); }
  return mix(U.pal[${PAL.HAZE}].rgb * 0.8, U.pal[${PAL.SEA}].rgb * 1.5, smoothstep(0.0, -0.3, r.y));
}
fn ambient(n: vec3f) -> vec3f {
  let up = mix(U.pal[${PAL.HAZE}].rgb, U.pal[${PAL.SKY}].rgb, 0.4) * 0.85;
  let down = U.pal[${PAL.HAZE}].rgb * vec3f(0.42, 0.37, 0.3);   // light thrown up off the stone: as bright as the sky makes it
  return mix(down, up, n.y * 0.5 + 0.5);
}
fn seaColour(ro: vec3f, rd: vec3f, t: f32) -> vec3f {
  let p = ro + rd * t;
  let k = exp(-t * 0.05);
  let g = seaSlope(p.xz, k);
  let n = normalize(vec3f(-g.x, 1.0, -g.y));
  let v = -rd;
  let sh = shadowAt(p, vec3f(0.0, 1.0, 0.0));
  // the water's own colour, lighter in the shallows round the foot of the cliff, and the sky in it
  let pl = (U.Minv * vec4f(p, 1.0)).xyz;
  let dq = length(max(abs(pl.xz) - vec2f(HALF), vec2f(0.0)));
  var body = mix(U.pal[${PAL.SEA}].rgb, U.pal[${PAL.SHALLOW}].rgb, exp(-dq * 2.2) * 0.85) * (0.55 + 0.45 * sh);
  var r = reflect(rd, n);
  r.y = abs(r.y);
  var c = mix(body, skyBase(r), fres(max(dot(n, v), 0.0), 0.02) * 0.8);
  c += sunC() * specGGX(n, v, U.sun.xyz, 0.09) * sh * fres(dot(normalize(v + U.sun.xyz), v), 0.02);
  // surf where the sea washes the cliff
  let T = U.eye.w;
  let wash = 1.0 - smoothstep(0.0, 0.22, dq + 0.1 * (vnoise(pl.xz * 7.0 + vec2f(T * 0.4, 0.0)) - 0.5) + 0.04 * sin(T * 1.3 + pl.x * 2.0 + pl.z * 1.7));
  let froth = smoothstep(0.35, 0.8, vnoise(pl.xz * 26.0 + vec2f(T * 0.5, -T * 0.3)) * 0.7 + wash * 0.6) * wash;
  c = mix(c, vec3f(0.92, 0.95, 0.96) * (0.65 + 0.35 * sh), froth * 0.9);
  // the air between: far water fades into the haze
  return mix(c, U.pal[${PAL.HAZE}].rgb * 0.93, 1.0 - exp(-t * 0.01));
}
@fragment fn fsBG(@builtin(position) fp: vec4f) -> FOut {
  let uv = fp.xy * U.screen.zw;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let a = V.inv * vec4f(ndc, 0.0, 1.0);
  let b = V.inv * vec4f(ndc, 1.0, 1.0);
  let ro = V.eye.xyz;
  let rd = normalize(b.xyz / b.w - a.xyz / a.w);
  var o: FOut;
  if (rd.y < -1e-4 && ro.y > 0.0) {
    let t = -ro.y / rd.y;
    o.c = vec4f(seaColour(ro, rd, t), 1.0);
    o.d = vec4f(t, 0.0, 0.0, 1.0);
  } else {
    o.c = vec4f(sky(rd), 1.0);
    o.d = vec4f(1e4, 0.0, 0.0, 1.0);
  }
  return o;
}
`;

const f = (v) => v.toFixed(4);
const WGSL = /* wgsl */ `
const TER: f32 = ${f(P.TER)};
const LU: f32 = ${f(P.LU)};
const LL: f32 = ${f(P.LL)};
const FRONT: f32 = ${f(P.FRONT)};
const COLS: f32 = ${f(P.COLS)};
const MID: vec2f = vec2f(${f(P.HEAD[0])}, ${f(-0.38 * P.K)});
const MOSAIC: f32 = ${f(0.62 * P.K)};   // the mosaic duck's size
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
  let q = (p - MID) / MOSAIC;
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
      let q = (cell - MID) / MOSAIC;
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
// the cliff: beds of pale rock, each its own tone, a dark seam between, cracks down it, wet and weedy at the foot
fn rock(u: f32, y: f32) -> vec3f {
  let w = y * 4.5 + 0.5 * vnoise(vec2f(u * 1.3, y * 1.5)) + 0.2 * sin(u * 0.9);
  var c = mix(U.pal[${PAL.ROCK}].rgb, U.pal[${PAL.ROCK2}].rgb, smoothstep(0.3, 0.7, vnoise(vec2f(u * 0.7, floor(w) * 3.7))));
  c *= 0.86 + 0.14 * smoothstep(0.0, 0.07, fract(w)) * smoothstep(1.0, 0.9, fract(w));
  c *= 0.84 + 0.12 * vnoise(vec2f(u * 18.0, y * 24.0)) + 0.08 * vnoise(vec2f(u * 90.0, y * 120.0));
  c *= 1.0 - 0.14 * smoothstep(0.6, 0.85, vnoise(vec2f(u * 12.0, y * 16.0)));   // pitted, weathered patches
  let wet = 1.0 - smoothstep(0.04, 0.16 + 0.06 * vnoise(vec2f(u * 4.0, 1.0)), y);
  return mix(c, U.pal[${PAL.WEED}].rgb * (0.7 + 0.35 * vnoise(vec2f(u * 40.0, y * 30.0))), wet);
}
fn section(lp: vec3f, u: f32, top: f32) -> vec3f {
  let d = top - lp.y;
  if (lp.z > FRONT - 0.01 && d < 0.07) { return U.pal[${PAL.SAND}].rgb * (0.85 + 0.2 * hash21(floor(vec2f(u, lp.y) * 150.0))); }   // the beach's sand
  if (d < 0.015) { return select(U.pal[${PAL.STONE}].rgb, U.pal[0].rgb * 0.85, top < TER - 0.03); }   // paving, or the turf
  return rock(u, lp.y);
}
${PARTS_WGSL}
`;

// The ducks: one mesh (duck-assets.js: position, normal, uv, kind), drawn once per duck. A duck's instance data follows
// the parts' in inst, four vec4 from base: its 3×4 transform as rows, then (design, crown shown, 0, 0). Kind 0 samples
// the design's atlas (body, beak, eyes), 1 is an eye's catchlight, 2 the crown, shown only where the duck has one.
const duckWGSL = (base) => /* wgsl */ `
@group(3) @binding(0) var duckTex: texture_2d_array<f32>;
@group(3) @binding(1) var duckS: sampler;
const DUCK_BASE: u32 = ${base}u;
struct DkOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) lp: vec3f, @location(2) n: vec3f, @location(3) uv: vec2f,
  @location(4) @interpolate(flat) k: u32, @location(5) @interpolate(flat) layer: i32 }
@vertex fn vsDuck(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) kind: f32, @builtin(instance_index) ii: u32) -> DkOut {
  let b = DUCK_BASE + 4u * ii;
  let r0 = inst[b]; let r1 = inst[b + 1u]; let r2 = inst[b + 2u]; let ex = inst[b + 3u];
  let k = u32(kind + 0.5);
  var q = p;
  if (k == 2u && ex.y < 0.5) { q = vec3f(0.0); }   // no crown: its triangles collapse to a point
  let lp = vec3f(dot(r0.xyz, q) + r0.w, dot(r1.xyz, q) + r1.w, dot(r2.xyz, q) + r2.w);
  let w = toWorld(lp);
  var o: DkOut;
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.lp = lp; o.n = nWorld(vec3f(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n))); o.uv = uv; o.k = k; o.layer = i32(ex.x + 0.5);
  return o;
}
@fragment fn fsDuck(i: DkOut) -> FOut {
  let tex = textureSample(duckTex, duckS, i.uv, i.layer).rgb;   // out here: derivatives need uniform control flow
  let v = normalize(V.eye.xyz - i.wp);
  let n = normalize(i.n);
  var sun = shadowAt(i.wp, n);
  var alb = tex;
  var rough = 0.24;
  // in the water: wet and darker, caustics under the surface (as the parts)
  let ws = water(i.lp.xz);
  let under = ws.x - i.lp.y;
  if (ws.x > ws.w + 0.012 && under > -0.012) {
    alb *= 0.74; rough = 0.2;
    if (under > 0.0) { sun *= mix(1.0, caustic(i.lp.xz) * 1.1, 0.9 * exp(-under * 1.3)); }
  }
  var c: vec3f;
  if (i.k == 2u) {   // gold
    let g = vec3f(0.92, 0.52, 0.035);
    c = lit(g * 0.25, n, v, 0.3, 0.0, sun, 0.1) + g * (env(reflect(-v, n)) * 0.75 + sunC() * specGGX(n, v, U.sun.xyz, 0.2) * sun);
  } else if (i.k == 1u) {
    c = vec3f(1.6);   // the catchlight, bright whatever the light
  } else {
    c = lit(alb, n, v, rough, 0.05, sun, 0.2);   // glossy rubber
  }
  return opaque(c, i.wp);
}
`;
const VB_DUCK = [{ arrayStride: 36, attributes: [
  { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
  { shaderLocation: 2, offset: 24, format: 'float32x2' }, { shaderLocation: 3, offset: 32, format: 'float32' }] }];

/** gpu: { device, context, format } from the page; mesh: the parts; ducks: the duck assets (duck-assets.js). The ducks'
 * instance data starts at duckBase(mesh) floats in inst; a frame's f.nDucks says how many to draw. */
export function createRenderer(gpu, canvas, mesh, ducks) {
  return createDioramaRenderer(gpu, canvas, {
    N: P.GN, half: P.HALF, terrainH: P.terrainH, terrainNormal: P.terrainNormal, groundMask: P.zones,
    wgsl: WGSL + duckWGSL(mesh.nParts * 3), backdrop: BACKDROP, instFloats: duckBase(mesh) + MAX_DUCKS * 16, sunColor: [2.35, 2.25, 2.05], maxBubbles: 400,
    layers: [partsLayer(mesh), { vs: 'vsDuck', fs: 'fsDuck', buffers: VB_DUCK, vert: ducks.vert, index: ducks.index, texture: ducks.texture, shadow: true, count: (f) => f.nDucks }],
  });
}
/** Where the ducks' instance data starts in inst (floats): after every part's 12. */
export const duckBase = (mesh) => mesh.nParts * 12;
