// Board isolation page (Worker-B): `?asset=<id>&view=<v>` renders the real BoardView (or one
// miniature on it) under a neutral-warm rig of its own, at true scale, then sets window.__ready.
//   asset  board | tokens | lineup | rifle-br | rifle-de | stoss | mg | mg-de | fieldgun | fieldgun-br | tank
//   view   game (the commander's chair) | 34 | side | top | close | gallery
//   s=s1|s2|s3  scenario    fixture=<rules fixture>  ov=1 demo overlays   gray=1 grayscale
//   t=<s> fixed clock (default 2)   anim=1 live clock   check=all run the acceptance checks
// window.__B holds the check results; window.__THREE_INFO__ the renderer counts.
import * as THREE from 'three'
import { createRenderer } from '../core/Renderer.ts'
import { createBus } from '../contract/bus.ts'
import type { GameEvent } from '../contract/events.ts'
import { TABLE_TOP_Y } from '../contract/render-api.ts'
import type { BoardView, Overlay } from '../contract/render-api.ts'
import type { Action, GameState, HexId, ScenarioId, Side, Unit, UnitKind } from '../contract/types.ts'
import { createBoardView } from '../board/BoardView.ts'
import { asciiState } from '../board/asciiMap.ts'
import { N_HEX, parseHex } from '../board/HexLayout.ts'
import { zoneContrast } from '../board/zones.ts'
import { applyEnvironment, mat } from '../render/MaterialLibrary.ts'
import { apply, fan, FIXTURES, legal, newGame, reach } from '../rules/index.ts'
import type { FixtureName } from '../rules/index.ts'
import { planTurn, PROFILES } from '../ai/index.ts'

type W = Window & { __ready?: boolean; __B?: Record<string, unknown>; __THREE_INFO__?: unknown; __board?: BoardView }
const win = window as W

interface Pose { yaw: number; pitch: number; dist: number; fov: number; target: THREE.Vector3 }
const deg = THREE.MathUtils.degToRad

function place(cam: THREE.PerspectiveCamera, p: Pose): void {
  const { yaw, pitch, dist, target } = p
  cam.fov = p.fov
  cam.position.set(
    target.x + Math.sin(deg(yaw)) * Math.cos(deg(pitch)) * dist,
    target.y + Math.sin(deg(pitch)) * dist,
    target.z + Math.cos(deg(yaw)) * Math.cos(deg(pitch)) * dist,
  )
  cam.lookAt(target)
  cam.updateProjectionMatrix()
}

const PIECES: Record<string, [Side, UnitKind][]> = {
  'rifle-br': [['BR', 'rifle']], 'rifle-de': [['DE', 'rifle']], stoss: [['DE', 'stoss']], mg: [['BR', 'mg']],
  'mg-de': [['DE', 'mg']], fieldgun: [['DE', 'fieldgun']], 'fieldgun-br': [['BR', 'fieldgun']], tank: [['BR', 'tank']],
  lineup: [['BR', 'rifle'], ['DE', 'rifle'], ['DE', 'stoss'], ['BR', 'mg'], ['DE', 'mg'], ['DE', 'fieldgun'], ['BR', 'tank'], ['BR', 'fieldgun']],
}
const STR: Record<UnitKind, number> = { rifle: 4, mg: 3, fieldgun: 2, tank: 4, stoss: 3 }

function baseState(q: URLSearchParams): GameState {
  const fx = q.get('fixture') as FixtureName | null
  if (fx) {
    const make = FIXTURES[fx]
    if (!make) throw new Error(`unknown fixture ${fx}`)
    return make()
  }
  const id = (q.get('s') ?? 's1') as ScenarioId
  try { return newGame(id, 42, 'recruit') } catch (e) {
    console.warn('[boardHarness] rules newGame failed, using the local ASCII map', e)
    return asciiState(id)
  }
}

// A single miniature (or the lineup) on open ground in row 5 of the scenario's map.
function pieceState(asset: string, s: GameState): GameState {
  const list = PIECES[asset]
  const row = 4, c0 = list.length === 1 ? 6 : 2
  s.units = list.map(([side, kind], i): Unit => {
    const hex = row * 13 + c0 + i
    s.terrain[hex] = 'open'
    s.wire[hex] = false
    return { id: `${side}-${kind}-${i}`, side, kind, name: kind, hex, str: STR[kind], facing: side === 'BR' ? 0 : 3,
      suppressedUntil: 0, dugIn: false, bogged: false, ordered: false, acted: false }
  })
  s.intents = []
  return s
}

export async function run(canvas: HTMLCanvasElement, q: URLSearchParams): Promise<void> {
  const asset = q.get('asset') ?? 'board'
  const viewName = q.get('view') ?? 'game'
  const renderer = createRenderer(canvas)
  renderer.setPixelRatio(1)
  renderer.setSize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight, false)
  if (q.get('gray') === '1') canvas.style.filter = 'grayscale(1)'
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#15100c')
  applyEnvironment(scene, renderer, 0.35)
  const camera = new THREE.PerspectiveCamera(36, (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight), 0.01, 40)

  // neutral-warm judging rig: a warm key spot from the south-east, a cool rim from the north
  // (the lancets), a low hemisphere fill. Not the game's rig (Worker-C owns that).
  const key = new THREE.SpotLight('#ffd9a0', Number(q.get('key') ?? 34), 0, deg(34), 0.55, 2)
  key.position.set(1.1, TABLE_TOP_Y + 2.9, 1.7)
  key.target.position.set(0, TABLE_TOP_Y, 0)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.00015
  key.shadow.normalBias = 0.004
  key.shadow.camera.near = 1.5; key.shadow.camera.far = 6
  const rim = new THREE.DirectionalLight('#8fa6c8', 0.55)
  rim.position.set(-1.5, TABLE_TOP_Y + 3, -3.2)
  const hemi = new THREE.HemisphereLight('#e9dcc4', '#2a1d14', 0.2)
  scene.add(key, key.target, rim, hemi)

  // the oak table under the board
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.055, 1.6).translate(0, TABLE_TOP_Y - 0.0275, 0), mat('oak'))
  table.receiveShadow = true
  scene.add(table)
  const tableTop = new THREE.Group()
  tableTop.position.set(0, TABLE_TOP_Y, 0)
  scene.add(tableTop)

  const bus = createBus()
  const board = createBoardView(bus)
  board.mount(tableTop)
  win.__board = board
  let state = baseState(q)
  if (PIECES[asset]) state = pieceState(asset, state)
  board.load(state)
  board.sync(state)
  if (q.get('ov') === '1') board.overlay(demoOverlay(state))

  // camera
  const pieceAt = state.units[0] ? board.hexToLocal(state.units[0].hex).add(tableTop.position) : new THREE.Vector3(0, TABLE_TOP_Y, 0)
  const T = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, TABLE_TOP_Y + y, z)
  const boardViews: Record<string, Pose> = {
    game: { yaw: 0, pitch: 45, dist: 1.55, fov: 36, target: T(0, 0, 0.02) },
    close: { yaw: 0, pitch: 52, dist: 0.95, fov: 36, target: T(0, 0, 0.05) },
    gallery: { yaw: 0, pitch: 34, dist: 4.1, fov: 40, target: T(0, 0.35, 0) },
    34: { yaw: 32, pitch: 30, dist: 0.62, fov: 36, target: T(-0.12, 0, 0.1) },
    side: { yaw: 0, pitch: 9, dist: 1.0, fov: 36, target: T(0, 0, 0.1) },
    top: { yaw: 0, pitch: 89.9, dist: 2.1, fov: 36, target: T(0, 0, 0) },
  }
  const pieceViews: Record<string, Pose> = {
    game: { yaw: 0, pitch: 45, dist: 1.55, fov: 36, target: pieceAt.clone() },
    34: { yaw: 35, pitch: 24, dist: 0.26, fov: 36, target: pieceAt.clone().add(new THREE.Vector3(0, 0.026, 0)) },
    side: { yaw: 90, pitch: 4, dist: 0.24, fov: 36, target: pieceAt.clone().add(new THREE.Vector3(0, 0.026, 0)) },
    top: { yaw: 0, pitch: 89.9, dist: 0.3, fov: 36, target: pieceAt.clone() },
    close: { yaw: 0, pitch: 52, dist: 0.95, fov: 36, target: pieceAt.clone() },
  }
  const lineupViews: Record<string, Pose> = {
    game: { yaw: 0, pitch: 45, dist: 1.55, fov: 36, target: T(0.02, 0, 0.0) },
    34: { yaw: 18, pitch: 26, dist: 0.62, fov: 36, target: T(0.03, 0.02, 0.0) },
    side: { yaw: 0, pitch: 5, dist: 0.7, fov: 36, target: T(0.03, 0.02, 0.0) },
    top: { yaw: 0, pitch: 89.9, dist: 0.9, fov: 36, target: T(0.03, 0, 0.0) },
  }
  const tokenViews: Record<string, Pose> = {
    game: boardViews.game,
    34: { yaw: -30, pitch: 34, dist: 0.8, fov: 36, target: T(0.8, 0.02, -0.18) }, // east margin
    side: { yaw: 32, pitch: 34, dist: 0.8, fov: 36, target: T(-0.78, 0.02, -0.18) }, // west margin
    top: { yaw: 0, pitch: 38, dist: 0.85, fov: 36, target: T(0, 0.02, -0.62) }, // north strip
  }
  const views = asset === 'lineup' ? lineupViews : PIECES[asset] ? pieceViews : asset === 'tokens' ? tokenViews : boardViews
  const pose = views[viewName]
  if (!pose) throw new Error(`boardHarness: unknown view ${viewName} for ${asset}`)
  place(camera, pose)

  // loop: tweens run on real dt; the ambient clock is fixed unless anim=1 (reproducible shots)
  const tFixed = Number(q.get('t') ?? 2)
  const live = q.get('anim') === '1'
  let last = performance.now(), clock = tFixed
  const frame = (): void => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (live) clock += dt
    board.update(dt, clock)
    renderer.render(scene, camera)
  }
  renderer.setAnimationLoop(frame)
  await frames(6)

  const info = (): Record<string, number> => {
    renderer.info.autoReset = false
    renderer.info.reset()
    renderer.render(scene, camera)
    const r = renderer.info
    const out = { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures }
    renderer.info.autoReset = true
    return out
  }
  win.__THREE_INFO__ = info()
  const B: Record<string, unknown> = {}
  win.__B = B
  B.lstar = (['s1', 's2', 's3'] as ScenarioId[]).map((id) => {
    const t = asciiState(id).terrain
    return { id, min: zoneContrast(t).min, flooded: id === 's3' ? zoneContrast(t, true).min : undefined, pairs: zoneContrast(t).pairs }
  })
  console.info('[board] L* neighbouring-zone gaps: ' + JSON.stringify((B.lstar as { id: string; min: number; flooded?: number }[]).map(({ id, min, flooded }) => ({ id, min, flooded }))))

  const check = q.get('check')
  if (check) {
    const want = (k: string): boolean => check === 'all' || check.split(',').includes(k)
    if (want('roundtrip')) B.roundtrip = roundTrip(board, camera, tableTop, state)
    if (want('boxes')) B.boxes = boxes(board, camera, state)
    if (want('budget')) B.budget = budget(tableTop, scene, renderer, camera)
    if (want('events')) B.events = await eventDurations(board, state)
    if (want('sync')) B.sync = await syncVsPlay(board, renderer, scene, camera, q)
    board.load(state); board.sync(state)
    console.info('[board] checks ' + JSON.stringify(B, (k, v) => (k === 'pairs' ? undefined : v)))
  }
  await frames(4)
  win.__ready = true
}

function frames(n: number): Promise<void> {
  return new Promise((res) => { let k = 0; const f = (): void => { if (++k >= n) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------------------------
function demoOverlay(s: GameState): Overlay {
  const own = s.units.find((u) => u.side === s.human && u.kind === 'rifle')
  const o: Overlay = { reach: [], path: [], fans: [], intents: s.intents, danger: [], targets: [], selected: own?.id ?? null, hover: null, cursor: null }
  for (const u of s.units) if (u.kind === 'mg' && u.str > 0) o.fans.push({ hexes: fan(s, u.id), side: u.side })
  if (own) {
    const r = reach(s, own.id)
    o.reach = [...r.keys()]
    const far = [...r.entries()].sort((a, b) => b[1].path.length - a[1].path.length)[0]
    if (far) { o.path = far[1].path; o.hover = far[0] }
    for (const a of legal(s)) if ((a.t === 'assault' || a.t === 'fire') && a.unit === own.id) o.targets.push(a.target)
  }
  const enemyMg = s.units.find((u) => u.side !== s.human && u.kind === 'mg')
  if (enemyMg) o.danger = fan(s, enemyMg.id)
  o.cursor = parseHex('K6')
  return o
}

// hexToLocal -> screen -> hexAt must give the hex back, for every hex centre.
function roundTrip(board: BoardView, cam: THREE.Camera, top: THREE.Object3D, s: GameState): { centres: number; bad: string[]; offCentre: number; offBad: number } {
  top.updateWorldMatrix(true, true)
  const bad: string[] = []
  let offBad = 0, off = 0
  const occupied = new Set(s.units.filter((u) => u.str > 0).map((u) => u.hex))
  for (let h = 0; h < N_HEX; h++) {
    const p = board.hexToLocal(h).applyMatrix4(top.matrixWorld).project(cam)
    const got = board.hexAt(new THREE.Vector2(p.x, p.y), cam)
    if (got !== h) bad.push(`${h}->${got}`)
    if (occupied.has(h)) continue
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3
      const lp = board.hexToLocal(h).add(new THREE.Vector3(Math.sin(a) * 0.03, 0, -Math.cos(a) * 0.03)).applyMatrix4(top.matrixWorld).project(cam)
      off++
      const g2 = board.hexAt(new THREE.Vector2(lp.x, lp.y), cam)
      if (g2 !== h && !(g2 !== null && occupied.has(g2))) offBad++
    }
  }
  return { centres: N_HEX, bad, offCentre: off, offBad }
}

function boxes(board: BoardView, cam: THREE.Camera, s: GameState): { min: { w: number; h: number }; list: Record<string, [number, number]> } {
  const list: Record<string, [number, number]> = {}
  let w = Infinity, h = Infinity
  for (const u of s.units) {
    if (u.str <= 0) continue
    const b = board.pieceScreenBox(u.id, cam)
    list[u.id] = [Math.round(b.w), Math.round(b.h)]
    w = Math.min(w, b.w); h = Math.min(h, b.h)
  }
  return { min: { w: Math.round(w), h: Math.round(h) }, list }
}

// Draw calls / triangles per board layer (§11.5 budget: board 45, pieces 40, overlays 20, VFX 15, tokens 10).
function budget(top: THREE.Object3D, scene: THREE.Scene, r: THREE.WebGLRenderer, cam: THREE.Camera): Record<string, { calls: number; tris: number }> {
  const root = top.getObjectByName('board') as THREE.Object3D
  const layers: Record<string, THREE.Object3D | undefined> = {
    sheet: root.getObjectByName('relief')?.parent ?? undefined, kit: root.getObjectByName('terrain-kit'),
    mount: root.getObjectByName('mount'), pieces: root.getObjectByName('pieces'), overlays: root.getObjectByName('overlays'),
    vfx: root.getObjectByName('vfx'), tokens: root.getObjectByName('table-tokens'),
  }
  const measure = (): { calls: number; tris: number } => {
    r.info.autoReset = false; r.info.reset(); r.render(scene, cam)
    const o = { calls: r.info.render.calls, tris: r.info.render.triangles }
    r.info.autoReset = true
    return o
  }
  const out: Record<string, { calls: number; tris: number }> = {}
  // with the shadow pass (what renderer.info reports in game) and without (geometry once, the
  // way §11.5 itemises relief/pieces/terrain)
  const casters: THREE.Light[] = []
  scene.traverse((o) => { const l = o as THREE.Light; if (l.isLight && l.castShadow) casters.push(l) })
  for (const pass of ['', 'noShadow:']) {
    if (pass) for (const l of casters) l.castShadow = false
    const all = measure()
    out[pass + 'total'] = all
    for (const [k, o] of Object.entries(layers)) {
      if (!o) continue
      o.visible = false
      const m = measure()
      o.visible = true
      out[pass + k] = { calls: all.calls - m.calls, tris: all.tris - m.tris }
    }
  }
  for (const l of casters) l.castShadow = true
  // per-mesh triangles (geometry x instances) inside the board
  const per: Record<string, number> = {}
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.visible) return
    const g = m.geometry, tri = (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3
    const n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1
    if ((m as unknown as THREE.BatchedMesh).isBatchedMesh) return
    per[m.name || m.type] = (per[m.name || m.type] ?? 0) + Math.round(tri * n)
  })
  ;(out as Record<string, unknown>).perMesh = per
  return out
}

// One example of every GameEvent variant, played at speed 1; each must settle within 1.2 s.
async function eventDurations(board: BoardView, s0: GameState): Promise<Record<string, number>> {
  const s = structuredClone(s0)
  board.load(s)
  const br = s.units.find((u) => u.side === 'BR' && u.kind === 'rifle') as Unit
  const de = s.units.find((u) => u.side === 'DE' && u.kind === 'rifle') as Unit
  const mg = s.units.find((u) => u.kind === 'mg') as Unit
  const open = [...Array(N_HEX).keys()].find((h) => s.terrain[h] === 'open' && !s.units.some((u) => u.hex === h)) as HexId
  const wire = s.wire.findIndex((w) => w)
  const reinf = s.reinforcements[0]?.unit
  const intent = { id: 900, side: 'DE' as Side, source: de.id, kind: 'assault' as const, from: de.hex, target: open, dmg: 2 }
  const evs: GameEvent[] = [
    { e: 'phase', phase: 'bell', round: 1 },
    { e: 'moved', unit: br.id, path: [br.hex, br.hex - 13] },
    { e: 'pivoted', unit: mg.id, facing: 1 },
    { e: 'attack', kind: 'overwatch', by: mg.id, target: de.hex, dmg: 2 },
    { e: 'attack', kind: 'fire', by: mg.id, target: de.hex, dmg: 1 },
    { e: 'attack', kind: 'assault', by: br.id, target: de.hex, dmg: 2 },
    { e: 'attack', kind: 'strike-back', by: de.id, target: br.hex - 13, dmg: 1 },
    { e: 'attack', kind: 'barrage', by: 'battery', target: open, dmg: 2 },
    { e: 'attack', kind: 'gas', by: 'battery', target: open, dmg: 1 },
    { e: 'attack', kind: 'flood', by: 'sluice', target: open, dmg: 1 },
    { e: 'figures', unit: de.id, lost: 1, left: de.str - 1 },
    { e: 'suppressed', unit: de.id }, { e: 'recovered', unit: de.id }, { e: 'dug-in', unit: br.id }, { e: 'bogged', unit: br.id },
    { e: 'intent', intent }, { e: 'intent-resolved', id: 900, outcome: 'hit' },
    { e: 'crater', hex: open }, { e: 'wire-cut', hex: wire },
    { e: 'gas', hexes: [open, open + 1] },
    { e: 'captured', hex: s.objectives[0].hex, by: 'DE' },
    { e: 'morale', side: 'BR', value: s.morale.BR - 2, delta: -2 },
    { e: 'weather', now: 'rain', next: 'rain' }, { e: 'wind', now: 3, next: 4 },
    { e: 'destroyed', unit: de.id },
    { e: 'phase', phase: 'dusk', round: 1 },
    { e: 'flood', hexes: [] },
    { e: 'game-over', winner: 'BR', reason: 'dusk' },
  ]
  if (reinf) evs.splice(14, 0, { e: 'reinforce', unit: reinf.id })
  const out: Record<string, number> = {}
  for (const ev of evs) {
    const t0 = performance.now()
    await board.play(ev, 1)
    const k = ev.e + ('kind' in ev ? ':' + ev.kind : '')
    out[k] = Math.round(performance.now() - t0)
  }
  return out
}

// Replay a real stretch of play (a British move, the bell, the German reply) with play(), then
// compare the settled frame to load(start)+sync(end): the fraction of pixels that differ.
async function syncVsPlay(board: BoardView, r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera, q: URLSearchParams): Promise<Record<string, unknown>> {
  const s0 = baseState(q)
  let s = s0
  const events: GameEvent[] = []
  const step = (a: Action): void => { const o = apply(s, a); s = o.state; events.push(...o.events) }
  const mine = s.units.filter((u) => u.side === s.human)
  for (const u of mine.slice(0, 2)) {
    const to = [...reach(s, u.id).keys()].find((h) => h !== u.hex)
    if (to !== undefined) step({ t: 'move', unit: u.id, to })
  }
  step({ t: 'endOrders' })
  let guard = 0
  while (s.phase === 'enemy-orders' && guard++ < 3) for (const a of planTurn(s, PROFILES.recruit).actions) { step(a); if (s.phase !== 'enemy-orders') break }
  board.load(s0)
  await frames(3)
  const t0 = performance.now()
  for (const ev of events) await board.play(ev, 4)
  const playMs = performance.now() - t0
  await sleep(2600) // ink droplets and puffs soak away
  await frames(3)
  const a = pixels(r, scene, cam)
  board.load(s0)
  board.sync(s)
  await frames(3)
  const b = pixels(r, scene, cam)
  let diff = 0
  for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 12) diff++
  const kinds: Record<string, number> = {}
  for (const e of events) kinds[e.e] = (kinds[e.e] ?? 0) + 1
  return { events: events.length, kinds, playMs: Math.round(playMs), diffFraction: +(diff / (a.length / 4)).toFixed(5) }
}

function pixels(r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera): Uint8Array {
  r.render(scene, cam)
  const gl = r.getContext()
  const out = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4)
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, out)
  return out
}
