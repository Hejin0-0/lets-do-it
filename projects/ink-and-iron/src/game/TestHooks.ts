// The deterministic test surface (threejs-gameplay-systems scaffold contract, DESIGN §11.3):
// window.__THREE_GAME_TEST_HOOKS__ drives named states for captures and the bot playtest;
// window.__THREE_GAME_DIAGNOSTICS__ is refreshed every frame. Unknown state names THROW.
import * as THREE from 'three'
import type { Action, Difficulty, HexId, ScenarioId } from '../contract/types.ts'
import { FIXTURES, legal, stateHash } from '../rules/index.ts'
import type { FixtureName } from '../rules/index.ts'
import { PROFILES, planTurn } from '../ai/index.ts'
import type { Game } from './Game.ts'
import { renderVoice, VOICE_NAMES } from '../audio/AudioSystem.ts'
import type { AudioStats } from '../audio/AudioSystem.ts'

export interface WarTableHooks {
  seed(value: number): void
  setState(name: string): { state: string }
  setPausedForScreenshot(paused: boolean): void
  setReducedMotion(enabled: boolean): void
  hideDebugUi(hidden: boolean): void
  loadScenario(id: ScenarioId, seed: number, d: Difficulty): void
  skipIntro(): void
  setSpeed(n: number): void
  hexScreen(h: HexId): { x: number; y: number }
  suggest(): Action[]
  legalActions(): Action[]
  stateHash(): string
  getState(): unknown
  // Sound for a reviewer who cannot listen (headless runs are muted): what the mix has played,
  // and any one voice rendered offline with its level.
  audioStats(): AudioStats
  renderVoice(name: string): Promise<{ rms: number; peak: number }>
  // Where the triangles go: the heaviest meshes (instances counted), and whether each is inside
  // the camera's frustum this frame.
  sceneStats(): { name: string; tris: number; inView: boolean; shadow: boolean }[]
}

export function installTestHooks(g: Game): void {
  const hooks: WarTableHooks = {
    seed(value) { g.newScenario(g.state.scenario, value, g.state.difficulty) },
    setState(name) {
      if (name === 'library-overview') {
        g.newScenario('s1', 42, 'recruit', true)
        g.rig.setStop('hall', true)
        g.mode = 'intro'
        g.introPush = false // a still establishing shot for captures
        return { state: name }
      }
      if (!(name in FIXTURES)) throw new Error(`setState: unknown state "${name}"`)
      // 'player-turn' is the opening of WHATEVER scenario/difficulty is loaded (loadScenario first
      // to pick one); the other named states are S1 fixtures — mid-game positions built by play.
      if (name === 'player-turn') { // keeps the loaded scenario AND difficulty
        g.newScenario(g.state.scenario, g.state.seed, g.state.difficulty)
        return { state: name }
      }
      g.load(FIXTURES[name as FixtureName](), false)
      return { state: name }
    },
    setPausedForScreenshot(p) { g.paused = p },
    setReducedMotion(on) { g.setReducedMotion(on) },
    hideDebugUi() {},
    loadScenario(id, seed, d) { g.newScenario(id, seed, d) },
    skipIntro() { g.skipIntro() },
    setSpeed(n) { g.player.speed = n },
    hexScreen(h) { return g.hexScreen(h) },
    suggest() {
      if (g.state.phase !== 'player-orders') return []
      return planTurn(g.state, PROFILES[g.state.difficulty]).actions
    },
    legalActions() { return legal(g.state) },
    stateHash() { return stateHash(g.state) },
    getState() { return structuredClone(g.state) },
    audioStats() { return g.audio.stats() },
    sceneStats() {
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(g.camera.projectionMatrix, g.camera.matrixWorldInverse))
      const out: { name: string; tris: number; inView: boolean; shadow: boolean }[] = []
      g.scene.traverseVisible((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.geometry) return
        const geo = m.geometry
        const per = (geo.index ? geo.index.count : (geo.getAttribute('position')?.count ?? 0)) / 3
        const inst = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1
        if (!geo.boundingSphere) geo.computeBoundingSphere()
        const sphere = (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).boundingSphere
          ? ((o as THREE.InstancedMesh).boundingSphere as THREE.Sphere).clone() : (geo.boundingSphere as THREE.Sphere).clone()
        sphere.applyMatrix4(o.matrixWorld)
        out.push({ name: o.name || o.parent?.name || o.type, tris: Math.round(per * inst), inView: !o.frustumCulled || fr.intersectsSphere(sphere), shadow: o.castShadow })
      })
      return out.sort((a, b) => b.tris - a.tris).slice(0, 20)
    },
    renderVoice(name) {
      if (!(VOICE_NAMES as string[]).includes(name)) throw new Error(`renderVoice: unknown voice "${name}" (${VOICE_NAMES.join(', ')})`)
      return renderVoice(name as (typeof VOICE_NAMES)[number])
    },
  }
  ;(window as unknown as { __THREE_GAME_TEST_HOOKS__: WarTableHooks }).__THREE_GAME_TEST_HOOKS__ = hooks

  // Written every frame AND on every state change: an outside review read the diagnostics in the
  // same tick as loadScenario() and saw the previous frame's difficulty, which looked like the
  // game had ignored it.
  const write = (): void => {
    const s = g.state
    const info = g.renderer.info
    const c = g.renderer.domElement
    ;(window as unknown as { __THREE_GAME_DIAGNOSTICS__: unknown }).__THREE_GAME_DIAGNOSTICS__ = {
      frame: g.frame, elapsed: g.frame / 60, score: s.objectives.filter((o) => o.holder === s.human).length,
      targetScore: s.objectives.length, complete: s.phase === 'over',
      player: { position: { x: g.camera.position.x, y: g.camera.position.y, z: g.camera.position.z }, speed: 0 },
      renderer: { calls: info.render.calls, triangles: info.render.triangles,
        geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 },
      canvas: { clientWidth: c.clientWidth, clientHeight: c.clientHeight, width: c.width, height: c.height,
        dpr: g.renderer.getPixelRatio() },
      scenario: s.scenario, difficulty: s.difficulty, round: s.round, phase: s.phase, mode: g.mode,
      ordersLeft: s.ordersLeft, selected: g.selected, morale: s.morale, shells: s.shells,
      objectives: s.objectives, intents: s.intents.length, winner: s.winner,
      aiMs: g.aiMs, lastFeedbackMs: g.lastFeedbackMs, busy: g.player.busy,
      rewindsLeft: Number.isFinite(g.rewindsLeft) ? g.rewindsLeft : 'unlimited',
      animFailures: g.player.failures, maxDpr: g.maxDpr, audio: g.audio.stats(),
    }
  }
  const publish = (): void => { write(); requestAnimationFrame(publish) }
  g.bus.on('state', write)
  requestAnimationFrame(publish)
  ;(window as unknown as { __ready: boolean }).__ready = true
}
