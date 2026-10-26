// The dock and a picked duck's card, by their real buttons: Add a duck brings one more; the time slider sets the hour
// and stops the clock, the play button runs it; Names puts the tags up; a picked duck shows its card, whose design and
// wear change it, Follow follows it, the close button puts it down and Take it out takes it away; Help shows the hints.
(async () => {
  const h = window.__pool, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const until = async (ok, ms) => { for (let t = 0; t < ms; t += 50) { if (ok()) return true; await wait(50) } return ok() }
  const pressed = (s) => $(s).getAttribute('aria-pressed') === 'true'
  const n0 = h.state().ducks
  $('.pool .add').click()
  if (!(await until(() => h.state().ducks === n0 + 1, 5000))) fail(`Add a duck: ${n0} -> ${h.state().ducks}`)
  await wait(100)
  if ($('.pool .count').textContent !== `${n0 + 1} of 40`) fail(`the count reads "${$('.pool .count').textContent}"`)
  const r = $('#pool-hour')
  r.value = '20'; r.dispatchEvent(new Event('input', { bubbles: true })); await wait(150)
  if (Math.abs(h.state().hour - 20) > 0.01 || h.state().clock) fail(`the slider: hour ${h.state().hour}, clock ${h.state().clock}`)
  if ($('.pool .time output').textContent !== '20:00') fail(`the time reads "${$('.pool .time output').textContent}"`)
  $('.pool .run').click(); await wait(150)
  if (!h.state().clock || $('.pool .run').getAttribute('aria-label') !== 'Stop the clock') fail('the play button did not run the clock')
  $('.pool .run').click(); await wait(100)
  $('.pool .names').click(); await wait(250)
  if (!h.tags().length || !pressed('.pool .names')) fail('Names put no tags up')
  $('.pool .names').click(); await wait(250)
  if (h.tags().length) fail('Names did not take the tags down')
  h.select(0); await wait(150)
  const d = h.world.ducks[0]
  if ($('.pool .card').hidden || !$('.pool .card h2').textContent) fail('a picked duck shows no card')
  $('.pool .designs button[data-i="4"]').click(); await wait(150)
  if (d.colour !== 4 || !pressed('.pool .designs button[data-i="4"]')) fail(`the design: ${d.colour}`)
  $('.pool .hats button[data-i="2"]').click(); await wait(150)
  if (d.hat !== 2 || !pressed('.pool .hats button[data-i="2"]')) fail(`the wear: ${d.hat}`)
  $('.pool .follow').click(); await wait(150)
  if (!h.state().follow) fail('Follow it did not follow')
  $('.pool .follow').click(); await wait(100)
  $('.pool .close').click(); await wait(150)
  if (h.state().selected !== null || !$('.pool .card').hidden) fail('the close button did not put the duck down')
  h.select(0); await wait(150)
  const n1 = h.state().ducks
  $('.pool .remove').click(); await wait(150)
  if (h.state().ducks !== n1 - 1 || !$('.pool .card').hidden) fail('Take it out did not take the duck away')
  $('.pool .help-open').click(); await wait(100)
  if ($('.pool .help').hidden) fail('Help showed nothing')
  $('.pool .help-open').click()
  return JSON.stringify({ ducks: [n0, n0 + 1, n1 - 1], design: d.colour, hat: d.hat })
})()
