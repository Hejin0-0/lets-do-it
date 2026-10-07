import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { Vector3 } from 'three'
import type { Post } from '../gfx/post'
import { START_Z, WALK_END_Z } from '../world/placement'

/**
 * A fixed evaluator.
 *
 * Borrowed, in shape, from the autoresearch loop skill in
 * `git-clone/2. 에이전트 스킬 라이브러리/claude-skills/engineering/autoresearch-agent`:
 * one command that scores a build, a history file, one change per iteration,
 * keep or discard on the number. Its first rule is the one this project has
 * broken three times — **never modify the evaluator** — and the reason it keeps
 * getting broken here is that the thresholds were calibrated against a scene
 * that then changed by two stops. So this reports *raw measurements* and no
 * pass/fail thresholds at all. A number that means the same thing in every build
 * cannot go stale; a threshold can.
 *
 * `?score` in the browser. Results land on `window.__score`.
 */

/** Poses to score at. Fixed, so two runs are comparable. */
const POSES: { name: string; p: [number, number, number]; look: [number, number, number] }[] = [
  { name: 'down-street', p: [-7.55, 1.68, -20], look: [-6.9, 1.6, -70] },
  { name: 'across', p: [-7.0, 1.68, -52], look: [8.6, 1.5, -55] },
  { name: 'shopfront', p: [7.2, 1.68, -14], look: [9.3, 1.5, -22] },
  { name: 'up-at-roofline', p: [0, 1.68, -60], look: [3.0, 12.0, -78] },
  { name: 'crossing', p: [0, 1.68, -74.5], look: [0.5, 1.6, -110] },
]

export interface PoseScore {
  name: string
  alias: number
  edgePct: number
  edgeMean: number
}

export interface Score {
  /**
   * Mean pixel change under a half-pixel camera shift, in 0..255 luminance.
   *
   * This is edge crawl, measured directly. Nudge the projection by half a pixel
   * and a well-antialiased image barely moves, because every edge is already a
   * weighted average of what is on either side of it; an aliased one flips whole
   * pixels between the two sides and shimmers. It needs no supersampled
   * reference, it costs two ordinary frames, and — unlike comparing the scene
   * render against a bigger one — it measures the *final image*, so it sees
   * post-process antialiasing as well as multisampling.
   */
  aliasError: number
  /** Worst single pose, so an average cannot hide one bad view. */
  aliasWorst: number
  perPose: PoseScore[]
  /** Share of pixels visibly wrong against the reference, averaged over poses. */
  edgePct: number
  /** How wrong those pixels are, in 0..255 luminance. */
  edgeMean: number
  /** Kept in the shape for continuity; the metric no longer supersamples. */
  ss: number
  resolution: [number, number]
}

/** Half a pixel: the worst case for a hard edge, and the smallest real motion. */
const JITTER = 0.5

export async function runScore(deps: {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  post: Post
}): Promise<Score> {
  const { renderer, scene, camera, post } = deps
  const gl = renderer.getContext()
  const W = renderer.domElement.width
  const H = renderer.domElement.height

  const a = new Uint8Array(W * H * 4)
  const b = new Uint8Array(W * H * 4)
  const target = new Vector3()
  const perPose: PoseScore[] = []

  // Film grain is a hash of the pixel and the clock, so it changes between any
  // two frames whatever the geometry does. Left on, it is the only thing this
  // would measure.
  const film = post.composer.passes[post.composer.passes.length - 1] as unknown as {
    material?: { uniforms?: Record<string, { value: number }> }
  }
  const grain = film.material?.uniforms?.uGrain
  const grainWas = grain?.value ?? 0
  if (grain) grain.value = 0

  const lum = (buf: Uint8Array, i: number) =>
    0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]

  // Sixteen frames, not three.
  //
  // Three was enough when every pass was a function of one frame. TAA is not: it
  // converges over the jitter sequence, so reading at frame three measures a
  // half-accumulated image and reports whatever noise is left. Sixteen is two
  // full 8-sample cycles. It costs the harness a fraction of a second and it is
  // the difference between measuring the renderer and measuring its warm-up.
  const shoot = (buf: Uint8Array) => {
    for (let k = 0; k < 16; k++) {
      post.update(camera, 1000)
      post.render()
    }
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf)
  }

  for (const pose of POSES) {
    camera.position.set(...pose.p)
    camera.lookAt(target.set(...pose.look))
    camera.updateMatrixWorld()
    scene.children[0].position.copy(camera.position)

    camera.clearViewOffset()
    // The camera teleports between poses, so nothing accumulated at the last one
    // belongs here. Reprojection rejects most of it on the off-screen test, but
    // "most" is not a number this harness should be built on.
    post.resetHistory()
    shoot(a)
    let ink = 0
    for (let i = 0; i < a.length; i += 4001) ink += a[i]
    if (ink === 0) {
      throw new Error(
        `score: pose "${pose.name}" rendered entirely black. The readback and ` +
          'the target format have to agree, and a silent zero here is exactly ' +
          'what that looks like.',
      )
    }

    // Half a pixel across and half a pixel down.
    camera.setViewOffset(W, H, JITTER, JITTER, W, H)
    camera.updateProjectionMatrix()
    post.resetHistory()
    shoot(b)
    camera.clearViewOffset()
    camera.updateProjectionMatrix()

    let sum = 0
    let bad = 0
    let badSum = 0
    const n = W * H
    for (let i = 0; i < n; i++) {
      const d = Math.abs(lum(a, i * 4) - lum(b, i * 4))
      sum += d
      // 8/255 is about where a one-pixel step stops being deniable on a
      // gradient and starts crawling when the camera moves.
      if (d > 8) {
        bad++
        badSum += d
      }
    }
    perPose.push({
      name: pose.name,
      alias: +(sum / n).toFixed(3),
      edgePct: +((100 * bad) / n).toFixed(3),
      edgeMean: bad ? +(badSum / bad).toFixed(2) : 0,
    })
  }

  if (grain) grain.value = grainWas

  const mean = (f: (p: PoseScore) => number) =>
    +(perPose.reduce((acc, p) => acc + f(p), 0) / perPose.length).toFixed(3)
  return {
    aliasError: mean((p) => p.alias),
    aliasWorst: +Math.max(...perPose.map((p) => p.alias)).toFixed(3),
    edgePct: mean((p) => p.edgePct),
    edgeMean: mean((p) => p.edgeMean),
    perPose,
    ss: 1,
    resolution: [W, H],
  }
}

/** Kept so the poses stay inside the block if the walk bounds move. */
export const POSE_SPAN: [number, number] = [START_Z, WALK_END_Z]
