// The first bottle, by the player's own control: once it is adrift, the seated menu's Send the boat sends the boat out
// to it and home again, and afterwards the book holds its page and the pages of whatever else was adrift and went with
// it, and no other (nor twice, however often the boat is sent). The hook steps the world's clock and reads the state; the
// click is the player's. Start from an empty store.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const item = () => W.collectibles.list.find((c) => c.id === 'bottle-first')
  const pages = () => h.book.pages.filter((p) => p.found).length, total = h.book.pages.length, foundIds = () => h.book.pages.filter((p) => p.found).map((p) => p.id).sort()
  await wait(500)
  if (h.book.found('bottle-first')) fail('the book already holds the first bottle: run this from an empty store')
  if (!(await run(60, () => item().state === 'adrift'))) fail(`no bottle adrift within 60 s of world time: ${item().state}`)
  const at = item().at.slice(), took = W.collectibles.adrift.map((c) => c.id).sort()   // the boat takes everything adrift when it sets out
  h.sit(1); await wait(1600)   // the sea chair
  const send = $('.seat-ui .seat-send'), status = $('.seat-ui .seat-boat')
  if (send.getAttribute('aria-disabled') !== 'false' || !/adrift/.test(status.textContent)) fail(`the menu does not offer the boat: "${status.textContent}"`)
  send.click(); await frame()
  if (W.boat.state === 'moored' || send.getAttribute('aria-disabled') !== 'true' || !/out/.test(status.textContent)) fail(`Send the boat did not send it: ${W.boat.state}, "${status.textContent}"`)
  const near = Math.hypot(W.boat.p[0] - at[0], W.boat.p[2] - at[1])
  if (!(await run(300, () => item().state === 'aboard'))) fail(`the boat did not reach the bottle: ${item().state}`)
  if (pages() !== 0) fail('a page was recorded before the boat came home')
  if (!(await run(300, () => W.boat.state === 'home'))) fail(`the boat did not turn for home: ${W.boat.state}`)
  if (pages() !== 0 || item().state !== 'aboard') fail(`the page was recorded on the way home: ${pages()} pages, ${item().state}`)
  if (!(await run(300, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
  await frame()
  if (item().state !== 'collected' || !h.book.found('bottle-first') || JSON.stringify(foundIds()) !== JSON.stringify(took)) fail(`the pages were not recorded: ${item().state}, found ${foundIds()}, the boat took ${took}`)
  if (!new RegExp(`Pages found: ${took.length} of ${total}\\.`).test(status.textContent)) fail(`the menu does not count the pages: "${status.textContent}"`)
  // sending again: with nothing else adrift it changes nothing; with another item adrift the boat goes for that one alone,
  // and the first bottle's page is not counted twice
  const others = W.collectibles.adrift.map((c) => c.id).sort()
  send.click(); await frame()
  if (!others.length) {
    const again = W.sendBoat()
    if (again || W.boat.state !== 'moored' || JSON.stringify(foundIds()) !== JSON.stringify(took)) fail(`sending again changed something: ${again}, ${W.boat.state}, found ${foundIds()}`)
  } else {
    if (W.boat.state === 'moored') fail(`${others} adrift but the boat did not go`)
    if (!(await run(400, () => W.boat.state === 'moored'))) fail(`the boat did not come home again: ${W.boat.state}`)
    await frame()
    if (JSON.stringify(foundIds()) !== JSON.stringify([...took, ...others].sort()) || item().state !== 'collected') fail(`the second trip miscounted: found ${foundIds()}, expected ${[...took, ...others].sort()}`)
  }
  return JSON.stringify({ at: at.map((v) => +v.toFixed(2)), startDist: +near.toFixed(2), took, others, state: item().state, pages: pages(), status: status.textContent })
})()
