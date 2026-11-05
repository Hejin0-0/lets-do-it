# Bottled steamboat and pirate ship — look development

These are standalone collectible studies for Rubber Duck Pool. They share the
v9 sailboat's authored glass, cork, and wooden saddles, but have their own
boats, colors, and iterations. They have **not** been installed in the game.

## Current results

| Study | Blender source | Game-format experiment | Blender render | Unity comparison |
| --- | --- | --- | --- | --- |
| Steamboat v5 | [`.blend`](../assets/02_models/props/steamboat-bottle-study/steamboat-bottle-v5.blend) | [`.glb`](../assets/02_models/props/steamboat-bottle-study/steamboat-bottle-v5.glb) | [hero](../assets/02_models/props/steamboat-bottle-study/steamboat-bottle-v5-blender.png), [cutaway](../assets/02_models/props/steamboat-bottle-study/steamboat-bottle-v5-cutaway.png) | [render](../assets/02_models/props/steamboat-bottle-study/steamboat-bottle-v5-unity.png) |
| Pirate v5 | [`.blend`](../assets/02_models/props/pirate-bottle-study/pirate-bottle-v5.blend) | [`.glb`](../assets/02_models/props/pirate-bottle-study/pirate-bottle-v5.glb) | [hero](../assets/02_models/props/pirate-bottle-study/pirate-bottle-v5-blender.png), [cutaway](../assets/02_models/props/pirate-bottle-study/pirate-bottle-v5-cutaway.png) | [render](../assets/02_models/props/pirate-bottle-study/pirate-bottle-v5-unity.png) |

FBX files and the earlier versions are kept in the same directories. V1–v3
each have Blender and Unity renders; v4 is a Blender water-shape experiment;
v5 has both. Later fixes to the generators apply to earlier revision numbers,
so regenerating a previous revision is not guaranteed to reproduce its saved
historical image bit for bit.

The reference explorations are available in Scenario: [steamboat](https://app.scenario.com/assets?openAssetId=asset_fN6hHqfQq6kCcan9JrWHuRPn&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ) and [pirate](https://app.scenario.com/assets?openAssetId=asset_eqjns3nrHKdf6gc7NbV1iGjf&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ). Each used 4 CU, for 8 CU total.

## Iteration log

1. Checked the existing collectible order, art direction, sailboat study and
   connected tools to select two related studies without overwriting game assets.
2. Generated Scenario references using the existing bottle family as visual
   context. Built the steamboat around a teal hull, ivory cabin, red funnel and
   paddle wheel; built the pirate ship around dark timber and charcoal sails.
3. V1 established both shapes and compared Blender and Unity. The pirate was
   too close to a recolored sailboat, while the steamboat wheel was too thin.
4. V2 added wider paddle blades, windows and fittings; the pirate gained square
   sails and yards so its silhouette could be distinguished from the sailboat.
5. V3 added steamboat vanes, bridge windows and a painted smoke ribbon on both
   sides; the pirate gained wider sails, seams and hull detail. Cutaway renders
   were added to inspect the ship without the glass.
6. Unity exposed reversed hull-band faces; corrected their winding and reran
   the v3 comparison so the colored bands are visible from both views.
7. V4 tested a wider rippled water shape. It still read like a raised plate,
   so v5 instead fills the bottom of the bottle and follows its glass profile.
   Both v5 assets were rendered in Blender and Unity.
8. Used the live Blender MCP for non-destructive mesh inspection; generation
   and rendering used disposable Blender background scenes. The connected
   Unity MCP pointed to an older 6000.6.0f1 project, so Unity CLI rendered a
   disposable project explicitly with **6000.6.8f1** instead.
9. Fixed an initially missing Blender world in the isolated studio and used
   `--python-exit-code 1` so later Python failures fail the process. An initial
   Unity CLI attempt used the unsupported `--project-path`; the corrected
   command passes the project path as a positional argument.
10. Prepared publication against the current remote main in a separate
    temporary Git repository and index, because the working checkout contains
    unrelated concurrent edits. The v9 sailboat `.blend` is included as the
    generators' source dependency; its local copy matched the tracked file.

## Verification and limits

- Blender 5.2.4 LTS release candidate completed both v5 hero and cutaway
  renders. Blender MCP base-mesh checks found zero non-manifold edges,
  inconsistent manifold-edge winding, and zero-area faces for each bottle's
  glass, hull, and water. The 1,625 top/bottom water samples had no vertical
  inversions. These are not audits of every evaluated mesh or collision.
- The GLB headers and JSON were inspected: no `STUDIO |` nodes; steamboat
  v5 has 170 nodes and 24,769 triangles; pirate v5 has 109 nodes and 24,607
  triangles. Both declare `KHR_materials_transmission`. These are lookdev
  exports and have not been optimized, baked, or profiled for the web game.
- Unity 6000.6.8f1 completed both v5 comparisons, with 170 and 109 renderers
  respectively and bounds of approximately `(1.88, 0.65, 0.56)` in the
  temporary scene. It uses a manually substituted alpha-blended Standard
  material for glass; it does **not** verify Blender transmission/refraction
  parity or the web renderer.
- The boats remain simplified compared with the generated concepts. Sail and
  paddle detail, water/glass shading, small-screen readability, real game
  scale and placement, batching/LOD, and runtime performance still need work.
  No game integration, browser review, game test suite, or human art approval
  was performed for these studies.
- The requested `crapper`, `dryer`, and `mutator` commands were not available
  on the PATH, so those checks could not be run.

The generators are `tools/create_steamboat_bottle_study.py` and
`tools/create_pirate_bottle_study.py`; they use the shared
`tools/bottle_collection_water.py` for later water iterations. They require the
v9 sailboat `.blend`, clear/open a disposable scene, and must be run in
background Blender rather than an interactive scene. The temporary Unity
comparison script is `tools/render_bottle_collection_unity.cs`.
