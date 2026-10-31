// The book, by the player's own input (the probe's window.__input: the browser's own taps, clicks and keys). Seated, a
// tap on Open the book opens one page per item of the fixed list: from an empty store the first bottle's page is empty.
// Tab and Shift+Tab walk Close the book, Next and Previous; Enter, Space and clicks at either end change nothing; nothing
// is written to the page while nothing changes. W and R pressed in the book, or after a click on its backdrop (focus
// leaves the book), move nothing. Escape closes only the book and gives focus back to Open the book; Enter and a click
// open and close it too. The boat sent for the bottle comes home while the book is open and the page fills there.
// Standing up with the book open closes it and leaves focus on nothing hidden; sitting again, the page is still filled.
// The hook seats the player and steps the world's clock. Start from an empty store. window.__shot = 'empty' stops with
// the empty book open, for its screenshot; otherwise it ends with the filled book open.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const input = async (...steps) => { await window.__input(steps); await frame() }
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
  const named = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
  const dlg = () => [...document.querySelectorAll('dialog')].find((d) => d.querySelector('h1, h2, h3')?.textContent.trim() === 'Book')
  const page = () => dlg().querySelector('[data-state]'), status = () => dlg().querySelector('[role="status"]').textContent.trim()
  const focus = () => document.activeElement?.textContent.trim() || document.activeElement?.tagName
  const item = () => W.collectibles.list.find((c) => c.id === 'bottle-first')
  const out = []
  await wait(500)
  if (h.book.found('bottle-first')) fail('the book already holds the first bottle: run this from an empty store')
  h.sit(1); await wait(1600)   // the sea chair
  const opener = $('.seat-ui .seat-book'), panel = $('.seat-ui dialog')
  if (!opener || opener.textContent.trim() !== 'Open the book') fail('the seated menu has no Open the book')

  await input({ tap: at(opener) })
  const d = dlg()
  if (!d?.open || !d.matches(':modal')) fail('a tap on Open the book did not open the book as a modal dialog')
  const prev = named(d, 'Previous'), next = named(d, 'Next'), close = named(d, 'Close the book')
  if (document.activeElement !== close) fail(`focus is not on Close the book: "${focus()}"`)
  await input({ key: 'Tab', shift: true }); const second = document.activeElement
  await input({ key: 'Tab', shift: true }); const third = document.activeElement
  if (second !== next || third !== prev) fail(`Shift+Tab from Close the book went to "${second.textContent}", then "${third.textContent}"`)
  if (!/Page 1 of 1/.test(status()) || page().dataset.state !== 'empty' || /First bottle/.test(page().textContent)) fail(`not one empty page: "${status()}", ${page().dataset.state}, "${page().textContent}"`)
  if (prev.getAttribute('aria-disabled') !== 'true' || next.getAttribute('aria-disabled') !== 'true') fail('Previous and Next are not both at an end on the one page')
  await input({ key: 'Enter' }, { key: 'Tab' }, { key: ' ' }, { click: at(prev) }, { click: at(next) })
  if (h.bookView.index !== 0 || !/Page 1 of 1/.test(status()) || !d.open) fail(`a press at an end moved or closed the book: ${h.bookView.index}, "${status()}", open ${d.open}`)
  let writes = 0; const watch = new MutationObserver((r) => { writes += r.length })
  watch.observe(d, { subtree: true, childList: true, attributes: true, characterData: true })
  for (let i = 0; i < 10; i++) await frame()
  watch.disconnect()
  if (writes) fail(`the open book was written ${writes} times while nothing changed`)
  out.push({ by: 'tap', status: status(), state: page().dataset.state, text: page().textContent.trim() })

  const eye = h.cam.target.slice(), still = () => h.seating.state.phase === 'seated' && d.open && Math.hypot(...h.cam.target.map((v, i) => v - eye[i])) < 1e-6
  await input({ down: 'w' }); await wait(400); await input({ up: 'w' }, { key: 'r' })
  if (!still()) fail(`W or R pressed in the book reached the world: ${h.seating.state.phase}, open ${d.open}`)
  await input({ click: [6, 6] }); const after = focus()   // the backdrop
  await input({ down: 'w' }); await wait(400); await input({ up: 'w' }, { key: 'r' })
  if (!still()) fail(`after a click on the backdrop (focus "${after}"), W or R reached the world: ${h.seating.state.phase}, open ${d.open}`)
  close.focus(); await input({ key: 'Tab' }); const past = document.activeElement === document.body ? 'BODY' : focus()   // past the last control, focus leaves the book
  await input({ down: 'w' }); await wait(400); await input({ up: 'w' }, { key: 'r' })
  if (!still()) fail(`with focus Tabbed out of the book (${past}), W or R reached the world: ${h.seating.state.phase}, open ${d.open}`)
  out.push({ by: 'keys in the book', backdropFocus: after, tabbedOut: past, phase: h.seating.state.phase })
  if (window.__shot === 'empty') return JSON.stringify(out)

  await input({ key: 'Escape' })
  if (d.open || document.activeElement !== opener || h.seating.state.phase !== 'seated') fail(`Escape did not just close the book: open ${d.open}, focus "${focus()}", ${h.seating.state.phase}`)
  await input({ key: 'Enter' }); const openedByEnter = d.open && document.activeElement === close
  await input({ key: 'Enter' }); const closedByEnter = !d.open && document.activeElement === opener
  await input({ click: at(opener) }); const openedByClick = d.open
  await input({ click: at(close) }); const closedByClick = !d.open && document.activeElement === opener
  if (!openedByEnter || !closedByEnter || !openedByClick || !closedByClick) fail(`Enter or a click did not open and close the book: ${openedByEnter} ${closedByEnter} ${openedByClick} ${closedByClick}`)
  out.push({ by: 'Escape, Enter, click', focus: focus(), phase: h.seating.state.phase })

  if (!(await run(60, () => item().state === 'adrift'))) fail(`no bottle adrift within 60 s of world time: ${item().state}`)
  await input({ click: at($('.seat-ui .seat-send')) })
  if (W.boat.state === 'moored') fail('Send the boat did not send it')
  opener.focus(); await input({ key: ' ' })
  if (!d.open || page().dataset.state !== 'empty') fail('Space on Open the book did not open it empty while the boat was out')
  if (!(await run(600, () => W.boat.state === 'moored' && item().state === 'collected'))) fail(`the boat did not bring the bottle home: ${W.boat.state}, ${item().state}`)
  await frame()
  if (page().dataset.state !== 'filled' || !/First bottle/.test(page().textContent)) fail(`the open book did not fill its page: ${page().dataset.state}, "${page().textContent}"`)
  out.push({ by: 'boat home, book open', status: status(), state: page().dataset.state, text: page().textContent.trim() })

  h.seating.stand('hook'); await frame(); await frame()
  if (d.open || d.contains(document.activeElement) || panel.contains(document.activeElement)) fail(`standing up left the book open or focus hidden: open ${d.open}, focus "${focus()}"`)
  out.push({ by: 'stood up', focus: focus() })
  h.sit(1); await wait(1600)
  await input({ click: at(opener) })
  if (!d.open || page().dataset.state !== 'filled' || !/Page 1 of 1/.test(status())) fail(`sitting again, the page is not filled: ${page().dataset.state}, "${status()}"`)
  out.push({ by: 'sat again', status: status(), state: page().dataset.state, text: page().textContent.trim() })
  return JSON.stringify(out)
})()
