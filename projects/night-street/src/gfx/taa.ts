import {
  HalfFloatType,
  Matrix4,
  NoBlending,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type DepthTexture,
  type PerspectiveCamera,
  type WebGLRenderer,
} from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

/**
 * Temporal antialiasing, by camera reprojection only.
 *
 * ## Why this and not more MSAA
 *
 * The three things already tried are all in `experiments.tsv`. MSAA 4 on the
 * composer target doubled the frame time (run 1). SMAA cost 5 ms and moved the
 * crawl metric 1.9%, which is nothing (run 2). FXAA is in the chain and is
 * cheap, but it is a spatial filter working from one frame: it can soften an
 * edge, it cannot know where that edge *was*, so it does not stop the edge
 * crawling as the camera moves. Crawl under motion is precisely what the `?score`
 * evaluator measures, and it is the thing left unsolved.
 *
 * TAA is the tool that actually addresses it, because it adds samples over time
 * rather than over space. The camera's projection is jittered by less than a
 * pixel each frame, and each frame is blended into the accumulated history, so a
 * pixel on an edge converges to the average of many sub-pixel positions — a
 * supersample paid for one sample at a time.
 *
 * ## Why no motion vectors
 *
 * The usual objection is that TAA needs a per-object velocity buffer, and
 * producing one here would mean tracking a previous model matrix through the
 * batching in `merge.ts` — which is a large change to the one system in this
 * project that the frame budget depends on.
 *
 * It is not needed, because of a property this scene already has: everything is
 * nailed down. That is the whole premise of the batching — "nothing built
 * through here can move independently. Everything on this street is nailed
 * down". For static geometry, reprojection from depth and the two camera
 * matrices is *exact*: there is no approximation to make.
 *
 * What does move is the two driving cars, and the sky's cloud animation. Those
 * would ghost, and the neighbourhood clamp below is what stops them: history is
 * clamped to the range of colours actually present in the current frame's 3x3
 * neighbourhood, so a pixel the cars have moved through cannot keep showing the
 * car. It is a blunt instrument — it also throws away good history on genuine
 * high-frequency detail — but it is the standard one, and it costs nine texture
 * fetches rather than a second geometry pass.
 *
 * ## Why it renders into its own target and then copies
 *
 * The scene's depth texture is attached to the composer's `renderTarget1`, and
 * this pass has to sample it. Writing the resolve straight into the composer's
 * write buffer would, on the frames where that buffer is rt1, mean sampling a
 * depth attachment of the framebuffer being written — the framebuffer feedback
 * loop documented at length in `post.ts`, which on this driver renders black.
 *
 * So the resolve goes into a history target this pass owns, and a copy moves it
 * into the chain. That is one extra fullscreen blit; the alternative is a bug
 * that only appears on alternate frames.
 */

const RESOLVE = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    tHistory: { value: null as unknown },
    tDepth: { value: null as unknown },
    uInvViewProj: { value: new Matrix4() },
    uPrevViewProj: { value: new Matrix4() },
    uTexel: { value: new Vector2() },
    uFeedback: { value: 0.9 },
    /** 0 on the first frame and after a resize, when there is no history yet. */
    uValid: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tHistory;
    uniform sampler2D tDepth;
    uniform mat4 uInvViewProj;
    uniform mat4 uPrevViewProj;
    uniform vec2 uTexel;
    uniform float uFeedback;
    uniform float uValid;
    varying vec2 vUv;

    void main() {
      vec4 cur = texture2D(tDiffuse, vUv);

      // Reconstruct where this pixel is in the world, then ask where it was on
      // screen last frame.
      //
      // The depth is clamped just short of 1. At exactly 1 the point is on the
      // far plane and the perspective divide loses all precision, which turns
      // the sky into garbage UVs and makes the whole upper half of the frame
      // flicker. Clamped, the sky reconstructs to a point at the far plane —
      // hundreds of metres away — and a walking pace of camera translation moves
      // it by nothing, which is the correct answer for something at infinity.
      float d = min(texture2D(tDepth, vUv).x, 0.999999);
      vec4 wp = uInvViewProj * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      wp /= wp.w;
      vec4 pp = uPrevViewProj * wp;
      vec2 hUv = (pp.xy / pp.w) * 0.5 + 0.5;

      // Anything that was off screen last frame has no history to blend.
      float onScreen = step(0.0, hUv.x) * step(hUv.x, 1.0)
                     * step(0.0, hUv.y) * step(hUv.y, 1.0);

      // The neighbourhood the history is allowed to sit in.
      vec3 lo = cur.rgb;
      vec3 hi = cur.rgb;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 c = texture2D(tDiffuse, vUv + vec2(float(x), float(y)) * uTexel).rgb;
          lo = min(lo, c);
          hi = max(hi, c);
        }
      }

      vec3 hist = clamp(texture2D(tHistory, hUv).rgb, lo, hi);
      gl_FragColor = vec4(mix(cur.rgb, hist, uFeedback * onScreen * uValid), cur.a);
    }
  `,
}

const COPY = {
  uniforms: { tDiffuse: { value: null as unknown } },
  vertexShader: RESOLVE.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() { gl_FragColor = texture2D(tDiffuse, vUv); }
  `,
}

/** Halton, for a low-discrepancy jitter that fills the pixel evenly. */
function halton(index: number, base: number): number {
  let f = 1
  let r = 0
  let i = index
  while (i > 0) {
    f /= base
    r += f * (i % base)
    i = Math.floor(i / base)
  }
  return r
}

const SAMPLES = 8

export class TaaPass extends Pass {
  private resolve = new ShaderMaterial({ ...RESOLVE, blending: NoBlending, depthTest: false, depthWrite: false })
  private copy = new ShaderMaterial({ ...COPY, blending: NoBlending, depthTest: false, depthWrite: false })
  private quadA = new FullScreenQuad(this.resolve)
  private quadB = new FullScreenQuad(this.copy)
  private history: [WebGLRenderTarget, WebGLRenderTarget]
  private read = 0
  private vp = new Matrix4()
  private prevVp = new Matrix4()
  private frame = 0

  constructor(
    private depth: DepthTexture,
    width: number,
    height: number,
  ) {
    super()
    const make = () =>
      new WebGLRenderTarget(width, height, { type: HalfFloatType, depthBuffer: false })
    this.history = [make(), make()]
    this.resolve.uniforms.uTexel.value.set(1 / width, 1 / height)
  }

  /**
   * The sub-pixel offset for this frame, applied straight to the projection
   * matrix rather than through `setViewOffset`.
   *
   * `setViewOffset` is already used by the `?score` harness for its half-pixel
   * shift, and it is not additive — a second call replaces the first. Nudging
   * elements 8 and 9 is the same frustum shear that `makePerspective` writes
   * there, so it composes with whatever view offset is in force instead of
   * fighting it.
   *
   * Call after the camera's projection matrix is otherwise final, once per
   * rendered frame.
   */
  jitter(cam: PerspectiveCamera, width: number, height: number): void {
    cam.updateProjectionMatrix()
    const n = (this.frame % SAMPLES) + 1
    const jx = halton(n, 2) - 0.5
    const jy = halton(n, 3) - 0.5
    cam.projectionMatrix.elements[8] += (2 * jx) / width
    cam.projectionMatrix.elements[9] += (2 * jy) / height

    // The history was rendered with last frame's matrices, jitter included, so
    // that is what the reprojection has to run against.
    this.prevVp.copy(this.vp)
    this.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    this.resolve.uniforms.uInvViewProj.value.copy(this.vp).invert()
    this.resolve.uniforms.uPrevViewProj.value.copy(this.frame === 0 ? this.vp : this.prevVp)
    this.frame++
  }

  override setSize(width: number, height: number): void {
    for (const t of this.history) t.setSize(width, height)
    this.resolve.uniforms.uTexel.value.set(1 / width, 1 / height)
    // Nothing in the old history lines up with the new grid.
    this.reset()
  }

  /** Throw the accumulated history away. Call when the render scale changes. */
  reset(): void {
    this.frame = 0
    this.resolve.uniforms.uValid.value = 0
  }

  override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ): void {
    const dst = this.history[1 - this.read]

    this.resolve.uniforms.tDiffuse.value = readBuffer.texture
    this.resolve.uniforms.tHistory.value = this.history[this.read].texture
    this.resolve.uniforms.tDepth.value = this.depth

    renderer.setRenderTarget(dst)
    this.quadA.render(renderer)

    this.copy.uniforms.tDiffuse.value = dst.texture
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quadB.render(renderer)

    this.read = 1 - this.read
    this.resolve.uniforms.uValid.value = 1
  }

  override dispose(): void {
    for (const t of this.history) t.dispose()
    this.resolve.dispose()
    this.copy.dispose()
    this.quadA.dispose()
    this.quadB.dispose()
  }
}
