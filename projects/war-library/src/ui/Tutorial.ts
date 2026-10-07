// DESIGN §7, the first 60 seconds. The title card ("Click to wake the table", "Sound starts on
// your first click") during the establishing shot, then a tutor's note pinned top-centre, above
// the board's far edge, for each step the Game drives through Hud.tutorial(step); -1 hides it.
import type { Bus } from '../contract/bus.ts'
import { RULE_CARD, TUTOR, TUTOR_STEPS } from './words.ts'
import { el, esc } from './dom.ts'

export interface TutorView {
  readonly note: HTMLElement
  readonly title: HTMLElement
  step(n: number): void
  hideTitle(): void
  titleOn(): boolean
}

const bold = (s: string): string => esc(s).replace(/\b([A-M][1-9])\b/g, '<b>$1</b>').replace(/\(([^)]+)\)/g, '(<b>$1</b>)')

export function createTutorial(layer: HTMLElement, bus: Bus, openBook: () => void): TutorView {
  const title = el('div', 'ii-title', layer)
  // a poster: the title over the roof, the call to wake it over the rug, and the lancets, the
  // chandelier and the war-table clear between them (a blind A/B: the old dark box hid the lancets)
  title.innerHTML =
    '<div class="ii-title-top"><h1>Ink &amp; Iron</h1>' +
    '<p class="ii-sub">The Enchanted War-Table</p>' +
    '<p class="ii-where">The Yser front · Midnight, 1917</p>' +
    // the hook before the first click (blind A/B: "show the alternate-history premise on the title")
    '<p class="ii-premise">The real battles of 1917, on their real days. Your orders decide what history comes next.</p></div>' +
    '<div class="ii-title-cta"><span class="ii-wake">Click to wake the table</span>' +
    '<p class="ii-sound">Sound starts on your first click.</p><div class="ii-title-links"></div></div>'
  title.style.pointerEvents = 'none' // clicks fall through to the table, which wakes it (Game.skipIntro)
  const links = title.querySelector('.ii-title-links') as HTMLElement
  const skip = el('button', 'ii-link', links, 'I’ve played before: skip the tutorial')
  skip.type = 'button'
  skip.style.pointerEvents = 'auto'
  skip.addEventListener('click', () => {
    bus.emit('ui:cmd', { cmd: 'tutorial-skip' })
    bus.emit('ui:cmd', { cmd: 'skip-intro' })
    hideTitle()
  })
  // The three battles and three difficulties are in the pocket book; an outside review only found
  // them by pressing Esc mid-game, so the title card opens it too.
  const battles = el('button', 'ii-link', links, 'Choose a battle and difficulty')
  battles.type = 'button'
  battles.style.pointerEvents = 'auto'
  battles.addEventListener('click', () => {
    bus.emit('ui:cmd', { cmd: 'tutorial-skip' })
    bus.emit('ui:cmd', { cmd: 'skip-intro' })
    hideTitle()
    openBook()
  })
  // the campaign: the three battles on the real 1917 calendar of the coast front, each bending the next
  const campaign = el('button', 'ii-link is-pill', links, 'The campaign: the Yser, 1917')
  links.before(campaign) // second to the call to wake, above the two small doors
  campaign.type = 'button'
  campaign.style.pointerEvents = 'auto'
  campaign.addEventListener('click', () => {
    bus.emit('ui:cmd', { cmd: 'tutorial-skip' })
    bus.emit('ui:cmd', { cmd: 'skip-intro' })
    hideTitle()
    bus.emit('ui:cmd', { cmd: 'campaign', arg: 'start' })
  })

  const note = el('div', 'ii-paper ii-tutor ii-shadow', layer)
  note.hidden = true
  note.setAttribute('role', 'note')
  const head = el('div', 'ii-tutor-head', note)
  const count = el('span', '', head)
  const skipNote = el('button', 'ii-link', head, 'Skip')
  skipNote.type = 'button'
  skipNote.addEventListener('click', () => bus.emit('ui:cmd', { cmd: 'tutorial-skip' }))
  const text = el('p', 'ii-tutor-text', note)
  const rules = el('div', 'ii-tutor-rules', note, RULE_CARD.join(' '))

  function hideTitle(): void { title.classList.add('is-gone') }

  return {
    note, title, hideTitle,
    titleOn: () => !title.classList.contains('is-gone'),
    step(n) {
      hideTitle()
      if (n < 0 || n >= TUTOR.length) { note.hidden = true; return }
      const line = TUTOR[n]
      note.hidden = false
      count.textContent = `Tutor’s note · ${line.at} of ${TUTOR_STEPS}`
      text.innerHTML = bold(line.text)
      rules.hidden = line.at !== 1 // the rim card's three rules (G8) ride on the first note
    },
  }
}
