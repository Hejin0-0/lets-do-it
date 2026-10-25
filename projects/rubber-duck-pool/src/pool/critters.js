import { P } from './layout.js';
import { isleH, isleSd, offshore } from './island.js';
import { PLACEMENTS } from './props.js';
import { daylight } from './daylight.js';

export const CRITTER_MAX = 96;
export const CRITTER = { gull: 6, butterfly: 7, firefly: 8, fish: 9 };
const TAU = Math.PI * 2;
const GULL_RINGS = [[0, 8, 2, .7], [-8.5, 1.5, 1.8, 1.8], [2, -8.8, 2, 1.6], [1, 1, 13, 12], [1, 1, 13, 12]];
const flowers = PLACEMENTS.filter(p => ['flowerbush', 'oleander', 'potflower'].includes(p.model) && p.at[2] > P.COLS + .5);
const colours = [[1, .22, .025], [1, .8, .08], [.08, .45, 1], [.9, .93, 1]];
const dry = (x, z) => isleSd(x, z) < -.4 && isleH(x, z) > P.SEA + .15 && P.mainD(x, z) > .3 && P.roundD(x, z) > .3;

/** rand: () -> [0, 1); all elapsed time comes from step. */
export function createCritters(rand) {
  const live = [], events = [];
  let time = 0, fish = null, wait = 4 + rand() * 6;
  function add(shape, size, col, x = 0, z = 0) {
    const q = { shape, size, col, x, y: isleH(x, z) + .4, z, ax: x, az: z, alpha: 0, turn: 0, flap: rand(), glow: 0,
      phase: rand() * TAU, rate: .8 + rand() * .4, bright: .2 + rand() * .3, dark: 1 + rand() * 3 };
    live.push(q); return q;
  }
  for (let i = 0; i < 5; i++) add(CRITTER.gull, .42, [.86, .88, .9]);
  for (let i = 0; i < 8; i++) {
    const p = flowers[Math.floor(rand() * flowers.length)];
    add(CRITTER.butterfly, .1, colours[i % colours.length], p.at[0], p.at[2]);
  }
  for (let i = 0; i < 30; i++) {
    let x = -3, z = 2;
    for (let attempt = 0; attempt < 200; attempt++) {
      const a = -4.3 + rand() * 11.5, b = 1.3 + rand() * 4.3;
      if ([0, 1, 2, 3, 4, 5, 6, 7].every(k => dry(a + .35 * Math.cos(k * TAU / 8), b + .35 * Math.sin(k * TAU / 8)))) {
        x = a; z = b; break;
      }
    }
    add(CRITTER.firefly, .05, [.8, 1, .12], x, z);
  }
  function launch() {
    const front = rand() < .65, along = -3 + rand() * 8, out = offshore(front, along) + .2;
    const angle = rand() * TAU, dx = .6 * Math.cos(angle), dz = .6 * Math.sin(angle);
    const x = front ? along : out, z = front ? out : along;
    // Check the whole splash corridor, not just its centre on the coast's noisy edge.
    for (let i = 0; i <= 12; i++) {
      const a = x + dx * i / 12, b = z + dz * i / 12;
      if (isleSd(a, b) < .35 || isleH(a, b) > P.SEA - .18) return;
    }
    fish = { x, z, dx, dz, age: 0, life: .7 };
    events.push({ type: 'fishJump', x, z });
  }
  const api = {
    events,
    get count() { return live.length + (fish ? 1 : 0); },
    step(dt, hour) {
      if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(hour)) throw new RangeError('Expected finite hour and non-negative dt');
      time += dt;
      const night = daylight(hour).night, fade = Math.min(1, dt / 1.5);
      for (let i = 0; i < live.length; i++) {
        const q = live[i], t = time * q.rate + q.phase;
        const target = q.shape === CRITTER.firefly ? P.ss(.08, .7, night) : 1 - P.ss(.08, .7, night);
        q.alpha += P.clamp(target - q.alpha, -fade, fade);
        if (q.shape === CRITTER.gull) {
          const a = t * .08;
          const [cx, cz, rx, rz] = GULL_RINGS[i];   // three circle where the first view sees the sea, two range wide
          q.x = cx + rx * Math.cos(a);
          q.z = cz + rz * Math.sin(a);
          q.y = P.SEA + 4.4 + 1.1 * Math.sin(t * .13);
          q.turn = .16 * Math.sin(t * .3);
          q.flap = (q.flap + dt * q.rate * (Math.sin(t * .4) > .4 ? 1.1 : .025)) % 1;
        } else if (q.shape === CRITTER.butterfly) {
          const flying = P.ss(-.75, -.2, Math.sin(t * .35));
          q.x = q.ax + flying * (.28 * Math.sin(t * 1.1) + .09 * Math.sin(t * 3.7));
          q.z = q.az + flying * (.28 * Math.cos(t * .9) + .09 * Math.sin(t * 2.9));
          q.y = isleH(q.x, q.z) + .3 + flying * (.25 + .2 * Math.sin(t * 2));
          q.turn = flying * .24 * Math.sin(t * 2.7);
          q.flap = (q.flap + dt * q.rate * (.3 + flying * 7)) % 1;
        } else {
          q.x = q.ax + .2 * Math.sin(t * .4); q.z = q.az + .2 * Math.cos(t * .31);
          q.y = isleH(q.x, q.z) + .55 + .4 * Math.sin(t * .5);
          const blink = (time + q.phase) % (q.bright + q.dark);
          q.glow = blink < q.bright ? Math.sin(Math.PI * blink / q.bright) ** 2 : 0;
          q.flap = (q.flap + dt * q.rate * 5) % 1;
        }
      }
      let remaining = dt;
      while (remaining > 0) {
        const span = Math.min(remaining, fish ? fish.life - fish.age : wait);
        remaining -= span;
        if (fish) {
          fish.age += span;
          if (fish.age >= fish.life) {
            events.push({ type: 'fishSplash', x: fish.x + fish.dx, z: fish.z + fish.dz });
            fish = null; wait = (4 + rand() * 6) * (1 + 2 * night) - .7;
          }
        } else {
          wait -= span;
          if (wait <= 0) { launch(); if (!fish) wait = 1; }
        }
      }
    },
    /** base is a float offset, as in createFx.pack. Invisible residents retain their slots. */
    pack(buf, base) {
      let n = 0;
      const write = (x, y, z, size, col, alpha, shape, turn, flap, glow) => {
        buf.set([x, y, z, size, ...col, alpha, shape, turn, flap, glow], base + 12 * n++);
      };
      for (const q of live) write(q.x, q.y, q.z, q.size, q.col, q.alpha, q.shape, q.turn, q.flap, q.glow);
      if (fish) {
        const u = fish.age / fish.life;
        write(fish.x + fish.dx * u, P.SEA + 1.2 * u * (1 - u), fish.z + fish.dz * u, .07, [.4, .65, .82],
          Math.min(1, u / .08, (1 - u) / .08), CRITTER.fish, Math.atan2(1.2 * (1 - 2 * u), .6), (u * 4) % 1, 0);
      }
      return n;
    },
  };
  api.step(0, 12);
  return api;
}
