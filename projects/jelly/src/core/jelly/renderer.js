// The renderer every skinned-tetrahedron jelly shares. Per frame: node positions in; on the GPU the
// embedded points are skinned into the tets and the surface normals rebuilt; then a top-down height
// map and a key-light map, the studio and floor (its soft shadow tinted by the gel), the jelly's back
// faces (thickness) and its front faces over a copy of the scene, the lattice overlay on request.
//
// A specimen brings its material (WGSL) and its look; props, seeds or membranes come in as plugins
// that draw into the map, scene and final passes.
import { M4, srgbToLinear, backdropRadiance } from '../math.js';
import { shaderModule, validated, bufferWith } from '../gpu.js';
import { SKIN, GRADIENT_SKIN, FRAME, STUDIO, PASSES } from './wgsl.js';

/** Float offsets of the frame uniforms, mirrored by FRAME in wgsl.js. */
export const UO = { VP: 0, INV: 16, EYE: 32, RIGHT: 36, UP: 40, SCREEN: 44, SHADOW: 48, ABSORB: 52, SCATTER: 56, PAL: 60, VIEW: 76, BASE: 80, LIGHT: 84, PROP_A: 100, PROP_B: 116, PRM: 132, BASES: 140, SIZE: 144 };
const MS = 4;
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Swap whole functions or constants of the shared studio and passes (by name) for a specimen's own. */
function replaceShared(chunks, items = {}) {
  for (const [name, code] of Object.entries(items)) {
    const k = chunks.findIndex((c) => c.includes(`fn ${name}(`) || c.includes(`const ${name} =`));
    if (k < 0) throw new Error(`WGSL replace: no fn or const ${name}`);
    const src = chunks[k], isFn = src.includes(`fn ${name}(`), at = src.indexOf(isFn ? `fn ${name}(` : `const ${name} =`);
    const i = src.lastIndexOf('\n', at) + 1;   // from the start of its line: the replacement brings its own attributes
    let j = at;
    if (isFn) { j = src.indexOf('{', at); for (let depth = 0; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; } }
    else j = src.indexOf(';', at);
    chunks[k] = src.slice(0, i) + code.trim() + src.slice(j + 1);
  }
  return chunks;
}

/**
 * @param gpu   { device, context, format } (device is the specimen's resource scope)
 * @param spec  { paper, helpers?: WGSL, material: WGSL (fsJelly, clarityAt), meshAlpha?, shadowRadius?, passes?: WGSL,
 *                skin?: 'ring' | 'gradient' (meshes then also carry tets, restX, restN: see GRADIENT_SKIN),
 *                key?: [x, y, z] (the key light, when replace.KEY moves it),
 *                replace?: { name: WGSL } (a specimen's own version of a shared function or constant),
 *                plugins?: [(ctx) => { maps?(pass, kind), scene?(pass), final?(pass), setMeshes?(m), frame?(U) }] }
 */
export async function createJellyRenderer(gpu, canvas, spec) {
  const { device, context, format } = gpu;
  const S = GPUBufferUsage, T = GPUTextureUsage;
  const tex = (w, h, fmt, usage, sampleCount = 1) => device.createTexture({ size: [w, h], format: fmt, usage, sampleCount });

  const gradient = spec.skin === 'gradient', KEY = spec.key || [-0.5463, 0.7747, 0.3184];   // the key light (WGSL KEY)
  const skinMod = await shaderModule(device, 'skin', gradient ? GRADIENT_SKIN : SKIN);
  const [studio, passes] = replaceShared([STUDIO, PASSES], spec.replace);
  const renderMod = await shaderModule(device, 'render', FRAME + studio + (spec.helpers || '') + spec.material + passes + (spec.passes || ''));

  // ----- layouts -----
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, CS = GPUShaderStage.COMPUTE, FS = GPUShaderStage.FRAGMENT;
  const ro = (b, vis) => ({ binding: b, visibility: vis, buffer: { type: 'read-only-storage' } });
  const rw = (b) => ({ binding: b, visibility: CS, buffer: { type: 'storage' } });
  const computeBGL = device.createBindGroupLayout({ entries: [ro(0, CS), ro(1, CS), rw(2), ro(3, CS), ro(4, CS), ro(5, CS), rw(6), rw(7), { binding: 8, visibility: CS, buffer: { type: 'uniform' } }] });
  const frameBGL = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: VF, buffer: { type: 'uniform' } }, ro(1, VF), ro(2, VF), ro(3, VF), ro(4, VF), ro(5, VF)] });
  const texBGL = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: FS, texture: { sampleType: 'float' } },
    { binding: 1, visibility: FS, texture: { sampleType: 'float' } },
    { binding: 2, visibility: FS, sampler: { type: 'filtering' } }] });
  const computePL = device.createPipelineLayout({ bindGroupLayouts: [computeBGL] });
  const renderPL = device.createPipelineLayout({ bindGroupLayouts: [frameBGL, texBGL] });

  // ----- pipelines -----
  const depth = (write, compare = 'less') => ({ format: 'depth24plus', depthWriteEnabled: write, depthCompare: compare });
  const rp = (o) => device.createRenderPipeline({
    layout: renderPL,
    vertex: { module: renderMod, entryPoint: o.vs, buffers: o.buffers || [] },
    fragment: { module: renderMod, entryPoint: o.fs, targets: [o.target] },
    primitive: { topology: o.topology || 'triangle-list', cullMode: o.cull || 'none' },
    depthStencil: o.depth,
    multisample: { count: o.ms ? MS : 1 },
  });
  const minMax = { format: 'rgba16float', blend: { color: { operation: 'min', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' } } };
  const sceneT = { format: 'rgba16float' };
  const overRGB = { format: 'rgba16float', writeMask: GPUColorWrite.RED | GPUColorWrite.GREEN | GPUColorWrite.BLUE,
    blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } };
  const targets = { minMax, sceneT, overRGB, final: { format } };
  const comp = (entryPoint) => device.createComputePipeline({ layout: gradient ? 'auto' : computePL, compute: { module: skinMod, entryPoint } });

  const U = new Float32Array(UO.SIZE);
  const uniBuf = device.createBuffer({ size: U.byteLength, usage: S.UNIFORM | S.COPY_DST });
  const countBuf = device.createBuffer({ size: 16, usage: S.UNIFORM | S.COPY_DST });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

  const { P, cp, plugins } = await validated(device, () => {
    const P = {
      heightJelly: rp({ vs: 'vsHeight', fs: 'fsMap', target: minMax }),
      lightJelly: rp({ vs: 'vsLight', fs: 'fsMap', target: minMax }),
      bg: rp({ vs: 'vsFull', fs: 'fsBG', target: sceneT, depth: depth(false, 'always'), ms: true }),
      bubble: rp({ vs: 'vsBubble', fs: 'fsBubble', target: overRGB, depth: depth(false), ms: true }),
      back: rp({ vs: 'vsJelly', fs: 'fsBack', target: { format: 'r16float' }, depth: depth(true), cull: 'front' }),
      comp: rp({ vs: 'vsFull', fs: 'fsComp', target: { format }, depth: depth(false, 'always'), ms: true }),
      jelly: rp({ vs: 'vsJelly', fs: 'fsJelly', target: { format }, depth: depth(true), cull: 'back', ms: true }),
      wire: rp({ vs: 'vsWire', fs: 'fsWire', target: { format, blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }, depth: depth(false, 'always'), topology: 'line-list', ms: true }),
    };
    const ctx = { device, rp, depth, targets, U, bufferWith: (d, u) => bufferWith(device, d, u) };
    const cp = gradient ? { grad: comp('nodeGrad'), skin: comp('skin') } : { skin: comp('skin'), normals: comp('normals'), smoothA: comp('smoothA'), smoothB: comp('smoothB') };
    return { P, cp, plugins: (spec.plugins || []).map((f) => f(ctx)) };
  });

  // ----- static resources -----
  const dummyA = tex(1, 1, 'rgba16float', T.TEXTURE_BINDING), dummyB = tex(1, 1, 'r16float', T.TEXTURE_BINDING);
  const texBG = (a, b) => device.createBindGroup({ layout: texBGL, entries: [{ binding: 0, resource: a.createView() }, { binding: 1, resource: b.createView() }, { binding: 2, resource: sampler }] });
  const HM = 512, LM = 1024;
  const heightTex = tex(HM, HM, 'rgba16float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
  const lightTex = tex(LM, LM, 'rgba16float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
  const heightView = heightTex.createView(), lightView = lightTex.createView();
  const bgDummy = texBG(dummyA, dummyB), bgMaps = texBG(heightTex, lightTex);
  U.set(backdropRadiance(spec.paper), UO.BASE);

  // ----- the meshes, rebuilt only when the pieces change -----
  /** m: { n, np, nv, emb: { idx, w }, index, adjacency: { offsets, triangles }, rest, edges, inst?, bubbleBase, bubbleCount,
   *       seedBase?, seedCount? } and, to skin by gradient, { tets, restX, restN } */
  let M = null;
  const group = (layout, bufs) => device.createBindGroup({ layout, entries: bufs.map(([binding, buffer]) => ({ binding, resource: { buffer } })) });
  /** Ring: skin the points, face normals of the deformed surface, smoothed over the one-ring twice. */
  function ringSkin(m, B) {
    const tmpBuf = device.createBuffer({ size: m.nv * 16, usage: S.STORAGE });
    const adjOffBuf = bufferWith(device, m.adjacency.offsets, S.STORAGE), adjTriBuf = bufferWith(device, m.adjacency.triangles, S.STORAGE);
    device.queue.writeBuffer(countBuf, 0, new Uint32Array([m.np, m.nv, 0, 0]));
    const bg = group(computeBGL, [B.nodeBuf, B.embBuf, B.posBuf, B.triBuf, adjOffBuf, adjTriBuf, B.nrmBuf, tmpBuf, countBuf].map((b, i) => [i, b]));
    const dispatch = (pass) => {
      pass.setBindGroup(0, bg);
      pass.setPipeline(cp.skin); pass.dispatchWorkgroups(Math.ceil(m.np / 64));
      for (const pl of [cp.normals, cp.smoothA, cp.smoothB]) { pass.setPipeline(pl); pass.dispatchWorkgroups(Math.ceil(m.nv / 64)); }
    };
    return { dispatch, owned: [tmpBuf, adjOffBuf, adjTriBuf] };
  }
  /** Gradient: each node's average deformation gradient, then points with rest normals carried by cof(F). */
  function gradientSkin(m, B) {
    const n = m.n, T4 = m.tets, nt = T4.length / 4, X = m.restX;
    const dm = new Float32Array(12 * nt);   // inverse rest edge matrix per tet, stored by columns
    for (let t = 0; t < nt; t++) {
      const a = 3 * T4[4 * t], b = 3 * T4[4 * t + 1], c = 3 * T4[4 * t + 2], d = 3 * T4[4 * t + 3];
      const e1 = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]], e2 = [X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2]], e3 = [X[d] - X[a], X[d + 1] - X[a + 1], X[d + 2] - X[a + 2]];
      // rows of the inverse of [e1 e2 e3] are (e2 x e3, e3 x e1, e1 x e2) / det
      const r0 = cross3(e2, e3), r1 = cross3(e3, e1), r2 = cross3(e1, e2), det = e1[0] * r0[0] + e1[1] * r0[1] + e1[2] * r0[2], id = det ? 1 / det : 0;
      for (let k = 0; k < 3; k++) dm.set([r0[k] * id, r1[k] * id, r2[k] * id, 0], 12 * t + 4 * k);
    }
    const off = new Uint32Array(n + 1);   // node -> its tets (CSR)
    for (let k = 0; k < 4 * nt; k++) off[T4[k] + 1]++;
    for (let i = 0; i < n; i++) off[i + 1] += off[i];
    const list = new Uint32Array(4 * nt), fill = off.slice(0, n);
    for (let t = 0; t < nt; t++) for (let k = 0; k < 4; k++) list[fill[T4[4 * t + k]]++] = t;
    const tetBuf = bufferWith(device, Uint32Array.from(T4), S.STORAGE), dmBuf = bufferWith(device, dm, S.STORAGE);
    const offBuf = bufferWith(device, off, S.STORAGE), listBuf = bufferWith(device, list, S.STORAGE);
    const nodeFBuf = device.createBuffer({ size: n * 48, usage: S.STORAGE }), restNBuf = bufferWith(device, m.restN, S.STORAGE);
    device.queue.writeBuffer(countBuf, 0, new Uint32Array([n, m.np, 0, 0]));
    const bgGrad = group(cp.grad.getBindGroupLayout(0), [[0, B.nodeBuf], [1, tetBuf], [2, dmBuf], [3, offBuf], [4, listBuf], [5, nodeFBuf], [10, countBuf]]);
    const bgSkin = group(cp.skin.getBindGroupLayout(0), [[0, B.nodeBuf], [5, nodeFBuf], [6, B.embBuf], [7, restNBuf], [8, B.posBuf], [9, B.nrmBuf], [10, countBuf]]);
    const dispatch = (pass) => {
      pass.setPipeline(cp.grad); pass.setBindGroup(0, bgGrad); pass.dispatchWorkgroups(Math.ceil(n / 64));
      pass.setPipeline(cp.skin); pass.setBindGroup(0, bgSkin); pass.dispatchWorkgroups(Math.ceil(m.np / 64));
    };
    return { dispatch, owned: [tetBuf, dmBuf, offBuf, listBuf, nodeFBuf, restNBuf] };
  }
  function setMeshes(m) {
    if (M) for (const b of M.owned) b.destroy();
    const np = m.np;
    const embAB = new ArrayBuffer(np * 32), embU = new Uint32Array(embAB), embF = new Float32Array(embAB);
    for (let p = 0; p < np; p++) for (let k = 0; k < 4; k++) { embU[8 * p + k] = m.emb.idx[4 * p + k]; embF[8 * p + 4 + k] = m.emb.w[4 * p + k]; }
    const B = {
      nodeBuf: device.createBuffer({ size: m.n * 16, usage: S.STORAGE | S.COPY_DST }),
      embBuf: bufferWith(device, embF, S.STORAGE),
      posBuf: device.createBuffer({ size: np * 16, usage: S.STORAGE }),
      nrmBuf: device.createBuffer({ size: (gradient ? np : m.nv) * 16, usage: S.STORAGE }),
      triBuf: bufferWith(device, m.index, S.STORAGE | S.INDEX),
    };
    const restBuf = bufferWith(device, m.rest, S.STORAGE);
    const instBuf = bufferWith(device, m.inst && m.inst.length ? m.inst : new Float32Array(4), S.STORAGE);
    const edgeBuf = bufferWith(device, m.edges, S.INDEX);
    const sk = (gradient ? gradientSkin : ringSkin)(m, B);
    const bgFrame = device.createBindGroup({ layout: frameBGL, entries: [uniBuf, B.posBuf, B.nrmBuf, restBuf, B.nodeBuf, instBuf].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    M = { n: m.n, np, nv: m.nv, indexCount: m.index.length, bubbleCount: m.bubbleCount, edgeCount: m.edges.length,
      nodeBuf: B.nodeBuf, triBuf: B.triBuf, edgeBuf, skin: sk.dispatch, bgFrame, owned: [...Object.values(B), restBuf, instBuf, edgeBuf, ...sk.owned] };
    U[UO.BASES] = m.bubbleBase; U[UO.BASES + 1] = m.bubbleCount; U[UO.BASES + 2] = m.seedBase || 0; U[UO.BASES + 3] = m.seedCount || 0;
    for (const pl of plugins) pl.setMeshes?.(m);
  }

  // ----- size-dependent targets -----
  let W = 0, H = 0, sceneMS, sceneTex, depthMS, backTex, backDepth, finalMS, bgScene, bgJelly, V = null;   // V: their views, made once per size
  function resize(w, h) {
    const max = device.limits.maxTextureDimension2D;
    w = Math.max(1, Math.min(max, w)); h = Math.max(1, Math.min(max, h));
    if (w === W && h === H) return;
    W = w; H = h; canvas.width = w; canvas.height = h;
    for (const t of [sceneMS, sceneTex, depthMS, backTex, backDepth, finalMS]) t && t.destroy();
    sceneMS = tex(w, h, 'rgba16float', T.RENDER_ATTACHMENT, MS);
    sceneTex = tex(w, h, 'rgba16float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
    depthMS = tex(w, h, 'depth24plus', T.RENDER_ATTACHMENT, MS);
    backTex = tex(w, h, 'r16float', T.RENDER_ATTACHMENT | T.TEXTURE_BINDING);
    backDepth = tex(w, h, 'depth24plus', T.RENDER_ATTACHMENT);
    finalMS = tex(w, h, format, T.RENDER_ATTACHMENT, MS);
    bgScene = texBG(sceneTex, dummyB); bgJelly = texBG(sceneTex, backTex);
    V = { sceneMS: sceneMS.createView(), sceneTex: sceneTex.createView(), depthMS: depthMS.createView(), backTex: backTex.createView(), backDepth: backDepth.createView(), finalMS: finalMS.createView() };
    U[UO.SCREEN] = W; U[UO.SCREEN + 1] = H; U[UO.SCREEN + 2] = 1 / W; U[UO.SCREEN + 3] = 1 / H;
  }

  // ----- camera and look -----
  const look = { vp: new Float32Array(16), inv: new Float32Array(16), eye: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0] };
  const proj = new Float32Array(16);
  /** c: { yaw, pitch, dist, fov, target: [x,y,z], shift: [sx, sy] } */
  function setCamera(c) {
    const cp = Math.cos(c.pitch), eye = [c.target[0] + c.dist * cp * Math.sin(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * cp * Math.cos(c.yaw)];
    const L = M4.lookAt(eye, c.target, [0, 1, 0]);
    M4.persp(c.fov, W / H, 0.1, 80, proj);
    proj[8] -= c.shift[0]; proj[9] -= c.shift[1];   // lens shift: frame the specimen in the free area of the layout
    M4.mul(proj, L.m, look.vp); M4.inv(look.vp, look.inv);
    look.eye = eye; look.fwd = L.z.map((v) => -v); look.right = L.x; look.up = L.y;
    U.set(look.vp, UO.VP); U.set(look.inv, UO.INV); U.set(eye, UO.EYE); U.set(L.x, UO.RIGHT); U.set(L.y, UO.UP);
  }
  const vec4 = (o, a, w) => { U[o] = a[0]; U[o + 1] = a[1]; U[o + 2] = a[2]; U[o + 3] = w; };
  const linear = new Map();   // palette hex -> linear rgb, parsed once
  const lin = (hex) => { let c = linear.get(hex); if (!c) linear.set(hex, (c = srgbToLinear(hex))); return c; };
  // the key light's map: an orthographic view along KEY, its right (r) and up (u) axes fixed
  const kr = Math.hypot(KEY[2], KEY[0]), LR = [KEY[2] / kr, 0, -KEY[0] / kr];
  const LU = [KEY[1] * LR[2] - KEY[2] * LR[1], KEY[2] * LR[0] - KEY[0] * LR[2], KEY[0] * LR[1] - KEY[1] * LR[0]];
  /**
   * o: { time, showMesh, absorb: [r,g,b], density?, scatter: [r,g,b], palette: ['#hex', ...] (up to 4),
   *      prm?: [[4], [4]], shadow?: [cx, cz, half, radius], light?: { centre: [x,y,z], half } }
   * The shadow window and the key-light map follow the specimen's centre unless given.
   */
  function setLook(o) {
    U[UO.EYE + 3] = o.time; U[UO.BASE + 3] = o.time;
    const c = o.centre;
    if (o.shadow) U.set(o.shadow, UO.SHADOW);
    else { U[UO.SHADOW] = c[0]; U[UO.SHADOW + 1] = c[2]; U[UO.SHADOW + 2] = 2.6; U[UO.SHADOW + 3] = spec.shadowRadius ?? 2.9; }
    vec4(UO.ABSORB, o.absorb, o.density ?? 1);
    vec4(UO.SCATTER, o.scatter, 1);
    for (let k = 0; k < o.palette.length; k++) vec4(UO.PAL + 4 * k, lin(o.palette[k]), 1);
    U[UO.VIEW] = 1; U[UO.VIEW + 1] = o.showMesh ? (spec.meshAlpha ?? 0.4) : 0;
    if (o.prm) for (let k = 0; k < o.prm.length; k++) U.set(o.prm[k], UO.PRM + 4 * k);
    // orthographic projection along the key light, centred on the specimen (column-major)
    const lc = o.light?.centre || c, hs = o.light?.half || 3.0, L = UO.LIGHT;
    U.fill(0, L, L + 16);
    for (let k = 0; k < 3; k++) { U[L + 4 * k] = LR[k] / hs; U[L + 4 * k + 1] = LU[k] / hs; }
    U[L + 12] = -(lc[0] * LR[0] + lc[1] * LR[1] + lc[2] * LR[2]) / hs; U[L + 13] = -(lc[0] * LU[0] + lc[1] * LU[1] + lc[2] * LU[2]) / hs;
    U[L + 14] = 0.5; U[L + 15] = 1;
  }
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

  const MAP_CLEAR = { r: 1e4, g: 1, b: 0, a: -1e4 }, SCENE_CLEAR = { r: 0.8, g: 0.8, b: 0.8, a: 1e4 }, BACK_CLEAR = { r: 1e4, g: 0, b: 0, a: 1 }, BLACK = { r: 0, g: 0, b: 0, a: 1 };
  function render(nodes, showMesh) {
    device.queue.writeBuffer(M.nodeBuf, 0, nodes, 0, M.n * 4);
    for (const pl of plugins) pl.frame?.(U);
    device.queue.writeBuffer(uniBuf, 0, U);
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    M.skin(pass);
    pass.end();
    const col = (view, clearValue, load, resolveTarget) => ({ view, resolveTarget, clearValue, loadOp: load ? 'load' : 'clear', storeOp: 'store' });
    const dep = (view, load) => ({ view, depthClearValue: 1, depthLoadOp: load ? 'load' : 'clear', depthStoreOp: 'store' });
    const map = (view, jellyPipe, kind) => {
      const p = enc.beginRenderPass({ colorAttachments: [col(view, MAP_CLEAR)] });
      p.setBindGroup(0, M.bgFrame); p.setBindGroup(1, bgDummy);
      p.setPipeline(jellyPipe); p.setIndexBuffer(M.triBuf, 'uint32'); p.drawIndexed(M.indexCount);
      for (const pl of plugins) pl.maps?.(p, kind);
      p.end();
    };
    map(heightView, P.heightJelly, 'height');
    map(lightView, P.lightJelly, 'light');

    let p = enc.beginRenderPass({ colorAttachments: [col(V.sceneMS, SCENE_CLEAR, false, V.sceneTex)], depthStencilAttachment: dep(V.depthMS) });
    p.setBindGroup(0, M.bgFrame); p.setBindGroup(1, bgMaps);
    p.setPipeline(P.bg); p.draw(3);
    for (const pl of plugins) pl.scene?.(p);
    if (M.bubbleCount) { p.setPipeline(P.bubble); p.draw(6, M.bubbleCount); }
    p.end();

    p = enc.beginRenderPass({ colorAttachments: [col(V.backTex, BACK_CLEAR)], depthStencilAttachment: dep(V.backDepth) });
    p.setPipeline(P.back); p.setBindGroup(0, M.bgFrame); p.setBindGroup(1, bgDummy);
    p.setIndexBuffer(M.triBuf, 'uint32'); p.drawIndexed(M.indexCount); p.end();

    p = enc.beginRenderPass({ colorAttachments: [col(V.finalMS, BLACK, false, context.getCurrentTexture().createView())], depthStencilAttachment: dep(V.depthMS, true) });
    p.setBindGroup(0, M.bgFrame);
    p.setPipeline(P.comp); p.setBindGroup(1, bgScene); p.draw(3);
    p.setPipeline(P.jelly); p.setBindGroup(1, bgJelly); p.setIndexBuffer(M.triBuf, 'uint32'); p.drawIndexed(M.indexCount);
    for (const pl of plugins) pl.final?.(p);
    if (showMesh) { p.setPipeline(P.wire); p.setIndexBuffer(M.edgeBuf, 'uint32'); p.drawIndexed(M.edgeCount); }
    p.end();
    device.queue.submit([enc.finish()]);
  }

  return { device, U, setMeshes, resize, setCamera, setLook, ray, project, render, look, get size() { return [W, H]; } };
}
