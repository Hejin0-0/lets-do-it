import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDuckPoseController,
  MONOGRAPH_CAMERA_SCRIPTS,
  sampleWaterPovCameraBob,
} from '../src/sanctuary/duck-poses.js';

test('duck pose controller drives all 4 monograph action poses (hatch, dive, happy_splash, sleep)', () => {
  const ctrl = createDuckPoseController();

  // 1. Hatch pose: cracked eggshell separates and returns to idle
  ctrl.triggerPose('duck-1', 'hatch', 1.2);
  let p = ctrl.sample('duck-1', 0.3, 0);
  assert.equal(p.pose, 'hatch');
  assert.ok(p.eggProgress > 0 && p.eggProgress < 1);
  assert.ok(p.scaleY > 1.0);

  // 2. Dive pose: head pitches steeply downward (+1.0+ rad) while tail rises
  ctrl.triggerPose('duck-2', 'dive', 1.6);
  p = ctrl.sample('duck-2', 0.6, 0);
  assert.equal(p.pose, 'dive');
  assert.ok(p.pitchOffset > 0.9, 'diving duck should pitch nose-down');
  assert.ok(p.yOffset < 0, 'diving duck dips into water');

  // 3. Happy Splash pose: crescent smile eyes and cheerful flap roll
  ctrl.triggerPose('duck-3', 'happy_splash', 1.1);
  p = ctrl.sample('duck-3', 0.25, 0);
  assert.equal(p.pose, 'happy_splash');
  assert.equal(p.happyEyes, true);
  assert.ok(p.yOffset > 0);

  // 4. Sleep pose: 0.4 Hz gentle breathing pulse and closed peaceful eyes + Zzz signal
  ctrl.triggerPose('duck-4', 'sleep', 4.0);
  const s1 = ctrl.sample('duck-4', 0.625, 0); // sin(2*pi*0.4*0.625) = sin(pi/2) = +1
  const s2 = ctrl.sample('duck-4', 1.875, 0); // sin(2*pi*0.4*1.875) = sin(3*pi/2) = -1
  assert.equal(s1.pose, 'sleep');
  assert.equal(s1.sleepingEyes, true);
  assert.ok(s1.breathScale > s2.breathScale, '0.4Hz sleep breathing should expand and contract');
});

test('all 4 official monograph camera & lighting scripts match published hours and FOVs', () => {
  assert.equal(MONOGRAPH_CAMERA_SCRIPTS.length, 4);
  const byId = Object.fromEntries(MONOGRAPH_CAMERA_SCRIPTS.map((s) => [s.id, s]));
  assert.equal(byId.water_pov.hour, 8.5);
  assert.equal(byId.water_pov.fov, 42);
  assert.equal(byId.isometric.hour, 13.0);
  assert.equal(byId.isometric.fov, 28);
  assert.equal(byId.study_pov.hour, 17.75);
  assert.equal(byId.study_pov.fov, 50);
  assert.equal(byId.nocturnal.hour, 22.5);
  assert.equal(byId.nocturnal.fov, 45);
});

test('equation-driven water POV camera bob is deterministic for fixed seed and oscillates gently', () => {
  const a1 = sampleWaterPovCameraBob(1.25, 1922);
  const a2 = sampleWaterPovCameraBob(1.25, 1922);
  const b1 = sampleWaterPovCameraBob(2.65, 1922);
  assert.deepEqual(a1, a2);
  assert.ok(Math.abs(a1.dy - b1.dy) > 0.005);
  assert.ok(Math.abs(a1.dy) <= 0.03 && Math.abs(a1.dx) <= 0.02);
});
