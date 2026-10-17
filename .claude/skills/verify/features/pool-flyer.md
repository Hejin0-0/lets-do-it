# Pool flyers

A flyer is a duck in a propeller cap. Afloat, every half minute or so it takes off with its propeller spinning and
lands somewhere else in the pools; about one flight in seven takes it out over the cliff to the sea, where a toast
celebrates it and the panel counts it (Out to sea), and it drifts off and is gone after two minutes.

## Sub-features

- `#addFlyer` (Add a flyer); `#nEscaped`; the toast "A flyer made it over the cliff and out to sea!"; the Dress chips leave the propeller out.

## How to get to it (user POV)

- Click Add a flyer and watch it for a few minutes.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-flyer.js)"`. The script clicks the button, then steps the world through the hook a second at a time (flights follow the world's own clock). Proof: ducks n -> n + 1, the propeller, the flights, the height in the air (over 1.6), out at sea, the toast and the count 1.

## Gotchas

- How soon it goes out to sea depends on the seed: 30 s to 6 minutes of world time.
