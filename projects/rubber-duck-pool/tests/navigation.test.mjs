import test from 'node:test';
import assert from 'node:assert/strict';
import { installNavigation } from '../src/pool/navigation.js';
import { createDioramaView } from '@lid/diorama/view.js';

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
  const block = { toLocal: v => v, dirToLocal: v => v, toWorld: v => v };
  const view = engine ? createDioramaView({ canvas, signal: controller.signal, block, water: {}, renderer: {},
    cam0: { az: 0, el: 0.7, target: [0, 0, 0] }, obstacles: () => [], pick: () => null }) :
    { cam: { az: 0, el: 0.7, target: [0, 0, 0], dist: 10, fov: 0.6 }, lookFrom() {} };
  view.cam.dist = 10;
  installNavigation({ canvas, signal: controller.signal, view, block, onMove() {}, onReset() {} });
  const fire = (type, id, x = 100, y = 200, pointerType = 'touch') => canvas.fire(type, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0 });
  t.after(() => { controller.abort(); for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } });
  return { canvas, view, fire, controller };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
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
test('third finger stops translation until a fresh two-finger gesture', t => {
  const { view, fire } = setup(t);
  fire('pointerdown', 1); fire('pointerdown', 2, 200); fire('pointerdown', 3, 300);
  fire('pointermove', 1, 130); fire('pointerup', 3); fire('pointermove', 2, 230);
  assert.deepEqual(view.cam.target, [0, 0, 0]);
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
