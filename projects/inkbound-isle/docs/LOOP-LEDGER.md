# LOOP Engineering Ledger

LOOP is applied as Describe → Plan → Build → Play & iterate, with a locked evaluator for each challenger. Raw failures remain visible; a change is kept only when it passes held-in checks without regressing the full gate.

## Locked Evaluator

| Gate | Evidence | Pass condition |
|---|---|---|
| Rules | Node tests | New branch-heavy rules fail first, then all tests pass. |
| Build | Strict TypeScript + Vite | Clean build; initial JS ≤180 KiB gzip. |
| Runtime | Real Chromium scenarios | Canvas/HUD present; required scenario state reached; zero console warnings/errors. |
| Feel | Tame + boss scenario capture | Trust is staged; attacks signal before damage; impacts and victory are legible. |
| Performance | 10-second deterministic counters | Mean ≤20 ms; ≤650 calls; ≤180k triangles at 1920×1080 High. |
| Co-op | Two live clients | Movement and one gather/build/creature delta agree; disconnect cleans up. |
| Access | Native controls + 320px runtime | Menus focusable; mute/reduced motion work; hidden panels are inert; the full hotbar stays in view. |

## Baseline — 2026-08-23

- **Strength:** coherent toon palette, procedural island, functional gather/craft/build/combat, strict types, clean console, presence relay.
- **Weakness:** sparse near-field composition despite ~570 meshes; primitive hero silhouettes; instant tame/contact attacks; decorative survival/building; no audio/save/ending; presence-only co-op.
- **Build:** 15 tests; 568.84 KiB raw / 146.98 KiB gzip JavaScript.
- **Decision:** preserve the stack and procedural asset constraint. Improve perceptual density with instancing and improve the golden path before adding content breadth.

## Challenger Queue

1. Mission/trust/attack state machines with deterministic tests.
2. Combat HUD and pooled comic feedback in two debug scenarios.
3. Instanced ecological detail and landmarks, measured against scene budgets.
4. Native procedural audio and meaningful food/camp/build/save loop.
5. Session-world events and relay abuse resistance.
6. Full golden-path and release-candidate review.

## Iteration Trace

- **Encounter rules v1 — kept:** 19 tests pass; trust requires three feeds; raptor/apex attacks signal before one hit window and recover before restarting.
- **Encounter presentation v1 — rejected in playtest:** trust and boss HUD rendered cleanly, but the apex stopped inside its own modeled body length and occluded the camera; first-person hands also consumed too much of the lower frame.
- **Encounter presentation v2 — rejected in playtest:** increasing the stop range to 5.2 m removed the leg collision but the head still extended through the camera because the procedural tyrant's full scaled nose-to-root reach is about 5 m.
- **Encounter presentation v3 — kept:** the fixed boss capture preserves the full threat silhouette and lunge space; the spear remains readable while hands stay below the play area. Tame and boss DOM states are correct and the browser console remains clean.
- **Ecology density v1 — kept:** 1,055 deterministic detail instances across five illustrated prop families and two landmarks materially fill the near/mid field. A locked 10-second run measured 8.37 ms mean, 49.93 ms max, 450 draw calls, and 71,018 triangles.
- **Survival/continuity v1 — kept:** 26 tests pass; food, camp warmth, torch, rotate/dismantle, generated audio, versioned save/Continue, and scored victory are connected. A real non-test browser run saved, reloaded, exposed Continue, and restored inventory, torch selection, time, and campfire.
- **Session co-op v1 — kept:** origin, payload, schema, motion, rate, heartbeat, invalid-strike, and backpressure bounds protect the relay. A three-client smoke shared player state plus gather/build/creature deltas, replayed them to a late joiner, and cleaned up a leave. Three browser tabs also agreed on two remotes and one shared campfire.
- **Session recovery v1 — kept:** stopping the relay moved a live page to its solo fallback; restarting it restored `Expedition link online` through one native two-second reconnect timer.
- **Release candidate v1 — kept:** 31/31 tests, strict TypeScript, and all clean-browser scenarios pass. JavaScript is 608.34 kB raw / 157.89 kB gzip. A final high-quality 10-second run measured 8.45 ms mean, 42.07 ms max, 493 calls, and 71,946 triangles—inside every locked gate.

## Modern Cartoon Pass — Locked Before Build

- **Current official bar:** Nintendo's *Animal Crossing: New Horizons – Nintendo Switch 2 Edition*, released January 15, 2026, is used only as a general finish/readability benchmark. All project expression remains original.
- **Visual baseline:** `work/ab/baseline-boss.png`. The scene is coherent and readable but visibly faceted, hard-edged, weakly grounded, and assembled from obvious primitives; the tyrant lacks facial appeal and the first-person spear lacks hand/tool weight.
- **Technical baseline:** 31/31 tests; 608.34 kB raw / 157.89 kB gzip; 8.45 ms mean, 42.07 ms max, 493 calls, 71,946 triangles at 1920×1080 High.
- **Blind rule:** three fresh reviewers see randomized `A`/`B` captures without version labels. Keep only a blind winner with median ≥86/100, all locked category floors, an eight-point improvement, and at least two preferences in both traversal and apex play. A technical-gate failure rejects the challenger regardless of visual score.
- **Iteration order:** rendering/contact foundation → world asset families → creatures/viewmodel/physical feel → second blind comparison → five-axis release review.
- **Cartoon challenger v1 — technical pass, visual reject:** 55/55 tests and strict build pass; 1920×1080 High measured 8.37 ms mean, 41.57 ms max, 463 calls, and 177,246 triangles with zero console warnings/errors. In the anonymous apex A/B, two of three reviewers preferred the challenger, but its score median was only 64/100 against the locked 86 gate. Reviewers unanimously rejected the checker-like terrain, crushed-black/clipped apex, placeholder resource shapes, weak contact, and implausible first-person grip. The build is preserved at `work/candidate1-dist`; those five defects define challenger v2.
- **Cartoon challenger v2 — visual improvement, gate reject:** all three fresh reviewers preferred v2 over v1, but its median was 76/100. Better silhouettes and contact were kept; flat orange terrain, crushed hostile values, weak grip, and white-hot fire remained blockers.
- **Cartoon challenger v3 — regression caught and fixed:** one reviewer preferred the new art direction, while another correctly rejected severe night compositing artifacts. The cause was transparent ground paint writing through the render queue; opaque toon dabs with depth writes replaced it, and hidden creatures were excluded from targeting, UI, and simulation.
- **Cartoon challenger v3 release candidate — blind reject:** three fresh reviewers scored v3 at a 72 median versus v2 at 78; two preferred v2. The retained findings were empty foreground, weak surface differentiation/contact, and insufficient first-person embodiment.
- **Cartoon challenger v4 — SHIP:** the final challenger combines stronger authored framing, a supporting off-hand, higher-contrast six-surface procedural paint, denser route dabs, stronger contact shadows, clean two-color fire, and closer species staging. In a fifth anonymous comparison, three genuinely fresh reviewers all preferred v4 and scored it **87, 87, and 86** (median **87**); every category floor passed. The comparison target scored 63, 68, and 66. Final technical evidence after audit hardening: **74/74 tests**, strict build, **642.96 kB raw / 169.39 KiB gzip**, **8.38 ms mean**, **32.40 ms max**, **325 calls**, **176,572 triangles**, and zero console warnings/errors at 1920×1080 High. The local-session smoke passed presence, shared deltas, replay, and leave.
- **Ship audit hardening — kept:** a hostile fresh-context review found six release blockers or high-value defects. Native menu tabbing and in-game craft focus, idempotent remote apex progression, stable v2 structure IDs with deterministic v1 migration, bounded relay snapshots, rotated building footprints with resource/creature/slope rejection, and compact narrow-screen objectives/inventory were fixed at their shared roots. A follow-up audit then caught a welcome-before-Continue apex race; order-independent creature continuity plus shared defeat replay fixed it. The exact browser race, focused checks, full gate, and independent re-review all passed with no remaining P1/P2 findings.

## LOOP 6 — Current gate reopened

The historical v4 “SHIP” label above is superseded by the user's stricter first-person asset review. The final gate is now 3/3 preference, median at least 90/100, and no blocker per family. It is **not met**. Rounds 10–20 exposed regressions and kept only relative improvements; Round 20 medians were 47 world, 52 creatures, 47 viewmodel, and 30 motion/FX. Round 21 completed with overall A/B/A preferences and B-family medians of 52 world, 44 creatures, 42 viewmodel, and 39 motion/FX. Round 22 unanimously preferred v23's interaction FX, but its median was only 48 with visible blockers. The postprocess path was deleted after losing its corrected A/B. Exact v14, v15, v16, v21, v22, and v23 source snapshots preserve recoverability. See [`LOOP6-REVIEW.md`](./LOOP6-REVIEW.md) for mappings, scores, evidence, and limitations.

### v22 retained continuation

- Scenic masses: fixed-view RED occlusion values up to 0.639 screen area / 0.421 route coverage; GREEN values at most 0.271 / 0.143 after scaling the existing instances only.
- Creature attack mass: RED raptor windup compression test; GREEN shoulder/pelvis brace, drive, and recovery with existing foot-ground contracts intact.
- First-person action: the previous 0.26 s universal timer exposed only about eight spear frames; v22 uses per-tool duration with a 0.52 s spear while preserving one contact window.
- Combat FX: explicit hit pieces measured up to 0.612/0.816 m in v21; v22 caps light/heavy at 0.214/0.286 m. Integration review caught and fixed accidental tame-effect scaling.
- Technical gate: 169/169 tests, strict TypeScript/build, 183,962-byte gzip, browser 12/12, session smoke pass, 8.44–8.45 ms mean, 269 calls, 123,744 triangles, zero browser diagnostics, and zero production audit findings.
- Visual decision: retain the clear occlusion/FX improvement; do not claim 90/AAA/Steam acceptance. Remaining work is authored anatomy, hands/grips, environment richness, and production animation.

### v23 retained continuation

- Context regression: Round 21 unanimously preferred v21's readable `lightHit`; a new RED test showed v22 gave world contact and camera-close damage the same 0.35 scale.
- Minimum fix: world/outgoing light and heavy contacts now use 0.60 scale, while incoming player damage explicitly stays at 0.35; no new pool, material, geometry, or dependency was added.
- Controlled evidence: 23/25 asset captures are byte-identical. All three Round 22 reviewers preferred B for both changed assets and scored combat motion/FX 39, 49, and 48 (median 48).
- Technical gate: 170/170 tests, strict TypeScript/build, 183,388-byte gzip, browser 12/12, session smoke pass, 7.93–7.98 ms mean, 269 calls, 123,744 triangles, zero browser diagnostics, and zero production audit findings.
- Visual decision: retain v23 as the relative winner, but keep **NO-SHIP**. Contact alignment, target reaction, creature/viewmodel anatomy, authored mass transfer, environment richness, and production animation remain open.

## Rejected or Deferred

- **Renderer migration:** WebGPU/TSL would add risk without fixing the golden path.
- **External asset pack:** conflicts with the procedural-graphics promise and introduces provenance risk.
- **Non-commercial/copyright-unclear references:** excluded from shipped code/assets.
- **Production matchmaking/accounts/anti-cheat:** requires backend authority and operations beyond this local/LAN demo.
- **More species or recipes:** deferred until the existing three species and four recipes create a complete memorable run.

## Sources and Pattern Provenance

- Tesana LOOP documentation: <https://docs.tesana.ai/introduction> and <https://docs.tesana.ai/how-tesana-works>
- Three.js documentation: <https://threejs.org/docs/>
- MDN Web Audio, Web Storage, Fullscreen, and Pointer Lock documentation.
- Local MIT/Apache references informed bounded loops, instancing, staged enemy moves, audio priority, and measured polish. No source code or media was copied.
