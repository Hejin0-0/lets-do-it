# Page frames

The masthead (title and caption), the panel (a bottom sheet on a phone), "how to play" and the status pill sit apart at every size; a longer title must not run under the panel.

## Sub-features

- desktop sizes from 1024x700 up; the phone layout (max-width 900 px).

## How to get to it (user POV)

- Open the page at any window size.

## Driving it with probe

`--eval "$(cat drive/frames.js drive/overlap.js)"` at `--w 1024 --h 700`, `--w 1280 --h 720`, the default 1600x900 and `--mobile`. Proof: `overlaps` 0. For every jelly at once, use the jelly switcher's tour, which runs the same check per jelly.

## Gotchas

- `frames.js` counts each frame where it is painted: a frame with a background or a border by its box, a bare one (jelly's masthead) by its lines of text and its boxed children. Counting the bare masthead's whole block flagged jellies 10-13 on a phone (`mast x dio-status` 17x29 px) where nothing touched. Lines inside one frame are never compared with each other: the titles' tight line-height makes them touch by design.
- The status pill joined the check after it was found over the pool's boxed title card on a phone (32x29 px).
- A planted wide title (`.mast{width:80vw;max-width:none}`) makes it fail with `mast x dio-panel`; setting only `width` does nothing, because `max-width` caps it.
