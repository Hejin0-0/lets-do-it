import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShallowWater, terrainGrid, regionMap } from './water.js';

function refPack(W, out) {
  const { N, half, h, wet, T, levels, regions } = W;
  const i2 = 0.5 / ((2 * half) / N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i, o = 4 * c, hc = h[c], lv = levels[regions[c]];
    if (!wet[c]) { out[o] = lv; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = T[c]; continue; }
    const e = i < N - 1 && wet[c + 1] ? h[c + 1] : hc, ww = i > 0 && wet[c - 1] ? h[c - 1] : hc;
    const nn = j < N - 1 && wet[c + N] ? h[c + N] : hc, s = j > 0 && wet[c - N] ? h[c - N] : hc;
    out[o] = lv + hc; out[o + 1] = (e - ww) * i2; out[o + 2] = (nn - s) * i2; out[o + 3] = T[c];
  }
  return out;
}

function makePool() {
  const N = 10, half = 1;
  // Two basins separated by a dry ridge along x = 0, with sloped edges for wet/dry transitions.
  const terrainH = (x, z) => {
    const ridge = 0.7 * Math.exp(-(x * x) / 0.04);
    const bowl = 0.35 * (x * x + z * z);
    return 0.1 + ridge + bowl;
  };
  const T = terrainGrid(N, half, terrainH);
  const regions = regionMap(N, half, T, (x, _z, t) => (t >= 0.35 ? -1 : x < 0 ? 0 : 1));
  return createShallowWater({ N, half, terrain: T, regions, levels: [0.45, 0.3] });
}

const bits = (a) => new Uint32Array(a.buffer, a.byteOffset, a.length);

function spyBuffer(n) {
  const buf = new Float32Array(n * 4);
  const writes = new Set();
  const proxy = new Proxy(buf, {
    set(target, prop, value) {
      const idx = Number(prop);
      if (Number.isInteger(idx)) writes.add(idx);
      target[prop] = value;
      return true;
    },
  });
  return { buf, proxy, writes };
}

test('pack matches full loop bit-identically across steps, volume, setLevel, link, flat and fresh buffer', () => {
  const W = makePool();
  const n = W.N * W.N;
  assert.ok(W.wetCount > 0 && W.wetCount < n, 'pool has both wet and dry cells');

  const out = new Float32Array(n * 4);
  const ref = new Float32Array(n * 4);

  const checkSame = (label, target = out) => {
    W.pack(target);
    refPack(W, ref);
    assert.deepEqual(bits(target), bits(ref), label);
  };

  checkSame('initial pack');

  W.addVolume(-0.4, 0, 0.012, 0.25);
  W.addVolume(0.4, 0, -0.008, 0.25);
  checkSame('after addVolume');

  for (let s = 0; s < 5; s++) {
    W.step(1 / 60, 0.15, -0.2);
    checkSame(`after step ${s + 1}`);
  }

  // Raise body 0 so dry shoreline cells become wet.
  W.setLevel(0.62, 0);
  checkSame('after raising body 0');
  W.addVolume(-0.4, 0.1, 0.006, 0.2);
  for (let s = 0; s < 3; s++) {
    W.step(1 / 60, -0.1, 0.15);
    checkSame(`after raise step ${s + 1}`);
  }

  // Lower body 1 so wet cells become dry.
  W.setLevel(0.18, 1);
  checkSame('after lowering body 1');
  W.step(1 / 60, 0.05, 0.05);
  checkSame('after lower step');

  W.link(0, 1, true);
  W.step(1 / 60, 0.1, 0);
  checkSame('after link and step');

  W.flat();
  checkSame('after flat');

  const fresh = new Float32Array(n * 4).fill(999);
  checkSame('into a fresh buffer', fresh);
});

test('pack writes dry cells and terrain only on first pack, after setLevel, or into a different buffer', () => {
  const W = makePool();
  const n = W.N * W.N;
  const { proxy: a, writes: wa } = spyBuffer(n);

  // First pack writes every cell's dry/terrain data as well as wet cells.
  W.pack(a);
  for (let c = 0; c < n; c++) {
    assert.ok(wa.has(4 * c + 3), `first pack writes terrain for cell ${c}`);
    if (!W.wet[c]) {
      for (let k = 0; k < 4; k++) assert.ok(wa.has(4 * c + k), `first pack writes dry cell ${c}[${k}]`);
    }
  }

  // Subsequent frames into the same buffer write only wet cells' height & slopes.
  W.addVolume(-0.4, 0, 0.01, 0.2);
  W.step(1 / 60, 0.2, 0.1);
  wa.clear();
  W.pack(a);
  assert.equal(wa.size, W.wetCount * 3, 'second pack writes only 3 floats per wet cell');
  for (const idx of wa) {
    const c = (idx / 4) | 0;
    assert.equal(W.wet[c], 1, `written cell ${c} must be wet`);
    assert.notEqual(idx % 4, 3, `terrain slot for cell ${c} must not be rewritten`);
  }

  // setLevel invalidates the cached buffer, so the next pack writes dry cells and terrain again.
  W.setLevel(0.58, 0);
  wa.clear();
  W.pack(a);
  for (let c = 0; c < n; c++) {
    assert.ok(wa.has(4 * c + 3), `post-setLevel pack writes terrain for cell ${c}`);
    if (!W.wet[c]) assert.ok(wa.has(4 * c), `post-setLevel pack writes dry cell ${c}`);
  }

  // Next frame returns to wet-only writes.
  W.step(1 / 60, 0, 0.1);
  wa.clear();
  W.pack(a);
  assert.equal(wa.size, W.wetCount * 3, 'frame after post-setLevel pack writes only wet cells');

  // A different buffer gets a full pack.
  const { proxy: b, writes: wb } = spyBuffer(n);
  W.pack(b);
  for (let c = 0; c < n; c++) {
    assert.ok(wb.has(4 * c + 3), `different buffer gets terrain for cell ${c}`);
    if (!W.wet[c]) assert.ok(wb.has(4 * c), `different buffer gets dry cell ${c}`);
  }
});
