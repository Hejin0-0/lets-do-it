import test from 'node:test';
import assert from 'node:assert/strict';
import { homeAt, DUSK_SECONDS, DARK_SECONDS, DAWN_SECONDS, startVisit } from '../src/pool/home.js';
import { createWorld } from '../src/pool/world.js';
import { createLogbook } from '../src/pool/logbook.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';

const KEY = 'rubber-duck-pool.book.v2';
const store = (value = null) => { const keys = new Map(value === null ? [] : [[KEY, value]]); return { keys, writes: 0, getItem(k) { return keys.get(k) ?? null; }, setItem(k, v) { keys.set(k, v); this.writes++; }, removeItem(k) { keys.delete(k); } }; };

const total = DUSK_SECONDS + DARK_SECONDS + DAWN_SECONDS;
test('home timeline fades through dusk, dark and dawn, advancing daylight only toward night', () => {
  assert.ok(total >= 3 && total <= 5);
  assert.deepEqual(homeAt(0, 15, false), { phase: 'dusk', t: 0, opacity: 0, hour: 15 });
  const mid = homeAt(DUSK_SECONDS / 2, 15, false);
  assert.equal(mid.phase, 'dusk'); assert.equal(mid.t, DUSK_SECONDS / 2); assert.ok(mid.hour > 15 && mid.hour < 20); assert.ok(mid.opacity > 0 && mid.opacity < 1);
  assert.deepEqual(homeAt(DUSK_SECONDS, 15, false), { phase: 'dark', t: 0, opacity: 1, hour: 20 });
  assert.deepEqual(homeAt(DUSK_SECONDS + DARK_SECONDS, 15, false), { phase: 'dawn', t: 0, opacity: 1, hour: null });
  assert.equal(homeAt(total, 15, false), null);
  for (const h of [0, 3, 20, 23]) assert.equal(homeAt(DUSK_SECONDS - .01, h, false).hour, h);
  assert.ok(homeAt(DUSK_SECONDS - .01, 19, false).hour >= 19);
});

test('reduced motion retains the fade and never changes the hour', () => {
  for (const t of [0, 1, DUSK_SECONDS, DUSK_SECONDS + DARK_SECONDS]) assert.equal(homeAt(t, 12, true).hour, null);
  assert.ok(homeAt(1, 12, true).opacity > 0);
});

const adriftNow = () => {
  const world = createWorld({ seed: 7, ducks: 0, arrivals: false }), book = createLogbook(null);
  world.collectibles.arm(); for (let s = 0; s < 46 && !world.collectibles.adrift.length; s++) world.step(120);
  return { world, book, id: world.collectibles.adrift[0].id, state: (id) => world.collectibles.list.find(x => x.id === id).state };
};

test('leaving while the boat brings an item home still records its page', () => {
  const { world, book, id, state } = adriftNow();
  assert.equal(world.sendBoat(), true);
  for (let n = 0; n < 120 * 200 && state(id) !== 'aboard'; n++) world.step();
  assert.equal(world.boat.state, 'home'); assert.equal(book.found(id), false);
  assert.deepEqual(startVisit(world, book, 2), [id]);
  assert.equal(book.found(id), true); assert.equal(state(id), 'collected'); assert.equal(world.boat.state, 'moored');
});

test('an item the boat landed earlier in the same frame is one the visit says it brought home', () => {
  const { world, book, id, state } = adriftNow();
  assert.equal(world.sendBoat(), true);
  for (let n = 0; n < 120 * 400 && state(id) !== 'collected'; n++) { world.events.length = 0; world.step(); }
  assert.equal(state(id), 'collected'); assert.ok(world.events.some(e => e.type === 'collected'), 'landed in this frame');
  assert.deepEqual(startVisit(world, book, 2), [id]); assert.equal(book.found(id), true);
});

test('an item left adrift is not recorded and can come again', () => {
  const { world, book, id, state } = adriftNow();
  assert.deepEqual(startVisit(world, book, 2), []);
  assert.equal(book.found(id), false); assert.equal(state(id), 'hidden');
});

test('new visit resets world and visit book state while restoring saved pool items', () => {
  const world = createWorld({ seed: 3, visit: 5, ducks: 1, arrivals: false });
  const book = createLogbook(null, { now: () => 123 });
  const kept = 'bottle-first', leaving = 'bottle-second';
  book.observe(world, [{ type: 'collected', ids: [kept, leaving] }, { type: 'summoned', id: kept }, { type: 'summoned', id: leaving }]);
  book.observe(world, [{ type: 'launch' }]); assert.ok(book.ducks.length);
  world.summon(kept); world.summon(leaving); world.events.length = 0;
  world.sendBack(leaving); world.step(240);
  world.collectibles.setCollected([kept, leaving]); world.collectibles.arm();
  const before = world.collectibles.list.find(x => x.t !== null).id;
  const oldDuck = world.ducks[0]; world.selected = oldDuck; world.setHour(3); world.setDayRun(false); world.coolers.toggle(0);
  startVisit(world, book, 1);
  assert.deepEqual(book.inPool, [kept]); assert.deepEqual(world.summons.list.map(x => [x.id, x.state]), [[kept, 'floating']]);
  assert.equal(world.summons.gulls.length, 0); assert.equal(world.summons.leaving(leaving), false);
  assert.equal(world.selected, null); assert.notEqual(world.ducks[0], oldDuck); assert.deepEqual(world.day, { hour: 15, run: true });
  assert.equal(world.coolers.isOpen(0), false);
  assert.equal(book.ducks.length, 0);
  assert.ok(book.found(kept) && book.found(leaving));
  world.collectibles.arm();
  assert.notEqual(world.collectibles.list.find(x => x.t !== null).id, before);
});

test('Go home starts the new visit from the stored book, picking up another tab\'s summon', () => {
  const s = store(), [y] = COLLECTIBLES.map(c => c.id);
  createLogbook(s).observe(createWorld({ seed: 3, ducks: 0, arrivals: false }), [{ type: 'collected', ids: [y] }]);
  const a = createLogbook(s);
  const worldB = createWorld({ seed: 3, ducks: 1, arrivals: false }), bookB = createLogbook(s);
  bookB.observe(worldB, worldB.events); worldB.events.length = 0;
  a.observe(createWorld({ seed: 3, ducks: 0, arrivals: false }), [{ type: 'summoned', id: y, x: 0, z: 0 }]);
  startVisit(worldB, bookB, 2);
  assert.equal(worldB.summons.has(y), true);
  assert.deepEqual(bookB.inPool, [y]);
  assert.deepEqual(worldB.events.filter(e => e.type === 'summoned'), []);
});

test('main stops the frame loop, aborts overlays and hides #extra on GPU device loss', async () => {
  const { register } = await import('node:module');
  if (!globalThis.__mainHostHook) {
    const loader = `export async function resolve(spec, ctx, next) {
      if (spec === '@lid/loop') return { shortCircuit: true, url: 'stub:loop' };
      return next(spec, ctx);
    }
    export async function load(url, ctx, next) {
      const base = url.split('?')[0];
      if (base.endsWith('/src/style.css')) return { format: 'module', shortCircuit: true, source: '' };
      if (base === 'stub:loop') return { format: 'module', shortCircuit: true, source: 'export class Loop { constructor(tick) { this.tick = tick; this.running = false; this.starts = 0; this.stops = 0; globalThis.__mainHostStub.loops.push(this); } start() { this.running = true; this.starts++; } stop() { this.running = false; this.stops++; } }' };
      if (base.endsWith('/src/pool/index.js')) return { format: 'module', shortCircuit: true, source: 'export const meta = { name: "Pool" }, extra = "<div class=pool></div>", mount = (c) => globalThis.__mainHostStub.mount(c);' };
      return next(url, ctx);
    }`;
    register('data:text/javascript,' + encodeURIComponent(loader));
    globalThis.__mainHostHook = true;
  }
  const saved = {
    document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia,
    consoleError: console.error, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  };
  const runCase = async (tag, onMount) => {
    const els = Object.fromEntries(['#gl', '#extra', '#fallback', '#fallback-why', '#fallback-reason'].map((s) => [
      s, { hidden: s === '#fallback', style: {}, textContent: '', innerHTML: '', getContext: () => ({ configure() {} }) },
    ]));
    globalThis.document = { querySelector: (s) => els[s], title: '' };
    globalThis.window = {};
    globalThis.matchMedia = () => ({ matches: false });
    let lose;
    const errors = [], loops = [];
    console.error = (e) => errors.push(e);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { gpu: { getPreferredCanvasFormat: () => 'bgra8unorm', requestAdapter: async () => ({ requestDevice: async () => ({ lost: new Promise((r) => { lose = r; }) }) }) } },
    });
    let ctxOut = null;
    globalThis.__mainHostStub = {
      loops,
      async mount(ctx) { ctxOut = ctx; await onMount(ctx, () => lose); },
    };
    await import(`../src/main.js?case=${tag}`);
    for (let i = 0; i < 10 && !ctxOut; i++) await new Promise((r) => setTimeout(r, 5));
    return { els, loops, ctx: ctxOut, errors, lose };
  };
  try {
    let closed = 0;
    const live = await runCase('lost-live', async (ctx) => {
      ctx.signal.addEventListener('abort', () => closed++);
      ctx.frames(() => {});
    });
    assert.equal(live.ctx.signal.aborted, false);
    assert.equal(live.loops[0].running, true);
    assert.equal(live.els['#extra'].hidden, false);
    live.lose({ reason: 'unknown', message: 'GPU reset' });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(live.ctx.signal.aborted, true);
    assert.equal(closed, 1);
    assert.equal(live.loops[0].running, false);
    assert.equal(live.loops[0].stops, 1);
    assert.equal(live.els['#extra'].hidden, true);
    assert.equal(live.els['#fallback'].hidden, false);
    assert.equal(live.els['#fallback-why'].textContent, 'The GPU device was lost.');
    assert.equal(live.els['#fallback-reason'].textContent, 'GPU reset');
    assert.equal(live.els['#gl'].style.visibility, 'hidden');
    assert.equal(live.errors.length, 1);

    let resumeMount;
    const early = await runCase('lost-early', async (ctx, getLose) => {
      getLose()({ reason: 'unknown', message: 'lost early' });
      await new Promise((r) => { resumeMount = r; });
      ctx.frames(() => {});
    });
    assert.equal(early.ctx.signal.aborted, true);
    assert.equal(early.els['#extra'].hidden, true);
    assert.equal(early.els['#fallback'].hidden, false);
    resumeMount();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(early.loops[0].running, false);
    assert.equal(early.loops[0].starts, 0);

    const destroyed = await runCase('destroyed', async (ctx) => { ctx.frames(() => {}); });
    destroyed.lose({ reason: 'destroyed', message: 'teardown' });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(destroyed.ctx.signal.aborted, false);
    assert.equal(destroyed.loops[0].running, true);
    assert.equal(destroyed.els['#extra'].hidden, false);
    assert.equal(destroyed.els['#fallback'].hidden, true);
  } finally {
    delete globalThis.__mainHostStub;
    console.error = saved.consoleError;
    for (const k of ['document', 'window', 'matchMedia']) {
      if (saved[k] === undefined) delete globalThis[k]; else globalThis[k] = saved[k];
    }
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
    else delete globalThis.navigator;
  }
});
