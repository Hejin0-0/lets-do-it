import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleSanctuaryCircuit, CIRCUIT_STAGES } from '../src/sanctuary/circulation.js';

test('sanctuary duck circuit is C0-continuous across all 6 stages and wrap-around without scale fading', () => {
  const N = 2000;
  let prev = sampleSanctuaryCircuit(0, 0, 0);
  let maxStep = 0;
  const seenStages = [];

  for (let i = 1; i <= N; i++) {
    const u = i / N;
    const cur = sampleSanctuaryCircuit(u, 0, 0);
    assert.ok(Number.isFinite(cur.x) && Number.isFinite(cur.y) && Number.isFinite(cur.z), `finite pose at u=${u}`);
    assert.equal(cur.scale, 1.0, `scale stays full 1.0 (no pop-in/fade-out spawn) at u=${u}`);

    const d = Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
    if (d > maxStep) maxStep = d;
    if (seenStages[seenStages.length - 1] !== cur.stage) seenStages.push(cur.stage);
    prev = cur;
  }

  // Wrap-around from u = 1.0 back to u = 0.0 must be seamless (no 8m slide respawn jump).
  const wrapJump = Math.hypot(
    prev.x - sampleSanctuaryCircuit(0, 0, 0).x,
    prev.y - sampleSanctuaryCircuit(0, 0, 0).y,
    prev.z - sampleSanctuaryCircuit(0, 0, 0).z,
  );

  assert.ok(maxStep < 0.20, `expected continuous motion without teleports, max step was ${maxStep.toFixed(4)}m`);
  assert.ok(wrapJump < 0.02, `expected closed loop at u=1->0, wrap gap was ${wrapJump.toFixed(4)}m`);
  // Stages traverse in exact physical order (upper_pool -> slide -> grotto -> intake_channel -> siphon_lift -> return_tube -> upper_pool)
  const expectedOrder = CIRCUIT_STAGES.map((s) => s.name);
  assert.deepEqual(seenStages.slice(0, expectedOrder.length), expectedOrder);
});

test('upper pool and grotto segments stay clear of flamingo, palm float, and grotto swim ring', () => {
  const obstacles = [
    { name: 'flamingo', bx: 3.6, by: 2.2, r: 1.30, stage: 'upper_pool' },
    { name: 'palm_island', bx: 9.2, by: 4.1, r: 1.15, stage: 'upper_pool' },
    { name: 'grotto_aqua_ring', bx: -1.2, by: -14.8, r: 0.80, stage: 'grotto' },
  ];

  for (let i = 0; i < 600; i++) {
    const u = i / 600;
    const cur = sampleSanctuaryCircuit(u, 0, 0);
    // Convert Three.js (x, y, z) back to Blender (bx = x, by = -z)
    const bx = cur.x;
    const by = -cur.z;
    for (const ob of obstacles) {
      if (cur.stage !== ob.stage) continue;
      const dist = Math.hypot(bx - ob.bx, by - ob.by);
      assert.ok(dist > ob.r, `duck clipped ${ob.name} at u=${u.toFixed(3)} (dist=${dist.toFixed(2)}m <= ${ob.r}m)`);
    }
  }
});
