# Story 006: Summon a collected item into the pool

> **Epic**: One Seat, One Day
> **Status**: In Progress
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
