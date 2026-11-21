// npm run assets:ducks: the runtime ducks from the models (models/, made in Blender; not in git). Blender cuts the shared
// duck mesh and unexpected extras down and writes public/ducks/duck.bin and src/pool/duck-shape.js (tools/build_duck_assets.py);
// cwebp makes each duck's albedo atlas a 512 px WebP and its preview render a 96 px square swatch. BLENDER overrides the macOS path.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const UNEXPECTED = [
  ['13-teapot', 'unexpected-01-porcelain-teapot'],
  ['14-terrarium', 'unexpected-02-moss-terrarium'],
  ['15-citrus', 'unexpected-03-citrus-peel'],
  ['16-cloud', 'unexpected-04-cloud-weather'],
  ['17-bookbinder', 'unexpected-05-bookbinder'],
  ['18-ramen', 'unexpected-06-ramen-bowl'],
  ['19-moon', 'unexpected-07-lunar-crater'],
  ['20-radio', 'unexpected-08-retro-radio'],
  ['21-magnet', 'unexpected-09-magnetic'],
  ['22-snow-globe', 'unexpected-10-snow-globe'],
  ['23-mosaic', 'unexpected-11-mosaic-fountain'],
  ['24-lantern', 'unexpected-12-deepsea-lantern'],
]

const root = fileURLToPath(new URL('..', import.meta.url)), models = join(root, 'models'), out = join(root, 'public', 'ducks')
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender'
const tmpDir = mkdtempSync(join(tmpdir(), 'duck-build-'))
try {
  execFileSync(blender, ['-b', '--factory-startup', '-P', join(root, 'tools', 'build_duck_assets.py')], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, DUCK_TMP_DIR: tmpDir },
  })

  const classicIds = readdirSync(models).map((f) => f.match(/^duck-(\d\d-[a-z]+)-albedo\.png$/)?.[1]).filter(Boolean).sort()
  for (const id of classicIds) {
    execFileSync('cwebp', ['-quiet', '-q', '88', '-resize', '512', '512', join(models, `duck-${id}-albedo.png`), '-o', join(out, `${id}.webp`)])
    execFileSync('cwebp', ['-quiet', '-q', '85', '-crop', '45', '0', '450', '450', '-resize', '96', '96', join(models, `duck-${id}-preview.png`), '-o', join(out, `${id}-thumb.webp`)])
  }
  for (const [id, stem] of UNEXPECTED) {
    execFileSync('cwebp', ['-quiet', '-q', '88', '-resize', '512', '512', join(tmpDir, `${id}-albedo.png`), '-o', join(out, `${id}.webp`)])
    execFileSync('cwebp', ['-quiet', '-q', '85', '-crop', '45', '0', '450', '450', '-resize', '96', '96', join(models, `${stem}-preview.png`), '-o', join(out, `${id}-thumb.webp`)])
  }
  const allIds = [...classicIds, ...UNEXPECTED.map(([id]) => id)]
  console.log(`ducks: ${allIds.length} textures and swatches in public/ducks (${allIds.join(', ')})`)
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
}
