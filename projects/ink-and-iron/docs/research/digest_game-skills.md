## Three.js game skill pack: digest for the war-library build

Paths below are relative to `SK=/Users/rels/Documents/project-Library/projects/06-game-ai/threejs-game-skills/skills/`. I read every SKILL.md, every reference, the scaffold and `create_threejs_game.py`. I also looked at the scorecard anchor images.

### (a) Scaffold

**Create it:** `python3 $SK/threejs-gameplay-systems/scripts/create_threejs_game.py <dir> [--force]`. The script copies `assets/threejs-vite-game/`, leaving out node_modules, dist and artifacts. It rewrites `name` in package.json and package-lock. After that, run `npm install`.

**Locked versions** (package-lock matches the caret ranges):
- Runtime: `three 0.184.0`, `lil-gui 0.21.0`.
- Dev: `vite 8.0.13`, `typescript 6.0.3`, `@playwright/test 1.60.0`, `@types/three 0.184.1`, `pngjs 7.0.0`, `@types/pngjs 6.0.5`, `@types/node ^25.9.0`.
- npm has three 0.186.0, but `^0.184.0` stays on 0.184.x. Keep 0.184, because the shader cookbook targets r184 (for example, `RoomEnvironment()` takes no arguments).

**Scripts:**
- `dev`: vite on 127.0.0.1:5188, strictPort.
- `build`: `tsc && vite build`, with `sourcemap: true` and `chunkSizeWarningLimit: 900`.
- `preview`: port 4188.
- `test`: playwright.
- `verify:visual`: `tests/visual.spec.ts`.
- `inspect:canvas`: `scripts/inspect-threejs-canvas.mjs`, identical to the QA skill's copy.

**Who owns which folder** (`src/`):
- `core/`: `Renderer.ts`, `Loop.ts`, `InputController.ts`.
  - The renderer uses sRGB output, ACES, exposure 1.05, and PCF shadows. `resizeRenderer` caps DPR (default 2) and only resizes when the buffer size changed.
  - Loop is a single requestAnimationFrame loop. Delta is clamped to 0.05 s, then it calls `update(delta, elapsed)` followed by `render()`.
  - Input is WASD, a touch stick and a dash button. Replace it with pointer raycast picking for a board game.
- `game/Game.ts`: the orchestrator. It owns state, `installTestHooks()` and `publishDiagnostics()`.
- `entities/`: Player and Pickup, both throwaway examples.
- `systems/`: AudioSystem (unlocks on the first gesture, oscillator SFX), CameraRig, CollisionSystem, DebugTools, Hud (DOM + WAAPI flash).
  - DebugTools puts lil-gui behind `?debug`.
- `utils/`: `random.ts` (mulberry32 `createSeededRandom(seed)`) and `dispose.ts`.
- The graphics skill suggests adding `src/assets/{MaterialLibrary,ProceduralTextures,DecalShapes}.ts`, `src/assets/modelFactories/*`, and `src/systems/{LightingRig,RenderPipeline,VfxSystem,QualityDiagnostics}.ts` (`$SK/threejs-aaa-graphics-builder/references/authoring-recipes.md`).
  - Factories return `{root, collision?, lod?, bounds?, diagnostics?}`.

**Deterministic test hooks** (`src/game/Game.ts`, typed in `src/vite-env.d.ts`):
- `window.__THREE_GAME_TEST_HOOKS__ = { seed(n), setState(name) → {state:name}, setPausedForScreenshot(bool), setReducedMotion(bool), hideDebugUi(bool) }`.
- `setState` must actually apply the state and throw on unknown names. The scaffold only knows `active-play` and `complete`. Add real states: `player-turn`, `enemy-turn`, `artillery-resolve`, `victory`, `defeat`, `library-overview`.
- `setPausedForScreenshot` stops the simulation straight away while rendering keeps going.
- `setReducedMotion` freezes ambient animation (candle flicker, dust). It must apply without a simulation tick.
- `window.__THREE_GAME_DIAGNOSTICS__` has `{frame, elapsed, score, targetScore, complete, player.position/speed, renderer{calls,triangles,geometries,textures}, canvas{…dpr}}`. Publish it every update, and add the turn number, phase, victory points and the selected unit.
- Every random draw, including audio pitch variance, goes through `this.rng`. `Math.random`, `Date.now()` and `performance.now()` are banned in gameplay and effects code.

**Production build:** `npm run build && npm run preview`, then test the preview, not the dev server (`$SK/threejs-qa-release/references/release-checks.md`).

**Single self-contained HTML:** yes, and it is cheap.
- Easiest route: `npm i -D vite-plugin-singlefile@2.3.3`. I checked with `npm view` that its peer range includes `vite ^8.0.0`. Add `plugins:[viteSingleFile()]` and set `build.sourcemap:false`.
- It works because every asset is procedural, so nothing is fetched at runtime. An inline module script runs from `file://`.
- Route without a new dependency: set `base:'./'`, `build.assetsInlineLimit: 1e9` and `cssCodeSplit:false`. Then a roughly 15-line node post-build script replaces `<script src=assets/*.js>` and `<link rel=stylesheet>` in `dist/index.html` with inline content.
- Expect about 700 KB of three.js after minification.

### (b) Visual scorecard

Source: `$SK/threejs-aaa-graphics-builder/references/visual-scorecard.md`. Score active-play screenshots only, never the title screen. The scale is 0 placeholder, 1 basic, 2 premium stylized, 3 showcase.

| Category | 2 looks like | 3 looks like |
|---|---|---|
| Art direction | theme drives forms, materials, UI, world, feedback | distinct identity in every surface |
| Hero | authored silhouette, decals/trim, state cues, collision proxy | memorable layered model with expressive feedback |
| Obstacles/enemies | role-specific forms, telegraphs, material cues | expressive challenge geometry or varied family with anticipation |
| Rewards/interactables | authored forms, readable interaction states, UI feedback | purpose and value stay clear during motion |
| World | layered kit, fore/mid/background, scale cues | dense authored world that *aids* readability |
| Materials | shared roles, procedural decals, trim, wear | rich cohesive language, measured resource use |
| Lighting/render | intentional tone map, exposure, key/fill/rim, contact, depth | cinematic but readable, disciplined post |
| VFX/motion | event-driven VFX per event | high-impact effects that clarify gameplay and stay cheap |
| UI/HUD | genre-specific states, meters/icons, text fit | cohesive, strong hierarchy, polished transitions |
| Perf evidence | renderer counts, build QA, viewport shots, budget notes | baseline/post metrics, bottleneck notes, tradeoffs |

A 1 in any category is the stock placeholder: primitives, colours plus fog, glow, stat cards, "seems fine".

**How to map the categories onto this game** (the scorecard allows genre equivalents):
- Hero: the board and room presentation.
- Obstacles: enemy units, wire, MG nests and their threat telegraphs.
- Interactables: selectable units, order markers and objectives.
- Don't invent loot or neon to raise a score.

**Thresholds:**
- Premium: every category ≥2, average ≥2.3, renderer diagnostics reported.
- Showcase: at least six categories at 3, average ≥2.7, plus before/after performance numbers.

**Automatic failures:**
- Placeholder-dominated or empty frames.
- A primitive hero with glow.
- Gameplay roles you can't tell apart.
- A stat-card HUD.
- Fog, darkness, bloom or particles standing in for geometry. This is the midground murk the reviewer flagged.
- UI overlapping the play path.
- No real input, or no active-play shot.
- No diagnostics.

**Measured flags** (from the inspector JSON):
- `colorEntropyBits` below about 3.0, or `dominantColorShare` above about 0.6: evidence against World or Materials above 2.
- `edgeDensity` below about 0.04: evidence against World and Hero above 2.
- `luminance.contrast` below about 60: evidence against Lighting above 2. This is the risk for a dark library.

**Anchors:** `scene-2.jpg` (a 2) is a tower-defence board: an authored track, a turret hero and a designed HUD, but a black void around it. `scene-3.jpg` (2.5–3) is a dense, layered runner with event VFX. Our board needs to beat scene-2: no void, and a HUD that isn't boxed stat tiles.

### (c) Recipes for the candle-lit library and the painted miniatures

Sources: `authoring-recipes.md`, `technical-art.md` and `shader-cookbook.md`, all under `$SK/threejs-aaa-graphics-builder/references/`.

**Renderer**
- `SRGBColorSpace` output and ACES tone mapping.
- Tune exposure in active play, not on the title view.
- DPR: `min(dpr,2)` on desktop, 1.5 on mobile.
- Resize updates the canvas, camera, composer and CSS together.

**Environment map**
- The pack gives `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)` plus `scene.environmentIntensity` (r184). Without an env map, brass and varnish render flat grey.
- My inference, not in the pack: RoomEnvironment is a neutral studio. For warmth, keep `environmentIntensity` low (around 0.3–0.5), or run PMREM over a small warm box scene.

**Lighting stack:** key (form), fill, rim, practicals/emissive, contact.
- Candles are emissive meshes plus a few point lights that don't cast shadows. Budget is ≤2 shadow-casting lights and a shadow map ≤2048 (mobile: 1 light, 1024).
- Give real shadows to the board, large miniatures and furniture anchors. Everything small gets a fake contact shadow: a plane with a radial-gradient CanvasTexture, `depthWrite:false`.
- Prefer emissive cues and light cards over many unmeasured dynamic lights.

**Materials** (cookbook values; roles come from the material kit):
- Brass or metal: `metalness 1, roughness 0.4, envMapIntensity 1.1`.
- Matte paint (miniatures, board terrain): `roughness 0.62, envMapIntensity 0.6`.
- Cloth (uniforms, felt, leather-ish): `MeshPhysicalMaterial` with `roughness 0.9, sheen 1, sheenRoughness 0.5`.
- Varnished wood or lacquer: glossy with clearcoat, used sparingly.
- Glass (lamps, cabinets): the cheap fake-glass recipe (`transparent, opacity .25, clearcoat 1, depthWrite:false`). Never use `transmission` on anything repeated, because it costs an extra scene render per frame.
- Flame: emissive over a dark base, `emissiveIntensity` above 1 so it feeds bloom.
- Separate roles by roughness and metalness, not by hue.

**Miniatures**
- Silhouette first: a named child hierarchy on primitive bases with extrude, lathe and tube parts.
- Collision proxy kept separate from the visual mesh.
- Unit markings as polygon-offset decals (`polygonOffsetFactor -1`).
- Vertex-colour AO baked into cavities.
- Emissive LOD signals so distant faction and state cues still read.
- Threats and rewards differ by shape and motion, not only colour. Anything shown by colour needs an icon or shape backup.

**Instancing and LOD**
- Use `InstancedMesh` for books, shelves, rivets, sandbags, wire posts and duckboards, and set `instanceMatrix.needsUpdate` once per batch.
- Add LOD only when an object spans large distance ranges, with hysteresis between levels.
- Different materials per copy cancel out the instancing savings.

**Fog:** only for depth and mood, and never to cover an empty midground. Layer silhouettes at different scales instead.

**Post chain:**
- `RenderPass → UnrealBloom(strength 0.35–0.6, radius 0.2–0.4, threshold 0.85) → vignette ShaderPass(uStrength ~0.85, uSize 0.72) → OutputPass` (always last).
- Budget is ≤2 post passes beyond render and output, and 0–1 on mobile.
- The pack has **no SSAO recipe.** Its intent is vertex-colour AO plus contact shadows rather than an extra pass.
- Grain at low opacity. Chromatic aberration only for brief impacts. Compare with post on and off.

**Shader pieces worth reusing:**
- Fresnel rim (`onBeforeCompile`) to highlight the selected unit.
- Dissolve spawn or death.
- Wind sway for banners and grass.
- Any injected material needs a `customProgramCacheKey`, and animated uniforms go in `material.userData.shader`.

**Budgets** (desktop / mobile): calls ≤300/150, triangles ≤750k/300k, geometries ≤300/200, textures ≤60/40, texture memory ≤256/128 MB. When over budget, cut post and shadows first, then cull, LOD and instance, then density.

### (d) Game feel and UI for a turn-based tactics board

Sources: `$SK/threejs-gameplay-systems/SKILL.md`, `references/genre-design.md`, `references/game-feel.md` and `references/physics-engine-selection.md`.

**Design artifacts:** a design brief, a core-loop contract and an encounter plan, written before building.
- Core loop contract: "Player does [verb] to achieve [objective] while [pressure] creates risk; success gives [reward], failure causes [cost/retry]". Each clause has to be proven in code.
- The pressure must appear in the first playable minute.

**Closest genre pattern:** tower defence and puzzle.
- The map should create placement decisions, not one obvious best tile.
- Reveal upcoming threats before they punish.
- Introduce one concept at a time and leave breathing space after peaks.

**Fun-factor tests:**
- There is a real decision in the first 30 s.
- The main mechanic can't be ignored.
- The objective is clear without reading the source.
- Failure is understandable before it happens.
- Challenge comes from combinations, not "more things".
- Rewards change strategy.
- The space shapes decisions.

"Graphics do not fix missing dynamics."

**Physics:** stay on ladder rung 1, custom logic with raycast picking and no Rapier.

**Feel, in order:**
1. Visible response within about 100 ms: hover highlight, select ring.
2. Response curves: the tween manager with `easeOutBack` for piece lift and place.
3. Contact feedback: impact flash on hits, pickup-style pop for captured objectives.
4. Camera trauma shake (trauma², capped at 1, decay 1.4/s): about 0.4 for a hit and 0.7 for a barrage.
5. Audio fires on the same frame, with ±6% pitch from the seeded RNG. Duck ambience on big hits.

Hitstop (60–90 ms at 0.05× time scale) only for heavy events, and it scales the gameplay delta, not the render loop. The feel code never blocks input. Heavy shake and strobe need a reduced-motion fallback.

**UI** (`$SK/threejs-game-ui-designer/references/ui-patterns.md`):
- Hierarchy: status → objective → feedback → flavour.
- Zones: objective, turn and phase top-left; score, VP and pause top-right; event banners centre-top; diegetic markers in the world.
- Fixed-width numerals.
- Icons plus short labels; meters instead of stat cards.
- Menus put the primary action first (End Turn, Retry).
- Hover, pressed, focus and disabled states on everything interactive.
- State inventory: play, pause, settings, fail/retry, win, loading.
- UI reads one source of truth and dispatches intents.
- Touch targets about 44 px. Handle `pointercancel` and `lostpointercapture`; scope `touch-action` to controls and the game surface.
- Debug UI is gated.
- Carry world motifs into the UI (brass and parchment, faction marks), and never cover the play path.

### (e) QA and evidence workflow

Sources: `$SK/threejs-qa-release/SKILL.md` plus `references/*`, and `$SK/threejs-game-director/references/evidence-manifest.md`.

1. Keep `artifacts/game-progress.md` up to date throughout.
2. Run `npm run build` (includes `tsc`), then capture console and page errors on dev and on the preview.
3. Declare the capture set in `artifacts/evidence.json` before capturing. It has a `runId` and `captures[{mode:desktop|mobile, state, report}]`: active-play desktop and mobile, plus `victory`, `defeat` and `enemy-turn`. Don't drop a slot because it failed.
4. For each capture, run `node scripts/inspect-threejs-canvas.mjs --url http://127.0.0.1:5188 --out artifacts/pass-1 [--mobile] --state <s> --seed 42 --run-id pass-1`.
   - Desktop is 1280×720 at DPR 1.
   - Check `gpu.softwareRendered`. Chromium must use `channel:'chromium'`, otherwise it falls back to SwiftShader and the FPS numbers are fiction.
   - Cite `metrics` and `renderBudget` in the scorecard.
5. Run `python3 $SK/threejs-game-director/scripts/check_evidence.py . --manifest artifacts/evidence.json`. It only proves coverage, not quality.
6. Bot playtest: copy `tests/bot-playtest.template.ts` to `tests/bot-playtest.spec.ts`.
   - Rewrite `INPUT_SCRIPT` as clicks: select a unit, order it, end the turn.
   - Assert frames advance, progress happens (VP or objective), softlock windows ≤2, zero errors, and a defeat state that can be retried.
   - Run two skill levels (0 ms vs 300 ms reaction delay) to check difficulty. Use `workers:1`.
7. Optional visual baselines with `tests/visual-regression.template.ts` (`maxDiffPixelRatio 0.015`).
8. Exercise real input (not only hooks), fail→retry, audio unlock/mute/restart cleanup, and mobile touch.
9. Score the 10 categories using the anchors, then write `artifacts/final-evidence.md`: captures, diagnostics against budget, bot JSON, scorecard, remaining gaps.
10. Final report: say that assets are procedural fallbacks because the keys are missing (`asset-recovery.md` line 28 allows this, with disclosure).

The scaffold's Playwright `mobile-safari` project needs WebKit installed. Either run `npx playwright install webkit` or switch mobile to Chromium emulation, which is what the inspector's `--mobile` already does.