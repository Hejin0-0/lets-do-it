# Story 002: Fetch the first bottle

> **Epic**: One Seat, One Day
> **Status**: Ready
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: TBD before planning
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: not started

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP features 3 and 4 (first bottle)
**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)
**Engine**: unset (project's `@lid/diorama` WebGPU engine; version unset) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)
**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

## Acceptance Criteria

*From `design/game-brief.md` (the **Player goal & fail state** field + the MVP feature this story implements), scoped to this story.*

- [ ] Starting from an empty collection, one identified bottle can appear adrift in reachable sea; the same seed and caller-supplied steps reproduce its appearance and position.
- [ ] A player can discover the bottle and send the moored boat to it through a real accessible control; the boat visibly travels to it and returns before the corresponding page is recorded.
- [ ] A completed return fills exactly the bottle’s one page; sending again, duplicate completion events or repeated observation do not add another page or duplicate progress.
- [ ] If no target or no water route is available, or the boat is busy, dispatch does not falsely record a find; an uncollected bottle can appear again on a later visit, with no fail state.
- [ ] A completed find survives a reload when storage works; blocked, throwing or malformed storage does not crash play and the in-memory find remains usable for that visit.
- [ ] The `pool-first-bottle` drive uses the player dispatch control, observes the outward and return states and the recorded page through `window.__pool`, and retains screenshots of the bottle/boat and completion for inspection.

## Implementation Notes

- `src/pool/world.js` `createWorld`, `W.step`/`advance`, events and new collectible state: accept seeded randomness and caller time; add one stable item ID and reachable sea appearance. `src/pool/rescue.js` `createRescue` / `W.sendBoat` currently targets sea ducks only: extend its target/return contract without breaking duck rescue; a returned-item event is new.
- `src/pool/logbook.js` `createLogbook`/`observe` currently stores duck designs, hats, stamps and records, not collectible pages: add a versioned compatible persistent find record and preserve existing records. `src/pool/index.js` wires real dispatch control, rendering and event consumption exactly once and exposes read-only proof through `window.__pool`; new bottle drawing/pose as needed.
- Add `tests/collectibles.test.mjs` and extend `tests/logbook.test.mjs` and `tests/play.test.mjs`; add `.claude/skills/verify/drive/pool-first-bottle.js`.
- Use plain placeholder styling only; visual design (colours, fonts and shapes) is on hold. Page text is English; mobile follows web. Do not copy a reference. Projects never import from each other; share only via `packages/` when warranted.
- Simulation randomness comes from a seed and time from the caller (`scripts/check.mjs` seeded-sim). Any test wall-clock limit uses `tests/budget.mjs` `budget()`.

## Out of Scope

- Full book view belongs to Story 003; additional items and pool summoning belong to Stories 005–006.

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

## Test Evidence

**Story Type**: Integration
**Required evidence**: Node collectible, logbook and rescue tests plus `pool-first-bottle.js`; retain `production/qa/evidence/first-bottle-sea.png` and `first-bottle-return.png`, probe log and inspection notes.

- Build the project and run the named drive against `projects/rubber-duck-pool/dist` with `node packages/dev-kit/probe.mjs --serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat .claude/skills/verify/drive/pool-first-bottle.js)"` and `--shot` for each retained state; record exit code and visually inspect each screenshot. Drive the actual controls; use the hook to observe or set up deterministic preconditions.
- Tests are explicitly required by this brief handoff even though the minimal studio QA default waives tests. Keep evidence distinct from a human visual approval and from mobile/device or screen-reader testing.

**Status**: [ ] Not yet created

## Dependencies

- Depends on: Story 001
- Unlocks: Story 003
