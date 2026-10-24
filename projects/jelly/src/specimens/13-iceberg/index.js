// 13 — Iceberg Jelly: a polar bay in a block of jelly. A glacier calves into deep water, bergs and floes drift
// and capsize, an icebreaker shoulders round the bay through the pack, Adélie penguins come and go from their
// rookery, seals haul out, an orca patrols. A page of its own design (meta.layout 'custom') on the shared
// diorama engine (@lid/diorama).
import { srgbToLinear as hexLin } from '../../core/math.js';
import { createDioramaView, sunSetup, paperRadiance, blockEdgePoints } from '@lid/diorama/view.js';
import { dioramaPage, ui, wirePanel } from '@lid/diorama/ui.js';
import { UO } from '@lid/diorama/renderer.js';
import { setPart } from '@lid/diorama/parts.js';
import { I } from './layout.js';
import { createWorld } from './world.js';
import { buildScene, poseScene } from './scene.js';
import { createRenderer, PAL } from './renderer.js';
import { createSound } from './sound.js';

const PAPER_HEX = '#e6e9ec';
export const meta = {
  id: '13', name: 'Iceberg Jelly', noun: 'iceberg', paper: PAPER_HEX, layout: 'custom',
  eyebrow: 'Material Studies / No. 013', title: ['Iceberg', 'Jelly.'], caption: ['A glacier calving into a polar bay, with penguins.'],
  aria: 'A polar bay in a block of jelly: a glacier calves icebergs, an icebreaker sails through the pack, penguins and seals come and go',
};
export const panel = '';
export const foot = '';
export const notes = '';

export const extra = dioramaPage({
  scope: 'berg', paper: PAPER_HEX, accent: '#2f86c4', no: '013', title: ['Iceberg', 'Jelly.'], caption: 'A glacier calving into a polar bay, with penguins.',
  sections: [
    '<p class="dio-story" id="story" aria-live="polite"><b>Polaris</b><span id="storyText">Alongside</span></p>' +
      ui.dark([['calve', 'Calve'], ['cast', 'Cast off'], ['fish', 'Throw fish'], ['horn', 'Horn']]) + ui.meter('Water energy') +
      '<p class="tally" aria-live="polite">Calved&nbsp;<b id="nCalved">0</b> · Capsized&nbsp;<b id="nCapsized">0</b> · Broken&nbsp;<b id="nBroken">0</b> · Fed&nbsp;<b id="nFed">0</b></p>',   // (a line breaks between counts, not inside one)
    ui.label('Flavour') + ui.swatches('Flavour', [
      { id: 'mint', label: 'Glacier mint', grad: ['#e2fbf4', '#8fd6c4', '#3a8a80'] },
      { id: 'raspberry', label: 'Blue raspberry', grad: ['#c8ecff', '#3aa0e8', '#14508c'] },
      { id: 'blackberry', label: 'Blackberry', grad: ['#d8c8ee', '#6a4a9a', '#2a1648'] }]),
    ui.slider('firm', 'Firmness', 0, 100, 50, '50') + ui.slider('damp', 'Wave damping', 0, 100, 30, '30') + ui.slider('snow', 'Snowfall', 0, 100, 35, '35'),
    ui.line([['reset', 'Reset'], ['pause', 'Pause', false], ['sound', 'Sound', false], ['resetView', 'View']]),
  ],
  howTo: { big: 'Calve the glacier. Cast off. Throw a fish.', small: 'Pick up and throw floes and bergs · drag across the water to make waves · drag the ground or the side of the block to tip it · drag empty space or right-drag to orbit · scroll or pinch to zoom · Space sounds the horn' },
});

const PAPER = paperRadiance(PAPER_HEX);
const FIXED = { snow: '#f2f5f8', rock: '#3a3638', lichen: '#d9822b', ice: '#e3eff5', iceblue: '#5aa6d6', moraine: '#8a8784', pebble: '#8a8682', krill: '#d98a96', gravel: '#7d7b78', basalt: '#2e2c30', dirt: '#5a4e46' };
const FLAVOURS = {
  mint: { sigma: [4.0, 0.85, 1.25], tint: [0.12, 0.36, 0.32], strata: ['#3a4a52', '#7fb8c4', '#c8ecef', '#f2fbfb', '#9fd0c8'], peb: ['#9fe0d0', '#c8ecef', '#f2d6e4', '#b8d0f0'] },
  raspberry: { sigma: [5.0, 1.6, 0.55], tint: [0.04, 0.2, 0.46], strata: ['#2a3450', '#4a8ac4', '#a8d4f4', '#eef6fc', '#7ab0e0'], peb: ['#7ac0f4', '#f2a6c8', '#c8e4fc', '#a8a0f0'] },
  blackberry: { sigma: [3.0, 4.8, 1.5], tint: [0.16, 0.06, 0.3], strata: ['#2a2038', '#6a4a9a', '#c4a8e8', '#f2ecfa', '#9a80c8'], peb: ['#c8a8f0', '#f2b8d8', '#a8b8f0', '#e8d8f8'] },
};
const SUN = sunSetup([-0.38, 0.72, 0.42], [0, 1.1, 0], 4.3);
const CAM0 = { az: 0.45, el: 0.46, target: [0, 1.15, 0.1] };
const FIT_PTS = [...blockEdgePoints(I.HALF, 1.3), [-2.35, 2.32, -2.2], [-2.3, 2.05, -1.2], [-0.35, 2.0, -2.25], [0.1, 1.85, -2.45]];

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.berg');
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const P = wirePanel(root, on, stage), $ = P.$;
  const reduced = stage.reduced.matches;
  const Sound = createSound();
  signal.addEventListener('abort', () => Sound.close());
  let paused = false, flavour = 'mint';
  const U = new Float32Array(UO.SIZE);

  const world = createWorld({ reduced, seed: 13 });
  const { mesh, parts } = buildScene();
  const renderer = await createRenderer(ctx.gpu, canvas, mesh);
  const inst = new Float32Array(mesh.nParts * 12), waterBuf = new Float32Array(I.GN * I.GN * 4), bubBuf = new Float32Array(500 * 4);
  setPart(inst, 0, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const view = createDioramaView({
    canvas, signal, renderer, block: world.block, water: world.water, sun: SUN, cam0: CAM0, fitPoints: FIT_PTS, tiltMax: I.TILT_MAX,
    obstacles: P.obstacles, pick: world.pick, bodies: world.floaters,
  });
  const cam = view.cam;

  function setFlavour(name) {
    const F = FLAVOURS[name] || FLAVOURS.mint;
    flavour = FLAVOURS[name] ? name : 'mint';
    const pal = (k, hex) => U.set([...hexLin(hex), 0], UO.PAL + 4 * k);
    U.set([...F.sigma, 1], UO.SIGMA); U.set([...F.tint, 0], UO.TINT); U.set([...PAPER, 0], UO.PAPER);
    pal(0, FIXED.snow); F.strata.forEach((h, k) => pal(1 + k, h)); F.peb.forEach((h, k) => pal(6 + k, h));
    for (const [k, slot] of Object.entries(PAL)) pal(slot, FIXED[k.toLowerCase()]);
    P.pressSwatch(flavour);
  }
  function setPaused(p) { paused = p; P.setPaused(p); }
  P.swatches(setFlavour);
  P.slider('firm', (v, o) => { o.textContent = String(v); world.setFirm(v / 100); });
  P.slider('damp', (v, o) => { o.textContent = String(v); world.setDamp(v / 100); });
  P.slider('snow', (v, o) => { o.textContent = String(v); world.snow = v / 100; });
  on($('calve'), 'click', () => world.calve());
  on($('cast'), 'click', () => world.ship.go());
  on($('fish'), 'click', () => world.throwFish());
  on($('horn'), 'click', () => world.horn());
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
    Sound.frame(world.events, world.snow);
    world.events.length = 0;
    eS += (world.water.energy - eS) * Math.min(1, dt * 4);
    if ((uiT -= dt) <= 0) {
      uiT = 0.2;
      const t = world.tally(), st = world.ship.status();
      $('nCalved').textContent = t.calved; $('nCapsized').textContent = t.capsized; $('nBroken').textContent = t.broken; $('nFed').textContent = t.fed;
      $('calve').textContent = world.ice.ready() ? 'Calve' : 'Wait…';
      $('cast').textContent = world.ship.state === 'alongside' ? 'Cast off' : 'Full ahead';
      $('storyText').textContent = st.text + (st.more ? ` · ${st.more}` : '');
      P.meter(Math.round(100 * (1 - Math.exp(-eS / 0.3))));
    }
  }
  setFlavour('mint');
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  ctx.hook({
    world, renderer, cam,
    state: () => ({ paused, flavour, pieces: world.ice.pieces.length, ...world.tally(), ship: world.ship.status().text, trips: world.ship.trips, sound: Sound.on, energy: world.water.energy, fps: Math.round(fps), size: renderer.size,
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist } }),
    step(n = 1) { world.step(n); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    reset: () => world.reset(),
    pause: (p) => setPaused(!!p),
    flavour: setFlavour,
    calve: () => world.calve(), cast: () => world.ship.go(), fish: () => world.throwFish(), horn: () => world.horn(),
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
