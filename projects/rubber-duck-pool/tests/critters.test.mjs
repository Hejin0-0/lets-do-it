import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createCritters, CRITTER, CRITTER_MAX } from '../src/pool/critters.js';
import { P } from '../src/pool/layout.js';
import { isleH, isleSd } from '../src/pool/island.js';
import { PLACEMENTS } from '../src/pool/props.js';
import { PROP_SHAPES } from '../src/pool/prop-shapes.js';
import { budget } from './budget.mjs';
const flowers = PLACEMENTS.filter(p => ['flowerbush', 'oleander', 'potflower'].includes(p.model));
const make = seed => createCritters(P.rng(seed));
const buffer = () => new Float32Array(CRITTER_MAX * 12);
function packed(c) { const b = buffer(); return b.slice(0, c.pack(b, 0) * 12); }
function run(c, seconds, hour) { for (let i = 0; i < seconds * 60; i++) { c.step(1 / 60, hour); c.events.length = 0; } }
function inProp(x, z, p, margin = 0) {
  const b = PROP_SHAPES.models[p.model].bounds, dx = x - p.at[0], dz = z - p.at[2];
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
            else assert.ok(!inProp(x,z,p,.1) || y > p.at[1] + PROP_SHAPES.models[p.model].bounds[1][1] * p.scale + .1);
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
