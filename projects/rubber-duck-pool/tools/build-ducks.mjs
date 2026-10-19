// npm run assets:ducks: the runtime ducks from the models (models/, made in Blender; not in git). Blender cuts the shared
// duck mesh down and writes public/ducks/duck.bin and src/pool/duck-shape.js (tools/build_duck_assets.py); cwebp makes
// each duck's albedo atlas a 512 px WebP and its preview render a 96 px square swatch. BLENDER overrides the macOS path.
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url)), models = join(root, 'models'), out = join(root, 'public', 'ducks')
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender'
execFileSync(blender, ['-b', '--factory-startup', '-P', join(root, 'tools', 'build_duck_assets.py')], { stdio: ['ignore', 'inherit', 'inherit'] })

const ids = readdirSync(models).map((f) => f.match(/^duck-(\d\d-[a-z]+)-albedo\.png$/)?.[1]).filter(Boolean).sort()
for (const id of ids) {
  execFileSync('cwebp', ['-quiet', '-q', '88', '-resize', '512', '512', join(models, `duck-${id}-albedo.png`), '-o', join(out, `${id}.webp`)])
  execFileSync('cwebp', ['-quiet', '-q', '85', '-crop', '45', '0', '450', '450', '-resize', '96', '96', join(models, `duck-${id}-preview.png`), '-o', join(out, `${id}-thumb.webp`)])
}
console.log(`ducks: ${ids.length} textures and swatches in public/ducks (${ids.join(', ')})`)
