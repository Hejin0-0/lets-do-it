import * as THREE from 'three';
import type { Creature } from './creatures.ts';
import { canAfford, dayPhase, RECIPES, type BuildType, type CraftableTool, type GameState, type Tool } from './gameplay.ts';
import type { RemoteSnapshot } from './multiplayer.ts';
import type { GameSettings, QualityLevel } from './settings.ts';
import { biomeAt, heightAt, type Biome, type ResourceNode, WORLD_SEED, WORLD_SIZE } from './world.ts';

export type SelectedSlot = Tool | BuildType;

export const shouldOpenCraftFromTab = (activeGameplay: boolean, menuVisible: boolean, repeat: boolean): boolean =>
  activeGameplay && !menuVisible && !repeat;

export interface HudSnapshot {
  state: GameState;
  selectedSlot: SelectedSlot;
  playerPosition: THREE.Vector3;
  yaw: number;
  biome: Biome;
  creatures: Creature[];
  resources: ResourceNode[];
  remotes: Iterable<RemoteSnapshot>;
}

const required = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required UI element #${id}`);
  return element as T;
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export class Hud {
  private readonly bars = {
    health: required<HTMLElement>('health-bar'),
    stamina: required<HTMLElement>('stamina-bar'),
    hunger: required<HTMLElement>('hunger-bar'),
  };
  private readonly values = {
    health: required<HTMLElement>('health-value'),
    stamina: required<HTMLElement>('stamina-value'),
    hunger: required<HTMLElement>('hunger-value'),
  };
  private readonly resourceCounts = {
    wood: required<HTMLElement>('wood-count'),
    stone: required<HTMLElement>('stone-count'),
    fiber: required<HTMLElement>('fiber-count'),
    berries: required<HTMLElement>('berries-count'),
  };
  private readonly craftPanel = required<HTMLElement>('craft-panel');
  private readonly settingsPanel = required<HTMLElement>('settings-panel');
  private readonly craftButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-craft]')];
  private readonly slotButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-slot]')];
  private readonly prompt = required<HTMLElement>('interaction-prompt');
  private readonly toastElement = required<HTMLElement>('toast');
  private readonly damageElement = required<HTMLElement>('damage-vignette');
  private readonly minimap = required<HTMLCanvasElement>('minimap');
  private readonly minimapContext: CanvasRenderingContext2D;
  private readonly minimapBase: HTMLCanvasElement;
  private toastTimer = 0;
  private impactTimer = 0;

  constructor() {
    const context = this.minimap.getContext('2d');
    if (!context) throw new Error('Canvas 2D is required for the minimap');
    this.minimapContext = context;
    this.minimapBase = this.drawMinimapBase();
  }

  bindActions(actions: {
    start: () => void;
    continueExpedition: () => void;
    respawn: () => void;
    victoryContinue: () => void;
    replay: () => void;
    settingsChanged: (settings: GameSettings) => void;
    fullscreen: () => void;
    craft: (tool: CraftableTool) => void;
    slot: (slot: SelectedSlot) => void;
    closeCraft: () => void;
  }): void {
    required<HTMLButtonElement>('start-button').addEventListener('click', actions.start);
    required<HTMLButtonElement>('continue-button').addEventListener('click', actions.continueExpedition);
    required<HTMLButtonElement>('respawn-button').addEventListener('click', actions.respawn);
    required<HTMLButtonElement>('victory-continue').addEventListener('click', actions.victoryContinue);
    required<HTMLButtonElement>('victory-replay').addEventListener('click', actions.replay);
    required<HTMLButtonElement>('settings-button').addEventListener('click', () => this.toggleSettings(true));
    required<HTMLButtonElement>('settings-close').addEventListener('click', () => this.toggleSettings(false));
    required<HTMLButtonElement>('fullscreen-button').addEventListener('click', actions.fullscreen);
    required<HTMLButtonElement>('craft-close').addEventListener('click', actions.closeCraft);
    for (const button of this.craftButtons) {
      button.addEventListener('click', () => actions.craft(button.dataset.craft as CraftableTool));
    }
    for (const button of this.slotButtons) {
      button.addEventListener('click', () => actions.slot(button.dataset.slot as SelectedSlot));
    }
    for (const input of [
      required<HTMLInputElement>('volume-setting'),
      required<HTMLInputElement>('fov-setting'),
      required<HTMLInputElement>('sensitivity-setting'),
      required<HTMLSelectElement>('quality-setting'),
      required<HTMLInputElement>('motion-setting'),
    ]) {
      input.addEventListener('input', () => actions.settingsChanged(this.readSettings()));
      input.addEventListener('change', () => actions.settingsChanged(this.readSettings()));
    }
  }

  update(snapshot: HudSnapshot): void {
    const { state } = snapshot;
    for (const key of ['health', 'stamina', 'hunger'] as const) {
      const value = Math.round(state[key]);
      this.bars[key].style.width = `${value}%`;
      this.values[key].textContent = String(value);
      this.bars[key].parentElement?.setAttribute('aria-valuenow', String(value));
    }
    for (const resource of ['wood', 'stone', 'fiber', 'berries'] as const) {
      this.resourceCounts[resource].textContent = String(state.inventory[resource]);
    }

    const phase = dayPhase(state.timeOfDay);
    required('phase-label').textContent = titleCase(phase);
    required('biome-label').textContent = {
      coast: 'Saltwind Coast',
      jungle: 'Sunleaf Jungle',
      plains: 'Amber Plains',
      highlands: 'Blueglass Highlands',
    }[snapshot.biome];
    const totalMinutes = Math.floor(state.timeOfDay * 24 * 60);
    const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minute = (totalMinutes % 60).toString().padStart(2, '0');
    required('clock-label').textContent = `${hour}:${minute}`;

    for (const button of this.slotButtons) {
      const slot = button.dataset.slot as SelectedSlot;
      const selected = slot === snapshot.selectedSlot;
      const locked = (slot === 'axe' || slot === 'spear' || slot === 'torch') && !state.crafted[slot];
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-locked', locked);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = locked;
    }
    for (const button of this.craftButtons) {
      const tool = button.dataset.craft as CraftableTool;
      button.disabled = false;
      button.setAttribute('aria-disabled', String(state.crafted[tool] || !canAfford(state, RECIPES[tool])));
      const action = button.querySelector('b');
      if (action) action.textContent = state.crafted[tool] ? 'OWNED' : 'CRAFT';
    }

    this.updateObjective(state);
    this.updateEncounter(snapshot);
    this.drawMinimap(snapshot);
  }

  toggleCraft(force?: boolean): boolean {
    const open = force ?? !this.craftPanel.classList.contains('is-open');
    this.craftPanel.classList.toggle('is-open', open);
    this.craftPanel.setAttribute('aria-hidden', String(!open));
    this.craftPanel.inert = !open;
    if (open) required<HTMLButtonElement>('craft-close').focus();
    return open;
  }

  isCraftOpen(): boolean {
    return this.craftPanel.classList.contains('is-open');
  }

  toggleSettings(force?: boolean): boolean {
    const open = force ?? !this.settingsPanel.classList.contains('is-open');
    this.settingsPanel.classList.toggle('is-open', open);
    this.settingsPanel.setAttribute('aria-hidden', String(!open));
    this.settingsPanel.inert = !open;
    const start = required<HTMLElement>('start-screen');
    if (!start.classList.contains('is-hidden')) start.inert = open;
    if (open) required<HTMLInputElement>('volume-setting').focus();
    else required<HTMLButtonElement>('settings-button').focus();
    return open;
  }

  isSettingsOpen(): boolean {
    return this.settingsPanel.classList.contains('is-open');
  }

  setSettings(settings: GameSettings): void {
    required<HTMLInputElement>('volume-setting').value = String(settings.volume);
    required<HTMLInputElement>('fov-setting').value = String(settings.fov);
    required<HTMLInputElement>('sensitivity-setting').value = String(settings.sensitivity);
    required<HTMLSelectElement>('quality-setting').value = settings.quality;
    required<HTMLInputElement>('motion-setting').checked = settings.reducedMotion;
    required('volume-output').textContent = `${Math.round(settings.volume * 100)}%`;
    required('fov-output').textContent = `${Math.round(settings.fov)}°`;
    required('sensitivity-output').textContent = `${settings.sensitivity.toFixed(2)}×`;
  }

  setPrompt(message: string): void {
    this.prompt.textContent = message;
  }

  toast(message: string, announce = true): void {
    window.clearTimeout(this.toastTimer);
    this.toastElement.textContent = message.toUpperCase();
    this.toastElement.classList.add('is-visible');
    if (announce) required('a11y-status').textContent = message;
    this.toastTimer = window.setTimeout(() => this.toastElement.classList.remove('is-visible'), 1_700);
  }

  damage(): void {
    this.damageElement.classList.remove('is-hit');
    requestAnimationFrame(() => this.damageElement.classList.add('is-hit'));
    window.setTimeout(() => this.damageElement.classList.remove('is-hit'), 150);
  }

  impact(message: string, tone: 'danger' | 'tame' | 'paper'): void {
    const element = required('comic-impact');
    window.clearTimeout(this.impactTimer);
    element.textContent = message;
    element.classList.remove('is-visible', 'is-danger', 'is-tame');
    if (tone !== 'paper') element.classList.add(`is-${tone}`);
    requestAnimationFrame(() => element.classList.add('is-visible'));
    this.impactTimer = window.setTimeout(() => element.classList.remove('is-visible'), 360);
  }

  setNetwork(label: string, status: 'connecting' | 'online' | 'offline'): void {
    required('network-label').textContent = label;
    const dot = required('network-dot');
    dot.classList.toggle('is-online', status === 'online');
    dot.classList.toggle('is-offline', status === 'offline');
  }

  enterGame(): void {
    const screen = required('start-screen');
    screen.classList.add('is-hidden');
    screen.setAttribute('aria-hidden', 'true');
    screen.inert = true;
  }

  setContinueAvailable(available: boolean): void {
    required<HTMLButtonElement>('continue-button').hidden = !available;
  }

  showPause(): void {
    const screen = required('start-screen');
    screen.classList.remove('is-hidden');
    screen.setAttribute('aria-hidden', 'false');
    screen.inert = false;
    required('start-title').innerHTML = 'EXPEDITION<br><em>PAUSED</em>';
    required<HTMLButtonElement>('start-button').innerHTML = 'RETURN TO THE ISLE <span>→</span>';
    required<HTMLButtonElement>('continue-button').hidden = true;
  }

  showDeath(show: boolean): void {
    required<HTMLElement>('death-screen').hidden = !show;
  }

  showVictory(state: GameState): void {
    const seconds = Math.max(0, Math.round(state.mission.survivalSeconds));
    const minutes = Math.floor(seconds / 60);
    required('victory-time').textContent = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    required('victory-gathered').textContent = String(
      Object.values(state.mission.gathered).reduce((total, amount) => total + amount, 0),
    );
    required('victory-built').textContent = String(state.mission.structuresBuilt);
    required('victory-defeated').textContent = String(state.mission.dinosaursDefeated);
    required<HTMLElement>('victory-screen').hidden = false;
  }

  hideVictory(): void {
    required<HTMLElement>('victory-screen').hidden = true;
  }

  private updateObjective(state: GameState): void {
    const objectives: Record<GameState['mission']['stage'], readonly [string, string]> = {
      landfall: [
        'Read the shoreline',
        `Gather expedition stock · wood ${Math.min(3, state.mission.gathered.wood)}/3 · stone ${Math.min(2, state.mission.gathered.stone)}/2 · fiber ${Math.min(3, state.mission.gathered.fiber)}/3`,
      ],
      forge: ['Forge a reach weapon', 'Open the field kit [C] and craft the Inkwood Spear.'],
      shelter: ['Raise a firelit foothold', 'Place a campfire and a foundation or wall from slots 5–7.'],
      bond: ['Earn Mosscrest trust', 'Offer one berry [F], wait, and repeat until trust reaches 3/3.'],
      hunt: ['Bring down the Ink-Jaw', 'Follow the red crest into the highlands. Strike after its committed lunge.'],
      complete: ['Expedition secured', 'The Ink-Jaw has fallen. The island is yours to explore.'],
    };
    const [title, copy] = objectives[state.mission.stage];
    required('objective-title').textContent = title;
    required('objective-copy').textContent = copy;
  }

  private readSettings(): GameSettings {
    const settings: GameSettings = {
      volume: Number(required<HTMLInputElement>('volume-setting').value),
      fov: Number(required<HTMLInputElement>('fov-setting').value),
      sensitivity: Number(required<HTMLInputElement>('sensitivity-setting').value),
      quality: required<HTMLSelectElement>('quality-setting').value as QualityLevel,
      reducedMotion: required<HTMLInputElement>('motion-setting').checked,
    };
    this.setSettings(settings);
    return settings;
  }

  private updateEncounter(snapshot: HudSnapshot): void {
    const panel = required<HTMLElement>('encounter-panel');
    const threats = snapshot.creatures
      .filter((creature) => creature.root.visible && !creature.dead && creature.definition.hostile)
      .map((creature) => ({ creature, distance: creature.root.position.distanceTo(snapshot.playerPosition) }))
      .filter(({ creature, distance }) => creature.attack.phase !== 'idle' || distance < (creature.species === 'rex' ? 34 : 13))
      .sort((left, right) => Number(right.creature.species === 'rex') - Number(left.creature.species === 'rex') || left.distance - right.distance);
    const threat = threats[0]?.creature;
    const tame = snapshot.creatures
      .filter((creature) => creature.root.visible && creature.species === 'parasaur' && !creature.dead && !creature.tamed)
      .sort((left, right) => left.root.position.distanceToSquared(snapshot.playerPosition) - right.root.position.distanceToSquared(snapshot.playerPosition))[0];
    const nearbyTame = tame && tame.root.position.distanceTo(snapshot.playerPosition) < 9 ? tame : undefined;
    const creature = threat ?? nearbyTame;
    panel.hidden = !creature;
    if (!creature) return;

    const isThreat = creature.definition.hostile;
    const value = isThreat
      ? Math.round(creature.health / creature.definition.maxHealth * 100)
      : Math.round(creature.trust / 3 * 100);
    required('encounter-kicker').textContent = isThreat
      ? creature.species === 'rex' ? 'APEX ENCOUNTER' : 'PACK THREAT'
      : 'BONDING';
    required('encounter-title').textContent = creature.definition.name.toUpperCase();
    required('encounter-state').textContent = isThreat
      ? (creature.attack.phase === 'idle' ? 'STALKING' : creature.attack.phase.toUpperCase())
      : `TRUST ${creature.trust}/3`;
    required<HTMLElement>('encounter-bar').style.width = `${value}%`;
    required<HTMLElement>('encounter-bar').classList.toggle('is-tame', !isThreat);
    const track = required('encounter-bar').parentElement;
    track?.setAttribute('aria-valuenow', String(value));
    track?.setAttribute('aria-label', isThreat ? `${creature.definition.name} health` : 'Mosscrest trust');
  }

  private drawMinimapBase(): HTMLCanvasElement {
    const base = document.createElement('canvas');
    base.width = this.minimap.width;
    base.height = this.minimap.height;
    const context = base.getContext('2d');
    if (!context) return base;
    context.fillStyle = '#1f5662';
    context.fillRect(0, 0, base.width, base.height);
    const step = 5;
    for (let pixelX = 0; pixelX < base.width; pixelX += step) {
      for (let pixelY = 0; pixelY < base.height; pixelY += step) {
        const worldX = (pixelX / base.width - 0.5) * WORLD_SIZE;
        const worldZ = (pixelY / base.height - 0.5) * WORLD_SIZE;
        if (heightAt(worldX, worldZ, WORLD_SEED) < 0.1) continue;
        const biome = biomeAt(worldX, worldZ, WORLD_SEED);
        context.fillStyle = {
          coast: '#d0b66f',
          jungle: '#2e7043',
          plains: '#c8863d',
          highlands: '#587f92',
        }[biome];
        context.fillRect(pixelX, pixelY, step + 1, step + 1);
      }
    }
    return base;
  }

  private mapPoint(x: number, z: number): [number, number] {
    return [
      this.minimap.width * (0.5 + x / WORLD_SIZE),
      this.minimap.height * (0.5 + z / WORLD_SIZE),
    ];
  }

  private drawMinimap(snapshot: HudSnapshot): void {
    const context = this.minimapContext;
    const remotes = [...snapshot.remotes];
    context.clearRect(0, 0, this.minimap.width, this.minimap.height);
    context.drawImage(this.minimapBase, 0, 0);

    for (const node of snapshot.resources) {
      if (!node.active) continue;
      const [x, y] = this.mapPoint(node.root.position.x, node.root.position.z);
      context.fillStyle = node.kind === 'berries' ? '#d94f69' : '#e8d7a8';
      context.fillRect(x - 1, y - 1, 2, 2);
    }
    for (const creature of snapshot.creatures) {
      if (creature.dead) continue;
      const [x, y] = this.mapPoint(creature.root.position.x, creature.root.position.z);
      context.fillStyle = creature.tamed ? '#65e08a' : creature.definition.hostile ? '#ff5b3d' : '#65e0c2';
      context.beginPath();
      context.arc(x, y, creature.species === 'rex' ? 4 : 2.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#101315';
      context.lineWidth = 1;
      context.stroke();
    }
    for (const remote of remotes) {
      const [x, y] = this.mapPoint(remote.x, remote.z);
      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.fillStyle = '#e8a83e';
      context.fillRect(-3, -3, 6, 6);
      context.strokeStyle = '#101315';
      context.strokeRect(-3, -3, 6, 6);
      context.restore();
    }

    const [playerX, playerY] = this.mapPoint(snapshot.playerPosition.x, snapshot.playerPosition.z);
    context.save();
    context.translate(playerX, playerY);
    context.rotate(-snapshot.yaw);
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(5, 5);
    context.lineTo(0, 2);
    context.lineTo(-5, 5);
    context.closePath();
    context.fillStyle = '#f0e5ca';
    context.fill();
    context.strokeStyle = '#101315';
    context.lineWidth = 2;
    context.stroke();
    context.restore();

    this.minimap.setAttribute(
      'aria-label',
      `Minimap: ${snapshot.creatures.filter((creature) => !creature.dead && creature.definition.hostile).length} threats, ${remotes.length} connected allies`,
    );
  }
}
