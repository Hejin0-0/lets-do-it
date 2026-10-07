import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './palette.js';
import { toy } from './materials.js';
import {
  Bumper,
  MovingPlatform,
  Pendulum,
  RotatingDisc,
  RotorTunnel,
  Sweeper,
} from './obstacle.js';
import { Checkpoint } from './checkpoint.js';
import { Spark } from './collectible.js';
import { RisingHazard } from './hazard.js';
import { DissolvingTile } from './tile.js';
import { deckHeightAt } from './physics.js';

/** Below this the run is over — the active mode decides what that means. */
export const VOID_Y = -14;

/** Level `obstacles[].type` → constructor. Adding a hazard means adding a line. */
const OBSTACLE_TYPES = {
  sweeper: Sweeper,
  slider: MovingPlatform,
  bumper: Bumper,
  pendulum: Pendulum,
  disc: RotatingDisc,
  rotor: RotorTunnel,
};

/**
 * Builds a level definition into a scene and owns its runtime state.
 *
 * A deck is `{x, z, hw, hd, y, slope?, dx, dz, bounce?}` in world space.
 * Obstacles hand theirs over at build time and then mutate them in place each
 * frame, which is how riders get carried.
 *
 * The level supplies parameters; this class supplies the builders. Nothing
 * about one particular course lives here any more — see `levels/`.
 */
export class Course {
  constructor(scene, level) {
    if (!level) throw new Error('Course: a level definition is required');

    this.scene = scene;
    this.level = level;
    this.group = new THREE.Group();
    this.decks = [];
    this.obstacles = [];
    this.checkpoints = [];
    this.sparks = [];
    this.tiles = [];
    this.conveyorDecks = [];
    this.decor = [];
    this._disposables = [];

    this._buildDecks();
    this._buildTiles();
    this._buildProps();
    this._buildObstacles();
    this._buildCheckpoints();
    this._buildSparks();
    this._buildHazard();
    this._buildFinish();
    this._buildDecor();

    for (const obstacle of this.obstacles) {
      this.group.add(obstacle.group);
      this.decks.push(...obstacle.decks);
    }
    for (const checkpoint of this.checkpoints) this.group.add(checkpoint.group);

    scene.add(this.group);
  }

  get id() {
    return this.level.id;
  }

  get name() {
    return this.level.name;
  }

  get startSpawn() {
    return this.level.spawn ?? this.checkpoints[0].spawn;
  }

  get checkpointCount() {
    return this.checkpoints.length;
  }

  // ---------------------------------------------------------------- geometry

  _addDeck(definition) {
    const {
      color = PALETTE.runway,
      checker = null,
      thickness = 1.2,
      skirt = true,
      radius = 0.3,
      conveyor = null,
      ...deck
    } = definition;

    const full = { dx: 0, dz: 0, ...deck };
    if (conveyor) {
      // A belt needs no new mechanic: the rider logic already carries whatever
      // a deck reports moving, so a static deck that publishes a delta is one.
      full.conveyor = conveyor;
      this.conveyorDecks.push(full);
    }
    this.decks.push(full);

    let material;
    if (checker) {
      const texture = checkerTexture(...checker);
      this._disposables.push(texture);
      material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.22, metalness: 0 });
      this._disposables.push(material);
    } else {
      material = toy(color, { roughness: 0.24 });
    }

    const angle = deck.slope ? Math.atan2(deck.slope, deck.hd * 2) : 0;
    const depth = deck.slope ? (deck.hd * 2) / Math.cos(angle) : deck.hd * 2;

    const slab = new THREE.Mesh(
      new RoundedBoxGeometry(deck.hw * 2, thickness, depth, 4, radius),
      material
    );
    slab.rotation.x = -angle;
    slab.position.set(
      deck.x,
      deck.y + (deck.slope ?? 0) / 2 - (thickness / 2) * Math.cos(angle),
      deck.z
    );

    slab.castShadow = true;
    slab.receiveShadow = true;
    this.group.add(slab);

    if (conveyor) this._addConveyorChevrons(full, conveyor);

    if (skirt && !deck.slope) {
      const under = new THREE.Mesh(
        new RoundedBoxGeometry(deck.hw * 2 - 0.7, 1.8, deck.hd * 2 - 0.7, 3, 0.3),
        toy(PALETTE.post, { roughness: 0.5 })
      );
      under.position.set(deck.x, deck.y - thickness - 0.85, deck.z);
      this.group.add(under);
    }

    return full;
  }

  /** Arrows on a belt, so which way it drags is visible before you step on. */
  _addConveyorChevrons(deck, conveyor) {
    const along = Math.abs(conveyor.x ?? 0) >= Math.abs(conveyor.z ?? 0) ? 'x' : 'z';
    const sign = Math.sign((along === 'x' ? conveyor.x : conveyor.z) || 1);
    const span = along === 'x' ? deck.hw : deck.hd;
    const across = along === 'x' ? deck.hd : deck.hw;

    const geometry = new THREE.ConeGeometry(0.34, 0.6, 3);
    const material = toy(PALETTE.cream, { roughness: 0.3 });
    const rows = Math.max(1, Math.round(across / 1.5));
    const columns = Math.max(2, Math.round(span));

    for (let r = 0; r < rows; r += 1) {
      const offset = rows === 1 ? 0 : (r / (rows - 1) - 0.5) * across * 1.4;
      for (let c = 0; c < columns; c += 1) {
        const t = columns === 1 ? 0 : (c / (columns - 1) - 0.5) * span * 1.5;
        const chevron = new THREE.Mesh(geometry, material);
        chevron.position.set(
          deck.x + (along === 'x' ? t : offset),
          deck.y + 0.02,
          deck.z + (along === 'x' ? offset : t)
        );
        chevron.rotation.x = -Math.PI / 2;
        chevron.rotation.z = along === 'x' ? sign * -Math.PI / 2 : sign > 0 ? Math.PI : 0;
        this.group.add(chevron);
      }
    }
  }

  _buildDecks() {
    for (const definition of this.level.decks) this._addDeck(definition);
  }

  /** Dissolving floor, when a level has one. Driven by the mode, like the hazard. */
  _buildTiles() {
    this.tiles = (this.level.tiles ?? []).map((definition, index) => {
      const tile = new DissolvingTile({ ...definition, index });
      tile.autoFuseAt = definition.autoFuseAt ?? Infinity;
      this.decks.push(tile.deck);
      this.group.add(tile.group);
      this._disposables.push(tile);
      return tile;
    });
  }

  /** Non-colliding dressing that sits on the course itself, e.g. bridge rails. */
  _buildProps() {
    for (const prop of this.level.props ?? []) {
      if (prop.kind !== 'postRow') {
        throw new Error(`Course: unknown prop kind "${prop.kind}" in level "${this.level.id}"`);
      }
      const geometry = new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8);
      const material = toy(prop.color ?? PALETTE.cream, { roughness: 0.35 });
      for (let z = prop.fromZ; z <= prop.toZ; z += prop.step) {
        for (const side of prop.offsets) {
          const post = new THREE.Mesh(geometry, material);
          post.position.set(side, prop.y, z);
          post.castShadow = true;
          this.group.add(post);
        }
      }
    }
  }

  _buildObstacles() {
    for (const { type, ...options } of this.level.obstacles ?? []) {
      const Constructor = OBSTACLE_TYPES[type];
      if (!Constructor) {
        throw new Error(
          `Course: unknown obstacle type "${type}" in level "${this.level.id}". ` +
            `Known types: ${Object.keys(OBSTACLE_TYPES).join(', ')}`
        );
      }
      this.obstacles.push(new Constructor(options));
    }
  }

  _buildCheckpoints() {
    this.checkpoints = (this.level.checkpoints ?? []).map(
      (definition, index) => new Checkpoint({ x: 0, index, ...definition })
    );
    if (this.checkpoints.length > 0) this.checkpoints[0].activate();
  }

  /** Optional pickups. Levels declare them; only some modes care. */
  _buildSparks() {
    this.sparks = (this.level.sparks ?? []).map((spot, index) => {
      const spark = new Spark({ ...spot, index });
      this.group.add(spark.group);
      this._disposables.push(spark);
      return spark;
    });
    this.setSparksActive(false);
  }

  /**
   * The rising hazard, when a level has one. Built here because it is content,
   * but never advanced here — the mode owns when it climbs.
   */
  _buildHazard() {
    if (!this.level.hazard) {
      this.hazard = null;
      return;
    }
    this.hazard = new RisingHazard(this.level.hazard);
    this.group.add(this.hazard.group);
    this._disposables.push(this.hazard);
  }

  _buildFinish() {
    this.finishZone = null;
    this.finishBeacons = [];

    // Not every game is won by arriving somewhere — Tilt Out is won by lasting.
    const finish = this.level.finish;
    if (!finish) return;

    this.finishZone = finish.zone;

    const spec = finish.gate;
    if (!spec) return;

    // The Glow Gate: an arch straddling the last jump.
    const gate = new THREE.Group();
    gate.position.set(spec.x, spec.y, spec.z);

    const legGeometry = new THREE.CylinderGeometry(0.42, 0.5, 5.2, 18);
    for (const side of [-spec.legOffset, spec.legOffset]) {
      const leg = new THREE.Mesh(legGeometry, toy(PALETTE.gate, { roughness: 0.2 }));
      leg.position.set(side, 2.6, 0);
      leg.castShadow = true;
      gate.add(leg);
    }

    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(spec.archRadius, 0.44, 14, 40, Math.PI),
      toy(PALETTE.gate, { roughness: 0.2 })
    );
    arch.position.y = 5.2;
    arch.castShadow = true;
    gate.add(arch);

    const glowMaterial = new THREE.MeshStandardMaterial({
      color: PALETTE.gateGlow,
      emissive: PALETTE.gateGlow,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    this._disposables.push(glowMaterial);

    this.gateGlow = new THREE.Mesh(
      new THREE.TorusGeometry(spec.glowRadius, 0.24, 12, 36),
      glowMaterial
    );
    this.gateGlow.position.y = spec.glowY;
    gate.add(this.gateGlow);

    this.group.add(gate);
    this.gate = gate;

    const beacons = finish.beacons;
    if (!beacons) return;
    for (const side of beacons.offsets) {
      const beacon = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 2.4, 16),
        toy(PALETTE.gateGlow, { roughness: 0.2 })
      );
      beacon.position.set(side, beacons.y, beacons.z);
      beacon.castShadow = true;
      this.group.add(beacon);
      this.finishBeacons.push(beacon);
    }
    this._beaconHomeY = beacons.y;
  }

  /** Ambient toy-box props. None of it collides; all of it moves. */
  _buildDecor() {
    const spec = this.level.decor;
    if (!spec) return;

    if (spec.clouds) {
      const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
      const cloudMaterial = toy(PALETTE.cloud, { roughness: 0.85 });
      for (let i = 0; i < spec.clouds.count; i += 1) {
        const cloud = new THREE.Group();
        const lumps = 3 + (i % 3);
        for (let l = 0; l < lumps; l += 1) {
          const lump = new THREE.Mesh(cloudGeometry, cloudMaterial);
          lump.position.set(
            (l - lumps / 2) * 1.5,
            Math.sin(l * 2.3) * 0.4,
            Math.cos(l * 1.7) * 0.8
          );
          lump.scale.setScalar(1.5 + ((i + l) % 3) * 0.55);
          cloud.add(lump);
        }
        const side = i % 2 === 0 ? -1 : 1;
        cloud.position.set(
          side * (18 + ((i * 7) % 26)),
          6 + ((i * 5) % 16),
          spec.clouds.zOffset + ((i * 31) % spec.clouds.zMod)
        );
        cloud.scale.setScalar(0.8 + ((i * 3) % 5) * 0.24);
        this.group.add(cloud);
        this.decor.push({ object: cloud, kind: 'cloud', seed: i * 0.83, homeY: cloud.position.y });
      }
    }

    // Floating islands drifting below the course, so the void has depth.
    if (spec.islands) {
      const islandColors = [PALETTE.runway, PALETTE.movingDeck, PALETTE.bumperDeck, PALETTE.island];
      for (let i = 0; i < spec.islands.count; i += 1) {
        const island = new THREE.Group();
        const top = new THREE.Mesh(
          new RoundedBoxGeometry(4, 1, 4, 3, 0.4),
          toy(islandColors[i % islandColors.length], { roughness: 0.3 })
        );
        island.add(top);
        const root = new THREE.Mesh(
          new THREE.ConeGeometry(1.8, 3.4, 10),
          toy(PALETTE.post, { roughness: 0.6 })
        );
        root.position.y = -2.2;
        root.rotation.x = Math.PI;
        island.add(root);

        const side = i % 2 === 0 ? -1 : 1;
        island.position.set(
          side * (22 + ((i * 11) % 26)),
          -11 - ((i * 3) % 14),
          ((i * 43) % spec.islands.zMod) + spec.islands.zOffset
        );
        island.scale.setScalar(0.7 + ((i * 5) % 4) * 0.3);
        this.group.add(island);
        this.decor.push({
          object: island,
          kind: 'island',
          seed: i * 1.31,
          homeY: island.position.y,
        });
      }
    }

    // Balloons on strings, bobbing beside the course.
    if (spec.balloons) {
      const balloonColors = [PALETTE.balloonA, PALETTE.balloonB, PALETTE.balloonC];
      const balloonGeometry = new THREE.SphereGeometry(1, 20, 14);
      for (let i = 0; i < spec.balloons.count; i += 1) {
        const balloon = new THREE.Group();
        const bulb = new THREE.Mesh(
          balloonGeometry,
          toy(balloonColors[i % balloonColors.length], { roughness: 0.16 })
        );
        bulb.scale.set(1, 1.22, 1);
        balloon.add(bulb);
        const knot = new THREE.Mesh(
          new THREE.ConeGeometry(0.28, 0.6, 8),
          toy(PALETTE.cream, { roughness: 0.4 })
        );
        knot.position.y = -1.35;
        knot.rotation.x = Math.PI;
        balloon.add(knot);

        const side = i % 2 === 0 ? -1 : 1;
        balloon.position.set(
          side * (9 + ((i * 5) % 10)),
          3 + ((i * 7) % 11),
          ((i * 37) % spec.balloons.zMod) + spec.balloons.zOffset
        );
        balloon.scale.setScalar(0.7 + ((i * 3) % 4) * 0.25);
        this.group.add(balloon);
        this.decor.push({
          object: balloon,
          kind: 'balloon',
          seed: i * 0.61,
          homeY: balloon.position.y,
        });
      }
    }
  }

  // ------------------------------------------------------------------ runtime

  update(dt, time) {
    // Belts publish a per-frame delta, the same shape a slider reports, so the
    // player's existing rider logic carries anyone standing on one.
    for (const deck of this.conveyorDecks) {
      deck.dx = (deck.conveyor.x ?? 0) * dt;
      deck.dz = (deck.conveyor.z ?? 0) * dt;
    }

    for (const obstacle of this.obstacles) obstacle.update(dt, time);
    for (const checkpoint of this.checkpoints) checkpoint.update(dt, time);
    for (const spark of this.sparks) spark.update(dt, time);

    if (this.gateGlow) {
      this.gateGlow.rotation.z = time * 1.2;
      this.gateGlow.scale.setScalar(1 + Math.sin(time * 2.6) * 0.06);
    }
    for (let i = 0; i < this.finishBeacons.length; i += 1) {
      const beacon = this.finishBeacons[i];
      beacon.rotation.y = time * 1.6;
      beacon.position.y = this._beaconHomeY + Math.sin(time * 2 + i * Math.PI) * 0.35;
    }

    for (const item of this.decor) {
      const { object, seed, homeY, kind } = item;
      if (kind === 'cloud') {
        object.position.y = homeY + Math.sin(time * 0.4 + seed) * 0.9;
        object.position.x += Math.sin(time * 0.15 + seed) * dt * 0.9;
      } else if (kind === 'island') {
        object.position.y = homeY + Math.sin(time * 0.5 + seed) * 1.2;
        object.rotation.y = Math.sin(time * 0.2 + seed) * 0.4;
      } else {
        object.position.y = homeY + Math.sin(time * 1.1 + seed) * 0.75;
        object.rotation.z = Math.sin(time * 0.9 + seed) * 0.16;
      }
    }
  }

  /**
   * Highest deck under (x, z) whose top is at or below `maxHeight`.
   * `maxHeight` is swept across the frame by the caller, so a fast fall can
   * never tunnel through a platform.
   */
  sampleGround(x, z, maxHeight, pad = 0) {
    let best = null;
    for (const deck of this.decks) {
      if (deck.disabled) continue;
      const height = deckHeightAt(deck, x, z, pad);
      if (height === null || height > maxHeight) continue;
      if (!best || height > best.height) best = { height, deck };
    }
    return best;
  }

  resolveObstacles(player, effects) {
    for (const obstacle of this.obstacles) obstacle.affect(player, effects);
  }

  /** Latest checkpoint the player has just crossed, or null. */
  claimCheckpoint(position) {
    for (const checkpoint of this.checkpoints) {
      if (checkpoint.active) continue;
      if (!checkpoint.isCrossed(position)) continue;
      checkpoint.activate();
      return checkpoint;
    }
    return null;
  }

  /**
   * Sparks belong to the level but only some modes play with them. A mode that
   * ignores them must not leave them floating there as scenery you cannot
   * touch, so they are hidden outright rather than made inert.
   */
  setSparksActive(active) {
    this.sparksActive = active;
    for (const spark of this.sparks) spark.group.visible = active && !spark.collected;
  }

  /**
   * Advance the dissolving floor. Called by the mode, not by `update`, so an
   * arena sits still on the menu instead of quietly eating itself.
   */
  updateTiles(dt, elapsed, standingOn, effects) {
    for (const tile of this.tiles) {
      if (standingOn && tile.deck === standingOn) tile.ignite();
      if (tile.update(dt, elapsed) && effects) {
        effects.burst('land', { x: tile.deck.x, y: tile.deck.y, z: tile.deck.z }, { strength: 1.1 });
      }
    }
  }

  get tilesStanding() {
    return this.tiles.reduce((total, tile) => total + (tile.standable ? 1 : 0), 0);
  }

  /** The sparks currently in play — empty in a mode that does not use them. */
  get activeSparks() {
    return this.sparksActive ? this.sparks : [];
  }

  /** The spark the player just ran through, or null. */
  claimSpark(position, playerHeight) {
    for (const spark of this.activeSparks) {
      if (spark.tryCollect(position, playerHeight)) return spark;
    }
    return null;
  }

  get sparksCollected() {
    return this.sparks.reduce((total, spark) => total + (spark.collected ? 1 : 0), 0);
  }

  isInFinish(position) {
    const zone = this.finishZone;
    if (!zone) return false;
    return (
      position.x >= zone.minX &&
      position.x <= zone.maxX &&
      position.z >= zone.minZ &&
      position.z <= zone.maxZ &&
      position.y >= zone.minY
    );
  }

  reset() {
    for (const checkpoint of this.checkpoints) checkpoint.reset();
    if (this.checkpoints.length > 0) this.checkpoints[0].activate();
    for (const spark of this.sparks) spark.reset();
    this.setSparksActive(this.sparksActive ?? false);
    for (const tile of this.tiles) tile.reset();
    this.hazard?.reset();
  }

  /** Tear down so another level can be built into the same scene. */
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      if (object.isMesh) object.geometry.dispose();
    });
    for (const item of this._disposables) item.dispose();
    this.decks.length = 0;
    this.obstacles.length = 0;
    this.checkpoints.length = 0;
    this.decor.length = 0;
    this._disposables.length = 0;
  }
}

/** Procedural checkerboard — generated in code so there is no asset to fail. */
function checkerTexture(colorA, colorB, squares) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Course: 2D canvas context unavailable for the checker texture');

  const step = size / squares;
  for (let row = 0; row < squares; row += 1) {
    for (let column = 0; column < squares; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? colorA : colorB;
      context.fillRect(column * step, row * step, step, step);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
