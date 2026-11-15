import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSound, musicFor, SFX, RECORDINGS, shouldResumeAudio } from '../src/pool/sound.js';
import { P } from '../src/pool/layout.js';

// A stand-in AudioContext records starts and connections; decoded buffers carry their URL.
function fakeContext() {
  const started = [], made = [];
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
    const o = { kind, links: [], started: false, stops: [],
      connect(n) { this.links.push(n); return n; },
      disconnect() { this.links.length = 0; },
      start(t = ctx.currentTime) { started.push(this.buffer?.url ?? kind); this.started = true; this.startTime = t; },
      stop(t = ctx.currentTime) { this.stopTime = t; this.stops.push(t); } };
    const n = new Proxy(o, { get(t, k) { if (!(k in t)) t[k] = param(); return t[k]; } });
    made.push(n); return n;
  };
  const buffer = (length, url) => ({ url, length, duration: length / 8000, sampleRate: 8000, numberOfChannels: 2, getChannelData: () => new Float32Array(length).fill(0.05) });
  const ctx = new Proxy({ currentTime: 1, sampleRate: 8000, destination: node('out'), listener: node('listener'), resume: async () => {}, close() {}, createBuffer: (c, length) => buffer(length) },
    { get(o, k) { if (k in o) return o[k]; if (String(k).startsWith('create')) return () => node(String(k).slice(6)); return undefined; } });
  return { ctx, started, made, load: async (url) => buffer(8000 * 4, url) };
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

test('with six background recordings playing, a tap voice starts', async () => {
  const { ctx, started, made, sound } = await on();
  const six = [{ type: 'whee', slide: true, x: 0, z: 0 }, { type: 'whee', slide: true, x: 0, z: 0 },
    { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 }, { type: 'gurgle', x: 0, z: 0 }, { type: 'pop', x: 0, z: 0 }];
  sound.frame(six);
  const bg = active(made, ctx.destination);
  assert.equal(bg.length, 6);
  const n = started.length;
  sound.frame([{ type: 'voice', id: 7, colour: 3, x: 0, y: 1.2, z: 0 }]);
  assert.deepEqual(played(started, n), [RECORDINGS.duck3]);
  const tap = made.findLast((s) => s.buffer?.url === RECORDINGS.duck3);
  assert.ok(tap?.started && reaches(tap, ctx.destination), 'the tap voice reaches the speakers');
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
    for (let i = 0; i < 10; i++) {
      ctx.currentTime += 0.05; last = started.length;
      sound.frame([{ type: 'voice', id: i, colour: i, x: 0, y: 1.2, z: 0 }]);
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
  active(made, ctx.destination)[0].onended();
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
  assert.equal(shouldResumeAudio({ woken: true, soundWanted: true, hidden: false, home: { elapsed: 0 } }), false);

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

// fakeContext does not render audio through PannerNode, so evaluate WebAudio's distanceModel gain along the graph.
function pannerGainAt(p, L, t) {
  const d = Math.hypot(p.positionX.at(t) - L.positionX.at(t), p.positionY.at(t) - L.positionY.at(t), p.positionZ.at(t) - L.positionZ.at(t));
  const ref = p.refDistance, roll = p.rolloffFactor, m = p.distanceModel;
  if (m === 'exponential') return (Math.max(d, ref) / ref) ** -roll;
  if (m === 'linear') return 1 - roll * (Math.min(p.maxDistance, Math.max(d, ref)) - ref) / ((p.maxDistance - ref) || 1);
  return ref / (ref + roll * (Math.max(d, ref) - ref));
}
function pathGainAt(n, dest, ctx, t, seen = new Set()) {
  if (n === dest) return 1;
  if (seen.has(n)) return 0;
  seen.add(n);
  let k = 1;
  if (n.kind === 'Gain') k = n.gain.at(t);
  else if (n.kind === 'Panner') k = pannerGainAt(n, ctx.listener, t);
  if (k <= 0) return 0;
  let best = 0;
  for (const next of n.links) best = Math.max(best, pathGainAt(next, dest, ctx, t, new Set(seen)));
  return k * best;
}
function findPanner(n, seen = new Set()) {
  if (!n || seen.has(n)) return null;
  if (n.kind === 'Panner') return n;
  seen.add(n);
  for (const next of n.links) { const found = findPanner(next, seen); if (found) return found; }
  return null;
}

test('radio volume falls smoothly with distance from the radio and uses one placed node', async () => {
  const { ctx, made, sound } = await on();
  const pannersBefore = made.filter((n) => n.kind === 'Panner').length;
  const radioPos = [P.RADIO[0], P.TER, P.RADIO[1]];
  const farCorner = [P.WALL_L, P.TER, P.FRONT];
  const atPoint = (eye, at = radioPos) => {
    sound.frame([], { station: 1, eye, at });
    ctx.currentTime += 1;
    sound.frame([], { station: 1, eye, at });
    return ctx.currentTime;
  };

  const tNear = atPoint(radioPos, [radioPos[0] - 1, radioPos[1], radioPos[2]]);
  const speaker = radioSources(made).findLast((s) => s.kind === 'Oscillator')?.links[0]?.links[0];
  assert.ok(speaker, 'radio notes feed a speaker node');

  // Level before this change was bus.radio (4) * master out (0.6) = 2.4 through the speaker chain.
  const levelNear = pathGainAt(speaker, ctx.destination, ctx, tNear);
  assert.ok(Math.abs(20 * Math.log10(levelNear / 2.4)) <= 1, `at the radio, level (${levelNear.toFixed(3)}) is within 1 dB of 2.4`);

  const levels = [];
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const eye = radioPos.map((v, i) => v + (farCorner[i] - v) * frac);
    const t = atPoint(eye);
    levels.push(pathGainAt(speaker, ctx.destination, ctx, t));
  }

  const levelFar = levels.at(-1);
  assert.ok(levelFar > 0, 'radio never goes silent inside the courtyard');
  const dropDb = 20 * Math.log10(levelNear / levelFar);
  assert.ok(dropDb >= 12 && dropDb <= 18, `far corner is 12 to 18 dB quieter than at the radio (measured ${dropDb.toFixed(2)} dB)`);

  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] < levels[i - 1], `level falls as distance grows (step ${i}: ${levels[i - 1].toFixed(4)} -> ${levels[i].toFixed(4)})`);
  }

  const panner = findPanner(speaker);
  assert.ok(panner, 'radio speaker routes through a Panner node');
  assert.equal(panner.panningModel, 'equalpower', 'uses equalpower panning for left/right listener orientation');
  assert.deepEqual([panner.positionX.value, panner.positionY.value, panner.positionZ.value], radioPos, 'panner sits at P.RADIO on P.TER');

  // Listener orientation tracks look direction and station changes / off-on reuse the single placed node.
  const tLook = atPoint([radioPos[0], radioPos[1], radioPos[2] + 2], radioPos);
  assert.ok(ctx.listener.forwardZ.at(tLook) < -0.9, 'listener forward vector follows look target');
  sound.frame([], { station: 2, eye: radioPos });
  ctx.currentTime += 0.2;
  sound.frame([], { station: 0, eye: radioPos });
  ctx.currentTime += 0.2;
  sound.frame([], { station: 3, eye: radioPos });
  assert.equal(made.filter((n) => n.kind === 'Panner').length, pannersBefore + 1, 'one placed panner for the radio, never per note or station');
  sound.close();
});
