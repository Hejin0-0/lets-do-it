import {
  AdditiveBlending,
  Color,
  HemisphereLight,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { assertUniformsDeclared } from '../dev/shadercheck'
import { Batch } from '../gfx/merge'
import { lampFlare, radialAlpha, rng, wetStreak } from '../gfx/textures'
import { LAMP, lampHead, type TrafficLight } from './props'
import { roadY } from './street'
import {
  CURB_HEIGHT,
  CORRIDOR,
  ROAD_HALF,
  WALK_HALF,
  type Layout,
  type Slot,
} from '../world/placement'
import {
  FILL_GROUND,
  FILL_LEVEL,
  LAMP_COLOR,
  LAMP_INTENSITY,
  SKY_COLOR,
  SKY_INTENSITY,
  SKY_TO_SCENE,
  REAL_LAMP_COUNT,
  SUN_UP,
  SUN_COLOR,
  SUN_DIR,
  SUN_INTENSITY,
} from './sun'
import type { LightCue } from './buildings'

/**
 * Build order system 5: lighting.
 *
 * Two things in here are the direct result of screenshot notes, and both are
 * worth reading before touching a constant.
 *
 * Prompt 4 point 1 — "every street lamp on both sides needs to be ON". They
 * were. Their intensity had been derived as a ratio against the skylight, which
 * was the correct thing to do, and then the *measured* skylight number had been
 * pasted in as a literal while the sun was at 4.2 degrees. When the sun moved to
 * 5.5, the skylight rose and the lamps did not, and 78 candela of sodium
 * disappeared into a brighter ambient. Re-deriving against the live skylight put
 * them at 329. Nothing about the lamp was wrong; the divisor had gone stale.
 * That is why LAMP_INTENSITY lives in sun.ts as a ratio and not here.
 *
 * Prompt 4 point 2 — "the sun-facing side of the street is too dark ... the
 * whole scene reads as post-sunset". Same class of bug from the other end.
 *
 * The lamps themselves are almost entirely fake. There are three real point
 * lights on this street and they follow the camera; every other lamp is an
 * emissive lens, an additive cone and a pool decal. At 30+ FPS on a mid-range
 * GPU there is no version of this with fourteen shadow-casting point lights in
 * it, and the honest trade is that a lamp forty metres away does not need to
 * illuminate anything — it needs to *look* like it is illuminating something.
 */

const M = new Matrix4()

/**
 * How many lamps get a real PointLight. Fixed, so the shader never recompiles.
 *
 * Measured cost: **0.68 ms per light**, from 7.43 ms for eleven of them out of a
 * 17.79 ms frame — 42%, and by a distance the most expensive thing in the
 * renderer. three's forward path evaluates every point light on every lit
 * fragment, so a light faded to zero intensity by distance costs exactly as much
 * as one at full brightness. Sizing this array to lamps that are merely *on the
 * street* rather than lamps that are *close enough to matter* was paying full
 * price for nothing: with the fade reaching zero at 38 m, three or four of the
 * ten were always contributing literally zero light at 0.68 ms each.
 *
 * Seven, with the fade closed up to 26 m to match. The count and the range have
 * to move together — that is the whole point.
 *
 * Kept after dark for the reason below: a facade full of
 * balconies, pipework and window reveals measured as *featureless* because none
 * of it was being shaded. An additive wall wash raises the brightness of a wall
 * uniformly and therefore creates no edges at all — it can make a dark wall a
 * lighter wall and never a detailed one. Only a real light at a grazing angle
 * casts the small shadows that relief is made of. Measured: quadrupling the wash
 * and the fill together cut the blank share from 0.48 to 0.27, and it was the
 * directional half of that doing the work.
 */
const REAL_LAMPS = REAL_LAMP_COUNT

export interface Lighting {
  group: Group
  sun: DirectionalLight
  update(cameraPos: Vector3, t: number): void
}

export function createLighting(
  scene: Scene,
  layout: Layout,
  cues: LightCue[],
  trafficLights: TrafficLight[],
): Lighting {
  const group = new Group()

  // ---- the sun ----------------------------------------------------------
  const sun = new DirectionalLight(SUN_COLOR, SUN_INTENSITY)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)

  // A 5.5-degree sun casts a 155 m shadow off a 15 m building. No shadow box
  // covers that at a useful resolution, so the box covers what is *visible*
  // instead and is biased up-sun, toward the casters whose shadows land in
  // frame. Everything beyond it is unshadowed, which at this angle reads as
  // haze rather than as error.
  const cam = sun.shadow.camera
  cam.left = -68
  cam.right = 68
  cam.top = 48
  cam.bottom = -48
  cam.near = 1
  cam.far = 420
  // Grazing light needs normalBias, not depth bias: the surfaces most at risk
  // of self-shadowing here are near-parallel to the light, where a depth offset
  // does nothing and a normal offset does everything.
  sun.shadow.normalBias = 0.055
  sun.shadow.bias = -0.0002
  scene.add(sun)
  scene.add(sun.target)

  // Skylight arrives through the sky probe rather than a HemisphereLight, so it
  // has the sky's actual colour gradient in it instead of two constants. The
  // probe was captured with the sun disc suppressed, so this does not double
  // count the direct beam.
  scene.environmentIntensity = SKY_INTENSITY * SKY_TO_SCENE

  // The cool half of golden hour. See FILL_RATIO in sun.ts for why this exists
  // alongside the probe rather than instead of it.
  const fill = new HemisphereLight(SKY_COLOR, FILL_GROUND, FILL_LEVEL)
  scene.add(fill)

  // ---- lamp heads, cones and pools -------------------------------------
  const lampSlots = layout.props.filter((p) => p.kind === 'lamp')

  const emissive = new Batch()
  const housing = new Batch()
  const pools = new Batch()
  const cones = new Batch()
  const walls = new Batch()
  /** Billboarded each frame so they never show an edge. */
  const haloes: Mesh[] = []
  /** Lamp reflections smeared on the road. See where they are built. */
  const streaks: Mesh[] = []

  const LENS = new SphereGeometry(1, 10, 6)
  const HOUSE = new CylinderGeometry(1, 0.72, 1, 10, 1)
  // 32 sides, not 14: at 14 the silhouette is a visible polygon and the beam
  // reads as a faceted solid rather than as lit air.
  const CONE = new CylinderGeometry(0.30, 1, 1, 32, 1, true)

  for (const slot of lampSlots) {
    const head = lampHead(slot)

    // No two lamps on a real street are the same lamp.
    //
    // The blind critic called this out and was right about why it matters: it is
    // "the fastest thing the visual system flags as manufactured". A council
    // does not relamp a street in one go — heads get replaced one at a time over
    // years, so a run of sodium picks up the odd cooler LED retrofit, the
    // outputs drift apart as they age, and one is always out.
    //
    // Seeded off the position so the same lamp is the same lamp on every load;
    // a street whose dead bulb moves between reloads is worse than one with no
    // dead bulb.
    const lrand = rng(Math.round(Math.abs(slot.z) * 31 + (slot.side > 0 ? 7 : 0)))
    const dead = lrand() < 0.075
    // Most are the original sodium; a few have been swapped for something
    // colder, which on a street of orange reads immediately.
    const cold = lrand() < 0.22 ? 0.55 + lrand() * 0.25 : 0
    const lampCol = LAMP_COLOR.clone().lerp(new Color(0.86, 0.9, 1.0), cold)
    // Ageing: a sodium lamp loses output over its life and they were not all
    // fitted on the same day.
    const wear = dead ? 0 : 0.78 + lrand() * 0.34

    // Luminaire: a shallow housing with a bright lens under it. The lens is
    // what blooms; the housing is what stops the lamp reading as a floating
    // dot, because a real lamp is a dark shape with a bright underside.
    M.makeScale(0.3, 0.16, 0.44).setPosition(head.x, head.y + 0.1, head.z)
    housing.add(HOUSE, M, new Color(0.2, 0.19, 0.18))
    M.makeScale(0.19, 0.075, 0.3).setPosition(head.x, head.y - 0.02, head.z)
    // Well above 1.0: a sodium lens photographs as a blown highlight, and this
    // is the value the bloom pass keys off.
    emissive.add(LENS, M, lampCol.clone().multiplyScalar((SUN_UP ? 3.6 : 6.0) * wear))

    // Halo. A bare emissive lens is a dot; what the eye reads as "a lamp is on"
    // is the bloom of scattered light around the fixture, and after dark that
    // halo is most of the lamp's visual footprint.
    if (!SUN_UP) {
      const halo = new Mesh(
        // Wider than tall. A luminaire's lens is a flat horizontal panel, so
        // its glow is not square-on symmetric, and the streak baked into the
        // flare needs room to run.
        new PlaneGeometry(4.0, 2.9),
        new MeshBasicMaterial({
          // Neutral tint: lampFlare carries the sodium colour itself, because
          // the hue has to change from the core to the rim and a single
          // multiplier cannot do that.
          map: lampFlare(),
          color: new Color(1.5, 1.5, 1.5).lerp(new Color(1.35, 1.45, 1.7), cold)
            .multiplyScalar(wear),
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      )
      halo.position.set(head.x, head.y - 0.05, head.z)
      halo.renderOrder = 6
      haloes.push(halo)
      group.add(halo)
    }

    // The beam of lit haze under the luminaire.
    //
    // Reported as "light coming out at right angles — no street lamp on earth
    // does this". It was a 14-sided cone whose brightness fell off only with
    // view angle, so it kept a defined edge all the way to the ground and read
    // as a solid wedge stuck to the lamp. A real beam has no boundary you can
    // point at: it is brightest just under the fixture and has dissolved into
    // the air well before it reaches the pavement, and the pool on the ground
    // is a separate thing that the beam never visibly joins.
    //
    // So the cone now stops short of the ground entirely and fades from both
    // ends, and the shader below does the rest.
    const drop = (head.y - CURB_HEIGHT) * 0.72
    M.makeScale(3.4, drop, 3.4).setPosition(head.x, head.y - drop / 2, head.z)
    cones.add(CONE, M, lampCol.clone().multiplyScalar(wear))

    // Pools. Two of them, because the road and the pavement are different
    // surfaces at different heights and one card cannot lie flat on both.
    // Sodium lamps at dusk are barely winning against the sky. A pool that
    // reads clearly in a screenshot is already several times too bright in
    // motion, which is how these ended up as white smears the first time.
    // After dark the pool *is* the street lighting rather than a hint of it, so
    // it carries far more of the frame than it did at golden hour.
    // Wide across, short along. The pavement pool is centred on the through-zone
    // rather than on the kerb, because that is where the walking line is and it
    // was previously catching only the tail of a pool centred a metre away.
    addPool(pools, head.x, head.z, 9.2, SUN_UP ? 7.0 : 6.6, lampCol, (SUN_UP ? 0.20 : 0.40) * wear, true)
    addPool(
      pools,
      slot.side * ((CORRIDOR[0] + CORRIDOR[1]) / 2),
      slot.z,
      6.6,
      SUN_UP ? 6.0 : 5.6,
      lampCol,
      (SUN_UP ? 0.14 : 0.34) * wear,
      false,
    )

    // The lamp, reflected in the road.
    //
    // The blind critic's third finding, and the one that names what a night
    // street *is*: "a night street photograph is mostly reflection". Asphalt is
    // never quite dry, and every lamp lays a long vertical smear down the road
    // toward the viewer. Take those away and the tarmac reads as felt.
    //
    // It cannot come from the reflection probe: that is convolved from the sky,
    // and at 21:00 the sky is almost black, so a physically-correct mirror
    // reflects nothing. What is actually being reflected is the *lamp*, and the
    // cheap honest way to draw that is the shape it makes — an ellipse on the
    // road stretched along the view direction, because a reflection in a rough
    // horizontal surface smears toward whoever is looking at it. Which way it
    // stretches is a function of where the camera is, so it is oriented per
    // frame in update() below.
    if (!SUN_UP) {
      const streak = new Mesh(
        // A unit quad: the length is set per frame, because how far a
        // reflection reaches depends on how far away you are standing.
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({
          map: wetStreak(),
          color: lampCol.clone().multiplyScalar(0.45 * wear),
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      )
      streak.rotation.x = -Math.PI / 2
      streak.renderOrder = 3
      streak.userData.anchor = { x: head.x, z: head.z }
      streaks.push(streak)
      group.add(streak)
    }

    // The wall behind the lamp.
    //
    // Item 0: balconies, window frames, downpipes and vents were all built and
    // none of them could be seen, because nothing was lighting a facade. A real
    // luminaire spills a broad, soft patch up the wall it stands beside — that
    // patch is what a facade at night is actually lit by, and without it the
    // brickwork is a silhouette and every piece of relief on it is wasted.
    if (!SUN_UP) {
      // Dim on purpose. The first version of this was three times stronger and
      // flattened the brick it was meant to reveal — a wash bright enough to
      // erase the texture is worse than no wash, because the detail is still
      // being paid for and now cannot be seen either. It needs to lift the wall
      // off black and stop.
      wallGlow(walls, slot.side * WALK_HALF, LAMP.headY - 0.8, slot.z, slot.side, 7.0, lampCol, 0.19 * wear)
    }
  }

  // ---- spill from shopfronts, neon and windows -------------------------
  //
  // Windows used to put a 4.6 m disc of light on the pavement each. There are
  // over two hundred lit windows on this street, and two hundred overlapping
  // discs do not read as two hundred windows — they sum into a flat, even wash
  // that swamped the lamps entirely. Measured on the pavement, the brightness
  // under a lamp was only 1.07x the brightness midway between two lamps, which
  // is why it read as one unbroken line of light rather than a row of pools.
  //
  // It was also the wrong place for the light. A window four metres up throws
  // its light on the *wall* around it and barely reaches the ground; the pool
  // was inventing illumination the window never emitted, in the one place it
  // could do the most damage.
  for (const cue of cues) {
    if (cue.kind === 'window') {
      // Nothing. A window does not glow on its own brick.
      //
      // This cue has never once looked right. At 5 cm of standoff it was buried
      // inside the wall's relief and leaked through as the blocky patchwork
      // that got reported as signs overlapping; stood clear of the wall it
      // became two hundred soft ovals in a regular grid, one per opening, which
      // is worse than the blankness it was invented to fix — a facade with
      // nothing on it reads as a dark wall, and a facade with a lattice of
      // ovals on it reads as a bug.
      //
      // The premise was wrong. Light leaving a window at night goes *out*, into
      // the street; the brick immediately around the opening is lit by it only
      // faintly and without an edge, and at this distance that is not a thing
      // you can see at all. What sells a lit room is the bright rectangle of
      // the window itself, which the litGlass batch already draws.
      //
      // The lamp wash and the neon wash below stay: those are real. A lantern
      // three metres from a wall genuinely floods it, and a neon sign genuinely
      // stains the brick it is bolted to. Both have a source you can point at
      // in the frame, which is exactly what this one lacked.
      continue
    }
    // A lit shopfront genuinely does pool on the pavement in front of it.
    const px = cue.x - cue.side * (cue.kind === 'shopfront' ? 1.6 : 1.1)
    const onRoad = Math.abs(px) < ROAD_HALF
    // Halved now that the same source also lights the wall it sits in — it was
    // being counted twice, and on the ground is where that did the harm.
    addPool(pools, px, cue.z, cue.radius * 1.1, cue.radius * 0.8, cue.color, cue.intensity * 0.17 * (SUN_UP ? 1 : 0.95), onRoad)
    // ...and it also lights the wall it is set into.
    // Above the shopfront head, not across it.
    //
    // This sat at the cue's own height with a 4.8 m tall quad, which put it
    // squarely in front of the glazing — 32 cm nearer the street than the glass
    // itself — so every shop window on the street was covered by a soft warm
    // blob. The reflections added for item 2 were rendering correctly the whole
    // time and could not be seen behind it. A light that obscures the thing it
    // is lighting is worse than no light.
    wallGlow(walls, cue.x, 4.35, cue.z, cue.side, 3.2, cue.color, cue.intensity * 0.26)
  }

  const poolMesh = pools.build(
    new MeshBasicMaterial({
      // Tighter falloff than the 2.4 this started at. A soft tail on one pool is
      // invisible; a soft tail on twenty overlapping pools is what fills the
      // gaps between them and turns a rhythm into a ribbon.
      map: radialAlpha(3.0, 1),
      vertexColors: true,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  )
  if (poolMesh) {
    // Additive light has to land on top of the road but under the props that
    // stand in it, so it renders after opaque geometry with depth test on.
    poolMesh.renderOrder = 1
    group.add(poolMesh)
  }

  const wallMesh = walls.build(
    new MeshBasicMaterial({
      map: radialAlpha(2.2, 1),
      vertexColors: true,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  )
  if (wallMesh) {
    wallMesh.renderOrder = 2
    group.add(wallMesh)
  }

  const coneMat = coneMaterial()
  assertUniformsDeclared('lamp cone', coneMat)
  const coneMesh = cones.build(coneMat)
  if (coneMesh) {
    coneMesh.renderOrder = 4
    group.add(coneMesh)
  }

  const em = emissive.build(new MeshBasicMaterial({ vertexColors: true }))
  if (em) group.add(em)
  const hs = housing.build(
    new MeshBasicMaterial({ vertexColors: true, color: new Color(0.35, 0.33, 0.31) }),
  )
  if (hs) group.add(hs)

  // ---- the three real lamps --------------------------------------------
  const real: PointLight[] = []
  for (let i = 0; i < REAL_LAMPS; i++) {
    const p = new PointLight(LAMP_COLOR, 0, SUN_UP ? 26 : 27, 2)
    p.castShadow = false
    scene.add(p)
    real.push(p)
  }

  // The one parked car with its lights on gets a real light too, because a
  // headlight that illuminates nothing is the most obviously fake thing on a
  // street at dusk.
  const litCar = layout.cars.find((c) => c.lightsOn)
  const carLight = new PointLight(new Color(1, 0.94, 0.84), 0, 14, 2)
  if (litCar) {
    carLight.position.set(litCar.side * 3.6, 0.8, litCar.z)
    carLight.intensity = 9
    scene.add(carLight)
  }

  const headPositions = lampSlots.map(lampHead)
  const nearest = new Int32Array(REAL_LAMPS)
  const nearestD = new Float64Array(REAL_LAMPS)

  return {
    group,
    sun,
    update(cameraPos: Vector3, t: number) {
      // Face the halo quads at the camera. A halo seen edge-on vanishes, which
      // is exactly the failure the cone already had.
      for (const h of haloes) h.lookAt(cameraPos)

      // Point each road reflection at the viewer, and fade it out as the view
      // approaches the vertical: a reflection in a horizontal surface is a
      // grazing-angle effect and disappears when you stand over it.
      for (const st of streaks) {
        const a = st.userData.anchor as { x: number; z: number }
        const dx = cameraPos.x - a.x
        const dz = cameraPos.z - a.z
        const flat = Math.hypot(dx, dz)
        if (flat < 0.001) continue
        // From the lamp *toward* the viewer, and stopping short of them. Centred
        // on the lamp instead, a 13 m quad reaches six metres past the camera
        // and you end up standing inside it looking at a pale slab edge-on —
        // which is exactly what the first version did.
        const len = Math.min(14, flat * 0.8)
        const ux = dx / flat
        const uz = dz / flat
        st.position.set(a.x + ux * (len / 2), 0.014, a.z + uz * (len / 2))
        // Width scales with length rather than sitting at a fixed 1.15 m.
        //
        // The falloff across the streak is a gaussian windowed to zero, and a
        // gaussian needs room: squeezed into 1.15 m it lands almost entirely
        // inside the bright 30% of the sheet and the thing reads as a hard bar
        // about 40 cm wide. Tying width to length gives the ramp somewhere to
        // go, and it is also what the reflection does — a longer streak is a
        // shallower view of the road, which spreads it sideways too.
        st.scale.set(Math.max(1.2, len * 0.17), len, 1)
        // Math.PI added so the texture's bright head lands at the lamp rather
        // than at the far end: the quad runs lamp -> viewer, and v = 0 is the
        // top of the sheet.
        st.rotation.set(-Math.PI / 2, 0, Math.atan2(ux, uz) + Math.PI, 'YXZ')
        // A reflection in a horizontal surface is a grazing-angle effect: it
        // stretches away from you along the ground and vanishes if you stand
        // over it.
        const graze = flat / (flat + Math.max(0.1, cameraPos.y) * 3)
        const mat = st.material as MeshBasicMaterial
        // Ceilinged well below 1. Additive on a road this dark saturates long
        // before the alpha does, and a saturated additive quad shows its own
        // silhouette however soft the texture inside it is.
        mat.opacity = Math.min(0.6, graze * graze * 1.1)
      }

      // ---- roll the shadow box --------------------------------------
      // Biased up-sun so the buildings actually casting into frame are inside
      // it, and snapped to a texel grid: an unsnapped ortho shadow camera
      // shimmers along every edge as it slides, which is far more visible than
      // a slightly stale box.
      const texel = 136 / 2048
      const bias = 22
      const tx = Math.round((cameraPos.x + SUN_DIR.x * bias) / texel) * texel
      const tz = Math.round((cameraPos.z + SUN_DIR.z * bias) / texel) * texel
      sun.target.position.set(tx, 4, tz)
      sun.position.set(
        tx + SUN_DIR.x * 210,
        4 + SUN_DIR.y * 210,
        tz + SUN_DIR.z * 210,
      )

      // ---- hand the three real lights to the nearest lamps ----------
      // Ranked by distance, and the intensity falls off with it, so a lamp that
      // is about to lose its light has already faded out. Without that the
      // handover pops every sixteen metres.
      // A partial selection into preallocated arrays, rather than map+sort.
      // The old version allocated one object per lamp per frame and sorted the
      // lot — 22 short-lived objects every frame is exactly the kind of steady
      // garbage that shows up as an intermittent hitch rather than a slow frame.
      nearest.fill(-1)
      nearestD.fill(Infinity)
      for (let i = 0; i < headPositions.length; i++) {
        const d = headPositions[i].distanceToSquared(cameraPos)
        for (let k = 0; k < REAL_LAMPS; k++) {
          if (d < nearestD[k]) {
            for (let j = REAL_LAMPS - 1; j > k; j--) {
              nearestD[j] = nearestD[j - 1]
              nearest[j] = nearest[j - 1]
            }
            nearestD[k] = d
            nearest[k] = i
            break
          }
        }
      }
      for (let k = 0; k < REAL_LAMPS; k++) {
        const light = real[k]
        const idx = nearest[k]
        if (idx < 0) {
          light.intensity = 0
          continue
        }
        light.position.copy(headPositions[idx])
        const fade = 1 - smoothstep(SUN_UP ? 16 : 15, SUN_UP ? 30 : 26, Math.sqrt(nearestD[k]))
        light.intensity = LAMP_INTENSITY * fade
      }

      // ---- traffic lights ------------------------------------------
      for (const tl of trafficLights) {
        // 26 s cycle: green, amber, red. Amber is short, which is the only part
        // of the timing anyone notices is wrong.
        const phase = (t / 1000 + tl.phase) % 26
        const on = phase < 12 ? 2 : phase < 15 ? 1 : 0
        for (let i = 0; i < 3; i++) {
          const c = BASE_LENS[i]
          tl.lenses[i].color.copy(c).multiplyScalar(i === on ? 26 : 0.09)
        }
      }
    },
  }
}

const BASE_LENS = [
  new Color(1, 0.1, 0.05),
  new Color(1, 0.62, 0.06),
  new Color(0.12, 1, 0.3),
]

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * One additive light pool, laid on either the road or the pavement.
 *
 * The road pool is subdivided and displaced to follow the camber. A flat card
 * would float 13 cm above the gutter, and at eye height on a street that gap is
 * a visible sliver of daylight under the pool — the exact failure the ground
 * contact decal on the cars was fixing.
 *
 * Width and length are separate, and which is larger matters more than either
 * value. These used to be one `size` with the length fixed at 1.35x the width —
 * pools *longer* along the street than across it, which is precisely the shape
 * that makes consecutive pools touch and read as one continuous strip. A lamp
 * pool wants the opposite: wide enough to cover the footway you are walking on,
 * short enough along the street to leave a gap before the next one.
 */
function addPool(
  batch: Batch,
  x: number,
  z: number,
  width: number,
  length: number,
  colour: Color,
  intensity: number,
  onRoad: boolean,
): void {
  const geo = new PlaneGeometry(width, length, onRoad ? 8 : 1, onRoad ? 8 : 1)
  if (onRoad) {
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      // Local X maps to world X once the plane is laid flat, so the camber can
      // be sampled directly from the vertex.
      pos.setZ(i, -roadY(x + pos.getX(i)))
    }
    pos.needsUpdate = true
  }
  M.makeRotationX(-Math.PI / 2).setPosition(
    x,
    onRoad ? 0.022 : CURB_HEIGHT + 0.016,
    z,
  )
  batch.add(geo, M, colour.clone().multiplyScalar(intensity))
  geo.dispose()
}

/**
 * A soft patch of light on a facade.
 *
 * Taller than it is wide, because that is the shape a downward-throwing
 * luminaire actually paints on a wall beside it, and because a circular blob on
 * a building reads as a projected spotlight.
 */
function wallGlow(
  batch: Batch,
  faceX: number,
  y: number,
  z: number,
  side: number,
  size: number,
  colour: Color,
  intensity: number,
): void {
  const geo = new PlaneGeometry(size, size * 1.5)
  // Stood well clear of the wall, not 5 cm off it.
  //
  // `faceX` is the *nominal* facade plane. What is actually built there is not
  // flat: piers, pilasters, bulkheads and cill courses stand 10 to 20 cm proud
  // of it, and the deepest of them reaches 17 cm. At 5 cm the glow was therefore
  // buried inside its own wall for much of its area, and since it is additive
  // with `depthWrite` off it survived only where the relief happened to fall
  // behind it — so it came through in patches, as a run of blocky rectangles
  // smeared along the facade. That is what was reported as the shop signs
  // overlapping; it is not the signs, it is the light behind them.
  //
  // 22 cm: the deepest relief plus five. Further out and the window glows stop
  // reading as light *on* the wall and start reading as a scatter of blobs
  // floating in front of it — 34 cm was tried and did exactly that. The margin
  // wants to be the smallest one that clears, not a comfortable one.
  M.makeRotationY(-side * Math.PI * 0.5).setPosition(faceX - side * 0.22, y, z)
  batch.add(geo, M, colour.clone().multiplyScalar(intensity))
  geo.dispose()
}

/**
 * Volumetric cone material.
 *
 * A cone with an additive material has a hard elliptical outline, which is the
 * single most recognisable "fake god ray" in real-time graphics. Fading by the
 * angle between the view ray and the surface normal fixes it: the rim of the
 * cone is where the ray is most nearly tangent, so that is where the shell is
 * thinnest and should contribute least. Same trick as a fresnel term, used
 * backwards.
 */
function coneMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    // A soft exponent leaves the cone's outline visible as a hard triangle,
    // which is the single most recognisable fake volumetric in the medium.
    uniforms: {
      uFall: { value: 3.2 },
      // Against a dark sky *any* brightness reads as a solid object, so the
      // beam has to be far weaker at night than it was against a bright one —
      // the opposite of the intuition. What sells a lamp after dark is the
      // fixture, its halo and the pool on the ground.
      //
      // Raised from 0.055, for two reasons. The first is that 0.055 was chosen
      // while `uStrength` was not declared in the fragment shader at all, so the
      // cone was not drawing and what got tuned was its absence — the same class
      // of mistake as the sky's uNight and the cloud deck's missing night
      // branch. The second is a physical inconsistency a blind critic caught
      // from the images alone: the haze here is thick enough to take 60% of the
      // contrast out of a building at thirty metres, and air that thick puts a
      // visible cone under every lamp. Having the fog and not the shafts is the
      // tell, and the fog is doing real work elsewhere, so the shafts come back.
      uStrength: { value: SUN_UP ? 0.30 : 0.15 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vDrop;
      void main() {
        vColor = color;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vViewW = normalize(cameraPosition - world.xyz);
        // Cone geometry runs from -0.5 (bottom) to +0.5 (top) in local Y.
        vDrop = position.y + 0.5;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFall;
      uniform float uStrength;
      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      varying float vDrop;

      // pow() of a negative base with a fractional exponent is NaN, and a
      // varying that is 0.0 at a vertex arrives at the fragment as -1e-8 often
      // enough to matter. The NaN then blends additively into a float target,
      // survives the tonemap, and comes out as a solid black cone occluding
      // half a building — an additive effect that *darkens* is the signature.
      float pw(float x, float e) { return pow(clamp(x, 0.0, 1.0), e); }

      void main() {
        // A shell standing in for a volume: what you would see through a cone of
        // lit haze is proportional to how much of it the ray crosses, which is
        // most through the middle and nothing at the silhouette. Squaring that
        // off is what dissolves the outline — at the rim this term is exactly
        // zero, so there is no edge to see.
        float facing = abs(dot(normalize(vNormalW), normalize(vViewW)));
        float shell = pw(facing, uFall);

        // Along the beam: brightest just under the luminaire, and *fully gone*
        // before the bottom of the cone. The old version still had a third of
        // its brightness left where the geometry ended, which drew a hard ring
        // on the air at exactly the height the cone happened to stop.
        float along = pw(vDrop, 1.35) * pw(smoothstep(0.0, 0.42, vDrop), 1.0);

        gl_FragColor = vec4(vColor * shell * along * uStrength, 1.0);
      }
    `,
  })
}

/** Exposed so the HUD can report what the lighting pass actually built. */
export function lampCount(layout: Layout): number {
  return layout.props.filter((p: Slot) => p.kind === 'lamp').length
}
