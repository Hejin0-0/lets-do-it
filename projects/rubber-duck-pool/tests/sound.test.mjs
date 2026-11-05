import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSound, musicFor, SFX, RECORDINGS } from '../src/pool/sound.js';

// A stand-in AudioContext that records what starts (a played recording by its URL), and a loader that "decodes" each
// recording into a buffer named by its URL.
function fakeContext() {
  const started = [], made = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  const node = (kind) => { const o = { kind, connect() {}, disconnect() {}, start() { started.push(o.buffer?.url ?? kind); }, stop() {} }; made.push(o); return new Proxy(o, { get(t, k) { if (!(k in t)) t[k] = param(); return t[k]; }, set(t, k, v) { t[k] = v; return true; } }); };
  const buffer = (length, url) => ({ url, length, duration: length / 8000, sampleRate: 8000, numberOfChannels: 2, getChannelData: () => new Float32Array(length).fill(0.05) });
  const ctx = new Proxy({ currentTime: 1, sampleRate: 8000, destination: node('out'), listener: node('listener'), resume: async () => {}, close() {}, createBuffer: (c, length) => buffer(length) },
    { get(o, k) { if (k in o) return o[k]; if (String(k).startsWith('create')) return () => node(String(k).slice(6)); return undefined; } });
  return { ctx, started, made, load: async (url) => buffer(8000 * 4, url) };
}
const played = (started, from) => started.slice(from).filter((k) => k.startsWith('file:'));
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
  const { started, sound } = await on();
  for (const k of ['lapping', 'sea', 'surf']) assert.ok(started.includes(RECORDINGS[k]), `${k} plays`);
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
    assert.ok(made.slice(g).filter((n) => n.kind === 'Gain').every((n) => n.gain.value > 0), `${type} of design ${colour} is heard (its gain above 0)`);
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

test('the radio plays its station, the music stays off, and muting stops what follows', async () => {
  const { ctx, started, sound } = await on();
  const n = started.length; sound.frame([], { hour: 12 });
  assert.equal(started.length, n, 'no music');
  sound.frame([], { station: 1 });
  assert.ok(started.slice(n).includes('Oscillator'), 'the radio plays');
  const m = started.length; sound.set(false); ctx.currentTime += 5; sound.frame([{ type: 'voice', colour: 1, x: 0, z: 0 }], { station: 1 });
  assert.equal(started.length, m, 'muted: nothing more is scheduled');
  sound.close();
});

test('the music follows the hour: the day, the dusk, the night', () => {
  assert.equal(musicFor(11), 'day'); assert.equal(musicFor(18), 'dusk'); assert.equal(musicFor(23), 'night'); assert.equal(musicFor(2), 'night'); assert.equal(musicFor(8), 'day');
});

test('without an audio context it stays silent and does not fail', async () => {
  const sound = createSound(() => null);
  sound.set(true); await sound.ready; sound.frame([{ type: 'splash', x: 0, z: 0, speed: 2 }]); sound.close();
});
