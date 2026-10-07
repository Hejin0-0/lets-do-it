/**
 * Input heading, as pure arithmetic.
 *
 * This module imports nothing, for the same reason `world/placement.ts` imports
 * nothing: it can then be exercised under bare node by `tools/heading.test.mjs`,
 * against exactly the numbers the controller uses.
 *
 * It exists at all because the version of this that lived inline in the
 * controller was wrong, and wrong in a way that hid:
 *
 *     wantX = ix * cos - iz * sin
 *     wantZ = ix * sin + iz * cos
 *
 * That is a rotation by *minus* yaw. It agrees with the correct answer exactly
 * at yaw 0 and yaw 180 — walking straight down the street, which is what the
 * scene invites you to do and what every test happened to check — and is exactly
 * negated at plus or minus 90 degrees. So movement was correct while you faced
 * along the street and fully reversed once you turned to face across it, which is
 * why it was reported as "sometimes the keys come out backwards" rather than as
 * "movement is broken".
 */

/**
 * Three's camera looks down its local -Z. Rotated by `yaw` about Y that gives
 * a world forward of (-sin yaw, 0, -cos yaw), and a right of (cos yaw, 0, -sin yaw).
 */
export function cameraForward(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)]
}

export function cameraRight(yaw: number): [number, number] {
  return [Math.cos(yaw), -Math.sin(yaw)]
}

/**
 * Rotate a camera-space input into world space.
 *
 * `ix` is strafe (+1 right), `iz` is forward/back in camera-local terms, so -1
 * is forward — matching the local -Z the camera looks down. Returns world X/Z.
 */
export function moveVector(ix: number, iz: number, yaw: number): [number, number] {
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  // R_y(yaw) applied to (ix, 0, iz).
  return [ix * cos + iz * sin, -ix * sin + iz * cos]
}

/** Normalised input from the held-key set, before rotation. */
export function inputAxes(has: (code: string) => boolean): [number, number] {
  let ix = 0
  let iz = 0
  if (has('KeyW') || has('ArrowUp')) iz -= 1
  if (has('KeyS') || has('ArrowDown')) iz += 1
  if (has('KeyA') || has('ArrowLeft')) ix -= 1
  if (has('KeyD') || has('ArrowRight')) ix += 1
  const mag = Math.hypot(ix, iz)
  if (mag > 0) {
    ix /= mag
    iz /= mag
  }
  return [ix, iz]
}
