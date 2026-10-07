import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canMeleeHit,
  crossedMeleeHitWindow,
  orientedBoxIntersectsDisc,
  orientedBoxesOverlap,
  resolvedLocomotionDistance,
  resolveDiscStep,
  separationVector,
  stepPlanarVelocity,
  type Disc,
} from './combat-physics.ts';

describe('grounded combat physics', () => {
  it('sweeps without tunneling and preserves a safe slide', () => {
    const obstacle: Disc = { x: 0, z: 0, radius: 0.7 };
    const stopped = resolveDiscStep({ x: -3, z: 0 }, { x: 3, z: 0 }, 0.45, [obstacle]);
    const slid = resolveDiscStep({ x: -1.4, z: -0.8 }, { x: 0.3, z: 1.2 }, 0.45, [obstacle]);
    const escaped = resolveDiscStep({ x: 0, z: 0 }, { x: -2, z: 0 }, 0.45, [obstacle]);

    assert.ok(stopped.x < -1.1);
    assert.ok(Math.hypot(stopped.x - obstacle.x, stopped.z - obstacle.z) >= 1.15 - 1e-6);
    assert.ok(Math.hypot(slid.x - obstacle.x, slid.z - obstacle.z) >= 1.15 - 1e-6);
    assert.ok(slid.z > -0.8);
    assert.ok(escaped.x < -1.1);
  });

  it('returns the minimum separating displacement for overlapping discs', () => {
    const separation = separationVector(
      { x: 0, z: 0, radius: 0.8 },
      { x: 1, z: 0, radius: 0.7 },
    );

    assert.deepEqual(separation, { x: -0.5, z: 0 });
  });

  it('requires range, facing, and an unobstructed attack lane', () => {
    const attacker = { x: 0, z: 0, yaw: 0 };
    const front = { x: 0, z: 3 };
    const behind = { x: 0, z: -2 };

    assert.equal(canMeleeHit(attacker, front, 4, Math.PI / 4), true);
    assert.equal(canMeleeHit(attacker, behind, 4, Math.PI / 4), false);
    assert.equal(canMeleeHit(attacker, { x: 0, z: 5 }, 4, Math.PI / 4), false);
    assert.equal(canMeleeHit(attacker, front, 4, Math.PI / 4, [{ x: 0, z: 1.5, radius: 0.5 }]), false);
  });

  it('fires a melee hit once when the visible swing crosses contact', () => {
    assert.equal(crossedMeleeHitWindow(0, 0.45, false), false);
    assert.equal(crossedMeleeHitWindow(0.45, 0.48, false), true);
    assert.equal(crossedMeleeHitWindow(0.48, 0.9, false), false);
    assert.equal(crossedMeleeHitWindow(0.45, 0.48, true), false);
    assert.equal(crossedMeleeHitWindow(0.2, 1.2, false), true);
    assert.equal(crossedMeleeHitWindow(Number.NaN, 0.62, false), false);
  });

  it('reports locomotion from the resolved step so a blocked push produces no footstep', () => {
    const from = { x: -1.15, z: 0 };
    const blocked = resolveDiscStep(from, { x: 1, z: 0 }, 0.45, [{ x: 0, z: 0, radius: 0.7 }]);
    const clear = resolveDiscStep(from, { x: -1.15, z: -1 }, 0.45, [{ x: 0, z: 0, radius: 0.7 }]);

    assert.equal(resolvedLocomotionDistance(from, blocked), 0);
    assert.ok(resolvedLocomotionDistance(from, clear) > 0.9);
    assert.equal(resolvedLocomotionDistance(from, { x: from.x + 1e-7, z: from.z }), 0);
  });

  it('accelerates, normalizes diagonals, and brakes without snapping', () => {
    const started = stepPlanarVelocity({ x: 0, z: 0 }, { x: 1, z: 1 }, 8, 18, 24, 0.1);
    const cruising = stepPlanarVelocity(started, { x: 1, z: 1 }, 8, 18, 24, 1);
    const braking = stepPlanarVelocity(cruising, { x: 0, z: 0 }, 8, 18, 24, 0.1);

    assert.ok(Math.hypot(started.x, started.z) > 0 && Math.hypot(started.x, started.z) < 8);
    assert.ok(Math.abs(Math.hypot(cruising.x, cruising.z) - 8) < 1e-6);
    assert.ok(Math.hypot(braking.x, braking.z) > 0 && Math.hypot(braking.x, braking.z) < 8);
    assert.deepEqual(stepPlanarVelocity(cruising, { x: 0, z: 0 }, 8, 18, 24, -1), cruising);
  });

  it('rejects intersecting rotated structure footprints without blocking clear neighbors', () => {
    const foundation = { x: 0, z: 0, halfWidth: 1.7, halfDepth: 1.55, yaw: 0 };

    assert.equal(orientedBoxesOverlap(
      foundation,
      { x: 1.9, z: 0, halfWidth: 1.65, halfDepth: 0.36, yaw: Math.PI / 2 },
    ), true);
    assert.equal(orientedBoxesOverlap(
      foundation,
      { x: 2.2, z: 0, halfWidth: 1.65, halfDepth: 0.36, yaw: Math.PI / 2 },
    ), false);
    assert.equal(orientedBoxesOverlap(
      foundation,
      { x: 0, z: 2.1, halfWidth: 1.65, halfDepth: 0.36, yaw: Math.PI / 4 },
    ), true);
    assert.equal(orientedBoxIntersectsDisc(foundation, { x: 1.9, z: 0, radius: 0.3 }), true);
    assert.equal(orientedBoxIntersectsDisc(foundation, { x: 2.1, z: 0, radius: 0.3 }), false);
  });
});
