
// ---------------------------------------------------------------------------
// Island Jelly — the world. Block-local coordinates: y up, block base at y = 0, footprint |x|, |z| <= HALF.
// Terrain (analytic), three gummy palms (bend springs + mesh) and the bodies (pebbles and coconuts); the sea,
// the tippable block and the bubbles come from the shared diorama engine (@lid/diorama).
// ---------------------------------------------------------------------------
import { createShallowWater, terrainGrid as sharedTerrainGrid } from '@lid/diorama/water.js';
import { createBlock as makeBlock } from '@lid/diorama/block.js';
import { createBubbles } from '@lid/diorama/bubbles.js';
import { pickBlock } from '@lid/diorama/view.js';
export const IJ = (() => {
  const HALF = 2.6, SIDE = 5.2, WL0 = 1.3, BLOCK_H = 2.0, GN = 168, GDX = SIDE / GN, TILT_MAX = 0.17, G = 9.8;
  const ISLE = [-0.3, -0.5];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ----- terrain -----
  function hash2(i, j) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z) {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  // reef rocks: x, z, height, radius, phase
  const ROCKS = [[-1.7, 1.35, 0.62, 0.23, 0.4], [1.75, -1.2, 0.48, 0.2, 2.1]];
  function rockR(x, z, k) {
    const [rx, rz, , rad, ph] = ROCKS[k], a = Math.atan2(z - rz, x - rx);
    return rad * (1 + 0.16 * Math.sin(3 * a + ph) + 0.08 * Math.sin(5 * a - 2 * ph));
  }
  function terrainH(x, z) {
    let h = 0.88 - 0.34 * ss(-3.8, 4.2, x + z);
    h += 0.034 * (vnoise(x * 1.1 + 3.1, z * 1.1 - 1.7) - 0.5) + 0.012 * (vnoise(x * 2.9 - 5.3, z * 2.9 + 2.2) - 0.5);
    h += 0.003 * Math.sin(x * 17 + z * 6 + 1.3 * Math.sin(z * 3.1));   // sand ripples
    const ix = (x - ISLE[0]) / 1.75, iz = (z - ISLE[1]) / 1.48, r = Math.hypot(ix, iz);
    h += 0.3 * (1 - ss(0.1, 0.9, r)) + 0.45 * (1 - ss(0.6, 1.2, r));
    {   // the sandbar: a ridge along the shoreline direction, across the diagonal slope
      const dx = x - 1.35, dz = z - 1.05, a = (dx - dz) * 0.7071, b = (dx + dz) * 0.7071;
      h += 0.42 * Math.exp(-(a * a) / (2 * 0.62 * 0.62) - (b * b) / (2 * 0.2 * 0.2));
    }
    for (let k = 0; k < ROCKS.length; k++) {
      const d = Math.hypot(x - ROCKS[k][0], z - ROCKS[k][1]);
      if (d < ROCKS[k][3] * 1.5) { const q = Math.min(1, d / rockR(x, z, k)); h += ROCKS[k][2] * Math.pow(1 - q * q, 1.4) * (1 + 0.06 * Math.sin(9 * x + 7 * z)); }
    }
    return h;
  }
  function rockMask(x, z) {
    let m = 0;
    for (let k = 0; k < ROCKS.length; k++) {
      const d = Math.hypot(x - ROCKS[k][0], z - ROCKS[k][1]);
      if (d < ROCKS[k][3] * 1.5) m = Math.max(m, 1 - ss(0.75, 1.05, d / rockR(x, z, k)));
    }
    return m;
  }
  function terrainNormal(x, z, out = [0, 0, 0]) {
    const e = 0.012, nx = -(terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), nz = -(terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const l = Math.hypot(nx, 1, nz);
    out[0] = nx / l; out[1] = 1 / l; out[2] = nz / l;
    return out;
  }
  const terrainGrid = () => sharedTerrainGrid(GN, HALF, terrainH);

  // ----- the sea and the block: the shared diorama engine, with the island's numbers -----
  const createWater = () => createShallowWater({ N: GN, half: HALF, terrain: terrainGrid(), level: WL0 });
  const createBlock = () => makeBlock({ half: HALF, tiltMax: TILT_MAX, g: G });

  // ----- palms -----
  const PALMS = [{ x: -0.8, z: -0.54, h: 1.2, n: 9, rings: 11 }, { x: 0.06, z: -0.28, h: 1.05, n: 9, rings: 10 }, { x: -0.32, z: -1.04, h: 0.88, n: 8, rings: 9 }];
  const PALM_INFO = PALMS.map((P, k) => {
    let dx = P.x - ISLE[0], dz = P.z - ISLE[1];
    const a = Math.atan2(dz, dx) + [0.5, -0.35, 0.3][k], lean = 0.2 * P.h;
    dx = Math.cos(a); dz = Math.sin(a);
    const base = [P.x, terrainH(P.x, P.z) - 0.05, P.z];
    const at = (t) => {
      const l = lean * Math.pow(t, 1.8), sw = 0.03 * Math.sin(Math.PI * t);
      return [base[0] + dx * l - dz * sw, base[1] + P.h * t, base[2] + dz * l + dx * sw];
    };
    return { ...P, base, dir: [dx, dz], at, crown: at(1), phase: k * 1.3 + 0.4 };
  });

  /** The palms as one mesh: 12 floats per vertex (pos3, nrm3, uv2, extra4 = palm, bend weight, flutter, phase). */
  function palmMesh() {
    const V = [], I = [], R = rng(31);
    const vert = (p, n, uv, e) => { V.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], e[0], e[1], e[2], e[3]); return V.length / 12 - 1; };
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    PALM_INFO.forEach((P, k) => {
      // trunk: ringed gummy segments
      const rows = P.rings * 6 + 1, S = 14, first = V.length / 12;
      for (let r = 0; r < rows; r++) {
        const t = r / (rows - 1), c = P.at(t), c2 = P.at(Math.min(1, t + 0.01)), c1 = P.at(Math.max(0, t - 0.01));
        const T = norm([c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]]);
        const A = norm(cross(T, [1, 0, 0])), Bv = cross(T, A);
        const fr = (t * P.rings) % 1, bulge = 0.86 + 0.2 * Math.sin(Math.PI * fr);
        const rad = (0.066 - 0.026 * t) * bulge, dr = (0.066 - 0.026 * t) * 0.2 * Math.PI * Math.cos(Math.PI * fr) * P.rings / P.h;
        for (let s = 0; s <= S; s++) {
          const th = (s / S) * 2 * Math.PI, ca = Math.cos(th), sa = Math.sin(th);
          const rd = [A[0] * ca + Bv[0] * sa, A[1] * ca + Bv[1] * sa, A[2] * ca + Bv[2] * sa];
          const n = norm([rd[0] - T[0] * dr, rd[1] - T[1] * dr, rd[2] - T[2] * dr]);
          vert([c[0] + rd[0] * rad, c[1] + rd[1] * rad, c[2] + rd[2] * rad], n, [s / S, t * P.rings], [k, t, 0, 0]);
        }
      }
      for (let r = 0; r < rows - 1; r++) for (let s = 0; s < S; s++) {
        const a = first + r * (S + 1) + s, b = a + S + 1;
        I.push(a, b, a + 1, a + 1, b, b + 1);
      }
      // fronds: arched pinnate leaves, leaflets on both sides, drooping at the tips
      const cr = P.crown, sc = 0.8 + 0.2 * P.h / 1.2;
      for (let f = 0; f < P.n; f++) {
        const phi = (f / P.n) * 2 * Math.PI + 0.35 * (R() - 0.5) + k;
        const dh = [Math.cos(phi), 0, Math.sin(phi)], rise = 0.35 + 0.3 * (f % 2) + 0.1 * R(), Lf = (0.5 + 0.1 * R()) * sc;
        const spine = (s) => [cr[0] + dh[0] * Lf * s * (1 - 0.12 * s), cr[1] + Lf * (rise * s - (rise + 0.48) * s * s), cr[2] + dh[2] * Lf * s * (1 - 0.12 * s)];
        const J = 14, ph = phi * 5 + k;
        let prev = spine(0);
        for (let j = 1; j < J; j++) {
          const s = j / (J - 1), p = spine(s), Ts = norm([p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]]);
          const side = norm(cross(Ts, [0, 1, 0])), up = norm(cross(side, Ts));
          const e = [k, 1, s, ph + j * 0.37];
          // rachis ribbon segment
          const rw = 0.009 * (1 - 0.6 * s);
          const a0 = vert([prev[0] - side[0] * rw, prev[1], prev[2] - side[2] * rw], up, [2, s], e);
          const a1 = vert([prev[0] + side[0] * rw, prev[1], prev[2] + side[2] * rw], up, [2, s], e);
          const a2 = vert([p[0] - side[0] * rw, p[1], p[2] - side[2] * rw], up, [2, s], e);
          const a3 = vert([p[0] + side[0] * rw, p[1], p[2] + side[2] * rw], up, [2, s], e);
          I.push(a0, a2, a1, a1, a2, a3);
          if (j < 2) { prev = p; continue; }
          for (const sg of [-1, 1]) {
            const len = 0.17 * (Lf / 0.55) * Math.pow(Math.sin(Math.PI * (0.1 + 0.85 * s)), 0.7) * (0.85 + 0.3 * R());
            const dl = norm([side[0] * sg * 0.82 + Ts[0] * 0.5, side[1] * sg * 0.82 + Ts[1] * 0.5 - 0.3 - 0.4 * s, side[2] * sg * 0.82 + Ts[2] * 0.5]);
            const tip = [p[0] + dl[0] * len, p[1] + dl[1] * len - 0.25 * len * len, p[2] + dl[2] * len];
            const w0 = 0.03 * (1 - 0.4 * s), w1 = 0.006;
            let n = norm(cross(dl, Ts)); if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
            const b0 = vert([p[0] - Ts[0] * w0, p[1] - Ts[1] * w0, p[2] - Ts[2] * w0], n, [2.001, s], e);
            const b1 = vert([p[0] + Ts[0] * w0, p[1] + Ts[1] * w0, p[2] + Ts[2] * w0], n, [2.001, s], e);
            const et = [k, 1, s + 0.35, ph + j * 0.37 + sg];
            const t0 = vert([tip[0] - Ts[0] * w1, tip[1] - Ts[1] * w1, tip[2] - Ts[2] * w1], n, [3, s], et);
            const t1 = vert([tip[0] + Ts[0] * w1, tip[1] + Ts[1] * w1, tip[2] + Ts[2] * w1], n, [3, s], et);
            I.push(b0, t0, b1, b1, t0, t1);
          }
          prev = p;
        }
      }
    });
    return { vert: new Float32Array(V), index: new Uint32Array(I) };
  }

  function createPalms() {
    const st = PALM_INFO.map(() => ({ b: [0, 0], bv: [0, 0], held: false, target: [0, 0], fling: 0 }));
    const K = (2 * Math.PI * 1.05) ** 2, C = 2 * 0.075 * 2 * Math.PI * 1.05;
    const Pm = { st, info: PALM_INFO };
    Pm.reset = () => st.forEach((s) => { s.b = [0, 0]; s.bv = [0, 0]; s.held = false; s.fling = 0; });
    Pm.step = (dt, B, time, breeze) => {
      st.forEach((s, k) => {
        const P = PALM_INFO[k], yc = P.crown[1];
        let fx = B.g[0] * 2.4, fz = B.g[2] * 2.4;                        // leans downhill on a tilt
        fx += B.acc[1] * yc * 0.35; fz -= B.acc[0] * yc * 0.35;           // whips with the block
        if (breeze) {
          const a = 0.32 * (Math.sin(0.62 * time + k * 1.7) + 0.6 * Math.sin(1.73 * time + k * 0.9) + 0.25 * Math.sin(4.1 * time + k));
          fx += a * 0.8; fz += a * 0.6;
        }
        let c = C;
        if (s.held) { fx += 160 * (s.target[0] - s.b[0]); fz += 160 * (s.target[1] - s.b[1]); c = C * 5; }
        s.bv[0] += dt * (fx - K * s.b[0] - c * s.bv[0]);
        s.bv[1] += dt * (fz - K * s.b[1] - c * s.bv[1]);
        s.b[0] += dt * s.bv[0]; s.b[1] += dt * s.bv[1];
        const m = Math.hypot(s.b[0], s.b[1]), mx = 0.45 * P.h;
        if (m > mx) { s.b[0] *= mx / m; s.b[1] *= mx / m; }
        s.fling = Math.hypot(s.bv[0], s.bv[1]);
      });
    };
    Pm.crownPos = (k, o = [0, 0, 0]) => {
      const P = PALM_INFO[k], b = st[k].b;
      o[0] = P.crown[0] + b[0]; o[1] = P.crown[1] - 0.5 * (b[0] * b[0] + b[1] * b[1]) / P.h; o[2] = P.crown[2] + b[1];
      return o;
    };
    /** The three coconut spots under a crown; they move with the bend. */
    Pm.spot = (k, i, o = [0, 0, 0]) => {
      const P = PALM_INFO[k], a = P.phase + i * 2.094, b = st[k].b, w = 0.94;
      o[0] = P.crown[0] + Math.cos(a) * 0.13 + b[0] * w;
      o[1] = P.crown[1] - 0.12 - 0.5 * (b[0] * b[0] + b[1] * b[1]) / P.h;
      o[2] = P.crown[2] + Math.sin(a) * 0.13 + b[1] * w;
      return o;
    };
    Pm.uniforms = (out, off, time, breeze) => {
      st.forEach((s, k) => out.set([s.b[0], s.b[1], PALM_INFO[k].h, (breeze ? 1 : 0.35) + Math.min(1.5, s.fling * 0.6)], off + 4 * k));
    };
    return Pm;
  }

  // ----- the world -----
  const KIND = { pebble: { rho: 2.4, mu: 0.62, e: 0.22 }, coconut: { rho: 0.62, mu: 0.42, e: 0.3 } };
  const MAX_BODIES = 40;

  function createWorld(opts = {}) {
    const R = rng(opts.seed || 7);
    const water = createWater(), block = createBlock(), palms = createPalms(), bubbles = createBubbles({ water, rand: R, terrainH, rest: WL0 });
    const world = { water, block, palms, bubbles, bodies: [], firm: 0.5, reduced: !!opts.reduced, time: 0, tide: 0, events: [], nextId: 1 };
    const tmpN = [0, 0, 0], tmpG = [0, 0], tmpF = [0, 0], tmpS = [0, 0, 0];

    world.setFirm = (f) => { world.firm = f; water.firm = f; };
    world.setDamp = (d) => { water.damp = d; };
    world.setTide = (t) => { world.tide = clamp(t, -0.1, 0.1); water.setLevel(WL0 + world.tide); };

    function makeBody(kind, r, p) {
      const K = KIND[kind], Vs = (4 / 3) * Math.PI * r * r * r;
      return { id: world.nextId++, kind, r, rho: K.rho, mu: K.mu, e: K.e, Vs, m: K.rho * Vs, p: p.slice(), v: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0],
        state: 'free', palm: -1, spot: -1, sub: 0, dV: 0, airT: 9, sandT: 9, sleep: false, still: 0, sq: 0, sqv: 0, color: 0, hSleep: 0 };
    }
    function beachSpots(count, rad) {
      const out = [], n = [0, 0, 0];
      for (let k = 0; out.length < count && k < 400; k++) {
        const a = k * 2.39996323 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
        for (let r = 0.3; r < 1.4; r += 0.01) {
          const x = ISLE[0] + ca * r * 1.75, z = ISLE[1] + sa * r * 1.48, t = terrainH(x, z);
          if (t > WL0 + 0.09) continue;
          if (t < WL0 + 0.05) break;
          terrainNormal(x, z, n);
          if (n[1] <= 0.93) break;
          if (out.some((o) => Math.hypot(o[0] - x, o[2] - z) < 0.24)) break;
          if (PALM_INFO.some((P) => Math.hypot(P.base[0] - x, P.base[2] - z) < 0.22)) break;
          out.push([x + n[0] * rad, t + n[1] * rad, z + n[2] * rad]);
          break;
        }
      }
      return out;
    }

    world.reset = () => {
      water.setLevel(WL0 + world.tide); water.flat(); block.reset(); palms.reset(); bubbles.reset();
      world.bodies = []; world.events = [];
      for (let k = 0; k < PALM_INFO.length; k++) for (let s = 0; s < 3; s++) {
        const b = makeBody('coconut', 0.105 + 0.01 * R(), palms.spot(k, s));
        b.state = 'crown'; b.palm = k; b.spot = s;
        world.bodies.push(b);
      }
      const rads = Array.from({ length: 7 }, () => 0.075 + 0.025 * R());
      beachSpots(7, 0.09).forEach((p, i) => {
        const b = makeBody('pebble', rads[i], p);
        const n = terrainNormal(p[0], p[2]), t = terrainH(p[0], p[2]);
        b.p = [p[0] + n[0] * (rads[i] - 0.09), t + n[1] * rads[i], p[2] + n[2] * (rads[i] - 0.09)];
        b.color = i % 4; b.sleep = true; b.sandT = 0; b.hSleep = 0;
        world.bodies.push(b);
      });
    };

    world.drop = (kind) => {
      kind = kind || (R() < 0.5 ? 'pebble' : 'coconut');
      if (world.bodies.length >= MAX_BODIES) {   // recycle the oldest free body
        const i = world.bodies.findIndex((b) => b.state === 'free');
        if (i < 0) return null;
        world.bodies.splice(i, 1);
      }
      let x = 0, z = 0;
      for (let tries = 0; tries < 200; tries++) {
        x = (R() * 2 - 1) * (HALF - 0.35); z = (R() * 2 - 1) * (HALF - 0.35);
        if (water.isWet(x, z) && water.level - terrainH(x, z) > 0.45 && PALM_INFO.every((P) => Math.hypot(P.x - x, P.z - z) > 0.5)) break;
      }
      const r = kind === 'pebble' ? 0.075 + 0.025 * R() : 0.105 + 0.01 * R();
      const b = makeBody(kind, r, [x, 2.7, z]);
      b.color = (R() * 4) | 0;
      b.w = [(R() - 0.5) * 4, (R() - 0.5) * 4, (R() - 0.5) * 4];
      world.bodies.push(b);
      return b;
    };

    function splash(b, speed) {
      const imp = (speed * b.rho * b.Vs) / 0.01, x = b.p[0], z = b.p[2];
      water.addVolume(x, z, -0.3 * speed * b.Vs, b.r * 1.6);
      const nb = Math.min(24, 6 + Math.round(imp * 2.5)), surf = water.level + water.height(x, z);
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * 6.283 + R() * 0.5, rr = b.r * (0.8 + 0.6 * R());
        bubbles.emit(x + Math.cos(a) * rr, surf - 0.03 - R() * 0.12, z + Math.sin(a) * rr, 0.006 + 0.012 * R());
      }
      const k = clamp(imp * 0.12, 0, 1.2), hv = Math.hypot(b.v[0], b.v[2]) || 1;
      block.kick([(b.v[0] / hv) * 0.4 * k + (R() - 0.5) * 0.1 * k, (b.v[2] / hv) * 0.4 * k + (R() - 0.5) * 0.1 * k], -k);
      b.sqv += Math.min(speed, 6) * 0.2;
      world.events.push({ type: 'splash', kind: b.kind, speed, x, z });
    }
    function submerged(b) {
      const surf = water.level + water.height(b.p[0], b.p[2]), d = clamp(surf - (b.p[1] - b.r), 0, 2 * b.r);
      return (Math.PI * d * d * (3 * b.r - d)) / 3;
    }
    function detach(b) {
      if (b.state !== 'crown') return;
      const s = palms.st[b.palm];
      b.state = 'free'; b.v = [s.bv[0] * 0.9, 0, s.bv[1] * 0.9]; b.sleep = false; b.still = 0;
      b.palm = -1; b.spot = -1;
    }
    world.detach = detach;

    function stepBody(b, dt) {
      if (b.state === 'crown') {
        const prev = b.p.slice();
        palms.spot(b.palm, b.spot, b.p);
        for (let k = 0; k < 3; k++) b.v[k] = (b.p[k] - prev[k]) / dt;
        if (palms.st[b.palm].fling > 2.1) detach(b);
        return;
      }
      const V = submerged(b);
      b.dV += V - b.sub;
      if (b.state === 'held') { b.sub = V; return; }
      if (b.sleep) {
        const wake = Math.hypot(block.v[0], block.v[1]) > 0.025 || (V > 0 && Math.abs(water.height(b.p[0], b.p[2]) - b.hSleep) > 0.012);
        if (!wake) { b.sub = V; return; }
        b.sleep = false; b.still = 0;
      }
      const g = block.g;
      let ax = g[0], ay = g[1], az = g[2];
      if (V > 0) {
        water.grad(b.p[0], b.p[2], tmpG);
        const nl = Math.hypot(tmpG[0], 1, tmpG[1]), frac = V / b.Vs, buoy = (frac * G) / b.rho;
        ax += (-tmpG[0] / nl) * buoy; ay += (1 / nl) * buoy; az += (-tmpG[1] / nl) * buoy;
        water.flow(b.p[0], b.p[2], tmpF);
        const rx = b.v[0] - tmpF[0], ry = b.v[1], rz = b.v[2] - tmpF[1], rs = Math.hypot(rx, ry, rz);
        const c = (3.2 + 1.2 * rs) * frac;
        ax -= rx * c; ay -= ry * (c + 4 * frac); az -= rz * c;
        b.w[0] *= 1 - 2 * frac * dt; b.w[1] *= 1 - 2 * frac * dt; b.w[2] *= 1 - 2 * frac * dt;
        if (frac > 0.999 && b.rho > 1 && rs > 0.25 && R() < dt * 22)   // sinking pebbles trail bubbles
          bubbles.emit(b.p[0] + (R() - 0.5) * b.r, b.p[1] + b.r * 0.6, b.p[2] + (R() - 0.5) * b.r, 0.005 + 0.007 * R());
      }
      const p0 = b.p[0], p1 = b.p[1], p2 = b.p[2];
      b.v[0] += ax * dt; b.v[1] += ay * dt; b.v[2] += az * dt;
      b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
      if (V > 0) { if (b.airT > 0.2 && b.v[1] < -1.2) splash(b, -b.v[1]); b.airT = 0; } else b.airT += dt;   // once per entry
      b.sub = V;
      // sand: restitution, rolling resistance
      b.sandT += dt;
      const th = terrainH(b.p[0], b.p[2]);
      if (b.p[1] - b.r < th + 0.02) {
        const n = terrainNormal(b.p[0], b.p[2], tmpN), dist = (b.p[1] - th) * n[1], pen = b.r - dist;
        if (pen > 0) {
          b.p[0] += n[0] * pen; b.p[1] += n[1] * pen; b.p[2] += n[2] * pen;
          let vn = b.v[0] * n[0] + b.v[1] * n[1] + b.v[2] * n[2];
          if (vn < 0) {
            const bounce = -vn > 0.7 ? 1 + b.e : 1;
            b.v[0] -= n[0] * vn * bounce; b.v[1] -= n[1] * vn * bounce; b.v[2] -= n[2] * vn * bounce;
            if (-vn > 1.5) {
              b.sqv += Math.min(-vn, 6) * 0.22;
              if (V <= 0) { const k = clamp((-vn * b.m) / 0.01 * 0.05, 0, 0.6); block.kick([0, 0], -k); }
              world.events.push({ type: 'land', kind: b.kind, speed: -vn });
            }
          }
          // rolling: the tangential pull acts on a rolling sphere at 5/7, against a Coulomb-like resistance
          const an = -(ax * n[0] + ay * n[1] + az * n[2]);
          const at0 = ax + an * n[0], at1 = ay + an * n[1], at2 = az + an * n[2];
          b.v[0] -= at0 * (2 / 7) * dt; b.v[1] -= at1 * (2 / 7) * dt; b.v[2] -= at2 * (2 / 7) * dt;
          vn = b.v[0] * n[0] + b.v[1] * n[1] + b.v[2] * n[2];
          const vt0 = b.v[0] - n[0] * vn, vt1 = b.v[1] - n[1] * vn, vt2 = b.v[2] - n[2] * vn, vt = Math.hypot(vt0, vt1, vt2);
          const dec = b.mu * 0.55 * Math.max(0, an) * dt;
          const s = vt <= dec ? 1 : dec / vt;
          b.v[0] -= vt0 * s; b.v[1] -= vt1 * s; b.v[2] -= vt2 * s;
          if (s === 1) {   // static: keep the old tangential position (pushing out along n would creep downhill)
            const dn = (b.p[0] - p0) * n[0] + (b.p[1] - p1) * n[1] + (b.p[2] - p2) * n[2];
            b.p[0] = p0 + n[0] * dn; b.p[1] = p1 + n[1] * dn; b.p[2] = p2 + n[2] * dn;
          }
          // roll without slipping
          const wr = 1 / b.r;
          b.w[0] = (n[1] * b.v[2] - n[2] * b.v[1]) * wr; b.w[1] = (n[2] * b.v[0] - n[0] * b.v[2]) * wr; b.w[2] = (n[0] * b.v[1] - n[1] * b.v[0]) * wr;
          b.sandT = 0;
        }
      }
      // the four inner walls
      for (const k of [0, 2]) {
        const lim = HALF - b.r;
        if (b.p[k] > lim) { b.p[k] = lim; if (b.v[k] > 0) b.v[k] *= -b.e; }
        else if (b.p[k] < -lim) { b.p[k] = -lim; if (b.v[k] < 0) b.v[k] *= -b.e; }
      }
      // palm trunks (capsules)
      for (let k = 0; k < PALM_INFO.length; k++) {
        const P = PALM_INFO[k], a = P.base, c = palms.crownPos(k, tmpS);
        const ex = c[0] - a[0], ey = c[1] - a[1], ez = c[2] - a[2], l2 = ex * ex + ey * ey + ez * ez;
        const t = clamp(((b.p[0] - a[0]) * ex + (b.p[1] - a[1]) * ey + (b.p[2] - a[2]) * ez) / l2, 0, 1);
        const dx = b.p[0] - (a[0] + ex * t), dy = b.p[1] - (a[1] + ey * t), dz = b.p[2] - (a[2] + ez * t), d = Math.hypot(dx, dy, dz), rr = b.r + 0.065;
        if (d < rr && d > 1e-6) {
          const nx = dx / d, ny = dy / d, nz = dz / d;
          b.p[0] += nx * (rr - d); b.p[1] += ny * (rr - d); b.p[2] += nz * (rr - d);
          const vn = b.v[0] * nx + b.v[1] * ny + b.v[2] * nz;
          if (vn < 0) {
            b.v[0] -= nx * vn * 1.3; b.v[1] -= ny * vn * 1.3; b.v[2] -= nz * vn * 1.3;
            const s = palms.st[k], push = -vn * b.m * 18 * t;
            s.bv[0] -= nx * push; s.bv[1] -= nz * push;
          }
        }
      }
      // spin
      if (b.sandT > 0) { const dmp = 1 - 0.3 * dt; b.w[0] *= dmp; b.w[1] *= dmp; b.w[2] *= dmp; }
      const [qx, qy, qz, qw] = b.q, [wx, wy, wz] = b.w, h = 0.5 * dt;
      b.q[0] = qx + h * (wx * qw + wy * qz - wz * qy); b.q[1] = qy + h * (wy * qw + wz * qx - wx * qz);
      b.q[2] = qz + h * (wz * qw + wx * qy - wy * qx); b.q[3] = qw - h * (wx * qx + wy * qy + wz * qz);
      const ql = Math.hypot(...b.q); for (let k = 0; k < 4; k++) b.q[k] /= ql;
      // sleep when calm
      const sp = Math.hypot(b.v[0], b.v[1], b.v[2]);
      if (sp < 0.035 && (b.sandT < 0.05 || V > 0)) {
        if ((b.still += dt) > 0.7) { b.sleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0]; b.hSleep = water.height(b.p[0], b.p[2]); }
      } else b.still = 0;
    }

    function collidePairs() {
      const bs = world.bodies;
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        if (a.state === 'held' || b.state === 'held' || (a.state === 'crown' && b.state === 'crown')) continue;
        const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2], d = Math.hypot(dx, dy, dz), rr = a.r + b.r;
        if (d >= rr || d < 1e-6) continue;
        if (a.sleep && b.sleep) continue;
        const nx = dx / d, ny = dy / d, nz = dz / d;
        const ia = a.state === 'crown' ? 0 : 1 / a.m, ib = b.state === 'crown' ? 0 : 1 / b.m, it = ia + ib;
        if (!it) continue;
        const pen = rr - d;
        a.p[0] -= nx * pen * ia / it; a.p[1] -= ny * pen * ia / it; a.p[2] -= nz * pen * ia / it;
        b.p[0] += nx * pen * ib / it; b.p[1] += ny * pen * ib / it; b.p[2] += nz * pen * ib / it;
        const vn = (b.v[0] - a.v[0]) * nx + (b.v[1] - a.v[1]) * ny + (b.v[2] - a.v[2]) * nz;
        if (vn < 0) {
          if (a.state === 'crown' && -vn > 1.0) detach(a);
          if (b.state === 'crown' && -vn > 1.0) detach(b);
          const ia2 = a.state === 'crown' ? 0 : 1 / a.m, ib2 = b.state === 'crown' ? 0 : 1 / b.m, j = (-1.3 * vn) / (ia2 + ib2 || 1);
          a.v[0] -= nx * j * ia2; a.v[1] -= ny * j * ia2; a.v[2] -= nz * j * ia2;
          b.v[0] += nx * j * ib2; b.v[1] += ny * j * ib2; b.v[2] += nz * j * ib2;
          if (-vn > 0.15) { a.sleep = false; a.still = 0; b.sleep = false; b.still = 0; }
        }
        if (a.sleep !== b.sleep) { a.sleep = false; b.sleep = false; }
      }
    }

    let acc = 0, tick = 0, shimmer = 0.5;
    function stepTick() {
      const dtb = 1 / 240;
      if (tick % 2 === 0) {   // 120 Hz: block, palms, the sea, bubbles
        const dtw = 1 / 120;
        block.step(dtw, world.firm, world.reduced);
        palms.step(dtw, block, world.time, !world.reduced);
        for (const b of world.bodies) if (Math.abs(b.dV) > 1e-8) { water.addVolume(b.p[0], b.p[2], b.dV, b.r * 1.1); b.dV = 0; }
        const f = (0.6 * water.g()) / G;
        water.step(dtw, block.g[0] * f, block.g[2] * f);
        if (!world.reduced && (shimmer -= dtw) < 0) {   // idle shimmer: the sea is never dead flat
          shimmer = 0.25 + R() * 0.9;
          for (let t = 0; t < 10; t++) {
            const x = (R() * 2 - 1) * (HALF - 0.1), z = (R() * 2 - 1) * (HALF - 0.1);
            if (water.isWet(x, z)) { water.addVolume(x, z, (R() < 0.5 ? -1 : 1) * 0.00018, 0.06); break; }
          }
        }
        bubbles.step(dtw, world.time);
      }
      for (const b of world.bodies) stepBody(b, dtb);
      collidePairs();
      for (const b of world.bodies) {   // visual squash spring
        b.sqv += dtb * (-600 * b.sq - 16 * b.sqv);
        b.sq = clamp(b.sq + dtb * b.sqv, -0.12, 0.2);
      }
      tick++; world.time += dtb;
    }
    world.advance = (dt) => {
      acc += Math.min(dt, 0.1);
      let n = 0;
      while (acc >= 1 / 240 && n < 8) { stepTick(); acc -= 1 / 240; n++; }
      if (n === 8) acc = 0;   // the max catch-up per frame: drop the rest
    };
    world.stepFrames = (frames) => { for (let i = 0; i < frames * 4; i++) stepTick(); };

    world.tally = () => {
      const t = { afloat: 0, sunk: 0, ashore: 0 };
      for (const b of world.bodies) {
        if (b.state === 'crown') { t.ashore++; continue; }
        if (b.state === 'held') continue;
        const onSand = b.sandT < 0.1 || (b.sleep && b.sandT < 1);
        if (onSand && b.sub >= b.Vs * 0.995) t.sunk++;
        else if (b.sub > 0 && !onSand) t.afloat++;
        else if (onSand) t.ashore++;
      }
      return t;
    };

    // ----- picking (block-local ray) -----
    function raySphere(o, d, c, r) {
      const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2], b = ox * d[0] + oy * d[1] + oz * d[2], cc = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - cc;
      if (disc < 0) return Infinity;
      const t = -b - Math.sqrt(disc);
      return t > 0 ? t : Infinity;
    }
    world.pick = (o, d) => {
      let tb = Infinity, body = null, tp = Infinity, palm = -1;
      for (const b of world.bodies) {
        if (b.state === 'held') continue;
        const t = raySphere(o, d, b.p, b.r * 1.35);
        if (t < tb) { tb = t; body = b; }
      }
      for (let k = 0; k < PALM_INFO.length; k++) {
        const c = palms.crownPos(k, [0, 0, 0]);
        let t = raySphere(o, d, [c[0], c[1] - 0.04, c[2]], 0.36);
        const P = PALM_INFO[k];
        for (let s = 0.15; s < 0.95; s += 0.2) {
          const a = P.at(s), w = s * s, bb = palms.st[k].b;
          t = Math.min(t, raySphere(o, d, [a[0] + bb[0] * w, a[1], a[2] + bb[1] * w], 0.1));
        }
        if (t < tp) { tp = t; palm = k; }
      }
      if (body && (palm < 0 || tb <= tp + 0.4)) return { kind: 'body', body, t: tb };
      if (palm >= 0) return { kind: 'palm', palm, t: tp };
      return pickBlock(o, d, { half: HALF, top: water.level + 0.5, terrainH, water });   // the water top, or the block's sides and sand
    };
    world.grab = (b) => { detach(b); b.state = 'held'; b.sleep = false; b.still = 0; b.v = [0, 0, 0]; };
    world.hold = (b, p, v) => {
      const lim = HALF - b.r;
      b.p[0] = clamp(p[0], -lim, lim); b.p[2] = clamp(p[2], -lim, lim);
      b.p[1] = Math.max(p[1], terrainH(b.p[0], b.p[2]) + b.r, -1);
      if (v) b.v = v.slice();
    };
    world.throw = (b, v) => {
      const s = Math.hypot(v[0], v[1], v[2]), k = s > 7 ? 7 / s : 1;
      b.state = 'free'; b.v = [v[0] * k, v[1] * k, v[2] * k]; b.sleep = false; b.still = 0;
      b.w = [(R() - 0.5) * 6, (R() - 0.5) * 6, (R() - 0.5) * 6];   // (the world's own random: the same throw spins the same way)
    };
    /** Body instance data: (p, r), q, (colour index, kind), (squash). */
    world.packBodies = (out) => {
      world.bodies.forEach((b, i) => {
        const o = 16 * i;
        out[o] = b.p[0]; out[o + 1] = b.p[1]; out[o + 2] = b.p[2]; out[o + 3] = b.r;
        out[o + 4] = b.q[0]; out[o + 5] = b.q[1]; out[o + 6] = b.q[2]; out[o + 7] = b.q[3];
        out[o + 8] = b.color; out[o + 9] = b.kind === 'coconut' ? 1 : 0; out[o + 10] = b.id; out[o + 11] = 0;
        out[o + 12] = b.sq; out[o + 13] = 0; out[o + 14] = 0; out[o + 15] = 0;
      });
      return world.bodies.length;
    };
    world.reset();
    return world;
  }

  return { HALF, SIDE, WL0, BLOCK_H, GN, GDX, TILT_MAX, G, ISLE, ROCKS, PALM_INFO, MAX_BODIES,
    terrainH, terrainNormal, terrainGrid, rockMask, palmMesh, createWater, createBlock, createWorld, clamp, ss, rng };
})();
