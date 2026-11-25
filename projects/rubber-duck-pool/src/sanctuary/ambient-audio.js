// 4-Channel Procedural Cozy Ambient Soundscape Mixer (Web Audio API)
// Uses deterministic Mulberry32 PRNG for noise buffers (zero Math.random / Date.now).

const DEFAULT_LEVELS = Object.freeze({
  water: 0.42,
  hearth: 0.34,
  rain: 0.22,
  radio: 0.0,
});

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoiseBuffer(ctx, seconds, seed, color = 'pink') {
  const len = Math.max(1024, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rand = mulberry32(seed);

  if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = rand() * 2 - 1;
      last = (last + 0.028 * white) / 1.028;
      data[i] = Math.max(-1, Math.min(1, last * 3.1));
    }
  } else if (color === 'crackle') {
    for (let i = 0; i < len; i++) {
      const r = rand();
      // Sparse crisp ember pops mixed with soft hiss
      data[i] = r > 0.9978 ? (rand() * 2 - 1) * 0.92 : (rand() * 2 - 1) * 0.015;
    }
  } else {
    // Paul Kellet pink-noise approximation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.055;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

const LOFI_CHORDS = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7
  [220.00, 261.63, 329.63, 392.00], // Am7
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [196.00, 246.94, 293.66, 349.23], // G7
];

export function createAmbientAudio(initialLevels = {}) {
  const levels = { ...DEFAULT_LEVELS, ...initialLevels };
  let muted = false;
  let ctx = null;
  let masterGain = null;
  let started = false;
  let radioTimer = null;
  let shishiTimer = null;
  let microClockTimer = null;
  let microTickParity = 0;
  let chordStep = 0;
  const foleyRand = mulberry32(7719);
  const gains = {};
  const nodesToStop = [];

  function clamp01(v) {
    return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  }

  function applyGains() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    masterGain.gain.setTargetAtTime(muted ? 0.0 : 0.72, now, 0.08);
    if (gains.water) gains.water.gain.setTargetAtTime(levels.water * 0.26, now, 0.12);
    if (gains.hearth) gains.hearth.gain.setTargetAtTime(levels.hearth * 0.34, now, 0.12);
    if (gains.rain) gains.rain.gain.setTargetAtTime(levels.rain * 0.20, now, 0.12);
    if (gains.radio) gains.radio.gain.setTargetAtTime(levels.radio * 0.24, now, 0.14);
  }

  function playLofiChord() {
    if (!ctx || ctx.state !== 'running' || !gains.radio || muted || levels.radio <= 0.01) return;
    const now = ctx.currentTime;
    const notes = LOFI_CHORDS[chordStep % LOFI_CHORDS.length];
    chordStep += 1;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * (idx === 0 ? 0.5 : 1.0), now + idx * 0.045);

      env.gain.setValueAtTime(0.0001, now + idx * 0.045);
      env.gain.linearRampToValueAtTime(0.11 / (idx + 1), now + idx * 0.045 + 0.18);
      env.gain.exponentialRampToValueAtTime(0.0008, now + 2.55);

      osc.connect(env);
      env.connect(gains.radio);
      osc.start(now + idx * 0.045);
      osc.stop(now + 2.65);
    });
  }

  function ensure() {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!ctx) {
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.0;
      masterGain.connect(ctx.destination);

      // 1. Thermal Water channel (bandpass pink noise + slow swell LFO)
      const waterSrc = ctx.createBufferSource();
      waterSrc.buffer = createNoiseBuffer(ctx, 4.0, 101, 'pink');
      waterSrc.loop = true;
      const waterBp = ctx.createBiquadFilter();
      waterBp.type = 'bandpass';
      waterBp.frequency.value = 620;
      waterBp.Q.value = 0.8;
      const waterLfo = ctx.createOscillator();
      const waterLfoGain = ctx.createGain();
      waterLfo.frequency.value = 0.18;
      waterLfoGain.gain.value = 180;
      waterLfo.connect(waterLfoGain);
      waterLfoGain.connect(waterBp.frequency);
      gains.water = ctx.createGain();
      waterSrc.connect(waterBp);
      waterBp.connect(gains.water);
      gains.water.connect(masterGain);
      waterSrc.start();
      waterLfo.start();
      nodesToStop.push(waterSrc, waterLfo);

      // 2. Hearth Crackle channel (brown warmth + high-passed crackle pops)
      gains.hearth = ctx.createGain();
      gains.hearth.connect(masterGain);

      const hearthWarm = ctx.createBufferSource();
      hearthWarm.buffer = createNoiseBuffer(ctx, 4.0, 202, 'brown');
      hearthWarm.loop = true;
      const warmLp = ctx.createBiquadFilter();
      warmLp.type = 'lowpass';
      warmLp.frequency.value = 210;
      const warmGain = ctx.createGain();
      warmGain.gain.value = 0.65;
      hearthWarm.connect(warmLp);
      warmLp.connect(warmGain);
      warmGain.connect(gains.hearth);
      hearthWarm.start();

      const crackleSrc = ctx.createBufferSource();
      crackleSrc.buffer = createNoiseBuffer(ctx, 3.5, 303, 'crackle');
      crackleSrc.loop = true;
      const crackleBp = ctx.createBiquadFilter();
      crackleBp.type = 'bandpass';
      crackleBp.frequency.value = 2400;
      crackleBp.Q.value = 1.4;
      const crackleGain = ctx.createGain();
      crackleGain.gain.value = 0.42;
      crackleSrc.connect(crackleBp);
      crackleBp.connect(crackleGain);
      crackleGain.connect(gains.hearth);
      crackleSrc.start();
      nodesToStop.push(hearthWarm, crackleSrc);

      // 3. Conservatory Rain channel (glass-roof filtered pink noise)
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = createNoiseBuffer(ctx, 4.0, 404, 'pink');
      rainSrc.loop = true;
      const rainHp = ctx.createBiquadFilter();
      rainHp.type = 'highpass';
      rainHp.frequency.value = 1150;
      const rainLp = ctx.createBiquadFilter();
      rainLp.type = 'lowpass';
      rainLp.frequency.value = 4400;
      gains.rain = ctx.createGain();
      rainSrc.connect(rainHp);
      rainHp.connect(rainLp);
      rainLp.connect(gains.rain);
      gains.rain.connect(masterGain);
      rainSrc.start();
      nodesToStop.push(rainSrc);

      // 4. Onsen Lo-Fi Radio channel (warm low-pass bus fed by periodic Rhodes chords)
      const radioLp = ctx.createBiquadFilter();
      radioLp.type = 'lowpass';
      radioLp.frequency.value = 1350;
      gains.radio = ctx.createGain();
      gains.radio.connect(radioLp);
      radioLp.connect(masterGain);

      radioTimer = window.setInterval(playLofiChord, 2600);
      // Periodic Japanese bamboo Shishi-odoshi water clapper (every ~24s while water channel active)
      shishiTimer = window.setInterval(() => {
        if (!muted && levels.water > 0.18 && ctx && ctx.state === 'running') {
          playCue('shishi');
        }
      }, 24000);

      // Barely-audible (-30 dB) 1968 Suanbo Observatory analog wall-clock tick & thermal pipe hum
      const humOsc = ctx.createOscillator();
      const humGain = ctx.createGain();
      humOsc.type = 'sine';
      humOsc.frequency.value = 59.4;
      humGain.gain.value = 0.0045;
      humOsc.connect(humGain);
      humGain.connect(masterGain);
      humOsc.start();
      nodesToStop.push(humOsc);

      const scheduleObsessiveClock = () => {
        if (!ctx) return;
        const delayMs = microTickParity % 2 === 0 ? 970 : 1030;
        microTickParity += 1;
        microClockTimer = window.setTimeout(() => {
          if (!muted && ctx && ctx.state === 'running') {
            const tNow = ctx.currentTime;
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(microTickParity % 2 === 0 ? 1820 : 1540, tNow);
            env.gain.setValueAtTime(0.0001, tNow);
            env.gain.linearRampToValueAtTime(0.0055, tNow + 0.002);
            env.gain.exponentialRampToValueAtTime(0.0001, tNow + 0.018);
            osc.connect(env);
            env.connect(masterGain);
            osc.start(tNow);
            osc.stop(tNow + 0.022);
          }
          scheduleObsessiveClock();
        }, delayMs);
      };
      scheduleObsessiveClock();
      started = true;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    applyGains();
    return true;
  }

  function setChannel(name, value) {
    if (!(name in levels)) return;
    levels[name] = clamp01(value);
    if (levels[name] > 0.01 && !started) {
      ensure();
    } else {
      applyGains();
    }
    if (name === 'radio' && levels.radio > 0.01) {
      playLofiChord();
    }
  }

  function toggleRadio() {
    const next = levels.radio > 0.01 ? 0.0 : 0.62;
    setChannel('radio', next);
    return next > 0.01;
  }

  function setMasterMuted(nextMuted) {
    muted = Boolean(nextMuted);
    applyGains();
  }

  function getState() {
    return {
      started,
      muted,
      radioOn: levels.radio > 0.01,
      channels: { ...levels },
    };
  }

  function dispose() {
    if (radioTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(radioTimer);
      radioTimer = null;
    }
    if (shishiTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(shishiTimer);
      shishiTimer = null;
    }
    if (microClockTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(microClockTimer);
      microClockTimer = null;
    }
    for (const n of nodesToStop) {
      try { n.stop(); } catch (_) {}
    }
    nodesToStop.length = 0;
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
    started = false;
  }

  function strumGuitarChord(freqs = [196.0, 246.94, 293.66, 392.0, 493.88]) {
    if (!ensure() || !ctx || !masterGain || muted) return false;
    const now = ctx.currentTime;
    const bus = ctx.createBiquadFilter();
    bus.type = 'lowpass';
    bus.frequency.setValueAtTime(1950, now);
    bus.frequency.exponentialRampToValueAtTime(520, now + 1.85);
    const busGain = ctx.createGain();
    busGain.gain.setValueAtTime(0.26, now);
    bus.connect(busGain);
    busGain.connect(masterGain);

    freqs.forEach((f, idx) => {
      const t0 = now + idx * 0.032;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = idx < 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, t0);
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(0.22 / (1 + idx * 0.25), t0 + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.9);
      osc.connect(env);
      env.connect(bus);
      osc.start(t0);
      osc.stop(t0 + 2.0);
    });
    return true;
  }

  function playCue(kind = 'chime') {
    if (!ensure() || !ctx || !masterGain || muted) return false;
    const now = ctx.currentTime;

    if (kind === 'splash' || kind === 'yuzu') {
      // Resonant pitch-rising water plop + filtered spray burst
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      const baseF = kind === 'yuzu' ? 320 : 250;
      osc.frequency.setValueAtTime(baseF, now);
      osc.frequency.exponentialRampToValueAtTime(baseF * 2.45, now + 0.09);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.11, now + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
      osc.connect(env);
      env.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.18);
      return true;
    }

    if (kind === 'shishi') {
      // Hollow Japanese bamboo clapper ("tok!") over stone basin
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const env = ctx.createGain();
      osc.type = 'triangle';
      const f = 415 + foleyRand() * 35;
      osc.frequency.setValueAtTime(f * 1.45, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.025);
      bp.type = 'bandpass';
      bp.frequency.value = f * 1.9;
      bp.Q.value = 5.5;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.12 * levels.water, now + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0006, now + 0.19);
      osc.connect(bp);
      bp.connect(env);
      env.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.22);
      return true;
    }

    if (kind === 'windchime') {
      // Delicate glass Fūrin pentatonic bell shimmer
      const bellFreqs = [1318.5, 1567.98, 1760.0, 2093.0];
      bellFreqs.slice(0, 2 + Math.floor(foleyRand() * 2)).forEach((freq, i) => {
        const t0 = now + i * 0.11;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.048, t0 + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.85);
        osc.connect(env);
        env.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + 0.9);
      });
      return true;
    }

    if (kind === 'stamp') {
      // Heavy rubber stamp slam onto wooden desk + crisp ink thump
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.075);
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.24, now + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
      osc.connect(env);
      env.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.16);
      return true;
    }

    if (kind === 'valve') {
      // Metallic brass valve mechanical click-clack detent
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(940, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.032);
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.065, now + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0006, now + 0.045);
      osc.connect(env);
      env.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.055);
      return true;
    }

    if (kind === 'squeeze') {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.09);
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.042, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0006, now + 0.11);
      osc.connect(env);
      env.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
      return true;
    }

    if (kind === 'waterjet') {
      // Pressurized cartoon beak water-jet squirt
      const src = ctx.createBufferSource();
      src.buffer = createNoiseBuffer(ctx, 0.36, 919, 'pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1950, now);
      bp.frequency.exponentialRampToValueAtTime(680, now + 0.32);
      bp.Q.value = 2.6;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.22, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0008, now + 0.34);
      src.connect(bp).connect(env).connect(masterGain);
      src.start(now);
      src.stop(now + 0.35);
      return true;
    }

    if (kind === 'scratch') {
      // Fountain-pen / fingernail scratching black redaction ink off archival paper
      const src = ctx.createBufferSource();
      src.buffer = createNoiseBuffer(ctx, 0.22, 517, 'crackle');
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.14, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0008, now + 0.20);
      src.connect(hp).connect(env).connect(masterGain);
      src.start(now);
      src.stop(now + 0.21);
      return true;
    }

    if (kind === 'burp') {
      // Barely-audible muffled rubber bubble sigh when staring at a duck too long
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.08);
      env.gain.setValueAtTime(0.0005, now);
      env.gain.linearRampToValueAtTime(0.018, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0004, now + 0.11);
      osc.connect(env);
      env.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
      return true;
    }

    if (kind === 'stare') {
      // Brief uncanny 38.4C observatory glass-bell dissonance
      [293.66, 415.30, 554.37].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.02);
        env.gain.setValueAtTime(0.0001, now + idx * 0.02);
        env.gain.linearRampToValueAtTime(0.045, now + idx * 0.02 + 0.04);
        env.gain.exponentialRampToValueAtTime(0.0005, now + 1.45);
        osc.connect(env);
        env.connect(masterGain);
        osc.start(now + idx * 0.02);
        osc.stop(now + 1.5);
      });
      return true;
    }

    const notes = kind === 'bite'
      ? [880, 1174.66]
      : kind === 'catch'
        ? [523.25, 659.25, 783.99, 1046.5]
        : kind === 'arrival'
          ? [659.25, 987.77, 1318.5]
          : kind === 'terminal'
            ? [440, 587.33]
            : [392.0];
    notes.forEach((freq, i) => {
      const t0 = now + i * 0.075;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = kind === 'terminal' ? 'square' : 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(kind === 'terminal' ? 0.045 : 0.10, t0 + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0008, t0 + (kind === 'terminal' ? 0.10 : 0.45));
      osc.connect(env);
      env.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    });
    return true;
  }

  return {
    ensure,
    setChannel,
    toggleRadio,
    setMasterMuted,
    strumGuitarChord,
    playCue,
    isMuted: () => muted,
    isRadioOn: () => levels.radio > 0.01,
    getState,
    dispose,
  };
}
