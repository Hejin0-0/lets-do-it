// mulberry32 with its whole state in one uint32, so GameState.rng stays a plain number.

/** One draw: [value in [0,1), next state]. */
export function draw(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** A local stream seeded from a state number (for the AI, which must not touch GameState). */
export function stream(seed: number): () => number {
  let st = seed >>> 0
  return () => {
    const [v, n] = draw(st)
    st = n
    return v
  }
}
