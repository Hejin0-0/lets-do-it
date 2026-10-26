// The page's controls: a dock along the bottom (a duck to add, the hour and the clock, the names, the sound, the whole
// view, the help) and, while a duck is picked, its card (its design, what it wears, following it, taking it away).
// Coloured as the pool is (its tiles, its deep water, the duck's yellow) and outlined as the mural's cartoon is
// (style.css, under .pool). Text on the page is English.
import { DESIGNS, HATS, MAX_DUCKS, PROPELLER, nameOf } from './ducks.js';

const thumb = (i) => new URL(`ducks/${DESIGNS[i].id}-thumb.webp`, document.baseURI).href;
const clock = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const PLAY = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4l10 6-10 6z"/></svg>';
const PAUSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4h4v12H5zM11 4h4v12h-4z"/></svg>';
const CLOSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

export const PANEL_HTML = `<div class="dock" role="toolbar" aria-label="Pool controls">
  <button type="button" class="add primary"><img alt="" width="28" height="28"><span>Add a duck</span></button>
  <span class="count" aria-live="polite"></span>
  <div class="time"><label for="pool-hour">Time <output></output></label><input id="pool-hour" type="range" min="0" max="24" step="0.25">
    <button type="button" class="run icon" aria-label="Run the clock"></button></div>
  <button type="button" class="names" aria-pressed="false">Names</button>
  <button type="button" class="sound" aria-pressed="false">Sound</button>
  <button type="button" class="whole">Whole view</button>
  <button type="button" class="help-open" aria-expanded="false" aria-controls="pool-help">Help</button>
</div>
<div class="help" id="pool-help" hidden>
  <p class="keys"><kbd>W A S D</kbd> move, <kbd>Shift</kbd> faster. Drag the water: ripples. Drag the ground or right-drag: turn. Wheel: zoom. <kbd>Shift</kbd>+drag or the middle button: pan. Drag a duck or a float: pick it up. Click a duck: it hops. <kbd>R</kbd> whole view, <kbd>M</kbd> sound.</p>
  <p class="touch">Drag the ground: turn. Drag the water: ripples. Two fingers: pinch to zoom, slide to move. Tap a duck: it hops and shows its card. Drag it: pick it up.</p>
</div>
<section class="card" aria-label="The picked duck" hidden>
  <header><img alt="" width="44" height="44"><h2></h2><button type="button" class="close icon" aria-label="Put the duck down">${CLOSE}</button></header>
  <h3>Design</h3><div class="designs">${DESIGNS.map((d, i) => `<button type="button" data-i="${i}" aria-label="${d.label}" aria-pressed="false"><img src="" alt="" width="40" height="40"></button>`).join('')}</div>
  <h3>Wears</h3><div class="hats">${HATS.map((h, i) => (i === PROPELLER ? '' : `<button type="button" data-i="${i}" aria-pressed="false">${h.label}</button>`)).join('')}</div>
  <p class="flyer" hidden>A flyer keeps its propeller cap: it is what lets it fly.</p>
  <footer><button type="button" class="follow" aria-pressed="false">Follow it</button><button type="button" class="remove">Take it out</button></footer>
</section>`;

/** api: { world, addDuck(), setHour(h), setClock(run), names: { get(), set(v) }, sound: { get(), set(v) },
 *  follow: { get(), set(v) }, wholeView(), pick(duck | null) }. Returns { frame() }: bring the controls up to date. */
export function installPanel(root, api, signal) {
  const $ = (s) => root.querySelector(s), on = (el, ev, fn) => el.addEventListener(ev, fn, { signal });
  const dock = $('.dock'), card = $('.card'), help = $('.help'), hour = $('#pool-hour'), out = $('.time output');
  for (const b of card.querySelectorAll('.designs button')) b.querySelector('img').src = thumb(+b.dataset.i);
  on($('.add'), 'click', () => api.addDuck());
  on(hour, 'input', () => { api.setClock(false); api.setHour(+hour.value); });
  on($('.run'), 'click', () => api.setClock(!api.world.day.run));
  on($('.names'), 'click', () => api.names.set(!api.names.get()));
  on($('.sound'), 'click', () => api.sound.set(!api.sound.get()));
  on($('.whole'), 'click', () => api.wholeView());
  on($('.help-open'), 'click', () => { help.hidden = !help.hidden; $('.help-open').setAttribute('aria-expanded', String(!help.hidden)); });
  on(card.querySelector('.designs'), 'click', (e) => { const b = e.target.closest('button'); if (b) api.world.setColour(+b.dataset.i); });
  on(card.querySelector('.hats'), 'click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) api.world.setHat(+b.dataset.i); });
  on($('.close'), 'click', () => api.pick(null));
  on($('.follow'), 'click', () => api.follow.set(!api.follow.get()));
  on($('.remove'), 'click', () => { api.follow.set(false); api.world.removeDuck(); });
  // the card sits above the dock on a phone: it needs the dock's height
  const ro = new ResizeObserver(() => root.style.setProperty('--dock-h', `${dock.offsetHeight}px`));
  ro.observe(dock); signal.addEventListener('abort', () => ro.disconnect());

  let last = {};
  const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  const press = (el, v) => el.setAttribute('aria-pressed', String(!!v));
  return {
    frame() {
      const W = api.world, n = W.ducks.length, d = W.selected;
      set('count', n, () => { $('.count').textContent = `${n} of ${MAX_DUCKS}`; $('.add').disabled = n >= MAX_DUCKS; });
      set('next', W.next.colour, (c) => { $('.add img').src = thumb(c); });
      set('hour', Math.round(W.day.hour * 4), () => { out.textContent = clock(W.day.hour); if (document.activeElement !== hour) hour.value = W.day.hour; });
      set('run', W.day.run, (r) => { const b = $('.run'); b.innerHTML = r ? PAUSE : PLAY; b.setAttribute('aria-label', r ? 'Stop the clock' : 'Run the clock'); });
      set('names', api.names.get(), (v) => press($('.names'), v));
      set('sound', api.sound.get(), (v) => press($('.sound'), v));
      set('follow', api.follow.get(), (v) => press($('.follow'), v));
      set('picked', d ? d.id : -1, () => {
        card.hidden = !d;
        if (d) { card.querySelector('h2').textContent = nameOf(d.id); }
      });
      if (d) {
        set('colour', `${d.id}:${d.colour}`, () => {
          card.querySelector('header img').src = thumb(d.colour);
          for (const b of card.querySelectorAll('.designs button')) press(b, +b.dataset.i === d.colour);
        });
        set('hat', `${d.id}:${d.hat}`, () => {
          const flyer = d.hat === PROPELLER;
          card.querySelector('.flyer').hidden = !flyer;
          for (const b of card.querySelectorAll('.hats button')) { press(b, +b.dataset.i === d.hat); b.disabled = flyer; }
        });
      }
    },
  };
}
