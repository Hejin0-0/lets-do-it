// The Esc menu, dressed as a field-service pocket book: scenario, difficulty and restart on the
// left; speed, sound and reduced motion on the right with the key legend and the three rules.
// Speed/sound/motion act at once; scenario and difficulty wait for "Start" (a restart).
import type { Bus } from '../contract/bus.ts'
import type { HudUi } from '../contract/render-api.ts'
import type { Difficulty, GameState, ScenarioId } from '../contract/types.ts'
import { CAMPAIGN, DIFFICULTY, KEYMAP, RULE_CARD, SCENARIO } from './words.ts'
import { button, el, esc, kbd } from './dom.ts'

export interface MenuHost {
  state(): GameState | null
  ui(): HudUi | null
  reduced(): boolean
  setReduced(on: boolean): void
}

export interface MenuView {
  readonly el: HTMLElement
  open(): void
  close(): void
  toggle(): void
  isOpen(): boolean
  refresh(): void
}

export function createMenu(layer: HTMLElement, bus: Bus, host: MenuHost): MenuView {
  const modal = el('div', 'ii-modal', layer)
  modal.hidden = true
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', 'The pocket book: settings')
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close() })
  const page = el('div', 'ii-paper ii-page ii-shadow', modal)
  let open = false
  let pick: { scenario: ScenarioId; difficulty: Difficulty } = { scenario: 's1', difficulty: 'recruit' }
  let back: Element | null = null
  let sig = ''

  function radio<T extends string>(parent: HTMLElement, ids: readonly T[], cur: T, label: (id: T) => [string, string], on: (id: T) => void): void {
    const g = el('div', 'ii-opts', parent)
    g.setAttribute('role', 'radiogroup')
    for (const id of ids) {
      const [a, b] = label(id)
      const o = el('button', 'ii-opt', g)
      o.type = 'button'
      o.setAttribute('role', 'radio')
      o.setAttribute('aria-checked', String(id === cur))
      o.innerHTML = `<span class="ii-radio"></span><b>${esc(a)}</b><span class="ii-optnote">${esc(b)}</span>`
      o.addEventListener('click', () => { on(id); build() })
    }
  }

  function seg(parent: HTMLElement, label: string, opts: [string, boolean, () => void][]): void {
    const row = el('div', 'ii-toggle', parent)
    el('span', '', row, label)
    const g = el('div', 'ii-seg', row)
    g.setAttribute('role', 'group')
    g.setAttribute('aria-label', label)
    for (const [txt, on, f] of opts) {
      const b = button('', g, esc(txt), () => { if (!on) { f(); requestAnimationFrame(build) } })
      b.setAttribute('aria-pressed', String(on))
    }
  }

  function build(): void {
    const s = host.state(), ui = host.ui()
    const speed = ui?.speed ?? 1, muted = ui?.muted ?? false, reduced = host.reduced()
    sig = `${s?.scenario}|${s?.difficulty}|${speed}|${muted}|${reduced}|${pick.scenario}|${pick.difficulty}`
    const focusIdx = [...page.querySelectorAll('button')].indexOf(document.activeElement as HTMLButtonElement)
    page.innerHTML = '<h2>Field service pocket book</h2><p class="ii-hline">Orders of the night</p>'
    const book = el('div', 'ii-book', page)
    const left = el('div', '', book)
    // the campaign: the three battles on the real 1917 calendar, each bending the next
    // one row, no heading: with a heading and its line the book ran past a 720 px screen
    const camp = el('div', 'ii-actions', left)
    camp.title = CAMPAIGN.sub
    const saved = ui?.campaign ?? null
    const go = (how: string): void => { bus.emit('ui:cmd', { cmd: 'campaign', arg: `${how};difficulty=${pick.difficulty}` }); close() }
    if (saved !== null && saved > 0) button('', camp, `Continue the campaign · ${esc(CAMPAIGN.short(saved).replace(' · ', ' of III · '))}`, () => go('continue'))
    else button('', camp, `The campaign: ${esc(CAMPAIGN.title)} · ${DIFFICULTY[pick.difficulty].name}`, () => go('start'))
    el('h3', '', left, 'The battle')
    radio(left, ['s1', 's2', 's3'] as const, pick.scenario, (id) => [`${SCENARIO[id].name}`, SCENARIO[id].blurb], (id) => { pick.scenario = id })
    el('h3', '', left, 'The enemy general')
    radio(left, ['recruit', 'veteran', 'general'] as const, pick.difficulty, (id) => [DIFFICULTY[id].name, DIFFICULTY[id].note], (id) => { pick.difficulty = id })
    const changed = !!s && (pick.scenario !== s.scenario || pick.difficulty !== s.difficulty)
    const acts = el('div', 'ii-actions', left)
    button('', acts, `Back to the table ${kbd('Esc')}`, close)
    button(changed ? 'is-danger' : 'is-quiet', acts,
      changed ? `Start ${esc(SCENARIO[pick.scenario].name)}, ${DIFFICULTY[pick.difficulty].name}` : 'Restart this battle',
      () => {
        bus.emit('ui:cmd', { cmd: 'retry', arg: `scenario=${pick.scenario};difficulty=${pick.difficulty}` })
        close()
      })

    const right = el('div', '', book)
    el('h3', '', right, 'The table')
    const tg = el('div', 'ii-toggles', right)
    seg(tg, 'Speed', [['1×', speed === 1, () => bus.emit('ui:cmd', { cmd: 'speed' })], ['2×', speed !== 1, () => bus.emit('ui:cmd', { cmd: 'speed' })]])
    seg(tg, 'Sound (M)', [['On', !muted, () => bus.emit('ui:cmd', { cmd: 'mute' })], ['Off', muted, () => bus.emit('ui:cmd', { cmd: 'mute' })]])
    seg(tg, 'Reduced motion', [['Off', !reduced, () => host.setReduced(false)], ['On', reduced, () => host.setReduced(true)]])
    el('h3', '', right, 'The keys')
    const dl = el('dl', 'ii-keys', right)
    for (const [k, v] of KEYMAP) { el('dt', '', dl).innerHTML = k.split(/(, | \/ )/).map((p) => (p === ', ' || p === ' / ' ? p : kbd(esc(p)))).join(''); el('dd', '', dl, v) }
    el('h3', '', right, 'The three rules')
    el('p', 'ii-rules', right, RULE_CARD.join(' '))
    const all = page.querySelectorAll('button')
    const f = all[Math.max(0, Math.min(all.length - 1, focusIdx))] as HTMLButtonElement | undefined
    if (open && focusIdx >= 0 && f) f.focus({ preventScroll: true })
  }

  // Keep Tab inside the book while it is open.
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return
    const all = [...page.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    if (all.length === 0) return
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    const j = e.shiftKey ? (i <= 0 ? all.length - 1 : i - 1) : (i + 1) % all.length
    all[j].focus()
    e.preventDefault()
  })

  function openIt(): void {
    const s = host.state()
    if (s) pick = { scenario: s.scenario, difficulty: s.difficulty }
    back = document.activeElement
    open = true
    modal.hidden = false
    build()
    requestAnimationFrame(() => {
      modal.classList.add('is-on')
      const first = page.querySelector<HTMLButtonElement>('.ii-opt[aria-checked="true"]')
      first?.focus({ preventScroll: true })
    })
  }
  function close(): void {
    if (!open) return
    open = false
    modal.classList.remove('is-on')
    modal.hidden = true
    if (back instanceof HTMLElement) back.focus({ preventScroll: true })
    back = null
  }

  return {
    el: modal,
    open: openIt,
    close,
    toggle() { if (open) close(); else openIt() },
    isOpen: () => open,
    refresh() {
      if (!open) return
      const s = host.state(), ui = host.ui()
      const now = `${s?.scenario}|${s?.difficulty}|${ui?.speed ?? 1}|${ui?.muted ?? false}|${host.reduced()}|${pick.scenario}|${pick.difficulty}`
      if (now !== sig) build()
    },
  }
}
