// The HUD (Worker-D, DESIGN §9 UI): the margins of the war-table in parchment, brass and wax.
//   top-left   the despatch — scenario, "Round 3 of 8", phase, objective seals (+ tutor's note)
//   top-right  the candle rail — your candles and theirs (morale), order pips, HE shells, menu
//   centre-top banners (1.6 s)
//   bottom     Undo (Z) · the wax-seal bell (Space) · Rewind (R, with count); the intercepted
//              slip on the left; the "Ring anyway?" strip (G9) takes the bar when it asks
//   world      the forecast/hover tag beside its hex (Forecast.ts)
//   modal      the pocket book (Esc, Menu.ts) and the after-action ledger (Ledger.ts)
// At most ~12% of the screen and clear of the board: the board spans roughly the middle 62-72%
// of the width and 8-88% of the height, so everything lives in the corners and the bottom strip.
// render() runs every frame, so each block rebuilds only when its signature string changes.
import './hud.css'
import type { Bus, UiCmd } from '../contract/bus.ts'
import type { Hud, HudUi } from '../contract/render-api.ts'
import type { GameState, HexId, Side } from '../contract/types.ts'
import { legal, planSlip } from '../rules/index.ts'
import { SCENARIOS } from '../rules/scenarios/index.ts'
import { button, deckle, el, esc, ICON, kbd } from './dom.ts'
import { createTag } from './Forecast.ts'
import { createLedger } from './Ledger.ts'
import { createMenu } from './Menu.ts'
import { createTutorial } from './Tutorial.ts'
import { installKeys } from './Keys.ts'
import { CHRONICLE, HISTORY_MARK, hexName, interceptParts, other, PHASE_WORDS, SCENARIO, sideName, sidePlural } from './words.ts'

const BANNER_MS = 1600

// rules.planSlip words the plan as "Intercepted, by runner: '…'"; the slip sets the stamp, the
// runner and the quoted order apart.
function slipParts(text: string | null): { via: string; order: string } | null {
  const m = text?.match(/^Intercepted, ([^:]+): '(.*)'$/s)
  return m ? { via: m[1], order: m[2] } : text ? { via: 'intercepted', order: text } : null
}
const TITLE_MS = 6500
const CANDLE_H = [16, 14, 17, 15, 13, 16, 15, 17, 14, 16, 13, 15, 17, 14, 16, 15, 13, 17, 15, 14]

export function createHud(root: HTMLElement, bus: Bus): Hud {
  const layer = el('div', 'ii', root)
  layer.setAttribute('aria-label', 'War-table controls')

  let S: GameState | null = null
  let U: HudUi | null = null
  let hover: HexId | null = null
  let pointer: { x: number; y: number } | null = null
  let kbdHover = false
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let publishes = 0
  let bannerRound = -1
  const sig: Record<string, string> = {}
  const changed = (k: string, v: string): boolean => (sig[k] === v ? false : ((sig[k] = v), true))
  const ui = (cue: 'ui' = 'ui'): void => bus.emit('audio', { cue })

  // ---- top-left: the despatch ------------------------------------------------------------
  const despatch = el('div', 'ii-paper ii-despatch ii-shadow', layer)
  deckle(despatch, 11, { bottom: true, right: true }, 3)
  el('span', 'ii-pin', despatch)
  const kicker = el('div', 'ii-kicker', despatch)
  const roundEl = el('div', 'ii-round', despatch)
  const objEl = el('div', 'ii-obj', despatch)
  const markEl = el('div', 'ii-mark', despatch) // the blue pencil on the map, in words (HISTORY_MARK)

  const tut = createTutorial(layer, bus, () => { if (!menu.isOpen()) toggleMenu() })

  // ---- top-right: the candle rail -------------------------------------------------------------
  const rail = el('div', 'ii-rail', layer)
  const rowYou = el('div', 'ii-mrow', rail)
  const rowFoe = el('div', 'ii-mrow', rail)
  const foot = el('div', 'ii-mfoot', rail)
  const pips = el('div', 'ii-pips', foot)
  const shells = button('ii-shells', foot, '', () => bus.emit('ui:cmd', { cmd: 'barrage' }), 'The battery: shell a hex (B)')
  shells.title = 'The battery: one order and one shell (B)'
  const menuBtn = button('ii-menubtn', foot, 'Menu', () => toggleMenu(), 'Menu (Esc)')
  menuBtn.title = 'The pocket book: settings, keys, restart (Esc)'

  // ---- centre-top banner ------------------------------------------------------------------------
  const banner = el('div', 'ii-paper ii-banner ii-shadow', layer)
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')
  let bannerT = 0

  // ---- bottom: undo, the bell, rewind ---------------------------------------------------------
  const bar = el('div', 'ii-bar', layer)
  // The battle's own order, when it has one: the S2 creeping barrage, the S3 sluice. An outside
  // review read both in the scenario blurbs and found no way to give them.
  const special = button('ii-special', bar, '', () => {
    const s = S
    if (s) bus.emit('ui:cmd', { cmd: SCENARIOS[s.scenario].creep ? 'creep' : 'sluice' })
  }, 'The battle’s special order')
  special.hidden = true
  const undoBtn = button('ii-undo', bar, `${ICON.undo}<span class="ii-lbl">Undo</span>${kbd('Z')}`, () => bus.emit('ui:cmd', { cmd: 'undo' }), 'Undo (Z)')
  const bell = el('button', 'ii-bell', bar)
  bell.type = 'button'
  bell.innerHTML = `<span class="ii-bell-ribbon"></span><span class="ii-wax">${ICON.bell}</span><span class="ii-bell-label"><span class="ii-bell-text">Ring the bell</span>${kbd('Space')}</span>`
  const bellText = bell.querySelector('.ii-bell-text') as HTMLElement
  bell.addEventListener('click', (e) => { ringBell(); if ((e as PointerEvent).pointerType) bell.blur() })
  const rewindBtn = button('ii-rewind', bar, '', () => bus.emit('ui:cmd', { cmd: 'rewind' }), 'Rewind (R)')

  // ---- bottom-left: the slip ----------------------------------------------------------------------
  const slip = el('div', 'ii-paper ii-slip ii-shadow', layer)
  deckle(slip, 23, { top: true, right: true }, 2.5)
  const slipText = el('p', 'ii-slip-text', slip)
  let slipTarget: HexId | null = null
  slip.addEventListener('pointerenter', () => { if (slipTarget !== null) bus.emit('ui:hover', { hex: slipTarget }) })
  slip.addEventListener('pointerleave', () => { if (slipTarget !== null) bus.emit('ui:hover', { hex: null }) })
  const slipBtn = button('ii-slipbtn', layer, `${ICON.envelope}<span class="ii-dot"></span>`, () => {
    slip.classList.toggle('is-open')
    ui()
  }, 'The intercepted order')
  const slipDot = slipBtn.querySelector('.ii-dot') as HTMLElement

  // ---- the "Ring anyway?" strip (G9) -------------------------------------------------------------
  const confirmEl = el('div', 'ii-paper ii-confirm ii-shadow', layer)
  confirmEl.hidden = true
  confirmEl.setAttribute('role', 'alertdialog')
  const confirmText = el('p', '', confirmEl)
  const confirmBtns = el('div', 'ii-btns', confirmEl)
  const yesBtn = button('is-danger', confirmBtns, `Ring anyway ${kbd('Space')}`, () => confirm(true))
  button('is-quiet', confirmBtns, `Not yet ${kbd('Esc')}`, () => confirm(false))

  const tag = createTag(layer)
  const menu = createMenu(layer, bus, {
    state: () => S, ui: () => U, reduced: () => reduced,
    setReduced: (on) => setReduced(on),
  })
  const ledger = createLedger(layer, bus, () => toggleMenu())

  // ---- behaviour -------------------------------------------------------------------------------
  function showBanner(text: string): void {
    clearTimeout(bannerT)
    if (!text) { banner.classList.remove('is-on'); return } // '' takes a stale line down
    banner.textContent = text
    banner.classList.add('is-on')
    // long lines stay up long enough to read (the first-turn hint, the enemy's narration)
    bannerT = window.setTimeout(() => banner.classList.remove('is-on'), Math.max(BANNER_MS, 700 + text.length * 42))
  }

  function toggleMenu(): void {
    menu.toggle()
    ui()
  }

  function setReduced(on: boolean): void {
    reduced = on
    layer.classList.toggle('is-reduced', on)
    bus.emit('ui:cmd', { cmd: 'menu', arg: `reduced=${on ? 'on' : 'off'}` })
  }

  // Movable pieces standing on red ink, exactly as the Game's own guard counts them.
  function onRed(s: GameState): string[] {
    const red = new Set(s.intents.filter((i) => i.side !== s.human).map((i) => i.target))
    const hit = s.units.filter((u) => u.side === s.human && u.str > 0 && red.has(u.hex))
    if (hit.length === 0) return []
    const moves = legal(s)
    return hit.filter((u) => moves.some((a) => a.t === 'move' && a.unit === u.id)).map((u) => `${u.name} at ${hexName(u.hex)}`)
  }

  function ringBell(): void {
    const s = S
    flash('bell')
    // During the enemy's turn the bell is the "hurry them on" button (Game.hurry).
    if (s && s.phase !== 'player-orders' && s.phase !== 'over') { bus.emit('ui:cmd', { cmd: 'skip' }); return }
    // Not refused while a move is still animating: the Game buffers the bell and fast-forwards the
    // move (an outside review pressed Space straight after an order and saw the ring swallowed).
    if (!s || s.phase !== 'player-orders') { bus.emit('audio', { cue: 'invalid' }); return }
    // G9: the first ring of a battle asks if a piece that could still move stands on red ink.
    const red = s.round === 1 ? onRed(s) : []
    if (red.length > 0 && confirmEl.hidden) {
      confirmText.innerHTML = `Men still stand on red ink: <b>${esc(red.join(', '))}</b>. Ring anyway?`
      confirmEl.hidden = false
      bar.hidden = true
      slip.hidden = true
      bus.emit('audio', { cue: 'invalid' })
      requestAnimationFrame(() => yesBtn.focus({ preventScroll: true }))
      return
    }
    bus.emit('ui:cmd', { cmd: 'bell', arg: red.length > 0 ? 'confirmed' : undefined })
  }

  function confirm(yes: boolean): void {
    if (confirmEl.hidden) return
    confirmEl.hidden = true
    bar.hidden = false
    slip.hidden = false
    if (yes) bus.emit('ui:cmd', { cmd: 'bell', arg: 'confirmed' })
  }

  const FLASH: Partial<Record<UiCmd | 'bell', HTMLElement>> = { undo: undoBtn, rewind: rewindBtn, bell, barrage: shells, menu: menuBtn }
  function flash(c: UiCmd | 'bell'): void {
    const b = FLASH[c]
    if (!b) return
    b.classList.add('is-pressed')
    setTimeout(() => b.classList.remove('is-pressed'), 140)
  }

  installKeys(bus, {
    state: () => S, ui: () => U,
    modal: () => (menu.isOpen() ? 'menu' : !confirmEl.hidden ? 'confirm' : ledger.isOpen() ? 'ledger' : tut.titleOn() ? 'title' : null),
    bell: ringBell, confirm, menu: toggleMenu, closeMenu: () => { menu.close(); ui() }, flash,
    keyboardHover: (on) => { kbdHover = on },
  })

  bus.on('ui:hover', ({ hex }) => { hover = hex })
  bus.on('ui:cmd', ({ cmd }) => {
    if (cmd === 'skip-intro' || cmd === 'tutorial-skip') tut.hideTitle()
    if (cmd === 'mute') ui()
  })
  bus.on('state', ({ state, events }) => {
    publishes += 1
    if (publishes >= 2) tut.hideTitle() // a second load (setState, retry): the table is awake
    if (!confirmEl.hidden && state.phase !== 'player-orders') confirm(false)
    const by = (sd: Side): string => (sd === state.human ? 'You take' : `The ${sidePlural(sd)} take`)
    for (const ev of events) {
      if (ev.e === 'captured') {
        const o = state.objectives.find((x) => x.hex === ev.hex)
        showBanner(`${by(ev.by)} ${o ? o.name : hexName(ev.hex)}.`)
        break
      }
      if (ev.e === 'reinforce') {
        const u = state.units.find((x) => x.id === ev.unit)
        showBanner(`Reinforcements: ${u ? `${u.name} at ${hexName(u.hex)}` : 'fresh men'}.`)
        break
      }
      if (ev.e === 'weather' && ev.next === 'rain' && ev.now !== 'rain') {
        showBanner('Rain tomorrow: polder and craters turn to mud.')
        break
      }
    }
  })
  addEventListener('pointermove', (e) => {
    const onCanvas = (e.target as Element | null)?.tagName === 'CANVAS'
    pointer = onCanvas ? { x: e.clientX, y: e.clientY } : null
    if (onCanvas) kbdHover = false
  }, { passive: true })
  addEventListener('pointerdown', () => tut.hideTitle(), { capture: true, passive: true })
  const titleT = window.setTimeout(() => tut.hideTitle(), TITLE_MS)
  if (reduced) setTimeout(() => setReduced(true), 0) // after the Game has wired the bus
  layer.classList.toggle('is-reduced', reduced)

  // ---- per-frame render ---------------------------------------------------------------------------
  function candles(sd: Side, s: GameState, prev: number): string {
    const n = s.moraleStart[sd], lit = Math.max(0, Math.min(n, s.morale[sd]))
    let h = ''
    for (let i = 0; i < n; i++) {
      const on = i < lit
      h += `<i class="ii-candle ${on ? 'is-lit' : 'is-out'}${!on && i < prev ? ' is-fresh' : ''}" style="--d:${(-i * 0.37).toFixed(2)}s;--h:${CANDLE_H[i % CANDLE_H.length]}px"></i>`
    }
    return h
  }
  let prevMorale: Record<Side, number> | null = null

  function render(s: GameState, u: HudUi): void {
    S = s
    U = u
    const me = s.human, foe = other(me)
    const sc = SCENARIO[s.scenario]
    const enemyPhase = s.phase === 'enemy-orders' || s.phase === 'bell'

    if (changed('desp', `${s.scenario}|${s.round}|${s.maxRounds}|${s.phase}|${s.objectives.map((o) => o.holder).join()}|${u.chapter}`)) {
      // in the campaign the chapter stays in view through the battle (blind A/B: "the story only shows in the ledger")
      kicker.textContent = `${u.chapter != null ? `Chapter ${['I', 'II', 'III'][u.chapter]} · ` : ''}${sc.name} · ${sc.date}`
      markEl.textContent = HISTORY_MARK[s.scenario]
      roundEl.innerHTML = `<span>Round <span class="num">${s.round}</span><span class="ii-of"> of <span class="num">${s.maxRounds}</span></span></span>` +
        `<span class="ii-phase${enemyPhase ? ' is-enemy' : ''}">· ${esc(PHASE_WORDS[s.phase])}</span>`
      const held = s.objectives.filter((o) => o.holder === me).length
      objEl.innerHTML = s.objectives.map((o) => {
        const k = o.holder ?? 'none'
        const glyph = o.holder === 'BR' ? ICON.roundel : o.holder === 'DE' ? ICON.cross : ''
        return `<span class="ii-seal is-${k}" title="${esc(o.name)}: ${o.holder ? sideName(o.holder) : 'unheld'}">${ICON.seal}${glyph}</span>`
      }).join('') +
        `<span class="ii-objtext">${esc(sc.short)}</span>` +
        // "need 2 · holding 3", not "hold 3/2": the numerator-first form read backwards.
        `<span class="ii-need">need <span class="num">${sc.need}</span><span class="ii-hold"> · holding <span class="num">${held}</span></span></span>`
      objEl.setAttribute('aria-label', `${sc.goal} You hold ${held} of ${s.objectives.length}.`)
    }
    // Banners drop below the tutor's note while it is up.
    const bt = tut.note.hidden ? '' : `${tut.note.offsetTop + tut.note.offsetHeight + 6}px`
    if (changed('bannerTop', bt)) banner.style.setProperty('--banner-top', bt || null)

    if (changed('morale', `${s.morale.BR}|${s.morale.DE}|${s.moraleStart.BR}|${s.moraleStart.DE}|${me}`)) {
      const prev = prevMorale ?? s.morale
      const row = (sd: Side, label: string): string =>
        `<span class="ii-mside">${sd === 'BR' ? ICON.roundel : ICON.cross}<span>${label}</span></span>` +
        `<span class="ii-candles" aria-hidden="true">${candles(sd, s, prev[sd])}</span>` +
        `<b class="ii-mcount num num2">${Math.max(0, s.morale[sd])}</b>`
      rowYou.innerHTML = row(me, 'You')
      rowFoe.innerHTML = row(foe, 'Foe')
      rowYou.setAttribute('aria-label', `Your candles (morale): ${s.morale[me]} of ${s.moraleStart[me]}`)
      rowFoe.setAttribute('aria-label', `${sideName(foe)} candles: ${s.morale[foe]} of ${s.moraleStart[foe]}`)
      rowYou.title = rowYou.getAttribute('aria-label') ?? ''
      rowFoe.title = rowFoe.getAttribute('aria-label') ?? ''
      prevMorale = { ...s.morale }
    }

    const pipSide: Side = s.phase === 'enemy-orders' ? foe : me
    const pipsOn = s.phase === 'player-orders' || s.phase === 'enemy-orders'
    const limit = s.orderLimit[pipSide]
    if (changed('pips', `${pipSide}|${pipsOn}|${s.ordersLeft}|${limit}`)) {
      let h = `<span class="ii-pipl">${pipSide === me ? 'Orders' : 'Foe orders'}</span>`
      for (let i = 0; i < limit; i++) h += `<i class="ii-pip ${pipsOn && i < s.ordersLeft ? 'is-full' : 'is-spent'}"></i>`
      pips.innerHTML = h
      pips.classList.toggle('is-foe', pipSide !== me)
      pips.setAttribute('aria-label', `${pipsOn ? s.ordersLeft : 0} of ${limit} orders left`)
      pips.title = pips.getAttribute('aria-label') ?? ''
    }

    const playing = s.phase === 'player-orders' && !u.busy
    const armed = u.armed === 'barrage'
    const he = s.shells[me].he
    if (changed('shells', `${he}|${playing}|${s.ordersLeft}|${armed}`)) {
      let h = '<span>HE</span>'
      // Four casings at most, then the numeral carries it: at 7-8 HE the full row pushed the Menu
      // button off the right edge at 1280x720 (outside review, Veteran S2).
      for (let i = 0; i < Math.min(4, he); i++) h += '<i class="ii-shell"></i>'
      shells.innerHTML = h + `<b class="num">${he}</b>`
      shells.disabled = !playing || he <= 0 || s.ordersLeft <= 0
      shells.classList.toggle('is-armed', armed && !shells.disabled)
      shells.setAttribute('aria-pressed', String(armed))
    }

    const ownLeft = s.units.some((x) => x.side === me && x.str > 0 && !x.ordered)
    const ready = playing && (s.ordersLeft <= 0 || !ownLeft)
    if (changed('bell', `${s.phase}|${u.busy}|${ready}`)) {
      // Your turn reads as your turn from the moment the phase flips: the last beats of an
      // animation still running no longer grey the bell to "Wait…" (an outside review read that as
      // the UI lagging the phase) — a ring then is buffered by the Game.
      const mine = s.phase === 'player-orders'
      const hurry = !mine && s.phase !== 'over'
      bell.disabled = !mine && !hurry
      bell.classList.toggle('is-ready', ready)
      bell.classList.toggle('is-hurry', hurry)
      bellText.textContent = mine ? 'Ring the bell' : s.phase === 'over' ? 'Cease fire' : 'Hurry them ▸▸'
      bell.setAttribute('aria-label', mine ? 'Ring the bell (Space): end your orders'
        : hurry ? 'Hurry the enemy’s turn along (Space)' : bellText.textContent)
    }
    // The special order: S2 walks a creeping barrage (3 HE, one order), S3 opens the sluice once.
    const rs = SCENARIOS[s.scenario]
    const kind = rs.creep && me === 'BR' ? 'creep' : rs.sluice && me === 'BR' ? 'sluice' : null
    const spWhy = !kind ? '' : s.ordersLeft <= 0 ? 'No orders left this round'
      : kind === 'creep' ? (s.creep ? 'The barrage is already walking' : he < 3 ? `Needs 3 HE (${he} left)` : '')
        : s.sluiceUsed ? 'The sluice is open' : ''
    if (changed('special', `${kind}|${playing}|${spWhy}|${u.armed}`)) {
      special.hidden = kind === null
      if (kind) {
        special.innerHTML = kind === 'creep'
          ? `${ICON.seal}<span class="ii-lbl">Creeping barrage</span>${kbd('C')}`
          : `${ICON.seal}<span class="ii-lbl">${s.sluiceUsed ? 'Sluice open' : 'Open the sluice'}</span>${kbd('O')}`
        special.disabled = !playing || spWhy !== ''
        special.classList.toggle('is-armed', u.armed === 'creep')
        special.title = spWhy || (kind === 'creep'
          ? 'Creeping barrage (C): 3 HE and one order shell three hexes of a row, then the fire walks forward each round'
          : 'Open the sluice (O): one order floods the polder for the rest of the battle')
        special.setAttribute('aria-label', special.title)
      }
    }
    if (changed('undo', `${playing}|${s.ordersLeft}|${s.orderLimit[me]}`)) {
      undoBtn.disabled = !playing || s.ordersLeft >= s.orderLimit[me]
    }
    const rw = u.rewindsLeft
    if (changed('rewind', `${rw}|${u.busy}|${s.phase}`)) {
      const n = Number.isFinite(rw) ? String(Math.max(0, rw)) : '∞'
      rewindBtn.innerHTML = `${ICON.rewind}<span class="ii-lbl">Rewind</span>${kbd('R')}<span class="ii-count num">${n}</span>`
      rewindBtn.disabled = u.busy || rw <= 0 || (s.phase !== 'player-orders' && s.phase !== 'over')
      rewindBtn.setAttribute('aria-label', `Rewind to the start of the round (R), ${n} left`)
    }

    // The slip: the AI's top red-ink plan in the 1917 field-message voice (rules.planSlip), or
    // Brigade's orders when no red ink is on the map.
    const ip = interceptParts(s)
    const plan = ip ? slipParts(planSlip(s)) ?? ip : null
    if (changed('slip', plan ? `i${plan.via}${plan.order}` : `o${s.scenario}`)) {
      slipTarget = ip ? ip.target : null
      if (plan) slipText.innerHTML = `<span class="ii-stamp">Intercepted</span><span class="ii-via">${esc(plan.via)}:</span> <q>${esc(plan.order)}</q>`
      else slipText.innerHTML = `<span class="ii-stamp is-orders">Orders</span><span class="ii-via">from Brigade:</span> <q>${esc(sc.goal)}</q>`
      slipDot.hidden = !ip
      slip.classList.remove('is-new')
      void slip.offsetWidth
      slip.classList.add('is-new')
    }

    // Round banner once the table settles into a new player turn.
    if (!u.busy && s.phase === 'player-orders' && s.round !== bannerRound) {
      if (bannerRound !== -1 && s.round > bannerRound) {
        // the day's line, then the round: kept short so it holds one line under the despatch
        const day = CHRONICLE[s.scenario][s.round - 1]
        showBanner(day ? `${day} Round ${s.round} of ${s.maxRounds}.` : `Round ${s.round} of ${s.maxRounds}: your orders.`)
      }
      bannerRound = s.round
    }

    // The forecast/hover tag, docked in the margin when the keyboard drives the cursor.
    const modal = menu.isOpen() || ledger.isOpen() || !confirmEl.hidden
    if (modal) tag.hide()
    else {
      const narrow = innerWidth <= 760
      const r = rail.getBoundingClientRect()
      // Wide screens read the tag in the top-right margin under the candle rail, where it covers no
      // hex: three outside reviews found it pinned beside the hover "on top of the very hexes being
      // chosen", and docked above the slip it covered the board's corner once the board grew.
      const dock = innerWidth > 960 ? { x: r.left, y: r.bottom + 8, w: r.width, up: false }
        : !kbdHover ? null : narrow
          ? { x: 8, y: bar.getBoundingClientRect().top - 8, w: innerWidth - 16, up: true }
          : { x: r.left, y: r.bottom + 8, w: r.width, up: false }
      tag.update(s, u, hover, kbdHover ? null : pointer, dock)
    }
    menu.refresh()
  }

  const visible = (n: HTMLElement): boolean => {
    if (n.hidden || n.closest('[hidden]')) return false
    const cs = getComputedStyle(n)
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01
  }

  return {
    render,
    banner: showBanner,
    ledger(s, campaign) {
      confirm(false)
      menu.close()
      showBanner('') // the last in-play hint read through the report's dimmer (blind A/B)
      ledger.show(s, U?.rewindsLeft ?? 0, campaign)
    },
    briefing(b) {
      confirm(false)
      menu.close()
      ledger.brief(b)
    },
    hideLedger() { ledger.hide() },
    result(ev, at) {
      const s = S
      if (!s) return
      // ink numerals that rise off the board and fade: red for your losses, gilt for theirs
      const pop = (x: number, y: number, text: string, bad: boolean): void => {
        const p = el('div', `ii-pop ${bad ? 'is-bad' : 'is-good'}`, layer, text)
        p.style.left = `${Math.round(x)}px`
        p.style.top = `${Math.round(y)}px`
        p.addEventListener('animationend', () => p.remove())
        window.setTimeout(() => p.remove(), 3000) // reduced motion has no animationend to wait for
      }
      if (ev.e === 'figures' && at) pop(at.x, at.y - 46, `−${ev.lost}`, at.side === s.human)
      else if (ev.e === 'destroyed' && at) pop(at.x, at.y - 46, 'Wiped out', at.side === s.human)
      else if (ev.e === 'captured' && at) pop(at.x, at.y - 52, ev.by === s.human ? 'Taken!' : 'Lost!', ev.by !== s.human)
      else if (ev.e === 'morale' && ev.delta !== 0) {
        // the count itself flares in the rail: a chit floating beside it, caught mid-fade, read as
        // a stray numeral behind the HUD (blind A/B, three times)
        const row = ev.side === s.human ? rowYou : rowFoe, cls = ev.delta < 0 ? 'is-down' : 'is-up'
        row.classList.remove('is-down', 'is-up')
        void row.offsetWidth // restart the flare on a second change in a row
        row.classList.add(cls)
        window.setTimeout(() => row.classList.remove(cls), 1700)
      }
    },
    tutorial(step) {
      clearTimeout(titleT)
      tut.step(step)
    },
    // Every visible HUD box. The forecast tag is left out while it is pinned beside a hex: it is a
    // label on the board by design (it never covers its target); docked in the margin it counts.
    rects() {
      const boxes: HTMLElement[] = [despatch, tut.note, rail, banner, undoBtn, bell, rewindBtn, slip, slipBtn, confirmEl, tut.title]
      if (tag.el.classList.contains('is-docked')) boxes.push(tag.el)
      if (menu.isOpen()) boxes.push(menu.el.firstElementChild as HTMLElement)
      if (ledger.isOpen()) boxes.push(ledger.el.firstElementChild as HTMLElement)
      return boxes.filter(visible).map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
    },
  }
}
