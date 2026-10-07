# 1. The Map Room: Yser 1917

**Player promise:** you command a 1917 trench sector on a candle-lit war table in a library, and every enemy barrage and machine-gun arc is painted on the map before it fires.

Sources: [GS] game-skills, [3D] 3d-assets, [GD] game-design-ai, [RA] reuse-audit.

# 2. Design pillars

1. **Every turn is a readable dilemma.** Damage is fixed, with no dice, and is shown before you commit. Barrages are announced one turn before they land. Machine-gun (MG) fans are always drawn. *Test:* the ledger names the hex and rule behind each loss, and both were visible the turn before [GD a1,b].
2. **The terrain decides.** A frontal assault on a dug-in trench does 0 damage. *Test:* in AI-vs-AI self-play, the same army goes from winning to losing when its route ignores terrain.
3. **The table is the world.** Everything is tin, ink, brass or parchment. *Test:* no HTML element covers the board.

**Anti-pillars (what we will not build):** an economy, real-time play, the old build's 17 sandbox verbs [RA d14], dice for damage.

# 3. Design brief

- **Primary verb:** *order* a unit: select it, move it, then act.
- **Secondary verbs:** play a card, call a barrage, suppress, assault, cut wire, dig in, turn an MG.
- **The 5-30 s repeat:** hover a hex, read the forecast tag (damage, return fire, danger next turn), then commit.
- **What changes over 1-5 min:** wire thins, craters and mud spread, shells run out, morale falls, the front moves, and the AI shells wherever you are stuck.
- **Lose, learn, restart:** you lose if your morale hits 0, or if you don't hold the objectives at the final round. The ledger lists each loss with its hex and cause. Retry takes under 5 s.
- **Reward and risk:** you gain objectives and drain enemy morale, and you pay in figures.
- **What a better player does:** suppresses before assaulting, clears trenches from the inside, baits barrages onto hexes it is about to leave, and saves Zero Hour until the wire is cut.
- **How the next decision is shown:** red fans, barrage markers with a countdown, the enemy's face-up card, forecast tags, and a red danger wash on hover.
- **Non-goals:** unit upgrades, multiplayer, rifle-round realism.

# 4. Core loop contract

> The player orders 1-4 units per turn to take objectives by the last round, while announced barrages, MG fans and wire create risk. Success takes objectives and breaks enemy morale; failure costs figures, and a retry takes under 5 s.

How each clause is proven in code:
- **Orders:** `turn.test.ts` checks how many units each card activates. A Playwright bot plays with real clicks while `diagnostics.ordersLeft` counts down.
- **Objectives:** a scripted line of play reaches `victory` in every scenario, headless.
- **Risk:** S1 loads with an enemy barrage marker already on a friendly hex [GS d]. Crossing an active fan deals exactly the forecast damage.
- **Costs:** in self-play, both sides deal damage [RA d4].
- **Retry:** going from `defeat` through Retry to `player-turn` takes under 5000 ms.

# 5. Rules

**Board:** flat-topped hexes, 13×9, each 0.10 m across [3D b]. The map is a 1.15×0.95 m relief set into a 2.4×1.6 m table.
- **Why hexes:** with hexes it is never ambiguous who is adjacent, which matters for flanking and for zone of control (ZOC: moving next to an enemy stops you). MG fans also become clean wedges of 3, 5 and 7 hexes.
- **Sectors:** Left (columns A-D), Centre (E-I) and Right (J-M).

**Units:** STR (strength) is the number of figures on the base. Damage removes figures, so strength shows on the board.

| Unit | STR | Move | Attack | Return fire | Special |
|---|---|---|---|---|---|
| Infantry | 4 | 2 | assault 3 | 2 | only unit that can capture |
| MG | 3 | 1 | 3, range 3, fan only | 3 | 2 damage to enemies entering open or crater hexes in its fan, and pins them |
| Field gun | 2 | 1 | 3, range 5, needs line of sight | 1 | 5 against tanks |
| Howitzer | 2 | 0 | barrage 3, range 8 | 0 | 1 shell per barrage |
| Mark IV tank (S2) | 3 | 2 | 2, range 2 | 2 | immune to MG fire; crushes wire; 17% chance to ditch |
| Stosstrupp (S3) | 3 | 3 | assault 3 | 2 | ignores ZOC and dug-in bonuses |

**Terrain:**
- **Cover:** open 0; crater, ruin or wood 1; trench 2; blockhouse 3.
- **Wire:** stops infantry, and a unit in wire cannot assault.
- **Rain:** turns craters and polder to mud, which costs 2 move to enter.

**Turn:** each side's turn has four steps.
1. **Land:** barrages announced last turn resolve.
2. **Order:** play 1 of your 3 cards, then move and act with the units it allows. You can undo until something resolves.
3. **Declare:** new barrages appear on the board as markers.
4. **End:** units that didn't act dig in, objectives score, and you draw a card.

**Cards:** each side has a 20-card deck, worded from the old build's order verbs [RA b].

| Card | Copies | Effect |
|---|---|---|
| Press Left / Centre / Right | 3 each | order 3 units in that sector |
| Hold | 3 | order 1 unit; all others dig in |
| Stand To | 2 | turn MGs, then order 2 units |
| Fire Mission | 2 | order 2 howitzers and 1 other unit |
| Consolidate | 2 | order 2 units; units on objectives regain a figure |
| Zero Hour | 1 | order 4 infantry at +1 attack |
| Withdraw | 1 | order 3 units to fall back, immune to MG fire |

You rarely hold one card that both saves the unit in danger and makes the attack you want.

**Special orders:**
- **Creeping barrage:** a line 3 hexes wide that costs 3 shells and moves forward one row on each of your next two turns.
- **Cut wire:** removes one coil.

**Combat:** `damage = max(0, attack + bonuses − cover)`, where `cover = terrain + dug-in(1) − suppressed(1)`.
- **Why no dice:** planning becomes the skill, and the forecast is always true, as in Into the Breach [GD b]. It also lets the AI search exact outcomes. The only randomness is the card draw, which you see before deciding, and the tank ditch chance, which is printed [GD d].
- **Suppression:** any artillery hit suppresses the target for the rest of the turn, even at 0 damage. A suppressed unit loses its dug-in bonus and 1 cover, and cannot fire, react or fire back.
- **Enfilade:** an attacker in the same trench line ignores trench cover.
- **Wave:** each later assault on the same hex that turn gets +1.
- **Shaken:** a unit down to 1 figure attacks at −1 and cannot capture.
- **ZOC:** a unit stops when it moves next to an enemy.
- **Barrages:** ignore dug-in bonuses, cut wire, leave craters, and hit your own units too.

In numbers, assaulting a dug-in trench deals:
- 0 frontally, and the attacker takes 2 back;
- 2 after suppression, with nothing back;
- 4 as a wave from inside the trench line.

**Morale:** starts at 6-9 depending on the scenario. It drops by 1 for each unit lost and 2 for each objective lost. A side at 0 routs.

**Victory:** hold the objectives at the last round, or rout the enemy.

**Example turn** (S1, round 3, British side, Veteran AI):
- **Situation:** the hand is Press Centre, Press Right and Stand To. A German barrage marker reading "lands next turn: 2" sits on F4, over infantry company Coy 2 (4 figures, in a crater). MG-J at J2 covers the wire gap at J3.
- **Card:** the player plays **Press Right**. Coy 2 is in the Centre, so it has to stay under the marker. That is the dilemma.
- **Suppress:** the field gun at J7 fires at MG-J. The forecast reads "0 damage, SUPPRESSED", and the fan greys out.
- **Assault:** Coy 4 moves J5→J3, where ZOC stops it, and assaults for 3−(2−1) = 2. MG-J is shaken and doesn't fire back.
- **Wire:** Coy 5 cuts the wire at K3.
- **German reply:** the barrage hits Coy 2 and MG-J fires on Coy 4. Both drop to 2 figures.
- **Next turn:** another suppression lets Coy 4 take J2. From there it can attack along the trench toward the objective at H2.

# 6. AI opponent

**Architecture** [GD c]:
- **Rules core:** pure `legal/apply/evaluate` functions with a seeded random number generator. The game, the AI, undo and self-play in Node all share it.
- **Maps:** each turn, the AI builds three maps: `threat`, `objDist` (distance to objectives) and `cover`.
- **Search:** for each card in hand, a beam search runs over that card's units in a fixed order: howitzer, MG, gun, tank, infantry.
- **Candidates:** the hexes each unit can reach (Dijkstra), cut to the top K.
- **Scoring:** `evaluate − replyWeight × bestReplyLoss`, which checks how badly the player could reply one move ahead.
- **Choice:** a softmax pick among the best plans.

**Evaluation terms** (weights in JSON): VP, material, morale, suppressed enemies, wire cut on its own attack lanes, advance, exposure (threat × (1−cover)), a penalty for ending under an enemy barrage marker, and how well its fans cover its objectives.

**Barrage value:** Σ damage × stickiness, where stickiness is how hard the target is to move.

| Target | Stickiness |
|---|---|
| Howitzers, pinned units, units in wire, MGs | 1.0 |
| Units holding an objective | 0.8 |
| Everything else | 0.3 |

The AI shells whoever can't easily leave, so every announced barrage is a real dilemma [GD c3].

**How the AI shows its intent:** barrage markers, MG fans, its played card face-up (which names its sector), and its actions played one at a time (1×, 2× or instant). `?debug` overlays the three maps and logs the top 3 candidate plans.

**Difficulty** changes only the search settings, never unit stats [GD a6]:

| Level | Beam width | K | Temperature | Reply weight | Behaviour |
|---|---|---|---|---|---|
| Recruit | 1 | 3 | 1.0 | 0 | ignores stickiness |
| Veteran | 4 | 6 | 0.3 | 0.5 | shells units that can't leave |
| General | 8 | 10 | 0 | 1 | shells a hex, then assaults the suppressed unit; baits you with open lanes |

**Test harness** (200 seeds per scenario):
- General beats Recruit at least 75% of the time.
- A bot that plays the terrain beats Veteran at least 60% of the time.
- A bot that charges straight in loses at least 70% of the time.
- General takes under 100 ms per turn.

# 7. First 60 seconds

1. **0-8 s:** the camera glides from the gallery, past the candles, down to the table.
2. **8-15 s:** a slip reads "Take Redan Trench by round 7." Coy 2 is already selected, under a red marker that reads "shells land here next turn."
3. **15-35 s:** the forecast appears within 100 ms of hovering. Hovering open ground inside the MG fan draws a red lane: "MG fire: 2, pinned." The player moves to a crater instead.
4. **35-60 s:** the player seals the orders. The shells hit the empty hex, which gives the first "I read it and beat it" moment [GD a4].

After that, one new idea per round: suppression, then cards, then wire.

# 8. Scenarios

Legend:
- `.` open, `o` crater, `#` ruin, `=` trench, `x` wire, `P` blockhouse, `,` polder
- `^` dune, `~` water, `B` bridge, `*` objective, `M` MG, `C` church

Germans are in the north (top). Odd columns sit half a hex lower.

**S1 Redan Trench** (7 rounds, British attack). Teaches trenches, wire, MG fans and suppression.
- British: 5 infantry, 1 MG, 1 field gun.
- Germans: 2 MGs, 3 infantry, 1 howitzer.
- The gaps in the wire are exactly where the MGs point.

```
  ABCDEFGHIJKLM
1 .#.........#.
2 ===M=*=*=M===
3 xxx.xxxxx.xxx
4 .o...o...o...
5 ...o.....o...
6 xx.xxx.xxx.xx
7 =============
8 .....#.......
9 ~~~~~~B~~~~~~
```

**S2 Rain on the Polder** (8 rounds). Adds a howitzer with 8 shells, the creeping barrage, a Mark IV tank, and rain that is announced in round 3.
- The causeway (column G) stays firm, but it runs into both blockhouse fans and the German gun behind the church.
- The polder on either side turns to mud.
- Eight shells can't cover everything.

```
  ABCDEFGHIJKLM
1 ..#.*C#......
2 ==P=======P==
3 xx.xx,.,xx.xx
4 ,,,,o,.,o,,,,
5 ,,o,,,.,,,o,,
6 ,,,,,,.,,,,,,
7 =============
8 ...#.........
9 .............
```

**S3 Strandfest, 10 July 1917** (8 rounds; you play the Germans) [GD d]. Adds Stosstruppen and gas.
- **Gas:** lands as a 3-hex cloud downwind. Units in it lose 1 figure and are masked (−1 move, −1 attack).
- **Wind:** a vane shows next round's wind, which blows off the sea at 250° [RA b].
- **Goal:** cut or hold 2 of the 3 bridges.

```
  ABCDEFGHIJKLM
1 ~^^==========
2 ~^^xxxxxxxxxx
3 ~^.o...o...o.
4 ~^xxxxxxxxxxx
5 ~^=====*=====
6 ~^^,,,,,,,,,,
7 ~^,,,,,,,,,,,
8 ~~B~~~B~~~B~~
9 ~^^..#.......
```

# 9. Art direction

**Room:** a double-height hall under a hammerbeam roof 9 m up [3D b].
- 4.2 m gothic oak bookcases, with a railed **gallery** and a spiral stair.
- 8,000 books, with gaps and leaning volumes [RA a].
- Rolling ladders on brass rails, and marble busts.
- Three tall **leaded arched windows**, with dust visible only in the moonbeams.
- 120 **floating candles**, an iron chandelier, banker's lamps and a **stone fireplace**.
- Stone pillars and arches, worn flagstones, a Turkey carpet, a globe, and the old build's desk props.

**Board:**
- An inked relief map with contour lines and serif labels.
- Trenches are real cuts in the surface, the wire is concertina, and craters hold water [3D b].
- Colours: ochre no-man's-land, a warm British side, a cool German side and saturated water.
- Neighbouring zones differ by at least 12 L* in lightness, which fixes the old build's murky midground [RA d8].

**Pieces:** painted tin figures scaled up 1.4×, at least 28 px tall on screen [RA d3].
- British: khaki `#8A7E58`, with Brodie helmets.
- Germans: Marinekorps navy `#2E3A52`, with Stahlhelms.
- Red `#D8342A` is used only for threats. Your own orders are drawn in pencil-blue.

**Lighting** [GS c]:
- **Key:** a warm hanging lamp over the table casts shadows and keeps the table the brightest thing in the room.
- **Second shadow light:** the fireplace.
- **Fill:** moonlight.
- **Candles:** three stand-in lights.
- **Post-processing:** a warm environment map at 0.4, ACES tone mapping, bloom at 0.4 and a vignette.

**Camera:**
- **Default:** a 3/4 view from the commander's chair at 50°, with the board filling 75% of the frame.
- **Controls:** orbit ±30° and 3 zoom steps. Tab switches to a top-down staff map.
- **Combat:** each result gets a 0.6 s lean-in, which is off under reduced motion.
- **Title and end screens:** shot from the gallery.

**UI** [GS d]:
- **Style:** rough-edged parchment, brass frames, and a wax seal on the "Send Orders" button.
- **Layout:** objective top-left, morale dials top-right, cards bottom-right (at most 22% of the width), banners top-centre.
- **Type:** a system serif font with fixed-width numerals. No web fonts, so the game works when opened from `file://`.

# 10. Audio

- **Engine:** port the old build's `17-audio.js` almost whole [RA c]. It has 40 voices, voice stealing, echo, and a distance delay at 1000× board scale.
- **Room sounds:** fire crackle, a ticking clock, rain in S2, page turns, brass clicks and pencil scratches.
- **Mixing:** incoming barrages duck the room sounds.
- **Variation:** seeded ±6% pitch variation [GS d].
- **Controls:** the first click turns audio on; M mutes.

# 11. Tech plan

**Stack:** the threejs-game-skills scaffold (three 0.184, Vite 8, TypeScript 6, Playwright) [GS a].
- Clicking on the board uses raycasts.
- Rules tests run with `node --test --experimental-strip-types`.
- `rules/types.ts` and the `GameEvent` type are frozen on day 0 so the agents can work in parallel.

**Ownership:**

| Agent | Owns |
|---|---|
| A | `src/rules`, `src/ai`, `tools/selfplay.mjs`, with no three.js |
| B | `src/board` (heightfield, paint, decals) and `src/assets/modelFactories` |
| C | `src/room`, LightingRig, RenderPipeline, MaterialLibrary, CameraRig |
| D | `Game.ts`, `src/ui`, AudioSystem, tests, the single-file build |

**Render budget** (desktop / mobile) [GS c]:

| Metric | Desktop | Mobile |
|---|---|---|
| Draw calls | ≤300 | ≤150 |
| Triangles | ≤750k | ≤300k |
| Textures | ≤60 | ≤40 |
| Shadow-casting lights | 2 | 1 |
| Post-processing passes | ≤2 | ≤2 |

**Single file:** `vite-plugin-singlefile@2.3.3` builds `war-library.html`, about 0.8 MB. It makes no network requests and uses no web workers. A Playwright test opens it from `file://` and plays one turn.

**Test hooks:**
- `setState` accepts `library-overview`, `player-turn`, `enemy-turn`, `artillery-resolve`, `victory` and `defeat`, and throws on anything else.
- `loadScenario(id, seed)` loads any scenario.
- Diagnostics report round, phase, hand, VP, morale, the selected unit, and AI think time in ms.

**Acceptance tests** (from the old build's defects [RA d]):
- feedback under 100 ms;
- one click selects, the next click orders;
- pieces at least 28 px tall;
- no UI over the board;
- both sides deal damage;
- contrast of at least 60;
- capacity overflows throw an error.

Evidence is captured as [GS e] describes.

# 12. What is reused

- **Data:** the sector geography, unit roster, order text (as cards), captions, palette and wind direction.
- **Code:** `17-audio.js`, `face4`, `probe.mjs`, `huecheck.mjs`, and the soldier animation curves.
- **Ideas:** the bookcase and ladder generators, props, dust motes sized in pixels, and the proportions of the `mk4`, `gun18pdr` and `howitzer6in` models [RA c].
- **Dropped:** the 107:1 scale, the fixed three-light setup, Linear tone mapping and the voxel terrain [RA e].

# 13. Risks and cuts, ranked

1. **The rules are shallow.** Before any art, play S1 headless. The terrain-playing bot must beat Veteran at least 60% of the time and the charging bot must lose at least 70% [GD a7]. If not, tune the rules first.
2. **General is too weak or too slow.** Reduce K before narrowing the beam. Move the AI to a web worker only if it takes more than 100 ms.
3. **The board looks murky.** Run grayscale and squint tests on every art pass [3D a], and fail any pass with contrast below 60.
4. **Integration across agents.** Freeze the shared types and merge daily.
5. **Scope.** Cut in this order: gas, the creeping barrage, mud, then S3.
6. **The single-file build breaks.** Test it on day 1.

**Out of scope:** a campaign, fog of war, aircraft as units (they appear as decoration on flight stands), and two players on one machine.