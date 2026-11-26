import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbientAudio } from '../src/sanctuary/ambient-audio.js';
import { RECORDINGS } from '../src/pool/sound.js';
import { DESIGNS } from '../src/pool/ducks.js';

// A stand-in AudioContext: it records what starts (a recording by its URL, anything else by its node kind), the
// buffer sources it made, what was stopped, and how the nodes connect; a param keeps its scheduled values so its level
// can be read at a time.
function fakeContext() {
  const started = [], sources = [], stopped = [];
  const param = () => {
    let base = 0;
    const ev = [];
    return {
      get value() { return ev.length ? ev[ev.length - 1].v : base; },
      set value(v) { base = v; },
      setValueAtTime(v, t) { ev.push({ v, t, tc: 0 }); },
      linearRampToValueAtTime(v, t) { ev.push({ v, t, tc: 0 }); },
      exponentialRampToValueAtTime(v, t) { ev.push({ v, t, tc: 0 }); },
      setTargetAtTime(v, t, tc) { ev.push({ v, t, tc }); },
      at(t) {
        let v = base;
        for (let i = 0; i < ev.length && ev[i].t <= t; i++) {
          const e = ev[i], end = Math.min(t, ev[i + 1]?.t ?? t);
          v = e.tc ? e.v + (v - e.v) * Math.exp(-(end - e.t) / e.tc) : e.v;
        }
        return v;
      },
    };
  };
  const node = (kind) => {
    const o = { kind, links: [],
      connect(n) { this.links.push(n); return n; },
      disconnect() { this.links.length = 0; },
      start() { started.push(this.buffer?.url ?? kind); },
      stop() { stopped.push(this); } };
    const n = new Proxy(o, { get(t, k) { if (!(k in t)) t[k] = param(); return t[k]; } });
    if (kind === 'BufferSource') sources.push(n);
    return n;
  };
  const ctx = new Proxy({ state: 'running', currentTime: 1, sampleRate: 8000, destination: node('out'), listener: node('listener'),
    resume() { this.state = 'running'; return Promise.resolve(); },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    close: async () => {},
    createBuffer: (c, length) => ({ length, duration: length / 8000, sampleRate: 8000, getChannelData: () => new Float32Array(length) }) },
  { get(o, k) { if (k in o) return o[k]; if (String(k).startsWith('create')) return () => node(String(k).slice(6)); return undefined; } });
  const load = async (url) => ({ url, length: 32000, duration: 4, sampleRate: 8000, getChannelData: () => new Float32Array(32000).fill(0.05) });
  let made = 0;
  return { ctx, started, sources, stopped, load, make: () => { made++; return ctx; }, get made() { return made; } };
}

async function sanctuary() {
  const f = fakeContext();
  const audio = createAmbientAudio({ make: f.make, load: f.load });
  audio.ensure();
  await audio.ready;
  return { audio, ...f, since: () => { const n = f.started.length; return () => f.started.slice(n); } };
}
/** How loud a node is at the speakers at time t: the gains on its way out, multiplied (0 if it never gets there). */
function heard(n, out, t, seen = new Set()) {
  if (n === out) return 1;
  if (seen.has(n)) return 0;
  seen.add(n);
  return (n.kind === 'Gain' ? n.gain.at(t) : 1) * Math.max(0, ...n.links.map((m) => heard(m, out, t, seen)));
}
const sourceOf = (sources, url) => sources.find((s) => s.buffer?.url === url);
/** The first node of this kind on a sound's way out, if any. */
function via(n, kind, seen = new Set()) {
  if (n.kind === kind) return n;
  if (seen.has(n)) return null;
  seen.add(n);
  for (const next of n.links) { const hit = via(next, kind, seen); if (hit) return hit; }
  return null;
}

test('the sanctuary is heard through the first map\'s recordings: the pool\'s lapping and the sea\'s two beds, nothing made', async () => {
  const { audio, ctx, started, sources } = await sanctuary();
  try {
    for (const k of ['lapping', 'sea', 'surf']) {
      assert.ok(started.includes(RECORDINGS[k]), `${k} plays`);
      assert.ok(heard(sourceOf(sources, RECORDINGS[k]), ctx.destination, 5) > 0.01, `${k} reaches the speakers`);
    }
    assert.deepEqual(started.filter((k) => !k.startsWith('file:')), [], 'no oscillator or noise bed runs');
  } finally { audio.dispose(); }
});

test('a splash, a yuzu dropped in and a duck\'s beak jet are the pool\'s water recordings; the made cues stay silent', async () => {
  const { audio, since } = await sanctuary();
  try {
    const cue = (kind, at) => { const got = since(); audio.playCue(kind, at); return got(); };
    const splash = cue('splash', { x: 1, y: -0.1, z: 2 });
    assert.equal(splash.length, 1);
    assert.ok([RECORDINGS.splash, RECORDINGS.splash2].includes(splash[0]), 'a splash is one of the pool\'s splashes');
    assert.deepEqual(cue('yuzu', { x: 2.6, y: -0.1, z: -1.6 }), [RECORDINGS.splash2]);
    assert.deepEqual(cue('waterjet', null), [RECORDINGS.tube]);
    for (const kind of ['chime', 'windchime', 'stamp', 'terminal', 'valve', 'catch', 'bite', 'arrival', 'scratch', 'burp', 'stare', 'page', 'shishi']) {
      assert.deepEqual(cue(kind), [], `${kind} is silent`);
    }
  } finally { audio.dispose(); }
});

test('a cue with a place is heard from it', async () => {
  const { audio, sources } = await sanctuary();
  try {
    audio.playCue('waterjet', { x: 4, y: -0.1, z: -3 });
    const panner = via(sources.find((s) => s.buffer?.url === RECORDINGS.tube), 'Panner');
    assert.ok(panner, 'the jet goes through a panner');
    assert.deepEqual([panner.positionX.value, panner.positionY.value, panner.positionZ.value], [4, -0.1, -3]);
  } finally { audio.dispose(); }
});

test('the sea round the island is fuller with the camera out over the water than inside the estate, as on the first map', async () => {
  const { audio, ctx, sources } = await sanctuary();
  try {
    const fwd = { x: 0, y: -0.5, z: -1 };
    audio.listen({ x: 0, y: 12, z: 0 }, fwd);
    ctx.currentTime = 40;
    audio.listen({ x: 0, y: 12, z: 60 }, fwd);
    const rise = (k) => {
      const s = sourceOf(sources, RECORDINGS[k]);
      return heard(s, ctx.destination, 400) / heard(s, ctx.destination, 39);
    };
    assert.ok(rise('sea') > 2.2, `out over the water the sea is over twice as loud as inside the estate (${rise('sea').toFixed(2)}x)`);
    assert.ok(Math.abs(rise('surf') - rise('sea')) < 1e-9, 'the surf rises with it');
    const lap = heard(sourceOf(sources, RECORDINGS.lapping), ctx.destination, 400) / heard(sourceOf(sources, RECORDINGS.lapping), ctx.destination, 39);
    assert.ok(Math.abs(lap - 1) < 1e-9, 'the pool\'s lapping does not');
  } finally { audio.dispose(); }
});

test('a duck says its own design\'s recorded voice, and nothing while the sound is muted or the page is out of sight', async () => {
  const { audio, ctx, sources, since } = await sanctuary();
  try {
    const say = (...a) => { const got = since(); audio.duckVoice(...a); return got(); };
    DESIGNS.slice(0, 12).forEach((d, i) => assert.deepEqual(say(d.id, 'x', { x: 0, y: 0, z: 0 }, 'voice'), [RECORDINGS[`duck${i}`]], d.id));
    const painted = say(null, 'custom-7', { x: 0, y: 0, z: 0 }, 'voice');
    assert.equal(painted.length, 1);
    assert.match(painted[0], /ducks\/duck-\d\d\.mp3$/, 'a painted duck still says one of the recorded voices');
    audio.setHidden(true);
    assert.equal(ctx.state, 'suspended', 'out of sight the sound pauses');
    assert.deepEqual(say(DESIGNS[0].id, 'x', null, 'voice'), [], 'hidden');
    audio.setHidden(false);
    assert.equal(ctx.state, 'running', 'and plays on when it is back');
    assert.equal(say(DESIGNS[0].id, 'x', null, 'voice').length, 1, 'back in sight');
    audio.setMasterMuted(true);
    assert.deepEqual(say(DESIGNS[0].id, 'x', null, 'voice'), [], 'muted');
    const got = since();
    audio.playCue('splash');
    assert.deepEqual(got(), [], 'muted');
    assert.ok(heard(sourceOf(sources, RECORDINGS.sea), ctx.destination, ctx.currentTime + 2) < 1e-3, 'the beds go quiet too');
  } finally { audio.dispose(); }
});

test('the circuit is heard as on the first map: onto the slide, the grotto splash off it, out of the siphon', async () => {
  const { audio, ctx, since } = await sanctuary();
  try {
    const hear = (ev) => { const got = since(); audio.hear(ev); return got(); };
    assert.deepEqual(hear({ type: 'slide', id: 'a', x: -0.8, z: 2.5 }), [RECORDINGS.slide]);
    assert.deepEqual(hear({ type: 'slide', id: 'b', x: -0.8, z: 2.5 }), [], 'a second one at once is heard once');
    assert.deepEqual(hear({ type: 'splash', id: 'a', x: 0.2, z: 13, strength: 3 }), [RECORDINGS.slideSplash]);
    assert.deepEqual(hear({ type: 'launch', id: 'a', x: 7, z: -1.5, strength: 1 }), [RECORDINGS.tube]);
    assert.deepEqual(hear({ type: 'collision', a: 'a', b: 'b', impulse: 1, x: 0, z: 0 }), []);
    ctx.currentTime += 1;
    assert.deepEqual(hear({ type: 'slide', id: 'c', x: -0.8, z: 2.5 }), [RECORDINGS.slide], 'heard again a moment later');
  } finally { audio.dispose(); }
});

test('what the player does is heard even while the circuit\'s sounds fill every voice', async () => {
  const { audio, ctx, sources, stopped, since } = await sanctuary();
  try {
    let circuit = 0;
    const n0 = sources.length;
    for (let i = 0; i < 12; i++) {
      ctx.currentTime += 0.2;
      if (audio.hear({ type: ['slide', 'splash', 'launch'][i % 3], id: `d${i}`, x: 0, z: 0 })) circuit++;
    }
    const circuitSounds = sources.slice(n0);
    assert.ok(circuit >= 6 && circuit < 12, `the circuit fills the voices and then waits (${circuit} of 12 heard)`);
    for (const [act, want] of [[() => audio.playCue('yuzu', { x: 2.6, y: -0.1, z: -1.6 }), RECORDINGS.splash2], [() => audio.playCue('waterjet', null), RECORDINGS.tube], [() => audio.duckVoice(DESIGNS[0].id, 'x', null), RECORDINGS.duck0]]) {
      const got = since();
      act();
      assert.deepEqual(got(), [want]);
    }
    assert.equal(circuitSounds.filter((s) => stopped.includes(s)).length, 3, 'each of the three made room by stopping a circuit sound');
  } finally { audio.dispose(); }
});

test('nothing makes the page\'s sound before the player touches it, whatever the ducks do', () => {
  const f = fakeContext();
  const audio = createAmbientAudio({ make: f.make, load: f.load });
  try {
    audio.playCue('arrival');
    audio.playCue('splash', { x: 0, y: 0, z: 0 });
    audio.duckVoice(DESIGNS[0].id, 'x', null);
    audio.strumGuitarChord();
    audio.hear({ type: 'slide', id: 'a', x: 0, z: 0 });
    audio.setHidden(false);
    assert.equal(f.made, 0, 'no AudioContext yet');
    assert.deepEqual(f.started, []);
  } finally { audio.dispose(); }
});

test('a sound that ends after the page let its sound go does nothing', async () => {
  const { audio, sources } = await sanctuary();
  audio.playCue('waterjet', null);
  audio.playCue('waterjet', { x: 1, y: 0, z: 1 });
  const jets = sources.filter((s) => s.buffer?.url === RECORDINGS.tube);
  audio.dispose();
  for (const s of jets) assert.doesNotThrow(() => s.onended());
});

test('a touch wakes the sound a phone call interrupted, and what happened meanwhile is not saved up to sound at once', async () => {
  const { audio, ctx, since } = await sanctuary();
  try {
    ctx.state = 'interrupted';
    const got = since();
    audio.duckVoice(DESIGNS[0].id, 'x', null, 'voice');
    audio.playCue('splash');
    audio.strumGuitarChord();
    assert.deepEqual(got(), [], 'nothing is scheduled on a stopped clock');
    audio.ensure();
    assert.equal(ctx.state, 'running', 'the touch wakes it');
    audio.duckVoice(DESIGNS[0].id, 'x', null, 'voice');
    assert.deepEqual(got(), [RECORDINGS.duck0]);
  } finally { audio.dispose(); }
});

test('a page that lets its sound go and takes it up again hears the circuit at once', async () => {
  const { audio, ctx, since } = await sanctuary();
  try {
    ctx.currentTime = 50;
    audio.hear({ type: 'slide', id: 'a', x: 0, z: 0 });
    audio.dispose();
    ctx.currentTime = 0.5;
    audio.ensure();
    await audio.ready;
    const got = since();
    audio.hear({ type: 'slide', id: 'a', x: 0, z: 0 });
    assert.deepEqual(got(), [RECORDINGS.slide]);
  } finally { audio.dispose(); }
});
