import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ExtrudeGeometry,
  Shape,
  SphereGeometry,
  type Texture,
} from 'three'
import { Batch } from '../gfx/merge'
import {
  awningStripes,
  facadeMaps,
  ghostSign,
  posterWall,
  metalMaps,
  rng,
  radialAlpha,
  glassGrime,
  shutterMaps,
  signTexture,
  windowAtlas,
  windowCell,
  shopInterior,
  type FacadeKind,
} from '../gfx/textures'
import { SUN_DIR, SUN_UP } from './sun'
import { PROBE_COUNT, probeIndexFor } from './probes'
import {
  CURB_HEIGHT,
  WALK_HALF,
  hashId,
  signStyleOf,
  type Bay,
  type BuildingSpec,
  type Layout,
} from '../world/placement'

/**
 * Build order system 2: buildings.
 *
 * The brief's line was "Not copy-pasted boxes", and the way you avoid copy-
 * pasted boxes is not more variation knobs — it is making sure the *silhouette*
 * differs. Facade colour and window pattern are the cheapest kinds of variation
 * and also the least effective, because at golden hour with the sun coming down
 * the street most of what you read is outline against a bright sky. So the
 * things that vary hardest here are height, cornice projection, parapet, roof
 * clutter and whether there is a fire escape hanging off the front.
 *
 * Everything is baked into a handful of merged meshes grouped by material. The
 * street is 22 buildings and about 900 windows; built as individual meshes it
 * would be three thousand draw calls and would miss the frame budget on the CPU
 * long before the GPU had an opinion.
 */

const M = new Matrix4()
const M2 = new Matrix4()

/** A light source the lighting pass should build a pool or glow for. */
export interface LightCue {
  kind: 'shopfront' | 'neon' | 'window'
  x: number
  y: number
  z: number
  /** Facing direction along X: which way the light spills into the street. */
  side: -1 | 1
  color: Color
  radius: number
  intensity: number
}

/** A neon sign that can be animated: the board, and its glow if it has one. */
export interface NeonSign {
  board: Mesh
  glow: Mesh | null
  /** Stable per-sign seed, so a flicker pattern is the same every load. */
  seed: number
}

export interface BuiltBuildings {
  group: Group
  cues: LightCue[]
  /** Every neon sign on the street. See scene/life.ts. */
  neon: NeonSign[]
  triangles: number
  drawCalls: number
  /** One per reflection probe; their envMaps are assigned after capture. */
  shopGlassMeshes: Mesh[]
}

// Shared primitives. Cloned by the batcher, never added to the scene directly.
const BOX = new BoxGeometry(1, 1, 1)
const QUAD = new PlaneGeometry(1, 1)
const TANK = new CylinderGeometry(1, 1, 1, 12, 1)
const BALL = new SphereGeometry(1, 8, 6)
const CYL_TALL = new CylinderGeometry(1, 1, 1, 8, 1)
const DISH = new CylinderGeometry(1, 0.82, 1, 12, 1)
const HOPPER = new CylinderGeometry(1, 0.45, 1, 8, 1)

/** Height of the shopfront opening. The shell above starts here. */
const SHOPFRONT_HEAD = 3.2

export function buildBuildings(layout: Layout): BuiltBuildings {
  const group = new Group()
  const cues: LightCue[] = []
  const neon: NeonSign[] = []

  // One batch per material. Facades split by kind because each kind has its own
  // brick/stucco/stone sheet; per-building colour comes through vertex colour.
  const facadeBatches = new Map<FacadeKind, Batch>()
  const trim = new Batch() // concrete ledges, cornices, parapets, sills
  const metal = new Batch() // fire escapes, AC units, brackets, roof vents
  const shutter = new Batch()
  const litGlass = new Batch()
  const darkGlass = new Batch()
  // One batch per reflection probe, so each pane can carry the cubemap baked
  // where it stands. See scene/probes.ts.
  const shopGlass = Array.from({ length: PROBE_COUNT }, () => new Batch())
  const dark = new Batch() // window reveals and door recesses

  for (const b of layout.buildings) {
    let fb = facadeBatches.get(b.facade)
    if (!fb) {
      fb = new Batch()
      facadeBatches.set(b.facade, fb)
    }
    buildOne(
      b,
      { facade: fb, trim, metal, shutter, litGlass, darkGlass, shopGlass, dark },
      cues,
      group,
      neon,
    )
  }

  // Close both ends of the block.
  //
  // The buildings run from z=+8 to z=-181 and the road surface runs from +18 to
  // -218, so past the last building the carriageway carried on into open ground
  // and met the sky. Standing at the end of the walk and looking on, you could
  // see the world stop — reported from play, and the haze does not cover it: at
  // the 68 m to the end of the terrace it still passes 65% of the light.
  //
  // A real street does not show you the horizon, it shows you the next block.
  // Two crossing terraces do that, and they cost one box and a scatter of
  // windows each because they go into the batches that already exist.
  const anyFacade = facadeBatches.values().next().value as Batch
  closingTerrace(anyFacade, litGlass, -186, 17)
  closingTerrace(anyFacade, litGlass, 34, 13)

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

  for (const [kind, batch] of facadeBatches) {
    const maps = facadeMaps(kind, kind.length * 31)
    const mat = new MeshStandardMaterial({
      map: maps.color,
      roughnessMap: maps.rough,
      normalMap: maps.normal,
      vertexColors: true,
      metalness: 0,
      roughness: 1,
      envMapIntensity: SUN_UP ? 0.42 : 0.9,
    })
    // Brick only reads if something is shading it, and after dark the only light
    // reaching a facade arrives at a grazing angle from a lamp below it. That is
    // the best possible light for relief — and worth leaning into, because a
    // normal map at unit strength under a soft even wash produces a wall with no
    // structure in it at all, which is what the blank measurement was reporting.
    mat.normalScale.set(SUN_UP ? 1 : 1.9, SUN_UP ? 1 : 1.9)
    push(batch.build(mat, { cast: true, receive: true }))
  }

  const conc = facadeMaps('stone', 7)
  push(
    trim.build(
      new MeshStandardMaterial({
        map: conc.color,
        color: new Color(0.66, 0.63, 0.58),
        vertexColors: true,
        metalness: 0,
        roughness: 0.85,
        envMapIntensity: 0.55,
      }),
      { cast: true, receive: true },
    ),
  )

  const met = metalMaps(19, 0.62)
  push(
    metal.build(
      new MeshStandardMaterial({
        map: met.color,
        roughnessMap: met.rough,
        vertexColors: true,
        metalness: 0.55,
        roughness: 0.68,
        envMapIntensity: 0.9,
      }),
      { cast: true, receive: true },
    ),
  )

  const sh = shutterMaps()
  push(
    shutter.build(
      new MeshStandardMaterial({
        map: sh.color,
        roughnessMap: sh.rough,
        normalMap: sh.normal,
        vertexColors: true,
        metalness: 0.4,
        roughness: 0.72,
        envMapIntensity: 0.7,
      }),
      { cast: true, receive: true },
    ),
  )

  push(dark.build(new MeshStandardMaterial({ color: 0x0a0908, roughness: 1, metalness: 0 })))

  // Windows are unlit on purpose. A lit apartment window is a *source*; running
  // it through the lighting model makes it darker than the sky behind it, which
  // is exactly backwards. The interior texture carries the gradient and the
  // vertex colour carries the per-window tint.
  push(
    litGlass.build(
      new MeshBasicMaterial({ map: windowAtlas(true), vertexColors: true, toneMapped: true }),
    ),
  )
  // Unlit glass is a *mirror*, not a dark picture.
  //
  // Both states used to be the same unlit material, which is why every dark
  // window read as a painted-on rectangle. At night the difference is the whole
  // point: a lit room shows you the room and emits, an unlit one shows you the
  // sky and the building opposite and emits nothing. Making the dark state
  // metallic and smooth is what turns it back into glass.
  push(
    darkGlass.build(
      new MeshStandardMaterial({
        map: windowAtlas(false),
        vertexColors: true,
        metalness: 0.92,
        roughness: 0.09,
        envMapIntensity: SUN_UP ? 1.6 : 3.2,
      }),
    ),
  )
  // Shopfront glazing, one mesh per probe. Its envMap is filled in after the
  // scene exists — the reflection cannot be baked before there is something to
  // reflect, so main.ts calls captureProbes and assigns them here.
  const shopGlassMeshes: Mesh[] = []
  for (const batch of shopGlass) {
    const mesh = batch.build(
      new MeshStandardMaterial({
        color: 0x1b2028,
        metalness: 0.85,
        // Grime, not a uniform value. See glassGrime: a flat mirror on a flat
        // quad is a painted panel, and the streaks are what say "glass".
        roughnessMap: glassGrime(),
        roughness: 1,
        // Transparent, which is the whole fix.
        //
        // This was opaque, and the lit interior plane 0.9 m behind it had
        // therefore never been visible once in the project — the comment at the
        // interior's construction describes seeing the room *and* the
        // reflection on one pane, which is right, and which the material made
        // impossible. Hiding these meshes changed 77% of a square-on shopfront
        // frame, so they were not a subtle contributor: they were the frontage.
        //
        // opacity multiplies the whole fragment, envMap included, so the probe
        // has to be scaled back up by roughly 1/opacity to keep the reflection
        // at the strength it was baked for.
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
        envMapIntensity: (SUN_UP ? 4.0 : 2.2) / 0.30,
        vertexColors: true,
        side: DoubleSide,
      }),
    )
    if (!mesh) continue
    shopGlassMeshes.push(mesh)
    push(mesh)
  }

  return { group, cues, neon, triangles, drawCalls, shopGlassMeshes }
}

interface Batches {
  facade: Batch
  trim: Batch
  metal: Batch
  shutter: Batch
  litGlass: Batch
  darkGlass: Batch
  shopGlass: Batch[]
  dark: Batch
}

function buildOne(
  b: BuildingSpec,
  batch: Batches,
  cues: LightCue[],
  group: Group,
  neon: NeonSign[],
): void {
  const rand = rng(b.seed)
  const width = Math.abs(b.z1 - b.z0)
  const zc = (b.z0 + b.z1) / 2
  const height = b.groundHeight + b.floors * b.floorHeight
  const faceX = b.side * WALK_HALF
  /**
   * The two directions along X, named so they cannot be got the wrong way
   * round again.
   *
   * `side` is which kerb the building is on, so a building on side -1 occupies
   * x < -WALK_HALF and the street is at *greater* x than its facade. Going
   * "into" that building therefore means going toward -X — the same sign as
   * `side`, not the opposite. Getting that backwards put every building on the
   * street bodily inside the carriageway, and because the facades still faced
   * the right way it rendered as a plausible-looking canyon rather than as an
   * obvious error.
   */
  const inward = b.side
  const outward = -b.side

  // Per-building tint so two brick buildings are not the same brick.
  const tint = new Color().setHSL(
    0.06 + rand() * 0.06,
    0.05 + rand() * 0.18,
    0.42 + rand() * 0.3,
  )

  // ---- shell ------------------------------------------------------------
  //
  // Starts at the shopfront head, not at the pavement.
  //
  // It used to be a single box from y=0 to the roofline, which put its street
  // face 32 cm *in front of* the shopfront glazing built behind it. Every shop
  // window, roller shutter, lit interior, mullion and stall riser on this street
  // was therefore sealed inside a solid wall and had never once been visible —
  // through the golden-hour build, the night conversion, the frontage work that
  // measured 90% occupancy, and the reflection probes added to put parked cars
  // in the glass. All of it rendered correctly, into the inside of a brick box.
  //
  // A real terrace has no wall there either: the ground floor is piers and a
  // fascia with an opening between them, which is what a shopfront needs in
  // order to be one.
  const shellBase = SHOPFRONT_HEAD
  const shellH = height - shellBase
  M.makeScale(b.depth, shellH, width).setPosition(
    faceX + inward * (b.depth / 2),
    shellBase + shellH / 2,
    zc,
  )
  // A brick sheet is ~2.2 m of wall. Scaling UVs by the box's own size keeps
  // the course height identical on an 11 m frontage and a 20 m one. The ramp
  // darkens the lowest few metres: road spray, exhaust, and years of people
  // leaning on it.
  batch.facade.add(BOX, M, tint, [width / 2.2, shellH / 2.2], {
    y0: shellBase,
    y1: shellBase + 4.2,
    scale: 0.7,
  })

  // Piers: one at each party wall, one between adjacent bays. They carry the
  // storeys above, and they are what makes the gap below read as an opening
  // rather than as a missing wall.
  const pierEdges = [b.z0 + 0.3, b.z1 - 0.3]
  for (let i = 1; i < b.bays.length; i++) pierEdges.push(b.bays[i].z0 - 0.25)
  for (const pz of pierEdges) {
    M.makeScale(b.depth * 0.35, shellBase, 0.62).setPosition(
      faceX + inward * (b.depth * 0.175),
      shellBase / 2,
      pz,
    )
    batch.facade.add(BOX, M, tint, [0.62 / 2.2, shellBase / 2.2], {
      y0: 0,
      y1: 3.6,
      scale: 0.6,
    })
  }

  // A dark back wall behind the shopfronts, so the new opening does not look
  // through the building into nothing.
  M.makeScale(0.4, shellBase, width).setPosition(faceX + inward * 2.2, shellBase / 2, zc)
  batch.dark.add(BOX, M)

  // ---- floor-line ledges ------------------------------------------------
  // A horizontal band at each floor is the single highest-value piece of
  // facade relief at this sun angle: it is the only thing on a flat wall that
  // casts a shadow, and a wall with no shadow on it looks like a texture.
  for (let f = 0; f <= b.floors; f++) {
    const y = b.groundHeight + f * b.floorHeight
    if (y > height - 0.5) break
    M.makeScale(0.16, 0.14, width).setPosition(faceX + outward * 0.05, y, zc)
    batch.trim.add(BOX, M, new Color(0.9, 0.88, 0.84))
  }

  // ---- cornice and parapet ---------------------------------------------
  if (b.cornice) {
    const proj = 0.28 + rand() * 0.22
    M.makeScale(proj, 0.42, width + 0.1).setPosition(
      faceX + outward * (proj / 2 - 0.02),
      height - 0.21,
      zc,
    )
    batch.trim.add(BOX, M, new Color(0.95, 0.92, 0.87))
  }
  M.makeScale(0.3, b.parapet, width).setPosition(
    faceX + inward * 0.15,
    height + b.parapet / 2,
    zc,
  )
  batch.trim.add(BOX, M, new Color(0.8, 0.78, 0.74))

  // ---- roof clutter -----------------------------------------------------
  // Only silhouette matters; none of this is visible as a surface from a
  // pavement 4 m away. It is here for the roofline of the buildings 60 m down
  // the street, which is where the eye actually reads the skyline.
  const roofY = height + b.parapet
  if (b.roofKind === 0) {
    // Timber water tank on a steel frame.
    const r = 1.05 + rand() * 0.35
    M.makeScale(r, 2.3, r).setPosition(faceX + inward * (2.4 + rand() * 2), roofY + 2.6, zc + (rand() - 0.5) * width * 0.4)
    batch.trim.add(TANK, M, new Color(0.5, 0.36, 0.26))
    for (const dx of [-0.7, 0.7]) {
      for (const dz of [-0.7, 0.7]) {
        M2.makeScale(0.1, 1.5, 0.1).setPosition(
          M.elements[12] + dx,
          roofY + 0.75,
          M.elements[14] + dz,
        )
        batch.metal.add(BOX, M2, new Color(0.5, 0.5, 0.5))
      }
    }
  } else if (b.roofKind === 1) {
    // Stair bulkhead.
    M.makeScale(2.6, 2.4, 2.8).setPosition(
      faceX + inward * (3 + rand() * 2),
      roofY + 1.2,
      zc + (rand() - 0.5) * width * 0.4,
    )
    batch.facade.add(BOX, M, tint, [2.6 / 2.2, 2.4 / 2.2])
  } else {
    // Vents and ducting.
    for (let i = 0; i < 3; i++) {
      M.makeScale(0.5 + rand() * 0.5, 0.6 + rand() * 0.9, 0.5 + rand() * 0.5).setPosition(
        faceX + inward * (2 + rand() * 4),
        roofY + 0.5,
        zc + (rand() - 0.5) * width * 0.7,
      )
      batch.metal.add(BOX, M, new Color(0.6, 0.6, 0.58))
    }
  }

  // ---- upper-floor windows ---------------------------------------------
  // Window proportions are per building, and they diminish going up.
  //
  // Critic #10: "every floor is a copy of the one below at the same pitch". The
  // pitch is the part worth keeping — openings stack because the piers between
  // them carry load, and sliding them about per floor reads as a mistake rather
  // than as variety. What varies in a real terrace is the *storey*: ground and
  // first are the good rooms with tall windows, and each floor above is a little
  // shorter until the attic is nearly square. One rule, and no floor is a copy
  // of the one below any more.
  const winW = 0.94 + rand() * 0.26
  const winBase = 1.56 + rand() * 0.26
  const bays = Math.max(2, Math.floor(width / 2.55))
  const bayPitch = width / bays
  // A string course: a projecting band on one floor's cill line, on a third of
  // the street. It is the other thing that stops a facade reading as a grid —
  // a horizontal running the full width, cutting the vertical run of openings.
  const bandFloor = b.floors > 2 && rand() < 0.34 ? 1 + Math.floor(rand() * (b.floors - 1)) : -1

  for (let f = 0; f < b.floors; f++) {
    const taper = Math.max(0.70, 1 - 0.075 * f)
    const sillOff = 0.80 + 0.055 * f
    // Clamped against the storey, not just scaled: the taper is a proportion and
    // `floorHeight` varies per building, so on a low-ceilinged one the untapered
    // height would put the window head through the floor above.
    const winH = Math.min(winBase * taper, b.floorHeight - sillOff - 0.30)
    const sillY = b.groundHeight + f * b.floorHeight + sillOff
    if (f === bandFloor) {
      M.makeScale(0.28, 0.17, width).setPosition(faceX + outward * 0.1, sillY - 0.26, zc)
      batch.trim.add(BOX, M, new Color(0.84, 0.82, 0.78), [width / 2.2, 0.17 / 2.2])
    }
    for (let i = 0; i < bays; i++) {
      const wz = b.z0 + (i + 0.5) * bayPitch
      // 21:00: most people are in. A night facade with four windows lit is a
      // power cut, not an evening.
      const lit = rand() < (SUN_UP ? 0.40 : 0.66)
      const isTv = lit && rand() < 0.16

      // One opening in twelve is bricked up. Old terraces are full of them —
      // window tax, a party wall built against, a flat subdivided — and they put
      // a differently-toned rectangle in the middle of a run of glass, which
      // breaks the grid harder than any amount of colour jitter.
      if (rand() < 0.085) {
        M.makeScale(0.3, winH + 0.06, winW + 0.06).setPosition(
          faceX + outward * 0.02,
          sillY + winH / 2,
          wz,
        )
        batch.facade.add(BOX, M, tint.clone().multiplyScalar(0.82), [
          (winW + 0.06) / 2.2,
          (winH + 0.06) / 2.2,
        ])
        // The cill survives even when the opening does not.
        M.makeScale(0.2, 0.09, winW + 0.28).setPosition(faceX + outward * 0.04, sillY - 0.045, wz)
        batch.trim.add(BOX, M, new Color(0.9, 0.88, 0.85))
        continue
      }

      // Reveal: a shallow dark box behind the glass. Without it the glass sits
      // flush with the brick and the facade reads as a decal sheet.
      M.makeScale(0.34, winH + 0.1, winW + 0.1).setPosition(
        faceX + inward * 0.18,
        sillY + winH / 2,
        wz,
      )
      batch.dark.add(BOX, M)

      // Glass, recessed 0.13 m, facing the street.
      M.makeRotationY(-b.side * Math.PI * 0.5)
      M2.makeScale(winW, winH, 1)
      M.multiply(M2).setPosition(faceX + inward * 0.13, sillY + winH / 2, wz)

      // Which room is behind this window. Weighted rather than uniform: most
      // openings are ordinary rooms, a television is occasional, and a stairwell
      // with coloured glass is rare enough to be worth noticing when it appears.
      const roll = rand()
      const cellIdx = isTv
        ? rand() < 0.5 ? 4 : 12
        : roll < 0.07
          ? rand() < 0.5 ? 7 : 15
          : [0, 1, 2, 3, 5, 6, 8, 9, 10, 11, 13, 14][Math.floor(rand() * 12)]

      if (lit) {
        // Lit windows are the main event after dark — a night facade is mostly
        // dark brick with a scatter of bright rectangles, and those rectangles
        // are what tells you the building is inhabited rather than a wall. At
        // golden hour the same value has to sit *under* the sky or the window
        // looks like a hole cut in the building; at night it has to sit well
        // above everything around it. Same geometry, opposite exposure problem.
        // 3.4 was the correction for windows being invisible, and it overshot
        // straight past the bloom threshold: every window grew a soft oval
        // halo far larger than the opening, which reads as a sticker on the
        // wall rather than as a lit room. Bright enough to carry the facade,
        // not so bright that the bloom pass turns it into a blob.
        const glow = SUN_UP ? 1 : 2.1
        const c = isTv
          ? new Color(0.55 * glow, 0.72 * glow, 1.15 * glow)
          : new Color(
              1.15 * glow,
              (0.82 + rand() * 0.2) * glow,
              (0.5 + rand() * 0.2) * glow,
            )
        batch.litGlass.add(QUAD, M, c, windowCell(cellIdx))
        // Window light bleeding onto the wall around the opening, per the brief.
        //
        // This used to be gated to the lower two floors, on the reasoning that
        // higher windows do not reach the ground. That was true of what the cue
        // *did* at the time — it made a pool on the pavement. It has since been
        // changed to light the wall the window is set into, and a fourth-floor
        // window lights its own wall exactly as well as a first-floor one does.
        // The guard outlived its consumer, and the effect was that the upper
        // facades — the part of the frame that measures blankest — were the one
        // part deliberately excluded from the only light reaching them.
        {
          cues.push({
            kind: 'window',
            x: faceX,
            y: sillY + winH / 2,
            z: wz,
            side: b.side,
            color: c,
            radius: SUN_UP ? 3.4 : 4.6,
            intensity: (isTv ? 0.5 : 0.75) * (SUN_UP ? 1 : 1.8),
          })
        }
      } else {
        batch.darkGlass.add(QUAD, M, new Color(0.7 + rand() * 0.5, 0.75, 0.9), windowCell(cellIdx))
      }

      // Sill and lintel.
      M.makeScale(0.2, 0.09, winW + 0.28).setPosition(faceX + outward * 0.04, sillY - 0.045, wz)
      batch.trim.add(BOX, M, new Color(0.9, 0.88, 0.85))
      M.makeScale(0.16, 0.12, winW + 0.36).setPosition(
        faceX + outward * 0.02,
        sillY + winH + 0.06,
        wz,
      )
      batch.trim.add(BOX, M, new Color(0.85, 0.83, 0.8))

      // Frame and mullions.
      //
      // A window that is one flat quad of glass is the single biggest reason a
      // facade reads as a printed box rather than a building — described from
      // play as "Lego blocks". A real sash has a frame standing proud of the
      // reveal and at least one bar crossing it, and those two thin strips are
      // what the eye uses to decide there is a window there at all.
      const fr = new Color(0.74, 0.72, 0.68)
      for (const sgn of [-1, 1]) {
        // Jambs.
        M.makeScale(0.09, winH, 0.06).setPosition(
          faceX + outward * 0.02, sillY + winH / 2, wz + sgn * (winW / 2),
        )
        batch.trim.add(BOX, M, fr)
      }
      // Head and cill rails of the frame itself.
      for (const yy of [sillY + 0.03, sillY + winH - 0.03]) {
        M.makeScale(0.09, 0.06, winW + 0.12).setPosition(faceX + outward * 0.02, yy, wz)
        batch.trim.add(BOX, M, fr)
      }
      // Transom, a third of the way down — and a mullion on the wider sashes.
      M.makeScale(0.08, 0.05, winW).setPosition(
        faceX + outward * 0.02, sillY + winH * 0.66, wz,
      )
      batch.trim.add(BOX, M, fr)
      if (rand() < 0.5) {
        M.makeScale(0.08, winH * 0.62, 0.05).setPosition(
          faceX + outward * 0.02, sillY + winH * 0.31, wz,
        )
        batch.trim.add(BOX, M, fr)
      }

      // A window box on some of the lower sills. Cheap, and the only green on
      // the whole street.
      if (f < 3 && rand() < 0.22) {
        M.makeScale(0.24, 0.16, winW * 0.8).setPosition(
          faceX + outward * 0.14, sillY - 0.02, wz,
        )
        batch.trim.add(BOX, M, new Color(0.42, 0.3, 0.22))
        for (let k = 0; k < 3; k++) {
          const r2 = 0.07 + rand() * 0.05
          M.makeScale(r2, r2 * 0.8, r2).setPosition(
            faceX + outward * 0.14 + (rand() - 0.5) * 0.06,
            sillY + 0.11,
            wz + (k - 1) * winW * 0.24,
          )
          batch.metal.add(BALL, M, new Color(0.07 + rand() * 0.05, 0.12 + rand() * 0.06, 0.04))
        }
      }

      // Security bars, on the floors people can reach.
      //
      // The single most characteristic thing about a ground-floor window on a
      // street like this, and it was missing entirely — which is a large part of
      // why the openings read as decorative rather than defensive.
      if (f < 2 && rand() < (f === 0 ? 0.62 : 0.28)) {
        const bar = new Color(0.19, 0.18, 0.17)
        const bars = 4 + Math.floor(rand() * 3)
        for (let k = 0; k < bars; k++) {
          const bz = wz - winW / 2 + ((k + 0.5) / bars) * winW
          M.makeScale(0.045, winH - 0.08, 0.03).setPosition(
            faceX + outward * 0.09,
            sillY + winH / 2,
            bz,
          )
          batch.metal.add(BOX, M, bar)
        }
        // Two horizontals, which is what stops it reading as a picket fence.
        for (const t of [0.3, 0.72]) {
          M.makeScale(0.04, 0.035, winW).setPosition(
            faceX + outward * 0.09,
            sillY + winH * t,
            wz,
          )
          batch.metal.add(BOX, M, bar)
        }
      }

      // AC unit in roughly one window in five.
      if (rand() < 0.2) {
        M.makeScale(0.42, 0.34, 0.62).setPosition(
          faceX + outward * 0.2,
          sillY + 0.17,
          wz,
        )
        batch.metal.add(BOX, M, new Color(0.78, 0.78, 0.76))
        // Bracket underneath.
        M.makeScale(0.3, 0.05, 0.06).setPosition(faceX + outward * 0.14, sillY - 0.02, wz)
        batch.metal.add(BOX, M, new Color(0.4, 0.4, 0.4))
      }
    }
  }

  // ---- balconies --------------------------------------------------------
  //
  // The other half of the "Lego block" note. A terrace facade is not flat: it
  // has things sticking out of it, and a balcony is the biggest of them. It also
  // does the most work at night, because the railing catches the lamp light
  // edge-on and draws a bright horizontal line across an otherwise dark wall.
  if (rand() < 0.72) {
    const balconyFloors = 1 + Math.floor(rand() * Math.max(1, b.floors - 1))
    const bz = b.z0 + width * (0.2 + rand() * 0.6)
    const bw2 = 2.0 + rand() * 1.4
    for (let f = 1; f <= b.floors; f++) {
      if (f > balconyFloors) break
      const y = b.groundHeight + f * b.floorHeight - 0.15
      const proj = 0.85 + rand() * 0.35
      // Slab.
      M.makeScale(proj, 0.12, bw2).setPosition(faceX + outward * (proj / 2), y, bz)
      batch.trim.add(BOX, M, new Color(0.8, 0.78, 0.74))
      // Underside bracket, so it is carried rather than glued on.
      for (const sgn of [-1, 1]) {
        M.makeRotationZ(outward * 0.7)
        M2.makeScale(0.07, proj * 0.9, 0.07)
        M.multiply(M2).setPosition(
          faceX + outward * (proj * 0.45), y - 0.28, bz + sgn * (bw2 / 2 - 0.15),
        )
        batch.metal.add(BOX, M, new Color(0.3, 0.28, 0.26))
      }
      // Railing: top rail, bottom rail, balusters, and returns at each end.
      // Painted rail, not bare iron. At golden hour a dark railing silhouettes
      // against a bright wall; after dark it is dark metal on a dark wall and
      // disappears entirely, which is why the balconies could not be found on
      // the night sweep. A lighter, warmer paint catches the lamp instead.
      const rail = SUN_UP ? new Color(0.26, 0.25, 0.23) : new Color(0.58, 0.54, 0.48)
      for (const yy of [y + 1.02, y + 0.12]) {
        M.makeScale(0.05, 0.05, bw2).setPosition(faceX + outward * proj, yy, bz)
        batch.metal.add(BOX, M, rail)
      }
      const bal = Math.max(6, Math.round(bw2 / 0.16))
      for (let k = 0; k <= bal; k++) {
        const zz = bz - bw2 / 2 + (k / bal) * bw2
        M.makeScale(0.028, 1.0, 0.028).setPosition(faceX + outward * proj, y + 0.56, zz)
        batch.metal.add(BOX, M, rail)
      }
      for (const sgn of [-1, 1]) {
        M.makeScale(proj, 0.05, 0.05).setPosition(
          faceX + outward * (proj / 2), y + 1.02, bz + sgn * (bw2 / 2),
        )
        batch.metal.add(BOX, M, rail)
        for (let k = 1; k < 5; k++) {
          M.makeScale(0.028, 1.0, 0.028).setPosition(
            faceX + outward * (proj * (k / 5)), y + 0.56, bz + sgn * (bw2 / 2),
          )
          batch.metal.add(BOX, M, rail)
        }
      }
    }
  }

  // ---- fire escape ------------------------------------------------------
  if (b.fireEscape) {
    const fz = b.z0 + width * (0.28 + rand() * 0.44)
    const platW = 2.5
    const proj = 1.0
    for (let f = 1; f <= b.floors; f++) {
      const y = b.groundHeight + f * b.floorHeight - 0.1
      // Platform.
      M.makeScale(proj, 0.07, platW).setPosition(faceX + outward * (proj / 2), y, fz)
      batch.metal.add(BOX, M, new Color(0.34, 0.3, 0.27))
      // Railing: top rail plus balusters. This is a silhouette feature seen
      // against a bright sky, so the balusters have to be real geometry.
      M.makeScale(0.05, 0.05, platW).setPosition(faceX + outward * proj, y + 1.02, fz)
      batch.metal.add(BOX, M, new Color(0.34, 0.3, 0.27))
      for (let k = 0; k < 9; k++) {
        const bz = fz - platW / 2 + (k / 8) * platW
        M.makeScale(0.035, 1.0, 0.035).setPosition(faceX + outward * proj, y + 0.5, bz)
        batch.metal.add(BOX, M, new Color(0.3, 0.27, 0.24))
      }
      // Side rails so the platform is enclosed.
      for (const s of [-1, 1]) {
        M.makeScale(proj, 0.045, 0.045).setPosition(
          faceX + outward * (proj / 2),
          y + 1.02,
          fz + (s * platW) / 2,
        )
        batch.metal.add(BOX, M, new Color(0.34, 0.3, 0.27))
      }
      // Ladder to the floor below, angled and offset so the zigzag reads.
      if (f > 1) {
        const drop = b.floorHeight
        const angle = Math.atan2(drop, 1.5)
        const lz = fz + (f % 2 ? platW * 0.32 : -platW * 0.32)
        M.makeRotationX(b.side * (Math.PI / 2 - angle))
        M2.makeScale(0.5, Math.hypot(drop, 0.4), 0.06)
        M.multiply(M2).setPosition(faceX + outward * (proj * 0.7), y - drop / 2, lz)
        batch.metal.add(BOX, M, new Color(0.32, 0.28, 0.25))
      }
    }
  }

  // ---- what is actually on the upper wall -------------------------------
  //
  // This is the other half of the blank-wall problem. The contact sheet's
  // across-the-street frames are filled by the wall *above* the shopfront, and
  // a brick sheet with windows punched in it is not what that wall looks like.
  // A real facade at this height carries plumbing, ventilation and cabling, and
  // all of it is small, vertical, and catches the low sun edge-on — which is
  // exactly the sort of relief that reads at four metres and stops a wall
  // photographing as a texture swatch.
  facadeServices(b, batch, rand, height, width, faceX, outward, zc)

  // A painted advertisement on the upper wall, on about half of them. This is
  // the single largest piece of structure available for the region the blank
  // measurement is complaining about — a smooth wash over brick with nothing on
  // it — and it costs one quad.
  if (rand() < 0.5 && height > b.groundHeight + b.floorHeight * 2) {
    const gw = Math.min(width * 0.72, 9)
    const gh = gw * 0.62
    const gy = b.groundHeight + (height - b.groundHeight) * (0.52 + rand() * 0.3)
    const ghost = new Mesh(
      new PlaneGeometry(gw, gh),
      new MeshStandardMaterial({
        map: ghostSign(Math.floor(rand() * 9999)),
        transparent: true,
        roughness: 0.95,
        metalness: 0,
        envMapIntensity: 0.5,
        depthWrite: false,
        side: DoubleSide,
        // A decal on a wall is coplanar with it, and 3 cm of standoff is not
        // enough depth precision to settle the argument at twenty metres seen
        // almost edge-on: the quad and the brick swap places in patches and the
        // sign breaks into a run of blocky rectangles smeared along the wall.
        // That is what came back as "the shop signs overlap".
        //
        // The note on the sign shadow already recorded this exact lesson —
        // "1.2 cm, then 3.5 cm, both still broke into blocky z-fighting where
        // the wall is seen almost edge-on" — and the fix there was to stand the
        // quad well off the wall. That works for a board bolted on; it does not
        // for paint, which really is on the brick. `polygonOffset` is the right
        // tool for a decal: it biases the depth in the rasteriser without moving
        // the geometry, so the sign stays flat on the wall and still wins.
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
    )
    ghost.rotation.y = -b.side * Math.PI * 0.5
    ghost.position.set(faceX + outward * 0.05, gy, zc + (rand() - 0.5) * width * 0.2)
    ghost.renderOrder = 1
    group.add(ghost)
  }

  // ---- ground floor -----------------------------------------------------
  buildGroundFloor(b, batch, cues, group, rand, tint, neon)
}

/**
 * The block across the far end of the street.
 *
 * Deliberately plain: it is 68 m away through haze and is doing one job, which
 * is stopping the eye before it reaches the horizon. Detail here would be
 * invisible and would cost triangles in the one place the frame is already
 * spending them on distance. What it does need is *lit windows*, because an
 * unlit mass at this distance reads as a hill rather than as a building.
 */
function closingTerrace(facade: Batch, litGlass: Batch, z: number, height: number): void {
  const rand = rng(Math.round(Math.abs(z) * 7) + 3)
  const WIDTH = 74
  // Three set-back masses rather than one slab, so the roofline is not a
  // perfectly straight edge against the sky.
  for (let i = 0; i < 3; i++) {
    const w = WIDTH / 3
    const x = -WIDTH / 2 + w * (i + 0.5)
    const h = height * (0.78 + rand() * 0.42)
    const d = 9 + rand() * 5
    const cz = z - (rand() - 0.5) * 3
    M.makeScale(w - 0.4, h, d).setPosition(x, h / 2, cz)
    facade.add(BOX, M, new Color(0.42 + rand() * 0.12, 0.39 + rand() * 0.1, 0.36 + rand() * 0.1),
      [w / 2.2, h / 2.2], { y0: 0, y1: 5, scale: 0.72 })

    // Windows on every face that can be seen, not just the one down the street.
    //
    // The first version glazed only the street-facing side, on the reasoning
    // that the terrace is there to close the view along the carriageway. But
    // you can stand at the crossing and look *across*, and from there it was a
    // bare lit slab with a hard edge against the sky — worse than the horizon
    // it was put there to hide. It is four boxes; glazing all their faces is
    // free, and an unlit mass at this distance reads as a hill rather than a
    // building.
    const toward = z < 0 ? 1 : -1
    const rows = Math.floor((h - 2.4) / 3.1)
    const face = (along: 'z' | 'x') => (along === 'z' ? cz + toward * (d / 2 + 0.02) : 0)
    const glaze = (
      cols: number,
      at: (i: number) => [number, number, number],
      turn: number,
    ) => {
      for (let ci = 0; ci < cols; ci++) {
        for (let ry = 0; ry < rows; ry++) {
          if (rand() > 0.52) continue
          const [wx, , wz] = at(ci)
          // A reveal behind the glass, as on the real buildings.
          //
          // Without it these are lit rectangles lying on the surface, and at the
          // near end — where the terrace is now only 19 m from where the player
          // can stand — that reads as stickers on a slab. The box is pushed back
          // along the same axis the window faces, which is what `turn` encodes.
          const inx = -Math.sin(turn)
          const inz = -Math.cos(turn)
          M.makeRotationY(turn)
          M2.makeScale(1.3, 1.7, 0.5)
          M.multiply(M2).setPosition(wx + inx * 0.26, 2.2 + ry * 3.1, wz + inz * 0.26)
          facade.add(BOX, M, new Color(0.05, 0.045, 0.04), [0.6, 0.8])

          M.makeRotationY(turn)
          M2.makeScale(1.1, 1.5, 1)
          M.multiply(M2).setPosition(wx + inx * 0.1, 2.2 + ry * 3.1, wz + inz * 0.1)
          const warm = 0.55 + rand() * 0.5
          litGlass.add(
            QUAD,
            M,
            new Color(1.15 * warm, 0.86 * warm, 0.52 * warm),
            windowCell(Math.floor(rand() * 16)),
          )
        }
      }
    }
    // Down the street.
    glaze(
      Math.floor((w - 1.2) / 2.3),
      (i) => [x - (w - 0.4) / 2 + 1.1 + i * 2.3, 0, face('z')],
      toward > 0 ? 0 : Math.PI,
    )
    // And the two returns, which are what you see from the crossing.
    for (const sx of [-1, 1]) {
      glaze(
        Math.floor((d - 1.2) / 2.3),
        (i) => [x + sx * ((w - 0.4) / 2 + 0.02), 0, cz - d / 2 + 1.1 + i * 2.3],
        (sx * Math.PI) / 2,
      )
    }
  }
}

/**
 * Downpipes, vents, conduit and dishes.
 *
 * Cheap in triangles, disproportionate in effect: a downpipe is a 12 cm vertical
 * cylinder running fifteen metres, and it is the only thing on an otherwise flat
 * wall that throws a hard shadow line down the whole height of the building.
 */
function facadeServices(
  b: BuildingSpec,
  batch: Batches,
  rand: () => number,
  height: number,
  width: number,
  faceX: number,
  outward: number,
  zc: number,
): void {
  const cast = new Color(0.30, 0.29, 0.27)

  // Downpipe, hard against one party wall where the gutter actually drains.
  const pipeZ = zc + (rand() > 0.5 ? 1 : -1) * (width / 2 - 0.35)
  M.makeScale(0.075, height - 0.2, 0.075).setPosition(
    faceX + outward * 0.09,
    (height - 0.2) / 2,
    pipeZ,
  )
  batch.metal.add(CYL_TALL, M, cast)
  // A shoe at the bottom, kicking the water away from the wall.
  M.makeRotationX(outward * 0.38)
  M2.makeScale(0.08, 0.4, 0.08)
  M.multiply(M2).setPosition(faceX + outward * 0.14, 0.32, pipeZ)
  batch.metal.add(CYL_TALL, M, cast)
  // Brackets every couple of metres, which is what makes it read as fixed to
  // the wall rather than floating alongside it.
  for (let y = 1.4; y < height - 0.6; y += 1.9 + rand() * 0.5) {
    M.makeScale(0.13, 0.05, 0.05).setPosition(faceX + outward * 0.05, y, pipeZ)
    batch.metal.add(BOX, M, cast)
  }

  // Air bricks and extract vents, scattered but never below the shopfront head.
  const vents = 4 + Math.floor(rand() * 5)
  for (let i = 0; i < vents; i++) {
    const y = b.groundHeight + 0.4 + rand() * (height - b.groundHeight - 1.2)
    const z = zc + (rand() - 0.5) * (width - 1.2)
    if (rand() > 0.45) {
      // Louvred extract, with a hood.
      M.makeScale(0.1, 0.3, 0.34).setPosition(faceX + outward * 0.05, y, z)
      batch.metal.add(BOX, M, new Color(0.5, 0.49, 0.46))
      M.makeScale(0.16, 0.06, 0.4).setPosition(faceX + outward * 0.1, y + 0.19, z)
      batch.metal.add(BOX, M, new Color(0.42, 0.41, 0.39))
    } else {
      // Terracotta air brick, sunk flush.
      M.makeScale(0.06, 0.2, 0.22).setPosition(faceX + outward * 0.02, y, z)
      batch.trim.add(BOX, M, new Color(0.62, 0.42, 0.3))
    }
  }

  // A second downpipe on the other party wall, on the wider frontages. Real
  // terraces drain at both ends of a roof and it doubles the number of hard
  // vertical lines on the wall for eight triangles.
  if (width > 14) {
    const pz2 = zc - Math.sign(pipeZ - zc) * (width / 2 - 0.4)
    M.makeScale(0.065, height - 0.2, 0.065).setPosition(
      faceX + outward * 0.085,
      (height - 0.2) / 2,
      pz2,
    )
    batch.metal.add(CYL_TALL, M, cast)
    for (let y = 1.6; y < height - 0.6; y += 2.1) {
      M.makeScale(0.12, 0.05, 0.05).setPosition(faceX + outward * 0.05, y, pz2)
      batch.metal.add(BOX, M, cast)
    }
  }

  // Rainwater hopper at the head of the main downpipe — a small funnel where the
  // gutter empties into it, and the only thing on the wall at that height.
  M.makeScale(0.2, 0.3, 0.26).setPosition(faceX + outward * 0.13, height - 0.75, pipeZ)
  batch.metal.add(HOPPER, M, cast)

  // A horizontal conduit run crossing the wall, clipped to brackets. These cross
  // party walls in reality and the previous version stopped every service at the
  // building edge, which quietly reinforced the per-building repetition.
  if (rand() < 0.55) {
    const cy = b.groundHeight + 0.5 + rand() * 1.2
    M.makeScale(0.05, 0.05, width * 0.9).setPosition(faceX + outward * 0.07, cy, zc)
    batch.metal.add(BOX, M, new Color(0.34, 0.33, 0.31))
    for (let i = 0; i < 5; i++) {
      M.makeScale(0.09, 0.05, 0.05).setPosition(
        faceX + outward * 0.04,
        cy,
        zc - width * 0.4 + (i / 4) * width * 0.8,
      )
      batch.metal.add(BOX, M, cast)
    }
  }

  // Service head and a conduit run down to it. Every terrace has one and they
  // are always in a slightly stupid place.
  const boxZ = zc + (rand() - 0.5) * width * 0.6
  const boxY = b.groundHeight + 0.9 + rand() * 1.4
  M.makeScale(0.14, 0.42, 0.3).setPosition(faceX + outward * 0.08, boxY, boxZ)
  batch.metal.add(BOX, M, new Color(0.44, 0.43, 0.4))
  M.makeScale(0.05, boxY - b.groundHeight + 0.3, 0.05).setPosition(
    faceX + outward * 0.04,
    b.groundHeight + (boxY - b.groundHeight) / 2 - 0.15,
    boxZ + 0.19,
  )
  batch.metal.add(CYL_TALL, M, new Color(0.36, 0.35, 0.33))

  // A dish on about a third of them, up high.
  if (rand() < 0.55) {
    const dz = zc + (rand() - 0.5) * width * 0.7
    const dy = height - 1.4 - rand() * 2.5
    M.makeScale(0.05, 0.05, 0.5).setPosition(faceX + outward * 0.25, dy, dz)
    batch.metal.add(BOX, M, cast)
    M.makeRotationZ(outward * 0.5)
    M2.makeScale(0.34, 0.07, 0.34)
    M.multiply(M2).setPosition(faceX + outward * 0.45, dy + 0.1, dz)
    batch.trim.add(DISH, M, new Color(0.86, 0.85, 0.82))
  }
}

/**
 * The retail storey. Set back from the facade above it, which gives the street
 * a shadow line at 4 m that runs the whole block — the single most useful
 * horizontal in the frame.
 */
function buildGroundFloor(
  b: BuildingSpec,
  batch: Batches,
  cues: LightCue[],
  group: Group,
  rand: () => number,
  tint: Color,
  neon: NeonSign[],
): void {
  const faceX = b.side * WALK_HALF
  // Same convention as buildOne: inward shares the sign of `side`.
  const inward = b.side
  const outward = -b.side
  const setback = 0.32
  const glassX = faceX + inward * setback
  const width = Math.abs(b.z1 - b.z0)
  const zc = (b.z0 + b.z1) / 2

  // Bulkhead above the shopfront, and the reveal at the setback.
  M.makeScale(setback + 0.1, 1.0, width).setPosition(
    faceX + inward * (setback / 2),
    b.groundHeight - 0.5,
    zc,
  )
  batch.facade.add(BOX, M, tint, [width / 2.2, 1 / 2.2])

  if (b.bays.length === 0) {
    // No business here: blank shuttered frontage. Real blocks have these and
    // leaving them out is what makes a procedural street feel like a mall.
    addShutter(batch, glassX, b, b.z0 + 0.4, b.z1 - 0.4, 3.1)
    return
  }

  for (const bay of b.bays) {
    const bz0 = bay.z0
    const bz1 = bay.z1
    const bw = bz1 - bz0
    const bzc = (bz0 + bz1) / 2
    const biz = bay.business
    const glassTop = 3.05

    // Not every unit is a shop. A street where they all are is a shopping
    // centre; the dead units, the front doors and the odd garage are what make
    // a block read as a place people live rather than a parade of frontages.
    if (bay.kind !== 'shop' || !biz) {
      if (bay.kind === 'residential') residentialEntry(batch, group, b, glassX, bz0, bz1, rand)
      else if (bay.kind === 'garage') garageDoor(batch, b, glassX, bz0, bz1)
      else deadUnit(batch, group, b, glassX, bz0, bz1, rand)
      continue
    }

    // Stall riser under the glass.
    M.makeScale(0.16, 0.42, bw).setPosition(glassX, 0.21 + CURB_HEIGHT, bzc)
    batch.trim.add(BOX, M, new Color(0.55, 0.52, 0.48))

    if (biz.shutter) {
      addShutter(batch, glassX, b, bz0, bz1, glassTop)
    } else {
      // Glazing, in two or three panes with mullions between them.
      const panes = bw > 4.5 ? 3 : 2
      const paneW = (bw - 0.5) / panes
      for (let p = 0; p < panes; p++) {
        const pz = bz0 + 0.25 + paneW * (p + 0.5)
        M.makeRotationY(-b.side * Math.PI * 0.5)
        M2.makeScale(paneW - 0.08, glassTop - 0.62, 1)
        M.multiply(M2).setPosition(glassX, 0.62 + (glassTop - 0.62) / 2 + CURB_HEIGHT, pz)
        batch.shopGlass[probeIndexFor(b.side, pz)].add(QUAD, M, new Color(1, 1, 1))
        if (p > 0) {
          M.makeScale(0.12, glassTop - 0.6, 0.1).setPosition(
            glassX,
            0.6 + (glassTop - 0.6) / 2 + CURB_HEIGHT,
            bz0 + 0.25 + paneW * p,
          )
          batch.metal.add(BOX, M, new Color(0.3, 0.28, 0.26))
        }
      }

      // Frame the opening. The mullions above only sit *between* panes, so a
      // two-pane shopfront had one bar in the middle and no joinery at its
      // edges — a sheet of glass floating in a hole rather than a shopfront.
      // End posts, head and bottom rail cost four boxes and are the difference.
      const frame = new Color(0.3, 0.28, 0.26)
      for (const ez of [bz0 + 0.25, bz1 - 0.25]) {
        M.makeScale(0.13, glassTop - 0.6, 0.11).setPosition(
          glassX,
          0.6 + (glassTop - 0.6) / 2 + CURB_HEIGHT,
          ez,
        )
        batch.metal.add(BOX, M, frame)
      }
      M.makeScale(0.15, 0.17, bw - 0.4).setPosition(glassX, glassTop + CURB_HEIGHT, bzc)
      batch.metal.add(BOX, M, frame)
      M.makeScale(0.15, 0.11, bw - 0.4).setPosition(glassX, 0.62 + CURB_HEIGHT, bzc)
      batch.metal.add(BOX, M, frame)

      if (biz.open) {
        // A lit interior: a shallow room, not a picture of one.
        //
        // This was a single plane 0.9 m behind the glass, and one plane has no
        // parallax — so walking the street, a row of lit frontages slid past as
        // one continuous bright band instead of as a row of rooms you look into
        // one at a time. Five quads make a box: back wall, two returns, ceiling
        // and floor. The returns are what does the work, because they *converge*,
        // and that convergence is different for every shop and changes as you
        // move. It costs no extra draw call — they all share the one texture and
        // material this already had, so they merge into the same mesh.
        const room = new Batch()
        const depth = 2.4
        // Floor to ceiling, not the glazed opening.
        //
        // Sized to the glass (0.7 to glassTop) the box's "floor" sat 84 cm up,
        // which from the kerb read as a lit shelf jutting out of the shopfront.
        // The room goes to the pavement; the stall riser hides the bottom of it,
        // which is exactly what a stall riser is for.
        const roomH = glassTop
        const roomW = bw - 0.4
        const tint = new Color(1, 1, 1)
        // Back wall, the full sheet.
        M.makeRotationY(-b.side * Math.PI * 0.5)
        M2.makeScale(roomW, roomH, 1)
        M.multiply(M2).setPosition(glassX + inward * depth, 0, bzc)
        room.add(QUAD, M, tint)
        // The two returns. Same v range as the back wall, so the shelf courses
        // carry round the corner instead of stopping at it; u compressed to the
        // room's depth so the texture density matches.
        for (const sz of [-1, 1]) {
          M.makeRotationY(sz > 0 ? 0 : Math.PI)
          M2.makeScale(depth, roomH, 1)
          M.multiply(M2).setPosition(
            glassX + inward * (depth / 2),
            0,
            bzc + sz * (roomW / 2),
          )
          room.add(QUAD, M, tint, [depth / roomW, 1])
        }
        // Ceiling and floor take a *slice* of the sheet, not the whole thing.
        //
        // Mapped like the walls they came out carrying the shelving, so the
        // room read as a mirrored box with stock on the floor and upside down
        // over your head. The sheet already has the two bands these want: the
        // strip light across the top, and the dark counter mass along the
        // bottom. `uv` here is [scaleX, scaleY, offsetX, offsetY], so a thin
        // scale with the right offset picks one band and stretches it.
        // Depth runs along X (into the building) and width along Z (along the
        // street) — so after the -90 degrees about X, the quad's *local* X is
        // the depth and its local Y is the width. Scaled the other way round
        // these came out spanning 4.5 m across the street instead of along it,
        // which put a lit ceiling plane out over the pavement and into the road.
        M.makeRotationX(-Math.PI / 2)
        M2.makeScale(depth, roomW, 1)
        M.multiply(M2).setPosition(glassX + inward * (depth / 2), roomH / 2, bzc)
        room.add(QUAD, M, new Color(0.62, 0.56, 0.46), [1, 0.05, 0, 0.9])
        M.makeRotationX(Math.PI / 2)
        M2.makeScale(depth, roomW, 1)
        M.multiply(M2).setPosition(glassX + inward * (depth / 2), -roomH / 2, bzc)
        room.add(QUAD, M, new Color(0.34, 0.28, 0.22), [1, 0.05, 0, 0.02])
        const interior = room.build(
          new MeshBasicMaterial({
            map: shopInterior(hashId(biz.id)),
            vertexColors: true,
            // Down from (3.4, 2.3, 1.35). That value had never been looked at:
            // the glazing in front of it was opaque, so the interior had never
            // been drawn. Once it was, it clipped to white across the middle of
            // every pane and the shop read as a lightbox. The glass in front now
            // passes 70%, which this accounts for.
            color: SUN_UP
              ? new Color(1.5, 1.05, 0.62)
              : new Color(1.55, 1.08, 0.62),
            side: DoubleSide,
          }),
        )
        if (interior) {
          interior.position.set(0, roomH / 2 + CURB_HEIGHT, 0)
          group.add(interior)
        }

        // Warm light spilling out onto the pavement.
        cues.push({
          kind: 'shopfront',
          x: faceX,
          y: 1.6,
          z: bzc,
          side: b.side,
          color: new Color(1.0, 0.66, 0.34),
          radius: 4.6,
          intensity: 1.35,
        })
      }
    }

    // Door recess at one end of the bay.
    const doorZ = bz0 + (rand() > 0.5 ? 0.75 : bw - 0.75)
    M.makeScale(0.3, 2.25, 1.0).setPosition(
      glassX + inward * 0.12,
      1.125 + CURB_HEIGHT,
      doorZ,
    )
    batch.dark.add(BOX, M)

    // ---- signage --------------------------------------------------------
    // Each sign has its own canvas, so it cannot be batched. Sixteen extra
    // draw calls is a fine price for sixteen different businesses.
    addSign(group, cues, b, bay, glassTop, neon)

    // ---- awning ---------------------------------------------------------
    if (biz.awning) {
      const [a, c] = biz.awning
      const awn = new Mesh(
        new PlaneGeometry(bw - 0.3, 1.5),
        new MeshStandardMaterial({
          map: awningStripes(a, c),
          side: DoubleSide,
          roughness: 0.85,
          metalness: 0,
          envMapIntensity: 0.5,
        }),
      )
      // Sloped out and down from just under the sign. The underside catches
      // bounce off the pavement and goes a completely different colour from the
      // top, which is free warm/cool contrast at eye level.
      awn.rotation.set(-Math.PI / 2 + 0.55, -b.side * Math.PI * 0.5, 0, 'YXZ')
      awn.position.set(faceX + outward * 0.62, 2.92, (bz0 + bz1) / 2)
      awn.castShadow = true
      group.add(awn)

      // Valance hanging off the front edge.
      const val = new Mesh(
        new PlaneGeometry(bw - 0.3, 0.32),
        (awn.material as MeshStandardMaterial).clone(),
      )
      val.rotation.y = -b.side * Math.PI * 0.5
      val.position.set(faceX + outward * 1.28, 2.52, (bz0 + bz1) / 2)
      group.add(val)

      // The parts that make it an object rather than a shape.
      //
      // The blind critic put it exactly: "a smooth extruded half-cylinder with
      // no fabric fall, no scalloped valance, no support arms, no bracket where
      // it meets the wall". At a 1.68 m eye height you are looking *up* at an
      // awning, so its ends and its ironmongery are the parts actually facing
      // you — and they should be the darkest things in the shot, which is what
      // reads as a canopy standing off a wall rather than a stripe painted on it.
      //
      // All of it goes into batches that already exist, so the whole lot is free
      // in draw calls.
      // The awning plane is a 1.5 m sheet centred 0.62 m out at y 2.92 and
      // tilted 0.55 rad, so it runs from (0.00 out, 3.31) at the wall down to
      // (1.26 out, 2.53) at the front edge, where the valance hangs to 2.36.
      // The end panel has to follow exactly that line or it reads as a separate
      // flap; every number below is derived from those two, not guessed.
      const wallY = 2.92 + 0.75 * Math.sin(0.55)
      const frontOut = 0.62 + 0.75 * Math.cos(0.55)
      const frontY = 2.92 - 0.75 * Math.sin(0.55)
      const drop = 0.34                       // the valance depth
      for (const sz of [-1, 1]) {
        const ez = (bz0 + bz1) / 2 + sz * ((bw - 0.3) / 2)
        // The closed end, as a wedge: down the wall, out along the slope,
        // down behind the valance, back to the wall.
        const gus = new Shape()
        gus.moveTo(0, wallY)
        gus.lineTo(frontOut, frontY)
        gus.lineTo(frontOut, frontY - drop)
        gus.lineTo(0, frontY - drop)
        gus.closePath()
        // Extruded, not a flat ShapeGeometry.
        //
        // `trim` renders front faces only. A flat quad has one normal, so the
        // end that happens to face away is culled and you see straight through
        // the awning — and which end that is flips with the side of the street,
        // so half of them would be missing. A closed prism is correctly wound
        // from every direction, and 5 cm of thickness is what the end of a real
        // awning has anyway, with a rod in it.
        const gusGeo = new ExtrudeGeometry(gus, { depth: 0.05, bevelEnabled: false })
        // Authored in XY with +X away from the wall, which is already outward on
        // the -X side of the street; the other side is the same panel turned round.
        M.makeRotationY(outward > 0 ? 0 : Math.PI)
        M.setPosition(faceX, 0, ez + sz * 0.025)
        batch.trim.add(gusGeo, M, new Color(0.2, 0.18, 0.16))
        gusGeo.dispose()

        // A tubular arm under the fabric, on the same line as the slope.
        const len = Math.hypot(frontOut, wallY - frontY)
        M.makeRotationY(outward > 0 ? 0 : Math.PI)
        M2.makeRotationZ(-Math.PI / 2 - Math.atan2(wallY - frontY, frontOut))
        M.multiply(M2)
        M2.makeScale(0.05, len, 0.05)
        M.multiply(M2)
        M.setPosition(faceX + outward * (frontOut / 2), (wallY + frontY) / 2 - 0.06, ez)
        batch.metal.add(TANK, M, new Color(0.3, 0.29, 0.27))
      }
      // The roller box the fabric winds into, bolted to the wall.
      M.makeScale(0.17, 0.22, bw - 0.2).setPosition(
        faceX + outward * 0.085, wallY + 0.03, (bz0 + bz1) / 2)
      batch.metal.add(BOX, M, new Color(0.26, 0.25, 0.23))
    }
  }
}

/**
 * A unit nobody is renting.
 *
 * Shutter down, and then the thing that actually matters: the flyposting. An
 * empty shopfront is the busiest surface on a real street, because the moment it
 * goes dark it becomes a noticeboard. Leaving it as clean shutter is what made
 * two thirds of this block read as blank wall.
 */
function deadUnit(
  batch: Batches,
  group: Group,
  b: BuildingSpec,
  glassX: number,
  z0: number,
  z1: number,
  rand: () => number,
): void {
  const top = 3.05
  addShutter(batch, glassX, b, z0, z1, top)

  const w = z1 - z0
  const posters = new Mesh(
    new PlaneGeometry(w - 0.35, top - CURB_HEIGHT - 0.5),
    new MeshStandardMaterial({
      map: posterWall(Math.floor(rand() * 9999)),
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.4,
      side: DoubleSide,
    }),
  )
  posters.rotation.y = -b.side * Math.PI * 0.5
  posters.position.set(
    glassX - b.side * 0.035,
    CURB_HEIGHT + (top - CURB_HEIGHT) / 2 - 0.1,
    (z0 + z1) / 2,
  )
  posters.receiveShadow = true
  group.add(posters)
}

/**
 * The front door to the flats above.
 *
 * Every terrace has these between the shops and they are the single most
 * human-scale thing on a facade: a recessed reveal, a door, a buzzer panel, a
 * step worn lighter than the pavement, and a fanlight over the top.
 */
function residentialEntry(
  batch: Batches,
  group: Group,
  b: BuildingSpec,
  glassX: number,
  z0: number,
  z1: number,
  rand: () => number,
): void {
  const outward = -b.side
  const zc = (z0 + z1) / 2
  const w = z1 - z0
  const doorW = Math.min(1.15, w - 0.5)

  // Brick returns either side, so the door sits in a real opening.
  for (const sgn of [-1, 1]) {
    const side = (w - doorW) / 2 - 0.05
    if (side <= 0.05) continue
    M.makeScale(0.34, 3.1, side).setPosition(
      glassX,
      CURB_HEIGHT + 1.55,
      zc + sgn * (doorW / 2 + side / 2 + 0.05),
    )
    batch.facade.add(BOX, M, new Color(0.62, 0.6, 0.57), [side / 2.2, 3.1 / 2.2])
  }

  // Reveal, then the door face set back inside it.
  M.makeScale(0.42, 2.45, doorW).setPosition(glassX + b.side * 0.18, CURB_HEIGHT + 1.22, zc)
  batch.dark.add(BOX, M)

  const doorTone = new Color().setHSL(0.03 + rand() * 0.55, 0.28 + rand() * 0.3, 0.13 + rand() * 0.1)
  M.makeRotationY(-b.side * Math.PI * 0.5)
  M2.makeScale(doorW - 0.12, 2.12, 1)
  M.multiply(M2).setPosition(glassX + b.side * 0.02, CURB_HEIGHT + 1.06, zc)
  batch.shopGlass[probeIndexFor(b.side, zc)].add(QUAD, M, doorTone)

  // Fanlight over the door — lit, because someone is home.
  M.makeRotationY(-b.side * Math.PI * 0.5)
  M2.makeScale(doorW - 0.2, 0.3, 1)
  M.multiply(M2).setPosition(glassX + b.side * 0.02, CURB_HEIGHT + 2.32, zc)
  batch.litGlass.add(QUAD, M, new Color(1.05, 0.78, 0.46))

  // Buzzer panel and a number plate, at the heights they actually sit at.
  M.makeScale(0.06, 0.26, 0.1).setPosition(glassX + outward * 0.16, CURB_HEIGHT + 1.35, zc + doorW / 2 + 0.12)
  batch.metal.add(BOX, M, new Color(0.55, 0.54, 0.52))
  M.makeScale(0.05, 0.16, 0.13).setPosition(glassX + outward * 0.16, CURB_HEIGHT + 2.62, zc)
  batch.trim.add(BOX, M, new Color(0.9, 0.88, 0.84))

  // Doorstep, and a small canopy over it.
  M.makeScale(0.5, 0.11, doorW + 0.3).setPosition(glassX + outward * 0.24, CURB_HEIGHT + 0.055, zc)
  batch.trim.add(BOX, M, new Color(0.78, 0.76, 0.72))
  M.makeScale(0.62, 0.09, doorW + 0.4).setPosition(glassX + outward * 0.3, CURB_HEIGHT + 2.86, zc)
  batch.trim.add(BOX, M, new Color(0.7, 0.68, 0.65))
  void group
}

/** A garage or service door. Wide, flat, and blessedly cheap. */
function garageDoor(
  batch: Batches,
  b: BuildingSpec,
  glassX: number,
  z0: number,
  z1: number,
): void {
  const w = z1 - z0
  const zc = (z0 + z1) / 2
  const top = 3.35
  M.makeRotationY(-b.side * Math.PI * 0.5)
  M2.makeScale(w - 0.3, top - CURB_HEIGHT, 1)
  M.multiply(M2).setPosition(glassX, CURB_HEIGHT + (top - CURB_HEIGHT) / 2, zc)
  batch.shutter.add(QUAD, M, new Color(0.52, 0.5, 0.47), [(w - 0.3) / 3.8, 1])

  // Frame, and the lintel above.
  for (const sgn of [-1, 1]) {
    M.makeScale(0.2, top - CURB_HEIGHT, 0.14).setPosition(
      glassX, CURB_HEIGHT + (top - CURB_HEIGHT) / 2, zc + sgn * (w / 2 - 0.1),
    )
    batch.metal.add(BOX, M, new Color(0.36, 0.35, 0.33))
  }
  M.makeScale(0.26, 0.2, w).setPosition(glassX, top + 0.1, zc)
  batch.trim.add(BOX, M, new Color(0.72, 0.7, 0.66))
}

function addShutter(
  batch: Batches,
  glassX: number,
  b: BuildingSpec,
  z0: number,
  z1: number,
  top: number,
): void {
  const w = z1 - z0
  M.makeRotationY(-b.side * Math.PI * 0.5)
  M2.makeScale(w - 0.1, top - 0.12 - CURB_HEIGHT, 1)
  M.multiply(M2).setPosition(
    glassX,
    CURB_HEIGHT + (top - CURB_HEIGHT) / 2,
    (z0 + z1) / 2,
  )
  // 42 flutes per sheet at ~0.09 m each is 3.8 m of shutter per tile.
  batch.shutter.add(QUAD, M, new Color(0.85, 0.8, 0.72), [w / 3.8, 1])
  // Housing box at the head, where the shutter rolls up into.
  M.makeScale(0.34, 0.3, w).setPosition(glassX, top + 0.1, (z0 + z1) / 2)
  batch.metal.add(BOX, M, new Color(0.5, 0.48, 0.45))
}

/**
 * A shop sign, and the neon glow that goes with it.
 *
 * Neon is three layers: the emissive board, an additive halo card in front of
 * it, and a light cue so the tube throws colour onto the brick around it. Only
 * the first of those is the sign; the other two are why it looks like it is
 * actually emitting.
 */
function addSign(
  group: Group,
  cues: LightCue[],
  b: BuildingSpec,
  bay: Bay,
  glassTop: number,
  neon: NeonSign[],
): void {
  const { z0, z1 } = bay
  const biz = bay.business
  // Only shop bays reach here; the caller routes every other frontage away.
  if (!biz) return
  const faceX = b.side * WALK_HALF
  const outward = -b.side
  const bw = z1 - z0
  const w = Math.min(bw - 0.5, 3.0)
  const h = w * 0.42
  const y = glassTop + 0.42 + h / 2
  // Which trade made this sign. Neon is already flagged on the business; the
  // rest are drawn from the id so a block gets painted boards, plastic
  // lightboxes, cut vinyl and old enamel side by side instead of one house
  // style in twenty-eight colours.
  const h32 = hashId(biz.id)
  const style = signStyleOf(biz)

  // Mounting depth follows the trade rather than a hash, because it physically
  // does: a painted board is screwed to the wall, a lightbox is a tray with a
  // transformer in it, and vinyl has no depth at all because it is stuck to the
  // glass. This comment already claimed as much while the code used id.length.
  const depth =
    style === 'lightbox' ? 0.16 : style === 'vinyl' ? 0.02 : style === 'enamel' ? 0.05 : 0.08
  // How far off the wall the board is mounted, as opposed to how thick it is.
  //
  // These used to be the same number, which put a vinyl sign 2 cm off the brick
  // — behind the shopfront's wall wash, which stands 22 cm out to clear the
  // facade's own relief. The wash is additive and draws after the opaque pass,
  // so it went straight over the sign and the lettering came out veiled behind
  // a warm band. That is the "some signs are blocked by something" report.
  //
  // Splitting the two lets the tray keep its trade-specific thickness while
  // every board hangs clear of the light in front of the wall. 28 cm is more
  // standoff than a painted board really has, but nothing in frame measures it,
  // and being behind the wash is a thing you can see.
  const standoff = 0.28 + depth

  const tex: Texture = signTexture(
    { lines: biz.lines, ink: biz.ink, plate: biz.plate, neon: biz.neon, style },
    h32,
  )

  const board = new Mesh(
    // A box, not a plane.
    //
    // The critic's ninth finding: "a signboard with a bright face and no visible
    // edge reads as a texture on the wall rather than an object on it". It is
    // the same point as the awning — at eye level you are looking up at these,
    // so the underside of the tray is facing you and a plane has none.
    //
    // BoxGeometry puts the full map on every face, so the sides get a stretched
    // slice of the sign. At the depth these stand off the wall that is a
    // centimetre or two of edge and reads as the tray's return; anything more
    // careful would need its own UVs and its own draw call.
    new BoxGeometry(w, h, Math.max(0.04, depth * 0.55)),
    biz.neon
      ? // Unlit and above 1.0 so the bloom pass has something to catch. A neon
        // tube photographs as a blown-out core, never as a mid-grey.
        new MeshBasicMaterial({ map: tex, color: new Color(2.4, 2.4, 2.4), side: DoubleSide })
      : new MeshStandardMaterial({
          map: tex,
          side: DoubleSide,
          roughness: 0.7,
          metalness: 0,
          envMapIntensity: 0.6,
        }),
  )
  board.rotation.y = -b.side * Math.PI * 0.5
  board.position.set(faceX + outward * standoff, y, (z0 + z1) / 2)
  group.add(board)

  // The shadow the board throws onto the wall behind it — by day only.
  //
  // The blind critic's fifth finding: signs with "no depth, no frame shadow"
  // read as decals printed on the brick rather than as objects bolted to it. A
  // board 6-14 cm off the wall under a low sun throws a hard offset shadow, and
  // that offset is the entire cue for standoff. It is one extra quad.
  //
  // But the offset is along `SUN_DIR`, and this scene's sun is eight degrees
  // *below* the horizon. There is no sun to cast it. What the quad actually did
  // after dark was sit a hair off the wall, overlapping the board it belonged
  // to, and wash a translucent rectangle across every sign on the street — which
  // is how it was reported: "most of the shop signs have an overlap".
  //
  // The same shape of mistake as `FILL_LEVEL` and the cloud `lit` term: a term
  // derived under one set of conditions, left in place after the thing it was
  // derived for changed. The board is a box now, so it has its own edge to read
  // standoff from, and after dark it is lit by the lamp below it rather than by
  // anything overhead.
  if (SUN_UP) {
  const shadow = new Mesh(
    new PlaneGeometry(w * 1.02, h * 1.04),
    new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: DoubleSide,
    }),
  )
  shadow.rotation.y = -b.side * Math.PI * 0.5
  // Offset along the sun's horizontal travel, scaled by how far off the wall the
  // board sits — so a deep-mounted sign throws a longer shadow than a flush one.
  shadow.position.set(
    // 1.2 cm, then 3.5 cm, both still broke into blocky z-fighting where the
    // wall is seen almost edge-on. A sign board stands 6-15 cm off a wall, so
    // there is no reason for its shadow to hug the brick that closely.
    faceX + outward * 0.1,
    y - standoff * 0.55,
    (z0 + z1) / 2 - SUN_DIR.z * standoff * 2.6,
  )
  shadow.renderOrder = 1
  group.add(shadow)
  }

  if (biz.neon) {
    const glow = new Mesh(
      new PlaneGeometry(w * 1.9, h * 2.4),
      new MeshBasicMaterial({
        map: radialAlpha(2.2, 1),
        color: new Color(biz.ink),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    )
    glow.rotation.y = -b.side * Math.PI * 0.5
    glow.position.set(faceX + outward * 0.3, y, (z0 + z1) / 2)
    glow.renderOrder = 3
    group.add(glow)
    neon.push({ board, glow, seed: h32 })

    cues.push({
      kind: 'neon',
      x: faceX,
      y,
      z: (z0 + z1) / 2,
      side: b.side,
      color: new Color(biz.ink),
      radius: 3.2,
      intensity: 1.1,
    })
  }
}
