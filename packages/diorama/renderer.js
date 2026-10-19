// The renderer every jelly-block diorama shares, on the page's device. Per frame: the sea texture, the
// specimen's instance data and the bubbles in; passes: the sun's shadow map (2048²), caustics (768²,
// additive), the opaque scene (MSAA 4×, colour + linear distance: studio, ground and strata, the specimen's
// layers, bubbles), the sea's back faces (r32float), the sea's front faces over a copy of the opaque scene,
// the composite to the canvas. A specimen brings its WGSL (groundTop and its layers' entry points) and its
// layers: { vs, fs, buffers, vert, index, count?(frame) -> instances, shadow?, cull? }. Optional foam on the sea.
import { coreWGSL, PAL } from './wgsl.js';

/** Uniform offsets (floats) of the core's fields; the palette starts at UO.PAL (U.pal[k] at UO.PAL + 4k). */
export const UO = { M: 0, MINV: 16, SUNVP: 32, EYE: 48, WOB: 52, SUN: 56, SUNL: 60, SCREEN: 64, SIGMA: 68, TINT: 72, PAPER: 76, REFR: 80, SUNC: 84, PAL: 88, SIZE: 88 + 4 * PAL };

// ----- static geometry -----
export function icosphere(sub) {
  const t = (1 + Math.sqrt(5)) / 2;
  let P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((v) => v / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const cache = new Map(), mid = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!cache.has(k)) { const m = P[a].map((v, i) => v + P[b][i]), l = Math.hypot(...m); P.push(m.map((v) => v / l)); cache.set(k, P.length - 1); }
      return cache.get(k);
    };
    F = F.flatMap(([a, b, c]) => { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  }
  return { pos: new Float32Array(P.flat()), index: new Uint32Array(F.flat()) };
}
/** Make every triangle face its intended side. */
export function orient(V, stride, I, want) {
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * stride, b = I[t + 1] * stride, c = I[t + 2] * stride;
    const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], w = want(I[t]);
    if (n[0] * w[0] + n[1] * w[1] + n[2] * w[2] < 0) { const s = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = s; }
  }
  return I;
}
const wallsOf = (half) => [[[1, 0], (s) => [half, s]], [[-1, 0], (s) => [-half, -s]], [[0, 1], (s) => [-s, half]], [[0, -1], (s) => [s, -half]]];
/** The ground's top and its four cut walls, from base up: pos3, nrm3, extra4 (top: mask a, 0, mask b, mask c / wall: perimeter u, 1, terrain top). mask(x, z): a number or [a, b, c]. */
export function groundMesh({ N, half, terrainH, terrainNormal, mask = () => 0, base = 0 }) {
  const dx = (2 * half) / N, n1 = N + 1, V = [], I = [], nrm = [0, 0, 0];
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
    const x = -half + i * dx, z = -half + j * dx, m = mask(x, z);
    terrainNormal(x, z, nrm);
    if (typeof m === 'number') V.push(x, terrainH(x, z), z, nrm[0], nrm[1], nrm[2], m, 0, 0, 0);
    else V.push(x, terrainH(x, z), z, nrm[0], nrm[1], nrm[2], m[0], 0, m[1], m[2]);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * n1 + i; I.push(a, a + n1, a + 1, a + 1, a + n1, a + n1 + 1); }
  wallsOf(half).forEach(([nn, at], k) => {
    const first = V.length / 10;
    for (let q = 0; q <= N; q++) {
      const s = -half + q * dx, [x, z] = at(s), top = terrainH(x, z), u = k * 2 * half + q * dx;
      V.push(x, base, z, nn[0], 0, nn[1], u, 1, top, 0);
      V.push(x, top, z, nn[0], 0, nn[1], u, 1, top, 0);
    }
    for (let q = 0; q < N; q++) { const a = first + 2 * q; I.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  });
  const Vf = new Float32Array(V);
  return { vert: Vf, index: orient(Vf, 10, new Uint32Array(I), (i) => [Vf[10 * i + 3], Vf[10 * i + 4], Vf[10 * i + 5]]) };
}
/** The sea's four cut walls: (x, z, terrain y, top?), outward normal (x, z). */
export function seaWallMesh({ N, half, terrainH }) {
  const dx = (2 * half) / N, V = [], I = [];
  for (const [nn, at] of wallsOf(half)) {
    const first = V.length / 6;
    for (let q = 0; q <= N; q++) {
      const [x, z] = at(-half + q * dx), t = terrainH(x, z);
      V.push(x, z, t, 0, nn[0], nn[1], x, z, t, 1, nn[0], nn[1]);
    }
    for (let q = 0; q < N; q++) { const a = first + 2 * q; I.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  }
  // orientation from rest heights (top = terrain + 0.4)
  const P = new Float32Array(V.length / 6 * 3);
  for (let i = 0; i < V.length / 6; i++) { P[3 * i] = V[6 * i]; P[3 * i + 1] = V[6 * i + 2] + 0.4 * V[6 * i + 3]; P[3 * i + 2] = V[6 * i + 1]; }
  return { vert: new Float32Array(V), index: orient(P, 3, new Uint32Array(I), (i) => [V[6 * i + 4], 0, V[6 * i + 5]]) };
}
function gridIndex(n) {   // (n x n) vertices, row-major, triangles facing +y
  const I = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i; I.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], k); k += 6; }
  return I;
}

const VB_GROUND = [{ arrayStride: 40, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x4' }] }];
const VB_SPHERE = [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }];
const VB_WALL = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x2' }] }];

/**
 * gpu: { device, context, format } (device: the specimen's resource scope).
 * spec: { N, half, terrainH, terrainNormal, groundMask?, base? (the cut walls' foot; default 0, the floor), wgsl, layers: [layer], instFloats?, maxBubbles?, sunColor?,
 *         backdrop? (WGSL: env, ambient, fsBG; default the studio), waterFS? (the sea's own fragment entry in wgsl, taking WOut; default the core's fsWater) }
 * layer: { vs, fs, buffers, vert, index, count?(frame) (instances; default 1), shadow? (casts into the sun map), cull?,
 *          texture? (a 2d-array GPUTexture: the layer's own, at @group(3) @binding(0) with a mipmapped, repeating sampler at @binding(1); the vertex stage reads it too) }
 */
export async function createDioramaRenderer(gpu, canvas, spec) {
  const { device, context: ctx, format } = gpu;
  const S = GPUBufferUsage, T = GPUTextureUsage, MS = 4, GN = spec.N;
  const buf = (data, usage) => {
    const b = device.createBuffer({ size: Math.max(16, Math.ceil(data.byteLength / 4) * 4), usage: usage | S.COPY_DST });
    device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const tex = (w, h, fmt, usage, sampleCount = 1) => device.createTexture({ size: [w, h], format: fmt, usage, sampleCount });

  device.pushErrorScope('validation');
  const mod = device.createShaderModule({ code: coreWGSL({ N: spec.N, half: spec.half, sunColor: spec.sunColor, backdrop: spec.backdrop }) + spec.wgsl });
  const errs = (await mod.getCompilationInfo()).messages.filter((m) => m.type === 'error');
  if (errs.length) throw Object.assign(new Error('WGSL:\n' + errs.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n')), { code: 'shader' });

  // ----- layouts -----
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, FS = GPUShaderStage.FRAGMENT;
  const g0L = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: VF, buffer: { type: 'uniform' } },
    { binding: 1, visibility: VF, buffer: { type: 'read-only-storage' } },
    { binding: 2, visibility: VF, buffer: { type: 'read-only-storage' } }] });
  const g1L = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: { type: 'uniform' } }] });
  const g2L = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: VF, texture: { sampleType: 'unfilterable-float' } },
    { binding: 1, visibility: FS, texture: { sampleType: 'depth' } },
    { binding: 2, visibility: FS, texture: { sampleType: 'float' } },
    { binding: 3, visibility: FS, texture: { sampleType: 'float' } },
    { binding: 4, visibility: FS, texture: { sampleType: 'float' } },
    { binding: 5, visibility: FS, texture: { sampleType: 'unfilterable-float' } },
    { binding: 6, visibility: FS, sampler: { type: 'filtering' } },
    { binding: 7, visibility: FS, sampler: { type: 'comparison' } },
    { binding: 8, visibility: FS, texture: { sampleType: 'float' } }] });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [g0L, g1L, g2L] });

  // ----- pipelines -----
  const hdr = { format: 'rgba16float' };
  const mrt = [hdr, hdr];
  const depth = (write, compare = 'less', fmt = 'depth24plus') => ({ format: fmt, depthWriteEnabled: write, depthCompare: compare });
  const rp = (o) => device.createRenderPipeline({
    layout: o.layout || layout,
    vertex: { module: mod, entryPoint: o.vs, buffers: o.vb || [] },
    fragment: o.fs ? { module: mod, entryPoint: o.fs, targets: o.targets } : undefined,
    primitive: { topology: 'triangle-list', cullMode: o.cull || 'none' },
    depthStencil: o.depth,
    multisample: { count: o.ms ? MS : 1, alphaToCoverageEnabled: !!o.a2c },
  });
  const shadowDepth = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.5 };
  const P = {
    shGround: rp({ vs: 'vsGround', vb: VB_GROUND, depth: shadowDepth }),
    caustic: rp({ vs: 'vsCaustic', fs: 'fsCaustic', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }] }),
    bg: rp({ vs: 'vsFull', fs: 'fsBG', targets: mrt, depth: depth(false, 'always'), ms: true }),
    ground: rp({ vs: 'vsGround', fs: 'fsGround', vb: VB_GROUND, targets: mrt, depth: depth(true), ms: true }),
    bubble: rp({ vs: 'vsBubble', fs: 'fsBubble', vb: VB_SPHERE, depth: depth(false), ms: true, targets: [
      { format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } },
      { format: 'rgba16float', writeMask: 0 }] }),
    backSea: rp({ vs: 'vsWater', fs: 'fsWaterBack', targets: [{ format: 'r32float' }], depth: depth(true), cull: 'front' }),
    backWall: rp({ vs: 'vsWall', fs: 'fsWaterBack', vb: VB_WALL, targets: [{ format: 'r32float' }], depth: depth(true), cull: 'front' }),
    copy: rp({ vs: 'vsFull', fs: 'fsCopy', targets: [hdr], depth: depth(false, 'always'), ms: true }),
    sea: rp({ vs: 'vsWater', fs: spec.waterFS || 'fsWater', targets: [hdr], depth: depth(true), ms: true, cull: 'back' }),
    wall: rp({ vs: 'vsWall', fs: spec.waterFS || 'fsWater', vb: VB_WALL, targets: [hdr], depth: depth(true), ms: true, cull: 'back' }),
    composite: rp({ vs: 'vsFull', fs: 'fsComposite', targets: [{ format }] }),
  };
  const g3L = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: VF, texture: { sampleType: 'float', viewDimension: '2d-array' } },
    { binding: 1, visibility: VF, sampler: { type: 'filtering' } }] });
  const texLayout = device.createPipelineLayout({ bindGroupLayouts: [g0L, g1L, g2L, g3L] });
  const layers = (spec.layers || []).map((L) => {
    const lay = L.texture ? texLayout : layout;
    return {
      ...L,
      pipe: rp({ vs: L.vs, fs: L.fs, vb: L.buffers, targets: mrt, depth: depth(true), ms: true, cull: L.cull, a2c: true, layout: lay }),   // alpha to coverage: an alpha below 1 is see-through (MAT.CLEAR)
      shadowPipe: L.shadow ? rp({ vs: L.vs, vb: L.buffers, depth: shadowDepth, layout: lay }) : null,
      g3: L.texture ? device.createBindGroup({ layout: g3L, entries: [
        { binding: 0, resource: L.texture.createView({ dimension: '2d-array' }) },
        { binding: 1, resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: 8 }) }] }) : null,
      vb: buf(L.vert, S.VERTEX), ib: buf(L.index, S.INDEX), n: L.index.length,
    };
  });
  const perr = await device.popErrorScope();
  if (perr) throw Object.assign(new Error('Pipeline creation failed: ' + perr.message), { code: 'pipeline' });

  // ----- static resources -----
  const G = groundMesh({ N: spec.N, half: spec.half, terrainH: spec.terrainH, terrainNormal: spec.terrainNormal, mask: spec.groundMask, base: spec.base });
  const W = seaWallMesh({ N: spec.N, half: spec.half, terrainH: spec.terrainH }), SB = icosphere(1);
  const geo = {
    groundV: buf(G.vert, S.VERTEX), groundI: buf(G.index, S.INDEX), groundN: G.index.length,
    wallV: buf(W.vert, S.VERTEX), wallI: buf(W.index, S.INDEX), wallN: W.index.length,
    bubV: buf(SB.pos, S.VERTEX), bubI: buf(SB.index, S.INDEX), bubN: SB.index.length,
    seaI: buf(gridIndex(GN + 1), S.INDEX), seaN: GN * GN * 6,
    cauI: buf(gridIndex(GN), S.INDEX), cauN: (GN - 1) * (GN - 1) * 6,
  };
  const uniBuf = device.createBuffer({ size: UO.SIZE * 4, usage: S.UNIFORM | S.COPY_DST });
  const camBuf = device.createBuffer({ size: 192, usage: S.UNIFORM | S.COPY_DST });
  const sunBuf = device.createBuffer({ size: 192, usage: S.UNIFORM | S.COPY_DST });
  const instBuf = device.createBuffer({ size: Math.max(16, (spec.instFloats || 4) * 4), usage: S.STORAGE | S.COPY_DST });
  const bubBuf = device.createBuffer({ size: (spec.maxBubbles || 400) * 16, usage: S.STORAGE | S.COPY_DST });
  const waterTex = tex(GN, GN, 'rgba32float', T.TEXTURE_BINDING | T.COPY_DST);
  const foamTex = tex(GN, GN, 'r8unorm', T.TEXTURE_BINDING | T.COPY_DST);
  const shadowTex = tex(2048, 2048, 'depth32float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
  const causticTex = tex(768, 768, 'rgba16float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
  const dumF = tex(1, 1, 'rgba16float', T.TEXTURE_BINDING), dumD = tex(1, 1, 'depth32float', T.TEXTURE_BINDING), dumR = tex(1, 1, 'r32float', T.TEXTURE_BINDING);
  const linS = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
  const cmpS = device.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
  const g0 = device.createBindGroup({ layout: g0L, entries: [uniBuf, instBuf, bubBuf].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
  const gCam = device.createBindGroup({ layout: g1L, entries: [{ binding: 0, resource: { buffer: camBuf } }] });
  const gSun = device.createBindGroup({ layout: g1L, entries: [{ binding: 0, resource: { buffer: sunBuf } }] });
  const g2 = (sh, ca, sc, di, bk) => device.createBindGroup({ layout: g2L, entries: [waterTex, sh, ca, sc, di, bk].map((t, i) => ({ binding: i, resource: t.createView() })).concat([{ binding: 6, resource: linS }, { binding: 7, resource: cmpS }, { binding: 8, resource: foamTex.createView() }]) });
  const gPre = g2(dumD, dumF, dumF, dumF, dumR), gMain = g2(shadowTex, causticTex, dumF, dumF, dumR);

  // ----- size-dependent targets -----
  let Wd = 0, Ht = 0, colorMS, distMS, depthMS, sceneTex, distTex, finalTex, backTex, backDepth, gFront, gComp;
  function resize(w, h) {
    const max = device.limits.maxTextureDimension2D;
    w = Math.max(1, Math.min(max, w | 0)); h = Math.max(1, Math.min(max, h | 0));
    if (w === Wd && h === Ht) return;
    Wd = w; Ht = h; canvas.width = w; canvas.height = h;
    for (const t of [colorMS, distMS, depthMS, sceneTex, distTex, finalTex, backTex, backDepth]) t && t.destroy();
    const RB = T.RENDER_ATTACHMENT | T.TEXTURE_BINDING;
    colorMS = tex(w, h, 'rgba16float', T.RENDER_ATTACHMENT, MS); distMS = tex(w, h, 'rgba16float', T.RENDER_ATTACHMENT, MS);
    depthMS = tex(w, h, 'depth24plus', T.RENDER_ATTACHMENT, MS);
    sceneTex = tex(w, h, 'rgba16float', RB); distTex = tex(w, h, 'rgba16float', RB); finalTex = tex(w, h, 'rgba16float', RB);
    backTex = tex(w, h, 'r32float', RB); backDepth = tex(w, h, 'depth24plus', T.RENDER_ATTACHMENT);
    gFront = g2(shadowTex, causticTex, sceneTex, distTex, backTex);
    gComp = g2(shadowTex, causticTex, finalTex, distTex, backTex);
  }

  /** f: { U, cam, sun, water, foam? (Uint8Array N², 0..255), inst?, instFloats?, bubbles, nBubbles, ...whatever the layers' count() read } */
  function render(f) {
    const q = device.queue;
    q.writeBuffer(uniBuf, 0, f.U); q.writeBuffer(camBuf, 0, f.cam); q.writeBuffer(sunBuf, 0, f.sun);
    if (f.inst && f.instFloats) q.writeBuffer(instBuf, 0, f.inst, 0, f.instFloats);
    if (f.nBubbles) q.writeBuffer(bubBuf, 0, f.bubbles, 0, f.nBubbles * 4);
    q.writeTexture({ texture: waterTex }, f.water, { bytesPerRow: GN * 16 }, [GN, GN]);
    if (f.foam) q.writeTexture({ texture: foamTex }, f.foam, { bytesPerRow: GN }, [GN, GN]);
    const enc = device.createCommandEncoder();
    const groups = (p, view, g) => { p.setBindGroup(0, g0); p.setBindGroup(1, view); p.setBindGroup(2, g); };
    const drawGround = (p) => { p.setVertexBuffer(0, geo.groundV); p.setIndexBuffer(geo.groundI, 'uint32'); p.drawIndexed(geo.groundN); };
    const drawLayer = (p, L, pipe) => {
      const n = L.count ? L.count(f) : 1;
      if (!n) return;
      p.setPipeline(pipe); if (L.g3) p.setBindGroup(3, L.g3);
      p.setVertexBuffer(0, L.vb); p.setIndexBuffer(L.ib, 'uint32'); p.drawIndexed(L.n, n);
    };
    const drawSea = (p, sea, wall) => {
      p.setPipeline(sea); p.setIndexBuffer(geo.seaI, 'uint32'); p.drawIndexed(geo.seaN);
      p.setPipeline(wall); p.setVertexBuffer(0, geo.wallV); p.setIndexBuffer(geo.wallI, 'uint32'); p.drawIndexed(geo.wallN);
    };
    // 1. sun shadow map
    let p = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: shadowTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    groups(p, gSun, gPre);
    p.setPipeline(P.shGround); drawGround(p);
    for (const L of layers) if (L.shadowPipe) drawLayer(p, L, L.shadowPipe);
    p.end();
    // 2. caustics
    p = enc.beginRenderPass({ colorAttachments: [{ view: causticTex.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
    groups(p, gCam, gPre);
    p.setPipeline(P.caustic); p.setIndexBuffer(geo.cauI, 'uint32'); p.drawIndexed(geo.cauN);
    p.end();
    // 3. opaque: studio, ground and strata, the specimen's layers, bubbles (colour + linear distance)
    p = enc.beginRenderPass({
      colorAttachments: [
        { view: colorMS.createView(), resolveTarget: sceneTex.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'discard' },
        { view: distMS.createView(), resolveTarget: distTex.createView(), clearValue: { r: 1e4, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'discard' }],
      depthStencilAttachment: { view: depthMS.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    groups(p, gCam, gMain);
    p.setPipeline(P.bg); p.draw(3);
    p.setPipeline(P.ground); drawGround(p);
    for (const L of layers) drawLayer(p, L, L.pipe);
    if (f.nBubbles) { p.setPipeline(P.bubble); p.setVertexBuffer(0, geo.bubV); p.setIndexBuffer(geo.bubI, 'uint32'); p.drawIndexed(geo.bubN, f.nBubbles); }
    p.end();
    // 4. the sea's back faces -> distance
    p = enc.beginRenderPass({ colorAttachments: [{ view: backTex.createView(), clearValue: { r: 1e6, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: backDepth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
    groups(p, gCam, gMain);
    drawSea(p, P.backSea, P.backWall);
    p.end();
    // 5. the sea's front faces over a copy of the opaque scene
    p = enc.beginRenderPass({ colorAttachments: [{ view: colorMS.createView(), resolveTarget: finalTex.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'discard' }],
      depthStencilAttachment: { view: depthMS.createView(), depthLoadOp: 'load', depthStoreOp: 'discard' } });
    groups(p, gCam, gFront);
    p.setPipeline(P.copy); p.draw(3);
    drawSea(p, P.sea, P.wall);
    p.end();
    // 6. composite
    p = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    groups(p, gCam, gComp);
    p.setPipeline(P.composite); p.draw(3);
    p.end();
    q.submit([enc.finish()]);
  }
  return { device, resize, render, get size() { return [Wd, Ht]; } };
}
