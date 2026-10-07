# lets-do-it — rules

- **Projects are independent.** Each `projects/<name>` builds and runs on its own; never import
  from another project. Shared code waits for `packages/` (hub milestone M3).
- **Hub contract (when the hub lands):** a project plugs in through
  `mount(container, { signal })` / `unmount()` — `unmount` stops the render loop, removes
  listeners and disposes WebGL. Legacy projects go in a sandboxed iframe first.
- **One WebGL/WebGPU context at a time:** the hub pauses its renderer while a project runs.
- **No copying the reference site:** its structure (rotating navigation → poster → project)
  only. Never its fonts, images, models, textures, code or exact motion values. All visuals
  and assets are our own.
- Design source of truth: `docs/FFF-hub-design.md` (draft; its folder layout is not final).
