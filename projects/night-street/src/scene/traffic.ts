import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SpotLight,
  Vector3,
} from 'three'
import { buildMovingCar } from './cars'
import { radialAlpha } from '../gfx/textures'
import { CURB_HEIGHT, END_Z, START_Z } from '../world/placement'
import { SUN_UP } from './sun'

/**
 * The only thing on this street that moves.
 *
 * Everything else is nailed down — that is what makes the batching work, and for
 * twenty-five parked cars it is the right call. But a street where nothing moves
 * is an architectural render, not a place, and no amount of texture detail
 * fixes that. A car going past does four things at once that nothing else here
 * does: it changes the light, it casts a moving shadow, it makes a sound that
 * arrives and leaves, and it gives the player something that happens *to* them
 * rather than something they walked up to.
 *
 * Two of them, in opposite lanes. The one coming toward you carries the
 * headlights and the only moving light source in the scene; the one going away
 * carries tail lights and costs almost nothing. Between them the street is never
 * quite still, and the gap between passes is long enough that a pass still
 * reads as an event.
 */

/** Metres per second. 40 km/h, which is what a car does on a street like this. */
const SPEED = 11

/**
 * Lane centres, either side of the middle line.
 *
 * This is not a free choice: both kerbs are parked solid. A parked car sits at
 * `PARK_X` 3.95 and is 2.31 m across mirror to mirror, so it occupies 2.80 to
 * 5.11, and the moving lane has only the 2.80 m between the middle line and
 * that. A car of the same width centred at 1.40 spans 0.25 to 2.56, which
 * clears the parked rank by 24 cm and the middle line by 25 cm.
 *
 * It was `ROAD_HALF * 0.5` = 2.70, which put the moving car at 1.56 to 3.86 and
 * drove it through the parked rank by more than a metre for the whole length of
 * the street. That reads as the car clipping through the parked cars, which is
 * exactly how it was reported. A fraction of the road width is the wrong way to
 * express this — the constraint is where the parked cars are, so that is what
 * the number is derived from.
 */
const LANE = 1.4

/** How far past each end a car runs before it loops. */
const RUN_START = START_Z + 30
const RUN_END = END_Z - 20

export interface Traffic {
  group: Group
  triangles: number
  drawCalls: number
  update(t: number, cameraPos: Vector3): void
  /** Where the oncoming car is, for the audio to follow. */
  readonly leadPosition: Vector3
  dispose(): void
}

interface Runner {
  root: Group
  /** Lamp and tail glows, turned to face the camera every frame. */
  glows: Mesh[]
  /** +1 travels toward +Z, -1 toward -Z. */
  dir: 1 | -1
  lane: number
  /** Seconds of gap after each pass, so they do not become a procession. */
  gap: number
  phase: number
  spot: SpotLight | null
  target: Group | null
}

export function createTraffic(): Traffic {
  const group = new Group()
  let triangles = 0
  let drawCalls = 0

  const runners: Runner[] = []
  const leadPosition = new Vector3()

  // The oncoming car: headlights, and the scene's one moving light.
  runners.push(makeRunner(group, 1, -LANE, 7.5, 0, true))
  // And one going away, which only needs its tail lights to read.
  runners.push(makeRunner(group, -1, LANE, 11, 0.45, false))

  for (const r of runners) {
    r.root.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && m.geometry?.attributes?.position) {
        triangles += m.geometry.attributes.position.count / 3
        drawCalls++
      }
    })
  }

  const faceCamera = new Vector3()

  function update(t: number, cameraPos: Vector3): void {
    for (const r of runners) {
      const span = RUN_START - RUN_END + SPEED * r.gap
      const travelled = ((t / 1000) * SPEED + r.phase * span) % span
      // Park it off the end during the gap rather than branching on visibility:
      // the run is simply longer than the street.
      const z = r.dir < 0 ? RUN_START - travelled : RUN_END + travelled
      r.root.position.set(r.lane, 0, z)
      if (r.target) r.target.position.set(r.lane, 0.2, z + r.dir * 14)
      for (const g of r.glows) {
        g.getWorldPosition(faceCamera)
        faceCamera.subVectors(cameraPos, faceCamera).add(g.position)
        g.lookAt(faceCamera)
      }
    }
    leadPosition.copy(runners[0].root.position)
  }

  return {
    group,
    triangles,
    drawCalls,
    update,
    leadPosition,
    dispose() {
      group.clear()
    },
  }
}

function makeRunner(
  parent: Group,
  dir: 1 | -1,
  lane: number,
  gap: number,
  phase: number,
  headlights: boolean,
): Runner {
  const root = new Group()
  const glows: Mesh[] = []

  // Which way the body points.
  //
  // `buildMovingCar` passes `facing: -1` into `buildCar`, which turns that into
  // a yaw of -PI/2 — and that points the car at **+Z**, not -Z as the comment
  // here used to claim. So `dir > 0 ? Math.PI : 0` turned both cars through 180
  // degrees away from the way they were travelling, and every pass was made in
  // reverse. The headlamps and tail lights are added to `root` rather than to
  // the body, at +Z and -Z for `dir` +1, so they stayed on the correct ends and
  // the car had its lights the right way round while its shell faced backwards
  // — which is why it read as "the car only ever reverses" rather than as
  // anything being mirrored.
  //
  // Checked by silhouette, not by algebra: a saloon's bonnet is longer than its
  // boot, so the long end has to lead.
  const built = buildMovingCar({
    side: 1,
    z: 0,
    seed: headlights ? 4177 : 9311,
    body: headlights ? 1 : 2,
    paint: headlights ? 3 : 6,
    lightsOn: true,
  })
  built.group.rotation.y = dir > 0 ? 0 : Math.PI
  root.add(built.group)

  const beamTex = radialAlpha(1.6, 1)

  if (headlights) {
    // A hint of the beam on the road, and only a hint.
    //
    // The first version was a 3.4 x 26 m quad at additive 1.1, which is over the
    // tonemap's shoulder — it came out as a hard white slab laid across the
    // carriageway, reading as a ramp rather than as light. The actual
    // illumination is the spot light below; this quad exists because a spot's
    // pool has a clean elliptical edge and real headlights on wet-ish tarmac
    // have a soft one. Under 1.0 and short enough to sit inside the spot's own
    // pool rather than extending past it.
    const beam = new Mesh(
      new PlaneGeometry(4.2, 16),
      new MeshBasicMaterial({
        map: beamTex,
        color: new Color(0.30, 0.27, 0.21),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    beam.rotation.x = -Math.PI / 2
    beam.position.set(0, CURB_HEIGHT * 0.06, dir * 7.5)
    beam.renderOrder = 5
    root.add(beam)

    // The lamps themselves, as two soft discs that stay bright at any distance.
    // Billboarded in the update: a flat quad on the front of a car is edge-on
    // from the pavement, and the pair of them read as a white rounded rectangle
    // stuck to the bumper rather than as two lights.
    for (const sx of [-0.62, 0.62]) {
      const lamp = new Mesh(
        new PlaneGeometry(1.0, 1.0),
        new MeshBasicMaterial({
          map: beamTex,
          color: new Color(1.7, 1.55, 1.25),
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      )
      lamp.position.set(sx, 0.62, dir * 2.1)
      lamp.renderOrder = 6
      glows.push(lamp)
      root.add(lamp)
    }
  } else {
    for (const sx of [-0.66, 0.66]) {
      const tail = new Mesh(
        new PlaneGeometry(0.8, 0.8),
        new MeshBasicMaterial({
          map: beamTex,
          color: new Color(1.9, 0.16, 0.06),
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      )
      tail.position.set(sx, 0.66, -dir * 2.2)
      tail.renderOrder = 6
      glows.push(tail)
      root.add(tail)
    }
  }

  parent.add(root)

  // One real light, on the oncoming car only.
  //
  // Everything above is additive geometry, which cannot light anything — it
  // adds to the picture where it is drawn and stops there. A car's headlights
  // sweeping a wall is the single most recognisable thing about a street at
  // night, and that needs an actual light. Measured at about a millisecond,
  // against ten in hand; no shadow map, because a shadow-casting spot is
  // another full pass over the scene and the beam reads without it.
  let spot: SpotLight | null = null
  let target: Group | null = null
  if (headlights && !SUN_UP) {
    target = new Group()
    parent.add(target)
    spot = new SpotLight(0xfff0d8, 90, 34, 0.52, 0.62, 1.6)
    spot.position.set(0, 0.66, dir * 2.0)
    spot.castShadow = false
    spot.target = target
    root.add(spot)
  }

  return { root, glows, dir, lane, gap, phase, spot, target }
}
