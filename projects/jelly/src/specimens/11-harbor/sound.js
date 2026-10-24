// Harbor Jelly — sounds, synthesised with WebAudio (off until asked for; the first click starts the context): the
// ship's horn (two low detuned sawtooth reeds a fifth apart, low-passed), the clank of the spreader's twistlocks,
// splashes and plops, gulls, and water lapping that rises with the waves.
export function createSound() {
  let ctx = null, master = null, noise = null, lap = null, lapF = null, on = false, clankT = 0, gullT = 0;
  function ensure() {
    if (ctx || !window.AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the lapping: looping noise through a low band, its gain set by the water's energy
    const src = ctx.createBufferSource();
    lapF = ctx.createBiquadFilter(); lap = ctx.createGain();
    src.buffer = noise; src.loop = true; lapF.type = 'lowpass'; lapF.frequency.value = 420; lapF.Q.value = 0.8; lap.gain.value = 0;
    src.connect(lapF); lapF.connect(lap); lap.connect(master); src.start();
  }
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function burst(t, f0, f1, q, peak, dur, type = 'bandpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, peak, dur, attack = 0.01, lp = 1400) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.type = 'lowpass'; f.frequency.value = lp;
    env(g, t, attack, peak, dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + attack + 0.05);
  }
  const play = {
    horn(t) { for (const [fq, d] of [[87, 0], [130.5, 0.02], [88.2, 0.01]]) tone(t + d, 'sawtooth', fq, fq * 0.995, 0.16, 2.2, 0.12, 520); },
    latch(t) { burst(t, 3200, 1800, 9, 0.08, 0.05); tone(t, 'triangle', 420, 260, 0.06, 0.09, 0.002, 2400); },
    splash(t, k) { burst(t, 1600, 260, 0.7, 0.05 + 0.3 * k, 0.3 + 0.4 * k); },
    knock(t, k) { tone(t, 'sine', 180, 100, 0.03 + 0.15 * k, 0.1, 0.003); },
    plop(t) { tone(t, 'sine', 460, 170, 0.05, 0.08, 0.003); },
    gulp(t) { tone(t, 'sine', 300, 560, 0.04, 0.06, 0.003); },
    gull(t) { for (let k = 0; k < 3; k++) { const s = t + k * 0.24; tone(s, 'sawtooth', 1500, 950, 0.035, 0.2, 0.02, 2600); tone(s, 'square', 1480, 940, 0.012, 0.2, 0.02, 1800); } },
  };
  return {
    get on() { return on; },
    set(v) { on = v; if (v) { ensure(); ctx && ctx.resume(); } else if (lap) lap.gain.value = 0; },
    /** Play the world's events since last time; the lapping follows the water's energy. */
    frame(events, energy) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      let n = 0;
      for (const e of events) {
        if (n > 8) break;
        if (e.type === 'splash') play.splash(t, Math.min(1, (e.speed || 1) / 3));
        else if (e.type === 'knock') play.knock(t, Math.min(1, e.speed / 0.4));
        else if (e.type === 'latch') { if (t < clankT) continue; clankT = t + 0.06; play.latch(t); }
        else if (e.type === 'horn') { play.horn(t); if (t > gullT) { gullT = t + 4; play.gull(t + 0.8); } }   // and the gulls go up
        else if (play[e.type]) play[e.type](t);
        else continue;
        n++;
      }
      lap.gain.setTargetAtTime(0.015 + Math.min(0.2, energy * 0.4), t, 0.4);
    },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
}
