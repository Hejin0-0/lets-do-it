// 02 — Gummy Bear: a translucent gummy bear sitting up, legs out in front. Grab an ear, a paw or a foot,
// stretch it, turn it over, give it a coat of sugar.
import { runJellyPage, latticeMeshes } from '../../core/jelly/page.js';
import { BearSim } from './sim.js';
import { helpers, gummyMaterial } from '../../core/jelly/gummy.js';

export const meta = {
  id: '02', name: 'Gummy Bear', noun: 'bear', paper: '#f4ede1', badge: '<span class="badge" title="Illustrative density of the gummy"><abbr title="density">ρ</abbr> 1.25 g/cm³</span>',
  eyebrow: 'Material Studies / No. 002', title: ['Gummy', 'Bear.'],
  caption: ['A little sweetness.', 'Sitting up for you.', 'A very soft bear.'],
  aria: 'Interactive 3D gummy bear sitting on a studio floor, legs out in front. Drag an ear, a paw, a foot or the tummy to stretch it; drag the empty floor to turn the view.',
};

export const panel = /* html */`
<div class="group">
  <div class="label" id="variety-label"><span>Flavour</span></div>
  <div class="swatches" role="radiogroup" aria-labelledby="variety-label">
    <label class="swatch"><input type="radio" name="variety" value="honey" checked><svg viewBox="0 0 30 30" aria-hidden="true"><g fill="#f2b33a" stroke="#c97a12" stroke-width="1.1" stroke-linejoin="round" paint-order="stroke"><circle cx="9.6" cy="4.6" r="2.7"/><circle cx="20.4" cy="4.6" r="2.7"/><circle cx="7.2" cy="15.6" r="2.6"/><circle cx="22.8" cy="15.6" r="2.6"/><ellipse cx="10.6" cy="26.2" rx="3.3" ry="2.8"/><ellipse cx="19.4" cy="26.2" rx="3.3" ry="2.8"/><ellipse cx="15" cy="19.6" rx="7.4" ry="7.6"/><ellipse cx="15" cy="8.6" rx="6.6" ry="5.8"/></g><ellipse cx="12" cy="6.6" rx="2.2" ry="1.1" fill="#fff" opacity="0.55"/><ellipse cx="11.6" cy="17" rx="1.5" ry="2.6" fill="#fff" opacity="0.32"/></svg><span class="name">Honey</span></label>
    <label class="swatch"><input type="radio" name="variety" value="cherry"><svg viewBox="0 0 30 30" aria-hidden="true"><g fill="#df3346" stroke="#9c1426" stroke-width="1.1" stroke-linejoin="round" paint-order="stroke"><circle cx="9.6" cy="4.6" r="2.7"/><circle cx="20.4" cy="4.6" r="2.7"/><circle cx="7.2" cy="15.6" r="2.6"/><circle cx="22.8" cy="15.6" r="2.6"/><ellipse cx="10.6" cy="26.2" rx="3.3" ry="2.8"/><ellipse cx="19.4" cy="26.2" rx="3.3" ry="2.8"/><ellipse cx="15" cy="19.6" rx="7.4" ry="7.6"/><ellipse cx="15" cy="8.6" rx="6.6" ry="5.8"/></g><ellipse cx="12" cy="6.6" rx="2.2" ry="1.1" fill="#fff" opacity="0.55"/><ellipse cx="11.6" cy="17" rx="1.5" ry="2.6" fill="#fff" opacity="0.32"/></svg><span class="name">Cherry</span></label>
    <label class="swatch"><input type="radio" name="variety" value="emerald"><svg viewBox="0 0 30 30" aria-hidden="true"><g fill="#33ad62" stroke="#14753a" stroke-width="1.1" stroke-linejoin="round" paint-order="stroke"><circle cx="9.6" cy="4.6" r="2.7"/><circle cx="20.4" cy="4.6" r="2.7"/><circle cx="7.2" cy="15.6" r="2.6"/><circle cx="22.8" cy="15.6" r="2.6"/><ellipse cx="10.6" cy="26.2" rx="3.3" ry="2.8"/><ellipse cx="19.4" cy="26.2" rx="3.3" ry="2.8"/><ellipse cx="15" cy="19.6" rx="7.4" ry="7.6"/><ellipse cx="15" cy="8.6" rx="6.6" ry="5.8"/></g><ellipse cx="12" cy="6.6" rx="2.2" ry="1.1" fill="#fff" opacity="0.55"/><ellipse cx="11.6" cy="17" rx="1.5" ry="2.6" fill="#fff" opacity="0.32"/></svg><span class="name">Emerald</span></label>
  </div>
</div>
<div class="group">
  <label class="label" for="firm"><span>Firmness</span><output id="firm-out" for="firm">50</output></label>
  <input id="firm" type="range" min="0" max="100" value="50" aria-label="Firmness">
  <div class="ends" aria-hidden="true"><span>squishy</span><span>chewy</span></div>
</div>
<div class="group">
  <label class="label" for="damp"><span>Internal damping</span><output id="damp-out" for="damp">25</output></label>
  <input id="damp" type="range" min="0" max="100" value="25" aria-label="Internal damping">
  <div class="ends" aria-hidden="true"><span>wobbly</span><span>calm</span></div>
</div>
<div class="group row4">
  <button class="btn wide" id="nudge" type="button">Give it a nudge</button>
  <button class="btn" id="flip" type="button">Turn it over</button>
  <button class="btn" id="reset" type="button">Reset</button>
  <button class="btn" id="pause" type="button" aria-pressed="false">Pause</button>
  <button class="btn" id="view" type="button">Reset view</button>
</div>
<div class="group checks">
  <label class="check"><input type="checkbox" id="sugar">Sugar coat</label>
  <label class="check"><input type="checkbox" id="slow">¼ speed</label>
  <label class="check"><input type="checkbox" id="mesh">Show mesh</label>
</div>`;

export const foot = /* html */`
<p class="hint" id="hint">Pick it up by an ear, a paw, a foot or the tummy and pull; scroll while holding to twist. Drag the floor to walk round it, or right-click / Shift-drag anywhere.</p>
<dl class="readouts">
  <div class="readout"><dt>Mass</dt><dd id="ro-mass">–</dd></div>
  <div class="readout"><dt>Rest volume</dt><dd id="ro-vol">–</dd></div>
  <div class="readout"><dt>Kinetic</dt><dd id="ro-ke">–</dd></div>
</dl>
<p class="units">Illustrative only: 1 unit ≈ 1.5 cm, so the bear sits about 2.3 cm tall, gummy at 1.25 g/cm³. Volume is relative to the rest volume; gravity and time are eased so the motion reads.</p>`;

export const notes = /* html */`
<h3>The body</h3>
<p id="note-body">A lattice of tetrahedra fills the bear. Every edge is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out.</p>
<h3>The motion</h3>
<p>Fixed 1/120 s steps, six substeps each, at most four steps per frame. Damping acts only on how fast neighbours move apart, never on a fall, so the bear rests in the same shape however calm you make it. The floor pushes back with friction; a pulled ear drags the head, and the head answers a moment later.</p>
<h3>The surface</h3>
<p>The smooth bear you see is a separate, finer mesh from a signed distance field (body, tummy, head, muzzle, nose, ears with their hollows, arms, legs and feet blended into one volume, eyes pressed in). Each vertex rides inside one tetrahedron and follows it on the GPU, and the bubbles do the same.</p>
<h3>The light</h3>
<p>Native WebGPU. A back-face pass measures how much gummy each ray crosses for Beer–Lambert absorption, so ears, paws and stretched places glow while the tummy stays deep. The front refracts the studio behind it under a wet gloss; the floor's soft shadow is tinted by the light that passes through, brighter where the body gathers it. A coat of sugar frosts the gloss, and each crystal catches the light on its own facet.</p>`;

// Three flavours. Only the colour changes: absorption per unit of path (which also tints the shadow),
// scattering, the sugar haze and the glow of thin places. Density, gloss and refraction are shared.
const FLAVOURS = {
  honey:   { absorb: [0.42, 1.7, 6.0], scatter: [1.0, 0.55, 0.1], haze: '#fbeccb', glow: '#f2a024' },
  cherry:  { absorb: [0.75, 7.0, 5.4], scatter: [1.0, 0.1, 0.13], haze: '#fbdde0', glow: '#ea2c44' },
  emerald: { absorb: [7.6, 1.15, 4.6], scatter: [0.1, 1.0, 0.42], haze: '#dcf3e6', glow: '#14b058' },
};
const PRESETS = Object.fromEntries(Object.entries(FLAVOURS).map(([k, t]) => [k, { absorb: t.absorb, scatter: t.scatter, palette: [t.haze, t.glow] }]));

export async function mount(ctx) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before the build
  const sim = BearSim.create({ tapSeed: Date.now() | 0 });
  let sugar = 0;
  ctx.stage.$('#sugar')?.addEventListener('change', (e) => { sugar = e.target.checked ? 1 : 0; }, { signal: ctx.signal });
  await runJellyPage(ctx, {
    sim, meshes: latticeMeshes(sim), presets: PRESETS, preset: 'honey', massDigits: 1,
    renderer: { paper: meta.paper, helpers, material: gummyMaterial('wet'), meshAlpha: 0.2, replace: { CAUSTIC: 'const CAUSTIC = 1.0;' } },
    camera: { yaw: 0.26, pitch: 0.36, target: [0, 0.68, 0.06], pitchRange: [0.05, 1.42], fit: [2.5, 3.0] },
    look: () => ({ prm: [[sugar, 0, 0, 0]] }),
    note: (sim) => `A lattice of ${sim.nt.toLocaleString()} tetrahedra on ${sim.n.toLocaleString()} nodes fills the bear, ears, paws and feet included. Each of its ${sim.ne.toLocaleString()} edges is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out. No edge may stretch past 1.8× or shrink below 0.4× its rest length, however hard you pull.`,
    coarseHint: 'Put a finger on an ear, a paw or the tummy and pull; a second finger twists it. A finger on the floor walks round the bear; pinch to zoom.',
  });
  return { unmount() {} };
}
