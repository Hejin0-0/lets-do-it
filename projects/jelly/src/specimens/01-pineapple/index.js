// 01 — Ring mold Jelly: a ring jelly turned out of a fluted mould onto a porcelain plate, pineapple
// pieces set inside. Grab the crown or a flute, pull, let go and it wobbles back on the plate.
import { runJellyPage, latticeMeshes } from '../../core/jelly/page.js';
import { instancedPlugin } from '../../core/jelly/plugins.js';
import { plateLook, platePlugin } from '../../core/jelly/plate.js';
import { MouldSim, tidbitMesh } from './sim.js';
import { helpers, material, PIECES_WGSL } from './material.js';

export const meta = {
  id: '01', name: 'Ring mold Jelly', noun: 'jelly', paper: '#f4ede1', fig: 'fig. 1',
  eyebrow: 'Material Studies / No. 001', title: ['Ring mold', 'Jelly.'],
  caption: ['Turned out of the mold.', 'Fruit set in the middle.', 'Give it a wobble.'],
  aria: 'Interactive 3D ring jelly with pineapple pieces inside, standing on a porcelain plate. Drag the crown or a flute to pull it; drag the empty table to turn the view.',
};

const mouldIcon = (fill, edge) => `<svg viewBox="0 0 44 24" aria-hidden="true"><ellipse cx="22" cy="20.5" rx="20" ry="2.6" fill="#ece5d8"/><path d="M6 20 L9 7 Q22 2 35 7 L38 20 Q22 23 6 20Z" fill="${fill}" stroke="${edge}" stroke-width="1.2"/><ellipse cx="22" cy="7" rx="13" ry="3.2" fill="none" stroke="${edge}" stroke-width="0.9" opacity="0.7"/><ellipse cx="22" cy="7" rx="3.6" ry="1.2" fill="#f4ede1" stroke="${edge}" stroke-width="0.8"/><path d="M13 9 L12 19 M18 8 L17.5 20.5 M26 8 L26.5 20.5 M31 9 L32 19" stroke="${edge}" stroke-width="0.7" opacity="0.5"/><path d="M15 14 l3-1.4 1 2-3 1z M26 15 l3.2-1 0.6 2-3.2 0.8z" fill="#f2b42c"/></svg>`;

export const panel = /* html */`
<div class="group">
  <div class="label" id="variety-label"><span>Flavour</span></div>
  <div class="swatches" role="radiogroup" aria-labelledby="variety-label">
    <label class="swatch"><input type="radio" name="variety" value="golden" checked>${mouldIcon('#f6cf5c', '#c99312')}<span class="name">Golden</span></label>
    <label class="swatch"><input type="radio" name="variety" value="lime">${mouldIcon('#b9e36a', '#6e9e1e')}<span class="name">Lime</span></label>
    <label class="swatch"><input type="radio" name="variety" value="raspberry">${mouldIcon('#f2829e', '#b8325a')}<span class="name">Raspberry</span></label>
  </div>
</div>
<div class="group">
  <label class="label" for="firm"><span>Firmness</span><output id="firm-out" for="firm">50</output></label>
  <input id="firm" type="range" min="0" max="100" value="50" aria-label="Firmness">
  <div class="ends" aria-hidden="true"><span>trembling</span><span>set</span></div>
</div>
<div class="group">
  <label class="label" for="damp"><span>Internal damping</span><output id="damp-out" for="damp">25</output></label>
  <input id="damp" type="range" min="0" max="100" value="25" aria-label="Internal damping">
  <div class="ends" aria-hidden="true"><span>lively</span><span>syrupy</span></div>
</div>
<div class="group row4">
  <button class="btn" id="nudge" type="button">Give it a nudge</button>
  <button class="btn" id="reset" type="button">Reset</button>
  <button class="btn" id="flip" type="button">Turn it over</button>
  <button class="btn" id="pause" type="button" aria-pressed="false">Pause</button>
</div>
<div class="group checks">
  <label class="check"><input type="checkbox" id="slow">¼ speed</label>
  <label class="check"><input type="checkbox" id="mesh">Show mesh</label>
</div>`;

export const foot = /* html */`
<p class="hint" id="hint">Grab the crown or a flute and pull it any way you like; scroll or use a second finger to twist what you hold. Let go and it wobbles back onto the plate.</p>
<dl class="readouts">
  <div class="readout"><dt>Mass</dt><dd id="ro-mass">–</dd></div>
  <div class="readout"><dt>Volume</dt><dd id="ro-vol">–</dd></div>
  <div class="readout"><dt>Kinetic</dt><dd id="ro-ke">–</dd></div>
</dl>
<p class="units">Illustrative scale: 1 unit ≈ 6 cm, so the jelly is about 13 cm across and 6 cm tall, set at 1.04 g/cm³. Volume is relative to the rest volume; gravity and time are eased so the motion reads.</p>`;

// the tail of the g in "Ring" would touch the tops of the l's below it: a little more room between the lines
export const extra = /* html */`<style>.stage[data-specimen="01"] h1 { line-height: 1.02; }</style>`;

export const notes = /* html */`
<h3>The body</h3>
<p id="note-body">A lattice of tetrahedra fills the ring. Every edge is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out.</p>
<h3>The motion</h3>
<p>Fixed 1/120 s steps, six substeps each, at most four steps per frame. Damping acts on how fast neighbours move apart, never on a fall, so the jelly settles into the same shape however calm you make it. The plate's well and lip push back with friction.</p>
<h3>The surface</h3>
<p>The fluted surface is a separate, finer mesh from a signed distance field (the tapered ring, its flutes, the domed crown and the hole). Each vertex rides inside one tetrahedron and follows it on the GPU; so do the bubbles and the twelve pineapple pieces, each carried by three points so it turns and leans as the jelly does.</p>
<h3>The light</h3>
<p>Native WebGPU. A back-face pass measures how much jelly each ray crosses for Beer–Lambert absorption; the front refracts the plate and the fruit behind it. Light passing through is tinted by the flavour and, where the jelly is thick in the middle and thin at its edges, gathered into a brighter core inside its shadow.</p>`;

// Three flavours: only the gel changes (absorption, which also tints the shadow, the faint haze and the glow
// of thin places); the pineapple is the same in each.
const PRESETS = {
  golden:    { absorb: [0.07, 0.48, 3.0], scatter: [0.34, 0.26, 0.1], palette: ['#fff1c4', '#ffc93a'] },
  lime:      { absorb: [2.4, 0.3, 2.2], scatter: [0.2, 0.32, 0.12], palette: ['#effcd2', '#a8e83a'] },
  raspberry: { absorb: [0.2, 3.0, 1.7], scatter: [0.34, 0.12, 0.18], palette: ['#ffe0e8', '#ff4f7c'] },
};

export async function mount(ctx) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint before the build
  const sim = MouldSim.create({ tapSeed: Date.now() | 0 }), plate = plateLook();
  await runJellyPage(ctx, {
    sim, meshes: latticeMeshes(sim), presets: PRESETS, preset: 'golden', massDigits: 0,
    renderer: {
      paper: meta.paper, helpers, material, passes: plate.wgsl + PIECES_WGSL, shadowRadius: 3.2,
      replace: { ...plate.replace, CAUSTIC: 'const CAUSTIC = 1.0;' },
      plugins: [platePlugin(), instancedPlugin(tidbitMesh(), 'vsPiece', 'fsPiece')],
    },
    camera: { yaw: 0.6, pitch: 0.5, target: [0, 0.4, 0], pitchRange: [0.12, 1.35], fit: [3.6, 4.4] },
    note: (s) => `A lattice of ${s.nt.toLocaleString()} tetrahedra on ${s.n.toLocaleString()} nodes fills the ring. Each of its ${s.ne.toLocaleString()} edges is an elastic XPBD connection, every lattice cell keeps its volume, and a guard stops tetrahedra from turning inside out.`,
  });
  return { unmount() {} };
}
