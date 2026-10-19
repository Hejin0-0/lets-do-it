// Headless checks of Rubber Duck Pool: the ducks go round (the big pool, down the slide, round the round pool,
// down its drain, up the clear tube) without jamming or stranding; new ducks drop into the big pool; the swan creeps
// in and traps ducks; the lawn and the beach stay dry; adding,
// taking away, dressing; the slide and the drain each do their part; the current slider; the toys keep clear
// of the slide's mouth; a duck picked up and thrown; a full pool of forty for a long soak.
// Run: node tests/pool.test.mjs
import { P } from '../src/pool/layout.js'
import { createWorld } from '../src/pool/world.js'
import { MAX_DUCKS, DUCK_FLOAT, PROPELLER, DESIGNS } from '../src/pool/ducks.js'
import { createFx } from '../src/pool/fx.js'
import { STATIONS, pattern } from '../src/pool/radio.js'
import { daylight } from '../src/pool/daylight.js'
import { OCEAN, oceanSpectrum, oceanAt } from '../src/pool/ocean.js'
import { budget } from './budget.mjs'
let fails = 0
const FULL = { seed: 14, ducks: 12, arrivals: false }, EMPTY = { seed: 14, ducks: 0, arrivals: false }   // a dozen ducks, or none, and no more coming
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); if (!ok) fails++ }
const finite = (W) => [...W.ducks, ...W.toys.map((body) => ({ body }))].every((d) => [...d.body.p, ...d.body.q].every(Number.isFinite)) && Number.isFinite(W.water.energy)
const region = (W, b) => (W.water.isWet(b.p[0], b.p[2]) ? W.water.regionAt(b.p[0], b.p[2]) : -1)
/** Watch the ducks for sec seconds: the longest any one sat still afloat, the longest any was out of the water,
 * the longest a float stayed in the slide's mouth (passing through it is fine; staying would jam the slide). */
function watch(W, sec) {
  const last = new Map(), atMouth = new Map()
  let still = 0, dry = 0, mouth = 0
  for (let s = 0; s < sec * 4; s++) {
    W.step(30)
    for (const b of W.toys.filter((b) => b.toy !== 'ball')) {
      const t = Math.hypot(b.p[0] - P.MOUTH[0], b.p[2] - P.MOUTH[1]) < 0.12 ? (atMouth.get(b) || 0) + 0.25 : 0
      atMouth.set(b, t); mouth = Math.max(mouth, t)
    }
    for (const d of W.ducks) {
      const r = last.get(d) || { p: d.body.p.slice(), t: 0, dry: 0 }
      last.set(d, r)
      const busy = d.state !== 'float' || d.body.state === 'held'
      if (busy || Math.hypot(d.body.p[0] - r.p[0], d.body.p[2] - r.p[2]) > 0.06) { r.p = d.body.p.slice(); r.t = 0 } else r.t += 0.25
      still = Math.max(still, r.t)
      r.dry = busy || (region(W, d.body) >= 0 && d.body.submerged > 0) ? 0 : r.dry + 0.25
      dry = Math.max(dry, r.dry)
    }
  }
  return { still, dry, mouth }
}
/** A duck put down by hand at p. */
function duckAt(W, p) {
  const b = W.floaters.add({ ...DUCK_FLOAT, p })
  const d = { slot: W.ducks.length, body: b, colour: 0, hat: 0, state: 'float', s: 0, vs: 0, wait: 0, laps: 0, id: 99, inRound: 0 }
  b.duck = d; W.ducks.push(d)
  return d
}

// round and round: a dozen ducks for three minutes
{
  const W = createWorld(FULL)
  let wet = 0
  const cell = (v) => -P.HALF + (Math.floor((v + P.HALF) / P.GDX) + 0.5) * P.GDX   // the water's cell centre a point falls in
  for (let z = 0.05 - P.HALF; z < P.HALF; z += 0.05) for (let x = 0.05 - P.HALF; x < P.HALF; x += 0.05) { const cx = cell(x), cz = cell(z); if (W.water.isWet(x, z) && !P.inMain(cx, cz) && P.mainD(cx, cz) > 0.06 && P.roundD(cx, cz) > 0.06) wet++ }
  check('the lawn, the stone and the beach are dry', wet === 0, wet)
  const t0 = performance.now()
  const S = watch(W, 180)
  const ms = (performance.now() - t0) / (180 * 120)
  check('the ducks go down the slide', W.slides >= 10, W.slides)
  check('and come back up the tube', W.returns >= 8, W.returns)
  check('no duck sits still for half a minute', S.still < 30, S.still.toFixed(1) + ' s')
  check('no duck stranded out of the water', S.dry < 3, S.dry.toFixed(1) + ' s')
  check('no float stays in the slide\'s mouth', S.mouth < 5, S.mouth.toFixed(2) + ' s at most')
  check('the water stays calm', W.water.energy < 0.1, W.water.energy.toFixed(4))
  check('cheap: under 1 ms a tick', ms < budget(1), ms.toFixed(3) + ' ms')
  let inRound = 0
  for (let s = 0; s < 240; s++) { W.step(30); inRound += W.ducks.filter((d) => d.state === 'float' && region(W, d.body) === P.LO).length / 240 }
  check('the round pool doesn\'t hoard them: most are in the big pool', inRound < W.ducks.length / 3, inRound.toFixed(1) + ' of ' + W.ducks.length)
}

// arrivals: the pool opens with one duck; every 10 to 20 seconds another drops in, of a design not in the pools yet,
// until all twelve are there
{
  const W = createWorld({ seed: 5 }), times = [], at = new Map()
  check('Arrivals: one duck to start with', W.ducks.length === 1)
  for (let i = 0; i < 120 * 300; i++) { W.step(1); for (const d of W.ducks) if (!at.has(d)) { at.set(d, W.time); times.push(W.time) } }
  const gaps = times.slice(1).map((t, i) => t - times[i]), designs = new Set(W.ducks.map((d) => d.colour))
  check('Arrivals: one at a time, 10 to 20 seconds apart', gaps.length === 11 && gaps.every((g) => g >= 10 - 0.01 && g <= 20 + 0.01), gaps.map((g) => g.toFixed(1)).join(' '))
  check('Arrivals: each a design not there yet, till all twelve are', W.ducks.length === 12 && designs.size === 12, `${W.ducks.length} ducks, ${designs.size} designs`)
}

// a tap: the duck hops and spins and answers in its design's voice; its burst flies off and is gone in a couple of seconds
{
  const W = createWorld(FULL), d = W.ducks[2]
  W.step(120 * 3); W.events.length = 0
  const y0 = d.body.p[1]
  W.hand.tap(d.body)
  const ev = W.events.find((e) => e.type === 'voice')
  let top = y0; for (let i = 0; i < 60; i++) { W.step(1); top = Math.max(top, d.body.p[1]) }
  check('Tap: the duck hops', top - y0 > 0.08, (top - y0).toFixed(3))
  check('Tap: it answers in its own voice', ev && ev.colour === d.colour && typeof DESIGNS[ev.colour].voice === 'string' && W.selected === d, ev && DESIGNS[ev.colour].voice)
  const fx = createFx(P.rng(1))
  fx.burst(d.body.p, d.colour)
  const n = fx.count; for (let i = 0; i < 180; i++) fx.step(1 / 60)
  check('Tap: its burst flies off and is gone in three seconds', n === DESIGNS[d.colour].fx.n && fx.count === 0, `${n} -> ${fx.count}`)
}

// adding and taking away
{
  const W = createWorld(FULL)
  check('Add five: five come', W.addDucks(5) === 5)
  const landed = new Map()   // where each new duck first touches the water (after that the current may take it anywhere)
  for (let i = 0; i < 120 * 5; i++) { W.step(1); for (const d of W.ducks.slice(12)) if (!landed.has(d) && d.body.submerged > 0) landed.set(d, region(W, d.body)) }
  check('Add five: each drops into the big pool', W.ducks.length === 17 && landed.size === 5 && [...landed.values()].every((r) => r === P.UP), `${W.ducks.length} ducks, landed in ${[...landed.values()]}`)
  W.addDucks(100); W.step(120 * 25)
  check(`no more than ${MAX_DUCKS}`, W.ducks.length === MAX_DUCKS, W.ducks.length)
  W.hand.grab(W.ducks[3].body); const chosen = W.selected
  check('Take one out: the chosen one goes', W.removeDuck() && !W.ducks.includes(chosen) && W.ducks.length === MAX_DUCKS - 1 && W.selected === null)
  check('Take one out: then the newest', W.removeDuck() && W.ducks.length === MAX_DUCKS - 2)
}

// dressing: the chosen duck, or the ones to come
{
  const W = createWorld(FULL)
  const d = W.ducks[5]
  W.hand.grab(d.body); W.hand.throw(d.body, [0, 0, 0])
  W.setColour(3); W.setHat(2)
  check('Dress: the picked duck takes the colour and the hat', W.selected === d && d.colour === 3 && d.hat === 2)
  check('Dress: a squeak when picked up', W.events.some((e) => e.type === 'squeak'))
  W.selected = null; W.setColour(6); W.setHat(4)
  W.addDucks(1); W.step(120)
  const n = W.ducks[W.ducks.length - 1]
  check('Dress: with none chosen, the next ducks', n.colour === 6 && n.hat === 4 && d.colour === 3)
  W.mixUp()
  check('Mix them up: a mixture', new Set(W.ducks.map((x) => x.colour * 10 + x.hat)).size > 4)
}

// the slide: a duck at its mouth goes down into the round pool and floats there, upright
{
  const W = createWorld(EMPTY)
  const d = duckAt(W, [P.MOUTH[0], P.LU + 0.03, P.MOUTH[1] - 0.12])
  let rode = false
  for (let i = 0; i < 120 * 15 && W.slides === 0; i++) { W.step(1); rode ||= d.state === 'slide' }
  W.step(120 * 3)
  check('down the slide', rode && W.slides === 1)
  check('afloat and upright in the round pool', region(W, d.body) === P.LO && d.body.submerged > 0 && W.floaters.up(d.body)[1] > 0.9, d.body.p.map((v) => v.toFixed(2)).join(','))
}

// the drain and the tube: a duck in the round pool goes down the drain, rides up the clear tube in sight and drops
// out of its mouth into the big pool
{
  const W = createWorld(EMPTY)
  const d = duckAt(W, [P.ROUND[0] + 0.1, P.LL + 0.03, P.ROUND[1]])
  let piped = false, inSight = 0, top = 0
  for (let i = 0; i < 120 * 20 && W.returns === 0; i++) {
    W.step(1)
    if (d.state !== 'tube') continue
    piped = true; top = Math.max(top, d.body.p[1])
    if (d.body.p[1] > P.terrainH(d.body.p[0], d.body.p[2]) + 0.01) inSight += 1 / 120
  }
  W.step(120 * 3)
  check('down the drain', piped)
  check('up the tube in sight, over the lawn and the step', inSight > 1.5 && top > P.TER + 0.1, `${inSight.toFixed(1)} s in sight, up to ${top.toFixed(2)}`)
  check('out of its mouth, afloat in the big pool', W.returns === 1 && region(W, d.body) === P.UP && d.body.submerged > 0, d.body.p.map((v) => v.toFixed(2)).join(','))
  check('it comes out with a pop', W.events.some((e) => e.type === 'pop'))
}

// new ducks drop in from above the middle of the big pool
{
  const W = createWorld(EMPTY)
  W.addDucks(1)
  let high = 0
  for (let i = 0; i < 120 * 4; i++) { W.step(1); if (W.ducks[0]) high = Math.max(high, W.ducks[0].body.p[1]) }
  const b = W.ducks[0].body
  check('a new duck drops in from above', high > P.LU + 0.5, high.toFixed(2))
  check('into the middle of the big pool, afloat and upright', region(W, b) === P.UP && Math.hypot(b.p[0] - P.DROP[0], b.p[2] - P.DROP[2]) < 0.6 && b.submerged > 0 && W.floaters.up(b)[1] > 0.9, b.p.map((v) => v.toFixed(2)).join(','))
}

// the current: off, the ducks drift to a stop; doubled, they go faster
{
  // the way every floating duck goes over 20 s, sampled four times a second (a duck circling the round pool comes
  // back where it was, so how far it ends up from where it started says little); the fountain's pops don't follow
  // the slider, so doubling the current makes them about 1.2–1.5 times faster, not twice
  const speed = (k) => {
    const W = createWorld(FULL); W.setCurrent(k); W.step(120 * 8)
    let path = 0, time = 0; const last = new Map(W.ducks.map((d) => [d, d.body.p.slice()]))
    for (let s = 0; s < 80; s++) {
      W.step(30)
      for (const d of W.ducks) { const l = last.get(d); last.set(d, d.body.p.slice()); if (d.state === 'float' && l) { path += Math.hypot(d.body.p[0] - l[0], d.body.p[2] - l[2]); time += 0.25 } }
    }
    return path / time
  }
  const s0 = speed(0), s1 = speed(1), s2 = speed(2)
  check('Current: off, the ducks barely move', s0 < 0.3 * s1, `${s0.toFixed(3)} vs ${s1.toFixed(3)}`)
  check('Current: doubled, they go faster', s2 > 1.12 * s1, `${s2.toFixed(3)} vs ${s1.toFixed(3)}`)
}

// picked up and thrown: back afloat, upright
{
  const W = createWorld(FULL)
  const b = W.ducks[0].body
  W.hand.grab(b)
  for (let i = 0; i < 60; i++) { W.hand.hold(b, [0.0, P.TER + 0.5, -0.4]); W.step(1) }
  check('held: lifted out of the water', b.p[1] > P.TER + 0.3)
  W.hand.throw(b, [0.1, 0.2, 0.1]); W.step(120 * 5)
  check('thrown: back afloat and upright', b.submerged > 0 && W.floaters.up(b)[1] > 0.9 && region(W, b) === P.UP, b.p.map((v) => v.toFixed(2)).join(','))
  const V = createWorld(EMPTY), ball = V.toys.find((x) => x.toy === 'ball')
  V.hand.grab(ball); for (let i = 0; i < 60; i++) { V.hand.hold(ball, [P.ROUND[0], P.LAWN + 0.4, P.ROUND[1]]); V.step(1) }
  V.hand.throw(ball, [0, 0, 0]); V.step(120 * 4)
  check('the beach ball can be thrown into the round pool, and floats', region(V, ball) === P.LO && ball.submerged > 0, ball.p.map((v) => v.toFixed(2)).join(','))
}

// the hourglass runs down in a minute and is turned over; a click turns it over, or switches the radio on and off
{
  const W = createWorld(EMPTY)
  const s0 = W.glass.s
  W.step(120 * 10)
  check('Hourglass: the sand runs down', Math.abs(W.glass.s - (s0 + 10 / 60)) < 0.01, W.glass.s.toFixed(3))
  W.step(120 * 60)
  check('Hourglass: run out, it is turned over and runs again', W.glass.s < 0.5 && W.events.some((e) => e.type === 'turn'), W.glass.s.toFixed(3))
  const down = [0, -1, 0], hit = (x, z) => W.pick([x, 3, z], down)
  check('Hourglass and radio: a click finds them', hit(P.HOURGLASS[0], P.HOURGLASS[1])?.kind === 'glass' && hit(P.RADIO[0], P.RADIO[1])?.kind === 'radio')
  check('Seats: a click finds each deck chair', P.SEATS.every((s, i) => { const h = hit(s.at[0], s.at[1]); return h?.kind === 'seat' && h.seat === i }))
  check('Seats: each looks the way its chair faces', P.SEATS.every((s) => { const f = [-Math.cos(s.yaw), Math.sin(s.yaw)], d = [s.look[0] - s.eye[0], s.look[2] - s.eye[2]]; return (f[0] * d[0] + f[1] * d[1]) / Math.hypot(...d) > 0.99 }))
  const before = W.glass.s
  check('Hourglass: clicked, it turns over (not twice at once)', W.turnGlass() && !W.turnGlass())
  W.step(120 * 2)
  check('Hourglass: and the sand that had run down is now on top', Math.abs(W.glass.s - (1 - before) - 0.6 / 60) < 0.02, `${before.toFixed(3)} -> ${W.glass.s.toFixed(3)}`)
  const dial = [W.tuneRadio(), W.radio, W.tuneRadio(), W.tuneRadio(), W.tuneRadio(), W.radio]
  check('Radio: each click turns the dial to the next station, then off', dial.join() === `1,true,2,3,0,false`, dial.join())
  const tunes = STATIONS.map(pattern)
  check('Radio: every station has its own four bars, a rest at the end of each, every note in its scale', tunes.every((t, i) => t.length === 32 && [7, 15, 23, 31].every((k) => t[k] === null) && t.every((n) => n === null || STATIONS[i].scale.includes(n))) && new Set(tunes.map((t) => t.join())).size === STATIONS.length)
}

// the swan: on the stone it creeps toward the big pool a hop at a time, and after a long while leaps in
{
  const W = createWorld(FULL), b = W.swan, x0 = b.p[0]
  let t = 0, inAt = null
  while (t < 600 && inAt === null) { W.step(120); t++; if (W.events.some((e) => e.type === 'swanIn')) inAt = t; W.events.length = 0; if (t === 120) check('Swan: after two minutes it has crept toward the pool, still on the stone', x0 - b.p[0] > 0.1 && !W.water.isWet(b.p[0], b.p[2]), `${(x0 - b.p[0]).toFixed(2)} closer`) }
  W.step(120 * 3)
  check('Swan: in the end it leaps into the big pool, upright', inAt !== null && inAt > 180 && region(W, b) === P.UP && W.floaters.up(b)[1] > 0.9, `at ${inAt} s`)
  // afloat, it scoops in ducks it drifts into, holds them, and they hop out again; the ducks still go round
  const inner = P.SWAN.R - P.SWAN.r, inRing = (d) => d.state === 'float' && Math.hypot(d.body.p[0] - b.p[0], d.body.p[2] - b.p[2]) < inner
  let held = 0, scoops = 0, outs = 0, longest = 0; const run = new Map(), s0 = W.slides
  for (let k = 0; k < 300 * 4; k++) {
    W.step(30)
    for (const e of W.events) { if (e.type === 'swanScoop') scoops++; if (e.type === 'swanOut') outs++ }
    W.events.length = 0
    for (const d of W.ducks) { const r = inRing(d) ? (run.get(d) || 0) + 0.25 : 0; run.set(d, r); longest = Math.max(longest, r); if (r) held += 0.25 }
  }
  check('Swan: afloat, it scoops up ducks and holds them', scoops >= 1 && held > 30, `${scoops} scooped, ${held} duck-seconds held`)
  check('Swan: and lets them go again (none is held the whole five minutes)', outs >= 1 && longest < 240, `${outs} hopped out, the longest held ${longest} s`)
  check('Swan: the ducks still go round', W.slides - s0 >= 20, W.slides - s0)
  // lifted out onto the stone, it sets off again
  W.hand.grab(b); for (let i = 0; i < 30; i++) { W.hand.hold(b, [P.SWAN.at[0] - 0.2, P.TER + 0.2, P.SWAN.at[1]]); W.step(1) }
  W.hand.throw(b, [0, 0, 0]); const x1 = b.p[0]
  W.step(120 * 120)
  check('Swan: put back on the stone, it creeps toward the pool again', x1 - b.p[0] > 0.1 || region(W, b) === P.UP, `${(x1 - b.p[0]).toFixed(2)} closer`)
}

// the time of day: a clock that runs (a day in ten minutes) or stops; the sun by day, the moon by night, never a jump
{
  const W = createWorld(EMPTY)
  const h0 = W.day.hour
  W.step(120 * 60)
  check('Time: a minute of the world moves the clock 2.4 hours on', Math.abs(W.day.hour - h0 - 2.4) < 0.01, `${h0} -> ${W.day.hour.toFixed(2)}`)
  W.setDayRun(false); const h1 = W.day.hour; W.step(120 * 10)
  check('Time: stopped, it stays', W.day.hour === h1)
  W.setHour(25.5)
  check('Time: an hour past midnight wraps round', W.day.hour === 1.5)
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], noon = daylight(12), midnight = daylight(0)
  check('Time: at noon the sun is high and white', noon.dir[1] > 0.75 && noon.tint.every((v) => v > 0.95) && noon.night === 0)
  check('Time: at midnight the moon lights it, dimly, and the sky is dark', midnight.night === 1 && Math.max(...midnight.tint) < 0.3 && lum(midnight.sky) * 10 < lum(noon.sky), `sky ${lum(midnight.sky).toFixed(3)} vs ${lum(noon.sky).toFixed(3)}`)
  check('Time: the sunset is warm', daylight(17.5).tint[2] < 0.6 * daylight(17.5).tint[0])
  let turn = 0, step = 0
  for (let m = 0; m < 24 * 60; m++) {
    const a = daylight(m / 60), b = daylight((m + 1) / 60), lit = Math.max(...a.tint, ...b.tint) > 0.05
    if (lit) turn = Math.max(turn, Math.acos(Math.min(1, a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2])) * 180 / Math.PI)
    step = Math.max(step, ...[...a.sky.map((v, k) => Math.abs(v - b.sky[k])), ...a.haze.map((v, k) => Math.abs(v - b.haze[k])), Math.abs(a.night - b.night)])
  }
  // a game minute is 0.4 s on the page; the steepest key (the haze from gold to orange in 36 minutes) moves 2.3% a minute
  check('Time: minute to minute nothing jumps (the light turns under a degree, a colour moves under 3%)', turn < 1 && step < 0.03, `${turn.toFixed(2)} deg, ${step.toFixed(4)}`)
}

// flyers: a duck in a propeller cap flies now and then; some flights land in a pool, some take it out over the cliff
// to the sea, where it drifts off and is gone; a plain duck never flies
{
  const W = createWorld({ seed: 14, arrivals: false }), flyers = [0, 1, 2, 3].map(() => W.addFlyer())
  let landed = 0, high = 0, was = new Map()
  for (let k = 0; k < 180 * 4; k++) {
    W.step(30)
    for (const d of flyers) {
      if (d.state === 'fly') high = Math.max(high, d.body.p[1] - P.LU)
      if (was.get(d) === 'fly' && d.state === 'float') landed++
      was.set(d, d.state)
    }
  }
  const atSea = flyers.filter((d) => d.state === 'sea' && W.ducks.includes(d))   // out there still (one gone keeps its last place)
  check('Flyers: each wears the propeller', flyers.every((d) => d.hat === PROPELLER))
  check('Flyers: they fly up over the pool and land back in it', landed >= 1 && high > 0.4, `${landed} landings, up to ${high.toFixed(2)} over the water`)
  const onWaves = (d) => Math.abs(d.body.p[1] - (P.SEA + oceanAt(d.body.p[0], d.body.p[2], W.time - 1 / 120)[0] - 0.02)) < 1e-9   // placed in the tick before the clock moved on
  check('Flyers: some fly out over the cliff to the sea, and ride its waves', W.escaped >= 1 && atSea.every((d) => Math.max(Math.abs(d.body.p[0]), Math.abs(d.body.p[2])) > P.HALF && onWaves(d)), `${W.escaped} out to sea`)
  if (atSea[0]) {
    let lo = Infinity, hi = -Infinity
    for (let s = 0; s < 40; s++) { W.step(30); lo = Math.min(lo, atSea[0].body.p[1]); hi = Math.max(hi, atSea[0].body.p[1]) }
    check('Flyers: out at sea one rises and falls with the swell', hi - lo > 0.02, `${(hi - lo).toFixed(3)} up and down in 10 s`)
  }
  W.mixUp()
  check('Flyers: mixing them up keeps their propellers', W.ducks.filter((d) => d.hat === PROPELLER).length === flyers.filter((d) => W.ducks.includes(d)).length)
  const out = atSea[0], n = W.ducks.length
  W.step(120 * 125)
  check('Flyers: out at sea one drifts off and is gone in two minutes', !out || (!W.ducks.includes(out) && W.ducks.length < n), `${n} -> ${W.ducks.length} ducks`)
  const V = createWorld({ seed: 14 }); let flew = false
  for (let k = 0; k < 180 * 4; k++) { V.step(30); flew ||= V.ducks.some((d) => d.state === 'fly') }
  check('Flyers: a plain duck never flies', !flew && V.escaped === 0)
  let caps = 0; for (let seed = 1; seed <= 20; seed++) caps += createWorld({ seed, ducks: MAX_DUCKS }).ducks.filter((d) => d.hat === PROPELLER).length
  check('Flyers: no duck starts in a propeller cap (20 pools of forty)', caps === 0, caps)
}

// the open sea: its Fourier amplitudes add up to the spectrum they come from (the wind sea's JONSWAP, integrated here
// over frequency, and the swell's height); the biggest waves, which oceanAt() follows, carry most of it
{
  const S = oceanSpectrum(), G = 9.81, { U, fetch, gamma } = OCEAN.wind
  const alpha = 0.076 * ((U * U) / (fetch * G)) ** 0.22, wp = 22 * ((G * G) / (U * fetch)) ** (1 / 3)
  let m0 = OCEAN.swell.hs ** 2 / 16
  for (let w = 0.1; w < 30; w += 0.001) m0 += (0.001 * alpha * G * G) / w ** 5 * Math.exp(-1.25 * (wp / w) ** 4) * gamma ** Math.exp(-((w - wp) ** 2) / (2 * (w <= wp ? 0.07 : 0.09) ** 2 * wp * wp))
  check('Sea: as high as its spectrum says', Math.abs(S.hs - 4 * Math.sqrt(m0)) < 0.05 * S.hs, `${S.hs.toFixed(2)} m vs ${(4 * Math.sqrt(m0)).toFixed(2)} m`)
  let sum2 = 0
  for (let i = 0; i < 4000; i++) sum2 += oceanAt(5 + i * 0.53, -7 + i * 0.31, i * 0.9)[0] ** 2
  const hs = 4 * Math.sqrt(sum2 / 4000) * OCEAN.M
  check('Sea: the waves a duck out there rides carry most of its height', hs > 0.8 * S.hs && hs < 1.1 * S.hs, `${hs.toFixed(2)} m of ${S.hs.toFixed(2)} m`)
}

// names: every duck has one, forty never share one, and the same pool gives the same names
{
  const W = createWorld({ seed: 3, ducks: MAX_DUCKS }), V = createWorld({ seed: 3, ducks: MAX_DUCKS })
  check('Names: every duck has one, all forty different', W.ducks.every((d) => typeof d.name === 'string' && d.name.length > 1) && new Set(W.ducks.map((d) => d.name)).size === MAX_DUCKS)
  check('Names: the same pool, the same names', W.ducks.map((d) => d.name).join() === V.ducks.map((d) => d.name).join(), W.ducks.slice(0, 3).map((d) => d.name).join(', '))
}

// a full pool of forty for five minutes
{
  const W = createWorld({ seed: 3, ducks: MAX_DUCKS })
  const t0 = performance.now()
  const S = watch(W, 300)
  const ms = (performance.now() - t0) / (300 * 120)
  check('forty ducks: all finite', finite(W))
  check('forty ducks: still going round', W.slides >= 40 && W.returns >= 35, `${W.slides} slides, ${W.returns} returns`)
  check('forty ducks: no jam', S.still < 45, S.still.toFixed(1) + ' s')
  check('forty ducks: none stranded', S.dry < 3, S.dry.toFixed(1) + ' s')
  check('forty ducks: no float stays in the slide\'s mouth', S.mouth < 5, S.mouth.toFixed(2) + ' s at most')
  check('forty ducks: still cheap', ms < budget(2), ms.toFixed(3) + ' ms')
  W.reset()
  check('Reset: back to the start', W.ducks.length === MAX_DUCKS && W.slides === 0 && W.returns === 0 && finite(W), W.ducks.length)
}

console.log(fails ? `\n${fails} failed` : '\nall passed')
process.exitCode = fails ? 1 : 0
