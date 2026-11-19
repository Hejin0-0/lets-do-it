// Click the hourglass and the radio where they are drawn, the way a user does; the world must answer. Each click on
// the radio turns its dial to the next station, then off. Their buttons for a keyboard (prop-keys.js) do the same.
(async () => {
  const h = window.__pool, w = h.world, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect()
  const click = (p, id) => { const [x, y] = h.toPx(p); for (const type of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: id, bubbles: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, pointerType: 'mouse' })) }
  h.pause(true)
  const at = h.spots()
  const look = async (p) => { h.cam.target = p.slice(); h.cam.dist = 3; h.cam.el = 1.15; await new Promise((r) => setTimeout(r, 400)) }   // the page may start far out: look down on the prop, so nothing stands in front of it
  const dial = []
  await look(at.radio)
  for (let k = 0; k < 4; k++) { click(at.radio, 7 + k); h.render(1, 0); await new Promise((r) => setTimeout(r, 250)); dial.push(h.state().station || 'off') }
  await look(at.hourglass)
  click(at.hourglass, 20)
  const turning = w.glass.turn > 0
  if (dial.join() !== 'Lido FM,Low Tide,Surf Hour,off' || !turning) throw new Error(`dial ${dial}, hourglass turning ${turning}`)
  // the same props from the keyboard: their buttons show when focused, Enter and Space press them, the page says what changed
  const keys = [...document.querySelectorAll('.prop-keys button')], said = document.querySelector('.prop-keys [role="status"]')
  keys[0].focus(); await window.__input([{ key: 'Enter' }]); await new Promise((r) => setTimeout(r, 100))
  const shown = keys[0].getBoundingClientRect().width > 20, byKey = h.state().station, saidRadio = said.textContent
  await window.__input([{ key: 'Tab' }, { key: 'Tab' }]); const cooler = document.activeElement.textContent
  await window.__input([{ key: ' ' }]); await new Promise((r) => setTimeout(r, 100))
  const opened = w.coolers.isOpen(0), after = document.activeElement.textContent
  if (!shown || byKey !== 'Lido FM' || !saidRadio.includes('Lido FM')) throw new Error(`radio by key: shown ${shown}, station ${byKey}, said "${saidRadio}"`)
  if (cooler !== 'Open the cooler by the pool chair' || !opened || after !== 'Close the cooler by the pool chair') throw new Error(`cooler by key: "${cooler}" -> open ${opened}, "${after}"`)
  return JSON.stringify({ dial, turning, byKey, cooler: after })
})()
