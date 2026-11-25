import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createSanctuaryCameraRig } from '../src/sanctuary/camera-rig.js';

class MockTarget {
  listeners = [];
  addEventListener(type, fn) {
    this.listeners.push({ type, fn });
  }
  removeEventListener(type, fn) {
    this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn));
  }
  fire(type, props = {}) {
    let defaultPrevented = false;
    const ev = {
      type,
      target: this,
      preventDefault() { defaultPrevented = true; },
      ...props,
    };
    for (const l of [...this.listeners]) {
      if (l.type === type) l.fn(ev);
    }
    return defaultPrevented;
  }
}

function makeFixture() {
  const win = new MockTarget();
  const doc = new MockTarget();
  doc.hidden = false;
  const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.08, 900);
  const heroPos = new THREE.Vector3(-0.6, 14.2, 29.5);
  const heroTarget = new THREE.Vector3(0, 1.0, 2.6);
  camera.position.copy(heroPos);
  const controls = {
    enabled: true,
    target: heroTarget.clone(),
    minDistance: 1.2,
    maxDistance: 64,
    updateCalls: 0,
    update() { this.updateCalls++; },
  };
  let resets = 0;
  let muteToggles = 0;
  const rig = createSanctuaryCameraRig({
    windowObj: win,
    documentObj: doc,
    camera,
    controls,
    bounds: { xMin: -18.5, xMax: 17.5, zMin: -14.0, zMax: 23.5 },
    isBlocked: () => !controls.enabled,
    onReset: () => {
      resets++;
      camera.position.copy(heroPos);
      controls.target.copy(heroTarget);
    },
    onToggleMute: () => { muteToggles++; },
  });
  return { win, doc, camera, controls, rig, stats: () => ({ resets, muteToggles }) };
}

test('WASD walks relative to camera azimuth while preserving camera distance, and Shift sprints', () => {
  const { win, camera, controls, rig } = makeFixture();
  const dist0 = camera.position.distanceTo(controls.target);
  const z0 = controls.target.z;

  assert.equal(win.fire('keydown', { code: 'KeyW', key: 'w' }), true);
  rig.frame(0.1);
  win.fire('keyup', { code: 'KeyW', key: 'w' });

  const walkStep = z0 - controls.target.z;
  assert.ok(walkStep > 0.05, 'KeyW moves target forward into the sanctuary');
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - dist0) < 1e-5, 'camera distance stays constant while walking');

  const z1 = controls.target.z;
  win.fire('keydown', { code: 'ShiftLeft', key: 'Shift' });
  win.fire('keydown', { code: 'KeyW', key: 'w' });
  rig.frame(0.1);
  win.fire('keyup', { code: 'KeyW', key: 'w' });
  win.fire('keyup', { code: 'ShiftLeft', key: 'Shift' });

  const sprintStep = z1 - controls.target.z;
  assert.ok(sprintStep > walkStep * 1.9, 'Shift sprints faster than walking');
});

test('arrow keys orbit/tilt, minus/plus zoom within limits, R resets, M mutes, and inputs/blur are respected', () => {
  const { win, doc, camera, controls, rig, stats } = makeFixture();

  const x0 = camera.position.x;
  assert.equal(win.fire('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }), true);
  rig.frame(0.1);
  win.fire('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' });
  assert.notEqual(camera.position.x, x0, 'ArrowLeft orbits camera azimuth');

  const dBeforeZoom = camera.position.distanceTo(controls.target);
  assert.equal(win.fire('keydown', { code: 'Equal', key: '+' }), true);
  rig.frame(0.1);
  win.fire('keyup', { code: 'Equal', key: '+' });
  assert.ok(camera.position.distanceTo(controls.target) < dBeforeZoom, '+ zooms closer');

  assert.equal(win.fire('keydown', { code: 'Minus', key: '-' }), true);
  rig.frame(0.05);
  rig.frame(0.05);
  win.fire('keyup', { code: 'Minus', key: '-' });
  assert.ok(camera.position.distanceTo(controls.target) > dBeforeZoom, '- zooms out');

  // Typing inside an <input> must never move camera or mute audio
  const inputTarget = { tagName: 'INPUT', closest: (sel) => (sel.includes('input') ? {} : null) };
  const snapPos = camera.position.clone();
  assert.equal(win.fire('keydown', { code: 'KeyW', key: 'w', target: inputTarget }), false);
  assert.equal(win.fire('keydown', { code: 'KeyM', key: 'm', target: inputTarget }), false);
  rig.frame(0.1);
  assert.deepEqual(camera.position.toArray(), snapPos.toArray());
  assert.equal(stats().muteToggles, 0);

  // KeyM toggles sound mute; KeyR resets view and clears held keys; blur clears held state
  assert.equal(win.fire('keydown', { code: 'KeyM', key: 'm' }), true);
  assert.equal(stats().muteToggles, 1);

  win.fire('keydown', { code: 'KeyD', key: 'd' });
  rig.frame(0.1);
  assert.notEqual(controls.target.x, 0);
  assert.equal(win.fire('keydown', { code: 'KeyR', key: 'r' }), true);
  assert.equal(stats().resets, 1);
  assert.equal(controls.target.x, 0);

  win.fire('keydown', { code: 'KeyA', key: 'a' });
  win.fire('blur');
  rig.frame(0.1);
  assert.equal(controls.target.x, 0, 'blur clears held movement keys');

  win.fire('keydown', { code: 'KeyA', key: 'a' });
  doc.hidden = true;
  doc.fire('visibilitychange');
  rig.frame(0.1);
  assert.equal(controls.target.x, 0, 'hidden visibilitychange clears held movement keys');
  rig.dispose();
});
