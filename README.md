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
| [war-library](projects/war-library) | **Ink & Iron** — a WW1 hex wargame on the real 1917 Yser front, played with tin miniatures on a diorama war-table in a candle-lit gothic library; an alternate-history campaign whose every fact cites a source | Three.js · Vite · TypeScript |
| [inkbound-isle](projects/inkbound-isle) | A first-person dinosaur-survival expedition across a procedurally generated island: gathering, crafting, building, companions, local saves and LAN multiplayer | Three.js · Vite · TypeScript · WebSocket |
| [night-street](projects/night-street) | A first-person walk down one procedurally generated city block at 21:00 — every texture, mesh, light and sound generated in code | Three.js · Vite · TypeScript |
| [call-guys](projects/call-guys) | **Wobble Rush 3D** — a single-player obstacle course: five stages, four game types, six characters, with a bot that plays every level | Three.js · HTML/CSS/JS |
| [empires-rts](projects/empires-rts) | **Dominions 2100** — a browser RTS spanning 1800 to 2100: economy, construction, combat, AI and fog of war | Three.js · Vite · JavaScript |
| [infra-diorama](projects/infra-diorama) | A dark B2B scrolling story through a five-stage construction process, as one continuous scene | React · React Three Fiber · GSAP · Lenis |

The five projects other than war-library came from
[`ai-playground/prompt-test`](https://github.com/Hejin0-0/ai-playground/tree/main/prompt-test),
where their commit history stays.

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
├─ projects/     # one folder per project, each independent
└─ docs/         # the hub design
```

The hub itself (`apps/hub`) and the shared mount contract (`packages/project-contract`)
arrive with the hub's first milestone (M0 in the design doc).
