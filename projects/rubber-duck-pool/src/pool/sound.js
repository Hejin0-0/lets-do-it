// Rubber Duck Pool — its sound, made in WebAudio from oscillators, plucked strings and noise (no recordings): the sea
// and the wind; birds by day and crickets by night; a slow loop of music for the hour, which yields to the radio;
// running water heard only up close (the slide's stream, the round pool's swirl, the return tube's pour); a splash
// where something lands in the water, a rubber squeak when a duck is tapped or picked up, fireworks by night.
// Arrivals, knocks and rides stay quiet. Every sound in the scene has its place, and the listener is the camera.
import { STATIONS, pattern } from './radio.js';
import { daylight } from './daylight.js';
import { P } from './layout.js';

const TUNES = STATIONS.map(pattern);
const hz = (semi) => 261.63 * Math.pow(2, semi / 12);   // semitones from middle C
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const CALL = [0, 2, 4, 7, 9, 12, 14, 16], WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
/** A duck's voice, the same every time for its id: its squeak's pitch and pace (the rest is kept for its identity). */
export function voiceOf(id) {
  const r = P.rng(id * 7919 + 13);
  return { pitch: 0.72 * 1.9 ** r(), pace: 0.78 + 0.5 * r(), vib: r() < 0.4 ? 0 : 12 + 48 * r(), rate: 4.5 + 5 * r(),
    call: [0, 1, 2].map(() => CALL[Math.floor(r() * CALL.length)]), wave: WAVES[Math.floor(r() * WAVES.length)] };
}

/** The hour's music, four bars looping: its chords (semitones from middle C), tempo (eighths at bpm / 2 a second),
 * the scale its tune walks, how often the tune rests, its voice, and whether a ukulele strums or a pad holds the chords. */
export const MUSIC = {
  day: { bpm: 92, chords: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]], scale: [0, 2, 4, 7, 9, 12, 14, 16], seed: 5, rest: 0.35, lead: 'marimba', strum: true, pad: false },
  dusk: { bpm: 76, chords: [[5, 9, 12, 16], [4, 7, 11, 14], [2, 5, 9, 12], [0, 4, 7, 11]], scale: [0, 2, 4, 5, 7, 9, 11, 12, 14], seed: 11, rest: 0.55, lead: 'marimba', strum: false, pad: true },
  night: { bpm: 64, chords: [[-3, 0, 4, 7], [-7, -3, 0, 4], [0, 4, 7, 11], [-5, -1, 2, 4]], scale: [-3, 0, 2, 4, 7, 9, 12, 14], seed: 29, rest: 0.7, lead: 'kalimba', strum: false, pad: true },
};
/** Which music for the hour: the night's after dark, the dusk's from late afternoon to nightfall, else the day's. */
export const musicFor = (hour) => (daylight(hour).night > 0.6 ? 'night' : hour > 16.5 && hour < 21 ? 'dusk' : 'day');
/** A tune's 32 eighths: a semitone, or null for a rest. A walk over the scale that lands on a chord tone on the beat. */
function tune(m) {
  let r = m.seed, at = 3;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647, pc = (s) => ((s % 12) + 12) % 12;
  return Array.from({ length: 32 }, (_, i) => {
    if (i % 8 === 7 || rnd() < m.rest * (i % 2 ? 1.4 : 0.7)) return null;
    at = clamp(at + [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)], 0, m.scale.length - 1);
    let s = m.scale[at];
    if (i % 4 === 0) { const ch = m.chords[i >> 3].map(pc); while (!ch.includes(pc(s))) s--; }
    return s + 12;
  });
}
const MELODY = Object.fromEntries(Object.entries(MUSIC).map(([k, m]) => [k, tune(m)]));

// where the running water is (block-local): the round pool's whirl and the return tube's mouth; the slide's stream
// follows the slide, heard from its point nearest the listener
const SWIRL = [P.ROUND[0], P.LL, P.ROUND[1]], POUR = P.TUBE.at(-1);
const SLIDE = Array.from({ length: 17 }, (_, i) => P.slide.at((P.slide.len * i) / 16));
const LEVEL = { amb: 0.5, music: 0.17, sfx: 0.8, flow: 0.7, radio: 4 };

/** make: () -> an AudioContext (or any BaseAudioContext, e.g. an OfflineAudioContext to render it), or null. */
export function createSound(make = () => (globalThis.AudioContext ? new AudioContext() : null)) {
  let ctx = null, out = null, bus = null, room = null, white = null, birdSend = null, on = false;
  let speaker = null, nextT = 0, stepN = 0, playing = 0;
  const mus = { t: 0, step: 0, set: 'day' }, amb = { wave: 0, gust: 0, bird: 0, gull: 0 };
  const crickets = [{ f: 4300, period: 0.62, pan: -0.6 }, { f: 4720, period: 0.78, pan: 0.5 }, { f: 5150, period: 0.55, pan: 0.1 }].map((c) => ({ ...c, next: 0 }));
  let flows = null, sea = null, wind = null, lastSplash = -1;
  const strings = new Map();

  function ensure() {
    if (ctx) return;
    ctx = make();
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3; limit.knee.value = 3; limit.ratio.value = 12; limit.attack.value = 0.003; limit.release.value = 0.25;
    out = ctx.createGain(); out.gain.value = 0; chain(out, limit, ctx.destination);
    bus = Object.fromEntries(Object.entries(LEVEL).map(([k, v]) => [k, chain(gain(v), out)]));
    white = ctx.createBuffer(2, sr * 6, sr);
    for (let c = 0; c < 2; c++) { const d = white.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    // a room for the music and the birds: a long tail of noise dying away, darker as it goes
    const ir = ctx.createBuffer(2, Math.floor(sr * 2.6), sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / sr, k = 0.25 + 0.7 * Math.exp(-t * 1.2); lp += k * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-t * 2.4) * 0.6; } }
    room = ctx.createConvolver(); room.buffer = ir; room.connect(out);
    bus.music.connect(chain(gain(0.45), room));   // the reverb after the music's level, so the radio silences both
    birdSend = chain(gain(0.25), room);
    sea = seaBed(); wind = windBed(); flows = waterBeds();
  }

  // ----- building blocks -----
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function noise(t, rate = 1, loop = true) {
    const s = ctx.createBufferSource(); s.buffer = white; s.loop = loop; s.playbackRate.value = rate;
    s.start(t, Math.random() * 5); return s;
  }
  function filter(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  /** Connect the nodes in a row; the first (where the row is fed). */
  function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[0]; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function panned(v) { const p = ctx.createStereoPanner(); p.pan.value = v; return p; }
  /** A point in the scene a sound comes from; ref: how near it is at its full loudness, roll: how fast it fades. */
  function place(p, dest, ref = 2, roll = 1.2, model = 'inverse') {
    const n = ctx.createPanner(); n.panningModel = 'equalpower'; n.distanceModel = model; n.refDistance = ref; n.rolloffFactor = roll;
    n.positionX.value = p[0]; n.positionY.value = p[1]; n.positionZ.value = p[2]; n.connect(dest); return n;
  }
  /** A slowly wandering level (noise played very slowly) added to a gain: the flutter of running water. */
  function wander(param, depth, rate) { const g = gain(depth); chain(noise(0, rate), g); g.connect(param); }

  // ----- the beds: the sea, the wind, the running water (always running; their levels follow the scene) -----
  function seaBed() {
    const g = chain(gain(0.3), bus.amb), wash = chain(gain(0.0001), g), lp = chain(filter('lowpass', 500, 0.5), wash);
    chain(noise(0, 0.5), filter('lowpass', 260, 0.4), gain(1.4), g);   // the swell's low rumble
    chain(noise(0), lp);
    return { g, wash, lp };
  }
  function windBed() {
    const g = chain(gain(0.0001), bus.amb), bp = chain(filter('bandpass', 520, 0.6), g);
    chain(noise(0, 0.8), bp);
    return { g, bp };
  }
  function waterBeds() {
    const at = { stream: place(SLIDE[8], bus.flow, 1.1, 1.6, 'exponential'), swirl: place(SWIRL, bus.flow, 1.3, 1.6, 'exponential'), pour: place(POUR, bus.flow, 1, 1.6, 'exponential') };
    const stream = chain(gain(0.4), at.stream), swirl = chain(gain(0.3), at.swirl), pour = chain(gain(0.3), at.pour);
    chain(noise(0), filter('highpass', 500), filter('bandpass', 1900, 0.5), stream);   // the slide: a quick, bright run
    wander(stream.gain, 0.3, 0.0004);
    chain(noise(0, 0.6), filter('lowpass', 520, 0.8), filter('peaking', 240, 1.5), swirl);   // the whirl: a low churning
    wander(swirl.gain, 0.27, 0.00012);
    chain(noise(0), filter('bandpass', 1150, 0.8), pour);   // the tube's mouth: water tumbling out
    wander(pour.gain, 0.25, 0.0003);
    return at;
  }

  // ----- the ambience: waves washing in, gusts, birdsong, a far gull, crickets -----
  function wave(t) {
    const up = 1.6 + Math.random(), down = 3 + Math.random() * 1.5, peak = 0.35 + Math.random() * 0.3;
    sea.wash.gain.setTargetAtTime(peak, t, up / 3); sea.wash.gain.setTargetAtTime(0.03, t + up, down / 3);
    sea.lp.frequency.setTargetAtTime(1200 + Math.random() * 800, t, up / 3); sea.lp.frequency.setTargetAtTime(420, t + up, down / 3);
  }
  function gust(t, level) {
    wind.g.gain.setTargetAtTime(level * (0.04 + 0.08 * Math.random()), t, 0.8);
    wind.bp.frequency.setTargetAtTime(320 + 600 * Math.random(), t, 1.2);
  }
  /** A voice off in the trees or the sky: through its own filters (if any), panned, at its level, into the ambience and the room. */
  function far(level, pan, ...filters) {
    const lv = gain(level), head = chain(...filters, panned(pan), lv);
    lv.connect(bus.amb); lv.connect(birdSend);
    return head;
  }
  function birdsong(t, level) {
    const n = 2 + Math.floor(Math.random() * 5), f0 = 2600 + Math.random() * 2200, p = far(level, Math.random() * 1.6 - 0.8);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = gain(0), s = t + i * (0.09 + Math.random() * 0.07), d = 0.04 + Math.random() * 0.07, f = f0 * (0.85 + 0.35 * Math.random());
      o.frequency.setValueAtTime(f, s); o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.45 : 0.7), s + d);
      env(g, s, 0.006, 0.05, d); chain(o, g, p); o.start(s); o.stop(s + d + 0.05);
    }
  }
  function gull(t, level) {
    const p = far(level, Math.random() * 1.4 - 0.7, filter('bandpass', 1500, 1.4), filter('lowpass', 3200));
    for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) {
      const o = ctx.createOscillator(), g = gain(0), s = t + i * 0.42, f = 950 + Math.random() * 150;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.8, s); o.frequency.exponentialRampToValueAtTime(f * 1.35, s + 0.08); o.frequency.exponentialRampToValueAtTime(f * 0.7, s + 0.34);
      env(g, s, 0.03, 0.03, 0.3); chain(o, g, p); o.start(s); o.stop(s + 0.4);
    }
  }
  function chirp(c, t, level) {   // three quick pulses on its own note
    const o = ctx.createOscillator(), g = gain(0);
    o.frequency.value = c.f * (0.99 + 0.02 * Math.random());
    for (let k = 0; k < 3; k++) { const s = t + k * 0.045; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.12 * level, s + 0.008); g.gain.linearRampToValueAtTime(0, s + 0.026); }
    chain(o, g, panned(c.pan), bus.amb); o.start(t); o.stop(t + 0.16);
  }
  function ambience(t, eye, night) {
    const day = 1 - night, d = Math.hypot(eye[0], eye[2]);
    sea.g.gain.setTargetAtTime(0.25 + 0.5 * clamp((d - 4) / 14, 0, 1), t, 0.5);   // more of the sea the farther out the camera stands
    if (t > amb.wave) { wave(t); amb.wave = t + 5 + Math.random() * 4; }
    if (t > amb.gust) { gust(t, 0.6 + 0.4 * night); amb.gust = t + 2 + Math.random() * 3; }
    if (day > 0.1 && t > amb.bird) { birdsong(t + 0.05, day); amb.bird = t + 3 + Math.random() * 7; }
    if (day > 0.4 && t > amb.gull) { if (amb.gull) gull(t + 0.05, 0.05 * day); amb.gull = t + 22 + Math.random() * 30; }
    if (night > 0.1) for (const c of crickets) if (t > c.next) { chirp(c, t + 0.05, night); c.next = t + c.period * (0.85 + 0.3 * Math.random()); }
  }

  // ----- the music -----
  function string(semi) {   // a plucked nylon string: Karplus-Strong, made once a note
    if (!strings.has(semi)) {
      const sr = ctx.sampleRate, n = Math.max(2, Math.round(sr / hz(semi))), len = Math.floor(sr * 1.4);
      const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(n);
      for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
      for (let i = 0; i < n; i++) ring[i] = 0.5 * (ring[i] + ring[(i + 1) % n]);   // a soft pluck: the burst a little dulled
      for (let i = 0, j = 0; i < len; i++, j = (j + 1) % n) { d[i] = ring[j]; ring[j] = 0.497 * (ring[j] + ring[(j + 1) % n]); }
      strings.set(semi, { b, rate: (hz(semi) * (n + 0.5)) / sr });   // the loop's length rounds the pitch: played back at the true one
    }
    return strings.get(semi);
  }
  function pluck(t, semi, peak, dest) {
    const { b, rate } = string(semi), s = ctx.createBufferSource();
    s.buffer = b; s.playbackRate.value = rate; chain(s, gain(peak), dest); s.start(t); s.stop(t + 1.4);
  }
  function bar(t, semi, peak, dest, kalimba) {   // a struck bar or tine: the note and a fainter overtone that dies sooner
    const f = hz(semi), long = kalimba ? 1.6 : 0.8;
    for (const [mul, k, d] of [[1, 1, long], [kalimba ? 5.9 : 3.93, 0.22, long * 0.3]]) {
      const o = ctx.createOscillator(), g = gain(0); o.frequency.value = f * mul;
      env(g, t, 0.004, peak * k, d); chain(o, g, dest); o.start(t); o.stop(t + d + 0.05);
    }
  }
  function pad(t, chord, dur, dest) {
    const g = gain(0), lp = chain(filter('lowpass', 900, 0.4), g, dest);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
    for (const c of chord) for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(c); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur * 1.1); }
  }
  function music(t, hour) {
    if (mus.t < t) { mus.t = t + 0.1; mus.step = 0; }
    const dest = bus.music;
    while (mus.t < t + 0.3) {
      const i = mus.step % 32, at = mus.t;
      if (i === 0) mus.set = musicFor(hour);
      const m = MUSIC[mus.set], step = 60 / m.bpm / 2, chord = m.chords[i >> 3], j = i % 8, day = mus.set === 'day';
      if (j === 0 || (j === 4 && day)) { const o = ctx.createOscillator(), g = gain(0); o.frequency.value = hz(chord[0] - 12); env(g, at, 0.02, 0.2, step * (day ? 3.5 : 7)); chain(o, g, dest); o.start(at); o.stop(at + step * 8); }   // the bass
      if (m.pad && j === 0) pad(at, chord, step * 8, dest);
      if (m.strum && [0, 3, 4, 6].includes(j)) chord.forEach((c, k) => pluck(at + (j % 2 ? 3 - k : k) * 0.012, c, j % 4 === 0 ? 0.16 : 0.1, dest));   // down on the beat, up off it
      if (!m.strum && (mus.set === 'dusk' || j % 2 === 0)) bar(at, chord[(mus.set === 'dusk' ? j : j >> 1) % chord.length] + 12, 0.045, dest, m.lead === 'kalimba');   // the chord, broken
      const n = MELODY[mus.set][i];
      if (n !== null) bar(at, n, m.lead === 'kalimba' ? 0.09 : 0.1, dest, m.lead === 'kalimba');
      mus.t += step; mus.step++;
    }
  }

  // ----- the radio: its stations through a little speaker -----
  const speakerIn = () => speaker || (speaker = chain(filter('bandpass', 1300, 0.6), bus.radio));
  function note(t, type, f, peak, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; env(g, t, 0.008, peak, dur);
    chain(o, g, speakerIn()); o.start(t); o.stop(t + dur + 0.05);
  }
  function hat(t) {
    const s = noise(t, 1, false), g = ctx.createGain(); env(g, t, 0.002, 0.03, 0.04);
    chain(s, filter('highpass', 6000), g, speakerIn()); s.stop(t + 0.08);
  }
  function radio(t, station) {   // keep a quarter of a second of the station's tune scheduled ahead; a new station starts its first bar
    const st = STATIONS[station - 1], tn = TUNES[station - 1], step = 60 / st.bpm / 2;
    if (playing !== station) { playing = station; stepN = 0; nextT = t + 0.05; }
    if (nextT < t) nextT = t + 0.05;
    while (nextT < t + 0.25) {
      const i = stepN % 32, root = st.roots[Math.floor(i / 8)];
      if (i % st.bassEvery === 0) note(nextT, st.bass, hz(root - 12 + (i % 8 === 4 ? 7 : 0)), 0.16, step * st.bassEvery * 0.85);   // the bass: root, fifth
      if (tn[i] !== null) note(nextT, st.lead, hz(tn[i]), st.lead === 'sine' ? 0.14 : 0.09, step * 0.85);
      if (st.hat && i % 2 === 1) hat(nextT);
      nextT += step; stepN++;
    }
  }

  // ----- what happens in the water: a splash, a plop; a duck's squeak -----
  function drop(t, f, peak, dest) {   // a droplet: a little bubble ringing, its pitch rising
    const o = ctx.createOscillator(), g = gain(0);
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.7, t + 0.05);
    env(g, t, 0.002, peak, 0.06); chain(o, g, dest); o.start(t); o.stop(t + 0.1);
    return o;
  }
  function splash(t, x, z, speed) {
    const k = clamp(speed / 2, 0.12, 1), p = place([x, P.LL, z], bus.sfx);
    const body = noise(t, 1, false), bp = filter('bandpass', 2400, 0.7), g = gain(0);
    bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(650, t + 0.4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.6 * k, t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, 0.1 + 0.08 * k);   // a long hiss of spray, not a click
    chain(body, bp, g, p); body.stop(t + 1);
    const thump = noise(t, 0.5, false), tg = gain(0); env(tg, t, 0.004, 1.2 * k, 0.18); chain(thump, filter('lowpass', 280), tg, p); thump.stop(t + 0.4);
    for (let i = 0, n = 3 + Math.round(6 * k); i < n; i++) drop(t + 0.04 + Math.random() * 0.5, 900 + Math.random() * 2400, 0.12 * k, p);
    body.onended = () => p.disconnect();
  }
  function plop(t, x, z) {
    const p = place([x, P.LL, z], bus.sfx);
    drop(t, 380, 0.25, p);
    drop(t + 0.07, 1400 + Math.random() * 600, 0.05, p).onended = () => p.disconnect();
  }
  /** A rubber duck squeezed: air through its squeaker, a reedy note gliding up, a breath under it; let go, it squeaks back
   * lower (both on a tap, the squeeze alone when picked up). */
  function squeak(t, id, x, y, z, both) {
    const v = voiceOf(id), f = 1300 * v.pitch ** 0.6, p = place([x, y ?? P.LL, z], bus.sfx, 2.5, 1);
    const one = (s, f0, dur, peak) => {
      const o = ctx.createOscillator(), vib = ctx.createOscillator(), g = gain(0);
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 0.8, s); o.frequency.exponentialRampToValueAtTime(f0, s + 0.06); o.frequency.exponentialRampToValueAtTime(f0 * 0.92, s + dur);
      vib.frequency.value = 22 + 10 * Math.random(); chain(vib, gain(f0 * 0.018), o.frequency);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(peak, s + 0.015); g.gain.setValueAtTime(peak, s + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      chain(o, filter('bandpass', f0 * 2.1, 1.1), filter('lowpass', 5200), g, p);
      const air = noise(s, 1, false), ag = gain(0); env(ag, s, 0.01, peak * 0.25, dur * 0.8); chain(air, filter('bandpass', 3200, 1.5), ag, p);
      for (const n of [o, vib]) { n.start(s); n.stop(s + dur + 0.02); }
      air.stop(s + dur + 0.02);
      return o;
    };
    const dur = 0.2 * v.pace;
    const last = both ? (one(t, f, dur, 1.3), one(t + dur + 0.1, f * 0.86, dur * 0.7, 0.8)) : one(t, f, dur * 0.75, 1.15);
    last.onended = () => p.disconnect();
  }
  /** A firework out over the sea: the rocket's thin whistle climbing; its burst a deep thump, then crackling (heard a
   * moment after it is seen, the farther the later). */
  function launch(t, e) {
    const p = place([e.x, e.y, e.z], bus.sfx, 6, 1), o = ctx.createOscillator(), g = gain(0);
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(2300, t + 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 1.25);
    chain(o, g, p); o.start(t); o.stop(t + 1.3); o.onended = () => p.disconnect();
  }
  function boom(t, e, eye) {
    const s = t + Math.hypot(e.x - eye[0], e.y - eye[1], e.z - eye[2]) * 0.02, p = place([e.x, e.y, e.z], bus.sfx, 6, 1);
    const b = noise(s, 0.5, false), lp = filter('lowpass', 200, 0.8), g = gain(0);
    lp.frequency.setValueAtTime(220, s); lp.frequency.exponentialRampToValueAtTime(70, s + 0.8);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(1.4, s + 0.01); g.gain.setTargetAtTime(0, s + 0.01, 0.25);
    chain(b, lp, g, p); b.stop(s + 1.6);
    for (let i = 0; i < 24; i++) {   // the stars crackling as they burn
      const c = s + 0.3 + Math.random() * 1.1, n = noise(c, 1, false), cg = gain(0);
      env(cg, c, 0.001, 0.05 + 0.08 * Math.random(), 0.02); chain(n, filter('highpass', 2500), cg, p); n.stop(c + 0.05);
    }
    b.onended = () => p.disconnect();
  }
  function happen(t, list, eye) {
    for (const e of list) {
      if (e.type === 'launch') launch(t, e);
      else if (e.type === 'burst') boom(t, e, eye);
      else if (e.type === 'splash') { const s = e.speed ?? 1; if (s >= 0.25 && (t - lastSplash > 0.08 || s > 1)) { lastSplash = t; splash(t, e.x, e.z, s); } }
      else if (e.type === 'plop' || e.type === 'fishJump') plop(t, e.x, e.z);
      else if (e.type === 'fishSplash') splash(t, e.x, e.z, 0.6);
      else if (e.type === 'voice') squeak(t, e.id, e.x, e.y, e.z, true);
      else if (e.type === 'squeak') squeak(t, e.id, e.x, undefined, e.z, false);
    }
  }

  /** The listener at the camera's eye, facing what it looks at; the slide's stream from its point nearest the eye. */
  function listen(t, eye, at) {
    const L = ctx.listener, f = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], l = Math.hypot(...f) || 1;
    [L.positionX, L.positionY, L.positionZ].forEach((q, k) => q.setTargetAtTime(eye[k], t, 0.05));
    [L.forwardX, L.forwardY, L.forwardZ].forEach((q, k) => q.setTargetAtTime(f[k] / l, t, 0.05));
    L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    let best = SLIDE[0], bd = Infinity;
    for (const q of SLIDE) { const d = Math.hypot(q[0] - eye[0], q[1] - eye[1], q[2] - eye[2]); if (d < bd) { bd = d; best = q; } }
    [flows.stream.positionX, flows.stream.positionY, flows.stream.positionZ].forEach((q, k) => q.setTargetAtTime(best[k], t, 0.1));
  }

  return {
    get on() { return on; },
    set(v) {
      on = !!v;
      if (on) { ensure(); ctx?.resume?.().catch(() => {}); }   // (an offline context renders without resuming)
      if (out) out.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05);
      if (!on) { playing = 0; mus.t = 0; }
    },
    /** A frame: the world's events, the radio's station (0: off), the hour, and the listener (block-local eye and target). */
    frame(list, { station = 0, hour = 12, eye = [0, 12, 12], at = [0, 1.2, 0] } = {}) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      listen(t, eye, at);
      ambience(t, eye, daylight(hour).night);
      bus.music.gain.setTargetAtTime(station ? 0 : LEVEL.music, t, station ? 0.3 : 1.5);   // the radio takes over from the music
      if (station) { radio(t, station); mus.t = 0; } else { playing = 0; music(t, hour); }
      happen(t, list, eye);
    },
    close() {
      ctx?.close?.(); ctx = null; out = null; bus = null; room = null; white = null; birdSend = null; speaker = null; flows = null; sea = null; wind = null;
      strings.clear(); on = false; playing = 0; nextT = 0; stepN = 0; mus.t = 0; lastSplash = -1;
      for (const k of Object.keys(amb)) amb[k] = 0;
      for (const c of crickets) c.next = 0;
    },
  };
}
