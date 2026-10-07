// The terrain kit on the sheet (DESIGN §9 "Terrain", "Buildings"): revetted trench walls,
// duckboards and parapet sandbags along every trench line; concertina wire (TubeGeometry helix +
// instanced barbs) on X pickets; the ruins, church, château, blockhouse, bridges and sluice;
// wax seals on the objectives; lingering gas. Repeated parts are instanced and every pool throws
// on overflow. Static buildings merge into one mesh.
import * as THREE from 'three'
import type { HexId, Side, Terrain } from '../contract/types.ts'
import { mat } from '../render/MaterialLibrary.ts'
import { Geo, hex } from '../assets/miniatures/geo.ts'
import { blockhouse, BRIDGE, bridge, chateau, church, ruin, sluice, town } from '../assets/miniatures/buildings.ts'
import type { RoofSpec } from '../assets/miniatures/buildings.ts'
import { TRENCH, wirePath } from './features.ts'
import { colOf, hexX, hexZ, N_HEX, rowOf } from './HexLayout.ts'
import { railLine, roadLines, sealSpot } from './MapPainter.ts'
import { hash01 } from './noise.ts'
import type { Relief } from './Relief.ts'
import { trenchY } from './Relief.ts'
import { ease } from './Vfx.ts'
import type { Tweens } from './Vfx.ts'

const T = TRENCH

// Rounded burlap pillow, 1 : 0.45 : 0.6 (digest recipe), exaggerated a little.
export function sandbagGeo(): THREE.BufferGeometry {
  return new Geo().add(new THREE.SphereGeometry(1, 6, 3).scale(0.0036, 0.0016, 0.0022).translate(0, 0.0014, 0), '#8c7652', { noise: 0.12 }).build()
}

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
function unitQuad(color: string): THREE.BufferGeometry {
  return new Geo().add(new THREE.PlaneGeometry(1, 1), color, { noise: 0.14 }).build()
}

// A cloth flag 28 x 18 mm hanging from its pole at x = 0, with a broad stripe and a little wave.
const FLAG_H = 0.068
function flagGeo(field: string, stripe: string): THREE.BufferGeometry {
  const wave = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    const p = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin(p.getX(i) * 260) * 0.0016 * (p.getX(i) / 0.028))
    return g
  }
  return new Geo()
    .add(wave(new THREE.PlaneGeometry(0.028, 0.018, 8, 1).translate(0.014, 0, 0)), field, { noise: 0.06 })
    .add(wave(new THREE.PlaneGeometry(0.028, 0.006, 8, 1).translate(0.014, 0, 0.0003)), stripe, { noise: 0.06 })
    .build()
}

function unitBox(color: string, noise = 0.1): THREE.BufferGeometry {
  return new Geo().add(new THREE.BoxGeometry(1, 1, 1), color, { noise, flat: true }).build()
}

class Pool {
  readonly mesh: THREE.InstancedMesh
  private n = 0
  private readonly m = new THREE.Matrix4()
  private readonly c = new THREE.Color()
  readonly cap: number
  constructor(geo: THREE.BufferGeometry, material: THREE.Material, cap: number, name: string, shadow = true) {
    this.cap = cap
    this.mesh = new THREE.InstancedMesh(geo, material, cap)
    this.mesh.name = name
    this.mesh.count = 0
    this.mesh.castShadow = shadow
    this.mesh.receiveShadow = true
  }
  add(p: THREE.Vector3, q: THREE.Quaternion, s: THREE.Vector3, tint = 1): void {
    if (this.n >= this.cap) throw new Error(`TerrainKit: ${this.mesh.name} pool (${this.cap}) overflow`)
    this.mesh.setMatrixAt(this.n, this.m.compose(p, q, s))
    this.mesh.setColorAt(this.n, this.c.setScalar(tint))
    this.n++
  }
  reset(): void { this.n = 0 }
  done(): void {
    this.mesh.count = this.n
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
    this.mesh.computeBoundingSphere()
  }
}

export class TerrainKit {
  readonly group = new THREE.Group()
  readonly roofs: RoofSpec[] = []
  private readonly relief: Relief
  private readonly terrain: Terrain[]
  private readonly wireMat: THREE.MeshStandardMaterial
  private wireMesh: THREE.Mesh | null = null
  private readonly barbs: Pool
  private readonly pickets: Pool
  private readonly sealBR: Pool
  private readonly poles: Pool
  private readonly flags: Record<'BR' | 'DE' | 'N', Pool>
  private readonly sealDE: Pool
  private readonly gas: THREE.Points
  private gasHexes: HexId[] = []
  private wireKey = ''
  private readonly tw: Tweens
  private cutAnim: { hex: HexId; k: number } | null = null
  private sealDrop = new Map<HexId, number>()
  private seals: { hex: HexId; holder: Side | null }[] = []
  private gasK = 1

  constructor(terrain: Terrain[], relief: Relief, tweens: Tweens) {
    this.terrain = terrain
    this.relief = relief
    this.tw = tweens
    this.group.name = 'terrain-kit'
    this.trenchKit()
    this.buildings()
    this.buildRoads()
    this.buildRailway()
    this.wireMat = new THREE.MeshStandardMaterial({ color: '#4a3d33', metalness: 0.65, roughness: 0.5, envMapIntensity: 0.8 })
    this.wireMat.name = 'wire'
    const barb = new Geo().add(new THREE.TetrahedronGeometry(0.0011), '#4a3d33', { flat: true }).build()
    this.barbs = new Pool(barb, this.wireMat, 2400, 'wire-barbs', false)
    const picket = new Geo()
      .at(new THREE.BoxGeometry(0.0011, 0.024, 0.0011), '#3a342d', [0, 0.0105, 0], [0, 0, 0.42], { noise: 0.1 })
      .at(new THREE.BoxGeometry(0.0011, 0.024, 0.0011), '#3a342d', [0, 0.0105, 0], [0, 0, -0.42], { noise: 0.1 })
      .build()
    this.pickets = new Pool(picket, this.wireMat, 160, 'wire-pickets')
    this.group.add(this.barbs.mesh, this.pickets.mesh)
    // wax seals
    const sealMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, envMapIntensity: 1.1 })
    sealMat.name = 'sealing-wax'
    this.sealBR = new Pool(sealGeo('BR'), sealMat, 8, 'seals-br')
    this.sealDE = new Pool(sealGeo('DE'), sealMat, 8, 'seals-de')
    this.group.add(this.sealBR.mesh, this.sealDE.mesh)
    // Objective flags: a pole at every seal with a pennant in the holder's colours (pale while
    // unheld), tall enough to find the objectives at a glance — an outside review found "the
    // bridges small and the objective markers faint".
    const flagMat = (mat('paintMatte') as THREE.MeshStandardMaterial).clone()
    flagMat.side = THREE.DoubleSide
    this.poles = new Pool(unitBox('#3a2a1c', 0.08), mat('paintMatte'), 8, 'flag-poles')
    this.flags = {
      BR: new Pool(flagGeo('#b3261e', '#ece4cf'), flagMat, 8, 'flags-br'),
      DE: new Pool(flagGeo('#1e1e1e', '#ece4cf'), flagMat, 8, 'flags-de'),
      N: new Pool(flagGeo('#e6dfca', '#b9ae92'), flagMat, 8, 'flags-open'),
    }
    this.group.add(this.poles.mesh, this.flags.BR.mesh, this.flags.DE.mesh, this.flags.N.mesh)
    // lingering gas: low yellow-green puffs
    const N = 12 * 12
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(N), 1))
    this.gas = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uK: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float seed; uniform float uT; uniform float uK; varying float vA;
        void main(){
          vec3 p = position + vec3(sin(uT * 0.4 + seed * 6.0) * 0.01, 0.006 + sin(uT * 0.7 + seed * 3.0) * 0.003, cos(uT * 0.33 + seed * 5.0) * 0.01);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = uK * (0.55 + 0.25 * sin(uT + seed * 9.0));
          gl_PointSize = (0.05 + 0.02 * seed) * 900.0 / max(0.05, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p); if (r > 1.0) discard;
          gl_FragColor = vec4(0.72, 0.74, 0.34, vA * (1.0 - r) * (1.0 - r) * 0.55);
          #include <colorspace_fragment>
        }`,
    }))
    this.gas.frustumCulled = false
    this.gas.renderOrder = 6
    this.gas.name = 'gas'
    g.setDrawRange(0, 0)
    this.group.add(this.gas)
  }

  dispose(): void {
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.Points).isPoints) m.geometry.dispose() })
  }

  // ------------------------------------------------------------------------------------------
  // Trenches: revetment planks + posts on the three wall faces, duckboards on the floor,
  // two courses of sandbags on the fire-step side parapet.

  private trenchKit(): void {
    const lines = this.relief.lines
    if (!lines.length) return
    // planks are single quads facing into the trench (their back is buried in the spoil)
    // ponytail: no shadows for the revetment planks, posts and duckboards — they sit inside the cut,
    // where the trench walls already shade them; the pass cost ~26k triangles a frame.
    const plank = new Pool(unitQuad('#6f5236'), mat('paintMatte'), 6000, 'revetments', false)
    const timber = new Pool(unitBox('#5c432c', 0.14), mat('paintMatte'), 1500, 'revetment-posts', false)
    const duck = new Pool(duckboardGeo(), mat('paintMatte'), 800, 'duckboards', false)
    const bags = new Pool(sandbagGeo(), mat('paintMatte'), 3000, 'parapet-sandbags')
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0)
    // wall faces: [lateral s of the face (+ toward enemy), bottom y, top y, which way it faces]
    const faces: [number, number, number, number][] = [
      [-T.half, T.floorY, 0.0012, 1], [T.half, T.floorY, T.stepY, -1], [T.step, T.stepY, 0.0014, -1],
    ]
    let seq = 0
    for (const l of lines) {
      const side = l.north ? 1 : -1
      for (let i = 0; i < l.pts.length - 1; i++) {
        const [ax, az] = l.pts[i], [bx, bz] = l.pts[i + 1]
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz)
        if (len < 1e-4) continue
        const tx = dx / len, tz = dz / len
        const nx = -tz * side, nz = tx * side // + toward the enemy
        q.setFromAxisAngle(up, Math.atan2(-tz, tx)) // box x along the segment
        const at = (u: number, s: number, y: number): THREE.Vector3 => {
          const x = ax + tx * u + nx * s, z = az + tz * u + nz * s
          return new THREE.Vector3(x, y + this.relief.baseAt(x, z), z)
        }
        // planks: horizontal boards, staggered joints
        const PL = 0.0118, rows = 0.0021
        for (const [s, y0, y1, dir] of faces) {
          const nRows = Math.max(1, Math.floor((y1 - y0) / rows))
          for (let r = 0; r < nRows; r++) {
            const off = (r % 2) * PL * 0.5
            for (let u = -off; u < len; u += PL) {
              const u0 = Math.max(0, u), u1 = Math.min(len, u + PL - 0.0004)
              if (u1 - u0 < 0.002) continue
              const tint = 0.8 + 0.4 * hash01(seq++, 3)
              // the quad faces local +z; turn it to face `dir` (in the lateral s direction)
              const qq = dir * side > 0 ? q : q.clone().multiply(FLIP)
              plank.add(at((u0 + u1) / 2, s + dir * 0.0003, y0 + rows * (r + 0.5)), qq, new THREE.Vector3(u1 - u0, rows * 0.86, 1), tint)
            }
          }
          // posts every other plank length
          for (let u = 0.003; u < len; u += PL * 1.5) timber.add(at(u, s + dir * 0.0007, (y0 + y1) / 2), q, new THREE.Vector3(0.0011, y1 - y0 + 0.001, 0.0011), 0.7)
        }
        // duckboards along the floor
        for (let u = 0.0085; u < len - 0.004; u += 0.0172) duck.add(at(u, 0, T.floorY + 0.0002), q, new THREE.Vector3(1, 1, 1), 0.85 + 0.3 * hash01(seq++, 5))
        // parapet sandbags: two bags deep, a second course in running bond
        const BL = 0.0074
        for (const [s, lift, stag] of [[T.step + 0.003, 0, 0], [T.step + 0.0076, -0.0006, 0.5], [T.step + 0.0052, 0.0025, 0.25]] as [number, number, number][]) {
          for (let u = BL * stag; u < len; u += BL) {
            const qq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, (hash01(seq, 9) - 0.5) * 0.18))
            bags.add(at(u, s, trenchY(s) + lift), qq, new THREE.Vector3(1, 0.92 + 0.16 * hash01(seq, 7), 1).multiplyScalar(0.94 + 0.12 * hash01(seq, 8)), 0.78 + 0.34 * hash01(seq++, 4))
          }
        }
      }
    }
    for (const p of [plank, timber, duck, bags]) { p.done(); this.group.add(p.mesh) }
  }

  // ------------------------------------------------------------------------------------------
  // The roads as raised, cambered gravel beds laid over their painted casing (docs/DIORAMA.md
  // "roads as raised cambered strips"): a 7 mm ribbon, crown 1.6 mm proud, darker shoulders, draped
  // on the relief and the bridge decks. One merged mesh.
  private buildRoads(): void {
    const pos: number[] = [], col: number[] = []
    const across: [number, number][] = [[-0.0037, 0.0003], [-0.0022, 0.0011], [0, 0.0016], [0.0022, 0.0011], [0.0037, 0.0003]]
    const shoulder = new THREE.Color('#8b7652'), crown = new THREE.Color('#cdb88b'), c = new THREE.Color()
    for (const line of roadLines(this.terrain)) {
      // resample every ~3 mm so the ribbon follows terraces and banks
      const pts: [number, number][] = [line[0]]
      for (let i = 1; i < line.length; i++) {
        const [ax, az] = line[i - 1], [bx, bz] = line[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.003))
        for (let k = 1; k <= n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n])
      }
      const rows = pts.map(([x, z], i) => {
        const [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)]
        const tl = Math.hypot(nx - px, nz - pz) || 1, ox = -(nz - pz) / tl, oz = (nx - px) / tl
        return across.map(([s, h]) => { const vx = x + ox * s, vz = z + oz * s; return [vx, this.relief.heightAt(vx, vz) + h, vz] })
      })
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < across.length - 1; j++) {
        const a = rows[i][j], b = rows[i][j + 1], d = rows[i + 1][j], e = rows[i + 1][j + 1]
        for (const [v, k] of [[a, j], [d, j], [b, j + 1], [b, j + 1], [d, j], [e, j + 1]] as const) {
          pos.push(v[0], v[1], v[2])
          c.copy(shoulder).lerp(crown, 1 - Math.abs(across[k][0]) / 0.0037)
          col.push(c.r, c.g, c.b)
        }
      }
    }
    if (!pos.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat('paintMatte'))
    m.name = 'roads'
    m.receiveShadow = true
    this.group.add(m)
  }

  // The light railway into Nieuwpoort (docs/DIORAMA.md): a ballast bed, a sleeper every 3 mm and two
  // steel rails at 3.2 mm gauge, all draped on the relief. One merged, vertex-coloured mesh.
  private buildRailway(): void {
    const line = railLine(this.terrain)
    if (!line) return
    const pos: number[] = [], col: number[] = []
    const ballast = new THREE.Color('#7b7166'), sleeper = new THREE.Color('#3b2b1f'), steel = new THREE.Color('#7a7c82')
    const quad = (p: number[][], c: THREE.Color): void => {
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(p[i][0], p[i][1], p[i][2]); col.push(c.r, c.g, c.b) }
    }
    const box = (cx: number, cz: number, y0: number, hw: number, hd: number, h: number, ox: number, oz: number, c: THREE.Color): void => {
      // a box hw across the track (along o) and hd along it, top and the two long sides
      const ax = -oz, az = ox // along the track
      const P = (s: number, t: number, y: number): number[] => [cx + ox * s + ax * t, y, cz + oz * s + az * t]
      const y1 = y0 + h
      quad([P(-hw, -hd, y1), P(hw, -hd, y1), P(hw, hd, y1), P(-hw, hd, y1)], c)
      quad([P(-hw, -hd, y0), P(-hw, -hd, y1), P(-hw, hd, y1), P(-hw, hd, y0)], c)
      quad([P(hw, hd, y0), P(hw, hd, y1), P(hw, -hd, y1), P(hw, -hd, y0)], c)
    }
    const pts: [number, number][] = [line[0]]
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.003))
      for (let k = 1; k <= n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n])
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i], [px, pz] = pts[Math.max(0, i - 1)], [nx, nz] = pts[Math.min(pts.length - 1, i + 1)]
      const tl = Math.hypot(nx - px, nz - pz) || 1, ox = (nz - pz) / tl, oz = -(nx - px) / tl // across the track
      const y = this.relief.heightAt(x, z)
      box(x, z, y, 0.0042, 0.0016, 0.0006, ox, oz, ballast) // the ballast bed, segment by segment
      box(x, z, y + 0.0006, 0.0033, 0.0006, 0.0005, ox, oz, sleeper)
      for (const s of [-0.0016, 0.0016]) box(x + ox * s, z + oz * s, y + 0.0011, 0.00028, 0.0016, 0.0007, ox, oz, steel)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat('paintMatte'))
    m.name = 'railway'
    m.receiveShadow = true
    this.group.add(m)
  }

  private buildings(): void {
    const all = new Geo()
    let n = 0
    for (let h = 0; h < N_HEX; h++) {
      const t = this.terrain[h]
      const cx = hexX(h), cz = hexZ(h)
      let b: { geo: Geo; roofs: RoofSpec[] } | null = null
      let m = new THREE.Matrix4()
      if (t === 'ruin' || t === 'church' || t === 'chateau' || t === 'blockhouse') {
        // the named ruins are towns (MapPainter's labels): Nieuwpoort with the Halle's belfry,
        // Lombartzijde without; the farm ('Hoeve') stays a single ruin
        const town_ = t === 'ruin' && (rowOf(h) > 4 || colOf(h) < 6)
        b = town_ ? town(h, rowOf(h) > 4) : t === 'ruin' ? ruin(h) : t === 'church' ? church() : t === 'chateau' ? chateau() : blockhouse()
        const z = cz - 0.036
        m = new THREE.Matrix4().makeTranslation(cx, this.relief.baseAt(cx, z) - 0.0006, z)
      } else if (t === 'bridge' || t === 'sluice') {
        b = t === 'bridge' ? bridge() : sluice()
        m = new THREE.Matrix4().makeTranslation(cx, 0, cz)
        const w = t === 'bridge' ? BRIDGE.width / 2 - 0.001 : 0.024
        const dz = t === 'bridge' ? BRIDGE.len / 2 : 0.058
        this.relief.addDeck(cx - w, cx + w, cz - dz, cz + dz, t === 'bridge' ? BRIDGE.deck : 0.004)
      }
      if (!b) continue
      all.merge(b.geo, m)
      for (const r of b.roofs) this.roofs.push(r)
      n++
    }
    if (!n) return
    const mesh = new THREE.Mesh(all.build(0.22, 0.012), mat('paintMatte'))
    mesh.name = 'buildings'
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
  }

  // ------------------------------------------------------------------------------------------
  // Wire: loaded wire that is still up is a full concertina; loaded wire that was cut shows two
  // sagging stubs. Rebuilt only when the set changes.

  setWire(wire: boolean[], loaded: boolean[]): void {
    const key = wire.map((w, h) => (w ? 'W' : loaded[h] ? 'c' : '.')).join('')
    if (key === this.wireKey && !this.cutAnim) return
    this.wireKey = key
    if (this.wireMesh) { this.group.remove(this.wireMesh); this.wireMesh.geometry.dispose(); this.wireMesh = null }
    this.barbs.reset(); this.pickets.reset()
    const parts: THREE.BufferGeometry[] = []
    const q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1)
    for (let h = 0; h < N_HEX; h++) {
      const up = wire[h], cut = !up && loaded[h]
      if (!up && !cut) continue
      const pts = wirePath(h)
      const anim = this.cutAnim?.hex === h ? this.cutAnim.k : up ? 0 : 1
      for (const piece of cut || anim > 0 ? [[0, 0.3], [0.7, 1]] : [[0, 1]]) {
        const curve = new Concertina(pts, (x, z) => this.relief.heightAt(x, z), h, piece[0], piece[1], anim)
        const segs = Math.round(150 * (piece[1] - piece[0]))
        parts.push(new THREE.TubeGeometry(curve, segs, 0.00042, 3, false))
        for (let i = 0; i < segs; i += 3) {
          const p = curve.getPoint(i / segs)
          q.setFromEuler(new THREE.Euler(i, i * 1.7, i * 0.3))
          this.barbs.add(p, q, s1)
        }
      }
      // X pickets at the ends and the middle
      for (const t of [0.06, 0.5, 0.94]) {
        const [x, z] = along(pts, t)
        const lean = anim > 0 && Math.abs(t - 0.5) < 0.1 ? 1.1 * Math.min(1, anim) : 0
        q.setFromEuler(new THREE.Euler(lean, t * 3 + h, 0))
        this.pickets.add(new THREE.Vector3(x, this.relief.heightAt(x, z) - 0.001, z), q, s1)
      }
    }
    this.barbs.done(); this.pickets.done()
    if (!parts.length) return
    const g = mergeTubes(parts)
    this.wireMesh = new THREE.Mesh(g, this.wireMat)
    this.wireMesh.name = 'wire'
    this.wireMesh.castShadow = false // hair-thin coils: their shadow is lost in the map's own ink (17k tris)
    this.group.add(this.wireMesh)
  }

  async cutWire(h: HexId, sec: number): Promise<void> {
    if (sec <= 0) return
    const was = this.wireKey
    await this.tw.run(sec, (k) => {
      this.cutAnim = { hex: h, k: ease.outCubic(k) }
      this.wireKey = '' // force a rebuild with the animated sag
      const w = was.split('').map((c) => c === 'W')
      const l = was.split('').map((c) => c !== '.')
      this.setWire(w, l)
    })
    this.cutAnim = null
  }

  // ------------------------------------------------------------------------------------------
  setSeals(objs: { hex: HexId; holder: Side | null }[]): void {
    this.seals = objs.map((o) => ({ hex: o.hex, holder: o.holder }))
    this.drawSeals()
  }

  private drawSeals(): void {
    this.sealBR.reset(); this.sealDE.reset()
    this.poles.reset(); this.flags.BR.reset(); this.flags.DE.reset(); this.flags.N.reset()
    const q = new THREE.Quaternion(), fq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1)
    for (const o of this.seals) {
      // the flag stands behind its seal, every objective, held or not
      const [fx, fz] = sealSpot(o.hex)
      const fy = this.relief.heightAt(fx + 0.007, fz - 0.004)
      this.poles.add(new THREE.Vector3(fx + 0.007, fy + FLAG_H / 2, fz - 0.004), fq.identity(), new THREE.Vector3(0.0024, FLAG_H, 0.0024))
      fq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.45 + hash01(o.hex, 23) * 0.3)
      this.flags[o.holder ?? 'N'].add(new THREE.Vector3(fx + 0.007, fy + FLAG_H - 0.0095, fz - 0.004), fq, one)
      if (!o.holder) continue
      const [x, z] = sealSpot(o.hex)
      const drop = this.sealDrop.get(o.hex) ?? 1
      const y = this.relief.heightAt(x, z) + (1 - drop) * 0.06
      const sq = drop < 1 ? 1 : 1
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(o.hex, 21) * 0.6 - 0.3)
      ;(o.holder === 'BR' ? this.sealBR : this.sealDE).add(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sq, drop > 0.92 ? 1 - (1 - drop) * 3 : 1, sq))
    }
    this.sealBR.done(); this.sealDE.done()
    this.poles.done(); this.flags.BR.done(); this.flags.DE.done(); this.flags.N.done()
  }

  async stampSeal(h: HexId, by: Side, sec: number): Promise<void> {
    const o = this.seals.find((x) => x.hex === h)
    if (o) o.holder = by
    else this.seals.push({ hex: h, holder: by })
    await this.tw.run(sec, (k) => {
      this.sealDrop.set(h, k < 0.7 ? ease.inOut(k / 0.7) * 0.93 : 0.93 + 0.07 * ease.outBack((k - 0.7) / 0.3))
      if (k >= 1) this.sealDrop.delete(h)
      this.drawSeals()
    })
  }

  // ------------------------------------------------------------------------------------------
  setGas(gas: number[]): void {
    this.gasHexes = []
    for (let h = 0; h < gas.length; h++) if (gas[h] > 0) this.gasHexes.push(h)
    const g = this.gas.geometry
    const pos = g.getAttribute('position') as THREE.BufferAttribute, seed = g.getAttribute('seed') as THREE.BufferAttribute
    let n = 0
    for (const h of this.gasHexes) {
      for (let i = 0; i < 9; i++) {
        if (n >= pos.count) throw new Error('TerrainKit: gas pool overflow')
        const a = i * 2.4 + h, r = 0.012 + (i % 3) * 0.013
        const x = hexX(h) + Math.cos(a) * r, z = hexZ(h) + Math.sin(a) * r
        pos.setXYZ(n, x, this.relief.heightAt(x, z), z)
        seed.setX(n, hash01(h * 9 + i, 33))
        n++
      }
    }
    pos.needsUpdate = true; seed.needsUpdate = true
    g.setDrawRange(0, n)
  }

  async billowGas(sec: number): Promise<void> {
    await this.tw.run(sec, (k) => { this.gasK = ease.outCubic(k) })
    this.gasK = 1
  }

  async riseFlood(mesh: THREE.Mesh | null, sec: number): Promise<void> {
    if (!mesh) return
    const y1 = mesh.position.y
    await this.tw.run(sec, (k) => { mesh.position.y = y1 - 0.006 * (1 - ease.outCubic(k)) })
    mesh.position.y = y1
  }

  update(_dt: number, t: number): void {
    const m = this.gas.material as THREE.ShaderMaterial
    m.uniforms.uT.value = t
    m.uniforms.uK.value = this.gasK
  }
}

// ---------------------------------------------------------------------------------------------
function along(pts: [number, number][], t: number): [number, number] {
  const L: number[] = [0]
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const d = t * L[L.length - 1]
  for (let i = 1; i < pts.length; i++) {
    if (d <= L[i]) {
      const k = (d - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1])
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]
    }
  }
  return pts[pts.length - 1]
}

// A concertina coil following a ground path: a helix of radius R whose loops lean and vary, the
// section [t0, t1] of the run, sagging flat by `sag` (0 up, 1 cut and trampled).
class Concertina extends THREE.Curve<THREE.Vector3> {
  private readonly pts: [number, number][]
  private readonly ground: (x: number, z: number) => number
  private readonly seed: number
  private readonly t0: number
  private readonly t1: number
  private readonly sag: number
  constructor(pts: [number, number][], ground: (x: number, z: number) => number, seed: number, t0: number, t1: number, sag: number) {
    super()
    this.pts = pts; this.ground = ground; this.seed = seed; this.t0 = t0; this.t1 = t1; this.sag = sag
  }
  getPoint(u: number, out = new THREE.Vector3()): THREE.Vector3 {
    const t = this.t0 + (this.t1 - this.t0) * u
    const [x, z] = along(this.pts, t)
    const [x2, z2] = along(this.pts, Math.min(1, t + 0.01))
    let dx = x2 - x, dz = z2 - z
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l
    const turns = 17, th = t * turns * Math.PI * 2
    const R = 0.0078 * (1 + 0.12 * Math.sin(t * 23 + this.seed))
    // the loops of real concertina overlap: advance jitter along the run
    const adv = Math.sin(th) * 0.0028
    const g = this.ground(x, z)
    const flat = 1 - 0.72 * this.sag
    out.set(x + dx * adv - dz * Math.cos(th) * R, g + R * flat + Math.sin(th) * R * flat, z + dz * adv + dx * Math.cos(th) * R)
    return out
  }
}

function mergeTubes(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let nv = 0, ni = 0
  for (const p of parts) { nv += p.getAttribute('position').count; ni += (p.getIndex() as THREE.BufferAttribute).count }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = new Uint32Array(ni)
  let ov = 0, oi = 0
  for (const p of parts) {
    const P = p.getAttribute('position') as THREE.BufferAttribute, N = p.getAttribute('normal') as THREE.BufferAttribute, I = p.getIndex() as THREE.BufferAttribute
    pos.set(P.array as Float32Array, ov * 3); nrm.set(N.array as Float32Array, ov * 3)
    for (let i = 0; i < I.count; i++) idx[oi + i] = I.getX(i) + ov
    ov += P.count; oi += I.count
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.computeBoundingSphere()
  return g
}

function duckboardGeo(): THREE.BufferGeometry {
  const g = new Geo()
  for (const s of [-1, 1]) g.at(new THREE.BoxGeometry(0.0165, 0.0007, 0.0008), '#5a4128', [0, 0.00035, s * 0.0027], [0, 0, 0], { noise: 0.1 })
  for (let i = 0; i < 5; i++) g.at(new THREE.BoxGeometry(0.0017, 0.0005, 0.0074), '#806043', [-0.0066 + i * 0.0033, 0.0009, 0], [0, 0, 0], { noise: 0.14 })
  return g.build()
}

// A blob of sealing wax with its impression: a roundel ring for the British, a cross for the Germans.
function sealGeo(side: Side): THREE.BufferGeometry {
  const g = new Geo()
  const wax = side === 'BR' ? hex('#9c2219') : hex('#26221f'), rim = side === 'BR' ? hex('#b83a2a') : hex('#3b3531')
  const prof: [number, number][] = [[0.0001, 0.0042]]
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push([0.0105 + Math.sin(a) * 0.0035, 0.0042 - (1 - Math.cos(a)) * 0.0042]) }
  prof.push([0.0001, 0])
  // splayed, irregular squeeze-out
  const blob = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20)
  const p = blob.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.12 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 11)
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k)
  }
  g.add(blob, wax, { noise: 0.05 })
  if (side === 'BR') {
    g.add(new THREE.TorusGeometry(0.0072, 0.0009, 5, 24).rotateX(Math.PI / 2).translate(0, 0.0043, 0), rim, { noise: 0.03 })
    g.add(new THREE.TorusGeometry(0.0038, 0.0008, 5, 20).rotateX(Math.PI / 2).translate(0, 0.0043, 0), rim, { noise: 0.03 })
    g.add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0012, 12).translate(0, 0.0045, 0), rim)
  } else {
    for (const r of [0, Math.PI / 2]) g.add(new THREE.BoxGeometry(0.013, 0.0012, 0.0032).rotateY(r).translate(0, 0.0045, 0), rim, { noise: 0.03 })
    g.add(new THREE.TorusGeometry(0.0085, 0.0007, 5, 24).rotateX(Math.PI / 2).translate(0, 0.0043, 0), rim)
  }
  return g.build()
}
