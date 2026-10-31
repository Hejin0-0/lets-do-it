# Story 005: Complete the fixed collectible list

> **Epic**: One Seat, One Day
> **Status**: In Progress
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: TBD before planning
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-10-31

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 3 (remaining bottle ships and object dioramas), feature 4
**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)
**Engine**: unset (project's `@lid/diorama` WebGPU engine; version unset) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)
**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

## Acceptance Criteria

*From `design/game-brief.md` (the **Player goal & fail state** field + the MVP feature this story implements), scoped to this story.*

- [ ] A single fixed list contains multiple stable item IDs covering a bottle ship and an object diorama; each ID maps to exactly one book page, and the first bottle retains its Story 002 identity and discovery.
- [ ] Undiscovered items can appear in reachable sea and be dispatched to and returned by the boat using the same player path as the first bottle; a return fills only that item’s page.
- [ ] Uncollected items can reappear on a later visit; collected or duplicate return events cannot inflate the page count, and no failed or missed dispatch ends the game.
- [ ] Progress survives reload with working storage, including a book created before the list was expanded; invalid or unavailable storage does not crash the current visit or corrupt existing duck-book records.
- [ ] When every listed ID has been found, every corresponding page is filled and the book indicates the list is complete; before then it does not report completion.
- [ ] For identical seed and caller-supplied steps the appearance and dispatch sequence is reproducible, and existing duck rescue remains functional.
- [ ] The `pool-collectibles` drive collects at least one object diorama through the player control, checks the distinct page and completion against the list via `window.__pool`, and retains sea and book screenshots for inspection.

## Implementation Notes

- Extend the new collectible catalog/state in `src/pool/world.js` and `src/pool/rescue.js` `createRescue`/`W.sendBoat`; use stable IDs and safe water routes, preserving sea-duck rescue.
- Extend `src/pool/logbook.js` `createLogbook` for list-based discovery, versioning and old-save migration without dropping existing data. `src/pool/index.js` renders new items and the book uses the same list. Exact catalog and appearance cadence are open user decisions; use explicitly temporary fixture data for tests, not a final art decision.
- Extend `tests/collectibles.test.mjs`, `tests/logbook.test.mjs`, `tests/play.test.mjs`; add `.claude/skills/verify/drive/pool-collectibles.js`.
- Use plain placeholder styling only; visual design (colours, fonts and shapes) is on hold. Page text is English; mobile follows web. Do not copy a reference. Projects never import from each other; share only via `packages/` when warranted.
- Simulation randomness comes from a seed and time from the caller (`scripts/check.mjs` seeded-sim). Any test wall-clock limit uses `tests/budget.mjs` `budget()`.

## Out of Scope

- Pool summoning belongs to Story 006; no score, timer or forced quest.

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

## Test Evidence

**Story Type**: Integration
**Required evidence**: Node catalog, migration, seeded simulation and rescue tests plus `pool-collectibles.js`; retain `production/qa/evidence/collectibles-sea.png` and `collectibles-book.png`, probe log and inspection notes.

- Build the project and run the named drive against `projects/rubber-duck-pool/dist` with `node packages/dev-kit/probe.mjs --serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat .claude/skills/verify/drive/pool-collectibles.js)"` and `--shot` for each retained state; record exit code and visually inspect each screenshot. Drive the actual controls; use the hook to observe or set up deterministic preconditions.
- Tests are explicitly required by this brief handoff even though the minimal studio QA default waives tests. Keep evidence distinct from a human visual approval and from mobile/device or screen-reader testing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 002, Story 003
- Unlocks: Story 006
