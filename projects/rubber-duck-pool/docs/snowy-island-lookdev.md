# Snowy island collectible: look-development study

Status: **exploratory, not integrated, and not yet an AA/AAA asset**. This is a replacement candidate for `diorama-third`, described in the game as one pine under fresh snow in a summer sea. The current collectible and game code remain unchanged. The deck chair and `asset-art-direction.md` are mood references, not a demand to copy the chair's colors.

## Files and sources

All model and image paths below are in `assets/02_models/props/snowy-island-study/`:

- `snowy-island-v11.blend`: editable Blender scene with packed foliage images and a separate studio setup.
- `snowy-island-v11.glb`: standalone asset with two embedded foliage textures, UVs, and alpha. `snowy-island-v11.fbx` is the mesh used in the Unity comparison; Unity's comparison script assigns its textures separately.
- `snowy-island-v11-blender.png`, `snowy-island-v11-blender-back.png`, `snowy-island-v11-thumbnail.png`, and `snowy-island-v11-unity.png`: actual front, rear, 220-pixel approximation, and Unity comparison. Earlier numbered files record the iteration rather than approved variants. The v7 Unity render contains a known shader failure and is preserved as such.
- Foliage source: [Fir Tree 01](https://polyhaven.com/a/fir_tree_01), by Rico Cilliers and Rob Tuytel, Poly Haven, CC0. The original 1K diffuse and alpha images and their derived RGBA, lifted and snowy variants are included here. Its high-poly geometry was examined as a reference and is not included in the exported asset.
- `tools/create_snowy_island_study.py` generates revisions 1–11 deterministically. `tools/check_snowy_source.py`, `tools/check_snowy_island_export.py`, and `tools/check_snowy_foliage.py` perform focused checks. `tools/check_jungle_export_geometry.py` compares Blender source and GLB geometry and is shared with the jungle study. `tools/render_snowy_island_unity.cs` and `tools/snowy_foliage_cutout.shader` build the Unity comparison.

Scenario was checked for an existing suitable reference. The preceding study's actual 3D generation returned `429 PlanLimitReachedError`; this study did not retry that limit or generate a new Scenario asset. The tree texture is from Poly Haven, not Scenario.

## Reproduction

From the repository root, using Blender 5.2.4 LTS RC or a compatible version:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --threads 4 --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_snowy_island_study.py -- 11
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python projects/rubber-duck-pool/tools/check_snowy_source.py -- projects/rubber-duck-pool/assets/02_models/props/snowy-island-study/snowy-island-v11.blend
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python projects/rubber-duck-pool/tools/check_jungle_export_geometry.py -- projects/rubber-duck-pool/assets/02_models/props/snowy-island-study/snowy-island-v11.blend projects/rubber-duck-pool/assets/02_models/props/snowy-island-study/snowy-island-v11.glb
python3 projects/rubber-duck-pool/tools/check_snowy_island_export.py projects/rubber-duck-pool/assets/02_models/props/snowy-island-study/snowy-island-v11.glb
python3 projects/rubber-duck-pool/tools/check_snowy_foliage.py projects/rubber-duck-pool/assets/02_models/props/snowy-island-study/snowy-island-v11.glb
```

The generator refuses to run inside an interactive Blender session and builds an empty disposable scene. Unity comparison requires a disposable project named `snowy-island-unity-6000.6.8f1`, the supplied editor script and shader under `Assets/Editor`, the v11 FBX and the lifted and snow RGBA images under `Assets`, `SNOWY_REVISION=11`, and `SNOWY_OUTPUT_DIR` pointing to an existing directory. Run `SnowyIslandStudio.Render` with Unity **6000.6.8f1**. The script checks both the project path and editor version before creating its scene.

## Action and review log

1. Read the collectible list and art direction, checked the existing game and shared worktree, and chose the snowy island so the study would not overwrite another asset or unrelated work. Set an initial 8,000-triangle study limit because the preceding jungle study had grown far beyond its in-game counterpart.
2. Started a separate Blender 5.2.4 LTS RC process and connected Blender MCP, leaving other Blender scenes alone. Modeled a snow-covered island, water, rocks and one evergreen, and rendered eleven numbered Blender revisions with front and rear comparisons where available.
3. V1–V4 refined the initial snow, shore and branch forms. A Unity comparison exposed downward-facing branch snow; the source validator reproduced **620 downward-facing faces** on v1, and the corrected version passed. Reworked water to reduce intersections and the visual appearance of stacked layers.
4. V5–V6 rebuilt broad leaf-like branches as notched sprays and increased tier density. Their silhouettes still read as broad leaves. Inspected Poly Haven's fir through Blender MCP; its full geometry was too heavy for this small collectible, so used its CC0 twig images on custom, double-sided cards from v7 onward.
5. V7–V10 refined foliage density and snowy needles. The first Unity foliage shader compiled incorrectly and produced white rectangles, despite a successful process exit. Fixed the shader and added an explicit compiler-error check; the v8 and subsequent Unity comparison renders displayed the texture. Blender uses alpha blend while the isolated Unity shader uses a 0.4 alpha cutoff, so these are not identical material implementations.
6. V11 removed the visible geometric cone at the top, added upright textured shoots and upper foliage, and thinned the foundation. Comparing actual bounds showed the studio floor could clip the low shoreline; it was moved below the model's lowest vertex. The grounding check was run against the older source as a negative control. A material check was also corrected to accept the actual textured foliage after the old solid cone was removed.
7. Exported v11 as a standalone GLB and FBX. The GLB check reports **3,806 triangles, eight meshes and eight materials**; the editable scene contains 175 source objects. Both twig materials carry embedded textures, UVs, alpha blend and double-sided flags. The source-to-GLB geometry check compares per-material triangle totals and world-space bounds; it does not establish shading or normal parity.
8. Rendered the candidate with Blender Cycles and the requested Unity **6000.6.8f1** in an isolated built-in-pipeline project. Unity reported eight renderers. The live Unity MCP was connected to an older 6000.6.0f1 project; it was not changed or represented as the final Unity render. The small preview is a resized studio render, not a screenshot from the game.
9. `crapper`, `dryer`, and `mutator` were not on PATH. No game runtime files were changed; the full JavaScript suite, browser rendering, device performance, LOD and accessibility were not tested.

## Remaining work before use

The thin branches are less readable at collectible size, the crown can show dark gaps or an exposed trunk, and the geometric island base still reads as stacked layers. The photographic foliage also needs better stylistic integration with the simplified snow and water. Further art work is needed before calling this a finished AA/AAA asset.

The web game's existing `tools/export_lookdev_props.py` samples only RGB (`Texture.at`) and subdivides textured surfaces into flat-color triangles. It does not preserve the cards' alpha: code inspection therefore predicts filled rectangular foliage if this GLB is processed through that route. This is a conversion blocker, not a tested in-game screenshot. Design and test an alpha-aware runtime path or build a different game-ready foliage representation; then verify visual scale, transparency sorting/overdraw, performance, placement and LOD in the actual game before replacing the current collectible.
