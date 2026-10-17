// Click the hourglass and the radio where they are drawn, the way a user does; the world must answer.
(async () => {
  const h = window.__pool, w = h.world, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect()
  const click = (p, id) => { const [x, y] = h.toPx(p); for (const type of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: id, bubbles: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, pointerType: 'mouse' })) }
  h.pause(true)
  const at = h.spots()
  click(at.radio, 7)
  const radio = w.radio, toast = document.querySelector('#toast').textContent
  click(at.hourglass, 8)
  const turning = w.glass.turn > 0
  if (!radio || !turning) throw new Error(`radio ${radio}, hourglass turning ${turning}`)
  return JSON.stringify({ radio, toast, turning })
})()
