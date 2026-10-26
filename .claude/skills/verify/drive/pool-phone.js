// The pool on a phone (run with the probe's --mobile: 390x844, touch): the low quality and at most 1.5 device pixels a
// CSS pixel; the touch hints, not the keys, and buttons a finger can hit; two fingers slide the view (its distance
// kept) and pinch it closer; a tap on a duck makes it hop.
(async () => {
  const h = window.__pool, c = document.querySelector('canvas'), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const s = h.state()
  if (s.quality !== 'low') fail(`quality ${s.quality}, not low`)
  if (s.size[0] > innerWidth * 1.5 + 1) fail(`drawn ${s.size[0]} wide for ${innerWidth} CSS pixels`)
  const shown = (sel) => getComputedStyle(document.querySelector(sel)).display !== 'none'
  if (!shown('.pool-controls .touch') || shown('.pool-controls .keys')) fail('the touch hints should show, the keys not')
  document.querySelector('.pool-controls').open = true
  await wait(100)
  for (const b of document.querySelectorAll('.pool-controls summary, .pool-controls button')) if (b.getBoundingClientRect().height < 43.5) fail(`"${b.textContent}" is ${b.getBoundingClientRect().height}px tall`)
  document.querySelector('.pool-controls').open = false
  const fire = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id % 10 === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }))
  const two = async (a, b, da, db) => {
    fire('pointerdown', a.id, a.x, a.y); fire('pointerdown', b.id, b.x, b.y)
    for (let k = 1; k <= 10; k++) { fire('pointermove', a.id, a.x + da[0] * k, a.y + da[1] * k); fire('pointermove', b.id, b.x + db[0] * k, b.y + db[1] * k); await wait(16) }
    fire('pointerup', a.id, a.x + da[0] * 10, a.y + da[1] * 10); fire('pointerup', b.id, b.x + db[0] * 10, b.y + db[1] * 10); await wait(200)
  }
  const c0 = h.state().camera
  await two({ id: 11, x: 140, y: 250 }, { id: 12, x: 240, y: 250 }, [8, 4], [8, 4])
  const c1 = h.state().camera
  if (Math.hypot(c1.target[0] - c0.target[0], c1.target[2] - c0.target[2]) < 0.5) fail('two fingers sliding did not move the view')
  if (Math.abs(c1.dist - c0.dist) > 0.01) fail(`sliding changed the distance ${c0.dist} -> ${c1.dist}`)
  await two({ id: 21, x: 150, y: 300 }, { id: 22, x: 230, y: 300 }, [-5, 0], [5, 0])
  const c2 = h.state().camera
  if (!(c2.dist < c1.dist * 0.7)) fail(`pinching apart did not come closer ${c1.dist} -> ${c2.dist}`)
  h.resetView(); await wait(1500)
  const d = h.world.ducks.find((d) => { const p = d.state === 'float' && h.toPx([d.body.p[0], d.body.p[1] + 0.05, d.body.p[2]]); return p && p[0] > 20 && p[0] < innerWidth - 20 && p[1] > 60 && p[1] < innerHeight - 140 })
  if (!d) fail('no duck in view to tap')
  const p = h.toPx([d.body.p[0], d.body.p[1] + 0.05, d.body.p[2]])
  fire('pointerdown', 31, p[0], p[1]); await wait(80); fire('pointerup', 31, p[0], p[1]); await wait(200)
  if (!(h.fx() > 0) || h.state().selected !== d.id) fail('a tap on a duck did nothing')
  return JSON.stringify({ size: s.size, slid: c1.target.map((v) => +v.toFixed(2)), pinched: +c2.dist.toFixed(2), fx: h.fx() })
})()
