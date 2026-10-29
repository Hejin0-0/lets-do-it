import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlock } from '@lid/diorama/block.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { UO } from '@lid/diorama/renderer.js';
import { P } from '../src/pool/layout.js';
import { POOL_KIT } from '../src/pool/map-kit.js';

// The page's framing inputs from index.js; the real view computes the lens shift and projects the lid.
const cam0 = { az: .40, el: .65, target: [.8, 1.05, 1.1] };
const fitPoints = [[-6, 1, -5.8], [8.8, 1, -5.8], [-7.5, .8, 8.8], [10, 1, 5.5], [0, 4, -5.4]];

test("the pool chair's view is clear of the ladder", () => {
  const oldWindow = globalThis.window, oldObserver = globalThis.ResizeObserver;
  globalThis.window = new EventTarget();
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    for (const [width, height] of [[1600, 900], [1280, 720]]) {
      const canvas = new EventTarget();
      canvas.style = {};
      canvas.getBoundingClientRect = () => ({ width, height });
      const controller = new AbortController();
      const view = createDioramaView({ canvas, signal: controller.signal, renderer: { size: [width, height], resize() {} },
        block: createBlock({ half: P.HALF, tiltMax: P.TILT_MAX, g: P.G }), water: { level: P.LU },
        sun: sunSetup(), cam0, fitPoints, tiltMax: P.TILT_MAX, far: 6000, obstacles: () => [] });
      view.start();
      view.lookFrom(P.SEATS[0].eye, P.SEATS[0].look);
      view.frame(1.1, new Float32Array(UO.SIZE), 0);
      // Enclose both ladder tubes and the adjacent pool coping down to the submerged base.
      const L = P.SIZE.ladder, x = P.MAIN[2], z = -.6 * P.K;
      const corners = [];
      for (const dx of [-.04 * L, .07 * L]) for (const y of [P.LU - .5, P.TER + .104 * L])
        for (const dz of [-.05 * L, .05 * L]) corners.push(view.toPx([x + dx, y, z + dz]));
      // All corners behind the camera, or all on the same outside edge, excludes the whole convex box.
      assert.ok(corners.every(p => !p) || corners.every(p => p && p[0] < 0) || corners.every(p => p && p[0] > width),
        `${width}x${height}: ladder and adjacent coping ${JSON.stringify(corners)}`);
      // The separate pool entry steps are in the fitted basin, not part of the ladder.
      for (const [z, h] of POOL_KIT.steps) {
        const steps = [];
        for (const x of [POOL_KIT.stepX - POOL_KIT.stepWidth / 2, POOL_KIT.stepX + POOL_KIT.stepWidth / 2])
          for (const y of [POOL_KIT.floor, POOL_KIT.floor + h])
            for (const d of [z - POOL_KIT.stepDepth / 2, z + POOL_KIT.stepDepth / 2])
              steps.push(view.toPx([P.POOL.at[0] + x * P.POOL.scale[0], P.POOL.at[1] + y * P.POOL.scale[1], P.POOL.at[2] - d * P.POOL.scale[2]]));
        assert.ok(steps.every(p => p && p[0] < .45 * width), `${width}x${height}: entry step ${JSON.stringify(steps)}`);
      }
      controller.abort();
    }
  } finally {
    globalThis.window = oldWindow;
    globalThis.ResizeObserver = oldObserver;
  }
});

test('each seat cooler lid stays inside the seated 16:9 view with a 10% margin', () => {
  const oldWindow = globalThis.window, oldObserver = globalThis.ResizeObserver;
  globalThis.window = new EventTarget();
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    const outside = [];
    for (const [width, height] of [[1600, 900], [1280, 720]]) {
      const canvas = new EventTarget();
      canvas.style = {};
      canvas.getBoundingClientRect = () => ({ width, height });
      const controller = new AbortController();
      const renderer = { size: [width, height], resize() {} };
      const view = createDioramaView({ canvas, signal: controller.signal, renderer,
        block: createBlock({ half: P.HALF, tiltMax: P.TILT_MAX, g: P.G }), water: { level: P.LU },
        sun: sunSetup(), cam0, fitPoints, tiltMax: P.TILT_MAX, far: 6000, obstacles: () => [] });
      view.start();
      for (const seat of P.SEATS) {
        view.lookFrom(seat.eye, seat.look);
        view.frame(1.1, new Float32Array(UO.SIZE), 0);
        const point = view.toPx([seat.side[0], seat.y + .2, seat.side[1]]);
        if (!point || point[0] < .1 * width || point[0] > .9 * width || point[1] < .1 * height || point[1] > .9 * height)
          outside.push(`${seat.id} at ${width}x${height}: ${point}`);
      }
      controller.abort();
    }
    assert.deepEqual(outside, [], outside.join('; '));
  } finally {
    globalThis.window = oldWindow;
    globalThis.ResizeObserver = oldObserver;
  }
});
