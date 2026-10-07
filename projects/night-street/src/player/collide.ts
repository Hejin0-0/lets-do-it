// Explicit extension: node's type-stripping loader resolves this file directly
// when tools/collide.test.mjs imports it, and it will not guess at extensions.
// Vite is happy either way.
import { START_Z, WALK_END_Z, WALK_HALF, type Rect } from '../world/placement.ts'

/** How wide the player is, for the disc-versus-box test. */
export const RADIUS = 0.32

/**
 * Movement against the street's colliders.
 *
 * Imports nothing that touches three, so `tools/collide.test.mjs` can drive it
 * directly — the same arrangement as heading.ts, and for the same reason: the
 * bug this file exists to fix was invisible to every test that only walked in a
 * straight line down an empty street.
 *
 * **What was wrong.** The previous version *rejected* a blocked move rather
 * than resolving it:
 *
 * ```ts
 * if (hits(x, fromZ, c)) x = fromX   // the whole step, thrown away
 * ```
 *
 * Two things follow from that, and both were reported from play. The first is
 * that brushing a bin at a shallow angle cancels the entire X component of the
 * step instead of the two centimetres that actually overlapped. The second is
 * worse: the caller bleeds velocity in proportion to how much of the step got
 * through, which with a binary reject is either all of it or **none of it** —
 * so grazing a collider sets that axis's velocity to exactly zero and a run
 * stops dead. The comment there described a continuous response that the
 * resolution method made impossible.
 *
 * Replacing that with a push to the nearest contact *face* fixed the graze and
 * introduced a second bug at corners, which took a play report and a per-frame
 * trace to find — see `separate`. The current version resolves the disc
 * radially, which handles faces and corners with the same arithmetic.
 */

/** A tenth of a millimetre of clearance, so "resolved" means resolved. */
const SKIN = 1e-4

/**
 * Result of a move: where you ended up, and the direction you were pushed.
 *
 * The normal is what the caller needs to respond correctly — see the note on
 * velocity in controls.ts. It is zero when nothing was in the way.
 */
export interface Move {
  x: number
  z: number
  /** Unit vector out of the surface, or (0, 0) if nothing was hit. */
  nx: number
  nz: number
}

// Reused across frames. This runs every frame over ~126 colliders and there is
// no reason for it to allocate.
const pushX: number[] = []
const pushZ: number[] = []
const out: Move = { x: 0, z: 0, nx: 0, nz: 0 }

/**
 * Move to (toX, toZ), separated from every collider.
 *
 * The structure here — gather every separating vector, then apply the longest
 * and project the rest onto its normal — is GDevelop's
 * `moveFollowingSeparatingVectors`, and it is here because resolving colliders
 * *sequentially* does not work. Pushing clear of one collider can push you into
 * the next, and the next pass pushes you back; between a lamp post and the kerb
 * that is a standing oscillation, and what it feels like is being stopped by
 * nothing. Looping more times does not fix it, it just picks a different frame
 * to give up on.
 *
 * Taking all the vectors at once and combining them cannot ping-pong, because
 * there is only ever one move.
 */
export function resolve(toX: number, toZ: number, colliders: Rect[]): Move {
  // The clamps are surfaces, and have to report themselves as such.
  //
  // They used to move the position and say nothing, so `resolve` returned a
  // zero normal whenever the street edge or the end of the block was what
  // stopped you. `controls.update` projects velocity onto the reported normal,
  // so with no normal it projected nothing: you could stand pinned against the
  // frontages with the velocity still pointing into them at full run speed, and
  // `controls.speed` — which the gait, the footsteps and the HUD all read —
  // reported 4.8 m/s while you were not moving at all.
  //
  // The felt symptom is the one that got reported: run along a wall, turn away
  // from it, and the stored velocity is still aimed at the wall, so the 0.12 s
  // ramp has to swing a full-speed vector round to the new heading before you
  // go anywhere. It reads as dropping to a walk for no reason, and it is not
  // stamina — there is no stamina in this controller.
  let x = clampToStreet(toX)
  let z = clampZ(toZ)
  let edgeX = x - toX
  let edgeZ = z - toZ
  pushX.length = 0
  pushZ.length = 0

  for (const c of colliders) {
    const px = Math.max(c.x - c.hx, Math.min(x, c.x + c.hx))
    const pz = Math.max(c.z - c.hz, Math.min(z, c.z + c.hz))
    let dx = x - px
    let dz = z - pz
    const d = Math.hypot(dx, dz)
    if (d >= RADIUS) continue
    if (d > 1e-6) {
      const k = (RADIUS + SKIN - d) / d
      pushX.push(dx * k)
      pushZ.push(dz * k)
      continue
    }
    // Dead centre inside the box: no direction to push along, so leave by the
    // nearer face. Only reachable if a collider appears on top of a standing
    // player, but a NaN here would be a very confusing bug.
    const outX = c.hx - Math.abs(x - c.x)
    const outZ = c.hz - Math.abs(z - c.z)
    if (outX < outZ) {
      pushX.push((x < c.x ? -1 : 1) * (outX + RADIUS + SKIN))
      pushZ.push(0)
    } else {
      pushX.push(0)
      pushZ.push((z < c.z ? -1 : 1) * (outZ + RADIUS + SKIN))
    }
  }

  let ax = 0
  let az = 0
  if (pushX.length === 1) {
    ax = pushX[0]
    az = pushZ[0]
  } else if (pushX.length > 1) {
    // Longest vector wins.
    let best = 0
    let bestSq = 0
    for (let i = 0; i < pushX.length; i++) {
      const sq = pushX[i] * pushX[i] + pushZ[i] * pushZ[i]
      if (sq > bestSq) {
        bestSq = sq
        best = i
      }
    }
    const len = Math.sqrt(bestSq)
    ax = pushX[best]
    az = pushZ[best]
    if (len > 1e-9) {
      // Its normal, and how far the other vectors want to go along it.
      const vx = -pushZ[best] / len
      const vz = pushX[best] / len
      let lo = 0
      let hi = 0
      for (let i = 0; i < pushX.length; i++) {
        const dot = pushX[i] * vx + pushZ[i] * vz
        lo = Math.min(lo, dot)
        hi = Math.max(hi, dot)
      }
      // Only add the sideways component when they all agree about which way it
      // goes; two colliders pushing opposite ways cancel, which is right — you
      // are in a gap that is exactly your width.
      const loNegligible = -lo < hi / 1048576
      const hiNegligible = hi < -lo / 1048576
      if (loNegligible !== hiNegligible) {
        const extra = hiNegligible ? lo : hi
        ax += extra * vx
        az += extra * vz
      }
    }
  }

  const wantX = x + ax
  const wantZ = z + az
  x = clampToStreet(wantX)
  z = clampZ(wantZ)
  edgeX += x - wantX
  edgeZ += z - wantZ

  // Fold the edges in with the collider push. What the caller needs is the
  // direction the world moved it, and it does not care which of the two did it.
  ax += edgeX
  az += edgeZ

  const len = Math.hypot(ax, az)
  out.x = x
  out.z = z
  out.nx = len > 1e-9 ? ax / len : 0
  out.nz = len > 1e-9 ? az / len : 0
  return out
}

/** Disc of RADIUS at (x, z) against an axis-aligned box. */
export function hits(x: number, z: number, c: Rect): boolean {
  const dx = Math.abs(x - c.x) - c.hx
  const dz = Math.abs(z - c.z) - c.hz
  if (dx < 0 && dz < 0) return true
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) < RADIUS
}

/** You may walk the pavements and the road, but not through a shopfront. */
export function clampToStreet(x: number): number {
  const limit = WALK_HALF - RADIUS - 0.04
  return Math.max(-limit, Math.min(limit, x))
}

/** The block ends. You may look past them but not walk past them. */
export function clampZ(z: number): number {
  return Math.min(START_Z + 1.5, Math.max(WALK_END_Z, z))
}
