import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlock } from '@lid/diorama/block.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { UO } from '@lid/diorama/renderer.js';
import { P } from '../src/pool/layout.js';

// The page's framing inputs from index.js; the real view computes the lens shift and projects the lid.
const cam0 = { az: .40, el: .65, target: [.8, 1.05, 1.1] };
const fitPoints = [[-6, 1, -5.8], [8.8, 1, -5.8], [-7.5, .8, 8.8], [10, 1, 5.5], [0, 4, -5.4]];

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
