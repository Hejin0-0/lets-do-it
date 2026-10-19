# Pool time of day

A day goes by in ten minutes: the sun crosses the sky and warms toward evening, the sky and the sea turn through
dawn, day, sunset and night, the moon lights the night with stars over it, and the pools' water glows
(src/pool/daylight.js, world.day).

## Sub-features

- the hook's `hour(h)` sets the hour, `clock(run)` stops or starts the clock; `state().hour`, `state().clock`, `state().night`.

## How to get to it (user POV)

- Watch. Setting the hour waits for the page's own controls (being designed).

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-time.js)"`. Proof: the hour unchanged over a second once stopped, then 22 with `night: 1`. For a look at an hour, call `__pool.clock(false); __pool.hour(h)` and take `--shot`.
