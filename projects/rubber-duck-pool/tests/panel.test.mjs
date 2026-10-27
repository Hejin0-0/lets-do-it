import test from 'node:test';
import assert from 'node:assert/strict';
import { installPanel } from '../src/pool/panel.js';
import { PROPELLER, nameOf } from '../src/pool/ducks.js';

// Small element doubles exercise state and event contracts without a DOM or layout engine.
class Element {
  nodes = new Map(); attrs = {}; listeners = new Map(); hidden = false; style = { setProperty() {} };
  querySelector(s) { if (!this.nodes.has(s)) this.nodes.set(s, new Element()); return this.nodes.get(s); }
  querySelectorAll() { return []; }
  addEventListener(type, fn, { signal } = {}) { this.listeners.set(type, fn); signal?.addEventListener('abort', () => this.listeners.delete(type), { once: true }); }
  fire(type, e = {}) { this.listeners.get(type)?.(e); }
  setAttribute(k, v) { this.attrs[k] = v; }
  replaceChildren(...children) { this.children = children; }
  focus() { document.activeElement = this; }
  contains(el) { return el === this || [...this.nodes.values()].some(n => n.contains(el)); }
}
function setup(t) {
  const saved = Object.fromEntries(['window', 'document', 'ResizeObserver', 'Option'].map(k => [k, globalThis[k]]));
  globalThis.window = new Element(); globalThis.document = { baseURI: 'https://example.test/', activeElement: null };
  let disconnected = false;
  globalThis.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  const root = new Element(), controller = new AbortController(), d = { id: 1, colour: 0, hat: 0 };
  const world = { ducks: [d], selected: d, next: { colour: 0 }, day: { hour: 12, run: true },
    removeDuck() { this.ducks = []; this.selected = null; }, setHat(h) { this.selected.hat = h; } };
  const toggle = () => ({ value: false, get() { return this.value; }, set(v) { this.value = v; } });
  const api = { world, names: toggle(), sound: toggle(), follow: toggle(), pick(d) { world.selected = d; },
    setClock(v) { world.day.run = v; }, setHour(v) { world.day.hour = v; }, addDuck() {}, wholeView() {} };
  const panel = installPanel(root, api, controller.signal); panel.frame();
  t.after(() => { controller.abort(); for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } });
  return { root, api, world, d, panel, controller, disconnected: () => disconnected };
}
test('clock updates every minute; focus pauses and blur resynchronizes within the same minute', t => {
  const { root, world, panel } = setup(t), hour = root.querySelector('#pool-hour');
  world.day.hour = 12.02; panel.frame(); assert.equal(root.querySelector('.time output').textContent, '12:01');
  hour.focus(); hour.fire('focus'); assert.equal(world.day.run, false);
  hour.value = '20'; hour.fire('input'); panel.frame(); assert.equal(world.day.hour, 20);
  hour.value = 'stale'; document.activeElement = null; panel.frame(); assert.equal(hour.value, 20);
});
test('Escape closes the card, clears Follow and restores focus', t => {
  const { root, api, world, panel } = setup(t); api.follow.set(true);
  window.fire('keydown', { key: 'Escape', preventDefault() {} }); panel.frame();
  assert.equal(world.selected, null); assert.equal(api.follow.get(), false);
  assert.equal(root.querySelector('.card').hidden, true); assert.equal(document.activeElement, root.querySelector('.pick'));
});
test('world removal closes a focused card and does not delete another duck on a stale click', t => {
  const { root, api, world, panel } = setup(t);
  root.querySelector('.card').querySelector('h2').focus(); world.selected = null; api.follow.set(true);
  root.querySelector('.remove').fire('click'); assert.equal(world.ducks.length, 1);
  panel.frame(); assert.equal(root.querySelector('.card').hidden, true); assert.equal(api.follow.get(), false);
  assert.equal(document.activeElement, root.querySelector('.pick'));
});
test('Help and card are mutually exclusive; Escape restores the card', t => {
  const { root, panel } = setup(t);
  root.querySelector('.help-open').fire('click'); panel.frame();
  assert.equal(root.querySelector('.card').hidden, true); assert.equal(root.querySelector('.help').hidden, false);
  assert.equal(root.querySelector('.help-open').attrs['aria-expanded'], 'true');
  window.fire('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(root.querySelector('.card').hidden, false); assert.equal(root.querySelector('.help-open').attrs['aria-expanded'], 'false');
});
test('a flyer cannot lose its propeller through a stale enabled wear button', t => {
  const { root, d } = setup(t); d.hat = PROPELLER;
  root.querySelector('.card').querySelector('.hats').fire('click', { target: { closest: () => ({ dataset: { i: '0' }, disabled: false }) } });
  assert.equal(d.hat, PROPELLER);
});
test('abort disconnects observation and makes frame inert', t => {
  const { root, world, panel, controller, disconnected } = setup(t);
  controller.abort(); assert.equal(disconnected(), true);
  world.day.hour = 18; panel.frame(); assert.equal(root.querySelector('.time output').textContent, '12:00');
  root.querySelector('.close').fire('click'); assert.notEqual(world.selected, null);
});
test('the picker steps to the next duck, round again after the last, and refreshes the card', t => {
  const { root, world, panel } = setup(t);
  const first = world.ducks[0], d = { id: 2, colour: 1, hat: 0 }; world.ducks.push(d); panel.frame();
  root.querySelector('.pick').fire('click'); panel.frame();
  assert.equal(world.selected, d); assert.equal(root.querySelector('.card').hidden, false);
  assert.ok(root.querySelector('.card').querySelector('h2').textContent);
  assert.equal(root.querySelector('.pick').textContent, nameOf(2));
  root.querySelector('.pick').fire('click'); panel.frame();
  assert.equal(world.selected, first);
});
