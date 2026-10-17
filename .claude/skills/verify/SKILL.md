---
name: verify
description: Drive this repo's WebGPU pages (projects/jelly, projects/rubber-duck-pool, and any other project's build) in headless Chrome on the Mac's GPU and prove behavior with screenshots and the page's test hook. Use after changing a project's page, renderer, panel or world, before saying it works, and whenever the in-app browser pane is hidden (its frames stall).
---

# Verify a page in this repo

Every project is a static page built with Vite. Verification serves the build, opens it in headless Chrome with WebGPU, runs a drive script through the page's test hook and its real controls, and keeps a screenshot and a log. One tool does all of it: `packages/dev-kit/probe.mjs` (`@lid/dev-kit`). Don't write another CDP script.

## Launch

Build the project, then probe its `dist/`. The probe serves the folder on a free port for this run only and starts its own Chrome profile, so runs never share state and two can go side by side.

```sh
cd projects/<slug> && npm run build && cd ../..
node packages/dev-kit/probe.mjs --serve projects/<slug>/dist --path '<hash>' --webgpu --wait 7000 \
  --shot .verify/<slug>-<feature>.png --eval "$(cat .claude/skills/verify/drive/<script>.js)" > .verify/<slug>-<feature>.log 2>&1
echo $?   # 0: no console error and the drive script returned; 1: it logged an error or the script threw
```

Ready means the page's hook exists: `window.__jelly` (jelly; `id` is the mounted jelly) or `window.__pool` (rubber-duck-pool). `--wait 7000` covers shader compiles. Phone layout: add `--mobile` (390x844, touch). Another size: `--w 1280 --h 720`.

## Doctor

Is WebGPU there at all? Ask on the served build, since WebGPU exists only in a secure context (a local server is one, `about:blank` is not):

```sh
node packages/dev-kit/probe.mjs --serve projects/<slug>/dist --webgpu --wait 3000 --shot .verify/doctor.png --eval "(async()=>String(!!(navigator.gpu && await navigator.gpu.requestAdapter())))()"
```

`PROBE STATS: true` means go. `false` means this Chrome has no GPU adapter (a VM or CI): the pages will show their "needs WebGPU" card, so only headless node tests (`npm run verify`) apply.

## Drive

Scripts in `drive/` run inside the page through `--eval`. They use the real controls (buttons by id, pointer events at the screen point of a world position from the hook's `toPx`) and the hook only to read state. Each throws when the proof fails, so the probe exits 1.

| Script | Prepend | Proves |
|---|---|---|
| `drive/jelly-tour.js` | `drive/frames.js` | the "next" arrow mounts every jelly in turn, and no jelly's frames overlap at this size |
| `drive/overlap.js` | `drive/frames.js` | title, panel (or bottom sheet), "how to play" and the status pill do not cover one another |
| `drive/pool-ducks.js` | | Add five brings five ducks; a picked duck takes the chosen colour and hat |
| `drive/pool-props.js` | | clicking the radio where it is drawn turns it through its stations and off; clicking the hourglass turns it |
| `drive/pool-seats.js` | | each deck chair, by its button and by a click where it is drawn, seats the camera at its eye |
| `drive/pool-time.js` | | the Time toggle stops the clock, and the slider takes it to 22:00 and night |
| `drive/pool-flyer.js` | | Add a flyer brings a propeller duck that flies and in the end goes out to sea, with a toast and the count |
| `drive/pool-names.js` | | Names puts each duck's name over it, and takes them away |

Prepend with `--eval "$(cat .claude/skills/verify/drive/frames.js .claude/skills/verify/drive/overlap.js)"`. In zsh, pass a size held in a variable as `${=vp}`: a quoted `"--w 1024 --h 700"` reaches the probe as one argument and the run silently uses 1600x900.

The feature map, `features/README.md`, lists what each page does and which script drives it.

## Evidence

Screenshots and logs go to `.verify/` at the repo root (git-ignored). A proof is the log's `PROBE STATS` line plus the screenshot, and exit code 0. Report the numbers the script returns (ducks 12 -> 17, the jellies visited), not "it works". Exercise the user's path: a button click or a pointer event, never a hook setter, unless the feature has no control (the world's own clock).

## Cleanup

The probe kills its Chrome and closes its server when it ends; its profile is a temp dir. Nothing else to tear down. Keep `.verify/`.
