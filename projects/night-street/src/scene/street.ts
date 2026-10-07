import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  CatmullRomCurve3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { Batch } from '../gfx/merge'
import {
  asphaltMaps,
  concreteMaps,
  contactShadow,
  groundGrime,
  laneStripe,
  metalMaps,
  radialAlpha,
  rng,
} from '../gfx/textures'
import {
  CURB_HEIGHT,
  END_Z,
  ROAD_HALF,
  START_Z,
  WALK_HALF,
  type Layout,
} from '../world/placement'

/**
 * Build order system 1: road and pavement.
 *
 * Two things here are worth more than they cost. The road has a camber, so it
 * is not a flat plane — reflections of the sky bend across it and the kerbside
 * gutter catches light the crown does not, which is most of what makes wet
 * asphalt read as wet. And the pavement is a separate surface at kerb height
 * with its own material, so the kerb line is a real edge with a real shadow
 * rather than a painted stripe.
 */

const M = new Matrix4()
const M2 = new Matrix4()

export function buildStreet(layout: Layout): Group {
  const group = new Group()
  // Overrun past the built block at each end.
  //
  // Not symmetric, and not arbitrary. Each end is closed by a terrace across the
  // street (see closingTerrace in buildings.ts) and those need ground under them
  // *and* enough distance to read as the next block rather than as a wall in
  // your face — the first attempt put the near one 1.5 m from where the player
  // can stand and the view was simply a dark rectangle. The far end needs more
  // because the buildings themselves already run 63 m past the end of the walk.
  const NEAR_OVERRUN = 34
  const FAR_OVERRUN = 50
  const length = START_Z - END_Z + NEAR_OVERRUN + FAR_OVERRUN
  const midZ = (START_Z + END_Z) / 2 + (NEAR_OVERRUN - FAR_OVERRUN) / 2

  // ---- road -------------------------------------------------------------
  const asphalt = asphaltMaps()
  const roadMat = new MeshStandardMaterial({
    map: asphalt.color,
    roughnessMap: asphalt.rough,
    normalMap: asphalt.normal,
    metalness: 0,
    roughness: 1,
    // The damp patches in the roughness map only pay off if there is something
    // to reflect. This is the probe convolved from the sky shader.
    envMapIntensity: 2.6,
  })
  roadMat.normalScale.set(0.55, 0.55)

  // Segmented so the camber is real geometry. 1 m along, 0.45 m across.
  const road = new Mesh(
    new PlaneGeometry(ROAD_HALF * 2, length, 24, Math.round(length)),
    roadMat,
  )
  road.rotation.x = -Math.PI / 2
  road.position.z = midZ
  camber(road)
  road.receiveShadow = true
  road.frustumCulled = false
  group.add(road)

  // ---- pavements --------------------------------------------------------
  const concrete = concreteMaps()
  const walkMat = new MeshStandardMaterial({
    map: concrete.color,
    roughnessMap: concrete.rough,
    normalMap: concrete.normal,
    metalness: 0,
    roughness: 1,
    envMapIntensity: 0.5,
  })
  walkMat.normalScale.set(0.4, 0.4)

  const walkWidth = WALK_HALF - ROAD_HALF
  for (const side of [-1, 1]) {
    const walk = new Mesh(new PlaneGeometry(walkWidth, length), walkMat)
    walk.rotation.x = -Math.PI / 2
    walk.position.set(side * (ROAD_HALF + walkWidth / 2), CURB_HEIGHT, midZ)
    walk.receiveShadow = true
    walk.frustumCulled = false
    group.add(walk)
  }

  // ---- kerbs ------------------------------------------------------------
  // Granite, not concrete: a kerb is a different stone from the slab behind it
  // and catches the low sun along its top arris, which is the brightest line in
  // the lower half of the frame.
  const kerbMat = new MeshStandardMaterial({
    map: concrete.color,
    roughnessMap: concrete.rough,
    color: new Color(0.72, 0.71, 0.68),
    metalness: 0,
    roughness: 0.82,
    envMapIntensity: 0.7,
  })
  const kerbBatch = new Batch()
  const kerbGeo = new BoxGeometry(0.22, CURB_HEIGHT, 1)
  for (const side of [-1, 1]) {
    // One box per metre, with a slight per-unit height jitter. A perfectly
    // level kerb over 200 m is the one thing no real street has.
    for (let z = START_Z + 30; z > END_Z - 30; z -= 1) {
      const h = 1 + (Math.sin(z * 12.9898) * 0.5 + 0.5) * 0.16
      M.makeScale(1, h, 1).setPosition(
        side * (ROAD_HALF - 0.11),
        (CURB_HEIGHT * h) / 2,
        z,
      )
      kerbBatch.add(kerbGeo, M)
    }
  }
  const kerb = kerbBatch.build(kerbMat, { receive: true, cast: true })
  if (kerb) group.add(kerb)

  // ---- lane markings ----------------------------------------------------
  // Drawn as separate strips lifted a millimetre off the road. Painting them
  // into the asphalt texture would tie the paint's resolution to the road's.
  // The stripe textures are memoised and shared, so each consumer that wants a
  // different repeat has to clone. Setting `repeat` on the shared instance made
  // the edge lines and the crossings fight over one transform, last writer wins.
  const paintMat = (dashed: boolean, repeatY: number, rotate = false) => {
    const map = laneStripe(dashed).clone()
    map.repeat.set(1, repeatY)
    if (rotate) {
      map.center.set(0.5, 0.5)
      map.rotation = Math.PI / 2
    }
    map.needsUpdate = true
    return new MeshStandardMaterial({
      map,
      transparent: true,
      metalness: 0,
      roughness: 0.72,
      envMapIntensity: 0.4,
      depthWrite: false,
      side: DoubleSide,
    })
  }

  const centre = new Mesh(new PlaneGeometry(0.14, length), paintMat(true, length / 2.6))
  centre.rotation.x = -Math.PI / 2
  centre.position.set(0, 0.006, midZ)
  centre.frustumCulled = false
  group.add(centre)

  // Solid line separating the running lane from the parking lane.
  for (const side of [-1, 1]) {
    const edge = new Mesh(new PlaneGeometry(0.12, length), paintMat(false, length / 4))
    edge.rotation.x = -Math.PI / 2
    edge.position.set(side * 2.55, 0.006 - side * 0.0004, midZ)
    edge.frustumCulled = false
    group.add(edge)
  }

  // ---- crossings --------------------------------------------------------
  // At the same two z values as the traffic lights in the layout table.
  const zebra = new Batch()
  // Long in X, short in Z: the bars run *across* the carriageway. The texture
  // is rotated so its worn edges fade along the bar's short axis.
  const barGeo = new PlaneGeometry(ROAD_HALF * 2 - 0.3, 0.45)
  for (const z of [START_Z - 1.5, -74.5]) {
    for (let i = -4; i <= 4; i++) {
      M.makeRotationX(-Math.PI / 2).setPosition(0, 0.007, z + i * 0.82)
      zebra.add(barGeo, M)
    }
  }
  const zebraMesh = zebra.build(paintMat(false, 1, true))
  if (zebraMesh) group.add(zebraMesh)

  // ---- overhead cables ---------------------------------------------------
  group.add(buildCables())

  // ---- road-surface decals ---------------------------------------------
  group.add(buildDecals(layout))

  return group
}

/**
 * Height of the road surface at a given x. Anything drawn flat on the road —
 * the lamp pools especially — has to follow this or it floats 13 cm above the
 * gutter and reads as a card at grazing angles.
 */
export function roadY(x: number): number {
  const t = Math.min(1, Math.abs(x) / ROAD_HALF)
  return -0.13 * t * t
}

/**
 * Road camber. Real carriageways fall about 2.5% from crown to gutter so water
 * leaves; it is a 13 cm drop over this road's half-width. Invisible as a shape,
 * very visible as a reflection — the sun's streak on the wet road narrows and
 * bends near the kerb instead of running dead straight.
 */
function camber(road: Mesh): void {
  const pos = road.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    // The plane is built in XY and rotated -90 about X, which maps local +Z to
    // world +Y. So the gutter is a *negative* local Z, and the crown is zero.
    pos.setZ(i, roadY(x))
  }
  pos.needsUpdate = true
  road.geometry.computeVertexNormals()
}

/** Manholes, gutter grates and damp patches, from the layout table. */
function buildDecals(layout: Layout): Group {
  const g = new Group()
  const iron = metalMaps(404, 0.55)

  const metalMat = new MeshStandardMaterial({
    map: iron.color,
    roughnessMap: iron.rough,
    color: new Color(0.42, 0.4, 0.38),
    metalness: 0.65,
    roughness: 0.7,
    envMapIntensity: 0.8,
  })
  const metal = new Batch()
  const discGeo = new PlaneGeometry(0.86, 0.86)
  const grateGeo = new PlaneGeometry(0.8, 0.5)

  // Damp patches are a separate material: near-mirror roughness is the whole
  // point of them and they must not share the iron's roughness map.
  const wetMat = new MeshStandardMaterial({
    color: new Color(0.035, 0.036, 0.042),
    metalness: 0.1,
    roughness: 0.09,
    transparent: true,
    opacity: 0.72,
    alphaMap: radialAlpha(1.4, 1),
    depthWrite: false,
    envMapIntensity: 6.0,
  })
  const wet = new Batch()
  const puddleGeo = new PlaneGeometry(2.6, 3.8)

  // ---- contact shadows ---------------------------------------------------
  //
  // The blind critic's first finding, and it was right: a bin standing in the
  // brightest part of a lamp's pool had nothing dark beside it, so every prop
  // read as pasted onto the ground rather than standing on it. A shadow is the
  // primary cue that an object is *on* a surface.
  //
  // Not shadow maps. The sun's intensity is zero after dark so its map is
  // switched off, and giving seven point lights a map each is several full
  // passes over the scene — the profiler put one point light at 0.68 ms and a
  // shadow-casting one is far worse. A contact shadow is the part of the effect
  // that carries the cue: darkest right at the contact, gone within a foot,
  // present from every angle. The cars have had one since the first pass; this
  // gives one to everything else.
  const shade = new Batch()
  const shadeGeo = new PlaneGeometry(1, 1)
  for (const p of layout.props) {
    if (!p.solid) continue
    // Generous against the footprint: a shadow is wider than the thing casting
    // it under a light that is five metres up and never directly overhead.
    const w = p.hx * 2 + 0.55
    const d = p.hz * 2 + 0.55
    M.makeRotationX(-Math.PI / 2)
    M2.makeScale(w, d, 1)
    M.multiply(M2)
    M.setPosition(p.x, Math.abs(p.x) > ROAD_HALF ? CURB_HEIGHT + 0.012 : 0.012, p.z)
    shade.add(shadeGeo, M)
  }
  const shadeMesh = shade.build(
    new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      alphaMap: contactShadow(),
      depthWrite: false,
      side: DoubleSide,
    }),
  )
  if (shadeMesh) {
    // Under the light pools, which are additive and drawn later: the shadow has
    // to darken the ground *before* the lamp adds to it, or a prop standing in a
    // pool gets its shadow washed straight back out.
    shadeMesh.renderOrder = -1
    g.add(shadeMesh)
  }

  for (const p of layout.props) {
    if (p.kind === 'manhole' || p.kind === 'grate') {
      M.makeRotationX(-Math.PI / 2)
      M.setPosition(p.x, 0.008, p.z)
      metal.add(p.kind === 'manhole' ? discGeo : grateGeo, M)
    } else if (p.kind === 'puddle') {
      M.makeRotationX(-Math.PI / 2)
      M.setPosition(p.x, 0.009, p.z)
      wet.add(puddleGeo, M)
    }
  }

  // ---- grime on the ground -----------------------------------------------
  //
  // Splitting the blank-tile measurement into "dark" and "lit but empty" put the
  // remaining actionable blankness on the *lit* ground: pavement inside a lamp's
  // pool, brightly lit and perfectly smooth. The blind critic reached the same
  // place from the images — "the pavement has no slab joints, no cracks, no
  // colour variation". Real ground under a light is a century of spills and
  // patched trenches, and none of that is geometry.
  //
  // Placed densest where the lamps are, because that is both where it shows and
  // where the measurement says it is missing.
  const grimeMat = new MeshStandardMaterial({
    color: new Color(0.09, 0.085, 0.08),
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
    alphaMap: groundGrime(31),
    depthWrite: false,
    side: DoubleSide,
  })
  const grime = new Batch()
  const grimeGeo = new PlaneGeometry(1, 1)
  const grand = rng(5501)
  for (const p of layout.props) {
    if (p.kind !== 'lamp') continue
    const n = 5 + Math.floor(grand() * 4)
    for (let i = 0; i < n; i++) {
      // Scattered around the lamp, on the pavement and out into the road.
      const r = 1.2 + grand() * 6.5
      const a = grand() * Math.PI * 2
      const gx = p.x + Math.cos(a) * r * 0.55
      const gz = p.z + Math.sin(a) * r
      if (Math.abs(gx) > WALK_HALF - 0.3) continue
      const onWalk = Math.abs(gx) > ROAD_HALF
      const size = 0.7 + grand() * 2.4
      M.makeRotationX(-Math.PI / 2)
      M2.makeScale(size, size * (0.6 + grand() * 0.9), 1)
      M.multiply(M2)
      M.setPosition(gx, onWalk ? CURB_HEIGHT + 0.011 : 0.011, gz)
      grime.add(grimeGeo, M)
    }
  }
  const grimeMesh = grime.build(grimeMat)
  if (grimeMesh) {
    grimeMesh.renderOrder = -2
    g.add(grimeMesh)
  }

  const m = metal.build(metalMat)
  if (m) g.add(m)
  const w = wet.build(wetMat)
  if (w) g.add(w)
  return g
}

/**
 * Ground-contact darkening, used under the cars and the dumpsters.
 *
 * This is the term from prompt 5 point 6 — "the car looks like it's floating".
 * It shipped broken the first time: the quads were wound so the decal faced
 * down into the road, which meant the frame was bit-identical with the effect
 * on and off. A term measuring exactly 1.000 against its own control is not a
 * subtle effect, it is a disconnected one, and the giveaway was that the number
 * was *too* clean.
 *
 * Hence `side: DoubleSide` and the explicit up-facing rotation here rather than
 * relying on whatever winding the caller's matrix happens to produce.
 */
export function contactDecal(width: number, depth: number): Mesh {
  const mat = new MeshStandardMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.85,
    alphaMap: contactShadow(),
    depthWrite: false,
    side: DoubleSide,
    roughness: 1,
    metalness: 0,
  })
  const mesh = new Mesh(new PlaneGeometry(width, depth), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 2
  return mesh
}

/**
 * Cables crossing the street.
 *
 * The blind critic, looking straight up, said the rooflines read as an extruded
 * floorplan and named the missing thing precisely: there are no overhead cables
 * anywhere. It is a fair hit. Cables are one of the strongest "this is a real
 * street" signals there is — they are the first thing that tells you a place is
 * inhabited and maintained rather than modelled — and they are close to free:
 * a handful of sagging tubes with four sides each.
 *
 * The sag is the point. A cable between two poles is a catenary, and drawing it
 * as a straight line is the giveaway; the eye knows the shape without being able
 * to name it. A parabola is close enough over a span this short that the
 * difference is under a pixel.
 */
function buildCables(): Group {
  const g = new Group()
  const batch = new Batch()
  const rand = rng(8821)
  const span = WALK_HALF * 2

  for (let z = START_Z - 6; z > END_Z + 6; z -= 15 + rand() * 11) {
    // Height and sag vary: they were not all hung on the same day.
    const yL = 7.2 + rand() * 2.6
    const yR = 7.2 + rand() * 2.6
    const sag = 0.5 + rand() * 0.9
    const skew = (rand() - 0.5) * 2.5
    const runs = rand() > 0.55 ? 2 : 1
    for (let k = 0; k < runs; k++) {
      const dz = k === 0 ? 0 : 0.35 + rand() * 0.3
      const pts: Vector3[] = []
      const SEG = 9
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG
        // Parabolic sag, deepest in the middle.
        const drop = sag * 4 * t * (1 - t)
        pts.push(
          new Vector3(
            -WALK_HALF + span * t,
            yL + (yR - yL) * t - drop,
            z + skew * t + dz,
          ),
        )
      }
      const curve = new CatmullRomCurve3(pts)
      const tube = new TubeGeometry(curve, SEG * 2, 0.022 + rand() * 0.012, 4, false)
      batch.add(tube, M.identity(), new Color(0.07, 0.065, 0.06))
      tube.dispose()
    }
  }

  const mesh = batch.build(
    new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      envMapIntensity: 0.5,
    }),
  )
  if (mesh) g.add(mesh)
  return g
}
