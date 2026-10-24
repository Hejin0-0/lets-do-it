// 05 — Whole Melon: thirty-two centimetres of glossy jelly watermelon. Pull it, wobble
// it, cut it into pieces with the melon knife: every cut is meshed in the background a few
// milliseconds a frame while the blade presses its groove, then the new pieces swap in mid-motion.
import { runJellyPage } from '../../core/jelly/page.js';
import { jellySim } from '../../core/jellysim.js';
import { KNIFE_SMALL, MELON_KNIFE_WGSL, knifeMesh, bladeHalf as bladeHalfAt } from '../../core/cut/tools.js';
import { PROPS_WGSL, createProps, instancedPlugin } from '../../core/jelly/plugins.js';
import { SEEDS_WGSL, seedMesh } from '../../core/jelly/seeds.js';
import { WholeMelon } from './melon.js';

export const meta = {
  id: '05', name: 'Whole Melon', noun: "specimen", paper: '#e2dfda', fig: "fig. 5",
  eyebrow: "Material Studies / No. 005", title: ["Whole", "Melon."],
  caption: ["Thirty-two centimetres of glossy jelly.", "Pull it, wobble it.", "Cut it into pieces."],
  aria: "Interactive 3D jelly watermelon. With the hand, drag a piece to pull it, scroll or use a second finger to twist it; with the knife, draw a line across the melon to cut it into pieces. Drag the empty table to turn the view.",
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
<p class="hint" id="hint">Pull, lift or twist a piece. Drag the empty table to look around.</p>
<dl class="readouts">
  <div class="readout"><dt>Mass</dt><dd id="ro-mass">–</dd></div>
  <div class="readout"><dt>Volume</dt><dd id="ro-vol">–</dd></div>
  <div class="readout"><dt>Kinetic</dt><dd id="ro-ke">–</dd></div>
  <div class="readout"><dt>Pieces</dt><dd id="ro-pieces">–</dd></div>
</dl>
<p class="units">Illustrative scale: 1 sim unit = 10 cm of jelly at 0.96 g/cm³; the melon is 32 cm long. Volume is the share of the rest volume still present; gravity is eased so the motion reads.</p>`;

export const notes = /* html */`
<h3>The physics</h3>
<p>Each piece is a lattice of eight-node cells laid along its principal axes, its outer nodes snapped onto the surface, every cell split into five tetrahedra. Sixty times a second, in six small substeps, each cell is pulled back toward its rest shape after its rotation is removed (warm-started co-rotational shape matching that stiffens as it strains), every tetrahedron keeps its volume, and no edge may stretch past its limit. The rind is firmer than the flesh. Damping acts on the edges and on each piece's deformation relative to its rigid motion, never on its fall or tumble; a piece rolls to a stop on the table and sleeps when calm.</p>
<h3>Cutting</h3>
<p>Every piece is the melon's signed distance field, clipped by the half-spaces of the cuts that made it, with the fresh edges rounded by a smooth maximum; all pieces share the melon's rest frame, so rind, stripes and seeds stay where they grew. Your stroke, read on top of what it crosses, sets a vertical blade plane; each piece it passes through is fitted with its best rotation, the plane is carried into rest space, and the piece is split in two. The new pieces are meshed a few milliseconds at a time while the knife lines up and presses a groove, and swapped in the moment the edge breaks through, inheriting the position and speed of the flesh they came from. Seeds are meshed only near cut faces; one the knife goes through stays with one side, just under the new face.</p>
<h3>Contact</h3>
<p>Pieces push each other out of their exact distance fields, each posed by its best-fit frame, with friction; sleeping pieces act as walls. The table has Coulomb friction.</p>
<h3>The light</h3>
<p>Native WebGPU. A compute pass averages each node's deformation gradient and skins the surface with normals from its cofactor. A back-face pass measures the jelly each ray crosses for Beer–Lambert absorption; the front refracts the studio, the seeds, the bubbles and the buried blade, with milky scattering in the pith, a back-lit glow at thin edges, sugar glints, Fresnel reflections and GGX highlights. The key shadow is tinted by what the light crossed: rosy through flesh, dark through rind.</p>`;

// The melon's look. pal: rind light stripe, rind dark stripe, the pale band, seed. Its own studio: the
// key light overhead, a strip behind on the left, a cool fill card, and a paper sweep behind the table.
const HELPERS = /* wgsl */`
// The whole melon, in rest space (so every cut face shows the right layers): its field, and what a point is
// made of by depth under the skin; the stripes run pole to pole around the long axis, seamless all the way round.
const MA = vec3f(${WholeMelon.A}, ${WholeMelon.B}, ${WholeMelon.C});
const BELLY = ${WholeMelon.BELLY}; const BELLY_K = ${WholeMelon.BELLY_K};
const SKINW = ${WholeMelon.SKIN}; const PITHW = ${WholeMelon.PITH};
fn melonSdf(p: vec3f) -> f32 {
  let k0 = length(p / MA); let k1 = max(length(p / (MA * MA)), 1e-9);
  let a = k0 * (k0 - 1.0) / k1; let b = BELLY - p.y;
  let h = clamp(0.5 + 0.5 * (b - a) / BELLY_K, 0.0, 1.0);
  return mix(a, b, h) + BELLY_K * h * (1.0 - h);
}
struct Zones { skin: f32, pale: f32, flesh: f32, depth: f32, ct: f32, st: f32, stripe: f32, spot: f32, stem: f32, blossom: f32 };
fn zones(rp: vec3f) -> Zones {
  var z: Zones;
  z.depth = -melonSdf(rp);
  let th = atan2(rp.z, rp.y);   // the angle round the long axis
  z.ct = cos(th); z.st = sin(th);
  let wob = (vnoise(vec3f(z.ct * 3.0, z.st * 3.0, rp.x * 2.2)) - 0.5) * 0.02 + (vnoise(vec3f(z.ct * 9.0, z.st * 9.0, rp.x * 7.0)) - 0.5) * 0.006;
  z.skin = 1.0 - smoothstep(SKINW - 0.004, SKINW + 0.004, z.depth + wob);
  let pe = SKINW + PITHW + wob * 2.0;
  z.pale = (1.0 - smoothstep(pe - 0.025, pe + 0.015, z.depth)) * (1.0 - z.skin);
  z.flesh = max(0.0, 1.0 - z.skin - z.pale);
  // sixteen irregular darker stripes; their edges wander along the length and fray
  let warp = (vnoise(vec3f(z.ct * 2.0, z.st * 2.0, rp.x * 1.3)) - 0.5) * 3.2 + (vnoise(vec3f(z.ct * 6.0, z.st * 6.0, rp.x * 4.5)) - 0.5) * 1.1;
  let ragged = (vnoise(vec3f(z.ct * 18.0, z.st * 18.0, rp.x * 14.0)) - 0.5) * 0.7;
  z.stripe = smoothstep(-0.15, 0.25, sin(th * 16.0 + warp) + ragged);
  // the field spot: a pale yellow patch on the belly, where it lay on the ground
  let fs = length((rp.xz - vec2f(0.12, 0.05)) / vec2f(0.78, 0.5));
  z.spot = (1.0 - smoothstep(0.5, 1.0, fs + (vnoise(rp * 5.0) - 0.5) * 0.35)) * smoothstep(-0.42, -0.7, rp.y);
  // the stem scar at one end, the blossom end at the other
  z.stem = 1.0 - smoothstep(0.05, 0.08, length(rp - vec3f(MA.x, 0.0, 0.0)));
  z.blossom = 1.0 - smoothstep(0.07, 0.12, length(rp - vec3f(-MA.x, 0.0, 0.0)));
  return z;
}
// the pale paper sweep: a floor that curves up into a wall far behind; the floor is the table
fn sweepT(ro: vec3f, rd: vec3f) -> vec2f {   // (t, 0 floor | 1 curve | 2 wall)
  let zw = -6.0; let Rs = 4.0;
  if (rd.y < -1e-5) {
    let t = -ro.y / rd.y;
    if (ro.z + rd.z * t >= zw) { return vec2f(t, 0.0); }
  }
  let oc = vec2f(ro.y - Rs, ro.z - zw); let dd = vec2f(rd.y, rd.z);
  let a = dot(dd, dd); let b = dot(oc, dd); let c = dot(oc, oc) - Rs * Rs;
  let disc = b * b - a * c;
  if (disc > 0.0 && a > 1e-8) {
    let t = (-b + sqrt(disc)) / a;
    let p = ro + rd * t;
    if (t > 0.0 && p.z <= zw && p.y <= Rs) { return vec2f(t, 1.0); }
  }
  if (rd.z < -1e-5) { return vec2f((zw - Rs - ro.z) / rd.z, 2.0); }
  return vec2f(1e4, 3.0);
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
  let N = normalize(Ng + bump * (0.12 * z.skin + 0.03 * (1.0 - z.skin) + 0.4 * (z.stem + z.blossom) * z.skin));
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
  let fib = vnoise(vec3f(z.ct * 7.0, z.st * 7.0, z.depth * 4.0 + i.rp.x * 1.5));   // fibres running in from the rind
  let nearRind = smoothstep(SKINW + PITHW, SKINW + PITHW + 0.35, z.depth);         // the flesh is brighter toward the rind
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

  // Green skin: waxy, striped pole to pole, nearly opaque; the field spot, the stem scar, the blossom end.
  let speck = vnoise(i.rp * 150.0);
  var skinCol = mix(F.pal[0].rgb, F.pal[1].rgb, z.stripe) * (0.86 + 0.28 * speck);
  skinCol = mix(skinCol, vec3f(0.78, 0.7, 0.36) * (0.85 + 0.3 * vnoise(i.rp * 30.0)), z.spot * 0.85);
  let stemR = length(i.rp - vec3f(MA.x, 0.0, 0.0));
  skinCol = mix(skinCol, mix(vec3f(0.22, 0.16, 0.09), vec3f(0.4, 0.31, 0.18), vnoise(i.rp * 90.0)) * mix(0.55, 1.0, smoothstep(0.02, 0.045, stemR)), z.stem);
  let blR = length(i.rp - vec3f(-MA.x, 0.0, 0.0));
  skinCol = mix(skinCol, mix(vec3f(0.18, 0.15, 0.08), vec3f(0.46, 0.43, 0.27), smoothstep(0.012, 0.035, blR)) * (0.8 + 0.4 * vnoise(i.rp * 120.0)), z.blossom * 0.9);
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
const LIGHTS = {
  KEY: 'const KEY = vec3f(-0.3203, 0.9008, 0.2936);',
  RIM: 'const RIM = vec3f(-0.6141, 0.3584, -0.7032);',
  FILL: 'const FILL = vec3f(0.9076, 0.2346, 0.3481);',
};
const ENV = /* wgsl */`
// The studio as seen in reflections: a dim warm surround, the warm paper sweep below the horizon,
// the big overhead softbox, the back-left strip and the cool fill card.
fn env(d: vec3f, rough: f32) -> vec3f {
  var c = mix(vec3f(0.30, 0.285, 0.26), vec3f(0.15, 0.145, 0.14), smoothstep(0.0, 0.9, d.y));
  c = mix(c, F.base.rgb * 0.62, smoothstep(0.02, -0.35, d.y));
  let s = 0.02 + rough * 0.7;
  let a = 1.0 / (1.0 + rough * 7.0);
  c += vec3f(1.0, 0.975, 0.94) * 6.5 * a * softbox(d, KEY, vec2f(0.62, 0.46), s);
  c += vec3f(1.0, 0.98, 0.96) * 3.4 * a * softbox(d, RIM, vec2f(0.12, 0.85), s);
  c += vec3f(0.80, 0.88, 1.0) * 1.1 * a * softbox(d, FILL, vec2f(0.38, 0.5), s * 2.0 + 0.05);
  return c;
}
`;
const BACKDROP = /* wgsl */`
@fragment fn fsBG(i: FV) -> @location(0) vec4f {
  let b = F.invViewProj * vec4f(i.ndc, 1.0, 1.0);
  let ro = F.camPos.xyz;
  let rd = normalize(b.xyz / b.w - ro);
  let h = sweepT(ro, rd);
  if (h.y > 2.5) { return vec4f(F.base.rgb * 0.7, 1e4); }
  let P = ro + rd * h.x;
  let grain = 1.0 + (vnoise(P * 60.0) - 0.5) * 0.02;
  if (h.y < 0.5) { return vec4f(floorShade(P) * grain, h.x); }
  return vec4f(F.base.rgb * mix(1.0, 0.72, smoothstep(0.0, 4.0, P.y)) * grain, h.x);   // falls off softly up the sweep
}
`;

const variety = (absorb, scatter, palette, accent) => ({ absorb, density: 1, scatter, palette, accent });
const PRESETS = {
  crimson: variety([1.1, 8.0, 6.6], [0.92, 0.05, 0.07], ['#5d8c34', '#163b12', '#e7ebca', '#21150e'], '#b8283a'),
  golden: variety([0.17, 0.8, 5.6], [1.0, 0.58, 0.07], ['#567f2f', '#11300e', '#eef0d3', '#1d140e'], '#c48a12'),
  rose: variety([0.24, 2.4, 2.4], [1.0, 0.32, 0.36], ['#7ea653', '#2c5822', '#f1efd6', '#3a291e'], '#c85a74'),
};
const HINTS = {
  hand: 'Pull, lift or twist a piece; scroll or use a second finger to twist what you hold. Drag the empty table to look around.',
  knife: 'Draw a line across the melon: the knife lines up over it and cuts when you let go. A drag away from the melon looks around.',
};
const MESSAGES = {
  short: 'Missed — draw the blade across the melon.', cutmiss: 'Missed — draw the blade across the melon.',
  thin: 'Too thin to cut there.', many: "That's plenty of pieces.", busy: 'One cut at a time.',
};
const STEP = 1 / 60, MAX_PIECES = 24, BUDGET_MS = 7, KS = 2;   // KS: the knife's scale (a melon knife)
const TUNE = { substeps: 6, gravity: 30, tetShare: 0, cellShare: 1, stretchMax: 1.6, compressMin: 0.4, stiffK: 0.25,
  sleepV: 0.05, sleepSteps: 30, landV: 3.5, landHold: 60, landK: 0.25, landKd: 0.03, impactV: 1.2, roll: 0.006, muS: 0.8, muK: 0.55,
  handK: 0.12, handVmax: 6, lra: 1.8, handReach: 3.5, releaseV: 4, releaseW: 4, releaseKeep: 0.5,
  contactMargin: 0.012, contactPush: 0.03, contactMuS: 0.6, contactMuK: 0.45, settleV: 0.04, settleRate: 0.03, cmPerU: 10, gPerCm3: 0.96, minMassFrac: 0.25 };
const LIFT = -WholeMelon.BOTTOM;   // the rest frame sits on the table with its belly on y = 0
const STAGE = { x: 6.5, zBack: -4.6, zFront: 3.8 };
// Collider: the knife's rounded edge (a groove before it gives) and its wedge. The solver turns every
// position change into velocity, so pushes are capped and spread over a few substeps.
const RP = 0.06, RE = 0.05, PUSH_CAP = 0.006, SUB_DT = STEP / TUNE.substeps;
const KNIFE_HALF_LEN = (KNIFE_SMALL.L * KS) / 2, KNIFE_H = KNIFE_SMALL.HB * KS;
const bladeHalf = (h) => bladeHalfAt(KNIFE_SMALL, h / KS) * KS;
const HOVER = 0.5, ROLL = 0.2;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
function push(x, i, dx, dy, dz, drag) {
  const l = Math.hypot(dx, dy, dz);
  if (l > PUSH_CAP) { const k = PUSH_CAP / l; dx *= k; dy *= k; dz *= k; }
  x[3 * i] += dx; x[3 * i + 1] += dy + drag; x[3 * i + 2] += dz;
}
const specOf = (pc, t = [0, LIFT, 0]) => {
  const X = pc.sim.X, x = new Float32Array(X.length);
  for (let i = 0; i < X.length; i += 3) { x[i] = X[i] + t[0]; x[i + 1] = X[i + 1] + t[1]; x[i + 2] = X[i + 2] + t[2]; }
  return { X, tets: pc.sim.tets, cells: pc.sim.cells, cellRind: pc.sim.cellRind, tetRind: pc.sim.tetRind, x };
};
const restOf = (pc) => ({ X: pc.sim.X, tets: pc.sim.tets, cells: pc.sim.cells, cellRind: pc.sim.cellRind, tetRind: pc.sim.tetRind });
// a rest-space bounding sphere per piece, for picking
function sphereOf(pc) {
  if (pc.bs) return pc.bs;
  const P = pc.render.pos, n = P.length / 3;
  let cx = 0, cy = 0, cz = 0, r = 0;
  for (let i = 0; i < n; i++) { cx += P[3 * i]; cy += P[3 * i + 1]; cz += P[3 * i + 2]; }
  cx /= n; cy /= n; cz /= n;
  for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(P[3 * i] - cx, P[3 * i + 1] - cy, P[3 * i + 2] - cz));
  return (pc.bs = [cx, cy, cz, r + 0.02]);
}

export async function mount(ctx) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before meshing the melon
  const sim = jellySim(), world = sim.createWorld(TUNE);
  let pieces = [], whole = null, acc = 0, rebuilt = false, pending = null, anim = null, plan = null;
  world.sdf = (p, x, y, z, out) => WholeMelon.piece(pieces[p].cuts, x, y, z, out);
  const View = { prev: new Float32Array(0), nodes: new Float32Array(0) };

  // ----- everything the renderer needs, concatenated over all pieces: render vertices, then three
  // anchors per seed, then the bubbles; skinned by gradient, so each point carries its rest normal -----
  function assemble() {
    let nv = 0, ns = 0, nb = 0, nTri = 0;
    for (const pc of pieces) { nv += pc.render.pos.length / 3; ns += pc.seeds.length / 10; nb += pc.bubbles.length / 4; nTri += pc.render.index.length; }
    const np = nv + 3 * ns + nb;
    const idx = new Uint32Array(np * 4), w = new Float32Array(np * 4), restN = new Float32Array(np * 4);
    const index = new Uint32Array(nTri), rest = new Float32Array(nv * 8), inst = new Float32Array(Math.max(1, ns + nb) * 4);
    let ov = 0, os = 0, ob = 0, ot = 0;
    pieces.forEach((pc, k) => {
      const start = world.pieces[k].start, e = pc.emb, R = pc.render;
      const pv = R.pos.length / 3, ps = pc.seeds.length / 10, pb = pc.bubbles.length / 4;
      const put = (l, g) => { for (let c = 0; c < 4; c++) { idx[4 * g + c] = start + e.idx[4 * l + c]; w[4 * g + c] = e.w[4 * l + c]; } };
      for (let v = 0; v < pv; v++) {
        put(v, ov + v);
        rest.set([R.pos[3 * v], R.pos[3 * v + 1], R.pos[3 * v + 2], 0, R.nrm[3 * v], R.nrm[3 * v + 1], R.nrm[3 * v + 2], 0], 8 * (ov + v));
        restN.set([R.nrm[3 * v], R.nrm[3 * v + 1], R.nrm[3 * v + 2], 0], 4 * (ov + v));
      }
      for (let q = 0; q < ps; q++) {
        for (let a = 0; a < 3; a++) put(pv + 3 * q + a, nv + 3 * (os + q) + a);
        const sd = pc.seeds, g = 10 * q;
        inst.set([sd[g + 9], (Math.abs(Math.sin(sd[g] * 91.7 + sd[g + 2] * 37.3)) * 0.999) % 1, 0, 0], 4 * (os + q));   // scale, tint
      }
      for (let v = 0; v < pb; v++) { put(pv + 3 * ps + v, nv + 3 * ns + ob + v); inst[4 * (ns + ob + v)] = pc.bubbles[4 * v + 3]; }
      for (let t = 0; t < R.index.length; t++) index[ot + t] = ov + R.index[t];
      ov += pv; os += ps; ob += pb; ot += R.index.length;
    });
    // the lattice overlay: each cell's twelve edges, once
    const C = world.cells(), seen = new Set(), edges = [];
    const E12 = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (let c = 0; c < C.length; c += 8) for (const [a, b] of E12) { const i = C[c + a], j = C[c + b], key = Math.min(i, j) * 1e6 + Math.max(i, j); if (!seen.has(key)) { seen.add(key); edges.push(i, j); } }
    View.prev = new Float32Array(world.x);
    View.nodes = new Float32Array(world.n * 4);
    return { n: world.n, np, nv, emb: { idx, w }, restN, index, rest, inst, tets: world.tets, restX: world.rest,
      seedBase: nv, seedCount: ns, bubbleBase: nv + 3 * ns, bubbleCount: nb, edges: Uint32Array.from(edges) };
  }

  // ----- picking: a ray against each piece's own field, posed by its best-fit frame -----
  const frames = [], S4 = new Float64Array(4);
  function pickJelly(ro, rd) {
    let best = null;
    pieces.forEach((pc, k) => {
      const F = (frames[k] = world.rigidFrame(k, frames[k])), M = F.R, t = F.t, Cr = F.restCentroid, bs = sphereOf(pc);
      const ox = ro[0] - t[0], oy = ro[1] - t[1], oz = ro[2] - t[2];
      const o = [M[0] * ox + M[3] * oy + M[6] * oz + Cr[0], M[1] * ox + M[4] * oy + M[7] * oz + Cr[1], M[2] * ox + M[5] * oy + M[8] * oz + Cr[2]];
      const r = [M[0] * rd[0] + M[3] * rd[1] + M[6] * rd[2], M[1] * rd[0] + M[4] * rd[1] + M[7] * rd[2], M[2] * rd[0] + M[5] * rd[1] + M[8] * rd[2]];
      const q = [o[0] - bs[0], o[1] - bs[1], o[2] - bs[2]], b = q[0] * r[0] + q[1] * r[1] + q[2] * r[2], c = q[0] ** 2 + q[1] ** 2 + q[2] ** 2 - bs[3] ** 2;
      if (b * b - c < 0) return;
      let s = Math.max(0, -b - Math.sqrt(b * b - c));
      const sEnd = -b + Math.sqrt(b * b - c);
      for (let it = 0; it < 80 && s <= sEnd; it++) {
        WholeMelon.piece(pc.cuts, o[0] + r[0] * s, o[1] + r[1] * s, o[2] + r[2] * s, S4);
        if (S4[0] < 0.004) {
          if (!best || s < best.s) best = { k, s, point: [ro[0] + rd[0] * s, ro[1] + rd[1] * s, ro[2] + rd[2] * s], normal: [M[0] * S4[1] + M[1] * S4[2] + M[2] * S4[3], M[3] * S4[1] + M[4] * S4[2] + M[5] * S4[3], M[6] * S4[1] + M[7] * S4[2] + M[8] * S4[3]] };
          break;
        }
        s += Math.max(S4[0], 0.002);
      }
    });
    return best;
  }
  /** Where a ray lands: on the jelly if it hits it, else on the table. */
  function landing(ro, rd) {
    const j = pickJelly(ro, rd);
    if (j) return { p: j.point, onJelly: true };
    const t = rd[1] < -1e-4 ? -ro[1] / rd[1] : 40;
    return { p: [ro[0] + rd[0] * t, 0, ro[2] + rd[2] * t], onJelly: false };
  }
  function topNear(x0, z0, r) {   // highest particle within r of (x0, z0) in plan; 0 on the bare table
    const x = world.x;
    let top = 0;
    for (let i = 0; i < world.n; i++) { const dx = x[3 * i] - x0, dz = x[3 * i + 2] - z0; if (dx * dx + dz * dz < r * r && x[3 * i + 1] > top) top = x[3 * i + 1]; }
    return top;
  }
  function nearJelly(p, r) {
    const x = world.x;
    for (let i = 0; i < world.n; i++) { const dx = x[3 * i] - p[0], dz = x[3 * i + 2] - p[2]; if (dx * dx + dz * dz < r * r) return true; }
    return false;
  }

  // ----- planning a cut: cheap and immediate; the meshing runs a few milliseconds per frame -----
  function planCut(S, E) {
    const dx = E[0] - S[0], dz = E[2] - S[2], len = Math.hypot(dx, dz);
    if (len < 0.15) return { ok: false, reason: 'short' };
    const D = [dx / len, 0, dz / len], N = [-D[2], 0, D[0]], x = world.x;
    const crossed = [];
    let top = 0;
    world.pieces.forEach((pc, k) => {
      let pos = 0, neg = 0;
      for (let i = pc.start; i < pc.start + pc.count; i++) {
        const rx = x[3 * i] - S[0], rz = x[3 * i + 2] - S[2], a = rx * D[0] + rz * D[2];
        if (a < -0.4 || a > len + 0.4) continue;
        const s = rx * N[0] + rz * N[2];
        if (s > 0.03) pos++; else if (s < -0.03) neg++;
        if (Math.abs(s) < 0.35 && x[3 * i + 1] > top) top = x[3 * i + 1];
      }
      if (pos > 2 && neg > 2) crossed.push(k);
    });
    if (!crossed.length) return { ok: false, reason: 'cutmiss' };
    const jobs = [], split = [];
    for (const k of crossed) {
      const pc = pieces[k], F = world.rigidFrame(k), R = F.R, t = F.t, C = F.restCentroid;
      // the blade plane carried into this piece's rest space: n.x = n.S  ->  (R^T n).X = n.S - n.t + (R^T n).C
      const nr = [R[0] * N[0] + R[3] * N[1] + R[6] * N[2], R[1] * N[0] + R[4] * N[1] + R[7] * N[2], R[2] * N[0] + R[5] * N[1] + R[8] * N[2]];
      const o = N[0] * S[0] + N[2] * S[2] - (N[0] * t[0] + N[1] * t[1] + N[2] * t[2]) + nr[0] * C[0] + nr[1] * C[1] + nr[2] * C[2];
      // slivers are refused: each side must hold a fair share of the piece
      const wp = world.pieces[k], X = world.rest, m = world.mass;
      let mA = 0, mB = 0;
      for (let i = wp.start; i < wp.start + wp.count; i++) { if (nr[0] * X[3 * i] + nr[1] * X[3 * i + 1] + nr[2] * X[3 * i + 2] - o <= 0) mA += m[i]; else mB += m[i]; }
      const fA = mA / (mA + mB), fB = 1 - fA;
      if (Math.min(fA, fB) < 0.06 || Math.min(fA, fB) * pc.volume < 0.05) continue;
      split.push(k);
      for (const p of [[nr[0], nr[1], nr[2], o], [-nr[0], -nr[1], -nr[2], -o]]) {
        const cuts = pc.cuts.concat([p]);
        jobs.push({ from: k, gen: WholeMelon.buildPiece(cuts, sim.embed, WholeMelon.boundsOf(pc.render.pos, p)), done: false, result: null });
      }
    }
    if (!split.length) return { ok: false, reason: 'thin' };
    if (pieces.length + split.length > MAX_PIECES) return { ok: false, reason: 'many' };
    const mid = [(S[0] + E[0]) / 2, 0, (S[2] + E[2]) / 2];
    return { ok: true, S, E, D, N, mid, len, top, crossed: new Set(split), jobs, ready: false };
  }
  // the cooperative builder: runs the plan's generators within a time budget
  function pumpBuild(pl, budgetMs) {
    if (!pl || pl.ready) return;
    const t0 = performance.now();
    for (const j of pl.jobs) {
      while (!j.done) {
        const r = j.gen.next();
        if (r.done) { j.done = true; j.result = r.value; }
        if (performance.now() - t0 > budgetMs) break;
      }
      if (performance.now() - t0 > budgetMs) break;
    }
    pl.ready = pl.jobs.every((j) => j.done);
  }
  /** Break-through: swap the new pieces in; their particles inherit position and velocity from the flesh they came from. */
  function swapIn(pl) {
    const list = [], next = [];
    pieces.forEach((pc, k) => { if (!pl.crossed.has(k)) { list.push({ keep: k }); next.push(pc); } });
    const first = next.length;
    for (const j of pl.jobs) { if (!j.result || !j.result.sim.cells.length) continue; list.push(restOf(j.result)); next.push(j.result); }
    world.replacePieces(list);
    pieces = next;
    rebuilt = true;
    return next.slice(first).map((_, i) => first + i);
  }

  // ----- the collider: the stage's walls, the knife's edge and wedge -----
  const Coll = { kind: null, O: [0, 0, 0], D: [1, 0, 0], N: [0, 0, 1], vy: 0, sides: new Int8Array(0) };
  world.collider = (x, v, n) => {
    const aw = world.awake, piece = world.piece;
    for (let i = 0; i < n; i++) {
      if (!aw[piece[i]]) continue;
      const o = 3 * i;
      if (x[o] < -STAGE.x) x[o] = -STAGE.x; else if (x[o] > STAGE.x) x[o] = STAGE.x;
      if (x[o + 2] < STAGE.zBack) x[o + 2] = STAGE.zBack; else if (x[o + 2] > STAGE.zFront) x[o + 2] = STAGE.zFront;
    }
    if (!Coll.kind) return;
    const O = Coll.O, sides = Coll.sides, D = Coll.D, N = Coll.N;
    const drag = Coll.vy < 0 ? Coll.vy * SUB_DT : 0;   // a descending blade drags what it touches down with it
    for (let i = 0; i < n; i++) {
      const dx = x[3 * i] - O[0], dz = x[3 * i + 2] - O[2], a = dx * D[0] + dz * D[2];
      if (a < -KNIFE_HALF_LEN - RP || a > KNIFE_HALF_LEN + RP) continue;
      const h = x[3 * i + 1] - O[1], s = dx * N[0] + dz * N[2];
      if (h > KNIFE_H + RP) continue;
      const near = h < 0 ? Math.hypot(s, h) < RE + RP : Math.abs(s) < bladeHalf(h) + RP;
      if (!near) continue;
      if (!aw[piece[i]]) { world.wake(piece[i]); continue; }   // a sleeper the blade reaches wakes (and moves from the next substep)
      if (h < 0) {   // under the rounded edge: pressed down and aside, a groove before it gives
        const dd = Math.hypot(s, h), lim = RE + RP;
        const ns = dd > 1e-6 ? (s * lim) / dd : 0, nh = dd > 1e-6 ? (h * lim) / dd : -lim;
        push(x, i, N[0] * (ns - s), nh - h, N[2] * (ns - s), 0);
      } else {        // beside the blade: the wedge eases the faces apart and holds the lips down
        const lim = bladeHalf(h) + RP;
        const ds = (sides[piece[i]] || (s >= 0 ? 1 : -1)) * lim - s;
        push(x, i, N[0] * ds, 0, N[2] * ds, drag);
      }
    }
  };

  // ----- the body the page drives -----
  function stepOnce() {
    View.prev.set(world.x);
    anim?.tick(STEP);
    if (rebuilt) { rebuilt = false; pending = assemble(); }
    world.step(STEP);
  }
  const centre = [0, 0, 0];
  const body = {
    world, DT: STEP,
    get n() { return world.n; },
    get grabbing() { return world.grabbing; },
    step() { pumpBuild(plan, 1e9); stepOnce(); },   // the test hook's deterministic steps build at once
    advance(dt, speed = 1) {
      pumpBuild(plan, BUDGET_MS);
      acc = Math.min(acc + dt * speed, STEP * 3);
      let k = 0;
      while (acc >= STEP && k < 3) { stepOnce(); acc -= STEP; k++; }
      return k;
    },
    reset(drop) {
      anim = null; plan = null; Coll.kind = null;   // a running cut is cancelled
      world.grabEnd();
      whole ||= WholeMelon.finish(WholeMelon.buildPiece([], sim.embed));
      pieces = [whole];
      world.setPieces([specOf(whole)]);
      if (drop) for (let i = 1; i < world.x.length; i += 3) world.x[i] += 0.3;
      pending = assemble(); rebuilt = false; acc = 0;
    },
    takeMeshes() { const m = pending; pending = null; return m; },
    pick: (ro, rd) => pickJelly(ro, rd)?.point ?? null,
    grabStart(p, fwd = [0, 0, -1]) { world.grabStart(p, { radius: 0.32, axis: fwd.slice() }); },
    grabMove(p) { world.grabMove([p[0], Math.max(0.04, p[1]), p[2]]); },
    grabTwist: (a) => world.grabTwist(a), grabEnd: () => world.grabEnd(),
    setFirmness: (v) => world.setFirmness(v), setDamping: (v) => world.setDamping(v),
    nudge(s) { world.wakeAll(); world.nudge(s); },
    stats: () => world.stats(),
    centroid() {
      const x = world.x, n = world.n;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += x[3 * i]; cy += x[3 * i + 1]; cz += x[3 * i + 2]; }
      centre[0] = cx / n; centre[1] = cy / n; centre[2] = cz / n;
      return centre;
    },
    renderNodes() {
      const x = world.x, p = View.prev, out = View.nodes, a = Math.min(1, acc / STEP);
      for (let i = 0; i < world.n; i++) {
        const o = 3 * i, q = 4 * i;
        out[q] = p[o] + (x[o] - p[o]) * a; out[q + 1] = p[o + 1] + (x[o + 1] - p[o + 1]) * a; out[q + 2] = p[o + 2] + (x[o + 2] - p[o + 2]) * a;
      }
      return out;
    },
  };

  // ----- the knife: its pose, the cut choreography, the stroke gesture -----
  const props = createProps({ knife: knifeMesh(KNIFE_SMALL) }, { height: false });
  function knifeTools({ R: Rr, state, rayAt, toPx }) {
    const { $, toast, reduced } = ctx.stage, on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ctx.signal });
    const look = Rr.look, tool = { name: 'hand' };
    const Knife = { O: [0, 2.6, 0], D: [1, 0, 0], roll: 0, show: false, M: new Float32Array(16) };
    let dropT = 1;   // seconds since the knife was picked up: it drops in from above
    function knifeMatrix() {
      const { O, D, roll } = Knife, e = look.eye;
      // local x -> D, y -> up rolled toward the viewer by `roll` (about D), z -> x cross y; the edge's middle sits at O
      let vx = e[0] - O[0], vz = e[2] - O[2];
      const along = vx * D[0] + vz * D[2]; vx -= D[0] * along; vz -= D[2] * along;
      const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
      const c = Math.cos(roll), s = Math.sin(roll), Y = [vx * s, c, vz * s];
      const Z = [D[1] * Y[2] - D[2] * Y[1], D[2] * Y[0] - D[0] * Y[2], D[0] * Y[1] - D[1] * Y[0]];
      const t = [O[0] - D[0] * KNIFE_HALF_LEN, O[1], O[2] - D[2] * KNIFE_HALF_LEN], M = Knife.M;
      M.set([D[0] * KS, D[1] * KS, D[2] * KS, 0, Y[0] * KS, Y[1] * KS, Y[2] * KS, 0, Z[0] * KS, Z[1] * KS, Z[2] * KS, 0, t[0], t[1], t[2], 1]);
      return M;
    }
    function startCut(pl) {
      const k = Knife, from = { O: k.O.slice(), D: k.D.slice(), roll: k.roll };
      let D = pl.D;
      if (D[0] * look.right[0] + D[2] * look.right[2] < 0) D = [-D[0], 0, -D[2]];   // handle on the left
      const N = [-D[2], 0, D[0]], top = pl.top, hover = top + HOVER, press = Math.max(0.03, top - 0.2);
      // align (0.22 s) -> press a groove into the top (to 0.6 s; it holds there until the new pieces are built)
      // -> break through to the table (0.95 s) -> hold -> lift back to hover (1.55 s)
      const T1 = 0.22, T2 = 0.6, T3 = 0.95, T4 = 1.1, T5 = 1.55;
      const yAt = (t) => t < T1 ? lerp(Math.max(from.O[1], top + 0.08), top + 0.08, ease(t / T1))
        : t < T2 ? lerp(top + 0.08, press, ease((t - T1) / (T2 - T1)))
        : t < T3 ? lerp(press, -0.004, ease((t - T2) / (T3 - T2)))
        : t < T4 ? -0.004 : lerp(-0.004, hover, ease((t - T4) / (T5 - T4)));
      let t = 0, swapped = false, lastY = yAt(0);
      k.show = true; plan = pl;
      Coll.kind = 'blade'; Coll.D = D; Coll.N = N; Coll.sides = new Int8Array(MAX_PIECES + 1);
      anim = {
        kind: 'cut',
        tick(dt) {
          t += dt;
          if (!swapped && t > T2) t = T2;   // pressing the groove until the new pieces are ready
          const a = ease(t / T1);
          k.D = [lerp(from.D[0], D[0], a), 0, lerp(from.D[2], D[2], a)];
          const l = Math.hypot(k.D[0], k.D[2]) || 1; k.D[0] /= l; k.D[2] /= l;
          k.roll = lerp(from.roll, 0, a);   // upright for the cut
          const y = yAt(t);
          k.O = [lerp(from.O[0], pl.mid[0], a), y, lerp(from.O[2], pl.mid[2], a)];
          Coll.O = [pl.mid[0], y, pl.mid[2]];
          Coll.vy = (y - lastY) / Math.max(dt, 1e-4); lastY = y;
          if (!swapped && t >= T2 && pl.ready) {
            swapped = true;
            const made = swapIn(pl);
            Coll.sides = new Int8Array(MAX_PIECES + 1);
            for (const j of made) {   // which side of the blade each new piece lies on
              const pc = world.pieces[j];
              let s = 0;
              for (let i = pc.start; i < pc.start + pc.count; i++) s += (world.x[3 * i] - pl.mid[0]) * N[0] + (world.x[3 * i + 2] - pl.mid[2]) * N[2];
              Coll.sides[j] = s >= 0 ? 1 : -1;
            }
          }
          if (t >= T4) Coll.kind = null;   // lifting: the lips spring back with a jiggle
          if (t >= T5) { anim = null; plan = null; }
        },
      };
    }
    function commitCut(S, E) {
      if (anim) { toast(MESSAGES.busy); return false; }
      const pl = planCut(S, E);
      if (pl.ok) { startCut(pl); return true; }
      if (MESSAGES[pl.reason]) toast(MESSAGES[pl.reason]);
      return false;
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

    // ----- the knife's hover pose between cuts -----
    let S = null, E = null, stroking = false, hover = null;
    const hoverPt = [0, 0, 0];
    function updateKnife(dt) {
      if (anim) return;
      const k = Knife;
      let rx = look.right[0], rz = look.right[2];
      const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      if (tool.name !== 'knife') { k.show = false; return; }
      dropT = Math.min(1, dropT + dt / 0.35);
      if (stroking && S && E) {   // lined up along the stroke, edge just above the jelly, handle on the left
        let dx = E[0] - S[0], dz = E[2] - S[2];
        const l = Math.hypot(dx, dz);
        if (l > 0.05) { dx /= l; dz /= l; if (dx * rx + dz * rz < 0) { dx = -dx; dz = -dz; } k.D = [dx, 0, dz]; }
        k.O = [(S[0] + E[0]) / 2, topNear((S[0] + E[0]) / 2, (S[2] + E[2]) / 2, 0.8) + 0.06, (S[2] + E[2]) / 2];
        k.roll = 0;
      } else if (hover) {
        // floating above the melon, side-on to the camera, rolled a little toward the viewer, its edge under the cursor
        const { ro, rd } = rayAt(hover[0], hover[1]), L = landing(ro, rd);
        const y = topNear(L.p[0], L.p[2], 1.0) + HOVER + 1.4 * (1 - ease(dropT));
        const t = Math.abs(rd[1]) > 1e-4 ? (y - ro[1]) / rd[1] : 0;
        if (t > 0) { hoverPt[0] = ro[0] + rd[0] * t; hoverPt[1] = y; hoverPt[2] = ro[2] + rd[2] * t; }
        k.D = [rx, 0, rz]; k.O = hoverPt.slice(); k.roll = ROLL;
      }
      k.show = !!hover || stroking;
    }

    return {
      down(e, { ro, rd }) {
        if (tool.name === 'hand') return null;
        if (anim) return 'orbit';
        const L = landing(ro, rd);
        if (!L.onJelly && !nearJelly(L.p, 0.8)) return 'orbit';
        S = L.p; E = L.p; stroking = true; showGuide(S, E);
        return 'stroke';
      },
      move(e, { ro, rd }, mode) { E = landing(ro, rd).p; showGuide(S, E); return mode; },
      up(e) { stroking = false; hideGuide(); if (e.type === 'pointerup') commitCut(S, E); },
      hover(e) { hover = e ? [e.clientX, e.clientY] : null; },
      key(k) { if (k === 'h') setTool('hand'); else if (k === 'k') setTool('knife'); },
      frame(dt) {
        updateKnife(dt);
        props.state.draw.length = 0;
        if (Knife.show) { props.state.draw.push('knife'); props.state.A = knifeMatrix(); }
      },
      cursor: () => (tool.name === 'hand' ? '' : 'crosshair'),
      hook: {
        anim: () => anim && anim.kind, knife: Knife, setTool, toast, pieces: () => pieces,
        planCut(sx, sy, ex, ey) {
          const a = toPx(sx, sy), b = toPx(ex, ey), r1 = rayAt(a[0], a[1]), r2 = rayAt(b[0], b[1]);
          return planCut(landing(r1.ro, r1.rd).p, landing(r2.ro, r2.rd).p);
        },
        cutWorld: (S0, E0) => commitCut(S0, E0),
        startCut(pl) { if (pl && pl.ok && !anim) { setTool('knife'); dropT = 1; startCut(pl); return true; } return false; },
        setVariety(v) { state.preset = v; $(`input[name="variety"][value="${v}"]`).checked = true; accent(); },
      },
    };
  }

  // the height map and the key light's map follow the pieces as they spread over the table
  const radiusAt = (c) => {
    const x = world.x;
    let r2 = 0;
    for (let i = 0; i < world.n; i += 7) r2 = Math.max(r2, (x[3 * i] - c[0]) ** 2 + (x[3 * i + 2] - c[2]) ** 2);
    return Math.max(2.4, Math.sqrt(r2) + 0.5);
  };
  return runJellyPage(ctx, {
    sim: body,
    renderer: {
      paper: meta.paper, skin: 'gradient', key: [-0.3203, 0.9008, 0.2936], helpers: HELPERS, material: MATERIAL,
      replace: { ...LIGHTS, env: ENV, fsBG: BACKDROP },
      passes: PROPS_WGSL + MELON_KNIFE_WGSL + SEEDS_WGSL,
      plugins: [props.plugin, instancedPlugin(seedMesh(), 'vsSeed', 'fsSeed')],
    },
    presets: PRESETS, preset: 'crimson',
    look: (state, c) => { const rad = radiusAt(c); return { shadow: [c[0], c[2], rad + 0.6, rad + 0.9], light: { centre: c, half: rad + 1.0 } }; },
    readout: (s) => {
      let V = 0;   // the mass of the jelly itself (its skins' volume): conserved by every cut, unlike the lattices' lumped mass
      for (const pc of pieces) V += pc.volume;
      const ke = s.keUJ;
      return { mass: `≈ ${((V * TUNE.cmPerU ** 3 * TUNE.gPerCm3) / 1000).toFixed(2)} kg`, ke: ke < 5 ? '0.00 mJ' : ke < 1e6 ? `${(ke / 1000).toFixed(2)} mJ` : `${(ke / 1e6).toFixed(2)} J` };
    },
    camera: { yaw: 0.5, pitch: 0.5, target: [0, 0.75, 0], pitchRange: [0.15, 1.3], yawRange: 1.4, fit: [5.9, 5.4], frame: { x0: 0, y0: 0.45, aspect: 1.45, cx: 0.58, cy: 0.56 }, zoomRange: [0.5, 1.6], distRange: [5, 30] },
    tools: knifeTools,
  });
}
