import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createBlock } from '@lid/diorama/block.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { UO } from '@lid/diorama/renderer.js';
import { P } from '../src/pool/layout.js';
import { POOL_KIT } from '../src/pool/map-kit.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';
import { MOORING, reachable } from '../src/pool/rescue.js';

// Register before any test dynamically imports props.js so index.js gets GPU/asset stubs while keeping real view.js.
if (!globalThis.__poolSeatViewIndexHook) {
  const loader = `import { readFileSync } from 'node:fs';
  export async function load(url, ctx, next) {
    const base = url.split('?')[0];
    if (base.endsWith('/src/pool/ocean-gpu.js')) return { format: 'module', shortCircuit: true, source: 'export async function createOcean() { await globalThis.__poolLoad?.("ocean"); return { update() {} }; }' };
    if (base.endsWith('/src/pool/duck-assets.js')) return { format: 'module', shortCircuit: true, source: 'export async function loadDuckAssets() { await globalThis.__poolLoad?.("ducks"); return {}; }' };
    if (base.endsWith('/src/pool/props.js')) {
      const src = readFileSync(new URL(base), 'utf8').replace('export async function loadProps(', 'export async function _origLoadProps(');
      return { format: 'module', shortCircuit: true, source: src + '\\nexport async function loadProps() { await globalThis.__poolLoad?.("props"); return {}; }' };
    }
    if (base.endsWith('/src/pool/renderer.js')) {
      const src = readFileSync(new URL(base), 'utf8').replace('export function createRenderer(', 'export function _origCreateRenderer(');
      return { format: 'module', shortCircuit: true, source: src + '\\nexport async function createRenderer() { await globalThis.__poolLoad?.("renderer"); return { size: [1280, 720], resize(w, h) { this.size = [w, h]; }, post: { quality: "high", setQuality() {} }, render() {} }; }' };
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

async function mountPool(t, abortAt) {
  class El extends EventTarget {
    constructor() {
      super();
      this.dataset = {}; this.style = {}; this.attrs = {}; this.children = []; this.options = []; this.selectedOptions = [];
      this.isConnected = true; this.open = false; this.hidden = false; this.checked = false; this.value = ''; this.textContent = '';
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      this._q = new Map();
      this.clientWidth = 1280; this.clientHeight = 720;
      this.offsetWidth = 200; this.offsetHeight = 200;
    }
    set innerHTML(_) {}
    get innerHTML() { return ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
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
    _find(sel) {
      if (this._q.has(sel)) return this._q.get(sel);
      for (const c of [...this.children, ...this._q.values()]) { const hit = c._find(sel); if (hit) return hit; }
      return null;
    }
    querySelector(sel) {
      const hit = this._find(sel);
      if (hit) return hit;
      const el = new El();
      this._q.set(sel, el);
      return el;
    }
  }
  let now = 1000;
  const saved = {
    document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia,
    Option: globalThis.Option, ResizeObserver: globalThis.ResizeObserver, performance: globalThis.performance,
    innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight, __poolLoad: globalThis.__poolLoad,
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
  const observing = new Set();
  globalThis.ResizeObserver = class { observe() { observing.add(this); } disconnect() { observing.delete(this); } };
  globalThis.performance = { now: () => now };
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;

  const controller = new AbortController(), root = new El(), canvas = new El();
  t.after(() => {
    controller.abort();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  });

  let hook = null, frames = 0, hooks = 0, entered, release;
  const loads = [], pending = abortAt && new Promise((resolve) => { entered = resolve; });
  if (abortAt) globalThis.__poolLoad = (name) => {
    loads.push(name);
    if (name === abortAt) return new Promise((resolve) => { release = resolve; entered(); });
  };
  const { mount } = await import(`../src/pool/index.js?t=${Date.now()}-${Math.random()}`);
  const mounting = mount({
    canvas, signal: controller.signal, gpu: { device: {} },
    stage: { el: { extra: { querySelector: () => root } }, reduced: { matches: false } },
    frames() { frames++; }, hook(h) { hooks++; hook = h; },
  });
  if (abortAt) {
    await pending; controller.abort(); release(); await mounting;
    return { root, observing, frames, hooks, loads };
  }
  await mounting;
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
  return { hook, root, ptr, aimAt, advance: (dt) => { now += dt; } };
}

for (const [i, stage] of ['ocean', 'ducks', 'props', 'renderer'].entries()) test(`aborting while ${stage} loads leaves no page layers or frames`, async (t) => {
  const { root, observing, frames, hooks, loads } = await mountPool(t, stage);
  assert.deepEqual({ layers: root.children.length, observing: observing.size, frames, hooks, loads },
    { layers: 0, observing: 0, frames: 0, hooks: 0, loads: ['ocean', 'ducks', 'props', 'renderer'].slice(0, i + 1) });
});

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

test('a drag that starts on a chair turns the camera, and one that starts on the radio during the seat flight stands at once', async (t) => {
  const { hook, ptr, aimAt, advance } = await mountPool(t);
  const [x, y] = aimAt(hook.spots().seats[0].chair, 'seat'), az0 = hook.cam.az;
  ptr('pointerdown', { id: 1, x, y });
  advance(40);
  ptr('pointermove', { id: 1, x: x + 40, y: y + 20 });
  ptr('pointerup', { id: 1, x: x + 40, y: y + 20 });
  assert.notEqual(hook.cam.az, az0, 'a drag from a chair turns the camera as a drag on nothing does');
  assert.equal(hook.seating.phase, 'standing');

  const [rx, ry] = aimAt(hook.spots().radio, 'radio');
  hook.seating.sit(0);
  assert.equal(hook.seating.phase, 'moving');
  ptr('pointerdown', { id: 2, x: rx, y: ry });
  advance(40);
  ptr('pointermove', { id: 2, x: rx + 40, y: ry });
  ptr('pointerup', { id: 2, x: rx + 40, y: ry });
  assert.equal(hook.seating.phase, 'standing', 'the drag dropped the flight, as a drag on nothing does');
  assert.equal(hook.world.station, 0, 'and tuned nothing');
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

for (const reason of ['stand', 'moved']) test(`sitting again after ${reason} forgets a departed duck but still names a live duck`, async (t) => {
  const { hook, root } = await mountPool(t);
  hook.sit(0);
  hook.render(80, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');
  const duck = hook.world.ducks[0], choice = root.querySelector('.seat-duck'), note = root.querySelector('.seat-note');
  assert.ok(duck);
  choice.value = String(duck.id); choice.selectedOptions = [{ textContent: duck.name }];
  choice.dispatchEvent(new Event('change'));
  hook.render(1, 0);
  assert.equal(note.textContent, `Watching ${duck.name}.`);

  assert.equal(hook.seating.stand(reason), true);
  hook.render(1, 0);
  hook.sit(0);
  hook.render(80, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');
  assert.equal(note.textContent, `Watching ${duck.name}.`);

  assert.equal(hook.remove(), true);
  assert.ok(!hook.world.ducks.includes(duck));
  assert.equal(hook.world.selected, null);
  hook.render(1, 0);
  assert.equal(note.textContent, 'The duck you were watching has left.');
  assert.equal(hook.seating.stand(reason), true);
  hook.render(1, 0);
  hook.sit(0);
  hook.render(80, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');
  assert.equal(choice.value, '');
  assert.equal(note.textContent, '');
});

test('the first visit waits for its item only until it comes', async (t) => {
  const { hook, root } = await mountPool(t);
  const sea = P.SEATS.findIndex((s) => s.id === 'sea');
  hook.pause(false);
  hook.sit(sea);
  for (let i = 0; i < 80 && hook.seating.phase !== 'seated'; i++) hook.render(1, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');
  const boatText = root.querySelector('.seat-boat'), sendBtn = root.querySelector('.seat-send');
  assert.equal(boatText.textContent, 'Nothing is adrift yet. Keep watching the sea. Pages found: 0 of 6.');
  assert.equal(sendBtn.getAttribute('aria-disabled'), 'true');

  for (let s = 0; s < 50 && !hook.world.collectibles.adrift.length; s++) { hook.step(120); hook.render(1, 0); }
  assert.equal(hook.world.collectibles.adrift.length, 1);
  assert.equal(boatText.textContent, 'Something is adrift. Pages found: 0 of 6.');
  assert.equal(sendBtn.getAttribute('aria-disabled'), 'false');

  // The target can be removed without a boat find (as when a target disappears after dispatch).
  hook.world.collectibles.setCollected([hook.world.collectibles.adrift[0].id]);
  for (let s = 0; s < 5; s++) {
    hook.step(120); hook.render(1, 0);
    assert.equal(boatText.textContent, 'Nothing is adrift. Pages found: 0 of 6.');
  }
});

test('when the boat moors, .seat-boat and an open book page update on that same frame without flashing "Nothing is adrift."', async (t) => {
  const { hook, root } = await mountPool(t);
  const sea = P.SEATS.findIndex((s) => s.id === 'sea');
  hook.pause(false);
  hook.sit(sea);
  for (let i = 0; i < 80 && hook.seating.phase !== 'seated'; i++) hook.render(1, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');

  for (let s = 0; s < 50 && !hook.world.collectibles.adrift.length; s++) hook.step(120);
  assert.equal(hook.world.collectibles.adrift.length, 1);
  const [item] = hook.world.collectibles.adrift;
  const title = COLLECTIBLES.find((c) => c.id === item.id).title;

  hook.render(1, 1 / 60);
  const boatText = root.querySelector('.seat-boat');
  const sendBtn = root.querySelector('.seat-send');
  assert.match(boatText.textContent, /^Something is adrift\./);
  assert.equal(sendBtn.getAttribute('aria-disabled'), 'false');

  const pageIndex = hook.book.pages.findIndex((p) => p.id === item.id);
  assert.ok(pageIndex >= 0);
  root.querySelector('.seat-book').dispatchEvent(new Event('click'));
  const nextBtn = root.querySelector('.book-next');
  for (let i = 0; i < pageIndex; i++) nextBtn.dispatchEvent(new Event('click'));
  assert.equal(hook.bookView.index, pageIndex);
  const pageEl = root.querySelector('.book-page');
  assert.equal(pageEl.dataset.state, 'empty');

  sendBtn.dispatchEvent(new Event('click'));
  assert.notEqual(hook.world.boat.state, 'moored');

  let moored = false;
  for (let frame = 0; frame < 6000; frame++) {
    hook.render(1, 1 / 60);
    assert.ok(!boatText.textContent.includes('Nothing is adrift.'), `frame ${frame}: ${boatText.textContent}`);
    if (hook.world.boat.state === 'moored') {
      moored = true;
      assert.equal(boatText.textContent, `The boat brought home: ${title}. Pages found: 1 of 6.`);
      assert.equal(pageEl.dataset.state, 'filled');
      assert.equal(pageEl.querySelector('h3').textContent, title);
      assert.notEqual(pageEl.querySelector('p').textContent, 'Not found yet.');
      break;
    }
  }
  assert.ok(moored, 'expected the boat to moor within 6000 frames');

  hook.reset();
  hook.sit(sea);
  for (let i = 0; i < 80 && hook.seating.phase !== 'seated'; i++) hook.render(1, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');
  assert.equal(boatText.textContent, 'Nothing is adrift. Pages found: 1 of 6.');
});

test('a rescued duck that lands during the Go home fade is not told on the next visit, while an island rescue still is', async (t) => {
  const sea = P.SEATS.findIndex((s) => s.id === 'sea');
  const seaSpot = [MOORING[0] + 1.5, MOORING[2] + 1.5];
  assert.equal(reachable(seaSpot), true);

  const sitSea = (hook) => {
    hook.pause(false);
    hook.sit(sea);
    for (let i = 0; i < 80 && hook.seating.phase !== 'seated'; i++) hook.render(1, 1 / 60);
    assert.equal(hook.seating.phase, 'seated');
  };
  const strandDuck = (hook, at) => {
    assert.equal(hook.addFlyer(), true);
    const d = hook.world.ducks.at(-1);
    hook.world.floaters.grab(d.body);
    d.body.ghost = true; d.state = 'sea'; d.fly = { b: [at[0], P.SEA, at[1]], dir: [0, 1] }; d.seaT = 0;
    d.body.p = [at[0], P.SEA, at[1]];
    return d;
  };

  // Control: rescuing a duck while staying on the island still names it.
  const stay = await mountPool(t);
  sitSea(stay.hook);
  const stayed = strandDuck(stay.hook, seaSpot);
  stay.hook.render(1, 1 / 60);
  stay.root.querySelector('.seat-send').dispatchEvent(new Event('click'));
  for (let i = 0; i < 1200 && stay.hook.world.boat.state !== 'moored'; i++) stay.hook.render(1, 1 / 60);
  assert.equal(stay.hook.world.boat.state, 'moored');
  assert.equal(stay.root.querySelector('.seat-boat').textContent, `The boat brought home: ${stayed.name}. Pages found: 0 of 6.`);

  // Bug: a rescued duck landing during the 2.5 s dusk fade must not be told on the next visit.
  const fade = await mountPool(t);
  sitSea(fade.hook);
  const awayDuck = strandDuck(fade.hook, seaSpot);
  fade.hook.render(1, 1 / 60);
  fade.root.querySelector('.seat-send').dispatchEvent(new Event('click'));
  for (let i = 0; i < 1200 && (fade.hook.world.boat.state !== 'home' || Math.hypot(fade.hook.world.boat.p[0] - MOORING[0], fade.hook.world.boat.p[2] - MOORING[2]) > 0.8); i++) {
    fade.hook.render(1, 1 / 60);
  }
  assert.equal(fade.hook.world.boat.state, 'home');
  fade.root.querySelector('.seat-home').dispatchEvent(new Event('click'));
  assert.equal(fade.hook.state().home?.phase, 'dusk');
  for (let i = 0; i < 300 && fade.hook.world.boat.state !== 'moored'; i++) fade.hook.render(1, 1 / 60);
  assert.equal(fade.hook.world.boat.state, 'moored');
  assert.equal(fade.hook.state().home?.phase, 'dusk', 'expected the boat to moor during the dusk fade');
  for (let i = 0; i < 400 && fade.hook.state().home; i++) fade.hook.render(1, 1 / 60);
  assert.equal(fade.hook.state().home, null);
  assert.equal(fade.hook.state().visits, 2);

  sitSea(fade.hook);
  const nextText = fade.root.querySelector('.seat-boat').textContent;
  assert.ok(!nextText.includes(awayDuck.name), `unexpected duck name in next visit text: ${nextText}`);
  assert.equal(nextText, 'Nothing is adrift yet. Keep watching the sea. Pages found: 0 of 6.');
});

test('an item that lands during the Go home fade is still told on the next visit without any rescued duck', async (t) => {
  const sea = P.SEATS.findIndex((s) => s.id === 'sea');
  const runCase = async (withDuck) => {
    const { hook, root } = await mountPool(t);
    hook.pause(false);
    hook.sit(sea);
    for (let i = 0; i < 80 && hook.seating.phase !== 'seated'; i++) hook.render(1, 1 / 60);
    assert.equal(hook.seating.phase, 'seated');

    for (let s = 0; s < 50 && !hook.world.collectibles.adrift.length; s++) hook.step(120);
    assert.equal(hook.world.collectibles.adrift.length, 1);
    const [item] = hook.world.collectibles.adrift;
    const title = COLLECTIBLES.find((c) => c.id === item.id).title;

    let duck = null;
    if (withDuck) {
      assert.equal(hook.addFlyer(), true);
      duck = hook.world.ducks.at(-1);
      hook.world.floaters.grab(duck.body);
      duck.body.ghost = true; duck.state = 'sea'; duck.fly = { b: [item.at[0] + 0.2, P.SEA, item.at[1]], dir: [0, 1] }; duck.seaT = 0;
      duck.body.p = [item.at[0] + 0.2, P.SEA, item.at[1]];
    }

    hook.render(1, 1 / 60);
    root.querySelector('.seat-send').dispatchEvent(new Event('click'));
    for (let i = 0; i < 6000 && (hook.world.boat.state !== 'home' || Math.hypot(hook.world.boat.p[0] - MOORING[0], hook.world.boat.p[2] - MOORING[2]) > 0.8); i++) {
      hook.render(1, 1 / 60);
    }
    assert.equal(hook.world.boat.state, 'home');
    root.querySelector('.seat-home').dispatchEvent(new Event('click'));
    assert.equal(hook.state().home?.phase, 'dusk');
    for (let i = 0; i < 300 && hook.world.boat.state !== 'moored'; i++) hook.render(1, 1 / 60);
    assert.equal(hook.world.boat.state, 'moored');
    assert.equal(hook.state().home?.phase, 'dusk', 'expected the boat to moor during the dusk fade');
    for (let i = 0; i < 400 && hook.state().home; i++) hook.render(1, 1 / 60);
    assert.equal(hook.state().home, null);
    assert.equal(hook.state().visits, 2);

    hook.sit(sea);
    for (let i = 0; i < 80 && hook.seating.phase !== 'seated'; i++) hook.render(1, 1 / 60);
    assert.equal(hook.seating.phase, 'seated');
    const nextText = root.querySelector('.seat-boat').textContent;
    if (duck) assert.ok(!nextText.includes(duck.name), `unexpected duck name in next visit text: ${nextText}`);
    assert.equal(nextText, `While you were away, the boat brought home: ${title}. Pages found: 1 of 6.`);
  };

  await runCase(false);
  await runCase(true);
});

async function critterAlphas(hook) {
  const { CRITTER, CRITTER_MAX } = await import('../src/pool/critters.js');   // after mountPool: it imports props.js
  // [shape, alpha] of each resident as the renderer gets them (critters.pack: alpha at 7, shape at 8)
  const alphas = (shape) => {
    const buf = new Float32Array(CRITTER_MAX * 12), n = hook.critters.pack(buf, 0, []);
    const xs = Array.from({ length: n }, (_, i) => [buf[i * 12 + 8], buf[i * 12 + 7]]).filter(([s]) => s === shape).map(([, a]) => a);
    assert.ok(xs.length > 0, `expected at least one resident of shape ${shape}`);
    return xs;
  };
  return { CRITTER, alphas };
}

test('the first load opens with day gulls and butterflies already shown before any frame', async (t) => {
  const { hook } = await mountPool(t);
  const { CRITTER, alphas } = await critterAlphas(hook);
  assert.equal(hook.world.day.hour, 15, 'the first visit starts in the afternoon');
  for (const shape of [CRITTER.gull, CRITTER.butterfly]) assert.ok(alphas(shape).every((a) => a === 1), `shape ${shape} is shown at once`);
});

test('a new visit opens with the residents of its hour already shown, not fading in from the last night', async (t) => {
  const { hook } = await mountPool(t);
  const { CRITTER, alphas } = await critterAlphas(hook);
  hook.world.setHour(23);
  hook.render(240, 1 / 60);
  assert.ok(alphas(CRITTER.gull).every((a) => a < 0.05), 'the night has faded the gulls out');
  assert.ok(alphas(CRITTER.firefly).every((a) => a > 0.95), 'and the fireflies in');

  hook.reset();
  assert.equal(hook.world.day.hour, 15, 'a visit starts in the afternoon');
  for (const shape of [CRITTER.gull, CRITTER.butterfly]) assert.ok(alphas(shape).every((a) => a === 1), `shape ${shape} is shown at once`);
  assert.ok(alphas(CRITTER.firefly).every((a) => a === 0), 'the fireflies are gone at once');
});

test('seated gaze tracks a watched duck on rides (slide, above-ground tube) while holding still in hand or underground in the tube', async (t) => {
  const { hook } = await mountPool(t);
  const viewAngle = (p) => {
    const { cam, world } = hook, w = world.block.toWorld(p);
    const ce = Math.cos(cam.el), dir = [-ce * Math.sin(cam.az), -Math.sin(cam.el), -ce * Math.cos(cam.az)];
    const eye = [cam.target[0] - cam.dist * dir[0], cam.target[1] - cam.dist * dir[1], cam.target[2] - cam.dist * dir[2]];
    const to = w.map((v, i) => v - eye[i]), len = Math.hypot(...to);
    return Math.acos(Math.max(-1, Math.min(1, (dir[0] * to[0] + dir[1] * to[1] + dir[2] * to[2]) / len)));
  };

  hook.pause(false);
  hook.sit(0);
  for (let i = 0; i < 80 && hook.seating.phase !== 'seated'; i++) hook.render(1, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');

  // Start duck 0 down the slide using the world's hand, then select it once sliding.
  const d = hook.world.ducks[0];
  hook.world.hand.grab(d.body);
  hook.world.hand.hold(d.body, [P.MOUTH[0], P.LU + 0.03, P.MOUTH[1] - 0.05]);
  hook.world.hand.throw(d.body, [0, 0, 0]);
  hook.select(-1);
  for (let i = 0; i < 30 && d.state !== 'slide'; i++) hook.step(1);
  assert.equal(d.state, 'slide');
  assert.equal(d.body.state, 'held');

  hook.select(0);
  const angle0 = viewAngle(d.body.p), az0 = hook.cam.az;
  assert.ok(angle0 > 0.3, `expected initial angle > 0.3 rad, got ${angle0}`);
  let lastAngle = angle0, moved = 0;
  for (let i = 0; i < 60 && d.state === 'slide'; i++) {
    const prev = d.body.p.slice();
    hook.render(1, 1 / 60);
    moved += Math.hypot(d.body.p[0] - prev[0], d.body.p[1] - prev[1], d.body.p[2] - prev[2]);
    lastAngle = viewAngle(d.body.p);
  }
  assert.ok(moved > 0.5, `expected duck to move down the slide, moved ${moved}`);
  assert.notEqual(hook.cam.az, az0, 'expected seated camera to turn while the duck slides');
  assert.ok(lastAngle < angle0 * 0.5, `expected angle to shrink while sliding: ${angle0.toFixed(3)} -> ${lastAngle.toFixed(3)}`);

  // Held in the player's hand (floating duck grabbed): camera holds still.
  for (let i = 0; i < 180 && d.state !== 'float'; i++) hook.render(1, 1 / 60);
  assert.equal(d.state, 'float');
  hook.world.hand.grab(d.body);
  hook.world.hand.hold(d.body, [d.body.p[0] + 1.5, d.body.p[1] + 0.5, d.body.p[2] - 0.5]);
  assert.equal(d.body.state, 'held');
  const heldCam = { az: hook.cam.az, el: hook.cam.el, target: hook.cam.target.slice() };
  hook.render(20, 1 / 60);
  assert.equal(hook.cam.az, heldCam.az);
  assert.equal(hook.cam.el, heldCam.el);
  assert.deepEqual(hook.cam.target, heldCam.target);
  const throwAngle0 = viewAngle(d.body.p);
  hook.world.hand.throw(d.body, [0, 0, 0]);
  hook.render(10, 1 / 60);
  assert.ok(viewAngle(d.body.p) < throwAngle0, 'expected gaze to turn toward the duck once let go');

  // Underground run of the tube hides the gaze (same test as placeTags); above ground in the tube turns to it.
  hook.pause(true);
  hook.world.floaters.grab(d.body);
  d.state = 'tube';
  d.body.p = [P.ROUND[0], P.terrainH(P.ROUND[0], P.ROUND[1]) - 0.3, P.ROUND[1]];
  const underCam = { az: hook.cam.az, el: hook.cam.el, target: hook.cam.target.slice() };
  hook.render(20, 1 / 60);
  assert.equal(hook.cam.az, underCam.az);
  assert.equal(hook.cam.el, underCam.el);
  assert.deepEqual(hook.cam.target, underCam.target);

  d.body.p = [P.ROUND[0], P.terrainH(P.ROUND[0], P.ROUND[1]) + 0.6, P.ROUND[1]];
  const aboveAngle0 = viewAngle(d.body.p);
  hook.render(20, 1 / 60);
  assert.ok(viewAngle(d.body.p) < aboveAngle0, 'expected seated camera to turn toward above-ground tube position');
});

test('resizing the window while seated re-reads the panel size so its bottom stays inside the viewport', async (t) => {
  const { hook, root } = await mountPool(t);
  hook.sit(0);
  hook.render(80, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');

  const seatUi = root.children.find((c) => c.className === 'seat-ui');
  assert.ok(seatUi, 'expected .seat-ui layer');
  const panel = seatUi.querySelector('dialog');
  assert.equal(panel.open, true);
  assert.match(panel.style.transform, /^translate\(/);

  globalThis.innerWidth = 260;
  globalThis.innerHeight = 300;
  panel.offsetWidth = 180;
  panel.offsetHeight = 260;
  window.dispatchEvent(new Event('resize'));
  hook.render(1, 0);

  const match = panel.style.transform.match(/^translate\(([-\d.]+)px,\s*([-\d.]+)px\)$/);
  assert.ok(match, `unexpected transform: ${panel.style.transform}`);
  const y = Number(match[2]);
  assert.ok(y >= 8, `expected y >= 8, got ${y}`);
  assert.ok(y + panel.offsetHeight <= globalThis.innerHeight - 8,
    `panel bottom ${y + panel.offsetHeight} exceeds viewport margin ${globalThis.innerHeight - 8}`);
});

test('hiding the document mid-drag clears dragging so the hour slider follows the clock again without a blur', async (t) => {
  const { hook, root } = await mountPool(t);
  hook.sit(0);
  hook.render(80, 1 / 60);
  assert.equal(hook.seating.phase, 'seated');

  const hour = root.querySelector('.seat-hour');
  assert.equal(hour.value, '15');

  hour.dispatchEvent(new Event('pointerdown'));
  hook.world.setHour(17);
  hook.render(1, 0);
  assert.equal(hour.value, '15', 'slider stays at the dragged hour while visible');

  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  hook.world.setHour(18);
  hook.render(1, 0);
  assert.equal(hour.value, '15', 'non-hidden visibilitychange keeps the drag active');

  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  hook.world.setHour(20);
  hook.render(1, 0);
  assert.equal(hour.value, '20');
});
