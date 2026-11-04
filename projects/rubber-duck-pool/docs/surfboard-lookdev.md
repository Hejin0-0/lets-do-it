# Surfboard look development

Status: **work in progress, not an approved AAA asset**. The independent
reviewers' 85/100 target has not been met. This is an isolated studio study;
it has not replaced the existing pool props or been checked in the web game.

## Direction and files

The design is a single warm ivory and muted sea-glass longboard with a coral
accent, wood stringer, rear fin and wooden cradle. The starting concept is
[`evidence/surfboard-concept-v1.png`](evidence/surfboard-concept-v1.png),
created with the built-in image generator using the chair study as a style
reference. It is a design reference, not a generated 3D model.

- Editable current source: `art-source/surfboard/surfboard-v7.blend`.
- Interchange exports: `art-source/surfboard/surfboard-v7.glb` and
  `art-source/surfboard/surfboard-v7.fbx`.
- Unity preview's deck image: `art-source/surfboard/surfboard-deck-v5.png`.
  The GLB embeds the image; the FBX preview loads the PNG separately.
- Current renders: [`v7 Blender`](evidence/surfboard-v7-blender.png),
  [`v7 Unity`](evidence/surfboard-v7-unity.png), and
  [`v7 Unity side`](evidence/surfboard-v7-side-unity.png). The side view shows
  the rear fin and rail; the separate
  [`v4 Blender back`](evidence/surfboard-v4-back-blender.png) shows the fin.

Versioned Blender source files and scripts preserve the main stages. The
`create_surfboard_lookdev.py` / `refine_surfboard_v*.py` scripts record the
live-scene construction sequence; they expect the previous stage's scene and
are not intended to be repeatedly applied to the same scene. Open the saved
v7 source for further editing. The Blender procedural wood is not baked into
the GLB; the Unity studio script synthesizes its own simple wood texture.
Neither is yet a finished cross-engine material pipeline.

## Action and reason log

1. Pinned the upstream Blender MCP as a project submodule and added a local
   launcher, so the source and dependency lock can be reproduced. See
   [`mcp-for-blender.md`](mcp-for-blender.md).
2. Confirmed Blender 5.2.4 LTS Release Candidate and matching addon/server
   protocol 15; saved the prior addon and preserved telemetry-off consent.
   Used the Blender MCP to build and refine a separate scene without replacing
   the user's existing scene.
3. Used the installed Scenario Blender production instructions and the pool
   art direction. A Scenario generation service was not available in this
   session, so the concept came from the built-in image generator instead.
4. Built v1 with a closed board mesh, paint, stringer, fin and stand. v2
   rounded the ends and added a saddle; v3 adjusted the rail and studio light.
   This made the silhouette and contact easier to judge.
5. Built v4 with a continuous rounded rail, a leaned pose and a separate rear
   view. The two reviewers agreed that this removed v3's double-outline look.
6. Imported each stage into an isolated Unity 6000.6.8f1 project. Unity MCP
   exposed connection status but no scene-editing calls in this session, so
   the Unity CLI Pipeline executed `tools/render_surfboard_unity.cs` instead.
   This preview uses built-in Standard materials and a separate studio; it is
   not the game's lighting or proof of web runtime performance.
7. Isolated v4's visible Unity striping with a
   [`neutral-material render`](evidence/surfboard-v4-unity-neutral.png): the
   stripes disappeared when the deck image was removed. Replaced the periodic
   grain in v5 with low-amplitude aperiodic variation, reducing the stripes.
8. Added restrained joinery, adjusted Unity's wood and color balance, reshaped
   the cradle in v6, and smoothed its faceted edge in v7. The side render
   checks the actual fin rather than assuming it from the front view.
9. Reviewed successive images with independent Sol and Luna reviewers. Both
   found v6-v7 improvements small and the board's core appearance plateauing,
   so v7 is saved as a handoff point rather than described as finished.

## Independent review scores

Each pair is **Sol / Luna**, out of 100; pass requires 85 from both.
Unity did not receive separate independent scores for v1-v3. The Unity
studio lighting was adjusted during the process, so these are look-development
comparisons, not controlled color-matching measurements.

| Version | Blender | Unity | Main observation |
| --- | --- | --- | --- |
| v1 | 61 / 66 | — | Flat body, unclear support, tail and rails. |
| v2 | 73 / 70 | — | Rounder tail and clearer saddle; body still flat. |
| v3 | 77 / 73 | — | More readable edge, but a doubled rail line. |
| v4 | 80 / 77 | 69 / 60 | Integrated rail improved; Unity texture banding. |
| v5 | 81 / 78 | 77 / 74 | Unity banding removed; surfaces still too uniform. |
| v6 | 82 / 79 | 78 / 75 | Better support and color; new support faceting. |
| v7 | 83 / 80 | 80 / 77 | Support smoothed and fin visible from the side; still below target. |

## Checks and remaining work

- Blender Cycles and Unity 6000.6.8f1 rendered v1-v7; the final Unity import
  reported 12 mesh renderers. Separate studio cameras and material setups
  mean the images should not be treated as identical render pipelines.
- `check_surfboard_lookdev.py` on v7: exit 0; the board has 30,528 triangles,
  zero nonmanifold edges and zero degenerate faces. The GLB contains the
  essential board, fin and saddle, excludes studio objects, and embeds its
  deck image. Python syntax checks also passed.
- The board is still too dense to assume acceptable web performance. Make and
  visually compare a lower-detail game mesh, bake the wood/roughness/normal
  information, and inspect its materials after actual runtime import.
- The review still calls for better board thickness and silhouette, convincing
  resin and wood response, Blender/Unity color agreement, a useful hero angle,
  and Unity ground-contact shadows. No in-game placement, interaction,
  browser rendering, FPS test, or human art approval has been performed.
- `crapper`, `dryer`, and `mutator` executables were not available; no results
  are claimed for them. The full JavaScript test suite was not run because
  this change does not alter the game's JavaScript runtime.
