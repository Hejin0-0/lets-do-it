import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { toyUnique } from './materials.js';

/**
 * A Spark: a floating pickup you grab by running through it.
 *
 * Deliberately not an Obstacle — it never touches the player's velocity and
 * owns no decks. Modes that want collectibles read them off the Course; modes
 * that do not simply ignore them.
 */
export class Spark {
  constructor({ x, y, z, index }) {
    this.index = index;
    this.position = new THREE.Vector3(x, y, z);
    /** Generous on purpose: brushing past should count. */
    this.radius = 1.4;
    /** Half-height of the grab cylinder, measured from the player's middle. */
    this.height = 1.4;
    this.collected = false;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // Every deck is a light pastel, so a Spark cannot win on hue alone — it
    // wins on being emissive, which no surface in the level is, and on being
    // big enough to read as an objective rather than as scenery.
    this.material = toyUnique(PALETTE.gate, {
      roughness: 0.1,
      emissive: PALETTE.gate,
      emissiveIntensity: 1.4,
    });

    this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), this.material);
    this.core.castShadow = true;
    this.group.add(this.core);

    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.085, 8, 26), this.material);
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.ring);

    this._spin = index * 0.7;
  }

  update(dt, time) {
    if (this.collected) return;
    this.core.rotation.y = time * 2.1 + this._spin;
    this.core.rotation.x = Math.sin(time * 1.3 + this._spin) * 0.4;
    this.ring.rotation.z = time * 1.6 + this._spin;
    this.group.position.y = this.position.y + Math.sin(time * 2.4 + this._spin) * 0.18;
    void dt;
  }

  /**
   * A standing cylinder, not a sphere.
   *
   * With a sphere the horizontal reach shrinks as the vertical offset grows, so
   * a Spark hung at head height is quietly harder to grab than one at chest
   * height — a difference no player can see or reason about. Testing the two
   * axes separately means "run through it" always means the same thing.
   *
   * @returns {boolean} true the first time it is taken
   */
  tryCollect(playerPosition, playerHeight) {
    if (this.collected) return false;

    const dy = playerPosition.y + playerHeight / 2 - this.position.y;
    if (Math.abs(dy) > this.height) return false;

    const dx = playerPosition.x - this.position.x;
    const dz = playerPosition.z - this.position.z;
    if (dx * dx + dz * dz > this.radius * this.radius) return false;

    this.collected = true;
    this.group.visible = false;
    return true;
  }

  reset() {
    this.collected = false;
    this.group.visible = true;
  }

  dispose() {
    this.core.geometry.dispose();
    this.ring.geometry.dispose();
    this.material.dispose();
  }
}
