// Two whole visits in a row, by the player's own controls (the probe's window.__input: the browser's clicks and keys),
// the way the brief's core loop runs: sit at the sea chair, the visit's item comes adrift, Send the boat brings it home
// and its page is found, the book summons it into the pool, Go home ends the visit, and on the next one the player sits
// again, a different item the book has not found comes adrift, and the boat fills its page too. Across the two visits
// the book keeps its pages, the pool keeps what was summoned, nothing comes adrift before the player sits, and the same
// page loaded again (a hidden frame sharing the storage) has both pages found and the item floating. The hook steps the
// world's clock and reads the state; the presses are the player's. Start from an empty store.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const input = async (...steps) => { await window.__input(steps); await frame() }
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
  const until = async (ms, done) => { const end = performance.now() + ms; while (!done() && performance.now() < end) await wait(50); return done() }
  const dlg = () => [...document.querySelectorAll('dialog')].find((d) => d.querySelector('h1, h2, h3')?.textContent.trim() === 'Book')
  const found = () => h.book.pages.filter((p) => p.found).map((p) => p.id)
  const out = []
  await wait(500)
  if (found().length || h.summoned().length) fail(`run this from an empty store: found ${found()}, summoned ${h.summoned().length}`)

  const sit = async () => {
    if (await run(30, () => W.collectibles.adrift.length > 0)) fail(`something came adrift before the player sat (visit ${h.state().visits})`)
    h.sit(1)   // the sea chair
    if (!await until(6000, () => $('.seat-ui dialog')?.open)) fail('the seated panel did not open')
  }
  const fetch = async () => {
    if (!(await run(60, () => W.collectibles.adrift.length > 0))) fail(`nothing came adrift within 60 s of sitting (visit ${h.state().visits})`)
    const took = W.collectibles.adrift.map((i) => i.id), before = found()
    if (took.length !== 1 || before.includes(took[0])) fail(`visit ${h.state().visits} brought ${took} with ${before} already found`)
    await input({ click: at($('.seat-ui .seat-send')) })
    if (W.boat.state === 'moored') fail('Send the boat did not send it')
    if (!(await run(400, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
    const gained = found().filter((id) => !before.includes(id))
    if (gained.join() !== took.join()) fail(`the boat took ${took}, the book gained ${gained}`)
    return took[0]
  }

  // a seat chosen and left by Escape before the player gets there is not sitting: nothing comes adrift for it
  h.sit(1); await input({ key: 'Escape' })
  if (h.seating.state.phase !== 'standing') fail(`Escape on the way to the seat did not stand: ${h.seating.state.phase}`)
  if (await run(60, () => W.collectibles.adrift.length > 0)) fail('an item came adrift for a seat the player never reached')
  out.push({ cancelled: 'nothing adrift 60 s after a seat left on the way' })

  // the first visit
  await sit()
  const first = await fetch()
  await input({ click: at($('.seat-ui .seat-book')) })
  if (!dlg()?.open) fail('Open the book did not open it')
  const summon = dlg().querySelector('.book-summon')
  if (summon.textContent.trim() !== 'Summon into the pool' || summon.getAttribute('aria-disabled') !== 'false') fail(`the found page cannot summon: "${summon.textContent.trim()}"`)
  await input({ click: at(summon) })
  if (h.summoned().map((i) => i.id).join() !== first) fail(`the book did not summon ${first}: ${JSON.stringify(h.summoned())}`)
  await input({ key: 'Escape' })
  if (dlg().open) fail('Escape did not close the book')
  out.push({ visit: h.state().visits, found: first, summoned: h.summoned().map((i) => i.id) })

  // Go home, and the next visit
  const visits = h.state().visits
  await input({ click: at($('.seat-ui .seat-home')) })
  if (!h.state().home) fail('Go home did not start the scene')
  if (!await until(8000, () => !h.state().home)) fail(`the scene never ended: ${JSON.stringify(h.state().home)}`)
  if (h.state().visits !== visits + 1) fail(`visits ${visits} -> ${h.state().visits}`)
  if (W.collectibles.adrift.length) fail(`the new visit starts with ${W.collectibles.adrift.map((i) => i.id)} adrift`)
  if (W.boat.state !== 'moored') fail(`the boat is not home at the new visit: ${W.boat.state}`)
  if (h.summoned().map((i) => i.id).join() !== first || h.summoned()[0].state !== 'floating') fail(`the pool lost what was summoned: ${JSON.stringify(h.summoned())}`)
  if (found().join() !== first) fail(`the book changed over Go home: ${found()}`)

  // the second visit
  await sit()
  const second = await fetch()
  if (second === first) fail('the second visit brought the first item again')
  if (h.summoned().map((i) => i.id).join() !== first) fail(`the second fetch changed the pool: ${JSON.stringify(h.summoned())}`)
  out.push({ visit: h.state().visits, found: second, pages: found() })

  // the same page loaded again keeps both pages and the pool
  for (let s = 0; s < 8; s++) { h.step(60); await frame() }   // past the book's save
  const frameEl = Object.assign(document.createElement('iframe'), { src: location.href, style: 'position:fixed;left:0;top:0;width:480px;height:320px;opacity:0;pointer-events:none' })
  document.body.append(frameEl)
  let next = null
  for (let t = 0; t < 60 && !next; t++) { await wait(250); next = frameEl.contentWindow?.__pool }
  if (!next) fail('the page did not load a second time')
  for (let t = 0; t < 20 && !next.summoned().length; t++) await wait(250)
  const reFound = next.book.pages.filter((p) => p.found).map((p) => p.id).sort(), reSummoned = next.summoned().map((i) => i.id)
  frameEl.remove()
  if (reFound.join() !== [first, second].sort().join() || reSummoned.join() !== first) fail(`the reload lost the visits: found ${reFound}, summoned ${reSummoned}`)
  out.push({ reload: { found: reFound, summoned: reSummoned } })
  return JSON.stringify(out)
})()
