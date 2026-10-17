// 04 — Custard Pudding: a custard turned out of its cup onto a porcelain plate, caramel on its crown,
// running down its sides and pooled round its base. Tap it, pull it, let it shiver.
import { runJellyPage, latticeMeshes } from '../../core/jelly/page.js';
import { instancedPlugin } from '../../core/jelly/plugins.js';
import { plateLook, platePlugin } from '../../core/jelly/plate.js';
import { PuddingSim } from './sim.js';
import { helpers, material, POOL, SPECKS_WGSL, SPECK_QUAD } from './material.js';

export const meta = {
  id: '04', name: 'Custard Pudding', noun: 'pudding', paper: '#f3ece2', fig: 'fig. 4',
  eyebrow: 'Material Studies / No. 004', title: ['Custard', 'Pudding.'],
  caption: ['Turned out of its cup.', 'A caramel crown.', 'Tap it and it shivers.'],
  aria: 'Interactive 3D custard pudding with caramel sauce, standing on a porcelain plate. Drag the top or a side to pull it; drag the empty table to turn the view.',
};

const puddingIcon = (custard, sauce) => `<svg viewBox="0 0 44 24" aria-hidden="true"><ellipse cx="22" cy="20.5" rx="20" ry="2.6" fill="#ece5d8"/><ellipse cx="22" cy="20" rx="14" ry="2.2" fill="${sauce}" opacity="0.8"/><path d="M10 20 L13 6 Q22 3.5 31 6 L34 20 Q22 22.5 10 20Z" fill="${custard}"/><path d="M13 6 Q22 3.5 31 6 L31.4 8.5 Q30.5 11 29.6 8.6 L28 9 Q22 10 17 9 L16 12.5 Q15 14 14.6 11 L13.4 8.4Z" fill="${sauce}"/></svg>`;

export const panel = /* html */`
<div class="group">
  <div class="label" id="variety-label"><span>Flavour</span></div>
  <div class="swatches" role="radiogroup" aria-labelledby="variety-label">
    <label class="swatch"><input type="radio" name="variety" value="caramel" checked>${puddingIcon('#f3cf73', '#8a4512')}<span class="name">Caramel</span></label>
    <label class="swatch"><input type="radio" name="variety" value="matcha">${puddingIcon('#bccf7c', '#3f2a12')}<span class="name">Matcha</span></label>
    <label class="swatch"><input type="radio" name="variety" value="strawberry">${puddingIcon('#f6c6c8', '#b31d33')}<span class="name">Strawberry</span></label>
  </div>
</div>
<div class="group">
  <label class="label" for="firm"><span>Firmness</span><output id="firm-out" for="firm">50</output></label>
  <input id="firm" type="range" min="0" max="100" value="50" aria-label="Firmness">
  <div class="ends" aria-hidden="true"><span>barely set</span><span>firm</span></div>
</div>
<div class="group">
  <label class="label" for="damp"><span>Internal damping</span><output id="damp-out" for="damp">25</output></label>
  <input id="damp" type="range" min="0" max="100" value="25" aria-label="Internal damping">
  <div class="ends" aria-hidden="true"><span>shivery</span><span>creamy</span></div>
</div>
<div class="group row4">
  <button class="btn" id="nudge" type="button">Tap the plate</button>
  <button class="btn" id="reset" type="button">Reset</button>
  <button class="btn" id="flip" type="button">Turn it over</button>
  <button class="btn" id="pause" type="button" aria-pressed="false">Pause</button>
</div>
<div class="group checks">
  <label class="check"><input type="checkbox" id="slow">¼ speed</label>
  <label class="check"><input type="checkbox" id="mesh">Show mesh</label>
</div>`;

export const foot = /* html */`
<p class="hint" id="hint">Grab the top or a side and pull; scroll or use a second finger to twist what you hold. Let go and watch it shiver back into shape.</p>
<dl class="readouts">
  <div class="readout"><dt>Mass</dt><dd id="ro-mass">–</dd></div>
  <div class="readout"><dt>Volume</dt><dd id="ro-vol">–</dd></div>
  <div class="readout"><dt>Kinetic</dt><dd id="ro-ke">–</dd></div>
</dl>
<p class="units">Illustrative scale: 1 unit ≈ 4 cm, so the pudding is about 8 cm across and 4 cm tall, custard at 1.08 g/cm³. Volume is relative to the rest volume; gravity and time are eased so the motion reads.</p>`;

export const notes = /* html */`
<h3>The body</h3>
<p id="note-body">A lattice of tetrahedra fills the pudding. Every edge is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out.</p>
<h3>The motion</h3>
<p>Fixed 1/120 s steps, six substeps each. A custard is softer than a jelly and taller than it is wide at the top, so a tap sets it swaying and the sway takes a while to die. Damping acts on how fast neighbours move apart, never on a fall.</p>
<h3>The surface</h3>
<p>The smooth pudding you see is a finer mesh from a signed distance field (a rounded, slightly domed frustum), each vertex riding inside one tetrahedron, and so do the bubbles and the hundred and twenty specks set in the custard. The caramel is not painted on the screen but laid out in the pudding's own rest space, on its crown and in drips of different lengths, so the sauce sways and stretches with the custard.</p>
<h3>The light</h3>
<p>Native WebGPU. A set custard is translucent and milky: the plate and the specks show through its thinner edges, blurred and tinted, while light scattered inside comes back pale at the edge and deep gold where it is thick. The specks are drawn into the scene before the custard, so it refracts them; each rides on a point in the custard and sways with it. The caramel is a glassy film that tints what lies under it by how far a ray travels through it, amber where thin, red-brown where it pools. Light that gets through the custard warms its shadow on the plate.</p>`;

// Three flavours: how the custard absorbs (which also warms its shadow), its pale edge and deep middle,
// the sauce, and the specks (vanilla seeds, flecks of tea, bits of berry).
const PRESETS = {
  caramel:    { absorb: [0.12, 0.38, 1.5], scatter: [1, 1, 1], palette: ['#fff3c9', '#ffc24a', '#b8560f', '#241307'] },
  matcha:     { absorb: [0.85, 0.3, 1.6], scatter: [1, 1, 1], palette: ['#eef8c4', '#86b832', '#6a3c16', '#29400f'] },
  strawberry: { absorb: [0.18, 1.25, 0.85], scatter: [1, 1, 1], palette: ['#ffe6ec', '#ff6f92', '#b3102c', '#8a0f22'] },
};

export async function mount(ctx) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before the build
  const sim = PuddingSim.create(), plate = plateLook('#faf7f1', { decal: POOL });
  await runJellyPage(ctx, {
    sim, meshes: latticeMeshes(sim), presets: PRESETS, preset: 'caramel', massDigits: 0,
    renderer: {
      paper: meta.paper, helpers, material, passes: plate.wgsl + SPECKS_WGSL, shadowRadius: 3.2,
      replace: { ...plate.replace, CAUSTIC: 'const CAUSTIC = 0.6;' }, plugins: [platePlugin(), instancedPlugin(SPECK_QUAD, 'vsSpeck', 'fsSpeck')],
    },
    camera: { yaw: 0.55, pitch: 0.48, target: [0, 0.42, 0], pitchRange: [0.12, 1.35], fit: [3.3, 4.1] },
    note: (s) => `A lattice of ${s.nt.toLocaleString()} tetrahedra on ${s.n.toLocaleString()} nodes fills the pudding. Each of its ${s.ne.toLocaleString()} edges is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out.`,
  });
  return { unmount() {} };
}
