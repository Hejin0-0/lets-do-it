// Room building kit: a static batcher that merges fixed parts into one mesh per (material, cell),
// with world-space box-projected UVs so wood grain and stone courses keep the same texel density
// on every part, a per-part tint (vertex colour) and a per-vertex region tag used by the harness's
// brightness-order measurement. Cells keep each merged mesh's bounding sphere local, so frustum
// culling works (the commander view draws the table zone, not the whole hall) and only the table
// zone has to sit in the key light's per-frame shadow pass. Draw-call budget for the room: 120.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createSeededRandom } from '../utils/random.ts'

export { createSeededRandom }
export type Rng = () => number

/** Brightness-order regions (DESIGN §9): the harness renders these as flat ID colours. */
export const REGION = { other: 0, board: 1, margin: 2, floor: 3, shelves: 4, ceiling: 5 } as const
export type Region = (typeof REGION)[keyof typeof REGION]

type Axis = 0 | 1 | 2

/** 'auto' = a spatial cell from the part's centre; any other name is an explicit zone. */
export type Zone = 'auto' | 'table' | 'chandelier'

const _c = new THREE.Vector3(), _s = new THREE.Vector3()
/** Spatial cell of a part: 3 bays across, 4 along, below/above the gallery; long parts share one. */
function cellOf(bb: THREE.Box3): string {
  bb.getCenter(_c); bb.getSize(_s)
  if (Math.max(_s.x, _s.z) > 5) return 'long' + (_c.y > 3.3 ? 'H' : 'L')
  const xi = _c.x < -2.6 ? 'w' : _c.x > 2.6 ? 'e' : 'm'
  const zi = _c.z < -4.4 ? 0 : _c.z < -1.2 ? 1 : _c.z < 2.2 ? 2 : 3
  return xi + zi + (_c.y > 3.3 ? 'H' : 'L')
}

export class Batch {
  private readonly parts = new Map<string, THREE.BufferGeometry[]>()
  private readonly rng: Rng
  private readonly tiles: Record<string, [number, number]>
  /** Zone for the parts added next (builders set it; 'auto' = spatial cell). */
  zone: Zone = 'auto'
  /** Stats label for the parts added next; `tris` sums triangles per label. */
  tag = 'misc'
  readonly tris: Record<string, number> = {}
  constructor(tiles: Record<string, [number, number]>, seed = 7) {
    this.tiles = tiles
    this.rng = createSeededRandom(seed)
  }

  /**
   * Adds `geo` (consumed) under material `key`, transformed by `m`. `grain` is the world axis the
   * texture's u (wood grain) follows; by default the part's longest axis.
   */
  add(key: string, geo: THREE.BufferGeometry, m: THREE.Matrix4 | null, tint: THREE.ColorRepresentation = 0xffffff,
    region: Region = REGION.other, grain?: Axis): void {
    let g = geo.index ? geo.toNonIndexed() : geo
    if (g !== geo) geo.dispose()
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    if (!g.attributes.normal) g.computeVertexNormals()
    if (m) {
      g.applyMatrix4(m)
      if (m.determinant() < 0) g = flipWinding(g)
    }
    const pos = g.attributes.position as THREE.BufferAttribute
    const n = pos.count
    g.computeBoundingBox()
    const bb = g.boundingBox as THREE.Box3
    const size = bb.getSize(new THREE.Vector3())
    const ga: Axis = grain ?? (size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2)
    const [tu, tv] = this.tiles[key] ?? [1, 1]
    const ou = this.rng() * 7, ov = this.rng() * 7
    const uv = new Float32Array(n * 2)
    const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) p[k].fromBufferAttribute(pos, t + k)
      e1.subVectors(p[1], p[0]); e2.subVectors(p[2], p[0]); e1.cross(e2)
      const ax = Math.abs(e1.x), ay = Math.abs(e1.y), az = Math.abs(e1.z)
      const a: Axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
      const others = ([0, 1, 2] as Axis[]).filter((i) => i !== a)
      let ua: Axis, va: Axis
      if (ga !== a) { ua = ga; va = others[0] === ga ? others[1] : others[0] } else { ua = others[0]; va = others[1] }
      for (let k = 0; k < 3; k++) {
        uv[(t + k) * 2] = p[k].getComponent(ua) / tu + ou
        uv[(t + k) * 2 + 1] = p[k].getComponent(va) / tv + ov
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    const c = new THREE.Color(tint)
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aRegion', new THREE.BufferAttribute(new Float32Array(n).fill(region), 1))
    const k = key + '|' + (this.zone === 'auto' ? cellOf(bb) : this.zone)
    let list = this.parts.get(k)
    if (!list) { list = []; this.parts.set(k, list) }
    list.push(g)
    this.tris[this.tag] = (this.tris[this.tag] ?? 0) + n / 3
  }

  /** Axis-aligned box between two corners. */
  box(key: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    tint?: THREE.ColorRepresentation, region?: Region, grain?: Axis): void {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    this.add(key, g, null, tint, region, grain)
  }

  /** One mesh per (material, cell); mesh.userData.zone holds the cell or explicit zone name. */
  build(mats: Record<string, THREE.Material>): THREE.Mesh[] {
    const out: THREE.Mesh[] = []
    for (const [k, list] of this.parts) {
      const [key, zone] = k.split('|')
      const m = mats[key]
      if (!m) throw new Error(`Batch: no material for "${key}"`)
      const g = mergeGeometries(list, false)
      if (!g) throw new Error(`Batch: merge failed for "${k}"`)
      for (const l of list) l.dispose()
      g.computeBoundingSphere()
      const mesh = new THREE.Mesh(g, m)
      mesh.name = `batch:${key}:${zone}`
      mesh.userData.zone = zone
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      out.push(mesh)
    }
    this.parts.clear()
    return out
  }
}

function flipWinding(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name] as THREE.BufferAttribute
    const s = a.itemSize, arr = a.array as Float32Array
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < s; k++) {
      const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k
      const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp
    }
  }
  return g
}

// ---------------------------------------------------------------------------------------------
// Shapes

/** Matrix from translation, Euler rotation (radians, XYZ) and scale. */
export function T(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))
}

/**
 * Pointed (two-centred) arch polyline centred on x = 0, from the left springing (−w/2, spring)
 * over the apex to the right springing. `r` ≥ w/2; r = w is the equilateral gothic arch.
 */
export function archPts(w: number, spring: number, r = w, n = 12): THREE.Vector2[] {
  const h = w / 2
  const cl = r - h // centre of the LEFT arc lies to the right of the left springing
  const apexY = Math.sqrt(r * r - cl * cl)
  const a0 = Math.PI, a1 = Math.atan2(apexY, -cl)
  const left: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n)
    left.push(new THREE.Vector2(cl + Math.cos(a) * r, spring + Math.sin(a) * r))
  }
  const right = left.slice(0, -1).reverse().map((p) => new THREE.Vector2(-p.x, p.y))
  return [...left, ...right]
}

export function archRise(w: number, r = w): number {
  const cl = w / 2 - r
  return Math.sqrt(r * r - cl * cl)
}

/** Lancet outline (w wide, h tall to the apex, base at y = 0), counter-clockwise. */
export function lancetShape(w: number, h: number, r = w): THREE.Shape {
  const spring = h - archRise(w, r)
  const s = new THREE.Shape()
  s.moveTo(w / 2, 0)
  const pts = archPts(w, spring, r).reverse()
  for (const p of pts) s.lineTo(p.x, p.y)
  s.lineTo(-w / 2, 0)
  s.closePath()
  return s
}

/** The same outline as a hole path (clockwise). */
export function lancetPath(w: number, h: number, x = 0, y = 0, r = w): THREE.Path {
  const spring = h - archRise(w, r)
  const p = new THREE.Path()
  p.moveTo(x - w / 2, y)
  for (const q of archPts(w, y + spring, r)) p.lineTo(x + q.x, q.y)
  p.lineTo(x + w / 2, y)
  p.closePath()
  return p
}

/** A board of width w and height fh whose lower edge is a pointed arch rising archH (< fh). */
export function spandrelShape(w: number, fh: number, archH: number, r = w * 0.75): THREE.Shape {
  const k = archH / archRise(w, r)
  const s = new THREE.Shape()
  s.moveTo(-w / 2, fh)
  for (const p of archPts(w, 0, r)) s.lineTo(p.x, p.y * k)
  s.lineTo(w / 2, fh)
  s.closePath()
  return s
}

export function extrude(shape: THREE.Shape, depth: number, bevel = 0): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments: 10, steps: 1,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
  })
}

/** A band following a polyline in the XY plane (e.g. an arch rib), `t` wide, extruded `d` in z. */
export function ribAlong(pts: THREE.Vector2[], t: number, d: number): THREE.BufferGeometry {
  const inner: THREE.Vector2[] = [], outer: THREE.Vector2[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const tan = new THREE.Vector2().subVectors(b, a).normalize()
    const nrm = new THREE.Vector2(-tan.y, tan.x)
    inner.push(pts[i].clone().addScaledVector(nrm, -t / 2))
    outer.push(pts[i].clone().addScaledVector(nrm, t / 2))
  }
  const s = new THREE.Shape([...outer, ...inner.reverse()])
  return extrude(s, d)
}

export function lathe(profile: [number, number][], segs = 12): THREE.BufferGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), segs)
}

export function cyl(r0: number, r1: number, h: number, segs = 12): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, h, segs)
  g.translate(0, h / 2, 0)
  return g
}

/** Cylinder between two points (brass rods, chain rods, rails). */
export function rodBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, segs = 8): [THREE.BufferGeometry, THREE.Matrix4] {
  const len = a.distanceTo(b)
  const g = new THREE.CylinderGeometry(r, r, len, segs)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
  return [g, m]
}
