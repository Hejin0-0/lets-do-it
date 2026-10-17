// 11 — Harbor Jelly: a small working container harbour in a block of jelly. Two gantry cranes swap boxes with a
// feeder ship; a tug pulls her off the quay, she sails a lap past the lighthouse and the tug pushes her back on;
// a town climbs the hill, yachts swing at their moorings, fish school, jellyfish drift and gulls circle. A page of
// its own design (meta.layout 'custom') on the shared diorama engine (src/core/diorama).
import { srgbToLinear as hexLin } from '../../core/math.js';
import { createDioramaView, sunSetup, paperRadiance, blockEdgePoints } from '../../core/diorama/view.js';
import { dioramaPage, ui, wirePanel } from '../../core/diorama/ui.js';
import { UO } from '../../core/diorama/renderer.js';
import { setPart } from '../../core/diorama/parts.js';
import { H } from './layout.js';
import { createWorld } from './world.js';
import { buildScene, poseScene } from './scene.js';
import { createRenderer, PAL } from './renderer.js';
import { createSound } from './sound.js';

const PAPER_HEX = '#ebe6dc';
export const meta = {
  id: '11', name: 'Harbor Jelly', noun: 'harbour', paper: PAPER_HEX, layout: 'custom',
  eyebrow: 'Material Studies / No. 011', title: ['Harbor', 'Jelly.'], caption: ['A small container harbour, working all day.'],
  aria: 'A container harbour in a block of jelly: two cranes swap boxes with a feeder ship, a tug takes her off and back, yachts swing at their moorings, gulls circle over the town',
};
export const panel = '';
export const foot = '';
export const notes = '';

export const extra = dioramaPage({
  scope: 'harb', paper: PAPER_HEX, accent: '#1f7a8c', no: '011', title: ['Harbor', 'Jelly.'], caption: 'A small container harbour, working all day.',
  css: '.harb .btn-dark:disabled { opacity: .42; cursor: default; }',
  sections: [
    '<p class="dio-story" id="story" aria-live="polite"><b>Ship</b><span id="storyText">Booms down</span></p>' +
      ui.dark([['cast', 'Cast off'], ['horn', 'Horn'], ['feed', 'Feed the fish']]) + ui.meter('Activity') +
      '<p class="tally" aria-live="polite">Boxes moved&nbsp;<b id="nMoved">0</b> · Voyages&nbsp;<b id="nVoy">0</b> · Fed&nbsp;<b id="nFed">0</b></p>',
    ui.label('Flavour') + ui.swatches('Flavour', [
      { id: 'seaglass', label: 'Sea glass', grad: ['#e2f6ee', '#86cbb8', '#2e7a72'] },
      { id: 'blueberry', label: 'Blueberry', grad: ['#c8d4f4', '#4a62b8', '#1a2462'] },
      { id: 'lime', label: 'Lime', grad: ['#eef8c8', '#a6d24a', '#4a7a1a'] }]),
    ui.slider('firm', 'Firmness', 0, 100, 50, '50') + ui.slider('damp', 'Wave damping', 0, 100, 30, '30') + ui.slider('tide', 'Tide', -10, 10, 0, '0 cm'),
    ui.line([['reset', 'Reset'], ['pause', 'Pause', false], ['sound', 'Sound', false], ['resetView', 'View']]),
  ],
  howTo: { big: 'Watch the boxes swap. Cast her off. Feed the fish.', small: 'Pick up a lifebuoy and throw it · drag across the water to make waves · drag the side of the block to tip it · drag empty space or right-drag to orbit · scroll or pinch to zoom · Space sounds the horn' },
});

const PAPER = paperRadiance(PAPER_HEX);
const FIXED = { grass: '#7c9a54', sand: '#dccdb0', silt: '#a89a84', asphalt: '#4c4e52', concrete: '#b6b2aa', cobble: '#8c8680', stone: '#aaa292', rock: '#8a8682', mussel: '#1e2230', weed: '#4a6a30', line: '#f0d040', rail: '#6a6c70', soil: '#7a6248' };
const FLAVOURS = {
  seaglass: { sigma: [3.4, 1.0, 1.4], tint: [0.1, 0.34, 0.3], strata: ['#4a3a3a', '#c88a6a', '#f0d0a8', '#fbf0dc', '#e0a888'], peb: ['#a8d8c8', '#e8c8a8', '#c8d8e8', '#d8b8c8'] },
  blueberry: { sigma: [5.0, 2.0, 0.7], tint: [0.05, 0.16, 0.42], strata: ['#2a2a48', '#6a5a9a', '#c8b8e0', '#f0eaf6', '#a890c8'], peb: ['#8aa0e0', '#e8b8d0', '#c8d0f0', '#a890d8'] },
  lime: { sigma: [3.2, 0.7, 2.6], tint: [0.18, 0.36, 0.08], strata: ['#3a4a2a', '#9ac05a', '#e0f0b0', '#f8fce8', '#c8e088'], peb: ['#c8e8a0', '#f0d8a0', '#a8d8c0', '#e8e0b0'] },
};
const SUN = sunSetup([-0.45, 0.75, 0.48], [0, 1.1, 0], 4.3);
const CAM0 = { az: 0.45, el: 0.46, target: [0, 1.15, 0.0] };
const FIT_PTS = [...blockEdgePoints(H.HALF, 1.3), [-2.6, 1.7, -2.6], [2.6, 1.7, -2.6], [-1.95, 1.9, -0.9], [0.46, 1.9, -2.15], [0.4, 1.72, -1.62], [1.0, 1.55, 0.5]];

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.harb');
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const P = wirePanel(root, on, stage), $ = P.$;
  const reduced = stage.reduced.matches;
  const Sound = createSound();
  signal.addEventListener('abort', () => Sound.close());
  let paused = false, flavour = 'seaglass';
  const U = new Float32Array(UO.SIZE);

  const { mesh, parts } = buildScene();   // first: it lays out the perches and the solid boxes the world uses
  const world = createWorld({ reduced, seed: 11 });
  const renderer = await createRenderer(ctx.gpu, canvas, mesh);
  const inst = new Float32Array(mesh.nParts * 12), waterBuf = new Float32Array(H.GN * H.GN * 4), bubBuf = new Float32Array(400 * 4);
  setPart(inst, 0, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const view = createDioramaView({
    canvas, signal, renderer, block: world.block, water: world.water, sun: SUN, cam0: CAM0, fitPoints: FIT_PTS, tiltMax: H.TILT_MAX,
    obstacles: P.obstacles, pick: world.pick, bodies: world.floaters,
  });
  const cam = view.cam;

  function setFlavour(name) {
    const F = FLAVOURS[name] || FLAVOURS.seaglass;
    flavour = FLAVOURS[name] ? name : 'seaglass';
    const pal = (k, hex) => U.set([...hexLin(hex), 0], UO.PAL + 4 * k);
    U.set([...F.sigma, 1], UO.SIGMA); U.set([...F.tint, 0], UO.TINT); U.set([...PAPER, 0], UO.PAPER);
    pal(0, FIXED.grass); F.strata.forEach((h, k) => pal(1 + k, h)); F.peb.forEach((h, k) => pal(6 + k, h));
    for (const [k, slot] of Object.entries(PAL)) pal(slot, FIXED[k.toLowerCase()]);
    P.pressSwatch(flavour);
  }
  function setPaused(p) { paused = p; P.setPaused(p); }
  P.swatches(setFlavour);
  P.slider('firm', (v, o) => { o.textContent = String(v); world.setFirm(v / 100); });
  P.slider('damp', (v, o) => { o.textContent = String(v); world.setDamp(v / 100); });
  P.slider('tide', (v, o) => { o.textContent = `${v > 0 ? '+' : ''}${v} cm`; world.setTide(v / 10); });
  on($('cast'), 'click', () => world.go());
  on($('horn'), 'click', () => world.horn());
  on($('feed'), 'click', () => world.feed());
  const setSound = (v) => { Sound.set(v); $('sound').setAttribute('aria-pressed', String(Sound.on)); $('sound').textContent = Sound.on ? 'Sound on' : 'Sound'; };
  on($('sound'), 'click', () => setSound(!Sound.on));
  on(window, 'keydown', (e) => {
    if (e.code !== 'Space') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    e.preventDefault();
    world.horn();
  });
  on($('reset'), 'click', () => world.reset());
  on($('pause'), 'click', () => setPaused(!paused));
  on($('resetView'), 'click', view.resetView);

  let fps = 60, uiT = 0, eS = 0;
  function draw(dt) {
    if (!paused) world.advance(dt);
    const CAMV = view.frame(dt, U, world.time);
    poseScene(inst, parts, world);
    world.water.pack(waterBuf);
    const nBubbles = world.bubbles.pack(bubBuf);
    renderer.render({ U, cam: CAMV, sun: SUN.SUNV, water: waterBuf, foam: world.foam.pack(), inst, instFloats: inst.length, bubbles: bubBuf, nBubbles });
    Sound.frame(world.events, world.water.energy);
    world.events.length = 0;
    eS += (world.water.energy - eS) * Math.min(1, dt * 4);
    if ((uiT -= dt) <= 0) {
      uiT = 0.2;
      const t = world.tally(), S = world.story;
      $('nMoved').textContent = t.moved; $('nVoy').textContent = t.voyages; $('nFed').textContent = t.fed;
      $('storyText').textContent = S.text + (S.more ? ` · ${S.more}` : '');
      const atSea = S.phase === 'sea';
      $('cast').textContent = atSea ? 'Call her in' : 'Cast off';
      $('cast').disabled = !(S.phase === 'work' && !S.early) && !(atSea && !S.hurry);
      P.meter(Math.round(100 * (1 - Math.exp(-eS / 0.3))));
    }
  }
  setFlavour('seaglass');
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  ctx.hook({
    world, renderer, cam,
    state: () => ({ paused, flavour, ...world.tally(), ship: world.story.text, more: world.story.more, phase: world.story.phase, tide: world.tide, sound: Sound.on, energy: world.water.energy, fps: Math.round(fps), size: renderer.size,
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist } }),
    step(n = 1) { world.step(n); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    reset: () => world.reset(),
    pause: (p) => setPaused(!!p),
    flavour: setFlavour,
    cast: () => world.go(), horn: () => world.horn(), feed: () => world.feed(), tide: (v) => world.setTide(v),
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
