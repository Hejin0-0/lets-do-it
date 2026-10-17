# Patterns — what we reuse, and where it lives

The names are from Robert Nystrom's *Game Programming Patterns*. A pattern moves into
`packages/` only once **two projects** carry the same code. Until then it stays in its project
and is listed here, so the next project can copy it on purpose.

## Shared packages (`packages/`, `@lid/*`)

| Package | Pattern | What it gives | Used by |
|---|---|---|---|
| `@lid/loop` | Game Loop · Update Method | `new Loop(update(dt, t), render, maxDt)`: one rAF loop with dt clamped, so a tab coming back does not fast-forward the world. `stop()` is what a hub `unmount()` calls | ink-and-iron, dominions-2100, wobble-rush-3d, template |
| `@lid/random` | (determinism) | `createSeededRandom(seed)` and `draw(state) → [value, next]` (mulberry32): same seed, same world, test and baseline | ink-and-iron (room, board, rules, AI), inkbound-isle (world), night-street (street layout), template |
| `@lid/storage` | (fail-soft persistence) | `readStored(key, parse, fallback)`, `writeStored`, `removeStored`: a private window or full quota never throws; saving stays a convenience | ink-and-iron (campaign, mute), inkbound-isle (save, settings), wobble-rush-3d (best time, character), template |
| `@lid/diorama` | Update Method · Flyweight (one parts mesh, posed per instance) | The jelly-block diorama engine: shallow water with bodies of water at their own levels, the tippable block, rigid floaters, vessels, bubbles and foam, a parts mesh and its renderer (WebGPU), the page and its input. JavaScript, not TypeScript: it came out of jelly as it was (see below) | jelly (10–13), rubber-duck-pool |
| `@lid/dev-kit` | (tooling) | `lid-probe`: opens a page in headless Chrome, runs an `--eval` script, prints the console | ink-and-iron (`scripts/probe.mjs`) |

Each package is TypeScript source (`"exports": "./index.ts"`), except `@lid/diorama`, which is plain JavaScript with JSDoc (moved out of jelly as it was; its modules are imported one by one, `@lid/diorama/water.js`) and `@lid/dev-kit` (a Node tool). A project depends on it as
`"@lid/x": "file:../../packages/x"`: Vite bundles it, Node's test runner strips its types, and
the project keeps its own lockfile. Each package has a `*.test.ts` beside it; run them all with
`npm run test:packages` from the root.

**infra-diorama** uses none of them, on purpose: it runs on React Three Fiber, whose
`useFrame` owns the loop, and it has no seeded randomness or storage. night-street keeps its
own `frame()` because its adaptive resolution samples the raw, unclamped frame time.

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
| Type Object · Template Method | jelly `src/specimens/*` + `src/core/jelly/page.js` | The study-page jellies (01–07) are data (words, markup, material WGSL) plus a few hooks; one page logic and one renderer run them all |
| Strategy · plugins | jelly `src/core/jelly/renderer.js` (`skin: 'ring' \| 'gradient'`, `replace`, `plugins`) | A specimen swaps how the surface is skinned or one studio function, and adds passes (props, membranes, seeds) without forking the renderer |
| Resource scope | jelly `src/core/gpu.js` (`resourceScope(device)`) | A `Proxy` over the one `GPUDevice` remembers what a module allocated; `release()` frees it on unmount. A candidate for a package once a second WebGPU project switches scenes |

**Next candidates for a package:** the bus (when a second project needs typed pub/sub), the
audio service (a second WebAudio project), and test hooks (a second Playwright suite).

## New project

```bash
node scripts/new-project.mjs my-slug "My Title"
cd projects/my-slug && npm install && npm run dev
```

It copies `templates/project`: `hub.json`, Vite with `base: './'` for the hub iframe, and a
three.js scene already wired to `@lid/loop`, `@lid/random` and `@lid/storage`.
