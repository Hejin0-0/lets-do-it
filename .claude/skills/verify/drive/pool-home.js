// Go home, by the player's own controls (the probe's window.__input: the browser's clicks and keys). Seated, the panel
// has Go home; a click on it closes the panel and stands the player, the screen darkens over the evening with "See you
// tomorrow." heard, and while it plays a key moves nothing, M leaves the sound as it was and Escape does not stop it. Then a new visit starts in the
// same page: visits counts it, the clock is back at the afternoon and running, the player stands, the book keeps its
// finds and what it keeps in the pool, and those items float in the pool again. The hook's reset takes the same path,
// so the book and the pool still agree after it. Start from an empty store; the hook marks two pages found and summons
// one item, the rest is the player's. window.__shot = 'dusk' stops mid-scene, with the line showing.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const input = async (...steps) => { await window.__input(steps); await frame() }
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
  const until = async (ms, done) => { const end = performance.now() + ms; while (!done() && performance.now() < end) await wait(50); return done() }
  const floating = () => W.summons.list.filter((s) => s.state === 'floating').map((s) => s.id).sort().join()
  const view = () => [h.cam.target.slice(), h.cam.az, h.cam.el, h.cam.dist].flat()
  const out = {}

  const ids = h.book.pages.slice(0, 2).map((p) => p.id)
  h.book.observe(W, [{ type: 'collected', ids }]); W.collectibles.setCollected(ids)
  W.summon(ids[0]); await frame(); await frame()
  if (h.book.inPool.join() !== ids[0] || floating() !== ids[0]) fail(`setup: ${JSON.stringify({ inPool: h.book.inPool, list: W.summons.list })}`)

  h.sit(0)
  if (!await until(6000, () => $('.seat-ui dialog')?.open)) fail('the panel did not open on sitting')
  const button = $('.seat-ui .seat-home')
  if (!button || button.textContent.trim() !== 'Go home') fail('no Go home in the seated panel')
  if (!$('.seat-ui dialog').open) fail('the panel is not open')
  out.visitsBefore = h.state().visits
  await input({ click: at(button) })
  const s1 = h.state()
  if (!s1.home || s1.home.phase !== 'dusk') fail(`the scene did not start: ${JSON.stringify(s1.home)}`)
  if ($('.seat-ui dialog').open) fail('the panel stayed open')
  if (h.seating.state.phase !== 'standing') fail(`not standing: ${h.seating.state.phase}`)
  if (![...document.querySelectorAll('[aria-live]')].some((e) => e.textContent.trim() === 'See you tomorrow.')) fail('no live line "See you tomorrow."')
  if (window.__shot === 'dusk') { await wait(1200); return JSON.stringify({ shot: 'dusk', home: h.state().home }) }
  const gap = (a) => Math.max(...view().map((v, i) => Math.abs(v - a[i])))
  await wait(700)   // standing up eases the view back to the overview: how far it still drifts on its own, then with W held
  const hourMid = h.state().hour, still = view(); await wait(300); out.drift = gap(still)
  const before = view(), heard = h.state().sound; await input({ down: 'w' }); await wait(300); await input({ up: 'w' }, { key: 'Escape' }, { key: 'm' })
  const s2 = h.state()
  if (!s2.home) fail('Escape stopped the scene')
  if (s2.sound !== heard) fail('M changed the sound during the scene')
  out.moved = gap(before)
  if (s2.home.phase === 'dusk' && out.moved > out.drift * 1.5 + 1e-3) fail(`a key moved the view during the scene: ${out.moved} (drifting ${out.drift})`)
  out.hourRan = +(s2.hour - hourMid).toFixed(2)

  if (!await until(8000, () => !h.state().home)) fail(`the scene never ended: ${JSON.stringify(h.state().home)}`)
  const s3 = h.state()
  Object.assign(out, { visits: s3.visits, hour: s3.hour, clock: s3.clock, inPool: h.book.inPool, floating: floating(), found: h.book.pages.filter((p) => p.found).map((p) => p.id) })
  if (s3.visits !== out.visitsBefore + 1) fail(`visits ${out.visitsBefore} -> ${s3.visits}`)
  if (Math.abs(s3.hour - 15) > 0.3 || !s3.clock) fail(`the new visit's clock: ${s3.hour} ${s3.clock}`)
  if (out.found.join() !== ids.join()) fail(`the book lost its finds: ${out.found}`)
  if (h.book.inPool.join() !== ids[0] || floating() !== ids[0]) fail(`the pool after going home: ${JSON.stringify(out)}`)
  if ($('.seat-ui dialog').open || h.seating.state.phase !== 'standing') fail('the new visit did not start standing')

  h.reset(); await frame()
  out.afterReset = { visits: h.state().visits, inPool: h.book.inPool, floating: floating() }
  if (out.afterReset.visits !== s3.visits + 1 || out.afterReset.floating !== ids[0] || h.book.inPool.join() !== ids[0]) fail(`reset: ${JSON.stringify(out.afterReset)}`)
  return JSON.stringify(out)
})()
