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
import { FX_MAX, FX_FLOATS } from './fx.js';
import { PLACEMENTS, PROP_FLOATS } from './props.js';

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

// The open sea lies at SEA, far below the terrace: the courtyard stands on a cliff out of it. The open sea's shading is
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
const SEA: f32 = ${f(P.SEA)};   // the open sea's level, far below the terrace
const OC_M: f32 = ${f(OCEAN.M)};   // metres in a unit: the sea's patterns below are sized in metres
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
  let dq = length(max(abs(pl.xz) - vec2f(HALF), vec2f(0.0))) * OC_M;   // metres out from the cliff
  let hm = h * OC_M;   // metres above the mean
  var body = mix(U.pal[${PAL.SEA}].rgb, U.pal[${PAL.SHALLOW}].rgb, exp(-dq * 0.08) * 0.55) * (0.6 + 0.4 * sh);
  let toward = max(dot(normalize(vec3f(-v.x, 0.0, -v.z) + vec3f(1e-5)), normalize(vec3f(L.x, 0.0, L.z) + vec3f(1e-5))), 0.0);
  body += U.pal[${PAL.SHALLOW}].rgb * sunC() * pow(toward, 4.0) * clamp(hm * 0.4, 0.0, 1.0) * clamp(L.y * 3.0, 0.0, 1.0) * 0.4 * sh;
  var c = mix(body, sky(r, 0.0), F);
  c += sunC() * 0.5 * glitter(v, L, s, vr) * sh;   // half: at full strength the path of the sun is a blank glare
  // whitecaps, and the surf where the sea runs against the cliff, thrown wider where a wave stands high against it
  let T = U.eye.w;
  let pm = p.xz * OC_M;
  let lace = vnoise(pm * 1.1 + vec2f(T * 0.3, -T * 0.2)) * 0.6 + vnoise(pm * 3.05 - T * 0.25) * 0.4;
  let cap = smoothstep(0.35, 0.85, foam + 0.45 * (lace - 0.5)) * min(foam * 2.5, 1.0);
  let wash = 1.0 - smoothstep(0.0, 4.8 + 10.0 * clamp(hm * 0.5, 0.0, 1.0), dq + 2.4 * (vnoise(pl.xz * OC_M * 0.35 + vec2f(T * 0.4, 0.0)) - 0.5));
  let surf = smoothstep(0.25, 0.7, lace * 0.7 + wash * 0.7) * wash;
  let white = vec3f(0.93, 0.95, 0.96) * (ambient(n) * 1.4 + sunC() * max(dot(n, L), 0.0) * 0.5 * sh);   // froth lit by the whole sky
  c = mix(c, white, clamp(max(cap, surf) * 0.92, 0.0, 1.0));
  // the air between: far water fades into the haze
  return mix(c, U.pal[${PAL.HAZE}].rgb * 0.93, 1.0 - exp(-t * 0.0015));
}
@fragment fn fsBG(@builtin(position) fp: vec4f) -> FOut {
  let uv = fp.xy * U.screen.zw;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let a = V.inv * vec4f(ndc, 0.0, 1.0);
  let b = V.inv * vec4f(ndc, 1.0, 1.0);
  let ro = V.eye.xyz;
  let rd = normalize(b.xyz / b.w - a.xyz / a.w);
  var o: FOut;
  if (rd.y < -1e-4 && ro.y > SEA) {
    let t = (SEA - ro.y) / rd.y;
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
const LAWN_Y: f32 = ${f(P.LAWN)};
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
// marble: big slabs in offset rows, each its own shade, clouded, a soft vein here and there, and on some of them
// thin dark cracks (where a ridged noise peaks)
fn travertine(p: vec2f) -> vec3f {
  let S = 0.45;
  let row = floor(p.y / S);
  let q = vec2f(p.x + 0.5 * S * (row - 2.0 * floor(row * 0.5)), p.y);
  let id = floor(q / S);
  var c = mix(U.pal[${PAL.STONE}].rgb, U.pal[${PAL.STONE2}].rgb, hash21(id));
  let w = p * 2.3 + id * 3.1;
  c *= 0.93 + 0.08 * vnoise(w * 3.0) + 0.04 * vnoise(w * 11.0);
  let vein = abs(vnoise(w * 1.7 + vec2f(vnoise(w * 4.0) * 1.5, 0.0)) - 0.5);
  c *= 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.03, vein));
  let cr = abs(vnoise(p * 4.0 + id * 5.3) + 0.5 * vnoise(p * 9.0 + 2.0) - 0.75);
  c = mix(c, vec3f(0.3, 0.24, 0.19), (1.0 - smoothstep(0.0, 0.014, cr)) * 0.8 * step(0.45, hash21(id + 9.1)));
  let fc = fract(q / S);
  let joint = 1.0 - smoothstep(0.004, 0.012, min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y)));
  return mix(c, c * 0.62, joint);
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
  let grassLevel = select(0.0, 1.0, abs(lp.y - LAWN_Y) < 0.025 || lp.y > TER + 0.05);   // the lawn and the planters' soil, not the stone faces between
  c = mix(c, mix(grass, grass * vec3f(1.12, 1.08, 0.8), smoothstep(0.6, 0.9, vnoise(x * 2.7 + 5.0)) * 0.5), smoothstep(0.3, 0.7, e.z) * step(0.5, nl.y) * grassLevel);
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
    // the bright net the ripples throw on the floor and the walls, where the sun reaches, fading with depth
    let lit = shadowAt(toWorld(lp), n);
    t *= 1.0 + causticNet(x, U.eye.w) * 1.1 * lit * exp(-max(under, 0.0) * 1.2) * step(0.0, under);
    c = t; s.rough = 0.22; s.f0 = 0.05;
  }
  s.alb = c;
  return s;
}
// the cliff: beds of pale rock, each its own tone, a dark seam between, cracks down it, wet and weedy at the foot
fn rock(u: f32, y: f32) -> vec3f {
  let w = y * 2.2 + 0.5 * vnoise(vec2f(u * 1.3, y * 1.5)) + 0.2 * sin(u * 0.9);
  var c = mix(U.pal[${PAL.ROCK}].rgb, U.pal[${PAL.ROCK2}].rgb, smoothstep(0.3, 0.7, vnoise(vec2f(u * 0.7, floor(w) * 3.7))));
  c *= 0.86 + 0.14 * smoothstep(0.0, 0.07, fract(w)) * smoothstep(1.0, 0.9, fract(w));
  c *= 0.84 + 0.12 * vnoise(vec2f(u * 18.0, y * 24.0)) + 0.08 * vnoise(vec2f(u * 90.0, y * 120.0));
  c *= 1.0 - 0.14 * smoothstep(0.6, 0.85, vnoise(vec2f(u * 12.0, y * 16.0)));   // pitted, weathered patches
  let wet = 1.0 - smoothstep(0.08, 0.3 + 0.1 * vnoise(vec2f(u * 4.0, 1.0)), y - SEA);   // wet and weedy where the sea reaches
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
// The pools' water: the sim's surface (its grid 0.04 across) with ripples finer than that, clear turquoise over the
// tiles, the sky in it and the sun's glints off the ripples; the core's light shafts and foam. And the net of
// caustics on the floor under it (groundTop).
const POOL_WATER_WGSL = /* wgsl */ `
fn rippleWave(p: vec2f, d: vec2f, len: f32, t: f32, ph: f32) -> vec2f {
  let k = 2.0 * PI / len;
  return d * (0.016 * cos(k * dot(d, p) - sqrt(9.8 * k) * 0.45 * t + ph));
}
/** The slope of small ripples on the pools, moving: four trains and a little noise, so it never repeats. */
fn ripples(p: vec2f, t: f32) -> vec2f {
  var g = rippleWave(p, vec2f(0.94, 0.34), 0.31, t, 0.0) + rippleWave(p, vec2f(-0.5, 0.87), 0.19, t, 1.7);
  g += rippleWave(p, vec2f(0.2, -0.98), 0.13, t, 3.1) + rippleWave(p, vec2f(-0.83, -0.56), 0.083, t, 4.4);
  let q = p * 9.0 + vec2f(t * 0.35, -t * 0.27);
  let n0 = vnoise(q);
  return g + vec2f(vnoise(q + vec2f(0.03, 0.0)) - n0, vnoise(q + vec2f(0.0, 0.03)) - n0) * 0.13;
}
/** The caustics' net: two layers of drifting cells, bright along the edges between them (0 to about 1). */
fn causticNet(p: vec2f, t: f32) -> f32 {
  var c = 0.0;
  for (var l = 0; l < 2; l++) {
    let q = p * select(7.0, 11.0, l == 1) + vec2f(0.11, -0.07) * t * f32(l + 1);
    let cell = floor(q);
    var f1 = 9.0;
    var f2 = 9.0;
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let g = cell + vec2f(f32(x), f32(y));
        let h = vec2f(hash21(g), hash21(g + 17.3));
        let d = length(g + 0.5 + 0.4 * sin(t * (0.6 + h) + h * 6.28) - q);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
      }
    }
    c += 1.0 - smoothstep(0.0, 0.12, f2 - f1);
  }
  return c * 0.5;
}
@fragment fn fsPoolWater(i: WOut) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy);
  let fd = distance(i.wp, V.eye.xyz);
  let od = textureLoad(distTex, px, 0).r;
  let raw = textureLoad(backTex, px, 0).r;
  let bd = select(raw, raw - 10000.0, raw > 5000.0 && raw < 50000.0);
  let path = max(min(od, bd) - fd, 0.0);
  let v = normalize(V.eye.xyz - i.wp);
  let s = water(i.lp.xz);
  let rip = ripples(i.lp.xz, U.eye.w) * smoothstep(0.0, 0.03, s.x - s.w);   // none where the water thins to nothing
  let n = nWorld(normalize(vec3f(-s.y - rip.x, 1.0, -s.z - rip.y)));
  // refraction in screen space, as the core's
  let rd = -v;
  let rr = refract(rd, n, 0.752);
  let pl = min(path, 1.2);
  let ca = V.vp * vec4f(i.wp + rd * pl, 1.0);
  let cb = V.vp * vec4f(i.wp + rr * pl, 1.0);
  let base = i.pos.xy * U.screen.zw;
  var uv = clamp(base + (cb.xy / cb.w - ca.xy / ca.w) * vec2f(0.5, -0.5), vec2f(0.001), vec2f(0.999));
  if (textureSampleLevel(distTex, linS, uv, 0.0).r < fd) { uv = base; }
  let behind = textureSampleLevel(sceneTex, linS, uv, 0.0).rgb;
  // clear water: the tiles through it, turning turquoise with depth, and the light it scatters
  let T = exp(-U.sigma.rgb * path);
  let sh = shadowAt(i.wp, n);
  var col = behind * T + U.tint.rgb * (0.9 + 0.5 * sh) * (1.0 - T);
  // light shafts: the caustics' light along the view ray inside the water
  let ro = (U.Minv * vec4f(i.wp, 1.0)).xyz;
  let rdl = normalize((U.Minv * vec4f(rr, 0.0)).xyz);
  var shaft = 0.0;
  for (var k = 0; k < 6; k++) {
    let sp = ro + rdl * (pl * (f32(k) + 0.5) / 6.0);
    let land = sp.xz + U.refr.xz * max(sp.y - water(sp.xz).w, 0.0) / max(-U.refr.y, 0.3);
    shaft += max(caustic(land) - 0.85, 0.0);
  }
  col += (vec3f(0.6) + U.tint.rgb) * shaft * 0.045 * pl * sh;
  // foam: wakes, white water, churn
  let fo = textureSampleLevel(foamTex, linS, i.lp.xz / (2.0 * HALF) + 0.5, 0.0).r;
  if (fo > 0.003) {
    let br = vnoise(i.lp.xz * 60.0 + vec2f(U.eye.w * 0.4, 0.0)) * 0.6 + vnoise(i.lp.xz * 150.0 - U.eye.w * 0.3) * 0.4;
    col = mix(col, vec3f(0.96, 0.97, 0.98) * (0.75 + 0.35 * sh), smoothstep(0.25, 0.75, fo * 1.25 + br * 0.55 - 0.3) * min(fo * 3.0, 1.0) * 0.9);
  }
  // the sky in it, and the sun glinting off the ripples
  col = mix(col, env(reflect(-v, n)), fres(dot(n, v), 0.02));
  col += sunC() * specGGX(n, v, U.sun.xyz, 0.03) * fres(dot(normalize(v + U.sun.xyz), v), 0.02) * sh * 1.5;
  return vec4f(col, 1.0);
}
`;

// A tapped duck's burst (fx.js): sprites facing the camera, each three vec4 in inst from base (position and size,
// colour and alpha, shape and turn), its shape drawn in the fragment (a drop, a bubble, a heart, a star, a petal, a
// bolt), bright, its edge smoothed whatever its size
const fxWGSL = (base) => /* wgsl */ `
const FX_BASE: u32 = ${base}u;
struct FxOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) @interpolate(flat) shape: f32, @location(3) wp: vec3f }
@vertex fn vsFx(@location(0) c: vec2f, @builtin(instance_index) ii: u32) -> FxOut {
  let b = FX_BASE + 3u * ii;
  let a = inst[b];
  let e = inst[b + 2u];
  let q = vec2f(c.x * cos(e.y) - c.y * sin(e.y), c.x * sin(e.y) + c.y * cos(e.y)) * a.w;
  var o: FxOut;
  o.wp = toWorld(a.xyz) + V.right.xyz * q.x + V.up.xyz * q.y;
  o.pos = V.vp * vec4f(o.wp, 1.0);
  o.uv = c; o.col = inst[b + 1u]; o.shape = e.x;
  return o;
}
/** Negative inside the shape (not a distance: the edge is smoothed by its screen-space rate). */
fn fxShape(p: vec2f, s: f32) -> f32 {
  let r = length(p);
  var f = r - 0.75;                                                           // a drop
  if (s > 0.5) { f = abs(r - 0.66) - 0.12; }                                 // a bubble
  if (s > 1.5) { let h = p * 1.2 + vec2f(0.0, -0.2); let x2 = h.x * h.x; f = pow(x2 + h.y * h.y - 1.0, 3.0) - x2 * h.y * h.y * h.y; }   // a heart
  if (s > 2.5) { f = r - (0.38 + 0.52 * pow(0.5 + 0.5 * cos(5.0 * (atan2(p.y, p.x) - 1.5708)), 3.0)); }   // a star, a point up
  if (s > 3.5) { f = length(p * vec2f(2.1, 1.0)) - 0.9; }                     // a petal
  if (s > 4.5) { let z = vec2f(p.x + 0.45 * p.y + 0.3 * sign(p.y) * step(0.15, abs(p.y)), p.y); f = abs(z.x) * 3.6 + abs(z.y) - 1.0; }   // a bolt
  return f;
}
@fragment fn fsFx(i: FxOut) -> FOut {
  let f = fxShape(i.uv, i.shape);
  var o: FOut;
  o.c = vec4f(i.col.rgb * (1.5 - 0.35 * length(i.uv)), clamp(0.5 - f / max(fwidth(f), 1e-4), 0.0, 1.0) * i.col.a);
  o.d = vec4f(distance(i.wp, V.eye.xyz), 0.0, 0.0, 1.0);
  return o;
}
`;
const VB_FX = [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }];

// The things for people (props.js: the models made in Blender), one mesh: each vertex its colour, its kind of surface
// and its placement, whose transform (rows) and tint are four vec4 in inst from base. Thin sheets (fronds, slings,
// panels) are lit on whichever side faces the eye; in the pools, wet and lit by the caustics, as the ducks.
const propWGSL = (base) => /* wgsl */ `
const PROP_BASE: u32 = ${base}u;
struct PrOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) lp: vec3f, @location(2) n: vec3f, @location(3) col: vec3f, @location(4) @interpolate(flat) kind: f32 }
@vertex fn vsProp(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) c: vec3f, @location(3) kind: f32, @location(4) ix: f32) -> PrOut {
  let b = PROP_BASE + 4u * u32(ix + 0.5);
  let r0 = inst[b]; let r1 = inst[b + 1u]; let r2 = inst[b + 2u];
  let lp = vec3f(dot(r0.xyz, p) + r0.w, dot(r1.xyz, p) + r1.w, dot(r2.xyz, p) + r2.w);
  var o: PrOut;
  o.wp = toWorld(lp); o.pos = V.vp * vec4f(o.wp, 1.0); o.lp = lp;
  o.n = nWorld(vec3f(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n)));
  o.col = select(c, inst[b + 3u].rgb, kind > 6.5); o.kind = kind;
  return o;
}
@fragment fn fsProp(i: PrOut) -> FOut {
  let v = normalize(V.eye.xyz - i.wp);
  var n = normalize(i.n);
  if (dot(n, v) < 0.0) { n = -n; }
  var sun = shadowAt(i.wp, n);
  var alb = i.col;
  var rough = 0.5;
  var f0 = 0.04;
  var wrap = 0.15;
  let k = u32(i.kind + 0.5);
  if (k == 0u) { rough = 0.2; f0 = 0.05; alb += vec3f(0.12) * pow(1.0 - max(dot(n, v), 0.0), 3.0); }   // vinyl: glossy, a sheen round its edge
  else if (k == 1u) { rough = 0.75; alb *= 0.78 + 0.32 * vnoise(vec2f(i.lp.x + i.lp.z, i.lp.y) * vec2f(7.0, 70.0)); }   // wood and its grain
  else if (k == 2u) { rough = 0.25; f0 = 0.6; }
  else if (k == 3u || k == 7u) { rough = 0.9; wrap = 0.35; }
  else if (k == 4u) { rough = 0.4; }
  else if (k == 5u) { rough = 0.6; wrap = 0.5; alb *= 0.85 + 0.3 * vnoise(i.lp.xz * 40.0); }
  else if (k == 6u) { rough = 0.85; }
  let ws = water(i.lp.xz);
  let under = ws.x - i.lp.y;
  if (ws.x > ws.w + 0.012 && under > -0.012) {
    alb *= 0.82; rough = min(rough, 0.2);
    if (under > 0.0) { sun *= mix(1.0, caustic(i.lp.xz) * 1.1, 0.9 * exp(-under * 1.3)); }
  }
  return opaque(lit(alb, n, v, rough, f0, sun, wrap), i.wp);
}
`;
const VB_PROP = [{ arrayStride: 44, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
  { shaderLocation: 2, offset: 24, format: 'float32x3' }, { shaderLocation: 3, offset: 36, format: 'float32' }, { shaderLocation: 4, offset: 40, format: 'float32' }] }];

// Grass: blades standing on the lawn and in the planters, one instance each, placed in the vertex stage on a jittered
// grid over each patch (kept only where the ground there is the lawn's or the planters' soil), leaning, swaying in the
// wind, darker at the root
const G_CELL = 0.022, G_RECTS = [[...P.LAWN_R.slice(0, 2), P.LAWN_R[2], P.FRONT], [P.WALL_L, P.PLANTER[0], P.planterEdge(-1, 0) + 0.3, P.PLANTER[1]], [P.planterEdge(1, 0) - 0.3, P.PLANTER[0], P.K * 2.5, P.PLANTER[1]]];
const G_NX = G_RECTS.map((r) => Math.ceil((r[2] - r[0]) / G_CELL)), G_N = G_RECTS.map((r, i) => G_NX[i] * Math.ceil((r[3] - r[1]) / G_CELL));
export const GRASS_BLADES = G_N.reduce((a, b) => a + b, 0);
const GRASS_WGSL = /* wgsl */ `
struct GrOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) col: vec3f }
@vertex fn vsGrass(@location(0) c: vec2f, @builtin(instance_index) ii: u32) -> GrOut {
  var rect = vec4f(${G_RECTS[0].map(f).join(', ')});
  var j = ii;
  var nx = ${G_NX[0]}u;
  var soil = LAWN_Y;
  if (ii >= ${G_N[0]}u) { rect = vec4f(${G_RECTS[1].map(f).join(', ')}); j = ii - ${G_N[0]}u; nx = ${G_NX[1]}u; soil = TER + 0.08; }
  if (ii >= ${G_N[0] + G_N[1]}u) { rect = vec4f(${G_RECTS[2].map(f).join(', ')}); j = ii - ${G_N[0] + G_N[1]}u; nx = ${G_NX[2]}u; }
  let cell = vec2f(f32(j % nx), f32(j / nx));
  let h = vec4f(hash21(cell + rect.xy * 7.1), hash21(cell.yx * 1.3 + 4.7), hash21(cell + 19.3), hash21(cell * 0.7 + 2.9));
  let xz = rect.xy + (cell + h.xy) * ${f(G_CELL)};
  let ground = water(xz).w;
  var o: GrOut;
  if (xz.x > rect.z || xz.y > rect.w || abs(ground - soil) > 0.01) { o.pos = vec4f(0.0, 0.0, 2.0, 1.0); return o; }   // not on grass: nothing drawn
  let yaw = h.z * 6.2832;
  let dir = vec2f(cos(yaw), sin(yaw));
  let side = vec2f(-dir.y, dir.x);
  let H = 0.07 + 0.1 * h.w;
  let t = c.y;
  let sway = 0.05 * sin(U.eye.w * 1.7 + xz.x * 2.1 + xz.y * 1.6) + 0.025 * sin(U.eye.w * 3.1 + xz.x * 5.0);
  let lean = ((0.2 + 0.35 * h.x) * H + sway) * t * t;
  let w = 0.011 * (1.0 - t) * c.x;
  let lp = vec3f(xz.x + dir.x * lean + side.x * w, ground + H * t * (1.0 - 0.15 * h.x), xz.y + dir.y * lean + side.y * w);
  o.wp = toWorld(lp);
  o.pos = V.vp * vec4f(o.wp, 1.0);
  o.n = nWorld(normalize(vec3f(dir.x * 0.6, 1.0, dir.y * 0.6)));
  let g = U.pal[0].rgb;
  o.col = mix(g * vec3f(0.45, 0.55, 0.4), mix(g, g * vec3f(1.25, 1.15, 0.7), h.y * 0.6), t) * (0.85 + 0.3 * h.w);
  return o;
}
@fragment fn fsGrass(i: GrOut) -> FOut {
  let v = normalize(V.eye.xyz - i.wp);
  let n = normalize(i.n);
  return opaque(lit(i.col, n, v, 0.75, 0.03, shadowAt(i.wp, n), 0.6), i.wp);
}
`;
const GRASS_BLADE = { vert: new Float32Array([-1, 0, 1, 0, -1, 0.35, 1, 0.35, -1, 0.7, 1, 0.7, 0, 1]), index: new Uint32Array([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]) };

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
  o.wp = vec3f(xz.x + d.x, SEA + d.y, xz.y + d.z);
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
 * sea's surface (ocean-gpu.js); props: the props' mesh (props.js loadProps). The ducks' instance data starts at duckBase(mesh) floats in inst; a frame's f.nDucks
 * says how many to draw. */
export function createRenderer(gpu, canvas, mesh, ducks, ocean, props) {
  const sea = oceanMesh();
  return createDioramaRenderer(gpu, canvas, {
    N: P.GN, half: P.HALF, terrainH: P.terrainH, terrainNormal: P.terrainNormal, groundMask: P.zones, base: P.SEA - 1.5,
    wgsl: WGSL + duckWGSL(mesh.nParts * 3) + fxWGSL(fxBase(mesh) / 4) + propWGSL(propBase(mesh) / 4) + GRASS_WGSL + POOL_WATER_WGSL + OCEAN_WGSL, waterFS: 'fsPoolWater', backdrop: backdrop(oceanSpectrum().variance),
    instFloats: propBase(mesh) + PLACEMENTS.length * PROP_FLOATS, sunColor: [2.35, 2.25, 2.05], maxBubbles: 400,
    layers: [partsLayer(mesh), { vs: 'vsDuck', fs: 'fsDuck', buffers: VB_DUCK, vert: ducks.vert, index: ducks.index, texture: ducks.texture, shadow: true, count: (f) => f.nDucks },
      { vs: 'vsOcean', fs: 'fsOcean', buffers: VB_OCEAN, vert: sea.vert, index: sea.index, texture: ocean.texture },
      { vs: 'vsProp', fs: 'fsProp', buffers: VB_PROP, vert: props.vert, index: props.index, shadow: true },
      { vs: 'vsGrass', fs: 'fsGrass', buffers: VB_FX, vert: GRASS_BLADE.vert, index: GRASS_BLADE.index, count: () => GRASS_BLADES },
      { vs: 'vsFx', fs: 'fsFx', buffers: VB_FX, vert: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), index: new Uint32Array([0, 1, 2, 0, 2, 3]), count: (f) => f.nFx }],
  });
}
/** Where the ducks' instance data starts in inst (floats): after every part's 12; then the fx sprites', after the ducks'. */
export const duckBase = (mesh) => mesh.nParts * 12;
export const fxBase = (mesh) => duckBase(mesh) + MAX_DUCKS * 16;
/** Then the props' placements' (props.js), after the fx sprites'. */
export const propBase = (mesh) => fxBase(mesh) + FX_MAX * FX_FLOATS;
