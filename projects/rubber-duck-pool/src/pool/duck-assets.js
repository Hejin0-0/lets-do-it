// The ducks' runtime assets (public/ducks, made by npm run assets:ducks): the one mesh every design shares, and the
// designs' albedo atlases as one texture array, each with its mipmaps (scaled down by the browser, level by level).
// Fetched next to the page, so the build works under any path (the hub serves it from /p/rubber-duck-pool/).
import { DUCK_SHAPE } from './duck-shape.js';
import { DESIGNS } from './ducks.js';

const SIZE = 512;

/** device -> { vert: Float32Array (position, normal, uv, kind), index: Uint32Array, texture: GPUTexture (2d-array) } */
export async function loadDuckAssets(device) {
  const at = (name) => new URL(`ducks/${name}`, document.baseURI);
  const get = async (name) => { const r = await fetch(at(name)); if (!r.ok) throw new Error(`ducks/${name}: ${r.status}`); return r; };
  const bin = await (await get('duck.bin')).arrayBuffer(), nv = DUCK_SHAPE.vertices * 9;
  if (bin.byteLength !== (nv + DUCK_SHAPE.indices) * 4) throw new Error('ducks/duck.bin does not match duck-shape.js: run npm run assets:ducks');
  const levels = Math.log2(SIZE) + 1;
  const texture = device.createTexture({ size: [SIZE, SIZE, DESIGNS.length], format: 'rgba8unorm-srgb', mipLevelCount: levels,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  await Promise.all(DESIGNS.map(async (d, layer) => {
    const blob = await (await get(`${d.id}.webp`)).blob();
    for (let l = 0; l < levels; l++) {
      const s = SIZE >> l, bmp = await createImageBitmap(blob, { resizeWidth: s, resizeHeight: s, resizeQuality: 'high', colorSpaceConversion: 'none' });
      device.queue.copyExternalImageToTexture({ source: bmp }, { texture, mipLevel: l, origin: [0, 0, layer] }, [s, s]);
      bmp.close();
    }
  }));
  return { vert: new Float32Array(bin, 0, nv), index: new Uint32Array(bin, nv * 4, DUCK_SHAPE.indices), texture };
}
