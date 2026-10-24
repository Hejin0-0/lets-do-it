# Pool sea

The open sea round the island, a step below its beach (a sheltered cove, Hs about 0.6 m; a unit is 2 m): a wind sea and a long swell (src/pool/ocean.js) made on the GPU every frame by inverse
FFTs in four cascades (src/pool/ocean-gpu.js), drawn as a mesh of rings out to the horizon raised and pushed by the
waves, with the sky in it, the sun's or the moon's glitter, whitecaps, the surf at the cliff's foot and the haze. A
flyer that goes out to sea rides its waves (oceanAt, the biggest 320 waves on the CPU).

## Sub-features

- the waves (height and leaning crests), the time of day in the water (the sun's path at sunset, the moon's at night), the surf, a duck at sea.

## How to get to it (user POV)

- Look out over the wall; drag to look round, scroll out to see more of it.

## Driving it with probe

`--serve projects/rubber-duck-pool/dist --webgpu --eval "$(cat drive/pool-sea.js)"`. The script pauses the world, renders, reads cascade 0's layer back (`__pool.ocean.texture`, rgba16float) and sums the same waves on the CPU (`__pool.ocean.spec.h0`) at 24 texels, then steps two seconds and does it again. Proof: `worst` (height and x displacement) under 1% of `top`; it reads about 3e-5 against 0.05.

For a look, set `__pool.clock(false); __pool.hour(h)` and the camera (`__pool.cam`: az, el, dist, target) and take `--shot`: into the sun at 16:30 (az 1.43, target [-9, 0.5, 0]), the sunset at 17:24, the moon at 23:00.

## Gotchas

- With the time's sign planted the wrong way round in the spectrum, the check fails (`worst` 0.064 against `top` 0.049).
- The CPU sum is only cascade 0 (about 2,800 waves); the finer cascades are the same code at other patch sizes.
