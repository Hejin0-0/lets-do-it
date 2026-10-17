// Headless checks of the world: terrain, the sea, the block, bodies. Run: node tests/10-island.test.mjs
import { IJ } from './load.mjs'
import { budget } from './budget.mjs'
let fails = 0
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }
const { HALF, WL0, GN, GDX } = IJ

// terrain
const T = IJ.terrainGrid()
let dry = 0, top = -1
for (let k = 0; k < T.length; k++) { if (T[k] > WL0) dry++; top = Math.max(top, T[k]) }
check('island covers ~12% of the square', dry / T.length > 0.09 && dry / T.length < 0.15, (dry / T.length * 100).toFixed(1) + '%')
check('island top ~0.2 above the water', top - WL0 > 0.12 && top - WL0 < 0.3, (top - WL0).toFixed(3))
let dmin = 9, dmax = 0
for (let s = -HALF; s <= HALF; s += 0.05) for (const [x, z] of [[s, -HALF], [s, HALF], [-HALF, s], [HALF, s]]) { const d = WL0 - IJ.terrainH(x, z); dmin = Math.min(dmin, d); dmax = Math.max(dmax, d) }
check('wall depths 0.4..0.76', dmin > 0.33 && dmax < 0.82, dmin.toFixed(2) + '..' + dmax.toFixed(2))
check('sandbar is submerged and shallow', WL0 - IJ.terrainH(1.35, 1.05) > 0.12 && WL0 - IJ.terrainH(1.35, 1.05) < 0.4, (WL0 - IJ.terrainH(1.35, 1.05)).toFixed(2))

// sea: volume, stability
{
  const W = IJ.createWater()
  const v0 = W.volume(); W.addVolume(0.8, 1.6, 0.01, 0.1)
  check('addVolume adds exactly', Math.abs(W.volume() - v0 - 0.01) < 1e-6, (W.volume() - v0).toExponential(3))
  W.flat()
  const t0 = performance.now()
  for (let s = 0; s < 600; s++) {
    if (s < 240 && s % 3 === 0) W.stir(Math.sin(s * 0.05) * 1.8, 1.2 + Math.cos(s * 0.07) * 0.8, 2.5)
    W.step(1 / 120, 0, 0)
  }
  const ms = (performance.now() - t0) / 600
  const e1 = W.energy
  for (let s = 0; s < 1200; s++) W.step(1 / 120, 0, 0)
  check('sea stays finite under stirring', W.resets === 0 && Number.isFinite(W.energy))
  check('waves decay', W.energy < e1 * 0.5, `${e1.toFixed(4)} -> ${W.energy.toFixed(4)}`)
  check('a water step is cheap', ms < budget(2), ms.toFixed(3) + ' ms')
  W.firm = 1; W.damp = 0
  for (let s = 0; s < 600; s++) { if (s % 2 === 0) W.stir(1.2, -1.6, 3); W.step(1 / 120, 0, 0) }
  check('firm and undamped stays stable', W.resets === 0 && W.energy < 50, W.energy.toFixed(3))
}

// tilt: slosh to the low side and back
{
  const w = IJ.createWorld()
  w.block.grab(); w.block.setTarget(0, 0.17)
  w.stepFrames(240)
  const lo = w.water.height(-2.4, 1.5), hi = w.water.height(2.4, 1.5)
  check('tilt: the sea sloshes to the low side', lo - hi > 0.1, `low ${lo.toFixed(3)} high ${hi.toFixed(3)} g.x ${w.block.g[0].toFixed(2)}`)
  check('tilt lifts the block onto its lowest corner', Math.abs(w.block.lift - 2.6 * Math.sin(0.17)) < 0.02, w.block.lift.toFixed(3))
  w.block.release()
  w.stepFrames(30)
  const sq = Math.abs(w.block.squash) + Math.hypot(...w.block.shear)
  w.stepFrames(600)
  const lo2 = w.water.height(-2.4, 1.5), hi2 = w.water.height(2.4, 1.5)
  check('release: the block quivers', sq > 0.002, sq.toFixed(4))
  check('release: the sea settles level again', Math.abs(lo2 - hi2) < 0.02, (lo2 - hi2).toFixed(4))
  check('crown coconuts stay attached through a tilt', w.bodies.filter((b) => b.state === 'crown').length === 9)
}

// bodies
{
  const w = IJ.createWorld()
  const t = w.tally()
  check('reset: 9 coconuts in the crowns + 7 beach pebbles', w.bodies.length === 16 && t.ashore === 16, JSON.stringify(t))
  const pebs = w.bodies.filter((b) => b.kind === 'pebble')
  const ok = pebs.every((b) => IJ.terrainNormal(b.p[0], b.p[2])[1] > 0.93)
  check('beach pebbles sit on gentle sand', ok)
  const start = pebs.map((b) => b.p.slice())
  w.stepFrames(600)
  const moved = Math.max(...pebs.map((b, i) => Math.hypot(b.p[0] - start[i][0], b.p[2] - start[i][2])))
  check('beach pebbles stay put at rest', moved < 0.01, moved.toFixed(4))
  w.block.grab(); w.block.setTarget(0.06, 0.04); w.stepFrames(240); w.block.release(); w.stepFrames(240)
  const moved2 = Math.max(...pebs.map((b, i) => Math.hypot(b.p[0] - start[i][0], b.p[2] - start[i][2])))
  check('... and on a small tilt', moved2 < 0.03, moved2.toFixed(4))
  let rolled = 0
  for (const dir of [[0.17, 0], [0, 0.17], [-0.17, 0], [0, -0.17]]) {
    const s2 = pebs.map((b) => b.p.slice())
    w.block.grab(); w.block.setTarget(...dir); w.stepFrames(180)
    rolled = Math.max(rolled, ...pebs.map((b, i) => Math.hypot(b.p[0] - s2[i][0], b.p[2] - s2[i][2])))
    w.block.release(); w.stepFrames(240)
  }
  check('a real tilt rolls some pebbles', rolled > 0.05, rolled.toFixed(3))
}
{
  const w = IJ.createWorld()
  const c = w.drop('coconut'), p = w.drop('pebble')
  let splashes = 0
  for (let f = 0; f < 600; f++) { w.stepFrames(1); splashes += w.events.filter((e) => e.type === 'splash').length; w.events.length = 0 }
  check('drops splash', splashes >= 2, splashes)
  check('a coconut floats ~62% under', c.sub / c.Vs > 0.5 && c.sub / c.Vs < 0.75 && c.sandT > 1, (c.sub / c.Vs).toFixed(3))
  check('a pebble sinks to the bottom', p.sub >= p.Vs * 0.995 && (p.sandT < 0.1 || p.sleep), `sub ${(p.sub / p.Vs).toFixed(3)} y ${p.p[1].toFixed(3)} ground ${IJ.terrainH(p.p[0], p.p[2]).toFixed(3)}`)
  const t = w.tally()
  check('tally: afloat 1, sunk 1', t.afloat === 1 && t.sunk === 1, JSON.stringify(t))
  // bob: the coconut rides waves made next to it
  const y0 = c.p[1]
  w.water.addVolume(c.p[0] + 0.3, c.p[2], 0.01, 0.1)
  let ymax = y0; for (let f = 0; f < 60; f++) { w.stepFrames(1); ymax = Math.max(ymax, c.p[1]) }
  check('a floating coconut rides a wave', ymax - y0 > 0.005, (ymax - y0).toFixed(4))
  // throw
  w.grab(p); w.hold(p, [0, 2.2, 0]); w.throw(p, [3, 1, 0]); w.stepFrames(30)
  check('a thrown pebble flies', p.p[0] > 0.5, p.p[0].toFixed(2))
  // fill up
  for (let i = 0; i < 50; i++) w.drop()
  w.stepFrames(300)
  check('bodies are capped at 40', w.bodies.length <= 40, w.bodies.length)
  check('everything is finite', w.bodies.every((b) => b.p.every(Number.isFinite)) && w.water.resets === 0)
  check('bubbles rise and pop', w.bubbles.popped > 10, w.bubbles.popped)
  // palm knock
  const w2 = IJ.createWorld()
  w2.palms.st[0].held = true; w2.palms.st[0].target = [0.5, 0]
  w2.stepFrames(60); w2.palms.st[0].held = false; w2.stepFrames(60)
  check('flinging a palm knocks its coconuts off', w2.bodies.filter((b) => b.state === 'crown' && b.palm === 0).length < 3, w2.palms.st[0].fling.toFixed(2))
}
console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exit(fails ? 1 : 0)
