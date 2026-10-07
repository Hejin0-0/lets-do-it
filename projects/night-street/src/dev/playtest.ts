import type { PerspectiveCamera, WebGLRenderer } from 'three'
import type { Controls } from '../player/controls'
import type { Post } from '../gfx/post'
import { RUN_SPEED } from '../player/controls'

/**
 * Scripted playtest.
 *
 * The 30+ FPS target in the brief went unverified for the whole build, for a
 * reason worth stating: the only browser available to drive this was never
 * composited, which throttles requestAnimationFrame and defers GPU work, so
 * every wall-clock frame time it produced was implausible — 0.49 ms/frame for a
 * 145k-triangle scene with shadows and a four-pass post chain. Numbers like that
 * are not a fast renderer, they are a renderer that has not run yet.
 *
 * So this harness does not time the animation loop. It steps the simulation at a
 * fixed dt, renders each frame synchronously, and asks the GPU itself how long
 * it took via EXT_disjoint_timer_query_webgl2. That extension is the only thing
 * on this platform that reports GPU time honestly, because it is the GPU
 * reporting it. Where it is unavailable the report says so rather than
 * substituting a CPU number and calling it frame rate.
 *
 * It doubles as a regression check. The worst bug in this project rendered every
 * frame black with no JavaScript error at all, so the harness samples luminance
 * and counts collapses — a class of failure that no unit test on the layout
 * table could ever catch.
 *
 *   npm run dev  ->  http://localhost:5173/?playtest
 */

export interface Percentiles {
  p50: number
  p95: number
  p99: number
  max: number
}

export interface PlaytestReport {
  frames: number
  seconds: number
  cpuMs: Percentiles
  gpuMs: Percentiles | null
  gpuTimerAvailable: boolean
  /** Frames whose centre went essentially black — the silent-failure detector. */
  blackFrames: number
  darkestSample: number
  /** Whole-chain totals for one frame, not just the last pass. */
  drawCalls: number
  triangles: number
  /** Frame times mean nothing without the resolution they were measured at. */
  resolution: [number, number]
  distanceWalked: number
  verdict: string
}

interface Leg {
  label: string
  keys: string[]
  seconds: number
  /** Radians per second of yaw, to exercise look while moving. */
  turn?: number
}

/**
 * The route. Deliberately includes the things that broke: both crossings, a
 * sprint (every gait term scales with speed, so it is the measuring instrument),
 * and looking hard into the sun, which is the most expensive thing the post
 * chain ever has to do.
 */
const ROUTE: Leg[] = [
  { label: 'stand', keys: [], seconds: 1 },
  { label: 'walk to first crossing', keys: ['KeyW'], seconds: 6 },
  { label: 'look right across the street', keys: [], seconds: 2, turn: -0.8 },
  { label: 'look back down the street', keys: [], seconds: 2, turn: 0.8 },
  { label: 'sprint the block', keys: ['KeyW', 'ShiftLeft'], seconds: 12 },
  { label: 'turn into the sun', keys: ['KeyW'], seconds: 3, turn: -0.5 },
  { label: 'walk out of the sun', keys: ['KeyW'], seconds: 3, turn: 0.5 },
  { label: 'strafe to the kerb', keys: ['KeyD'], seconds: 2 },
  { label: 'sprint to the far crossing', keys: ['KeyW', 'ShiftLeft'], seconds: 10 },
  { label: 'stop and look up', keys: [], seconds: 2, turn: 0 },
]

const DT = 1 / 60
/**
 * Where to sample. Centre plus the four quadrants, in fractions of the frame.
 * A collapse is dark at all five; a dark subject is dark at one.
 */
const PATCHES: [number, number][] = [
  [0.5, 0.5],
  [0.25, 0.3],
  [0.75, 0.3],
  [0.25, 0.7],
  [0.75, 0.7],
]
/** With the brightest of those five below this, the frame has collapsed. */
const BLACK = 0.02
/** Frames between luminance samples. readPixels stalls the pipeline, so the
 *  sampled frames are excluded from the timing set rather than skewing it. */
const SAMPLE_EVERY = 20

export async function runPlaytest(deps: {
  renderer: WebGLRenderer
  camera: PerspectiveCamera
  controls: Controls
  post: Post
  syncScene: () => void
}): Promise<PlaytestReport> {
  const { renderer, camera, controls, post, syncScene } = deps
  const gl = renderer.getContext() as WebGL2RenderingContext

  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as
    | { QUERY_COUNTER_EXT?: number; GPU_DISJOINT_EXT: number }
    | null
  const gpuTimerAvailable = !!ext

  const cpu: number[] = []
  const gpu: number[] = []
  const pending: WebGLQuery[] = []
  let blackFrames = 0
  let darkest = 1
  let frames = 0

  const press = (code: string, down: boolean) =>
    window.dispatchEvent(
      new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }),
    )

  const held = new Set<string>()
  const setKeys = (keys: string[]) => {
    for (const k of held) if (!keys.includes(k)) { press(k, false); held.delete(k) }
    for (const k of keys) if (!held.has(k)) { press(k, true); held.add(k) }
  }

  const px = new Uint8Array(4 * 64)

  // renderer.info resets on every render() call, and the composer calls it once
  // per pass — so reading it afterwards reports the final fullscreen quad and
  // nothing else. That is where "1 draw call, 1 triangle" came from. Turning
  // autoReset off and resetting once per frame accumulates the whole chain.
  renderer.info.autoReset = false
  let callsPerFrame = 0
  let trisPerFrame = 0

  for (const leg of ROUTE) {
    setKeys(leg.keys)
    const steps = Math.round(leg.seconds / DT)
    for (let i = 0; i < steps; i++) {
      if (leg.turn) controls.turn(leg.turn * DT)

      controls.update(DT)
      syncScene()
      post.update(camera, performance.now())

      const sampling = frames % SAMPLE_EVERY === 0
      let q: WebGLQuery | null = null
      if (ext && !sampling) {
        q = gl.createQuery()
        if (q) gl.beginQuery((ext as unknown as { TIME_ELAPSED_EXT: number }).TIME_ELAPSED_EXT, q)
      }

      renderer.info.reset()
      const t0 = performance.now()
      post.render()
      const t1 = performance.now()
      callsPerFrame = renderer.info.render.calls
      trisPerFrame = renderer.info.render.triangles

      if (q) {
        gl.endQuery((ext as unknown as { TIME_ELAPSED_EXT: number }).TIME_ELAPSED_EXT)
        pending.push(q)
      }
      if (!sampling) cpu.push(t1 - t0)

      if (sampling) {
        // Five 8x8 patches, not one.
        //
        // This sampled only the centre of the frame, and that is not the same
        // question. The failure it is here to catch blackens *everything* — a
        // zero-size framebuffer, a pass that failed to compile — and a centre
        // patch is a weak proxy for it. What the centre patch actually
        // measures is how dark the thing you are looking at is, and once the
        // grade came down to a real 21:00 that started firing on a parked car
        // filling the middle of the view: 32 frames at 0.0196 against a 0.02
        // threshold set when the scene was two stops brighter. A night scene
        // that reports FAIL for containing something dark is an instrument
        // that has to be argued with, which is worse than no instrument.
        //
        // Taking the *brightest* of five patches spread across the frame asks
        // the right question: is any part of this frame lit? A collapse says no
        // everywhere; a dark car says yes, over there.
        const w = renderer.domElement.width
        const h = renderer.domElement.height
        let brightest = 0
        for (const [fx, fy] of PATCHES) {
          gl.readPixels(
            Math.max(0, Math.round(w * fx) - 4),
            Math.max(0, Math.round(h * fy) - 4),
            8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px,
          )
          let lum = 0
          for (let k = 0; k < 64; k++) {
            lum += (0.2126 * px[k * 4] + 0.7152 * px[k * 4 + 1] + 0.0722 * px[k * 4 + 2]) / 255
          }
          brightest = Math.max(brightest, lum / 64)
        }
        darkest = Math.min(darkest, brightest)
        if (brightest < BLACK) blackFrames++
      }

      frames++
    }
  }
  setKeys([])

  // Drain the timer queries. They resolve a frame or two behind, so this waits
  // rather than reporting whichever happened to be ready.
  if (ext && pending.length) {
    await new Promise<void>((resolve) => {
      const drain = () => {
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
        for (let i = pending.length - 1; i >= 0; i--) {
          const q = pending[i]
          if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue
          // A disjoint means the GPU was interrupted and every outstanding
          // timing is garbage. Discarding is the only honest response.
          if (!disjoint) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6)
          gl.deleteQuery(q)
          pending.splice(i, 1)
        }
        if (pending.length === 0) resolve()
        else setTimeout(drain, 16)
      }
      drain()
    })
  }

  renderer.info.autoReset = true
  const cpuStats = percentiles(cpu)
  const gpuStats = gpu.length > 8 ? percentiles(gpu) : null

  return {
    frames,
    seconds: +(frames * DT).toFixed(1),
    cpuMs: cpuStats,
    gpuMs: gpuStats,
    gpuTimerAvailable,
    blackFrames,
    darkestSample: +darkest.toFixed(4),
    drawCalls: callsPerFrame,
    triangles: trisPerFrame,
    resolution: [renderer.domElement.width, renderer.domElement.height],
    distanceWalked: +controls.distance.toFixed(1),
    verdict: verdictFor(gpuStats, cpuStats, gpuTimerAvailable, blackFrames),
  }
}

function percentiles(v: number[]): Percentiles {
  const s = [...v].sort((a, b) => a - b)
  const at = (q: number) => +(s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0).toFixed(2)
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: +(s[s.length - 1] ?? 0).toFixed(2) }
}

function verdictFor(
  gpu: Percentiles | null,
  cpu: Percentiles,
  timerAvailable: boolean,
  blackFrames: number,
): string {
  if (blackFrames > 0) {
    return `FAIL — ${blackFrames} frame(s) went black. That is the silent-failure class; do not ship it.`
  }
  if (!gpu) {
    return timerAvailable
      ? 'INCONCLUSIVE — the GPU timer reported disjoints for every sample, so no frame time is trustworthy. Re-run in a focused, visible window.'
      : 'INCONCLUSIVE — no EXT_disjoint_timer_query_webgl2, so GPU time is unmeasurable here. ' +
        `CPU submit was p95 ${cpu.p95} ms, which bounds the CPU side only and is not a frame rate.`
  }
  const budget = 1000 / 30
  const ok = gpu.p95 <= budget
  return `${ok ? 'PASS' : 'FAIL'} — GPU p95 ${gpu.p95} ms/frame vs a ${budget.toFixed(1)} ms budget (30 FPS). ` +
    `p99 ${gpu.p99} ms, worst ${gpu.max} ms.`
}

/** Speed the report should be read against, so the route stays comparable. */
export const ROUTE_SPRINT_SPEED = RUN_SPEED
