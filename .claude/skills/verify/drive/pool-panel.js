// The toolbar (out of sight until the mouse nears the bottom, gone again when it leaves) and a picked duck's card, by
// their real buttons: Add a duck brings one more; the hour opens a popover whose slider sets it and stops the clock and
// whose play button runs it, and Escape puts it away; Names puts the tags up; Help opens, and the hour's button opens
// in its place; a picked duck shows its card, whose design and wear change it, Follow follows it, the arrows step to the
// next duck, the close button puts it down and Take it out takes it away; after sunset the glass turns dark.
(async () => {
  const h = window.__pool, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const until = async (ok, ms) => { for (let t = 0; t < ms; t += 50) { if (ok()) return true; await wait(50) } return ok() }
  const pressed = (s) => $(s).getAttribute('aria-pressed') === 'true'
  const shown = () => { const r = $('.pool .dock').getBoundingClientRect(); return +getComputedStyle($('.pool .dock')).opacity > 0.9 && r.bottom <= innerHeight }
  const mouse = (y) => document.body.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: innerWidth / 2, clientY: y, bubbles: true }))
  const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  if (shown()) fail('the toolbar shows before the mouse comes near')
  mouse(innerHeight - 20); await wait(450)
  if (!shown()) fail('the toolbar did not come up with the mouse near the bottom')
  mouse(innerHeight / 3); await wait(1300)
  if (shown()) fail('the toolbar did not go when the mouse left')
  const n0 = h.state().ducks
  $('.pool .add').click()
  if (!(await until(() => h.state().ducks === n0 + 1, 5000))) fail(`Add a duck: ${n0} -> ${h.state().ducks}`)
  await wait(100)
  if ($('.pool .count').textContent !== `${n0 + 1} of 40`) fail(`the count reads "${$('.pool .count').textContent}"`)
  $('.pool .time-open').click(); await wait(100)
  if ($('#pool-time').hidden || $('.pool .time-open').getAttribute('aria-expanded') !== 'true') fail('the hour did not open its popover')
  const r = $('#pool-hour')
  r.value = '20'; r.dispatchEvent(new Event('input', { bubbles: true })); await wait(150)
  if (Math.abs(h.state().hour - 20) > 0.01 || h.state().clock) fail(`the slider: hour ${h.state().hour}, clock ${h.state().clock}`)
  if ($('.pool .time-open output').textContent !== '20:00') fail(`the time reads "${$('.pool .time-open output').textContent}"`)
  if (!$('.pool').classList.contains('dark')) fail('the glass did not turn dark after sunset')
  $('.pool .run').click(); await wait(150)
  if (!h.state().clock || $('.pool .run').getAttribute('aria-label') !== 'Stop the clock') fail('the play button did not run the clock')
  $('.pool .run').click(); await wait(100)
  esc(); await wait(100)
  if (!$('#pool-time').hidden) fail('Escape did not put the hour away')
  $('.pool .names').click(); await wait(250)
  if (!h.tags().length || !pressed('.pool .names')) fail('Names put no tags up')
  $('.pool .names').click(); await wait(250)
  if (h.tags().length) fail('Names did not take the tags down')
  $('.pool .help-open').click(); await wait(100)
  if ($('#pool-help').hidden) fail('Help showed nothing')
  $('.pool .time-open').click(); await wait(100)
  if (!$('#pool-help').hidden || $('#pool-time').hidden) fail('the hour did not take the help\'s place')
  esc(); await wait(100)
  h.select(0); await wait(150)
  const d = h.world.ducks[0]
  if ($('.pool .card').hidden || !$('.pool .card h2').textContent) fail('a picked duck shows no card')
  $('.pool .designs button[data-i="4"]').click(); await wait(150)
  if (d.colour !== 4 || !pressed('.pool .designs button[data-i="4"]')) fail(`the design: ${d.colour}`)
  $('.pool .hats button[data-i="2"]').click(); await wait(150)
  if (d.hat !== 2 || !pressed('.pool .hats button[data-i="2"]')) fail(`the wear: ${d.hat}`)
  $('.pool .follow').click(); await wait(150)
  if (!h.state().follow) fail('Follow did not follow')
  $('.pool .follow').click(); await wait(100)
  $('.pool .next').click(); await wait(150)
  if (h.state().selected === d.id || $('.pool .card h2').textContent === '') fail('the next arrow did not step to another duck')
  $('.pool .close').click(); await wait(150)
  if (h.state().selected !== null || !$('.pool .card').hidden) fail('the close button did not put the duck down')
  h.select(0); await wait(150)
  const n1 = h.state().ducks
  $('.pool .remove').click(); await wait(150)
  if (h.state().ducks !== n1 - 1 || !$('.pool .card').hidden) fail('Take it out did not take the duck away')
  return JSON.stringify({ ducks: [n0, n0 + 1, n1 - 1], design: d.colour, hat: d.hat })
})()
