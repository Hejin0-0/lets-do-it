# Sailboat in a bottle: early look development

Status: **early study, not approved as AAA or game-ready**. This does not replace
the existing collectible in the web game. The selected subject corresponds to
the already-defined Sailboat in a bottle collectible.

## Direction and files

The concept combines a clear sea-glass bottle, a cork, a small coral and wood
boat, warm ivory sails, rigging, and a pair of timber cradles. Scenario's
[generated concept](https://app.scenario.com/assets?openAssetId=asset_AkaVzYBWCGRrMhqoCxW8GmRe&teamId=team_C3xxdt9uS5v1nyanYAsfZfbK&projectId=proj_k3yfuatTtAMHnLGe5W1H8qMJ)
is visual guidance, not a model or a finished game asset.

- Editable source: `../assets/02_models/props/sailboat-bottle-study/sailboat-bottle-v9.blend`
- Model interchange: `sailboat-bottle-v9.glb` and `sailboat-bottle-v9.fbx`
  in the same folder.
- Comparison images: `sailboat-bottle-v9-blender0001.png` and
  `sailboat-bottle-v9-unity.png` in that folder. Previous revisions, including
  v8, remain for comparison.
- Blender generator: `../tools/create_sailboat_bottle_study.py`. Run only in
  a disposable scene: it removes scene objects before building the study.
- Unity studio: `../tools/render_sailboat_bottle_unity.cs`, run in the
  dedicated temporary Unity project specified in the script.

## Action and reason log

1. Checked the project's art direction and existing collectible list to choose
   a missing asset with a real intended use.
2. Read the installed Scenario and Blender/Unity lookdev skills. The user
   selected the Scenario Default Project. Generated one concept with GPT Image
   2.5 Flare; Scenario reported 12 CU. The concept was reviewed as a reference.
3. Started a separate Blender 5.2.4 LTS Release Candidate with the installed
   MCP addon. The existing scene was not replaced. Blender MCP created and
   exported the model. v1 established silhouette and materials; v2 added a
   cabin, windows and rails and changed the lighting; v3 increased sail
   readability and added internal supports.
4. A Blender mesh audit found 256 boundary edges on the v3 glass. v4 replaced
   the loose end rings with pole caps. Blender MCP reported 2,946 vertices,
   3,072 faces, zero non-manifold edges and zero zero-area faces for the
   glass body. This audit covers the glass body only.
5. Rendered Blender v1 through v4 in Cycles, and imported and rendered v1,
   v3 and v4 FBX in a disposable Unity 6000.6.8f1 studio via Unity CLI.
   Blender v4 and Unity v4 exited 0. Unity MCP was checked separately: it
   pointed to an existing 6000.6.0f1 project, so it was not used to edit or
   render the new asset. Unity uses a manually substituted Standard material
   setup with alpha transparency, not Blender's refractive glass shader.
6. Parsed the v4 GLB: 35 nodes, 35 meshes, 7,338 triangles, no studio nodes,
   and `KHR_materials_transmission`. Unity reported 35 renderers and bounds
   about 1.88 × 0.63 × 0.56 m. These are measurements, not a web budget pass.
7. User requested at least three more refinement loops. **v5** rebuilt the
   hull with a rounded outline and swept bow, curved the canvas surfaces, and
   reduced the washed-out Unity studio lighting. Blender and Unity renders
   exposed an unattached decorative line.
8. **v6** replaced that line with a stripe that follows the hull, added a
   second mast, a third sail and shrouds, and added subtle procedural material
   bump in Blender. Both engine renders showed that the blocky supports and
   one-sided cabin windows still needed work.
9. **v7** replaced the outer blocks with shaped wooden saddles, added windows
   on both sides, deck seams and mast caps, and reduced the width of the
   Blender softbox reflection. Blender and Unity each rendered all three
   revisions successfully with exit code 0. The same Unity substitute
   materials are used for v5–v7.
10. The v7 GLB has 51 nodes, 51 meshes, 9,073 triangles, no studio nodes and
    uses `KHR_materials_transmission`. Unity 6000.6.8f1 reported 51
    renderers and bounds 1.88 × 0.65 × 0.56 m. Blender's base-mesh audit
    found no non-manifold edges or zero-area faces on the glass, hull and two
    saddles. This does not cover the remaining objects or evaluated modifiers.
11. **v8** removed the detached internal blocks and seated the boat on a
    shallow turquoise resin surface. Blender and Unity renders exposed the
    surface's rectangular silhouette. Both renders completed with exit code 0.
12. **v9** tapered and sculpted that surface into miniature waves, added foam
    accents and warmed the studio. A base-mesh audit found 34 edges with
    inconsistent face winding on the hull; corrected the hull faces and
    rerendered v9 in Blender and Unity 6000.6.8f1, both with exit code 0.
    Blender MCP found no non-manifold edges, inconsistent edges or zero-area
    faces on the glass, hull and ocean base meshes; other objects and evaluated
    modifiers were not covered. The v9 GLB has 53 nodes, 53 meshes and 10,799
    triangles, no studio nodes, and uses `KHR_materials_transmission`. Unity's
    studio reported 53 renderers and bounds 1.88 × 0.65 × 0.56 m.

## Review and remaining work

The sculpted sea makes the boat's placement more coherent, but can still read
as a solid display base. The two-mast sailboat remains visibly simpler than
the Scenario concept: the hull and cabin need more convincing miniature
construction and material texture, and bright glass reflections compete with
the pale sails. The Unity glass differs visibly from the Cycles render and the
foam accents are hard to see. Unity's studio materials are only substitutes,
and Blender's procedural bump was not baked for export; matching real-time
glass and transparency sorting remain unresolved. The timber cradle is a
presentation choice; suitability for a floating collectible needs a separate
in-game decision. The 53 renderers have not been optimized for the web.

No browser/game integration, scale calibration in the playable scene, mobile
performance, texture baking, LOD, comprehensive mesh audit, or independent
art review was performed. No JavaScript game behavior was changed; its full
test suite was not run. `crapper`, `dryer`, and `mutator` were not run for
this modeling study.
