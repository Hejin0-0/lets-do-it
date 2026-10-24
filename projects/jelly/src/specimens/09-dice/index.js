// 09 — Jelly Dice: translucent gummy dice on a frosted plate that squash, stretch and
// ring. Pull one, poke one, roll them all. A page of its own design (meta.layout 'custom') in #extra,
// scoped under .dice; its own renderer (layered refraction) on the shared device.
import { M4 } from '../../core/math.js';
import { jellySim } from '../../core/jellysim.js';
import { DiceGeo } from './geo.js';
import { createRenderer } from './renderer.js';

export const meta = {
  id: '09', name: 'Jelly Dice', noun: 'candy', paper: '#efe8dc', layout: 'custom',
  eyebrow: 'Material Studies / No. 009', title: ['Jelly', 'Dice'], caption: ['Translucent gummies that squash, stretch and ring.'],
  aria: 'Translucent gummy dice on a frosted glass plate. Drag a die to stretch it, tap one to poke it, drag the table to turn the view.',
};
export const panel = '';
export const foot = '';
export const notes = '';

export const extra = /* html */`
<div class="dice">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap">
<style>
.extra > .dice { pointer-events: none; font: 400 14px/1.4 var(--sans); color: var(--ink); --paper: #efe8dc; --ink: #1d1a16; --muted: #6e665b; --rule: rgba(29, 26, 22, 0.14); --rule-strong: rgba(29, 26, 22, 0.38); --glass: rgba(239, 232, 220, 0.82); --serif: "Instrument Serif", "Iowan Old Style", Palatino, Georgia, serif; --sans: "Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color-scheme: light; }
.dice button, .dice input { font: inherit; color: inherit; }
.dice :focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.dice .dice-head { position: fixed; top: 26px; left: 30px; pointer-events: none; z-index: 2; max-width: 520px; }
.dice .kicker { margin: 0 0 6px; font: 600 11px/1 var(--sans); letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.dice .title { margin: 0; font: 400 clamp(52px, 7vw, 92px)/0.9 var(--serif); letter-spacing: -0.01em; }
.dice .title em { font-style: italic; }
.dice .sub { margin: 10px 0 0; font: 400 15px/1.35 var(--sans); color: var(--muted); max-width: 30ch; }
.dice .top { position: fixed; top: 24px; right: 24px; z-index: 4; display: flex; gap: 8px; align-items: center; }
.dice .pill { border: 1px solid var(--rule-strong); background: var(--glass); padding: 8px 15px 9px; border-radius: 999px; cursor: pointer; font: 500 13px/1 var(--sans); letter-spacing: 0.02em; }
.dice .pill:hover { background: var(--ink); color: var(--paper); }
.dice .pill[aria-pressed="true"], .dice .pill[aria-expanded="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.dice .dice-panel { position: fixed; top: 68px; right: 24px; z-index: 4; width: 268px; padding: 16px 18px 14px; background: var(--glass); border: 1px solid var(--rule-strong); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.dice .dice-panel[hidden] { display: none; }
.dice .dice-panel h2 { margin: 0 0 12px; font: 400 24px/1 var(--serif); }
.dice .field { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: baseline; margin-bottom: 12px; }
.dice .field label { font: 500 12px/1.2 var(--sans); letter-spacing: 0.06em; text-transform: uppercase; }
.dice .field output { font: 400 12px/1 var(--mono); color: var(--muted); }
.dice .field input[type=range] { grid-column: 1 / -1; width: 100%; accent-color: var(--ink); margin: 2px 0 0; }
.dice .toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 4px 0 12px; }
.dice .toggle { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid var(--rule); background: transparent; cursor: pointer; font: 500 12px/1 var(--sans); text-align: left; }
.dice .toggle::before { content: ""; width: 10px; height: 10px; border: 1.5px solid var(--ink); border-radius: 50%; flex: none; }
.dice .toggle[aria-pressed="true"]::before { background: var(--ink); }
.dice .row { display: flex; gap: 6px; }
.dice .row .pill { flex: 1; text-align: center; padding: 8px 10px; }
.dice .fps { margin: 12px 0 0; font: 400 11px/1 var(--mono); color: var(--muted); display: flex; justify-content: space-between; }
.dice .bar { position: fixed; left: 0; right: 0; bottom: var(--nav-h, 0px); z-index: 3; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 12px 24px; padding: 0 30px 24px; pointer-events: none; }
.dice .bar > * { pointer-events: auto; }
.dice .group-label { display: block; margin: 0 0 8px; font: 600 10.5px/1 var(--sans); letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.dice .dice-swatches { display: flex; flex-wrap: wrap; gap: 7px; }
.dice .dice-swatch { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid transparent; padding: 3px; background: transparent; cursor: pointer; }
.dice .dice-swatch span { display: block; width: 100%; height: 100%; border-radius: 50%; background: var(--c); box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.18), inset 0 3px 5px rgba(255, 255, 255, 0.45); }
.dice .dice-swatch.mixed span { background: conic-gradient(#e0345f 0 60deg, #f2a114 0 120deg, #a6d61e 0 180deg, #1f9d63 0 240deg, #2f6fd6 0 300deg, #8b4fc4 0); }
.dice .dice-swatch[aria-checked="true"] { border-color: var(--ink); }
.dice .centre { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.dice .count { display: flex; border: 1px solid var(--rule-strong); border-radius: 999px; overflow: hidden; background: var(--glass); }
.dice .count button { width: 38px; height: 34px; border: 0; background: transparent; cursor: pointer; font: 500 14px/1 var(--sans); }
.dice .count button + button { border-left: 1px solid var(--rule); }
.dice .count button[aria-checked="true"] { background: var(--ink); color: var(--paper); }
.dice .roll { min-width: 176px; height: 50px; padding: 0 26px; border: 0; border-radius: 999px; background: var(--ink); color: var(--paper); cursor: pointer; font: 400 26px/1 var(--serif); letter-spacing: 0.01em; display: inline-flex; align-items: center; justify-content: center; gap: 12px; }
.dice .roll kbd { font: 500 10px/1 var(--sans); letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.6; border: 1px solid currentColor; border-radius: 4px; padding: 3px 5px; }
.dice .roll:hover { background: #3a342d; }
.dice .result { justify-self: end; text-align: right; }
.dice .total { font: 400 clamp(54px, 6vw, 80px)/0.85 var(--serif); font-variant-numeric: tabular-nums; }
.dice .total[data-state="rolling"] { color: var(--muted); }
.dice .values { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; min-height: 26px; }
.dice .values .v { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; font: 600 13px/1 var(--sans); color: #fff; background: var(--c); box-shadow: inset 0 -3px 5px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.35); }
.dice .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 760px), (orientation: portrait) and (max-width: 900px) {
  .dice .dice-head { top: 16px; left: 16px; }
  .dice .title { font-size: 46px; }
  .dice .sub { font-size: 13px; margin-top: 6px; max-width: 24ch; }
  .dice .kicker { font-size: 10px; }
  .dice .top { top: 14px; right: 12px; }
  .dice .dice-panel { top: auto; bottom: var(--nav-h, 0px); left: 0; right: 0; width: auto; z-index: 5; padding: 16px 16px max(16px, env(safe-area-inset-bottom) - var(--nav-h, 0px)); border-width: 1px 0 0; }
  .dice .bar { grid-template-columns: 1fr auto; padding: 0 14px max(14px, env(safe-area-inset-bottom) - var(--nav-h, 0px)); gap: 10px 12px; }
  .dice .bar .colours { grid-column: 1 / -1; grid-row: 1; }
  .dice .centre { grid-row: 2; grid-column: 1; align-items: flex-start; }
  .dice .result { grid-row: 2; grid-column: 2; }
  .dice .roll { min-width: 150px; height: 46px; font-size: 23px; }
  .dice .total { font-size: 50px; }
  .dice .dice-swatch { width: 32px; height: 32px; }
  .dice .count button { width: 40px; height: 38px; }
}
.dice > * { pointer-events: auto; }
</style>
<header class="dice-head">
  <p class="kicker">Material Studies / No. 009</p>
  <h1 class="title">Jelly <em>Dice</em></h1>
  <p class="sub">Translucent gummies that squash, stretch and ring. Pull one, poke one, roll them all.</p>
</header>

<div class="top">
  <button class="pill" id="settings-btn" type="button" aria-expanded="false" aria-controls="settings">Settings</button>
</div>

<aside class="dice-panel" id="settings" hidden aria-label="Settings">
  <h2>Settings</h2>
  <div class="field"><label for="soft">Softness</label><output id="soft-out" for="soft">60</output><input id="soft" type="range" min="0" max="100" value="60"></div>
  <div class="field"><label for="decay">Wobble decay</label><output id="decay-out" for="decay">30</output><input id="decay" type="range" min="0" max="100" value="30"></div>
  <div class="toggles">
    <button class="toggle" id="slow" type="button" aria-pressed="false">¼ speed</button>
    <button class="toggle" id="mesh" type="button" aria-pressed="false">Show mesh</button>
    <button class="toggle" id="sound" type="button" aria-pressed="false">Sound</button>
    <button class="toggle" id="pause" type="button" aria-pressed="false">Pause</button>
  </div>
  <div class="row"><button class="pill" id="reset-dice" type="button">Reset dice</button><button class="pill" id="reset-view" type="button">Reset view</button></div>
  <p class="fps"><span>Frame rate</span><span id="fps">–</span></p>
</aside>

<section class="bar" aria-label="Dice">
  <div class="colours">
    <span class="group-label" id="colour-label">Candy</span>
    <div class="dice-swatches" role="radiogroup" aria-labelledby="colour-label" id="swatches"></div>
  </div>
  <div class="centre">
    <div class="count" role="radiogroup" aria-label="Number of dice" id="count"></div>
    <button class="roll" id="roll" type="button">Roll <kbd>Space</kbd></button>
  </div>
  <div class="result" aria-live="polite">
    <span class="group-label" id="total-label">Total</span>
    <div class="total" id="total" aria-labelledby="total-label">–</div>
    <div class="values" id="values"></div>
  </div>
</section>

<p class="sr" id="dice-status" role="status" aria-live="polite">Starting.</p>
</div>`;

const STEP = 1 / 60;
// solver tuning (the dice tests run with the same numbers)
const TUNE = { gravity: 18, sleepV: 0.05, landV: 2.2, landHold: 80, landK: 0.3, landKd: 0.03, roll: 0.006, handK: 0.1, handVmax: 5, lra: 1.6,
  releaseV: 2.5, releaseW: 3, releaseKeep: 0.4, stretchMax: 1.6, compressMin: 0.45, tetShare: 0.5, stiffK: 0.3, muS: 0.9, muK: 0.6,
  settleV: 0.04, settleRate: 0.02, clingRelease: 0.45 };
const POKE = { radius: 0.34, depth: 0.09, speed: 2.4, ring: 11 };
// the candies: Beer-Lambert absorption per unit length (thin parts light, the core deep), glow tint
const CANDY = [
  { name: 'Emerald', swatch: '#1f9d63', absorb: [2.6, 0.32, 1.9], glow: [0.25, 1.0, 0.55] },
  { name: 'Amethyst', swatch: '#8b4fc4', absorb: [0.95, 2.8, 0.45], glow: [0.75, 0.35, 1.0] },
  { name: 'Amber', swatch: '#f2a114', absorb: [0.1, 0.75, 3.4], glow: [1.0, 0.62, 0.15] },
  { name: 'Sapphire', swatch: '#2f6fd6', absorb: [3.0, 1.3, 0.22], glow: [0.3, 0.6, 1.0] },
  { name: 'Raspberry', swatch: '#e0345f', absorb: [0.12, 3.0, 1.5], glow: [1.0, 0.25, 0.45] },
  { name: 'Lime', swatch: '#a6d61e', absorb: [1.1, 0.16, 2.8], glow: [0.75, 1.0, 0.2] },
];
const MIXED = [4, 2, 0, 3, 1, 5];   // Raspberry, Amber, Emerald, Sapphire, Amethyst, Lime
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rotAxis = (ax, ang) => {
  const l = Math.hypot(...ax) || 1, [x, y, z] = ax.map((v) => v / l), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [c + t * x * x, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, c + t * y * y, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, c + t * z * z];
};
const mul3 = (A, B) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[3 * i + j] = A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j]; return o; };

/** Soft synthesised squelchy "tup"s, off by default; closed when the dice leave the page. */
function createSound() {
  let ctx = null, master = null, noise = null, on = false;
  function ensure() {
    if (ctx || !window.AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate >> 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tup(k) {
    if (!on || !ctx) return;
    k = Math.max(0.05, Math.min(1, k));
    const t = ctx.currentTime, f0 = 170 + 70 * Math.random();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0 * (1 + 0.4 * k), t); o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * k, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
    // the squelch: a short wet band of noise sweeping down
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    s.buffer = noise; f.type = 'bandpass'; f.Q.value = 3.5;
    f.frequency.setValueAtTime(1500 + 900 * k, t); f.frequency.exponentialRampToValueAtTime(320, t + 0.09);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.12 * k, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    s.connect(f); f.connect(gn); gn.connect(master); s.start(t, Math.random() * 0.1); s.stop(t + 0.12);
  }
  return {
    set(v) { on = v; if (v) { ensure(); ctx && ctx.resume(); } }, tup, get on() { return on; },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
}

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.dice'), $ = (s) => root.querySelector(s);
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const statusEl = $('#dice-status'), reduced = () => stage.reduced.matches;
  const Sound = createSound();
  signal.addEventListener('abort', () => Sound.close());
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before meshing the die

  // ----- the world -----
  const sim = jellySim({ EMBED_BAND: 0.06, EMBED_W: 0.5, rigidFallback: false });
  const geo = DiceGeo.build(sim.embed);
  const world = sim.createWorld(TUNE);
  world.sdf = (p, x, y, z, out) => DiceGeo.sdf(x, y, z, out);
  world.collider = DiceGeo.rimCollider(world);
  const nPer = geo.X.length / 3;
  const placed = (Rm, t, v = [0, 0, 0], w = [0, 0, 0]) => {
    const X = geo.X, x = new Float32Array(3 * nPer), vv = new Float32Array(3 * nPer);
    for (let i = 0; i < nPer; i++) {
      const a = X[3 * i], b = X[3 * i + 1], c = X[3 * i + 2];
      const px = Rm[0] * a + Rm[1] * b + Rm[2] * c, py = Rm[3] * a + Rm[4] * b + Rm[5] * c, pz = Rm[6] * a + Rm[7] * b + Rm[8] * c;
      x[3 * i] = px + t[0]; x[3 * i + 1] = py + t[1]; x[3 * i + 2] = pz + t[2];
      vv[3 * i] = v[0] + w[1] * pz - w[2] * py; vv[3 * i + 1] = v[1] + w[2] * px - w[0] * pz; vv[3 * i + 2] = v[2] + w[0] * py - w[1] * px;
    }
    return { X, tets: geo.tets, cells: geo.cells, x, v: vv };
  };

  const state = { count: 3, colour: -1, phase: 'idle', nudges: [], values: [], showMesh: false, paused: false, slow: false };
  let R = null, acc = 0, prevX = new Float32Array(0), nodes = new Float32Array(0);
  function setPieces(specs) {
    launches = [];   // a new set of dice: no throw still due
    world.grabEnd();
    world.setPieces(specs);
    prevX = new Float32Array(world.x);
    nodes = new Float32Array(world.n * 4);
    if (R) { R.setDice(geo, specs.length); applyColours(); }
    acc = 0;
  }
  // tidy rest positions on the plate, random faces up, a little turned
  function arrangement(N) {
    if (N <= 4) return [...Array(N).keys()].map((i) => [(i - (N - 1) / 2) * 1.3, i % 2 ? -0.25 : 0.2]);
    return [[-1.3, -0.55], [0, -0.6], [1.3, -0.55], [-0.65, 0.7], [0.65, 0.7]];
  }
  function resetDice() {
    const N = state.count, specs = arrangement(N).map(([x, z]) => {
      const Rm = mul3(rotAxis([0, 1, 0], (Math.random() - 0.5) * 0.9), DiceGeo.faceUp(1 + Math.floor(Math.random() * 6)));
      return placed(Rm, [x, 0.505, z]);
    });
    setPieces(specs);
    state.phase = 'dirty'; state.nudges = new Array(N).fill(2);
    showPending(true);
  }
  // A throw from where the dice lie: they pop up one after another, each leaving the plate squashed
  // (its base faster than its top), so it wobbles through a high, tumbling arc to its own spot and
  // lands with the jelly's squash. Launches run on simulation time, so pause and 1/4 speed apply.
  let simT = 0, launches = [];   // [{ d, at, v, w }], in launch order
  function rollDice() {
    if (world.pieces.length !== state.count) resetDice();
    const N = world.pieces.length, calm = reduced(), P = DiceGeo.PLATE, g = TUNE.gravity;
    // landing spots spread over the plate, clear of each other
    const spots = [];
    for (let tries = 0; spots.length < N && tries < 400; tries++) {
      const x = (Math.random() * 2 - 1) * (P.hx - 0.75), z = (Math.random() * 2 - 1) * (P.hz - 0.7);
      if (spots.every(([a, b]) => Math.hypot(a - x, b - z) > 1.25 - tries * 0.002)) spots.push([x, z]);
    }
    world.grabEnd();
    launches = [];
    for (let d = 0; d < N; d++) {
      const pc = world.pieces[d], X = world.x;
      let cx = 0, cy = 0, cz = 0;
      for (let i = pc.start; i < pc.start + pc.count; i++) { cx += X[3 * i]; cy += X[3 * i + 1]; cz += X[3 * i + 2]; }
      cx /= pc.count; cy /= pc.count; cz /= pc.count;
      const [tx, tz] = spots[d] || [cx, cz], T = calm ? 0.45 : 0.62 + Math.random() * 0.2;   // time in the air
      const v = [(tx - cx) / T, (0.5 - cy) / T + 0.5 * g * T, (tz - cz) / T];
      const ax = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], al = Math.hypot(...ax) || 1, spin = (calm ? 4 : 9 + Math.random() * 7) / al;
      launches.push({ d, at: simT + (calm ? 0 : d * 0.07 + Math.random() * 0.04), v, w: ax.map((a) => a * spin), squash: calm ? 0 : 3.2 });
    }
    launches.sort((a, b) => a.at - b.at);
    state.phase = 'rolling'; state.nudges = new Array(N).fill(0);
    showPending(true);
    statusEl.textContent = `Rolling ${N} ${N === 1 ? 'die' : 'dice'}.`;
  }
  function launch(L) {
    const pc = world.pieces[L.d], X = world.x, V = world.v;
    if (!pc) return;
    world.wake(L.d);
    let cx = 0, cy = 0, cz = 0;
    for (let i = pc.start; i < pc.start + pc.count; i++) { cx += X[3 * i]; cy += X[3 * i + 1]; cz += X[3 * i + 2]; }
    cx /= pc.count; cy /= pc.count; cz /= pc.count;
    const [vx, vy, vz] = L.v, [wx, wy, wz] = L.w;
    for (let i = pc.start; i < pc.start + pc.count; i++) {
      const rx = X[3 * i] - cx, ry = X[3 * i + 1] - cy, rz = X[3 * i + 2] - cz;
      V[3 * i] = vx + wy * rz - wz * ry;
      V[3 * i + 1] = vy + wz * rx - wx * rz - L.squash * ry;   // the base leaves first: a squash that rings
      V[3 * i + 2] = vz + wx * ry - wy * rx;
    }
    Sound.tup(0.35);
  }
  /** Launch what is due by simulation time t. */
  function launchDue() {
    while (launches.length && launches[0].at <= simT) launch(launches.shift());
  }
  // When everything sleeps, read each top face. A die resting cocked gets a small nudge (twice at most) first.
  const frames = [];
  function readDice() {
    let nudged = false;
    const vals = [];
    for (let d = 0; d < world.pieces.length; d++) {
      const F = (frames[d] = world.rigidFrame(d, frames[d]));
      const f = DiceGeo.topFace([F.R[3], F.R[4], F.R[5]]);
      if (f.align < 0.94 && state.nudges[d] < 2) { state.nudges[d]++; world.hop(d, reduced() ? 1.4 : 1.9, reduced() ? 2.5 : 4); nudged = true; }
      vals.push(f.value);
    }
    if (nudged) return;
    state.values = vals; state.phase = 'settled';
    showResult(vals);
  }

  // ----- the result -----
  const totalEl = $('#total'), valuesEl = $('#values');
  const candyOf = (d) => CANDY[state.colour < 0 ? MIXED[d % 6] : state.colour];
  function showPending(clear) {   // rolling: an ellipsis; after a poke or a pull: the last result, dimmed
    totalEl.dataset.state = 'rolling';
    if (clear) { totalEl.textContent = '…'; valuesEl.innerHTML = ''; }
  }
  function showResult(vals) {
    const total = vals.reduce((a, b) => a + b, 0);
    totalEl.textContent = String(total); totalEl.dataset.state = 'done';
    valuesEl.innerHTML = vals.map((v, d) => `<span class="v" style="--c:${candyOf(d).swatch}" aria-label="${candyOf(d).name} ${v}">${v}</span>`).join('');
    statusEl.textContent = `Total ${total}: ${vals.join(', ')}.`;
  }
  function applyColours() {
    if (!R) return;
    R.setMaterials([...Array(8).keys()].map((d) => { const c = candyOf(d); return { absorb: c.absorb, density: 1.5, glow: c.glow, haze: 0.05 }; }));
  }

  // ----- UI: swatches, count, roll, settings, keys -----
  const sw = $('#swatches');
  sw.innerHTML = `<button class="dice-swatch mixed" type="button" role="radio" aria-checked="true" data-c="-1" aria-label="Mixed colours" title="Mixed"><span></span></button>` +
    CANDY.map((c, k) => `<button class="dice-swatch" type="button" role="radio" aria-checked="false" data-c="${k}" aria-label="${c.name}" title="${c.name}" style="--c:${c.swatch}"><span></span></button>`).join('');
  const setColour = (c) => {
    state.colour = c;
    for (const b of sw.children) b.setAttribute('aria-checked', String(+b.dataset.c === c));
    applyColours();
    if (state.phase === 'settled') showResult(state.values);
  };
  on(sw, 'click', (e) => { const b = e.target.closest('.dice-swatch'); if (b) setColour(+b.dataset.c); });
  const countEl = $('#count');
  countEl.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${n === state.count}" data-n="${n}" aria-label="${n} ${n === 1 ? 'die' : 'dice'}">${n}</button>`).join('');
  const setCount = (n) => {
    n = Math.max(1, Math.min(5, n | 0));
    for (const b of countEl.children) b.setAttribute('aria-checked', String(+b.dataset.n === n));
    if (n === state.count && world.pieces.length === n) return;
    state.count = n; resetDice();
  };
  on(countEl, 'click', (e) => { const b = e.target.closest('button'); if (b) setCount(+b.dataset.n); });
  for (const g of [sw, countEl]) on(g, 'keydown', (e) => {   // arrow keys move within a radio group
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const items = [...g.children], i = items.indexOf(document.activeElement), j = (i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? items.length - 1 : 1)) % items.length;
    items[j].focus(); items[j].click();
  });
  on($('#roll'), 'click', () => rollDice());
  const settingsBtn = $('#settings-btn'), panel = $('#settings');
  on(settingsBtn, 'click', () => { const open = panel.hidden; panel.hidden = !open; settingsBtn.setAttribute('aria-expanded', String(open)); });
  const soft = $('#soft'), decay = $('#decay');
  const applySliders = () => {
    world.setFirmness(75 - 0.75 * +soft.value); world.setDamping(0.7 * +decay.value);
    $('#soft-out').textContent = soft.value; $('#decay-out').textContent = decay.value;
  };
  on(soft, 'input', applySliders); on(decay, 'input', applySliders); applySliders();
  const toggle = (id, fn) => { const b = $(id); on(b, 'click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); fn(v); }); return b; };
  toggle('#slow', (v) => { state.slow = v; });
  const meshBtn = toggle('#mesh', (v) => { state.showMesh = v; });
  toggle('#sound', (v) => Sound.set(v));
  const pauseBtn = toggle('#pause', (v) => { state.paused = v; stage.status(v ? 'paused' : 'live', v ? 'WebGPU · Paused' : 'WebGPU · Live'); });
  on($('#reset-dice'), 'click', resetDice);
  on($('#reset-view'), 'click', () => resetView());
  on(window, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !R) return;
    const k = e.key, onInput = e.target instanceof HTMLInputElement, onControl = onInput || e.target instanceof HTMLButtonElement;
    if (k === ' ' && !onControl) { e.preventDefault(); rollDice(); }
    else if ((k === 'r' || k === 'R') && !onInput) rollDice();
    else if (k >= '1' && k <= '5' && !onInput) setCount(+k);
    else if (onControl) return;
    else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); cam.yaw = clamp(cam.yaw + (k === 'ArrowLeft' ? 0.08 : -0.08), DEFAULT.yaw - 1.4, DEFAULT.yaw + 1.4); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); cam.pitch = clamp(cam.pitch + (k === 'ArrowUp' ? 0.06 : -0.06), 0.2, 1.35); }
    else if (k === '+' || k === '=') zoomBy(0.9);
    else if (k === '-' || k === '_') zoomBy(1.1);
    else if (k === 'm' || k === 'M') meshBtn.click();
    else if (k === 'p' || k === 'P') pauseBtn.click();
  });

  // ----- camera: framed between the masthead and the bar; drifts toward the dice when none is held -----
  // landscape: along the plate's long side; portrait: turned a quarter so the long side runs up the screen
  const VIEWS = { wide: { yaw: 0, pitch: 0.68 }, tall: { yaw: Math.PI / 2, pitch: 0.92 } };
  const DEFAULT = { yaw: 0, pitch: 0.68, target: [0, 0.25, 0] };
  const cam = { yaw: DEFAULT.yaw, pitch: DEFAULT.pitch, dist: 10, baseDist: 10, zoom: 1, fov: (28 * Math.PI) / 180, target: DEFAULT.target.slice(), shift: [0, 0], drift: [0, 0] };
  let orient = '';
  function frameLayout() {
    if (!R) return;
    const r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
    if (!(w > 0 && h > 0)) return;
    const dpr = window.devicePixelRatio || 1, scale = Math.min(dpr, 2, Math.sqrt(3.0e6 / (w * h)));
    R.resize(Math.round(w * scale), Math.round(h * scale));
    const o = h > w * 1.15 ? 'tall' : 'wide';
    if (o !== orient) { orient = o; Object.assign(DEFAULT, VIEWS[o]); cam.yaw = DEFAULT.yaw; cam.pitch = DEFAULT.pitch; }
    const top = $('.dice-head').getBoundingClientRect().bottom + 4, bottom = $('.bar').getBoundingClientRect().top + 16;
    const cy = top + Math.max(140, bottom - top) * 0.5;
    cam.shift = [0, 1 - (cy / h) * 2];
    cam.baseDist = fitDistance(w / h, 1 - (2 * top) / h, 1 - (2 * bottom) / h);
    cam.dist = cam.baseDist * cam.zoom;
  }
  // The nearest camera distance (default view) at which the plate, and dice standing on its edge, fit the free band.
  function fitDistance(aspect, yTop, yBottom) {
    const P = DiceGeo.PLATE, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-P.thick, 0.9]) pts.push([sx * P.hx, y, sz * P.hz]);
    const fits = (dist) => {
      const cp = Math.cos(DEFAULT.pitch), t = DEFAULT.target, eye = [t[0] + dist * cp * Math.sin(DEFAULT.yaw), t[1] + dist * Math.sin(DEFAULT.pitch), t[2] + dist * cp * Math.cos(DEFAULT.yaw)];
      const L = M4.lookAt(eye, t, [0, 1, 0]), Pm = M4.persp(cam.fov, aspect, 0.1, 80);
      Pm[8] -= cam.shift[0]; Pm[9] -= cam.shift[1];
      const m = M4.mul(Pm, L.m);
      return pts.every(([x, y, z]) => {
        const cw = m[3] * x + m[7] * y + m[11] * z + m[15], nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / cw, ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw;
        return cw > 0 && Math.abs(nx) < 0.95 && ny < yTop && ny > yBottom;
      });
    };
    let lo = 3, hi = 60;
    for (let k = 0; k < 30; k++) { const mid = 0.5 * (lo + hi); if (fits(mid)) hi = mid; else lo = mid; }
    return hi;
  }
  const zoomBy = (f) => { cam.zoom = clamp(cam.zoom * f, 0.45, 1.5); cam.dist = cam.baseDist * cam.zoom; };
  function resetView() { cam.yaw = DEFAULT.yaw; cam.pitch = DEFAULT.pitch; cam.zoom = 1; cam.dist = cam.baseDist; cam.drift = [0, 0]; }
  function driftCamera(dt) {
    if (reduced() || world.grabbing || !world.pieces.length) return;
    let x = 0, z = 0; const X = world.x;
    for (let i = 0; i < world.n; i++) { x += X[3 * i]; z += X[3 * i + 2]; }
    x = clamp(x / world.n, -1.1, 1.1) * 0.6; z = clamp(z / world.n, -0.8, 0.8) * 0.5;
    const k = 1 - Math.exp(-dt * 0.7);
    cam.drift[0] += (x - cam.drift[0]) * k; cam.drift[1] += (z - cam.drift[1]) * k;
  }

  // ----- picking: a ray against each die's rounded box in its best-fit frame (sphere tracing) -----
  const S4 = new Float64Array(4);
  function pickDie(ro, rd) {
    let best = null;
    for (let d = 0; d < world.pieces.length; d++) {
      const F = (frames[d] = world.rigidFrame(d, frames[d])), M = F.R, t = F.t;
      const ox = ro[0] - t[0], oy = ro[1] - t[1], oz = ro[2] - t[2];
      const o = [M[0] * ox + M[3] * oy + M[6] * oz, M[1] * ox + M[4] * oy + M[7] * oz, M[2] * ox + M[5] * oy + M[8] * oz];
      const r = [M[0] * rd[0] + M[3] * rd[1] + M[6] * rd[2], M[1] * rd[0] + M[4] * rd[1] + M[7] * rd[2], M[2] * rd[0] + M[5] * rd[1] + M[8] * rd[2]];
      const b = o[0] * r[0] + o[1] * r[1] + o[2] * r[2], c = o[0] ** 2 + o[1] ** 2 + o[2] ** 2 - 1.1 * 1.1;
      if (b * b - c < 0) continue;   // misses the bounding sphere
      let s = Math.max(0, -b - Math.sqrt(b * b - c));
      for (let k = 0; k < 48; k++) {
        DiceGeo.sdf(o[0] + r[0] * s, o[1] + r[1] * s, o[2] + r[2] * s, S4);
        if (S4[0] < 0.004) {
          if (!best || s < best.s) {   // the surface normal there, in world space
            const n = [M[0] * S4[1] + M[1] * S4[2] + M[2] * S4[3], M[3] * S4[1] + M[4] * S4[2] + M[5] * S4[3], M[6] * S4[1] + M[7] * S4[2] + M[8] * S4[3]];
            best = { d, s, point: [ro[0] + rd[0] * s, ro[1] + rd[1] * s, ro[2] + rd[2] * s], normal: n };
          }
          break;
        }
        s += S4[0];
        if (s > 60) break;
      }
    }
    return best;
  }

  // ----- warm the solver up on a throw, a pull and a poke (so the first real roll runs smoothly), then set out three dice -----
  {
    state.count = 5; rollDice();
    for (let f = 0; f < 70; f++) { simT += STEP; launchDue(); world.step(STEP); }
    world.grabStart(world.x.slice(0, 3), { radius: 0.42 }); world.grabMove([0, 1.5, 0]);
    for (let f = 0; f < 15; f++) world.step(STEP);
    world.grabEnd(); world.poke(world.x.slice(3 * nPer, 3 * nPer + 3), [0, -1, 0], POKE);
    for (let f = 0; f < 15; f++) world.step(STEP);
    world.events.length = 0;
    state.count = 3; resetDice();
  }
  R = await createRenderer(ctx.gpu, canvas);
  R.setDice(geo, world.pieces.length);
  applyColours();
  const ro = new ResizeObserver(frameLayout);
  ro.observe(canvas);
  signal.addEventListener('abort', () => ro.disconnect());
  on(window, 'resize', frameLayout);
  frameLayout();
  statusEl.textContent = 'Three gummy dice on a frosted plate. Press Space to roll.';

  // ----- pointer input: drag a die to stretch it, tap to poke, drag the table to orbit, pinch to zoom -----
  const pointers = new Map();
  let mode = null, plane = null, last = null, hover = null, down = null, pinch = 0;
  const rayAt = (px, py) => { const r = canvas.getBoundingClientRect(); return R.ray(((px - r.left) / r.width) * 2 - 1, 1 - ((py - r.top) / r.height) * 2); };
  on(canvas, 'pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer already left */ }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    e.preventDefault(); canvas.focus({ preventScroll: true });
    if (pointers.size === 2 && mode !== 'grab') {
      const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); mode = 'pinch'; return;
    }
    if (pointers.size > 1) return;
    last = [e.clientX, e.clientY];
    const { ro: o, rd } = rayAt(e.clientX, e.clientY), hit = pickDie(o, rd);
    if (hit && e.button === 0) {
      mode = 'grab'; down = { t: performance.now(), x: e.clientX, y: e.clientY, hit, rd };
      world.grabStart(hit.point, { radius: 0.42, axis: R.look.fwd.slice() });
      plane = { p: hit.point, n: R.look.fwd.slice() };
      canvas.style.cursor = 'grabbing';
      return;
    }
    mode = 'orbit';
  });
  on(canvas, 'pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    hover = [e.clientX, e.clientY];
    if (mode === 'grab') {
      const { ro: o, rd } = rayAt(e.clientX, e.clientY), n = plane.n, p = plane.p, den = rd[0] * n[0] + rd[1] * n[1] + rd[2] * n[2];
      if (Math.abs(den) < 1e-5) return;
      const t = ((p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2]) / den;
      world.grabMove([o[0] + rd[0] * t, Math.max(0.03, o[1] + rd[1] * t), o[2] + rd[2] * t]);
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && d > 0) zoomBy(pinch / d);
      pinch = d;
    } else if (mode === 'orbit' && pointers.size === 1) {
      cam.yaw = clamp(cam.yaw - (e.clientX - last[0]) * 0.005, DEFAULT.yaw - 1.4, DEFAULT.yaw + 1.4);
      cam.pitch = clamp(cam.pitch + (e.clientY - last[1]) * 0.004, 0.2, 1.35);
      last = [e.clientX, e.clientY];
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (mode === 'pinch' && pointers.size === 1) { mode = 'orbit'; last = [...pointers.values()][0]; return; }
    if (pointers.size) return;
    if (mode === 'grab') {
      world.grabEnd();
      const quick = down && performance.now() - down.t < 230 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7;
      if (quick && e.type === 'pointerup') {   // a tap pokes: into the surface, a little along the view
        const n = down.hit.normal, r = down.rd;
        world.poke(down.hit.point, [r[0] * 0.3 - n[0] * 0.7, r[1] * 0.3 - n[1] * 0.7, r[2] * 0.3 - n[2] * 0.7], POKE);
        Sound.tup(0.55);
      }
    }
    mode = null; down = null; canvas.style.cursor = '';
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) on(canvas, ev, release);
  on(canvas, 'pointerleave', () => { if (!mode) hover = null; });
  on(canvas, 'wheel', (e) => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // ----- the loop: fixed 60 Hz steps, interpolated for display -----
  let fpsT = 0, fpsN = 0;
  const fpsEl = $('#fps');
  function stepOnce() {
    prevX.set(world.x);
    simT += STEP; launchDue();
    world.step(STEP);
    if ((state.phase === 'rolling' || state.phase === 'dirty') && !world.grabbing && !launches.length && world.allAsleep()) readDice();
    else if (state.phase === 'settled' && !world.allAsleep()) { state.phase = 'dirty'; showPending(false); }
  }
  function draw(time) {
    const x = world.x, p = prevX, out = nodes, a = Math.min(1, acc / STEP);
    for (let i = 0, n = world.n; i < n; i++) {
      const o = 3 * i, q = 4 * i;
      out[q] = p[o] + (x[o] - p[o]) * a; out[q + 1] = p[o + 1] + (x[o + 1] - p[o + 1]) * a; out[q + 2] = p[o + 2] + (x[o + 2] - p[o + 2]) * a;
    }
    R.setCamera({ ...cam, target: [cam.target[0] + cam.drift[0], cam.target[1], cam.target[2] + cam.drift[1]] });
    R.setFrame({ time, exposure: 1, meshAlpha: state.showMesh ? 0.55 : 0 });
    R.render(out, state.showMesh);
  }
  ctx.frames((dt, t) => {
    if (!state.paused) {
      acc = Math.min(acc + dt * (state.slow ? 0.25 : 1), STEP * 3);
      while (acc >= STEP) { stepOnce(); acc -= STEP; }
    }
    for (const ev of world.events.splice(0)) Sound.tup(Math.min(1, ev.speed / 8));
    driftCamera(dt);
    if (hover && !mode) { const { ro: o, rd } = rayAt(hover[0], hover[1]); canvas.style.cursor = pickDie(o, rd) ? 'grab' : ''; hover = null; }
    draw(t);
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps · ${R.layers} layer${R.layers === 1 ? '' : 's'}`; fpsN = 0; fpsT = 0; }
  });

  // ----- test hook -----
  ctx.hook({
    world, geo, state, camera: cam, renderer: () => R,
    roll: rollDice, setCount, setColour, resetDice, resetView,
    advance(seconds) { for (let i = 0, n = Math.round(seconds / STEP); i < n; i++) stepOnce(); acc = 0; draw(performance.now() / 1000); return { phase: state.phase, values: state.values.slice(), asleep: world.allAsleep() }; },
    pick(x, y) { const { ro: o, rd } = rayAt(x, y); return pickDie(o, rd); },
    project: (p) => { const r = canvas.getBoundingClientRect(); return R.project(p, r.width, r.height); },
    stats: () => world.stats(),
  });
}
