# Dominions 2100

Playable real-time strategy vertical slice built with Three.js and no binary graphics assets. The map, water, coastline, vegetation, units, buildings, world-space icons, and effects are all generated in code.

## Run

```bash
npm install
npm run dev
```

To verify the deliverable:

```bash
npm run check
```

## Historical equivalents

| Dominions 2100 | Period | Age of Empires II equivalent | Visual change |
|---|---:|---|---|
| Steam Age | 1800 | Dark Age | Brick, timber, coal, and artisanal production |
| Industrial Age | 1900 | Feudal Age | Steel, engines, concrete, and mass production |
| Digital Age | 2000 | Castle Age | Networks, automation, and precision warfare |
| Fusion Age | 2100 | Imperial Age | Programmable matter, clean energy, and synthetic units |

## Controls

- `WASD` or arrow keys: move the camera; hold `Shift` to move faster.
- `Q` / `E`: rotate by 15 degrees.
- Mouse wheel: zoom toward the cursor.
- Click or drag: select one or multiple units; hold `Shift` to add or remove units from the selection.
- Double-click: select all visible units of the same type.
- Right-click: move, attack, or gather.
- `H`: return to the command center.
- `.`: find an idle worker.
- `1`–`9`: execute the visible commands.
- `Esc`: cancel building placement.

## Included features

- Economy with four resources whose identities change by era, a population system, active gathering, and income-generating buildings.
- Nine contextual commands: four units, four buildings, and era advancement.
- Building placement with a preview and terrain validation.
- Active starting base, roads, units in formation, combat, projectiles, damage, health bars, debris, and AI raids.
- Procedural remodeling of every entity when advancing to a new era.
- Isometric orthographic camera with inertia, edge scrolling, zoom-to-cursor, and impact shake.
- Complete English-language HUD, statistics, synchronized minimap, objectives, alerts, help, Web Audio, and reduced-motion mode.
- Soft-edged fog of war with visible, remembered, and unexplored states, plus tactical concealment of resources and enemies.
- Deterministic terrain with tiling textures, animated water, coastline, instanced ground cover, sky, era-specific atmospheres, shadows, and post-processing.
- Distinct geometric feedback for moving, attacking, gathering, building, and landing hits.

## Architecture

- `src/catalog.js`: eras and unit/building definitions.
- `src/gameplay.js`: pure, immutable rules for the economy, population, advancement, and combat.
- `src/visibility.js`: persistent grid shared by the fog of war, entities, and minimap.
- `src/world.js`: visual generation and Three.js factories.
- `src/main.js`: integration, input, AI, camera, and game loop.
- `src/styles.css`: the HUD visual system and its era-specific variants.

## References

The visual language was evaluated against official *Age of Empires II: Definitive Edition* material. The MIT-licensed [alandaitch/imperios-1800-2100](https://github.com/alandaitch/imperios-1800-2100) project was also consulted as a technical reference for procedural detail, RTS camera behavior, and contrast evaluation; this implementation retains its own architecture and code.
