// The page's lettering: Leon Sans (vendor/leonsans, MIT, Jongmin Kim), a typeface drawn with code. It is not a web
// font: each piece of text is drawn on a small canvas, sized to it and sharp at the screen's pixel ratio. The words stay
// in the element, hidden from sight, for screen readers, search and the checks.
import LeonSans from '../../vendor/leonsans/leonsans.js';

/** text in lines no wider than max (px), broken between words (Leon Sans's own maxWidth does not break them). */
function wrap(text, max, size, weight) {
  const width = (t) => new LeonSans({ text: t, size, weight }).rect.w, lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.length ? `${lines[lines.length - 1]} ${word}` : null;
    if (last !== null && width(last) <= max) lines[lines.length - 1] = last; else lines.push(word);
  }
  return lines.join('\n');
}
/** CSS font-weight to Leon Sans's stroke weight (1–900), which reads lighter than a filled face of the same number. */
const strokeWeight = (w) => Math.max(1, Math.min(900, (+w || 400) * 1.1 + 40));

let can = null;   // whether there is a 2D canvas to draw on (none in a test's stand-in DOM: the words stay as text)
/** Letter el with text in Leon Sans. o: { size (px; the element's font-size), weight (its font-weight), colour (its
 * color), maxWidth (wrap at), align, leading }. Redraws only when the text or the look changed. */
export function letter(el, text, o = {}) {
  can ??= typeof getComputedStyle === 'function' && !!document.createElement?.('canvas')?.getContext?.('2d');
  if (!can) { el.textContent = text; return; }
  let words = el.querySelector(':scope > .lt-words'), c = el.querySelector(':scope > canvas.lt');
  if (!words) {
    el.textContent = '';
    words = document.createElement('span'); words.className = 'lt-words';
    c = document.createElement('canvas'); c.className = 'lt'; c.setAttribute('aria-hidden', 'true');
    el.append(words, c);
  }
  const cs = getComputedStyle(el), size = o.size ?? parseFloat(cs.fontSize), weight = o.weight ?? strokeWeight(cs.fontWeight), colour = o.colour ?? cs.color;
  const key = `${text}|${size}|${weight}|${colour}|${o.maxWidth ?? ''}|${o.align ?? ''}|${devicePixelRatio}`;
  if (c.dataset.key === key) return;
  c.dataset.key = key; words.textContent = text;
  const lines = o.maxWidth ? wrap(text, o.maxWidth, size, weight) : text;
  const leon = new LeonSans({ text: lines, size, weight, color: [colour], align: o.align ?? 'left', leading: o.leading ?? 2 });
  const dpr = devicePixelRatio || 1, pad = Math.ceil(leon.lineWidth / 2) + 1, w = Math.ceil(leon.rect.w) + 2 * pad, h = Math.ceil(leon.rect.h) + 2 * pad;
  c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
  c.style.width = `${w}px`; c.style.height = `${h}px`;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  leon.position(pad, pad); leon.draw(ctx); leon.dispose();
}
