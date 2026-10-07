import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSeededRandom, draw } from './index.ts'

test('random: same seed, same sequence; values in [0, 1)', () => {
  const a = createSeededRandom(42), b = createSeededRandom(42), c = createSeededRandom(43)
  const sa = Array.from({ length: 1000 }, a), sb = Array.from({ length: 1000 }, b)
  assert.deepEqual(sa, sb)
  assert.notDeepEqual(sa.slice(0, 5), Array.from({ length: 5 }, c))
  assert.ok(sa.every((v) => v >= 0 && v < 1))
  // pinned: projects' worlds and baselines depend on these exact numbers
  assert.equal(createSeededRandom(1917)(), 0.9034266413655132)
  assert.deepEqual(draw(1917), [0.9034266413655132, (1917 + 0x6d2b79f5) >>> 0])
})
