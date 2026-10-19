# Pool names

Every duck has a name (src/pool/ducks.js: a list of our own, picked by the duck's number, so forty never share
one). Shown, a tag sits over each duck and follows it as it goes; the picked duck's tag is dark.

## Sub-features

- the hook's `names(v)`; the tags are spans in `.dk-tags`; a duck in the tube's underground part has no tag.

## How to get to it (user POV)

- None yet: the page's own controls are being designed.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-names.js)"`. Proof: tags = ducks, their names the world's, each centred over its duck and above it; after `names(false)`, 0.

## Gotchas

- The script pauses the world and renders a frame itself, so the ducks do not move between reading a tag and its duck.
