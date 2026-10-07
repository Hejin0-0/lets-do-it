// The sheet's third dimension (DESIGN §9 "Terrain"): a 256x212 heightfield under the painted map,
// real recessed zig-zag trenches (a swept revetted profile with floor, fire-step, ground and
// parapet planes), crater bowls holding water, and the sea, river and flood as separate glossy
// water surfaces sitting in carved beds. heightAt() is the one surface query the kit, the pieces
// and the overlays stand on, so everything agrees with the mesh.
import * as THREE from 'three'
import type { HexId, Terrain } from '../contract/types.ts'
import { BOARD_Y, hexX, hexZ, MAP_H, MAP_W, MOUNT_Y, N_HEX, nearestHex } from './HexLayout.ts'
import { cratersOf, distToPolyline, TRENCH, trenchLines } from './features.ts'
import type { Crater, P2 } from './features.ts'
import { blur, GH, GW, sampleField } from './fields.ts'
import type { Fields } from './fields.ts'
import { createNoise } from './noise.ts'
import { ZONE_LIST } from './zones.ts'

// 192 x 159 cells (6 mm): the 256 x 212 first cut cost 108k triangles a frame, and the terraces,
// crater bowls and beds still resolve at 6 mm (a bowl is ~7 cells across).
export const SEG_X = 192
export const SEG_Z = 159
export const WATER_Y = -0.0022

// Trench cross-section, lateral offset s (metres, + toward the enemy) -> height. Walls are
// vertical pairs, so the section has four distinct depth planes: floor, fire-step, ground, crest.
const T = TRENCH
export const TRENCH_PROFILE: [number, number][] = [
  [-T.outer - 0.003, -0.001], [-T.outer, 0], [-0.0135, 0.0036], [-T.half - 0.0014, 0.0024],
  [-T.half, 0.0018], [-T.half, T.floorY], [T.half, T.floorY], [T.half, T.stepY], [T.step, T.stepY],
  [T.step, 0.0021], [T.wall + 0.001, 0.0039], [T.parapet, T.crestY], [T.outer, 0], [T.outer + 0.003, -0.001],
]

// The land in real volume (docs/DIORAMA.md): the sheet's own cartographic elevation, so the
// painted contours sit on real hills. The polder (elev < 0.3) stays flat at 0; the Great Dune rises
// ~2-3.5 cm. Land eases to 0 within BANK of water so the banks, bridges and sluices keep the
// waterline, and each hex is levelled to a terrace out to TERRACE_IN so a base stands flat.
const RELIEF = 0.034
const BANK = 0.05
const TERRACE_IN = 0.036
const TERRACE_OUT = 0.05 // the hex's inradius: past it every hex blends to the same raw field
// The German rise (Lombartzyde): firm ground climbs toward the north edge, so their line looks
// down on the British one; the polder and the water stay at the waterline. And no-man's-land is
// churned into mud hummocks between the terraces. An outside review read the mid-board as "a flat
// painted mat" once the dunes stood up.
const RISE = 0.028 // was 0.016: the diorama pass (docs/DIORAMA.md) asks the German ridge to read as a ridge
const CHURN = 0.0035
// Shell holes deep enough to read at the commander's distance (were 6.2 mm with a 2.6 mm lip).
const CRATER_D = 0.0105
const CRATER_RIM = 0.0042
// The cut faces run from the frame's top (2.8 cm under the painted surface) to the highest dune;
// the strata texture spans exactly that height.
const SECTION_BASE = MOUNT_Y - BOARD_Y
const SECTION_SPAN = 0.095
export function trenchY(s: number): number {
  const P = TRENCH_PROFILE
  if (s <= P[0][0]) return P[0][1]
  for (let i = 0; i < P.length - 1; i++) {
    const [s0, y0] = P[i], [s1, y1] = P[i + 1]
    if (s >= s0 && s <= s1) return s1 - s0 < 1e-9 ? Math.max(y0, y1) : y0 + (y1 - y0) * (s - s0) / (s1 - s0)
  }
  return P[P.length - 1][1]
}

interface Line { pts: P2[]; north: boolean; minX: number; maxX: number; minZ: number; maxZ: number }

export class Relief {
  readonly group = new THREE.Group()
  readonly material: THREE.MeshStandardMaterial
  readonly lines: Line[]
  private readonly f: Fields
  private readonly terrace: Float32Array // each hex's level platform height
  private readonly firm: Float32Array // blurred mask: ground that takes the German rise
  private readonly mud: Float32Array // blurred mask: no-man's-land
  private readonly edge: THREE.Mesh
  private readonly edgeMat: THREE.MeshStandardMaterial
  private readonly edgeWater: THREE.Mesh
  private readonly sectionWaterMat: THREE.MeshStandardMaterial
  private readonly n = createNoise(17)
  private readonly geo: THREE.BufferGeometry
  private craters: Crater[] = []
  private readonly craterWater: THREE.InstancedMesh
  private readonly waterMats: THREE.MeshStandardMaterial[] = []
  private readonly ripple: THREE.Texture
  private flood: THREE.Mesh | null = null
  private readonly decks: { x0: number; x1: number; z0: number; z1: number; y: number }[] = []
  static readonly MAX_POOLS = 96

  constructor(terrain: Terrain[], fields: Fields, sheet: { color: HTMLCanvasElement; rough: HTMLCanvasElement; bump: HTMLCanvasElement }) {
    this.f = fields
    const firmZ = new Set(['deRear', 'nml', 'brRear', 'dune'].map((z) => ZONE_LIST.indexOf(z as (typeof ZONE_LIST)[number])))
    const nmlZ = ZONE_LIST.indexOf('nml')
    this.firm = Float32Array.from(fields.zone, (z) => (firmZ.has(z) ? 1 : 0))
    this.mud = Float32Array.from(fields.zone, (z) => (z === nmlZ ? 1 : 0))
    blur(this.firm, 8)
    blur(this.mud, 5)
    this.terrace = Float32Array.from({ length: N_HEX }, (_, h) => this.landAt(hexX(h), hexZ(h)))
    this.lines = trenchLines(terrain).map((l) => {
      const xs = l.pts.map((p) => p[0]), zs = l.pts.map((p) => p[1]), m = T.outer + 0.006
      return { ...l, minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minZ: Math.min(...zs) - m, maxZ: Math.max(...zs) + m }
    })
    for (let h = 0; h < terrain.length; h++) if (terrain[h] === 'crater') this.craters.push(...cratersOf(h))

    const map = new THREE.CanvasTexture(sheet.color)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    const rough = new THREE.CanvasTexture(sheet.rough)
    const bump = new THREE.CanvasTexture(sheet.bump)
    this.material = new THREE.MeshStandardMaterial({ map, roughnessMap: rough, bumpMap: bump, bumpScale: 0.0006, roughness: 1, metalness: 0 })
    this.material.name = 'board-sheet'

    // heightfield
    const g = new THREE.PlaneGeometry(MAP_W, MAP_H, SEG_X, SEG_Z)
    g.rotateX(-Math.PI / 2)
    this.geo = g
    this.refreshHeights()
    const relief = new THREE.Mesh(g, this.material)
    relief.name = 'relief'
    relief.receiveShadow = true
    // ponytail: no castShadow — the key hangs straight over the table, so the terraces threw almost
    // no visible shade and the shadow pass cost ~110k triangles (S2 882k of the 900k budget).
    this.group.add(relief)

    // The cut edge (docs/DIORAMA.md): where the land stands above the mount its section shows —
    // peat, blue clay, then laminated dune sand — instead of a dark gap under the sheet.
    this.edgeMat = new THREE.MeshStandardMaterial({ map: strataTexture(), roughness: 0.95, side: THREE.DoubleSide })
    this.edgeMat.name = 'board-section'
    this.sectionWaterMat = new THREE.MeshStandardMaterial({ color: '#2f5c5e', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.74, side: THREE.DoubleSide, envMapIntensity: 1.2 })
    this.sectionWaterMat.name = 'board-section-water'
    const sec = this.edgeGeometry()
    this.edge = new THREE.Mesh(sec.rock, this.edgeMat)
    this.edge.name = 'section'
    this.edge.receiveShadow = true
    this.edgeWater = new THREE.Mesh(sec.water, this.sectionWaterMat)
    this.edgeWater.name = 'section-water'
    this.edgeWater.renderOrder = 2
    this.group.add(this.edge, this.edgeWater)

    // trenches
    const tg = this.trenchGeometry()
    if (tg) {
      const tm = new THREE.Mesh(tg, this.material)
      tm.name = 'trenches'
      tm.receiveShadow = true
      tm.castShadow = true
      this.group.add(tm)
    }

    // water: sea / river as separate glossy surfaces in the carved beds
    this.ripple = rippleTexture()
    const seaI = ZONE_LIST.indexOf('sea'), riverI = ZONE_LIST.indexOf('river')
    // ONE surface for the sea and the Yser, its colour blended from a blurred river mask: as two
    // cell meshes their shared edge was a staircase of squares where the estuary meets the sea
    // (outside review).
    const riverness = Float32Array.from(this.f.zone, (z) => (z === riverI ? 1 : 0))
    blur(riverness, 5)
    // a touch less saturated than the first cut, which read as "very saturated teal, pasted on"
    const seaC = new THREE.Color('#244855'), riverC = new THREE.Color('#355f5d'), c = new THREE.Color()
    const water = this.waterMesh((z) => z === seaI || z === riverI, (x, z) => c.copy(seaC).lerp(riverC, sampleField(riverness, x, z)), 0.6)
    if (water) { water.name = 'water'; this.group.add(water) }

    // crater pools, one instance per bowl
    const disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2)
    const pm = this.waterMaterial('#2a3a2e', 0.82, 0.35) // crater pools: muddy, never a mirror (a staff-map view clipped one to white)
    this.craterWater = new THREE.InstancedMesh(disc, pm, Relief.MAX_POOLS)
    this.craterWater.name = 'crater-pools'
    this.craterWater.count = 0
    this.group.add(this.craterWater)
    this.refreshPools()
  }

  // ------------------------------------------------------------------------------------------
  // Heights

  private landAt(x: number, z: number): number {
    let y = Math.max(0, sampleField(this.f.elev, x, z) - 0.3) * RELIEF
    const north = Math.min(1, Math.max(0, (0.05 - z) / 0.38))
    y += RISE * sampleField(this.firm, x, z) * north * north * (3 - 2 * north)
    y += CHURN * sampleField(this.mud, x, z) * this.n.fbm(x * 45 + 3, z * 45 - 8, 2)
    const wd = sampleField(this.f.waterDist, x, z)
    if (wd < BANK) { const t = wd / BANK; y *= t * t * (3 - 2 * t) }
    return y
  }

  baseAt(x: number, z: number): number {
    const h = nearestHex(x, z), dc = Math.hypot(x - hexX(h), z - hexZ(h))
    let y = this.landAt(x, z)
    if (dc < TERRACE_OUT) {
      const t = Math.max(0, (dc - TERRACE_IN) / (TERRACE_OUT - TERRACE_IN)), k = t * t * (3 - 2 * t)
      y = this.terrace[h] * (1 - k) + y * k
    }
    y += 0.0004 * this.n.fbm(x * 40, z * 40, 2)
    // beds: signed distance to the waterline (negative in water); the floor under the relief is at
    // -BOARD_Y + 0.5 mm, so the deepest bed stops a hair above it
    const wd = sampleField(this.f.waterDist, x, z), ld = sampleField(this.f.landDist, x, z)
    if (ld > 0.0005) y = -0.0062 - 0.0058 * Math.min(1, ld / 0.03)
    else if (wd < 0.007) { const t = wd / 0.007; y = -0.0062 + (y + 0.0062) * t * t * (3 - 2 * t) }
    return y
  }

  private craterAt(x: number, z: number): number {
    let y = 0
    for (const c of this.craters) {
      const dx = x - c.x, dz = z - c.z
      if (Math.abs(dx) > c.r * 1.6 || Math.abs(dz) > c.r * 1.6) continue
      const p = Math.hypot(dx, dz) / c.r
      if (p < 1) y = Math.min(y, -CRATER_D * (c.r / 0.022) * (1 - p * p) + CRATER_RIM * Math.max(0, (p - 0.7) / 0.3) ** 2)
      else if (p < 1.55) y = Math.max(y, CRATER_RIM * (1 - ((p - 1) / 0.55)) ** 2)
    }
    return y
  }

  // Distance to the nearest trench centreline and the signed offset toward the enemy.
  trenchOffset(x: number, z: number): { d: number; s: number } | null {
    let best: { d: number; s: number } | null = null
    for (const l of this.lines) {
      if (x < l.minX || x > l.maxX || z < l.minZ || z > l.maxZ) continue
      const d = distToPolyline(x, z, l.pts)
      if (best && d >= best.d) continue
      // side: sign of the cross product on the closest segment
      let bi = 0, bd = Infinity
      for (let i = 0; i < l.pts.length - 1; i++) {
        const dd = distToPolyline(x, z, [l.pts[i], l.pts[i + 1]])
        if (dd < bd) { bd = dd; bi = i }
      }
      const [ax, az] = l.pts[bi], [bx, bz] = l.pts[bi + 1]
      const cross = (bx - ax) * (z - az) - (bz - az) * (x - ax) // > 0: south of an eastward run
      const south = cross > 0
      best = { d, s: (south === l.north ? 1 : -1) * d }
    }
    return best
  }

  // The heightfield alone (under the trench mesh it dips out of sight).
  private fieldAt(x: number, z: number): number {
    let y = this.baseAt(x, z) + this.craterAt(x, z)
    const t = this.trenchOffset(x, z)
    if (t && t.d < T.outer - 0.003) {
      const k = Math.min(1, (T.outer - 0.003 - t.d) / 0.004)
      y = y * (1 - k) + T.dip * k
    }
    return y
  }

  // The visible surface: trench profile where there is a trench, the field elsewhere.
  heightAt(x: number, z: number): number {
    for (const d of this.decks) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.y
    const t = this.trenchOffset(x, z)
    if (t && t.d < T.outer) return this.baseAt(x, z) + trenchY(t.s)
    return this.baseAt(x, z) + this.craterAt(x, z)
  }

  // Where a piece's base comes to rest: the highest surface point under its footprint.
  standY(x: number, z: number, r = 0.036): number {
    let y = this.heightAt(x, z)
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4
      y = Math.max(y, this.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r), this.heightAt(x + Math.cos(a) * r * 0.5, z + Math.sin(a) * r * 0.5))
    }
    return y
  }

  private refreshHeights(region?: { x0: number; x1: number; z0: number; z1: number }): void {
    const p = this.geo.getAttribute('position') as THREE.BufferAttribute
    const uv = this.geo.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      if (region && (x < region.x0 || x > region.x1 || z < region.z0 || z > region.z1)) continue
      p.setY(i, this.fieldAt(x, z))
      if (!region) uv.setXY(i, (x + MAP_W / 2) / MAP_W, 1 - (z + MAP_H / 2) / MAP_H)
    }
    p.needsUpdate = true
    uv.needsUpdate = true
    this.geo.computeVertexNormals()
    this.geo.computeBoundingSphere()
  }

  // The block's four cut faces, from the frame's top (SECTION_BASE in the sheet frame) up to the
  // heightfield's own edge vertices (same sample spacing as the PlaneGeometry, so the section
  // meets the sheet exactly); where the sea or the river reaches an edge, a pane of resin water
  // stands from the bed to the water line — the aquarium cut of a model-railway layout.
  private edgeGeometry(): { rock: THREE.BufferGeometry; water: THREE.BufferGeometry } {
    const pos: number[] = [], uvs: number[] = [], wpos: number[] = []
    const hw = MAP_W / 2, hh = MAP_H / 2
    const sides: [number, number, number, number, number][] = [
      [-hw, hh, hw, hh, SEG_X], [hw, -hh, -hw, -hh, SEG_X], [-hw, -hh, -hw, hh, SEG_Z], [hw, hh, hw, -hh, SEG_Z],
    ]
    const B = SECTION_BASE
    const v = (y: number): number => (y - B) / SECTION_SPAN
    const wet = (x: number, z: number): boolean => sampleField(this.f.landDist, x, z) > 0.0005
    let run = 0
    for (const [x0, z0, x1, z1, n] of sides) {
      const len = Math.hypot(x1 - x0, z1 - z0)
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n
        const xa = x0 + (x1 - x0) * a, za = z0 + (z1 - z0) * a, xb = x0 + (x1 - x0) * b, zb = z0 + (z1 - z0) * b
        const ya = this.fieldAt(xa, za), yb = this.fieldAt(xb, zb)
        const ua = (run + a * len) / 0.3, ub = (run + b * len) / 0.3
        for (const [x, y, z, u] of [[xa, B, za, ua], [xb, B, zb, ub], [xb, yb, zb, ub], [xa, B, za, ua], [xb, yb, zb, ub], [xa, ya, za, ua]]) {
          pos.push(x, y, z); uvs.push(u, v(y))
        }
        if (wet(xa, za) || wet(xb, zb)) {
          const ba = Math.min(ya, WATER_Y), bb = Math.min(yb, WATER_Y)
          for (const [x, y, z] of [[xa, ba, za], [xb, bb, zb], [xb, WATER_Y, zb], [xa, ba, za], [xb, WATER_Y, zb], [xa, WATER_Y, za]]) wpos.push(x, y, z)
        }
      }
      run += len
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.computeVertexNormals()
    const w = new THREE.BufferGeometry()
    w.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3))
    w.computeVertexNormals()
    return { rock: g, water: w }
  }

  // ------------------------------------------------------------------------------------------
  // Trench mesh: the profile swept along each crenellated centreline (mitred corners).

  private trenchGeometry(): THREE.BufferGeometry | null {
    const pos: number[] = [], uvs: number[] = []
    const P = TRENCH_PROFILE
    for (const l of this.lines) {
      const pts = l.pts, n = pts.length
      const side = l.north ? 1 : -1 // + lateral toward the enemy
      const rows: [number, number, number][][] = []
      for (let i = 0; i < n; i++) {
        const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)]
        let tx = next[0] - prev[0], tz = next[1] - prev[1]
        const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl
        let nx = -tz, nz = tx // normal pointing south of an eastward run
        let miter = 1
        if (i > 0 && i < n - 1) {
          const ax = pts[i][0] - prev[0], az = pts[i][1] - prev[1], al = Math.hypot(ax, az)
          const n0x = -az / al, n0z = ax / al
          miter = 1 / Math.max(0.5, n0x * nx + n0z * nz)
        }
        nx *= side * miter; nz *= side * miter
        rows.push(P.map(([s, y]) => {
          const x = pts[i][0] + nx * s, z = pts[i][1] + nz * s
          return [x, y + this.baseAt(x, z), z]
        }))
      }
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < P.length - 1; j++) {
          const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j + 1], d = rows[i + 1][j]
          // counter-clockwise seen from above: faces point up, walls face into the trench
          const quad = side > 0 ? [a, b, c, a, c, d] : [a, d, c, a, c, b]
          for (const v of quad) { pos.push(v[0], v[1], v[2]); uvs.push((v[0] + MAP_W / 2) / MAP_W, 1 - (v[2] + MAP_H / 2) / MAP_H) }
        }
      }
    }
    if (!pos.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.computeVertexNormals()
    return g
  }

  // ------------------------------------------------------------------------------------------
  // Water

  private waterMaterial(color: string, opacity: number, rough: number): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      // Floor at 0.2: at 0.06 the ripple normals scattered the chandelier key into pin-point glints
      // across the Yser, and bloom turned them into a white smear over E8 in the commander frame;
      // env 1.4 turned the yawed close view's river into a milky sheen of the lancets.
      color, roughness: Math.max(0.24, rough), metalness: 0, transparent: true, opacity, envMapIntensity: 0.85,
      normalMap: this.ripple, normalScale: new THREE.Vector2(0.12, 0.12), depthWrite: false,
    })
    m.name = 'water'
    this.waterMats.push(m)
    return m
  }

  // A surface over the cells of one water body, on a 128-grid; its edge tucks under the banks.
  // Vertex colour per point (a blend across bodies) and a vertex alpha from a blurred mask of the
  // body, so no cell's square corner shows where the water meets anything (the S3 flood has no
  // bank to tuck under at all).
  private waterMesh(match: (zone: number) => boolean, color: (x: number, z: number) => THREE.Color, opacity: number, y = WATER_Y): THREE.Mesh | null {
    const CW = 128, CH = 106, pos: number[] = [], uvs: number[] = [], cols: number[] = []
    const mask = Float32Array.from(this.f.zone, (z, i) => (match(z) && this.f.wet[i] === 1 ? 1 : 0))
    blur(mask, 2)
    const cw = MAP_W / CW, ch = MAP_H / CH
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      let hit = false
      for (let sj = 0; sj < 4 && !hit; sj++) for (let si = 0; si < 4 && !hit; si++) {
        const gx = Math.min(GW - 1, Math.floor((i * 4 + si) * GW / (CW * 4))), gy = Math.min(GH - 1, Math.floor((j * 4 + sj) * GH / (CH * 4)))
        hit = match(this.f.zone[gy * GW + gx]) && this.f.wet[gy * GW + gx] === 1
      }
      if (!hit) continue
      const x0 = -MAP_W / 2 + i * cw, z0 = -MAP_H / 2 + j * ch, x1 = x0 + cw, z1 = z0 + ch
      for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) {
        pos.push(x, y, z); uvs.push((x + MAP_W / 2) / MAP_W * 6, (z + MAP_H / 2) / MAP_H * 5)
        const k = color(x, z), m = sampleField(mask, x, z), a = Math.min(1, Math.max(0, (m - 0.2) / 0.4))
        // a pale line of foam where the water meets the bank
        const foam = Math.max(0, 1 - Math.abs(m - 0.55) * 5) * 0.45
        cols.push(k.r + (0.8 - k.r) * foam, k.g + (0.82 - k.g) * foam, k.b + (0.78 - k.b) * foam, a * a * (3 - 2 * a))
      }
    }
    if (!pos.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4))
    g.computeVertexNormals()
    const mat = this.waterMaterial('#ffffff', opacity, 0.06)
    mat.vertexColors = true
    const mesh = new THREE.Mesh(g, mat)
    mesh.renderOrder = 1
    return mesh
  }

  // Everything this sheet made for itself: geometry, its own materials and their textures (the
  // painted sheet's colour/roughness/bump canvases and the ripple normals). A reload used to free
  // only the geometry, and the renderer's texture count climbed by 4 on every load.
  dispose(): void {
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose() })
    for (const m of [this.material, this.edgeMat, this.sectionWaterMat, ...this.waterMats]) {
      for (const t of [m.map, m.roughnessMap, m.bumpMap, m.normalMap]) t?.dispose()
      m.dispose()
    }
  }

  setFlood(on: boolean, polderZone: (zone: number) => boolean): void {
    if (on && !this.flood) {
      const floodC = new THREE.Color('#34524a')
      this.flood = this.waterMesh(polderZone, () => floodC, 0.7, 0.0012)
      if (this.flood) { this.flood.name = 'flood'; this.group.add(this.flood) }
    } else if (!on && this.flood) {
      this.group.remove(this.flood); this.flood.geometry.dispose(); this.flood = null
    }
  }
  get floodMesh(): THREE.Mesh | null { return this.flood }

  // Materials whose geometry is in sheet coordinates (the overlays paint through these): the
  // sheet itself (relief + trenches) and the sea / river / flood surfaces, not the crater pools.
  overlayMaterials(): THREE.Material[] {
    const out: THREE.Material[] = [this.material]
    for (const n of ['water', 'flood']) {
      const m = this.group.getObjectByName(n) as THREE.Mesh | undefined
      if (m) out.push(m.material as THREE.Material)
    }
    return out
  }

  private refreshPools(): void {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    let k = 0
    for (const c of this.craters) {
      if (c.r < 0.012) continue
      if (k >= Relief.MAX_POOLS) throw new Error(`Relief: more than ${Relief.MAX_POOLS} crater pools`)
      const y = this.baseAt(c.x, c.z) - CRATER_D * (c.r / 0.022) * 0.62
      m.compose(new THREE.Vector3(c.x, y, c.z), q, new THREE.Vector3(c.r * 0.62, 1, c.r * 0.62))
      this.craterWater.setMatrixAt(k++, m)
    }
    this.craterWater.count = k
    this.craterWater.instanceMatrix.needsUpdate = true
    this.craterWater.computeBoundingSphere()
  }

  // A bridge or sluice deck pieces stand on (TerrainKit registers them).
  addDeck(x0: number, x1: number, z0: number, z1: number, y: number): void { this.decks.push({ x0, x1, z0, z1, y }) }

  hasCrater(h: HexId): boolean {
    const c0 = cratersOf(h)[0]
    return this.craters.some((c) => Math.abs(c.x - c0.x) < 1e-6 && Math.abs(c.z - c0.z) < 1e-6)
  }

  // A barrage lands: carve the bowls and fill them.
  stampCrater(h: HexId): void {
    if (this.hasCrater(h)) return
    const cs = cratersOf(h)
    this.craters.push(...cs)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const c of cs) { x0 = Math.min(x0, c.x - c.r * 1.7); x1 = Math.max(x1, c.x + c.r * 1.7); z0 = Math.min(z0, c.z - c.r * 1.7); z1 = Math.max(z1, c.z + c.r * 1.7) }
    this.refreshHeights({ x0, x1, z0, z1 })
    this.refreshPools()
    // a bowl on an edge hex cuts the section too
    const sec = this.edgeGeometry()
    this.edge.geometry.dispose(); this.edge.geometry = sec.rock
    this.edgeWater.geometry.dispose(); this.edgeWater.geometry = sec.water
  }

  update(t: number): void {
    this.ripple.offset.set(t * 0.004, t * 0.0025)
  }

  setWet(k: number): void {
    // rain: the varnish wets through, the paint darkens a touch
    this.material.roughness = 1 - 0.35 * k
    this.material.color.setScalar(1 - 0.12 * k)
  }
}

// The cut face's layers, v = 0 at the mount's top to v = 1 at 4 cm: peat, blue polder clay, then
// dune sand laid in thin laminations; boundaries wave a little. Tileable along u.
function strataTexture(): THREE.CanvasTexture {
  const W = 256, H = 128, n = createNoise(23)
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error('Relief: no 2D context for the strata texture')
  const img = g.createImageData(W, H)
  const PEAT = [46, 31, 20], CLAY = [86, 92, 100], SAND = [214, 186, 128]
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    // mm above the frame's top: the block's own geology, peat at its foot, the polder's blue clay,
    // then the dune sand laid down in thin beds up to the crests
    const a = px / W * Math.PI * 2, mm = (H - 1 - py) / H * SECTION_SPAN * 1000
    const w = mm + 0.9 * n.fbm(Math.cos(a) * 2 + 7, Math.sin(a) * 2 + mm * 0.04, 3)
    const base = w < 6 ? PEAT : w < 17 ? CLAY : SAND
    const lam = w >= 17 ? 0.88 + 0.12 * Math.sin(w * 1.1 + n(Math.cos(a) * 5, Math.sin(a) * 5)) : 1
    const k = lam * (0.92 + 0.08 * n(Math.cos(a) * 40 + mm * 3, Math.sin(a) * 40))
    const o = (py * W + px) * 4
    img.data[o] = base[0] * k; img.data[o + 1] = base[1] * k; img.data[o + 2] = base[2] * k; img.data[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}

// Seeded ripple normal map (tileable), for the resin-glossy water.
function rippleTexture(): THREE.Texture {
  const N = 128, n = createNoise(41), data = new Uint8Array(N * N * 4)
  const h = (x: number, y: number): number => {
    const u = x / N * Math.PI * 2, v = y / N * Math.PI * 2
    return 0.5 * Math.sin(u * 3 + Math.sin(v * 2) * 1.5) + 0.35 * Math.sin(v * 5 + u) + 0.25 * n(Math.cos(u) * 3 + 5, Math.sin(v) * 3 + 5)
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1)
    const len = Math.hypot(dx, dy, 1)
    const o = (y * N + x) * 4
    data[o] = (-dx / len * 0.5 + 0.5) * 255; data[o + 1] = (-dy / len * 0.5 + 0.5) * 255; data[o + 2] = (1 / len * 0.5 + 0.5) * 255; data[o + 3] = 255
  }
  const t = new THREE.DataTexture(data, N, N)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}
