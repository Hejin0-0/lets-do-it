// A vessel on a diorama's water: it follows a route (a smooth curve through waypoints) the way a ship
// steers, a pivot point near the bow on the route and the stern trailing behind it, so the stern tracks
// inside a bend; or it turns about on the spot. It heaves, pitches and rolls on the local surface, pushes
// its displacement along with it (a bow wave ahead, a trough astern) and leaves foam in its wash.
// Heading yaw: 0 is +x, PI/2 is +z. Local frame for drawing: bow +x, waterline y = 0, beam along z.
import { A } from './parts.js';

/** A smooth route through waypoints (centripetal Catmull–Rom), resampled by arc length. */
export function makeRoute(pts) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
  for (let i = 1; i + 2 < P.length; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const t = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t1 = t(p0, p1), t2 = t1 + t(p1, p2), t3 = t2 + t(p2, p3);
    for (let k = 0; k < 24; k++) {
      const u = t1 + ((t2 - t1) * k) / 24, lerp = (a, b, ta, tb) => [0, 1].map((c) => (a[c] * (tb - u) + b[c] * (u - ta)) / (tb - ta));
      const a1 = lerp(p0, p1, 0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, 0, t2), b2 = lerp(a2, a3, t1, t3);
      out.push(lerp(b1, b2, t1, t2));
    }
  }
  out.push(pts[pts.length - 1]);
  const s = [0];
  for (let i = 1; i < out.length; i++) s.push(s[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  const len = s[s.length - 1];
  return {
    len, pts: out,
    at(q, o = [0, 0]) {
      q = Math.max(0, Math.min(len, q));
      let lo = 0, hi = s.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= q) lo = m; else hi = m; }
      const f = (q - s[lo]) / Math.max(1e-9, s[hi] - s[lo]);
      o[0] = out[lo][0] + (out[hi][0] - out[lo][0]) * f; o[1] = out[lo][1] + (out[hi][1] - out[lo][1]) * f;
      return o;
    },
  };
}

/**
 * o: { water, foam, len, beam, draft, pivot (ahead of the middle), speed, slow?(x, z) -> speed factor, push? (the share of
 *      its displacement it carries along: the size of its bow wave), wash? (foam strength), spin? (turning on the spot, rad/s) }
 */
export function createVessel({ water, foam, len, beam, draft, pivot, speed = 0.24, slow = null, push = 0.3, wash = 1, spin = 0.45 }) {
  const hl = len / 2, Ls = hl + pivot;
  const b = {
    c: [0, 0], yaw: 0, y: 0, pitch: 0, roll: 0, vy: 0, vp: 0, vr: 0, v: 0, speed, mode: 'still',
    stern: [-hl, 0], route: null, s: 0, spin: null, len, beam, draft, moving: false, vel: [0, 0], omega: 0,
  };
  const smp = [];   // displacement samples along the hull: x along, half width
  for (let k = 0; k < 8; k++) { const x = -hl + ((k + 0.5) * len) / 8; smp.push({ x, w: Math.abs(x) > hl * 0.6 ? beam * 0.35 : beam * 0.5, at: null, V: 0 }); }
  const head = () => [Math.cos(b.yaw), Math.sin(b.yaw)];
  /** Lie still at (x, z) heading yaw. */
  b.place = (x, z, yaw) => {
    b.c = [x, z]; b.yaw = yaw; b.v = 0; b.mode = 'still'; b.route = null; b.spin = null; b.vel = [0, 0]; b.omega = 0;
    const h = head(); b.stern = [x - h[0] * hl, z - h[1] * hl];
    b.y = water.surface(x, z) - 0.001; b.pitch = 0; b.roll = 0; b.vy = 0; b.vp = 0; b.vr = 0;
    for (const S of smp) S.at = null;
  };
  /** Follow a route from its start, coming to a stop at its end. */
  b.follow = (route) => { b.route = route; b.s = 0; b.mode = 'route'; };
  /** Turn about on the spot at (x, z) through da (radians, signed). */
  b.turn = (x, z, da) => { b.spin = { x, z, x0: b.c[0], z0: b.c[1], a0: b.yaw, a1: b.yaw + da, t: 0 }; b.mode = 'spin'; };
  /** Ease to (x, z) heading yaw over dur seconds, whichever way that is: astern, sideways (a tug's work). */
  b.moveTo = (x, z, yaw, dur) => {
    const dy = Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw));
    b.mv = { x0: b.c[0], z0: b.c[1], a0: b.yaw, x, z, a1: b.yaw + dy, t: 0, dur }; b.mode = 'move';
  };
  /** Set her pose from outside (after step, which still floats her): she moves with whatever moves her. */
  b.pose = (x, z, yaw, dt) => {
    b.vel = [(x - b.c[0]) / dt, (z - b.c[1]) / dt]; b.omega = Math.atan2(Math.sin(yaw - b.yaw), Math.cos(yaw - b.yaw)) / dt;
    b.c = [x, z]; b.yaw = yaw; b.mode = 'still'; b.moving = Math.hypot(...b.vel) > 1e-3 || Math.abs(b.omega) > 1e-3;
    const h = head(); b.stern = [x - h[0] * hl, z - h[1] * hl];
  };
  b.atEnd = () => b.mode === 'still';

  b.step = (dt, rate = 1) => {
    const acc = 0.12 * rate, c0 = b.c.slice(), y0 = b.yaw;
    if (b.mode === 'route') {
      const R = b.route, left = R.len - b.s;
      let vt = b.speed * rate;
      if (slow) { const P0 = R.at(b.s); vt *= slow(P0[0], P0[1]); }
      vt = Math.min(vt, Math.sqrt(2 * acc * Math.max(0, left)) * 0.9 + 0.004);
      b.v += Math.max(-acc * dt, Math.min(acc * dt, vt - b.v));
      b.s = Math.min(R.len, b.s + b.v * dt);
      const P = R.at(b.s);
      // the stern trails the pivot at a fixed distance
      const dx = P[0] - b.stern[0], dz = P[1] - b.stern[1], l = Math.hypot(dx, dz) || 1;
      b.stern = [P[0] - (dx / l) * Ls, P[1] - (dz / l) * Ls];
      b.yaw = Math.atan2(dz, dx);
      const h = head();
      b.c = [P[0] - h[0] * pivot, P[1] - h[1] * pivot];
      if (left < 1e-3 && b.v < 0.01) { b.mode = 'still'; b.v = 0; }
    } else if (b.mode === 'spin') {
      const S = b.spin;
      S.t = Math.min(1, S.t + (spin * rate * dt) / Math.abs(S.a1 - S.a0));
      const e = S.t * S.t * (3 - 2 * S.t);
      b.yaw = S.a0 + (S.a1 - S.a0) * e;
      b.c = [S.x0 + (S.x - S.x0) * Math.sin(Math.PI * S.t), S.z0 + (S.z - S.z0) * Math.sin(Math.PI * S.t)];
      b.v = 0.04 * Math.sin(Math.PI * S.t);
      const h = head(); b.stern = [b.c[0] - h[0] * hl, b.c[1] - h[1] * hl];
      if (S.t >= 1) { b.mode = 'still'; b.spin = null; }
    } else if (b.mode === 'move') {
      const M = b.mv;
      M.t = Math.min(1, M.t + (rate * dt) / M.dur);
      const e = M.t * M.t * (3 - 2 * M.t);
      b.c = [M.x0 + (M.x - M.x0) * e, M.z0 + (M.z - M.z0) * e]; b.yaw = M.a0 + (M.a1 - M.a0) * e;
      b.v = Math.hypot(M.x - M.x0, M.z - M.z0) / M.dur;
      const h = head(); b.stern = [b.c[0] - h[0] * hl, b.c[1] - h[1] * hl];
      if (M.t >= 1) { b.mode = 'still'; b.mv = null; }
    }
    b.moving = b.mode !== 'still';
    b.vel = [(b.c[0] - c0[0]) / dt, (b.c[1] - c0[1]) / dt];
    b.omega = Math.atan2(Math.sin(b.yaw - y0), Math.cos(b.yaw - y0)) / dt;
    // float: heave, pitch and roll toward the local surface
    const h = head(), n = [-h[1], h[0]];
    const sf = (u, w) => water.surface(b.c[0] + h[0] * u + n[0] * w, b.c[1] + h[1] * u + n[1] * w);
    const fb = sf(hl * 0.8, 0), fs = sf(-hl * 0.8, 0), fp = sf(0, beam * 0.45), fq = sf(0, -beam * 0.45), mid = (fb + fs + fp + fq) / 4;
    const K = 60, C = 9;
    b.vy += (K * (mid - 0.001 - b.y) - C * b.vy) * dt; b.y += b.vy * dt;
    b.vp += (K * (Math.atan2(fb - fs, len * 0.8) - b.pitch) - C * b.vp) * dt; b.pitch += b.vp * dt;
    b.vr += (K * (Math.atan2(fp - fq, beam * 0.9) - b.roll) - C * b.vr) * dt; b.roll += b.vr * dt;
  };
  /** Push the displacement along with the hull (at the water's rate): a bow wave ahead, a trough astern. */
  b.feed = () => {
    const h = head();
    for (const S of smp) {
      const x = b.c[0] + h[0] * S.x, z = b.c[1] + h[1] * S.x;
      const V = push * 2 * S.w * (len / 8) * draft;
      if (!S.at) { S.at = [x, z]; S.V = V; continue; }   // just placed: she already sits in the still water
      if (Math.hypot(x - S.at[0], z - S.at[1]) < 1e-5) continue;
      water.addVolume(S.at[0], S.at[1], -S.V, 0.05);
      water.addVolume(x, z, V, 0.05);
      S.at = [x, z]; S.V = V;
    }
    if (b.moving && b.v > 0.03) {   // the wash: foam at the stern, a little at the bow
      foam.add(b.c[0] - h[0] * hl * 1.05, b.c[1] - h[1] * hl * 1.05, (0.06 * wash * b.v) / 0.2, 0.05 + beam * 0.15);
      foam.add(b.c[0] + h[0] * hl * 0.98, b.c[1] + h[1] * hl * 0.98, (0.025 * wash * b.v) / 0.2, 0.035);
    }
  };
  /** The hull's outline (8 points, block-local x, z) for checks and collisions. */
  b.outline = () => {
    const h = head(), n = [-h[1], h[0]], pts = [];
    for (const [u, w] of [[hl, 0], [hl * 0.7, 1], [0, 1], [-hl * 0.95, 1], [-hl, 0], [-hl * 0.95, -1], [0, -1], [hl * 0.7, -1]]) {
      pts.push([b.c[0] + h[0] * u + n[0] * w * beam * 0.5, b.c[1] + h[1] * u + n[1] * w * beam * 0.5]);
    }
    return pts;
  };
  /** The velocity of the hull at a point (x, z), for contacts. */
  b.velAt = (x, z) => [b.vel[0] - b.omega * (z - b.c[1]), b.vel[1] + b.omega * (x - b.c[0])];
  /** The hull as a solid for floating things (floaters' collide): a box from the keel to free above the
   *  waterline, narrowing to the bow; returns the penetration of a sphere, its outward normal n, and the
   *  hull's velocity there in u (or 0 when clear). */
  b.solid = (x, y, z, r, n, u, free = 0.07) => {
    if (y - r > b.y + free + 0.05 || y + r < b.y - draft) return 0;
    const hd = [Math.cos(b.yaw), Math.sin(b.yaw)], dx = x - b.c[0], dz = z - b.c[1], a = dx * hd[0] + dz * hd[1], w = -dx * hd[1] + dz * hd[0];
    const half = (beam / 2) * (a > hl * 0.35 ? Math.max(0.15, 1 - ((a / hl - 0.35) / 0.65) ** 2) : 1);
    const pa = hl + r - Math.abs(a), pw = half + r - Math.abs(w);
    if (pa <= 0 || pw <= 0) return 0;
    const vel = b.velAt(x, z);
    u[0] = vel[0]; u[1] = 0; u[2] = vel[1];
    if (pw < pa) { const s = Math.sign(w) || 1; n[0] = -hd[1] * s; n[1] = 0; n[2] = hd[0] * s; return pw; }
    const s = Math.sign(a) || 1; n[0] = hd[0] * s; n[1] = 0; n[2] = hd[1] * s; return pa;
  };
  /** The vessel's transform (local: bow +x, waterline 0). */
  b.matrix = () => A.mul(A.t(b.c[0], b.y, b.c[1]), A.ry(-b.yaw), A.rz(b.pitch), A.rx(-b.roll));
  return b;
}
