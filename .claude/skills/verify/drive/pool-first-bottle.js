// The visit's first find, by the player's own control. Nothing comes adrift before the player sits; seated in the sea
// chair, one item the book has not found comes adrift within the delay window, where the chair sees it (on screen). The
// seated menu's Send the boat sends the boat out to it and home again; the page is recorded only once the boat is home,
// and only that page; nothing else comes adrift that visit, and sending again changes nothing. The hook steps the
// world's clock and reads the state; the clicks are the player's. Start from an empty store.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const pages = () => h.book.pages.filter((p) => p.found).length, total = h.book.pages.length, foundIds = () => h.book.pages.filter((p) => p.found).map((p) => p.id).sort()
  await wait(500)
  if (pages()) fail('the book already holds a page: run this from an empty store')
  if (await run(60, () => W.collectibles.adrift.length > 0)) fail('something came adrift before the player sat down')
  h.sit(1); await wait(1600)   // the sea chair
  if (!(await run(50, () => W.collectibles.adrift.length > 0))) fail('nothing came adrift within 50 s of sitting down')
  const took = W.collectibles.adrift.map((c) => c.id), id = took[0], item = () => W.collectibles.list.find((c) => c.id === id)
  if (took.length !== 1) fail(`more than one item came adrift: ${took}`)
  const at = item().at.slice(), px = h.toPx([at[0], W.boat.p[1], at[1]])
  if (!px || px[0] < 0 || px[0] > innerWidth || px[1] < 0 || px[1] > innerHeight) fail(`the item is not where the sea chair sees it: ${px && px.map(Math.round)}`)
  const send = $('.seat-ui .seat-send'), status = $('.seat-ui .seat-boat')
  if (send.getAttribute('aria-disabled') !== 'false' || !/adrift/.test(status.textContent)) fail(`the menu does not offer the boat: "${status.textContent}"`)
  send.click(); await frame()
  if (W.boat.state === 'moored' || send.getAttribute('aria-disabled') !== 'true' || !/out/.test(status.textContent)) fail(`Send the boat did not send it: ${W.boat.state}, "${status.textContent}"`)
  const near = Math.hypot(W.boat.p[0] - at[0], W.boat.p[2] - at[1])
  if (!(await run(300, () => item().state === 'aboard'))) fail(`the boat did not reach the item: ${item().state}`)
  if (pages() !== 0) fail('a page was recorded before the boat came home')
  if (!(await run(300, () => W.boat.state === 'home'))) fail(`the boat did not turn for home: ${W.boat.state}`)
  if (pages() !== 0 || item().state !== 'aboard') fail(`the page was recorded on the way home: ${pages()} pages, ${item().state}`)
  if (!(await run(300, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
  await frame()
  if (item().state !== 'collected' || !h.book.found(id) || JSON.stringify(foundIds()) !== JSON.stringify([id])) fail(`the page was not recorded alone: ${item().state}, found ${foundIds()}`)
  if (!new RegExp(`Pages found: 1 of ${total}\\.`).test(status.textContent)) fail(`the menu does not count the page: "${status.textContent}"`)
  if (await run(90, () => W.collectibles.adrift.length > 0)) fail(`a second item came adrift in the same visit: ${W.collectibles.adrift.map((c) => c.id)}`)
  send.click(); await frame()
  const again = W.sendBoat()
  if (again || W.boat.state !== 'moored' || JSON.stringify(foundIds()) !== JSON.stringify([id])) fail(`sending again changed something: ${again}, ${W.boat.state}, found ${foundIds()}`)
  return JSON.stringify({ id, at: at.map((v) => +v.toFixed(2)), onScreen: px.map(Math.round), startDist: +near.toFixed(2), pages: pages(), status: status.textContent })
})()
