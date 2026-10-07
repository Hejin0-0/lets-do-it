import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './palette.js';
import { toy } from './materials.js';
import { closestPointOnSegment, radialPush } from './physics.js';

/**
 * Anything that moves and can shove the player.
 *
 * Contract with the rest of the game:
 *  - `group`  goes into the scene
 *  - `decks`  are standable surfaces this obstacle owns (may be empty). Each
 *             deck carries `dx`/`dz`, the distance it moved this frame, so a
 *             player riding it gets carried along.
 *  - `update(dt, time)` runs before the player moves
 *  - `affect(player, effects)` runs after, and may push the player around
 */
// `Sweeper`, `MovingPlatform`, `Pendulum`, `Bumper`
export class Obstacle {
  constructor(kind) {
    /** Set by each subclass so the level validator can classify without duck-typing. */
    this.kind = kind;
    this.group = new THREE.Group();
    this.decks = [];
  }

  update() {}

  affect() {}
}

/**
 * A rotating sweeper: a post with chunky striped arms at shin height. Jump the
 * arms or get launched. Readable on purpose — the arms are at a fixed height
 * and always sweep the full width of their deck.
 */
export class Sweeper extends Obstacle {
  constructor({ x, z, y = 0, reach = 5.5, arms = 2, speed = 1.6, height = 0.95 }) {
    super('sweeper');
    this.x = x;
    this.z = z;
    this.baseY = y;
    this.reach = reach;
    this.armCount = arms;
    this.speed = speed;
    this.barY = y + height;
    this.barRadius = 0.3;
    this.angle = Math.random() * Math.PI * 2;

    this.group.position.set(x, y, z);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.55, height + 0.5, 20),
      toy(PALETTE.post, { roughness: 0.32 })
    );
    post.position.y = (height + 0.5) / 2;
    post.castShadow = true;
    post.receiveShadow = true;
    this.group.add(post);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 20, 14),
      toy(PALETTE.gate, { roughness: 0.2 })
    );
    cap.position.y = height + 0.5;
    cap.castShadow = true;
    this.group.add(cap);

    this.pivot = new THREE.Group();
    this.pivot.position.y = height;
    this.group.add(this.pivot);

    const barGeometry = new RoundedBoxGeometry(reach, 0.56, 0.56, 3, 0.24);
    for (let i = 0; i < arms; i += 1) {
      const arm = new THREE.Group();
      arm.rotation.y = (i / arms) * Math.PI * 2;

      const bar = new THREE.Mesh(barGeometry, toy(PALETTE.sweeperBar, { roughness: 0.22 }));
      bar.position.x = reach / 2;
      bar.castShadow = true;
      bar.receiveShadow = true;
      arm.add(bar);

      // Hazard stripes: chunky bands so the sweep direction reads at a glance.
      const stripeGeometry = new THREE.BoxGeometry(0.34, 0.6, 0.6);
      const stripeMaterial = toy(PALETTE.sweeperStripe, { roughness: 0.2 });
      for (let s = 0; s < 4; s += 1) {
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.position.x = reach * (0.18 + s * 0.2);
        arm.add(stripe);
      }

      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 16, 12),
        toy(PALETTE.gateGlow, { roughness: 0.18 })
      );
      tip.position.x = reach;
      tip.castShadow = true;
      arm.add(tip);

      this.pivot.add(arm);
    }
  }

  update(dt) {
    this.angle += this.speed * dt;
    this.pivot.rotation.y = this.angle;
  }

  affect(player, effects) {
    if (player.stagger > 0) return;

    const halfBar = 0.34;
    const feet = player.position.y;
    const head = feet + player.height;
    if (feet > this.barY + halfBar || head < this.barY - halfBar) return;

    for (let i = 0; i < this.armCount; i += 1) {
      const theta = this.angle + (i / this.armCount) * Math.PI * 2;
      // A Y-rotation of theta sends local +X to (cos theta, 0, -sin theta).
      const dirX = Math.cos(theta);
      const dirZ = -Math.sin(theta);
      const tipX = this.x + dirX * this.reach;
      const tipZ = this.z + dirZ * this.reach;

      const hit = closestPointOnSegment(
        player.position.x,
        player.position.z,
        this.x,
        this.z,
        tipX,
        tipZ
      );
      if (hit.distance > player.radius + this.barRadius) continue;

      // Tangential velocity at the contact point, i.e. d/dtheta of the arm.
      const sign = Math.sign(this.speed) || 1;
      const tangentX = -Math.sin(theta) * sign;
      const tangentZ = -Math.cos(theta) * sign;

      const outLength = Math.max(0.001, Math.hypot(hit.x - this.x, hit.z - this.z));
      const outX = (hit.x - this.x) / outLength;
      const outZ = (hit.z - this.z) / outLength;

      // Sized to cost you time, not the run: a centre-deck hit slides you
      // roughly 3 units sideways, well inside the runway's 6-unit half-width.
      // Near the edge it still throws you off, which is the point.
      player.knockBack(tangentX * 6.5 + outX * 1.5, 5, tangentZ * 6.5 + outZ * 1.5, 0.3);
      effects.burst(
        'sweep',
        { x: hit.x, y: this.barY, z: hit.z },
        { dir: { x: tangentX, z: tangentZ }, strength: 1.15 }
      );
      return;
    }
  }
}

/** A glossy slab that slides back and forth. Ride it; it carries you. */
export class MovingPlatform extends Obstacle {
  constructor({ x, z, y = 0, hw = 2.6, hd = 2.6, axis = 'x', range = 5, period = 5, phase = 0 }) {
    super('slider');
    this.homeX = x;
    this.homeY = y;
    this.homeZ = z;
    this.axis = axis;
    this.range = range;
    this.period = period;
    this.phase = phase;
    this.thickness = 0.7;

    this.deck = { x, z, hw, hd, y, dx: 0, dz: 0 };
    this.decks.push(this.deck);

    const slab = new THREE.Mesh(
      new RoundedBoxGeometry(hw * 2, this.thickness, hd * 2, 4, 0.22),
      toy(PALETTE.movingDeck, { roughness: 0.2 })
    );
    slab.position.y = y - this.thickness / 2;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.group.add(slab);

    // Arrow decals so the travel axis is obvious before you step on. A lift
    // gets a ring instead — an arrow lying flat cannot point upward.
    if (axis === 'y') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(hw * 0.55, 0.1, 8, 24),
        toy(PALETTE.cream, { roughness: 0.3 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, y + 0.03, 0);
      this.group.add(ring);
    } else {
      const chevron = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.7, 3),
        toy(PALETTE.cream, { roughness: 0.3 })
      );
      chevron.rotation.x = -Math.PI / 2;
      chevron.rotation.z = axis === 'x' ? Math.PI / 2 : 0;
      chevron.position.set(0, y + 0.02, 0);
      this.group.add(chevron);
    }

    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 1.5, 12),
      toy(PALETTE.post, { roughness: 0.4 })
    );
    skirt.position.y = y - this.thickness - 0.75;
    this.group.add(skirt);

    this.update(0, 0);
  }

  update(dt, time) {
    const offset = Math.sin((time / this.period) * Math.PI * 2 + this.phase) * this.range;
    const nextX = this.axis === 'x' ? this.homeX + offset : this.homeX;
    const nextY = this.axis === 'y' ? this.homeY + offset : this.homeY;
    const nextZ = this.axis === 'z' ? this.homeZ + offset : this.homeZ;

    this.deck.dx = nextX - this.deck.x;
    this.deck.dz = nextZ - this.deck.z;
    this.deck.x = nextX;
    this.deck.z = nextZ;
    // Vertical travel needs no carry: the ground probe already sweeps a step's
    // worth each frame, so a rider is picked up by the deck coming to them.
    this.deck.y = nextY;

    this.group.position.set(nextX, nextY - this.homeY, nextZ);
  }
}

/**
 * A swinging bob on a rod, sweeping across the path.
 *
 * Unlike a sweeper it does not cover its deck evenly: the bob is only low
 * enough to hit you near the bottom of its arc, so the outer edges of a wide
 * enough deck stay passable. That is the point — a sweeper is answered by
 * jumping, a pendulum by choosing a side, and a row of them with staggered
 * phases means the side keeps changing.
 */
export class Pendulum extends Obstacle {
  constructor({
    x = 0,
    z,
    y = 0,
    pivotY = 5,
    length = 4.1,
    amplitude = 0.8,
    period = 2.6,
    phase = 0,
    bobRadius = 0.8,
    frameHalfWidth = 4.6,
  }) {
    super('pendulum');
    this.x = x;
    this.z = z;
    this.baseY = y;
    this.pivotY = pivotY;
    this.length = length;
    this.amplitude = amplitude;
    this.period = period;
    this.phase = phase;
    this.bobRadius = bobRadius;
    this.angle = 0;
    this.angularVelocity = 0;

    this.group.position.set(x, y, z);

    // Legs to the sides, never down the middle: a post at x=0 collides with
    // nothing but reads as a wall you are supposed to go around.
    const legOffset = frameHalfWidth;
    const legGeometry = new THREE.CylinderGeometry(0.2, 0.24, pivotY, 12);
    for (const side of [-legOffset, legOffset]) {
      const leg = new THREE.Mesh(legGeometry, toy(PALETTE.post, { roughness: 0.35 }));
      leg.position.set(side, pivotY / 2, 0);
      leg.castShadow = true;
      this.group.add(leg);
    }

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(legOffset * 2, 0.34, 0.34),
      toy(PALETTE.post, { roughness: 0.35 })
    );
    beam.position.set(0, pivotY, 0);
    beam.castShadow = true;
    this.group.add(beam);

    this.arm = new THREE.Group();
    this.arm.position.y = pivotY;
    this.group.add(this.arm);

    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, length, 10),
      toy(PALETTE.cream, { roughness: 0.35 })
    );
    rod.position.y = -length / 2;
    this.arm.add(rod);

    const bob = new THREE.Mesh(
      new THREE.SphereGeometry(bobRadius, 22, 16),
      toy(PALETTE.balloonA, { roughness: 0.18 })
    );
    bob.position.y = -length;
    bob.castShadow = true;
    this.arm.add(bob);

    // A stripe so the spin reads and the bob does not look like a balloon.
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(bobRadius * 0.96, 0.12, 8, 24),
      toy(PALETTE.cream, { roughness: 0.3 })
    );
    stripe.rotation.y = Math.PI / 2;
    stripe.position.y = -length;
    this.arm.add(stripe);

    this.update(0, 0);
  }

  /** Where the bob is right now, in world space. */
  get bobX() {
    return this.x + Math.sin(this.angle) * this.length;
  }

  get bobY() {
    return this.baseY + this.pivotY - Math.cos(this.angle) * this.length;
  }

  /** How far from centre the bob ever reaches — used by the level validator. */
  get sweepHalfWidth() {
    return Math.sin(this.amplitude) * this.length;
  }

  update(dt, time) {
    const w = (Math.PI * 2) / this.period;
    this.angle = this.amplitude * Math.sin(w * time + this.phase);
    this.angularVelocity = this.amplitude * w * Math.cos(w * time + this.phase);
    this.arm.rotation.z = -this.angle;
    void dt;
  }

  affect(player, effects) {
    if (player.stagger > 0) return;

    const dx = player.position.x - this.bobX;
    const dz = player.position.z - this.z;
    const dy = player.position.y + player.height / 2 - this.bobY;
    const reach = this.bobRadius + player.radius;
    if (dx * dx + dy * dy + dz * dz > reach * reach) return;

    // Thrown the way the bob is travelling, which is along X at the bottom.
    // Sized like the sweeper's: a hit from mid-deck slides you about two units
    // and costs you time. At 9 it displaced over three, which on the narrow
    // deck a pendulum wants to live on meant every single hit ended the run.
    const direction = Math.sign(this.angularVelocity * Math.cos(this.angle)) || 1;
    player.knockBack(direction * 6, 5.2, 0, 0.32);
    effects.burst(
      'bump',
      { x: this.bobX, y: this.bobY - this.bobRadius, z: this.z },
      { dir: { x: direction, z: 0 }, strength: 1.2 }
    );
  }
}

/**
 * A turntable. Stand on it and it carries you around; the further out you are,
 * the faster you travel, which is the whole obstacle — land near the rim and it
 * throws you off before you can line up the next jump.
 *
 * Its deck is round rather than a box, so the corners of the bounding square
 * are not standable. On a spinning platform those corners are exactly where a
 * player would be when they fall.
 */
export class RotatingDisc extends Obstacle {
  constructor({ x, z, y = 0, radius = 3.4, spin = 0.55, color = PALETTE.movingDeck }) {
    super('disc');
    this.x = x;
    this.z = z;
    this.radius = radius;
    this.spin = spin;
    this.angle = 0;

    this.deck = { shape: 'disc', x, z, y, radius, dx: 0, dz: 0, spin };
    this.decks.push(this.deck);

    this.group.position.set(x, y, z);

    this.plate = new THREE.Group();
    this.group.add(this.plate);

    const slab = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.94, 0.7, 40),
      toy(color, { roughness: 0.2 })
    );
    slab.position.y = -0.35;
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.plate.add(slab);

    // Spokes, or a spinning disc looks completely still.
    const spokeGeometry = new THREE.BoxGeometry(radius * 0.86, 0.06, 0.34);
    const spokeMaterial = toy(PALETTE.cream, { roughness: 0.3 });
    for (let i = 0; i < 4; i += 1) {
      const spoke = new THREE.Mesh(spokeGeometry, spokeMaterial);
      spoke.position.set(0, 0.02, 0);
      spoke.rotation.y = (i / 4) * Math.PI * 2;
      spoke.translateX(radius * 0.5);
      this.plate.add(spoke);
    }

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.16, 20),
      toy(PALETTE.gate, { roughness: 0.2 })
    );
    hub.position.y = 0.06;
    this.plate.add(hub);

    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.5, 2.2, 14),
      toy(PALETTE.post, { roughness: 0.5 })
    );
    skirt.position.y = -1.8;
    skirt.rotation.x = Math.PI;
    this.group.add(skirt);
  }

  update(dt) {
    this.angle += this.spin * dt;
    // `rotateAbout` turns +X toward +Z; a Y rotation in three turns it toward
    // -Z. Negating keeps the mesh and the rider going the same way.
    this.plate.rotation.y = -this.angle;
  }
}

/**
 * A drum you run through, with wall panels sweeping around the inside.
 *
 * Where a sweeper turns about the vertical and is answered by jumping, this
 * turns about the direction of travel: the panels come down across the
 * corridor, so the answer is to be somewhere else when one arrives.
 */
export class RotorTunnel extends Obstacle {
  constructor({
    x = 0,
    z,
    y = 0,
    axisY = 3,
    radius = 3.8,
    innerRadius = 0.7,
    panels = 3,
    speed = 0.9,
    depth = 1,
    panelThickness = 0.36,
    color = PALETTE.bumperDeck,
  }) {
    super('rotor');
    this.x = x;
    this.z = z;
    this.axisY = y + axisY;
    this.radius = radius;
    this.innerRadius = innerRadius;
    this.panelCount = panels;
    this.speed = speed;
    this.depth = depth;
    this.panelThickness = panelThickness;
    this.angle = Math.random() * Math.PI * 2;

    this.group.position.set(x, this.axisY, z);

    this.drum = new THREE.Group();
    this.group.add(this.drum);

    // Rims rather than a closed shell: a solid tunnel would hide the corridor
    // and the panel that is about to arrive in it.
    for (const side of [-depth, depth]) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.2, 10, 40),
        toy(PALETTE.post, { roughness: 0.35 })
      );
      rim.position.z = side;
      this.drum.add(rim);
    }

    const panelLength = radius - innerRadius;
    const panelGeometry = new RoundedBoxGeometry(
      panelLength,
      panelThickness,
      depth * 1.8,
      3,
      0.14
    );
    for (let i = 0; i < panels; i += 1) {
      const arm = new THREE.Group();
      arm.rotation.z = (i / panels) * Math.PI * 2;

      const panel = new THREE.Mesh(panelGeometry, toy(color, { roughness: 0.22 }));
      panel.position.x = innerRadius + panelLength / 2;
      panel.castShadow = true;
      arm.add(panel);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(panelThickness * 0.9, 14, 10),
        toy(PALETTE.gateGlow, { roughness: 0.2 })
      );
      cap.position.x = radius;
      arm.add(cap);

      this.drum.add(arm);
    }
  }

  update(dt) {
    this.angle += this.speed * dt;
    this.drum.rotation.z = this.angle;
  }

  /**
   * Distance from a point in the corridor to the nearest panel. Sampling this
   * is how anything picks a lane — it is the same measurement `affect` makes,
   * so a lane it calls clear really is.
   */
  clearanceAt(worldX, worldY) {
    const px = worldX - this.x;
    const py = worldY - this.axisY;
    let nearest = Infinity;
    for (let i = 0; i < this.panelCount; i += 1) {
      const theta = this.angle + (i / this.panelCount) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const hit = closestPointOnSegment(
        px,
        py,
        cos * this.innerRadius,
        sin * this.innerRadius,
        cos * this.radius,
        sin * this.radius
      );
      nearest = Math.min(nearest, hit.distance);
    }
    return nearest;
  }

  affect(player, effects) {
    if (player.stagger > 0) return;
    if (Math.abs(player.position.z - this.z) > this.depth + player.radius) return;

    const px = player.position.x - this.x;
    const py = player.position.y + player.height / 2 - this.axisY;
    const reach = this.panelThickness / 2 + player.radius;

    for (let i = 0; i < this.panelCount; i += 1) {
      const theta = this.angle + (i / this.panelCount) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // The panel is a segment in the plane across the corridor; reuse the
      // XZ helper by feeding it (x, y) instead.
      const hit = closestPointOnSegment(
        px,
        py,
        cos * this.innerRadius,
        sin * this.innerRadius,
        cos * this.radius,
        sin * this.radius
      );
      if (hit.distance > reach) continue;

      // Velocity at the contact point of a body turning about +Z.
      const direction = Math.sign(-this.speed * hit.z) || 1;
      player.knockBack(direction * 6, 5.2, 0, 0.32);
      effects.burst(
        'bump',
        { x: this.x + hit.x, y: this.axisY + hit.z, z: this.z },
        { dir: { x: direction, z: 0 }, strength: 1.1 }
      );
      return;
    }
  }
}

/** A springy mushroom. Clip its side and you get shoved; land on top and you fly. */
export class Bumper extends Obstacle {
  constructor({ x, z, y = 0, radius = 0.85, height = 1.5 }) {
    super('bumper');
    this.x = x;
    this.z = z;
    this.radius = radius;
    this.topY = y + height;
    this.squash = 0;
    this.bob = Math.random() * Math.PI * 2;

    this.group.position.set(x, y, z);

    this.body = new THREE.Group();
    this.group.add(this.body);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.72, radius * 0.95, height, 22),
      toy(PALETTE.bumper, { roughness: 0.24 })
    );
    stem.position.y = height / 2;
    stem.castShadow = true;
    stem.receiveShadow = true;
    this.body.add(stem);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      toy(PALETTE.bumperCap, { roughness: 0.16 })
    );
    cap.position.y = height;
    cap.castShadow = true;
    this.body.add(cap);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.98, 0.11, 10, 28),
      toy(PALETTE.cream, { roughness: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height;
    this.body.add(ring);

    // The dome doubles as a launch pad.
    this.decks.push({
      x,
      z,
      hw: radius * 0.6,
      hd: radius * 0.6,
      y: this.topY,
      dx: 0,
      dz: 0,
      bounce: 15.5,
    });
  }

  update(dt, time) {
    this.squash = Math.max(0, this.squash - dt * 4);
    this.bob = time * 1.6;

    const pop = this.squash * this.squash;
    const idle = Math.sin(this.bob) * 0.03;
    this.body.scale.set(1 + pop * 0.28 + idle * 0.5, 1 - pop * 0.34 + idle, 1 + pop * 0.28 + idle * 0.5);
    this.body.rotation.y = Math.sin(this.bob * 0.6) * 0.12;
  }

  affect(player, effects) {
    // Standing on the dome is handled by the deck; only the sides bump.
    if (player.position.y > this.topY - 0.35) return;
    if (player.position.y + player.height < 0.1) return;

    const push = radialPush(
      player.position.x,
      player.position.z,
      this.x,
      this.z,
      this.radius + player.radius
    );
    if (!push) return;

    player.position.x += push.nx * push.depth;
    player.position.z += push.nz * push.depth;
    player.knockBack(push.nx * 10, 6.4, push.nz * 10, 0.26);

    this.squash = 1;
    effects.burst(
      'bump',
      { x: this.x + push.nx * this.radius, y: player.position.y + 0.5, z: this.z + push.nz * this.radius },
      { dir: { x: push.nx, z: push.nz }, strength: 1.1 }
    );
  }
}
