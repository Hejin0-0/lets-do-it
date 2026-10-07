import {
  RESOURCES,
  type BuildType,
  type GameState,
  type MissionProgress,
  type Resource,
  type Tool,
} from './gameplay.ts';

export const SAVE_KEY = 'inkbound-isle-expedition-v1';
export const SAVE_VERSION = 2 as const;

export interface SavedPlayer {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface SavedStructure {
  id: string;
  type: BuildType;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export interface SavedCreature {
  id: string;
  species: 'parasaur' | 'raptor' | 'rex';
  health: number;
  tamed: boolean;
  dead: boolean;
  trust: number;
  command: 'follow' | 'stay';
  x: number;
  y: number;
  z: number;
}

export interface SaveSnapshot {
  version: typeof SAVE_VERSION;
  savedAt: number;
  state: GameState;
  player: SavedPlayer;
  structures: SavedStructure[];
  creatures: SavedCreature[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isInteger = (value: unknown, min: number, max: number): value is number =>
  isNumber(value, min, max) && Number.isInteger(value);

function resourceRecord(value: unknown, max: number): Record<Resource, number> | null {
  if (!isRecord(value) || !RESOURCES.every((resource) => isInteger(value[resource], 0, max))) return null;
  return {
    wood: value.wood as number,
    stone: value.stone as number,
    fiber: value.fiber as number,
    berries: value.berries as number,
  };
}

function missionProgress(value: unknown): MissionProgress | null {
  if (!isRecord(value) || !isRecord(value.built)) return null;
  const gathered = resourceRecord(value.gathered, 1_000_000);
  const stages = ['landfall', 'forge', 'shelter', 'bond', 'hunt', 'complete'];
  if (!gathered
    || !stages.includes(String(value.stage))
    || typeof value.spearCrafted !== 'boolean'
    || typeof value.tamed !== 'boolean'
    || typeof value.rexDefeated !== 'boolean'
    || !isInteger(value.built.foundation, 0, 1_000)
    || !isInteger(value.built.wall, 0, 1_000)
    || !isInteger(value.built.campfire, 0, 1_000)
    || !isInteger(value.structuresBuilt, 0, 1_000)
    || !isInteger(value.dinosaursDefeated, 0, 1_000)
    || !isNumber(value.survivalSeconds, 0, 10_000_000)) return null;
  return {
    stage: value.stage as MissionProgress['stage'],
    gathered,
    spearCrafted: value.spearCrafted,
    built: {
      foundation: value.built.foundation,
      wall: value.built.wall,
      campfire: value.built.campfire,
    },
    structuresBuilt: value.structuresBuilt,
    tamed: value.tamed,
    rexDefeated: value.rexDefeated,
    dinosaursDefeated: value.dinosaursDefeated,
    survivalSeconds: value.survivalSeconds,
  };
}

function gameState(value: unknown): GameState | null {
  if (!isRecord(value) || !isRecord(value.crafted)) return null;
  const inventory = resourceRecord(value.inventory, 999);
  const mission = missionProgress(value.mission);
  const tools: Tool[] = ['hands', 'axe', 'spear', 'torch'];
  if (!inventory
    || !mission
    || typeof value.crafted.axe !== 'boolean'
    || typeof value.crafted.spear !== 'boolean'
    || typeof value.crafted.torch !== 'boolean'
    || !tools.includes(value.selectedTool as Tool)
    || !isInteger(value.structuresPlaced, 0, 128)
    || !isInteger(value.tamedCount, 0, 32)
    || !isNumber(value.health, 0, 100)
    || !isNumber(value.stamina, 0, 100)
    || !isNumber(value.hunger, 0, 100)
    || !isNumber(value.timeOfDay, 0, 1)) return null;
  return {
    inventory,
    crafted: {
      axe: value.crafted.axe,
      spear: value.crafted.spear,
      torch: value.crafted.torch,
    },
    selectedTool: value.selectedTool as Tool,
    structuresPlaced: value.structuresPlaced,
    tamedCount: value.tamedCount,
    health: value.health,
    stamina: value.stamina,
    hunger: value.hunger,
    timeOfDay: value.timeOfDay,
    mission,
  };
}

function savedPlayer(value: unknown): SavedPlayer | null {
  if (!isRecord(value)
    || !isNumber(value.x, -75, 75)
    || !isNumber(value.y, -20, 50)
    || !isNumber(value.z, -75, 75)
    || !isNumber(value.yaw, -Math.PI * 8, Math.PI * 8)
    || !isNumber(value.pitch, -1.5, 1.5)) return null;
  return { x: value.x, y: value.y, z: value.z, yaw: value.yaw, pitch: value.pitch };
}

function savedStructures(value: unknown, allowLegacyIds: boolean): SavedStructure[] | null {
  if (!Array.isArray(value) || value.length > 128) return null;
  const allowed: BuildType[] = ['foundation', 'wall', 'campfire'];
  const result: SavedStructure[] = [];
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    const id = isRecord(item) && typeof item.id === 'string'
      ? item.id
      : allowLegacyIds ? `legacy-structure-${index + 1}` : '';
    if (!isRecord(item)
      || !/^[a-zA-Z0-9_-]{1,40}$/.test(id)
      || ids.has(id)
      || !allowed.includes(item.type as BuildType)
      || !isNumber(item.x, -75, 75)
      || !isNumber(item.y, -20, 50)
      || !isNumber(item.z, -75, 75)
      || !isNumber(item.rotation, -Math.PI * 8, Math.PI * 8)) return null;
    ids.add(id);
    result.push({ id, type: item.type as BuildType, x: item.x, y: item.y, z: item.z, rotation: item.rotation });
  }
  return result;
}

function savedCreatures(value: unknown): SavedCreature[] | null {
  if (!Array.isArray(value) || value.length > 32) return null;
  const species = ['parasaur', 'raptor', 'rex'];
  const result: SavedCreature[] = [];
  for (const item of value) {
    if (!isRecord(item)
      || typeof item.id !== 'string'
      || item.id.length < 1
      || item.id.length > 32
      || !species.includes(String(item.species))
      || !isNumber(item.health, 0, 1_000)
      || typeof item.tamed !== 'boolean'
      || typeof item.dead !== 'boolean'
      || !isInteger(item.trust, 0, 3)
      || !['follow', 'stay'].includes(String(item.command))
      || !isNumber(item.x, -75, 75)
      || !isNumber(item.y, -20, 50)
      || !isNumber(item.z, -75, 75)) return null;
    result.push({
      id: item.id,
      species: item.species as SavedCreature['species'],
      health: item.health,
      tamed: item.tamed,
      dead: item.dead,
      trust: item.trust,
      command: item.command as SavedCreature['command'],
      x: item.x,
      y: item.y,
      z: item.z,
    });
  }
  return result;
}

export function serializeSave(snapshot: SaveSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseSave(raw: string | null): SaveSnapshot | null {
  if (!raw || raw.length > 100_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)
    || ![1, SAVE_VERSION].includes(value.version as number)
    || !isNumber(value.savedAt, 0, Number.MAX_SAFE_INTEGER)) return null;
  const isLegacy = value.version === 1;
  const state = gameState(value.state);
  const player = savedPlayer(value.player);
  const structures = savedStructures(value.structures, isLegacy);
  const creatures = savedCreatures(value.creatures);
  if (!state || !player || !structures || !creatures || state.structuresPlaced !== structures.length) return null;
  return { version: SAVE_VERSION, savedAt: value.savedAt, state, player, structures, creatures };
}
