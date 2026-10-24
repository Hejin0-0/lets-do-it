# Jelly switcher

One page, thirteen jellies; the arrows (a bar along the bottom on a phone) or the URL hash turn one into the next behind a curtain.

## Sub-features

- `next`, `previous` arrows; `#NN` in the URL opens jelly NN; the last wraps to 01.

## How to get to it (user POV)

- Click the right arrow at the top centre (bottom bar on a phone), or open `index.html#05`.

## Driving it with probe

`--serve projects/jelly/dist --path '#01' --webgpu --eval "$(cat drive/frames.js drive/jelly-tour.js)"`. Proof: `visited` lists 01 to 13 in order, `overlaps` 0, exit 0, no console errors. Repeat with `--mobile` and `--w 1280 --h 720`.

## Gotchas

- A jelly takes up to 5 s to mount (meshing, shader compiles); the script waits for `__jelly.id` to change.
- The phone's switcher bar is fixed over scrolling content by design, so it is not compared with the frames.
