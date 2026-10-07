# QA Evidence

## Current assessment — 2026-08-31 (Asia/Seoul)

The v23 continuation is the current source-backed checkpoint. Its engineering and runtime gates pass, but the locked visual release gate—three independent preferences, median at least 90/100, and zero visible blocker per family—is **not met**. Tests, frame time, or a cleaner A/B do not certify AAA art quality.

### Current automated and runtime evidence

- `npm run check`: **170/170 tests**, strict TypeScript, and the Vite production build pass.
- Exact production JavaScript: **689,389 bytes raw / 183,388 bytes Node level-9 gzip**, within the fixed 184,320-byte limit by 932 bytes. Vite reports 185.33 decimal kB and still emits its unsuppressed 650 kB raw-chunk advisory.
- `npm audit --omit=dev`: zero known production vulnerabilities.
- Browser smoke: **12/12** scenarios pass with zero warnings/errors—five 1920×1080 scenes, 1024/768/320 layouts, crafting, rotated building, staged taming/companion command, and live combat.
- Live combat exposed `STALKING → ALERT → WINDUP → ACTIVE → RECOVERY` and health `100 → 76 → 52`.
- Session smoke passes presence, shared world deltas, replay, and leave cleanup.
- Two isolated 1920×1080 High measurements report **7.93–7.98 ms mean**, **103.14–116.94 ms maximum**, **269 calls**, **123,744 triangles**, and 1,254–1,261 sampled frames. Maximum spikes are recorded, not hidden.

### Current visual evidence

Round 20 compared v20 with v21. World votes were B/B/A with B median 47; creature votes TIE/TIE/B with median 52; viewmodel and motion were three ties with medians 47 and 30. Every family failed the 90/no-blocker gate. Reviewers identified v21's oversized scenic masses, toy-like anatomy, tube fingers, weak weapon motion, and enormous opaque salmon hit polygons.

Round 21 compared v21 (A) with v22 (B) across four 1920×1080 scenes, 25 isolated assets, and a 185-frame combat clip. The three ballots split overall A/B/A. B-family medians were 52 world, 44 creatures, 42 viewmodel, and 39 motion/FX; all three reviewers preferred A's `lightHit`, which v22 had made nearly invisible. B reduced route occlusion and the largest combat polygons, but every family remained below 90 with visible blockers.

Round 22 isolated that regression: v22 was A and v23 was B; 23/25 asset PNGs were byte-identical and only `lightHit`/`heavyHit` changed. The art director scored combat motion/FX 34/39, animation lead 43/49, and release critic 44/48. All three preferred B, but B's median **48** and multiple visible blockers fail the absolute gate. Persistent blockers include prototype creature anatomy and mass transfer, malformed hands/grips, weak spear contact/recoil and target response, detached polygon FX, sparse environments, and camera/target occlusion. See [`LOOP6-REVIEW.md`](./LOOP6-REVIEW.md) for mappings and evidence paths.

The retained v23 change is deliberately narrow: distant/outgoing world contacts use a readable 0.60 impact scale while camera-close incoming player damage stays at 0.35; tame effects remain unaffected. A RED regression test proves the contexts differ, and the browser combat path proves health, attack phases, and diagnostics remain stable. This is a verified relative improvement, not a Steam or AAA release claim.

## Historical v4 checkpoint — 2026-08-24

The following measurements and review describe v4 only; they are not a present-day shipping approval.

## Automated Evidence

- `npm run check`: pass.
- Node test runner: 74/74 tests pass across survival, mission and session ordering, crafting/building, staged taming, telegraphed attacks, collision/line-of-sight, pooled effects, creature anatomy/gaits, toon materials, viewmodel bounds, procedural generation, accessibility, persistence migration, settings, and relay trust boundaries.
- Strict TypeScript: pass with `strict` and `noUncheckedIndexedAccess`.
- Vite production build: pass; main JavaScript is 642.96 kB raw / 169.39 KiB gzip, below the 180 KiB gzip gate.
- `npm run smoke:session`: pass with live WebSocket clients covering presence, shared world deltas, late-join replay, and leave cleanup.

## Chromium Evidence

Verified at 1920×1080 High against `http://127.0.0.1:4173`:

- Default, lineup, coast, night, tame, boss, and victory scenarios all reached `data-game-ready="true"` with zero console warnings and zero errors.
- Boss remained at health 100 for the fixed capture; hidden scenario actors no longer target, signal, damage, or leak into encounter UI.
- Tame exposed `TRUST 2/3`; victory reached mission stage `complete` and rendered time `7:03`, gathered `8`, built `2`, defeated `1`.
- Night displayed layered red/amber camp and torch fire without transparent-ground ghosting; coast exposed the shoreline; lineup staged all three species at readable scale.
- 320, 620, 768, 900, 1024, and 1440 px widths produced no horizontal overflow. Objective, compact inventory, vitals, minimap, and the full hotbar remained visible at 320 px.
- During active play, `Tab` opened crafting and moved focus to its native close control; subsequent tabs reached recipes, including unavailable recipes through `aria-disabled`. Menus retained native `Tab` behavior without opening crafting.
- Five anonymous A/B rounds were run. The final round used three fresh-context reviewers; all preferred the release candidate and scored it 87, 87, and 86, clearing the locked 86 gate and every category floor.

## Performance Evidence

Locked high-quality run with all eight creatures visible, one active tab:

| Metric | Result | Budget |
|---|---:|---:|
| Mean frame time | 8.38 ms | ≤20 ms |
| Maximum sampled frame | 32.40 ms | recorded, not a fail gate |
| Render calls | 325 | ≤650 |
| Triangles | 176,572 | ≤180,000 |
| Sampled frames | 1,194 | — |
| Procedural detail instances | 1,055 | — |
| Creatures / resources / landmarks | 8 / 50 / 2 | — |

## Five-Axis Review

- **Correctness:** the gather/craft/build/tame/fight/day-night/victory chain, save/restore, and session co-op are connected end to end; hidden actors cannot affect deterministic art scenarios. Remote apex defeat uses the same idempotent progression path as local and companion defeat.
- **Readability:** survival rules, generation, creature behavior, effects, viewmodel, persistence, UI, protocol, and orchestration remain narrow modules with deterministic tests.
- **Architecture:** the TypeScript/Three.js/`ws` stack is retained; no new runtime dependency, copied asset pack, or speculative renderer migration was introduced.
- **Security:** origin/host, 4 KiB payload, schema, finite bounds, movement envelope, rate, invalid-strike, 64 KiB backpressure, heartbeat, local save-size/type checks, bounded canonical collections, and a 16,000-character welcome snapshot ceiling are enforced at trust boundaries.
- **Performance:** repeated assets and effects are instanced or pooled, geometry/materials are shared, hero outlines are selective, pixel ratio is capped, and the measured scene remains inside every locked budget.

## Final Ship-Audit Hardening

- Save schema v2 persists stable structure IDs; deterministic v1 migration plus one shared spatial/ID upsert prevents duplicate structures whether Continue or the relay welcome arrives first.
- Relay canonical state is capped at 64 resources, 96 structures, and 32 creatures. Oversized welcome replay discards oldest builds first; a 140-build/23-player stress case measured 15,987 characters and retained the newest state.
- Build preview uses rotated box overlap, resource/creature exclusion discs, and four-corner slope sampling. A real save scenario placed a valid foundation and advanced structure count from one to two.
- A follow-up hostile audit caught a welcome-before-Continue race. Creature continuity now merges by minimum health, monotonic death/taming/trust, then replays dead Rex progress through the shared idempotent mission path. The exact browser sequence ended at `complete`, Rex dead/0 HP, one defeat, and zero console warnings/errors.
- All seven audit findings were guarded by focused tests or real-browser checks before the full 74-test/build gate was rerun and the independent reviewer returned `SHIP PASS` with no remaining P1/P2 findings.

## Known Production Boundaries

- The relay is a bounded local/LAN session service, not hosted matchmaking, accounts, adversarial anti-cheat, or a durable authoritative world database.
- Commercial release would still require authored animation rigs, wider content/localization, platform SDKs, store assets, certification, and a broader hardware/device matrix.
- This is a polished procedural browser vertical slice that clears its locked internal release gates; it is not a claim of full-studio AAA content volume.
