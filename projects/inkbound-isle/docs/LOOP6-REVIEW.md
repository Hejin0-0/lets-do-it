# LOOP 6: Independent Visual Evidence

## Decision rule

Final acceptance remains three independent preferences per asset family, median at least 90/100, and no visible blocker. A unanimous relative improvement is an iteration worth retaining, **not** a release pass. Reviewers use 90 for top-tier commercial polish, 70 for coherent indie quality, and 40–60 for evident prototype work.

Fixed captures use 1920×1080, High quality, the same camera, game time, seed, and frozen simulation. `capture=1` isolates multiplayer state. Reviewers receive anonymous A/B images and literal side-by-side composites, A on the left, B on the right. They do not receive chronology or implementation notes. Source inspection is forbidden during visual scoring. Scores are subjective independent judgments, not objective certification or proof of human player satisfaction.

The direct renderer is retained. The postprocess candidate lost two of three votes even after its missing tone-mapping correction; its runtime module and tests were removed. It is not hidden behind a permanent feature flag.

## Earlier comparisons retained in the record

| Round | Component | Result |
|---|---|---|
| 10 | Creature v11 vs v8 | v8 won 2/3; v11 rejected |
| 10 | Viewmodel v11 vs v10 | v11 won 3/3, median 55 |
| 10 | World v11 vs v10 | v11 won 3/3, median 55 |
| 10 | Postprocess vs direct | Direct won 2/3 |
| 11 | Creature v12 vs v8 | v8 won 2/3; v12 rejected |
| 11 | Viewmodel v12 vs v11 | v12 won 3/3, median 56 |
| 11 | World v12 vs v11 | v12 won 3/3, median 54 |
| 11 | Tone-mapped postprocess vs direct | Direct won 2/3; postprocess deleted |
| 12 | Creature v13 vs v8 | v8 won 3/3; v13 rejected |
| 12 | Viewmodel v13 vs v12 | One v13 preference and two ties; no accepted improvement |
| 12 | World v13 vs v12 | v12 won 2/3; v13 rejected |

The repeated blockers were floating nostrils, a closed slot-like mouth, detached-looking limbs, a visible body-side sleeve cap, giant pancake clouds, and a ruler-straight shadow crossing the coast. Exact v8 source could not be recovered; only renders survived. The v14 creature is explicitly a **v13-based reconstruction informed by v8 threat traits**, not a claimed exact rollback.

## Round 13: v14 geometry corrections

Blind files: `work/blind/round13-{creature,viewmodel,world}/AB-*.png`.

| Family | A | B | Art critic A/B | Technical artist A/B | Player critic A/B | Decision |
|---|---|---|---|---|---|---|
| Creature | v8 direct | v14 | 48/56 | 52/59 | 49/54 | v14, 3/3; median 56 |
| Viewmodel | v14 | v12 direct | 50/42 | 58/49 | 45/37 | v14, 3/3; median 50 |
| World | v12 direct | v14 | 44/46 | 47/49 | 44/46 | v14, 3/3; median 46 |

Retained corrections: readable open mouth and surface-seated nostrils; body-side sleeve caps entirely outside the view through sampled actions/sway; v12's better cloud/tree shapes with the oversized terrain shadow disabled. Reviewers still reject the assembled cheek/muzzle, mitten grips, primitive joints, and flat finite-looking ocean. Night world comparison was effectively tied.

## Round 14: v15 material-only challenger

Blind files: `work/blind/round14-materials/AB-{boss,lineup,coast,night}.png`. A = v15; B = v14. Geometry, lighting, and camera are unchanged.

| Reviewer | A | B | Preference |
|---|---:|---:|---|
| Art director | 56 | 44 | A |
| Technical artist | 60 | 51 | A |
| Player critic | 56 | 47 | A |

v15 wins 3/3, median 56. Repeated 4×4-pixel checker blocks were replaced by deterministic, periodically tiled, irregular three-value swaths. Stone/skin variation is quieter; wood follows lengthwise grain. Shared 64×64 maps add no draw calls or external assets. A failing checker-edge regression test was observed before implementation; the focused seven tests and full 108-test suite then passed.

Reviewers singled out cleaner standing stones, spearhead, campfire rocks, and foliage. Coast is tied: the change does not solve water or wet-sand depth. Remaining issues require shape, contact, and material-specific treatment rather than reapplying generic noise.

## Recoverability and current scope

`work/checkpoints/v14-source.tar.gz` and `v15-source.tar.gz` preserve exact source checkpoints. Earlier image-only versions cannot be honestly described as source rollbacks. No third-party art or code was copied. The source remains procedural Three.js with native Web Audio and a local/LAN WebSocket relay.

## Round 15: v16 connected head, grips, and coastal contour

Blind files: `work/blind/round15-{creature,viewmodel,world}/AB-*.png`. The actual 25 isolated asset pairs are in `work/blind/round15-assets/AB-*.png`, always A = v16, B = v15 there. Each isolated asset was inspected by one independent reviewer; the three main families were inspected by all three. Identical assets were explicitly tied, not credited as improvements.

| Family | A | B | Art critic A/B | Technical artist A/B | Player critic A/B | Decision |
|---|---|---|---|---|---|---|
| Creature | v15 | v16 | 47/53 | 48/54 | 45/48 | v16, 3/3; median 53 |
| Viewmodel | v16 | v15 | 60/43 | 60/43 | 57/43 | v16, 3/3; median 60 |
| World | v15 | v16 | 44/52 | 46/52 | 47/52 | v16, 3/3; median 52; night environment tied |

The family frames also contain unrelated component changes. Reviewers explicitly restricted each score to its named family; these are not perfectly isolated factorial comparisons. The factory fixtures use a fixed camera derived from v15 bounds, identical lighting, and the actual production factories. The source-backed v16 checkpoint is `work/checkpoints/v16-source.tar.gz`.

All 25 isolated assets failed the 90/no-blocker gate. Rex and the four hand/tool assemblies improved; parasaur, raptor, four resources, five detail assets, four building/placement assets, four effect recipes, and clouds were visually tied. The unchanged tools themselves received no improvement credit from better hands. Major blockers remain connected body/leg construction, weak foot-ground contact, uniform finger bars/hidden thumb, primitive tool mountings, broad opaque mint shallows, cone grass, and flat cutout fire. The FX critic additionally exposed black particles despite requested colors; this is being treated as a rendering defect, not a stylistic pass.

v16 integration: 123/123 tests, strict TypeScript, and production build pass. JS is 677.45 kB raw / 180.76 kB gzip in Vite decimal units (below the locked 180 KiB = 184,320-byte gzip limit). Four frozen game scenarios and all 25 asset fixtures have zero browser warnings/errors. Two sequential 1920×1080 High runs measured 8.46/8.44 ms mean, 116.50/108.40 ms maximum, 294 calls, and 123,944 rendered triangles. Performance compliance is not visual acceptance.

Both v15 and v16 boss movement clips used the same sprint/attack/strafe script. The close approach exposes feet/underside and does not constitute a cinematic-quality or live-hostile combat pass: the `boss` fixture intentionally disables attack damage/movement. A separate `combat` fixture preserves actual hostile behavior; its RED→GREEN check observed stalking, alert, windup, active, recovery, and health 100→76→52 with zero console errors.

v17 is now targeting continuous body/tail/ankle forms and terrain contact, visible opposing thumbs and constructed stone tools, narrower wet-sand/shallows, curved foliage, dimensional fire, and the particle-color defect. Its acceptance is pending fresh isolated and scene renders. The visual gate remains open.

## Rounds 16–18: v17/v18 anatomy, contact, and mechanics

Round 16's two completed blind ballots retained relative v17 improvements, but no third ballot completed and every winning family remained below 90. Winning family scores ranged from 76–81. Reviewers still saw toy anatomy, stiff symmetry, intersecting grips, sparse shoreline composition, and camera/body penetration. A missing black cell in an oversized contact sheet was traced to an empty tile rather than a rendered frame; later sheets use exactly six populated cells.

Round 17's two completed ballots disagreed overall. One preferred A 53/52 because its combat contact read slightly better; one preferred B with a winning median 50.5 because its motion and directional FX were less obstructive. Both rejected camera penetration, segmented legs, static spear presentation, generic grips, and primitive FX. Identical assets received ties.

Round 18 was an engineering audit, not a visual acceptance ballot. It reproduced 50 ms foot travel up to 0.676 m, 23–30.5° attack-entry leg snaps, and a lost moving-target hit window. The following iteration added 3D long-frame travel limits, damped locomotion-to-attack transition, and one pending active hit. Those fixes passed their tests but received no automatic visual credit.

## Round 19: v20 combat safety and FX

Blind files: `work/blind/round19-{scene,assets,motion}/`. All three reviewers inspected four scenes, all 25 assets, the motion sheet, and the full clip.

| Family | Preferences | Current-side median | Decision |
|---|---|---:|---|
| World | TIE / TIE / TIE | 52 | Fail |
| Creatures | TIE / TIE / TIE | 50 | Fail |
| Viewmodel | TIE / TIE / TIE | 44 | Fail |
| Motion + FX | B / B / B | 47 | Relative B improvement; fail |

The safer approach distance improved combat readability, but the world remained sparse and banded; creature anatomy remained puppet-like; fingers and sleeves remained tubular; spear movement and recoil were weak. Motion/FX preference did not satisfy the absolute gate.

## Round 20: v20 (A) versus v21 (B)

Blind files: `work/blind/round20-{scene,assets,motion}/`. Coverage again includes four scenes, 25 assets, and the full 185-frame video.

| Family | Release critic A/B | Art director A/B | Animation lead A/B | Aggregate |
|---|---:|---:|---:|---|
| World | 43/49 B | 44/47 B | 68/43 A | B/B/A; B median 47 |
| Creatures | 52/52 TIE | 32/32 TIE | 57/61 B | TIE/TIE/B; B median 52 |
| Viewmodel | 47/47 TIE | 41/41 TIE | 60/60 TIE | three ties; median 47 |
| Motion + FX | 27/27 TIE | 30/30 TIE | 46/46 TIE | three ties; median 30 |

v21 added useful depth, but its repeated scenic crown masses became oversized foreground boulders that hid routes and actors. All three reviewers rejected the same shared blockers: coarse dinosaur anatomy and weight transfer, sausage fingers and rigid grips, a barely readable spear attack, and opaque salmon/red impact polygons covering one-third to one-half of combat frames. Twenty-two isolated assets tied; the animation lead gave B marginal preferences for the three creatures.

## Round 21: v21 (A) versus v22 (B)

Evidence:

- Scenes: `work/blind/round21-scene/AB-{boss,lineup,coast,night}.png`
- Assets: `work/blind/round21-assets/AB-*.png` (25/25)
- Motion: `work/blind/round21-motion/AB-video.mp4`, `AB-6.png`, and `AB-action-sheet-11.png`

v22 scales only the existing 14 scenic masses, bounding fixed-view maximum screen area to 0.140–0.271 and central-route occlusion to 0.000–0.143. It caps explicit light/heavy impact pieces at 0.214/0.286 m, preserves the non-combat tame celebration, gives hostile attacks shoulder/pelvis transfer, and exposes a 0.52 s spear action instead of the previous 0.26 s universal timer.

| Family | Art director A/B | Animation lead A/B | Release critic A/B | Aggregate |
|---|---:|---:|---:|---|
| World | 49/49 TIE | 70/69 A | 51/52 B | TIE/A/B; B median 52 |
| Creatures | 44/44 TIE | 42/42 TIE | 48/48 TIE | three ties; B median 44 |
| Viewmodel | 41/41 TIE | 52/55 B | 42/42 TIE | TIE/B/TIE; B median 42 |
| Motion + FX | 36/33 A | 35/39 B | 43/39 A | A/B/A; B median 39 |

The ballots completed after the usage window reopened. Overall preferences were A/B/A. All three reviewers preferred A's `lightHit`; v22 had over-corrected the screen-covering FX and made light contact nearly disappear. Creature anatomy, hand/grip construction, coast/night richness, authored attack mass, and spear recoil remained blockers. v22 was retained for its bounded route/occlusion improvement, not accepted as AAA or Steam-ready.

## Round 22: v22 (A) versus v23 (B)

Evidence:

- Assets: `work/blind/round22-assets/AB-*.png` (25/25)
- Motion: `work/blind/round22-motion/AB-video.mp4` and `AB-6.png`
- Source capture: `work/asset-captures/v23-assets/` and `work/ab/v23-combat-motion.mp4`

The challenge changes only impact context. Distant/outgoing contacts default to 0.60 scale, while the player-centered incoming damage burst explicitly remains at 0.35. The tame celebration is still unscaled. Hash comparison found **23 identical PNG pairs**; only `lightHit` and `heavyHit` differ. The B recording began 0.20 seconds later, so that fixed capture offset alone was trimmed before side-by-side motion review; playback speed and content were unchanged.

| Reviewer | Combat motion/FX A | Combat motion/FX B | Preference |
|---|---:|---:|---|
| Art director | 34 | 39 | B |
| Animation lead | 43 | 49 | B |
| Release critic | 44 | 48 | B |

Round 22 is a unanimous **3/3 relative preference for B**, with B scores 39/49/48 and median **48**. Every reviewer selected B for both changed assets; the asset tally was B 2, A 0, TIE 23. It still fails the fixed release gate because 48 is below 90 and visible blockers remain: missing foot/pelvis mass transfer, jaw/neck separation, spear-tip/contact offset, absent target reaction and recoil, viewmodel anatomy, and polygon FX crossing the target, hands, and HUD. v23 is therefore retained as the cleaner interaction-scale balance and explicitly remains **NO-SHIP**.
