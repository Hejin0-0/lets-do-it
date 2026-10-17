// 03 — Dolphin Jelly: a big two-layer gummy dolphin, clear blue on top and cream below, lying on its
// belly. Bend its tail, lift its beak, roll it over; it wobbles back.
import { runJellyPage, latticeMeshes } from '../../core/jelly/page.js';
import { DolphinSim } from './sim.js';
import { helpers, material } from './material.js';

export const meta = {
  id: '03', name: 'Dolphin Jelly', noun: 'dolphin', paper: '#f2efe8', fig: 'fig. 3',
  eyebrow: 'Material Studies / No. 003', title: ['Dolphin', 'Jelly.'],
  caption: ['Poured in two layers.', 'Clear blue over cream.', 'Bend its tail and let go.'],
  aria: 'Interactive 3D two-layer gummy dolphin, clear blue on top and cream underneath, lying on a studio floor. Drag its tail, a fin or its beak to bend it; drag the empty floor to turn the view.',
};

const dolphinIcon = (gel, edge) => `<svg viewBox="0 0 44 24" aria-hidden="true"><path d="M3 15 Q8 9 18 9 Q22 4 25 5 Q24 8 26 9 Q34 10 40 14 L42 15.5 Q36 15 33 16 L32 19 L4 19 Q3 17 3 15Z" fill="${gel}" stroke="${edge}" stroke-width="0.9" stroke-linejoin="round"/><path d="M4 17.5 L32 17.5 L32 19 L4 19Z" fill="#f4efe4"/><path d="M3 15 L0.5 11.5 M3 15 L0.8 18.5" stroke="${edge}" stroke-width="1.6" stroke-linecap="round"/><circle cx="35" cy="12.6" r="0.9" fill="#13151c"/></svg>`;

export const panel = /* html */`
<div class="group">
  <div class="label" id="variety-label"><span>Flavour</span></div>
  <div class="swatches" role="radiogroup" aria-labelledby="variety-label">
    <label class="swatch"><input type="radio" name="variety" value="ocean" checked>${dolphinIcon('#2c63c9', '#173a85')}<span class="name">Ocean</span></label>
    <label class="swatch"><input type="radio" name="variety" value="lagoon">${dolphinIcon('#2bb8a8', '#137468')}<span class="name">Lagoon</span></label>
    <label class="swatch"><input type="radio" name="variety" value="grape">${dolphinIcon('#8a4fd0', '#56258f')}<span class="name">Grape</span></label>
  </div>
</div>
<div class="group">
  <label class="label" for="firm"><span>Firmness</span><output id="firm-out" for="firm">50</output></label>
  <input id="firm" type="range" min="0" max="100" value="50" aria-label="Firmness">
  <div class="ends" aria-hidden="true"><span>bendy</span><span>chewy</span></div>
</div>
<div class="group">
  <label class="label" for="damp"><span>Internal damping</span><output id="damp-out" for="damp">25</output></label>
  <input id="damp" type="range" min="0" max="100" value="25" aria-label="Internal damping">
  <div class="ends" aria-hidden="true"><span>wobbly</span><span>calm</span></div>
</div>
<div class="group row4">
  <button class="btn wide" id="nudge" type="button">Give it a nudge</button>
  <button class="btn" id="flip" type="button">Roll it over</button>
  <button class="btn" id="reset" type="button">Reset</button>
  <button class="btn" id="pause" type="button" aria-pressed="false">Pause</button>
  <button class="btn" id="view" type="button">Reset view</button>
</div>
<div class="group checks">
  <label class="check"><input type="checkbox" id="slow">¼ speed</label>
  <label class="check"><input type="checkbox" id="mesh">Show mesh</label>
</div>`;

export const foot = /* html */`
<p class="hint" id="hint">Grab the tail, a fin or the beak and pull; scroll or use a second finger to twist what you hold. Roll it over to see the cream underneath.</p>
<dl class="readouts">
  <div class="readout"><dt>Mass</dt><dd id="ro-mass">–</dd></div>
  <div class="readout"><dt>Volume</dt><dd id="ro-vol">–</dd></div>
  <div class="readout"><dt>Kinetic</dt><dd id="ro-ke">–</dd></div>
</dl>
<p class="units">Illustrative scale: 1 unit ≈ 7 cm, so the dolphin is about 20 cm from beak to tail, gummy at 1.25 g/cm³. Volume is relative to the rest volume; gravity and time are eased so the motion reads.</p>`;

export const notes = /* html */`
<h3>The body</h3>
<p id="note-body">A lattice of tetrahedra fills the dolphin. Every edge is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out. The tail and the fins are given more compliant connections, so they bend before the body does.</p>
<h3>The two layers</h3>
<p>A big gummy like this is poured in two goes: a cream layer first, then the clear coloured gel over it. The layers are laid out in the dolphin's own rest space, so the line between them bends with the body. Looking down through the gel, each bent ray is followed until it leaves the gel or meets the cream; where it meets the cream, the cream shows through, tinted by the depth of gel above it.</p>
<h3>The surface</h3>
<p>The smooth dolphin you see is a finer mesh from a signed distance field (a body of blended ellipsoids, the beak, the forehead, three blades for the fins and two for the flukes, a blowhole and the line of the mouth), cut flat where it lay in the mould. The eyes are moulded bumps, dark and glossy on the surface.</p>
<h3>The light</h3>
<p>Native WebGPU. A back-face pass measures how much gel each ray crosses for Beer–Lambert absorption, so the thick body is deep and the thin fins and tail run lighter. The light that passes through tints the floor, gathered into a brighter core where the body is thickest.</p>`;

// Three flavours: the gel's absorption (deep in the body, light in the fins), its haze and glow; the cream is the same.
const PRESETS = {
  ocean:  { absorb: [7.5, 3.4, 0.72], scatter: [0.2, 0.4, 0.85], palette: ['#d8ecff', '#62b6ff', '#f4efe4'] },
  lagoon: { absorb: [7.0, 1.25, 2.1], scatter: [0.18, 0.6, 0.55], palette: ['#d9fff4', '#4fe0c8', '#f4efe4'] },
  grape:  { absorb: [3.2, 7.0, 1.35], scatter: [0.6, 0.3, 0.8], palette: ['#efdcff', '#b07cff', '#f4efe4'] },
};

export async function mount(ctx) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before the build
  const sim = DolphinSim.create({ tapSeed: Date.now() | 0 });
  await runJellyPage(ctx, {
    sim, meshes: latticeMeshes(sim), presets: PRESETS, preset: 'ocean', massDigits: 0,
    renderer: {
      paper: meta.paper, helpers, material, meshAlpha: 0.2, replace: { CAUSTIC: 'const CAUSTIC = 1.0;' },
    },
    camera: { yaw: 0.42, pitch: 0.55, target: [0, 0.22, 0], pitchRange: [0.1, 1.42], fit: [2.8, 3.5] },
    note: (s) => `A lattice of ${s.nt.toLocaleString()} tetrahedra on ${s.n.toLocaleString()} nodes fills the dolphin. Each of its ${s.ne.toLocaleString()} edges is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out. The tail and the fins are given more compliant connections, so they bend before the body does.`,
  });
  return { unmount() {} };
}
