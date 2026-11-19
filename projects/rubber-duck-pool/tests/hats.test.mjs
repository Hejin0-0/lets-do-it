import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A } from '@lid/diorama/parts.js';
import * as ducksMod from '../src/pool/ducks.js';
import { HATS, PROPELLER } from '../src/pool/ducks.js';
import { createWorld } from '../src/pool/world.js';
import * as sceneMod from '../src/pool/scene.js';
import { buildScene, poseScene } from '../src/pool/scene.js';
import * as rendererMod from '../src/pool/renderer.js';
import { duckBase, fxBase, propBase } from '../src/pool/renderer.js';

test('HAT_MESH builds each wearable once and its index ranges partition the mesh without 40x per-slot baking', () => {
  const { mesh } = buildScene();
  // Still scenery (0) + marker, glass, sandTop, sandHeap, stream (5) = 6 parts; the 360 per-slot hat parts are gone
  assert.equal(mesh.nParts, 6);
  assert.equal(mesh.index.length / 3, 7842);

  const { HAT_MESH, buildHatMesh } = ducksMod;
  assert.ok(HAT_MESH && typeof buildHatMesh === 'function', 'ducks.js must export HAT_MESH and buildHatMesh');
  const built = buildHatMesh();
  assert.equal(HAT_MESH.vert.length, built.vert.length);
  assert.equal(HAT_MESH.index.length, built.index.length);
  assert.equal(HAT_MESH.hats.length, HATS.length);

  // 'none' has an empty range
  assert.deepEqual(HAT_MESH.hats[0], { id: 'none', firstIndex: 0, indexCount: 0 });

  // The 8 wearable hats (1..8) and the propeller blades partition HAT_MESH.index contiguously, once each
  let cursor = 0;
  for (let i = 1; i < HATS.length; i++) {
    const r = HAT_MESH.hats[i];
    assert.equal(r.id, HATS[i].id);
    assert.equal(r.firstIndex, cursor, `hat ${r.id} firstIndex must follow previous range`);
    assert.ok(r.indexCount > 0 && r.indexCount % 3 === 0, `hat ${r.id} must have a non-empty triangle index range`);
    for (let j = r.firstIndex; j < r.firstIndex + r.indexCount; j++) {
      const vi = HAT_MESH.index[j];
      assert.equal(HAT_MESH.vert[11 * vi + 10], i, `hat ${r.id} index ${j} must reference part ${i}`);
    }
    cursor += r.indexCount;
  }

  const b = HAT_MESH.blades;
  assert.equal(b.firstIndex, cursor);
  assert.ok(b.indexCount > 0 && b.indexCount % 3 === 0);
  for (let j = b.firstIndex; j < b.firstIndex + b.indexCount; j++) {
    const vi = HAT_MESH.index[j];
    assert.equal(HAT_MESH.vert[11 * vi + 10], HATS.length, `blades index ${j} must reference blades part`);
  }
  cursor += b.indexCount;
  assert.equal(cursor, HAT_MESH.index.length, 'hat ranges plus blades range must cover the entire hat index buffer once');
  assert.equal(HAT_MESH.index.length / 3, 2012);
});

test('poseScene writes hat instances ordered by hat with head transforms, spun blade transforms for propellers, and nothing for bare ducks', () => {
  const { HEAD_FIX, HAT_MESH, headTransform, bladeTransform } = ducksMod;
  const { drawHats } = sceneMod;
  const { HAT_FLOATS = 12, instFloats } = rendererMod;
  const W = createWorld({ seed: 11, ducks: 8, arrivals: false });
  W.step(30);
  const { mesh, parts } = buildScene();
  assert.ok(Number.isInteger(parts.hatBase) && typeof instFloats === 'function', 'buildScene must set parts.hatBase and renderer.js must export instFloats');
  const buf = new Float32Array(instFloats(mesh));
  buf.fill(-999, parts.hatBase);

  // Assign mixed hats out of order:
  // 0: bare (none), 1: crown (3), 2: party (1), 3: propeller (8, spin 1.35),
  // 4: bare (none), 5: crown (3), 6: tophat (2), 7: pirate (7)
  const setup = [
    { hat: 0, spin: 0 },
    { hat: 3, spin: 0 },
    { hat: 1, spin: 0 },
    { hat: PROPELLER, spin: 1.35 },
    { hat: 0, spin: 0 },
    { hat: 3, spin: 0 },
    { hat: 2, spin: 0 },
    { hat: 7, spin: 0 },
  ];
  W.ducks.forEach((d, i) => {
    d.hat = setup[i].hat;
    d.spin = setup[i].spin;
  });

  const bodyM = (d) => A.q(d.body.q, W.floaters.origin(d.body, [0, 0, 0]), 1);
  const n = poseScene(buf, parts, W);
  assert.equal(n, 8);

  // Expected hatted ducks ordered by hat:
  // instance 0: duck 2 (hat 1, party)
  // instance 1: duck 6 (hat 2, tophat)
  // instance 2: duck 1 (hat 3, crown)
  // instance 3: duck 5 (hat 3, crown)
  // instance 4: duck 7 (hat 7, pirate)
  // instance 5: duck 3 (hat 8, propeller cap — unspun head transform)
  // instance 6: duck 3 blades (spun blade transform)
  const expectedOrder = [W.ducks[2], W.ducks[6], W.ducks[1], W.ducks[5], W.ducks[7], W.ducks[3]];
  for (let i = 0; i < expectedOrder.length; i++) {
    const d = expectedOrder[i];
    const m = bodyM(d);
    const expectedH = A.mul(m, HEAD_FIX);
    assert.deepEqual(expectedH, headTransform(m));
    const at = parts.hatBase + HAT_FLOATS * i;
    for (let k = 0; k < 12; k++) {
      assert.ok(Math.abs(buf[at + k] - expectedH[k]) < 1e-6, `instance ${i} float ${k} must equal duck ${d.id} head transform`);
    }
  }

  // Instance 6 holds the spun blade transform for duck 3 (hat === PROPELLER, spin === 1.35)
  const propDuck = W.ducks[3];
  const propHead = headTransform(bodyM(propDuck));
  const expectedBlades = bladeTransform(propHead, 1.35);
  const bladeAt = parts.hatBase + HAT_FLOATS * 6;
  let differsFromUnspun = false;
  for (let k = 0; k < 12; k++) {
    assert.ok(Math.abs(buf[bladeAt + k] - expectedBlades[k]) < 1e-6, `blade instance float ${k} must equal spun blade transform`);
    if (Math.abs(expectedBlades[k] - propHead[k]) > 1e-3) differsFromUnspun = true;
  }
  assert.ok(differsFromUnspun, 'spun blade transform must differ from unspun head transform');

  // Bare ducks (0 and 4) wrote nothing: everything past the 6 hat + 1 blade = 7 instances is untouched
  const afterAt = parts.hatBase + HAT_FLOATS * 7;
  for (let k = 0; k < 24; k++) {
    assert.equal(buf[afterAt + k], -999, `float at +${k} past the 7 written instances must remain untouched`);
  }

  // Verify hatRuns: 5 hat runs (1, 2, 3x2, 7, 8) + 1 blades run
  assert.deepEqual(parts.hatRuns, [
    { hat: 1, id: 'party', firstInstance: 0, count: 1, firstIndex: HAT_MESH.hats[1].firstIndex, indexCount: HAT_MESH.hats[1].indexCount },
    { hat: 2, id: 'tophat', firstInstance: 1, count: 1, firstIndex: HAT_MESH.hats[2].firstIndex, indexCount: HAT_MESH.hats[2].indexCount },
    { hat: 3, id: 'crown', firstInstance: 2, count: 2, firstIndex: HAT_MESH.hats[3].firstIndex, indexCount: HAT_MESH.hats[3].indexCount },
    { hat: 7, id: 'pirate', firstInstance: 4, count: 1, firstIndex: HAT_MESH.hats[7].firstIndex, indexCount: HAT_MESH.hats[7].indexCount },
    { hat: PROPELLER, id: 'propeller', firstInstance: 5, count: 1, firstIndex: HAT_MESH.hats[PROPELLER].firstIndex, indexCount: HAT_MESH.hats[PROPELLER].indexCount },
    { hat: PROPELLER, id: 'blades', blades: true, firstInstance: 6, count: 1, firstIndex: HAT_MESH.blades.firstIndex, indexCount: HAT_MESH.blades.indexCount },
  ]);

  // Verify drawHats issues one drawIndexed per hat kind present plus one for the blades
  const draws = [];
  const pass = {
    drawIndexed(indexCount, instanceCount, firstIndex = 0, baseVertex = 0, firstInstance = 0) {
      draws.push({ indexCount, instanceCount, firstIndex, baseVertex, firstInstance });
    },
  };
  drawHats(pass, { hatRuns: parts.hatRuns });
  assert.deepEqual(draws, [
    { indexCount: HAT_MESH.hats[1].indexCount, instanceCount: 1, firstIndex: HAT_MESH.hats[1].firstIndex, baseVertex: 0, firstInstance: 0 },
    { indexCount: HAT_MESH.hats[2].indexCount, instanceCount: 1, firstIndex: HAT_MESH.hats[2].firstIndex, baseVertex: 0, firstInstance: 1 },
    { indexCount: HAT_MESH.hats[3].indexCount, instanceCount: 2, firstIndex: HAT_MESH.hats[3].firstIndex, baseVertex: 0, firstInstance: 2 },
    { indexCount: HAT_MESH.hats[7].indexCount, instanceCount: 1, firstIndex: HAT_MESH.hats[7].firstIndex, baseVertex: 0, firstInstance: 4 },
    { indexCount: HAT_MESH.hats[PROPELLER].indexCount, instanceCount: 1, firstIndex: HAT_MESH.hats[PROPELLER].firstIndex, baseVertex: 0, firstInstance: 5 },
    { indexCount: HAT_MESH.blades.indexCount, instanceCount: 1, firstIndex: HAT_MESH.blades.firstIndex, baseVertex: 0, firstInstance: 6 },
  ]);
});

test('when no ducks wear a hat, poseScene writes nothing to the hat region and drawHats issues no draws; instance helpers match', () => {
  const { drawHats } = sceneMod;
  const { hatBase, instFloats } = rendererMod;
  const W = createWorld({ seed: 5, ducks: 6, arrivals: false });
  for (const d of W.ducks) d.hat = 0;
  const { mesh, parts } = buildScene();
  assert.equal(parts.duckBase, duckBase(mesh));
  assert.equal(typeof hatBase, 'function');
  assert.equal(parts.hatBase, hatBase(mesh));
  assert.ok(hatBase(mesh) > duckBase(mesh));
  assert.ok(fxBase(mesh) > hatBase(mesh));
  assert.ok(propBase(mesh) > fxBase(mesh));
  assert.ok(instFloats(mesh) > propBase(mesh));

  const buf = new Float32Array(instFloats(mesh));
  buf.fill(-777, parts.hatBase, fxBase(mesh));
  poseScene(buf, parts, W);

  assert.deepEqual(parts.hatRuns, []);
  for (let i = parts.hatBase; i < fxBase(mesh); i++) {
    assert.equal(buf[i], -777, `hat region float ${i} must not be touched when no duck wears a hat`);
  }

  const draws = [];
  drawHats({ drawIndexed: (...args) => draws.push(args) }, { hatRuns: parts.hatRuns });
  assert.equal(draws.length, 0);
});
