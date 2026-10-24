// Iceberg Jelly — the ice. Every piece is a rigid floater (@lid/diorama: floaters.js): a star-shaped faceted
// mesh (a superellipsoid, plus lobes, plus two octaves of noise) and, inside it, a lattice of spheres that carry
// its buoyancy and drag and make its contacts. Tabular, dome, pinnacle and wedge bergs, growlers, pancake floes,
// and the slabs that stand along the glacier's cliff: about once a minute one breaks off with a crack, a puff of
// ice dust, a splash and a wave, then capsizes until it finds a stable way up. The glacier slowly pushes a new
// slab out; old slabs melt away. Everything is settled at load so nothing capsizes at the start. The icebreaker
// breaks the thin pancake floes she runs into: each goes into shards that drift aside and melt, and a new
// pancake freezes somewhere in open water a minute or two later.
import { ICO, MAT } from '@lid/diorama/parts.js';
import { I } from './layout.js';

// ----- shapes -----
function noise3(R) {   // a smooth random field on the unit sphere: a sum of random lobes
  const L = Array.from({ length: 10 }, () => { const z = R() * 2 - 1, a = R() * 6.283, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a), R() * 2 - 1]; });
  return (u, sharp) => { let v = 0; for (const [x, y, z, w] of L) v += w * Math.max(0, x * u[0] + y * u[1] + z * u[2]) ** sharp; return v / 3; };
}
const KINDS = {
  tabular: { ax: [0.3, 0.075, 0.24], e1: 0.22, e2: 0.45, lobes: 3, la: 0.06, n: [0.05, 0.025], rho: 0.66, col: '#e4f0f6' },
  dome: { ax: [0.17, 0.12, 0.16], e1: 0.9, e2: 0.9, lobes: 4, la: 0.14, n: [0.08, 0.04], rho: 0.68, col: '#e2eff6', flatBase: 0.72 },
  pinnacle: { ax: [0.13, 0.1, 0.11], e1: 0.8, e2: 0.8, lobes: 0, la: 0, n: [0.08, 0.04], rho: 0.64, col: '#e6f1f7', spires: 2 },
  wedge: { ax: [0.2, 0.09, 0.12], e1: 0.4, e2: 0.6, lobes: 2, la: 0.08, n: [0.06, 0.03], rho: 0.66, col: '#e0edf4', slope: 0.5 },
  growler: { ax: [0.06, 0.045, 0.055], e1: 0.8, e2: 0.8, lobes: 3, la: 0.2, n: [0.12, 0.05], rho: 0.76, col: '#d8eaf3' },
  pancake: { ax: [0.11, 0.016, 0.11], e1: 0.12, e2: 1.0, lobes: 0, la: 0, n: [0.05, 0.02], rho: 0.55, col: '#eef3f3' },
  slab: { ax: [0.125, 0.2, 0.06], e1: 0.2, e2: 0.25, lobes: 2, la: 0.05, n: [0.05, 0.025], rho: 0.7, col: '#e2eff6' },
};
/** A piece's shape: its radius along any direction, from its kind and a seed. */
function shapeOf(kind, seed, size = 1) {
  const K = KINDS[kind], R = I.rng(seed), N1 = noise3(R), N2 = noise3(R);
  const ax = K.ax.map((a) => a * size * (0.85 + 0.3 * R()));
  const lobes = Array.from({ length: K.lobes }, () => { const z = R() * 1.2 - 0.6, a = R() * 6.283, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a), K.la * (0.6 + 0.8 * R())]; });
  const spires = Array.from({ length: K.spires || 0 }, (_, k) => { const a = R() * 6.283, t = 0.25 + 0.2 * R(), v = [Math.cos(a) * t, 1, Math.sin(a) * t], l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l, 0.7 + 0.5 * R() - k * 0.25]; });
  const radius = (u) => {
    const x = Math.abs(u[0] / ax[0]), y = Math.abs(u[1] / (u[1] < 0 && K.flatBase ? ax[1] * K.flatBase : ax[1])), z = Math.abs(u[2] / ax[2]);
    let r = Math.pow(Math.pow(Math.pow(x, 2 / K.e2) + Math.pow(z, 2 / K.e2), K.e2 / K.e1) + Math.pow(y, 2 / K.e1), -K.e1 / 2);
    for (const [lx, ly, lz, a] of lobes) r *= 1 + a * Math.max(0, lx * u[0] + ly * u[1] + lz * u[2]) ** 4;
    for (const [lx, ly, lz, a] of spires) r *= 1 + a * Math.max(0, lx * u[0] + ly * u[1] + lz * u[2]) ** 10;
    if (K.slope) r *= 1 + K.slope * u[0] * Math.max(0, u[1]);
    return r * (1 + K.n[0] * N1(u, 2) + K.n[1] * N2(u, 6));
  };
  return { radius, ax };
}
/** The faceted mesh's points and faces, and the sphere lattice inside it. */
function realise(S, cap = 34) {
  const ico = ICO[2], P = ico.P.map((u) => { const r = S.radius(u); return [u[0] * r, u[1] * r, u[2] * r]; });
  // the sphere lattice: as fine as the thinnest side allows, no more than about thirty
  const mn = Math.min(...S.ax), mx = Math.max(...S.ax.map((a, k) => a * (k === 1 ? 1.6 : 1.15)));
  let h = Math.max(mn * 0.8, mx / 4.2), spheres = [];
  for (let tries = 0; tries < 6; tries++) {
    spheres = [];
    const rs = h * 0.62;
    for (let x = -mx; x <= mx; x += h) for (let y = -mx; y <= mx; y += h) for (let z = -mx; z <= mx; z += h) {
      const l = Math.hypot(x, y, z);
      if (l < 1e-6 || l + rs * 0.7 < S.radius([x / l, y / l, z / l]) * 0.97) spheres.push([x, y, z, rs]);
    }
    if (spheres.length <= cap && spheres.length > 0) break;
    h *= spheres.length > cap ? 1.18 : 0.85;
  }
  if (cap < 20) {   // a flat floe: a centre and a ring in its plane
    const a = Math.min(S.radius([1, 0, 0]), S.radius([0, 0, 1])), rs = Math.max(S.ax[1] * 1.2, a * 0.3);
    spheres = [[0, 0, 0, rs]];
    for (let k = 0; k < 7; k++) { const t = (k / 7) * 6.283, r = S.radius([Math.cos(t), 0, Math.sin(t)]) - rs * 0.9; spheres.push([Math.cos(t) * r, 0, Math.sin(t) * r, rs]); }
  }
  if (!spheres.length) spheres.push([0, 0, 0, mn * 0.9]);
  return { P, F: ico.F, spheres };
}
const piece = (kind, seed, size) => ({ ...realise(shapeOf(kind, seed, size), kind === 'pancake' ? 16 : 34), kind, rho: KINDS[kind].rho, col: KINDS[kind].col });
/** The pack at load, the pool of slabs (parts reused as slabs calve and melt), and the bits a calving knocks off. */
export const PACK = (() => {
  const R = I.rng(31), kinds = ['tabular', 'tabular', 'tabular', 'dome', 'dome', 'pinnacle', 'pinnacle', 'wedge', ...Array(6).fill('growler'), ...Array(8).fill('pancake')];
  return kinds.map((kind, k) => piece(kind, 100 + k, kind === 'pancake' ? 0.85 + 0.4 * R() : 1));
})();
export const SLAB_POOL = 7, BIT_POOL = 6, SHARD_POOL = 8;
export const SLABS = Array.from({ length: SLAB_POOL }, (_, k) => piece('slab', 500 + k, 1));
export const BITS = Array.from({ length: BIT_POOL }, (_, k) => piece('growler', 700 + k, 0.8));
export const SHARDS = Array.from({ length: SHARD_POOL }, (_, k) => piece('pancake', 900 + k, 0.42 + 0.03 * (k % 4)));   // a broken pancake's pieces

/** Build every piece's part; returns the part numbers in the order PACK, SLABS, BITS, SHARDS. */
export function buildIce(B) {
  const ids = [];
  for (const D of [...PACK, ...SLABS, ...BITS, ...SHARDS]) {
    ids.push(B.newPart());
    B.col(D.col).mat(MAT.ICE);
    for (const [a, b, c] of D.F) B.facet(D.P[a], D.P[b], D.P[c]);
  }
  return ids;
}

// ----- the ice in the bay -----
const OPEN_WATER = (x, z) => I.terrainH(x, z) < I.SL - 0.22;
const tN = [0, 0, 0], tU = [0, 0, 0];
/** o: { floaters, water, foam, bubbles, puff(p, kind), rand, events } */
export function createIce({ floaters: F, water, foam, bubbles, puff, rand: R, events }) {
  const all = [...PACK, ...SLABS, ...BITS, ...SHARDS], SHARD0 = PACK.length + SLAB_POOL + BIT_POOL;
  const ICE = { pieces: [], slots: [], calved: 0, capsized: 0, broken: 0, refreeze: [], nextCalve: 60, auto: true, breaker: null };
  const make = (k, p, q) => {
    const D = all[k], body = F.add({ spheres: D.spheres, rho: D.rho, p, q, mu: 0.35, e: 0.15 });
    const pc = { k, body, kind: D.kind, born: 0, melts: false, upRef: [0, 1, 0], calm: 0, groaned: false, falling: false, slab: false };
    body.piece = pc;
    ICE.pieces.push(pc);
    return pc;
  };
  const cliff = (x) => [x, I.SL + 0.1, I.GZ + 0.062];   // a slab standing at the cliff (its middle)
  const free = (k0, n) => { for (let k = k0; k < k0 + n; k++) if (!ICE.pieces.some((p) => p.k === k)) return k; return -1; };
  function place(p, x, e) {   // a slab coming out of the cliff: e from 0 (inside it) to 1 (standing proud)
    const c = cliff(x);
    p.body.p = [c[0], c[1], c[2] - (1 - e) * 0.13];
    p.body.q = [0, 0, 0, 1];
  }
  function hold(k, x, e) {
    const p = make(k, cliff(x), [0, 0, 0, 1]);
    F.grab(p.body); p.slab = true;
    place(p, x, e);
    return p;
  }

  ICE.reset = () => {
    for (const p of ICE.pieces) F.remove(p.body);
    ICE.pieces = []; ICE.calved = 0; ICE.capsized = 0; ICE.broken = 0; ICE.refreeze = []; ICE.nextCalve = 60;
    // the pack: scattered over the open bay, clear of the berth, the cliff and each other
    PACK.forEach((D, k) => {
      const rad = Math.max(...D.spheres.map((s) => Math.hypot(s[0], s[1], s[2]) + s[3]));
      for (let t = 0; t < 400; t++) {
        const x = -2.2 + R() * 4.4, z = -0.3 + R() * 2.75;
        if (!OPEN_WATER(x, z) || !OPEN_WATER(x + rad, z) || !OPEN_WATER(x - rad, z) || !OPEN_WATER(x, z + rad) || !OPEN_WATER(x, z - rad)) continue;
        if (z < 0.15 && x > 0.6) continue;                                         // the berth and the ship's way out
        if (Math.abs(x - I.GX) < 0.8 && z < I.GZ + 0.45) continue;                  // under the cliff
        if (ICE.pieces.some((p) => Math.hypot(p.body.p[0] - x, p.body.p[2] - z) < p.body.rad + rad + 0.04)) continue;
        const a = R() * 6.283;
        make(k, [x, I.SL - 0.01, z], [0, Math.sin(a / 2), 0, Math.cos(a / 2)]);
        break;
      }
    });
    // three slabs at the cliff, standing ready
    ICE.slots = I.SLABS.map((x, i) => ({ x, piece: hold(PACK.length + i, x, 1), emerge: 1, wait: 0 }));
  };
  /** Is a slab standing ready to fall? */
  ICE.ready = () => ICE.slots.some((s) => s.piece && s.emerge >= 1);
  /** Break a slab off the cliff (one standing ready, or a given slot). */
  ICE.calve = (slot = -1) => {
    const ready = ICE.slots.filter((s) => s.piece && s.emerge >= 1);
    if (!ready.length) return false;
    const s = slot >= 0 && ready.includes(ICE.slots[slot]) ? ICE.slots[slot] : ready[(R() * ready.length) | 0];
    const p = s.piece, b = p.body;
    s.piece = null; s.wait = 14 + R() * 10;
    F.throw(b, [(R() - 0.5) * 0.05, -0.02, 0.14]);
    b.w = [1.3 + R() * 0.5, (R() - 0.5) * 0.3, (R() - 0.5) * 0.4];   // the top topples out, away from the cliff
    p.slab = false; p.born = 0; p.melts = true; p.falling = true; p.upRef = [0, 1, 0]; p.calm = 0; p.groaned = false;
    ICE.calved++; ICE.nextCalve = 50 + R() * 25;
    events.push({ type: 'crack', x: b.p[0], z: b.p[2] });
    for (let k = 0; k < 7; k++) puff([b.p[0] + (R() - 0.5) * 0.2, I.SL + 0.28 + R() * 0.06, b.p[2] - 0.04 + R() * 0.05], 'dust');
    for (let n = 0; n < 2 && R() < 0.8; n++) {   // a bit or two breaks off with it
      const k = free(PACK.length + SLAB_POOL, BIT_POOL);
      if (k < 0) break;
      const g = make(k, [b.p[0] + (R() - 0.5) * 0.2, I.SL + 0.2 + R() * 0.1, b.p[2] + 0.05], [0, 0, 0, 1]);
      g.melts = true; g.body.v = [(R() - 0.5) * 0.2, 0, 0.2 + R() * 0.2]; g.body.w = [R() * 4, R() * 4, R() * 4];
    }
    return true;
  };
  /** The icebreaker runs into a pancake: it breaks into shards pushed aside, off her bow (u: the hull's velocity there). */
  function breakUp(p, u) {
    const b = p.body, sp = Math.hypot(u[0], u[2]) || 1, side = [-u[2] / sp, u[0] / sp], at = b.p.slice();
    F.remove(b); ICE.pieces.splice(ICE.pieces.indexOf(p), 1);
    ICE.refreeze.push({ k: p.k, t: 60 + R() * 60 }); ICE.broken++;
    for (let i = 0; i < 3; i++) {
      const k = free(SHARD0, SHARD_POOL);
      if (k < 0) break;
      const s = i - 1 + (R() - 0.5) * 0.4, a = R() * 6.283;
      const g = make(k, [at[0] + side[0] * s * 0.07 + (R() - 0.5) * 0.03, I.SL, at[2] + side[1] * s * 0.07 + (R() - 0.5) * 0.03], [0, Math.sin(a / 2), 0, Math.cos(a / 2)]);
      g.melts = true; g.shard = true;
      g.body.v = [side[0] * (s || 0.5) * 0.18 + u[0] * 0.5, 0.05, side[1] * (s || 0.5) * 0.18 + u[2] * 0.5]; g.body.w = [(R() - 0.5) * 2, (R() - 0.5) * 3, (R() - 0.5) * 2];
    }
    events.push({ type: 'snap', x: at[0], z: at[2] });
    foam.add(at[0], at[2], 0.7, 0.12);
    for (let i = 0; i < 4; i++) puff([at[0] + (R() - 0.5) * 0.12, I.SL + 0.03 + R() * 0.04, at[2] + (R() - 0.5) * 0.12], 'spray');
  }
  function refreeze(r) {   // a new pancake forming in open water, clear of the ice and the ship: it grows from a thin skin
    for (let t = 0; t < 60; t++) {
      const x = -2.2 + R() * 4.4, z = -0.3 + R() * 2.75, rad = 0.13;
      if (!OPEN_WATER(x, z) || !OPEN_WATER(x + rad, z) || !OPEN_WATER(x - rad, z) || !OPEN_WATER(x, z + rad) || !OPEN_WATER(x, z - rad)) continue;
      if (ICE.pieces.some((p) => Math.hypot(p.body.p[0] - x, p.body.p[2] - z) < p.body.rad + rad + 0.06)) continue;
      if (ICE.breaker && ICE.breaker.near(x, z) < 0.6) continue;
      const a = R() * 6.283, p = make(r.k, [x, I.SL - 0.005, z], [0, Math.sin(a / 2), 0, Math.cos(a / 2)]);
      p.grow = 0; F.scale(p.body, 0.3);
      return true;
    }
    return false;
  }
  function splashAt(x, z, k) {   // a plunge: a hole in the water and a ring of spray, foam, bubbles
    water.addVolume(x, z, -0.012 * k, 0.12);
    water.addVolume(x, z, 0.006 * k, 0.3);
    foam.add(x, z, 0.9, 0.18 + 0.1 * k);
    for (let i = 0; i < 10; i++) { const a = R() * 6.283, d = 0.05 + R() * 0.15; puff([x + Math.cos(a) * d, I.SL + 0.03 + R() * 0.08, z + Math.sin(a) * d], 'spray'); }
    for (let i = 0; i < 18; i++) bubbles.emit(x + (R() - 0.5) * 0.3, I.SL - 0.05 - R() * 0.15, z + (R() - 0.5) * 0.3, 0.006 + 0.014 * R());
    events.push({ type: 'splash', x, z, speed: 2 + k });
  }

  ICE.step = (dt) => {
    // the glacier pushes new slabs out into empty places
    for (const s of ICE.slots) {
      if (!s.piece) {
        if ((s.wait -= dt) > 0) continue;
        const k = free(PACK.length, SLAB_POOL);
        if (k < 0) continue;
        s.piece = hold(k, s.x, 0); s.emerge = 0;
      } else if (s.emerge < 1) { s.emerge = Math.min(1, s.emerge + dt / 30); place(s.piece, s.x, s.emerge); }
    }
    if (ICE.auto && (ICE.nextCalve -= dt) < 0) { if (!ICE.calve()) ICE.nextCalve = 5; }
    for (const r of [...ICE.refreeze]) if ((r.t -= dt) < 0) { if (refreeze(r)) ICE.refreeze.splice(ICE.refreeze.indexOf(r), 1); else r.t = 5; }
    for (const p of [...ICE.pieces]) {
      if (p.slab) continue;
      const b = p.body;
      p.born += dt;
      if (p.grow !== undefined && p.grow < 1) { p.grow = Math.min(1, p.grow + dt / 15); F.scale(b, 0.3 + 0.7 * p.grow); }
      // a whole pancake the icebreaker drives into breaks up
      if (ICE.breaker && p.kind === 'pancake' && !p.shard && b.scale > 0.95 && b.state !== 'held') {
        const pen = ICE.breaker.press(b.p[0], b.p[1], b.p[2], b.rad, tN, tU);   // her hull into its edge
        p.press = pen > 0.004 && Math.hypot(tU[0], tU[2]) > 0.1 ? (p.press || 0) + dt : 0;   // shoved by her bow for a moment: it gives
        if (p.press > 0.25 && all.slice(SHARD0).filter((_, i) => !ICE.pieces.some((q) => q.k === SHARD0 + i)).length >= 2) { breakUp(p, tU.slice()); continue; }   // (while there are shards to break into)
      }
      // a falling slab: the plunge as it tips toward the flat
      const up = F.up(b), cos = up[0] * p.upRef[0] + up[1] * p.upRef[1] + up[2] * p.upRef[2];
      if (p.falling && cos < 0.55) { p.falling = false; splashAt(b.p[0], b.p[2], 1.2); }
      // capsizing: a groan as it goes over; counted when it settles a new way up
      const spin = Math.hypot(...b.w);
      if (!p.groaned && cos < 0.7 && spin > 0.6) { p.groaned = true; events.push({ type: 'groan', x: b.p[0], z: b.p[2] }); }
      if (b.state !== 'held' && spin < 0.08 && Math.hypot(...b.v) < 0.05) {
        if ((p.calm += dt) > 1.2) {
          if (cos < 0.34) { ICE.capsized++; events.push({ type: 'capsize', x: b.p[0], z: b.p[2] }); }
          p.upRef = up; p.groaned = false; p.calm = 0;
        }
      } else p.calm = 0;
      // old slabs and bits melt away
      if (p.melts) {
        const life = p.kind === 'slab' ? 150 : 60, k = 1 - 0.65 * Math.min(1, Math.max(0, (p.born - life * 0.4) / (life * 0.6)));
        if (Math.abs(k - b.scale) > 0.01) F.scale(b, k);
        if (p.born > life) { F.remove(b); ICE.pieces.splice(ICE.pieces.indexOf(p), 1); }
      }
    }
  };
  /** After the pack has had time to find its stable ways up: still it, and take its ways up as its own. */
  ICE.settled = () => {
    for (const p of ICE.pieces) { if (p.slab) continue; const b = p.body; b.v = [0, 0, 0]; b.w = [0, 0, 0]; p.upRef = F.up(b); p.calm = 0; p.groaned = false; }
    ICE.capsized = 0;
  };
  return ICE;
}
