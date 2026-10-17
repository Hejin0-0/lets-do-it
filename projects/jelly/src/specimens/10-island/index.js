// 10 — Island Jelly: a sandbar, three gummy palms and a sea that wobbles back, in a
// block of jelly you can stir, tip and throw things into. A page of its own design (meta.layout 'custom')
// in #extra, scoped under .island; its own renderer (shallow-water sea, caustics) on the shared device.
import { srgbToLinear as hexLin } from '../../core/math.js';
import { createDioramaView, sunSetup, paperRadiance, blockEdgePoints } from '../../core/diorama/view.js';
import { dioramaPage, ui, wirePanel } from '../../core/diorama/ui.js';
import { IJ } from './world.js';
import { createRenderer, UO, PAL } from './renderer.js';

export const meta = {
  id: '10', name: 'Island Jelly', noun: 'island', paper: '#ece9e3', layout: 'custom',
  eyebrow: 'Material Studies / No. 010', title: ['Island', 'Jelly.'], caption: ['A sandbar, three palms and a sea that wobbles back.'],
  aria: 'A jelly island in a block of sea you can stir, tip and throw things into',
};
export const panel = '';
export const foot = '';
export const notes = '';

export const extra = dioramaPage({
  scope: 'island', paper: '#ece9e3', accent: '#178a8a', no: '010', title: ['Island', 'Jelly.'], caption: 'A sandbar, three palms and a sea that wobbles back.',
  sections: [
    ui.label('The sea') + ui.dark([['dropPebble', 'Drop a pebble'], ['dropCoconut', 'Drop a coconut']]) + ui.meter('Sea liveliness') +
      '<p class="tally" aria-live="polite">Afloat&nbsp;<b id="nAfloat">0</b> · Sunk&nbsp;<b id="nSunk">0</b> · Ashore&nbsp;<b id="nAshore">0</b></p>',
    ui.label('Flavour') + ui.swatches('Flavour', [
      { id: 'lagoon', label: 'Lagoon', grad: ['#b8f4ee', '#2bb5b0', '#0d6f73'] },
      { id: 'raspberry', label: 'Raspberry', grad: ['#ffc6d6', '#e2477a', '#93184a'] },
      { id: 'lime', label: 'Lime', grad: ['#efffb0', '#a6d33a', '#5b8a12'] }]),
    ui.slider('firm', 'Firmness', 0, 100, 50, '50') + ui.slider('damp', 'Wave damping', 0, 100, 30, '30') + ui.slider('tide', 'Tide', -100, 100, 0, '0 cm'),
    ui.line([['reset', 'Reset'], ['pause', 'Pause', false], ['resetView', 'Reset view']]),
  ],
  howTo: { big: 'Stir the sea. Tip the block. Throw a coconut.', small: 'Drag across the water to make waves · drag the side of the block to tip it and watch the sea slosh · pick up a coconut or a pebble and throw it · drag empty space or right-drag to orbit · scroll or pinch to zoom' },
});


const PAPER = paperRadiance('#ece9e3');
const FLAVOURS = {
  lagoon: { sigma: [2.3, 0.52, 0.42], tint: [0.03, 0.34, 0.37], sand: '#ead0a0', strata: ['#5a3524', '#c07c3c', '#f3a3b4', '#f6e8c8', '#c9a774'],
    leaf: '#3f9f48', trunk: '#c08850', coco: '#6c4226', peb: ['#f6aec1', '#9cd6ea', '#f8dc8c', '#c2afec'] },
  raspberry: { sigma: [0.34, 2.2, 1.25], tint: [0.44, 0.05, 0.17], sand: '#efd5aa', strata: ['#4f2a22', '#b9693a', '#ffd0dc', '#fae9d0', '#cfa97a'],
    leaf: '#5aa63d', trunk: '#b97b49', coco: '#673b25', peb: ['#ffd1dc', '#f5a2bf', '#fff0b4', '#d7c6f4'] },
  lime: { sigma: [1.45, 0.5, 2.6], tint: [0.12, 0.25, 0.035], sand: '#eddaa6', strata: ['#553424', '#c08a3e', '#f4b0bd', '#f8edc9', '#cdb27a'],
    leaf: '#2f9852', trunk: '#c3925a', coco: '#71472a', peb: ['#fbe59c', '#b4e4c2', '#f6b6c6', '#b9d6f4'] },
};
const SUN = sunSetup();
const CAM0 = { az: 0.62, el: 0.42, target: [0, 0.85, 0] };
// points that must stay in the free space: the block's edges and the palm crowns
const FIT_PTS = (() => {
  const P = blockEdgePoints(IJ.HALF, IJ.WL0 + 0.15);
  for (const Pm of IJ.PALM_INFO) for (const [dx, dz] of [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55], [0, 0]]) P.push([Pm.crown[0] + dx, Pm.crown[1] + (dx || dz ? -0.05 : 0.3), Pm.crown[2] + dz]);
  return P;
})();

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.island');
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const P = wirePanel(root, on, stage), $ = P.$;
  const reduced = stage.reduced.matches;
  let paused = false, flavour = 'lagoon';
  const U = new Float32Array(UO.SIZE);
  const waterBuf = new Float32Array(IJ.GN * IJ.GN * 4), bodyBuf = new Float32Array(IJ.MAX_BODIES * 16), bubBuf = new Float32Array(400 * 4);

  const renderer = await createRenderer(ctx.gpu, canvas);
  const world = IJ.createWorld({ reduced, seed: 7 });
  // a palm crown: dragged across, it bends the palm and springs back
  const palmDrag = {
    start(hit, r) {
      const s = world.palms.st[hit.palm], c = world.palms.crownPos(hit.palm), at = view.planeHit(r, c, [0, 1, 0]) || c;
      s.held = true; s.target = s.b.slice();
      return { k: hit.palm, y: c[1], off: [s.b[0] - at[0], s.b[1] - at[2]] };
    },
    move(d, r) {
      const at = view.planeHit(r, [0, d.y, 0], [0, 1, 0]);
      if (at) world.palms.st[d.k].target = [at[0] + d.off[0], at[2] + d.off[1]];
    },
    end(d) { world.palms.st[d.k].held = false; },
  };
  const view = createDioramaView({
    canvas, signal, renderer, block: world.block, water: world.water, sun: SUN, cam0: CAM0, fitPoints: FIT_PTS, tiltMax: IJ.TILT_MAX,
    obstacles: P.obstacles,
    pick: world.pick, bodies: world, handlers: { palm: palmDrag },
  });
  const cam = view.cam;

  // ----- flavour -----
  function setFlavour(name) {
    const F = FLAVOURS[name] || FLAVOURS.lagoon;
    flavour = FLAVOURS[name] ? name : 'lagoon';
    const pal = (k, hex) => U.set([...hexLin(hex), 0], UO.PAL + 4 * k);
    U.set([...F.sigma, 1], UO.SIGMA); U.set([...F.tint, 0], UO.TINT); U.set([...PAPER, 0], UO.PAPER);
    pal(0, F.sand); F.strata.forEach((h, k) => pal(1 + k, h)); F.peb.forEach((h, k) => pal(6 + k, h));
    pal(PAL.LEAF, F.leaf); pal(PAL.TRUNK, F.trunk); pal(PAL.COCO, F.coco);
    P.pressSwatch(flavour);
  }
  on(window, 'keydown', (e) => {
    if (e.code !== 'Space') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    e.preventDefault();
    world.drop();
  });

  // ----- panel -----
  function setPaused(p) { paused = p; P.setPaused(p); }
  on($('dropPebble'), 'click', () => world.drop('pebble'));
  on($('dropCoconut'), 'click', () => world.drop('coconut'));
  P.swatches(setFlavour);
  P.slider('firm', (v, o) => { o.textContent = String(v); world.setFirm(v / 100); });
  P.slider('damp', (v, o) => { o.textContent = String(v); world.setDamp(v / 100); });
  P.slider('tide', (v, o) => {
    const cm = Math.round(v / 10);
    o.textContent = (cm > 0 ? '+' : cm < 0 ? '−' : '') + Math.abs(cm) + ' cm';
    world.setTide(v / 1000);
  });
  on($('reset'), 'click', () => world.reset());
  on($('pause'), 'click', () => setPaused(!paused));
  on($('resetView'), 'click', view.resetView);

  // ----- the loop -----
  let fps = 60, uiT = 0, eS = 0;
  function draw(dt) {
    if (!paused) world.advance(dt);
    world.palms.uniforms(U, UO.PAL + 4 * PAL.PALM, world.time, !reduced);
    const CAMV = view.frame(dt, U, world.time);
    world.water.pack(waterBuf);
    const nBodies = world.packBodies(bodyBuf), nBubbles = world.bubbles.pack(bubBuf);
    renderer.render({ U, cam: CAMV, sun: SUN.SUNV, water: waterBuf, inst: bodyBuf, instFloats: nBodies * 16, nBodies, bubbles: bubBuf, nBubbles });
    // panel readouts
    eS += (world.water.energy - eS) * Math.min(1, dt * 4);
    if ((uiT -= dt) <= 0) {
      uiT = 0.2;
      const t = world.tally(), m = Math.round(100 * (1 - Math.exp(-eS / 0.1)));
      $('nAfloat').textContent = t.afloat; $('nSunk').textContent = t.sunk; $('nAshore').textContent = t.ashore;
      P.meter(m);
    }
  }

  setFlavour('lagoon');
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  // ----- test hook -----
  ctx.hook({
    world, renderer, cam,
    state: () => ({ paused, flavour, firm: world.firm, damp: world.water.damp, tide: world.tide, level: world.water.level, bodies: world.bodies.length,
      bubbles: world.bubbles.count, energy: world.water.energy, tally: world.tally(), tilt: world.block.t.slice(), fps: Math.round(fps),
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist }, resets: world.water.resets, size: renderer.size }),
    step(n = 1) { for (let i = 0; i < n; i++) world.advance(1 / 60); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    drop: (kind) => { const b = world.drop(kind); return b ? b.id : null; },
    reset: () => world.reset(),
    stir: (x, z, speed = 2) => world.water.stir(x, z, speed),
    tilt: (tx, tz) => { world.block.grab(); world.block.setTarget(tx, tz); },
    release: () => world.block.release(),
    pause: (p) => setPaused(!!p),
    flavour: setFlavour,
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
