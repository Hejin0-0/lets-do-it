import * as THREE from 'three';
import { BURST_COLORS } from './palette.js';

const MAX_PARTICLES = 460;

/** Per-burst tuning. `spread` is the cone half-width, `up` the launch speed. */
const PRESETS = {
  land: { count: 10, up: 2.4, spread: 3.4, gravity: 16, life: 0.42, size: 0.16, spin: 6 },
  jump: { count: 7, up: 1.6, spread: 2.6, gravity: 14, life: 0.36, size: 0.13, spin: 5 },
  dive: { count: 12, up: 1.4, spread: 3.0, gravity: 9, life: 0.5, size: 0.15, spin: 8 },
  bump: { count: 16, up: 5.0, spread: 5.0, gravity: 20, life: 0.6, size: 0.2, spin: 10 },
  sweep: { count: 18, up: 5.5, spread: 5.5, gravity: 20, life: 0.65, size: 0.21, spin: 12 },
  checkpoint: { count: 34, up: 7.5, spread: 4.2, gravity: 15, life: 1.1, size: 0.24, spin: 9 },
  respawn: { count: 26, up: 6.0, spread: 4.6, gravity: 14, life: 0.8, size: 0.22, spin: 11 },
  finish: { count: 90, up: 12.0, spread: 6.5, gravity: 13, life: 2.2, size: 0.3, spin: 8 },
};

/**
 * Every particle in the game is one instance of a single chunky cube mesh:
 * one draw call, no allocation during play.
 */
export class Effects {
  constructor(scene) {
    this.particles = [];
    this.cursor = 0;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0,
      emissive: 0x000000,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3();
    this._color = new THREE.Color();

    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.particles.push({
        life: 0,
        maxLife: 1,
        size: 0.2,
        gravity: 16,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        sx: 0,
        sy: 0,
        sz: 0,
      });
      this.mesh.setColorAt(i, this._color.setHex(0xffffff));
    }

    this._hideAll();
    scene.add(this.mesh);
  }

  /**
   * Fire one burst.
   * @param {keyof PRESETS} type
   * @param {{x:number,y:number,z:number}} origin
   * @param {{dir?:{x:number,z:number}, strength?:number}} [options]
   *   `dir` biases the spray (dive trails, sweeper knockbacks); `strength`
   *   scales speed and particle count together.
   */
  burst(type, origin, options = {}) {
    const preset = PRESETS[type];
    if (!preset) throw new Error(`Effects.burst: unknown burst type "${type}"`);

    const colors = BURST_COLORS[type];
    const strength = options.strength ?? 1;
    const dir = options.dir;
    const count = Math.round(preset.count * THREE.MathUtils.clamp(strength, 0.4, 1.6));

    for (let i = 0; i < count; i += 1) {
      const particle = this.particles[this.cursor];
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;

      const angle = Math.random() * Math.PI * 2;
      const radial = Math.random() * preset.spread * strength;

      particle.life = preset.life * (0.7 + Math.random() * 0.6);
      particle.maxLife = particle.life;
      particle.size = preset.size * (0.65 + Math.random() * 0.7);
      particle.gravity = preset.gravity;

      particle.x = origin.x + Math.cos(angle) * 0.22;
      particle.y = origin.y + 0.18 + Math.random() * 0.3;
      particle.z = origin.z + Math.sin(angle) * 0.22;

      particle.vx = Math.cos(angle) * radial + (dir ? dir.x * 3.2 * strength : 0);
      particle.vz = Math.sin(angle) * radial + (dir ? dir.z * 3.2 * strength : 0);
      particle.vy = preset.up * strength * (0.55 + Math.random() * 0.75);

      particle.rx = Math.random() * Math.PI;
      particle.ry = Math.random() * Math.PI;
      particle.rz = Math.random() * Math.PI;
      particle.sx = (Math.random() - 0.5) * preset.spin * 2;
      particle.sy = (Math.random() - 0.5) * preset.spin * 2;
      particle.sz = (Math.random() - 0.5) * preset.spin * 2;

      this.mesh.setColorAt(index, this._color.setHex(colors[i % colors.length]));
    }

    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const particle = this.particles[i];

      if (particle.life <= 0) {
        this._writeHidden(i);
        continue;
      }

      particle.life -= dt;
      if (particle.life <= 0) {
        this._writeHidden(i);
        continue;
      }

      particle.vy -= particle.gravity * dt;
      particle.vx *= 1 - Math.min(1, 1.6 * dt);
      particle.vz *= 1 - Math.min(1, 1.6 * dt);

      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;

      particle.rx += particle.sx * dt;
      particle.ry += particle.sy * dt;
      particle.rz += particle.sz * dt;

      // Shrink out instead of fading: one opaque material, no sorting cost.
      const fade = THREE.MathUtils.clamp(particle.life / particle.maxLife, 0, 1);
      const size = particle.size * (0.35 + 0.65 * fade);

      this._position.set(particle.x, particle.y, particle.z);
      this._euler.set(particle.rx, particle.ry, particle.rz);
      this._quaternion.setFromEuler(this._euler);
      this._scale.setScalar(size);
      this._matrix.compose(this._position, this._quaternion, this._scale);
      this.mesh.setMatrixAt(i, this._matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Drop every live particle — used on restart so old confetti does not linger. */
  clear() {
    for (const particle of this.particles) particle.life = 0;
    this._hideAll();
  }

  _hideAll() {
    for (let i = 0; i < MAX_PARTICLES; i += 1) this._writeHidden(i);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _writeHidden(index) {
    this._position.set(0, -9999, 0);
    this._quaternion.identity();
    this._scale.setScalar(0);
    this._matrix.compose(this._position, this._quaternion, this._scale);
    this.mesh.setMatrixAt(index, this._matrix);
  }
}
