# Rubber Duck Pool

A walled pool courtyard on a cliff above the sea, full of rubber ducks, in WebGPU. The ducks circle the big
pool, go down the slide into the round pool on the lawn, are drawn down its drain and ride a clear tube back
up into the big pool; new ducks drop into its middle. Add ducks, take them away, pick one up and dress it
(eight colours, seven things to wear), follow it round; turn the hourglass over, switch the radio on; stir
the water; sit in a deck chair, by the big pool or looking out to sea. A big swan float on the stone creeps
toward the big pool a hop at a time and after a few minutes leaps in; afloat, it scoops up a duck it drifts
into and holds it in its ring for a while.

It began as no. 14 of `projects/jelly` and runs on the same diorama engine, now the shared package
`@lid/diorama` (`packages/diorama`). Made from `templates/project`, then turned from TypeScript and three.js
into the engine's plain JavaScript and WebGPU.

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # the pool's world run headless: ducks going round, the drain, the current, the toys, forty ducks
npm run build    # dist/, for the hub
```

`hub.json` lists it in the hub; `npm run build` writes `dist/`, which
`node scripts/build-projects.mjs rubber-duck-pool` copies to `apps/hub/public/p/rubber-duck-pool/`.

| Path | What |
| --- | --- |
| `src/main.js` | the host: the WebGPU device and canvas, the frame loop (`@lid/loop`), a toast, the test hook (`window.__pool`), the card shown without WebGPU |
| `src/pool/` | the pool as a module (`meta`, `extra`, `mount(ctx)`): layout, ducks, world (slide, drain, tube, fountain, toys, hourglass, radio), scenery and scene, renderer, sound, the page |
| `tests/pool.test.mjs` | headless checks of the world |

What it could do better is kept in [`docs/improvements.md`](docs/improvements.md).
