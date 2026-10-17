// 07 — Citrus Jelly on the cutting board: grab the slice, slice it with the knife or
// the crinkle blade, stamp shapes out with cookie cutters. Every cut makes new soft pieces mid-motion.
import { runJellyPage } from '../../core/jelly/page.js';
import { M4 } from '../../core/math.js';
import { tetSim } from '../../core/cut/tetsim.js';
import { createCutBody } from '../../core/cut/pieces.js';
import { KNIFE_LARGE, knifeMesh, wavyKnifeMesh, cutterMesh } from '../../core/cut/tools.js';
import { PROPS_WGSL, SKINNED_WGSL, createProps, skinnedPlugin } from '../../core/jelly/plugins.js';
import { createCitrus, citrusChannels, T as THICK, ZC, R as RADIUS, CITRUS_HELPERS, CITRUS_MATERIAL, CITRUS_MEMBRANES, CITRUS_PRESETS } from './geo.js';

export const meta = {
  id: '07', name: 'Citrus Jelly', noun: "slice", paper: '#f2ece2', fig: "fig. 7",
  eyebrow: "Material Studies / No. 007", title: ["Citrus", "Jelly."],
  caption: ["Sunshine in segments.", "Soft enough to slice.", "Sweet enough to share."],
  aria: "Interactive 3D gummy orange slice. With the hand, drag the jelly to stretch it; with the knife or the wavy knife, draw a stroke across it to cut; with the cutter, click to stamp a shape out. Drag the empty floor to turn the view.",
};

export const panel = /* html */`
<div class="group">
  <div class="label" id="tool-label"><span>Tool</span></div>
  <div class="seg" role="radiogroup" aria-labelledby="tool-label">
    <label><input type="radio" name="tool" value="hand" checked><span>Hand <small>(H)</small></span></label>
    <label><input type="radio" name="tool" value="knife"><span>Knife <small>(K)</small></span></label>
    <label><input type="radio" name="tool" value="wavy"><span>Wavy knife <small>(W)</small></span></label>
    <label><input type="radio" name="tool" value="cutter"><span>Cutter <small>(C)</small></span></label>
  </div>
  <div class="shapes" id="shapes" role="radiogroup" aria-label="Cookie cutter shape" data-dim="true">
    <label class="shape" title="Star (1)"><input type="radio" name="shape" value="star" checked><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2.5 14.7,8.78 21.51,9.41 16.37,13.92 17.88,20.59 12,17.1 6.12,20.59 7.63,13.92 2.49,9.41 9.3,8.78"/></svg><span>Star</span></label>
    <label class="shape" title="Heart (2)"><input type="radio" name="shape" value="heart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5C5 15.5 2.5 12 2.5 8.6 2.5 5.6 4.9 3.5 7.6 3.5c2 0 3.6 1.1 4.4 2.8.8-1.7 2.4-2.8 4.4-2.8 2.7 0 5.1 2.1 5.1 5.1 0 3.4-2.5 6.9-9.5 11.9z"/></svg><span>Heart</span></label>
    <label class="shape" title="Flower (3)"><input type="radio" name="shape" value="flower"><svg viewBox="0 0 24 24" aria-hidden="true"><g><ellipse cx="12" cy="6.9" rx="2.9" ry="4.1"/><ellipse cx="12" cy="6.9" rx="2.9" ry="4.1" transform="rotate(60 12 12)"/><ellipse cx="12" cy="6.9" rx="2.9" ry="4.1" transform="rotate(120 12 12)"/><ellipse cx="12" cy="6.9" rx="2.9" ry="4.1" transform="rotate(180 12 12)"/><ellipse cx="12" cy="6.9" rx="2.9" ry="4.1" transform="rotate(240 12 12)"/><ellipse cx="12" cy="6.9" rx="2.9" ry="4.1" transform="rotate(300 12 12)"/><circle cx="12" cy="12" r="1.7"/></g></svg><span>Flower</span></label>
    <label class="shape" title="Round (4)"><input type="radio" name="shape" value="round"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/></svg><span>Round</span></label>
  </div>
</div>
<div class="group">
  <div class="label" id="variety-label"><span>Variety</span></div>
  <div class="swatches" role="radiogroup" aria-labelledby="variety-label">
    <label class="swatch"><input type="radio" name="variety" value="orange" checked><svg viewBox="0 0 44 24" aria-hidden="true"><path d="M2 22A20 20 0 0 1 42 22Z" fill="#e8812a"/><path d="M4.5 22A17.5 17.5 0 0 1 39.5 22Z" fill="#f6ecd2"/><path d="M6.5 22A15.5 15.5 0 0 1 37.5 22Z" fill="#f3992e"/><g stroke="#fbe6c0" stroke-width="0.9"><line x1="22" y1="22" x2="34.54" y2="12.89"/><line x1="22" y1="22" x2="26.79" y2="7.26"/><line x1="22" y1="22" x2="17.21" y2="7.26"/><line x1="22" y1="22" x2="9.46" y2="12.89"/></g><circle cx="22" cy="22" r="2.4" fill="#f6ecd2"/></svg><span class="name">Orange</span></label>
    <label class="swatch"><input type="radio" name="variety" value="blood"><svg viewBox="0 0 44 24" aria-hidden="true"><path d="M2 22A20 20 0 0 1 42 22Z" fill="#d6602c"/><path d="M4.5 22A17.5 17.5 0 0 1 39.5 22Z" fill="#f2e1cf"/><path d="M6.5 22A15.5 15.5 0 0 1 37.5 22Z" fill="#a8233a"/><g stroke="#efcfc7" stroke-width="0.9"><line x1="22" y1="22" x2="34.54" y2="12.89"/><line x1="22" y1="22" x2="26.79" y2="7.26"/><line x1="22" y1="22" x2="17.21" y2="7.26"/><line x1="22" y1="22" x2="9.46" y2="12.89"/></g><circle cx="22" cy="22" r="2.4" fill="#f2e1cf"/></svg><span class="name">Blood Orange</span></label>
    <label class="swatch"><input type="radio" name="variety" value="lemon"><svg viewBox="0 0 44 24" aria-hidden="true"><path d="M2 22A20 20 0 0 1 42 22Z" fill="#e9c22a"/><path d="M4.5 22A17.5 17.5 0 0 1 39.5 22Z" fill="#f7f0d6"/><path d="M6.5 22A15.5 15.5 0 0 1 37.5 22Z" fill="#f1da5e"/><g stroke="#fbf3cf" stroke-width="0.9"><line x1="22" y1="22" x2="34.54" y2="12.89"/><line x1="22" y1="22" x2="26.79" y2="7.26"/><line x1="22" y1="22" x2="17.21" y2="7.26"/><line x1="22" y1="22" x2="9.46" y2="12.89"/></g><circle cx="22" cy="22" r="2.4" fill="#f7f0d6"/></svg><span class="name">Lemon</span></label>
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
<p class="units">Illustrative scale: 1 unit ≈ 1 cm of gummy at 1.05 g/cm³. Volume is the share of the rest volume still present; gravity and time are eased so the motion reads.</p>`;

export const notes = /* html */`
<h3>The physics</h3>
<p id="note-physics">Each piece is a tetrahedral soft body. Every small step pulls each tetrahedron back toward its rest shape after removing its rotation (co-rotational shape matching), keeps its volume, limits how far any edge may stretch and damps only the relative motion along edges, so a fall is never slowed. The rind and pith are stiffer than the flesh. Pieces push each other apart and rest on the board with friction.</p>
<h3>Cutting</h3>
<p>Every piece is a signed-distance field on one shared rest plane. A stroke defines a vertical blade plane; each piece it crosses is split in its own rest frame, every corner is rounded by a morphological closing and opening, and each connected part becomes a new piece. Its particles inherit position and speed from the old jelly, so the swap happens mid-motion.</p>
<h3>The wavy knife</h3>
<p>The crinkle blade is a corrugated plate, its offset across the blade a sine of the distance along it. That surface, carried into each piece's rest frame by the piece's best-fit rotation, becomes a wavy line on the rest plane; the new faces get a tight rounding so the ridges stay crisp. The blade presses straight down and its wedge follows the corrugation. Cut once, then across, and you have crinkle-cut cubes.</p>
<h3>Cookie cutters</h3>
<p>The cutters are rounded exactly like the jelly, so the steel ring and the hole it leaves always match. A stamp splits a flat piece into what lies inside the wall and what lies outside; the outside may now carry a hole or fall apart.</p>
<h3>The riding surface</h3>
<p>The smooth surface you see is not the simulation mesh. It is built per piece from the piece's outline (rounded walls, two caps, a bevel no wider than the local inscribed radius) and every vertex rides inside one tetrahedron with fixed barycentric weights, as do the membranes and the bubbles. Zest, pith, segments and vesicles are shaded from rest-space coordinates, so a fresh cut shows the real inside.</p>
<h3>The light</h3>
<p>Native WebGPU. The surface is skinned to the tetrahedra on the GPU. A back-face pass measures how much jelly each ray crosses for Beer–Lambert absorption; the front refracts the studio and the steel buried behind it, with Fresnel and GGX highlights from softboxes. The floor's soft shadow is tinted by light passing through the jelly.</p>`;

// Steel: materials 5 and 6 belong to the cutter (prop B), the rest to a knife (prop A).
const TOOL_WGSL = /* wgsl */`
fn toolM(m: f32) -> mat4x4f {
  if (m > 4.5 && m < 6.5) { return F.propB; }
  return F.propA;
}
// brushed blade, polished bevel and bolster, walnut, rivets, tin plate, rolled rim, polymer grip
fn toolMaterial(m: u32, u: f32, lp: vec3f, N0: vec3f) -> ToolMat {
  var N = N0;
  var base = vec3f(0.62, 0.63, 0.645);
  var rough = 0.3;
  var metal = 1.0;
  if (m == 0u) {          // brushed blade: fine streaks along the length
    let s = vnoise(vec3f(u * 1.5, lp.y * 340.0, 0.5)) * 0.7 + vnoise(vec3f(u * 0.4, lp.y * 90.0, 3.1)) * 0.3;
    N = normalize(N + vec3f(0.0, (s - 0.5) * 0.18, 0.0));
    base *= 0.9 + 0.16 * s; rough = 0.26 + 0.1 * s;
  } else if (m == 1u) {   // ground bevel, polished
    base = vec3f(0.7, 0.71, 0.72); rough = 0.09;
  } else if (m == 2u) {   // bolster
    base = vec3f(0.74, 0.74, 0.75); rough = 0.11;
  } else if (m == 3u) {   // walnut: dark grain along the handle
    let w = sin(u * 38.0 + vnoise(lp * vec3f(2.0, 26.0, 26.0)) * 7.0) * 0.5 + 0.5;
    base = mix(vec3f(0.085, 0.045, 0.025), vec3f(0.2, 0.11, 0.06), w * 0.8 + vnoise(lp * 60.0) * 0.2);
    rough = 0.42; metal = 0.0;
  } else if (m == 4u) {   // rivets
    base = vec3f(0.78, 0.66, 0.44); rough = 0.16;
  } else if (m == 5u) {   // tin-plate wall, satin vertical grain
    let s = vnoise(vec3f(lp.x * 140.0, lp.y * 2.0, lp.z * 140.0));
    base = vec3f(0.66, 0.665, 0.67) * (0.94 + 0.1 * s); rough = 0.34 + 0.08 * s;
  } else if (m == 7u) {   // pebbled polymer grip, sage green
    let q = lp * 150.0;
    let p0 = vnoise(q);
    N = normalize(N + vec3f(vnoise(q + vec3f(0.35, 0.0, 0.0)) - p0, vnoise(q + vec3f(0.0, 0.35, 0.0)) - p0, vnoise(q + vec3f(0.0, 0.0, 0.35)) - p0) * 1.6);
    base = vec3f(0.24, 0.33, 0.235) * (0.9 + 0.16 * p0); rough = 0.55; metal = 0.0;
  } else {                // rolled rim
    base = vec3f(0.7, 0.705, 0.71); rough = 0.2;
  }
  return ToolMat(base, rough, metal, N);
}
`;

const SHAPES = ['star', 'heart', 'flower', 'round'];
const HINTS = {
  hand: 'Pull, lift or twist the jelly; scroll or use a second finger to twist what you hold. Drag the empty board to look around.',
  knife: 'Draw a stroke across the jelly: the blade lines up over it and slices on release. A drag far from the jelly looks around.',
  wavy: 'Draw a stroke across the jelly: the crinkle blade presses straight down on release. Cut both ways for crinkle-cut cubes.',
  cutter: 'Click to stamp the cutter through a flat piece; a drag looks around. Then lift the shape out with the hand.',
};
const MESSAGES = {
  miss: 'Place the cutter over the jelly.', notflat: 'Lay that piece flat to stamp it.',
  thin: 'Too thin to cut there.', many: "That's plenty of pieces.",
  cutmiss: 'Missed — draw the blade across the slice.', short: 'Missed — draw the blade across the slice.',
};
const MAX_PIECES = 14, STEP = 1 / 60;
// Colliders: the knife's rounded edge and wedge, the cutter's wall (from its distance field).
const RP = 0.045, RE = 0.04;  // particle radius for the knife's wedge, rounded-edge radius
const RP_RING = 0.022;        // the cutter's thin wall barely spreads the faces: no squeezed shape
// The solver turns every position change into velocity (v = dx / h), so a collider must never jump
// a particle far in one substep: pushes are capped (about 2 units/s) and spread over a few substeps.
const PUSH_CAP = 0.004, SUB_DT = STEP / 8;
const CUTTER_WALL = 0.035, CUTTER_H = 0.95;
const KNIFE_HALF_LEN = KNIFE_LARGE.L / 2, KNIFE_H = KNIFE_LARGE.HB;
const bladeHalf = (h) => (h < 0.32 ? 0.002 + h * (0.023 / 0.32) : 0.025);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
function push(x, i, dx, dy, dz, drag) {
  const l = Math.hypot(dx, dy, dz);
  if (l > PUSH_CAP) { const k = PUSH_CAP / l; dx *= k; dy *= k; dz *= k; }
  x[3 * i] += dx; x[3 * i + 1] += dy + drag; x[3 * i + 2] += dz;
}
/** Cutter orientation: shape-up (+z) points away from the viewer so the shape reads upright on screen. */
function cutterFrame(look) {
  let fx = look.fwd[0], fz = look.fwd[2];
  const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
  // columns: local x -> -right, local y -> up, local z -> forward (all four shapes are left-right symmetric)
  return new Float64Array([fz, 0, fx, 0, 1, 0, -fx, 0, fz]);
}

export async function mount(ctx) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before meshing the slice
  const G = createCitrus();
  let anim = null;   // the running choreography, or null
  const body = createCutBody({
    kernel: G, channels: citrusChannels, maxPieces: MAX_PIECES, beforeStep: (dt) => anim?.tick(dt),
    sim: tetSim({ ZC, RIND_R: RADIUS - 0.19, DENSITY: 1.05, massScale: 1, keScale: 0.05, SUBSTEPS: 10 }),
  });
  const world = body.world, WAVE_K = (2 * Math.PI) / G.WAVE_L;
  const props = createProps({
    knife: knifeMesh(KNIFE_LARGE), wavy: wavyKnifeMesh(G.WAVE_A, G.WAVE_L),
    ...Object.fromEntries(SHAPES.map((k) => [k, cutterMesh(G.cutterShapes[k])])),
  });

  /** Signed distance from the blade (straight, or the crinkle blade's corrugated plane) through O. */
  function bladeSide(px, pz, O, D, N, wavy) {
    const dx = px - O[0], dz = pz - O[2], s = dx * N[0] + dz * N[2];
    return wavy ? s - G.WAVE_A * Math.sin(WAVE_K * (dx * D[0] + dz * D[2])) : s;
  }

  const Coll = { kind: null, wavy: false, O: [0, 0, 0], D: [1, 0, 0], N: [0, 0, 1], vy: 0, sides: new Int8Array(0), R: new Float64Array(9), shape: null };
  world.collider = (x, v, n) => {
    if (!Coll.kind) return;
    const O = Coll.O, piece = world.piece, sides = Coll.sides;
    const drag = Coll.vy < 0 ? Coll.vy * SUB_DT : 0;   // a descending tool drags what it touches down with it
    if (Coll.kind === 'blade') {
      const D = Coll.D, N = Coll.N, wv = Coll.wavy, A = G.WAVE_A;
      for (let i = 0; i < n; i++) {
        const dx = x[3 * i] - O[0], dz = x[3 * i + 2] - O[2], a = dx * D[0] + dz * D[2];
        if (a < -KNIFE_HALF_LEN - RP || a > KNIFE_HALF_LEN + RP) continue;
        const h = x[3 * i + 1] - O[1];
        if (h > KNIFE_H + RP) continue;
        // distance to the blade; the crinkle blade's wedge follows its corrugation
        let s = dx * N[0] + dz * N[2], gx = N[0], gz = N[2];
        if (wv) {
          const c = A * WAVE_K * Math.cos(WAVE_K * a);
          s -= A * Math.sin(WAVE_K * a); gx -= c * D[0]; gz -= c * D[2];
          const gl = Math.hypot(gx, gz); s /= gl; gx /= gl; gz /= gl;
        }
        if (h < 0) {   // under the rounded edge: pressed down and aside, a groove before it gives
          const dd = Math.hypot(s, h), lim = RE + RP;
          if (dd >= lim) continue;
          const ns = dd > 1e-6 ? s * lim / dd : 0, nh = dd > 1e-6 ? h * lim / dd : -lim;
          push(x, i, gx * (ns - s), nh - h, gz * (ns - s), 0);
        } else {        // beside the blade: the wedge eases the faces apart and holds the lips down
          const lim = bladeHalf(h) + RP;
          if (Math.abs(s) >= lim) continue;
          const ds = (sides[piece[i]] || (s >= 0 ? 1 : -1)) * lim - s;
          push(x, i, gx * ds, 0, gz * ds, drag);
        }
      }
    } else {
      const R = Coll.R, shape = Coll.shape, half = CUTTER_WALL / 2, ext = shape.extent + 0.15, e = 0.006;
      for (let i = 0; i < n; i++) {
        const d0 = x[3 * i] - O[0], d2 = x[3 * i + 2] - O[2], h = x[3 * i + 1] - O[1];
        if (h > CUTTER_H + RP_RING) continue;
        const lx = R[0] * d0 + R[6] * d2, lz = R[2] * d0 + R[8] * d2;
        if (Math.abs(lx) > ext || Math.abs(lz) > ext) continue;
        const sd = shape.field(lx, lz);
        if (Math.abs(sd) > RE + RP_RING + half) continue;
        let gx = shape.field(lx + e, lz) - shape.field(lx - e, lz), gz = shape.field(lx, lz + e) - shape.field(lx, lz - e);
        const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;
        const wx = R[0] * gx + R[2] * gz, wz = R[6] * gx + R[8] * gz;   // local gradient -> world
        if (h < 0) {    // under the rolled cutting edge
          const dd = Math.hypot(sd, h), lim = RE * 0.6 + RP_RING;
          if (dd >= lim) continue;
          const ns = dd > 1e-6 ? sd * lim / dd : 0, nh = dd > 1e-6 ? h * lim / dd : -lim;
          push(x, i, wx * (ns - sd), nh - h, wz * (ns - sd), 0);
        } else {         // beside the wall
          const lim = half + RP_RING;
          if (Math.abs(sd) >= lim) continue;
          const ds = (sides[piece[i]] || (sd >= 0 ? 1 : -1)) * lim - sd;
          push(x, i, wx * ds, 0, wz * ds, drag);
        }
      }
    }
  };

  // The tools need the camera (blade handedness, the cutter's frame), so they are built with the page.
  function boardTools({ R, state, rayAt, toPx }) {
    const { $, toast } = ctx.stage, on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ctx.signal });
    const look = R.look, tool = { name: 'hand', shape: 'star' };
    const isKnife = () => tool.name === 'knife' || tool.name === 'wavy';
    const Tools = {
      knife: { O: [0, 0.3, 0], D: [1, 0, 0], show: false, wavy: false },
      cutter: { O: [0, 0.3, 0], R: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), show: false, waiting: false },
      knifeM: new Float32Array(16), cutterM: new Float32Array(16),
    };

    // ----- planning: the expensive part runs the moment the user commits -----
    function planCut(S, E, wavy = false) {
      const dx = E[0] - S[0], dz = E[2] - S[2], len = Math.hypot(dx, dz);
      if (len < 0.12) return { ok: false, reason: 'short' };
      let D = [dx / len, 0, dz / len];
      if (D[0] * look.right[0] + D[2] * look.right[2] < 0) D = [-D[0], 0, -D[2]];   // handle on the left
      const N = [-D[2], 0, D[0]], x = world.x, mid = [(S[0] + E[0]) / 2, 0, (S[2] + E[2]) / 2];
      const crossed = [];
      let top = 0;
      world.pieces.forEach((pc, k) => {
        let pos = false, neg = false;
        for (let i = pc.start; i < pc.start + pc.count; i++) {
          const rx = x[3 * i] - mid[0], rz = x[3 * i + 2] - mid[2], a = rx * D[0] + rz * D[2];
          if (a < -len / 2 - 0.35 || a > len / 2 + 0.35) continue;
          const s = bladeSide(x[3 * i], x[3 * i + 2], mid, D, N, wavy);
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
        // world blade: s = N.(X - mid), u = D.(X - mid), with X = R (Xr - cr) + cx at mid-thickness Xr = (x, T/2, z)
        const cs = nr[1] * THICK / 2 - (nr[0] * f.cr[0] + nr[1] * f.cr[1] + nr[2] * f.cr[2]) + N[0] * (f.cx[0] - mid[0]) + N[2] * (f.cx[2] - mid[2]);
        let res;
        if (!wavy) res = G.splitByLine(body.pieces[k].region, nr[0] / L2, nr[2] / L2, -cs / L2);
        else {
          const dr = [Rm[0] * D[0] + Rm[3] * D[1] + Rm[6] * D[2], Rm[1] * D[0] + Rm[4] * D[1] + Rm[7] * D[2], Rm[2] * D[0] + Rm[5] * D[1] + Rm[8] * D[2]];
          const cu = dr[1] * THICK / 2 - (dr[0] * f.cr[0] + dr[1] * f.cr[1] + dr[2] * f.cr[2]) + D[0] * (f.cx[0] - mid[0]) + D[2] * (f.cx[2] - mid[2]);
          res = G.splitByWave(body.pieces[k].region, nr[0], nr[2], cs, dr[0], dr[2], cu);
        }
        if (!res.ok) continue;
        split.push(k);
        for (const region of res.pieces) made.push(body.makePiece(region));
      }
      if (!split.length) return { ok: false, reason: 'thin' };
      if (body.pieces.length - split.length + made.length > MAX_PIECES) return { ok: false, reason: 'many' };
      return { ok: true, kind: 'cut', wavy, S, E, D, N, mid, len, top, crossed: new Set(split), made };
    }
    function planStamp(C, shapeName, Rc) {
      const shape = G.cutterShapes[shapeName], x = world.x, ext = shape.extent + 0.06;
      const local = (p) => {   // world -> cutter local (x, z)
        const d0 = p[0] - C[0], d2 = p[2] - C[2];
        return [Rc[0] * d0 + Rc[6] * d2, Rc[2] * d0 + Rc[8] * d2];
      };
      const under = [];
      let top = 0;
      world.pieces.forEach((pc, k) => {
        let hit = false;
        for (let i = pc.start; i < pc.start + pc.count; i++) {
          const l = local([x[3 * i], 0, x[3 * i + 2]]);
          if (Math.abs(l[0]) > ext || Math.abs(l[1]) > ext) continue;
          if (shape.field(l[0], l[1]) < 0.05) { hit = true; if (x[3 * i + 1] > top) top = x[3 * i + 1]; }
        }
        if (hit) under.push(k);
      });
      if (!under.length) return { ok: false, reason: 'miss' };
      const flat = under.filter((k) => Math.abs(body.fitFrame(k).up[1]) > 0.9);
      if (!flat.length) return { ok: false, reason: 'notflat' };
      const made = [], inside = [], crossed = [];
      const tmp = [0, 0, 0];
      for (const k of flat) {
        const f = body.fitFrame(k);
        const toLocal = (rx, rz, out) => {
          body.toWorld(f, [rx, THICK / 2, rz], tmp);
          const l = local(tmp); out[0] = l[0]; out[1] = l[1];
        };
        const res = G.splitByCutter(body.pieces[k].region, shape, toLocal, CUTTER_WALL);
        if (!res.ok) continue;
        crossed.push(k);
        for (const region of res.inside) { inside.push(made.length); made.push(body.makePiece(region)); }
        for (const region of res.outside) made.push(body.makePiece(region));
      }
      if (!crossed.length) return { ok: false, reason: 'miss' };
      if (body.pieces.length - crossed.length + made.length > MAX_PIECES) return { ok: false, reason: 'many' };
      return { ok: true, kind: 'stamp', C: [C[0], 0, C[2]], Rc, shape: shapeName, top, crossed: new Set(crossed), made, inside: new Set(inside) };
    }

    // ----- tool poses and the two choreographies (on simulation time, so pause and 1/4 speed apply) -----
    function knifeMatrix() {
      const { O, D } = Tools.knife, Z = [-D[2], 0, D[0]];
      // local x -> D, y -> up, z -> D x up; the edge midpoint (local x = L / 2) sits at O
      return M4.model([D[0], 0, Z[0], 0, 1, 0, D[2], 0, Z[2]], [O[0] - D[0] * KNIFE_HALF_LEN, O[1], O[2] - D[2] * KNIFE_HALF_LEN], Tools.knifeM);
    }
    const cutterMatrix = () => M4.model(Tools.cutter.R, Tools.cutter.O, Tools.cutterM);
    function startCut(plan) {
      const k = Tools.knife, from = { O: k.O.slice(), D: k.D.slice() };
      const D = plan.D, N = plan.N, top = plan.top, hover = top + 0.32;
      // the straight blade slices forward through the press; the crinkle blade presses straight down
      const slide = (t) => plan.wavy ? 0 : t < 0.18 ? -0.3 : t < 0.8 ? lerp(-0.3, 0.3, ease((t - 0.18) / 0.62)) : 0.3;
      const yAt = (t) => t < 0.18 ? lerp(Math.max(from.O[1], top + 0.08), top + 0.08, ease(t / 0.18))   // glide in above the jelly
        : t < 0.45 ? lerp(top + 0.08, Math.max(0.02, top - 0.18), ease((t - 0.18) / 0.27))
        : t < 0.72 ? lerp(Math.max(0.02, top - 0.18), -0.004, ease((t - 0.45) / 0.27))
        : t < 0.8 ? -0.004 : lerp(-0.004, hover, ease((t - 0.8) / 0.3));
      let t = 0, swapped = false, lastY = yAt(0);
      k.show = true; k.wavy = plan.wavy; Tools.cutter.show = false; Tools.cutter.waiting = false;
      Coll.kind = 'blade'; Coll.wavy = plan.wavy; Coll.D = D; Coll.N = N; Coll.sides = new Int8Array(MAX_PIECES + 1);
      anim = {
        kind: 'cut',
        tick(dt) {
          t += dt;
          const a = ease(t / 0.18);
          k.D = [lerp(from.D[0], D[0], a), 0, lerp(from.D[2], D[2], a)];
          const l = Math.hypot(k.D[0], k.D[2]) || 1; k.D[0] /= l; k.D[2] /= l;
          const y = yAt(t), sl = slide(t);
          k.O = [lerp(from.O[0], plan.mid[0] + D[0] * sl, a), y, lerp(from.O[2], plan.mid[2] + D[2] * sl, a)];
          Coll.O = [plan.mid[0] + D[0] * sl, y, plan.mid[2] + D[2] * sl];
          Coll.vy = (y - lastY) / Math.max(dt, 1e-4); lastY = y;
          if (!swapped && t >= 0.45) {
            swapped = true;
            const made = body.swapIn(plan);
            Coll.sides = new Int8Array(MAX_PIECES + 1);
            for (const j of made) {   // which side of the blade each new piece lies on
              const pc = world.pieces[j];
              let s = 0;
              for (let i = pc.start; i < pc.start + pc.count; i++) s += bladeSide(world.x[3 * i], world.x[3 * i + 2], plan.mid, D, N, plan.wavy);
              Coll.sides[j] = s >= 0 ? 1 : -1;
            }
          }
          if (t >= 1.1) { Coll.kind = null; anim = null; }
        },
      };
    }
    function startStamp(plan) {
      const c = Tools.cutter, from = c.O.slice(), top = plan.top, high = Math.max(1.35, top + 1.0);
      const yAt = (t) => t < 0.15 ? lerp(Math.max(from[1], top + 0.08), top + 0.08, ease(t / 0.15))
        : t < 0.42 ? lerp(top + 0.08, Math.max(0.02, top - 0.16), ease((t - 0.15) / 0.27))
        : t < 0.6 ? lerp(Math.max(0.02, top - 0.16), -0.004, ease((t - 0.42) / 0.18))
        : t < 0.8 ? -0.004 : lerp(-0.004, high, ease((t - 0.8) / 0.45));
      let t = 0, swapped = false, popped = false, lastY = yAt(0), newIdx = [];
      c.R = plan.Rc; c.show = true; c.waiting = false; Tools.knife.show = false;
      Coll.kind = 'ring'; Coll.R = plan.Rc; Coll.shape = G.cutterShapes[plan.shape]; Coll.sides = new Int8Array(MAX_PIECES + 1);
      anim = {
        kind: 'stamp',
        tick(dt) {
          t += dt;
          const a = ease(t / 0.15), y = yAt(t);
          c.O = [lerp(from[0], plan.C[0], a), y, lerp(from[2], plan.C[2], a)];
          Coll.O = [plan.C[0], y, plan.C[2]];
          Coll.vy = (y - lastY) / Math.max(dt, 1e-4); lastY = y;
          if (!swapped && t >= 0.42) {
            swapped = true;
            newIdx = body.swapIn(plan);
            Coll.sides = new Int8Array(MAX_PIECES + 1);
            newIdx.forEach((j, i) => { Coll.sides[j] = plan.inside.has(i) ? -1 : 1; });
          }
          if (swapped && !popped && t >= 0.62) {   // the stamped shape pops up a little
            popped = true;
            newIdx.forEach((j, i) => {
              if (!plan.inside.has(i)) return;
              const pc = world.pieces[j];
              for (let p = pc.start; p < pc.start + pc.count; p++) world.v[3 * p + 1] += 0.55;
            });
          }
          if (t >= 0.8 && Coll.kind) Coll.kind = null;   // the ring lifts clear
          if (t >= 1.25) { anim = null; c.waiting = true; }
        },
      };
    }

    // ----- controls -----
    const shapes = $('#shapes'), hint = $('#hint');
    function setTool(t) {
      tool.name = t;
      $(`input[name="tool"][value="${t}"]`).checked = true;
      shapes.dataset.dim = String(t !== 'cutter');
      hint.textContent = HINTS[t];
      Tools.cutter.waiting = false;
      ctx.canvas.style.cursor = t === 'hand' ? '' : 'crosshair';
      if (!anim) Tools.knife.wavy = t === 'wavy';
    }
    function setShape(s) { tool.shape = s; $(`input[name="shape"][value="${s}"]`).checked = true; }
    document.querySelectorAll('input[name="tool"]').forEach((el) => on(el, 'change', () => setTool(el.value)));
    document.querySelectorAll('input[name="shape"]').forEach((el) => on(el, 'change', () => { setShape(el.value); setTool('cutter'); }));
    setTool('hand');

    // ----- the knife guide (a stroke on screen) -----
    const guide = { line: $('#guide-line'), a: $('#guide-a'), b: $('#guide-b') };
    function showGuide(S, E) {
      const r = ctx.canvas.getBoundingClientRect(), pa = R.project(S, r.width, r.height), pb = R.project(E, r.width, r.height);
      guide.line.setAttribute('x1', pa[0]); guide.line.setAttribute('y1', pa[1]); guide.line.setAttribute('x2', pb[0]); guide.line.setAttribute('y2', pb[1]);
      guide.a.setAttribute('cx', pa[0]); guide.a.setAttribute('cy', pa[1]); guide.b.setAttribute('cx', pb[0]); guide.b.setAttribute('cy', pb[1]);
      for (const el of [guide.line, guide.a, guide.b]) el.setAttribute('visibility', 'visible');
    }
    const hideGuide = () => { for (const el of [guide.line, guide.a, guide.b]) el.setAttribute('visibility', 'hidden'); };
    ctx.signal.addEventListener('abort', hideGuide);

    // ----- tool hover poses (between choreographies) -----
    let S = null, E = null, downAt = null, stroking = false, hover = null, hoverDirty = false;
    function updateTools() {
      if (anim) return;
      const k = Tools.knife, c = Tools.cutter;
      let rx = look.right[0], rz = look.right[2];
      const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      if (isKnife()) {
        k.wavy = tool.name === 'wavy';
        if (stroking && S && E) {
          let dx = E[0] - S[0], dz = E[2] - S[2];
          const l = Math.hypot(dx, dz);
          if (l > 0.05) { dx /= l; dz /= l; if (dx * rx + dz * rz < 0) { dx = -dx; dz = -dz; } k.D = [dx, 0, dz]; }
          k.O = [(S[0] + E[0]) / 2, body.topNear((S[0] + E[0]) / 2, (S[2] + E[2]) / 2, 0.6) + 0.06, (S[2] + E[2]) / 2];
        } else if (hover && hoverDirty) {
          const { ro, rd } = rayAt(hover[0], hover[1]), L = body.landing(ro, rd);
          k.D = [rx, 0, rz]; k.O = [L.p[0], L.p[1] + 0.02, L.p[2]];
        }
        k.show = !!hover || stroking;
      } else k.show = false;
      if (tool.name === 'cutter') {
        if (!c.waiting && hover && hoverDirty) {
          const { ro, rd } = rayAt(hover[0], hover[1]), L = body.landing(ro, rd);
          c.O = [L.p[0], (L.onJelly ? L.p[1] : body.topNear(L.p[0], L.p[2], 0.6)) + 0.08, L.p[2]];
          c.R = cutterFrame(look);
        }
        c.show = !!hover || c.waiting;
      } else c.show = false;
      hoverDirty = false;
    }

    return {
      down(e, { ro, rd }) {
        downAt = [e.clientX, e.clientY];
        if (anim) return 'orbit';
        if (tool.name === 'hand') return null;
        if (!isKnife()) return 'cutterDown';
        const L = body.landing(ro, rd);
        if (!L.onJelly && !body.nearJelly(L.p, 0.7)) return 'orbit';
        S = L.p; E = L.p; stroking = true; showGuide(S, E);
        return 'stroke';
      },
      move(e, { ro, rd }, mode) {
        if (mode === 'stroke') { E = body.landing(ro, rd).p; showGuide(S, E); return mode; }
        return Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6 ? 'orbit' : mode;   // a drag from the cutter looks around
      },
      up(e, { ro, rd }, mode) {
        if (mode === 'stroke') {
          stroking = false; hideGuide();
          const plan = planCut(S, E, tool.name === 'wavy');
          if (plan.ok) startCut(plan); else if (MESSAGES[plan.reason]) toast(MESSAGES[plan.reason]);
        } else if (e.type === 'pointerup') {
          const plan = planStamp(body.landing(ro, rd).p, tool.shape, cutterFrame(look));
          if (plan.ok) startStamp(plan); else toast(MESSAGES[plan.reason]);
        }
      },
      hover(e, mode) {
        if (!e) { hover = null; return; }
        hover = [e.clientX, e.clientY]; hoverDirty = true;
        if (Tools.cutter.waiting && !mode) Tools.cutter.waiting = false;
      },
      key(k) {
        if (k === 'h') setTool('hand');
        else if (k === 'k') setTool('knife');
        else if (k === 'w') setTool('wavy');
        else if (k === 'c') setTool('cutter');
        else if (k >= '1' && k <= '4') { setShape(SHAPES[+k - 1]); setTool('cutter'); }
      },
      frame() {
        updateTools();
        const k = Tools.knife, c = Tools.cutter, st = props.state;
        st.draw.length = 0;
        if (k.show) { st.draw.push(k.wavy ? 'wavy' : 'knife'); st.A = knifeMatrix(); }
        if (c.show) { st.draw.push(tool.shape); st.B = cutterMatrix(); }
      },
      cursor: () => (tool.name === 'hand' ? '' : 'crosshair'),
      reset() { if (anim) return false; Coll.kind = null; },
      hook: {
        anim: () => anim && anim.kind, toast, setTool, setShape,
        planCut(sx, sy, ex, ey, wavy = false) {
          const a = toPx(sx, sy), b = toPx(ex, ey), r1 = rayAt(a[0], a[1]), r2 = rayAt(b[0], b[1]);
          return planCut(body.landing(r1.ro, r1.rd).p, body.landing(r2.ro, r2.rd).p, wavy);
        },
        startCut(plan) { if (plan && plan.ok && !anim) { setTool(plan.wavy ? 'wavy' : 'knife'); startCut(plan); return true; } return false; },
        planStamp(x, y, shape = tool.shape) { const [px, py] = toPx(x, y), { ro, rd } = rayAt(px, py); return planStamp(body.landing(ro, rd).p, shape, cutterFrame(look)); },
        startStamp(plan) { if (plan && plan.ok && !anim) { setShape(plan.shape); setTool('cutter'); Tools.cutter.show = true; startStamp(plan); return true; } return false; },
        setVariety(v) { state.preset = v; $(`input[name="variety"][value="${v}"]`).checked = true; },
      },
    };
  }

  return runJellyPage(ctx, {
    sim: body,
    renderer: {
      paper: '#f2ece2', shadowRadius: 2.8, helpers: CITRUS_HELPERS, material: CITRUS_MATERIAL,
      passes: PROPS_WGSL + TOOL_WGSL + SKINNED_WGSL + CITRUS_MEMBRANES,
      plugins: [props.plugin, skinnedPlugin('membranes', 'fsMem', { over: true })],
    },
    presets: CITRUS_PRESETS, preset: 'orange',
    camera: { yaw: Math.PI - 0.38, pitch: 0.8, target: [0, 0.12, 0.08], pitchRange: [0.22, 1.3], yawRange: 1.3, fit: [3.1, 4.3], frame: { x0: 0, y0: 0.5, aspect: 1.45 }, zoomRange: [0.62, 1.55] },
    massDigits: 2, keDigits: 2, tools: boardTools,
  });
}
