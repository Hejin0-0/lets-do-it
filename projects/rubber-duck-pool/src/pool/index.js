// Rubber Duck Pool: a walled pool terrace on a cliff above the sea, filling the page. Rubber ducks circle the big
// pool, go down the slide into the round one on the lawn, are drawn down its drain and ride a clear tube back up
// into the big pool; new ones drop into its middle. The pool answers the canvas (drag a duck or a float, tap a duck,
// click the hourglass, the radio or a deck chair, drag the water, look round); a seat brings its menu (seat-menu.js);
// the page's other controls are being made again, so the hook (window.__pool) holds the rest, for the checks too.
// On the shared diorama engine (@lid/diorama);
// src/main.js hosts it.
import { srgbToLinear as hexLin } from '@lid/diorama/math.js';
import { createDioramaView, sunSetup } from '@lid/diorama/view.js';
import { UO } from '@lid/diorama/renderer.js';
import { setPart } from '@lid/diorama/parts.js';
import { P } from './layout.js';
import { createWorld } from './world.js';
import { buildScene, poseScene } from './scene.js';
import { createRenderer, PAL, POOL_WATER } from './renderer.js';
import { createSound, SFX } from './sound.js';
import { MAX_DUCKS } from './ducks.js';
import { loadDuckAssets } from './duck-assets.js';
import { createOcean } from './ocean-gpu.js';
import { createFx, FX_MAX, FX_FLOATS } from './fx.js';
import { createCritters } from './critters.js';
import { PLACEMENTS, PROP_FLOATS, loadProps, poseProps, setMural } from './props.js';
import { STATIONS } from './radio.js';
import { daylight } from './daylight.js';
import { installNavigation } from './navigation.js';
import { letter } from './lettering.js';
import { createLogbook } from './logbook.js';
import { createSeating } from './seating.js';
import { createSeatMenu } from './seat-menu.js';

export const meta = { name: 'Rubber Duck Pool' };

// the name tags' layer (shown by the hook's names(true)): one span per duck over its head
export const extra = `<style>
.pool .dk-tags { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
.pool .dk-tags span { position: absolute; left: 0; top: 0; padding: 3px 9px 4px; border-radius: 999px; background: rgb(255 255 255 / .88); color: #1f2a30; box-shadow: 0 1px 3px rgb(0 0 0 / .2); font: 600 12px/1.2 system-ui, sans-serif; white-space: nowrap; will-change: transform; }
.pool .dk-tags span.picked { background: #1f2a30; color: #fff; }
.pool .dk-tags span { transition: opacity .15s; }
.pool .dk-tags span.crowded { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .pool .dk-tags span { transition: none; } }
</style><div class="pool"></div>`;

const PAINT = { grass: '#4a8a30', tile: '#4cbcb4', tile2: '#1d6a80', grout: '#2a4a50', stone: '#ead9bc', stone2: '#d6bf98', coping: '#f2ece2', mosaic: '#f7c81e', beak: '#f2731e', concrete: '#b8b4ac', band: '#1d5f80', sand: '#ecd6a4', terracotta: '#c87a5a', tub: '#9a7ed6',
  rock: '#d8c8aa', rock2: '#bca988', weed: '#4a5a3a' };
const POOL_SIGMA = POOL_WATER.a.map((v, i) => v + POOL_WATER.s[i]);   // the pools' water's extinction (renderer.js: after minamo)
const SKY_PAL = ['SKY', 'HAZE', 'SEA', 'SHALLOW'];
const POOL_HUES = [[0.14, 0.6, 0.79], [0.42, 0.28, 0.86], [0.8, 0.3, 0.55], [0.16, 0.78, 0.6]].map((c) => { const m = Math.hypot(...c); return c.map((v) => v / m); });   // the slots the time of day sets
const SUN = sunSetup([-0.35, 0.82, 0.45], [0, 1.2, 0], 6);
// from the front right corner of the big pool, looking across it to the wall with the round windows (the colonnade on
// the right, the lawn, the round pool and the sea on the left), as someone standing there would see it
const [mx0, mz0, mx1, mz1] = P.MAIN, HZ = P.HEAD[1] - P.HEAD[2];
const CAM0 = { az: .40, el: .65, target: [.8, 1.05, 1.1] };
// fitted to the big pool (its corners and the head's far edge), so it fills the frame, and to a point in the sky far
// out beyond it, so the horizon and a band of sky stay in the frame
const FIT_PTS = [[-6,1,-5.8],[8.8,1,-5.8],[-7.5,.8,8.8],[10,1,5.5],[0,4,-5.4]];
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
  const phone = matchMedia('(pointer: coarse)').matches;
  const renderer = await createRenderer(ctx.gpu, canvas, mesh, await loadDuckAssets(ctx.gpu.device), ocean, await loadProps(),
    phone ? 'low' : 'high');   // a phone: no occlusion or grain, a shorter bloom
  const fxAt = parts.duckBase + MAX_DUCKS * 16, fx = createFx(P.rng(7), reduced);   // the bursts, sprays and night shows, after the ducks in inst
  const critters = createCritters(P.rng(11));   // the gulls, butterflies, fireflies and fish, drawn after the bursts
  const propAt = fxAt + FX_MAX * FX_FLOATS;   // the props' placements, after the bursts
  const inst = new Float32Array(propAt + PLACEMENTS.length * PROP_FLOATS), waterBuf = new Float32Array(P.GN * P.GN * 4), bubBuf = new Float32Array(400 * 4);
  setPart(inst, 0, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  const SIT_S = 1.1, seating = createSeating({ seats: P.SEATS, duration: SIT_S });   // the seat arrives as the camera's ease ends
  const view = createDioramaView({
    canvas, signal, renderer, block: world.block, water: world.water, sun: SUN, cam0: CAM0, fitPoints: FIT_PTS, tiltMax: P.TILT_MAX, far: 6000,
    minDist: 1.8, maxDist: 42,   // as the wheel's (navigation.js), so a pinch never jumps
    maxDpr: phone ? 1.5 : 2,   // a phone's small screen stays sharp at 1.5, and its GPU fills 44% fewer pixels than at 2
    obstacles: () => [], pick: (o,d) => world.pick(o,d), bodies: world.hand,
    handlers: {   // a click on the hourglass turns it over; on the radio, turns it to the next station; on a deck chair, sits in it
      glass: { start() { world.turnGlass(); }, move() {}, end() {} },
      radio: { start() { world.tuneRadio(); }, move() {}, end() {} },
      seat: { start(hit) { seating.sit(hit.seat); }, move() {}, end() {} },
    },
  });
  const cam = view.cam;
  // A seat holds only while the camera is at its eye: any way the player moves the camera leaves it (walk, pan, the
  // wheel here; a drag or a pinch, which end the view's ease without telling the page, by the check in draw), so the
  // seat, the camera and the menu never disagree. Moving away keeps the camera where the player took it.
  const reset = () => { setFollow(false); if (!seating.stand('reset')) view.resetView(); };
  const navigation=installNavigation({canvas,signal,view,block:world.block,onMove:()=>{follow=false;seating.stand('moved');},onReset:reset});
  seating.on((e) => {
    if (e.type === 'sit') { setFollow(false); view.lookFrom(P.SEATS[e.seat].eye, P.SEATS[e.seat].look, SIT_S); }
    else if (e.type === 'stand' && e.reason !== 'moved') view.resetView();   // Stand up, Escape, R: the standing overview
  });
  // the boat as the seat's menu offers it: anything adrift (the book's bottles, a flyer at sea), whether it is out, and
  // the pages found; read when the menu draws, after the book below exists
  const boat = {
    state: () => ({ adrift: world.collectibles.adrift.length + world.ducks.filter((d) => d.state === 'sea').length, out: world.boat.state !== 'moored',
      found: book.pages.filter((p) => p.found).length, total: book.pages.length }),
    send: () => world.sendBoat(),
  };
  const seatMenu = createSeatMenu({ root, seats: P.SEATS, seating, toPx: view.toPx, fallback: canvas, boat, signal });
  // ponytail: the page plays no sound for now (the user's call, 10-29: the waves and the wind grated); the engine stays
  // for the hook and the checks. To bring it back, wake it on the first canvas pointerdown (a browser lets it start
  // only then) and let M toggle it.
  const setSound = (v) => Sound.set(v);
  // name tags: one span per duck, placed over its head each frame while they are shown
  const tagLayer = document.createElement('div'); tagLayer.className = 'dk-tags'; tagLayer.setAttribute('aria-hidden', 'true');
  root.prepend(tagLayer); signal.addEventListener('abort', () => tagLayer.remove());
  const tagOf = new Map();
  let showTags = false;
  function placeTags() {
    const seen = new Set(), list = [], ce = Math.cos(cam.el), eye = [cam.target[0] + cam.dist * ce * Math.sin(cam.az), cam.target[1] + cam.dist * Math.sin(cam.el), cam.target[2] + cam.dist * ce * Math.cos(cam.az)];
    if (showTags) for (const d of world.ducks) {
      const b = d.body, at = d.state === 'tube' && b.p[1] < P.terrainH(b.p[0], b.p[2]) ? null : view.toPx([b.p[0], b.p[1] + 0.24, b.p[2]]);
      if (!at) continue;
      let el = tagOf.get(d);
      if (!el) { el = document.createElement('span'); tagLayer.append(el); tagOf.set(d, el); }
      el.style.transform = `translate(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px) translate(-50%, -100%)`;
      if (el.classList.toggle('picked', d === world.selected) !== (el.dataset.picked === '1') || !el.dataset.picked) { el.dataset.picked = d === world.selected ? '1' : '0'; letter(el, d.name); }   // its colours turn when picked
      list.push({ d, el, at, rank: d === world.selected ? -1e9 : (el.classList.contains('crowded') ? 0 : -1e6) + Math.hypot(b.p[0] - eye[0], b.p[1] - eye[1], b.p[2] - eye[2]) });
      seen.add(d);
    }
    for (const [d, el] of tagOf) if (!seen.has(d)) { el.remove(); tagOf.delete(d); }
    // in a crowd, a name only where it covers none shown before it: the picked duck's, then those shown a moment ago (so
    // they don't flicker), then the nearest
    const shown = [];
    for (const t of list.sort((a, b) => a.rank - b.rank)) {
      const w = (t.el.w ||= t.el.offsetWidth) || 48, h = (t.el.h ||= t.el.offsetHeight) || 20, r = [t.at[0] - w / 2 - 2, t.at[1] - h - 2, t.at[0] + w / 2 + 2, t.at[1] + 2];
      const free = t.d === world.selected || !shown.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
      t.el.classList.toggle('crowded', !free);
      if (free) shown.push(r);
    }
  }
  const setFollow = (v) => {
    follow = v && world.ducks.length > 0;
    if (follow && !world.selected) world.selected = world.ducks[Math.floor(Math.random() * world.ducks.length)];
  };
  let store = null;
  try { store = window.localStorage; } catch { /* storage blocked: the book lives for this visit */ }
  const book = createLogbook(store);
  world.collectibles.setCollected(book.pages.filter((p) => p.found).map((p) => p.id));   // a page already found never drifts in again

  U.set([...hexLin(PAINT.grass), 0], UO.PAL);
  for (const [k, slot] of Object.entries(PAL)) if (!SKY_PAL.includes(k)) U.set([...hexLin(PAINT[k.toLowerCase()]), 0], UO.PAL + 4 * slot);
  let look = null, lookOver = {};
  /** The depth of field: focused on what the camera looks at; the farther out it stands, the more the courtyard looks
   * a miniature (shallow focus), and close in only the horizon and the nearest grass go soft. */
  const focus = () => ({ focus: cam.dist, dof: 0.25 + 0.75 * Math.min(1, Math.max(0, (cam.dist - 8) / 18)) });
  /** The sun (or moon), the sky, the sea, the pools' glow and the look (exposure, grading, bloom) for the hour. */
  function timeOfDay(hour) {
    const L = daylight(hour);
    look = L.look;
    Object.assign(SUN, sunSetup(L.dir, ...shadowAround(cam))); SUN.tint = L.tint;
    U.set([...POOL_SIGMA, L.exposure], UO.SIGMA); U.set([...poolGlow(L), 0], UO.TINT);
    U.set([...L.sky, L.night], UO.PAL + 4 * PAL.SKY); U.set([...L.haze, L.lst], UO.PAL + 4 * PAL.HAZE);
    U.set([...L.sea, 0], UO.PAL + 4 * PAL.SEA); U.set([...L.shallow, 0], UO.PAL + 4 * PAL.SHALLOW);
    return L;
  }
  /** The pools' glow: by night its lamps drift slowly through aqua, violet, rose and sea green, a round in a minute. */
  function poolGlow(L) {
    const t = (world.time / 15) % POOL_HUES.length, a = POOL_HUES[Math.floor(t)], b = POOL_HUES[(Math.floor(t) + 1) % POOL_HUES.length], e = t % 1, m = Math.hypot(...L.glow), k = 0.6 * L.night;
    return L.glow.map((v, i) => v + ((a[i] + (b[i] - a[i]) * e * e * (3 - 2 * e)) * m - v) * k);
  }

  let fps = 60;
  function draw(dt) {
    if (!paused) world.advance(dt);
    navigation.frame(dt);
    if (follow) {   // ride along with the chosen duck
      const d = world.selected && world.ducks.includes(world.selected) ? world.selected : null;
      if (!d) setFollow(false);
      else { const k = Math.min(1, dt * 2.5), p = d.body.p; cam.target = cam.target.map((v, i) => v + (p[i] - v) * k); cam.dist += (Math.min(cam.dist, 5.5) - cam.dist) * k; }
    }
    const L = timeOfDay(world.day.hour);
    const CAMV = view.frame(dt, U, world.time);
    const ce = Math.cos(cam.el), eye = world.block.toLocal([cam.target[0] + cam.dist * ce * Math.sin(cam.az), cam.target[1] + cam.dist * Math.sin(cam.el), cam.target[2] + cam.dist * ce * Math.cos(cam.az)]);   // as view.js places it
    seating.update(dt);
    // after the camera has moved this frame and before the menu shows: an arrival the player looked away from never paints it
    if (seating.phase === 'seated' && Math.hypot(...eye.map((v, k) => v - P.SEATS[seating.seat].eye[k])) > 0.05) seating.stand('moved');
    const nDucks = poseScene(inst, parts, world);
    for (const e of world.events) {
      if (e.type === 'voice') fx.burst([e.x, e.y, e.z], e.colour);
      else if (e.type === 'splash' && (e.speed ?? 1) >= 0.5) fx.splash([e.x, world.water.surface(e.x, e.z), e.z], e.speed ?? 1);
    }
    critters.step(dt, world.day.hour);
    for (const e of critters.events) if (e.type === 'fishSplash') fx.splash([e.x, P.SEA, e.z], 0.8);
    fx.show(dt, L.night);
    fx.step(dt);
    const nOwn = fx.pack(inst, fxAt), nFx = nOwn + critters.pack(inst, fxAt + nOwn * FX_FLOATS);
    poseProps(inst, propAt, world);
    placeTags(); seatMenu.frame();
    world.water.pack(waterBuf);
    const nBubbles = world.bubbles.pack(bubBuf);
    ocean.update(world.time);
    renderer.render({ U, cam: CAMV, sun: SUN.SUNV, water: waterBuf, foam: world.foam.pack(), inst, instFloats: inst.length, bubbles: bubBuf, nBubbles, nDucks, nFx, post: { ...look, ...focus(), ...lookOver } });
    const happened = world.events.concat(fx.events, critters.events);
    book.observe(world, happened);
    Sound.frame(happened, { station: world.station, hour: world.day.hour, eye, at: world.block.toLocal(cam.target) });
    world.events.length = 0; fx.events.length = 0; critters.events.length = 0;
  }
  view.start();
  ctx.frames((dt) => { if (dt > 0) fps += (1 / dt - fps) * 0.05; draw(dt); });

  ctx.hook({
    world, renderer, cam, ocean, book,
    mural: (name) => setMural(world, name),
    state: () => ({ paused, follow, ...world.tally(), selected: world.selected ? world.selected.id : null, current: world.currentK, sound: Sound.on, sand: +world.glass.s.toFixed(3), hour: +world.day.hour.toFixed(2), clock: world.day.run, night: +daylight(world.day.hour).night.toFixed(2), radio: world.radio, station: world.station ? STATIONS[world.station - 1].name : null, energy: world.water.energy, fps: Math.round(fps), size: renderer.size, quality: renderer.post.quality,
      camera: { az: cam.az, el: cam.el, dist: cam.dist, fit: view.fitDist, target: cam.target.slice() } }),
    /** Where the clickable props are drawn (block-local points for toPx), from the layout. */
    spots: () => ({ radio: [P.RADIO[0], P.TER + 0.04 * P.SIZE.radio, P.RADIO[1]], hourglass: [P.HOURGLASS[0], P.TER + 0.3 * P.SIZE.glass, P.HOURGLASS[1]], seats: P.SEATS.map((q) => ({ chair: [q.at[0], q.y + 0.06 * P.SIZE.chair, q.at[1]], eye: q.eye, side: [q.side[0], q.y, q.side[1]] })) }),
    step(n = 1) { world.step(n); },
    render(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) draw(dt); },
    reset: () => { world.reset(); setFollow(false); },
    pause: (p) => { paused = !!p; },
    add: (n = 1) => world.addDucks(n), addFlyer: () => !!world.addFlyer(), remove: () => world.removeDuck(), colour: (i) => world.setColour(i), hat: (i) => world.setHat(i), mix: () => world.mixUp(), current: (k) => world.setCurrent(k), follow: (v) => setFollow(!!v),
    /** The finishing pass's quality: 'high' (occlusion, grain, the long bloom) or 'low'. */
    quality: (q) => renderer.post.setQuality(q),
    /** Override the hour's look (post.js LOOK fields), e.g. { bloom: 0, ao: 0 } to compare; {} gives it back. */
    look: (o = {}) => { lookOver = o; },
    hour: (h) => world.setHour(h), clock: (run) => world.setDayRun(!!run), names: (v) => { showTags = !!v; }, sound: (v) => setSound(!!v), createSound, sfx: SFX, resetView: reset,
    /** The seat (seating.js: its state, sit(i), stand(reason)); sit(i) as a click on chair i. */
    seating, sit: seating.sit,
    select: (i) => { world.selected = world.ducks[i] || null; },
    /** Tap duck i (as a quick press on it does); fx(): how many sprites are flying. */
    tap: (i) => world.hand.tap(world.ducks[i].body), fx: () => fx.count, cue: (kind) => fx.cue(kind),
    tags: () => [...tagLayer.children].map((el) => el.textContent),
    toPx: view.toPx,
    pick: (x, y) => { const r = view.rayAt(x, y), h = world.pick(r.o, r.d); return h && h.kind; },
  });
}
