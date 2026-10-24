// 08 — Jelly Press: four gummy fruits under a hydraulic press. Hold the red button,
// watch the gauge climb until the jelly bursts, then throw the pieces about. A page of its own design
// (meta.layout 'custom'): its masthead, deck and gauge live in #extra, scoped under .press.
import { createJellyRenderer } from '../../core/jelly/renderer.js';
import { tetSim } from '../../core/cut/tetsim.js';
import { PROPS_WGSL, createProps } from '../../core/jelly/plugins.js';
import { FRUITS, looks, fruitGeo } from './fruits.js';
import { Press, pressMesh } from './press.js';
import { Fracture } from './fracture.js';
import { createSound } from './sound.js';

export const meta = {
  id: '08', name: 'Jelly Press', noun: 'press', paper: '#ece4d6', layout: 'custom',
  eyebrow: 'Material Studies / No. 008', title: ['Jelly', 'Press'], caption: ['Four gummies. One hydraulic press.'],
  aria: 'A hydraulic press over a translucent gummy fruit slice. Hold the red button to lower the press; after the jelly bursts, drag the pieces to grab and throw them, or drag empty space to turn the view.',
};
export const panel = '';
export const foot = '';
export const notes = '';

export const extra = /* html */`
<div class="press">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Instrument+Serif:ital@1&display=swap">
<style>
.extra > .press { --paper: #ece4d6; --ink: #1c1814; --muted: #6f655a; --rule: rgba(28, 24, 20, 0.16); --rule-strong: rgba(28, 24, 20, 0.42); --deck: rgba(236, 228, 214, 0.86); --red: #d42a20; --red-deep: #9e1912; --hazard: #f5c400; --cond: "Oswald", "Arial Narrow", "Helvetica Neue Condensed", Impact, sans-serif; --serif: "Instrument Serif", "Iowan Old Style", Palatino, Georgia, serif; --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color-scheme: light; pointer-events: none; font: 400 14px/1.4 var(--sans); color: var(--ink); }
.press button { font: inherit; color: inherit; }
.press :focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.press .press-head { position: fixed; top: 22px; left: 26px; pointer-events: none; z-index: 2; }
.press .kicker { margin: 0 0 8px; font: 500 12px/1 var(--cond); letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.press .logo { margin: 0; font: 700 clamp(44px, 5vw, 84px)/0.86 var(--cond); letter-spacing: 0.01em; text-transform: uppercase; }
.press .logo .hazard { display: inline-block; padding: 0 0.06em; color: transparent; -webkit-text-stroke: 2px var(--ink); background: repeating-linear-gradient(-45deg, var(--hazard) 0 0.14em, var(--ink) 0.14em 0.28em); -webkit-background-clip: text; background-clip: text; }
.press .sub { margin: 10px 0 0; font: italic 400 19px/1.2 var(--serif); color: var(--muted); }
.press .top { position: fixed; top: 22px; right: 22px; display: flex; gap: 8px; z-index: 3; }
.press .chipbtn { border: 1px solid var(--rule-strong); background: var(--deck); padding: 8px 14px 9px; cursor: pointer; font: 500 13px/1 var(--cond); letter-spacing: 0.12em; text-transform: uppercase; border-radius: 999px; }
.press .chipbtn:hover { background: var(--ink); color: var(--paper); }
.press .chipbtn[aria-pressed="false"] { color: var(--muted); }
.press .deck { position: fixed; left: 0; right: 0; bottom: var(--nav-h, 0px); z-index: 3; padding: 0 24px 18px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 10px 26px; pointer-events: none; }
.press .deck > * { pointer-events: auto; }
.press .press-caption { grid-column: 1 / -1; justify-self: center; min-height: 34px; margin: 0; font: italic 400 28px/1.15 var(--serif); text-align: center; pointer-events: none; }
.press .playline { grid-column: 1 / -1; justify-self: center; display: none; gap: 10px; align-items: center; }
.press .playline .say { font: italic 400 26px/1.1 var(--serif); margin-right: 8px; }
.press .deck[data-mode="play"] .playline { display: flex; }
.press .deck[data-mode="play"] .press-caption { display: none; }
.press .small { border: 1px solid var(--rule-strong); background: var(--deck); padding: 7px 12px 8px; cursor: pointer; font: 500 12px/1 var(--cond); letter-spacing: 0.12em; text-transform: uppercase; }
.press .small:hover { background: var(--ink); color: var(--paper); }
.press .press-readout { justify-self: end; text-align: right; }
.press .press-readout .bar { font: 700 64px/0.9 var(--cond); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.press .press-readout .bar small { font-size: 22px; letter-spacing: 0.06em; margin-left: 4px; color: var(--muted); }
.press .press-readout .lbl { font: 500 12px/1 var(--cond); letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-top: 6px; }
.press .gauge { position: relative; width: 190px; height: 190px; margin-top: 20px; }
.press .gauge svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.press .gauge .track { fill: none; stroke: var(--rule); stroke-width: 9; }
.press .gauge .redzone { fill: none; stroke: var(--red); stroke-width: 9; opacity: 0.35; }
.press .gauge .needle { fill: none; stroke: var(--ink); stroke-width: 9; transition: stroke 0.2s; }
.press .gauge[data-hot="true"] .needle { stroke: var(--red); }
.press .gauge .tick { stroke: var(--ink); stroke-width: 1.2; }
.press .gauge text { font: 500 10px var(--cond); fill: var(--muted); letter-spacing: 0.08em; }
.press .hold { position: absolute; left: 50%; top: 50%; width: 112px; height: 112px; transform: translate(-50%, -50%); border-radius: 50%; border: 0; cursor: pointer; background: radial-gradient(circle at 38% 30%, #ff6a55, var(--red) 46%, var(--red-deep) 100%); color: #fff; font: 700 22px/1 var(--cond); letter-spacing: 0.1em; box-shadow: 0 7px 0 #6d0f0a, 0 12px 22px rgba(80, 12, 6, 0.35), inset 0 -4px 10px rgba(0, 0, 0, 0.25); transition: transform 0.06s, box-shadow 0.06s; touch-action: none; -webkit-user-select: none; user-select: none; }
.press .hold[data-down="true"] { transform: translate(-50%, calc(-50% + 5px)); box-shadow: 0 2px 0 #6d0f0a, 0 5px 12px rgba(80, 12, 6, 0.3), inset 0 -2px 8px rgba(0, 0, 0, 0.3); }
.press .hold:disabled { filter: grayscale(0.7); cursor: default; }
.press .hold small { display: block; font: 500 10px/1 var(--cond); letter-spacing: 0.16em; margin-top: 5px; opacity: 0.85; }
.press .left { justify-self: start; display: grid; gap: 10px; }
.press .raise { justify-self: start; border: 1px solid var(--rule-strong); background: var(--deck); padding: 10px 18px 11px; cursor: pointer; font: 500 14px/1 var(--cond); letter-spacing: 0.14em; text-transform: uppercase; }
.press .raise:hover { background: var(--ink); color: var(--paper); }
.press .chips { display: flex; gap: 6px; flex-wrap: wrap; }
.press .chip { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--rule-strong); background: var(--deck); padding: 6px 11px 6px 7px; cursor: pointer; border-radius: 999px; font: 500 12px/1 var(--cond); letter-spacing: 0.1em; text-transform: uppercase; }
.press .chip svg { width: 22px; height: 22px; }
.press .chip kbd { font: 500 10px/1 var(--mono); color: var(--muted); }
.press .chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.press .chip[aria-pressed="true"] kbd { color: var(--paper); opacity: 0.7; }
.press .verdict { position: fixed; left: 50%; top: 36%; transform: translate(-50%, -50%); text-align: center; z-index: 4; pointer-events: none; opacity: 0; transition: opacity 0.6s; width: max-content; max-width: 92vw; }
.press .verdict[data-show="true"] { opacity: 1; transition: opacity 0.12s; }
.press .verdict .word { font: italic 400 clamp(64px, 11vw, 150px)/0.95 var(--serif); }
.press .verdict .stat { display: inline-block; margin-top: 12px; padding: 7px 14px 8px; background: var(--paper); font: 500 14px/1.3 var(--cond); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
.press .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 760px), (orientation: portrait) and (max-width: 900px) {
  .press .press-head { top: 14px; left: 16px; }
  .press .kicker { font-size: 10px; margin-bottom: 6px; }
  .press .logo { font-size: 36px; }
  .press .sub { font-size: 15px; margin-top: 6px; }
  .press .top { top: 14px; right: 12px; flex-direction: column; align-items: flex-end; }
  .press .chipbtn { padding: 7px 11px 8px; }
  .press .deck { grid-template-columns: 1fr auto; padding: 0 12px 12px; gap: 8px 12px; }
  .press .press-caption { font-size: 22px; min-height: 28px; }
  .press .playline { flex-wrap: wrap; justify-content: center; }
  .press .playline .say { font-size: 20px; width: 100%; text-align: center; margin: 0; }
  .press .gauge { width: 150px; height: 150px; grid-row: 2; grid-column: 2; }
  .press .hold { width: 90px; height: 90px; font-size: 18px; }
  .press .press-readout { grid-row: 2; grid-column: 1; justify-self: start; text-align: left; align-self: center; }
  .press .press-readout .bar { font-size: 46px; }
  .press .left { grid-row: 3; grid-column: 1 / -1; }
  .press .chip, .press .small, .press .raise, .press .chipbtn { min-height: 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .press .hold, .press .verdict { transition: none; }
}
.press .top { pointer-events: auto; }
</style>
<header class="press-head">
  <p class="kicker">Material Studies / No. 008</p>
  <h1 class="logo">Jelly <span class="hazard">Press</span></h1>
  <p class="sub">Four gummies. One hydraulic press.</p>
</header>

<div class="top">
  <button class="chipbtn" id="reset" type="button" title="Reset (R)">Reset</button>
  <button class="chipbtn" id="sound" type="button" aria-pressed="true" title="Sound">Sound on</button>
</div>

<div class="verdict" id="verdict" aria-live="polite"><div class="word" id="verdict-word"></div><div class="stat" id="verdict-stat"></div></div>

<section class="deck" id="deck" data-mode="press" aria-label="Press controls">
  <p class="press-caption" id="press-caption" aria-live="polite">Hold the button.</p>
  <div class="playline"><span class="say">Grab a piece. Throw it.</span><button class="small" id="again" type="button">Press again</button><button class="small" id="next" type="button">Next jelly</button></div>
  <div class="left">
    <button class="raise" id="raise" type="button" title="Raise (↑)">Raise</button>
    <div class="chips" role="group" aria-label="Jelly">
      <button class="chip" type="button" data-fruit="0" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9h20a10 10 0 0 1-20 0z" fill="#3f6b25"/><path d="M3.2 9h17.6a8.8 8.8 0 0 1-17.6 0z" fill="#e7ebca"/><path d="M4.4 9h15.2a7.6 7.6 0 0 1-15.2 0z" fill="#d9303f"/><g fill="#21150e"><ellipse cx="9" cy="12" rx=".7" ry="1.1"/><ellipse cx="12" cy="13.4" rx=".7" ry="1.1"/><ellipse cx="15" cy="12" rx=".7" ry="1.1"/></g></svg>Melon <kbd>1</kbd></button>
      <button class="chip" type="button" data-fruit="1" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9h20a10 10 0 0 1-20 0z" fill="#e8812a"/><path d="M3.4 9h17.2a8.6 8.6 0 0 1-17.2 0z" fill="#f4e9d0"/><path d="M4.4 9h15.2a7.6 7.6 0 0 1-15.2 0z" fill="#f3992e"/><g stroke="#fbe6c0" stroke-width=".8"><path d="M12 9l-4.6 6M12 9l-1.6 7.4M12 9l1.6 7.4M12 9l4.6 6"/></g></svg>Orange <kbd>2</kbd></button>
      <button class="chip" type="button" data-fruit="2" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1.6 0 2.3 1.6 2.3 3 3.7 1.2 6.2 4.8 6.2 8.7a8.5 8.5 0 0 1-17 0c0-3.9 2.5-7.5 6.2-8.7 0-1.4.7-3 2.3-3z" fill="#4a1f3d"/><path d="M12 4.6c.9 0 1.2 1 1.2 1.9 3.4.9 5.8 4 5.8 7.6a7 7 0 0 1-14 0c0-3.6 2.4-6.7 5.8-7.6 0-.9.3-1.9 1.2-1.9z" fill="#efe0c4"/><path d="M12 6.4c3.3.7 5.6 3.9 5.6 7.6a5.6 5.6 0 0 1-11.2 0c0-3.7 2.3-6.9 5.6-7.6z" fill="#e66a8a"/><g fill="#e8b84a"><circle cx="10" cy="13" r=".6"/><circle cx="13.5" cy="12" r=".6"/><circle cx="12" cy="15.5" r=".6"/><circle cx="14.5" cy="15" r=".6"/><circle cx="9.5" cy="16" r=".6"/></g></svg>Fig <kbd>3</kbd></button>
      <button class="chip" type="button" data-fruit="3" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f3c24a"/><circle cx="12" cy="12" r="10" fill="none" stroke="#d99a1c" stroke-width="1.4"/><circle cx="12" cy="12" r="3.1" fill="#ece4d6" stroke="#fbefc4"/><g stroke="#fbe7a0" stroke-width=".6"><path d="M12 5v3.4M12 15.6V19M5 12h3.4M15.6 12H19M7 7l2.3 2.3M14.7 14.7L17 17M17 7l-2.3 2.3M9.3 14.7L7 17"/></g></svg>Pineapple <kbd>4</kbd></button>
    </div>
  </div>
  <div class="gauge" id="gauge" role="meter" aria-label="Pressure" aria-valuemin="0" aria-valuemax="400" aria-valuenow="0" aria-valuetext="0 bar">
    <svg viewBox="0 0 190 190" aria-hidden="true">
      <path class="track" id="g-track"/><path class="redzone" id="g-red"/><path class="needle" id="g-needle"/><g id="g-ticks"></g>
    </svg>
    <button class="hold" id="hold" type="button" aria-label="Hold to press">HOLD<small>space</small></button>
  </div>
  <div class="press-readout"><div class="bar"><span id="bar">0</span><small>bar</small></div><div class="lbl">Pressure</div></div>
</section>

<p class="sr" id="press-status" role="status" aria-live="polite">Starting.</p>
</div>`;

// The jellies' look. pal: skin light, skin dark, the pale layer, inclusions; prm[0] = the fruit's shape,
// prm[1] = (thickness, fruit id, -, -).
const HELPERS = /* wgsl */`
// What a rest-space point is made of: skin, the pale layer, flesh, and inclusions (seeds, membranes,
// fibres). Rest space, so every cut face shows the inside.
struct Zones { skin: f32, pale: f32, flesh: f32, inc: f32, th: f32, depth: f32 };
fn smin2(a: f32, b: f32, k: f32) -> f32 { let h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
fn figSdf(p: vec2f) -> f32 { return smin2(length(p - vec2f(0.0, 0.22)) - 0.74, length(p + vec2f(0.0, 0.68)) - 0.3, 0.55); }
// Watermelon seeds: dark teardrops in two arcs, tips toward the centre, at a few depths.
fn melonSeeds(rp: vec3f) -> f32 {
  let C = vec2f(0.0, F.prm[0].y);
  var m = 0.0;
  for (var k = 0; k < 11; k++) {
    let outer = k >= 5;
    let n = select(5.0, 6.0, outer); let i = select(f32(k), f32(k - 5), outer);
    let th = -PI + (i + 0.5) * PI / n + (hash3(vec3f(f32(k), 1.0, 7.0)) - 0.5) * 0.14;
    let dir = vec2f(cos(th), sin(th));
    let c2 = C + dir * select(0.55, 0.74, outer) * F.prm[0].x;
    let d = rp - vec3f(c2.x, F.prm[1].x * (0.3 + 0.4 * hash3(vec3f(f32(k), 3.0, 1.0))), c2.y);
    let along = dot(d.xz, dir); let side = dot(d.xz, vec2f(-dir.y, dir.x));
    let taper = mix(1.0, 0.45, smoothstep(0.02, -0.05, along));
    m = max(m, 1.0 - smoothstep(0.85, 1.05, length(vec3f(along / 0.055, d.y / 0.022, side / (0.032 * taper)))));
  }
  return m;
}
fn zones(rp: vec3f) -> Zones {
  var z: Zones;
  let id = u32(F.prm[1].y + 0.5);
  if (id == 3u) {   // pineapple ring: no skin; golden flesh with radial fibres, paler toward the hole
    let r = length(rp.xz);
    z.th = atan2(rp.z, rp.x); z.depth = F.prm[0].x - r;
    let core = 1.0 - smoothstep(F.prm[0].y + 0.02, F.prm[0].y + 0.17, r);
    let fib = vnoise(vec3f(z.th * 70.0, r * 2.0, rp.y * 5.0)) * 0.6 + vnoise(vec3f(z.th * 160.0, r * 4.0, rp.y * 11.0)) * 0.4;
    z.skin = 0.0; z.pale = core * 0.75; z.flesh = 1.0 - z.pale;
    z.inc = smoothstep(0.6, 0.8, fib) * (1.0 - core) * 0.55;
    return z;
  }
  var wob: f32;
  if (id == 2u) {   // fig: in from the teardrop outline
    z.depth = -figSdf(rp.xz); z.th = atan2(rp.z, rp.x);
    wob = (vnoise(rp * vec3f(9.0, 4.0, 9.0)) - 0.5) * 0.014;
  } else {          // half-discs: in from the rind arc
    let q = rp.xz - vec2f(0.0, F.prm[0].y);
    z.depth = F.prm[0].x - length(q); z.th = atan2(q.y, q.x);
    wob = (vnoise(vec3f(z.th * 12.0, rp.y * 4.0, 0.5)) - 0.5) * 0.024 + (vnoise(vec3f(z.th * 37.0, rp.y * 9.0, 2.5)) - 0.5) * 0.007;
  }
  z.skin = 1.0 - smoothstep(F.prm[0].z - 0.005, F.prm[0].z + 0.005, z.depth + wob);
  let pe = F.prm[0].z + F.prm[0].w + wob * 2.0;
  z.pale = (1.0 - smoothstep(pe - 0.022, pe + 0.014, z.depth)) * (1.0 - z.skin);
  let inner = max(0.0, 1.0 - z.skin - z.pale);
  z.flesh = inner;
  if (id == 0u) { z.inc = melonSeeds(rp) * inner; }
  else if (id == 1u) {   // orange: five segments, thin white membranes between them, a small pale core
    let r = F.prm[0].x - z.depth;
    let k = clamp(round((z.th + PI) / (PI / 5.0)), 1.0, 4.0);
    let dm = abs(z.th + PI - k * PI / 5.0) * r;
    let core = 1.0 - smoothstep(0.1, 0.16, r);
    z.inc = max((1.0 - smoothstep(0.006, 0.016, dm)) * smoothstep(0.1, 0.18, r), core) * inner;
  } else {               // fig: small golden seeds all through the flesh, denser toward the middle
    let c = cells(rp * 36.0);
    z.inc = (1.0 - smoothstep(0.1, 0.18, c.x)) * step(0.4, c.z) * inner * smoothstep(0.04, 0.3, z.depth);
  }
  return z;
}
`;
const MATERIAL = /* wgsl */`
@fragment fn fsJelly(i: JV) -> @location(0) vec4f {
  let Ng = normalize(i.n);
  let toCam = F.camPos.xyz - i.wp;
  let dF = length(toCam);
  let V = toCam / dF;
  let px = vec2i(i.pos.xy);
  let sceneDist = textureLoad(texA, px, 0).a;
  let dB = textureLoad(texB, px, 0).r;
  let thick = clamp(min(dB, sceneDist) - dF, 0.004, 1.6);
  let z = zones(i.rp);
  // the skin is waxy and finely bumpy; the gel is smooth
  let bump = vec3f(vnoise(i.rp * 90.0), vnoise(i.rp * 90.0 + 7.0), vnoise(i.rp * 90.0 + 13.0)) - 0.5;
  let N = normalize(Ng + bump * (0.12 * z.skin + 0.03 * (1.0 - z.skin)));
  let NdV = clamp(dot(N, V), 0.0, 1.0);
  let R = reflect(-V, N);

  // Refraction: follow the bent ray to the exit point and look up what is behind it (the press, the floor).
  let Rd = refract(-V, N, 1.0 / 1.38);
  let cp = F.viewProj * vec4f(i.wp + Rd * thick, 1.0);
  let uv = cp.xy / cp.w * vec2f(0.5, -0.5) + 0.5;
  let br = (0.8 + 7.0 * thick) * F.screen.zw;
  let rot = fract(52.9829189 * fract(dot(i.pos.xy, vec2f(0.06711056, 0.00583715)))) * 6.2832;

  // Flesh structure in rest space, half-way along the ray, so it travels with the jelly.
  let RdR = rotTo(Ng, normalize(i.rn), Rd);
  let mid = i.rp + RdR * thick * 0.5;
  let grain = vnoise(mid * 21.0) * 0.6 + vnoise(mid * 57.0) * 0.4;
  let cl = cells(i.rp * 24.0 + RdR * thick * 10.0);
  let crystal = 1.0 - smoothstep(0.0, 0.09, cl.y - cl.x);
  let fib = vnoise(vec3f(z.th * 36.0, z.depth * 4.0, i.rp.y * 3.0));
  let nearRind = smoothstep(F.prm[0].z + F.prm[0].w, F.prm[0].z + F.prm[0].w + 0.2, z.depth);
  let zm = zones(mid);   // inclusions seen through the gel, half-way along the ray
  let dens = F.absorb.w * (0.82 + 0.36 * grain) * (0.96 + 0.08 * fib) * mix(0.6, 1.0, nearRind);
  let sigma = F.absorb.rgb * dens;
  var trans = vec3f(0.0); var bg = vec3f(0.0);
  for (var k = 0; k < 6; k++) {
    let a = f32(k) * 1.0472 + rot;
    let s = textureSampleLevel(texA, samp, uv + vec2f(cos(a), sin(a)) * br * (0.45 + 0.11 * f32(k)), 0.0);
    trans += s.rgb * exp(-sigma * clamp(min(dB, s.a) - dF, 0.004, 1.6));   // per tap, capped by the back face
    bg += s.rgb;
  }
  trans /= 6.0; bg /= 6.0;

  // Light inside the gel.
  let wrap = clamp((dot(N, KEY) + 0.55) / 1.55, 0.0, 1.0);
  let amb = env(N, 1.0) * 0.55;
  let inLight = vec3f(1.0, 0.97, 0.93) * 1.5 * wrap + amb;
  let sc = F.scatter.rgb;
  let scat = sc * (1.0 - exp(-thick * 6.0 * F.scatter.w)) * inLight * 0.15;
  let back = pow(clamp(dot(-V, RIM) * 0.5 + 0.5, 0.0, 1.0), 2.0) + 0.6 * pow(clamp(dot(-V, KEY) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  let thinT = exp(-sigma * (thick * 0.6 + 0.015));
  let glow = sc * thinT * back * (0.35 + 1.6 * pow(1.0 - NdV, 2.0)) * 0.5;
  let glint = pow(max(dot(reflect(-V, normalize(Ng + (vec3f(grain, fib, grain * fib) - 0.4) * 0.5)), KEY), 0.0), 40.0);
  let sparkle = crystal * (0.035 + 0.5 * glint) * sc * thinT.r;
  var flesh = trans * (1.0 - 0.55 * zm.inc) + scat + glow + sparkle;
  // inclusions on the surface (and on every cut face): seeds, membranes, fibres
  let incLit = F.pal[3].rgb * (inLight * 0.8 + amb * 0.4) + F.pal[3].rgb * thinT.g * back * 0.2;
  flesh = mix(flesh, incLit, z.inc * 0.9);

  // Pale rind: milky, only slightly translucent.
  let paleT = exp(-vec3f(6.0, 4.8, 5.4) * thick);
  let pale = mix(F.pal[2].rgb * (inLight * 0.72 + amb * 0.55), bg * paleT * F.pal[2].rgb * 1.15, 0.22) + F.pal[2].rgb * thinT.g * back * 0.25;

  // Skin: waxy, nearly opaque; the watermelon's striped, the others mottled.
  let wav = vnoise(vec3f(z.th * 9.0, i.rp.y * 3.0, 1.7)) * 7.0 + vnoise(vec3f(z.th * 32.0, i.rp.y * 14.0, 3.1)) * 2.6;
  let mott = vnoise(i.rp * 14.0) * 0.6 + vnoise(i.rp * 41.0) * 0.4;
  let stripe = select(smoothstep(0.3, 0.75, mott), smoothstep(-0.3, 0.35, sin(z.th * 44.0 + wav)), F.prm[1].y < 0.5);
  let speck = vnoise(i.rp * 150.0);
  let skinCol = mix(F.pal[0].rgb, F.pal[1].rgb, stripe) * (0.86 + 0.28 * speck);
  let skin = skinCol * (clamp(dot(N, KEY), 0.0, 1.0) * 1.25 * vec3f(1.0, 0.98, 0.95) + amb * 0.95) + F.pal[0].rgb * thinT.g * back * 0.12;

  let fres = 0.035 + 0.965 * pow(1.0 - NdV, 5.0);
  let fresS = 0.045 + 0.955 * pow(1.0 - NdV, 5.0);
  let keyI = vec3f(1.0, 0.97, 0.93) * 2.2;
  let cFlesh = flesh * (1.0 - fres) + env(R, 0.04) * fres + keyI * ggx(N, V, KEY, 0.07) * fres;
  let cPale = pale * (1.0 - fres) + env(R, 0.12) * fres + keyI * ggx(N, V, KEY, 0.14) * fres;
  let cSkin = skin * (1.0 - fresS) + (env(R, 0.2) * 0.85 + keyI * ggx(N, V, KEY, 0.25)) * fresS;
  return present(cFlesh * z.flesh + cPale * z.pale + cSkin * z.skin, i.pos.xy);
}
fn clarityAt(rp: vec3f) -> f32 {
  let z = zones(rp);
  return 1.0 - (z.skin * 0.9 + z.pale * 0.55 + z.inc * 0.3);
}
`;
// The floor, with the press's steel bed set into it.
const FLOOR = /* wgsl */`
fn floorShade(P: vec3f) -> vec3f {
  var ao = vec3f(0.0);
  var keyT = vec3f(1.0);
  var contact = 0.0;
  if (length(P.xz - F.shadow.xy) < F.shadow.w) {
    // ambient: projected solid angle of whatever hangs above, tinted by light passing through the gel
    let Rm = 0.5;
    for (var k = 0; k < 24; k++) {
      let fk = f32(k);
      let ra = Rm * pow(fk / 24.0, 1.6); let rb = Rm * pow((fk + 1.0) / 24.0, 1.6);
      let rr = 0.5 * (ra + rb); let an = fk * 2.39996;
      let s = hmap(P.xz + vec2f(cos(an), sin(an)) * rr);
      if (s.r < 50.0) {
        let g2 = (max(s.r, 0.0) + 0.006) * (max(s.r, 0.0) + 0.006);
        let w = g2 / (ra * ra + g2) - g2 / (rb * rb + g2);
        let slant = min(sqrt(rr * rr + g2) / sqrt(g2), 8.0);
        let T = exp(-F.absorb.rgb * F.absorb.w * max(s.a - s.r, 0.0) * slant * 1.1) * s.g * 0.8;
        ao += w * (1.0 - T);
      }
    }
    // key light: PCSS-lite on the light-space map, penumbra widening with blocker distance
    let lc = F.lightMat * vec4f(P, 1.0);
    let luv = vec2f(lc.x * 0.5 + 0.5, 0.5 - lc.y * 0.5);
    let dP = dot(P, KEY);
    var blk = 0.0; var nb = 0.0;
    for (var k = 0; k < 9; k++) {
      let o = select(vec2f(cos(f32(k) * 0.7854), sin(f32(k) * 0.7854)) * 0.022, vec2f(0.0), k == 8);
      let s = textureSampleLevel(texB, samp, luv + o, 0.0);
      if (s.a > dP + 0.01) { blk += s.a - dP; nb += 1.0; }
    }
    if (nb > 0.0) {
      let rad = 0.002 + 0.03 * blk / nb;
      var t = vec3f(0.0);
      for (var k = 0; k < 16; k++) {
        let fk = f32(k);
        let o = vec2f(cos(fk * 2.39996), sin(fk * 2.39996)) * sqrt((fk + 0.5) / 16.0) * rad;
        let s = textureSampleLevel(texB, samp, luv + o, 0.0);
        if (s.a > dP + 0.01) {
          let path = s.a - max(s.r, dP);
          t += exp(-F.absorb.rgb * F.absorb.w * path * 1.1) * mix(1.0, s.g, 0.9) * 0.82;
        } else { t += vec3f(1.0); }
      }
      keyT = t / 16.0;
    }
    for (var k = 0; k < 8; k++) {
      let s = hmap(P.xz + vec2f(cos(f32(k) * 0.7854), sin(f32(k) * 0.7854)) * 0.03);
      contact += select(0.0, 1.0 - smoothstep(0.0, 0.05, s.r), s.r < 50.0);
    }
    contact /= 8.0;
  }
  // a faint pool of light under the specimen, exactly the page colour everywhere else
  let pool = (1.0 + 0.05 * exp(-dot(P.xz - F.shadow.xy, P.xz - F.shadow.xy) * 0.9)) * (1.0 - 0.45 * contact);
  let light = 0.52 * (1.0 - clamp(ao, vec3f(0.0), vec3f(1.0)) * 0.92) + 0.48 * keyT;
  // the press's steel bed, flush with the floor: satin steel with a fine groove round its edge
  let e = vec2f(2.0, 1.3) - abs(P.xz);
  let bed = smoothstep(-0.004, 0.004, min(e.x, e.y));
  let groove = 1.0 - 0.35 * (1.0 - smoothstep(0.01, 0.025, abs(min(e.x, e.y) - 0.05)));
  let steel = vec3f(0.6, 0.62, 0.66) * (0.95 + 0.08 * vnoise(vec3f(P.x * 3.0, 0.0, P.z * 60.0))) * groove;
  return mix(F.base.rgb, steel * 0.8, bed) * pool * light;
}
`;
// The press: the moving platen and ram ride on prop A (materials 10..14), the frame on prop B.
const TOOL_WGSL = /* wgsl */`
fn toolM(m: f32) -> mat4x4f { if (m > 9.5) { return F.propA; } return F.propB; }
fn toolMaterial(m: u32, u: f32, lp: vec3f, N: vec3f) -> ToolMat {
  var base = vec3f(0.62, 0.63, 0.645);
  var rough = 0.3;
  var metal = 1.0;
  if (m == 0u) {          // brushed steel: fine circular streaks
    let s = vnoise(vec3f(length(lp.xz) * 260.0, lp.y * 4.0, 0.5)) * 0.7 + vnoise(vec3f(atan2(lp.z, lp.x) * 30.0, lp.y * 9.0, 3.1)) * 0.3;
    base *= 0.9 + 0.16 * s; rough = 0.22 + 0.1 * s;
  } else if (m == 1u) {   // the bed: satin steel, a little darker
    let s = vnoise(lp * vec3f(60.0, 4.0, 3.0));
    base = vec3f(0.58, 0.59, 0.6) * (0.94 + 0.1 * s); rough = 0.3;
  } else if (m == 2u) {   // chrome
    base = vec3f(0.82, 0.82, 0.83); rough = 0.06;
  } else if (m == 3u) {   // yellow enamel
    base = vec3f(0.86, 0.6, 0.06) * (0.95 + 0.06 * vnoise(lp * 30.0)); rough = 0.32; metal = 0.0;
  } else {                // dark steel bolts and the cylinder's collar
    base = vec3f(0.24, 0.245, 0.25); rough = 0.28;
  }
  return ToolMat(base, rough, metal, N);
}
`;

const STEP = 1 / 60, SUBSTEPS = 8;
const CAPTIONS = [[0, 'Contact.'], [0.1, "It's fine. It's jelly."], [0.22, 'Getting wider.'], [0.33, "That's a pancake now."], [0.43, "It's making a noise."], [0.5, 'Please.']];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));


export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.press'), $ = (s) => root.querySelector(s);
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const deck = $('#deck'), statusEl = $('#press-status'), reduced = () => stage.reduced.matches;
  const Sound = createSound(), timers = new Set();
  const later = (f, ms) => { const id = setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); return id; };
  signal.addEventListener('abort', () => { Sound.close(); for (const id of timers) clearTimeout(id); });
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before meshing the first fruit

  // ----- the fruits' meshes: the first now, the others warmed up in idle time -----
  const sim = tetSim({ SUBSTEPS, STIFF_K: 0.08, COMPRESS_MIN: 0.35, RELEASE_V: 7, PIN: true, ROLL: 0.004 });
  const meshes = [];
  const embedRender = (X, tets, pos, bubbles) => {
    const nb = bubbles.length / 4, pts = new Float32Array(pos.length + nb * 3);
    pts.set(pos);
    for (let b = 0; b < nb; b++) pts.set([bubbles[4 * b], bubbles[4 * b + 1], bubbles[4 * b + 2]], pos.length + 3 * b);
    const e = sim.embed(X, tets, pts), n = pts.length / 3, idx = new Uint32Array(4 * n);
    for (let p = 0; p < n; p++) for (let k = 0; k < 4; k++) idx[4 * p + k] = tets[4 * e.tet[p] + k];
    return { idx, w: e.w };
  };
  function meshFor(i) {
    if (!meshes[i]) {
      const G = fruitGeo(FRUITS[i]), m = G.buildPiece(G.sliceRegion());
      m.render.nrm = Fracture.vertexNormals(m.render.pos, m.render.index);
      m.emb = embedRender(m.sim.X, m.sim.tets, m.render.pos, m.bubbles);
      meshes[i] = m;
    }
    return meshes[i];
  }

  // ----- the world -----
  const world = sim.createWorld(), press = Press.make(world, SUBSTEPS);
  let pieces = [];   // render data per world piece: { pos, nrm, index, bubbles, emb }
  const View = { nv: 0, index: new Uint32Array(0), embIdx: new Uint32Array(0), embW: new Float32Array(0), surf: new Float32Array(0), prev: new Float32Array(0), nodes: new Float32Array(0) };
  function assemble() {
    let nv = 0, nb = 0, nt = 0;
    for (const pc of pieces) { nv += pc.pos.length / 3; nb += pc.bubbles.length / 4; nt += pc.index.length; }
    const np = nv + nb, idx = new Uint32Array(np * 4), w = new Float32Array(np * 4), index = new Uint32Array(nt), rest = new Float32Array(nv * 8), inst = new Float32Array(Math.max(1, nb) * 4);
    let ov = 0, ob = 0, ot = 0;
    pieces.forEach((pc, k) => {
      const start = world.pieces[k].start, pv = pc.pos.length / 3, pb = pc.bubbles.length / 4;
      const put = (l, g) => { for (let c = 0; c < 4; c++) { idx[4 * g + c] = start + pc.emb.idx[4 * l + c]; w[4 * g + c] = pc.emb.w[4 * l + c]; } };
      for (let v = 0; v < pv; v++) { put(v, ov + v); rest.set([pc.pos[3 * v], pc.pos[3 * v + 1], pc.pos[3 * v + 2], 0, pc.nrm[3 * v], pc.nrm[3 * v + 1], pc.nrm[3 * v + 2], 0], 8 * (ov + v)); }
      for (let b = 0; b < pb; b++) { put(pv + b, nv + ob + b); inst[4 * (ob + b)] = pc.bubbles[4 * b + 3]; }
      for (let t = 0; t < pc.index.length; t++) index[ot + t] = ov + pc.index[t];
      ov += pv; ob += pb; ot += pc.index.length;
    });
    const offsets = new Uint32Array(nv + 1);
    for (let t = 0; t < index.length; t++) offsets[index[t] + 1]++;
    for (let i = 0; i < nv; i++) offsets[i + 1] += offsets[i];
    const triangles = new Uint32Array(index.length), cur = offsets.slice(0, nv);
    for (let t = 0; t < index.length; t++) triangles[cur[index[t]]++] = (t / 3) | 0;
    View.nv = nv; View.index = index; View.embIdx = idx; View.embW = w;
    View.surf = new Float32Array(nv * 3); View.prev = new Float32Array(world.x); View.nodes = new Float32Array(world.n * 4);
    return { n: world.n, np, nv, emb: { idx, w }, index, adjacency: { offsets, triangles }, rest, inst, bubbleBase: nv, bubbleCount: nb, edges: world.edges };
  }

  // ----- a round: one jelly on the bed; its burst is planned in the background shortly after -----
  const state = { fruit: 0, phase: 'ready', holding: false, holdKeys: new Set(), breakAt: 0.6, maxBar: 0, plan: null, planTimer: 0, captionIdx: -1, sound: true };
  const F = () => FRUITS[state.fruit];
  const restY = () => F().T + 0.55;
  const captionEl = $('#press-caption'), verdict = $('#verdict');
  let R = null, acc = 0, landed = new Uint8Array(0);
  function startRound(i) {
    state.fruit = i; state.phase = 'ready'; state.holding = false; state.maxBar = 0; state.captionIdx = -1; state.plan = null;
    state.breakAt = 0.52 + Math.random() * 0.14;
    const m = meshFor(i);
    world.grabEnd();
    world.setPieces([{ X: m.sim.X, tets: m.sim.tets }]);
    if (!reduced()) for (let k = 1; k < world.x.length; k += 3) world.x[k] += 0.2;   // a little drop onto the bed
    pieces = [{ pos: m.render.pos, nrm: m.render.nrm, index: m.render.index, bubbles: m.bubbles, emb: m.emb }];
    landed = new Uint8Array(1).fill(1);
    press.reset(restY());
    if (R) R.setMeshes(assemble());
    clearTimeout(state.planTimer);
    const seed = (Math.random() * 2 ** 31) | 0;
    state.planTimer = later(() => { state.plan = planBurst(i, seed); }, 350);
    deck.dataset.mode = 'press';
    verdict.dataset.show = 'false';
    captionEl.textContent = 'Hold the button.';
    for (const c of root.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(+c.dataset.fruit === i));
    statusEl.textContent = `${F().name} jelly on the press.`;
    acc = 0;
  }
  function planBurst(i, seed) {
    const Fr = FRUITS[i], chunks = Fracture.plan(meshFor(i), Fr.T, (x, z, mg) => Fr.sdf(x, z) < -mg, seed);
    for (const c of chunks) c.emb = embedRender(c.X, c.tets, c.pos, c.bubbles);
    return { fruit: i, chunks };
  }
  const squash = () => Math.max(0, 1 - press.st.y / F().T);
  const jellyTop = () => { let m = 0; const x = world.x; for (let k = 1; k < x.length; k += 3) if (x[k] > m && x[k] < press.st.y + 0.05) m = x[k]; return m; };

  function burst() {
    const plan = state.plan && state.plan.fruit === state.fruit ? state.plan : planBurst(state.fruit, (Math.random() * 2 ** 31) | 0);
    const bar = Math.round(state.maxBar), pct = Math.round((press.st.y / F().T) * 100);
    world.replacePieces(plan.chunks.map((c) => ({ X: c.X, tets: c.tets })));
    pieces = plan.chunks.map((c) => ({ pos: c.pos, nrm: c.nrm, index: c.index, bubbles: c.bubbles, emb: c.emb }));
    // kick the pieces out and up from the press; chips faster, higher, tumbling
    const k0 = reduced() ? 0.55 : 1;
    world.pieces.forEach((pc, k) => {
      let cx = 0, cy = 0, cz = 0;
      for (let i = pc.start; i < pc.start + pc.count; i++) { cx += world.x[3 * i]; cy += world.x[3 * i + 1]; cz += world.x[3 * i + 2]; }
      cx /= pc.count; cy /= pc.count; cz /= pc.count;
      const l = Math.hypot(cx, cz) || 1, chip = plan.chunks[k].chip;
      const out = (chip ? 2.6 + Math.random() * 1.6 : 1.4 + Math.random() * 0.6) * k0, up = (chip ? 1.6 + Math.random() * 1.0 : 0.6 + Math.random() * 0.4) * k0;   // mostly sideways: the platen is still right above
      const spin = chip ? [(Math.random() - 0.5) * 14 * k0, (Math.random() - 0.5) * 10 * k0, (Math.random() - 0.5) * 14 * k0] : [0, 0, 0];
      for (let i = pc.start; i < pc.start + pc.count; i++) {
        const rx = world.x[3 * i] - cx, ry = world.x[3 * i + 1] - cy, rz = world.x[3 * i + 2] - cz;
        world.v[3 * i] += (cx / l) * out + spin[1] * rz - spin[2] * ry;
        world.v[3 * i + 1] += up + spin[2] * rx - spin[0] * rz;
        world.v[3 * i + 2] += (cz / l) * out + spin[0] * ry - spin[1] * rx;
      }
    });
    R.setMeshes(assemble());
    landed = new Uint8Array(world.pieces.length).fill(1);
    state.phase = 'play'; setHolding(false);
    press.raise(restY() + 0.5);
    Sound.clunkLater(450);
    Sound.burst();
    showVerdict(F().verdict, `Gave up at ${bar} bar and ${pct}% of its height.`);
    deck.dataset.mode = 'play';
    captionEl.textContent = 'Grab a piece. Throw it.';
    statusEl.textContent = `${F().verdict} The ${F().name.toLowerCase()} jelly burst into ${world.pieces.length} pieces.`;
  }

  // ----- UI: the dial and the verdict -----
  const gauge = $('#gauge'), needle = $('#g-needle'), barEl = $('#bar');
  const A0 = (225 * Math.PI) / 180, A1 = (-45 * Math.PI) / 180, GR = 82, GC = 95;
  const arcPt = (a) => [GC + GR * Math.cos(a), GC - GR * Math.sin(a)];
  const arc = (v0, v1) => { const a0 = A0 + (A1 - A0) * v0, a1 = A0 + (A1 - A0) * v1, p0 = arcPt(a0), p1 = arcPt(a1); return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}A${GR} ${GR} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`; };
  $('#g-track').setAttribute('d', arc(0, 1)); $('#g-red').setAttribute('d', arc(0.8, 1));
  {
    let ticks = '';
    for (let b = 0; b <= 400; b += 50) {
      const a = A0 + (A1 - A0) * (b / 400), c = Math.cos(a), s = Math.sin(a), r0 = GR + 7, r1 = GR + (b % 100 ? 11 : 15);
      ticks += `<line class="tick" x1="${(GC + r0 * c).toFixed(1)}" y1="${(GC - r0 * s).toFixed(1)}" x2="${(GC + r1 * c).toFixed(1)}" y2="${(GC - r1 * s).toFixed(1)}"/>`;
      if (b % 100 === 0) ticks += `<text x="${(GC + (GR + 26) * c).toFixed(1)}" y="${(GC - (GR + 26) * s + 3).toFixed(1)}" text-anchor="middle">${b}</text>`;
    }
    $('#g-ticks').innerHTML = ticks;
  }
  let shownBar = 0;
  function updateDial(bar) {
    shownBar += (bar - shownBar) * 0.25;
    const v = Math.max(0, Math.min(1, shownBar / 400)), b = Math.round(shownBar);
    needle.setAttribute('d', v > 0.002 ? arc(0, v) : '');
    barEl.textContent = String(b);
    gauge.dataset.hot = String(shownBar > 320);
    gauge.setAttribute('aria-valuenow', String(b)); gauge.setAttribute('aria-valuetext', `${b} bar`);
  }
  let verdictTimer = 0;
  function showVerdict(word, stat) {
    $('#verdict-word').textContent = word; $('#verdict-stat').textContent = stat;
    verdict.dataset.show = 'true';
    clearTimeout(verdictTimer); verdictTimer = later(() => { verdict.dataset.show = 'false'; }, 2500);
  }

  // ----- controls -----
  const holdBtn = $('#hold');
  function setHolding(v) {
    state.holding = v; holdBtn.dataset.down = String(v);
    if (v && state.phase === 'ready') state.phase = 'pressing';
    if (v) press.st.target = press.st.y;   // holding cancels a raise
  }
  const letGo = () => { if (state.holding) { setHolding(false); Sound.clunk(); } };
  on(holdBtn, 'pointerdown', (e) => { Sound.unlock(); e.preventDefault(); try { holdBtn.setPointerCapture(e.pointerId); } catch { /* fine */ } setHolding(true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) on(holdBtn, ev, () => { if (state.holdKeys.size === 0) letGo(); });
  on(holdBtn, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); e.stopPropagation(); Sound.unlock(); setHolding(true); } });
  on(holdBtn, 'keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); letGo(); } });
  on(holdBtn, 'contextmenu', (e) => e.preventDefault());
  const raise = () => { setHolding(false); press.raise(restY()); };
  on($('#raise'), 'click', () => { Sound.unlock(); raise(); });
  on($('#reset'), 'click', () => { Sound.unlock(); startRound(state.fruit); });
  on($('#again'), 'click', () => startRound(state.fruit));
  on($('#next'), 'click', () => startRound((state.fruit + 1) % FRUITS.length));
  for (const c of root.querySelectorAll('.chip')) on(c, 'click', () => { Sound.unlock(); startRound(+c.dataset.fruit); });
  const soundBtn = $('#sound');
  on(soundBtn, 'click', () => { Sound.unlock(); state.sound = !state.sound; Sound.set(state.sound); soundBtn.setAttribute('aria-pressed', String(state.sound)); soundBtn.textContent = state.sound ? 'Sound on' : 'Sound off'; });
  on(window, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === ' ' || k === 'ArrowDown') {
      if (k === ' ' && e.target instanceof HTMLButtonElement) return;   // Space clicks the focused button
      e.preventDefault(); Sound.unlock();
      if (!state.holdKeys.has(k)) { state.holdKeys.add(k); setHolding(true); }
    } else if (k === 'ArrowUp') { e.preventDefault(); Sound.unlock(); raise(); }
    else if (k === 'r' || k === 'R') { Sound.unlock(); startRound(state.fruit); }
    else if (k >= '1' && k <= '4') { Sound.unlock(); startRound(+k - 1); }
  });
  on(window, 'keyup', (e) => { if (state.holdKeys.delete(e.key) && state.holdKeys.size === 0) letGo(); });
  on(window, 'blur', () => { state.holdKeys.clear(); setHolding(false); });

  // ----- renderer: the shared jelly passes, the fruits' material, the press as a prop -----
  startRound(0);
  const props = createProps({ press: pressMesh() }, { height: false });
  props.state.draw.push('press');
  props.state.B = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);   // the fixed parts sit where they were modelled
  const platen = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  R = await createJellyRenderer(ctx.gpu, canvas, {
    paper: meta.paper, helpers: HELPERS, material: MATERIAL, replace: { floorShade: FLOOR },
    passes: PROPS_WGSL + TOOL_WGSL, plugins: [props.plugin],
  });
  R.setMeshes(assemble());

  // ----- camera: low, at bench level; framed between the masthead and the deck -----
  const DEFAULT = { yaw: 0, pitch: 0.3, target: [0, 0.42, 0] };
  const cam = { yaw: DEFAULT.yaw, pitch: DEFAULT.pitch, dist: 8, baseDist: 8, zoom: 1, fov: (30 * Math.PI) / 180, target: DEFAULT.target.slice(), shift: [0, 0] };
  function frameLayout() {
    const r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
    if (!(w > 0 && h > 0)) return;
    const dpr = window.devicePixelRatio || 1, scale = Math.min(dpr, 2, Math.sqrt(2.6e6 / (w * h)));
    R.resize(Math.round(w * scale), Math.round(h * scale));
    const top = $('.press-head').getBoundingClientRect().bottom + 6, bottom = deck.getBoundingClientRect().top + 30;
    const avail = Math.max(120, bottom - top), cy = top + avail * (h > w ? 0.74 : 0.5);   // portrait: the jelly low, the whole press above it
    cam.shift = [0, 1 - (cy / h) * 2];
    // the press is ~4.4 wide; the stage needs ~2.6 of height around the jelly
    const fitW = 4.6 / (2 * Math.tan(cam.fov / 2) * (w / h)), fitH = (2.6 * (h / avail)) / (2 * Math.tan(cam.fov / 2));
    cam.baseDist = clamp(Math.max(fitW, fitH), 4, 24);
    cam.dist = cam.baseDist * cam.zoom;
  }
  const resetView = () => { cam.yaw = DEFAULT.yaw; cam.pitch = DEFAULT.pitch; cam.zoom = 1; cam.dist = cam.baseDist; cam.target = DEFAULT.target.slice(); };
  const ro = new ResizeObserver(frameLayout);
  ro.observe(canvas);
  signal.addEventListener('abort', () => ro.disconnect());
  on(window, 'resize', frameLayout);
  frameLayout();

  // ----- picking on the skinned surface, with a forgiving fallback for touch -----
  function skinSurface() {
    const s = View.surf, I = View.embIdx, W = View.embW, x = world.x;
    for (let p = 0; p < View.nv; p++) {
      let px = 0, py = 0, pz = 0;
      for (let k = 0; k < 4; k++) { const o = 3 * I[4 * p + k], wk = W[4 * p + k]; px += x[o] * wk; py += x[o + 1] * wk; pz += x[o + 2] * wk; }
      s[3 * p] = px; s[3 * p + 1] = py; s[3 * p + 2] = pz;
    }
    return s;
  }
  function pickJelly(ro, rd, forgiving) {
    const sp = skinSurface(), tri = View.index;
    let best = Infinity;
    for (let t = 0; t < tri.length; t += 3) {
      const a = 3 * tri[t], b = 3 * tri[t + 1], c = 3 * tri[t + 2];
      const e1x = sp[b] - sp[a], e1y = sp[b + 1] - sp[a + 1], e1z = sp[b + 2] - sp[a + 2], e2x = sp[c] - sp[a], e2y = sp[c + 1] - sp[a + 1], e2z = sp[c + 2] - sp[a + 2];
      const px = rd[1] * e2z - rd[2] * e2y, py = rd[2] * e2x - rd[0] * e2z, pz = rd[0] * e2y - rd[1] * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const id = 1 / det, tx = ro[0] - sp[a], ty = ro[1] - sp[a + 1], tz = ro[2] - sp[a + 2], u = (tx * px + ty * py + tz * pz) * id;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (rd[0] * qx + rd[1] * qy + rd[2] * qz) * id;
      if (v < 0 || u + v > 1) continue;
      const d = (e2x * qx + e2y * qy + e2z * qz) * id;
      if (d > 0 && d < best) best = d;
    }
    if (best < Infinity) return [ro[0] + rd[0] * best, ro[1] + rd[1] * best, ro[2] + rd[2] * best];
    if (!forgiving) return null;
    const x = world.x; let bi = -1, bd = 0.22 * 0.22;   // the particle nearest the ray, if it passes close
    for (let i = 0; i < world.n; i++) {
      const dx = x[3 * i] - ro[0], dy = x[3 * i + 1] - ro[1], dz = x[3 * i + 2] - ro[2], t = dx * rd[0] + dy * rd[1] + dz * rd[2];
      if (t <= 0) continue;
      const d2 = dx * dx + dy * dy + dz * dz - t * t;
      if (d2 < bd) { bd = d2; bi = i; }
    }
    return bi < 0 ? null : [x[3 * bi], x[3 * bi + 1], x[3 * bi + 2]];
  }

  // ----- pointer input: grab pieces in play; anything else orbits -----
  const pointers = new Map();
  let mode = null, plane = null, last = null, hover = null;
  const rayAt = (px, py) => { const r = canvas.getBoundingClientRect(); return R.ray(((px - r.left) / r.width) * 2 - 1, 1 - ((py - r.top) / r.height) * 2); };
  on(canvas, 'pointerdown', (e) => {
    Sound.unlock();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer already left */ }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    e.preventDefault();
    if (pointers.size > 1) return;
    last = [e.clientX, e.clientY];
    if (state.phase === 'play' && e.button === 0) {
      const { ro, rd } = rayAt(e.clientX, e.clientY), hit = pickJelly(ro, rd, e.pointerType !== 'mouse');
      if (hit) {
        mode = 'grab'; world.grabStart(hit, { radius: 0.4, axis: R.look.fwd.slice() }); plane = { p: hit, n: R.look.fwd.slice() };
        canvas.style.cursor = 'grabbing'; Sound.squelch(0.6); return;
      }
    }
    mode = 'orbit';
  });
  on(canvas, 'pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    hover = [e.clientX, e.clientY];
    if (mode === 'grab') {
      const { ro, rd } = rayAt(e.clientX, e.clientY), n = plane.n, p = plane.p, den = rd[0] * n[0] + rd[1] * n[1] + rd[2] * n[2];
      if (Math.abs(den) < 1e-5) return;
      const t = ((p[0] - ro[0]) * n[0] + (p[1] - ro[1]) * n[1] + (p[2] - ro[2]) * n[2]) / den;
      world.grabMove([ro[0] + rd[0] * t, Math.max(0.02, ro[1] + rd[1] * t), ro[2] + rd[2] * t]);
    } else if (mode === 'orbit' && pointers.size === 1) {
      cam.yaw = clamp(cam.yaw - (e.clientX - last[0]) * 0.005, -1.2, 1.2);
      cam.pitch = clamp(cam.pitch + (e.clientY - last[1]) * 0.004, 0.08, 1.2);
      last = [e.clientX, e.clientY];
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size) return;
    if (mode === 'grab') world.grabEnd();   // the piece keeps the hand's speed: a throw
    mode = null; canvas.style.cursor = '';
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) on(canvas, ev, release);
  on(canvas, 'pointerleave', () => { if (!mode) hover = null; });
  on(canvas, 'wheel', (e) => { e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(e.deltaY * 0.0012), 0.55, 1.6); cam.dist = cam.baseDist * cam.zoom; }, { passive: false });
  on(canvas, 'dblclick', resetView);

  // ----- the loop: fixed 60 Hz steps with an accumulator, interpolated for display -----
  let creakT = 0, lastBar = 0;
  function stepOnce() {
    View.prev.set(world.x);
    press.step(STEP, state.holding, jellyTop());
    world.step(STEP);
    const bar = press.st.load * F().barPerLoad;
    if (state.phase === 'pressing') {
      state.maxBar = Math.max(state.maxBar, bar);
      if (squash() >= state.breakAt && press.st.touching) burst();
    } else if (state.phase === 'play') {
      // landings: a piece that comes down hard onto the bed goes plop
      world.pieces.forEach((pc, k) => {
        let low = Infinity, vy = 0;
        for (let i = pc.start; i < pc.start + pc.count; i++) { low = Math.min(low, world.x[3 * i + 1]); vy += world.v[3 * i + 1]; }
        vy /= pc.count;
        if (low > 0.04) landed[k] = 0;
        else if (!landed[k]) { landed[k] = 1; if (vy < -0.4) Sound.plop(Math.min(1, 0.3 + Math.abs(vy) * 0.25)); }
      });
    }
    return bar;
  }
  const centre = [0, 0, 0];
  const LIGHT = { centre: [0, 0.4, -0.2], half: 4.2 }, SHADOW = [0, -0.2, 3.6, 3.9];   // the light map covers the press and the stage
  function draw(time) {
    const x = world.x, p = View.prev, out = View.nodes, a = Math.min(1, acc / STEP);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < world.n; i++) {
      const o = 3 * i, q = 4 * i;
      out[q] = p[o] + (x[o] - p[o]) * a; out[q + 1] = p[o + 1] + (x[o + 1] - p[o + 1]) * a; out[q + 2] = p[o + 2] + (x[o + 2] - p[o + 2]) * a;
      cx += out[q]; cy += out[q + 1]; cz += out[q + 2];
    }
    centre[0] = cx / world.n; centre[1] = cy / world.n; centre[2] = cz / world.n;
    R.setCamera(cam);
    R.setLook({ time, showMesh: false, centre, shadow: SHADOW, light: LIGHT, ...looks[state.fruit] });
    platen[13] = press.st.y; props.state.A = platen;
    R.render(out, false);
  }
  function updateUI(dt) {
    const sq = squash(), touching = press.st.touching;
    updateDial(touching ? lastBar : 0);
    if (state.phase === 'pressing' && touching) {
      let idx = 0;
      for (let c = 1; c < CAPTIONS.length; c++) if (sq >= CAPTIONS[c][0]) idx = c;
      if (idx > state.captionIdx) { state.captionIdx = idx; captionEl.textContent = CAPTIONS[idx][1]; Sound.squelch(0.4 + idx * 0.1); }
    }
    Sound.motor(state.holding || press.st.vy > 0 ? 1 : 0, Math.min(1, lastBar / 400));
    creakT -= dt;
    if (state.holding && lastBar > 200 && creakT < 0) { creakT = 0.5 + Math.random() * 0.9; Sound.creak(); }
  }
  ctx.frames((dt, t) => {
    acc = Math.min(acc + dt, STEP * 3);
    while (acc >= STEP) { lastBar = stepOnce(); acc -= STEP; }
    updateUI(dt);
    if (hover && !mode && state.phase === 'play') { const { ro, rd } = rayAt(hover[0], hover[1]); canvas.style.cursor = pickJelly(ro, rd, false) ? 'grab' : ''; hover = null; }
    else if (!mode && state.phase !== 'play') canvas.style.cursor = '';
    draw(t);
  });

  // the other fruits are meshed in idle time, so switching fruit is instant
  const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f) : (f) => later(f, 60);
  for (let i = 1; i < FRUITS.length; i++) idle(() => { if (!signal.aborted) meshFor(i); });

  // ----- test hook: drive the press deterministically -----
  ctx.hook({
    world, press, state, camera: cam, pieces: () => pieces,
    advance(seconds, hold = false) {
      if (hold) setHolding(true);
      for (let i = 0, n = Math.round(seconds / STEP); i < n; i++) lastBar = stepOnce();
      if (hold) setHolding(false);
      acc = 0; updateUI(0); draw(performance.now() / 1000);
      return { phase: state.phase, squash: squash(), bar: lastBar, pieces: world.pieces.length, y: press.st.y };
    },
    pick(x, y) { const { ro, rd } = rayAt(x, y); return pickJelly(ro, rd, true); },
    project: (p) => { const r = canvas.getBoundingClientRect(); return R.project(p, r.width, r.height); }, squash,
    startRound, raise, resetView, planned: () => !!state.plan,
    stats: () => world.stats(),
  });
}
