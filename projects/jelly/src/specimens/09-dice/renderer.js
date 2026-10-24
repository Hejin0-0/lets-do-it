// Jelly Dice's renderer: candy dice on a frosted plate, its own passes (layered refraction, ray-traced
// studio, plate and table). It draws on the page's shared device; the specimen's resource scope frees
// what it allocates.
import { M4, srgbToLinear, backdropRadiance } from '../../core/math.js';
import { DiceGeo } from './geo.js';
// ---------------------------------------------------------------------------
// WGSL
// ---------------------------------------------------------------------------
/** Compute: the deformation gradient F at every lattice node (the average of its tets' F = Ds Dm^-1),
 *  then every embedded point (skin, pips): position by its barycentric weights, normal = cof(F) n0 with
 *  F interpolated the same way, so normals follow the jelly's local deformation and stay smooth. */
const WGSL_SKIN = /* wgsl */`
struct Emb { idx: vec4u, w: vec4f };
struct Counts { nodes: u32, points: u32, a: u32, b: u32 };
@group(0) @binding(0) var<storage, read> nodes: array<vec4f>;
@group(0) @binding(1) var<storage, read> tets: array<vec4u>;
@group(0) @binding(2) var<storage, read> dmInv: array<vec4f>;       // 3 columns per tet
@group(0) @binding(3) var<storage, read> nodeTetOff: array<u32>;
@group(0) @binding(4) var<storage, read> nodeTet: array<u32>;
@group(0) @binding(5) var<storage, read_write> nodeF: array<vec4f>; // 3 columns per node
@group(0) @binding(6) var<storage, read> emb: array<Emb>;
@group(0) @binding(7) var<storage, read> restN: array<vec4f>;       // rest normal, w = die index
@group(0) @binding(8) var<storage, read_write> outPos: array<vec4f>; // w = die index
@group(0) @binding(9) var<storage, read_write> outNrm: array<vec4f>;
@group(0) @binding(10) var<uniform> C: Counts;

@compute @workgroup_size(64) fn nodeGrad(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= C.nodes) { return; }
  var F = mat3x3f(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  let a = nodeTetOff[i]; let b = nodeTetOff[i + 1u];
  for (var k = a; k < b; k++) {
    let t = nodeTet[k];
    let q = tets[t];
    let x0 = nodes[q.x].xyz;
    let Ds = mat3x3f(nodes[q.y].xyz - x0, nodes[q.z].xyz - x0, nodes[q.w].xyz - x0);
    let Dm = mat3x3f(dmInv[3u * t].xyz, dmInv[3u * t + 1u].xyz, dmInv[3u * t + 2u].xyz);
    F += Ds * Dm;
  }
  let s = 1.0 / f32(max(b - a, 1u));
  nodeF[3u * i] = vec4f(F[0] * s, 0.0); nodeF[3u * i + 1u] = vec4f(F[1] * s, 0.0); nodeF[3u * i + 2u] = vec4f(F[2] * s, 0.0);
}
@compute @workgroup_size(64) fn skin(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= C.points) { return; }
  let e = emb[i];
  let p = nodes[e.idx.x].xyz * e.w.x + nodes[e.idx.y].xyz * e.w.y + nodes[e.idx.z].xyz * e.w.z + nodes[e.idx.w].xyz * e.w.w;
  let ax = 3u * e.idx.x; let ay = 3u * e.idx.y; let az = 3u * e.idx.z; let aw = 3u * e.idx.w;
  let f0 = nodeF[ax].xyz * e.w.x + nodeF[ay].xyz * e.w.y + nodeF[az].xyz * e.w.z + nodeF[aw].xyz * e.w.w;
  let f1 = nodeF[ax + 1u].xyz * e.w.x + nodeF[ay + 1u].xyz * e.w.y + nodeF[az + 1u].xyz * e.w.z + nodeF[aw + 1u].xyz * e.w.w;
  let f2 = nodeF[ax + 2u].xyz * e.w.x + nodeF[ay + 2u].xyz * e.w.y + nodeF[az + 2u].xyz * e.w.z + nodeF[aw + 2u].xyz * e.w.w;
  let r = restN[i];
  // cof(F) = det(F) F^-T, whose columns are (f1 x f2, f2 x f0, f0 x f1)
  let n = cross(f1, f2) * r.x + cross(f2, f0) * r.y + cross(f0, f1) * r.z;
  outPos[i] = vec4f(p, r.w);
  outNrm[i] = vec4f(normalize(n + vec3f(0.0, 1e-9, 0.0)), 0.0);
}
`;

/** Frame uniforms, the studio, noise, tone mapping, the plate's shape. */
const WGSL_COMMON = /* wgsl */`
struct Frame {
  viewProj: mat4x4f,
  invViewProj: mat4x4f,
  camPos: vec4f,     // xyz, w = time
  camRight: vec4f,
  camUp: vec4f,
  screen: vec4f,     // w, h, 1/w, 1/h
  shadow: vec4f,     // height map: centre x, centre z, half size, radius of interest
  view: vec4f,       // exposure, mesh overlay alpha, -, -
  base: vec4f,       // backdrop radiance that tone-maps to the page colour
  lightMat: mat4x4f, // ortho projection along the key light (shadow map)
  plate: vec4f,      // half x, half z, corner radius, thickness
  plate2: vec4f,     // rim tube radius, rim inset (inner face), rim centre height, -
};
struct Candy { absorb: vec4f, glow: vec4f };   // Beer-Lambert per unit length (rgb), w = density; glow tint, w = haze
struct Mats { m: array<Candy, 8> };
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<storage, read> skinPos: array<vec4f>;
@group(0) @binding(2) var<storage, read> skinNrm: array<vec4f>;
@group(0) @binding(3) var<uniform> M: Mats;
@group(0) @binding(4) var<storage, read> nodes: array<vec4f>;

const PI = 3.14159265;
const KEY = vec3f(-0.3203, 0.9008, 0.2936);   // big overhead softbox, a little front-left
const RIM = vec3f(-0.6141, 0.3584, -0.7032);  // tall strip light, back left
const FILL = vec3f(0.9076, 0.2346, 0.3481);   // cool fill card, right
const IOR = 1.45;

fn hashu(x: u32) -> u32 {
  var v = x * 747796405u + 2891336453u;
  v = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u;
  return (v >> 22u) ^ v;
}
fn hash3(p: vec3f) -> f32 {
  let q = vec3u(vec3i(p) + vec3i(4096));
  return f32(hashu(q.x ^ hashu(q.y ^ hashu(q.z)))) * (1.0 / 4294967295.0);
}
fn vnoise(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3f(1, 0, 0)), u.x), mix(hash3(i + vec3f(0, 1, 0)), hash3(i + vec3f(1, 1, 0)), u.x), u.y),
             mix(mix(hash3(i + vec3f(0, 0, 1)), hash3(i + vec3f(1, 0, 1)), u.x), mix(hash3(i + vec3f(0, 1, 1)), hash3(i + vec3f(1, 1, 1)), u.x), u.y), u.z);
}
fn softbox(d: vec3f, c: vec3f, hs: vec2f, soft: f32) -> f32 {
  let w = dot(d, c);
  if (w <= 0.05) { return 0.0; }
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(c.y) > 0.9);
  let t1 = normalize(cross(up, c));
  let t2 = cross(c, t1);
  let q = abs(vec2f(dot(d, t1), dot(d, t2)) / w) - hs;
  return (1.0 - smoothstep(-soft, soft, q.x)) * (1.0 - smoothstep(-soft, soft, q.y));
}
// The studio as seen in reflections: a dim warm surround, the warm paper sweep below the horizon,
// the big overhead softbox, the back-left strip and the cool fill card.
fn env(d: vec3f, rough: f32) -> vec3f {
  var c = mix(vec3f(0.30, 0.285, 0.26), vec3f(0.15, 0.145, 0.14), smoothstep(0.0, 0.9, d.y));
  c = mix(c, F.base.rgb * 0.62, smoothstep(0.02, -0.35, d.y));
  let s = 0.02 + rough * 0.7;
  let a = 1.0 / (1.0 + rough * 7.0);
  c += vec3f(1.0, 0.975, 0.94) * 6.5 * a * softbox(d, KEY, vec2f(0.62, 0.46), s);
  c += vec3f(1.0, 0.98, 0.96) * 3.4 * a * softbox(d, RIM, vec2f(0.12, 0.85), s);
  c += vec3f(0.80, 0.88, 1.0) * 1.1 * a * softbox(d, FILL, vec2f(0.38, 0.5), s * 2.0 + 0.05);
  return c;
}
fn ggx(N: vec3f, V: vec3f, L: vec3f, rough: f32) -> f32 {
  let H = normalize(V + L);
  let a = max(rough * rough, 0.002);
  let nh = max(dot(N, H), 0.0); let nl = max(dot(N, L), 0.0); let nv = max(dot(N, V), 0.001);
  let dd = nh * nh * (a * a - 1.0) + 1.0;
  let D = a * a / (PI * dd * dd);
  let k = a * 0.5;
  let G = nl / (nl * (1.0 - k) + k) * nv / (nv * (1.0 - k) + k);
  return D * G / (4.0 * nv + 1e-4);
}
// Khronos PBR Neutral tone mapping: keeps hue, rolls highlights off gently.
fn neutral(c0: vec3f) -> vec3f {
  var c = c0;
  let x = min(c.r, min(c.g, c.b));
  c -= select(0.04, x - 6.25 * x * x, x < 0.08);
  let peak = max(c.r, max(c.g, c.b));
  if (peak < 0.76) { return c; }
  let np = 1.0 - 0.0576 / (peak - 0.52);
  c *= np / peak;
  return mix(c, vec3f(np), 1.0 - 1.0 / (0.15 * (peak - np) + 1.0));
}
fn present(c: vec3f, px: vec2f) -> vec4f {
  let t = clamp(neutral(max(c, vec3f(0.0)) * F.view.x), vec3f(0.0), vec3f(1.0));
  let s = select(1.055 * pow(t, vec3f(1.0 / 2.4)) - 0.055, t * 12.92, t <= vec3f(0.0031308));
  let n = f32(hashu(u32(px.x) * 1973u + u32(px.y) * 9277u)) * (1.0 / 4294967295.0) - 0.5;   // dither
  return vec4f(s + n / 255.0, 1.0);
}

// ---------- the plate: a frosted-glass slab with a rolled edge and a raised rolled rim ----------
fn sdRoundRect(p: vec2f, h: vec2f, r: f32) -> f32 {
  let q = abs(p) - h + r;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}
fn smin(a: f32, b: f32, k: f32) -> f32 { let h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
fn plateSdf(p: vec3f) -> f32 {
  let tr = F.plate.w * 0.5;
  let e = sdRoundRect(p.xz, F.plate.xy - tr, F.plate.z - tr);
  let slab = length(vec2f(max(e, 0.0), p.y + tr)) - tr;
  let c = F.plate2.y - F.plate2.x;   // the tube's centre line, inset from the edge
  let rim = length(vec2f(sdRoundRect(p.xz, F.plate.xy - c, F.plate.z - c), p.y - F.plate2.z)) - F.plate2.x;
  return smin(slab, rim, 0.07);
}
`;

/** Render passes. */
const WGSL_PASSES = /* wgsl */`
@group(1) @binding(0) var texA: texture_2d<f32>;   // what is behind (colour + distance), or the height map
@group(1) @binding(1) var texB: texture_2d<f32>;   // nearest back-face distance, or the key-light map
@group(1) @binding(2) var texC: texture_2d<f32>;   // the backdrop alone (colour + distance): its rim can hide a die's foot
@group(1) @binding(3) var samp: sampler;

// ---------- full screen ----------
struct FV { @builtin(position) pos: vec4f, @location(0) ndc: vec2f };
@vertex fn vsFull(@builtin(vertex_index) vi: u32) -> FV {
  var o: FV;
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  o.pos = vec4f(p, 0.0, 1.0); o.ndc = p;
  return o;
}
@fragment fn fsCopy(i: FV) -> @location(0) vec4f { return textureLoad(texA, vec2i(i.pos.xy), 0); }
@fragment fn fsPresent(i: FV) -> @location(0) vec4f { return present(textureLoad(texA, vec2i(i.pos.xy), 0).rgb, i.pos.xy); }

// ---------- light on the plate's top: contact AO from the height map, PCSS key shadow, tinted by the candy ----------
fn hmap(xz: vec2f) -> vec4f {
  return textureSampleLevel(texA, samp, 0.5 + (xz - F.shadow.xy) / (2.0 * F.shadow.z), 0.0);
}
fn diceLight(P: vec3f) -> vec3f {
  if (length(P.xz - F.shadow.xy) > F.shadow.w) { return vec3f(1.0); }
  var ao = vec3f(0.0);
  let Rm = 0.55;
  for (var k = 0; k < 20; k++) {
    let fk = f32(k);
    let ra = Rm * pow(fk / 20.0, 1.6); let rb = Rm * pow((fk + 1.0) / 20.0, 1.6);
    let rr = 0.5 * (ra + rb); let an = fk * 2.39996;
    let s = hmap(P.xz + vec2f(cos(an), sin(an)) * rr);
    if (s.r < 50.0) {
      let gh = max(s.r - P.y, 0.0) + 0.006;
      let g2 = gh * gh;
      let w = g2 / (ra * ra + g2) - g2 / (rb * rb + g2);
      let cd = M.m[u32(clamp(s.b, 0.0, 7.0))].absorb;
      let T = exp(-cd.rgb * cd.w * max(s.a - s.r, 0.0) * 0.9);
      ao += w * (1.0 - T * 0.85);
    }
  }
  var keyT = vec3f(1.0);
  let lc = F.lightMat * vec4f(P, 1.0);
  let luv = vec2f(lc.x * 0.5 + 0.5, 0.5 - lc.y * 0.5);
  let dP = dot(P, KEY);
  var blk = 0.0; var nb = 0.0;
  for (var k = 0; k < 9; k++) {
    let o = select(vec2f(cos(f32(k) * 0.7854), sin(f32(k) * 0.7854)) * 0.03, vec2f(0.0), k == 8);
    let s = textureSampleLevel(texB, samp, luv + o, 0.0);
    if (s.a > dP + 0.01) { blk += s.a - dP; nb += 1.0; }
  }
  if (nb > 0.0) {
    let rad = 0.003 + 0.028 * blk / nb;   // the penumbra widens with the distance to the blocker
    var t = vec3f(0.0);
    for (var k = 0; k < 16; k++) {
      let fk = f32(k);
      let o = vec2f(cos(fk * 2.39996), sin(fk * 2.39996)) * sqrt((fk + 0.5) / 16.0) * rad;
      let s = textureSampleLevel(texB, samp, luv + o, 0.0);
      if (s.a > dP + 0.01) {
        let cd = M.m[u32(clamp(s.b, 0.0, 7.0))].absorb;
        t += exp(-cd.rgb * cd.w * (s.a - max(s.r, dP)) * 1.1) * 0.9 + 0.06;   // translucent: tinted and lighter
      } else { t += vec3f(1.0); }
    }
    keyT = t / 16.0;
  }
  return 0.5 * (1.0 - clamp(ao, vec3f(0.0), vec3f(1.0)) * 0.9) + 0.5 * keyT;
}

// ---------- the studio sweep, the plate, the table ----------
struct Hit { t: f32, n: vec3f, kind: u32 };   // kind: 0 none, 1 the sweep, 2 the plate
fn sweepHit(ro: vec3f, rd: vec3f) -> Hit {
  var h: Hit; h.t = 1e4; h.kind = 0u; h.n = vec3f(0.0, 1.0, 0.0);
  let y0 = -F.plate.w; let zw = -4.6; let Rs = 3.2;
  if (rd.y < -1e-5) {
    let t = (y0 - ro.y) / rd.y; let p = ro + rd * t;
    if (p.z >= zw) { h.t = t; h.kind = 1u; return h; }
  }
  // the curve: a cylinder about x through (y0 + Rs, zw), its lower-back quarter, seen from inside
  let oc = vec2f(ro.y - (y0 + Rs), ro.z - zw); let dd = vec2f(rd.y, rd.z);
  let a = dot(dd, dd); let b = dot(oc, dd); let c = dot(oc, oc) - Rs * Rs;
  let disc = b * b - a * c;
  if (disc > 0.0 && a > 1e-8) {
    let t = (-b + sqrt(disc)) / a;
    let p = ro + rd * t;
    if (t > 0.0 && p.z <= zw && p.y <= y0 + Rs) { h.t = t; h.n = normalize(vec3f(0.0, (y0 + Rs) - p.y, zw - p.z)); h.kind = 1u; return h; }
  }
  if (rd.z < -1e-5) {
    let t = (zw - Rs - ro.z) / rd.z;
    if (t > 0.0) { h.t = t; h.n = vec3f(0.0, 0.0, 1.0); h.kind = 1u; }
  }
  return h;
}
fn plateHit(ro: vec3f, rd: vec3f) -> Hit {
  var h: Hit; h.t = 1e4; h.kind = 0u; h.n = vec3f(0.0, 1.0, 0.0);
  let bmin = vec3f(-F.plate.x, -F.plate.w, -F.plate.y) - 0.01; let bmax = vec3f(F.plate.x, F.plate2.z + F.plate2.x, F.plate.y) + 0.01;
  let inv = 1.0 / rd;
  let t0 = (bmin - ro) * inv; let t1 = (bmax - ro) * inv;
  let tn = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
  let tf = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
  if (tf < max(tn, 0.0)) { return h; }
  var t = max(tn, 0.0);
  for (var k = 0; k < 72; k++) {
    let d = plateSdf(ro + rd * t);
    if (d < 0.0004 * t) {
      let p = ro + rd * t;
      let e = vec2f(0.0015, -0.0015);
      h.n = normalize(e.xyy * plateSdf(p + e.xyy) + e.yyx * plateSdf(p + e.yyx) + e.yxy * plateSdf(p + e.yxy) + e.xxx * plateSdf(p + e.xxx));
      h.t = t; h.kind = 2u;
      return h;
    }
    t += d;
    if (t > tf) { break; }
  }
  return h;
}
fn paper(P: vec3f) -> vec3f {
  // the warm sweep: exactly the page colour on the floor, falling off softly up the curve and wall
  let up = smoothstep(-F.plate.w, 3.0, P.y);
  let grain = 1.0 + (vnoise(P * 70.0) - 0.5) * 0.025;
  return F.base.rgb * mix(1.0, 0.7, up) * grain;
}
fn tableShade(P: vec3f) -> vec3f {
  // the plate's own soft shadow (frosted glass: light, with a darker band along the edge) and its contact line
  let q = P + KEY * (F.plate.w * 0.5 / KEY.y);
  let s = sdRoundRect(q.xz, F.plate.xy, F.plate.z);
  let s0 = sdRoundRect(P.xz, F.plate.xy, F.plate.z);
  let inside = 1.0 - smoothstep(-0.12, 0.1, s);
  let edge = exp(-abs(s) / 0.05);
  var c = paper(P) * (1.0 - 0.22 * inside - 0.18 * edge * inside - 0.3 * exp(-max(s0, 0.0) / 0.025));
  c *= 1.0 + 0.04 * exp(-dot(P.xz, P.xz) * 0.05);   // a faint pool of light under the softbox
  return c;
}
fn plateShade(P: vec3f, N: vec3f, V: vec3f) -> vec3f {
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);
  let edge2d = -sdRoundRect(P.xz, F.plate.xy, F.plate.z);   // distance in from the edge
  let top = smoothstep(0.85, 0.99, N.y) * step(P.y, 0.004) * smoothstep(F.plate2.y + 0.02, F.plate2.y + 0.1, edge2d);
  // frosted body: the table seen through, blurred and lifted toward white, a touch cool, finely grained
  let grain = (vnoise(vec3f(P.xz * 260.0, 0.0)) - 0.5) * 0.05 + (vnoise(vec3f(P.xz * 37.0, 3.0)) - 0.5) * 0.02;
  var body = (F.base.rgb * 0.94 + vec3f(0.022, 0.026, 0.032)) * (1.0 + grain);
  var lit = vec3f(1.0);
  if (top > 0.0) { lit = diceLight(P); }
  body *= mix(vec3f(1.0), lit, top);
  // light piped through the slab glows at the rolled edge and the rim
  body += F.base.rgb * exp(-max(edge2d, 0.0) / 0.12) * 0.12;
  // satin sheen on top, bright reflections on the rolled bevel
  let fr = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  let rough = mix(0.16, 0.34, top);
  let keyI = vec3f(1.0, 0.975, 0.94) * 2.2;
  let spec = (env(R, rough) * mix(1.0, 0.55, top) + keyI * ggx(N, V, KEY, rough) * 0.6) * fr;
  return body * (1.0 - fr * 0.6) + spec;
}
@fragment fn fsBG(i: FV) -> @location(0) vec4f {
  let b = F.invViewProj * vec4f(i.ndc, 1.0, 1.0);
  let ro = F.camPos.xyz;
  let rd = normalize(b.xyz / b.w - ro);
  let ph = plateHit(ro, rd);
  if (ph.kind == 2u) {
    let P = ro + rd * ph.t;
    return vec4f(plateShade(P, ph.n, -rd), ph.t);
  }
  let sh = sweepHit(ro, rd);
  if (sh.kind == 1u) {
    let P = ro + rd * sh.t;
    var c = paper(P);
    if (P.y < -F.plate.w + 0.001) { c = tableShade(P); }
    return vec4f(c, sh.t);
  }
  return vec4f(F.base.rgb * 0.7, 1e4);
}

// ---------- maps: top-down heights (contact AO) and the key-light depths (soft shadows) ----------
struct HV { @builtin(position) pos: vec4f, @location(0) y: f32, @location(1) @interpolate(flat) id: f32 };
@vertex fn vsHeight(@builtin(vertex_index) vi: u32) -> HV {
  var o: HV;
  let p = skinPos[vi];
  o.pos = vec4f((p.x - F.shadow.x) / F.shadow.z, -(p.z - F.shadow.y) / F.shadow.z, 0.5, 1.0);
  o.y = p.y; o.id = p.w;
  return o;
}
@vertex fn vsLight(@builtin(vertex_index) vi: u32) -> HV {
  var o: HV;
  let p = skinPos[vi];
  o.pos = F.lightMat * vec4f(p.xyz, 1.0);
  o.y = dot(p.xyz, KEY); o.id = p.w;
  return o;
}
// r: lowest (or farthest from the light), b: smallest die index, a: highest (nearest the light)
@fragment fn fsMap(i: HV) -> @location(0) vec4f { return vec4f(i.y, 1.0, i.id, i.y); }

// ---------- the candy ----------
struct JV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) @interpolate(flat) id: u32 };
@vertex fn vsJelly(@builtin(vertex_index) vi: u32) -> JV {
  var o: JV;
  let p = skinPos[vi];
  o.pos = F.viewProj * vec4f(p.xyz, 1.0);
  o.wp = p.xyz; o.n = skinNrm[vi].xyz; o.id = u32(p.w + 0.5);
  return o;
}
fn hiddenByBackdrop(px: vec2f, d: f32) -> bool {   // the plate's rim in front of a die's foot
  return textureLoad(texC, vec2i(px), 0).a < d - 0.002;
}
@fragment fn fsBack(i: JV) -> @location(0) vec4f {
  let d = length(F.camPos.xyz - i.wp);
  if (hiddenByBackdrop(i.pos.xy, d)) { discard; }
  return vec4f(d, 0.0, 0.0, 1.0);
}
@fragment fn fsJelly(i: JV) -> @location(0) vec4f {
  let toCam = F.camPos.xyz - i.wp;
  let dF = length(toCam);
  if (hiddenByBackdrop(i.pos.xy, dF)) { discard; }
  let V = toCam / dF;
  var N = normalize(i.n);
  if (dot(N, V) < 0.02) { N = normalize(N - V * (dot(N, V) - 0.02)); }   // grazing silhouettes: keep it facing us
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);
  let px = vec2i(i.pos.xy);
  let behind = textureLoad(texA, px, 0);
  let dB = textureLoad(texB, px, 0).r;
  let thick = clamp(min(dB, behind.a) - dF, 0.003, 2.0);
  let cd = M.m[i.id];
  let sigma = cd.absorb.rgb * cd.absorb.w;

  // Refraction: bend the ray in, follow it to the exit depth, look up what is behind there.
  let Rd = refract(-V, N, 1.0 / IOR);
  let cp = F.viewProj * vec4f(i.wp + Rd * thick, 1.0);
  let uv = cp.xy / cp.w * vec2f(0.5, -0.5) + 0.5;
  let br = (0.6 + 2.5 * thick) * F.screen.zw;
  let rot = fract(52.9829189 * fract(dot(i.pos.xy, vec2f(0.06711056, 0.00583715)))) * 6.2832;
  var trans = vec3f(0.0);
  for (var k = 0; k < 5; k++) {
    let a = f32(k) * 1.2566 + rot;
    let s = textureSampleLevel(texA, samp, uv + vec2f(cos(a), sin(a)) * br * (0.35 + 0.15 * f32(k)), 0.0);
    trans += s.rgb * exp(-sigma * clamp(min(dB, s.a) - dF, 0.003, 2.0));   // Beer-Lambert, per tap
  }
  trans /= 5.0;

  // Light inside: a faint haze, and thin edges glowing where the key or the strip shines through.
  let inLight = vec3f(1.0, 0.975, 0.94) * 1.3 * clamp((dot(N, KEY) + 0.5) / 1.5, 0.0, 1.0) + env(N, 1.0) * 0.5;
  let haze = cd.glow.rgb * (1.0 - exp(-thick * 3.0)) * inLight * cd.glow.w;
  let back = pow(clamp(dot(-V, RIM) * 0.5 + 0.5, 0.0, 1.0), 3.0) * 1.4 + 0.7 * pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  let thinT = exp(-sigma * (thick * 0.55 + 0.01));
  let glow = cd.glow.rgb * thinT * back * (0.25 + 1.8 * pow(1.0 - NdV, 2.0)) * 0.55;
  let body = trans + haze + glow;

  // Glossy skin: Fresnel studio reflections and a crisp key highlight.
  let fres = 0.034 + 0.966 * pow(1.0 - NdV, 5.0);
  let keyI = vec3f(1.0, 0.975, 0.94) * 2.6;
  let col = body * (1.0 - fres) + (env(R, 0.035) + keyI * ggx(N, V, KEY, 0.055)) * fres + keyI * ggx(N, V, KEY, 0.02) * 0.08;
  return vec4f(col, dF);
}

// ---------- the pips: ivory lenses just under the skin, drawn behind the candy that refracts them ----------
@fragment fn fsPip(i: JV) -> @location(0) vec4f {
  let toCam = F.camPos.xyz - i.wp;
  let d = length(toCam);
  if (hiddenByBackdrop(i.pos.xy, d)) { discard; }
  let V = toCam / d;
  let N = normalize(i.n);
  let cd = M.m[i.id];
  let tint = mix(vec3f(1.0), exp(-cd.absorb.rgb * cd.absorb.w * 0.12), 0.7);   // its light crossed a little candy
  let ivory = vec3f(0.93, 0.89, 0.80);
  let wrap = clamp((dot(N, KEY) + 0.35) / 1.35, 0.0, 1.0);
  let sss = pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 2.0) * 0.25;
  return vec4f(ivory * tint * (vec3f(1.0, 0.975, 0.94) * 1.15 * wrap + env(N, 1.0) * 0.6 + sss), d);
}

// ---------- the lattice overlay ----------
@vertex fn vsWire(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  return F.viewProj * vec4f(nodes[vi].xyz, 1.0);
}
@fragment fn fsWire() -> @location(0) vec4f {
  return vec4f(0.08, 0.06, 0.05, 1.0) * F.view.y;
}
`;

// ---------------------------------------------------------------------------
// WebGPU renderer. Per frame: node positions in; on the GPU the node deformation gradients, the skinned
// skin and pips with cofactor normals; the top-down height map and the key-light map; the studio, plate
// and table (ray-traced, single sample); then the dice in depth layers, back to front: dice whose screen
// footprints overlap go in different layers, so each one refracts what is behind it, other dice included.
// Each layer: nearest back faces -> (copy of what is behind + this layer's pips) -> (copy + candy fronts).
// ---------------------------------------------------------------------------
const PAGE = '#efe8dc';   // the paper floor tone-maps to this

/** gpu: { device, context, format } from the page (device: the specimen's resource scope). */
export async function createRenderer(gpu, canvas) {
  const { device, context: ctx, format } = gpu;

  const S = GPUBufferUsage, T = GPUTextureUsage, MS = 4;
  const buf = (data, usage) => {
    const b = device.createBuffer({ size: Math.max(16, Math.ceil(data.byteLength / 4) * 4), usage: usage | S.COPY_DST });
    device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const tex = (w, h, fmt, usage, sampleCount = 1) => device.createTexture({ size: [w, h], format: fmt, usage, sampleCount });

  // ----- shaders -----
  device.pushErrorScope('validation');
  const skinMod = device.createShaderModule({ code: WGSL_SKIN });
  const renderMod = device.createShaderModule({ code: WGSL_COMMON + WGSL_PASSES });
  for (const [name, m] of [['skin', skinMod], ['render', renderMod]]) {
    const errs = (await m.getCompilationInfo()).messages.filter((x) => x.type === 'error');
    if (errs.length) throw Object.assign(new Error(`WGSL (${name}):\n` + errs.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n')), { code: 'shader' });
  }

  // ----- layouts -----
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, FS = GPUShaderStage.FRAGMENT;
  const ro = (b, vis) => ({ binding: b, visibility: vis, buffer: { type: 'read-only-storage' } });
  const uni = (b, vis) => ({ binding: b, visibility: vis, buffer: { type: 'uniform' } });
  const frameBGL = device.createBindGroupLayout({ entries: [uni(0, VF), ro(1, VF), ro(2, VF), uni(3, VF), ro(4, VF)] });
  const texE = (b) => ({ binding: b, visibility: FS, texture: { sampleType: 'float' } });
  const texBGL = device.createBindGroupLayout({ entries: [texE(0), texE(1), texE(2), { binding: 3, visibility: FS, sampler: { type: 'filtering' } }] });
  const renderPL = device.createPipelineLayout({ bindGroupLayouts: [frameBGL, texBGL] });

  // ----- pipelines -----
  // (two pipelines with their own layouts: each binds 7 of the module's buffers, within the default limit of 8 per stage)
  const comp = (entryPoint) => device.createComputePipeline({ layout: 'auto', compute: { module: skinMod, entryPoint } });
  const gradPipe = comp('nodeGrad'), skinPipe = comp('skin');
  const depth = (write, compare = 'less') => ({ format: 'depth24plus', depthWriteEnabled: write, depthCompare: compare });
  const rp = (o) => device.createRenderPipeline({
    layout: renderPL,
    vertex: { module: renderMod, entryPoint: o.vs },
    fragment: { module: renderMod, entryPoint: o.fs, targets: [o.target] },
    primitive: { topology: o.topology || 'triangle-list', cullMode: o.cull || 'none' },
    depthStencil: o.depth,
    multisample: { count: o.ms ? MS : 1 },
  });
  const minMax = { format: 'rgba16float', blend: { color: { operation: 'min', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' } } };
  const hdr = { format: 'rgba16float' };
  const P = {
    height: rp({ vs: 'vsHeight', fs: 'fsMap', target: minMax }),
    light: rp({ vs: 'vsLight', fs: 'fsMap', target: minMax }),
    bg: rp({ vs: 'vsFull', fs: 'fsBG', target: hdr }),
    back: rp({ vs: 'vsJelly', fs: 'fsBack', target: { format: 'r16float' }, depth: depth(true), cull: 'front' }),
    copy: rp({ vs: 'vsFull', fs: 'fsCopy', target: hdr, depth: depth(false, 'always'), ms: true }),
    pip: rp({ vs: 'vsJelly', fs: 'fsPip', target: hdr, depth: depth(true), cull: 'back', ms: true }),
    jelly: rp({ vs: 'vsJelly', fs: 'fsJelly', target: hdr, depth: depth(true), cull: 'back', ms: true }),
    present: rp({ vs: 'vsFull', fs: 'fsPresent', target: { format }, depth: depth(false, 'always'), ms: true }),
    wire: rp({ vs: 'vsWire', fs: 'fsWire', target: { format, blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }, depth: depth(false, 'always'), topology: 'line-list', ms: true }),
  };
  const err = await device.popErrorScope();
  if (err) throw Object.assign(new Error('Pipeline creation failed: ' + err.message), { code: 'pipeline' });

  // ----- static resources -----
  const U = new Float32Array(84), MU = new Float32Array(64);
  const uniBuf = device.createBuffer({ size: U.byteLength, usage: S.UNIFORM | S.COPY_DST });
  const matBuf = device.createBuffer({ size: MU.byteLength, usage: S.UNIFORM | S.COPY_DST });
  const countBuf = device.createBuffer({ size: 16, usage: S.UNIFORM | S.COPY_DST });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  const dummyA = tex(1, 1, 'rgba16float', T.TEXTURE_BINDING), dummyB = tex(1, 1, 'r16float', T.TEXTURE_BINDING);
  const texBG = (a, b, c) => device.createBindGroup({ layout: texBGL, entries: [{ binding: 0, resource: a.createView() }, { binding: 1, resource: b.createView() }, { binding: 2, resource: c.createView() }, { binding: 3, resource: sampler }] });
  const HM = 512, LM = 1024;
  const heightTex = tex(HM, HM, 'rgba16float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
  const lightTex = tex(LM, LM, 'rgba16float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
  const bgDummy = texBG(dummyA, dummyB, dummyA), bgMaps = texBG(heightTex, lightTex, dummyA);
  const base = backdropRadiance(PAGE);
  const PL = DiceGeo.PLATE;
  U.set([0, 0, 3.7, 4.4], 48);   // height map: the plate and a margin
  U.set([1, 0, 0, 0], 52);
  U.set([...base, 0], 56);
  U.set([PL.hx, PL.hz, PL.r, PL.thick], 76);
  U.set([PL.rimR, PL.wall, PL.rimY, 0], 80);
  {   // key-light map: orthographic along the light, centred on the plate
    const KEY = [-0.3203, 0.9008, 0.2936], c = [0, 0.3, 0], hs = 4.6;
    let r = [KEY[2], 0, -KEY[0]]; const rl = Math.hypot(...r); r = r.map((x) => x / rl);
    const u = [KEY[1] * r[2] - KEY[2] * r[1], KEY[2] * r[0] - KEY[0] * r[2], KEY[0] * r[1] - KEY[1] * r[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    U.set([r[0] / hs, u[0] / hs, 0, 0, r[1] / hs, u[1] / hs, 0, 0, r[2] / hs, u[2] / hs, 0, 0, -dot(c, r) / hs, -dot(c, u) / hs, 0.5, 1], 60);
  }

  // ----- the dice: rebuilt when their number changes -----
  let D = null;
  function setDice(geo, count) {
    if (D) for (const b of D.owned) b.destroy();
    D = null;
    if (!count) return;
    const nPer = geo.X.length / 3, n = nPer * count;
    const tPer = geo.tets.length / 4, nt = tPer * count;
    const Ns = geo.skin.pos.length / 3, Np = geo.pip.pos.length / 3, ptsPer = Ns + Np, npts = ptsPer * count;
    // tets, their inverse rest edge matrices (as columns), and node -> tet lists
    const X = geo.X, dmOne = new Float32Array(12 * tPer);
    for (let t = 0; t < tPer; t++) {
      const a = 3 * geo.tets[4 * t], b = 3 * geo.tets[4 * t + 1], c = 3 * geo.tets[4 * t + 2], d = 3 * geo.tets[4 * t + 3];
      const inv = inv3cols([X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2], X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2], X[d] - X[a], X[d + 1] - X[a + 1], X[d + 2] - X[a + 2]]);
      for (let k = 0; k < 3; k++) dmOne.set([inv[3 * k], inv[3 * k + 1], inv[3 * k + 2], 0], 12 * t + 4 * k);
    }
    const tets = new Uint32Array(4 * nt), dm = new Float32Array(12 * nt);
    for (let d = 0; d < count; d++) {
      for (let k = 0; k < 4 * tPer; k++) tets[4 * tPer * d + k] = geo.tets[k] + nPer * d;
      dm.set(dmOne, 12 * tPer * d);
    }
    const off = new Uint32Array(n + 1);
    for (let k = 0; k < 4 * nt; k++) off[tets[k] + 1]++;
    for (let i = 0; i < n; i++) off[i + 1] += off[i];
    const list = new Uint32Array(4 * nt), fill = off.slice(0, n);
    for (let t = 0; t < nt; t++) for (let k = 0; k < 4; k++) list[fill[tets[4 * t + k]]++] = t;
    // embedded points: [die 0 skin, die 0 pips, die 1 skin, ...]; rest normal, w = die index
    const embAB = new ArrayBuffer(npts * 32), embU = new Uint32Array(embAB), embF = new Float32Array(embAB), restN = new Float32Array(4 * npts);
    for (let d = 0; d < count; d++) for (let q = 0; q < ptsPer; q++) {
      const p = d * ptsPer + q, t = geo.emb.tet[q];
      for (let k = 0; k < 4; k++) { embU[8 * p + k] = geo.tets[4 * t + k] + nPer * d; embF[8 * p + 4 + k] = geo.emb.w[4 * q + k]; }
      const src = q < Ns ? geo.skin.nrm : geo.pip.nrm, o = q < Ns ? 3 * q : 3 * (q - Ns);
      restN.set([src[o], src[o + 1], src[o + 2], d], 4 * p);
    }
    const skinIdxPer = geo.skin.index.length, pipIdxPer = geo.pip.index.length, ePer = geo.latticeEdges.length;
    const skinIdx = new Uint32Array(skinIdxPer * count), pipIdx = new Uint32Array(pipIdxPer * count), edges = new Uint32Array(ePer * count);
    for (let d = 0; d < count; d++) {
      for (let k = 0; k < skinIdxPer; k++) skinIdx[skinIdxPer * d + k] = geo.skin.index[k] + d * ptsPer;
      for (let k = 0; k < pipIdxPer; k++) pipIdx[pipIdxPer * d + k] = geo.pip.index[k] + d * ptsPer + Ns;
      for (let k = 0; k < ePer; k++) edges[ePer * d + k] = geo.latticeEdges[k] + nPer * d;
    }
    const nodeBuf = device.createBuffer({ size: n * 16, usage: S.STORAGE | S.COPY_DST });
    const tetBuf = buf(tets, S.STORAGE), dmBuf = buf(dm, S.STORAGE), offBuf = buf(off, S.STORAGE), listBuf = buf(list, S.STORAGE);
    const nodeFBuf = device.createBuffer({ size: n * 48, usage: S.STORAGE });
    const embBuf = buf(embF, S.STORAGE), restBuf = buf(restN, S.STORAGE);
    const posBuf = device.createBuffer({ size: npts * 16, usage: S.STORAGE }), nrmBuf = device.createBuffer({ size: npts * 16, usage: S.STORAGE });
    const skinBuf = buf(skinIdx, S.INDEX), pipBuf = buf(pipIdx, S.INDEX), edgeBuf = buf(edges, S.INDEX);
    device.queue.writeBuffer(countBuf, 0, new Uint32Array([n, npts, 0, 0]));
    const all = [nodeBuf, tetBuf, dmBuf, offBuf, listBuf, nodeFBuf, embBuf, restBuf, posBuf, nrmBuf, countBuf];
    const group = (pipe, ids) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: ids.map((i) => ({ binding: i, resource: { buffer: all[i] } })) });
    const bgGrad = group(gradPipe, [0, 1, 2, 3, 4, 5, 10]), bgSkin = group(skinPipe, [0, 5, 6, 7, 8, 9, 10]);
    const bgFrame = device.createBindGroup({ layout: frameBGL, entries: [uniBuf, posBuf, nrmBuf, matBuf, nodeBuf].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    D = { count, nPer, n, npts, skinIdxPer, pipIdxPer, edgeCount: edges.length, nodeBuf, skinBuf, pipBuf, edgeBuf, bgGrad, bgSkin, bgFrame,
      owned: [nodeBuf, tetBuf, dmBuf, offBuf, listBuf, nodeFBuf, embBuf, restBuf, posBuf, nrmBuf, skinBuf, pipBuf, edgeBuf] };
  }
  // inverse of a 3x3 given by its columns (m[0..2] = column 0, ...), returned as columns
  function inv3cols(m) {
    const [a, d, g, b, e, h, c, f, i] = m;   // rows (a b c), (d e f), (g h i)
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, id = 1 / (a * A + b * B + c * C);
    const r = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v * id);   // row-major
    return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
  }

  /** mats: per die { absorb: [r, g, b], density, glow: [r, g, b], haze } (up to 8). */
  function setMaterials(mats) {
    MU.fill(0);
    mats.slice(0, 8).forEach((m, k) => { MU.set([...m.absorb, m.density], 8 * k); MU.set([...m.glow, m.haze], 8 * k + 4); });
    device.queue.writeBuffer(matBuf, 0, MU);
  }

  // ----- size-dependent targets -----
  let W = 0, H = 0, sceneTex, texP, texQ, colorMS, depthMS, backTex, backDepth, finalMS, bind = {};
  function resize(w, h) {
    const max = device.limits.maxTextureDimension2D;
    w = Math.max(1, Math.min(max, w)); h = Math.max(1, Math.min(max, h));
    if (w === W && h === H) return;
    W = w; H = h; canvas.width = w; canvas.height = h;
    for (const t of [sceneTex, texP, texQ, colorMS, depthMS, backTex, backDepth, finalMS]) t && t.destroy();
    const RB = T.RENDER_ATTACHMENT | T.TEXTURE_BINDING;
    sceneTex = tex(w, h, 'rgba16float', RB); texP = tex(w, h, 'rgba16float', RB); texQ = tex(w, h, 'rgba16float', RB);
    colorMS = tex(w, h, 'rgba16float', T.RENDER_ATTACHMENT, MS); depthMS = tex(w, h, 'depth24plus', T.RENDER_ATTACHMENT, MS);
    backTex = tex(w, h, 'r16float', RB); backDepth = tex(w, h, 'depth24plus', T.RENDER_ATTACHMENT);
    finalMS = tex(w, h, format, T.RENDER_ATTACHMENT, MS);
    bind = {
      back: texBG(dummyA, dummyB, sceneTex),
      behindScene: texBG(sceneTex, dummyB, sceneTex), behindQ: texBG(texQ, dummyB, sceneTex),
      jelly: texBG(texP, backTex, sceneTex),
      presentScene: texBG(sceneTex, dummyB, dummyA), presentQ: texBG(texQ, dummyB, dummyA),
    };
    U.set([W, H, 1 / W, 1 / H], 44);
  }

  // ----- camera -----
  const look = { vp: new Float32Array(16), inv: new Float32Array(16), eye: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0] };
  function setCamera(c) {
    const cp = Math.cos(c.pitch), eye = [c.target[0] + c.dist * cp * Math.sin(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * cp * Math.cos(c.yaw)];
    const L = M4.lookAt(eye, c.target, [0, 1, 0]), Pm = M4.persp(c.fov, W / H, 0.1, 80);
    Pm[8] -= c.shift[0]; Pm[9] -= c.shift[1];   // lens shift: frame the plate in the free area of the layout
    M4.mul(Pm, L.m, look.vp); look.inv.set(M4.inv(look.vp));
    look.eye = eye; look.fwd = L.z.map((v) => -v); look.right = L.x; look.up = L.y;
    U.set(look.vp, 0); U.set(look.inv, 16); U.set(eye, 32); U.set(L.x, 36); U.set(L.y, 40);
  }
  function setFrame(o) { U[35] = o.time || 0; U[52] = o.exposure || 1; U[53] = o.meshAlpha || 0; }
  function ray(nx, ny) {
    const f = look.inv, q = [0, 1, 2, 3].map((r) => f[r] * nx + f[4 + r] * ny + f[8 + r] + f[12 + r]);
    const far = [q[0] / q[3], q[1] / q[3], q[2] / q[3]], e = look.eye, d = [far[0] - e[0], far[1] - e[1], far[2] - e[2]], l = Math.hypot(...d);
    return { ro: e.slice(), rd: d.map((x) => x / l) };
  }
  /** World point to CSS pixels inside the canvas. */
  function project(p, cssW, cssH) {
    const m = look.vp, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * 0.5 + 0.5) * cssW, (0.5 - y / w * 0.5) * cssH, w];
  }

  // Depth layers: dice sorted far to near; each goes one layer past every farther die whose screen
  // footprint it overlaps (dice that do not overlap share a layer, so usually there are one or two).
  const rect = new Float32Array(4 * 8), dist = new Float32Array(8), layerOf = new Int32Array(8);
  function layers(nodes) {
    const m = look.vp, out = [];
    for (let d = 0; d < D.count; d++) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0, cz = 0;
      for (let i = d * D.nPer; i < (d + 1) * D.nPer; i++) {
        const x = nodes[4 * i], y = nodes[4 * i + 1], z = nodes[4 * i + 2];
        const w = m[3] * x + m[7] * y + m[11] * z + m[15], sx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, sy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
        cx += x; cy += y; cz += z;
      }
      const k = 1 / D.nPer, pad = 0.03;
      rect[4 * d] = x0 - pad; rect[4 * d + 1] = y0 - pad; rect[4 * d + 2] = x1 + pad; rect[4 * d + 3] = y1 + pad;
      dist[d] = Math.hypot(cx * k - look.eye[0], cy * k - look.eye[1], cz * k - look.eye[2]);
    }
    const order = [...Array(D.count).keys()].sort((a, b) => dist[b] - dist[a]);
    for (let a = 0; a < order.length; a++) {
      const d = order[a];
      let L = 0;
      for (let b = 0; b < a; b++) {
        const e = order[b];
        if (rect[4 * d] < rect[4 * e + 2] && rect[4 * e] < rect[4 * d + 2] && rect[4 * d + 1] < rect[4 * e + 3] && rect[4 * e + 1] < rect[4 * d + 3]) L = Math.max(L, layerOf[e] + 1);
      }
      layerOf[d] = L;
      (out[L] = out[L] || []).push(d);
    }
    return out;
  }

  // a frame bind group for when there are no dice (the backdrop still needs the uniforms)
  let empty = null;
  function emptyFrame() {
    if (!empty) {
      const z = device.createBuffer({ size: 64, usage: S.STORAGE });
      empty = device.createBindGroup({ layout: frameBGL, entries: [uniBuf, z, z, matBuf, z].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    }
    return empty;
  }

  let lastLayers = 0;
  function render(nodes, showMesh) {
    device.queue.writeBuffer(uniBuf, 0, U);
    const enc = device.createCommandEncoder();
    const msCol = (resolve) => ({ view: colorMS.createView(), resolveTarget: resolve.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1e4 }, loadOp: 'clear', storeOp: 'discard' });
    const dep = (t) => ({ view: t.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' });
    let groups = [];
    if (D) {
      device.queue.writeBuffer(D.nodeBuf, 0, nodes, 0, D.n * 4);
      groups = layers(nodes);
      const cp = enc.beginComputePass();
      cp.setPipeline(gradPipe); cp.setBindGroup(0, D.bgGrad); cp.dispatchWorkgroups(Math.ceil(D.n / 64));
      cp.setPipeline(skinPipe); cp.setBindGroup(0, D.bgSkin); cp.dispatchWorkgroups(Math.ceil(D.npts / 64));
      cp.end();
    }
    lastLayers = groups.length;
    const frameBG = D ? D.bgFrame : emptyFrame();
    // maps (cleared even without dice)
    for (const [target, pipe] of [[heightTex, P.height], [lightTex, P.light]]) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: target.createView(), clearValue: { r: 1e4, g: 1, b: 99, a: -1e4 }, loadOp: 'clear', storeOp: 'store' }] });
      if (D) { p.setBindGroup(0, frameBG); p.setBindGroup(1, bgDummy); p.setPipeline(pipe); p.setIndexBuffer(D.skinBuf, 'uint32'); p.drawIndexed(D.skinIdxPer * D.count); }
      p.end();
    }
    // studio, plate, table
    let p = enc.beginRenderPass({ colorAttachments: [{ view: sceneTex.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1e4 }, loadOp: 'clear', storeOp: 'store' }] });
    p.setBindGroup(0, frameBG); p.setBindGroup(1, bgMaps); p.setPipeline(P.bg); p.draw(3); p.end();
    // the dice, layer by layer, back to front
    let cur = 'scene';
    for (const g of groups) {
      p = enc.beginRenderPass({ colorAttachments: [{ view: backTex.createView(), clearValue: { r: 1e4, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: dep(backDepth) });
      p.setBindGroup(0, frameBG); p.setBindGroup(1, bind.back); p.setPipeline(P.back); p.setIndexBuffer(D.skinBuf, 'uint32');
      for (const d of g) p.drawIndexed(D.skinIdxPer, 1, D.skinIdxPer * d);
      p.end();
      p = enc.beginRenderPass({ colorAttachments: [msCol(texP)], depthStencilAttachment: dep(depthMS) });
      p.setBindGroup(0, frameBG); p.setBindGroup(1, cur === 'scene' ? bind.behindScene : bind.behindQ);
      p.setPipeline(P.copy); p.draw(3);
      p.setPipeline(P.pip); p.setIndexBuffer(D.pipBuf, 'uint32');
      for (const d of g) p.drawIndexed(D.pipIdxPer, 1, D.pipIdxPer * d);
      p.end();
      p = enc.beginRenderPass({ colorAttachments: [msCol(texQ)], depthStencilAttachment: dep(depthMS) });
      p.setBindGroup(0, frameBG); p.setBindGroup(1, bind.jelly);
      p.setPipeline(P.copy); p.draw(3);
      p.setPipeline(P.jelly); p.setIndexBuffer(D.skinBuf, 'uint32');
      for (const d of g) p.drawIndexed(D.skinIdxPer, 1, D.skinIdxPer * d);
      p.end();
      cur = 'q';
    }
    // tone map to the screen, then the lattice
    p = enc.beginRenderPass({ colorAttachments: [{ view: finalMS.createView(), resolveTarget: ctx.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'discard' }], depthStencilAttachment: dep(depthMS) });
    p.setBindGroup(0, frameBG); p.setBindGroup(1, cur === 'scene' ? bind.presentScene : bind.presentQ);
    p.setPipeline(P.present); p.draw(3);
    if (showMesh && D) { p.setPipeline(P.wire); p.setIndexBuffer(D.edgeBuf, 'uint32'); p.drawIndexed(D.edgeCount); }
    p.end();
    device.queue.submit([enc.finish()]);
  }


  return { device, setDice, setMaterials, resize, setCamera, setFrame, ray, project, render, look, get layers() { return lastLayers; }, get size() { return [W, H]; } };
}
