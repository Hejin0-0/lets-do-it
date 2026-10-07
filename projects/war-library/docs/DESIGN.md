# INK & IRON: The Enchanted War-Table (final design v1.0)

The core of this design is the "enchanted-spectacle" concept. Ideas grafted in from the other two concepts are tagged ⟨G#⟩ where they are used.

From tactical-depth:
- G1: locked assault arithmetic.
- G2: stickiness targeting (the AI prefers targets that can't move out of the way).
- G3: balance gates using a terrain bot and a charger bot.
- G4: a loss ledger recording the hex and the rule.
- G5: a staff map.

From anyone-can-play:
- G6: candles are morale.
- G7: rewinds by difficulty.
- G8: a three-rule card.
- G9: a "Ring anyway?" guard and an intercepted plan slip.
- G10: enemy assaults advance into empty hexes.
- G11: the board rotates in portrait.

Rejected: section cards, which double the 60-second lesson, and squares, because hex fans and flanks carry the depth.

## 1. Title and promise

**Ink & Iron.** At midnight in a candle-lit gothic library, you command the 1917 Yser front on an enchanted map table. The tin soldiers march by themselves, every enemy attack appears in red ink a turn before it strikes, and a battle takes ten minutes.

## 2. Pillars

1. **Red ink never lies.** Enemy attacks are painted a phase early, damage is fixed and forecast, and there are no dice.
   - Test: the ledger asserts that every loss in the bot playtests was inked, fanned or forecast.
2. **Terrain decides.** A frontal assault on a dug-in trench deals 0.
   - Tests: the §5 arithmetic ⟨G1⟩, and the charger bot losing at least 70% of games ⟨G3⟩.
3. **Magic is the feedback.** Exhaustive switches map every `GameEvent` to a visual and an audio cue.
4. **Ten minutes, then one more.** 8 rounds, at most 8 pieces a side, 3 orders a round, and a retry in under 5 s.

Anti-pillars: economy, real time, sandbox verbs, dice, fog of war, Hogwarts IP.

## 3. Design brief

The main verb is to *order* a piece: select it, move it, act. The others are barrage, pivot, cut wire, undo, and ring the bell.

The core repeat:
1. Hover a hex; it glows within 100 ms.
2. Click a piece; it lifts.
3. Hover a destination to see the path and a forecast tag.
4. Click to move, then optionally click a target.
5. After three orders, ring the bell.

Over minutes, wire thins, craters spread, candles gutter and seals flip. Weather is announced a round ahead.

After a loss you get the ledger ⟨G4⟩, then Rewind ⟨G7⟩ or Retry in under 5 s.

Mastery means suppressing before crossing a fan, baiting barrages onto hexes you are about to leave, enfilading, and saving shells for MGs.

What tells you the next decision: gold wisps, red intents, fans, order pips, and a pulsing bell.

## 4. Core loop contract

> The player **orders** tin soldiers **to hold or seize seals by dusk (round 8)** while **red-inked attacks and MG fans** create risk; **success stamps seals and snuffs enemy candles, failure snuffs yours, and Rewind or Retry restarts in <5 s.**

A bot clicking the real canvas proves it (§11.7):
- `ordersLeft` decrements.
- A capture happens in at least 90% of games.
- Round 1 has an intent.
- Candles lost = figures lost + 2 × objectives lost.
- Retry reaches `player-turn` in under 5 s.

## 5. Rules

**Board.** 13×9 flat-top hexes in an odd-q layout, so columns B, D and so on sit half a hex lower. Each hex is 0.10 m across the flats. The map is 1.155×0.95 m, inset in a 2.4×1.6 m oak table.

Columns A–M run west to east and rows 1–9 run north to south; `HexId = row*13+col`. The Germans (AI) hold the north and the British (human) the south.

**Pieces.** Stats are Str/Move/Fire/Range. Str is the number of figures on the base, and each point of damage removes one.
- **Rifle Company**, 4/2/2/1 (assault). Captures and cuts wire.
- **MG Section**, 3/1/3/3 within its fan. Overwatch. It pivots or fires, and never fires after moving.
- **Field Gun**, 2/1/3/4, needs line of sight. Deals double damage to tanks. It moves or fires.
- **Mark IV** (British, S2), 4/2/3/2. Rifles, MGs and overwatch deal it 0. It crushes wire and gets no cover. In mud or a crater it bogs, and then it cannot move next round.
- **Stoßtrupp** (German, S3), 3/3/2/1. +1 in assault, ignores ZOC and wire, and captures.
- **Battery** (off-board). Barrages any hex for 1 order plus 1 shell.

**Terrain** (move cost/cover):
- open and dune 1/0;
- polder 2/0;
- trench 1/2;
- crater 2/1;
- ruin, church and château 2/1, and they block line of sight;
- blockhouse 1/3;
- bridge and sluice 1/0;
- river and sea are impassable.

Wire is an overlay on a hex. It stops infantry, and infantry in wire cannot assault. Rain turns polder and craters into mud, which costs 3.

**Orders.**
- Each side gets 3 orders per round; the British get 4 in S2.
- An order is one piece moving and then taking one act: assault, fire, cut or pivot.
- A piece takes at most one order per round, and a barrage uses one order.
- A piece with no order that sits on trench, crater or ruin becomes Dug-in: +1 cover, shown by a sandbag ring. It stays Dug-in until it moves or is suppressed.

Movement follows Dijkstra on move cost. A piece stops when it enters wire (infantry only), a hex adjacent to an enemy (ZOC), or an overwatch hit.

**Overwatch.**
- A piece that enters an open, dune, polder, crater or wire hex inside an unsuppressed enemy MG fan takes 2 damage, is Pinned (treated as Suppressed), and stops.
- Trench and ruin hexes never trigger overwatch.
- Each MG fires once per piece per phase.
- A fan is every hex within 3 that lies within ±60° of the MG's facing, clipped by line of sight: 15 hexes in the open.

**Combat.** `damage = max(0, Fire + bonus − cover)`.
- **Bonus:** +2 against a Suppressed target, +1 Wave (for the second and later assaults on a hex in one phase), +1 for a Stoßtrupp assault.
- **Cover:** the terrain's cover, +1 if Dug-in. Enfilade (assaulting from an adjacent connected trench hex) ignores trench cover.
- **Strike back:** a defender that survives an assault unsuppressed strikes back for `max(0, Fire − 1 − attacker cover)`. Ranged fire draws no strike back.
- **Advance:** an assault that clears the hex moves the attacker in.

**Barrage.** Deals 2 to everyone in the hex, on both sides (0 inside a blockhouse). It always Suppresses, makes a crater, and removes wire.

**Suppressed.** No move, act, overwatch or strike back. The piece's intents are cancelled and it loses Dug-in. Suppression clears at the end of the owner's next orders phase that starts after it was applied (`suppressedUntil`).

**Locked arithmetic ⟨G1⟩:**
- A rifle assaulting a dug-in trench rifle deals 0 and loses 1.
- A barrage followed by an assault destroys a full company (2, then 2+2−2).
- A rifle assaulting an unsuppressed trench MG deals 0 and loses 2.
- A barrage followed by an assault destroys that MG.
- Enfilade then Wave against a dug-in rifle deals 1, then 2.

**Red ink.** The human's attacks resolve instantly. The AI's moves are instant too, but its assaults, fire and barrages become **intents** on hexes, and these resolve at the next bell.
- An intent is cancelled if its source is destroyed, suppressed, or has left its `from` hex.
- An assault intent on an empty hex advances the attacker, capturing any objective there ⟨G10⟩.

**Round.**
1. **Dawn.** Weather and wind advance, and next round's are revealed. Gas drifts, the creeping barrage steps, and reinforcements arrive; their ghosts were shown a round early.
2. **Player orders** (`player-turn`). Undo is unlimited.
3. **Bell** (`artillery-resolve`). Intents land in the order they were declared. The first ring asks "Ring anyway?" if a movable piece is standing on red ⟨G9⟩.
4. **Enemy orders** (`enemy-turn`). The AI moves, your fans react, and the AI inks new intents.
5. **Dusk.** Dug-in is applied, sudden death is checked, and the turn candle burns a ring.

**Morale ⟨G6⟩.** Each side has candles on its rim. Starting counts (British/German) are S1 9/14, S2 14/12, S3 10/16.
- −1 per figure lost.
- −2 per objective lost.
- +1 per capture, up to the starting count.
- At 0 the side routs.

**Victory.** Rout the enemy, hold every objective at the end of a round, or meet the scenario's dusk condition after round 8.

**Special actions.**
- **Creeping barrage** (S2). 3 shells cover 3 adjacent hexes in a row. It lands now, then steps one row north at each of the next two dawns.
- **Gas** (S3, German). Covers the target plus 2 hexes downwind. A piece that starts a phase in it or enters it takes 1 damage and is Suppressed. It lasts 2 rounds and drifts a hex each dawn.
- **Sluice** (S3, British). Once per battle, for 1 order. All polder floods permanently, and pieces there lose 1 figure and move to dry ground.

## 6. AI opponent

The AI is pure TypeScript on the same rules core and `Action` type. It is side-agnostic, so the British self-play bot is the same code.

**Maps** are built once per turn:
- `threat[side][hex]`: the most damage a Str-4 piece on that hex could take next phase.
- `objDist[hex]`: move cost to the nearest objective the side does not hold.
- `cover[hex]`.

**Search.**
- **Candidates.** For each piece: every reachable hex × {hold, each legal target, cut, MG facings}. For the battery: barrages on hexes with an enemy, wire or an objective. Only the top K by a maps-only score are kept.
- **Beam.** A beam search runs over the side's orders, one depth level per order. Each node expands every unordered piece and the battery.
- **Child score.** `evaluate(apply(s,a)) − replyWeight × bestReplyLoss`. `bestReplyLoss` is the value-weighted best single-order damage of the opponent's top N pieces.
- **Choice.** Softmax over the final beam at `temperature`, drawing on `state.rng`.

**`evaluate` terms.** Weights live in `ai/profiles.ts`.
- **terminal:** ±1e6.
- **objectives:** 40 × (mine − theirs).
- **morale:** 6 × (mine − theirs).
- **material:** 3 × Σ Str × value. Values: rifle 1, Stoßtrupp 1.3, MG and gun 1.5, tank 2.5.
- **suppressed:** 4 per suppressed enemy.
- **advance:** 5 × Σ(1 − objDist/maxDist), attacker only.
- **exposure:** −3 × Σ threat × (1 − cover/3).
- **fanCover:** 3 per held objective inside my fans.
- **wire:** ±1.5 per wire hex within 3 of an objective, positive for the side holding it.
- **intentValue:** 2.5 × Σ forecast damage × stickiness ⟨G2⟩. Zero in round 8.
- **friendlyFire:** −4 per own figure inside my own barrage intents.

**Stickiness:**
- 1.0 if the target is suppressed, in wire, bogged, or is an MG guarding an objective.
- 0.8 if it is on an objective.
- 0.3 otherwise.

**Difficulty** changes only the search, as beam/K/temperature/replyWeight:
- **Recruit:** 1/3/1.0/0, stickiness off, ∞ rewinds. The S1 default.
- **Veteran:** 4/6/0.3/0.5, 1 rewind. The default for S2 and S3.
- **General:** 8/10/argmax/1.0, 0 rewinds.

Unit stats never change with difficulty. On the main thread, median `aiMs` must be at most 50 ms on Veteran and 150 ms on General. If over budget, cut K first, then the beam.

**Readability.**
- Intents are inked as each piece acts.
- The top intent becomes the intercepted slip ⟨G9⟩, in the old period voice: *"Intercepted, by runner: 'Shell the British fire trench at E7 at first light.'"*
- `?debug` overlays the maps and logs the top 3 plans with each term's contribution.

## 7. First 60 seconds (S1)

- **0–6 s.** "Click to wake the table" unlocks audio. Candles light, ink draws the map, and soldiers rise from the paint.
- **6–10 s.**
  - The slip reads *"Hold two of the three Yser bridges until dusk."*
  - A Coy (E7) is already lifted, with gold dots showing its reach.
  - E7 is hatched red: *"Shells land here when you ring the bell. Move A Coy."*
  - The rim card ⟨G8⟩ reads **Red ink hurts. Wire stops. Trenches shelter.**
- **10–30 s.** Hovering D7 shows "Trench · cover 2 · safe", and hovering E6 shows "Wire: stops here". A Coy lands on D7 with a felt thunk.
- **30–45 s.** The slip warns *"4th Company to turn the British right by the L gap."* Pivot the Vickers, or move C Coy to L7?
- **45–60 s.** The player rings the bell, and shells hit the empty E7: *"Red ink never lies."*

The battery is introduced in round 2 and the Stoßtrupp in round 3. "I've played before" skips the tutorial.

## 8. Scenarios

Key: `~` sea, `s` dune, `.` open, `,` polder, `=` trench, `#` wire, `o` crater, `w` river, `V` ruin, `C` church, `X` château, `P` blockhouse, `B` bridge, `L` sluice.

**S1 "Strandfest: Hold the Bridges"** (10 July 1917; defend; Recruit)
```
   ABCDEFGHIJKLM
1  ~ssV..X....,,
2  ~s=========.,
3  ~s##.#####..,
4  ~s..o...o...,
5  ~s.o...o..o.,
6  ~s####.####.,
7  ~s=========.,
8  ~wwBwwwBwwwBw
9  ~ssV.......,,
```
- **British:** rifles E7, H7 and J7; a Vickers at G7 facing N; 4 HE.
- **German:** rifles D2, F2, I2 and K2; MG08s at G2 (facing S) and C2 (facing SE); 6 HE. A Stoßtrupp enters at L1 at the dawn of round 3.
- **Opening intent:** a barrage on E7.
- **Win:** hold at least 2 of the bridges D8, H8 and L8 at dusk.
- **Tension:** the Vickers covers the G6 gap; nothing covers the L lane.

**S2 "The Great Dune"** (attack with 4 orders; Veteran)
```
   ABCDEFGHIJKLM
1  ~sss.C..X...,
2  ~ss.V.V......
3  ~s====P======
4  ~s###########
5  ~ss.o..o..o..
6  ~ss.o.o...o..
7  ~s#.###.###.#
8  ~s===========
9  ~ssV.........
```
- **British:** rifles D8, F8, H8, J8 and L8; a Lewis at E8 facing N; a Mark IV at G9; 8 HE and the creeping barrage.
- **German:** MGs at E3 (facing S), in the G3 blockhouse (facing S) and at J3 (facing SW); rifles C3, I3 and L3; a field gun at H2; 6 HE.
- **Weather:** rain from round 5, announced in round 4.
- **Win:** hold 2 of the church (F1), the château (I1) and the blockhouse (G3).

**S3 "The Sluice"** (defend; Veteran)
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
- **British:** rifles C6, E6 and J7; Vickers at D6 (facing N) and G6 (facing NE); 4 HE; the sluice.
- **German:** Stoßtrupps at F2 and H1; rifles C2, E2 and J2; MG08s at D2 and F1; 4 HE and 3 gas.
- **Wind:** starts at 250° off the sea and follows a seeded schedule. A brass vane shows each change a round ahead.
- **Win:** hold 2 of the bridge (D8), the sluice (H8) and the farm ruin (E7).

The harness (§11.7) tunes all starting numbers.

## 9. Art direction

**Room (Worker-C).** Built in real metres, with the table centre at the origin and the tabletop at y 0.90.
- **Hall:** x ±5.5, z −9 to +7, under a hammerbeam roof rising to 10.5 m.
- **Stacks:** double-height gothic oak on both long walls. A 3.2 m lower tier, a balustraded gallery at 3.4 m, and a 3.0 m upper tier, with pointed-arch crowns, brass chain rods, busts and rolling ladders. Freestanding presses form bays around the table's aisle.
- **Books:** one `InstancedMesh` of 8,000 books (0.18–0.32 m tall) in the old `SPINE` palette ±8%. Shelves have 9% gaps, 15% flat stacks and 10% leaners, with a gilt spine atlas.
- **North wall:** three 1.5×5.5 m leaded lancets that cast moon shafts. 1,500 pixel-sized motes spawn only inside the shafts.
- **Also:** a fireplace on the east wall; 120 instanced floating candles bobbing by `sin(t·0.5+φ)·0.03`; and a 1.2 m iron chandelier over the table, which is the key light's visible source.
- **Floor and props:** flagstones with a smoother aisle (roughness 0.35 against 0.8), a Turkey rug, a globe, a reading slope, and a padlocked gate.

**Table.** Worker-C builds the 2.4×1.6×0.9 m oak table with its brass rim, plus a banker's lamp that is a real PointLight. Worker-B builds the margin tokens: candle rows, an 8-ring turn candle, shell casings, order pips, the bell, the rule card ⟨G8⟩, and an inkpot with a quill.

**Board (Worker-B).**
- **Terrain:** a 256×212 heightfield. Trenches are real zig-zag recesses 0.008 m deep, with instanced revetments and duckboards. Wire is a `TubeGeometry` helix with barbs. Sandbags are instanced, and craters hold water.
- **Buildings:** extruded ruins with pointed-arch holes, and rafters running ridge to wall-plate (tested).
- **Paint:** a 2048 paint canvas plus separate roughness and bump canvases.
- **Lightness plan (L\*):** neighbouring zones stay at least 12 apart. Dune 84, trench spoil 80, British rear 68 (warm), bridge 60, no-man's-land 52 (ochre), river 44 (teal), German rear 40 (cool), polder 38, sea 36, craters 30, trench floor 22. Ink hex lines are at L\* 20.

**Miniatures (Worker-B).** Features are exaggerated ×1.4: 0.050 m figures on 0.082 m bevelled bases.
- **British:** khaki `#8A7E58`, Brodie helmet (brim 1.7× the head), puttees, and a brass rim with a roundel.
- **German:** Marinekorps navy `#2E3A52`, Stahlhelm, jackboots, and an iron rim with a cross.
- **Finish:** gloss enamel (roughness 0.3) with lead edge-wear.
- **Guns and tanks:** the field gun and Mark IV use the old `gun18pdr` and `mk4` proportions.
- **Build:** one merged vertex-coloured mesh per piece, with a contact-shadow decal.
- **State is shown by shape:** a gold wisp for orders left, a grey puff and 6° tilt for suppressed, a sandbag ring for dug-in, and mud clods for bogged.

**Overlays.** Every overlay pairs a pattern with an icon, never colour alone:
- reach: gold dots;
- path: gold ink;
- own fans: blue `#3E6FA8` hatching;
- enemy fans: red `#A8352C` dashes;
- intents: red cross-hatch with a glyph and the damage;
- danger: a wash, shown on hover only;
- selection: a gold Fresnel rim.

**Events.** Each plays in at most 1.2 s at 1×.
- **Move:** the piece lifts, rocks, and lands with easeOutBack.
- **Overwatch:** ink tracers.
- **Figure lost:** it topples, dissolves into ink, and snuffs a rim candle.
- **Barrage:** an ink splash (at most 64 particles), a board ripple, a stamped crater, dipping candles, and a 70 ms hitstop.
- **Intent:** a nib hatches the hex.
- **Capture:** a wax seal stamps down.

**Lighting (Worker-C).**
- Key: spot `#FFD9A0` with a 2048 shadow map.
- Moon: `#8FA6C8` at 0.35 with a 1024 shadow map, desktop only.
- Unshadowed points: the fire, the lamp and 2 candles.
- Fill: hemisphere 0.12, PMREM `RoomEnvironment` 0.35.
- Grading: ACES tone mapping, bloom 0.45/0.3/0.85, vignette, grain.
- Brightness order: board, then margins, then floor, then shelves, then ceiling.

**Camera (Lead).**
- A 6 s establishing shot, skippable.
- The default Commander view uses pitch 45° and vFOV 36°, with the board filling 62–72% of the width. Yaw ±35°. Zoom stops: Close, Commander and Gallery.
- V toggles an orthographic staff map ⟨G5⟩.
- The bell triggers a 0.6 s lean-in and shake, both off under reduced motion.
- In portrait ⟨G11⟩ the board rotates 90° at 62° pitch, keeping hexes at least 40 px on a 390×844 screen.

**UI (Worker-D).** DOM parchment and brass, using at most 12% of the screen and never covering the board.
- **Top-left:** objective and round.
- **Top-right:** candles, shells and order pips.
- **Bottom:** Undo (Z), **Ring the bell** (Space), Rewind (R) and the slip.
- **Forecast tags:** anchored to their hex, never covering the target.
- **Keys:** Tab cycles pieces, arrows and Enter move the cursor, Q/E pivot, Esc opens the menu.
- **Type:** text at least 15 px, with fixed-width numerals.

## 10. Audio (Worker-D)

Port `www/src/17-audio.js` into `src/audio/AudioSystem.ts`, treating the original as read-only. Keep its noise buffer, soft-clip, echo, `crack`/`blast`/`clack`/`patter`, voice stealing, and `schedule`. Then change three things:
- use a cosmetic seeded RNG;
- place the listener at the camera;
- set the delay to `min(0.35 s, d_real/343)`, counting 1 world metre as 2,500 m.

Cues:
- select: brass click
- place: felt thunk
- overwatch: `mg08` or `vickers`
- barrage: `incoming` then `blast`
- figure lost: tin clack
- intent: quill scratch
- capture: wax thunk
- bell: FM bell

Ambience ducks by 8 dB on barrages. Pitch varies ±6%. M mutes. The title screen says "Sound starts on your first click".

## 11. Tech plan

**11.1 Stack.** The existing scaffold has three 0.184, Vite 8, TypeScript 6, Playwright 1.60 and Node 22.22. `npm run build` runs `tsc && vite build && node scripts/inline-single-file.mjs`, which writes `dist/war-library.html`.

At G0 the Lead:
- sets `allowImportingTsExtensions` and `erasableSyntaxOnly`, so the rules and AI run under `node --test`;
- adds `test:rules`, `selfplay` and `test:e2e`;
- deletes `entities/`, `CollisionSystem` and the touch stick.

No new runtime dependencies.

**11.2 Files and owners**
```
Lead  main.ts, contract/{types,events,render-api,bus}.ts (frozen at G0), game/{Game,EventPlayer,
      Picking,TestHooks,Diagnostics}.ts, core/*, systems/{CameraRig,Tween}.ts, tests/e2e/*
A     rules/{hex,terrain,units,movement,combat,intents,phases,forecast,apply,victory,rng,index}.ts,
      rules/scenarios/s{1,2,3}.ts, ai/{maps,candidates,evaluate,search,profiles}.ts,
      tests/rules/*, tests/fixtures/*.json, scripts/selfplay.ts
B     board/{BoardView,HexLayout,MapPainter,Relief,TerrainKit,Overlays,Pieces,TableTokens,Vfx}.ts,
      assets/miniatures/*.ts
C     room/{RoomView,Shell,Bookcases,Books,Windows,Fireplace,Candles,Chandelier,Props,WarTable}.ts,
      render/{MaterialLibrary,ProceduralTextures,LightingRig,RenderPipeline}.ts   (mat(role) stub at G0)
D     ui/{Hud,Forecast,Tutorial,Ledger,Menu,Keys}.ts, ui/hud.css, audio/{AudioSystem,cues}.ts
```

**11.3 Interfaces**
```ts
// contract/types.ts — pure data, structuredClone-safe
export type Side = 'BR' | 'DE'; export type HexId = number; export type Dir = 0|1|2|3|4|5; // N NE SE S SW NW
export type Terrain = 'open'|'dune'|'polder'|'trench'|'crater'|'ruin'|'church'|'chateau'|'blockhouse'|'bridge'|'sluice'|'river'|'sea';
export type Phase = 'dawn'|'player-orders'|'bell'|'enemy-orders'|'dusk'|'over';
export type Rule = 'overwatch'|'assault'|'strike-back'|'fire'|'barrage'|'gas'|'flood';
export interface Unit { id: string; side: Side; kind: 'rifle'|'mg'|'fieldgun'|'tank'|'stoss'; hex: HexId;
  str: number; facing: Dir; suppressedUntil: number; dugIn: boolean; bogged: boolean; ordered: boolean }
export interface Intent { id: number; source: string; kind: 'assault'|'fire'|'barrage'|'gas';
  from: HexId | null; target: HexId; dmg: number }
export interface GameState {
  scenario: 's1'|'s2'|'s3'; difficulty: 'recruit'|'veteran'|'general'; rng: number; round: number; phase: Phase;
  terrain: Terrain[]; wire: boolean[]; gas: number[]; units: Unit[]; intents: Intent[];
  objectives: { hex: HexId; holder: Side | null }[]; ordersLeft: number; active: string | null;
  morale: Record<Side, number>; shells: Record<Side, { he: number; gas: number }>;
  weather: { now: 'dry'|'rain'; next: 'dry'|'rain' }; wind: { now: Dir; next: Dir };
  creep: { hexes: HexId[]; stepsLeft: number } | null; sluiceUsed: boolean;
  ledger: { round: number; unit: string; figures: number; hex: HexId; rule: Rule }[]; winner: Side | null }
export type Action =
  | { t: 'move'; unit: string; to: HexId } | { t: 'assault'|'fire'|'cut'; unit: string; target: HexId }
  | { t: 'pivot'; unit: string; facing: Dir } | { t: 'barrage'; target: HexId; shell: 'he'|'gas' }
  | { t: 'creep'; hexes: HexId[] } | { t: 'sluice' } | { t: 'endOrders' };
export interface Forecast { legal: boolean; dmgDealt: number; dmgTaken: number; label: string }

// contract/events.ts
export type GameEvent =
  | { e: 'phase'; phase: Phase; round: number } | { e: 'moved'; unit: string; path: HexId[] }
  | { e: 'attack'; kind: Rule; target: HexId; dmg: number } | { e: 'figures'; unit: string; lost: number }
  | { e: 'destroyed'|'suppressed'|'recovered'|'dug-in'|'bogged'|'reinforce'|'pivoted'; unit: string }
  | { e: 'intent'; intent: Intent } | { e: 'intent-resolved'; id: number; outcome: 'hit'|'empty'|'cancelled' }
  | { e: 'crater'|'wire-cut'; hex: HexId } | { e: 'gas'|'flood'; hexes: HexId[] }
  | { e: 'captured'; hex: HexId; by: Side } | { e: 'morale'; side: Side; value: number }
  | { e: 'weather'|'wind' } | { e: 'game-over'; winner: Side };

// rules/index.ts (A) — no three, DOM, Math.random or Date
export function newGame(id: GameState['scenario'], seed: number, d: GameState['difficulty']): GameState;
export function legal(s: GameState): Action[];
export function reach(s: GameState, unit: string): Map<HexId, { path: HexId[]; stop: 'zoc'|'wire'|'overwatch'|null }>;
export function forecast(s: GameState, a: Action): Forecast;
export function apply(s: GameState, a: Action): { state: GameState; events: GameEvent[] };
// pure; throws IllegalAction. Human endOrders runs the bell; AI endOrders runs dusk and dawn.

// ai/index.ts (A)
export interface AiProfile { beam: number; k: number; temperature: number; replyWeight: number;
  stickiness: boolean; w: Record<string, number> }
export function planTurn(s: GameState, p: AiProfile): { actions: Action[]; ms: number }; // ends with endOrders

// contract/bus.ts
export interface BusMap {
  'state': { state: GameState; events: GameEvent[] };             // after apply/undo/rewind/setState
  'ui:hover': { hex: HexId | null }; 'ui:click': { hex: HexId | null };
  'ui:cmd': { cmd: 'undo'|'bell'|'rewind'|'retry'|'speed'|'mute'|'staff'|'pivot'|'menu' };
  'view:busy': { busy: boolean }; 'fx:shake': { trauma: number }; 'audio': { cue: string; hex?: HexId } }
export interface Bus { on<K extends keyof BusMap>(k: K, f: (p: BusMap[K]) => void): () => void;
  emit<K extends keyof BusMap>(k: K, p: BusMap[K]): void }

// contract/render-api.ts
export interface Overlay { reach: HexId[]; path: HexId[]; fans: { hexes: HexId[]; side: Side }[];
  intents: Intent[]; danger: HexId[]; selected: string | null; cursor: HexId | null }
export interface BoardView {                                        // B
  mount(tableTop: THREE.Object3D): void; load(s: GameState): void; sync(s: GameState): void;
  play(ev: GameEvent, speed: number): Promise<void>;              // exhaustive switch, ≤1.2 s at speed 1
  overlay(o: Overlay): void; hexAt(ndc: THREE.Vector2, cam: THREE.Camera): HexId | null;
  pieceScreenBox(unit: string, cam: THREE.Camera): { w: number; h: number } }
export interface RoomView {                                         // C
  build(scene: THREE.Scene, q: 'desktop'|'mobile'): void; tableTop: THREE.Object3D;
  update(dt: number): void; setReducedMotion(on: boolean): void }
```

**Game (Lead)** alone calls `apply`. It keeps the in-phase Undo stack and a snapshot per player turn for Rewind.

**EventPlayer (Lead)** awaits `board.play` for each event, then emits the audio cue and the shake. A click fast-forwards at 4×. The enemy phase takes at most 6 s.

**Hooks:**
- `setState(library-overview|player-turn|enemy-turn|artillery-resolve|victory|defeat)` loads the fixture from A; unknown names throw.
- `loadScenario`, `skipIntro`, `setSpeed`.
- `hexScreen(hex)`, for real-pixel clicks.
- `suggest()`.

**Diagnostics** add round, phase, `ordersLeft`, morale, intents, `aiMs` and `lastFeedbackMs`.

**11.4 Integration (one push).**
1. **G0 (Lead):** config, frozen contract, stubs, an end-to-end greybox, and a green single-file build.
2. **G1:** A's rules and AI go in. S1 plays to both victory and defeat, and the harness gates pass. Meanwhile B, C and D build on isolation pages (`?asset=<id>&view=game|34|side|top`, `?room`, `?hud`) that set `window.__ready`.
3. **G2:** art merge. Every event is animated and the budgets are measured.
4. **G3:** evidence.

S2 and then S3 are built only while everything stays green.

**11.5 Render budget** (desktop / mobile):
- **Draw calls:** ≤250 (room 120, board 45, pieces 40, overlays 20, VFX 15, tokens 10) / ≤150.
- **Triangles:** ≤750k (room 250k, books 96k, relief 108k, pieces 80k, terrain 60k) / ≤300k.
- **Geometries:** ≤250 / 200.
- **Textures:** ≤48 / 32, using ≤200 / 96 MB.
- **Lights:** 2 / 1 shadowed, plus 4 / 2 unshadowed.
- **Post passes:** 2 / 0.
- **DPR:** 2 / 1.5.
- **Frame time at 1280×720 on a hardware GPU:** ≤16.7 / 33 ms.

No `transmission`. Repeated objects are instanced, and instance overflow throws.

**11.6 Acceptance criteria.**

**A, rules**
- The G1 cases pass.
- Tests cover blockhouses, overwatch, the 15-hex fan, ZOC, wire, mud, bogging, suppression expiry in all four phases, intent cancellation, G10, damage only on intent hexes, morale, and all three victories.
- Property tests over 10k random legal actions check that `forecast` equals `apply`, that inputs are never mutated, that the same seed gives the same hash, and that `legal` agrees with `apply`.
- No three or DOM imports.

**A, AI**
- Every action is legal, and every plan ends with `endOrders`.
- The time budgets hold.
- It shells a pinned fixture target rather than a mobile one.
- The §11.7 gates pass.

**B**
- Pieces measure at least 28×48 px in S-02.
- The two sides are distinguishable at 25% squint and in grayscale, judged by a blind scout.
- `play()` covers every event.
- A frame after `sync()` is within 1.5% of the end of `play()`.
- Picking round-trips all 117 hexes.
- Neighbouring zones are at least 12 L\* apart.
- Trenches have at least 3 depth planes.
- The rafter test passes.

**C**
- S-01 has contrast ≥60, entropy ≥3.2, and a dominant colour ≤0.5.
- The §9 brightness order holds.
- There are at least 6,000 book instances.
- The lamp brightens its margin at least 1.5×.
- Reduced motion freezes the candles, dust and fire.
- The room uses at most 120 draw calls.

**D**
- The HUD uses at most 12% of the screen, with no board overlap.
- Feedback arrives within 100 ms.
- S1 round 1 can be played with the keyboard alone.
- Every control has all four states.
- The cue map is exhaustive.
- Mute persists (`localStorage` in try/catch).
- The ledger total equals the figures lost.
- No text is truncated at 1280×720 or 390×844.

**Lead**
- All scripts are green, the hooks work, and `check_evidence.py` passes.
- Regression tests cover the audit's old defects:
  - RA-d1: every click gets feedback.
  - d2: a reachable-hex click always orders.
  - d3: pieces are at least 28 px.
  - d4: both sides lose figures in at least 95% of games.
  - d5–d6: HUD and framing.
  - d8–d9: the inspector gates, plus `huecheck` (no 30° hue band above 60%, run against a control image).
  - d10: rafters.
  - d11: overflow throws.
  - d13: the lamp.
  - d14: the loop contract.

**11.7 Verification plan.**
1. `npm run test:rules`.
2. `npm run selfplay -- --games 200` for each scenario, writing to `artifacts/selfplay.json`. Gates:
   - The terrain bot (General as British) beats Veteran at least 60% of the time ⟨G3⟩.
   - The charger bot (shortest path, assaults anything adjacent, never shells MGs) loses to Veteran at least 70% of the time ⟨G3⟩.
   - British Veteran wins at least 70% against Recruit and 30–55% against General.
   - Both sides deal damage in at least 95% of games.
   - All games end by round 8, with at most 10% ending before round 4.
3. `npm run build`: tsc is clean and the HTML is at most 1.5 MB.
4. Playwright, with 1 worker, against the preview server on hardware-GPU Chromium (`softwareRendered` false):
   - A smoke test with zero errors.
   - A bot playtest that takes its plans from `suggest()` and enters them as real canvas clicks at `hexScreen` pixels, at 0 and 300 ms reaction time. It asserts that:
     - frames advance;
     - by round 4 there is a capture or at least 3 enemy figures lost;
     - the phase changes at least every 20 s;
     - the game ends by round 8;
     - defeat → Retry → `player-turn` takes under 5 s;
     - Undo and Rewind restore the state hash.
5. Named shots via `inspect-threejs-canvas.mjs --seed 42` at 1280×720 and DPR 1, declared first in `artifacts/evidence.json`:
   - S-01: library-overview.
   - S-02: S1 round-1 player-turn. Board 62–72% of width, pieces ≥28 px, no HUD overlap.
   - S-03: forecast.
   - S-04: enemy-turn, with at least 2 intents.
   - S-05: artillery-resolve.
   - S-06: close zoom.
   - S-07: staff map.
   - S-08: victory.
   - S-09: defeat.
   - S-10: mobile portrait, with hexes ≥40 px.
   - S-11: S-02 in grayscale, with the board at least 2× the room's luminance.

   Every shot needs contrast ≥60, entropy ≥3.0, a dominant colour ≤0.6, edge density ≥0.04, and renderer counts within §11.5.
6. Single file: open `dist/war-library.html` over `file://`. It must show zero errors, make only `file:` and `data:` requests, render at least 120 frames in 3 s, and let the bot finish round 1.
7. Scorecard: every category at 2 or above and an average of at least 2.5, recorded in `artifacts/final-evidence.md`. That file must disclose that all assets are procedural because no API keys were available.

## 12. Reused from `www/` (read only)

- **Kept:** geography, captions, unit names, palette, the 250° wind, the period order verbs, `17-audio.js`, the `mk4` and `gun18pdr` proportions, and the `SPINE` shelf rules.
- **Dropped:** the 107:1 scale, the frozen three-light rig, Linear tone mapping, voxel terrain, the 17 verbs, and the soldier rig. Tin soldiers rock; they don't walk.

## 13. Risks and cuts, ranked

1. **The rules aren't fun.** G1 must pass the harness before any art merges. If General can't be balanced, cut it.
2. **Spectacle slows play.** Caps of 1.2 s per event and 6 s per enemy phase, plus fast-forward and 2× speed.
3. **The room is too dark.** Luminance gates keep the board the brightest element.
4. **Scope.** Cut in this order: S3, the creeping barrage, the chandelier and intro, the gallery, then the tank.
5. **Integration drift.** The contract is frozen, and exhaustive switches fail to compile when it drifts.
6. **Performance.** Cut post-processing first, then the moon shadow, then candles from 120 to 60.
