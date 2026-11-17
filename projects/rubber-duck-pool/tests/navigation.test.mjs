import test from 'node:test';
import assert from 'node:assert/strict';
import { installNavigation } from '../src/pool/navigation.js';
import { createSeating } from '../src/pool/seating.js';
import { createWorld } from '../src/pool/world.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { UO } from '@lid/diorama/renderer.js';
import { createBlock } from '@lid/diorama/block.js';

// Capture listeners run before the engine's previously registered bubble listeners.
class Surface {
  listeners = []; style = {}; classList = { toggle() {} }; clientHeight = 800;
  addEventListener(type, fn, options = {}) {
    const item = { type, fn, capture: !!options.capture }; this.listeners.push(item);
    options.signal?.addEventListener('abort', () => { this.listeners = this.listeners.filter(v => v !== item); }, { once: true });
  }
  fire(type, props = {}) {
    const e = { type, target: this, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; }, ...props };
    for (const capture of [true, false]) for (const l of [...this.listeners]) if (!e.stopped && l.type === type && l.capture === capture) l.fn(e);
  }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: this.clientHeight }; }
}
function setup(t, engine = true) {
  const saved = Object.fromEntries(['window', 'document', 'ResizeObserver'].map(k => [k, globalThis[k]]));
  globalThis.window = new Surface(); globalThis.document = new Surface();
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const controller = new AbortController(), canvas = new Surface();
  const block = createBlock({ half: 5, tiltMax: 0.17, g: 9.8 });
  const view = engine ? createDioramaView({ canvas, signal: controller.signal, block, water: { level: 0 }, sun: sunSetup(), renderer: { size: [1000, 800] },
    cam0: { az: 0, el: 0.7, target: [0, 0, 0] }, obstacles: () => [], pick: () => null }) :
    { cam: { az: 0, el: 0.7, target: [0, 0, 0], dist: 10, fov: 0.6 }, lookFrom(_e, target) { this.cam.target = target.slice(); } };
  view.cam.dist = 10;
  let moves = 0, resets = 0;
  const nav = installNavigation({ canvas, signal: controller.signal, view, block, onMove: () => moves++, onReset: () => resets++ });
  const fire = (type, id, x = 100, y = 200, pointerType = 'touch') => canvas.fire(type, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 });
  t.after(() => { controller.abort(); for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } });
  return { canvas, view, fire, controller, nav, stats: () => ({ moves, resets }) };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test('wheel events in one frame zoom as far as events in separate frames', t => {
  const { canvas, view } = setup(t), U = new Float32Array(UO.SIZE);
  for (let i = 0; i < 5; i++) { canvas.fire('wheel', { deltaY: -100, deltaMode: 0 }); view.frame(1 / 60, U, 0); }
  const expected = view.cam.dist;
  view.cam.dist = 10;
  for (let i = 0; i < 5; i++) canvas.fire('wheel', { deltaY: -100, deltaMode: 0 });
  view.frame(1 / 60, U, 0);
  assert.ok(Math.abs(view.cam.dist - expected) < 1e-6, `${view.cam.dist} != ${expected}`);
});
for (const button of [0, 1]) test(`${button === 0 ? 'Shift' : 'middle button'} drag moves in one frame add up to the full drag`, t => {
  const { canvas, view } = setup(t), U = new Float32Array(UO.SIZE);
  canvas.fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 200, pointerType: 'mouse', button, shiftKey: button === 0 });
  canvas.fire('pointermove', { pointerId: 1, clientX: 250, clientY: 200 });
  view.frame(1 / 60, U, 0);
  const expected = view.cam.target.slice(), k = 20 * Math.tan(view.cam.fov / 2) / 800;
  near(expected[0], -150 * k);
  view.cam.target = [0, 0, 0];
  canvas.fire('pointerup', { pointerId: 1 });
  canvas.fire('pointerdown', { pointerId: 2, clientX: 100, clientY: 200, pointerType: 'mouse', button, shiftKey: button === 0 });
  for (const x of [150, 200, 250]) canvas.fire('pointermove', { pointerId: 2, clientX: x, clientY: 200 });
  view.frame(1 / 60, U, 0);
  view.cam.target.forEach((v, i) => near(v, expected[i]));
});
test('WASD walking keeps its distance, sprint and diagonal speed after each view frame', t => {
  const { view, nav } = setup(t), U = new Float32Array(UO.SIZE);
  for (const [codes, dt, expected] of [
    [['KeyW'], 1 / 60, [0, 0, -0.03]], [['KeyA'], 1 / 60, [-0.03, 0, 0]],
    [['KeyS'], 1 / 60, [0, 0, 0.03]], [['KeyD'], 1 / 60, [0.03, 0, 0]],
    [['KeyW', 'KeyD', 'ShiftLeft'], 1 / 60, [0.075 / Math.SQRT2, 0, -0.075 / Math.SQRT2]],
    [['KeyW'], 1, [0, 0, -0.09]],
  ]) {
    view.cam.target = [0, 0, 0];
    for (const code of codes) window.fire('keydown', { code });
    nav.frame(dt); view.frame(dt, U, 0);
    view.cam.target.forEach((v, i) => near(v, expected[i])); near(view.cam.dist, 10);
    for (const code of codes) window.fire('keyup', { code });
  }
});
test('two touches translate by camera scale and keep distance with alternating engine pinch updates', t => {
  const { view, fire } = setup(t), k = 2 * view.cam.dist * Math.tan(view.cam.fov / 2) / 800;
  fire('pointerdown', 1, 100, 200); fire('pointerdown', 2, 200, 200);
  for (let i = 1; i <= 10; i++) { fire('pointermove', 1, 100 + i * 4, 200 + i * 2); fire('pointermove', 2, 200 + i * 4, 200 + i * 2); }
  near(view.cam.target[0], -40 * k); near(view.cam.target[2], -20 * k); near(view.cam.dist, 10);
});
test('real view pinch halves distance without translating a stationary midpoint', t => {
  const { view, fire } = setup(t);
  fire('pointerdown', 1, 100, 200); fire('pointerdown', 2, 200, 200);
  fire('pointermove', 1, 50, 200); fire('pointermove', 2, 250, 200);
  near(view.cam.dist, 5); assert.deepEqual(view.cam.target, [0, 0, 0]);
});
test('a third finger stops the slide and the pinch; once it lifts, the two left go on from where they are', t => {
  const { view, fire } = setup(t);
  fire('pointerdown', 1); fire('pointerdown', 2, 200); fire('pointerdown', 3, 300);
  fire('pointermove', 1, 130); assert.deepEqual(view.cam.target, [0, 0, 0]); near(view.cam.dist, 10);
  fire('pointerup', 3); assert.deepEqual(view.cam.target, [0, 0, 0]); near(view.cam.dist, 10);
  fire('pointermove', 2, 230); assert.ok(view.cam.target[0] < 0); near(view.cam.dist, 7);
});
for (const end of ['pointerup', 'pointercancel', 'lostpointercapture']) test(`${end} stops slide; landing again rebases`, t => {
  const { view, fire } = setup(t, false);
  fire('pointerdown', 1); fire('pointerdown', 2, 200); fire(end, 2);
  fire('pointermove', 1, 140); assert.deepEqual(view.cam.target, [0, 0, 0]);
  fire('pointerdown', 2, 240); fire('pointermove', 2, 240); assert.deepEqual(view.cam.target, [0, 0, 0]);
  fire('pointermove', 1, 150); assert.ok(view.cam.target[0] < 0);
});
test('mouse pointers never count as navigation fingers', t => {
  const { view, fire } = setup(t, false);
  fire('pointerdown', 1); fire('pointerdown', 2, 200, 200, 'mouse');
  fire('pointermove', 1, 140); fire('pointermove', 2, 240, 200, 'mouse'); assert.deepEqual(view.cam.target, [0, 0, 0]);
});
for (const end of ['blur', 'abort']) test(`${end} clears touch state`, t => {
  const { view, fire, controller } = setup(t, false);
  fire('pointerdown', 1); fire('pointerdown', 2, 200);
  if (end === 'abort') controller.abort(); else window.fire('blur');
  fire('pointermove', 1, 140); assert.deepEqual(view.cam.target, [0, 0, 0]);
});
test('a lifted touch landing again restarts the real view pinch without a jump', t => {
  const { view, fire } = setup(t);
  fire('pointerdown', 1); fire('pointerdown', 2, 200); fire('pointerup', 2);
  fire('pointermove', 1, 140); fire('pointerdown', 2, 240);
  fire('pointermove', 2, 240); near(view.cam.dist, 10); assert.deepEqual(view.cam.target, [0, 0, 0]);
  fire('pointermove', 1, 150); fire('pointermove', 2, 250); near(view.cam.dist, 10); assert.ok(view.cam.target[0] < 0);
});
test('pan rotates with camera azimuth and uses the canvas CSS height', t => {
  const { view, canvas, fire } = setup(t); canvas.clientHeight = 400; view.cam.az = Math.PI / 2;
  const k = 20 * Math.tan(view.cam.fov / 2) / 400;
  fire('pointerdown', 1); fire('pointerdown', 2, 200);
  fire('pointermove', 1, 110, 220); fire('pointermove', 2, 210, 220);
  near(view.cam.target[0], -20 * k); near(view.cam.target[2], 10 * k); near(view.cam.dist, 10);
});
test('KeyR cancels an active Shift+drag pan, and nav.clear on sit stops held WASD', t => {
  const { canvas, view, nav, stats } = setup(t, false);
  canvas.fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 200, pointerType: 'mouse', button: 0, shiftKey: true });
  assert.equal(canvas.style.cursor, 'grabbing');
  const afterDown = stats().moves, targetBefore = view.cam.target.slice();
  window.fire('keydown', { code: 'KeyR' });
  assert.equal(stats().resets, 1);
  assert.equal(canvas.style.cursor, 'grab');
  canvas.fire('pointermove', { pointerId: 1, clientX: 150, clientY: 240, pointerType: 'mouse' });
  assert.deepEqual(view.cam.target, targetBefore);
  assert.equal(stats().moves, afterDown);

  const seating = createSeating({ seats: [{ eye: [0, 1, 0], look: [0, 0, 0] }] });
  seating.on(e => { if (e.type === 'sit') nav.clear(); });
  window.fire('keydown', { code: 'KeyW' });
  assert.equal(seating.sit(0), true);
  nav.frame(1 / 60);
  assert.equal(stats().moves, afterDown);
  assert.deepEqual(view.cam.target, targetBefore);
  assert.equal(seating.phase, 'moving');
});

test('blur, hidden visibilitychange and view.cancel end a duck grab without tap or throw and clear pinch state', t => {
  const saved = Object.fromEntries(['window', 'document', 'ResizeObserver'].map(k => [k, globalThis[k]]));
  globalThis.window = new Surface(); globalThis.document = new Surface(); document.hidden = false;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const controller = new AbortController(), canvas = new Surface();
  const world = createWorld({ seed: 5, ducks: 1, arrivals: false });
  world.step(120);
  const duck = world.ducks[0];
  let taps = 0, pick = null;
  const bodies = { ...world.hand, tap(b) { taps++; world.hand.tap(b); } };
  const view = createDioramaView({
    canvas, signal: controller.signal, renderer: { size: [1000, 800], resize() {} },
    block: world.block, water: world.water, sun: sunSetup(),
    cam0: { az: 0.4, el: 0.65, target: [0.8, 1.05, 1.1] }, fitPoints: [[-5, 1, -5], [5, 1, 5]], tiltMax: 0.17,
    obstacles: () => [], pick: () => pick, bodies,
  });
  view.start();
  view.frame(0, new Float32Array(UO.SIZE), 0);
  const fire = (type, id, x = 500, y = 400, pointerType = 'touch') =>
    canvas.fire(type, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 });
  t.after(() => { controller.abort(); for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } });

  for (const [k, kind] of ['blur', 'visibilitychange', 'cancel'].entries()) {
    const id = k + 1;
    world.events.length = 0;
    pick = { kind: 'body', body: duck.body, t: 1 };
    fire('pointerdown', id, 500, 400);
    assert.equal(duck.body.state, 'held');
    assert.equal(canvas.style.cursor, 'grabbing');
    if (kind === 'visibilitychange') {
      fire('pointermove', id, 580, 340);
      document.hidden = false;
      document.fire('visibilitychange');
      assert.equal(duck.body.state, 'held');
      document.hidden = true;
      document.fire('visibilitychange');
      document.hidden = false;
    } else if (kind === 'blur') {
      window.fire('blur');
    } else {
      assert.equal(typeof view.cancel, 'function');
      view.cancel();
    }
    assert.equal(duck.body.state, 'free');
    assert.deepEqual(duck.body.v, [0, 0, 0]);
    assert.equal(taps, 0);
    assert.equal(world.events.some(e => e.type === 'voice' || e.type === 'plop'), false);
    assert.equal(canvas.style.cursor, 'grab');

    const posBefore = duck.body.p.slice(), distBefore = view.cam.dist, azBefore = view.cam.az, elBefore = view.cam.el;
    fire('pointermove', id, 640, 300);
    assert.equal(duck.body.state, 'free');
    assert.deepEqual(duck.body.p, posBefore);
    near(view.cam.dist, distBefore); near(view.cam.az, azBefore); near(view.cam.el, elBefore);

    pick = null;
    fire('pointerdown', id + 10, 200, 200);
    fire('pointermove', id + 10, 280, 200);
    near(view.cam.dist, distBefore);
    fire('pointerup', id + 10, 280, 200);

    for (let i = 0; i < 120 * 3; i++) world.step();
    assert.ok(duck.body.submerged > 0, `${kind}: duck returned to the water`);
  }

  pick = { kind: 'block', point: [0, 0, 0] };
  fire('pointerdown', 99, 500, 400);
  assert.equal(world.block.held, true);
  view.cancel();
  assert.equal(world.block.held, false);
  assert.equal(canvas.style.cursor, 'grab');

  pick = { kind: 'body', body: duck.body, t: 1 };
  fire('pointermove', 0, 500, 400, 'mouse');
  view.frame(0, new Float32Array(UO.SIZE), 0);
  assert.equal(canvas.style.cursor, 'pointer');
  view.cancel();
  assert.equal(canvas.style.cursor, 'grab');
  view.frame(0, new Float32Array(UO.SIZE), 0);
  assert.equal(canvas.style.cursor, 'grab');

  fire('pointerdown', 100, 500, 400);
  fire('pointerup', 100, 500, 400);
  assert.equal(taps, 1);
  assert.equal(duck.body.state, 'free');
});
