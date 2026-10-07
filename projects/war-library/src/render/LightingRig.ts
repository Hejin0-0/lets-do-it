// Lighting rig (Worker-C, DESIGN §9 Lighting, §11.5 budget: 2 shadowed + 4 unshadowed on desktop,
// 1 + 2 on mobile).
//   key   warm spot from the chandelier, 2048 shadow map onto the table (the board's light)
//   moon  cool directional through the north lancets, 1024 shadow map, desktop only
//   fire / lamp / 2 candle-cloud points, no shadows; hemisphere 0.12 fill
// Every flicker is a sum of incommensurate sines of the view clock: deterministic, no RNG.
import * as THREE from 'three'
import type { Quality } from '../contract/render-api.ts'

export interface RigSpec {
  key: THREE.Vector3
  keyTarget: THREE.Vector3
  moonDir: THREE.Vector3 // direction the light travels
  moonTarget: THREE.Vector3
  fire: THREE.Vector3
  lamp: THREE.Vector3
  candles: [THREE.Vector3, THREE.Vector3]
}

export interface LightingRig {
  key: THREE.SpotLight
  moon: THREE.DirectionalLight | null
  fire: THREE.PointLight
  lamp: THREE.PointLight
  candles: THREE.PointLight[]
  hemi: THREE.HemisphereLight
  /** t = view clock (frozen under reduced motion), dip 0..1 dims the candles (barrage). */
  update(t: number, dip: number): void
}

export const KEY_INTENSITY = 22
/**
 * The key's range: the tabletop (2.0-2.4 m from the source) keeps ~50-60% of the light, the
 * flagstones (2.9 m and more below it) get none, so the pool ends at the table (§9 order:
 * board > margins > floor).
 */
export const KEY_RANGE = 3.05
export const LAMP_INTENSITY = 0.5
/** The lamp's pool stays on its margin: at 0.5 m the light is gone, before the map's edge. */
export const LAMP_RANGE = 0.5
const FIRE_INTENSITY = 9
const CANDLE_INTENSITY = 4.5
const MOON_INTENSITY = 0.35

export function createLightingRig(scene: THREE.Scene, q: Quality, s: RigSpec): LightingRig {
  // cone: full strength to ~21.5° (the board's corners), gone by 28.6° (the table's ends)
  const key = new THREE.SpotLight('#ffd9a0', KEY_INTENSITY, KEY_RANGE, 0.5, 0.25, 2)
  key.name = 'key:chandelier'
  key.position.copy(s.key)
  key.target.position.copy(s.keyTarget)
  key.castShadow = true
  key.shadow.mapSize.set(q === 'desktop' ? 2048 : 1024, q === 'desktop' ? 2048 : 1024)
  key.shadow.camera.near = 0.8
  key.shadow.camera.far = KEY_RANGE
  key.shadow.bias = -0.0002
  key.shadow.normalBias = 0.012
  key.shadow.radius = 2
  scene.add(key, key.target)

  let moon: THREE.DirectionalLight | null = null
  if (q === 'desktop') {
    moon = new THREE.DirectionalLight('#8fa6c8', MOON_INTENSITY)
    moon.name = 'moon'
    const d = s.moonDir.clone().normalize()
    moon.target.position.copy(s.moonTarget)
    moon.position.copy(s.moonTarget).addScaledVector(d, -16)
    moon.castShadow = true
    moon.shadow.mapSize.set(1024, 1024)
    const c = moon.shadow.camera
    c.left = -7.5; c.right = 7.5; c.top = 8; c.bottom = -8; c.near = 4; c.far = 30
    moon.shadow.bias = -0.0006
    moon.shadow.normalBias = 0.03
    // the moon and the hall are static: its map is rendered ONCE (RoomView then stops the hall
    // casting), so it costs no triangles per frame
    moon.shadow.autoUpdate = false
    moon.shadow.needsUpdate = true
    scene.add(moon, moon.target)
  }

  const fire = new THREE.PointLight('#ff7a30', FIRE_INTENSITY, 9, 2)
  fire.name = 'fire'
  fire.position.copy(s.fire)
  const lamp = new THREE.PointLight('#ffcc88', LAMP_INTENSITY, LAMP_RANGE, 2)
  lamp.name = 'lamp:banker'
  lamp.position.copy(s.lamp)
  scene.add(fire, lamp)

  const candles: THREE.PointLight[] = []
  const nCandle = q === 'desktop' ? 2 : 0
  for (let i = 0; i < nCandle; i++) {
    const c = new THREE.PointLight('#ffb468', CANDLE_INTENSITY, 8, 2)
    c.name = 'candles:' + i
    // at the cloud's lower edge: the candles light the stacks and the floor, the roof falls away
    c.position.copy(s.candles[i]).setY(2.7)
    candles.push(c)
    scene.add(c)
  }
  // mobile keeps 2 unshadowed points: the fire and the lamp (DESIGN §11.5)

  const hemi = new THREE.HemisphereLight('#a8b4c8', '#3a2a1e', 0.12)
  scene.add(hemi)

  return {
    key, moon, fire, lamp, candles, hemi,
    update(t, dip) {
      const f = 0.82 + 0.1 * Math.sin(t * 7.1) + 0.05 * Math.sin(t * 13.7 + 1.3) + 0.03 * Math.sin(t * 23.3 + 0.4)
      fire.intensity = FIRE_INTENSITY * f
      const c = 1 - 0.7 * dip
      for (let i = 0; i < candles.length; i++) {
        candles[i].intensity = CANDLE_INTENSITY * c * (0.94 + 0.04 * Math.sin(t * 5.3 + i * 2.1) + 0.02 * Math.sin(t * 11.9 + i))
      }
      key.intensity = KEY_INTENSITY * (1 - 0.18 * dip) * (0.985 + 0.015 * Math.sin(t * 6.1))
    },
  }
}
