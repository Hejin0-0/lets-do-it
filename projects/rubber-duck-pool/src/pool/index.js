// Rubber Duck Pool: a walled pool terrace on a cliff above the sea, filling the page. Rubber ducks circle the big
// pool, go down the slide into the round one on the lawn, are drawn down its drain and ride a clear tube back up
// into the big pool; new ones drop into its middle. Add ducks, take them away, pick one up and dress it (eight colours, seven
// things to wear), follow it round; turn the hourglass over, switch the radio on. A page of its own design on
// the shared diorama engine (@lid/diorama); src/main.js hosts it.
import { srgbToLinear as hexLin } from '@lid/diorama/math.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { dioramaPage, ui, wirePanel } from '@lid/diorama/ui.js';
import { UO } from '@lid/diorama/renderer.js';
import { setPart } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { createWorld } from './world.js';
import { buildScene, poseScene } from './scene.js';
import { createRenderer, PAL } from './renderer.js';
import { createSound } from './sound.js';
import { COLOURS, HATS, MAX_DUCKS, PROPELLER } from './ducks.js';
import { STATIONS } from './radio.js';
import { daylight } from './daylight.js';

const PAPER_HEX = '#e6f0f2';
export const meta = {
  name: 'Rubber Duck Pool', noun: 'pool', paper: PAPER_HEX,
  eyebrow: 'A terrace above the sea', title: ['Rubber Duck', 'Pool.'], caption: ['A pool courtyard full of rubber ducks.'],
  aria: 'A walled pool terrace on a cliff above the sea: rubber ducks circle a pool, ride a slide down into a round pool and a clear tube back up',
};

const CSS = `
.pool .mast, .pool .dio-foot { background: var(--glass); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border: 1px solid var(--rule); border-radius: 14px; padding: 14px 18px 16px; }
.pool .mast h1 { font-size: clamp(44px, 6vw, 84px); }
.pool .row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.pool .row4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.pool .row4 .btn-line { padding-left: 2px; padding-right: 2px; font-size: 12px; }
.pool .dk-tags { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.pool .dk-tags span { position: absolute; left: 0; top: 0; padding: 2px 7px 3px; border-radius: 999px; background: rgba(247, 245, 241, .82); color: #241f1d; font: italic 12px/1.2 "Iowan Old Style", Palatino, Georgia, serif; white-space: nowrap; will-change: transform; }
.pool .dk-tags span.picked { background: #241f1d; color: #f7f5f1; }
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
@media (max-width: 900px) { .pool .mast { padding: 10px 12px 12px; max-width: calc(100vw - 2 * var(--edge) - 152px); /* clear of the status pill */ } .pool .mast h1 { font-size: 34px; } }`;

export const extra = dioramaPage({
  scope: 'pool', paper: PAPER_HEX, accent: '#2a8ad8', eyebrow: meta.eyebrow, title: meta.title, caption: 'A pool courtyard full of rubber ducks.', css: CSS,
  sections: [
    '<p class="dio-story" id="story" aria-live="polite"><b>Ducks</b><span id="storyText">12 afloat</span></p>' +
      '<div class="row3" style="margin-top:0"><button class="btn-dark" id="add1">Add a duck</button><button class="btn-dark" id="add5">Add five</button><button class="btn-dark" id="addFlyer" title="A duck in a propeller cap: now and then it flies, and some flights take it out to sea">Add a flyer</button></div>' +
      '<div class="row4" style="margin-top:8px"><button class="btn-line" id="remove">Take one out</button><button class="btn-line" id="follow" aria-pressed="false">Follow</button><button class="btn-line" id="mix">Mix them up</button><button class="btn-line" id="tags" aria-pressed="false" title="Each duck\'s name over it">Names</button></div>' +
      '<p class="tally" aria-live="polite" style="margin-top:12px">Down the slide&nbsp;<b id="nSlides">0</b> · Up the tube&nbsp;<b id="nReturns">0</b> · Out to sea&nbsp;<b id="nEscaped">0</b></p>' +
      `<div class="row4" style="margin-top:10px"><button class="btn-line" id="glassBtn" title="Turn the hourglass over">Hourglass</button><button class="btn-line" id="radioBtn" aria-pressed="false" title="Turn the radio to the next station">Radio</button>${P.SEATS.map((q, i) => `<button class="btn-line" id="seat${i}" title="Sit in the ${q.label.toLowerCase()}">${q.label}</button>`).join('')}</div>`,
    ui.label('Dress') + '<p class="dk-who"><span id="who">New ducks</span><button id="unpick" hidden>Let go ✕</button></p>' +
      `<div class="dk-row" role="group" aria-label="Duck colour">${COLOURS.map((c, i) => `<button class="dk-sw" data-colour="${i}" aria-pressed="${i === 0}" aria-label="${c.label}" title="${c.label}" style="background: radial-gradient(circle at 35% 30%, #fff8, ${c.body} 55%)"></button>`).join('')}</div>` +
      `<div class="dk-chips" role="group" aria-label="Duck decoration">${HATS.map((h, i) => (h.special ? '' : `<button class="dk-chip" data-hat="${i}" aria-pressed="${i === 0}">${h.label}</button>`)).join('')}</div>`,
    ui.label('Time') + ui.slider('hour', 'Time of day', 0, 96, 60, '15:00') + '<button class="btn-line" id="dayRun" aria-pressed="true" style="width:100%;margin-top:6px">Time passing</button>',
    ui.label('Water') + ui.slider('cur', 'Current', 0, 200, 100, '100%'),
    ui.line([['reset', 'Reset'], ['pause', 'Pause', false], ['sound', 'Sound', false], ['resetView', 'View']]),
  ],
  howTo: { big: 'Add ducks. Pick one up to dress it.', small: 'Drag a duck, a float or the beach ball to pick it up and throw it — a flyer flies off now and then, maybe out to sea — pick a duck, then choose its colour and what it wears · Follow rides along with it · Names shows who is who · click the hourglass to turn it over, the radio to change the station, a deck chair to sit in it · drag across the water to make waves · drag anywhere else or right-drag to look round · scroll or pinch to zoom' },
});

const PAINT = { grass: '#6aaa48', tile: '#8fd2e8', tile2: '#2a6aa8', grout: '#e8f0f2', stone: '#ece2d2', stone2: '#e0d2bc', coping: '#f6f4ee', mosaic: '#f7c81e', beak: '#f2731e', concrete: '#b8b4ac', band: '#2a7ab8', sand: '#ecd6a4', terracotta: '#c87a5a', tub: '#b8a8e8',
  rock: '#d8c8aa', rock2: '#bca988', weed: '#4a5a3a' };
const POOL_SIGMA = [3.6, 1.2, 0.9];   // the pools' water's absorption (its scattered colour, the glow, comes with the time of day)
const SKY_PAL = ['SKY', 'HAZE', 'SEA', 'SHALLOW'];   // the slots the time of day sets
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const SUN = sunSetup([-0.35, 0.82, 0.45], [0, 1.2, 0], 4.3);
const CAM0 = { az: 0.55, el: 0.26, target: [0.1, 1.3, -0.35] };   // from the front right, low enough to look out to sea
// fitted to the pool's inside, so the block runs off the page's edges, to the top of the hourglass (it is clicked),
// and to a point in the sky far out beyond it, so the horizon and a band of sky stay in the frame
const FIT_PTS = [[-1.63, P.TER, -2.17], [2.23, P.TER, -2.17], [-1.63, P.TER, 1.82], [2.23, P.TER, 1.82], [P.HOURGLASS[0], P.TER + 0.5, P.HOURGLASS[1]],
  [CAM0.target[0] - 60 * Math.sin(CAM0.az), 7, CAM0.target[2] - 60 * Math.cos(CAM0.az)]];

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.pool');
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const Pn = wirePanel(root, on, stage), $ = Pn.$;
  const reduced = stage.reduced.matches;
  const Sound = createSound();
  signal.addEventListener('abort', () => Sound.close());
  let paused = false, follow = false;
  const tuneRadio = () => { const st = world.tuneRadio(); if (st) stage.toast(Sound.on ? `Radio: ${STATIONS[st - 1].name}` : `Radio: ${STATIONS[st - 1].name}. Switch Sound on to hear it`); };
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
      radio: { start() { tuneRadio(); }, move() {}, end() {} },
      seat: { start(hit) { sit(hit.seat); }, move() {}, end() {} },
    },
  });
  const cam = view.cam;
  // name tags: one span per duck, placed over its head each frame while Names is on (under the page's own frames)
  const tagLayer = document.createElement('div'); tagLayer.className = 'dk-tags'; tagLayer.setAttribute('aria-hidden', 'true');
  root.prepend(tagLayer); signal.addEventListener('abort', () => tagLayer.remove());
  const tagOf = new Map();
  let showTags = false;
  function placeTags() {
    const seen = new Set();
    if (showTags) for (const d of world.ducks) {
      const b = d.body, at = d.state === 'tube' && b.p[1] < P.terrainH(b.p[0], b.p[2]) ? null : view.toPx([b.p[0], b.p[1] + 0.24, b.p[2]]);
      if (!at) continue;
      let el = tagOf.get(d);
      if (!el) { el = document.createElement('span'); el.textContent = d.name; tagLayer.append(el); tagOf.set(d, el); }
      el.style.transform = `translate(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px) translate(-50%, -100%)`;
      el.classList.toggle('picked', d === world.selected);
      seen.add(d);
    }
    for (const [d, el] of tagOf) if (!seen.has(d)) { el.remove(); tagOf.delete(d); }
  }
  const sit = (i) => { setFollow(false); view.lookFrom(P.SEATS[i].eye, P.SEATS[i].look); };

  U.set([...hexLin(PAINT.grass), 0], UO.PAL);
  for (const [k, slot] of Object.entries(PAL)) if (!SKY_PAL.includes(k)) U.set([...hexLin(PAINT[k.toLowerCase()]), 0], UO.PAL + 4 * slot);
  /** The sun (or moon), the sky, the sea and the pools' glow for the hour. */
  function timeOfDay(hour) {
    const L = daylight(hour);
    Object.assign(SUN, sunSetup(L.dir, [0, 1.2, 0], 4.3)); SUN.tint = L.tint;
    U.set([...POOL_SIGMA, L.exposure], UO.SIGMA); U.set([...L.glow, 0], UO.TINT);
    U.set([...L.sky, L.night], UO.PAL + 4 * PAL.SKY); U.set([...L.haze, 0], UO.PAL + 4 * PAL.HAZE);
    U.set([...L.sea, 0], UO.PAL + 4 * PAL.SEA); U.set([...L.shallow, 0], UO.PAL + 4 * PAL.SHALLOW);
  }
  function setPaused(p) { paused = p; Pn.setPaused(p); }
  const setFollow = (v) => {
    follow = v && world.ducks.length > 0;
    if (follow && !world.selected) world.selected = world.ducks[Math.floor(Math.random() * world.ducks.length)];
    $('follow').setAttribute('aria-pressed', String(follow));
  };
  Pn.slider('hour', (v, o) => { o.textContent = hhmm(v / 4); world.setHour(v / 4); });
  on($('dayRun'), 'click', () => world.setDayRun(!world.day.run));
  Pn.slider('cur', (v, o) => { o.textContent = `${v}%`; world.setCurrent(v / 100); });
  on($('add1'), 'click', () => world.addDucks(1));
  on($('add5'), 'click', () => world.addDucks(5));
  on($('addFlyer'), 'click', () => { if (world.addFlyer()) stage.toast('A flyer: watch its propeller'); });
  on($('remove'), 'click', () => world.removeDuck());
  on($('mix'), 'click', () => world.mixUp());
  on($('tags'), 'click', () => { showTags = !showTags; $('tags').setAttribute('aria-pressed', String(showTags)); });
  on($('glassBtn'), 'click', () => world.turnGlass());
  on($('radioBtn'), 'click', () => tuneRadio());
  P.SEATS.forEach((_, i) => on($('seat' + i), 'click', () => sit(i)));
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
    timeOfDay(world.day.hour);
    const CAMV = view.frame(dt, U, world.time);
    poseScene(inst, parts, world);
    placeTags();
    world.water.pack(waterBuf);
    const nBubbles = world.bubbles.pack(bubBuf);
    renderer.render({ U, cam: CAMV, sun: SUN.SUNV, water: waterBuf, foam: world.foam.pack(), inst, instFloats: inst.length, bubbles: bubBuf, nBubbles });
    if (world.events.some((e) => e.type === 'swanIn')) stage.toast('The swan has hopped into the pool');
    if (world.events.some((e) => e.type === 'escaped')) stage.toast('A flyer made it over the cliff and out to sea!');
    Sound.frame(world.events, world.currentK, world.station);
    world.events.length = 0;
    if ((uiT -= dt) <= 0) {
      uiT = 0.2;
      const t = world.tally(), sel = world.selected && world.ducks.includes(world.selected) ? world.selected : null;
      $('storyText').textContent = `${t.ducks} afloat${t.ducks >= MAX_DUCKS ? ' (all the pool takes)' : ''}`;
      $('nSlides').textContent = t.slides; $('nReturns').textContent = t.returns; $('nEscaped').textContent = t.escaped;
      $('add1').disabled = $('add5').disabled = $('addFlyer').disabled = t.ducks >= MAX_DUCKS; $('remove').disabled = t.ducks === 0;
      $('who').textContent = sel ? `${sel.name}, a ${COLOURS[sel.colour].label.toLowerCase()} ${sel.hat === PROPELLER ? 'flyer' : 'duck'}${sel.laps ? ` · ${sel.laps} lap${sel.laps > 1 ? 's' : ''}` : ''}` : 'New ducks';
      $('unpick').hidden = !sel;
      if (document.activeElement !== $('hour')) { $('hour').value = Math.round(world.day.hour * 4); $('hourOut').textContent = hhmm(world.day.hour); }
      $('dayRun').setAttribute('aria-pressed', String(world.day.run)); $('dayRun').textContent = world.day.run ? 'Time passing' : 'Time stopped';
      $('radioBtn').setAttribute('aria-pressed', String(world.radio)); $('radioBtn').textContent = world.station ? STATIONS[world.station - 1].name : 'Radio';
      const c = sel ? sel.colour : world.next.colour, h = sel ? sel.hat : world.next.hat;
      for (const b of root.querySelectorAll('.dk-sw')) b.setAttribute('aria-pressed', String(+b.dataset.colour === c));
      for (const b of root.querySelectorAll('.dk-chip')) b.setAttribute('aria-pressed', String(+b.dataset.hat === h));
    }
  }
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  ctx.hook({
    world, renderer, cam,
    state: () => ({ paused, follow, ...world.tally(), selected: world.selected ? world.selected.id : null, current: world.currentK, sound: Sound.on, sand: +world.glass.s.toFixed(3), hour: +world.day.hour.toFixed(2), night: +daylight(world.day.hour).night.toFixed(2), radio: world.radio, station: world.station ? STATIONS[world.station - 1].name : null, energy: world.water.energy, fps: Math.round(fps), size: renderer.size,
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist, target: cam.target.slice() } }),
    /** Where the clickable props are drawn (block-local points for toPx), from the layout. */
    spots: () => ({ radio: [P.RADIO[0], P.TER + 0.04, P.RADIO[1]], hourglass: [P.HOURGLASS[0], P.TER + 0.3, P.HOURGLASS[1]], seats: P.SEATS.map((q) => ({ chair: [q.at[0], q.y + 0.07, q.at[1]], eye: q.eye })) }),
    step(n = 1) { world.step(n); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    reset: () => world.reset(),
    pause: (p) => setPaused(!!p),
    add: (n = 1) => world.addDucks(n), addFlyer: () => !!world.addFlyer(), remove: () => world.removeDuck(), colour: (i) => world.setColour(i), hat: (i) => world.setHat(i), mix: () => world.mixUp(), current: (k) => world.setCurrent(k), follow: (v) => setFollow(!!v),
    select: (i) => { world.selected = world.ducks[i] || null; },
    tags: () => [...tagLayer.children].map((el) => el.textContent),
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
