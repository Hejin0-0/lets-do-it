import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Loop } from './index.ts'

test('loop: update then render each frame, dt clamped, stop halts', () => {
  const frames: ((t: number) => void)[] = []
  const g = globalThis as Record<string, unknown>
  g.requestAnimationFrame = (f: (t: number) => void) => frames.push(f)
  g.cancelAnimationFrame = () => { frames.length = 0 }
  const calls: string[] = []
  const loop = new Loop((dt) => calls.push(`u${dt.toFixed(3)}`), () => calls.push('r'))
  loop.start()
  frames.shift()!(performance.now() + 16)
  frames.shift()!(performance.now() + 10_000) // a tab back from the background
  assert.equal(calls[1], 'r')
  assert.equal(calls[2], 'u0.050')
  loop.stop()
  loop.start()
  frames.shift()!(performance.now() - 5) // a frame stamped before start()
  assert.equal(calls.at(-2), 'u0.000')
  loop.stop()
  assert.equal(loop.isRunning, false)
  assert.equal(frames.length, 0)
})
