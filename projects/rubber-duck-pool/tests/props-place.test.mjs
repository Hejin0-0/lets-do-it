import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { A, partsBuilder } from '@lid/diorama/parts.js';
import { PLACEMENTS, decodeProps, unpackProps } from '../src/pool/props.js';
import { PROP_SHAPES } from '../src/pool/prop-shapes.js';
import { SAMPLING_SHAPES } from '../src/pool/sampling-shapes.js';
import { CHAIR_SHAPES } from '../src/pool/chair-shapes.js';
import { COOLER_SHAPES } from '../src/pool/cooler-shapes.js';
import { LOOKDEV_SHAPES } from '../src/pool/lookdev-shapes.js';
import { buildArchitecture } from '../src/pool/scenery.js';
import { P } from '../src/pool/layout.js';
import { isleH, isleSd, JETTY } from '../src/pool/island.js';

const models = { ...PROP_SHAPES.models, ...SAMPLING_SHAPES.models, ...CHAIR_SHAPES.models, ...COOLER_SHAPES.models, ...LOOKDEV_SHAPES.models };
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
const chairMesh = meshData('resort-chair.bin', CHAIR_SHAPES);
const coolerMesh = meshData('resort-cooler.bin', COOLER_SHAPES);
const lookdevMesh = meshData('lookdev.bin', LOOKDEV_SHAPES);
const meshFor = (m) => LOOKDEV_SHAPES.models[m] ? lookdevMesh : m === 'chair' ? chairMesh : COOLER_SHAPES.models[m] ? coolerMesh : SAMPLING_SHAPES.models[m] ? samplingMesh : baseMesh;   // load()'s order: a later table wins
const lowBounds = new Map();
function groundFootprint(p) {
  // Preserve the existing full pool-structure check, including its coping.
  if (p.model === 'pool_structure') return footprint(p);
  const key = `${p.model}:${p.scale}`;
  if (!lowBounds.has(key)) {
    const m = models[p.model], mesh = meshFor(p.model);
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
const fixed = PLACEMENTS.filter(p => p.at && p.model !== 'architecture' && p.model !== 'cooler_lid');
// The radio is posed from layout, despite having no static `at` in PLACEMENTS.
const radio = { model: 'radio', at: [P.RADIO[0], P.TER, P.RADIO[1]], yaw: .4, scale: 1 };

test('ground footprints retain real collisions and only release palm canopies over the coolers', () => {
  const coolers = PLACEMENTS.filter(p => p.model === 'cooler');
  const [terrace, sea] = coolers;
  const planter = fixed.find(p => p.model === 'palm' && Math.abs(p.at[0] + 4.2) < 1e-9 && Math.abs(p.at[2] + 2.4) < 1e-9);   // the left planter's, its crown high over the terrace cooler
  assert.ok(planter);
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
    `${terrace.model} at ${terrace.at} / palm at ${planter.at}`,
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

test('each model is in one table: a later table replaces it in load(), so a copy in an earlier one is downloaded and never drawn', () => {
  const tables = { props: PROP_SHAPES, sampling: SAMPLING_SHAPES, chair: CHAIR_SHAPES, cooler: COOLER_SHAPES, lookdev: LOOKDEV_SHAPES }, seen = new Map();
  for (const [file, S] of Object.entries(tables)) for (const k of Object.keys(S.models)) {
    assert.ok(!seen.has(k), `${k} is in ${seen.get(k)} and ${file}: run node tools/pack-props.mjs`);
    seen.set(k, file);
  }
  for (const p of PLACEMENTS) assert.ok(models[p.model] || p.model === 'architecture', `${p.model}: placed but in no table`);
});

test('a build sends the props gzipped (vite.config.js) and the page reads them as the raw files', async () => {
  const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length), bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  const out = mkdtempSync(join(tmpdir(), 'pool-build-')), raw = (f) => readFileSync(new URL(`../public/props/${f}`, import.meta.url));
  try {
    await build({ root: fileURLToPath(new URL('..', import.meta.url)), logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
    for (const [file, S] of [['props.bin', PROP_SHAPES], ['lookdev.bin', LOOKDEV_SHAPES]]) {
      const sent = readFileSync(join(out, 'props', file));
      assert.ok(sent[0] === 0x1f && sent[1] === 0x8b && sent.length < raw(file).length / 2, `${file}: sent gzipped, ${sent.length} bytes`);
      const a = decodeProps(await unpackProps(ab(sent), S), S), b = decodeProps(await unpackProps(ab(raw(file)), S), S);
      assert.ok(bytes(a.V).equals(bytes(b.V)) && bytes(a.I).equals(bytes(b.I)), `${file}: gzipped reads as raw`);
    }
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('a log lies on the ground its whole length, not one end in the sand and the other in the air', () => {
  const [lo, hi] = LOOKDEV_SHAPES.models.driftwood.bounds, half = Math.max(-lo[0], hi[0]);
  for (const p of PLACEMENTS.filter((q) => q.model === 'driftwood')) for (const u of [-1, 1]) {
    const e = A.apply(A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale)), [u * half, 0, 0]), off = e[1] - isleH(e[0], e[2]);
    assert.ok(Math.abs(off) < 0.05, `log at ${p.at.map((v) => v.toFixed(2))}: its end ${off.toFixed(3)} off the ground`);
  }
});

test('nothing scattered stands on the jetty: its deck runs from the steps to the end, 0.47 either side', () => {
  const own = new Set(['jettysteps', 'pier_dock', 'lantern', 'boat']);
  for (const p of PLACEMENTS) if (p.at && !own.has(p.model)) {
    const dx = Math.max(JETTY.x0 - p.at[0], 0, p.at[0] - JETTY.x1), dz = Math.max(Math.abs(p.at[2] - JETTY.z) - 0.47, 0);
    assert.ok(Math.hypot(dx, dz) > 0.2 * p.scale, `${p.model} at ${p.at.map((v) => v.toFixed(2))} stands on the jetty`);
  }
});

test('nothing scattered stands in what is built: the pool house, the jetty, the beach things', () => {
  const scattered = new Set(['shrub', 'shrub2', 'flowerbush', 'oleander', 'fern', 'agave', 'tuft', 'rock', 'rock2', 'ledge', 'shell', 'starfish']);
  const built = new Set(['poolhouse', 'jettysteps', 'pier_dock', 'cabana', 'lounger', 'parasol', 'torch', 'lantern', 'stepstone', 'sandcastle', 'bucket', 'surfboards', 'driftwood', 'rockpool']);
  const hits = [];
  for (const a of fixed.filter((p) => scattered.has(p.model))) for (const b of fixed.filter((p) => built.has(p.model)))
    if (overlaps(groundFootprint(a), groundFootprint(b))) hits.push(`${a.model} at ${a.at.map((v) => v.toFixed(2))} in the ${b.model} at ${b.at.map((v) => v.toFixed(2))}`);
  assert.deepEqual(hits, []);
});

test('no stepping stone is laid on another, where the pool house path branches off the jetty path too', () => {
  const stones = fixed.filter((p) => p.model === 'stepstone');
  for (const [i, a] of stones.entries()) for (const b of stones.slice(i + 1))
    assert.ok(Math.hypot(a.at[0] - b.at[0], a.at[2] - b.at[2]) > 0.2, `stones at ${a.at.map((v) => v.toFixed(2))} and ${b.at.map((v) => v.toFixed(2))}`);
});

test('nothing goes into a wall: what stands by one stays on its side, or passes over the coping', () => {
  const verts = (p) => {
    const m = models[p.model], mesh = meshFor(p.model), T = A.mul(A.t(...p.at), A.ry(p.yaw), A.s(p.scale));
    return Array.from({ length: m.vertices }, (_, i) => A.apply(T, [0, 4, 8].map((n) => mesh.data.readFloatLE((m.vertex + i) * mesh.stride + n))));
  };
  const v = architecture.vert, top = Math.max(...Array.from({ length: v.length / 11 }, (_, i) => v[i * 11] < P.WALL_L - 0.01 ? v[i * 11 + 1] : -Infinity));
  const art = verts(PLACEMENTS.find((p) => p.model === 'art_wall')), artX = Math.max(...art.map((u) => u[0])), artY = Math.max(...art.map((u) => u[1]));
  const artZ = [Math.min(...art.map((u) => u[2])), Math.max(...art.map((u) => u[2]))];
  // [name, the axis across it, its courtyard face, its outer face, the axis along it and its run] (the coping's 4 cm lip left out)
  const walls = [['left', 0, P.WALL_L, -P.HALF, 2, [P.WALL_B, P.FRONT]], ['back', 2, P.WALL_B, -P.HALF, 0, [-P.HALF, P.HALF]]];
  const onWall = new Set(['architecture', 'mural', 'art_wall', 'bougain', 'sconce']);   // fixed to a wall, or over its top, by design
  for (const p of PLACEMENTS.filter((q) => q.at && !onWall.has(q.model))) {
    const pts = verts(p);
    for (const [name, a, inner, outer, b, [lo, hi]] of walls) {
      const inside = p.at[a] > inner;
      const face = (u) => name === 'left' && inside && u[2] > artZ[0] && u[2] < artZ[1] && u[1] < artY ? artX : inner;   // the mural's relief stands out from the left wall
      const into = pts.filter((u) => u[1] < top && u[b] > lo && u[b] < hi && (inside ? u[a] < face(u) : u[a] > outer));
      assert.equal(into.length, 0, `${p.model} at (${p.at[0].toFixed(2)}, ${p.at[2].toFixed(2)}): ${into.length} points into the ${name} wall, below y ${top.toFixed(2)}`);
    }
  }
});

test('no plant stands on a drop: seated by its roots, its foot is at most 0.15 below the ground at its centre', () => {
  const plants = new Set(['palm', 'palm2', 'shrub', 'shrub2', 'flowerbush', 'oleander', 'fern', 'agave', 'tuft', 'potpalm', 'potflower', 'potshrub']);
  for (const p of PLACEMENTS.filter((q) => q.at && plants.has(q.model))) {
    const foot = p.at[1] + models[p.model].bounds[0][1] * p.scale, under = isleH(p.at[0], p.at[2]) - foot;
    assert.ok(under <= 0.15, `${p.model} at (${p.at[0].toFixed(2)}, ${p.at[2].toFixed(2)}): its foot ${under.toFixed(3)} below the ground at its centre`);
  }
});
