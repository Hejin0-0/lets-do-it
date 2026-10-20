// The finishing pass a page opts into (spec.post of createDioramaRenderer): the HDR frame in, the display out, in
// place of the core's plain composite. Ambient occlusion from the distance buffer (half size, a spiral of samples
// turned per pixel, blurred on the way up by distance), bloom (a soft threshold, then a chain of halvings and a tent
// filter back up, each level blended into the one above by scatter), depth of field (the frame halved three times,
// read at the level the circle of confusion calls for: a miniature's shallow focus), then exposure, white balance,
// contrast, saturation, a cool/warm split, a vignette, a filmic tone curve, grain and dither. The page sets the look
// per frame (f.post, merged over LOOK); quality 'low' leaves out the occlusion, the depth of field and the grain and
// runs its bloom from a quarter of the frame.

/** The look with nothing set: neutral grading, a light bloom, everything in focus. dof: how strongly what is off the
 * focus distance blurs (the circle of confusion at twice the focus distance is half of it). */
export const LOOK = {
  exposure: 1, bloom: 0.08, threshold: 1, knee: 0.5, scatter: 0.7, bloomClamp: 40,
  contrast: 1, saturation: 1, vignette: 0, grain: 0, white: [1, 1, 1], ao: 0, aoRadius: 0.3, aoFar: 60,
  shadows: [1, 1, 1], highlights: [1, 1, 1], dof: 0, focus: 10,
};

const WGSL = /* wgsl */ `
struct View { vp: mat4x4f, inv: mat4x4f, eye: vec4f, right: vec4f, up: vec4f, pad: vec4f }
struct Look {
  a: vec4f,    // exposure, bloom, threshold, knee
  b: vec4f,    // contrast, saturation, vignette, grain
  wb: vec4f,   // white balance (rgb gains), ambient occlusion's strength
  sh: vec4f,   // the shadows' tint, bloom's clamp
  hi: vec4f,   // the highlights' tint, a seed for the grain
  px: vec4f,   // the frame's size and its inverse
  ao: vec4f,   // occlusion's reach (world units), how far out it is drawn, 0, bloom's first size (a half or a quarter)
  df: vec4f,   // depth of field: strength, focus distance
}
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> Q: Look;
@group(0) @binding(2) var src: texture_2d<f32>;
@group(0) @binding(3) var dist: texture_2d<f32>;
@group(0) @binding(4) var bloomTex: texture_2d<f32>;
@group(0) @binding(5) var aoTex: texture_2d<f32>;
@group(0) @binding(6) var lin: sampler;
@group(0) @binding(7) var blurTex: texture_2d<f32>;   // the frame at a half, a quarter and an eighth, for the depth of field

const LUMA: vec3f = vec3f(0.2126, 0.7152, 0.0722);
fn hash(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}
@vertex fn vsFull(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

// ----- ambient occlusion, at half size: how much of a small ball round the point the scene fills (volumetric
// obscurance: half for a flat surface whatever its slope, more in a crease or a corner). It needs no normals, which
// the half-float distance could not give cleanly. A sample far in front of the ball (an edge before a distant wall)
// says nothing and counts as half, so silhouettes keep no dark halo.
fn distAt(px: vec2i) -> f32 { return textureLoad(dist, clamp(px, vec2i(0), vec2i(Q.px.xy) - 1), 0).r; }
@fragment fn fsAO(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let px = vec2i(fp.xy) * 2;
  let d = distAt(px);
  if (d > Q.ao.y) { return vec4f(1.0); }
  // the ball's radius on screen at this distance
  let uv = (vec2f(px) + 0.5) * Q.px.zw;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let a = V.inv * vec4f(ndc, 0.0, 1.0);
  let b = V.inv * vec4f(ndc, 1.0, 1.0);
  let p = V.eye.xyz + normalize(b.xyz / b.w - a.xyz / a.w) * d;
  let c0 = V.vp * vec4f(p, 1.0);
  let c1 = V.vp * vec4f(p + V.up.xyz * Q.ao.x, 1.0);
  // pixels; at most 48 (half the frame's 1/18 at 900 high): wider spreads its samples past the texture cache
  let reach = min(length(c1.xy / c1.w - c0.xy / c0.w) * 0.5 * Q.px.y, 48.0);
  if (reach < 1.5) { return vec4f(1.0); }
  let turn = fract(52.9829189 * fract(dot(fp.xy, vec2f(0.06711056, 0.00583715)))) * 6.2832;
  var sum = 0.0;
  var wsum = 0.0;
  for (var i = 0; i < 12; i++) {
    let r = sqrt((f32(i) + 0.5) / 12.0);
    let ang = f32(i) * 2.39996 + turn;
    let ds = distAt(px + vec2i(vec2f(cos(ang), sin(ang)) * reach * r));
    let h = Q.ao.x * sqrt(1.0 - r * r);   // half the ball's depth along this ray
    let dd = d - ds;                      // how much nearer the eye the scene is there
    let fill = mix(clamp((dd + h) / (2.0 * h), 0.0, 1.0), 0.5, smoothstep(h, 3.0 * h, dd));
    sum += fill * h; wsum += h;
  }
  let occ = clamp((sum / wsum - 0.5) * 2.0, 0.0, 1.0);
  return vec4f(1.0 - occ * (1.0 - smoothstep(Q.ao.y * 0.6, Q.ao.y, d)));
}

// ----- bloom -----
fn karis(c: vec3f) -> f32 { return 1.0 / (1.0 + dot(c, LUMA)); }
fn tap(t: texture_2d<f32>, uv: vec2f) -> vec3f { return textureSampleLevel(t, lin, uv, 0.0).rgb; }
// a halving: 13 taps in five overlapping boxes, the middle one weighted most
fn down13(t: texture_2d<f32>, uv: vec2f) -> vec3f {
  let s = 1.0 / vec2f(textureDimensions(t));
  let a = tap(t, uv + s * vec2f(-2.0, -2.0)); let b = tap(t, uv + s * vec2f(0.0, -2.0)); let c = tap(t, uv + s * vec2f(2.0, -2.0));
  let d = tap(t, uv + s * vec2f(-1.0, -1.0)); let e = tap(t, uv + s * vec2f(1.0, -1.0));
  let f = tap(t, uv + s * vec2f(-2.0, 0.0)); let g = tap(t, uv); let h = tap(t, uv + s * vec2f(2.0, 0.0));
  let i = tap(t, uv + s * vec2f(-1.0, 1.0)); let j = tap(t, uv + s * vec2f(1.0, 1.0));
  let kk = tap(t, uv + s * vec2f(-2.0, 2.0)); let l = tap(t, uv + s * vec2f(0.0, 2.0)); let m = tap(t, uv + s * vec2f(2.0, 2.0));
  return (d + e + i + j) * 0.125 + (a + c + kk + m) * 0.03125 + (b + f + h + l) * 0.0625 + g * 0.125;
}
// the first step down, from the frame to half (or a quarter, Q.ao.w) its size: four bilinear taps over 4×4 pixels,
// each weighted down by its brightness (Karis) so a lone glint cannot flicker the bloom; then a soft threshold
@fragment fn fsPrefilter(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let s = 1.0 / vec2f(textureDimensions(src));
  let uv = fp.xy * s / Q.ao.w;
  var acc = vec3f(0.0);
  var ws = 0.0;
  for (var k = 0; k < 4; k++) {
    let t = tap(src, uv + s * vec2f(select(-1.0, 1.0, (k & 1) == 1), select(-1.0, 1.0, k > 1)));
    let w = karis(t * Q.a.x);
    acc += t * w; ws += w;
  }
  let c = min(acc / ws * Q.a.x, vec3f(Q.sh.w));
  // soft threshold: a knee below the threshold eases in
  let br = max(c.r, max(c.g, c.b));
  var soft = clamp(br - Q.a.z + Q.a.w, 0.0, 2.0 * Q.a.w);
  soft = soft * soft / (4.0 * Q.a.w + 1e-4);
  return vec4f(c * max(br - Q.a.z, soft) / max(br, 1e-4), 1.0);
}
// the frame at half size for the depth of field: a 4×4 box in four bilinear taps
@fragment fn fsHalf(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let s = 1.0 / vec2f(textureDimensions(src));
  let uv = fp.xy * s * 2.0;
  return vec4f((tap(src, uv + s * vec2f(-1.0, -1.0)) + tap(src, uv + s * vec2f(1.0, -1.0)) + tap(src, uv + s * vec2f(-1.0, 1.0)) + tap(src, uv + s)) * 0.25, 1.0);
}
@fragment fn fsDown(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let uv = fp.xy / (vec2f(textureDimensions(src)) * 0.5);
  return vec4f(down13(src, uv), 1.0);
}
@fragment fn fsUp(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let uv = fp.xy / (vec2f(textureDimensions(src)) * 2.0);
  let s = 1.0 / vec2f(textureDimensions(src));
  var c = tap(src, uv) * 4.0;
  c += (tap(src, uv + vec2f(s.x, 0.0)) + tap(src, uv - vec2f(s.x, 0.0)) + tap(src, uv + vec2f(0.0, s.y)) + tap(src, uv - vec2f(0.0, s.y))) * 2.0;
  c += tap(src, uv + s) + tap(src, uv - s) + tap(src, uv + vec2f(s.x, -s.y)) + tap(src, uv + vec2f(-s.x, s.y));
  return vec4f(c / 16.0, 1.0);
}

// ----- the composite -----
// occlusion up from half size: a 3×3 of its texels, each weighted by how near its distance is to this pixel's
fn aoUp(px: vec2i) -> f32 {
  let d = distAt(px);
  let h = px / 2;
  var s = 0.0; var ws = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let q = h + vec2i(x, y);
      let dq = distAt(q * 2);
      let w = exp(-abs(dq - d) / (0.03 * d + 0.01)) * select(1.0, 2.0, x == 0 && y == 0);
      s += textureLoad(aoTex, clamp(q, vec2i(0), vec2i(textureDimensions(aoTex)) - 1), 0).r * w; ws += w;
    }
  }
  return (s + 1e-3) / (ws + 1e-3);   // nothing near enough in distance (a lone edge pixel): unoccluded
}
// the filmic curve: an ACES fit (sRGB in and out through its working space), toe and shoulder
fn aces(c: vec3f) -> vec3f {
  let m1 = mat3x3f(vec3f(0.59719, 0.07600, 0.02840), vec3f(0.35458, 0.90834, 0.13383), vec3f(0.04823, 0.01566, 0.83777));
  let m2 = mat3x3f(vec3f(1.60475, -0.10208, -0.00327), vec3f(-0.53108, 1.10813, -0.07276), vec3f(-0.07367, -0.00605, 1.07602));
  let v = m1 * c;
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(m2 * (a / b), vec3f(0.0), vec3f(1.0));
}
@fragment fn fsPost(@builtin(position) fp: vec4f) -> @location(0) vec4f {
  let px = vec2i(fp.xy);
  let uv = fp.xy * Q.px.zw;
  var c = textureLoad(src, px, 0).rgb;
  if (Q.wb.w > 0.0) { c *= mix(1.0, aoUp(px), Q.wb.w); }
  // depth of field: the circle of confusion from how far off the focus distance this is, read from the halvings
  // (between their levels, trilinear), eased in from the sharp frame
  if (Q.df.x > 0.0) {
    let d = distAt(px);
    let coc = clamp(Q.df.x * abs(d - Q.df.y) / max(d, 1e-3), 0.0, 1.0);
    c = mix(c, textureSampleLevel(blurTex, lin, uv, coc * 2.0).rgb, smoothstep(0.02, 0.3, coc));
  }
  c = c * Q.a.x + textureSampleLevel(bloomTex, lin, uv, 0.0).rgb * Q.a.y;
  c *= Q.wb.rgb;
  // contrast in stops about mid grey, then saturation
  c = 0.18 * exp2(log2(max(c, vec3f(1e-6)) / 0.18) * Q.b.x);
  let y = dot(c, LUMA);
  c = max(vec3f(y) + (c - vec3f(y)) * Q.b.y, vec3f(0.0));
  // split: the shadows toward one tint, the highlights toward the other
  c *= mix(Q.sh.rgb, Q.hi.rgb, smoothstep(-3.0, 1.5, log2(max(y, 1e-6) / 0.18)));
  // vignette, in the light before the curve
  let e = (uv - 0.5) * vec2f(Q.px.x * Q.px.w, 1.0);
  c *= 1.0 - Q.b.z * smoothstep(0.35, 1.25, length(e));
  var o = aces(c);
  // grain: finer in the highlights, frame to frame
  let g = hash(fp.xy + Q.hi.w * 17.0) + hash(fp.xy * 1.3 - Q.hi.w * 9.0) - 1.0;
  o = max(o + o * g * Q.b.w * (1.0 - sqrt(dot(o, LUMA))), vec3f(0.0));
  let s = select(1.055 * pow(o, vec3f(1.0 / 2.4)) - 0.055, o * 12.92, o <= vec3f(0.0031308));
  return vec4f(s + (hash(fp.xy) - 0.5) / 255.0, 1.0);
}
`;

/** device, format (the canvas's), cam (the renderer's view uniform buffer), o: { quality: 'high' | 'low' }. */
export async function createPost(device, format, cam, o = {}) {
  device.pushErrorScope('validation');
  const mod = device.createShaderModule({ code: WGSL });
  const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === 'error');
  if (errs.length) throw Object.assign(new Error('post WGSL:\n' + errs.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n')), { code: 'shader' });
  const FS = GPUShaderStage.FRAGMENT, T = GPUTextureUsage, RB = T.RENDER_ATTACHMENT | T.TEXTURE_BINDING;
  const bgl = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: FS, buffer: { type: 'uniform' } }, { binding: 1, visibility: FS, buffer: { type: 'uniform' } },
    ...[2, 3, 4, 5, 7].map((binding) => ({ binding, visibility: FS, texture: { sampleType: binding === 3 ? 'unfilterable-float' : 'float' } })),
    { binding: 6, visibility: FS, sampler: { type: 'filtering' } }] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
  const pipe = (fs, fmt, blend) => device.createRenderPipeline({ layout, vertex: { module: mod, entryPoint: 'vsFull' },
    fragment: { module: mod, entryPoint: fs, targets: [{ format: fmt, blend }] }, primitive: { topology: 'triangle-list' } });
  const HDR = 'rgba16float', lerpBlend = { color: { srcFactor: 'constant', dstFactor: 'one-minus-constant' }, alpha: { srcFactor: 'one', dstFactor: 'zero' } };
  const P = { ao: pipe('fsAO', 'r8unorm'), pre: pipe('fsPrefilter', HDR), half: pipe('fsHalf', HDR), down: pipe('fsDown', HDR), up: pipe('fsUp', HDR, lerpBlend), post: pipe('fsPost', format) };
  const perr = await device.popErrorScope();
  if (perr) throw Object.assign(new Error('post pipelines: ' + perr.message), { code: 'pipeline' });

  const uni = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), U = new Float32Array(32);
  const lin = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  const one = device.createTexture({ size: [1, 1], format: 'r8unorm', usage: T.TEXTURE_BINDING | T.COPY_DST });
  device.queue.writeTexture({ texture: one }, new Uint8Array([255]), {}, [1, 1]);
  let quality = o.quality === 'low' ? 'low' : 'high', W = 0, H = 0, src = null, dist = null, groups = null, bloomScale = 0.5;
  let mips = [], blur = [], aoTex = null;
  const group = (s, b = one.createView(), a = one.createView(), bl = one.createView()) => device.createBindGroup({ layout: bgl, entries: [
    { binding: 0, resource: { buffer: cam } }, { binding: 1, resource: { buffer: uni } },
    { binding: 2, resource: s }, { binding: 3, resource: dist.createView() }, { binding: 4, resource: b }, { binding: 5, resource: a },
    { binding: 6, resource: lin }, { binding: 7, resource: bl }] });
  // a texture of n halvings from w×h, and a view of each level
  const chain = (w, h, n) => {
    const tex = device.createTexture({ size: [w, h], format: HDR, usage: RB, mipLevelCount: Math.min(n, Math.floor(Math.log2(Math.min(w, h))) + 1) });
    return Object.assign(Array.from({ length: tex.mipLevelCount }, (_, k) => tex.createView({ baseMipLevel: k, mipLevelCount: 1 })), { tex });
  };

  function build() {
    for (const t of [mips.tex, blur.tex, aoTex]) t && t.destroy();
    const low = quality === 'low', hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1);
    bloomScale = low ? 0.25 : 0.5;   // bloom from half size, or a quarter
    mips = chain(Math.max(1, W >> (low ? 2 : 1)), Math.max(1, H >> (low ? 2 : 1)), low ? 5 : 6);
    blur = low ? [] : chain(hw, hh, 3);
    aoTex = low ? null : device.createTexture({ size: [hw, hh], format: 'r8unorm', usage: RB });
    const s = src.createView();
    groups = {
      src: group(s),
      bloom: mips.map((m) => group(m)),   // reads level k: the source of a halving into k + 1, or of the way up into k - 1
      blur: blur.map((m) => group(m)),
      post: group(s, mips[0], (aoTex || one).createView(), blur.tex ? blur.tex.createView() : undefined),
    };
  }
  /** The frame's size and its colour and distance targets (the renderer's, made again on each resize). */
  function resize(w, h, colour, distance) { W = w; H = h; src = colour; dist = distance; build(); }
  function setQuality(q) { quality = q === 'low' ? 'low' : 'high'; if (src) build(); }

  let frame = 0;
  function encode(enc, view, look = {}) {
    const L = { ...LOOK, ...look }, high = quality === 'high', ao = high ? L.ao : 0, dof = high ? L.dof : 0;
    U.set([L.exposure, L.bloom, L.threshold, L.knee, L.contrast, L.saturation, L.vignette, high ? L.grain : 0,
      ...L.white, ao, ...L.shadows, L.bloomClamp, ...L.highlights, (frame++ % 64) + 1,
      W, H, 1 / W, 1 / H, L.aoRadius, L.aoFar, 0, bloomScale, dof, L.focus, 0, 0]);
    device.queue.writeBuffer(uni, 0, U);
    const pass = (target, pipeline, g, clear = true, scatter) => {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: target, loadOp: clear ? 'clear' : 'load', clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: 'store' }] });
      p.setPipeline(pipeline); p.setBindGroup(0, g);
      if (scatter !== undefined) p.setBlendConstant([scatter, scatter, scatter, scatter]);
      p.draw(3); p.end();
    };
    if (aoTex && ao > 0) pass(aoTex.createView(), P.ao, groups.src);
    if (blur.length && dof > 0) {
      pass(blur[0], P.half, groups.src);
      for (let k = 0; k + 1 < blur.length; k++) pass(blur[k + 1], P.down, groups.blur[k]);
    }
    pass(mips[0], P.pre, groups.src);
    for (let k = 0; k + 1 < mips.length; k++) pass(mips[k + 1], P.down, groups.bloom[k]);
    for (let k = mips.length - 2; k >= 0; k--) pass(mips[k], P.up, groups.bloom[k + 1], false, L.scatter);
    pass(view, P.post, groups.post);
  }
  return { resize, encode, setQuality, get quality() { return quality; } };
}
