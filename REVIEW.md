# Review Checklist

A reviewer — human or model — checks only the items a diff triggers, so nobody has to remember past incidents. Run `node scripts/review-items.mjs [base] [head]` (defaults: `origin/main` and `HEAD`) to print the items triggered by a branch or commit range.

- **Read from base:** the selector reads `REVIEW.md` from `<base>` via `git show <base>:REVIEW.md`, so a change cannot edit or weaken its own checks. It falls back to the working tree only when `<base>` has no `REVIEW.md` yet, and prints a notice when it does.
- **Observe mode:** new items start in observe mode. The selector prints triggered items for the reviewer and always exits `0`; it never fails a build.
- **Pruning:** delete or merge an item when it stops firing, becomes enforced in `scripts/check.mjs`, or duplicates another item.

## Items

### R1 — Sound: first tap voice and resume after browser pause
- **Paths:** `projects/rubber-duck-pool/src/pool/sound.js`
- **Diff:** `/\b(frame|resume|happen|held|retireRadio|ran|state|close|shouldResumeAudio|createAudioGate)\b/`
- **Check:** Before a new `AudioContext` has ever run, `frame()` must still pass events to `happen()` so the waking tap's voice plays once audio starts. After it has run, a paused (`suspended`/`interrupted`) live context must stop queuing sounds at frozen `currentTime`, retire the radio, and clear `held` so waiting squeaks never fire late on resume. Keep `OfflineAudioContext` rendering while suspended, and never call `ctx.close()` when `ctx.state === 'closed'`.
- **Source:** `267dbcd`, `1018ebe`, `aed35b3` (`docs/worklog.md` entries 166, 164, 133; `projects/rubber-duck-pool/docs/improvements.md` lines 571, 633, 637–638)

### R2 — Sound: capture-phase wake order, radio loudness, and voice slots
- **Paths:** `projects/rubber-duck-pool/src/pool/sound.js`, `projects/rubber-duck-pool/src/pool/index.js`, `projects/rubber-duck-pool/src/pool/prop-keys.js`
- **Diff:** `/\b(createAudioGate|wake|speakerIn|aimRadio|radioVoices|VOICES|TAP_VOICES|soundOn|ensureRoom|createConvolver|createBuffer)\b/`
- **Check:** Register `audio.wake` on `pointerdown`, `keydown`, and `click` in the capture phase before `createBookView` so the book's `stopImmediatePropagation()` and keyboard prop clicks still wake audio. Tapped duck voices must evict the oldest background sound when `VOICES` is full, station changes must fade out and stop queued notes, spatial radio gain must not boost side channels into clipping (`>= 0.98`), and heavy reverb/noise buffers must stay deferred until first use.
- **Source:** `cd8bfb4`, `c865872`, `fde0741`, `265c858`, `ba72d11`, `35b8cbe` (`docs/worklog.md` entries 154, 123, 126, 118, 155; `projects/rubber-duck-pool/docs/improvements.md` lines 542–543, 549–551, 613–614)

### R3 — Seat panel: focus on open, Tab order, resize, and slider state
- **Paths:** `projects/rubber-duck-pool/src/pool/seat-menu.js`
- **Check:** When `open(i)` shows the seated `<dialog>`, focus the dialog itself (`tabindex="-1"`, `panel.focus()`) rather than `Stand up` so screen readers announce the seat name and `Tab` walks every control from the top. Keep the `keydown` barrier on `panel` (not `.seat-ui`) so world keys work on sit buttons while `Escape` still bubbles. Re-measure panel size on `resize` and refusal text changes so buttons stay on screen, clear `dragging` on `window` `pointerup`/`pointercancel`/`blur` and hidden `visibilitychange`, and reset stale duck, hour, and boat notes in `close()`.
- **Source:** `1127f9e`, `fd37efe`, `31b5c91`, `333c9be`, `ad25624`, `617614b`, `2630811` (`docs/worklog.md` entries 168, 163, 131, 92, 132, 138, 139; `projects/rubber-duck-pool/docs/improvements.md` lines 565–566, 580, 586, 632, 647)

### R4 — Go home modal dialog and accessible canvas / status regions
- **Paths:** `projects/rubber-duck-pool/index.html`, `projects/rubber-duck-pool/src/pool/index.js`
- **Diff:** `/\b(home-scene|home-line|sound-status|role=|aria-|tabindex)\b/`
- **Check:** Keep `.home-scene` as a modal dialog (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="home-line"`, `tabindex="-1"`) labelled by `<p id="home-line" role="status" aria-live="polite">` so screen readers do not miss the farewell when focus moves. Keep `<canvas id="gl">` on `role="application"` with `tabindex="0"` and accurate keyboard help in `aria-label`, and announce `M` mute toggles in the live `.sound-status` region.
- **Source:** `06020a4`, `6610c7e`, `2681232` (`docs/worklog.md` entries 172, 171, 170; `projects/rubber-duck-pool/docs/improvements.md` lines 649–651)

### R5 — Book view: live-region splits and skipping unchanged DOM writes
- **Paths:** `projects/rubber-duck-pool/src/pool/book-view.js`
- **Check:** Keep page contents in a polite atomic live region separate from position/completion status and summon hints, and only write `textContent`, `hidden`, `dataset`, or `aria-disabled` when a value changed so screen readers do not re-read unchanged nodes. Keep `stopImmediatePropagation()` on open-book window capture key listeners and include `date` in the redraw key so earlier finds from another tab repaint open pages.
- **Source:** `c204345`, `0762764`, `31e045c`, `31f8807` (`docs/worklog.md` entries 167, 135, 91, 96; `projects/rubber-duck-pool/docs/improvements.md` lines 514, 575, 646)

### R6 — Duck release over the slide chute or round pool exit, and shore bounds
- **Paths:** `projects/rubber-duck-pool/src/pool/world.js`
- **Diff:** `/\b(hand|grab|hold|throw|slide|INTAKE|water\.isWet|coast|pickable|fly)\b/`
- **Check:** In `W.hand.throw()`, check whether the duck itself is over pool water (`water.isWet(b.p[0], b.p[2])`) before snapping onto the slide so ducks let go over the upper pool intake wait their turn with `whee`, and ducks tapped or dropped over the round pool exit fall into the water instead of re-attaching for a second descent. Apply coast clamping immediately in `grab()` (via `hold()`) so shoreline flyers never overhang the sea, launch slide exits forward along the last segment, and clear `b.pickable` whenever a ride ends or enters the sea, boat, or tube.
- **Source:** `267dbcd`, `5664fe9`, `0862565`, `77502d7`, `f9dff04` (`docs/worklog.md` entries 166, 162, 160, 147, 150; `projects/rubber-duck-pool/docs/improvements.md` lines 599, 602, 620–621, 639–641)

### R7 — Grounded prop solids, sleeping bodies, and pick occlusion
- **Paths:** `projects/rubber-duck-pool/src/pool/solids.js`, `projects/rubber-duck-pool/src/pool/world.js`
- **Diff:** `/\b(solids|createSolids|penetrate|onProps|onProp|ground|cooler|LID_OPEN|pick|settleSwanOnDeck)\b/`
- **Check:** Grounded props (radio, hourglass, closed cooler box and lid) must never push a body out through their bottom face into the terrace floor. Track `onProp` separately from terrain contact so swan deck-settling never teleports floats off a parasol, wake bodies sleeping on props when a cooler lid opens or closes or the hourglass flips, and match pick shapes to drawn geometry (open/closed cooler lids, parasol cone, chair canvas) so occluded ducks cannot be clicked through scenery.
- **Source:** `e70175d`, `bf8101a`, `5487bf4`, `2431b65` (`docs/worklog.md` entries 153, 152, 125, 124; `projects/rubber-duck-pool/docs/improvements.md` lines 532–539, 609–610)

### R8 — Pointer taps versus drags and the 6 px rule
- **Paths:** `packages/diorama/view.js`, `projects/rubber-duck-pool/src/pool/index.js`
- **Diff:** `/\b(drag|moved|tap|endDrag|moveDrag|handlers|onInterrupt|dropEase|pointerup|pointermove)\b/`
- **Check:** Measure pointer displacement at `pointerup` as well as `pointermove`: a press lifted 6 px or more from where it went down (or held 300 ms or longer) is never a tap, even with no `pointermove` between. Clickable props (`seat`, `radio`, `glass`, `cooler`) must act on `tap`, not `start`; a drag of 6 px or more from a tap-only handler must cancel it once (`end(s, true)`), hand off to camera orbit from the down point, and fire `onInterrupt` once when dropping a running `ease`.
- **Source:** `a75d484`, `baadb80`, `489ca18`, `88aaba2`, `d14e6e7`, `9d5e831` (`docs/worklog.md` entries 151, 156, 161, 136, 129, 130; `projects/rubber-duck-pool/docs/improvements.md` lines 563–564, 568, 608, 628)

### R9 — Drag, pinch, and cursor cleanup on cancel, blur, tab hide, and third finger
- **Paths:** `packages/diorama/view.js`, `projects/rubber-duck-pool/src/pool/navigation.js`, `projects/rubber-duck-pool/src/pool/index.js`
- **Diff:** `/\b(cancel|releaseDrag|releasePointers|ptrs|pinch|pointercancel|lostpointercapture|blur|visibilitychange|hover|grabbing)\b/`
- **Check:** `pointercancel`, `lostpointercapture`, second-finger pinch start, window `blur`, hidden `visibilitychange`, and `Go home` must cancel drags cleanly (zero throw velocity, no tap, cleared `ptrs` and cursor) instead of tapping or flinging ducks. When a third finger lifts back to two fingers, re-anchor two-finger pan and pinch without jumping; when a normal mouse drag ends on `pointerup`, mark `hover` pending so the cursor updates before the next move.
- **Source:** `31e4b55`, `cceb492`, `01d3c62`, `76fe985`, `f214108` (`docs/worklog.md` entries 101, 81, 88; `projects/rubber-duck-pool/docs/improvements.md` lines 498, 520, 530–531)

### R10 — Shared package changes must be checked against jelly and every consumer
- **Paths:** `packages/**`
- **Check:** `packages/diorama` and `packages/dev-kit` are shared by `projects/jelly` and other projects, not only `rubber-duck-pool`. Keep new options backward-compatible (defaulting to prior behavior when omitted), run `npm run test:packages`, and run `projects/jelly` headless checks (or `npm run verify`) before landing.
- **Source:** `2a5e2ab`, `6505010`, `707980f`, `7e670ed` (`docs/worklog.md` entries 1, 3, 97)

### R11 — Seeded determinism: randomness and time come from the caller
- **Paths:** `projects/jelly/src/**`, `projects/rubber-duck-pool/src/**`, `packages/diorama/**`
- **Diff:** `/\b(Math\.random|Date\.now|performance\.now|rng|seed|rand|pickDesign|arrivalDesign|acc)\b/`
- **Check:** Simulation and world code must never call `Math.random()` or `Date.now()` directly; take a seeded `rng` and `dt` from the caller, and keep every call to the seeded random in the same order during refactors or performance work so the same seed replays bit-identically. When capping ticks per frame, drop only whole uncatchable ticks and keep the fractional remainder so low-FPS devices run at full speed.
- **Source:** `ccedfec`, `6505010`, `a565031` (`docs/worklog.md` entry 1; `projects/rubber-duck-pool/docs/improvements.md` line 529)

### R12 — Relative URLs only: the page loads nothing from the site root
- **Paths:** `projects/*/index.html`, `projects/*/vite.config.*`, `projects/*/hub.json`, `scripts/build-projects.mjs`
- **Check:** Hub builds serve every project from `/p/<slug>/` inside an iframe. Keep `base: './'` in `vite.config.*` and verify that no HTML `src`/`href` or runtime fetch points to `/` (site root), which breaks under `/p/<slug>/`.
- **Source:** `e0b359f`, `6505010` (`docs/worklog.md` entry 1)

### R13 — Tests that passed on broken code: fail before fix and catch mutations
- **Paths:** `**/*.test.*`, `.claude/skills/verify/drive/**`
- **Check:** Every new or edited test must fail on the code before the fix (and when the key guard or value it protects is mutated). Avoid vacuous checks like `.every(...)` on a possibly empty list, fake DOMs that skip capture/bubble order, or tests that bypass the real build or pipeline; wrap wall-clock limits in `budget()` so slower CI machines do not flake.
- **Source:** `a045588`, `489ca18`, `4b69dfe`, `6a9bc29`, `6e5ffb0`, `53a07c8` (`docs/worklog.md` entries 84, 161, 1, 71, 73, 78, 127, 128, 141, 144, 159; `projects/rubber-duck-pool/docs/improvements.md` lines 508, 559–560, 593, 628)

### R14 — Logbook: multi-tab rebase, storage errors, key versioning, and closing flush
- **Paths:** `projects/rubber-duck-pool/src/pool/logbook.js`, `projects/rubber-duck-pool/src/pool/home.js`, `projects/rubber-duck-pool/src/pool/index.js`
- **Diff:** `/\b(logbook|createLogbook|rebased|pending|LEGACY_KEY|localStorage|storage|flush|keeps|summon|restore|pagehide)\b/`
- **Check:** Replay this tab's `pending` changes onto the latest stored book instead of overwriting with local state, and clear `pending` only after a write succeeds. Distinguish `getItem` exceptions from empty/corrupt JSON so transient read errors never wipe another tab's progress, keep `keeps` accurate for the storage warning, never overwrite `LEGACY_KEY` (`v1`), restore pool items with `{ restore: true }` so restores are not re-logged as summons, sync on `storage` events across tabs, and `flush()` on `pagehide` and hidden `visibilitychange` (including newly completed collection stamps).
- **Source:** `4b184c9`, `189d1a7`, `31f8807`, `64c8569`, `f56e171`, `9857679`, `bd9218c`, `9811925` (`docs/worklog.md` entries 85, 111, 96, 134, 87, 108, 158, 79; `projects/rubber-duck-pool/docs/improvements.md` lines 487, 509, 512, 516, 527, 574, 625)

### R15 — Frame order on boat mooring, Go home fade, and new-visit resets
- **Paths:** `projects/rubber-duck-pool/src/pool/index.js`, `projects/rubber-duck-pool/src/pool/home.js`, `projects/rubber-duck-pool/src/pool/critters.js`, `projects/rubber-duck-pool/src/pool/fx.js`, `projects/rubber-duck-pool/src/pool/cooler-state.js`
- **Diff:** `/\b(draw|newVisit|startVisit|goHome|brought|broughtPages|settle|reset|seatMenu\.frame|bookView\.frame|coolers)\b/`
- **Check:** Update `book.observe()` and `brought`/`broughtPages` before calling `seatMenu.frame()` and `bookView.frame()` so the mooring frame never flashes `"Nothing is adrift."` or an empty book page. Across the `Go home` fade, carry over only collected book pages (not rescued ducks), reset night FX and cooler lids, and call `critters.settle(world.day.hour)` on both initial mount and `newVisit()` so daytime gulls and butterflies appear at full alpha immediately.
- **Source:** `8a9a0f5`, `e7c28d7`, `987110e`, `752f3ff`, `5b0440c` (`docs/worklog.md` entries 142, 143, 159, 137, 89; `projects/rubber-duck-pool/docs/improvements.md` lines 579, 588–589, 619)

### R16 — Abort, GPU device loss, and frame-loop error handling
- **Paths:** `projects/rubber-duck-pool/src/main.js`, `projects/rubber-duck-pool/src/pool/index.js`
- **Diff:** `/\b(fail|abort|signal\.aborted|device\.lost|frames|Loop|fallback|extra)\b/`
- **Check:** On GPU `device.lost` or an uncaught frame error, call `fail()` to abort the controller, stop the frame loop, hide `#extra` overlays, and show `#fallback`. Check `signal.aborted` after every `await` in `mount()` so an aborted startup creates no views, observers, hooks, or overlays.
- **Source:** `22bc59f`, `99dca58` (`docs/worklog.md` entries 165, 99; `projects/rubber-duck-pool/docs/improvements.md` line 634)

### R17 — Same-frame camera movement accumulation and keyboard navigation
- **Paths:** `projects/rubber-duck-pool/src/pool/navigation.js`, `packages/diorama/view.js`
- **Diff:** `/\b(go|lookFrom|shifted|target|dist|wheel|pan|Arrow|Minus|Equal|Numpad|KeyR|keys|reduced)\b/`
- **Check:** Update `cam.target` and `cam.dist` immediately when `go()` calls `lookFrom()` so multiple wheel or pan events within one frame add together instead of overwriting each other. Guard keyboard camera keys against editable targets and modifier keys, cancel active pan and cursor state on `KeyR`, clear held keys on sit so the next frame does not stand right back up, and keep `prefers-reduced-motion` (`reduced`) cutting camera transitions without dividing by zero.
- **Source:** `72e7728`, `1680675`, `f214108` (`docs/worklog.md` entries 148, 169, 88, 63; `projects/rubber-duck-pool/docs/improvements.md` lines 451, 600, 648)

### R18 — Name tags: hidden Leon Sans fallback text, DOM reuse, and overlap sizing
- **Paths:** `projects/rubber-duck-pool/src/pool/lettering.js`, `projects/rubber-duck-pool/src/pool/index.js`
- **Diff:** `/\b(placeTags|lt-words|words|clip-path|letter|tagOf|dk-tags|offsetWidth|offsetHeight|devicePixelRatio)\b/`
- **Check:** Keep `.lt-words` visually hidden with inline clip styles inside `lettering.js` (never relying on external page CSS that can be removed) so a second system-font pill never covers the Leon Sans canvas. Measure each tag's real padded box (`offsetWidth`/`offsetHeight`, cached once per tag) for overlap avoidance, hide tags with `el.hidden = true` while a duck stays in the pool, and include `devicePixelRatio` in the redraw key so tags redraw cleanly across monitors.
- **Source:** `b79e8dd`, `4b4914e`, `38589c2`, `7e670ed` (`docs/worklog.md` entries 145, 100, 98, 97; `projects/rubber-duck-pool/docs/improvements.md` line 597)

### R19 — World invariants: live selection, leaving summons, and seated gaze
- **Paths:** `projects/rubber-duck-pool/src/pool/world.js`, `projects/rubber-duck-pool/src/pool/index.js`, `projects/rubber-duck-pool/src/pool/scene.js`
- **Diff:** `/\b(selected|sendBack|leaving|summonId|ducks\.includes|seated|gaze|GAZE_RATE|lookAt)\b/`
- **Check:** Keep `W.selected` enforced to live ducks only (never colouring or reporting a removed or reset duck). Once `W.sendBack(id)` starts, release any held summon immediately and ignore further `pick`, `grab`, `hold`, `throw`, and `tap` calls on leaving or removed bodies. While seated, pause gaze tracking only for a floating duck held in the player's hand (`body.state === 'held' && state === 'float'`) or underground in the return tube; keep following ducks on slides, pumps, hops, and flights.
- **Source:** `9cbb0b1`, `76679a7`, `90dad17` (`docs/worklog.md` entries 93, 90, 149; `projects/rubber-duck-pool/docs/improvements.md` line 601)

### R20 — Duck designs, crown/hat flags, glass shadows, and unexpected arrivals
- **Paths:** `projects/rubber-duck-pool/src/pool/ducks.js`, `projects/rubber-duck-pool/src/pool/scene.js`, `projects/rubber-duck-pool/src/pool/renderer.js`, `packages/diorama/renderer.js`
- **Diff:** `/\b(vsDuck|vsHat|shadowFs|duckRuns|arrivalDesign|unexpected|hatVertexStart|glassVertexStart|ex\.[yz])\b/`
- **Check:** Keep the base crown flag (`ex.y`, 11-crown only) separate from unexpected head-top extras (`ex.z`) so unexpected ducks never wear a gold crown. Let glass duck bodies (`shadowFs`) pass sunlight matching their visual alpha instead of casting solid black shadows, and keep `arrivalDesign()` introducing unexpected ducks during ordinary visits so players can earn `all-unexpected`.
- **Source:** `aa6a86a`, `e2b6b98`, `6ce928d`, `7fa6c68` (`docs/worklog.md` entries 106, 110, 112; `projects/rubber-duck-pool/docs/improvements.md` lines 521, 526, 528)

### R21 — Per-frame GPU and CPU allocations in renderers, ocean, water, and prop posing
- **Paths:** `packages/diorama/renderer.js`, `packages/diorama/post.js`, `packages/diorama/water.js`, `projects/rubber-duck-pool/src/pool/ocean-gpu.js`, `projects/rubber-duck-pool/src/pool/props.js`
- **Diff:** `/\b(createView|render|encode|pack|packedOut|nCells|update|poseProps|collectibles\.list|PLACEMENTS\.find)\b|===\s*last\b/`
- **Check:** Reuse GPU texture views across frames (creating only the swapchain view per frame and remaking target views on `resize()`), skip ocean compute passes when `world.time` has not moved, write dry water cells and terrain only on first pack or after `setLevel()`, and avoid per-frame array/object clones or repeated `.find()` scans inside `poseProps()`.
- **Source:** `ad8d9d9`, `80725b7`, `0f5556c`, `5fe9d3a` (`docs/worklog.md` entries 102, 103, 104, 94; `projects/rubber-duck-pool/docs/improvements.md` line 522)

### R22 — Props packing, gzip delivery, and island placement clearance
- **Paths:** `projects/rubber-duck-pool/src/pool/props.js`, `projects/rubber-duck-pool/src/pool/island.js`, `projects/rubber-duck-pool/vite.config.js`, `projects/rubber-duck-pool/tools/pack-props.mjs`
- **Diff:** `/\b(unpackProps|decodeProps|gzip|PLACEMENTS|built|CROWNS|isleMesh|skirt|edgeH|soil)\b/`
- **Check:** Keep each prop model in only one pack table (`pack-props.mjs`), preserve raw-vs-gzip detection in `unpackProps()` and real Vite build checks for `gzip-props`, keep scattered props clear of built structures, walls, and cliff drops (`soil`), and keep every island skirt quad closed below the courtyard floor so no sea seam shows through.
- **Source:** `6a9bc29`, `d3462e7`, `e29bf2b`, `ee190f2` (`docs/worklog.md` entries 64, 65, 67, 70, 71, 73, 75, 76, 77, 78; `projects/rubber-duck-pool/docs/improvements.md` lines 456, 467, 474, 479)

### R23 — Bit-exact hashes of floating-point state kept as tests
- **Paths:** `projects/*/tests/**`, `packages/*/*.test.mjs`, `packages/*/tests/**`
- **Diff:** `/\b(createHash|sha256|digest)\b/`
- **Check:** A kept test must not compare a hash of particle positions or other floating-point state: it passes on the code before a refactor and fails when only a loop's order changes (positions 1.6e-5 apart, every behavior check passing). Use the hash once, as the before/after proof in the report, and keep checks that compare behavior within a tolerance.
- **Source:** `5a1f5d5` (Gemini 4 Neon's review of its first draft, which kept such a check; `docs/worklog.md` entry 182)

### R24 — A script given a name it does not know
- **Paths:** `scripts/*.mjs`
- **Diff:** `/\b(argv|only|includes)\b/`
- **Check:** A script that takes project or package names must reject a name it does not know before any work, print the names it knows and exit 1. Filtering by the name and doing nothing reports success on a typo (`built 0`, exit 0).
- **Source:** `4345d4f` (`docs/worklog.md` entry 178)

### R25 — Drives that accept part of a walk
- **Paths:** `.claude/skills/verify/drive/*.js`
- **Check:** A drive that walks a set (every jelly, every page, every station) must read the set's size from the page, check each step against what the page names next, reject a repeat and require the walk to end where it began. A fixed click limit or "saw at least two" passes a short cycle such as 01 → 02 → 01.
- **Source:** `08af612` (`docs/worklog.md` entry 179)
