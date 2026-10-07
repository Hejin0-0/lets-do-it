// Replays the rules' events on the table, one at a time: the board animates, then the matching
// sound and camera feedback fire on the same beat (DESIGN §11.3 EventPlayer). A click while it
// runs fast-forwards the rest at 4x; `rush` (the enemy's turn skipped) plays everything at 8x and
// drops the held beats.
import type { Bus } from '../contract/bus.ts'
import type { GameEvent } from '../contract/events.ts'
import type { BoardView, RoomView } from '../contract/render-api.ts'
import type { HexId } from '../contract/types.ts'
import { cueFor } from '../audio/cues.ts'

const EST_S = 0.55 // a typical event's length at 1x, for the budget
const MAX_SQUEEZE = 12

export class EventPlayer {
  private readonly board: BoardView
  private readonly room: RoomView
  private readonly bus: Bus
  private ff = 1
  speed = 1
  busy = false
  rush = false
  failures = 0 // animations that threw; surfaced in diagnostics
  // The camera director (Game): called as a shell, an assault or a capture STARTS to play, so the
  // look target leans toward the hex while the animation runs rather than after it.
  focus: (h: HexId) => void = () => {}
  // Called as each event's animation finishes, so its result (figures lost, a capture, a candle
  // change) is shown on the beat it lands — an outside review saw the enemy's turn end with "no
  // visible combat result" (Game routes it to the HUD).
  result: (ev: GameEvent) => void = () => {}

  constructor(board: BoardView, room: RoomView, bus: Bus) {
    this.board = board
    this.room = room
    this.bus = bus
  }

  fastForward(): void { if (this.busy) this.ff = 4; this.skipPause = true }

  // A held beat between batches (the enemy's answer). Counts as busy so input buffers; honours the
  // speed setting; a click cuts it short, and a skipped turn has none.
  private skipPause = false
  async pause(sec: number): Promise<void> {
    if (this.rush) return
    this.skipPause = false
    this.busy = true
    this.bus.emit('view:busy', { busy: true })
    const end = performance.now() + (sec * 1000) / this.speed
    while (performance.now() < end && !this.skipPause && !this.rush) await new Promise((r) => setTimeout(r, 30))
    this.busy = false
    this.bus.emit('view:busy', { busy: false })
  }

  // `budget` seconds at 1x for the whole batch. The squeeze is re-read before every event from the
  // time actually left and the events still to play, so a batch that runs long (a slow march, a
  // stack of blasts) catches up instead of overrunning. The first cut guessed once from the event
  // count, and an outside review timed the bell alone at 4.5 s.
  async playAll(events: GameEvent[], budget = 6): Promise<void> {
    if (events.length === 0) return
    this.busy = true
    this.bus.emit('view:busy', { busy: true })
    const t0 = performance.now()
    try {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i]
        const left = budget - ((performance.now() - t0) / 1000) * this.speed
        const squeeze = Math.min(MAX_SQUEEZE, Math.max(1, ((events.length - i) * EST_S) / Math.max(0.05, left)))
        if (ev.e === 'captured') this.focus(ev.hex)
        else if (ev.e === 'attack' && (ev.kind === 'barrage' || ev.kind === 'assault')) this.focus(ev.target)
        // A view that fails to animate one event must not wedge the turn: the rules state is
        // already authoritative, and the Game re-syncs the board after every batch. (An ink-pool
        // overflow here once left the enemy phase unfinished forever.)
        try {
          await this.board.play(ev, this.speed * (this.rush ? 8 : this.ff) * squeeze)
        } catch (e) {
          console.error('[EventPlayer] board.play failed for', ev.e, e)
          this.failures += 1
        }
        this.feedback(ev)
        this.result(ev)
      }
    } finally {
      this.ff = 1
      this.busy = false
      this.bus.emit('view:busy', { busy: false })
    }
  }

  private feedback(ev: GameEvent): void {
    const cue = cueFor(ev)
    if (cue) {
      const hex = 'hex' in ev ? ev.hex : 'target' in ev ? ev.target : undefined
      this.bus.emit('audio', hex === undefined ? { cue } : { cue, hex })
    }
    if (ev.e === 'attack') {
      if (ev.kind === 'barrage') {
        this.bus.emit('fx:shake', { trauma: 0.7 })
        this.bus.emit('fx:candles', { dip: 0.6 })
        this.room.dipCandles(0.6)
      } else if (ev.kind === 'overwatch' || ev.kind === 'assault') {
        this.bus.emit('fx:shake', { trauma: 0.18 })
      }
    }
  }
}
