# Implementation Plan: Expedition Upgrade

## Strategy

Use bounded LOOP cycles: lock one observable evaluator, introduce the smallest challenger, run unit/build/browser gates, compare to the baseline, and keep or roll back. The golden path is the product; content that does not improve it is deferred.

## Baseline

- 15 unit/protocol tests pass; production JS is 568.84 KiB raw / 146.98 KiB gzip.
- Runtime traversal reports roughly 570 meshes and 29k triangles, yet the near field reads sparse.
- Gathering/crafting/building exist, but food and campfire have no utility, taming is instant, attacks lack phases, and there is no audio, save, mission completion, or victory screen.
- Multiplayer shares presence only; relay validation lacks rate, origin, heartbeat, and motion checks.

## LOOP 1 — Promise and Evaluator

- [x] Audit the reference video, current runtime, source, tests, performance shape, and local reusable skills.
- [x] Exclude incompatible/unclear licenses and avoid an unnecessary renderer or dependency migration.
- [x] Lock the golden path, visual invariants, performance budget, and evidence matrix.

## LOOP 2 — Readable Encounters

- [x] Prove mission and phased-attack rules with focused unit tests.
- [x] Add staged parasaur trust and alert/windup/active/recovery hostile AI.
- [x] Add boss/trust HUD, comic impact language, hit-stop, and camera response.
- [x] Verify deterministic tame and boss scenarios in a real browser.

## LOOP 3 — A World Worth Crossing

- [x] Add instanced grass, brush, rocks, logs, mushrooms, landmarks, stars, and biome ambience within budgets.
- [x] Add procedural Web Audio with unlock, priority/voice caps, mute, and volume.
- [x] Add food/campfire utility, torch, build rotate/reject/dismantle, and local save/continue.
- [x] Complete the objective chain and victory statistics.

## LOOP 4 — Demo Finish

- [x] Add title/pause/settings/connection polish and responsive/accessibility checks.
- [x] Share bounded world events; harden origin, payload, rate, motion, heartbeat, and backpressure handling.
- [x] Measure deterministic performance and optimize only failed budgets.
- [x] Run golden-path scenarios, three-client smoke, focused review, clean build, and final capture.

## LOOP 5 — Modern Cartoon Finish

- [x] Lock the 2026 official reference, originality boundary, asset-family rubric, blind threshold, and expanded triangle ceiling.
- [x] Establish reproducible baseline captures and runtime counters before changing rendering.
- [x] Challenge the material/light/contact foundation; run unit, build, browser, and anonymous A/B gate.
- [x] Challenge world composition, hero props, creatures, viewmodel, effects, and grounded movement in bounded slices.
- [x] Run repeated anonymous A/B rounds against the previous winner; reject every visually weaker or technically failing candidate.
- [x] Complete harsh review, responsive/golden-path regression, documentation, final capture, and target-folder sync.

## LOOP 6 — Ruthless First-Person Polish

- [x] Re-audit the shipped build and supplied video with isolated world/render, creature/viewmodel, and physics/gamefeel leads.
- [x] Lock identical-state A/B capture contracts and raise the final gate to 3/3 preference with a 90/100 median.
- [x] Replace the current highest-impact occlusion, combat-FX, attack-weight, and action-readability failures with bounded, dependency-free v22 challengers.
- [x] Reject or iterate bounded challengers through Round 22; retain v23 only as the 3/3 relative winner and record its absolute visual-gate failure.
- [x] Capture the retained traversal, creature, night, and contact evidence and synchronize the verified build.

## Risk Controls

| Risk | Control |
|---|---|
| More density multiplies draw calls | Use shared geometry/material and `InstancedMesh`; keep outline shells for hero forms only. |
| Feedback becomes noisy | Cap pooled effects/audio voices and prioritize danger over ambience. |
| AI feels unfair | Separate perception, intent, motion, and attack phases; damage only once in the active window. |
| Save/network data corrupts state | Version, whitelist, clamp, and ignore invalid data at trust boundaries. |
| Scope expands past a demo | Reject features that do not improve the 5–8 minute golden path or a locked quality gate. |
| “AAA” becomes an unverifiable claim | Report measured browser vertical-slice quality and remaining production gaps; never imply full-studio content parity. |
| Smoother assets exceed the GPU budget | Reuse geometry/materials, keep ground cover instanced, and spend triangles only on hero silhouettes. |
| Review becomes biased toward the newest version | Randomize anonymous A/B ordering and keep the mapping from the reviewer until scoring is final. |
