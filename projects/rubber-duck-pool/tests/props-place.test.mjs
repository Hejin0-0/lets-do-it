import test from 'node:test';
import assert from 'node:assert/strict';
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

for (const name of names) {
  test(`${name}: one placement, grounded at centre and corners, clear of other footprints and water`, () => {
    const found = PLACEMENTS.filter(p => p.model === name);
    assert.equal(found.length, 1);
    const p = found[0], f = footprint(p), base = p.at[1] + models[name].bounds[0][1] * p.scale;
    for (const v of [centre(f), ...f]) assert.ok(Math.abs(base - isleH(...v)) <= .01, `${name}: base ${base}, ground ${isleH(...v)} at ${v}`);
    for (const other of [...fixed, radio]) if (other !== p)
      assert.ok(!overlaps(f, footprint(other)), `${name} overlaps ${other.model} at ${other.at}`);
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
  });
}

test('beach belongings stay together and boards face out to sea', () => {
  const get = name => PLACEMENTS.find(p => p.model === name);
  const distance = (a, b) => Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]);
  assert.ok(distance(get('sandcastle'), get('bucket')) < .6);
  assert.ok(get('sandcastle').at[2] > 6.7);
  assert.ok(PLACEMENTS.some(p => p.model === 'lounger' && distance(get('cooler'), p) < .6));
  assert.ok(distance(get('surfboards'), get('cabana')) < 1);
  assert.ok(-Math.sin(get('surfboards').yaw) > .9, 'authored +x front faces +z sea');
  assert.ok(PLACEMENTS.some(p => p.model === 'chair' && distance(get('towels'), p) < .7));
  for (const name of ['noodles', 'towels']) for (const v of samples(footprint(get(name)))) assert.equal(P.terrainH(...v), P.TER, `${name}: stone terrace`);
});
