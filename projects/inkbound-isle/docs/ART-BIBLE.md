# Inkbound Isle Art Bible

## Visual Target

The target is a premium contemporary 3D cartoon painted with comic-book discipline: rounded geometry, broad stepped color planes, soft readable lighting, selective near-black silhouette ink, and tiny reusable procedural surface maps. Distant threats simplify into dark silhouettes carrying one bright species accent. This is an art-direction target, not a claim that the current build has met it; see the independent review in `LOOP6-REVIEW.md`. The procedural art is original and does not copy Nintendo assets or character design.

## Color Palette

| Role | Color |
|---|---|
| Ink | `#101315` |
| Amber UI accent | `#e8a83e` |
| Warm plains | `#c8863d`, `#e3b858` |
| Jungle canopy | `#2e7043`, `#58a24f` |
| Cool highlands | `#587f92`, `#8fb2b8` |
| Coast water | `#287f93`, `#52b1bb` |
| Night sky | `#18253a` |
| Danger accent | `#ff5b3d` |
| Tame accent | `#65e08a` |

Warm/cool contrast is geographic, not a full-screen filter: the jungle and plains stay sun-baked while highlands and coast stay blue and misty.

## Typography

Use the platform sans stack for body text and a condensed heavy system face for labels. Titles are uppercase with modest tracking. Numbers remain tabular and large enough to scan during combat. No web-font download is required.

## Character Design Rules

- Parasaur: broad low body, backward crest, teal accent; calm and readable as tameable.
- Ember raptor: narrow forward lean, long tail, orange stripe; appears in small packs.
- Obsidian rex: oversized head and chest, nearly black body, red eye/stripe accent; apex silhouette.
- Remote players: simple inked explorer silhouettes with amber backpack accents.

Every creature is generated at runtime. The apex head and lower jaw use connected cross-section lofts; most body and limb masses still use shared primitives. Animation comes from articulated group rotation, gait bob, tail counter-swing, and jaw motion.

Hostile attacks must move the whole silhouette: anticipation compresses the body and counter-braces shoulder/pelvis, contact drives shoulders ahead of the pelvis, and recovery settles toward the authored rest masses while feet remain terrain-safe. Neck or jaw motion alone is not an acceptable attack.

## Environment Style

- Terrain uses smooth organic normals, three-step biome/elevation color regions, and one instanced field of opaque illustrated route dabs; it never relies on a repeated terrain photograph or transparent decal queue.
- Plants use rounded clustered forms with clean overlap, controlled asymmetry, and silhouette ink only where it improves separation.
- Clouds are puffy clusters of smooth flattened toon-shaded spheres.
- Dust, splashes, and impacts use chunky low-poly puffs/shards that shrink out rather than fade. Camera-close incoming damage uses the compact 0.35 impact scale; distant/outgoing world contacts use 0.60 for readability. Tame celebration particles are not scaled by the combat envelope.
- Structures use warm generated wood variation, rounded/bevel-like edges, dark joints, contact shadow, and a bright amber placement ghost.
- Wood, stone, leaf, skin, and soil use distinct deterministic 64×64 sRGB paint maps with filtered mipmaps and irregular three-value swaths; hero silhouettes retain broad flat toon bands.
- The ocean uses one indexed, island-contour mesh with five discrete bands, translucent turquoise shallows, narrow foam, and wet sand. Animated marks have explicit ordering above the water.
- Creatures and hero props receive stronger two-band oval contact shadows so they never appear to float.
- Camp and torch fire use separate unlit red outer and amber inner shapes, never a white emissive placeholder.
- The first-person rig uses bent forearms, thin cuffs, rounded palms, curved finger grips, opposing thumbs, a shaft-aligned right-hand grip, and a supporting off-hand. Body-side sleeve caps remain outside the frame during sampled actions and sway.
- Scenic framing masses may add depth but cannot dominate a fixed camera: the largest projected mass stays below 0.36 normalized screen area and accumulated central-route coverage stays below 0.23 in the four locked captures.
- Tool actions preserve anticipation, contact, and recoil on screen. The spear exposes at least 15 frames at 30 fps; longer readability may not delay the single contact window or duplicate a hit.

## UI Visual Language

HUD panels are translucent near-black with a 2px ink border, restrained 10–14px rounding, and amber focus/selection. Bars pair color with text labels. Hotbar slots use numbers and names, not icons alone. The layout collapses safely at 768px and 320px widths.
