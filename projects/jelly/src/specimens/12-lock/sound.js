// Lock Jelly — sounds, synthesised with WebAudio (off until asked for; the first click starts the context):
// the boat's horn, a gate thudding shut, its creak as it swings, the windlass ratchet, the rush of water that
// swells with the flow through the paddles, quacks, splashes and the heron's croak.
export function createSound() {
  let ctx = null, master = null, noise = null, rush = null, on = false;
  function ensure() {
    if (ctx || !window.AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the rush: looping noise through a band, its gain set by the flow
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6; g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(master); src.start();
    rush = g;
  }
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function burst(t, f0, f1, q, peak, dur, type = 'bandpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, peak, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, peak, dur, attack = 0.01) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.type = 'lowpass'; f.frequency.value = 1400;
    env(g, t, attack, peak, dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + attack + 0.05);
  }
  const play = {
    horn(t) { for (const [f, d] of [[233, 0], [294, 0.02]]) tone(t + d, 'sawtooth', f, f * 0.98, 0.18, 0.75, 0.04); },
    thud(t) { tone(t, 'sine', 90, 42, 0.5, 0.35, 0.004); burst(t, 400, 120, 1.2, 0.25, 0.18, 'lowpass'); },
    creak(t) { for (let k = 0; k < 4; k++) burst(t + k * 0.13, 900 + Math.random() * 400, 500, 18, 0.05, 0.12); },
    ratchet(t) { burst(t, 3800, 2600, 6, 0.06, 0.025); },
    quack(t) { for (let k = 0; k < 2; k++) tone(t + k * 0.12, 'square', 520, 380, 0.05, 0.08, 0.005); },
    splash(t, k) { burst(t, 1800, 300, 0.8, 0.12 * k, 0.35); },
    heron(t) { tone(t, 'sawtooth', 180, 120, 0.08, 0.4, 0.02); burst(t, 1200, 700, 2, 0.05, 0.4); },
    stab(t) { burst(t, 2400, 800, 1.5, 0.05, 0.08); },
  };
  return {
    get on() { return on; },
    set(v) { on = v; if (v) { ensure(); ctx && ctx.resume(); } else if (rush) rush.gain.value = 0; },
    /** Play the world's events since last time, and set the rush to the flow (the chamber's level change per second). */
    frame(events, flow) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      let n = 0;
      for (const e of events) {
        if (n++ > 6) break;
        if (e.type === 'horn') play.horn(t);
        else if (e.type === 'thud') play.thud(t);
        else if (e.type === 'creak') play.creak(t);
        else if (e.type === 'ratchet') play.ratchet(t);
        else if (e.type === 'quack' && Math.random() < 0.5) play.quack(t);
        else if (e.type === 'splash') play.splash(t, Math.min(1, (e.speed || 1) / 3));
        else if (e.type === 'heron') play.heron(t);
        else if (e.type === 'stab') play.stab(t);
      }
      rush.gain.setTargetAtTime(Math.min(0.35, Math.abs(flow) * 14), t, 0.15);
    },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
}
