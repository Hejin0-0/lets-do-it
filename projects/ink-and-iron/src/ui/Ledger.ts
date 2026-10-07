// The after-action ledger (DESIGN §3, G4): the game-over page. Every loss by round, piece, hex and
// rule, the verdict stamp, and the way back in (Fight again / Rewind). Totals are summed from the
// ledger rows and cross-checked against the figures missing from the bases — they must agree.
import type { Bus } from '../contract/bus.ts'
import type { Briefing, CampaignNote } from '../contract/render-api.ts'
import type { GameState, Side, UnitKind } from '../contract/types.ts'
import { SCENARIOS, UNIT_STATS } from '../rules/index.ts'
import { CHRONICLE, DIFFICULTY, hexName, other, RULE_WORDS, SCENARIO, sideName, verdict } from './words.ts'
import { button, el, esc, ICON, kbd } from './dom.ts'

export interface LedgerView {
  readonly el: HTMLElement
  show(s: GameState, rewindsLeft: number, campaign?: CampaignNote | null): void
  /** The campaign's card (a chapter's history and its question, or the epilogue) in the same book. */
  brief(b: Briefing): void
  hide(): void
  isOpen(): boolean
}

// What happened in 1917 beside what happened tonight (the campaign's alternate history).
const history = (real: string, yours: string): string =>
  `<div class="ii-history"><h3>What happened</h3><p>${esc(real)}</p><h3>Your war</h3><p>${esc(yours)}</p></div>`

export interface LedgerTotals { lost: Record<Side, number>; missing: Record<Side, number> }

// Every piece that has stood on this table: the scenario roster plus arrived reinforcements.
// The rules drop a wiped-out piece from `units`, so names and sides come from here.
function roster(s: GameState): Map<string, { name: string; side: Side; kind: UnitKind }> {
  const m = new Map<string, { name: string; side: Side; kind: UnitKind }>()
  const sc = SCENARIOS[s.scenario]
  const pending = new Set(s.reinforcements.map((r) => r.unit.id))
  for (const u of sc.units) m.set(u.id, u)
  for (const r of sc.reinforcements) if (!pending.has(r.unit.id)) m.set(r.unit.id, r.unit)
  for (const u of s.units) m.set(u.id, u)
  return m
}

// Figures lost by side, two ways: the ledger rows, and full strength minus what still stands on
// the bases (0 for a piece wiped off the table). They differ only if a casualty went unrecorded.
export function ledgerTotals(s: GameState): LedgerTotals {
  const r = roster(s)
  const sideOf = (id: string): Side => r.get(id)?.side ?? (id.toLowerCase().startsWith('br') ? 'BR' : 'DE')
  const lost: Record<Side, number> = { BR: 0, DE: 0 }
  for (const row of s.ledger) lost[sideOf(row.unit)] += row.figures
  const missing: Record<Side, number> = { BR: 0, DE: 0 }
  for (const [id, u] of r) missing[u.side] += UNIT_STATS[u.kind].str - Math.max(0, s.units.find((x) => x.id === id)?.str ?? 0)
  return { lost, missing }
}

function tally(n: number): string {
  let out = ''
  for (let i = 0; i < n; i += 5) {
    const k = Math.min(5, n - i)
    let body = ''
    for (let j = 0; j < Math.min(4, k); j++) body += `<path d="M${3 + j * 5} 2v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`
    if (k === 5) body += '<path d="M1 12 20 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    out += `<svg viewBox="0 0 22 16" aria-hidden="true">${body}</svg>`
  }
  return `<span class="ii-tally" aria-label="${n}">${out}</span>`
}

export function createLedger(layer: HTMLElement, bus: Bus, openMenu: () => void): LedgerView {
  const modal = el('div', 'ii-modal', layer)
  modal.hidden = true
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', 'After-action report')
  const page = el('div', 'ii-paper ii-page ii-shadow', modal)
  let open = false

  function hide(): void {
    open = false
    modal.classList.remove('is-on')
    modal.hidden = true
  }

  function brief(b: Briefing): void {
    page.classList.add('is-brief')
    page.innerHTML = `<p class="ii-kicker">${esc(b.kicker)}</p><h2>${esc(b.head)}</h2>` + history(b.history, b.yours) +
      // the two wars side by side, chapter by chapter (SPEC-AAA H-04)
      (b.timeline ? '<table class="ii-table ii-timeline"><thead><tr><th></th><th>What happened</th><th>Your war</th></tr></thead><tbody>' +
        b.timeline.map(([c, r, y]) => `<tr><td>${esc(c)}</td><td>${esc(r)}</td><td>${esc(y)}</td></tr>`).join('') + '</tbody></table>' : '')
    const go = button('', el('div', 'ii-actions', page), esc(b.button), hide)
    modal.hidden = false
    open = true
    requestAnimationFrame(() => { modal.classList.add('is-on'); go.focus({ preventScroll: true }) })
  }

  function show(s: GameState, rewindsLeft: number, campaign?: CampaignNote | null): void {
    page.classList.remove('is-brief')
    const sc = SCENARIO[s.scenario]
    const v = verdict(s)
    const me = s.human, foe = other(me)
    const t = ledgerTotals(s)
    if (t.lost.BR !== t.missing.BR || t.lost.DE !== t.missing.DE) {
      console.warn('ledger totals disagree with the bases', t) // surfaced for the rules owner; the page shows the ledger
    }
    const r = roster(s)
    const name = (id: string): string => r.get(id)?.name ?? (id === 'battery' ? 'the battery' : id === 'gas' ? 'the gas' : id)
    const sideOf = (id: string): Side => r.get(id)?.side ?? (id.toLowerCase().startsWith('br') ? 'BR' : 'DE')
    const rows = [...s.ledger].sort((a, b) => a.round - b.round)
    const box = (sd: Side): string =>
      `<div class="ii-sidebox"><h4>${sd === 'BR' ? ICON.roundel : ICON.cross} ${sideName(sd)}${sd === me ? ' (you)' : ''}</h4>` +
      `<p>Men lost: <b class="num num2">${t.lost[sd]}</b>${tally(t.lost[sd])}</p>` +
      `<p>Candles left: <b class="num num2">${s.morale[sd]}</b> of <span class="num num2">${s.moraleStart[sd]}</span></p></div>`
    page.innerHTML =
      `<h2>After-action report · ${esc(sc.name)} · ${esc(sc.date)}</h2>` +
      `<div class="ii-ledger-stamp ${v.won ? 'is-won' : 'is-lost'}">${v.stamp}</div>` +
      `<p class="ii-hline">${esc(v.line)}</p>` +
      (campaign ? history(campaign.real, campaign.yours) : '') +
      `<p class="ii-sub">Round <span class="num">${s.round}</span> of <span class="num">${s.maxRounds}</span> · ${DIFFICULTY[s.difficulty].name} · every loss below was inked, fanned or forecast.</p>` +
      `<div class="ii-sides">${box(me)}${box(foe)}</div>` +
      '<h3>The ledger</h3>' +
      (rows.length === 0
        ? '<p class="ii-empty">Not a man lost on either side.</p>'
        : '<table class="ii-table"><thead><tr><th>Rnd</th><th>Piece</th><th>Men</th><th>Hex</th><th>Cause</th></tr></thead><tbody>' +
          rows.map((r, i) => {
            const sd = sideOf(r.unit)
            // each round opens on the day's line (CHRONICLE): the losses read against the day they
            // fell on (blind A/B: "the rows are all 'barrage, the battery'; tie them to 10 July")
            const day = i === 0 || rows[i - 1].round !== r.round ? CHRONICLE[s.scenario][r.round - 1] : undefined
            return (day ? `<tr class="ii-dayrow"><td colspan="5">${esc(day)}</td></tr>` : '') +
              `<tr class="is-${sd}"><td class="num">${r.round}</td><td>${sd === 'BR' ? ICON.roundel : ICON.cross} ${esc(name(r.unit))}</td>` +
              `<td class="n"><span class="num">${r.figures}</span></td><td>${hexName(r.hex)}</td>` +
              `<td>${esc(RULE_WORDS[r.rule])}${r.by ? ', ' + esc(name(r.by)) : ''}</td></tr>`
          }).join('') +
          `</tbody><tfoot><tr><td colspan="2">Totals</td><td class="n" colspan="3">${sideName(me)} <span class="num num2">${t.lost[me]}</span> · ${sideName(foe)} <span class="num num2">${t.lost[foe]}</span></td></tr></tfoot></table>`)
    const actions = el('div', 'ii-actions', page)
    // in the campaign the way on is the next chapter; this night can still be fought again
    const next = campaign ? button('', actions, `${esc(campaign.next)} ▸`, () => bus.emit('ui:cmd', { cmd: 'campaign', arg: 'next' })) : null
    const again = button(campaign ? 'is-quiet' : '', actions, `Fight again ${kbd('Enter')}`, () => bus.emit('ui:cmd', { cmd: 'retry' }))
    if (rewindsLeft > 0) {
      const n = Number.isFinite(rewindsLeft) ? String(rewindsLeft) : '∞'
      button('is-quiet', actions, `${ICON.rewind} Rewind the round ${kbd('R')} <span class="ii-count">${n}</span>`, () => bus.emit('ui:cmd', { cmd: 'rewind' }))
    }
    if (!campaign) button('is-quiet', actions, `The pocket book ${kbd('Esc')}`, openMenu) // Esc still opens it: the campaign's row stays one line
    modal.hidden = false
    open = true
    requestAnimationFrame(() => { modal.classList.add('is-on'); (next ?? again).focus({ preventScroll: true }) })
  }

  return { el: modal, show, brief, hide, isOpen: () => open }
}
