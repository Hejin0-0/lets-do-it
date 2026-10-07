# Inkbound Isle Upgrade Tasks

Tasks 6–14 record the historical v4 implementation checkpoint. Task 15 reopens visual release acceptance; earlier completion labels do not certify the current build as AAA or Steam-ready.

## Task 6: Mission, trust, and fair combat

**Status:** Complete.

**Acceptance:** pure tests cover ordered mission transitions, invalid progression, three-feed taming, attack phase timing, single-hit active windows, recovery, and death.

**Verification:** `npm test`; browser `?test&scenario=tame` and `?test&scenario=boss`.

## Task 7: Dense procedural presentation and sound

**Status:** Complete.

**Acceptance:** four biomes read immediately; near field has instanced detail and two landmarks; day/night has stars/torch; accepted actions and threats have capped procedural audio plus visual equivalents.

**Verification:** deterministic scene counters, desktop/narrow screenshots, mute/reduced-motion checks.

## Task 8: Survival, construction, save, and completion

**Status:** Complete.

**Acceptance:** food and camp utility work; build preview rotates/rejects/dismantles; versioned local save restores player and structures; apex defeat opens a scored victory screen.

**Verification:** unit tests, reload/continue browser check, complete golden path.

## Task 9: Cooperative session and relay hardening

**Status:** Complete.

**Acceptance:** two clients share presence and bounded gather/build/creature events; malformed, oversized, too-fast, cross-origin, stale, and backpressured traffic is rejected safely.

**Verification:** protocol unit tests, three-client relay smoke, and three-browser shared-structure check.

## Task 10: Release-candidate QA

**Status:** Complete.

**Acceptance:** full check clean; no browser console issues; performance and bundle budgets pass; settings, responsive layout, disconnect/reconnect, death/respawn, and victory are exercised; documentation and final capture match the build.

**Verification:** evidence recorded in `docs/QA-REPORT.md` and `docs/LOOP-LEDGER.md`.

## Task 11: Reference and blind evaluator

**Status:** Complete.

**Acceptance:** official 2026 Nintendo and Three.js sources are recorded; baseline scene/counters are reproducible; the 100-point rubric, 85-point threshold, category floor, random ordering, and rejection rules are locked before implementation.

**Verification:** `SPEC.md`, `docs/REFERENCE-SOURCES.md`, baseline screenshot, and LOOP ledger entry.

## Task 12: Rounded rendering and world foundation

**Status:** Complete.

**Acceptance:** generated surface maps, expanded toon ramp, smooth organic normals, soft high-quality shadow path, contact blobs, sky/water treatment, foliage/resource silhouettes, and structures improve the blind score without exceeding budgets.

**Verification:** focused tests where logic branches; `npm run check`; clean desktop/narrow browser captures; 10-second counters; anonymous A/B round one.

## Task 13: Expressive creatures and physical feel

**Status:** Complete.

**Acceptance:** all three species gain intentional rounded anatomy, faces, grounded feet, idle/gait/attack appeal, and preserved threat accents; viewmodel motion and simple collision/knockback eliminate obvious clipping and weightlessness.

**Verification:** pure collision/attack tests; tame/boss/runtime captures; reduced-motion check; anonymous A/B round two.

## Task 14: Ruthless release review

**Status:** Historical v4 checkpoint; current release acceptance reopened by Task 15.

**Acceptance:** independent reviewers find no critical issue across correctness, security, performance, maintainability, and UX; every shipped visual family meets the rubric; golden path, multiplayer smoke, save/continue, responsiveness, and accessibility remain clean.

**Verification:** final `npm run check`, browser matrix, measured performance/bundle report, QA/LOOP evidence, final screenshot, and synchronized target folder.

## Task 15: Ruthless first-person polish loop

**Status:** v23 vertical slice verified; visual release gate remains open (NO-SHIP).

**Acceptance:** isolated asset-family challengers fix the audited world depth, creature massing, hand/tool contact, visible melee timing, grounded locomotion, and deterministic directed effects. Every retained family wins a same-state anonymous A/B vote 3/3 with median at least 90/100 and no blocker while preserving the locked technical budgets.

**Verification:** v23 focused RED/GREEN plus `npm run check` pass at 170/170; browser matrix 12/12 and session smoke pass; console 0/0; 7.93–7.98 ms mean, 269 calls, 123,744 triangles; JavaScript 183,388/184,320 bytes gzip. Round 22 preferred v23 3/3 but scored a 48 median with visible blockers. The non-destructive target sync completed and `npm run check` plus the exact gzip gate passed from `/Users/rels/Documents/prep/prompt-test/inkbound-isle`.
