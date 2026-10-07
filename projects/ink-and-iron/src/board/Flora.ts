// The layout's flora (docs/DIORAMA.md "painted woods -> real volume"): Lombardy poplars in rows
// along the painted roads (the Flanders silhouette), orchard trees behind the German line, hedgerows
// and a few hedgerow oaks behind the British, pollard willows on the Yser bank and the polder
// ditches, marram tufts on the dunes and, in no-man's-land, only shattered branchless stumps.
// Every plant is one instance of seven lead-miniature prototypes (Geo, worn enamel over matte paint,
// a flock disc for its foot) in ONE BatchedMesh, so the whole landscape is a single draw call. No
// castShadow: the key hangs over the table and the shadow pass would double the triangles (Relief
// dropped its own for the same reason); the flock disc is the tree's shade.
//
// Placement is pure and seeded (planFlora), so the painter drops its printed canopy under every 3D
// tree (no double trees) and a reload plants the same wood. The game comes first:
//   - nothing within 43 mm of a hex centre or a building hex's piece spot (a base is 41 mm plus a
//     1.1 mm rim), on a trench corridor, crater spoil, water, a road, wire, a bridge, a sluice or a
//     building, and nothing touching a trench / crater / ruin / church / château / blockhouse /
//     bridge / sluice hex;
//   - the camera looks north, so a plant just SOUTH of a piece hides it: every plant's height is
//     capped until its silhouette, projected onto the sheet from the commander's and the close
//     chair, stays off each piece's 36 mm figure disc (and the intent roundel floating over it), the
//     wax seals, the objectives' names and the margin letters. Tall trees therefore survive only in
//     the road margins and the column-gap corridors through the slanted edges' midpoints, the one
//     place a slim crown clears the pieces to either side.
import * as THREE from 'three'
import { COLS, ROWS } from '../contract/types.ts'
import type { HexId, Terrain } from '../contract/types.ts'
import { mat } from '../render/MaterialLibrary.ts'
import { Geo, lathe, wornEnamel } from '../assets/miniatures/geo.ts'
import { cratersOf, distToPolyline, isBuilding, pieceSpot, TRENCH, trenchLines, wirePath } from './features.ts'
import type { P2 } from './features.ts'
import { GH, GW, sampleField } from './fields.ts'
import type { Fields } from './fields.ts'
import { BOARD_Y, DX, HEX, hexFromXZ, hexX, hexZ, MAP_H, MAP_W, N_HEX, nearestHex, neighbors } from './HexLayout.ts'
import { railLine, roadLines, sealSpot } from './MapPainter.ts'
import { hash01 } from './noise.ts'
import type { Relief } from './Relief.ts'
import { ZONE_LIST } from './zones.ts'
import type { Zone } from './zones.ts'

export type Kind = 'poplar' | 'tree' | 'bush' | 'willow' | 'hedge' | 'tuft' | 'stump'
const KINDS: Kind[] = ['poplar', 'tree', 'bush', 'willow', 'hedge', 'tuft', 'stump']

export interface Plant {
  kind: Kind
  x: number
  z: number
  r: number // footprint radius (a hedge: half its length)
  h: number // height, metres
  len: number // a hedge's length (0 for the rest)
  yaw: number
  tint: [number, number, number]
}

// Each prototype's modelled height and crown radius; `min` is the shortest it may be planted (a
// poplar capped below 3 cm is not a poplar, it is dropped).
const PROTO: Record<Kind, { h: number; r: number; min: number }> = {
  poplar: { h: 0.05, r: 0.0053, min: 0.03 },
  tree: { h: 0.0205, r: 0.0064, min: 0.012 },
  bush: { h: 0.0066, r: 0.0051, min: 0.004 },
  willow: { h: 0.019, r: 0.0068, min: 0.011 },
  hedge: { h: 0.007, r: 0.0035, min: 0.0045 },
  tuft: { h: 0.009, r: 0.0036, min: 0.004 },
  stump: { h: 0.021, r: 0.003, min: 0.008 },
}
const HEDGE_L = 0.042
const KEEP = 0.043
const FORBID = new Set<Terrain>(['trench', 'crater', 'ruin', 'church', 'chateau', 'blockhouse', 'bridge', 'sluice'])

// CameraRig STOPS.commander (45 deg, 1.95 m) and .close (52 deg, 1.15 m), both aimed at z = 0.06
// on the tabletop, in the sheet's frame.
const chair = (pitch: number, dist: number): THREE.Vector3 => {
  const p = THREE.MathUtils.degToRad(pitch)
  return new THREE.Vector3(0, dist * Math.sin(p) - BOARD_Y, 0.06 + dist * Math.cos(p))
}
const CAMS = [chair(45, 1.95), chair(52, 1.15)]

// ---------------------------------------------------------------------------------------------
// Placement

// Where a plant stands for the keep-outs: one disc, or three along a hedge.
function samples(p: { kind: Kind; x: number; z: number; h: number; len: number; yaw: number }): [number, number, number][] {
  const s = p.h / PROTO[p.kind].h, r = PROTO[p.kind].r * s
  if (p.kind !== 'hedge') return [[p.x, p.z, r]]
  const e = p.len / 2 - r, dx = Math.cos(p.yaw) * e, dz = -Math.sin(p.yaw) * e // the model's +x after the yaw
  return [[p.x - dx, p.z - dz, r], [p.x, p.z, r], [p.x + dx, p.z + dz, r]]
}

type Gate = (x: number, z: number, r: number) => boolean

function gates(terrain: Terrain[], f: Fields, wire: boolean[]): Gate {
  const box = (pts: P2[], m: number): { pts: P2[]; x0: number; x1: number; z0: number; z1: number } => ({
    pts, x0: Math.min(...pts.map((p) => p[0])) - m, x1: Math.max(...pts.map((p) => p[0])) + m,
    z0: Math.min(...pts.map((p) => p[1])) - m, z1: Math.max(...pts.map((p) => p[1])) + m,
  })
  const lines = [
    ...trenchLines(terrain).map((l) => ({ ...box(l.pts, 0.04), w: TRENCH.outer + 0.001 })),
    ...roadLines(terrain).map((l) => ({ ...box(l, 0.02), w: 0.0045 })), // the cased road is 6.2 mm wide
    ...[railLine(terrain)].flatMap((l) => (l ? [{ ...box(l, 0.02), w: 0.0055 }] : [])), // the light railway's ballast
    ...terrain.flatMap((_, h) => (wire[h] ? [{ ...box(wirePath(h), 0.03), w: 0.012 }] : [])), // concertina R 7.8 mm
  ]
  const craters = terrain.flatMap((t, h) => (t === 'crater' ? cratersOf(h) : []))
  const spots = terrain.map((_, h) => pieceSpot(h, terrain))
  const decks = terrain.flatMap((t, h) => (t === 'bridge' || t === 'sluice' ? [h] : []))
  const houses = terrain.flatMap((t, h) => (isBuilding(t) ? [h] : []))
  return (x, z, r) => {
    if (Math.abs(x) > MAP_W / 2 - r - 0.002 || Math.abs(z) > MAP_H / 2 - r - 0.002) return false
    if (sampleField(f.waterDist, x, z) < r + 0.002) return false
    const n = nearestHex(x, z)
    for (const h of [n, ...neighbors(n)]) {
      if (Math.hypot(x - hexX(h), z - hexZ(h)) < KEEP + r) return false
      if (Math.hypot(x - spots[h][0], z - spots[h][1]) < KEEP + r) return false
    }
    if (touches(x, z, r, (h) => FORBID.has(terrain[h]))) return false
    for (const c of craters) if (Math.hypot(x - c.x, z - c.z) < c.r * 1.55 + r) return false
    for (const h of decks) if (Math.abs(x - hexX(h)) < 0.032 + r && Math.abs(z - hexZ(h)) < 0.085 + r) return false
    // a building stands along the north edge of its hex and reaches into the one above
    for (const h of houses) if (Math.abs(x - hexX(h)) < 0.046 + r && z > hexZ(h) - 0.078 - r && z < hexZ(h) + r) return false
    for (const l of lines) {
      if (x < l.x0 || x > l.x1 || z < l.z0 || z > l.z1) continue
      if (distToPolyline(x, z, l.pts) < l.w + r) return false
    }
    return true
  }
}

// Does a disc's footprint (centre and four rim points) lie on a hex matching `f`?
function touches(x: number, z: number, r: number, f: (h: HexId) => boolean): boolean {
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const h = hexFromXZ(x + dx, z + dz)
    if (h !== null && f(h)) return true
  }
  return false
}

// What must never be hidden behind a plant: a disc on the sheet, standing `h` tall.
interface Guard { x: number; z: number; y: number; r: number; h: number }

function guardsOf(terrain: Terrain[], objectives: HexId[], ground: (x: number, z: number) => number): Guard[] {
  const out: Guard[] = []
  for (let h = 0; h < N_HEX; h++) {
    if (terrain[h] === 'river' || terrain[h] === 'sea') continue // impassable: no piece, no intent
    const [x, z] = pieceSpot(h, terrain)
    // the figures stand inside 36 mm and 52 mm tall; an intent's roundel and damage tag float over
    // the hex at 82 mm (Overlays.buildGlyphs), 61 mm across
    const y = ground(x, z)
    out.push({ x, z, y, r: 0.036, h: 0.055 }, { x: hexX(h) + 0.0055, z: hexZ(h) - 0.004, y: y + 0.065, r: 0.031, h: 0.035 })
  }
  for (const h of objectives) {
    const [x, z] = sealSpot(h), y = ground(x, z)
    out.push({ x, z, y, r: 0.016, h: 0.008 })
    for (const dx of [-0.032, -0.012, 0.008]) out.push({ x: x + dx, z: z + 0.018, y, r: 0.009, h: 0 }) // its name
  }
  for (let c = 0; c < COLS; c++) for (const s of [-1, 1]) out.push({ x: hexX(c), z: s * (MAP_H / 2 + 0.0165), y: 0, r: 0.01, h: 0 })
  for (let r = 0; r < ROWS; r++) for (const s of [-1, 1]) out.push({ x: s * (MAP_W / 2 + 0.0165), z: hexZ(r * COLS), y: 0, r: 0.009, h: 0 })
  return out
}

// A point `y` above the sheet, seen from chair `c`, lands on the sheet here.
function onSheet(c: THREE.Vector3, x: number, y: number, z: number): P2 {
  const k = c.y / (c.y - y)
  return [c.x + (x - c.x) * k, c.z + (z - c.z) * k]
}

function segDist(a: P2, b: P2, c: P2, d: P2): number {
  const o = (p: P2, q: P2, r: P2): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return 0
  return Math.min(distToPolyline(a[0], a[1], [c, d]), distToPolyline(b[0], b[1], [c, d]), distToPolyline(c[0], c[1], [a, b]), distToPolyline(d[0], d[1], [a, b]))
}

// The tallest a plant of crown radius r standing at (x, y0, z) may be, up to `want`, so that from
// either chair its silhouette (trunk foot to crown top, projected on the sheet, r wide) never
// overlaps a guard nearer the back of the table than it. 0 if even its foot lies on one.
function capHeight(x: number, z: number, y0: number, r: number, want: number, guards: Guard[]): number {
  let top = want
  for (const c of CAMS) {
    const dt = Math.hypot(x - c.x, z - c.z)
    for (const g of guards) {
      if (Math.abs(g.x - x) > 0.2 || Math.abs(g.z - z) > 0.25) continue
      if (dt >= Math.hypot(g.x - c.x, g.z - c.z)) continue // behind the guard: the guard is drawn over it
      const ga = onSheet(c, g.x, g.y, g.z), gb = onSheet(c, g.x, g.y + g.h, g.z), foot = onSheet(c, x, y0, z)
      const hits = (h: number): boolean => segDist(foot, onSheet(c, x, y0 + h, z), ga, gb) < r + g.r
      if (!hits(top)) continue
      let lo = 0, hi = top
      for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (hits(m)) hi = m; else lo = m }
      top = hits(lo) ? 0 : lo
    }
  }
  return top
}

function fit(p: Plant, guards: Guard[], ground: (x: number, z: number) => number): number {
  let h = p.h
  for (const [x, z, r] of samples(p)) h = Math.min(h, capHeight(x, z, ground(x, z), r, p.h, guards))
  return h
}

// The whole seeded wood for a map. Structure first (road poplars, hedges, the corridor slots), then
// a jittered scatter fills in bushes, tufts, bank willows and the odd stump around them.
export function planFlora(terrain: Terrain[], f: Fields, wire: boolean[], objectives: HexId[]): Plant[] {
  const ok = gates(terrain, f, wire)
  const guards = guardsOf(terrain, objectives, () => 0)
  const zoneAt = (x: number, z: number): Zone => {
    const gx = Math.max(0, Math.min(GW - 1, Math.floor((x + MAP_W / 2) / MAP_W * GW)))
    const gy = Math.max(0, Math.min(GH - 1, Math.floor((z + MAP_H / 2) / MAP_H * GH)))
    return ZONE_LIST[f.zone[gy * GW + gx]]
  }
  const out: Plant[] = []
  // occupancy on an 8 mm grid, so no two plants intersect
  const C = 0.008, GWc = Math.ceil(MAP_W / C) + 2, cells = new Map<number, Plant[]>()
  const key = (x: number, z: number): number => Math.floor((z + MAP_H / 2) / C + 1) * GWc + Math.floor((x + MAP_W / 2) / C + 1)
  const free = (x: number, z: number, r: number): boolean => {
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { // 32 mm: a hedge's half-length plus a crown
      for (const q of cells.get(key(x + i * C, z + j * C)) ?? []) if (Math.hypot(q.x - x, q.z - z) < q.r + r + 0.0008) return false
    }
    return true
  }
  const put = (kind: Kind, x: number, z: number, want: number, seed: number, tint: [number, number, number], len = 0, yaw = 0): boolean => {
    const p: Plant = { kind, x, z, r: 0, h: want, len, yaw: kind === 'hedge' ? yaw + (hash01(seed, 7) - 0.5) * 0.06 : hash01(seed, 7) * Math.PI * 2, tint }
    const ss = samples(p)
    if (!ss.every(([sx, sz, sr]) => ok(sx, sz, sr))) return false
    p.r = len ? len / 2 : ss[0][2]
    if (!free(x, z, p.r)) return false
    p.h = fit(p, guards, () => 0)
    if (p.h < PROTO[kind].min) return false
    if (!len) p.r = PROTO[kind].r * p.h / PROTO[kind].h
    const k = 0.86 + 0.28 * hash01(seed, 9)
    p.tint = [tint[0] * k, tint[1] * k, tint[2] * k]
    out.push(p)
    const kk = key(x, z)
    cells.set(kk, [...(cells.get(kk) ?? []), p])
    return true
  }
  const PLAIN: [number, number, number] = [1, 1, 1]
  const ORCHARD: [number, number, number] = [1.12, 1.1, 0.82]
  const OAK: [number, number, number] = [0.9, 0.94, 0.86]
  const REED: [number, number, number] = [0.55, 0.74, 0.5]
  const FARM: [number, number, number] = [1.18, 1.14, 0.92] // lifted off the dark wet polder
  let seed = 1

  // 1. Lombardy poplars: a file on each side of every road, 12 mm apart (where the keep-outs and the
  // height cap leave a 3 cm poplar standing: in practice the notches of the north and south margins).
  for (const l of roadLines(terrain)) {
    let run = 0.006
    for (let i = 0; i < l.length - 1; i++) {
      const [ax, az] = l[i], [bx, bz] = l[i + 1], d = Math.hypot(bx - ax, bz - az)
      if (d < 1e-6) continue
      const tx = (bx - ax) / d, tz = (bz - az) / d
      for (; run < d; run += 0.012) {
        for (const side of [-1, 1]) {
          const s = seed++, j = (hash01(s, 3) - 0.5) * 0.003
          const x = ax + tx * (run + j) - tz * side * 0.0115, z = az + tz * (run + j) + tx * side * 0.0115
          const zone = zoneAt(x, z)
          if (zone === 'deRear' || zone === 'brRear' || zone === 'polder') put('poplar', x, z, 0.044 + 0.014 * hash01(s, 5), s, PLAIN)
        }
      }
      run -= d
    }
  }

  // 2. Hedgerows behind the British line, inside a hex along its south edges so the ink edge stays
  // clear (a hedge's silhouette leans north, away from it): the whole south edge, and the outer
  // halves of the south-east and south-west edges, where the hedge clears the hex's own piece.
  const HEDGES: [number, number, number, number][] = [[0, 0.0467, 0, HEDGE_L], [0.048, 0.0092, Math.PI / 3, 0.018], [-0.048, 0.0092, -Math.PI / 3, 0.018]]
  for (let h = 0; h < N_HEX; h++) {
    if (FORBID.has(terrain[h])) continue
    HEDGES.forEach(([dx, dz, yaw, len], i) => {
      const x = hexX(h) + dx, z = hexZ(h) + dz
      if (zoneAt(x, z) !== 'brRear' || hash01(h * 3 + i, 43) > 0.62) return
      put('hedge', x, z, PROTO.hedge.h * (0.85 + 0.15 * hash01(h * 3 + i, 45)), seed++, PLAIN, len * (0.9 + 0.1 * hash01(h * 3 + i, 47)), yaw)
    })
  }

  // 3. The corridor slots: the midpoint of every slanted hex edge (on the board or its margin).
  const slots = new Set<string>()
  for (let h = 0; h < N_HEX; h++) {
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = hexX(h) + sx * DX / 2, z = hexZ(h) + sz * HEX / 4, k = `${Math.round(x * 1e4)},${Math.round(z * 1e4)}`
      if (slots.has(k)) continue
      slots.add(k)
      const s = seed++, u = hash01(s, 11), jx = (hash01(s, 13) - 0.5) * 0.002, jz = (hash01(s, 17) - 0.5) * 0.002
      const zone = zoneAt(x, z), X = x + jx, Z = z + jz, v = hash01(s, 19)
      // a slot is the one interior spot a 4-6 cm poplar may stand, so some take one
      const tall = (): boolean => put('poplar', X, Z, 0.04 + 0.016 * v, s, PLAIN)
      if (zone === 'deRear' && u < 0.9) (u < 0.25 && tall()) || put('tree', X, Z, 0.016 + 0.005 * v, s, ORCHARD) || put('bush', X, Z, 0.0062, s, ORCHARD)
      else if (zone === 'brRear' && u < 0.75) (u < 0.35 && tall()) || put('tree', X, Z, 0.017 + 0.004 * v, s, OAK) || put('bush', X, Z, 0.0062, s, OAK)
      else if (zone === 'polder' && u < 0.8) (u < 0.2 && tall()) || put('willow', X, Z, 0.014 + 0.004 * v, s, PLAIN)
      else if (zone === 'nml' && u < 0.45) {
        // a blasted copse: two or three shattered boles strung along the edge
        const ex = -sz * 0.5 * 0.0065, ez = sx * 0.866 * 0.0065
        put('stump', X, Z, 0.013 + 0.011 * v, s, PLAIN)
        for (const t of [-1, 1]) if (hash01(s, 30 + t) < 0.6) put('stump', X + ex * t, Z + ez * t, 0.009 + 0.012 * hash01(s, 33 + t), s + t * 7, PLAIN)
      }
    }
  }

  // 4. The scatter, a 6.8 mm jittered lattice. Round trees take the north half of each hex's rim
  // (behind its piece, far enough in front of the next one up), bushes and tufts what is left.
  const S = 0.0068
  const riverNear = (x: number, z: number): boolean => {
    const n = nearestHex(x, z)
    return [n, ...neighbors(n)].some((h) => terrain[h] === 'river' || terrain[h] === 'bridge' || terrain[h] === 'sluice')
  }
  for (let j = 0; j < MAP_H / S; j++) for (let i = 0; i < MAP_W / S; i++) {
    const s = 100000 + j * 1000 + i
    const x = -MAP_W / 2 + (i + 0.15 + 0.7 * hash01(s, 21)) * S, z = -MAP_H / 2 + (j + 0.15 + 0.7 * hash01(s, 23)) * S
    const zone = zoneAt(x, z), u = hash01(s, 25)
    if (zone === 'sea' || zone === 'river' || zone === 'flood') continue
    if (zone !== 'dune' && u < 0.3 && sampleField(f.waterDist, x, z) < 0.02 && riverNear(x, z)) { put('willow', x, z, 0.013 + 0.005 * hash01(s, 27), s, PLAIN); continue }
    const v = hash01(s, 27)
    if (zone === 'dune' && u < 0.65) put('tuft', x, z, 0.007 + 0.004 * v, s, PLAIN)
    else if (zone === 'polder') (u < 0.18 && put('tree', x, z, 0.014 + 0.005 * v, s, FARM)) || (u > 0.9 && put('tuft', x, z, 0.0055 + 0.002 * v, s, REED))
    else if (zone === 'nml' && u < 0.012) put('stump', x, z, 0.009 + 0.008 * v, s, PLAIN)
    else if (zone === 'deRear') (u < 0.7 && put('tree', x, z, 0.014 + 0.007 * v, s, ORCHARD)) || (u > 0.93 && put('bush', x, z, 0.0066, s, ORCHARD))
    else if (zone === 'brRear') (u < 0.5 && put('tree', x, z, 0.015 + 0.007 * v, s, OAK)) || (u > 0.94 && put('bush', x, z, 0.0066, s, OAK))
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// The flora on the sheet

export class Flora {
  readonly group = new THREE.Group()
  private readonly mesh: THREE.BatchedMesh
  private readonly material: THREE.MeshStandardMaterial
  private readonly placed: { p: Plant; id: number }[] = []
  private readonly gone = new Set<number>() // cratered away for good

  constructor(plants: Plant[], relief: Relief, terrain: Terrain[], objectives: HexId[]) {
    this.group.name = 'flora'
    const protos = prototypes()
    let verts = 0
    for (const k of KINDS) verts += protos[k].getAttribute('position').count
    this.material = wornEnamel(mat('paintMatte'), 'flora')
    this.mesh = new THREE.BatchedMesh(Math.max(1, plants.length), verts, 0, this.material)
    this.mesh.name = 'flora'
    const ids = {} as Record<Kind, number>, tri = {} as Record<Kind, number>
    for (const k of KINDS) { ids[k] = this.mesh.addGeometry(protos[k]); tri[k] = protos[k].getAttribute('position').count / 3; protos[k].dispose() }
    let tris = 0
    // The plan capped heights on a flat sheet; the dunes stand 3.5 cm, so cap again on the relief.
    const ground = (x: number, z: number): number => relief.heightAt(x, z)
    const guards = guardsOf(terrain, objectives, (x, z) => relief.standY(x, z))
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color()
    for (const p of plants) {
      const h = fit(p, guards, ground)
      if (h < PROTO[p.kind].min) continue
      const s = h / PROTO[p.kind].h
      // stumps and willows lean a little; every crown is squashed or stretched a touch
      const lean = p.kind === 'stump' ? 0.16 : p.kind === 'willow' ? 0.07 : 0.03
      e.set((hash01(p.x * 1e5, 1) - 0.5) * lean, p.yaw, (hash01(p.z * 1e5, 2) - 0.5) * lean)
      const w = 0.92 + 0.16 * hash01(p.x * 1e5, p.z * 1e5)
      m.compose(new THREE.Vector3(p.x, ground(p.x, p.z) - 0.0008, p.z), q.setFromEuler(e),
        new THREE.Vector3(p.kind === 'hedge' ? p.len / HEDGE_L : s * w, s, s * (p.kind === 'hedge' ? 1 : w)))
      const id = this.mesh.addInstance(ids[p.kind])
      this.mesh.setMatrixAt(id, m)
      this.mesh.setColorAt(id, c.setRGB(...p.tint))
      this.placed.push({ p, id })
      tris += tri[p.kind]
    }
    console.info(`[board] flora: ${this.placed.length} plants, ${tris} triangles`)
    this.mesh.perObjectFrustumCulled = false
    this.mesh.sortObjects = false
    this.mesh.receiveShadow = true
    this.group.add(this.mesh)
  }

  // A barrage cratered hex h: whatever stood on it or in its spoil is gone (the plan leaves the same
  // gap around a crater loaded from a state, so play and load agree).
  clearHex(h: HexId): void {
    const cs = cratersOf(h)
    for (const { p, id } of this.placed) {
      if (samples(p).some(([x, z, r]) => touches(x, z, r, (k) => k === h) || cs.some((c) => Math.hypot(x - c.x, z - c.z) < c.r * 1.55 + r))) {
        this.mesh.setVisibleAt(id, false)
        this.gone.add(id)
      }
    }
  }

  // Bases wider than the 43 mm keep-out (a tank's stretched base, a dug-in sandbag ring) push the
  // plants under them out of sight for as long as they stand there. Ellipses in the base's own
  // frame: rx across, rz along its facing (the model's z after the yaw).
  clearFor(bases: { x: number; z: number; yaw: number; rx: number; rz: number }[]): void {
    for (const { p, id } of this.placed) {
      if (this.gone.has(id)) continue
      const under = bases.some((b) => {
        const dx = p.x - b.x, dz = p.z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw)
        return ((dx * c - dz * s) / (b.rx + p.r)) ** 2 + ((dx * s + dz * c) / (b.rz + p.r)) ** 2 < 1
      })
      this.mesh.setVisibleAt(id, !under)
    }
  }

  dispose(): void {
    this.mesh.dispose()
    this.material.dispose()
  }
}

// ---------------------------------------------------------------------------------------------
// The seven prototypes, in metres, standing on y = 0.

// Seeded lumps keyed on each vertex's position (so a lathe's duplicated seam vertices move together
// and never crack): scaled by 1 +- amp from the axis (`radial`) or from the origin.
function lumpy(g: THREE.BufferGeometry, amp: number, salt: number, radial = false): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const k = 1 + amp * (hash01(Math.round(x * 1e5) * 7919 + Math.round(y * 1e5), Math.round(z * 1e5) + salt) * 2 - 1)
    p.setXYZ(i, x * k, radial ? y : y * k, z * k)
  }
  return g
}

const foot = (r: number): THREE.BufferGeometry => new THREE.CircleGeometry(r, 7).rotateX(-Math.PI / 2).translate(0, 0.0003, 0)
// open-ended: the foot of a trunk is in the ground and its top inside the crown
const trunk = (rt: number, rb: number, h: number, seg = 5): THREE.BufferGeometry => new THREE.CylinderGeometry(rt, rb, h, seg, 1, true).translate(0, h / 2, 0)
const FLOCK = '#2b2a1c', BARK = '#4b3a2a'

function prototypes(): Record<Kind, THREE.BufferGeometry> {
  const leaf = { wear: 0.16, noise: 0.13, flat: true }
  const poplar = new Geo()
    .add(foot(0.005), FLOCK, { noise: 0.1 })
    .add(trunk(0.0006, 0.001, 0.012), BARK, { wear: 0.35 })
    .add(lumpy(lathe([[0.0001, 0.007], [0.0026, 0.0095], [0.004, 0.016], [0.0046, 0.024], [0.0041, 0.032], [0.003, 0.04],
      [0.0015, 0.046], [0.0001, 0.05]], 7), 0.14, 3, true), '#33502a', leaf)
    .build(0.35, 0.03)
  const tree = new Geo()
    .add(foot(0.006), FLOCK, { noise: 0.1 })
    .add(trunk(0.0007, 0.0011, 0.011), BARK, { wear: 0.35 })
    .at(lumpy(new THREE.IcosahedronGeometry(0.0055, 1), 0.16, 5), '#557a34', [0, 0.0145, 0], [0, 0, 0], leaf, [1, 0.9, 1])
    .build(0.3, 0.02)
  const bush = new Geo()
    .add(foot(0.0048), FLOCK, { noise: 0.1 })
    .at(lumpy(new THREE.DodecahedronGeometry(0.0043, 0), 0.18, 9), '#4a6a2e', [0, 0.0028, 0], [0, 0, 0], leaf, [1, 0.72, 1])
    .build(0.3, 0.006)
  // a pollard: a squat gnarled bole and a head of upright silver-green shoots
  const willow = new Geo()
    .add(foot(0.0062), FLOCK, { noise: 0.1 })
    .add(lumpy(trunk(0.0015, 0.0021, 0.0095, 6), 0.18, 11, true), '#5b4a38', { wear: 0.3 })
    .at(lumpy(new THREE.IcosahedronGeometry(0.0052, 1), 0.3, 13), '#7a8a60', [0, 0.0118, 0], [0, 0, 0], leaf, [1, 1.05, 1])
    .build(0.3, 0.012)
  const hedge = new Geo().add(new THREE.PlaneGeometry(HEDGE_L + 0.002, 0.0066).rotateX(-Math.PI / 2).translate(0, 0.0003, 0), FLOCK, { noise: 0.1 })
  for (let i = 0; i < 6; i++) {
    hedge.at(lumpy(new THREE.DodecahedronGeometry(0.0036, 0), 0.2, 20 + i), '#3d5a2a', [-HEDGE_L / 2 + 0.0036 + i * (HEDGE_L - 0.0072) / 5, 0.0029,
      (hash01(i, 3) - 0.5) * 0.001], [0, i, 0], leaf, [1.25, 0.95, 0.78])
  }
  // marram: five blades leaning out from the clump
  const tuft = new Geo()
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.3, lean = 0.3 + 0.14 * (i % 2), h = 0.009 * (0.72 + 0.07 * ((i * 3) % 5))
    tuft.at(new THREE.ConeGeometry(0.0011, h, 3, 1, true).translate(0, h / 2, 0), '#8e955a', [Math.cos(a) * 0.001, 0, Math.sin(a) * 0.001],
      [Math.sin(a) * lean, 0, -Math.cos(a) * lean], { noise: 0.15, wear: 0.1 })
  }
  // a blasted trunk: no branches, the top shattered into splinters, one spike left standing
  const bole = new THREE.CylinderGeometry(0.0015, 0.0026, 0.017, 5, 2, true).translate(0, 0.0085, 0)
  const bp = bole.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < bp.count; i++) {
    if (bp.getY(i) < 0.016) continue
    const k = hash01(Math.round(bp.getX(i) * 1e5), Math.round(bp.getZ(i) * 1e5))
    bp.setXYZ(i, bp.getX(i) * (0.6 + 0.7 * k), bp.getY(i) - 0.005 * k, bp.getZ(i) * (0.6 + 0.7 * k))
  }
  const stump = new Geo()
    .add(foot(0.004), '#2a241e', { noise: 0.1 })
    .add(bole, '#443a30', { wear: 0.35, noise: 0.12, flat: true })
    .at(new THREE.ConeGeometry(0.0011, 0.0055, 3).translate(0, 0.00275, 0), '#5a4c3c', [0.0003, 0.0155, 0.0002], [0.12, 0, -0.1], { wear: 0.4, flat: true })
    .build(0.25, 0.012)
  return { poplar, tree, bush, willow, hedge: hedge.build(0.3, 0.006), tuft: tuft.build(0.3, 0.006), stump }
}
