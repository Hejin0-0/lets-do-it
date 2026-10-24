// Run with frames.js before it. Click the "next" arrow through every jelly: each must mount (window.__jelly.id
// changes) without throwing, and none may have its frames covering one another at this viewport.
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const ids = [window.__jelly.id], bad = []
  const look = () => { const { hits } = frameOverlaps(); if (hits.length) bad.push(`${window.__jelly.id}: ${hits.join('; ')}`) }
  look()
  for (let i = 0; i < 20; i++) {
    document.querySelector('#sw-next').click()
    for (let t = 0; t < 40 && window.__jelly.id === ids[ids.length - 1]; t++) await wait(250)
    await wait(1500)
    if (window.__jelly.id === ids[0]) break
    ids.push(window.__jelly.id); look()
  }
  if (ids.length < 2 || ids.some((id) => !id)) throw new Error('the switcher did not move on: ' + ids.join(' '))
  if (bad.length) throw new Error(`frames overlap at ${innerWidth}x${innerHeight}: ${bad.join(' | ')}`)
  return JSON.stringify({ viewport: [innerWidth, innerHeight], visited: ids, overlaps: 0 })
})()
