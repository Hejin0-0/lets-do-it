# night-street — working document

A standing reference, not a one-off plan. Read it top to bottom when picking the
work back up: the state table says where things stand, the open items say what to
do next and how you will know it is done, and the decisions log says why things
are the way they are so they do not get re-litigated.

**Last updated:** 2026-08-23, after the quality push and a second blind-critic
pass. Items 0, 0a, 0b, 2, 3, 4 and **5** done; **1** has a criterion that is
finally the right shape (it measures lit-blank, not blank); **6** stays blocked
on hardware.

Next, in order of what the measurements say is worth doing:
1. ~~Fascias and awnings have no edge return (critic #9).~~ **DONE** — runs 18
   and 19. Awnings got end wedges on the line of the slope, support arms and a
   roller box; sign boards became 6 cm boxes. Both had to be *solids*: `trim`
   renders front faces only, so a flat end cap is culled on one side of the
   street and you see straight through the awning.
2. ~~Repetition in the fenestration (critic #10).~~ **DONE** — run 20. The pitch
   was the part worth keeping: openings stack because the piers between them
   carry load, and sliding them per floor reads as a mistake, not as variety.
   What varies is the *storey* — windows diminish with height, and a third of
   the street carries a string course at one floor's cill line.
3. ~~Temporal antialiasing.~~ **DONE** — runs 22 to 25. `src/gfx/taa.ts`.
   The objection was that TAA needs a per-object velocity buffer, and producing
   one here would mean threading a previous model matrix through `merge.ts` —
   the one system the frame budget depends on. It is not needed, because of a
   property the scene already has: everything is nailed down, which is the whole
   premise of the batching. For static geometry, reprojection from depth and the
   two camera matrices is *exact*. The two driving cars and the animated cloud
   deck are what a 3x3 neighbourhood clamp is for.

   Against a 3x supersampled reference, `aliasError` went **0.579 → 0.496** and
   the worst pose **0.809 → 0.697**. Crawl energy is down 24%, and isolated
   bright pixels over the five score poses went **39 → 0**.

   Two things in there are worth reading before touching it:
   - **It made the frame 1.5 ms *faster*** (run 24). That is impossible on its
     face — two extra fullscreen passes cannot reduce GPU time — so it needed a
     mechanism before it could be believed. FXAA early-outs where local contrast
     is low and otherwise walks the edge; TAA hands it pre-resolved edges, so
     the walk runs on far fewer pixels. `?notaa` and `?nofxaa` exist so the next
     person can re-derive that on one page instead of across two sessions.
   - **Laplacian sharpness fell 56%** (run 23), which looks damning and is not.
     Pixel-to-pixel contrast is not the judge; distance from ground truth is.
     What was removed was aliasing, which a Laplacian counts as detail.

**Read run 21 before trusting any timing.** Those three changes measured
31.15 ms and then 31.84 ms together — two consecutive runs, both ~6.6 ms over
the previous checkpoint. Bisecting gave 24.66 / 24.44 / 24.28 ms for each change
alone, and 24.52 ms for all three together on a re-run. A cost that is not
additive is as impossible as a negative one, and the answer was the same as it
was for the negative SMAA cost: the instrument. **Two consecutive bad runs are
not proof** — the machine had a sustained excursion, not a spike. Re-measure the
*same* build before you start bisecting the code.

## Final pass, 2026-08-24c — runs 38–39

**The per-window wall glow is gone.** Three sessions were spent moving it and it
never once looked right: buried at 5 cm it leaked through as the blocky patchwork
that got reported as overlapping signs, and stood clear of the wall it became two
hundred soft ovals in a regular grid — worse than the blankness it was invented
to fix. The premise was wrong. Light leaving a window at night goes *out*, into
the street; the brick around the opening is not visibly lit at this distance.
What sells a lit room is the bright rectangle `litGlass` already draws.

`meanBlank` goes back up as a result, and that is the right trade. The metric was
a proxy for "the wall looks empty"; a lattice of ovals is not less empty, it is
just wrong. The lamp wash and the neon wash stay — both have a source you can
point at in the frame, which is exactly what the window cue lacked.

**Signs were behind the wall wash.** Mount distance and tray thickness were the
same number, so a board sat 2–16 cm off the brick while the wash stands 22 cm out
to clear the facade's relief; the wash is additive and draws after the opaque
pass, so it veiled the lettering. They are separate now: `depth` keeps its
trade-specific value, `standoff` is `0.28 + depth`.

---

## Play report, 2026-08-24b — signs and lamp light (runs 33–37)

**"Most of the shop signs overlap."** Two separate causes, and neither was the
signs. Measured: the 28 boards do not intersect each other at all.

1. **The sign shadow quad, at night.** Its offset is along `SUN_DIR`, and this
   scene's sun is eight degrees below the horizon — there is no sun to cast it.
   What it did after dark was sit a hair off the wall, overlapping the board it
   belonged to, and wash a translucent rectangle across every sign. Drawn only
   when `SUN_UP` now.

2. **The wall glow was inside the wall.** `wallGlow` stood 5 cm off the
   *nominal* facade plane at `faceX`, but what is built there is not flat —
   piers, bulkheads and cill courses project up to **17 cm** past it. The glow
   was therefore buried, and being additive with `depthWrite` off it survived
   only where the relief happened to fall behind it: a run of blocky rectangles
   smeared along the facade at sign height.

   Found by **raycasting the artefact pixels and looking for near-coplanar
   pairs** — 25 of 126 samples came back with a gap of 0.000 m, both surfaces at
   x = −9.55 exactly. Hide-and-diff had answered "the facade batch owns 87% of
   these pixels", which is the trap this file already names: it says which mesh
   owns the pixels, not which causes the pattern. When two surfaces are fighting,
   ask the depth, not the ownership.

**And the glow had been invisible for its whole life.** Standing it clear made
two hundred window glows appear at once at their authored strength, and 1.6 m
across at 0.14 is a *dot* — the facades came out looking like rain on a lens.
34 cm detached them from the wall entirely; **22 cm** is the deepest relief plus
five, and the smallest margin that clears is the one to take. Widened to 3.4 m
and cut to 0.045.

That moved the metric this file has been stuck on the longest:
**`meanBlank` 0.466 → 0.322, `meanLitBlank` 0.104 → 0.066** — item 1's criterion
past its 0.35 target at last, and not by adding anything. The light was authored
years of runs ago; it simply never reached the wall.

**"The light scattering is still right-angled."** It was, literally: `lampFlare`
had `hStreak` and `vStreak`, one exactly horizontal and one exactly vertical.
That is what a camera's aperture blades do to a point source, not what a lantern
does to your eye, and two rays meeting at ninety degrees is the most
recognisably synthetic shape there is. It is now ten rays at irregular angles,
with **no ray within 20° of opposite another** — a ray and its near-antipode
read as one straight streak through the source, which is the same synthetic
shape merely rotated, and the first attempt at this made exactly that mistake.
A broad weak halo went under them, which is most of what makes the reference
photographs read as light in air rather than as a bright dot.

**Do not read run 37 as a speedup.** GPU p95 came out at 5.21 ms against 19.74
before, across a change that makes the glow quads 4.5× the area. A decal
standoff cannot do that. The variable that actually changed is the browser tab —
this was measured in a fresh pane after the previous one had been driving render
targets for hours.

---

## Play report, 2026-08-24 — five from screenshots, all fixed (runs 27–32)

**The instrument was wrong first.** Every screenshot taken this session set
`camera.position` and called `post.render()` directly, which skips
`lighting.update()`. The lamps' road reflections therefore stayed wherever the
frame loop had last put them — tens of metres away — so the harness was quietly
drawing a scene the player never sees, and the first hide-and-diff on the
reflections came back **0%**, which is why the reported artefact "could not be
reproduced". `__nightStreet.renderPose()` now runs the same update chain the
frame loop does. Anything that captures a pose must go through it.

1. **"The light is shaped like some kind of polygon."** The wet-road reflection
   texture was at full brightness at `v = 0` and cut its sides off at
   `|u| = width` with a clamped linear ramp. Both are boundaries, and on a dark
   road under additive blending a boundary is a visible straight line. It now
   fades in as well as out and its sides are a gaussian windowed to nothing
   inside the sheet; the quad's width is tied to its length so the ramp has room
   (fixed at 1.15 m it landed inside the bright 30% and read as a 40 cm bar);
   and the opacity ceiling is 0.6, because additive saturates long before alpha
   does and a saturated quad shows its own silhouette however soft its texture.

2. **The cars only ever reversed.** `buildMovingCar` passes `facing: -1`, which
   `buildCar` turns into a yaw of −π/2 — and that points the car at **+Z**, not
   −Z as the comment claimed. `dir > 0 ? PI : 0` then turned both cars 180° away
   from their travel. The head and tail lamps are added to the parent rather than
   the body, so they stayed on the correct ends: the car had its lights the right
   way round while its shell faced backwards, which is why it read as reversing
   rather than as something being mirrored. Settled by silhouette, not algebra —
   a saloon's bonnet is longer than its boot.

3. **The cars drove through the parked rank.** `LANE = ROAD_HALF * 0.5` = 2.70
   spans 1.56 to 3.86; a parked car at `PARK_X` 3.95 spans 2.80 to 5.11. Over a
   metre of overlap, for the whole street. A fraction of the road width was the
   wrong way to express it — the constraint is where the parked cars are, so
   `LANE` is now 1.40, derived from that: 25 cm clear of the rank, 24 cm of the
   middle line.

4. **Turning round at the start showed the world ending.** The far end had the
   treatment all along: buildings 8 m past the walk limit, closing terrace 20 m
   beyond. The near end began the rows at exactly `START_Z`, and the player can
   back up to `START_Z + 1.5` — one and a half metres past the last building,
   looking at 13 m of nothing with a lit slab floating behind it. `NEAR_BLOCK`
   carries the terraces 10 m behind the start, the closing terrace moved to
   z = 34, and two lamps per side were *prepended* so that no existing lamp moved.

5. **"Sometimes running turns into walking."** Not stamina — there is none in
   this controller; running is a held key and nothing else. `resolve()` applied
   `clampToStreet`/`clampZ` and reported **no normal**, so `controls.update`
   projected nothing and the velocity kept pointing into the street edge at full
   run speed while the player stood still. `controls.speed` — which the gait, the
   footsteps and the HUD all read — said 4.8 m/s with the player pinned. Coming
   off a wall then had to swing a full-speed vector round to the new heading
   through the 0.12 s ramp, which is what felt like dropping to a walk.

   Pinned now reads **3.39 m/s** = 4.8·cos 45°, the true along-wall speed, and
   recovers to 4.8 in 0.3 s. The HUD says "held up" with the speed, so the reason
   is visible rather than guessed at. `collide.test.mjs` gained an eighth check:
   the bounds must report a normal, and must stay silent when they did not act.

Side effect worth knowing: `NEAR_BLOCK` shifts the layout RNG, so the whole
street reshuffled — 124 props and 20 parked cars where there were 129 and 25.
The sweep metric did not move (`meanBlank` 0.465 → 0.466, `meanLitBlank`
0.109 → **0.104**), so it does not read emptier; but any number in this file
taken before run 27 is against a different layout.

---

**Last updated:** 2026-08-24. Runs 18–32. All three items above are done, and
critic #7 (the blocky mosaic) closed with them — it was aliasing, so TAA took it
out without being aimed at it (run 26, −58.7% stepping).

**The only thing still open is item 6**, the frame budget on a discrete GPU, and
it is blocked on hardware this session does not have. Everything measured here
is on integrated Apple silicon.

**Last updated (previous):** 2026-08-23. Items 0, 0a, 0b, **2, 3, 4** done. **Item 1 is
partly done and its acceptance criterion has now been wrong three times — read it
before continuing, and re-derive the 0.35 target before chasing it.** Items 5 and
6 are blocked on things this session cannot supply: a code-blind reviewer and a
discrete GPU.

Next session: either re-derive item 1's target from the current grade, or pick up
item 2's remaining weakness (shop interiors are one flat quad per bay, so a row
of lit frontages reads as a continuous band at grazing angles).

---

## How to work on this

```bash
npm run dev                       # http://localhost:5173
npm run check                     # heading + placement + signage tests, then a build
node tools/shotserver.mjs shots   # in a second terminal, for the two dev routes below
```

| Route | What it does |
|---|---|
| `/?playtest` | Drives a 43 s scripted route and reports **measured GPU frame time**, plus a black-frame count. Verdict prints to the HUD and console, and lands on `window.__playtest`. |
| `/?sweep` | Renders 24 frames down the block into one contact sheet and POSTs it to the shot server. |

The contact sheet is the tool for judging density and repetition; three hero
shots cannot show either. The playtest is the only trustworthy frame-time
number — see the decisions log.

---

## Measured state

| | | |
|---|---|---|
| GPU frame time p50 / p95 / p99 | **11.03 / 17.82 / 18.17 ms** | budget 33.3 ms (30 FPS) — passes, **1.87x headroom** |
| Worst frame | 18.67 ms | distribution is tight; p50 to max is 1.7x |
| Draw calls per frame | 167 | whole chain, incl. 4 post passes |
| Triangles per frame | 262k | no shadow pass after dark — see below |
| Real point lights at night | 7 | measured at **0.68 ms each** |
| Blank share, mean / worst | **0.388 / 0.696** | item 1; see the note on re-deriving the target |
| Sky vs street, zenith p50 / lamp p99.9 | **27 / 191** | night is when the lamps are the brightest thing |
| Shopfront glass | transparent, 0.30 | interior reads through it; reflection is 26% of a grazing frame |
| Sign trades on the block | **5** | neon, painted, lightbox, vinyl, enamel |
| Resolution measured at | 2520 x 1417 | frame times mean nothing without this |
| Black frames / 2580 | **0** | the silent-failure detector |
| Pavement contrast, lamp vs midway | **2.13x** | was 1.07x — item 0a |
| Darkest point on the walking line | 51 / 255 | lit, but not washed — item 0a |
| Window interior variants | 16 | one atlas, still two draw calls |
| Frontage occupied | **90%** | was 36% |
| — of which shopfront | 67% | rest is vacant / residential / garage |
| Distinct businesses | 28 | all unique, enforced by test |
| Buildings with no frontage at all | **0** | was 13 of 22 |
| Walk / sprint | 2.3 / 4.8 m/s | block is **168 m** (was 126; the rest was built and unreachable) |
| Tests | 8 heading + 12 placement + signage | `npm test` |

---

## Asset sites — checked, and blocked at my end

Asked for three times, so it was actually investigated rather than argued about
again. Network access works; both sites resolve.

**polyfork.dev.** Licence terms, verbatim from their FAQ: commercial use is fine
and no attribution is required, but *"What you cannot do is resell or
**redistribute the assets themselves**"*. This project is a public repository, so
committing their GLB files **is** redistribution and the licence forbids it.
Downloads also sit behind a sign-in, and creating accounts is something I cannot
do on your behalf. Two independent blockers.

**kenney.nl.** The site is JS-rendered, so the licence text is not in the served
HTML and `/faq` is a 404. Kenney is very widely CC0 and I believe it is, but I
have not been able to *verify* it from the source and will not assert it.

So the asset route is not something I can carry out — not a preference. If you
want it, the two things only you can do are: sign in and download, and confirm
the licence permits committing the files here. Drop the archive in `public/` with
a `CREDITS.md` and I will wire it up.

Meanwhile the "Lego block" note was addressed procedurally — see below.

---

## Performance — where the time goes

Measured with `?profile`, and more importantly with within-run A/B comparisons
that repeat the baseline afterwards to check for drift. Numbers from different
points in a session are **not** comparable: the same scene measured at page load
and again after a 43-second playtest differed by 2x, almost certainly GPU clock
state. Only compare measurements taken back to back.

At a fixed busy viewpoint, before this pass:

| | |
|---|---|
| Whole frame | 17.79 ms |
| Point lights (11) | **7.43 ms — 42%** |
| Post chain (haze + bloom + glare + film) | 2.76 ms — 16% |
| Everything else (geometry, materials, overdraw) | ~7.6 ms |

Three changes, in order of what they bought:

1. **No shadow pass after dark.** `sun.castShadow` was unconditional, so a 2048
   square shadow map was being rendered every frame for a directional light whose
   intensity is exactly zero. Triangles per frame **488k -> 261k**. This one was
   not measured, it was reasoned: the profiler reported disabling shadows as
   *costing* 12 ms, because toggling it recompiles every material and the
   recompile landed in the timing window. A light of intensity zero cannot cast a
   shadow, so no measurement was required to know the work was wasted.
2. **Bloom at half resolution.** Measured at 4.4 ms of an 8.9 ms frame — the one
   number the profiler produced twice in a row. Bloom is a wide low-frequency
   blur, so it is the effect least able to notice: quarter of the pixels, and the
   source it keys off is unchanged.
3. **Point lights 10 -> 7, with the fade range closed from 38 m to 26 m.** three's
   forward path evaluates every point light on every lit fragment, so a light
   faded to zero by distance costs exactly as much as one at full brightness.
   With a 38 m reach and lamps every 8 m staggered, three or four of the ten were
   always contributing literally nothing at 0.68 ms each. **The blank-share
   measurement did not move** (0.405 -> 0.402), which is the proof they were
   dead weight rather than a quality trade.

Result: p95 **22.54 -> 16.73 ms**, worst frame **27.82 -> 17.53 ms**, headroom
**1.48x -> 1.99x**.

**If more is needed**, the honest next targets are the remaining ~7.6 ms of scene
cost — 2520x1417 is 3.6 Mpixels and the pixel ratio cap of 1.75 is the largest
single lever nobody has pulled — and then the point-light count again, at a
known 0.68 ms each.

**A note on the profiler.** It gave nonsense twice before it gave anything
useful, and both times the tell was the same: a *negative* cost. Disabling
something cannot make the frame faster. Anything that changes shader defines —
light counts, shadow state — recompiles materials, and the recompile lands in
the measurement. Sixty warm-up frames absorbs it; a suspicious sign does not.

---

## Open items

Ordered. Each has an acceptance criterion, because "looks better" is not one.

### ~~0. Facades unlit at night~~ — DONE
Three separate causes, and the one that mattered most was not in the list:

- **The fill light was multiplied by zero.** It was `SUN_INTENSITY * FILL_RATIO`,
  and `SUN_INTENSITY` is 0 after sunset — so the one term whose entire job is
  stopping surfaces going black switched itself off at the moment it was needed.
  Now an absolute `FILL_LEVEL`, sodium-tinted from below rather than cool from
  above, because after dark the fill is the town and not the sky.
- **Nothing washed the walls.** Each lamp now lays a soft patch up the facade
  beside it, and each lit window and shopfront lights the wall it is set into.
- **Window spill was aimed at the ground.** See 0a — it was moved to the wall,
  which is both where it belongs and what fixed 0a.

*Measured against the criterion:* on the 24-frame night sweep, window frames are
legible in the large majority of frames and balcony railings in 9 of 24 (37%),
against a target of one third. Balconies only got there after the railings were
repainted: dark iron on a dark wall is invisible at night even when it is lit,
which is a lighting problem that looks like a geometry problem.

*Watch:* the wall wash overshot once already, at three times its current
strength, and flattened the brick it was meant to reveal. A wash bright enough
to erase the texture is worse than none, because the detail is still being paid
for and now cannot be seen either. It is still slightly too strong at arm's
length from a wall.

### ~~0a. Lamp light runs as one endless line~~ — DONE
The discriminating test in the old version of this entry worked: hiding the pool
mesh removed the streak outright, so the pools owned it and neither bloom nor
fog needed touching.

Two real causes, both found by measuring the pavement brightness along world Z
rather than by looking:

1. **Two hundred windows were each paving the street.** Every lit window on the
   lower two floors dropped a 4.6 m disc of light on the pavement. Two hundred
   overlapping discs do not read as two hundred windows, they sum to a flat even
   wash — and it swamped the lamps completely. Under a lamp measured **1.07x**
   the brightness midway between two lamps. Window spill now goes on the wall.
2. **The pools were longer along the street than across it.** `size x size*1.35`,
   with the length on the street axis — precisely the shape that makes
   consecutive pools touch. They are now wide and short, and the pavement pool is
   centred on the through-zone rather than on the kerb, because the walking line
   was catching only the tail of a pool centred a metre away.

*Measured against the criterion:* lamp-to-midway contrast **1.07x -> 2.13x**,
with peaks landing exactly on the lamps at z = -12, -28, -44. Darkest point on
the walking line is 51/255 — countable pools, no dark stretch. The 18 m lamp-gap
assertion in `placement.test.mjs` did not need changing.

### ~~0b. Windows are frames with nothing in them~~ — DONE
- **16 interiors instead of 2.** The whole street shared one lit texture and one
  unlit one. They are now a 4x4 atlas — ordinary rooms, a lamp, a doorway, a
  television, a stairwell with coloured glass, a boarded pane, a net curtain, a
  half-drawn blind — addressed per window through a UV offset, so it is still two
  draw calls. Curtains are drawn independently on each side of each cell, which
  is the cheapest single source of variety in the whole file.
- **Security bars** on 62% of ground-floor and 28% of first-floor openings, with
  two horizontals so they do not read as a picket fence.
- **Unlit glass is now a mirror**, not a dark picture. It was the same unlit
  material as the lit state, which is why every dark window read as painted on.
  Metallic and smooth now, so it reflects the sky and the building opposite —
  and the difference between the two states is the point of the pair.

*Watch:* the lit emissive overshot to 3.4x on the way here and pushed every
window past the bloom threshold, growing a soft halo far larger than the opening.
Bright enough to carry the facade, not so bright the bloom turns it to a blob.

### 1. Near-wall repetition — the criterion is finally the right shape

**The target was re-derived by changing what is measured, not by picking a
different number.** Three times a threshold went stale because the scene got
darker underneath it, and the reason is that one figure cannot tell "there is
nothing on this wall" from "it is night and that wall is thirty metres from a
lamp". The first is a defect; the second is the scene being correct, and every
attempt to drive it down meant putting light where the street does not have any.

`blankShare` now splits the blank tiles by how *lit* they are:

| | |
|---|---|
| mean blank, the old blended figure | **0.455** |
| of which blank *and* lit enough to have shown something | **0.100** |
| so: share of the "blankness" that is simply night | **78%** |

Only the 0.100 is actionable, and unlike the blended figure it does not move when
the grade does. The tile map marks them separately: `#` blank and dark, `X` blank
and lit, and the sweep now picks its worst frame by the lit half — the darkest
frame's map is a wall of `#` that says only that it is night, while the worst
lit-blank frame's map shows where there is something to fix.

**What that then said, and what it cost to find out.** The worst frames put the
lit-blank tiles on the lit ground and the mid-distance wash. Four candidates were
measured and three came back nearly flat:

| removed | lit-blank |
|---|---|
| nothing (as shipped) | 0.321 |
| the post haze pass | 0.275 |
| the bloom | 0.313 |
| `scene.fog` at 0.0005 | 0.313 |
| the wall glow | **0.383 — worse** |

No single effect accounts for it, the fog is not the cause (measured twice now,
once with each metric), and the wall glow is holding it *down*. What is left is
smooth lit surfaces, which is what pavement under a lamp looks like — so the
remaining lever is content, and grime on the lit ground is the one that went in.

### 1b. The earlier working notes — criterion replaced twice

**Read this before doing more work on it.** The interesting content of this item
turned out to be about measurement, not about walls.

**The original criterion was measuring the opposite of what it meant.** It said
"no frame is more than ~60% one flat material" and was implemented as a colour
histogram. Checked against the sheet, the *emptiest* frames scored best — a
smooth gradient across a blank wall spreads over dozens of colour bins and reads
as varied, while an expanse of even night sky collapses into one bin and reads as
flat. A metric anti-correlated with its own name is worse than none, because it
launders a judgement call into a number. Replaced with an edge-density measure:
the frame is tiled, each tile scored by how many of its pixels sit on a
luminance gradient, and the result is the share of tiles with no structure.

**Then it was measuring the sky.** The first honest run said mean 0.498. A full
pass of facade work — ghost signs, second downpipes, rainwater hoppers, conduit
crossing party walls, twice the vents, dishes on half the roofs, stronger normal
maps, bricked-up openings — moved it to **0.499**. That is not a verdict on the
work, it is a verdict on the measurement: the tile map showed whole rows of blank
tiles that were sky and unreachable. The metric now renders a proper sky mask
(everything black, sky hidden, cleared white) and excludes those tiles.

**Then the cause turned out not to be geometry at all.** With the sky excluded,
a discriminating test — quadruple the wall wash, sextuple the fill — dropped the
blank share from 0.476 to **0.267**. So the detail was all present and simply
unlit. An additive wall wash raises a wall's brightness uniformly and therefore
creates *no edges*; only a real light at a grazing angle casts the small shadows
that relief is made of. Real point lights at night went 6 → 10, fill 0.30 → 0.62.

**Where it landed:** mean blank **0.476 → 0.405**, frames over the 40% budget
**17 → 12**. The criterion is **not met** and should not be forced.

**Why the rest is probably truthful.** What is still blank is upper facades far
from any lamp. A street lamp is five metres up and a building is fifteen; the top
of a night facade genuinely is dark, and real night photography of a street like
this shows exactly that — dark brick punctuated by lit windows. Frames 15, 21, 4
and 16 score 17-29% because the opposite side is lit by its own windows; frames
12 and 24 score 60%+ because a near wall in shadow fills them, which is what
standing next to a wall at night looks like.

**Suggested revised criterion:** *mean* blank share below 0.35 across the sweep,
and no more than a quarter of frames over 0.55 — rather than a hard per-frame
cap that only full daylight could satisfy. The remaining honest levers are more
lit windows on upper floors and window spill on the wall around each one, both of
which add edges where they are actually missing.

**Cost, and it is not small.** 6 → 10 point lights took GPU p95 from 17.54 ms to
22.54 ms and headroom from 1.9x to **1.48x**. That bought a 15% blankness
improvement for a 29% frame-time increase. If the budget gets tight, this is the
first thing to reconsider — and it makes item 6 (measure on a real GPU) more
pressing than it was.

**Kept regardless:** the ghost signs, extra services and bricked-up openings did
not move the metric under this lighting, but they are real content that pays off
under any lighting and are cheap. They were not reverted.

---

### Pass of 2026-08-23 — mean 0.439 → **0.386**, over-0.55 frames **5 of 24**

**A guard that outlived its consumer.** Window cues were gated to the lower two
floors — `if (f < 2)` — with the comment "above that the spill does not reach the
ground". True of what the cue did *then*: it made a pool on the pavement. It had
since been changed to light the wall the window sits in, and a fourth-floor
window lights its own wall exactly as well as a first-floor one. So the upper
facades — the part that measures blankest — were the one part deliberately
excluded from the only light that reaches them. Removing the gate: mean **0.439 →
0.386**, +4 draw calls, no new lights. Frames 11 (0.49→0.38), 23 (0.51→0.39),
15 (0.23→0.19).

**The additive-wash intuition is wrong here, and it was worth testing.** The
earlier note says an additive wall wash "creates no edges", and hiding meshes one
at a time showed the wall-glow batch owning 24% of the worst frame's left third —
which read as the wash flattening the wall. Measured on frame 24 instead of
argued:

| | blank share |
|---|---|
| wall glow on | **0.646** |
| wall glow hidden | 0.771 |

The glow is not flattening the wall, it is the only reason the wall is legible.
"It covers 24% of the frame" meant it *is* what you see there, not that it is
doing harm. Third time in this project a confident diagnosis lost to a
measurement.

**Tried and reverted: a mottled light cookie.** On the theory that a smooth
radial falloff adds brightness without edges, `cookieAlpha` modulated the falloff
by brick-scale noise — the standard lighting-cookie trick. Result: mean 0.386 →
0.387. It did not do the one thing it was added for, so it was removed rather
than kept for being more correct in principle. The amplitude that survives an
additive quad at 0.14 intensity is a couple of levels, well under the detector's
threshold.

**What is actually left, from the tile map of the worst frame (24, 0.674):**

```
##..###.   <- top
##.....#
###.....
###....#
########
########   <- bottom
```

Two distinct regions, and they want different answers:
- **Bottom two rows, entire width** — unlit road and pavement in the foreground.
  Frame 24 sits between lamps. This is not missing detail, it is missing light,
  and at 21:00 that is what a road between two lamps looks like.
- **Left three columns** — the near wall at a grazing angle.

**The 0.35 target should be re-derived before it is chased.** It was proposed
when the mean was 0.405 — under `EXPOSURE 1.85`, with the sky shader failing to
link and the scene reading as blue hour. The grade has since come down about two
stops to an actual 21:00. A target calibrated against a scene two stops brighter
is not a target for this one, and closing the remaining 0.036 by adding light
would mean putting light where the scene does not have any. Recommend: re-run the
sweep after any further grade change and set the target from the new baseline,
or drop the mean criterion and keep only the over-0.55 count, which passes at
5 of 24 against a budget of 6.

Performance after this pass, fresh page load: GPU p95 **17.81 ms** against 33.3,
167 draw calls, 262k triangles. (Not comparable to the 30.82 ms recorded earlier
the same day — that reading came after an hour of measurement work in the same
tab. Same trap as before: only compare readings taken at the same point in a
session.)

### ~~2. Shopfront glass still does not reflect the street~~ — DONE
Upper-floor windows do now — unlit panes went metallic in 0b and mirror the sky
and the opposite facade. Shopfront glazing at eye level does not: it is still a
smooth dark material taking only the probe, so a car parked in front of a shop
does not appear in the window behind it, and eye level is exactly where that
absence is most visible.

*Done when:* a parked car is identifiable in the shopfront glass behind it.

**Diagnosed 2026-08-23 — the criterion was aimed at the wrong thing.**

Two blockers were in the way, and only the first was known:

1. The facade shell spanned y=0 to the roofline with its face 32 cm *in front*
   of the glazing plane, so every shop window, shutter, lit interior, mullion
   and stall riser on this street had been invisible for the entire project.
   Fixed: the shell now starts at `SHOPFRONT_HEAD`, with piers at the party
   walls and a dark back wall behind the openings.

2. With the shell out of the way, the glazing still reads as a flat panel.
   Measured, not guessed — hiding the 14 glass meshes changes **77% of a
   square-on shopfront frame** at a mean delta of 99/765, so they are drawing,
   and drawing over everything. The material is:

   - `transparent: false, opacity: 1` — opaque. It is not glass, it is a dark
     metal mirror (`metalness 0.85`, `roughness 0.14`, `#1b2028`), which is why
     an *open* shop shows no interior: the lit plane behind it is occluded.
   - `map: null` — no dirt, no streaks, no mullion pattern, nothing.
   - 86 triangles across all 14 meshes — roughly one quad per shopfront.

   A flat, opaque, untextured panel is exactly the "toy stamped from a mould"
   in the original complaint. The probes work; the surface they were attached to
   was never glass.

Also found: every business with `shutter: false` in the table is also
`open: true`, and every `shutter: true` is `open: false`. The two are perfectly
correlated, so at night this street has **no unlit-but-glazed shopfront at all**
— every frontage is either a closed shutter or a lit interior. There is no
surface for a dark mirror to be, which is a second reason the criterion as
written could never have been met.

*Revised done when:* an open shop reads as glass — the lit interior visible
through it, a reflection over the top of that rather than instead of it, and
some surface of its own (dirt, mullions) so it is not a single flat quad. The
parked-car reflection is a consequence of that, not the goal.

**Done.** Four changes, each verified rather than assumed:

- **Transparent** (`opacity 0.30`, `depthWrite false`). The interior plane that
  had been sitting 0.9 m behind opaque glass since it was written is now
  visible. `envMapIntensity` scaled by `1/opacity` because opacity multiplies
  the whole fragment, envMap included.
- **`glassGrime()`** as a roughness map — streaks, splash up the bottom 300 mm,
  smears. Clean glass is a perfect mirror and a perfect mirror on a flat quad is
  a painted panel.
- **Frame**: end posts, head and bottom rail. The mullions only sat *between*
  panes, so a two-pane shopfront had one bar in the middle and no joinery at its
  edges — glass floating in a hole.
- **`shopInterior()`**, replacing the apartment-window generator the shopfronts
  had been borrowing. That one is a 128px vertical gradient with curtains, built
  for a 1.2 m sash across the street; stretched over a 4.6 m frontage two metres
  away it has no content, and the moment the glazing went transparent every shop
  read as a lightbox. The replacement is horizontal structure — strip light,
  shelving with stock silhouettes, counter — with row count, start height and
  pitch varying per shop, because regular rows put every shop's shelves at the
  same height and at a grazing angle that reads as one stripe running through
  every frontage. `windowInterior` had no callers left and was deleted.

Measured after:

| | before | after |
|---|---|---|
| reflection's share of a grazing frame | — | 25.9% (mean delta 12.9, peak 326) |
| clipped-to-white pixels, three shopfront shots | blown out | **0** |
| `blankShare` mean | 0.484 | **0.439** |
| worst frames | 19, 24, 12, 7 | unchanged — blank *walls*, which is item 1 |

Emissive came down from `(3.4, 2.3, 1.35)` to `(1.55, 1.08, 0.62)`. That value
had never been looked at, because nothing had ever drawn it.

~~*Still weak:* the interior is one flat quad per bay, so there is no parallax.~~
**Done.** Each open shop is now a shallow box — back wall, two returns, ceiling,
floor — merged into the one mesh and material it already had, so it costs no
extra draw call. The returns are what does the work: they *converge*, differently
for every shop and differently as you move, which is what a flat plane cannot do
at any texture resolution.

Three things went wrong on the way, all of them the same kind of mistake and all
of them visible in one screenshot each:

- **The box was sized to the glazing, not the room.** Spanning 0.7 m to
  `glassTop` put its "floor" 84 cm up, which from the kerb read as a lit shelf
  jutting out of the shopfront. It goes to the pavement now; the stall riser
  hides the bottom, which is what a stall riser is for.
- **The ceiling and floor were rotated 90 degrees wrong.** Scaled
  `(roomW, depth)` after a -90 about X, the quad's local X is the *depth* — so
  the room's 4.5 m width was laid out across the street instead of along it, and
  a lit ceiling plane hung out over the pavement and into the road.
- **They also carried the wall texture,** so the room read as a mirrored box with
  stock on the floor and upside down overhead. The sheet already has the two
  bands they want — the strip light along the top, the counter mass along the
  bottom — so they take a thin `uv` slice of the right one.

Cost: GPU p95 17.67 to **18.26 ms**, for five times the interior geometry.

### ~~3. Sign typography is still one voice~~ — DONE
Every sign was `700 Helvetica Neue`, centred, with one treatment. Now there are
five trades, chosen per business from a hash of its id:

| trade | face | tells |
|---|---|---|
| neon | Avenir, wide tracking | tube halo, hot white core |
| painted | Georgia serif | baseline wobble, paint chipped to primer |
| lightbox | Helvetica 800, tight | lit tray gradient, yellowed, dark extruded edge |
| vinyl | Trebuchet 300, +7px tracking | hard edges, film lifting off the board |
| enamel | Copperplate, +5px | keyline border, drop-shadowed letters, one gloss diagonal |

Mounting depth now follows the trade instead of `id.length` — lightbox 0.16 m,
painted 0.08, enamel 0.05, vinyl 0.02, because vinyl is stuck to the glass and
has no depth at all. The comment above that line had *claimed* this for a while
while the code used a hash of the name's length.

Three things were wrong and are worth keeping written down:

- **The memo key omitted the style.** `sign:lines+ink+plate+neon` would have
  handed two businesses the same texture whichever style was baked first. Any
  cache whose key misses an input is the same bug; this one was caught before it
  shipped only because the key was being edited anyway.
- **Sizes were hardcoded per line-count.** Copperplate at +5px tracking sets
  ~1.6x the width of tight Helvetica at the same pixel size, so the wider faces
  ran off the board. Text is now fitted by measurement.
- **The vinyl lift was drawn with `destination-out`,** which punches through to
  transparent; on an opaque board that composites as black, so every vinyl sign
  came out spotted with what looked like mould. A lift shows the *board*, so it
  is painted in the plate colour — which also makes placement self-correcting,
  since a plate-coloured mark landing on the plate is invisible.

`id.length` was the seed for the sign, the mounting depth and the room behind the
shop window; a dozen businesses share a length. Replaced with `hashId`.

*Done:* the 28-sign sheet reads as five different sign-makers.

### ~~4. Lamp glows are perfect circles~~ — DONE
Half of this was already fixed and the note was stale: there *is* a pool under
each fixture (`lights.ts`, 9.2 x 6.6 m at the lamp head). The circle was real.

The halo was `radialAlpha(2.8)` on a 2.9 x 2.9 m plane — a mathematically perfect
circle with a perfectly smooth falloff. Replaced with `lampFlare()`, which bakes
what a photograph of a sodium lamp actually contains:

- a broad soft scattering halo, which *is* round;
- a much tighter, hotter core where the lens blows out;
- a horizontal diffraction streak — the most recognisable feature and the one
  that was missing entirely;
- a weaker vertical streak crossing it;
- colour that changes with heat rather than with radius: near-white at the core,
  through sodium orange, to deep red at the rim.

The last of those is why the material's tint is now neutral — a single colour
multiplier cannot make the rim a different hue from the core, so the hue moved
into the texture. The plane is 4.0 x 2.9 m: a luminaire's lens is a flat
horizontal panel, and the streak needs room to run.

### ~~5. Second blind-critic pass~~ — RUN, and triaged

A fresh agent, given only the 24-frame sweep and four close-ups, told not to
read a line of code. Twelve findings. The verdict it was asked for, in one line:
*no, and the single strongest reason is that nothing casts a shadow.*

That was right, and the cause was one line: `renderer.shadowMap.enabled = SUN_UP`,
which is `false` after dark. The reasoning behind it is still correct — a
directional light of intensity zero cannot cast anything, so the pass was pure
waste — but the scene has since gained seven point lights and a spot, and none of
them were given shadows either. The street had **no shadows at all**.

**Acted on:**

| # | finding | what was done |
|---|---|---|
| 1 | nothing casts a shadow | contact shadows under every solid prop. Not shadow maps — seven point lights times a full pass each is unaffordable, and the contact is the part that carries the cue that a thing is *on* the ground |
| 3 | no reflection anywhere; "a night street photograph is mostly reflection" | wet-road lamp reflections. These cannot come from the probe: it is convolved from a sky that is nearly black at 21:00, so a physically-correct mirror reflects nothing. Drawn instead as the *shape* a reflection makes — anchored at the lamp, stretched toward the viewer, fading as the view leaves the grazing angle |
| 5 | fog thick enough to erase a building at 30 m, and no light shafts under any lamp | the shafts were at 0.055 strength, chosen while `uStrength` was undeclared in the fragment shader — i.e. tuned against a cone that was not drawing. Raised to 0.15 |
| 8 | pavement has no joints, cracks or colour variation | grime on the lit ground, placed densest around the lamps |
| 12 | no overhead cables anywhere | cables across the street, with catenary sag. Drawing them straight is the giveaway |

**Partly wrong, and worth recording so the next pass does not chase them:**

- **#4, "emissive surfaces emit no light".** They do — there are wall-glow and
  pavement-pool cues for neon, windows and shopfronts, and the pink pool a TATTOO
  sign lays on the pavement is visible in any shot taken from the right side of
  the street. The critic's sampled frames did not happen to contain one.
- **#2, "the camera walks through parked cars".** It does not: the walk corridor
  is x = 6.5..8.7 and the cars park at 3.95. The sweep camera passes 3.6 m away
  and a dark car body fills the frame, which looks the same in a still.

**Then acted on in a second pass:**

| # | finding | what was done |
|---|---|---|
| 6 | three different hours in one sky — a starfield, a blue-hour band and full night lighting | stars thinned about four-fold and warmed, zenith warmed toward the brief's own words, "that deep dark blue-orange city sky from light pollution". A street like this shows a handful of the brightest, not a field of forty |
| 10 | every lamp identical in spacing, head, output and colour | per-lamp colour temperature, wear and a one-in-thirteen chance of being out, seeded off position so the dead one does not move between reloads. 25 of the 28 now differ. A council relamps one head at a time over years |
| 11 | concentric contour rings in the light pools | the falloff ramp is dithered before it is quantised to eight bits. Magnified across nine metres of pavement every 1/255 step was a ring a hand's width across; a fraction of a level of noise turns the step into a dissolve |

**Still open:** #7 (stair-stepped edges — the same artefact as the blocky mosaic,
now understood as aliasing and reduced but not solved), #9 (fascias and awnings
have no edge return, which at eye level is exactly what you are looking up at).

### ~~5b. The old note~~ — BLOCKED on a fresh reviewer
*Done when:* a fresh critic, code-blind, is given a 24-frame sweep and its
findings are triaged the same way as the first round — acted on, disproved by
measurement, or recorded as open.

**Not satisfiable by the agent that wrote the code.** The value of the first pass
was that the critic could not see the implementation and therefore could not
explain a defect away. Self-review cannot reproduce that. Running it needs a
subagent, which is outside what this session is authorised to spawn.

**A non-blind pass was run instead**, against the 24-frame sweep, and it is worth
recording what that is worth. Four findings; two were already known, two were new
and both were **disproved by measurement**:

- *"The distance is washed out — the haze is too heavy."* `scene.fog.density` is
  runtime-settable, so it was tested directly rather than argued: 0.0062 → 0.0018
  (3.4x less fog) moves blank share 0.354 → 0.333 and interquartile contrast
  46 → 44. The murk at the vanishing point is not the fog term. `HAZE_DENSITY`
  unchanged.
- *"Parked cars are featureless black masses."* Isolated the car pixels by
  hiding the meshes and diffing. Car p90 **97** and p99 **169** against a frame
  p90 of 62 — the clearcoat is catching the lamps properly. A dark body with
  specular highlights is what a car at night looks like. Not a defect.

The other two — the grazing-angle shopfront band, and the near wall plus unlit
foreground — were already logged under items 2 and 1. So the pass mostly
rediscovered what was already known, which is the predictable failure of a
non-blind review and the reason the item stays open rather than being closed on
this basis.

### 6. Frame budget on a real GPU — BLOCKED on hardware
Measured here on integrated Apple silicon. A discrete mid-range card is the
brief's stated target and has never run this.

Current numbers, fresh page load, `EXT_disjoint_timer_query_webgl2`, 2520x1417:

| | |
|---|---|
| GPU p50 / p95 / p99 / max | 11.03 / **17.82** / 18.17 / 18.67 ms |
| budget | 33.3 ms (30 FPS) |
| headroom | **1.87x** |
| draw calls | 167 |
| triangles | 262k |
| black frames | 0 |

Everything added since the last measurement — transparent shopfront glazing with
a grime roughness map, shop interiors, window frames, wall glows on every upper
floor, five sign treatments, the lamp flare — cost **0.01 ms** at p95 (17.81 →
17.82). The work went into batched geometry and generated textures, neither of
which the frame time is sensitive to; what it is sensitive to is point lights,
and none were added.

Only compare readings taken at the same point in a session. The same build
measured 30.82 ms at p95 an hour into a session of repeated sweeps and profiles
in the same tab. That is the tab, not the scene.

---

## Play report, 2026-08-23 — five findings from screenshots

Handed over as five screenshots after a real walk. Four are fixed, one is
reproduced and still unidentified, and the process is worth recording because
three of my first diagnoses were wrong and the measurements corrected all three.

### 1. Floating hexagons and crescents in the air — FIXED
Trains of hexagonal blobs climbing the sky above every lamp, plus crescents on
walls and in windows. Chased through four wrong guesses (bloom ghosting, dust
motes, billboard clipping, additive quads) before the decisive test: rendering
the scene *without* the post chain removed them entirely, and then disabling one
pass at a time isolated the **glare pass**.

The cause is in its shape, not its parameters. The glare marches nine taps from
each pixel toward the sun's screen position. Nine taps is a comb, and a comb
dragged across a small very bright source stamps that source once per tooth — so
each lamp got copied nine times along the line, each copy the lamp housing's own
silhouette.

Two fixes, because the second is what the pass is actually for:
- `GLARE_STRENGTH` is **0 at night**. The pass models light spilling round the
  roofline from the *sun*; after dark it is aimed at a point 8 degrees below the
  horizon, so what it smears is street lamps, modelling nothing. The shader
  early-outs at 0, so the night path also gets a pass back — p95 went 17.82 to
  17.45 ms.
- The march start is now jittered per pixel, so the daytime path cannot stamp
  replicas either.

### 2. The world visibly ends — FIXED
Standing at the end of the walk and looking on, the carriageway ran out into open
ground and met the sky. Buildings run z=+8 to -181; the road surface ran +18 to
-218. The haze does not cover it: at 68 m it still passes 65%.

A real street shows you the next block, not the horizon. Both ends now carry a
crossing terrace (`closingTerrace`) — three set-back masses with lit windows,
built into the batches that already exist, so no new draw calls. The road overrun
is now explicit and asymmetric (`NEAR_OVERRUN` 34, `FAR_OVERRUN` 50): the first
attempt put the near terrace 1.5 m from where the player can stand and the view
was a dark rectangle.

### 3. Traffic lights read as crescent moons — FIXED
The hood sat 4 cm above the lens centre with a 13 cm radius against the lens's
9.5 cm, so the cone's base covered almost the whole lens and what showed was the
sliver below it. A visor shades from *above*; raised so it clips the top of the
lens and no more.

### 4. Dotted lines going up into the sky — FIXED, on the third attempt
Those are stars, badly projected, and it took three goes because each projection
fixed one region and broke another:

| projection | horizon | zenith |
|---|---|---|
| `dir.xz / max(dir.y, 0.08)` (original) | cells stretch without bound → **dotted streaks** | fine |
| meridians corrected by `cos(elevation)` | fixed | whole zenith folds into one cell column → **clump** |
| cylindrical equal-area | right density | cells become tall slivers → **dashes** |
| **cube-face** | fine | fine |

Cube-face keeps cells square within ~15% over the whole sky. A star is also now a
point *inside* its cell rather than the whole cell, which is what was drawing
squares.

### 5. Blocky patch on the wall near PHONE REPAIR — REPRODUCED, NOT IDENTIFIED
Reproduced, and then three hypotheses were tested and all three failed:

- **The ghost sign.** Hiding all ten ghost-sign meshes changes **0%** of the
  region. Not it.
- **Texture aliasing at a grazing angle.** Raising anisotropy from 8 to the
  hardware maximum of 16 across all 103 textures is visually identical. Not it.
- The region is owned by a facade batch (58%) and the wall-glow batch (57%), so
  it is one of those two or their interaction, and that is as far as it got.

Found and fixed a real bug while looking, though: **ghost-sign text overflowed its
canvas.** The size was hardcoded at 150/108 px and "ELECTRIC SUPPLY CO" in Times
Bold at 108 px is wider than 512 px, so the longest names were clipped at both
edges. Same bug as the shop signs, in a different generator, fixed the same way.

### And one self-inflicted, which is why there is now a guard
The jitter edit in finding 1 was applied with a search-and-replace whose anchor
included the `for` header — and the replacement did not put it back. The loop
body was left dangling, the shader failed to compile, and a failed pass in the
middle of the post chain renders black along with everything after it. The whole
scene went black with **no exception, no failed load and no test failure**: `tsc`
cannot see inside a template literal and the compile error is one line in a
console nobody is reading.

`assertProgramsCompiled` now runs once after the warm-up render and throws with
the shader log if any program has diagnostics. It was verified by deliberately
breaking the shader and confirming it fires and halts at the loading screen —
an untested guard is not a guard, and that lesson was available for the taking
since the last time this happened.

State after this pass: GPU p95 **17.45 ms** / 33.3, 167 draw calls, 264k
triangles, 0 black frames. Blank mean 0.397, worst 0.674, 5 frames over 0.55.
(Mean is up from 0.386 because the closing terraces are large flat masses at the
ends of the sweep; that is the cost of not showing the horizon and it is worth
it.)

## Second play report, 2026-08-23 — controls, and four more from screenshots

### Controls — three real bugs, one of them the reported "달리다 멈칫"
The feel complaints ("stops while running", "turning is not smooth", "the mouse
sensitivity is off") were three separate defects.

**1. Collision rejected the move instead of resolving it.** This is the one that
stops a run:

```ts
if (hits(x, fromZ, c)) x = fromX      // the whole step, thrown away
```

The caller then bleeds velocity in proportion to how much of the step got
through — and with a binary reject that is either all of it or **none**, so
grazing a bin sets that axis's velocity to exactly zero. The comment there
described a continuous response that the resolution method made impossible.
Moved into `player/collide.ts` (imports nothing that touches three, so it is
node-testable like heading.ts) and changed to push out to the contact face. You
still stop against a wall, you now slide along it, and a graze costs a couple of
centimetres instead of the whole run. Five checks in `tools/collide.test.mjs`,
including one that fails on the old behaviour.

**2. `speed` was measured before the collision, not after.** The gait, the
footstep audio and the HUD all read the *intended* velocity, so walking into a
wall kept bobbing at full stride. Moved after the bleed.

**3. The mouse had the OS acceleration curve in it.** `movementX` under pointer
lock is post-acceleration on every desktop platform, so a slow drag and a fast
flick of the same physical distance turn the view by different amounts — which
is what "the sensitivity is strange" is. Now requests
`{ unadjustedMovement: true }`, falling back to a plain lock where the browser
refuses the option (Chrome rejects the promise rather than ignoring it).

### Stars threaded on diagonal chains — FIXED
The projection was right by now; the *hash* was not. `h21` begins with
`fract(p * vec2(127.1, 311.7))`, and for integer p that is `fract(p * 0.1)` —
**ten distinct values, then it repeats**. Feeding it star cells gave a hash with
a period of ten cells per axis and the stars came out on a lattice. It is a fine
scrambler for the continuous input the value noise feeds it, which is why it has
been correct everywhere else in that shader for the whole project. Added
`hashCell`, an integer-safe hash, for the star lookup only.

### The closing terrace was a bare slab from the side — FIXED
My own regression from earlier the same day. It was glazed only on the face that
looks down the street, on the reasoning that closing the view along the
carriageway was its whole job — but you can stand at the crossing and look
across, and from there it was a lit blank mass with a hard edge against the sky,
worse than the horizon it replaced. Both returns are now glazed too.

### Ghost-sign text overflowed its canvas — FIXED
Hardcoded at 150/108 px with the text centred, and "ELECTRIC SUPPLY CO" in Times
Bold at 108 px is wider than the 512 px sheet, so the longest names were clipped
at both edges. Fitted by measurement, same as the shop signs.

### The blocky mosaic under bright signs — RESOLVED by TAA, 2026-08-24

**Closed by run 26, and not by anything aimed at it.** Once the six hypotheses
below had been killed the artefact was understood to be aliasing, and that is
what TAA removes. Stepping in the region — mean |second derivative| along a ramp
that should be smooth — went **1.4112 → 0.5824, −58.7%**, and at the
reproduction pose the banding is gone by eye. Graded at one pose, so not claimed
eliminated everywhere.

The record below stays because the six dead hypotheses are still the useful part:
they are what proves it was never the ghost sign, the anisotropy, the shadow
quad, the normal map or the roughness map.

#### The original note
Six hypotheses, five of them killed by measurement, and it is still there —
smaller, but there. Recording what it is *not* so the next attempt does not
repeat this:

| hypothesis | test | result |
|---|---|---|
| the ghost sign | hide all 10 ghost meshes | **0%** of the region changes |
| grazing-angle anisotropy | raise 8 → hardware max 16 on all 103 textures | visually identical |
| the sign's cast-shadow quad | hide all 28 shadow quads | pattern unchanged |
| facade normal map | `normalScale` 0 | pattern unchanged |
| facade roughness map | `roughnessMap` null | pattern unchanged |
| the neon glow quad's mip chain | `generateMipmaps` off on the falloff ramps | reduced, not gone |

Two changes were kept because they are defensible on their own terms rather than
because they fixed the artefact:

- **`noMips` on the smooth falloff ramps.** A radial gradient on a 5.7 m quad is
  always magnified, so its mip chain is never an anti-aliasing win, and at a
  grazing angle the GPU picks the mip from the *minor* axis — four or five
  levels down while the major axis is stretched across half the screen.
- **Brick joints 1.2 → 2.2 texels.** Under one texel of any mip the wall is
  actually sampled from, and right at the Nyquist limit of the sheet itself, so
  it cannot survive mipmap reduction. It was also too thin to be right: a 215 mm
  brick with a 10 mm joint is 4.6% of the course, which at 46 texels per brick is
  2.1.

**A trap worth naming, because it caught me twice here.** Hide-and-diff says
which mesh *owns* the pixels, not which one causes the pattern. The neon glow
quad changed 96% of the region — because it is what lights it. The lit-window
batch changed 100% of an earlier region — because hiding the brightest thing in
the scene changes the bloom everywhere. Both readings sent me the wrong way.
Disable bloom and glare before running one of these, and treat "owns the pixels"
as a starting point rather than a verdict.

State: GPU p95 **17.66 ms** / 33.3, 167 draw calls, 264k triangles, 0 black
frames. Tests: heading 8, collide 5, placement 12, signcount.

## The diagonal-run stall, and two instruments that were lying

### The bug: wedged on a lamp post
Reported as "running diagonally, it stops, then walks". Reproduced by
synthesising the keystrokes and tracing the speed every frame:

```
i=65  s=3.33  x=-6.03 z=4.46   drop 1.34
i=87  s=2.60  x=-6.25 z=4.24   drop 1.63
i=105 s=3.17  x=-6.27 z=4.20   drop 0.76
...
i=365 s=3.39  x=-5.99 z=4.46   drop 0.78
```

400 frames of oscillating inside a 30 cm box with the speed sawing between 2.6
and 4.7 — the player never got anywhere. The box is the lamp post at
(-5.79, 4.0), `hx = hz = 0.14`.

**Cause.** `hits` treats a collider as a box inflated by RADIUS with **rounded**
corners, which is correct for a disc. The axis-separated resolution pushed to
the nearest **flat face**, which does not exit that rounded region at a corner —
so the X pass and the Z pass each undid the other's work, every frame, forever.

**Fix.** Resolve the disc radially: find the closest point on the box and push
out along the vector from it. Faces and corners fall out of the same arithmetic,
and the component of motion *tangential* to the surface survives, which is what
sliding is. Head-on into a wall you still stop dead — there is no tangential
component to keep.

| | before | after |
|---|---|---|
| distance travelled in 420 frames, W+D held | ~0 (oscillating) | **14.8 m** |
| same, W+A | ~0 | **15.2 m** |
| top speed reached | 4.70 | 4.80 |

Also added a SKIN of 0.1 mm to the push-out: landing at exactly RADIUS leaves
the disc *touching*, and the overlap test is a strict `<` on a distance built
from three subtractions, so `0.32 - 0` came back as 0.31999999999999995 and the
next frame said the player was still inside.

`tools/collide.test.mjs` is now 6 checks, including a 240-frame integration that
runs diagonally past a lamp post and fails on any stalled frame.

### Two instruments were lying, and the fix exposed both

**1. The playtest's look-around legs never turned the camera.** The harness did
`camera.rotation.y += leg.turn * DT` and then called `controls.update(DT)`,
which sets `camera.rotation` from its own yaw on the very next line. Four legs
and twelve seconds of the route had been exercising a view that never moved —
so every frame-time and blankness figure from `?playtest` was measured looking
straight down the street. `Controls.turn()` now exists for it. Distance walked
over the route went 93 m to **135 m** and draw calls 161 to **118**, because the
camera finally turns and the frustum finally culls something.

**2. The black-frame detector fired on a dark car.** It sampled one 8x8 patch at
the frame centre, and after the collision fix moved the walking line a metre,
that patch landed on a parked car body: 32 frames at 0.0196 against a threshold
of 0.02 — a threshold set when the scene was two stops brighter. The centre
patch measures *how dark the thing you are looking at is*, which is not the
question. The failure it exists to catch — a zero-size framebuffer, a pass that
failed to link — blackens the whole frame.

Now it samples five patches across the frame and takes the **brightest**: is any
part of this frame lit? A collapse says no everywhere; a dark car says yes, over
there. Darkest sample went from 0.0196 to **0.1801** with no change to the scene.

That is the same failure as item 1's blankness target and the ghost-sign font
size: a constant calibrated against an older, brighter scene, left in place after
the scene changed. Third time. The pattern is now in the decisions log.

State: GPU p95 **17.89 ms** / 33.3, 118 draw calls, 264k triangles, **0 black
frames**, 135 m walked. Tests: heading 8, collide 6, placement 12, signcount.

## "Blocked before reaching anything" — it was the end of the walk

### The invisible wall was 58 m of finished street
Reported as: occasional micro-stutters, and sometimes being unable to go forward
without having reached anything. The second one had a flat answer once the
layout was queried instead of guessed at:

| | |
|---|---|
| props placed out to | z = **-176** |
| lamps out to | z = **-164** |
| parked cars out to | z = **-152** |
| buildings out to | z = **-181** |
| **walk stopped at** | z = **-118** |

Fifty-eight metres of lit, furnished, occupied block sat behind a boundary the
player could feel and not see. `WALK_END_Z` is now -160, which is where the
street furniture actually runs out, and the block is **168 m** instead of 126 —
a third more street for no new geometry.

Two things fell out of it:

- **The lamp run was one span short.** The two sides are staggered by half a
  spacing, so stopping the loop exactly at `END_Z` left one side eight metres
  shorter than the other. `tools/placement.test.mjs` already asserted that the
  lamps outrun the walk, and it failed the moment the walk moved — which is what
  that test is for. The loop now runs one spacing past `END_Z`, which also lights
  the stretch between -168 and the buildings' real end at -181; that had been
  visible and unlit for no reason anyone standing in it could see.
- **The lateral clamp was checked and is correct.** Nearest eye-level frontage
  geometry is at |x| = 9.485 and the player's disc reaches 9.56, so they are
  touching the wall, not stopped short of it. (Worth measuring: the shopfront
  *glass* is at 9.92, which looks like a 68 cm gap until you notice the piers and
  frames in front of it.)

### The controller, rewritten against a reference
The remaining judder was the collision response, and the fix came from
GDevelop's `moveFollowingSeparatingVectors` (`GDJS/Runtime/runtimeobject.ts`).

**Gather every separating vector, then apply the longest and project the rest
onto its normal.** Resolving colliders *sequentially* cannot work: pushing clear
of one pushes you into the next, and the next pass pushes you back. Between a
lamp post and the kerb that is a standing oscillation, and what it feels like
from inside is being stopped by nothing. More passes do not fix it, they just
pick a different frame to give up on. One combined move cannot ping-pong.

**And take the velocity *into* the surface away, rather than scaling it.** The
previous two attempts were both heuristics on displacement: multiply by 0.2 when
blocked (threw away 80% of the speed in a frame), then scale by the fraction of
the step that got through (continuous, but an axis-aligned measure of a
resolution that is not axis-aligned — so sliding along anything at an angle bled
speed that had in fact got through). Projecting onto the surface has no such
gap and nothing to tune: head-on, all of the velocity is into the surface and
all of it goes; at a graze, almost none is and almost none goes.

Verified over the whole street rather than at one spot: 8 headings from a grid
of start points, **43,680 simulated steps, zero unexplained stalls** — every
stall was either touching a collider or at a street bound. `collide.test.mjs` is
7 checks, including a 240-frame run past a lamp post that fails on any stalled
frame, and a two-post squeeze that fails if the combined push flings the player
sideways.

State: GPU p95 **17.67 ms** / 33.3, 119 draw calls, 266k triangles, 0 black
frames, 168 m block. Tests: heading 8, collide 7, placement 12, signcount.

## The quality push — a measured loop, and what it threw away

Run as an experiment loop rather than a polish pass, borrowing the shape from the
autoresearch skill in `git-clone/2. 에이전트 스킬 라이브러리/claude-skills`: a fixed
evaluator, one change per iteration, and a log that keeps the failures. Eight
rows in `experiments.tsv`; **three of them are things that seemed obviously right
and measured badly enough to discard.**

### The evaluator took three goes to become trustworthy
`?score`, and it was wrong twice before it was useful — which is the point of
having one.

1. **Comparing the finished frame against a 3x supersampled one** reported an
   aliasing error of 32/255. Far too large: the film grain is a hash of
   `gl_FragCoord`, so at 3x it is a different noise field, and the bloom kernel
   is sized in target pixels, so at 3x it blurs a third as far. The metric was
   measuring the post chain's resolution-dependence, not edges.
2. **Comparing the scene render instead** returned exactly **0.000** at every
   pose — a half-float target read back into a `Uint8Array` comes back silently
   empty. There is now an assert for precisely that, because a confident zero is
   this codebase's most familiar failure.
3. **Averaging over the whole frame** read 0.17 for a scene with no
   antialiasing at all. An aliased edge is a handful of pixels in a frame that is
   mostly flat wall and sky.

What it settled on: **shift the camera half a pixel and diff**. That is edge
crawl, measured directly, with no reference render — and it sees post-process
antialiasing, which comparing scene renders cannot.

### The crawl map answered a question six earlier attempts had not
Rendering the difference as an image, rather than reducing it to a number, put
the answer on screen in one look: the blocky mosaic the play report kept flagging
is **the single worst crawling region in the frame**. It was an aliasing
artefact all along — a high-frequency pattern flipping wholesale under subpixel
motion — which is why hiding meshes and swapping textures never found it. Two
problems, one cause.

### What was thrown away, and why

| change | measured | verdict |
|---|---|---|
| MSAA 4x on the composer target | GPU p95 18 → **37 ms**, over budget on its own | DISCARD |
| SMAA after the tonemap | **5.15 ms** for a **1.9%** cut in crawl | DISCARD |
| a mottled light cookie (earlier pass) | 0.386 → 0.387 blank | DISCARD |

The SMAA measurement is worth keeping for the method as much as the result: run
back-to-back it reported **−2.03 ms**, i.e. free. Interleaving the on and off
frames so clock drift falls out of both sides gave 5.15 ms. A negative cost is
always the instrument.

### What was kept

| change | measured | cost |
|---|---|---|
| pixel ratio cap 1.75 → native | crawl energy **−16%** | +5 ms |
| FXAA | crawl **−5.3%**, and **−13.8%** in the mosaic region | +2 ms |
| two moving cars + one spot light | the road ahead of the car is 15% brighter | +1.3 ms |
| neon flicker on 2 of 11 signs | 2 signs vary, min 0.17x, dark ~1% of the time | ~0 |
| dynamic resolution | holds a 16.7 ms target, 55%..100% | ~0 |

The pixel-ratio one is the one to remember. The cap was set to 1.75 for
performance, and on a 2x display that makes the drawing buffer *smaller* than the
screen — so the browser upscales it. It was paying for a large frame and
delivering a soft one. Removing it bought eight times what SMAA offered for the
same five milliseconds.

### Dynamic resolution, because a number on one machine is not a shipping position
29.32 ms at p95 here is a pass with 1.14x of headroom, which says nothing about
the machine it will actually run on. `gfx/adaptive.ts` moves the render scale to
hold the frame instead: rolling **median** (one garbage collection is not a
reason to drop resolution), asymmetric thresholds (down fast, up slowly), and a
cooldown, because a resize reallocates the whole post chain. Six checks in
`tools/adaptive.test.mjs` cover a single hitch, an alt-tabbed tab handing back a
four-second frame, and sitting exactly on the target without hunting.

State: GPU p50/p95/p99 **19.82 / 29.32 / 30.51 ms** at 2560x1440 native, 157
draw calls, 273k triangles, 0 black frames. Tests: heading 8, collide 7,
adaptive 6, placement 12, signcount.

## Decisions log

### The recurring bug in this project has a shape (2026-08-23)
Three separate defects this week were the same mistake, and it is worth naming so
the next one is recognised faster: **a term derived under one set of conditions,
left in place after the thing it was derived for changed.**

| what | derived for | what changed | how it showed up |
|---|---|---|---|
| `FILL_LEVEL = SUN_INTENSITY * FILL_RATIO` | sun above the horizon | sun set, so `SUN_INTENSITY` is 0 | the one term whose job is stopping surfaces going black switched itself off at the moment it was needed |
| cloud `lit = uSunColor * (2.6 + 3.0 * phase)` | golden hour | sun set, but `uSunColor` is pinned by air mass and stays orange | a lit sunset cloudscape at every hour of the night |
| `if (f < 2)` on window cues | cue made a pool on the pavement | cue was changed to light the wall | the blankest part of the frame was the one part excluded from the only light reaching it |

The shared property is that none of them are wrong *locally* — each reads as
correct in its own five lines, and the comment above it usually explains why. The
error is only visible from the other end of the dependency. Two habits catch
them:

- When changing what a value *means*, grep its consumers before its definition.
  Every one of these was a consumer that had quietly stopped matching its guard.
- When a comment explains a behaviour, check the code still does it. Two of these
  had a comment describing the correct behaviour sitting directly above code that
  no longer implemented it — the sign mounting depth was a third
  (`"a lightbox stands well proud"` above `id.length % 5`).

Related and equally repeated: **`id.length` as a seed.** It was seeding the sign
texture, the sign mounting depth and the room behind each shop window. A dozen of
28 businesses share a length, so the variation was in the code and not in the
output. Replaced with `hashId`, which now lives in `world/placement.ts` so a node
test can assert the block actually gets all five sign trades.


### The sky was rendering a sunset at 21:00 (2026-08-23)
The clouds had **no night branch at all**:

```glsl
vec3 lit = uSunColor * (2.6 + 3.0 * phase);   // 2.6-5.6x, unconditional
```

`uSunColor` stays at full golden-hour orange below the horizon — it is derived
from air mass, which is *pinned* to 40 once the sun sets rather than going to
zero. So a set sun was lighting the cloud deck at full strength at every hour of
the night. Same class as the fill term that evaluated to zero after dark: a
constant written under the golden-hour brief that never got a night branch when
the sun moved. Now `lit`/`dark` lerp on `uNight` to the town's glow from below,
with the forward-scattering lobe removed — nothing in the sky to scatter from.

Second, separate cause: the dome itself was too bright. Measured rather than
eyeballed, using a criterion that survives taste — **blue hour is when the sky
is the brightest large area in frame; night is when the lamps are**:

| | before | after |
|---|---|---|
| zenith p50 | 73 | **27** |
| street median p50 | 50 | 46 |
| lamps p99.9 | 191 | 191 |

73 > 50 was the whole problem stated as a number. The obvious fix — drop
`SKY_COLOR` and `HORIZON_COLOR` — is wrong: those feed the dome, the
hemispherical fill's colour *and* the haze colour, so it darkens the street and
removes the sodium murk from the distance, which was already right. Instead
`DOME_DIM` dims the dome where it is *drawn* and `SKY_TO_SCENE` scales the probe
convolved from it back up by the same factor. `environmentIntensity` went
0.052 → 0.234 and the street median moved 50 → 46. Picture and lighting on
separate knobs.

Not the cause, and worth recording so it is not retried: **lowering
`ELEVATION_DEG` does nothing.** `TWILIGHT` is `min(1, -ELEVATION_DEG / 6)` and is
already clamped at 1 by -8; every other night constant is absolute. The night
branch is bit-identical at -8 and -18.

Instrument note: `blankShare` went 0.445 → 0.484 across this change and the
change was still right. Darkening a scene removes detectable edges, so the
metric is anti-correlated with grading toward night, and readings either side of
an exposure change are not comparable. The worst frames it points at (19, 24, 12
at 63-70%) are still genuinely featureless *walls*, which is item 1 and real.


**Fork A — procedural, not imported assets.** Chosen deliberately. The monotony
complaint was measured before it was acted on, and it was 64% blank frontage —
an absent-content problem, not an asset-quality one. Better props placed on the
36% that already had detail would have left the other 64% exactly as bare. That
is now 90% occupied and the sweep shows it.

**On magicpixel.art / kenney.nl / polyfork.dev.** Still available if wanted, but
three things stand:
- It reverses the brief's hardest constraint (`PROMPT.md`: *"Zero external
  assets… no downloaded images, no HDRIs, no audio files"*). The README's opening
  claim would have to change rather than quietly become false.
- All three are stylized — low-poly kits and pixel art — against a brief that
  says *"Not stylized. Not low-poly. Not a game. A photograph."* The whole
  lighting stack (AgX, clearcoat, veiling glare, the `sun.ts` photometric
  derivation) is built for photorealism and low-poly assets look worse under it,
  not better.
- **Licences are unverified and must be read before anything is downloaded.**
  Kenney is CC0 and safe. magicpixel.art and polyfork.dev have not been checked;
  "free to use" on a landing page is not a licence grant, and redistribution
  inside a git repository is a separate permission. Nothing has been downloaded.

If the stylized look is wanted for its own sake, the recommendation stands: a
*separate* `prompt-test/` project sharing `world/placement.ts` and the test
tools, which carry over unchanged. Everything in `gfx/` and `scene/` does not.

**On the 8-bit audio tool.** Not adopted, and worth saying why rather than
ignoring it: chiptune-style environment beds are a stylistic choice that pulls
against a photoreal street in the same way the low-poly assets would. The
ambience is procedural WebAudio and the requested street chatter has been built
that way too — see below. Easy to revisit if the target look changes.

**Sun near-axial at 22 degrees.** A 19.2 m street between 15 m buildings under a
6 degree sun is geometrically in shadow below the third floor if the light comes
across it. Axial is what real golden-hour street photography does. 16 degrees put
the disc dead on the vanishing point in every frame; 22 moves it off centre
without losing light down the carriageway.

**Frame time is measured with `EXT_disjoint_timer_query_webgl2`, never a wall
clock.** Timing around the render call reported 0.49 ms/frame, which is not a
fast renderer but a renderer whose work has been deferred. Samples the driver
flags as disjoint are discarded. Where the extension is absent the harness
reports *inconclusive* rather than printing a CPU number as a frame rate.

---

## Fixed in the night pass

- **21:00.** `ELEVATION_DEG = -8` — the sun is below the horizon and every
  downstream constant branches on `SUN_UP`. Direct beam zero, sodium light
  pollution at the horizon, deep blue zenith, stars thinning into the glow,
  cloud decks lit from *below* by the city rather than from the side by the sun.
  The folder is finally called what it is.
- **Lamp beams no longer geometric.** The cone was brightest face-on and kept a
  defined edge all the way down, so it read as a solid wedge — "no street lamp
  on earth does this". It now stops well short of the ground, fades from both
  ends, is 32-sided instead of 14, and at night runs at a fifth of its daytime
  strength. Against a dark sky any brightness reads as a solid object, which is
  the opposite of the daytime intuition. A billboarded halo round each fixture
  does the work the cone was wrongly doing.
- **Two enormous orange boxes across the street.** The crossing light-shafts are
  bars of *sunlight*; with the sun down there is nothing casting them, and an
  additive slab over a dark background reads as solid. Off at night. The dust
  motes went with them — they forward-scatter off the sun, and a sun-phase term
  with no sun is not a dust effect, it is a bug with good manners.
- **Clouds were crossing the sky in about a minute.** Drift down 7x.
- **Movement hitches.** Two causes. The collision code multiplied velocity by
  0.2 the instant more than half a step was blocked — an 80% speed loss in one
  frame from brushing a bin, then five frames rebuilding it. Now scaled by how
  much of the step actually got through, so grazing something costs nearly
  nothing. Separately the lighting update allocated 22 objects and sorted them
  every frame; that is a partial selection into preallocated arrays now.
- **Buildings read as blocks.** Balconies with slabs, brackets, rails and
  balusters; window frames with jambs, head, cill, transom and mullion; window
  boxes with planting; far more lit windows after dark. Visible in daylight —
  see open item 0 for why they are not visible yet at night.

## Fixed in the earlier Fork A pass

- **WASD/arrows reversed when facing across the street.** The input rotation was
  `R_y(-yaw)` — exactly right at yaw 0 and 180, exactly negated at ±90. Every
  earlier test walked down the street, so every earlier test passed. Now
  `player/heading.ts`, pure and imported by nothing, swept across 25 yaw angles
  by `tools/heading.test.mjs`. The test was checked against the old code and
  fails on it.
- **Mouse look dead until the second click.** Pointer lock was requested only by
  a listener on the canvas, which the start overlay covers. Requested from
  `begin()` now, with an error handler, a HUD message, and drag-to-look as a
  fallback.
- **"Clouds" cutting through buildings.** The light-shaft slabs at the crossings
  were 26 m wide against a 19.2 m street, so they stood 3.4 m inside both
  building rows. Sized from `ROAD_HALF` now, with a build-time throw if the
  rotated extent ever reaches the facade. The sky dome is also depth-tested — its
  ordering was previously a convention rather than a guarantee.
- **Walk too slow.** 1.4 → 2.3 m/s, sprint 3.1 → 4.8, acceleration shortened.
- **Light too intense.** Sun disc 42 → 15, halo 4.5 → 1.9, horizon glow and bloom
  down. Exposure then went back *up* 0.62 → 0.80, because trimming the sky also
  trimmed the probe feeding skylight and the whole street went a stop dark.
- **64% blank frontage.** Every bay is now a frontage kind — shop, vacant,
  residential or garage — and none are discarded. Dead units get flyposting and
  tags; residential gets a real doorway, fanlight, buzzer panel and step.
- **Bare upper facades.** Downpipes with brackets, extract vents, air bricks,
  service heads with conduit, satellite dishes.
- **Signs had no standoff.** Per-business mounting depth and a cast shadow.
- **Street chatter.** Two synthesised voices — glottal source through three
  bandpass formants, gated into ~4 Hz syllables, with consonant bursts and
  occasional laughter — walking past on a moving panner every 17-50 s. Indistinct
  by design: what identifies speech at this distance is rhythm and formants, and
  anything intelligible would need a vocabulary on a loop.
- **The sweep tool was lying.** It applied the kerb sign twice, so half the
  across-the-street frames turned to face the wall two metres *behind* the camera
  instead of the facade nineteen metres in front. Four of twenty-four frames were
  bare brick for that reason and were being read as evidence about the street. A
  wrong diagnostic is worse than none.
