// WGSL every jelly-block diorama shares: the frame uniforms and bindings, the jelly wobble, the sea texture,
// caustics and the sun's shadow, the studio (paper, softboxes) and the lighting, the floor with the block's
// tinted shadow, the ground and its cut walls of candy strata, bubbles, the sea's surface and cut walls, the
// caustics pass and the composite. A specimen appends its own layers (vertex and fragment entry points),
// and must define groundTop() for the top of its ground and section() for its cut walls (strata() is there to call).
// A backdrop replaces the studio: WGSL defining env(r) (what reflections see), ambient(n) and the fsBG pass.
// The water may hold several bodies at their own levels: wherever a level matters, it is read from the sea texture.
//
// Palette slots (U.pal) the core reads: 0 the ground top's base, 1–5 the strata from the bottom up,
// 6–9 the pebbles pressed into the strata. The rest are the specimen's.
export const PAL = 32;

export function coreWGSL({ N, half, sunColor = [2.25, 2.15, 2.0], backdrop = STUDIO }) {
  return /* wgsl */ `
const HALF: f32 = ${half};
const GN: i32 = ${N};
const GDX: f32 = ${(2 * half) / N};
const PI: f32 = 3.14159265;
const SUNC0: vec3f = vec3f(${sunColor.join(', ')});

struct Uni {
  M: mat4x4f, Minv: mat4x4f, sunVP: mat4x4f,
  eye: vec4f,      // camera eye, w = time
  wob: vec4f,      // shear x, shear z, squash, the top water level (the block's shadow)
  sun: vec4f,      // world direction to the sun
  sunL: vec4f,     // the same in the block frame
  screen: vec4f,   // w, h, 1/w, 1/h
  sigma: vec4f,    // the water's absorption, w = exposure
  tint: vec4f,     // the water's scattered colour
  paper: vec4f,
  refr: vec4f,     // the sun refracted by a flat sea (block frame)
  sunC: vec4f,     // the sun's colour as a tint on SUNC0 (white by default; a specimen's time of day turns it)
  pal: array<vec4f, ${PAL}>,
}
struct View { vp: mat4x4f, inv: mat4x4f, eye: vec4f, right: vec4f, up: vec4f, pad: vec4f }

@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var<storage, read> inst: array<vec4f>;   // the specimen's instance data
@group(0) @binding(2) var<storage, read> bubs: array<vec4f>;
@group(1) @binding(0) var<uniform> V: View;
@group(2) @binding(0) var waterTex: texture_2d<f32>;
@group(2) @binding(1) var shadowMap: texture_depth_2d;
@group(2) @binding(2) var causticTex: texture_2d<f32>;
@group(2) @binding(3) var sceneTex: texture_2d<f32>;
@group(2) @binding(4) var distTex: texture_2d<f32>;
@group(2) @binding(5) var backTex: texture_2d<f32>;
@group(2) @binding(6) var linS: sampler;
@group(2) @binding(7) var cmpS: sampler_comparison;
@group(2) @binding(8) var foamTex: texture_2d<f32>;

struct FOut { @location(0) c: vec4f, @location(1) d: vec4f }
struct Surf { alb: vec3f, rough: f32, n: vec3f, f0: f32 }

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), u.x), mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x), u.y);
}
// the jelly wobble: shear grows with height, squash keeps the volume
fn wob(p: vec3f) -> vec3f {
  let s = U.wob.z;
  let k = inverseSqrt(1.0 + s);
  return vec3f((p.x + U.wob.x * p.y) * k, p.y * (1.0 + s), (p.z + U.wob.y * p.y) * k);
}
fn toWorld(p: vec3f) -> vec3f { return (U.M * vec4f(wob(p), 1.0)).xyz; }
fn nWorld(n: vec3f) -> vec3f { return normalize((U.M * vec4f(n, 0.0)).xyz); }
fn rotq(q: vec4f, v: vec3f) -> vec3f {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
// the sea texture (surface height, dh/dx, dh/dz, terrain), bilinear by hand (rgba32float is not filterable)
fn wtex(i: i32, j: i32) -> vec4f { return textureLoad(waterTex, vec2i(clamp(i, 0, GN - 1), clamp(j, 0, GN - 1)), 0); }
fn water(xz: vec2f) -> vec4f {
  let g = (xz + vec2f(HALF)) / GDX - 0.5;
  let f0 = floor(g);
  let f = g - f0;
  let i = i32(f0.x);
  let j = i32(f0.y);
  return mix(mix(wtex(i, j), wtex(i + 1, j), f.x), mix(wtex(i, j + 1), wtex(i + 1, j + 1), f.x), f.y);
}
fn sunC() -> vec3f { return SUNC0 * U.sunC.rgb; }
fn caustic(lxz: vec2f) -> f32 { return textureSampleLevel(causticTex, linS, lxz / (2.0 * HALF) + 0.5, 0.0).r; }
fn shadowAt(wp: vec3f, n: vec3f) -> f32 {
  let c = U.sunVP * vec4f(wp + n * 0.02, 1.0);
  let uv = c.xy * vec2f(0.5, -0.5) + 0.5;
  if (any(uv < vec2f(0.002)) || any(uv > vec2f(0.998)) || c.z > 1.0) { return 1.0; }
  var s = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      s += textureSampleCompareLevel(shadowMap, cmpS, uv + vec2f(f32(x), f32(y)) * (1.3 / 2048.0), c.z - 0.0012);
    }
  }
  return s / 9.0;
}
fn fres(c: f32, f0: f32) -> f32 { return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
fn specGGX(n: vec3f, v: vec3f, l: vec3f, r: f32) -> f32 {
  let h = normalize(v + l);
  let nh = max(dot(n, h), 0.0);
  let nl = max(dot(n, l), 0.0);
  let nv = max(dot(n, v), 1e-3);
  let a = r * r;
  let a2 = a * a;
  let d = nh * nh * (a2 - 1.0) + 1.0;
  let k = a * 0.5;
  return a2 / (PI * d * d) * 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k)) * nl;
}
fn lit(alb: vec3f, n: vec3f, v: vec3f, rough: f32, f0: f32, sun: f32, wrap: f32) -> vec3f {
  let L = U.sun.xyz;
  let ndl = max((dot(n, L) + wrap) / (1.0 + wrap), 0.0);
  var c = alb * (sunC() * 0.55 * ndl * sun + ambient(n));
  let F = fres(dot(n, v), f0);
  c += env(reflect(-v, n)) * F * (1.0 - rough) * (1.0 - rough);
  c += sunC() * specGGX(n, v, L, max(rough, 0.05)) * sun * fres(dot(normalize(v + L), v), f0);
  return c;
}
fn opaque(c: vec3f, wp: vec3f) -> FOut {
  var o: FOut;
  o.c = vec4f(c, 1.0);
  o.d = vec4f(distance(wp, V.eye.xyz), 0.0, 0.0, 1.0);
  return o;
}

${backdrop}
// ----- fullscreen -----
@vertex fn vsFull(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
// the floor's shadow of the block: the sun ray through the sea slab, tinted by absorption, flecked by caustics
fn blockShadow(p: vec3f) -> vec3f {
  let o = (U.Minv * vec4f(p, 1.0)).xyz;
  let d0 = U.sunL.xyz;
  let d = select(d0, vec3f(1e-5), abs(d0) < vec3f(1e-5));
  let inv = 1.0 / d;
  let t0 = (vec3f(-HALF, 0.0, -HALF) - o) * inv;
  let t1 = (vec3f(HALF, U.wob.w, HALF) - o) * inv;
  let tn = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
  let tf = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
  if (tf <= max(tn, 0.0)) { return vec3f(1.0); }
  let len = tf - max(tn, 0.0);
  let top = o + d * tf;
  let tr = exp(-U.sigma.rgb * len * 0.75) * (0.62 + 0.4 * caustic(top.xz));
  return min(tr, vec3f(1.0));
}

// ----- the ground and its cut walls (extra: top = the specimen's masks a, 0, b, c / wall = perimeter u, 1, terrain top, 0) -----
struct GOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) lp: vec3f, @location(2) n: vec3f, @location(3) e: vec4f }
@vertex fn vsGround(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) e: vec4f) -> GOut {
  var o: GOut;
  let w = toWorld(p);
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.lp = p; o.n = nWorld(n); o.e = e;
  return o;
}
fn strata(u: f32, y: f32, top: f32) -> vec3f {
  let b1 = 0.15 + 0.016 * sin(u * 4.7 + 1.0) + 0.008 * sin(u * 12.3);
  let b2 = 0.31 + 0.02 * sin(u * 3.9 + 2.0) + 0.007 * sin(u * 15.1 + 0.4);
  let b3 = b2 + 0.034 + 0.006 * sin(u * 9.0);
  let b4 = top - 0.075 - 0.012 * sin(u * 7.3 + 0.7);
  let aa = 0.003;
  var c = U.pal[1].rgb;
  c = mix(c, U.pal[2].rgb, smoothstep(b1 - aa, b1 + aa, y));
  c = mix(c, U.pal[3].rgb, smoothstep(b2 - aa, b2 + aa, y));
  c = mix(c, U.pal[4].rgb, smoothstep(b3 - aa, b3 + aa, y));
  c = mix(c, U.pal[5].rgb, smoothstep(b4 - aa, b4 + aa, y));
  c *= 0.93 + 0.09 * vnoise(vec2f(u * 34.0, y * 70.0));
  // pebbles pressed into the section
  let g = vec2f(u, y) * 10.0;
  let cell = floor(g);
  let f = fract(g);
  let h = hash21(cell);
  if (h < 0.3 && y < b4 - 0.04 && y > 0.03 && abs(y - b2 - 0.017) > 0.04) {
    let cp = vec2f(0.32) + 0.36 * vec2f(hash21(cell + 3.1), hash21(cell + 7.7));
    let rad = 0.13 + 0.13 * hash21(cell + 1.7);
    let d = length((f - cp) * vec2f(1.0, 1.3));
    let pc = U.pal[6u + u32(h * 13.0) % 4u].rgb;
    let shade = 0.78 + 0.32 * clamp(1.0 - d / rad, 0.0, 1.0) + 0.15 * clamp((f.y - cp.y) / rad, -1.0, 1.0);
    c = mix(c * (1.0 - 0.35 * smoothstep(rad + 0.05, rad, d)), pc * shade, smoothstep(rad, rad - 0.03, d));
  }
  return c;
}
@fragment fn fsGround(i: GOut) -> FOut {
  let v = normalize(V.eye.xyz - i.wp);
  var n = normalize(i.n);
  var alb: vec3f;
  var rough = 0.85;
  var f0 = 0.03;
  var sun = shadowAt(i.wp, n);
  if (i.e.y < 0.5) {   // the top: the specimen's ground, darker and glossier where wet, caustics under the sea
    let s = groundTop(i.lp, n, i.e);
    alb = s.alb; rough = s.rough; n = s.n; f0 = s.f0;
    let y = i.lp.y;
    let lvl = water(i.lp.xz).x;
    let wet = 1.0 - smoothstep(lvl + 0.012, lvl + 0.085, y);
    alb *= mix(1.0, 0.68, wet);
    rough = mix(rough, min(rough, 0.42), wet);
    let depth = lvl - y;
    if (depth > 0.0) {
      let k = exp(-depth * 1.3);
      sun *= mix(1.0, caustic(i.lp.xz) * 1.1, 0.92 * k);
    }
  } else {             // the cut wall: candy strata in section
    alb = section(i.lp, i.e.x, i.e.z);
    rough = 0.55;
  }
  return opaque(lit(alb, n, v, rough, f0, sun, 0.1), i.wp);
}

// ----- bubbles (rising and decor), blended, no distance -----
struct BbOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f }
@vertex fn vsBubble(@location(0) p: vec3f, @builtin(instance_index) ii: u32) -> BbOut {
  let b = bubs[ii];
  var o: BbOut;
  let w = toWorld(b.xyz + p * b.w);
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.n = nWorld(p);
  return o;
}
@fragment fn fsBubble(i: BbOut) -> FOut {
  let n = normalize(i.n);
  let v = normalize(V.eye.xyz - i.wp);
  let rim = pow(1.0 - abs(dot(n, v)), 2.2);
  let r = reflect(-v, n);
  let hl = pow(max(dot(r, U.sun.xyz), 0.0), 160.0) * 5.0;
  var o: FOut;
  o.c = vec4f(env(r) * 0.95 * rim + vec3f(hl), clamp(0.05 + 0.8 * rim + hl, 0.0, 1.0));
  o.d = vec4f(0.0);
  return o;
}

// ----- the sea: surface grid and the four cut walls -----
struct WOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) lp: vec3f, @location(2) n: vec3f, @location(3) @interpolate(flat) kind: u32 }
@vertex fn vsWater(@builtin(vertex_index) vi: u32) -> WOut {
  let n1 = u32(GN) + 1u;
  let xz = vec2f(-HALF + f32(vi % n1) * GDX, -HALF + f32(vi / n1) * GDX);
  let s = water(xz);
  let lp = vec3f(xz.x, s.x, xz.y);
  var o: WOut;
  let w = toWorld(lp);
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.lp = lp; o.n = nWorld(normalize(vec3f(-s.y, 1.0, -s.z))); o.kind = 0u;
  return o;
}
@vertex fn vsWall(@location(0) a: vec4f, @location(1) nn: vec2f) -> WOut {
  var y = a.z;
  if (a.w > 0.5) { y = max(water(a.xy).x, a.z); }
  let lp = vec3f(a.x, y, a.y);
  var o: WOut;
  let w = toWorld(lp);
  o.pos = V.vp * vec4f(w, 1.0);
  o.wp = w; o.lp = lp; o.n = nWorld(vec3f(nn.x, 0.0, nn.y)); o.kind = 1u;
  return o;
}
@fragment fn fsWaterBack(i: WOut) -> @location(0) vec4f {
  let d = distance(i.wp, V.eye.xyz);
  return vec4f(select(d, d + 10000.0, i.kind == 1u), 0.0, 0.0, 1.0);
}
@fragment fn fsWater(i: WOut) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy);
  let fd = distance(i.wp, V.eye.xyz);
  let od = textureLoad(distTex, px, 0).r;
  let raw = textureLoad(backTex, px, 0).r;
  let wall = raw > 5000.0 && raw < 50000.0;
  let bd = select(raw, raw - 10000.0, wall);
  let path = max(min(od, bd) - fd, 0.0);
  let v = normalize(V.eye.xyz - i.wp);
  var n = normalize(i.n);
  if (i.kind == 0u) {
    let s = water(i.lp.xz);
    n = nWorld(normalize(vec3f(-s.y, 1.0, -s.z)));
  }
  // screen-space refraction: where the refracted ray would land vs the straight one
  let rd = -v;
  let rr = refract(rd, n, 0.752);
  let pl = min(path, 1.2);
  let ca = V.vp * vec4f(i.wp + rd * pl, 1.0);
  let cb = V.vp * vec4f(i.wp + rr * pl, 1.0);
  let base = i.pos.xy * U.screen.zw;
  var uv = clamp(base + (cb.xy / cb.w - ca.xy / ca.w) * vec2f(0.5, -0.5), vec2f(0.001), vec2f(0.999));
  if (textureSampleLevel(distTex, linS, uv, 0.0).r < fd) { uv = base; }
  let behind = textureSampleLevel(sceneTex, linS, uv, 0.0).rgb;
  // Beer–Lambert; a far cut wall as the exit reads as a deep slab
  var p2 = path;
  if (wall && bd < od) { p2 += 0.3; }
  let T = exp(-U.sigma.rgb * p2);
  let sh = shadowAt(i.wp, n);
  var col = behind * T + U.tint.rgb * (1.1 + 0.6 * sh) * (1.0 - T);
  // light shafts: caustic light along the view ray inside the water
  let ro = (U.Minv * vec4f(i.wp, 1.0)).xyz;
  let rdl = normalize((U.Minv * vec4f(rr, 0.0)).xyz);
  var shaft = 0.0;
  for (var k = 0; k < 6; k++) {
    let sp = ro + rdl * (pl * (f32(k) + 0.5) / 6.0);
    let g = water(sp.xz).w;
    let land = sp.xz + U.refr.xz * max(sp.y - g, 0.0) / max(-U.refr.y, 0.3);
    shaft += max(caustic(land) - 0.85, 0.0);
  }
  col += (vec3f(0.6) + U.tint.rgb) * shaft * 0.045 * pl * sh;
  // foam: wakes, white water, churn (broken up so it reads as froth)
  if (i.kind == 0u) {
    let fo = textureSampleLevel(foamTex, linS, i.lp.xz / (2.0 * HALF) + 0.5, 0.0).r;
    if (fo > 0.003) {
      let br = vnoise(i.lp.xz * 60.0 + vec2f(U.eye.w * 0.4, 0.0)) * 0.6 + vnoise(i.lp.xz * 150.0 - U.eye.w * 0.3) * 0.4;
      let a = smoothstep(0.25, 0.75, fo * 1.25 + br * 0.55 - 0.3) * min(fo * 3.0, 1.0);
      col = mix(col, vec3f(0.96, 0.97, 0.98) * (0.75 + 0.35 * sh), a * 0.9);
    }
  }
  // Fresnel studio reflection and the sun
  let F = fres(dot(n, v), 0.02);
  col = mix(col, env(reflect(-v, n)), F);
  col += sunC() * specGGX(n, v, U.sun.xyz, 0.05) * fres(dot(normalize(v + U.sun.xyz), v), 0.02) * sh;
  // rim line where the sea meets the glassy cut wall, the meniscus and faint corner lines
  if (i.kind == 0u) {
    let edge = HALF - max(abs(i.lp.x), abs(i.lp.z));
    let rim = 1.0 - smoothstep(0.0, 0.012, edge);
    let men = smoothstep(0.012, 0.028, edge) * (1.0 - smoothstep(0.028, 0.08, edge));
    col = col * (1.0 - 0.12 * men) + vec3f(0.85) * rim;
  } else {
    let dt = water(i.lp.xz).x - i.lp.y;
    let rim = 1.0 - smoothstep(0.0, 0.011, dt);
    let men = smoothstep(0.011, 0.022, dt) * (1.0 - smoothstep(0.022, 0.07, dt));
    let cd = HALF - min(abs(i.lp.x), abs(i.lp.z));
    let corner = 1.0 - smoothstep(0.0, 0.009, cd);
    col = col * (1.0 - 0.16 * men) + vec3f(0.95) * rim + vec3f(0.22) * corner + env(reflect(-v, n)) * 0.04;
  }
  return vec4f(col, 1.0);
}

// ----- caustics: one vertex per sea cell, refracted onto the seabed; brightness = area ratio -----
struct COut { @builtin(position) pos: vec4f, @location(0) c: vec2f, @location(1) wet: f32 }
@vertex fn vsCaustic(@builtin(vertex_index) vi: u32) -> COut {
  let i = i32(vi % u32(GN));
  let j = i32(vi / u32(GN));
  let w = textureLoad(waterTex, vec2i(i, j), 0);
  let xz = vec2f(-HALF + (f32(i) + 0.5) * GDX, -HALF + (f32(j) + 0.5) * GDX);
  let ys = w.x;
  let n = normalize(vec3f(-w.y, 1.0, -w.z));
  let r = refract(-U.sunL.xyz, n, 0.752);
  let dn = max(-r.y, 0.2);
  var q = xz + r.xz * max(ys - w.w, 0.0) / dn;
  q = xz + r.xz * max(ys - water(q).w, 0.0) / dn;
  var o: COut;
  o.pos = vec4f(q.x / HALF, -q.y / HALF, 0.0, 1.0);
  o.c = xz;
  o.wet = select(0.0, 1.0, ys - w.w > 0.012);
  return o;
}
@fragment fn fsCaustic(i: COut) -> @location(0) vec4f {
  let dx = dpdx(i.c);
  let dy = dpdy(i.c);
  let pix = 2.0 * HALF / 768.0;
  let a = abs(dx.x * dy.y - dx.y * dy.x) / (pix * pix);
  return vec4f(clamp(a, 0.0, 5.0) * i.wet, 0.0, 0.0, 1.0);
}

// ----- copy and composite -----
@fragment fn fsCopy(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  return vec4f(textureLoad(sceneTex, vec2i(fp.xy), 0).rgb, 1.0);
}
fn shoulder(c: vec3f) -> vec3f {
  let k = 0.8;
  let s = vec3f(k) + (1.0 - k) * (1.0 - exp(-(c - vec3f(k)) / (1.0 - k)));
  return select(c, s, c > vec3f(k));
}
@fragment fn fsComposite(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let c = clamp(shoulder(max(textureLoad(sceneTex, vec2i(fp.xy), 0).rgb * U.sigma.w, vec3f(0.0))), vec3f(0.0), vec3f(1.0));
  let s = select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308));
  return vec4f(s + (hash21(fp.xy) - 0.5) / 255.0, 1.0);
}
`;
}

// The studio: paper all round, the floor with the block's tinted shadow; the default backdrop.
const STUDIO = /* wgsl */ `
// the studio as seen in reflections: paper all round, an overhead softbox, a back-left strip, a cool fill card
fn env(r: vec3f) -> vec3f {
  let paper = U.paper.rgb;
  var c = paper * (0.8 + 0.2 * clamp(r.y, -0.2, 1.0));
  c += vec3f(2.4, 2.35, 2.3) * smoothstep(0.8, 0.95, r.y);
  c += vec3f(1.5, 1.45, 1.4) * smoothstep(0.94, 0.985, dot(r, normalize(vec3f(-0.8, 0.3, -0.52))));
  c += vec3f(0.35, 0.45, 0.6) * smoothstep(0.75, 0.95, dot(r, normalize(vec3f(0.85, 0.15, 0.5))));
  return mix(c, paper * 0.62, smoothstep(0.0, -0.3, r.y));
}
fn ambient(n: vec3f) -> vec3f { return U.paper.rgb * mix(0.3, 0.6, n.y * 0.5 + 0.5); }
@fragment fn fsBG(@builtin(position) fp: vec4f) -> FOut {
  let uv = fp.xy * U.screen.zw;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let a = V.inv * vec4f(ndc, 0.0, 1.0);
  let b = V.inv * vec4f(ndc, 1.0, 1.0);
  let ro = V.eye.xyz;
  let rd = normalize(b.xyz / b.w - a.xyz / a.w);
  let paper = U.paper.rgb;
  var col = paper * (1.0 + 0.025 * clamp(rd.y, 0.0, 1.0));
  var dist = 1e4;
  if (rd.y < -1e-4) {
    let t = -ro.y / rd.y;
    let p = ro + rd * t;
    dist = t;
    let light = blockShadow(p) * shadowAt(p, vec3f(0.0, 1.0, 0.0));
    let pl = (U.Minv * vec4f(p, 1.0)).xyz;
    let dq = length(max(abs(pl.xz) - vec2f(HALF), vec2f(0.0)));
    let ao = 1.0 - 0.4 * exp(-dq * 10.0);
    let c = paper * mix(vec3f(0.58, 0.58, 0.62), vec3f(1.0), light) * ao;
    col = mix(c, paper, smoothstep(14.0, 40.0, t));
  }
  let q = uv - 0.5;
  col *= 1.0 - 0.14 * smoothstep(0.12, 0.5, dot(q, q));
  var o: FOut;
  o.c = vec4f(col, 1.0);
  o.d = vec4f(dist, 0.0, 0.0, 1.0);
  return o;
}
`;
