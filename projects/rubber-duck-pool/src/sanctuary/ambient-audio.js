// The sanctuary's sound: the first map's recordings (src/pool/sound.js RECORDINGS, in its mix), each heard from where
// it happens, the listener at the camera. The onsen's water is the pool's lapping (the mixer's water channel); the sea
// round the island is the pool's sea and surf, fuller the farther out the camera stands; a splash, a yuzu dropped in, a
// duck's beak jet, the slide, the grotto splash off it and the siphon's outflow are the pool's water; a duck says its
// design's own voice. The made sounds (noise beds, hum, clock, shishi-odoshi, chimes and cues) are kept but silent
// (SFX), as on the first map. The radio's chords and the campfire guitar play when the player plays them.
import { RECORDINGS, MIX, TRIM, VOICE_REC, levelOf } from '../pool/sound.js';
import { DESIGNS } from '../pool/ducks.js';

const DEFAULT_LEVELS = Object.freeze({
  water: 0.42,
  hearth: 0.34,
  rain: 0.22,
  radio: 0.0,
});
/** The made sounds, silent while the recordings carry the sanctuary (the user found them out of place on both maps:
 * the first on 10-29, this one on 11-26): set a flag to hear one again. */
export const SFX = { water: false, hearth: false, rain: false, hum: false, clock: false, shishi: false, cues: false };
/** What a cue plays from the recordings, and its place in the mix; a cue not here is a made one (SFX.cues). */
const CUE_REC = {
  splash: { names: ['splash', 'splash2'], as: 'splash' },
  slide: { names: ['slide'], as: 'slide' },
  yuzu: { names: ['splash2'], as: 'plop' },
  waterjet: { names: ['tube'], as: 'tube' },
};
/** The circuit's events (physics.js step) the first map hears too: a duck carried onto the slide, landing in the grotto
 * off it, coming out of the siphon into the upper pool; y: the water's height there. */
const EVENT_REC = {
  slide: { name: 'slide', y: -0.145 },
  splash: { name: 'slideSplash', y: -2.22 },
  launch: { name: 'tube', y: -0.145 },
};
/** The upper pool's middle (physics.js UPPER_BOX), where its lapping comes from. */
const POOL_AT = { x: 2.0, y: -0.145, z: -1.65 };
/** As on the first map: the ambience's and the effects' levels, the output, at most VOICES effects at once and FORE of
 * them the player's own (newest win, taking a circuit sound's place if full); GAP: a circuit event of the same kind
 * sooner than this after the last is not heard again. */
const LEVEL = { amb: 0.5, sfx: 0.8 }, OUT = 0.6, VOICES = 6, FORE = 3, GAP = 0.12;
const DESIGN_AT = new Map(DESIGNS.map((d, i) => [d.id, i]));

/** How far a point is outside the island (negative inside): its two terraces as boxes, as the sea's shader draws the
 * shore (ocean-backdrop.js islandFootprintDist). */
function islandDist(x, z) {
  const box = (cx, cz, hx, hz) => {
    const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz, ox = Math.max(qx, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(qx, qz), 0);
  };
  return Math.min(box(-0.5, -2.8, 18.6, 10.6), box(0, 13.4, 15.2, 6.4));
}
/** The sea's level for a camera standing at (x, z): as on the first map, under a third of it well inside, all of it
 * once out over the water. */
export const seaLevel = (x, z) => 0.3 + 0.7 * Math.min(1, Math.max(0, (islandDist(x, z) + 8) / 14));

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

const defaultMake = () => {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AC ? new AC() : null;
};
const fetchDecode = (url, ctx) => fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b));
const hashOf = (id) => [...String(id ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);

/** levels: the mixer's starting channels; make: () -> an AudioContext or null; load: (url, ctx) -> a promise of the
 * decoded AudioBuffer. `ready` settles once the recordings are in (one that fails to load is left out). */
export function createAmbientAudio({ levels: initialLevels = {}, make = defaultMake, load = fetchDecode } = {}) {
  const levels = { ...DEFAULT_LEVELS, ...initialLevels };
  let muted = false;
  let hidden = false;
  let ctx = null;
  let masterGain = null;
  let bus = null;
  let sea = null;
  let started = false;
  let ready = Promise.resolve();
  let radioTimer = null;
  let shishiTimer = null;
  let microClockTimer = null;
  let microTickParity = 0;
  let chordStep = 0;
  const foleyRand = mulberry32(7719);
  const gains = {};
  const nodesToStop = [];
  const rec = new Map();   // a recording's name -> { buffer, level: its gain to the one loudness }
  const bg = [], fg = [];   // what plays: the circuit's, the player's
  const lastHeard = {};

  function clamp01(v) {
    return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  }

  function applyGains() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    masterGain.gain.setTargetAtTime(muted ? 0.0 : OUT, now, 0.08);
    if (gains.water) gains.water.gain.setTargetAtTime(levels.water / DEFAULT_LEVELS.water, now, 0.12);
    if (gains.hearth) gains.hearth.gain.setTargetAtTime(levels.hearth * 0.34, now, 0.12);
    if (gains.rain) gains.rain.gain.setTargetAtTime(levels.rain * 0.20, now, 0.12);
    if (gains.radio) gains.radio.gain.setTargetAtTime(levels.radio * 0.24, now, 0.14);
  }

  function gainTo(v, dest) {
    const g = ctx.createGain();
    g.gain.value = v;
    g.connect(dest);
    return g;
  }

  /** A point in the scene ({ x, y, z }) a sound comes from, as on the first map. */
  function place(p, dest, ref = 2.5, roll = 1) {
    const n = ctx.createPanner();
    n.panningModel = 'equalpower'; n.distanceModel = 'inverse'; n.refDistance = ref; n.rolloffFactor = roll;
    n.positionX.value = p.x; n.positionY.value = p.y; n.positionZ.value = p.z;
    n.connect(dest);
    return n;
  }

  const mixed = (name, as = name) => 10 ** (MIX[as] / 20) * rec.get(name).level;

  function loop(name, dest) {
    const r = rec.get(name), s = ctx.createBufferSource(), trim = Math.min(TRIM[name] ?? 0, r.buffer.duration / 4);
    s.buffer = r.buffer; s.loop = true; s.loopStart = trim; s.loopEnd = r.buffer.duration - trim;
    s.connect(gainTo(mixed(name), dest));
    s.start(ctx.currentTime, trim + foleyRand() * (r.buffer.duration - 2 * trim));
    nodesToStop.push(s);
  }

  function cut(v, t) {   // fade out fast before stopping, so making room never clicks
    v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.linearRampToValueAtTime(0, t + 0.02);
    try { v.s.stop(t + 0.025); } catch (_) {}
  }

  /** Nothing plays: muted, or paused after it ran (out of sight, or interrupted). A paused clock stands still, and all
   * that was scheduled on it would sound at once on waking, so it is dropped, as on the first map; one not yet run (its
   * clock at 0) keeps the waking touch's sound. */
  const quiet = () => muted || (ctx.state !== 'running' && ctx.currentTime > 0);

  /** A recording once, from `at` (or from everywhere), `as` its place in the mix. fore: the player's own doing, which is
   * always heard (VOICES, FORE); a circuit sound waits for room. */
  function play(name, at, as = name, fore = false) {
    if (!rec.has(name) || quiet()) return false;
    const t = ctx.currentTime;
    if (fore) {
      if (fg.length >= FORE) cut(fg.shift(), t);
      else if (bg.length + fg.length >= VOICES) cut(bg.shift(), t);
    } else if (bg.length + fg.length >= VOICES) return false;
    const dest = at ? place(at, bus.sfx) : bus.sfx;
    const s = ctx.createBufferSource(), g = gainTo(mixed(name, as), dest);
    const list = fore ? fg : bg, v = { s, g };
    s.buffer = rec.get(name).buffer;
    s.connect(g);
    s.start(t);
    list.push(v);
    s.onended = () => {
      const i = list.indexOf(v);
      if (i >= 0) list.splice(i, 1);
      if (at) dest.disconnect();
    };
    return true;
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
    if (!ctx) {
      ctx = make();
      if (!ctx) return false;
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -3; limit.knee.value = 3; limit.ratio.value = 12; limit.attack.value = 0.003; limit.release.value = 0.25;
      limit.connect(ctx.destination);
      masterGain = gainTo(0.0, limit);
      bus = { amb: gainTo(LEVEL.amb, masterGain), sfx: gainTo(LEVEL.sfx, masterGain) };

      // the recordings: each bed starts on its own as soon as it is decoded, so one stalled download never silences
      // the others
      gains.water = gainTo(1, bus.amb);
      sea = gainTo(0.4, bus.amb);
      const mine = ctx;
      ready = Promise.all(Object.entries(RECORDINGS).map(([k, url]) => load(url, mine).then((buffer) => {
        if (ctx !== mine) return;
        rec.set(k, { buffer, level: levelOf(k, buffer) });
        if (k === 'lapping') loop(k, place(POOL_AT, gains.water, 4, 0.8));
        else if (k === 'sea' || k === 'surf') loop(k, sea);
      }, () => {})));

      if (SFX.water) {
        // Thermal Water channel (bandpass pink noise + slow swell LFO)
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
        waterSrc.connect(waterBp);
        waterBp.connect(gainTo(0.22, gains.water));
        waterSrc.start();
        waterLfo.start();
        nodesToStop.push(waterSrc, waterLfo);
      }

      if (SFX.hearth) {
        // Hearth Crackle channel (brown warmth + high-passed crackle pops)
        gains.hearth = gainTo(0, masterGain);

        const hearthWarm = ctx.createBufferSource();
        hearthWarm.buffer = createNoiseBuffer(ctx, 4.0, 202, 'brown');
        hearthWarm.loop = true;
        const warmLp = ctx.createBiquadFilter();
        warmLp.type = 'lowpass';
        warmLp.frequency.value = 210;
        hearthWarm.connect(warmLp);
        warmLp.connect(gainTo(0.65, gains.hearth));
        hearthWarm.start();

        const crackleSrc = ctx.createBufferSource();
        crackleSrc.buffer = createNoiseBuffer(ctx, 3.5, 303, 'crackle');
        crackleSrc.loop = true;
        const crackleBp = ctx.createBiquadFilter();
        crackleBp.type = 'bandpass';
        crackleBp.frequency.value = 2400;
        crackleBp.Q.value = 1.4;
        crackleSrc.connect(crackleBp);
        crackleBp.connect(gainTo(0.42, gains.hearth));
        crackleSrc.start();
        nodesToStop.push(hearthWarm, crackleSrc);
      }

      if (SFX.rain) {
        // Conservatory Rain channel (glass-roof filtered pink noise)
        const rainSrc = ctx.createBufferSource();
        rainSrc.buffer = createNoiseBuffer(ctx, 4.0, 404, 'pink');
        rainSrc.loop = true;
        const rainHp = ctx.createBiquadFilter();
        rainHp.type = 'highpass';
        rainHp.frequency.value = 1150;
        const rainLp = ctx.createBiquadFilter();
        rainLp.type = 'lowpass';
        rainLp.frequency.value = 4400;
        gains.rain = gainTo(0, masterGain);
        rainSrc.connect(rainHp);
        rainHp.connect(rainLp);
        rainLp.connect(gains.rain);
        rainSrc.start();
        nodesToStop.push(rainSrc);
      }

      // Onsen Lo-Fi Radio channel (warm low-pass bus fed by periodic Rhodes chords)
      const radioLp = ctx.createBiquadFilter();
      radioLp.type = 'lowpass';
      radioLp.frequency.value = 1350;
      radioLp.connect(masterGain);
      gains.radio = gainTo(0, radioLp);
      radioTimer = globalThis.setInterval(playLofiChord, 2600);

      if (SFX.shishi) {
        // Periodic Japanese bamboo Shishi-odoshi water clapper (every ~24s while water channel active)
        shishiTimer = globalThis.setInterval(() => {
          if (!muted && levels.water > 0.18 && ctx && ctx.state === 'running') {
            playCue('shishi');
          }
        }, 24000);
      }

      if (SFX.hum) {
        // Barely-audible thermal pipe hum
        const humOsc = ctx.createOscillator();
        humOsc.type = 'sine';
        humOsc.frequency.value = 59.4;
        humOsc.connect(gainTo(0.0045, masterGain));
        humOsc.start();
        nodesToStop.push(humOsc);
      }

      if (SFX.clock) {
        // Barely-audible analog wall-clock tick
        const scheduleObsessiveClock = () => {
          if (!ctx) return;
          const delayMs = microTickParity % 2 === 0 ? 970 : 1030;
          microTickParity += 1;
          microClockTimer = globalThis.setTimeout(() => {
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
      }
      started = true;
    }

    // a gesture wakes a context the browser paused (suspended, or interrupted on a phone), as on the first map
    if (!hidden && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
      ctx.resume?.().catch(() => {});
    }
    applyGains();
    return true;
  }

  /** The page out of sight: the sound pauses, and plays on when it is back, as on the first map. */
  function setHidden(h) {
    hidden = Boolean(h);
    if (!ctx) return;
    if (hidden) ctx.suspend?.()?.catch?.(() => {});
    else ensure();
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

  /** The listener at the camera's eye ({ x, y, z }), facing along `forward`; the sea fuller the farther out it stands. */
  function listen(eye, forward) {
    if (!ctx || !sea) return;
    const t = ctx.currentTime, L = ctx.listener;
    L.positionX.setTargetAtTime(eye.x, t, 0.05); L.positionY.setTargetAtTime(eye.y, t, 0.05); L.positionZ.setTargetAtTime(eye.z, t, 0.05);
    L.forwardX.setTargetAtTime(forward.x, t, 0.05); L.forwardY.setTargetAtTime(forward.y, t, 0.05); L.forwardZ.setTargetAtTime(forward.z, t, 0.05);
    L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    sea.gain.setTargetAtTime(seaLevel(eye.x, eye.z), t, 0.5);
  }

  /** A circuit event from the physics, heard from where it happens; nothing before the sound has been started. */
  function hear(ev) {
    const r = EVENT_REC[ev.type];
    if (!r || !ctx || ctx.state !== 'running') return false;
    const t = ctx.currentTime;
    if (t - (lastHeard[ev.type] ?? -Infinity) < GAP) return false;
    lastHeard[ev.type] = t;
    return play(r.name, { x: ev.x, y: r.y, z: ev.z });
  }

  /** A duck's own voice from `at`, as on the first map: its design's recording, or for a duck of no design one picked by
   * its id. as: 'voice' when it is the duck the player touched, else 'squeak' (softer). */
  function duckVoice(designId, id, at, as = 'squeak') {
    if (!ctx) return false;
    const i = DESIGN_AT.get(designId);
    const name = (i !== undefined && VOICE_REC[DESIGNS[i].voice]) || `duck${(i ?? hashOf(id)) % 12}`;
    return play(name, at, as, true);
  }

  function dispose() {
    if (radioTimer !== null) {
      globalThis.clearInterval(radioTimer);
      radioTimer = null;
    }
    if (shishiTimer !== null) {
      globalThis.clearInterval(shishiTimer);
      shishiTimer = null;
    }
    if (microClockTimer !== null) {
      globalThis.clearTimeout(microClockTimer);
      microClockTimer = null;
    }
    for (const n of nodesToStop) {
      try { n.stop(); } catch (_) {}
    }
    nodesToStop.length = 0;
    if (ctx) {
      ctx.close?.()?.catch?.(() => {});
      ctx = null;
    }
    masterGain = null; bus = null; sea = null;
    for (const k of Object.keys(gains)) delete gains[k];
    rec.clear(); bg.length = 0; fg.length = 0; ready = Promise.resolve();
    for (const k of Object.keys(lastHeard)) delete lastHeard[k];
    started = false;
  }

  function strumGuitarChord(freqs = [196.0, 246.94, 293.66, 392.0, 493.88]) {
    if (!ctx || !masterGain || quiet()) return false;
    const now = ctx.currentTime;
    const guitarBus = ctx.createBiquadFilter();
    guitarBus.type = 'lowpass';
    guitarBus.frequency.setValueAtTime(1950, now);
    guitarBus.frequency.exponentialRampToValueAtTime(520, now + 1.85);
    const busGain = ctx.createGain();
    busGain.gain.setValueAtTime(0.26, now);
    guitarBus.connect(busGain);
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
      env.connect(guitarBus);
      osc.start(t0);
      osc.stop(t0 + 2.0);
    });
    return true;
  }

  /** A cue, from `at` ({ x, y, z }) when it has a place: a recording if it has one (CUE_REC), else a made sound. */
  function playCue(kind = 'chime', at = null) {
    if (!ctx || !masterGain || quiet()) return false;
    const r = CUE_REC[kind];
    if (r) return play(r.names[Math.floor(foleyRand() * r.names.length)], at, r.as, true);
    if (!SFX.cues) return false;
    const now = ctx.currentTime;

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

    if (kind === 'page') {
      // A book's page turning: a short swell of filtered noise
      const len = Math.floor(ctx.sampleRate * 0.16);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (foleyRand() * 2 - 1) * Math.sin((i / len) * Math.PI) * 0.18;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.frequency.exponentialRampToValueAtTime(640, now + 0.15);
      bp.Q.value = 1.4;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.28, now);
      env.gain.exponentialRampToValueAtTime(0.004, now + 0.16);
      src.connect(bp).connect(env).connect(masterGain);
      src.start(now);
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
      // Brief uncanny observatory glass-bell dissonance
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
    setHidden,
    strumGuitarChord,
    playCue,
    duckVoice,
    hear,
    listen,
    /** Settles once the recordings are loaded (after the first ensure()). */
    get ready() { return ready; },
    isMuted: () => muted,
    isRadioOn: () => levels.radio > 0.01,
    getState,
    dispose,
  };
}
