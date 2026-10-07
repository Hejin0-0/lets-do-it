# Audit of the Yser diorama (`www/`): what the rebuild should keep and what it should drop

Root: `/Users/rels/Documents/github-repo/prep/prompt-test/.claude/worktrees/night-street-setup-ae1067/prompt-test/www`. File references below are relative to `src/` unless noted. Screenshots I viewed: `final-room.png`, `ITER26-library.png`, `DIAG-room-night.png`, `final-default.png`, `C3-final.png`, `ITER27-sea.png`.

## (a) The room

**Why it scored well** (bookmark 9, `final-room.png`):
- **Layout.** The staff table sits in the centre of a dark-oak tray. Behind it are two north-wall bookcases with a bay of raised-and-fielded panelling between them, an east-wall case, and one press that projects into the room. That press is what turns a "hall with shelves" into a set of stalls (`20-room.js:228-252`). There is a window on the east wall with linen curtains and a pelmet, and the lime-washed ceiling has exposed beams (`BEAM_Z`, :221).
- **Library cues that do most of the work** (Amendment 10):
  - Brass chain rods along every shelf: a repeated horizontal line up each case.
  - Marble busts in a rank along the cornices. They are the only stone above waist height.
  - Big folios laid flat on the case tops.
  - Rolling ladders on brass rails (:2397-2454).
  - Candle sconces on the end stiles, a reading slope with an open folio, a globe, and a potted plant.
- **Bookcase generator** (:1500-1700). Book widths and heights are random, and a few rules per shelf make it read as used:
  - 9% of slots are gaps where a volume was taken out.
  - 15% are flat stacks and 10% are books leaning into the gap.
  - 38% of spines get a title band.
  - There are 7 period binding colours (`SPINE`, :498): oxblood, regimental green, buff, calf, tan, blue-grey and ochre.
- **Palette** (`C`, :285-475). Honey-oak table, darker tray, mahogany panelling. The upper walls are painted cream, with sage green on the window wall, which breaks the room's all-orange hue. Brass is aged bronze rather than lemon. There is an oxblood/olive/ochre Turkey carpet and cool marble.
- **Desk props** (`21-props.js`). A half-unrolled trench map with a curling edge, calipers, an open compass, binoculars, shell casings used as paperweights, a field phone, a mug, a spike file and a service cap.

**What is weak, and why it doesn't read as Hogwarts:**
- **Nothing in the room gives light.** The frozen three-light rig (CONTRACT §1.6) bans any extra light, so shading and ambient occlusion are painted into vertex colours. The brass lamp lights nothing; the reviewer marked it −4 and it was never fixed (`22-atmos.js:1-45`). At night the room is almost black (`DIAG-room-night.png`). There is no candlelight, fireplace, glow or bloom.
- **The shading reads as flat low-poly.** The room neither casts nor receives shadows. The tone mapping is Linear rather than filmic, so warm light never rolls off softly.
- **The proportions are domestic.** The ceiling is about 2.3 m at real scale and every case is one storey. Hogwarts needs height:
  - double-height stacks with a gallery and balustrade
  - tall gothic lancet windows with leaded panes
  - stone pillars and arches
  - floating candles, hanging lanterns, a fireplace
  - dust in shafts of light
  - deep shadow between warm pools of light
- **The frame is cramped.** The HUD covers the left 290 of 1600 px, and the table fills 40% of the frame. Amendment 10 concluded that "floor is not a surface this room can dress".

**Root cause.** The room is built at 107 world units to 1 real metre, so that a 256 m battlefield can sit on the table at 1:1. That one decision is why:
- any light bright enough to light the desk lights the battlefield equally
- fog has to be switched off for the room
- every room colour is inverse-solved against the battlefield's sun

## (b) Historically grounded content worth keeping

- **Sector.** Nieuwpoort/Yser, autumn 1917. It is the one place on the Western Front with land, sea and air together. Its geography, from west to east:
  - sea, surf, beach, dunes (the Great Dune)
  - a village with a church whose spire snapped at 31 m, a chateau used as German brigade HQ, and a broken calvary
  - estuary silt, then the flooded polder with drowned willows
  - across the front, moving north to south: German rear with its battery, German reserve, support and fire trenches, wire, no-man's-land with a mine crater, Allied wire, Allied fire and support trenches
  - behind the Allied line: the Yser cut with 5 bridges (one broken) and a ferry, the lock and sluice that hold the inundation, a 60 cm Decauville railway, the gun line, and the coast road with its dump
  - Sources: CONTRACT.md:103-210, and the landmarks table at :188-210.
- **Legibility rule** (CONTRACT §1.4). Fresh spoil is pale shell-sand on dark mud. On the dunes this inverts: parapets are dark revetment on pale sand. It is not chalk, which is the Somme's look.
- **Units:**
  - Tanks and cars: Mark IV Male (6-pdr sponsons) and Female (Lewis guns), A7V, Whippet, Rolls-Royce armoured car
  - Guns: 18-pdr, 6-in howitzer
  - Aircraft and balloon: Camel, SE5a, Albatros, Dr.I, RE8, Caquot balloon
  - Ships: Erebus-class monitor, destroyer, submarine, drifter
  - Transport: 3-ton lorry, horse limber, Decauville loco
  - Troops: Marinekorps Flandern in navy blue, which is historically exact for this sector.
- **Weapons** (`13-combat.js:121-157`):
  - SMLE: 10 rounds, 15 aimed rounds per minute
  - Gew98: 5-round clip
  - Lewis: 47-round pan, 9.17 rounds/s
  - MG08: 250-round belt, 7.5 rounds/s
  - Webley and P08 pistols
  - Mills bomb: 28 m range, 4 s fuse; Stielhandgranate: 35 m, 5 s
  - Hit chance is 0.7% per round at trench range, which is historically honest.
- **Order text** (`13-combat.js:180-201`). Seven verbs for each side: hold, stand to, zero hour, press, consolidate, withdraw, fire mission. They are written in period voice, in English and German, and each is delivered "by telephone / pigeon / runner". This maps straight onto a card or turn system.
- **Other text:**
  - Roles and states: `18-ui.js:104-107`
  - Vehicle names: `18-ui.js:94`
  - Viewpoint captions such as "The spire snapped at 31 m. It watched the whole support line." (`18-ui.js:61-92`)
  - Wind comes off the sea at bearing 250°, which decides whose gas works (`13-combat.js:107`)
- **HUD style.** A 1917 field message pad (C.2121, SECRET stamp). It is charming and worth keeping as a style, but it should not cover the left sixth of the frame.
- **Unit colours** (CONTRACT.md:269-366):

| Name | Hex |
|---|---|
| KHAKI | `#8A7E58` |
| FELDGRAU | `#464C42` |
| NAVY | `#2E3A52` |
| MARK_RED | `#A8352C` |
| MARK_BLUE | `#2B5A86` |
| POPPY | `#D8342A` |
| FLARE_R | `#FF3A32` |
| FLARE_G | `#4CFF7A` |

## (c) Code worth porting nearly as-is

- **Procedural audio, `17-audio.js`.** The best-engineered piece in the build and almost self-contained.
  - Graph setup: one 2 s white-noise buffer, a `tanh` soft-clip waveshaper, and two low-passed delay taps with feedback as a field echo (:95-157). A wind loop and a two-saw drone follow (:159-189).
  - Four building blocks: `crack`, `blast`, `clack`, `patter` (:243-297).
  - A table of about 40 voices (:300-600): rifle, lewis, mg08, gun18pdr, how6in, gun15in, incoming/incomingHeavy, whistle, klaxon, gong, flare, splash, collapse, and more.
  - Voice stealing (:605-627).
  - `schedule` (:629-685) delays each sound by distance/343 so the flash lands before the report, adds air-absorption low-pass and pan, and applies Doppler.
  - The graph is created on the first click (:687-731).
  - To port: replace `Util.rand` with `Math.random` and point the ear at the camera. On a tabletop the distances should be mapped back to "real" metres.
- **Model specs, `11-models.js`.** These are pure data: box, cylinder, prism and sphere operations on a 0.25 m grid, with mounts for muzzle, crew, contact points and exhaust.
  - Worth taking: `mk4` :158, `mk4Female` :229, `gun18pdr` :408, `howitzer6in` :448, `camel` :530, `albatros` :573, `monitor` :743, `a7v` :900, `whippet` :944.
  - They are ideal as board miniatures. They need a small compiler; the original is `Vox.compile` in `00-core.js:1205`. Colours are palette indices, so a lookup table is needed.
- **Soldier rig.** The 13-bone table at `11-models.js:102` and the seven clips in `12-soldiers.js:470-626`. Each clip is a handful of sine functions of one phase, with no keyframes: stand, walk, crouch-run, fire and others, plus additive layers for firing, hit, gas mask and hands-up. Useful for a piece's "act" animation.
- **Room builders, as algorithms rather than code** (all in `20-room.js`). They must be rescaled out of the 107:1 units and their colours re-solved for real lights:
  - `bookcase()` :1513, including the chain rod, busts and folio stacks
  - `fielded()` panelling :858
  - `curtainPanel()` :1198
  - `buildRug()` :1423
  - `buildLadders()` :2444
  - `chair()` :2542
  - `readingSlope()` :2568
- **Other small pieces:**
  - `face4` (`21-props.js:310`) flips a quad's winding when it faces the wrong way, which prevents faces that silently vanish. `sweep` and `ribbon` (:340, :420) make rolled maps.
  - Dust motes sized in pixels rather than metres (`22-atmos.js:258-350`). Reuse them inside real light shafts.
- **Tools.** `tools/probe.mjs` drives the page in real Chrome with no dependencies; `huecheck.mjs` measures hue spread.
- **Do not port:**
  - the three-light solve (`10-sky.js`, §1.6)
  - the Linear tone mapping
  - the room's emitter API
  - the fog-inside-a-model design
  - the battlefield terrain (0.5 m voxels over 256 m)

## (d) Recurring defects to design out

1. **Dead or silent default action.** Inspect did nothing for ten iterations because a state variable was renamed. The Mine announcement was overwritten in the same tick. A miss looked the same as a broken tool. The Inspect card re-announced every 200 ms and drowned every other message.
2. **Selection and command were ambiguous.** Clicking to send a unit re-picked a nearby soldier instead of giving the order, worth −7. It was fixed ad hoc with pick radii. It needs an explicit select-then-order grammar with a clear target cursor.
3. **Units too small to click or read.** A man was 11 px tall at the default view, and moving men were missed three times in a row.
4. **One-sided simulation.** The German battery never fired, so British casualties stayed at 0. Separately, every soldier spawned with morale 0 and routed at once.
5. **HUD fighting the scene:**
  - it covered 290 px of the frame
  - the panel was taller than the viewport, hiding the sluice and section controls below the fold
  - headlines were truncated and rows wrapped, twice
  - the numbers jittered (35, 39, 28)
  - keypresses changed the world with no feedback
  - sound started only on the first click, with no hint
6. **Framing:**
  - Viewpoints gave 40% of the frame to bookshelves.
  - The default view spent a quarter of the frame on desk clutter.
  - Props were placed where no camera could see them, twice. The lesson recorded was to compare camera and prop positions before placing anything.
7. **Scale-dependent effects.** Dust motes sized in metres became 40 px flares at close range.
8. **Midground murk.** Detail noise was louder than form. Fourteen levers were measured over Amendments 4-9 and none raised the large-scale contrast. The cause is structural: dense voxel noise with no designed value groups.
9. **Monotone hue.** 87% of coloured pixels fell in one 30° band, first on the battlefield and then in the room.
10. **Geometry errors caught only by eye.** The village roofs had the ridge beam at right angles to the gables.
11. **Silent capacity overflows.** The prop cap and the brick cap both filled up and dropped geometry without any error.
12. **Broken instruments.** The API-check parser was wrong, and a colour test with no control counted the room's green books.
13. **The lamp lights nothing.** Never fixed.
14. **No game.** 17 sandbox verbs, a clock, and a battle you watch. There is no objective, no turns, no decisions with consequences, and no win or lose.

## (e) Verdict

Rebuild from scratch. Do not keep the room's code, only its design language. Every room problem the reviewers could not fix traces to one decision: a 1:1 metre battlefield shares a world with a room built at 107:1. That decision forbade real lights, forced every colour to be hand-solved against a frozen sun, disabled fog in the room, and cost 34k triangles of painted-on occlusion. A Hogwarts library needs the opposite: candles, a fireplace, light shafts, bloom, real shadows and double-height stacks. Keeping the room would mean keeping that problem.

Build it at real scale instead: a roughly 1.2 m board on a real table in a real room with free lighting and filmic tone mapping. Make the board a readable turn-based game: a hex or square grid of the simplified Yser sector, chunky painted miniatures using the ported model specs, clear objectives, and an AI opponent (06-game-ai). Carry over as data: the sector geography, unit roster, weapon table, order text and captions. Carry over the audio code almost unchanged, and the bookcase generator and prop ideas rescaled. Write the reviewers' fourteen defects in as acceptance tests from day one.