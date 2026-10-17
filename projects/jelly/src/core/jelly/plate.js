// The serving plate a turned-out jelly stands on (01, 04): glazed porcelain with a gold line, a shallow
// well and a raised rim, on a table a little lower than its top. It is lit like the floor, so the jelly's
// tinted shadow and contact shade fall on it; the sim stands on the same profile (plateGround).
import { backdropRadiance } from '../math.js';
import { vertexNormals } from './sdfbody.js';

export const PLATE = { well: 1.75, rim: 2.3, rimH: 0.14, roll: 0.022, wall: 0.045, under: -0.05, table: -0.085, ring: 1.42 };
const lip = (r) => PLATE.rimH * Math.pow(Math.min(1, Math.max(0, (r - PLATE.well) / (PLATE.rim - PLATE.well))), 1.6);
const TOP = 27;   // profile points on the top face (the well, then the lip)

/** The height the jelly stands on: the well, the lip, then the table beyond the rim. */
export function plateGround(x, z) {
  const r = Math.sqrt(x * x + z * z);
  return r <= PLATE.well ? 0 : r <= PLATE.rim ? lip(r) : PLATE.table;
}

/** Lathe of the plate's profile: the well and lip on top, the rolled rim, the underside and the foot ring. */
export function plateMesh(N = 160) {
  const P = PLATE, prof = [];
  for (let k = 0; k <= 10; k++) prof.push([P.well * k / 10, 0]);
  for (let k = 1; k <= 16; k++) { const r = P.well + (P.rim - P.well) * k / 16; prof.push([r, lip(r)]); }
  for (let k = 1; k <= 8; k++) { const a = Math.PI / 2 - Math.PI * k / 8; prof.push([P.rim + P.roll * Math.cos(a), P.rimH - P.roll + P.roll * Math.sin(a)]); }
  for (let k = 1; k <= 12; k++) { const r = P.rim - (P.rim - P.well + 0.1) * k / 12; prof.push([r, Math.max(P.under, lip(r) - P.wall)]); }
  prof.push([1.5, P.under], [1.47, P.table], [1.33, P.table], [1.3, P.under], [0.6, P.under], [0, P.under]);
  const M = prof.length, pos = new Float32Array(N * M * 3);
  for (let i = 0; i < N; i++) {
    const th = i / N * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    for (let j = 0; j < M; j++) { const o = 3 * (i * M + j); pos[o] = prof[j][0] * c; pos[o + 1] = prof[j][1]; pos[o + 2] = prof[j][0] * s; }
  }
  const idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < M - 1; j++) {
    const a = i * M + j, b = ((i + 1) % N) * M + j;
    idx.push(a, b + 1, a + 1, a, b, b + 1);   // wound outward (the profile runs out along the top, back underneath)
  }
  const index = Uint32Array.from(idx), nrm = vertexNormals(pos, index);
  for (let i = 0; i < N; i++) { const o = 3 * (i * M); nrm[o] = 0; nrm[o + 1] = 1; nrm[o + 2] = 0; }   // the centre of the well
  const vtx = new Float32Array(N * M * 6);
  for (let v = 0; v < N * M; v++) vtx.set([pos[3 * v], pos[3 * v + 1], pos[3 * v + 2], nrm[3 * v], nrm[3 * v + 1], nrm[3 * v + 2]], 6 * v);
  return { vtx, index, top: TOP };
}

const f3 = (c) => `vec3f(${c.map((v) => v.toFixed(5)).join(', ')})`;

/** WGSL: the plate's shading, and the table's floor (lower, with the plate's own soft shadow).
 *  Pass `replace` to the renderer, `wgsl` with its passes, and platePlugin() among its plugins.
 *  decal: the body of fn plateDecal(P: vec3f) -> vec4f, something lying on the glaze (radiance, cover). */
export function plateLook(glaze = '#faf7f1', { decal = 'return vec4f(0.0);' } = {}) {
  const P = PLATE;
  return {
    replace: {
      FLOOR_Y: `const FLOOR_Y = ${P.table.toFixed(4)};`,
      // the table: lit like any floor, plus the plate's contact shade and its shadow cast away from the key
      floorShade: /* wgsl */`
fn floorShade(P: vec3f) -> vec3f {
  let r = length(P.xz);
  let q = length(P.xz + KEY.xz / KEY.y * 0.13) - ${P.rim.toFixed(3)};
  let shadowed = mix(0.66, 1.0, smoothstep(-0.05, 0.2, q));
  let foot = mix(0.82, 1.0, smoothstep(0.0, 0.14, r - ${P.rim.toFixed(3)}));
  return F.base.rgb * floorLight(P, vec3f(0.0, 1.0, 0.0)) * shadowed * foot;
}`,
    },
    wgsl: /* wgsl */`
// ---------- the plate: glazed porcelain, a gold line at the rim and one round the well ----------
struct PlV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f };
@vertex fn vsPlate(@location(0) p: vec3f, @location(1) n: vec3f) -> PlV {
  var o: PlV;
  o.pos = F.viewProj * vec4f(p, 1.0); o.wp = p; o.n = n;
  return o;
}
fn plateDecal(P: vec3f) -> vec4f { ${decal} }
fn band(x: f32, a: f32, b: f32) -> f32 { return smoothstep(a - 0.004, a + 0.004, x) * (1.0 - smoothstep(b - 0.004, b + 0.004, x)); }
@fragment fn fsPlate(i: PlV, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  var N = normalize(i.n);
  if (!ff) { N = -N; }
  let toCam = F.camPos.xyz - i.wp;
  let d = length(toCam);
  let V = toCam / d;
  let r = length(i.wp.xz);
  let up = smoothstep(0.3, 0.7, N.y);
  let gold = up * clamp(band(r, ${(P.rim - 0.09).toFixed(3)}, ${(P.rim - 0.045).toFixed(3)}) + band(r, ${(P.ring - 0.007).toFixed(3)}, ${(P.ring + 0.007).toFixed(3)}), 0.0, 1.0);
  let lit = floorLight(i.wp, N);
  let shade = clamp((dot(lit, vec3f(0.3333)) - 0.52) / 0.48, 0.0, 1.0);   // how much of the key reaches here
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);
  let F0 = mix(vec3f(0.04), vec3f(0.95, 0.72, 0.32), gold);
  let Fr = F0 + (1.0 - F0) * pow(1.0 - NdV, 5.0);
  let dc = plateDecal(i.wp) * up;
  let rough = mix(mix(0.05, 0.22, gold), 0.025, dc.a);
  let spec = (env(R, rough) * mix(0.55, 0.9, dc.a) + vec3f(1.0, 0.97, 0.93) * 2.0 * ggx(N, V, KEY, rough) * shade) * Fr;
  let base = mix(${f3(backdropRadiance(glaze))} * (1.0 - gold * 0.85), dc.rgb, dc.a) * lit;
  return vec4f(base * (1.0 - Fr * 0.5) + spec, d);
}
`,
  };
}

/** Renderer plugin: draws the plate into the scene (so the jelly refracts it); it stays out of the shadow maps. */
export function platePlugin(mesh = plateMesh()) {
  const VB = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] }];
  return ({ rp, depth, targets, bufferWith }) => {
    const pipe = rp({ vs: 'vsPlate', fs: 'fsPlate', target: targets.sceneT, depth: depth(true), cull: 'none', buffers: VB, ms: true });
    const vb = bufferWith(mesh.vtx, GPUBufferUsage.VERTEX), ib = bufferWith(mesh.index, GPUBufferUsage.INDEX);
    return { scene(p) { p.setPipeline(pipe); p.setVertexBuffer(0, vb); p.setIndexBuffer(ib, 'uint32'); p.drawIndexed(mesh.index.length); } };
  };
}
