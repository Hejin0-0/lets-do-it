// node scripts/new-project.mjs <slug> ["Title"]
// Copies templates/project to projects/<slug> and fills in __SLUG__, __TITLE__ and __YEAR__.
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const [slug, title = slug] = process.argv.slice(2)

if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('usage: node scripts/new-project.mjs <kebab-case-slug> ["Title"]')
  process.exit(1)
}
const dest = join(root, 'projects', slug)
if (existsSync(dest)) {
  console.error(`projects/${slug} already exists`)
  process.exit(1)
}

cpSync(join(root, 'templates/project'), dest, { recursive: true })

const fill = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { fill(path); continue }
    const text = readFileSync(path, 'utf8')
    writeFileSync(path, text
      .replaceAll('__SLUG__', slug)
      .replaceAll('__TITLE__', title)
      .replaceAll('__YEAR__', String(new Date().getFullYear())))
  }
}
fill(dest)

console.log(`created projects/${slug}\n  cd projects/${slug} && npm install && npm run dev`)
