import {
  CubeCamera,
  PMREMGenerator,
  WebGLCubeRenderTarget,
  type Mesh,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { START_Z, WALK_END_Z, WALK_HALF, type Side } from '../world/placement'

/**
 * Baked local reflection probes for the shopfront glazing.
 *
 * A shop window at eye level is the one surface on this street where the
 * *absence* of a reflection is obvious, because you are standing right in front
 * of it and there is a car parked two metres behind you. Taking the scene's
 * single sky probe there gives a pane that reflects the sky and nothing else,
 * which reads as dark plastic.
 *
 * The choice of technique follows from one fact: **this scene does not move.**
 * Nothing on the street animates except the traffic lights and the player, and
 * neither appears in a shop window at a size anyone could identify. So a
 * cubemap captured once at load is not an approximation of a dynamic thing —
 * for everything that matters it is exact, and it costs nothing per frame.
 *
 * The alternative was a planar reflection, which is what this sort of surface
 * usually gets: all the glazing on one kerb is coplanar, so it would take two
 * extra scene renders per frame. Those two renders would have cost more than
 * the entire frame budget that the performance pass had just recovered, to
 * reproduce something that never changes.
 *
 * One probe every 16 m per kerb — the lamp spacing, which is also roughly the
 * distance over which what is parked outside a shop changes.
 */

const SPACING = 16
/** Faces are square; 256 is sharp enough for glass at roughness 0.14. */
const FACE = 256

export interface Probe {
  side: Side
  z: number
  texture: Texture
}

/** Probe centres, derived once so the capture and the lookup cannot disagree. */
export function probeGrid(): Array<{ side: Side; z: number }> {
  const out: Array<{ side: Side; z: number }> = []
  for (const side of [-1, 1] as Side[]) {
    for (let z = START_Z; z > WALK_END_Z - SPACING; z -= SPACING) {
      out.push({ side, z })
    }
  }
  return out
}

/** Which probe a piece of glazing at (side, z) should use. */
export function probeIndexFor(side: Side, z: number): number {
  const grid = probeGrid()
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].side !== side) continue
    const d = Math.abs(grid[i].z - z)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export const PROBE_COUNT = probeGrid().length

/**
 * Render every probe. Call once, after the scene is built.
 *
 * `exclude` is hidden during capture — the glazing itself, which would otherwise
 * appear in its own reflection.
 */
export function captureProbes(
  renderer: WebGLRenderer,
  scene: Scene,
  exclude: Mesh[],
): Probe[] {
  const grid = probeGrid()
  const pmrem = new PMREMGenerator(renderer)
  pmrem.compileCubemapShader()

  const wasVisible = exclude.map((m) => m.visible)
  for (const m of exclude) m.visible = false

  const probes: Probe[] = grid.map(({ side, z }) => {
    const target = new WebGLCubeRenderTarget(FACE)
    const cam = new CubeCamera(0.1, 220, target)
    // Just in front of the glass, at eye height: the reflection a person
    // standing at the window would actually see.
    cam.position.set(side * (WALK_HALF - 0.45), 1.7, z)
    scene.add(cam)
    cam.update(renderer, scene)
    scene.remove(cam)

    const baked = pmrem.fromCubemap(target.texture)
    target.dispose()
    return { side, z, texture: baked.texture }
  })

  for (let i = 0; i < exclude.length; i++) exclude[i].visible = wasVisible[i]
  pmrem.dispose()
  return probes
}
