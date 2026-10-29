// Sit in each deck chair by clicking it where it is drawn, and by the hook's sit(i). Each time the camera eases to
// the seat's eye. Then the seat's own controls, as a keyboard uses them: the hidden "Sit in the ..." button shows
// when it has focus and seats you (click() is what Enter and Space do on a native button); once arrived the menu
// beside the chair's cooler is open, inside the window, and holds focus; a W pressed there moves neither the camera
// nor the seat (the menu keeps its keys from the world's shortcuts); Stand up and Escape each leave, close the menu
// and give focus back to the button that sat you; the other chair's button switches seats, the menu shut on the way
// and open on arrival with the new seat's name; Escape on the way stands and the camera never reaches the seat; a
// wheel step or a drag on the empty scene while seated leaves the seat (the camera stays where it was taken). It ends
// seated in the pool chair, the menu open, for the screenshot. Proof: the camera's eye against the seat's (within
// 0.02), the seat's state, the menu's open state and box, and where focus is, at each step.
(async () => {
  const P = window.__pool, wait = (ms) => new Promise((r) => setTimeout(r, ms)), cv = document.querySelector('canvas')
  const eyeOf = (c) => { const ce = Math.cos(c.el); return [c.target[0] + c.dist * ce * Math.sin(c.az), c.target[1] + c.dist * Math.sin(c.el), c.target[2] + c.dist * ce * Math.cos(c.az)] }
  const off = (seat) => Math.hypot(...eyeOf(P.state().camera).map((v, k) => v - seat.eye[k]))
  const click = (x, y) => { const o = { clientX: x, clientY: y, pointerId: 1, button: 0, bubbles: true, isPrimary: true, pointerType: 'mouse' }; cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)) }
  const key = (code, k, type = 'keydown') => document.activeElement.dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true, cancelable: true }))
  const menu = () => document.querySelector('.seat-ui dialog'), button = (i) => document.querySelectorAll('.seat-ui .seat-sit')[i]
  const inMenu = () => menu().contains(document.activeElement)
  const out = []
  const check = (ok, what) => { if (!ok) throw new Error(what + ': ' + JSON.stringify({ state: P.seating.state, open: menu().open, focus: document.activeElement?.textContent || document.activeElement?.tagName, out })) }
  await wait(500)
  const seats = P.spots().seats
  for (let i = 0; i < seats.length; i++) {
    P.cam.target = seats[i].chair.slice(); await wait(400)   // look round to the chair first, as a user would
    const [x, y] = P.toPx(seats[i].chair); click(x, y); await wait(1600)
    out.push({ seat: i, by: 'chair', at: [Math.round(x), Math.round(y)], off: +off(seats[i]).toFixed(3) })
    P.resetView(); await wait(1200)
    P.sit(i); await wait(1600)
    out.push({ seat: i, by: 'hook', off: +off(seats[i]).toFixed(3) })
    P.resetView(); await wait(1200)
  }
  const bad = out.filter((o) => !(o.off < 0.02) || (o.at && !(o.at[0] > 0 && o.at[0] < innerWidth && o.at[1] > 0 && o.at[1] < innerHeight)))
  if (bad.length) throw new Error('not seated: ' + JSON.stringify(bad))

  // the keyboard's way in, and the menu once arrived
  const b0 = button(0), b1 = button(1)
  check(menu().open === false && P.seating.state.phase === 'standing', 'menu open while standing')
  b0.focus()
  check(document.activeElement === b0 && b0.getBoundingClientRect().width > 20, 'sit button not shown on focus')
  b0.click(); await wait(1600)
  const box = menu().getBoundingClientRect(), lid = P.toPx([seats[0].side[0], seats[0].side[1] + 0.2, seats[0].side[2]])
  check(P.seating.state.phase === 'seated' && P.seating.state.seat === 0 && off(seats[0]) < 0.02, 'keyboard sit did not seat')
  check(menu().open && inMenu() && menu().querySelector('h2').textContent === 'Pool chair', 'menu not open and focused on arrival')
  check(box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, 'menu outside the window')
  out.push({ by: 'keyboard', button: b0.textContent, menu: [box.left, box.top, box.width, box.height].map(Math.round), lid: lid && lid.map(Math.round), focus: document.activeElement.textContent })
  key('KeyW', 'w'); await wait(400); key('KeyW', 'w', 'keyup'); await wait(100)
  check(P.seating.state.phase === 'seated' && off(seats[0]) < 0.02 && inMenu(), 'W in the menu reached the world')
  out.push({ by: 'W in menu', off: +off(seats[0]).toFixed(3), phase: P.seating.state.phase })
  menu().querySelector('button').click(); await wait(100)
  check(P.seating.state.phase === 'standing' && !menu().open && document.activeElement === b0, 'Stand up did not leave or restore focus')
  out.push({ by: 'Stand up', focus: document.activeElement.textContent }); await wait(1000)

  b0.click(); await wait(1600)
  check(menu().open && inMenu(), 'menu not back on the second sit')
  key('Escape', 'Escape'); await wait(100)
  check(P.seating.state.phase === 'standing' && !menu().open && document.activeElement === b0, 'Escape did not leave or restore focus')
  out.push({ by: 'Escape', focus: document.activeElement.textContent }); await wait(1000)

  // switching chairs, and standing on the way
  b0.click(); await wait(1600)
  b1.focus(); b1.click(); await wait(50)
  check(P.seating.state.phase === 'moving' && P.seating.state.seat === 1 && !menu().open, 'stale menu while switching')
  await wait(1600)
  check(P.seating.state.phase === 'seated' && P.seating.state.seat === 1 && off(seats[1]) < 0.02 && menu().open && menu().querySelector('h2').textContent === 'Sea chair', 'switch did not seat in the other chair')
  out.push({ by: 'switch', off: +off(seats[1]).toFixed(3), name: menu().querySelector('h2').textContent })
  menu().querySelector('button').click(); await wait(100)
  check(document.activeElement === b1, 'focus not back on the switching button'); await wait(1000)
  b0.focus(); b0.click(); await wait(400)
  check(P.seating.state.phase === 'moving', 'not on the way')
  key('Escape', 'Escape'); await wait(1600)
  check(P.seating.state.phase === 'standing' && !menu().open && document.activeElement === b0 && off(seats[0]) > 0.5, 'stand on the way left a seat, a menu or the camera at the seat')
  out.push({ by: 'Escape on the way', off: +off(seats[0]).toFixed(3), phase: P.seating.state.phase })

  // any camera move of the player's leaves the seat
  P.sit(0); await wait(1600)
  check(menu().open, 'not seated before the wheel')
  cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true })); await wait(100)
  check(P.seating.state.phase === 'standing' && !menu().open && off(seats[0]) < 1, 'the wheel kept the seat (or reset the camera)')
  out.push({ by: 'wheel', off: +off(seats[0]).toFixed(3), phase: P.seating.state.phase })
  P.sit(1); await wait(1600)
  check(menu().open, 'not seated before the drag')
  let at = null
  for (let y = 60; y < innerHeight && !at; y += 40) for (let x = 200; x < innerWidth - 200 && !at; x += 80) if (!P.pick(x, y)) at = [x, y]
  check(at, 'no empty point to drag on')
  const o = { pointerId: 9, button: 0, buttons: 1, bubbles: true, isPrimary: true, pointerType: 'mouse' }
  cv.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: at[0], clientY: at[1] }))
  for (let k = 1; k <= 4; k++) { cv.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: at[0] + 15 * k, clientY: at[1] })); await wait(20) }
  cv.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: at[0] + 60, clientY: at[1] })); await wait(100)
  check(P.seating.state.phase === 'standing' && !menu().open, 'a drag kept the seat')
  out.push({ by: 'drag', at, off: +off(seats[1]).toFixed(3), phase: P.seating.state.phase })

  // the screenshot's state: seated in the pool chair by the keyboard, the menu open
  P.resetView(); await wait(1000)
  b0.focus(); b0.click(); await wait(1600)
  check(menu().open && inMenu(), 'not seated for the screenshot')
  return JSON.stringify(out)
})()
