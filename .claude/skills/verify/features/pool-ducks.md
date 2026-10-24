# Pool ducks

Add ducks (they drop into the big pool), take them out, pick one up and dress it (twelve designs, seven things to wear, or none), follow it round.

## Sub-features

- the hook's `add(n)` (up to 40), `remove()`, `follow(v)`, `mix()`, `select(i)`, `colour(i)` (a design), `hat(i)`; a drag on a duck picks it up.

## How to get to it (user POV)

- Drag a duck to pick it up and throw it. The rest waits for the page's own controls (being designed apart from jelly's); until then it is the hook's.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-ducks.js)"`. Proof: `ducks` goes 12 -> 17, and the picked duck's design and hat are the chosen ones.

## Gotchas

- New ducks pop out one every 0.45 s; the script waits 4 s.
