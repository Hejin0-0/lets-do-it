import assert from 'node:assert/strict'
import {
  LAMP_SPACING,
  buildLayout,
  collidersOf,
  frontageCoverage,
  CORRIDOR,
  CURB_ZONE,
  END_Z,
  FRONTAGE_ZONE,
  PARK_X,
  ROAD_HALF,
  START_Z,
  WALK_END_Z,
  WALK_HALF,
} from '../src/world/placement.ts'

/**
 * The street layout has one invariant that matters: you can walk down it.
 *
 * The first "lived-in" pass put 175 plausible props on the pavement and sealed
 * the near footway. Nothing was individually wrong, which is exactly why it
 * needed a test rather than more care. This file is that test.
 */

const PLAYER_RADIUS = 0.32
let checks = 0
const ok = (label, fn) => {
  fn()
  checks++
  console.log(`  ok  ${label}`)
}

const layout = buildLayout()
const solid = layout.props.filter((p) => p.solid)
const colliders = collidersOf(layout)

console.log(
  `layout: ${layout.buildings.length} buildings, ${layout.props.length} props ` +
    `(${solid.length} solid), ${layout.cars.length} cars`,
)

// ---------------------------------------------------------------------------

ok('the walkable corridor is clear end to end on both sides', () => {
  const corridorCentre = (CORRIDOR[0] + CORRIDOR[1]) / 2
  for (const side of [-1, 1]) {
    for (let z = START_Z; z >= WALK_END_Z; z -= 0.25) {
      const px = side * corridorCentre
      for (const c of colliders) {
        const dx = Math.abs(px - c.x) - c.hx
        const dz = Math.abs(z - c.z) - c.hz
        // Distance from the player disc to the collider box.
        const d = Math.hypot(Math.max(dx, 0), Math.max(dz, 0))
        const inside = dx < 0 && dz < 0
        assert.ok(
          !inside && d >= PLAYER_RADIUS,
          `blocked at side ${side}, z=${z.toFixed(2)} by a collider at ` +
            `(${c.x.toFixed(2)}, ${c.z.toFixed(2)})`,
        )
      }
    }
  }
})

ok('no two solid props interpenetrate', () => {
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i]
      const b = solid[j]
      const hit =
        Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz
      assert.ok(
        !hit,
        `${a.kind} at (${a.x.toFixed(2)}, ${a.z.toFixed(2)}) overlaps ` +
          `${b.kind} at (${b.x.toFixed(2)}, ${b.z.toFixed(2)})`,
      )
    }
  }
})

ok('every pavement prop stays between the kerb and the facade', () => {
  for (const p of solid) {
    const inner = Math.abs(p.x) - p.hx
    const outer = Math.abs(p.x) + p.hx
    assert.ok(
      inner >= CURB_ZONE[0] - 1e-6,
      `${p.kind} at x=${p.x.toFixed(2)} hangs into the road`,
    )
    assert.ok(
      outer <= WALK_HALF + 1e-6,
      `${p.kind} at x=${p.x.toFixed(2)} is inside the building`,
    )
  }
})

ok('solid props only occupy the kerb and frontage zones', () => {
  for (const p of solid) {
    const inner = Math.abs(p.x) - p.hx
    const outer = Math.abs(p.x) + p.hx
    const inKerb = outer <= CURB_ZONE[1] + 1e-6
    const inFrontage = inner >= FRONTAGE_ZONE[0] - 1e-6
    assert.ok(
      inKerb || inFrontage,
      `${p.kind} at x=${p.x.toFixed(2)} straddles the through-zone`,
    )
  }
})

ok('parked cars sit in the road and do not overlap', () => {
  for (const c of layout.cars) {
    assert.ok(Math.abs(c.side * PARK_X) + 0.94 <= ROAD_HALF + 1e-6, 'car on the pavement')
  }
  for (let i = 0; i < layout.cars.length; i++) {
    for (let j = i + 1; j < layout.cars.length; j++) {
      const a = layout.cars[i]
      const b = layout.cars[j]
      if (a.side !== b.side) continue
      assert.ok(
        Math.abs(a.z - b.z) >= 4.56,
        `cars at z=${a.z.toFixed(2)} and z=${b.z.toFixed(2)} interpenetrate`,
      )
    }
  }
})

ok('exactly one parked car has its lights on', () => {
  const lit = layout.cars.filter((c) => c.lightsOn)
  assert.equal(lit.length, 1, `expected 1 lit car, got ${lit.length}`)
})

ok('street lamps run the whole street on both sides', () => {
  for (const side of [-1, 1]) {
    const zs = layout.props
      .filter((p) => p.kind === 'lamp' && p.side === side)
      .map((p) => p.z)
      .sort((a, b) => b - a)
    assert.ok(zs.length >= 6, `only ${zs.length} lamps on side ${side}`)
    // The two sides are staggered by half a span on purpose, so the far side's
    // first lamp legitimately sits one gap further down.
    assert.ok(
      zs[0] > START_Z - LAMP_SPACING,
      `side ${side} starts unlit: first lamp at z=${zs[0].toFixed(1)}`,
    )
    assert.ok(
      zs[zs.length - 1] < WALK_END_Z,
      `side ${side} runs out of lamps before the end of the walk`,
    )
    // Prompt 4: "the light pools should overlap slightly so the street feels
    // lit, not dark." A 9 m pool radius needs gaps under 18 m to overlap.
    for (let i = 1; i < zs.length; i++) {
      assert.ok(
        zs[i - 1] - zs[i] <= 18,
        `gap of ${(zs[i - 1] - zs[i]).toFixed(1)} m between lamps on side ${side}`,
      )
    }
  }
})

ok('both sides are populated, and the far half as densely as the near', () => {
  const mid = (START_Z + WALK_END_Z) / 2
  for (const side of [-1, 1]) {
    const near = layout.props.filter((p) => p.side === side && p.z <= START_Z && p.z > mid).length
    const far = layout.props.filter((p) => p.side === side && p.z <= mid && p.z > WALK_END_Z).length
    assert.ok(near >= 12, `near half of side ${side} has only ${near} props`)
    assert.ok(far >= 12, `far half of side ${side} has only ${far} props`)
    // Prompt 3: "the right side of the street feels empty after the first
    // building." Neither half may thin out to less than half the other.
    assert.ok(
      Math.min(near, far) / Math.max(near, far) > 0.5,
      `side ${side} is lopsided: ${near} near vs ${far} far`,
    )
  }
})

ok('buildings tile both sides with no gaps and no facade symmetry', () => {
  for (const side of [-1, 1]) {
    const row = layout.buildings.filter((b) => b.side === side).sort((a, b) => b.z1 - a.z1)
    assert.ok(row.length >= 8, `only ${row.length} buildings on side ${side}`)
    for (let i = 1; i < row.length; i++) {
      const gap = row[i - 1].z0 - row[i].z1
      assert.ok(gap >= 0 && gap < 0.6, `bad party wall gap of ${gap.toFixed(2)} m`)
    }
    assert.ok(row[row.length - 1].z0 <= END_Z, 'row stops short of the horizon')
  }
  // No facade edge may line up with one across the street within 1 m — near
  // edges and far edges both, since either one is a visible party wall.
  const edges = (side) =>
    layout.buildings.filter((b) => b.side === side).flatMap((b) => [b.z0, b.z1])
  for (const l of edges(-1)) {
    for (const r of edges(1)) {
      assert.ok(
        Math.abs(l - r) > 1.0,
        `facade edges align across the street at z=${l.toFixed(2)} / ${r.toFixed(2)}`,
      )
    }
  }
})

ok('the ground floor is occupied, not blank wall', () => {
  const c = frontageCoverage(layout)
  const pct = (100 * c.occupied) / c.total
  // The contact sheet measured 64% of 351 m of frontage as bare brick, which is
  // what "the assets look crude" actually turned out to mean: every frame
  // looking across the street was a wall. A shop is not the only fix — a dead
  // unit with the shutter down and a front door to the flats above are both
  // frontage. What is not acceptable is nothing.
  assert.ok(pct >= 80, `only ${pct.toFixed(0)}% of frontage is occupied`)

  // ...but it must not become a shopping parade either.
  const shopPct = (100 * c.shops) / c.total
  assert.ok(shopPct <= 80, `${shopPct.toFixed(0)}% of the street is shopfront — too uniform`)

  for (const b of layout.buildings) {
    assert.ok(b.bays.length > 0, `building at z=${b.z1.toFixed(0)} has no frontage at all`)
    for (const y of b.bays) {
      assert.ok(
        y.kind !== 'shop' || y.business,
        `shop bay at z=${y.z0.toFixed(0)} has no business`,
      )
      assert.ok(
        y.kind === 'shop' || !y.business,
        `non-shop bay at z=${y.z0.toFixed(0)} carries a business`,
      )
    }
  }
})

ok('every frontage kind actually appears on the street', () => {
  const c = frontageCoverage(layout)
  for (const kind of ['shop', 'vacant', 'residential']) {
    assert.ok(c.byKind[kind] > 0, `no ${kind} frontage anywhere on the block`)
  }
})

ok('the layout is deterministic', () => {
  const a = buildLayout()
  const b = buildLayout()
  assert.equal(JSON.stringify(a.props), JSON.stringify(b.props))
  assert.equal(JSON.stringify(a.cars), JSON.stringify(b.cars))
})

console.log(`\nplacement: ${checks} checks passed`)
