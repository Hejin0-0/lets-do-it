// The seat's own controls, real elements in the pool's layer so a keyboard, a screen reader and a finger can use them.
// Standing: a "Sit in the ..." button a chair, unseen until it has focus (the scene stays bare for the pointer, which
// clicks the chairs themselves). Seated: a small panel beside the cooler by the chair (P.SEATS side) with the seat's
// name, Send the boat, the duck to watch and the hour (seat-choices.js), the Sound box, Open the book (book-view.js), Go
// home and Stand up. It
// shows what seating.js says and changes the seat only through it; the camera is the page's (it turns the seated gaze to
// the duck being watched).
// Placeholder look: system font and colours, no colour, font or shape decided (the visual design is on hold).
import { HOUR_STEP, HOUR_MAX, clockText } from './seat-choices.js';
const CSS = `
.pool .seat-ui .seat-sit:not(:focus) { position: fixed; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pool .seat-ui .seat-sit:focus { position: fixed; left: 12px; top: 12px; pointer-events: auto; }
.pool .seat-ui dialog { position: fixed; inset: 0 auto auto 0; margin: 0; max-width: min(18rem, calc(100vw - 16px)); padding: 10px 12px; border: 1px solid; pointer-events: auto; font: 14px/1.4 system-ui, sans-serif; will-change: transform; }
.pool .seat-ui h2 { margin: 0 0 4px; font-size: 1em; }
.pool .seat-ui .seat-send[aria-disabled="true"] { opacity: .5; }
.pool .seat-ui p { margin: 0 0 8px; }
.pool .seat-ui label { display: block; margin: 0 0 8px; }
.pool .seat-ui select { max-width: 100%; }
.pool .seat-ui input[type="range"] { display: block; width: 100%; margin: 4px 0 0; }
.pool .seat-ui :focus-visible { outline: 2px solid; outline-offset: 2px; }
`;
const LID = 0.2;   // the cooler's lid above its side point: the panel hangs off it

/** root: the pool's layer; fallback: where focus goes on standing when no button of ours opened the seat; boat: what the
 * boat's control needs of the page, { state() -> { adrift, out, brought: [title], found, total, complete }, send() -> boolean } (index.js); choices:
 * the duck and the hour, { ducks() -> { options, value, notice } (seat-choices.js createDuckChoice().view of the world's
 * ducks and its selection), chooseDuck(id | null) -> boolean, chooseHour(hours) -> hour | null, hour() -> the world clock };
 * bookView: the book (book-view.js), opened by Open the book; sound: the page's sound as the player wants it, { on() -> boolean,
 * set(boolean) } (index.js, which M also turns). Call frame() every frame after the camera and the seat are settled. */
export function createSeatMenu({ root, seats, seating, toPx, fallback, boat, choices, bookView, goHome, sound, signal }) {
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal });
  const ui = document.createElement('div');
  ui.className = 'seat-ui';
  ui.innerHTML = `<style>${CSS}</style><dialog aria-labelledby="seat-name"><h2 id="seat-name"></h2>
<p class="seat-boat" role="status" aria-live="polite"></p><button type="button" class="seat-send" aria-disabled="true">Send the boat</button>
<label>Duck to watch <select class="seat-duck"><option value="">No duck</option></select></label>
<label>Hour <input type="range" class="seat-hour" min="0"></label>
<p class="seat-clock"></p><p class="seat-hour-note" role="status" aria-live="polite"></p>
<p class="seat-note" role="status" aria-live="polite"></p>
<label><input type="checkbox" class="seat-sound"> Sound</label>
<button type="button" class="seat-book">Open the book</button>
<button type="button" class="seat-home">Go home</button>
<button type="button" class="seat-up">Stand up</button></dialog>`;
  const panel = ui.querySelector('dialog'), name = ui.querySelector('h2'), up = ui.querySelector('.seat-up');
  const send = ui.querySelector('.seat-send'), report = ui.querySelector('.seat-boat'), openBook = ui.querySelector('.seat-book');
  const soundBox = ui.querySelector('.seat-sound'), duck = ui.querySelector('.seat-duck'), hour = ui.querySelector('.seat-hour'), clock = ui.querySelector('.seat-clock'), note = ui.querySelector('.seat-note'), hourNote = ui.querySelector('.seat-hour-note');
  let said = '', can = false, refused = false, was = '';
  let options = '', watching, watchedAs, told = '', clockSaid = '', spoke = '', hourTold = '', hourSpoke = '', shownHour = '', dragging = false, moved = '', touched = true;   // what the controls show now (written only when it changes)
  let shown = null, opener = null, via = null, size = [0, 0];
  seats.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seat-sit'; b.textContent = `Sit in the ${s.label.toLowerCase()}`;
    on(b, 'click', () => { via = b; seating.sit(i); via = null; });
    panel.before(b);
  });
  seating.on((e) => { if (e.type === 'sit') opener = via; });   // a chair clicked in the scene opens it with no button
  on(up, 'click', () => seating.stand('button'));
  on(ui.querySelector('.seat-home'), 'click', () => goHome());
  on(openBook, 'click', () => bookView.open(openBook));
  on(soundBox, 'change', () => sound.set(soundBox.checked));
  // the hour: any time of day; the slider follows the running clock, except while a pointer holds it
  hour.max = String(HOUR_MAX); hour.step = String(HOUR_STEP);
  on(hour, 'pointerdown', () => { dragging = true; });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) on(hour, ev, () => { dragging = false; });
  on(hour, 'input', () => {
    const at = choices.chooseHour(Number(hour.value));
    if (at !== null) { shownHour = hour.value; hour.setAttribute('aria-valuetext', clockText(at)); }
  });
  on(hour, 'change', () => { hourTold = `The hour is now ${clockText(choices.hour())}.`; });   // said once a choice is let go
  // the page keeps the world's selection and this list in step every frame (a duck tapped in the scene is a choice too);
  // a change here goes to the world, and the next frame shows what the world holds
  on(duck, 'change', () => {
    const id = duck.value === '' ? null : Number(duck.value), label = duck.selectedOptions[0]?.textContent;
    if (!choices.chooseDuck(id)) { told = 'That duck has left.'; return; }
    watching = id; watchedAs = id === null ? null : label;
    told = id === null ? 'Not watching a duck.' : `Watching ${label}.`;
  });
  /** The list as the world's ducks are, keeping the option of each duck still there (a list the player has open keeps
   * its items): only a duck that came or went, or a label that changed, touches the list. */
  function keepOptions(list) {
    const have = new Map([...duck.options].slice(1).map((o) => [o.value, o]));
    const want = list.map((o) => { const el = have.get(String(o.id)) || new Option(o.label, String(o.id)); if (el.textContent !== o.label) el.textContent = o.label; return el; });
    for (const [v, el] of have) if (!list.some((o) => String(o.id) === v)) el.remove();
    want.forEach((el, i) => { if (duck.options[i + 1] !== el) duck.insertBefore(el, duck.options[i + 1] || null); });
  }
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
      const b = boat.state(), text = `${b.out ? 'The boat is out.' : b.adrift ? 'Something is adrift.' : b.brought.length ? `The boat brought home: ${b.brought.join(', ')}.` : 'Nothing is adrift.'} Pages found: ${b.found} of ${b.total}.${b.complete ? ' Every page is found.' : ''}`;
      can = !b.out && b.adrift > 0;
      if (!refused || text !== was) {   // a refusal stays on screen while nothing has changed
        refused = false; was = text;
        if (text !== said) { said = text; report.textContent = text; touched = true; }
      }
      const off = String(!can);
      if (send.getAttribute('aria-disabled') !== off) send.setAttribute('aria-disabled', off);
      if (soundBox.checked !== sound.on()) soundBox.checked = sound.on();   // M turns it too
      const c = choices.ducks(), list = c.options.map((o) => `${o.id}\t${o.label}`).join('\n');
      if (list !== options) { options = list; touched = true; keepOptions(c.options); }
      const value = c.value === null ? '' : String(c.value);
      if (duck.value !== value) duck.value = value;
      const label = c.value === null ? null : c.options.find((o) => o.id === c.value)?.label;
      if (c.value !== watching || label !== watchedAs) {   // a duck tapped in the scene, the one watched left, or its label changed
        watching = c.value; watchedAs = label;
        told = c.value === null ? '' : `Watching ${label}.`;
      }
      const now = choices.hour(), time = `The clock says ${clockText(now)}.`, line = c.notice ?? told;
      const step = String(Math.min(HOUR_MAX, Math.floor(now / HOUR_STEP) * HOUR_STEP));
      if (!dragging && step !== shownHour) { shownHour = step; hour.value = step; hour.setAttribute('aria-valuetext', clockText(Number(step))); }
      if (time !== clockSaid) { clockSaid = time; clock.textContent = time; touched = true; }
      if (line !== spoke) { spoke = line; note.textContent = line; touched = true; }
      if (hourTold !== hourSpoke) { hourSpoke = hourTold; hourNote.textContent = hourTold; touched = true; }
      if (touched) { size = [panel.offsetWidth, panel.offsetHeight]; touched = false; }   // where the panel hangs follows its size
      const s = seats[shown], p = toPx([s.side[0], s.y + LID, s.side[1]]) || [0, innerHeight];   // behind the eye: the bottom left
      const x = Math.max(8, Math.min(p[0] + 12, innerWidth - size[0] - 8)), y = Math.max(8, Math.min(p[1] - 12 - size[1], innerHeight - size[1] - 8));
      const move = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (move !== moved) { moved = move; panel.style.transform = move; }
    },
  };
}
