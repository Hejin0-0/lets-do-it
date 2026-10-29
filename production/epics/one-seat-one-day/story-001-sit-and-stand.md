# Story 001: Sit and stand

> **Epic**: One Seat, One Day
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: TBD before planning
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-10-29

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 1 (menu shell), feature 2
**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)
**Engine**: unset (project's `@lid/diorama` WebGPU engine; version unset) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)
**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

## Acceptance Criteria

*From `design/game-brief.md` (the **Player goal & fail state** field + the MVP feature this story implements), scoped to this story.*

- [ ] From the standing view, either of the two `P.SEATS` chairs can be activated by pointer, and an equivalent named real control can be reached and activated by keyboard or touch.
- [ ] Activation records the chosen chair and transitions the camera to its `P.SEATS` eye and look using `view.lookFrom`; after the transition the seat menu placeholder is visible beside a scene object, and focus enters it.
- [ ] The menu has an explicit English stand-up control; activating it or pressing Escape from the menu leaves the seated state, hides the menu, restores a usable standing view and returns focus to the originating control or a named fallback.
- [ ] A second sit, a stand during transition, and switching seats cannot leave a stale menu or mismatched seat and camera; pointer cancellation and focus loss clear active input.
- [ ] Menu controls are native semantic elements with accessible names and visible keyboard focus; Tab, Enter/Space and touch operate them without also moving the camera or triggering world shortcuts. Outside the controls, the player can still interact with the scene.
- [ ] The `pool-seats` browser drive exercises both chairs, keyboard entry, explicit stand and Escape, focus restoration, and menu/world input isolation; retain screenshots of seated and standing views and inspect them.

## Implementation Notes

- `src/pool/index.js`: extend existing `sit(i)`, `handlers.seat.start`, and `window.__pool` with one explicit seat/transition state, stand action and observable state; add new DOM menu shell and named seat controls.
- `src/pool/layout.js` `P.SEATS` supplies both eyes/looks; add the nearby scene object through the pool scene/prop pipeline. `src/pool/navigation.js` coordinates input ownership and cancellation; `packages/diorama/view.js` `lookFrom` supplies movement, change shared code only if required and check all projects.
- Extend `tests/navigation.test.mjs` or add `tests/seating.test.mjs` for state and input transitions; extend `.claude/skills/verify/drive/pool-seats.js` for real user controls.
- Use plain placeholder styling only; visual design (colours, fonts and shapes) is on hold. Page text is English; mobile follows web. Do not copy a reference. Projects never import from each other; share only via `packages/` when warranted.
- Simulation randomness comes from a seed and time from the caller (`scripts/check.mjs` seeded-sim). Any test wall-clock limit uses `tests/budget.mjs` `budget()`.

## Out of Scope

- Stories 003–004 supply the book and menu choices; no colour, font or object shape is decided here.

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

## Test Evidence

**Story Type**: UI
**Required evidence**: Node seating/navigation tests plus `pool-seats.js`; retain `production/qa/evidence/sit-seated.png` and `sit-standing.png`, with probe log and inspection notes.

- Build the project and run the named drive against `projects/rubber-duck-pool/dist` with `node packages/dev-kit/probe.mjs --serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat .claude/skills/verify/drive/pool-seats.js)"` and `--shot` for each retained state; record exit code and visually inspect each screenshot. Drive the actual controls; use the hook to observe or set up deterministic preconditions.
- Tests are explicitly required by this brief handoff even though the minimal studio QA default waives tests. Keep evidence distinct from a human visual approval and from mobile/device or screen-reader testing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: None
- Unlocks: Story 002, Story 004

## Completion Notes
**Completed**: 2026-10-29
**Criteria**: 6/6 passing. Deferred: real touch on a device (keyboard satisfies the criterion's "keyboard or touch"; mobile is on hold) and a real screen reader.
**Deviations**: Advisory only: the camera drift threshold 0.05 is inline in `index.js` (explained by a comment, not named); `seating.js`'s default duration and `index.js` `SIT_S` repeat `view.lookFrom`'s own 1.1. Hardcoded-strings check NOT ASSESSED (the studio cannot resolve a code root: the engine is unset on purpose); by hand, page strings are English in code, as the repo rule says. Outside the story's stated files, all valid: `seat-menu.js`, `tests/seat-view.test.mjs`, `tests/props-place.test.mjs` (every cooler checked; the overlap check judges ground-level footprints, with guard cases that still fail), and the pool chair move and the towels' offset the user asked for after the story.
**Test Evidence**: UI: screenshots in `production/qa/evidence/story-001-sit-and-stand/` (01 standing with the keyboard button, 02 pool chair seated, 03 sea chair seated), all opened and checked; the `pool-seats` drive passes; Terra's tests `seating.test.mjs`, `seat-view.test.mjs` and `props-place.test.mjs` pass; `npm run verify` exit 0. Enter/Space on the controls confirmed by the user.
**Code Review**: Skipped (solo mode)
