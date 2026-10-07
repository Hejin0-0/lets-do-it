// DOM helpers and the HUD's small icon set (inline SVG: the game ships as one offline file, so
// nothing is fetched). Every icon pairs with a word or a shape change — never colour alone.
import { createSeededRandom } from '../utils/random.ts'

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement | null, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  if (parent) parent.appendChild(n)
  return n
}

// A HUD button: native <button> for focus/disabled semantics; mouse clicks drop focus afterwards
// so Space keeps meaning "ring the bell" and never re-fires the last button clicked.
export function button(cls: string, parent: HTMLElement | null, html: string, on: () => void, label?: string): HTMLButtonElement {
  const b = el('button', 'ii-btn ' + cls, parent)
  b.type = 'button'
  b.innerHTML = html
  if (label) b.setAttribute('aria-label', label)
  b.addEventListener('click', (e) => {
    on()
    if ((e as PointerEvent).pointerType) b.blur() // a mouse or touch click, not Enter/Space on a focused control
  })
  return b
}

export const kbd = (k: string): string => `<kbd class="ii-key">${k}</kbd>`

const svg = (vb: string, body: string, cls = ''): string =>
  `<svg class="ii-ico ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`

export const ICON = {
  // British roundel (rings) and German cross pattée: the side shapes used everywhere.
  roundel: svg('0 0 20 20', '<circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="10" cy="10" r="4.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="1.7" fill="currentColor"/>', 'ii-ico-br'),
  cross: svg('0 0 20 20', '<path d="M10 10 7.4 1.6h5.2zM10 10l8.4-2.6v5.2zM10 10l2.6 8.4H7.4zM10 10 1.6 12.6V7.4z" fill="currentColor"/>', 'ii-ico-de'),
  bell: svg('0 0 32 32', '<path d="M16 4.2c-.9 0-1.6.7-1.6 1.6v.8c-4 .8-6.6 4.2-6.6 8.6v5.2L5.6 23v1.6h20.8V23l-2.2-2.6v-5.2c0-4.4-2.6-7.8-6.6-8.6v-.8c0-.9-.7-1.6-1.6-1.6zM12.6 26a3.4 3.4 0 0 0 6.8 0z" fill="currentColor"/>'),
  undo: svg('0 0 20 20', '<path d="M7.6 4.2 2.8 8.6l4.8 4.4V10c4.2-.2 7.2.9 9 4.8-.4-5.2-3.4-8.6-9-8.8z" fill="currentColor"/>'),
  rewind: svg('0 0 20 20', '<path d="M9.4 4.6v10.8L2 10zM18 4.6v10.8L10.6 10z" fill="currentColor"/>'),
  swords: svg('0 0 20 20', '<path d="m3 2 7.4 7.4-1.3 1.3L1.7 3.3 1.6 2zM17 2l.1 1.3-9.7 9.7 1.6 1.6-1.4 1.4-1.6-1.6-2.3 2.3-1.4-1.4L4.6 13 3 11.4l1.4-1.4L6 11.6 15.7 2zm-5.1 9.9 1.4-1.4 1.6 1.6 1.6-1.6 1.4 1.4-1.6 1.6 2.3 2.3-1.4 1.4-2.3-2.3-1.6 1.6-1.4-1.4 1.6-1.6z" fill="currentColor"/>'),
  wound: svg('0 0 20 20', '<path d="M10 1.8c3.6 4.6 5.6 7.9 5.6 10.6a5.6 5.6 0 0 1-11.2 0c0-2.7 2-6 5.6-10.6z" fill="currentColor"/>'),
  shield: svg('0 0 20 20', '<path d="M10 1.6 3 4.2v5.2c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V4.2z" fill="none" stroke="currentColor" stroke-width="2"/>'),
  cross_out: svg('0 0 20 20', '<path d="m4 4 12 12M16 4 4 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  wire: svg('0 0 24 20', '<path d="M1 10c3-6 5 6 8 0s5 6 8 0 4-4 6 0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m5 6 2 3m5-3 2 3m5-3 2 3" stroke="currentColor" stroke-width="1.4"/>'),
  seal: svg('0 0 20 20', '<path d="M10 1.2l1.9 1.5 2.4-.4 1 2.2 2.2 1-.4 2.4 1.5 1.9-1.5 1.9.4 2.4-2.2 1-1 2.2-2.4-.4L10 18.8l-1.9-1.5-2.4.4-1-2.2-2.2-1 .4-2.4L1.4 10l1.5-1.9-.4-2.4 2.2-1 1-2.2 2.4.4z" fill="currentColor"/>'),
  envelope: svg('0 0 22 16', '<path d="M1.5 1.5h19v13h-19z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m1.5 1.5 9.5 7.5 9.5-7.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
}

// A torn deckle on the chosen edges, as a clip-path polygon. Seeded so captures reproduce.
export function deckle(node: HTMLElement, seed: number, edges: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean }, depth = 3): void {
  const r = createSeededRandom(seed)
  const pts: string[] = []
  const n = 22
  const j = (): number => r() * depth
  const run = (on: boolean | undefined, f: (t: number, d: number) => string): void => {
    for (let i = 0; i < n; i++) pts.push(f((i / n) * 100, on ? j() : 0))
  }
  run(edges.top, (t, d) => `${t}% ${d}px`)
  run(edges.right, (t, d) => `calc(100% - ${d}px) ${t}%`)
  run(edges.bottom, (t, d) => `${100 - t}% calc(100% - ${d}px)`)
  run(edges.left, (t, d) => `${d}px ${100 - t}%`)
  node.style.clipPath = `polygon(${pts.join(',')})`
}

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
