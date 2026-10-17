// Sit in each deck chair: by its panel button, then by clicking the chair where it is drawn. Each time the camera
// eases to the seat's eye. Proof: the camera's eye after 1.6 s, against the seat's.
(async () => {
  const P = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const eyeOf = (c) => { const ce = Math.cos(c.el); return [c.target[0] + c.dist * ce * Math.sin(c.az), c.target[1] + c.dist * Math.sin(c.el), c.target[2] + c.dist * ce * Math.cos(c.az)] }
  const off = (seat) => Math.hypot(...eyeOf(P.state().camera).map((v, k) => v - seat.eye[k]))
  const click = (x, y) => { const c = document.querySelector('canvas'), o = { clientX: x, clientY: y, pointerId: 1, button: 0, bubbles: true, isPrimary: true, pointerType: 'mouse' }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)) }
  await wait(500)
  const seats = P.spots().seats, out = []
  for (let i = 0; i < seats.length; i++) {
    document.getElementById('seat' + i).click(); await wait(1600)
    out.push({ seat: i, by: 'button', off: +off(seats[i]).toFixed(3) })
    document.getElementById('resetView').click(); await wait(1200)
    const [x, y] = P.toPx(seats[i].chair); click(x, y); await wait(1600)
    out.push({ seat: i, by: 'chair', at: [Math.round(x), Math.round(y)], off: +off(seats[i]).toFixed(3) })
    document.getElementById('resetView').click(); await wait(1200)
  }
  const bad = out.filter((o) => !(o.off < 0.02))
  if (bad.length) throw new Error('not seated: ' + JSON.stringify(bad))
  return JSON.stringify(out)
})()
