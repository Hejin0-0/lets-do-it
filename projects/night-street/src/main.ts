import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { createSky } from './scene/sky'
import { buildStreet } from './scene/street'
import { buildBuildings } from './scene/buildings'
import { buildProps } from './scene/props'
import { buildCars } from './scene/cars'
import { createLighting } from './scene/lights'
import { createAtmosphere } from './scene/atmosphere'
import { createTraffic } from './scene/traffic'
import { createLife } from './scene/life'
import { captureProbes } from './scene/probes'
import { createPost } from './gfx/post'
import { createAdaptive } from './gfx/adaptive'
import { assertProgramsCompiled } from './dev/shadercheck'
import { createControls, EYE_HEIGHT, RUN_SPEED } from './player/controls'
import { createAmbience, type Ambience } from './audio/ambience'
import { EXPOSURE, SUN_UP } from './scene/sun'
import {
  buildLayout,
  collidersOf,
  START_Z,
  WALK_END_Z,
  WALK_HALF,
} from './world/placement'

const loading = document.getElementById('loading') as HTMLDivElement
const startPanel = document.getElementById('start') as HTMLDivElement
const hud = document.getElementById('hud') as HTMLDivElement

const renderer = new WebGLRenderer({
  antialias: false, // the post chain resolves at full res; MSAA on top is waste
  powerPreference: 'high-performance',
  stencil: false,
})
/**
 * Render at the display's native pixel density.
 *
 * This was capped at 1.75, which on a 2x screen means the drawing buffer is
 * 2240 wide for 2560 physical pixels — so the browser *upscales* the result to
 * fit. That is the worst of both: the cost of a big buffer, a slightly soft
 * image, and no supersampling to show for it, because there is no downsample
 * step at any point. Measured, the cap was costing quality and buying nothing.
 *
 * Still capped, but at 2: beyond that the pixels stop being visible and start
 * being expensive, and a 3x phone screen would quadruple the fill for nothing.
 */
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
// A shadow map costs a second full pass over the scene. After sunset the
// directional light's intensity is exactly zero — there is nothing for it to
// cast — so the pass renders 244k triangles into a 2048 square target every
// frame and contributes nothing at all to the image.
//
// This is not a measured optimisation. The profiler could not measure it:
// toggling shadows changes shader defines and the recompile lands inside the
// timing window, which is why it reported disabling shadows as *costing* 12 ms.
// It does not need a measurement — a light of intensity zero cannot cast a
// shadow, so the work is unconditionally wasted.
renderer.shadowMap.enabled = SUN_UP
renderer.shadowMap.type = PCFSoftShadowMap

// Tone mapping happens in the post chain's OutputPass, which reads these two.
// AgX holds a 42x sun disc without turning the sky around it into a white hole,
// which ACES does not; the fallback is only there for older three builds.
renderer.toneMapping = AgXToneMapping ?? ACESFilmicToneMapping
renderer.toneMappingExposure = EXPOSURE
document.body.appendChild(renderer.domElement)

const scene = new Scene()
const camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 460)
camera.position.set(-7.55, EYE_HEIGHT, START_Z)

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

const t0 = performance.now()
const layout = buildLayout()

const sky = createSky(renderer)
scene.add(sky.mesh)
scene.environment = sky.environment

const street = buildStreet(layout)
scene.add(street)

const buildings = buildBuildings(layout)
scene.add(buildings.group)

const props = buildProps(layout)
scene.add(props.group)

const cars = buildCars(layout)
scene.add(cars.group)

const lighting = createLighting(scene, layout, buildings.cues, props.lights)
scene.add(lighting.group)

const atmosphere = createAtmosphere(scene)
scene.add(atmosphere.group)

const traffic = createTraffic()
scene.add(traffic.group)

const life = createLife(buildings.neon)

// Bake the shopfront reflections. Has to happen after everything is in the
// scene and before the first frame — there is nothing to reflect until the
// street exists, and once it does the result never changes.
{
  const t = performance.now()
  const probes = captureProbes(renderer, scene, buildings.shopGlassMeshes)
  buildings.shopGlassMeshes.forEach((mesh, i) => {
    const mat = mesh.material as MeshStandardMaterial
    mat.envMap = probes[i]?.texture ?? null
    mat.needsUpdate = true
  })
  console.info(
    `[probes] ${probes.length} shopfront reflection probes baked in ` +
      `${Math.round(performance.now() - t)} ms`,
  )
}

const post = createPost(renderer, scene, camera)

/**
 * Hold the frame rate by moving the resolution, not by dropping frames.
 *
 * The ceiling is whatever the display actually has, capped at 2 — see
 * setPixelRatio above for why the old 1.75 cap was worse than useless. From
 * there it comes down if the frame cannot keep up. On the machine this was
 * built on it never leaves the ceiling; on a slower one the picture gets softer
 * instead of juddering, which is the trade every shipping game makes.
 */
const MAX_RATIO = Math.min(window.devicePixelRatio, 2)
const adaptive = createAdaptive(1, (scale) => {
  renderer.setPixelRatio(MAX_RATIO * scale)
  applySize(true)
})
const controls = createControls(camera, collidersOf(layout), renderer.domElement)

const buildMs = Math.round(performance.now() - t0)
const triangles = buildings.triangles + cars.triangles + props.triangles + traffic.triangles

// ---------------------------------------------------------------------------
// audio starts on the first click, which is also what grabs the pointer
// ---------------------------------------------------------------------------

let ambience: Ambience | null = null

// The bar is the hero neon sign; the AC unit and the buzzing sign are picked
// from the same layout table the geometry came from, so the sound is always
// coming from something you can see.
const barBay = layout.buildings
  .flatMap((b) => b.bays.map((y) => ({ b, y })))
  .find((e) => e.y.business?.id === 'bar')
const neonBay = layout.buildings
  .flatMap((b) => b.bays.map((y) => ({ b, y })))
  .find((e) => e.y.business?.neon && e.y.business.id !== 'bar')

const anchors = {
  bar: barBay
    ? new Vector3(barBay.b.side * (WALK_HALF - 0.5), 1.6, (barBay.y.z0 + barBay.y.z1) / 2)
    : new Vector3(-9, 1.6, -18),
  ac: new Vector3(-WALK_HALF + 0.2, 4.6, -26),
  neon: neonBay
    ? new Vector3(neonBay.b.side * (WALK_HALF - 0.3), 3.6, (neonBay.y.z0 + neonBay.y.z1) / 2)
    : new Vector3(9, 3.6, -40),
}

function begin() {
  startPanel.classList.add('hidden')
  // Grab the look here, on the overlay's own click. The overlay covers the
  // canvas, so a listener bound to the canvas does not see the first click at
  // all — which left the view frozen until the user happened to click twice.
  controls.requestLook()
  if (!ambience) {
    try {
      ambience = createAmbience(anchors)
      controls.onStep = (left, speed) => ambience?.step(left, speed)
    } catch (err) {
      // Audio is not load-bearing. A blocked AudioContext should not take the
      // walk down with it.
      console.warn('ambience unavailable:', err)
    }
  }
}
startPanel.addEventListener('click', begin)
renderer.domElement.addEventListener('click', begin)

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------

const forward = new Vector3()
let last = performance.now()
let frames = 0
let fpsAt = last
let fps = 0

function frame(now: number) {
  // Clamped: a tab that has been in the background hands back a dt of several
  // seconds, and the gait integrator would teleport the player through a wall.
  const dt = Math.min(0.05, (now - last) / 1000)
  adaptive.sample(now - last)
  last = now

  controls.update(dt)
  sky.update(now)
  sky.mesh.position.copy(camera.position)
  lighting.update(camera.position, now)
  atmosphere.update(camera.position, now)
  traffic.update(now, camera.position)
  life.update(now)
  post.update(camera, now)

  if (ambience) {
    camera.getWorldDirection(forward)
    ambience.update(camera.position, forward)
    ambience.car(traffic.leadPosition)
  }

  post.render()

  frames++
  if (now - fpsAt > 500) {
    fps = Math.round((frames * 1000) / (now - fpsAt))
    frames = 0
    fpsAt = now
    const walked = Math.min(1, controls.distance / (START_Z - WALK_END_Z))
    hud.textContent =
      `${fps} fps · ${Math.round(adaptive.scale * 100)}% res` +
      ` · ${
        controls.speed > RUN_SPEED * 0.8
          ? 'running'
          : controls.speed > 0.1
            ? controls.blocked
              ? `${controls.speed.toFixed(1)} m/s · held up`
              : 'walking'
            : 'still'
      }` +
      ` · ${Math.round(walked * 100)}% of the block` +
      (controls.locked
        ? ''
        : controls.lockFailed
          ? ' · pointer lock refused — hold the mouse button and drag to look'
          : ' · click to look')
  }

  requestAnimationFrame(frame)
}

/**
 * Resize.
 *
 * A hidden or not-yet-laid-out tab reports an inner size of 0x0. Handing that
 * to the renderer makes every framebuffer attachment in the post chain
 * zero-size, and from then on the whole thing renders black — with no
 * JavaScript error, only a stream of GL_INVALID_FRAMEBUFFER_OPERATION, and no
 * recovery, because a window that has already reported 0x0 does not fire a
 * second resize event on its own. That is exactly how this shipped broken the
 * first time, and it is worth knowing it fails silently.
 *
 * So a degenerate size is ignored rather than clamped: the last good size is
 * kept, nothing is reallocated, and the ResizeObserver picks the tab up when it
 * comes back. Clamping to 1x1 would also stop the GL errors, but it would tear
 * down and rebuild every render target each time the tab was backgrounded.
 */
const FALLBACK: [number, number] = [1280, 720]
let lastW = 0
let lastH = 0

function applySize(force = false): void {
  let w = Math.floor(window.innerWidth)
  let h = Math.floor(window.innerHeight)
  if (w < 2 || h < 2) {
    // Nothing sensible to size to. Keep what we have, unless this is the first
    // call and there is nothing to keep.
    if (lastW > 0) return
    ;[w, h] = FALLBACK
  }
  // `force` is for the resolution scaler: the CSS size has not changed, but the
  // pixel ratio behind it has, so everything downstream still needs resizing.
  if (!force && w === lastW && h === lastH) return
  lastW = w
  lastH = h
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  post.resize(w, h)
}

// Wrapped, not passed directly: the event object would arrive as the `force`
// argument and every resize would be a forced one.
window.addEventListener('resize', () => applySize())
new ResizeObserver(() => applySize()).observe(document.body)
applySize()

// One warm-up render before the overlay comes up, so the first frame after the
// click is not a two-second shader-compile stall on a street this size.
post.render()
// ...which is also the first moment every program exists, so it is the moment to
// ask whether any of them failed. A broken pass renders black and says nothing.
assertProgramsCompiled(renderer)
loading.remove()
startPanel.classList.remove('hidden')

console.info(
  `night-street built in ${buildMs} ms · ` +
    `${layout.buildings.length} buildings, ${layout.props.length} props, ${layout.cars.length} cars · ` +
    `${(triangles / 1000).toFixed(1)}k triangles in ${buildings.drawCalls + props.drawCalls + cars.drawCalls} batched draw calls`,
)

// ---------------------------------------------------------------------------
// scripted playtest — ?playtest
// ---------------------------------------------------------------------------

/** Everything the loop does to the scene that is not the render itself. */
function syncScene(): void {
  sky.update(performance.now())
  sky.mesh.position.copy(camera.position)
  lighting.update(camera.position, performance.now())
  atmosphere.update(camera.position, performance.now())
  traffic.update(performance.now(), camera.position)
  life.update(performance.now())
}

async function maybePlaytest(): Promise<void> {
  const q = new URLSearchParams(location.search)

  if (q.has('sweep')) {
    startPanel.classList.add('hidden')
    hud.textContent = 'sweeping…'
    const { runSweep } = await import('./dev/sweep')
    // A rejected fetch here used to leave the HUD reading "sweeping…" forever,
    // which is indistinguishable from a hung renderer. The shot server not
    // running is the ordinary case, so say so.
    const result = await runSweep({ renderer, scene, camera, post }).catch((e) => ({
      file:
        `sweep failed: ${e instanceof Error ? e.message : String(e)} ` +
        '— is tools/shotserver.mjs running?',
    }))
    ;(window as unknown as Record<string, unknown>).__sweep = result
    hud.textContent = result.file
    console.info('[sweep]', result)
    requestAnimationFrame(frame)
    return
  }

  if (q.has('score')) {
    startPanel.classList.add('hidden')
    hud.textContent = 'scoring…'
    const { runScore } = await import('./dev/score')
    const report = await runScore({ renderer, scene, camera, post })
    console.info('[score]', report)
    hud.textContent = `alias ${report.edgePct}% of pixels, mean ${report.edgeMean}`
    ;(window as unknown as Record<string, unknown>).__score = report
    requestAnimationFrame(frame)
    return
  }

  if (q.has('profile')) {
    startPanel.classList.add('hidden')
    hud.textContent = 'profiling…'
    const { runProfile } = await import('./dev/profile')
    const report = await runProfile({ renderer, scene, camera, post })
    console.info('[profile]', report)
    hud.textContent = `baseline ${report.baselineMs} ms — see console`
    ;(window as unknown as Record<string, unknown>).__profile = report
    requestAnimationFrame(frame)
    return
  }

  if (!q.has('playtest')) {
    requestAnimationFrame(frame)
    return
  }
  startPanel.classList.add('hidden')
  hud.textContent = 'playtest running…'
  const { runPlaytest } = await import('./dev/playtest')
  const report = await runPlaytest({ renderer, camera, controls, post, syncScene })
  console.info('[playtest]', report)
  console.info('[playtest]', report.verdict)
  hud.textContent = report.verdict
  ;(window as unknown as Record<string, unknown>).__playtest = report
  requestAnimationFrame(frame)
}

void maybePlaytest()

// Expose a little state for the browser-side checks in tools/README.
Object.assign(window as unknown as Record<string, unknown>, {
  __nightStreet: {
    get fps() {
      return fps
    },
    get info() {
      return renderer.info
    },
    layout,
    camera,
    controls,
    renderer,
    scene,
    post,
    // Exposed so the animated parts can be driven at an arbitrary clock from a
    // console or a test, rather than only observed at whatever the frame loop
    // happens to be doing. Everything else here is read-only state; these
    // have an update() and that is the point.
    life,
    traffic,
    sky,
    lighting,
    atmosphere,

    /**
     * Render one frame from an arbitrary camera pose, through the *same* update
     * chain the frame loop uses.
     *
     * Every screenshot taken before this existed set `camera.position` and then
     * called `post.render()` directly, which skipped `lighting.update()` — so
     * the lamps' road reflections stayed wherever the live loop had last put
     * them, several tens of metres away, and simply were not in shot. A whole
     * session of captures was quietly showing a scene the player never sees, and
     * a reported artefact could not be reproduced because the harness could not
     * draw it. Anything that captures a pose should go through here.
     */
    renderPose(
      pos: [number, number, number],
      look: [number, number, number],
      frames = 20,
      t = 1000,
    ) {
      camera.position.set(pos[0], pos[1], pos[2])
      camera.lookAt(look[0], look[1], look[2])
      camera.updateMatrixWorld()
      for (let i = 0; i < frames; i++) {
        const now = t + i * 16.7
        sky.update(now)
        sky.mesh.position.copy(camera.position)
        lighting.update(camera.position, now)
        atmosphere.update(camera.position, now)
        traffic.update(now, camera.position)
        life.update(now)
        post.update(camera, now)
        post.render()
      }
    },
    buildMs,
    triangles,
  },
})
