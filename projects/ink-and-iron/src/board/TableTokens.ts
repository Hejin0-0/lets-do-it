// The margin tokens on the oak around the map (DESIGN §9 "Table", G6 candles are morale, G8 rule
// card): one candle per morale point per side (snuffed on 'morale'), the 8-ring turn candle that
// burns a ring at every dusk, one 18-pdr round per shell, the human's order pips (a spent pip
// lies face down), the brass hand bell, the wind vane, the rule card on its easel, the inkpot
// and quill. Counts come from GameState in load()/sync(); events animate the change.
// Frame: the tableTop (y = 0 on the oak). Layout, seen from the commander's chair (+z):
//   north strip  German candles (their rim), German shells, the vane
//   east margin  British candles in a staggered double rank, the order pips, the bell, British shells
//   west margin  the turn candle, the rule card, the inkpot (the lamp, Worker-C, stands at -0.93, 0.4)
// Draw calls: brass, wax, paint (three BatchedMeshes), flames (instanced), the card = 5.
import * as THREE from 'three'
import type { Dir, GameState, Phase, Side } from '../contract/types.ts'
import { mat } from '../render/MaterialLibrary.ts'
import { wornEnamel } from '../assets/miniatures/geo.ts'
import {
  bellGeo, bellHandleGeo, candleGeo, CANDLE, casingGeo, chamberstickGeo, easelGeo, inkpotGeo, pipGeo,
  shellHeadGeo, TURN, turnCapGeo, turnHolderGeo, turnSegGeo, vaneArrowGeo, vaneBaseGeo,
} from '../assets/miniatures/tokens.ts'
import { BOARD_Y, yawOf } from './HexLayout.ts'
import { hash01 } from './noise.ts'
import { ease } from './Vfx.ts'
import type { Vfx } from './Vfx.ts'

const MAX_CANDLES = 24 // per side
const MAX_SHELLS = 10 // per side, HE + gas
const MAX_PIPS = 4
const MAX_RINGS = 10

export const TOKENS = {
  deCandles: { z: -0.612, dxFile: 0.058, dzRank: -0.05 },
  brCandles: { x: 0.708, dxCol: 0.06, z: 0.15, dzRow: 0.075 },
  pips: { x: 0.865, z: -0.1, dz: -0.058 },
  bell: { x: 0.862, z: -0.44 },
  brShells: { x: 0.7, z: -0.588, dx: 0.029 },
  deShells: { x: -0.5, z: -0.588, dx: -0.029 },
  turn: { x: -0.742, z: -0.14 },
  card: { x: -0.805, z: -0.4, w: 0.2, h: 0.13, tilt: 0.66 },
  inkpot: { x: -0.745, z: 0.12 },
  vane: { x: -0.885, z: -0.665 },
}

interface Candle { side: Side; x: number; z: number; used: boolean; lit: number; holder: number; body: number; seed: number }
interface Shell { side: Side; casing: number; head: number; x: number; z: number }
interface Pip { id: number; x: number; z: number; spent: number }

export class TableTokens {
  readonly group = new THREE.Group()
  private readonly vfx: Vfx
  private readonly brass: THREE.BatchedMesh
  private readonly wax: THREE.BatchedMesh
  private readonly paint: THREE.BatchedMesh
  private readonly flames: THREE.InstancedMesh
  private readonly g: Record<string, number> = {}
  private readonly candles: Candle[] = []
  private readonly shells: Shell[] = []
  private readonly pips: Pip[] = []
  private readonly rings: number[] = []
  private readonly cap: number
  private readonly bell: number
  private readonly bellHandle: number
  private readonly vaneArrow: number
  private remaining = 8 // turn-candle rings left (fractional while one melts)
  private maxRounds = 8
  private turnLit = 1
  private bellRock = 0
  private vaneYaw = 0
  private dipK = 0
  private flare = 0
  private reduced = false
  private t = 0
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly one = new THREE.Vector3(1, 1, 1)

  constructor(vfx: Vfx) {
    this.vfx = vfx
    this.group.name = 'table-tokens'
    const brassGeos = { stick: chamberstickGeo(), holder: turnHolderGeo(), casing: casingGeo(), bell: bellGeo(), vane: vaneBaseGeo(), arrow: vaneArrowGeo(), easel: easelGeo(TOKENS.card.tilt, TOKENS.card.w) }
    const waxGeos = { candle: candleGeo(), seg: turnSegGeo(), cap: turnCapGeo() }
    const paintGeos = { head: shellHeadGeo(), pip: pipGeo(), handle: bellHandleGeo(), inkpot: inkpotGeo() }
    const verts = (o: Record<string, THREE.BufferGeometry>): number => Object.values(o).reduce((n, g) => n + g.getAttribute('position').count, 0)
    const waxMat = (mat('wax') as THREE.MeshStandardMaterial).clone()
    waxMat.vertexColors = true
    waxMat.name = 'wax-tokens'
    this.brass = new THREE.BatchedMesh(2 * MAX_CANDLES + 2 * MAX_SHELLS + 6, verts(brassGeos), 0, mat('brass'))
    this.wax = new THREE.BatchedMesh(2 * MAX_CANDLES + MAX_RINGS + 1, verts(waxGeos), 0, waxMat)
    this.paint = new THREE.BatchedMesh(2 * MAX_SHELLS + MAX_PIPS + 2, verts(paintGeos), 0, wornEnamel(mat('enamel'), 'tokens'))
    for (const [b, geos] of [[this.brass, brassGeos], [this.wax, waxGeos], [this.paint, paintGeos]] as [THREE.BatchedMesh, Record<string, THREE.BufferGeometry>][]) {
      for (const [k, geo] of Object.entries(geos)) this.g[k] = b.addGeometry(geo)
      b.castShadow = true; b.receiveShadow = true; b.perObjectFrustumCulled = false; b.sortObjects = false
      this.group.add(b)
    }
    this.brass.name = 'tokens-brass'; this.wax.name = 'tokens-wax'; this.paint.name = 'tokens-paint'
    // candle flames: a lathe teardrop with the shared flame ramp, one per candle + the turn candle
    const fg = new THREE.LatheGeometry([[0.0001, 0], [0.0021, 0.0028], [0.0026, 0.0062], [0.0019, 0.0108], [0.0007, 0.0152], [0.0001, 0.0172]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
    this.flames = new THREE.InstancedMesh(fg, mat('flame'), 2 * MAX_CANDLES + 1)
    this.flames.name = 'tokens-flames'
    this.flames.frustumCulled = false
    this.flames.renderOrder = 4
    this.group.add(this.flames)

    for (const side of ['BR', 'DE'] as Side[]) {
      for (let i = 0; i < MAX_CANDLES; i++) this.candles.push({ side, x: 0, z: 0, used: false, lit: 0, holder: this.brass.addInstance(this.g.stick), body: this.wax.addInstance(this.g.candle), seed: hash01(i, side === 'BR' ? 3 : 4) * 6.28 })
      for (let i = 0; i < MAX_SHELLS; i++) {
        const L = side === 'BR' ? TOKENS.brShells : TOKENS.deShells
        this.shells.push({ side, casing: this.brass.addInstance(this.g.casing), head: this.paint.addInstance(this.g.head), x: L.x + i * L.dx, z: L.z })
      }
    }
    for (let i = 0; i < MAX_PIPS; i++) this.pips.push({ id: this.paint.addInstance(this.g.pip), x: TOKENS.pips.x, z: TOKENS.pips.z + i * TOKENS.pips.dz, spent: 0 })
    for (let i = 0; i < MAX_RINGS; i++) this.rings.push(this.wax.addInstance(this.g.seg))
    this.cap = this.wax.addInstance(this.g.cap)
    const holder = this.brass.addInstance(this.g.holder)
    this.set(this.brass, holder, TOKENS.turn.x, 0, TOKENS.turn.z, 0.3)
    this.bell = this.brass.addInstance(this.g.bell)
    this.bellHandle = this.paint.addInstance(this.g.handle)
    const vane = this.brass.addInstance(this.g.vane)
    this.set(this.brass, vane, TOKENS.vane.x, 0, TOKENS.vane.z, 0)
    this.vaneArrow = this.brass.addInstance(this.g.arrow)
    const easel = this.brass.addInstance(this.g.easel)
    const cardYaw = Math.atan2(-TOKENS.card.x, 1.5 - TOKENS.card.z) // turned toward the commander's chair
    this.set(this.brass, easel, TOKENS.card.x, 0, TOKENS.card.z, cardYaw)
    const ink = this.paint.addInstance(this.g.inkpot)
    this.set(this.paint, ink, TOKENS.inkpot.x, 0, TOKENS.inkpot.z, 0.35)
    this.group.add(this.buildCard(cardYaw))
    this.layout({ BR: 0, DE: 0 })
    this.applyShells({ BR: { he: 0, gas: 0 }, DE: { he: 0, gas: 0 } })
    this.applyPips(0, 0)
    this.refresh()
  }

  private set(b: THREE.BatchedMesh, id: number, x: number, y: number, z: number, yaw: number, s = this.one, roll = 0, pitch = 0): void {
    this.q.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'))
    b.setMatrixAt(id, this.m.compose(new THREE.Vector3(x, y, z), this.q, s))
  }

  // The rule card ⟨G8⟩, propped on its easel and turned to the players.
  private buildCard(yaw: number): THREE.Mesh {
    const { w, h, tilt, x, z } = TOKENS.card
    const tex = new THREE.CanvasTexture(ruleCard())
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 })
    m.name = 'rule-card'
    const card = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.0012).translate(0, h / 2, 0), m)
    card.name = 'rule-card'
    // stands on the easel's ledge, leaning back by `tilt`
    card.position.set(x, 0.007, z + 0.0052)
    card.rotation.set(-tilt, yaw, 0, 'YXZ')
    card.castShadow = true
    card.receiveShadow = true
    return card
  }

  // ------------------------------------------------------------------------------------------
  // Layout from the scenario's starting counts.
  private layout(start: Record<Side, number>): void {
    for (const side of ['BR', 'DE'] as Side[]) {
      const n = start[side]
      if (n > MAX_CANDLES) throw new Error(`TableTokens: ${n} ${side} morale candles > ${MAX_CANDLES}`)
      const cs = this.candles.filter((c) => c.side === side)
      cs.forEach((c, i) => {
        c.used = i < n
        if (side === 'DE') {
          // a staggered double rank along the German rim, centred on the board
          const L = TOKENS.deCandles, rank = i % 2, file = Math.floor(i / 2), files = Math.ceil(n / 2)
          c.x = (file - (files - 1) / 2) * L.dxFile + rank * L.dxFile / 2 - L.dxFile / 4; c.z = L.z + rank * L.dzRank
        } else {
          const col = i % 2, row = Math.floor(i / 2), L = TOKENS.brCandles
          c.x = L.x + col * L.dxCol; c.z = L.z - row * L.dzRow - col * L.dzRow / 2
        }
      })
    }
  }

  load(s: GameState): void {
    this.layout(s.moraleStart)
    this.sync(s)
  }

  sync(s: GameState): void {
    const cs = (side: Side): Candle[] => this.candles.filter((c) => c.side === side && c.used)
    if (cs('BR').length !== s.moraleStart.BR || cs('DE').length !== s.moraleStart.DE) this.layout(s.moraleStart)
    for (const side of ['BR', 'DE'] as Side[]) cs(side).forEach((c, i) => { c.lit = i < s.morale[side] ? 1 : 0 })
    if (s.maxRounds > MAX_RINGS) throw new Error(`TableTokens: ${s.maxRounds} rounds > ${MAX_RINGS} rings`)
    this.maxRounds = s.maxRounds
    this.remaining = ringsLeft(s.maxRounds, s.round, s.phase)
    this.turnLit = s.phase === 'over' ? 0 : 1
    this.applyShells(s.shells)
    const limit = s.orderLimit[s.human]
    this.applyPips(limit, s.phase === 'player-orders' ? limit - s.ordersLeft : limit)
    this.vaneYaw = yawOf(s.wind.now)
    this.bellRock = 0
    this.flare = 0
    this.refresh()
  }

  private applyShells(sh: GameState['shells']): void {
    for (const side of ['BR', 'DE'] as Side[]) {
      const n = sh[side].he + sh[side].gas
      if (n > MAX_SHELLS) throw new Error(`TableTokens: ${n} ${side} shells > ${MAX_SHELLS}`)
      this.shells.filter((x) => x.side === side).forEach((x, i) => {
        const on = i < n, gas = i >= sh[side].he
        this.brass.setVisibleAt(x.casing, on); this.paint.setVisibleAt(x.head, on)
        // a gas round: pale yellow-cross head, and set a little apart from the HE
        const gap = gas ? 0.008 * (side === 'BR' ? 1 : -1) : 0
        this.set(this.brass, x.casing, x.x + gap, 0, x.z, 0)
        this.set(this.paint, x.head, x.x + gap, 0, x.z, 0)
        this.paint.setColorAt(x.head, gas ? new THREE.Color(0.95, 1.25, 0.7) : new THREE.Color(1, 1, 1))
      })
    }
  }

  private applyPips(limit: number, spent: number): void {
    if (limit > MAX_PIPS) throw new Error(`TableTokens: ${limit} order pips > ${MAX_PIPS}`)
    this.pips.forEach((p, i) => {
      this.paint.setVisibleAt(p.id, i < limit)
      // the last orders given are the last pips turned: spend from the far end
      p.spent = i >= limit - spent ? 1 : 0
    })
  }

  // ------------------------------------------------------------------------------------------
  private refresh(): void {
    // candles
    for (const c of this.candles) {
      this.brass.setVisibleAt(c.holder, c.used)
      this.wax.setVisibleAt(c.body, c.used)
      if (!c.used) continue
      this.set(this.brass, c.holder, c.x, 0, c.z, c.seed)
      this.set(this.wax, c.body, c.x, CANDLE.seat - 0.0012, c.z, c.seed)
    }
    // turn candle: whole rings, the melting one squashed, the cap on top
    const { x, z } = TOKENS.turn
    const whole = Math.floor(this.remaining), frac = this.remaining - whole
    this.rings.forEach((id, i) => {
      const on = i < whole || (i === whole && frac > 0.02)
      this.wax.setVisibleAt(id, on)
      if (on) this.set(this.wax, id, x, TURN.plate + i * TURN.seg, z, 0.2 + i * 0.7, i === whole ? new THREE.Vector3(1, frac, 1) : this.one)
    })
    this.set(this.wax, this.cap, x, TURN.plate + this.remaining * TURN.seg, z, 1.1)
    // pips: a spent pip is lifted, flipped and laid face down
    for (const p of this.pips) {
      const k = ease.inOut(p.spent)
      this.set(this.paint, p.id, p.x, Math.sin(k * Math.PI) * 0.018 + k * 0.0052, p.z, 0.3, this.one, 0, k * Math.PI)
      this.paint.setColorAt(p.id, new THREE.Color().setScalar(1 - 0.35 * k))
    }
    // bell: rocks on its lip when rung
    const r = this.bellRock
    const { x: bx, z: bz } = TOKENS.bell
    this.set(this.brass, this.bell, bx, 0, bz, 0.4, this.one, Math.sin(r * Math.PI * 6) * 0.22 * (1 - r))
    this.set(this.paint, this.bellHandle, bx, 0, bz, 0.4, this.one, Math.sin(r * Math.PI * 6) * 0.22 * (1 - r))
    this.set(this.brass, this.vaneArrow, TOKENS.vane.x, 0, TOKENS.vane.z, this.vaneYaw)
    this.writeFlames()
  }

  private writeFlames(): void {
    const t = this.reduced ? 0 : this.t
    const dip = 1 - 0.55 * this.dipK
    let i = 0
    const put = (x: number, y: number, z: number, k: number, seed: number): void => {
      const f = this.reduced ? 1 : 1 + 0.09 * Math.sin(t * 13.1 + seed) + 0.06 * Math.sin(t * 23.7 + seed * 2.3)
      const s = Math.max(0, k * dip * (1 + 0.5 * this.flare))
      this.q.setFromEuler(new THREE.Euler(this.reduced ? 0 : 0.07 * Math.sin(t * 3.1 + seed), 0, this.reduced ? 0 : 0.07 * Math.sin(t * 2.3 + seed * 1.7)))
      this.flames.setMatrixAt(i++, this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(s * (2 - f) * 0.9 + 0.1 * s, s * f, s * (2 - f) * 0.9 + 0.1 * s)))
    }
    for (const c of this.candles) put(c.x + 0.0005, CANDLE.seat - 0.0012 + CANDLE.h + CANDLE.wick * 0.35, c.z, c.used ? c.lit : 0, c.seed)
    put(TOKENS.turn.x + 0.0005, TURN.plate + this.remaining * TURN.seg + 0.0042, TOKENS.turn.z, this.remaining > 0 ? this.turnLit : 0, 1.3)
    this.flames.count = i
    this.flames.instanceMatrix.needsUpdate = true
  }

  // Sheet-frame point for a table-frame one (the vfx live on the sheet, BOARD_Y up).
  private toSheet(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y - BOARD_Y, z) }

  // ------------------------------------------------------------------------------------------
  // Event animations; each resolves within its budget.

  async morale(side: Side, value: number, sec: number): Promise<void> {
    const cs = this.candles.filter((c) => c.side === side && c.used)
    const from = cs.map((c) => c.lit), to = cs.map((_, i) => (i < value ? 1 : 0))
    const changed = cs.filter((_, i) => from[i] !== to[i])
    if (!changed.length) return
    if (sec > 0) {
      for (let i = 0; i < cs.length; i++) {
        if (from[i] > 0.5 && to[i] === 0) this.vfx.puff(this.toSheet(cs[i].x, CANDLE.seat + CANDLE.h + 0.006, cs[i].z), new THREE.Color('#9a9288'), 5, 0.012, 0.55, 1.4)
      }
    }
    await this.vfx.tweens.run(sec, (k) => {
      cs.forEach((c, i) => { if (from[i] !== to[i]) c.lit = from[i] + (to[i] - from[i]) * (to[i] > from[i] ? ease.outBack(k) : ease.outCubic(Math.min(1, k * 2.2))) })
      this.refresh()
    })
    cs.forEach((c, i) => { c.lit = to[i] })
    this.refresh()
  }

  async phase(phase: Phase, round: number, sec: number): Promise<void> {
    const limit = this.pips.filter((p) => this.paint.getVisibleAt(p.id)).length
    const pipFrom = this.pips.map((p) => p.spent)
    const pipTo = this.pips.map((_, i) => (i < limit ? (phase === 'player-orders' ? 0 : 1) : 0))
    const r0 = this.remaining, r1 = ringsLeft(this.maxRounds, round, phase)
    const ring = phase === 'bell'
    await this.vfx.tweens.run(sec, (k) => {
      this.pips.forEach((p, i) => { p.spent = pipFrom[i] + (pipTo[i] - pipFrom[i]) * k })
      this.remaining = r0 + (r1 - r0) * ease.inOut(k)
      if (ring) this.bellRock = k
      if (phase === 'over') this.turnLit = 1 - k
      this.refresh()
    })
    this.pips.forEach((p, i) => { p.spent = pipTo[i] })
    this.remaining = r1
    this.bellRock = 0
    this.refresh()
  }

  async wind(d: Dir, sec: number): Promise<void> {
    const a0 = this.vaneYaw
    let a1 = yawOf(d)
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
    while (a1 - a0 < -Math.PI) a1 += Math.PI * 2
    await this.vfx.tweens.run(sec, (k) => { this.vaneYaw = a0 + (a1 - a0) * ease.outBack(k); this.refresh() })
    this.vaneYaw = yawOf(d)
    this.refresh()
  }

  async gameOver(winner: Side, sec: number): Promise<void> {
    void winner
    await this.vfx.tweens.run(sec, (k) => { this.flare = Math.sin(k * Math.PI); this.bellRock = k; this.refresh() })
    this.flare = 0
    this.bellRock = 0
    this.refresh()
  }

  // A barrage lands: every flame on the table ducks and recovers.
  dip(a: number): void { this.dipK = Math.max(this.dipK, Math.min(1, a)) }

  update(dt: number, t: number, reduced: boolean): void {
    this.reduced = reduced
    this.t = t
    this.dipK = Math.max(0, this.dipK - dt * 1.6)
    this.writeFlames()
  }

  // for the harness / tests
  get litCount(): Record<Side, number> {
    const n = (side: Side): number => this.candles.filter((c) => c.side === side && c.used && c.lit > 0.5).length
    return { BR: n('BR'), DE: n('DE') }
  }
  get ringsLeft(): number { return this.remaining }
}

// Rings of the turn candle still standing: the ring of the current round burns until dusk.
export function ringsLeft(maxRounds: number, round: number, phase: Phase): number {
  return Math.max(0, maxRounds - round + (phase === 'dusk' || phase === 'over' ? 0 : 1))
}

// ---------------------------------------------------------------------------------------------
// The rule card: aged card stock, a ruled border, "Standing Orders" and three rules, each with
// its own icon so the card reads without colour.
function ruleCard(): HTMLCanvasElement {
  const W = 1024, H = Math.round(W * TOKENS.card.h / TOKENS.card.w)
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error('2d canvas unavailable')
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = hash01(x >> 2, (y >> 2) + 7) * 0.05 + hash01(x, y) * 0.035
    const e = Math.min(x, y, W - 1 - x, H - 1 - y) / 60
    const age = 1 - 0.14 * Math.max(0, 1 - e) ** 2
    const o = (y * W + x) * 4
    img.data[o] = (236 - 30 * n) * age; img.data[o + 1] = (224 - 34 * n) * age; img.data[o + 2] = (192 - 40 * n) * age; img.data[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const sepia = '#3b2616', red = '#9c2219'
  g.strokeStyle = sepia
  g.lineWidth = 6; g.strokeRect(22, 22, W - 44, H - 44)
  g.lineWidth = 2; g.strokeRect(36, 36, W - 72, H - 72)
  g.fillStyle = sepia; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = 'bold 44px Georgia, "Times New Roman", serif'
  const title = 'STANDING ORDERS'
  let tx = W / 2 - (title.length - 1) * 16
  for (const ch of title) { g.fillText(ch, tx, 92); tx += 32 }
  g.lineWidth = 2; g.beginPath(); g.moveTo(W * 0.2, 128); g.lineTo(W * 0.8, 128); g.stroke()
  const rows: [string, (x: number, y: number) => void][] = [
    ['Red ink hurts.', (x, y) => {
      g.save(); g.beginPath()
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42) }
      g.closePath(); g.strokeStyle = red; g.lineWidth = 5; g.stroke(); g.clip()
      g.lineWidth = 4
      for (let d = -90; d <= 90; d += 14) { g.beginPath(); g.moveTo(x + d - 50, y - 50); g.lineTo(x + d + 50, y + 50); g.stroke(); g.beginPath(); g.moveTo(x + d + 50, y - 50); g.lineTo(x + d - 50, y + 50); g.stroke() }
      g.restore()
    }],
    ['Wire stops.', (x, y) => {
      g.save(); g.strokeStyle = sepia; g.lineWidth = 4
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x - 36 + k * 18, y, 16, 26, 0.3, 0, Math.PI * 2); g.stroke() }
      g.lineWidth = 6
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * 56 - 12, y + 34); g.lineTo(x + s * 56 + 12, y - 34); g.moveTo(x + s * 56 + 12, y + 34); g.lineTo(x + s * 56 - 12, y - 34); g.stroke() }
      g.restore()
    }],
    ['Trenches shelter.', (x, y) => {
      g.save(); g.strokeStyle = sepia; g.fillStyle = sepia; g.lineWidth = 5
      g.beginPath(); g.moveTo(x - 58, y + 6)
      for (let k = 0; k < 4; k++) { const x0 = x - 58 + k * 29; g.lineTo(x0 + 8, y + 6); g.lineTo(x0 + 8, y + 28); g.lineTo(x0 + 22, y + 28); g.lineTo(x0 + 22, y + 6) }
      g.lineTo(x + 58, y + 6); g.stroke()
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x - 44 + k * 22, y - 8, 11, 7, 0, 0, Math.PI * 2); g.fill() }
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x - 33 + k * 22, y - 22, 11, 7, 0, 0, Math.PI * 2); g.fill() }
      g.restore()
    }],
  ]
  const top = 196, step = (H - 60 - top) / rows.length
  rows.forEach(([text, icon], i) => {
    const y = top + step * (i + 0.5) - 14
    icon(150, y)
    g.fillStyle = i === 0 ? red : sepia
    g.textAlign = 'left'
    g.font = 'italic 84px Georgia, "Times New Roman", serif'
    g.fillText(text, 250, y + 4)
  })
  return c
}
