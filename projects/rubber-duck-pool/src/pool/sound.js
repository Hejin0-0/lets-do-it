// Rubber Duck Pool — the optional radio, synthesised with WebAudio.
// Duck creation, rides, collisions and other interactions deliberately produce no audio.
// No continuous water-noise sources are started when the first gesture enables audio.
import { STATIONS, pattern } from './radio.js';
import { P } from './layout.js';

const TUNES = STATIONS.map(pattern);
const hz = (semi) => 261.63 * Math.pow(2, semi / 12);
const CALL = [0, 2, 4, 7, 9, 12, 14, 16], WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
/** Retained deterministic duck identity metadata. These profiles no longer schedule audible duck calls. */
export function voiceOf(id) {
  const r = P.rng(id * 7919 + 13);
  return { pitch: 0.72 * 1.9 ** r(), pace: 0.78 + 0.5 * r(), vib: r() < 0.4 ? 0 : 12 + 48 * r(), rate: 4.5 + 5 * r(),
    call: [0, 1, 2].map(() => CALL[Math.floor(r() * CALL.length)]), wave: WAVES[Math.floor(r() * WAVES.length)] };
}

export function createSound() {
  let ctx = null, master = null, noise = null, on = false;
  let speaker = null, nextT = 0, stepN = 0, playing = 0;
  function ensure() {
    if (ctx || !window.AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  /** A note through the radio's little speaker (a narrow band: no bass to speak of, no sparkle). */
  const speakerIn = () => {
    if (!speaker) { speaker = ctx.createBiquadFilter(); speaker.type = 'bandpass'; speaker.frequency.value = 1300; speaker.Q.value = 0.6; speaker.connect(master); }
    return speaker;
  };
  function note(t, type, f, peak, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; env(g, t, 0.008, peak, dur);
    o.connect(g); g.connect(speakerIn()); o.start(t); o.stop(t + dur + 0.05);
  }
  /** A tick of noise through the speaker (the hi-hat). */
  function hat(t) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = 6000; env(g, t, 0.002, 0.03, 0.04);
    s.connect(f); f.connect(g); g.connect(speakerIn()); s.start(t, Math.random()); s.stop(t + 0.08);
  }
  function radio(t, station) {   // keep a quarter of a second of the station's tune scheduled ahead; a new station starts its first bar
    const st = STATIONS[station - 1], tune = TUNES[station - 1], step = 60 / st.bpm / 2;
    if (playing !== station) { playing = station; stepN = 0; nextT = t + 0.05; }
    if (nextT < t) nextT = t + 0.05;
    while (nextT < t + 0.25) {
      const i = stepN % 32, root = st.roots[Math.floor(i / 8)];
      if (i % st.bassEvery === 0) note(nextT, st.bass, hz(root - 12 + (i % 8 === 4 ? 7 : 0)), 0.16, step * st.bassEvery * 0.85);   // the bass: root, fifth
      if (tune[i] !== null) note(nextT, st.lead, hz(tune[i]), st.lead === 'sine' ? 0.06 : 0.03, step * 0.85);
      if (st.hat && i % 2 === 1) hat(nextT);
      nextT += step; stepN++;
    }
  }
  return {
    get on() { return on; },
    set(v) {
      on = !!v;
      if (on) { ensure(); ctx?.resume(); }
      if (master) master.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.02);
      if (!on) playing = 0;
    },
    /** Only an explicitly selected radio station produces audio. World events stay silent. */
    frame(_events, _currentK, station = 0) {
      if (!on || !ctx) return;
      if (station) radio(ctx.currentTime, station); else playing = 0;
    },
    close() {
      ctx?.close(); ctx = null; master = null; noise = null; speaker = null;
      on = false; playing = 0; nextT = 0; stepN = 0;
    },
  };
}
