// Run with frames.js before it: --eval "$(cat drive/frames.js drive/overlap.js)".
(async () => {
  await new Promise((r) => setTimeout(r, 500))
  const { frames, hits } = frameOverlaps()
  if (hits.length) throw new Error(`frames overlap at ${innerWidth}x${innerHeight}: ${hits.join('; ')}`)
  return JSON.stringify({ viewport: [innerWidth, innerHeight], frames, overlaps: 0 })
})()
