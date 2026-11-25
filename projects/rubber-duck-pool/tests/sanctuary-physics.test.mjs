import test from 'node:test';
import assert from 'node:assert/strict';
import { createSanctuaryPhysics, DUCK_TRAITS } from '../src/sanctuary/physics.js';
import { DESIGNS } from '../src/pool/ducks.js';

const DT = 1 / 60;
const UPPER = { x0: -5.8, x1: 9.8, y0: -2.9, y1: 6.2 };
const GROTTO = { cx: 0.2, cy: -13.2, r: 3.55 };
const FLOATS = [
  { stage: 'upper_pool', bx: 3.6, by: 2.2, r: 1.30 },
  { stage: 'upper_pool', bx: 9.2, by: 4.1, r: 1.15 },
  { stage: 'upper_pool', bx: -1.8, by: 4.4, r: 0.75 },
  { stage: 'upper_pool', bx: 1.6, by: -1.6, r: 0.75 },
  { stage: 'upper_pool', bx: 7.6, by: -1.5, r: 0.55 },
  { stage: 'grotto', bx: 0.2, by: -13.2, r: 1.45 },
];
const LOOP = ['upper_pool', 'slide', 'grotto', 'intake_channel', 'siphon_lift', 'return_tube', 'upper_pool'];
const designs = DESIGNS.map((d) => d.id);

function run(sim, seconds, each = () => {}) {
  const steps = Math.round(seconds / DT);
  for (let k = 1; k <= steps; k++) each(sim.step(DT, k * DT), k * DT);
}

function pair(anchorDesign, mode = 'roam') {
  const sim = createSanctuaryPhysics({ seed: 7, mode });
  sim.addDuck({ id: 'anchor', designId: anchorDesign, initialStage: 'upper_pool', x: -3.5, z: -1.0 });
  sim.addDuck({ id: 'neighbor', designId: '01-classic', initialStage: 'upper_pool', x: -2.3, z: -1.0 });
  return sim;
}
const gap = (sim) => { const [a, b] = sim.getDucks(); return Math.hypot(a.x - b.x, a.z - b.z); };

test('every design, the hearth specials and custom ducks have physical traits', () => {
  for (const id of [...designs, 'golden_smore', 'charred_ember', 'custom']) {
    const tr = DUCK_TRAITS[id];
    assert.ok(tr, `${id} has traits`);
    assert.ok(tr.mass > 0 && tr.speedScale > 0 && tr.buoyancy > 0, `${id} traits are positive`);
    assert.ok(['standard', 'fast', 'magnet', 'crown', 'hearth', 'nocturnal', 'bouncy'].includes(tr.trait), `${id} trait ${tr.trait}`);
  }
});

test('a dozen ducks in the pools knock into each other: real impulse collisions over a minute', () => {
  const sim = createSanctuaryPhysics({ seed: 4201 });
  for (let i = 0; i < 12; i++) sim.addDuck({ id: i, designId: designs[(i * 5) % designs.length], u: (i / 12) * 0.36 });
  const impulses = [];
  run(sim, 60, (events) => { for (const e of events) if (e.type === 'collision') impulses.push(e.impulse); });
  const stats = sim.getStats();
  assert.ok(stats.collisionCount >= 10, `expected >= 10 collisions in 60 s, got ${stats.collisionCount}`);
  assert.equal(impulses.length, stats.collisionCount);
  assert.ok(impulses.every((j) => Number.isFinite(j) && j > 0), 'every collision carries a positive impulse');
  assert.ok(stats.recentCollisions.length > 0 && stats.recentCollisions.length <= 16);
});

test('a magnet duck draws a neighbor closer than a plain duck in its place does', () => {
  const magnet = pair('21-magnet');
  const control = pair('01-classic');
  const start = gap(magnet);
  run(magnet, 3);
  run(control, 3);
  const dm = gap(magnet), dc = gap(control);
  assert.ok(dm < dc - 0.15, `magnet gap ${dm.toFixed(3)} m should be well under control gap ${dc.toFixed(3)} m (start ${start.toFixed(2)} m)`);
});

test('a radial wave pushes nearby ducks away from where it starts', () => {
  const waved = pair('01-classic');
  const calm = pair('01-classic');
  const n = waved.applyRadialWave(-2.9, -1.0, 1.5, 1.2);
  assert.equal(n, 2);
  waved.step(DT, DT);
  assert.ok(waved.getDucks()[0].hopY > 0, 'the wave lifts the duck it reaches');
  run(waved, 0.5);
  run(calm, 0.5);
  assert.ok(gap(waved) > gap(calm) + 0.2, `waved gap ${gap(waved).toFixed(3)} m vs calm ${gap(calm).toFixed(3)} m`);
});

test('ducks ride the whole loop back to the Upper Pool, finite, in bounds and without a pop', () => {
  const sim = createSanctuaryPhysics({ seed: 4201 });
  for (let i = 0; i < 6; i++) sim.addDuck({ id: i, designId: designs[i * 4], u: (i / 6) * 0.36 });
  const seqs = Array.from({ length: 6 }, () => []);
  let prev = sim.getDucks().map((d) => [d.x, d.y, d.z]);
  let maxStep = 0;
  run(sim, 240, (_, t) => {
    sim.getDucks().forEach((d, i) => {
      for (const k of ['x', 'y', 'z', 'vx', 'vz', 'yaw', 'pitch', 'roll']) assert.ok(Number.isFinite(d[k]), `${k} finite at t=${t}`);
      assert.equal(d.scale, 1);
      const bx = d.x, by = -d.z;
      if (d.stage === 'upper_pool') {
        assert.ok(bx >= UPPER.x0 && bx <= UPPER.x1 && by >= UPPER.y0 && by <= UPPER.y1, `duck ${i} left the Upper Pool at (${bx.toFixed(2)}, ${by.toFixed(2)}) t=${t}`);
      } else if (d.stage === 'grotto') {
        assert.ok(Math.hypot(bx - GROTTO.cx, by - GROTTO.cy) <= GROTTO.r + 0.05, `duck ${i} left the Grotto at t=${t}`);
      }
      for (const f of FLOATS) {
        if (f.stage !== d.stage) continue;
        assert.ok(Math.hypot(bx - f.bx, by - f.by) > f.r, `duck ${i} sank into the float at (${f.bx}, ${f.by}) t=${t}`);
      }
      maxStep = Math.max(maxStep, Math.hypot(d.x - prev[i][0], d.y - prev[i][1], d.z - prev[i][2]));
      prev[i] = [d.x, d.y, d.z];
      if (seqs[i].at(-1) !== d.stage) seqs[i].push(d.stage);
    });
  });
  sim.getDucks().forEach((d, i) => {
    assert.ok(d.lapCount >= 1, `duck ${i} finished ${d.lapCount} laps in 240 s`);
    assert.deepEqual(seqs[i].slice(0, LOOP.length), LOOP, `duck ${i} went ${seqs[i].slice(0, 8).join(' > ')}`);
  });
  assert.ok(maxStep < 0.2, `largest move in one frame was ${maxStep.toFixed(3)} m`);
  assert.equal(sim.getStats().lapsCompleted, sim.getDucks().reduce((s, d) => s + d.lapCount, 0));
});

test('a fast duck on the slide overtakes a plain one ahead of it', () => {
  const sim = createSanctuaryPhysics({ seed: 3 });
  sim.addDuck({ id: 'plain', designId: '01-classic', initialStage: 'slide', u: 0.402 });
  sim.addDuck({ id: 'fast', designId: '05-lightning', initialStage: 'slide', u: 0.400 });
  const overtakes = [];
  run(sim, 4, (events) => { for (const e of events) if (e.type === 'overtake') overtakes.push(e); });
  assert.ok(overtakes.some((e) => e.id === 'fast' && e.passed === 'plain'), `overtakes: ${JSON.stringify(overtakes)}`);
  assert.ok(sim.getStats().overtakeCount >= 1);
});

test('hearth ducks steam, nocturnal ducks glow by the night level, and a hop lifts a duck', () => {
  const sim = createSanctuaryPhysics({ seed: 1 });
  sim.addDuck({ id: 'tea', designId: '13-teapot', initialStage: 'upper_pool', x: -3, z: -1 });
  sim.addDuck({ id: 'moon', designId: '19-moon', initialStage: 'upper_pool', x: -4, z: -1 });
  sim.addDuck({ id: 'plain', designId: '01-classic', initialStage: 'upper_pool', x: -3, z: -3 });
  assert.equal(sim.applyImpulse('plain', 0.5, 0, 0.25), true);
  sim.step(DT, DT, { night: 0.7 });
  const [tea, moon, plain] = sim.getDucks();
  assert.equal(tea.emitSteam, true);
  assert.equal(moon.emitSteam, false);
  assert.equal(moon.glowStrength, 0.7);
  assert.equal(tea.glowStrength, 0);
  run(sim, 0.15);
  assert.ok(plain.hopY > 0.05, `hop height ${plain.hopY}`);
  assert.ok(plain.vx > 0.2, `impulse velocity ${plain.vx}`);
});

test('the same seed replays the same run', () => {
  const make = () => {
    const sim = createSanctuaryPhysics({ seed: 99 });
    for (let i = 0; i < 8; i++) sim.addDuck({ id: i, designId: designs[i * 3] });
    run(sim, 20);
    return sim.getDucks().map((d) => [d.x, d.z, d.stage]);
  };
  assert.deepEqual(make(), make());
});

test('hand grab lifts a pool duck, flings it with momentum, drops onto the copper slide weir, and cancels cleanly', () => {
  const sim = createSanctuaryPhysics({ seed: 11 });
  sim.addDuck({ id: 'flung', designId: '01-classic', initialStage: 'upper_pool', x: 1.0, z: -1.5 });
  sim.addDuck({ id: 'slider', designId: '02-mint', initialStage: 'upper_pool', x: 0.5, z: -0.5 });

  assert.equal(sim.grabDuck('flung'), true);
  assert.equal(sim.moveGrabbedDuck('flung', -1.8, -1.0), true);
  sim.step(DT, DT);
  const held = sim.getDucks().find((d) => d.id === 'flung');
  assert.ok(held.hopY > 0.2, 'grabbed duck is lifted above the water surface');

  // Release with eastward velocity across open water -> carries forward momentum
  const rel = sim.releaseGrabbedDuck('flung', 3.2, 0.0);
  assert.equal(rel.launchedSlide, false);
  sim.step(DT, DT * 2);
  assert.ok(held.vx > 1.0, `flung duck carries forward velocity (${held.vx.toFixed(2)} m/s)`);

  // Cancel grab drops gently in place with zero throw velocity
  assert.equal(sim.grabDuck('flung'), true);
  sim.moveGrabbedDuck('flung', 1.2, -1.2);
  assert.equal(sim.cancelGrab('flung'), true);
  sim.step(DT, DT * 3);
  assert.ok(Math.hypot(held.vx, held.vz) < 0.35, 'cancelled grab does not fling the duck');

  // Dropping a grabbed duck onto the Copper Slide Weir mouth (-0.90, z ~ +3.1) launches it straight onto the slide!
  assert.equal(sim.grabDuck('slider'), true);
  sim.moveGrabbedDuck('slider', -0.88, 3.10);
  const slideRel = sim.releaseGrabbedDuck('slider', 0, 0);
  assert.equal(slideRel.launchedSlide, true);
  sim.step(DT, DT * 4);
  const slider = sim.getDucks().find((d) => d.id === 'slider');
  assert.equal(slider.stage, 'slide');
});
