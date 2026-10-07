// FROZEN AT G0 (docs/DESIGN.md §11.3). Typed pub/sub. The UI dispatches intents on it, the
// Game answers with 'state', and audio/camera react to fx and audio cues. Nothing else is
// shared between modules at runtime.
import type { CueName, GameEvent } from './events.ts'
import type { GameState, HexId } from './types.ts'

export type UiCmd =
  | 'undo' | 'bell' | 'rewind' | 'retry' | 'speed' | 'mute' | 'staff'
  | 'pivot-l' | 'pivot-r' | 'menu' | 'barrage' | 'deselect' | 'next-piece'
  | 'zoom-in' | 'zoom-out' | 'yaw-l' | 'yaw-r' | 'skip-intro' | 'tutorial-skip'
  // Amendment (cycle 7): the scenario orders an outside review could not give — the S2 creeping
  // barrage (arm, then click the middle of three hexes in a row), the S3 sluice, a gas shell — and
  // a skip for the enemy's turn.
  | 'creep' | 'sluice' | 'gas' | 'skip'
  // Amendment (cycle 8): the campaign on the real 1917 calendar — arg 'start' | 'continue' | 'next'.
  | 'campaign'

export interface BusMap {
  'state': { state: GameState; events: GameEvent[] } // after apply, undo, rewind, setState
  'ui:hover': { hex: HexId | null }
  'ui:click': { hex: HexId | null; button: 0 | 2 }
  'ui:cmd': { cmd: UiCmd; arg?: string }
  'view:busy': { busy: boolean }
  'fx:shake': { trauma: number }
  'fx:candles': { dip: number }
  'audio': { cue: CueName; hex?: HexId }
}

export interface Bus {
  on<K extends keyof BusMap>(k: K, f: (p: BusMap[K]) => void): () => void
  emit<K extends keyof BusMap>(k: K, p: BusMap[K]): void
}

export function createBus(): Bus {
  const subs = new Map<keyof BusMap, Set<(p: never) => void>>()
  return {
    on(k, f) {
      let set = subs.get(k)
      if (!set) { set = new Set(); subs.set(k, set) }
      const fn = f as (p: never) => void
      set.add(fn)
      return () => { set.delete(fn) }
    },
    emit(k, p) {
      const set = subs.get(k)
      if (!set) return
      for (const f of [...set]) (f as (q: typeof p) => void)(p)
    },
  }
}
