# Verification map

What a user can do on the pages this repo verifies, and how to drive it. Read this, then the feature file.

## Baseline

- Build the project (`npm run build` in `projects/<slug>`), then probe its `dist/` with `--serve` and `--webgpu` (see `../SKILL.md`).
- jelly opens the jelly named by the hash (`--path '#11'`); with none it opens 01.
- rubber-duck-pool starts with twelve ducks, the radio off and the hourglass part run down.

| Feature | Page | Script |
|---|---|---|
| [jelly-switcher](jelly-switcher.md) | projects/jelly | `drive/jelly-tour.js` |
| [page-frames](page-frames.md) | every page with a masthead and a panel | `drive/overlap.js` |
| [pool-ducks](pool-ducks.md) | projects/rubber-duck-pool | `drive/pool-ducks.js` |
| [pool-props](pool-props.md) | projects/rubber-duck-pool | `drive/pool-props.js` |
| [pool-seats](pool-seats.md) | projects/rubber-duck-pool | `drive/pool-seats.js` |
