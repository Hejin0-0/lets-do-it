// A quick press on a duck where it is drawn is a tap: it hops, is the chosen one, and its burst flies (fx() > 0); a
// press that moves is still a pick-up (held, carried). Proof: the burst's count after the tap, the duck held and moved
// by the drag.
(async () => {
  const P = window.__pool, W = P.world, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect(), wait = (ms) => new Promise((res) => setTimeout(res, ms))
  W.arrivals = false; P.clock(false); P.hour(12)
  await wait(800)
  const d = W.ducks[0], at = () => P.toPx([d.body.p[0], d.body.p[1] + 0.06, d.body.p[2]])
  P.cam.target = d.body.p.slice(); P.cam.dist = 3; await wait(600)
  const ev = (type, x, y, id) => cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: id, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerType: 'mouse' }))
  P.pause(true); P.render(1, 0)
  let [x, y] = at(); ev('pointerdown', x, y, 3); ev('pointerup', x, y, 3)
  P.render(1, 1 / 60); P.pause(false)
  const burst = P.fx(), picked = P.state().selected
  await wait(2500)
  ;[x, y] = at(); const p0 = d.body.p.slice()
  ev('pointerdown', x, y, 4); for (let k = 1; k <= 8; k++) { await wait(30); ev('pointermove', x + k * 8, y - k * 6, 4) }
  const held = d.body.state === 'held'
  ev('pointerup', x + 64, y - 48, 4); await wait(100)
  const out = { burst, picked, id: d.id, held, moved: +Math.hypot(d.body.p[0] - p0[0], d.body.p[2] - p0[2]).toFixed(3) }
  if (!(burst > 0 && picked === d.id && held && out.moved > 0.05)) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
