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
| `drive/pool-ducks.js` | | the hook's `add(5)` brings five ducks; a picked duck takes the chosen design and hat |
| `drive/pool-props.js` | | clicking the radio where it is drawn turns it through its stations and off; clicking the hourglass turns it |
| `drive/pool-seats.js` | | each deck chair, by a click where it is drawn and by the hook's `sit(i)`, seats the camera at its eye |
| `drive/pool-time.js` | | the hook's `clock(false)` stops the clock, and `hour(22)` takes it to night |
| `drive/pool-flyer.js` | | a flyer (the hook's `addFlyer()`) flies and in the end goes out to sea, and is counted |
| `drive/pool-names.js` | | the hook's `names(true)` puts each duck's name over it, and `names(false)` takes them away |
| `drive/pool-sea.js` | | the open sea's FFT, read back from the GPU, equals its waves summed one by one on the CPU, now and two seconds on |
| `drive/pool-sound.js` | | the sound, rendered offline through the page's engine: crickets only after dark, running water loud up close and faint from afar, a splash and a tap's squeak stand out, the radio is heard, nothing clips (`window.__wav` returns a scene as WAV to listen to) |
| `drive/pool-phone.js` | | with `--mobile`: the low quality at most 1.5 device pixels a CSS pixel, the touch hints and finger-sized buttons, two fingers slide the view and pinch it closer, a tap makes a duck hop |
| `drive/pool-panel.js` | | the toolbar and a picked duck's card by their real buttons: the toolbar hides and comes up with the mouse, Add a duck, the hour's popover (slider, clock, Escape), the dark glass after sunset, Names, Help giving way to the hour, the card's design, wear, Follow, next, close and Take it out |
| `drive/pool-play.js` | | the play controls by their real buttons, the hook stepping the clock: Race starts ducks down the flume and the island at the top follows them to a word of the winner; a flyer lost at sea puts Send the boat in the island, which fetches it home; the Book's three pages show twelve stamps (those earned), twelve designs and the ducks met, the records, and Escape closes it |
| `drive/pool-tap.js` | | a quick press on a duck where it is drawn makes it hop and throw off its burst; a drag still picks it up |

The pool's page has a glass toolbar that hides until the mouse nears the bottom (always up on a touch screen) and an island at the top for what is happening now (`.isl[data-kind=race|notice|sea|boat]`); its drives press the real buttons where there are some and use the hook for the rest (stepping the clock, adding a flyer).

Prepend with `--eval "$(cat .claude/skills/verify/drive/frames.js .claude/skills/verify/drive/overlap.js)"`. In zsh, pass a size held in a variable as `${=vp}`: a quoted `"--w 1024 --h 700"` reaches the probe as one argument and the run silently uses 1600x900.

The feature map, `features/README.md`, lists what each page does and which script drives it.

## Evidence

Screenshots and logs go to `.verify/` at the repo root (git-ignored). A proof is the log's `PROBE STATS` line plus the screenshot, and exit code 0. Report the numbers the script returns (ducks 12 -> 17, the jellies visited), not "it works". Exercise the user's path: a button click or a pointer event, never a hook setter, unless the feature has no control (the world's own clock, the pool's features until its page has controls).

## Cleanup

The probe kills its Chrome and closes its server when it ends; its profile is a temp dir. Nothing else to tear down. Keep `.verify/`.
