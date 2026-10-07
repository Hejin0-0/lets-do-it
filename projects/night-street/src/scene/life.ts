import { Color, type MeshBasicMaterial } from 'three'
import type { NeonSign } from './buildings'
import { SUN_UP } from './sun'

/**
 * The small things that stop a street being a photograph.
 *
 * A tube that has not got long left is the cheapest life there is: one sign on
 * the block, misbehaving on a schedule nobody can quite predict, and the whole
 * street stops reading as a still. It costs a colour assignment per frame.
 *
 * The pattern matters more than the amplitude. A sine wave reads as a pulsing
 * prop; a real failing tube sits dead for a second or two, stutters half a
 * dozen times in a fifth of a second, catches, holds, and drops out again. So
 * this is a state machine with a hold, not a waveform.
 */

/** How many of the block's neon signs are on their way out. */
const FAILING = 2

interface Flicker {
  mat: MeshBasicMaterial
  glowMat: MeshBasicMaterial | null
  base: Color
  glowBase: Color | null
  /** Seconds between one bout of stuttering and the next. */
  period: number
  offset: number
  seed: number
}

export interface Life {
  update(t: number): void
}

export function createLife(neon: NeonSign[]): Life {
  const flickers: Flicker[] = []

  if (!SUN_UP) {
    // Deterministic pick: the same signs fail on every load, so a screenshot of
    // the street is reproducible and a bug report about one of them can be
    // followed up.
    const sorted = [...neon].sort((a, b) => a.seed - b.seed)
    for (let i = 0; i < Math.min(FAILING, sorted.length); i++) {
      const sign = sorted[Math.floor((i * sorted.length) / FAILING)]
      const mat = sign.board.material as MeshBasicMaterial
      const glowMat = (sign.glow?.material as MeshBasicMaterial) ?? null
      flickers.push({
        mat,
        glowMat,
        base: mat.color.clone(),
        glowBase: glowMat ? glowMat.color.clone() : null,
        period: 6.5 + (sign.seed % 7),
        offset: (sign.seed % 100) / 100,
        seed: sign.seed,
      })
    }
  }

  function update(t: number): void {
    const secs = t / 1000
    for (const f of flickers) {
      const phase = ((secs / f.period + f.offset) % 1) * f.period
      // A bout lasts about a fifth of a second. Outside it the tube is simply
      // on, which is most of the time — a sign that flickers constantly reads
      // as a strobe, not as a fault.
      let level = 1
      if (phase < 0.22) {
        // Inside the bout: a square-ish stutter with an irregular duty cycle,
        // driven by a hash so it is not a visible rhythm.
        const k = Math.floor(phase * 90 + f.seed)
        const h = ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1
        level = h > 0.45 ? 1 : 0.06 + h * 0.3
      } else if (phase < 0.34) {
        // Catching: it comes back up over a few frames rather than snapping.
        level = 0.55 + ((phase - 0.22) / 0.12) * 0.45
      }
      f.mat.color.copy(f.base).multiplyScalar(level)
      if (f.glowMat && f.glowBase) f.glowMat.color.copy(f.glowBase).multiplyScalar(level)
    }
  }

  return { update }
}
