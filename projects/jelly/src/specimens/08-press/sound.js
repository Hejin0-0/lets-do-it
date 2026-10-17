// Jelly Press's sounds: all procedural (Web Audio), unlocked by the first interaction, closed when
// the press leaves the page.
export function createSound() {
  let ctx = null, master = null, motor = null, on = true, noise = null;
  function unlock() {
    if (ctx || !window.AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the hydraulic motor: a saw and a square through a low-pass, silent until it runs
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 1.2;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 48; o2.frequency.value = 96.6;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(master); o1.start(); o2.start();
    motor = { g, lp, o1, o2 };
  }
  const t = () => ctx.currentTime;
  function noiseBurst(dur, f0, f1, q, gain, type = 'bandpass') {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t()); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t() + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t()); g.gain.exponentialRampToValueAtTime(gain, t() + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t() + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t(), Math.random()); src.stop(t() + dur + 0.05);
  }
  function tone(type, f0, f1, dur, gain) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t()); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t() + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t()); g.gain.exponentialRampToValueAtTime(gain, t() + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t() + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(t() + dur + 0.05);
  }
  const timers = new Set();
  const later = (f, ms) => { const id = setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); };
  const S = {
    unlock,
    close() { for (const id of timers) clearTimeout(id); timers.clear(); if (ctx) ctx.close(); ctx = null; motor = null; },
    set(v) { on = v; if (master) master.gain.setTargetAtTime(v ? 0.8 : 0, t(), 0.05); },
    motor(level, pressure) {   // level 0..1 (running), pressure 0..1
      if (!motor) return;
      motor.g.gain.setTargetAtTime(level * (0.05 + 0.05 * pressure), t(), 0.06);
      motor.lp.frequency.setTargetAtTime(220 + 900 * pressure, t(), 0.1);
      motor.o1.frequency.setTargetAtTime(46 + 30 * pressure, t(), 0.1); motor.o2.frequency.setTargetAtTime(93 + 61 * pressure, t(), 0.1);
    },
    squelch(k = 1) { noiseBurst(0.18 + 0.12 * Math.random(), 1400 + 600 * Math.random(), 260, 2.5, 0.16 * k); tone('sine', 300 + 120 * Math.random(), 120, 0.16, 0.05 * k); },
    creak() {
      if (!ctx) return;
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 120 + 60 * Math.random(); lfo.frequency.value = 23 + 10 * Math.random(); lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 6; g.gain.setValueAtTime(0.0001, t()); g.gain.exponentialRampToValueAtTime(0.05, t() + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t() + 0.4);
      o.connect(f); f.connect(g); g.connect(master); o.start(); lfo.start(); o.stop(t() + 0.45); lfo.stop(t() + 0.45);
    },
    clunkLater(ms) { later(() => S.clunk(), ms); },
    clunk() { tone('sine', 90, 45, 0.22, 0.3); noiseBurst(0.06, 2400, 800, 1, 0.12, 'highpass'); },
    burst() { noiseBurst(0.7, 2600, 120, 0.7, 0.55, 'lowpass'); tone('sine', 70, 30, 0.5, 0.6); for (let k = 0; k < 4; k++) later(() => S.squelch(1.2), 40 + 70 * k); },
    plop(k) { tone('sine', 260 + 120 * Math.random(), 70, 0.14, 0.12 * k); noiseBurst(0.07, 900, 300, 2, 0.05 * k); },
  };
  return S;
}
