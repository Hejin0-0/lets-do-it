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

- `volcano-island-v5.blend`: editable Blender scene with a studio and packed
  mountain textures.
- `volcano-island-v5.glb`: collectible-only glTF binary with embedded mountain
  base-color and normal textures.
- `volcano-island-v5.fbx`: collectible-only FBX, plus the individual 1024-square
  `rock-base.png` and `rock-normal.png` textures.
- `volcano-island-v5-blender.png` and `volcano-island-v5-unity.png`: final
  studio comparisons. Earlier version files and previews preserve the iterations.

`tools/create_volcano_island_study.py` generates the study in an **empty
background Blender process**; it refuses to run in an interactive session.
The final version can be recreated with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 6 \
  --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_volcano_island_study.py -- 5
```

`tools/render_volcano_island_unity.cs` is an Editor-only comparison script
guarded to the disposable `volcano-island-unity-6000.6.8f1` project and Unity
6000.6.8f1. Its Standard materials are look-development approximations, not a
game material implementation. The final comparison explicitly supplies the
baked mountain color and normal images. Historical renders are snapshots of
the work at the time; shared generator corrections may affect regenerated old
versions.

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

## Verification and remaining work

- Blender 5.2.4 LTS Release Candidate produced all five Blender renders.
- Unity 6000.6.8f1 produced all five comparison renders. Version 5 imported
  69 renderers, applied the two textures to one mountain and measured bounds
  of approximately `(1.68, 1.35, 1.72)` Unity units.
- Blender MCP base-mesh checks for the mountain, foundation, lagoon, sand and
  smoke found zero non-manifold edges, inconsistent shared edges and
  zero-area faces, with positive signed volumes. This does not cover every
  object or evaluated modifier; the open decorative sheets were not included.
- The final GLB contains 69 nodes/meshes, 16,726 triangles, two embedded
  images, the mountain base-color and normal maps, and no studio objects.
- `crapper`, `dryer` and `mutator` were not available on PATH. Game tests were
  not run because this is an isolated art study with no game-code change.
- This is a look-development study, not an approved AAA or production-ready
  asset. The static smoke is still visibly sculptural/faceted in Unity; other
  materials do not yet have equivalent baked textures. Unity's studio lighting
  and manually assigned materials differ from Blender. The 69 renderers need
  batching/merging and a performance budget; LODs, collision, in-game scale,
  animation, runtime placement, web rendering and visual approval remain
  unverified.
