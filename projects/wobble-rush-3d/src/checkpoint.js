import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { toy, toyUnique } from './materials.js';
import { damp } from './physics.js';

/**
 * A gate you run through. Crossing its plane banks a respawn point and pops
 * confetti. Checkpoints are crossed in course order, so the trigger is just
 * "past the plane and roughly on the deck" — no way to miss one at full speed.
 */
export class Checkpoint {
  constructor({ x = 0, z, y = 0, halfWidth = 3, index, label, axis = 'z', style = 'gate' }) {
    this.x = x;
    this.z = z;
    this.y = y;
    this.halfWidth = halfWidth;
    this.index = index;
    this.label = label ?? `Checkpoint ${index + 1}`;
    this.active = false;
    /** Which way progress runs: a course crosses a plane, a tower clears a height. */
    this.axis = axis;
    this.style = style;

    // On a course you pop back just past the gate; on a tower you pop back onto
    // the pad itself, because there is no "past" when the way on is upward.
    this.spawn = new THREE.Vector3(x, y + 0.05, axis === 'y' ? z : z + 1.1);

    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    this.flagMaterial = toyUnique(PALETTE.checkpointOff, { roughness: 0.25 });
    this.ringMaterial = toyUnique(PALETTE.checkpointOff, {
      roughness: 0.2,
      emissive: PALETTE.checkpointOff,
      emissiveIntensity: 0.15,
    });

    // The crossbar sits above the follow camera's sight line to the player, so
    // running through a gate never wipes out the view of your own Wobbler.
    const BEAM_Y = 4.7;
    this.beamY = BEAM_Y;
    this.pennants = [];

    if (style === 'gate') this._buildGate(halfWidth, BEAM_Y);

    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.15, 12, 32), this.ringMaterial);
    this.ring.position.y = 1.45;
    this.group.add(this.ring);

    this.pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 28), this.ringMaterial);
    this.pad.position.y = 0.04;
    this.group.add(this.pad);

    this._pulse = 0;
    this._color = new THREE.Color(PALETTE.checkpointOff);
    this._target = new THREE.Color(PALETTE.checkpointOff);
  }

  _buildGate(halfWidth, BEAM_Y) {
    const postGeometry = new THREE.CylinderGeometry(0.16, 0.2, BEAM_Y, 14);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeometry, toy(PALETTE.post, { roughness: 0.35 }));
      post.position.set(side * halfWidth, BEAM_Y / 2, 0);
      post.castShadow = true;
      this.group.add(post);

      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), this.flagMaterial);
      knob.position.set(side * halfWidth, BEAM_Y + 0.1, 0);
      this.group.add(knob);
    }

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(halfWidth * 2, 0.34, 0.34),
      toy(PALETTE.post, { roughness: 0.35 })
    );
    beam.position.y = BEAM_Y;
    beam.castShadow = true;
    this.group.add(beam);

    // Pennants strung along the beam.
    const pennantGeometry = new THREE.ConeGeometry(0.2, 0.5, 3);
    const count = Math.max(3, Math.round(halfWidth * 2));
    for (let i = 0; i < count; i += 1) {
      const pennant = new THREE.Mesh(pennantGeometry, this.flagMaterial);
      const t = count === 1 ? 0.5 : i / (count - 1);
      pennant.position.set(-halfWidth + t * halfWidth * 2, BEAM_Y - 0.28, 0);
      pennant.rotation.x = Math.PI;
      this.group.add(pennant);
      this.pennants.push(pennant);
    }
  }

  /**
   * True once the player has banked this checkpoint. A course checkpoint is a
   * plane you run through; a tower checkpoint is a height you have to be
   * standing at, since on a climb "past it" only means above it.
   */
  isCrossed(position) {
    if (this.axis === 'y') {
      return (
        position.y >= this.y - 0.15 &&
        Math.hypot(position.x - this.x, position.z - this.z) <= this.halfWidth + 1.0
      );
    }
    return position.z >= this.z && Math.abs(position.x - this.x) <= this.halfWidth + 1.5;
  }

  activate() {
    if (this.active) return false;
    this.active = true;
    this._pulse = 1;
    this._target.setHex(PALETTE.checkpointOn);
    return true;
  }

  reset() {
    this.active = false;
    this._pulse = 0;
    this._target.setHex(PALETTE.checkpointOff);
    this._color.setHex(PALETTE.checkpointOff);
    this.flagMaterial.color.copy(this._color);
    this.ringMaterial.color.copy(this._color);
    this.ringMaterial.emissive.copy(this._color);
    this.ringMaterial.emissiveIntensity = 0.15;
  }

  update(dt, time) {
    this._pulse = Math.max(0, this._pulse - dt * 1.6);

    this._color.lerp(this._target, 1 - Math.exp(-9 * dt));
    this.flagMaterial.color.copy(this._color);
    this.ringMaterial.color.copy(this._color);
    this.ringMaterial.emissive.copy(this._color);
    this.ringMaterial.emissiveIntensity = damp(
      this.ringMaterial.emissiveIntensity,
      this.active ? 0.85 : 0.05,
      6,
      dt
    );

    const pop = this._pulse * this._pulse;
    this.ring.scale.setScalar(1 + pop * 0.7);
    this.ring.rotation.z = time * (this.active ? 1.8 : 0.5);
    this.pad.scale.set(1 + pop * 0.4, 1, 1 + pop * 0.4);

    for (let i = 0; i < this.pennants.length; i += 1) {
      this.pennants[i].rotation.z = Math.sin(time * 3 + i * 0.7) * 0.35;
      this.pennants[i].position.y = this.beamY - 0.28 + Math.sin(time * 2.4 + i) * 0.05;
    }
  }
}
