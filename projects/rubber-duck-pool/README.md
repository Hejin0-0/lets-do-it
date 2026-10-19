# Rubber Duck Pool

A walled pool courtyard on a cliff above the sea, full of rubber ducks, in WebGPU. The ducks circle the big
pool, go down the slide into the round pool on the lawn, are drawn down its drain and ride a clear tube back
up into the big pool; new ducks drop into its middle. Round the cliff the open sea runs to the horizon, a wind
sea over a long swell. A day goes by in ten minutes, from dawn to a moonlit night. A big swan float on the stone creeps toward the big pool a hop at a time and after a few minutes leaps
in; afloat, it scoops up a duck it drifts into and holds it in its ring for a while. A flyer, a duck in a
propeller cap, now and then flies, and some flights take it over the cliff and out to sea.

The page is the scene alone: its own controls are being designed apart from jelly's. Until they come, the canvas
answers a user (drag a duck or a float to pick it up and throw it, click the hourglass to turn it over, the radio
to turn it through its three stations, a deck chair to sit in it, drag the water to stir it, drag anywhere else
to look round, scroll to zoom), and the test hook `window.__pool` does the rest: add and take out ducks, dress one
(twelve designs, seven things to wear), follow it, add a flyer, set the hour or stop the clock, show every duck's
name, sound.

It began as no. 14 of `projects/jelly` and runs on the same diorama engine, now the shared package
`@lid/diorama` (`packages/diorama`). Made from `templates/project`, then turned from TypeScript and three.js
into the engine's plain JavaScript and WebGPU.

```bash
npm install
npm run dev           # http://127.0.0.1:5173
npm test              # the pool's world run headless: ducks going round, the drain, the current, the toys, forty ducks
npm run build         # dist/, for the hub
npm run assets:ducks  # the ducks from the models in models/ (needs Blender and cwebp; the output is in git)
```

`hub.json` lists it in the hub; `npm run build` writes `dist/`, which
`node scripts/build-projects.mjs rubber-duck-pool` copies to `apps/hub/public/p/rubber-duck-pool/`.

The ducks are the twelve base duck models (`models/duck-NN-*.glb`, made in Blender, about 79,000 triangles
each; kept out of git with the concept art in `duck-concepts/`). They share one mesh and differ by their albedo
atlas, so `npm run assets:ducks` cuts the mesh down to about 4,400 triangles in the pool's space
(`public/ducks/duck.bin`, with its counts, physics spheres and head in `src/pool/duck-shape.js`) and makes each
atlas a 512 px WebP and each preview a swatch: 472 KB for all twelve. The page draws every duck in one
instanced call with the atlases as one texture array.

The sea is an FFT ocean of our own (the reference was [web-ocean](https://github.com/Noniv/web-ocean), MIT: its
ideas, none of its code). `src/pool/ocean.js` draws a wind sea and a swell from JONSWAP spectra into four cascades
of 256² Fourier amplitudes, from a 1.2 km patch down to 3 m; a unit is 20 m, so the waves keep a real sea's sizes
and speeds under a 25 m cliff. `src/pool/ocean-gpu.js` turns them into the surface every frame (compute: the
spectrum at the world's time, inverse FFTs with their butterflies in workgroup memory, the displacement, the slopes
and their squares, foam where the crests fold, mipmaps). The renderer draws it as rings round the block out to
3,000 units, raised and pushed by the waves, and shades each pixel with the sky, the sun's glitter from how the
slopes spread (so the far sea keeps its roughness when its waves are too small to draw), the water lit through the
crests, whitecaps, the surf at the cliff's foot and the haze. A flyer out at sea rides the biggest 320 waves, summed
on the CPU.

| Path | What |
| --- | --- |
| `src/main.js` | the host: the WebGPU device and canvas, the frame loop (`@lid/loop`), the test hook (`window.__pool`), the card shown without WebGPU |
| `src/pool/` | the pool as a module (`meta`, `extra`, `mount(ctx)`): layout, ducks and their assets, world (slide, drain, tube, fountain, toys, hourglass, radio), scenery and scene, the sea (`ocean.js`, `ocean-gpu.js`), renderer, sound, the page |
| `public/ducks/` | the ducks' mesh, atlases and swatches (made by `npm run assets:ducks`) |
| `tools/` | that asset build: `build-ducks.mjs` runs Blender (`build_duck_assets.py`) and cwebp |
| `tests/pool.test.mjs` | headless checks of the world |

What it could do better is kept in [`docs/improvements.md`](docs/improvements.md).
