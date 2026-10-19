# Pool time of day

A day goes by in ten minutes: the sun crosses the sky and warms toward evening, the sky and the sea turn through
dawn, day, sunset and night, the moon lights the night with stars over it, and the pools' water glows. The panel's
Time slider sets the hour; its button stops or starts the clock (src/pool/daylight.js, world.day).

## Sub-features

- `#hour` (0 to 96 quarter hours; `#hourOut` reads HH:MM, and follows the clock while it runs); `#dayRun` (a pause/play button beside the slider; its aria-label reads Stop the clock / Start the clock).

## How to get to it (user POV)

- Watch, or drag the Time of day slider; stop the clock to keep an hour.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-time.js)"`. Proof: the hour unchanged over a second once stopped, then 22 with `night: 1` and the label 22:00. For a look at an hour, set `#hour` the same way and take `--shot`.

## Gotchas

- Set the slider with an `input` event; a bare `.value` does not reach the world.
- The page writes the hour back into the slider every 0.2 s unless the slider has focus.
