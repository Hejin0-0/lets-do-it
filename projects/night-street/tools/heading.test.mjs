import assert from 'node:assert/strict'
import {
  cameraForward,
  cameraRight,
  inputAxes,
  moveVector,
} from '../src/player/heading.ts'

/**
 * Movement direction, checked at yaws the old code got right *and* the yaws it
 * got backwards.
 *
 * The bug this exists for agreed with the truth at yaw 0 and 180 and was exactly
 * negated at plus/minus 90. Any test that only walked down the street passed. So
 * the whole point here is the sweep: every 15 degrees, all the way round.
 */

let checks = 0
const ok = (label, fn) => { fn(); checks++; console.log(`  ok  ${label}`) }
const near = (a, b, what) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a.toFixed(6)} != ${b.toFixed(6)}`)

const YAWS = []
for (let d = -180; d <= 180; d += 15) YAWS.push((d * Math.PI) / 180)

const keys = (...held) => (c) => held.includes(c)

ok('W moves along the camera forward vector at every yaw', () => {
  for (const yaw of YAWS) {
    const [ix, iz] = inputAxes(keys('KeyW'))
    const [wx, wz] = moveVector(ix, iz, yaw)
    const [fx, fz] = cameraForward(yaw)
    near(wx, fx, `yaw ${((yaw * 180) / Math.PI).toFixed(0)} x`)
    near(wz, fz, `yaw ${((yaw * 180) / Math.PI).toFixed(0)} z`)
  }
})

ok('S moves exactly opposite to W at every yaw', () => {
  for (const yaw of YAWS) {
    const f = moveVector(...inputAxes(keys('KeyW')), yaw)
    const b = moveVector(...inputAxes(keys('KeyS')), yaw)
    near(f[0], -b[0], 'x')
    near(f[1], -b[1], 'z')
  }
})

ok('D strafes along the camera right vector at every yaw', () => {
  for (const yaw of YAWS) {
    const [wx, wz] = moveVector(...inputAxes(keys('KeyD')), yaw)
    const [rx, rz] = cameraRight(yaw)
    near(wx, rx, 'x')
    near(wz, rz, 'z')
  }
})

ok('A strafes exactly opposite to D', () => {
  for (const yaw of YAWS) {
    const l = moveVector(...inputAxes(keys('KeyA')), yaw)
    const r = moveVector(...inputAxes(keys('KeyD')), yaw)
    near(l[0], -r[0], 'x')
    near(l[1], -r[1], 'z')
  }
})

ok('forward and right stay perpendicular and unit length', () => {
  for (const yaw of YAWS) {
    const [fx, fz] = cameraForward(yaw)
    const [rx, rz] = cameraRight(yaw)
    near(Math.hypot(fx, fz), 1, 'forward length')
    near(Math.hypot(rx, rz), 1, 'right length')
    near(fx * rx + fz * rz, 0, 'dot')
  }
})

ok('facing across the street is not reversed — the actual reported bug', () => {
  // Facing +X (yaw = -90): W must take you toward +X, not -X.
  const yaw = -Math.PI / 2
  const [wx] = moveVector(...inputAxes(keys('KeyW')), yaw)
  assert.ok(wx > 0.99, `facing +X, W gave x=${wx.toFixed(3)} — reversed`)
  // Facing -X (yaw = +90): W must take you toward -X.
  const [wx2] = moveVector(...inputAxes(keys('KeyW')), Math.PI / 2)
  assert.ok(wx2 < -0.99, `facing -X, W gave x=${wx2.toFixed(3)} — reversed`)
})

ok('diagonals are normalised, so W+D is not faster than W', () => {
  for (const yaw of YAWS) {
    const [wx, wz] = moveVector(...inputAxes(keys('KeyW', 'KeyD')), yaw)
    near(Math.hypot(wx, wz), 1, 'diagonal speed')
  }
})

ok('arrow keys behave identically to WASD', () => {
  for (const yaw of YAWS) {
    for (const [a, b] of [['KeyW','ArrowUp'], ['KeyS','ArrowDown'], ['KeyA','ArrowLeft'], ['KeyD','ArrowRight']]) {
      const p = moveVector(...inputAxes(keys(a)), yaw)
      const q = moveVector(...inputAxes(keys(b)), yaw)
      near(p[0], q[0], `${a}/${b} x`)
      near(p[1], q[1], `${a}/${b} z`)
    }
  }
})

console.log(`\nheading: ${checks} checks passed across ${YAWS.length} yaw angles`)
