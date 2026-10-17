// WGSL shared by every skinned-tetrahedron jelly. A specimen adds its own material (fsJelly and the
// rest-space zones it reads, clarityAt for the shadow maps) between the shared chunks:
//   compute module:  SKIN
//   render module:   FRAME + STUDIO + <specimen helpers> + PASSES + <specimen passes>

/** Compute: skin every embedded point (the render surface, then the extras) into the deforming
 *  tetrahedra, then rebuild smooth normals for the render surface. */
export const SKIN = /* wgsl */`
struct Emb { idx: vec4u, w: vec4f };
struct Counts { np: u32, nv: u32, a: u32, b: u32 };
@group(0) @binding(0) var<storage, read> nodes: array<vec4f>;
@group(0) @binding(1) var<storage, read> emb: array<Emb>;
@group(0) @binding(2) var<storage, read_write> outPos: array<vec4f>;
@group(0) @binding(3) var<storage, read> tris: array<u32>;
@group(0) @binding(4) var<storage, read> adjOff: array<u32>;
@group(0) @binding(5) var<storage, read> adjTri: array<u32>;
@group(0) @binding(6) var<storage, read_write> outNrm: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> tmpNrm: array<vec4f>;
@group(0) @binding(8) var<uniform> C: Counts;

@compute @workgroup_size(64) fn skin(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= C.np) { return; }
  let e = emb[i];
  let p = nodes[e.idx.x].xyz * e.w.x + nodes[e.idx.y].xyz * e.w.y + nodes[e.idx.z].xyz * e.w.z + nodes[e.idx.w].xyz * e.w.w;
  outPos[i] = vec4f(p, 1.0);
}
@compute @workgroup_size(64) fn normals(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= C.nv) { return; }
  var n = vec3f(0.0);
  for (var k = adjOff[i]; k < adjOff[i + 1u]; k++) {
    let t = adjTri[k] * 3u;
    let a = outPos[tris[t]].xyz;
    n += cross(outPos[tris[t + 1u]].xyz - a, outPos[tris[t + 2u]].xyz - a);
  }
  outNrm[i] = vec4f(normalize(n + vec3f(0.0, 1e-9, 0.0)), 0.0);
}
// One-ring smoothing: linear tets crease the surface at their boundaries; averaging hides it.
fn ringSum(i: u32, src: u32) -> vec3f {
  var n = vec3f(0.0);
  for (var k = adjOff[i]; k < adjOff[i + 1u]; k++) {
    let t = adjTri[k] * 3u;
    for (var j = 0u; j < 3u; j++) { n += select(tmpNrm[tris[t + j]].xyz, outNrm[tris[t + j]].xyz, src == 0u); }
  }
  return normalize(n + vec3f(0.0, 1e-9, 0.0));
}
@compute @workgroup_size(64) fn smoothA(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= C.nv) { return; }
  tmpNrm[g.x] = vec4f(ringSum(g.x, 0u), 0.0);
}
@compute @workgroup_size(64) fn smoothB(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= C.nv) { return; }
  outNrm[g.x] = vec4f(ringSum(g.x, 1u), 0.0);
}
`;

/** Compute, the other way (spec.skin = 'gradient'): each node's average deformation gradient F, then
 *  every embedded point skinned with its rest normal carried by cof(F), exact without smoothing. Its
 *  points all get normals (the seeds' anchors and bubbles too); rest normal .w rides along in outPos.w. */
export const GRADIENT_SKIN = /* wgsl */`
struct Emb { idx: vec4u, w: vec4f };
struct Counts { nodes: u32, points: u32, a: u32, b: u32 };
@group(0) @binding(0) var<storage, read> nodes: array<vec4f>;
@group(0) @binding(1) var<storage, read> tets: array<vec4u>;
@group(0) @binding(2) var<storage, read> dmInv: array<vec4f>;       // 3 columns per tet
@group(0) @binding(3) var<storage, read> nodeTetOff: array<u32>;
@group(0) @binding(4) var<storage, read> nodeTet: array<u32>;
@group(0) @binding(5) var<storage, read_write> nodeF: array<vec4f>; // 3 columns per node
@group(0) @binding(6) var<storage, read> emb: array<Emb>;
@group(0) @binding(7) var<storage, read> restN: array<vec4f>;       // rest normal
@group(0) @binding(8) var<storage, read_write> outPos: array<vec4f>; 
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

/** The frame uniforms (layout mirrored by renderer.js U) and the render module's bindings. */
export const FRAME = /* wgsl */`
struct Frame {
  viewProj: mat4x4f,
  invViewProj: mat4x4f,
  camPos: vec4f,     // xyz, w = time
  camRight: vec4f,
  camUp: vec4f,
  screen: vec4f,     // w, h, 1/w, 1/h
  shadow: vec4f,     // centre x, centre z, half size, radius of interest
  absorb: vec4f,     // gel absorption per unit length (rgb), w = density
  scatter: vec4f,    // in-scatter tint (rgb), w = amount
  pal: array<vec4f, 4>,   // the specimen's palette
  view: vec4f,       // exposure, mesh overlay alpha, prop A shown, prop B shown
  base: vec4f,       // backdrop radiance that tone-maps to the page colour
  lightMat: mat4x4f, // ortho projection along the key light (floor shadow map)
  propA: mat4x4f,    // model matrices of the props (knife, press, cutter)
  propB: mat4x4f,
  prm: array<vec4f, 2>,   // the specimen's shape parameters
  bases: vec4f,      // first bubble point, bubble count, first seed point, seed count
};
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<storage, read> skinPos: array<vec4f>;
@group(0) @binding(2) var<storage, read> skinNrm: array<vec4f>;
@group(0) @binding(3) var<storage, read> rest: array<vec4f>;
@group(0) @binding(4) var<storage, read> nodes: array<vec4f>;
@group(0) @binding(5) var<storage, read> inst: array<vec4f>;
@group(1) @binding(0) var texA: texture_2d<f32>;   // scene colour+distance, or height map
@group(1) @binding(1) var texB: texture_2d<f32>;   // back-face distance, or key-light map
@group(1) @binding(2) var samp: sampler;
`;

/** The photo studio, noise, GGX, tone mapping. */
export const STUDIO = /* wgsl */`
const PI = 3.14159265;
const KEY = vec3f(-0.5463, 0.7747, 0.3184);   // big overhead-left softbox
const RIM = vec3f(0.3369, 0.5294, -0.7787);   // strip light behind
const FILL = vec3f(0.9370, 0.2811, 0.2077);   // narrow strip at right
const TOP = vec3f(-0.4504, 0.6006, -0.6607);  // long gloss strip overhead, behind

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
// Worley F1, F2 and the nearest cell's random id
fn cells(p: vec3f) -> vec3f {
  let i = floor(p); let f = fract(p);
  var d1 = 8.0; var d2 = 8.0; var id = 0.0;
  for (var z = -1; z <= 1; z++) { for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let o = vec3f(f32(x), f32(y), f32(z));
    let c = i + o;
    let r = o + vec3f(hash3(c), hash3(c + 17.0), hash3(c + 31.0)) - f;
    let d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hash3(c + 53.0); } else if (d < d2) { d2 = d; }
  } } }
  return vec3f(sqrt(d1), sqrt(d2), id);
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
// Warm photo studio: a dim surround so reflections read, softboxes for the highlights,
// and a cream floor bounce below the horizon.
fn env(d: vec3f, rough: f32) -> vec3f {
  var c = mix(vec3f(0.32, 0.30, 0.27), vec3f(0.17, 0.16, 0.15), smoothstep(0.0, 0.9, d.y));
  c = mix(c, F.base.rgb * 0.55, smoothstep(0.02, -0.4, d.y));
  let s = 0.02 + rough * 0.7;
  let a = 1.0 / (1.0 + rough * 7.0);
  c += vec3f(1.0, 0.97, 0.93) * 6.0 * a * softbox(d, KEY, vec2f(0.55, 0.32), s);
  c += vec3f(0.95, 0.97, 1.0) * 2.6 * a * softbox(d, RIM, vec2f(0.9, 0.16), s);
  c += vec3f(1.0) * 1.4 * a * softbox(d, FILL, vec2f(0.14, 0.6), s);
  c += vec3f(1.0, 0.99, 0.97) * 3.2 * a * softbox(d, TOP, vec2f(0.8, 0.04), s * 3.0 + 0.06);
  return c;
}
// GGX (Trowbridge-Reitz) with Smith-Schlick visibility, for the key softbox treated as a light.
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
  let n = f32(hashu(u32(px.x) * 1973u + u32(px.y) * 9277u)) * (1.0 / 4294967295.0) - 0.5;
  return vec4f(s + n / 255.0, 1.0);
}
fn rotTo(a: vec3f, b: vec3f, v: vec3f) -> vec3f {   // shortest-arc rotation taking unit a onto unit b
  let c = dot(a, b);
  if (c < -0.98) { return v; }
  let k = cross(a, b);
  return v + cross(k, v) + cross(k, cross(k, v)) / (1.0 + c);
}
`;

/** The jelly's vertex stage and back faces, the two shadow maps, the studio floor with its tinted
 *  soft shadow, the composite, bubbles and the lattice overlay. Needs the specimen's clarityAt(rp). */
export const PASSES = /* wgsl */`
struct JV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) rp: vec3f, @location(3) rn: vec3f };
@vertex fn vsJelly(@builtin(vertex_index) vi: u32) -> JV {
  var o: JV;
  let p = skinPos[vi].xyz;
  o.pos = F.viewProj * vec4f(p, 1.0);
  o.wp = p; o.n = skinNrm[vi].xyz; o.rp = rest[2u * vi].xyz; o.rn = rest[2u * vi + 1u].xyz;
  return o;
}
@fragment fn fsBack(i: JV) -> @location(0) vec4f {
  return vec4f(length(F.camPos.xyz - i.wp), 0.0, 0.0, 1.0);
}

// ---------- top-down height map (contact AO) and key-light map (soft shadow) ----------
struct HV { @builtin(position) pos: vec4f, @location(0) y: f32, @location(1) clarity: f32 };
@vertex fn vsHeight(@builtin(vertex_index) vi: u32) -> HV {
  var o: HV;
  let p = skinPos[vi].xyz;
  o.pos = vec4f((p.x - F.shadow.x) / F.shadow.z, -(p.z - F.shadow.y) / F.shadow.z, 0.5, 1.0);
  o.y = p.y; o.clarity = clarityAt(rest[2u * vi].xyz);
  return o;
}
@vertex fn vsLight(@builtin(vertex_index) vi: u32) -> HV {
  var o: HV;
  let p = skinPos[vi].xyz;
  o.pos = F.lightMat * vec4f(p, 1.0);
  o.y = dot(p, KEY); o.clarity = clarityAt(rest[2u * vi].xyz);
  return o;
}
// r: lowest (or farthest from the light), g: least clear, a: highest (nearest the light)
@fragment fn fsMap(i: HV) -> @location(0) vec4f { return vec4f(i.y, i.clarity, 0.0, i.y); }

// ---------- studio backdrop + floor ----------
struct FV { @builtin(position) pos: vec4f, @location(0) ndc: vec2f };
@vertex fn vsFull(@builtin(vertex_index) vi: u32) -> FV {
  var o: FV;
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  o.pos = vec4f(p, 0.0, 1.0); o.ndc = p;
  return o;
}
fn hmap(xz: vec2f) -> vec4f {
  return textureSampleLevel(texA, samp, 0.5 + (xz - F.shadow.xy) / (2.0 * F.shadow.z), 0.0);
}
// Opt-in looks, replaced by a specimen that wants them: the floor plane's height (a table under a plate),
// and light focused through the gel into a bright core inside its tinted shadow.
const FLOOR_Y = 0.0;
const CAUSTIC = 0.0;
fn mapThick(uv: vec2f) -> f32 {   // how much gel the key light crosses here
  let s = textureSampleLevel(texB, samp, uv, 0.0);
  return select(0.0, max(s.a - s.r, 0.0), s.a > -1.0e3);
}
// A gel thicker in the middle than at its edges is a lens: where the thickness curves down, the light
// that passes through converges. The curvature of the light-space thickness says how much.
fn lensFocus(luv: vec2f) -> f32 {
  let o = 0.012;
  let lap = mapThick(luv + vec2f(o, 0.0)) + mapThick(luv - vec2f(o, 0.0)) + mapThick(luv + vec2f(0.0, o)) + mapThick(luv - vec2f(0.0, o)) - 4.0 * mapThick(luv);
  return 1.0 + CAUSTIC * clamp(-lap * 30.0, -0.5, 2.2);
}
/** Light reaching a surface point P (normal N) under the jelly: soft ambient occlusion tinted by the gel,
 *  the key light through it, the contact shade; 1 on open ground. Heights are taken from P. */
fn floorLight(P: vec3f, N: vec3f) -> vec3f {
  var ao = vec3f(0.0);
  var keyT = vec3f(1.0);
  var contact = 0.0;
  if (length(P.xz - F.shadow.xy) < F.shadow.w) {
    // ambient: projected solid angle of whatever hangs above, tinted by light passing through the gel
    let Rm = 0.5;
    for (var k = 0; k < 24; k++) {
      let fk = f32(k);
      let ra = Rm * pow(fk / 24.0, 1.6); let rb = Rm * pow((fk + 1.0) / 24.0, 1.6);
      let rr = 0.5 * (ra + rb); let an = fk * 2.39996;
      let s = hmap(P.xz + vec2f(cos(an), sin(an)) * rr);
      if (s.r < 50.0) {
        let gap = max(s.r - P.y, 0.0) + 0.006;
        let g2 = gap * gap;
        let w = g2 / (ra * ra + g2) - g2 / (rb * rb + g2);
        let slant = min(sqrt(rr * rr + g2) / sqrt(g2), 8.0);
        let T = exp(-F.absorb.rgb * F.absorb.w * max(s.a - s.r, 0.0) * slant * 1.1) * s.g * 0.8;
        ao += w * (1.0 - T);
      }
    }
    // key light: PCSS-lite on the light-space map, penumbra widening with blocker distance
    let lc = F.lightMat * vec4f(P, 1.0);
    let luv = vec2f(lc.x * 0.5 + 0.5, 0.5 - lc.y * 0.5);
    let dP = dot(P, KEY);
    var blk = 0.0; var nb = 0.0;
    for (var k = 0; k < 9; k++) {
      let o = select(vec2f(cos(f32(k) * 0.7854), sin(f32(k) * 0.7854)) * 0.022, vec2f(0.0), k == 8);
      let s = textureSampleLevel(texB, samp, luv + o, 0.0);
      if (s.a > dP + 0.01) { blk += s.a - dP; nb += 1.0; }
    }
    if (nb > 0.0) {
      let rad = 0.002 + 0.03 * blk / nb;
      var focus = 1.0;
      if (CAUSTIC > 0.0) { focus = lensFocus(luv); }
      var t = vec3f(0.0);
      for (var k = 0; k < 16; k++) {
        let fk = f32(k);
        let o = vec2f(cos(fk * 2.39996), sin(fk * 2.39996)) * sqrt((fk + 0.5) / 16.0) * rad;
        let s = textureSampleLevel(texB, samp, luv + o, 0.0);
        if (s.a > dP + 0.01) {
          let path = s.a - max(s.r, dP);
          t += exp(-F.absorb.rgb * F.absorb.w * path * 1.1) * mix(1.0, s.g, 0.9) * 0.82 * focus;
        } else { t += vec3f(1.0); }
      }
      keyT = t / 16.0;
    }
    for (var k = 0; k < 8; k++) {
      let s = hmap(P.xz + vec2f(cos(f32(k) * 0.7854), sin(f32(k) * 0.7854)) * 0.03);
      contact += select(0.0, 1.0 - smoothstep(0.0, 0.05, s.r - P.y), s.r < 50.0);
    }
    contact /= 8.0;
  }
  // a faint pool of light under the specimen, exactly the page colour everywhere else
  let pool = (1.0 + 0.05 * exp(-dot(P.xz - F.shadow.xy, P.xz - F.shadow.xy) * 0.9)) * (1.0 - 0.45 * contact);
  let kc = clamp(dot(N, KEY) / KEY.y, 0.0, 1.3);   // 1 on the floor; a tilted face turns toward or away from the key
  let light = 0.52 * (1.0 - clamp(ao, vec3f(0.0), vec3f(1.0)) * 0.92) + 0.48 * keyT * kc;
  return pool * light;
}
fn floorShade(P: vec3f) -> vec3f { return F.base.rgb * floorLight(P, vec3f(0.0, 1.0, 0.0)); }
@fragment fn fsBG(i: FV) -> @location(0) vec4f {
  let b = F.invViewProj * vec4f(i.ndc, 1.0, 1.0);
  let ro = F.camPos.xyz;
  let rd = normalize(b.xyz / b.w - ro);
  var col = F.base.rgb;
  var dist = 1.0e4;
  if (rd.y < -1e-4) {
    let t = (FLOOR_Y - ro.y) / rd.y;
    let P = ro + rd * t;
    dist = t;
    col = floorShade(P);
  }
  return vec4f(col, dist);
}
@fragment fn fsComp(i: FV) -> @location(0) vec4f {
  return present(textureLoad(texA, vec2i(i.pos.xy), 0).rgb, i.pos.xy);
}

// ---------- tiny air bubbles (camera-facing, inside the gel) ----------
struct BV { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vsBubble(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BV {
  var o: BV;
  var corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  let q = corners[vi];
  let r = inst[u32(F.bases.w) + ii].x;   // instances: the seeds (if any), then the bubbles
  let wp = skinPos[u32(F.bases.x) + ii].xyz + (F.camRight.xyz * q.x + F.camUp.xyz * q.y) * r;
  o.pos = F.viewProj * vec4f(wp, 1.0); o.uv = q;
  return o;
}
@fragment fn fsBubble(i: BV) -> @location(0) vec4f {
  let d = length(i.uv);
  if (d > 1.0) { discard; }
  let rim = smoothstep(0.55, 0.97, d) * (1.0 - smoothstep(0.97, 1.0, d));
  let hl = 1.0 - smoothstep(0.0, 0.3, length(i.uv - vec2f(-0.33, 0.36)));
  return vec4f(vec3f(1.0, 0.99, 0.97) * (0.2 + rim * 0.9 + hl * 2.4), clamp(0.12 + rim * 0.5 + hl * 0.9, 0.0, 1.0));
}

// ---------- simulation mesh overlay ----------
@vertex fn vsWire(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  return F.viewProj * vec4f(nodes[vi].xyz, 1.0);
}
@fragment fn fsWire() -> @location(0) vec4f {
  return vec4f(0.1, 0.075, 0.05, 1.0) * F.view.y;
}
`;
