// The war-table's board (Worker-B, DESIGN §9 "Board", "Miniatures", "Overlays", "Events"):
// the painted sheet on its relief inside an oak mount, the terrain kit, the tin miniatures, the
// overlays and the margin tokens, and the replay of every GameEvent.
//
// Frames: root sits at the tabletop (tableTop frame, y = 0 on the oak). The mounted sheet is a
// plinth BOARD_Y thick, so the painted surface is at y = BOARD_Y; hexToLocal() returns points
// on it in the tableTop frame, which is what Game.hexScreen() multiplies by tableTop.matrixWorld.
import * as THREE from 'three'
import type { Bus } from '../contract/bus.ts'
import type { GameEvent } from '../contract/events.ts'
import type { BoardView, Overlay } from '../contract/render-api.ts'
import type { GameState, HexId, Intent } from '../contract/types.ts'
import { mat } from '../render/MaterialLibrary.ts'
import { BOARD_Y, hexFromXZ, hexX, hexZ, MAP_H, MAP_W, MOUNT_Y, yawOf } from './HexLayout.ts'
import { MOUNT_H, MOUNT_W, paintMargin, paintSheet } from './MapPainter.ts'
import type { Sheet } from './MapPainter.ts'
import { pieceSpot } from './features.ts'
import { buildFields } from './fields.ts'
import { Flora, planFlora } from './Flora.ts'
import { Relief } from './Relief.ts'
import { TerrainKit } from './TerrainKit.ts'
import { Pieces } from './Pieces.ts'
import { Overlays } from './Overlays.ts'
import { TableTokens } from './TableTokens.ts'
import { Vfx } from './Vfx.ts'
import { ZONE_LIST } from './zones.ts'

const FRAME = 0.02 // oak moulding outside the margin band

export function createBoardView(bus: Bus): BoardView {
  return new Board(bus)
}

class Board implements BoardView {
  readonly root = new THREE.Group()
  private readonly sheetGroup = new THREE.Group()
  private readonly bus: Bus
  private relief: Relief | null = null
  private sheet: Sheet | null = null
  private kit: TerrainKit | null = null
  private flora: Flora | null = null
  readonly pieces: Pieces
  readonly overlays: Overlays
  readonly tokens: TableTokens
  readonly vfx: Vfx
  private state: GameState | null = null
  private loadedWire: boolean[] = []
  private flooded = false
  private reduced = false
  private readonly ray = new THREE.Raycaster()
  private readonly intents = new Map<number, Intent>()
  private clock = 0
  private hitstop = 0

  constructor(bus: Bus) {
    this.bus = bus
    this.root.name = 'board'
    this.sheetGroup.name = 'sheet'
    this.sheetGroup.position.y = BOARD_Y
    this.root.add(this.sheetGroup)
    this.root.add(this.buildMount())
    this.vfx = new Vfx()
    this.pieces = new Pieces(this.vfx)
    this.overlays = new Overlays()
    this.tokens = new TableTokens(this.vfx)
    this.sheetGroup.add(this.pieces.group, this.overlays.group, this.vfx.group)
    this.root.add(this.tokens.group)
    this.bus.on('fx:candles', ({ dip }) => this.tokens.dip(dip))
  }

  // The oak plinth: a frame around the map opening, a raised moulding, and the lettered margin.
  private buildMount(): THREE.Group {
    const g = new THREE.Group()
    g.name = 'mount'
    const rect = (w: number, h: number, r = 0): THREE.Path => {
      const p = new THREE.Shape()
      const x0 = -w / 2, z0 = -h / 2
      if (r <= 0) { p.moveTo(x0, z0); p.lineTo(x0 + w, z0); p.lineTo(x0 + w, z0 + h); p.lineTo(x0, z0 + h); p.closePath(); return p }
      p.moveTo(x0 + r, z0); p.lineTo(x0 + w - r, z0); p.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r)
      p.lineTo(x0 + w, z0 + h - r); p.quadraticCurveTo(x0 + w, z0 + h, x0 + w - r, z0 + h)
      p.lineTo(x0 + r, z0 + h); p.quadraticCurveTo(x0, z0 + h, x0, z0 + h - r); p.lineTo(x0, z0 + r); p.quadraticCurveTo(x0, z0, x0 + r, z0)
      return p
    }
    const ring = (ow: number, oh: number, iw: number, ih: number, depth: number, bevel: number, r: number): THREE.BufferGeometry => {
      const s = rect(ow, oh, r) as THREE.Shape
      s.holes.push(rect(iw, ih))
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 })
      geo.rotateX(Math.PI / 2) // shape xy -> xz, extrude down from y = 0
      return geo
    }
    // frame under the margin (top at MOUNT_Y) and the raised moulding outside it; the terrain block
    // stands up out of the frame to BOARD_Y, its cut sides showing (Relief's section)
    const inner = ring(MOUNT_W, MOUNT_H, MAP_W, MAP_H, MOUNT_Y, 0, 0)
    inner.translate(0, MOUNT_Y, 0)
    const lip = ring(MOUNT_W + 2 * FRAME, MOUNT_H + 2 * FRAME, MOUNT_W, MOUNT_H, MOUNT_Y + 0.0035, 0.0018, 0.012)
    lip.translate(0, MOUNT_Y + 0.0035 - 0.0018, 0)
    const oak = mat('oak')
    for (const geo of [inner, lip]) {
      const m = new THREE.Mesh(geo, oak)
      m.castShadow = true; m.receiveShadow = true
      g.add(m)
    }
    // the floor under the relief (seen only through the deepest beds)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1 }))
    floor.position.y = 0.0005
    g.add(floor)
    // lettered margin band
    const tex = new THREE.CanvasTexture(paintMargin())
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    const band = rect(MOUNT_W, MOUNT_H) as THREE.Shape
    band.holes.push(rect(MAP_W, MAP_H))
    const bg = new THREE.ShapeGeometry(band)
    bg.rotateX(Math.PI / 2)
    const p = bg.getAttribute('position') as THREE.BufferAttribute, uv = bg.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + MOUNT_W / 2) / MOUNT_W, 1 - (p.getZ(i) + MOUNT_H / 2) / MOUNT_H)
    // ShapeGeometry after rotateX(+90deg) faces down; flip the winding to face up
    const idx = bg.getIndex() as THREE.BufferAttribute
    for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a) }
    bg.computeVertexNormals()
    const bm = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, bumpMap: tex, bumpScale: 0.00025 }))
    bm.position.y = MOUNT_Y + 0.0002
    bm.receiveShadow = true
    bm.name = 'margin'
    g.add(bm)
    return g
  }

  // ------------------------------------------------------------------------------------------
  load(s: GameState): void {
    this.state = structuredClone(s)
    this.loadedWire = [...s.wire]
    this.flooded = s.sluiceUsed
    this.buildSheet(s)
    this.pieces.load(s, this.surface)
    this.tokens.load(s)
    this.intents.clear()
    for (const i of s.intents) this.intents.set(i.id, i)
    this.overlays.clearAll()
    this.vfx.clear()
  }

  private surface = (x: number, z: number): number => (this.relief ? this.relief.standY(x, z) : 0)

  private buildSheet(s: GameState): void {
    if (this.relief) {
      this.sheetGroup.remove(this.relief.group)
      this.relief.dispose()
    }
    if (this.kit) { this.sheetGroup.remove(this.kit.group); this.kit.dispose() }
    if (this.flora) { this.sheetGroup.remove(this.flora.group); this.flora.dispose() }
    const fields = buildFields(s.terrain, this.flooded)
    const objectives = s.objectives.map((o) => ({ hex: o.hex, name: o.name }))
    // planned before the paint, so the painter leaves out the printed canopy under every 3D tree
    const plants = planFlora(s.terrain, fields, s.wire, objectives.map((o) => o.hex))
    this.sheet = paintSheet({ terrain: s.terrain, wire: s.wire, objectives, flooded: this.flooded, fields, plants, scenario: s.scenario })
    this.relief = new Relief(s.terrain, fields, this.sheet)
    this.relief.setFlood(this.flooded, (z) => z === ZONE_LIST.indexOf('flood'))
    this.overlays.attach(this.relief.overlayMaterials())
    this.sheetGroup.add(this.relief.group)
    this.kit = new TerrainKit(s.terrain, this.relief, this.vfx.tweens)
    this.kit.setWire(s.wire, this.loadedWire)
    this.kit.setSeals(s.objectives)
    this.sheetGroup.add(this.kit.group)
    this.flora = new Flora(plants, this.relief, s.terrain, objectives.map((o) => o.hex))
    this.sheetGroup.add(this.flora.group)
    this.clearBases(s)
  }

  // The flora gives way to the bases wider than its 43 mm keep-out: the tank's (1.45x along its
  // facing) and a dug-in unit's sandbag ring (41 + 5.5 mm out, bags 3.6 mm long).
  private clearBases(s: GameState): void {
    this.flora?.clearFor(s.units.filter((u) => u.str > 0 && (u.kind === 'tank' || u.dugIn)).map((u) => {
      const [x, z] = pieceSpot(u.hex, s.terrain), ring = u.dugIn ? 0.0505 : 0.0425
      return { x, z, yaw: yawOf(u.facing), rx: ring, rz: u.kind === 'tank' ? Math.max(ring, 0.061) : ring }
    }))
  }

  sync(s: GameState): void {
    if (!this.state || !this.relief || !this.kit || !this.sheet) { this.load(s); return }
    // terrain that changes in play: craters, cut wire, flood
    if (s.sluiceUsed !== this.flooded) { this.flooded = s.sluiceUsed; this.buildSheet(s) }
    for (let h = 0; h < s.terrain.length; h++) {
      if (s.terrain[h] === 'crater' && !this.relief.hasCrater(h)) { this.relief.stampCrater(h); this.sheet.stampCrater(h); this.markSheetDirty(); this.flora?.clearHex(h) }
    }
    this.kit.setWire(s.wire, this.loadedWire)
    this.kit.setSeals(s.objectives)
    this.kit.setGas(s.gas)
    this.pieces.sync(s, this.surface)
    this.tokens.sync(s)
    for (const i of s.intents) this.intents.set(i.id, i)
    this.relief.setWet(s.weather.now === 'rain' ? 1 : 0)
    this.clearBases(s)
    this.vfx.settle()
    this.state = structuredClone(s)
  }

  private markSheetDirty(): void {
    const m = this.relief?.material
    if (m?.map) m.map.needsUpdate = true
    if (m?.roughnessMap) m.roughnessMap.needsUpdate = true
    if (m?.bumpMap) m.bumpMap.needsUpdate = true
  }

  // ------------------------------------------------------------------------------------------
  // Events. Every branch resolves within 1.2 s / speed; under reduced motion it snaps.

  async play(ev: GameEvent, speed: number): Promise<void> {
    const sp = Math.max(0.25, speed)
    const d = (sec: number): number => (this.reduced ? 0 : sec / sp)
    const s = this.state
    switch (ev.e) {
      case 'phase': {
        if (s) { s.phase = ev.phase; s.round = ev.round }
        await this.tokens.phase(ev.phase, ev.round, d(0.5))
        return
      }
      case 'moved': {
        const u = s?.units.find((x) => x.id === ev.unit)
        if (u) u.hex = ev.path[ev.path.length - 1]
        await this.pieces.move(ev.unit, ev.path, this.surface, d(Math.min(1.2, 0.36 * Math.max(1, ev.path.length - 1) + 0.3)))
        return
      }
      case 'pivoted': {
        const u = s?.units.find((x) => x.id === ev.unit)
        if (u) u.facing = ev.facing
        await this.pieces.pivot(ev.unit, ev.facing, d(0.4))
        return
      }
      case 'attack': {
        const target = ev.target
        const tp = this.hexToLocal(target).setY(0)
        tp.y = this.surface(tp.x, tp.z)
        const from = this.pieces.muzzle(ev.by)
        if (ev.kind === 'barrage') {
          this.hitstop = this.reduced ? 0 : 0.07
          await this.vfx.barrage(tp, d(0.9), this.reduced)
        } else if (ev.kind === 'gas') {
          await this.vfx.gasCloud(tp, d(0.8))
        } else if (ev.kind === 'flood') {
          await this.vfx.splash(tp, d(0.6))
        } else if (ev.kind === 'assault' || ev.kind === 'strike-back') {
          await Promise.all([this.pieces.lunge(ev.by, tp, d(0.55)), this.vfx.clash(tp, d(0.55))])
        } else {
          // overwatch / fire: tracers from the muzzle to the target — a machine-gun's are lit
          // tracer rounds in a tight stream — and the firing men kick back with the shot
          const mg = this.pieces.kindOf(ev.by) === 'mg'
          this.pieces.recoil(ev.by)
          await this.vfx.tracers(from ?? tp, tp, mg ? 9 : ev.kind === 'overwatch' ? 5 : 3, d(mg ? 0.75 : 0.6), mg)
        }
        return
      }
      case 'figures': {
        const u = s?.units.find((x) => x.id === ev.unit)
        if (u) u.str = ev.left
        await this.pieces.loseFigures(ev.unit, ev.left, this.vfx, d(0.9))
        return
      }
      case 'destroyed': {
        const u = s?.units.find((x) => x.id === ev.unit)
        if (u) u.str = 0
        await this.pieces.destroy(ev.unit, this.vfx, d(0.8))
        return
      }
      case 'suppressed': case 'recovered': case 'dug-in': case 'bogged': {
        const u = s?.units.find((x) => x.id === ev.unit)
        if (u) {
          if (ev.e === 'suppressed') { u.suppressedUntil = Math.max(u.suppressedUntil, (s?.round ?? 0) + 1); u.dugIn = false }
          if (ev.e === 'recovered') u.suppressedUntil = 0
          if (ev.e === 'dug-in') u.dugIn = true
          if (ev.e === 'bogged') u.bogged = true
        }
        await this.pieces.stateCue(ev.unit, ev.e, d(0.5))
        return
      }
      case 'reinforce': {
        // the unit is either already listed or waiting in the reinforcement queue
        const u = s?.units.find((x) => x.id === ev.unit) ?? s?.reinforcements.find((r) => r.unit.id === ev.unit)?.unit
        if (!u) return
        if (s && !s.units.includes(u)) { s.units.push(u); s.reinforcements = s.reinforcements.filter((r) => r.unit !== u) }
        await this.pieces.rise(u, d(0.9))
        return
      }
      case 'intent': {
        this.intents.set(ev.intent.id, ev.intent)
        s?.intents.push(ev.intent)
        const p = this.hexToLocal(ev.intent.target)
        await this.vfx.nib(p.setY(this.surface(p.x, p.z)), d(0.35))
        this.overlays.addIntent(ev.intent)
        return
      }
      case 'intent-resolved': {
        const it = this.intents.get(ev.id)
        if (s) s.intents = s.intents.filter((i) => i.id !== ev.id)
        this.overlays.removeIntent(ev.id)
        if (it) {
          const p = this.hexToLocal(it.target)
          await this.vfx.resolveIntent(p.setY(this.surface(p.x, p.z)), ev.outcome, d(0.5))
        }
        return
      }
      case 'crater': {
        if (s) s.terrain[ev.hex] = 'crater'
        if (this.relief && this.sheet && !this.relief.hasCrater(ev.hex)) {
          this.relief.stampCrater(ev.hex); this.sheet.stampCrater(ev.hex); this.markSheetDirty()
          this.flora?.clearHex(ev.hex)
        }
        this.pieces.resettle(this.surface)
        await wait(d(0.15))
        return
      }
      case 'wire-cut': {
        if (s) s.wire[ev.hex] = false
        await this.kit?.cutWire(ev.hex, d(0.6))
        this.kit?.setWire(s?.wire ?? [], this.loadedWire)
        return
      }
      case 'gas': {
        if (s) for (const h of ev.hexes) s.gas[h] = Math.max(s.gas[h], 2)
        this.kit?.setGas(s?.gas ?? [])
        await this.kit?.billowGas(d(0.8))
        return
      }
      case 'flood': {
        if (s) { s.sluiceUsed = true; this.flooded = true; this.buildSheet(s) }
        await this.kit?.riseFlood(this.relief?.floodMesh ?? null, d(0.8))
        return
      }
      case 'captured': {
        const o = s?.objectives.find((x) => x.hex === ev.hex)
        if (o) o.holder = ev.by
        await this.kit?.stampSeal(ev.hex, ev.by, d(0.7))
        return
      }
      case 'morale': {
        if (s) s.morale[ev.side] = ev.value
        await this.tokens.morale(ev.side, ev.value, d(0.6))
        return
      }
      case 'weather': {
        if (s) s.weather = { now: ev.now as 'dry' | 'rain', next: ev.next as 'dry' | 'rain' }
        await this.fade(d(0.8), (k) => this.relief?.setWet(ev.now === 'rain' ? k : 1 - k))
        this.relief?.setWet(ev.now === 'rain' ? 1 : 0)
        return
      }
      case 'wind': {
        if (s) s.wind = { now: ev.now, next: ev.next }
        await this.tokens.wind(ev.now, d(0.6))
        return
      }
      case 'game-over': {
        if (s) s.winner = ev.winner
        await this.tokens.gameOver(ev.winner, d(0.8))
        return
      }
      default: {
        const never: never = ev
        throw new Error(`BoardView.play: unhandled event ${JSON.stringify(never)}`)
      }
    }
  }

  private fade(sec: number, f: (k: number) => void): Promise<void> {
    return this.vfx.tween(sec, f)
  }

  overlay(o: Overlay): void {
    this.overlays.set(o, this.state, this.surface)
    this.pieces.select(o.selected)
  }

  hexAt(ndc: THREE.Vector2, cam: THREE.Camera): HexId | null {
    this.root.updateWorldMatrix(true, false)
    this.ray.setFromCamera(ndc, cam)
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert()
    const o = this.ray.ray.origin.clone().applyMatrix4(inv)
    const dir = this.ray.ray.direction.clone().transformDirection(inv)
    // A click on a soldier means his hex, even where his head overlaps the hex behind him; but a
    // click that lands within 22 mm of a hex's own centre means that hex (hexScreen() aims there,
    // so every hex stays clickable however the pieces in front of it stand).
    const hitPiece = this.pieces.pick(o, dir, BOARD_Y)
    let ground: HexId | null = null, near = false
    if (dir.y < -1e-6) {
      // March down the ray from above the tallest relief to under the deepest bed in ~2 mm steps,
      // then bisect the first step that ends under the surface. (A fixed-point walk on the height
      // diverged on steep banks: from the 1.68 m seat the far dune hex picked nothing.)
      const surf = (t: number): number => o.y + dir.y * t - BOARD_Y - (this.relief ? this.relief.heightAt(o.x + dir.x * t, o.z + dir.z * t) : 0)
      const lo = Math.max(0, (BOARD_Y + 0.08 - o.y) / dir.y), hi = (BOARD_Y - 0.02 - o.y) / dir.y
      const n = Math.max(1, Math.min(200, Math.ceil((hi - lo) * Math.hypot(dir.x, dir.z) / 0.002)))
      let prev = lo, t = hi
      for (let i = 1; i <= n; i++) {
        const ti = lo + (hi - lo) * i / n
        if (surf(ti) <= 0) { t = ti; break }
        prev = ti
      }
      for (let k = 0; k < 10; k++) { const m = (prev + t) / 2; if (surf(m) > 0) prev = m; else t = m }
      const x = o.x + dir.x * t, z = o.z + dir.z * t
      ground = hexFromXZ(x, z)
      near = ground !== null && Math.hypot(x - hexX(ground), z - hexZ(ground)) < 0.022
    }
    if (hitPiece !== null && !(near && ground !== hitPiece)) return hitPiece
    return ground
  }

  hexToLocal(h: HexId): THREE.Vector3 {
    const x = hexX(h), z = hexZ(h)
    return new THREE.Vector3(x, BOARD_Y + (this.relief ? this.relief.heightAt(x, z) : 0), z)
  }

  pieceScreenBox(unit: string, cam: THREE.Camera): { w: number; h: number } {
    this.root.updateWorldMatrix(true, true)
    const pts = this.pieces.outline(unit)
    if (!pts.length) return { w: 0, h: 0 }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    const v = new THREE.Vector3()
    for (const p of pts) {
      v.copy(p).applyMatrix4(this.sheetGroup.matrixWorld).project(cam)
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y)
    }
    const c = document.querySelector<HTMLCanvasElement>('#game-canvas')
    const W = c?.clientWidth || innerWidth, H = c?.clientHeight || innerHeight
    return { w: (x1 - x0) * W / 2, h: (y1 - y0) * H / 2 }
  }

  update(dt: number, t: number): void {
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.05 }
    this.clock += dt
    const tt = this.reduced ? 0 : t
    this.relief?.update(tt)
    this.pieces.update(dt, tt)
    this.overlays.update(tt)
    this.vfx.update(dt, tt)
    this.tokens.update(dt, tt, this.reduced)
    this.kit?.update(dt, tt)
    // Smoke still curls from the shelled buildings: an outside review found the board "static",
    // no life between the turns. A thin grey wisp every ~0.5 s from one ruin or church.
    this.smokeT -= dt
    if (!this.reduced && this.state && this.smokeT <= 0) {
      this.smokeT = 0.5
      const burning = this.state.terrain.flatMap((v, h) => (v === 'ruin' || v === 'church' ? [h] : []))
      if (burning.length) {
        const h = burning[this.smokeN++ % burning.length]
        const x = hexX(h) + 0.01, z = hexZ(h) - 0.04
        const p = new THREE.Vector3(x, this.surface(x, z) + 0.035, z)
        this.vfx.puff(p, new THREE.Color('#6f6a64'), 2, 0.026, 0.32, 3.2)
      }
    }
  }
  private smokeT = 0
  private smokeN = 0

  setReducedMotion(on: boolean): void {
    this.reduced = on
    this.vfx.reduced = on
    this.pieces.reduced = on
    if (on) this.vfx.finishAll()
  }

  mount(tableTop: THREE.Object3D): void { tableTop.add(this.root) }
}

function wait(sec: number): Promise<void> {
  return sec <= 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, sec * 1000))
}

