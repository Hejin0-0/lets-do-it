// The duck to watch and the hour, chosen from the seated menu by the player's own input (the probe's window.__input:
// the browser's own keys and clicks). The menu lists the live ducks by unique name; typing a duck's name on the Duck to
// watch select (a closed select picks by type-ahead; its popup is the browser's own, which a script cannot drive) picks one, and the displayed choice, world.selected and the duck's name tag name the same live duck; the seat's eye
// stays put and the gaze turns to the duck until it sits near the middle of the screen. A duck picked in the scene (the
// hook's select) shows in the menu and draws the gaze; removing the watched duck leaves no selection, says so, and the
// gaze goes back to the seat's own look. The Hour slider (End, Home, arrows, Page keys, a click on its track) sets the
// world clock (world.setHour) and the lit scene follows (the hook's light()); the clock keeps running at a day in 30
// minutes and the slider follows it; a pile of hour jumps earns no Around-the-sun stamp, W pressed on a control moves
// nothing, and Escape and Stand up still leave the seat with focus back on the scene. Also: a duck arriving
// keeps the chosen option, a renamed watched duck is announced again, a stale selection is cleared in the world and the
// menu (and remove never takes the wrong duck), the menu writes nothing while nothing changes, and after the boat
// refuses, the rest of the menu still follows the world. Start from an empty store.
// window.__shot = 'choices' stops with the duck chosen and the gaze on it (for its screenshot); 'hour' stops at 23:45.
(async () => {
  const h = window.__pool, W = h.world, $ = (s) => document.querySelector(s), wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const fail = (m) => { throw new Error(m) }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const input = async (...steps) => { await window.__input(steps); await frame() }
  const at = (el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }
  const clock = () => $('.seat-ui .seat-clock').textContent, note = () => $('.seat-ui .seat-note').textContent, hourNote = () => $('.seat-ui .seat-hour-note').textContent
  const hhmm = (hr) => { const m = Math.floor(((hr % 24) + 24) % 24 * 60 + 1e-9); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
  const eyeNow = () => { const c = h.cam, ce = Math.cos(c.el); return [c.target[0] + c.dist * ce * Math.sin(c.az), c.target[1] + c.dist * Math.sin(c.el), c.target[2] + c.dist * ce * Math.cos(c.az)] }
  const eyeMoved = (a) => Math.hypot(...eyeNow().map((v, i) => v - a[i])) > 1e-4
  const centred = (d) => { const p = h.toPx([d.body.p[0], d.body.p[1], d.body.p[2]]); return !!p && Math.abs(p[0] - innerWidth / 2) < innerWidth * 0.2 && Math.abs(p[1] - innerHeight / 2) < innerHeight * 0.25 }
  const out = []
  await wait(500)
  if (h.book.stamps.find((s) => s.id === 'day-and-night').earned) fail('the book already holds Around the sun: run this from an empty store')
  h.add(4)
  for (let i = 0; i < 60 && W.ducks.length < 4; i++) { h.step(120); if (i % 5 === 4) await frame() }
  if (W.ducks.length < 4) fail(`the pool has ${W.ducks.length} ducks`)
  h.select(-1); h.clock(true)
  h.sit(0); await wait(1600)   // the pool chair
  const select = $('.seat-ui .seat-duck'), panel = $('.seat-ui dialog'), hour = $('.seat-ui .seat-hour')
  if (!select || !panel.open) fail('no seated menu with a Duck to watch')
  if (!/Duck to watch/.test(select.labels[0]?.textContent || '')) fail('the duck select has no visible name')
  if (hour?.type !== 'range' || !/Hour/.test(hour.labels[0]?.textContent || '') || hour.min !== '0' || hour.max !== '23.75' || hour.step !== '0.25') fail(`the Hour slider is not a named range over the day: ${hour && [hour.type, hour.min, hour.max, hour.step]}`)
  const az0 = h.cam.az, el0 = h.cam.el   // the seat's own look

  const names = [...select.options].map((o) => o.textContent), live = W.ducks.map((d) => d.id)
  if (names[0] !== 'No duck' || names.length !== live.length + 1 || new Set(names).size !== names.length) fail(`the list is not "No duck" and one unique name per live duck: ${JSON.stringify(names)}`)
  if (JSON.stringify([...select.options].slice(1).map((o) => Number(o.value))) !== JSON.stringify(live)) fail('the options do not carry the live duck ids in order')
  if (select.value !== '') fail(`nothing is chosen but the select shows "${select.value}"`)
  const box = panel.getBoundingClientRect()
  if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) fail(`the menu with its choices is outside the window: ${[box.left, box.top, box.right, box.bottom].map(Math.round)} in ${innerWidth}x${innerHeight}`)
  out.push({ by: 'listed', names, menu: [box.width, box.height].map(Math.round) })

  const seen = (d) => { const p = h.toPx([d.body.p[0], d.body.p[1] + 0.24, d.body.p[2]]); return !!p && p[0] > 60 && p[0] < innerWidth * 0.7 && p[1] > 120 && p[1] < innerHeight - 80 }
  const pick = Math.max(0, W.ducks.findIndex(seen)), duck = W.ducks[pick], name = names[pick + 1]   // one in view, so its tag shows in the screenshot
  const eye0 = eyeNow()
  select.focus(); await input(...[...name].map((c) => ({ key: c })))
  if (W.selected !== duck || select.value !== String(duck.id) || select.selectedOptions[0].textContent !== name) fail(`typing "${name}" did not choose that duck: ${W.selected?.id}, "${select.value}"`)
  if (!W.ducks.includes(W.selected)) fail('the chosen duck is not a live one')
  if (note() !== `Watching ${name}.`) fail(`the choice is not announced: "${note()}"`)
  await frame()
  const tag = h.tags()
  if (!tag.some((t) => t === duck.name) || document.querySelector('.dk-tags span.picked')?.textContent !== duck.name) fail(`the watched duck's name tag is not shown as picked: ${JSON.stringify(tag)}`)
  await wait(3500)   // the gaze turns
  if (eyeMoved(eye0) || h.seating.state.phase !== 'seated') fail(`watching a duck moved the eye or left the seat: ${h.seating.state.phase}`)
  if (!centred(duck)) fail(`the gaze did not turn to the watched duck: ${h.toPx(duck.body.p)?.map(Math.round)}`)
  out.push({ by: 'typing the name', chose: name, selected: W.selected.id, tags: tag, note: note(), onScreen: h.toPx(duck.body.p).map(Math.round) })
  if (window.__shot === 'choices') return JSON.stringify(out)

  const other = (pick + 1) % W.ducks.length
  h.select(other); await frame(); await frame()   // a duck picked in the scene
  if (select.value !== String(W.ducks[other].id) || note() !== `Watching ${names[other + 1]}.`) fail(`a duck picked in the scene is not shown: "${select.value}", "${note()}"`)
  await wait(3500)
  if (!centred(W.ducks[other]) || eyeMoved(eye0)) fail('the gaze did not move to the duck picked in the scene, or the eye moved')
  out.push({ by: 'picked in the scene', shows: select.selectedOptions[0].textContent })

  const kept = select.selectedOptions[0], count = select.options.length   // a duck arriving keeps the chosen option where it is
  h.add(1); for (let i = 0; i < 30 && select.options.length === count; i++) { h.step(120); await frame() }
  if (select.options.length !== count + 1 || select.selectedOptions[0] !== kept || !kept.isConnected) fail(`a duck arriving replaced the chosen option: ${select.options.length} options, kept ${kept.isConnected}`)
  W.selected.name = 'Renamed'; await frame(); await frame()   // its label changes, the announcement follows
  if (note() !== 'Watching Renamed.' || kept.textContent !== 'Renamed') fail(`a changed label is not announced: "${note()}", "${kept.textContent}"`)
  out.push({ by: 'list changes', kept: true, note: note() })

  const gone = W.selected.id, goneDuck = W.selected
  h.remove(); await frame(); await frame()
  if (W.selected !== null || select.value !== '' || [...select.options].some((o) => o.value === String(gone))) fail(`removing the watched duck left a stale choice: ${W.selected?.id}, "${select.value}"`)
  if (note() !== 'The duck you were watching has left.') fail(`the loss is not announced: "${note()}"`)
  if (h.seating.state.phase !== 'seated' || !panel.open) fail('removing the duck changed the seat')
  await wait(4000)   // no duck: the gaze goes back to the seat's own look
  if (Math.abs(h.cam.az - az0) > 0.05 || Math.abs(h.cam.el - el0) > 0.05 || eyeMoved(eye0)) fail(`with no duck the gaze did not come back: az ${h.cam.az - az0}, el ${h.cam.el - el0}`)
  out.push({ by: 'removed', note: note(), options: select.options.length })
  W.selected = goneDuck; await frame(); await frame()   // a duck that is gone, selected again: no selection anywhere
  if (W.selected !== null || select.value !== '') fail(`a stale selection stayed: world ${W.selected?.id}, menu "${select.value}"`)
  const lastDuck = W.ducks[W.ducks.length - 1], n = W.ducks.length
  W.selected = goneDuck; h.remove(); await frame()
  if (W.ducks.length !== n - 1 || W.ducks.includes(lastDuck) || W.floaters.bodies.includes(lastDuck.body)) fail('with a stale selection, remove took the wrong duck or left its body')
  out.push({ by: 'stale selection', cleared: true })

  const hourAt = (v) => { const r = hour.getBoundingClientRect(); return [r.left + 8 + (v / Number(hour.max)) * (r.width - 16), r.top + r.height / 2] }   // the thumb's travel, clear of its ends
  const before = h.light(), day = h.state().hour
  for (let i = 0, last = ''; i < 300; i++) { await frame(); const now = [h.cam.az, h.cam.el, h.cam.dist].map((v) => v.toFixed(6)).join(); if (now === last) break; last = now }   // the gaze settled
  h.clock(false); let writes = 0; const watch = new MutationObserver((r) => { writes += r.length })   // with the clock stopped and the gaze still, nothing on the panel changes
  watch.observe(panel, { subtree: true, childList: true, attributes: true, characterData: true }); for (let i = 0; i < 10; i++) await frame(); watch.disconnect(); h.clock(true)
  if (writes) fail(`the seated menu wrote to the page ${writes} times while nothing changed`)
  const adrift = () => W.collectibles.adrift.length > 0   // the visit's item, come since the player sat down
  for (let i = 0; i < 60 && !adrift(); i++) { h.step(120); if (i % 5 === 4) await frame() }
  const real = W.sendBoat; W.sendBoat = () => false   // the boat refuses (as with no water route)
  await frame(); await input({ click: at($('.seat-ui .seat-send')) })
  const refusal = $('.seat-ui .seat-boat').textContent
  hour.focus(); await input({ key: 'Home' }); W.sendBoat = real   // the hour changed while the refusal stands
  if (!adrift() || refusal !== 'The boat cannot get there just now.') fail(`no refusal to keep: adrift ${adrift()}, "${refusal}"`)
  const dark = { hour: h.state().hour, light: h.light() }
  if (dark.hour > 0.1 || clock() !== `The clock says ${hhmm(W.day.hour)}.` || hourNote() !== 'The hour is now 00:00.' || hour.getAttribute('aria-valuetext') !== '00:00') fail(`Home did not set 00:00: ${dark.hour}, "${clock()}", "${hourNote()}", "${hour.getAttribute('aria-valuetext')}"`)
  if (!W.day.run) fail('choosing an hour stopped the clock')
  await input({ click: hourAt(12) }); await wait(300)
  const midday = { hour: h.state().hour, light: h.light() }
  if (Math.abs(midday.hour - 12) > 0.75 || midday.light.night > 0.05 || !/^The hour is now 1[12]:/.test(hourNote())) fail(`a click at the middle of the track did not give midday: ${midday.hour}, "${hourNote()}", ${JSON.stringify(midday.light)}`)
  const v0 = Number(hour.value); hour.focus(); await input({ key: 'ArrowRight' }, { key: 'ArrowRight' }, { key: 'ArrowRight' }, { key: 'ArrowRight' })
  if (Math.abs(h.state().hour - (v0 + 1)) > 0.05) fail(`four ArrowRights did not move the hour on by one: ${v0} -> ${h.state().hour}`)
  await input({ key: 'End' }); await wait(300)
  const late = { hour: h.state().hour, light: h.light() }
  if (Math.abs(late.hour - 23.75) > 0.05 || late.light.night < 0.9 || late.light.exposure === midday.light.exposure || hourNote() !== 'The hour is now 23:45.') fail(`End did not give a night scene at 23:45: ${late.hour}, "${hourNote()}", ${JSON.stringify(late.light)}`)
  out.push({ by: 'hours', from: day, dark, midday, late, was: before })
  if (window.__shot === 'hour') return JSON.stringify(out)
  await input({ key: 'Home' }); const t0 = W.day.hour
  for (let i = 0; i < 60; i++) { h.step(120); if (i % 10 === 9) await frame() }   // a minute of world time: the clock runs on at a day in 30 minutes
  await frame()
  const ran = W.day.hour - t0
  if (Math.abs(ran - 0.8) > 0.02 || Number(hour.value) !== Math.floor(W.day.hour / 0.25) * 0.25) fail(`the clock did not run on at a day in 30 minutes, or the slider did not follow: ${ran}, slider ${hour.value}`)
  out.push({ by: 'clock runs', hoursPerMinute: +ran.toFixed(3), slider: hour.value })

  for (let i = 0; i < 30; i++) { for (const k of ['Home', 'PageUp', 'End', 'PageDown']) await input({ key: k }); h.step(120) }
  if (h.book.stamps.find((s) => s.id === 'day-and-night').earned) fail('jumping between hours earned Around the sun')
  out.push({ by: 'jumps are no day', earned: false })

  const still = eyeNow()
  select.focus(); await input({ down: 'w' }); await wait(300); await input({ up: 'w' }, { key: 'r' })
  hour.focus(); await input({ down: 'w' }); await wait(300); await input({ up: 'w' }, { key: 'r' })
  if (eyeMoved(still) || h.seating.state.phase !== 'seated') fail(`W or R on a control reached the world: ${h.seating.state.phase}`)
  const canvas = $('canvas')   // seated by the hook, not by a button: focus goes back to the scene
  select.focus(); await input({ key: 'Escape' })
  if (h.seating.state.phase !== 'standing' || panel.open || document.activeElement !== canvas) fail(`Escape on the select did not stand up with focus on the scene: ${h.seating.state.phase}, "${document.activeElement.tagName}"`)
  out.push({ by: 'Escape', phase: h.seating.state.phase, focus: document.activeElement.tagName })

  h.sit(0); await wait(1600)
  $('.seat-ui .seat-up').focus(); await input({ key: 'Enter' })
  if (h.seating.state.phase !== 'standing' || panel.open || document.activeElement !== canvas) fail(`Stand up did not leave with focus on the scene: ${h.seating.state.phase}, "${document.activeElement.tagName}"`)
  out.push({ by: 'Stand up', phase: h.seating.state.phase })
  // the gaze holds the eye at the seat, yet a drag of the player's own still leaves it
  h.sit(0); await wait(1600); h.select(0); await wait(1500)
  if (h.seating.state.phase !== 'seated') fail('watching a duck stood the player up')
  const canvasAt = [[0.5, 0.12], [0.25, 0.2], [0.75, 0.2], [0.5, 0.5], [0.2, 0.8]].map(([fx, fy]) => [innerWidth * fx, innerHeight * fy]).find(([x, y]) => document.elementFromPoint(x, y) === $('canvas'))   // the menu moves with the gaze: start on the scene
  if (!canvasAt) fail('no open scene to drag on')
  await input({ drag: [canvasAt[0], canvasAt[1], canvasAt[0] + innerWidth * 0.2, canvasAt[1] + innerHeight * 0.05], button: 'right' }); await frame()
  if (h.seating.state.phase !== 'standing') fail(`a drag while the gaze followed a duck did not leave the seat: ${h.seating.state.phase}`)
  out.push({ by: 'drag while watching', phase: h.seating.state.phase })
  return JSON.stringify(out)
})()
