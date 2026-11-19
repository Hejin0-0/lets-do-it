import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createCritters, CRITTER, CRITTER_MAX } from '../src/pool/critters.js';
import { P } from '../src/pool/layout.js';
import { isleH, isleSd } from '../src/pool/island.js';
import { PLACEMENTS } from '../src/pool/props.js';
import { PROP_SHAPES } from '../src/pool/prop-shapes.js';
import { SAMPLING_SHAPES } from '../src/pool/sampling-shapes.js';
import { LOOKDEV_SHAPES } from '../src/pool/lookdev-shapes.js';
import { budget } from './budget.mjs';
import { garbage } from './garbage.mjs';
const drawn = { ...PROP_SHAPES.models, ...SAMPLING_SHAPES.models, ...LOOKDEV_SHAPES.models };   // a later table wins, as in props.js load()
const flowers = PLACEMENTS.filter(p => ['flowerbush', 'oleander', 'potflower'].includes(p.model));
const make = seed => createCritters(P.rng(seed));
const buffer = () => new Float32Array(CRITTER_MAX * 12);
function packed(c) { const b = buffer(); return b.slice(0, c.pack(b, 0) * 12); }
function run(c, seconds, hour) { for (let i = 0; i < seconds * 60; i++) { c.step(1 / 60, hour); c.events.length = 0; } }
function inProp(x, z, p, margin = 0) {
  const b = drawn[p.model].bounds, dx = x - p.at[0], dz = z - p.at[2];
  const a = (Math.cos(p.yaw) * dx - Math.sin(p.yaw) * dz) / p.scale;
  const d = (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / p.scale;
  return a > b[0][0] - margin && a < b[1][0] + margin && d > b[0][2] - margin && d < b[1][2] + margin;
}

test('same seed replays 60 seconds including events; pack honours float offset', () => {
  const a = make(17), b = make(17);
  for (let i = 0; i < 3600; i++) {
    a.step(1 / 60, 12); b.step(1 / 60, 12);
    assert.deepEqual(a.events, b.events); a.events.length = b.events.length = 0;
  }
  assert.deepEqual(packed(a), packed(b));
  const out = new Float32Array((CRITTER_MAX + 2) * 12).fill(-99), n = a.pack(out, 12);
  assert.equal(n, a.count); assert.deepEqual(out.slice(12, 12 + n * 12), packed(a));
  assert.ok(out.slice(0, 12).every(v => v === -99)); assert.ok(out.slice(12 + n * 12).every(v => v === -99));
  const c = make(18); run(c, 60, 12); assert.notDeepEqual(packed(a), packed(c));
});

test('day and night residents fade continuously, fireflies blink and butterflies settle', () => {
  const c = make(5); run(c, 10, 12);
  let b = packed(c);
  for (let i = 0; i < b.length; i += 12) if (b[i + 8] !== CRITTER.fish)
    assert.equal(b[i + 7] > .5, b[i + 8] !== CRITTER.firefly);
  c.step(1 / 60, 22); let next = packed(c);
  for (let i = 0; i < 43 * 12; i += 12) assert.ok(Math.abs(next[i + 7] - b[i + 7]) < .02);
  run(c, 10, 22); b = packed(c);
  for (let i = 0; i < 43 * 12; i += 12) assert.equal(b[i + 7] > .5, b[i + 8] === CRITTER.firefly);
  let lit = false, dark = false, settled = false, flying = false;
  for (let k = 0; k < 1800; k++) {
    c.step(1 / 60, 22); next = packed(c);
    lit ||= next[13 * 12 + 11] > .8; dark ||= next[13 * 12 + 11] === 0;
    const speed = ((next[5 * 12 + 10] - b[5 * 12 + 10] + 1) % 1) * 60;
    settled ||= speed < .5; flying ||= speed > 5; b = next; c.events.length = 0;
  }
  assert.ok(lit && dark && settled && flying);
});

test('settle makes night residents match the next afternoon immediately and on the next step', () => {
  const c = make(11); run(c, 10, 22);
  const check = night => {
    const b = packed(c);
    for (let i = 0; i < b.length; i += 12) if (b[i + 8] !== CRITTER.fish)
      assert.equal(b[i + 7], (b[i + 8] === CRITTER.firefly) === night ? 1 : 0);
  };
  check(true); c.settle(15); check(false);
  c.step(1 / 60, 15); check(false);
});

test('ten minutes: bounded finite sprites, safe zones, complete deep-water fish arcs', () => {
  for (const seed of [3, 5, 7]) {
    const c = make(seed), b = buffer(); let jump = null, leaps = 0, maxHeight = 0, up = false, down = false;
    for (let frame = 0; frame < 600 * 30; frame++) {
      c.step(1 / 30, frame < 9000 ? 12 : 22);
      const n = c.pack(b, 0); assert.equal(n, c.count); assert.ok(n <= CRITTER_MAX);
      for (let i = 0; i < n * 12; i += 12) {
        const [x, y, z, size, r, g, blue, alpha, shape, turn, flap, glow] = b.subarray(i, i + 12);
        assert.ok([x,y,z,size,r,g,blue,alpha,shape,turn,flap,glow].every(Number.isFinite));
        assert.ok(alpha >= 0 && alpha <= 1 && flap >= 0 && flap <= 1 && glow >= 0 && glow <= 1);
        if (shape === CRITTER.gull) {
          assert.ok(y > 2.5 && y - P.SEA >= 3 && y - P.SEA <= 6);
          assert.ok(isleSd(x,z) > 0 || (z > P.FRONT && isleH(x,z) <= P.BEACH + .05));
          assert.ok(P.mainD(x,z) > 0 && P.roundD(x,z) > 0);
          assert.ok(!(x > P.WALL_L - .2 && x < P.HALF && z > P.WALL_B - .2 && z < P.COLS + .2));
          assert.ok(!(Math.abs(x - P.WALL_L) < .2 && z > P.WALL_B && z < P.FRONT));
          for (const p of PLACEMENTS.filter(p => ['poolhouse','palm','palm2'].includes(p.model))) {
            if (p.model === 'poolhouse') assert.ok(!inProp(x,z,p,.1));
            else assert.ok(!inProp(x,z,p,.1) || y > p.at[1] + drawn[p.model].bounds[1][1] * p.scale + .1);
          }
        } else if (shape === CRITTER.butterfly) {
          assert.ok(flowers.some(p => Math.hypot(x-p.at[0],z-p.at[2]) < 1.5));
          assert.ok(y - isleH(x,z) >= .149 && y - isleH(x,z) <= .901);
        } else if (shape === CRITTER.firefly) {
          assert.ok(isleSd(x,z) < 0); assert.ok(y-isleH(x,z) >= .099 && y-isleH(x,z) <= 1.201);
        } else {
          assert.ok(isleSd(x,z) > 0 && isleH(x,z) < P.SEA - .18);
          maxHeight = Math.max(maxHeight, y-P.SEA); up ||= turn > .1; down ||= turn < -.1;
        }
      }
      for (const e of c.events) {
        assert.ok(isleSd(e.x,e.z) > 0 && isleH(e.x,e.z) < P.SEA - .18);
        if (e.type === 'fishJump') { assert.equal(jump,null); jump = e; }
        else { assert.equal(e.type,'fishSplash'); assert.ok(jump); assert.ok(Math.abs(Math.hypot(e.x-jump.x,e.z-jump.z)-.6)<1e-6); jump=null; leaps++; }
      }
      c.events.length = 0;
    }
    assert.ok(leaps > 25 && maxHeight > .29 && maxHeight <= .301 && up && down);
  }
});

test('large dt preserves paired fish events and night leaps are rarer', () => {
  const day = make(11), night = make(11);
  day.step(600,12); night.step(600,22);
  assert.ok(day.events.length > night.events.length * 2);
  for (const c of [day,night]) c.events.forEach((e,i) => assert.equal(e.type, i % 2 ? 'fishSplash' : 'fishJump'));
});

test('day fish launch every 4 to 10 seconds, including flight time', () => {
  const c = make(23); let last = null, jumps = 0;
  for (let i = 1; i <= 18000; i++) {
    c.step(1 / 30, 12);
    for (const e of c.events) if (e.type === 'fishJump') {
      if (last !== null) assert.ok((i-last)/30 >= 4-1/30 && (i-last)/30 <= 10+1/30);
      last = i; jumps++;
    }
    c.events.length = 0;
  }
  assert.ok(jumps > 50);
});

test('initial sprites are finite even with a constant caller RNG', () => {
  const c = createCritters(() => 0);
  assert.ok(packed(c).every(Number.isFinite));
  for (let i = 0; i < 5 * 12; i += 12) assert.ok(packed(c)[i+1] > 2.5);
});

test('all critters step within budget(0.2) ms', t => {
  const c = make(4); run(c, 10, 12);
  const start = performance.now(), steps = 20000;
  for (let i = 0; i < steps; i++) { c.step(1 / 60, 22); c.events.length = 0; }
  const ms = (performance.now() - start) / steps;
  t.diagnostic(`${ms.toFixed(4)} ms per step; limit ${budget(.2)} ms`);
  assert.ok(ms < budget(.2), `${ms.toFixed(4)} ms per step`);
});

test('pack after 600 steps at hours 12, 18 and 22, fish + extra gulls, and isleH 1681-point grid stay bit-identical', () => {
  const sha = b => createHash('sha256').update(new Uint8Array(b.buffer, b.byteOffset, b.byteLength)).digest('hex');
  const expected = [
    [12, 'ff6c028eb953dacb77da794847acce4dbced7e1e1906528ab8786d95826b5b72'],
    [18, '5fe1a41e6d65be7dfbff05818e72b539963ac52ed2386a823199f35b5765da66'],
    [22, '1189710ad9f5d056400b431d4565c931a24092d65e389c7a6df38e7582f91ffe'],
  ];
  for (const [hour, digest] of expected) {
    const c = make(11); run(c, 10, hour);
    const b = buffer(), n = c.pack(b, 0);
    assert.equal(sha(b.subarray(0, n * 12)), digest, `hour ${hour}`);
  }
  const cf = make(11);
  for (let i = 0; i < 435; i++) { cf.step(1 / 60, 12); cf.events.length = 0; }
  const extra = [{ p: [1, 4, 2], flap: .3, alpha: .9 }, { p: [-2, 4.5, -1], flap: .7, alpha: .6 }];
  const bf = buffer(), nf = cf.pack(bf, 0, extra);
  assert.equal(nf, 46);
  assert.equal(sha(bf.subarray(0, nf * 12)), '65bdada524b8ee31a1dbcf5e2962ef7c2ec22491a1e70f0ba4122beae638690f');
  const many = Array.from({ length: 60 }, (_, i) => ({ p: [i, 3, -i], flap: .2, alpha: .8 }));
  const capped = new Float32Array((CRITTER_MAX + 2) * 12).fill(-99), nc = cf.pack(capped, 12, many);
  assert.equal(nc, CRITTER_MAX);
  assert.equal(capped[12 + (CRITTER_MAX - 1) * 12 + 8], CRITTER.fish);
  assert.ok(capped.subarray(0, 12).every(v => v === -99));
  assert.ok(capped.subarray(12 + CRITTER_MAX * 12).every(v => v === -99));
  const grid = new Float64Array(41 * 41);
  let k = 0;
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) grid[k++] = isleH(i * 0.5, j * 0.5);
  assert.equal(k, 1681);
  assert.equal(sha(grid), 'ac45c528974f11d83db003c63dfa7ea038622cd4604a1209e71dd1a2b53b2f4b');
});

// Observe mode: printed, not asserted. The same pack() measures about 0.1 KB a call when V8 has it optimized and about
// 8 KB (516 floats boxed) when it does not, and which one a run gets depends on the machine's load (4 of 16 parallel
// runs failed a 4 KB limit). The floats themselves are asserted above.
test('pack with two extra gulls: garbage per call when warmed (observe)', t => {
  const c = make(11);
  for (let i = 0; i < 435; i++) { c.step(1 / 60, 12); c.events.length = 0; }
  const buf = buffer(), extra = [{ p: [1, 4, 2], flap: .3, alpha: .9 }, { p: [-2, 4.5, -1], flap: .7, alpha: .6 }];
  const runPack = () => c.pack(buf, 0, extra);
  for (let i = 0; i < 1000; i++) runPack();
  const bytes = garbage(runPack, 20);
  t.diagnostic(`pack: ${bytes.toFixed(1)} B/call (observe; about 8.3 KB if run interpreted)`);
});

test('step and isleH garbage observation (before t7/daylight)', t => {
  const c = make(11); run(c, 10, 12);
  const runStep = () => { c.step(1 / 60, 12); c.events.length = 0; };
  for (let i = 0; i < 1000; i++) runStep();
  const stepBytes = garbage(runStep, 10);
  const runIsleOut = () => isleH(6.0, 2.5);
  const runIsleEdge = () => isleH(5.4, 2.5);
  for (let i = 0; i < 1000; i++) { runIsleOut(); runIsleEdge(); }
  const isleOutBytes = garbage(runIsleOut, 20);
  const isleEdgeBytes = garbage(runIsleEdge, 20);
  t.diagnostic(`step: ${stepBytes.toFixed(1)} B/call; isleH(outside): ${isleOutBytes.toFixed(1)} B/call; isleH(edge): ${isleEdgeBytes.toFixed(1)} B/call`);
});
