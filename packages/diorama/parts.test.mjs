// Headless checks of the parts builder's tube: its rings never turn against each other, so the quads between them
// never pinch through the middle (they did: each ring was flipped half a turn from the last). Run: node packages/diorama/parts.test.mjs
import { partsBuilder } from './parts.js'
let fails = 0
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }

const deg = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)))) * 180 / Math.PI
/** For each pair of neighbouring rings: how far the ring turned, and how far the path itself turned there (degrees). */
function turns(pts, seg = 8) {
  const B = partsBuilder(); B.part(0); B.tube(pts, 0.1, seg)
  const { vert } = B.done(), st = 11, ring = (i) => [0, 1, 2].map((k) => vert[i * (seg + 1) * st + k] - pts[i][k])
  const tan = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; return [0, 1, 2].map((k) => b[k] - a[k]) }
  return pts.slice(1).map((_, i) => ({ ring: deg(ring(i), ring(i + 1)), path: deg(tan(i), tan(i + 1)) }))
}

const straight = turns(Array.from({ length: 6 }, (_, i) => [i * 0.1, 0, 0]))
check('a straight tube: no ring turns', straight.every((t) => t.ring < 0.5), straight.map((t) => t.ring.toFixed(0)).join(' '))
for (const [name, pts] of [
  ['a ring', Array.from({ length: 25 }, (_, i) => [Math.cos((i / 24) * 2 * Math.PI), 0, Math.sin((i / 24) * 2 * Math.PI)])],
  ['a climbing bend', Array.from({ length: 12 }, (_, i) => [i * 0.1, i * i * 0.02, Math.sin(i * 0.4) * 0.2])],
  ['straight up', Array.from({ length: 5 }, (_, i) => [0, i * 0.1, 0])],
]) {
  const T = turns(pts)
  check(`${name}: each ring turns no more than the path does`, T.every((t) => t.ring <= t.path + 1), T.map((t) => `${t.ring.toFixed(0)}/${t.path.toFixed(0)}`).join(' '))
}

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exitCode = fails ? 1 : 0
