# Pool flyers

A flyer is a duck in a propeller cap. Afloat, every half minute or so it takes off with its propeller spinning and
lands somewhere else in the pools; about one flight in seven takes it out over the cliff to the sea, where it is
counted (`state().escaped`), drifts off and is gone after two minutes.

## Sub-features

- the hook's `addFlyer()`; `state().escaped`; `hat(i)` leaves the propeller out.

## How to get to it (user POV)

- None yet: the page's own controls are being designed. Watch a flyer for a few minutes.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-flyer.js)"`. The script adds a flyer, then steps the world through the hook a second at a time (flights follow the world's own clock). Proof: ducks n -> n + 1, the propeller, the flights, the height in the air (over 1.6), out at sea, and `escaped` 1.

## Gotchas

- How soon it goes out to sea depends on the seed: 30 s to 6 minutes of world time.
