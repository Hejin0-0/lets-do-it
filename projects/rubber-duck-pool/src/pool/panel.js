// The page's controls: a dock along the bottom (a duck to add, the hour and the clock, the names, the sound, the whole
// view, the help) and, while a duck is picked, its card (its design, what it wears, following it, taking it away).
// Coloured as the pool is (its tiles, its deep water, the duck's yellow) and outlined as the mural's cartoon is
// (style.css, under .pool). Text on the page is English, lettered in Leon Sans (lettering.js).
import { DESIGNS, HATS, MAX_DUCKS, PROPELLER, nameOf } from './ducks.js';
import { letter } from './lettering.js';

const thumb = (i) => new URL(`ducks/${DESIGNS[i].id}-thumb.webp`, document.baseURI).href;
const clock = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const PLAY = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z"/></svg>';
const PAUSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4h4v12H5zM11 4h4v12h-4z"/></svg>';
const CLOSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

export const PANEL_HTML = `<div class="dock" role="group" aria-label="Pool controls">
  <button type="button" class="add primary"><img alt="" width="28" height="28"><span>Add a duck</span></button>
  <span class="count" aria-live="polite"></span>
  <button type="button" class="pick" title="The next duck">Pick a duck</button>
  <div class="time"><label for="pool-hour"><span>Time</span> <output aria-live="off"></output></label><input id="pool-hour" type="range" min="0" max="24" step="0.25">
    <button type="button" class="run icon" aria-label="Run the clock"></button></div>
  <button type="button" class="race">Race</button>
  <button type="button" class="book-open" aria-expanded="false" aria-controls="pool-book">Book</button>
  <button type="button" class="names" aria-pressed="false">Names</button>
  <button type="button" class="sound" aria-pressed="false">Sound</button>
  <button type="button" class="whole">Whole view</button>
  <button type="button" class="help-open" aria-expanded="false" aria-controls="pool-help">Help</button>
</div>
<div class="help" id="pool-help" hidden>
  <p class="keys">W A S D move, Shift faster. Drag the water: ripples. Drag the ground or right-drag: turn. Wheel: zoom. Shift+drag or the middle button: pan. Drag a duck or a float: pick it up. Click a duck: it hops. R whole view, M sound.</p>
  <p class="touch">Drag the ground: turn. Drag the water: ripples. Two fingers: pinch to zoom, slide to move. Tap a duck: it hops and shows its card. Drag it: pick it up.</p>
</div>
<button type="button" class="boat" hidden>Send the boat</button>
<section class="race-board" aria-label="The race" hidden><h3>Race</h3><ol></ol></section>
<section class="book" id="pool-book" aria-label="The duck book" hidden>
  <header><h2>Duck book</h2><button type="button" class="book-close icon" aria-label="Close the book">${CLOSE}</button></header>
  <h3>Stamps</h3><div class="stamps"></div><h3>Designs</h3><div class="seen"></div><h3>Hats</h3><div class="worn"></div>
  <h3>Records</h3><p class="records"></p><h3>Ducks met</h3><ol class="met"></ol>
</section>
<div class="notice" role="status" hidden></div>
<section class="card" aria-label="The picked duck" hidden>
  <header><img alt="" width="44" height="44"><h2></h2><button type="button" class="close icon" aria-label="Put the duck down">${CLOSE}</button></header>
  <h3>Design</h3><div class="designs">${DESIGNS.map((d, i) => `<button type="button" data-i="${i}" aria-label="${d.label}" aria-pressed="false"><img src="" alt="" width="40" height="40"></button>`).join('')}</div>
  <h3>Wears</h3><div class="hats">${HATS.map((h, i) => (i === PROPELLER ? '' : `<button type="button" data-i="${i}" aria-pressed="false">${h.label}</button>`)).join('')}</div>
  <p class="flyer" hidden>A flyer keeps its propeller cap: it is what lets it fly.</p>
  <footer><button type="button" class="follow" aria-pressed="false">Follow it</button><button type="button" class="remove">Take it out</button></footer>
</section>`;

/** parent's children made anew from [tag, class, text] rows; each lettered once it is in the page (Leon Sans takes its
 * size from there) and wrapped at its own width. Returns the new children. */
function rows(parent, list) {
  const els = list.map(([tag, cls]) => Object.assign(document.createElement(tag), { className: cls }));
  parent.replaceChildren(...els);
  els.forEach((el, i) => { if (list[i][2] != null) letter(el, list[i][2], { maxWidth: el.clientWidth || undefined }); });
  return els;
}
const mmss = (t) => (t == null ? '-' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);

/** api: { world, book (logbook.js), addDuck(), setHour(h), setClock(run), names: { get(), set(v) }, sound: { get(), set(v) },
 *  follow: { get(), set(v) }, wholeView(), pick(duck | null) }. Returns { frame() }: bring the controls up to date. */
export function installPanel(root, api, signal) {
  const $ = (s) => root.querySelector(s), on = (el, ev, fn) => el.addEventListener(ev, fn, { signal });
  const picked = () => api.world.ducks.includes(api.world.selected);
  const dock = $('.dock'), card = $('.card'), help = $('.help'), hour = $('#pool-hour'), out = $('.time output');
  for (const b of card.querySelectorAll('.designs button')) b.querySelector('img').src = thumb(+b.dataset.i);
  // the words that never change, lettered once (the help's paragraphs wrapped to their box)
  for (const el of root.querySelectorAll('.add span, .time label span, .race, .book-open, .book h2, .book h3, .race-board h3, .names, .sound, .whole, .help-open, .card h3, .hats button, .flyer, .follow, .remove')) letter(el, el.textContent.trim());
  const lettered = (el, text) => letter(el, text, el.tagName === 'P' ? { maxWidth: 520 } : {});
  for (const el of help.querySelectorAll('p')) { const t = el.textContent.trim(); help.hidden = false; lettered(el, t); help.hidden = true; }
  on($('.add'), 'click', () => api.addDuck());
  on(hour, 'focus', () => api.setClock(false));
  on(hour, 'input', () => { api.setClock(false); api.setHour(+hour.value); });
  on($('.run'), 'click', () => api.setClock(!api.world.day.run));
  on($('.names'), 'click', () => api.names.set(!api.names.get()));
  on($('.sound'), 'click', () => api.sound.set(!api.sound.get()));
  on($('.whole'), 'click', () => api.wholeView());
  const showHelp = (v) => { help.hidden = !v; card.hidden = v || !api.world.selected; $('.help-open').setAttribute('aria-expanded', String(v)); };
  on($('.help-open'), 'click', () => showHelp(help.hidden));
  on($('.pick'), 'click', () => {   // the next duck in the pool, round again after the last
    const D = api.world.ducks; if (!D.length) return;
    api.follow.set(false); api.pick(D[(D.indexOf(api.world.selected) + 1) % D.length]); showHelp(false);
  });
  on(card.querySelector('.designs'), 'click', (e) => { const b = e.target.closest('button'); if (b && picked()) api.world.setColour(+b.dataset.i); });
  on(card.querySelector('.hats'), 'click', (e) => { const b = e.target.closest('button'); if (b && picked() && !b.disabled && api.world.selected?.hat !== PROPELLER) api.world.setHat(+b.dataset.i); });
  const focusDock = () => $('.pick').focus();
  const close = () => { api.follow.set(false); api.pick(null); card.hidden = true; focusDock(); };
  on($('.close'), 'click', close);
  on(window, 'keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!help.hidden) { showHelp(false); $('.help-open').focus(); e.preventDefault(); }
    else if (!book.hidden) { showBook(false); $('.book-open').focus(); e.preventDefault(); }
    else if (!card.hidden) { close(); e.preventDefault(); }
  });
  on($('.follow'), 'click', () => { if (picked()) api.follow.set(!api.follow.get()); });
  on($('.remove'), 'click', () => { api.follow.set(false); if (picked()) api.world.removeDuck(); focusDock(); });
  // the dock stays out of sight until a mouse comes near the bottom of the page (as a desktop's dock that hides itself),
  // and goes again a moment after it leaves; the keyboard brings it up by focus (style.css :focus-within)
  let hideT = 0;
  const reveal = (v) => { root.classList.toggle('dock-shown', v); if (!v && !help.hidden) showHelp(false); };
  on(window, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const near = innerHeight - e.clientY < 90 || dock.contains(e.target) || help.contains(e.target);
    if (near) { clearTimeout(hideT); hideT = 0; reveal(true); }
    else if (root.classList.contains('dock-shown') && !hideT) hideT = setTimeout(() => { hideT = 0; if (!dock.contains(document.activeElement)) reveal(false); }, 700);
  });
  on(window, 'pointerout', (e) => { if (e.relatedTarget || e.pointerType !== 'mouse') return; clearTimeout(hideT); hideT = setTimeout(() => { hideT = 0; reveal(false); }, 700); });   // off the page
  // play: a race of three ducks afloat (the picked one first), the boat for those out at sea, the book
  const afloat = () => api.world.ducks.filter((d) => d.state === 'float' && d.hat !== PROPELLER);
  const notice = (text) => { const n = $('.notice'); letter(n, text); n.hidden = false; clearTimeout(notice.t); notice.t = setTimeout(() => { n.hidden = true; }, 3200); };
  on($('.race'), 'click', () => {
    const W = api.world, first = afloat().includes(W.selected) ? [W.selected] : [];
    const ids = [...first, ...afloat().filter((d) => !first.includes(d))].slice(0, 3).map((d) => d.id);
    if (ids.length < 2 || !W.startRace(ids)) notice('Two ducks in the water are needed for a race.');
  });
  on($('.boat'), 'click', () => { if (!api.world.sendBoat()) notice('The boat cannot go out just now.'); });
  const book = $('.book'), showBook = (v) => { book.hidden = !v; $('.book-open').setAttribute('aria-expanded', String(v)); if (v) { last.book = null; $('.book-close').focus(); } };
  showBook(false);
  on($('.book-open'), 'click', () => showBook(book.hidden));
  on($('.book-close'), 'click', () => { showBook(false); $('.book-open').focus(); });
  function fillBook() {
    const B = api.book, stamps = B.stamps;
    rows(book.querySelector('.stamps'), stamps.map((s) => ['div', s.earned ? 'stamp earned' : 'stamp'])).forEach((el, i) => rows(el, [['h4', '', stamps[i].title], ['p', '', stamps[i].text]]));
    book.querySelector('.seen').replaceChildren(...B.designs.map((d) => { const img = new Image(40, 40); img.src = thumb(d.index); img.alt = `${d.label}${d.seen ? '' : ' (not met yet)'}`; img.className = d.seen ? '' : 'unseen'; return img; }));
    rows(book.querySelector('.worn'), B.hats.map((h) => ['span', h.worn ? 'chip worn' : 'chip', h.label]));
    const R = B.records; letter(book.querySelector('.records'), `Best lap ${mmss(R.bestLap)}. Most laps by one duck ${R.mostLaps}. Races won ${R.racesWon}.`, { maxWidth: 300 });
    rows(book.querySelector('.met'), B.ducks.slice(0, 12).map((d) => ['li', d.here ? '' : 'gone', `${d.name}: ${d.laps} laps, best ${mmss(d.bestLap)}`]));
  }
  // the card sits above the dock on a phone: it needs the dock's height
  const ro = new ResizeObserver(() => root.style.setProperty('--dock-h', `${dock.offsetHeight}px`));
  if (!signal.aborted) ro.observe(dock); signal.addEventListener('abort', () => ro.disconnect(), { once: true });

  let last = {};
  const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  const press = (el, v) => el.setAttribute('aria-pressed', String(!!v));
  return {
    frame() {
      if (signal.aborted) return;
      const W = api.world, n = W.ducks.length, d = W.ducks.includes(W.selected) ? W.selected : null;
      if (W.selected && !d) api.pick(null);
      if (!d && api.follow.get()) api.follow.set(false);
      set('count', n, () => { letter($('.count'), `${n} of ${MAX_DUCKS}`); $('.add').disabled = n >= MAX_DUCKS; });
      set('next', W.next.colour, (c) => { $('.add img').src = thumb(c); });
      set('hour', clock(W.day.hour), (v) => { letter(out, v); hour.setAttribute('aria-valuetext', v); });
      if (document.activeElement !== hour) hour.value = W.day.hour;
      set('run', W.day.run, (r) => { const b = $('.run'); b.innerHTML = r ? PAUSE : PLAY; b.setAttribute('aria-label', r ? 'Stop the clock' : 'Run the clock'); });
      set('names', api.names.get(), (v) => press($('.names'), v));
      set('sound', api.sound.get(), (v) => press($('.sound'), v));
      set('follow', api.follow.get(), (v) => press($('.follow'), v));
      if (W.race) {   // the race board: the racers in order, finished first, while it runs and a little after
        const R = W.race, fin = R.results.filter((r) => r.place !== null).sort((a, b) => a.place - b.place);
        const stale = !R.running && W.time - (R.endedAt ?? -Infinity) > 8;
        set('raceT', R.running ? Math.floor(R.t) : -1, (t) => letter($('.race'), t < 0 ? 'Race' : `Race ${mmss(t)}`));
        set('race', `${R.running}|${R.ids.join()}|${fin.length}|${stale}`, () => {
          const board = $('.race-board'); board.hidden = !R.ids.length || stale;
          if (!R.running && !stale && fin[0]) notice(`${nameOf(fin[0].id)} wins the race`);
          const racing = R.ids.filter((id) => !fin.some((r) => r.id === id));
          rows(board.querySelector('ol'), [...fin.map((r) => ['li', '', `${r.place}  ${nameOf(r.id)}  ${mmss(r.time)}`]),
            ...racing.map((id) => ['li', 'out', `-  ${nameOf(id)}  ${R.running ? 'racing' : 'out'}`])]);
        });
      }
      const stranded = W.ducks.filter((x) => x.state === 'sea').length, away = !!W.boat && W.boat.state !== 'moored';
      set('boat', `${stranded}|${away}`, () => { const b = $('.boat'); b.hidden = !stranded && !away; b.disabled = away; letter(b, away ? 'The boat is out' : `Send the boat (${stranded})`); });
      if (api.book) {
        for (const s of api.book.fresh) notice(`Stamp: ${s.title}`);
        api.book.take();
        if (!book.hidden && last.bookT !== Math.floor(W.time)) {   // once a world second: refill when anything in it changed
          last.bookT = Math.floor(W.time); const B = api.book;
          set('book', JSON.stringify([B.stamps.map((s) => s.earned), B.designs.map((x) => x.seen), B.hats.map((x) => x.worn), B.records, B.ducks.slice(0, 12)]), fillBook);
        }
      }
      set('picked', d ? d.id : -1, () => {
        letter($('.pick'), d ? nameOf(d.id) : 'Pick a duck');
        if (!d && card.contains(document.activeElement)) focusDock();
        showHelp(false);
        card.hidden = !d;
        if (d) letter(card.querySelector('h2'), nameOf(d.id));
      });
      if (d) {
        set('colour', `${d.id}:${d.colour}`, () => {
          card.querySelector('header img').src = thumb(d.colour);
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
