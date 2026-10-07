# 1. INK & IRON: The Enchanted War-Table

**Player promise:** at midnight in a candle-lit library, you write orders on an enchanted 1917 map of the Yser. Tin soldiers march themselves, the map ripples under shellfire, and you win by reading the enemy's red ink before it lands.

Cited digests: [GS] game-skills, [3D] 3d-assets, [GD] game-design-ai, [RA] reuse-audit.

# 2. Pillars

1. **The magic is the feedback.** Every rule event has a physical, enchanted consequence, not digits or stat cards [GS b]. *Test:* with the HUD hidden, a newcomer can still tell who was hurt and whose turn it is.
2. **Every turn is a readable dilemma.** Enemy attacks are inked a round early. Combat is deterministic and forecast before you commit [GD b]. *Test:* the bot never loses a step to anything that wasn't shown.
3. **Ten minutes, and the terrain decides.** 8 rounds, at most 10 pieces, 3 orders [GD a1]. *Test:* assaulting an unsuppressed MG fails at least 80% of the time in self-play.

**Anti-pillars:** no economy, no real time, no bag of sandbox verbs [RA d14].

# 3. Design brief

- **Verbs:** the primary verb is Order. Secondary verbs are Assault, Barrage, Dig in, Cut wire, End turn (ring the bell), plus one Doctrine card per scenario.
- **The 5–30 s repeat:** hover, and the hex glows within 100 ms. Click a piece and it lifts. Hover a target and the path inks in, with a forecast tag. Click, and a parchment flies to the piece and burns gold as it marches. Three orders, then the bell.
- **Over 1–5 min:** the front shifts, craters build up, wire gets cut, the candle turn-track burns toward dusk, and morale drains.
- **Lose, learn, restart:** you lose at 0 morale, or with fewer seals at dusk. A quill writes a ledger of your three costliest moments. **Rewind** runs the ink backwards and marches everyone home in under 4 s.
- **Reward and risk:** a capture stamps a seal and gives VP and +1 morale. The risks are open ground inside fans, red-inked hexes and spending shells early.
- **What a better player does:** suppresses the MG before crossing, baits shells onto empty trenches, enfilades, and keeps an order in reserve.
- **How the next decision is shown:** gold wisps over pieces that can still act, red intent hatching and arrows, painted fans, and the order rack.
- **Non-goals:** live simulation, multiplayer, default fog of war, gore, Hogwarts IP.

# 4. Core loop contract

"The player **orders** miniatures **to seize the crossings by dusk** while **red-inked barrages and MG fans** create risk. **Success stamps seals and moves the front; failure costs figures and morale; Rewind restarts in under 5 s**" [GD a3].

A bot clicking the real canvas proves each clause [GS e6]:

- **Orders:** select, then click a hex. `units[id].hex` changes and `ordersLeft` goes down.
- **Dusk:** a capture changes `vp`, and round 8 ends in `victory` or `defeat`.
- **Red ink:** round 1 has intents, and a rules test confirms that only intent hexes are hit.
- **Fans:** entering a fan emits `pinned`.
- **Retry:** Rewind reaches `player-turn` in under 5 s with zero errors.

# 5. Rules

**Board:** 13×9 flat-top hexes, each 0.10 m across, inset into a 2.4×1.6 m oak table [3D b]. One hex is about 250 m. Hexes keep flanking honest.

**Roster** (Str/Move/Fire/Range; Str = figures on the base):
- **Rifle Company** 4/2/2/1: assault; +1 Wave if a friend hit the same target this turn.
- **MG Section** 2/1/3/3: 120° overwatch fan; it can pivot *or* fire, but never move and fire.
- **Stoßtrupp** (German) 3/3/2/1: ignores zone of control and wire; +1 in assault.
- **Field gun** 2/1/3/3: double damage against tanks.
- **Howitzer** 2/0/–/whole board: barrage, 6 shells per battle.
- **Mark IV** (S2) 3/2/2/2: immune to rifles and MGs, crushes wire, bogs down in craters.

**Combat:**
- Damage = Fire + bonuses − Cover, minimum 0, and each point costs a step.
- Bonuses: +2 against a Suppressed target, +1 Wave, +1 Stoßtrupp.
- Cover: open 0, crater or ruin 1, trench 2, and +1 if the defender didn't move.
- Enfilade, attacking along the trench line, cancels trench cover.
- A defender that survives an assault strikes back at Fire −1.

No dice: that keeps pillar 2, lets the AI search exactly, and makes Rewind a replay and tests exact [GD c]. The seeded RNG only feeds the AI softmax and cosmetics [GS a].

**Terrain** (move cost/cover):
- Open 1/0.
- Trench 1/2. Moving along a connected trench is hidden from overwatch.
- Crater 2/1. In rain it becomes mud (move cost 3) and tanks bog.
- Ruin 2/1.
- Wire stops infantry until cut by an order, two barrages or a tank.
- River: bridges only.

**WW1 mechanics** [GD d]:
- **Overwatch:** entering an open hex inside an unsuppressed fan costs 2 damage and Pins the unit: it stops and is Suppressed.
- **Barrage:** 2 damage that ignores trench cover, Suppresses, and leaves a crater.
- **Suppressed:** can't move, −1 Fire, no overwatch, and its intent is cancelled.
- **Creeping barrage (S2):** a 3-hex line that advances one row per round. Infantry just behind it get +2; infantry inside it take the hit.
- **Morale:** 12 per side. −1 per step lost, −2 per objective lost, +1 per capture. A side at 0 routs.
- **Weather and wind** are shown a round early. Gas drifts, pools in polder, and Suppresses.
- **Dig in:** trench units left without orders dig in.

**Turn** (1 round = 1 hour):
1. Last round's intents land, unless the attacker was suppressed or killed. Weather applies.
2. You give 3 orders. Attacks resolve at once; barrages are only plotted.
3. The bell: your barrages land.
4. The AI moves, and your fans react.
5. The AI paints its new intents.
6. Victory is checked and the candle burns down.

The AI never surprises; it fields more pieces instead.

**Victory:** hold more seals after round 8, break the enemy's morale, or hold every objective at the end of any round.

**Example (S1, round 2):**
1. Shells hit the empty C7. Red ink now marks A Coy at E7, and an arrow runs from a German company at G5 to C Coy at G7.
2. You order A Coy along the trench to D7, barrage G5 (tag: "−2 · Suppressed · assault cancelled"), and pivot the MG toward E5–F5. C Coy digs in.
3. Bell: G5 is hit and the arrow fades.
4. The AI goes round the fan through the E3 wire gap and inks D7.

# 6. AI opponent

**Architecture** [GD c]:
- A pure TypeScript rules core, shared with the game, Rewind and self-play, plus threat, objective and cover maps rebuilt each turn.
- Beam search over the 3 best units (artillery, then MG, tank and infantry): the top K candidates each, a one-ply `bestReplyLoss`, then a softmax pick.

**Evaluation terms:** VP, material, morale, suppressed enemies, wire cut on the attack lanes, advance, exposure (threat×(1−cover)), and **intent value**: expected damage on the declared hexes, weighted up when the target is pinned, dug in or sitting on an objective.

**Telegraphing:** every attack is painted first. German orders fly in sealed with black wax, and a quill scratches while the AI thinks (≤150 ms). `?debug` inks the threat maps.

**Difficulty** changes the search, never unit stats. Given as beam/K/softmax/reply weight: Recruit 1/3/hot/0, Veteran 4/6/cool/0.5, General 8/10/greedy/1.

**Harness:** 200 seeded games per scenario. General beats Recruit at least 75% of the time; mirror matches split 45–55% [GD a8].

# 7. First 60 seconds

- **0–6 s:** candles light down the nave, ink draws the map, and the soldiers rise out of the paint. The intro is skippable, and the "Click to wake the table" click unlocks audio [RA d5].
- **6–10 s:** the objective reads *"Hold two of three bridges until dusk."* A Coy is already lifted, its moves lit gold. Its hex is hatched red, with a margin note: *"Shells land here at dawn. Move them."*
- **10–30 s:** you move A Coy. Hovering open ground inside the German fan shows a red lane marked "−2 · pinned" [GD a4]. Z undoes.
- **30–60 s:** you ring the bell and the shells hit an empty hex: the first "I read it and beat it."

# 8. Scenarios

**Key:** `~` sea, `s` dune, `.` open, `,` polder, `=` trench, `#` wire, `o` crater, `w` river, `V` ruin. Objectives (VP): `B` bridge, `L` sluice, `C` church, `X` château.

North is up and the British start south. Odd columns sit half a hex lower.

**S1 "Strandfest: Hold the Bridges"** (10 July 1917 [GD d]; defend; Recruit).
- British: 3 Rifle, 1 MG, 1 Howitzer.
- Germans: 4 Rifle, 2 MG, 1 Howitzer, and a Stoßtrupp arriving in round 3.
- Win: hold 2 of the 3 bridges.
- Introduces wire, MG fans and barrages.
```
    ABCDEFGHIJKLM
 1  ~ssV..X....,,
 2  ~s=========.,
 3  ~s##.######.,
 4  ~s..o...o...,
 5  ~s.o...o..o.,
 6  ~s####.####.,
 7  ~s=========.,
 8  ~wwBwwwBwwwBw
 9  ~ssV.......,,
```

**S2 "The Great Dune"** (attack; Veteran).
- Adds the Mark IV and the creeping barrage.
- British get 8 shells and 4 orders a turn.
- Win: take 2 of the trench, the spire C1 and the château X1.
```
    ABCDEFGHIJKLM
 1  ~sss.C..X...,
 2  ~ss.V.V......
 3  ~s===========
 4  ~s###########
 5  ~ss.o..o..o..
 6  ~ss.o.o...o..
 7  ~s#.###.###.#
 8  ~s===========
 9  ~ssV.........
```

**S3 "The Sluice"** (defend; Veteran).
- Adds gas, rain and a brass wind vane.
- *Open the Sluice* (once per battle): every `,` hex floods, and any unit standing there loses a step.
```
    ABCDEFGHIJKLM
 1  ~s.....,,,,,,
 2  ~s====..,,,,,
 3  ~s####..,,.,,
 4  ~s.o..o.,,,,,
 5  ~s####..,,.,,
 6  ~s====....,,,
 7  ~s..V.......,
 8  ~wwBwwwLwwwww
 9  ~ss.......,,,
```

# 9. Art direction

**The room: "Duke Humfrey's by candlelight."** It evokes the reading room the films borrowed without copying a set.
- **Stacks:** double-height gothic cases [3D b] with a balustraded gallery and a spiral stair. 8k instanced books in the old binding colours, with gaps and leaners [RA a]. Chain rods, busts and rolling ladders.
- **Around it:** a padlocked restricted-section gate, leaded lancets throwing dusty moon shafts [3D b], a hammerbeam roof, a fireplace, a globe and an orrery.
- **Magic:** 120 floating candles, and books that slide out and back on their own.

**The board:** a parchment relief set into an oak table with a brass rim [3D b].
- **Painted map:** ochre no-man's-land, a warm British side, a cool German side, saturated water, cream roads, contours and inked hexes. Neighbouring zones differ by at least 12 L*, which cures the murk [RA d8]. Trenches are real recesses.

**Miniatures:** tin soldiers exaggerated 1.4×, in gloss enamel.
- **Sides:** Brodie or Stahlhelm helmet; khaki #8A7E58 on brass rims, or navy #2E3A52 on iron rims [RA b].
- **Selection:** a gold Fresnel rim [GS c].

**Enchantments, one per event:** marching bases rock. Shells splash ink, send a vertex-shader ripple through the board and paint a crater. The dead dissolve into ink. Captures stamp a wax seal, and an invisible nib hatches each intent. Heavy hits make the candles dip.

**Lighting** [GS c]:
- **Key:** a warm spot pool with a 2048 shadow map, so the table is always brightest.
- **Fill:** moonlight, shadowed at 1024 on desktop.
- **Practicals:** three unshadowed lights, for the candles, the fire and a banker's lamp that actually lights the desk [RA d13].
- **Post:** warm PMREM at 0.4, ACES, bloom 0.45, vignette and grain.

**Palette:** parchment #E8D9B5, ink #1D1A2B, oak #5A3A22, brass #B08D57, flame #FFC977, moon #8FA6C8, intent #A8352C, select #E0B04A.

**Camera:** a 6 s establishing shot. Default "Commander's chair" at 48° pitch and 35° FOV, with the board taking ≥65% of the frame. ±35° yaw, 3 zoom stops, trauma shake [GS d], and 62° pitch on mobile.

**UI:** parchment and brass, in the scene [GS d]. The objective and round sit top-left, seals and morale top-right, and the order rack and bell at the bottom. Forecast tags pin to the hex. The HUD takes ≤12% of the screen, never over the board.

# 10. Audio

- **Engine:** port `17-audio.js` [RA c]: crack, blast, clack and patter, about 40 voices with stealing, a distance delay of 250 m per hex, and ±6% seeded pitch [GS d].
- **Battle sounds:** low-passed "under glass".
- **Library sounds:** fire, a clock tick each round, quill scratch, parchment flutter, the seal thunk, an FM bell and marching clacks.
- **Music:** an original procedural celesta over a drone, ducked on impacts. M mutes.

# 11. Tech plan

**Stack:** the `create_threejs_game.py` scaffold: three 0.184, Vite 8, TypeScript 6, Playwright [GS a]. No physics, and no new runtime dependencies.

**Contract (frozen on day 0):** `rules/types.ts` for State, Action and GameEvent, and `board/BoardApi.ts` for `hexToWorld`, `paintIntent`, `ripple`, `crater` and `piece`.

**Owners:**
- **A:** `rules/*`, `ai/*`, scenario JSON, `node --test` and self-play, with no three.js.
- **B:** `room/*`, materials, procedural textures, LightingRig, RenderPipeline.
- **C:** `board/*`, `modelFactories/*`, each built spec card first [3D a].
- **D:** Game, EventPlayer, Picking, CameraRig, UI, audio, VFX, Playwright, `inline.mjs`, and the contract.

Rules resolve instantly. EventPlayer animates the event queue [GD c], and a click fast-forwards it.

**Budget** (desktop/mobile): calls ≤220/120, triangles ≤600k/250k, shadow lights 2/1, textures ≤40, post 2/0, 60 fps at 1280×720. Repeats are instanced; no `transmission` [GS c].

**Single-file build:** `base:'./'`, `assetsInlineLimit:1e9`, `cssCodeSplit:false`, one chunk, no Workers. A 15-line `inline.mjs` then writes `war-library.html` [GS a]. Playwright opens it over `file://` and asserts frames advance with zero errors.

**Hooks:** `setState(library-overview|player-turn|enemy-turn|artillery-resolve|victory|defeat)`, `loadScenario` and `skipIntro`. Diagnostics add round, phase, vp, morale, ordersLeft, intents and aiMs [GS a].

**Verification:**
- Rules tests and self-play.
- A clicking bot at two reaction speeds [GS e6].
- Inspector gates: contrast ≥60, entropy ≥3.0, edge density ≥0.04 [GS b].
- Acceptance tests for the old defects [RA d]: a response within 100 ms, no re-pick, pieces at least 28 px, no HUD overlap, both sides take losses, no hue band above 60%, overflows throw, and the lamp lights the desk.

# 12. Reused

- **Data** [RA b]: geography, roster, colour tokens, captions, the 250° wind, and the seven period order verbs, which become the parchment text.
- **Code** [RA c]: `17-audio.js`, the `11-models.js` proportions, the soldier sine clips, `face4`, `sweep` and `ribbon`, the motes, and `huecheck.mjs`.
- **Dropped** [RA e]: the 107:1 scale, the frozen lights, Linear tone mapping and the voxel terrain.

# 13. Risks and cuts, ranked

1. **Spectacle slows play.** Cap each order at 1.2 s and the enemy phase at 6 s; clicks fast-forward, and there is ×2 speed.
2. **The dark room fails contrast.** Keep the table brightest, apply the 12 L* rule, and gate on grayscale.
3. **Scope.** Cut in this order: S3, gas, Doctrine cards, intro, ambient magic, gallery.
4. **Tiny pieces.** 1.4× scale, coloured rims, and a close zoom.
5. **An exploitable AI.** Gate it on self-play.
6. **The single-file build breaks late.** Test it over `file://` from week 1.
7. **Performance.** Cut post first, then shadows, then candles.