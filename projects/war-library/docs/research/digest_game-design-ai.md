# WW1 board game: design and AI research from 06-game-ai

All paths below are relative to `/Users/rels/Documents/project-Library/projects/06-game-ai/`.

**What the library does and doesn't have:** it has good design process material and a working TS grid-tactics template. It has no minimax, MCTS, influence-map or GOAP code anywhere. A grep across all 25 folders found only CCGS rules text and an Unreal StateTree skill. `GameDev-Resources/README.md` gives only pointers: the SimpleAI behaviour-tree library (line 245) and the books *AI for Games* and *Programming Game AI by Example* (lines 312, 328). So the AI design in (c) comes from standard technique, shaped to the constraints these docs set.

---

## (a) Design process and checklists worth following

**1. Pillars, with a test for each** (`Claude-Code-Game-Studios/.claude/docs/templates/game-pillars.md`; `.claude/skills/brainstorm/SKILL.md`, Phase 4). A pillar must be falsifiable and must rule things out. Give each one a "design test" and write anti-pillars. Proposed set:
- **Every turn is a readable dilemma.** Enemy intent and damage are visible before you commit. There are no hidden rolls.
- **The terrain decides.** Trench, wire, mud and the machine gun's arc decide fights more than unit stats do.
- **A battle takes ten minutes.** About 8 turns and at most about 12 units per side.
- **The table is the world.** The board is a physical map table in the library, so the UI should be brass tokens, order cards and a pencilled turn track.
- **Anti-pillars:** no economy or base building, no real-time micro, no bag of sandbox verbs. The last one is the reviewer's main complaint about the current build, which feels like 17 verbs bolted on.

**2. MDA, worked backwards from the feeling** (`.claude/agents/game-designer.md`, "MDA Framework"). Target aesthetics, in order: Challenge, then Fantasy (commanding in 1917), then Narrative (a one-screen after-action report on the cost). SDT gives the matching needs: autonomy through several viable plans, and competence because "the player must know WHY".

**3. Core loop contract** (`threejs-game-skills/skills/threejs-gameplay-systems/SKILL.md`, "Design first"):
> The player gives orders to seize objective tiles by turn 8, while telegraphed barrages and machine-gun fields create risk. Success scores Victory Points and moves the front line. Failure costs units and morale, and a retry takes under 5 seconds.

Each clause must be proven through real input. The loop has three levels (`.claude/skills/brainstorm/SKILL.md`, Phase 3):
- a 30-second turn of select, preview and commit;
- a 10-minute battle;
- a session campaign of 3–5 linked scenarios, where the front line carries over.

The OpenGame tactics loop matches this: "Select -> Move -> Act -> End Turn -> Enemy Turn" (`OpenGame/agent-test/docs/modules/grid_logic/design_rules.md`, section 1).

**4. The first 60 seconds** (`.claude/docs/templates/difficulty-curve.md`, "Onboarding Ramp" and "The First Failure"):
- **0–10 s:** the board is visible, with one line of objective ("Hold the Yser bridges until dusk, turn 8"). One unit is already selected with its move range lit. One red barrage marker already sits on a friendly square.
- **10–30 s:** the player moves the unit out of the red. A forecast tooltip (damage and odds) appears before the attack is committed. A move can be undone until the unit acts, using the pattern from `OpenGame/.../design_rules.md` section 2.5.
- **30–60 s:** the player ends the turn and watches the shells land on the empty square they just left. That is the first "I read it and beat it" moment.
- **The first failure is shown before it happens:** hovering over open ground inside a machine gun's arc draws a red lane.

Introduce mechanics one per scenario: wire in scenario 1, then artillery, then tanks, then gas. `threejs-gameplay-systems/references/genre-design.md` puts it as "introduce one new concept at a time".

**5. Fun-factor tests.** Iterate if any of these is true (`genre-design.md`, "Fun-factor tests"): no real decision in the first 30 seconds; the main mechanic can be ignored; the objective is unclear; the space is decorative. The last one is the current build's "uniform murk".

**6. Difficulty.** Use philosophy #2, "Accessible entry, optional depth" (`difficulty-curve.md`). Difficulty levels change the AI's settings, not unit stats. Each campaign rises in a sawtooth (`game-designer.md`).

**7. Prove it before building content.** Write a falsifiable prototype hypothesis (`.claude/skills/prototype/SKILL.md`, around line 76). The skill recommends an HTML prototype for turn-based strategy (line 126).

**8. Balance with bots.** Run the bot at two skill levels. If the weak one does as well as the strong one, the difficulty setting does nothing (`threejs-qa-release/references/playtest-bot.md`, "Difficulty And Fairness Signals"). Also check for dominant strategies (`.claude/skills/balance-check/SKILL.md`), and use the first-5-minutes questions for human playtests (`.claude/skills/playtest-report/SKILL.md`).

---

## (b) Reference games and what to take from each

| Game | What to take |
|---|---|
| **Into the Breach** | Enemy intent is **telegraphed** and targets cells, not units: attacks are declared, then resolve next phase on whatever stands there. Damage is deterministic. Boards are small (8×8). Objectives go beyond "kill all", e.g. defend a building. This is the core of pillar 1. |
| **Advance Wars**, with **Athena Crisis** as its open-source TypeScript counterpart (listed in `open-source-games/README.md` line 416; source not stored locally) | A **unit triangle**: infantry beats machine gun in trench assault, machine gun beats infantry in the open, artillery beats machine gun, tank beats wire and machine gun, field gun beats tank. Also: capture by standing on a tile, terrain defence stars, and a **damage forecast** shown on hover. Commander powers become WW1 generals with one-shot "doctrines". Athena Crisis is the closest code to read for TS rules and AI structure. |
| **Commands & Colors: The Great War / Memoir '44** | **Section order cards** for left, centre and right. You can't move everything, which makes each turn a dilemma and caps AI branching. First to N **medals** wins. Trenches are printed terrain. |
| **Battle for Wesnoth** (line 434) | **Zone of control**: entering a tile next to an enemy stops movement. Stormtroopers ignore it, which makes them a clean asymmetric unit. Wesnoth's time-of-day modifiers become **dawn and weather** phases. |
| **Panzer General / OpenPanzer** (JS, line 430) | **Entrenchment** that rises each turn a unit stays put. Suppression is kept separate from losses. The core WW1 feel is that holding ground gets stronger over time. |
| **XCOM / OpenXcom** (line 432) | **Overwatch** plus half and full **cover**. A machine gun is a permanent overwatch cone, and flanking bypasses cover. |
| **Kriegsspiel** (1824) | The umpire-at-the-map-table frame fits the library setting. Offer optional hard modes with fog of war and order delay (messengers). Keep these out of the default game. |

---

## (c) Recommended AI opponent for small, deterministic, turn-based TS

The constraints come from `Claude-Code-Game-Studios/.claude/rules/ai-code.md`:
- telegraph intentions;
- every setting tunable from data;
- debug visualisation;
- "prefer utility-based or behavior tree approaches";
- "fun to play against, not perfectly optimal" (also in `.claude/agents/ai-programmer.md`).

**Why not full minimax or MCTS:** each side moves many units per turn, so the number of possible turns explodes. MCTS is noisy and hard to read at browser budgets. Use this instead: **utility scoring plus per-turn influence maps plus a small beam search over unit order plus a one-step check of the player's reply.** Pick one move at random from the top few, and use that randomness as the difficulty setting.

**Architecture:**
1. **Pure rules core.** `State` is plain data. `legal(s,u)`, `apply(s,a)` and `evaluate(s,side)` have no side effects. All randomness goes through a seeded RNG (the `threejs-gameplay-systems` SKILL.md build step 6 requires this). This lets the same code run the game, the AI, undo and headless self-play in Node.
2. **Presentation split.** Game logic resolves instantly. The view replays an animation queue of events, following `OpenGame/agent-test/templates/modules/grid_logic/src/systems/AnimationQueue.ts`. Turn phases follow `TurnManager.ts`: WAITING, PROCESSING, ANIMATING, CHECKING.
3. **Two-phase telegraphing, as in Into the Breach.**
   - AI phase A: move, and declare cell-targeted intents (barrage, gas, assault arrow).
   - Player turn: react to what is shown.
   - AI phase B: the declared intents resolve.
   - Intents should favour cells that are expensive to leave: pinned units, objectives, chokepoints.
4. **Maps built once per turn:** `threat[side][cell]` (machine-gun arcs plus artillery reach), `objDist[cell]` (distance to each Victory Point tile) and `cover[cell]`.

**Move generation:**
```ts
function candidates(s: State, u: Unit, m: Maps, k: number): Action[] {
  const reach = dijkstra(s, u, (c) => moveCost(s, u, c)); // mud, wire, trench line, ZOC stop
  const out: Action[] = [];
  for (const c of reach) {
    out.push({ unit: u.id, to: c, kind: 'hold' });                 // hold / dig in
    for (const t of targetsFrom(s, u, c)) out.push({ unit: u.id, to: c, kind: 'attack', target: t });
    if (u.type === 'artillery') for (const z of registerCells(s, u)) out.push({ unit: u.id, to: c, kind: 'barrage', target: z });
  }
  return topK(out, k, (a) => quickUtil(s, a, m)); // cheap prefilter on maps
}

function aiTurn(s: State, p: Profile): Action[] {
  const m = buildMaps(s);
  let beam = [{ s, plan: [] as Action[], score: 0 }];
  for (const u of orderUnits(s, p.side)) {       // artillery → MG → tanks → infantry
    const next = [];
    for (const n of beam)
      for (const a of candidates(n.s, u, m, p.perUnitK)) {
        const s2 = apply(n.s, a);
        next.push({ s: s2, plan: [...n.plan, a],
                    score: evaluate(s2, p) - p.replyWeight * bestReplyLoss(s2, p.side) });
      }
    beam = topK(next, p.beamWidth, (x) => x.score);
  }
  return softmaxPick(beam, p.temperature, s.rng).plan;
}
```

**Evaluation function.** Weights live in JSON so they can be tuned without code changes:
```ts
function evaluate(s: State, p: Profile): number {
  const me = p.side, op = other(me), w = p.w;
  if (winner(s) === me) return 1e6;
  if (winner(s) === op) return -1e6;
  let v = w.vp * (vp(s, me) - vp(s, op))
        + w.material * (strength(s, me) - strength(s, op))    // Σ hp × unitValue
        + w.morale * (s.morale[me] - s.morale[op])
        + w.suppress * suppressedCount(s, op)
        + w.wireCut * wireCutOnLanes(s, me);
  for (const u of units(s, me)) {
    v += w.advance * (1 - s.maps.objDist[u.cell] / s.maps.maxDist);
    v -= w.exposure * s.maps.threat[op][u.cell] * (1 - cover(s, u.cell));
  }
  return v;
}
// bestReplyLoss: for each enemy unit, the max damage it could deal from its current reach.
// It only recomputes cells that changed, so it's a one-ply "danger" check, not full minimax.
```

**Difficulty presets** (unit stats stay the same at every level):

| | beamWidth | perUnitK | temperature | replyWeight | Other |
|---|---|---|---|---|---|
| Recruit | 1 | 3 | high | 0 | Never uses combos |
| Veteran | 4 | 6 | low | 0.5 | |
| General | 8 | 10 | 0 | 1 | Plans a creeping barrage together with its infantry |

Personality presets are just different weight sets: "Haig" has high `advance` and low `exposure`, "Pétain" has high `cover` and `vp`.

**Performance estimate:** a board of about 12×10 cells with about 12 units, about 25 reachable cells times about 3 actions per unit, and constant-time scoring against the maps. That comes to roughly 1,000 evaluations per turn on Recruit and about 50k on General, which is tens of milliseconds. It runs on the main thread, so no Web Worker. Add one only if General is measured above 100 ms.

**Readable and debuggable:**
- Show each intent as an arrow or red cell.
- Add a debug overlay for the threat, objective-distance and cover maps (`ai-code.md`: "visualization hooks").
- Log the top 3 candidate moves and their scores.

**Balance harness:**
- Run 200 seeded games of AI against AI per scenario in Node.
- Targets: General beats Recruit at least 75% of the time, and the first-move side wins 45–55%.
- If Recruit's results look like General's, the difficulty setting does nothing (`playtest-bot.md`).

---

## (d) WW1 mechanics that make the setting matter

- **Trenches and entrenchment.** A trench tile gives −50% damage taken. Entrenchment levels 0–3 grow each turn a unit holds (Panzer General). Connected communication trenches allow fast movement that is hidden from overwatch.
- **Enfilade.** Fire along a trench line hits every unit in that line, so flanking a trench is how you break it.
- **Barbed wire.** For infantry, wire ends their movement and they stay stuck until next turn. Barrages remove wire deterministically: 2 barrages clear one tile. A tank that drives over wire crushes it. So cutting wire is its own preparation phase.
- **Machine-gun fields of fire.** Each gun has a fixed 90° arc drawn on the board. Any enemy that enters an open cell inside the arc takes reaction fire and becomes pinned. Guns can't turn after firing this turn. The way to beat one is to flank it, use smoke or send a tank.
- **Artillery.** Its fire is registered, telegraphed and resolves next turn. The shell budget is limited per battle (a resource), and counter-battery fire is possible.
- **Creeping barrage, the signature move.** The player draws a barrage line that advances one row per turn:
  - infantry exactly one row behind it attack suppressed defenders (+2);
  - infantry in the same row take friendly fire;
  - if the infantry fall two or more rows behind, the defenders recover when the barrage lifts.

  Easy to learn, tense to time, and specific to WW1.
- **Mud and craters.** Every barrage leaves craters, and rain turns craters to mud with movement cost ×3. The more you shell, the harder you are to advance, which is the Passchendaele irony. Weather is announced one turn ahead.
- **Gas.** A cloud drifts with a visible wind vane, and wind changes are telegraphed one turn ahead. It lingers on low tiles. Units wearing masks move at half speed. A shift in the wind can blow it back on you.
- **Tanks (Mark IV).** They are immune to machine guns and crush wire, but move only 1–2 tiles, can get stuck in trenches or craters, and are weak to field guns. The breakdown chance is shown as a percentage, which is the only visible random roll.
- **Going over the top, and morale.** Units that attack from the same trench on the same turn get a **wave** bonus. Each side has a morale pool that drains with losses and lost objectives; at zero the side routs and loses. Crossing no-man's land means open ground and full exposure.
- **Asymmetry.** Late-war stormtroopers ignore zone of control and bypass strongpoints. Front-line units lose 1 strength per turn to attrition unless they are relieved from reserve.
- **After-action report.** Victory Points held set against casualties, as one ledger page ("Was it worth it?"). This covers the Narrative aesthetic at almost no cost.
- **A scenario hook for the existing sector:** Operation Strandfest (Nieuwpoort, 10 July 1917), an attack that cut off the Yser bridgehead. The bridges become VP and supply tiles, and the river works as a natural choke.

**Build order for the prototype (smallest version):** trench, wire, machine-gun arc, telegraphed artillery, morale, plus infantry, machine gun and artillery units. Add tanks, gas, mud and the creeping barrage one at a time in scenarios 2–4.