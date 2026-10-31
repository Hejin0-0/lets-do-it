import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { A, partsBuilder } from '@lid/diorama/parts.js';
import { PLACEMENTS } from '../src/pool/props.js';
import { PROP_SHAPES } from '../src/pool/prop-shapes.js';
import { SAMPLING_SHAPES } from '../src/pool/sampling-shapes.js';
import { buildArchitecture } from '../src/pool/scenery.js';
import { P } from '../src/pool/layout.js';
import { isleH, isleSd } from '../src/pool/island.js';

const models = { ...PROP_SHAPES.models, ...SAMPLING_SHAPES.models };
const names = ['sandcastle', 'bucket', 'surfboards', 'cooler', 'noodles', 'towels'];
function footprint(p) {
  const [lo, hi] = models[p.model].bounds;
  const matrix = A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale));
  return [[lo[0], lo[2]], [hi[0], lo[2]], [hi[0], hi[2]], [lo[0], hi[2]]]
    .map(([x, z]) => { const v = A.apply(matrix, [x, 0, z]); return [v[0], v[2]]; });
}
// The seat cooler is 0.203 units high at scale 1. Include its full height, but not palm crowns.
const GROUND_BAND = .21;
function meshData(file, shapes) {
  const data = readFileSync(new URL(`../public/props/${file}`, import.meta.url));
  const stride = (data.length - shapes.indices * 4) / shapes.vertices;
  assert.ok(stride === 20 || stride === 40, `${file}: unexpected vertex format`);
  return { data, stride, indexOffset: shapes.vertices * stride };
}
const baseMesh = meshData('props.bin', PROP_SHAPES);
const samplingMesh = meshData('sampling.bin', SAMPLING_SHAPES);
const lowBounds = new Map();
function groundFootprint(p) {
  // Preserve the existing full pool-structure check, including its coping.
  if (p.model === 'pool_structure') return footprint(p);
  const key = `${p.model}:${p.scale}`;
  if (!lowBounds.has(key)) {
    const m = models[p.model], mesh = SAMPLING_SHAPES.models[p.model] ? samplingMesh : baseMesh;
    const top = m.bounds[0][1] + GROUND_BAND / p.scale;
    const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    const include = v => { for (const [i, axis] of [0, 2].entries()) { lo[i] = Math.min(lo[i], v[axis]); hi[i] = Math.max(hi[i], v[axis]); } };
    const vertex = i => {
      const offset = (m.vertex + mesh.data.readUInt32LE(mesh.indexOffset + (m.index + i) * 4)) * mesh.stride;
      return [0, 4, 8].map(n => mesh.data.readFloatLE(offset + n));
    };
    for (let i = 0; i < m.indices; i += 3) {
      const tri = [vertex(i), vertex(i + 1), vertex(i + 2)];
      for (let j = 0; j < 3; j++) {
        const a = tri[j], b = tri[(j + 1) % 3];
        if (a[1] <= top) include(a);
        if ((a[1] < top && b[1] > top) || (a[1] > top && b[1] < top)) {
          const t = (top - a[1]) / (b[1] - a[1]);
          include(a.map((v, k) => v + t * (b[k] - v)));
        }
      }
    }
    assert.ok(lo.every(Number.isFinite) && hi.every(Number.isFinite), `${p.model}: empty ground band`);
    lowBounds.set(key, [lo, hi]);
  }
  const [lo, hi] = lowBounds.get(key), matrix = A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale));
  return [[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]]
    .map(([x, z]) => { const v = A.apply(matrix, [x, 0, z]); return [v[0], v[2]]; });
}
function overlaps(a, b) {
  // Separating axes of both rotated bounds; touching edges count as occupied.
  return ![a, b].some(poly => poly.some((v, i) => {
    const w = poly[(i + 1) % poly.length], axis = [w[1] - v[1], v[0] - w[0]];
    if (Math.hypot(...axis) < 1e-10) return false;
    const project = points => points.map(p => p[0] * axis[0] + p[1] * axis[1]);
    const pa = project(a), pb = project(b);
    return Math.max(...pa) < Math.min(...pb) - 1e-8 || Math.max(...pb) < Math.min(...pa) - 1e-8;
  }));
}
const centre = f => [(f[0][0] + f[2][0]) / 2, (f[0][1] + f[2][1]) / 2];
function samples(f) {
  const n = Math.ceil(Math.max(Math.hypot(...f[1].map((v, k) => v - f[0][k])), Math.hypot(...f[3].map((v, k) => v - f[0][k]))) / .01);
  const points = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++)
    points.push(f[0].map((v, k) => v + (f[1][k] - v) * i / n + (f[3][k] - v) * j / n));
  return points;
}
// Architecture is a disconnected L-shaped assembly: its overall bounding rectangle includes the whole
// empty courtyard. Use the projected triangles of the actual generated walls/roof/columns instead.
const builder = partsBuilder();
buildArchitecture(builder);
const architecture = builder.done();
const architectureFootprints = [];
for (let i = 0; i < architecture.index.length; i += 3) {
  architectureFootprints.push([0, 1, 2].map(k => {
    const offset = architecture.index[i + k] * 11;
    return [architecture.vert[offset], architecture.vert[offset + 2]];
  }));
}
const fixed = PLACEMENTS.filter(p => p.at && p.model !== 'architecture');
// The radio is posed from layout, despite having no static `at` in PLACEMENTS.
const radio = { model: 'radio', at: [P.RADIO[0], P.TER, P.RADIO[1]], yaw: .4, scale: 1 };

test('ground footprints retain real collisions and only release the sea cooler canopy overlaps', () => {
  const coolers = PLACEMENTS.filter(p => p.model === 'cooler');
  const sea = coolers[1];
  const palm = fixed.find(p => p.model === 'palm' && p.at[0] === -3.3 && p.at[2] === 1.5);
  assert.ok(palm);
  const trunkCooler = { ...sea, at: [...palm.at] };
  assert.ok(overlaps(groundFootprint(trunkCooler), groundFootprint(palm)), 'cooler on palm trunk');

  const released = [], newCollisions = [];
  for (const p of PLACEMENTS.filter(p => names.includes(p.model))) for (const other of [...fixed, radio]) {
    if (p === other) continue;
    const before = overlaps(footprint(p), footprint(other));
    const after = overlaps(groundFootprint(p), groundFootprint(other));
    const pair = `${p.model} at ${p.at} / ${other.model} at ${other.at}`;
    if (before && !after) released.push(pair);
    if (!before && after) newCollisions.push(pair);
  }
  assert.deepEqual(newCollisions, []);
  assert.deepEqual(released.sort(), [
    `${sea.model} at ${sea.at} / palm at -3.3,1.115,1.5`,
    `${sea.model} at ${sea.at} / palm at -2.7,1.115,2.95`,
  ].sort());
});

test('the pool chair cooler at its old side point fails the pool structure check', () => {
  const cooler = PLACEMENTS.filter(p => p.model === 'cooler')[0], at = cooler.at;
  try {
    cooler.at = [1.54 * P.K, at[1], -.33 * P.K];
    assert.throws(() => placed('cooler', cooler), /overlaps pool_structure/);
  } finally { cooler.at = at; }
});

// The cooler is the beach's and one by each seat (P.SEATS side, the seated menu's anchor); the rest are one of a kind.
for (const name of names) {
  test(`${name}: each placement grounded at centre and corners, clear of other footprints and water`, () => {
    const found = PLACEMENTS.filter(p => p.model === name);
    assert.equal(found.length, name === 'cooler' ? 1 + P.SEATS.length : 1);
    for (const p of found) placed(name, p);
  });
}
function placed(name, p) {
    const f = footprint(p), base = p.at[1] + models[name].bounds[0][1] * p.scale;
    for (const v of [centre(f), ...f]) assert.ok(Math.abs(base - isleH(...v)) <= .01, `${name}: base ${base}, ground ${isleH(...v)} at ${v}`);
    for (const other of [...fixed, radio]) if (other !== p)
      assert.ok(!overlaps(groundFootprint(p), groundFootprint(other)), `${name} overlaps ${other.model} at ${other.at}`);
    for (const triangle of architectureFootprints) assert.ok(!overlaps(f, triangle), `${name} overlaps architecture`);
    // Cover the interior as well as the corners: a pool or shore could cut across a rotated footprint.
    // The extra margins exceed the sampling interval; both copings and the landward foam band stay clear.
    for (const [x, z] of samples(f)) {
      assert.ok(P.mainD(x, z) > P.RIM + .02, `${name}: main pool/coping`);
      assert.ok(P.roundD(x, z) > P.RIM + .02, `${name}: round pool/coping`);
      assert.ok(isleSd(x, z) < -.4, `${name}: sea/shore`);
      assert.ok(P.segDist(x, z, P.SWAN.at, P.SWAN.into) > .75, `${name}: swan approach`);
      // Toy floats and the swimming swan occupy the pools, excluded above; the approaching swan is excluded here.
      for (const route of [P.slide, P.tube]) for (let i = 1; i < route.pts.length; i++)
        assert.ok(P.segDist(x, z, [route.pts[i - 1][0], route.pts[i - 1][2]], [route.pts[i][0], route.pts[i][2]]) > .22, `${name}: water ride`);
      const lx = P.MAIN[2], lz = -.6 * P.K, L = P.SIZE.ladder;
      assert.ok(x < lx - .04 * L || x > lx + .07 * L || Math.abs(z - lz) > .05 * L, `${name}: ladder`);
    }
}

test('beach belongings stay together and boards face out to sea', () => {
  const get = name => PLACEMENTS.find(p => p.model === name && (name !== 'cooler' || p.at[2] > P.FRONT));   // the beach's cooler, not a seat's
  const distance = (a, b) => Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]);
  assert.ok(distance(get('sandcastle'), get('bucket')) < .6);
  assert.ok(get('sandcastle').at[2] > 6.7);
  assert.ok(PLACEMENTS.some(p => p.model === 'lounger' && distance(get('cooler'), p) < .6));
  assert.ok(distance(get('surfboards'), get('cabana')) < 1);
  assert.ok(-Math.sin(get('surfboards').yaw) > .9, 'authored +x front faces +z sea');
  assert.ok(PLACEMENTS.some(p => p.model === 'chair' && distance(get('towels'), p) < .7));
  for (const name of ['noodles', 'towels']) for (const v of samples(footprint(get(name)))) assert.equal(P.terrainH(...v), P.TER, `${name}: stone terrace`);
});
