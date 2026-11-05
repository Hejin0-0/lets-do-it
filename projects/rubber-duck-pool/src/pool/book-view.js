// A modal book of the logbook's fixed, ordered collectible pages.
import { COLLECTIBLES, KIND_LABELS } from './collectibles.js';

const TITLES = Object.fromEntries(COLLECTIBLES.map(({ id, title }) => [id, title]));
const DESCRIPTIONS = Object.fromEntries(COLLECTIBLES.map(({ id, description }) => [id, description]));
const CSS = `
.pool .book-ui dialog { position: fixed; inset: 0; margin: auto; box-sizing: border-box; max-width: min(22rem, calc(100vw - 32px)); padding: 16px; border: 1px solid; pointer-events: auto; font: 14px/1.4 system-ui, sans-serif; }
.pool .book-ui :focus-visible { outline: 2px solid; outline-offset: 2px; }
.pool .book-ui [aria-disabled="true"] { opacity: .5; }
`;

export function formatFoundDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(date);
}

export function openBookIndex(pages) {
  let index = 0, latest = -Infinity;
  for (const [i, page] of pages.entries()) {
    if (!page.found) continue;
    const date = page.date ?? -Infinity;
    if (date >= latest) { latest = date; index = i; }
  }
  return index;
}

export function bookPage(pages, index, titles = TITLES, summoned = [], timeZone, leaving = []) {
  const count = pages.length, complete = count > 0 && pages.every(p => p.found === true);
  index = count ? Math.max(0, Math.min(count - 1, index)) : 0;
  const page = pages[index], found = page?.found === true;
  const placed = new Set(summoned).has(page?.id);
  const summon = !found ? { state: 'locked', label: 'Summon into the pool', hint: 'Find it first to summon it.' }
    : new Set(leaving).has(page?.id) ? { state: 'leaving', label: 'A gull is coming', hint: 'A gull is taking it away.' }
    : placed ? { state: 'placed', label: 'Send it back', hint: 'A gull will take it away.' }
      : { state: 'ready', label: 'Summon into the pool', hint: 'Summon it to see it float in the pool.' };
  return { summon, index, count, position: `Page ${count ? index + 1 : 0} of ${count}`,
    state: found ? 'filled' : 'empty', title: page ? (found ? titles[page.id] ?? null : KIND_LABELS[page.kind] ?? null) : null,
    text: found ? page.date == null ? 'Found.' : `Found on ${formatFoundDate(page.date, timeZone)}.` : 'Not found yet.',
    description: found ? DESCRIPTIONS[page.id] ?? null : null, canPrev: index > 0, canNext: index < count - 1,
    complete, note: complete ? 'Every page is found.' : pages.some(p => p.shelf > 1) ? 'The first shelf is full. A second shelf is open.' : null };
}

export function createBookView({ root, book, summon, signal }) {
  const ui = document.createElement('div');
  ui.className = 'book-ui';
  ui.innerHTML = `<style>${CSS}</style><dialog aria-labelledby="book-heading"><h2 id="book-heading">Book</h2>
<div role="status" aria-live="polite"><p class="book-position"></p><p class="book-complete" hidden></p><p class="book-summon-hint" id="book-summon-hint"></p></div><div class="book-page"><h3></h3><p></p><p class="book-description"></p></div>
<button type="button" class="book-summon" aria-describedby="book-summon-hint"></button>
<button type="button" class="book-prev">Previous</button><button type="button" class="book-next">Next</button>
<button type="button" class="book-close">Close the book</button></dialog>`;
  const dialog = ui.querySelector('dialog'), position = ui.querySelector('.book-position'), page = ui.querySelector('.book-page');
  const title = page.querySelector('h3'), text = page.querySelector('p'), description = page.querySelector('.book-description'), complete = ui.querySelector('.book-complete');
  const summonButton = ui.querySelector('.book-summon'), hint = ui.querySelector('.book-summon-hint');
  const prev = ui.querySelector('.book-prev'), next = ui.querySelector('.book-next'), closeButton = ui.querySelector('.book-close');
  const on = (el, event, fn) => el.addEventListener(event, fn, { signal });
  let index = 0, opener = null, flags = '';
  const placedIds = pages => pages.filter(p => summon?.has(p.id)).map(p => p.id);
  const leavingIds = pages => pages.filter(p => summon?.leaving?.(p.id)).map(p => p.id);
  const foundFlags = pages => pages.map(p => `${p.found ? 1 : 0}${summon?.has(p.id) ? 1 : 0}${summon?.leaving?.(p.id) ? 1 : 0}`).join('');
  const modelOf = pages => bookPage(pages, index, TITLES, placedIds(pages), undefined, leavingIds(pages));
  function render(pages) {
    const model = modelOf(pages); index = model.index; flags = foundFlags(pages);
    const control = summon ? model.summon : bookPage([], 0).summon;
    summonButton.textContent = control.label; hint.textContent = control.hint;
    summonButton.setAttribute('aria-disabled', String(control.state !== 'ready' && control.state !== 'placed'));
    position.textContent = model.position; page.dataset.state = model.state;
    complete.textContent = model.note ?? ''; complete.hidden = model.note === null;
    title.textContent = model.title ?? ''; title.hidden = model.title === null;
    text.textContent = model.text; description.textContent = model.description ?? ''; description.hidden = model.description === null;
    prev.setAttribute('aria-disabled', String(!model.canPrev)); next.setAttribute('aria-disabled', String(!model.canNext));
  }
  function close() {
    if (!dialog.open) return;
    dialog.close();
    if (opener?.isConnected) opener.focus();
    opener = null;
  }
  on(summonButton, 'click', () => {
    const pages = book.pages, model = modelOf(pages), id = pages[model.index]?.id;
    if (summon && model.summon.state === 'ready') { summon.request(id); render(book.pages); }
    else if (summon?.sendBack && model.summon.state === 'placed') { summon.sendBack(id); render(book.pages); }
  });
  on(prev, 'click', () => { if (index > 0) { index--; render(book.pages); } });
  on(next, 'click', () => { const pages = book.pages; if (index < pages.length - 1) { index++; render(pages); } });
  on(closeButton, 'click', close);
  // A key held before opening must still reach the world on release. A key pressed in the book stays the book's until it
  // is let go, even once the book has closed: its repeats reaching the world without its release would hold it down there.
  const bookKeys = new Set();
  window.addEventListener('keydown', e => { if (!dialog.open) { if (bookKeys.has(e.code)) e.stopPropagation(); return; } if (!e.repeat) bookKeys.add(e.code); e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } }, { signal, capture: true });
  window.addEventListener('keyup', e => { if (bookKeys.delete(e.code)) e.stopPropagation(); }, { signal, capture: true });
  window.addEventListener('blur', () => bookKeys.clear(), { signal });
  on(dialog, 'cancel', e => { e.preventDefault(); e.stopPropagation(); close(); });
  for (const event of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click', 'wheel']) {
    on(dialog, event, e => e.stopPropagation());
  }
  root.append(ui);
  if (signal.aborted) ui.remove();
  else signal.addEventListener('abort', () => { close(); ui.remove(); }, { once: true });
  return {
    open(from) {
      if (dialog.open || signal.aborted) return;
      opener = from; const pages = book.pages; index = openBookIndex(pages); render(pages); dialog.showModal(); closeButton.focus();
    },
    close,
    frame() { if (dialog.open) { const pages = book.pages; if (foundFlags(pages) !== flags) render(pages); } },
    get isOpen() { return dialog.open; },
    get index() { return index; },
  };
}
