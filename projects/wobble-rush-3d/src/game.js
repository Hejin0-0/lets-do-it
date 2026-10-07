import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PALETTE } from './palette.js';
import { Course, VOID_Y } from './course.js';
import { Player, PLAYER_TUNING } from './player.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { damp, shortestAngle } from './physics.js';
import { DEFAULT_LEVEL_ID, getLevel, LEVELS } from './levels/index.js';
import { getMode, MODES } from './modes/index.js';
import { CHARACTERS, getCharacter, getCharacterOrDefault } from './characters.js';
import { readSetting, SETTINGS, writeSetting } from './storage.js';

const CAMERA = {
  distance: 11.5,
  height: 5.4,
  lookHeight: 1.35,
  followLambda: 7.5,
  yawLambda: 1.6,
  manualHold: 1.6,
  fov: 58,
};

/**
 * The camera's resting yaw, looking straight down the course (+Z).
 *
 * It deliberately does NOT chase the player's heading. Movement input is
 * camera-relative, so a camera that turns to face the direction of travel
 * feeds back into the input that produced it: hold W+D and the pair spiral,
 * curving the player off the deck instead of running a straight diagonal.
 * Easing to a fixed course yaw has no feedback term and always frames what
 * is coming next. Dragging still orbits freely; it just drifts back.
 */
const COURSE_YAW = Math.PI;

const MOVE_KEYS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Owns the renderer, the loop, and the run state machine. */
export class Game {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.state = 'menu';
    this.elapsed = 0;
    this.falls = 0;
    this.checkpointsReached = 1;
    this.clock = new THREE.Clock();
    this.time = 0;

    this._keys = new Set();
    this._divePressed = false;
    this._manualTimer = 0;
    this._dragging = false;
    this._lastPointerX = 0;

    this._buildRenderer();
    this._buildScene();

    this.effects = new Effects(this.scene);

    const level = getLevel(options.levelId ?? DEFAULT_LEVEL_ID);
    this.course = new Course(this.scene, level);
    this.mode = getMode(options.modeId ?? level.mode);
    this.course.setSparksActive(Boolean(this.mode.usesSparks));

    // A saved id that no longer exists falls back rather than throwing: the
    // player's stored preference is not worth refusing to boot over.
    const character = options.characterId
      ? getCharacter(options.characterId)
      : getCharacterOrDefault(readSetting(SETTINGS.character));
    this.player = new Player(this.scene, character);

    this.ui = new UI({
      onPlay: () => this.startRun(),
      onRestart: () => this.startRun(),
      characters: CHARACTERS,
      selectedCharacterId: character.id,
      onSelectCharacter: (id) => this.setCharacter(id),
      modes: this._modesForLevel(level),
      selectedModeId: this.mode.id,
      onSelectMode: (id) => this.setMode(id),
      levels: Object.values(LEVELS).map(({ id, name }) => ({ id, name })),
      selectedLevelId: level.id,
      onSelectLevel: (id) => this.loadLevel(id),
    });

    this._wirePlayerEvents();
    this._bindInput();

    this.player.respawnAt(this.course.startSpawn);
    this.cameraYaw = COURSE_YAW;
    this._cameraTarget = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();
    this._placeCamera(true);

    this.ui.showStart();
    this._paintHud();
    this.ui.setDiveCharge(1);

    this._loop = this._loop.bind(this);
    this.renderer.setAnimationLoop(this._loop);
  }

  // ------------------------------------------------------------------- setup

  _buildRenderer() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      throw new Error(
        `WebGL could not start on this browser. ${error instanceof Error ? error.message : error}`
      );
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;

    this.renderer = renderer;
    window.addEventListener('resize', () => this._onResize());
  }

  _buildScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(PALETTE.haze, 95, 300);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      900
    );
    this.scene.add(this.camera);

    // Gradient dome. Generated in code, so there is no texture to fail.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(420, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(PALETTE.skyTop) },
          bottomColor: { value: new THREE.Color(PALETTE.skyBottom) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec3 vDirection;
          void main() {
            float t = smoothstep(-0.22, 0.55, vDirection.y);
            gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
          }
        `,
      })
    );
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.sky = sky;

    const hemisphere = new THREE.HemisphereLight(PALETTE.skyTop, PALETTE.balloonB, 0.85);
    this.scene.add(hemisphere);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    const sun = new THREE.DirectionalLight(0xfff4dd, 3.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 140;
    sun.shadow.camera.left = -26;
    sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -26;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const rim = new THREE.DirectionalLight(PALETTE.balloonA, 0.7);
    rim.position.set(20, 12, -30);
    this.scene.add(rim);

    // Soft indoor-style reflections give the plastic its sheen.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();
  }

  _wirePlayerEvents() {
    this.player.onJump = () => {
      this.effects.burst('jump', this.player.position, { strength: 0.8 });
    };

    this.player.onLand = (impact, bounced) => {
      if (bounced) {
        this.effects.burst('bump', this.player.position, { strength: 1.2 });
        return;
      }
      if (impact < 0.12) return;
      this.effects.burst('land', this.player.position, { strength: 0.7 + impact });
    };

    this.player.onDive = () => {
      this.effects.burst(
        'dive',
        this.player.position,
        {
          dir: { x: -Math.sin(this.player.facing), z: -Math.cos(this.player.facing) },
          strength: 1.1,
        }
      );
    };
  }

  _bindInput() {
    window.addEventListener('keydown', (event) => {
      // Let a focused button keep its native Space/Enter activation.
      if (event.target instanceof HTMLButtonElement) return;

      if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
      if (event.repeat) return;

      this._keys.add(event.code);

      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this._divePressed = true;

      if (event.code === 'KeyR' && this.state !== 'menu') this.startRun();

      if (event.code === 'Enter' && this.state === 'menu') this.startRun();
    });

    window.addEventListener('keyup', (event) => this._keys.delete(event.code));
    window.addEventListener('blur', () => this._keys.clear());

    this.canvas.addEventListener('pointerdown', (event) => {
      this._dragging = true;
      this._lastPointerX = event.clientX;
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this._dragging) return;
      const delta = event.clientX - this._lastPointerX;
      this._lastPointerX = event.clientX;
      this.cameraYaw -= delta * 0.006;
      this._manualTimer = CAMERA.manualHold;
    });

    const endDrag = (event) => {
      if (!this._dragging) return;
      this._dragging = false;
      if (this.canvas.hasPointerCapture?.(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  // ------------------------------------------------------------------- state

  /** The games a stage can host — a level without a hazard has no Updraft. */
  _modesForLevel(level) {
    return (level.modes ?? [level.mode]).map((id) => getMode(id));
  }

  /** Switch which game is being played on the current level. */
  setMode(id) {
    const mode = getMode(id);
    if (this.mode.id === mode.id) return;
    this.mode = mode;
    this.course.setSparksActive(Boolean(mode.usesSparks));
    this.course.reset();
    this.player.respawnAt(this.course.startSpawn);
    this.state = 'menu';
    this.ui.setSelectedMode(mode.id, mode.tagline);
    this.ui.showStart();
  }

  /**
   * Swap the Wobbler. Purely cosmetic — the new Player is built with the same
   * tuning, so nothing about a run changes except who is running it.
   */
  setCharacter(id) {
    const character = getCharacter(id);
    if (this.player?.character.id === character.id) return;

    this.player.dispose();
    this.player = new Player(this.scene, character);
    this._wirePlayerEvents();
    this.player.respawnAt(this._latestCheckpoint().spawn);
    this._placeCamera(true);

    writeSetting(SETTINGS.character, character.id);
    this.ui?.setSelectedCharacter(character.id);
  }

  /** Swap in another level (and its default mode). Used by the test harness. */
  loadLevel(levelId, modeId = null) {
    const level = getLevel(levelId);
    this.course.dispose();
    this.course = new Course(this.scene, level);
    this.mode = getMode(modeId ?? level.mode);
    this.course.setSparksActive(Boolean(this.mode.usesSparks));
    this.state = 'menu';
    this.player.respawnAt(this.course.startSpawn);
    this.cameraYaw = COURSE_YAW;
    this._placeCamera(true);
    this.ui.setSelectedLevel(level.id);
    this.ui.setModes(this._modesForLevel(level), this.mode.id);
    this._paintHud();
    this.ui.showStart();
  }

  startRun() {
    this.course.reset();
    this.player.respawnAt(this.course.startSpawn);
    this.effects.clear();

    this.state = 'running';
    this.elapsed = 0;
    this.falls = 0;
    this.checkpointsReached = 1;
    this._manualTimer = 0;
    this.cameraYaw = this._restingYaw();
    this._keys.clear();
    this._divePressed = false;
    this._placeCamera(true);

    this.ui.showRun();
    this.ui.setDiveCharge(1);
    this._paintHud();
    this.ui.flashToast('GO!', 0.9);
    this.mode.onStart(this);
  }

  _end(outcome) {
    if (this.state !== 'running') return;
    this.state = 'finished';
    this.outcome = outcome;

    if (outcome === 'won') {
      this.effects.burst('finish', this.player.position, { strength: 1.6 });
      this.effects.burst(
        'finish',
        { x: this.player.position.x, y: this.player.position.y + 3, z: this.player.position.z },
        { strength: 1.4 }
      );
    } else {
      this.ui.flashRespawn();
    }

    this.ui.showFinish(this.mode.summarise(this));
  }

  respawnAtCheckpoint() {
    const checkpoint = this._latestCheckpoint();
    this.falls += 1;
    this.effects.burst('respawn', checkpoint.spawn, { strength: 1.2 });
    this.player.respawnAt(checkpoint.spawn);
    this.cameraYaw = COURSE_YAW;
    this._manualTimer = 0;
    this._placeCamera(true);
    this.ui.flashRespawn();
    this.ui.flashToast(`BACK TO ${checkpoint.label.toUpperCase()}`);
  }

  _latestCheckpoint() {
    // An arena has no checkpoints at all; fall back to the level's spawn so
    // callers never have to know which kind of stage they are on.
    let latest = this.course.checkpoints[0] ?? {
      spawn: this.course.startSpawn,
      label: 'Start',
      index: 0,
    };
    for (const checkpoint of this.course.checkpoints) {
      if (checkpoint.active) latest = checkpoint;
    }
    return latest;
  }

  // -------------------------------------------------------------------- loop

  _loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.stepSimulation(dt);
    this._updateCamera(dt);
    this._updateSun();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * One simulated frame with no camera work and no draw call. `_loop` wraps it
   * for real play; `bot.js` calls it directly, so a full 90-second run costs
   * milliseconds instead of ninety seconds.
   */
  stepSimulation(dt) {
    this.time += dt;

    this.course.update(dt, this.time);

    // Particles and per-frame DOM writes are presentation, not simulation. The
    // bot steps tens of thousands of frames, and integrating 460 particles plus
    // writing the clock each time costs more than everything else combined.
    if (!this.headless) {
      this.effects.update(dt);
      this.ui.update(dt);
    }

    if (this.state === 'running') this._updateRun(dt);
    else this._updateIdle(dt);
  }

  _updateRun(dt) {
    this.elapsed += dt;

    const input = this._readInput();
    this.player.update(dt, input, this.course);
    this.course.resolveObstacles(this.player, this.effects);

    const claimed = this.course.claimCheckpoint(this.player.position);
    if (claimed) {
      this.checkpointsReached = Math.max(this.checkpointsReached, claimed.index + 1);
      this.effects.burst('checkpoint', claimed.spawn, { strength: 1.3 });
      if (!this.headless) {
        this._paintHud({ bump: true });
        this.ui.flashToast(claimed.label.toUpperCase());
      }
    }

    this.mode.onUpdate(this, dt);

    if (!this.headless) {
      this._paintHud();
      this.ui.setDiveCharge(
        this.player.diving ? 0 : 1 - this.player.diveCooldown / PLAYER_TUNING.diveCooldown
      );
    }

    if (this.mode.checkWin(this)) this._end('won');
    else if (this.mode.checkLose(this)) this._end('lost');
  }

  /** The HUD shows whatever the active mode says it should. */
  _paintHud(options = {}) {
    const hud = this.mode.hud(this);
    this.ui.setTimer(hud.timer, hud.timerLabel);
    this.ui.setCounter(hud.counterLabel, hud.counterValue, options);
  }

  /** Menu and finish share an idle sim: the world keeps moving, input does not. */
  _updateIdle(dt) {
    const idleInput = { moveX: 0, moveZ: 0, jumpHeld: false, divePressed: false };
    this.player.update(dt, idleInput, this.course);
    if (this.player.position.y < VOID_Y) this.player.respawnAt(this._latestCheckpoint().spawn);
    this._divePressed = false;
  }

  _readInput() {
    const forward = (this._keys.has('KeyW') || this._keys.has('ArrowUp') ? 1 : 0) -
      (this._keys.has('KeyS') || this._keys.has('ArrowDown') ? 1 : 0);
    const strafe = (this._keys.has('KeyD') || this._keys.has('ArrowRight') ? 1 : 0) -
      (this._keys.has('KeyA') || this._keys.has('ArrowLeft') ? 1 : 0);

    // Camera-relative: forward is "away from the camera".
    const sin = Math.sin(this.cameraYaw);
    const cos = Math.cos(this.cameraYaw);
    let moveX = -sin * forward + cos * strafe;
    let moveZ = -cos * forward - sin * strafe;

    const length = Math.hypot(moveX, moveZ);
    if (length > 1) {
      moveX /= length;
      moveZ /= length;
    }

    const divePressed = this._divePressed;
    this._divePressed = false;

    return {
      moveX,
      moveZ,
      jumpHeld: this._keys.has('Space'),
      divePressed,
    };
  }

  _updateCamera(dt) {
    this._manualTimer = Math.max(0, this._manualTimer - dt);

    if (this.state !== 'running') {
      // Slow showcase orbit on the menu and the finish screen.
      this.cameraYaw += dt * 0.16;
    } else if (this._manualTimer <= 0) {
      this.cameraYaw +=
        shortestAngle(this.cameraYaw, this._restingYaw()) *
        (1 - Math.exp(-CAMERA.yawLambda * dt));
    }

    this._placeCamera(false, dt);
  }

  /**
   * Where the camera wants to sit when nobody is dragging it.
   *
   * On a straight course that is a constant. On a spiral it is derived from
   * where the player *is* relative to the tower axis — never from where they
   * are heading, which would reintroduce the input feedback loop that
   * `COURSE_YAW` exists to kill. Position in, orientation out, no cycle.
   */
  _restingYaw() {
    const spec = this.course.level.camera;
    if (spec?.mode !== 'tower') return COURSE_YAW;

    const dx = this.player.position.x - (spec.centre?.x ?? 0);
    const dz = this.player.position.z - (spec.centre?.z ?? 0);
    // On the axis there is no meaningful bearing; hold what we have.
    if (Math.hypot(dx, dz) < 2) return this.cameraYaw;

    const theta = Math.atan2(dx, dz);
    const spin = spec.spin ?? 1;
    // Tangent to the spiral: the way the climb actually runs.
    const tangentX = spin * Math.cos(theta);
    const tangentZ = spin * -Math.sin(theta);
    return Math.atan2(-tangentX, -tangentZ);
  }

  _placeCamera(snap, dt = 0.016) {
    const showcase = this.state !== 'running';
    const spec = this.course.level.camera ?? {};
    const distance = showcase ? 15 : spec.distance ?? CAMERA.distance;
    const height = showcase ? 7.5 : spec.height ?? CAMERA.height;

    this._cameraTarget.set(
      this.player.position.x + Math.sin(this.cameraYaw) * distance,
      this.player.position.y + height,
      this.player.position.z + Math.cos(this.cameraYaw) * distance
    );
    this._lookTarget.set(
      this.player.position.x,
      this.player.position.y + (spec.lookHeight ?? CAMERA.lookHeight),
      this.player.position.z
    );

    if (snap) {
      this.camera.position.copy(this._cameraTarget);
      this._smoothLook = this._lookTarget.clone();
    } else {
      const lambda = CAMERA.followLambda;
      this.camera.position.set(
        damp(this.camera.position.x, this._cameraTarget.x, lambda, dt),
        damp(this.camera.position.y, this._cameraTarget.y, lambda, dt),
        damp(this.camera.position.z, this._cameraTarget.z, lambda, dt)
      );
      this._smoothLook.set(
        damp(this._smoothLook.x, this._lookTarget.x, lambda * 1.6, dt),
        damp(this._smoothLook.y, this._lookTarget.y, lambda * 1.6, dt),
        damp(this._smoothLook.z, this._lookTarget.z, lambda * 1.6, dt)
      );
    }

    // Never let the camera dive under the course.
    this.camera.position.y = Math.max(this.camera.position.y, this.player.position.y + 1.6);
    this.camera.lookAt(this._smoothLook);
    this.sky.position.copy(this.camera.position);
  }

  /** Keep the shadow frustum tight around the player for crisp contact shadows. */
  _updateSun() {
    const { x, y, z } = this.player.position;
    this.sun.position.set(x - 26, y + 42, z - 18);
    this.sun.target.position.set(x, y, z);
    this.sun.target.updateMatrixWorld();
  }

  _onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
  }
}
