# Pool seats

Two deck chairs you can sit in: the pool chair on the stone by the big pool, and the sea chair on the lawn
looking over the round pool and the beach to the sea. Sitting eases the camera to just behind and above the
chair; orbiting from there turns round what the chair looks at; the hook's `resetView()` goes back.

## Sub-features

- a click on either chair where it is drawn; the hook's `sit(i)`.

## How to get to it (user POV)

- Click a deck chair (yellow on the stone right of the big pool, teal on the lawn above the round pool).

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-seats.js)"`. For each seat the script clicks the canvas at `__pool.toPx(__pool.spots().seats[i].chair)`, goes back, then sits by the hook. Proof: the camera's eye ends within 0.02 of the seat's eye (`off`), four times.

## Gotchas

- The eye is worked out from `state().camera` (az, el, dist, target), the way the view places it.
- Wait out the ease (1.1 s to a seat, 0.7 s back) before reading the camera.
