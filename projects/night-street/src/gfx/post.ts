import {
  Color,
  DepthTexture,
  HalfFloatType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GLARE_STRENGTH, SUN_COLOR, SUN_DIR } from '../scene/sun'
import { TaaPass } from './taa'

/**
 * Build order system 8: post-processing.
 *
 * The chain is ordered by where each effect physically happens, which is not
 * the order it is convenient to write them in:
 *
 *   1. render                 linear HDR
 *   2. aerial haze            in the scene, needs depth — so before bloom,
 *                             which does not preserve it
 *   3. bloom                  in the lens, on linear light
 *   4. veiling glare          also the lens, but wants the bloomed image
 *   5. tone map + encode      the sensor
 *   6. grain, vignette, CA    the sensor and the lens barrel, in display space
 *
 * Steps 2 and 6 are separate passes for that reason and not because two passes
 * were easier. Grain in particular has to land after the tone curve: applied
 * before it, the curve compresses the noise in the highlights and expands it in
 * the shadows, and the result is a picture with clean skies and mushy blacks —
 * exactly backwards from a phone camera, where the sky is the noisy part.
 */

/** Bloom runs at this fraction of the frame. See where it is constructed. */
const BLOOM_SCALE = 0.5

/**
 * Samples per pixel on the scene target. See where it is used.
 *
 * Exported so `dev/score.ts` can build its reference target the same way. An
 * evaluator that measures a different pipeline from the one that ships will
 * happily report that a change did nothing.
 */
export const MSAA = 0

export interface Post {
  composer: EffectComposer
  /** Use this rather than composer.render() — see the implementation. */
  render(): void
  resize(w: number, h: number): void
  update(camera: PerspectiveCamera, t: number): void
  /** Throw away the temporal history. The adaptive scaler calls this when it
   * changes the render size, because nothing accumulated lines up any more. */
  resetHistory(): void
}

export function createPost(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
): Post {
  const size = renderer.getDrawingBufferSize(new Vector2())

  // The depth texture is attached here, at the composer's own target, so the
  // haze pass can read the scene's depth after the render pass has written it.
  const depth = new DepthTexture(size.x, size.y)
  const target = new WebGLRenderTarget(size.x, size.y, {
    type: HalfFloatType,
    depthTexture: depth,
    // Multisampling, on the composer's own target.
    //
    // The renderer is constructed with `antialias: false` and the comment there
    // says MSAA on the canvas is waste — which is true, because nothing is drawn
    // to the canvas except a fullscreen quad. It then skipped to "so no
    // antialiasing", and the scene has had none at all: measured against a 3x
    // supersampled reference, 0.43% of pixels sat a mean of 17/255 away from
    // where they should be, which is about twelve thousand crawling edge pixels
    // a frame. Sampling belongs *here*, where the geometry actually lands.
    samples: MSAA,
  })

  const composer = new EffectComposer(renderer, target)

  // Only rt1 carries the depth texture, and rt2 must NOT — see `render` below.
  // The clone the composer made of our target brought a depth texture with it.
  composer.renderTarget2.depthTexture = null as unknown as DepthTexture

  composer.addPass(new RenderPass(scene, camera))

  const haze = new ShaderPass(HazeShader)
  haze.material.uniforms.tDepth.value = depth
  ;(haze.material.uniforms.uSunColor.value as Color).copy(SUN_COLOR)
  composer.addPass(haze)

  // Antialiasing goes here, before bloom, not after the tonemap.
  //
  // Bloom reads whatever it is handed and spreads it: hand it a crawling edge
  // and it spreads a crawling edge, at which point no downstream filter can take
  // it back out. Resolving first means bloom sees an already-converged image.
  const taa = new TaaPass(depth, size.x, size.y)
  // `?notaa` turns it off in the same page session. This is not decoration: the
  // measurements in `experiments.tsv` have twice been wrong because a build was
  // timed at one moment and its baseline at another, and this machine has
  // sustained excursions of six milliseconds that outlast several runs. The only
  // trustworthy A/B is one where the two builds are minutes apart on the same
  // page, and this switch is what makes that possible. See run 21.
  taa.enabled = !/[?&]notaa\b/.test(location.search)
  composer.addPass(taa)

  // Threshold at 1.0: only genuine sources bloom. The neon boards, the lamp
  // lenses, the sun disc and the wet highlights on the cars are all authored
  // above 1.0 for exactly this reason, and nothing else in the scene is.
  // Strength down with the sun disc: bloom multiplies whatever it is given, so
  // trimming the source and leaving the spread alone only moves the problem.
  //
  // Run at half resolution. Measured at 4.4 ms of an 8.9 ms frame — half the
  // GPU time in the whole renderer, and the one number the profiler produced
  // twice in a row. It is also the effect least able to tell: bloom is a wide
  // low-frequency blur, so its first mip being half-size removes detail the
  // pass immediately destroys anyway. Quarter of the pixels, quarter of the
  // bandwidth, and the source pixels it keys off are unchanged.
  const bloom = new UnrealBloomPass(
    new Vector2(size.x * BLOOM_SCALE, size.y * BLOOM_SCALE),
    0.20,
    0.32,
    1.0,
  )
  composer.addPass(bloom)

  const glare = new ShaderPass(GlareShader)
  composer.addPass(glare)

  // Tone mapping and the display encode. Uses whatever curve the renderer is
  // set to — AgX, set in main.ts — rather than reimplementing it here.
  composer.addPass(new OutputPass())

  // Antialiasing, in display space, after the tonemap and before the grain.
  //
  // Three things were measured here and two were thrown away, which is worth
  // recording because the obvious answers were both wrong:
  //
  //  - **MSAA 4x on the composer target.** Halved the aliased pixel count and
  //    took GPU p95 from 18 to 37 ms — over the 33.3 ms budget on its own. A
  //    half-float target at this resolution is bandwidth-bound and multisampling
  //    multiplies exactly that.
  //  - **SMAA.** One extra 5.15 ms at 2560x1440, measured by interleaving
  //    on/off frames so clock drift could not fake the answer — and for that it
  //    reduced total crawl energy by **1.9%**. A night scene is mostly low
  //    contrast, and SMAA finds edges by luma discontinuity; there are far fewer
  //    of those here than the technique assumes.
  //  - **FXAA.** One pass, and what it costs and buys is measured below.
  //
  // The thing that actually helped was none of these: the renderer was capped at
  // a pixel ratio of 1.75 on a 2x display, so the buffer was being *upscaled*
  // for presentation. Removing the cap cut crawl energy 16% and cost 5 ms — the
  // same 5 ms SMAA wanted, for eight times the improvement.
  const fxaa = new ShaderPass(FXAAShader)
  fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y)
  fxaa.enabled = !/[?&]nofxaa\b/.test(location.search)
  composer.addPass(fxaa)

  // Everything after OutputPass is in display space.
  const film = new ShaderPass(FilmShader)
  film.renderToScreen = true
  composer.addPass(film)

  const sunWorld = new Vector3()
  const sunScreen = new Vector3()
  const camForward = new Vector3()
  const jitterSize = new Vector2()

  return {
    composer,

    /**
     * Render the chain.
     *
     * The two assignments are the fix for the longest-running bug in this
     * project, and they are not cosmetic.
     *
     * EffectComposer ping-pongs between two targets and does not reset which is
     * which between frames. This chain has an odd number of swapping passes, so
     * left alone the render pass writes the scene into rt1 on one frame and rt2
     * on the next. The haze pass *samples* rt1's depth texture — so on every
     * other frame it was sampling a depth attachment of the very target it was
     * writing into. That is a framebuffer feedback loop: undefined behaviour,
     * and on this driver it returns black for the whole quad, including the
     * `mix(src, haze, 0)` term that should be a pure passthrough.
     *
     * The symptom was a scene that rendered perfectly when a debugger stepped
     * through several composer renders in a row and black when the loop ran
     * normally, which reads as a timing or resize problem and is neither. The
     * honest tell was that turning the effect's own strength to zero did not
     * bring the picture back: no arithmetic on a sampled value can do that, so
     * the sample itself had to be invalid.
     *
     * Pinning the parity means the scene always lands in rt1, which owns the
     * depth texture, and the haze pass always writes into rt2, which does not.
     */
    render() {
      composer.readBuffer = composer.renderTarget1
      composer.writeBuffer = composer.renderTarget2
      composer.render()
    },

    resetHistory() {
      taa.reset()
    },

    /** Takes CSS pixels. The composer applies the pixel ratio itself. */
    resize(w: number, h: number) {
      const cw = Math.max(1, Math.floor(w))
      const ch = Math.max(1, Math.floor(h))

      // EffectComposer caches the pixel ratio at construction and never asks
      // the renderer again. If the renderer's ratio changes — a window dragged
      // to a display with a different DPR, or a capture forcing 1:1 — the
      // composer keeps scaling by the old one, the colour targets and the depth
      // texture end up different sizes, the framebuffer goes incomplete, and
      // every frame after that is black. Re-syncing it here is the whole fix.
      const ratio = renderer.getPixelRatio()
      composer.setPixelRatio(ratio)

      // setSize also forwards the *effective* (ratio-multiplied) size to every
      // pass, so the bloom mip chain resizes with it and must not be set here.
      composer.setSize(cw, ch)

      // The depth texture is not one of the target's colour attachments, so
      // WebGLRenderTarget.setSize does not touch it — it has to be resized by
      // hand or the depth attachment keeps its old dimensions and the
      // framebuffer goes incomplete. needsUpdate is what forces the reupload.
      depth.image.width = Math.max(1, Math.round(cw * ratio))
      depth.image.height = Math.max(1, Math.round(ch * ratio))
      depth.needsUpdate = true

      // FXAA works in texel space, so it needs the buffer size in texels and
      // there is nothing in the pass that can work it out. Left unset it runs
      // against three's default 1024x512 and quietly does the wrong amount of
      // blending at every other resolution — no error, just a slightly wrong
      // picture, which is the failure mode this codebase keeps meeting.
      fxaa.material.uniforms.resolution.value.set(
        1 / Math.max(1, Math.round(cw * ratio)),
        1 / Math.max(1, Math.round(ch * ratio)),
      )

      // composer.setSize just told the bloom pass the full effective size;
      // put it back to half. This has to come after, not before.
      bloom.setSize(
        Math.max(1, Math.round(cw * ratio * BLOOM_SCALE)),
        Math.max(1, Math.round(ch * ratio * BLOOM_SCALE)),
      )

      film.material.uniforms.uResolution.value.set(cw * ratio, ch * ratio)
    },
    update(cam: PerspectiveCamera, t: number) {
      // Where the sun is on screen, for the glare and the haze's warm side.
      // The proxy point has to sit *inside* the far plane — put it at 4 km and
      // project() returns an NDC z past 1 for every frame, which reads as
      // "behind the camera" and silently disables the glare forever.
      sunWorld.copy(cam.position).addScaledVector(SUN_DIR, cam.far * 0.5)
      sunScreen.copy(sunWorld).project(cam)

      // Whether the sun is in front is a question about direction, not depth.
      cam.getWorldDirection(camForward)
      const behind = camForward.dot(SUN_DIR) <= 0

      const u = (sunScreen.x + 1) / 2
      const v = (sunScreen.y + 1) / 2

      // How much of the sun is actually in shot. Off the edge of the frame the
      // glare should fall off but not vanish — a light source just outside the
      // frame still veils the lens, which is most of why shooting into the sun
      // is hard.
      const off = Math.max(0, Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) - 0.5)
      const presence = behind ? 0 : Math.exp(-off * 3.4)

      glare.material.uniforms.uSun.value.set(u, v)
      glare.material.uniforms.uStrength.value = GLARE_STRENGTH * presence
      haze.material.uniforms.uSun.value.set(u, v)
      haze.material.uniforms.uNear.value = cam.near
      haze.material.uniforms.uFar.value = cam.far
      film.material.uniforms.uTime.value = t / 1000

      // Last thing in update, so the jitter survives: it is written straight
      // into the projection matrix and any later updateProjectionMatrix() would
      // wipe it.
      const db = renderer.getDrawingBufferSize(jitterSize)
      taa.jitter(cam, db.x, db.y)
    },
  }
}

// ---------------------------------------------------------------------------

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Aerial perspective.
 *
 * `scene.fog` already does the isotropic half of this. What it cannot do is
 * make the haze warmer in the direction of the sun, and that asymmetry is the
 * whole visual signature of low-sun weather: the far end of a street lit down
 * its length goes gold, and the same distance at ninety degrees to it goes
 * blue-grey. One fog colour has to pick one of those and be wrong about the
 * other.
 */
const HazeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uSun: { value: new Vector2(0.5, 0.5) },
    uSunColor: { value: new Color(1, 0.7, 0.3) },
    uNear: { value: 0.1 },
    uFar: { value: 400 },
    uAmount: { value: 0.15 },
  },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2  uSun;
    uniform vec3  uSunColor;
    uniform float uNear;
    uniform float uFar;
    uniform float uAmount;
    varying vec2 vUv;

    float viewDistance(float d) {
      // Standard perspective depth to view-space Z. Returns a positive metre
      // distance; saturates rather than dividing by zero at the far plane.
      float z = (uNear * uFar) / ((uFar - uNear) * d - uFar);
      return min(-z, uFar);
    }

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      float dist = viewDistance(texture2D(tDepth, vUv).x);

      // Sky is at the far plane and already has its own gradient; hazing it
      // again washes the clouds out.
      float isScene = 1.0 - step(uFar * 0.94, dist);

      // Beer-Lambert, with the sunward direction getting the warm end. The
      // screen-space distance to the sun stands in for the scattering angle,
      // which is exact for a directional source and a pinhole camera.
      float extinction = 1.0 - exp(-dist * 0.0075);
      float toSun = 1.0 - smoothstep(0.0, 0.85, distance(vUv, uSun));
      vec3 hazeColour = mix(vec3(0.30, 0.33, 0.42), uSunColor * 1.45, pow(toSun, 1.6));

      float a = extinction * uAmount * isScene;
      gl_FragColor = vec4(mix(src.rgb, hazeColour, a), src.a);
    }
  `,
}

/**
 * Veiling glare.
 *
 * Nine taps marching from each pixel toward the sun's screen position, each
 * halving in weight. Where the march crosses bright sky the pixel picks up
 * light; where it crosses a building it does not — so the shafts appear in the
 * gaps between buildings on their own, without knowing anything about the
 * geometry. That emergent occlusion is the reason this is done in screen space
 * rather than with volumetric slabs, which are also in the scene but cannot see
 * the roofline.
 *
 * It is applied after bloom on purpose: the sources have already been spread,
 * so the march has something wide to catch instead of a one-pixel disc.
 */
const GlareShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSun: { value: new Vector2(0.5, 0.5) },
    uStrength: { value: 0.3 },
  },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2  uSun;
    uniform float uStrength;
    varying vec2 vUv;

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      if (uStrength < 0.001) {
        gl_FragColor = src;
        return;
      }

      vec2 dir = (uSun - vUv) * 0.14;
      vec3 sum = vec3(0.0);
      float weight = 1.0;
      float total = 0.0;
      // Jitter where the march starts, per pixel.
      //
      // Nine taps at fixed offsets is a comb, and a comb dragged across a small
      // very bright source stamps that source once per tooth: every street lamp
      // grew a line of ghosts climbing toward the sun's screen position, each one
      // a copy of the lamp's own silhouette. Offsetting the start by a hash of
      // the pixel breaks the replicas into noise, which the eye reads as the
      // continuous veil this is supposed to be. Costs one hash.
      float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 uv = vUv + dir * jitter;
      for (int i = 0; i < 9; i++) {
        uv += dir;
        // Only light above the diffuse level veils; sampling everything just
        // blurs the picture toward the sun. The threshold has to sit above 1.0
        // — the point where the tonemap starts rolling off — or the sky itself
        // qualifies as a glare source and smears over the whole frame.
        vec3 s = max(texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb - 1.05, 0.0);
        sum += s * weight;
        total += weight;
        weight *= 0.62;
        dir *= 0.86;
      }
      gl_FragColor = vec4(src.rgb + (sum / total) * uStrength, src.a);
    }
  `,
}

/**
 * The sensor and the lens barrel: grain, vignette, chromatic aberration, and a
 * slight lift in the blacks.
 *
 * All of it in display space, all of it deliberately mild. The temptation with
 * a "make it look like a phone photo" brief is to reach for the whole rack —
 * heavy grain, a strong vignette, visible fringing — and every one of those
 * reads as a filter rather than as a camera. A phone at ISO 400 in good light
 * has grain you can only see in the sky, a vignette you cannot see at all until
 * you compare corners, and fringing measured in fractions of a pixel.
 */
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1920, 1080) },
    uGrain: { value: 0.032 },
    uVignette: { value: 0.30 },
    uAberration: { value: 0.9 },
  },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2  uResolution;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uAberration;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);

      // Transverse chromatic aberration scales with the square of the distance
      // from the optical axis, which is why it is invisible in the middle of the
      // frame and only ever shows at the corners.
      vec2 shift = c * r2 * uAberration / uResolution;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + shift * 1.6).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - shift * 1.6).b;

      // Vignette, cos^4 falloff — the actual optical law, not a smoothstep.
      float cos4 = 1.0 / (1.0 + r2 * 2.2);
      col *= mix(1.0, cos4 * cos4, uVignette);

      // Grain, scaled by luminance so it lives in the midtones and the sky and
      // not in the blacks. Sensor noise is shot noise: it goes as the square
      // root of the signal, so bright areas get more of it in absolute terms.
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float n = hash(vUv * uResolution + fract(uTime) * 371.0) - 0.5;
      col += n * uGrain * sqrt(max(lum, 0.02));

      // A hair of lifted, cooled black. No sensor returns zero, and a true
      // black in a dusk photograph is the thing that most says "render".
      col = max(col, vec3(0.013, 0.015, 0.021));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}
