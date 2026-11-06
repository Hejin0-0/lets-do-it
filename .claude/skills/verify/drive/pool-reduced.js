// With --reduced-motion: the camera cuts where it would fly. Sitting by the chair's own button puts the eye at the
// seat a few frames later (it eases over 1.1 s otherwise) with the menu open; Stand up puts it back at the overview as
// fast, and it stays there; a duck chosen in the menu's Duck to watch is looked at at once (the gaze turns over seconds
// otherwise). Proof: the camera's eye against the seat's, its pose a few frames after a move and later, and the angle
// between where it looks and the duck.
(async () => {
  const P = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms))
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) throw new Error('run the probe with --reduced-motion')
  const eyeOf = (c) => { const ce = Math.cos(c.el); return [c.target[0] + c.dist * ce * Math.sin(c.az), c.target[1] + c.dist * Math.sin(c.el), c.target[2] + c.dist * ce * Math.cos(c.az)] }
  const off = (seat) => Math.hypot(...eyeOf(P.state().camera).map((v, k) => v - seat.eye[k]))
  const pose = () => { const c = P.state().camera; return [c.az, c.el, c.dist, ...c.target] }
  const moved = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
  const menu = () => document.querySelector('.seat-ui dialog'), out = []
  const check = (ok, what) => { if (!ok) throw new Error(what + ': ' + JSON.stringify({ state: P.seating.state, out })) }
  P.add(6); P.step(960); await wait(800)
  const seats = P.spots().seats

  document.querySelectorAll('.seat-ui .seat-sit')[0].click(); await wait(120)
  check(P.seating.state.phase === 'seated' && off(seats[0]) < 0.02 && menu().open, 'sitting did not cut to the seat')
  out.push({ by: 'sit', after: 120, off: +off(seats[0]).toFixed(4) })

  const choice = menu().querySelector('select.seat-duck'), opt = [...choice.options].find((o) => o.value !== '')
  check(opt, 'no duck to watch')
  choice.value = opt.value; choice.dispatchEvent(new Event('change', { bubbles: true })); await wait(120)
  const d = P.world.ducks.find((x) => String(x.id) === opt.value), c = P.state().camera
  const eye = eyeOf(c), at = P.world.block.toWorld(d.body.p), to = at.map((v, i) => v - eye[i]), look = c.target.map((v, i) => v - eye[i])
  const angle = Math.acos(Math.min(1, to.reduce((s, v, i) => s + v * look[i], 0) / Math.hypot(...to) / Math.hypot(...look)))
  check(angle < 0.03, `the gaze did not cut to the duck watched (${angle.toFixed(3)} rad off)`)
  out.push({ by: 'watch', duck: d.name, after: 120, angle: +angle.toFixed(4) })

  menu().querySelector('.seat-up').click(); await wait(120)
  const a = pose(); await wait(800)
  check(P.seating.state.phase === 'standing' && off(seats[0]) > 0.5 && moved(a, pose()) < 1e-3, 'standing eased back to the overview')
  out.push({ by: 'stand', after: 120, still: +moved(a, pose()).toFixed(5) })
  return JSON.stringify(out)
})()
