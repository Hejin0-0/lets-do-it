import * as THREE from 'three';
import { GameAudio } from './audio.ts';
import {
  canMeleeHit,
  crossedMeleeHitWindow,
  orientedBoxIntersectsDisc,
  orientedBoxesOverlap,
  resolveDiscStep,
  resolvedLocomotionDistance,
  stepPlanarVelocity,
  type Disc,
  type OrientedBox,
} from './combat-physics.ts';
import {
  ATTACK_EVENT,
  createIslandCreatures,
  CREATURE_DEFS,
  damageCreature,
  tameCreature,
  updateCreature,
  type Creature,
} from './creatures.ts';
import { ChunkEffects } from './effects.ts';
import {
  BUILD_COSTS,
  advanceDay,
  attackDamage,
  canAfford,
  craft,
  createInitialGameState,
  dayPhase,
  eatBerry,
  feedHerbivore,
  gather,
  mergeCreatureContinuity,
  payBuildCost,
  recordMissionEvent,
  refundBuildCost,
  restAtCamp,
  takeDamage,
  tickSurvival,
  type BuildType,
  type CraftableTool,
  type GameState,
  type Tool,
} from './gameplay.ts';
import { addInkedPart, setGhostValidity } from './materials.ts';
import { MultiplayerClient, type RemoteSnapshot, type WorldEvent } from './multiplayer.ts';
import { PALETTE } from './palette.ts';
import {
  SAVE_KEY,
  SAVE_VERSION,
  parseSave,
  serializeSave,
  type SaveSnapshot,
} from './persistence.ts';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  parseSettings,
  serializeSettings,
  type GameSettings,
} from './settings.ts';
import { Hud, shouldOpenCraftFromTab, type SelectedSlot } from './ui.ts';
import { createViewModel, sampleToolPose, setViewModelTool, toolActionDuration, type ViewModel } from './view-model.ts';
import {
  SEA_LEVEL,
  WORLD_SIZE,
  biomeAt,
  createStructureVisual,
  createWorld,
  heightAt,
  type ResourceNode,
} from './world.ts';

const EYE_HEIGHT = 1.72;
const WALK_SPEED = 5.4;
const SPRINT_SPEED = 8.25;
const INTERACTION_DISTANCE = 6.2;
const PLAYER_RADIUS = 0.44;
const BUILD_FOOTPRINTS: Record<BuildType, readonly [number, number]> = {
  foundation: [1.7, 1.55],
  wall: [1.65, 0.36],
  campfire: [1.05, 0.78],
};

function buildFootprint(type: BuildType, x: number, z: number, yaw: number): OrientedBox {
  const [halfWidth, halfDepth] = BUILD_FOOTPRINTS[type];
  return { x, z, yaw, halfWidth, halfDepth };
}

type AimTarget = { resource: ResourceNode; distance: number; point: THREE.Vector3 }
  | { creature: Creature; distance: number; point: THREE.Vector3 }
  | null;

interface RemoteAvatar {
  root: THREE.Group;
  targetPosition: THREE.Vector3;
  targetYaw: number;
}

const requiredCanvas = (): HTMLCanvasElement => {
  const canvas = document.getElementById('game-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #game-canvas');
  return canvas;
};

function ancestorData<T>(object: THREE.Object3D | null, key: string): T | undefined {
  let current = object;
  while (current) {
    if (current.userData[key]) return current.userData[key] as T;
    current = current.parent;
  }
  return undefined;
}

function createRemoteAvatar(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Remote explorer';
  const body = new THREE.BoxGeometry(0.55, 0.82, 0.32);
  const head = new THREE.DodecahedronGeometry(0.28, 0);
  const limb = new THREE.CylinderGeometry(0.07, 0.09, 0.72, 5);
  addInkedPart(root, body, 0x26383b, [0, 1.12, 0]);
  addInkedPart(root, head, 0xb87955, [0, 1.78, 0]);
  addInkedPart(root, new THREE.BoxGeometry(0.42, 0.48, 0.22), PALETTE.amber, [0, 1.15, 0.26]);
  for (const side of [-1, 1]) {
    addInkedPart(root, limb, 0x26383b, [side * 0.21, 0.46, 0]);
    addInkedPart(root, limb, 0x26383b, [side * 0.39, 1.1, 0], [0.8, 0.8, 0.8], [0, 0, side * -0.22]);
  }
  return root;
}

function resourceColor(node: ResourceNode): number {
  return {
    wood: PALETTE.woodLight,
    stone: PALETTE.stone,
    fiber: PALETTE.fiber,
    berries: PALETTE.berry,
  }[node.kind];
}

export class InkboundGame {
  private readonly canvas = requiredCanvas();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 0.08, 240);
  private readonly hud = new Hud();
  private readonly audio = new GameAudio();
  private readonly world;
  private readonly creatures: Creature[];
  private readonly effects: ChunkEffects;
  private readonly viewModel: ViewModel;
  private readonly multiplayer: MultiplayerClient;
  private readonly remotes = new Map<string, RemoteAvatar>();
  private readonly playerFeet = new THREE.Vector3(0, heightAt(0, 7), 7);
  private readonly keys = new Set<string>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly structures: THREE.Group[] = [];
  private readonly planarVelocity = new THREE.Vector2();
  private state: GameState = createInitialGameState();
  private pendingSave: SaveSnapshot | null = null;
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private selectedSlot: SelectedSlot = 'hands';
  private buildPreview: THREE.Group | null = null;
  private buildValid = false;
  private buildRotation = 0;
  private yaw = 0;
  private pitch = -0.03;
  private verticalVelocity = 0;
  private grounded = true;
  private jumpRequested = false;
  private playing = false;
  private dead = false;
  private elapsed = 0;
  private walkPhase = 0;
  private cameraBob = 0;
  private cameraSway = 0;
  private landingCompression = 0;
  private damageKick = 0;
  private damageRoll = 0;
  private fovKick = 0;
  private hitStop = 0;
  private companionAttackCooldown = 0;
  private attackTimer = 0;
  private attackDuration = toolActionDuration('hands');
  private attackTool: Tool = 'hands';
  private attackPreviousProgress = 1;
  private attackResolved = true;
  private trailAccumulator = 0;
  private hudAccumulator = 0;
  private perfFrames = 0;
  private perfTotalMs = 0;
  private perfMaxMs = 0;
  private perfMaxCalls = 0;
  private perfMaxTriangles = 0;
  private perfReady = false;
  private saveAccumulator = 0;
  private hasStarted = false;
  private victoryShown = false;
  private previousTime = performance.now();
  private readonly query = new URLSearchParams(location.search);
  private readonly testMode = this.query.has('test');
  private readonly testScenario = this.query.get('scenario');
  private readonly freezeSimulation = this.query.has('freeze');
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    this.settings = this.readPlayerSettings();
    this.reducedMotion = this.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.qualityPixelRatio(this.settings.quality)));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = this.settings.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera.rotation.order = 'YXZ';
    this.camera.fov = this.settings.fov;
    this.audio.setVolume(this.settings.volume);

    this.world = createWorld(this.scene);
    this.creatures = createIslandCreatures((x, z) => heightAt(x, z));
    this.scene.add(...this.creatures.map((creature) => creature.root));
    this.effects = new ChunkEffects(this.scene);
    this.viewModel = createViewModel(this.camera);
    this.scene.add(this.camera);
    this.world.updateDay(this.state.timeOfDay);

    this.multiplayer = new MultiplayerClient(
      (label, status) => this.hud.setNetwork(label, status),
      (snapshot, departedId) => this.syncRemote(snapshot, departedId),
      (event) => this.syncWorld(event),
    );
    if (this.query.has('capture')) this.hud.setNetwork('Solo capture', 'offline');
    else this.multiplayer.connect();

    this.pendingSave = this.readSavedExpedition();
    this.hud.setContinueAvailable(Boolean(this.pendingSave));
    this.hud.setSettings(this.settings);
    this.hud.bindActions({
      start: () => this.start(),
      continueExpedition: () => this.continueExpedition(),
      respawn: () => this.respawn(),
      victoryContinue: () => this.continueAfterVictory(),
      replay: () => this.replay(),
      settingsChanged: (settings) => this.applySettings(settings),
      fullscreen: () => this.toggleFullscreen(),
      craft: (tool) => this.craftTool(tool),
      slot: (slot) => this.selectSlot(slot),
      closeCraft: () => this.setCraftOpen(false),
    });
    this.configureTestScenario();
    this.bindInput();
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('pagehide', () => this.saveExpedition());
    this.updateViewModel();
    this.updateHud();
    document.body.dataset.quality = this.settings.quality;
    document.body.dataset.reducedMotion = String(this.reducedMotion);
    document.body.dataset.gameReady = 'true';
    document.body.dataset.creatureCount = String(this.creatures.length);
    document.body.dataset.resourceCount = String(this.world.resources.length);
    document.body.dataset.detailCount = String(this.world.detailCount);
    document.body.dataset.landmarkCount = String(this.world.landmarkCount);
    document.body.dataset.audioState = 'locked';
    document.body.dataset.renderPipeline = 'direct';
    let meshCount = 0;
    let instancedMeshCount = 0;
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshCount += 1;
      if (object instanceof THREE.InstancedMesh) instancedMeshCount += 1;
    });
    document.body.dataset.sceneMeshCount = String(meshCount);
    document.body.dataset.instancedMeshCount = String(instancedMeshCount);
    this.renderer.setAnimationLoop((time) => this.frame(time));

    if (this.testMode) {
      this.playing = true;
      this.hud.enterGame();
      if (this.state.mission.stage === 'complete') this.triggerVictory();
    }
  }

  private bindInput(): void {
    addEventListener('keydown', (event) => {
      if (event.code === 'Tab') {
        const activeGameplay = this.playing && !this.dead && !this.victoryShown;
        const menuVisible = this.hud.isCraftOpen() || this.hud.isSettingsOpen();
        if (shouldOpenCraftFromTab(activeGameplay, menuVisible, event.repeat)) {
          this.setCraftOpen(true);
          event.preventDefault();
        }
        return;
      }
      if (event.code === 'KeyC' && !event.repeat) {
        this.setCraftOpen(!this.hud.isCraftOpen());
        event.preventDefault();
        return;
      }
      if (event.code === 'Escape' && this.hud.isSettingsOpen()) {
        this.hud.toggleSettings(false);
        event.preventDefault();
        return;
      }
      if (event.code === 'KeyG' && !event.repeat && this.playing) {
        this.eatBerry();
        return;
      }
      if (event.code === 'KeyM' && !event.repeat) {
        this.toggleAudio();
        return;
      }
      if (event.code === 'KeyQ' && !event.repeat && this.buildPreview) {
        this.buildRotation = (this.buildRotation + Math.PI / 2) % (Math.PI * 2);
        this.updateBuildPreview();
        this.hud.toast('Structure rotated 90°');
        return;
      }
      if (event.code === 'KeyX' && !event.repeat && this.playing) {
        this.tryDismantle();
        return;
      }
      if (event.code === 'KeyT' && !event.repeat && this.playing) {
        this.tryTame();
        return;
      }
      if (event.code === 'KeyF' && !event.repeat && this.playing) {
        this.tryTame();
        return;
      }
      if (event.code === 'KeyR' && !event.repeat && this.playing) {
        this.commandCompanion();
        return;
      }
      if ((event.code === 'KeyE' || event.code === 'Enter') && !event.repeat && this.playing && !this.hud.isCraftOpen()) {
        this.interact();
        return;
      }
      const slots: Record<string, SelectedSlot> = {
        Digit1: 'hands', Digit2: 'axe', Digit3: 'spear', Digit4: 'torch',
        Digit5: 'foundation', Digit6: 'wall', Digit7: 'campfire',
      };
      const slot = slots[event.code];
      if (slot && !event.repeat) {
        this.selectSlot(slot);
        event.preventDefault();
        return;
      }
      if (event.code === 'Space' && !event.repeat) {
        this.jumpRequested = true;
        event.preventDefault();
      }
      this.keys.add(event.code);
    });
    addEventListener('keyup', (event) => this.keys.delete(event.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (event) => {
      if ((!this.testMode && document.pointerLockElement !== this.canvas) || !this.playing || this.hud.isCraftOpen()) return;
      this.yaw -= event.movementX * 0.0021 * this.settings.sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0018 * this.settings.sensitivity, -1.35, 1.25);
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.testMode || this.dead || !this.playing) return;
      if (document.pointerLockElement !== this.canvas && !this.hud.isCraftOpen()) {
        this.playing = false;
        this.keys.clear();
        this.hud.showPause();
      }
    });
    this.canvas.addEventListener('mousedown', (event) => {
      void this.unlockAudio();
      if (event.button === 0 && this.playing && !this.hud.isCraftOpen()) this.interact();
    });
  }

  private start(): void {
    if (this.dead) return;
    if (this.hud.isSettingsOpen()) this.hud.toggleSettings(false);
    void this.unlockAudio();
    this.hasStarted = true;
    this.hud.setContinueAvailable(false);
    this.playing = true;
    this.hud.enterGame();
    if (!this.testMode && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock().catch(() => this.hud.toast('Click the game view to capture the mouse'));
    }
  }

  private setCraftOpen(open: boolean): void {
    this.hud.toggleCraft(open);
    this.keys.clear();
    if (open && document.pointerLockElement === this.canvas) document.exitPointerLock();
    if (!open && this.playing && !this.testMode && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock().catch(() => undefined);
    }
  }

  private frame(time: number): void {
    const rawFrameMs = Math.max(0, time - this.previousTime);
    const delta = Math.min(0.05, rawFrameMs / 1_000);
    this.previousTime = time;
    const frozen = this.hitStop > 0;
    this.hitStop = Math.max(0, this.hitStop - delta);
    const simulationDelta = frozen || this.freezeSimulation ? 0 : delta;
    this.elapsed += simulationDelta;
    this.attackTimer = Math.max(0, this.attackTimer - simulationDelta);
    this.damageKick = Math.max(0, this.damageKick - simulationDelta * 4.2);
    this.fovKick = Math.max(0, this.fovKick - simulationDelta * 5);

    if (this.playing && !this.dead && !this.hud.isCraftOpen()) {
      this.updatePlayer(simulationDelta);
      this.resolveArmedInteraction();
      this.updateDinosaurs(simulationDelta);
      this.updateBuildPreview();
      this.state = advanceDay(this.state, simulationDelta);
      this.world.updateDay(this.state.timeOfDay);
      if (this.state.health <= 0) this.die();
      this.saveAccumulator += simulationDelta;
      if (this.saveAccumulator >= 8) {
        this.saveAccumulator = 0;
        this.saveExpedition();
      }
    }

    this.world.update(this.elapsed);
    this.effects.update(simulationDelta);
    this.updateRemoteAvatars(delta);
    this.animateStructures();
    this.multiplayer.update(delta, {
      x: this.playerFeet.x,
      y: this.playerFeet.y,
      z: this.playerFeet.z,
      yaw: this.yaw,
      slot: this.selectedSlot,
    });

    this.hudAccumulator += delta;
    if (this.hudAccumulator >= 0.09) {
      this.hudAccumulator = 0;
      this.updateHud();
    }
    const targetFov = this.settings.fov + this.fovKick * 4;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, delta * 18));
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    if (this.testMode && !this.perfReady) this.recordPerformance(rawFrameMs);
  }

  private recordPerformance(frameMs: number): void {
    if (frameMs > 250) return;
    this.perfFrames += 1;
    this.perfTotalMs += frameMs;
    this.perfMaxMs = Math.max(this.perfMaxMs, frameMs);
    this.perfMaxCalls = Math.max(this.perfMaxCalls, this.renderer.info.render.calls);
    this.perfMaxTriangles = Math.max(this.perfMaxTriangles, this.renderer.info.render.triangles);
    if (this.perfTotalMs < 10_000) return;
    document.body.dataset.perfMeanMs = (this.perfTotalMs / this.perfFrames).toFixed(2);
    document.body.dataset.perfMaxMs = this.perfMaxMs.toFixed(2);
    document.body.dataset.perfDrawCalls = String(this.perfMaxCalls);
    document.body.dataset.perfTriangles = String(this.perfMaxTriangles);
    document.body.dataset.perfFrames = String(this.perfFrames);
    document.body.dataset.perfReady = 'true';
    this.perfReady = true;
  }

  private updatePlayer(delta: number): void {
    const forwardAmount = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const rightAmount = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const hasInput = forwardAmount !== 0 || rightAmount !== 0;
    const sprinting = hasInput && this.keys.has('ShiftLeft') && this.state.stamina > 1;
    const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    this.state = tickSurvival(this.state, delta, sprinting);
    if (this.nearCampfire()) this.state = restAtCamp(this.state, delta);

    const desired = new THREE.Vector2();
    if (hasInput) {
      desired.set(
        -Math.sin(this.yaw) * forwardAmount + Math.cos(this.yaw) * rightAmount,
        -Math.cos(this.yaw) * forwardAmount - Math.sin(this.yaw) * rightAmount,
      ).normalize();
    }
    const steppedVelocity = stepPlanarVelocity(
      { x: this.planarVelocity.x, z: this.planarVelocity.y },
      { x: desired.x, z: desired.y },
      speed,
      sprinting ? 22 : 17,
      25,
      delta,
    );
    this.planarVelocity.set(steppedVelocity.x, steppedVelocity.z);
    let movedDistance = 0;

    if (this.planarVelocity.length() > 0.08) {
      const intended = {
        x: this.playerFeet.x + this.planarVelocity.x * delta,
        z: this.playerFeet.z + this.planarVelocity.y * delta,
      };
      const resolved = resolveDiscStep(this.playerFeet, intended, PLAYER_RADIUS, this.movementObstacles());
      const nextX = resolved.x;
      const nextZ = resolved.z;
      const nextGround = Math.max(heightAt(nextX, nextZ), SEA_LEVEL - 0.3);
      if (Math.hypot(nextX, nextZ) < WORLD_SIZE * 0.47 && nextGround - this.playerFeet.y < 1.15) {
        movedDistance = resolvedLocomotionDistance(this.playerFeet, resolved);
        this.playerFeet.x = nextX;
        this.playerFeet.z = nextZ;
        if (Math.abs(nextX - intended.x) > 1e-4) this.planarVelocity.x = 0;
        if (Math.abs(nextZ - intended.z) > 1e-4) this.planarVelocity.y = 0;
      } else {
        this.planarVelocity.set(0, 0);
      }
      this.walkPhase += movedDistance * (sprinting ? 1.52 : 1.7);
      this.trailAccumulator += movedDistance;
      const stepDistance = sprinting ? 0.83 : 0.92;
      if (this.grounded && this.trailAccumulator >= stepDistance) {
        this.trailAccumulator %= stepDistance;
        this.effects.trail(
          new THREE.Vector3(this.playerFeet.x, this.playerFeet.y + 0.08, this.playerFeet.z),
          biomeAt(this.playerFeet.x, this.playerFeet.z),
          heightAt(this.playerFeet.x, this.playerFeet.z) < 0.25,
          { direction: { x: -this.planarVelocity.x, z: -this.planarVelocity.y } },
        );
        this.audio.cue('step');
      }
    }

    if (this.jumpRequested && this.grounded) {
      this.verticalVelocity = 6.5;
      this.grounded = false;
    }
    this.jumpRequested = false;
    const ground = Math.max(heightAt(this.playerFeet.x, this.playerFeet.z), SEA_LEVEL - 0.3);
    if (!this.grounded) {
      this.verticalVelocity -= 17 * delta;
      this.playerFeet.y += this.verticalVelocity * delta;
      if (this.playerFeet.y <= ground) {
        const landingSpeed = Math.abs(this.verticalVelocity);
        this.playerFeet.y = ground;
        this.verticalVelocity = 0;
        this.grounded = true;
        this.landingCompression = this.reducedMotion ? 0 : THREE.MathUtils.clamp(landingSpeed / 11, 0.25, 0.8);
        this.effects.burst(this.playerFeet, PALETTE.coast, 7, 0.45);
      }
    } else {
      this.playerFeet.y = THREE.MathUtils.lerp(this.playerFeet.y, ground, Math.min(1, delta * 12));
    }

    const resolvedSpeed = delta > 0 ? movedDistance / delta : 0;
    const motionWeight = Math.min(1, resolvedSpeed / WALK_SPEED);
    const moving = movedDistance > 0;
    const targetBob = this.reducedMotion || !moving || !this.grounded
      ? 0 : Math.sin(this.walkPhase) * (sprinting ? 0.065 : 0.038) * motionWeight;
    const targetSway = this.reducedMotion || !moving
      ? 0 : Math.cos(this.walkPhase * 0.5) * (sprinting ? 0.018 : 0.009) * motionWeight;
    const motionBlend = Math.min(1, delta * 14);
    this.cameraBob = THREE.MathUtils.lerp(this.cameraBob, targetBob, motionBlend);
    this.cameraSway = THREE.MathUtils.lerp(this.cameraSway, targetSway, motionBlend);
    this.landingCompression = Math.max(0, this.landingCompression - delta * 4.8);
    this.camera.position.set(
      this.playerFeet.x,
      this.playerFeet.y + EYE_HEIGHT + this.cameraBob - this.landingCompression * 0.075,
      this.playerFeet.z,
    );
    this.camera.rotation.set(
      this.pitch + this.damageKick * 0.035,
      this.yaw,
      this.cameraSway + Math.sin(this.damageKick * Math.PI) * 0.045 * this.damageRoll,
      'YXZ',
    );
    const selectedTool: Tool = this.selectedSlot === 'axe' || this.selectedSlot === 'spear' || this.selectedSlot === 'torch'
      ? this.selectedSlot : 'hands';
    const heldTool = this.attackTimer > 0 ? this.attackTool : selectedTool;
    const actionTime = this.attackTimer > 0 ? 1 - this.attackTimer / this.attackDuration : 1;
    const pose = sampleToolPose(heldTool, actionTime);
    this.viewModel.root.position.set(
      this.cameraSway * 2.1,
      -0.44 - Math.abs(this.cameraBob) * 0.45 - this.landingCompression * 0.035,
      -0.74,
    );
    this.viewModel.root.rotation.set(0, 0, this.cameraSway * -3.2);
    this.viewModel.actionPivot.position.set(...pose.position);
    this.viewModel.actionPivot.rotation.set(...pose.rotation);
  }

  private updateDinosaurs(delta: number): void {
    const night = dayPhase(this.state.timeOfDay) === 'night';
    this.companionAttackCooldown = Math.max(0, this.companionAttackCooldown - delta);
    for (const creature of this.creatures) {
      if (!creature.root.visible) continue;
      const event = updateCreature(creature, delta, this.elapsed, this.playerFeet, (x, z) => heightAt(x, z), night);
      if ((event & ATTACK_EVENT.alert) !== 0) {
        const label = creature.species === 'rex' ? 'INK-JAW ROARS' : 'RAPTOR LOCKED ON';
        this.hud.impact(label, 'danger');
        this.audio.cue('alert');
      }
      if ((event & ATTACK_EVENT.hitWindow) === 0) continue;
      if (!canMeleeHit(
        { x: creature.root.position.x, z: creature.root.position.z, yaw: creature.root.rotation.y },
        this.playerFeet,
        creature.definition.attackRange + 0.55,
        creature.species === 'rex' ? 0.72 : 0.9,
        this.staticObstacles(),
      )) continue;
      creature.attack.hitPending = false;
      const damage = creature.definition.damage;
      this.state = takeDamage(this.state, damage);
      this.damageKick = 1;
      const attackerX = creature.root.position.x - this.playerFeet.x;
      const attackerZ = creature.root.position.z - this.playerFeet.z;
      const attackerDistance = Math.hypot(attackerX, attackerZ);
      this.damageRoll = attackerDistance > 1e-6
        ? THREE.MathUtils.clamp((attackerX * Math.cos(this.yaw) - attackerZ * Math.sin(this.yaw)) / attackerDistance, -1, 1)
        : 0;
      this.fovKick = 1;
      this.hitStop = Math.max(this.hitStop, creature.species === 'rex' ? 0.075 : 0.045);
      this.hud.damage();
      this.audio.cue('damage');
      this.hud.impact(`−${damage}`, 'danger');
      this.hud.toast(`${creature.definition.name} hit −${damage}`, false);
      this.effects.play(
        creature.species === 'rex' ? 'heavyHit' : 'lightHit',
        this.playerFeet.clone().add(new THREE.Vector3(0, 1, 0)),
        PALETTE.danger,
        { direction: { x: -attackerX, z: -attackerZ }, impactScale: 0.35 },
      );
      const away = new THREE.Vector2(
        this.playerFeet.x - creature.root.position.x,
        this.playerFeet.z - creature.root.position.z,
      );
      if (away.lengthSq() > 1e-6) {
        away.normalize().multiplyScalar(creature.species === 'rex' ? 1.15 : 0.58);
        const knocked = resolveDiscStep(
          this.playerFeet,
          { x: this.playerFeet.x + away.x, z: this.playerFeet.z + away.y },
          PLAYER_RADIUS,
          this.movementObstacles(creature),
        );
        this.playerFeet.x = knocked.x;
        this.playerFeet.z = knocked.z;
      }
    }
    if (this.companionAttackCooldown > 0) return;
    for (const companion of this.creatures.filter((creature) => creature.tamed && !creature.dead)) {
      const target = this.creatures
        .filter((creature) => creature.definition.hostile && !creature.dead)
        .sort((left, right) => left.root.position.distanceToSquared(companion.root.position)
          - right.root.position.distanceToSquared(companion.root.position))[0];
      if (!target || target.root.position.distanceTo(companion.root.position) > 5.4) continue;
      const wasDead = target.dead;
      damageCreature(target, 11);
      this.companionAttackCooldown = 1.15;
      this.effects.play(
        'heavyHit',
        target.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
        PALETTE.tame,
        {
          direction: {
            x: target.root.position.x - companion.root.position.x,
            z: target.root.position.z - companion.root.position.z,
          },
        },
      );
      this.hud.impact('MOSSCREST RAM!', 'tame');
      this.audio.cue('hit');
      if (!wasDead && target.dead) this.recordCreatureDefeat(target);
      this.shareCreature(target);
      break;
    }
  }

  private interactionReach(tool: Tool): number {
    return tool === 'spear' ? 4.35 : tool === 'axe' ? 3.25 : tool === 'torch' ? 2.8 : 2.35;
  }

  private findAimTarget(maxDistance = INTERACTION_DISTANCE): AimTarget {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const objects = [
      ...this.world.interactables.filter((object) => object.visible),
      ...this.creatures.filter((creature) => !creature.dead && creature.root.visible).map((creature) => creature.root),
      ...this.structures.filter((structure) => structure.visible),
    ];
    const hit = this.raycaster.intersectObjects(objects, true).find((intersection) => intersection.distance <= maxDistance);
    if (!hit) return null;
    const resource = ancestorData<ResourceNode>(hit.object, 'resourceNode');
    if (resource?.active) return { resource, distance: hit.distance, point: hit.point.clone() };
    const creature = ancestorData<Creature>(hit.object, 'creature');
    if (creature) return { creature, distance: hit.distance, point: hit.point.clone() };
    return null;
  }

  private resolveArmedInteraction(): void {
    if (this.attackResolved) return;
    const progress = this.attackTimer > 0 ? 1 - this.attackTimer / this.attackDuration : 1;
    const contact = crossedMeleeHitWindow(this.attackPreviousProgress, progress, false);
    this.attackPreviousProgress = progress;
    if (!contact) return;
    this.attackResolved = true;
    this.resolveInteraction(this.findAimTarget(this.interactionReach(this.attackTool)));
  }

  private interact(): void {
    if (this.selectedSlot === 'foundation' || this.selectedSlot === 'wall' || this.selectedSlot === 'campfire') {
      this.placeStructure(this.selectedSlot);
      return;
    }
    if (this.attackTimer > 0) return;
    this.attackTool = this.selectedSlot === 'axe' || this.selectedSlot === 'spear' || this.selectedSlot === 'torch'
      ? this.selectedSlot : 'hands';
    this.attackDuration = toolActionDuration(this.attackTool);
    this.attackTimer = this.attackDuration;
    this.attackPreviousProgress = 0;
    this.attackResolved = false;
  }

  private resolveInteraction(target: AimTarget): void {
    if (!target) {
      const direction = this.camera.getWorldDirection(new THREE.Vector3());
      this.effects.burst(
        this.camera.position.clone().add(direction.clone().multiplyScalar(1.8)),
        PALETTE.cloud,
        3,
        0.25,
        { direction: { x: direction.x, z: direction.z } },
      );
      return;
    }
    if ('resource' in target) {
      const efficiency = this.attackTool === 'axe' && target.resource.kind === 'wood' ? 2 : 1;
      const amount = Math.min(efficiency, target.resource.amount);
      this.state = gather(this.state, target.resource.kind, amount);
      target.resource.amount -= amount;
      this.multiplayer.sendWorld({
        kind: 'gather',
        nodeId: target.resource.id,
        remaining: target.resource.amount,
      });
      this.effects.play('lightHit', target.point, resourceColor(target.resource), {
        direction: {
          x: target.resource.root.position.x - this.playerFeet.x,
          z: target.resource.root.position.z - this.playerFeet.z,
        },
      });
      this.audio.cue('gather');
      this.hud.toast(`+${amount} ${target.resource.kind}`);
      if (target.resource.amount <= 0) {
        target.resource.active = false;
        target.resource.root.visible = false;
      }
      return;
    }

    const tool = this.attackTool;
    const damage = attackDamage(tool);
    const wasDead = target.creature.dead;
    if (!damageCreature(target.creature, damage)) return;
    this.hitStop = Math.max(this.hitStop, tool === 'spear' ? 0.06 : 0.035);
    this.fovKick = Math.max(this.fovKick, 0.55);
    this.audio.cue('hit');
    this.effects.play(tool === 'spear' ? 'heavyHit' : 'lightHit', target.point, target.creature.definition.accent, {
      direction: {
        x: target.creature.root.position.x - this.playerFeet.x,
        z: target.creature.root.position.z - this.playerFeet.z,
      },
    });
    this.hud.impact(target.creature.dead ? 'INKED OUT!' : `${damage} HIT`, target.creature.dead ? 'tame' : 'paper');
    if (!wasDead && target.creature.dead) this.recordCreatureDefeat(target.creature);
    this.shareCreature(target.creature);
    this.hud.toast(target.creature.dead ? `${target.creature.definition.name} defeated` : `${damage} damage`);
  }

  private tryTame(): void {
    const creature = this.creatures
      .filter((candidate) => candidate.species === 'parasaur' && !candidate.tamed && !candidate.dead)
      .sort((left, right) => left.root.position.distanceToSquared(this.playerFeet) - right.root.position.distanceToSquared(this.playerFeet))[0];
    if (!creature || creature.root.position.distanceTo(this.playerFeet) > 4.8) {
      this.hud.toast('Move closer to a Mosscrest Parasaur');
      return;
    }
    if (creature.feedCooldown > 0) {
      this.hud.toast('Give the Mosscrest a moment');
      return;
    }
    const result = feedHerbivore(this.state, creature.trust);
    if (!result.ok) {
      this.hud.toast(result.message);
      return;
    }
    if (result.tamed && !tameCreature(creature)) return;
    this.state = result.state;
    creature.trust = result.trust;
    creature.feedCooldown = 0.9;
    this.effects.play(
      result.tamed ? 'tame' : 'lightHit',
      creature.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
      PALETTE.tame,
    );
    this.audio.cue(result.tamed ? 'tame' : 'feed');
    this.shareCreature(creature);
    this.hud.impact(result.tamed ? 'BONDED!' : `TRUST ${result.trust}/3`, 'tame');
    this.hud.toast(result.message);
    this.checkVictory();
  }

  private commandCompanion(): void {
    const companion = this.creatures
      .filter((creature) => creature.tamed && !creature.dead)
      .sort((left, right) => left.root.position.distanceToSquared(this.playerFeet)
        - right.root.position.distanceToSquared(this.playerFeet))[0];
    if (!companion || companion.root.position.distanceTo(this.playerFeet) > 14) {
      this.hud.toast('Move closer to your Mosscrest');
      return;
    }
    companion.command = companion.command === 'follow' ? 'stay' : 'follow';
    this.hud.impact(companion.command.toUpperCase(), 'tame');
    this.hud.toast(`Mosscrest ordered to ${companion.command}`);
    this.audio.cue('ui');
    this.saveExpedition();
  }

  private eatBerry(): void {
    const result = eatBerry(this.state);
    this.state = result.state;
    this.hud.toast(result.message);
    this.saveExpedition();
    if (result.ok) {
      this.audio.cue('eat');
      this.effects.burst(this.playerFeet.clone().add(new THREE.Vector3(0, 1.35, 0)), PALETTE.berry, 7, 0.32);
      this.hud.impact('+24 HUNGER', 'tame');
    }
  }

  private craftTool(tool: CraftableTool): void {
    const result = craft(this.state, tool);
    this.state = result.state;
    this.hud.toast(result.message);
    this.saveExpedition();
    if (result.ok) {
      this.audio.cue('craft');
      this.selectSlot(tool);
    }
  }

  private selectSlot(slot: SelectedSlot): void {
    if ((slot === 'axe' || slot === 'spear' || slot === 'torch') && !this.state.crafted[slot]) {
      this.hud.toast(`Craft the ${slot} first`);
      return;
    }
    this.selectedSlot = slot;
    if (slot === 'hands' || slot === 'axe' || slot === 'spear' || slot === 'torch') {
      this.state = { ...this.state, selectedTool: slot };
      this.removeBuildPreview();
    } else {
      this.removeBuildPreview();
      this.buildRotation = 0;
      this.buildPreview = createStructureVisual(slot, true);
      this.scene.add(this.buildPreview);
      this.hud.toast(`Placing ${slot} · click to build`);
    }
    this.updateViewModel();
    this.updateBuildPreview();
  }

  private updateViewModel(): void {
    setViewModelTool(
      this.viewModel,
      this.selectedSlot === 'axe' || this.selectedSlot === 'spear' || this.selectedSlot === 'torch'
        ? this.selectedSlot
        : 'hands',
    );
  }

  private updateBuildPreview(): void {
    if (!this.buildPreview || !['foundation', 'wall', 'campfire'].includes(this.selectedSlot)) return;
    const type = this.selectedSlot as BuildType;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const x = Math.round((this.playerFeet.x + forward.x * 4.2) * 2) / 2;
    const z = Math.round((this.playerFeet.z + forward.z * 4.2) * 2) / 2;
    const ground = heightAt(x, z);
    this.buildPreview.position.set(x, Math.max(ground, SEA_LEVEL), z);
    this.buildPreview.rotation.y = (type === 'wall' ? Math.round(this.yaw / (Math.PI / 2)) * (Math.PI / 2) : 0)
      + this.buildRotation;
    const footprint = buildFootprint(type, x, z, this.buildPreview.rotation.y);
    const cosine = Math.cos(footprint.yaw);
    const sine = Math.sin(footprint.yaw);
    const samples = [ground];
    for (const localX of [-footprint.halfWidth, footprint.halfWidth]) {
      for (const localZ of [-footprint.halfDepth, footprint.halfDepth]) {
        samples.push(heightAt(x + localX * cosine + localZ * sine, z - localX * sine + localZ * cosine));
      }
    }
    const slopeClear = Math.max(...samples) - Math.min(...samples) <= (type === 'wall' ? 1.4 : 0.9);
    const structuresClear = this.structures.every((structure) => !orientedBoxesOverlap(
      footprint,
      buildFootprint(
        structure.userData.buildType as BuildType,
        structure.position.x,
        structure.position.z,
        structure.rotation.y,
      ),
    ));
    const resourcesClear = this.world.resources.every((node) => !node.active || !orientedBoxIntersectsDisc(footprint, {
      x: node.root.position.x,
      z: node.root.position.z,
      radius: node.kind === 'wood' ? 0.72 : node.kind === 'stone' ? 0.85 : node.kind === 'berries' ? 0.75 : 0.35,
    }));
    const creaturesClear = this.creatures.every((creature) => !creature.root.visible || creature.dead
      || !orientedBoxIntersectsDisc(footprint, {
        x: creature.root.position.x,
        z: creature.root.position.z,
        radius: (creature.species === 'rex' ? 1.65 : creature.species === 'parasaur' ? 1.25 : 0.85)
          * creature.definition.scale,
      }));
    this.buildValid = ground > 0.35
      && slopeClear
      && canAfford(this.state, BUILD_COSTS[type])
      && structuresClear
      && resourcesClear
      && creaturesClear;
    setGhostValidity(this.buildPreview, this.buildValid);
  }

  private placeStructure(type: BuildType): void {
    this.updateBuildPreview();
    if (!this.buildPreview || !this.buildValid) {
      this.hud.toast(canAfford(this.state, BUILD_COSTS[type]) ? 'Find clear dry ground' : `Need more materials for ${type}`);
      return;
    }
    const result = payBuildCost(this.state, type);
    if (!result.ok) {
      this.hud.toast(result.message);
      return;
    }
    const structure = createStructureVisual(type);
    structure.position.copy(this.buildPreview.position);
    structure.rotation.copy(this.buildPreview.rotation);
    structure.userData.structureId = crypto.randomUUID();
    structure.userData.owned = true;
    this.scene.add(structure);
    this.structures.push(structure);
    this.state = result.state;
    this.effects.burst(structure.position.clone().add(new THREE.Vector3(0, 0.4, 0)), PALETTE.amber, 18, 0.75);
    this.audio.cue('build');
    this.multiplayer.sendWorld(this.structureEvent(structure));
    this.hud.toast(result.message);
    this.saveExpedition();
  }

  private tryDismantle(): void {
    if (this.structures.length === 0) {
      this.hud.toast('No structure in reach');
      return;
    }
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.raycaster.intersectObjects(this.structures, true)
      .find((intersection) => intersection.distance <= INTERACTION_DISTANCE);
    const structure = hit ? ancestorData<THREE.Group>(hit.object, 'structureRoot') : undefined;
    if (!structure) {
      this.hud.toast('Aim at a structure to dismantle');
      return;
    }
    if (!structure.userData.owned) {
      this.hud.toast('Only its builder can dismantle this structure');
      return;
    }
    const type = structure.userData.buildType as BuildType;
    const result = refundBuildCost(this.state, type);
    if (!result.ok) {
      this.hud.toast(result.message);
      return;
    }
    this.state = result.state;
    this.scene.remove(structure);
    const index = this.structures.indexOf(structure);
    if (index >= 0) this.structures.splice(index, 1);
    this.effects.burst(structure.position.clone().add(new THREE.Vector3(0, 0.6, 0)), PALETTE.woodLight, 15, 0.62);
    this.audio.cue('build');
    this.multiplayer.sendWorld({
      kind: 'build',
      action: 'remove',
      structureId: structure.userData.structureId as string,
    });
    this.hud.toast(result.message);
  }

  private nearCampfire(): boolean {
    return this.structures.some((structure) => structure.userData.buildType === 'campfire'
      && structure.position.distanceToSquared(this.playerFeet) < 25);
  }

  private staticObstacles(): Disc[] {
    // ponytail: the shipped slice has fewer than 70 blockers; cache/spatial-partition only if content grows.
    const obstacles: Disc[] = [];
    for (const node of this.world.resources) {
      if (!node.active || (node.kind !== 'wood' && node.kind !== 'stone')) continue;
      obstacles.push({
        x: node.root.position.x,
        z: node.root.position.z,
        radius: node.kind === 'wood' ? 0.62 : 0.8,
      });
    }
    for (const structure of this.structures) {
      const type = structure.userData.buildType as BuildType;
      if (type === 'foundation') continue;
      obstacles.push({
        x: structure.position.x,
        z: structure.position.z,
        radius: type === 'wall' ? 1.65 : 1.05,
      });
    }
    return obstacles;
  }

  private movementObstacles(ignoreCreature?: Creature): Disc[] {
    const obstacles = this.staticObstacles();
    for (const creature of this.creatures) {
      if (creature === ignoreCreature || creature.dead) continue;
      const radius = creature.definition.hostile
        ? creature.definition.attackRange / creature.definition.scale
        : 1.25;
      obstacles.push({
        x: creature.root.position.x,
        z: creature.root.position.z,
        radius: radius * creature.definition.scale,
      });
    }
    return obstacles;
  }

  private removeBuildPreview(): void {
    if (!this.buildPreview) return;
    this.scene.remove(this.buildPreview);
    this.buildPreview = null;
    this.buildValid = false;
  }

  private updateHud(): void {
    const target = this.findAimTarget();
    if (this.buildPreview) {
      this.hud.setPrompt(this.buildValid ? 'CLICK · PLACE STRUCTURE' : 'BLOCKED · NEED CLEAR DRY GROUND + MATERIALS');
    } else if (target && 'resource' in target) {
      this.hud.setPrompt(`E / CLICK · GATHER ${target.resource.kind.toUpperCase()}`);
    } else if (target && target.creature.definition.tameable && !target.creature.tamed) {
      this.hud.setPrompt(`F / T · FEED BERRY · TRUST ${target.creature.trust}/3`);
    } else if (target && 'creature' in target) {
      this.hud.setPrompt(target.creature.tamed
        ? `R · COMMAND ${target.creature.command === 'follow' ? 'STAY' : 'FOLLOW'} · ${target.creature.definition.name.toUpperCase()}`
        : `CLICK · STRIKE ${target.creature.definition.name.toUpperCase()} · ${target.creature.health} HP`);
    } else {
      this.hud.setPrompt(this.nearCampfire() && this.state.health < 100
        ? 'CAMP WARMTH · HEALTH RECOVERING'
        : this.state.inventory.berries > 0 && this.state.hunger < 78 ? 'G · EAT BERRY' : '');
    }
    this.hud.update({
      state: this.state,
      selectedSlot: this.selectedSlot,
      playerPosition: this.playerFeet,
      yaw: this.yaw,
      biome: biomeAt(this.playerFeet.x, this.playerFeet.z),
      creatures: this.creatures,
      resources: this.world.resources,
      remotes: this.multiplayer.remotes.values(),
    });
    this.audio.setAmbience(biomeAt(this.playerFeet.x, this.playerFeet.z), dayPhase(this.state.timeOfDay) === 'night');
    document.body.dataset.missionStage = this.state.mission.stage;
    document.body.dataset.structureCount = String(this.structures.length);
    document.body.dataset.remoteCount = String(this.remotes.size);
  }

  private async unlockAudio(): Promise<void> {
    const unlocked = await this.audio.unlock();
    document.body.dataset.audioState = unlocked ? 'running' : 'unavailable';
  }

  private toggleAudio(): void {
    void this.unlockAudio().then(() => {
      const muted = this.audio.toggleMute();
      document.body.dataset.audioMuted = String(muted);
      this.hud.toast(muted ? 'Audio muted' : 'Audio restored');
    });
  }

  private syncRemote(snapshot: RemoteSnapshot | null, departedId?: string): void {
    if (!snapshot && departedId) {
      const avatar = this.remotes.get(departedId);
      if (avatar) this.scene.remove(avatar.root);
      this.remotes.delete(departedId);
      return;
    }
    if (!snapshot) return;
    let avatar = this.remotes.get(snapshot.id);
    if (!avatar) {
      const root = createRemoteAvatar();
      root.position.set(snapshot.x, snapshot.y, snapshot.z);
      this.scene.add(root);
      avatar = { root, targetPosition: root.position.clone(), targetYaw: snapshot.yaw };
      this.remotes.set(snapshot.id, avatar);
    }
    avatar.targetPosition.set(snapshot.x, snapshot.y, snapshot.z);
    avatar.targetYaw = snapshot.yaw;
  }

  private syncWorld(event: WorldEvent): void {
    if (event.kind === 'gather') {
      const node = this.world.resources.find((candidate) => candidate.id === event.nodeId);
      if (!node) return;
      node.amount = Math.min(node.amount, event.remaining);
      node.active = node.amount > 0;
      node.root.visible = node.active;
      return;
    }
    if (event.kind === 'creature') {
      const creature = this.creatures.find((candidate) => candidate.id === event.creatureId);
      if (!creature) return;
      const wasDead = creature.dead;
      creature.definition = CREATURE_DEFS[creature.species];
      creature.health = Math.min(creature.health, Math.max(0, Math.min(event.health, creature.definition.maxHealth)));
      creature.dead ||= event.dead || creature.health === 0;
      creature.trust = Math.max(creature.trust, Math.min(3, event.trust));
      if ((creature.tamed || event.tamed) && !creature.dead) tameCreature(creature);
      creature.root.rotation.z = creature.dead ? Math.PI / 2 : 0;
      if (creature.dead) {
        creature.attack.phase = 'idle';
        creature.attack.remaining = 0;
        creature.attack.hitPending = false;
      }
      if (!wasDead && creature.dead && creature.species === 'rex') this.recordCreatureDefeat(creature);
      return;
    }
    const existing = this.structures.find(
      (structure) => structure.userData.structureId === event.structureId,
    );
    if (event.action === 'remove') {
      if (!existing) return;
      this.scene.remove(existing);
      this.structures.splice(this.structures.indexOf(existing), 1);
      return;
    }
    this.upsertStructure(
      event.structureId,
      event.buildType,
      event.x,
      event.y,
      event.z,
      event.rotation,
      false,
    );
  }

  private upsertStructure(
    id: string,
    type: BuildType,
    x: number,
    y: number,
    z: number,
    rotation: number,
    owned: boolean,
  ): THREE.Group {
    const exact = this.structures.find((structure) => structure.userData.structureId === id);
    const spatial = exact ?? this.structures.find((structure) => {
      if (structure.userData.buildType !== type) return false;
      const dx = structure.position.x - x;
      const dy = structure.position.y - y;
      const dz = structure.position.z - z;
      const angle = Math.atan2(
        Math.sin(structure.rotation.y - rotation),
        Math.cos(structure.rotation.y - rotation),
      );
      return dx * dx + dy * dy + dz * dz < 0.0025 && Math.abs(angle) < 0.02;
    });
    let structure = spatial;
    const wasOwned = Boolean(structure?.userData.owned) || owned;
    const previousId = typeof structure?.userData.structureId === 'string'
      ? structure.userData.structureId
      : '';
    if (structure && structure.userData.buildType !== type) {
      this.scene.remove(structure);
      this.structures.splice(this.structures.indexOf(structure), 1);
      structure = undefined;
    }
    if (!structure) {
      structure = createStructureVisual(type);
      this.structures.push(structure);
      this.scene.add(structure);
    }
    structure.position.set(x, y, z);
    structure.rotation.y = rotation;
    structure.userData.structureId = owned && !exact && previousId && !previousId.startsWith('legacy-structure-')
      ? previousId
      : id;
    structure.userData.owned = wasOwned;
    return structure;
  }

  private shareCreature(creature: Creature): void {
    this.multiplayer.sendWorld({
      kind: 'creature',
      creatureId: creature.id,
      health: creature.health,
      dead: creature.dead,
      tamed: creature.tamed,
      trust: creature.trust,
    });
  }

  private structureEvent(
    structure: THREE.Group,
  ): Extract<WorldEvent, { kind: 'build'; action: 'place' }> {
    return {
      kind: 'build',
      action: 'place',
      structureId: structure.userData.structureId as string,
      buildType: structure.userData.buildType as BuildType,
      x: structure.position.x,
      y: structure.position.y,
      z: structure.position.z,
      rotation: structure.rotation.y,
    };
  }

  private updateRemoteAvatars(delta: number): void {
    for (const avatar of this.remotes.values()) {
      avatar.root.position.lerp(avatar.targetPosition, Math.min(1, delta * 10));
      avatar.root.visible = avatar.root.position.distanceToSquared(this.playerFeet) > 2.25;
      const difference = Math.atan2(Math.sin(avatar.targetYaw - avatar.root.rotation.y), Math.cos(avatar.targetYaw - avatar.root.rotation.y));
      avatar.root.rotation.y += difference * Math.min(1, delta * 8);
    }
  }

  private animateStructures(): void {
    for (const structure of this.structures) {
      structure.traverse((child) => {
        if (!child.userData.flame) return;
        child.scale.y = 1 + Math.sin(this.elapsed * 9) * 0.12;
      });
    }
  }

  private die(): void {
    this.dead = true;
    this.playing = false;
    this.keys.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.hud.showDeath(true);
  }

  private respawn(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Storage can be disabled; a fresh in-memory expedition still works.
    }
    this.state = createInitialGameState();
    this.playerFeet.set(0, heightAt(0, 7), 7);
    this.planarVelocity.set(0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.dead = false;
    this.victoryShown = false;
    this.hud.hideVictory();
    this.selectedSlot = 'hands';
    this.removeBuildPreview();
    for (let index = this.structures.length - 1; index >= 0; index -= 1) {
      const structure = this.structures[index];
      if (!structure?.userData.owned) continue;
      this.multiplayer.sendWorld({
        kind: 'build',
        action: 'remove',
        structureId: structure.userData.structureId as string,
      });
      this.scene.remove(structure);
      this.structures.splice(index, 1);
    }
    for (const creature of this.creatures) {
      creature.health = CREATURE_DEFS[creature.species].maxHealth;
      creature.definition = CREATURE_DEFS[creature.species];
      creature.dead = false;
      creature.tamed = false;
      creature.trust = 0;
      creature.feedCooldown = 0;
      creature.command = 'follow';
      creature.attack.phase = 'idle';
      creature.attack.remaining = 0;
      creature.attack.hitPending = false;
      creature.root.rotation.z = 0;
    }
    for (const node of this.world.resources) {
      node.active = true;
      node.amount = node.kind === 'wood' ? 4 : node.kind === 'stone' ? 3 : 2;
      node.root.visible = true;
    }
    this.hud.showDeath(false);
    this.updateViewModel();
    this.start();
  }

  private configureTestScenario(): void {
    if (!this.testScenario || (!this.testMode && this.testScenario !== 'save')) return;
    if (this.testScenario === 'lineup') {
      const featured = (['parasaur', 'raptor', 'rex'] as const)
        .map((species) => this.creatures.find((creature) => creature.species === species))
        .filter((creature): creature is Creature => Boolean(creature));
      this.creatures.forEach((creature) => { creature.root.visible = featured.includes(creature); });
      featured.forEach((creature, index) => {
        const x = (index - 1) * 4.8;
        const z = creature.species === 'rex' ? -14 : creature.species === 'parasaur' ? -10 : -9;
        creature.root.position.set(x, heightAt(x, z), z);
        creature.root.rotation.y = 0;
        creature.tamed = true;
        creature.command = 'stay';
        creature.definition = { ...creature.definition, hostile: false };
      });
      this.playerFeet.set(0, heightAt(0, 5), 5);
      this.yaw = 0;
      this.pitch = 0.06;
    } else if (this.testScenario === 'coast') {
      this.playerFeet.set(-46, heightAt(-46, 8), 8);
      this.yaw = 0.78;
      this.pitch = -0.04;
    } else if (this.testScenario === 'night') {
      this.creatures.forEach((creature) => {
        if (creature.definition.hostile) creature.definition = { ...creature.definition, hostile: false };
        creature.root.visible = false;
      });
      this.state = {
        ...this.state,
        timeOfDay: 0.91,
        crafted: { ...this.state.crafted, torch: true },
        selectedTool: 'torch',
      };
      this.selectedSlot = 'torch';
      const campfire = createStructureVisual('campfire');
      campfire.position.set(2.5, heightAt(2.5, 8), 8);
      this.scene.add(campfire);
      this.playerFeet.set(2.5, heightAt(2.5, 12), 12);
      this.yaw = 0;
      this.pitch = -0.04;
    } else if (this.testScenario === 'tame') {
      const creature = this.creatures.find((candidate) => candidate.species === 'parasaur');
      if (!creature) return;
      creature.trust = 2;
      this.state = {
        ...this.state,
        inventory: { ...this.state.inventory, berries: 3 },
      };
      this.playerFeet.set(creature.root.position.x, heightAt(creature.root.position.x, creature.root.position.z + 3.4), creature.root.position.z + 3.4);
      this.yaw = 0;
    } else if (this.testScenario === 'save') {
      let mission = this.state.mission;
      mission = recordMissionEvent(mission, { type: 'gather', resource: 'wood', amount: 4 });
      mission = recordMissionEvent(mission, { type: 'gather', resource: 'stone', amount: 3 });
      mission = recordMissionEvent(mission, { type: 'gather', resource: 'fiber', amount: 4 });
      this.state = {
        ...this.state,
        inventory: { wood: 4, stone: 3, fiber: 4, berries: 2 },
        crafted: { ...this.state.crafted, torch: true },
        selectedTool: 'torch',
        structuresPlaced: 1,
        mission,
      };
      this.selectedSlot = 'torch';
      const campfire = createStructureVisual('campfire');
      campfire.position.set(2.5, heightAt(2.5, 8), 8);
      campfire.userData.structureId = crypto.randomUUID();
      campfire.userData.owned = true;
      this.structures.push(campfire);
      this.scene.add(campfire);
    } else if (this.testScenario === 'boss' || this.testScenario === 'combat' || this.testScenario === 'victory') {
      const creature = this.creatures.find((candidate) => candidate.species === 'rex');
      if (!creature) return;
      if (this.testScenario === 'boss') {
        creature.definition = { ...creature.definition, damage: 0, speed: 0 };
      }
      if (this.testScenario !== 'victory') {
        this.creatures.forEach((candidate) => { candidate.root.visible = candidate === creature; });
      }
      let mission = this.state.mission;
      mission = recordMissionEvent(mission, { type: 'gather', resource: 'wood', amount: 3 });
      mission = recordMissionEvent(mission, { type: 'gather', resource: 'stone', amount: 2 });
      mission = recordMissionEvent(mission, { type: 'gather', resource: 'fiber', amount: 3 });
      mission = recordMissionEvent(mission, { type: 'craft', tool: 'spear' });
      mission = recordMissionEvent(mission, { type: 'build', build: 'campfire' });
      mission = recordMissionEvent(mission, { type: 'build', build: 'foundation' });
      mission = recordMissionEvent(mission, { type: 'tame' });
      mission = { ...mission, survivalSeconds: 423 };
      if (this.testScenario === 'victory') {
        mission = recordMissionEvent(mission, { type: 'defeat', species: 'rex' });
        creature.health = 0;
        creature.dead = true;
        creature.root.rotation.z = Math.PI / 2;
      }
      this.state = {
        ...this.state,
        crafted: { ...this.state.crafted, spear: true },
        selectedTool: 'spear',
        mission,
      };
      this.selectedSlot = 'spear';
      const encounterX = creature.root.position.x - 6;
      const encounterZ = creature.root.position.z + (this.testScenario === 'victory' ? 22 : 18.5);
      this.playerFeet.set(encounterX, heightAt(encounterX, encounterZ), encounterZ);
      this.yaw = Math.atan2(-(creature.root.position.x - encounterX), -(creature.root.position.z - encounterZ));
      this.pitch = this.testScenario === 'victory' ? -0.16 : -0.07;
    }
    document.body.dataset.testScenario = this.testScenario;
  }

  private readSavedExpedition(): SaveSnapshot | null {
    if (this.testMode) return null;
    try {
      return parseSave(localStorage.getItem(SAVE_KEY));
    } catch {
      return null;
    }
  }

  private saveExpedition(): void {
    if (this.testMode || !this.hasStarted) return;
    const snapshot: SaveSnapshot = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state: this.state,
      player: {
        x: this.playerFeet.x,
        y: this.playerFeet.y,
        z: this.playerFeet.z,
        yaw: this.yaw,
        pitch: this.pitch,
      },
      structures: this.structures.filter((structure) => structure.userData.owned).map((structure) => ({
        id: structure.userData.structureId as string,
        type: structure.userData.buildType as BuildType,
        x: structure.position.x,
        y: structure.position.y,
        z: structure.position.z,
        rotation: structure.rotation.y,
      })),
      creatures: this.creatures.map((creature) => ({
        id: creature.id,
        species: creature.species,
        health: creature.health,
        tamed: creature.tamed,
        dead: creature.dead,
        trust: creature.trust,
        command: creature.command,
        x: creature.root.position.x,
        y: creature.root.position.y,
        z: creature.root.position.z,
      })),
    };
    try {
      localStorage.setItem(SAVE_KEY, serializeSave(snapshot));
      this.pendingSave = snapshot;
      document.body.dataset.saveState = 'saved';
    } catch {
      document.body.dataset.saveState = 'unavailable';
    }
  }

  private continueExpedition(): void {
    if (!this.pendingSave) {
      this.hud.toast('No valid saved expedition');
      return;
    }
    const snapshot = this.pendingSave;
    for (let index = this.structures.length - 1; index >= 0; index -= 1) {
      const structure = this.structures[index];
      if (!structure?.userData.owned) continue;
      this.scene.remove(structure);
      this.structures.splice(index, 1);
    }
    for (const saved of snapshot.structures) {
      const structure = this.upsertStructure(
        saved.id,
        saved.type,
        saved.x,
        saved.y,
        saved.z,
        saved.rotation,
        true,
      );
      this.multiplayer.sendWorld(this.structureEvent(structure));
    }
    const savedCreatures = new Map(snapshot.creatures.map((creature) => [creature.id, creature]));
    for (const creature of this.creatures) {
      const saved = savedCreatures.get(creature.id);
      if (!saved || saved.species !== creature.species) continue;
      const continuity = mergeCreatureContinuity(creature, saved);
      creature.definition = CREATURE_DEFS[creature.species];
      creature.health = continuity.health;
      creature.dead = continuity.dead;
      creature.tamed = false;
      creature.trust = continuity.trust;
      creature.command = saved.command;
      creature.root.position.set(saved.x, saved.y, saved.z);
      creature.root.rotation.z = creature.dead ? Math.PI / 2 : 0;
      creature.attack.phase = 'idle';
      creature.attack.remaining = 0;
      creature.attack.hitPending = false;
      if (continuity.tamed) {
        tameCreature(creature);
        creature.command = saved.command;
      }
    }
    this.state = snapshot.state;
    this.playerFeet.set(snapshot.player.x, snapshot.player.y, snapshot.player.z);
    this.planarVelocity.set(0, 0);
    this.yaw = snapshot.player.yaw;
    this.pitch = snapshot.player.pitch;
    this.selectedSlot = snapshot.state.selectedTool;
    this.updateViewModel();
    this.world.updateDay(this.state.timeOfDay);
    this.hasStarted = true;
    this.pendingSave = null;
    this.hud.toast('Saved expedition restored');
    this.start();
    const defeatedRex = this.creatures.find((creature) => creature.species === 'rex' && creature.dead);
    if (defeatedRex) this.recordCreatureDefeat(defeatedRex);
    else this.checkVictory();
  }

  private checkVictory(): void {
    if (this.state.mission.stage === 'complete' && !this.victoryShown) this.triggerVictory();
  }

  private recordCreatureDefeat(creature: Creature): void {
    this.state = {
      ...this.state,
      mission: recordMissionEvent(this.state.mission, { type: 'defeat', species: creature.species }),
    };
    this.checkVictory();
  }

  private triggerVictory(): void {
    this.victoryShown = true;
    this.playing = false;
    this.keys.clear();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.audio.cue('victory');
    this.hud.showVictory(this.state);
    document.body.dataset.victory = 'true';
    this.saveExpedition();
  }

  private continueAfterVictory(): void {
    this.hud.hideVictory();
    this.playing = true;
    void this.unlockAudio();
    if (!this.testMode && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock().catch(() => undefined);
    }
  }

  private replay(): void {
    this.hud.hideVictory();
    this.respawn();
  }

  private readPlayerSettings(): GameSettings {
    try {
      return parseSettings(localStorage.getItem(SETTINGS_KEY));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private applySettings(settings: GameSettings): void {
    const safe = parseSettings(serializeSettings(settings));
    this.settings = safe;
    this.reducedMotion = safe.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.audio.setVolume(safe.volume);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.qualityPixelRatio(safe.quality)));
    this.renderer.shadowMap.enabled = safe.quality !== 'low';
    this.camera.fov = safe.fov;
    this.camera.updateProjectionMatrix();
    this.resize();
    this.hud.setSettings(safe);
    document.body.dataset.quality = safe.quality;
    document.body.dataset.reducedMotion = String(this.reducedMotion);
    try {
      localStorage.setItem(SETTINGS_KEY, serializeSettings(safe));
    } catch {
      // Settings remain active for the session when storage is unavailable.
    }
  }

  private qualityPixelRatio(quality: GameSettings['quality']): number {
    return quality === 'low' ? 1 : quality === 'medium' ? 1.4 : 1.8;
  }

  private toggleFullscreen(): void {
    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    action.catch(() => this.hud.toast('Fullscreen is unavailable in this browser'));
  }

  private resize(): void {
    const width = innerWidth;
    const height = innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }
}
