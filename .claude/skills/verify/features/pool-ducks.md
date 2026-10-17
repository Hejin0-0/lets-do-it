# Pool ducks

Add ducks (out of the fountain), take them out, pick one up and dress it (eight colours, seven things to wear, or none), follow it round.

## Sub-features

- `Add a duck`, `Add five` (up to 40), `Take one out`, `Follow`, `Mix them up`; colour swatches `.dk-sw[data-colour]`, hat chips `.dk-chip[data-hat]`.

## How to get to it (user POV)

- The panel on the right (the Controls sheet on a phone); drag a duck to pick it.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-ducks.js)"`. Proof: `ducks` goes 12 -> 17, and the picked duck's colour and hat are the clicked ones.

## Gotchas

- New ducks pop out one every 0.45 s; the script waits 4 s.
- The pick uses the hook's hand (grab and drop) because a drag on a moving duck needs its screen point every frame; the dress buttons are real clicks.
