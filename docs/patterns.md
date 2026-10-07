# Patterns — what we reuse, and where it lives

The names are from Robert Nystrom's *Game Programming Patterns*. A pattern moves into
`packages/` only once **two projects** carry the same code. Until then it stays in its project
and is listed here, so the next project can copy it on purpose.

## Shared packages (`packages/`, `@lid/*`)

| Package | Pattern | What it gives | Used by |
|---|---|---|---|
| `@lid/loop` | Game Loop · Update Method | `new Loop(update(dt, t), render, maxDt)`: one rAF loop with dt clamped, so a tab coming back does not fast-forward the world. `stop()` is what a hub `unmount()` calls | ink-and-iron, template |
| `@lid/random` | (determinism) | `createSeededRandom(seed)` and `draw(state) → [value, next]` (mulberry32): same seed, same world, test and baseline | ink-and-iron (room, board, rules, AI), inkbound-isle (world), template |
| `@lid/storage` | (fail-soft persistence) | `readStored(key, parse, fallback)`, `writeStored`, `removeStored`: a private window or full quota never throws; saving stays a convenience | ink-and-iron (campaign, mute), inkbound-isle (save, settings), template |
| `@lid/dev-kit` | (tooling) | `lid-probe`: opens a page in headless Chrome, runs an `--eval` script, prints the console | ink-and-iron (`scripts/probe.mjs`) |

Each package is TypeScript source (`"exports": "./index.ts"`). A project depends on it as
`"@lid/x": "file:../../packages/x"`: Vite bundles it, Node's test runner strips its types, and
the project keeps its own lockfile. Each package has a `*.test.ts` beside it; run them all with
`npm run test:packages` from the root.

## Patterns still inside one project

| Pattern | Where | Note |
|---|---|---|
| Command | ink-and-iron `src/rules/apply.ts` (`apply(state, action)`: pure, throws on illegal), Undo/Rewind in `src/game/Game.ts` | Actions are plain data, so undo is a state snapshot (`structuredClone`) and replay is free |
| State | ink-and-iron `src/rules/phases.ts` (`GameState.phase`) | Phases are data on the state, not classes |
| Observer / Event Queue | ink-and-iron `src/contract/bus.ts` (typed pub/sub: UI intents in; state, fx and audio cues out), `src/game/EventPlayer.ts` (plays a turn's events one beat at a time) | The only runtime coupling between modules |
| Flyweight | `InstancedMesh` in ink-and-iron `src/board/Pieces.ts`, `board/TerrainKit.ts`, `room/Books.ts`, `room/Candles.ts` | One geometry and material, many instances |
| Service Locator | ink-and-iron `src/audio/AudioSystem.ts`, inkbound-isle `src/audio.ts` | Sound is reached through one object; mute is one switch |
| Type Object | inkbound-isle `src/gameplay.ts` | Resources and tools are data tables, not classes |
| Test hooks | ink-and-iron `src/game/TestHooks.ts` | `window` hooks drive named states for Playwright; unknown names throw; diagnostics refresh every frame |

**Next candidates for a package:** the bus (when a second project needs typed pub/sub), the
audio service (a second WebAudio project), and test hooks (a second Playwright suite).

## New project

```bash
node scripts/new-project.mjs my-slug "My Title"
cd projects/my-slug && npm install && npm run dev
```

It copies `templates/project`: `hub.json`, Vite with `base: './'` for the hub iframe, and a
three.js scene already wired to `@lid/loop`, `@lid/random` and `@lid/storage`.
