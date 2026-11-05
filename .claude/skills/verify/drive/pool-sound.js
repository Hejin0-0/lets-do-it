// The page's sound: off until the first touch or key, which starts it; M turns it off and on again. Its engine, rendered
// offline (an OfflineAudioContext through the page's own engine and the page's own recordings), is measured: every
// recording loads; the scene is heard, softly; the pool's lapping is fuller near the pool and the sea's waves fuller
// from afar; the slide's splash, the pump, the tube and a tapped duck's voice stand out; the radio is heard; nothing
// clips, even with many ducks and splashes at once. window.__wav = 'day' (or 'pool', 'radio') returns that scene as a
// base64 WAV instead, to listen to, five seconds of it from window.__part * 5 (the probe stalls on a reply of a few MB).
(async () => {
  const h = window.__pool, SR = 44100, REC = h.recordings
  const c = h.state().camera, ce = Math.cos(c.el)
  const FAR = [c.target[0] + c.dist * ce * Math.sin(c.az), c.target[1] + c.dist * Math.sin(c.el), c.target[2] + c.dist * ce * Math.cos(c.az)], WHOLE = c.target
  const NEAR = [1.7, 1.75, 2.3], SLIDE = [1.08, 1.26, 1.9]   // beside the slide's middle, looking at it
  const decoded = new Map()   // each file fetched and decoded once, for every render
  const decode = async (url, ctx) => { if (!decoded.has(url)) decoded.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.arrayBuffer() })); return ctx.decodeAudioData((await decoded.get(url)).slice(0)) }
  let loaded = 0
  async function render(sec, { hour = 12, eye = FAR, at = WHOLE, station = 0, events = [], only = null } = {}) {
    const ctx = new OfflineAudioContext(2, Math.round(SR * sec), SR), scene = { hour, eye, at, station }
    const load = (url, cx) => (only && !only.some((k) => REC[k] === url) ? Promise.reject(new Error('left out')) : decode(url, cx).then((b) => { loaded++; return b }))
    const s = h.createSound(() => ctx, load)
    s.set(true); await s.ready; s.frame([], scene)
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
  const at = (t, type, more = {}) => ({ t, type, x: SLIDE[0] - 0.2, y: 1.2, z: SLIDE[2], ...more })
  const poolEvents = [at(2, 'whee', { slide: true }), at(3.6, 'splash', { slide: true, speed: 1.2 }), at(5.2, 'voice', { colour: 3 }), at(6.8, 'gurgle'), at(8.4, 'pop'), at(10, 'squeak', { colour: 8 })]
  const LISTEN = { day: () => render(20, { hour: 11 }), pool: () => render(12, { hour: 11, eye: NEAR, at: SLIDE, events: poolEvents }), radio: () => render(10, { hour: 11, station: 1 }) }
  // every render the same each run (the birds, the waves, the splash's drops): a check that holds or fails for good
  let a = 20251025; const real = Math.random
  const seeded = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const render0 = render
  render = async (...args) => { Math.random = seeded; try { return await render0(...args) } finally { Math.random = real } }
  if (window.__wav) {
    h.pause(true)
    return wav(await LISTEN[window.__wav](), (window.__part || 0) * 5, 5)
  }

  const canvas = document.querySelector('canvas'), opts = { bubbles: true, clientX: innerWidth / 2, clientY: innerHeight / 2, pointerId: 1 }
  const key = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }))
  const wait = () => new Promise((r) => setTimeout(r, 200))
  const before = h.state().sound
  canvas.dispatchEvent(new PointerEvent('pointerdown', opts)); canvas.dispatchEvent(new PointerEvent('pointerup', opts)); await wait()
  const touched = h.state().sound; key(); await wait(); const muted = h.state().sound; key(); await wait(); const again = h.state().sound
  h.sound(false); h.pause(true)   // nothing else on the page moves or sounds while it renders
  const event = (type, more = {}) => [at(2, type, more)]
  const near = { hour: 12, eye: NEAR, at: SLIDE }
  const day = await render(10, { hour: 12 })
  const lapNear = level(await render(4, { ...near, only: ['lapping'] }), 1, 4), lapFar = level(await render(4, { hour: 12, only: ['lapping'] }), 1, 4)
  const seaNear = level(await render(4, { ...near, only: ['sea', 'surf'] }), 1, 4), seaFar = level(await render(4, { hour: 12, only: ['sea', 'surf'] }), 1, 4)
  const stands = async (events) => { const b = await render(4, { ...near, events }); return +(loudest(b, 2, 2.5) - loudest(b, 1.3, 1.9)).toFixed(1) }
  loaded = 0; await render(1, {}); const all = loaded
  const m = {
    before, touched, muted, again, loaded: all, of: Object.keys(REC).length, day: level(day, 1, 10), lapNear, lapFar, seaNear, seaFar,
    slideSplash: await stands(event('splash', { slide: true, speed: 1.2 })), pump: await stands(event('gurgle')), tube: await stands(event('pop')),
    voice: await stands(event('voice', { colour: 3 })), squeak: await stands(event('squeak', { colour: 7 })),
  }
  const radio = await render(4, { hour: 12, station: 1 })
  m.radioBand = level(radio, 1, 4, 1300, 5); m.dayBand = level(day, 1, 4, 1300, 5)
  const crowd = []   // a dozen ducks tapped and the slide, the pump and the tube all at once, twice over
  for (const t of [2, 2.5]) { for (let k = 0; k < 12; k++) crowd.push(at(t, 'voice', { colour: k })); crowd.push(at(t, 'splash', { slide: true, speed: 1.2 }), at(t, 'gurgle'), at(t, 'pop'), at(t, 'splash', { speed: 2 })) }
  m.peak = Math.max(peak(day), peak(radio), peak(await render(4, { ...near, events: crowd })))
  const checks = {
    'off until touched': before === false && touched === true,
    'M turns it off and on': muted === false && again === true,
    'every recording loads': m.loaded === m.of,
    'the scene is heard, softly': m.day > -50 && m.day < -14,
    "the pool's lapping is fuller near the pool": m.lapNear > m.lapFar + 3,
    "the sea's waves are fuller from afar": m.seaFar > m.seaNear + 3,
    "the slide's splash stands out": m.slideSplash > 6,
    'the pump is heard': m.pump > 3,
    'the tube is heard': m.tube > 3,
    "a tapped duck's voice stands out": m.voice > 6,
    "a picked-up duck's voice is heard": m.squeak > 3,
    'the radio is heard': m.radioBand > m.dayBand + 3,
    'nothing clips': m.peak < 0.98,
  }
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
  if (failed.length) throw new Error(`${failed.join('; ')}: ${JSON.stringify(m)}`)
  return JSON.stringify(m)
})()
