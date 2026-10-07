import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { Post } from '../gfx/post'

/**
 * Where the frame time actually goes.
 *
 * Built after three separate occasions on which a confident guess about a cause
 * turned out to be wrong and a measurement turned out to be right. Optimising
 * without this is the same mistake in a different costume: the expensive thing
 * is rarely the thing that looks expensive in the source.
 *
 * Each entry is measured by rendering the same fixed frame with one contributor
 * disabled and comparing against the baseline. The difference is that
 * contributor's cost. It is not additive — disabling two things can save more or
 * less than the sum, because of overdraw and bandwidth — so the numbers rank
 * candidates rather than forming a budget.
 *
 *   npm run dev  ->  http://localhost:5173/?profile
 */

export interface ProfileEntry {
  name: string
  /** GPU ms with this disabled. */
  withoutMs: number
  /** Baseline minus withoutMs — what it appears to cost. */
  costMs: number
  costPct: number
}

export interface ProfileReport {
  baselineMs: number
  resolution: [number, number]
  entries: ProfileEntry[]
  note: string
}

/**
 * Long, and it has to be.
 *
 * Toggling a light or the shadow map changes the shader *defines*, so every
 * affected material recompiles on the next frame. At eight warm-up frames that
 * recompile landed inside the measured window and came out as "disabling shadows
 * costs 11 ms" — a negative cost, which is not a surprising result, it is an
 * impossible one, and impossible results mean the instrument is wrong rather
 * than the scene. Sixty frames absorbs it.
 */
const WARMUP = 60
const SAMPLES = 40

export async function runProfile(deps: {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  post: Post
}): Promise<ProfileReport> {
  const { renderer, scene, camera, post } = deps
  const gl = renderer.getContext() as WebGL2RenderingContext
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as
    | { GPU_DISJOINT_EXT: number; TIME_ELAPSED_EXT: number }
    | null
  if (!ext) {
    return {
      baselineMs: 0,
      resolution: [renderer.domElement.width, renderer.domElement.height],
      entries: [],
      note: 'no EXT_disjoint_timer_query_webgl2 — GPU time is unmeasurable here, and a CPU number is not a substitute',
    }
  }

  // A fixed, busy viewpoint. Profiling an empty view flatters everything.
  camera.position.set(-7.4, 1.68, -14)
  camera.rotation.set(0.04, 0.22, 0, 'YXZ')
  scene.children[0].position.copy(camera.position)
  camera.updateMatrixWorld(true)

  const measure = async (): Promise<number> => {
    for (let i = 0; i < WARMUP; i++) {
      post.update(camera, performance.now())
      post.render()
    }
    const queries: WebGLQuery[] = []
    for (let i = 0; i < SAMPLES; i++) {
      const q = gl.createQuery()
      if (!q) continue
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      post.update(camera, performance.now())
      post.render()
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      queries.push(q)
    }
    const times: number[] = []
    await new Promise<void>((resolve) => {
      const drain = () => {
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
        for (let i = queries.length - 1; i >= 0; i--) {
          const q = queries[i]
          if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue
          if (!disjoint) times.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6)
          gl.deleteQuery(q)
          queries.splice(i, 1)
        }
        if (queries.length === 0) resolve()
        else setTimeout(drain, 16)
      }
      drain()
    })
    if (!times.length) return 0
    times.sort((a, b) => a - b)
    // Median, not mean: one scheduling hiccup should not move the answer.
    return times[Math.floor(times.length / 2)]
  }

  // ---- what can be turned off, and how ----------------------------------
  const passes = post.composer.passes
  const byName: Array<{ name: string; off: () => void; on: () => void }> = []

  const passAt = (i: number, name: string) => {
    byName.push({
      name,
      off: () => {
        passes[i].enabled = false
      },
      on: () => {
        passes[i].enabled = true
      },
    })
  }
  passAt(1, 'post: aerial haze')
  passAt(2, 'post: bloom')
  passAt(3, 'post: veiling glare')
  passAt(5, 'post: grain/vignette/CA')

  const shadowWas = renderer.shadowMap.enabled
  byName.push({
    name: 'shadow map',
    off: () => {
      renderer.shadowMap.enabled = false
    },
    on: () => {
      renderer.shadowMap.enabled = shadowWas
    },
  })

  const pointLights: Array<{ l: { intensity: number; visible: boolean }; i: number }> = []
  scene.traverse((o) => {
    const l = o as unknown as { isPointLight?: boolean; intensity: number; visible: boolean }
    if (l.isPointLight) pointLights.push({ l, i: l.intensity })
  })
  byName.push({
    name: `point lights (${pointLights.length})`,
    off: () => pointLights.forEach((p) => (p.l.visible = false)),
    on: () => pointLights.forEach((p) => (p.l.visible = true)),
  })

  const additive: Array<{ o: { visible: boolean }; ro: number }> = []
  scene.traverse((o) => {
    const m = o as unknown as { material?: { blending?: number }; renderOrder: number; visible: boolean }
    if (m.material && m.material.blending === 2) additive.push({ o: m, ro: m.renderOrder })
  })
  const group = (label: string, ro: number) =>
    byName.push({
      name: label,
      off: () => additive.filter((a) => a.ro === ro).forEach((a) => (a.o.visible = false)),
      on: () => additive.filter((a) => a.ro === ro).forEach((a) => (a.o.visible = true)),
    })
  group('additive: ground pools', 1)
  group('additive: wall glow', 2)
  group('additive: neon halos', 3)
  group('additive: lamp cones', 4)
  group('additive: dust/haloes', 5)
  group('additive: lamp haloes', 6)

  // ---- run ---------------------------------------------------------------
  const baseline = await measure()
  const entries: ProfileEntry[] = []
  for (const item of byName) {
    item.off()
    const without = await measure()
    item.on()
    entries.push({
      name: item.name,
      withoutMs: +without.toFixed(2),
      costMs: +(baseline - without).toFixed(2),
      costPct: +(((baseline - without) / baseline) * 100).toFixed(1),
    })
  }
  entries.sort((a, b) => b.costMs - a.costMs)

  return {
    baselineMs: +baseline.toFixed(2),
    resolution: [renderer.domElement.width, renderer.domElement.height],
    entries,
    note: 'costs are measured by disabling one contributor at a time and are not additive',
  }
}
