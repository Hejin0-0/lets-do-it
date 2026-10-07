# Capability Map: Inkbound Isle

| Module id | Responsibility | Depends on |
|---|---|---|
| `expedition-core` | Inventory, survival, recipes, build costs, trust, mission, score, save schema | — |
| `comic-rendering` | Shared toon materials, ink silhouettes, pooled illustrated effects | — |
| `procedural-island` | Seeded terrain, four biomes, instanced ground cover, landmarks, sky, water | `comic-rendering` |
| `creature-combat` | Distinct silhouettes, perception, telegraph/active/recovery attacks, tame commands | `expedition-core`, `procedural-island`, `comic-rendering` |
| `feedback-mix` | Native procedural audio, impact priority, ambience, visual equivalents | `expedition-core`, `creature-combat` |
| `first-person-shell` | Movement, tool view, interaction, construction, HUD, menus, settings | all client modules |
| `session-coop` | Hardened relay for presence and bounded gather/build/creature events | `expedition-core`, `first-person-shell` |
| `quality-harness` | Deterministic scenarios, counters, golden path, responsive review, and multi-client checks | all modules |

Build order: `expedition-core` + `comic-rendering` → `procedural-island` → `creature-combat` → `feedback-mix` → `first-person-shell` → `session-coop` → `quality-harness`.

Public boundaries stay deliberately small: pure rule functions accept and return serializable values; render modules own Three.js objects; the relay accepts only the shared protocol union; UI receives a snapshot and callbacks rather than owning game state.
