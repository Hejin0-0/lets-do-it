# Pool time of day

A day goes by in ten minutes: the sun crosses the sky and warms toward evening, the sky and the sea turn through
dawn, day, sunset and night, the moon lights the night with stars over it, and the pools' water glows
(src/pool/daylight.js, world.day). The night sky is round faint stars and a dozen constellations with the lines of
their figures (src/pool/stars.js: their bright stars from right ascension and declination), turning with the hour
about the pole, 35° up in the north (-z): an autumn night's sky (`daylight(h).lst`).

## Sub-features

- the hook's `hour(h)` sets the hour, `clock(run)` stops or starts the clock; `state().hour`, `state().clock`, `state().night`.

## How to get to it (user POV)

- Watch. Setting the hour waits for the page's own controls (being designed).

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-time.js)"`. Proof: the hour unchanged over a second once stopped, then 22 with `night: 1`. For a look at an hour, call `__pool.clock(false); __pool.hour(h)` and take `--shot`.

The stars have no drive; look at them by aiming the camera up (`__pool.cam`: a negative `el` puts the eye below the
target): `target [0, 4, 0], dist 3, el -0.55`, with `az 0` north at 22:30 (the Little Dipper, Polaris 35° up) and
`az 1.57` west at 21:00 (Lyra and Aquila). The default deck view shows little sky.
