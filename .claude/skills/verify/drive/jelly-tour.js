// Run with frames.js before it. Click the "next" arrow through every jelly: each must mount (window.__jelly.id
// changes) without throwing, and none may have its frames covering one another at this viewport.
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const countText = document.querySelector('#loader-no small')?.textContent.trim() ?? ''
  const total = Number(countText.match(/^\/\s*(\d+)$/)?.[1])
  const ids = [window.__jelly.id], bad = []
  const startIndex = window.__switcher.index, next = document.querySelector('#sw-next')
  if (!Number.isSafeInteger(total) || total < 1) throw new Error('invalid jelly count: ' + countText)
  if (!ids[0] || !Number.isInteger(startIndex) || startIndex < 0 || startIndex >= total) throw new Error(`invalid starting jelly: ${ids[0]} at index ${startIndex}`)
  const look = () => { const { hits } = frameOverlaps(); if (hits.length) bad.push(`${window.__jelly.id}: ${hits.join('; ')}`) }
  look()
  for (let i = 0; i < total; i++) {
    const expected = next.getAttribute('aria-label')?.match(/^Next jelly:\s+(\S+)/)?.[1]
    next.click()
    for (let t = 0; t < 40 && window.__jelly.id === ids[ids.length - 1]; t++) await wait(250)
    await wait(1500)
    const id = window.__jelly.id, index = window.__switcher.index, expectedIndex = (startIndex + i + 1) % total
    if (!expected || id !== expected || index !== expectedIndex) throw new Error(`expected jelly ${expected || '(unlabeled)'} at index ${expectedIndex}, got ${id} at index ${index}`)
    if (i === total - 1) {
      if (id !== ids[0]) throw new Error(`the switcher did not return to ${ids[0]}: ${id}`)
    } else {
      if (ids.includes(id)) throw new Error(`repeated jelly ${id}: ${ids.join(' ')}`)
      ids.push(id); look()
    }
  }
  if (bad.length) throw new Error(`frames overlap at ${innerWidth}x${innerHeight}: ${bad.join(' | ')}`)
  return JSON.stringify({ viewport: [innerWidth, innerHeight], visited: ids, returnedTo: window.__jelly.id, overlaps: 0 })
})()
