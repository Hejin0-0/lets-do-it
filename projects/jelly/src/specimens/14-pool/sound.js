// Pool Jelly — sounds, synthesised with WebAudio (off until asked for; the first click starts the context):
// rubber-duck squeaks, plops and splashes, ducks knocking together, the hourglass turned over, the radio's tune,
// and under it all the slide's rush and the fountain's patter.

// the radio's tune: our own four bars, looping — a walk over a five-note scale (made once, from a fixed seed)
// above a bass on C, A, F and G, in eighth notes at 112 a minute
const STEP = 60 / 112 / 2, ROOTS = [0, -3, 5, 7], PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const TUNE = (() => {
  let r = 7, dg = 4;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 32 }, (_, i) => {
    if (i % 8 === 7 || rnd() < 0.2) return null;   // a breath at the end of each bar, and now and then
    dg = Math.max(0, Math.min(9, dg + [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)]));
    return PENTA[dg];
  });
})();
const hz = (semi) => 261.63 * Math.pow(2, semi / 12);

export function createSound() {
  let ctx = null, master = null, noise = null, rush = null, patter = null, on = false, squeakT = 0, knockT = 0;
  let speaker = null, nextT = 0, stepN = 0;
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
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, peak, dur, attack = 0.01, lp = 3000) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.type = 'lowpass'; f.frequency.value = lp;
    env(g, t, attack, peak, dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + attack + 0.05);
  }
  const play = {
    squeak(t) { const p = 0.85 + Math.random() * 0.3; tone(t, 'square', 900 * p, 1350 * p, 0.04, 0.09, 0.008, 2600); tone(t + 0.09, 'square', 1350 * p, 820 * p, 0.035, 0.12, 0.006, 2400); },
    splash(t, k) { burst(t, 1700, 300, 0.7, 0.04 + 0.22 * k, 0.25 + 0.3 * k); },
    falls(t) { burst(t, 1300, 240, 0.6, 0.14, 0.45); tone(t, 'sine', 380, 140, 0.05, 0.15, 0.004); },
    plop(t) { tone(t, 'sine', 520, 180, 0.06, 0.09, 0.003); },
    scoop(t) { tone(t, 'triangle', 160, 110, 0.07, 0.12, 0.003, 900); burst(t, 600, 300, 2, 0.04, 0.08); },
    knock(t, k) { tone(t, 'sine', 300, 200, 0.02 + 0.06 * k, 0.06, 0.003); },
    turn(t) { tone(t, 'triangle', 240, 170, 0.06, 0.1, 0.004, 1200); burst(t + 0.05, 5000, 2500, 1.5, 0.03, 0.9, 'highpass'); },   // a wooden clunk, the sand shifting
    radio(t) { tone(t, 'square', 1800, 900, 0.02, 0.05, 0.002, 2500); },   // the switch
  };
  /** A note through the radio's little speaker (a narrow band: no bass to speak of, no sparkle). */
  function note(t, type, f, peak, dur) {
    if (!speaker) { speaker = ctx.createBiquadFilter(); speaker.type = 'bandpass'; speaker.frequency.value = 1300; speaker.Q.value = 0.6; speaker.connect(master); }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; env(g, t, 0.008, peak, dur);
    o.connect(g); g.connect(speaker); o.start(t); o.stop(t + dur + 0.05);
  }
  function radio(t) {   // keep a quarter of a second of the tune scheduled ahead
    if (nextT < t) nextT = t + 0.05;
    while (nextT < t + 0.25) {
      const i = stepN % 32, root = ROOTS[Math.floor(i / 8)];
      if (i % 2 === 0) note(nextT, 'triangle', hz(root - 12 + (i % 8 === 4 ? 7 : 0)), 0.16, STEP * 1.7);   // the bass: root, fifth
      if (TUNE[i] !== null) note(nextT, 'square', hz(TUNE[i]), 0.03, STEP * 0.85);
      nextT += STEP; stepN++;
    }
  }
  return {
    get on() { return on; },
    set(v) { on = v; if (v) { ensure(); ctx && ctx.resume(); } else if (rush) { rush.g.gain.value = 0; patter.g.gain.value = 0; } },
    /** Play the world's events since last time; the slide and the fountain run on (quieter with the current down); the radio, while it is on. */
    frame(events, currentK, radioOn = false) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      if (radioOn) radio(t); else stepN = 0;
      let n = 0;
      for (const e of events) {
        if (n > 8) break;
        if (e.type === 'squeak') { if (t < squeakT) continue; squeakT = t + 0.15; play.squeak(t); }
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
