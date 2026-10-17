// node scripts/verify.mjs [--build] [slug ...]
// Everything CI runs, in one command and in this order: the repo's rules (scripts/check.mjs), the
// packages' tests, then each project's headless checks (its "verify" script, else its "test"). A change
// to a package is checked against every project, since any of them may use it. --build also builds every
// project into the hub (scripts/build-projects.mjs).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2), only = args.filter((a) => !a.startsWith('--'))
const steps = []
const run = (name, cmd, cwd = root) => {
  const t0 = Date.now()
  try { execSync(cmd, { cwd, stdio: 'inherit' }); steps.push(`ok    ${name} (${((Date.now() - t0) / 1000).toFixed(0)} s)`) }
  catch { steps.push(`FAIL  ${name}: ${cmd} in ${cwd.replace(root, '') || '.'}`) }
}

run('repo rules', 'node scripts/check.mjs')
run('packages', 'npm run -s test:packages')
for (const slug of readdirSync(join(root, 'projects')).filter((n) => existsSync(join(root, 'projects', n, 'package.json'))).sort()) {
  if (only.length && !only.includes(slug)) continue
  const dir = join(root, 'projects', slug), scripts = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts ?? {}
  const script = scripts.verify ? 'verify' : scripts.test ? 'test' : null
  if (!script) { steps.push(`FAIL  ${slug}: no headless checks. Add a "verify" (or "test") script to projects/${slug}/package.json that runs without a browser.`); continue }
  if (!existsSync(join(dir, 'node_modules'))) run(`${slug} install`, 'npm ci', dir)
  run(slug, `npm run -s ${script}`, dir)
}
if (args.includes('--build')) run('hub build', `node scripts/build-projects.mjs ${only.join(' ')}`)

console.log('\n' + steps.join('\n'))
process.exitCode = steps.some((s) => s.startsWith('FAIL')) ? 1 : 0
