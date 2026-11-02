import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHAIR_SHAPES } from '../src/pool/chair-shapes.js';
import { COOLER_SHAPES } from '../src/pool/cooler-shapes.js';
import { loadProps, PLACEMENTS } from '../src/pool/props.js';
import { PROP_SHAPES } from '../src/pool/prop-shapes.js';
import { SAMPLING_SHAPES } from '../src/pool/sampling-shapes.js';

test('the game loads the new chair geometry for every chair placement', async () => {
  const chair = CHAIR_SHAPES.models.chair;
  const data = await readFile(new URL('../public/props/resort-chair.bin', import.meta.url));
  assert.equal(data.byteLength, CHAIR_SHAPES.vertices * 40 + CHAIR_SHAPES.indices * 4);
  assert.ok(chair.bounds[0][1] >= 0 && chair.bounds[0][1] < .01, 'chair feet should meet the ground');
  const originalFetch = globalThis.fetch, originalDocument = globalThis.document;
  const fetched = [];
  globalThis.document = { baseURI: 'http://localhost/' };
  globalThis.fetch = async url => {
    const file = new URL(url).pathname.split('/').at(-1);
    fetched.push(file);
    const bytes = await readFile(new URL(`../public/props/${file}`, import.meta.url));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
  try {
    const { vert } = await loadProps();
    assert.equal(fetched.filter(file => file === 'resort-chair.bin').length, 1);
    const models = { ...PROP_SHAPES.models, ...SAMPLING_SHAPES.models, ...CHAIR_SHAPES.models, ...COOLER_SHAPES.models };
    let first = 0, chairs = 0;
    for (const p of PLACEMENTS) {
      if (p.model === 'chair') {
        chairs++;
        const count = models.chair.vertices;
        const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
        assert.ok(Math.abs(vert[first * 11] - dataView.getFloat32(0, true)) < 1e-6, 'chair uses new geometry');
        first += count;
      } else if (p.model === 'architecture') {
        break;
      } else first += models[p.model].vertices;
    }
    assert.equal(chairs, 3);
  } finally {
    globalThis.fetch = originalFetch; globalThis.document = originalDocument;
  }
});
