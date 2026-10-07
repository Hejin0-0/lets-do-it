// The commander's chair (DESIGN §9 Camera): an orbit about the board centre with three zoom
// stops, a yaw clamp, eased transitions and trauma shake. Plain spherical coordinates — the
// player never needs a free camera at a map table, only the next useful seat.
import * as THREE from 'three'
import { TABLE_TOP_Y } from '../contract/render-api.ts'

export type ZoomStop = 'close' | 'commander' | 'gallery' | 'hall' | 'approach'

interface Pose { yaw: number; pitch: number; dist: number; fov: number; ty: number; tz: number }

// Distances solved for 1280x720 against the mounted board (map + lettered margin, ~1.28 x 1.08 m):
// 'commander' puts it at ~70% of the width and 24-86% of the height, the DESIGN §9 frame that
// keeps every HUD corner off the map. (1.55 m, the first guess, filled 94% and put the bottom
// bar and the slip over the board's own margin.)
const STOPS: Record<ZoomStop, Pose> = {
  close: { yaw: 0, pitch: 52, dist: 1.15, fov: 36, ty: 0, tz: 0.06 },
  // 1.75 m (was 1.95): an outside review found the game "hidden inside the room", the board ~55%
  // of the frame with its far edge crowded by the candle rank; the HUD now sits in the corners
  // and right of the slip, so the board can take more of the screen. 1.68 m / pitch 40 (was 1.85 /
  // 38): a blind A/B found the board too small to read at 1.85, while the room strip above it
  // (globe, chair, floor) was worth keeping; ~73% of the width now, with that strip.
  commander: { yaw: 0, pitch: 40, dist: 1.68, fov: 40, ty: 0.05, tz: -0.02 },
  gallery: { yaw: 0, pitch: 34, dist: 4.1, fov: 40, ty: 0.35, tz: 0 },
  // The establishing shot: from the south door down the length of the hall to the lancets, the
  // table and its chandelier in the middle distance (the room's own overview framing). An outside
  // review scored the old intro, the table from 4 m above, as "a single alcove". 9.2 m (was 10.1):
  // past the dark ends of the nearest stacks and the reading tables, which a blind A/B read as
  // "dark masses blocking the frame", so the lit table holds the centre under the chandelier.
  hall: { yaw: 2, pitch: -2.4, dist: 9.2, fov: 58, ty: 1.6, tz: -4.5 },
  // Where the intro's slow push-in ends: still in the hall, but the war-table and its board now
  // hold the middle of the frame (the hall shot alone gave the board ~4% of it).
  approach: { yaw: 0, pitch: 38, dist: 3.2, fov: 50, ty: 0, tz: 0 },
}
const YAW_MAX = 35

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  stop: ZoomStop = 'commander'
  private cur: Pose = { ...STOPS.commander }
  private goal: Pose = { ...STOPS.commander }
  private yawOffset = 0
  private trauma = 0
  private shakeT = 0
  reducedMotion = false
  private readonly target = new THREE.Vector3()
  private lag = 0.18
  private portrait = false
  private aspect = 16 / 9
  // The director's nudge (lookToward): a world-space (x, z) shift of the look target toward the
  // action, eased in, held, then eased home. An outside review found the camera never followed a
  // barrage, an assault or a capture. `calm` is the time since the player last zoomed or yawed:
  // the director never argues with the player's own hand.
  private readonly nudge = new THREE.Vector2()
  private readonly nudgeGoal = new THREE.Vector2()
  private nudgeHold = 0
  private calm = 0
  private overridden = false

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
  }

  // `lag` is this transition's time constant: 0.18 s for a zoom step, longer for the intro's glide.
  setStop(s: ZoomStop, snap = false, lag = 0.18): void {
    this.stop = s
    this.lag = lag
    this.goal = this.pose(s)
    this.home()
    if (snap) { this.cur = { ...this.goal }; this.nudge.set(0, 0) }
  }

  // Lean the look target toward a world point: 30% of the way, at most 6 cm, held 1.4 s. Only from
  // the two seats at the table (commander, close), never under the staff map or reduced motion,
  // and not within 2 s of the player's own zoom or yaw.
  lookToward(x: number, z: number): void {
    if (this.reducedMotion || this.overridden || this.calm > 0) return
    if (this.stop !== 'commander' && this.stop !== 'close') return
    this.nudgeGoal.set(x * 0.3, (z - this.goal.tz) * 0.3)
    if (this.nudgeGoal.length() > 0.06) this.nudgeGoal.setLength(0.06)
    this.nudgeHold = 1.4
  }

  private home(): void {
    this.nudgeGoal.set(0, 0)
    this.nudgeHold = 0
  }

  // Portrait phones (DESIGN G11): the board turns 90 degrees so its 13 columns run up the screen,
  // and the seat backs off until the 9 rows (0.95 m of map) fill the width. An outside review on
  // 390x844 found the outer columns cut off with no way to reach them.
  setAspect(a: number): void {
    this.aspect = a
    this.portrait = a < 0.8
    if (!this.overridden) this.goal = this.pose(this.stop)
  }

  private pose(s: ZoomStop): Pose {
    const base = { ...STOPS[s], yaw: this.yawOffset }
    // narrower than 1.5:1 (a 4:3 tablet held landscape) the chair backs off with the aspect: at
    // 1024x768 the board's near corners met the frame edges
    // and backs off as the player yaws: turned 35 degrees the board's near corner left the frame
    if (!this.portrait && s === 'commander') base.dist *= Math.max(1, 1.5 / this.aspect) * (1 + Math.abs(this.yawOffset) * 0.008)
    if (!this.portrait || s === 'hall' || s === 'approach') return base
    const fov = 52
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * this.aspect)
    const fit = (w: number) => w / (2 * Math.tan(half))
    // 1.32 m: the whole mount (map + lettered margin + oak lip) with the near edge's perspective
    // spread — at 1.0 m, then 1.14 m, a 768x1024 tablet clipped the
    // board's left and right edges (outside review)
    const dist = s === 'close' ? fit(0.62) : s === 'gallery' ? fit(1.6) : fit(1.32)
    return { ...base, yaw: 90 + this.yawOffset, pitch: s === 'gallery' ? 40 : 62, dist, fov, tz: 0 }
  }

  zoom(delta: 1 | -1): void {
    // The last step out is the hall itself: the room is worth more than one look at the intro.
    const order: ZoomStop[] = ['close', 'commander', 'gallery', 'hall']
    const at = Math.max(0, order.indexOf(this.stop))
    const i = Math.max(0, Math.min(order.length - 1, at + delta))
    this.setStop(order[i], false, order[i] === 'hall' || this.stop === 'hall' ? 0.6 : 0.18)
    this.calm = 2
  }

  yaw(deg: number): void {
    this.yawOffset = Math.max(-YAW_MAX, Math.min(YAW_MAX, this.yawOffset + deg))
    if (this.overridden) this.goal.yaw = this.yawOffset + (this.portrait && this.stop !== 'hall' ? 90 : 0)
    else this.goal = this.pose(this.stop)
    this.home()
    this.calm = 2
  }

  shake(t: number): void {
    if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + t)
  }

  // A fixed pose for intro/staff shots; `null` returns to the current stop.
  override(p: Partial<Pose> | null): void {
    this.goal = p ? { ...this.pose(this.stop), ...p } : this.pose(this.stop)
    this.overridden = p !== null
    this.home()
  }

  snap(): void {
    this.cur = { ...this.goal }
    this.apply(0)
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt / this.lag)
    const c = this.cur, g = this.goal
    c.yaw += (g.yaw - c.yaw) * k
    c.pitch += (g.pitch - c.pitch) * k
    c.dist += (g.dist - c.dist) * k
    c.fov += (g.fov - c.fov) * k
    c.ty += (g.ty - c.ty) * k
    c.tz += (g.tz - c.tz) * k
    this.calm = Math.max(0, this.calm - dt)
    if (this.nudgeHold > 0) {
      this.nudgeHold -= dt
      if (this.nudgeHold <= 0) this.nudgeGoal.set(0, 0)
    }
    this.nudge.lerp(this.nudgeGoal, 1 - Math.exp(-dt / 0.45)) // slower than a zoom step: a lean, not a cut
    this.apply(dt)
  }

  private apply(dt: number): void {
    const c = this.cur
    const yaw = THREE.MathUtils.degToRad(c.yaw), pitch = THREE.MathUtils.degToRad(c.pitch)
    this.target.set(this.nudge.x, TABLE_TOP_Y + c.ty, c.tz + this.nudge.y)
    const h = c.dist * Math.cos(pitch)
    this.camera.position.set(
      this.target.x + Math.sin(yaw) * h,
      this.target.y + c.dist * Math.sin(pitch),
      this.target.z + Math.cos(yaw) * h,
    )
    this.camera.lookAt(this.target)
    // trauma^2 shake, decaying 1.4/s (threejs-gameplay-systems game-feel).
    if (this.trauma > 0) {
      this.shakeT += dt
      const s = this.trauma * this.trauma * 0.012
      this.camera.position.x += Math.sin(this.shakeT * 61.3) * s
      this.camera.position.y += Math.sin(this.shakeT * 47.9 + 1.3) * s
      this.trauma = Math.max(0, this.trauma - 1.4 * dt)
    }
    if (Math.abs(this.camera.fov - c.fov) > 0.01) {
      this.camera.fov = c.fov
      this.camera.updateProjectionMatrix()
    }
  }
}
