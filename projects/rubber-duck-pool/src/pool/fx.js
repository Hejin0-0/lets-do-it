// Sprites facing the camera (renderer.js's fx layer): the burst a tapped duck throws off (its design's fx: ducks.js),
// the spray where something lands in the water, and by night now and then a shooting star or a few fireworks out over
// the sea. Each flies, floats up or falls, spins, fades out. Page-side and only for show; what makes a noise (a
// rocket's launch, its burst) goes to events, for the sound.
import { srgbToLinear } from '@lid/diorama/math.js';
import { DESIGNS } from './ducks.js';
import { CRITTER_MAX } from './critters.js';

// three vec4 a sprite: (position, size), (colour, alpha), (shape, turn, flap, glow). The last CRITTER_MAX slots are
// the creatures' (critters.js), packed after these.
export const FX_MAX = 1024, FX_FLOATS = 12;
const OWN = FX_MAX - CRITTER_MAX;
const SHAPES = { drop: 0, bubble: 1, heart: 2, star: 3, petal: 4, bolt: 5, spark: 8 };
const SPRAY = srgbToLinear('#eaf8ff'), DROP = srgbToLinear('#bfe8f6'), FIRE = ['#ff5a6e', '#ffd25a', '#6ee0ff', '#b98cff', '#7dffa0', '#fff3e0'].map(srgbToLinear);

/** rand: () -> [0, 1). reduced: no fireworks or shooting stars (they flash). */
export function createFx(rand, reduced = false) {
  const live = [], events = [], rockets = [], meteors = [];
  let nextShow = 40, nextMeteor = 12, queued = 0, nextRocket = 0;
  const add = (q) => { if (live.length < OWN) live.push({ age: 0, turn: 0, spin: 0, glow: 0, alpha: 1, ...q }); };
  /** A glowing spark at p, still or drifting, gone in life seconds: the trail a rocket or a falling star leaves. */
  const ember = (p, size, col, life, v = [0, 0, 0]) => add({ p: p.slice(), v, up: -0.05, life, size, shape: SHAPES.spark, col, glow: 1 });
  function launch() {   // a rocket from the sea off the island's west shore (in the sky of the first view), up to where it bursts
    const at = [-10 + 3 * rand(), 3.5 + 2 * rand(), 5 * rand()];
    rockets.push({ p: [at[0] + (rand() - 0.5), 0.8, at[2]], to: at, t: 0, T: 1.1 + 0.4 * rand(), col: FIRE[Math.floor(rand() * FIRE.length)] });
    events.push({ type: 'launch', x: at[0], y: 0.8, z: at[2] });
  }
  function burst(r) {
    const n = 50 + Math.floor(rand() * 30), col2 = FIRE[Math.floor(rand() * FIRE.length)];
    for (let i = 0; i < n; i++) {
      const u = 2 * rand() - 1, a = rand() * Math.PI * 2, s = 2.4 + 0.6 * rand(), c = Math.sqrt(1 - u * u);
      add({ p: r.to.slice(), v: [c * Math.cos(a) * s, u * s, c * Math.sin(a) * s], up: -0.25, drag: 1.6, life: 1.3 + 0.7 * rand(), size: 0.07 + 0.03 * rand(), shape: SHAPES.spark, col: i % 3 ? r.col : col2, glow: 1, trail: 0 });
    }
    events.push({ type: 'burst', x: r.to[0], y: r.to[1], z: r.to[2] });
  }
  return {
    get count() { return live.length; },
    events,
    /** A burst of design colour's shapes from the duck at p. */
    burst(p, colour) {
      const f = DESIGNS[colour].fx, cols = f.colours.map(srgbToLinear);
      for (let i = 0; i < f.n; i++) {
        const a = rand() * Math.PI * 2, s = 0.35 + rand() * 0.45;
        add({ p: [p[0], p[1] + 0.14, p[2]], v: [Math.cos(a) * s, 0.8 + rand() * 0.9, Math.sin(a) * s], up: f.up, life: 1.1 + rand() * 0.8,
          size: 0.028 + rand() * 0.022, ...(f.shape === 'heart' ? { turn: (rand() - 0.5) * 0.6, spin: 0 } : { turn: rand() * 6.28, spin: (rand() - 0.5) * 7 }), shape: SHAPES[f.shape], col: cols[i % cols.length] });   // hearts stay upright
      }
    },
    /** Spray where something lands in the water at p (speed: how hard it came down): drops thrown up and out, falling back. */
    splash(p, speed) {
      const k = Math.min(1.5, speed);
      for (let i = 0, n = 5 + Math.round(8 * k); i < n; i++) {
        const a = rand() * Math.PI * 2, s = (0.25 + 0.45 * rand()) * k;
        add({ p: [p[0] + Math.cos(a) * 0.04, p[1] + 0.02, p[2] + Math.sin(a) * 0.04], v: [Math.cos(a) * s, (0.9 + 0.9 * rand()) * k, Math.sin(a) * s], up: -1, life: 0.45 + 0.3 * rand(), size: 0.006 + 0.008 * rand(), shape: i % 3 ? SHAPES.drop : SHAPES.bubble, col: i % 3 ? DROP : SPRAY, alpha: 0.7 });   // small, clear: a ring catches the light
      }
    },
    /** The night's shows (night: 0 by day, 1 after dark): a shooting star now and then, a few fireworks every minute or two. */
    show(dt, night) {
      if (reduced || night < 0.7) { queued = 0; return; }
      if ((nextMeteor -= dt) < 0) {   // far up and away, falling slantwise
        const a = rand() * Math.PI * 2, d = 240 + 60 * rand(), dir = rand() < 0.5 ? 1 : -1;
        meteors.push({ p: [Math.cos(a) * d, 110 + 50 * rand(), Math.sin(a) * d], v: [-Math.sin(a) * 260 * dir, -90, Math.cos(a) * 260 * dir], t: 0.5 + 0.4 * rand() });
        nextMeteor = 15 + 25 * rand();
      }
      if ((nextShow -= dt) < 0) { queued = 3 + Math.floor(rand() * 4); nextShow = 60 + 60 * rand(); }
      if (queued && (nextRocket -= dt) < 0) { launch(); queued--; nextRocket = 0.8 + 1.4 * rand(); }
    },
    /** Now, whatever the hour: 'fireworks' (a show) or 'meteor' (one falling star soon). */
    cue(kind) { if (kind === 'fireworks') { queued = 4; nextRocket = 0; } else nextMeteor = 0; },
    step(dt) {
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i], k = Math.min(1, (r.t += dt) / r.T), e = 1 - (1 - k) * (1 - k);   // slowing as it climbs
        const p = [r.p[0] + (r.to[0] - r.p[0]) * e, r.p[1] + (r.to[1] - r.p[1]) * e, r.p[2] + (r.to[2] - r.p[2]) * e];
        ember(p, 0.035, SPRAY, 0.35);
        if (k >= 1) { burst(r); rockets.splice(i, 1); }
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        for (let k = 0; k < 3; k++) m.p[k] += m.v[k] * dt;
        ember(m.p, 1.6, SPRAY, 0.3);
        if ((m.t -= dt) < 0) meteors.splice(i, 1);
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const q = live[i];
        if ((q.age += dt) > q.life) { live.splice(i, 1); continue; }
        if (q.up < 0) { q.v[1] -= 9.8 * 0.45 * -q.up * dt; for (const k of [0, 2]) q.v[k] *= 1 - dt * 0.8; }   // falling, like drops
        else { const e = Math.min(1, dt * 2.5); q.v[0] -= q.v[0] * e; q.v[2] -= q.v[2] * e; q.v[1] += (q.up - q.v[1]) * e; }   // slowing to a float
        if (q.drag) for (let k = 0; k < 3; k++) q.v[k] *= Math.max(0, 1 - dt * q.drag);   // sparks: the air stops them
        if (q.trail !== undefined && (q.trail -= dt) < 0 && q.age < q.life * 0.7) { q.trail = 1 / 40; ember(q.p, q.size * 0.6, q.col, 0.28); }   // each leaves a fading streak
        for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
        q.turn += q.spin * dt;
      }
    },
    /** Write the sprites into buf from base (floats); returns how many. */
    pack(buf, base) {
      live.forEach((q, i) => {
        const t = q.age / q.life, grow = q.glow ? 1 : Math.min(1, q.age / 0.12), o = base + FX_FLOATS * i;
        buf.set([q.p[0], q.p[1], q.p[2], q.size * grow * (1 - 0.3 * t), q.col[0], q.col[1], q.col[2], q.alpha * Math.min(1, (1 - t) / 0.4), q.shape, q.turn, 0, q.glow], o);
      });
      return live.length;
    },
  };
}
