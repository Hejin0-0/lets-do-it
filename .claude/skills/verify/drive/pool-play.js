// The play controls by their real buttons, with the hook stepping the world's clock: Race sends ducks down the flume and
// the board follows them to the end; a flyer lost at sea brings up Send the boat, which fetches it home; the Book shows
// the stamps the island earned on the way, the twelve designs and the records, and Escape puts it away.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const run = async (secs, done) => { for (let s = 0; s < secs && !done(); s++) { h.step(120); if (s % 5 === 4) await frame() } await frame(); return done() }
  await wait(500)
  if (W.ducks.length < 4) h.add(4 - W.ducks.length)
  for (let k = 0; k < 20 && !W.race.running; k++) { $('.pool .race').click(); if (!W.race.running) await run(3, () => false) }
  if (!W.race.running) fail(`Race did not start: ${W.ducks.map((d) => d.state).join(',')}`)
  await frame()
  const racers = W.race.ids.length
  if ($('.pool .race-board').hidden || $('.pool .race-board ol').children.length !== racers) fail('the race board does not show the racers')
  if (!(await run(620, () => !W.race.running))) fail(`the race did not end: t ${W.race.t}`)
  const results = W.race.results.map((r) => r.place), winner = W.race.results.find((r) => r.place === 1)
  if (winner && !/wins the race/.test($('.pool .notice').textContent)) fail(`no winner notice: "${$('.pool .notice').textContent}"`)
  const n0 = W.ducks.length; h.addFlyer(); const fly = W.ducks[W.ducks.length - 1]
  if (!(await run(20 * 60, () => fly.state === 'sea'))) fail(`the flyer did not go out to sea: ${fly.state}`)
  const boat = $('.pool .boat')
  if (boat.hidden || !/Send the boat \(\d+\)/.test(boat.textContent)) fail(`no boat button: hidden ${boat.hidden}, "${boat.textContent}"`)
  boat.click(); await frame()
  if (W.boat.state === 'moored' || !boat.disabled) fail('Send the boat did not send it')
  if (!(await run(400, () => W.boat.state === 'moored'))) fail(`the boat did not come home: ${W.boat.state}`)
  if (fly.state === 'sea' || !W.ducks.includes(fly) || !boat.hidden) fail(`the flyer was not fetched: ${fly.state}`)
  $('.pool .book-open').click(); await frame()
  const book = $('.pool .book'), stamps = [...book.querySelectorAll('.stamp')], earned = book.querySelectorAll('.stamp.earned').length
  if (book.hidden || stamps.length !== 12 || book.querySelectorAll('.seen img').length !== 12) fail(`the book: hidden ${book.hidden}, ${stamps.length} stamps`)
  if (earned < 3 || !h.book.stamps.find((s) => s.id === 'rescue').earned) fail(`stamps earned: ${h.book.stamps.filter((s) => s.earned).map((s) => s.id)}`)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await frame()
  if (!book.hidden) fail('Escape did not close the book')
  return JSON.stringify({ racers, results, raceT: Math.round(W.race.t), ducks: [n0, W.ducks.length], earned, stamps: h.book.stamps.filter((s) => s.earned).map((s) => s.id) })
})()
