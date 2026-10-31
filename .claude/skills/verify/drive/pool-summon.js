// Summoning a found item into the pool, by the player's own controls (the probe's window.__input: the browser's own taps,
// clicks and keys). In the book an empty page's Summon into the pool is locked and says why, and pressing it summons
// nothing. After Send the boat has brought things home, a found page's control is ready; pressing it puts that item
// (the page's own, of its kind) in the pool, floating in the water, and the control then reads In the pool. Pressing it
// again by click, Enter or Space puts nothing more there, a second found page summons a second, different item, the book's
// found pages and times are as they were, no duck is lost or changed, and the camera stays. Escape closes the book and
// gives focus back to Open the book. The hook steps the world's clock and reads the state; the presses are the player's.
// Start from an empty store. window.__shot = 'page' stops with a found page open and its control ready (for its screenshot);
// 'pool' stops with the book closed and the player standing, the item floating in the pool (for the pool's).
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const input = async (...steps) => { await window.__input(steps); await frame() }
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
  const named = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
  const dlg = () => [...document.querySelectorAll('dialog')].find((d) => d.querySelector('h1, h2, h3')?.textContent.trim() === 'Book')
  const control = () => dlg().querySelector('.book-summon'), hint = () => dlg().querySelector('.book-summon-hint').textContent.trim()
  const aria = (el) => el.getAttribute('aria-disabled'), label = () => control().textContent.trim()
  const found = () => h.book.pages.filter((p) => p.found).map((p) => p.id)
  const view = () => [h.cam.target.slice(), h.cam.az, h.cam.el, h.cam.dist].flat()
  const moved = (a) => Math.max(...view().map((v, i) => Math.abs(v - a[i]))) > 1e-6
  const goTo = async (id) => {   // by the book's own Next and Previous
    const d = dlg(), want = h.book.pages.findIndex((p) => p.id === id)
    for (let i = 0; i < h.book.pages.length * 2 && h.bookView.index !== want; i++) await input({ click: at(named(d, h.bookView.index < want ? 'Next' : 'Previous')) })
    if (h.bookView.index !== want) fail(`the book would not turn to ${id}`)
  }
  const out = []
  await wait(500)
  if (found().length) fail(`the book already holds ${found()}: run this from an empty store`)
  if (h.summoned().length) fail('something is already summoned')
  h.add(3); for (let i = 0; i < 60 && W.ducks.length < 3; i++) { h.step(120); if (i % 5 === 4) await frame() }
  h.sit(1); await wait(1600)   // the sea chair
  const send = $('.seat-ui .seat-send'), opener = $('.seat-ui .seat-book')

  // an empty page cannot summon, and says why
  await input({ click: at(opener) })
  let d = dlg(), pagesBefore = JSON.stringify(h.book.pages)
  if (!d?.open || !control()) fail('the book has no Summon into the pool control')
  if (label() !== 'Summon into the pool' || aria(control()) !== 'true' || !/Find it first/.test(hint())) fail(`an empty page's control is not locked with a reason: "${label()}", ${aria(control())}, "${hint()}"`)
  if (!dlg().querySelector('.book-summon-hint').id || control().getAttribute('aria-describedby') !== dlg().querySelector('.book-summon-hint').id) fail('the control does not point at its hint')
  await input({ click: at(control()) }); control().focus(); await input({ key: 'Enter' }, { key: ' ' })
  if (h.summoned().length || JSON.stringify(h.book.pages) !== pagesBefore) fail(`an empty page summoned something: ${JSON.stringify(h.summoned())}`)
  out.push({ by: 'empty page', label: label(), aria: aria(control()), hint: hint() })
  await input({ key: 'Escape' })

  // bring things home with the boat, as the player would
  for (let n = 0; n < 6 && found().length < 2; n++) {
    if (!(await run(120, () => W.collectibles.adrift.length > 0))) fail(`nothing adrift within 120 s (trip ${n + 1})`)
    await input({ click: at(send) })
    if (W.boat.state === 'moored') fail(`Send the boat did not send it (trip ${n + 1})`)
    if (!(await run(400, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
  }
  if (found().length < 2) fail(`fewer than two pages found: ${found()}`)
  const [first, second] = found(), kindOf = (id) => W.collectibles.list.find((c) => c.id === id).kind

  // a found page: ready; summon it
  pagesBefore = JSON.stringify(h.book.pages)
  await input({ click: at(opener) }); d = dlg(); await goTo(first)
  if (label() !== 'Summon into the pool' || aria(control()) !== 'false' || !/Summon it/.test(hint())) fail(`a found page's control is not ready: "${label()}", ${aria(control())}, "${hint()}"`)
  out.push({ by: 'found page', page: first, label: label(), aria: aria(control()), hint: hint() })
  if (window.__shot === 'page') return JSON.stringify(out)
  const eye = view(), bodies = W.floaters.bodies.length, ducksBefore = W.ducks.slice(), duckStates = ducksBefore.map((x) => x.state)   // the pool adds ducks of its own over time: compare from here
  await input({ click: at(control()) })
  let list = h.summoned()
  if (list.length !== 1 || list[0].id !== first || list[0].kind !== kindOf(first)) fail(`pressing the control did not summon the page's item: ${JSON.stringify(list)}, the page is ${first}`)
  if (W.floaters.bodies.length !== bodies + 1) fail(`one summon added ${W.floaters.bodies.length - bodies} bodies`)
  if (label() !== 'In the pool' || aria(control()) !== 'true' || !/floating in the pool/.test(hint())) fail(`the control did not say it is in the pool: "${label()}", ${aria(control())}, "${hint()}"`)
  if (moved(eye) || h.seating.state.phase !== 'seated') fail(`summoning moved the camera or left the seat: ${h.seating.state.phase}`)
  const spot = list[0].at.slice()
  out.push({ by: 'summoned', item: list[0], label: label(), hint: hint() })

  // again: no second instance, by click, Enter and Space
  await input({ click: at(control()) }); control().focus(); await input({ key: 'Enter' }, { key: ' ' }, { click: at(control()) })
  list = h.summoned()
  if (list.length !== 1 || W.floaters.bodies.length !== bodies + 1) fail(`repeating the press made more: ${JSON.stringify(list)}, ${W.floaters.bodies.length - bodies} bodies`)
  out.push({ by: 'repeated', count: list.length })

  // a different found page summons a different item, and the first stays
  await goTo(second)
  if (aria(control()) !== 'false' || label() !== 'Summon into the pool') fail(`the second found page's control is not ready: "${label()}", ${aria(control())}`)
  control().focus(); await input({ key: 'Enter' })
  list = h.summoned()
  if (list.length !== 2 || new Set(list.map((i) => i.id)).size !== 2 || !list.some((i) => i.id === first) || !list.some((i) => i.id === second)) fail(`the second summon is wrong: ${JSON.stringify(list)}`)
  const apart = Math.hypot(list[0].at[0] - list[1].at[0], list[0].at[1] - list[1].at[1])
  if (apart < 0.3) fail(`the summoned items sit on one spot: ${apart}`)
  out.push({ by: 'second item', items: list, apart: +apart.toFixed(2) })

  // nothing else changed: the book's finds, the ducks
  if (JSON.stringify(h.book.pages) !== pagesBefore) fail('summoning changed the book')
  if (ducksBefore.some((x) => !W.ducks.includes(x))) fail(`summoning removed a duck: ${W.ducks.map((x) => x.id)} was ${ducksBefore.map((x) => x.id)}`)
  if (ducksBefore.some((x, i) => x.state === 'sea' && duckStates[i] !== 'sea')) fail('summoning sent a duck to sea')
  await run(8, () => false)
  const later = h.summoned()
  if (later.length !== 2 || later.some((i) => !i.at.every(Number.isFinite))) fail(`the summoned items did not stay in the pool: ${JSON.stringify(later)}`)
  out.push({ by: 'afterwards', ducks: W.ducks.length, finds: found(), drift: later.map((i, k) => +Math.hypot(i.at[0] - list[k].at[0], i.at[1] - list[k].at[1]).toFixed(2)) })

  // closing the book gives focus back; then stand to look at the pool
  await input({ key: 'Escape' })
  if (dlg().open || document.activeElement !== opener) fail(`Escape did not close the book with focus back: open ${dlg().open}, "${document.activeElement.textContent}"`)
  $('.seat-ui .seat-up').focus(); await input({ key: 'Enter' }); await wait(1500)
  if (h.seating.state.phase !== 'standing') fail(`Stand up did not stand: ${h.seating.state.phase}`)
  out.push({ by: 'standing', summoned: h.summoned().length, spot })
  const items = h.summoned(), mid = [0, 1, 2].map((k) => [items.reduce((n, i) => n + i.at[0], 0) / items.length, 0, items.reduce((n, i) => n + i.at[1], 0) / items.length][k])
  mid[1] = W.water.surface(mid[0], mid[2]); h.cam.target = W.block.toWorld(mid); h.cam.dist = 6.5; h.cam.el = 0.9   // for the screenshot: the items, close
  await frame(); await frame()
  return JSON.stringify(out)
})()
