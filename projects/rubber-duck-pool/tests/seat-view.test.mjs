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

test('visit items appear offshore, reachable, in the open and within the sea chair frame at both sizes', async () => {
  const { createWorld, inSight, COLLECTIBLE_DISTANCE, COLLECTIBLE_SHORE_MARGIN, COLLECTIBLE_VIEW_CONE } = await import('../src/pool/world.js');
  const { SEA_VIEW_OCCLUDERS } = await import('../src/pool/props.js');
  assert.ok(SEA_VIEW_OCCLUDERS.length > 10);
  const { isleSd } = await import('../src/pool/island.js');
  const { reachable } = await import('../src/pool/rescue.js');
  const oldWindow=globalThis.window, oldObserver=globalThis.ResizeObserver;
  globalThis.window=new EventTarget(); globalThis.ResizeObserver=class { observe() {} disconnect() {} };
  try {
    const views=[];
    for (const [width,height] of [[1600,900],[1280,720]]) {
      const canvas=new EventTarget(); canvas.style={}; canvas.getBoundingClientRect=()=>({width,height});
      const controller=new AbortController();
      const view=createDioramaView({canvas,signal:controller.signal,renderer:{size:[width,height],resize(){}},
        block:createBlock({half:P.HALF,tiltMax:P.TILT_MAX,g:P.G}),water:{level:P.LU},sun:sunSetup(),cam0,fitPoints,tiltMax:P.TILT_MAX,far:6000,obstacles:()=>[]});
      view.start(); view.lookFrom(P.SEATS[1].eye,P.SEATS[1].look); view.frame(1.1,new Float32Array(UO.SIZE),0);
      views.push({view,width,height,controller});
    }
    const seat=P.SEATS[1], direction=[seat.look[0]-seat.eye[0],seat.look[2]-seat.eye[2]], world=createWorld({seed:3,ducks:0,arrivals:false,occluders:SEA_VIEW_OCCLUDERS}), seen=new Set();
    for(let visit=0;visit<24;visit++) {
      world.reset({visit}); world.collectibles.arm(); for(let s=0;s<46 && !world.collectibles.adrift.length;s++) world.step(120);
      const [item]=world.collectibles.adrift; assert.ok(item,`visit ${visit}`); seen.add(item.id);
      const [x,z]=item.at, dx=x-seat.eye[0], dz=z-seat.eye[2], distance=Math.hypot(dx,dz);
      assert.ok(distance>=COLLECTIBLE_DISTANCE[0] && distance<=COLLECTIBLE_DISTANCE[1]);
      const dot=dx*direction[0]+dz*direction[1], cross=dx*direction[1]-dz*direction[0];
      assert.ok(dot>0 && Math.abs(Math.atan2(cross,dot))<=COLLECTIBLE_VIEW_CONE);
      assert.ok(isleSd(x,z)>=COLLECTIBLE_SHORE_MARGIN && reachable(item.at) && inSight(item.at,SEA_VIEW_OCCLUDERS),`visit ${visit}`);
      for (const {view,width,height} of views) for (const sx of [-.3,.3]) for (const sy of [-.3,.3]) for (const sz of [-.3,.3]) {
        const p=view.toPx([x+sx,P.SEA+sy,z+sz]);
        assert.ok(p && p[0]>=.1*width && p[0]<=.9*width && p[1]>=.1*height && p[1]<=.9*height,`${visit} at ${width}x${height}: ${p}`);
      }
    }
    assert.equal(seen.size,6); // reset discards the uncollected item and selects again
    views.forEach(({controller})=>controller.abort());
  } finally { globalThis.window=oldWindow; globalThis.ResizeObserver=oldObserver; }
});

test('fitted 900x900 view with the page points and zoom keeps all fit points inside the frame', () => {
  const oldWindow = globalThis.window, oldObserver = globalThis.ResizeObserver;
  globalThis.window = new EventTarget();
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    const width = 900, height = 900;
    const canvas = new EventTarget();
    canvas.style = {};
    canvas.getBoundingClientRect = () => ({ width, height });
    const controller = new AbortController();
    const view = createDioramaView({ canvas, signal: controller.signal, renderer: { size: [width, height], resize() {} },
      block: createBlock({ half: P.HALF, tiltMax: P.TILT_MAX, g: P.G }), water: { level: P.LU },
      sun: sunSetup(), cam0, fitPoints, tiltMax: P.TILT_MAX, far: 6000, minDist: 1.8, maxDist: 42, obstacles: () => [] });
    view.start();
    view.frame(0, new Float32Array(UO.SIZE), 0);
    assert.ok(view.fitDist > 28 && view.fitDist <= 42, `expected fitDist in (28, 42], got ${view.fitDist}`);
    for (const point of fitPoints) {
      const px = view.toPx(point);
      assert.ok(px && px[0] >= 12 && px[0] <= width - 12 && px[1] >= 12 && px[1] <= height - 12,
        `fitPoint ${JSON.stringify(point)} outside 12px margin: ${JSON.stringify(px)}`);
    }
    controller.abort();
  } finally {
    globalThis.window = oldWindow;
    globalThis.ResizeObserver = oldObserver;
  }
});

test('devicePixelRatio change calls renderer.resize with the new pixel size and stops on abort', () => {
  const oldWindow = globalThis.window, oldObserver = globalThis.ResizeObserver;
  const lists = new Map();
  const win = new EventTarget();
  win.devicePixelRatio = 1;
  win.matchMedia = (query) => {
    const mql = Object.assign(new EventTarget(), { media: query, matches: true });
    lists.set(query, mql);
    return mql;
  };
  globalThis.window = win;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    const resizes = [];
    const canvas = new EventTarget();
    canvas.style = {};
    canvas.getBoundingClientRect = () => ({ width: 800, height: 600 });
    const controller = new AbortController();
    const renderer = { size: [800, 600], resize(w, h) { this.size = [w, h]; resizes.push([w, h]); } };
    const view = createDioramaView({ canvas, signal: controller.signal, renderer,
      block: createBlock({ half: P.HALF, tiltMax: P.TILT_MAX, g: P.G }), water: { level: P.LU },
      sun: sunSetup(), cam0, fitPoints, tiltMax: P.TILT_MAX, far: 6000, maxDpr: 2, obstacles: () => [] });
    view.start();
    assert.deepEqual(resizes, [[800, 600]]);
    assert.ok(lists.has('(resolution: 1dppx)'), 'expected initial matchMedia listener for 1dppx');

    win.devicePixelRatio = 2;
    lists.get('(resolution: 1dppx)').dispatchEvent(new Event('change'));
    assert.deepEqual(resizes, [[800, 600], [1600, 1200]]);
    assert.ok(lists.has('(resolution: 2dppx)'), 'expected re-armed matchMedia listener for 2dppx');

    win.devicePixelRatio = 1.5;
    lists.get('(resolution: 2dppx)').dispatchEvent(new Event('change'));
    assert.deepEqual(resizes, [[800, 600], [1600, 1200], [1200, 900]]);
    assert.ok(lists.has('(resolution: 1.5dppx)'), 'expected re-armed matchMedia listener for 1.5dppx');

    controller.abort();
    win.devicePixelRatio = 1;
    lists.get('(resolution: 1.5dppx)').dispatchEvent(new Event('change'));
    assert.equal(resizes.length, 3);
  } finally {
    globalThis.window = oldWindow;
    globalThis.ResizeObserver = oldObserver;
  }
});
