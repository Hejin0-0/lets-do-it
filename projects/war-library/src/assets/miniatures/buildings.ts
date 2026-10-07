// Terrain miniatures (digest_3d-assets §b "Ruined village house", "Church ruin"): Flemish brick
// ruins, the church, the château, the German blockhouse, the Yser bridges and the sluice. Each
// builder returns one vertex-painted Geo in metres, footprint centred on the origin, long axis on
// x, the street front facing +z (south, toward the commander's chair).
//
// ROOF RULE (audit defect d10, the old build got 12 roofs wrong): the RIDGE runs gable to gable,
// i.e. along the gable walls' normal; RAFTERS run from the ridge down to a wall plate, square to
// the ridge and so in planes parallel to the gables. Every roof is built from a RoofSpec and
// checkRoof() throws if a rafter breaks that rule; src/board/board.test.ts asserts it too.
import * as THREE from 'three'
import { box, cyl, extrude, Geo, hex, lathe, pointedArch, rod } from './geo.ts'
import type { RGB } from './geo.ts'

type V = [number, number, number]
export interface RoofSpec {
  ridge: [V, V]
  plates: [V, V][] // wall plates (eaves beams), one per long wall
  gableNormals: V[] // outward normals of the gable walls
  rafters: [V, V][] // [ridge end, wall-plate end]
}

const BRICK = hex('#8c4a35'), BRICK_D = hex('#6a3629'), MORTAR = hex('#b9a88c'), STONE = hex('#a39a88'), STONE_D = hex('#7f776a')
const TILE = hex('#8a3f2c'), SLATE = hex('#4b5058'), TIMBER = hex('#5e422b'), PLASTER = hex('#cdbf9f'), SOOT = hex('#231d19')
const CONCRETE = hex('#8e8a7e')

// Throws unless every rafter starts on the ridge line, ends on a wall plate, and runs square to
// the ridge (|dot| < 0.02 in plan); and unless the ridge runs along every gable normal.
export function checkRoof(r: RoofSpec, name: string): void {
  const [a, b] = r.ridge
  const rd = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]).normalize()
  for (const n of r.gableNormals) {
    const g = new THREE.Vector3(n[0], 0, n[2]).normalize()
    if (Math.abs(Math.abs(g.dot(rd)) - 1) > 0.02) throw new Error(`${name}: ridge is not gable-to-gable`)
  }
  const onLine = (p: V, [s, e]: [V, V], tol = 1e-4): boolean => {
    const S = new THREE.Vector3(...s), E = new THREE.Vector3(...e), P = new THREE.Vector3(...p)
    const d = E.clone().sub(S), t = THREE.MathUtils.clamp(P.clone().sub(S).dot(d) / d.lengthSq(), -0.02, 1.02)
    return S.addScaledVector(d, t).distanceTo(P) < tol
  }
  for (const [top, foot] of r.rafters) {
    if (!onLine(top, r.ridge)) throw new Error(`${name}: rafter top off the ridge`)
    if (!r.plates.some((pl) => onLine(foot, pl))) throw new Error(`${name}: rafter foot off the wall plates`)
    const pd = new THREE.Vector3(foot[0] - top[0], 0, foot[2] - top[2]).normalize()
    if (Math.abs(pd.dot(rd)) > 0.02) throw new Error(`${name}: rafter not square to the ridge`)
    if (foot[1] >= top[1]) throw new Error(`${name}: rafter runs uphill`)
  }
}

// A gable roof over a L x D box: ridge along x at height ha, plates at z = +-D/2, y = he.
// `from`..`to` (0..1 along x) is the stretch that still has rafters; tiles cover `tiles` of it.
function gableRoof(g: Geo, L: number, D: number, he: number, ha: number, from: number, to: number, tiles: [number, number][], tileC: RGB, name: string, ox = 0): RoofSpec {
  const x0 = ox - L / 2 + 0.002, x1 = ox + L / 2 - 0.002
  const spec: RoofSpec = { ridge: [[x0, ha, 0], [x1, ha, 0]], plates: [[[x0, he, -D / 2 + 0.0015], [x1, he, -D / 2 + 0.0015]], [[x0, he, D / 2 - 0.0015], [x1, he, D / 2 - 0.0015]]], gableNormals: [[-1, 0, 0], [1, 0, 0]], rafters: [] }
  // ridge beam and wall plates
  const xa = ox - L / 2 + L * from, xb = ox - L / 2 + L * to
  g.add(rod([xa, ha, 0], [xb, ha, 0], 0.0011, 0.0011, 5), TIMBER, { wear: 0.2 })
  for (const pl of spec.plates) g.add(rod([xa, pl[0][1], pl[0][2]], [xb, pl[0][1], pl[0][2]], 0.001, 0.001, 5), TIMBER)
  for (let x = xa + 0.002; x <= xb - 0.0015; x += 0.0062) {
    for (const zs of [-1, 1]) {
      const top: V = [x, ha, 0], foot: V = [x, he, zs * (D / 2 - 0.0015)]
      spec.rafters.push([top, foot])
      // overhang past the plate like a real rafter tail
      const tail: V = [x, he - (ha - he) * 0.12, zs * (D / 2 - 0.0015) * 1.12]
      g.add(rod(top, tail, 0.00065, 0.00065, 4), TIMBER, { noise: 0.08 })
    }
  }
  // surviving tile courses on both slopes
  const slope = Math.atan2(ha - he, D / 2)
  const len = Math.hypot(ha - he, D / 2) * 1.1
  for (const [a, b] of tiles) {
    for (const zs of [-1, 1]) {
      const xm = ox - L / 2 + L * (a + b) / 2, w = L * (b - a)
      for (let c = 0; c < 5; c++) {
        const t = (c + 0.5) / 5
        const y = ha - (ha - he) * t * 1.08 + 0.0012, z = zs * (D / 2) * t * 1.08
        const m = new THREE.Matrix4().compose(new THREE.Vector3(xm + ((c * 37) % 7 - 3) * 0.0004, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(zs * slope, 0, 0)), new THREE.Vector3(1, 1, 1))
        g.add(box(w * (0.92 - (c % 2) * 0.12), 0.0009, len / 5 * 1.05).translate(0, -0.00045, 0), c % 2 ? tileC : tileC.map((v) => v * 0.86) as RGB, { noise: 0.1, wear: 0.2 }, m)
      }
    }
  }
  checkRoof(spec, name)
  return spec
}

// A wall in the xy plane (x along the wall, y up), extruded `t` thick, placed by m.
function wall(g: Geo, outline: [number, number][], holes: [number, number][][], t: number, c: RGB, m: THREE.Matrix4): void {
  g.add(extrude(outline, t, holes), c, { noise: 0.09, flat: true }, m)
}

const place = (x: number, y: number, z: number, ry = 0): THREE.Matrix4 =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1))

function jagged(x0: number, x1: number, y0: number, y1: number, n: number, seed: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = Math.sin(seed * 12.9 + i * 78.2) * 43758.5
    out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + ((j - Math.floor(j)) - 0.5) * 0.006])
  }
  return out
}

function rubble(g: Geo, cx: number, cz: number, r: number, n: number, colors: RGB[], seed: number): void {
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + seed, rr = r * Math.sqrt((i + 0.5) / n)
    const h = (1 - rr / r) * 0.004
    g.at(box(0.0026, 0.0014, 0.0014), colors[i % colors.length], [cx + Math.cos(a) * rr, h, cz + Math.sin(a) * rr * 0.7], [i * 0.7, i * 1.3, i * 0.4], { noise: 0.1 })
  }
}

// ---------------------------------------------------------------------------------------------
export interface Built { geo: Geo; roofs: RoofSpec[] }

// Flemish brick house, shelled: stepped west gable, broken east end, pointed-arch openings,
// roof half gone with the rafters showing.
export function ruin(seed = 1): Built {
  const g = new Geo(), L = 0.058, D = 0.03, he = 0.03, ha = 0.049, t = 0.0034
  const front: [number, number][] = [[-L / 2, 0], [L / 2, 0], ...jagged(L / 2, L * 0.05, he * 0.45, he * 0.95, 7, seed).map(([x, y]) => [x, y] as [number, number]), [-L / 2, he]]
  const holes = [pointedArch(-0.012, 0.0006, 0.012, 0.0088), pointedArch(0.0, 0.011, 0.018, 0.006), pointedArch(-0.022, 0.019, 0.0235, 0.006)]
  wall(g, front, holes, t, BRICK, place(0, 0, D / 2 - t / 2))
  wall(g, [[-L / 2, 0], [L / 2, 0], [L / 2, he * 0.8], [L * 0.2, he], [-L / 2, he]], [pointedArch(-0.01, 0.012, 0.02, 0.0065), pointedArch(0.012, 0.012, 0.02, 0.0065)], t, BRICK_D, place(0, 0, -D / 2 + t / 2))
  // stepped (crow-stepped) west gable: three steps up each side to a square apex
  const ns = 3, up: [number, number][] = [[D / 2, he]]
  for (let i = 0; i < ns; i++) {
    const zA = D / 2 - (i + 1) * (D / 2) / (ns + 0.5), yA = he + (i + 1) * (ha - he) / (ns + 0.5)
    up.push([up[up.length - 1][0], yA], [zA, yA])
  }
  up.push([up[up.length - 1][0], ha + 0.004])
  const steps: [number, number][] = [[-D / 2, 0], [D / 2, 0], ...up, ...up.slice().reverse().map(([z, y]): [number, number] => [-z, y])]
  wall(g, steps, [pointedArch(0, he + 0.002, he + 0.006, 0.004)], t, BRICK, place(-L / 2 + t / 2, 0, 0, Math.PI / 2))
  // broken east gable
  wall(g, [[-D / 2, 0], [D / 2, 0], ...jagged(D / 2, -D / 2, he * 0.5, he * 0.75, 5, seed + 3)], [], t, BRICK_D, place(L / 2 - t / 2, 0, 0, Math.PI / 2))
  // mortar string course and a soot scar on the front
  g.at(box(L * 0.5, 0.0009, 0.001), MORTAR, [-L * 0.24, he * 0.62, D / 2 + 0.0002])
  g.at(box(0.012, 0.012, 0.0006), SOOT, [0.004, 0.022, D / 2 + 0.0002], [0, 0, 0.3], { noise: 0.2 })
  const roof = gableRoof(g, L, D, he, ha - 0.001, 0.02, 0.62, [[0.02, 0.3]], TILE, 'ruin')
  rubble(g, L * 0.33, D * 0.45, 0.016, 30, [BRICK, BRICK_D, MORTAR, TILE], seed)
  // floor joists sticking out of the broken end
  for (let i = 0; i < 3; i++) g.add(rod([L * 0.1, 0.017, -D / 2 + 0.006 + i * 0.009], [L * 0.52, 0.0135 - i * 0.002, -D / 2 + 0.008 + i * 0.009], 0.0007, 0.0007, 4), TIMBER)
  return { geo: g, roofs: [roof] }
}

// The church: nave with pointed lancets and buttresses, a square west tower with a broken top and
// a pointed belfry opening, a lathe apse, the fallen spire on the ground.
export function church(): Built {
  const g = new Geo(), L = 0.044, D = 0.028, he = 0.028, ha = 0.045, t = 0.0034, x0 = 0.008
  const lancets = [-0.013, -0.001, 0.011].map((x) => pointedArch(x, 0.009, 0.019, 0.0056, 0.0056 * 0.9))
  const m0 = (z: number): THREE.Matrix4 => place(x0, 0, z)
  wall(g, [[-L / 2, 0], [L / 2, 0], [L / 2, he], [-L / 2, he]], lancets, t, STONE, m0(D / 2 - t / 2))
  wall(g, [[-L / 2, 0], [L / 2, 0], [L / 2, he], [-L / 2, he]], [], t, STONE_D, m0(-D / 2 + t / 2))
  for (const x of [-0.019, -0.007, 0.005, 0.017]) g.at(box(0.0034, he * 0.82, 0.0046), STONE_D, [x0 + x, 0, D / 2 + 0.002], [0, 0, 0], { noise: 0.08 })
  const roof = gableRoof(g, L, D, he, ha, 0.28, 0.98, [[0.55, 0.98]], SLATE, 'church', x0)
  // east gable wall with a rose (round) window
  const gab: [number, number][] = [[-D / 2, 0], [D / 2, 0], [D / 2, he], [0, ha + 0.002], [-D / 2, he]]
  wall(g, gab, [[...Array(10).keys()].map((i) => [Math.cos(i / 10 * Math.PI * 2) * 0.004, he + 0.004 + Math.sin(i / 10 * Math.PI * 2) * 0.004] as [number, number])], t, STONE, place(x0 + L / 2 - t / 2, 0, 0, Math.PI / 2))
  // apse
  g.add(lathe([[0.0001, 0], [0.0125, 0], [0.0125, he * 0.85], [0.0001, he * 0.85]], 14), STONE_D, { noise: 0.08 }, new THREE.Matrix4().compose(new THREE.Vector3(x0 + L / 2, 0, 0), new THREE.Quaternion(), new THREE.Vector3(0.8, 1, 1)))
  g.add(new THREE.ConeGeometry(0.0132, 0.012, 14).translate(0, he * 0.85 + 0.006, 0), SLATE, { noise: 0.08 }, new THREE.Matrix4().compose(new THREE.Vector3(x0 + L / 2, 0, 0), new THREE.Quaternion(), new THREE.Vector3(0.8, 1, 1)))
  // west tower, broken crown, pointed belfry openings on each face
  const T = 0.021, TH = 0.074, tx = x0 - L / 2 - T / 2 + 0.002
  for (let f = 0; f < 4; f++) {
    const top = jagged(T / 2, -T / 2, TH - 0.004 - (f % 2) * 0.006, TH - (f === 1 ? 0.012 : 0), 5, f + 11)
    const outline: [number, number][] = [[-T / 2, 0], [T / 2, 0], ...top]
    wall(g, outline, [pointedArch(0, TH - 0.03, TH - 0.021, 0.0068), pointedArch(0, 0.028, 0.036, 0.0046)], 0.0032, f % 2 ? STONE_D : STONE, new THREE.Matrix4().multiplyMatrices(place(tx, 0, 0, f * Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 0, T / 2 - 0.0016)))
  }
  // west door
  g.at(box(0.0005, 0.013, 0.009), SOOT, [tx - T / 2 - 0.0002, 0, 0])
  // fallen spire: an octagonal cone on its side, snapped
  g.add(new THREE.ConeGeometry(0.0085, 0.042, 8).translate(0, 0.021, 0), SLATE, { noise: 0.1, flat: true },
    new THREE.Matrix4().compose(new THREE.Vector3(tx - 0.004, 0.005, D / 2 + 0.012), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.4, -Math.PI / 2 + 0.12)), new THREE.Vector3(1, 1, 1)))
  rubble(g, tx + 0.004, D / 2 + 0.006, 0.013, 22, [STONE, STONE_D, SLATE], 7)
  return { geo: g, roofs: [roof] }
}

// The château: two storeys of rendered brick with brick quoins, two round corner towers (one
// capped, one shelled), a gable roof with its east half blown open.
export function chateau(): Built {
  const g = new Geo(), L = 0.058, D = 0.03, he = 0.036, ha = 0.052, t = 0.0034
  const win: [number, number][][] = []
  for (const x of [-0.017, -0.006, 0.006, 0.017]) for (const y of [0.007, 0.021]) {
    if (x === -0.006 && y === 0.007) continue
    win.push([[x - 0.0027, y], [x + 0.0027, y], [x + 0.0027, y + 0.0085], [x - 0.0027, y + 0.0085]])
  }
  win.push(pointedArch(-0.006, 0.0005, 0.009, 0.0072))
  wall(g, [[-L / 2, 0], [L / 2, 0], [L / 2, he * 0.85], [L * 0.3, he], [-L / 2, he]], win, t, PLASTER, place(0, 0, D / 2 - t / 2))
  wall(g, [[-L / 2, 0], [L / 2, 0], [L / 2, he], [-L / 2, he]], [], t, PLASTER.map((v) => v * 0.85) as RGB, place(0, 0, -D / 2 + t / 2))
  for (const s of [-1, 1]) {
    const gab: [number, number][] = [[-D / 2, 0], [D / 2, 0], [D / 2, he], [0, ha], [-D / 2, he]]
    wall(g, s > 0 ? [[-D / 2, 0], [D / 2, 0], ...jagged(D / 2, -D / 2, he * 0.9, he + 0.004, 5, 5)] : gab, [], t, PLASTER, place(s * (L / 2 - t / 2), 0, 0, Math.PI / 2))
  }
  // brick quoins and window lintels
  for (const x of [-L / 2 + 0.0015, L / 2 - 0.0015]) for (let y = 0.001; y < he - 0.002; y += 0.0042) g.at(box(0.0036, 0.0021, 0.0008), BRICK, [x + (y * 1000 % 2 > 1 ? 0.0006 : -0.0006), y, D / 2 + 0.0003])
  for (const x of [-0.017, 0.006, 0.017, -0.006]) for (const y of [0.0158, 0.0298]) g.at(box(0.0068, 0.0012, 0.0008), BRICK, [x, y, D / 2 + 0.0003])
  g.at(box(L + 0.002, 0.0014, 0.0012), BRICK_D, [0, 0.0135, D / 2 + 0.0004]) // string course
  const roof = gableRoof(g, L, D, he, ha, 0.02, 0.98, [[0.02, 0.55]], SLATE, 'chateau')
  // chimneys
  g.at(box(0.004, 0.012, 0.004), BRICK, [-0.014, ha - 0.006, -0.004])
  // corner towers
  for (const s of [-1, 1]) {
    const cx = s * (L / 2 + 0.002), cz = D / 2 - 0.002, h = s < 0 ? 0.046 : 0.034
    g.add(cyl(0.0088, 0.0094, h, 14).translate(cx, 0, cz), PLASTER, { noise: 0.07 })
    for (const y of [0.012, 0.026]) if (y < h - 0.006) g.at(box(0.003, 0.006, 0.0008), SOOT, [cx, y, cz + 0.0091])
    if (s < 0) g.add(new THREE.ConeGeometry(0.0106, 0.022, 14).translate(cx, h + 0.011, cz), SLATE, { noise: 0.06, wear: 0.2 })
    else g.add(lathe([[0.0095, h - 0.0005], [0.0079, h + 0.0022], [0.0062, h - 0.004], [0.0001, h - 0.006]], 14).translate(cx, 0, cz), SOOT)
  }
  // steps to the door and a garden wall stub
  g.at(box(0.012, 0.0022, 0.005), STONE, [-0.006, 0, D / 2 + 0.0025])
  rubble(g, L * 0.34, D * 0.55, 0.012, 22, [PLASTER, BRICK, SLATE], 3)
  return { geo: g, roofs: [roof] }
}

// German concrete blockhouse: battered walls, heavy roof slab, a dark firing slit, camouflage.
export function blockhouse(): Built {
  const g = new Geo(), L = 0.052, D = 0.032, H = 0.017
  const prof: [number, number][] = [[-D / 2, 0], [D / 2, 0], [D / 2 - 0.004, H], [-D / 2 + 0.004, H]]
  g.add(extrude(prof, L).rotateY(Math.PI / 2), CONCRETE, { noise: 0.12, flat: true })
  g.at(box(L + 0.006, 0.004, D - 0.004), CONCRETE.map((v) => v * 0.9) as RGB, [0, H, 0], [0, 0, 0], { noise: 0.1 })
  g.at(box(0.026, 0.0028, 0.002), SOOT, [0, H - 0.0075, D / 2 - 0.0022], [-0.24, 0, 0])
  g.at(box(0.009, 0.012, 0.002), SOOT, [L / 2 - 0.006, 0, -D / 2 + 0.0035])
  // earth banked up the flanks
  for (const s of [-1, 1]) g.add(lathe([[0.0001, 0], [0.012, 0], [0.004, 0.012], [0.0001, 0.013]], 10), hex('#5d4a33'), { noise: 0.15 }, new THREE.Matrix4().compose(new THREE.Vector3(s * (L / 2 + 0.002), 0, 0), new THREE.Quaternion(), new THREE.Vector3(0.7, 1, 1.3)))
  // Camouflage goes onto each part's paint. It used to be applied to the built mesh, which was
  // then re-added with add(built, [1,1,1]) — and add() repaints its input, so the whole blockhouse
  // came out pure white and blew out under the key light in S2.
  g.each(camo)
  return { geo: g, roofs: [] }
}

function camo(geo: THREE.BufferGeometry): void {
  const p = geo.getAttribute('position') as THREE.BufferAttribute, c = geo.getAttribute('color') as THREE.BufferAttribute
  const pal = [hex('#7c7456'), hex('#5b6346'), hex('#6e5a3e')]
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0.002) continue
    const u = Math.sin(p.getX(i) * 260 + Math.sin(p.getZ(i) * 310) * 1.7) + Math.sin(p.getY(i) * 400 + p.getX(i) * 90)
    const k = u > 0.9 ? 0 : u < -0.7 ? 1 : u > 0.2 && u < 0.45 ? 2 : -1
    if (k < 0) continue
    c.setXYZ(i, pal[k][0], pal[k][1], pal[k][2])
  }
}

// A stone road bridge along z: two segmental arches over the river, parapets with coping.
// `deck` is the height pieces stand on.
export const BRIDGE = { len: 0.124, width: 0.03, deck: 0.0032 }
export function bridge(): Built {
  const g = new Geo(), { len, width, deck } = BRIDGE
  const holes: [number, number][][] = []
  for (const zc of [-0.024, 0.024]) {
    const arc: [number, number][] = []
    for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; arc.push([zc + Math.cos(a) * 0.017, -0.0105 + Math.sin(a) * 0.0078]) }
    holes.push(arc)
  }
  const elev: [number, number][] = [[-len / 2, -0.0105], [len / 2, -0.0105], [len / 2, deck], [-len / 2, deck]]
  g.add(extrude(elev, width, holes).rotateY(Math.PI / 2), STONE, { noise: 0.1, flat: true })
  for (const s of [-1, 1]) {
    g.at(box(0.0028, 0.0052, len * 0.96), STONE_D, [s * (width / 2 - 0.0014), deck, 0], [0, 0, 0], { noise: 0.1 })
    g.at(box(0.0036, 0.0011, len * 0.97), STONE, [s * (width / 2 - 0.0014), deck + 0.0052, 0], [0, 0, 0], { noise: 0.06, wear: 0.2 })
    // cutwaters on the pier
    g.add(new THREE.ConeGeometry(0.0042, 0.013, 4).rotateX(s * Math.PI / 2).translate(s * (width / 2 + 0.004), -0.004, 0), STONE_D, { flat: true })
  }
  g.at(box(width - 0.006, 0.0006, len * 0.96), hex('#9b8f78'), [0, deck - 0.0003, 0], [0, 0, 0], { noise: 0.12 }) // setts
  return { geo: g, roofs: [] }
}

// The Nieuwpoort sluice: concrete piers, two timber gate leaves, a walkway and a brass winch.
export function sluice(): Built {
  const g = new Geo(), len = 0.12, deck = 0.004
  for (const x of [-0.02, 0, 0.02]) g.at(box(0.006, 0.016, len * 0.9), CONCRETE, [x, -0.011, 0], [0, 0, 0], { noise: 0.1, flat: true })
  for (const x of [-0.01, 0.01]) g.at(box(0.014, 0.0115, 0.003), TIMBER, [x, -0.009, 0.002], [0, 0, 0], { noise: 0.12 })
  g.at(box(0.05, 0.0018, 0.016), TIMBER, [0, deck - 0.0018, 0], [0, 0, 0], { noise: 0.1 })
  for (const s of [-1, 1]) {
    g.at(box(0.05, 0.0007, 0.0007), hex('#2c2a28'), [0, deck + 0.006, s * 0.0075])
    for (let x = -0.024; x <= 0.024; x += 0.008) g.at(box(0.0007, 0.006, 0.0007), hex('#2c2a28'), [x, deck, s * 0.0075])
  }
  for (const x of [-0.01, 0.01]) {
    const wm = new THREE.Matrix4().makeTranslation(x, deck + 0.009, 0)
    g.add(new THREE.TorusGeometry(0.0055, 0.0008, 5, 16), hex('#b8913f'), { wear: 0.5 }, wm)
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; g.add(rod([0, 0, 0], [Math.cos(a) * 0.0055, Math.sin(a) * 0.0055, 0], 0.0004, 0.0004, 4), hex('#b8913f'), {}, wm) }
    g.at(box(0.002, 0.009, 0.002), hex('#2c2a28'), [x, deck, -0.001])
  }
  for (const zs of [-1, 1]) g.at(box(0.05, 0.004, 0.02), CONCRETE.map((v) => v * 0.92) as RGB, [0, -0.002, zs * 0.052], [0, 0, 0], { noise: 0.1 })
  return { geo: g, roofs: [] }
}

// Nieuwpoort and Lombartzijde as towns, not single ruins (docs/DIORAMA.md "a town at Nieuwpoort"):
// a terrace of three narrow brick houses with crow-stepped gables to the street, the middle one
// shelled open, and at Nieuwpoort the Halle's belfry over them. Same 58 x 30 mm footprint as the
// ruin it replaces (the hex's north half), so the piece's spot to the south stays clear.
export function town(seed = 1, tower = true): Built {
  const g = new Geo()
  const SLATE = hex('#4a4b53'), WASH = hex('#d6cdbb'), DARK = hex('#2a211c')
  const houses: { x: number; w: number; h: number; c: RGB; shelled: boolean }[] = [
    { x: -0.019, w: 0.018, h: 0.023, c: BRICK, shelled: false },
    { x: 0.0, w: 0.019, h: 0.027, c: WASH, shelled: true },
    { x: 0.019, w: 0.018, h: 0.022, c: BRICK_D, shelled: false },
  ]
  const D = 0.026
  for (const [i, hs] of houses.entries()) {
    if (hs.shelled) {
      // a facade standing alone, its top torn into steps and holes, a heap of brick at its foot
      const top = jagged(-hs.w / 2, hs.w / 2, hs.h * 0.55, hs.h * 1.05, 5, seed + i)
      wall(g, [[-hs.w / 2, 0], [hs.w / 2, 0], ...top, [-hs.w / 2, hs.h * 0.7]], [pointedArch(-0.004, 0.006, 0.006, 0.006)], 0.0026, hs.c, place(hs.x, 0, D / 2 - 0.0013))
      for (let k = 0; k < 5; k++) g.add(new THREE.BoxGeometry(0.004, 0.0025, 0.004).translate(hs.x - 0.006 + k * 0.003, 0.00125 + (k % 2) * 0.001, D / 2 - 0.008 - (k % 3) * 0.003), BRICK_D, { noise: 0.2 })
      continue
    }
    g.add(new THREE.BoxGeometry(hs.w, hs.h, D).translate(hs.x, hs.h / 2, 0), hs.c, { noise: 0.1, wear: 0.4 })
    // crow-stepped gables, front and back: three steps up to a square apex
    for (const zf of [D / 2, -D / 2]) {
      for (let s = 0; s < 3; s++) {
        const sw = hs.w * (1 - (s + 1) * 0.24)
        g.add(new THREE.BoxGeometry(sw, 0.0045, 0.0032).translate(hs.x, hs.h + 0.00225 + s * 0.0045, zf - Math.sign(zf) * 0.0016), hs.c, { noise: 0.1 })
      }
    }
    // the roof behind the gables, ridge front-to-back
    const roof = new THREE.Shape([new THREE.Vector2(-hs.w / 2 + 0.001, 0), new THREE.Vector2(hs.w / 2 - 0.001, 0), new THREE.Vector2(0, 0.0125)])
    g.add(new THREE.ExtrudeGeometry(roof, { depth: D - 0.0064, bevelEnabled: false }).translate(hs.x, hs.h, -(D - 0.0064) / 2), SLATE, { noise: 0.08, wear: 0.3 })
    // door and windows on the street side
    g.add(new THREE.BoxGeometry(0.0045, 0.008, 0.001).translate(hs.x, 0.004, D / 2 + 0.0004), DARK, {})
    for (const wx of [-hs.w * 0.27, hs.w * 0.27]) g.add(new THREE.BoxGeometry(0.0035, 0.0045, 0.001).translate(hs.x + wx, hs.h * 0.7, D / 2 + 0.0004), DARK, {})
  }
  if (tower) {
    // the Halle's belfry: a square stone tower, a cornice, an octagonal lantern and a slate spire
    const tx = 0.033, tz = -0.004
    g.add(new THREE.BoxGeometry(0.012, 0.058, 0.012).translate(tx, 0.029, tz), STONE, { noise: 0.1, wear: 0.4 })
    g.add(new THREE.BoxGeometry(0.0145, 0.003, 0.0145).translate(tx, 0.0595, tz), STONE_D, { noise: 0.08 })
    g.add(new THREE.CylinderGeometry(0.0048, 0.0056, 0.011, 8).translate(tx, 0.0665, tz), STONE, { noise: 0.08 })
    g.add(new THREE.ConeGeometry(0.0062, 0.021, 8).translate(tx, 0.0825, tz), SLATE, { noise: 0.06 })
    g.add(new THREE.BoxGeometry(0.0045, 0.0045, 0.001).translate(tx, 0.048, tz + 0.0064), MORTAR, {}) // the clock
  }
  return { geo: g, roofs: [] }
}
