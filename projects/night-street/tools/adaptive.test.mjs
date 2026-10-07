import assert from 'node:assert/strict'
import { createAdaptive } from '../src/gfx/adaptive.ts'

const ok = (m) => console.log('  ok  ' + m)

/** Feed `ms` frames until `n` seconds of simulated time have passed. */
const run = (a, ms, seconds) => {
  for (let t = 0; t < seconds * 1000; t += ms) a.sample(ms)
}

// --- a fast machine stays at full resolution ---------------------------------
{
  const seen = []
  const a = createAdaptive(1, (s) => seen.push(s))
  run(a, 9, 20)
  assert.equal(a.scale, 1, `dropped to ${a.scale} on a machine with margin to spare`)
  assert.equal(seen.length, 0, 'resized for no reason')
  ok('a machine with headroom is left alone at full resolution')
}

// --- a slow one comes down, and stops -----------------------------------------
{
  const a = createAdaptive(1, () => {})
  run(a, 26, 40)
  assert.ok(a.scale < 0.9, `only reached ${a.scale.toFixed(2)} on 26 ms frames`)
  assert.ok(a.scale >= 0.55, `fell through the floor to ${a.scale.toFixed(2)}`)
  ok('a machine that cannot keep up drops resolution, down to a floor and no further')
}

// --- and it climbs back when the load lifts ------------------------------------
{
  const a = createAdaptive(1, () => {})
  run(a, 26, 30)
  const low = a.scale
  assert.ok(low < 1, 'setup: should have dropped first')
  run(a, 8, 60)
  assert.ok(a.scale > low, `stuck at ${a.scale.toFixed(2)} after the load lifted`)
  assert.ok(a.scale <= 1, `climbed past the ceiling to ${a.scale.toFixed(2)}`)
  ok('resolution climbs back when the frame gets cheap again')
}

// --- a single bad frame is not a reason to resize -------------------------------
{
  let resizes = 0
  const a = createAdaptive(1, () => resizes++)
  for (let i = 0; i < 2000; i++) a.sample(i % 200 === 0 ? 48 : 9)
  assert.equal(resizes, 0, `resized ${resizes} times for occasional hitches`)
  ok('one slow frame in two hundred does not move the resolution')
}

// --- a backgrounded tab does not slam it to the floor ----------------------------
{
  const a = createAdaptive(1, () => {})
  run(a, 9, 12)
  for (let i = 0; i < 5; i++) a.sample(4000) // alt-tabbed
  run(a, 9, 12)
  assert.equal(a.scale, 1, `alt-tab left it at ${a.scale.toFixed(2)}`)
  ok('multi-second frames from a backgrounded tab are ignored')
}

// --- it does not oscillate at the boundary ---------------------------------------
{
  let resizes = 0
  const a = createAdaptive(1, () => resizes++)
  // Right at the target: the classic hunting case.
  run(a, 16.7, 90)
  assert.ok(resizes <= 4, `hunted: ${resizes} resizes in 90 s sitting on the target`)
  ok('sitting exactly on the target does not hunt')
}

console.log('adaptive: 6 checks passed')
