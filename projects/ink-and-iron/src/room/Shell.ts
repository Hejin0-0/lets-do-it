// The hall's shell (DESIGN §9 Room): flagstone floor (one non-repeating canvas, smoother along the
// aisle), ashlar walls with the three north lancet openings, and a timber hammerbeam roof rising
// to 10.5 m. Walls and roof are closed so the moon (a shadowed directional light) only enters
// through the glass.
import * as THREE from 'three'
import { roomMat } from '../render/MaterialLibrary.ts'
import { Batch, REGION, T, archPts, archRise, extrude, lancetPath, lathe, ribAlong } from './Kit.ts'
import { HALL, LANCETS } from './Layout.ts'

const STONE = 0xc8b8a4
const ROOF = 0x74604c
const ROOF_BOARD = 0x5a4838
const TRUSS_Z = [-8.4, -6.0, -3.6, -1.2, 1.2, 3.6, 6.0]
export const ROOF_SLOPE = (HALL.ridge - HALL.wallTop) / HALL.x

/** Underside of the roof boards at |x|. */
export const roofY = (ax: number) => HALL.wallTop + (HALL.x - ax) * ROOF_SLOPE

export function buildFloor(): THREE.Mesh {
  const g = new THREE.PlaneGeometry(HALL.x * 2, HALL.zS - HALL.zN)
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0, (HALL.zN + HALL.zS) / 2)
  const m = new THREE.Mesh(g, roomMat('floor'))
  m.name = 'floor'
  m.receiveShadow = true
  m.userData.region = REGION.floor
  return m
}

export function buildShell(b: Batch): void {
  const { x: X, zN, zS, wallTop, ridge } = HALL
  const W = 0.6
  // gable walls (north pierced by the lancets)
  const gable = (holes: boolean) => {
    const s = new THREE.Shape()
    s.moveTo(-X - W, -0.05); s.lineTo(X + W, -0.05); s.lineTo(X + W, wallTop + 0.2); s.lineTo(0, ridge + 0.6); s.lineTo(-X - W, wallTop + 0.2); s.closePath()
    if (holes) for (const l of LANCETS) s.holes.push(lancetPath(l.w, l.h, l.x, l.y))
    return extrude(s, W)
  }
  b.add('ashlarV', gable(true), T(0, 0, zN - W), STONE, REGION.other)
  b.add('ashlarV', gable(false), T(0, 0, zS), STONE, REGION.other)
  for (const sx of [-1, 1]) {
    b.box('ashlarV', sx * X, -0.05, zN - W, sx * (X + W), wallTop + 0.25, zS + W, STONE, REGION.other)
    // string course under the wall plate
    b.box('ashlarV', sx * (X - 0.14), wallTop - 0.16, zN, sx * X, wallTop - 0.02, zS, 0xb0a08c, REGION.ceiling)
  }
  // roof boards: two slabs from the wall plate to the ridge, overlapping at both ends
  const run = Math.hypot(X, ridge - wallTop) + 0.5
  const ang = Math.atan(ROOF_SLOPE)
  for (const sx of [-1, 1]) {
    const cx = sx * X / 2, cy = (wallTop + ridge) / 2
    const g = new THREE.BoxGeometry(run, 0.14, zS - zN + 2 * W)
    // box's lower face on the roof line
    g.translate(0, 0.07, 0)
    b.add('oakV', g, T(cx, cy, (zN + zS) / 2, 0, 0, -sx * ang), ROOF_BOARD, REGION.ceiling)
  }
  // common rafters between the trusses
  for (let z = zN + 0.3; z < zS - 0.2; z += 0.62) {
    if (TRUSS_Z.some((t) => Math.abs(t - z) < 0.3)) continue
    for (const sx of [-1, 1]) {
      const g = new THREE.BoxGeometry(run - 0.4, 0.12, 0.08)
      g.translate(0, -0.06, 0)
      b.add('oakV', g, T(sx * X / 2, (wallTop + ridge) / 2, z, 0, 0, -sx * ang), ROOF, REGION.ceiling)
    }
  }
  // ridge beam and purlins
  b.box('oakV', -0.13, ridge - 0.3, zN, 0.13, ridge + 0.05, zS, ROOF, REGION.ceiling)
  for (const ax of [2.0, 3.8]) for (const sx of [-1, 1]) {
    const y = roofY(ax)
    b.box('oakV', sx * (ax - 0.1), y - 0.24, zN, sx * (ax + 0.1), y + 0.02, zS, ROOF, REGION.ceiling)
  }
  for (const z of TRUSS_Z) truss(b, z)
}

function truss(b: Batch, z: number): void {
  const { x: X, wallTop } = HALL
  const d = 0.2
  const collarY = 9.5
  const collarX = X - (collarY + 0.12 - wallTop) / ROOF_SLOPE
  for (const sx of [-1, 1]) {
    // stone corbel, wall post, hammer beam, carved pendant
    b.box('ashlarV', sx * (X - 0.3), 6.78, z - 0.17, sx * X, 6.98, z + 0.17, 0xb8a894, REGION.ceiling)
    b.box('ashlarV', sx * (X - 0.24), 6.62, z - 0.12, sx * X, 6.78, z + 0.12, 0xb0a08c, REGION.ceiling)
    b.box('oakV', sx * (X - 0.22), 6.98, z - d / 2, sx * X, wallTop + 0.05, z + d / 2, ROOF, REGION.ceiling)
    b.box('oakV', sx * 4.3, wallTop + 0.05, z - 0.12, sx * X, wallTop + 0.3, z + 0.12, ROOF, REGION.ceiling)
    b.add('oakV', lathe([[0, 0], [0.05, 0.02], [0.07, 0.1], [0.05, 0.16], [0.08, 0.26], [0.06, 0.32], [0.06, 0.36]], 10),
      T(sx * 4.38, wallTop + 0.08, z, Math.PI, 0, 0), ROOF, REGION.ceiling)
    // lower arch brace: quarter circle from the post foot to the hammer beam's end
    const r = X - 0.22 - 4.42
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI / 2
      pts.push(new THREE.Vector2(sx * (4.42 + r * Math.cos(a)), 6.98 + r * Math.sin(a)))
    }
    b.add('oakV', ribAlong(pts, 0.13, 0.16), T(0, 0, z - 0.08), ROOF, REGION.ceiling)
    // principal rafter under the boards
    const run = Math.hypot(X, HALL.ridge - wallTop)
    const g = new THREE.BoxGeometry(run, 0.26, 0.2)
    g.translate(0, -0.13, 0)
    b.add('oakV', g, T(sx * X / 2, (wallTop + HALL.ridge) / 2, z, 0, 0, -sx * Math.atan(ROOF_SLOPE)), ROOF, REGION.ceiling)
  }
  // upper arch brace: a flattened pointed arch from hammer beam to hammer beam under the collar
  const w = 2 * 4.4
  const k = (collarY - (wallTop + 0.3)) / archRise(w, w * 0.62)
  const pts = archPts(w, 0, w * 0.62, 18).map((p) => new THREE.Vector2(p.x, wallTop + 0.3 + p.y * k))
  b.add('oakV', ribAlong(pts, 0.16, 0.16), T(0, 0, z - 0.08), ROOF, REGION.ceiling)
  b.box('oakV', -collarX, collarY, z - 0.1, collarX, collarY + 0.22, z + 0.1, ROOF, REGION.ceiling)
  b.box('oakV', -0.08, collarY + 0.22, z - 0.08, 0.08, HALL.ridge - 0.25, z + 0.08, ROOF, REGION.ceiling)
  b.add('oakV', lathe([[0, 0], [0.06, 0.02], [0.09, 0.1], [0.05, 0.2], [0.07, 0.24], [0.07, 0.28]], 10),
    T(0, collarY + 0.02, z, Math.PI, 0, 0), ROOF, REGION.ceiling)
}
