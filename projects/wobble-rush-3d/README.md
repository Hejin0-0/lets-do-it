# Wobble Rush 3D

A single-player 3D obstacle course in the browser. Plain HTML, CSS, and JavaScript with
Three.js — no build step, no framework, and no binary assets. Every platform, character,
texture, and particle is generated in code.

You are a **Wobbler**. The course is **The Gauntlet**, and it ends at the **Glow Gate**.

## Run

The game uses ES modules, which browsers refuse to load from a `file://` URL, so serve the
folder over HTTP:

```bash
npx serve .
```

Or, without Node:

```bash
python3 -m http.server 8000
```

Then open the address it prints. Opening `index.html` directly shows an explicit error
telling you the same thing rather than a blank page.

Three.js is pulled from unpkg via the import map in [index.html](index.html). To run
offline, vendor `three.module.js` plus `examples/jsm/` locally and repoint that import map.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrow keys | Run |
| `Space` | Jump — hold for height, tap for a short hop |
| `Shift` | Dive boost: a committed forward lunge |
| Mouse drag | Swing the camera; it eases back down the course |
| `R` | Restart the run, at any time |

## Stages and games

Five stages, four games, eight pairings. The level is the place; the mode is the rules. Pick
both on the start screen — a stage only offers the games it can actually host.

| Stage | Game | Win | Lose |
|---|---|---|---|
| **The Gauntlet** | **Dash** | Reach the Glow Gate | — falling costs time, not the run |
| **The Gauntlet** | **Spark Snatch** | Collect all 8 Sparks | The 70-second clock runs out |
| **Sugar Steps** | **Dash** / **Spark Snatch** | As above | As above |
| **Tumbleworks** | **Dash** / **Spark Snatch** | As above | As above |
| **Fizz Tower** | **Updraft** | Climb to the top pad | The rising Fizz touches you |
| **The Saucer** | **Tilt Out** | Stay up for 18 seconds | You go down with the floor |

A mode owns what wins, what loses, what the HUD shows, and what the finish screen reports.
`Game` runs the simulation and asks; it has no branch per mode. Dash shows a lap time and
keeps a personal best; Spark Snatch shows a countdown and a spark count and keeps neither,
because a hunt is not scored in seconds; Updraft shows your height and only banks a time if
you actually got out.

Updraft and Tilt Out are the games where falling is fatal rather than a setback — in a tower
the thing below you *is* the hazard, and on the Saucer there is nothing under the floor at
all. Both stages carry that in their layout: Fizz Tower has a single checkpoint and it is
the floor you start on, and the Saucer has none.

Content belongs to the level, rules to the mode. Sparks and the Fizz are both built by the
level and driven by the mode, which is why Sparks are hidden in games that do not collect
them and the Fizz sits still until a run that cares about it begins.

## The cast

Six Wobblers — Pip, Nib, Tuck, Bramble, Sprout, and Bloom — picked on the start screen and
remembered between visits. Each has its own head piece (antenna, crest, fin, ears, sprig,
halo) so they read apart in silhouette, not just in colour.

The body is two overlapping spheres with the lower one wider: bottom-heavy reads as soft
and weighted, and it squashes far better on landing than a single ball did. Stubby arms sit
low and a round plate on the chest catches the light. Every part stays inside the 1.15-unit
collision height — a model taller than its own hitbox is a mismatch nobody can see and
everybody feels.

They are **paint only**. Every Wobbler shares one physics body, because the course tuning
and all six fairness rules derive from a single set of numbers; per-character stats would
invalidate the lot. `test.html` holds them to it: the same seeded run must come out
byte-identical for all six.

Every deck in the game is a light pastel, so each body colour is deeper and more saturated
than anything it will ever stand on, and the six hues are spread around the wheel.

## The Gauntlet

Six beats, six checkpoints, roughly 20–30 seconds if you keep your feet.

1. **Start apron** — checkered launch pad.
2. **Sweeper alley** — three counter-rotating striped bars at shin height. Jump them.
3. **The gap** — a sliding platform, a static island, then a second slider.
4. **Bumper yard** — springy mushrooms. Clip one and you get shoved; land on its dome and
   you get launched.
5. **The bridge** — a narrow span with one slow sweeper and one bumper.
6. **Ramp and Glow Gate** — up the ramp, off the lip, through the gate onto the finish pad.

Fall off anywhere and you pop back at your last checkpoint immediately, with the clock
still running. Falls are counted and shown on the finish screen.

## Sugar Steps

A second race from the same vocabulary, asking a different question. The Gauntlet is about
timing — bars to jump, sliders to catch. This one is about holding a line: belts drag you
sideways in alternating directions, three wrecking balls make you pick a side, a staircase
drops you faster than you expect, and the last belt runs against you the whole way.

The belts needed no new mechanic. A static deck that reports a per-frame delta is carried
by exactly the same rider logic that carries a moving platform, so a conveyor is a deck
with a `conveyor` field and nothing else.

The pendulums did need tuning, twice. A ball hazard has a small instantaneous footprint no
matter how hard it swings — on the ten-unit deck it started on, the lethal band was three
units wide and the bot never once got touched. Narrowing the deck to under seven and
lengthening the rod onto a shallow arc fixed that, and immediately overshot: every hit then
threw you clean off, thirty-one falls in a run, all of them in the same fifteen units of
course. The knockback is now sized like the sweeper's — a hit from mid-deck costs you time,
a hit near the edge still costs you the run.

## Tumbleworks

A race through machinery, in four beats: turntables, a corridor that closes in, lifts, then
the drums.

**Turntables** punish where you land rather than when you jump. The rim travels far further
than the hub, so a wide landing carries you off before the next jump lines up. Their decks
are round rather than boxes — squaring one off would let you stand on corners that are not
there, and on a spinning platform those corners are exactly where a player would be when
they fall. Riders are rotated about the hub rather than nudged by a single delta, because
one delta cannot express a rim moving three times faster than the middle.

**The drums** turn about the direction of travel instead of about the vertical. A sweeper
is answered by jumping; a drum's wall arrives across the corridor, so jumping does nothing
and the answer is to be somewhere else. At any moment the panels block one to four of the
corridor's thirteen lanes, and the blocked band keeps moving.

**The lifts** need no carry logic. The ground probe already sweeps a step's worth of height
each frame, so a rising deck simply comes up to meet whoever is standing on it.

## Fizz Tower

A spiral of 21 steps around a 6-unit radius, 1.2 units of climb each, from a wide base pad
to a small top pad about 26 units up. The shape is generated in the level file rather than
typed out, because the spiral *is* the rule.

The numbers come straight from the jump arc: at a 1.2-unit step each hop has ~5.79 units of
reach and spends about 1.3 of it. That slack is deliberate — here the pressure is the Fizz
rising underneath you, not the gaps. It reaches the top around 38 seconds in; a flawless
climb takes about 14. The margin is the room you have to make mistakes in.

The camera keeps its bearing tangent to the spiral, derived from where you are relative to
the tower axis. Position in, orientation out — no dependence on input, so the feedback loop
that a heading-chasing camera would create never forms.

## The Saucer

Five concentric rings, 61 tiles, on a uniform 1.885-unit arc pitch so the whole floor walks
as one surface. There is nothing to jump; the only decision is where to stand.

Two pressures, deliberately, because either alone has an answer. The rim collapses inward
on a schedule — 6 s, 9.5 s, 13 s — so waiting does not work. And anything you stand on
lights its own fuse, so running does not work either. The two innermost rings never
collapse on their own: seven tiles, 2.1 seconds of life each once touched, and that is the
endgame.

Which makes the real strategy *spend the doomed floor first and save the permanent tiles*.
Drift straight to the middle and you burn the seven while the rim is still perfectly good,
and there is nothing left to stand on at the end.

An optimal line lasts 25.2 seconds. The target is 18, so there are about seven seconds of
slack for a player who is not optimal — at the 22 it started as, that margin was three
seconds, which is not a margin, it is a coin flip.

## Architecture

| File | Responsibility |
|---|---|
| [src/main.js](src/main.js) | Bootstrap. WebGL probe, CDN probe, and the fatal-error surface |
| [src/game.js](src/game.js) | Renderer, lights, sky, camera, input, loop, run state machine |
| [src/player.js](src/player.js) | The Wobbler: movement, jump, dive, ground resolution, squash-and-stretch |
| [src/course.js](src/course.js) | Builds a level definition into the scene; owns its runtime state |
| [src/levels/](src/levels/) | The levels themselves, as data, plus the fairness validator |
| [src/modes/](src/modes/) | Run rules: what wins, what loses, what the HUD shows |
| [src/characters.js](src/characters.js) | Wobbler definitions. Cosmetic only — one physics body for all |
| [src/obstacle.js](src/obstacle.js) | `Sweeper`, `MovingPlatform`, `Pendulum`, `RotatingDisc`, `RotorTunnel`, `Bumper` |
| [src/collectible.js](src/collectible.js) | The Spark: a pickup you grab by running through it |
| [src/hazard.js](src/hazard.js) | The Fizz: a rising surface that ends the run on contact |
| [src/tile.js](src/tile.js) | A tile that gives way, by schedule or because you stood on it |
| [src/checkpoint.js](src/checkpoint.js) | Gate and pad visuals, crossing test, respawn points |
| [src/storage.js](src/storage.js) | localStorage with the private-browsing case handled once |
| [src/ui.js](src/ui.js) | Every DOM read and write: screens, HUD, timer, best time |
| [src/effects.js](src/effects.js) | Pooled confetti — one `InstancedMesh`, one draw call |
| [src/physics.js](src/physics.js) | Pure arcade math, no Three.js. Covered by tests |
| [src/bot.js](src/bot.js) | A scripted player, used as a regression net |
| [src/materials.js](src/materials.js), [src/palette.js](src/palette.js) | Shared glossy-plastic material cache and colours |

Nothing about one particular course lives in `course.js` any more. A level is a plain
object — decks, obstacles, checkpoints, pickups, a hazard, a finish block, some scenery
counts — and adding a map means adding a file plus one line in `src/levels/index.js`.
A level also declares which games it can host, so the picker never offers Updraft on a
stage with nothing to climb away from.

## Checks

Open **`test.html`** in the same server. It boots the real game in a hidden frame and
reports pass/fail for:

- the [physics.js](src/physics.js) assertions,
- the fairness rules below, over every registered level,
- five scripted playthroughs per stage-and-game pairing, of which at least four must win,
- every game's lose path, by idling a whole run and checking the outcome against a
  declared expectation — a new mode with no entry fails on purpose, because "can this be
  lost, and how?" is a decision to make, not something to discover in production,
- the six Wobblers, whose seeded runs must come out byte-identical.

The playthroughs are seeded. Sweepers randomise their phase when built and the clock
carries across runs, so an unseeded gate is a coin flip — each run pins every hazard to a
fixed starting phase instead, and the five seeds are five different phases to solve. The
same commit produces the same numbers every time; if they move, something changed.

The maths assertions also run standalone, without a browser:

```bash
node src/physics.test.js
```

The `package.json` beside this file exists only to tell `node` the folder is ES
modules — no dependencies, no install step, nothing to build. Without it that command
still passes but prints a module-type warning over its own output.

### The fairness rules

[src/levels/validate.js](src/levels/validate.js) encodes six rules. Each one is a bug
that shipped once and had to be found by automated play — none are style preferences.
The thresholds derive from `PLAYER_TUNING`, so retuning the jump retunes the rules with it.

Reachability is solved in 3D. `jumpReach(rise)` answers "how far can I travel horizontally
while also gaining this much height" — flat ground gives the full ~6.8 units, climbing costs
distance, and above the ~2.33-unit apex nothing reaches at all. The first version measured
gaps along +Z and would have called Fizz Tower one enormous hole; a rule that only holds for
the level it was written against is not a rule.

| Rule | Requirement | Why |
|---|---|---|
| **R1** | No onward jump costs more than 60% of the reach available at that height | Gaps should never be the challenge; obstacles are |
| **R2** | No checkpoint spawns inside a sweep or a bumper | Respawning into a rotating bar is an unrecoverable loop |
| **R3** | A deck ending at a void keeps ≥ 2.5 units outside every sweep | Otherwise there is nowhere fair to stand and time the next jump |
| **R4** | A slider reached off a ledge under 3 units needs `range < hw` | So its deck always covers the centre lane and running straight off always lands |
| **R5** | Every deck is reachable from the spawn under R1 | No orphan islands |
| **R6** | A Spark sits clear of every bumper's shove radius | Otherwise reaching for it is a fall, so the pickup is a trap |

They are mutation-tested: reintroducing any of the original bugs makes the corresponding
rule fire.

Three placement lessons are not yet rules because one example is not a pattern, and each is
commented where it bit. A Spark must sit on ground the player *runs* along — put one in a
jump's landing zone and you arc high over it, untouchable. It must sit on the line the
hazard's own answer takes: one in the middle of the pendulum walk was perfectly safe, in
the clear band between two arcs, and still uncollectable, because the way through there is
to hug whichever edge the bob has left. And it should not sit on a seam between two belts,
where the drift reverses underfoot and no line holds.

## How it works

**Collision is a height probe, not a physics engine.** The world is a list of decks —
`{x, z, hw, hd, y, slope?}` — and each frame the player asks for the highest deck below
their feet. The query sweeps the whole frame (`max(previousY, currentY)`), so falling fast
can never tunnel through a platform, and a sloped deck interpolates its own height so the
ramp needs no special case. Moving platforms mutate their deck in place and publish the
distance they travelled, which is how riders get carried.

**The tuning is the design.** Airtime is ~0.74 s and a jump carries ~6.8 units, more than
double the widest gap — so gaps are never the challenge; obstacles are. Coyote time,
jump buffering, and variable jump height all exist to make a mistimed press still work.
Sweeper knockback is sized to cost you time, not the run: a hit at mid-deck slides you
about 3 units, well inside the runway's 6-unit half-width, while a hit near the edge still
throws you off.

**Two constraints are load-bearing, and both are commented in [src/course.js](src/course.js):**

- A sweeper post at `z` sweeps `z ± reach`. The last one on the runway must leave a safe
  ledge before the void, or there is nowhere fair to stand and time the next jump.
- A slider approached off a ledge you cannot stop on must have `range < hw`, so its deck
  always covers the centre lane and running straight off always lands. Timing challenges
  belong after a static platform you can wait on — which is where the second slider sits.

**The camera does not chase your heading.** Movement input is camera-relative, so a camera
that turns to face your direction of travel feeds back into the input that produced it:
hold `W`+`D` and the pair spiral, curving you off the deck instead of running a straight
diagonal. It eases to a fixed course yaw instead, which has no feedback term. Dragging
still orbits freely.

## No silent fallbacks

Failures are surfaced, never swallowed:

- `file://` is detected up front and explained.
- A watchdog fires if the game has not started within 15 seconds.
- Missing WebGL, a failed Three.js fetch, and a throw during scene construction each get
  their own message plus the underlying error.
- `UI` throws on construction if any element it needs is missing from the HTML.
- The one deliberate soft path is `localStorage` being unavailable (private browsing): the
  run still counts and the personal best shows a dash.

## Notes

- No audio. It was not in the brief and would have been the only thing needing an asset.
- Original art and naming throughout. No Fall Guys assets, characters, or level layouts.
