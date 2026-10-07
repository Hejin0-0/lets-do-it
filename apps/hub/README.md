# apps/hub — the FFF hub (not built yet)

The main page: a rotating ring of posters; a click enters the project. See
[`../../docs/FFF-hub-design.md`](../../docs/FFF-hub-design.md).

What it will read:

- `projects/<slug>/hub.json` — title, year, tags, `mode` and `entry`. Every project starts in
  `"mode": "iframe"`; one moved to the mount contract later switches to `"module"`.
- `public/p/<slug>/` — each project's static build, put there by
  `node scripts/build-projects.mjs` (git-ignored). The hub opens `/p/<slug>/<entry>` in a
  sandboxed iframe and pauses its own renderer while the project runs.
