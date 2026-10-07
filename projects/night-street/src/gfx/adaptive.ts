/**
 * Dynamic resolution.
 *
 * The scene measures 29.3 ms at the 95th percentile on the machine it was built
 * on, against a 33.3 ms budget. That is a pass and it is also not something to
 * ship on: it says nothing about the machine it will actually run on, and a
 * fixed render scale turns a slower GPU into a slideshow rather than into a
 * slightly softer picture. Every shipping game solves this the same way —
 * measure the frame, move the resolution, hold the frame rate — and it is worth
 * far more here than any single effect, because it is the difference between
 * "runs at 60 on my laptop" and "runs".
 *
 * Three things make the difference between this working and it oscillating:
 *
 *  - **Median, not mean.** One 40 ms frame from a garbage collection is not a
 *    reason to drop resolution, and a mean cannot tell the two apart.
 *  - **Asymmetric thresholds.** It comes down quickly when the frame is over
 *    budget and goes back up slowly and only when there is real margin, so a
 *    scene that is marginal settles instead of hunting.
 *  - **A cooldown.** Resizing reallocates every render target in the post
 *    chain, which itself costs a frame; doing that every frame would be its own
 *    performance problem.
 */

export interface Adaptive {
  /** Call once per frame with the frame's duration in ms. */
  sample(ms: number): void
  /** Current scale, 0..1 of the display's native pixel ratio. */
  readonly scale: number
  /** For the HUD. */
  readonly medianMs: number
}

const WINDOW = 45
/** Below this the frame has margin to spare; above it, it does not. */
const TARGET_MS = 16.7
const RAISE_BELOW = TARGET_MS * 0.78
const LOWER_ABOVE = TARGET_MS * 1.02
const MIN_SCALE = 0.55
const STEP_DOWN = 0.09
const STEP_UP = 0.045
/** Seconds between changes. A resize reallocates the whole post chain. */
const COOLDOWN = 0.9

export function createAdaptive(
  maxScale: number,
  apply: (scale: number) => void,
): Adaptive {
  const ring = new Float32Array(WINDOW)
  const sorted = new Float32Array(WINDOW)
  let filled = 0
  let head = 0
  let scale = maxScale
  let sinceChange = 0
  let median = TARGET_MS

  return {
    get scale() {
      return scale
    },
    get medianMs() {
      return median
    },
    sample(ms: number) {
      // A tab that has been in the background hands back a dt of seconds. That
      // is not a slow frame, it is no frame at all, and letting it into the
      // window would drop the resolution to the floor on every alt-tab.
      if (!(ms > 0) || ms > 200) return
      ring[head] = ms
      head = (head + 1) % WINDOW
      if (filled < WINDOW) filled++
      sinceChange += ms / 1000
      if (filled < WINDOW || sinceChange < COOLDOWN) return

      sorted.set(ring)
      const view = sorted.subarray(0, WINDOW)
      view.sort()
      median = view[WINDOW >> 1]

      let next = scale
      if (median > LOWER_ABOVE) next = Math.max(MIN_SCALE, scale - STEP_DOWN)
      else if (median < RAISE_BELOW) next = Math.min(maxScale, scale + STEP_UP)

      if (Math.abs(next - scale) > 1e-3) {
        scale = next
        sinceChange = 0
        apply(scale)
        // The frames straight after a resize are not representative — the
        // targets were just reallocated — so the window starts again rather
        // than immediately arguing for another change.
        filled = 0
        head = 0
      } else {
        sinceChange = 0
      }
    },
  }
}
