// The whole list of collectibles, by the player's own controls (the probe's window.__input: the browser's own taps and
// clicks). From an empty store the list has several items, in the book's order, covering a bottle and a diorama. Each time
// something is adrift the seated menu's Send the boat fetches it, and what comes home fills exactly the pages of what the
// boat took: no other page, no page twice, and the book says the list is complete only after the last one. The book, opened
// by Open the book, shows one page for each item in the list's order, empty ones before and filled ones after, and "Every
// page is found." only when every page is. The hook steps the world's clock and reads the state; the clicks are the player's.
// Start from an empty store. window.__shot = 'sea' stops with the boat out and the items adrift, the camera on them (for
// its screenshot); otherwise it ends with the complete book open on its last page (for the book's).
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const input = async (...steps) => { await window.__input(steps); await frame() }
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
  const named = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
  const aria = (el) => el.getAttribute('aria-disabled')
  const dlg = () => [...document.querySelectorAll('dialog')].find((d) => d.querySelector('h1, h2, h3')?.textContent.trim() === 'Book')
  const page = () => dlg().querySelector('[data-state]'), position = () => dlg().querySelector('[role="status"]').textContent.trim()
  const shows = (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
  const complete = () => { const el = dlg().querySelector('.book-complete'); return shows(el) ? el.textContent.trim() : '' }
  const found = () => h.book.pages.filter((p) => p.found).map((p) => p.id)
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
  const out = []
  await wait(500)
  if (found().length) fail(`the book already holds ${found()}: run this from an empty store`)
  const items = W.collectibles.list, ids = items.map((i) => i.id), kinds = new Set(items.map((i) => i.kind))
  if (ids.length < 3 || new Set(ids).size !== ids.length || ids[0] !== 'bottle-first' || !kinds.has('bottle') || !kinds.has('diorama')) fail(`the list is not several stable ids covering a bottle and a diorama: ${JSON.stringify(items.map((i) => [i.id, i.kind]))}`)
  if (JSON.stringify(h.book.pages.map((p) => p.id)) !== JSON.stringify(ids)) fail(`the book's pages are not the list: ${JSON.stringify(h.book.pages.map((p) => p.id))}`)
  if (h.book.complete) fail('an empty book says it is complete')
  out.push({ by: 'list', items: items.map((i) => `${i.id} (${i.kind})`) })
  h.sit(1); await wait(1600)   // the sea chair
  const send = $('.seat-ui .seat-send'), status = $('.seat-ui .seat-boat'), opener = $('.seat-ui .seat-book')

  if (window.__shot === 'sea') {
    if (!(await run(80, () => W.collectibles.adrift.length >= ids.length))) fail(`not every item adrift within 80 s: ${W.collectibles.adrift.length}`)
    await input({ click: at(send) })
    if (W.boat.state === 'moored') fail('Send the boat did not send it')
    await run(6, () => false)
    const pts = [...W.collectibles.adrift.map((i) => [i.at[0], W.boat.p[1], i.at[1]]), W.boat.p.slice()], mid = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length)
    h.cam.target = W.block.toWorld(mid); h.cam.dist = 15; h.cam.el = 0.5
    await frame(); await frame()
    out.push({ by: 'sea', adrift: W.collectibles.adrift.map((i) => i.id), boat: W.boat.state })
    return JSON.stringify(out)
  }

  const trips = []
  for (let n = 0; n < ids.length + 3 && found().length < ids.length; n++) {
    if (!(await run(120, () => W.collectibles.adrift.length > 0))) fail(`nothing adrift within 120 s of world time (trip ${n + 1})`)
    const took = W.collectibles.adrift.map((i) => i.id), before = found()
    if (aria(send) !== 'false') fail(`the menu does not offer the boat with ${took} adrift`)
    await input({ click: at(send) })
    if (W.boat.state === 'moored') fail(`Send the boat did not send it (trip ${n + 1})`)
    if (found().length !== before.length) fail('a page was recorded before the boat came home')
    if (!(await run(400, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
    await frame()
    const after = found(), gained = after.filter((id) => !before.includes(id))
    if (!same(gained, took) || after.length !== before.length + took.length) fail(`a return filled other pages: the boat took ${took}, the book gained ${gained}`)
    if (!new RegExp(`Pages found: ${after.length} of ${ids.length}\\.`).test(status.textContent)) fail(`the menu does not count the pages: "${status.textContent}"`)
    if (h.book.complete !== (after.length === ids.length)) fail(`complete is ${h.book.complete} with ${after.length} of ${ids.length} found`)
    trips.push({ took, found: after.length })
    if (n === 0 && after.length < ids.length) {   // the book before the list is complete
      await input({ click: at(opener) })
      const d = dlg()
      if (!d?.open || !new RegExp(`Page 1 of ${ids.length}`).test(position()) || complete()) fail(`the book after the first trip: open ${d?.open}, "${position()}", complete "${complete()}"`)
      for (let i = 0; i < ids.length - 1; i++) await input({ click: at(named(d, 'Next')) })
      if (!new RegExp(`Page ${ids.length} of ${ids.length}`).test(position()) || aria(named(d, 'Next')) !== 'true') fail(`Next did not stop at the last page: "${position()}"`)
      out.push({ by: 'book while incomplete', position: position(), complete: complete() || null, filled: after.length })
      await input({ key: 'Escape' })
    }
  }
  if (found().length !== ids.length) fail(`not every page found after ${trips.length} trips: ${found()}`)
  if (!trips.some((t) => t.took.some((id) => items.find((i) => i.id === id).kind === 'diorama'))) fail(`no trip took the diorama: ${JSON.stringify(trips)}`)
  if (!h.book.complete) fail('every page is found but the book is not complete')
  out.push({ by: 'trips', trips })

  await input({ click: at(opener) })
  const d = dlg(), titles = [], states = [], next = named(d, 'Next'), prev = named(d, 'Previous')
  if (!d.open || !new RegExp(`Page 1 of ${ids.length}`).test(position())) fail(`the complete book did not open on page 1: "${position()}"`)
  if (complete() !== 'Every page is found.') fail(`the complete book does not say so: "${complete()}"`)
  for (let i = 0; i < ids.length; i++) {
    titles.push(page().querySelector('h3')?.textContent.trim()); states.push(page().dataset.state)
    if (i < ids.length - 1) await input({ click: at(next) })
  }
  if (states.some((s) => s !== 'filled') || new Set(titles).size !== ids.length || titles.some((t) => !t)) fail(`the pages are not each filled and distinct: ${JSON.stringify(titles)} ${states}`)
  await input({ click: at(next) })
  if (!new RegExp(`Page ${ids.length} of ${ids.length}`).test(position()) || aria(next) !== 'true') fail(`Next went past the last page: "${position()}"`)
  if (aria(prev) !== 'false') fail('Previous is not available on the last page')
  out.push({ by: 'complete book', titles, complete: complete(), position: position() })
  return JSON.stringify(out)
})()
