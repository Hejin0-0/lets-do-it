// Procedural audio — a port of www/src/17-audio.js (DESIGN §10). Nothing is loaded: the game
// ships as one offline HTML file, so every sound is an envelope and a filter over ONE noise
// buffer, sometimes with an oscillator under it. Kept from the original: the noise buffer, the
// tanh soft clip, the two-tap field echo, crack/blast/clack/patter, the booking-calendar voice
// pool with stealing, and schedule(). Changed, as the design asks:
//   - cosmetic randomness is a seeded generator (@lid/random), pitch varies ±6%;
//   - the ear is the camera (setListener), panned along the camera's right vector;
//   - the distance delay is min(0.35 s, d_real / 343) with 1 world metre = 2,500 real metres.
//     From the commander's chair every battle sound is 3-5 km "away", so the flash leads and the
//     report lands at the 0.35 s cap; the table's own sounds (brass, felt, wax, tin) are real-
//     scale and play dry and immediate.
// Three scales: 'battle' (the war under the glass: far, low-passed, echoing over the field),
// 'table' (things on the oak: near, dry, panned) and 'room' (the library: bell, clock, thunder).
//
// GRAPH  voice ─► pan ─► air lowpass ─► head ─┬─► field ─┬─► taps 0.19 s / 0.41 s ─┐
//                                             │          └────────────────────────┤
//                                             └─► room ───────────────────────────┤
//        ambience (fire, wind, rain, clock) ─► amb (ducks −8 dB on barrages) ─────┤
//                                                    destination ◄─ master ◄─ soft clip
import { readStored, writeStored } from '@lid/storage'
import type { Bus } from '../contract/bus.ts'
import type { CueName, GameEvent } from '../contract/events.ts'
import type { GameState, HexId, UnitKind } from '../contract/types.ts'
import { COLS, ROWS } from '../contract/types.ts'
import { HEX_FLAT, TABLE_TOP_Y } from '../contract/render-api.ts'
import { createSeededRandom } from '@lid/random'

export interface AudioStats {
  state: string
  muted: boolean
  played: number
  dropped: number
  stolen: number
  cues: Record<string, number> // bus cues received, by name (counted even while muted)
}

export interface AudioSystem {
  unlock(): void // call from the first user gesture (also armed on window by createAudio)
  setListener(x: number, y: number, z: number): void
  muted(): boolean
  setMuted(m: boolean): void
  dispose(): void
  stats(): AudioStats
}

const SPEED = 343 // m/s
const REAL_PER_WORLD = 2500 // DESIGN §10: 1 world metre on the table = 2.5 km of Flanders
const MAX_DELAY = 0.35
const REF_REAL = 2600 // real metres at which a battle sound falls to half; the chair hears 0.35-0.5
const REF_TABLE = 3 // world metres, for the tin and brass on the table itself
const NVOICE = 24
const NOISE_LEN = 2
const FLOOR = 0.0035
const MASTER = 0.55
const DUCK = 0.398 // −8 dB
const PITCH_VAR = 0.06
const MUTE_KEY = 'ink-and-iron:muted'

type Scale = 'battle' | 'table' | 'room'
type Extra = 'mg08' | 'vickers' | 'volley' | 'gun18pdr' | 'gun6pdr'
type VoiceName = CueName | Extra
interface Voice { g: number; scale: Scale; f: (t: number, g: number, o: AudioNode) => number }
interface Pos { x: number; y: number; z: number }

// Board-local hex centre (the same formula as the board's local()), lifted to the tabletop.
const R = HEX_FLAT / Math.sqrt(3)
const DX = 1.5 * R
export function hexWorld(h: HexId): Pos {
  const c = h % COLS, r = Math.floor(h / COLS)
  return {
    x: c * DX - (DX * (COLS - 1)) / 2,
    y: TABLE_TOP_Y,
    z: r * HEX_FLAT + (c & 1 ? HEX_FLAT / 2 : 0) - (HEX_FLAT * (ROWS - 1) + HEX_FLAT / 2) / 2,
  }
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

// =================================================================================================
//  THE ENGINE — graph, helpers, building blocks, voices, voice pool. Runs on any BaseAudioContext,
//  so the dev harness can render every cue offline and measure it.
// =================================================================================================

export interface Engine {
  voice(name: VoiceName, pos: Pos | null, gain: number, ear?: Pos): void
  master: GainNode
  amb: GainNode
  noise: AudioBuffer
  stat: { played: number; dropped: number; stolen: number }
}

export function makeEngine(ctx: BaseAudioContext, dest: AudioNode, rand: () => number): Engine {
  const stat = { played: 0, dropped: 0, stolen: 0 }
  let pitch = 1

  // ---- graph -----------------------------------------------------------------------------------
  const master = ctx.createGain()
  master.gain.value = MASTER
  master.connect(dest)
  const shaper = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 1.7) / 0.9354
  shaper.curve = curve
  shaper.oversample = '2x'
  shaper.connect(master)
  const field = ctx.createGain()
  field.connect(shaper)
  const room = ctx.createGain()
  room.connect(shaper)
  const amb = ctx.createGain()
  amb.gain.value = 1
  amb.connect(shaper)
  // The field: two low-passed taps, the second feeding back into the first — the dune face to the
  // west and the flooded polder to the east.
  const tap = (time: number, level: number, cut: number): { d: DelayNode; g: GainNode } => {
    const d = ctx.createDelay(1)
    d.delayTime.value = time
    const lp = filt('lowpass', cut, 0.7)
    const g = gainOf(level)
    field.connect(d); d.connect(lp); lp.connect(g); g.connect(shaper)
    return { d, g }
  }
  const t1 = tap(0.19, 0.26, 1500)
  const t2 = tap(0.41, 0.15, 780)
  const fb = gainOf(0.22)
  t2.g.connect(fb); fb.connect(t1.d)

  // One noise buffer for everything. Two uniform draws summed: a triangular density that keeps
  // the soft clip out of trouble when several blasts land together.
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_LEN), ctx.sampleRate)
  const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = rand() + rand() - 1

  // ---- node helpers ------------------------------------------------------------------------------
  function gainOf(v: number): GainNode { const g = ctx.createGain(); g.gain.value = v; return g }
  function filt(type: BiquadFilterType, f: number, q?: number): BiquadFilterNode {
    const b = ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = clamp(f, 20, 20000)
    if (q) b.Q.value = q
    return b
  }
  function noiseSrc(t0: number, dur: number, rate: number): AudioBufferSourceNode {
    const s = ctx.createBufferSource()
    s.buffer = noise
    s.loop = true
    s.playbackRate.value = Math.max(0.05, rate * pitch)
    s.start(t0, rand() * (NOISE_LEN - 0.05))
    s.stop(t0 + dur + 0.02)
    return s
  }
  function tone(type: OscillatorType, t0: number, f0: number, f1: number, dur: number): OscillatorNode {
    const o = ctx.createOscillator()
    o.type = type
    const a = Math.max(8, f0 * pitch), b = Math.max(8, f1 * pitch)
    o.frequency.setValueAtTime(a, t0)
    if (b !== a) o.frequency.exponentialRampToValueAtTime(b, t0 + dur)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
    return o
  }
  // Percussive envelope: exponential up, exponential down, hard zero after — silent once done.
  function env(t0: number, peak: number, a: number, d: number): GainNode {
    const g = ctx.createGain()
    const at = Math.max(0.0008, a)
    g.gain.setValueAtTime(0.0002, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, peak), t0 + at)
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + at + d)
    g.gain.setValueAtTime(0, t0 + at + d + 0.004)
    return g
  }
  // noise ─► filter ─► envelope ─► out, the commonest chain in the file.
  function burst(t: number, g: number, o: AudioNode, dur: number, rate: number, f: BiquadFilterNode, a = 0.002): void {
    const n = noiseSrc(t, dur, rate), e = env(t, g, a, dur)
    n.connect(f); f.connect(e); e.connect(o)
  }
  function sine(t: number, g: number, o: AudioNode, f0: number, f1: number, dur: number, a = 0.003): void {
    const s = tone('sine', t, f0, f1, dur), e = env(t, g, a, dur)
    s.connect(e); e.connect(o)
  }

  // ---- building blocks (from 17-audio.js) --------------------------------------------------------
  function crack(t0: number, g: number, out: AudioNode, hpHz: number, bodyHz: number, dur: number): number {
    burst(t0, g, out, dur, 1, filt('highpass', hpHz, 0.7), 0.0012)
    const o = tone('triangle', t0, bodyHz, bodyHz * 0.32, dur * 0.75)
    const oe = env(t0, g * 0.55, 0.002, dur * 0.75)
    o.connect(oe); oe.connect(out)
    return dur
  }
  function blast(t0: number, g: number, out: AudioNode, lowHz: number, dur: number, bright: number): number {
    const lp = filt('lowpass', bright, 0.6)
    lp.frequency.setValueAtTime(bright, t0)
    lp.frequency.exponentialRampToValueAtTime(Math.max(70, bright * 0.12), t0 + dur)
    burst(t0, g, out, dur, 0.55, lp, 0.005)
    sine(t0, g * 0.95, out, lowHz * 2.6, lowHz * 0.5, dur * 0.7, 0.007)
    return dur
  }
  function clack(t0: number, g: number, out: AudioNode, hz: number, dur: number): number {
    burst(t0, g, out, dur, 1.7, filt('bandpass', hz, 7), 0.0008)
    return dur
  }
  function patter(t0: number, g: number, out: AudioNode, span: number, n: number, hz: number): number {
    for (let i = 0; i < n; i++) {
      const t = t0 + rand() * span, d = 0.03 + rand() * 0.05
      burst(t, g * (0.25 + rand() * 0.5), out, d, 1.1 + rand() * 0.7, filt('bandpass', hz * (0.6 + rand() * 1.1), 3), 0.001)
    }
    return span + 0.1
  }
  // New for the library: an FM bell (inharmonic 1:1.4 ratio, index decaying with the ring).
  function bell(t: number, g: number, o: AudioNode, f: number, dur: number): number {
    const car = tone('sine', t, f, f, dur)
    const mod = ctx.createOscillator()
    mod.frequency.value = f * 1.4 * pitch
    const idx = ctx.createGain()
    idx.gain.setValueAtTime(f * 3.2 * pitch, t)
    idx.gain.exponentialRampToValueAtTime(f * 0.12 * pitch, t + dur)
    mod.connect(idx); idx.connect(car.frequency)
    mod.start(t); mod.stop(t + dur + 0.02)
    const e = env(t, g, 0.003, dur)
    car.connect(e); e.connect(o)
    sine(t, g * 0.22, o, f * 2.76, f * 2.73, dur * 0.45, 0.002) // the strike partial
    return dur
  }
  // A trench whistle: a pea whistle's trill is ~26 Hz amplitude modulation on a high sine.
  function whistleBlow(t: number, g: number, o: AudioNode, dur: number): void {
    const s = tone('sine', t, 2350, 2290, dur)
    const am = gainOf(0.5)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 26
    const depth = gainOf(0.5)
    lfo.connect(depth); depth.connect(am.gain)
    lfo.start(t); lfo.stop(t + dur + 0.02)
    const e = env(t, g, 0.012, dur)
    s.connect(am); am.connect(e); e.connect(o)
  }
  function burstOf(t: number, g: number, o: AudioNode, n: number, rate: number, hp: number, body: number, dur: number): number {
    for (let i = 0; i < n; i++) crack(t + i / rate, g * (0.82 + rand() * 0.18), o, hp, body, dur)
    return n / rate + dur
  }

  // ---- the voices ---------------------------------------------------------------------------------
  // Record<CueName, …> makes the cue table exhaustive at compile time.
  const CUE: Record<CueName, Voice> = {
    // brass click: a latch, then its spring. The table's small sounds (select, deselect, step,
    // pivot, ui) were all but silent — peaks of 0.03-0.08 against the bell's 0.55 (an outside
    // review measured them with renderVoice) — so their gains sit ~4x higher: peaks ~0.2-0.3.
    select: { g: 1.9, scale: 'table', f: (t, g, o) => {
      clack(t, g, o, 3400, 0.022); clack(t + 0.028, g * 0.55, o, 5400, 0.016)
      sine(t, g * 0.08, o, 4200, 4150, 0.12, 0.001)
      return 0.16
    } },
    deselect: { g: 1.6, scale: 'table', f: (t, g, o) => { clack(t, g, o, 2300, 0.03); return clack(t + 0.03, g * 0.45, o, 1800, 0.02) + 0.03 } },
    // felt thunk: a tin base set down on baize
    place: { g: 0.8, scale: 'table', f: (t, g, o) => {
      burst(t, g, o, 0.11, 0.5, filt('lowpass', 260, 0.7), 0.004)
      sine(t, g * 0.8, o, 120, 58, 0.1)
      return 0.13
    } },
    // tin clatter: bases rocking across the oak
    step: { g: 3.0, scale: 'table', f: (t, g, o) => {
      for (let i = 0; i < 5; i++) {
        const st = t + i * 0.1 + rand() * 0.02
        clack(st, g * (0.35 + rand() * 0.25), o, 2400 + rand() * 1800, 0.02)
        burst(st, g * 0.3, o, 0.03, 0.6, filt('lowpass', 320, 0.7))
      }
      return 0.55
    } },
    pivot: { g: 2.2, scale: 'table', f: (t, g, o) => {
      for (let i = 0; i < 3; i++) clack(t + i * 0.05, g * (1 - i * 0.2), o, 1700 + i * 200, 0.03)
      const bp = filt('bandpass', 900, 1.2)
      bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.14)
      burst(t, g * 0.35, o, 0.14, 1, bp, 0.03)
      return 0.2
    } },
    // two dull knocks on wood: no
    invalid: { g: 0.55, scale: 'table', f: (t, g, o) => {
      burst(t, g, o, 0.05, 1, filt('bandpass', 380, 5)); sine(t, g * 0.6, o, 170, 150, 0.06)
      burst(t + 0.13, g * 0.8, o, 0.05, 1, filt('bandpass', 330, 5)); sine(t + 0.13, g * 0.5, o, 150, 130, 0.06)
      return 0.22
    } },
    overwatch: { g: 0.95, scale: 'battle', f: (t, g, o) => mg08(t, g, o) },
    fire: { g: 1, scale: 'battle', f: (t, g, o) => volley(t, g, o) },
    // the shell in flight: descending, vibrato'd (from 17-audio.js 'whistle')
    incoming: { g: 0.7, scale: 'battle', f: (t, g, o) => {
      const dur = 0.95
      const s = tone('sine', t, 1500, 430, dur)
      const v = ctx.createOscillator()
      v.frequency.value = 7.5
      const va = gainOf(26 * pitch)
      v.connect(va); va.connect(s.frequency); v.start(t); v.stop(t + dur + 0.02)
      const e = env(t, g, 0.1, dur * 0.9)
      s.connect(e); e.connect(o)
      burst(t, g * 0.25, o, dur, 1, filt('bandpass', 2400, 4), 0.12)
      return dur
    } },
    // the arrival (17-audio.js 'incoming'): burst, then the debris coming down
    blast: { g: 1.1, scale: 'battle', f: (t, g, o) => { blast(t, g, o, 40, 1.3, 1900); return patter(t + 0.08, g * 0.35, o, 0.9, 12, 1100) } },
    // whistle + clacks: two blasts on the whistle, then boots, bayonets and rifles
    assault: { g: 0.9, scale: 'battle', f: (t, g, o) => {
      whistleBlow(t, g * 0.55, o, 0.18)
      whistleBlow(t + 0.26, g * 0.55, o, 0.5)
      patter(t + 0.55, g * 0.45, o, 0.8, 14, 1600)
      for (let i = 0; i < 3; i++) crack(t + 0.7 + rand() * 0.5, g * 0.7, o, 1900, 245, 0.15)
      return 1.4
    } },
    // tin clack: a figure topples, rings once, settles
    'figure-lost': { g: 0.7, scale: 'table', f: (t, g, o) => {
      clack(t, g, o, 4200, 0.03); clack(t + 0.07, g * 0.7, o, 2900, 0.04)
      sine(t, g * 0.18, o, 3150, 3080, 0.35, 0.002)
      clack(t + 0.16, g * 0.4, o, 3600, 0.025)
      return 0.4
    } },
    // quill scratch: a nib hatching the hex
    intent: { g: 0.45, scale: 'table', f: (t, g, o) => {
      for (let i = 0; i < 4; i++) {
        const st = t + i * 0.12 + rand() * 0.03, d = 0.06 + rand() * 0.08
        burst(st, g * (0.5 + rand() * 0.5), o, d, 1.3, filt('bandpass', 3200 + rand() * 2400, 1.6), 0.01)
      }
      return 0.65
    } },
    // wax thunk: the seal pressed down, then peeled
    capture: { g: 0.9, scale: 'table', f: (t, g, o) => {
      sine(t, g, o, 95, 48, 0.2, 0.004)
      burst(t, g * 0.6, o, 0.14, 0.7, filt('lowpass', 420, 0.8), 0.003)
      burst(t + 0.24, g * 0.25, o, 0.07, 1.2, filt('bandpass', 2000, 3))
      return 0.34
    } },
    bell: { g: 0.7, scale: 'room', f: (t, g, o) => {
      clack(t, g * 0.3, o, 2600, 0.02)
      bell(t, g, o, 523, 2.8)
      return bell(t + 0.004, g * 0.35, o, 1046 * 1.003, 1.6) + 1.2
    } },
    'wire-cut': { g: 0.7, scale: 'battle', f: (t, g, o) => {
      clack(t, g, o, 5200, 0.018); clack(t + 0.045, g * 0.8, o, 4100, 0.03)
      const s = tone('triangle', t + 0.05, 1350, 1280, 0.35), e = env(t + 0.05, g * 0.3, 0.002, 0.33)
      s.connect(e); e.connect(o)
      return 0.42
    } },
    // the shell-case gong, then the cloud hissing out
    gas: { g: 0.8, scale: 'battle', f: (t, g, o) => {
      const P = [523, 781, 1187, 1611, 2104, 2917]
      for (let i = 0; i < P.length; i++) sine(t, g * (0.3 / (i + 1)), o, P[i] * (0.995 + rand() * 0.01), P[i] * 0.985, 1.6 + rand(), 0.004)
      burst(t + 0.2, g * 0.35, o, 2.2, 1, filt('highpass', 1800, 0.7), 0.5)
      return 2.5
    } },
    flood: { g: 0.9, scale: 'battle', f: (t, g, o) => {
      const lp = filt('lowpass', 1200, 0.7)
      lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(380, t + 2.4)
      burst(t, g, o, 2.6, 0.6, lp, 0.35)
      return patter(t + 0.3, g * 0.3, o, 2, 16, 700) + 0.3
    } },
    // two spade scrapes into sand, then a sandbag set down
    'dig-in': { g: 0.6, scale: 'battle', f: (t, g, o) => {
      for (let i = 0; i < 2; i++) {
        const bp = filt('bandpass', 1400, 2)
        bp.frequency.setValueAtTime(1400, t + i * 0.28); bp.frequency.exponentialRampToValueAtTime(600, t + i * 0.28 + 0.2)
        burst(t + i * 0.28, g * 0.6, o, 0.2, 1, bp, 0.02)
      }
      burst(t + 0.62, g, o, 0.1, 0.5, filt('lowpass', 220, 0.7), 0.004)
      sine(t + 0.62, g * 0.6, o, 90, 50, 0.1)
      return 0.75
    } },
    // a rim candle snuffed: one breath, one hiss
    morale: { g: 0.5, scale: 'table', f: (t, g, o) => {
      burst(t, g, o, 0.3, 1, filt('bandpass', 1500, 0.7), 0.03)
      burst(t + 0.05, g * 0.3, o, 0.2, 1, filt('highpass', 4000, 0.7), 0.01)
      return 0.36
    } },
    // weather comes in at the lancets: a far crack, then a long roll
    weather: { g: 0.8, scale: 'room', f: (t, g, o) => {
      burst(t, g * 0.4, o, 0.4, 0.8, filt('lowpass', 900, 0.7), 0.02)
      burst(t + 0.1, g, o, 3, 0.35, filt('lowpass', 160, 0.9), 0.4)
      sine(t + 0.1, g * 0.6, o, 38, 22, 2.6, 0.3)
      return 3.2
    } },
    // reinforcements: tin boots in step, then a drum flourish
    reinforce: { g: 0.7, scale: 'battle', f: (t, g, o) => {
      for (let i = 0; i < 10; i++) clack(t + i * 0.17, g * 0.35, o, i % 2 ? 1900 : 2200, 0.025)
      for (let i = 0; i < 18; i++) burst(t + 1 + i * 0.034, g * (0.2 + i * 0.02), o, 0.03, 1.3, filt('bandpass', 2600, 1.5), 0.001)
      return 1.75
    } },
    // a page turned back
    undo: { g: 0.9, scale: 'table', f: (t, g, o) => {
      for (let i = 0; i < 6; i++) {
        burst(t + i * 0.035, g * (1 - i * 0.13), o, 0.035, 1.2, filt('bandpass', 1800 + i * 240, 1.4), 0.004)
      }
      return 0.28
    } },
    // a peal and a brass chord swelling under it
    victory: { g: 0.7, scale: 'room', f: (t, g, o) => {
      bell(t, g * 0.8, o, 659, 2.4); bell(t + 0.32, g * 0.8, o, 784, 2.4); bell(t + 0.64, g, o, 1047, 2.8)
      for (const f of [262, 330, 392]) {
        const s = tone('sawtooth', t + 0.3, f, f, 2.4), lp = filt('lowpass', 1400, 0.7), e = env(t + 0.3, g * 0.12, 0.6, 1.8)
        s.connect(lp); lp.connect(e); e.connect(o)
      }
      return 3.5
    } },
    // one low toll, a second fainter, and a minor drone under both
    defeat: { g: 0.75, scale: 'room', f: (t, g, o) => {
      bell(t, g, o, 196, 3.2); bell(t + 1.6, g * 0.7, o, 175, 3)
      sine(t, g * 0.2, o, 98, 96, 3.6, 0.8); sine(t, g * 0.15, o, 117, 115, 3.6, 0.8)
      return 4.7
    } },
    ui: { g: 2.1, scale: 'table', f: (t, g, o) => clack(t, g, o, 2600, 0.018) },
  }
  // The MG08 is a water-cooled sledgehammer (7.5 rounds/s, a jacket ring); the Vickers is quicker
  // and lighter (9 rounds/s). Rifles fire as a ragged section volley.
  function mg08(t: number, g: number, o: AudioNode): number {
    sine(t, g * 0.16, o, 640, 500, 0.09, 0.001)
    return burstOf(t, g, o, 7, 7.5, 1020, 142, 0.17)
  }
  function volley(t: number, g: number, o: AudioNode): number {
    for (let i = 0; i < 4; i++) crack(t + rand() * 0.25, g * (0.6 + rand() * 0.4), o, 1900, 245, 0.15)
    return 0.45
  }
  const EXTRA: Record<Extra, Voice> = {
    mg08: CUE.overwatch,
    vickers: { g: 0.9, scale: 'battle', f: (t, g, o) => burstOf(t, g, o, 8, 9, 1250, 168, 0.14) },
    volley: CUE.fire,
    gun18pdr: { g: 1.05, scale: 'battle', f: (t, g, o) => { crack(t, g * 0.6, o, 900, 120, 0.12); return blast(t, g, o, 44, 1.2, 1250) } },
    gun6pdr: { g: 1, scale: 'battle', f: (t, g, o) => blast(t, g, o, 54, 0.95, 1500) },
  }

  // ---- voice pool (17-audio.js claim): a booking calendar, not a mutex --------------------------
  const vEnd = new Float64Array(NVOICE)
  const vGain = new Float32Array(NVOICE)
  const vHead: (AudioParam | null)[] = new Array(NVOICE).fill(null)
  function claim(t0: number, dur: number, g: number): number {
    let quiet = 0, quietG = Infinity
    for (let i = 0; i < NVOICE; i++) {
      if (vEnd[i] <= t0) { vEnd[i] = t0 + dur; vGain[i] = g; vHead[i] = null; return i }
      if (vGain[i] < quietG) { quietG = vGain[i]; quiet = i }
    }
    // Everything is busy: a loud sound displaces the quietest; a quiet one is dropped.
    if (g <= quietG * 1.25) { stat.dropped++; return -1 }
    const h = vHead[quiet]
    if (h) {
      try {
        const now = ctx.currentTime
        h.cancelScheduledValues(now)
        h.setValueAtTime(Math.max(0.0002, h.value), now)
        h.exponentialRampToValueAtTime(0.0002, now + 0.03)
        h.setValueAtTime(0, now + 0.035)
      } catch { /* the node already finished and released its params */ }
    }
    stat.stolen++
    vEnd[quiet] = t0 + dur
    vGain[quiet] = g
    vHead[quiet] = null
    return quiet
  }

  function voice(name: VoiceName, pos: Pos | null, gain: number, ear: Pos = { x: 0, y: 2, z: 1.1 }): void {
    const V = name in CUE ? CUE[name as CueName] : EXTRA[name as Extra]
    let d = 0, pan = 0
    if (pos) {
      const dx = pos.x - ear.x, dy = pos.y - ear.y, dz = pos.z - ear.z
      const dw = Math.hypot(dx, dy, dz)
      d = V.scale === 'battle' ? dw * REAL_PER_WORLD : dw
      // The ear faces the table centre: its right vector is the horizontal forward turned −90°.
      const fl = Math.hypot(ear.x, ear.z) || 1
      const rx = ear.z / fl, rz = -ear.x / fl
      pan = clamp((dx * rx + dz * rz) / Math.max(0.3, Math.hypot(dx, dz)), -1, 1) * 0.7
    }
    const ref = V.scale === 'battle' ? REF_REAL : REF_TABLE
    const att = gain * V.g * (pos ? ref / (ref + d) : 1)
    if (!(att > FLOOR)) { stat.dropped++; return }
    pitch = 1 + (rand() * 2 - 1) * PITCH_VAR
    // Flash now, report later (battle); the table's own sounds are near and immediate.
    const t0 = ctx.currentTime + 0.012 + (V.scale === 'battle' ? Math.min(MAX_DELAY, d / SPEED) : 0)
    const head = gainOf(1)
    let tail: AudioNode = head
    if (V.scale === 'battle') {
      // Air absorption over kilometres of damp air — the "under glass" colour of the war.
      const air = filt('lowpass', clamp(19000 * Math.exp(-d / 2600), 900, 19000), 0.7)
      head.connect(air)
      tail = air
    }
    if (pan !== 0 && 'createStereoPanner' in ctx) {
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      tail.connect(p)
      tail = p
    }
    tail.connect(V.scale === 'battle' ? field : room)
    const dur = V.f(t0, att, head) || 0.2
    const slot = claim(t0, dur + 0.05, att)
    if (slot < 0) { head.gain.value = 0; return } // nodes are built; mute rather than unpick
    vHead[slot] = head.gain
    stat.played++
  }

  return { voice, master, amb, noise, stat }
}

// =================================================================================================
//  THE LIVE SYSTEM — gesture gate, bus wiring, ambience, ducking, mute persistence.
// =================================================================================================

function loadMuted(): boolean {
  return readStored(MUTE_KEY, (t) => t === '1', false)
}
function saveMuted(m: boolean): void {
  writeStored(MUTE_KEY, m ? '1' : '0') // private mode: mute lasts the session
}

export function createAudio(bus: Bus): AudioSystem {
  const rand = createSeededRandom(0x1917)
  let ctx: AudioContext | null = null
  let eng: Engine | null = null
  let dead = false
  let mute = loadMuted()
  const ear: Pos = { x: 0, y: TABLE_TOP_Y + 1.1, z: 1.12 }
  const cues: Record<string, number> = {}
  let last: GameState | null = null
  let fireQ: (UnitKind | undefined)[] = [] // attacker kinds of this batch's fire events, in order
  let lastBlast = { hex: -1, t: -9 }
  let timer = 0
  let rainLevel = 0
  let windT = 0
  let beds: { wind: GainNode; windLp: BiquadFilterNode; rain: GainNode; fire: GainNode } | null = null

  function now(): number { return ctx ? ctx.currentTime : 0 }

  function duck(): void {
    if (!eng || !ctx) return
    const g = eng.amb.gain, t = ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(Math.max(DUCK, g.value), t)
    g.linearRampToValueAtTime(DUCK, t + 0.05)
    g.setValueAtTime(DUCK, t + 0.8)
    g.linearRampToValueAtTime(1, t + 1.2)
  }

  // ---- ambience: the fire, the wind at the lancets, the rain, the clock ------------------------
  function loopBed(rate: number, f: BiquadFilterNode, level: number): GainNode {
    const c = ctx!, e = eng!
    const s = c.createBufferSource()
    s.buffer = e.noise
    s.loop = true
    s.playbackRate.value = rate
    const g = c.createGain()
    g.gain.value = level
    s.connect(f); f.connect(g); g.connect(e.amb)
    s.start(0, rand() * NOISE_LEN)
    return g
  }
  function biquad(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = ctx!.createBiquadFilter()
    b.type = type; b.frequency.value = f; b.Q.value = q
    return b
  }
  function grain(t: number, dur: number, type: BiquadFilterType, f: number, q: number, peak: number): void {
    const c = ctx!, e = eng!
    const s = c.createBufferSource()
    s.buffer = e.noise
    s.playbackRate.value = 0.9 + rand() * 0.4
    const b = biquad(type, f, q)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0002, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.001)
    g.gain.exponentialRampToValueAtTime(0.0002, t + dur)
    s.connect(b); b.connect(g); g.connect(e.amb)
    s.start(t, rand() * (NOISE_LEN - 0.1))
    s.stop(t + dur + 0.01)
  }
  function tickTock(): void {
    if (!ctx || mute) return
    const t = ctx.currentTime + 0.05
    grain(t, 0.025, 'bandpass', 2900, 9, 0.09)
    grain(t + 0.52, 0.03, 'bandpass', 2200, 9, 0.08)
  }
  function startAmbience(): void {
    const windLp = biquad('lowpass', 420)
    beds = {
      fire: loopBed(0.5, biquad('lowpass', 380), 0.05),
      wind: loopBed(0.35, windLp, 0.02),
      windLp,
      rain: loopBed(1, biquad('bandpass', 5200, 0.5), 0),
    }
    const ph = [rand() * 6.28, rand() * 6.28]
    timer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running' || !beds) return
      const t = ctx.currentTime
      // Fire: a crackle most ticks, now and then a log pops.
      if (rand() < 0.55) grain(t + rand() * 0.1, 0.004 + rand() * 0.016, 'bandpass', 1800 + rand() * 3400, 1.2, 0.01 + rand() * 0.04)
      if (rand() < 0.15) grain(t + rand() * 0.1, 0.008, 'bandpass', 2500 + rand() * 2000, 1.2, 0.02)
      if (rand() < 0.012) grain(t + 0.02, 0.05, 'bandpass', 700, 2, 0.07)
      // Wind: slow beating sines, never a per-frame value.
      windT += 0.12
      const w = 0.5 + 0.3 * Math.sin(windT * 0.09 + ph[0]) + 0.2 * Math.sin(windT * 0.23 + ph[1])
      beds.wind.gain.setTargetAtTime(0.012 + w * 0.03, t, 0.6)
      beds.windLp.frequency.setTargetAtTime(330 + w * 430, t, 0.8)
      // Rain against the lancets, with drops.
      beds.rain.gain.setTargetAtTime(rainLevel * 0.045, t, 1.2)
      if (rainLevel > 0.5) for (let i = 0; i < 3; i++) if (rand() < 0.6) grain(t + rand() * 0.12, 0.004, 'highpass', 3500, 0.7, 0.01 + rand() * 0.02)
      // Music: a slow harmonium in D minor on your turn; a low rubbing drone while the enemy moves.
      if (music) {
        const tense = !!last && last.phase !== 'player-orders' && last.phase !== 'over' && last.phase !== 'dawn'
        if (tense !== wasTense) { chordAt = t; wasTense = tense }
        if (t >= chordAt) {
          const notes = tense ? TENSE : CHORDS[chordI++ % CHORDS.length]
          notes.forEach((f, i) => music?.osc[i].frequency.setTargetAtTime(f, t, tense ? 0.5 : 1.6))
          music.lp.frequency.setTargetAtTime(tense ? 380 : 950, t, 1.4)
          chordAt = t + (tense ? 3 : 7.5)
        }
      }
    }, 120)
    startMusic()
  }

  // ---- music: four reed voices through a soft lowpass into the ambience bus (so it ducks under
  // the shells and goes with the mute). An outside review found no music at all. ---------------
  const MUSIC_LEVEL = 0.05
  const CHORDS = [ // Dm, B♭, F/C, A — the reeds glide between them
    [146.83, 174.61, 220.0, 293.66], [116.54, 174.61, 233.08, 293.66],
    [130.81, 174.61, 220.0, 261.63], [110.0, 164.81, 220.0, 277.18],
  ]
  const TENSE = [73.42, 110.0, 146.83, 155.56] // D, A, D and an E♭ rubbing against it
  let music: { osc: OscillatorNode[]; lp: BiquadFilterNode } | null = null
  let chordAt = 0, chordI = 0, wasTense = false
  function startMusic(): void {
    const c = ctx!, e = eng!
    const out = c.createGain()
    out.gain.value = 0
    const lp = biquad('lowpass', 950, 0.4)
    lp.connect(out); out.connect(e.amb)
    const osc = CHORDS[0].map((f, i) => {
      const o = c.createOscillator()
      o.type = i === 0 ? 'sawtooth' : 'triangle'
      o.frequency.value = f
      o.detune.value = (i - 1.5) * 5
      const g = c.createGain()
      g.gain.value = i === 0 ? 0.3 : 0.5
      o.connect(g); g.connect(lp)
      o.start()
      return o
    })
    out.gain.setTargetAtTime(MUSIC_LEVEL, c.currentTime + 1, 4) // a slow swell in, never a jump
    music = { osc, lp }
  }

  // ---- gesture gate (17-audio.js): build nothing until the page has been touched ---------------
  function unlock(): void {
    if (dead) return
    try {
      if (!ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) { dead = true; return }
        ctx = new AC()
        eng = makeEngine(ctx, ctx.destination, rand)
        eng.master.gain.value = mute ? 0 : MASTER
        startAmbience()
      }
      if (ctx.state === 'suspended') void ctx.resume().then(release, () => {})
      else release()
    } catch {
      dead = true
      ctx = null
      eng = null
    }
  }
  // Only a gesture a person made counts. An untrusted (scripted) event cannot start audio anyway,
  // and answering one created the context early and then re-tried resume() on every later input:
  // an outside review counted 214 identical autoplay warnings in one three-round session.
  const gesture = (e: Event): void => { if (e.isTrusted) unlock() }
  const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const
  for (const k of GESTURES) window.addEventListener(k, gesture, true)
  function release(): void { for (const k of GESTURES) window.removeEventListener(k, gesture, true) }

  // ---- bus ------------------------------------------------------------------------------------
  function play(cue: CueName, hex?: HexId): void {
    cues[cue] = (cues[cue] ?? 0) + 1
    if (!eng || !ctx || mute) return
    const pos = hex === undefined ? null : hexWorld(hex)
    let name: VoiceName = cue
    switch (cue) {
      case 'overwatch': {
        // The side that is NOT giving orders fires overwatch: during your orders it is the enemy.
        const s = last
        const firing = !s ? 'DE' : s.phase === 'player-orders' ? (s.human === 'BR' ? 'DE' : 'BR') : s.human
        name = firing === 'DE' ? 'mg08' : 'vickers'
        break
      }
      case 'fire': {
        const k = fireQ.shift()
        name = k === 'fieldgun' ? 'gun18pdr' : k === 'tank' ? 'gun6pdr' : k === 'mg' ? 'vickers' : 'volley'
        break
      }
      case 'wire-cut':
        if (hex === lastBlast.hex && ctx.currentTime - lastBlast.t < 2.5) return // the shell took the wire
        break
      case 'blast':
        lastBlast = { hex: hex ?? -1, t: ctx.currentTime }
        duck()
        break
      case 'incoming':
        duck()
        break
    }
    try { eng.voice(name, pos, 1, ear) } catch {
      if (ctx.state === 'closed') { dead = true; eng = null }
    }
  }

  function onState(s: GameState, events: GameEvent[]): void {
    if (events.length > 0) {
      const kind = (id: string): UnitKind | undefined =>
        (s.units.find((u) => u.id === id) ?? last?.units.find((u) => u.id === id))?.kind
      fireQ = events.flatMap((ev) => ev.e === 'attack' && (ev.kind === 'fire' || ev.kind === 'strike-back') ? [kind(ev.by)] : [])
      // A batch with shells in it: the whistle leads while the board animates, the blasts follow.
      const shell = events.find((ev) => ev.e === 'attack' && ev.kind === 'barrage')
      if (shell && shell.e === 'attack') play('incoming', shell.target)
      // A move: the tin clatter while the base rocks across the map; its landing thunks later.
      const mv = events.find((ev) => ev.e === 'moved')
      if (mv && mv.e === 'moved' && mv.path.length > 0) play('step', mv.path[0])
    }
    if (last && s.round > last.round && s.phase !== 'over') tickTock()
    rainLevel = s.weather.now === 'rain' ? 1 : 0
    last = s
  }

  const offs = [
    bus.on('audio', ({ cue, hex }) => play(cue, hex)),
    bus.on('state', ({ state, events }) => onState(state, events)),
  ]

  return {
    unlock,
    setListener(x, y, z) { ear.x = x; ear.y = y; ear.z = z },
    muted: () => mute,
    setMuted(m) {
      mute = m
      saveMuted(m)
      if (eng && ctx) eng.master.gain.setTargetAtTime(m ? 0 : MASTER, now(), 0.03)
    },
    dispose() {
      for (const f of offs) f()
      release()
      clearInterval(timer)
      void ctx?.close().catch(() => {})
      ctx = null
      eng = null
      dead = true
    },
    stats() {
      return {
        state: dead ? 'dead' : ctx ? ctx.state : 'locked', muted: mute,
        played: eng?.stat.played ?? 0, dropped: eng?.stat.dropped ?? 0, stolen: eng?.stat.stolen ?? 0,
        cues: { ...cues },
      }
    },
  }
}

// Dev/QA: render one voice offline and measure it (the ?hud&state=audio harness plays every cue).
export async function renderVoice(name: VoiceName, seconds = 3.5): Promise<{ rms: number; peak: number }> {
  const sr = 22050
  const oc = new OfflineAudioContext(2, Math.floor(sr * seconds), sr)
  const eng = makeEngine(oc, oc.destination, createSeededRandom(7))
  eng.voice(name, null, 1)
  const buf = await oc.startRendering()
  let sum = 0, peak = 0
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])) }
  return { rms: Math.sqrt(sum / d.length), peak }
}
export const VOICE_NAMES: VoiceName[] = [
  'select', 'deselect', 'place', 'step', 'pivot', 'invalid', 'overwatch', 'fire', 'incoming', 'blast',
  'assault', 'figure-lost', 'intent', 'capture', 'bell', 'wire-cut', 'gas', 'flood', 'dig-in', 'morale',
  'weather', 'reinforce', 'undo', 'victory', 'defeat', 'ui', 'mg08', 'vickers', 'volley', 'gun18pdr', 'gun6pdr',
]
