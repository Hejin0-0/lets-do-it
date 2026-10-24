// Rubber Duck Pool — sounds, synthesised with WebAudio (off until asked for; the first click starts the context):
// rubber-duck squeaks, plops and splashes, ducks knocking together, the hourglass turned over, the radio's
// stations (radio.js), each duck's voice when it is tapped (its design's: ducks.js) and its call as it arrives, and
// under it all the slide's rush and the fountain's patter. No two ducks sound alike: each speaks at its own pitch and
// pace, some with a wobble, and calls its own three notes (voiceOf).
import { STATIONS, pattern } from './radio.js';
import { DESIGNS } from './ducks.js';
import { P } from './layout.js';

const TUNES = STATIONS.map(pattern);
const hz = (semi) => 261.63 * Math.pow(2, semi / 12);
const CALL = [0, 2, 4, 7, 9, 12, 14, 16], WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
/** A duck's own way of speaking, the same every time (from its id): pitch and pace, a wobble (cents, Hz; some have
 * none), and the three notes (semitones of a pentatonic scale) it calls on arriving, on a wave of its own. */
export function voiceOf(id) {
  const r = P.rng(id * 7919 + 13);
  return { pitch: 0.72 * 1.9 ** r(), pace: 0.78 + 0.5 * r(), vib: r() < 0.4 ? 0 : 12 + 48 * r(), rate: 4.5 + 5 * r(),
    call: [0, 1, 2].map(() => CALL[Math.floor(r() * CALL.length)]), wave: WAVES[Math.floor(r() * WAVES.length)] };
}

export function createSound() {
  let ctx = null, master = null, noise = null, rush = null, patter = null, on = false, squeakT = 0, knockT = 0;
  let speaker = null, nextT = 0, stepN = 0, playing = 0;
  let vk = null, v0 = 0;   // the duck speaking (voiceOf) and when it began: tone and burst take its pitch and pace
  const at = (t) => (vk ? v0 + (t - v0) * vk.pace : t);
  function speak(id, say, t) { vk = id ? voiceOf(id) : null; v0 = t; say(t); vk = null; }
  function loop(type, f, q, gain) {
    const s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true; flt.type = type; flt.frequency.value = f; flt.Q.value = q; g.gain.value = 0;
    s.connect(flt); flt.connect(g); g.connect(master); s.start(0, Math.random());
    return { g, gain };
  }
  function ensure() {
    if (ctx || !window.AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    rush = loop('lowpass', 900, 0.6, 0.06);
    patter = loop('bandpass', 3800, 1.2, 0.025);
  }
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function burst(t, f0, f1, q, peak, dur, type = 'bandpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = vk ? vk.pitch : 1;
    t = at(t); dur *= vk ? vk.pace : 1; f0 *= p; f1 *= p;
    s.buffer = noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, peak, dur, attack = 0.01, lp = 3000) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = vk ? vk.pitch : 1;
    t = at(t); dur *= vk ? vk.pace : 1;
    o.type = type; o.frequency.setValueAtTime(f0 * p, t); o.frequency.exponentialRampToValueAtTime(f1 * p, t + dur);
    f.type = 'lowpass'; f.frequency.value = Math.min(18000, lp * p);
    env(g, t, attack, peak, dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + attack + 0.05);
    if (vk && vk.vib) {   // its wobble
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = vk.rate; lg.gain.value = vk.vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + attack + 0.05);
    }
  }
  const play = {
    squeak(t) { const p = 0.85 + Math.random() * 0.3; tone(t, 'square', 900 * p, 1350 * p, 0.04, 0.09, 0.008, 2600); tone(t + 0.09, 'square', 1350 * p, 820 * p, 0.035, 0.12, 0.006, 2400); },
    splash(t, k) { burst(t, 1700, 300, 0.7, 0.04 + 0.22 * k, 0.25 + 0.3 * k); },
    falls(t) { burst(t, 1300, 240, 0.6, 0.14, 0.45); tone(t, 'sine', 380, 140, 0.05, 0.15, 0.004); },
    plop(t) { tone(t, 'sine', 520, 180, 0.06, 0.09, 0.003); },
    hiss(t) { burst(t, 5200, 3600, 1.2, 0.05, 0.32, 'highpass'); },   // air going out of an inflatable
    scoop(t) { tone(t, 'triangle', 160, 110, 0.07, 0.12, 0.003, 900); burst(t, 600, 300, 2, 0.04, 0.08); },
    knock(t, k) { tone(t, 'sine', 300, 200, 0.02 + 0.06 * k, 0.06, 0.003); },
    turn(t) { tone(t, 'triangle', 240, 170, 0.06, 0.1, 0.004, 1200); burst(t + 0.05, 5000, 2500, 1.5, 0.03, 0.9, 'highpass'); },   // a wooden clunk, the sand shifting
    radio(t) { tone(t, 'square', 1800, 900, 0.02, 0.05, 0.002, 2500); },   // the switch
  };
  /** The ducks' voices, one for each design (DESIGNS[i].voice). */
  const voice = {
    squeak: (t) => play.squeak(t),
    bubbles(t) { for (let i = 0; i < 4; i++) tone(t + i * 0.055, 'sine', 520 + i * 120, 900 + i * 160, 0.05, 0.05, 0.004); },
    boing(t) { tone(t, 'sine', 170, 540, 0.09, 0.28, 0.005, 1800); tone(t + 0.02, 'triangle', 340, 1080, 0.03, 0.24, 0.005, 2400); },
    trill(t) { for (let i = 0; i < 7; i++) tone(t + i * 0.045, 'sine', i % 2 ? 1560 : 1250, i % 2 ? 1600 : 1300, 0.035, 0.04, 0.003); },
    zap(t) { burst(t, 9000, 700, 0.8, 0.12, 0.22, 'highpass'); tone(t, 'sawtooth', 1600, 70, 0.05, 0.22, 0.002, 4000); },
    moo(t) { tone(t, 'sawtooth', 150, 112, 0.09, 0.75, 0.09, 650); tone(t, 'sawtooth', 302, 226, 0.03, 0.7, 0.1, 900); },
    kiss(t) { tone(t, 'sine', 700, 1150, 0.06, 0.11, 0.004); tone(t + 0.13, 'sine', 980, 1500, 0.05, 0.14, 0.004); },
    twinkle(t) { [1568, 1976, 2349, 3136].forEach((f, i) => tone(t + i * 0.07, 'sine', f, f, 0.04, 0.22, 0.003)); },
    roar(t) { burst(t, 420, 140, 0.9, 0.16, 0.6, 'lowpass'); tone(t, 'sawtooth', 96, 64, 0.06, 0.55, 0.06, 420); },
    chime(t) { tone(t, 'triangle', 988, 988, 0.06, 0.9, 0.003, 5000); tone(t + 0.12, 'triangle', 1480, 1480, 0.04, 0.8, 0.003, 5000); },
    fanfare(t) { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.1, 'square', f, f, 0.035, i < 3 ? 0.09 : 0.35, 0.004, 2600)); },
    rainbow(t) { tone(t, 'sine', 380, 2300, 0.06, 0.55, 0.01); tone(t, 'triangle', 190, 1150, 0.03, 0.55, 0.01, 2000); },
  };
  /** A duck arriving (speaking: vk is set): its three notes on its own wave, then its design's voice. */
  function arrive(t, colour) {
    vk.call.forEach((n, i) => { const f = 523 * 2 ** (n / 12); tone(t + i * 0.1, vk.wave, f, f * 1.03, vk.wave === 'sine' || vk.wave === 'triangle' ? 0.06 : 0.03, i < 2 ? 0.08 : 0.22, 0.005, 2600); });
    voice[DESIGNS[colour].voice](t + 0.42);
  }
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
    set(v) { on = v; if (v) { ensure(); ctx && ctx.resume(); } else if (rush) { rush.g.gain.value = 0; patter.g.gain.value = 0; } },
    /** Play the world's events since last time; the slide and the fountain run on (quieter with the current down); the radio's station (0: off). */
    frame(events, currentK, station = 0) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      if (station) radio(t, station); else playing = 0;
      let n = 0;
      for (const e of events) {
        if (n > 8) break;
        if (e.type === 'squeak') { if (t < squeakT) continue; squeakT = t + 0.15; speak(e.id, play.squeak, t); }
        else if (e.type === 'arrive') speak(e.id, (s) => arrive(s, e.colour), t);
        else if (e.type === 'voice') speak(e.id, voice[DESIGNS[e.colour].voice], t);
        else if (e.type === 'splash') play.splash(t, Math.min(1, (e.speed || 1) / 3));
        else if (e.type === 'knock') { if (t < knockT) continue; knockT = t + 0.08; play.knock(t, Math.min(1, e.speed / 0.4)); }
        else if (play[e.type]) play[e.type](t);
        else continue;
        n++;
      }
      rush.g.gain.setTargetAtTime(rush.gain * (0.5 + 0.5 * Math.min(2, currentK)), t, 0.3);
      patter.g.gain.setTargetAtTime(patter.gain, t, 0.3);
    },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
}
