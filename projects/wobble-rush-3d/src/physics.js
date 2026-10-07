/**
 * Pure arcade math. No Three.js in here on purpose: this is the part with the
 * fiddly edge cases, so it stays importable by `node src/physics.test.js`.
 */

export const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent smoothing. `lambda` is roughly "how snappy", per second. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Move `current` toward `target` by at most `maxDelta`. */
export function approach(current, target, maxDelta) {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/** Signed smallest rotation from `from` to `to`, in radians, within (-PI, PI]. */
export function shortestAngle(from, to) {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta <= -Math.PI) delta += twoPi;
  return delta;
}

/**
 * Top-surface height of an axis-aligned deck at (x, z), or `null` when the
 * point is outside it. A deck with `slope` ramps linearly from its -Z edge
 * (height `y`) to its +Z edge (height `y + slope`).
 *
 * @param {{x:number, z:number, hw:number, hd:number, y:number, slope?:number}} deck
 * @param {number} pad extra reach, so a player's radius still counts as "on it"
 */
export function deckHeightAt(deck, x, z, pad = 0) {
  // A disc is round, not a box: squaring one off would let you stand on corners
  // that are not there, which on a spinning platform is exactly where you die.
  if (deck.shape === 'disc') {
    const dx = x - deck.x;
    const dz = z - deck.z;
    const reach = deck.radius + pad;
    return dx * dx + dz * dz <= reach * reach ? deck.y : null;
  }

  if (Math.abs(x - deck.x) > deck.hw + pad) return null;
  if (Math.abs(z - deck.z) > deck.hd + pad) return null;
  if (!deck.slope) return deck.y;
  const t = clamp((z - (deck.z - deck.hd)) / (2 * deck.hd), 0, 1);
  return deck.y + deck.slope * t;
}

/**
 * Rotate a point about a vertical axis. Used to carry a rider around with a
 * spinning platform: near the rim you travel a lot further than at the hub,
 * which a single per-frame delta cannot express.
 */
export function rotateAbout(x, z, centreX, centreZ, angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const rx = x - centreX;
  const rz = z - centreZ;
  return {
    x: centreX + rx * cos - rz * sin,
    z: centreZ + rx * sin + rz * cos,
  };
}

/**
 * Closest point on segment A→B to P, all in the XZ plane.
 * @returns {{distance:number, t:number, x:number, z:number}}
 */
export function closestPointOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : clamp(((px - ax) * dx + (pz - az) * dz) / lengthSq, 0, 1);
  const x = ax + dx * t;
  const z = az + dz * t;
  return { distance: Math.hypot(px - x, pz - z), t, x, z };
}

/**
 * Overlap test against an upright circle in the XZ plane.
 * @returns {{nx:number, nz:number, depth:number}|null} outward unit normal + penetration
 */
export function radialPush(px, pz, cx, cz, minDistance) {
  const dx = px - cx;
  const dz = pz - cz;
  const distance = Math.hypot(dx, dz);
  if (distance >= minDistance) return null;
  if (distance < 1e-5) {
    // Dead centre: no direction to normalise, so pick an arbitrary but stable
    // one. Returning dx/distance here would divide by ~0 and fling the player.
    return { nx: 1, nz: 0, depth: minDistance };
  }
  return { nx: dx / distance, nz: dz / distance, depth: minDistance - distance };
}

/** Shrink an XZ vector so its length never exceeds `max`. */
export function limitPlanar(x, z, max) {
  const length = Math.hypot(x, z);
  if (length <= max || length === 0) return { x, z };
  const scale = max / length;
  return { x: x * scale, z: z * scale };
}

/** Seconds → `mm:ss.cc`, clamped at zero so a stray negative never renders. */
export function formatTime(seconds) {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  const whole = Math.floor(rest);
  const centis = Math.floor((rest - whole) * 100);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(whole)}.${pad(centis)}`;
}
