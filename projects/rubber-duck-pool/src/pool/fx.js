// The burst a tapped duck throws off (its design's fx: ducks.js): little shapes drawn as sprites facing the camera
// (renderer.js's fx layer), flying out from its head, then floating up, drifting or falling, spinning, fading out.
// Page-side and only for show (the world's 'voice' event starts one).
import { srgbToLinear } from '@lid/diorama/math.js';
import { DESIGNS } from './ducks.js';

export const FX_MAX = 256, FX_FLOATS = 12;   // three vec4 a sprite: (position, size), (colour, alpha), (shape, turn, 0, 0)
const SHAPES = { drop: 0, bubble: 1, heart: 2, star: 3, petal: 4, bolt: 5 };

/** rand: () -> [0, 1). */
export function createFx(rand) {
  const live = [];
  return {
    get count() { return live.length; },
    /** A burst of design colour's shapes from the duck at p. */
    burst(p, colour) {
      const f = DESIGNS[colour].fx, cols = f.colours.map(srgbToLinear);
      for (let i = 0; i < f.n && live.length < FX_MAX; i++) {
        const a = rand() * Math.PI * 2, s = 0.35 + rand() * 0.45;
        live.push({ p: [p[0], p[1] + 0.14, p[2]], v: [Math.cos(a) * s, 0.8 + rand() * 0.9, Math.sin(a) * s], up: f.up, age: 0, life: 1.1 + rand() * 0.8,
          size: 0.028 + rand() * 0.022, ...(f.shape === 'heart' ? { turn: (rand() - 0.5) * 0.6, spin: 0 } : { turn: rand() * 6.28, spin: (rand() - 0.5) * 7 }), shape: SHAPES[f.shape], col: cols[i % cols.length] });   // hearts stay upright
      }
    },
    step(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const q = live[i];
        if ((q.age += dt) > q.life) { live.splice(i, 1); continue; }
        if (q.up < 0) { q.v[1] -= 9.8 * 0.45 * -q.up * dt; for (const k of [0, 2]) q.v[k] *= 1 - dt * 0.8; }   // falling, like drops
        else { const e = Math.min(1, dt * 2.5); q.v[0] -= q.v[0] * e; q.v[2] -= q.v[2] * e; q.v[1] += (q.up - q.v[1]) * e; }   // slowing to a float
        for (let k = 0; k < 3; k++) q.p[k] += q.v[k] * dt;
        q.turn += q.spin * dt;
      }
    },
    /** Write the sprites into buf from base (floats); returns how many. */
    pack(buf, base) {
      live.forEach((q, i) => {
        const t = q.age / q.life, grow = Math.min(1, q.age / 0.12), o = base + FX_FLOATS * i;
        buf.set([q.p[0], q.p[1], q.p[2], q.size * grow * (1 - 0.3 * t), q.col[0], q.col[1], q.col[2], Math.min(1, (1 - t) / 0.4), q.shape, q.turn, 0, 0], o);
      });
      return live.length;
    },
  };
}
