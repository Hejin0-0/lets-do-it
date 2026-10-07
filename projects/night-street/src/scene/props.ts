import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  PlaneGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { Batch } from '../gfx/merge'
import { metalMaps, radialAlpha, rng } from '../gfx/textures'
import { contactDecal } from './street'
import { CURB_HEIGHT, type Layout, type Slot } from '../world/placement'

/**
 * Build order system 3: street-level detail.
 *
 * Prompt 3 point 2 asked for the street to "feel lived-in" and pointed at the
 * jungle project — "every pixel had something in it". The trap in that note is
 * that it reads as an instruction to add objects, and adding objects is what
 * sealed the pavement the first time. What actually produces the feeling is
 * *clustering*: bags next to the dumpster, crates outside the shop that is
 * open, a bike against the wall near a door. Eighty clustered props read as
 * denser than a hundred and seventy evenly-scattered ones, and leave room to
 * walk.
 *
 * The clustering lives in the layout table. This file only builds meshes.
 */

const M = new Matrix4()
const M2 = new Matrix4()
const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(1, 1, 1, 12, 1)
const CONE = new CylinderGeometry(0.01, 1, 1, 10, 1)
const BALL = new SphereGeometry(1, 10, 7)
const RING = new TorusGeometry(1, 0.09, 6, 14)
const CONTACT_QUAD = new PlaneGeometry(1, 1)
const SCALE = new Matrix4()

/** Lamp dimensions, shared with the lighting pass so the head and the light
 *  it emits cannot drift apart. */
export const LAMP = {
  postHeight: 5.1,
  armLength: 1.45,
  headY: 5.0,
  headRadius: 0.3,
}

/** Where a lamp's luminaire actually hangs: out over the road, not over the post. */
export function lampHead(slot: Slot): Vector3 {
  return new Vector3(
    slot.x - slot.side * LAMP.armLength,
    LAMP.headY,
    slot.z,
  )
}

export interface TrafficLight {
  /** Three lens materials, red/amber/green, in that order. */
  lenses: MeshBasicMaterial[]
  phase: number
}

export interface BuiltProps {
  group: Group
  lights: TrafficLight[]
  triangles: number
  drawCalls: number
}

export function buildProps(layout: Layout): BuiltProps {
  const group = new Group()
  const lights: TrafficLight[] = []

  const steel = new Batch() // posts, poles, rails, brackets
  const painted = new Batch() // dumpsters, boxes, meters, hydrants
  const timber = new Batch() // crates, pallets, planters, boards
  const soft = new Batch() // rubbish bags, tyres, foliage
  const contact = new Batch() // where each prop meets the pavement

  for (const p of layout.props) {
    const rand = rng(p.seed)
    const y = CURB_HEIGHT

    // Contact darkening.
    //
    // The visual critic's third finding, and the one that cost the most for the
    // least work: "wheel-to-asphalt, pole-base-to-pavement, sign-to-facade —
    // every junction is a clean value change with no darkening", which is why
    // objects read as composited rather than co-present. A real contact point is
    // the darkest pixel in the frame, darker than any cast shadow, and it falls
    // off within a few centimetres. Shadow maps cannot resolve that; a small
    // decal can.
    if (p.solid && p.kind !== 'lamp') {
      M.makeRotationX(-Math.PI / 2).setPosition(p.x, y + 0.013, p.z)
      const r = Math.max(p.hx, p.hz) * 2.9
      M.multiply(SCALE.makeScale(r, r, 1))
      contact.add(CONTACT_QUAD, M, new Color(1, 1, 1))
    }
    switch (p.kind) {
      case 'lamp':
        lampPost(steel, p)
        // The base plate is wider than the column, so its own contact patch is
        // its own size rather than the footprint's.
        M.makeRotationX(-Math.PI / 2).setPosition(p.x, y + 0.013, p.z)
        M.multiply(SCALE.makeScale(0.62, 0.62, 1))
        contact.add(CONTACT_QUAD, M, new Color(1, 1, 1))
        break
      case 'hydrant':
        hydrant(painted, p, y)
        break
      case 'dumpster':
        dumpster(painted, steel, group, p, y)
        break
      case 'trashbags':
        trashbags(soft, p, y, rand)
        break
      case 'newsbox':
        newsbox(painted, steel, p, y, rand)
        break
      case 'meter':
        meter(steel, painted, p, y)
        break
      case 'signpost':
        signpost(steel, painted, p, y, rand)
        break
      case 'trafficlight':
        lights.push(trafficLight(steel, group, p, y))
        break
      case 'bollard':
        M.makeScale(0.09, 0.9, 0.09).setPosition(p.x, y + 0.45, p.z)
        steel.add(CYL, M, new Color(0.3, 0.29, 0.28))
        M.makeScale(0.11, 0.06, 0.11).setPosition(p.x, y + 0.92, p.z)
        steel.add(CYL, M, new Color(0.5, 0.48, 0.45))
        break
      case 'planter':
        planter(timber, soft, p, y, rand)
        break
      case 'aframe':
        aframe(timber, p, y)
        break
      case 'crates':
        crates(timber, p, y, rand)
        break
      case 'bicycle':
        bicycle(steel, soft, p, y, rand)
        break
      case 'pallet':
        pallet(timber, p, y, rand)
        break
      default:
        // grate / manhole / puddle are drawn by the street module as decals.
        break
    }
  }

  let triangles = 0
  let drawCalls = 0
  const push = (m: Mesh | null) => {
    if (!m) return
    group.add(m)
    triangles += m.geometry.index
      ? m.geometry.index.count / 3
      : m.geometry.attributes.position.count / 3
    drawCalls++
  }

  const gal = metalMaps(77, 0.35)
  push(
    steel.build(
      new MeshStandardMaterial({
        map: gal.color,
        roughnessMap: gal.rough,
        vertexColors: true,
        metalness: 0.7,
        roughness: 0.55,
        envMapIntensity: 1.1,
      }),
      { cast: true, receive: true },
    ),
  )

  const paint = metalMaps(131, 0.5)
  push(
    painted.build(
      new MeshStandardMaterial({
        map: paint.color,
        roughnessMap: paint.rough,
        vertexColors: true,
        metalness: 0.25,
        roughness: 0.62,
        envMapIntensity: 0.85,
      }),
      { cast: true, receive: true },
    ),
  )

  push(
    timber.build(
      new MeshStandardMaterial({
        vertexColors: true,
        metalness: 0,
        roughness: 0.9,
        envMapIntensity: 0.35,
      }),
      { cast: true, receive: true },
    ),
  )

  // Bin bags are the one thing on the street with a wet-looking sheen at this
  // hour: stretched black polythene is nearly a mirror at a grazing angle, and
  // that highlight is what stops them reading as grey rocks.
  push(
    soft.build(
      new MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.1,
        roughness: 0.34,
        envMapIntensity: 1.3,
      }),
      { cast: true, receive: true },
    ),
  )

  push(
    contact.build(
      new MeshStandardMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.9,
        alphaMap: radialAlpha(2.1, 1),
        depthWrite: false,
        side: DoubleSide,
        roughness: 1,
        metalness: 0,
      }),
    ),
  )

  return { group, lights, triangles, drawCalls }
}

// ---------------------------------------------------------------------------
// individual props
// ---------------------------------------------------------------------------

const STEEL_DARK = new Color(0.26, 0.25, 0.24)

function lampPost(b: Batch, p: Slot): void {
  // Base casting.
  M.makeScale(0.16, 0.34, 0.16).setPosition(p.x, CURB_HEIGHT + 0.17, p.z)
  b.add(CYL, M, new Color(0.3, 0.29, 0.27))
  // Tapered column. Two segments rather than one, because a dead-straight
  // 5 m pole against a bright sky is the most obviously CG shape on a street.
  M.makeScale(0.075, LAMP.postHeight * 0.6, 0.075).setPosition(
    p.x,
    CURB_HEIGHT + LAMP.postHeight * 0.3,
    p.z,
  )
  b.add(CYL, M, STEEL_DARK)
  M.makeScale(0.058, LAMP.postHeight * 0.42, 0.058).setPosition(
    p.x,
    CURB_HEIGHT + LAMP.postHeight * 0.79,
    p.z,
  )
  b.add(CYL, M, STEEL_DARK)
  // Arm, angled out over the carriageway.
  M.makeRotationZ(p.side * 1.28)
  M2.makeScale(0.05, LAMP.armLength, 0.05)
  M.multiply(M2).setPosition(
    p.x - p.side * LAMP.armLength * 0.5,
    LAMP.headY + 0.16,
    p.z,
  )
  b.add(CYL, M, STEEL_DARK)
}

function hydrant(b: Batch, p: Slot, y: number): void {
  const red = new Color(0.62, 0.11, 0.08)
  M.makeScale(0.17, 0.52, 0.17).setPosition(p.x, y + 0.26, p.z)
  b.add(CYL, M, red)
  M.makeScale(0.16, 0.14, 0.16).setPosition(p.x, y + 0.58, p.z)
  b.add(BALL, M, red)
  M.makeScale(0.07, 0.1, 0.07).setPosition(p.x, y + 0.66, p.z)
  b.add(CYL, M, new Color(0.5, 0.48, 0.42))
  // Side outlets, which are most of the silhouette.
  for (const s of [-1, 1]) {
    M.makeRotationX(Math.PI / 2)
    M2.makeScale(0.075, 0.16, 0.075)
    M.multiply(M2).setPosition(p.x, y + 0.36, p.z + s * 0.16)
    b.add(CYL, M, red)
  }
  M.makeScale(0.24, 0.06, 0.24).setPosition(p.x, y + 0.03, p.z)
  b.add(CYL, M, new Color(0.4, 0.1, 0.07))
}

function dumpster(paint: Batch, steel: Batch, group: Group, p: Slot, y: number): void {
  const green = new Color(0.16, 0.28, 0.20)
  const w = p.hx * 2 - 0.06
  const d = p.hz * 2 - 0.06
  const h = 1.22
  M.makeScale(w, h, d).setPosition(p.x, y + h / 2 + 0.09, p.z)
  paint.add(BOX, M, green)
  // Sloped lid, cracked open. A closed flat lid is a box; the wedge is what
  // makes it a dumpster at fifty metres.
  M.makeRotationX(0.13)
  M2.makeScale(w + 0.06, 0.09, d + 0.08)
  M.multiply(M2).setPosition(p.x, y + h + 0.16, p.z)
  paint.add(BOX, M, new Color(0.12, 0.22, 0.16))
  // Corner ribs.
  for (const sz of [-1, 1]) {
    M.makeScale(w + 0.02, 0.09, 0.07).setPosition(p.x, y + 0.75, p.z + sz * (d / 2 - 0.1))
    paint.add(BOX, M, new Color(0.1, 0.2, 0.14))
  }
  // Castors, and the gap under them is why the contact decal matters.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      M.makeRotationX(Math.PI / 2)
      M2.makeScale(0.08, 0.05, 0.08)
      M.multiply(M2).setPosition(p.x + sx * (w / 2 - 0.12), y + 0.08, p.z + sz * (d / 2 - 0.18))
      steel.add(CYL, M, new Color(0.15, 0.14, 0.13))
    }
  }
  const decal = contactDecal(w + 0.9, d + 0.9)
  decal.position.set(p.x, y + 0.012, p.z)
  group.add(decal)
}

function trashbags(b: Batch, p: Slot, y: number, rand: () => number): void {
  const n = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const r = 0.16 + rand() * 0.1
    // Squashed, because a bag full of rubbish sags. Spheres read as boulders.
    M.makeScale(r * 1.15, r * 0.82, r * 1.05).setPosition(
      p.x + (rand() - 0.5) * p.hx * 1.4,
      y + r * 0.8,
      p.z + (rand() - 0.5) * p.hz * 1.5,
    )
    const v = 0.035 + rand() * 0.03
    b.add(BALL, M, new Color(v, v * 0.98, v * 0.95))
  }
}

function newsbox(paint: Batch, steel: Batch, p: Slot, y: number, rand: () => number): void {
  const hue = [0.02, 0.55, 0.11][Math.floor(rand() * 3)]
  const col = new Color().setHSL(hue, 0.5, 0.28)
  M.makeScale(p.hx * 2 - 0.04, 0.78, p.hz * 2 - 0.06).setPosition(p.x, y + 0.62, p.z)
  paint.add(BOX, M, col)
  // Glass front and the sloped hood over it.
  M.makeRotationX(-0.3)
  M2.makeScale(p.hx * 1.7, 0.05, 0.3)
  M.multiply(M2).setPosition(p.x, y + 1.03, p.z - p.hz * 0.6)
  paint.add(BOX, M, col)
  for (const sx of [-1, 1]) {
    M.makeScale(0.05, 0.24, 0.05).setPosition(p.x + sx * (p.hx - 0.08), y + 0.12, p.z)
    steel.add(BOX, M, STEEL_DARK)
  }
}

function meter(steel: Batch, paint: Batch, p: Slot, y: number): void {
  M.makeScale(0.055, 1.15, 0.055).setPosition(p.x, y + 0.58, p.z)
  steel.add(CYL, M, STEEL_DARK)
  M.makeScale(0.16, 0.3, 0.13).setPosition(p.x, y + 1.28, p.z)
  paint.add(BOX, M, new Color(0.22, 0.24, 0.26))
  M.makeScale(0.1, 0.12, 0.02).setPosition(p.x - p.side * 0.07, y + 1.32, p.z)
  paint.add(BOX, M, new Color(0.05, 0.06, 0.07))
}

function signpost(steel: Batch, paint: Batch, p: Slot, y: number, rand: () => number): void {
  M.makeScale(0.05, 2.5, 0.05).setPosition(p.x, y + 1.25, p.z)
  steel.add(CYL, M, STEEL_DARK)
  // Two plates at right angles, which is what a street-name post looks like
  // and also guarantees one of them is edge-on and one is face-on.
  const plates = 1 + Math.floor(rand() * 2)
  for (let i = 0; i < plates; i++) {
    const h = 2.35 - i * 0.4
    if (i % 2 === 0) {
      M.makeScale(0.03, 0.2, 0.9).setPosition(p.x, y + h, p.z)
    } else {
      M.makeScale(0.62, 0.44, 0.03).setPosition(p.x, y + h, p.z)
    }
    paint.add(BOX, M, i % 2 === 0 ? new Color(0.16, 0.3, 0.22) : new Color(0.7, 0.68, 0.64))
  }
}

/**
 * The brief asks for "traffic lights cycling through colours". Three lenses per
 * head, and the housing hoods over each one — without the hoods a traffic light
 * is three dots on a stick.
 */
function trafficLight(steel: Batch, group: Group, p: Slot, y: number): TrafficLight {
  M.makeScale(0.09, 6.0, 0.09).setPosition(p.x, y + 3.0, p.z)
  steel.add(CYL, M, STEEL_DARK)
  M.makeRotationZ(p.side * Math.PI * 0.5)
  M2.makeScale(0.07, 2.6, 0.07)
  M.multiply(M2).setPosition(p.x - p.side * 1.3, y + 5.9, p.z)
  steel.add(CYL, M, STEEL_DARK)

  const hx = p.x - p.side * 2.4
  const hy = y + 5.2
  M.makeScale(0.3, 1.0, 0.26).setPosition(hx, hy, p.z)
  steel.add(BOX, M, new Color(0.14, 0.15, 0.14))

  const lenses: MeshBasicMaterial[] = []
  const colours = [new Color(1, 0.1, 0.05), new Color(1, 0.62, 0.06), new Color(0.12, 1, 0.3)]
  for (let i = 0; i < 3; i++) {
    const ly = hy + 0.33 - i * 0.33
    // Lens: unlit, driven above 1.0 when on so bloom catches it.
    const mat = new MeshBasicMaterial({ color: colours[i].clone().multiplyScalar(0.09) })
    const lens = new Mesh(new CylinderGeometry(0.095, 0.095, 0.04, 12), mat)
    lens.rotation.z = Math.PI / 2
    lens.position.set(hx - p.side * 0.15, ly, p.z)
    group.add(lens)
    lenses.push(mat)

    // Hood.
    //
    // A visor shades a lens from *above*. This sat 4 cm above the lens centre
    // with a 13 cm radius against the lens's 9.5 cm, so the cone's base covered
    // almost the whole lens and what was left showing was the sliver below it —
    // every signal on the street read as a crescent moon rather than as a lit
    // disc. Reported from play as exactly that. Raised so it clips the top of
    // the lens and no more, which is what a real hood does.
    M.makeRotationZ(p.side * Math.PI * 0.5)
    M2.makeScale(0.115, 0.16, 0.115)
    M.multiply(M2).setPosition(hx - p.side * 0.22, ly + 0.17, p.z)
    steel.add(CONE, M, new Color(0.1, 0.11, 0.1))
  }
  return { lenses, phase: Math.abs(p.z) * 0.37 }
}

function planter(timber: Batch, soft: Batch, p: Slot, y: number, rand: () => number): void {
  const w = p.hx * 2 - 0.06
  M.makeScale(w, 0.5, p.hz * 2 - 0.06).setPosition(p.x, y + 0.25, p.z)
  timber.add(BOX, M, new Color(0.24, 0.19, 0.14))
  M.makeScale(w + 0.05, 0.06, p.hz * 2).setPosition(p.x, y + 0.52, p.z)
  timber.add(BOX, M, new Color(0.3, 0.24, 0.18))
  // Shrub as a few overlapping squashed spheres. Not a plant, but the right
  // silhouette, and it is 0.6 m tall in the corner of the frame.
  for (let i = 0; i < 4; i++) {
    const r = 0.12 + rand() * 0.13
    M.makeScale(r, r * 0.85, r).setPosition(
      p.x + (rand() - 0.5) * w * 0.7,
      y + 0.55 + rand() * 0.28,
      p.z + (rand() - 0.5) * p.hz,
    )
    soft.add(BALL, M, new Color(0.09 + rand() * 0.06, 0.13 + rand() * 0.07, 0.05))
  }
}

function aframe(timber: Batch, p: Slot, y: number): void {
  for (const s of [-1, 1]) {
    M.makeRotationX(s * 0.16)
    M2.makeScale(0.56, 0.86, 0.035)
    M.multiply(M2).setPosition(p.x, y + 0.45, p.z + s * 0.09)
    timber.add(BOX, M, new Color(0.14, 0.13, 0.12))
  }
}

function crates(timber: Batch, p: Slot, y: number, rand: () => number): void {
  let h = y
  const n = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < n; i++) {
    const s = 0.3 - i * 0.02
    M.makeRotationY((rand() - 0.5) * 0.5)
    M2.makeScale(s * 2, 0.24, s * 1.7)
    M.multiply(M2).setPosition(
      p.x + (rand() - 0.5) * 0.08,
      h + 0.12,
      p.z + (rand() - 0.5) * 0.08,
    )
    timber.add(BOX, M, new Color(0.3 + rand() * 0.12, 0.22, 0.14))
    h += 0.24
  }
}

function bicycle(steel: Batch, soft: Batch, p: Slot, y: number, rand: () => number): void {
  const lean = 0.22 + rand() * 0.12
  const rot = p.rot
  // Wheels first: they are the whole silhouette.
  for (const s of [-1, 1]) {
    M.makeRotationY(rot)
    M2.makeScale(0.33, 0.33, 0.33)
    M.multiply(M2).setPosition(
      p.x + Math.sin(rot) * s * 0.55 + lean * 0.3,
      y + 0.33,
      p.z + Math.cos(rot) * s * 0.55,
    )
    soft.add(RING, M, new Color(0.03, 0.03, 0.03))
  }
  // Frame as three struts. Not a bicycle up close; correct at four metres.
  const bar = (dx: number, dy: number, dz: number, len: number, tilt: number) => {
    M.makeRotationZ(tilt)
    M2.makeScale(0.035, len, 0.035)
    M.multiply(M2).setPosition(p.x + dx + lean * 0.3, y + dy, p.z + dz)
    steel.add(CYL, M, new Color(0.2 + rand() * 0.3, 0.22, 0.25))
  }
  bar(0, 0.62, 0, 0.95, Math.PI / 2 + rot * 0.1)
  bar(0.05, 0.44, Math.cos(rot) * 0.2, 0.55, 0.7)
  bar(0.05, 0.5, Math.cos(rot) * -0.3, 0.7, -0.4)
  M.makeScale(0.05, 0.16, 0.28).setPosition(p.x + lean * 0.3, y + 0.86, p.z - Math.cos(rot) * 0.35)
  soft.add(BOX, M, new Color(0.04, 0.04, 0.04))
}

function pallet(timber: Batch, p: Slot, y: number, rand: () => number): void {
  // Leaning on the wall, which is where pallets live and what makes them a
  // vertical shape rather than a floor shape.
  const lean = 0.18
  const wood = new Color(0.36, 0.29, 0.2)
  for (let i = 0; i < 5; i++) {
    M.makeRotationX(-p.side * lean)
    M2.makeScale(0.11, 1.15, 0.1)
    M.multiply(M2).setPosition(
      p.x + p.side * 0.03 * i - p.side * 0.06,
      y + 0.58,
      p.z - 0.5 + i * 0.25 + (rand() - 0.5) * 0.03,
    )
    timber.add(BOX, M, wood.clone().multiplyScalar(0.85 + rand() * 0.3))
  }
  for (const t of [0.15, 0.62, 1.05]) {
    M.makeRotationX(-p.side * lean)
    M2.makeScale(0.13, 0.09, 1.2)
    M.multiply(M2).setPosition(p.x, y + t, p.z)
    timber.add(BOX, M, wood)
  }
}
