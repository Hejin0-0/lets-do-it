// The pool's sound, rendered offline (an OfflineAudioContext through the page's own engine) and measured: the day and
// the night sound different (crickets after dark), running water is loud up close and faint from afar, a splash and a
// tap's squeak stand out of the scene, the radio is heard, and nothing clips. window.__wav = 'day' (or 'dusk',
// 'night', 'pool', 'radio') returns that scene as a base64 WAV instead, to listen to, five seconds of it from
// window.__part * 5 (the probe stalls on a reply of a few MB; the scene is rendered the same each run).
(async () => {
  const h = window.__pool, SR = 44100
  const c = h.state().camera, ce = Math.cos(c.el)
  const FAR = [c.target[0] + c.dist * ce * Math.sin(c.az), c.target[1] + c.dist * Math.sin(c.el), c.target[2] + c.dist * ce * Math.cos(c.az)], WHOLE = c.target
  const NEAR = [1.7, 1.75, 2.3], SLIDE = [1.08, 1.26, 1.9]   // beside the slide's middle, looking at it
  async function render(sec, { hour = 12, eye = FAR, at = WHOLE, station = 0, events = [] } = {}) {
    const ctx = new OfflineAudioContext(2, Math.round(SR * sec), SR), s = h.createSound(() => ctx), scene = { hour, eye, at, station }
    s.set(true); s.frame([], scene)
    for (let k = 1; k < sec * 10 - 1; k++) {
      const t = k / 10
      ctx.suspend(t).then(() => { s.frame(events.filter((e) => Math.abs(e.t - t) < 0.049), scene); ctx.resume() })
    }
    const b = await ctx.startRendering(); s.close(); return b
  }
  const ch = (b) => [b.getChannelData(0), b.getChannelData(1)]
  const db = (x) => 20 * Math.log10(x + 1e-9)
  function level(b, t0, t1, f, q) {   // rms in dB over [t0, t1], through a band-pass at f (or all of it)
    let s = 0, n = 0
    for (const x of ch(b)) {
      let y = x
      if (f) {
        const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0
        y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0
        for (let i = 0; i < x.length; i++) { const v = b0 * x[i] - b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v }
      }
      for (let i = Math.floor(t0 * SR); i < Math.min(y.length, t1 * SR); i++) { s += y[i] * y[i]; n++ }
    }
    return +db(Math.sqrt(s / n)).toFixed(1)
  }
  /** The loudest 20 ms in [t0, t1] (dB): how a sudden sound is heard over a steady one. */
  const loudest = (b, t0, t1) => { let m = -Infinity; for (let t = t0; t < t1 - 0.02; t += 0.01) m = Math.max(m, level(b, t, t + 0.02)); return m }
  const peak = (b) => +Math.max(...ch(b).map((x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0))).toFixed(3)
  function wav(b, from, len) {
    const [l0, r0] = ch(b), i0 = Math.round(from * SR), l = l0.subarray(i0, i0 + len * SR), r = r0.subarray(i0, i0 + len * SR), n = l.length, buf = new DataView(new ArrayBuffer(44 + n * 4)), str = (o, s) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)))
    str(0, 'RIFF'); buf.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 2, true)
    buf.setUint32(24, SR, true); buf.setUint32(28, SR * 4, true); buf.setUint16(32, 4, true); buf.setUint16(34, 16, true); str(36, 'data'); buf.setUint32(40, n * 4, true)
    for (let i = 0; i < n; i++) { buf.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true); buf.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true) }
    let s = ''; const u = new Uint8Array(buf.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
    return btoa(s)
  }
  const poolEvents = [2, 3.6, 5.2, 6.8, 8.4, 10].map((t, i) => ({ t, type: i % 2 ? 'voice' : 'splash', id: i + 1, x: SLIDE[0] - 0.2, y: 1.2, z: SLIDE[2], speed: 1.4 }))
  const LISTEN = {
    day: () => render(20, { hour: 11 }), dusk: () => render(20, { hour: 18 }), night: () => render(20, { hour: 23 }),
    pool: () => render(12, { hour: 11, eye: NEAR, at: SLIDE, events: poolEvents }), radio: () => render(10, { hour: 11, station: 1 }),
  }
  // every render the same each run (the birds, the waves, the splash's drops): a check that holds or fails for good
  let a = 20251025; const real = Math.random
  const seeded = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const render0 = render
  render = async (...args) => { Math.random = seeded; try { return await render0(...args) } finally { Math.random = real } }
  if (window.__wav) {
    h.pause(true)
    return wav(await LISTEN[window.__wav](), (window.__part || 0) * 5, 5)
  }

  const day = await render(10, { hour: 12 }), night = await render(10, { hour: 23 })
  const near = await render(6, { hour: 12, eye: NEAR, at: SLIDE }), far = await render(6, { hour: 12 })
  const splash = await render(4, { hour: 12, eye: NEAR, at: SLIDE, events: [{ t: 2, type: 'splash', x: SLIDE[0] - 0.2, z: SLIDE[2], speed: 1.5 }] })
  const tap = await render(4, { hour: 12, eye: NEAR, at: SLIDE, events: [{ t: 2, type: 'voice', id: 3, x: SLIDE[0] - 0.2, y: 1.2, z: SLIDE[2] }] })
  const radio = await render(4, { hour: 12, station: 1 })
  const m = {
    day: level(day, 1, 10), night: level(night, 1, 10),
    cricketsDay: level(day, 1, 10, 4720, 10), cricketsNight: level(night, 1, 10, 4720, 10),   // a narrow band: a cricket is one note
    streamNear: level(near, 1, 6, 1900, 1.5), streamFar: level(far, 1, 6, 1900, 1.5),
    splashBefore: loudest(splash, 1.4, 1.9), splash: loudest(splash, 2, 2.25),
    squeakBefore: level(tap, 1.4, 1.9, 2700, 2), squeak: level(tap, 2, 2.3, 2700, 2),
    radioBand: level(radio, 1, 4, 1300, 2), musicBand: level(far, 1, 6, 1300, 2),
    peak: Math.max(peak(day), peak(night), peak(near), peak(splash), peak(tap), peak(radio)),
  }
  const checks = {
    'the scene is heard, softly': m.day > -42 && m.day < -14 && m.night > -48,
    'crickets after dark': m.cricketsNight > m.cricketsDay + 6,
    'running water up close, faint from afar': m.streamNear > m.streamFar + 6,
    'a splash stands out': m.splash > m.splashBefore + 6,
    "a tap's squeak stands out": m.squeak > m.squeakBefore + 10,
    'the radio is heard': m.radioBand > m.musicBand + 3,
    'nothing clips': m.peak < 0.98,
  }
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
  if (failed.length) throw new Error(`${failed.join('; ')}: ${JSON.stringify(m)}`)
  return JSON.stringify(m)
})()
