// Render pipeline (Worker-C, DESIGN §9 Lighting / §11.5): RenderPass → UnrealBloom → vignette +
// grain → OutputPass (tone mapping + sRGB, always last). 'mobile' renders straight to the canvas
// (0 post passes). renderer.info is reset once per frame here so the diagnostics count the whole
// frame (shadow maps + scene + post), not only the last pass.
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { Quality } from '../contract/render-api.ts'

export const EXPOSURE = 1.3

const VignetteGrain = {
  name: 'VignetteGrain',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uStrength: { value: 0.5 },
    uGrain: { value: 0.045 },
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uStrength, uGrain, uTime, uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0) / vec2(uAspect * 0.5 + 0.5, 1.0);
      float v = 1.0 - uStrength * smoothstep(0.42, 1.15, length(q) * 1.18);
      float n = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7) - 0.5;
      // grain is multiplicative (film-like) and strongest in the mid-tones
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      float g = 1.0 + n * uGrain * (1.0 - smoothstep(0.4, 2.0, l));
      gl_FragColor = vec4(c.rgb * v * g, c.a);
    }`,
}

export interface RenderPipeline {
  render(scene: THREE.Scene, camera: THREE.Camera): void
  resize(w: number, h: number, dpr: number): void
  setTime(t: number): void
  /** false renders straight to the canvas (A/B check of the post chain). */
  post: boolean
  readonly passes: number
}

export function createRenderPipeline(r: THREE.WebGLRenderer, q: Quality): RenderPipeline {
  r.toneMapping = THREE.ACESFilmicToneMapping
  r.toneMappingExposure = EXPOSURE
  r.outputColorSpace = THREE.SRGBColorSpace
  r.info.autoReset = false
  const size = r.getSize(new THREE.Vector2())
  let composer: EffectComposer | null = null
  let grain: ShaderPass | null = null
  let bloom: UnrealBloomPass | null = null
  if (q === 'desktop') {
    const dpr = r.getPixelRatio()
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x * dpr), Math.max(1, size.y * dpr),
      { type: THREE.HalfFloatType, samples: 4 })
    composer = new EffectComposer(r, rt)
    composer.setPixelRatio(dpr)
    composer.setSize(Math.max(1, size.x), Math.max(1, size.y))
    composer.addPass(new RenderPass(new THREE.Scene(), new THREE.Camera()))
    // threshold 0.95: only HDR emitters (flames > 1) bloom. At 0.85 specular on brass and water
    // crossed it and smeared white over the board's near edge and the river.
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.3, 0.95)
    // One NaN/Inf sample (a degenerate triangle's normal) fed to the blur chain blacked out the
    // whole frame; zero it before it spreads.
    const hp = bloom.materialHighPassFilter
    const anchor = 'vec4 texel = texture2D( tDiffuse, vUv );'
    if (!hp.fragmentShader.includes(anchor)) throw new Error('RenderPipeline: bloom high-pass shader changed')
    hp.fragmentShader = hp.fragmentShader.replace(anchor, `${anchor}
      if (any(isnan(texel)) || any(isinf(texel))) texel = vec4(0.0);`)
    composer.addPass(bloom)
    grain = new ShaderPass(VignetteGrain)
    composer.addPass(grain)
    composer.addPass(new OutputPass())
  }
  const pipe: RenderPipeline = {
    post: q === 'desktop',
    get passes() { return composer && pipe.post ? 2 : 0 },
    render(scene, camera) {
      r.info.reset()
      if (!composer || !pipe.post) { r.render(scene, camera); return }
      const rp = composer.passes[0] as RenderPass
      rp.scene = scene
      rp.camera = camera
      composer.render()
    },
    resize(w, h, dpr) {
      if (!composer || !grain) return
      composer.setPixelRatio(dpr)
      composer.setSize(w, h)
      grain.uniforms.uAspect.value = w / Math.max(1, h)
    },
    setTime(t) { if (grain) grain.uniforms.uTime.value = t },
  }
  if (grain) grain.uniforms.uAspect.value = size.x / Math.max(1, size.y)
  return pipe
}
