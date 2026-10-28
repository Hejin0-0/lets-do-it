import test from 'node:test';
import assert from 'node:assert/strict';
import { installPanel, PANEL_HTML } from '../src/pool/panel.js';
import { PROPELLER, nameOf } from '../src/pool/ducks.js';

// Small element doubles exercise state and event contracts without a DOM or layout engine.
class Element {
  children = []; parent = null; nodes = new Map(); attrs = {}; listeners = new Map(); hidden = false; style = { setProperty() {} }; dataset = {}; classList = { values: new Set(), toggle(k, v) { if (v) this.values.add(k); else this.values.delete(k); }, contains(k) { return this.values.has(k); } };
  querySelector(s) { if (!this.nodes.has(s)) this.nodes.set(s, new Element()); return this.nodes.get(s); }
  lists = new Map();
  querySelectorAll(s) { return this.lists.get(s) || (s === 'button' ? this.children.flatMap(c => c.type === 'button' ? [c] : c.querySelectorAll(s)) : []); }
  addEventListener(type, fn, { signal } = {}) { this.listeners.set(type, fn); signal?.addEventListener('abort', () => this.listeners.delete(type), { once: true }); }
  fire(type, e = {}) { this.listeners.get(type)?.(e); }
  setAttribute(k, v) { this.attrs[k] = v; }
  replaceChildren(...children) { this.children = children; for (const c of children) c.parent = this; }
  append(child) { this.children.push(child); child.parent = this; }
  insertBefore(child, before) { if (child.parent) child.remove(); const i = before ? this.children.indexOf(before) : this.children.length; this.children.splice(i, 0, child); child.parent = this; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  focus() { document.activeElement = this; }
  contains(el) { return el === this || [...this.nodes.values(), ...this.children].some(n => n.contains(el)); }
}
function setup(t) {
  const saved = Object.fromEntries(['window', 'document', 'ResizeObserver', 'Option', 'innerHeight'].map(k => [k, globalThis[k]]));
  globalThis.window = new Element(); globalThis.document = { baseURI: 'https://example.test/', activeElement: null, createElement: () => new Element() };
  globalThis.innerHeight = 900;
  let disconnected = false;
  globalThis.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  const root = new Element(), controller = new AbortController(), d = { id: 1, colour: 0, hat: 0 };
  const world = { ducks: [d], selected: d, next: { colour: 0 }, day: { hour: 12, run: true },
    removeDuck() { this.ducks = []; this.selected = null; }, setHat(h) { this.selected.hat = h; } };
  const toggle = () => ({ value: false, get() { return this.value; }, set(v) { this.value = v; } });
  const api = { world, names: toggle(), sound: toggle(), follow: toggle(), pick(d) { world.selected = d; },
    setClock(v) { world.day.run = v; }, setHour(v) { world.day.hour = v; }, addDuck() {}, wholeView() {} };
  const dock = root.querySelector('.dock'), book = root.querySelector('.book');
  dock.lists.set('button', ['.add', '.race', '.book-open', '.time-open', '.names', '.sound', '.whole', '.help-open'].map(s => root.querySelector(s)));
  const tabs = ['stamps', 'ducks', 'records'].map(tab => Object.assign(new Element(), { dataset: { tab } }));
  book.lists.set('.seg button', tabs); book.lists.set('.tab', tabs.map(x => Object.assign(new Element(), { dataset: { tab: x.dataset.tab } })));
  root.querySelector('.tip').hidden = true;
  const panel = installPanel(root, api, controller.signal); panel.frame();
  t.after(() => { controller.abort(); for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } });
  return { root, api, world, d, panel, controller, disconnected: () => disconnected };
}
test('clock updates every minute; focus pauses and blur resynchronizes within the same minute', t => {
  const { root, world, panel } = setup(t), hour = root.querySelector('#pool-hour');
  world.day.hour = 12.02; panel.frame(); assert.equal(root.querySelector('.time-open output').textContent, '12:01');
  hour.focus(); hour.fire('focus'); assert.equal(world.day.run, false);
  hour.value = '20'; hour.fire('input'); panel.frame(); assert.equal(world.day.hour, 20);
  hour.value = 'stale'; document.activeElement = null; panel.frame(); assert.equal(hour.value, 20);
});
test('Escape closes the card, clears Follow and restores focus', t => {
  const { root, api, world, panel } = setup(t); api.follow.set(true); root.querySelector('.card').querySelector('h2').focus();
  window.fire('keydown', { key: 'Escape', preventDefault() {} }); panel.frame();
  assert.equal(world.selected, null); assert.equal(api.follow.get(), false);
  assert.equal(root.querySelector('.card').hidden, true); assert.equal(document.activeElement, root.querySelector('.add'));
});
test('world removal closes a focused card and does not delete another duck on a stale click', t => {
  const { root, api, world, panel } = setup(t);
  root.querySelector('.card').querySelector('h2').focus(); world.selected = null; api.follow.set(true);
  root.querySelector('.remove').fire('click'); assert.equal(world.ducks.length, 1);
  panel.frame(); assert.equal(root.querySelector('.card').hidden, true); assert.equal(api.follow.get(), false);
  assert.equal(document.activeElement, root.querySelector('.add'));
});
test('one toolbar surface at a time beside the card; Escape puts it away first, then the card', t => {
  const { root, panel } = setup(t);
  root.querySelector('.help-open').fire('click'); panel.frame();
  assert.equal(root.querySelector('.card').hidden, false); assert.equal(root.querySelector('#pool-help').hidden, false);
  assert.equal(root.querySelector('.help-open').attrs['aria-expanded'], 'true');
  root.querySelector('.time-open').fire('click');
  assert.equal(root.querySelector('#pool-help').hidden, true); assert.equal(root.querySelector('#pool-time').hidden, false);
  window.fire('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(root.querySelector('#pool-time').hidden, true); assert.equal(root.querySelector('.time-open').attrs['aria-expanded'], 'false');
  assert.equal(document.activeElement, root.querySelector('.time-open')); assert.equal(root.querySelector('.card').hidden, false);
  window.fire('keydown', { key: 'Escape', preventDefault() {} }); panel.frame();
  assert.equal(root.querySelector('.card').hidden, true);
});
test('a flyer cannot lose its propeller through a stale enabled wear button', t => {
  const { root, d } = setup(t); d.hat = PROPELLER;
  root.querySelector('.card').querySelector('.hats').fire('click', { target: { closest: () => ({ dataset: { i: '0' }, disabled: false }) } });
  assert.equal(d.hat, PROPELLER);
});
test('abort disconnects observation and makes frame inert', t => {
  const { root, world, panel, controller, disconnected } = setup(t);
  controller.abort(); assert.equal(disconnected(), true);
  world.day.hour = 18; panel.frame(); assert.equal(root.querySelector('.time-open output').textContent, '12:00');
  root.querySelector('.close').fire('click'); assert.notEqual(world.selected, null);
});
test("the card's arrows step to the next and the previous duck, round again past the ends", t => {
  const { root, world, panel } = setup(t);
  const first = world.ducks[0], d = { id: 2, colour: 1, hat: 0 }; world.ducks.push(d); panel.frame();
  root.querySelector('.next').fire('click'); panel.frame();
  assert.equal(world.selected, d); assert.equal(root.querySelector('.card').hidden, false);
  assert.equal(root.querySelector('.card').querySelector('h2').textContent, nameOf(2));
  root.querySelector('.next').fire('click'); panel.frame();
  assert.equal(world.selected, first);
  root.querySelector('.prev').fire('click'); panel.frame();
  assert.equal(world.selected, d);
});

test('toolbar uses roving arrows and skips disabled buttons', t => {
  const { root } = setup(t), dock = root.querySelector('.dock'), buttons = dock.querySelectorAll('button');
  assert.deepEqual(buttons.map(b => b.tabIndex), [0, -1, -1, -1, -1, -1, -1, -1]);
  buttons[1].disabled = true; buttons[0].focus();
  dock.fire('keydown', { key: 'ArrowRight', target: buttons[0], preventDefault() {} });
  assert.equal(document.activeElement, buttons[2]);
  dock.fire('keydown', { key: 'End', target: buttons[2], preventDefault() {} });
  assert.equal(document.activeElement, buttons[7]);
});
test('book tabs are linked and arrow keys select and focus the next page', t => {
  const { root } = setup(t), book = root.querySelector('.book'), tabs = book.querySelectorAll('.seg button');
  assert.match(PANEL_HTML, /aria-controls="book-stamps"/); assert.match(PANEL_HTML, /aria-labelledby="tab-stamps"/);
  tabs[0].focus(); book.querySelector('.seg').fire('keydown', { key: 'ArrowRight', target: tabs[0], preventDefault() {} });
  assert.equal(document.activeElement, tabs[1]); assert.equal(tabs[1].attrs['aria-selected'], 'true');
  assert.equal(book.querySelectorAll('.tab')[1].hidden, false);
});
test('pressing a popover trigger twice closes it without reopening on pointerdown', t => {
  const { root } = setup(t), trigger = root.querySelector('.time-open');
  trigger.fire('click', {}); window.fire('pointerdown', { target: trigger }); trigger.fire('click', {});
  assert.equal(root.querySelector('#pool-time').hidden, true);
});
test('stale card arrows cannot select a different duck', t => {
  const { root, world } = setup(t); world.ducks = [{ id: 2, colour: 0, hat: 0 }];
  root.querySelector('.next').fire('click'); assert.equal(world.selected.id, 1);
});
test('race reports idle after the race object disappears', t => {
  const { root, world, panel } = setup(t); world.race = { running: true }; panel.frame(); assert.equal(root.querySelector('.race').attrs['aria-label'], 'Race in progress, restart race');
  world.race = null; panel.frame(); assert.equal(root.querySelector('.race').attrs['aria-label'], 'Race');
});

test('island preserves a changing action and returns focus when it disappears', t => {
  const { root, api, panel } = setup(t); let items = [{ key: 'sea', kind: 'sea', title: 'Sea' }];
  api.island = { update() {}, get items() { return items; } }; panel.frame();
  items = [{ ...items[0], action: 'sendBoat' }]; panel.frame();
  const el = root.querySelector('.island').children[0];
  assert.match(el.innerHTML, /class="act"/);
  el.querySelector('.act').focus(); items = []; panel.frame();
  assert.equal(document.activeElement, root.querySelector('.add'));
});
test('switching surfaces restores focus from the hidden surface', t => {
  const { root } = setup(t); root.querySelector('.time-open').fire('click', {});
  root.querySelector('#pool-time').querySelector('input').focus(); root.querySelector('.help-open').fire('click', {});
  assert.equal(document.activeElement, root.querySelector('.time-open'));
});
test('an open surface cancels a pending tooltip', async t => {
  const { root } = setup(t), dock = root.querySelector('.dock'), b = root.querySelector('.help-open');
  b.dataset.tip = 'Help'; dock.fire('pointerover', { target: { closest: () => b }, pointerType: 'mouse' });
  b.fire('click', {}); await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(root.querySelector('.tip').hidden, true);
});

test('book refresh keeps focus on the same duck, or its tab if that duck has left', t => {
  const { root, api, world, panel } = setup(t), book = root.querySelector('.book'), tabs = book.querySelectorAll('.seg button');
  world.time = 1; api.book = { stamps: [], designs: [], hats: [], records: {}, ducks: [{ id: 1, name: 'Duck', here: true, laps: 0 }], fresh: [], take() {} };
  root.querySelector('.book-open').fire('click', {});
  book.querySelector('.seg').fire('click', { target: { closest: () => tabs[1] } }); panel.frame();
  const met = book.querySelector('.met'); met.querySelectorAll('button')[0].focus();
  world.time++; api.book.ducks[0].laps = 1; panel.frame();
  assert.equal(document.activeElement, met.querySelectorAll('button')[0]);
  world.time++; api.book.ducks[0].here = false; panel.frame();
  assert.equal(document.activeElement, tabs[1]); assert.equal(met.querySelectorAll('button')[0].disabled, true);
});
test('outside press closes the small popover without dismissing the card', t => {
  const { root } = setup(t); root.querySelector('.time-open').fire('click', {});
  window.fire('pointerdown', { target: root.querySelector('.card') });
  assert.equal(root.querySelector('#pool-time').hidden, true); assert.equal(root.querySelector('.card').hidden, false);
});
test('closing a focused card with a full pool focuses an enabled toolbar control', t => {
  const { root, panel, world } = setup(t); world.ducks = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, colour: 0, hat: 0 }));
  world.selected = world.ducks[0]; panel.frame(); root.querySelector('.card').querySelector('h2').focus();
  window.fire('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(document.activeElement, root.querySelector('.race'));
});
test('phone icon-only Race and Book retain accessible names', () => {
  assert.match(PANEL_HTML, /class="race" aria-label="Race"/);
  assert.match(PANEL_HTML, /class="book-open" aria-label="Book"/);
});

test('keyboard opening enters time and help, Escape returns to their trigger', t => {
  const { root } = setup(t);
  root.querySelector('.time-open').fire('click', { detail: 0 }); assert.equal(document.activeElement, root.querySelector('.run'));
  window.fire('keydown', { key: 'Escape', preventDefault() {} }); assert.equal(document.activeElement, root.querySelector('.time-open'));
  root.querySelector('.help-open').fire('click', { detail: 0 }); assert.equal(document.activeElement, root.querySelector('#pool-help'));
  window.fire('keydown', { key: 'Escape', preventDefault() {} }); assert.equal(document.activeElement, root.querySelector('.help-open'));
});
test('the hide timer leaves the toolbar shown while a book or toolbar focus pins it', async t => {
  const { root } = setup(t), target = new Element();
  window.fire('pointermove', { pointerType: 'mouse', clientY: 890, target });
  root.querySelector('.book-open').fire('click', {});
  window.fire('pointermove', { pointerType: 'mouse', clientY: 100, target });
  await new Promise(resolve => setTimeout(resolve, 730)); assert.equal(root.classList.contains('dock-shown'), true);
  root.querySelector('.book-open').fire('click', {}); root.querySelector('.dock').focus();
  window.fire('pointermove', { pointerType: 'mouse', clientY: 100, target });
  await new Promise(resolve => setTimeout(resolve, 730)); assert.equal(root.classList.contains('dock-shown'), true);
});
test('race can be restarted and picks the selected afloat duck first', t => {
  const { root, world } = setup(t); const d = { id: 2, colour: 0, hat: 0, state: 'float' };
  world.ducks[0].state = 'float'; world.ducks.push(d); world.selected = d; world.race = { running: true };
  let ids; world.startRace = x => { ids = x; }; root.querySelector('.race').fire('click');
  assert.deepEqual(ids, [2, 1]);
});
