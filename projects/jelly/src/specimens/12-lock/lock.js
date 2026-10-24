// Lock Jelly — the lock itself: two gates, two pairs of ground paddles and the chamber's level. A gate turns
// only when the water on its two sides stands at exactly the same level; while it is open the two bodies are
// one. Drawn paddles move the chamber's level bodily toward the pound they open to, fast at first and slower
// as the head falls (Torricelli), with boils over the outlet, a dimple over the intake, white water and foam.
import { L } from './layout.js';
export { createFoam } from '@lid/diorama/foam.js';

const { UP, CH, LO, LU, LL, XT, XB, ZC, HALF } = L;
const OPEN = Math.PI / 2;

/** o: { water, foam, bubbles, rand } */
export function createLock({ water, foam, bubbles, rand: R }) {
  const lock = {
    gates: L.GATES.map(() => ({ th: 0 })), paddles: L.PADDLES.map(() => ({ open: 0 })),
    level: LU, flow: 0, lockfuls: 0, refused: 0, speed: 1,
  };
  const bodyLevel = (k) => (k === CH ? lock.level : k === UP ? LU : LL);
  /** Do the two sides of gate i stand level? (exactly: the level snaps when it arrives) */
  lock.level0 = (i) => bodyLevel(L.GATES[i].bodies[0]) === bodyLevel(L.GATES[i].bodies[1]);
  /** Turn gate i toward th; refused (it stays shut) across a step in the levels. Returns the angle it is at. */
  lock.setGate = (i, th) => {
    const G = lock.gates[i], [a, b] = L.GATES[i].bodies;
    th = Math.min(OPEN, Math.max(0, th));
    if (th > 0 && G.th === 0 && !lock.level0(i)) { lock.refused++; return 0; }
    const was = G.th > 0;
    G.th = th;
    if ((th > 0) !== was) water.link(a, b, th > 0);
    return th;
  };
  lock.isOpen = (i) => lock.gates[i].th > OPEN - 1e-3;
  lock.isShut = (i) => lock.gates[i].th === 0;
  /** Everything shut, the chamber full (or empty), with gate `open` (or none) standing open. */
  lock.reset = (full = true, open = -1) => {
    lock.gates.forEach((G, i) => { if (G.th > 0) water.link(...L.GATES[i].bodies, false); G.th = 0; });
    lock.paddles.forEach((P) => { P.open = 0; });
    lock.level = full ? LU : LL; lock.flow = 0;
    water.setLevel(lock.level, CH);
    if (open >= 0) lock.setGate(open, OPEN);
  };

  let boil = 0;
  lock.step = (dt) => {
    const up = lock.paddles[0].open, down = lock.paddles[1].open, K = 0.11 * lock.speed;
    let dL = 0;
    if (up > 0 && lock.level < LU) dL += K * up * Math.sqrt(LU - lock.level) * dt;
    if (down > 0 && lock.level > LL) dL -= K * down * Math.sqrt(lock.level - LL) * dt;
    lock.flow = dL / dt;
    if (dL !== 0) {
      const before = lock.level;
      lock.level = Math.min(LU, Math.max(LL, lock.level + dL));
      if (Math.abs(lock.level - LU) < 2e-4) lock.level = LU;   // arrived: exactly level with the pound
      if (Math.abs(lock.level - LL) < 2e-4) lock.level = LL;
      if ((before !== LU && lock.level === LU) || (before !== LL && lock.level === LL)) lock.lockfuls++;
      water.setLevel(lock.level, CH);
    }
    // the water's show, as strong as the flow
    const q = Math.min(1, Math.abs(lock.flow) / 0.03);
    if (q > 0.02) {
      if (lock.flow > 0) {   // filling: a dimple over the top paddles' intake, boils in the chamber
        water.addVolume(XT - 0.28, ZC + 0.05, -0.00022 * q, 0.05);
        foam.add(XT - 0.28, ZC + 0.05, 0.004 * q, 0.05);
        if ((boil -= dt) < 0) {
          boil = 0.05 + R() * 0.12;
          const x = XT + 0.2 + R() * 0.45, z = ZC + 0.05 + R() * 0.3;
          water.addVolume(x, z, 0.0016 * q * (0.6 + R()), 0.05);
          foam.add(x, z, 0.35 * q, 0.06 + 0.05 * R());
          for (let k = 0; k < 4; k++) bubbles.emit(x + (R() - 0.5) * 0.08, L.BC + 0.05 + R() * 0.1, z + (R() - 0.5) * 0.08, 0.006 + 0.01 * R());
        }
      } else {               // emptying: a dimple in the chamber, white water in the tail
        water.addVolume(XB - 0.28, ZC + 0.05, -0.00022 * q, 0.05);
        if ((boil -= dt) < 0) {
          boil = 0.04 + R() * 0.08;
          const x = XB + 0.05 + R() * 0.35, z = ZC + 0.04 + R() * (HALF - ZC - 0.08);
          water.addVolume(x, z, 0.0018 * q * (0.6 + R()), 0.05);
          foam.add(x, z, 0.5 * q, 0.07 + 0.06 * R());
          for (let k = 0; k < 5; k++) bubbles.emit(x + (R() - 0.5) * 0.1, L.BL + 0.04 + R() * 0.12, z + (R() - 0.5) * 0.1, 0.006 + 0.012 * R());
        }
      }
    }
  };
  /** How far the chamber has got from one level to the other (0..1), going up or down. */
  lock.progress = (goingUp) => (goingUp ? (lock.level - LL) / (LU - LL) : (LU - lock.level) / (LU - LL));
  return lock;
}
export { OPEN };
