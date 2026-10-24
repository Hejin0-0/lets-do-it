// The one WebGPU device and canvas context every specimen shares, plus a resource scope so a
// specimen can give back everything it allocated when it is unmounted.

/** Errors carry a code the page explains: no-webgpu, no-adapter, shader, pipeline, lost. */
export const gpuError = (code, message) => Object.assign(new Error(message), { code });

/** Acquire an adapter and device and configure the canvas. Throws a coded error when WebGPU is missing. */
export async function acquireGPU(canvas) {
  if (!navigator.gpu) throw gpuError('no-webgpu', 'This browser does not expose navigator.gpu.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw gpuError('no-adapter', 'The browser exposes WebGPU but provided no GPU adapter (blocklisted GPU, disabled flag, or a headless context).');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  return { device, context, format };
}

/**
 * A view of `device` that remembers every buffer and texture created through it, so `release()`
 * frees a specimen's GPU memory at once. A resource destroyed early (a rebuilt mesh) leaves the set.
 */
export function resourceScope(device) {
  const owned = new Set();
  const track = (r) => {
    const destroy = r.destroy.bind(r);
    r.destroy = () => { owned.delete(r); destroy(); };
    owned.add(r);
    return r;
  };
  return new Proxy(device, {
    get(target, key) {
      if (key === 'createBuffer') return (d) => track(target.createBuffer(d));
      if (key === 'createTexture') return (d) => track(target.createTexture(d));
      if (key === 'release') return () => { for (const r of [...owned]) r.destroy(); };
      if (key === 'ownedCount') return owned.size;
      const v = Reflect.get(target, key);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

/** Compile WGSL and surface its errors with line numbers. */
export async function shaderModule(device, name, code) {
  const module = device.createShaderModule({ label: name, code });
  const errs = (await module.getCompilationInfo()).messages.filter((m) => m.type === 'error');
  if (errs.length) throw gpuError('shader', `WGSL (${name}):\n` + errs.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n'));
  return module;
}

/** Run `build` inside a validation error scope; a rejected pipeline becomes a coded error. */
export async function validated(device, build) {
  device.pushErrorScope('validation');
  const out = await build();
  const err = await device.popErrorScope();
  if (err) throw gpuError('pipeline', 'Pipeline creation failed: ' + err.message);
  return out;
}

/** A buffer filled with `data` (size rounded up to 4 bytes, at least 16; an odd-length Uint16Array is padded). */
export function bufferWith(device, data, usage) {
  const size = Math.max(16, Math.ceil(data.byteLength / 4) * 4);
  const b = device.createBuffer({ size, usage: usage | GPUBufferUsage.COPY_DST });
  if (data.byteLength % 4) {
    const padded = new Uint8Array(Math.ceil(data.byteLength / 4) * 4);
    padded.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    device.queue.writeBuffer(b, 0, padded);
  } else device.queue.writeBuffer(b, 0, data);
  return b;
}
