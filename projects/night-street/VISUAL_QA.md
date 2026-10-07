# Visual QA — the blind critic pass

The brief specifies this loop:

> For each system: build it, then spawn ONE separate sub-agent as a harsh visual
> critic. The critic should compare the result against real nighttime city
> photography [...] The critic must never be the same agent that built it. It
> should only see the rendered output, not the code.

That constraint is the whole value of the exercise, so it was enforced rather
than approximated: the critic was given five rendered frames and an explicit
instruction not to read, search for, or open any source file, and it did not. It
was briefed with an art-director rubric — colour and lighting direction, material
language, visual hierarchy, style consistency — and asked to be blunt.

Its verdict was **RENDER**, 0 of 5 frames passing as photographs.

What follows is what it found, and what happened next. The interesting part is
that a critic who cannot see the code produces excellent *observations* and
unreliable *diagnoses*, and both are worth keeping separate.

---

## Findings acted on

### The one that mattered most: specular and diffuse were being scaled together

> "every car body is flat-shaded per-face. One value per panel, hard value step
> at each chamfer, no gradient across a surface, no environment reflection, no
> specular [...] This one reads as sanded MDF."

Correct observation, and it pointed at a real bug rather than a missing feature.
The cars already had a clearcoat and a radiance probe. What they did not have was
brightness: `scene.environmentIntensity` had been dialled down to 0.39 to stop
concrete blowing out, and that single control scales image-based *diffuse* and
image-based *specular* by the same factor. The calibration was a diffuse
correction and it silently dimmed every reflection in the scene by 2.5x.

A clearcoat is a mirror. It has to show the sky at the sky's own brightness
regardless of how the diffuse response is trimmed. Reflective materials — paint,
glass, chrome, rims, lamp lenses, wet asphalt, shopfront glazing — now carry an
`envMapIntensity` that compensates for the global trim. The van flank in the
after-shots reflects cloud structure and a horizon line, which is the thing the
critic said was missing and the thing that sells car paint.

### Shaded surfaces had no cool fill

> "shadowed facades and shadowed sides of objects go brown, grey, or muddy
> dark-warm [...] golden hour is defined by its *opposition*. Without it you have
> 'brown', not golden hour."

Also correct, and also a mechanism worth naming. Skylight was arriving only
through a radiance probe convolved from the sky shader — but that probe is
captured from an empty scene, so it is dominated by the bright warm horizon,
which is precisely the part of the sky a street canyon occludes. The fill was
warm because the probe's warm end was over-represented.

Fixed with an explicit hemisphere term at 22% of direct sun, with a genuinely
blue sky colour, on top of the probe rather than instead of it — the probe keeps
supplying directional detail, and the hemisphere supplies the strip of cool
zenith the canyon actually sees. The zenith colour was pushed bluer at the same
time.

### Nothing was grounded

> "wheel-to-asphalt, pole-base-to-pavement, sign-to-facade — every junction in
> the set is a clean value change with no darkening [...] the single biggest
> reason objects feel composited rather than co-present."

Cars and dumpsters already had contact decals; nothing else did, and the car
decal was too soft. Every solid prop now gets a batched contact patch — one extra
draw call for the whole street — and the car pool is tighter and denser. The
critic was right that this is the highest ratio of payoff to effort in the list.

### Haze read as a uniform wash

> "every direction is equally foggy, which is why crit-4 — a shot pointed *away*
> from the sun axis — is as milky as crit-1, which is pointed straight into it.
> That single inconsistency is the loudest render tell in the set."

The distance law was already exponential and already near-zero in the near field,
so the diagnosis was wrong, but the observation was right: the frames *were*
uniformly milky. The actual causes were the two above — with no cool fill and no
contact darkening, nothing in the frame reached a black point, and an image with
no black point looks like it was shot through a greased filter regardless of what
the fog term is doing. Veiling glare was also carrying more of the frame than it
should and came down again.

---

## Findings verified as incorrect

### Masonry scale

> "the mortar courses run as continuous horizontal bands roughly 1/12th the
> height of the visible wall [...] that puts each 'course' at 60–80 cm. Real
> brick courses are 7.5 cm plus a 1 cm bed joint. The wall is a scale model with
> brick-shaped paint on it."

Confidently argued and wrong. Measured directly: a frame taken 1.4 m from a wall
with this vertical field of view covers 1.55 m of wall, and holds 18–19 courses.
That is **8.4 cm per course**, which is correct brick — and the running bond,
half-brick stagger and per-brick colour variance the critic said were absent are
all present and visible in the close shot.

The critic had no distance reference. It judged the near wall in a frame where
that wall is seen at an extreme grazing angle, which compresses courses toward
the vanishing point until they merge into bands. This is exactly the failure mode
a code-blind critic should be expected to have, and it is the reason its
findings were checked rather than actioned wholesale. Taking this one at face
value would have meant dividing a correct course pitch by five.

---

## Findings left open

Fair, unfixed, and recorded rather than quietly dropped:

- **Signage has no physicality.** Boards sit 14 cm off the wall but cast no
  shadow onto it, and every business on the block shares one typographic
  treatment. The critic's own note that the painted-on-brick sign reads better
  than any panel sign is the right lead to follow.
- **Lamp glows are perfect circular gradients** with no lens artefact.
- **The truck flank filling half of one frame** has no panel breaks, bottom rail
  or dust streaks. That frame is also a camera-placement artefact — the capture
  was set 0.3 m from a parked van — but the flank is genuinely bare.
- **No chromatic fringing on high-contrast silhouette edges.** There is
  transverse aberration in the post chain but it is scaled to be invisible except
  at the corners, which is right for a good phone lens and wrong for a cheap one.

---

## What the critic said holds up

Worth recording so a later change does not quietly break it:

- **The camera framing and eye height.** "That casual, slightly badly-composed
  quality is doing real work for the 'phone camera' brief. Do not tidy the
  compositions."
- **The street-lamp fixtures and their rhythm down the block** — "lights on but
  not yet needed" was the intended lighting story for this hour and it read.
- **The sky, in the frames that have one** — cool blue-grey overhead falling to
  sodium-amber at the horizon, with stratus banding that thins toward the
  vanishing point.
- **The road surface.** Ranked best of six subjects: correct value range, correct
  marking scale, believable variance and kerbside sheen.

Its ranking of the six subjects, best to worst, was: road, street lighting, sky,
facades, cars, atmosphere. The two changes above were aimed at the bottom two.

---

## Standing

Still **RENDER**, not photograph — see the last section of `README.md`, which was
written before this pass and did not need revising afterwards. The critic's
closing prescription was to restore the warm/cool opposition and buy back
foreground contrast, and that is what was done; whether it moved the grade needs
a fresh critic on fresh frames, which is the next iteration of this loop rather
than a claim to make here.
