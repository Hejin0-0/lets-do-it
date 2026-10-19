// Click the hourglass and the radio where they are drawn, the way a user does; the world must answer. Each click on
// the radio turns its dial to the next station, then off.
(async () => {
  const h = window.__pool, w = h.world, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect()
  const click = (p, id) => { const [x, y] = h.toPx(p); for (const type of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: id, bubbles: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, pointerType: 'mouse' })) }
  h.pause(true)
  const at = h.spots()
  const dial = []
  for (let k = 0; k < 4; k++) { click(at.radio, 7 + k); h.render(1, 0); await new Promise((r) => setTimeout(r, 250)); dial.push(h.state().station || 'off') }
  click(at.hourglass, 20)
  const turning = w.glass.turn > 0
  if (dial.join() !== 'Lido FM,Low Tide,Surf Hour,off' || !turning) throw new Error(`dial ${dial}, hourglass turning ${turning}`)
  return JSON.stringify({ dial, turning })
})()
