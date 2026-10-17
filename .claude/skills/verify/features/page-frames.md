# Page frames

The masthead (title and caption), the panel (a bottom sheet on a phone) and "how to play" sit apart at every size; a longer title must not run under the panel.

## Sub-features

- desktop sizes from 1024x700 up; the phone layout (max-width 900 px).

## How to get to it (user POV)

- Open the page at any window size.

## Driving it with probe

`--eval "$(cat drive/frames.js drive/overlap.js)"` at `--w 1024 --h 700`, `--w 1280 --h 720`, the default 1600x900 and `--mobile`. Proof: `overlaps` 0. For every jelly at once, use the jelly switcher's tour, which runs the same check per jelly.

## Gotchas

- `frames.js` counts boxes, not glyphs: the titles' tight line-height makes their lines' boxes touch by design, so lines are not compared.
- A planted wide title (`.mast{width:80vw;max-width:none}`) makes it fail with `mast x dio-panel`; setting only `width` does nothing, because `max-width` caps it.
