# The prompts this was built from

The product prompts below are reproduced verbatim from the conversation that
produced this project. Repeated continuation requests, local filesystem paths,
and token-limit messages are omitted because they do not change the brief.

## 1. Original game brief

> Build a first-person survival game in an open world full of dinosaurs: gather resources, craft tools and weapons, build a base, and tame or fight dinosaurs, at a quality a AAA studio would ship.
>
> Render everything in a hand-painted cel-shaded comic-book style: flat poster-like color blocks with bold black ink outlines on every dinosaur, plant, and structure — no smooth gradients. Skies use soft puffy cel-shaded clouds. Distant or threatening dinosaurs read as solid silhouettes with one bright accent color (stripes, crest, eyes) so they’re instantly readable against the terrain. Movement kicks up chunky, flat illustrated dust, foliage, or water-splash trails, not photorealistic particles. Push warm/cool contrast between biomes — a sun-baked jungle/plains area vs. a cool blue misty highlands or coastal area.
>
> Camera is first-person, with visible hands/weapon/tool, subtle head-bob, and a sway on running or taking damage.
>
> World: an open island with a jungle, plains, coastline, and highlands, populated with a handful of distinct dinosaur species (a small pack hunter, a large herbivore, an apex predator) with their own cel-shaded silhouette and color accent.
>
> HUD: rounded dark panels with a gold/amber accent — health, stamina, and hunger bars bottom-left, hotbar/inventory bottom-center, minimap top-right. Keep it minimal and legible.
>
> Ship it with: gather/craft loop, basic building placement, at least one tameable and one hostile dinosaur, day/night cycle.
>
> The game contains:
> - Procedurally generated graphics
> - Resource gathering + crafting
> - Base building
> - Tameable and hostile dinosaurs
> - Cycle day/night
> - Multiplayer

## 2. Final visual and review directive

> Create this in a modern 3D cartoon style from a first-person perspective, matching the visual polish of the latest Animal Crossing games. It must be utterly perfect and visually stunning, with every single element—from textures to physics and anything imaginable—executed at AAA quality.
>
> Fan out sub-agents to handle each component individually to ensure flawless results. Run an iterative loop for every single asset, with dedicated sub-agents visually verifying that it reaches a true AAA standard. These reviewer agents must act as ruthless senior developers and harsh game critics; if an asset doesn't look AAA, it must be iterated on continuously. Do not stop until every sub-agent is genuinely blown away. Literally perform side-by-side blind comparisons on every iteration to determine which version looks better.

## Process reference

- [Tesana LOOP](https://tesana.ai/en/blog/introducing-loop)
- Apply Loop Engineering actively: implement a bounded change, measure it,
  compare it blindly against the retained version, and keep only demonstrated
  improvements.
