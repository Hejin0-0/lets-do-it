// Rubber Duck Pool's renderer: the shared diorama renderer in bright midday light, with the courtyard's ground
// (big pale travertine pavers, the colonnade's terracotta floor, white stone coping round the pools, the lawn and
// the planters' grass, the beach's sand outside; under the water small glossy tiles with a darker band at the
// waterline and a mosaic rubber duck on the big pool's floor), its cut faces as a cliff of bedded rock down into
// the water, in place of the studio a sky, and the open sea to the horizon: a mesh of rings round the block raised
// and pushed by the waves (ocean.js, ocean-gpu.js), the sky in it, the sun's glitter, whitecaps and the surf at the
// cliff's foot. Everything else is parts.
import { createDioramaRenderer } from '@lid/diorama/renderer.js';
import { PARTS_WGSL, partsLayer } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { MAX_DUCKS } from './ducks.js';
import { OCEAN, oceanSpectrum } from './ocean.js';

// the sea's mesh: rings from under the block's edge out to the horizon, each a little farther apart than the last
const OC_RINGS = 320, OC_SEGS = 384, OC_R0 = P.HALF * 0.9, OC_R1 = 3000;
function oceanMesh() {
  const vert = new Float32Array((OC_RINGS + 1) * OC_SEGS * 2), index = new Uint32Array(OC_RINGS * OC_SEGS * 6);
  for (let j = 0; j <= OC_RINGS; j++) {
    const r = OC_R0 * (OC_R1 / OC_R0) ** (j / OC_RINGS);
    for (let i = 0; i < OC_SEGS; i++) { const a = (i / OC_SEGS) * Math.PI * 2; vert[2 * (j * OC_SEGS + i)] = r * Math.cos(a); vert[2 * (j * OC_SEGS + i) + 1] = r * Math.sin(a); }
  }
  let k = 0;
  for (let j = 0; j < OC_RINGS; j++) for (let i = 0; i < OC_SEGS; i++) {
    const a = j * OC_SEGS + i, b = j * OC_SEGS + ((i + 1) % OC_SEGS);
    index.set([a, a + OC_SEGS, b, b, a + OC_SEGS, b + OC_SEGS], k); k += 6;
  }
  return { vert, index };
}
const VB_OCEAN = [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }];

/** Palette slots beyond the core's ground (0 grass). SKY's w is how far into night it is (0 day, 1 night). */
export const PAL = { TILE: 10, TILE2: 11, GROUT: 12, STONE: 13, STONE2: 14, COPING: 15, MOSAIC: 16, BEAK: 17, CONCRETE: 18, BAND: 19, SAND: 20, TERRACOTTA: 21, TUB: 22,
  SKY: 23, HAZE: 24, SEA: 25, SHALLOW: 26, ROCK: 27, ROCK2: 28, WEED: 29 };

// The sea lies at y = 0, about the block's base: the terrace stands on a cliff out of it. The open sea's shading is
// here (the sea's layer calls it), as is the sea past the end of its mesh, a sliver at the horizon.
const backdrop = (variance) => /* wgsl */ `
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
// fair-weather clouds on a layer overhead, drifting, thinning toward the horizon; stars (0 or 1): the sea's reflection
// leaves them out (a star in each rippled pixel reads as noise)
fn sky(rd: vec3f, stars: f32) -> vec3f {
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
    c += vec3f(1.0, 0.97, 0.9) * step(0.9972, h) * smoothstep(0.03, 0.2, rd.y) * night * (1.0 - a) * (0.7 + 0.5 * sin(U.eye.w * 2.3 + h * 60.0)) * stars;
  }
  let sd = dot(rd, U.sun.xyz);
  return c + sunC() * 5.0 * smoothstep(0.99975, 0.9999, sd);
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
// ----- the open sea: s its slopes (dh/dx, dh/dz) where it is drawn, vr how they spread about s -----
const OC_L: vec4f = vec4f(${OCEAN.L.map(f).join(', ')});   // the cascades' patches
const OC_N: f32 = ${OCEAN.N}.0;
const OC_VAR0: vec2f = vec2f(0.006);   // the slopes of the ripples no cascade holds
const OC_VAR: vec2f = OC_VAR0 + vec2f(${f(variance[0])}, ${f(variance[1])});   // all of them: the sea too far off for its waves to show
const OC_FAR: f32 = ${f(OC_R1 * 0.9)};   // where the sea's mesh runs out
const OC_FOAM: vec4f = vec4f(1.0, 0.8, 0.35, 0.0);   // how much each cascade's breaking crests whiten the water
// Smith's shadowing for slopes spread by vr, seen along d
fn smithL(d: vec3f, vr: vec2f) -> f32 {
  let h2 = d.x * d.x + d.z * d.z;
  let sig = sqrt((vr.x * d.x * d.x + vr.y * d.z * d.z) / max(h2, 1e-6));
  let a = d.y / max(sqrt(h2) * sig, 1e-4);
  return select(0.0, (1.0 - 1.259 * a + 0.396 * a * a) / (3.535 * a + 2.181 * a * a), a < 1.6);
}
// the sun's glitter: as bright as there are facets tilted to send it to the eye (the slopes, a Gaussian about s)
fn glitter(v: vec3f, l: vec3f, s: vec2f, vr: vec2f) -> f32 {
  if (l.y <= 0.0) { return 0.0; }
  let hv = normalize(v + l);
  let z = vec2f(-hv.x, -hv.z) / hv.y - s;
  let p = exp(-0.5 * (z.x * z.x / vr.x + z.y * z.y / vr.y)) / (2.0 * PI * sqrt(vr.x * vr.y));
  let g = 1.0 / (1.0 + smithL(v, vr) + smithL(l, vr));
  return fres(dot(v, hv), 0.02) * p * g / (4.0 * pow(hv.y, 4.0) * max(v.y, 0.02));
}
// the open sea at p, seen along v from t away; foam: its breaking crests; h: how high the water stands there
fn seaShade(p: vec3f, s: vec2f, vr: vec2f, v: vec3f, t: f32, foam: f32, h: f32) -> vec3f {
  let n = normalize(vec3f(-s.x, 1.0, -s.y));
  let L = U.sun.xyz;
  let sh = shadowAt(p, vec3f(0.0, 1.0, 0.0));
  var r = reflect(-v, n);
  r.y = abs(r.y);   // a ray sent down into the next wave: the sky it would have met past it
  let F = fres(max(dot(n, v), 0.0), 0.02);
  // the water's own colour: light scattered back up out of the deep, greener in the shallows at the cliff's foot, and
  // lit through where a crest stands up between the eye and the sun
  let pl = (U.Minv * vec4f(p, 1.0)).xyz;
  let dq = length(max(abs(pl.xz) - vec2f(HALF), vec2f(0.0)));
  var body = mix(U.pal[${PAL.SEA}].rgb, U.pal[${PAL.SHALLOW}].rgb, exp(-dq * 1.6) * 0.55) * (0.6 + 0.4 * sh);
  let toward = max(dot(normalize(vec3f(-v.x, 0.0, -v.z) + vec3f(1e-5)), normalize(vec3f(L.x, 0.0, L.z) + vec3f(1e-5))), 0.0);
  body += U.pal[${PAL.SHALLOW}].rgb * sunC() * pow(toward, 4.0) * clamp(h * 8.0, 0.0, 1.0) * clamp(L.y * 3.0, 0.0, 1.0) * 0.4 * sh;
  var c = mix(body, sky(r, 0.0), F);
  c += sunC() * 0.5 * glitter(v, L, s, vr) * sh;   // half: at full strength the path of the sun is a blank glare
  // whitecaps, and the surf where the sea runs against the cliff, thrown wider where a wave stands high against it
  let T = U.eye.w;
  let lace = vnoise(p.xz * 22.0 + vec2f(T * 0.3, -T * 0.2)) * 0.6 + vnoise(p.xz * 61.0 - T * 0.25) * 0.4;
  let cap = smoothstep(0.35, 0.85, foam + 0.45 * (lace - 0.5)) * min(foam * 2.5, 1.0);
  let wash = 1.0 - smoothstep(0.0, 0.24 + 0.5 * clamp(h * 10.0, 0.0, 1.0), dq + 0.12 * (vnoise(pl.xz * 7.0 + vec2f(T * 0.4, 0.0)) - 0.5));
  let surf = smoothstep(0.25, 0.7, lace * 0.7 + wash * 0.7) * wash;
  let white = vec3f(0.93, 0.95, 0.96) * (ambient(n) * 1.4 + sunC() * max(dot(n, L), 0.0) * 0.5 * sh);   // froth lit by the whole sky
  c = mix(c, white, clamp(max(cap, surf) * 0.92, 0.0, 1.0));
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
    var c = U.pal[${PAL.HAZE}].rgb * 0.93;   // under the sea's mesh: drawn over
    if (t > OC_FAR) { c = seaShade(ro + rd * t, vec2f(0.0), OC_VAR, -rd, t, 0.0, 0.0); }
    o.c = vec4f(c, 1.0);
    o.d = vec4f(t, 0.0, 0.0, 1.0);
  } else {
    o.c = vec4f(sky(rd, 1.0), 1.0);
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
// the texture a layer brings (the ducks' atlases, the sea's surface), bound for each layer's draw
@group(3) @binding(0) var layerTex: texture_2d_array<f32>;
@group(3) @binding(1) var layerS: sampler;
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
  let tex = textureSample(layerTex, layerS, i.uv, i.layer).rgb;   // out here: derivatives need uniform control flow
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

// The open sea's surface: the rings (oceanMesh) raised and pushed by the waves, each cascade read at the mipmap its
// vertices are spread over; per pixel, the cascades' slopes, their spread and their foam (ocean-gpu.js's layers)
const OCEAN_WGSL = /* wgsl */ `
const OC_REACH: f32 = ${f(Math.log(OC_R1 / OC_R0) / OC_RINGS)};   // how far apart the mesh's vertices are, over how far out
struct OcOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) x0: vec2f, @location(2) h: f32 }
@vertex fn vsOcean(@location(0) xz: vec2f) -> OcOut {
  let reach = length(xz) * OC_REACH;
  var d = vec3f(0.0);
  for (var c = 0; c < 4; c++) {
    d += textureSampleLevel(layerTex, layerS, xz / OC_L[c] + 0.5 / OC_N, 2 * c, log2(max(reach * OC_N / OC_L[c], 1.0))).xyz;
  }
  var o: OcOut;
  o.wp = vec3f(xz.x + d.x, d.y, xz.y + d.z);
  o.pos = V.vp * vec4f(o.wp, 1.0);
  o.x0 = xz; o.h = d.y;
  return o;
}
@fragment fn fsOcean(i: OcOut) -> FOut {
  var s = vec2f(0.0);
  var vr = OC_VAR0;
  var foam = 0.0;
  for (var c = 0; c < 4; c++) {
    let uv = i.x0 / OC_L[c] + 0.5 / OC_N;
    let q = textureSample(layerTex, layerS, uv, 2 * c + 1);
    s += q.xy;
    vr += max(q.zw - q.xy * q.xy, vec2f(0.0));
    foam += textureSample(layerTex, layerS, uv, 2 * c).w * OC_FOAM[c];
  }
  let v = normalize(V.eye.xyz - i.wp);
  return opaque(seaShade(i.wp, s, vr, v, distance(V.eye.xyz, i.wp), foam, i.h), i.wp);
}
`;

/** gpu: { device, context, format } from the page; mesh: the parts; ducks: the duck assets (duck-assets.js); ocean: the
 * sea's surface (ocean-gpu.js). The ducks' instance data starts at duckBase(mesh) floats in inst; a frame's f.nDucks
 * says how many to draw. */
export function createRenderer(gpu, canvas, mesh, ducks, ocean) {
  const sea = oceanMesh();
  return createDioramaRenderer(gpu, canvas, {
    N: P.GN, half: P.HALF, terrainH: P.terrainH, terrainNormal: P.terrainNormal, groundMask: P.zones, base: -0.6,
    wgsl: WGSL + duckWGSL(mesh.nParts * 3) + OCEAN_WGSL, backdrop: backdrop(oceanSpectrum().variance), instFloats: duckBase(mesh) + MAX_DUCKS * 16, sunColor: [2.35, 2.25, 2.05], maxBubbles: 400,
    layers: [partsLayer(mesh), { vs: 'vsDuck', fs: 'fsDuck', buffers: VB_DUCK, vert: ducks.vert, index: ducks.index, texture: ducks.texture, shadow: true, count: (f) => f.nDucks },
      { vs: 'vsOcean', fs: 'fsOcean', buffers: VB_OCEAN, vert: sea.vert, index: sea.index, texture: ocean.texture }],
  });
}
/** Where the ducks' instance data starts in inst (floats): after every part's 12. */
export const duckBase = (mesh) => mesh.nParts * 12;
