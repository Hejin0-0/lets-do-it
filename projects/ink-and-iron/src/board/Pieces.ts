// The tin soldiers on the sheet (DESIGN §9 "Miniatures"). Every enamel part of every piece —
// figures, guns, the tank, the groundwork bases with their emblems — is an instance in ONE
// BatchedMesh (worn enamel), the rims in two more (brass for the British, iron for the Germans),
// so a full board of pieces costs a handful of draw calls. A piece is `str` figures on a base;
// losing figures topples the last ones and re-forms the rest (layout() is the single source of
// where figures stand, so play() and sync() end on the same frame).
// State is shape, not colour: gold wisps (orders left), grey puff + 6 deg tilt (suppressed),
// a sandbag ring (dug-in), mud clods (bogged); selection is a gold Fresnel rim and a lift.
import * as THREE from 'three'
import type { Dir, GameState, HexId, Side, Unit, UnitKind } from '../contract/types.ts'
import { mat } from '../render/MaterialLibrary.ts'
import { Geo, hex, tintBelow, wornEnamel } from '../assets/miniatures/geo.ts'
import {
  BASE_H, BASE_R, buildBaseTop, buildFieldGun, buildFigure, buildMG, buildRim, buildTank, contactShadowTexture, emblem, pipGeo, POSES,
} from '../assets/miniatures/figures.ts'
import { pieceSpot } from './features.ts'
import { hexX, hexZ, yawOf } from './HexLayout.ts'
import { ease } from './Vfx.ts'
import type { Tweens, Vfx } from './Vfx.ts'
import { sandbagGeo } from './TerrainKit.ts'

const FIG_GROW = 1.42 // see figMatrix()

export type Surface = (x: number, z: number) => number

interface Slot { x: number; z: number; yaw: number; pose: string }
const TANK_STRETCH = 1.45

// Where figure i of a `kind` piece with n figures stands on the base (base-local, forward -z).
// Figure i keeps its pose whatever n is (the model is chosen once per slot in create()), so the
// squad reads as a squad: the NCO pointing the way, a standing aim, a kneeling aim, a man at the
// port; storm troops throw, dash and crouch.
export function layout(kind: UnitKind, n: number): Slot[] {
  const P = (x: number, z: number, yaw: number, pose: string): Slot => ({ x, z, yaw, pose })
  switch (kind) {
    case 'rifle': {
      const all = [P(-0.0175, -0.011, 0.1, 'point'), P(0.0165, -0.013, -0.12, 'aim'), P(-0.012, 0.017, 0.25, 'kneel'), P(0.0185, 0.0155, -0.2, 'port')]
      const L: Record<number, Slot[]> = { 4: all, 3: [P(-0.0175, -0.009, 0.1, 'point'), P(0.0175, -0.011, -0.12, 'aim'), P(0.001, 0.0175, 0.2, 'kneel')], 2: [P(-0.0125, -0.002, 0.1, 'point'), P(0.0135, 0.004, -0.12, 'aim')], 1: [P(0, 0, 0, 'point')] }
      return L[Math.max(0, Math.min(4, n))] ?? []
    }
    case 'stoss': {
      const L: Record<number, Slot[]> = { 3: [P(-0.0165, -0.0105, 0.15, 'throw'), P(0.0165, -0.0085, -0.15, 'dash'), P(0.0005, 0.0175, 0, 'crouch')], 2: [P(-0.012, -0.002, 0.15, 'throw'), P(0.013, 0.003, -0.15, 'dash')], 1: [P(0, 0, 0, 'throw')] }
      return L[Math.max(0, Math.min(3, n))] ?? []
    }
    // the gun is the read: the gunner sits at its grips (POSES.gunner's hands meet buildMG's spade
    // grips through the x1.45, -9 mm gun matrix in create()), the others kneel beside it
    case 'mg': return [P(0, 0.017, 0, 'gunner'), P(0.0235, 0.004, -0.5, 'loader'), P(-0.0245, 0.012, 0.35, 'spotter')].slice(0, n)
    case 'fieldgun': return [P(-0.025, 0.018, 0.4, 'shell'), P(0.026, 0.014, -0.5, 'spotter')].slice(0, n)
    case 'tank': return []
  }
}

// The models (key -> geometry) this module draws; built once, shared by the batch and the rim.
function modelKey(side: Side, kind: UnitKind, pose: string): string { return `${side}:${kind}:${pose}` }

interface Part { id: number; batch: THREE.BatchedMesh; local: THREE.Matrix4; geo: THREE.BufferGeometry; figure: number } // figure = index or -1

interface Piece {
  unit: Unit
  pos: THREE.Vector3
  yaw: number
  tilt: number
  lift: number
  rock: number
  squash: number
  parts: Part[]
  figs: Part[] // figure parts by figure index
  pips: Part[]
  height: number
  alive: boolean
  bags: number
  clods: number
  topple: Map<number, number> // figure index -> 0..1 topple/dissolve progress
  phase: number // this piece's idle sway phase (from its id), so no two squads shift in step
  march: number // 1 while it moves: the men step out (swayMatrix)
  recoil: number // 1 on a shot, decaying: the men kick back with their rifles
}

export class Pieces {
  readonly group = new THREE.Group()
  reduced = false
  private readonly enamel: THREE.BatchedMesh
  private readonly brass: THREE.BatchedMesh
  private readonly iron: THREE.BatchedMesh
  private readonly geos = new Map<string, { geo: THREE.BufferGeometry; ids: Map<THREE.BatchedMesh, number> }>()
  private readonly pieces = new Map<string, Piece>()
  private readonly shadows: THREE.InstancedMesh
  private readonly bags: THREE.InstancedMesh
  private readonly clods: THREE.InstancedMesh
  private readonly cues: CuePoints
  private readonly selGroup = new THREE.Group()
  private readonly fresnel: THREE.ShaderMaterial
  // A pool of gold light on the sheet under the piece in hand. The Fresnel rim alone was "only a
  // thin ring" at the commander's 1.95 m (outside review): this reads at a glance.
  private readonly halo: THREE.Mesh
  // A small camera-facing shield over every piece: its side's colours, its type's glyph and one dot
  // per man left. Outside reviews read the squads as "clumpy blobs" whose type (rifle, MG, gun,
  // tank, Stoßtrupp) and strength needed a hover. One draw call for all of them.
  private readonly badges: THREE.InstancedMesh
  private readonly badgeCell: THREE.InstancedBufferAttribute
  private selected: string | null = null
  private surface: Surface = () => 0
  private terrain: GameState['terrain'] = []
  private phase: GameState['phase'] = 'player-orders'
  private round = 1
  private human: Side = 'BR'
  private readonly tw: Tweens
  private readonly vfx: Vfx
  static readonly MAX_PIECES = 24
  static readonly BAGS_PER = 16
  static readonly CLODS_PER = 10

  constructor(vfx: Vfx) {
    this.vfx = vfx
    this.tw = vfx.tweens
    this.group.name = 'pieces'
    // build every model up front so the batches can be sized exactly
    const models = new Map<string, THREE.BufferGeometry>()
    const add = (k: string, g: THREE.BufferGeometry): void => { models.set(k, g) }
    for (const side of ['BR', 'DE'] as Side[]) {
      for (const pose of ['point', 'aim', 'kneel', 'port', 'gunner', 'loader', 'spotter', 'shell']) add(modelKey(side, 'rifle', pose), buildFigure(side, POSES[pose]).build(0.18, 0.01))
      for (const pose of ['throw', 'dash', 'crouch']) add(modelKey(side, 'stoss', pose), buildFigure(side, POSES[pose], { stoss: true }).build(0.18, 0.01))
      add(modelKey(side, 'mg', 'gun'), buildMG(side).build(0.15, 0.008))
      add(modelKey(side, 'fieldgun', 'gun'), buildFieldGun(side).build(0.15, 0.01))
      add(`${side}:base`, new Geo().merge(buildBaseTop(side)).merge(emblem(side)).build())
    }
    const tank = buildTank().build(0.1, 0.012)
    tintBelow(tank, 0.012, hex('#3a2c1f'), 0.75)
    add('BR:tank:hull', tank)
    add('DE:tank:hull', tank)
    add('BR:tankbase', new Geo().merge(buildBaseTop('BR', BASE_R, TANK_STRETCH)).merge(emblem('BR', BASE_R, TANK_STRETCH)).build())
    add('DE:tankbase', new Geo().merge(buildBaseTop('DE', BASE_R, TANK_STRETCH)).merge(emblem('DE', BASE_R, TANK_STRETCH)).build())
    const rim = buildRim(), tankRim = buildRim(BASE_R, TANK_STRETCH), pip = pipGeo()
    let verts = 0
    for (const g of models.values()) verts += g.getAttribute('position').count
    const MAX_I = Pieces.MAX_PIECES * 7
    this.enamel = new THREE.BatchedMesh(MAX_I, verts, 0, wornEnamel(mat('enamel'), 'pieces', 0.7))
    this.enamel.name = 'pieces-enamel'
    for (const [k, g] of models) this.register(k, g, this.enamel)
    const rimVerts = rim.getAttribute('position').count + tankRim.getAttribute('position').count + pip.getAttribute('position').count
    const ironMat = (mat('lead') as THREE.MeshStandardMaterial).clone()
    ironMat.color.set('#2f3033'); ironMat.name = 'iron'
    this.brass = new THREE.BatchedMesh(Pieces.MAX_PIECES * 6, rimVerts, 0, mat('brass'))
    this.iron = new THREE.BatchedMesh(Pieces.MAX_PIECES * 6, rimVerts, 0, ironMat)
    this.brass.name = 'pieces-brass'; this.iron.name = 'pieces-iron'
    for (const b of [this.brass, this.iron]) { this.register('rim', rim, b); this.register('tankrim', tankRim, b); this.register('pip', pip, b) }
    for (const b of [this.enamel, this.brass, this.iron]) { b.castShadow = true; b.receiveShadow = true; b.perObjectFrustumCulled = false; b.sortObjects = false; this.group.add(b) }

    // contact shadows, one soft decal per piece
    const sm = new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 })
    this.shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), sm, Pieces.MAX_PIECES)
    this.shadows.count = 0
    this.shadows.name = 'contact-shadows'
    this.shadows.renderOrder = 2
    this.group.add(this.shadows)
    // dug-in sandbags and bogged clods
    this.bags = new THREE.InstancedMesh(sandbagGeo(), mat('paintMatte'), Pieces.MAX_PIECES * Pieces.BAGS_PER)
    this.bags.count = 0; this.bags.castShadow = true; this.bags.receiveShadow = true; this.bags.name = 'dugin-bags'
    const cg = new Geo().add(new THREE.DodecahedronGeometry(1, 0), '#3b2c1e', { noise: 0.15, flat: true }).build()
    this.clods = new THREE.InstancedMesh(cg, mat('paintMatte'), Pieces.MAX_PIECES * Pieces.CLODS_PER)
    this.clods.count = 0; this.clods.castShadow = true; this.clods.name = 'bogged-clods'
    this.group.add(this.bags, this.clods)
    this.cues = new CuePoints(Pieces.MAX_PIECES * 10)
    this.group.add(this.cues.points)
    // selection: the selected piece's parts again, additive gold Fresnel
    this.fresnel = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
      vertexShader: /* glsl */`
        varying vec3 vN; varying vec3 vV;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vN; varying vec3 vV; uniform float uT;
        void main(){
          float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
          vec3 gold = vec3(1.0, 0.72, 0.28);
          gl_FragColor = vec4(gold * f * (1.1 + 0.35 * sin(uT * 4.0)), f);
          #include <colorspace_fragment>
        }`,
    })
    this.selGroup.name = 'selection'
    this.group.add(this.selGroup)
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: haloTexture(), color: '#ffc861', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }))
    this.halo.name = 'selection-halo'
    this.halo.visible = false
    this.halo.renderOrder = 5
    this.group.add(this.halo)
    const quad = new THREE.PlaneGeometry(1, 1.18)
    this.badgeCell = new THREE.InstancedBufferAttribute(new Float32Array(Pieces.MAX_PIECES * 2), 2)
    quad.setAttribute('aCell', this.badgeCell)
    this.badges = new THREE.InstancedMesh(quad, badgeMaterial(), Pieces.MAX_PIECES)
    this.badges.name = 'unit-badges'
    this.badges.count = 0
    this.badges.frustumCulled = false // billboards: the bounds of the unit quad mean nothing here
    this.badges.renderOrder = 7
    this.group.add(this.badges)
  }

  private register(key: string, geo: THREE.BufferGeometry, b: THREE.BatchedMesh): void {
    let e = this.geos.get(key)
    if (!e) { e = { geo, ids: new Map() }; this.geos.set(key, e) }
    e.ids.set(b, b.addGeometry(geo))
  }

  private addPart(p: Piece, key: string, b: THREE.BatchedMesh, local: THREE.Matrix4, figure = -1): Part {
    const e = this.geos.get(key)
    if (!e) throw new Error(`Pieces: no model ${key}`)
    const gid = e.ids.get(b)
    if (gid === undefined) throw new Error(`Pieces: model ${key} not in ${b.name}`)
    const part: Part = { id: b.addInstance(gid), batch: b, local, geo: e.geo, figure }
    p.parts.push(part)
    return part
  }

  // ------------------------------------------------------------------------------------------
  private create(u: Unit): Piece {
    if (this.pieces.size >= Pieces.MAX_PIECES) throw new Error(`Pieces: more than ${Pieces.MAX_PIECES} pieces`)
    const p: Piece = {
      unit: { ...u }, pos: new THREE.Vector3(), yaw: yawOf(u.facing), tilt: 0, lift: 0, rock: 0, squash: 1,
      parts: [], figs: [], pips: [], height: u.kind === 'rifle' || u.kind === 'stoss' ? 0.061 : u.kind === 'mg' ? 0.036 : 0.04,
      alive: true, bags: 0, clods: 0, topple: new Map(),
      phase: [...u.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7) / 997 * Math.PI * 2,
      march: 0, recoil: 0,
    }
    const tank = u.kind === 'tank'
    this.addPart(p, `${u.side}:${tank ? 'tankbase' : 'base'}`, this.enamel, new THREE.Matrix4())
    this.addPart(p, tank ? 'tankrim' : 'rim', u.side === 'BR' ? this.brass : this.iron, new THREE.Matrix4())
    const top = new THREE.Matrix4().makeTranslation(0, BASE_H, 0)
    // the weapons are exaggerated past the figures' x1.4 so they read from the commander's chair
    if (u.kind === 'mg') this.addPart(p, modelKey(u.side, 'mg', 'gun'), this.enamel, top.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.009)).multiply(new THREE.Matrix4().makeScale(1.45, 1.45, 1.45)))
    if (u.kind === 'fieldgun') this.addPart(p, modelKey(u.side, 'fieldgun', 'gun'), this.enamel, top.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.004)).multiply(new THREE.Matrix4().makeScale(1.15, 1.15, 1.15)))
    if (tank) {
      this.addPart(p, `${u.side}:tank:hull`, this.enamel, top.clone())
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.009
        p.pips.push(this.addPart(p, 'pip', u.side === 'BR' ? this.brass : this.iron, new THREE.Matrix4().makeTranslation(x, BASE_H - 0.0004, BASE_R * TANK_STRETCH - 0.0045)))
      }
    }
    const maxFigs = u.kind === 'rifle' ? 4 : u.kind === 'stoss' ? 3 : u.kind === 'mg' ? 3 : u.kind === 'fieldgun' ? 2 : 0
    const full = layout(u.kind, maxFigs)
    for (let i = 0; i < maxFigs; i++) {
      const kindKey = u.kind === 'stoss' ? 'stoss' : 'rifle'
      const part = this.addPart(p, modelKey(u.side, kindKey, full[i].pose), this.enamel, new THREE.Matrix4(), i)
      p.figs.push(part)
    }
    this.pieces.set(u.id, p)
    return p
  }

  private remove(id: string): void {
    const p = this.pieces.get(id)
    if (!p) return
    for (const part of p.parts) part.batch.deleteInstance(part.id)
    this.pieces.delete(id)
  }

  private figMatrix(kind: UnitKind, n: number, i: number): THREE.Matrix4 {
    const s = layout(kind, n)[i]
    if (!s) return new THREE.Matrix4().makeScale(0, 0, 0)
    // Figures stand 1.42x taller than their 5 cm spec (1.2x read as "small and hard to tell apart"
    // to an outside review at 1280x720). The base and the hex stay as they are, so only the people
    // grow; the gun crews a little, the guns and the tank already fill their bases.
    const k = kind === 'rifle' || kind === 'stoss' ? FIG_GROW : kind === 'mg' || kind === 'fieldgun' ? 1.15 : 1
    // and 12% broader than tall: a toy soldier's heroic build reads as a figure, not a stick, from
    // the chair (outside reviews: "clumpy blobs", "small and hard to tell apart")
    const wide = kind === 'rifle' || kind === 'stoss' ? 1.12 : 1
    return new THREE.Matrix4().compose(new THREE.Vector3(s.x, BASE_H, s.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw), new THREE.Vector3(k * wide, k, k * wide))
  }

  private place(p: Piece): void {
    const [x, z] = pieceSpot(p.unit.hex, this.terrain)
    p.pos.set(x, this.surface(x, z), z)
  }

  private layoutFigs(p: Piece): void {
    const n = Math.max(0, p.unit.str)
    p.figs.forEach((f, i) => { f.local.copy(this.figMatrix(p.unit.kind, n, i)) })
    p.pips.forEach((pp, i) => pp.batch.setVisibleAt(pp.id, i < n))
  }

  load(s: GameState, surface: Surface): void {
    for (const id of [...this.pieces.keys()]) this.remove(id)
    this.sync(s, surface)
  }

  sync(s: GameState, surface: Surface): void {
    this.tw.finishAll()
    this.surface = surface
    this.terrain = s.terrain
    this.phase = s.phase
    this.round = s.round
    this.human = s.human
    const live = new Set<string>()
    for (const u of s.units) {
      if (u.str <= 0) continue
      live.add(u.id)
      let p = this.pieces.get(u.id)
      if (p && p.unit.kind !== u.kind) { this.remove(u.id); p = undefined }
      if (!p) p = this.create(u)
      p.unit = { ...u }
      p.alive = true
      p.yaw = yawOf(u.facing)
      p.tilt = this.suppressed(u) ? 1 : 0
      p.lift = 0; p.rock = 0; p.squash = 1
      p.topple.clear()
      p.bags = u.dugIn ? 1 : 0
      p.clods = u.bogged ? 1 : 0
      this.place(p)
      this.layoutFigs(p)
      for (const f of p.figs) f.batch.setVisibleAt(f.id, f.figure < u.str)
    }
    for (const id of [...this.pieces.keys()]) if (!live.has(id)) this.remove(id)
    this.refresh()
  }

  private suppressed(u: Unit): boolean { return u.suppressedUntil >= this.round && u.suppressedUntil > 0 }

  resettle(surface: Surface): void {
    this.surface = surface
    for (const p of this.pieces.values()) this.place(p)
    this.refresh()
  }

  // ------------------------------------------------------------------------------------------
  // Matrices

  private pieceMatrix(p: Piece, out = new THREE.Matrix4()): THREE.Matrix4 {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)
    // suppressed: a 6 deg lean backward; rock: a roll while hopping
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tilt * THREE.MathUtils.degToRad(6), 0, p.rock)))
    return out.compose(p.pos.clone().add(new THREE.Vector3(0, p.lift, 0)), q, new THREE.Vector3(1, p.squash, 1))
  }

  private refresh(): void {
    const pm = new THREE.Matrix4(), m = new THREE.Matrix4()
    let si = 0, bi = 0, ci = 0
    const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1)
    for (const p of this.pieces.values()) {
      this.pieceMatrix(p, pm)
      for (const part of p.parts) {
        m.multiplyMatrices(pm, part.local)
        const k = part.figure >= 0 ? p.topple.get(part.figure) : undefined
        if (k !== undefined) m.multiply(toppleMatrix(k))
        else if (part.figure >= 0 && !this.reduced) m.multiply(swayMatrix(this.t, p.phase + part.figure * 1.9, p.march, p.recoil))
        part.batch.setMatrixAt(part.id, m)
      }
      // contact shadow stays on the ground, spreads and pales as the piece lifts
      if (si >= Pieces.MAX_PIECES) throw new Error('Pieces: contact-shadow pool overflow')
      const sc = (p.unit.kind === 'tank' ? 0.125 : 0.1) * (1 + p.lift * 12)
      m.compose(new THREE.Vector3(p.pos.x, p.pos.y + 0.0006, p.pos.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw), new THREE.Vector3(sc, 1, p.unit.kind === 'tank' ? sc * TANK_STRETCH * 0.9 : sc))
      this.shadows.setMatrixAt(si++, m)
      // sandbag ring
      if (p.bags > 0) {
        const n = Pieces.BAGS_PER
        for (let i = 0; i < n; i++) {
          if (bi >= this.bags.instanceMatrix.count) throw new Error('Pieces: sandbag pool overflow')
          const a = (i / 12) * Math.PI * 2 + (i >= 12 ? 0.26 : 0), course = i >= 12 ? 1 : 0
          const r = BASE_R + 0.0055
          const k = Math.min(1, Math.max(0, p.bags * 1.6 - i / n * 0.6))
          m.compose(new THREE.Vector3(p.pos.x + Math.cos(a) * r, p.pos.y + course * 0.0034 + (1 - k) * 0.02, p.pos.z + Math.sin(a) * r),
            q.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2 + ((i * 7) % 5 - 2) * 0.05, 0)), one.clone().multiplyScalar(k))
          this.bags.setMatrixAt(bi++, m)
          if (course === 0 && i >= 11) break
        }
      }
      if (p.clods > 0) {
        for (let i = 0; i < Pieces.CLODS_PER; i++) {
          if (ci >= this.clods.instanceMatrix.count) throw new Error('Pieces: clod pool overflow')
          const a = i * 2.4, r = (p.unit.kind === 'tank' ? 0.034 : 0.03) + (i % 3) * 0.004
          const s = (0.0022 + (i % 4) * 0.0007) * p.clods
          m.compose(new THREE.Vector3(p.pos.x + Math.cos(a) * r, p.pos.y + 0.001 + p.lift, p.pos.z + Math.sin(a) * r * 1.3), q.setFromEuler(new THREE.Euler(i, i * 2, 0)), new THREE.Vector3(s, s * 0.7, s))
          this.clods.setMatrixAt(ci++, m)
        }
      }
    }
    this.shadows.count = si; this.shadows.instanceMatrix.needsUpdate = true
    this.bags.count = bi; this.bags.instanceMatrix.needsUpdate = true
    this.clods.count = ci; this.clods.instanceMatrix.needsUpdate = true
    this.refreshSelection()
  }

  // ------------------------------------------------------------------------------------------
  // Animations (each resolves within its budget; play() computes `sec`)

  async move(id: string, path: HexId[], surface: Surface, sec: number): Promise<void> {
    this.surface = surface
    const p = this.pieces.get(id)
    if (!p) return
    const steps = path.length - 1
    p.unit.hex = path[path.length - 1]
    if (steps <= 0 || sec <= 0) { this.place(p); p.lift = 0; p.rock = 0; p.march = 0; this.refresh(); return }
    p.march = 1
    const pts = path.map((h, i) => {
      const [x, z] = i === steps ? pieceSpot(h, this.terrain) : [hexX(h), hexZ(h)]
      return new THREE.Vector3(x, surface(x, z), z)
    })
    await this.tw.run(sec, (k) => {
      const f = Math.min(steps - 1e-6, k * steps), i = Math.floor(f), t = f - i
      const a = pts[i], b = pts[Math.min(steps, i + 1)]
      const last = i === steps - 1
      const tt = last ? ease.inOut(t) : t
      p.pos.lerpVectors(a, b, tt)
      // A hop you can see from the commander's chair: at 1.4 cm (a quarter of a 5 cm figure) an
      // outside review could not tell a move from a snap. Half a figure high, a bigger rock, and a
      // squash on landing.
      p.lift = Math.sin(t * Math.PI) * 0.032 + (last && t > 0.8 ? (ease.outBack((t - 0.8) / 0.2) - 1) * -0.006 : 0)
      p.rock = Math.sin(k * steps * Math.PI * 2) * 0.14 * (1 - k * 0.5)
      p.squash = last && t > 0.85 ? 1 - Math.sin((t - 0.85) / 0.15 * Math.PI) * 0.12 : 1
      if (k >= 1) { p.pos.copy(pts[steps]); p.lift = 0; p.rock = 0; p.squash = 1; p.march = 0 }
      this.refresh()
    })
  }

  async pivot(id: string, facing: Dir, sec: number): Promise<void> {
    const p = this.pieces.get(id)
    if (!p) return
    p.unit.facing = facing
    const a0 = p.yaw
    let a1 = yawOf(facing)
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
    while (a1 - a0 < -Math.PI) a1 += Math.PI * 2
    await this.tw.run(sec, (k) => {
      p.yaw = a0 + (a1 - a0) * ease.outBack(k)
      p.lift = Math.sin(k * Math.PI) * 0.008
      if (k >= 1) { p.yaw = yawOf(facing); p.lift = 0 }
      this.refresh()
    })
  }

  async lunge(id: string, target: THREE.Vector3, sec: number): Promise<void> {
    const p = this.pieces.get(id)
    if (!p || sec <= 0) return
    const home = p.pos.clone()
    const to = home.clone().lerp(new THREE.Vector3(target.x, home.y, target.z), 0.38)
    await this.tw.run(sec, (k) => {
      const t = k < 0.45 ? ease.outCubic(k / 0.45) : 1 - ease.inOut((k - 0.45) / 0.55)
      p.pos.lerpVectors(home, to, t)
      p.lift = Math.sin(Math.min(1, k / 0.45) * Math.PI) * 0.01
      p.rock = t * 0.12
      if (k >= 1) { p.pos.copy(home); p.lift = 0; p.rock = 0 }
      this.refresh()
    })
  }

  async loseFigures(id: string, left: number, vfx: Vfx, sec: number): Promise<void> {
    const p = this.pieces.get(id)
    if (!p) return
    const before = p.unit.str
    p.unit.str = left
    const lost = p.figs.filter((f) => f.figure >= left && f.figure < before)
    const pm = this.pieceMatrix(p)
    const from = new Map(p.figs.map((f) => [f.figure, f.local.clone()]))
    const to = new Map(p.figs.map((f) => [f.figure, this.figMatrix(p.unit.kind, left, f.figure)]))
    if (sec > 0) {
      for (const f of lost) {
        const w = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(pm, f.local))
        vfx.inkBurst(w.add(new THREE.Vector3(0, 0.01, 0)), 10, new THREE.Color('#15110e'), 0.25, 0.0018, p.pos.y + 0.001)
      }
      if (p.unit.kind === 'tank') {
        for (let i = left; i < Math.min(4, before); i++) {
          const w = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(pm, p.pips[i].local))
          vfx.puff(w, new THREE.Color('#ffd27a'), 3, 0.012, 0.9, 0.4)
        }
      }
    }
    await this.tw.run(sec, (k) => {
      for (const f of lost) p.topple.set(f.figure, Math.min(1, k / 0.75))
      const m = Math.max(0, (k - 0.55) / 0.45)
      for (const f of p.figs) {
        if (f.figure >= left) continue
        const a = from.get(f.figure) as THREE.Matrix4, b = to.get(f.figure) as THREE.Matrix4
        f.local.copy(lerpMatrix(a, b, ease.inOut(m)))
      }
      if (k >= 1) {
        for (const f of lost) { p.topple.delete(f.figure); f.batch.setVisibleAt(f.id, false) }
        this.layoutFigs(p)
      }
      this.refresh()
    })
  }

  async destroy(id: string, vfx: Vfx, sec: number): Promise<void> {
    const p = this.pieces.get(id)
    if (!p) return
    if (sec > 0) {
      vfx.inkBurst(p.pos.clone().add(new THREE.Vector3(0, 0.006, 0)), 26, new THREE.Color('#15110e'), 0.35, 0.0026, p.pos.y + 0.001)
      await this.tw.run(sec, (k) => {
        for (const f of p.figs) if (f.figure < p.unit.str) p.topple.set(f.figure, Math.min(1, k * 1.5))
        p.squash = 1 - 0.8 * ease.inOut(Math.max(0, (k - 0.4) / 0.6))
        p.lift = -0.004 * k
        this.refresh()
      })
    }
    this.remove(id)
    this.refresh()
  }

  async stateCue(id: string, e: 'suppressed' | 'recovered' | 'dug-in' | 'bogged', sec: number): Promise<void> {
    const p = this.pieces.get(id)
    if (!p) return
    const top = p.pos.clone().add(new THREE.Vector3(0, p.height * 0.8, 0))
    if (e === 'suppressed') {
      p.unit.suppressedUntil = Math.max(p.unit.suppressedUntil, this.round + 1)
      p.unit.dugIn = false
      if (sec > 0) this.vfx.puff(top, new THREE.Color('#8e877c'), 7, 0.035, 0.7, 1.1)
      const b0 = p.bags
      await this.tw.run(sec, (k) => { p.tilt = ease.outBack(k); p.bags = b0 * (1 - k); this.refresh() })
      p.bags = 0
    } else if (e === 'recovered') {
      p.unit.suppressedUntil = 0
      await this.tw.run(sec, (k) => { p.tilt = 1 - ease.inOut(k); this.refresh() })
    } else if (e === 'dug-in') {
      p.unit.dugIn = true
      await this.tw.run(sec, (k) => { p.bags = k; this.refresh() })
    } else {
      p.unit.bogged = true
      if (sec > 0) this.vfx.inkBurst(p.pos.clone().add(new THREE.Vector3(0, 0.004, 0)), 12, new THREE.Color('#3b2c1e'), 0.25, 0.002, p.pos.y)
      await this.tw.run(sec, (k) => { p.clods = ease.outBack(k); this.refresh() })
    }
    this.refresh()
  }

  async rise(u: Unit, sec: number): Promise<void> {
    let p = this.pieces.get(u.id)
    if (!p) p = this.create(u)
    p.unit = { ...u }
    this.place(p)
    this.layoutFigs(p)
    for (const f of p.figs) f.batch.setVisibleAt(f.id, f.figure < u.str)
    if (sec > 0) this.vfx.inkBurst(p.pos.clone().add(new THREE.Vector3(0, 0.002, 0)), 20, new THREE.Color('#15110e'), 0.3, 0.0022, p.pos.y)
    await this.tw.run(sec, (k) => { p.squash = Math.max(0.02, ease.outBack(k)); p.lift = 0; this.refresh() })
    p.squash = 1
    this.refresh()
  }

  // ------------------------------------------------------------------------------------------
  select(id: string | null): void {
    if (id === this.selected) return
    this.selected = id
    this.refreshSelection()
  }

  private refreshSelection(): void {
    const p = this.selected ? this.pieces.get(this.selected) : undefined
    const want = p ? p.parts.filter((x) => x.batch.getVisibleAt(x.id)) : []
    while (this.selGroup.children.length > want.length) this.selGroup.remove(this.selGroup.children[this.selGroup.children.length - 1])
    while (this.selGroup.children.length < want.length) {
      const m = new THREE.Mesh(undefined, this.fresnel)
      m.matrixAutoUpdate = false
      m.renderOrder = 6
      this.selGroup.add(m)
    }
    if (!p) return
    const pm = this.pieceMatrix(p)
    want.forEach((part, i) => {
      const mesh = this.selGroup.children[i] as THREE.Mesh
      mesh.geometry = part.geo
      mesh.matrix.multiplyMatrices(pm, part.local).multiply(new THREE.Matrix4().makeScale(1.03, 1.03, 1.03))
      mesh.matrixWorldNeedsUpdate = true
    })
  }

  // ------------------------------------------------------------------------------------------
  private t = 0
  /** The firing piece's men kick back with the shot (decays over a quarter second in update()). */
  recoil(id: string): void { const p = this.pieces.get(id); if (p && !this.reduced) p.recoil = 1 }
  kindOf(id: string): UnitKind | null { return this.pieces.get(id)?.unit.kind ?? null }

  update(dt: number, t: number): void {
    this.t = t
    for (const p of this.pieces.values()) if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 4)
    this.fresnel.uniforms.uT.value = t
    const sel = this.selected ? this.pieces.get(this.selected) : undefined
    if (sel && !this.tw.busy) {
      // held in the hand: lifted, breathing
      const want = 0.012 + (this.reduced ? 0 : Math.sin(t * 2.2) * 0.0015)
      sel.lift += (want - sel.lift) * Math.min(1, dt * 12 || 1)
    }
    for (const p of this.pieces.values()) if (p !== sel && !this.tw.busy && p.lift > 0) p.lift = Math.max(0, p.lift - dt * 0.08)
    this.halo.visible = !!sel
    if (sel) {
      const r = BASE_R * 2 * 1.55
      this.halo.position.set(sel.pos.x, sel.pos.y + 0.0012, sel.pos.z)
      this.halo.rotation.y = sel.yaw
      this.halo.scale.set(r, 1, sel.unit.kind === 'tank' ? r * TANK_STRETCH : r)
      ;(this.halo.material as THREE.MeshBasicMaterial).opacity = this.reduced ? 0.9 : 0.75 + 0.2 * Math.sin(t * 3.1)
    }
    let nb = 0
    const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bs = new THREE.Vector3(BADGE, BADGE, BADGE), bp = new THREE.Vector3()
    for (const p of this.pieces.values()) {
      if (!p.alive || p.unit.str <= 0) continue
      bp.set(p.pos.x, p.pos.y + p.height + 0.016 + p.lift, p.pos.z)
      this.badges.setMatrixAt(nb, bm.compose(bp, bq, bs))
      this.badgeCell.setXY(nb, BADGE_KINDS.indexOf(p.unit.kind) + (p.unit.side === 'BR' ? 0 : BADGE_KINDS.length), Math.min(4, p.unit.str))
      nb++
    }
    this.badges.count = nb
    this.badges.instanceMatrix.needsUpdate = true
    this.badgeCell.needsUpdate = true
    this.refresh()
    this.cues.begin()
    for (const p of this.pieces.values()) {
      const u = p.unit
      const top = p.pos.clone().add(new THREE.Vector3(0, p.height + 0.008 + p.lift, 0))
      if (u.side === this.human && !u.ordered && this.phase === 'player-orders' && !this.suppressed(u)) {
        // gold wisp: sparks spiralling up over a piece that can still take an order
        for (let i = 0; i < 5; i++) {
          const ph = (this.reduced ? i * 0.2 : t * 0.45 + i * 0.2) % 1
          const a = ph * Math.PI * 4 + i * 1.3
          this.cues.add(top.x + Math.cos(a) * 0.009 * (1 - ph * 0.5), top.y + ph * 0.028, top.z + Math.sin(a) * 0.009 * (1 - ph * 0.5), 0.006 * (1 - ph * 0.6), 0.9 * Math.sin(ph * Math.PI), 1.0, 0.78, 0.32)
        }
      }
      if (this.suppressed(u)) {
        for (let i = 0; i < 4; i++) {
          const ph = (this.reduced ? i * 0.25 : t * 0.25 + i * 0.25) % 1
          this.cues.add(top.x + Math.sin(i * 2.1) * 0.01, top.y - 0.006 + ph * 0.016, top.z + Math.cos(i * 2.1) * 0.01, 0.018 + ph * 0.012, 0.5 * Math.sin(ph * Math.PI), 0.55, 0.53, 0.5)
        }
      }
    }
    this.cues.end()
  }

  // ------------------------------------------------------------------------------------------
  // Queries

  muzzle(id: string): THREE.Vector3 | null {
    const p = this.pieces.get(id)
    if (!p) return null
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)
    return p.pos.clone().add(new THREE.Vector3(0, p.unit.kind === 'rifle' || p.unit.kind === 'stoss' ? 0.035 : 0.017, 0)).addScaledVector(fwd, 0.03)
  }

  // Ray (sheet-local) against each piece's upright cylinder; the nearest hit's hex.
  pick(o: THREE.Vector3, d: THREE.Vector3, sheetY: number): HexId | null {
    let best = Infinity, hit: HexId | null = null
    const oy = o.y - sheetY
    for (const p of this.pieces.values()) {
      const r = p.unit.kind === 'tank' ? BASE_R * 1.2 : BASE_R
      const dx = o.x - p.pos.x, dz = o.z - p.pos.z
      const a = d.x * d.x + d.z * d.z, b = 2 * (dx * d.x + dz * d.z), c = dx * dx + dz * dz - r * r
      const disc = b * b - 4 * a * c
      if (a < 1e-12 || disc < 0) continue
      const sq = Math.sqrt(disc)
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        const y = oy + d.y * t
        if (t > 0 && y >= p.pos.y - 0.001 && y <= p.pos.y + p.height && t < best) { best = t; hit = p.unit.hex }
      }
      // the top cap
      if (d.y < 0) {
        const t = (p.pos.y + p.height - oy) / d.y
        const x = o.x + d.x * t - p.pos.x, z = o.z + d.z * t - p.pos.z
        if (t > 0 && x * x + z * z < r * r && t < best) { best = t; hit = p.unit.hex }
      }
    }
    return hit
  }

  // Sheet-local corner points of every visible part's bounds (for pieceScreenBox).
  outline(id: string): THREE.Vector3[] {
    const p = this.pieces.get(id)
    if (!p) return []
    const pm = this.pieceMatrix(p), m = new THREE.Matrix4(), out: THREE.Vector3[] = []
    for (const part of p.parts) {
      if (!part.batch.getVisibleAt(part.id)) continue
      if (!part.geo.boundingBox) part.geo.computeBoundingBox()
      const bb = part.geo.boundingBox as THREE.Box3
      m.multiplyMatrices(pm, part.local)
      for (let i = 0; i < 8; i++) out.push(new THREE.Vector3(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m))
    }
    return out
  }

  get count(): number { return this.pieces.size }
  has(id: string): boolean { return this.pieces.has(id) }
  worldOf(id: string): THREE.Vector3 | null { const p = this.pieces.get(id); return p ? p.pos.clone() : null }
}

// The men are alive on their bases: each figure shifts its weight about its feet, a degree or two,
// out of step with its neighbours (SPEC-AAA V-05; blind A/B: "miniatures are static").
// On the move they step out — a quick-march bob and roll, each man out of step — and on a shot
// they kick back with the rifle (SPEC-AAA V-05: march and fire).
const swayM = new THREE.Matrix4(), swayE = new THREE.Euler(), swayQ = new THREE.Quaternion()
const swayP = new THREE.Vector3(), swayS = new THREE.Vector3(1, 1, 1)
function swayMatrix(t: number, ph: number, march = 0, recoil = 0): THREE.Matrix4 {
  const step = Math.sin(t * 13 + ph)
  swayE.set(0.018 * Math.sin(t * 0.9 + ph * 1.3) + march * 0.05 * Math.abs(step) - recoil * 0.16,
    0.03 * Math.sin(t * 0.5 + ph * 0.7),
    0.024 * Math.sin(t * 1.25 + ph) + march * 0.08 * step)
  swayP.set(0, march * 0.0022 * Math.abs(step), 0)
  return swayM.compose(swayP, swayQ.setFromEuler(swayE), swayS)
}

// A lost figure falls over its heels (rotate about x at the feet), then sinks and shrinks away.
function toppleMatrix(k: number): THREE.Matrix4 {
  const fall = Math.min(1, k / 0.55), sink = Math.max(0, (k - 0.55) / 0.45)
  const a = ease.outCubic(fall) * Math.PI / 2 * 0.96
  const m = new THREE.Matrix4().makeRotationX(a)
  const s = 1 - sink * 0.98
  return new THREE.Matrix4().makeTranslation(0, -sink * 0.004, 0).multiply(m).multiply(new THREE.Matrix4().makeScale(s, s, s))
}

function lerpMatrix(a: THREE.Matrix4, b: THREE.Matrix4, k: number): THREE.Matrix4 {
  const pa = new THREE.Vector3(), qa = new THREE.Quaternion(), sa = new THREE.Vector3()
  const pb = new THREE.Vector3(), qb = new THREE.Quaternion(), sb = new THREE.Vector3()
  a.decompose(pa, qa, sa); b.decompose(pb, qb, sb)
  return new THREE.Matrix4().compose(pa.lerp(pb, k), qa.slerp(qb, k), sa.lerp(sb, k))
}

// Wisps and suppression puffs: a Points cloud rebuilt each frame.
class CuePoints {
  readonly points: THREE.Points
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly size: Float32Array
  private readonly alpha: Float32Array
  private n = 0
  private readonly cap: number
  constructor(cap: number) {
    this.cap = cap
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1))
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1))
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
        attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC;
        void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 900.0 / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        varying float vA; varying vec3 vC;
        void main(){ vec2 p = gl_PointCoord*2.0-1.0; float r = dot(p,p); if (r > 1.0) discard; float core = exp(-r * 5.0);
          gl_FragColor = vec4(vC * (1.0 + core * 1.6), vA * (1.0 - r) * (0.6 + core));
          #include <colorspace_fragment>
        }`,
    })
    this.points = new THREE.Points(g, m)
    this.points.frustumCulled = false
    this.points.renderOrder = 7
    this.points.name = 'state-cues'
  }
  begin(): void { this.n = 0 }
  add(x: number, y: number, z: number, s: number, a: number, r: number, g: number, b: number): void {
    if (this.n >= this.cap) throw new Error(`Pieces: cue pool (${this.cap}) overflow`)
    const i = this.n++
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b
    this.size[i] = s; this.alpha[i] = a
  }
  end(): void {
    const g = this.points.geometry
    for (const k of ['position', 'color', 'size', 'alpha']) g.getAttribute(k).needsUpdate = true
    g.setDrawRange(0, this.n)
  }
}

// The selection halo: a ring of gold light just outside the base, fading inward and outward.
function haloTexture(): THREE.Texture {
  const N = 128, data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2) // 0 centre, 1 edge
    const ring = Math.exp(-(((r - 0.68) / 0.11) ** 2)) + 0.25 * Math.max(0, 1 - r / 0.68)
    const o = (y * N + x) * 4
    data[o] = data[o + 1] = data[o + 2] = 255
    data[o + 3] = Math.round(255 * Math.min(1, ring) * (r < 1 ? 1 : 0))
  }
  const t = new THREE.DataTexture(data, N, N)
  t.needsUpdate = true
  return t
}

// ---- unit badges ------------------------------------------------------------------------------
const BADGE = 0.024 // metres across: ~20 px at the commander's chair
const BADGE_KINDS: UnitKind[] = ['rifle', 'mg', 'fieldgun', 'tank', 'stoss']
const CELL_W = 96, CELL_H = 112

// The atlas: columns = side × kind (British first), rows = men left (0-4).
function badgeAtlas(): THREE.CanvasTexture {
  const cols = BADGE_KINDS.length * 2, c = document.createElement('canvas')
  c.width = cols * CELL_W; c.height = 5 * CELL_H
  const g = c.getContext('2d')
  if (!g) throw new Error('Pieces: no 2D context for the unit badges')
  for (let col = 0; col < cols; col++) for (let str = 0; str < 5; str++) {
    const br = col < BADGE_KINDS.length, kind = BADGE_KINDS[col % BADGE_KINDS.length]
    const x0 = col * CELL_W, y0 = (4 - str) * CELL_H // row 0 at the bottom (uv.y grows upward)
    g.save(); g.translate(x0, y0)
    // heater shield
    const w = CELL_W - 10, h = CELL_H - 10
    g.beginPath(); g.moveTo(5, 5); g.lineTo(5 + w, 5); g.lineTo(5 + w, 5 + h * 0.55)
    g.quadraticCurveTo(5 + w, 5 + h * 0.9, CELL_W / 2, 5 + h); g.quadraticCurveTo(5, 5 + h * 0.9, 5, 5 + h * 0.55); g.closePath()
    g.fillStyle = br ? '#d8c48c' : '#9aa39a'; g.fill()
    g.lineWidth = 7; g.strokeStyle = br ? '#7a1f18' : '#141414'; g.stroke()
    // glyph
    g.strokeStyle = '#1b140c'; g.fillStyle = '#1b140c'; g.lineWidth = 7; g.lineCap = 'round'
    const cx = CELL_W / 2, cy = 42
    if (kind === 'rifle') { // crossed rifles
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx - 24 * s, cy + 22); g.lineTo(cx + 24 * s, cy - 22); g.stroke() }
    } else if (kind === 'mg') { // gun on a tripod
      g.beginPath(); g.moveTo(cx - 26, cy - 6); g.lineTo(cx + 26, cy - 6); g.stroke()
      g.fillRect(cx - 14, cy - 14, 16, 14)
      g.beginPath(); g.moveTo(cx - 6, cy - 2); g.lineTo(cx - 18, cy + 24); g.moveTo(cx - 6, cy - 2); g.lineTo(cx + 8, cy + 24); g.stroke()
    } else if (kind === 'fieldgun') { // wheel and barrel
      g.beginPath(); g.arc(cx - 6, cy + 8, 14, 0, Math.PI * 2); g.stroke()
      g.beginPath(); g.moveTo(cx - 6, cy + 8); g.lineTo(cx + 28, cy - 18); g.stroke()
    } else if (kind === 'tank') { // the rhomboid
      g.beginPath(); g.moveTo(cx - 30, cy + 12); g.lineTo(cx - 18, cy - 12); g.lineTo(cx + 24, cy - 12); g.lineTo(cx + 30, cy + 12); g.closePath(); g.stroke()
    } else { // Stoßtrupp: the stick grenade
      g.beginPath(); g.moveTo(cx - 20, cy + 20); g.lineTo(cx + 6, cy - 6); g.stroke()
      g.fillRect(cx + 2, cy - 22, 20, 20)
    }
    // one dot per man left
    for (let i = 0; i < str; i++) { g.beginPath(); g.arc(cx + (i - (str - 1) / 2) * 15, 82, 5.5, 0, Math.PI * 2); g.fill() }
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function badgeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uAtlas: { value: badgeAtlas() }, uGrid: { value: new THREE.Vector2(BADGE_KINDS.length * 2, 5) } },
    vertexShader: /* glsl */`
      attribute vec2 aCell;
      varying vec2 vUv; varying vec2 vCell;
      void main(){
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        c.xy += position.xy * s; // face the camera
        gl_Position = projectionMatrix * c;
        vUv = uv; vCell = aCell;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; uniform vec2 uGrid;
      varying vec2 vUv; varying vec2 vCell;
      void main(){
        vec4 t = texture2D(uAtlas, (vCell + vUv) / uGrid);
        if (t.a < 0.05) discard;
        gl_FragColor = vec4(t.rgb, t.a * 0.95);
        #include <colorspace_fragment>
      }`,
  })
}
