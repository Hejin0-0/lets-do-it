// Which cue a rules event sounds as (DESIGN §10). The Lead's EventPlayer calls cueFor() after
// each board.play() and emits the result on the bus with the event's hex. The switch is
// exhaustive over GameEvent: a new variant in contract/events.ts is a compile error here.
//
// Cues the Game emits itself (select, deselect, invalid, undo, bell, victory, defeat) map to null
// here so nothing sounds twice. Two cues LEAD their event, because cueFor() runs after the board
// has animated it: AudioSystem plays 'incoming' (the shell whistle) and 'step' (the tin clatter of
// a base rocking across the map) when a batch holding a barrage or a move arrives on 'state'; the
// blast and the felt thunk of the landing follow from here.
import type { CueName, GameEvent } from '../contract/events.ts'
import type { Rule } from '../contract/types.ts'

const ATTACK: Record<Rule, CueName | null> = {
  overwatch: 'overwatch', assault: 'assault', 'strike-back': 'fire', fire: 'fire',
  barrage: 'blast', gas: 'gas',
  flood: null, // the 'flood' event carries the water
}

export function cueFor(ev: GameEvent): CueName | null {
  switch (ev.e) {
    case 'phase': return null // the Game rings the bell itself; dawn's clock is ambience
    case 'moved': return 'place' // lands with a felt thunk (DESIGN §7)
    case 'pivoted': return 'pivot'
    case 'attack': return ATTACK[ev.kind]
    case 'figures': return ev.lost > 0 ? 'figure-lost' : null
    case 'destroyed': return null // its last figure already clacked
    case 'suppressed': return null
    case 'recovered': return null
    case 'dug-in': return 'dig-in'
    case 'bogged': return null
    case 'reinforce': return 'reinforce'
    case 'intent': return 'intent'
    case 'intent-resolved': return null // the attack it resolves into sounds
    case 'crater': return null // part of the barrage's blast
    case 'wire-cut': return 'wire-cut'
    case 'gas': return null // drift; the gas attack hisses
    case 'flood': return 'flood'
    case 'captured': return 'capture'
    case 'morale': return ev.delta < 0 ? 'morale' : null
    case 'weather': return 'weather'
    case 'wind': return null // the wind bed follows state.wind
    case 'game-over': return null // the Game plays victory/defeat
  }
}
