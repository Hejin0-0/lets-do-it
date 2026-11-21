# Pool fuzz

Not one feature but all of them at once, in an order no one would choose: a seeded random sequence of what a player
and the page can do (real clicks, drags, wheel steps, keys and held movement keys; sitting, the seated panel's and the
book's controls; ducks added and removed, given any of the 24 designs and a hat, mixed up, tapped; a flyer; the hour;
Go home; the page hidden and shown; the window losing focus).

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --wait 6000 --eval "$(cat drive/pool-fuzz.js)"`, or with
`window.__SEED=7; window.__STEPS=400;` prepended for another and longer sequence. Proof: exit code 0 (no page error),
`odd: []` (every duck finite, within 400 of the middle and between 20 below and 60 above the sea, its design 0 to 23;
the camera finite; the seated panel open only when seated), and the heap and DOM size it reports.

## Gotchas

- A failure names the step (`<index>:<action>`); rerun with the same seed and fewer `__STEPS` to come to it.
- Seeds 11, 23, 37 and 41 at 220 steps passed on 2026-11-14 (heap 106 to 130 MB, DOM 74 to 85 elements).
