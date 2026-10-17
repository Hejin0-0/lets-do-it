# lets-do-it — rules

`npm run verify` checks everything CI checks: the repo rules below, every package's tests and every
project's headless checks (`npm run verify -- --build` also builds the hub). Run it before you commit.
A rule that code enforces is not repeated here as prose; its error message says what to do.
To prove a page works in a real browser (WebGPU, its controls, phone and desktop sizes), use the
`verify` skill (`.claude/skills/verify/`); it drives the built page with `@lid/dev-kit`'s probe.

| Rule | Enforced by |
|---|---|
| Projects never import from each other; shared code is a `packages/` package imported by name (`@lid/*`, linked with `file:../../packages/<name>`), and only once two projects carry the same code (`docs/patterns.md`) | `scripts/check.mjs` boundaries |
| A change to a package is checked against every project | `scripts/verify.mjs` runs them all |
| Every project has a valid `hub.json`, a kebab-case folder (= slug = `/p/<slug>`), Vite `base: './'`, three snapshots `NN_<slug>_01..03.webp` and a row in the README | `scripts/check.mjs` hub-contract |
| A build loads nothing from the site root (it runs under `/p/<slug>/` in an iframe) | `scripts/build-projects.mjs` |
| Simulation code is deterministic: randomness and time come from the caller | `scripts/check.mjs` seeded-sim; `createFloaters` requires `rand` |
| A wall-clock limit in a test goes through `budget()` (CI machines are slower) | `scripts/check.mjs` timing-budget |
| jelly: `registry.js` is the one list; folders, numbers and the README table follow it; a jelly is a page module, never a standalone HTML file, even when a pasted prompt asks for one | `scripts/check.mjs` jelly-registry |

Judgment calls (nothing enforces these):

- New projects start from `node scripts/new-project.mjs <slug> "Title"` (`templates/project`).
- **Module mode (later, per project):** `mount(container, { signal })` / `unmount()` — `unmount`
  stops the render loop, removes listeners and disposes WebGL; set `"mode": "module"`.
- **One WebGL/WebGPU context at a time:** the hub pauses its renderer while a project runs.
- **No copying a reference** (a site, a game, a screenshot): take its structure and ideas only,
  never its names, fonts, images, models, textures, code or exact motion values. All visuals and
  assets are our own.
- Commit and push only when the user asks. Deleting files waits for the user's yes. Never edit a
  project's `.claude/launch.json` (the user's dev server).
- Reports to the user are in Korean; text on the page is English.
- Design source of truth: `docs/FFF-hub-design.md` (draft; its folder layout is not final).
