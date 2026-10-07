import { PLAYER_TUNING } from '../player.js';

/**
 * Level fairness rules.
 *
 * Every rule here is a bug that shipped once and had to be found by automated
 * play — none of them are style preferences. A level that violates one is not
 * "hard", it is unwinnable or unrecoverable in a way that reads as a bug.
 *
 * The thresholds derive from `PLAYER_TUNING`, so retuning the jump retunes the
 * rules with it instead of silently invalidating them.
 *
 * Reachability is solved in 3D. The first version measured gaps along +Z and
 * would have called a vertical level one enormous hole; a rule that only holds
 * for the level it was written against is not a rule.
 */

const PLAYER_RADIUS = 0.42;
const BAR_RADIUS = 0.3;

/** R1 budget: never spend more than 60% of the available jump on a gap. */
const GAP_BUDGET = 0.6;
/** R3: how much void-side deck must be outside every sweep. */
const MIN_STAGING_LEDGE = 2.5;
/** R4: a ledge shorter than this cannot be stopped on at full speed. */
const UNSTOPPABLE_LEDGE = 3;
/** R6: margin between a pickup and a bumper that would shove you off. */
const PICKUP_CLEARANCE = 0.6;

export const AIRTIME = (2 * PLAYER_TUNING.jumpSpeed) / PLAYER_TUNING.gravity;
export const JUMP_RANGE = PLAYER_TUNING.maxSpeed * AIRTIME;
export const MAX_RISE =
  (PLAYER_TUNING.jumpSpeed * PLAYER_TUNING.jumpSpeed) / (2 * PLAYER_TUNING.gravity);

/**
 * How far you can travel horizontally on one jump while also gaining `rise`
 * metres of height. Flat ground gives the full ~6.8 units; climbing costs
 * distance, and above the ~2.33-unit apex no jump reaches at all.
 *
 * @returns {number|null} horizontal reach, or null when the height is impossible
 */
export function jumpReach(rise) {
  const { jumpSpeed, gravity, maxSpeed } = PLAYER_TUNING;
  const discriminant = jumpSpeed * jumpSpeed - 2 * gravity * rise;
  if (discriminant < 0) return null;
  // Descending branch: the last moment the arc is still at `rise`.
  const time = (jumpSpeed + Math.sqrt(discriminant)) / gravity;
  return maxSpeed * time;
}

/**
 * @param {import('../course.js').Course} course a built course
 * @returns {Array<{rule: string, message: string}>} empty when the level is fair
 */
export function validateCourse(course) {
  const violations = [];
  const platforms = collectPlatforms(course);
  const sweepers = course.obstacles.filter((o) => o.kind === 'sweeper');
  const bumpers = course.obstacles.filter((o) => o.kind === 'bumper');
  const sliders = course.obstacles.filter((o) => o.kind === 'slider');
  const pendulums = course.obstacles.filter((o) => o.kind === 'pendulum');
  const rotors = course.obstacles.filter((o) => o.kind === 'rotor');
  const axis = course.level.progressAxis ?? 'z';
  const progress = (platform) => (axis === 'y' ? platform.yOut : platform.maxZ);

  const fail = (rule, message) => violations.push({ rule, message });

  // ---- R1: no onward jump costs more than 60% of what is available ---------
  // An arena has no direction of progress, so there is no "onward" to budget.
  // R5 still runs: every tile must be walkable to from the spawn.
  for (const platform of axis === 'none' ? [] : platforms) {
    const onward = platforms
      .filter((other) => other !== platform && progress(other) > progress(platform) + 0.5)
      .map((other) => ({ other, cost: jumpCost(platform, other) }))
      .filter((entry) => entry.cost !== null)
      .sort((a, b) => a.cost - b.cost)[0];

    // Nothing ahead at all is the end of the level, not a violation.
    const anythingAhead = platforms.some(
      (other) => other !== platform && progress(other) > progress(platform) + 0.5
    );
    if (!anythingAhead) continue;

    if (!onward) {
      fail('R1', `nothing onward from ${platform.id} is within a jump`);
      continue;
    }
    if (onward.cost > GAP_BUDGET) {
      fail(
        'R1',
        `the cheapest jump from ${platform.id} to ${onward.other.id} costs ` +
          `${Math.round(onward.cost * 100)}% of the available reach (budget ` +
          `${Math.round(GAP_BUDGET * 100)}%)`
      );
    }
  }

  // ---- R2: never respawn inside a hazard ------------------------------------
  for (const checkpoint of course.checkpoints) {
    const { x, z } = checkpoint.spawn;
    for (const sweeper of sweepers) {
      const distance = Math.hypot(x - sweeper.x, z - sweeper.z);
      const danger = sweeper.reach + PLAYER_RADIUS + BAR_RADIUS;
      if (distance <= danger) {
        fail(
          'R2',
          `checkpoint ${checkpoint.index} ("${checkpoint.label}") spawns ${distance.toFixed(2)} ` +
            `from the sweeper at z=${sweeper.z}, inside its ${danger.toFixed(2)}-unit sweep`
        );
      }
    }
    for (const bumper of bumpers) {
      const distance = Math.hypot(x - bumper.x, z - bumper.z);
      if (distance <= bumper.radius + PLAYER_RADIUS) {
        fail(
          'R2',
          `checkpoint ${checkpoint.index} ("${checkpoint.label}") spawns inside the ` +
            `bumper at (${bumper.x}, ${bumper.z})`
        );
      }
    }
    // A rotor sweeps a full circle across its slice of corridor: anywhere
    // inside that slice is somewhere a panel eventually arrives.
    for (const rotor of rotors) {
      const inSlice = Math.abs(z - rotor.z) <= rotor.depth + PLAYER_RADIUS;
      const inDrum = Math.abs(x - rotor.x) <= rotor.radius;
      if (inSlice && inDrum) {
        fail(
          'R2',
          `checkpoint ${checkpoint.index} ("${checkpoint.label}") spawns inside the rotor ` +
            `at z=${rotor.z}`
        );
      }
    }
    // A pendulum only occupies its own z plane, so both axes have to overlap.
    for (const pendulum of pendulums) {
      const inPlane = Math.abs(z - pendulum.z) <= pendulum.bobRadius + PLAYER_RADIUS;
      const inSweep =
        Math.abs(x - pendulum.x) <= pendulum.sweepHalfWidth + pendulum.bobRadius + PLAYER_RADIUS;
      if (inPlane && inSweep) {
        fail(
          'R2',
          `checkpoint ${checkpoint.index} ("${checkpoint.label}") spawns in the arc of the ` +
            `pendulum at z=${pendulum.z}`
        );
      }
    }
  }

  // ---- R3: a sweeper-guarded edge needs somewhere safe to stand -------------
  for (const platform of platforms) {
    if (platform.kind !== 'static') continue;
    // Only about sweepers: a deck no bar reaches has nothing to answer for.
    const guards = sweepers.filter((sweeper) => sweepTouches(platform, sweeper));
    if (guards.length === 0) continue;
    if (!endsAtVoid(platform, platforms)) continue;

    const ledge = safeLedgeLength(platform, guards);
    if (ledge < MIN_STAGING_LEDGE) {
      fail(
        'R3',
        `${platform.id} ends at a void with only ${ledge.toFixed(2)} units outside every ` +
          `sweep (needs ${MIN_STAGING_LEDGE}); there is nowhere fair to time the next jump`
      );
    }
  }

  // ---- R4: a slider you cannot line up for must not demand timing -----------
  for (const slider of sliders) {
    const approach = nearestPlatformBehind(slider.deck.z - slider.deck.hd, platforms);
    if (!approach) continue;
    const ledge = safeLedgeLength(approach, sweepers.filter((s) => sweepTouches(approach, s)));
    if (ledge >= UNSTOPPABLE_LEDGE) continue;
    if (slider.range >= slider.deck.hw) {
      fail(
        'R4',
        `slider at z=${slider.homeZ} is approached off a ${ledge.toFixed(2)}-unit ledge ` +
          `(under ${UNSTOPPABLE_LEDGE}, so it cannot be stopped on) but has ` +
          `range ${slider.range} >= hw ${slider.deck.hw}; its deck must always cover the centre lane`
      );
    }
  }

  // ---- R6: a pickup must not be guarded by a shove --------------------------
  for (const spark of course.sparks) {
    for (const pendulum of pendulums) {
      const inPlane = Math.abs(spark.position.z - pendulum.z) < pendulum.bobRadius + PLAYER_RADIUS;
      const inSweep =
        Math.abs(spark.position.x - pendulum.x) <
        pendulum.sweepHalfWidth + pendulum.bobRadius + PLAYER_RADIUS;
      if (inPlane && inSweep) {
        fail(
          'R6',
          `spark at (${spark.position.x}, ${spark.position.z}) sits in the arc of the pendulum ` +
            `at z=${pendulum.z}; reaching for it means taking the hit`
        );
      }
    }
    for (const bumper of bumpers) {
      const distance = Math.hypot(spark.position.x - bumper.x, spark.position.z - bumper.z);
      const clear = bumper.radius + PLAYER_RADIUS + PICKUP_CLEARANCE;
      if (distance < clear) {
        fail(
          'R6',
          `spark at (${spark.position.x}, ${spark.position.z}) sits ${distance.toFixed(2)} from ` +
            `the bumper at (${bumper.x}, ${bumper.z}); reaching for it means taking the shove, ` +
            `so it needs ${clear.toFixed(2)}`
        );
      }
    }
  }

  // ---- R5: everything must be reachable from the spawn ----------------------
  const reachable = reachableSet(course, platforms);
  for (const platform of platforms) {
    if (!reachable.has(platform.id)) {
      fail('R5', `${platform.id} is not reachable from the spawn`);
    }
  }

  return violations;
}

// ----------------------------------------------------------------- internals

/**
 * Standable platforms as boxes. `yIn` is where you land on one, `yOut` where
 * you leave it — they differ on a ramp, and conflating them makes a walkable
 * slope look like a 3-unit wall. A slider is recorded at its widest possible
 * extent, because R1 asks "can this ever be reached"; R4 covers "without timing".
 */
function collectPlatforms(course) {
  const platforms = [];

  course.level.decks.forEach((deck, index) => {
    const rise = deck.slope ?? 0;
    platforms.push({
      id: `deck[${index}] y=${deck.y} z=${deck.z}`,
      kind: 'static',
      x: deck.x,
      minX: deck.x - deck.hw,
      maxX: deck.x + deck.hw,
      minZ: deck.z - deck.hd,
      maxZ: deck.z + deck.hd,
      yIn: deck.y,
      yOut: deck.y + rise,
    });
  });

  // Tiles are floor too. They are validated in their intact state — a level
  // whose arena is unreachable before anything dissolves is broken outright.
  course.tiles.forEach((tile, index) => {
    platforms.push({
      id: `tile[${index}] ring=${tile.ring}`,
      kind: 'static',
      x: tile.deck.x,
      minX: tile.deck.x - tile.deck.hw,
      maxX: tile.deck.x + tile.deck.hw,
      minZ: tile.deck.z - tile.deck.hd,
      maxZ: tile.deck.z + tile.deck.hd,
      yIn: tile.deck.y,
      yOut: tile.deck.y,
    });
  });

  for (const slider of course.obstacles) {
    if (slider.kind !== 'slider') continue;
    const reachX = slider.axis === 'x' ? slider.range : 0;
    const reachZ = slider.axis === 'z' ? slider.range : 0;
    // A lift is only ever standable across the band it travels, so it lands you
    // at its lowest and launches you from its highest.
    const lift = slider.axis === 'y' ? slider.range : 0;
    platforms.push({
      id: `slider z=${slider.homeZ}`,
      kind: 'slider',
      x: slider.homeX,
      minX: slider.homeX - slider.deck.hw - reachX,
      maxX: slider.homeX + slider.deck.hw + reachX,
      minZ: slider.homeZ - slider.deck.hd - reachZ,
      maxZ: slider.homeZ + slider.deck.hd + reachZ,
      yIn: slider.homeY - lift,
      yOut: slider.homeY + lift,
    });
  }

  // A turntable is round; squaring it off would credit it with corners it does
  // not have, so it is measured by its inscribed square instead — an
  // understatement, which keeps the gap rules strict rather than generous.
  for (const disc of course.obstacles) {
    if (disc.kind !== 'disc') continue;
    const half = disc.radius / Math.SQRT2;
    platforms.push({
      id: `disc z=${disc.z}`,
      kind: 'static',
      x: disc.x,
      minX: disc.x - half,
      maxX: disc.x + half,
      minZ: disc.z - half,
      maxZ: disc.z + half,
      yIn: disc.deck.y,
      yOut: disc.deck.y,
    });
  }

  return platforms.sort((a, b) => a.minZ - b.minZ);
}

const overlapsX = (a, b) => a.minX <= b.maxX && b.minX <= a.maxX;

/** Edge-to-edge horizontal distance between two footprints; 0 when they overlap. */
function horizontalGap(a, b) {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
  return Math.hypot(dx, dz);
}

/** Fraction of the available jump a hop from `a` to `b` needs, or null if impossible. */
function jumpCost(a, b) {
  const reach = jumpReach(b.yIn - a.yOut);
  if (reach === null) return null;
  const gap = horizontalGap(a, b);
  if (gap > reach) return null;
  return reach === 0 ? 1 : gap / reach;
}

function nearestPlatformBehind(z, platforms) {
  let best = null;
  for (const platform of platforms) {
    if (platform.maxZ > z + 0.001) continue;
    if (!best || platform.maxZ > best.maxZ) best = platform;
  }
  return best;
}

/** True when nothing continues this platform within a step of its +Z edge. */
function endsAtVoid(platform, platforms) {
  return !platforms.some(
    (other) =>
      other !== platform &&
      overlapsX(platform, other) &&
      other.minZ > platform.maxZ - 0.5 &&
      other.minZ <= platform.maxZ + 0.5
  );
}

function sweepRadius(sweeper) {
  return sweeper.reach + PLAYER_RADIUS + BAR_RADIUS;
}

function sweepTouches(platform, sweeper) {
  const radius = sweepRadius(sweeper);
  const dx = Math.max(0, platform.minX - sweeper.x, sweeper.x - platform.maxX);
  const dz = Math.max(0, platform.minZ - sweeper.z, sweeper.z - platform.maxZ);
  return Math.hypot(dx, dz) < radius;
}

/**
 * How much of a platform's +Z end sits outside every sweeper arc, measured
 * along its centre line. This is the ground you can actually stand on to line
 * up the next jump.
 */
function safeLedgeLength(platform, sweepers) {
  let sweptTo = platform.minZ;
  for (const sweeper of sweepers) {
    const radius = sweepRadius(sweeper);
    const dx = platform.x - sweeper.x;
    if (Math.abs(dx) >= radius) continue;

    const half = Math.sqrt(radius * radius - dx * dx);
    if (sweeper.z + half <= platform.minZ) continue;
    if (sweeper.z - half >= platform.maxZ) continue;

    sweptTo = Math.max(sweptTo, Math.min(sweeper.z + half, platform.maxZ));
  }
  return platform.maxZ - sweptTo;
}

function reachableSet(course, platforms) {
  const spawn = course.startSpawn;
  const reached = new Set();
  const frontier = [];

  for (const platform of platforms) {
    if (
      spawn.x >= platform.minX - 0.5 &&
      spawn.x <= platform.maxX + 0.5 &&
      spawn.z >= platform.minZ - 0.5 &&
      spawn.z <= platform.maxZ + 0.5
    ) {
      reached.add(platform.id);
      frontier.push(platform);
    }
  }

  while (frontier.length > 0) {
    const from = frontier.pop();
    for (const other of platforms) {
      if (reached.has(other.id)) continue;
      if (jumpCost(from, other) === null) continue;
      reached.add(other.id);
      frontier.push(other);
    }
  }

  return reached;
}
