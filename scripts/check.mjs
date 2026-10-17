// node scripts/check.mjs [--root <dir>]
// The repo's rules as code. Each breach names the file and says what to do instead, so fixing it needs no
// reading of CLAUDE.md. --root runs the rules over another tree, such as an old commit unpacked somewhere.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'

const argRoot = process.argv.indexOf('--root')
const root = resolve(argRoot > 0 ? process.argv[argRoot + 1] : new URL('..', import.meta.url).pathname)
const SKIP = new Set(['node_modules', 'dist', 'build', 'test-results', 'playwright-report', 'public'])
const CODE = /\.(m?js|tsx?|jsx)$/

const read = (rel) => readFileSync(join(root, rel), 'utf8')
const exists = (rel) => existsSync(join(root, rel))
const dirs = (rel) => (exists(rel) ? readdirSync(join(root, rel)).filter((n) => !n.startsWith('.') && statSync(join(root, rel, n)).isDirectory()) : [])
function files(rel, test = CODE) {
  const out = []
  const walk = (d) => { for (const n of readdirSync(join(root, d))) { if (SKIP.has(n) || n.startsWith('.')) continue; const p = join(d, n); statSync(join(root, p)).isDirectory() ? walk(p) : test.test(n) && out.push(p) } }
  if (exists(rel)) walk(rel)
  return out
}
/** Each line with its comments blanked, so a rule never fires on prose. */
const codeLines = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).split('\n').map((l) => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1'))
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/g

const projects = dirs('projects'), packages = dirs('packages')

/** @type {{ id: string, check(): { file: string, line?: number, message: string }[] }[]} */
const RULES = [
  {
    id: 'boundaries',   // projects never reach into each other; packages are imported by name
    check() {
      const out = []
      for (const [kind, names] of [['projects', projects], ['packages', packages]]) for (const name of names) {
        const home = join(kind, name)
        for (const f of files(home)) codeLines(f).forEach((line, i) => {
          for (const [, spec] of line.matchAll(IMPORT)) {
            if (!spec.startsWith('.')) continue
            const to = relative(root, resolve(root, dirname(f), spec))
            if (to === home || to.startsWith(home + sep)) continue
            const [top, pkg, ...rest] = to.split(sep)
            out.push({ file: f, line: i + 1, message: `'${spec}' reaches outside ${home}/. ` + (top === 'packages'
              ? `Import it by name, '@lid/${pkg}${rest.length ? '/' + rest.join('/') : ''}', with "@lid/${pkg}": "file:../../packages/${pkg}" in ${home}/package.json.`
              : kind === 'projects' ? 'Projects never import from each other. Copy it, or move it into packages/ once two projects carry it (docs/patterns.md).' : 'A package imports only its own files and other @lid packages by name.') })
          }
        })
      }
      return out
    },
  },
  {
    id: 'hub-contract',   // what the hub needs from every project (scripts/build-projects.mjs, apps/hub)
    check() {
      const out = [], order = new Map()
      const snaps = exists('snapshots') ? readdirSync(join(root, 'snapshots')) : []
      for (const p of projects) {
        const at = `projects/${p}`
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p)) out.push({ file: at, message: `"${p}" is not a kebab-case slug. The folder name is the public URL /p/<slug>, so rename it.` })
        let hub = null
        try { hub = JSON.parse(read(`${at}/hub.json`)) } catch { out.push({ file: `${at}/hub.json`, message: 'Missing or not JSON. Copy templates/project/hub.json and fill it in.' }) }
        const FIELDS = { title: (v) => typeof v === 'string' && v.length > 0, year: Number.isInteger, tags: Array.isArray, mode: (v) => v === 'iframe' || v === 'module', build: (v) => typeof v === 'string', output: (v) => typeof v === 'string', entry: (v) => typeof v === 'string' }
        if (hub) for (const [k, ok] of Object.entries(FIELDS)) if (!ok(hub[k])) out.push({ file: `${at}/hub.json`, message: `"${k}" is missing or wrong (${JSON.stringify(hub[k])}). See templates/project/hub.json.` })
        const vite = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'].map((n) => `${at}/${n}`).find(exists)
        if (!vite) out.push({ file: at, message: 'No vite.config. The hub copies a static build, so copy templates/project/vite.config.ts.' })
        else if (!/\bbase\s*:\s*['"]\.\/['"]/.test(read(vite))) out.push({ file: vite, message: "Set base: './'. The hub serves the build from /p/<slug>/ inside an iframe, so every URL must be relative." })
        const mine = snaps.map((n) => n.match(new RegExp(`^(\\d\\d)_${p}_0([1-3])\\.webp$`))).filter(Boolean)
        const nn = new Set(mine.map((m) => m[1]))
        if (mine.length !== 3 || nn.size !== 1) out.push({ file: 'snapshots', message: `${p} needs exactly three snapshots NN_${p}_01..03.webp sharing one NN (1600x900 WebP q85, NN = the order the project was made). Found ${mine.length}.` })
        else { const n = [...nn][0]; if (order.has(n)) out.push({ file: 'snapshots', message: `${p} and ${order.get(n)} share the order number ${n}. Give ${p} the next free number.` }); order.set(n, p) }
        if (exists('README.md') && !read('README.md').includes(`](projects/${p})`)) out.push({ file: 'README.md', message: `The Projects table has no row for ${p}. Add | [${p}](projects/${p}) | what it is | stack |.` })
      }
      return out
    },
  },
  {
    id: 'seeded-sim',   // a world replays the same run from the same seed, so its tests are deterministic
    check() {
      const out = []
      const page = (f) => /(^|\/)(sound|index|main)\.js$/.test(f) || f.includes(`${sep}shell${sep}`)
      for (const dir of ['projects/jelly/src', 'projects/rubber-duck-pool/src', 'packages/diorama']) for (const f of files(dir)) {
        if (page(f) || /\.test\./.test(f)) continue
        codeLines(f).forEach((line, i) => {
          const m = line.match(/\b(Math\.random|Date\.now)\b/)
          if (m) out.push({ file: f, line: i + 1, message: `${m[1]}() in simulation code. Take a seeded rng and the time from the caller (the world's R = rng(seed), the step's dt). ${m[1]} belongs in sound.js or the page module (index.js), which passes a seed in.` })
        })
      }
      return out
    },
  },
  {
    id: 'jelly-registry',   // src/specimens/registry.js is the one list of jellies; everything else follows it
    check() {
      const at = 'projects/jelly', reg = `${at}/src/specimens/registry.js`, readme = `${at}/README.md`
      if (!exists(reg)) return []
      const out = []
      const entries = [...read(reg).matchAll(/id:\s*'(\d\d)'[^\n]*import\('\.\/([^/']+)\/index\.js'\)/g)].map((m) => ({ id: m[1], folder: m[2] }))
      const folders = dirs(`${at}/src/specimens`)
      for (const f of folders) if (!entries.some((e) => e.folder === f)) out.push({ file: `${at}/src/specimens/${f}`, message: `Not in ${reg}. Add it there, or delete the folder: a replaced jelly goes in the same change.` })
      for (const e of entries) {
        if (!folders.includes(e.folder)) out.push({ file: reg, message: `Entry ${e.id} loads ./${e.folder}/index.js, which does not exist.` })
        else if (!e.folder.startsWith(e.id + '-')) out.push({ file: reg, message: `Entry ${e.id} loads ./${e.folder}. Name the folder ${e.id}-<name> or fix the id.` })
        if (!folders.includes(e.folder)) continue
        for (const f of files(`${at}/src/specimens/${e.folder}`)) read(f).split('\n').forEach((line, i) => {   // every number written in the folder is its own
          for (const m of line.matchAll(/\bid: '(\d\d)'|No\.(?:&nbsp;|\s)0?(\d\d)\b|\bno: '0?(\d\d)'|data-specimen="(\d\d)"/g)) {
            const n = m[1] || m[2] || m[3] || m[4]
            if (n !== e.id) out.push({ file: f, line: i + 1, message: `Says ${n}, but this folder is jelly ${e.id} in ${reg}. Write ${e.id}.` })
          }
        })
      }
      for (const f of files(at, /\.html$/)) if (f !== `${at}/index.html`) out.push({ file: f, message: 'A jelly is a module of the one page (src/specimens/NN-name/index.js: meta, markup, mount), never a standalone HTML file. Move it into a specimen and add it to the registry.' })
      if (exists(readme)) {
        const rows = [...read(readme).matchAll(/^\| (\d\d) \|/gm)].map((m) => m[1])
        if (rows.join() !== entries.map((e) => e.id).join()) out.push({ file: readme, message: `"The jellies" table lists ${rows.join(', ') || 'nothing'} but ${reg} has ${entries.map((e) => e.id).join(', ')}. One row per registry entry, in its order.` })
      }
      return out
    },
  },
]

let breaches = 0
for (const rule of RULES) for (const b of rule.check()) {
  breaches++
  console.log(`${b.file}${b.line ? ':' + b.line : ''}  [${rule.id}] ${b.message}`)
}
console.log(breaches ? `\n${breaches} breach${breaches > 1 ? 'es' : ''} of the repo's rules (scripts/check.mjs)` : `repo rules hold: ${RULES.map((r) => r.id).join(', ')}`)
process.exitCode = breaches ? 1 : 0
