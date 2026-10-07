import type { Vector3 } from 'three'

/**
 * Build order system 7: sound.
 *
 * Zero audio files, same rule as the textures. Everything here is an oscillator,
 * a filter, or a buffer of noise generated in a loop at start-up.
 *
 * The thing that makes procedural ambience work is not the timbre of any one
 * source, it is that the sources have different *statistics*. A traffic bed that
 * is stationary noise, an AC unit on a fixed 100 Hz, a horn that fires on a
 * Poisson interval and a neon tube that gates on a two-state Markov flicker do
 * not sound synthetic together, because nothing in the mix is periodic with
 * anything else. Four loops of the same length would.
 */

export interface Ambience {
  /** Called every frame with the camera's world position and forward vector. */
  update(pos: Vector3, forward: Vector3): void
  /**
   * Where the passing car is, so its engine follows it.
   *
   * The car is the one thing on this street that arrives and leaves, and half
   * of what makes that read is that you hear it before you see it and after it
   * has gone. Silent, it is a prop sliding past.
   */
  car(pos: Vector3): void
  step(left: boolean, speed: number): void
  suspend(): void
  readonly running: boolean
}

export interface AudioAnchors {
  /** Where the bar is, for the muffled music. */
  bar: Vector3
  /** A wall-mounted AC unit close to the walking line. */
  ac: Vector3
  /** The neon sign that buzzes. */
  neon: Vector3
}

export function createAmbience(anchors: AudioAnchors): Ambience {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0.85
  master.connect(ctx.destination)

  // A soft limiter, so a horn landing on top of a footstep on top of the bar
  // does not clip. A compressor is the lazy version of gain staging and here it
  // is the right lazy version — the alternative is mixing four stochastic
  // sources by hand and hoping.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 22
  comp.ratio.value = 5
  comp.attack.value = 0.005
  comp.release.value = 0.22
  comp.connect(master)

  const noise = makeNoiseBuffer(ctx, 4, 0.82)
  const white = makeNoiseBuffer(ctx, 2, 0)

  // ---- distant traffic --------------------------------------------------
  // Brown-ish noise, low-passed hard, with two slow LFOs on the cutoff so it
  // breathes. Traffic heard from a block away is almost entirely below 500 Hz —
  // the higher content is what the buildings absorb.
  {
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    lp.Q.value = 0.6
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 45
    const g = ctx.createGain()
    g.gain.value = 0.20

    for (const [rate, depth] of [[0.037, 90], [0.011, 130]] as const) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = rate
      const amt = ctx.createGain()
      amt.gain.value = depth
      lfo.connect(amt).connect(lp.frequency)
      lfo.start()
    }
    src.connect(hp).connect(lp).connect(g).connect(comp)
    src.start()
  }

  // ---- muffled bar music ------------------------------------------------
  // A slow chord loop through a 340 Hz lowpass, which is what a wall does. The
  // kick survives the wall and the rest of the kit does not, so only the kick
  // is here — a full drum pattern heard through brick is a mistake you can hear.
  const bar = positional(ctx, anchors.bar, 24)
  {
    const wall = ctx.createBiquadFilter()
    wall.type = 'lowpass'
    wall.frequency.value = 340
    wall.Q.value = 0.9
    const g = ctx.createGain()
    g.gain.value = 0.30
    wall.connect(g).connect(bar.input)

    // i - VI - III - VII in A minor, two bars each at 104 bpm.
    const roots = [110, 87.31, 130.81, 98]
    let chordAt = ctx.currentTime + 0.4
    const beat = 60 / 104
    for (let n = 0; n < 64; n++) {
      const root = roots[n % roots.length]
      const dur = beat * 4
      for (const mul of [1, 1.5, 2.4]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = root * mul
        const e = ctx.createGain()
        e.gain.setValueAtTime(0, chordAt)
        e.gain.linearRampToValueAtTime(0.1 / mul, chordAt + 0.09)
        e.gain.linearRampToValueAtTime(0, chordAt + dur * 0.96)
        o.connect(e).connect(wall)
        o.start(chordAt)
        o.stop(chordAt + dur)
      }
      // Kick on 1 and 3.
      for (const b of [0, 2]) {
        const t = chordAt + b * beat
        const o = ctx.createOscillator()
        o.frequency.setValueAtTime(115, t)
        o.frequency.exponentialRampToValueAtTime(46, t + 0.12)
        const e = ctx.createGain()
        e.gain.setValueAtTime(0.5, t)
        e.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
        o.connect(e).connect(wall)
        o.start(t)
        o.stop(t + 0.26)
      }
      chordAt += dur
    }
  }

  // ---- AC unit ----------------------------------------------------------
  // A compressor motor is a fundamental plus its harmonics, slightly unstable,
  // over a bed of fan noise. The instability matters: a perfectly steady tone
  // reads as a test signal.
  const ac = positional(ctx, anchors.ac, 11)
  {
    const g = ctx.createGain()
    g.gain.value = 0.16
    g.connect(ac.input)

    for (const [f, a] of [[99.6, 1], [199.2, 0.42], [298.8, 0.16]] as const) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = 0.09 * a
      // Wobble, a few cents, at a rate that is not a factor of anything else.
      const wob = ctx.createOscillator()
      wob.frequency.value = 0.7 + a * 0.31
      const wg = ctx.createGain()
      wg.gain.value = f * 0.004
      wob.connect(wg).connect(o.frequency)
      wob.start()
      o.connect(og).connect(g)
      o.start()
    }
    const fan = ctx.createBufferSource()
    fan.buffer = white
    fan.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 850
    bp.Q.value = 0.7
    const fg = ctx.createGain()
    fg.gain.value = 0.12
    fan.connect(bp).connect(fg).connect(g)
    fan.start()
  }

  // ---- buzzing neon -----------------------------------------------------
  // Mains hum at twice the line frequency, which is what a failing ballast
  // actually produces, gated by a two-state flicker.
  const neon = positional(ctx, anchors.neon, 8)
  const neonGate = ctx.createGain()
  {
    neonGate.gain.value = 0
    neonGate.connect(neon.input)
    for (const [f, a] of [[120, 0.5], [240, 0.3], [360, 0.16], [600, 0.07]] as const) {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.045 * a
      o.connect(g).connect(neonGate)
      o.start()
    }
    const flicker = () => {
      const on = Math.random() > 0.34
      const now = ctx.currentTime
      neonGate.gain.cancelScheduledValues(now)
      neonGate.gain.setTargetAtTime(on ? 1 : 0.12, now, 0.02)
      setTimeout(flicker, on ? 400 + Math.random() * 4200 : 60 + Math.random() * 340)
    }
    flicker()
  }

  // ---- distant horns ----------------------------------------------------
  // Two pitches a minor third apart, which is how car horns are actually
  // voiced, through a long-distance lowpass and a slap of delay for the street.
  {
    const honk = () => {
      const t = ctx.currentTime + 0.05
      const g = ctx.createGain()
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900 + Math.random() * 700
      const dur = 0.28 + Math.random() * 0.5
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.09 + Math.random() * 0.05, t + 0.02)
      g.gain.setValueAtTime(0.09, t + dur - 0.05)
      g.gain.linearRampToValueAtTime(0, t + dur)
      const base = 300 + Math.random() * 160
      for (const mul of [1, 1.19, 2, 2.38]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = base * mul
        const og = ctx.createGain()
        og.gain.value = 0.3 / mul
        o.connect(og).connect(g)
        o.start(t)
        o.stop(t + dur + 0.02)
      }
      const echo = ctx.createDelay(0.4)
      echo.delayTime.value = 0.13 + Math.random() * 0.16
      const eg = ctx.createGain()
      eg.gain.value = 0.34
      g.connect(lp).connect(comp)
      lp.connect(echo).connect(eg).connect(comp)
      setTimeout(honk, 14000 + Math.random() * 42000)
    }
    setTimeout(honk, 6000 + Math.random() * 12000)
  }

  // ---- passing conversation ---------------------------------------------
  //
  // "Walla", in the film-sound sense: people talking near enough to hear and far
  // enough not to understand. That distinction is the whole design constraint —
  // anything intelligible would need words, and words on a loop are worse than
  // silence. What the ear actually identifies as speech is the *rhythm* and the
  // *formants*, not the content, so this synthesises both and no vocabulary.
  //
  // Each voice is a buzzy glottal source through three bandpass formants, gated
  // into syllables at roughly 4 Hz. Two voices take turns rather than talking
  // over each other, because overlapping speech reads as a crowd and the brief
  // is a quiet side street. The pair walks past on a panner, so the conversation
  // arrives, passes and recedes instead of sitting at a fixed point.
  {
    const voices = ctx.createGain()
    voices.gain.value = 0.5
    // Heard across a street, through air, usually facing away: the top end goes
    // first. This is what makes it "someone talking over there" and not "someone
    // talking into a microphone".
    const air = ctx.createBiquadFilter()
    air.type = 'lowpass'
    air.frequency.value = 1900
    air.Q.value = 0.7
    voices.connect(air)

    /** One syllable: a pitched buzz shaped by three formants, plus a consonant. */
    const syllable = (
      at: number,
      dur: number,
      f0: number,
      formants: [number, number, number],
      out: AudioNode,
      level: number,
    ) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      // Pitch moves within a syllable — a flat one sounds like a synth tone.
      osc.frequency.setValueAtTime(f0 * (0.94 + Math.random() * 0.12), at)
      osc.frequency.linearRampToValueAtTime(f0 * (0.9 + Math.random() * 0.2), at + dur)

      const env = ctx.createGain()
      env.gain.setValueAtTime(0, at)
      env.gain.linearRampToValueAtTime(level, at + 0.028)
      env.gain.setValueAtTime(level, at + dur * 0.62)
      env.gain.exponentialRampToValueAtTime(0.0008, at + dur)
      osc.connect(env)

      formants.forEach((f, i) => {
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = f * (0.97 + Math.random() * 0.06)
        bp.Q.value = 7 - i * 1.6
        const g = ctx.createGain()
        g.gain.value = [1, 0.55, 0.22][i]
        env.connect(bp).connect(g).connect(out)
      })
      osc.start(at)
      osc.stop(at + dur + 0.02)

      // Consonant: a short noise burst at the front of most syllables. Without
      // these it is humming, not talking.
      if (Math.random() > 0.35) {
        const c = ctx.createBufferSource()
        c.buffer = white
        c.playbackRate.value = 0.8 + Math.random() * 0.6
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 1600 + Math.random() * 1800
        const cg = ctx.createGain()
        cg.gain.setValueAtTime(level * 0.5, at)
        cg.gain.exponentialRampToValueAtTime(0.0005, at + 0.045)
        c.connect(hp).connect(cg).connect(out)
        c.start(at)
        c.stop(at + 0.06)
      }
    }

    const conversation = () => {
      // A pair walking past, on their own panner so they move.
      const p = ctx.createPanner()
      p.panningModel = 'HRTF'
      p.distanceModel = 'inverse'
      p.refDistance = 4
      p.maxDistance = 90
      p.rolloffFactor = 1.6
      p.connect(comp)
      const bus = ctx.createGain()
      bus.gain.value = 0.9
      bus.connect(p)
      air.connect(bus)

      // Walk them down one kerb, past the listener, over about 14 seconds.
      const now = ctx.currentTime
      const side = Math.random() > 0.5 ? 7.6 : -7.6
      const from = 30
      const to = -30
      const travel = 14
      if (p.positionX) {
        p.positionX.setValueAtTime(side, now)
        p.positionY.setValueAtTime(1.6, now)
        p.positionZ.setValueAtTime(from, now)
        p.positionZ.linearRampToValueAtTime(to, now + travel)
      } else {
        p.setPosition(side, 1.6, from)
      }

      // Two speakers, different registers, taking turns.
      const speakers: Array<{ f0: number; formants: [number, number, number] }> = [
        { f0: 96 + Math.random() * 26, formants: [420, 1180, 2400] },
        { f0: 172 + Math.random() * 44, formants: [610, 1860, 2720] },
      ]
      let t = now + 0.4
      let who = Math.floor(Math.random() * 2)
      while (t < now + travel - 0.5) {
        const sp = speakers[who]
        const syllables = 3 + Math.floor(Math.random() * 7)
        for (let i = 0; i < syllables; i++) {
          const dur = 0.1 + Math.random() * 0.12
          // Stress the odd syllable, or it scans like a metronome.
          const level = (i === 1 || Math.random() > 0.75 ? 0.09 : 0.055) * (0.7 + Math.random() * 0.6)
          syllable(t, dur, sp.f0, sp.formants, bus, level)
          t += dur + 0.02 + Math.random() * 0.06
        }
        // Laughter every so often: fast repeated syllables on a falling pitch.
        if (Math.random() > 0.78) {
          const n = 3 + Math.floor(Math.random() * 4)
          for (let i = 0; i < n; i++) {
            syllable(t, 0.075, sp.f0 * (1.25 - i * 0.05), sp.formants, bus, 0.075)
            t += 0.105
          }
        }
        // Turn-taking gap.
        t += 0.25 + Math.random() * 0.7
        who = 1 - who
      }

      // Tear the chain down once they are gone, or every pass leaks nodes.
      setTimeout(() => {
        try {
          air.disconnect(bus)
          bus.disconnect()
          p.disconnect()
        } catch {
          /* already gone */
        }
      }, (travel + 2) * 1000)

      setTimeout(conversation, 17000 + Math.random() * 34000)
    }
    setTimeout(conversation, 4000 + Math.random() * 9000)
  }

  // ---- footsteps --------------------------------------------------------
  const stepBus = ctx.createGain()
  stepBus.gain.value = 0.55
  stepBus.connect(comp)

  let running = true

  // ---- the passing car ---------------------------------------------------
  //
  // A small four-cylinder at a steady 40 km/h: a low sawtooth for the firing
  // order, a second an octave up for the body of it, and band-passed noise for
  // the tyres, which at this speed is most of what you actually hear. All three
  // through one panner, because they are one object.
  //
  // The Web Audio doppler was removed from the spec years ago, so the pitch
  // shift is done by hand off the closing rate. It is small — a car at 11 m/s
  // shifts about 3% — and leaving it out is very audible, because the ear uses
  // it to tell approach from retreat.
  const carVoice = positional(ctx, anchors.ac, 6)
  carVoice.panner.rolloffFactor = 1.05
  carVoice.panner.maxDistance = 260
  // Its own air-absorption filter rather than the shared one, which is scoped
  // to the walla block. Distance takes the top off a sound, and a car two
  // hundred metres away is nearly all bottom end.
  const carAir = ctx.createBiquadFilter()
  carAir.type = 'lowpass'
  carAir.frequency.value = 2600
  carVoice.panner.connect(carAir)
  carAir.connect(comp)

  const engineGain = ctx.createGain()
  engineGain.gain.value = 0.030
  const engineLP = ctx.createBiquadFilter()
  engineLP.type = 'lowpass'
  engineLP.frequency.value = 420
  engineLP.Q.value = 0.7
  engineGain.connect(engineLP)
  engineLP.connect(carVoice.input)

  const engineOscs: OscillatorNode[] = []
  for (const [hz, level] of [[47, 1], [94, 0.55], [141, 0.22]] as const) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz
    const g = ctx.createGain()
    g.gain.value = level
    o.connect(g)
    g.connect(engineGain)
    o.start()
    engineOscs.push(o)
  }

  const tyres = ctx.createBufferSource()
  tyres.buffer = makeNoiseBuffer(ctx, 3, 0.35)
  tyres.loop = true
  const tyreBP = ctx.createBiquadFilter()
  tyreBP.type = 'bandpass'
  tyreBP.frequency.value = 1050
  tyreBP.Q.value = 0.8
  const tyreGain = ctx.createGain()
  tyreGain.gain.value = 0.020
  tyres.connect(tyreBP)
  tyreBP.connect(tyreGain)
  tyreGain.connect(carVoice.input)
  tyres.start()

  let lastCarDist = 0
  let haveLastCar = false

  return {
    get running() {
      return running
    },
    car(pos: Vector3) {
      const p = carVoice.panner
      if (p.positionX) {
        p.positionX.value = pos.x
        p.positionY.value = pos.y + 0.5
        p.positionZ.value = pos.z
      } else {
        p.setPosition(pos.x, pos.y + 0.5, pos.z)
      }
      // Closing rate from the listener, in metres per frame; positive means
      // getting further away.
      const l = ctx.listener
      const lx = l.positionX ? l.positionX.value : 0
      const lz = l.positionZ ? l.positionZ.value : 0
      const dist = Math.hypot(pos.x - lx, pos.z - lz)
      if (haveLastCar) {
        const closing = lastCarDist - dist
        // Clamped hard: a teleport when the car loops back to the start must not
        // fire the pitch bend, and one frame of a dropped tab must not either.
        const shift = Math.max(-60, Math.min(60, closing * 900))
        for (const o of engineOscs) o.detune.value = shift
        tyreBP.frequency.value = 1050 * (1 + shift / 4000)
      }
      lastCarDist = dist
      haveLastCar = true
    },
    update(pos: Vector3, forward: Vector3) {
      const l = ctx.listener
      // The modern AudioParam interface is not in every browser yet, so fall
      // back to the deprecated setters rather than losing spatialisation.
      if (l.positionX) {
        l.positionX.value = pos.x
        l.positionY.value = pos.y
        l.positionZ.value = pos.z
        l.forwardX.value = forward.x
        l.forwardY.value = forward.y
        l.forwardZ.value = forward.z
        l.upX.value = 0
        l.upY.value = 1
        l.upZ.value = 0
      } else {
        l.setPosition(pos.x, pos.y, pos.z)
        l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0)
      }
    },
    step(left: boolean, speed: number) {
      const t = ctx.currentTime
      const src = ctx.createBufferSource()
      src.buffer = white
      src.playbackRate.value = 0.85 + Math.random() * 0.3
      // A footfall on concrete is a click, not a thud: a very short burst around
      // 1.6 kHz with a 40 ms tail. Harder at speed, and the two feet are not
      // identical — nobody's are, and identical ones sound like a machine.
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = (left ? 1500 : 1750) * (0.94 + Math.random() * 0.12)
      bp.Q.value = 0.9
      const lo = ctx.createBiquadFilter()
      lo.type = 'lowshelf'
      lo.frequency.value = 220
      lo.gain.value = 7
      const g = ctx.createGain()
      const hit = 0.12 + Math.min(1, speed / 3.1) * 0.2
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(hit, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05 + Math.random() * 0.03)
      src.connect(bp).connect(lo).connect(g).connect(stepBus)
      src.start(t)
      src.stop(t + 0.14)
    },
    suspend() {
      running = false
      void ctx.suspend()
    },
  }
}

/**
 * A panner set up for street distances: inverse falloff, a reference distance
 * where it is at full level, and a cone left wide because none of these sources
 * are directional in a way you could hear.
 */
function positional(ctx: AudioContext, at: Vector3, refDistance: number) {
  const p = ctx.createPanner()
  p.panningModel = 'HRTF'
  p.distanceModel = 'inverse'
  p.refDistance = refDistance
  p.maxDistance = 220
  p.rolloffFactor = 1.3
  if (p.positionX) {
    p.positionX.value = at.x
    p.positionY.value = at.y
    p.positionZ.value = at.z
  } else {
    p.setPosition(at.x, at.y, at.z)
  }
  const input = ctx.createGain()
  input.connect(p)
  return { input, panner: p }
}

/**
 * Noise buffer. `brown` in [0,1] integrates the white noise, which tilts the
 * spectrum toward the low end — 0 is white, 1 is close to brown. Traffic wants
 * the tilt; a fan does not.
 */
function makeNoiseBuffer(ctx: AudioContext, seconds: number, brown: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1
    last = (last + brown * 0.02 * w) / (1 + brown * 0.02)
    d[i] = w * (1 - brown) + last * brown * 22
  }
  // Normalise, then crossfade the seam so the loop point is inaudible.
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]))
  if (peak > 0) for (let i = 0; i < n; i++) d[i] /= peak
  const fade = Math.min(2048, Math.floor(n / 8))
  for (let i = 0; i < fade; i++) {
    const k = i / fade
    d[i] = d[i] * k + d[n - fade + i] * (1 - k)
  }
  return buf
}
