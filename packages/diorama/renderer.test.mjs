import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDioramaRenderer, UO } from './renderer.js';

globalThis.GPUBufferUsage ??= { VERTEX: 1, INDEX: 2, UNIFORM: 4, STORAGE: 8, COPY_DST: 16 };
globalThis.GPUTextureUsage ??= { COPY_DST: 1, TEXTURE_BINDING: 2, RENDER_ATTACHMENT: 4 };
globalThis.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2 };

function makeStubGPU() {
  let nextId = 1, texViews = 0, swapViews = 0, passes = [];
  const pipelines = [];
  const noop = () => {};
  const device = {
    limits: { maxTextureDimension2D: 8192 },
    pushErrorScope: noop,
    popErrorScope: async () => null,
    createShaderModule: () => ({ getCompilationInfo: async () => ({ messages: [] }) }),
    createBuffer: (desc) => ({ ...desc, destroy: noop }),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createRenderPipeline: (desc) => { pipelines.push(desc); return {}; },
    createSampler: () => ({}),
    createBindGroup: (desc) => ({ desc }),
    createTexture(desc) {
      const texId = nextId++;
      return {
        texId,
        mipLevelCount: desc.mipLevelCount || 1,
        destroy: noop,
        createView(viewDesc) {
          texViews++;
          return { viewId: nextId++, texId, viewDesc };
        },
      };
    },
    queue: { writeBuffer: noop, writeTexture: noop, submit: noop },
    createCommandEncoder: () => ({
      beginRenderPass(desc) {
        passes.push(desc);
        return {
          setBindGroup: noop, setPipeline: noop, setVertexBuffer: noop,
          setIndexBuffer: noop, setBlendConstant: noop, draw: noop, drawIndexed: noop, end: noop,
        };
      },
      finish: () => ({}),
    }),
  };
  const context = {
    getCurrentTexture: () => ({
      createView() {
        swapViews++;
        return { viewId: nextId++, swapchain: true };
      },
    }),
  };
  const counts = () => ({ texViews, swapViews, total: texViews + swapViews });
  const reset = () => { texViews = 0; swapViews = 0; passes = []; };
  return { gpu: { device, context, format: 'bgra8unorm' }, counts, reset, pipelines, get passes() { return passes; } };
}

function makeFrame(N, withPost) {
  return {
    U: new Float32Array(UO.SIZE),
    cam: new Float32Array(48),
    sun: new Float32Array(48),
    water: new Float32Array(N * N * 4),
    nBubbles: 0,
    post: withPost ? { ao: 1, dof: 1 } : undefined,
  };
}

const passViews = (passes) => passes.flatMap((p) => [
  ...(p.colorAttachments || []).flatMap((a) => [a.view, a.resolveTarget].filter(Boolean)),
  ...(p.depthStencilAttachment ? [p.depthStencilAttachment.view] : []),
]);

test('render makes only the swapchain view per frame and remakes target views on resize', async () => {
  for (const withPost of [true, false]) {
    const stub = makeStubGPU(), N = 4;
    const renderer = await createDioramaRenderer(stub.gpu, { width: 0, height: 0 }, {
      N,
      half: 1,
      terrainH: () => 0,
      terrainNormal: (_x, _z, out) => { out[0] = 0; out[1] = 1; out[2] = 0; },
      wgsl: '',
      post: withPost ? { quality: 'high' } : undefined,
    });
    renderer.resize(320, 180);

    const frame = makeFrame(N, withPost);
    const frameViews = [];
    for (let i = 0; i < 3; i++) {
      stub.reset();
      renderer.render(frame);
      assert.deepEqual(stub.counts(), { texViews: 0, swapViews: 1, total: 1 });
      frameViews.push(passViews(stub.passes));
    }
    // Same non-swapchain views reused across all three frames.
    assert.deepEqual(frameViews[1].slice(0, -1), frameViews[0].slice(0, -1));
    assert.deepEqual(frameViews[2].slice(0, -1), frameViews[0].slice(0, -1));

    stub.reset();
    renderer.resize(640, 360);
    assert.ok(stub.counts().texViews > 0, 'resize remakes texture views');

    stub.reset();
    renderer.render(frame);
    assert.deepEqual(stub.counts(), { texViews: 0, swapViews: 1, total: 1 });
    const afterResize = passViews(stub.passes);
    // Fixed targets (shadow, caustic: indices 0, 1) stay the same; resized targets (indices 2..-2) are new.
    assert.equal(afterResize[0], frameViews[0][0]);
    assert.equal(afterResize[1], frameViews[0][1]);
    for (let k = 2; k < afterResize.length - 1; k++) {
      assert.notEqual(afterResize[k], frameViews[0][k], `pass view ${k} should be remade on resize`);
    }
  }
});

test('a layer casts into the sun map through its shadowFs, so it can let light through; without one it casts solid', async () => {
  const stub = makeStubGPU(), N = 4, tri = { vert: new Float32Array(9), index: new Uint32Array([0, 1, 2]) };
  await createDioramaRenderer(stub.gpu, { width: 0, height: 0 }, {
    N, half: 1, terrainH: () => 0, terrainNormal: (_x, _z, out) => { out[0] = 0; out[1] = 1; out[2] = 0; }, wgsl: '',
    layers: [{ vs: 'vsGlass', fs: 'fsGlass', shadowFs: 'fsGlassShadow', shadow: true, ...tri }, { vs: 'vsSolid', fs: 'fsSolid', shadow: true, ...tri }],
  });
  const shadowPipe = (vs) => stub.pipelines.find((d) => d.vertex.entryPoint === vs && d.depthStencil?.format === 'depth32float');
  assert.equal(shadowPipe('vsGlass').fragment?.entryPoint, 'fsGlassShadow');
  assert.deepEqual(shadowPipe('vsGlass').fragment.targets, [], 'the sun map has no colour target');
  assert.equal(shadowPipe('vsSolid').fragment, undefined);
});
