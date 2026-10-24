# Sampling assets in the WebGPU map

The browser runs native WebGPU JavaScript. Blender authors and converts the models; Unity is an optional lookdev
consumer. This map does not require the Unity runtime or a Three.js GLTFLoader.

## Rebuild

```sh
npm ci
npm run assets:map
npm test
npm run build
```

`BLENDER` can override the default macOS Blender executable. The build uses a separate background Blender process.
It leaves the open Blender scene and the original sampling deliveries unchanged.

`models/sampling/` contains copies of the source GLBs. The build reads `layout.js` through
`tools/export-map-layout.mjs`, then converts positions, normals and linear material colours to the runtime's binary
format. One runtime unit is two metres. The output is `public/props/sampling.bin`, its bounds/indices are in
`sampling-shapes.js`, and the source SHA256 hashes are in `public/props/sampling-manifest.json`.
No runtime GLB parser, external CDN or texture fetch was added. Existing procedural island architecture and duck
assets remain part of the scene.

## Selected models and fitting

The map uses the palm inflatable, beach ball, radio, loungers, parasols, palms, daybeds, hanging lamps, cabana,
boat, potted palm, three rock variants, lifebuoy, pier, main basin and whirlpool bowl from the sampling set.
The original illustrated duck mural, swan and flamingo remain the existing models. The Part S art wall stays in
the authored asset set, but the courtyard displays the original mural. The standalone tube-slide and water-elevator GLBs
are retained as source references; their height and topology do not fit the shallow courtyard.

The open flume and transparent return tube are route-fitted derivatives. Their visible paths and the ducks'
motion come from the same `P.slide` / `P.tube` layout. The pool rim is flush with the terrace, its three steps and
floor match the collision field, and both basin rims have receiving ports. Grass is excluded from the open
flume's corridor. Ivory supports meet the terrain. Following `origin`, the pump lifts ducks from the small
pool into an intake above the surface, then through a high transparent return tube to the main pool. The entire
return route stays above ground. The transparent skin uses a separate compact mesh with alpha-to-coverage and
does not cast opaque shadows. `models/sampling/map-fitted.blend` contains the editable route-fitted pipe,
flume, collars and supports; rerun the build to regenerate the fitted basins from their source GLBs.

## Screenshot corrections

- Terrain beneath the complete authored basin shells, including coping, is discarded to prevent overlapping
  surfaces from producing jagged patches on the pavers. The checker floor has a separate depth offset.
- The flume carries a continuous water sheet with advected surface waves; pool ripples animate without
  pointer input. A gate keeps waiting ducks inside the main pool until the preceding rider clears the intake.
- Grass is excluded beneath each towel and from a margin around it, accounting for leaning grass blades.
- Plant placement uses each model's lowest point and samples the soil around its root on sloping ground.
- The return ride uses the above-water pump intake described above. Its lift animation remains, with no exposed jet.
- The small round fountain at the main pool's rear is removed, along with its former spray emitter.

## Interaction fixes

- WASD moves relative to the camera, diagonals have the same speed, Shift speeds movement up, and R resets it.
  Key release, window blur and document hiding stop keyboard motion. Middle-drag or Shift-drag pans; wheel zooms.
- Ordinary water drags make ripples. Empty-ground or right-button drags orbit the camera. Grabbing floats still works.
- Holding or moving an inflatable no longer emits the repeated hiss. Inflation animation remains.
- Duck arrivals, rides, collisions and interactions schedule no audio. Continuous water-noise loops are removed;
  explicitly selecting a radio station still plays music. Muting also silences notes already scheduled.
- A passive swan on a flat dry deck settles instead of continuously exchanging tiny ground-contact impulses.
  Picking it up, throwing it, slopes, buoyancy and its existing deliberate hops remain active.

## Verification scope

`tests/map-assets.test.mjs` reads the actual exported triangles and checks valid normals/indices, bounds,
visible floor/step agreement with collision heights, above-ground flume clearance, open receiving ports,
current layout routes, plant grounding and absence of duplicated structure placements. The world suite covers duck circulation,
slide/pump/return operation, 40-duck soak, picking/throwing, silent deflation, swan rest and wake-up, capture/release,
and the existing sea/daylight behavior. The stochastic capture soak runs ten minutes, with its original residence
and circulation thresholds unchanged.

Browser verification covers desktop WebGPU rendering, keyboard movement/release/blur/reset, mouse orbit/pan/zoom,
float picking, idle swan stability and a narrow viewport. A narrow desktop viewport does not establish real mobile
GPU performance; physical phone and low-end GPU checks remain separate.

The focused intake regression in `tests/ride-intake.test.mjs` starts two ducks at the occupied entrance and
checks that the waiting duck stays wet, then follows the preceding rider through the flume.
Browser captures: [pump, flume and towels](evidence/map-pump-flume.webp),
[plant grounding from the jetty](evidence/map-plant-grounding.webp).
These two captures predate the water/lighting revision below.

Verified on 2026-10-24: `npm test` passed all 7 reported tests (six mesh checks plus the world suite),
and the added intake regression passed separately. The 40-duck five-minute soak completed 89 slides and 92
pump returns, with a longest stationary interval of 3.5 seconds and a longest dry interval of 2.5 seconds,
within the original thresholds. `npm run build` passed. The production preview rendered in desktop WebGPU;
real browser mouse/keyboard input, grab/release and a 390 × 844 viewport were checked. Idle simulation time and
water energy continued changing without input, and no browser render errors were observed.

## Water, lighting and Part S revision — 2026-10-24

The repeated white bars on the flume are removed. Its denser sheet has small vertex waves, a matching
time-varying normal field, Fresnel environment reflection, sun highlights, broken foam near the edges and
distorted shallow-bed caustics. Alpha-to-coverage reveals the ivory channel below it. The thin flume uses
analytic bed distortion rather than screen-space refraction: its layer runs before the resolved opaque scene
exists. The pools retain the separate screen-space refraction pass. This is a real-time visual water treatment,
not a volumetric fluid simulation.

This revision initially replaced the broad water cylinder below the pump with three narrow water filaments and
kept the rising spray. The later quiet-intake revision below removes both, retaining the ride/collision route.

Cool LED geometry follows the under-coping line, bowl lip, slide edges and pump collars. Its material stays
porcelain white by day and emits after sunset. Receiving ports have actual gaps in the light strips. Fourteen
recessed pool fixtures add local cool light to nearby tiles, props and water, alongside the existing warm lamps.
The bowl fixtures follow its sloping inner surface. LED geometry remains opaque; it is not included in the
transparent acrylic/water batch. The route-fitted source is `models/sampling/map-fitted.blend`.

Part S now has all six reusable models. The newly authored `art_wall-v01` includes Blender source, GLB, FBX,
material metadata and a preview (15,104 triangles; no nonmanifold edges or degenerate faces). The previous five
architectural samples plus the wall are delivered in [Architecture set v02](../../../asset-sampling/architecture-set-v02/README.md).
Unity URP verified six prefabs, imported triangle counts/bounds, materials, route markers and static collider
probes. The Unity package is an inspection scene; the playable map remains native WebGPU.

Validation for this revision: seven focused mesh/intake checks passed, including the then-current pump-jet bounds and
unblocked light-strip ports; `npm run build` passes. The production preview runs in desktop WebGPU with no
shader/render errors. The earlier full stochastic world-suite results above were not rerun for this rendering
revision. Physical mobile/low-end GPU performance remains unverified.

Current captures: [daytime water](evidence/water-flow-day.webp), [night lighting](evidence/architecture-night.webp),
[art wall in the web map](evidence/art-wall-map.webp).

## Quiet interactions and clear pump intake — 2026-10-24

All world-event sound synthesis is removed from `sound.js`, including arrival calls, splash bursts, pickup/collision
tones and switch effects. The slide/fountain noise loops no longer exist. The first gesture may enable the audio
context, but it starts no sources until a radio station is selected. The optional radio keeps its musical notes
and percussion; muting fades the master output and stops scheduling new notes.

The pump's three twisting filaments, material branch, placement and compiled geometry are removed. The upward
spray emitter and its particle meshes are removed as well. The editable `map-fitted.blend` and runtime binary are
rebuilt without that geometry. Duck lifting and movement through the transparent return tube remain unchanged;
the flume water sheet and underwater pool bubbles remain.

`tests/sound.test.mjs` reproduced sound sources starting with the radio off, then passed after the fix; it also
checks that selected radio music survives and mute silences scheduled notes. The intake regression reproduced
15 active spray particles before the fix, then passed with no emitter. Export checks reject pump-jet geometry
and placement. Production-browser instrumentation observed 17 arrival events, 11 slides and 8 pump returns with
audio enabled and zero started audio sources; selecting the radio then started a musical tone. The clear intake
was inspected in desktop WebGPU with no console warnings/errors: [current pump intake](evidence/pump-intake-clear.webp).

Final validation: `npm test` passed all 11 reported tests, including the full stochastic world suite and 40-duck
five-minute simulation. The sound regression also passed after adding a check for muting already scheduled
radio notes. `npm run build` passed with the rebuilt 25-model sampling binary.

## Original mural, direct water drag and faster return — 2026-10-24

The courtyard wall again uses the original Blender-authored `mural` model, at its original placement. Its eight
ducks, wave bands, turtles, fish, sun and clouds replace the Part S art-wall placement. The reusable Part S
delivery remains available. [Restored mural](evidence/duck-mural-restored.webp).

The map passes water hits directly to the shared view's picker. Normal left-button
hold + move now stirs the water directly. Empty ground and right-button drags orbit; WASD, wheel zoom,
Shift/middle-button pan and duck/float grabbing remain available. The Korean controls and README match these
gestures. The shared diorama package is unchanged. [Mouse-drag ripples](evidence/water-drag-restored.webp).

The pump lift still takes 0.6 seconds. After entering the clear tube, a duck accelerates from 0.8 to 1.8 runtime
units per second (previous cruise: 0.6), reaching cruise after half a second. The same speed feeds the exit
velocity. A regression reproduced the former 9.23-second lift/return and now requires a safe return in under
4.2 seconds, with smooth acceleration and a wet landing in the main pool.

Production-browser verification reproduced zero stir calls and a camera turn on a plain water drag before the
fix. Afterwards, the same real mouse gesture produced 25 stir calls and surface displacement with unchanged
camera angles. A running simulation visibly propagated the ripples. Right-button orbit and real duck grabbing
also passed. Temporary water probes were restored after the checks.

Final validation: `npm test` passed all 12 reported tests, including the full stochastic world suite and the
40-duck five-minute simulation. The measured lift + return was 3.625 seconds, compared with 9.23 seconds before
the speed change. `npm run build` passed. The production browser reported zero console errors or warnings.

## Natural fast tube exit — 2026-10-24

The supplied `map-video2.mp4` was inspected around its return-tube outlet sequence (roughly 10–12 seconds).
Ducks accelerate inside the final 0.65 runtime units of the tube, from a 1.8-unit/second cruise toward 4.8.
The outlet preserves that speed along its full three-dimensional, downward tangent. There is no separate
upward kick: gravity, buoyancy, duck collisions and water drag handle the release and landing. The pump's
0.6-second lift stays as above; a complete lift and return now takes about 3.45 seconds.

The release direction uses the fixed final 0.08-unit segment, independent of the step that crosses the mouth.
The duck keeps the speed reached inside the tube rather than receiving an impulse at the transition. It counts
one return, releases the held body and clears its ghost flag. Existing landing ripples, foam and bubbles remain;
audio still follows the quiet-interaction rules.

The outlet regression checks acceleration before release, continuous exit speed, alignment with the downward
mouth, no exaggerated upward arc, finite physics, forward travel and a wet main-pool landing. The measured
exit velocity is approximately [4.47, -1.33, -1.22] runtime units/second; maximum rise during the following second
is zero in the isolated fixture. Lift/return timing, intake queue and sound regressions also pass. The updated
real WebGPU canvas recording shows the low, fast exit:
[natural tube exit](evidence/tube-natural-exit.webm). No browser console warnings or errors were observed.

Validation: `npm test` passed all 13 reported tests, including the forty-duck five-minute simulation.
The focused ride and sound tests also passed after adding the release-speed assertion. `npm run build`
passed, and the live development server at port 5178 serves the corrected outlet behavior.
