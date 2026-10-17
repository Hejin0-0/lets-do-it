// The page side every jelly-block diorama shares: the orbit camera framed in the free space of the page,
// the sun, the core uniforms, and pointer input. A drag starts on whatever the specimen's pick() says is
// under the finger: the sea (stir it), the block (tip it), a thing with a handler (grab and throw for
// 'body' by default), or nothing (orbit). Right-drag orbits, two fingers pinch, the wheel zooms.
import { M4, srgbToLinear } from './math.js';
import { UO } from './renderer.js';

// the backdrop radiance that the composite's tone shoulder turns back into exactly the page paper
const invShoulder = (y) => (y <= 0.8 ? y : 0.8 - 0.2 * Math.log(1 - Math.min(0.999, (y - 0.8) / 0.2)));
export const paperRadiance = (hex) => srgbToLinear(hex).map(invShoulder);

/** The sun: its direction, and the orthographic view of its shadow map round the block. */
export function sunSetup(dir = [-0.5, 0.82, 0.16], centre = [0, 0.9, 0], extent = 4.1) {
  const l = Math.hypot(...dir), SUN = dir.map((x) => x / l);
  const e = [centre[0] + SUN[0] * 14, centre[1] + SUN[1] * 14, centre[2] + SUN[2] * 14];
  const VP = M4.mul(M4.ortho(-extent, extent, -extent, extent, 2, 28), M4.lookAt(e, centre, [0, 1, 0]).m);
  const SUNV = new Float32Array(48);
  SUNV.set(VP, 0); SUNV.set([e[0], e[1], e[2], 0], 32);
  return { SUN, VP, SUNV };
}
function refracted(sl) {   // the sun refracted by a flat sea, in the block frame
  const eta = 0.752, I = [-sl[0], -sl[1], -sl[2]], ci = sl[1], k = 1 - eta * eta * (1 - ci * ci), s = eta * ci - Math.sqrt(Math.max(0, k));
  return [eta * I[0], eta * I[1] + s, eta * I[2]];
}
function camera(c, W, H) {
  const ce = Math.cos(c.el), eye = [c.target[0] + c.dist * ce * Math.sin(c.az), c.target[1] + c.dist * Math.sin(c.el), c.target[2] + c.dist * ce * Math.cos(c.az)];
  const L = M4.lookAt(eye, c.target, [0, 1, 0]), P = M4.persp(c.fov, W / H, 0.1, 140);
  P[8] -= c.shift[0]; P[9] -= c.shift[1];   // lens shift: the block sits in the free space of the layout
  const vp = M4.mul(P, L.m);
  return { vp, inv: M4.inv(vp), eye, right: L.x, up: L.y, fwd: L.z.map((v) => -v) };
}
/** Points along the block's edges (base and top) that framing keeps in view. */
export function blockEdgePoints(half, top) {
  const P = [], C = [[-half, -half], [half, -half], [half, half], [-half, half]];
  for (let k = 0; k < 4; k++) for (let s = 0; s < 6; s++) {
    const a = C[k], b = C[(k + 1) % 4], t = s / 6, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    P.push([x, 0, z], [x, top, z]);
  }
  return P;
}
/**
 * A block-local ray against the block: { kind: 'water', point } on the open water, { kind: 'block', point } on the
 * ground or a cut side (where a drag tips the block), or null. top: the height the block's sides are picked up to.
 */
export function pickBlock(o, d, { half, top, terrainH, water }) {
  let t0 = 0, t1 = Infinity;
  for (const [k, lo, hi] of [[0, -half, half], [1, 0, top], [2, -half, half]]) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo || o[k] > hi) return null; continue; }
    let a = (lo - o[k]) / d[k], b = (hi - o[k]) / d[k];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  if (t0 > t1) return null;
  for (let t = t0, first = true; t <= t1 + 1e-6; t += 0.008, first = false) {
    const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
    const ys = water.surface(x, z), yt = terrainH(x, z);
    if (y <= yt) return { kind: 'block', t, point: [x, y, z] };
    if (y <= ys) return first && Math.abs(y - top) > 1e-3 ? { kind: 'block', t, point: [x, y, z] } : water.isWet(x, z) ? { kind: 'water', t, point: [x, ys, z] } : { kind: 'block', t, point: [x, y, z] };
  }
  return null;
}
const CURSOR = { 'is-pick': 'pointer', 'is-water': 'crosshair', 'is-tilt': 'move', 'is-grabbing': 'grabbing' };

/**
 * o: { canvas, signal, renderer, block, water, sun (sunSetup()), cam0: { az, el, target }, fitPoints, tiltMax,
 *      obstacles() -> [element], pick(o, d) -> { kind: 'water' | 'block' | other, point?, ... } | null (block-local ray),
 *      bodies?: { grab(b), hold(b, p), throw(b, v) } (the 'body' kind: grab, carry, throw),
 *      handlers?: { [kind]: { start(hit, ray, view) -> state, move(state, ray), end(state) } } }
 */
export function createDioramaView(o) {
  const { canvas, signal, renderer, block, water, cam0 } = o;
  const on = (el, ev, fn, opt) => el.addEventListener(ev, fn, { signal, ...opt });
  const cam = { az: cam0.az, el: cam0.el, dist: 11.2, target: cam0.target.slice(), shift: [0, 0], fov: (34 * Math.PI) / 180 };
  let cssW = 1, cssH = 1, fitDist = cam.dist, userZoomed = false, ease = null, view = camera(cam, 1, 1);
  const pose = () => ({ az: cam.az, el: cam.el, dist: cam.dist, target: cam.target.slice() });
  const Mb = new Float32Array(16), Mi = new Float32Array(16), CAMV = new Float32Array(48);

  // ----- framing: the fit points in the free space, clear of the page's blocks -----
  function obstacleRects() {
    const out = [];
    for (const el of o.obstacles()) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none') out.push([r.left - 10, Math.max(0, r.top) - 10, r.right + 10, Math.min(innerHeight, r.bottom) + 10]);
    }
    return out;
  }
  function fit() {
    const W = cssW, H = cssH, m = 12, obs = obstacleRects();
    const ok = (d, sx, sy) => {
      const v = camera({ ...cam, az: cam0.az, el: cam0.el, target: cam0.target, dist: d, shift: [sx, sy] }, W, H).vp;
      for (const p of o.fitPoints) {
        const w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
        const x = ((v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12]) / w * 0.5 + 0.5) * W, y = (0.5 - (v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13]) / w * 0.5) * H;
        if (x < m || x > W - m || y < m || y > H - m) return false;
        for (const q of obs) if (x > q[0] && x < q[2] && y > q[1] && y < q[3]) return false;
      }
      return true;
    };
    let best = { d: 28, sx: 0, sy: 0 };
    for (let cx = 0.28; cx <= 0.72; cx += 0.02) for (let cy = 0.36; cy <= 0.7; cy += 0.03) {
      const sx = cx * 2 - 1, sy = 1 - cy * 2;
      if (!ok(28, sx, sy)) continue;
      let lo = 3.5, hi = 28;
      for (let it = 0; it < 16; it++) { const mid = (lo + hi) / 2; if (ok(mid, sx, sy)) hi = mid; else lo = mid; }
      if (hi < best.d - 1e-3) best = { d: hi, sx, sy };
    }
    fitDist = Math.min(28, best.d * 1.02);
    cam.shift = [best.sx, best.sy];
    if (!userZoomed && !ease) cam.dist = fitDist;
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (cssW * cssH)));
    renderer.resize(Math.round(cssW * dpr), Math.round(cssH * dpr));
    fit();
  }

  // ----- picking and input -----
  function rayAt(cx, cy) {
    const r = canvas.getBoundingClientRect(), nx = ((cx - r.left) / cssW) * 2 - 1, ny = 1 - ((cy - r.top) / cssH) * 2, f = view.inv;
    const un = (z) => { const q = [0, 1, 2, 3].map((k) => f[k] * nx + f[4 + k] * ny + f[8 + k] * z + f[12 + k]); return [q[0] / q[3], q[1] / q[3], q[2] / q[3]]; };
    const a = un(0), b = un(1), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d);
    return { o: block.toLocal(view.eye), d: block.dirToLocal(d.map((v) => v / l)) };
  }
  const planeHit = (r, p, n) => {
    const den = r.d[0] * n[0] + r.d[1] * n[1] + r.d[2] * n[2];
    if (Math.abs(den) < 1e-6) return null;
    const t = ((p[0] - r.o[0]) * n[0] + (p[1] - r.o[1]) * n[1] + (p[2] - r.o[2]) * n[2]) / den;
    return t > 0 ? [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t] : null;
  };
  // things: carried on the plane facing the camera, thrown at the pointer's speed
  const grabThrow = (W) => ({
    start(hit, r) {
      const b = hit.body, now = performance.now();
      W.grab(b);
      const n = block.dirToLocal(view.fwd), at = planeHit(r, b.p, n) || b.p.slice();
      return { b, n, off: [b.p[0] - at[0], b.p[1] - at[1], b.p[2] - at[2]], hist: [{ t: now, p: b.p.slice() }] };
    },
    move(s, r) {
      const now = performance.now(), at = planeHit(r, s.b.p, s.n);
      if (!at) return;
      W.hold(s.b, [at[0] + s.off[0], at[1] + s.off[1], at[2] + s.off[2]]);
      s.hist.push({ t: now, p: s.b.p.slice() });
      while (s.hist.length > 2 && now - s.hist[0].t > 160) s.hist.shift();
    },
    end(s) {
      const now = performance.now(), h = s.hist.filter((q) => now - q.t < 110), a = h[0], b = h[h.length - 1];
      let v = [0, 0, 0];
      if (h.length >= 2 && b.t - a.t > 12) v = [0, 1, 2].map((k) => ((b.p[k] - a.p[k]) / (b.t - a.t)) * 1000);
      W.throw(s.b, v);
    },
  });
  const handlers = { ...(o.bodies ? { body: grabThrow(o.bodies) } : null), ...o.handlers };
  const ptrs = new Map();
  let drag = null, hover = null;
  const setCursor = (c) => { canvas.style.cursor = CURSOR[c] || 'grab'; };
  const cursorFor = (hit) => (!hit ? '' : hit.kind === 'water' ? 'is-water' : hit.kind === 'block' ? 'is-tilt' : 'is-pick');
  function startDrag(e) {
    const r = rayAt(e.clientX, e.clientY), hit = o.pick(r.o, r.d), now = performance.now();
    const h = hit && handlers[hit.kind];
    if (h) drag = { mode: 'own', h, id: e.pointerId, s: h.start(hit, r, view) };
    else if (hit && hit.kind === 'water') {
      drag = { mode: 'stir', id: e.pointerId, last: hit.point, t: now, lv: water.levelAt(hit.point[0], hit.point[2]) };
      water.stir(hit.point[0], hit.point[2], 0);
    } else if (hit && hit.kind === 'block') {
      block.grab();
      drag = { mode: 'tilt', id: e.pointerId, x: e.clientX, y: e.clientY, t0: block.t.slice() };
    } else drag = { mode: 'orbit', id: e.pointerId, x: e.clientX, y: e.clientY };
    setCursor(drag.mode === 'stir' ? 'is-water' : drag.mode === 'tilt' ? 'is-tilt' : 'is-grabbing');
  }
  function moveDrag(e) {
    const now = performance.now();
    if (drag.mode === 'orbit') {
      cam.az -= (e.clientX - drag.x) * 0.0055;
      cam.el = Math.min(1.35, Math.max(0.06, cam.el + (e.clientY - drag.y) * 0.0045));
      drag.x = e.clientX; drag.y = e.clientY; ease = null;
    } else if (drag.mode === 'tilt') {
      const k = o.tiltMax / (0.26 * Math.min(cssW, cssH)), dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
      const ca = Math.cos(cam.az), sa = Math.sin(cam.az);
      // screen right tips the top toward camera-right; dragging down tips it toward the viewer
      const d = [ca * dx + sa * dy, -sa * dx + ca * dy];
      block.setTarget(drag.t0[0] + d[1], drag.t0[1] - d[0]);
    } else if (drag.mode === 'stir') {
      const r = rayAt(e.clientX, e.clientY), p = planeHit(r, [0, drag.lv, 0], [0, 1, 0]);
      if (!p || Math.abs(p[0]) > water.half || Math.abs(p[2]) > water.half) { drag.last = null; return; }
      if (drag.last) {
        const dx = p[0] - drag.last[0], dz = p[2] - drag.last[2], len = Math.hypot(dx, dz), speed = len / Math.max((now - drag.t) / 1000, 1 / 120);
        const n = Math.min(40, Math.ceil(len / 0.06));
        for (let k = 1; k <= n; k++) {
          const x = drag.last[0] + (dx * k) / n, z = drag.last[2] + (dz * k) / n;
          if (water.isWet(x, z)) water.stir(x, z, speed);
        }
      }
      drag.last = p; drag.t = now;
    } else if (drag.mode === 'own') drag.h.move(drag.s, rayAt(e.clientX, e.clientY));
  }
  function endDrag() {
    if (!drag) return;
    if (drag.mode === 'own') drag.h.end(drag.s);
    else if (drag.mode === 'tilt') block.release();
    drag = null;
    setCursor(cursorFor(hover?.hit));
  }
  on(canvas, 'pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer: carry on without capture */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      endDrag();
      const [a, b] = [...ptrs.values()];
      drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, dist0: cam.dist };
      return;
    }
    if (ptrs.size > 2 || drag) return;
    if (e.button === 2) { drag = { mode: 'orbit', id: e.pointerId, x: e.clientX, y: e.clientY }; setCursor('is-grabbing'); return; }
    startDrag(e);
  });
  on(canvas, 'pointermove', (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) { if (e.pointerType === 'mouse') hover = { x: e.clientX, y: e.clientY, pending: true }; return; }
    if (drag.mode === 'pinch') {
      if (ptrs.size < 2) return;
      const [a, b] = [...ptrs.values()];
      cam.dist = Math.min(28, Math.max(3.5, (drag.dist0 * drag.d0) / (Math.hypot(a.x - b.x, a.y - b.y) || 1)));
      userZoomed = true; ease = null;
      return;
    }
    if (e.pointerId === drag.id) moveDrag(e);
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (!drag) return;
    if (drag.mode === 'pinch') { if (ptrs.size < 2) drag = null; return; }
    if (e.pointerId === drag.id) endDrag();
  };
  on(canvas, 'pointerup', up);
  on(canvas, 'pointercancel', up);
  on(canvas, 'pointerleave', () => { if (!drag) { hover = null; setCursor(''); } });
  on(canvas, 'contextmenu', (e) => e.preventDefault());
  on(canvas, 'wheel', (e) => {
    e.preventDefault();
    cam.dist = Math.min(28, Math.max(3.5, cam.dist * Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0012))));
    userZoomed = true; ease = null;
  }, { passive: false });
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  signal.addEventListener('abort', () => ro.disconnect());
  on(window, 'resize', resize);

  return {
    cam,
    get fitDist() { return fitDist; },
    resize, rayAt, planeHit, setCursor,
    /** Size the canvas, frame the block and start at the framed distance. */
    start() { resize(); cam.dist = fitDist; setCursor(''); },
    /** Ease back to the framed starting view. */
    resetView() { userZoomed = false; ease = { t: 0, dur: 0.7, from: pose(), to: null }; },
    /** Ease to a view from eye looking at target (block-local points), as from a seat. Orbiting from there turns round the target. */
    lookFrom(eye, target, dur = 1.1) {
      const e = block.toWorld(eye), t = block.toWorld(target), d = [e[0] - t[0], e[1] - t[1], e[2] - t[2]], dist = Math.hypot(...d);
      userZoomed = true;
      ease = { t: 0, dur, from: pose(), to: { az: Math.atan2(d[0], d[2]), el: Math.asin(d[1] / dist), dist, target: t } };
    },
    /** Once per frame: ease the camera after a reset or to a seat, answer the hover, and write the core uniforms. Returns the camera block. */
    frame(dt, U, time) {
      if (ease) {
        ease.t = Math.min(1, ease.t + dt / ease.dur);
        const s = 1 - (1 - ease.t) ** 3, f = ease.from, to = ease.to || { ...cam0, dist: fitDist };
        const turn = ((to.az - f.az + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;   // the short way round
        cam.az = f.az + turn * s; cam.el = f.el + (to.el - f.el) * s; cam.dist = f.dist + (to.dist - f.dist) * s;
        cam.target = f.target.map((v, k) => v + (to.target[k] - v) * s);
        if (ease.t >= 1) ease = null;
      }
      view = camera(cam, cssW, cssH);
      if (hover && hover.pending && !drag) {
        hover.pending = false;
        const r = rayAt(hover.x, hover.y);
        hover.hit = o.pick(r.o, r.d);
        setCursor(cursorFor(hover.hit));
      }
      const [W, H] = renderer.size, sun = o.sun;
      block.matrices(Mb, Mi);
      U.set(Mb, UO.M); U.set(Mi, UO.MINV); U.set(sun.VP, UO.SUNVP);
      U.set([view.eye[0], view.eye[1], view.eye[2], time], UO.EYE);
      U.set([block.shear[0], block.shear[1], block.squash, water.level], UO.WOB);
      U.set([sun.SUN[0], sun.SUN[1], sun.SUN[2], 0], UO.SUN);
      const sl = block.dirToLocal(sun.SUN);
      U.set([sl[0], sl[1], sl[2], 0], UO.SUNL);
      U.set([W, H, 1 / W, 1 / H], UO.SCREEN);
      U.set([...refracted(sl), 0], UO.REFR);
      U.set([...(sun.tint || [1, 1, 1]), 0], UO.SUNC);
      CAMV.set(view.vp, 0); CAMV.set(view.inv, 16); CAMV.set([...view.eye, 1], 32); CAMV.set([...view.right, 0], 36); CAMV.set([...view.up, 0], 40);
      return CAMV;
    },
    /** A block-local point to CSS pixels on the canvas, or null when it is behind the camera. */
    toPx(p) {
      const w = block.toWorld(p), v = view.vp, h = v[3] * w[0] + v[7] * w[1] + v[11] * w[2] + v[15];
      if (h <= 1e-6) return null;
      return [((v[0] * w[0] + v[4] * w[1] + v[8] * w[2] + v[12]) / h * 0.5 + 0.5) * cssW, (0.5 - (v[1] * w[0] + v[5] * w[1] + v[9] * w[2] + v[13]) / h * 0.5) * cssH];
    },
  };
}
