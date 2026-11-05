# Volcano island collectible: isolated look development

## Direction

The next collectible study is a small, calm volcanic island: a weathered dark
rock raft, turquoise shallows, a warm sand rim, coastal plants, a hollow cone,
a slow lava stream and a little smoke. It takes its warm miniature scale from
the Rubber Duck Pool art direction; it is a new model, not the existing in-game
placeholder. The game has not been changed to use it.

The [Scenario concept](https://app.scenario.com/assets?openAssetId=asset_2C6dmSwyCY5Xgu72sZaYYkF3&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ)
was generated in the previously approved Default Project with GPT Image 2.5
Flare, medium quality, for 3 CU. It guided the composition rather than serving
as geometry or a texture.

## Source and previews

Files are in `assets/02_models/props/volcano-island-study/`:

- `volcano-island-v12.blend`: editable source scene and studio; original rock
  pieces remain individually editable.
- `volcano-island-v12.glb`: collectible-only glTF with four embedded 1024-square
  mountain and shoreline-rock base-color and normal maps.
- `volcano-island-v12.fbx` and the individual `rock-base`, `rock-normal`,
  `reef-base` and `reef-normal` PNGs: the Unity comparison inputs.
- `volcano-island-v12-blender.png`, `-blender-back.png` and `-unity.png`:
  current studio comparisons. Intermediate render snapshots record the
  changes and regressions; intermediate full model exports remain local and
  can be regenerated instead of being added repeatedly to Git.

`tools/create_volcano_island_study.py` generates the study in an **empty
background Blender process**; it refuses to run in an interactive session.
The final version can be recreated with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 6 \
  --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_volcano_island_study.py -- 12
```

`tools/render_volcano_island_unity.cs` is an Editor-only comparison script
guarded to the disposable `volcano-island-unity-6000.6.8f1` project and Unity
6000.6.8f1. Its Standard materials are look-development approximations, not a
game material implementation. The final comparison explicitly supplies the
baked mountain and shoreline-rock color and normal images. Its camera faces the
same side as Blender, though the lighting and projection are not identical.
Historical renders are snapshots of the work at the time; shared generator
corrections may affect regenerated old versions.

## Iteration and action log

1. Inspected the current collectible catalogue and art direction, and kept the
   work separate from concurrently modified game files. Selected Volcano island
   as the next study after the three bottle studies.
2. Checked Scenario, Blender MCP and Unity MCP connectivity. The connected
   Unity MCP editor was 6000.6.0f1, so the requested 6000.6.8f1 was used in a
   separate CLI-driven project instead of changing the open scene.
3. Generated and reviewed the Scenario concept. Built version 1 from scratch
   in background Blender, then rendered and imported it into Unity. An initial
   Blender run failed because a floating-point endpoint exceeded one; clamping
   the endpoint fixed the fractional-power error. The first Unity camera faced
   the back of the model, so its preview is not an equivalent hero angle.
4. Version 2 reduced the repetitive perimeter stones, reshaped the smoke and
   extended the lava toward the crater. The next Blender and Unity renders still
   showed gaps in the overlapping lava strips; Unity's camera was corrected.
5. Version 3 replaced the overlapping strips with one banded surface and added
   plants. Both renders showed a continuous but overly uniform striped flow.
6. Version 4 cut a channel into the crater lip, warmed the lava, varied the rock
   edge and reshaped the smoke. Blender and Unity were rendered again; the hot
   patches still looked too rectangular and the Unity rock was too flat.
7. Version 5 tapered the hot streaks, adjusted the cone and smoke, added a few
   pebbles and baked the mountain's procedural color and bump to 1024-square
   textures. Blender and Unity were rendered and visually compared again.
8. Used Blender MCP to inspect the saved base meshes without replacing the open
   Blender scene. The first audit requested the pre-conversion smoke name; the
   saved mesh was named with a `.001` suffix, so the audit was repeated with
   the actual name. Inspected the exported GLB and the Unity render log.
9. Revisited the Scenario reference. Version 6 added broken shoreline foam,
   wider rocks and mountain relief, and exported evaluated copies grouped by
   material. The renderer count dropped from 69 to 11, but the tubular wavelets
   increased the export to 33,394 triangles and the boulders looked angular.
10. Version 7 replaced the wavelets with flat tapered ribbons, smoothed the
    boulders and reduced the export to 19,594 triangles. Version 8 baked a
    second pair of maps for the shoreline rocks and confirmed both map pairs
    in Unity; the additional individual mountain outcrops looked stuck on.
11. Version 9 removed those outcrops, increased continuous mountain relief,
    changed the smoke silhouette and added a rear Blender review. The rear
    view revealed that the lava strip floated away from the volcano.
12. Version 10 projected the lava onto the actual mountain surface and matched
    the Unity camera side to Blender. A render revealed dark flecks where
    triangles still penetrated the mountain even though their vertices were
    nearby. A geometric check reproduced the defect before the fix.
13. Version 11 increased the flow clearance. The main stream passed the
    triangle-center check, but the crater lip still failed it. Version 12
    subdivided the lip, passed both checks and was rendered from front and
    back in Blender and from the corresponding side in Unity.
14. Checked the exported material groups, triangle totals and bounds against
    the editable source; checked that the four referenced maps are embedded in
    the GLB. A deliberately externalized texture first passed the old checker,
    then was rejected after the checker was corrected. Rechecked the five main
    base meshes through Blender MCP without replacing the user's open scene.
15. After the isolated Unity process exited, removed its rebuildable 73 MiB
    `Library` cache. Other project files and ongoing work were left in place.

## Verification and remaining work

- Blender 5.2.4 LTS Release Candidate generated versions 1–12. Unity
  6000.6.8f1 rendered versions 1–8 and 12, with no Unity renders for 9–11.
  Version 12 imported 11 renderers, applied both maps to one mountain and one
  shoreline-rock group, and measured bounds of `(1.77, 1.37, 1.78)` units.
- Blender MCP checks of the v12 mountain, foundation, lagoon, sand and smoke
  base meshes found no non-manifold edges, inconsistent shared edges or
  zero-area faces, and positive signed volumes. They do not cover every object,
  evaluated modifier or intentionally open decorative sheet.
- The v12 GLB contains 11 meshes, 21,234 triangles, 11 materials and four
  referenced embedded images; studio objects are excluded. Evaluated source
  and imported GLB match in per-material triangle counts and world bounds.
- On the source lava strip and crater lip, vertices are at most 0.006 units
  from the mountain. Their triangle centers pass a sampled penetration check.
  This does not prove that every point on every triangle is clear.
- `crapper`, `dryer` and `mutator` were not available on PATH. Game tests were
  not run because this is an isolated art study with no game-code change.
- This remains a look-development study, not an approved AAA or game-ready
  asset. Smoke is static and sculptural; other materials still differ between
  Blender and Unity. The 11 meshes are a structural reduction, not a measured
  frame-rate improvement. At 21,234 triangles the study is much heavier than
  the current 2,860-triangle volcano, which is drawn in two locations. LOD,
  further reduction, collisions, scale, animation, actual web materials,
  placement, device performance and visual approval remain unverified.
