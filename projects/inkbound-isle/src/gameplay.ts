export const RESOURCES = ['wood', 'stone', 'fiber', 'berries'] as const;
export type Resource = (typeof RESOURCES)[number];
export type Tool = 'hands' | 'axe' | 'spear' | 'torch';
export type CraftableTool = Exclude<Tool, 'hands'>;
export type BuildType = 'foundation' | 'wall' | 'campfire';
export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';
export type MissionStage = 'landfall' | 'forge' | 'shelter' | 'bond' | 'hunt' | 'complete';
export type DinosaurKind = 'parasaur' | 'raptor' | 'rex';
export type Cost = Readonly<Partial<Record<Resource, number>>>;

export interface MissionProgress {
  stage: MissionStage;
  gathered: Record<Resource, number>;
  spearCrafted: boolean;
  built: Record<BuildType, number>;
  structuresBuilt: number;
  tamed: boolean;
  rexDefeated: boolean;
  dinosaursDefeated: number;
  survivalSeconds: number;
}

export type MissionEvent =
  | { type: 'gather'; resource: Resource; amount: number }
  | { type: 'craft'; tool: CraftableTool }
  | { type: 'build'; build: BuildType }
  | { type: 'tame' }
  | { type: 'defeat'; species: DinosaurKind };

export interface GameState {
  inventory: Record<Resource, number>;
  crafted: Record<CraftableTool, boolean>;
  selectedTool: Tool;
  structuresPlaced: number;
  tamedCount: number;
  health: number;
  stamina: number;
  hunger: number;
  timeOfDay: number;
  mission: MissionProgress;
}

export interface ActionResult {
  ok: boolean;
  state: GameState;
  message: string;
}

export interface FeedResult extends ActionResult {
  trust: number;
  tamed: boolean;
}

export interface CreatureContinuity {
  health: number;
  tamed: boolean;
  dead: boolean;
  trust: number;
}

export function mergeCreatureContinuity(
  current: CreatureContinuity,
  incoming: CreatureContinuity,
): CreatureContinuity {
  const health = Math.min(current.health, incoming.health);
  const dead = current.dead || incoming.dead || health <= 0;
  return {
    health,
    dead,
    tamed: !dead && (current.tamed || incoming.tamed),
    trust: Math.max(current.trust, incoming.trust),
  };
}

export const RECIPES: Record<CraftableTool, Cost> = {
  axe: { wood: 3, stone: 2, fiber: 1 },
  spear: { wood: 3, stone: 2, fiber: 3 },
  torch: { wood: 1, fiber: 2 },
};

export const BUILD_COSTS: Record<BuildType, Cost> = {
  foundation: { wood: 4, fiber: 2 },
  wall: { wood: 3, fiber: 1 },
  campfire: { wood: 2, stone: 3 },
};

export function createMissionProgress(): MissionProgress {
  return {
    stage: 'landfall',
    gathered: { wood: 0, stone: 0, fiber: 0, berries: 0 },
    spearCrafted: false,
    built: { foundation: 0, wall: 0, campfire: 0 },
    structuresBuilt: 0,
    tamed: false,
    rexDefeated: false,
    dinosaursDefeated: 0,
    survivalSeconds: 0,
  };
}

function missionStage(progress: MissionProgress): MissionStage {
  if (progress.gathered.wood < 3 || progress.gathered.stone < 2 || progress.gathered.fiber < 3) return 'landfall';
  if (!progress.spearCrafted) return 'forge';
  if (progress.built.campfire < 1 || progress.built.foundation + progress.built.wall < 1) return 'shelter';
  if (!progress.tamed) return 'bond';
  if (!progress.rexDefeated) return 'hunt';
  return 'complete';
}

export function recordMissionEvent(progress: MissionProgress, event: MissionEvent): MissionProgress {
  let next: MissionProgress;
  if (event.type === 'gather') {
    if (!Number.isFinite(event.amount) || event.amount <= 0) return progress;
    next = {
      ...progress,
      gathered: {
        ...progress.gathered,
        [event.resource]: progress.gathered[event.resource] + event.amount,
      },
    };
  } else if (event.type === 'craft') {
    next = event.tool === 'spear' ? { ...progress, spearCrafted: true } : progress;
  } else if (event.type === 'build') {
    next = {
      ...progress,
      built: { ...progress.built, [event.build]: progress.built[event.build] + 1 },
      structuresBuilt: progress.structuresBuilt + 1,
    };
  } else if (event.type === 'tame') {
    next = { ...progress, tamed: true };
  } else {
    if (event.species === 'rex' && progress.rexDefeated) return progress;
    next = {
      ...progress,
      rexDefeated: progress.rexDefeated || event.species === 'rex',
      dinosaursDefeated: progress.dinosaursDefeated + 1,
    };
  }
  const stage = missionStage(next);
  return stage === next.stage ? next : { ...next, stage };
}

export function createInitialGameState(): GameState {
  return {
    inventory: { wood: 0, stone: 0, fiber: 0, berries: 0 },
    crafted: { axe: false, spear: false, torch: false },
    selectedTool: 'hands',
    structuresPlaced: 0,
    tamedCount: 0,
    health: 100,
    stamina: 100,
    hunger: 100,
    timeOfDay: 0.3,
    mission: createMissionProgress(),
  };
}

export function gather(state: GameState, resource: Resource, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  return {
    ...state,
    inventory: { ...state.inventory, [resource]: state.inventory[resource] + amount },
    mission: recordMissionEvent(state.mission, { type: 'gather', resource, amount }),
  };
}

export function canAfford(state: GameState, cost: Cost): boolean {
  return RESOURCES.every((resource) => state.inventory[resource] >= (cost[resource] ?? 0));
}

function pay(state: GameState, cost: Cost): GameState {
  return {
    ...state,
    inventory: Object.fromEntries(
      RESOURCES.map((resource) => [resource, state.inventory[resource] - (cost[resource] ?? 0)]),
    ) as Record<Resource, number>,
  };
}

export function craft(state: GameState, tool: CraftableTool): ActionResult {
  if (state.crafted[tool]) return { ok: false, state, message: `${tool} already crafted` };
  if (!canAfford(state, RECIPES[tool])) return { ok: false, state, message: `Need more materials for ${tool}` };
  const paid = pay(state, RECIPES[tool]);
  return {
    ok: true,
    state: {
      ...paid,
      crafted: { ...paid.crafted, [tool]: true },
      selectedTool: tool,
      mission: recordMissionEvent(paid.mission, { type: 'craft', tool }),
    },
    message: `${tool} crafted`,
  };
}

export function payBuildCost(state: GameState, type: BuildType): ActionResult {
  if (!canAfford(state, BUILD_COSTS[type])) {
    return { ok: false, state, message: `Need more materials for ${type}` };
  }
  const paid = pay(state, BUILD_COSTS[type]);
  return {
    ok: true,
    state: {
      ...paid,
      structuresPlaced: paid.structuresPlaced + 1,
      mission: recordMissionEvent(paid.mission, { type: 'build', build: type }),
    },
    message: `${type} placed`,
  };
}

export function refundBuildCost(state: GameState, type: BuildType): ActionResult {
  if (state.structuresPlaced <= 0) {
    return { ok: false, state, message: 'No placed structure to dismantle' };
  }
  const refund = Object.fromEntries(
    RESOURCES.map((resource) => [resource, Math.floor((BUILD_COSTS[type][resource] ?? 0) * 0.5)]),
  ) as Record<Resource, number>;
  return {
    ok: true,
    state: {
      ...state,
      inventory: Object.fromEntries(
        RESOURCES.map((resource) => [resource, state.inventory[resource] + refund[resource]]),
      ) as Record<Resource, number>,
      structuresPlaced: state.structuresPlaced - 1,
    },
    message: `${type} dismantled · half materials recovered`,
  };
}

export function feedHerbivore(state: GameState, trust: number, requiredTrust = 3): FeedResult {
  if (!Number.isFinite(trust) || trust < 0 || !Number.isFinite(requiredTrust) || requiredTrust < 1) {
    return { ok: false, state, trust, tamed: false, message: 'Invalid trust state' };
  }
  const currentTrust = Math.floor(trust);
  const goal = Math.floor(requiredTrust);
  if (currentTrust >= goal) {
    return { ok: false, state, trust: currentTrust, tamed: true, message: 'Parasaur already trusts you' };
  }
  if (state.inventory.berries < 1) {
    return { ok: false, state, trust: currentTrust, tamed: false, message: 'Need 1 berry to earn trust' };
  }
  const nextTrust = currentTrust + 1;
  const tamed = nextTrust >= goal;
  return {
    ok: true,
    state: {
      ...state,
      inventory: { ...state.inventory, berries: state.inventory.berries - 1 },
      tamedCount: state.tamedCount + Number(tamed),
      mission: tamed ? recordMissionEvent(state.mission, { type: 'tame' }) : state.mission,
    },
    trust: nextTrust,
    tamed,
    message: tamed ? 'Parasaur bonded' : `Parasaur trust ${nextTrust}/${goal}`,
  };
}

const clamp100 = (value: number) => Math.max(0, Math.min(100, value));

export function eatBerry(state: GameState): ActionResult {
  if (state.inventory.berries < 1) return { ok: false, state, message: 'No berries to eat' };
  if (state.hunger >= 100) return { ok: false, state, message: 'Already well fed' };
  return {
    ok: true,
    state: {
      ...state,
      inventory: { ...state.inventory, berries: state.inventory.berries - 1 },
      hunger: clamp100(state.hunger + 24),
      health: clamp100(state.health + 3),
    },
    message: 'Berry eaten · hunger restored',
  };
}

export function restAtCamp(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0 || state.hunger <= 10 || state.health >= 100) return state;
  return { ...state, health: clamp100(state.health + seconds * 2.5) };
}

export function takeDamage(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  return { ...state, health: clamp100(state.health - amount) };
}

export function tickSurvival(state: GameState, seconds: number, sprinting: boolean): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const hunger = clamp100(state.hunger - seconds * 0.12);
  const stamina = clamp100(state.stamina + seconds * (sprinting ? -24 : 18));
  const health = clamp100(state.health - (hunger === 0 ? seconds * 2 : 0));
  return {
    ...state,
    hunger,
    stamina,
    health,
    mission: { ...state.mission, survivalSeconds: state.mission.survivalSeconds + seconds },
  };
}

export function advanceDay(state: GameState, seconds: number, cycleSeconds = 240): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0 || cycleSeconds <= 0) return state;
  return { ...state, timeOfDay: (state.timeOfDay + seconds / cycleSeconds) % 1 };
}

export function dayPhase(timeOfDay: number): DayPhase {
  const time = ((timeOfDay % 1) + 1) % 1;
  if (time < 0.18 || time >= 0.86) return 'night';
  if (time < 0.3) return 'dawn';
  if (time < 0.72) return 'day';
  return 'dusk';
}

export function attackDamage(tool: Tool): number {
  if (tool === 'spear') return 34;
  if (tool === 'axe') return 16;
  if (tool === 'torch') return 7;
  return 4;
}
