// Builds every project that has a hub.json and copies its static output to
// apps/hub/public/p/<slug>/, where the hub embeds it in an iframe. Each project keeps its own
// lockfile and node_modules (no shared install), so one project's upgrade can't break another.
//   node scripts/build-projects.mjs                 # all projects
//   node scripts/build-projects.mjs ink-and-iron    # just these slugs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const only = process.argv.slice(2)
const built = []

for (const slug of readdirSync(join(root, 'projects')).sort()) {
  const dir = join(root, 'projects', slug)
  const manifest = join(dir, 'hub.json')
  if (!existsSync(manifest) || (only.length && !only.includes(slug))) continue
  const hub = JSON.parse(readFileSync(manifest, 'utf8'))
  if (hub.build) {
    if (!existsSync(join(dir, 'node_modules'))) execSync('npm ci', { cwd: dir, stdio: 'inherit' })
    execSync(hub.build, { cwd: dir, stdio: 'inherit' })
  }
  const from = join(dir, hub.output)
  const to = join(root, 'apps/hub/public/p', slug)
  rmSync(to, { recursive: true, force: true })
  mkdirSync(to, { recursive: true })
  for (const f of hub.include ?? readdirSync(from)) cpSync(join(from, f), join(to, f), { recursive: true })
  if (!existsSync(join(to, hub.entry))) throw new Error(`${slug}: entry ${hub.entry} missing from its output`)
  built.push(slug)
}
console.log(`built ${built.length}: ${built.join(', ')}`)
