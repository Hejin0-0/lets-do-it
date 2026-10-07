import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './palette.js';
import { toy } from './materials.js';

/**
 * A tile that gives way. Two things light its fuse: standing on it, and the
 * ring collapse working inward from the arena's edge. Either way you get a
 * visible warning before the floor goes, because a hazard you cannot see
 * coming is not a challenge.
 *
 * Materials are shared across every tile — 60-odd unique materials to animate
 * one colour change is a lot of GPU state for a swap that only has two ends.
 */
export class DissolvingTile {
  constructor({ x, z, y = 0, hw = 0.8, hd = 0.8, ring = 0, index = 0, color, fuse = 1.8 }) {
    this.ring = ring;
    this.index = index;
    this.fuse = fuse;
    this.homeY = y;
    this.state = 'solid';
    this.timer = 0;
    /** Set at build time from the ring; the collapse eats the rim first. */
    this.autoFuseAt = Infinity;

    this.solidMaterial = toy(color ?? PALETTE.bumperDeck, { roughness: 0.24 });
    this.warningMaterial = toy(PALETTE.sweeperBar, {
      roughness: 0.2,
      emissive: PALETTE.sweeperBar,
      emissiveIntensity: 0.35,
    });

    this.deck = { x, z, hw, hd, y, dx: 0, dz: 0, disabled: false };

    this.mesh = new THREE.Mesh(
      new RoundedBoxGeometry(hw * 2, 0.5, hd * 2, 3, 0.16),
      this.solidMaterial
    );
    this.mesh.position.set(x, y - 0.25, z);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.group = new THREE.Group();
    this.group.add(this.mesh);

    this._wobbleSeed = index * 0.7;
  }

  /** Light the fuse. Harmless once it is already burning or gone. */
  ignite() {
    if (this.state !== 'solid') return false;
    this.state = 'fusing';
    this.timer = this.fuse;
    this.mesh.material = this.warningMaterial;
    return true;
  }

  /** @returns {boolean} true on the frame it drops out */
  update(dt, elapsed) {
    if (this.state === 'gone') return false;

    if (this.state === 'solid') {
      if (elapsed >= this.autoFuseAt) this.ignite();
      return false;
    }

    this.timer -= dt;
    if (this.timer > 0) {
      // Shake harder as the fuse runs down, so urgency reads without a HUD.
      const panic = 1 - this.timer / this.fuse;
      const shake = panic * panic * 0.13;
      this.mesh.position.y =
        this.homeY - 0.25 + Math.sin(elapsed * 34 + this._wobbleSeed) * shake;
      this.mesh.rotation.z = Math.sin(elapsed * 27 + this._wobbleSeed) * shake * 0.6;
      return false;
    }

    this.state = 'gone';
    this.deck.disabled = true;
    this.group.visible = false;
    return true;
  }

  reset() {
    this.state = 'solid';
    this.timer = 0;
    this.deck.disabled = false;
    this.group.visible = true;
    this.mesh.material = this.solidMaterial;
    this.mesh.position.y = this.homeY - 0.25;
    this.mesh.rotation.z = 0;
  }

  get standable() {
    return this.state !== 'gone';
  }

  get safe() {
    return this.state === 'solid';
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}
