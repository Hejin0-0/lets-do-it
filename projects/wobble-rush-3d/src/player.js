import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { toy } from './materials.js';
import { DEFAULT_CHARACTER_ID, getCharacter } from './characters.js';
import { approach, clamp, damp, rotateAbout, shortestAngle } from './physics.js';

/**
 * Arcade tuning. These are not physical units — they are the numbers that make
 * a Wobbler feel bouncy and forgiving. Airtime is ~0.74 s and a jump carries
 * ~6.8 units, which is more than double the widest gap on the course.
 */
const TUNING = {
  gravity: 34,
  terminalVelocity: -42,
  maxSpeed: 9.2,
  groundAccel: 62,
  airAccel: 34,
  groundFriction: 52,
  airFriction: 7,
  jumpSpeed: 12.6,
  jumpCutoff: 0.45,
  coyoteTime: 0.13,
  jumpBuffer: 0.14,
  diveSpeed: 16.5,
  diveTime: 0.42,
  diveCooldown: 1.05,
  diveHopGround: 4.2,
  diveHopAir: 1.4,
  stepTolerance: 0.35,
  edgeForgiveness: 0.3,
};

export class Player {
  constructor(scene, character = getCharacter(DEFAULT_CHARACTER_ID)) {
    this.character = character;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.radius = 0.42;
    this.height = 1.15;

    this.grounded = false;
    this.groundDeck = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.stagger = 0;
    this.diving = false;
    this.diveTimer = 0;
    this.diveCooldown = 0;
    this.facing = 0;

    this._wasJumpHeld = false;
    this._squash = 0;
    this._runPhase = 0;
    this._shadowGround = 0;

    /** Wired up by Game. */
    this.onJump = null;
    this.onLand = null;
    this.onDive = null;

    this.group = new THREE.Group();
    this.visual = new THREE.Group();
    this.group.add(this.visual);
    this._buildModel(character);
    scene.add(this.group);
  }

  get diveReady() {
    return this.diveCooldown <= 0 && !this.diving;
  }

  // ------------------------------------------------------------------- model

  _buildModel(character) {
    const bodyMaterial = toy(character.body, { roughness: 0.2 });
    const limbMaterial = toy(character.limb, { roughness: 0.3 });
    const bellyMaterial = toy(character.belly, { roughness: 0.35 });
    const visorMaterial = toy(character.visor, { roughness: 0.08 });
    const eyeMaterial = toy(PALETTE.ink, { roughness: 0.2 });

    // Two overlapping spheres, the lower one wider: a bottom-heavy silhouette
    // reads as soft and weighted, and it squashes far better than one ball.
    // Everything stays under the 1.15-unit collision height on purpose — a
    // model taller than its own hitbox is the kind of mismatch nobody can see
    // but everybody feels.
    const legGeometry = new THREE.CapsuleGeometry(0.145, 0.09, 4, 12);
    this.legs = [-1, 1].map((side) => {
      const leg = new THREE.Mesh(legGeometry, limbMaterial);
      leg.position.set(side * 0.185, 0.15, 0);
      leg.castShadow = true;
      this.visual.add(leg);
      return leg;
    });

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.48, 28, 20), bodyMaterial);
    belly.position.y = 0.45;
    belly.scale.set(1, 0.95, 0.92);
    belly.castShadow = true;
    belly.receiveShadow = true;
    this.visual.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 26, 18), bodyMaterial);
    head.position.y = 0.83;
    head.scale.set(1.03, 1, 0.96);
    head.castShadow = true;
    this.visual.add(head);

    // A flattened plate pressed onto the chest, sitting slightly proud of the
    // body. Tucked inside it disappears entirely; slung low it only pokes out
    // where the body curves away underneath, which reads as a nappy.
    const bib = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 16), bellyMaterial);
    bib.position.set(0, 0.5, 0.34);
    bib.scale.set(1, 0.95, 0.42);
    this.visual.add(bib);

    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.285, 24, 16), visorMaterial);
    visor.position.set(0, 0.87, 0.18);
    visor.scale.set(1.16, 0.76, 0.6);
    this.visual.add(visor);

    const eyeGeometry = new THREE.SphereGeometry(0.058, 12, 10);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(side * 0.108, 0.885, 0.33);
      this.visual.add(eye);
    }

    // Stubby and low-set, so the body reads as the character and the arms as
    // punctuation rather than limbs doing work.
    const armGeometry = new THREE.CapsuleGeometry(0.125, 0.13, 4, 12);
    this.arms = [-1, 1].map((side) => {
      const arm = new THREE.Mesh(armGeometry, limbMaterial);
      arm.position.set(side * 0.47, 0.5, 0.05);
      arm.rotation.z = side * 0.3;
      arm.castShadow = true;
      this.visual.add(arm);
      return arm;
    });

    this.accessory = this._buildAccessory(character, limbMaterial);
    this.accessory.position.set(0, 1.13, 0);
    this.visual.add(this.accessory);

    // A soft contact shadow, so height above a deck always reads.
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24),
      new THREE.MeshBasicMaterial({
        color: PALETTE.ink,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.group.add(this.blob);
  }

  /**
   * The head piece that gives each Wobbler its silhouette. Every variant sits
   * in a group whose origin is the top of the head, so `_animate` can lag it
   * behind the body without knowing which one it built.
   */
  _buildAccessory(character, limbMaterial) {
    const group = new THREE.Group();
    const accent = toy(character.accessoryColor, {
      roughness: 0.12,
      emissive: character.accessoryColor,
      emissiveIntensity: 0.25,
    });

    switch (character.accessory) {
      case 'antenna': {
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.042, 0.34, 8),
          limbMaterial
        );
        stalk.position.y = 0.17;
        group.add(stalk);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), accent);
        bulb.position.y = 0.38;
        bulb.castShadow = true;
        group.add(bulb);
        break;
      }

      case 'crest': {
        // A three-spine mohawk running front to back.
        const spine = new THREE.ConeGeometry(0.085, 0.3, 6);
        [-0.14, 0, 0.14].forEach((z, index) => {
          const quill = new THREE.Mesh(spine, accent);
          quill.position.set(0, 0.1 + (index === 1 ? 0.09 : 0), z);
          quill.rotation.x = -z * 1.6;
          quill.castShadow = true;
          group.add(quill);
        });
        break;
      }

      case 'fin': {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.46, 4), accent);
        blade.scale.set(0.32, 1, 1);
        blade.position.y = 0.2;
        blade.rotation.y = Math.PI / 4;
        blade.rotation.x = -0.18;
        blade.castShadow = true;
        group.add(blade);
        break;
      }

      case 'ears': {
        const earGeometry = new THREE.CapsuleGeometry(0.07, 0.2, 4, 10);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(earGeometry, accent);
          ear.position.set(side * 0.15, 0.16, 0);
          ear.rotation.z = side * 0.42;
          ear.castShadow = true;
          group.add(ear);
        }
        break;
      }

      case 'sprig': {
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.036, 0.24, 8),
          limbMaterial
        );
        stem.position.y = 0.12;
        group.add(stem);

        const leaf = new THREE.SphereGeometry(0.12, 14, 10);
        for (const side of [-1, 1]) {
          const petal = new THREE.Mesh(leaf, accent);
          petal.scale.set(1, 0.42, 0.65);
          petal.position.set(side * 0.11, 0.26, 0);
          petal.rotation.z = side * 0.5;
          petal.castShadow = true;
          group.add(petal);
        }
        break;
      }

      case 'halo': {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.038, 10, 24), accent);
        ring.position.y = 0.34;
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        group.add(ring);
        break;
      }

      default:
        throw new Error(
          `Player: unknown accessory "${character.accessory}" on character "${character.id}"`
        );
    }

    return group;
  }

  /** Tear down so another Wobbler can take the stage. */
  dispose() {
    this.group.traverse((object) => {
      if (object.isMesh) object.geometry.dispose();
    });
    // Materials come from the shared `toy` cache, except this one.
    this.blob.material.dispose();
    this.group.parent?.remove(this.group);
  }

  // ----------------------------------------------------------------- control

  respawnAt(point) {
    this.position.copy(point);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.groundDeck = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.stagger = 0;
    this.diving = false;
    this.diveTimer = 0;
    this.diveCooldown = 0;
    this._squash = 0;
    this.facing = 0;
    this.group.position.copy(this.position);
    this.group.rotation.y = 0;
    this.visual.rotation.set(0, 0, 0);
    this.visual.scale.setScalar(this.character.bodyScale);
  }

  /** Launch the player and briefly take away fine control. */
  knockBack(vx, vy, vz, staggerTime) {
    this.velocity.set(vx, vy, vz);
    this.stagger = Math.max(this.stagger, staggerTime);
    this.grounded = false;
    this.groundDeck = null;
    this.coyote = 0;
    this.diving = false;
    this.diveTimer = 0;
  }

  /**
   * @param {number} dt seconds, already clamped by the caller
   * @param {{moveX:number, moveZ:number, jumpHeld:boolean, divePressed:boolean}} input
   *   `moveX`/`moveZ` are a camera-relative unit-ish vector.
   */
  update(dt, input, course) {
    this._tickTimers(dt, input);
    this._applyDive(input);
    this._applyMovement(dt, input);
    this._integrate(dt, input, course);
    this._animate(dt, input);
  }

  _tickTimers(dt, input) {
    this.stagger = Math.max(0, this.stagger - dt);
    this.diveCooldown = Math.max(0, this.diveCooldown - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.diving) {
      this.diveTimer -= dt;
      if (this.diveTimer <= 0) this.diving = false;
    }

    // Buffered jump: pressing just before you land still jumps.
    if (input.jumpHeld && !this._wasJumpHeld) this.jumpBuffer = TUNING.jumpBuffer;

    // Variable height: let go early and the hop is short.
    if (!input.jumpHeld && this._wasJumpHeld && this.velocity.y > 0) {
      this.velocity.y *= TUNING.jumpCutoff;
    }
    this._wasJumpHeld = input.jumpHeld;
  }

  _applyDive(input) {
    if (!input.divePressed || !this.diveReady) return;

    const hasInput = input.moveX !== 0 || input.moveZ !== 0;
    const dirX = hasInput ? input.moveX : Math.sin(this.facing);
    const dirZ = hasInput ? input.moveZ : Math.cos(this.facing);
    const length = Math.hypot(dirX, dirZ) || 1;

    this.diving = true;
    this.diveTimer = TUNING.diveTime;
    this.diveCooldown = TUNING.diveCooldown;
    this.velocity.x = (dirX / length) * TUNING.diveSpeed;
    this.velocity.z = (dirZ / length) * TUNING.diveSpeed;
    this.velocity.y =
      Math.max(this.velocity.y, 0) +
      (this.grounded ? TUNING.diveHopGround : TUNING.diveHopAir);
    this.grounded = false;
    this.coyote = 0;

    if (this.onDive) this.onDive();
  }

  _applyMovement(dt, input) {
    const hasInput = input.moveX !== 0 || input.moveZ !== 0;

    // While diving or staggered you commit to the arc — that is the trade.
    let control = 1;
    if (this.diving) control = 0.22;
    else if (this.stagger > 0) control = 0.3;

    const accel = (this.grounded ? TUNING.groundAccel : TUNING.airAccel) * control;
    const friction = (this.grounded ? TUNING.groundFriction : TUNING.airFriction) * control;
    const rate = (hasInput ? accel : friction) * dt;

    const targetX = input.moveX * TUNING.maxSpeed;
    const targetZ = input.moveZ * TUNING.maxSpeed;

    // Never brake a knockback or dive below its own speed.
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const boosted = speed > TUNING.maxSpeed + 0.01;
    if (boosted && !hasInput) {
      const decay = 1 - Math.min(1, 1.8 * dt);
      this.velocity.x *= decay;
      this.velocity.z *= decay;
    } else {
      this.velocity.x = approach(this.velocity.x, boosted ? this.velocity.x * 0.94 : targetX, rate);
      this.velocity.z = approach(this.velocity.z, boosted ? this.velocity.z * 0.94 : targetZ, rate);
    }
  }

  _integrate(dt, input, course) {
    // Jump first, so a buffered press converts on the same frame it lands.
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0) && !this.diving) {
      this.velocity.y = TUNING.jumpSpeed;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.groundDeck = null;
      if (this.onJump) this.onJump();
    }

    const previousY = this.position.y;
    const previousVY = this.velocity.y;

    this.velocity.y = Math.max(
      TUNING.terminalVelocity,
      this.velocity.y - TUNING.gravity * dt
    );

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    const wasGrounded = this.grounded;
    this.grounded = false;
    this.groundDeck = null;

    // Sweep the whole frame so a fast fall cannot tunnel through a deck.
    const ceiling = Math.max(previousY, this.position.y) + TUNING.stepTolerance;
    const ground = course.sampleGround(
      this.position.x,
      this.position.z,
      ceiling,
      TUNING.edgeForgiveness
    );

    // Whatever deck is below drives the contact shadow, grounded or not.
    this._shadowGround = ground ? ground.height : this.position.y - 80;

    if (ground && this.velocity.y <= 0 && this.position.y <= ground.height + 0.001) {
      this.position.y = ground.height;
      this.grounded = true;
      this.groundDeck = ground.deck;
      this.coyote = TUNING.coyoteTime;

      // Riding a slider: inherit its motion instead of sliding off it.
      this.position.x += ground.deck.dx ?? 0;
      this.position.z += ground.deck.dz ?? 0;

      // A spinning platform cannot be expressed as one delta — the rim travels
      // far further than the hub — so riders are rotated about its axis.
      if (ground.deck.spin) {
        const spun = rotateAbout(
          this.position.x,
          this.position.z,
          ground.deck.x,
          ground.deck.z,
          ground.deck.spin * dt
        );
        this.position.x = spun.x;
        this.position.z = spun.z;
      }

      if (ground.deck.bounce) {
        this.velocity.y = ground.deck.bounce;
        this.grounded = false;
        this.coyote = 0;
      } else {
        this.velocity.y = 0;
      }

      if (!wasGrounded) {
        const impact = Math.min(1, Math.abs(previousVY) / 18);
        this._squash = Math.max(this._squash, 0.5 + impact * 0.5);
        this.diving = false;
        this.diveTimer = 0;
        if (this.onLand) this.onLand(impact, Boolean(ground.deck.bounce));
      }
    } else if (wasGrounded && this.velocity.y <= 0) {
      // Walked off an edge: start the coyote window rather than dropping cold.
      this.coyote = TUNING.coyoteTime;
    }

    if (this.grounded || this.velocity.y === 0) this.jumpBuffer = Math.min(this.jumpBuffer, 0.14);
    void input;
  }

  _animate(dt, input) {
    this.group.position.copy(this.position);
    this._squash = Math.max(0, this._squash - dt * 4.2);

    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);

    if (planarSpeed > 0.6) {
      const heading = Math.atan2(this.velocity.x, this.velocity.z);
      this.facing += shortestAngle(this.facing, heading) * (1 - Math.exp(-14 * dt));
    }
    this.group.rotation.y = this.facing;

    // Squash on impact, stretch through the air.
    const pop = this._squash * this._squash;
    const airStretch = clamp(this.velocity.y * 0.014, -0.09, 0.16);
    const size = this.character.bodyScale;
    const targetScaleY = ((this.grounded ? 1 : 1 + airStretch) - pop * 0.34) * size;
    const targetScaleXZ = ((this.grounded ? 1 : 1 - airStretch * 0.6) + pop * 0.26) * size;
    this.visual.scale.set(
      damp(this.visual.scale.x, targetScaleXZ, 22, dt),
      damp(this.visual.scale.y, targetScaleY, 22, dt),
      damp(this.visual.scale.z, targetScaleXZ, 22, dt)
    );

    // Lean into the run; belly-flop forward on a dive.
    const leanTarget = this.diving ? 1.05 : clamp(planarSpeed / TUNING.maxSpeed, 0, 1) * 0.26;
    this.visual.rotation.x = damp(this.visual.rotation.x, leanTarget, this.diving ? 20 : 10, dt);
    this.visual.rotation.z = damp(
      this.visual.rotation.z,
      this.stagger > 0 ? Math.sin(this.stagger * 30) * 0.3 : 0,
      12,
      dt
    );

    // Legs and arms pump with ground speed; they tuck in mid-air.
    this._runPhase += planarSpeed * dt * 2.6;
    const swing = this.grounded ? Math.sin(this._runPhase) * clamp(planarSpeed / 6, 0, 1) : 0;
    const tuck = this.grounded ? 0 : -0.5;
    this.legs[0].rotation.x = swing * 0.9 + tuck;
    this.legs[1].rotation.x = -swing * 0.9 + tuck;
    this.arms[0].rotation.x = -swing * 0.8 + (this.diving ? -1.6 : tuck * 0.6);
    this.arms[1].rotation.x = swing * 0.8 + (this.diving ? -1.6 : tuck * 0.6);

    // The head piece lags behind whatever the body just did.
    this.accessory.rotation.x = damp(
      this.accessory.rotation.x,
      clamp(-this.velocity.y * 0.03, -0.5, 0.5) - leanTarget * 0.4,
      9,
      dt
    );
    this.accessory.rotation.z = Math.sin(this._runPhase * 0.8) * 0.12 * (planarSpeed / 9);

    this._updateBlobShadow();
    void input;
  }

  _updateBlobShadow() {
    const height = this._shadowGround ?? this.position.y;
    const drop = clamp(this.position.y - height, 0, 8);
    this.blob.position.set(0, height - this.position.y + 0.02, 0);
    this.blob.scale.setScalar(clamp(1 - drop * 0.09, 0.34, 1));
    this.blob.material.opacity = clamp(0.26 - drop * 0.035, 0, 0.26);
  }
}

export { TUNING as PLAYER_TUNING };
