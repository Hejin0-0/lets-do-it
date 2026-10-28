// The page's controls, after Apple's way with an interface (the emilkowalski apple-design skill: purpose, simplicity,
// one place for each thing, glass that floats over the scene). One toolbar along the bottom holds what is used most (a
// duck to add, a race, the book, the hour) and quiet icons for the rest; it hides until the mouse comes near, as a
// desktop's dock. The hour and the help open above their buttons, the book above the toolbar; a picked duck's card sits
// on the right; what is happening now (a race, a duck at sea, a stamp earned) is the island at the top (island.js).
// The glass turns dark after sunset. Text on the page is English, lettered in Leon Sans (lettering.js).
import { DESIGNS, HATS, MAX_DUCKS, PROPELLER, nameOf } from './ducks.js';
import { letter, reletter } from './lettering.js';

const thumb = (i) => new URL(`ducks/${DESIGNS[i].id}-thumb.webp`, document.baseURI).href;
const clock = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const mmss = (t) => (t == null ? '-' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
const night = (h) => h < 6 || h >= 19;
const svg = (d, fill) => `<svg viewBox="0 0 24 24" aria-hidden="true"${fill ? ' class="fill"' : ''}>${d}</svg>`;
const I = {
  flag: svg('<path d="M5.5 21V4.5h11.5l-2.4 4 2.4 4H5.5"/>'),
  book: svg('<path d="M12 6.5C10 5 7 4.6 4 5v13.5c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zM12 6.5V20"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  moon: svg('<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>'),
  tag: svg('<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  mute: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  frame: svg('<path d="M4 9V4.5h4.5M15.5 4.5H20V9M20 15v4.5h-4.5M8.5 19.5H4V15"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.6M12 16.8v.2"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>', true),
  pause: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  close: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
  prev: svg('<path d="M14.5 6l-6 6 6 6"/>'),
  next: svg('<path d="M9.5 6l6 6-6 6"/>'),
};

export const PANEL_HTML = `<div class="island" role="status" aria-live="polite"></div>
<div class="dock" role="toolbar" aria-label="Pool controls">
  <button type="button" class="add primary" data-tip="Add a duck"><img alt="" width="26" height="26"><span>Add a duck</span></button>
  <i class="sep"></i>
  <button type="button" class="race" aria-label="Race" data-tip="Three ducks down the flume">${I.flag}<span>Race</span></button>
  <button type="button" class="book-open" aria-label="Book" aria-expanded="false" aria-controls="pool-book">${I.book}<span>Book</span></button>
  <i class="sep"></i>
  <button type="button" class="time-open" aria-expanded="false" aria-controls="pool-time" aria-label="Time of day" data-tip="Time of day"><b class="sky"></b><output></output></button>
  <i class="sep"></i>
  <button type="button" class="names icon" aria-pressed="false" aria-label="Names" data-tip="Names">${I.tag}</button>
  <button type="button" class="sound icon" aria-pressed="false" aria-label="Sound" data-tip="Sound">${I.mute}</button>
  <button type="button" class="whole icon" aria-label="Whole view" data-tip="Whole view">${I.frame}</button>
  <button type="button" class="help-open icon" aria-expanded="false" aria-controls="pool-help" aria-label="Help" data-tip="Help">${I.help}</button>
</div>
<span class="count sr" aria-live="polite"></span>
<div class="tip" aria-hidden="true" hidden></div>
<div class="pop time" id="pool-time" role="dialog" aria-label="Time of day" hidden>
  <h3>Time of day</h3><output class="big"></output>
  <div class="row"><button type="button" class="run icon" aria-label="Run the clock"></button><input id="pool-hour" type="range" min="0" max="24" step="0.25" aria-label="Hour"></div>
</div>
<div class="pop help" id="pool-help" role="dialog" aria-label="How to play" tabindex="-1" hidden>
  <h3>How to play</h3>
  <ul class="keys"><li>Drag a duck to pick it up. Click it and it hops.</li><li>Drag the water for ripples, the ground to turn.</li><li>Scroll to zoom. Shift and drag to pan. W A S D to move.</li><li>R shows the whole pool. M turns the sound on or off.</li></ul>
  <ul class="touch"><li>Tap a duck: it hops and shows its card.</li><li>Drag a duck to pick it up, the water for ripples.</li><li>Drag the ground to turn. Pinch to zoom.</li><li>Slide two fingers to move.</li></ul>
</div>
<section class="book" id="pool-book" aria-label="The duck book" hidden>
  <header><h2>Duck book</h2>
    <div class="seg" role="tablist" aria-label="Pages"><button type="button" role="tab" id="tab-stamps" aria-controls="book-stamps" tabindex="0" data-tab="stamps" aria-selected="true">Stamps</button><button type="button" role="tab" id="tab-ducks" aria-controls="book-ducks" tabindex="-1" data-tab="ducks" aria-selected="false">Ducks</button><button type="button" role="tab" id="tab-records" aria-controls="book-records" tabindex="-1" data-tab="records" aria-selected="false">Records</button></div>
    <button type="button" class="book-close icon" aria-label="Close the book">${I.close}</button></header>
  <div class="tab" id="book-stamps" aria-labelledby="tab-stamps" tabindex="0" data-tab="stamps" role="tabpanel"><p class="sum"></p><div class="stamps"></div></div>
  <div class="tab" id="book-ducks" aria-labelledby="tab-ducks" tabindex="0" data-tab="ducks" role="tabpanel" hidden><h3>Designs</h3><div class="seen"></div><h3>Hats</h3><div class="worn"></div><h3>Met on this visit</h3><ol class="met"></ol></div>
  <div class="tab" id="book-records" aria-labelledby="tab-records" tabindex="0" data-tab="records" role="tabpanel" hidden><div class="records"></div></div>
</section>
<section class="card" aria-label="The picked duck" hidden>
  <header><img class="face" alt="" width="52" height="52"><div class="who"><h2></h2><p class="meta"></p></div>
    <div class="nav"><button type="button" class="prev icon" aria-label="The duck before">${I.prev}</button><button type="button" class="next icon" aria-label="The next duck">${I.next}</button><button type="button" class="close icon" aria-label="Put the duck down">${I.close}</button></div></header>
  <h3>Design</h3><div class="designs">${DESIGNS.map((d, i) => `<button type="button" data-i="${i}" aria-label="${d.label}" aria-pressed="false"><img src="" alt="" width="40" height="40"></button>`).join('')}</div>
  <h3>Wears</h3><div class="hats">${HATS.map((h, i) => (i === PROPELLER ? '' : `<button type="button" data-i="${i}" aria-pressed="false">${h.label}</button>`)).join('')}</div>
  <p class="flyer" hidden>A flyer keeps its propeller cap: it is what lets it fly.</p>
  <footer><button type="button" class="follow" aria-pressed="false">Follow</button><button type="button" class="remove">Take it out</button></footer>
</section>`;

/** parent's children made anew from [tag, class, text, wrap] rows; each lettered once it is in the page (Leon Sans
 * takes its size from there), and with wrap broken into lines at its own width. Returns the new children. */
function rows(parent, list) {
  const els = list.map(([tag, cls]) => Object.assign(document.createElement(tag), { className: cls }));
  parent.replaceChildren(...els);
  els.forEach((el, i) => { const [, , text, wrap] = list[i]; if (text != null) letter(el, text, wrap ? { maxWidth: el.clientWidth || undefined } : {}); });
  return els;
}

/** api: { world, book (logbook.js), island (island.js), addDuck(), setHour(h), setClock(run), names: { get(), set(v) },
 *  sound: { get(), set(v) }, follow: { get(), set(v) }, wholeView(), pick(duck | null) }. Returns { frame() }: bring the
 *  controls up to date. */
export function installPanel(root, api, signal) {
  const $ = (s) => root.querySelector(s), on = (el, ev, fn) => el.addEventListener(ev, fn, { signal });
  const picked = () => api.world.ducks.includes(api.world.selected);
  const dock = $('.dock'), card = $('.card'), book = $('.book'), tip = $('.tip'), hour = $('#pool-hour'), island = $('.island');
  for (const b of card.querySelectorAll('.designs button')) b.querySelector('img').src = thumb(+b.dataset.i);
  // the words that never change, lettered once (reletter draws them again when the glass turns dark or light)
  for (const el of root.querySelectorAll('.dock button > span, .pop h3, .book h2, .seg button, .book h3, .card h3, .hats button, .flyer, .follow, .remove')) letter(el, el.textContent.trim());
  for (const el of root.querySelectorAll('.help li')) letter(el, el.textContent.trim(), { maxWidth: 330 });

  // A toolbar is one Tab stop; arrows move among its available controls.
  const buttons = [...dock.querySelectorAll('button')];
  const rove = (b) => { for (const x of buttons) x.tabIndex = x === b ? 0 : -1; };
  rove(buttons[0]);
  on(dock, 'focusin', (e) => { if (buttons.includes(e.target)) rove(e.target); });
  on(dock, 'keydown', (e) => {
    const available = buttons.filter((b) => !b.disabled), i = available.indexOf(e.target);
    if (i < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? available.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
    rove(available[next]); available[next].focus(); e.preventDefault();
  });

  // one surface opens from the toolbar at a time (the hour, the help, the book), above the button that opened it, and
  // the same button, Escape or (for the small ones) a press elsewhere puts it away
  const surfaces = { time: [$('#pool-time'), $('.time-open')], help: [$('#pool-help'), $('.help-open')], book: [book, $('.book-open')] };
  let open = null;
  function show(name, byKey) {   // byKey: opened from the keyboard, so the focus goes into it
    if (name === open) name = null;
    const old = open && surfaces[open];
    if (old && old[0].contains(document.activeElement)) old[1].focus();
    hideTip();
    for (const [k, [el, b]] of Object.entries(surfaces)) { el.hidden = k !== name; b.setAttribute('aria-expanded', String(k === name)); }
    open = name;
    if (!name) return;
    const [el, b] = surfaces[name], r = b.getBoundingClientRect?.();
    if (r && name !== 'book') el.style.left = `${Math.max(12, Math.min(innerWidth - el.offsetWidth - 12, r.left + r.width / 2 - el.offsetWidth / 2))}px`;
    if (r) el.style.setProperty('--from-x', `${r.left + r.width / 2 - el.getBoundingClientRect().left}px`);   // it grows out of its button
    if (name === 'book') { last.book = null; last.bookT = null; if (byKey) book.querySelector('.book-close').focus(); }
    if (name === 'time' && byKey) $('.run').focus();
    if (name === 'help' && byKey) el.focus();
  }
  const putAway = () => { const b = open && surfaces[open][1]; show(null); b?.focus(); };
  on($('.time-open'), 'click', (e) => show('time', e.detail === 0));
  on($('.help-open'), 'click', (e) => show('help', e.detail === 0));
  on($('.book-open'), 'click', (e) => show('book', e.detail === 0));
  on($('.book-close'), 'click', putAway);
  on(window, 'pointerdown', (e) => {
    if ((open === 'time' || open === 'help') && !surfaces[open][0].contains(e.target) && !surfaces[open][1].contains(e.target)) show(null);
  });

  on($('.add'), 'click', () => api.addDuck());
  on(hour, 'focus', () => api.setClock(false));
  on(hour, 'input', () => { api.setClock(false); api.setHour(+hour.value); });
  on($('.run'), 'click', () => api.setClock(!api.world.day.run));
  on($('.names'), 'click', () => api.names.set(!api.names.get()));
  on($('.sound'), 'click', () => api.sound.set(!api.sound.get()));
  on($('.whole'), 'click', () => api.wholeView());
  on($('.race'), 'click', () => {   // three ducks afloat, the picked one first (starting again restarts the race)
    const W = api.world, afloat = W.ducks.filter((d) => d.state === 'float' && d.hat !== PROPELLER);
    const ids = [...afloat.filter((d) => d === W.selected), ...afloat.filter((d) => d !== W.selected)].slice(0, 3).map((d) => d.id);
    if (ids.length >= 2) W.startRace(ids);
  });
  on(island, 'click', (e) => { if (e.target.closest('.act')) api.world.sendBoat(); });

  // the picked duck's card: its design and what it wears, the duck before and after it, following it, taking it out
  const focusDock = () => { const b = buttons.find((x) => !x.disabled); if (b) { rove(b); b.focus(); } };
  const close = () => { const inside = card.contains(document.activeElement); api.follow.set(false); api.pick(null); card.hidden = true; if (inside) focusDock(); };
  const step = (k) => { const D = api.world.ducks; if (!D.length || !picked()) return; api.follow.set(false); api.pick(D[(D.indexOf(api.world.selected) + k + D.length) % D.length]); };
  on($('.close'), 'click', close);
  on($('.prev'), 'click', () => step(-1));
  on($('.next'), 'click', () => step(1));
  on(card.querySelector('.designs'), 'click', (e) => { const b = e.target.closest('button'); if (b && picked()) api.world.setColour(+b.dataset.i); });
  on(card.querySelector('.hats'), 'click', (e) => { const b = e.target.closest('button'); if (b && picked() && !b.disabled && api.world.selected?.hat !== PROPELLER) api.world.setHat(+b.dataset.i); });
  on($('.follow'), 'click', () => { if (picked()) api.follow.set(!api.follow.get()); });
  on($('.remove'), 'click', () => { api.follow.set(false); if (picked()) api.world.removeDuck(); focusDock(); });
  on(window, 'keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (open) { putAway(); e.preventDefault(); } else if (!card.hidden) { close(); e.preventDefault(); }
  });

  // the book: three pages, and the ducks met are a way to pick one
  let tab = 'stamps';
  const tabs = [...book.querySelectorAll('.seg button')];
  function selectTab(b) {
    tab = b.dataset.tab; last.book = null; last.bookT = null;
    for (const t of tabs) { t.setAttribute('aria-selected', String(t === b)); t.tabIndex = t === b ? 0 : -1; }
    for (const p of book.querySelectorAll('.tab')) p.hidden = p.dataset.tab !== tab;
  }
  on(book.querySelector('.seg'), 'click', (e) => { const b = e.target.closest('[data-tab]'); if (tabs.includes(b)) selectTab(b); });
  on(book.querySelector('.seg'), 'keydown', (e) => {
    const i = tabs.indexOf(e.target);
    if (i < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next]); tabs[next].focus(); e.preventDefault();
  });
  on(book.querySelector('.met'), 'click', (e) => { const b = e.target.closest('button[data-id]'), d = b && api.world.ducks.find((x) => x.id === +b.dataset.id); if (d) api.pick(d); });
  function fillBook() {
    const B = api.book, stamps = B.stamps, R = B.records;
    if (tab === 'stamps') {
      letter(book.querySelector('.sum'), `${stamps.filter((s) => s.earned).length} of ${stamps.length} stamps`);
      rows(book.querySelector('.stamps'), stamps.map((s) => ['div', s.earned ? 'stamp earned' : 'stamp'])).forEach((el, i) => rows(el, [['h4', '', stamps[i].title, true], ['p', '', stamps[i].text, true]]));
    } else if (tab === 'ducks') {
      book.querySelector('.seen').replaceChildren(...B.designs.map((d) => { const img = new Image(40, 40); img.src = thumb(d.index); img.alt = `${d.label}${d.seen ? '' : ' (not met yet)'}`; img.className = d.seen ? '' : 'unseen'; return img; }));
      rows(book.querySelector('.worn'), B.hats.map((h) => ['span', h.worn ? 'chip worn' : 'chip', h.label]));
      const met = B.ducks.slice(0, 12), active = document.activeElement;
      const focusedId = book.querySelector('.met').contains(active) ? active.dataset.id : null;
      rows(book.querySelector('.met'), met.map(() => ['li', ''])).forEach((li, i) => {
        const d = met[i], b = Object.assign(document.createElement('button'), { type: 'button', disabled: !d.here });
        b.dataset.id = d.id; li.append(b);
        rows(b, [['span', 'name', d.name], ['span', 'laps', d.laps ? `${d.laps} ${d.laps === 1 ? 'lap' : 'laps'}, best ${mmss(d.bestLap)}` : 'No laps yet']]);
      });
      if (focusedId != null) {
        const button = [...book.querySelector('.met').querySelectorAll('button')].find((b) => b.dataset.id === focusedId && !b.disabled);
        (button || tabs.find((t) => t.dataset.tab === 'ducks')).focus();
      }
    } else {
      rows(book.querySelector('.records'), [['div', 'stat'], ['div', 'stat'], ['div', 'stat']]).forEach((el, i) =>
        rows(el, [['b', '', [mmss(R.bestLap), String(R.mostLaps), String(R.racesWon)][i]], ['span', '', ['Best lap', 'Most laps by one duck', 'Races won'][i], true]]));
    }
  }

  // the island: an element for each thing happening, kept by its key so only a real change moves it
  function drawIsland(items) {
    const keep = new Set(items.map((x) => x.key));
    for (const el of [...island.children]) if (!keep.has(el.dataset.key)) { if (el.contains(document.activeElement)) focusDock(); el.remove(); }
    items.forEach((it, i) => {
      let el = [...island.children].find((x) => x.dataset.key === it.key);
      if (el && el.dataset.action !== String(!!it.action)) { if (el.contains(document.activeElement)) focusDock(); el.remove(); el = null; }
      if (!el) {
        el = document.createElement('div'); el.dataset.key = it.key; el.dataset.action = String(!!it.action); el.className = 'isl';
        el.innerHTML = `<i class="dot"></i><span class="t"></span><span class="d"></span>${it.action ? '<button type="button" class="act"><span></span></button>' : ''}<span class="rows"></span>`;
      }
      el.dataset.kind = it.kind;   // not a class: .race and the like name the toolbar's buttons
      if (island.children[i] !== el) island.insertBefore(el, island.children[i] ?? null);
      const rowText = (it.rows || []).map((r) => `${r.place ?? '-'} ${r.name}${r.time == null ? '' : ` ${mmss(r.time)}`}`).join('    ');
      for (const [sel, text] of [['.t', it.title], ['.d', it.detail ?? ''], ['.rows', rowText], ['.act span', 'Send the boat']]) {
        const part = el.querySelector(sel); if (!part || part.dataset.text === text) continue;
        part.dataset.text = text; part.hidden = !text; if (text) letter(part, text);
      }
    });
  }

  // the tooltip: after a short wait over a quiet button, then at once while moving along the toolbar
  let tipT = 0, tipGone = -1e9;
  const showTip = (b) => {
    clearTimeout(tipT);
    const go = () => {
      letter(tip, b.dataset.tip); tip.hidden = false;
      const r = b.getBoundingClientRect(), w = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`; tip.style.top = `${r.top - tip.offsetHeight - 10}px`;
    };
    if (!tip.hidden || performance.now() - tipGone < 400) go(); else tipT = setTimeout(go, 450);
  };
  const hideTip = () => { clearTimeout(tipT); if (!tip.hidden) tipGone = performance.now(); tip.hidden = true; };
  on(dock, 'pointerover', (e) => { const b = e.target.closest?.('[data-tip]'); if (b && e.pointerType === 'mouse' && !open) showTip(b); else hideTip(); });
  on(dock, 'pointerleave', hideTip);
  on(dock, 'pointerdown', hideTip);

  // the toolbar stays out of sight until a mouse comes near the bottom of the page (as a desktop's dock that hides
  // itself), and goes again a moment after it leaves, unless something opened from it is still up; the keyboard brings
  // it up by focus (style.css :focus-within)
  let hideT = 0;
  const pinned = () => dock.contains(document.activeElement) || !!open;
  const reveal = (v) => { root.classList.toggle('dock-shown', v); if (!v) hideTip(); };
  on(window, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const near = innerHeight - e.clientY < 90 || dock.contains(e.target) || (open && surfaces[open][0].contains(e.target));
    if (near) { clearTimeout(hideT); hideT = 0; reveal(true); }
    else if (root.classList.contains('dock-shown') && !hideT) hideT = setTimeout(() => { hideT = 0; if (!pinned()) reveal(false); }, 700);
  });
  on(window, 'pointerout', (e) => { if (e.relatedTarget || e.pointerType !== 'mouse') return; clearTimeout(hideT); hideT = setTimeout(() => { hideT = 0; if (!pinned()) reveal(false); }, 700); });   // off the page
  // what sits above the toolbar needs its height
  const ro = new ResizeObserver(() => root.style.setProperty('--dock-h', `${dock.offsetHeight}px`));
  ro.observe(dock); signal.addEventListener('abort', () => { ro.disconnect(); clearTimeout(hideT); clearTimeout(tipT); }, { once: true });

  let last = {};
  const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  const press = (el, v) => { el.setAttribute('aria-pressed', String(!!v)); reletter(el); };   // on and off differ in colour, and Leon Sans is drawn
  return {
    frame() {
      if (signal.aborted) return;
      const W = api.world, n = W.ducks.length, d = W.ducks.includes(W.selected) ? W.selected : null;
      if (W.selected && !d) api.pick(null);
      if (!d && api.follow.get()) api.follow.set(false);
      set('dark', night(W.day.hour), (v) => { root.classList.toggle('dark', v); reletter(root); });
      set('count', n, () => {
        const add = $('.add'), full = n >= MAX_DUCKS;
        $('.count').textContent = `${n} of ${MAX_DUCKS}`;
        if (full && add.tabIndex === 0) { const b = buttons.find((x) => x !== add && !x.disabled); if (b) { rove(b); if (document.activeElement === add) b.focus(); } }
        add.disabled = full;
        $('.add').dataset.tip = n >= MAX_DUCKS ? 'The pool is full' : `${n} of ${MAX_DUCKS} ducks`;
      });
      set('next', W.next.colour, (c) => { $('.add img').src = thumb(c); });
      set('hour', clock(W.day.hour), (v) => {
        letter($('.time-open output'), v); letter($('.pop .big'), v, { tracking: -0.15 }); hour.setAttribute('aria-valuetext', v);
        hour.style.setProperty('--p', `${(W.day.hour / 24) * 100}%`);
      });
      set('sky', night(W.day.hour), (v) => { $('.sky').innerHTML = v ? I.moon : I.sun; });
      if (document.activeElement !== hour) hour.value = W.day.hour;
      set('run', W.day.run, (r) => { const b = $('.run'); b.innerHTML = r ? I.pause : I.play; b.setAttribute('aria-label', r ? 'Stop the clock' : 'Run the clock'); });
      set('names', api.names.get(), (v) => press($('.names'), v));
      set('sound', api.sound.get(), (v) => { press($('.sound'), v); $('.sound').innerHTML = v ? I.sound : I.mute; });
      set('follow', api.follow.get(), (v) => press($('.follow'), v));
      set('racing', !!W.race?.running, (v) => { const b = $('.race'); b.setAttribute('aria-label', v ? 'Race in progress, restart race' : 'Race'); b.dataset.running = v ? '1' : ''; reletter(b); });
      if (api.island) {
        api.island.update(W, { fresh: api.book ? api.book.fresh : [], now: performance.now() / 1000 });
        drawIsland(api.island.items);
      }
      if (api.book) {
        api.book.take();
        if (!book.hidden && last.bookT !== Math.floor(W.time)) {   // once a world second: refill when anything on the page changed
          last.bookT = Math.floor(W.time); const B = api.book;
          set('book', JSON.stringify([tab, B.stamps.map((s) => s.earned), B.designs.map((x) => x.seen), B.hats.map((x) => x.worn), B.records, B.ducks.slice(0, 12)]), fillBook);
        }
      }
      set('picked', d ? d.id : -1, () => {
        if (!d && card.contains(document.activeElement)) focusDock();
        card.hidden = !d;
        if (d) letter(card.querySelector('h2'), nameOf(d.id), { tracking: -0.2 });
      });
      if (d) {
        const s = d.stats;
        set('meta', s ? `${d.id}:${s.laps}:${s.bestLap}` : d.id, () => letter(card.querySelector('.meta'), s ? `${s.laps} ${s.laps === 1 ? 'lap' : 'laps'}${s.bestLap == null ? '' : `, best ${mmss(s.bestLap)}`}` : DESIGNS[d.colour].label));
        set('colour', `${d.id}:${d.colour}`, () => {
          card.querySelector('.face').src = thumb(d.colour);
          for (const b of card.querySelectorAll('.designs button')) press(b, +b.dataset.i === d.colour);
        });
        set('hat', `${d.id}:${d.hat}`, () => {
          const flyer = d.hat === PROPELLER;
          if (flyer && card.querySelector('.hats').contains(document.activeElement)) $('.close').focus();
          card.querySelector('.flyer').hidden = !flyer;
          for (const b of card.querySelectorAll('.hats button')) { press(b, +b.dataset.i === d.hat); b.disabled = flyer; }
        });
      }
    },
  };
}
