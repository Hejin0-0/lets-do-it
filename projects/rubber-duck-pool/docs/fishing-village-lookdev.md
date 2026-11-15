# Fishing village: independent lookdev study

2026-11-15. This is a new study for the second shelf's `diorama-sixth`:
three small cottages by a jetty, with smoke from one chimney. The existing game
model was not overwritten and this study has not been integrated. Materials
and lighting refer to the same warm coastal art direction as the chair and
other collectible studies.

## Review files

All files below are in `../assets/02_models/props/fishing-village-study/`.

| File | Purpose |
| --- | --- |
| `fishing-village-v4.blend` | Editable source, named objects, packed textures, studio |
| `fishing-village-v4.glb`, `.fbx` | Joined full-resolution asset without studio objects |
| `fishing-village-v4-blender.png`, `-blender-back.png` | Front and back Cycles reviews |
| `fishing-village-v4-lod.glb`, `-lod.fbx` | Lighter shelf-scale candidate, not a game export |
| `fishing-village-v4-lod-blender.png` | Blender preview of the lighter candidate |
| `fishing-village-v1` through `v3` | Previous source models, exports and paired renders |

The full model has **9,528 evaluated triangles**. The lighter candidate has
**6,264**. Its only geometry reduction is skipping tiny bevel modifiers on
windows and the jetty planks; all source objects are still present. The
8,000-triangle target used here is a local comparison target, not proof of
actual performance.

## Work and reasons

1. Made an independent island, three gabled homes, a post-supported plank
   jetty and four opaque, static smoke puffs. The existing game model failed
   the new named-structure test as expected; it was not edited.
2. The first front and back renders showed flat, empty house backs and little
   evidence of fishing. Added front, rear and side windows, roof seams, a
   small moored skiff, a crate and low grass. Packed existing lighthouse,
   longship and shipwreck-study base-color textures. The facade check failed
   on v1's absent rear windows before passing on v2.
3. The v2 render showed the skiff intersecting two rocks. A conservative
   world-space bounding-box test confirmed the intersection. Opened the
   channel in v3 and added a canopy, barrel, floats and stepping stones.
4. A ground ray-cast check found that v3's stepping stones were buried. In v4
   they are positioned from the actual island surface; added door/window
   details and jetty braces, then inspected front and back renders again.
5. The full v4 model failed the local 8,000 triangle target as expected.
   Removed only window and jetty-plank bevel evaluation for a separate LOD,
   re-rendered it and compared it to the full version.
6. Inspected the v4 library through Blender MCP without opening or modifying
   the active scene: 165 objects listed, including three house bodies, the
   skiff and four smoke pieces. The source and renders were generated in a
   disposable background Blender 5.3.0 process.

## Checks actually run

- Blender source: `FISHING_VILLAGE_OK objects=160 smoke_puffs=4`,
  `FISHING_FACADES_OK houses=3 front_and_rear=6`,
  `FISHING_HARBOR_OK skiff_clear_of_rock_bounds`, and
  `FISHING_PATH_OK visible_stones=4`. The harbor check is a conservative
  bounding-box test, not a full collision or interaction simulation.
- Evaluated source versus imported full GLB: `JUNGLE_GEOMETRY_OK
  triangles=9528 materials=17`. This compares triangle/material totals and
  world bounds, not shading, normals or exact UV correspondence.
- Full versus LOD GLB: `FISHING_LOD_OK triangles=6264
  max_bound_error=0.000000 textured_materials=7`. The seven referenced
  base-color textures are embedded PNGs and their primitives have UVs.
- All **120 house-body and roof triangles** were matched in the LOD at world
  positions rounded to four decimals with their material assignments. The
  check first rejected an unrelated shipwreck GLB (120 missing).
- Full front/back and LOD front renders were inspected in Blender. Window
  frames and jetty plank edges are less rounded in the LOD at close range.

To reproduce the editable source and lighter candidate:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 6 --factory-startup \
  --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_fishing_village_study.py -- 4
/Applications/Blender.app/Contents/MacOS/Blender -b \
  projects/rubber-duck-pool/assets/02_models/props/fishing-village-study/fishing-village-v4.blend \
  -t 6 --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_fishing_village_lod.py
```

The generator copies its texture inputs from the existing
`lighthouse-island-study`, `shipwreck-reef-study` and `longship-bottle-study`
folders and packs them into the Blender file and GLB.

## Limitations and next checks

- This is a stylized miniature work in progress, not a claim of AAA readiness.
  The smoke is a stationary opaque sculpt, the water is an opaque surface,
  and the three houses do not have modeled interiors.
- Scenario's team free-plan generation limit rejected the preceding concept
  request (`PlanLimitReachedError`, 48/50 CU); no new Scenario image was
  generated for the village and no substitute paid generation was attempted.
- Unity MCP had no connected editor, and Unity 6000.6.8f1's headless licensing
  IPC was unavailable during the earlier lighthouse attempt. **This village
  has no Unity render or Unity visual approval.**
- The existing game asset remains in use. Conversion, real game camera and
  shelf scale, browser, mobile, performance and smoke animation were not
  validated. Blender shading is not evidence of matching web/Unity shading.
