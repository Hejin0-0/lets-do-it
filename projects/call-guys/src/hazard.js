import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { toyUnique } from './materials.js';

/**
 * The Fizz: a rising surface that ends the run on contact.
 *
 * It is content, so the level builds it and the mode drives it — `Course` never
 * advances it on its own, which is why it sits still on the menu and only
 * climbs once a run that cares about it has started.
 */
export class RisingHazard {
  constructor({ baseY = -4, topY = 30, radius = 26, speed = 0.6, delay = 3 } = {}) {
    this.baseY = baseY;
    this.topY = topY;
    this.speed = speed;
    this.delay = delay;
    this.surfaceY = baseY;
    this._elapsed = 0;

    this.group = new THREE.Group();

    const depth = 60;
    this.material = toyUnique(PALETTE.balloonA, {
      roughness: 0.15,
      emissive: PALETTE.balloonA,
      emissiveIntensity: 0.28,
    });
    this.material.transparent = true;
    this.material.opacity = 0.82;

    this.body = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 48, 1, false),
      this.material
    );
    this.body.position.y = -depth / 2;
    this.group.add(this.body);

    // A bright lip so the surface line reads against the tower behind it.
    this.rimMaterial = toyUnique(PALETTE.cream, {
      roughness: 0.2,
      emissive: PALETTE.cream,
      emissiveIntensity: 0.5,
    });
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.42, 10, 64), this.rimMaterial);
    this.rim.rotation.x = Math.PI / 2;
    this.group.add(this.rim);

    // Bubbles, so a surface that is otherwise a flat disc still looks alive.
    this.bubbles = [];
    const bubbleGeometry = new THREE.SphereGeometry(1, 12, 10);
    for (let i = 0; i < 16; i += 1) {
      const bubble = new THREE.Mesh(bubbleGeometry, this.material);
      const angle = (i / 16) * Math.PI * 2 + i * 0.6;
      const spread = radius * (0.3 + ((i * 7) % 10) / 14);
      bubble.position.set(Math.cos(angle) * spread, 0, Math.sin(angle) * spread);
      // Base scale is stored, not read back off the mesh: sampling the animated
      // scale to compute the next one compounds every frame.
      const baseScale = 0.5 + ((i * 3) % 5) * 0.18;
      bubble.scale.setScalar(baseScale);
      this.group.add(bubble);
      this.bubbles.push({ mesh: bubble, seed: i * 0.83, baseScale });
    }

    this.group.position.y = this.surfaceY;
  }

  reset() {
    this._elapsed = 0;
    this.surfaceY = this.baseY;
    this.group.position.y = this.surfaceY;
  }

  /** Called by the mode, not by the Course. */
  update(dt, time) {
    this._elapsed += dt;
    const climbing = Math.max(0, this._elapsed - this.delay);
    this.surfaceY = Math.min(this.topY, this.baseY + climbing * this.speed);
    this.group.position.y = this.surfaceY;

    this.rim.rotation.z = time * 0.3;
    for (const { mesh, seed, baseScale } of this.bubbles) {
      mesh.position.y = Math.sin(time * 1.4 + seed) * 0.3 - 0.15;
      mesh.scale.setScalar(baseScale * (1 + Math.sin(time * 2 + seed) * 0.12));
    }
  }

  /** Contact test against the player's feet. */
  touches(position) {
    return position.y <= this.surfaceY;
  }

  /** How far the player still has above the surface. */
  clearance(position) {
    return position.y - this.surfaceY;
  }

  dispose() {
    this.body.geometry.dispose();
    this.rim.geometry.dispose();
    for (const { mesh } of this.bubbles) mesh.geometry.dispose();
    this.material.dispose();
    this.rimMaterial.dispose();
  }
}
