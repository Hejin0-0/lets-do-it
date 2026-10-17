// Island Jelly's renderer: the shared diorama renderer (the sea, caustics, shadows, the ground and its
// strata, the composite) with the island's own parts: sand and reef rock on top of the ground, the gummy
// palms, the pebbles and coconuts. Everything inside the block goes through wob() then the block matrix.
import { createDioramaRenderer, icosphere, UO } from '@lid/diorama/renderer.js';
import { IJ } from './world.js';

/** Palette slots (U.pal): 0 sand, 1–5 strata, 6–9 pebbles (the core's), then the island's own. */
export const PAL = { LEAF: 10, TRUNK: 11, COCO: 12, PALM: 13 };   // PALM..PALM+2: bend x, bend z, height, flutter
export { UO };

const WGSL = /* wgsl */ `
// ----- the top of the ground: sand with its ripples, the reef rocks a caramel candy rock -----
fn groundTop(lp: vec3f, n: vec3f, e: vec4f) -> Surf {
  let x = lp.xz;
  let g1 = vnoise(x * 95.0);
  let g2 = vnoise(x * 23.0 + 7.0);
  var s: Surf;
  s.alb = U.pal[0].rgb * (0.86 + 0.16 * g1 + 0.08 * g2);
  s.alb = mix(s.alb, U.pal[2].rgb * (0.62 + 0.3 * g1), e.x);
  let rip = cos(x.x * 17.0 + x.y * 6.0 + 1.3 * sin(x.y * 3.1));
  s.n = normalize(n + nWorld(vec3f(17.0, 0.0, 6.0)) * rip * 0.03 * (1.0 - e.x));
  s.rough = 0.85; s.f0 = 0.03;
  return s;
}

fn section(lp: vec3f, u: f32, top: f32) -> vec3f { return strata(u, lp.y, top); }

// ----- gummy palms -----
struct POut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) e: vec4f }
@vertex fn vsPalm(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) e: vec4f) -> POut {
  let pd = U.pal[${PAL.PALM}u + u32(e.x + 0.5)];
  let w2 = e.y * e.y;
  var q = p + vec3f(pd.x * w2, -0.5 * dot(pd.xy, pd.xy) * w2 / pd.z, pd.y * w2);
  let t = U.eye.w;
  q += n * (sin(t * 6.3 + e.w) * 0.6 + sin(t * 11.7 + e.w * 1.7) * 0.4) * e.z * 0.014 * pd.w;
  var o: POut;
  let w = toWorld(q);
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.n = nWorld(n); o.uv = uv; o.e = e;
  return o;
}
@fragment fn fsPalm(i: POut) -> FOut {
  let v = normalize(V.eye.xyz - i.wp);
  var n = normalize(i.n);
  if (dot(n, v) < 0.0 && i.uv.x > 1.5) { n = -n; }   // leaves are two-sided
  var alb: vec3f;
  var trans = 0.25;
  if (i.uv.x > 1.5) {
    let s = i.uv.y;
    let across = clamp(i.uv.x - 2.0, 0.0, 1.0);
    alb = U.pal[${PAL.LEAF}].rgb * (0.72 + 0.4 * s) * (0.88 + 0.22 * across);
    alb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.06, across));
    trans = 0.7;
  } else {
    let r = fract(i.uv.y);
    let band = smoothstep(0.0, 0.2, r) * smoothstep(1.0, 0.8, r);
    alb = U.pal[${PAL.TRUNK}].rgb * (0.62 + 0.42 * band) * (0.92 + 0.12 * vnoise(i.uv * vec2f(6.0, 3.0)));
  }
  let sun = shadowAt(i.wp, n);
  var c = lit(alb, n, v, 0.3, 0.045, sun, 0.35);
  let back = pow(max(dot(-v, U.sun.xyz), 0.0), 3.0) * 0.8 + 0.3 * pow(1.0 - abs(dot(n, v)), 2.0);
  c += alb * alb * sunC() * 0.55 * trans * back * (0.3 + 0.7 * sun);
  return opaque(c, i.wp);
}

// ----- bodies: pebbles and coconuts; per body in inst: (p, r), q, (colour, kind, id, -), (squash, -, -, -) -----
struct BOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) o: vec3f, @location(3) @interpolate(flat) id: u32 }
@vertex fn vsBody(@location(0) p: vec3f, @builtin(instance_index) ii: u32) -> BOut {
  let bp = inst[4u * ii];
  let s = inst[4u * ii + 3u].x;
  let r = rotq(inst[4u * ii + 1u], p);
  let lp = bp.xyz + vec3f(r.x * (1.0 + 0.5 * s), r.y * (1.0 - s), r.z * (1.0 + 0.5 * s)) * bp.w;
  var o: BOut;
  let w = toWorld(lp);
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.n = nWorld(r); o.o = p; o.id = ii;
  return o;
}
@fragment fn fsBody(i: BOut) -> FOut {
  let bc = inst[4u * i.id + 2u];
  let n = normalize(i.n);
  let v = normalize(V.eye.xyz - i.wp);
  let sun = shadowAt(i.wp, n);
  var c: vec3f;
  if (bc.y > 0.5) {   // coconut: fibrous shell, a lighter cap and three eyes
    let o = i.o;
    let lon = atan2(o.z, o.x);
    let fib = vnoise(vec2f(lon * 7.0, o.y * 22.0)) * 0.6 + vnoise(vec2f(lon * 19.0, o.y * 64.0)) * 0.4;
    let coco = U.pal[${PAL.COCO}].rgb;
    var alb = coco * (0.6 + 0.55 * fib);
    alb = mix(alb, coco * 1.9 + vec3f(0.06, 0.04, 0.02), smoothstep(0.78, 0.92, o.y));
    for (var k = 0; k < 3; k++) {
      let a = f32(k) * 2.094 + 0.4;
      let e = normalize(vec3f(cos(a) * 0.3, 0.95, sin(a) * 0.3));
      alb *= 1.0 - 0.75 * smoothstep(0.994, 0.998, dot(o, e));
    }
    c = lit(alb, n, v, 0.55, 0.04, sun, 0.15);
  } else {             // pebble: smooth pastel candy
    let alb = U.pal[6u + u32(bc.x + 0.5) % 4u].rgb * (0.94 + 0.08 * vnoise(i.o.xz * 9.0 + i.o.y * 4.0));
    c = lit(alb, n, v, 0.2, 0.05, sun, 0.3);
    c += alb * alb * 0.18 * pow(1.0 - abs(dot(n, v)), 2.0);
  }
  return opaque(c, i.wp);
}
`;

const VB_PALM = [{ arrayStride: 48, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' }, { shaderLocation: 3, offset: 32, format: 'float32x4' }] }];
const VB_SPHERE = [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }];

/** gpu: { device, context, format } from the page (device: the specimen's resource scope). */
export async function createRenderer(gpu, canvas) {
  const PM = IJ.palmMesh(), SP = icosphere(2);
  return createDioramaRenderer(gpu, canvas, {
    N: IJ.GN, half: IJ.HALF, terrainH: IJ.terrainH, terrainNormal: IJ.terrainNormal, groundMask: IJ.rockMask,
    wgsl: WGSL, instFloats: IJ.MAX_BODIES * 16,
    layers: [
      { vs: 'vsPalm', fs: 'fsPalm', buffers: VB_PALM, vert: PM.vert, index: PM.index, shadow: true },
      { vs: 'vsBody', fs: 'fsBody', buffers: VB_SPHERE, vert: SP.pos, index: SP.index, shadow: true, cull: 'back', count: (f) => f.nBodies },
    ],
  });
}
