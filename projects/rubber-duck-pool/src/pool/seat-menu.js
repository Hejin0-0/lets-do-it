// The seat's own controls, real elements in the pool's layer so a keyboard, a screen reader and a finger can use them.
// Standing: a "Sit in the ..." button a chair, unseen until it has focus (the scene stays bare for the pointer, which
// clicks the chairs themselves). Seated: a small panel beside the cooler by the chair (P.SEATS side) with the seat's
// name and Stand up. It shows what seating.js says and changes the seat only through it; the camera is the page's.
// Placeholder look: system font and colours, no colour, font or shape decided (the visual design is on hold).
const CSS = `
.pool .seat-ui .seat-sit:not(:focus) { position: fixed; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pool .seat-ui .seat-sit:focus { position: fixed; left: 12px; top: 12px; pointer-events: auto; }
.pool .seat-ui dialog { position: fixed; inset: 0 auto auto 0; margin: 0; max-width: min(18rem, calc(100vw - 16px)); padding: 10px 12px; border: 1px solid; pointer-events: auto; font: 14px/1.4 system-ui, sans-serif; will-change: transform; }
.pool .seat-ui h2 { margin: 0 0 4px; font-size: 1em; }
.pool .seat-ui .seat-send[aria-disabled="true"] { opacity: .5; }
.pool .seat-ui p { margin: 0 0 8px; }
.pool .seat-ui :focus-visible { outline: 2px solid; outline-offset: 2px; }
`;
const LID = 0.2;   // the cooler's lid above its side point: the panel hangs off it

/** root: the pool's layer; fallback: where focus goes on standing when no button of ours opened the seat; boat: what the
 * boat's control needs of the page, { state() -> { adrift, out, found, total }, send() -> boolean } (index.js). Call
 * frame() every frame after the camera and the seat are settled. */
export function createSeatMenu({ root, seats, seating, toPx, fallback, boat, signal }) {
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal });
  const ui = document.createElement('div');
  ui.className = 'seat-ui';
  ui.innerHTML = `<style>${CSS}</style><dialog aria-labelledby="seat-name"><h2 id="seat-name"></h2>
<p>The duck to watch and the hour will be chosen here.</p>
<p class="seat-boat" role="status" aria-live="polite"></p><button type="button" class="seat-send" aria-disabled="true">Send the boat</button>
<button type="button" class="seat-up">Stand up</button></dialog>`;
  const panel = ui.querySelector('dialog'), name = ui.querySelector('h2'), up = ui.querySelector('.seat-up');
  const send = ui.querySelector('.seat-send'), report = ui.querySelector('.seat-boat');
  let said = '', can = false, refused = false, was = '';
  let shown = null, opener = null, via = null, size = [0, 0];
  seats.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'seat-sit'; b.textContent = `Sit in the ${s.label.toLowerCase()}`;
    on(b, 'click', () => { via = b; seating.sit(i); via = null; });
    panel.before(b);
  });
  seating.on((e) => { if (e.type === 'sit') opener = via; });   // a chair clicked in the scene opens it with no button
  on(up, 'click', () => seating.stand('button'));
  // aria-disabled, not disabled: a button that vanishes from the tab order while it has focus (the boat sets out as it
  // is pressed) would throw the keyboard back to the page
  // a send the boat refuses (no water route to something adrift) says so, until the state changes
  on(send, 'click', () => { if (can && !boat.send()) { said = 'The boat cannot get there just now.'; report.textContent = said; refused = true; } });
  // The world's shortcuts (navigation.js WASD and R, index.js M) listen on window: a key pressed on our controls stays
  // here. Escape goes on, to stand wherever focus is. Only keydown: a key held from the scene must still be let go.
  on(ui, 'keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  on(window, 'keydown', (e) => { if (e.key === 'Escape' && seating.stand('escape')) e.preventDefault(); });
  root.append(ui);
  signal.addEventListener('abort', () => ui.remove());

  function open(i) {
    name.textContent = seats[i].label;
    panel.show();
    size = [panel.offsetWidth, panel.offsetHeight];
    up.focus();
  }
  function close() {
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
      const s = seats[shown], p = toPx([s.side[0], s.y + LID, s.side[1]]) || [0, innerHeight];   // behind the eye: the bottom left
      const x = Math.max(8, Math.min(p[0] + 12, innerWidth - size[0] - 8)), y = Math.max(8, Math.min(p[1] - 12 - size[1], innerHeight - size[1] - 8));
      panel.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    },
  };
}
