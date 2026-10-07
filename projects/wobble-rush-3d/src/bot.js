/**
 * A scripted player, kept because it earns its keep.
 *
 * During the original build this controller found four real bugs that manual
 * play had missed: a sweeper that owned an entire runway, two checkpoints that
 * respawned inside a rotating bar, a slider whose landing window covered only
 * 20% of its cycle, and a camera that spiralled the player off the deck. It is
 * not a substitute for playing the game — it is a regression net for the kind
 * of unfairness you cannot see by looking at a level.
 *
 * It drives `Game.stepSimulation` directly at a fixed timestep, so a run costs
 * milliseconds and never touches the renderer.
 */

const TAU = Math.PI * 2;
const STEP = 1 / 60;

/**
 * Turn a desired world direction into key presses.
 *
 * Movement input is camera-relative, so "go that way" is only meaningful once
 * you know where the camera is. On a straight course the yaw is fixed and this
 * is overkill; on a spiral it changes every frame and nothing else works.
 */
function worldDirToKeys(dx, dz, yaw) {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // Game maps (forward, strafe) → world via F = (-sin, -cos), S = (cos, -sin).
  const forward = -dx * sin - dz * cos;
  const strafe = dx * cos - dz * sin;

  const keys = [];
  if (forward > 0.3) keys.push('KeyW');
  else if (forward < -0.3) keys.push('KeyS');
  if (strafe > 0.3) keys.push('KeyD');
  else if (strafe < -0.3) keys.push('KeyA');
  return keys;
}

/** Seconds until a sweeper arm sweeps through this bearing. */
function timeToBar(sweepers, x, z) {
  let soonest = Infinity;
  for (const sweeper of sweepers) {
    const dx = x - sweeper.x;
    const dz = z - sweeper.z;
    if (Math.hypot(dx, dz) > sweeper.reach + 0.8) continue;

    const bearing = Math.atan2(-dz, dx);
    for (let i = 0; i < sweeper.armCount; i += 1) {
      const arm = sweeper.angle + (i / sweeper.armCount) * TAU;
      let delta = sweeper.speed > 0 ? bearing - arm : arm - bearing;
      delta = ((delta % TAU) + TAU) % TAU;
      soonest = Math.min(soonest, delta / Math.abs(sweeper.speed));
    }
  }
  return soonest;
}

/**
 * Play one run.
 *
 * @param {object} game a booted Game
 * @param {{seconds?: number, seed?: number}} [options] `seconds` is the simulated
 *   budget; `seed` pins the starting phase of every hazard so a run is repeatable.
 * @returns {{finished: boolean, outcome: string|null, seconds: number, falls: number, furthestZ: number}}
 */
export function runBot(game, options = {}) {
  const limitSeconds = options.seconds ?? 90;
  const seed = options.seed;
  const player = game.player;
  const course = game.course;

  const sweepers = course.obstacles.filter((o) => o.kind === 'sweeper');
  const pendulums = course.obstacles.filter((o) => o.kind === 'pendulum');
  const rotors = course.obstacles.filter((o) => o.kind === 'rotor');
  const discs = course.obstacles.filter((o) => o.kind === 'disc');
  const sliders = course.obstacles.filter((o) => o.kind === 'slider');
  const bumpers = course.obstacles.filter((o) => o.kind === 'bumper');
  const ground = (x, z) => course.sampleGround(x, z, player.position.y + 0.6, 0.2);
  /** Anything a jump could still land on, including ground above the player. */
  const reachable = (x, z) => course.sampleGround(x, z, player.position.y + 2.3, 0.2);

  /**
   * A bumper on the line ahead. Walking into one on a narrow deck is a fall,
   * so the bot weaves the way a player does rather than ploughing through.
   */
  const bumperAhead = (x, z) =>
    bumpers.find(
      (b) => b.z > z + 0.5 && b.z < z + 5 && Math.abs(b.x - x) < b.radius + player.radius + 0.6
    );

  // Take the loop away from rAF so stepping is exclusive and deterministic,
  // and drop the presentation layer so a run costs milliseconds.
  game.renderer.setAnimationLoop(null);
  game.headless = true;
  game.startRun();

  // Pin the starting phase of every hazard. Sweepers randomise their angle when
  // they are built and `game.time` carries across runs, so without this a gate
  // built on "4 of 5 must finish" is a coin flip. Varying the seed varies which
  // phase the bot has to solve, which is the coverage the randomness was for.
  if (seed !== undefined) {
    game.time = seed * 3.1;
    sweepers.forEach((sweeper, index) => {
      sweeper.angle = (seed * 1.7 + index * 2.399) % TAU;
    });
    course.update(0, game.time);
  }

  let frames = 0;
  let furthestZ = -Infinity;
  let peakY = -Infinity;
  const limit = Math.round(limitSeconds * 60);
  const axis = course.level.progressAxis ?? 'z';
  const climbing = axis === 'y';
  const arena = axis === 'none';
  let climbTarget = null;

  while (frames < limit && game.state === 'running') {
    const { x, z } = player.position;
    furthestZ = Math.max(furthestZ, z);
    peakY = Math.max(peakY, player.position.y);

    if (arena) {
      // Standing on a tile lights its fuse, so movement is what costs floor.
      // Wait it out and hop late: crossing the arena burns five tiles a second
      // and strips the whole saucer inside ten. Only move when the ground is
      // actually about to go.
      const current = course.tiles.find((tile) => tile.deck === player.groundDeck);
      const mustMove =
        !current || current.state === 'gone' || (current.state === 'fusing' && current.timer < 0.7);

      const arenaKeys = [];
      if (mustMove) {
        // Spend the doomed floor first and save the tiles that only go when
        // you stand on them. Drifting straight to the middle burns the seven
        // permanent tiles while the rim is still perfectly good, and there is
        // nothing left to stand on at the end.
        let best = null;
        for (const tile of course.tiles) {
          if (!tile.safe || tile === current) continue;
          const distance = Math.hypot(tile.deck.x - x, tile.deck.z - z);
          const lifeLeft = tile.autoFuseAt === Infinity ? 40 : tile.autoFuseAt - game.elapsed;
          const score = distance * 0.6 + lifeLeft;
          if (!best || score < best.score) best = { tile, distance, score };
        }
        if (best) {
          const dx = best.tile.deck.x - x;
          const dz = best.tile.deck.z - z;
          const length = Math.hypot(dx, dz) || 1;
          arenaKeys.push(...worldDirToKeys(dx / length, dz / length, game.cameraYaw));
        }
      }

      game._keys = new Set(arenaKeys);
      game.stepSimulation(STEP);
      frames += 1;
      continue;
    }

    if (climbing) {
      // Only re-pick while grounded: mid-jump the player rises past the deck
      // they are aiming at, and re-picking would steer them off it.
      if (player.grounded || climbTarget === null) {
        climbTarget = null;
        for (const deck of course.decks) {
          if (deck.y - player.position.y < 0.3) continue;
          const distance = Math.hypot(deck.x - x, deck.z - z);
          const score = deck.y * 100 + distance;
          if (!climbTarget || score < climbTarget.score) climbTarget = { deck, distance, score };
        }
      }

      const climbKeys = [];
      if (climbTarget) {
        const deck = climbTarget.deck;
        const dx = deck.x - x;
        const dz = deck.z - z;
        const length = Math.hypot(dx, dz) || 1;
        climbKeys.push(...worldDirToKeys(dx / length, dz / length, game.cameraYaw));

        // Aim at the centre but jump off the near edge. Measuring the launch
        // against the centre works only while every platform is small; the
        // 5.2-wide top pad is 6 units away centre-to-centre and 2.4 edge-to-edge.
        const edgeGap = Math.hypot(
          Math.max(0, Math.abs(dx) - deck.hw),
          Math.max(0, Math.abs(dz) - deck.hd)
        );
        const speed = Math.hypot(player.velocity.x, player.velocity.z);

        // Hold the jump, do not tap it. Releasing early halves the rise (that
        // is the variable-height jump working as designed), which caps the arc
        // at ~0.47 units — less than a single 1.2-unit step of the tower.
        if (player.grounded && edgeGap < 2.2 && speed > 3.2) climbKeys.push('Space');
        else if (!player.grounded && player.velocity.y > 0) climbKeys.push('Space');
      }

      game._keys = new Set(climbKeys);
      game.stepSimulation(STEP);
      frames += 1;
      continue;
    }

    const keys = ['KeyW'];

    if (!ground(x, z + 2.4)) {
      // A gap. Line up with the platform that will catch us, then commit.
      const slider = sliders.find((s) => s.deck.z > z + 1 && s.deck.z < z + 11);

      // Is there anything out there at all? Past the last deck there is not,
      // and a mode that is not won by arriving (Spark Snatch) will happily
      // march off the end of the finish pad and respawn-loop forever.
      //
      // This asks "could I reach anything", so it looks as high as a jump goes.
      // The tight ceiling `ground` uses is for "am I standing over a gap"; reuse
      // it here and a rising ramp reads as empty space and the bot stops dead.
      let landing = Boolean(slider);
      for (let tz = z + 3; !landing && tz <= z + 7.5; tz += 0.5) {
        for (let tx = -7; !landing && tx <= 7; tx += 0.5) {
          if (reachable(tx, tz)) landing = true;
        }
      }
      if (!landing) {
        game._keys = new Set();
        game.stepSimulation(STEP);
        frames += 1;
        continue;
      }

      // A lift has to be met, not jumped at. Wait on the edge until it has come
      // down within reach; committing while it is up is a fall every time.
      if (slider && slider.axis === 'y' && slider.deck.y > player.position.y + 1.8) {
        game._keys = new Set();
        game.stepSimulation(STEP);
        frames += 1;
        continue;
      }

      // A turntable is aimed at by its hub, not its middle-of-the-course. Land
      // near the rim and the spin carries you off before the next jump lines up.
      const discAhead = discs.find((d) => d.z > z + 0.5 && d.z < z + 12);
      // Whatever we are standing on right now, if it is moving. Falling back to
      // world x=0 while riding a slider walks you straight off the side of it:
      // the carry drifts you outward, the fallback pulls you back to a lane the
      // platform left seconds ago.
      const riding = [...sliders, ...discs].find((o) => player.groundDeck === o.deck);
      const ridingX = riding ? riding.deck.x : 0;
      const ridingHalf = riding ? riding.deck.hw ?? riding.radius : 3;

      const targetX = slider ? slider.deck.x : discAhead ? discAhead.x : ridingX;
      const half = slider ? slider.deck.hw : discAhead ? discAhead.radius : ridingHalf;
      // "Am I already over it?" beats "chase its exact centre", which overshoots:
      // the platform moves at ~2.5 u/s and a chasing player closes at 9.2.
      const covered = Math.abs(targetX - x) < half - 1;
      const atBrink = !ground(x, z + 0.9);

      if (!covered && !atBrink) {
        keys.length = 0;
        keys.push(targetX > x ? 'KeyA' : 'KeyD');
      } else if (player.grounded && (atBrink || (slider && covered))) {
        // Two different scarce things, so two different cues.
        //
        // A static target — a deck, a turntable — is a question of range, so
        // launch from the edge. Jumping the moment the 2.4-unit probe sees a
        // gap throws away that much run-up, which lands you short.
        //
        // A slider is a question of alignment. It drifts at up to 4.6 u/s, so
        // waiting for the brink means waiting for it to leave; go while it is
        // still under you.
        keys.push('Space');
      } else if (!player.grounded && player.velocity.y > 0) {
        // Hold it. A tapped jump is halved by the variable-height rule and
        // peaks at about half a unit, which drops into the gap it was aimed over.
        keys.push('Space');
      }
    } else if (player.grounded) {
      // A jump clears a bar between 0.11 s and 0.63 s into its 0.74 s arc.
      const bar = timeToBar(sweepers, x, z);
      if (bar > 0.16 && bar < 0.5) keys.push('Space');

      const spark = course.activeSparks.find(
        (s) =>
          !s.collected &&
          s.position.z > z + 0.5 &&
          s.position.z < z + 14 &&
          Math.abs(s.position.x - x) < 6
      );
      const hazard = bumperAhead(x, z);
      // A pendulum is dodged, not jumped: take the lane its bob has left.
      const swing = pendulums.find((p) => p.z > z - 1.5 && p.z < z + 8);

      // Falling costs more than a missed pickup, so avoidance outranks greed.
      // A drum panel arrives across the corridor, so jumping does nothing. Pick
      // the lane with the most room, sampling the same measurement the drum
      // itself uses rather than guessing at its geometry.
      const drum = rotors.find((r) => r.z > z - 1 && r.z < z + 7);
      if (drum) {
        let best = null;
        for (let candidate = -6; candidate <= 6; candidate += 0.4) {
          if (!ground(candidate, drum.z)) continue;
          const room = drum.clearanceAt(candidate, player.position.y + player.height / 2);
          if (!best || room > best.room) best = { x: candidate, room };
        }
        if (best && Math.abs(best.x - x) > 0.35) keys.push(best.x > x ? 'KeyA' : 'KeyD');
      } else if (swing) {
        // Whichever on-deck lane is furthest from the bob. Derived from the
        // deck rather than a fixed offset, so it works on any width.
        let side = null;
        for (let candidate = -7; candidate <= 7; candidate += 0.5) {
          if (!ground(candidate, swing.z)) continue;
          const clearance = Math.abs(candidate - swing.bobX);
          if (side === null || clearance > side.clearance) side = { x: candidate, clearance };
        }
        if (side && Math.abs(side.x - x) > 0.4) keys.push(side.x > x ? 'KeyA' : 'KeyD');
      } else if (hazard) {
        // Take whichever side still has deck under it, preferring the near one.
        const clearance = hazard.radius + player.radius + 0.7;
        const lane = [hazard.x + clearance, hazard.x - clearance]
          .filter((candidate) => ground(candidate, hazard.z))
          .sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0];
        // Screen-right (KeyD) moves toward world -X, so aim with the opposite key.
        if (lane !== undefined) keys.push(lane > x ? 'KeyA' : 'KeyD');
      } else if (spark && Math.abs(spark.position.x - x) > 0.4) {
        keys.push(spark.position.x > x ? 'KeyA' : 'KeyD');
      } else {
        // Hold the middle. On a turntable "the middle" is its hub, not the
        // course centreline — near the rim the spin drags you off.
        const carrier = [...discs, ...sliders].find((o) => player.groundDeck === o.deck);
        const lane = carrier ? carrier.deck.x : 0;
        const slack = carrier ? 0.7 : 2.6;
        if (!spark && Math.abs(x - lane) > slack) keys.push(lane > x ? 'KeyA' : 'KeyD');
      }
    }

    game._keys = new Set(keys);
    game.stepSimulation(STEP);
    frames += 1;
  }

  game._keys = new Set();
  game.headless = false;
  game.renderer.setAnimationLoop(game._loop);

  return {
    finished: game.state === 'finished' && game.outcome === 'won',
    outcome: game.state === 'finished' ? game.outcome : null,
    seconds: Number((frames / 60).toFixed(2)),
    falls: game.falls,
    furthestZ: Number(furthestZ.toFixed(1)),
    peakY: Number(peakY.toFixed(1)),
  };
}
