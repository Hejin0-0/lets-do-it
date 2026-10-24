// The orbit camera every jelly uses, framed in the free space of the page: right of the heading,
// above the readouts, left of the panel (on a phone: below the heading, across the full width).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * cfg: { yaw, pitch, target, fov? (deg), pitchRange? [lo, hi], yawRange? (± around yaw),
 *        fit: [desktop, mobile] world width to fit, frame?: { x0, y0, aspect, cx, cy } (x0, y0: fractions of the
 *        masthead; cx, cy: where in the free space the specimen sits, 0.5 = the middle),
 *        zoomRange? [lo, hi], distRange? [lo, hi], maxDpr? }
 * R: the renderer (resize, look).
 */
export function createFraming(canvas, $, cfg, R) {
  const D = { yaw: cfg.yaw, pitch: cfg.pitch, target: cfg.target || [0, 0, 0] };
  const PITCH = cfg.pitchRange || [0.1, 1.42], ZOOM = cfg.zoomRange || [0.62, 1.6];
  const fr = { x0: 0.3, y0: 0.62, aspect: 1.4, cx: 0.5, cy: 0.5, ...cfg.frame };
  const state = { yaw: D.yaw, pitch: D.pitch, dist: 7, baseDist: 7, zoom: 1, fov: (cfg.fov ?? 26) * Math.PI / 180, target: D.target.slice(), shift: [0, 0] };

  return {
    state,
    get zoom() { return state.zoom; },
    /** Size the drawing buffer (at most ~2.4 Mpx) and fit the specimen into the free space. */
    frame() {
      const r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
      if (!(w > 0 && h > 0)) return;
      const dpr = window.devicePixelRatio || 1, scale = Math.min(dpr, cfg.maxDpr ?? 2, Math.sqrt(2.4e6 / (w * h)));
      R.resize(Math.round(w * scale), Math.round(h * scale));
      const mobile = matchMedia('(max-width: 860px)').matches, mh = $('.masthead').getBoundingClientRect();
      let x0 = 0, x1 = w, y0 = mh.bottom - r.top - 20, y1 = h - 10;
      if (!mobile) {
        x1 = $('.panel').getBoundingClientRect().left - r.left - 16;
        x0 = mh.left - r.left + mh.width * fr.x0;   // clear of the long heading
        y0 = mh.top - r.top + mh.height * fr.y0;
        y1 = $('.foot').getBoundingClientRect().top - r.top - 10;
      }
      const cx = x0 + (x1 - x0) * (mobile ? 0.5 : fr.cx), cy = y0 + (y1 - y0) * (mobile ? 0.5 : fr.cy), size = Math.max(160, Math.min(x1 - x0, (y1 - y0) * fr.aspect));
      state.shift = [cx / w * 2 - 1, 1 - cy / h * 2];
      const [dLo, dHi] = cfg.distRange || [3.5, 18];
      state.baseDist = clamp((mobile ? cfg.fit[1] : cfg.fit[0]) * h / (size * 2 * Math.tan(state.fov / 2)), dLo, dHi);
      state.dist = state.baseDist * state.zoom;
    },
    orbit(dx, dy) {
      state.yaw -= dx * 0.006;
      if (cfg.yawRange) state.yaw = clamp(state.yaw, D.yaw - cfg.yawRange, D.yaw + cfg.yawRange);
      state.pitch = clamp(state.pitch + dy * 0.004, PITCH[0], PITCH[1]);
    },
    setZoom(z) { state.zoom = clamp(z, ZOOM[0], ZOOM[1]); state.dist = state.baseDist * state.zoom; },
    /** Ease the target after the specimen when it ends up far from where it was. */
    follow(c, far = 0.8, rate = 0.03) {
      const dx = c[0] - state.target[0], dz = c[2] - state.target[2];
      if (Math.hypot(dx, dz) > far) { state.target[0] += dx * rate; state.target[2] += dz * rate; }
    },
    resetView: () => { state.yaw = D.yaw; state.pitch = D.pitch; state.zoom = 1; state.dist = state.baseDist; state.target = D.target.slice(); },
  };
}
