// The play controls by their real buttons, with the hook stepping the world's clock: Race sends ducks down the flume and
// the island at the top follows them, then names the winner; a flyer lost at sea puts "Send the boat" in the island,
// which fetches it home; the Book's three pages show the stamps the island earned on the way, the twelve designs and the
// records, and Escape puts it away.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  const isl = (kind) => $(`.pool .isl[data-kind="${kind}"]`)
  const notices = () => [...document.querySelectorAll('.pool .isl[data-kind="notice"]')].map((e) => e.textContent).join(' | ')
  const until = async (ok, ms) => { for (let t = 0; t < ms; t += 100) { if (ok()) return true; await wait(100) } return ok() }
  await wait(500)
  if (W.ducks.length < 4) h.add(4 - W.ducks.length)
  for (let k = 0; k < 20 && !W.race.running; k++) { $('.pool .dock .race').click(); if (!W.race.running) await run(3, () => false) }
  if (!W.race.running) fail(`Race did not start: ${W.ducks.map((d) => d.state).join(',')}`)
  await frame()
  const racers = W.race.ids.length
  if (!isl('race') || !/^Race \d+:\d\d/.test(isl('race').textContent) || $('.pool .dock .race').dataset.running !== '1') fail(`the island does not show the race: "${$('.pool .island').textContent}"`)
  if (!(await run(620, () => !W.race.running))) fail(`the race did not end: t ${W.race.t}`)
  const results = W.race.results.map((r) => r.place)
  if (!(await until(() => / wins|No one finished/.test(notices()), 4000))) fail(`no word of the winner within the notice before it: "${notices()}"`)   // a stamp shown already keeps its 3 s
  const n0 = W.ducks.length; h.addFlyer(); const fly = W.ducks[W.ducks.length - 1]
  if (!(await run(20 * 60, () => fly.state === 'sea'))) fail(`the flyer did not go out to sea: ${fly.state}`)
  const send = isl('sea')?.querySelector('.act')
  if (!send || !/at sea/.test(isl('sea').textContent)) fail(`no "Send the boat" in the island: "${$('.pool .island').textContent}"`)
  send.click(); await frame()
  if (W.boat.state === 'moored' || !isl('boat')) fail('Send the boat did not send it')
  if (!(await run(400, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
  if (fly.state === 'sea' || !W.ducks.includes(fly) || isl('sea') || isl('boat')) fail(`the flyer was not fetched: ${fly.state}`)
  $('.pool .book-open').click(); await frame()
  const book = $('.pool .book'), tab = async (t) => { book.querySelector(`.seg [data-tab="${t}"]`).click(); await frame() }
  const earned = book.querySelectorAll('.stamp.earned').length
  if (book.hidden || book.querySelectorAll('.stamp').length !== 12) fail(`the book: hidden ${book.hidden}, ${book.querySelectorAll('.stamp').length} stamps`)
  if (earned < 3 || !h.book.stamps.find((s) => s.id === 'rescue').earned) fail(`stamps earned: ${h.book.stamps.filter((s) => s.earned).map((s) => s.id)}`)
  await tab('ducks')
  if (book.querySelectorAll('.seen img').length !== 12 || !book.querySelectorAll('.met button').length) fail('the Ducks page shows no designs or ducks')
  await tab('records')
  if (book.querySelectorAll('.stat').length !== 3 || !/Races won/.test(book.textContent)) fail('the Records page shows no records')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await frame()
  if (!book.hidden) fail('Escape did not close the book')
  return JSON.stringify({ racers, results, raceT: Math.round(W.race.t), ducks: [n0, W.ducks.length], earned, stamps: h.book.stamps.filter((s) => s.earned).map((s) => s.id) })
})()
