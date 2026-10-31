# Story 004: Choose a duck and hour while seated

> **Epic**: One Seat, One Day
> **Status**: Ready
> **Layer**: Feature
> **Type**: UI
> **Estimate**: TBD before planning
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: not started

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 1 (duck and hour choices)
**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)
**Engine**: unset (project's `@lid/diorama` WebGPU engine; version unset) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)
**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

## Acceptance Criteria

*From `design/game-brief.md` (the **Player goal & fail state** field + the MVP feature this story implements), scoped to this story.*

- [ ] While seated, the menu presents the currently available ducks by accessible name and allows a player to choose one; the displayed selection and `world.selected` identify the same live duck.
- [ ] The chosen duck is the one the player watches from the seat; the selection is observable without silently moving the camera out of the seated view, and removing the selected duck leaves a valid, clearly announced no-selection state.
- [ ] A named hour control sets the requested hour through `world.setHour` and the scene changes to that hour; the displayed value agrees with the world clock at the time of selection.
- [ ] Duck and hour controls work through keyboard, touch and screen-reader semantics; focus stays usable, Escape and the stand-up control still leave the seat, and operating controls does not also move the camera or trigger world input.
- [ ] Selecting an hour does not create a fabricated full-day observation in `createLogbook`; the normal clock can continue according to its existing state.
- [ ] The `pool-seat-choices` drive selects a live duck and at least two distinct hours through real controls, checks selection/hour and scene state via `window.__pool`, then stands and verifies focus; retain screenshots of the choices and resulting scene and inspect them.

## Implementation Notes

- `src/pool/index.js` `sit`, `setFollow`, `draw`, `window.__pool` and `world.selected`: bind the existing seat shell to live duck IDs, clearing stale choices; retain seat view rather than existing free-camera follow behavior.
- `src/pool/world.js` `W.setHour`, `W.setDayRun`, `W.day` and `src/pool/logbook.js` `watchDay` are existing; use them instead of a second clock. `src/pool/navigation.js` owns shortcut isolation.
- Add `tests/seat-choices.test.mjs`, extend `tests/logbook.test.mjs`; add `.claude/skills/verify/drive/pool-seat-choices.js`.
- Use plain placeholder styling only; visual design (colours, fonts and shapes) is on hold. Page text is English; mobile follows web. Do not copy a reference. Projects never import from each other; share only via `packages/` when warranted.
- Simulation randomness comes from a seed and time from the caller (`scripts/check.mjs` seeded-sim). Any test wall-clock limit uses `tests/budget.mjs` `budget()`.

## Out of Scope

- Races and duck customization are outside the brief; additional collectibles and summoning are Stories 005–006.

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

## Test Evidence

**Story Type**: UI
**Required evidence**: Node choice and day-observation tests plus `pool-seat-choices.js`; retain `production/qa/evidence/seat-choices.png` and `seat-hour-scene.png`, probe log and inspection notes.

- Build the project and run the named drive against `projects/rubber-duck-pool/dist` with `node packages/dev-kit/probe.mjs --serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat .claude/skills/verify/drive/pool-seat-choices.js)"` and `--shot` for each retained state; record exit code and visually inspect each screenshot. Drive the actual controls; use the hook to observe or set up deterministic preconditions.
- Tests are explicitly required by this brief handoff even though the minimal studio QA default waives tests. Keep evidence distinct from a human visual approval and from mobile/device or screen-reader testing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001 (it needs only the seated menu; the brief's build order still puts it after Story 003)
- Unlocks: None
