# Jungle island collectible: look-development study

Status: **exploratory, not integrated or game-ready**. This is a separate replacement candidate for the existing jungle island, not a change to the collectible currently shipped by the game. It aims for the warm, tactile miniature-resort direction in `asset-art-direction.md` and for the same visual family as the volcano-island study.

## Direction and sources

- Scenario concept: [jungle island reference](https://app.scenario.com/assets?openAssetId=asset_pV7CnKX9t3rW622xVBSivCAW&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ). The concept has three palms at different heights, a sheltered turquoise lagoon, pale sand, coastal rocks, and broad understory leaves. Concept generation used 4 CU in the approved Default Project.
- Reef texture: [Seaside Rock](https://polyhaven.com/a/seaside_rock) by Dimitrios Savva, Poly Haven, CC0. The 1K diffuse, roughness, and OpenGL normal maps were imported through Blender MCP and are included beside the study. They are not Scenario outputs.
- An additional Scenario Meshy 7.1 image-to-3D attempt was refused with `429 PlanLimitReachedError` (free plan custom-generation limit). The preceding dry run estimated 120 CU; no 3D result was returned. Do not retry until the plan limit is resolved.

## Files and reproduction

- `assets/02_models/props/jungle-island-study/jungle-island-v6.blend`: editable, packed Blender scene, with studio setup.
- `jungle-island-v6.glb`: isolated collectible, with embedded reef base-color, metallic/roughness, and normal textures.
- `jungle-island-v6.fbx`: isolated collectible for the Unity comparison. Its companion source texture files are included for repeatable Unity import.
- `jungle-island-v6-blender.png`, `jungle-island-v6-blender-back.png`, and `jungle-island-v6-unity.png`: actual front, rear, and Unity renders. The numbered earlier images record review passes; earlier binary intermediates are local working material, not the final asset.
- `tools/create_jungle_island_study.py`: deterministic, disposable Blender generator. `tools/check_jungle_export_geometry.py` and `tools/check_jungle_glb_texture.py` validate the export. `tools/render_jungle_island_unity.cs` creates the disposable Unity comparison scene.

From the repository root, on a machine with Blender installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 6 --python-exit-code 1 --python projects/rubber-duck-pool/tools/create_jungle_island_study.py -- 6
/Applications/Blender.app/Contents/MacOS/Blender --background --threads 4 --python-exit-code 1 --python projects/rubber-duck-pool/tools/check_jungle_export_geometry.py -- projects/rubber-duck-pool/assets/02_models/props/jungle-island-study/jungle-island-v6.blend projects/rubber-duck-pool/assets/02_models/props/jungle-island-study/jungle-island-v6.glb
python3 projects/rubber-duck-pool/tools/check_jungle_glb_texture.py projects/rubber-duck-pool/assets/02_models/props/jungle-island-study/jungle-island-v6.glb
```

The generator refuses to run in an interactive Blender session and creates an empty disposable scene before building. Unity comparison requires a disposable project named `jungle-island-unity-6000.6.8f1`, the supplied editor script, v6 FBX and three texture files in its Assets directory, `JUNGLE_REVISION=6`, and `JUNGLE_OUTPUT_DIR` set to an existing output directory. Its editor and project guards prevent accidentally changing a different Unity project.

## Review and validation log

1. Inspected the art direction and current collectible generator to choose the next asset and avoid changing the existing game model. Generated one Scenario image as a proportion and mood reference.
2. Started a separate Blender 5.2.4 LTS RC process and connected Blender MCP, leaving the user's other scenes untouched. Modeled palms, sand, lagoon and reef as an isolated study.
3. Rendered six Blender versions. V1 exposed sparse fronds, overlapping crowns and invalid double-sided faces; V2 widened and separated the foliage and replaced the invalid faces. V3 added beach foam, modeled understory and embedded rocks. V4 tested continuous serrated fronds; their silhouette was too broad. V5 combined a narrow continuous center with separated leaflets and increased the understory. V6 used the CC0 coastal-rock PBR maps. Front and back of v5/v6 were rendered, and Blender MCP was used to inspect v6 from two further angles.
4. Unity 6000.6.8f1 built-in-pipeline comparisons ran for v2, v3 and v6 in a disposable project. V2 revealed that the overlapping words `coconut` and `bark` caused the trunk to receive the coconut color. An assertion reproduced the failure in Unity (expected failing CLI exit 6); ordering the checks correctly made the v3 and v6 runs pass. The v6 Unity setup applies diffuse, normal, and an in-memory metallic/smoothness map derived from the roughness texture.
5. The first source version deliberately failed the mesh validation check on `Palm 1 | frond 1 | leaflets` (exit 1), verifying the invalid duplicated faces were detected. V5 and V6 passed geometry validation and source-to-GLB comparison (exit 0). V5 also failed the embedded-PBR test as expected; v6 passed `JUNGLE_TEXTURES_OK maps=3 reef_primitives=1` (exit 0).
6. V6 export reports **26,296 triangles, 13 material/renderer groups, and 229 editable source objects**. The Blender geometry comparison verifies matching per-material triangle counts and world-space bounds, not matching shading or animation. Unity v6 reported 13 renderers and one textured rock material. The live Unity MCP was connected to an older 6000.6.0f1 project; rather than mutate it, the requested 6000.6.8f1 was run through Unity CLI in a separate temporary project.
7. `crapper`, `dryer`, and `mutator` were not available on PATH. This change does not modify the web game runtime; the full game test suite, browser rendering, accessibility, and device/FPS checks were not run.

## Remaining work before game use

The canopy still reads more geometric and evenly repeated than the concept, the lagoon still resembles stacked layers at some angles, and the reef uses detailed texture beside simpler plants. The visual result is not yet the requested AAA finish. Reduce and rebuild the foliage and reef substantially: v6's 26,296 triangles exceed the existing 2,672-triangle jungle collectible by almost ten times. Establish an asset budget and LODs, test silhouette at actual collectible size, and verify collisions/placement as appropriate. The game's WebGPU converter reduces textured materials to per-triangle colors, so the Blender and Unity texture results do not demonstrate web parity. Confirm conversion, visual readability, runtime performance and integration separately before replacing the shipped collectible.
