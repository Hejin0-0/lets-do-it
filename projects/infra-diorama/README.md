# infra-diorama

Dark, cinematic single-page scrollytelling site for a fictional B2B powered-land
developer ("Meridian"). The centrepiece is an isometric 3D diorama of an
industrial site that builds itself through five construction phases as you
scroll.

## Run

```bash
npm install && npm run dev
```

`npm run build` type-checks and bundles to `dist/`.

## Component tree

```
App
├─ PhaseProvider          scroll controller — Lenis + GSAP ScrollTrigger → { phase, progress, goTo }
├─ TopBar                 wordmark · phase pill · explainer link · hamburger → menu overlay
├─ Diorama (fixed layer)  <Canvas> orthographic iso camera, warm key + cool rim, PCF soft shadows
│   ├─ TerrainPlane       backdrop plane, parallaxes slower than the model
│   ├─ DioramaModel       geometry wrapped in PhaseGroup{from,to}
│   └─ PinProjector       projects 3D anchors → CSS vars on the DOM pins
├─ Annotations            DOM pins + leader lines; Legend replaces them on mobile
├─ CaptionPanel           all five captions in the DOM, cross-faded, inert when inactive
├─ story__step × 5        100svh spacers — the scroll timeline itself
├─ ScrollCTA              "Scroll to Phase N ↓" / "Back to top ↑"
└─ ScrollHint             "Scroll to explore", phase 1 only
```

## How the phase system works

`src/phases.ts` is the single source of truth: title, caption, alt text and pin
anchors per phase. Everything else reads from it.

`PhaseProvider` creates one ScrollTrigger per spacer (`top center` →
`bottom center`) and writes the active index to both React state (for the DOM)
and a module-level `scrollState` object (for the render loop — putting 60fps
values through React state would re-render the tree for nothing).

`<PhaseGroup from={3} to={4}>` is the only phase logic the model needs. It damps
a 0→1 value toward its target (λ 6.2 ≈ settled in ~750ms), scaling its children
up out of the pad and fading their materials. Under `prefers-reduced-motion` the
damp is replaced by an instant assignment, so phases become discrete steps.

## Dropping in a real glTF

`DioramaModel` is a procedural stand-in so the site ships without binary assets.
To replace it: load the glTF and wrap its named nodes in the same
`<PhaseGroup from to>` components on the same axes (y = 0 is the pad surface,
+x/+z face the camera). The scroll controller, annotation system and caption
panel never change — they only read `scrollState.phase` and project pin anchors
through the diorama group's world matrix.

## Design tokens

All in the token block at the top of `src/styles.css`: the near-black palette,
one signal-green accent (`--accent`), and the type scale. No other hues, no
other fonts.

## Accessibility

- Captions are real DOM text, never baked into images; inactive ones are `inert`.
- The canvas carries `role="img"` with a per-phase `aria-label`.
- Pins are buttons — keyboard reachable, with a visible focus ring; only the
  active phase's pins are in the tab order.
- The phase pill is an `aria-live` region, so phase changes are announced.
- `prefers-reduced-motion` disables Lenis, parallax, damping and all transitions.

## Notes

- Shadow camera bounds are set imperatively in `Lights` — three caches the
  shadow camera's projection matrix, and `shadow-camera-*` props that change
  without an explicit `updateProjectionMatrix()` leave the old frustum in place,
  which renders everything outside it solid black.
- Depth of field is a CSS `backdrop-filter` with a radial mask rather than a
  postprocessing pass: on a fixed orthographic camera it looks the same, costs
  nothing per frame, and doesn't need a second render target.
