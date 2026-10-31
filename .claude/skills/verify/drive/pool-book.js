// The book, by the player's own controls. Seated, Open the book shows one page per item of the fixed list: from an empty
// store the first bottle's page is empty, Previous and Next stop at both ends, a world key pressed in the book moves
// nothing, and Escape closes it and gives focus back to Open the book without standing up. The boat sent for the bottle
// comes home while the book is open, and the page fills there; it is still filled when the book is opened again. The
// hook seats the player and steps the world's clock; the presses are the player's. Start from an empty store.
// window.__shot = 'empty' stops with the empty book open, for its screenshot; otherwise it ends with the filled book open.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const key = (code, k) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { code, key: k, bubbles: true, cancelable: true }))
  const named = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
  const dlg = () => [...document.querySelectorAll('dialog')].find((d) => d.querySelector('h1, h2, h3')?.textContent.trim() === 'Book')
  const page = () => dlg().querySelector('[data-state]'), status = () => dlg().querySelector('[role="status"]').textContent.trim()
  const item = () => W.collectibles.list.find((c) => c.id === 'bottle-first')
  const out = []
  await wait(500)
  if (h.book.found('bottle-first')) fail('the book already holds the first bottle: run this from an empty store')
  h.sit(1); await wait(1600)   // the sea chair
  const opener = $('.seat-ui .seat-book')
  if (!opener || opener.textContent.trim() !== 'Open the book') fail('the seated menu has no Open the book')

  opener.focus(); opener.click(); await frame()
  const d = dlg()
  if (!d?.open || !d.matches(':modal')) fail('Open the book did not open the book as a modal dialog')
  if (document.activeElement !== named(d, 'Close the book')) fail(`focus is not on Close the book: "${document.activeElement.textContent}"`)
  const prev = named(d, 'Previous'), next = named(d, 'Next')
  if (!/Page 1 of 1/.test(status()) || page().dataset.state !== 'empty' || /First bottle/.test(page().textContent)) fail(`not one empty page: "${status()}", ${page().dataset.state}, "${page().textContent}"`)
  if (prev.getAttribute('aria-disabled') !== 'true' || next.getAttribute('aria-disabled') !== 'true') fail('Previous and Next are not both at an end on the one page')
  prev.click(); next.click(); next.focus(); key('Enter', 'Enter'); await frame()
  if (h.bookView.index !== 0 || !/Page 1 of 1/.test(status())) fail(`a press at an end moved the book: ${h.bookView.index}, "${status()}"`)
  out.push({ by: 'opened', status: status(), state: page().dataset.state, text: page().textContent.trim() })

  const eye = h.cam.target.slice()
  named(d, 'Close the book').focus(); key('KeyW', 'w'); await wait(400)
  document.activeElement.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true })); await frame()
  if (h.seating.state.phase !== 'seated' || Math.hypot(...h.cam.target.map((v, i) => v - eye[i])) > 1e-6) fail('W pressed in the book reached the world')
  if (window.__shot === 'empty') return JSON.stringify(out)

  key('Escape', 'Escape'); await frame()
  if (d.open || document.activeElement !== opener || h.seating.state.phase !== 'seated') fail(`Escape did not just close the book: open ${d.open}, focus "${document.activeElement.textContent}", ${h.seating.state.phase}`)
  out.push({ by: 'Escape', focus: document.activeElement.textContent.trim(), phase: h.seating.state.phase })

  if (!(await run(60, () => item().state === 'adrift'))) fail(`no bottle adrift within 60 s of world time: ${item().state}`)
  $('.seat-ui .seat-send').click(); await frame()
  if (W.boat.state === 'moored') fail('Send the boat did not send it')
  opener.click(); await frame()
  if (!d.open || page().dataset.state !== 'empty') fail('the book did not open empty while the boat was out')
  if (!(await run(600, () => W.boat.state === 'moored' && item().state === 'collected'))) fail(`the boat did not bring the bottle home: ${W.boat.state}, ${item().state}`)
  await frame()
  if (page().dataset.state !== 'filled' || !/First bottle/.test(page().textContent)) fail(`the open book did not fill its page: ${page().dataset.state}, "${page().textContent}"`)
  out.push({ by: 'boat home, book open', status: status(), state: page().dataset.state, text: page().textContent.trim() })

  key('Escape', 'Escape'); await frame(); opener.click(); await frame()
  if (!d.open || page().dataset.state !== 'filled' || !/Page 1 of 1/.test(status())) fail(`reopened, the page is not filled: ${page().dataset.state}, "${status()}"`)
  out.push({ by: 'reopened', status: status(), state: page().dataset.state, text: page().textContent.trim() })
  return JSON.stringify(out)
})()
