# Phase 2 — the board becomes a diorama

**Owner's brief (2026-09-28):** keep everything else; make the board feel like the old voxel
build's board did — a *volumetric* miniature world standing on the table ("hologram-like"), in the
direction of a model-railway layout (hills, a river valley, a town, woods, bridges, all in real
volume). Start after the current score → improve loop.

**Constraint that does not move:** it is still a game. The hex grid, red ink, fans, reach dots and
forecasts must stay as readable as they are now (they are drawn in the sheet shader from world
XZ, so they drape over any relief for free), and every piece must stand level on its hex.

## What changes

| Today | Diorama |
|---|---|
| Relief ±5 mm (dunes +4.8, riverbed −8, craters −6) | Relief of **2–5 cm**: the Great Dune and coastal dunes as sculpted ridges (+3–5 cm), the German rise at Lombartzyde (+1.5–2 cm), the polder a hair below the fields, the Yser cut **1.5–2 cm** deep with banks, the sea a step down at the beach |
| A flat plinth 1.4 cm thick | A **slab with a cut edge**: the terrain's own cross-section visible on all four sides — sand over clay over peat strata, the river and trenches sectioned where they meet the edge. This is the "floating model" read the old build had |
| Painted woods, painted roads | **3D flora and roads**: instanced poplar rows along the roads (the Flanders silhouette), willows along the Yser and polder dykes, marram tufts on the dunes, hedges; roads as raised cambered strips; a narrow-gauge railway into Nieuwpoort |
| Ruins, church, château, blockhouse only on their hexes | A **town** at Nieuwpoort (brick houses, stepped gables, rooftops, the Halle tower) and farm clusters on the polder, scaled to the miniatures (a house ~3–4 cm) — on hexes that are already ruin/church/château or off-board margin, never on hexes pieces must enter |
| — | **Hex terraces**: within ~55% of each hex's radius the ground is eased to a level platform, so bases sit flat on slopes and the grid reads as a wargame even on a hillside |

## How (Worker-B's module, split in two to build in parallel)

1. **Terrain + slab** (`src/board/Relief.ts`, `fields.ts`, new `Slab.ts`): scale the height
   functions, add the ridge/valley fields, hex terracing, and the sectioned edge mesh with strata.
   `heightAt()` stays the one surface query, so pieces, kit and overlays follow automatically.
2. **Flora + town** (new `src/board/Flora.ts`, `Town.ts`, assets under `src/assets/miniatures/`):
   instanced trees/shrubs/houses placed from the terrain fields with a seeded RNG, kept out of
   every hex centre a piece can occupy (a keep-out radius) and out of MG fan readability.

## Gates

- Rules untouched: `npm run test:rules` 32/32, selfplay gates unchanged.
- e2e 5/5, `hexScreen`/`hexAt` round-trip for all 117 hexes on the new relief.
- Pieces level: base tilt < 2° on every hex.
- Budget: ≤ 900k triangles and ≤ 130 draw calls at the commander view (instancing).
- A fresh independent Sonnet 5 score, same prompt, plus a before/after pair of the commander view.
