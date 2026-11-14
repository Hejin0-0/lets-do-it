import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';
import { createSeating } from '../src/pool/seating.js';
import * as choices from '../src/pool/seat-choices.js';
const { clockText, createDuckChoice, chooseDuck, chooseHour } = choices;

const world = () => createWorld({ seed: 3, ducks: 0, arrivals: false });

test('slider spans quarter hours without a second midnight', () => {
  assert.equal(choices.HOUR_STEP, .25); assert.equal(choices.HOUR_MAX, 23.75);
});

test('running world clock takes 1800 seconds per day', () => {
  const W=world(), start=W.day.hour; W.step(120);
  near(W.day.hour-start,24/1800);
});

test('clock text wraps hours and floors minutes', () => {
  for (const [hour, text] of [[0,'00:00'],[5.999,'05:59'],[11.9999,'11:59'],[12,'12:00'],[23.99999,'23:59'],[24,'00:00'],[30,'06:00'],[-.5,'23:30']]) assert.equal(clockText(hour), text);
});

test('live duck labels are unique, including repeated names and existing suffixes', () => {
  const W = world(); W.addDucks(40); while (W.ducks.length < 40) W.step();
  const choice = createDuckChoice(), names = ['Pip','Pip','Pip','Pip (2)'];
  names.forEach((name, i) => { W.ducks[i].name = name; });
  const options = choice.view(W.ducks, null).options;
  assert.equal(options.length, 40); assert.deepEqual(options.map(o => o.id), W.ducks.map(d => d.id));
  assert.equal(options[0].label, 'Pip'); assert.equal(options[3].label, 'Pip (2)');
  assert.equal(new Set(options.map(o => o.label)).size, 40);
  W.ducks[3].name = 'Other';
  assert.deepEqual(choice.view(W.ducks.slice(0,3), null).options.map(o => o.label), ['Pip','Pip (2)','Pip (3)']);
});

test('selection identity, removal notice, deselection and forget', () => {
  const W = world(); W.addDucks(2); while (W.ducks.length < 2) W.step();
  const [a, b] = W.ducks, choice = createDuckChoice();
  assert.equal(choice.view(W.ducks, null).value, null);
  assert.equal(chooseDuck(W, a.id), true); assert.equal(W.selected, a);
  assert.equal(choice.view(W.ducks, W.selected).value, a.id);
  assert.equal(chooseDuck(W, -1), false); assert.equal(W.selected, a);
  assert.equal(chooseDuck(W, null), true); assert.equal(W.selected, null);
  assert.equal(choice.view(W.ducks, W.selected).notice, null);
  assert.equal(choice.view(W.ducks, {...a}).value, null);
  chooseDuck(W, a.id); choice.view(W.ducks, W.selected);
  assert.equal(W.removeDuck(), true); assert.equal(W.selected, null);
  assert.equal(choice.view(W.ducks, W.selected).notice, 'The duck you were watching has left.');
  assert.equal(choice.view(W.ducks, null).notice, 'The duck you were watching has left.');
  chooseDuck(W, b.id); assert.equal(choice.view(W.ducks, W.selected).notice, null);
  W.removeDuck(); assert.equal(choice.view(W.ducks, null).notice, 'The duck you were watching has left.');
  choice.forget(); assert.equal(choice.view(W.ducks, null).notice, null);
});

test('reset replaces objects even when ids are reused', () => {
  const W = createWorld({seed: 3, ducks: 1, arrivals: false}), choice = createDuckChoice();
  const old = W.ducks[0]; choice.view(W.ducks, old); W.reset();
  assert.equal(W.ducks[0].id, old.id); assert.notEqual(W.ducks[0], old);
  assert.equal(choice.view(W.ducks, old).value, null);
  assert.equal(choice.view(W.ducks, old).notice, 'The duck you were watching has left.');
});

test('hour choice wraps finite numbers and preserves run state', () => {
  const W = world();
  for (const run of [true, false]) {
    W.setDayRun(run);
    for (const [hour, expected] of [[0,0],[6.25,6.25],[23.75,23.75],[24,0],[25.5,1.5],[-.5,23.5]]) {
      assert.equal(chooseHour(W, hour), expected); assert.equal(W.day.hour, expected); assert.equal(W.day.run, run);
    }
    for (const invalid of [NaN, Infinity, -Infinity, '6.25', '', null, undefined, {}, true]) {
      const before = {...W.day}; assert.equal(chooseHour(W, invalid), null); assert.deepEqual(W.day, before);
    }
  }
  let set = 0; const stub = { day: { hour: 0, run: true }, setHour(h) { set++; this.day.hour = h; }, setDayRun() { assert.fail('must not change run state'); } };
  assert.equal(chooseHour(stub, -0.5), 23.5); assert.equal(set, 1);
});

const direction = c => [Math.cos(c.el)*Math.sin(c.az), Math.sin(c.el), Math.cos(c.el)*Math.cos(c.az)];
const eyeOf = c => c.target.map((v,i) => v + c.dist * direction(c)[i]);
const near = (a,b,eps=1e-9) => assert.ok(Math.abs(a-b)<eps, `${a} vs ${b}`);
const samePoint = (a,b,eps=1e-9) => a.forEach((v,i) => near(v,b[i],eps));

test('gaze keeps the eye fixed, preserves its inputs and starts without turning', () => {
  const eye = [4,-2,7], at = [-3,5,1];
  for (const cam of [{az: .4, el: -.3, dist: 8, target: [1,2,3]}, {az: -3, el: 1.4, dist: .2, target: [-9,0,4]}]) {
    const before = structuredClone(cam);
    for (const k of [0,.001,.2,.75,1]) {
      const result = choices.gaze(cam,eye,at,k);
      samePoint(eyeOf(result),eye); assert.notEqual(result,cam); assert.notEqual(result.target,cam.target);
      if (k === 0) { assert.equal(result.az,cam.az); assert.equal(result.el,cam.el); assert.equal(result.dist,cam.dist); }
    }
    assert.deepEqual(cam,before);
  }
});

test('gaze reaches a point at k=1 and converges for small repeated steps', () => {
  const eye=[1,2,3], at=[-4,5,-6], start={az: 2,el: -.4,dist: 9,target:[0,0,0]};
  const unit=eye.map((v,i)=>(v-at[i])/Math.hypot(...eye.map((x,j)=>x-at[j])));
  samePoint(direction(choices.gaze(start,eye,at,1)),unit);
  let c=start; for(let i=0;i<500;i++) c=choices.gaze(c,eye,at,.05);
  samePoint(direction(c),unit,1e-8); samePoint(eyeOf(c),eye); samePoint(c.target,at,1e-8);
});

test('gaze crosses the azimuth seam by the short way', () => {
  const eye=[0,0,0], az=-Math.PI+.1, at=[-Math.sin(az),0,-Math.cos(az)];
  const c=choices.gaze({az:Math.PI-.1,el:0,dist:1,target:[0,0,0]},eye,at,.5);
  near(c.az,Math.PI); samePoint(eyeOf(c),eye);
});

test('gaze keeps a positive distance and handles vertical and coincident targets', () => {
  const eye=[2,3,4], start={az:.7,el:0,dist:2,target:[0,0,0]};
  for(const at of [[2,13,4],[2,-7,4],eye]) {
    const c=choices.gaze(start,eye,at,1);
    assert.ok([c.az,c.el,c.dist,...c.target].every(Number.isFinite));
    assert.ok(Math.abs(c.el)<Math.PI/2); assert.ok(c.dist>0); samePoint(eyeOf(c),eye);
  }
  const floor=choices.gaze(start,eye,eye,1).dist;
  const nearby=choices.gaze(start,eye,[2+floor/10,3,4],1);
  near(nearby.dist,floor); samePoint(eyeOf(nearby),eye);
});

test('a stale selection never removes the wrong duck or leaves its body behind', () => {
  const W = world(); W.addDucks(3); while (W.ducks.length < 3) W.step();
  const ghost = W.ducks[0]; W.reset(); W.addDucks(3); while (W.ducks.length < 3) W.step();
  const newest = W.ducks[2], kept = W.ducks.slice(0, 2), bodies = W.floaters.bodies.length;
  W.selected = ghost;   // an object from before the reset: not a live duck
  W.setColour(5); W.setHat(3);
  assert.equal(W.selected, null); assert.equal(W.next.colour, 5); assert.equal(W.next.hat, 3); assert.notEqual(ghost.colour, 5);
  assert.ok(W.removeDuck());
  assert.deepEqual(W.ducks, kept); assert.ok(!W.floaters.bodies.includes(newest.body)); assert.equal(W.floaters.bodies.length, bodies - 1);
  assert.equal(W.selected, null);
});

async function withSeatMenuEnv(fn) {
  const { createSeatMenu } = await import('../src/pool/seat-menu.js');
  class El extends EventTarget {
    constructor() { super(); this.attrs = {}; this.style = {}; this.children = []; this.options = []; this.selectedOptions = []; this.textContent = ''; this.value = ''; this.checked = false; this.open = false; this.offsetWidth = 200; this.offsetHeight = 200; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    focus() { globalThis.document.activeElement = this; }
    show() { this.open = true; }
    close() { this.open = false; }
    before() {}
    append(c) { this.children.push(c); }
    remove() {}
    contains(el) { return el === this || this.children.includes(el); }
  }
  const keys = ['dialog', 'h2', '.seat-up', '.seat-send', '.seat-boat', '.seat-book', '.seat-sound', '.seat-duck', '.seat-hour', '.seat-clock', '.seat-note', '.seat-hour-note', '.seat-home'];
  const el = Object.fromEntries(keys.map(k => [k, new El()]));
  el.dialog.children = keys.filter(k => k !== 'dialog').map(k => el[k]);
  el['.seat-duck'].options = [new El()];
  const ui = new El(); ui.querySelector = k => el[k];
  const old = { document: globalThis.document, window: globalThis.window, innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight };
  globalThis.document = { createElement: () => ui, activeElement: null };
  globalThis.window = new EventTarget(); globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
  try {
    return await fn({ createSeatMenu, el, root: new El(), fallback: new El(), controller: new AbortController() });
  } finally { Object.assign(globalThis, old); }
}

test('hour slider follows the clock again and clears stale notes after standing up or releasing outside', async () => {
  await withSeatMenuEnv(({ createSeatMenu, el, root, fallback, controller }) => {
    let now = 12, refuse = true, soundOn = true;
    const seats = [{ id: 'pool', label: 'Pool chair', side: [0, 0], y: 0 }];
    const seating = createSeating({ seats, duration: 1 });
    const menu = createSeatMenu({
      root, seats, seating, toPx: () => [100, 300], fallback, signal: controller.signal,
      boat: { state: () => ({ out: false, adrift: 1, brought: [], opened: false, away: false, found: 0, total: 12, complete: false }), send: () => !refuse },
      choices: { ducks: () => ({ options: [], value: null, notice: null }), chooseDuck: () => true, chooseHour: h => (now = h), hour: () => now },
      bookView: { isOpen: false, close() {}, open() {} }, goHome() {}, sound: { on: () => soundOn, set: v => { soundOn = v; } },
    });
    const sit = () => { seating.sit(0); seating.update(1); menu.frame(); };
    const stand = () => { seating.stand('button'); menu.frame(); };
    const hour = el['.seat-hour'], note = el['.seat-hour-note'];

    sit();
    hour.dispatchEvent(new Event('pointerdown'));
    hour.value = '16'; hour.dispatchEvent(new Event('input'));
    hour.dispatchEvent(new Event('change'));
    menu.frame();
    assert.equal(note.textContent, 'The hour is now 16:00.');

    stand();
    window.dispatchEvent(new Event('pointerup'));
    now = 18.5;
    sit();
    assert.equal(hour.value, '18.5');
    assert.equal(note.textContent, '');

    // Releasing outside (pointerup / pointercancel / blur on window) while seated lets the clock drive the slider again.
    for (const end of ['pointerup', 'pointercancel', 'blur']) {
      hour.dispatchEvent(new Event('pointerdown'));
      hour.value = '15'; hour.dispatchEvent(new Event('input'));
      window.dispatchEvent(new Event(end));
      now = 17.5; menu.frame();
      assert.equal(hour.value, '17.5', `after window ${end}`);
    }

    // Closing mid-drag without pointerup clears dragging, re-announces the same hour on the next sit, and resets boat refusal.
    el['.seat-send'].dispatchEvent(new Event('click'));
    assert.equal(el['.seat-boat'].textContent, 'The boat cannot get there just now.');
    hour.dispatchEvent(new Event('pointerdown'));
    hour.value = '16'; hour.dispatchEvent(new Event('input'));
    hour.dispatchEvent(new Event('change'));
    menu.frame();
    assert.equal(note.textContent, 'The hour is now 16:00.');
    stand();
    now = 19.25;
    sit();
    assert.equal(hour.value, '19.25');
    assert.equal(note.textContent, '');
    assert.match(el['.seat-boat'].textContent, /^Something is adrift\./);
    hour.value = '16'; hour.dispatchEvent(new Event('input'));
    hour.dispatchEvent(new Event('change'));
    menu.frame();
    assert.equal(note.textContent, 'The hour is now 16:00.');
    controller.abort();
  });
});

test('letter stores computed pixel dimensions on the element for tag sizing', async () => {
  const old = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, devicePixelRatio: globalThis.devicePixelRatio };
  const ctx2d = new Proxy({}, { get: (t, k) => (t[k] ??= () => {}) });
  const makeEl = (tag) => ({
    tag, children: [], style: {}, dataset: {}, attrs: {}, textContent: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    append(...c) { this.children.push(...c); },
    querySelector(s) { return s.includes('.lt-words') ? this.children[0] ?? null : s.includes('canvas.lt') ? this.children[1] ?? null : null; },
    getContext(t) { return t === '2d' ? ctx2d : null; },
  });
  globalThis.document = { createElement: makeEl };
  globalThis.getComputedStyle = () => ({ fontSize: '12px', fontWeight: '600', color: '#1f2a30' });
  globalThis.devicePixelRatio = 2;
  try {
    const { letter } = await import('../src/pool/lettering.js');
    const el = makeEl('span');
    letter(el, 'Sunny');
    const canvas = el.children[1];
    assert.equal(el.w, parseFloat(canvas.style.width));
    assert.equal(el.h, parseFloat(canvas.style.height));
    assert.ok(el.w > 0 && el.h > 0);

    const w0 = el.w, h0 = el.h;
    letter(el, 'Sunny');
    assert.equal(el.w, w0); assert.equal(el.h, h0);

    letter(el, 'Captain Splash');
    assert.ok(el.w > w0);
    assert.equal(el.w, parseFloat(canvas.style.width));
    assert.equal(el.h, parseFloat(canvas.style.height));
  } finally { Object.assign(globalThis, old); }
});
