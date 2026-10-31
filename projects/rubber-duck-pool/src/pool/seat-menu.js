// The seat's own controls, real elements in the pool's layer so a keyboard, a screen reader and a finger can use them.
// Standing: a "Sit in the ..." button a chair, unseen until it has focus (the scene stays bare for the pointer, which
// clicks the chairs themselves). Seated: a small panel beside the cooler by the chair (P.SEATS side) with the seat's
// name, Send the boat, the duck to watch and the hour (seat-choices.js), Open the book (book-view.js) and Stand up. It
// shows what seating.js says and changes the seat only through it; the camera is the page's: a choice never moves it.
// Placeholder look: system font and colours, no colour, font or shape decided (the visual design is on hold).
import { HOURS, clockText } from './seat-choices.js';
const CSS = `
.pool .seat-ui .seat-sit:not(:focus) { position: fixed; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pool .seat-ui .seat-sit:focus { position: fixed; left: 12px; top: 12px; pointer-events: auto; }
.pool .seat-ui dialog { position: fixed; inset: 0 auto auto 0; margin: 0; max-width: min(18rem, calc(100vw - 16px)); padding: 10px 12px; border: 1px solid; pointer-events: auto; font: 14px/1.4 system-ui, sans-serif; will-change: transform; }
.pool .seat-ui h2 { margin: 0 0 4px; font-size: 1em; }
.pool .seat-ui .seat-send[aria-disabled="true"] { opacity: .5; }
.pool .seat-ui p { margin: 0 0 8px; }
.pool .seat-ui label { display: block; margin: 0 0 8px; }
.pool .seat-ui select { max-width: 100%; }
.pool .seat-ui fieldset { margin: 0 0 8px; padding: 4px 8px 8px; border: 1px solid; }
.pool .seat-ui :focus-visible { outline: 2px solid; outline-offset: 2px; }
`;
const LID = 0.2;   // the cooler's lid above its side point: the panel hangs off it

/** root: the pool's layer; fallback: where focus goes on standing when no button of ours opened the seat; boat: what the
 * boat's control needs of the page, { state() -> { adrift, out, found, total }, send() -> boolean } (index.js); choices:
 * the duck and the hour, { ducks() -> { options, value, notice } (seat-choices.js createDuckChoice().view of the world's
 * ducks and its selection), chooseDuck(id | null) -> boolean, chooseHour(id) -> hour | null, hour() -> the world clock };
 * bookView: the book (book-view.js), opened by Open the book. Call frame() every frame after the camera and the seat are
 * settled. */
export function createSeatMenu({ root, seats, seating, toPx, fallback, boat, choices, bookView, signal }) {
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal });
  const ui = document.createElement('div');
  ui.className = 'seat-ui';
  ui.innerHTML = `<style>${CSS}</style><dialog aria-labelledby="seat-name"><h2 id="seat-name"></h2>
<p class="seat-boat" role="status" aria-live="polite"></p><button type="button" class="seat-send" aria-disabled="true">Send the boat</button>
<label>Duck to watch <select class="seat-duck"></select></label>
<fieldset class="seat-hours"><legend>Hour</legend></fieldset>
<p class="seat-clock"></p><p class="seat-hour-note" role="status" aria-live="polite"></p>
<p class="seat-note" role="status" aria-live="polite"></p>
<button type="button" class="seat-book">Open the book</button>
<button type="button" class="seat-up">Stand up</button></dialog>`;
  const panel = ui.querySelector('dialog'), name = ui.querySelector('h2'), up = ui.querySelector('.seat-up');
  const send = ui.querySelector('.seat-send'), report = ui.querySelector('.seat-boat'), openBook = ui.querySelector('.seat-book');
  const duck = ui.querySelector('.seat-duck'), hours = ui.querySelector('.seat-hours'), clock = ui.querySelector('.seat-clock'), note = ui.querySelector('.seat-note'), hourNote = ui.querySelector('.seat-hour-note');
  let said = '', can = false, refused = false, was = '';
  let options = '', watching, told = '', clockSaid = '', spoke = '', hourTold = '', hourSpoke = '', touched = true;   // what the controls show now (written only when it changes)
  let shown = null, opener = null, via = null, size = [0, 0];
  seats.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seat-sit'; b.textContent = `Sit in the ${s.label.toLowerCase()}`;
    on(b, 'click', () => { via = b; seating.sit(i); via = null; });
    panel.before(b);
  });
  seating.on((e) => { if (e.type === 'sit') opener = via; });   // a chair clicked in the scene opens it with no button
  on(up, 'click', () => seating.stand('button'));
  on(openBook, 'click', () => bookView.open(openBook));
  for (const h of HOURS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seat-hour'; b.dataset.hour = h.id; b.textContent = `${h.label} ${clockText(h.hour)}`;
    on(b, 'click', () => { const at = choices.chooseHour(h.id); if (at !== null) hourTold = `The hour is now ${clockText(at)}.`; });
    hours.append(b);
  }
  // the page keeps the world's selection and this list in step every frame (a duck tapped in the scene is a choice too);
  // a change here goes to the world, and the next frame shows what the world holds
  on(duck, 'change', () => {
    const id = duck.value === '' ? null : Number(duck.value), label = duck.selectedOptions[0]?.textContent;
    if (!choices.chooseDuck(id)) { told = 'That duck has left.'; return; }
    watching = id;
    told = id === null ? 'Not watching a duck.' : `Watching ${label}.`;
  });
  // aria-disabled, not disabled: a button that vanishes from the tab order while it has focus (the boat sets out as it
  // is pressed) would throw the keyboard back to the page
  // a send the boat refuses (no water route to something adrift) says so, until the state changes
  on(send, 'click', () => { if (can && !boat.send()) { said = 'The boat cannot get there just now.'; report.textContent = said; refused = true; } });
  // The world's shortcuts (navigation.js WASD and R, index.js M) listen on window: a key pressed on our controls stays
  // here. Escape goes on, to stand wherever focus is. Only keydown: a key held from the scene must still be let go.
  on(ui, 'keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  on(window, 'keydown', (e) => { if (e.key === 'Escape' && seating.stand('escape')) e.preventDefault(); });   // the book keeps its own keys (book-view.js)
  root.append(ui);
  signal.addEventListener('abort', () => ui.remove());

  function open(i) {
    name.textContent = seats[i].label;
    panel.show();
    touched = true;
    up.focus();
  }
  function close() {
    if (bookView.isOpen) bookView.close();   // its focus comes back here first, then goes on below
    const had = panel.contains(document.activeElement);
    panel.close();
    if (had) (opener || fallback).focus();   // never left on a hidden panel
  }
  return {
    frame() {
      // from the seat's state rather than its events: a seat the page stands up in the arrival's own frame (index.js)
      // never shows the panel or takes focus
      const want = seating.phase === 'seated' ? seating.seat : null;
      if (want !== shown) { if (shown !== null) close(); shown = want; if (want !== null) open(want); }
      if (shown === null) return;
      const b = boat.state(), text = `${b.out ? 'The boat is out.' : b.adrift ? 'Something is adrift.' : 'Nothing is adrift.'} Pages found: ${b.found} of ${b.total}.`;
      can = !b.out && b.adrift > 0;
      if (refused && text === was) return;   // keep the refusal on screen while nothing has changed
      refused = false; was = text;
      if (text !== said) { said = text; report.textContent = text; }
      send.setAttribute('aria-disabled', String(!can));
      const c = choices.ducks(), list = c.options.map((o) => `${o.id}\t${o.label}`).join('\n');
      if (list !== options) {
        options = list; touched = true;
        duck.replaceChildren(new Option('No duck', ''), ...c.options.map((o) => new Option(o.label, String(o.id))));
      }
      const value = c.value === null ? '' : String(c.value);
      if (duck.value !== value) duck.value = value;
      if (c.value !== watching) {   // a duck tapped in the scene, or the one watched left
        watching = c.value;
        told = c.value === null ? '' : `Watching ${c.options.find((o) => o.id === c.value)?.label}.`;
      }
      const time = `The clock says ${clockText(choices.hour())}.`, line = c.notice ?? told;
      if (time !== clockSaid) { clockSaid = time; clock.textContent = time; touched = true; }
      if (line !== spoke) { spoke = line; note.textContent = line; touched = true; }
      if (hourTold !== hourSpoke) { hourSpoke = hourTold; hourNote.textContent = hourTold; touched = true; }
      if (touched) { size = [panel.offsetWidth, panel.offsetHeight]; touched = false; }   // where the panel hangs follows its size
      const s = seats[shown], p = toPx([s.side[0], s.y + LID, s.side[1]]) || [0, innerHeight];   // behind the eye: the bottom left
      const x = Math.max(8, Math.min(p[0] + 12, innerWidth - size[0] - 8)), y = Math.max(8, Math.min(p[1] - 12 - size[1], innerHeight - size[1] - 8));
      panel.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    },
  };
}
