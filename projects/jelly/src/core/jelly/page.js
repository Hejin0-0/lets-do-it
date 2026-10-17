// The page logic every grabbable jelly shares: camera framing in the free space of the layout,
// the panel's standard controls, keys, pointer input (grab and twist, orbit, pinch, wheel), the
// fixed-step loop, readouts and the test hook. A specimen passes its simulation and its look; the
// controls present in its panel markup are wired, the rest are skipped.
//
// The sim contract (CPU): n, DT, step(), advance(dt, speed) -> steps, reset(drop), pick(ro, rd),
// grabStart(p), grabMove(p), grabTwist(a), grabEnd(), grabbing, setFirmness(v), setDamping(v),
// nudge(s), centroid(), renderNodes(out) -> Float32Array(4n), stats() -> { massG, relVol, keUJ, pieces? },
// optionally flipHop() / flipSpin(axis, rate) / longAxis() for "Turn it over", and takeMeshes() ->
// new renderer meshes or null, for a body whose pieces change (cut/pieces.js).
import { createJellyRenderer } from './renderer.js';
import { createFraming } from '../camera.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** What the renderer needs from a lattice body (surface embedded in tets, then its bubbles, then, if it
 *  has them, the anchors of what rides inside: sim.seedCount pieces from sim.pointBase, sim.seedInst). */
export function latticeMeshes(sim) {
  const rest = new Float32Array(sim.nv * 8), P = sim.surf.pos, Nn = sim.surf.nrm;
  for (let v = 0; v < sim.nv; v++) rest.set([P[3 * v], P[3 * v + 1], P[3 * v + 2], 0, Nn[3 * v], Nn[3 * v + 1], Nn[3 * v + 2], 0], 8 * v);
  const ns = sim.seedCount || 0, inst = new Float32Array((ns + sim.NB) * 4);   // instances: the pieces, then the bubbles
  if (ns) inst.set(sim.seedInst);
  sim.bubbles.forEach((b, i) => { inst[4 * (ns + i)] = b.r; });
  return { n: sim.n, np: sim.np, nv: sim.nv, emb: { idx: sim.embI, w: sim.embW }, index: sim.surf.index,
    adjacency: { offsets: sim.adjOff, triangles: sim.adjTri }, rest, inst, bubbleBase: sim.nv, bubbleCount: sim.NB,
    seedBase: ns ? sim.pointBase : 0, seedCount: ns, edges: sim.E };
}

/**
 * cfg: { sim, meshes? (else sim.takeMeshes()), renderer: spec for createJellyRenderer, presets: { name: look },
 *        preset, camera: { yaw, pitch, target, pitchRange?, fit: [desktop, mobile] world widths },
 *        look?(state, centre) -> extra setLook fields, massDigits?, keDigits?, readout?(stats) -> { mass?, ke? } (own units),
 *        coarseHint?, note?(sim),
 *        tools?({ R, cam, state, rayAt, toPx }) -> Tools }
 * Tools, a specimen's own gestures (knife strokes, cutter clicks), get the first touch; the page keeps
 * grab, orbit, pinch and wheel: { down(e, ray) -> mode | null (null: grab or orbit), move(e, ray, mode)
 * -> mode, up(e, ray, mode), hover(e | null, mode), key(k), frame(dt), cursor() -> idle cursor,
 * reset() -> false to refuse, hook: extra test-hook fields }.
 */
export async function runJellyPage(ctx, cfg) {
  const { canvas, signal, stage } = ctx, $ = stage.$, on = (el, ev, fn, o) => el && el.addEventListener(ev, fn, { signal, ...o });
  const reduced = stage.reduced, sim = cfg.sim;
  const state = { preset: cfg.preset, paused: false, slow: false, mesh: false };
  const nodes = new Float32Array(sim.n * 4);

  const R = await createJellyRenderer(ctx.gpu, canvas, cfg.renderer);
  sim.reset(!reduced.matches);
  R.setMeshes(cfg.meshes || sim.takeMeshes());
  const cam = createFraming(canvas, $, cfg.camera, R);
  cam.frame();
  const ro = new ResizeObserver(() => cam.frame());
  ro.observe(canvas);
  signal.addEventListener('abort', () => ro.disconnect());
  on(window, 'resize', () => cam.frame());
  if (cfg.note && $('#note-body')) $('#note-body').textContent = cfg.note(sim);
  if (cfg.coarseHint && matchMedia('(pointer: coarse)').matches && $('#hint')) $('#hint').textContent = cfg.coarseHint;

  // ----- controls (only those the specimen's panel has) -----
  const firm = $('#firm'), damp = $('#damp');
  if (damp) damp.value = reduced.matches ? 45 : (sim.params?.damp ?? damp.value);   // calmer when the visitor prefers less motion
  const syncSliders = () => {
    if (firm) { $('#firm-out').value = firm.value; sim.setFirmness(+firm.value); }
    if (damp) { $('#damp-out').value = damp.value; sim.setDamping(+damp.value); }
  };
  syncSliders();
  on(firm, 'input', syncSliders); on(damp, 'input', syncSliders);
  document.querySelectorAll('input[name="variety"]').forEach((el) => on(el, 'change', () => { state.preset = el.value; }));
  const pauseBtn = $('#pause');
  function setPaused(p) {
    state.paused = p;
    if (pauseBtn) { pauseBtn.textContent = p ? 'Resume' : 'Pause'; pauseBtn.setAttribute('aria-pressed', String(p)); }
    stage.status(p ? 'paused' : 'live', p ? 'WebGPU · Paused' : 'WebGPU · Live');
  }
  const togglePause = () => setPaused(!state.paused);
  const resume = () => { if (state.paused) setPaused(false); };
  const nudge = () => { resume(); sim.nudge(reduced.matches ? 0.5 : 1); };
  const reset = () => { if (tools?.reset?.() === false) return; flip = null; sim.reset(!reduced.matches); };
  // Turn it over: a hop, then, once it is clear of the floor, a half turn.
  let flip = null;   // { t } sim seconds since the hop
  function turnOver() {
    if (!sim.flipHop) return;
    resume();
    if (flip || sim.grabbing || !sim.flipHop()) return;
    flip = { t: 0 };
  }
  function tickFlip(simSeconds) {
    if (!flip) return;
    const before = flip.t;
    flip.t += simSeconds;
    if (before < 0.12 && flip.t >= 0.12) {   // clear of the floor: the half turn
      let axis = sim.longAxis ? sim.longAxis() : null;
      if (!axis) { const r = R.look.right, l = Math.hypot(r[0], r[2]) || 1; axis = [r[0] / l, 0, r[2] / l]; }
      sim.flipSpin(axis, Math.PI / 0.86);
    }
    if (flip.t > 1.4) flip = null;
  }
  on($('#nudge'), 'click', nudge);
  on($('#reset'), 'click', reset);
  on($('#flip'), 'click', turnOver);
  on($('#view'), 'click', cam.resetView);
  on(pauseBtn, 'click', togglePause);
  on($('#slow'), 'change', (e) => { state.slow = e.target.checked; });
  on($('#mesh'), 'change', (e) => { state.mesh = e.target.checked; });
  on(window, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), t = e.target, inRange = t instanceof HTMLInputElement && t.type === 'range';
    if (k === ' ' && !(t instanceof HTMLButtonElement) && !(t instanceof HTMLInputElement && t.type === 'checkbox')) { e.preventDefault(); togglePause(); }
    else if (inRange) return;
    else if (k === 'n') nudge();
    else if (k === 'r') reset();
    else if (k === 'f') turnOver();
    else if (k === 'v') cam.resetView();
    else tools?.key?.(k);
  });

  // ----- pointer input: the gesture is decided at the first touch: grab the jelly, or orbit
  // (empty floor, right button, or Shift held). Two fingers twist what you hold, or pinch to zoom. -----
  const pointers = new Map();
  let mode = null, plane = null, last = null, twist = 0, twist0 = 0, pinch0 = 0, zoom0 = 1, hoverAt = null;
  const rayAt = (px, py) => { const r = canvas.getBoundingClientRect(); return R.ray((px - r.left) / r.width * 2 - 1, 1 - (py - r.top) / r.height * 2); };
  const pairAngle = () => { const [a, b] = [...pointers.values()]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const pairDist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; };
  const toPx = (x, y) => { const r = canvas.getBoundingClientRect(); return [r.left + x, r.top + y]; };
  const tools = cfg.tools ? cfg.tools({ R, cam, state, rayAt, toPx }) : null;
  const ownMode = (m) => tools && m && m !== 'grab' && m !== 'orbit' && m !== 'pinch' && m !== 'wait';
  on(canvas, 'contextmenu', (e) => e.preventDefault());
  on(canvas, 'pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer already left: no capture, the gesture still works */ }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    e.preventDefault();
    if (pointers.size === 2 && mode === 'grab') { twist0 = pairAngle() - twist; return; }
    if (pointers.size === 2) { mode = 'pinch'; pinch0 = pairDist(); zoom0 = cam.zoom; return; }
    if (pointers.size > 2) return;
    last = [e.clientX, e.clientY];
    const { ro, rd } = rayAt(e.clientX, e.clientY);
    const orbitOnly = e.button === 2 || e.shiftKey;
    const own = tools && !orbitOnly && !state.paused ? tools.down(e, { ro, rd }) : null;
    if (own) { mode = own; if (own === 'orbit') canvas.style.cursor = 'move'; return; }
    const hit = state.paused || flip || orbitOnly ? null : sim.pick(ro, rd);
    if (hit) {
      mode = 'grab'; twist = 0;
      sim.grabStart(hit, R.look.fwd);
      plane = { p: hit, n: R.look.fwd.slice() };
      canvas.style.cursor = 'grabbing';
    } else { mode = 'orbit'; canvas.style.cursor = 'move'; }
  });
  on(canvas, 'pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    tools?.hover(e, mode);
    if (mode === 'grab') {
      if (pointers.size >= 2) { twist = pairAngle() - twist0; sim.grabTwist(twist); return; }
      const { ro, rd } = rayAt(e.clientX, e.clientY), n = plane.n, p = plane.p;
      const den = rd[0] * n[0] + rd[1] * n[1] + rd[2] * n[2];
      if (Math.abs(den) < 1e-5) return;
      const t = ((p[0] - ro[0]) * n[0] + (p[1] - ro[1]) * n[1] + (p[2] - ro[2]) * n[2]) / den;
      sim.grabMove([ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t]);
    } else if (mode === 'orbit' && pointers.size === 1) {
      cam.orbit(e.clientX - last[0], e.clientY - last[1]);
      last = [e.clientX, e.clientY];
    } else if (mode === 'pinch' && pointers.size === 2) {
      cam.setZoom(zoom0 * pinch0 / pairDist());
    } else if (ownMode(mode)) {
      mode = tools.move(e, rayAt(e.clientX, e.clientY), mode) || mode;
      if (mode === 'orbit') last = [e.clientX, e.clientY];
    } else if (!mode && e.pointerType === 'mouse') hoverAt = [e.clientX, e.clientY];
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size && mode !== 'pinch') return;
    if (mode === 'pinch') { mode = pointers.size ? 'wait' : null; return; }   // the finger left behind does nothing
    if (mode === 'grab') sim.grabEnd();
    else if (ownMode(mode)) tools.up(e, rayAt(e.clientX, e.clientY), mode);
    mode = null; canvas.style.cursor = tools?.cursor() || '';
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) on(canvas, ev, release);
  on(canvas, 'pointerleave', () => { if (!mode) tools?.hover(null, null); });
  on(canvas, 'wheel', (e) => {
    e.preventDefault();
    if (mode === 'grab') { twist = clamp(twist + e.deltaY * 0.0025, -1.3, 1.3); sim.grabTwist(twist); return; }
    cam.setZoom(cam.zoom * Math.exp(e.deltaY * 0.0012));
  }, { passive: false });
  on(canvas, 'dblclick', cam.resetView);

  // ----- readouts -----
  const roMass = $('#ro-mass'), roVol = $('#ro-vol'), roKe = $('#ro-ke'), roPieces = $('#ro-pieces');
  const md = cfg.massDigits ?? 1, kd = cfg.keDigits ?? 1, keMin = 0.5 * 10 ** -kd;
  function readouts() {
    if (!roMass) return;
    const s = sim.stats(), own = cfg.readout?.(s);
    roMass.textContent = own?.mass ?? `≈ ${s.massG.toFixed(md)} g`;
    roVol.textContent = `${(s.relVol * 100).toFixed(1)} %`;
    roKe.textContent = own?.ke ?? `${(s.keUJ < keMin ? 0 : s.keUJ).toFixed(kd)} µJ`;
    if (roPieces) roPieces.textContent = String(s.pieces.length);
  }

  // ----- the loop -----
  let frameNo = 0;
  function draw(time, dt = 0) {
    const m = sim.takeMeshes?.();
    if (m) R.setMeshes(m);
    tools?.frame(dt);
    const c = sim.centroid();
    if (!mode) cam.follow(c);   // the camera eases after the jelly if it ends up far from where it was
    R.setCamera(cam.state);
    R.setLook({ time, showMesh: state.mesh, centre: c, ...cfg.presets[state.preset], ...(cfg.look ? cfg.look(state, c) : null) });
    R.render(sim.renderNodes(nodes), state.mesh);
  }
  ctx.frames((dt, t) => {
    if (!state.paused) tickFlip(sim.advance(dt, state.slow ? 0.25 : 1) * sim.DT);
    if (hoverAt && !mode) {
      const idle = tools?.cursor(), { ro, rd } = rayAt(hoverAt[0], hoverAt[1]);
      canvas.style.cursor = idle || (sim.pick(ro, rd) ? 'grab' : '');
      hoverAt = null;
    }
    draw(t, dt);
    if (frameNo++ % 6 === 0) readouts();
  });

  // ----- test hook: drive the jelly deterministically and screenshot it -----
  ctx.hook({
    ...tools?.hook,
    sim, camera: cam.state, state,
    pick(x, y) { const [px, py] = toPx(x, y), { ro, rd } = rayAt(px, py); return sim.pick(ro, rd); },
    grab(x, y) { const p = this.pick(x, y); if (p) sim.grabStart(p); return p; },
    move(p) { sim.grabMove(p); }, release() { sim.grabEnd(); },
    advance(seconds) { for (let i = 0, n = Math.round(seconds / sim.DT); i < n; i++) { sim.step(); tickFlip(sim.DT); } draw(performance.now() / 1000); readouts(); return sim.stats(); },
    turnOver, nudge, reset, resetView: cam.resetView, stats: () => sim.stats(),
  });
  return { R, state };
}
