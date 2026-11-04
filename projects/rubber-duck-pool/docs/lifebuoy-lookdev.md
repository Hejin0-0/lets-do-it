# Lifebuoy look development

Status: **in progress; not approved as a AAA or game-ready asset**. This is
an isolated studio study; it has not replaced the existing pool prop.

## Direction and deliverables

The buoy is a warm ivory and muted coral ring with a three-strand grab line,
four fabric keepers, reinforcement patches, stitching and small brass rivets.
It is intended to sit naturally beside the chair and cooler without copying
their precise colors. The main body is about 1.07 m across; the whole asset
including rope measures about 1.16 m across in the Unity import.

- Editable current studio source: `art-source/lifebuoy/lifebuoy-v4.blend`.
- Interchange files: `art-source/lifebuoy/lifebuoy-v4.glb` and `.fbx`.
- Reduced comparison source and exports: `lifebuoy-v4-game.blend`, `.glb`
  and `.fbx`. The name identifies the intended direction, **not approval for
  runtime use**.
- Current images: [Blender v4](evidence/lifebuoy-v4-blender.png),
  [Unity v4, softer patch](evidence/lifebuoy-v4-softpatch-unity.png), and
  [Unity reduced mesh](evidence/lifebuoy-v4-game-unity.png).
- Earlier sources and renders preserve the review stages. The v1 and v2
  `.blend` files are library-style saves: select their `LIFEBUOY | v1` or
  `LIFEBUOY | v2` scene explicitly when opening them. v3 and v4 open as
  ordinary Blender files.

The Blender material uses procedural surface bump; that bump is not baked
into the interchange files. Unity's studio script substitutes Standard
materials and does not represent the web game's material or lighting setup.
The studio lighting changed between revisions, so the images are lookdev
comparisons, not calibrated measurements of engine color matching.

## Action and reason log

1. Checked the installed Scenario skills and official setup instructions.
   The skills were already present; registered the missing Scenario MCP
   endpoint and completed OAuth. The new server's tools were not exposed to
   this existing chat, so **no Scenario service generation was performed**.
2. Confirmed the existing `uvx mcp-for-blender` server and matching Blender
   addon, then installed the upstream Codex marketplace plugin from the
   already pinned project submodule. See [connection notes](mcp-for-blender.md)
   for the unverified refreshed-session plugin connection and duplicate-client
   precaution.
3. Inspected the open Blender scene through its MCP bridge. Blender closed
   before the first modeling call, so the actual modeling and renders used
   the same Blender 5.2.4 LTS Release Candidate in isolated background sessions.
   The former open scene was not overwritten.
4. Made v1 as a closed, softly rounded ring with coral panels, rope and
   keepers. Two independent reviewers found pale contrast and implausible
   rope attachment. v2 strengthened the coral, rounded the keepers and let
   the rope sag slightly between attachments.
5. v3 added curved reinforcement patches and stitches. v4 narrowed the
   keepers and rounded patch corners. Unity preview materials and lighting
   were adjusted between rounds, with a final lighter-patch comparison in
   response to both reviewers. The visual gains became small or reversed.
6. Imported each stage into a separate Unity 6000.6.8f1 studio project. The
   Unity MCP status connected but editing tools did not appear in this chat;
   the Unity CLI Pipeline ran `tools/render_lifebuoy_unity.cs` instead.
   An initial export included Blender's unrelated default cube; the current
   exporter limits GLB to the active scene and the final files pass the
   asset-only check.
7. Investigated Unity's broad surface shading with a shadow-free render and
   an imported-normal audit. Shadow removal did not remove the broad tonal
   difference; the body normals' angle from the model's analytic surface was
   p50 0.020 degrees and p95 0.048 degrees across 9,216 imported vertices.
   This narrows the diagnosis but does not by itself prove the final visual
   cause or that shading is satisfactory.
8. Made a reduced-resolution comparison and corrected its panel seam positions
   after a doubled border was visible. It exports 39,712 triangles versus
   88,928 for the detailed version, but still has 32 renderers in the Unity
   studio and has not passed a web performance budget.

## Independent visual reviews

Scores are **Sol / Luna**, out of 100; the requested pass is at least 85 from
both reviewers. Unity v1 did not receive a separate independent score.

| Stage | Blender | Unity | Finding |
| --- | --- | --- | --- |
| v1 | 82 / 72 | — | Weak coral contrast and unclear rope attachment. |
| v2 | 84 / 79 | 79 / 68 | Better silhouette and color; Unity looks harder and glossier. |
| v3 | 85 / 81 | 82 / 71 | Reinforcement reads better; Unity mismatch remains. |
| v4 | 86 / 81 | 83 / 69 | Small Blender gain; Unity patch became too dark. |
| v4, softer Unity patch | same v4 | 84 / 70 | Slight recovery, but both reviewers see a plateau. |

The reduced mesh and its corrected seam were visually checked in Unity but
were not scored by the reviewers. The original v4 and reduced comparison
are retained for further iteration, not marked approved.

## Verification and remaining work

- Both final Blender files passed `check_lifebuoy_lookdev.py` (exit 0):
  the main body has zero nonmanifold edges and zero degenerate faces; each
  GLB has one scene with 32 asset nodes and no studio/default objects. This
  check does not prove that every separate accessory is manifold or that
  contacts between parts are physically correct.
- Unity 6000.6.8f1 imported each final FBX with 32 renderers; the editor
  reported successful renders. Neither a web-game import nor runtime FPS,
  player-camera framing, mobile/device behavior, or in-game placement was
  checked. No game JavaScript was changed or full JavaScript test suite run.
- Priorities remain: a more convincing rope-to-keeper junction, less flat
  Unity patch shading, closer cross-engine material behavior, baked textures,
  fewer meshes/draw calls and a measured web budget. Human art approval and
  the requested two-reviewer 85-point threshold remain outstanding.
- `crapper`, `dryer` and `mutator` were not installed on the workstation;
  no results are claimed for them.
