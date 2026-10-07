// FROZEN AT G0 (docs/DESIGN.md §11.3). What the Lead's Game calls on the three views.
// Coordinates: world metres, table centre at the origin, tabletop surface at y = TABLE_TOP_Y.
// The board's local frame (under RoomView.tableTop): +x east, +z south, origin = board centre.
import type * as THREE from 'three'
import type { GameEvent } from './events.ts'
import type { Forecast, GameState, HexId, Intent, Side } from './types.ts'

export const TABLE_TOP_Y = 0.9 // metres
export const HEX_FLAT = 0.1 // hex width across the flats, metres (flat-top hexes, odd-q offset)

export type Quality = 'desktop' | 'mobile'

export interface Overlay {
  reach: HexId[]
  path: HexId[]
  fans: { hexes: HexId[]; side: Side }[]
  intents: Intent[]
  danger: HexId[]
  targets: HexId[]
  selected: string | null
  hover: HexId | null
  cursor: HexId | null
}

export interface BoardView { // Worker-B
  mount(tableTop: THREE.Object3D): void
  load(s: GameState): void // build pieces/terrain for a fresh scenario
  sync(s: GameState): void // snap everything to s, no animation
  play(ev: GameEvent, speed: number): Promise<void> // exhaustive switch, <= 1.2 s at speed 1
  overlay(o: Overlay): void
  hexAt(ndc: THREE.Vector2, cam: THREE.Camera): HexId | null
  hexToLocal(h: HexId): THREE.Vector3 // board-local, at the painted surface
  pieceScreenBox(unit: string, cam: THREE.Camera): { w: number; h: number }
  update(dt: number, t: number): void
  setReducedMotion(on: boolean): void
}

export interface RoomView { // Worker-C
  build(scene: THREE.Scene, r: THREE.WebGLRenderer, q: Quality): void
  readonly tableTop: THREE.Object3D
  update(dt: number, t: number): void
  dipCandles(a: number): void
  setReducedMotion(on: boolean): void
  // The post chain (bloom/vignette/grain) lives with the lighting; Game calls this instead of
  // renderer.render.
  render(scene: THREE.Scene, camera: THREE.Camera): void
  resize(w: number, h: number, dpr: number): void
}

export interface HudUi {
  selected: string | null
  forecast: Forecast | null
  anchor: { x: number; y: number } | null
  busy: boolean
  rewindsLeft: number
  speed: number
  muted: boolean
  armed?: 'barrage' | 'gas' | 'creep' | null // the shell the battery is laid with (Game's mode)
  hexPx?: number // on-screen distance between the hovered hex and its neighbour (tag spacing)
  campaign?: number | null // a saved campaign's chapter, for the pocket book's "Continue"
  chapter?: number | null // the campaign chapter being fought (the despatch names it), null outside the campaign
}

/** A campaign battle's after-action lines: what really happened, how yours went, the next chapter. */
export interface CampaignNote { real: string; yours: string; next: string }
/** The card before a campaign battle (and the epilogue after the last). */
export interface Briefing {
  kicker: string; head: string; history: string; yours: string; button: string
  /** The epilogue's two timelines, a row a chapter: [chapter, what happened, your war]. */
  timeline?: [string, string, string][]
}

export interface Hud { // Worker-D
  render(s: GameState, ui: HudUi): void
  banner(text: string): void // '' takes the current line down
  ledger(s: GameState, campaign?: CampaignNote | null): void // show the after-action ledger (game over)
  briefing(b: Briefing): void // the campaign's card over the table
  hideLedger(): void
  tutorial(step: number): void // -1 hides it
  rects(): DOMRect[] // every visible HUD box, for the no-overlap gate
  // The result of one replayed event, shown as it lands: figures lost or a piece wiped out over
  // its hex (`at`, screen pixels, with the side that suffered), a capture, a candle count change.
  result(ev: GameEvent, at: { x: number; y: number; side: Side } | null): void
}
