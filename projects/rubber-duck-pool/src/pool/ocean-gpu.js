// The open sea's surface on the GPU, every frame (compute): the spectrum (ocean.js) turned to the world's time, eight
// fields per cascade inverse-Fourier-transformed (a row or a column per workgroup, its butterflies in workgroup
// memory: radix 2, Stockham, two real fields to one complex), the result written to one texture array, and its
// mipmaps. Per cascade c, layer 2c: the displacement (x, height, z) and the foam; layer 2c + 1: the slopes and their
// squares, so the mipmaps also keep how rough the water is where its waves are too small to draw.
import { OCEAN, oceanSpectrum } from './ocean.js';

const N = OCEAN.N, C = OCEAN.L.length, LEVELS = Math.log2(N) + 1;
const f = (v) => v.toFixed(6);

const WGSL = /* wgsl */ `
const N: u32 = ${N}u;
const PI: f32 = 3.14159265;
const L: vec4f = vec4f(${OCEAN.L.map(f).join(', ')});
const GU: f32 = ${f(9.81 / OCEAN.M)};   // gravity in units / s²
const CHOP: f32 = ${f(OCEAN.chop)};
struct Prm { t: f32, dt: f32, p0: f32, p1: f32 }
@group(0) @binding(0) var<uniform> prm: Prm;
@group(0) @binding(1) var<storage, read> h0: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> fld: array<vec4f>;   // two vec4 per texel: four complex fields
@group(0) @binding(3) var<storage, read_write> foam: array<f32>;
@group(0) @binding(4) var dst: texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(5) var src: texture_2d_array<f32>;

fn cmul(a: vec2f, b: vec2f) -> vec2f { return vec2f(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
fn ci(a: vec2f) -> vec2f { return vec2f(-a.y, a.x); }   // i a

// the spectrum at time t: h(k) e^(-iwt) + conj(h(-k)) e^(iwt), and from it the spectra of the fields, paired as A + iB:
// (Dx, Dz), (height, dDx/dz), (dh/dx, dh/dz), (dDx/dx, dDz/dz)
@compute @workgroup_size(16, 16, 1)
fn spectrum(@builtin(global_invocation_id) id: vec3u) {
  let c = id.z;
  let i = (c * N + id.y) * N + id.x;
  let n = vec2f(f32(select(i32(id.x), i32(id.x) - i32(N), id.x >= N / 2u)), f32(select(i32(id.y), i32(id.y) - i32(N), id.y >= N / 2u)));
  let k = n * (2.0 * PI / L[c]);
  let kl = length(k);
  let e = vec2f(cos(sqrt(GU * kl) * prm.t), sin(sqrt(GU * kl) * prm.t));
  let a = h0[i];
  let h = cmul(a.xy, vec2f(e.x, -e.y)) + cmul(vec2f(a.z, -a.w), e);
  let ik = select(vec2f(0.0), k / kl, kl > 1e-6);
  let rk = select(0.0, 1.0 / kl, kl > 1e-6);
  let dx = -ci(h) * ik.x;
  let dz = -ci(h) * ik.y;
  let xz = h * (k.x * k.y * rk);
  fld[2u * i] = vec4f(dx + ci(dz), h + ci(xz));
  fld[2u * i + 1u] = vec4f(ci(h) * k.x + ci(ci(h) * k.y), h * (k.x * k.x * rk) + ci(h * (k.y * k.y * rk)));
}

var<workgroup> line: array<vec4f, ${2 * N}>;
// one row (stride 1) or column (stride N) of N texels, inverse-transformed in place
fn transform(j: u32, base: u32, stride: u32) {
  for (var r = 0u; r < 2u; r++) {
    let e = j + r * (N / 2u);
    let g = base + e * stride;
    line[2u * e] = fld[2u * g]; line[2u * e + 1u] = fld[2u * g + 1u];
  }
  workgroupBarrier();
  for (var s = 0u; (1u << s) < N; s++) {
    let ns = 1u << s;
    let q = j & (ns - 1u);
    let w = vec2f(cos(PI * f32(q) / f32(ns)), sin(PI * f32(q) / f32(ns)));
    let a0 = line[2u * j]; let a1 = line[2u * j + 1u];
    let b0 = line[2u * (j + N / 2u)]; let b1 = line[2u * (j + N / 2u) + 1u];
    let c0 = vec4f(cmul(b0.xy, w), cmul(b0.zw, w));
    let c1 = vec4f(cmul(b1.xy, w), cmul(b1.zw, w));
    workgroupBarrier();
    let d = (j - q) * 2u + q;
    line[2u * d] = a0 + c0; line[2u * d + 1u] = a1 + c1;
    line[2u * (d + ns)] = a0 - c0; line[2u * (d + ns) + 1u] = a1 - c1;
    workgroupBarrier();
  }
  for (var r = 0u; r < 2u; r++) {
    let e = j + r * (N / 2u);
    let g = base + e * stride;
    fld[2u * g] = line[2u * e]; fld[2u * g + 1u] = line[2u * e + 1u];
  }
}
@compute @workgroup_size(${N / 2}, 1, 1)
fn rows(@builtin(local_invocation_id) l: vec3u, @builtin(workgroup_id) g: vec3u) { transform(l.x, (g.y * N + g.x) * N, 1u); }
@compute @workgroup_size(${N / 2}, 1, 1)
fn cols(@builtin(local_invocation_id) l: vec3u, @builtin(workgroup_id) g: vec3u) { transform(l.x, g.y * N * N + g.x, N); }

// the surface: displacement, slopes over the leaning crests, and foam where they fold (the Jacobian below its
// threshold), lingering and fading
@compute @workgroup_size(16, 16, 1)
fn surface(@builtin(global_invocation_id) id: vec3u) {
  let c = id.z;
  let i = (c * N + id.y) * N + id.x;
  let f0 = fld[2u * i];
  let f1 = fld[2u * i + 1u];
  let jx = 1.0 + CHOP * f1.z;
  let jz = 1.0 + CHOP * f1.w;
  let jxz = CHOP * f0.w;
  let det = jx * jz - jxz * jxz;
  let s = f1.xy / vec2f(max(jx, 0.3), max(jz, 0.3));
  let fo = max(foam[i] * exp(-prm.dt * 0.6), clamp((0.7 - det) * 2.2, 0.0, 1.0));
  foam[i] = fo;
  textureStore(dst, vec2i(id.xy), i32(2u * c), vec4f(CHOP * f0.x, f0.z, CHOP * f0.y, fo));
  textureStore(dst, vec2i(id.xy), i32(2u * c + 1u), vec4f(s, s * s));
}

// a mipmap level from the one above: each texel the mean of four
@compute @workgroup_size(8, 8, 1)
fn mip(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= textureDimensions(dst))) { return; }
  let p = vec2i(id.xy) * 2;
  let l = i32(id.z);
  let v = textureLoad(src, p, l, 0) + textureLoad(src, p + vec2i(1, 0), l, 0) + textureLoad(src, p + vec2i(0, 1), l, 0) + textureLoad(src, p + vec2i(1, 1), l, 0);
  textureStore(dst, vec2i(id.xy), l, v * 0.25);
}
`;

/** device -> { texture (N² × 2C layers, rgba16float, mipmapped; copyable, so a check can read it back), spec (ocean.js),
 * update(t) (runs the frame's compute) }. */
export async function createOcean(device) {
  const U = GPUBufferUsage, spec = oceanSpectrum();
  device.pushErrorScope('validation');
  const mod = device.createShaderModule({ code: WGSL });
  const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === 'error');
  if (errs.length) throw new Error('ocean WGSL:\n' + errs.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n'));
  const pipe = (entryPoint) => device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint } });
  const P = { spectrum: pipe('spectrum'), rows: pipe('rows'), cols: pipe('cols'), surface: pipe('surface'), mip: pipe('mip') };
  const prm = device.createBuffer({ size: 16, usage: U.UNIFORM | U.COPY_DST });
  const h0 = device.createBuffer({ size: spec.h0.byteLength, usage: U.STORAGE | U.COPY_DST });
  device.queue.writeBuffer(h0, 0, spec.h0);
  const fld = device.createBuffer({ size: C * N * N * 32, usage: U.STORAGE });
  const foam = device.createBuffer({ size: C * N * N * 4, usage: U.STORAGE });
  const texture = device.createTexture({ size: [N, N, 2 * C], format: 'rgba16float', mipLevelCount: LEVELS, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC });
  const level = (l) => texture.createView({ dimension: '2d-array', baseMipLevel: l, mipLevelCount: 1 });
  const group = (p, entries) => device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: entries.map(([binding, resource]) => ({ binding, resource })) });
  const G = {
    spectrum: group(P.spectrum, [[0, { buffer: prm }], [1, { buffer: h0 }], [2, { buffer: fld }]]),
    rows: group(P.rows, [[2, { buffer: fld }]]), cols: group(P.cols, [[2, { buffer: fld }]]),
    surface: group(P.surface, [[0, { buffer: prm }], [2, { buffer: fld }], [3, { buffer: foam }], [4, level(0)]]),
    mips: Array.from({ length: LEVELS - 1 }, (_, l) => group(P.mip, [[4, level(l + 1)], [5, level(l)]])),
  };
  const perr = await device.popErrorScope();
  if (perr) throw new Error('ocean pipelines: ' + perr.message);
  const u = new Float32Array(4);
  let last = null;
  return {
    texture, spec,
    /** The surface at the world's time t (seconds); its foam fades by how far t moved on. */
    update(t) {
      u[0] = t; u[1] = last === null ? 0 : Math.max(0, Math.min(0.1, t - last)); last = t;
      device.queue.writeBuffer(prm, 0, u);
      const enc = device.createCommandEncoder(), p = enc.beginComputePass();
      p.setPipeline(P.spectrum); p.setBindGroup(0, G.spectrum); p.dispatchWorkgroups(N / 16, N / 16, C);
      p.setPipeline(P.rows); p.setBindGroup(0, G.rows); p.dispatchWorkgroups(N, C);
      p.setPipeline(P.cols); p.setBindGroup(0, G.cols); p.dispatchWorkgroups(N, C);
      p.setPipeline(P.surface); p.setBindGroup(0, G.surface); p.dispatchWorkgroups(N / 16, N / 16, C);
      p.setPipeline(P.mip);
      for (let l = 1; l < LEVELS; l++) { const s = Math.max(1, N >> l); p.setBindGroup(0, G.mips[l - 1]); p.dispatchWorkgroups(Math.ceil(s / 8), Math.ceil(s / 8), 2 * C); }
      p.end();
      device.queue.submit([enc.finish()]);
    },
  };
}
