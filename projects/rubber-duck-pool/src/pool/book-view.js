// A modal book of the logbook's fixed, ordered collectible pages.
import { COLLECTIBLES } from './collectibles.js';

const TITLES = Object.fromEntries(COLLECTIBLES.map(({ id, title }) => [id, title]));
const SHOW_EMPTY_TITLE = false;
const CSS = `
.pool .book-ui dialog { position: fixed; inset: 0; margin: auto; box-sizing: border-box; max-width: min(22rem, calc(100vw - 32px)); padding: 16px; border: 1px solid; pointer-events: auto; font: 14px/1.4 system-ui, sans-serif; }
.pool .book-ui :focus-visible { outline: 2px solid; outline-offset: 2px; }
.pool .book-ui [aria-disabled="true"] { opacity: .5; }
`;

export function bookPage(pages, index, titles = TITLES) {
  const count = pages.length;
  index = count ? Math.max(0, Math.min(count - 1, index)) : 0;
  const page = pages[index], found = page?.found === true;
  return { index, count, position: `Page ${count ? index + 1 : 0} of ${count}`,
    state: found ? 'filled' : 'empty', title: page && (found || SHOW_EMPTY_TITLE) ? titles[page.id] : null,
    text: found ? 'Found.' : 'Not found yet.', canPrev: index > 0, canNext: index < count - 1 };
}

export function createBookView({ root, book, signal }) {
  const ui = document.createElement('div');
  ui.className = 'book-ui';
  ui.innerHTML = `<style>${CSS}</style><dialog aria-labelledby="book-heading"><h2 id="book-heading">Book</h2>
<p class="book-position" role="status" aria-live="polite"></p><div class="book-page"><h3></h3><p></p></div>
<button type="button" class="book-prev">Previous</button><button type="button" class="book-next">Next</button>
<button type="button" class="book-close">Close the book</button></dialog>`;
  const dialog = ui.querySelector('dialog'), position = ui.querySelector('.book-position'), page = ui.querySelector('.book-page');
  const title = page.querySelector('h3'), text = page.querySelector('p');
  const prev = ui.querySelector('.book-prev'), next = ui.querySelector('.book-next'), closeButton = ui.querySelector('.book-close');
  const on = (el, event, fn) => el.addEventListener(event, fn, { signal });
  let index = 0, opener = null, flags = '';
  const foundFlags = pages => pages.map(p => p.found ? '1' : '0').join('');
  function render(pages) {
    const model = bookPage(pages, index); index = model.index; flags = foundFlags(pages);
    position.textContent = model.position; page.dataset.state = model.state;
    title.textContent = model.title ?? ''; title.hidden = model.title === null;
    text.textContent = model.text;
    prev.setAttribute('aria-disabled', String(!model.canPrev)); next.setAttribute('aria-disabled', String(!model.canNext));
  }
  function close() {
    if (!dialog.open) return;
    dialog.close();
    if (opener?.isConnected) opener.focus();
    opener = null;
  }
  on(prev, 'click', () => { if (index > 0) { index--; render(book.pages); } });
  on(next, 'click', () => { const pages = book.pages; if (index < pages.length - 1) { index++; render(pages); } });
  on(closeButton, 'click', close);
  on(dialog, 'keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } });
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
      opener = from; index = 0; render(book.pages); dialog.showModal(); closeButton.focus();
    },
    close,
    frame() { if (dialog.open) { const pages = book.pages; if (foundFlags(pages) !== flags) render(pages); } },
    get isOpen() { return dialog.open; },
    get index() { return index; },
  };
}
