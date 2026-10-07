# lets-do-it — rules

- **Projects are independent.** Each `projects/<name>` builds and runs on its own; never import
  from another project. Shared code waits for `packages/` (hub milestone M3).
- **Every project is listed by its `hub.json` and opens in a sandboxed iframe** from
  `apps/hub/public/p/<slug>/` (built by `scripts/build-projects.mjs`). So a project's build
  must use relative URLs (Vite `base: './'`) and must not need a server.
- Folder name = slug = public URL `/p/<slug>`: kebab-case product names.
- **Module mode (later, per project):** `mount(container, { signal })` / `unmount()` — `unmount`
  stops the render loop, removes listeners and disposes WebGL; set `"mode": "module"`.
- **One WebGL/WebGPU context at a time:** the hub pauses its renderer while a project runs.
- **No copying the reference site:** its structure (rotating navigation → poster → project)
  only. Never its fonts, images, models, textures, code or exact motion values. All visuals
  and assets are our own.
- Design source of truth: `docs/FFF-hub-design.md` (draft; its folder layout is not final).
