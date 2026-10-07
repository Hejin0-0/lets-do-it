# Visual QA Plan — Dominions 2100

**Status:** benchmark and four review iterations completed. This delivery's score is provisional because the judge knew the sources; the reproducible blind protocol defined below remains available for an external session.

## Delivery result

The independent visual judge reviewed `empires-final-intro.png`, `empires-final-gameplay-v8.png`, `empires-final-selection-v6.png`, `empires-final-combat.png`, `empires-final-1366-v2.png`, and `empires-final-post-review.png`. The score progressed **53 → 66 → 69 → 78/100** after correcting base density, textures, water, fog of war/minimap, statistics, selection, economic activity, architecture, coastline, 1800 silhouettes, materials, and HUD adaptation at 1366×768.

| Comparison | Winner | Confidence |
|---|---|---:|
| Cover/editorial design | *Dominions 2100* | 0.96 |
| World and environmental richness | *Age of Empires II: DE* | 0.98 |
| HUD and selection | *Age of Empires II: DE* | 0.91 |

**Verdict:** the RTS vertical slice is accepted as convincing and cohesive, but not AAA. The official *Age of Empires II: DE* screenshot remains the clear winner because of its environmental richness, units, material depth, and readability in dense scenes. The remaining gap is art production—asset variety, terrain relief, animation, impacts, and formations—not a hidden build or core-flow defect. This comparison is not presented as genuinely blind: the judge knew which images belonged to the candidate. Section 3 documents how to run a truly masked test with external evaluators.

## Objective and reference standard

The review measures whether the game achieves the visual grammar of a readable historical RTS at the level of *Age of Empires II: Definitive Edition* (AoE II: DE): a coherent isometric camera, recognizable silhouettes, controlled density, terrain that explains the playable space, and a HUD that prioritizes decisions. The goal is not to copy assets, buildings, or the exact interface layout; it is to achieve comparable qualities with original resources.

Official promotional screenshots without a HUD serve as references for the world, scale, terrain, color, and lighting. The official Xbox tutorial serves as a reference for information architecture and HUD states, not as a mandate to copy its exact layout on PC/web.

### Official and primary references

Consulted on August 3, 2026.

| ID | Direct source | What it informs | Usage limitation |
|---|---|---|---|
| R1 | [Official AoE II: DE page](https://www.ageofempires.com/games/aoeiide/) | Overall visual positioning, world richness, and target sharpness | Product material; does not replace equivalent gameplay captures |
| R2 | [Official AoE II: DE visual showcase](https://www.ageofempires.com/news/visual-look-at-aoe2de/) | Declared set of high-quality gameplay screenshots | Several images omit the HUD and favor visually dramatic scenes |
| R3 | [Dense city, combat, water, and relief](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/screenshot1.jpg) | Density, hierarchy, occlusion, roads, coastline, water, and player color | Promotional scene without a HUD |
| R4 | [Japanese base in snow](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/BLUE_E5_JAPANESE.jpg) | Readability on light terrain, silhouettes, player color, and mass separation | Promotional scene without a HUD |
| R5 | [Tatar base](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/RED_S4_Tartar.jpg) | Building-to-unit scale, army readability, and faction accents | Promotional scene without a HUD |
| R6 | [Gajah Mada tropical settlement](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/camp_gajah_mada.jpg) | Coast–rock–vegetation transitions, composition, and landmark treatment | Promotional scene without a HUD |
| R7 | [Official tutorial: controls, resources, and interface](https://www.ageofempires.com/learn-to-play/controlling-your-empire-gathering-resources-xbox/) | Function and hierarchy of resources, population, age, selection, statistics, and minimap | Xbox version; compare semantics and hierarchy, not exact placement |
| R8 | [Resources, population, age, and time](https://cdn.ageofempires.com/aoe/wp-content/uploads/2023/01/1-2-3-A.webp) | Grouping, contrast, and immediate readability of critical data | Xbox tutorial crop |
| R9 | [Unit panel and statistics](https://cdn.ageofempires.com/aoe/wp-content/uploads/2023/01/1-2-7-ABCD.webp) | Portrait, health, attack, armor, range, and player color | Xbox tutorial crop |
| R10 | [Fog of war and minimap](https://cdn.ageofempires.com/aoe/wp-content/uploads/2023/01/1-4-1-ABCDE.webp) | Explored/unexplored states, world–minimap relationship, and player focus | Xbox tutorial crop |
| R11 | [Official accessibility features](https://www.ageofempires.com/age-ii-de-accessibility/) | HUD scaling, legibility panels, player color, grid, and object highlighting | Reference for principles, not a mandatory feature list |
| R12 | [Official explanation of the 2D isometric engine](https://www.ageofempires.com/news/age-empires-definitive-edition-3d-2d-game/) | Isometric heritage, asset recognition, directions, and sharpness across zoom levels | Discusses *Age of Empires: DE*; used only as technical context for the series |

## imperios-1800-2100 benchmark

### Scope, version, and limitations

The MIT-licensed repository [`alandaitch/imperios-1800-2100`](https://github.com/alandaitch/imperios-1800-2100) was audited in read-only mode at commit [`30e7ff7`](https://github.com/alandaitch/imperios-1800-2100/commit/30e7ff7f450e4fbe5813db317a1ec158bd964283). Its screenshots and code paths were compared with `empires-gameplay-c2.png`, `empires-selection-c3.png`, `empires-era1900-c3.png`, `empires-intro.png`, and the current `empires-rts` code. The irregular shoreline in C3-1900 had already been corrected in code; that capture informs only age differentiation, not the coastline's current state.

The reference is not an absolute bar. Its own report records **zero wins** in the blind pairs ([`README.md:51–65`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L51-L65)) and still acknowledges insufficient local contrast, overly bright shallow water, and building seams ([`README.md:201–206`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L201-L206)). Its first launch also takes roughly 40 seconds to generate textures ([`README.md:6–17`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L6-L17)). The benchmark therefore adopts **patterns and tests**, not large code blocks or the reference's full complexity.

### Comparative verdict

| Dimension | *Dominions 2100* | `imperios-1800-2100` | Strict conclusion |
|---|---|---|---|
| Direction and entry | The cover has a clearer editorial identity, stronger typographic focus, and a better call to action. | Opens directly into the world and prioritizes systemic demonstration. | **Preserve the current cover.** Imitating the reference's presentation offers no benefit. |
| HUD | The dark frame, age ribbon, and composition are more cohesive; several secondary labels remain at 8–10 px, and selection exposes only health and description (`src/styles.css:182–186, 240–290, 302–350`; `src/main.js:405–433`). | Exposes rates, scarcity, missing costs, statistics, and tooltips; its theme changes more substantially with each age ([`HUD.js:1214–1229`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/HUD.js#L1214-L1229), [`HUD.js:1584–1610`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/HUD.js#L1584-L1610)). | The candidate has better aesthetics but worse **information density and functional legibility**. Refine it; do not replace it. |
| Terrain and detail | Large vertex-color fields with a single noise variation (`src/world.js:95–135`); 105 conical trees and 52 rocks distributed almost uniformly (`src/world.js:281–355`). | Combines detail and macro scales on the ground and clusters vegetation around deliberate clearings ([`TerrenoShader.js:176–255`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/TerrenoShader.js#L176-L255), [`Foliaje.js:824–852`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Foliaje.js#L824-L852)). | This is the primary visual gap: in C2, the HUD looks like a product while the world looks like an early mock-up. |
| Local contrast | No reproducible measurement exists yet; the capture shows broad, smooth surfaces. | Demonstrated that global luma/chroma could fall within range while 32×32 local contrast remained at 28.3 versus 41.5 ([`README.md:94–112`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L94-L112)). | Do not treat exposure as the primary fix. The hypothesis to test is **structural mid/high-frequency detail**. |
| Water | The shader's diagonal bands (`src/world.js:186–220`) cover a large area and become the first visible pattern in C2. | Has richer depth, foam, and waves, but its own audit still flags shallow water as too bright ([`Agua.js:210–232`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Agua.js#L210-L232)). | Adopt depth/shore separation; do not adopt its brightness or the complete Gerstner system. |
| Fog and minimap | Only atmospheric fog exists (`src/world.js:441–446`); the minimap always reveals resources and enemies (`src/main.js:984–1013`). | Distinguishes unexplored, remembered, and visible areas and applies the same mask to the minimap ([`Niebla.js:1–35`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/sim/Niebla.js#L1-L35), [`Minimapa.js:304–340`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/Minimapa.js#L304-L340)). | An essential tactical layer is missing; atmospheric haze is not a substitute. |
| Feedback | Selection, tooltip, projectile, debris, and a generic color-changing pulse already exist (`src/world.js:606–617, 768–798`; `src/main.js:692–725, 831–842`). | Semantically separates move, attack, gather, and build markers ([`Efectos.js:59–67`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/render/Efectos.js#L59-L67), [`Efectos.js:1562–1591`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/render/Efectos.js#L1562-L1591)). | The foundation exists; each action still needs to be understood without reading the text log. |
| Controls | WASD/arrows, edge scrolling, `Shift`, Q/E, cursor-directed zoom, H, and `.` already exist (`src/main.js:728–734, 942–982, 1155–1173`), although the help omits several of them (`index.html:130–143`). Double-click centers rather than selecting by type. | Includes double-click selection by type and groups in addition to the same camera foundation ([`README.md:116–127`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L116-L127), [`CamaraRTS.js:117–145`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/render/CamaraRTS.js#L117-L145)). | Do not reimplement the camera. Complete RTS selection and expose what already works. |
| Ages | Names, statistics, materials, some accessories, and HUD tokens change, but C3-1900 still reads as the same world (`src/catalog.js:1–10, 52–177`; `src/world.js:542–558, 621–750`; `src/styles.css:32–61`). | Changes the full HUD palette, silhouettes, sky, water, and music through a remodel event ([`styles.css:48–211`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/styles.css#L48-L211), [`edades.js:5–45`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/data/edades.js#L5-L45), [`Edades.js:199–207`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/sim/Edades.js#L199-L207)). | Progression exists in the data but does not yet meet the threshold for visual recognition. |

### Eight highest-impact improvements achievable today

1. **P0 — Increase local contrast with a two-scale procedural ground treatment.** Keep the current `MeshStandardMaterial` and generate a small deterministic texture—grass clumps/dirt/stone detail plus macro modulation—or inject only those two signals; do not port the five-layer shader. Apply it with restrained amplitude to `src/world.js:95–135`. The reference demonstrates why detail and macro should not be mixed 50/50 ([`TerrenoShader.js:497–510`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/TerrenoShader.js#L497-L510)). **Acceptance:** using the same world crop, resolution, and mask without HUD/water, mean luma standard deviation across 32×32 tiles increases by at least 20% over C2, global luma changes by no more than 5 points, and no tiling or screen-space grain appears.

2. **P0 — Remove the dominant diagonal bands from the water.** Replace `sin((u+v)*110)` with two low-amplitude crossing waves, reserve the bright line for the already-computed coastline, and reduce the open-water pattern's opacity/brightness. Do not add Gerstner waves, refraction, or depth sampling yet. **Acceptance:** in a three-second test, nobody describes “diagonal stripes” as the first feature; units/coastline outrank the water in the visual hierarchy, and the shoreline remains continuous at two zoom levels.

3. **P0 — Add instanced ground cover organized into patches and clearings.** Reuse `InstancedMesh` for 2–3 inexpensive silhouettes—tall grass, shrubs, and low stones—controlled by low-frequency noise, with broad clearings and exclusions around footprints/the base center. The useful pattern is clustering and empty space, not raw quantity ([`Foliaje.js:1234–1310`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Foliaje.js#L1234-L1310), [`Foliaje.js:1351–1403`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Foliaje.js#L1351-L1403)). **Acceptance:** at least three masses and two clearings are legible from the initial zoom; no prop intersects buildings or resources; at 50% scale, units retain their silhouettes and no “confetti” pattern appears.

4. **P0 — Implement minimal fog of war synchronized with the minimap.** For today's slice, a 96–128² grid updated at 10 Hz is sufficient: black for unexplored, a cool veil for remembered, and transparent for visible; reveal discs around friendly entities, hide enemies outside vision, and composite the same mask over the minimap. Do not copy the reference's height, forest, persistent-memory, or post-processing systems. **Acceptance:** the three states are distinguishable without a tooltip, the minimap never reveals an enemy hidden in the world, and the boundary shows no hard cells at the initial zoom.

5. **P1 — Turn existing feedback into an order language.** Extend `createCommandFX` with type and shape: move = ring/chevron, attack = red reticle, gather = pulse with the resource's icon or shape; add a one-frame impact flash, temporary health bar, and `+N` on gathering. Do not rely on color alone. **Acceptance:** five evaluators identify move/attack/gather correctly in at least 13 of 15 one-second clips without seeing the log; each impact and gathering tick produces a visible response in under 100 ms.

6. **P1 — Make each age recognizable from the world, not just the HUD.** Define four lightweight atmosphere/sun/fog presets and one silhouette kit per age within the current factories: 1800 pitched roofs and chimneys; 1900 steel, flat roofs, and pipes; 2000 glass, antennas, and panels; 2100 elevated volumes and emissive accents. Keep the base water color coherent; change roughness, turbidity, and detail rather than tinting separate oceans. **Acceptance:** in world crops without HUD or text, at least four of five reviewers correctly order all four ages; no building is identified only by a color change.

7. **P1 — Improve HUD legibility and content without losing its visual direction.** In selection, show attack, defense, and range values already available in `catalog.js`; increase critical secondary text from 8–9 px to an effective minimum of 11 px at 1920×1080; mark only the missing resource and explain the blocked state in the button/tooltip instead of reducing everything to `opacity:.36`. Preserve the current composition, typography, and cover. **Acceptance:** critical text has a minimum contrast ratio of 4.5:1, statistics are readable at 100% zoom, and the exact reason for every blocked command can be identified without attempting to execute it.

8. **P2 — Complete RTS selection and document the actual controls.** Change double-click from “center” to “select all visible units of the same type,” add `Shift` to add/remove selection, and update help/hints with edge scrolling, acceleration, H, and `.`. Defer control groups until the current conflict between `1..9` and the nine commands is resolved; do not introduce an ambiguous mapping today. **Acceptance:** click, drag, `Shift`, and double-click pass a functional test; help matches the code, and numeric command shortcuts do not regress.

### Scope decisions derived from the benchmark

- Do not increase global exposure or saturation to “fix” contrast: the reference already demonstrated that this metric can be correct while surfaces remain flat.
- Do not port triplanar splatting, all five PBR layers, the complete 256² fog system, or the massive particle system today. Their cost and risk exceed this slice.
- Do not fill the map uniformly. Every density increase must include clearings, footprint exclusions, and a 50%-scale test.
- Preserve the *Dominions 2100* cover, typographic identity, and overall HUD architecture: they are comparative advantages, not debt.

## Minimum evidence required for scoring

The final score requires native captures with no post-capture scaling, DevTools, or cursor obscuring information. Use the same browser zoom and resolution throughout the series.

| Capture | Required state | What it makes evaluable |
|---|---|---|
| C1 | General view on load, 1920×1080 | Composition, camera, hierarchy, and complete HUD |
| C2 | Economy/populated base | Scale, terrain, resources, buildings, roads, and density |
| C3 | Selected unit and selected building, one capture of each | Selection, statistics, commands, available/unavailable states |
| C4 | Combat or the most active available state | Group silhouettes, player color, effects, and visual noise |
| C5 | Most complex biome edge, water, relief, or map boundary | Transitions, occlusion, materials, and finish |
| C6 | 1366×768, if that resolution is in scope | Cropping, overlap, legibility, and HUD adaptation |

If evidence is missing, mark the item **NE (not evaluable)**, never with an invented zero. Final acceptance cannot be issued while any critical category contains NE items. C6 is mandatory only if 1366×768 falls within the declared scope.

## 1. Weighted rubric — 100 points

Each subcriterion receives a score from 0 to 5; half-points are allowed. Points earned = `weight × score / 5`.

- **0 — absent or broken:** contradicts readability or does not exist.
- **1 — poor:** the defect dominates the experience.
- **2 — weak:** partially functional but generic, confusing, or unfinished.
- **3 — competent:** understandable and credible, with visible differences from the benchmark.
- **4 — strong:** consistently high quality and close to the reference under real conditions.
- **5 — benchmark quality:** achieves the goal as well as the relevant reference without needing to copy it.

| Category | Weight | Scored subcriteria |
|---|---:|---|
| **A. Camera, isometric geometry, and scale** | **16** | Consistent projection and axes (6); footprints, depth, and occlusion order (5); relative scale of terrain, units, and buildings (5) |
| **B. Tactical hierarchy and legibility** | **18** | Primary focus versus secondary detail (6); silhouettes and ownership/player color (5); negative space, routes, and crowding control (4); correct reading in a three-second scan (3) |
| **C. Terrain and world building** | **14** | Base material and biome palette (4); transitions, coastlines, relief, and boundaries (4); recognizable vegetation and resources (3); variation without repetition or gratuitous noise (3) |
| **D. Buildings and units** | **14** | Architectural language and building silhouettes (5); landmarks and size hierarchy (3); individual units and groups/formations (4); ground contact, pivots, and selection (2) |
| **E. Lighting, color, and materials** | **10** | Coherent light direction and shadows (4); functional contrast and saturation (3); material separation and atmosphere (3) |
| **F. HUD and information architecture** | **16** | Resources, population, age, and time (5); selection, statistics, commands, and states (4); minimap and its relationship to the world (3); density and playable-area occlusion (2); typography, icons, and contrast (2) |
| **G. Feedback and visual states** | **7** | Selection, hover, and ownership (3); construction, damage, combat, or activity (2); fog, range, grid, and disabled states where applicable (2) |
| **H. Cohesion, finish, and visual accessibility** | **5** | Consistency between world and HUD (2); technical finish, iconography, and typography (1); absence of visible breakage (1); critical information not conveyed through color alone (1) |
|  | **100** |  |

**Critical categories:** A, B, C, and F. A high decoration score cannot compensate for an incoherent camera, an unreadable scene, poor terrain, or a failed HUD.

## 2. Individual review inventory

Review each element separately and record it as **OK**, **minor**, **major**, **blocker**, **NE**, or **justified N/A**. “Not implemented” does not equal N/A when the element belongs to the displayed core flow.

### Camera and overall frame

- Isometric angle and parallelism of the two ground axes.
- Visual center, implied horizon, and amount of useful visible ground.
- Zoom level and sharpness at native size.
- Camera consistency across terrain, buildings, units, shadows, and effects.
- Front/back draw order; no intersecting sprites or meshes.
- Safe margins around the HUD and viewport edges.
- Relative scale: villager, infantry, cavalry, tree, house, town center, tower, and wall.

### Terrain, water, and resources

- Main ground surface: detail frequency and absence of a “wallpaper” texture.
- Any grass, dirt, sand, snow, or stone variants present.
- Roads and plazas: continuity, width, and connection to building entrances.
- Material blending; no rectangular cuts or halos.
- Elevation, cliffs, rocks, and passable/impassable boundaries.
- Coastline, shore, water, foam, reflection, and object contact with water.
- Individual trees and forest masses: legible edges and controlled volume.
- Gold, stone, food, and wood: silhouette, visual value, and separation from the background.
- Farms: grid, orientation, state, and legibility without competing with units.
- Environmental detail: density, repetition, scale, and compositional purpose.
- Finish at corners, map edges, and partially hidden areas.

### Buildings

- Town center or primary landmark: priority, scale, and immediate readability.
- Houses and economic buildings: visual family and functional differentiation.
- Military buildings: distinct silhouette and appropriate visual weight.
- Towers, walls, gates, and fortifications: continuity and occlusion.
- Entrances, stairs, and orientation coherent with the ground and routes.
- Player color integrated as an accent, not an accidental outline.
- Contact shadows and grounded bases; no building should “float.”
- Roof/facade detail readable at actual zoom, not only when enlarged.
- Available states: selected, under construction, active, damaged, or destroyed.
- Repetition: enough rotation/variation without losing identity.

### Units and groups

- Villagers, military units, and special units differ by silhouette.
- Size is consistent and proportional relative to doors, trees, and buildings.
- Player color remains visible on light, dark, and saturated backgrounds.
- Direction, pose, and shadow agree for each unit.
- Spacing between units; formations do not collapse into a blob.
- Weapons, mounts, and accessories do not disappear against the terrain.
- Individual and multiple selection: ring/base, outline, health bar, and priority.
- Feet, wheels, and hooves contact the ground.
- Overlap with buildings, vegetation, and effects.
- If video is provided: locomotion, turning, attack, idle, and animation cadence.

### Hierarchy and tactical readability

- Within three seconds, the landmark, military force, resources, and primary route can be located.
- Ally, enemy, and neutral are distinguishable without reading text.
- Decorative terrain is distinguishable from operational terrain.
- Interactive objects outrank background detail.
- The brightest color belongs to important information or action.
- Dense areas preserve gaps, routes, and silhouettes.
- Focus does not depend on a single excessive glow, bloom, or outline effect.
- At 50% scale, the scene's overall structure remains understandable.

### HUD and interface

- Wood, food, gold, and stone: icon, value, order, and visual update.
- Current/maximum population, age, and time: grouping and priority.
- Portrait/name of the selected object and player color.
- Health, attack, armor, range, and any other available statistics.
- Command buttons: icons, labels, affordance, and target size.
- Normal, hover, pressed, selected, disabled, and unaffordable states.
- Production queue/progress, if present.
- Tooltip: contrast, position, width, and no occlusion of the relevant action.
- Minimap: orientation, terrain, units, buildings, resources, and current viewport.
- Chromatic and spatial correspondence between minimap and world.
- Alerts, objectives, messages, and transient feedback, if present.
- Separation between decorative framing and actionable information.
- Typography: native size, tabular figures where helpful, and antialiasing.
- Text contrast supported by a panel or another stable backing over any background.
- Adaptation at 1920×1080 and every resolution declared in scope.

### Light, color, materials, and effects

- A single plausible direction for the primary light.
- Coherent shadow length, hardness, and opacity.
- Contact shadows beneath units, buildings, trees, and resources.
- Value separation between ground, interactive objects, and backgrounds.
- Controlled saturation; player colors do not contaminate the entire scene.
- Stone, wood, metal, fabric, vegetation, and water differ by value/material.
- Ambient occlusion or equivalent depth without dirtying contours.
- Fire, smoke, dust, projectiles, impacts, and particles: scale and priority.
- Fog of war: clearly distinct unexplored, explored, and visible states.
- No banding, halos, washed-out bloom, or crushed blacks.

### Technical finish and visual accessibility

- No missing assets, broken icons, placeholder text, or invalid values.
- No seams, z-fighting, clipping, cropping, or HUD overflow.
- No uneven pixelation or accidental mixing of styles/resolutions.
- No critical data communicated only through red/green or a subtle hue shift.
- Selection and hover remain visible under deuteranopia, protanopia, and tritanopia simulation.
- Critical text retains sufficient contrast over the brightest and darkest scenes.
- The HUD does not cover the selected unit or the main action area.
- Consistent bevels, radii, strokes, shadows, icons, and spacing.

Record template:

| Element | Capture | Verifiable observation | Reference | Severity | Decision |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 3. Side-by-side comparison protocol with hidden labels

### Preparation by someone who does not score

1. Create six equivalent pairs: overview, economy, army, dense scene, terrain/water, and HUD with selection.
2. Use only official captures explicitly identified as gameplay or tutorial images; exclude concept art, cinematics, and key art.
3. Match **canvas, output resolution, and visible area** without warping, reframing, recoloring, or sharpening. If aspect ratios differ, use neutral bars and record that fact.
4. Do not try to make two different scenes contain identical objects. Match function, density, and state; for example, “medium economic base with visible units.”
5. Remove filenames, metadata, browser chrome, and captions. Preserve all relevant original HUD content inside each image.
6. Assign A/B randomly for each pair using a recorded seed. Balance the candidate's side: three times on the left and three times on the right.
7. Keep the answer key outside the score sheet until all responses are locked.

### Evaluation session

1. Use the same display, brightness, system scale, and 100% zoom. Do not enlarge beyond native size.
2. Before any analysis, view each pair for **three seconds** and record without revising:
   - first perceived focus;
   - what is passable and what blocks movement;
   - location of units, landmark, and resources;
   - player/selection and the first readable HUD value.
3. On a second pass of up to **20 seconds**, score A and B separately from 0 to 5 for isometric readability, hierarchy, terrain, scale/silhouettes, lighting/color, and HUD where applicable.
4. Only then make a forced preference for each pair on three questions: **more legible**, **more cohesive**, and **closer to the AoE II: DE visual grammar**. A tie is allowed only when no difference can be defended with a concrete observation.
5. Also review each pair at 50% scale to verify macro readability; do not use that view to judge fine detail.
6. Record confidence (`low`, `medium`, `high`) and whether the reviewer believes they recognize the reference (`no`, `probable`, `certain`) **before** revealing the key.
7. Lock the sheet, reveal the key, and add conclusions. Do not change scores after learning the identity.
8. Ideally, use three reviewers with no prior discussion and take the median. With only one reviewer, repeat after 24 hours with reordered sides; the second pass is a stability check, not an independent sample.

### Honest limits of the “blind” test

This is a **masked** test, not a genuinely blind one. A reviewer familiar with AoE II: DE may recognize its buildings, sprites, HUD, or finish even without a label. Hiding A/B reduces position, name, and expectation bias; it does not eliminate knowledge of authorship.

Nor is there a perfect match between scenes: density, faction, biome, and state differ. Official promotional screenshots may use favorable zoom levels or graphics packs and omit the HUD; tutorial crops come from Xbox. Each source therefore scores only the dimension it actually demonstrates, and the rubric's absolute score carries more weight than an isolated subjective preference.

Metrics to retain for each pair:

| Pair | Seed | Candidate A/B | Prior recognition | Δ legibility | Δ cohesion | Δ AoE grammar | Preferences | Confidence |
|---|---|---|---|---:|---:|---:|---|---|
|  |  |  |  |  |  |  |  |  |

`Δ = candidate score − reference score` on the 0–5 scale.

## 4. Acceptance thresholds and defects that require iteration

### Cumulative threshold

The version is accepted only if it meets **all** of the following:

- **88/100 or higher** on the total rubric.
- At least **80% of the weight** in each critical category A, B, C, and F.
- At least **70% of the weight** in each noncritical category.
- C1–C5 present and no critical subcriterion marked NE.
- No open blocker or major defects.
- At most five minor defects, with no three indicating the same systemic problem.
- In the masked comparison: median `Δ ≥ -0.5` for legibility and `Δ ≥ -0.75` for cohesion; at least five of six pairs within both margins.
- The result holds at the primary resolution and every resolution declared in scope.

Informational bands, which do not replace the gates above:

| Score | Verdict |
|---:|---|
| 92–100 | Visual release candidate |
| 88–91.5 | Acceptable only if all gates pass |
| 80–87.5 | Iteration required; strong foundation, not accepted |
| 70–79.5 | Substantial revision |
| <70 | Insufficient visual direction or execution |

### Blocker defects — automatic iteration

- Projection, depth, or occlusion order makes the map unreadable as a coherent isometric space.
- The player cannot quickly distinguish units, buildings, resources, passable terrain, or factions.
- Contradictory scale repeatedly causes objects to float, sink, or intersect.
- Critical HUD information is illegible, clipped, overlapping, or absent: resources, population, selection, or primary commands.
- The HUD systematically obscures the action focus or prevents the player from selecting/understanding the world.
- The minimap contradicts the world's orientation, positions, or colors.
- Broken assets, accidental empty areas, placeholder text, `NaN`/`undefined`, or visible errors.
- Critical information is communicated only through a color difference that fails under a common color-vision deficiency simulation.
- Viewport breakage within scope: overflow, undesigned bands, inaccessible controls, or essential content outside the frame.
- An effect, fog layer, shadow, or decorative layer persistently obscures the primary action.

### Major defects — acceptance blocked until corrected

- Inconsistent angle, shadow, or orientation across object families.
- Terrain with seams, dominant tiling, or visible rectangular transitions.
- A scene too empty to resemble an RTS settlement or so crowded that routes and silhouettes disappear.
- A landmark without priority, or scenery that competes with interactive units/resources.
- Player color too weak against a primary background or used as a harsh, unintegrated outline.
- Generic buildings with no functional hierarchy; units that read as indistinct dots at actual zoom.
- Flat or incoherent lighting that removes volume and material separation.
- Ambiguous HUD values, icons, or states; normal, hover, selected, and disabled states are confused.
- Fog of war, selection, or damage/activity feedback fails to communicate its state.
- The “AoE” appearance depends solely on an ornamental frame while the world, scale, and hierarchy follow a different visual grammar.
- An obvious mismatch in sharpness or finish between adjacent components.
- The same minor pattern repeated three or more times, exposing a systemic failure.

### Minor defects

Small misalignment, localized repetition, noncritical cropping, isolated shadow/icon inconsistency, or a cosmetic detail that does not change readability. Document it with an exact location; do not use “polish” as a diagnosis.

## Subsequent report format

Once the captures arrive, the review will deliver the following in order:

1. Verdict: `ACCEPT`, `ITERATE`, or `INSUFFICIENT EVIDENCE`.
2. Complete score table out of 100, with no rounding before the sum.
3. Defects ordered by severity, each with a capture and precise region.
4. Masked-pair results and observed limitations.
5. The three highest-impact visual corrections; no list of speculative extras.
