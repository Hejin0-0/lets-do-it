# Spec: Inkbound Isle — Expedition Vertical Slice

## Objective

Ship a browser-playable first-person dinosaur survival expedition that feels like a compact Steam demo rather than a systems sandbox. In one 5–8 minute run, the player lands on a procedurally generated comic-book island, gathers supplies, crafts a spear, establishes a camp, earns a parasaur's trust, defeats the apex Ink-Jaw, and reaches a scored victory screen. The slice must remain honest about its limits: it demonstrates a polished production direction, not the content volume of a full AAA game.

This refinement pass targets the finish and immediate readability of a current premium Nintendo-style 3D cartoon while remaining an original first-person survival game. The reference bar is the 2026 Nintendo Switch 2 edition of *Animal Crossing: New Horizons*: rounded silhouettes, deliberate color separation, soft contact, expressive motion, clean composition, and high-resolution material response. No Nintendo geometry, textures, characters, names, UI, or other protected expression may be copied.

## Player Promise

- **Readable world:** jungle, plains, coast, and misty highlands have distinct warm/cool palettes, landmarks, ground cover, silhouettes, and traversal ambience.
- **Tactile survival:** every accepted action has visual and audio feedback; food and campfires have survival utility; crafting and building create meaningful preparation.
- **Fair dinosaurs:** hostile creatures perceive, signal, commit, and recover instead of dealing unexplained contact damage. The tameable herbivore requires repeated trust-building and becomes useful.
- **A complete expedition:** a persistent objective chain culminates in an apex encounter and a result screen with time, resources, structures, tame, and defeats.
- **Co-op that matters:** connected explorers see one another and share bounded resource, structure, and creature events for the current server session.

## Golden Path

1. **Landfall:** learn movement and gather wood, stone, fiber, berries.
2. **Forge:** craft a stone spear and use food to recover hunger.
3. **Shelter:** place a campfire and at least one structural piece.
4. **Bond:** feed the marked parasaur three times, then issue follow/stay commands.
5. **Hunt:** read the Ink-Jaw's telegraphed attacks and defeat it with the companion's help.
6. **Victory:** show expedition statistics and offer replay or continue exploration.

## Tech Stack

- TypeScript 5.9 on Node.js 22
- Three.js 0.185 for procedural WebGL graphics
- Vite 8 for development and production bundling
- `ws` 8.18 for the local/LAN multiplayer relay
- Native Web Audio, Web Storage, Fullscreen, and Pointer Lock browser APIs
- Node's built-in test runner and strict assertions

No new runtime dependency is justified for this iteration.

## Project Structure

- `src/gameplay.ts` — pure inventory, survival, recipes, build costs, trust, mission, score, save schema
- `src/creatures.ts` — dinosaur geometry, state, animation, and readable combat phases
- `src/world.ts` — seeded island, instanced ground cover, landmarks, weather, and day/night
- `src/audio.ts` — procedural Web Audio ambience and capped priority cues
- `src/game.ts` — first-person loop, interactions, save/restore, and orchestration
- `src/multiplayer.ts` — validated presence and session-world events
- `src/ui.ts` — title, HUD, pause/settings, boss, trust, and victory surfaces
- `server.mjs` — Vite middleware plus hardened local/LAN relay
- `scripts/session-smoke.mjs` — real-client session relay smoke
- `docs/` — art direction, LOOP ledger, sources, and QA evidence

## Controls

- Move `WASD`; look mouse; jump `Space`; sprint `Shift`.
- Primary interact/attack `E` or left mouse; feed `F`/`T`; eat berry `G`; companion command `R`.
- Hotbar `1–7`; rotate placement `Q`; dismantle aimed owned structure `X`.
- Crafting `C`/`Tab`; pause/settings `Esc`; mute `M`.
- Equivalent labeled buttons remain keyboard focusable before pointer lock.

## Functional Acceptance Criteria

- Stable seed creates all four biomes, two major landmarks, dense instanced ground cover, coast water, flat clouds, stars, and day/night lighting without external art assets.
- Player movement includes visible hands/tool, bounded head-bob and sprint sway, landing feedback, damage kick, adjustable FOV/sensitivity, and reduced-motion support.
- Four resources can be gathered; axe, spear, and torch can be crafted; berries restore hunger; nearby campfires slowly restore health when hunger permits.
- Foundation, wall, and campfire use positioned previews, rotation, collision rejection, and owned-structure dismantling. Owned structures survive local save/continue while current-session structures are shared.
- Parasaur trust advances through three valid feeds with cooldown feedback, then supports follow/stay. Raptor and Ink-Jaw attacks have alert, windup, active, and recovery phases.
- Combat includes impact marker, world-space star/slash/smoke language, short bounded hit-stop, directional damage feedback, boss health, defeat feedback, and no surprise contact damage.
- Objective HUD advances through the golden path; completing the apex hunt opens a victory summary.
- Two connected clients share validated movement and current-session gather/build/creature deltas; disconnects clean up remote avatars.
- Title, continue/new expedition, pause, settings, connection, death, and victory surfaces are usable at desktop and narrow CSS breakpoints.

## Quality Gates

- `npm run check` passes with strict TypeScript and focused tests for each new branch-heavy rule.
- Real-browser golden-path scenarios render a canvas and required HUD state with no console error or warning.
- At 1920×1080 High quality on the validation machine: average frame time is at most 20 ms over a deterministic 10-second scene, draw calls stay at or below 650, and triangles stay at or below 180,000.
- Initial production JavaScript stays below 180 KiB gzip; procedural audio and graphics add no downloaded media payload.
- Network messages are schema-validated, size-limited, rate-limited, origin/host checked, and rejected if motion or event values exceed server bounds.
- Important feedback has both visual and audio forms; mute, volume, reduced motion, visible focus, and legible contrast are available.
- Every shipped visual family—sky/water/terrain, foliage/resources, structures, creatures, first-person viewmodel, effects, and HUD—must receive an anonymous A/B review against its prior state with identical seed, camera, time, FOV, resolution, and gameplay state. A challenger is kept only if all three fresh reviewers prefer it, the median scores at least 90/100, silhouette, grounding, material, framing, and first-person feel each score at least 9/10, and no reviewer reports a blocker.
- The final visual candidate must survive two blind comparison rounds, retain a clean console, and stay within 20 ms mean frame time, 650 draw calls, 180,000 triangles, and 180 KiB gzip JavaScript at 1920×1080 High quality.

## Art Direction Invariants

- Modern rounded 3D-cartoon forms with broad readable planes, restrained ink at hero silhouettes, stepped toon lighting, and subtle generated surface variation; never photorealistic shading.
- Procedural color textures are small, reusable, and authored in sRGB. Toon ramp data remains untagged and nearest-filtered. No downloaded visual assets are required.
- Geometry must look intentionally soft and manufactured: smooth normals on terrain and organic forms, bevel-like edge highlights on hero structures, and contact shadows that visibly anchor feet and props.
- Threats read as dark masses with one bright accent; allies read with warm lime/amber accents.
- Particles are chunky illustrated shapes with bounded pools, never photorealistic emitters.
- Warm sun-baked plains/jungle contrast with cool cyan-blue coast/highlands.
- HUD uses rounded charcoal panels, cream text, and restrained amber accents without covering the world.
- First-person hands/tools remain visible, weighted, and below the visual center. Motion includes restrained head bob, sprint sway, landing compression, damage kick, and reduced-motion equivalents.

## Visual Acceptance Rubric

| Category | Weight | Reject condition |
|---|---:|---|
| Composition and hierarchy | 15 | Objective/threat/route cannot be read in two seconds. |
| Shape language and silhouette | 15 | Primitive assembly or tangencies dominate any hero asset. |
| Material richness and contact | 14 | Surfaces look ungrounded, plastic-flat, noisy, or identical. |
| Lighting and atmosphere | 14 | Key/fill, time of day, or warm/cool depth separation fails. |
| Animation and physicality | 17 | Gait, anticipation, contact, recovery, or tool coupling feels placeholder. |
| UI integration | 12 | HUD/effects obscure play, conflict with the palette, or break at 720p. |
| First-person readability | 13 | Hands float, tool conflicts with reticle, or threats/interactions cannot be oriented. |

The rubric applies to asset families, not an unbounded catalog of individual generated instances. Reviewers receive anonymous `A` and `B` captures with randomized ordering and no version hints.

Each visual round isolates one family. A matrix or gameplay-state mismatch invalidates the comparison; the round is recaptured rather than scored. Motion families require synchronized clips in addition to still frames.

Category floors are 11/15 composition, 11/15 shape, 10/14 materials, 10/14 lighting, 13/17 animation/physicality, 9/12 UI, and 10/13 first-person readability. Missing motion evidence, copied expression, console errors, visible clipping, unexplained damage, or a technical-gate failure automatically rejects a candidate.

## Boundaries

- This release is a local/LAN cooperative vertical slice, not matchmaking, accounts, anti-cheat, persistence hosting, or a production-authoritative MMO backend.
- All shipped visuals/audio are generated by project code. Local references inform composition and engineering patterns only; non-commercial, copyleft, or license-unclear code/assets are excluded.
- Production-scale animation rigs, large content catalogs, localization, platform SDKs, and store submission are later milestones.

## Definition of Done

The slice is done only when tests and build pass, browser scenarios prove the golden path and two-client synchronization, performance budgets are recorded, accessibility settings are exercised, docs match behavior, and a clean final screenshot is captured from the shipped build.
