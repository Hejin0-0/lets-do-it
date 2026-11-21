# Shipwreck reef: independent lookdev study

2026-11-15. This is a new, editable study of the second shelf's `diorama-fifth`
collectible. The existing game model was not overwritten or integrated. The art
direction is the resort's warm wood and turquoise water, interpreted as a
small, friendly shipwreck rather than a distressed realistic disaster scene.

## Review files

All images and model files below are in
`../assets/02_models/props/shipwreck-reef-study/`.

| File | Purpose |
| --- | --- |
| `shipwreck-reef-v5.blend` | Editable named parts, packed textures and studio setup |
| `shipwreck-reef-v5.glb`, `.fbx` | Joined full-resolution asset, without studio objects |
| `shipwreck-reef-v5-blender.png`, `-blender-back.png` | Cycles front and back review images |
| `shipwreck-reef-v5-lod.glb`, `-lod.fbx` | A lighter shelf-scale candidate, not yet a game export |
| `shipwreck-reef-v5-lod-blender.png` | Blender preview of the candidate |
| `shipwreck-reef-v1` through `v4` | Previous source models, exports and paired renders for comparison |

The full model contains **11,436 evaluated triangles**. The LOD has **7,876**;
8,000 was a local comparison target, not a measured project performance budget.
It retains the hull, both rims where present, ribs, main rocks, sea, all material
families and the large coral branches. It removes tiny pebbles, fastenings,
coral fork and tip pieces, some coral cushions, and two of four board-seam
lines on each side of the hull.

## Work and reasons

1. Built a hollow wooden hull with ribs, leaning mast, reef, water and coral as
   a new study. The old game's `diorama-fifth.blend` failed the new structural
   check as expected; it does not contain the new named parts.
2. Reviewed v1 from both sides. The hull looked intact and its face-level color
   changes formed a checkerboard. In v2 the hull used a packed, UV-mapped grain
   image from our longship study, the foreground side was lowered unevenly, and
   the sandbar and edge rocks were reduced.
3. Reviewed v2: it still looked like a usable boat. V3 removed part of the
   rail, created a jagged edge, tilted the broken mast and added separate broken
   boards, coral forks and scattered small stones. A damage check first failed
   on v2's continuous rail, then passed on v3.
4. Reviewed v3 and v4 from front and back. V4 added interior board seams,
   small fastenings and a few coral cushions; it reused the lighthouse study's
   packed sand and stone base-color textures for family resemblance.
5. V4 still appeared to hover on the water. A waterline check first failed on
   v4; v5 lowered the hull through the water surface, traced two small washes
   from the actual hull/sea intersections and added a subtle tileable water
   base-color texture. Front and back renders show water inside the wreck.
6. Exported a separately previewed LOD. The v4 full model failed the local
   8,000 triangle target as expected. The v5 candidate passed it after removing
   small details while keeping the primary silhouette and hull geometry intact.
7. Queried the v5 Blender library through MCP without opening or modifying the
   user's active scene: 333 objects listed, including the hull and both waterline
   washes. Background Blender 5.3.0 created the deliverables.

## Checks actually run

- Blender source: `SHIPWRECK_CHECK_OK objects=328`,
  `SHIPWRECK_DAMAGE_OK remaining_rail_segments=5 broken_planks=3` and
  `SHIPWRECK_WATERLINE_OK sea=0.0250 hull_min=-0.0503 wash=2`.
- Full source versus imported GLB: `JUNGLE_GEOMETRY_OK triangles=11436
  materials=11`. This compares evaluated triangle/material totals and world
  bounds; it does not prove identical shading, normals or UV placement.
- Full versus LOD GLB: `SHIPWRECK_LOD_OK triangles=7876
  max_bound_error=0.000000 textured_materials=5`. The five base-color images
  are embedded PNGs and the associated primitives have UV coordinates.
- A separate Blender check matched all **568 hull triangles**, world positions
  rounded to four decimals and material assignments, in the imported LOD. The
  same check first rejected an unrelated lighthouse GLB (568 hull triangles
  missing).
- Front and back source renders and a front LOD render were visually inspected.
  The LOD removes some branch detail and thin board seams at close range.

To reproduce the source render and exports:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 6 --factory-startup \
  --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_shipwreck_reef_study.py -- 5
/Applications/Blender.app/Contents/MacOS/Blender -b \
  projects/rubber-duck-pool/assets/02_models/props/shipwreck-reef-study/shipwreck-reef-v5.blend \
  -t 6 --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_shipwreck_reef_lod.py
```

The generator copies its existing texture inputs from `longship-bottle-study`
and `lighthouse-island-study`, generates the water texture deterministically,
and packs them into the Blender file and GLB.

## Limitations and next checks

- This is a stylized work in progress, not a claim of AAA readiness. In
  particular, the damaged rim still reads as a regular zigzag in some views,
  the coral is simplified, and the water is an opaque miniature surface.
- A Scenario concept was requested but the team's free-plan generation limit
  rejected it (`PlanLimitReachedError`, 48/50 CU used); no new Scenario image
  was generated for this asset. Existing project art and the lighthouse study
  informed the palette. No retry or substitute paid generation was attempted.
- Unity MCP had no connected editor and the 6000.6.8f1 headless editor's
  licensing IPC was unavailable during the preceding lighthouse attempt.
  **There is no Unity render or Unity visual approval for this shipwreck.**
- The Blender-only water bump does not establish matching GLB/Unity shading.
  Game conversion, real shelf scale/camera, browser, mobile, performance and
  animation/interaction were not validated. Keep the existing game asset until
  those checks and a visual decision are made.
