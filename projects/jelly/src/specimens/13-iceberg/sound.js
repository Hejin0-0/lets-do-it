// Iceberg Jelly — sounds, synthesised with WebAudio (off until asked for; the first click starts the context):
// the crack and rumble of calving, the snap of a pancake floe breaking, splashes, a capsizing groan, ice knocking on the hull, a deep two-reed ship's
// horn, penguin plops and brays, the orca's blow, and wind that rises with the snowfall.
export function createSound() {
  let ctx = null, master = null, noise = null, wind = null, windF = null, on = false, knockT = 0;
  function ensure() {
    if (ctx || !window.AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the wind: looping noise through a band, its gain and pitch set by the snowfall
    const src = ctx.createBufferSource();
    windF = ctx.createBiquadFilter(); wind = ctx.createGain();
    src.buffer = noise; src.loop = true; windF.type = 'bandpass'; windF.frequency.value = 380; windF.Q.value = 0.7; wind.gain.value = 0;
    src.connect(windF); windF.connect(wind); wind.connect(master); src.start();
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
    snap(t) { burst(t, 5200, 1400, 0.9, 0.22, 0.08, 'highpass'); burst(t + 0.03, 1800, 500, 1.2, 0.08, 0.25); },   // a pancake floe breaking: crisp, no rumble
    crack(t) { burst(t, 4200, 900, 0.8, 0.35, 0.12, 'highpass'); burst(t + 0.05, 260, 60, 0.7, 0.4, 1.8, 'lowpass'); tone(t + 0.05, 'sine', 55, 30, 0.3, 1.6, 0.05, 200); },
    splash(t, k) { burst(t, 1600, 260, 0.7, 0.05 + 0.3 * k, 0.3 + 0.4 * k); },
    groan(t) { tone(t, 'sawtooth', 72, 44, 0.12, 1.4, 0.25, 300); tone(t + 0.1, 'sawtooth', 58, 40, 0.08, 1.2, 0.25, 260); },
    knock(t, k) { tone(t, 'sine', 170, 90, 0.04 + 0.2 * k, 0.12, 0.003); burst(t, 900, 300, 2, 0.05 * k, 0.06); },
    horn(t) { for (const [f, d] of [[73, 0], [98, 0.03]]) tone(t + d, 'sawtooth', f, f * 0.99, 0.2, 1.8, 0.08, 600); },
    plop(t) { tone(t, 'sine', 420, 160, 0.06, 0.08, 0.003); },
    bray(t) { for (let k = 0; k < 4; k++) tone(t + k * 0.11, 'square', 380 - k * 20, 300, 0.025, 0.09, 0.005, 1800); },
    blow(t) { burst(t, 900, 400, 0.5, 0.12, 0.7); },
    gulp(t) { tone(t, 'sine', 260, 520, 0.05, 0.07, 0.003); },
  };
  return {
    get on() { return on; },
    set(v) { on = v; if (v) { ensure(); ctx && ctx.resume(); } else if (wind) wind.gain.value = 0; },
    /** Play the world's events since last time; the wind follows the snowfall (0..1). */
    frame(events, snow) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      let n = 0;
      for (const e of events) {
        if (n > 8) break;
        if (e.type === 'splash') play.splash(t, Math.min(1, (e.speed || 1) / 3));
        else if (e.type === 'knock') { if (t < knockT) continue; knockT = t + 0.08; play.knock(t, Math.min(1, e.speed / 0.4)); }   // the pack rattles, not roars
        else if (play[e.type]) play[e.type](t);
        else continue;
        n++;
      }
      wind.gain.setTargetAtTime(0.02 + 0.2 * snow, t, 0.6);
      windF.frequency.setTargetAtTime(300 + 450 * snow, t, 0.6);
    },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
}
