// Renderer plugins (see createJellyRenderer's spec.plugins): the steel props (knife, crinkle blade,
// cookie cutter, the press), and what rides inside the gel (membrane sheets, skinned seed meshes,
// instanced seeds). Each draws into the scene before the jelly is composited,
// so the gel refracts it; the props also cast shadows into the maps.
import { UO } from './renderer.js';

/**
 * Props. The specimen's WGSL defines which model matrix a material rides on and what it looks like:
 *   fn toolM(m: f32) -> mat4x4f                                         (F.propA / F.propB)
 *   fn toolMaterial(m: u32, u: f32, lp: vec3f, N: vec3f) -> ToolMat    (base, rough, metal, normal)
 * Material ids are taken modulo 10, so a mesh can add 10 to ride on the other matrix.
 */
export const PROPS_WGSL = /* wgsl */`
struct TIn { @location(0) p: vec3f, @location(1) n: vec3f, @location(2) m: f32, @location(3) u: f32 };
struct TV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) @interpolate(flat) m: u32, @location(3) u: f32, @location(4) lp: vec3f };
struct ToolMat { base: vec3f, rough: f32, metal: f32, n: vec3f };
@vertex fn vsToolHeight(t: TIn) -> HV {
  var o: HV;
  let p = (toolM(t.m) * vec4f(t.p, 1.0)).xyz;
  o.pos = vec4f((p.x - F.shadow.x) / F.shadow.z, -(p.z - F.shadow.y) / F.shadow.z, 0.5, 1.0);
  o.y = p.y; o.clarity = 0.0;
  return o;
}
@vertex fn vsToolLight(t: TIn) -> HV {
  var o: HV;
  let p = (toolM(t.m) * vec4f(t.p, 1.0)).xyz;
  o.pos = F.lightMat * vec4f(p, 1.0);
  o.y = dot(p, KEY); o.clarity = 0.0;
  return o;
}
@vertex fn vsTool(t: TIn) -> TV {
  var o: TV;
  let M = toolM(t.m);
  let wp = (M * vec4f(t.p, 1.0)).xyz;
  o.pos = F.viewProj * vec4f(wp, 1.0);
  o.wp = wp; o.n = normalize((M * vec4f(t.n, 0.0)).xyz); o.m = u32(t.m + 0.5) % 10u; o.u = t.u; o.lp = t.p;
  return o;
}
@fragment fn fsTool(i: TV, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  var N0 = normalize(i.n);
  if (!ff) { N0 = -N0; }
  let toCam = F.camPos.xyz - i.wp;
  let d = length(toCam);
  let V = toCam / d;
  let s = toolMaterial(i.m, i.u, i.lp, N0);
  let N = s.n;
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);
  let keyI = vec3f(1.0, 0.97, 0.93) * 2.4;
  let amb = env(N, 1.0) * 0.5;
  let diff = s.base * (clamp(dot(N, KEY), 0.0, 1.0) * 1.1 + amb) * (1.0 - s.metal);
  let F0 = mix(vec3f(0.04), s.base, s.metal);
  let Fr = F0 + (1.0 - F0) * pow(1.0 - NdV, 5.0);
  let spec = (env(R, s.rough) + keyI * ggx(N, V, KEY, s.rough)) * Fr;
  return vec4f(diff + spec, d);
}
`;

const TOOL_VB = [{ arrayStride: 32, attributes: [
  { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
  { shaderLocation: 2, offset: 24, format: 'float32' }, { shaderLocation: 3, offset: 28, format: 'float32' }] }];
const indexFormat = (ix) => (ix instanceof Uint16Array ? 'uint16' : 'uint32');

/**
 * meshes: { name: { vtx, index } }. Per frame set state.draw (names), state.A / state.B (model
 * matrices, or null to keep the last). height: false keeps the props out of the contact-AO map.
 */
export function createProps(meshes, { height = true } = {}) {
  const state = { draw: [], A: null, B: null };
  const plugin = ({ rp, depth, targets, bufferWith }) => {
    const S = GPUBufferUsage;
    const P = {
      height: height ? rp({ vs: 'vsToolHeight', fs: 'fsMap', target: targets.minMax, buffers: TOOL_VB }) : null,
      light: rp({ vs: 'vsToolLight', fs: 'fsMap', target: targets.minMax, buffers: TOOL_VB }),
      scene: rp({ vs: 'vsTool', fs: 'fsTool', target: targets.sceneT, depth: depth(true), cull: 'back', buffers: TOOL_VB, ms: true }),
    };
    const bufs = {};
    for (const [k, m] of Object.entries(meshes)) bufs[k] = { vb: bufferWith(m.vtx, S.VERTEX), ib: bufferWith(m.index, S.INDEX), count: m.index.length, fmt: indexFormat(m.index) };
    const draw = (p, pipe) => {
      if (!pipe) return;
      for (const k of state.draw) { const b = bufs[k]; p.setPipeline(pipe); p.setVertexBuffer(0, b.vb); p.setIndexBuffer(b.ib, b.fmt); p.drawIndexed(b.count); }
    };
    return {
      maps(p, kind) { draw(p, P[kind]); },
      scene(p) { draw(p, P.scene); },
      frame(U) { if (state.A) U.set(state.A, UO.PROP_A); if (state.B) U.set(state.B, UO.PROP_B); },
    };
  };
  return { plugin, state };
}

/** Skinned sheets and meshes (membranes, seeds) share one vertex stage; the specimen shades them. */
export const SKINNED_WGSL = /* wgsl */`
struct MV { @builtin(position) pos: vec4f, @location(0) wp: vec3f };
@vertex fn vsMem(@builtin(vertex_index) vi: u32) -> MV {
  var o: MV;
  let p = skinPos[vi].xyz;
  o.pos = F.viewProj * vec4f(p, 1.0); o.wp = p;
  return o;
}
`;

/** Draws the triangles of channel `key` (assembled meshes: m.ch[key].index) with fragment `fs`;
 *  over: blended over the scene without depth writes (thin milky sheets), else opaque. */
export function skinnedPlugin(key, fs, { over = false } = {}) {
  return ({ rp, depth, targets, bufferWith }) => {
    const pipe = rp({ vs: 'vsMem', fs, target: over ? targets.overRGB : targets.sceneT, depth: depth(!over), ms: true });
    let buf = null, count = 0;
    return {
      setMeshes(m) {
        buf?.destroy();
        const ix = m.ch?.[key]?.index;
        count = ix ? ix.length : 0;
        buf = count ? bufferWith(ix, GPUBufferUsage.INDEX) : null;
      },
      scene(p) { if (count) { p.setPipeline(pipe); p.setIndexBuffer(buf, 'uint32'); p.drawIndexed(count); } },
    };
  };
}

/** WGSL for what rides inside a body (fruit, eyes): instance ii sits on three skinned anchors from F.bases.z
 *  (centre, centre + along, centre - across), turns with them and gives a little (give: min, max stretch). */
export const CARRY_WGSL = /* wgsl */`
struct Carried { wp: vec3f, n: vec3f };
fn carried(ii: u32, lp: vec3f, ln: vec3f, anchor: f32, give: vec2f) -> Carried {
  let b = u32(F.bases.z) + 3u * ii;
  let p0 = skinPos[b].xyz;
  let ex = skinPos[b + 1u].xyz - p0;
  let lx = max(length(ex), 1e-5);
  let X = ex / lx;
  var Y = p0 - skinPos[b + 2u].xyz;
  Y = normalize(Y - X * dot(Y, X) + vec3f(0.0, 1e-6, 0.0));
  let Z = cross(X, Y);
  let st = clamp(lx / anchor, give.x, give.y);
  let sc = inst[ii].x;
  var o: Carried;
  o.wp = p0 + (X * lp.x * st + Y * lp.y + Z * lp.z) * sc;
  o.n = normalize(X * ln.x / st + Y * ln.y + Z * ln.z);
  return o;
}
`;

/** One small mesh (position + normal) drawn once per seed instance (m.seedCount) by `vs`/`fs`. */
export function instancedPlugin(mesh, vs, fs) {
  const VB = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] }];
  return ({ rp, depth, targets, bufferWith }) => {
    const pipe = rp({ vs, fs, target: targets.sceneT, depth: depth(true), cull: 'back', buffers: VB, ms: true });
    const vb = bufferWith(mesh.vtx, GPUBufferUsage.VERTEX), ib = bufferWith(mesh.index, GPUBufferUsage.INDEX), fmt = indexFormat(mesh.index);
    let n = 0;
    return {
      setMeshes(m) { n = m.seedCount || 0; },
      scene(p) { if (n) { p.setPipeline(pipe); p.setVertexBuffer(0, vb); p.setIndexBuffer(ib, fmt); p.drawIndexed(mesh.index.length, n); } },
    };
  };
}
