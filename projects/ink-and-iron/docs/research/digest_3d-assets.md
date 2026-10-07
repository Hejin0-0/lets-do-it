# Procedural asset recipe book: war-library

**S** = `/Users/rels/Documents/project-Library/projects/15-3d-assets/Three.js-Object-Sculptor-Codex-Plugin/skills/object-to-threejs-procedural`, **I** = `/Users/rels/Documents/project-Library/projects/15-3d-assets/img2threejs`

## Tools on this machine (arm64 Mac, no CUDA, no keys)
- **TRELLIS**: not usable. It needs an NVIDIA GPU with at least 16 GB and CUDA, and is tested on Linux only (README L41-43).
- **meshflow**: not usable. It needs CUDA torch, a checkpoint and an input mesh (requirements.txt L1).
- **modly**: runs on Apple Silicon, but it needs multi-GB model downloads and outputs static, unrigged meshes. That breaks the code-only rule, so skip it.
- **vgpu**: plain WebGPU with no Three.js. Not needed.
- **webgpu-claude-skill**: docs only. Its TSL `hash`/`triplanarTexture` notes (docs/materials.md L276-350) matter only if we switch to WebGPURenderer. Stay on WebGL.
- **Sculptor scripts + img2threejs forge**: usable, because they need only the Python standard library (`I/forge/requirements.txt`). Use `I/forge/stage4_review/make_comparison_sheet.py` and `diagnose_render_multi_angle.py`.

## (a) The loop (from S/SKILL.md, S/references/self-correction-loop.md, I/grimoire/review/self_correction.md)
1. **Spec card in code.** Each asset gets a `SPEC` const containing:
   - up to 5 features that make the asset recognisable (these are the review targets);
   - dimensions in metres;
   - a descriptive ID for each part (`tank-hull-rhomboid`, not `box3`), with its parent and attachment `contact|overlap|gap` plus tolerance (S/references/attachment-joint-correctness.md);
   - material terms in PBR language;
   - motion (pivot, axis, limits), or `not-required` with a reason.

   There is no source image, so **this feature checklist decides whether the asset passes**.
2. **Blockout.** Grey material, with every part that shapes the silhouette already present (I/grimoire/build/geometry_patterns.md).
3. **Repeatable capture** (I/grimoire/feedback/render_capture.md):
   - Use `?asset=X&view=game|34|side|top`, with camera controls off and seeded noise.
   - Set `window.__ready` only after textures load. An early capture shows a false white "chrome" look.
   - Capture 1280×720 PNGs in headless Chrome, save them, then open them again to check.
4. **One 2×2 contact sheet** against the previous best version (the "champion"), plus two checks:
   - a **squint test** at 25% downscale;
   - a **grayscale test** of the light/dark balance. This test is the fix for the murky midground.
5. **Blind scout.** A fresh sub-agent sees only the images and the rubric. It returns approve/reject plus up to 7 notes on what to change, and the builder maps the notes to part IDs. A pass needs an overall score of at least 0.70 and every critical feature passing (S/references/browser-screenshot-feedback.md).
6. **One correction batch per round, applied to a copy.** Name the target IDs, what must not change, and the expected effect. Keep the copy only if it is visibly better; otherwise go back to the champion.
   - After 3 rounds with no improvement, change how the part is built.
   - Stop and report after 3 corrections per phase or 6 per asset.
   - Do no more than 2 non-visual steps between renders.
8. **Test the cause before trusting it.** Reviewers name the symptom correctly but often guess the wrong cause (geometry_patterns.md). Tests:
   - Render with a flat `MeshBasicMaterial`: is the problem geometry or texture?
   - Push the suspected parameter the wrong way and see if the symptom gets worse.
   - **Distinct-Z count**: 10 or fewer depth planes means the part is a flat slab, not a solid.
   - Cast a ray along the axis to see what blocks it.
9. **Phases:** blockout → form → lookdev (captures under neutral, grazing and game light) → interaction (2×2 of rest/mid/extreme poses). A later phase may fix an earlier one.
10. **The view that decides acceptance** is the asset on the board, under game light, from the game camera.
11. **Report** the values that changed and what still does not match.

## (b) Recipes
Scale: hex **0.10 m** across the flats. Style (S/references/visual-style-classification.md): painted miniature, toy-like. A miniature is about 30 px tall on screen, so **exaggerate the recognisable features 1.3-1.5×**.

Build static multi-part pieces with `mergeGeometries` and vertex-colour paint zones (I/SKILL.md: flat colour regions go in geometry, not texture). Put repeated parts in an `InstancedMesh`.

**Tin soldiers (British and German).** 3 figures, each 0.032 m tall, on a Ø0.06 lathe base with a bevelled rim.
- **Body:** capsule limbs, a tapered-cylinder torso, and a sphere head at 1:6 of height.
- **Helmet (the key identifier):**
  - Brodie: a flat lathe dish with a brim 1.7× the head radius.
  - Stahlhelm: a lathe profile with a flared neck skirt, plus lugs.
- **Rifle:** 0.65× figure height and 2× real thickness.
- **Legs:** puttees for the British, black jackboots for the Germans.
- **Poses:** 4.
- **Paint:** gloss enamel (roughness 0.3, metalness 0). Bare lead (metalness 1, roughness 0.45) shows only on an edge-wear mask.
- **Telling the sides apart:** base-rim colour plus hue, warm khaki #8a7a4e against cool field-grey #5e6b70. Confirm it in the squint test.

**Mark IV tank.** 0.085 × 0.043 × 0.026 m.
- Extrude the **rhomboid side profile**.
- **Track:** a separate extruded ring (a Shape with an offset hole) plus instanced plates along the path.
- **Sponsons:** box plus half-cylinder. The male tank carries 6-pdr barrels; the female carries machine guns.
- Cab, exhaust, and an unditching beam on rails.
- Rivets are instanced, with ±10% spacing jitter.
- **Paint:** non-metallic service-brown (roughness 0.55), a vertical mud mask over the lower 35%, and edge wear down to dark steel (S/references/patterns/hard-surface-machinery.md).

**18-pounder field gun.** 0.06 m long.
- Wheels Ø0.024: a lathe rim with 12 instanced spokes.
- A box trail ending in a spade.
- A bent extruded shield with a sight notch.
- The barrel, with the **recuperator cylinder above it**.
- **Motion:** a trunnion hinge (0-16°) and a recoil slider (S/references/patterns/procedural-motion.md).

**Biplanes.** Sopwith Camel and Fokker Dr.I, about 0.105 m span.
- **Fuselage:** a loft through elliptical sections.
- **Wings:** an extruded airfoil. The Camel gets dihedral; the Dr.I has three wings.
- Struts are tubes from `localStart` to `localEnd`. Rigging wires are 0.0003 m.
- **Doped linen:** roughness 0.8, with rib tape in the roughness and bump channels (S/references/patterns/fabric-cloth.md).
- Roundels and crosses are canvas decals (S/references/patterns/markings-decals-text.md).
- Mount each plane on a **clear acrylic flight stand**, so nothing floats unattached.

**Terrain tiles** (hex, 0.008 m thick).
- **Trench:** a real recess (two extruded halves plus a sunken floor), never a dark painted strip (S/references/procedural-patterns.md). Revetment planks and duckboards are instanced.
- **Sandbags:** instanced rounded pillows at 1:0.45:0.6 in running bond, jittered ±5° and ±8%, with a burlap tint per instance.
- **Barbed wire:** X-shaped pickets plus a concertina `TubeGeometry` helix (radius 0.006, tube 0.0006) with instanced barbs.

**Shell crater.**
- Displace the board grid with a lathe profile: lip +0.003, bowl -0.006.
- Put a dark water disc in the bowl (roughness 0.08).
- Embed the thrown-up clods in the ground; don't set them on top.

**Ruined village house** (0.08 m tall).
- Walls are extrudes with a noise-jagged top edge and window **holes**.
- Flemish stepped gable.
- Rafters run **from ridge to wall-plate, perpendicular to the gable**. The old build had 12 roofs wrong on exactly this.
- Partial instanced tile rows remain on the roof.
- Rubble uses the walls' own brick palette.

**Church ruin.**
- **Nave:** extrudes with **pointed-arch** holes (two `absarc`s).
- A square tower with a broken top.
- A lathe apse and instanced buttresses.
- A fallen spire.

**Game board (war-table).**
- **Table:** oak, 2.4 × 1.6 × 0.9 m, with lathe legs, a carved apron and a brass-plated rim.
- **Map surface:** a high-res plane displaced by a height field. Use fBm noise plus anchors for the river, ridge and flooded ground, fading at the edges (S/references/patterns/procedural-landform-generation.md).
- **Paint canvas (2048):**
  - painted zones;
  - contour lines from `fract(h·k)`;
  - ink hex lines;
  - serif labels.
- **Other channels:** a separate roughness canvas (varnished water against matte paint), and bump taken from the height field.
- **Light/dark plan:**
  - ochre no-man's-land;
  - a warm wash on the British side and a cool wash on the German side;
  - saturated water;
  - cream roads;
  - neighbouring zones at least 12 L* apart.
- **Light:** a shadowed lamp pool makes the table the brightest thing in the room.

**Gothic bookcases** (4.2 m wall cases plus 3 m freestanding stacks).
- **Carcass:** extruded pointed-arch crowns, box shelves and lathe finials, in dark oak.
- **Books:** one `InstancedMesh` of 6,000-10,000 books, drawn in one draw call.
  - Size per book: height 0.18-0.32, depth 0.14-0.24, thickness 0.02-0.07.
  - Colour: `instanceColor` from a leather palette (oxblood, bottle-green, navy, tan, black), ±8% in brightness.
  - Rhythm: a gap every 15-30 books with the neighbour leaning 5-15°, plus occasional flat stacks.
  - Spines: a 16-row texture atlas, with the row picked per book by an `aSpine` attribute (a short `onBeforeCompile` patch). Gilt is metalness 1.
- Darken the shelf backs with a gradient as cheap ambient occlusion.

**Rolling ladder.**
- Leans 15°, with instanced rungs.
- The top hook touches the brass rail with no gap.
- Slides along the bookcase run, within limits.

**Reading lamps.**
- **Banker's lamp:** a lathe brass base and a green half-shell shade. The shade's inner face glows (emissive) and it picks up environment reflections. Skip glass transmission (S/references/patterns/transmissive-surfaces.md).
- Use 1-3 real lights. The other lamps are emissive only, with a radial pool of light painted on the surface below.

**Floating candles** (instanced, 80-200).
- Tapered lathe wax with an irregular lip and capsule drips.
- An additive teardrop flame plus a glow sprite.
- Noise-driven flicker, and a bob of `sin(t·0.5+φ)·0.03`.
- 2-4 stand-in PointLights for the whole group.

**Leaded windows.**
- An extruded frame with a pointed-arch hole, plus tracery.
- One canvas (diamond lead lines, muted jewel-coloured panes), used as both the colour map and the emissive map.
- Light shafts tinted to match each window.

**Floor and ceiling.**
- **Floor:** a canvas of flagstones on a jittered grid, with a tint per flag and rough grout, plus a separate bump map. The **main aisle is smoother where people walk** (roughness 0.35 against 0.8).
- **Ceiling:** a timber hammerbeam roof (box beams, extruded arched braces, instanced rafters). It is cheaper and warmer than a stone rib vault.
- **Rug:** roughness 0.95, with sheen.

**Globe.**
- A sepia canvas with fBm land. This is an approximation; there is no real coastline data.
- A brass torus meridian, tilted 23.4°. It spins on click.

**Chandelier.**
- An iron torus ring hung on instanced chain links.
- 8-12 curved tube arms holding candles.
- One unshadowed light.
- Swings like a pendulum from its ceiling hook.

**Dust motes and light shafts.** Keep both confined to the shafts and never opaque (S/references/patterns/effects-emissive-volume.md).
- **Shafts:** extruded window-shaped prisms along the sun direction. Additive blending, `depthWrite:false`, and alpha fading along the length and toward the edges.
- **Motes:** 1,000-3,000 `Points` with a soft sprite, **spawned only inside the shafts** and drifting slowly.

## (c) Material realism without texture files (S/references/material-lighting-realism.md, I/grimoire/feedback/shading_realism.md, I/grimoire/build/threejs_texture_reference.md)
1. **No flat colours.** Palette plus 2 noise octaves (±4-8% brightness, ±2° hue), applied through `instanceColor`, vertex colours or CanvasTexture.
2. **Separate channels.** Colour, roughness and bump each get their own seed and frequency. Never reuse the colour map as roughness, bump or AO.
3. **Vary roughness.** Base ±0.1-0.2. Handled areas are smoother and cavities rougher. Highlights must vary independently of colour.
4. **Edge wear in the shader.** Use distance to the local box edge, or a vertex attribute set at build time, to lighten paint and expose metal. On miniatures it hits only the high points.
5. **Ambient occlusion without maps:**
   - bake vertex AO with a few hemisphere raycasts;
   - darken surfaces near contact points;
   - put a radial contact-shadow decal under every piece;
   - use gradients on shelf backs.

   `aoMap` needs a second UV set (`texture.channel`). SSAO and bloom are optional and must never hide defects.
6. **Metals.** Painted metal and rust are non-metallic in PBR terms. Brass and gilt are metalness 1 and need a PMREM RoomEnvironment, or they look like grey plastic.
7. **Colour spaces and tiling.** Colour maps use `SRGBColorSpace`; data maps use `NoColorSpace`. Use `RepeatWrapping` with max anisotropy, and a large non-repeating tint to hide tiling.
8. **Resolution and seeds.** 2048 textures for hero surfaces, 256-512 for repeated ones. Use a seeded PRNG (mulberry32) so captures are reproducible.
9. **Three lookdev lights.** Neutral, grazing (bump must be visible) and game light. A material that only works under one of them fails.
10. **Lighting plan.** A warm key light on the table, cool fill from the windows, candle rim light, ACES tone mapping at fixed exposure, and 1 shadowed light. Brightness order in grayscale: board, then shelves, then ceiling.

Skipped: the full ObjectSculptSpec JSON, its validators and the ImageGen steps, because they need reference images or API keys we don't have. A copy of this recipe book is at `/private/tmp/claude-501/-Users-rels-Documents-github-repo-prep-prompt-test/1136c77e-a83b-48c3-85b6-d6f328e8eb32/scratchpad/recipes.md`.