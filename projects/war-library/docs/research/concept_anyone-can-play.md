# The Yser Table: Game Design Document (Accessibility First)

Citations name the digest and section: [GS] game-skills, [3D] 3d-assets, [GD] game-design-ai, [RA] reuse-audit.

## 1. Title and promise

**The Yser Table.** *Sit at a candle-lit map table in an old library and, in ten minutes, beat a German general who chalks every move on the board before he makes it.*

## 2. Design pillars

1. **Red means it will hurt.** Before you press End Turn, the board already marks everything the enemy can damage next: red chalk cells, chalk arrows and machine-gun (MG) lanes.
   - *Test:* a newcomer can point to every square that will be hit.
   - *Rules out:* random hits and surprise attacks [GD-b].
2. **One click has one meaning, and it can be undone.** You select a piece, then click where it goes. The game responds within 100 ms, and Undo works until End Turn.
   - *Rules out:* the old build's 17 verbs, and its confusion over whether a click picks a unit or orders it [RA-d.2, d.14].
3. **Ten minutes, then one more.** A 10×8 board, 6–8 turns, and at most 6 pieces a side. A retry takes under 5 s, and a ledger explains each loss.
   - *Rules out:* an economy and real-time play [GD-a.1].

## 3. Design brief [GS-d]

- **Primary verb:** order a piece: select it, preview the move, commit.
- **Secondary verbs:** End Turn, Undo, the Barrage card, and turning an MG to face a new direction.
- **The 5–30 s repeat:**
  1. Lift a khaki piece. The squares it can reach glow cream.
  2. Hover a square to see the path and a forecast chip ("−1, pinned").
  3. Click to move.
  4. Click a target (forecast "●●● → ●") or pass.
- **What changes over 1–5 min:** wire is cut, craters spread, flags change hands and candles go out. Once the AI loses a flag, it counter-attacks.
- **Lose, learn, restart:**
  - You lose when your candles run out, or when you hold too few flags at dusk.
  - The ledger names the cause: "The MG at g6 cost you 3 men; its lane was lit for 2 turns."
  - **Retry last turn** takes under 5 s, because the game state is plain data [GD-c.1].
- **Reward and risk:** you gain flags and morale, and you pay by standing in lit cells.
- **What a better player does:** cuts wire first, shells an MG before assaulting it, stacks second-wave assaults, and steps out of red cells early.
- **How the next decision is shown:** a brass pip marks each piece still waiting for an order. The End Turn seal pulses once every piece has one. A plan slip states the enemy's intent ("Fritz means to shell your trench at c2–d2").

## 4. Core loop contract

> The player orders pieces across a 10×8 map to hold flag squares by dusk, while MG lanes and chalked barrages threaten open ground. Each flag taken snuffs an enemy morale candle, each piece lost snuffs one of yours, and a lost match restarts in under 5 s.

The bot playtest uses real clicks to prove each clause [GS-e.6]:
- **Orders:** pointer input produces `order` events every turn.
- **Flags:** `diagnostics.flags` changes in at least 90% of matches, and `victory` is reachable.
- **Pressure:** `threatCells` is above 0 on turn 1, and the enemy deals damage in at least 90% of self-play games [RA-d.4].
- **Candles:** the morale change equals pieces lost plus flags lost.
- **Restart:** Retry reaches `player-turn` in under 5000 ms.

## 5. Rules

**Board:** 10 × 8 squares of 0.12 m, making a 1.2 × 0.96 m board. Moves are orthogonal only. Squares are easy to count and keep MG lanes straight, as in Into the Breach [GD-b].

**Pieces:** a piece's HP is the number of tin figures on its base. Each hit removes one [3D-b].

| Piece | HP | Move | Attack | Special |
|---|---|---|---|---|
| Infantry | 3 | 2 | Assault an adjacent piece for 2 hits | The second assault on the same target in a turn deals +1 |
| Machine gun | 2 | 1 | – | Covers a 4-square lane in the direction it faces |
| Mark IV tank (British, S2) | 3 | 1 | 1 hit, up to 2 squares in a straight line | Immune to MG fire; crushes wire; stops in craters |
| Field gun (German, S2) | 2 | 0 | 2 hits on a tank, 1 on anything else; up to 3 squares in a straight line | Its aim is always chalked |
| Barrage card | Limited shells | – | 1 hit to every piece on 2 adjacent squares | Ignores cover and hits both sides. Clears wire, leaves craters, suppresses MGs |

**Terrain:**
- **Trench, crater, ruin:** −1 hit taken, and a piece there is safe from MG lanes. A ruin also stops a lane from passing through.
- **Wire:** stops infantry.
- **Water:** impassable.

**MG lanes** [GD-d]:
- A piece that enters an open square in a lane takes 1 hit and is **pinned**: its move ends and it skips its next order.
- At the end of its owner's phase, the MG also hits the first enemy standing in the open in its lane.
- A barraged MG is **suppressed**: its lane goes dark through its owner's next turn.

**Turn order:**
1. The enemy's intents are already shown.
2. You give each piece one order: move, then attack, pass or set facing. You may also play one Barrage. Undo is unlimited.
3. At End Turn your barrage lands. If one of your pieces stands in red, the game asks you to confirm first.
4. The enemy's chalked barrages and arrows hit whoever now stands on those cells. If an arrow's cell is empty, the attacker moves into it.
5. The enemy moves and chalks new intents.
6. The dusk candle drops a notch, and victory is checked.

**Why no dice:** forecasts are exact, so every loss has a visible cause, and Undo can't be used to reroll. Variety comes from the AI's softmax choice and from seeded scenario variants [GD-c].

**Victory:** each side has 5 morale candles and loses one for every piece lost and every flag lost. You win by holding the required flags at dusk, or by snuffing all the enemy's candles.

**Example: S1, turn 1**
1. The enemy has chalked b2–c2, under two of your men. Its MG at g6 faces west and covers f6–c6.
2. The player moves c2 to the crater at c4 for cover, and b2 to b3.
3. They move d2 to d4. Hovering d6 had warned "in lane: −1, pinned".
4. At End Turn, shells land on the now-empty b2–c2 and leave craters.
5. The enemy chalks d4–e4, and the slip reads "Fritz means to shell the men at the gap." Next turn's choice: run the gap under the MG, or cut through the wire on the flank.

## 6. AI opponent [GD-c]

**Architecture:**
- One pure rules core (`legal`, `apply`, `evaluate`, seeded RNG) serves play, Undo, the AI and self-play.
- Every turn, the AI builds three maps: threat, distance to flags, and cover.
- It runs a beam search over its units in order (guns, then MGs, then infantry), checking the player's best reply one step ahead.
- It picks the final plan by softmax.

**Evaluation** (weights stored in JSON): flags, material, morale, suppressed enemies, wire cut, advance, and exposure (threat × (1 − cover)).

**Telegraphing:**
- All damage is declared one phase early and aimed at cells, never at units.
- Barrages favour cells that are costly to leave, but never cells that can't be left.
- The top plan becomes the plan slip, written in the old build's order voice [RA-b].

**Difficulty:** changes only the AI, never unit stats [GD-a.6].

| Level | Beam | K per unit | Temperature | Reply weight | Rewinds per match |
|---|---|---|---|---|---|
| Recruit (default) | 1 | 3 | high | 0 | ∞ |
| Veteran | 4 | 6 | low | 0.5 | 1 |
| General | 8 | 10 | 0 | 1 | 0 |

**Budgets:** the AI thinks for at most 100 ms. The enemy turn plays in at most 5 s, and a click skips it. Over 200 seeded games, General must beat Recruit at least 75% of the time [GS-e.6].

## 7. First 60 seconds [GD-a.4]

- **0–4 s:** the camera glides from the gallery down to the table. A tap skips it.
- **4–10 s:**
  - The objective slip reads: "Take the flag at e7 by dusk. Your men wear khaki."
  - A card on the table rim reads: **Red hurts. Wire stops. Trenches shelter.**
  - One infantry piece is already lifted, with red chalk under it. A brass pointer says: "Shells land here next turn. Move!"
- **10–30 s:** the piece lands with an easeOutBack bounce and a felt thunk. The pointer then shows the MG-lane forecast, then Undo.
- **30–60 s:** the End Turn seal pulses. Shells burst on the square the player just left: "You read it and dodged it."

The guide ends after turn 2, and "I've played before" skips it. The title screen reads "Sound starts on your first click" [RA-d.5].

## 8. Scenarios

**Map key**
- **Terrain:** `.` open, `=`/`#` British/German trench, `x` wire, `o` crater, `R` ruin, `~` water, `F` flag.
- **Pieces:** British in lower case (`i` infantry, `m` MG, `t` tank), German in upper case (`I` infantry, `M` MG, `G` field gun). A piece drawn on a trench row stands in the trench.

**S1 "Over the Wire"** (tutorial, 6 turns, 1 flag). Teaches MG lanes and wire.
- The d5–e5 gap is fast, but it leads into the lane of the west-facing MG at g6.
- The h5 flank is slow, but it gets behind that gun.
```
  abcdefghij
8 ...RRR....
7 ####F#####
6 ......M.I.
5 xxx..xxxxx
4 ..o....o..
3 ..........
2 =iii=i====
1 ..........
```

**S2 "Shells and Steel"** (8 turns, hold 2 of 3 flags). Adds the Barrage card, with 4 shells. The Mark IV enters at d1 on turn 3. The MG at b6 faces east and the MG at h6 faces west, so both lanes cross f6, just past the wire gap.
```
  abcdefghij
8 RFR.RFR.FR
7 ####I#####
6 .M.....M.G
5 xxxxx.xxxx
4 o..o..o..o
3 ..........
2 =i=i=i=i==
1 ...t......
```

**S3 "Strandfest, 10 July 1917"** (defend for 8 turns; win by holding at least one of the two bridge flags, at c2 and h2) [RA-b]. Adds your own north-facing MGs, and German barrage lines that creep forward a row each turn.
```
  abcdefghij
8 ~.########
7 ~.I.I..I.I
6 ~....o....
5 ~.xx..xx..
4 ~.i.m..im.
3 ~=========
2 ~~F~~~~F~~
1 ~.........
```

## 9. Art direction

**Room: a Hogwarts-style library at real scale** [3D-b, RA-a]
- **Stacks:** double-height gothic oak (4.2 m) with pointed-arch crowns, a balustraded gallery, freestanding bays, and a rolling ladder on a brass rail.
- **Books:** 6–10k books in one `InstancedMesh`, placed using the old shelf rules. Chain rods across the shelves, and marble busts on top.
- **Windows:** leaded lancets throwing tinted light shafts, with dust drawn only inside the shafts.
- **Lights:** 80–200 floating candles, an iron chandelier, a stone fireplace, and green banker's lamps.
- **Also:** a hammerbeam roof, worn flagstones, a Turkey rug, a globe, and a reading slope with an open folio.

**Board**
- **Table:** an oak war-table, 2.4 × 1.6 m, with a brass rim.
- **Map:** a painted 2048 canvas with ink squares, contours and serif labels. Trenches are real recesses.
- **Zones:** ochre no-man's-land, a warm British wash, a cool German wash, saturated water and cream roads. Neighbouring zones differ by at least 12 L*, which fixes the old build's murky midground [RA-d.8].

**Miniatures**
- Painted tin, with identifying features exaggerated 1.4×.
- Each side has three cues, never colour alone:
  - Helmet: Brodie or Stahlhelm.
  - Paint: khaki #8a7a4e or field-grey #5e6b70.
  - Base rim: brass with a roundel, or iron with a cross.
- At least 32 px tall on screen. The old build's were 11 px [RA-d.3].

**Overlays:** each one pairs a pattern with an icon.
- Move: cream dots.
- Barrage: red hatching with a shell icon.
- MG lane: red dashes with chevrons.
- Assault: a chalk arrow.
- Selected piece: a gold ring.

**Lighting** [GS-c]
- **Key:** one shadowed lamp pool over the table (2048 shadow map).
- **Fill and practical lights:** cool fill from the windows, the warm fire, and emissive candles backed by 2–4 stand-in lights.
- **Tone:** a PMREM environment at about 0.4, ACES tone mapping, then bloom and a vignette.
- **Grayscale order:** board brightest, then shelves, then ceiling, with a contrast of at least 60 in the canvas inspector.

**Camera:**
- An establishing glide.
- A 55° command view, with the board filling 75% of the width.
- A 0.6 s lean-in during combat, turned off under reduced motion.
- Player control: ±30° of yaw and two zoom stops.
- In portrait on a phone the board rotates, giving 47 px squares.

**UI** [GS-d]: parchment slips, brass and a wax seal, never stat cards.
- Objective and plan slip at top left, the candles at top right, End Turn and Undo at bottom centre.
- Text is at least 16 px serif.
- Keyboard: Tab, arrows, Enter, Z and Space.

## 10. Audio

- **Engine:** port `17-audio.js` as `AudioSystem.ts` [RA-c]. It already has about 40 voices, voice stealing, and sound that arrives later the farther away its source is.
- **Game sounds:**
  - Select: a brass click.
  - Place: a felt thunk.
  - Enemy intent: a chalk scratch.
  - End Turn: a whistle.
  - Barrage: an incoming whine before each blast.
  - Lane fire: the MG08 or the Lewis gun.
  - A figure falls: a tin clack.
- **Ambience:** fire, a clock, rain and wind, all quieter during barrages.
- **Rules:** pitch varies ±6% from the seeded RNG, there is a mute token, and every sound has a matching visual.

## 11. Tech plan

**Stack:** the `create_threejs_game.py` scaffold with three 0.184, Vite 8 and Playwright [GS-a]. `src/rules/` has no three imports and uses only erasable TypeScript, so Node 22 can run self-play with `--experimental-strip-types`.

**Ownership:** `types.ts` (`State`, `Order`, `GameEvent`) is frozen first. The rules emit events and the view replays them [GD-c.2].
- **Agent A, rules and AI:** `src/rules/*`, `profiles.json`, `scripts/selfplay.ts`.
- **Agent B, room:** `src/room/*`, `LightingRig`, `RenderPipeline`.
- **Agent C, board and pieces:** `src/board/*`, `src/assets/*`.
- **Agent D, flow, UI, audio and QA:** `Game`, `Hud`, `CameraRig`, `Picking`, `Tutorial`, `AudioSystem`, `tests/*`.

**Render budget** [GS-c]:
- **Desktop:** at most 200 draw calls, 500k triangles and 40 textures; one 2048 shadow map; at most 2 post-processing passes.
- **Mobile:** at most 150 draw calls and 300k triangles; a 1024 shadow map; no post-processing; device pixel ratio 1.5.

**Single HTML file:** `build:single` uses `vite-plugin-singlefile@2.3.3` with sourcemaps off. The page makes no fetches, starts no workers and loads no web fonts. To verify, open it from `file://` in headless Chrome and check for zero errors and more than 120 rendered frames.

**Test hooks:**
- **States:** `library-overview`, `player-turn`, `enemy-turn`, `artillery-resolve`, `victory`, `defeat`, `after-action`.
- **Calls:** `loadScenario`, `setDifficulty`.
- **Diagnostics:** turn, phase, flags, morale, selection, threat cells, `aiMs`, `lastFeedbackMs`.
- **Banned:** `Math.random`.

**Acceptance tests, one for each old defect** [RA-d]:
- Every click gets feedback within 100 ms.
- Clicking a reachable square always issues an order.
- Pieces are at least 32 px tall.
- Both sides deal damage.
- The HUD never overlaps the board.
- Colour entropy is at least 3.0.
- Instance caps throw an error when exceeded.
- The lamp is a real light.

**Evidence:** canvas-inspector captures, `check_evidence.py`, and bots with 0 ms and 300 ms reaction times [GS-e].

## 12. Reused from the old build [RA-c]

**Kept:**
- **Data:** sector geography, captions, the period voice of the order text, palette hex values, unit names.
- **Code:** `17-audio.js`, `face4` and `ribbon`.
- **Model specs:** `mk4` and `gun18pdr`, as blockouts.
- **Room and figures:** the bookcase fill rules, the soldier sine-wave animation clips, and dust motes sized in pixels.
- **Tools:** `probe.mjs`, `huecheck.mjs`.

**Dropped:** the room code, the 107:1 scale, the three-light solve, the voxel terrain, and the 17 verbs.

## 13. Risks and cuts, ranked

1. **The rules aren't fun:** one flank always wins, or the AI is too passive or too cruel. Build the rules and self-play first, have a greybox version playable on day 1, and test it on people. Cut General if it can't be balanced.
2. **The room eats the schedule.** Cut in this order: chandelier swing, fire, gallery, window tracery. Never cut the books, candles, lamp pool or light shafts.
3. **The dark room hurts readability.** The board stays the brightest element, and a contrast test enforces it.
4. **Tank bugs.** Cut the tank; S2 becomes a shells-only scenario.
5. **The S3 creeping barrage.** Fall back to static chalk lines.
6. **Breakage under `file://`.** Build the single file from day 1.
7. **Mobile performance.** Drop post-processing first, then shadows.