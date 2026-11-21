// Names by the hook: names(true) puts each duck's name over it, names(false) takes them away. Proof: every duck out of
// the tube has a tag (one riding the tube's underground run is hidden, by design, and keeps its tag element when back),
// the tags' names are the world's, each is drawn by its Leon Sans canvas with its words hidden (for screen readers), each tag sits over its duck's head on screen, and of a crowd only names that cover no
// other show; then none.
(async () => {
  const P = window.__pool, W = P.world, wait = (ms) => new Promise((r) => setTimeout(r, ms))
  P.add(14); for (let t = 0; t < 8000 && W.ducks.length < 10; t += 100) await wait(100)   // a crowd, so names can cover one another
  P.pause(true); P.render(1, 0)
  const crowd = W.ducks.filter((d) => d.state === 'float').slice(0, 3)
  if (crowd.length < 2) throw new Error('no floating crowd to label')
  for (const d of crowd) d.body.p = crowd[0].body.p.slice()
  P.names(true); P.render(1, 0); await wait(300)
  const spans = [...document.querySelectorAll('.dk-tags > span:not([hidden])')], names = P.tags()
  // each tag is centred on the point just over its duck's head (0.24 up), and so above the duck itself
  const shown = W.ducks.filter((d) => d.state !== 'tube')
  const placed = shown.every((d) => {
    const el = spans.find((x) => x.textContent === d.name), p = d.body.p, head = P.toPx([p[0], p[1] + 0.24, p[2]]), base = P.toPx(p)
    if (!el || !head || !base) return false
    const r = el.getBoundingClientRect()
    return Math.abs((r.left + r.right) / 2 - head[0]) < 2 && Math.abs(r.bottom - head[1]) < 2 && r.bottom < base[1]
  })
  const boxes = spans.filter((el) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect()
    return s.display !== 'none' && s.visibility === 'visible' && +s.opacity > 0.01 && r.width > 0 && r.height > 0
  }).map((el) => el.getBoundingClientRect())
  const apart = boxes.every((a, i) => boxes.every((b, j) => i >= j || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top))
  // the words a screen reader reads stay out of sight: no second pill in the system font over the lettering
  const lettered = spans.every((el) => { const w = el.querySelector(':scope > .lt-words'), r = w?.getBoundingClientRect(); return !!el.querySelector(':scope > canvas.lt') && !!r && r.width <= 1 && r.height <= 1 && w.textContent === el.textContent })
  const d = crowd[0], tag = spans.find((x) => x.textContent === d.name), canvas = tag?.querySelector('canvas.lt'), oldY = d.body.p[1]
  d.state = 'tube'; d.body.p[1] = -2; P.render(1, 0)
  const hid = !!tag && tag.hidden && !P.tags().includes(d.name)
  d.state = 'float'; d.body.p[1] = oldY; P.render(1, 0)
  const reused = hid && !tag.hidden && P.tags().includes(d.name) && tag.querySelector('canvas.lt') === canvas
  P.names(false); P.render(1, 0); await wait(300)
  const after = P.tags().length, domAfter = document.querySelectorAll('.dk-tags > span:not([hidden])').length
  const out = { ducks: W.ducks.length, tags: names.length, showing: boxes.length, sample: names.slice(0, 4), placed, apart, lettered, reused, after, domAfter }
  if (names.length < shown.length || names.length > W.ducks.length || spans.length !== names.length || new Set(names).size !== names.length || !names.every((n) => W.ducks.some((d) => d.name === n)) || !placed || !apart || !lettered || !boxes.length || !reused || after !== 0 || domAfter !== 0) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
