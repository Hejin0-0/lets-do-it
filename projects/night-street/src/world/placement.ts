/**
 * The street layout table.
 *
 * This module imports nothing. That is deliberate: it is pure arithmetic, so
 * `tools/placement.test.mjs` and `tools/signcount.mjs` can import it under bare
 * node and assert against exactly the numbers the renderer will use. A layout
 * invariant that is only checked inside the render loop is not checked.
 *
 * It has two consumers — the scene builders, which turn slots into meshes, and
 * the player controller, which turns the same slots into colliders. One table,
 * so a prop cannot be visible and non-solid, or solid and invisible.
 *
 * ---------------------------------------------------------------------------
 * Why the corridor is booked first
 *
 * Prompt 3 asked for the street to "feel lived-in, not abandoned", and the
 * first attempt at that put down 175 individually plausible props and sealed
 * the near footway completely. Every one of them was in a reasonable place. The
 * street was also impassable.
 *
 * So the walkable corridor is reserved as forbidden geometry *before* anything
 * is placed, and every candidate is tested against it. Density is then free to
 * be as aggressive as it likes, because the thing it could break is already
 * protected. This is the difference between "place props, then check you can
 * walk" and "reserve the walk, then place props" — the second one cannot fail.
 */

// ---------------------------------------------------------------------------
// street geometry — the single source of layout truth
// ---------------------------------------------------------------------------

/** Player spawns here and walks toward -Z. */
export const START_Z = 8

/**
 * How far the terraces carry on *behind* the player's start.
 *
 * The far end of the street had this all along — the buildings run 8 m past the
 * end of the walk and the closing terrace stands 20 m beyond that, so turning to
 * look down the street shows a canyon that closes. The near end never got the
 * same treatment: the rows began exactly at `START_Z`, the player can back up to
 * `START_Z + 1.5`, and turning round put them one and a half metres past the
 * last building looking at thirteen metres of nothing with a lit slab floating
 * behind it.
 *
 * Ten metres is what makes the two ends match: the player stands inside the
 * canyon rather than at its lip, and the gap to the closing terrace reads as the
 * cross street it is meant to be.
 */
export const NEAR_BLOCK = 10
/** Geometry continues past the walkable end so the street has a horizon. */
export const END_Z = -168
/**
 * Where the walk stops.
 *
 * This was -118, and it was an invisible wall in the middle of a finished
 * street. The layout builds props out to z = -176, lamps to -164, parked cars
 * to -152 and buildings to -181 — so **58 metres of lit, furnished, occupied
 * block sat behind a boundary the player could feel and not see**. Reported from
 * play as walking into nothing: "I haven't reached anything and I can't go
 * forward."
 *
 * It now stops where the street furniture does. Everything below is placed
 * relative to END_Z, so the last lamp lands at -164 and the last props at -176;
 * -160 puts the boundary inside the lit, furnished part with a lamp still ahead
 * of you and the closing terrace visible 26 m further on. The block is 168 m
 * rather than 126, using content that was already built and unreachable.
 *
 * `tools/placement.test.mjs` asserts that the lamps outrun this line, so moving
 * it past the furniture fails the build rather than shipping a dark end.
 */
export const WALK_END_Z = -160

/** Road surface spans |x| <= ROAD_HALF. */
export const ROAD_HALF = 5.4
export const CURB_HEIGHT = 0.14
/** Facade line. Sidewalk is ROAD_HALF..WALK_HALF, i.e. 4.2 m deep. */
export const WALK_HALF = 9.6

/** Furniture zone against the kerb: lamps, hydrants, meters, dumpsters. */
export const CURB_ZONE: [number, number] = [ROAD_HALF, 6.5]
/** Clear through-zone. Nothing solid may enter this. */
export const CORRIDOR: [number, number] = [6.5, 8.7]
/** Frontage zone against the shop windows: boards, crates, bikes, planters. */
export const FRONTAGE_ZONE: [number, number] = [8.7, WALK_HALF]

/** Parked cars sit in the kerbside parking lane. */
export const PARK_X = 3.95

export type Side = -1 | 1
/** The sun is at +X, so the -X side of the street is the lit side. */
export const SUN_SIDE: Side = -1

// ---------------------------------------------------------------------------
// businesses
// ---------------------------------------------------------------------------

export interface Business {
  /** Stable id. Must be unique across the street — see tools/signcount.mjs. */
  id: string
  lines: string[]
  /** Neon tube signs get the glow treatment; painted boards do not. */
  neon: boolean
  ink: string
  plate: string
  /** Warm interior light spills onto the pavement from an open business. */
  open: boolean
  awning?: [string, string]
  /** Closed businesses pull the roller shutter down. */
  shutter: boolean
}

/**
 * Prompt 4 point 3: "the BAR COLD BEER neon sign appears multiple times down
 * the street. keep it on one building only." The first build reused one
 * shopfront prefab, which is exactly the sort of thing that is invisible while
 * you are building it and impossible to unsee in a screenshot.
 *
 * The fix is structural rather than careful: businesses are drawn from this
 * pool without replacement, so a repeat is not something to be vigilant about.
 * `tools/signcount.mjs` fails the build if one ever appears anyway.
 */
export const BUSINESSES: Business[] = [
  { id: 'bar', lines: ['BAR', 'COLD BEER'], neon: true, ink: '#ff4d2a', plate: '#120a08', open: true, shutter: false },
  { id: 'pharmacy', lines: ['PHARMACY'], neon: true, ink: '#3ef07a', plate: '#08120c', open: true, shutter: false },
  { id: 'laundry', lines: ['WASH', '& DRY'], neon: true, ink: '#48b6ff', plate: '#070f16', open: true, shutter: false },
  { id: 'deli', lines: ['DELI'], neon: false, ink: '#f0e2c0', plate: '#1d3a2c', open: true, awning: ['#2f5f43', '#d9cba8'], shutter: false },
  { id: 'liquor', lines: ['LIQUOR'], neon: true, ink: '#ffb03a', plate: '#161006', open: false, shutter: true },
  { id: 'tattoo', lines: ['TATTOO'], neon: true, ink: '#ff2f6e', plate: '#14060c', open: false, shutter: true },
  { id: 'market', lines: ['24H', 'MARKET'], neon: false, ink: '#f3ead6', plate: '#7a2420', open: true, awning: ['#8c2b24', '#e0d3b4'], shutter: false },
  { id: 'barber', lines: ['BARBER'], neon: false, ink: '#eae0cc', plate: '#1b2f4a', open: false, awning: ['#26456b', '#ddd2bc'], shutter: true },
  { id: 'pizza', lines: ['PIZZA'], neon: true, ink: '#ff7a2a', plate: '#170c05', open: true, shutter: false },
  { id: 'keys', lines: ['KEY', '& LOCK'], neon: false, ink: '#d8cbb0', plate: '#2a2622', open: false, shutter: true },
  { id: 'nails', lines: ['NAIL SALON'], neon: false, ink: '#f2dce6', plate: '#5d2748', open: false, awning: ['#6d2f54', '#e6d5df'], shutter: true },
  { id: 'noodles', lines: ['NOODLE', 'HOUSE'], neon: true, ink: '#ffd23a', plate: '#151004', open: true, shutter: false },
  { id: 'hardware', lines: ['HARDWARE'], neon: false, ink: '#e4d9c2', plate: '#3a3126', open: false, shutter: true },
  { id: 'records', lines: ['RECORDS'], neon: false, ink: '#e8dcc4', plate: '#243036', open: false, shutter: true },
  { id: 'copyshop', lines: ['COPY', 'PRINT'], neon: false, ink: '#dfe4e8', plate: '#2c3a44', open: false, shutter: true },
  { id: 'florist', lines: ['FLORIST'], neon: false, ink: '#efe6cf', plate: '#3d4a2c', open: false, awning: ['#47552f', '#e2d8bd'], shutter: true },
  { id: 'cafe', lines: ['CAFE'], neon: true, ink: '#ffd9a0', plate: '#170f06', open: true, awning: ['#5a3a22', '#ddc9a8'], shutter: false },
  { id: 'bakery', lines: ['BAKERY'], neon: false, ink: '#f6e9cc', plate: '#6b4a22', open: true, awning: ['#7a5528', '#e8dcc0'], shutter: false },
  { id: 'drycleaner', lines: ['DRY', 'CLEANERS'], neon: false, ink: '#e6ecf0', plate: '#20486a', open: false, shutter: true },
  { id: 'pawn', lines: ['PAWN'], neon: true, ink: '#ffcf3a', plate: '#181206', open: false, shutter: true },
  { id: 'bodega', lines: ['BODEGA'], neon: true, ink: '#4de0c0', plate: '#06140f', open: true, awning: ['#1f5a4a', '#dcd2b8'], shutter: false },
  { id: 'phonerepair', lines: ['PHONE', 'REPAIR'], neon: false, ink: '#dbe6ee', plate: '#2a3138', open: true, shutter: false },
  { id: 'travel', lines: ['TRAVEL'], neon: false, ink: '#eae2cc', plate: '#1d4a52', open: false, shutter: true },
  { id: 'optician', lines: ['OPTICIAN'], neon: false, ink: '#e8eef2', plate: '#33404a', open: false, shutter: true },
  { id: 'butcher', lines: ['BUTCHER'], neon: false, ink: '#f2e2e2', plate: '#5e1f22', open: false, awning: ['#6d2528', '#e6d6d0'], shutter: true },
  { id: 'newsstand', lines: ['NEWS'], neon: false, ink: '#efe8d4', plate: '#3a3a2c', open: true, shutter: false },
  { id: 'kebab', lines: ['KEBAB'], neon: true, ink: '#ff9c2a', plate: '#170d04', open: true, shutter: false },
  { id: 'books', lines: ['BOOKS'], neon: false, ink: '#e4dcc4', plate: '#2e2a3c', open: false, shutter: true },
]

// ---------------------------------------------------------------------------
// rng
// ---------------------------------------------------------------------------

/** Same seed, same street. The tests depend on this. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type PropKind =
  | 'lamp'
  | 'hydrant'
  | 'dumpster'
  | 'trashbags'
  | 'newsbox'
  | 'meter'
  | 'signpost'
  | 'trafficlight'
  | 'bollard'
  | 'planter'
  | 'aframe'
  | 'crates'
  | 'bicycle'
  | 'pallet'
  | 'grate'
  | 'manhole'
  | 'puddle'

export interface Rect {
  x: number
  z: number
  /** Half-extents. Axis-aligned; every prop here is small enough that a
   *  rotated AABB is not worth the arithmetic. */
  hx: number
  hz: number
}

export interface Slot extends Rect {
  kind: PropKind
  side: Side
  rot: number
  seed: number
  /** Whether the player collides with it. Overhead and flat props do not. */
  solid: boolean
}

/**
 * What occupies a stretch of ground floor.
 *
 * The point of this type is that there is no "nothing".
 *
 * Bays used to be created for every building and then *discarded* if the
 * business pool ran dry, leaving bare wall behind. Measured on the contact
 * sheet: 13 of 22 buildings had no shopfront at all and 64% of 351 m of
 * frontage was blank brick — which is what "the assets look crude" actually
 * turned out to mean. Every frame looking across the street was a wall.
 *
 * A real block is not all shops either. It is shops, dead units with the
 * shutter down, front doors to the flats above, and the odd garage. Those are
 * cheap to build and they are what makes the other 64% into somewhere.
 */
export type FrontageKind = 'shop' | 'vacant' | 'residential' | 'garage'

export interface Bay {
  z0: number
  z1: number
  kind: FrontageKind
  /** Only a 'shop' has one. */
  business: Business | null
}

export interface BuildingSpec {
  side: Side
  z0: number
  z1: number
  depth: number
  floors: number
  floorHeight: number
  groundHeight: number
  facade: 'brick' | 'painted-brick' | 'stucco' | 'stone'
  seed: number
  fireEscape: boolean
  cornice: boolean
  parapet: number
  /** Rooftop clutter: water tank, stair head, vents. */
  roofKind: 0 | 1 | 2
  bays: Bay[]
}

export interface CarSlot {
  side: Side
  z: number
  seed: number
  /** Body style index. */
  body: 0 | 1 | 2
  paint: number
  /** The brief asks for one parked car with its lights on. */
  lightsOn: boolean
}

export interface Layout {
  buildings: BuildingSpec[]
  props: Slot[]
  cars: CarSlot[]
  corridors: Rect[]
}

// ---------------------------------------------------------------------------
// footprints
// ---------------------------------------------------------------------------

const FOOTPRINT: Record<PropKind, { hx: number; hz: number; solid: boolean }> = {
  lamp: { hx: 0.14, hz: 0.14, solid: true },
  hydrant: { hx: 0.20, hz: 0.20, solid: true },
  dumpster: { hx: 0.55, hz: 1.05, solid: true },
  trashbags: { hx: 0.42, hz: 0.52, solid: true },
  newsbox: { hx: 0.26, hz: 0.34, solid: true },
  meter: { hx: 0.10, hz: 0.10, solid: true },
  signpost: { hx: 0.08, hz: 0.08, solid: true },
  trafficlight: { hx: 0.16, hz: 0.16, solid: true },
  bollard: { hx: 0.14, hz: 0.14, solid: true },
  planter: { hx: 0.38, hz: 0.38, solid: true },
  aframe: { hx: 0.30, hz: 0.22, solid: true },
  crates: { hx: 0.34, hz: 0.44, solid: true },
  bicycle: { hx: 0.22, hz: 0.80, solid: true },
  // Stacked on edge and leaning on the facade, which is where pallets live and
  // is also the only way a 1.2 m pallet fits a 0.9 m frontage zone.
  pallet: { hx: 0.24, hz: 0.62, solid: true },
  // Flat on the ground. You walk over these.
  grate: { hx: 0.42, hz: 0.42, solid: false },
  manhole: { hx: 0.44, hz: 0.44, solid: false },
  puddle: { hx: 1.30, hz: 1.90, solid: false },
}

/** Props are kept this far apart so nothing interpenetrates visibly. */
const GAP = 0.12

function overlaps(a: Rect, b: Rect, gap = GAP): boolean {
  return (
    Math.abs(a.x - b.x) < a.hx + b.hx + gap &&
    Math.abs(a.z - b.z) < a.hz + b.hz + gap
  )
}

// ---------------------------------------------------------------------------
// the table
// ---------------------------------------------------------------------------

/** Street lamps every this many metres, staggered between the two sides so the
 *  pools overlap along the street rather than opposite each other. */
export const LAMP_SPACING = 16

export function buildLayout(seed = 20260810): Layout {
  const rand = mulberry(seed)

  // 1. Book the corridors. Nothing solid is allowed in here, ever.
  const corridors: Rect[] = ([-1, 1] as Side[]).map((side) => {
    const [inner, outer] = CORRIDOR
    const cx = (side * (inner + outer)) / 2
    return {
      x: cx,
      z: (START_Z + END_Z) / 2,
      hx: (outer - inner) / 2,
      hz: (START_Z - END_Z) / 2,
    }
  })

  // 2. Buildings, and the shopfront bays that props hang off.
  const pool = BUSINESSES.slice()
  // Shuffle, then force the bar to the front so it lands on the near half of
  // the street where it is actually visible. It is the hero sign.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const barAt = pool.findIndex((b) => b.id === 'bar')
  if (barAt > 0) {
    const [bar] = pool.splice(barAt, 1)
    pool.splice(1, 0, bar)
  }

  const buildings: BuildingSpec[] = []
  for (const side of [SUN_SIDE, -SUN_SIDE as Side]) {
    // Offset the two sides so facades never line up across the street — that
    // symmetry is one of the strongest "this is a game level" signals there is.
    let z = START_Z + NEAR_BLOCK + (side === SUN_SIDE ? 0 : -5.5)
    let n = 0
    while (z > END_Z) {
      let width = 11 + rand() * 9
      const z1 = z
      let z0 = z - width

      // Never let a party wall line up with one across the street. A matched
      // pair of facade edges facing each other is one of the strongest "this
      // was assembled from modules" cues there is, and it is free to avoid:
      // widen the building until the edge misses.
      //
      // The margin is 2 m rather than the 1 m the test asserts, because the
      // *next* building's far edge is this one's near edge minus the party gap,
      // and that inherited edge has to clear the threshold too.
      for (let guard = 0; guard < 8; guard++) {
        const clash = buildings.some(
          (b) => b.side !== side && (Math.abs(b.z1 - z0) < 2 || Math.abs(b.z0 - z0) < 2),
        )
        if (!clash) break
        width += 1.4
        z0 = z - width
      }
      const floors = 3 + Math.floor(rand() * 3)
      const floorHeight = 3.0 + rand() * 0.5
      const groundHeight = 3.9 + rand() * 0.6

      // Ground floor splits into 1-2 retail bays. Businesses come out of the
      // pool without replacement, so they run out; past that point the ground
      // floor is a blank shuttered frontage, which is what a real block does
      // once you are past the corner.
      const bayCount = width > 15 ? 2 : 1
      const bays: Bay[] = []
      for (let b = 0; b < bayCount; b++) {
        const bw = width / bayCount
        // Kind decided after both sides exist, so shops can be spread evenly.
        bays.push({ z0: z0 + b * bw + 0.5, z1: z0 + (b + 1) * bw - 0.5, kind: 'vacant', business: null })
      }

      buildings.push({
        side,
        z0,
        z1,
        depth: 12 + rand() * 8,
        floors,
        floorHeight,
        groundHeight,
        facade: (['brick', 'painted-brick', 'stucco', 'stone', 'brick'] as const)[
          Math.floor(rand() * 5)
        ],
        seed: Math.floor(rand() * 100000),
        fireEscape: rand() > 0.42,
        cornice: rand() > 0.3,
        parapet: 0.35 + rand() * 0.7,
        roofKind: Math.floor(rand() * 3) as 0 | 1 | 2,
        bays,
      })
      z = z0 - (0.15 + rand() * 0.35)
      n++
      if (n > 40) break
    }
  }

  // 2b. Hand the businesses out.
  //
  // This used to happen inside the building loop, taking from the pool as bays
  // were created. Because the loop builds one whole side and then the other, the
  // pool ran dry partway down the second side — so every neon sign on the street
  // ended up on the sun side and the far kerb was nothing but roller shutters.
  // It passed the no-duplicates test and still looked wrong, which is prompt 3's
  // "the right side of the street feels empty" arriving by a different route.
  //
  // Assigning afterwards, alternating sides and working outward from the player's
  // start, puts the interesting frontages where they can be seen and spreads them
  // across both kerbs.
  {
    const bySide = ([SUN_SIDE, -SUN_SIDE as Side] as Side[]).map((side) =>
      buildings
        .filter((b) => b.side === side)
        .flatMap((b) => b.bays)
        .sort((a, b) => b.z1 - a.z1),
    )
    let i = 0
    for (let n = 0; n < Math.max(...bySide.map((r) => r.length)); n++) {
      for (const row of bySide) {
        const bay = row[n]
        if (!bay) continue
        if (i < pool.length) {
          bay.kind = 'shop'
          bay.business = pool[i++]
        } else {
          // Out of businesses. The unit is still a unit: mostly dead shopfront,
          // sometimes the door to the flats above, occasionally a garage. Never
          // deleted, which is what used to leave bare wall.
          const r = rand()
          bay.kind = r < 0.45 ? 'vacant' : r < 0.85 ? 'residential' : 'garage'
        }
      }
    }
  }

  // 3. Props. Corridors are already in `blockers`, so a candidate that would
  //    seal the footway simply fails to place.
  const props: Slot[] = []
  const blockers: Rect[] = corridors.slice()

  const push = (kind: PropKind, side: Side, x: number, z: number, rot: number): boolean => {
    const fp = FOOTPRINT[kind]
    const cand: Rect = { x: side * x, z, hx: fp.hx, hz: fp.hz }
    // Flat decals do not fight for space; they are allowed under everything.
    if (fp.solid) {
      for (const b of blockers) if (overlaps(cand, b)) return false
    }
    props.push({ ...cand, kind, side, rot, seed: Math.floor(rand() * 1e6), solid: fp.solid })
    if (fp.solid) blockers.push(cand)
    return true
  }

  /**
   * Place a prop across a zone, where `t` in [0,1] picks a position *for the
   * prop's footprint*, not for its centre.
   *
   * The distinction is the whole reason this helper exists. Interpolating the
   * centre across the zone lets a 0.84 m-wide bag of rubbish sit 0.13 m into
   * the carriageway at t=0, which is what the placement test caught: the prop
   * was in its zone and its geometry was not. Insetting by the half-extent
   * first makes that unrepresentable, and it fixes it for every kerb prop at
   * once rather than for the one the test happened to name.
   */
  const tryPlace = (
    kind: PropKind,
    side: Side,
    zone: [number, number],
    t: number,
    z: number,
    rot = 0,
  ): boolean => {
    const fp = FOOTPRINT[kind]
    const lo = zone[0] + fp.hx
    const hi = zone[1] - fp.hx
    // A prop as wide as its zone has exactly one legal position rather than none.
    const x = hi <= lo ? (zone[0] + zone[1]) / 2 : lo + (hi - lo) * t
    return push(kind, side, x, z, rot)
  }

  /** Road-surface decals have no zone and never collide. */
  const tryPlaceOnRoad = (kind: PropKind, side: Side, x: number, z: number): boolean => {
    if (FOOTPRINT[kind].solid) throw new Error(`${kind} is solid; place it in a zone`)
    return push(kind, side, x, z, 0)
  }

  // 3a. Lamps first — they set the rhythm of the street and everything else
  //     has to work around them, not the other way round.
  for (const side of [SUN_SIDE, -SUN_SIDE as Side]) {
    const phase = side === SUN_SIDE ? 0 : LAMP_SPACING / 2
    // One spacing past END_Z, for two reasons. The sides are staggered by half
    // a span, so stopping exactly at END_Z leaves one of them eight metres
    // shorter than the other — and that side ran out before the end of the
    // walk. The buildings also carry on to -181, so without this the last
    // stretch of visible street was unlit for no reason anyone standing in it
    // could see.
    // Starting `NEAR_BLOCK` further back adds two lamps per side over the
    // stretch behind the player without moving any of the existing ones: the
    // step is unchanged, so every lamp that was at some z is still at that z.
    for (
      let z = START_Z - 4 - phase + Math.ceil(NEAR_BLOCK / LAMP_SPACING) * LAMP_SPACING;
      z > END_Z - LAMP_SPACING;
      z -= LAMP_SPACING
    ) {
      tryPlace('lamp', side, CURB_ZONE, 0.3, z)
    }
  }

  // 3b. Traffic lights at the two crossings, and street signage with them.
  for (const side of [SUN_SIDE, -SUN_SIDE as Side]) {
    for (const z of [START_Z - 1.5, -74.5]) {
      tryPlace('trafficlight', side, CURB_ZONE, 0.4, z)
      tryPlace('signpost', side, CURB_ZONE, 0.25, z - 2.4)
    }
  }

  // 3c. Kerb-zone furniture, evenly seeded down the whole street. Prompt 3
  //     called out that "the right side of the street feels empty after the
  //     first building" — so this runs both sides at the same density and the
  //     far half at the same density as the near half.
  const kerbKinds: PropKind[] = ['hydrant', 'newsbox', 'meter', 'bollard', 'trashbags']
  for (const side of [SUN_SIDE, -SUN_SIDE as Side]) {
    for (let z = START_Z - 3; z > END_Z + 4; z -= 2.6 + rand() * 2.2) {
      if (rand() > 0.62) continue
      const kind = kerbKinds[Math.floor(rand() * kerbKinds.length)]
      tryPlace(kind, side, CURB_ZONE, 0.2 + rand() * 0.7, z + (rand() - 0.5) * 1.2)
    }
  }

  // 3d. One dumpster per side per stretch, with bags piled against it.
  for (const side of [SUN_SIDE, -SUN_SIDE as Side]) {
    for (const z of [-19 - rand() * 4, -63 - rand() * 5, -101 - rand() * 5]) {
      if (tryPlace('dumpster', side, CURB_ZONE, 0.5, z)) {
        tryPlace('trashbags', side, CURB_ZONE, 0.5, z + 1.7)
        if (rand() > 0.4) tryPlace('trashbags', side, FRONTAGE_ZONE, 0.5, z + 0.4)
        if (rand() > 0.5) tryPlace('pallet', side, FRONTAGE_ZONE, 0.9, z - 1.9)
      }
    }
  }

  // 3e. Frontage-zone clutter, keyed to the shopfront bays so it reads as
  //     belonging to a business rather than scattered at random.
  const frontKinds: PropKind[] = ['aframe', 'crates', 'bicycle', 'planter', 'trashbags']
  for (const b of buildings) {
    for (const bay of b.bays) {
      const zc = (bay.z0 + bay.z1) / 2
      // Clutter follows occupancy: an open shop puts things out on the pavement,
      // a dead unit collects them, a garage keeps its apron clear.
      const count =
        bay.kind === 'garage'
          ? 0
          : bay.kind === 'shop'
            ? bay.business?.open
              ? 2
              : 1
            : bay.kind === 'vacant'
              ? 1
              : 1
      for (let i = 0; i < count; i++) {
        const kind = frontKinds[Math.floor(rand() * frontKinds.length)]
        tryPlace(
          kind,
          b.side,
          FRONTAGE_ZONE,
          0.2 + rand() * 0.75,
          zc + (rand() - 0.5) * (bay.z1 - bay.z0) * 0.8,
          rand() * Math.PI * 2,
        )
      }
    }
    // Kept for buildings too narrow to have carried a bay at all.
    if (b.bays.length === 0 && rand() > 0.35) {
      tryPlace(
        frontKinds[Math.floor(rand() * frontKinds.length)],
        b.side,
        FRONTAGE_ZONE,
        0.5,
        (b.z0 + b.z1) / 2,
        rand() * Math.PI * 2,
      )
    }
  }

  // 3f. Road decals. Non-solid, so they never fight the corridor.
  for (let z = START_Z - 6; z > END_Z + 6; z -= 11 + rand() * 9) {
    tryPlaceOnRoad('manhole', 1, 1.4 + rand() * 2.2, z)
  }
  for (let z = START_Z - 10; z > END_Z + 6; z -= 17 + rand() * 12) {
    tryPlaceOnRoad('grate', rand() > 0.5 ? 1 : -1, ROAD_HALF - 0.55, z)
  }
  // Damp patches near the kerb, where water actually collects.
  for (let z = START_Z - 8; z > END_Z + 8; z -= 13 + rand() * 14) {
    tryPlaceOnRoad('puddle', rand() > 0.5 ? 1 : -1, ROAD_HALF - 1.4, z)
  }

  // 4. Parked cars along both kerbs, with gaps and one with its lights on.
  const cars: CarSlot[] = []
  const carRects: Rect[] = []
  for (const side of [SUN_SIDE, -SUN_SIDE as Side]) {
    let z = START_Z - 6 - rand() * 5
    while (z > END_Z + 8) {
      // Leave the crossings clear.
      const nearCrossing = Math.abs(z - (START_Z - 1.5)) < 7 || Math.abs(z + 74.5) < 7
      if (!nearCrossing && rand() > 0.30) {
        const cand: Rect = { x: side * PARK_X, z, hx: 0.94, hz: 2.28 }
        if (!carRects.some((r) => overlaps(cand, r, 0.9))) {
          cars.push({
            side,
            z,
            seed: Math.floor(rand() * 1e6),
            body: Math.floor(rand() * 3) as 0 | 1 | 2,
            paint: Math.floor(rand() * 7),
            lightsOn: false,
          })
          carRects.push(cand)
        }
      }
      z -= 5.6 + rand() * 4.5
    }
  }
  // The brief asks for "car tail lights and headlights from a parked car with
  // lights on". Exactly one, and one that is near enough to read.
  const candidate = cars.find((c) => c.z < START_Z - 12 && c.z > -46)
  if (candidate) candidate.lightsOn = true

  return { buildings, props, cars, corridors }
}

// ---------------------------------------------------------------------------
// queries used by both consumers
// ---------------------------------------------------------------------------

/** Solid props, as colliders for the player controller. */
export function collidersOf(layout: Layout): Rect[] {
  const out: Rect[] = layout.props
    .filter((p) => p.solid)
    .map((p) => ({ x: p.x, z: p.z, hx: p.hx, hz: p.hz }))
  for (const c of layout.cars) {
    out.push({ x: c.side * PARK_X, z: c.z, hx: 0.94, hz: 2.28 })
  }
  return out
}

/** Every business actually placed on the street, in placement order. */
/**
 * How the sign was made.
 *
 * This lives with the business rather than with the renderer because it is a
 * fact about the shop, not about how it is drawn — and because putting it here
 * makes it testable: `world/placement.ts` imports nothing, so a node test can
 * assert that a block actually gets all five trades. Everything per-business
 * used to be seeded off `id.length`, which a dozen of them share, so the
 * variation existed in the code and not in the output.
 */
export type SignStyle = 'neon' | 'painted' | 'lightbox' | 'vinyl' | 'enamel'

/** Stable hash of a business id. Also seeds the room behind its window. */
export function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

const UNLIT_STYLES = ['painted', 'lightbox', 'vinyl', 'enamel'] as const

/** Neon is flagged on the business; the rest of the block is drawn from the id. */
export function signStyleOf(biz: Business): SignStyle {
  return biz.neon ? 'neon' : UNLIT_STYLES[hashId(biz.id) % UNLIT_STYLES.length]
}

export function placedBusinesses(layout: Layout): Business[] {
  return layout.buildings.flatMap((b) =>
    b.bays.flatMap((y) => (y.business ? [y.business] : [])),
  )
}

/**
 * How much of the street's ground floor is occupied by *something*.
 *
 * The number this exists to keep honest is the one the contact sheet exposed:
 * blank frontage was 64%. See tools/placement.test.mjs.
 */
export function frontageCoverage(layout: Layout): {
  total: number
  occupied: number
  shops: number
  byKind: Record<FrontageKind, number>
} {
  let total = 0
  let occupied = 0
  let shops = 0
  const byKind: Record<FrontageKind, number> = {
    shop: 0,
    vacant: 0,
    residential: 0,
    garage: 0,
  }
  for (const b of layout.buildings) {
    total += Math.abs(b.z1 - b.z0)
    for (const y of b.bays) {
      const w = y.z1 - y.z0
      occupied += w
      byKind[y.kind] += w
      if (y.kind === 'shop') shops += w
    }
  }
  return { total, occupied, shops, byKind }
}
