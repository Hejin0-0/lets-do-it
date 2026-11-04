# Story 005: Complete the fixed collectible list

> **Epic**: One Seat, One Day
> **Status**: Complete
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

## Completion Notes
**Completed**: 2026-10-31
**Criteria**: 7/7 passing. The user confirmed by hand that a return fills only what the boat took (the diorama included), that "Every page is found." shows only after the last page, and that found pages survive a reload. Not tried by hand: a real browser holding an old save made before the list grew (checked by node tests only), real touch on a device and a real screen reader (mobile is on hold).
**Deviations**: Advisory only. (1) The catalogue (three temporary entries in `collectibles.js`), the appearance window (15 to 45 s), the spacing (`COLLECTIBLE_SPACING` 2), the aboard offset (`COLLECTIBLE_ABOARD_OFFSET` .4) and the placeholder drawings (a ball for a bottle, a lifebuoy for a diorama: `COLLECTIBLE_MODELS`) are the assistant's working assumptions for the user to decide. (2) `createCollectibles` throws when no reachable spawn with enough spacing is found rather than overlap items; Sol confirmed the page's seed 14 and `W.reset` are fine, a future seed or terrain change could still hit it. (3) New items appear in the east fan by the jetty, mostly out of view from both chairs (carried over from story 002). (4) The book dialog covers part of the seated menu's text in the placeholder layout. (5) Evidence is under `production/qa/evidence/story-005-collectible-list/`, not the flat names the story lists. Out of the story's named scope but needed: `seat-menu.js` (the count line says "Every page is found."), `props.js` (a drawing per kind, items aboard apart), `book-view.js` (the completion line), `pool-book.js` and `pool-first-bottle.js` (no longer assume a one-item list) and `.claude/skills/verify/SKILL.md`. `rescue.js` was not changed: one trip already takes everything adrift.
**Test Evidence**: Integration: `tests/collectibles.test.mjs` (catalogue, the first bottle's time and spawn pinned for seeds 3, 5, 7 and 11, reproducibility, spacing, one trip with several items, a diorama alone, later visits, duplicates, failed dispatch, poses), `tests/logbook.test.mjs` (v1, a v2 saved with one item, a retired page id, throwing storage, `complete`), `tests/play.test.mjs`, `tests/book-view.test.mjs`; the `pool-collectibles` drive (real clicks, exit 0; it fails when the open book's refresh is disabled); screenshots `production/qa/evidence/story-005-collectible-list/collectibles-sea.png` (a lifebuoy and a ball adrift, the boat carrying a ball) and `collectibles-book.png` (Page 3 of 3, "Every page is found.", First diorama), both opened and checked; `npm test` 107/107 and `npm run verify` exit 0 after the last code change.
**Code Review**: Complete: GPT-6.1 Sol (medium) reviewed b2cfe71 (0 BLOCKING, 2 SHOULD FIX), both addressed in b1796e3 (a stored book with a page id no longer in the list lost the whole book: a node test failed first; the drive now watches the completion line appear in the open book); Sol did not re-review the fixes. Terra (xhigh) wrote the list, spacing, completion, drawings and node tests.
