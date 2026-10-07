import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BUILD_COSTS,
  RECIPES,
  advanceDay,
  attackDamage,
  craft,
  createMissionProgress,
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
  tickSurvival,
  takeDamage,
} from './gameplay.ts';

describe('survival inventory', () => {
  it('gathers resources without mutating the previous state', () => {
    const initial = createInitialGameState();
    const gathered = gather(initial, 'wood', 4);

    assert.equal(initial.inventory.wood, 0);
    assert.equal(gathered.inventory.wood, 4);
    assert.equal(gather(gathered, 'wood', -1), gathered);
  });

  it('crafts the spear only after every ingredient is available', () => {
    const initial = createInitialGameState();
    assert.equal(craft(initial, 'spear').ok, false);

    const stocked = {
      ...initial,
      inventory: { ...initial.inventory, wood: 3, stone: 2, fiber: 3 },
    };
    const result = craft(stocked, 'spear');

    assert.equal(result.ok, true);
    assert.equal(result.state.crafted.spear, true);
    assert.equal(result.state.inventory.wood, 3 - (RECIPES.spear.wood ?? 0));
    assert.equal(result.state.inventory.stone, 2 - (RECIPES.spear.stone ?? 0));
    assert.equal(result.state.inventory.fiber, 3 - (RECIPES.spear.fiber ?? 0));
  });

  it('crafts a portable torch from the existing resource economy', () => {
    const initial = createInitialGameState();
    const stocked = {
      ...initial,
      inventory: { ...initial.inventory, wood: 1, fiber: 2 },
    };
    const result = craft(stocked, 'torch');
    assert.equal(result.ok, true);
    assert.equal(result.state.crafted.torch, true);
    assert.equal(result.state.selectedTool, 'torch');
  });

  it('pays a building cost once and refuses an unaffordable placement', () => {
    const initial = createInitialGameState();
    const stocked = {
      ...initial,
      inventory: { ...initial.inventory, wood: 8, stone: 8, fiber: 8 },
    };
    const foundation = payBuildCost(stocked, 'foundation');

    assert.equal(foundation.ok, true);
    assert.equal(foundation.state.structuresPlaced, 1);
    assert.equal(
      foundation.state.inventory.wood,
      stocked.inventory.wood - (BUILD_COSTS.foundation.wood ?? 0),
    );
    assert.equal(payBuildCost(createInitialGameState(), 'campfire').ok, false);
  });

  it('dismantles one structure with a bounded half-cost refund', () => {
    const built = { ...createInitialGameState(), structuresPlaced: 1 };
    const result = refundBuildCost(built, 'foundation');
    assert.equal(result.ok, true);
    assert.equal(result.state.structuresPlaced, 0);
    assert.equal(result.state.inventory.wood, 2);
    assert.equal(result.state.inventory.fiber, 1);
    assert.equal(refundBuildCost(createInitialGameState(), 'wall').ok, false);
  });

  it('earns a herbivore trust over three separate feeds', () => {
    let state = {
      ...createInitialGameState(),
      inventory: { ...createInitialGameState().inventory, berries: 3 },
    };
    let trust = 0;

    for (const expected of [1, 2, 3]) {
      const fed = feedHerbivore(state, trust);
      assert.equal(fed.ok, true);
      assert.equal(fed.trust, expected);
      assert.equal(fed.tamed, expected === 3);
      state = fed.state;
      trust = fed.trust;
    }

    assert.equal(state.inventory.berries, 0);
    assert.equal(state.tamedCount, 1);
    assert.equal(feedHerbivore(state, trust).ok, false);
  });
});

describe('expedition mission', () => {
  it('holds the golden path in order and records the final expedition', () => {
    let mission = createMissionProgress();

    mission = recordMissionEvent(mission, { type: 'defeat', species: 'rex' });
    mission = recordMissionEvent(mission, { type: 'gather', resource: 'wood', amount: 3 });
    mission = recordMissionEvent(mission, { type: 'gather', resource: 'stone', amount: 2 });
    assert.equal(mission.stage, 'landfall');

    mission = recordMissionEvent(mission, { type: 'gather', resource: 'fiber', amount: 3 });
    assert.equal(mission.stage, 'forge');

    mission = recordMissionEvent(mission, { type: 'craft', tool: 'spear' });
    assert.equal(mission.stage, 'shelter');

    mission = recordMissionEvent(mission, { type: 'build', build: 'campfire' });
    assert.equal(mission.stage, 'shelter');
    mission = recordMissionEvent(mission, { type: 'build', build: 'foundation' });
    assert.equal(mission.stage, 'bond');

    mission = recordMissionEvent(mission, { type: 'tame' });
    assert.equal(mission.stage, 'complete');
    assert.equal(mission.dinosaursDefeated, 1);
    assert.equal(mission.structuresBuilt, 2);
  });

  it('ignores invalid mission amounts and cannot skip missing prerequisites', () => {
    const mission = createMissionProgress();
    assert.equal(recordMissionEvent(mission, { type: 'gather', resource: 'wood', amount: -3 }), mission);
    assert.equal(recordMissionEvent(mission, { type: 'tame' }).stage, 'landfall');
  });

  it('records a replayed Rex defeat exactly once', () => {
    const first = recordMissionEvent(createMissionProgress(), { type: 'defeat', species: 'rex' });
    const replay = recordMissionEvent(first, { type: 'defeat', species: 'rex' });

    assert.equal(first.rexDefeated, true);
    assert.equal(first.dinosaursDefeated, 1);
    assert.equal(replay, first);
  });

  it('merges live session creature progress with an older save in either order', () => {
    const olderSave = { health: 100, dead: false, tamed: false, trust: 0 };
    const liveSession = { health: 0, dead: true, tamed: true, trust: 3 };
    const expected = { health: 0, dead: true, tamed: false, trust: 3 };

    assert.deepEqual(mergeCreatureContinuity(olderSave, liveSession), expected);
    assert.deepEqual(mergeCreatureContinuity(liveSession, olderSave), expected);
  });
});

describe('survival pressure and time', () => {
  it('clamps health, stamina, and hunger to safe ranges', () => {
    const initial = createInitialGameState();
    const exhausted = tickSurvival(initial, 60, true);
    assert.equal(exhausted.stamina, 0);
    assert.ok(exhausted.hunger >= 0 && exhausted.hunger < 100);
    assert.equal(takeDamage(initial, 250).health, 0);
    assert.equal(takeDamage(initial, -5), initial);
  });

  it('wraps the clock and reports stable flat-light phases', () => {
    const initial = { ...createInitialGameState(), timeOfDay: 0.99 };
    const later = advanceDay(initial, 6, 120);
    assert.ok(later.timeOfDay > 0 && later.timeOfDay < 0.1);
    assert.equal(dayPhase(0.02), 'night');
    assert.equal(dayPhase(0.24), 'dawn');
    assert.equal(dayPhase(0.5), 'day');
    assert.equal(dayPhase(0.78), 'dusk');
  });

  it('gives crafted weapons distinct combat value', () => {
    assert.equal(attackDamage('hands'), 4);
    assert.ok(attackDamage('spear') > attackDamage('axe'));
    assert.ok(attackDamage('torch') > attackDamage('hands'));
  });

  it('lets food and a nearby camp recover bounded survival meters', () => {
    const hungry = {
      ...createInitialGameState(),
      inventory: { ...createInitialGameState().inventory, berries: 1 },
      health: 91,
      hunger: 62,
    };
    const eaten = eatBerry(hungry);
    assert.equal(eaten.ok, true);
    assert.equal(eaten.state.inventory.berries, 0);
    assert.equal(eaten.state.hunger, 86);
    assert.equal(eaten.state.health, 94);
    assert.equal(eatBerry({ ...hungry, hunger: 100 }).ok, false);

    assert.equal(restAtCamp({ ...hungry, health: 80 }, 4).health, 90);
    assert.equal(restAtCamp({ ...hungry, health: 80, hunger: 0 }, 4).health, 80);
  });
});
