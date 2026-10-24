// 12 — Lock Jelly: a little English canal lock in a block of jelly, cut lengthways by the block's front face
// so you watch the chamber fill and empty between its gates. A keeper works the lock, the narrowboat Wobble
// goes up and down for ever, ducks and fish and a heron live along the cut. A page of its own design
// (meta.layout 'custom') on the shared diorama engine (@lid/diorama).
import { srgbToLinear as hexLin } from '../../core/math.js';
import { createDioramaView, sunSetup, paperRadiance, blockEdgePoints } from '@lid/diorama/view.js';
import { dioramaPage, ui, wirePanel } from '@lid/diorama/ui.js';
import { UO } from '@lid/diorama/renderer.js';
import { setPart } from '@lid/diorama/parts.js';
import { L } from './layout.js';
import { createWorld } from './world.js';
import { buildScene, poseAll } from './scene.js';
import { createRenderer, PAL } from './renderer.js';
import { createSound } from './sound.js';

const PAPER_HEX = '#efe9df';
export const meta = {
  id: '12', name: 'Lock Jelly', noun: 'lock', paper: PAPER_HEX, layout: 'custom',
  eyebrow: 'Material Studies / No. 012', title: ['Lock', 'Jelly.'], caption: ['A canal lock that fills, empties and fills again.'],
  aria: 'A canal lock in a block of jelly: a keeper works the gates, a narrowboat goes up and down, you can make waves, toot and throw bread',
};
export const panel = '';
export const foot = '';
export const notes = '';

export const extra = dioramaPage({
  scope: 'lock', paper: PAPER_HEX, accent: '#5a8f3a', no: '012', title: ['Lock', 'Jelly.'], caption: 'A canal lock that fills, empties and fills again.',
  sections: [
    '<p class="dio-story" id="story" aria-live="polite"><b>Wobble</b><span id="storyText">In the lock</span></p>' +
      ui.dark([['hurry', 'Hurry'], ['toot', 'Toot'], ['bread', 'Throw bread'], ['duck', 'Rubber duck']]) + ui.meter('Liveliness') +
      '<p class="tally" aria-live="polite">Trips&nbsp;<b id="nTrips">0</b> · Lockfuls&nbsp;<b id="nLockfuls">0</b> · Fed&nbsp;<b id="nFed">0</b></p>',
    ui.label('Flavour') + ui.swatches('Flavour', [
      { id: 'greengage', label: 'Greengage', grad: ['#eaf7a8', '#9cc23a', '#4f7a16'] },
      { id: 'elderflower', label: 'Elderflower', grad: ['#fffbe0', '#efe1a0', '#b6a35a'] },
      { id: 'blackcurrant', label: 'Blackcurrant', grad: ['#e6b8e8', '#7a2a7c', '#3b0b40'] }]),
    ui.slider('firm', 'Firmness', 0, 100, 50, '50') + ui.slider('damp', 'Wave damping', 0, 100, 30, '30') + ui.slider('paddle', 'Paddle speed', 0, 100, 50, '50'),
    ui.line([['reset', 'Reset'], ['pause', 'Pause', false], ['sound', 'Sound', false], ['resetView', 'View']]),
  ],
  howTo: { big: 'Throw bread. Toot the horn. Hurry the keeper.', small: 'Drag across the water to make waves · drag the side of the block to tip it · pick up a rubber duck and throw it · drag empty space to orbit · scroll or pinch to zoom · Space toots' },
});

const PAPER = paperRadiance(PAPER_HEX);
const FIXED = { grass: '#6f9a45', setts: '#8f8b84', brick: '#9c4f36', gravel: '#b9ab8e', earth: '#6b4a32', clay: '#7d8b93', concrete: '#a8a59c', silt: '#6d6a48', slime: '#2d3a24', weed: '#3f6a2a', soil: '#5a3d28' };
const FLAVOURS = {
  greengage: { sigma: [3.4, 1.05, 5.2], tint: [0.12, 0.27, 0.05], strata: ['#5b3a26', '#c08a44', '#f4c56a', '#f8edc9', '#d9b47c'], peb: ['#f6aec1', '#bfe28a', '#f8dc8c', '#c2afec'] },
  elderflower: { sigma: [1.0, 1.15, 3.4], tint: [0.32, 0.31, 0.15], strata: ['#5f4330', '#c99d5e', '#f6e2a6', '#fbf3dc', '#dcc49a'], peb: ['#fbe6a8', '#f0f0d8', '#e8c9a0', '#cfe0b8'] },
  blackcurrant: { sigma: [3.0, 6.6, 2.1], tint: [0.18, 0.03, 0.2], strata: ['#4a2730', '#a8605a', '#e6a6c8', '#f6e2ee', '#c99aa8'], peb: ['#e6a6d0', '#b48ad8', '#f6c6d6', '#a8b8f0'] },
};
const SUN = sunSetup([-0.45, 0.85, 0.28], [0, 1.0, 0], 4.2);
const CAM0 = { az: 0.42, el: 0.5, target: [0, 1.05, 0.2] };
const FIT_PTS = blockEdgePoints(L.HALF, L.TU + 0.1);

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.lock');
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const P = wirePanel(root, on, stage), $ = P.$;
  const reduced = stage.reduced.matches;
  const Sound = createSound();
  signal.addEventListener('abort', () => Sound.close());
  let paused = false, flavour = 'greengage';
  const U = new Float32Array(UO.SIZE);

  const { mesh, parts } = buildScene();
  const renderer = await createRenderer(ctx.gpu, canvas, mesh);
  const world = createWorld({ reduced, seed: 11 });
  const inst = new Float32Array(mesh.nParts * 12), waterBuf = new Float32Array(L.GN * L.GN * 4), bubBuf = new Float32Array(400 * 4);
  setPart(inst, 0, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const view = createDioramaView({
    canvas, signal, renderer, block: world.block, water: world.water, sun: SUN, cam0: CAM0, fitPoints: FIT_PTS, tiltMax: L.TILT_MAX,
    obstacles: P.obstacles, pick: world.pick, bodies: world.floaters,
  });
  const cam = view.cam;

  function setFlavour(name) {
    const F = FLAVOURS[name] || FLAVOURS.greengage;
    flavour = FLAVOURS[name] ? name : 'greengage';
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
  P.slider('paddle', (v, o) => { o.textContent = String(v); world.paddleSpeed = 0.4 + (v / 100) * 1.2; });
  const setHurry = (h) => { world.setHurry(h); $('hurry').setAttribute('aria-pressed', String(world.hurry)); $('hurry').textContent = world.hurry ? 'Hurrying' : 'Hurry'; };
  const setSound = (v) => { Sound.set(v); $('sound').setAttribute('aria-pressed', String(Sound.on)); $('sound').textContent = Sound.on ? 'Sound on' : 'Sound'; };
  $('hurry').setAttribute('aria-pressed', 'false');
  on($('hurry'), 'click', () => setHurry(!world.hurry));
  on($('toot'), 'click', () => world.toot());
  on($('bread'), 'click', () => world.throwBread());
  on($('duck'), 'click', () => world.dropDuck());
  on($('sound'), 'click', () => setSound(!Sound.on));
  on($('reset'), 'click', () => world.reset());
  on($('pause'), 'click', () => setPaused(!paused));
  on($('resetView'), 'click', view.resetView);
  on(window, 'keydown', (e) => {
    if (e.code !== 'Space') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    e.preventDefault();
    world.toot();
  });

  let fps = 60, uiT = 0, eS = 0, lastStory = '';
  function draw(dt) {
    if (!paused) world.advance(dt);
    const CAMV = view.frame(dt, U, world.time);
    poseAll(inst, parts, world, setPart);
    world.water.pack(waterBuf);
    const nBubbles = world.bubbles.pack(bubBuf);
    renderer.render({ U, cam: CAMV, sun: SUN.SUNV, water: waterBuf, foam: world.foam.pack(), inst, instFloats: inst.length, bubbles: bubBuf, nBubbles });
    Sound.frame(world.events, paused ? 0 : world.lock.flow);
    world.events.length = 0;
    // the panel: the story, the liveliness, the tallies
    eS += (world.water.energy - eS) * Math.min(1, dt * 4);
    if ((uiT -= dt) <= 0) {
      uiT = 0.2;
      const S = world.story, line = S.who + '|' + S.text + (S.pct >= 0 ? ' ' + S.pct + '%' : '');
      if (line !== lastStory) { lastStory = line; $('story').firstChild.textContent = S.who; $('storyText').textContent = S.text + (S.pct >= 0 ? ` ${S.pct}%` : ''); }
      const t = world.tally();
      $('nTrips').textContent = t.trips; $('nLockfuls').textContent = t.lockfuls; $('nFed').textContent = t.fed;
      P.meter(Math.round(100 * (1 - Math.exp(-eS / 0.3))));
    }
  }
  setFlavour('greengage');
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  ctx.hook({
    world, renderer, cam,
    state: () => ({ paused, flavour, hurry: world.hurry, sound: Sound.on, level: world.lock.level, gates: world.lock.gates.map((g) => g.th), story: `${world.story.who} — ${world.story.text}`,
      tally: world.tally(), ducks: world.floaters.bodies.length, keeper: world.keeper.p.slice(), boat: world.boat.c.slice(), fps: Math.round(fps), size: renderer.size,
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist } }),
    toot: () => world.toot(), bread: () => world.throwBread(), duck: () => world.dropDuck().id, hurry: setHurry,
    step(n = 1) { world.step(n); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    reset: () => world.reset(),
    pause: (p) => setPaused(!!p),
    flavour: setFlavour,
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
