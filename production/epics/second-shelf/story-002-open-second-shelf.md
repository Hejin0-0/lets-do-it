# Story 002: Open the second shelf

> **Epic**: The Second Shelf
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-05

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Epic goal; brief MVP 3 to 6 (floating, boat, book, summoning) for the new six
**ADR Governing Implementation**: N/A (minimal — no ADRs)

## Acceptance Criteria

- [x] The catalogue lists twelve items on two shelves with stable ids; the first six keep their ids, order and saved finds.
- [x] While the first shelf has a missing page, a visit picks only from the first shelf, exactly as before (same seed, same item, same time, same spot). Once the first shelf is full, a visit picks from the second shelf's missing items.
- [x] Before the first shelf is full the book has six pages and behaves as before. After, it has twelve, the next pages are empty with their kind, and the book says the next shelf is open; "Every page is found." appears only when all twelve are found.
- [x] A found second-shelf item fills only its own page, survives reload (older saves included) and can be summoned into the pool at its own spot and sent back with the gull.
- [x] Node tests cover the pick, the book and the save; a browser drive with real clicks finds a second-shelf item after a full first shelf and keeps book and pool screenshots.

## Implementation Notes

- `src/pool/collectibles.js` (catalogue, shelf), `world.js` `createCollectibles` (pick) and `SUMMON_SPOTS`, `logbook.js` (pages, `complete`), `book-view.js`, `seat-menu.js` (the count line).
- Simulation randomness from the seed, time from the caller.

## Out of Scope

- Hour or duck choice changing what floats (not decided by the user).

## Dependencies

- Depends on: Story 001

## Completion Notes
**Completed**: 2026-11-05
**Criteria**: 5/5. `collectibles.js` gives each item a `shelf` and `openShelf`; `world.js` picks only from the open shelf (the first shelf's picks are unchanged: same random calls), six more `SUMMON_SPOTS`; `logbook.js` `pages` lists open shelves only; `book-view.js` shows the shelf note.
**Deviations**: Provisional for the user: the six items and titles, the note "The first shelf is full. A second shelf is open.", and that the second shelf waits for the first. Two first-choice summon spots sat on the floating rings (a node test caught it); moved clear of the toys.
**Test Evidence**: `tests/collectibles.test.mjs` (catalogue, shelf pick), `tests/logbook.test.mjs` (6 then 12 pages), `tests/book-view.test.mjs` (note), `tests/summon.test.mjs` (twelve spots); drive `pool-collectibles` now walks twelve visits by real clicks (exit 0); `pool-book`, `pool-summon`, `pool-visit`, `pool-first-bottle` exit 0. Screenshot `complete-book.png` (Page 12 of 12, "Every page is found.", Fishing village).
**Code Review**: Complete: Terra (high, read-only) found no defect new to this change; its one SHOULD FIX (a summon or Send it back saved on the next frame, lost if the page closes within that frame) is the 11-04 finding already left as is.
