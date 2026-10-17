# Jelly — Material Studies

Fourteen WebGPU jellies on one page. The arrows at the top centre (a bar along the bottom on a
phone), or `#NN` in the URL, turn one jelly into the next: 01 ring mold jelly with pineapple set inside, 02 gummy
bear, 03 two-layer gummy dolphin, 04 custard pudding, 05 whole melon, 06 melon slice and knife, 07 citrus on the
cutting board, 08 press, 09 dice, 10 island, 11 harbor, 12 canal lock, 13 iceberg, 14 pool of rubber ducks. Between two jellies a
curtain in the next one's colour rises, shows its number and name while it loads, and lifts again.

```bash
npm install
npm run dev      # http://127.0.0.1:5173/#01
npm test         # the jellies' headless physics and geometry checks
npm run build    # dist/, for the hub
```

`hub.json` lists it in the hub; `npm run build` writes `dist/`, which
`node scripts/build-projects.mjs jelly` copies to `apps/hub/public/p/jelly/`.

## The jellies

| No. | Jelly | What it does |
| --- | --- | --- |
| 01 | Ring mold Jelly | a fluted ring mould set with pineapple, on a gold-rimmed plate; three flavours |
| 02 | Gummy Bear | a sitting gummy bear; sugar coat, three flavours |
| 03 | Dolphin Jelly | a two-layer gummy dolphin that rolls over to show its cream belly |
| 04 | Custard Pudding | caramel-topped custard with set-in specks; it shivers when tapped |
| 05 | Whole Melon | thirty-two centimetres of glossy watermelon jelly to pull, wobble and cut into pieces |
| 06 | Melon Jelly | a slice of melon jelly: pull it like jelly, cut it like fruit with the knife |
| 07 | Citrus Jelly | citrus jelly in segments on the cutting board: slice it with the crinkle blade or the cookie cutters |
| 08 | Jelly Press | four gummies under one hydraulic press |
| 09 | Jelly Dice | translucent gummies that squash, stretch and ring; roll them |
| 10 | Island Jelly | a palm island in a block of jelly sea; stir, tip, throw a coconut |
| 11 | Harbor Jelly | a container harbour: two cranes swap boxes, a tug takes the feeder ship off and back, gulls, yachts, a tide |
| 12 | Lock Jelly | a canal lock: the keeper works the gates and paddles, the boat goes down and up |
| 13 | Iceberg Jelly | a glacier calves into a polar bay; an icebreaker that breaks the pancake ice she runs into, penguins, seals, an orca |
| 14 | Pool Jelly | a walled pool courtyard full of rubber ducks (add, dress, follow them) going round by slide, drain and fountain; an hourglass to turn, a radio to switch on; it fills the page |

What each could do better is kept in [`docs/improvements.md`](docs/improvements.md).

## How it is put together

One canvas and one WebGPU device for the whole page. Each jelly is a module loaded on demand
(`src/specimens/registry.js`, which also gives each its curtain colour) with the contract `mount(ctx) -> instance`; the switcher hands it a
resource scope of the device, an `AbortSignal` for its listeners and a frame loop, and on the next
switch aborts the signal and releases every buffer and texture the jelly made.

| Path | What |
| --- | --- |
| `src/shell/` | the page: stage (masthead, panel, foot, notes, toast, fallback), the switcher, the loading curtain, styles |
| `src/core/math.js`, `gpu.js`, `camera.js` | matrices and colour, device and resource scope, framing in the free space |
| `src/core/jelly/` | the renderer every tet-skinned jelly shares (two skinning strategies, replaceable studio parts, an opt-in lens-focused shadow and floor height), its WGSL, the page logic (`runJellyPage`: controls, input, loop, readouts, test hook), the soft body any SDF shape gets (`sdfbody.js`: surface nets, tet lattice, XPBD, grab; 01–04), the serving plate (01, 04), the cast-gummy material, renderer plugins (props, membranes, seeds, carried inclusions) and the teardrop seed |
| `src/core/cut/` | the cut jellies: the slice kernel (fields, rounding, Delaunay, cuts, meshing), the tet solver, pieces in one world, the steel (knives, crinkle blade, cookie cutters) |
| `src/core/jellysim.js` | the lattice-cell solver of the dice and the whole melon |
| `src/core/diorama/` | the jelly-block diorama (10 island, 11 harbor, 12 lock, 13 iceberg, 14 pool): the shallow-water sea (several bodies of water at their own levels, joined only while a gate is open), the block that tips and wobbles, bubbles, foam, rigid floating things made of spheres (`floaters.js`: draft, righting, riding the waves, shoved by moving hulls, carried by a steady current, woken when their water's level moves, picked by their spheres (a little larger than they are)), ships that follow a route (`vessel.js`: a trailing stern, heave and roll, a bow wave and wash, a tug's moves astern, sideways and on the spot, the hull as a solid for floating things), the renderer and its WGSL (sea, caustics, shadows, the specimen's `groundTop` and cut-face `section`, a palette of 32 slots), props as one mesh of posed parts (`parts.js`: paint, leaves, brass, glass, brick, washing, fish, smoke, faceted ice, corrugated sheet, timber, clear glass by alpha to coverage; cables stretched between two points), the page (`ui.js`: masthead, status, panel or bottom sheet) and its input (`view.js`: camera framed in the free space, sun, stir / tip / grab-and-throw / orbit) |
| `src/specimens/NN-name/` | each jelly: its words and markup, its material (WGSL), its tools |
| `tests/` | headless checks of each jelly: the original pages' physics and geometry run against the shared code (`tests/load.mjs`), the floaters, and each diorama's world (its story run through, nothing aground or through a face, nothing lost, long soaks) |

A specimen either fills the study page (meta, `panel`, `foot`, `notes`) and calls
`runJellyPage`, or draws a page of its own design (`meta.layout = 'custom'`, markup and styles in
`extra`, scoped under one class: 08 press, 09 dice, 10 island, 11 harbor, 12 lock, 13 iceberg, 14 pool).
