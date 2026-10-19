// Rubber Duck Pool: a walled pool terrace on a cliff above the sea, filling the page. Rubber ducks circle the big
// pool, go down the slide into the round one on the lawn, are drawn down its drain and ride a clear tube back up
// into the big pool; new ones drop into its middle. The page is the scene alone: its own controls are still to
// come, so for now the pool answers the canvas (drag a duck or a float, click the hourglass, the radio or a deck
// chair, drag the water, look round) and the hook (window.__pool) does the rest. On the shared diorama engine
// (@lid/diorama); src/main.js hosts it.
import { srgbToLinear as hexLin } from '@lid/diorama/math.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { UO } from '@lid/diorama/renderer.js';
import { setPart } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { createWorld } from './world.js';
import { buildScene, poseScene } from './scene.js';
import { createRenderer, PAL } from './renderer.js';
import { createSound } from './sound.js';
import { MAX_DUCKS } from './ducks.js';
import { loadDuckAssets } from './duck-assets.js';
import { createOcean } from './ocean-gpu.js';
import { createFx, FX_MAX, FX_FLOATS } from './fx.js';
import { PLACEMENTS, PROP_FLOATS, loadProps, poseProps } from './props.js';
import { STATIONS } from './radio.js';
import { daylight } from './daylight.js';

export const meta = { name: 'Rubber Duck Pool' };

// the name tags' layer (shown by the hook's names(true)): one span per duck over its head
export const extra = `<style>
.pool .dk-tags { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.pool .dk-tags span { position: absolute; left: 0; top: 0; padding: 2px 7px 3px; border-radius: 999px; background: rgba(247, 245, 241, .82); color: #241f1d; font: italic 12px/1.2 "Iowan Old Style", Palatino, Georgia, serif; white-space: nowrap; will-change: transform; }
.pool .dk-tags span.picked { background: #241f1d; color: #f7f5f1; }
</style><div class="pool"></div>`;

const PAINT = { grass: '#5a9e3a', tile: '#4cbcb4', tile2: '#1d6a80', grout: '#2a4a50', stone: '#eee6d8', stone2: '#ddd0bc', coping: '#f2ece2', mosaic: '#f7c81e', beak: '#f2731e', concrete: '#b8b4ac', band: '#1d5f80', sand: '#ecd6a4', terracotta: '#c87a5a', tub: '#9a7ed6',
  rock: '#d8c8aa', rock2: '#bca988', weed: '#4a5a3a' };
const POOL_SIGMA = [2.2, 0.62, 0.45];   // the pools' water's absorption (its scattered colour, the glow, comes with the time of day)
const SKY_PAL = ['SKY', 'HAZE', 'SEA', 'SHALLOW'];   // the slots the time of day sets
const SUN = sunSetup([-0.35, 0.82, 0.45], [0, 1.2, 0], 6);
// from the front right corner of the big pool, looking across it to the wall with the round windows (the colonnade on
// the right, the lawn, the round pool and the sea on the left), as someone standing there would see it
const [mx0, mz0, mx1, mz1] = P.MAIN, HZ = P.HEAD[1] - P.HEAD[2];
const CAM0 = { az: 1.2, el: 0.28, target: [(mx0 + mx1) / 2 - 0.7, P.LU, (mz0 + mz1) / 2] };
// fitted to the big pool (its corners and the head's far edge), so it fills the frame, and to a point in the sky far
// out beyond it, so the horizon and a band of sky stay in the frame
const FIT_PTS = [[mx0, P.TER, mz0], [mx0, P.TER, mz1], [mx1, P.TER, mz0], [mx1, P.TER, mz1], [P.HEAD[0], P.TER, HZ],
  [CAM0.target[0] - 60 * Math.sin(CAM0.az), 3, CAM0.target[2] - 60 * Math.cos(CAM0.az)]];
/** The sun's shadow map round what the camera looks at, wide enough for the view (sharp close to, coarse far off). */
const shadowAround = (cam) => [cam.target, Math.min(10, Math.max(3, cam.dist * 0.75))];

export async function mount(ctx) {
  const { canvas, signal, stage } = ctx, root = stage.el.extra.querySelector('.pool');
  const on = (el, ev, fn, o) => el.addEventListener(ev, fn, { signal, ...o });
  const reduced = stage.reduced.matches;
  const Sound = createSound();
  signal.addEventListener('abort', () => Sound.close());
  let paused = false, follow = false;
  const U = new Float32Array(UO.SIZE);

  const world = createWorld({ reduced, seed: 14 });
  const { mesh, parts } = buildScene();
  const ocean = await createOcean(ctx.gpu.device);
  const renderer = await createRenderer(ctx.gpu, canvas, mesh, await loadDuckAssets(ctx.gpu.device), ocean, await loadProps());
  const fxAt = parts.duckBase + MAX_DUCKS * 16, fx = createFx(P.rng(7));   // the tapped ducks' bursts, after the ducks in inst
  const propAt = fxAt + FX_MAX * FX_FLOATS;   // the props' placements, after the bursts
  const inst = new Float32Array(propAt + PLACEMENTS.length * PROP_FLOATS), waterBuf = new Float32Array(P.GN * P.GN * 4), bubBuf = new Float32Array(400 * 4);
  setPart(inst, 0, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const view = createDioramaView({
    canvas, signal, renderer, block: world.block, water: world.water, sun: SUN, cam0: CAM0, fitPoints: FIT_PTS, tiltMax: P.TILT_MAX, far: 6000,
    obstacles: () => [], pick: world.pick, bodies: world.hand,
    handlers: {   // a click on the hourglass turns it over; on the radio, turns it to the next station; on a deck chair, sits in it
      glass: { start() { world.turnGlass(); }, move() {}, end() {} },
      radio: { start() { world.tuneRadio(); }, move() {}, end() {} },
      seat: { start(hit) { sit(hit.seat); }, move() {}, end() {} },
    },
  });
  const cam = view.cam;
  on(canvas, 'pointerdown', () => { if (!Sound.on) Sound.set(true); }, { once: true });   // the first touch wakes the sound (a browser lets it start only then)
  // name tags: one span per duck, placed over its head each frame while they are shown
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
  const setFollow = (v) => {
    follow = v && world.ducks.length > 0;
    if (follow && !world.selected) world.selected = world.ducks[Math.floor(Math.random() * world.ducks.length)];
  };
  const sit = (i) => { setFollow(false); view.lookFrom(P.SEATS[i].eye, P.SEATS[i].look); };

  U.set([...hexLin(PAINT.grass), 0], UO.PAL);
  for (const [k, slot] of Object.entries(PAL)) if (!SKY_PAL.includes(k)) U.set([...hexLin(PAINT[k.toLowerCase()]), 0], UO.PAL + 4 * slot);
  /** The sun (or moon), the sky, the sea and the pools' glow for the hour. */
  function timeOfDay(hour) {
    const L = daylight(hour);
    Object.assign(SUN, sunSetup(L.dir, ...shadowAround(cam))); SUN.tint = L.tint;
    U.set([...POOL_SIGMA, L.exposure], UO.SIGMA); U.set([...L.glow, 0], UO.TINT);
    U.set([...L.sky, L.night], UO.PAL + 4 * PAL.SKY); U.set([...L.haze, L.lst], UO.PAL + 4 * PAL.HAZE);
    U.set([...L.sea, 0], UO.PAL + 4 * PAL.SEA); U.set([...L.shallow, 0], UO.PAL + 4 * PAL.SHALLOW);
  }

  let fps = 60;
  function draw(dt) {
    if (!paused) world.advance(dt);
    if (follow) {   // ride along with the chosen duck
      const d = world.selected && world.ducks.includes(world.selected) ? world.selected : null;
      if (!d) setFollow(false);
      else { const k = Math.min(1, dt * 2.5), p = d.body.p; cam.target = cam.target.map((v, i) => v + (p[i] - v) * k); cam.dist += (Math.min(cam.dist, 5.5) - cam.dist) * k; }
    }
    timeOfDay(world.day.hour);
    const CAMV = view.frame(dt, U, world.time);
    const nDucks = poseScene(inst, parts, world);
    for (const e of world.events) if (e.type === 'voice') fx.burst([e.x, e.y, e.z], e.colour);
    fx.step(dt);
    const nFx = fx.pack(inst, fxAt);
    poseProps(inst, propAt, world);
    placeTags();
    world.water.pack(waterBuf);
    const nBubbles = world.bubbles.pack(bubBuf);
    ocean.update(world.time);
    renderer.render({ U, cam: CAMV, sun: SUN.SUNV, water: waterBuf, foam: world.foam.pack(), inst, instFloats: inst.length, bubbles: bubBuf, nBubbles, nDucks, nFx });
    Sound.frame(world.events, world.currentK, world.station);
    world.events.length = 0;
  }
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  ctx.hook({
    world, renderer, cam, ocean,
    state: () => ({ paused, follow, ...world.tally(), selected: world.selected ? world.selected.id : null, current: world.currentK, sound: Sound.on, sand: +world.glass.s.toFixed(3), hour: +world.day.hour.toFixed(2), clock: world.day.run, night: +daylight(world.day.hour).night.toFixed(2), radio: world.radio, station: world.station ? STATIONS[world.station - 1].name : null, energy: world.water.energy, fps: Math.round(fps), size: renderer.size,
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist, target: cam.target.slice() } }),
    /** Where the clickable props are drawn (block-local points for toPx), from the layout. */
    spots: () => ({ radio: [P.RADIO[0], P.TER + 0.04 * P.SIZE.radio, P.RADIO[1]], hourglass: [P.HOURGLASS[0], P.TER + 0.3 * P.SIZE.glass, P.HOURGLASS[1]], seats: P.SEATS.map((q) => ({ chair: [q.at[0], q.y + 0.06 * P.SIZE.chair, q.at[1]], eye: q.eye })) }),
    step(n = 1) { world.step(n); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    reset: () => { world.reset(); setFollow(false); },
    pause: (p) => { paused = !!p; },
    add: (n = 1) => world.addDucks(n), addFlyer: () => !!world.addFlyer(), remove: () => world.removeDuck(), colour: (i) => world.setColour(i), hat: (i) => world.setHat(i), mix: () => world.mixUp(), current: (k) => world.setCurrent(k), follow: (v) => setFollow(!!v),
    hour: (h) => world.setHour(h), clock: (run) => world.setDayRun(!!run), names: (v) => { showTags = !!v; }, sound: (v) => Sound.set(!!v), sit, resetView: () => { setFollow(false); view.resetView(); },
    select: (i) => { world.selected = world.ducks[i] || null; },
    /** Tap duck i (as a quick press on it does); fx(): how many sprites are flying. */
    tap: (i) => world.hand.tap(world.ducks[i].body), fx: () => fx.count,
    tags: () => [...tagLayer.children].map((el) => el.textContent),
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
