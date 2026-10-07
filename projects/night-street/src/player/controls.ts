import type { PerspectiveCamera } from 'three'
import { CURB_HEIGHT, ROAD_HALF, START_Z, type Rect } from '../world/placement'
import { resolve } from './collide'
import { roadY } from '../scene/street'
import { inputAxes, moveVector } from './heading'

/**
 * First-person walk.
 *
 * The brief specified a slow walk, no sprint, no jump. Prompt 2's addendum —
 * "don't forget to add shift button so that it can run faster lol (optional)" —
 * added the sprint, and it turned out to be a measuring instrument as much as a
 * control. Every term in the gait model below scales with speed, so a coupling
 * error that is a millimetre of wobble at 1.4 m/s is a centimetre of lurch at
 * 3.1, and two bugs in the head-bob were found by holding shift rather than by
 * reading the code.
 */

/**
 * 1.4 m/s is accurate human walking pace, and that is exactly why it was wrong.
 * A 58-degree field of view compresses optical flow, so a physically correct
 * walk reads as a crawl on a monitor — which is why essentially every
 * first-person game runs 1.5-2x real pace. Reported as "too slow" by the first
 * person to actually play it, which outranks the brief's "slow walk".
 */
export const WALK_SPEED = 2.3
export const RUN_SPEED = 4.8
export const EYE_HEIGHT = 1.68

export interface Controls {
  update(dt: number): void
  /**
   * Ask for pointer lock. Must be called from inside a user gesture.
   *
   * This is exported rather than left to the canvas's own click handler because
   * the start overlay covers the canvas: the first click lands on the overlay,
   * so a listener bound to the canvas never sees it. See main.ts.
   */
  requestLook(): void
  /** True when the browser refused pointer lock, so the HUD can say so. */
  readonly lockFailed: boolean
  /** Metres walked, for the gait and the footstep audio. */
  readonly distance: number
  readonly speed: number
  /** True while a surface is taking velocity off you. */
  readonly blocked: boolean
  /**
   * Turn the view, in radians of yaw.
   *
   * For the scripted playtest, which has no pointer to lock. It used to write
   * `camera.rotation.y` directly and `update()` overwrote it from its own yaw
   * on the very next line, so the route's four look-around legs had never once
   * turned the camera — twelve seconds of the run were exercising a view that
   * never moved.
   */
  turn(dYaw: number): void
  /** Fires once per footfall, with true for the left foot. */
  onStep?: (left: boolean, speed: number) => void
  readonly locked: boolean
  dispose(): void
}

export function createControls(
  camera: PerspectiveCamera,
  colliders: Rect[],
  dom: HTMLElement,
): Controls {
  const keys = new Set<string>()
  let yaw = 0
  let pitch = -0.02
  let px = -7.55
  let pz = START_Z
  let distance = 0
  let speed = 0
  let bobPhase = 0
  let lastFoot = -1
  let locked = false
  let lockFailed = false
  // Fallback when pointer lock is refused: drag with the button held.
  let dragging = false

  // Momentum, so a keypress is not a step function. Real walking has about a
  // fifth of a second of acceleration in it and the camera notices.
  let vx = 0
  let vz = 0
  let blocked = false

  const api: Controls = {
    update,
    requestLook,
    turn(dYaw: number) {
      yaw += dYaw
    },
    get distance() {
      return distance
    },
    get speed() {
      return speed
    },
    /**
     * Whether a surface took velocity off you this frame.
     *
     * The HUD shows it because "why did I slow down" was a real question with a
     * real answer that nothing in the build exposed. There is no stamina in this
     * controller — running is a held key and nothing else — so when a run turns
     * into a walk it is always contact, and now it says so.
     */
    get blocked() {
      return blocked
    },
    get locked() {
      return locked
    },
    get lockFailed() {
      return lockFailed
    },
    dispose() {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousemove', onMouse)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('pointerlockerror', onLockError)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('mouseup', onUp)
      dom.removeEventListener('click', requestLook)
    },
  }

  function onKey(e: KeyboardEvent) {
    keys.add(e.code)
    // Space and the arrow keys scroll the page otherwise, which is jarring even
    // with the canvas full-bleed.
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code)
  }
  function onMouse(e: MouseEvent) {
    // Drag-to-look is the fallback for contexts that refuse pointer lock
    // outright — some embedded and cross-origin frames do — so the view is
    // never simply stuck.
    if (!locked && !dragging) return
    yaw -= e.movementX * 0.0022
    pitch -= e.movementY * 0.0022
    // Just short of straight up and down. Reaching the pole makes the yaw axis
    // degenerate and the view spins.
    pitch = Math.max(-1.45, Math.min(1.35, pitch))
  }
  function onLockChange() {
    locked = document.pointerLockElement === dom
    if (locked) lockFailed = false
    if (!locked) keys.clear()
  }
  function onLockError() {
    lockFailed = true
  }
  function onDown(e: MouseEvent) {
    if (e.button === 0) dragging = true
  }
  function onUp() {
    dragging = false
  }

  function requestLook(): void {
    if (locked) return
    // requestPointerLock returns a promise in current browsers and rejects if
    // the gesture is stale or the document is not focused. Dropping it on the
    // floor produces an unhandled rejection and no visible reason for the view
    // not moving, which is exactly how this shipped broken.
    // unadjustedMovement turns off the operating system's pointer acceleration
    // for the locked pointer. Without it, movementX has the desktop's own
    // curve baked in: a slow drag and a fast flick of the same physical
    // distance turn the view by different amounts, which is what "the mouse
    // sensitivity feels wrong" is. Games disable it for exactly this reason.
    //
    // Not universally supported, and Chrome *rejects* the promise rather than
    // ignoring the option, so a refusal falls back to a plain lock instead of
    // being read as a failure.
    type LockFn = (o?: { unadjustedMovement?: boolean }) => Promise<void> | undefined
    const lock = dom.requestPointerLock as unknown as LockFn
    const plain = () => {
      const p = lock.call(dom) as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(() => { lockFailed = true })
    }
    let r: Promise<void> | undefined
    try {
      r = lock.call(dom, { unadjustedMovement: true }) as Promise<void> | undefined
    } catch {
      plain()
      return
    }
    // No promise means an older implementation that ignored the option and
    // locked synchronously — already done, nothing to fall back to.
    if (r && typeof r.catch === 'function') r.catch(plain)
  }

  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  document.addEventListener('mousemove', onMouse)
  document.addEventListener('mousedown', onDown)
  document.addEventListener('mouseup', onUp)
  document.addEventListener('pointerlockchange', onLockChange)
  document.addEventListener('pointerlockerror', onLockError)
  // Kept so ESC-then-click re-locks. The overlay's first click is handled by
  // main.ts calling requestLook directly.
  dom.addEventListener('click', requestLook)

  function update(dt: number) {
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const target = running ? RUN_SPEED : WALK_SPEED

    const [ix, iz] = inputAxes((c) => keys.has(c))
    const mag = Math.hypot(ix, iz)

    // Input is in camera space; rotate it into the street. Both of these live in
    // heading.ts as pure functions so tools/heading.test.mjs can sweep every yaw
    // — the inline version of this rotation was inverted and only wrong when you
    // faced across the street, which no test that walked down it ever caught.
    const [mx, mz] = moveVector(ix, iz, yaw)
    const wantX = mx * target
    const wantZ = mz * target

    // Shortened with the speed increase: the old 0.18 s ramp that felt like
    // weight at 1.4 m/s feels like mud at 2.3.
    const accel = mag > 0 ? 1 - Math.exp(-dt / 0.12) : 1 - Math.exp(-dt / 0.09)
    vx += (wantX - vx) * accel
    vz += (wantZ - vz) * accel
    if (Math.hypot(vx, vz) < 0.01) {
      vx = 0
      vz = 0
    }

    const hit = resolve(px + vx * dt, pz + vz * dt, colliders)
    const nx = hit.x
    const nz = hit.z

    // Take the velocity *into* the surface away and leave the rest.
    //
    // This is the standard character-controller response and it replaced two
    // attempts at a heuristic. The first multiplied by 0.2 the instant more
    // than half a step was blocked, throwing away 80% of the speed in one
    // frame. The second scaled by the fraction of the step that got through,
    // which is continuous but still wrong: it is an *axis-aligned* measure of
    // a resolution that is not axis-aligned, so sliding along anything at an
    // angle bled speed that had in fact got through, and the result was a
    // judder you could feel but not point at.
    //
    // Projecting onto the surface has no such gap. Head-on, the whole velocity
    // is into the surface and all of it goes; at a graze, almost none of it is,
    // and almost none goes. Nothing to tune.
    blocked = false
    if (hit.nx !== 0 || hit.nz !== 0) {
      const into = vx * hit.nx + vz * hit.nz
      if (into < 0) {
        vx -= hit.nx * into
        vz -= hit.nz * into
        blocked = true
      }
    }
    // *After* the bleed, so the gait, the footsteps and the HUD read what the
    // body actually did rather than what the keys asked for. Walking into a
    // wall used to keep bobbing at full stride.
    speed = Math.hypot(vx, vz)
    distance += Math.hypot(nx - px, nz - pz)
    px = nx
    pz = nz

    // ---- gait ------------------------------------------------------------
    // Stride length grows with speed — people do not just take faster steps,
    // they take longer ones — so the step rate is sub-linear in speed. Getting
    // this wrong is what makes a sprint look like a fast walk on film.
    const stride = 0.75 + 0.11 * speed
    const stepsPerSecond = speed / stride
    bobPhase += stepsPerSecond * dt * Math.PI
    if (speed === 0) bobPhase += 0 // freeze the phase rather than resetting it

    // Footfall: every half cycle of the stride phase.
    const foot = Math.floor(bobPhase / Math.PI)
    if (foot !== lastFoot && speed > 0.35) {
      lastFoot = foot
      api.onStep?.(foot % 2 === 0, speed)
    }

    // Every term below is scaled by the same speed factor. Vertical bob is at
    // twice the stride rate (both feet dip the body), sway and roll at once.
    const gait = Math.min(1, speed / RUN_SPEED)
    const amp = 0.020 + 0.028 * gait
    const bobY = Math.cos(bobPhase * 2) * amp
    const swayX = Math.sin(bobPhase) * (0.012 + 0.020 * gait)
    const roll = Math.sin(bobPhase) * (0.004 + 0.011 * gait)

    // Ground height: the pavement is a step up from the road.
    const onPavement = Math.abs(px) > ROAD_HALF
    const ground = onPavement ? CURB_HEIGHT : roadY(px)

    camera.position.set(
      px + Math.cos(yaw) * swayX,
      ground + EYE_HEIGHT + bobY,
      pz - Math.sin(yaw) * swayX,
    )
    camera.rotation.set(pitch, yaw, roll, 'YXZ')
  }

  return api
}

