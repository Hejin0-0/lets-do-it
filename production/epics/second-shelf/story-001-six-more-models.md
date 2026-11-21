# Story 001: Six more models

> **Epic**: The Second Shelf
> **Status**: Complete
> **Layer**: Feature
> **Type**: Visual/Feel
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-05

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Epic goal (a second shelf of six); brief art direction (items are our own models)
**ADR Governing Implementation**: N/A (minimal — no ADRs)

## Acceptance Criteria

- [x] Six new models exist as `.blend`, `.glb` and a review `.png` in `projects/rubber-duck-pool/assets/02_models/props/collectibles/`: Rowboat, Submarine and Longship in a bottle; Lighthouse island, Shipwreck reef and Fishing village. Each is at most 8,000 triangles and built by `tools/create_collectibles.py`.
- [x] They share the first six's bottle, cork, brass ring, island base and ocean skirt, the waterline frame and the material prefixes; the first six are unchanged.
- [x] `npm run assets:lookdev` turns them into `collectible-<id>` game models; lamps (lantern, lighthouse) glow.
- [x] Each reads at game size: a screenshot of all twelve in the pool, checked by eye.

## Implementation Notes

- Terra writes the generator (Codex cannot start Blender; Claude runs it and reviews the renders). Claude adds the six to `MODELS` in `tools/export_lookdev_props.py`.
- No copying a reference: our own shapes and colours.

## Out of Scope

- The catalogue, the visit pick and the book (Story 002).

## Dependencies

- Unlocks: Story 002

## Completion Notes
**Completed**: 2026-11-05
**Criteria**: 4/4. Terra extended `tools/create_collectibles.py` (two passes; Claude ran Blender and reviewed contact sheets: pass 2 gave the rowboat real sides and a bigger lantern, the longship a solid two-sided sail, the wreck a tilted planked hull with ribs, the village a soft smoke wisp). Triangles 1,768 to 3,864. The first six's files were not rebuilt. `Lamp | warm glow` maps to kind 9 and glows.
**Deviations**: The longship's cream stripes read dark behind the glass in the review render; the wreck reads as a hull only up close; at sea the low rowboat mostly hides under the half-sunk bottle's waterline, its lantern visible.
**Test Evidence**: `production/qa/evidence/second-shelf-2026-11-05/shelf-2-renders.png`, `twelve-in-the-pool.png`, `rowboat-at-sea.png`, all opened and checked by Claude; no human visual approval yet.
