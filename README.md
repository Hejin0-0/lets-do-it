# lets-do-it — FFF hub

**One hub, many independent worlds.** A rotating navigation of posters; click one and you
enter its project. The hub stays light; every project lives on its own and never affects
another.

The hub's design is in [`docs/FFF-hub-design.md`](docs/FFF-hub-design.md) (draft — the folder
layout there is not final). Only the *structure* of the reference site is borrowed; every
visual, asset and line of code is our own.

## Projects

| Project | What it is | Stack |
|---|---|---|
| [ink-and-iron](projects/ink-and-iron) | **Ink & Iron** — a WW1 hex wargame on the real 1917 Yser front, played with tin miniatures on a diorama war-table in a candle-lit gothic library; an alternate-history campaign whose every fact cites a source | Three.js · Vite · TypeScript |
| [inkbound-isle](projects/inkbound-isle) | A first-person dinosaur-survival expedition across a procedurally generated island: gathering, crafting, building, companions, local saves and LAN multiplayer | Three.js · Vite · TypeScript · WebSocket |
| [night-street](projects/night-street) | A first-person walk down one procedurally generated city block at 21:00 — every texture, mesh, light and sound generated in code | Three.js · Vite · TypeScript |
| [wobble-rush-3d](projects/wobble-rush-3d) | **Wobble Rush 3D** — a single-player obstacle course: five stages, four game types, six characters, with a bot that plays every level | Three.js · Vite · JavaScript |
| [dominions-2100](projects/dominions-2100) | **Dominions 2100** — a browser RTS spanning 1800 to 2100: economy, construction, combat, AI and fog of war | Three.js · Vite · JavaScript |
| [infra-diorama](projects/infra-diorama) | A dark B2B scrolling story through a five-stage construction process, as one continuous scene | React · React Three Fiber · GSAP · Lenis |

The five projects other than ink-and-iron came from
[`ai-playground/prompt-test`](https://github.com/Hejin0-0/ai-playground/tree/main/prompt-test),
where their commit history stays (there as `call-guys` and `empires-rts` for wobble-rush-3d and dominions-2100).

## Running a project

Each project is self-contained:

```bash
cd projects/<project>
npm install
npm run dev
```

and open the URL it prints. Several have their own checks (`npm run check`,
`npm run test:rules`, Playwright e2e) — see each project's README.

## Layout

```
lets-do-it/
├─ apps/hub/                 # the FFF hub (main page — not built yet)
├─ projects/<slug>/          # one independent app per project, own lockfile and node_modules
│  └─ hub.json               # how the hub lists and opens it: title, year, tags, mode, build, entry
├─ packages/                 # shared code (@lid/loop, random, storage, dev-kit) — docs/patterns.md
├─ templates/project/        # starting point for a new project
├─ scripts/build-projects.mjs  # builds each project → apps/hub/public/p/<slug>/ (git-ignored)
├─ scripts/new-project.mjs   # node scripts/new-project.mjs <slug> "Title"
├─ snapshots/                # play snapshots, <order>_<project>_01.webp … (order = when it was made), for the hub posters
└─ docs/                     # the hub design, patterns
```

Shared code lives in `packages/` as TypeScript source; a project links what it uses
(`"@lid/random": "file:../../packages/random"`). Which Game Programming Patterns are shared,
and which still live in one project, is in [`docs/patterns.md`](docs/patterns.md).

```bash
npm run test:packages                  # the packages' own tests
node scripts/new-project.mjs my-slug "My Title"   # a new project from the template
```

Every project opens in the hub as a sandboxed **iframe** (`"mode": "iframe"`), so each keeps
its own toolchain untouched. A project can later move to the mount contract
(`"mode": "module"`, `packages/project-contract`) when its entry transition needs it.

```bash
npm run build:projects                 # build every project into the hub
node scripts/build-projects.mjs ink-and-iron   # or just one
```
