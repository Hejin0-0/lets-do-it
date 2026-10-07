// The forecast tag and the hover card (DESIGN §9 "Forecast tags: anchored to their hex, never
// covering the target"). One parchment tag: with a piece in hand it reads the order the click will
// give (Game's forecast, anchored at ui.anchor); otherwise it reads the ground and any piece under
// the pointer (TERRAIN_INFO, UNIT_STATS). It sits BESIDE the hex, never over it, and flips to the
// other side at the screen edge. A keyboard cursor with no anchor docks the card in the margin.
import type { Forecast, GameState, HexId, Unit } from '../contract/types.ts'
import type { HudUi } from '../contract/render-api.ts'
import { fan, footprint, TERRAIN_INFO, UNIT_STATS } from '../rules/index.ts'
import { EFFECT_WORDS, hexName, hexThreat, sidePlural, suppressed } from './words.ts'
import { el, esc, ICON } from './dom.ts'

export interface TagView {
  readonly el: HTMLElement
  update(s: GameState, ui: HudUi, hover: HexId | null, pointer: { x: number; y: number } | null, dock: { x: number; y: number; w: number; up: boolean } | null): void
  hide(): void
}

const fans = new WeakMap<GameState, Set<HexId>>()
export function enemyFan(s: GameState): Set<HexId> {
  let f = fans.get(s)
  if (!f) {
    f = new Set()
    for (const u of s.units) {
      if (u.side !== s.human && u.kind === 'mg' && u.str > 0 && !suppressed(u, s)) for (const h of fan(s, u.id)) f.add(h)
    }
    fans.set(s, f)
  }
  return f
}

const unitAt = (s: GameState, h: HexId): Unit | undefined => s.units.find((u) => u.hex === h && u.str > 0)
const side = (u: Unit): string => (u.side === 'BR' ? ICON.roundel : ICON.cross)

function groundHtml(s: GameState, h: HexId, u: Unit | undefined): string {
  const t = TERRAIN_INFO[s.terrain[h]]
  const cover = t.cover + (u?.dugIn ? 1 : 0)
  const threat = u && u.side !== s.human ? null : hexThreat(s, h, enemyFan(s), t.cover)
  const bits = [`<b>${hexName(h)}</b>`, esc(t.label)]
  if (t.move < 90) bits.push(`cover <span class="num">${cover}</span>`)
  else bits.push('impassable')
  if (s.wire[h] && threat?.text !== 'Wire: stops here') bits.push('wired')
  let html = `<div class="ii-tag-line">${bits.join(' · ')}`
  if (threat) html += ` · <span class="ii-threat ${threat.bad ? 'is-bad' : 'is-good'}">${threat.bad ? ICON.cross_out : ''}${esc(threat.text)}</span>`
  html += '</div>'
  const obj = s.objectives.find((o) => o.hex === h)
  if (obj) html += `<div class="ii-tag-line">${ICON.seal} <b>${esc(obj.name)}</b> · ${obj.holder ? 'held by the ' + sidePlural(obj.holder) : 'unheld'}</div>`
  return html
}

function pieceHtml(s: GameState, u: Unit): string {
  const k = UNIT_STATS[u.kind]
  const chips: string[] = []
  if (u.dugIn) chips.push('<span class="ii-chip is-good">Dug-in +1</span>')
  if (suppressed(u, s)) chips.push('<span class="ii-chip is-bad">Suppressed</span>')
  if (u.bogged) chips.push('<span class="ii-chip is-bad">Bogged</span>')
  if (u.side === s.human && u.ordered && s.phase === 'player-orders') chips.push('<span class="ii-chip">Order spent</span>')
  return `<div class="ii-tag-head">${side(u)}${esc(u.name)} <span class="ii-sc">${esc(k.label)}</span></div>` +
    `<div class="ii-tag-line"><b class="num">${u.str}</b>/<span class="num">${k.str}</span> men · Move <span class="num">${k.move}</span> · Fire <span class="num">${k.fire}</span> · Range <span class="num">${k.range}</span></div>` +
    (chips.length ? `<div class="ii-chips">${chips.join('')}</div>` : '')
}

// The rules' label is a " · " list ("Trench · cover 2 · safe", "Assault F6: deal 2, take 1 ·
// captures"); warnings are inked red with a cross, "safe" gets the shelter mark.
const WARN = /red ink|mg fire|wire|gas|stops|adjacent|own losses/i
function labelHtml(label: string): string {
  return label.split(' · ').map((b) => WARN.test(b)
    ? `<span class="ii-threat is-bad">${ICON.cross_out}${esc(b)}</span>`
    : b === 'safe' ? `<span class="ii-threat is-good">${ICON.shield}safe</span>` : esc(b)).join(' · ')
}

function forecastHtml(s: GameState, f: Forecast, h: HexId): string {
  const u = unitAt(s, h)
  const strike = !!u && u.side !== s.human
  const move = !!f.path && !strike
  let html = move
    ? `<div class="ii-tag-head">Move to ${hexName(h)}${f.path && f.path.length > 1 ? ` <span class="ii-sc">${f.path.length - 1} hex${f.path.length > 2 ? 'es' : ''}</span>` : ''}</div><div class="ii-tag-line">${labelHtml(f.label)}</div>`
    : `<div class="ii-tag-head">${f.legal ? '' : `<span class="ii-threat is-bad">${ICON.cross_out}Cannot:</span>`}<span class="${f.legal ? '' : 'ii-strike'}">${labelHtml(f.label)}</span></div>`
  if (strike || f.dmgDealt > 0 || f.dmgTaken > 0) {
    const n = (v: number, cls: string, ico: string, word: string): string =>
      `<span class="${v > 0 ? cls : 'is-zero'}">${ico}${word} <b class="num">${v}</b></span>`
    html += `<div class="ii-tag-dmg">${n(f.dmgDealt, 'is-dealt', ICON.swords, 'Deals')}${n(f.dmgTaken, 'is-taken', ICON.wound, 'Takes')}</div>`
  }
  const shown = new Set(['stop', 'capture'].filter(() => move)) // a move's label already says these
  const fx = f.effects.filter((e) => !shown.has(e))
  if (fx.length) {
    const bad = new Set(['pin', 'stop'])
    html += `<div class="ii-chips">${fx.map((e) => `<span class="ii-chip ${bad.has(e) ? 'is-bad' : 'is-good'}">${EFFECT_WORDS[e]}</span>`).join('')}</div>`
  }
  if (u && strike) html += `<div class="ii-tag-line">${side(u)} ${esc(u.name)} · <span class="num">${u.str}</span> men${u.dugIn ? ' · dug-in' : ''}${suppressed(u, s) ? ' · suppressed' : ''}</div>`
  if (move) {
    // Walking INTO the enemy's red ink is said as loudly as walking into wire: an outside review
    // moved a piece onto a freshly inked hex with no warning in the tag.
    const inked = s.intents.some((i) => i.side !== s.human && (i.kind === 'gas' ? footprint(s, i) : [i.target]).includes(h))
    if (inked) html += `<div class="ii-tag-line"><span class="ii-threat is-bad">${ICON.cross_out}Red ink: shells land here at the bell</span></div>`
    const obj = s.objectives.find((o) => o.hex === h)
    return obj ? html + `<div class="ii-tag-line">${ICON.seal} <b>${esc(obj.name)}</b> · objective</div>` : html
  }
  return html + groundHtml(s, h, u)
}

export function createTag(layer: HTMLElement): TagView {
  const tag = el('div', 'ii-tag', layer)
  tag.setAttribute('role', 'status')
  tag.setAttribute('aria-live', 'polite')
  let sig = ''
  let pos = ''

  function hide(): void {
    if (!tag.classList.contains('is-on')) return
    tag.classList.remove('is-on')
    sig = ''
  }

  return {
    el: tag,
    hide,
    update(s, ui, hover, pointer, dock) {
      // Only while the player can act on it: an outside review saw a hover tag pinned through the
      // enemy's turn and the reinforcement banners.
      if (hover === null || s.phase !== 'player-orders' || ui.busy) { hide(); return }
      const f = ui.forecast && ui.anchor ? ui.forecast : null
      const anchor = f ? ui.anchor : pointer
      const u = unitAt(s, hover)
      const key = `${f ? 'f' : 'h'}|${hover}|${f ? JSON.stringify(f) : ''}|${s.round}|${s.phase}|${s.intents.length}|${u ? u.id + u.str + u.dugIn + u.suppressedUntil + u.ordered : ''}`
      if (key !== sig) {
        sig = key
        tag.innerHTML = f ? forecastHtml(s, f, hover) : (u ? pieceHtml(s, u) : '') + groundHtml(s, hover, u)
        tag.classList.toggle('is-illegal', !!f && !f.legal)
        pos = ''
      }
      // Beside the target, never over it: the gap clears the hovered hex AND its neighbours (1.5
      // hex widths on screen) — an outside review found "Move to F6" printed over F6 and G6, the
      // very hexes being chosen between.
      const W = innerWidth, H = innerHeight
      const w = tag.offsetWidth, h = tag.offsetHeight
      let x: number, y: number, cls: string
      if (dock) { // a dock, when the HUD gives one, wins over the hover point
        x = dock.x + Math.max(0, dock.w - w)
        y = dock.up ? dock.y - h : dock.y
        cls = 'is-docked'
      } else if (anchor) {
        const gap = Math.max(40, ui.hexPx ? ui.hexPx * 1.5 : Math.min(W, H) * 0.06)
        x = anchor.x + gap
        cls = 'is-right'
        if (x + w > W - 8) { x = anchor.x - gap - w; cls = 'is-left' }
        if (x < 8) { x = Math.max(8, Math.min(W - w - 8, anchor.x - w / 2)); cls = 'is-docked' }
        y = Math.max(8, Math.min(H - h - 8, anchor.y - h / 2 - 6))
        if (cls === 'is-docked') y = anchor.y - gap - h < 8 ? anchor.y + gap : anchor.y - gap - h
      } else { hide(); return }
      const p = `${Math.round(x)},${Math.round(y)},${cls}`
      if (p !== pos) {
        pos = p
        tag.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
        tag.classList.remove('is-right', 'is-left', 'is-docked')
        tag.classList.add(cls)
      }
      tag.classList.add('is-on')
    },
  }
}
