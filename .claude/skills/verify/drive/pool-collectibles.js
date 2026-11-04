// The whole list of collectibles, by the player's own controls (the probe's window.__input: the browser's own taps and
// clicks). From an empty store the list is six items in the book's order, three bottles and three dioramas. Nothing comes
// adrift before the player sits; each visit (a world reset stands for the next one) brings one item the book has not
// found, where the sea chair sees it, and nothing more; the seated menu's Send the boat fetches it, and what comes home
// fills exactly its page: no other page, no page twice, and the book says the list is complete only after the last one. The book, opened
// by Open the book, shows one page for each item in the list's order, empty ones before and filled ones after, and "Every
// page is found." only when every page is: the open book says so the moment the last page comes home. The hook steps the world's clock and reads the state; the clicks are the player's.
// Start from an empty store. window.__shot = 'sea' stops with the visit's item adrift as the sea chair sees it (for its
// screenshot); otherwise it ends with the complete book open on its last page, the six decided titles (for the book's).
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
  const items = W.collectibles.list, ids = items.map((i) => i.id), kinds = items.map((i) => i.kind)
  if (ids.length !== 6 || new Set(ids).size !== 6 || ids[0] !== 'bottle-first' || kinds.filter((k) => k === 'bottle').length !== 3 || kinds.filter((k) => k === 'diorama').length !== 3) fail(`the list is not six stable ids, three bottles and three dioramas: ${JSON.stringify(items.map((i) => [i.id, i.kind]))}`)
  if (JSON.stringify(h.book.pages.map((p) => p.id)) !== JSON.stringify(ids)) fail(`the book's pages are not the list: ${JSON.stringify(h.book.pages.map((p) => p.id))}`)
  if (h.book.complete) fail('an empty book says it is complete')
  out.push({ by: 'list', items: items.map((i) => `${i.id} (${i.kind})`) })
  if (await run(60, () => W.collectibles.adrift.length > 0)) fail('something came adrift before the player sat down')
  h.sit(1); await wait(1600)   // the sea chair
  const send = $('.seat-ui .seat-send'), status = $('.seat-ui .seat-boat'), opener = $('.seat-ui .seat-book')
  const onScreen = (i) => { const p = h.toPx([i.at[0], W.boat.p[1], i.at[1]]); return !!p && p[0] >= 0 && p[0] <= innerWidth && p[1] >= 0 && p[1] <= innerHeight }

  if (window.__shot === 'sea') {   // as the sea chair sees it: the visit's item adrift
    if (!(await run(50, () => W.collectibles.adrift.length > 0))) fail('nothing came adrift within 50 s of sitting down')
    if (!onScreen(W.collectibles.adrift[0])) fail('the item is not where the sea chair sees it')
    await run(3, () => false)
    out.push({ by: 'sea', adrift: W.collectibles.adrift.map((i) => i.id) })
    return JSON.stringify(out)
  }

  const trips = []
  for (let n = 0; n < ids.length + 3 && found().length < ids.length; n++) {
    if (n > 0) {   // a new visit: the book keeps its pages, the sea starts empty, and the next item comes once the player sits
      h.seating.stand('hook'); await frame(); W.reset({ visit: 7000 + n }); h.sit(1); await wait(1600)
    }
    if (!(await run(50, () => W.collectibles.adrift.length > 0))) fail(`nothing came adrift within 50 s of sitting down (visit ${n + 1})`)
    const took = W.collectibles.adrift.map((i) => i.id), before = found()
    if (took.length !== 1 || before.includes(took[0])) fail(`a visit brought ${took}, with ${before} already found`)
    if (!onScreen(W.collectibles.adrift[0])) fail(`${took[0]} is not where the sea chair sees it`)
    if (aria(send) !== 'false') fail(`the menu does not offer the boat with ${took} adrift`)
    await input({ click: at(send) })
    if (W.boat.state === 'moored') fail(`Send the boat did not send it (visit ${n + 1})`)
    if (found().length !== before.length) fail('a page was recorded before the boat came home')
    const last = before.length + took.length === ids.length   // this trip fills the book: watch it happen with the book open
    if (last) {
      await input({ click: at(opener) })
      if (!dlg()?.open || complete()) fail(`the book open before the last return: open ${dlg()?.open}, complete "${complete()}"`)
    }
    if (!(await run(400, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
    await frame()
    if (last) {
      if (!dlg().open || complete() !== 'Every page is found.') fail(`the open book did not say it was complete when the last page came home: "${complete()}"`)
      out.push({ by: 'completed in the open book', complete: complete(), position: dlg().querySelector('.book-position')?.textContent })
      await input({ key: 'Escape' })
    }
    const after = found(), gained = after.filter((id) => !before.includes(id))
    if (!same(gained, took) || after.length !== before.length + took.length) fail(`a return filled other pages: the boat took ${took}, the book gained ${gained}`)
    if (!new RegExp(`Pages found: ${after.length} of ${ids.length}\\.`).test(status.textContent)) fail(`the menu does not count the pages: "${status.textContent}"`)
    if (h.book.complete !== (after.length === ids.length)) fail(`complete is ${h.book.complete} with ${after.length} of ${ids.length} found`)
    if (await run(60, () => W.collectibles.adrift.length > 0)) fail(`a second item came adrift in visit ${n + 1}`)
    trips.push({ took: took[0], found: after.length })
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
  if (found().length !== ids.length || trips.length !== ids.length) fail(`not one new page a visit until the book was full: ${JSON.stringify(trips)}`)
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
  const decided = ['Sailboat in a bottle', 'Steamboat in a bottle', 'Pirate ship in a bottle', 'Volcano island', 'Jungle island', 'Snowy island']
  if (states.some((s) => s !== 'filled') || JSON.stringify(titles) !== JSON.stringify(decided)) fail(`the pages are not the decided six, each filled: ${JSON.stringify(titles)} ${states}`)
  await input({ click: at(next) })
  if (!new RegExp(`Page ${ids.length} of ${ids.length}`).test(position()) || aria(next) !== 'true') fail(`Next went past the last page: "${position()}"`)
  if (aria(prev) !== 'false') fail('Previous is not available on the last page')
  out.push({ by: 'complete book', titles, complete: complete(), position: position() })
  return JSON.stringify(out)
})()
