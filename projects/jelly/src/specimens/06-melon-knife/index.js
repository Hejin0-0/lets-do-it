// 06 — Melon Jelly: a gummy watermelon wedge with black seeds. Pull it like jelly,
// cut it like fruit: the nakiri knife drops in, lines up over your stroke and presses through.
import { runJellyPage } from '../../core/jelly/page.js';
import { M4 } from '../../core/math.js';
import { tetSim } from '../../core/cut/tetsim.js';
import { createCutBody } from '../../core/cut/pieces.js';
import { KNIFE_SMALL, MELON_KNIFE_WGSL, knifeMesh, bladeHalf } from '../../core/cut/tools.js';
import { PROPS_WGSL, createProps, instancedPlugin } from '../../core/jelly/plugins.js';
import { SEEDS_WGSL, seedMesh } from '../../core/jelly/seeds.js';
import { createMelon, melonChannels, T as THICK, R, ZC, SKIN, PALE } from './geo.js';

export const meta = {
  id: '06', name: 'Melon Jelly', noun: "specimen", paper: '#e2dfda', fig: "fig. 6",
  eyebrow: "Material Studies / No. 006", title: ["Melon", "Jelly."],
  caption: ["A slice of summer.", "Pull it like jelly.", "Cut it like fruit."],
  aria: "Interactive 3D gummy watermelon slice. With the hand, drag the jelly to stretch it; with the knife, draw a stroke across it to cut it into pieces. Drag the empty floor to turn the view.",
};

export const panel = /* html */`
<div class="group">
  <div class="label" id="tool-label"><span>Tool</span></div>
  <div class="seg" role="radiogroup" aria-labelledby="tool-label">
    <label><input type="radio" name="tool" value="hand" checked><span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 8.6V3.4a1 1 0 0 1 2 0v4.2M7.2 7.4V2.6a1 1 0 0 1 2 0v4.8M9.2 7.4V3.4a1 1 0 0 1 2 0v4.6M11.2 8V5.4a1 1 0 0 1 2 0v4.4c0 2.7-2 4.6-4.6 4.6-1.7 0-2.8-.8-3.7-2.2L3 9.4a1 1 0 0 1 1.6-1.1l.6.8"/></svg>Hand <small>(H)</small></span></label>
    <label><input type="radio" name="tool" value="knife"><span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 10.5h8.6l3.2-3.4c.4-.5 0-1.1-.6-1.1H5.4L1.5 9.4z"/><path d="M10.1 10.5l1.2 1.2c.5.5 1.2.6 1.7.1l1.5-1.5"/></svg>Knife <small>(K)</small></span></label>
  </div>
</div>
<div class="group">
  <div class="label" id="variety-label"><span>Variety</span></div>
  <div class="swatches" role="radiogroup" aria-labelledby="variety-label">
    <label class="swatch"><input type="radio" name="variety" value="crimson" checked><svg viewBox="0 0 44 24" aria-hidden="true"><path d="M22 2 L40.5 21.2 A26 26 0 0 1 3.5 21.2 Z" fill="#3f6b25"/><path d="M22 2.9 L38.9 20.2 A23.6 23.6 0 0 1 5.1 20.2 Z" fill="#e7ebca"/><path d="M22 4 L37.6 19.4 A21.6 21.6 0 0 1 6.4 19.4 Z" fill="#d9303f"/><g fill="#21150e"><ellipse cx="17" cy="13.5" rx="0.8" ry="1.4" transform="rotate(-30 17 13.5)"/><ellipse cx="22" cy="12.4" rx="0.8" ry="1.4"/><ellipse cx="27" cy="13.5" rx="0.8" ry="1.4" transform="rotate(30 27 13.5)"/><ellipse cx="19.5" cy="9" rx="0.7" ry="1.2" transform="rotate(-15 19.5 9)"/><ellipse cx="24.5" cy="9" rx="0.7" ry="1.2" transform="rotate(15 24.5 9)"/></g></svg><span class="name">Crimson</span></label>
    <label class="swatch"><input type="radio" name="variety" value="golden"><svg viewBox="0 0 44 24" aria-hidden="true"><path d="M22 2 L40.5 21.2 A26 26 0 0 1 3.5 21.2 Z" fill="#3a6322"/><path d="M22 2.9 L38.9 20.2 A23.6 23.6 0 0 1 5.1 20.2 Z" fill="#eef0d3"/><path d="M22 4 L37.6 19.4 A21.6 21.6 0 0 1 6.4 19.4 Z" fill="#f0b52a"/><g fill="#1d140e"><ellipse cx="17" cy="13.5" rx="0.8" ry="1.4" transform="rotate(-30 17 13.5)"/><ellipse cx="22" cy="12.4" rx="0.8" ry="1.4"/><ellipse cx="27" cy="13.5" rx="0.8" ry="1.4" transform="rotate(30 27 13.5)"/><ellipse cx="19.5" cy="9" rx="0.7" ry="1.2" transform="rotate(-15 19.5 9)"/><ellipse cx="24.5" cy="9" rx="0.7" ry="1.2" transform="rotate(15 24.5 9)"/></g></svg><span class="name">Golden</span></label>
    <label class="swatch"><input type="radio" name="variety" value="rose"><svg viewBox="0 0 44 24" aria-hidden="true"><path d="M22 2 L40.5 21.2 A26 26 0 0 1 3.5 21.2 Z" fill="#5b853a"/><path d="M22 2.9 L38.9 20.2 A23.6 23.6 0 0 1 5.1 20.2 Z" fill="#f1efd6"/><path d="M22 4 L37.6 19.4 A21.6 21.6 0 0 1 6.4 19.4 Z" fill="#f08896"/><g fill="#3a291e"><ellipse cx="17" cy="13.5" rx="0.8" ry="1.4" transform="rotate(-30 17 13.5)"/><ellipse cx="22" cy="12.4" rx="0.8" ry="1.4"/><ellipse cx="27" cy="13.5" rx="0.8" ry="1.4" transform="rotate(30 27 13.5)"/><ellipse cx="19.5" cy="9" rx="0.7" ry="1.2" transform="rotate(-15 19.5 9)"/><ellipse cx="24.5" cy="9" rx="0.7" ry="1.2" transform="rotate(15 24.5 9)"/></g></svg><span class="name">Rosé</span></label>
  </div>
</div>
<div class="group">
  <label class="label" for="firm"><span>Firmness</span><output id="firm-out" for="firm">50</output></label>
  <input id="firm" type="range" min="0" max="100" value="50" aria-label="Firmness">
  <div class="ends" aria-hidden="true"><span>trembling</span><span>set</span></div>
</div>
<div class="group">
  <label class="label" for="damp"><span>Internal damping</span><output id="damp-out" for="damp">30</output></label>
  <input id="damp" type="range" min="0" max="100" value="30" aria-label="Internal damping">
  <div class="ends" aria-hidden="true"><span>lively</span><span>syrupy</span></div>
</div>
<div class="group row3">
  <button class="btn" id="nudge" type="button">Give it a nudge</button>
  <button class="btn" id="reset" type="button">Reset</button>
  <button class="btn" id="pause" type="button" aria-pressed="false">Pause</button>
</div>
<div class="group checks">
  <label class="check"><input type="checkbox" id="slow">¼ speed</label>
  <label class="check"><input type="checkbox" id="mesh">Show mesh</label>
</div>`;

export const foot = /* html */`
<p class="hint" id="hint">Pull, lift or twist the jelly. Drag the empty floor to look around.</p>
<dl class="readouts">
  <div class="readout"><dt>Mass</dt><dd id="ro-mass">–</dd></div>
  <div class="readout"><dt>Volume</dt><dd id="ro-vol">–</dd></div>
  <div class="readout"><dt>Kinetic</dt><dd id="ro-ke">–</dd></div>
  <div class="readout"><dt>Pieces</dt><dd id="ro-pieces">–</dd></div>
</dl>
<p class="units">Illustrative scale: 1 sim unit ≈ 3.5 cm of gummy at 1.3 g/cm³. Volume is the share of the rest volume still present; gravity and time are eased so the motion reads.</p>`;

export const notes = /* html */`
<h3>The physics</h3>
<p>Each piece is a tetrahedral soft body, stepped sixty times a second in ten small substeps. Every substep pulls each tetrahedron back toward its rest shape after removing its rotation (co-rotational shape matching), keeps its volume, limits how far any edge may stretch and damps only the relative motion along edges, so a fall is never slowed. The rind is stiffer than the flesh. Pieces push each other apart and rest on the floor with friction.</p>
<h3>Cutting</h3>
<p>Every piece is a region of one shared rest plane. Your stroke, read on the surface you drew it over, defines a vertical blade plane; each piece it crosses is split in its own rest frame, every new corner is rounded like the slice's own, and the seeds and bubbles stay only where they still fit. The new pieces are built the moment you let go, then swapped in mid-cut: their particles inherit position and speed from the jelly they came from.</p>
<h3>The knife</h3>
<p>The blade presses first: its rounded edge is a real collider, so the jelly squashes into a groove before it gives. At break-through it continues to the floor while its wedge eases the two new faces apart and holds the lips down; when it lifts, they spring back.</p>
<h3>The light</h3>
<p>Native WebGPU. The surface is skinned to the tetrahedra on the GPU. A back-face pass measures how much jelly each ray crosses for Beer–Lambert absorption; the front refracts the studio, the seeds and the buried part of the blade, with Fresnel and GGX highlights from softboxes. The floor's soft shadow is tinted by light passing through the jelly.</p>`;

// The wedge's look. pal: rind light stripe, rind dark stripe, pale band, seed; prm[0] = (R, centre z,
// skin width, pale width), prm[1] = (thickness, -, -, -).
const HELPERS = /* wgsl */`
// What a rest-space point is made of, from its depth in from the rind arc (rest space, so every cut
// face shows the right layers): green skin, a pale band, then the red flesh.
struct Zones { skin: f32, pale: f32, flesh: f32, dArc: f32, th: f32 };
fn zones(rp: vec3f) -> Zones {
  let q = rp.xz - vec2f(0.0, F.prm[0].y);
  var z: Zones;
  z.dArc = F.prm[0].x - length(q);
  z.th = atan2(q.y, q.x);
  let wob = (vnoise(vec3f(z.th * 12.0, rp.y * 4.0, 0.5)) - 0.5) * 0.024 + (vnoise(vec3f(z.th * 37.0, rp.y * 9.0, 2.5)) - 0.5) * 0.007;
  z.skin = 1.0 - smoothstep(F.prm[0].z - 0.005, F.prm[0].z + 0.005, z.dArc + wob);
  let pe = F.prm[0].z + F.prm[0].w + wob * 2.0;
  z.pale = (1.0 - smoothstep(pe - 0.022, pe + 0.014, z.dArc)) * (1.0 - z.skin);
  z.flesh = max(0.0, 1.0 - z.skin - z.pale);
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

  // Refraction: follow the bent ray to the exit point and look up what is behind it (seeds, knife, floor).
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
  let fib = vnoise(vec3f(z.th * 36.0, (F.prm[0].x - z.dArc) * 4.0, i.rp.y * 3.0));
  let nearRind = smoothstep(F.prm[0].z + F.prm[0].w, F.prm[0].z + F.prm[0].w + 0.2, z.dArc);
  let dens = F.absorb.w * (0.82 + 0.36 * grain) * (0.96 + 0.08 * fib) * mix(0.42, 1.0, nearRind);
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
  let flesh = trans + scat + glow + sparkle;

  // Pale rind: milky, only slightly translucent.
  let paleT = exp(-vec3f(6.0, 4.8, 5.4) * thick);
  let pale = mix(F.pal[2].rgb * (inLight * 0.72 + amb * 0.55), bg * paleT * F.pal[2].rgb * 1.15, 0.22) + F.pal[2].rgb * thinT.g * back * 0.25;

  // Green skin: waxy, striped, nearly opaque.
  let wav = vnoise(vec3f(z.th * 9.0, i.rp.y * 3.0, 1.7)) * 7.0 + vnoise(vec3f(z.th * 32.0, i.rp.y * 14.0, 3.1)) * 2.6;
  let stripe = smoothstep(-0.3, 0.35, sin(z.th * 44.0 + wav));
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
  return 1.0 - (z.skin * 0.9 + z.pale * 0.55);
}
`;

const variety = (absorb, scatter, palette, accent) => ({ absorb, density: 1, scatter, palette, accent, prm: [[R, ZC, SKIN, PALE], [THICK, 0, 0, 0]] });
const PRESETS = {
  crimson: variety([1.1, 8.0, 6.6], [0.92, 0.05, 0.07], ['#5d8c34', '#163b12', '#e7ebca', '#21150e'], '#b8283a'),
  golden: variety([0.17, 0.8, 5.6], [1.0, 0.58, 0.07], ['#567f2f', '#11300e', '#eef0d3', '#1d140e'], '#c48a12'),
  rose: variety([0.24, 2.4, 2.4], [1.0, 0.32, 0.36], ['#7ea653', '#2c5822', '#f1efd6', '#3a291e'], '#c85a74'),
};
const HINTS = {
  hand: 'Pull, lift or twist the jelly; scroll or use a second finger to twist what you hold. Drag the empty floor to look around.',
  knife: 'Draw a stroke across the slice: the blade lines up over it and cuts on release. A drag away from the jelly looks around.',
};
const MESSAGES = {
  cutmiss: 'Missed — draw the blade across the slice.', short: 'Missed — draw the blade across the slice.',
  thin: 'Too thin to cut there.', many: "That's plenty of pieces.",
};
const MAX_PIECES = 14, STEP = 1 / 60, SUBSTEPS = 10;
// Collider: the knife's rounded edge and wedge. The solver turns every position change into velocity
// (v = dx / h), so a collider must never jump a particle far in one substep: pushes are capped (about
// 2 units/s) and spread over a few substeps.
const RP = 0.045, RE = 0.03;  // particle radius for the knife's wedge, rounded-edge radius
const PUSH_CAP = 0.004, SUB_DT = STEP / SUBSTEPS;
const KNIFE_HALF_LEN = KNIFE_SMALL.L / 2, KNIFE_H = KNIFE_SMALL.HB;
const HOVER = 0.42, ROLL = 0.2;   // hover height above the slice; roll toward the viewer while hovering
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
function push(x, i, dx, dy, dz, drag) {
  const l = Math.hypot(dx, dy, dz);
  if (l > PUSH_CAP) { const k = PUSH_CAP / l; dx *= k; dy *= k; dz *= k; }
  x[3 * i] += dx; x[3 * i + 1] += dy + drag; x[3 * i + 2] += dz;
}

export async function mount(ctx) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before meshing the slice
  const G = createMelon();
  let anim = null;   // the running choreography, or null
  const body = createCutBody({
    kernel: G, channels: melonChannels, maxPieces: MAX_PIECES, maxSteps: 3, beforeStep: (dt) => anim?.tick(dt),
    sim: tetSim({ ZC, RIND_R: R - 0.16, SUBSTEPS }),
  });
  const world = body.world, props = createProps({ knife: knifeMesh(KNIFE_SMALL) }, { height: false });

  const Coll = { kind: null, O: [0, 0, 0], D: [1, 0, 0], N: [0, 0, 1], vy: 0, sides: new Int8Array(0) };
  world.collider = (x, v, n) => {
    if (!Coll.kind) return;
    const O = Coll.O, piece = world.piece, sides = Coll.sides, D = Coll.D, N = Coll.N;
    const drag = Coll.vy < 0 ? Coll.vy * SUB_DT : 0;   // a descending tool drags what it touches down with it
    for (let i = 0; i < n; i++) {
      const dx = x[3 * i] - O[0], dz = x[3 * i + 2] - O[2], a = dx * D[0] + dz * D[2];
      if (a < -KNIFE_HALF_LEN - RP || a > KNIFE_HALF_LEN + RP) continue;
      const h = x[3 * i + 1] - O[1], s = dx * N[0] + dz * N[2];
      if (h > KNIFE_H + RP) continue;
      if (h < 0) {   // under the rounded edge: pressed down and aside, a groove before it gives
        const dd = Math.hypot(s, h), lim = RE + RP;
        if (dd >= lim) continue;
        const ns = dd > 1e-6 ? s * lim / dd : 0, nh = dd > 1e-6 ? h * lim / dd : -lim;
        push(x, i, N[0] * (ns - s), nh - h, N[2] * (ns - s), 0);
      } else {        // beside the blade: the wedge eases the faces apart and holds the lips down
        const lim = bladeHalf(KNIFE_SMALL, h) + RP;
        if (Math.abs(s) >= lim) continue;
        const ds = (sides[piece[i]] || (s >= 0 ? 1 : -1)) * lim - s;
        push(x, i, N[0] * ds, 0, N[2] * ds, drag);
      }
    }
  };

  /** The stroke S -> E as a vertical blade plane; each piece it crosses is split in its rest frame. */
  function planCut(S, E) {
    const dx = E[0] - S[0], dz = E[2] - S[2], len = Math.hypot(dx, dz);
    if (len < 0.12) return { ok: false, reason: 'short' };
    const D = [dx / len, 0, dz / len], N = [-D[2], 0, D[0]], x = world.x;
    const crossed = [];
    let top = 0;
    world.pieces.forEach((pc, k) => {
      let pos = false, neg = false;
      for (let i = pc.start; i < pc.start + pc.count; i++) {
        const rx = x[3 * i] - S[0], rz = x[3 * i + 2] - S[2], a = rx * D[0] + rz * D[2];
        if (a < -0.35 || a > len + 0.35) continue;
        const s = rx * N[0] + rz * N[2];
        if (s > 0.02) pos = true; else if (s < -0.02) neg = true;
        if (Math.abs(s) < 0.25 && x[3 * i + 1] > top) top = x[3 * i + 1];
      }
      if (pos && neg) crossed.push(k);
    });
    if (!crossed.length) return { ok: false, reason: 'cutmiss' };
    // A piece the blade only grazes (or that stands on edge, where the blade would slice it flat)
    // stays whole; the cut is refused only when nothing at all can be split.
    const made = [], split = [];
    for (const k of crossed) {
      const f = body.fitFrame(k), Rm = f.R;
      const nr = [Rm[0] * N[0] + Rm[3] * N[1] + Rm[6] * N[2], Rm[1] * N[0] + Rm[4] * N[1] + Rm[7] * N[2], Rm[2] * N[0] + Rm[5] * N[1] + Rm[8] * N[2]];
      const L2 = Math.hypot(nr[0], nr[2]);
      if (L2 < 0.5) continue;
      const d = nr[0] * f.cr[0] + nr[1] * f.cr[1] + nr[2] * f.cr[2] - (N[0] * (f.cx[0] - S[0]) + N[2] * (f.cx[2] - S[2])) - nr[1] * THICK / 2;
      const res = G.splitByLine(body.pieces[k].region, nr[0] / L2, nr[2] / L2, d / L2);
      if (!res.ok) continue;
      split.push(k);
      for (const region of res.pieces) made.push(body.makePiece(region));
    }
    if (!split.length) return { ok: false, reason: 'thin' };
    if (body.pieces.length - split.length + made.length > MAX_PIECES) return { ok: false, reason: 'many' };
    const mid = [(S[0] + E[0]) / 2, 0, (S[2] + E[2]) / 2];
    return { ok: true, kind: 'cut', S, E, D, N, mid, len, top, crossed: new Set(split), made };
  }

  function knifeTools({ R: Rr, state, rayAt, toPx }) {
    const { $, toast, reduced } = ctx.stage, on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ctx.signal });
    const look = Rr.look, tool = { name: 'hand' }, knifeM = new Float32Array(16);
    const knife = { O: [0, 0.3, 0], D: [1, 0, 0], roll: 0, show: false };
    let dropT = 1;   // seconds since the knife was picked up: it drops in from above

    function knifeMatrix() {
      const { O, D, roll } = knife;
      // local x -> D, y -> up rolled toward the viewer by `roll` (about D), z -> x cross y; the edge midpoint sits at O
      const e = look.eye;
      let vx = e[0] - O[0], vz = e[2] - O[2];
      const along = vx * D[0] + vz * D[2]; vx -= D[0] * along; vz -= D[2] * along;
      const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
      const c = Math.cos(roll), s = Math.sin(roll), Y = [vx * s, c, vz * s];
      const Z = [D[1] * Y[2] - D[2] * Y[1], D[2] * Y[0] - D[0] * Y[2], D[0] * Y[1] - D[1] * Y[0]];
      return M4.model([D[0], Y[0], Z[0], D[1], Y[1], Z[1], D[2], Y[2], Z[2]], [O[0] - D[0] * KNIFE_HALF_LEN, O[1], O[2] - D[2] * KNIFE_HALF_LEN], knifeM);
    }
    function startCut(plan) {
      const k = knife, from = { O: k.O.slice(), D: k.D.slice(), roll: k.roll };
      let D = plan.D;
      if (D[0] * look.right[0] + D[2] * look.right[2] < 0) D = [-D[0], 0, -D[2]];   // handle on the left
      const N = [-D[2], 0, D[0]], top = plan.top, hover = top + HOVER, press = Math.max(0.02, top - 0.13);
      // align (0.16 s) -> press: the edge sinks 0.13 into the top and the jelly squashes into a groove (to 0.42 s)
      // -> break-through to the board (0.68 s) -> hold -> lift back to hover (1.1 s)
      const yAt = (t) => t < 0.16 ? lerp(Math.max(from.O[1], top + 0.06), top + 0.06, ease(t / 0.16))
        : t < 0.42 ? lerp(top + 0.06, press, ease((t - 0.16) / 0.26))
        : t < 0.68 ? lerp(press, -0.004, ease((t - 0.42) / 0.26))
        : t < 0.78 ? -0.004 : lerp(-0.004, hover, ease((t - 0.78) / 0.32));
      let t = 0, swapped = false, lastY = yAt(0);
      k.show = true;
      Coll.kind = 'blade'; Coll.D = D; Coll.N = N; Coll.sides = new Int8Array(MAX_PIECES + 1);
      anim = {
        kind: 'cut',
        tick(dt) {
          t += dt;
          const a = ease(t / 0.16);
          k.D = [lerp(from.D[0], D[0], a), 0, lerp(from.D[2], D[2], a)];
          k.roll = lerp(from.roll, 0, a);   // vertical for the cut
          const l = Math.hypot(k.D[0], k.D[2]) || 1; k.D[0] /= l; k.D[2] /= l;
          const y = yAt(t);
          k.O = [lerp(from.O[0], plan.mid[0], a), y, lerp(from.O[2], plan.mid[2], a)];
          Coll.O = [plan.mid[0], y, plan.mid[2]];
          Coll.vy = (y - lastY) / Math.max(dt, 1e-4); lastY = y;
          if (!swapped && t >= 0.42) {
            swapped = true;
            const made = body.swapIn(plan);
            Coll.sides = new Int8Array(MAX_PIECES + 1);
            for (const j of made) {   // which side of the blade each new piece lies on
              const pc = world.pieces[j];
              let s = 0;
              for (let i = pc.start; i < pc.start + pc.count; i++) s += (world.x[3 * i] - plan.mid[0]) * N[0] + (world.x[3 * i + 2] - plan.mid[2]) * N[2];
              Coll.sides[j] = s >= 0 ? 1 : -1;
            }
          }
          if (t >= 0.78) Coll.kind = null;   // lifting: the lips spring back with a jiggle
          if (t >= 1.1) anim = null;
        },
      };
    }

    // ----- controls: the tool, and the variety's accent on the panel -----
    const hint = $('#hint');
    function setTool(t) {
      if (t === 'knife' && tool.name !== 'knife') dropT = reduced.matches ? 1 : 0;
      tool.name = t;
      $(`input[name="tool"][value="${t}"]`).checked = true;
      hint.textContent = HINTS[t];
      ctx.canvas.style.cursor = t === 'hand' ? '' : 'crosshair';
    }
    const accent = () => document.documentElement.style.setProperty('--accent', PRESETS[state.preset].accent);
    document.querySelectorAll('input[name="tool"]').forEach((el) => on(el, 'change', () => setTool(el.value)));
    document.querySelectorAll('input[name="variety"]').forEach((el) => on(el, 'change', () => queueMicrotask(accent)));
    setTool('hand'); accent();

    // ----- the knife guide (a stroke on screen) -----
    const guide = { line: $('#guide-line'), a: $('#guide-a'), b: $('#guide-b') };
    function showGuide(S, E) {
      const r = ctx.canvas.getBoundingClientRect(), pa = Rr.project(S, r.width, r.height), pb = Rr.project(E, r.width, r.height);
      guide.line.setAttribute('x1', pa[0]); guide.line.setAttribute('y1', pa[1]); guide.line.setAttribute('x2', pb[0]); guide.line.setAttribute('y2', pb[1]);
      guide.a.setAttribute('cx', pa[0]); guide.a.setAttribute('cy', pa[1]); guide.b.setAttribute('cx', pb[0]); guide.b.setAttribute('cy', pb[1]);
      for (const el of [guide.line, guide.a, guide.b]) el.setAttribute('visibility', 'visible');
    }
    const hideGuide = () => { for (const el of [guide.line, guide.a, guide.b]) el.setAttribute('visibility', 'hidden'); };
    ctx.signal.addEventListener('abort', hideGuide);

    // ----- the knife's hover poses (between cuts) -----
    let S = null, E = null, stroking = false, hover = null;
    const hoverPt = [0, 0, 0];
    function updateKnife(dt) {
      if (anim) return;
      const k = knife;
      let rx = look.right[0], rz = look.right[2];
      const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      if (tool.name !== 'knife') { k.show = false; return; }
      dropT = Math.min(1, dropT + dt / 0.35);
      if (stroking && S && E) {   // lined up along the stroke, edge just above the jelly, handle on the left
        let dx = E[0] - S[0], dz = E[2] - S[2];
        const l = Math.hypot(dx, dz);
        if (l > 0.05) { dx /= l; dz /= l; if (dx * rx + dz * rz < 0) { dx = -dx; dz = -dz; } k.D = [dx, 0, dz]; }
        k.O = [(S[0] + E[0]) / 2, body.topNear((S[0] + E[0]) / 2, (S[2] + E[2]) / 2, 0.6) + 0.04, (S[2] + E[2]) / 2];
        k.roll = 0;
      } else if (hover) {
        // floating HOVER above the slice, side-on to the camera, rolled a little toward the viewer, with its
        // edge exactly under the cursor: the cursor ray meets the plane at that height
        const { ro, rd } = rayAt(hover[0], hover[1]), L = body.landing(ro, rd);
        const y = body.topNear(L.p[0], L.p[2], 0.8) + HOVER + 1.2 * (1 - ease(dropT));
        const t = Math.abs(rd[1]) > 1e-4 ? (y - ro[1]) / rd[1] : 0;
        if (t > 0) { hoverPt[0] = ro[0] + rd[0] * t; hoverPt[1] = y; hoverPt[2] = ro[2] + rd[2] * t; }
        k.D = [rx, 0, rz]; k.O = hoverPt.slice(); k.roll = ROLL;
      }
      k.show = !!hover || stroking;
    }

    return {
      down(e, { ro, rd }) {
        if (anim) return 'orbit';
        if (tool.name === 'hand') return null;
        const L = body.landing(ro, rd);
        if (!L.onJelly && !body.nearJelly(L.p, 0.7)) return 'orbit';
        S = L.p; E = L.p; stroking = true; showGuide(S, E);
        return 'stroke';
      },
      move(e, { ro, rd }, mode) { E = body.landing(ro, rd).p; showGuide(S, E); return mode; },
      up() {
        stroking = false; hideGuide();
        const plan = planCut(S, E);
        if (anim) { /* a cut is still animating: new strokes are ignored */ }
        else if (plan.ok) startCut(plan); else if (MESSAGES[plan.reason]) toast(MESSAGES[plan.reason]);
      },
      hover(e) { hover = e ? [e.clientX, e.clientY] : null; },
      key(k) { if (k === 'h') setTool('hand'); else if (k === 'k') setTool('knife'); },
      frame(dt) {
        updateKnife(dt);
        props.state.draw.length = 0;
        if (knife.show) { props.state.draw.push('knife'); props.state.A = knifeMatrix(); }
      },
      cursor: () => (tool.name === 'hand' ? '' : 'crosshair'),
      reset() { anim = null; Coll.kind = null; },   // a running cut is cancelled
      hook: {
        anim: () => anim && anim.kind, setTool, toast,
        planCut(sx, sy, ex, ey) {
          const a = toPx(sx, sy), b = toPx(ex, ey), r1 = rayAt(a[0], a[1]), r2 = rayAt(b[0], b[1]);
          return planCut(body.landing(r1.ro, r1.rd).p, body.landing(r2.ro, r2.rd).p);
        },
        startCut(plan) { if (plan && plan.ok && !anim) { setTool('knife'); dropT = 1; startCut(plan); return true; } return false; },
        setVariety(v) { state.preset = v; $(`input[name="variety"][value="${v}"]`).checked = true; accent(); },
      },
    };
  }

  return runJellyPage(ctx, {
    sim: body,
    renderer: {
      paper: '#e2dfda', shadowRadius: 2.8, helpers: HELPERS, material: MATERIAL,
      passes: PROPS_WGSL + MELON_KNIFE_WGSL + SEEDS_WGSL,
      plugins: [props.plugin, instancedPlugin(seedMesh(), 'vsSeed', 'fsSeed')],
    },
    presets: PRESETS, preset: 'crimson',
    camera: { yaw: Math.PI - 0.38, pitch: 0.8, target: [0, 0.12, 0.08], pitchRange: [0.22, 1.3], yawRange: 1.3, fit: [3.1, 3.5], frame: { x0: 0, y0: 0.5, aspect: 1.45 }, zoomRange: [0.62, 1.55] },
    massDigits: 2, keDigits: 2, tools: knifeTools,
  });
}
