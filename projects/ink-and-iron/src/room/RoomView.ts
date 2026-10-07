// The library room (Worker-C). Assembles the hall (Shell), the stacks and their books, the north
// lancets with moon shafts and motes, the fireplace, the floating candles, the chandelier, the
// props and the war-table, then owns the light rig and the post chain (Game calls render()).
// Static parts are merged into one mesh per material (room draw-call budget: 120).
import * as THREE from 'three'
import { TABLE_TOP_Y } from '../contract/render-api.ts'
import type { Quality, RoomView } from '../contract/render-api.ts'
import type { Bus } from '../contract/bus.ts'
import { applyEnvironment, floorOptions, roomMat } from '../render/MaterialLibrary.ts'
import { ASHLAR_TILE, OAK_TILE } from '../render/ProceduralTextures.ts'
import { createLightingRig } from '../render/LightingRig.ts'
import type { LightingRig } from '../render/LightingRig.ts'
import { createRenderPipeline } from '../render/RenderPipeline.ts'
import type { RenderPipeline } from '../render/RenderPipeline.ts'
import { Batch } from './Kit.ts'
import { MOON_DIR, PRESS_Z } from './Layout.ts'
import { buildFloor, buildShell } from './Shell.ts'
import { buildStacks } from './Bookcases.ts'
import { createBooks } from './Books.ts'
import { buildWindows } from './Windows.ts'
import type { Windows } from './Windows.ts'
import { buildFireplace } from './Fireplace.ts'
import type { Fire } from './Fireplace.ts'
import { CHANDELIER_C, buildChandelier, lightShaft } from './Chandelier.ts'
import { FLOATING, MOBILE_FLOATING, buildCandles } from './Candles.ts'
import type { Candles } from './Candles.ts'
import { buildProps } from './Props.ts'
import { LAMP_BULB, buildWarTable } from './WarTable.ts'

export interface RoomDebug {
  rig: LightingRig | null
  pipe: RenderPipeline | null
  books: THREE.InstancedMesh | null
  candles: Candles | null
  root: THREE.Group
  /** triangles per builder (static batch) plus books and candle wax */
  stats: Record<string, number>
}

export interface RoomViewC extends RoomView { readonly debug: RoomDebug }

/** Key light: from a socket on the chandelier ring, aimed at the board. */
export const KEY_POS = new THREE.Vector3(CHANDELIER_C.x + 0.3, CHANDELIER_C.y - 0.1, CHANDELIER_C.z)

export function createRoomView(bus: Bus): RoomViewC {
  const tableTop = new THREE.Group()
  tableTop.name = 'tableTop'
  tableTop.position.set(0, TABLE_TOP_Y, 0)
  const root = new THREE.Group()
  root.name = 'room'
  const debug: RoomDebug = { rig: null, pipe: null, books: null, candles: null, root, stats: {} }
  let renderer: THREE.WebGLRenderer | null = null
  let windows: Windows | null = null
  let fire: Fire | null = null
  let roomCasters: THREE.Object3D[] = []
  let reduced = false
  let clock = 0
  let dip = 0
  let mood = 0, moodGoal = 0, moonBase = 0 // 0 = the player's turn, 1 = the enemy's

  const view: RoomViewC = {
    tableTop,
    debug,
    build(scene: THREE.Scene, r: THREE.WebGLRenderer, q: Quality) {
      renderer = r
      floorOptions.pressZ = PRESS_Z
      scene.background = new THREE.Color('#050407')
      const b = new Batch({
        oakV: OAK_TILE, ashlarV: ASHLAR_TILE, marbleV: [0.7, 0.7], ironV: [0.5, 0.5], brassV: [0.4, 0.4],
        leatherV: [0.5, 0.5], parchV: [0.4, 0.4],
      })
      root.add(buildFloor())
      b.tag = 'shell'; buildShell(b)
      b.tag = 'stacks'; const stacks = buildStacks(b)
      b.tag = 'windows'; windows = buildWindows(b)
      b.tag = 'fireplace'; fire = buildFireplace(b)
      b.tag = 'chandelier'; b.zone = 'chandelier'; const sockets = buildChandelier(b); b.zone = 'auto'
      b.tag = 'props'; const props = buildProps(b)
      b.tag = 'table'; b.zone = 'table'; const table = buildWarTable(b); b.zone = 'auto'
      const books = createBooks(stacks.runs)
      const candles = buildCandles(sockets, q === 'mobile' ? MOBILE_FLOATING : FLOATING)
      const batches = b.build({
        oakV: roomMat('oakV'), ashlarV: roomMat('ashlarV'), marbleV: roomMat('marbleV'), ironV: roomMat('ironV'),
        brassV: roomMat('brassV'), leatherV: roomMat('leatherV'), parchV: roomMat('parchV'),
      })
      // Shadow casters: the table zone always (it sits in the key's cone, under the board). The
      // rest of the hall only feeds the moon's STATIC shadow map (desktop): it casts for the one
      // frame that bakes the moon, then stops, so the per-frame key pass draws the table alone.
      roomCasters = [...batches.filter((m) => m.userData.zone !== 'table'), props.globe]
      for (const m of roomCasters) m.castShadow = q === 'desktop'
      debug.stats = { ...b.tris, books: books.count * 10, candles: candles.wax.count * (candles.wax.geometry.attributes.position.count / 3) }
      for (const m of batches) root.add(m)
      root.add(books, windows.group, fire.group, props.group, table.group, candles.group, lightShaft(TABLE_TOP_Y))
      scene.add(root, tableTop)
      debug.books = books
      debug.candles = candles
      debug.rig = createLightingRig(scene, q, {
        key: KEY_POS, keyTarget: new THREE.Vector3(0, TABLE_TOP_Y, 0),
        moonDir: new THREE.Vector3(...MOON_DIR), moonTarget: new THREE.Vector3(0, 1.5, -4),
        fire: fire.light, lamp: LAMP_BULB, candles: candles.clusters,
      })
      moonBase = debug.rig.moon?.intensity ?? 0
      applyEnvironment(scene, r, 0.35)
      debug.pipe = createRenderPipeline(r, q)
      windows.setPixelRatio(r.getPixelRatio())
      view.update(0, 0)
    },
    update(dt: number, t: number) {
      if (!reduced) { clock = t; dip = Math.max(0, dip - dt * 1.3) }
      // The room's mood follows the turn: while the enemy moves the candles sink and the moon
      // through the lancets rises; the table is handed back in warm light. An outside review saw
      // no change of light between the turns.
      mood = reduced ? moodGoal : mood + (moodGoal - mood) * Math.min(1, dt / 0.8)
      const low = Math.max(dip, mood * 0.32)
      debug.candles?.update(clock, low)
      windows?.update(clock)
      fire?.update(clock)
      debug.rig?.update(clock, low)
      if (debug.rig?.moon) debug.rig.moon.intensity = moonBase * (1 + 1.1 * mood)
      debug.pipe?.setTime(clock)
    },
    dipCandles(a: number) {
      if (!reduced) dip = Math.min(1, Math.max(dip, a))
    },
    setReducedMotion(on: boolean) {
      // freeze at the current clock: the uniforms already hold this frame, so nothing moves even
      // before the next update() (no simulation tick needed)
      reduced = on
      if (on) dip = 0
      view.update(0, clock)
    },
    render(scene: THREE.Scene, camera: THREE.Camera) {
      if (debug.pipe) debug.pipe.render(scene, camera)
      else renderer?.render(scene, camera)
      if (roomCasters.length && !debug.rig?.moon?.shadow.needsUpdate) {
        for (const m of roomCasters) m.castShadow = false // the moon's map is baked
        roomCasters = []
      }
    },
    resize(w: number, h: number, dpr: number) {
      debug.pipe?.resize(w, h, dpr)
      windows?.setPixelRatio(dpr)
    },
  }
  bus.on('fx:candles', ({ dip: a }) => view.dipCandles(a))
  bus.on('state', ({ state }) => { moodGoal = state.phase === 'player-orders' || state.phase === 'over' ? 0 : 1 })
  return view
}
