import assert from 'node:assert/strict'
import { resolve, hits, RADIUS } from '../src/player/collide.ts'
import { WALK_END_Z, WALK_HALF } from '../src/world/placement.ts'

const ok = (m) => console.log('  ok  ' + m)

// A lamp post on the kerb — thin, and the shape the reported bug happened on.
const post = { x: -5.79, z: 4.0, hx: 0.14, hz: 0.14 }
// A long bench, for the slide-along-a-wall case.
const bench = { x: 7.0, z: -20, hx: 0.3, hz: 1.8 }

// --- the reported bug: running diagonally past a post ------------------------
// Step the real integration: constant diagonal velocity into the post's corner,
// and check the player gets past it instead of juddering on the spot.
{
  const dt = 1 / 60
  const v = 4.8 / Math.SQRT2
  let x = -6.4
  let z = 4.9
  let stalls = 0
  let minStep = Infinity
  for (let i = 0; i < 240; i++) {
    const { x: nx, z: nz } = resolve(x + v * dt, z - v * dt, [post])
    const step = Math.hypot(nx - x, nz - z)
    if (i > 5) minStep = Math.min(minStep, step)
    // A stall is a frame that produced less than a tenth of the asked-for motion.
    if (i > 5 && step < v * dt * 0.1) stalls++
    x = nx
    z = nz
  }
  assert.ok(z < 2.0, `only reached z=${z.toFixed(2)}; the post is still blocking`)
  assert.ok(stalls === 0, `${stalls} stalled frames while passing a lamp post`)
  ok('running diagonally past a lamp post does not judder or stall')
}

// --- you still cannot walk through it ----------------------------------------
{
  const { x, z } = resolve(post.x, post.z, [post])
  assert.ok(!hits(x, z, post), 'resolved position is outside the collider')
  ok('you cannot end up inside a collider')
}

// --- head-on into a wall stops you -------------------------------------------
// Approach from the -X side and try to walk straight through the middle.
{
  const dt = 1 / 60
  let x = 5.5
  for (let i = 0; i < 120; i++) x = resolve(x + 4.8 * dt, -20, [bench]).x
  assert.ok(x <= bench.x - bench.hx - RADIUS + 1e-3, `walked to ${x.toFixed(3)}, through the bench`)
  assert.ok(x > bench.x - bench.hx - RADIUS - 0.02, `stopped ${(bench.x - bench.hx - RADIUS - x).toFixed(3)} m short`)
  ok('walking straight into a wall stops against its face and no further')
}

// --- but along it, you slide ---------------------------------------------------
{
  // Pressed against the bench's long side, moving mostly along it.
  const { x, z } = resolve(bench.x - bench.hx - RADIUS + 0.05, -20.4, [bench])
  assert.ok(!hits(x, z, bench), 'still outside')
  assert.ok(Math.abs(z - -20.4) < 1e-6, 'the along-wall component is untouched')
  ok('pressed against a wall, motion along it is not eaten')
}

// --- resolve never leaves you overlapping --------------------------------------
for (let i = 0; i < 400; i++) {
  const sx = post.x + (i % 20) * 0.06 - 0.6
  const sz = post.z + Math.floor(i / 20) * 0.06 - 0.6
  const r = resolve(sx, sz, [post])
  assert.ok(!hits(r.x, r.z, post), `resolve(${sx.toFixed(2)}, ${sz.toFixed(2)}) still overlaps`)
}
ok('resolve always lands outside, from any approach')

// --- a gap exactly the player's width does not fling them out -------------------
// Two posts either side, the gap just wide enough. The pushes cancel; walking
// through should not teleport sideways.
{
  const left = { x: -0.72, z: 0, hx: 0.1, hz: 0.1 }
  const right = { x: 0.72, z: 0, hx: 0.1, hz: 0.1 }
  const r = resolve(0, 0, [left, right])
  assert.ok(Math.abs(r.x) < 0.35, `flung to x=${r.x.toFixed(3)} between two posts`)
  ok('squeezing between two colliders does not fling you sideways')
}

// --- the street bounds still hold ---------------------------------------------
{
  const { x, z } = resolve(999, -999, [])
  assert.ok(Math.abs(x) < WALK_HALF, 'clamped inside the frontages')
  assert.ok(z >= WALK_END_Z, `clamped to the end of the walk (${WALK_END_Z})`)
  ok('street bounds still clamp')
}

// --- the bounds report a normal, not just a position ---------------------------
// Regression. The clamps used to move you and say nothing, so a player pinned
// against the frontages got a zero normal back, `controls.update` bled no
// velocity, and `controls.speed` reported full run speed while they were
// standing still. That stale velocity is what made coming off a wall feel like
// dropping to a walk.
{
  const right = resolve(999, -40, [])
  assert.ok(right.nx < -0.99, `no normal from the +X frontage (nx=${right.nx})`)
  const left = resolve(-999, -40, [])
  assert.ok(left.nx > 0.99, `no normal from the -X frontage (nx=${left.nx})`)
  const far = resolve(0, -999, [])
  assert.ok(far.nz > 0.99, `no normal from the end of the block (nz=${far.nz})`)

  // And it must stay silent when nothing stopped you, or every free frame would
  // bleed velocity against a surface that is not there.
  const clear = resolve(0, -40, [])
  assert.equal(clear.nx, 0, 'invented a normal in open street')
  assert.equal(clear.nz, 0, 'invented a normal in open street')

  // The along-edge component still has to survive: sliding along the frontage
  // should lose the sideways part and keep the rest.
  const slide = resolve(999, -40.5, [])
  assert.ok(Math.abs(slide.z - -40.5) < 1e-9, 'the along-edge component was eaten')
  ok('the street bounds report a surface normal, and only when they act')
}

console.log('collide: 8 checks passed')
