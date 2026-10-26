// Names by the hook: names(true) puts each duck's name over it, names(false) takes them away. Proof: every duck out of
// the tube has a tag (one riding the tube's underground run has none, by design), the tags' names are the world's, each
// tag sits over its duck's head on screen, and of a crowd only names that cover no other show; then none.
(async () => {
  const P = window.__pool, W = P.world, wait = (ms) => new Promise((r) => setTimeout(r, ms))
  P.add(14); for (let t = 0; t < 8000 && W.ducks.length < 10; t += 100) await wait(100)   // a crowd, so names can cover one another
  P.pause(true); P.render(1, 0)
  P.names(true); P.render(1, 0); await wait(300)
  const spans = [...document.querySelectorAll('.dk-tags span')], names = spans.map((el) => el.textContent)
  // each tag is centred on the point just over its duck's head (0.24 up), and so above the duck itself
  const shown = W.ducks.filter((d) => d.state !== 'tube')
  const placed = shown.every((d) => {
    const el = spans.find((x) => x.textContent === d.name), p = d.body.p, head = P.toPx([p[0], p[1] + 0.24, p[2]]), base = P.toPx(p)
    if (!el || !head || !base) return false
    const r = el.getBoundingClientRect()
    return Math.abs((r.left + r.right) / 2 - head[0]) < 2 && Math.abs(r.bottom - head[1]) < 2 && r.bottom < base[1]
  })
  const boxes = spans.filter((el) => !el.classList.contains('crowded')).map((el) => el.getBoundingClientRect())
  const apart = boxes.every((a, i) => boxes.every((b, j) => i >= j || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top))
  P.names(false); P.render(1, 0); await wait(300)
  const after = document.querySelectorAll('.dk-tags span').length, out = { ducks: W.ducks.length, tags: names.length, showing: boxes.length, sample: names.slice(0, 4), placed, apart, after }
  if (names.length < shown.length || names.length > W.ducks.length || new Set(names).size !== names.length || !names.every((n) => W.ducks.some((d) => d.name === n)) || !placed || !apart || !boxes.length || after !== 0) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
