// Rigid things in a diorama's sea, each a cloud of spheres: a rubber duck, a boat, a floe of ice. Every
// sphere is buoyed by its own submerged cap and dragged against the water's flow, so a body floats at its
// draft, rights itself (or capsizes) by where its spheres sit round its centre of mass, and rides the waves.
// The volume it displaces goes back into the sea (or, with o.wake, only while it moves fast: a wake and a
// splash, never the feedback of slow drift). Contacts: the terrain, the block's four walls, the specimen's
// own solids (o.collide, which may be moving: a hull), and each other. Block-local coordinates; water density 1.
import { inv3cols } from './math.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const capVolume = (d, r) => (Math.PI * d * d * (3 * r - d)) / 3;   // a sphere of radius r sunk by depth d

/** o: { water, block, terrainH(x, z), terrainNormal?(x, z, out), half, g?, rand, bubbles?, wake? (speed), collide?(x, y, z, r, n, u) -> penetration (u: its surface velocity), current?(x, z, out) (a steady current on top of the water's flow) } */
export function createFloaters(o) {
  if (typeof o.rand !== 'function') throw new TypeError("createFloaters needs rand, the world's seeded random (rng(seed)), so a run replays exactly");
  const { water, block, terrainH, half } = o, G = o.g || 9.8, R = o.rand;
  const terrainNormal = o.terrainNormal || ((x, z, n = [0, 0, 0]) => {
    const e = 0.01, dx = (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), dz = (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz);
    n[0] = -dx / l; n[1] = 1 / l; n[2] = -dz / l;
    return n;
  });
  const F = { bodies: [], events: [] };
  let nextId = 1;
  const tG = [0, 0], tF = [0, 0], tN = [0, 0, 0], tP = [0, 0, 0], tU = [0, 0, 0], ZERO = [0, 0, 0], tC = [0, 0];
  /** The water's flow at (x, z), plus the specimen's steady current if it has one (a river, a lazy river). */
  const flowAt = (x, z, out) => { water.flow(x, z, out); if (o.current) { o.current(x, z, tC); out[0] += tC[0]; out[1] += tC[1]; } return out; };

  /** def: { spheres: [[x, y, z, r], ...] (model frame), rho, com? (model frame; default the spheres' centroid), p (com), q?, mu?, e?, ...yours } */
  // mass, centre of mass, inertia and reach of a sphere cloud at a scale
  function shape(b, S, rho, com0, k) {
    let vol = 0, cx = 0, cy = 0, cz = 0;
    for (const [x, y, z, r] of S) { const v = (4 / 3) * Math.PI * (r * k) ** 3; vol += v; cx += x * k * v; cy += y * k * v; cz += z * k * v; }
    const com = com0 ? com0.map((c) => c * k) : [cx / vol, cy / vol, cz / vol];   // ponytail: overlapping spheres count twice; mass and buoyancy alike, so the draft holds
    const d = S.map(([x, y, z]) => [x * k - com[0], y * k - com[1], z * k - com[2]]);
    const I = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    let rad = 0;
    S.forEach(([, , , r0], i) => {
      const r = r0 * k, mi = rho * (4 / 3) * Math.PI * r * r * r, [x, y, z] = d[i], dd = x * x + y * y + z * z, s = 0.4 * r * r + dd;
      I[0] += mi * (s - x * x); I[4] += mi * (s - y * y); I[8] += mi * (s - z * z);
      I[1] -= mi * x * y; I[2] -= mi * x * z; I[5] -= mi * y * z;
      rad = Math.max(rad, Math.sqrt(dd) + r);
    });
    I[3] = I[1]; I[6] = I[2]; I[7] = I[5];
    Object.assign(b, { com, d, r: S.map((s) => s[3] * k), m: rho * vol, vol, Iinv: inv3cols(I), rad, scale: k });
  }
  F.add = (def) => {
    const S = def.spheres;
    const b = { mu: 0.5, e: 0.25, q: [0, 0, 0, 1], ...def, id: nextId++,
      p: def.p.slice(), v: [0, 0, 0], w: [0, 0, 0], sub: S.map(() => 0), dV: S.map(() => 0), submerged: 0,
      state: 'free', sleep: false, still: 0, hSleep: 0, wetSleep: false, airT: 9, ground: 9,
      Rm: [1, 0, 0, 0, 1, 0, 0, 0, 1], Iw: [0, 0, 0, 0, 0, 0, 0, 0, 0], x: S.map(() => [0, 0, 0]) };
    b.com0 = def.com || null;
    shape(b, S, def.rho, b.com0, def.scale || 1);
    b.q = b.q.slice();
    pose(b);
    F.bodies.push(b);
    return b;
  };
  /** Shrink (or grow) a body about its centre of mass: a melting floe. */
  F.scale = (b, k) => { shape(b, b.spheres, b.rho, b.com0, k); pose(b); };
  F.remove = (b) => { const i = F.bodies.indexOf(b); if (i >= 0) F.bodies.splice(i, 1); };
  F.clear = () => { F.bodies.length = 0; F.events.length = 0; };

  // rotation (row-major), world inverse inertia and sphere centres from p, q
  function pose(b) {
    const [x, y, z, w] = b.q, M = b.Rm;
    M[0] = 1 - 2 * (y * y + z * z); M[1] = 2 * (x * y - z * w); M[2] = 2 * (x * z + y * w);
    M[3] = 2 * (x * y + z * w); M[4] = 1 - 2 * (x * x + z * z); M[5] = 2 * (y * z - x * w);
    M[6] = 2 * (x * z - y * w); M[7] = 2 * (y * z + x * w); M[8] = 1 - 2 * (x * x + y * y);
    const A = b.Iinv, T = [0, 0, 0, 0, 0, 0, 0, 0, 0];   // Iw = M A M^T (A symmetric)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += A[i * 3 + k] * M[j * 3 + k]; T[i * 3 + j] = s; }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += M[i * 3 + k] * T[k * 3 + j]; b.Iw[i * 3 + j] = s; }
    b.d.forEach((d, i) => {
      const X = b.x[i];
      X[0] = b.p[0] + M[0] * d[0] + M[1] * d[1] + M[2] * d[2];
      X[1] = b.p[1] + M[3] * d[0] + M[4] * d[1] + M[5] * d[2];
      X[2] = b.p[2] + M[6] * d[0] + M[7] * d[1] + M[8] * d[2];
    });
  }
  const mulIw = (b, v, out) => { const A = b.Iw; out[0] = A[0] * v[0] + A[1] * v[1] + A[2] * v[2]; out[1] = A[3] * v[0] + A[4] * v[1] + A[5] * v[2]; out[2] = A[6] * v[0] + A[7] * v[1] + A[8] * v[2]; return out; };
  const cross = (a, b, o) => { o[0] = a[1] * b[2] - a[2] * b[1]; o[1] = a[2] * b[0] - a[0] * b[2]; o[2] = a[0] * b[1] - a[1] * b[0]; return o; };
  const tc = [0, 0, 0], ta = [0, 0, 0], tr = [0, 0, 0], tv = [0, 0, 0], tt = [0, 0, 0];
  // the effective inverse mass of b at arm r along n
  const kAt = (b, r, n) => { cross(r, n, tc); mulIw(b, tc, ta); cross(ta, r, tc); return 1 / b.m + tc[0] * n[0] + tc[1] * n[1] + tc[2] * n[2]; };
  const velAt = (b, r, out) => { cross(b.w, r, out); out[0] += b.v[0]; out[1] += b.v[1]; out[2] += b.v[2]; return out; };
  function impulse(b, r, n, j) {
    if (b.state === 'held') return;
    b.v[0] += (n[0] * j) / b.m; b.v[1] += (n[1] * j) / b.m; b.v[2] += (n[2] * j) / b.m;
    tv[0] = n[0] * j; tv[1] = n[1] * j; tv[2] = n[2] * j;
    cross(r, tv, tc); mulIw(b, tc, ta);
    b.w[0] += ta[0]; b.w[1] += ta[1]; b.w[2] += ta[2];
  }
  // the water's surface for sleeping: absolute, so a body of water's level moving (a lock's chamber) counts; -9 on dry ground
  const waterAt = (x, z) => (water.isWet(x, z) ? water.surface(x, z) : -9);
  // a contact at sphere i against a surface moving at u (or still): push out, bounce, Coulomb friction; returns the closing speed
  function contact(b, i, n, pen, u = ZERO) {
    b.p[0] += n[0] * pen; b.p[1] += n[1] * pen; b.p[2] += n[2] * pen;
    for (const X of b.x) { X[0] += n[0] * pen; X[1] += n[1] * pen; X[2] += n[2] * pen; }
    const X = b.x[i];
    tr[0] = X[0] - n[0] * b.r[i] - b.p[0]; tr[1] = X[1] - n[1] * b.r[i] - b.p[1]; tr[2] = X[2] - n[2] * b.r[i] - b.p[2];
    velAt(b, tr, tv); tv[0] -= u[0]; tv[1] -= u[1]; tv[2] -= u[2];
    const vn = tv[0] * n[0] + tv[1] * n[1] + tv[2] * n[2];
    if (vn >= 0) return 0;
    const j = (-(-vn > 0.7 ? 1 + b.e : 1) * vn) / kAt(b, tr, n);
    impulse(b, tr, n, j);
    velAt(b, tr, tv); tv[0] -= u[0]; tv[1] -= u[1]; tv[2] -= u[2];
    const vn2 = tv[0] * n[0] + tv[1] * n[1] + tv[2] * n[2];
    tt[0] = tv[0] - n[0] * vn2; tt[1] = tv[1] - n[1] * vn2; tt[2] = tv[2] - n[2] * vn2;
    const vt = Math.hypot(tt[0], tt[1], tt[2]);
    if (vt > 1e-6) {
      tt[0] /= vt; tt[1] /= vt; tt[2] /= vt;
      const jt = Math.min(vt / kAt(b, tr, tt), b.mu * j);
      impulse(b, tr, tt, -jt);
    }
    return -vn;
  }

  function splash(b, speed) {
    const x = b.p[0], z = b.p[2], imp = (speed * b.m) / 0.01, rr = Math.min(b.rad, 0.4);
    water.addVolume(x, z, -0.3 * speed * b.vol * Math.min(1, b.rho), rr * 1.6);
    if (o.bubbles) {
      const nb = Math.min(24, 6 + Math.round(imp * 2.5)), surf = water.surface(x, z);
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * 6.283 + R() * 0.5, d = rr * (0.8 + 0.6 * R());
        o.bubbles.emit(x + Math.cos(a) * d, surf - 0.03 - R() * 0.12, z + Math.sin(a) * d, 0.006 + 0.012 * R());
      }
    }
    const k = clamp(imp * 0.12, 0, 1.2), hv = Math.hypot(b.v[0], b.v[2]) || 1;
    block.kick([(b.v[0] / hv) * 0.4 * k, (b.v[2] / hv) * 0.4 * k], -k);
    F.events.push({ type: 'splash', body: b, speed, x, z });
  }

  function stepBody(b, dt) {
    pose(b);
    // submerged caps; held or asleep, a body still feeds the sea
    let Vt = 0;
    for (let i = 0; i < b.x.length; i++) {
      const X = b.x[i], r = b.r[i];
      const V = water.isWet(X[0], X[2]) ? capVolume(clamp(water.surface(X[0], X[2]) - (X[1] - r), 0, 2 * r), r) : 0;
      b.dV[i] += V - b.sub[i];
      b.sub[i] = V; Vt += V;
    }
    const entering = b.submerged <= 0 && Vt > 0;
    b.submerged = Vt;
    if (b.state === 'held') return;
    if (b.sleep) {
      // the water rising to it, or (asleep afloat) the water dropping away from under it, as a lock's chamber empties
      const wake = Math.hypot(block.v[0], block.v[1]) > 0.025 || ((Vt > 0 || b.wetSleep) && Math.abs(waterAt(b.p[0], b.p[2]) - b.hSleep) > 0.012)
        || (o.collide && o.collide(b.p[0], b.p[1], b.p[2], b.rad, tN, tU) > 0);   // a moving solid (a hull) coming at it
      if (!wake) return;
      b.sleep = false; b.still = 0;
    }
    // forces: gravity at the centre of mass; buoyancy and drag at each sphere
    const g = block.g, f = [g[0] * b.m, g[1] * b.m, g[2] * b.m], T = [0, 0, 0];
    for (let i = 0; i < b.x.length; i++) {
      const V = b.sub[i];
      if (V <= 0) continue;
      const X = b.x[i];
      water.grad(X[0], X[2], tG); flowAt(X[0], X[2], tF);
      const nl = Math.hypot(tG[0], 1, tG[1]), B = V * G;
      tr[0] = X[0] - b.p[0]; tr[1] = X[1] - b.p[1]; tr[2] = X[2] - b.p[2];
      velAt(b, tr, tv);
      const rx = tv[0] - tF[0], ry = tv[1], rz = tv[2] - tF[1], c = b.rho * V * (3.2 + 1.2 * Math.hypot(rx, ry, rz));
      tP[0] = (-tG[0] / nl) * B - rx * c; tP[1] = B / nl - ry * (c + 4 * b.rho * V); tP[2] = (-tG[1] / nl) * B - rz * c;
      f[0] += tP[0]; f[1] += tP[1]; f[2] += tP[2];
      cross(tr, tP, tc); T[0] += tc[0]; T[1] += tc[1]; T[2] += tc[2];
    }
    const frac = Vt / b.vol;
    b.v[0] += (f[0] / b.m) * dt; b.v[1] += (f[1] / b.m) * dt; b.v[2] += (f[2] / b.m) * dt;
    mulIw(b, T, ta);
    // rocking dies in the water (the waves it sends off carry it away), more the nearer the body sits to its draft
    const wd = 1 - Math.min(0.5, (2 * frac + 4 * Math.min(1, frac / Math.min(1, b.rho))) * dt + (b.ground < 0.05 ? 0.3 * dt : 0));
    for (let k = 0; k < 3; k++) b.w[k] = (b.w[k] + ta[k] * dt) * wd;
    for (let k = 0; k < 3; k++) b.p[k] += b.v[k] * dt;
    const [qx, qy, qz, qw] = b.q, [wx, wy, wz] = b.w, h = 0.5 * dt;
    b.q[0] = qx + h * (wx * qw + wy * qz - wz * qy); b.q[1] = qy + h * (wy * qw + wz * qx - wx * qz);
    b.q[2] = qz + h * (wz * qw + wx * qy - wy * qx); b.q[3] = qw - h * (wx * qx + wy * qy + wz * qz);
    const ql = Math.hypot(...b.q); for (let k = 0; k < 4; k++) b.q[k] /= ql;
    if (entering && b.airT > 0.2 && b.v[1] < -1.2) splash(b, -b.v[1]);
    if (Vt > 0) b.airT = 0; else b.airT += dt;
    // contacts: terrain, walls, the specimen's solids
    pose(b);
    b.ground += dt;
    let hit = 0;
    for (let i = 0; i < b.x.length; i++) {
      const X = b.x[i], r = b.r[i], th = terrainH(X[0], X[2]);
      if (X[1] - r < th + 0.02) {
        const n = terrainNormal(X[0], X[2], tN), pen = r - (X[1] - th) * n[1];
        if (pen > 0) { hit = Math.max(hit, contact(b, i, n, pen)); b.ground = 0; }
      }
      for (const k of [0, 2]) {
        const lim = half - r;
        if (X[k] > lim) { tN[0] = 0; tN[1] = 0; tN[2] = 0; tN[k] = -1; contact(b, i, tN, X[k] - lim); }
        else if (X[k] < -lim) { tN[0] = 0; tN[1] = 0; tN[2] = 0; tN[k] = 1; contact(b, i, tN, -lim - X[k]); }
      }
      if (o.collide) { tU[0] = tU[1] = tU[2] = 0; const pen = o.collide(X[0], X[1], X[2], r, tN, tU); if (pen > 0) { const s = contact(b, i, tN, pen, tU); if (s > 0.08) F.events.push({ type: 'knock', body: b, speed: s, x: X[0], z: X[2] }); } }
    }
    if (hit > 1.5 && Vt <= 0) { block.kick([0, 0], -clamp((hit * b.m) / 0.01 * 0.05, 0, 0.6)); F.events.push({ type: 'land', body: b, speed: hit }); }
    // sleep when calm
    if (Math.hypot(...b.v) < 0.035 && Math.hypot(...b.w) < 0.2 && (b.ground < 0.05 || Vt > 0)) {
      if ((b.still += dt) > 0.7) { b.sleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0]; b.hSleep = waterAt(b.p[0], b.p[2]); b.wetSleep = Vt > 0; }
    } else b.still = 0;
  }

  const ra = [0, 0, 0], rb = [0, 0, 0], va = [0, 0, 0], vb = [0, 0, 0], nn = [0, 0, 0];
  function collidePairs() {
    const B = F.bodies;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], b = B[j];
      if ((a.sleep && b.sleep) || (a.state === 'held' && b.state === 'held')) continue;
      if (Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]) > a.rad + b.rad) continue;
      const ia = a.state === 'held' ? 0 : 1, ib = b.state === 'held' ? 0 : 1;
      for (let s = 0; s < a.x.length; s++) for (let t = 0; t < b.x.length; t++) {
        const A = a.x[s], C = b.x[t], dx = C[0] - A[0], dy = C[1] - A[1], dz = C[2] - A[2], d = Math.hypot(dx, dy, dz), rr = a.r[s] + b.r[t];
        if (d >= rr || d < 1e-6) continue;
        nn[0] = dx / d; nn[1] = dy / d; nn[2] = dz / d;
        const pen = rr - d, wa = ia / a.m, wb = ib / b.m, ws = wa + wb || 1;
        for (let k = 0; k < 3; k++) { a.p[k] -= nn[k] * pen * wa / ws; b.p[k] += nn[k] * pen * wb / ws; }
        for (const X of a.x) for (let k = 0; k < 3; k++) X[k] -= nn[k] * pen * wa / ws;
        for (const X of b.x) for (let k = 0; k < 3; k++) X[k] += nn[k] * pen * wb / ws;
        for (let k = 0; k < 3; k++) { const c = A[k] + nn[k] * a.r[s]; ra[k] = c - a.p[k]; rb[k] = c - b.p[k]; }
        velAt(a, ra, va); velAt(b, rb, vb);
        const vn = (vb[0] - va[0]) * nn[0] + (vb[1] - va[1]) * nn[1] + (vb[2] - va[2]) * nn[2];
        if (vn < 0) {
          const k = (ia ? kAt(a, ra, nn) : 0) + (ib ? kAt(b, rb, nn) : 0), J = (-(1 + Math.min(a.e, b.e)) * vn) / (k || 1);
          impulse(a, ra, nn, -J); impulse(b, rb, nn, J);
          if (-vn > 0.15) { a.sleep = false; a.still = 0; b.sleep = false; b.still = 0; }
        }
        if (a.sleep !== b.sleep) { a.sleep = false; b.sleep = false; }
      }
    }
  }

  /** One body step (the caller's fast rate, e.g. 240 Hz). */
  F.step = (dt) => { for (const b of F.bodies) stepBody(b, dt); collidePairs(); };
  /** Hand the displaced volume to the sea (the water's rate, before water.step). */
  F.feed = () => {
    for (const b of F.bodies) {
      // a wake comes from moving through the water, not from bobbing in it
      if (o.wake) flowAt(b.p[0], b.p[2], tF);
      const fast = !o.wake || Math.hypot(b.v[0] - tF[0], b.v[2] - tF[1]) > o.wake || Math.abs(b.v[1]) > 2 * o.wake;   // or a plunge
      for (let i = 0; i < b.x.length; i++) {
        if (fast && Math.abs(b.dV[i]) > 1e-8) water.addVolume(b.x[i][0], b.x[i][2], b.dV[i], b.r[i] * 1.1);
        b.dV[i] = 0;
      }
    }
  };

  // ----- picking and the hand -----
  F.pick = (ro, rd) => {
    const hit = (c, r) => {
      const ox = ro[0] - c[0], oy = ro[1] - c[1], oz = ro[2] - c[2];
      const k = ox * rd[0] + oy * rd[1] + oz * rd[2], disc = k * k - (ox * ox + oy * oy + oz * oz - r * r);
      return disc < 0 ? -1 : -k - Math.sqrt(disc);
    };
    let best = Infinity, body = null;
    for (const b of F.bodies) {
      if (b.state === 'held') continue;
      // each sphere a little larger than it is (+1.2 cm): small things are easier to catch, and the hole in a
      // lifebuoy (its ring's spheres 2.1 cm from the middle) picks it; a big berg grows by next to nothing
      for (let i = 0; i < b.x.length; i++) { const t = hit(b.x[i], b.r[i] * 1.2 + 0.012); if (t > 0 && t < best) { best = t; body = b; } }
    }
    return body ? { kind: 'body', body, t: best } : null;
  };
  F.grab = (b) => { b.state = 'held'; b.sleep = false; b.still = 0; b.v = [0, 0, 0]; b.w = [0, 0, 0]; };
  F.hold = (b, p) => {
    const lim = half - b.rad;
    b.p[0] = clamp(p[0], -lim, lim); b.p[2] = clamp(p[2], -lim, lim);
    b.p[1] = Math.max(p[1], terrainH(b.p[0], b.p[2]) + b.rad);
  };
  F.throw = (b, v) => {
    const s = Math.hypot(v[0], v[1], v[2]), k = s > 7 ? 7 / s : 1;
    b.state = 'free'; b.v = [v[0] * k, v[1] * k, v[2] * k]; b.sleep = false; b.still = 0;
    b.w = [(R() - 0.5) * 4, (R() - 0.5) * 4, (R() - 0.5) * 4];
  };
  /** Where the model's origin is (p less the turned centre-of-mass offset), for drawing. */
  F.origin = (b, out = [0, 0, 0]) => {
    const M = b.Rm, c = b.com;
    out[0] = b.p[0] - (M[0] * c[0] + M[1] * c[1] + M[2] * c[2]);
    out[1] = b.p[1] - (M[3] * c[0] + M[4] * c[1] + M[5] * c[2]);
    out[2] = b.p[2] - (M[6] * c[0] + M[7] * c[1] + M[8] * c[2]);
    return out;
  };
  /** The body's model up axis in the block frame. */
  F.up = (b) => [b.Rm[1], b.Rm[4], b.Rm[7]];
  return F;
}
