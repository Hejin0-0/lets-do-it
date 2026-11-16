import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createBlock } from '@lid/diorama/block.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { UO } from '@lid/diorama/renderer.js';
import { P } from '../src/pool/layout.js';
import { POOL_KIT } from '../src/pool/map-kit.js';

// Register before any test dynamically imports props.js so index.js gets GPU/asset stubs while keeping real view.js.
if (!globalThis.__poolSeatViewIndexHook) {
  const loader = `import { readFileSync } from 'node:fs';
  export async function load(url, ctx, next) {
    const base = url.split('?')[0];
    if (base.endsWith('/src/pool/ocean-gpu.js')) return { format: 'module', shortCircuit: true, source: 'export async function createOcean() { return { update() {} }; }' };
    if (base.endsWith('/src/pool/duck-assets.js')) return { format: 'module', shortCircuit: true, source: 'export async function loadDuckAssets() { return {}; }' };
    if (base.endsWith('/src/pool/props.js')) {
      const src = readFileSync(new URL(base), 'utf8').replace('export async function loadProps(', 'export async function _origLoadProps(');
      return { format: 'module', shortCircuit: true, source: src + '\\nexport async function loadProps() { return {}; }' };
    }
    if (base.endsWith('/src/pool/renderer.js')) {
      const src = readFileSync(new URL(base), 'utf8').replace('export function createRenderer(', 'export function _origCreateRenderer(');
      return { format: 'module', shortCircuit: true, source: src + '\\nexport function createRenderer() { return { size: [1280, 720], resize(w, h) { this.size = [w, h]; }, post: { quality: "high", setQuality() {} }, render() {} }; }' };
    }
    return next(url, ctx);
  }`;
  register('data:text/javascript,' + encodeURIComponent(loader));
  globalThis.__poolSeatViewIndexHook = true;
}

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

async function mountPool(t) {
  class El extends EventTarget {
    constructor() {
      super();
      this.dataset = {}; this.style = {}; this.attrs = {}; this.children = []; this.options = []; this.selectedOptions = [];
      this.isConnected = true; this.open = false; this.hidden = false; this.checked = false; this.value = ''; this.textContent = '';
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      this._q = new Map();
      this.clientWidth = 1280; this.clientHeight = 720;
    }
    set innerHTML(_) {}
    get innerHTML() { return ''; }
    setAttribute(k, v) { this.attrs[k] = v; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
    focus() { globalThis.document.activeElement = this; }
    show() { this.open = true; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { this.isConnected = false; }
    append(...xs) { this.children.push(...xs); }
    prepend(...xs) { this.children.unshift(...xs); }
    before() {}
    insertBefore() {}
    closest() { return null; }
    contains() { return false; }
    setPointerCapture() {}
    hasPointerCapture() { return false; }
    releasePointerCapture() {}
    querySelector(sel) {
      if (!this._q.has(sel)) this._q.set(sel, new El());
      return this._q.get(sel);
    }
  }
  let now = 1000;
  const saved = {
    document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia,
    Option: globalThis.Option, ResizeObserver: globalThis.ResizeObserver, performance: globalThis.performance,
  };
  const win = Object.assign(new EventTarget(), {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null, createElement: () => new El() });
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.matchMedia = win.matchMedia;
  globalThis.Option = class { constructor(t = '', v = '') { this.textContent = t; this.value = v; } remove() {} };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.performance = { now: () => now };

  const controller = new AbortController(), root = new El(), canvas = new El();
  t.after(() => {
    controller.abort();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  });

  let hook = null;
  const { mount } = await import(`../src/pool/index.js?t=${Date.now()}-${Math.random()}`);
  await mount({
    canvas, signal: controller.signal, gpu: { device: {} },
    stage: { el: { extra: { querySelector: () => root } }, reduced: { matches: false } },
    frames() {}, hook(h) { hook = h; },
  });
  hook.pause(true);
  hook.render(1, 0);

  const ptr = (type, { id = 1, pointerType = 'mouse', x = 0, y = 0, button = 0 } = {}) => {
    const e = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType, clientX: x, clientY: y, button });
    canvas.dispatchEvent(e);
    return e;
  };
  const aimAt = (p, kind) => {
    hook.cam.target = p.slice(); hook.cam.dist = 3; hook.cam.el = 1.15;
    hook.render(1, 0);
    const pt = hook.toPx(p);
    assert.ok(pt, `expected ${kind} on screen`);
    assert.equal(hook.pick(pt[0], pt[1]), kind, `expected ${kind} at (${pt[0].toFixed(1)}, ${pt[1].toFixed(1)})`);
    return pt;
  };
  return { hook, ptr, aimAt, advance: (dt) => { now += dt; } };
}

test('a press on a chair sits only on a quick, still tap (under 6 px and 300 ms)', async (t) => {
  const { hook, ptr, aimAt, advance } = await mountPool(t);
  const [x, y] = aimAt(hook.spots().seats[0].chair, 'seat');
  ptr('pointerdown', { id: 1, pointerType: 'touch', x, y });
  assert.equal(hook.seating.state.phase, 'standing', 'pointerdown alone must not sit');
  advance(100);
  ptr('pointermove', { id: 1, pointerType: 'touch', x: x + 3, y: y + 3 });
  advance(50);
  ptr('pointerup', { id: 1, pointerType: 'touch', x: x + 3, y: y + 3 });
  assert.equal(hook.seating.state.phase, 'moving');
  assert.equal(hook.seating.state.seat, 0);
});

test('a press on a chair followed by a drag (> 6 px), a second touch (pinch), or pointercancel does not sit', async (t) => {
  const drag = await mountPool(t);
  const [dx, dy] = drag.aimAt(drag.hook.spots().seats[0].chair, 'seat');
  drag.ptr('pointerdown', { id: 1, pointerType: 'mouse', x: dx, y: dy });
  drag.advance(40);
  drag.ptr('pointermove', { id: 1, pointerType: 'mouse', x: dx + 12, y: dy });
  drag.advance(40);
  drag.ptr('pointerup', { id: 1, pointerType: 'mouse', x: dx + 12, y: dy });
  assert.deepEqual(drag.hook.seating.state, { phase: 'standing', seat: null, t: 0 });

  const pinch = await mountPool(t);
  const [px, py] = pinch.aimAt(pinch.hook.spots().seats[0].chair, 'seat');
  pinch.ptr('pointerdown', { id: 1, pointerType: 'touch', x: px, y: py });
  pinch.advance(40);
  pinch.ptr('pointerdown', { id: 2, pointerType: 'touch', x: px + 60, y: py + 20 });
  assert.deepEqual(pinch.hook.seating.state, { phase: 'standing', seat: null, t: 0 });
  pinch.ptr('pointerup', { id: 2, pointerType: 'touch', x: px + 60, y: py + 20 });
  pinch.ptr('pointerup', { id: 1, pointerType: 'touch', x: px, y: py });
  assert.deepEqual(pinch.hook.seating.state, { phase: 'standing', seat: null, t: 0 });

  const cancelled = await mountPool(t);
  const [cx, cy] = cancelled.aimAt(cancelled.hook.spots().seats[0].chair, 'seat');
  cancelled.ptr('pointerdown', { id: 1, pointerType: 'touch', x: cx, y: cy });
  cancelled.advance(40);
  cancelled.ptr('pointercancel', { id: 1, pointerType: 'touch', x: cx, y: cy });
  assert.deepEqual(cancelled.hook.seating.state, { phase: 'standing', seat: null, t: 0 });
});

test('the radio, hourglass, and cooler ignore drags over 6 px and act on a quick press and release', async (t) => {
  const { hook, ptr, aimAt, advance } = await mountPool(t);
  const [rx, ry] = aimAt(hook.spots().radio, 'radio');
  assert.equal(hook.world.station, 0);
  ptr('pointerdown', { id: 1, pointerType: 'mouse', x: rx, y: ry });
  advance(40);
  ptr('pointermove', { id: 1, pointerType: 'mouse', x: rx + 12, y: ry });
  advance(40);
  ptr('pointerup', { id: 1, pointerType: 'mouse', x: rx + 12, y: ry });
  assert.equal(hook.world.station, 0);
  assert.equal(hook.state().station, null);
  ptr('pointerdown', { id: 2, pointerType: 'mouse', x: rx, y: ry });
  advance(50);
  ptr('pointerup', { id: 2, pointerType: 'mouse', x: rx, y: ry });
  assert.equal(hook.world.station, 1);
  assert.equal(hook.state().station, 'Lido FM');

  const [gx, gy] = aimAt(hook.spots().hourglass, 'glass');
  assert.equal(hook.world.glass.turn, 0);
  ptr('pointerdown', { id: 3, pointerType: 'mouse', x: gx, y: gy });
  advance(40);
  ptr('pointermove', { id: 3, pointerType: 'mouse', x: gx + 12, y: gy });
  advance(40);
  ptr('pointerup', { id: 3, pointerType: 'mouse', x: gx + 12, y: gy });
  assert.equal(hook.world.glass.turn, 0);
  ptr('pointerdown', { id: 4, pointerType: 'mouse', x: gx, y: gy });
  advance(50);
  ptr('pointerup', { id: 4, pointerType: 'mouse', x: gx, y: gy });
  assert.ok(hook.world.glass.turn > 0);

  const side = hook.spots().seats[0].side;
  const [cx, cy] = aimAt([side[0], side[1] + 0.1, side[2]], 'cooler');
  assert.equal(hook.world.coolers.isOpen(0), false);
  ptr('pointerdown', { id: 5, pointerType: 'mouse', x: cx, y: cy });
  advance(40);
  ptr('pointermove', { id: 5, pointerType: 'mouse', x: cx + 12, y: cy });
  advance(40);
  ptr('pointerup', { id: 5, pointerType: 'mouse', x: cx + 12, y: cy });
  assert.equal(hook.world.coolers.isOpen(0), false);
  ptr('pointerdown', { id: 6, pointerType: 'mouse', x: cx, y: cy });
  advance(50);
  ptr('pointerup', { id: 6, pointerType: 'mouse', x: cx, y: cy });
  assert.equal(hook.world.coolers.isOpen(0), true);
});

test('a right-drag during the seat flight stands at once, lets the same chair sit again, and never arms the collectible', async (t) => {
  const { hook, ptr, aimAt, advance } = await mountPool(t);
  let armed = 0;
  const origArm = hook.world.collectibles.arm;
  hook.world.collectibles.arm = (...args) => { armed++; return origArm(...args); };

  const chair = hook.spots().seats[0].chair;
  const [x, y] = aimAt(chair, 'seat');
  ptr('pointerdown', { id: 1, pointerType: 'mouse', x, y });
  advance(40);
  ptr('pointerup', { id: 1, pointerType: 'mouse', x, y });
  assert.equal(hook.seating.phase, 'moving');
  assert.equal(hook.seating.seat, 0);

  hook.render(1, 0.1);
  ptr('pointerdown', { id: 2, pointerType: 'mouse', button: 2, x, y });
  advance(40);
  ptr('pointermove', { id: 2, pointerType: 'mouse', button: 2, x: x + 20, y: y + 10 });
  ptr('pointerup', { id: 2, pointerType: 'mouse', button: 2, x: x + 20, y: y + 10 });

  assert.equal(hook.seating.phase, 'standing');
  assert.equal(hook.seating.seat, null);

  hook.render(1, 1 / 60);
  const again = hook.toPx(chair);
  assert.ok(again, 'expected chair in view after right-drag');
  ptr('pointerdown', { id: 3, pointerType: 'mouse', x: again[0], y: again[1] });
  advance(40);
  ptr('pointerup', { id: 3, pointerType: 'mouse', x: again[0], y: again[1] });
  assert.equal(hook.seating.phase, 'moving');
  assert.equal(hook.seating.seat, 0);

  hook.render(1, 0.1);
  ptr('pointerdown', { id: 4, pointerType: 'mouse', button: 2, x: again[0], y: again[1] });
  advance(40);
  ptr('pointermove', { id: 4, pointerType: 'mouse', button: 2, x: again[0] + 20, y: again[1] + 10 });
  ptr('pointerup', { id: 4, pointerType: 'mouse', button: 2, x: again[0] + 20, y: again[1] + 10 });
  assert.equal(hook.seating.phase, 'standing');

  hook.render(12, 0.1);
  assert.equal(hook.seating.phase, 'standing');
  assert.equal(armed, 0);
  assert.ok(hook.world.collectibles.list.every((c) => c.t === null));
});
