// The keyboard map (DESIGN §9 Keys). It speaks the same bus as the pointer (Picking), so the Game
// has one input grammar: Tab cycles pieces with orders, the arrows drive a hex cursor (ui:hover),
// Enter clicks the cursor's hex (ui:click), and the rest are ui:cmd. S1 round 1 is playable with
// the keyboard alone: Tab, arrows, Enter, Space.
import type { Bus, UiCmd } from '../contract/bus.ts'
import type { HudUi } from '../contract/render-api.ts'
import type { GameState, HexId } from '../contract/types.ts'
import { COLS, ROWS } from '../contract/types.ts'

// Flat-top, odd-q offset, HexId = row*13 + col. In odd-q, (col±1, same row) is always a true
// neighbour (NE/SE from an even column, NE/SE the other way from an odd one), so Left/Right walk
// a zig-zag row and Up/Down walk a column: every arrow step lands on an adjacent hex.
export function stepHex(h: HexId, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): HexId {
  const c = h % COLS, r = Math.floor(h / COLS)
  const [dc, dr] = key === 'ArrowUp' ? [0, -1] : key === 'ArrowDown' ? [0, 1] : key === 'ArrowLeft' ? [-1, 0] : [1, 0]
  const nc = c + dc, nr = r + dr
  return nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS ? h : nr * COLS + nc
}
// Odd-q adjacency, for the self-check below.
export function adjacent(a: HexId, b: HexId): boolean {
  const ca = a % COLS, ra = Math.floor(a / COLS), cb = b % COLS, rb = Math.floor(b / COLS)
  const toCube = (c: number, r: number): [number, number, number] => { const z = r - (c - (c & 1)) / 2; return [c, z, -c - z] }
  const [x1, y1, z1] = toCube(ca, ra), [x2, y2, z2] = toCube(cb, rb)
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2)) === 1
}

export interface KeyHost {
  state(): GameState | null
  ui(): HudUi | null
  modal(): 'menu' | 'ledger' | 'confirm' | 'title' | null
  bell(): void // the Hud's guarded bell (G9)
  confirm(yes: boolean): void
  menu(): void // toggle the pocket book
  closeMenu(): void
  flash(cmd: UiCmd | 'bell'): void // pressed-state feedback on the matching HUD control
  keyboardHover(on: boolean): void
}

const CMD: Record<string, UiCmd> = {
  q: 'pivot-l', e: 'pivot-r', z: 'undo', r: 'rewind', v: 'staff', m: 'mute', b: 'barrage',
  c: 'creep', g: 'gas', o: 'sluice',
  a: 'yaw-l', d: 'yaw-r', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', _: 'zoom-out',
  backspace: 'deselect', delete: 'deselect',
}
// One press, one order: holding these down must not fire them again.
const NO_REPEAT = new Set<UiCmd>(['undo', 'rewind', 'mute', 'staff', 'barrage', 'creep', 'gas', 'sluice'])

export function installKeys(bus: Bus, host: KeyHost): () => void {
  let cursor: HexId | null = null
  let lastSel: string | null = null

  const cmd = (c: UiCmd, arg?: string): void => {
    host.flash(c)
    bus.emit('ui:cmd', arg === undefined ? { cmd: c } : { cmd: c, arg })
  }

  function startHex(s: GameState, ui: HudUi | null): HexId {
    const sel = ui?.selected ? s.units.find((u) => u.id === ui.selected) : undefined
    if (sel) return sel.hex
    const mine = s.units.find((u) => u.side === s.human && u.str > 0 && !u.ordered)
    return mine ? mine.hex : 4 * COLS + 6
  }

  function onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.isComposing) return
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
    const modal = host.modal()
    const s = host.state(), ui = host.ui()

    if (key === 'escape') {
      e.preventDefault()
      if (modal === 'confirm') host.confirm(false)
      else if (modal === 'menu') host.closeMenu()
      else host.menu()
      return
    }
    if (modal === 'menu') return // native Tab/Enter/Space inside the book
    if (modal === 'ledger') {
      const onButton = document.activeElement instanceof HTMLButtonElement
      if (key === 'enter' && !onButton) { e.preventDefault(); cmd('retry') }
      else if (key === 'r' && !e.repeat) { e.preventDefault(); cmd('rewind') }
      return
    }
    if (modal === 'title') {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      cmd('skip-intro')
      return
    }
    if (modal === 'confirm') {
      if (key === ' ' || key === 'enter') { e.preventDefault(); if (!e.repeat) host.confirm(true) }
      return
    }
    if (e.altKey) return
    if ((e.metaKey || e.ctrlKey) && key !== 'z') return

    // A new selection (Tab, a click) moves the cursor onto that piece.
    if (s && ui && ui.selected !== lastSel) {
      lastSel = ui.selected
      const u = ui.selected ? s.units.find((x) => x.id === ui.selected) : undefined
      if (u) cursor = u.hex
    }

    switch (key) {
      case 'tab':
        e.preventDefault()
        cmd('next-piece')
        return
      case 'arrowup': case 'arrowdown': case 'arrowleft': case 'arrowright': {
        e.preventDefault()
        if (!s) return
        const k = e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
        cursor = cursor === null ? startHex(s, ui) : stepHex(cursor, k)
        host.keyboardHover(true)
        bus.emit('ui:hover', { hex: cursor })
        return
      }
      case 'enter':
        e.preventDefault()
        if (e.repeat) return
        if (cursor === null && s) cursor = startHex(s, ui)
        host.keyboardHover(true)
        bus.emit('ui:click', { hex: cursor, button: 0 })
        return
      case ' ':
        e.preventDefault()
        if (e.repeat) return
        // While the enemy moves, Space hurries it along; it is never kept as a bell for the NEXT
        // turn (an outside review's impatient Space rang round 2 away unseen).
        if (s && s.phase !== 'player-orders') cmd('skip')
        else host.bell()
        return
    }
    const c = CMD[key]
    if (!c) return
    e.preventDefault()
    if (e.repeat && NO_REPEAT.has(c)) return
    cmd(c)
  }

  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
