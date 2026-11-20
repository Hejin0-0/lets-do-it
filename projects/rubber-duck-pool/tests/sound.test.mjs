import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSound, musicFor, SFX, RECORDINGS, shouldResumeAudio, createAudioGate } from '../src/pool/sound.js';
import { P } from '../src/pool/layout.js';

// A stand-in AudioContext records starts and connections; decoded buffers carry their URL.
function fakeContext() {
  const started = [], made = [], buffers = [];
  const param = () => {
    let cur = 0, base = 0, ev = [];
    const add = (kind, v, t, tc = 0) => { cur = v; const back = ev.length && ev[ev.length - 1].t > t; ev.push({ kind, v, t, tc }); if (back) ev.sort((a, b) => a.t - b.t); };
    return {
      get value() { return cur; },
      set value(v) { cur = base = v; },
      setValueAtTime(v, t) { add('set', v, t); },
      linearRampToValueAtTime(v, t) { add('lin', v, t); },
      exponentialRampToValueAtTime(v, t) { add('exp', v, t); },
      setTargetAtTime(v, t, tc) { add('target', v, t, tc); },
      cancelScheduledValues(t) { ev = ev.filter((e) => e.t < t); },
      events: () => ev,
      at(t) {
        let v = base, t0 = 0;
        for (let i = 0; i < ev.length; i++) {
          const e = ev[i];
          if (e.t > t) {
            if (e.kind === 'lin') return v + (e.v - v) * ((t - t0) / (e.t - t0 || 1));
            if (e.kind === 'exp') return v * (e.v / (v || 1e-6)) ** ((t - t0) / (e.t - t0 || 1));
            break;
          }
          if (e.kind === 'target') {
            const end = i + 1 < ev.length ? Math.min(t, ev[i + 1].t) : t;
            v = e.v + (v - e.v) * Math.exp(-(end - e.t) / (e.tc || 1));
            t0 = end;
            if (end === t) break;
          } else { v = e.v; t0 = e.t; }
        }
        return v;
      },
    };
  };
  const node = (kind) => {
    const o = { kind, links: [], into: new Map(), started: false, stops: [],
      connect(n, _out = 0, inCh = 0) { this.links.push(n); if (n.kind === 'ChannelMerger') this.into.set(n, inCh); return n; },
      disconnect() { this.links.length = 0; this.into.clear(); },
      start(t = ctx.currentTime) { started.push(this.buffer?.url ?? kind); this.started = true; this.startTime = t; },
      stop(t = ctx.currentTime) { this.stopTime = t; this.stops.push(t); } };
    const n = new Proxy(o, { get(t, k) { if (!(k in t)) t[k] = param(); return t[k]; } });
    made.push(n); return n;
  };
  const buffer = (length, url) => ({ url, length, duration: length / 8000, sampleRate: 8000, numberOfChannels: 2, getChannelData: () => new Float32Array(length).fill(0.05) });
  const ctx = new Proxy({ state: 'running', currentTime: 1, sampleRate: 8000, destination: node('out'), listener: node('listener'), resume: async () => {}, close() {}, createBuffer: (c, length) => { const b = buffer(length); buffers.push(b); return b; } },
    { get(o, k) { if (k in o) return o[k]; if (String(k).startsWith('create')) return () => node(String(k).slice(6)); return undefined; } });
  return { ctx, started, made, buffers, load: async (url) => buffer(8000 * 4, url) };
}
const played = (started, from) => started.slice(from).filter((k) => k.startsWith('file:'));
function reaches(n, dest, seen = new Set()) {
  if (n === dest) return true;
  if (seen.has(n) || (n.kind === 'Gain' && n.gain.value <= 0)) return false;
  seen.add(n);
  return n.links.some((next) => reaches(next, dest, seen));
}
const BEDS = new Set(['lapping', 'sea', 'surf'].map((k) => RECORDINGS[k]));
function reachesAt(n, dest, t, seen = new Set()) {
  if (n === dest) return true;
  if (seen.has(n) || (n.kind === 'Gain' && n.gain.at(t) <= 0)) return false;
  seen.add(n);
  return n.links.some((next) => reachesAt(next, dest, t, seen));
}
async function on() {
  const f = fakeContext(), sound = createSound(() => f.ctx, f.load);
  sound.set(true); await sound.ready; sound.frame([]);
  return { ...f, sound };
}

test('every recording is a file in assets/04_audio', () => {
  for (const [k, url] of Object.entries(RECORDINGS)) assert.ok(existsSync(new URL(url)), `${k}: ${url}`);
  assert.equal(Object.keys(RECORDINGS).filter((k) => k.startsWith('duck')).length, 12, 'a voice for each of the twelve designs');
});

test('the made sounds are all silent: the recordings carry the scene', () => {
  for (const [k, v] of Object.entries(SFX)) assert.equal(v, false, `${k} is silent`);
});

test("once loaded, the pool's lapping and the sea's two recordings of waves loop", async () => {
  const { ctx, started, made, sound } = await on();
  for (const k of ['lapping', 'sea', 'surf']) {
    assert.ok(started.includes(RECORDINGS[k]), `${k} plays`);
    const s = made.find((n) => n.buffer?.url === RECORDINGS[k]);
    assert.equal(s.loop, true, `${k} loops`);
    assert.ok(s.loopStart >= 0 && s.loopStart < s.loopEnd && s.loopEnd <= s.buffer.duration);
    assert.ok(reaches(s, ctx.destination), `${k} reaches the speakers`);
  }
  sound.close();
});

test("a duck's voice still downloading does not keep the lapping and the sea from starting", async () => {
  const f = fakeContext(), slow = RECORDINGS[Object.keys(RECORDINGS).find((k) => k.startsWith('duck'))];
  const sound = createSound(() => f.ctx, (url, c) => (url === slow ? new Promise(() => {}) : f.load(url, c)));
  sound.set(true); for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  for (const k of ['lapping', 'sea', 'surf']) assert.ok(f.started.includes(RECORDINGS[k]), `${k} plays`);
  sound.close();
});

test("the first tap, while that duck's voice is still downloading, is said once it is in", async () => {
  const f = fakeContext(), k = Object.keys(RECORDINGS).find((k) => k.startsWith('duck')), slow = RECORDINGS[k];
  let arrive; const late = new Promise((r) => { arrive = r; });
  const sound = createSound(() => f.ctx, (url, c) => (url === slow ? late.then(() => f.load(url, c)) : f.load(url, c)));
  sound.set(true); for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); sound.frame([]);
  const n = f.started.length;
  sound.frame([{ type: 'voice', id: 7, colour: Number(k.slice(4)), x: 0, y: 1.2, z: 0 }]); assert.deepEqual(played(f.started, n), []);
  arrive(); await sound.ready; f.ctx.currentTime += 0.2; sound.frame([]);
  assert.deepEqual(played(f.started, n), [slow]);
  sound.close();
});

test("a tap whose voice comes in long after it, with no frame between, is not said late", async () => {
  const f = fakeContext(), k = Object.keys(RECORDINGS).find((k) => k.startsWith('duck')), slow = RECORDINGS[k];
  let arrive; const late = new Promise((r) => { arrive = r; });
  const sound = createSound(() => f.ctx, (url, c) => (url === slow ? late.then(() => f.load(url, c)) : f.load(url, c)));
  sound.set(true); for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); sound.frame([]);
  const n = f.started.length;
  sound.frame([{ type: 'voice', id: 7, colour: Number(k.slice(4)), x: 0, y: 1.2, z: 0 }]);
  arrive(); await sound.ready; f.ctx.currentTime += 5; sound.frame([]);
  assert.deepEqual(played(f.started, n), [], 'five seconds on, the tap is long over');
  sound.close();
});

test('the slide, the pump, the tube and a splash each play their recording; quiet things stay quiet', async () => {
  const { ctx, started, sound } = await on();
  const n = started.length;
  for (const type of ['arrive', 'knock', 'land', 'turn', 'radio', 'escaped', 'hop', 'leap', 'swanScoop', 'takeoff', 'fishJump', 'fishSplash']) sound.frame([{ type, id: 1, x: 0, z: 0, speed: 2 }]);
  sound.frame([{ type: 'whee', x: 0, z: 0 }]);   // a flying duck's take-off: not the slide
  sound.frame([{ type: 'splash', x: 0, z: 0, speed: 0.2 }]);   // a float settling
  assert.deepEqual(played(started, n), [], 'nothing heard');
  const heard = (e) => { ctx.currentTime += 1; const k = started.length; sound.frame([e]); return played(started, k); };
  assert.deepEqual(heard({ type: 'whee', slide: true, x: 0, z: 0 }), [RECORDINGS.slide]);
  assert.deepEqual(heard({ type: 'gurgle', x: 0, z: 0 }), [RECORDINGS.pump]);
  assert.deepEqual(heard({ type: 'pop', x: 0, z: 0 }), [RECORDINGS.tube]);
  assert.deepEqual(heard({ type: 'splash', slide: true, x: 0, z: 0, speed: 1.2 }), [RECORDINGS.slideSplash]);
  assert.ok([RECORDINGS.splash, RECORDINGS.splash2].includes(heard({ type: 'splash', x: 0, z: 0, speed: 1.5 })[0]));
  sound.close();
});

test("a tap, a pick-up and a hop are the duck's own design's voice; a pick-up once it is no tap", async () => {
  const { ctx, started, made, sound } = await on();
  for (const [type, colour] of [['voice', 3], ['squeak', 11], ['squeak', 0]]) {
    ctx.currentTime += 1; const k = started.length, g = made.length;
    sound.frame([{ type, id: colour + 20, colour, x: 0, y: 1.2, z: 0 }]);
    if (type === 'squeak') { assert.deepEqual(played(started, k), [], 'a pick-up waits: it may yet be a tap'); ctx.currentTime += 0.31; sound.frame([]); }
    assert.deepEqual(played(started, k), [RECORDINGS[`duck${colour}`]], `${type} of design ${colour}`);
    const s = made.slice(g).find((n) => n.buffer?.url === RECORDINGS[`duck${colour}`]);
    assert.ok(s?.started && reaches(s, ctx.destination), `${type} of design ${colour} reaches the speakers`);
  }
  sound.close();
});

test('a click on a duck (picked up as it is pressed, tapped as it is let go) says its voice once', async () => {
  const { ctx, started, sound } = await on();
  const k = started.length, duck = { id: 4, colour: 5, x: 0, y: 1.2, z: 0 };
  sound.frame([{ type: 'squeak', ...duck }]); ctx.currentTime += 0.15;
  sound.frame([{ type: 'voice', ...duck }]); ctx.currentTime += 1; sound.frame([]);
  assert.deepEqual(played(started, k), [RECORDINGS.duck5]);
  sound.close();
});

test('a pick-up waiting to be said when the sound goes off is not said when it comes back', async () => {
  const { ctx, started, sound } = await on();
  const k = started.length;
  sound.frame([{ type: 'squeak', id: 4, colour: 5, x: 0, y: 1.2, z: 0 }]); ctx.currentTime += 0.1;
  sound.set(false); ctx.currentTime += 30; sound.set(true); sound.frame([]);
  assert.deepEqual(played(started, k), []);
  sound.close();
});

test("a closed engine's late recordings never land in the next one", async () => {
  const a = fakeContext(), b = fakeContext(), contexts = [a.ctx, b.ctx], slow = [];
  const sound = createSound(() => contexts.shift(), (url, ctx) => new Promise((done) => slow.push(() => done(a.load(`${url}#${ctx === a.ctx ? 'old' : 'new'}`)))));
  sound.set(true); const first = slow.splice(0); sound.close();
  sound.set(true); for (const go of slow.splice(0)) go(); await sound.ready;
  for (const go of first) go(); await new Promise((r) => setTimeout(r, 0));
  const k = b.started.length; sound.frame([{ type: 'voice', colour: 1, x: 0, z: 0 }]);
  assert.deepEqual(b.started.slice(k).filter((u) => u.startsWith('file:')), [`${RECORDINGS.duck1}#new`], 'the new engine plays its own recording');
  sound.close();
});

test('a recording that fails to load is left out, and the rest still play', async () => {
  const f = fakeContext(), sound = createSound(() => f.ctx, (url, ctx) => (url === RECORDINGS.sea ? Promise.reject(new Error('404')) : f.load(url, ctx)));
  sound.set(true); await sound.ready; sound.frame([{ type: 'voice', colour: 2, x: 0, z: 0 }]);
  assert.ok(!f.started.includes(RECORDINGS.sea) && f.started.includes(RECORDINGS.lapping) && f.started.includes(RECORDINGS.duck2));
  sound.close();
});

test('the radio plays its station, the music stays off, and muting silences master output and brings it back', async () => {
  const { ctx, started, made, sound } = await on();
  const beds = made.filter((s) => BEDS.has(s.buffer?.url));
  assert.equal(beds.length, 3, 'all three ambience beds started');
  const master = made.find((g) => g.kind === 'Gain' && g.links.some((l) => l.links.includes(ctx.destination)));
  assert.ok(master, 'master gain feeds destination');
  ctx.currentTime += 0.5;
  assert.ok(master.gain.at(ctx.currentTime) > 0.5, 'master gain is up while running');
  assert.ok(beds.every((s) => reachesAt(s, ctx.destination, ctx.currentTime)), 'ambience reaches destination');

  const n = started.length; sound.frame([], { hour: 12 });
  assert.equal(started.length, n, 'no music');
  sound.frame([], { station: 1 });
  assert.ok(started.slice(n).includes('Oscillator'), 'the radio plays');

  const m = started.length, tOff = ctx.currentTime;
  sound.set(false);
  assert.ok(master.gain.at(tOff + 0.5) < 1e-4, 'master gain reaches silence within fade');
  ctx.currentTime += 5; sound.frame([{ type: 'voice', colour: 1, x: 0, z: 0 }], { station: 1 });
  assert.equal(started.length, m, 'muted: nothing more is scheduled');

  const tOn = ctx.currentTime;
  sound.set(true);
  assert.ok(master.gain.at(tOn + 0.5) > 0.5, 'turning sound back on restores master gain');
  assert.ok(beds.every((s) => reachesAt(s, ctx.destination, tOn + 0.5)), 'ambience reaches destination again');
  sound.close();
});

test('the music follows the hour: the day, the dusk, the night', () => {
  assert.equal(musicFor(11), 'day'); assert.equal(musicFor(18), 'dusk'); assert.equal(musicFor(23), 'night'); assert.equal(musicFor(2), 'night'); assert.equal(musicFor(8), 'day');
});

test('without an audio context it stays silent and does not fail', async () => {
  const sound = createSound(() => null);
  sound.set(true); await sound.ready; sound.frame([{ type: 'splash', x: 0, z: 0, speed: 2 }]); sound.close();
});

const active = (made, dest) => made.filter((n) => n.kind === 'BufferSource' && !BEDS.has(n.buffer?.url) && n.started && reaches(n, dest));

function assertCutFadedAndStopped(s, levelBefore, t0) {
  const g = s.links[0];
  assert.ok(g?.kind === 'Gain' && levelBefore > 0, 'evicted recording has a gain node with nonzero level');
  const ramp = g.gain.events().find((e) => e.kind === 'lin' && e.v === 0);
  assert.ok(ramp, 'evicted voice schedules a linear ramp to 0');
  assert.ok(Math.abs(ramp.t - (t0 + 0.02)) < 1e-6, `ramp ends FADE (20 ms) after eviction (got ${ramp.t - t0})`);
  assert.ok(Math.abs(g.gain.at(t0) - levelBefore) < 1e-6, 'fade starts from current level');
  assert.ok(g.gain.at(t0 + 0.01) > levelBefore * 0.4 && g.gain.at(t0 + 0.01) < levelBefore * 0.6, 'halfway through fade, level is midway');
  assert.equal(g.gain.at(t0 + 0.02), 0, 'ramp reaches 0 at FADE');
  assert.ok(s.stops.length > 0 && s.stopTime !== undefined, 'evicted recording source is stopped');
  assert.ok(s.stopTime >= ramp.t && s.stopTime <= ramp.t + 0.01, `evicted source stops at or just after ramp end (got ${s.stopTime - ramp.t})`);
}

test('with six background recordings playing, a tap voice starts', async () => {
  const { ctx, started, made, sound } = await on();
  const six = [{ type: 'whee', slide: true, x: 0, z: 0 }, { type: 'whee', slide: true, x: 0, z: 0 },
    { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 }, { type: 'pop', x: 0, z: 0 }];
  sound.frame(six);
  const bg = active(made, ctx.destination);
  assert.equal(bg.length, 6);
  const bg0Level = bg[0].links[0].gain.value, t0 = ctx.currentTime;
  const n = started.length;
  sound.frame([{ type: 'voice', id: 7, colour: 3, x: 0, y: 1.2, z: 0 }]);
  assert.deepEqual(played(started, n), [RECORDINGS.duck3]);
  const tap = made.findLast((s) => s.buffer?.url === RECORDINGS.duck3);
  assert.ok(tap?.started && reaches(tap, ctx.destination), 'the tap voice reaches the speakers');
  assertCutFadedAndStopped(bg[0], bg0Level, t0);
  assert.ok(!reaches(bg[0], ctx.destination) && bg.slice(1).every((s) => reaches(s, ctx.destination)), 'oldest background sound fades out');
  assert.equal(active(made, ctx.destination).length, 6, 'stays within the 6-voice cap');
  sound.close();
});

test('ten taps in a row never exceed the 6-voice cap and the last tap is heard', async () => {
  for (const bg of [false, true]) {
    const { ctx, started, made, sound } = await on();
    if (bg) sound.frame([{ type: 'whee', slide: true, x: 0, z: 0 }, { type: 'whee', slide: true, x: 0, z: 0 },
      { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 }, { type: 'pop', x: 0, z: 0 }]);
    let last = 0;
    const liveTaps = [];
    for (let i = 0; i < 10; i++) {
      ctx.currentTime += 0.05; last = started.length;
      const evicted = liveTaps.length >= 3 ? liveTaps.shift() : null;
      const evLevel = evicted?.links[0].gain.value, t0 = ctx.currentTime;
      sound.frame([{ type: 'voice', id: i, colour: i, x: 0, y: 1.2, z: 0 }]);
      if (evicted) assertCutFadedAndStopped(evicted, evLevel, t0);
      liveTaps.push(made.findLast((s) => s.buffer?.url === RECORDINGS[`duck${i}`]));
      assert.ok(active(made, ctx.destination).length <= 6, `after tap ${i}, active <= 6`);
    }
    assert.deepEqual(played(started, last), [RECORDINGS.duck9]);
    const playing = active(made, ctx.destination).map((s) => s.buffer.url);
    assert.deepEqual(playing.slice(-3), [RECORDINGS.duck7, RECORDINGS.duck8, RECORDINGS.duck9], 'newest tap voices win');
    assert.equal(playing.length, bg ? 6 : 3, 'bounded tap voices');
    sound.close();
  }
});

test('background sounds alone still stop at six and resume once one ends', async () => {
  const { ctx, started, made, sound } = await on();
  const n = started.length;
  const seven = [{ type: 'whee', slide: true, x: 0, z: 0 }, { type: 'whee', slide: true, x: 0, z: 0 },
    { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 },
    { type: 'pop', x: 0, z: 0 }, { type: 'plop', x: 0, z: 0 }];
  sound.frame(seven);
  assert.equal(played(started, n).length, 6, 'seventh background sound is dropped');
  const first = active(made, ctx.destination)[0];
  const panner = findPanner(first);
  assert.ok(panner && panner.links.length > 0, 'playing recording connects through a placed panner node');
  first.onended();
  assert.equal(panner.links.length, 0, 'ended recording disconnects its placed node');
  assert.ok(!reaches(first, ctx.destination), 'ended recording no longer reaches destination');
  ctx.currentTime += 0.2;
  sound.frame([{ type: 'plop', x: 0, z: 0 }]);
  assert.equal(played(started, n).length, 7, 'opens a slot once a background sound ends');
  sound.close();
});

const radioSources = (made, from = 0) => made.slice(from).filter((n) => n.kind === 'Oscillator' || (n.kind === 'BufferSource' && !n.buffer?.url));
const audibleAt = (s, dest, t) => s.started && s.startTime <= t && (s.stopTime === undefined || (s.startTime < s.stopTime && t < s.stopTime)) && reachesAt(s, dest, t);

test('changing the radio station fades out and stops the old station so nothing of it is audible 100 ms later', async () => {
  const { ctx, made, sound } = await on();
  const a0 = made.length;
  sound.frame([], { station: 2 });
  ctx.currentTime = 1.08; sound.frame([], { station: 2 });
  const lowTide = radioSources(made, a0);
  assert.ok(lowTide.some((s) => audibleAt(s, ctx.destination, 1.08)), 'Low Tide is audible before switching');
  ctx.currentTime = 1.10;
  const b0 = made.length;
  sound.frame([], { station: 3 });
  const surfHour = radioSources(made, b0);
  assert.ok(lowTide.every((s) => !audibleAt(s, ctx.destination, 1.20) && !audibleAt(s, ctx.destination, 1.35)), 'no Low Tide note is audible 100 ms after switching');
  assert.ok(lowTide.some((s) => s.stopTime > 1.10 && s.stopTime <= 1.15 && s.links[0]?.gain.events().some((e) => e.kind === 'lin' && e.v === 0 && e.t > 1.10)), 'sounding note fades out quickly instead of cutting abruptly');
  assert.ok(surfHour.some((s) => audibleAt(s, ctx.destination, 1.20)), 'the new station starts clean and is audible');

  ctx.currentTime = 1.25; sound.frame([], { station: 3 });
  const surfAll = radioSources(made, b0);
  ctx.currentTime = 1.26;
  const c0 = made.length;
  sound.frame([], { station: 1 });
  const lido = radioSources(made, c0);
  assert.ok(surfAll.every((s) => !audibleAt(s, ctx.destination, 1.36) && !audibleAt(s, ctx.destination, 1.50)), 'neither sounding nor ahead-scheduled Surf Hour notes (including hi-hats) remain audible');
  assert.ok(lido.some((s) => audibleAt(s, ctx.destination, 1.36)), 'Lido FM is audible after switching');
  sound.close();
});

test('switching the radio off or resetting for a new visit leaves no radio source audible 100 ms later', async () => {
  const { ctx, made, sound } = await on();
  const a0 = made.length;
  sound.frame([], { station: 2 });
  ctx.currentTime = 1.10;
  const lowTide = radioSources(made, a0);
  assert.ok(lowTide.some((s) => audibleAt(s, ctx.destination, 1.10)), 'Low Tide is sounding before Off');
  sound.frame([], { station: 0 });
  assert.ok(lowTide.every((s) => !audibleAt(s, ctx.destination, 1.20) && !audibleAt(s, ctx.destination, 1.40)), 'after Off (or Go home), no radio source is audible 100 ms later');

  ctx.currentTime = 2.00;
  const b0 = made.length;
  sound.frame([], { station: 3 });
  ctx.currentTime = 2.10; sound.frame([], { station: 3 });
  const surf = radioSources(made, b0);
  sound.set(false);
  ctx.currentTime = 2.15; sound.set(true); sound.frame([], { station: 0 });
  assert.ok(surf.every((s) => !audibleAt(s, ctx.destination, 2.20) && !audibleAt(s, ctx.destination, 2.40)), 'muting also retires scheduled radio notes');
  sound.close();
});

test('after an hour of simulated radio the list of live sources stays small', async () => {
  const { ctx, made, sound } = await on();
  const r0 = made.length;
  for (let i = 0; i < 36000; i++) {
    ctx.currentTime += 0.1;
    sound.frame([], { station: 3 });
  }
  const hourSources = radioSources(made, r0);
  assert.ok(hourSources.length > 10000, `simulated an hour of radio (${hourSources.length} sources created)`);
  const liveBeforeOff = hourSources.filter((s) => reaches(s, ctx.destination));
  assert.ok(liveBeforeOff.length <= 20, `live connected sources stay bounded during the hour (${liveBeforeOff.length})`);

  ctx.currentTime += 0.1;
  sound.frame([], { station: 0 });
  const retiredOnOff = hourSources.filter((s) => s.stops.length > 1);
  assert.ok(retiredOnOff.length > 0 && retiredOnOff.length <= 20, `switching off retires only the bounded live window (${retiredOnOff.length})`);

  ctx.currentTime += 1;
  const k0 = made.length;
  sound.frame([], { station: 2 });
  const fresh = radioSources(made, k0);
  assert.ok(fresh.length > 0);
  for (const s of fresh) s.onended?.();
  ctx.currentTime += 0.01;
  sound.frame([], { station: 0 });
  assert.ok(fresh.every((s) => s.stops.length === 1 && !reaches(s, ctx.destination)), 'onended drops finished sources from the live list');
  sound.close();
});

test('if one ambience bed download stalls, the other two start as soon as each arrives', async () => {
  const f = fakeContext();
  let finishSea;
  const seaPending = new Promise((r) => { finishSea = r; });
  const sound = createSound(() => f.ctx, (url, c) => (url === RECORDINGS.sea ? seaPending.then(() => f.load(url, c)) : f.load(url, c)));
  sound.set(true);
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  for (const k of ['lapping', 'surf']) {
    assert.ok(f.started.includes(RECORDINGS[k]), `${k} starts before sea arrives`);
    const s = f.made.find((n) => n.buffer?.url === RECORDINGS[k]);
    assert.ok(reaches(s, f.ctx.destination), `${k} reaches speakers while sea is pending`);
  }
  assert.ok(!f.started.includes(RECORDINGS.sea), 'sea has not started yet');
  finishSea();
  await sound.ready;
  assert.ok(f.started.includes(RECORDINGS.sea), 'sea starts once it arrives');
  assert.ok(reaches(f.made.find((n) => n.buffer?.url === RECORDINGS.sea), f.ctx.destination), 'sea reaches speakers');
  sound.close();
});

test('a suspended context with sound on is resumed by the next gesture, and stays suspended when sound is off or hidden', async () => {
  const f = fakeContext();
  let resumes = 0;
  f.ctx.state = 'suspended';
  f.ctx.resume = async () => { resumes++; f.ctx.state = 'running'; };
  const sound = createSound(() => f.ctx, f.load);
  sound.set(true); await sound.ready;
  assert.equal(resumes, 1, 'first wake resumes');

  sound.resume();
  assert.equal(resumes, 1, 'running context does not resume again');

  f.ctx.state = 'suspended';
  assert.equal(shouldResumeAudio({ woken: true, soundWanted: true, hidden: false, home: null }), true);
  assert.equal(shouldResumeAudio({ woken: false, soundWanted: true, hidden: false, home: null }), false);
  assert.equal(shouldResumeAudio({ woken: true, soundWanted: false, hidden: false, home: null }), false);
  assert.equal(shouldResumeAudio({ woken: true, soundWanted: true, hidden: true, home: null }), false);
  assert.equal(shouldResumeAudio({ woken: true, soundWanted: true, hidden: false, home: { elapsed: 0 } }), true);

  if (shouldResumeAudio({ woken: true, soundWanted: true, hidden: false, home: null })) sound.resume();
  assert.equal(resumes, 2, 'later gesture resumes suspended context when sound is on and visible');

  f.ctx.state = 'interrupted';
  sound.resume();
  assert.equal(resumes, 3, 'resumes interrupted state when sound is on');

  f.ctx.state = 'suspended';
  sound.set(false);
  sound.resume();
  assert.equal(resumes, 3, 'sound off (or hidden tab) leaves context suspended');
  sound.close();
});

// fakeContext does not render audio through PannerNode or ChannelMerger, so evaluate per-channel [L, R] gains along the graph.
function pannerChannelGainsAt(p, L, t) {
  const vx = p.positionX.at(t) - L.positionX.at(t), vy = p.positionY.at(t) - L.positionY.at(t), vz = p.positionZ.at(t) - L.positionZ.at(t);
  const d = Math.hypot(vx, vy, vz);
  const ref = p.refDistance, roll = p.rolloffFactor, m = p.distanceModel;
  let dist = ref / (ref + roll * (Math.max(d, ref) - ref));
  if (m === 'exponential') dist = (Math.max(d, ref) / ref) ** -roll;
  else if (m === 'linear') dist = 1 - roll * (Math.min(p.maxDistance, Math.max(d, ref)) - ref) / ((p.maxDistance - ref) || 1);
  if (p.panningModel !== 'equalpower') return [dist, dist];
  const fx = L.forwardX.at(t), fy = L.forwardY.at(t), fz = L.forwardZ.at(t);
  const ux = L.upX.value || 0, uy = L.upY.value || 1, uz = L.upZ.value || 0;
  const rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
  const fl = Math.hypot(fx, fy, fz) || 1, rl = Math.hypot(rx, ry, rz) || 1;
  let az = Math.atan2((vx * rx + vy * ry + vz * rz) / rl, (vx * fx + vy * fy + vz * fz) / fl);
  if (az > Math.PI / 2) az = Math.PI - az;
  else if (az < -Math.PI / 2) az = -Math.PI - az;
  const angle = ((az / (Math.PI / 2)) + 1) * (Math.PI / 4);
  return [dist * Math.cos(angle), dist * Math.sin(angle)];
}
function channelGainsAt(n, dest, ctx, t, seen = new Set()) {
  if (n === dest) return [1, 1];
  if (seen.has(n)) return [0, 0];
  seen.add(n);
  let k = [1, 1];
  if (n.kind === 'Gain') { const g = n.gain.at(t); k = [g, g]; }
  else if (n.kind === 'Panner') k = pannerChannelGainsAt(n, ctx.listener, t);
  if (k[0] <= 0 && k[1] <= 0) return [0, 0];
  let sum = [0, 0];
  for (const next of n.links) {
    const sub = channelGainsAt(next, dest, ctx, t, new Set(seen));
    if (next.kind === 'ChannelMerger') {
      const ch = n.into.get(next) ?? 0;
      sum[ch] += sub[ch];
    } else {
      sum[0] = Math.max(sum[0], sub[0]);
      sum[1] = Math.max(sum[1], sub[1]);
    }
  }
  return [k[0] * sum[0], k[1] * sum[1]];
}
const pathGainAt = (n, dest, ctx, t) => Math.max(...channelGainsAt(n, dest, ctx, t));
function findPanner(n, seen = new Set()) {
  if (!n || seen.has(n)) return null;
  if (n.kind === 'Panner') return n;
  seen.add(n);
  for (const next of n.links) { const found = findPanner(next, seen); if (found) return found; }
  return null;
}

test('radio volume falls smoothly with distance, stays under pre-h12 side on, and uses one speaker stage', async () => {
  const { ctx, made, sound } = await on();
  const mergersBefore = made.filter((n) => n.kind === 'ChannelMerger').length;
  const pannersBefore = made.filter((n) => n.kind === 'Panner').length;
  const radioPos = [P.RADIO[0], P.TER, P.RADIO[1]];
  // Opening view from index.js CAM0 at fitDist (~21.056 at 1600x900), plus both chair eyes from layout.js.
  const ce = Math.cos(0.65), farView = [0.8 + 21.056 * ce * Math.sin(0.40), 1.05 + 21.056 * Math.sin(0.65), 1.1 + 21.056 * ce * Math.cos(0.40)];
  const poolChair = P.SEATS[0].eye, seaChair = P.SEATS[1].eye;
  const atPoint = (eye, at = radioPos) => {
    sound.frame([], { station: 1, eye, at });
    ctx.currentTime += 1;
    sound.frame([], { station: 1, eye, at });
    return ctx.currentTime;
  };

  const tNear = atPoint(radioPos, [radioPos[0] - 1, radioPos[1], radioPos[2]]);
  const speaker = radioSources(made).findLast((s) => s.kind === 'Oscillator')?.links[0]?.links[0];
  assert.ok(speaker, 'radio notes feed a speaker node');

  // Level before h12 was bus.radio (4) * master out (0.6) = 2.4 in each channel.
  const levelNear = pathGainAt(speaker, ctx.destination, ctx, tNear);
  assert.ok(Math.abs(20 * Math.log10(levelNear / 2.4)) <= 1, `beside the radio, level (${levelNear.toFixed(3)}) is within 1 dB of 2.4`);

  // Side on beside the radio (as in pool-sound radioCrowd): loudest channel is within 1 dB of 2.4 and never louder than 2.4.
  const tRight = atPoint([radioPos[0] - 0.5, radioPos[1] + 0.2, radioPos[2]], [radioPos[0] - 0.5, radioPos[1] + 0.2, radioPos[2] - 1]);
  const chRight = channelGainsAt(speaker, ctx.destination, ctx, tRight);
  const loudestRight = Math.max(...chRight);
  assert.ok(loudestRight <= 2.4 + 1e-6, `side on right beside the radio, loudest channel (${loudestRight.toFixed(3)}) is no louder than pre-h12 (2.4)`);
  assert.ok(Math.abs(20 * Math.log10(loudestRight / 2.4)) <= 1, `side on right, loudest channel (${loudestRight.toFixed(3)}) is within 1 dB of 2.4`);
  assert.ok(chRight[0] < 0.8 * chRight[1], `radio to the right pans right, the far ear at least 2 dB down (${chRight[0].toFixed(3)} < ${chRight[1].toFixed(3)})`);

  const tLeft = atPoint([radioPos[0] - 0.5, radioPos[1] + 0.2, radioPos[2]], [radioPos[0] - 0.5, radioPos[1] + 0.2, radioPos[2] + 1]);
  const chLeft = channelGainsAt(speaker, ctx.destination, ctx, tLeft);
  const loudestLeft = Math.max(...chLeft);
  assert.ok(loudestLeft <= 2.4 + 1e-6, `side on left beside the radio, loudest channel (${loudestLeft.toFixed(3)}) is no louder than pre-h12 (2.4)`);
  assert.ok(chLeft[1] < 0.8 * chLeft[0], `radio to the left pans left, the far ear at least 2 dB down (${chLeft[0].toFixed(3)} > ${chLeft[1].toFixed(3)})`);

  const levelChair = pathGainAt(speaker, ctx.destination, ctx, atPoint(poolChair));
  assert.ok(Math.abs(20 * Math.log10(levelChair / 2.4)) <= 1, `in the nearest chair, level (${levelChair.toFixed(3)}) is within 1 dB of 2.4`);

  const levelSea = pathGainAt(speaker, ctx.destination, ctx, atPoint(seaChair));
  const levelFar = pathGainAt(speaker, ctx.destination, ctx, atPoint(farView));
  assert.ok(levelFar > 0, 'radio is still clearly heard from the opening far view');
  const dropDb = 20 * Math.log10(levelNear / levelFar);
  assert.ok(dropDb >= 6 && dropDb <= 10, `opening far view is 6 to 10 dB quieter than beside the radio (measured ${dropDb.toFixed(2)} dB)`);

  const levels = [levelNear, levelChair, levelSea, levelFar];
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] < levels[i - 1], `level falls as distance grows (step ${i}: ${levels[i - 1].toFixed(4)} -> ${levels[i].toFixed(4)})`);
  }

  // Listener orientation tracks look direction and station changes / off-on reuse the single speaker stage.
  const tLook = atPoint([radioPos[0], radioPos[1], radioPos[2] + 2], radioPos);
  assert.ok(ctx.listener.forwardZ.at(tLook) < -0.9, 'listener forward vector follows look target');
  sound.frame([], { station: 2, eye: radioPos });
  ctx.currentTime += 0.2;
  sound.frame([], { station: 0, eye: radioPos });
  ctx.currentTime += 0.2;
  sound.frame([], { station: 3, eye: radioPos });
  assert.equal(made.filter((n) => n.kind === 'ChannelMerger').length, mergersBefore + 1, 'one stereo balance stage for the radio');
  assert.equal(made.filter((n) => n.kind === 'Panner').length, pannersBefore, 'no extra panner nodes per note or station');
  sound.close();
});

async function mountPoolIndex() {
  const { register } = await import('node:module');
  if (!globalThis.__poolSoundIndexHook) {
    const loader = `import { readFileSync } from 'node:fs';
    export async function load(url, ctx, next) {
      const base = url.split('?')[0];
      if (base.endsWith('/packages/diorama/view.js')) {
        const src = readFileSync(new URL(base), 'utf8').replace('export function createDioramaView(', 'export function _origCreateDioramaView(');
        return { format: 'module', shortCircuit: true, source: src + '\\nexport function createDioramaView() { return { cam: { az: 0.4, el: 0.65, dist: 10, target: [0.8, 1.05, 1.1] }, fitDist: 20, frame: () => new Float32Array(16), start() {}, cancel() {}, resetView() {}, lookFrom() {}, toPx: () => [0, 0], rayAt: () => ({ o: [0, 0, 0], d: [0, 0, -1] }) }; }' };
      }
      if (base.endsWith('/src/pool/ocean-gpu.js')) return { format: 'module', shortCircuit: true, source: 'export async function createOcean() { return { update() {} }; }' };
      if (base.endsWith('/src/pool/duck-assets.js')) return { format: 'module', shortCircuit: true, source: 'export async function loadDuckAssets() { return {}; }' };
      if (base.endsWith('/src/pool/props.js')) {
        const src = readFileSync(new URL(base), 'utf8').replace('export async function loadProps(', 'export async function _origLoadProps(');
        return { format: 'module', shortCircuit: true, source: src + '\\nexport async function loadProps() { return {}; }' };
      }
      if (base.endsWith('/src/pool/renderer.js')) {
        const src = readFileSync(new URL(base), 'utf8').replace('export function createRenderer(', 'export function _origCreateRenderer(');
        return { format: 'module', shortCircuit: true, source: src + '\\nexport function createRenderer() { return { size: [800, 600], post: { quality: "high", setQuality() {} }, render() {} }; }' };
      }
      return next(url, ctx);
    }`;
    register('data:text/javascript,' + encodeURIComponent(loader));
    globalThis.__poolSoundIndexHook = true;
  }
  class El extends EventTarget {
    constructor(tag = '') {
      super();
      this.tagName = String(tag).toUpperCase();
      this.dataset = {}; this.style = {}; this.attrs = {}; this.children = []; this.options = []; this.selectedOptions = [];
      this.isConnected = true; this.open = false; this.hidden = false; this.checked = false; this.value = ''; this.textContent = '';
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      this._q = new Map();
    }
    set innerHTML(_) {}
    get innerHTML() { return ''; }
    setAttribute(k, v) { this.attrs[k] = v; }
    focus() { globalThis.document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { this.isConnected = false; }
    append(...xs) { this.children.push(...xs); }
    prepend(...xs) { this.children.unshift(...xs); }
    before() {}
    insertBefore() {}
    closest(sel) { return sel.split(',').some((s) => s.trim().toUpperCase() === this.tagName) ? this : null; }
    hasPointerCapture() { return false; }
    releasePointerCapture() {}
    querySelector(sel) {
      if (!this._q.has(sel)) this._q.set(sel, new El());
      return this._q.get(sel);
    }
    dispatchEvent(e) {   // a connected click: window's capture listeners, then this element, then window's bubble listeners
      if (!this.isConnected || e.type !== 'click') return super.dispatchEvent(e);
      win.dispatchEvent(e);
      if (!e.cancelBubble) super.dispatchEvent(e);
      if (!e.cancelBubble) winBubble.dispatchEvent(e);
      return !e.defaultPrevented;
    }
  }
  const f = fakeContext();
  let resumes = 0;
  f.ctx.state = 'suspended';
  f.ctx.resume = async () => { resumes++; f.ctx.state = 'running'; };
  f.ctx.decodeAudioData = async () => f.load('stub:audio');
  const saved = {
    document: globalThis.document, window: globalThis.window, matchMedia: globalThis.matchMedia,
    Option: globalThis.Option, AudioContext: globalThis.AudioContext, fetch: globalThis.fetch,
  };
  const win = Object.assign(new EventTarget(), { devicePixelRatio: 1 }), winBubble = new EventTarget(), addToWin = win.addEventListener.bind(win);
  win.addEventListener = (type, fn, o) => (type === 'click' && !(o === true || o?.capture) ? winBubble.addEventListener(type, fn, o) : addToWin(type, fn, o));
  const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null, createElement: (tag) => new El(tag) });
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.Option = class { constructor(t = '', v = '') { this.textContent = t; this.value = v; } remove() {} };
  globalThis.AudioContext = function AudioContext() { return f.ctx; };
  globalThis.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
  const controller = new AbortController(), root = new El('div'), canvas = new El('canvas');
  let hook = null;
  const { mount, extra } = await import(`../src/pool/index.js?t=${Date.now()}-${Math.random()}`);
  await mount({
    canvas, signal: controller.signal, gpu: { device: {} },
    stage: { el: { extra: { querySelector: () => root } }, reduced: { matches: false } },
    frames() {}, hook(h) { hook = h; },
  });
  const key = (k, target = canvas) => {
    const e = new Event('keydown', { cancelable: true });
    Object.defineProperties(e, { key: { value: k }, code: { value: k }, repeat: { value: false }, target: { value: target } });
    win.dispatchEvent(e);
    return e;
  };
  const cleanup = () => {
    controller.abort();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  };
  return { hook, ctx: f.ctx, win, doc, root, canvas, extra, key, resumes: () => resumes, cleanup };
}

test('createAudioGate drives wake, resume and visibility through the same rule', () => {
  let hidden = false, home = null;
  const calls = [];
  const fakeSound = { set(v) { calls.push(['set', v]); }, resume() { calls.push(['resume']); } };
  const gate = createAudioGate(fakeSound, { hidden: () => hidden, home: () => home });

  // Before wake: visibility changes keep sound off; gesture during Go home does not wake.
  gate.sync();
  home = { elapsed: 0 };
  gate.wake();
  assert.deepEqual(calls.splice(0), [['set', false]]);

  // First gesture when visible and not going home wakes audio.
  home = null;
  gate.wake();
  assert.deepEqual(calls.splice(0), [['set', true]]);

  // Later gestures resume only when sound is wanted, visible and not going home.
  gate.wake();
  assert.deepEqual(calls.splice(0), [['resume']]);
  hidden = true;
  gate.sync();
  gate.wake();
  assert.deepEqual(calls.splice(0), [['set', false]]);

  // Returning during Go home brings sound back immediately when wanted and visible.
  home = { elapsed: 1 };
  hidden = false;
  gate.sync();
  gate.wake();
  assert.deepEqual(calls.splice(0), [['set', true], ['resume']]);
  home = null;
  gate.sync();
  assert.deepEqual(calls.splice(0), [['set', true]]);

  // Muted sound suppresses later gesture resumes and stays off on visibility / farewell changes.
  gate.set(false);
  home = { elapsed: 1 };
  gate.wake();
  gate.sync();
  assert.deepEqual(calls.splice(0), [['set', false], ['set', false]]);
});

test('keyboard gestures wake and resume audio while the book is open, without changing what the book blocks', async () => {
  const m = await mountPoolIndex();
  try {
    const seenAfterBook = [];
    m.win.addEventListener('keydown', (e) => seenAfterBook.push(e.code), { capture: true });
    m.hook.bookView.open(null);
    assert.equal(m.hook.bookView.isOpen, true);
    m.key('Tab');
    assert.equal(m.hook.state().sound, true, 'first keyboard gesture wakes sound even while the book is open');
    assert.equal(m.resumes(), 1, 'first keyboard wake resumes context');
    assert.deepEqual(seenAfterBook, [], 'book still blocks Tab from reaching later listeners');

    for (const k of ['Tab', 'Enter']) {
      m.ctx.state = 'interrupted';
      const before = m.resumes();
      m.key(k);
      assert.equal(m.resumes(), before + 1, `${k} resumes interrupted audio while the book is open`);
      assert.deepEqual(seenAfterBook, [], `book still blocks ${k} from reaching later listeners`);
    }
    m.ctx.state = 'suspended';
    const beforeEsc = m.resumes();
    m.key('Escape');
    assert.equal(m.resumes(), beforeEsc + 1, 'Escape resumes suspended audio while the book is open');
    assert.equal(m.hook.bookView.isOpen, false, 'Escape still closes the book');
    assert.deepEqual(seenAfterBook, [], 'book still blocks Escape from reaching later listeners');

    // Muted or hidden leaves audio suspended even on later gestures.
    m.hook.sound(false);
    m.ctx.state = 'suspended';
    const whileMuted = m.resumes();
    m.key('Tab');
    assert.equal(m.resumes(), whileMuted, 'muted sound stays suspended on later gestures');
  } finally { m.cleanup(); }
});

test('first gesture during Go home does not wake unwoken audio, and woken sound plays through the farewell whether hidden and shown or kept visible', async () => {
  // Never woken before Go home: gesture during farewell does not wake audio.
  const unwoken = await mountPoolIndex();
  try {
    assert.equal(unwoken.hook.goHome(), 'going');
    unwoken.win.dispatchEvent(new Event('pointerdown'));
    unwoken.key('Tab');
    assert.equal(unwoken.hook.state().sound, false, 'gesture during Go home never wakes audio that was never woken');
    assert.equal(unwoken.resumes(), 0);
    unwoken.hook.render(2, 2.6);
    assert.equal(unwoken.hook.state().home, null, 'farewell finished');
    assert.equal(unwoken.hook.state().sound, false, 'unwoken audio stays off in the new visit until a gesture');
    unwoken.win.dispatchEvent(new Event('pointerdown'));
    assert.equal(unwoken.hook.state().sound, true, 'first gesture in the new visit wakes audio');
  } finally { unwoken.cleanup(); }

  const m = await mountPoolIndex();
  try {
    m.win.dispatchEvent(new Event('pointerdown'));
    assert.equal(m.hook.state().sound, true, 'first gesture turns sound on');
    const wakeCount = m.resumes();

    // Tab stays visible through Go home: sound stays on from entering home to the new visit.
    assert.equal(m.hook.goHome(), 'going');
    assert.equal(m.hook.state().sound, true, 'sound stays on when entering Go home');
    for (const dt of [1.0, 1.6, 0.5]) {
      m.hook.render(1, dt);
      assert.ok(m.hook.state().home, 'still in farewell');
      assert.equal(m.hook.state().sound, true, `sound stays on through ${m.hook.state().home.phase}`);
    }
    m.hook.render(1, 1.5);
    assert.equal(m.hook.state().home, null, 'farewell finished');
    assert.equal(m.hook.state().visits, 2, 'entered new visit');
    assert.equal(m.hook.state().sound, true, 'sound stays on in the new visit');

    // Tab hidden then shown during Go home: sound is silent while hidden and back when shown.
    assert.equal(m.hook.goHome(), 'going');
    m.doc.hidden = true;
    m.doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(m.hook.state().sound, false, 'hiding the tab silences sound');

    m.doc.hidden = false;
    m.doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(m.hook.state().sound, true, 'showing the tab during Go home brings sound back at once');
    m.ctx.state = 'suspended';
    m.key('Tab');
    assert.equal(m.resumes(), wakeCount + 2, 'gesture resumes suspended audio during Go home when wanted and visible');
    m.hook.render(2, 2.6);
    assert.equal(m.hook.state().home, null, 'farewell finished');
    assert.equal(m.hook.state().sound, true, 'new visit has sound when wanted and visible');

    // If muted before Go home, hiding/showing during farewell and finishing keep sound off.
    m.hook.sound(false);
    m.hook.goHome();
    m.doc.hidden = true;
    m.doc.dispatchEvent(new Event('visibilitychange'));
    m.doc.hidden = false;
    m.doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(m.hook.state().sound, false, 'muted sound stays off when returning during Go home');
    m.hook.render(2, 2.6);
    assert.equal(m.hook.state().sound, false, 'muted sound stays off after farewell');

    // If still hidden when farewell finishes, sound stays off until returning to the tab.
    m.hook.sound(true);
    m.hook.goHome();
    m.doc.hidden = true;
    m.doc.dispatchEvent(new Event('visibilitychange'));
    m.hook.render(2, 2.6);
    assert.equal(m.hook.state().sound, false, 'hidden tab stays quiet after farewell');
    m.doc.hidden = false;
    m.doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(m.hook.state().sound, true, 'becoming visible after farewell brings sound back');
  } finally { m.cleanup(); }
});

test('closing never closes a context that is already closed (a rendered OfflineAudioContext, Chrome 158 and later)', async () => {
  const { ctx, sound } = await on();
  let closes = 0;
  ctx.close = () => { closes++; return Promise.reject(new Error('cannot close a closed context')); };
  ctx.state = 'closed';
  sound.close();
  assert.equal(closes, 0);
  const live = await on();
  live.ctx.close = () => { closes++; return Promise.resolve(); };
  live.sound.close();
  assert.equal(closes, 1, 'a running context is still closed');
});

test('muted, the radio keyboard button reports the station with sound off while advancing the dial', async () => {
  const m = await mountPoolIndex();
  try {
    m.win.dispatchEvent(new Event('pointerdown'));
    assert.equal(m.hook.state().sound, true);
    m.key('KeyM');
    assert.equal(m.hook.state().sound, false);
    const propKeys = m.root.children.find((c) => c.className === 'prop-keys');
    const radio = propKeys.children[0], status = propKeys.querySelector('p');
    assert.equal(radio.textContent, 'Turn the radio dial');
    radio.dispatchEvent(new Event('click'));
    assert.equal(m.hook.state().station, 'Lido FM');
    assert.equal(status.textContent, 'The radio is on Lido FM, but the sound is off.');
    assert.equal(radio.textContent, 'Turn the radio dial');
    for (const s of ['Low Tide', 'Surf Hour']) {
      radio.dispatchEvent(new Event('click'));
      assert.equal(m.hook.state().station, s);
      assert.equal(status.textContent, `The radio is on ${s}, but the sound is off.`);
    }
    radio.dispatchEvent(new Event('click'));
    assert.equal(m.hook.state().station, null);
    assert.equal(status.textContent, 'The radio is off.');
  } finally { m.cleanup(); }
});

test('a first click alone on the radio keyboard button wakes sound and says the radio plays', async () => {
  const m = await mountPoolIndex();
  try {
    assert.equal(m.hook.state().sound, false);
    const propKeys = m.root.children.find((c) => c.className === 'prop-keys');
    const radio = propKeys.children[0], status = propKeys.querySelector('p');
    radio.dispatchEvent(new Event('click'));
    assert.equal(m.hook.state().sound, true);
    assert.equal(m.resumes(), 1);
    assert.equal(m.hook.state().station, 'Lido FM');
    assert.equal(status.textContent, 'The radio plays Lido FM.');
  } finally { m.cleanup(); }
});

test('pressing M on the canvas announces sound off and on in a visually hidden status region while ignoring inputs and selects', async () => {
  const m = await mountPoolIndex();
  try {
    const statuses = m.root.children.filter((c) => c.className === 'sound-status');
    assert.equal(statuses.length, 1, 'one .sound-status element is added at mount');
    const [status] = statuses;
    assert.equal(status.tagName, 'P');
    assert.equal(status.attrs.role, 'status');
    assert.equal(status.attrs['aria-live'], 'polite');
    assert.equal(status.textContent, '');
    assert.match(m.extra, /\.pool \.sound-status \{ position: fixed; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0; overflow: hidden; clip-path: inset\(50%\); white-space: nowrap; \}/);

    m.win.dispatchEvent(new Event('pointerdown'));
    assert.equal(m.hook.state().sound, true);
    assert.equal(status.textContent, '');

    m.key('KeyM');
    assert.equal(m.hook.state().sound, false);
    assert.equal(status.textContent, 'Sound is off.');

    m.key('KeyM');
    assert.equal(m.hook.state().sound, true);
    assert.equal(status.textContent, 'Sound is on.');

    for (const tag of ['input', 'select']) {
      const field = m.doc.createElement(tag);
      field.focus();
      m.key('KeyM', field);
      assert.equal(m.hook.state().sound, true, `M in <${tag}> leaves sound unchanged`);
      assert.equal(status.textContent, 'Sound is on.', `M in <${tag}> leaves sound status unchanged`);
    }

    m.hook.sound(false);
    assert.equal(m.hook.state().sound, false);
    assert.equal(status.textContent, 'Sound is on.', 'non-KeyM sound changes do not announce through .sound-status');
  } finally { m.cleanup(); }
});

test('room reverb and noise buffer wait for first use: default flags build neither, birds build one convolver, Surf Hour builds white noise', async () => {
  const { ctx, made, buffers, sound } = await on();
  const wasBirds = SFX.birds, wasMusic = SFX.music;
  try {
    assert.equal(made.filter((n) => n.kind === 'Convolver').length, 0, 'no convolver is built with default flags off');
    assert.equal(buffers.filter((b) => b.duration === 6).length, 0, 'no 6-second noise buffer is built with default flags off');

    SFX.birds = true;
    const beforeBird = made.length;
    sound.frame([], { hour: 12 });
    const convolvers = made.filter((n) => n.kind === 'Convolver');
    assert.equal(convolvers.length, 1, 'a bird call creates one convolver');
    const birdOscs = made.slice(beforeBird).filter((n) => n.kind === 'Oscillator' && n.started);
    assert.ok(birdOscs.length >= 2 && birdOscs.every((o) => reaches(o, convolvers[0])), 'bird call oscillators connect through the convolver');
    assert.ok(reaches(convolvers[0], ctx.destination), 'the convolver reaches destination');
    ctx.currentTime += 11;
    sound.frame([], { hour: 12 });
    assert.equal(made.filter((n) => n.kind === 'Convolver').length, 1, 'later bird calls reuse the same convolver');
    assert.equal(buffers.filter((b) => b.duration === 6).length, 0, 'bird calls still build no 6-second noise buffer');

    SFX.birds = wasBirds;
    const beforeRadio = made.length;
    sound.frame([], { station: 3 });
    ctx.currentTime += 0.15;
    sound.frame([], { station: 3 });
    const noiseBufs = buffers.filter((b) => b.duration === 6);
    assert.equal(noiseBufs.length, 1, 'Surf Hour creates the 6-second noise buffer on its first hat');
    const hat = made.slice(beforeRadio).find((n) => n.kind === 'BufferSource' && n.buffer === noiseBufs[0]);
    assert.ok(hat?.started && reachesAt(hat, ctx.destination, hat.startTime + 0.005), 'Surf Hour plays its hat through the noise buffer');
  } finally {
    SFX.birds = wasBirds;
    SFX.music = wasMusic;
    sound.close();
  }

  const m = await on();
  try {
    SFX.music = true;
    const beforeMusic = m.made.length;
    m.sound.frame([], { hour: 12 });
    const convolvers = m.made.filter((n) => n.kind === 'Convolver');
    assert.equal(convolvers.length, 1, 'music turned on after start creates one convolver');
    const musicNodes = m.made.slice(beforeMusic).filter((n) => (n.kind === 'Oscillator' || n.kind === 'BufferSource') && n.started);
    assert.ok(musicNodes.length > 0 && musicNodes.every((n) => reaches(n, convolvers[0])), 'music reaches the room convolver on its first note');
    assert.ok(reaches(convolvers[0], m.ctx.destination));
  } finally {
    SFX.music = wasMusic;
    m.sound.close();
  }
});

test('a suspended or interrupted live context schedules nothing while frozen, clears waiting pick-ups on resume, and restarts radio and ambience', async () => {
  const f = fakeContext();
  let resumes = 0;
  f.ctx.resume = async () => { resumes++; f.ctx.state = 'running'; };
  const sound = createSound(() => f.ctx, f.load);
  sound.set(true); await sound.ready;
  const seaGain = f.made.find((n) => n.kind === 'Gain' && n.gain.value === 0.4);
  assert.ok(seaGain, 'ambience sea bed gain exists');
  const beds = f.made.filter((s) => BEDS.has(s.buffer?.url));
  assert.equal(beds.length, 3, 'ambience beds started');
  sound.frame([], { station: 1 });
  const radioBefore = radioSources(f.made);
  assert.ok(radioBefore.length > 0, 'radio starts while running');

  // Queue a pick-up right before the browser interrupts the context (within TAP, not yet due).
  sound.frame([{ type: 'squeak', id: 7, colour: 3, x: 0, y: 1.2, z: 0 }], { station: 1 });
  f.ctx.state = 'suspended';
  const beforeSuspended = f.started.length, beforeMade = f.made.length;

  // Drive many frames at frozen currentTime while suspended with radio on, splashes and pick-up events.
  for (let i = 0; i < 60; i++) {
    sound.frame([
      { type: 'splash', x: 0, z: 0, speed: 2 },
      { type: 'squeak', id: 8, colour: 2, x: 0, y: 1.2, z: 0 },
      { type: 'voice', id: 9, colour: 4, x: 0, y: 1.2, z: 0 },
    ], { station: 1 });
  }
  assert.equal(f.started.length, beforeSuspended, 'no source starts while suspended at frozen time');
  assert.equal(f.made.length, beforeMade, 'no audio node is created while suspended');
  assert.ok(radioBefore.every((s) => !audibleAt(s, f.ctx.destination, f.ctx.currentTime + 0.05)), 'playing radio is retired when suspended');

  // Switch back to running through resume(), advancing time within LATE (1 s) of the pre-interruption pick-up.
  const resumesBefore = resumes;
  sound.resume();
  assert.equal(resumes, resumesBefore + 1, 'resume() wakes the suspended context');
  f.ctx.currentTime += 0.5;
  const seaEventsBefore = seaGain.gain.events().length;
  const afterResumeStarted = f.started.length, afterResumeMade = f.made.length;
  sound.frame([], { station: 1, eye: [20, 12, 12] });
  assert.deepEqual(played(f.started, afterResumeStarted), [], 'pre-interruption pick-up is not started late after resume');
  const radioAfter = radioSources(f.made, afterResumeMade);
  assert.ok(radioAfter.length > 0 && radioAfter.some((s) => audibleAt(s, f.ctx.destination, f.ctx.currentTime + 0.06)), 'radio starts again on the next frame');
  assert.ok(seaGain.gain.events().length > seaEventsBefore, 'ambience updates again on the next frame');
  assert.ok(beds.every((s) => reachesAt(s, f.ctx.destination, f.ctx.currentTime)), 'ambience beds still reach destination');

  // Also check 'interrupted' (Safari) and that an OfflineAudioContext ('startRendering' in ctx) still renders while suspended.
  f.ctx.state = 'interrupted';
  const beforeInterrupted = f.started.length;
  sound.frame([{ type: 'splash', x: 0, z: 0, speed: 2 }], { station: 2 });
  assert.equal(f.started.length, beforeInterrupted, 'interrupted context also schedules nothing');
  sound.resume();
  assert.equal(resumes, resumesBefore + 2, 'resume() wakes an interrupted context');
  sound.close();

  const off = fakeContext();
  off.ctx.state = 'suspended';
  off.ctx.startRendering = async () => {};
  const offSound = createSound(() => off.ctx, off.load);
  offSound.set(true); await offSound.ready;
  const offBefore = off.started.length;
  offSound.frame([{ type: 'splash', x: 0, z: 0, speed: 2 }], { station: 1 });
  assert.ok(played(off.started, offBefore).length === 1 && radioSources(off.made).length > 0, 'OfflineAudioContext still renders while suspended');
  offSound.close();
});

const VOICE_FILES = new Set(Object.entries(RECORDINGS).filter(([k]) => k.startsWith('duck')).map(([, u]) => u));
const voices = (started, from = 0) => started.slice(from).filter((u) => VOICE_FILES.has(u));

test('the first tap\'s voice is said once a new context starts, while a pick-up waiting when the browser pauses a running context is dropped', async () => {
  const f = fakeContext();
  f.ctx.state = 'suspended'; f.ctx.currentTime = 0;
  const sound = createSound(() => f.ctx, f.load);
  sound.set(true);
  sound.frame([{ type: 'voice', id: 3, colour: 3, x: 0, y: 1.2, z: 0 }]);
  await sound.ready;
  f.ctx.state = 'running'; f.ctx.currentTime = 0.2;
  sound.frame([]);
  assert.equal(voices(f.started).length, 1, 'the voice of the touch that woke the sound is said');
  sound.close();

  const g = await on();
  g.sound.frame([{ type: 'squeak', id: 7, colour: 3, x: 0, y: 1.2, z: 0 }]);
  g.ctx.state = 'interrupted';
  g.sound.frame([]);
  g.ctx.state = 'running'; g.ctx.currentTime += 0.5;
  const before = g.started.length;
  g.sound.frame([]);
  assert.deepEqual(voices(g.started, before), [], 'a pick-up from before the pause is not said when the browser resumes by itself');
  g.sound.close();
});

test('before a new context first runs, nothing is scheduled at its frozen time; once it runs, the waking tap is said and nothing else', async () => {
  const f = fakeContext(), fireworks = SFX.fireworks;
  f.ctx.state = 'suspended'; f.ctx.currentTime = 0;
  SFX.fireworks = true;
  try {
    const sound = createSound(() => f.ctx, f.load);
    sound.set(true); await sound.ready;
    const n = f.started.length;
    sound.frame([{ type: 'voice', id: 3, colour: 3, x: 0, y: 1.2, z: 0 }]);
    const scene = ['whee', 'gurgle', 'pop', 'splash', 'plop', 'launch', 'burst'].map((type) => ({ type, slide: type === 'whee', x: 0, y: 1.2, z: 0, speed: 2 }));
    for (let i = 0; i < 60; i++) sound.frame(scene);
    assert.equal(f.started.length - n, 0, 'sources scheduled while the context has never run');
    f.ctx.state = 'running'; f.ctx.currentTime = 0.02;
    sound.frame([]);
    const said = f.started.slice(n);
    assert.ok(said.length === 1 && voices(said).length === 1, `once it runs, the waking tap's voice alone: ${said.length} sources`);
    sound.close();
  } finally { SFX.fireworks = fireworks; }
});

test('a first tap whose frame is drawn before its click is still said once the sound runs', async () => {
  const f = fakeContext();
  f.ctx.state = 'suspended'; f.ctx.currentTime = 0;
  const sound = createSound(() => f.ctx, f.load);
  sound.set(true); await sound.ready;
  sound.frame([{ type: 'voice', id: 3, colour: 3, x: 0, y: 1.2, z: 0 }]);
  sound.resume();
  f.ctx.state = 'running'; f.ctx.currentTime = 0.02;
  sound.frame([]);
  assert.equal(voices(f.started).length, 1, 'the voice of the tap that woke the sound');
  sound.close();
});

