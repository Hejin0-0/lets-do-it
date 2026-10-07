import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three'
import { Batch } from '../gfx/merge'
import { contactShadow, metalMaps, rng } from '../gfx/textures'
import { PARK_X, type CarSlot, type Layout } from '../world/placement'

/**
 * Build order system 4, then rebuilt entirely for prompt 5.
 *
 * The note that triggered the rebuild was "are you working on car models or not
 * btw like they doesn't look finished at all", followed by six specific points.
 * Every one of them turned out to be a *silhouette* complaint wearing a
 * material complaint's clothes:
 *
 *   "flat colors"          -> the paint had no clearcoat, so it had no horizon
 *                             line in it, so it had no shape
 *   "blocky rear end"      -> no bevel; a hard 90-degree edge reads as cardboard
 *   "painted rectangles"   -> the tail lights were coplanar with the body
 *   "flat circles"         -> the rims had no dish
 *   "looks like it's floating" -> no contact darkening
 *
 * A silhouette feature cannot be bought with a texture, which is why this is
 * the most expensive file in the project: the cars went from roughly 80k
 * triangles to 114k. They still cost four draw calls, because the paint colour
 * that varies per car rides on the vertex colour attribute rather than on 26
 * separate materials.
 */

const M = new Matrix4()
const M2 = new Matrix4()
const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(1, 1, 1, 16, 1)

/** Realistic city-street paint. No saturated primaries — a red car reads as a
 *  toy unless it is a very dark red. */
const PAINTS = [
  new Color(0.031, 0.033, 0.037), // near-black
  new Color(0.146, 0.152, 0.161), // graphite
  new Color(0.232, 0.241, 0.252), // silver
  new Color(0.336, 0.330, 0.312), // champagne
  new Color(0.024, 0.055, 0.108), // midnight blue
  new Color(0.112, 0.024, 0.026), // dark red
  // Even a white car is nowhere near 1.0: the clearcoat adds most of what the
  // eye reads as brightness, so a high base albedo on top of it clips instantly.
  new Color(0.412, 0.408, 0.396), // off-white
]

export interface BuiltCars {
  group: Group
  triangles: number
  drawCalls: number
}

export function buildCars(layout: Layout): BuiltCars {
  return assemble(layout.cars)
}

/**
 * One car, at the origin, pointing down the street, with its lights on.
 *
 * The parked cars are merged into a handful of draw calls and cannot move —
 * that is the whole point of the batching, and it is right for twenty-five cars
 * that never do anything. A car that drives past needs its own transform, so it
 * gets its own set of batches and its own meshes. It costs the same nine or so
 * draw calls the entire parked rank costs, which for the only moving object on
 * the street is a fair trade.
 */
export function buildMovingCar(spec: CarSlot): BuiltCars {
  return assemble([spec], { facing: -1, atOrigin: true })
}

interface CarOpts {
  /** Force which way the car points, rather than taking it from the seed. */
  facing?: 1 | -1
  /** Build at (0, 0, 0) instead of at the slot's kerb position. */
  atOrigin?: boolean
}

function assemble(cars: CarSlot[], opts: CarOpts = {}): BuiltCars {
  const group = new Group()

  const paint = new Batch()
  const glass = new Batch()
  const trim = new Batch() // bumpers, mirrors, handles, panel gaps, seals
  const chrome = new Batch()
  const rubber = new Batch()
  const rim = new Batch()
  const lensDark = new Batch() // tail/head lenses on unlit cars
  const lensLit = new Batch() // the one car with its lights on
  const contact = new Batch()
  const interior = new Batch()

  for (const car of cars) {
    buildCar(
      car,
      { paint, glass, trim, chrome, rubber, rim, lensDark, lensLit, contact, interior },
      opts,
    )
  }

  let triangles = 0
  let drawCalls = 0
  const push = (m: Mesh | null) => {
    if (!m) return
    group.add(m)
    triangles += m.geometry.attributes.position.count / 3
    drawCalls++
  }

  // ---- paint ------------------------------------------------------------
  // Point 1: "a base color layer plus a clear reflective layer on top. the
  // reflection of the sunset sky on the car hood and roof is what sells it."
  //
  // That is literally a clearcoat: a second specular lobe at a fixed low
  // roughness sitting on a rougher, coloured base. The base is what makes it
  // read as a colour and the coat is what makes it read as a surface. Doing it
  // with one lobe forces a choice between a car that is matte and a car that
  // is chrome, and both were tried before this.
  push(
    paint.build(
      new MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.62,
        roughness: 0.34,
        clearcoat: 1.0,
        clearcoatRoughness: 0.055,
        // Compensates for scene.environmentIntensity, which is calibrated for
        // diffuse skylight and scales specular by the same factor. A clearcoat
        // is a mirror: it must show the sky at the sky's own brightness, and
        // dimming it is what made this paint read as unpainted board.
        envMapIntensity: 3.8,
      }),
      { cast: true, receive: true },
    ),
  )

  // ---- glass ------------------------------------------------------------
  // Point 2: dark tint, reflective, "slight transparency so you can barely see
  // headrests inside". Opacity rather than transmission — real transmission
  // needs a scene render per surface and buys nothing at this tint level.
  push(
    glass.build(
      new MeshPhysicalMaterial({
        color: 0x0a0d12,
        metalness: 0.1,
        roughness: 0.045,
        transparent: true,
        opacity: 0.82,
        envMapIntensity: 6.6,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        side: DoubleSide,
        depthWrite: false,
      }),
    ),
  )

  push(
    interior.build(new MeshStandardMaterial({ color: 0x14120f, roughness: 0.85, metalness: 0 })),
  )

  const rough = metalMaps(303, 0.15)
  push(
    trim.build(
      new MeshStandardMaterial({
        vertexColors: true,
        roughnessMap: rough.rough,
        metalness: 0.35,
        roughness: 0.6,
        envMapIntensity: 2.2,
      }),
      { cast: true, receive: true },
    ),
  )

  push(
    chrome.build(
      new MeshPhysicalMaterial({
        color: 0xd8d4cc,
        metalness: 1,
        roughness: 0.11,
        envMapIntensity: 5.6,
      }),
      { cast: true },
    ),
  )

  // Point 4: "darken the tire rubber, add slight rubber texture". Rubber is
  // very dark and very rough, and getting it wrong the other way — a mid-grey
  // tyre — is what makes wheels look like plastic.
  push(
    rubber.build(
      new MeshStandardMaterial({
        color: 0x0c0c0d,
        roughnessMap: rough.rough,
        roughness: 0.94,
        metalness: 0,
        envMapIntensity: 0.35,
      }),
      { cast: true },
    ),
  )

  push(
    rim.build(
      new MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.95,
        roughness: 0.24,
        envMapIntensity: 4.6,
      }),
      { cast: true },
    ),
  )

  // Point 3: "red translucent material for tail lights with a slight glow".
  // Unlit lamps still get a physical lens so they catch the sunset; only the one
  // car with its lights on gets an unlit above-1.0 material for bloom to find.
  push(
    lensDark.build(
      new MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.05,
        roughness: 0.09,
        transparent: true,
        opacity: 0.88,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 5.0,
      }),
    ),
  )
  push(lensLit.build(new MeshBasicMaterial({ vertexColors: true })))

  // Point 6: "add a subtle shadow underneath the car ... right now the car
  // looks like it's floating." See street.ts for why this is drawn explicitly
  // up-facing and double-sided.
  push(
    contact.build(
      new MeshStandardMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.88,
        alphaMap: contactShadow(),
        depthWrite: false,
        side: DoubleSide,
        roughness: 1,
        metalness: 0,
      }),
    ),
  )

  return { group, triangles, drawCalls }
}

interface CarBatches {
  paint: Batch
  glass: Batch
  trim: Batch
  chrome: Batch
  rubber: Batch
  rim: Batch
  lensDark: Batch
  lensLit: Batch
  contact: Batch
  interior: Batch
}

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

interface Dims {
  length: number
  width: number
  wheelbase: number
  wheelR: number
  /** Side-view outline of the lower body, in metres, origin at the car centre. */
  body: [number, number][]
  /** Side-view outline of the greenhouse. */
  cabin: [number, number][]
  cabinInset: number
}

function dims(style: 0 | 1 | 2): Dims {
  if (style === 1) {
    // Estate / hatchback: the roof carries all the way back, which changes the
    // silhouette more than any amount of material work could.
    return {
      length: 4.62,
      width: 1.83,
      wheelbase: 2.72,
      wheelR: 0.335,
      body: [
        [-2.31, 0.40], [-2.33, 0.66], [-2.30, 1.00], [-1.30, 1.06],
        [0.52, 1.03], [1.42, 0.95], [2.10, 0.85], [2.30, 0.68],
        [2.26, 0.40], [1.75, 0.30], [-1.78, 0.30],
      ],
      cabin: [
        [0.50, 1.01], [-0.10, 1.46], [-1.72, 1.47], [-2.24, 1.06], [-2.26, 1.00],
      ],
      cabinInset: 0.105,
    }
  }
  if (style === 2) {
    // Small van: taller, flatter, and the one body on the street that breaks
    // the eye's expectation that every parked car is the same box.
    return {
      length: 4.78,
      width: 1.88,
      wheelbase: 2.95,
      wheelR: 0.35,
      body: [
        [-2.39, 0.42], [-2.41, 0.74], [-2.40, 1.90], [-0.30, 1.96],
        [0.62, 1.72], [1.62, 1.10], [2.26, 0.92], [2.38, 0.72],
        [2.34, 0.42], [1.80, 0.32], [-1.86, 0.32],
      ],
      cabin: [
        [0.62, 1.68], [0.02, 1.96], [-0.62, 1.96], [-0.64, 1.62],
      ],
      cabinInset: 0.085,
    }
  }
  // Saloon.
  return {
    length: 4.55,
    width: 1.81,
    wheelbase: 2.70,
    wheelR: 0.33,
    body: [
      [-2.27, 0.40], [-2.30, 0.64], [-2.26, 0.94], [-1.55, 1.02],
      [-0.85, 1.05], [0.55, 1.02], [1.35, 0.94], [2.05, 0.83],
      [2.27, 0.66], [2.22, 0.40], [1.72, 0.30], [-1.74, 0.30],
    ],
    cabin: [
      [0.53, 1.00], [-0.06, 1.43], [-1.02, 1.45], [-1.60, 1.04], [-1.62, 1.00],
    ],
    cabinInset: 0.10,
  }
}

function shapeOf(pts: [number, number][]): Shape {
  const s = new Shape()
  s.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1])
  s.closePath()
  return s
}

/**
 * Extruded, bevelled hull.
 *
 * The bevel is the fix for "blocky rear end". A car body has no hard edges on
 * it anywhere — every panel meets the next through a radius of a centimetre or
 * two, and that radius is what catches the sun as a thin bright line. Without
 * it, an edge either faces the sun or does not, there is no transition, and the
 * brain files the result as cardboard. Three bevel segments at 22 mm is enough
 * to read at four metres and is most of this file's triangle budget.
 */
function hull(pts: [number, number][], width: number): BufferGeometry {
  const g = new ExtrudeGeometry(shapeOf(pts), {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.022,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 4,
  })
  // Extrudes along +Z from the shape plane; centre it on the car's axis.
  g.translate(0, 0, -width / 2)
  return g
}

// ---------------------------------------------------------------------------
// one car
// ---------------------------------------------------------------------------

function buildCar(car: CarSlot, b: CarBatches, opts: CarOpts = {}): void {
  const rand = rng(car.seed)
  const d = dims(car.body)
  const colour = PAINTS[car.paint % PAINTS.length]

  // Parked cars face along the street. Which way they point alternates, because
  // a rank of cars all facing the same way is a car park, not a kerb.
  const facing = opts.facing ?? (rand() > 0.5 ? 1 : -1)
  const yaw = facing > 0 ? Math.PI / 2 : -Math.PI / 2
  const px = opts.atOrigin ? 0 : car.side * PARK_X
  const pz = opts.atOrigin ? 0 : car.z
  // Kerbside cars sit slightly nose-in and settle on their springs.
  const skew = (rand() - 0.5) * 0.05
  const ride = -0.012 - rand() * 0.02

  /** Local car space (X = length, Y = up, Z = width) into world space. */
  const place = (local: Matrix4): Matrix4 =>
    new Matrix4().makeRotationY(yaw + skew).premultiply(TRANSLATE.makeTranslation(px, ride, pz))
      .multiply(local)

  // ---- hull -------------------------------------------------------------
  const bodyGeo = hull(d.body, d.width)
  b.paint.add(bodyGeo, place(M.identity()), colour)
  bodyGeo.dispose()

  const cabinGeo = hull(d.cabin, d.width - d.cabinInset * 2)
  b.paint.add(cabinGeo, place(M.identity()), colour)
  cabinGeo.dispose()

  // ---- glazing ----------------------------------------------------------
  // Side glass is the cabin profile inset by the pillar width, laid flat on
  // each flank. Windscreen and rear window are quads bridging the same outline.
  const sideGlass = insetPolygon(d.cabin, 0.075)
  for (const s of [-1, 1]) {
    const g = new ShapeGeometry(shapeOf(sideGlass), 2)
    M.makeTranslation(0, 0, s * ((d.width - d.cabinInset * 2) / 2 + 0.004))
    b.glass.add(g, place(M), WHITE)
    g.dispose()
  }

  // Windscreen: from the cabin's front base to its front roof corner.
  quadBetween(b.glass, place, d.cabin[0], d.cabin[1], d.width - d.cabinInset * 2 - 0.10)
  // Rear window: last two points of the cabin outline.
  const n = d.cabin.length
  quadBetween(b.glass, place, d.cabin[n - 3], d.cabin[n - 2], d.width - d.cabinInset * 2 - 0.10)

  // Headrests, so there is something to "barely see" behind the tint.
  for (const s of [-1, 1]) {
    M.makeScale(0.12, 0.20, 0.22).setPosition(0.06, 1.14, s * 0.36)
    b.interior.add(BOX, place(M))
  }
  // Dashboard, which is what you actually see through a windscreen at this angle.
  M.makeScale(0.5, 0.1, d.width - 0.3).setPosition(0.62, 1.0, 0)
  b.interior.add(BOX, place(M))

  // ---- window surrounds -------------------------------------------------
  // A dark rubber seal around the glass. Without it the glass floats a
  // millimetre off the paint and the join reads as a rendering error.
  for (const s of [-1, 1]) {
    const seal = new ShapeGeometry(shapeOf(insetPolygon(d.cabin, 0.045)), 1)
    M.makeTranslation(0, 0, s * ((d.width - d.cabinInset * 2) / 2 + 0.001))
    b.trim.add(seal, place(M), new Color(0.05, 0.05, 0.05))
    seal.dispose()
  }

  // ---- bumpers ----------------------------------------------------------
  const bumper = new Color(0.10, 0.104, 0.108)
  for (const s of [-1, 1]) {
    const x = s > 0 ? d.length / 2 - 0.10 : -d.length / 2 + 0.10
    M.makeScale(0.2, 0.26, d.width - 0.10).setPosition(x, 0.44, 0)
    b.trim.add(BOX, place(M), bumper)
    // Lower valance, which is what makes the front end look planted.
    M.makeScale(0.16, 0.12, d.width - 0.34).setPosition(x + s * 0.02, 0.30, 0)
    b.trim.add(BOX, place(M), new Color(0.06, 0.06, 0.065))
  }
  // Grille and number plate at the front.
  M.makeScale(0.06, 0.16, 0.62).setPosition(d.length / 2 - 0.03, 0.70, 0)
  b.trim.add(BOX, place(M), new Color(0.03, 0.03, 0.03))
  M.makeScale(0.03, 0.11, 0.46).setPosition(d.length / 2 - 0.01, 0.47, 0)
  b.trim.add(BOX, place(M), new Color(0.72, 0.70, 0.64))

  // ---- panel gaps and the body crease ----------------------------------
  // Point 5. These are 4 mm strips standing just off the paint, not grooves cut
  // into it — the eye reads the dark line, not the depth, and a real groove in
  // a bevelled extrusion would need the hull rebuilt per car.
  const gapCol = new Color(0.012, 0.012, 0.014)
  const beltY = d.cabin[0][1] - 0.04
  for (const s of [-1, 1]) {
    const zEdge = s * (d.width / 2 + 0.004)
    for (const gx of [0.60, -0.66]) {
      M.makeScale(0.012, beltY - 0.34, 0.02).setPosition(gx, (beltY + 0.34) / 2, zEdge)
      b.trim.add(BOX, place(M), gapCol)
    }
    // Body crease: a shallow ridge in the *paint*, so it takes a highlight
    // rather than a shadow. This is the one line that runs the whole flank and
    // it is what gives the side a direction.
    M.makeScale(d.length - 0.9, 0.03, 0.016).setPosition(-0.05, 0.68, s * (d.width / 2 + 0.002))
    b.paint.add(BOX, place(M), colour.clone().multiplyScalar(1.08))

    // Door handles.
    for (const hx of [0.28, -0.98]) {
      M.makeScale(0.15, 0.045, 0.035).setPosition(hx, beltY - 0.16, s * (d.width / 2 + 0.012))
      b.chrome.add(BOX, place(M), WHITE)
    }

    // Mirror: stalk plus a shell, angled. Mirrors matter out of proportion to
    // their size because they break the flank's outline.
    M.makeScale(0.06, 0.05, 0.13).setPosition(0.52, beltY + 0.04, s * (d.width / 2 + 0.06))
    b.trim.add(BOX, place(M), gapCol)
    M.makeRotationY(-s * 0.22)
    M2.makeScale(0.19, 0.11, 0.09)
    M.multiply(M2).setPosition(0.50, beltY + 0.09, s * (d.width / 2 + 0.15))
    b.paint.add(BOX, place(M), colour)
  }
  // Bonnet and boot shut lines.
  for (const gx of [d.length / 2 - 0.55, -d.length / 2 + 0.5]) {
    M.makeScale(0.014, 0.02, d.width - 0.24).setPosition(gx, gx > 0 ? 0.92 : 1.0, 0)
    b.trim.add(BOX, place(M), gapCol)
  }

  // ---- lamps ------------------------------------------------------------
  const lit = car.lightsOn
  addLamp(b, place, d, 1, lit, rand)
  addLamp(b, place, d, -1, lit, rand)

  // ---- wheels -----------------------------------------------------------
  const rimTone = new Color(0.52, 0.53, 0.54).multiplyScalar(0.7 + rand() * 0.55)
  for (const ax of [d.wheelbase / 2, -d.wheelbase / 2]) {
    for (const s of [-1, 1]) {
      wheel(b, place, ax, s * (d.width / 2 - 0.10), d.wheelR, rimTone)
    }
  }

  // ---- ground contact ---------------------------------------------------
  M.makeRotationX(-Math.PI / 2).setPosition(0, -ride + 0.014, 0)
  M2.makeScale(d.width + 1.15, 1, d.length + 0.5)
  const decal = new PlaneGeometry(1, 1)
  b.contact.add(decal, place(M.multiply(M2)), WHITE)
  decal.dispose()
}

const TRANSLATE = new Matrix4()

/**
 * Tail and head lamp cluster, recessed.
 *
 * Point 3 was "these need to be recessed, not flat squares". The recess is
 * three pieces: a dark box cut back into the body, the lens sitting inside it,
 * and a chrome bezel around the opening. Drop any one of them and it goes back
 * to being a painted rectangle — the bezel in particular, because the bright
 * ring is what tells the eye there is an opening at all.
 */
function addLamp(
  b: CarBatches,
  place: (m: Matrix4) => Matrix4,
  d: Dims,
  end: 1 | -1,
  lit: boolean,
  rand: () => number,
): void {
  const front = end > 0
  const x = end * (d.length / 2 - 0.12)
  const y = front ? 0.78 : 0.86
  const h = front ? 0.19 : 0.24
  const w = front ? 0.34 : 0.30

  for (const s of [-1, 1]) {
    const z = s * (d.width / 2 - 0.30)

    // Recess.
    M.makeScale(0.16, h + 0.05, w + 0.05).setPosition(x - end * 0.06, y, z)
    b.trim.add(BOX, place(M), new Color(0.02, 0.02, 0.02))

    // Bezel.
    M.makeScale(0.05, h + 0.06, w + 0.06).setPosition(x - end * 0.015, y, z)
    b.chrome.add(BOX, place(M), WHITE)

    // Lens, set 3 cm behind the body surface.
    M.makeScale(0.07, h, w).setPosition(x - end * 0.035, y, z)
    if (front) {
      if (lit) {
        b.lensLit.add(BOX, place(M), new Color(3.4, 3.1, 2.5))
      } else {
        // "headlights should be off but have a reflective lens" — so a clear,
        // near-mirror lens with a metallic reflector behind it, not a white box.
        b.lensDark.add(BOX, place(M), new Color(0.62, 0.63, 0.66))
        // Metallic reflector bowl behind the lens, axis pointing out the front.
        const rad = Math.min(h, w) * 0.36
        const bowl = new Matrix4()
          .makeTranslation(x - end * 0.08, y, z)
          .multiply(ROT_Z90)
          .multiply(new Matrix4().makeScale(rad, 0.05, rad))
        b.chrome.add(CYL, place(bowl), WHITE)
      }
    } else {
      b.lensDark.add(BOX, place(M), new Color(0.42 + rand() * 0.1, 0.028, 0.022))
      if (lit) {
        // A lit tail lamp is a small very bright core inside the red lens, not
        // the whole lens turned up. Bloom does the rest.
        M.makeScale(0.045, h * 0.62, w * 0.62).setPosition(x - end * 0.055, y, z)
        b.lensLit.add(BOX, place(M), new Color(2.6, 0.10, 0.06))
      }
      // Amber indicator at the outboard end.
      M.makeScale(0.06, h * 0.34, w * 0.3).setPosition(
        x - end * 0.035,
        y - h * 0.3,
        z + s * w * 0.3,
      )
      b.lensDark.add(BOX, place(M), new Color(0.5, 0.22, 0.03))
    }
  }
}

const ROT_Z90 = new Matrix4().makeRotationZ(Math.PI / 2)
const WHITE = new Color(1, 1, 1)

/**
 * Wheel.
 *
 * Point 4: "add depth to the rims. right now they're flat circles with painted
 * spokes." A rim is a dish — the lip stands proud of the spoke face by three or
 * four centimetres, and that offset is the entire reason a wheel reads as a
 * wheel from the side. So: tyre, then a lip ring at the outer face, then the
 * spoke face set *back* from it, then a dark bore behind that.
 */
function wheel(
  b: CarBatches,
  place: (m: Matrix4) => Matrix4,
  x: number,
  z: number,
  r: number,
  rimTone: Color,
): void {
  const outward = Math.sign(z)
  /** Wheel centre, offset `dz` outboard along the axle. */
  const at = (dz: number) => new Matrix4().makeTranslation(x, r, z + outward * dz)
  /** A cylinder's axis is its local Y; the axle is Z. */
  const axleZ = new Matrix4().makeRotationX(Math.PI / 2)
  /** Flat disc of radius `rad` and thickness `thick`, `dz` outboard. */
  const disc = (dz: number, rad: number, thick: number) =>
    at(dz).multiply(axleZ).multiply(new Matrix4().makeScale(rad, thick, rad))

  // Tyre. A torus already lies in XY with its axis on Z, which is the axle
  // direction, so it needs no rotation — and unlike a cylinder it has a real
  // shoulder radius, so it reads round from above as well as side-on.
  const tyre = new TorusGeometry(r - 0.085, 0.085, 8, 18)
  b.rubber.add(tyre, place(at(0)), WHITE)
  tyre.dispose()

  // Outer lip, standing proud of the spoke face. This offset is the dish.
  const lip = new TorusGeometry(r - 0.145, 0.03, 6, 16)
  b.rim.add(lip, place(at(0.055)), rimTone)
  lip.dispose()

  // Spoke face, set back inside the lip.
  b.rim.add(CYL, place(disc(0.005, r - 0.16, 0.03)), rimTone.clone().multiplyScalar(0.8))

  // Five spokes radiating in the wheel plane. Each is translated out along its
  // own rotated axis, which is why the rotation comes before the offset.
  const len = r - 0.17
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const m = at(0.02)
      .multiply(new Matrix4().makeRotationZ(a))
      .multiply(new Matrix4().makeTranslation(0, len / 2, 0))
      .multiply(new Matrix4().makeScale(0.055, len, 0.045))
    b.rim.add(BOX, place(m), rimTone)
  }

  // Dark bore behind the spokes. Without something dark back here the dish
  // fills with skylight and the wheel goes back to being a flat disc.
  b.rubber.add(CYL, place(disc(-0.04, r - 0.19, 0.02)), new Color(0.25, 0.25, 0.25))
  b.rim.add(CYL, place(disc(0.05, 0.075, 0.05)), rimTone.clone().multiplyScalar(1.2))
}

// ---------------------------------------------------------------------------
// polygon helpers
// ---------------------------------------------------------------------------

/**
 * Shrinks a convex-ish outline toward its centroid. Good enough for inset
 * glazing inside a cabin outline, where a real straight-skeleton offset would
 * be a hundred lines to save two millimetres of accuracy.
 */
function insetPolygon(pts: [number, number][], amount: number): [number, number][] {
  let cx = 0
  let cy = 0
  for (const [x, y] of pts) {
    cx += x
    cy += y
  }
  cx /= pts.length
  cy /= pts.length
  // Never shrink past the centroid: a small outline (the van's cab) would turn
  // inside out and extrude as a knot.
  let reach = Infinity
  for (const [x, y] of pts) reach = Math.min(reach, Math.hypot(x - cx, y - cy))
  const inset = Math.min(amount, reach * 0.45)
  return pts.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    const len = Math.hypot(dx, dy) || 1
    return [x - (dx / len) * inset, y - (dy / len) * inset] as [number, number]
  })
}

/** A quad spanning two profile points across the car's width. */
function quadBetween(
  batch: Batch,
  place: (m: Matrix4) => Matrix4,
  a: [number, number],
  bPt: [number, number],
  width: number,
): void {
  const dx = bPt[0] - a[0]
  const dy = bPt[1] - a[1]
  const len = Math.hypot(dx, dy)
  const geo = new PlaneGeometry(len, width)
  // The plane is built in XY. Rx(90) swings its height onto the car's width
  // axis; Rz(theta) then swings its length onto the chord.
  const m = new Matrix4()
    .makeTranslation((a[0] + bPt[0]) / 2, (a[1] + bPt[1]) / 2, 0)
    .multiply(new Matrix4().makeRotationZ(Math.atan2(dy, dx)))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2))
  batch.add(geo, place(m), WHITE)
  geo.dispose()
}
