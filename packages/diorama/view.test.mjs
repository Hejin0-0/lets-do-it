import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDioramaView } from './view.js';

function makeTarget() {
  const map = new Map();
  return {
    addEventListener(type, fn, opt = {}) {
      if (opt.signal?.aborted) return;
      let list = map.get(type);
      if (!list) map.set(type, (list = []));
      const entry = { fn, once: Boolean(opt.once) };
      list.push(entry);
      opt.signal?.addEventListener('abort', () => {
        const i = list.indexOf(entry);
        if (i >= 0) list.splice(i, 1);
      }, { once: true });
    },
    removeEventListener(type, fn) {
      const list = map.get(type);
      if (!list) return;
      const i = list.findIndex((e) => e.fn === fn);
      if (i >= 0) list.splice(i, 1);
    },
    dispatch(type, event = {}) {
      const list = [...(map.get(type) || [])];
      for (const entry of list) {
        if (entry.once) {
          const cur = map.get(type);
          const i = cur?.indexOf(entry) ?? -1;
          if (i >= 0) cur.splice(i, 1);
        }
        entry.fn(event);
      }
    },
  };
}

function withView(run) {
  const oldWindow = globalThis.window;
  const oldResizeObserver = globalThis.ResizeObserver;
  const oldPerformance = globalThis.performance;
  let now = 1000;
  const win = Object.assign(makeTarget(), {
    devicePixelRatio: 1,
    matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }),
  });
  globalThis.window = win;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.performance = { now: () => now };

  const canvas = Object.assign(makeTarget(), {
    style: { cursor: '' },
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
    setPointerCapture() {},
  });

  const calls = { start: 0, move: 0, end: [], tap: [] };
  const controller = new AbortController();
  const block = {
    toLocal: (v) => v.slice(),
    dirToLocal: (v) => v.slice(),
    toWorld: (v) => v.slice(),
    matrices() {},
    shear: [0, 0],
    squash: 1,
    t: [0, 0],
    grab() {},
    release() {},
    setTarget() {},
  };
  const view = createDioramaView({
    canvas,
    signal: controller.signal,
    renderer: { size: [400, 300], resize() {} },
    block,
    water: { level: 0 },
    sun: { SUN: [0, 1, 0], VP: new Float32Array(16) },
    cam0: { az: 0, el: 0.5, target: [0, 0, 0] },
    fitPoints: [[0, 0, 0]],
    tiltMax: 0.2,
    obstacles: () => [],
    pick: () => ({ kind: 'thing', id: 7 }),
    handlers: {
      thing: {
        start(hit) { calls.start++; return { id: hit.id }; },
        move() { calls.move++; },
        end(s, cancel) { calls.end.push({ id: s.id, cancel }); },
        tap(s) { calls.tap.push({ id: s.id }); },
      },
    },
  });
  view.start();

  try {
    return run({
      canvas,
      calls,
      advance: (dt) => { now += dt; },
      ptr: (type, { id = 1, pointerType = 'touch', x = 100, y = 100, button = 0 } = {}) =>
        canvas.dispatch(type, { pointerId: id, pointerType, clientX: x, clientY: y, button }),
    });
  } finally {
    controller.abort();
    globalThis.window = oldWindow;
    globalThis.ResizeObserver = oldResizeObserver;
    globalThis.performance = oldPerformance;
  }
}

test('(a) pointerdown on a thing then pointerup within 300 ms and under 6 px calls tap once', () => {
  withView(({ ptr, advance, calls }) => {
    ptr('pointerdown', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    advance(50);
    ptr('pointermove', { id: 1, pointerType: 'touch', x: 103, y: 104 });
    advance(50);
    ptr('pointerup', { id: 1, pointerType: 'touch', x: 103, y: 104 });

    assert.equal(calls.tap.length, 1);
    assert.equal(calls.end.length, 0);
  });
});

test('(b) down, move, up calls end with cancel false and no tap', () => {
  withView(({ ptr, advance, calls }) => {
    ptr('pointerdown', { id: 1, pointerType: 'mouse', x: 100, y: 100 });
    advance(40);
    ptr('pointermove', { id: 1, pointerType: 'mouse', x: 120, y: 100 });
    advance(40);
    ptr('pointerup', { id: 1, pointerType: 'mouse', x: 120, y: 100 });

    assert.equal(calls.tap.length, 0);
    assert.deepEqual(calls.end, [{ id: 7, cancel: false }]);
    assert.equal(calls.move, 1);
  });
});

test('(c) touch down on a thing, second touch down within 300 ms cancels with no tap and end(s, true)', () => {
  withView(({ ptr, advance, calls, canvas }) => {
    ptr('pointerdown', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    assert.equal(canvas.style.cursor, 'grabbing');
    advance(40);
    ptr('pointerdown', { id: 2, pointerType: 'touch', x: 160, y: 120 });

    assert.equal(calls.tap.length, 0);
    assert.deepEqual(calls.end, [{ id: 7, cancel: true }]);
    assert.equal(canvas.style.cursor, 'grab');

    // Lifting either finger after pinch must not tap or end the thing a second time.
    ptr('pointerup', { id: 2, pointerType: 'touch', x: 160, y: 120 });
    ptr('pointerup', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    assert.equal(calls.tap.length, 0);
    assert.equal(calls.end.length, 1);
  });

  // Moving first before the second finger lands must put the thing down (cancel: true), not throw it.
  withView(({ ptr, advance, calls }) => {
    ptr('pointerdown', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    advance(40);
    ptr('pointermove', { id: 1, pointerType: 'touch', x: 130, y: 100 });
    advance(40);
    ptr('pointerdown', { id: 2, pointerType: 'touch', x: 160, y: 120 });

    assert.equal(calls.tap.length, 0);
    assert.deepEqual(calls.end, [{ id: 7, cancel: true }]);
  });
});

test('(d) down then pointercancel calls end once with cancel true and no tap', () => {
  withView(({ ptr, advance, calls, canvas }) => {
    ptr('pointerdown', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    advance(40);
    ptr('pointercancel', { id: 1, pointerType: 'touch', x: 100, y: 100 });

    assert.equal(calls.tap.length, 0);
    assert.deepEqual(calls.end, [{ id: 7, cancel: true }]);
    assert.equal(canvas.style.cursor, 'grab');
  });

  withView(({ ptr, advance, calls }) => {
    ptr('pointerdown', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    advance(40);
    ptr('pointermove', { id: 1, pointerType: 'touch', x: 130, y: 100 });
    advance(40);
    ptr('pointercancel', { id: 1, pointerType: 'touch', x: 130, y: 100 });

    assert.equal(calls.tap.length, 0);
    assert.deepEqual(calls.end, [{ id: 7, cancel: true }]);
  });
});

test('(e) down then lostpointercapture calls end once with cancel true and no tap', () => {
  withView(({ ptr, advance, calls, canvas }) => {
    ptr('pointerdown', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    advance(40);
    ptr('lostpointercapture', { id: 1, pointerType: 'touch', x: 100, y: 100 });

    assert.equal(calls.tap.length, 0);
    assert.deepEqual(calls.end, [{ id: 7, cancel: true }]);
    assert.equal(canvas.style.cursor, 'grab');
  });
});

test('(f) down, up, then lostpointercapture produces exactly one tap or one end, nothing after', () => {
  withView(({ ptr, advance, calls }) => {
    ptr('pointerdown', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    advance(40);
    ptr('pointerup', { id: 1, pointerType: 'touch', x: 100, y: 100 });
    ptr('lostpointercapture', { id: 1, pointerType: 'touch', x: 100, y: 100 });

    assert.equal(calls.tap.length, 1);
    assert.equal(calls.end.length, 0);
  });

  withView(({ ptr, advance, calls }) => {
    ptr('pointerdown', { id: 2, pointerType: 'mouse', x: 100, y: 100 });
    advance(40);
    ptr('pointermove', { id: 2, pointerType: 'mouse', x: 120, y: 100 });
    advance(40);
    ptr('pointerup', { id: 2, pointerType: 'mouse', x: 120, y: 100 });
    ptr('lostpointercapture', { id: 2, pointerType: 'mouse', x: 120, y: 100 });

    assert.equal(calls.tap.length, 0);
    assert.deepEqual(calls.end, [{ id: 7, cancel: false }]);
  });
});
