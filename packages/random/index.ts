// Deterministic seeded randomness (mulberry32): one generator per seed, so a world, a test or a
// visual baseline built from the same seed comes out the same every time. Route every gameplay
// random through it instead of Math.random.

/** One draw from a uint32 state: [value in [0,1), next state]. For state that must stay a plain
 *  number (a serializable game state, a replay). */
export function draw(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next]
}

/** A generator that keeps its own state. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    const [value, next] = draw(state)
    state = next
    return value
  }
}
