# Story 006: Summon a collected item into the pool

> **Epic**: One Seat, One Day
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: TBD before planning
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-10-31

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 6
**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)
**Engine**: unset (project's `@lid/diorama` WebGPU engine; version unset) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)
**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

## Acceptance Criteria

*From `design/game-brief.md` (the **Player goal & fail state** field + the MVP feature this story implements), scoped to this story.*

- [ ] A filled item page offers a named summon control; an empty page cannot summon its undiscovered item and communicates that state.
- [ ] Activating the control places the matching discovered item visibly in the pool; the identity agrees with the page and the stored discovery remains filled.
- [ ] Repeated activation cannot duplicate an existing instance of the same item; a different discovered item can be summoned without changing either discovery record.
- [ ] Summoning obeys the pool’s existing interaction and simulation boundaries: it does not remove or corrupt ducks, and seeded runs with the same caller steps produce the same result.
- [ ] The summon control works by keyboard and touch, has an accessible name and state, and does not also activate world input; closing the book restores focus as in Story 003.
- [ ] The `pool-summon` drive collects or sets up a discovered item, uses the real book control to summon it, checks its identity and repeat behavior through `window.__pool`, and retains screenshots of the filled page and pool result for inspection.

## Implementation Notes

- `src/pool/logbook.js` `createLogbook` is the authority for found IDs; add a summon request to the new book view in `src/pool/index.js` and expose read-only summoned state through `window.__pool`.
- `src/pool/world.js` `createWorld` owns new item instances and pool placement; integrate pose/render through the existing pool scene pipeline without inventing final shapes. `src/pool/navigation.js` retains book input isolation.
- Add `tests/summon.test.mjs` and extend `tests/book-view.test.mjs`; add `.claude/skills/verify/drive/pool-summon.js`.
- Use plain placeholder styling only; visual design (colours, fonts and shapes) is on hold. Page text is English; mobile follows web. Do not copy a reference. Projects never import from each other; share only via `packages/` when warranted.
- Simulation randomness comes from a seed and time from the caller (`scripts/check.mjs` seeded-sim). Any test wall-clock limit uses `tests/budget.mjs` `budget()`.

## Out of Scope

- Final collectible appearance, duration and removal behavior await user direction; no mobile-first redesign.

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

## Test Evidence

**Story Type**: Integration
**Required evidence**: Node summon/book tests plus `pool-summon.js`; retain `production/qa/evidence/summon-page.png` and `summon-pool.png`, probe log and inspection notes.

- Build the project and run the named drive against `projects/rubber-duck-pool/dist` with `node packages/dev-kit/probe.mjs --serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat .claude/skills/verify/drive/pool-summon.js)"` and `--shot` for each retained state; record exit code and visually inspect each screenshot. Drive the actual controls; use the hook to observe or set up deterministic preconditions.
- Tests are explicitly required by this brief handoff even though the minimal studio QA default waives tests. Keep evidence distinct from a human visual approval and from mobile/device or screen-reader testing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 005
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-01
**Criteria**: 6/6 passing. The user confirmed by hand that the book's Summon into the pool is locked with a reason on an empty page and puts the page's own item in the pool on a found one (once however often it is pressed, a different page summoning a different item), that the item floats in the pool and can be picked up and thrown like the other toys with the ducks unchanged, and that keyboard and mouse use moves no camera and Escape gives focus back to Open the book. Deferred: real touch on a device and a real screen reader (mobile is on hold; a tap was exercised through the probe's emulated phone).
**Deviations**: Advisory only. (1) A summoned item stays until the world resets: how long it stays and how it goes away await the user (the story's Out of Scope), and the player has no way to remove one yet. (2) The pool spots (`SUMMON_SPOTS`, the fallback grid `SUMMON_GRID`, `SUMMON_CLEAR`) and the placeholder drawings (a ball for a bottle, a lifebuoy for a diorama: `COLLECTIBLE_MODELS`) are working assumptions for the user to decide. (3) The hint line sits above the page, apart from the button, and the book dialog covers part of the seated menu's text (placeholder layout, design on hold). (4) The node tests of the book's control use a hand-made DOM double, so real Space and touch activation is proven by the `pool-summon` drive only. Out of the story's named scope but needed: `book-view.js` (a key pressed in the book stays the book's until it is let go, even after the book closes: Sol's BLOCKING finding), `props.js` (a drawing per item), `packages/dev-kit/probe.mjs` (a key's auto-repeat), `pool-book.js` (the held-key check) and `.claude/skills/verify/SKILL.md`.
**Test Evidence**: Integration: `tests/summon.test.mjs` (one instance per item however often it is summoned, distinct items, copy-only list, floating in the big pool, the hand picking and throwing it, ducks unchanged against a control world, seeded replay, reset, the pose, an occupied spot passed over, every fixed spot taken), `tests/book-view.test.mjs` (the `summon` model, the control's states and focus); the `pool-summon` drive (real taps, clicks and keys, exit 0 at desktop and phone size; the pool-book held-key case fails on the pre-fix code); screenshots `production/qa/evidence/story-006-summon-into-pool/summon-page.png` (Page 1 of 3, Summon into the pool ready) and `summon-pool.png` (two balls and a lifebuoy floating apart in the big pool, ducks around), both opened and checked after the last change; `npm test` 115/115 and `npm run verify` exit 0 after the last code change.
**Code Review**: Complete: GPT-6.1 Sol (medium) reviewed 5ae37db (1 BLOCKING, 2 SHOULD FIX), all addressed in 32dbb84 (the stuck key was reproduced in a real browser first; the occupied-spot fix failed two node tests first, and its first version was caught again by the phone-size drive); Sol did not re-review the fixes. Terra (xhigh) wrote the world's summon, the drawing, the book control and the node tests.
