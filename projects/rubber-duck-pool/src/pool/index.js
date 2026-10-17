// Rubber Duck Pool: a walled pool courtyard in a block of jelly, filling the page. Rubber ducks circle the big
// pool, go down the slide into the round one on the lawn, are drawn down its drain and pop back out of the
// fountain at the big pool's head. Add ducks, take them away, pick one up and dress it (eight colours, seven
// things to wear), follow it round; turn the hourglass over, switch the radio on. A page of its own design on
// the shared diorama engine (@lid/diorama); src/main.js hosts it.
import { srgbToLinear as hexLin } from '@lid/diorama/math.js';
import { createDioramaView, sunSetup, paperRadiance } from '@lid/diorama/view.js';
import { dioramaPage, ui, wirePanel } from '@lid/diorama/ui.js';
import { UO } from '@lid/diorama/renderer.js';
import { setPart } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { createWorld } from './world.js';
import { buildScene, poseScene } from './scene.js';
import { createRenderer, PAL } from './renderer.js';
import { createSound } from './sound.js';
import { COLOURS, HATS, MAX_DUCKS } from './ducks.js';

const PAPER_HEX = '#e6f0f2';
export const meta = {
  name: 'Rubber Duck Pool', noun: 'pool', paper: PAPER_HEX,
  eyebrow: 'A pool in a block of jelly', title: ['Rubber Duck', 'Pool.'], caption: ['A pool courtyard full of rubber ducks.'],
  aria: 'A walled pool courtyard in a block of jelly: rubber ducks circle a pool, ride a slide down into a round pool and pop back out of a fountain',
};

const CSS = `
.pool .mast, .pool .dio-foot { background: var(--glass); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border: 1px solid var(--rule); border-radius: 14px; padding: 14px 18px 16px; }
.pool .mast h1 { font-size: clamp(44px, 6vw, 84px); }
.pool .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.pool .dk-who { font: italic 13px/1.3 var(--serif); color: var(--ink-2); margin: -4px 0 10px; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.pool .dk-who button { background: none; border: 0; font: 12px var(--sans); color: var(--ink-3); cursor: pointer; padding: 0 2px; }
.pool .dk-row { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-bottom: 12px; }
.pool .dk-sw { aspect-ratio: 1; border-radius: 50%; border: 2px solid transparent; outline: 1px solid var(--rule); cursor: pointer; padding: 0; box-shadow: inset 0 -3px 4px rgba(0, 0, 0, .16); }
.pool .dk-sw[aria-pressed="true"] { border-color: var(--paper); outline: 2px solid var(--ink); }
.pool .dk-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 10px; }
.pool .dk-chip { background: transparent; border: 1px solid var(--ink-3); border-radius: 999px; padding: 6px 2px; font: 11px/1.1 var(--sans); color: var(--ink); cursor: pointer; }
.pool .dk-chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: #f7f5f1; }
.pool .btn-dark:disabled, .pool .btn-line:disabled { opacity: .42; cursor: default; }
.pool .btn-line[aria-pressed="true"] { background: var(--ink); color: #f7f5f1; }
@media (max-width: 900px) { .pool .mast { padding: 10px 12px 12px; } .pool .mast h1 { font-size: 40px; } }`;

export const extra = dioramaPage({
  scope: 'pool', paper: PAPER_HEX, accent: '#2a8ad8', eyebrow: meta.eyebrow, title: meta.title, caption: 'A pool courtyard full of rubber ducks.', css: CSS,
  sections: [
    '<p class="dio-story" id="story" aria-live="polite"><b>Ducks</b><span id="storyText">12 afloat</span></p>' +
      ui.dark([['add1', 'Add a duck'], ['add5', 'Add five']]) +
      '<div class="row3"><button class="btn-line" id="remove">Take one out</button><button class="btn-line" id="follow" aria-pressed="false">Follow</button><button class="btn-line" id="mix">Mix them up</button></div>' +
      '<p class="tally" aria-live="polite" style="margin-top:12px">Down the slide&nbsp;<b id="nSlides">0</b> · Back out of the fountain&nbsp;<b id="nReturns">0</b></p>' +
      '<div class="row2" style="margin-top:10px"><button class="btn-line" id="glassBtn">Turn the hourglass</button><button class="btn-line" id="radioBtn" aria-pressed="false">Radio</button></div>',
    ui.label('Dress') + '<p class="dk-who"><span id="who">New ducks</span><button id="unpick" hidden>Let go ✕</button></p>' +
      `<div class="dk-row" role="group" aria-label="Duck colour">${COLOURS.map((c, i) => `<button class="dk-sw" data-colour="${i}" aria-pressed="${i === 0}" aria-label="${c.label}" title="${c.label}" style="background: radial-gradient(circle at 35% 30%, #fff8, ${c.body} 55%)"></button>`).join('')}</div>` +
      `<div class="dk-chips" role="group" aria-label="Duck decoration">${HATS.map((h, i) => `<button class="dk-chip" data-hat="${i}" aria-pressed="${i === 0}">${h.label}</button>`).join('')}</div>`,
    ui.label('Jelly') + ui.swatches('Flavour', [
      { id: 'lido', label: 'Lido', grad: ['#e2f6fc', '#6ac4e8', '#1a6aa8'] },
      { id: 'lemonade', label: 'Lemonade', grad: ['#fcfae0', '#f0e070', '#b8a020'] },
      { id: 'strawberry', label: 'Strawberry', grad: ['#fde6ec', '#f08aa8', '#b02a5a'] }]),
    ui.slider('cur', 'Current', 0, 200, 100, '100%') + ui.slider('firm', 'Firmness', 0, 100, 50, '50') + ui.slider('damp', 'Wave damping', 0, 100, 30, '30'),
    ui.line([['reset', 'Reset'], ['pause', 'Pause', false], ['sound', 'Sound', false], ['resetView', 'View']]),
  ],
  howTo: { big: 'Add ducks. Pick one up to dress it.', small: 'Drag a duck, a float or the beach ball to pick it up and throw it — pick a duck, then choose its colour and what it wears · Follow rides along with it · click the hourglass to turn it over, the radio to switch it on · drag across the water to make waves · drag the side of the block to tip it · drag empty space or right-drag to look round · scroll or pinch to zoom' },
});

const PAPER = paperRadiance(PAPER_HEX);
const FIXED = { grass: '#6aaa48', tile: '#8fd2e8', tile2: '#2a6aa8', grout: '#e8f0f2', stone: '#ece2d2', stone2: '#e0d2bc', coping: '#f6f4ee', mosaic: '#f7c81e', beak: '#f2731e', concrete: '#b8b4ac', band: '#2a7ab8', sand: '#ecd6a4', terracotta: '#c87a5a', tub: '#b8a8e8' };
const FLAVOURS = {
  lido: { sigma: [3.6, 1.2, 0.9], tint: [0.08, 0.3, 0.42], strata: ['#3a5a7a', '#8ac8e8', '#d8f0f8', '#fbfcfd', '#a8dcf0'], peb: ['#a8dcf0', '#f8e0a0', '#c8e8d8', '#f0c8d8'] },
  lemonade: { sigma: [1.2, 1.4, 4.2], tint: [0.36, 0.38, 0.08], strata: ['#6a5a2a', '#e8d070', '#f8f0c0', '#fdfcf0', '#f0e098'], peb: ['#f0e098', '#c8e8a0', '#f8d0a0', '#e0f0c0'] },
  strawberry: { sigma: [0.9, 3.8, 2.6], tint: [0.42, 0.12, 0.2], strata: ['#6a2a3a', '#e88aa8', '#f8d0dc', '#fdf4f6', '#f0a8c0'], peb: ['#f0a8c0', '#f8e0a0', '#e8c8f0', '#c8e8d8'] },
};
const SUN = sunSetup([-0.35, 0.82, 0.45], [0, 1.2, 0], 4.3);
const CAM0 = { az: 0.55, el: 0.78, target: [0.1, 1.3, -0.35] };   // from the front right, as in the plan's drawing
// fitted to the pool's inside, so the block runs off the page's edges: the pool fills the page
const FIT_PTS = [[-1.63, P.TER, -2.17], [2.23, P.TER, -2.17], [-1.63, P.TER, 1.82], [2.23, P.TER, 1.82]];

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.pool');
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const Pn = wirePanel(root, on, stage), $ = Pn.$;
  const reduced = stage.reduced.matches;
  const Sound = createSound();
  signal.addEventListener('abort', () => Sound.close());
  let paused = false, flavour = 'lido', follow = false;
  const toggleRadio = () => { if (world.toggleRadio() && !Sound.on) stage.toast('The radio is on: switch Sound on to hear it'); };
  const U = new Float32Array(UO.SIZE);

  const world = createWorld({ reduced, seed: 14 });
  const { mesh, parts } = buildScene();
  const renderer = await createRenderer(ctx.gpu, canvas, mesh);
  const inst = new Float32Array(mesh.nParts * 12), waterBuf = new Float32Array(P.GN * P.GN * 4), bubBuf = new Float32Array(400 * 4);
  setPart(inst, 0, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const view = createDioramaView({
    canvas, signal, renderer, block: world.block, water: world.water, sun: SUN, cam0: CAM0, fitPoints: FIT_PTS, tiltMax: P.TILT_MAX,
    obstacles: () => [], pick: world.pick, bodies: world.hand,
    handlers: {   // a click on the hourglass turns it over; on the radio, switches it on or off (or the panel's buttons)
      glass: { start() { world.turnGlass(); }, move() {}, end() {} },
      radio: { start() { toggleRadio(); }, move() {}, end() {} },
    },
  });
  const cam = view.cam;

  function setFlavour(name) {
    const F = FLAVOURS[name] || FLAVOURS.lido;
    flavour = FLAVOURS[name] ? name : 'lido';
    const pal = (k, hex) => U.set([...hexLin(hex), 0], UO.PAL + 4 * k);
    U.set([...F.sigma, 1], UO.SIGMA); U.set([...F.tint, 0], UO.TINT); U.set([...PAPER, 0], UO.PAPER);
    pal(0, FIXED.grass); F.strata.forEach((h, k) => pal(1 + k, h)); F.peb.forEach((h, k) => pal(6 + k, h));
    for (const [k, slot] of Object.entries(PAL)) pal(slot, FIXED[k.toLowerCase()]);
    Pn.pressSwatch(flavour);
  }
  function setPaused(p) { paused = p; Pn.setPaused(p); }
  const setFollow = (v) => {
    follow = v && world.ducks.length > 0;
    if (follow && !world.selected) world.selected = world.ducks[Math.floor(Math.random() * world.ducks.length)];
    $('follow').setAttribute('aria-pressed', String(follow));
  };
  Pn.swatches(setFlavour);
  Pn.slider('cur', (v, o) => { o.textContent = `${v}%`; world.setCurrent(v / 100); });
  Pn.slider('firm', (v, o) => { o.textContent = String(v); world.setFirm(v / 100); });
  Pn.slider('damp', (v, o) => { o.textContent = String(v); world.setDamp(v / 100); });
  on($('add1'), 'click', () => world.addDucks(1));
  on($('add5'), 'click', () => world.addDucks(5));
  on($('remove'), 'click', () => world.removeDuck());
  on($('mix'), 'click', () => world.mixUp());
  on($('glassBtn'), 'click', () => world.turnGlass());
  on($('radioBtn'), 'click', () => toggleRadio());
  on($('unpick'), 'click', () => { world.selected = null; setFollow(false); });
  on($('follow'), 'click', () => setFollow(!follow));
  for (const b of root.querySelectorAll('.dk-sw')) on(b, 'click', () => world.setColour(+b.dataset.colour));
  for (const b of root.querySelectorAll('.dk-chip')) on(b, 'click', () => world.setHat(+b.dataset.hat));
  const setSound = (v) => { Sound.set(v); $('sound').setAttribute('aria-pressed', String(Sound.on)); $('sound').textContent = Sound.on ? 'Sound on' : 'Sound'; };
  on($('sound'), 'click', () => setSound(!Sound.on));
  on($('reset'), 'click', () => { world.reset(); setFollow(false); });
  on($('pause'), 'click', () => setPaused(!paused));
  on($('resetView'), 'click', () => { setFollow(false); view.resetView(); });

  let fps = 60, uiT = 0;
  function draw(dt) {
    if (!paused) world.advance(dt);
    if (follow) {   // ride along with the chosen duck
      const d = world.selected && world.ducks.includes(world.selected) ? world.selected : null;
      if (!d) setFollow(false);
      else { const k = Math.min(1, dt * 2.5), p = d.body.p; cam.target = cam.target.map((v, i) => v + (p[i] - v) * k); cam.dist += (Math.min(cam.dist, 5.5) - cam.dist) * k; }
    }
    const CAMV = view.frame(dt, U, world.time);
    poseScene(inst, parts, world);
    world.water.pack(waterBuf);
    const nBubbles = world.bubbles.pack(bubBuf);
    renderer.render({ U, cam: CAMV, sun: SUN.SUNV, water: waterBuf, foam: world.foam.pack(), inst, instFloats: inst.length, bubbles: bubBuf, nBubbles });
    Sound.frame(world.events, world.currentK, world.radio);
    world.events.length = 0;
    if ((uiT -= dt) <= 0) {
      uiT = 0.2;
      const t = world.tally(), sel = world.selected && world.ducks.includes(world.selected) ? world.selected : null;
      $('storyText').textContent = `${t.ducks} afloat${t.ducks >= MAX_DUCKS ? ' (all the pool takes)' : ''}`;
      $('nSlides').textContent = t.slides; $('nReturns').textContent = t.returns;
      $('add1').disabled = $('add5').disabled = t.ducks >= MAX_DUCKS; $('remove').disabled = t.ducks === 0;
      $('who').textContent = sel ? `${COLOURS[sel.colour].label} duck no. ${sel.id}${sel.laps ? ` · ${sel.laps} lap${sel.laps > 1 ? 's' : ''}` : ''}` : 'New ducks';
      $('unpick').hidden = !sel;
      $('radioBtn').setAttribute('aria-pressed', String(world.radio)); $('radioBtn').textContent = world.radio ? 'Radio on' : 'Radio';
      const c = sel ? sel.colour : world.next.colour, h = sel ? sel.hat : world.next.hat;
      for (const b of root.querySelectorAll('.dk-sw')) b.setAttribute('aria-pressed', String(+b.dataset.colour === c));
      for (const b of root.querySelectorAll('.dk-chip')) b.setAttribute('aria-pressed', String(+b.dataset.hat === h));
    }
  }
  setFlavour('lido');
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  ctx.hook({
    world, renderer, cam,
    state: () => ({ paused, flavour, follow, ...world.tally(), selected: world.selected ? world.selected.id : null, current: world.currentK, sound: Sound.on, sand: +world.glass.s.toFixed(3), radio: world.radio, energy: world.water.energy, fps: Math.round(fps), size: renderer.size,
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist } }),
    /** Where the clickable props are drawn (block-local points for toPx), from the layout. */
    spots: () => ({ radio: [P.RADIO[0], P.TER + 0.04, P.RADIO[1]], hourglass: [P.HOURGLASS[0], P.TER + 0.3, P.HOURGLASS[1]] }),
    step(n = 1) { world.step(n); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    reset: () => world.reset(),
    pause: (p) => setPaused(!!p),
    flavour: setFlavour,
    add: (n = 1) => world.addDucks(n), remove: () => world.removeDuck(), colour: (i) => world.setColour(i), hat: (i) => world.setHat(i), mix: () => world.mixUp(), current: (k) => world.setCurrent(k), follow: (v) => setFollow(!!v),
    select: (i) => { world.selected = world.ducks[i] || null; },
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
