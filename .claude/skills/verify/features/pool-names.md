# Pool names

Every duck has a name (src/pool/ducks.js: a list of our own, picked by the duck's number, so forty never share
one). Names puts a tag over each duck, following it as it goes; the picked duck's tag is dark, and the Dress section
names it ("Pip, a classic duck").

## Sub-features

- `#tags` (Names, aria-pressed); the tags are spans in `.dk-tags`, under the page's own frames; a duck in the tube's underground part has no tag.

## How to get to it (user POV)

- Click Names.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-names.js)"`. Proof: tags = ducks, their names the world's, each centred over its duck and above it; after a second click, 0.

## Gotchas

- The script pauses the world and renders a frame itself, so the ducks do not move between reading a tag and its duck.
