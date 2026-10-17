// Names: the button puts each duck's name over it, and takes them away again. Proof: one tag per duck in view, the
// tags' names are the world's, each tag sits over its duck's head on screen; then none.
(async () => {
  const P = window.__pool, W = P.world, wait = (ms) => new Promise((r) => setTimeout(r, ms)), $ = (id) => document.getElementById(id)
  await wait(500); P.pause(true); P.render(1, 0)
  $('tags').click(); P.render(1, 0); await wait(300)
  const spans = [...document.querySelectorAll('.dk-tags span')], names = spans.map((el) => el.textContent)
  // each tag is centred on the point just over its duck's head (0.24 up), and so above the duck itself
  const placed = W.ducks.every((d) => {
    const el = spans.find((x) => x.textContent === d.name), p = d.body.p, head = P.toPx([p[0], p[1] + 0.24, p[2]]), base = P.toPx(p)
    if (!el || !head || !base) return false
    const r = el.getBoundingClientRect()
    return Math.abs((r.left + r.right) / 2 - head[0]) < 2 && Math.abs(r.bottom - head[1]) < 2 && r.bottom < base[1]
  })
  $('tags').click(); P.render(1, 0); await wait(300)
  const after = document.querySelectorAll('.dk-tags span').length, out = { ducks: W.ducks.length, tags: names.length, sample: names.slice(0, 4), placed, after, pressed: $('tags').getAttribute('aria-pressed') }
  if (names.length !== W.ducks.length || new Set(names).size !== names.length || !names.every((n) => W.ducks.some((d) => d.name === n)) || !placed || after !== 0) throw new Error(JSON.stringify(out))
  return JSON.stringify(out)
})()
