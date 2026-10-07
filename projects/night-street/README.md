# night-street

A first-person walk down one city block at 21:00, in the browser. Every texture,
mesh, light and sound is generated in code at load time. There are no images, no
models, no HDRIs and no audio files in this directory.

The folder is called `night-street` because the brief asked for 11 PM. Five hours
in, a one-sentence prompt moved the time of day to golden hour and the name was
the only thing left of the original; later the time was moved back to 21:00 and
the name became accurate again. Both moves are visible in the code, because the
whole lighting model hangs off one number — `ELEVATION_DEG` in `scene/sun.ts` —
and the interesting bugs in this project are all constants that were derived
under one sun and did not move when the sun did. Set it positive and the scene is
a golden-hour street again.

```bash
npm install && npm run dev
```

Click to walk. `WASD` to move, `SHIFT` to run, mouse to look, `ESC` to release
the cursor. The walkable block is 168 m: about 73 seconds at the 2.3 m/s walk,
35 at the 4.8 m/s sprint.

It was 126 m until a play report said "I haven't reached anything and I can't go
forward". The layout had been building props out to z = -176, parked cars to
-152 and buildings to -181 while the walk stopped at -118 — so fifty-eight metres
of finished, lit, furnished street sat behind a boundary you could feel and not
see. The walk now runs to where the street furniture does, which is a third more
block for no new geometry.

```bash
npm run check    # layout + signage tests, then a production build
```

`?playtest` runs a scripted route and reports measured GPU frame time; `?sweep`
renders a 24-frame contact sheet down the block; `?score` measures edge crawl by
shifting the camera half a pixel and diffing. `?sweep` needs
`node tools/shotserver.mjs shots` running; the other two report to the console.
`?notaa` and `?nofxaa` disable one antialiasing pass each, so the cost and the
benefit of either can be A/B'd within a single page session — which, as the
performance notes below explain, is the only way these numbers are comparable.

`experiments.tsv` is the log those three feed. One change per row, the
measurement, and whether it was kept — the shape is borrowed from the
autoresearch loop skill, and its first rule is the one that matters: the
evaluator is fixed and the change is what moves. Three of the eight rows are
things that seemed obviously right and measured badly enough to throw away.

See Performance below, and `NEXT.md` for the current working state.

---

## What moves

For a long time nothing did, and a street where nothing moves is an
architectural render rather than a place — no amount of texture detail fixes
that. Three things move now, and they were chosen for what they do rather than
for what they cost:

- **Two cars, in opposite lanes.** The one coming toward you carries the scene's
  only moving light — a spot, no shadow map, lighting the road ahead by a
  measured 15% — plus its engine, which arrives and leaves with a hand-rolled
  doppler because the Web Audio one was removed from the spec years ago. The one
  going away is tail lights and costs almost nothing. Together, +1.3 ms.
- **Two of the eleven neon signs are failing.** Not a sine wave: dead for six or
  seven seconds, then a fifth of a second of stutter on a hash, then it catches.
  A sign that flickers constantly reads as a strobe. Verified by driving the
  clock over twenty seconds — exactly two signs vary, and they are dark about 1%
  of the time.
- **The traffic lights cycle**, which they always did.

## What was asked for, and where this deviates

`PROMPT.md` is the five prompts this was built from, verbatim. Two deliberate
departures from them:

**Tech stack.** The brief specifies Next.js App Router, React, Tailwind and
React Three Fiber. This is plain Vite + TypeScript + three. The scene is a
single full-bleed canvas with no React state in it, no routes, no server
rendering and no HTML to style; App Router, a CSS framework and a reconciler
would each have been a dependency doing nothing. It also matches the other
projects in `prompt-test/`. The brief's other pointers — a Windows path to a
previous project, four external skill repositories, a Cursor globals file —
have no equivalent here, so the local game-development skill library was used
instead: the art-director rubric drives the blind visual critic in VISUAL_QA.md, and the
technical-artist and performance-analyst framings supply the draw-call budget
and the rule that it gets measured rather than assumed.

**Sun azimuth.** The brief and the golden-hour pivot both imply the sun across
the street, lighting one row of facades face-on. That is geometrically
impossible here and the reason is in `scene/sun.ts`. It is not a compromise
hidden in a constant; it is written down where the constant lives.

---

## The systems, in the order the brief specifies

| # | System | Files |
|---|---|---|
| — | Sun model — every light level derives from one elevation | `scene/sun.ts` |
| 1 | Road, camber, kerbs, lane paint, crossings, drain decals | `scene/street.ts` |
| 2 | Facades, windows, fire escapes, cornices, roofline clutter | `scene/buildings.ts` |
| 3 | Shopfronts, awnings, shutters, dumpsters, kerb furniture | `scene/props.ts`, `world/placement.ts` |
| 4 | Cars — clearcoat paint, tinted glass, recessed lamps, dished rims | `scene/cars.ts` |
| 5 | Golden sun, rolled shadow box, lamps, neon, traffic lights | `scene/lights.ts` |
| 6 | Aerial haze, backlit dust, light bars at the crossings | `scene/atmosphere.ts` |
| 7 | Procedural ambience — traffic, bar, AC, neon buzz, footsteps | `audio/ambience.ts` |
| 8 | Haze, TAA, bloom, veiling glare, AgX, FXAA, grain, vignette | `gfx/post.ts` |

Supporting: `gfx/textures.ts` draws every surface into a 2D canvas at load;
`gfx/merge.ts` batches geometry by material; `gfx/taa.ts` is the temporal
resolve; `player/controls.ts` is the gait and collision model.

## The one idea the whole thing rests on

`scene/sun.ts` exports a single elevation and azimuth, and every other light
level in the project is a function of them. Sun colour comes out of Kasten–Young
air mass and Rayleigh optical depth rather than being picked by eye. Skylight is
derived from what the direct beam lost to scattering. Lamp intensity is stored
as a *ratio* to skylight and never as a product.

That last one is not fussiness. It is the shape of the bug that prompt 4 point 1
is complaining about: the lamps were correct and scale-free, but the skylight
they were divided against had been measured at one sun elevation and frozen into
a literal. When the sun moved, the divisor did not, and a correct derivation
produced invisible lamps. Keeping the ratio makes that unrepresentable.

---

## Post-mortems

The interesting failures, because they are more useful than the successes.

**A framebuffer feedback loop that looked like a resize bug.** The whole frame
rendered black. `EffectComposer` ping-pongs between two render targets and does
not reset which is which between frames; with an odd number of swapping passes
the scene lands in target A on one frame and target B on the next. The haze pass
*samples* a depth texture attached to target A — so every other frame it was
reading a depth attachment of the target it was writing into, which is undefined
behaviour and returns black here.

It presented as a timing problem: stepping several composer renders in a row in
the console produced a perfect image, and the animation loop produced black. The
tell that it was neither timing nor resize was that setting the effect's own
strength to zero — making the shader a literal `mix(src, haze, 0.0)` passthrough
— did not bring the picture back. No arithmetic on a sampled value can do that.
The sample itself had to be invalid. Fixed by pinning the buffer parity in
`Post.render`.

**An additive effect that darkened.** The lamp cones rendered as solid black
mounds occluding the buildings behind them. Additive blending cannot darken and
cannot occlude, which is what made this worth chasing rather than tweaking: the
symptom was impossible, so the premise was wrong. `pow()` with a negative base
and a fractional exponent is NaN, a varying that is exactly 0.0 at a vertex
arrives at the fragment as `-1e-8` often enough to matter, and a NaN blended
into a float target survives the tonemap and comes out as the film pass's black
floor. Every computed `pow` base in the hand-written shaders is clamped now.

**Buildings inside the road.** For a building on the `-X` kerb, the street is at
*greater* x than its facade, so "into the building" shares the sign of `side`
rather than opposing it. It was inverted, which put all 22 buildings bodily
inside the carriageway. Because the facades still faced the correct way, it
rendered as a plausible narrow canyon rather than as an obvious error — the kind
of bug that survives a glance and dies to a wide shot.

**Clouds that computed correctly and could not be seen, twice.** First the deck
scale was three orders of magnitude too small, written as though the deck height
were in metres when it is in dome units; the noise field was sampled at
effectively a single point and produced a flawless cloudless gradient, which
looks exactly like "not implemented yet". Then, with the scale fixed, lit cloud
and clear sky were within two thirds of a stop of each other and still invisible.
A lit cloud edge at golden hour is several times brighter than the sky behind it.
Both times the arithmetic was right and the *exposure relationship* was wrong.

**Every neon sign on one side of the street.** Businesses were dealt from a pool
as bays were created, and the loop builds one whole kerb before starting the
other, so the pool ran dry partway down the second side. All seven neon signs
ended up on the sun side and the far kerb was nothing but roller shutters. It
passed the no-duplicate-signage test and still looked wrong — prompt 3's "the
right side of the street feels empty" arriving by a different route. Businesses
are now dealt after both rows exist, alternating kerbs and working outward from
where the player starts.

**Props in their zone whose geometry was not.** The placement test caught a bag
of rubbish 13 cm into the carriageway. The helper interpolated a prop's *centre*
across its zone without insetting by its own half-width, so anything wide
overhung. Fixed in the shared helper rather than at the call site the test named,
because every kerb prop routes through it.

**A renderer sized to zero.** A hidden or not-yet-laid-out tab reports an inner
size of 0×0. Sizing the renderer to that makes every attachment in the post
chain zero-size, and it never recovers, because a window that has already
reported 0×0 does not fire a second resize. There is no JavaScript error — only
`GL_INVALID_FRAMEBUFFER_OPERATION` in the console — so it reads as a shader
problem. Degenerate sizes are now ignored rather than applied, and a
`ResizeObserver` catches the tab coming back.

**A pixel ratio the composer never re-read.** `EffectComposer` caches the
renderer's pixel ratio at construction. Change the renderer's ratio and the
colour targets and the depth texture end up different sizes and the framebuffer
goes incomplete. Re-synced on every resize.

**A sky dome outside the far plane.** Scaled to 4000 with the camera's far plane
at 460, the dome was clipped away entirely. Depth testing was off, so nothing
warned; the sky was simply black.

**A ground-contact decal that measured exactly 1.000 against its own control.**
The darkening under the cars was wound facing down into the road, so the frame
was bit-identical with the effect on and off. A term that measures as *precisely*
neutral is not a subtle effect, it is a disconnected one, and the giveaway was
that the number was too clean. The decal is explicitly up-faced and
double-sided now, and the reason is in the comment rather than in this file only.

---

## Performance

The budget is draw calls, not triangles. A street built the obvious way is
several thousand `Mesh` objects and misses frame on the CPU long before the GPU
has an opinion, so geometry is grouped by material, baked once at load, and
per-object variation rides on the vertex colour attribute.

Measured — the geometry budget at load, and the frame budget from
`?playtest`, which drives a 43-second scripted route through both crossings, a
sprint, and a turn into the sun:

| | |
|---|---|
| Draw calls per frame | **157** — the batched geometry plus 5 post passes |
| Triangles per frame | **273k** |
| Resolution measured at | 2560 x 1440 (native on a 2x display) |
| **GPU time, p50 / p95 / p99** | **19.82 / 29.32 / 30.51 ms** |
| Worst frame | 32.71 ms |
| Black frames over 2580 | 0 |
| Build time | ~1.1 s, all of it procedural texture and geometry generation |

**The 30 FPS target passes** — 29.32 ms at the 95th percentile against 33.3 ms.
That is thinner than it used to be, and deliberately: the render now runs at the
display's native resolution rather than the 1.75x cap it had, which was
*upscaling* the buffer to fit a 2x screen and therefore paying for a big frame
and getting a soft one.

Thin headroom on the machine it was built on is not a shipping position, so the
resolution is **dynamic**. `gfx/adaptive.ts` measures a rolling median frame
time and moves the render scale to hold a 16.7 ms target, down to 55% and back
up when the load lifts. On this machine it never leaves the ceiling; on a slower
one the picture gets softer instead of juddering. Six checks in
`tools/adaptive.test.mjs` cover the cases that make this kind of thing
misbehave: a single hitch, an alt-tabbed tab handing back a four-second frame,
and sitting exactly on the target without hunting.

Antialiasing was measured rather than assumed, and the two obvious answers both
lost — see `experiments.tsv` and the comment in `gfx/post.ts`. MSAA 4x doubled
the frame time; SMAA cost 5.15 ms for a 1.9% reduction in edge crawl. FXAA
stayed at 2.0 ms for 5.3% overall and 13.8% in the worst region.

What finally worked is temporal, in `gfx/taa.ts`: the projection is jittered by
less than a pixel each frame and the result accumulates, so an edge converges to
the average of many sub-pixel positions. The usual objection is that TAA needs a
per-object velocity buffer, which here would mean threading a previous model
matrix through the batching that the frame budget depends on. It does not,
because everything static is nailed down — that is the batching's whole premise —
and for static geometry, reprojection from depth and the two camera matrices is
exact. The two driving cars and the animated clouds are what the neighbourhood
clamp handles. Against a 3x supersampled reference the error fell from 0.579 to
0.496, and isolated bright pixels across the five test poses went from 39 to 0.

Two results in there are worth the space because both looked wrong:

- **It runs 1.5 ms faster than not having it.** Two extra fullscreen passes
  cannot reduce GPU time, so this needed a mechanism before it could be
  believed. FXAA early-outs where local contrast is low and otherwise walks the
  edge; TAA hands it pre-resolved edges, so the walk runs on far fewer pixels.
  `?notaa` and `?nofxaa` exist so that A/B can be done on one page rather than
  across two sessions, which is what made the earlier numbers unreliable.
- **Laplacian sharpness fell 56%,** which reads as catastrophic blurring and is
  not. Pixel-to-pixel contrast is not the judge; distance from ground truth is.
  What was removed was the aliasing, which a Laplacian counts as detail.

Two caveats on the numbers, both learned the hard way. They are measured on
integrated Apple silicon, and the brief's stated target is a discrete mid-range
card that has never run this. And frame times are only comparable when taken at
the same point in a session: this same build has measured 5 ms apart on two runs
an hour into a session of repeated sweeps in the same tab, which is a fact about
the tab and not about the scene.

That number took a specific method to get. Wall-clock timing around the render
call reported 0.49 ms/frame, which is not a fast renderer — it is a renderer
whose work has been deferred, because the browser driving it was never
composited. The figures above come from `EXT_disjoint_timer_query_webgl2`, which
is the GPU reporting its own elapsed time, and any sample the driver flags as
disjoint is discarded rather than averaged in. Where that extension is missing
the harness says the result is inconclusive instead of printing a CPU number and
calling it frame rate.

The lamps are the honest trade. There are 22 street lamps and four dynamic
lights; the rest are an emissive lens, an additive cone and a pool decal. A lamp
forty metres down the street does not need to illuminate anything, it needs to
look like it is illuminating something.

---

## What is checked

```bash
npm test
```

`tools/placement.test.mjs` — ten assertions on the layout table. The one that
matters is that the walkable corridor is clear end to end on both kerbs, tested
by stepping a player-sized disc down it every 25 cm. The first attempt at
"lived-in" put down 175 individually plausible props and sealed the near footway
completely; the corridor is now reserved as forbidden geometry *before* anything
is placed, so density cannot break it. Also checked: no two props interpenetrate,
props stay between kerb and facade, parked cars stay in the carriageway, lamps
run the whole street with gaps under 18 m so their pools overlap, neither half of
either kerb is more than twice as dense as the other, no party wall lines up with
one across the street, and the layout is deterministic.

`tools/signcount.mjs` — prompt 4 point 3 as a build failure. Exits non-zero if
the street ever advertises the same business twice, or if the bar's neon appears
anywhere other than exactly once.

`world/placement.ts` imports nothing, which is what lets both tools run it under
bare `node` and assert against exactly the numbers the renderer uses.

`src/dev/playtest.ts` — the scripted route above, run with `?playtest`. As well
as timing, it samples frame luminance and counts collapses. That check exists
because the worst bug in this project rendered every frame black with no
JavaScript error at all, and no assertion on the layout table could ever have
caught it. Current run: 0 black frames out of 2580, darkest centre sample 0.60.

Beyond that, the walk was driven end to end in the live simulation — steer into
the through-zone, hold sprint for the length of the block — and it reaches the
soft wall at the far end with no stalls, which is the thing the geometric
corridor test cannot prove on its own.

`tools/shotserver.mjs` exists because the visual-critic loop needs frames the
compositor is not involved in. The page renders, reads its own drawing buffer,
and POSTs it here; a browser's own screenshot silently returns the last frame it
happened to present, which is the worst possible failure mode for a loop whose
entire job is comparing before and after.

---

## What is not good enough yet

The brief's test is to show a screenshot to someone without context, and if they
say "3D render", keep going. That test has not been passed.

- **The ground floor cannot be lit warm, and that was the whole point of prompt
  4 point 2.** A 19.2 m street between 15 m buildings under a 6° sun is
  geometrically in shadow below the third floor no matter where the sun is put.
  Bringing it round to near-axial gets light onto the road, the upper facades and
  the crossings, which is what real golden-hour street photography does. It does
  not get a warm-lit shopfront. Fixing it properly means shorter buildings or a
  wider street, both of which contradict the brief.
- **True inter-building light shafts do not exist.** The block is a continuous
  party-wall terrace, so there are no gaps for the sun to come through. What is
  there is a slab of lit haze at each crossing and the screen-space veiling
  glare, which produces shafts between rooflines for free. Everywhere else there
  is genuinely no shaft to draw.
- **The cloud decks are planes, not volumes.** No vertical parallax, and they
  will never survive being looked at from above. From a street at 10–30° they
  hold.
- ~~Windows do not reflect the street.~~ Fixed, and the cause was not the
  reflection. The facade shell spanned the full height with its face 32 cm in
  *front* of the glazing plane, so every shop window, shutter, lit interior and
  mullion had been invisible for the whole project; the probes had been working
  the entire time behind it. The glazing was also opaque — a dark metal mirror
  rather than glass — so the lit interior 0.9 m behind it could never show. It is
  now transparent at 0.30 with a grime roughness map, and the reflection accounts
  for 26% of a grazing frame.
- **Shop interiors are one flat quad per bay.** There is no parallax, so a row of
  lit frontages seen down the street reads as a continuous bright band rather
  than as a row of rooms. Side walls or a parallax-mapped box would fix it.
- **The cars are 114k triangles and still read as cars rather than as
  photographs of cars.** Body panels are extruded profiles with a 22 mm bevel;
  the door shut lines are strips standing 4 mm off the paint rather than grooves
  cut into it. (Their *lighting* was checked and is fine: p90 97 against a frame
  p90 of 62, so the clearcoat catches the lamps as it should.)
- ~~Frame rate is unmeasured.~~ Measured: GPU p95 17.82 ms, passing the 30 FPS
  target with 1.87x headroom. See Performance.

The blind critic's independent read is in [VISUAL_QA.md](./VISUAL_QA.md),
written against the renders with no sight of the code, along with which of its
findings were acted on, which was measured and found wrong, and which are still
open. Its verdict was RENDER, 0 of 5 frames passing as photographs. Two of its
observations turned out to be real bugs rather than missing features — reflections
being dimmed along with diffuse skylight, and shadows having no cool fill — and
both are fixed. One of its most confidently-argued findings, that the brick was at
model scale, was wrong by a factor of five when measured.
