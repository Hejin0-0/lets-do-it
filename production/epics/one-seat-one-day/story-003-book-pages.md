# Story 003: Browse the book pages

> **Epic**: One Seat, One Day
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: TBD before planning
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-10-31

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 5
**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)
**Engine**: unset (project's `@lid/diorama` WebGPU engine; version unset) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)
**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

## Acceptance Criteria

*From `design/game-brief.md` (the **Player goal & fail state** field + the MVP feature this story implements), scoped to this story.*

- [ ] A real named control opens the book; the player can close it and return focus to its opener.
- [ ] The book shows one page for each item in the current fixed list, including a distinguishable empty page before discovery and a filled page for the bottle after its return.
- [ ] Previous and next controls reach each page in list order and cannot navigate beyond either end; the current position and disabled boundaries are conveyed to assistive technology.
- [ ] Keyboard Tab and Enter/Space and touch operate the book; Escape closes it, with focus restored and no duplicate world or camera input from a book control.
- [ ] Reloading after a stored find still shows its filled page, while an empty store shows it empty; failed storage leaves the current visit usable.
- [ ] The `pool-book` drive opens the book through the player control, checks empty and filled pages and both navigation boundaries, closes it by Escape and verifies focus; retain screenshots of both page states and inspect them.

## Implementation Notes

- `src/pool/logbook.js` `createLogbook` exposes stable ordered collectible snapshots from Story 002; no second source of discovery state. `src/pool/index.js` mounts new semantic DOM book view and reads `book`, with `window.__pool` for observation.
- Add `tests/book-view.test.mjs` and extend `tests/logbook.test.mjs`; add `.claude/skills/verify/drive/pool-book.js`. Coordinate book/menu input with `src/pool/navigation.js`.
- Use plain placeholder styling only; visual design (colours, fonts and shapes) is on hold. Page text is English; mobile follows web. Do not copy a reference. Projects never import from each other; share only via `packages/` when warranted.
- Simulation randomness comes from a seed and time from the caller (`scripts/check.mjs` seeded-sim). Any test wall-clock limit uses `tests/budget.mjs` `budget()`.

## Out of Scope

- Choosing the observed duck and hour is Story 004; expanding the list and summoning are Stories 005–006.

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

## Test Evidence

**Story Type**: UI
**Required evidence**: Node book-view and persistence tests plus `pool-book.js`; retain `production/qa/evidence/book-empty.png` and `book-filled.png`, probe log and inspection notes.

- Build the project and run the named drive against `projects/rubber-duck-pool/dist` with `node packages/dev-kit/probe.mjs --serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat .claude/skills/verify/drive/pool-book.js)"` and `--shot` for each retained state; record exit code and visually inspect each screenshot. Drive the actual controls; use the hook to observe or set up deterministic preconditions.
- Tests are explicitly required by this brief handoff even though the minimal studio QA default waives tests. Keep evidence distinct from a human visual approval and from mobile/device or screen-reader testing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 002
- Unlocks: Story 005

## Completion Notes
**Completed**: 2026-10-31
**Criteria**: 6/6 passing. Deferred: real touch on a device and a real screen reader (mobile is on hold; touch was exercised through the probe's emulated phone, and the book's roles, live region and aria-disabled ends were checked in the DOM only).
**Deviations**: Advisory only. (1) The node tests cover the page model and the stored-find cases; the dialog and its wiring to the seat menu are checked only by the `pool-book` drive (node has no DOM, no library added: Sol's third finding), and with one item in the list the view's Previous/Next are not exercised across pages in a browser until story 005. (2) The book dialog covers part of the seated menu's text in the placeholder layout (design on hold). (3) An unfound page hides its title: one constant, `SHOW_EMPTY_TITLE = false` in `book-view.js`, for the user to decide. (4) Evidence is under `production/qa/evidence/story-003-book-pages/`, not the flat names the story lists (same as stories 001 and 002). Out of the story's named scope but needed: `seat-menu.js` (the Open the book button), `packages/dev-kit/probe.mjs` and its README and `.claude/skills/verify/SKILL.md` (the probe's real browser input, `window.__input`, added after Sol's review; every project's checks ran against it).
**Test Evidence**: UI: screenshots `production/qa/evidence/story-003-book-pages/book-empty.png` and `book-filled.png`, both opened and checked; the `pool-book` drive through real input (exit 0 at desktop and phone size; it fails on the pre-fix build at the Tab-out case); `tests/book-view.test.mjs`, `tests/logbook.test.mjs`; `npm test` 89/89 and `npm run verify` exit 0 after the last code change. The user confirmed the book opens, fills after the boat's return, and still shows the found page after a reload.
**Code Review**: Complete: GPT-6.1 Sol (medium) reviewed 439f44d (1 BLOCKING, 2 SHOULD FIX), all addressed in 8acd0ce and checked by the drive; Sol did not re-review the fixes. Terra (xhigh) wrote the book view and its node tests.
