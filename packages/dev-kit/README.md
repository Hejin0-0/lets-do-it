# @lid/dev-kit

Tools for checking a project in a real browser without a human at the screen.

- `probe.mjs` — opens a page in headless Chrome, runs an `--eval` script, prints the console
  errors, warnings and the script's result, and can save a screenshot:
  `node packages/dev-kit/probe.mjs --url <url> --w 1280 --h 720 --wait 9000 --shot out.png --eval "(async()=>{…})()"`
  `--serve <dir> [--path '#11']` serves a built folder (a project's `dist/`) for this run only,
  `--webgpu` turns WebGPU on (the Mac's GPU, headless), `--mobile` is a 390x844 touch phone. The script can
  `await window.__input(steps)` for the browser's own keys, clicks and taps (probe.mjs lists the steps). It exits
  1 when the page logs an error or throws, or the `--eval` script throws. The repo's `verify` skill
  (`.claude/skills/verify/`) drives the pages with it.

A project that wants these checks exposes two globals (ink-and-iron is the reference):
`window.__THREE_GAME_TEST_HOOKS__` (questions and setup: load a scenario, skip the intro, list legal
actions, map a cell to screen pixels) and `window.__THREE_GAME_DIAGNOSTICS__` (frame, phase,
renderer counts), refreshed every frame.

The blind A/B harness built on it is in `projects/ink-and-iron/scripts/ab/`.
