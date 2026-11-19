import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { P } from '../src/pool/layout.js';
import { DESIGNS, HATS, PROPELLER, pickDesign, arrivalDesign, visibleExtras } from '../src/pool/ducks.js';
import { DUCK_SHAPE } from '../src/pool/duck-shape.js';
import { createWorld } from '../src/pool/world.js';
import { createLogbook } from '../src/pool/logbook.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';
import { buildScene, poseScene, drawDucks } from '../src/pool/scene.js';
import { RECORDINGS, createSound } from '../src/pool/sound.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VALID_SHAPES = new Set(['drop', 'bubble', 'heart', 'star', 'petal', 'bolt', 'spark']);
const EXPECTED_UNEXPECTED = [
  ['13-teapot', 'Teapot'],
  ['14-terrarium', 'Terrarium'],
  ['15-citrus', 'Citrus'],
  ['16-cloud', 'Cloud'],
  ['17-bookbinder', 'Bookbinder'],
  ['18-ramen', 'Ramen'],
  ['19-moon', 'Moon'],
  ['20-radio', 'Radio'],
  ['21-magnet', 'Magnet'],
  ['22-snow-globe', 'Snow Globe'],
  ['23-mosaic', 'Mosaic'],
  ['24-lantern', 'Lantern'],
];

test('DESIGNS lists 12 classic and 12 unexpected ducks with valid fx bursts, hops, voices and built assets', () => {
  assert.equal(DESIGNS.length, 24);
  const classicVoices = new Set(DESIGNS.slice(0, 12).map((d) => d.voice));
  for (let i = 0; i < 12; i++) {
    assert.ok(!DESIGNS[i].unexpected, `classic design ${i} must not be marked unexpected`);
  }
  for (let i = 0; i < 12; i++) {
    const d = DESIGNS[12 + i];
    const [id, label] = EXPECTED_UNEXPECTED[i];
    assert.equal(d.id, id);
    assert.equal(d.label, label);
    assert.equal(d.unexpected, true);
    assert.ok(classicVoices.has(d.voice), `${d.id} voice ${d.voice} must use one of the twelve existing recordings`);
    assert.ok(VALID_SHAPES.has(d.fx?.shape), `${d.id} fx shape ${d.fx?.shape} must be an existing shape`);
    assert.ok(Array.isArray(d.fx.colours) && d.fx.colours.length >= 2);
    assert.ok(Number.isInteger(d.fx.n) && d.fx.n > 0);
    assert.ok(Number.isFinite(d.fx.up));
    assert.ok(Number.isFinite(d.hop) && d.hop > 0);

    assert.ok(existsSync(join(ROOT, 'public', 'ducks', `${id}.webp`)), `missing atlas ${id}.webp`);
    assert.ok(existsSync(join(ROOT, 'public', 'ducks', `${id}-thumb.webp`)), `missing swatch ${id}-thumb.webp`);

    const ex = DUCK_SHAPE.extras?.[id];
    assert.ok(ex, `missing DUCK_SHAPE.extras['${id}']`);
    assert.ok(ex.triangles > 0 && ex.triangles <= 1500, `${id} triangles ${ex.triangles} must be <= 1500`);
    assert.equal(ex.indices, ex.triangles * 3);
    assert.equal(ex.alwaysIndices + ex.hatIndices, ex.indices);
    assert.equal(ex.hatFirstIndex, ex.firstIndex + ex.alwaysIndices);
  }
  assert.equal(DUCK_SHAPE.extras['14-terrarium'].bodyGlass, true);
  assert.equal(DUCK_SHAPE.extras['22-snow-globe'].bodyGlass, true);
  assert.equal(DUCK_SHAPE.extras['13-teapot'].bodyGlass, false);
});

test('seeded odds: unexpected designs come 1 time in 4 (each unexpected 1/48, each classic 3/48) in pickDesign, spawn and mixUp', () => {
  const R = P.rng(20261114);
  const N = 48000;
  const counts = new Array(24).fill(0);
  for (let i = 0; i < N; i++) counts[pickDesign(R)]++;

  const unexpectedTotal = counts.slice(12).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(unexpectedTotal / N - 0.25) < 0.01, `unexpected ratio ${unexpectedTotal / N} should be ~0.25`);
  for (let i = 0; i < 12; i++) {
    const ratio = counts[i] / N;
    assert.ok(Math.abs(ratio - 3 / 48) < 0.006, `classic ${i} ratio ${ratio} should be ~3/48`);
  }
  for (let i = 12; i < 24; i++) {
    const ratio = counts[i] / N;
    assert.ok(Math.abs(ratio - 1 / 48) < 0.004, `unexpected ${i} ratio ${ratio} should be ~1/48`);
  }

  // World spawn (ducks 12..39) and W.mixUp follow the same seeded odds and W.setColour offers all 24
  const spawnCounts = new Array(24).fill(0);
  const mixCounts = new Array(24).fill(0);
  for (let seed = 1; seed <= 80; seed++) {
    const W = createWorld({ seed, ducks: 40, arrivals: false });
    // First 12 are the 12 classic designs
    assert.deepEqual(new Set(W.ducks.slice(0, 12).map((d) => d.colour)), new Set(Array.from({ length: 12 }, (_, i) => i)));
    for (const d of W.ducks.slice(12)) spawnCounts[d.colour]++;
    W.mixUp();
    for (const d of W.ducks) mixCounts[d.colour]++;
  }
  const spawnTotal = 80 * 28;
  const spawnUnexp = spawnCounts.slice(12).reduce((a, b) => a + b, 0) / spawnTotal;
  assert.ok(Math.abs(spawnUnexp - 0.25) < 0.03, `world spawn unexpected share ${spawnUnexp} should be ~0.25`);

  const mixTotal = 80 * 40;
  const mixUnexp = mixCounts.slice(12).reduce((a, b) => a + b, 0) / mixTotal;
  assert.ok(Math.abs(mixUnexp - 0.25) < 0.025, `mixUp unexpected share ${mixUnexp} should be ~0.25`);

  const W = createWorld({ seed: 3, ducks: 2, arrivals: false });
  for (let c = 0; c < 24; c++) {
    W.selected = W.ducks[0];
    W.setColour(c);
    assert.equal(W.ducks[0].colour, c);
    W.selected = null;
    W.setColour(c);
    assert.equal(W.next.colour, c);
  }
});

test('arrivals: a design not in the pools yet, an unexpected one 1 time in 4 while any is missing, none once every classic is there', () => {
  const R = P.rng(7), classic = (i) => !DESIGNS[i].unexpected;
  let odd = 0;
  for (let n = 0; n < 20000; n++) {
    const here = new Set(Array.from({ length: 24 }, (_, i) => i).filter(() => R() < 0.4));
    if ([...here].filter(classic).length === 12) here.delete(0);
    const c = arrivalDesign(R, here);
    assert.ok(Number.isInteger(c) && !here.has(c), `arrived ${c}, already here`);
    if (!classic(c)) odd++;
  }
  assert.ok(Math.abs(odd / 20000 - 0.25) < 0.015, `unexpected share ${odd / 20000} should be ~0.25`);
  const classics = new Set(Array.from({ length: 12 }, (_, i) => i));
  assert.equal(arrivalDesign(R, classics), null, 'every classic here: no more arrivals');
  const allOdd = new Set(Array.from({ length: 23 }, (_, i) => i + 1));
  assert.equal(arrivalDesign(R, allOdd), 0, 'every unexpected here: the missing classic');
  // a visit's worth: arrivals from the one starting duck till the classics are all there bring some unexpected ducks
  let total = 0, visits = 0;
  for (let seed = 1; seed <= 400; seed++, visits++) {
    const r = P.rng(seed), here = new Set([0]);
    for (let c; (c = arrivalDesign(r, here)) !== null;) here.add(c);
    total += here.size - 12;
  }
  assert.ok(total / visits > 3 && total / visits < 4.5, `unexpected ducks a visit ${total / visits} should be ~3.7`);
});

test('a version-3 book with 12 designs loads into 24 with nothing lost, all-designs means the first 12, and all-unexpected is earned on 13..24', () => {
  const memStore = (initial = null) => ({
    value: initial,
    getItem() { return this.value; },
    setItem(_, v) { this.value = v; },
  });

  const v3Twelve = {
    version: 3,
    pages: Object.fromEntries(COLLECTIBLES.map(({ id }, i) => [id, i === 0 ? { at: 12.5, date: Date.UTC(2026, 10, 5) } : null])),
    pool: [COLLECTIBLES[0].id],
    designs: [1, 2, 3, null, 5, null, 7, 8, null, 10, 11, 12],
    hats: [true, false, true, false, false, true, false],
    stamps: [4, null, 9, null, null, null, null, null, null, null, 15, null],
    records: { bestLap: 24.5, mostLaps: 6, racesWon: 2 },
  };

  const s = memStore(JSON.stringify(v3Twelve));
  const b = createLogbook(s);

  assert.equal(b.designs.length, 24);
  assert.deepEqual(
    b.designs.slice(0, 12).map((d) => d.first),
    v3Twelve.designs,
    'first 12 designs keep their exact timestamps',
  );
  assert.ok(b.designs.slice(12).every((d) => !d.seen && d.first === null), 'new slots 12..23 start empty');
  assert.equal(b.found(COLLECTIBLES[0].id), true);
  assert.deepEqual(b.inPool, [COLLECTIBLES[0].id]);
  assert.deepEqual(b.hats.map((h) => h.worn), v3Twelve.hats);
  assert.deepEqual(b.records, v3Twelve.records);
  assert.equal(b.stamps.length, 13);
  assert.equal(b.stamps.find((x) => x.id === 'first-slide').at, 4);
  assert.equal(b.stamps.find((x) => x.id === 'fireworks').at, 15);
  const unexpStamp = b.stamps.find((x) => x.id === 'all-unexpected');
  assert.deepEqual(unexpStamp, {
    id: 'all-unexpected',
    title: 'A dozen surprises',
    text: 'Meet all twelve unexpected ducks.',
    earned: false,
    at: null,
  });

  // Seeing the remaining 3 classic designs earns all-designs while all 12 unexpected designs are still unseen
  const w = { time: 20, day: { hour: 12 }, ducks: [3, 5, 8].map((c, i) => ({ id: i + 1, name: `D${i}`, colour: c, hat: 0, stats: { laps: 0, bestLap: null, slides: 0, flights: 0, seaTrips: 0, rescued: 0 } })) };
  b.observe(w, []);
  assert.equal(b.stamps.find((x) => x.id === 'all-designs').earned, true);
  assert.equal(b.stamps.find((x) => x.id === 'all-unexpected').earned, false);

  // Seeing 11 of the 12 unexpected designs does not earn all-unexpected yet; the 12th earns it
  w.time = 30;
  w.ducks = Array.from({ length: 11 }, (_, i) => ({ id: 20 + i, name: `U${i}`, colour: 12 + i, hat: 0, stats: { laps: 0, bestLap: null, slides: 0, flights: 0, seaTrips: 0, rescued: 0 } }));
  b.observe(w, []);
  assert.equal(b.stamps.find((x) => x.id === 'all-unexpected').earned, false);

  w.time = 35;
  w.ducks = [{ id: 99, name: 'Lantern', colour: 23, hat: 0, stats: { laps: 0, bestLap: null, slides: 0, flights: 0, seaTrips: 0, rescued: 0 } }];
  b.observe(w, []);
  assert.equal(b.stamps.find((x) => x.id === 'all-unexpected').earned, true);
  assert.equal(b.stamps.find((x) => x.id === 'all-unexpected').at, 35);

  const reloaded = createLogbook(s);
  assert.equal(reloaded.designs.length, 24);
  assert.ok(reloaded.designs.every((d) => d.seen));
  assert.equal(reloaded.stamps.find((x) => x.id === 'all-designs').earned, true);
  assert.equal(reloaded.stamps.find((x) => x.id === 'all-unexpected').earned, true);
});

test('which extras a duck shows by design and hat: head-top extras hide under a hat, lower extras always show', () => {
  // Classic designs 0..9 and 11 have no extras; 10 (11-crown) has only DuckCrown which hides under a hat
  for (let c = 0; c < 12; c++) {
    if (c === 10) {
      assert.deepEqual(visibleExtras(c, 0).map((p) => p.name), ['DuckCrown']);
      assert.deepEqual(visibleExtras(c, 1), []);
    } else {
      assert.deepEqual(visibleExtras(c, 0), []);
      assert.deepEqual(visibleExtras(c, 1), []);
    }
  }

  // Every unexpected design has its own extras; wearing a hat hides only aboveHead parts
  const expectedHatHidden = {
    '13-teapot': ['TeapotBlueMotifs', 'TeapotGoldTrim', 'TeapotPorcelainParts'], // teapot lid
    '14-terrarium': ['TerrariumSprout'], // sprout
    '15-citrus': ['CitrusStemAndLeaf'], // leaf & stem
    '16-cloud': ['CloudPuffSpheres'], // top cloud puff
    '17-bookbinder': [],
    '18-ramen': ['RamenChopsticks', 'RamenNoodles'], // chopsticks & top noodle loop
    '19-moon': [],
    '20-radio': ['RadioBrassParts'], // antenna
    '21-magnet': ['MagnetHornBases', 'MagnetHornTips'], // horns
    '22-snow-globe': ['SnowGlobeStopper'], // stopper
    '23-mosaic': ['FountainCobaltFinial', 'FountainCreamBeads'], // top fountain finial & water arch
    '24-lantern': ['DeepseaLanternBulb', 'DeepseaLanternStalk'], // lantern stalk & bulb
  };

  for (let c = 12; c < 24; c++) {
    const id = DESIGNS[c].id;
    const bare = visibleExtras(c, 0);
    const hatted = visibleExtras(c, 2);
    assert.ok(bare.length > 0, `${id} must show extras when bare`);
    assert.ok(hatted.length > 0, `${id} must still show body/tail/interior extras when wearing a hat`);
    assert.ok(hatted.every((p) => !p.aboveHead), `${id} hatted extras must not include aboveHead parts`);
    const hiddenNames = bare.filter((p) => p.aboveHead).map((p) => p.name).sort();
    assert.deepEqual(hiddenNames, expectedHatHidden[id].slice().sort(), `unexpected hat-hidden parts for ${id}`);
  }

  // Verify in duck.bin that every vertex in [hatVertexStart, glassVertexStart) lies above head.centre[1]
  const raw = readFileSync(join(ROOT, 'public', 'ducks', 'duck.bin'));
  const vBytes = DUCK_SHAPE.vertices * 9 * 4;
  const verts = new Float32Array(raw.buffer, raw.byteOffset, DUCK_SHAPE.vertices * 9);
  const headY = DUCK_SHAPE.head.centre[1];
  for (let vi = DUCK_SHAPE.hatVertexStart; vi < DUCK_SHAPE.glassVertexStart; vi++) {
    const y = verts[vi * 9 + 1];
    assert.ok(y > headY - 1e-3, `hat-hidden vertex ${vi} y=${y} must lie above head centre y=${headY}`);
  }
});

test('poseScene orders duck instances by design and drawDucks issues one base draw plus one drawIndexed per unexpected design run', () => {
  const W = createWorld({ seed: 7, ducks: 10, arrivals: false });
  const { mesh, parts } = buildScene();
  const buf = new Float32Array(parts.duckBase + 40 * 16);

  // Assign a mix of classic and unexpected designs out of order, with and without hats
  const assigned = [
    { colour: 19, hat: 0 }, // 20-radio (unexpected, bare)
    { colour: 2, hat: 1 },  // 03-cherry (classic)
    { colour: 12, hat: 0 }, // 13-teapot (unexpected, bare)
    { colour: 19, hat: 3 }, // 20-radio (unexpected, hatted)
    { colour: 10, hat: 0 }, // 11-crown (classic crown, bare)
    { colour: 10, hat: 2 }, // 11-crown (classic crown, hatted)
    { colour: 12, hat: 0 }, // 13-teapot (unexpected, bare)
    { colour: 21, hat: 0 }, // 22-snow-globe (unexpected, bare)
    { colour: 0, hat: 0 },  // 01-classic
    { colour: 12, hat: 4 }, // 13-teapot (unexpected, hatted)
  ];
  W.ducks.forEach((d, i) => {
    d.colour = assigned[i].colour;
    d.hat = assigned[i].hat;
  });

  const n = poseScene(buf, parts, W);
  assert.equal(n, 10);

  // Check instance buffer order: sorted by colour ascending [0, 2, 10, 10, 12, 12, 12, 19, 19, 21]
  const instColours = [];
  const instCrown = [], instTop = [];
  for (let i = 0; i < n; i++) {
    const at = parts.duckBase + 16 * i;
    instColours.push(buf[at + 12]);
    instCrown.push(buf[at + 13]);
    instTop.push(buf[at + 14]);
  }
  assert.deepEqual(instColours, [0, 2, 10, 10, 12, 12, 12, 19, 19, 21]);
  // ex.y: the gold crown shows only on a bare 11-crown; an unexpected duck never wears it
  assert.deepEqual(instCrown, [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  // ex.z: an unexpected duck's head-top extras show unless it wears a hat
  assert.deepEqual(instTop, [0, 0, 0, 0, 1, 1, 0, 1, 0, 1]);

  // Check runs: only the 3 unexpected designs present (12: 3 instances at 4, 19: 2 instances at 7, 21: 1 instance at 9)
  assert.deepEqual(
    parts.duckRuns.map(({ colour, id, firstInstance, count, firstIndex, indices }) => ({ colour, id, firstInstance, count, firstIndex, indices })),
    [
      {
        colour: 12,
        id: '13-teapot',
        firstInstance: 4,
        count: 3,
        firstIndex: DUCK_SHAPE.extras['13-teapot'].firstIndex,
        indices: DUCK_SHAPE.extras['13-teapot'].indices,
      },
      {
        colour: 19,
        id: '20-radio',
        firstInstance: 7,
        count: 2,
        firstIndex: DUCK_SHAPE.extras['20-radio'].firstIndex,
        indices: DUCK_SHAPE.extras['20-radio'].indices,
      },
      {
        colour: 21,
        id: '22-snow-globe',
        firstInstance: 9,
        count: 1,
        firstIndex: DUCK_SHAPE.extras['22-snow-globe'].firstIndex,
        indices: DUCK_SHAPE.extras['22-snow-globe'].indices,
      },
    ],
  );

  // Verify drawDucks issues 1 base drawIndexed + 1 drawIndexed per unexpected run
  const calls = [];
  const fakePass = {
    drawIndexed(indexCount, instanceCount, firstIndex = 0, baseVertex = 0, firstInstance = 0) {
      calls.push({ indexCount, instanceCount, firstIndex, baseVertex, firstInstance });
    },
  };
  drawDucks(fakePass, { nDucks: n, duckRuns: parts.duckRuns });
  assert.deepEqual(calls, [
    { indexCount: DUCK_SHAPE.baseIndices, instanceCount: 10, firstIndex: 0, baseVertex: 0, firstInstance: 0 },
    { indexCount: DUCK_SHAPE.extras['13-teapot'].indices, instanceCount: 3, firstIndex: DUCK_SHAPE.extras['13-teapot'].firstIndex, baseVertex: 0, firstInstance: 4 },
    { indexCount: DUCK_SHAPE.extras['20-radio'].indices, instanceCount: 2, firstIndex: DUCK_SHAPE.extras['20-radio'].firstIndex, baseVertex: 0, firstInstance: 7 },
    { indexCount: DUCK_SHAPE.extras['22-snow-globe'].indices, instanceCount: 1, firstIndex: DUCK_SHAPE.extras['22-snow-globe'].firstIndex, baseVertex: 0, firstInstance: 9 },
  ]);
});
