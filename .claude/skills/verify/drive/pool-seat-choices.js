// The duck to watch and the hour, chosen from the seated menu by the player's own input (the probe's window.__input:
// the browser's own keys and clicks). The menu lists the live ducks by unique name; typing a duck's name on the Duck to
// watch select (a closed select picks by type-ahead; its popup is the browser's own, which a script cannot drive) picks one, and the displayed choice, world.selected and the duck's name tag name the same live duck without the camera
// moving. A duck picked in the scene (the hook's select) shows in the menu; removing the watched duck leaves no selection
// and says so. A click on an hour button, and Enter on another, set the world clock (world.setHour) and the lit scene
// follows (the hook's light()); the clock keeps running, a pile of presets earns no Around-the-sun stamp, W pressed on a
// control moves nothing, and Escape and Stand up still leave the seat with focus back. Start from an empty store.
// window.__shot = 'choices' stops with the duck chosen (for its screenshot); 'hour' stops with Night chosen.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const input = async (...steps) => { await window.__input(steps); await frame() }
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
  const clock = () => $('.seat-ui .seat-clock').textContent, note = () => $('.seat-ui .seat-note').textContent, hourNote = () => $('.seat-ui .seat-hour-note').textContent
  const hhmm = (hr) => { const m = Math.floor(((hr % 24) + 24) % 24 * 60 + 1e-9); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  const view = () => [h.cam.target.slice(), h.cam.az, h.cam.el, h.cam.dist].flat()
  const moved = (a) => Math.max(...view().map((v, i) => Math.abs(v - a[i]))) > 1e-6
  const out = []
  await wait(500)
  if (h.book.stamps.find((s) => s.id === 'day-and-night').earned) fail('the book already holds Around the sun: run this from an empty store')
  h.add(4)
  for (let i = 0; i < 60 && W.ducks.length < 4; i++) { h.step(120); if (i % 5 === 4) await frame() }
  if (W.ducks.length < 4) fail(`the pool has ${W.ducks.length} ducks`)
  h.select(-1); h.clock(true)
  h.sit(0); await wait(1600)   // the pool chair
  const select = $('.seat-ui .seat-duck'), panel = $('.seat-ui dialog'), buttons = [...document.querySelectorAll('.seat-ui .seat-hour')]
  if (!select || !panel.open) fail('no seated menu with a Duck to watch')
  if (!/Duck to watch/.test(select.labels[0]?.textContent || '')) fail('the duck select has no visible name')
  if (buttons.length < 2) fail(`${buttons.length} hour buttons`)

  const names = [...select.options].map((o) => o.textContent), live = W.ducks.map((d) => d.id)
  if (names[0] !== 'No duck' || names.length !== live.length + 1 || new Set(names).size !== names.length) fail(`the list is not "No duck" and one unique name per live duck: ${JSON.stringify(names)}`)
  if (JSON.stringify([...select.options].slice(1).map((o) => Number(o.value))) !== JSON.stringify(live)) fail('the options do not carry the live duck ids in order')
  if (select.value !== '') fail(`nothing is chosen but the select shows "${select.value}"`)
  const box = panel.getBoundingClientRect()
  if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) fail(`the menu with its choices is outside the window: ${[box.left, box.top, box.right, box.bottom].map(Math.round)} in ${innerWidth}x${innerHeight}`)
  out.push({ by: 'listed', names, menu: [box.width, box.height].map(Math.round) })

  const seen = (d) => { const p = h.toPx([d.body.p[0], d.body.p[1] + 0.24, d.body.p[2]]); return !!p && p[0] > 60 && p[0] < innerWidth * 0.7 && p[1] > 120 && p[1] < innerHeight - 80 }
  const pick = Math.max(0, W.ducks.findIndex(seen)), duck = W.ducks[pick], name = names[pick + 1]   // one in view, so its tag shows in the screenshot
  const frozen = view()
  select.focus(); await input(...[...name].map((c) => ({ key: c })))
  if (W.selected !== duck || select.value !== String(duck.id) || select.selectedOptions[0].textContent !== name) fail(`typing "${name}" did not choose that duck: ${W.selected?.id}, "${select.value}"`)
  if (!W.ducks.includes(W.selected)) fail('the chosen duck is not a live one')
  if (note() !== `Watching ${name}.`) fail(`the choice is not announced: "${note()}"`)
  await frame()
  const tag = h.tags()
  if (!tag.some((t) => t === duck.name) || document.querySelector('.dk-tags span.picked')?.textContent !== duck.name) fail(`the watched duck's name tag is not shown as picked: ${JSON.stringify(tag)}`)
  if (moved(frozen) || h.seating.state.phase !== 'seated') fail(`choosing a duck moved the camera or left the seat: ${h.seating.state.phase}`)
  out.push({ by: 'typing the name', chose: name, inView: seen(duck), selected: W.selected.id, tags: tag, note: note() })
  if (window.__shot === 'choices') return JSON.stringify(out)

  const other = (pick + 1) % W.ducks.length
  h.select(other); await frame(); await frame()   // a duck picked in the scene
  if (select.value !== String(W.ducks[other].id) || note() !== `Watching ${names[other + 1]}.`) fail(`a duck picked in the scene is not shown: "${select.value}", "${note()}"`)
  out.push({ by: 'picked in the scene', shows: select.selectedOptions[0].textContent })

  const gone = W.selected.id
  h.remove(); await frame(); await frame()
  if (W.selected !== null || select.value !== '' || [...select.options].some((o) => o.value === String(gone))) fail(`removing the watched duck left a stale choice: ${W.selected?.id}, "${select.value}"`)
  if (note() !== 'The duck you were watching has left.') fail(`the loss is not announced: "${note()}"`)
  if (h.seating.state.phase !== 'seated' || !panel.open) fail('removing the duck changed the seat')
  out.push({ by: 'removed', note: note(), options: select.options.length })

  const hr = (id) => buttons.find((b) => b.dataset.hour === id), dusk = hr('dusk'), night = hr('night'), dawn = hr('dawn'), noon = hr('noon')
  if (!dusk || !night || !dawn || !noon) fail('the dawn, noon, dusk and night buttons are not all there')
  const before = h.light(), day = h.state().hour
  await input({ click: at(dusk) })
  const evening = { hour: h.state().hour, light: h.light() }
  if (Math.abs(evening.hour - 18) > 0.1 || clock() !== `The clock says ${hhmm(W.day.hour)}.` || hourNote() !== 'The hour is now 18:00.') fail(`Dusk did not set 18:00: ${evening.hour}, "${clock()}", "${hourNote()}"`)
  if (!W.day.run) fail('choosing an hour stopped the clock')
  dawn.focus(); await input({ key: 'Enter' })
  const morning = { hour: h.state().hour, light: h.light() }
  if (Math.abs(morning.hour - 6) > 0.1 || hourNote() !== 'The hour is now 06:00.') fail(`Enter on Dawn did not set 06:00: ${morning.hour}, "${hourNote()}"`)
  noon.focus(); await input({ key: ' ' }); await wait(300)
  const midday = { hour: h.state().hour, light: h.light() }
  if (Math.abs(midday.hour - 12) > 0.2 || hourNote() !== 'The hour is now 12:00.' || midday.light.night > 0.05) fail(`Space on Noon did not give a day scene: ${midday.hour}, "${hourNote()}", ${JSON.stringify(midday.light)}`)
  await input({ click: at(night) }); await wait(300)
  const late = { hour: h.state().hour, light: h.light() }
  if (Math.abs(late.hour - 23) > 0.2 || late.light.night < 0.9 || late.light.night - midday.light.night < 0.8 || late.light.exposure === midday.light.exposure) fail(`the lit scene did not follow the hours: noon ${JSON.stringify(midday.light)}, night ${JSON.stringify(late.light)}`)
  if (!(W.day.hour > 22.9 && W.day.run)) fail(`the clock after Night: ${W.day.hour}, running ${W.day.run}`)
  out.push({ by: 'hours', from: day, dusk: evening, dawn: morning, noon: midday, night: late, was: before })
  if (window.__shot === 'hour') return JSON.stringify(out)

  for (let i = 0; i < 30; i++) { for (const b of [dawn, noon, dusk, night]) await input({ click: at(b) }); h.step(120) }
  if (h.book.stamps.find((s) => s.id === 'day-and-night').earned) fail('presets earned Around the sun')
  out.push({ by: 'presets are no day', earned: false })

  const still = view()
  select.focus(); await input({ down: 'w' }); await wait(300); await input({ up: 'w' }, { key: 'r' })
  dusk.focus(); await input({ down: 'w' }); await wait(300); await input({ up: 'w' }, { key: 'r' })
  if (moved(still) || h.seating.state.phase !== 'seated') fail(`W or R on a control reached the world: ${h.seating.state.phase}`)
  select.focus(); await input({ key: 'Escape' })
  if (h.seating.state.phase !== 'standing' || panel.open) fail(`Escape on the select did not stand up: ${h.seating.state.phase}`)
  const back = document.activeElement
  out.push({ by: 'Escape', phase: h.seating.state.phase, focus: back.textContent.trim() || back.tagName })

  h.sit(0); await wait(1600)
  $('.seat-ui .seat-up').focus(); await input({ key: 'Enter' })
  if (h.seating.state.phase !== 'standing' || panel.open || document.activeElement === document.body) fail(`Stand up did not leave with focus kept: ${h.seating.state.phase}, "${document.activeElement.tagName}"`)
  out.push({ by: 'Stand up', phase: h.seating.state.phase })
  return JSON.stringify(out)
})()
