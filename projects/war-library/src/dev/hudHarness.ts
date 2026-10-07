// Worker-D's isolation page. `?hud&state=player-turn|forecast|hover|ledger|victory|menu|tutorial|
// confirm|enemy|title|keys|audio` renders the real HUD over a stand-in table: the board's hexes are
// projected with the commander camera of systems/CameraRig (pitch 45°, 1.55 m, vFOV 36°) — or, in
// portrait, turned 90° at 62° pitch (DESIGN §9, G11) — so overlap is both visible and measured.
// window.__hud reports: HUD area share, board overlap, truncation, smallest font, control states,
// the ledger totals check, the keyboard bus trace and (state=audio) every cue rendered offline.
import * as THREE from 'three'
import { createBus } from '../contract/bus.ts'
import type { BusMap } from '../contract/bus.ts'
import { HEX_FLAT, TABLE_TOP_Y } from '../contract/render-api.ts'
import type { HudUi } from '../contract/render-api.ts'
import { COLS, ROWS } from '../contract/types.ts'
import type { GameState, HexId, Terrain } from '../contract/types.ts'
import { FIXTURES, forecast, legal, newGame } from '../rules/index.ts'
import { createHud } from '../ui/Hud.ts'
import { ledgerTotals } from '../ui/Ledger.ts'
import { adjacent, stepHex } from '../ui/Keys.ts'
import { renderVoice, VOICE_NAMES } from '../audio/AudioSystem.ts'
import { cueFor } from '../audio/cues.ts'

type P = { x: number; y: number }
const R = HEX_FLAT / Math.sqrt(3)
const DX = 1.5 * R
const W_ = DX * (COLS - 1)
const H_ = HEX_FLAT * (ROWS - 1) + HEX_FLAT / 2
const local = (h: HexId): THREE.Vector3 => {
  const c = h % COLS, r = Math.floor(h / COLS)
  return new THREE.Vector3(c * DX - W_ / 2, TABLE_TOP_Y, r * HEX_FLAT + (c & 1 ? HEX_FLAT / 2 : 0) - H_ / 2)
}

const TINT: Record<Terrain, string> = {
  sea: '#3f5560', dune: '#d9c9a0', open: '#b7a47a', polder: '#6f7a55', trench: '#8a6b45', crater: '#6d5a44',
  ruin: '#8c8275', church: '#9a9082', chateau: '#9a9082', blockhouse: '#7d7d78', bridge: '#a08560', sluice: '#7f8a8c', river: '#4d6f73',
}

function camera(w: number, h: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(36, w / h, 0.05, 60)
  const portrait = h > w
  const pitch = THREE.MathUtils.degToRad(portrait ? 62 : 45)
  const yaw = portrait ? -Math.PI / 2 : 0
  const place = (dist: number): void => {
    const t = new THREE.Vector3(0, TABLE_TOP_Y, portrait ? 0 : 0.02)
    const hz = dist * Math.cos(pitch)
    cam.position.set(t.x + Math.sin(yaw) * hz, t.y + dist * Math.sin(pitch), t.z + Math.cos(yaw) * hz)
    cam.lookAt(t)
    cam.updateMatrixWorld()
  }
  if (!portrait) { place(1.55); return cam }
  // Portrait: the closest seat at which the board's 0.95 m short side still fits the width.
  for (let d = 0.9; d < 4; d += 0.02) {
    place(d)
    const a = local(4 * COLS + 0).project(cam), b = local(4 * COLS + 12).project(cam)
    const c = local(0 * COLS + 6).project(cam), e = local(8 * COLS + 6).project(cam)
    const xs = [a.x, b.x, c.x, e.x].map((x) => (x + 1) / 2 * w)
    if (Math.max(...xs) < w - 26 && Math.min(...xs) > 26) break
  }
  return cam
}

function project(cam: THREE.Camera, v: THREE.Vector3, w: number, h: number): P {
  const p = v.clone().project(cam)
  return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h }
}

function hexPolys(cam: THREE.Camera, w: number, h: number): P[][] {
  const polys: P[][] = []
  for (let hx = 0; hx < COLS * ROWS; hx++) {
    const c = local(hx)
    const pts: P[] = []
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k
      pts.push(project(cam, new THREE.Vector3(c.x + R * Math.cos(a), c.y, c.z + R * Math.sin(a)), w, h))
    }
    polys.push(pts)
  }
  return polys
}

const inside = (poly: P[], x: number, y: number): boolean => {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const cr = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
    if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false }
  }
  return true
}

function paint(ctx: CanvasRenderingContext2D, s: GameState, cam: THREE.Camera, polys: P[][], w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h * 0.55, 40, w / 2, h * 0.55, Math.max(w, h) * 0.75)
  g.addColorStop(0, '#3a2616'); g.addColorStop(1, '#0c0805')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // the oak table, 2.4 x 1.6 m, and a brass rim around the map
  const T = (x: number, z: number): P => project(cam, new THREE.Vector3(x, TABLE_TOP_Y - 0.001, z), w, h)
  const quad = (pts: P[], fill: string, stroke?: string): void => {
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath()
    ctx.fillStyle = fill; ctx.fill()
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke() }
  }
  quad([T(-1.2, -0.8), T(1.2, -0.8), T(1.2, 0.8), T(-1.2, 0.8)], '#5a3a22')
  quad([T(-0.63, -0.53), T(0.63, -0.53), T(0.63, 0.53), T(-0.63, 0.53)], '#2a190e', '#b08d57')
  polys.forEach((poly, hx) => {
    ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath()
    ctx.fillStyle = TINT[s.terrain[hx]]; ctx.fill()
    ctx.strokeStyle = 'rgba(29,26,43,.55)'; ctx.lineWidth = 1; ctx.stroke()
    if (s.wire[hx]) { ctx.strokeStyle = 'rgba(40,30,20,.8)'; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]) }
  })
  for (const i of s.intents) {
    const poly = polys[i.target]
    ctx.save(); ctx.beginPath(); poly.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.clip()
    ctx.strokeStyle = 'rgba(168,53,44,.85)'; ctx.lineWidth = 2
    for (let k = -80; k < 80; k += 7) { ctx.beginPath(); ctx.moveTo(poly[0].x + k, poly[0].y - 60); ctx.lineTo(poly[0].x + k + 60, poly[0].y + 60); ctx.stroke() }
    ctx.restore()
  }
  for (const u of s.units) {
    const c = project(cam, local(u.hex), w, h)
    const top = project(cam, local(u.hex).add(new THREE.Vector3(0, 0.05, 0)), w, h)
    const rad = Math.max(6, Math.abs(polys[u.hex][0].x - polys[u.hex][3].x) * 0.32)
    ctx.fillStyle = u.side === 'BR' ? '#8a7e58' : '#2e3a52'
    ctx.fillRect(c.x - rad * 0.5, top.y, rad, c.y - top.y)
    ctx.beginPath(); ctx.ellipse(c.x, c.y, rad, rad * 0.55, 0, 0, Math.PI * 2)
    ctx.fillStyle = u.side === 'BR' ? '#c9a45a' : '#5b5f66'; ctx.fill()
  }
}

// ---- checks ---------------------------------------------------------------------------------
function textChecks(layer: HTMLElement): { truncated: string[]; minFont: number; minFontAt: string } {
  const truncated: string[] = []
  let minFont = 99, minFontAt = ''
  const W = innerWidth, H = innerHeight
  const boxOf = (n: Element): DOMRect | null => {
    const b = n.closest('.ii-paper, .ii-rail, .ii-btn, .ii-bell, .ii-tag, .ii-title, .ii-opt')
    return b && b !== n ? b.getBoundingClientRect() : null
  }
  const name = (n: Element): string => `${n.tagName.toLowerCase()}.${[...n.classList].join('.')}:"${(n.textContent ?? '').trim().slice(0, 40)}"`
  for (const n of layer.querySelectorAll<HTMLElement>('*')) {
    if (n.closest('[hidden]') || n.closest('svg')) continue
    const cs = getComputedStyle(n)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const own = [...n.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? '').trim())
    const r = n.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (own) {
      const f = parseFloat(cs.fontSize)
      if (f < minFont) { minFont = f; minFontAt = name(n) }
      if (cs.textOverflow === 'ellipsis') truncated.push('ellipsis ' + name(n))
      if (r.right > W + 0.5 || r.left < -0.5 || r.bottom > H + 0.5 || r.top < -0.5) {
        if (!n.closest('.ii-page')) truncated.push('off-screen ' + name(n))
      }
      const b = boxOf(n)
      if (b && (r.right > b.right + 1 || r.left < b.left - 1) && !n.closest('.ii-page')) truncated.push('spills its card ' + name(n))
    }
    const clip = cs.overflowX !== 'visible' || cs.overflowY !== 'visible'
    if (clip && !n.classList.contains('ii-page') && (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1)) truncated.push('clipped ' + name(n))
  }
  return { truncated, minFont, minFontAt }
}

// Every control class must style all four states.
function controlStates(layer: HTMLElement): Record<string, string[]> {
  const sel: string[] = []
  for (const sh of document.styleSheets) {
    try { for (const r of sh.cssRules) if (r instanceof CSSStyleRule) sel.push(r.selectorText) } catch { /* cross-origin */ }
  }
  const all = sel.join(' , ')
  const out: Record<string, string[]> = {}
  for (const b of layer.querySelectorAll('button')) {
    const cls = ['ii-btn', 'ii-bell', 'ii-link', 'ii-opt'].find((c) => b.classList.contains(c)) ?? '(unstyled)'
    if (out[cls]) continue
    out[cls] = [':hover', ':active', ':focus-visible', ':disabled'].filter((st) => !all.includes(`.${cls}${st}`) && !all.includes(`.${cls}:not`) )
  }
  return out
}

// ---- fixtures ----------------------------------------------------------------------------------
function withTurn(s: GameState): GameState {
  // Mid-battle look for the player-turn capture: round 3, one order spent, candles lost both sides.
  const t = structuredClone(s)
  t.round = 3
  t.ordersLeft = Math.max(0, t.orderLimit[t.human] - 1)
  t.morale = { BR: t.moraleStart.BR - 2, DE: t.moraleStart.DE - 3 }
  t.shells[t.human].he = Math.max(1, t.shells[t.human].he - 1)
  return t
}

export async function run(canvas: HTMLCanvasElement, q: URLSearchParams): Promise<void> {
  const mode = q.get('state') ?? 'player-turn'
  const w = innerWidth, h = innerHeight
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const cam = camera(w, h)
  const polys = hexPolys(cam, w, h)
  const bus = createBus()
  const trace: string[] = []
  for (const k of ['ui:cmd', 'ui:hover', 'ui:click', 'audio'] as (keyof BusMap)[]) bus.on(k, (p) => trace.push(`${k} ${JSON.stringify(p)}`))
  const app = document.querySelector<HTMLElement>('#app') ?? document.body
  const hud = createHud(app, bus)
  Object.assign(window, { __hudApi: hud, __hudBus: bus }) // for probing banners etc. from the capture script
  const screen = (hx: HexId): P => project(cam, local(hx), w, h)

  const pick = (): GameState => {
    if (mode === 'ledger' || mode === 'defeat') return FIXTURES.defeat()
    if (mode === 'victory') return FIXTURES.victory()
    if (mode === 'enemy') return FIXTURES['enemy-turn']()
    if (mode === 'confirm' || mode === 'tutorial' || mode === 'title' || mode === 'keys') return FIXTURES['player-turn']()
    return withTurn(FIXTURES['player-turn']())
  }
  let s = pick()
  const ui: HudUi = { selected: null, forecast: null, anchor: null, busy: false, rewindsLeft: Infinity, speed: 1, muted: false }
  if (mode === 'enemy') ui.busy = true
  const report: Record<string, unknown> = { state: mode, W: w, H: h }

  bus.emit('state', { state: s, events: [] })
  if (mode !== 'title') bus.emit('state', { state: s, events: [] }) // the table is awake

  const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
  const key = async (k: string): Promise<void> => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
    hud.render(s, ui)
    await frame()
  }

  // A stand-in Game for the keyboard state: just enough of Game.ts's grammar to answer the bus.
  if (mode === 'keys') {
    bus.on('ui:cmd', ({ cmd }) => {
      if (cmd === 'next-piece') {
        const mine = s.units.filter((u) => u.side === s.human && !u.ordered)
        const i = mine.findIndex((u) => u.id === ui.selected)
        ui.selected = mine[(i + 1) % mine.length]?.id ?? null
      }
    })
    bus.on('ui:hover', ({ hex }) => {
      const a = ui.selected && hex !== null ? legal(s).find((x) => x.t === 'move' && x.unit === ui.selected && x.to === hex) : undefined
      ui.forecast = a ? forecast(s, a) : null
      ui.anchor = a && hex !== null ? screen(hex) : null
    })
  }

  const turnLike = mode === 'forecast' || mode === 'hover'
  if (turnLike) {
    const me = s.units.find((u) => u.side === s.human && u.kind === 'rifle')!
    ui.selected = mode === 'forecast' ? me.id : null
    if (mode === 'forecast') {
      const a = legal(s).find((x) => x.t === 'assault' && x.unit === me.id) ?? legal(s).find((x) => x.t === 'move' && x.unit === me.id)!
      const target = 'target' in a ? a.target : 'to' in a ? a.to : me.hex
      ui.forecast = forecast(s, a)
      ui.anchor = screen(target)
      bus.emit('ui:hover', { hex: target })
      report.forecastFor = a
    } else {
      const foe = s.units.find((u) => u.side !== s.human && u.kind === 'mg')!
      const p = screen(foe.hex)
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: p.x, clientY: p.y, bubbles: true }))
      bus.emit('ui:hover', { hex: foe.hex })
    }
  }

  paint(ctx, s, cam, polys, w, h)
  hud.render(s, ui)
  await frame()

  switch (mode) {
    case 'tutorial': hud.tutorial(0); break
    case 'ledger': case 'victory': case 'defeat': hud.ledger(s); report.ledger = { ...ledgerTotals(s), rows: s.ledger.length }; break
    case 'menu': await key('Escape'); break
    case 'confirm': hud.tutorial(2); await key(' '); break
    case 'enemy': hud.banner('The enemy moves: watch the red ink.'); break
    case 'keys': {
      // S1 round 1 by keyboard: lift A Coy (Tab), cursor west onto D7 (Left), order it (Enter),
      // then ring the bell (Space) — which asks "Ring anyway?" only if a movable piece is on red.
      await key('Tab'); hud.render(s, ui); await frame()
      await key('ArrowLeft'); hud.render(s, ui); await frame()
      await key('Enter')
      await key(' ')
      await key('Escape')
      report.keys = trace.filter((t) => !t.startsWith('audio'))
      // Arrow steps always land on a true odd-q neighbour.
      let bad = 0
      for (let hx = 0; hx < COLS * ROWS; hx++) for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const) {
        const n = stepHex(hx, k)
        if (n !== hx && !adjacent(hx, n)) bad++
      }
      report.arrowNonNeighbours = bad
      break
    }
    case 'audio': {
      const out: Record<string, { rms: number; peak: number }> = {}
      for (const n of VOICE_NAMES) {
        const r = await renderVoice(n)
        out[n] = { rms: +r.rms.toFixed(4), peak: +r.peak.toFixed(3) }
      }
      report.audio = out
      report.silent = Object.entries(out).filter(([, v]) => v.peak < 0.01).map(([k]) => k)
      report.clipped = Object.entries(out).filter(([, v]) => v.peak > 1).map(([k]) => k)
      // cueFor over a sample of every event shape: never throws, maps to a cue or null
      report.cueSample = cueFor({ e: 'moved', unit: 'x', path: [1, 2] })
      break
    }
  }
  for (let i = 0; i < 3; i++) { hud.render(s, ui); await frame() }
  await new Promise((r) => setTimeout(r, 450)) // transitions settle
  hud.render(s, ui)

  // ---- measure ----------------------------------------------------------------------------
  const rects = hud.rects()
  const area = rects.reduce((a, r) => a + r.width * r.height, 0)
  let overlap = 0
  const hits: string[] = []
  for (const r of rects) {
    let n = 0
    for (let y = r.top + 2; y < r.bottom; y += 4) for (let x = r.left + 2; x < r.right; x += 4) {
      if (polys.some((p) => inside(p, x, y))) n++
    }
    if (n > 0) hits.push(`${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}: ${n * 16}px²`)
    overlap += n * 16
  }
  const bb = polys.flat()
  const layer = app.querySelector<HTMLElement>('.ii')!
  Object.assign(report, {
    hudAreaPct: +(100 * area / (w * h)).toFixed(2),
    rects: rects.map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]),
    boardOverlapPx: overlap, overlapHits: hits,
    board: [Math.min(...bb.map((p) => p.x)), Math.min(...bb.map((p) => p.y)), Math.max(...bb.map((p) => p.x)), Math.max(...bb.map((p) => p.y))].map(Math.round),
    hexPx: Math.round(Math.hypot(screen(4 * COLS + 6).x - screen(4 * COLS + 7).x, screen(4 * COLS + 6).y - screen(4 * COLS + 7).y)),
    ...textChecks(layer),
    controlsMissingStates: controlStates(layer),
    newGameOk: newGame('s1', 1, 'recruit').objectives.length === 3,
  })
  ;(window as unknown as { __hud: unknown }).__hud = report
  ;(window as unknown as { __ready: boolean }).__ready = true
}
