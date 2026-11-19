// node scripts/review-items.mjs [base] [head]
// Prints the REVIEW.md checklist items triggered by git diff <base>...<head> (default: origin/main..HEAD).
// Reads REVIEW.md from <base> so a change cannot weaken its own checks, falling back to the working tree
// only when <base> has no REVIEW.md yet. Observe mode: always exits 0.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [base = 'origin/main', head = 'HEAD'] = process.argv.slice(2)
const MAX_BUF = 128 * 1024 * 1024

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUF, stdio: ['ignore', 'pipe', 'pipe'] })
}

function repoRoot() {
  try { return git(['rev-parse', '--show-toplevel'], process.cwd()).trim() }
  catch { return fileURLToPath(new URL('..', import.meta.url)) }
}

/** Convert a repo-relative path glob (*, **, ?) into an anchored RegExp. */
function globToRegExp(glob) {
  let out = '^'
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2 }
      else { out += '.*'; i += 1 }
    } else if (c === '/' && glob[i + 1] === '*' && glob[i + 2] === '*' && i + 3 === glob.length) {
      out += '(?:/.*)?'; i += 2
    } else if (c === '*') out += '[^/]*'
    else if (c === '?') out += '[^/]'
    else out += c.replace(/[.+^$()[\]{}|\\]/g, '\\$&')
  }
  return new RegExp(out + '$')
}

function parseRegex(raw) {
  const m = raw.match(/^\/([\s\S]+)\/([dgimsuvy]*)$/)
  return m ? new RegExp(m[1], m[2]) : new RegExp(raw)
}

function parseReview(md) {
  const items = []
  let cur = null
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^### (R\d+)\s+[—–-]\s+(.+)$/)
    if (h) { cur = { id: h[1], title: h[2].trim(), paths: [], diff: null, check: '', source: '' }; items.push(cur); continue }
    if (!cur) continue
    const f = line.match(/^- \*\*(Paths|Diff|Check|Source):\*\*\s+(.+)$/)
    if (!f) continue
    const [, key, val] = f
    if (key === 'Paths') cur.paths = [...val.matchAll(/`([^`]+)`/g)].map((m) => globToRegExp(m[1]))
    else if (key === 'Diff') { const m = val.match(/`([^`]+)`/); if (m) cur.diff = parseRegex(m[1]) }
    else if (key === 'Check') cur.check = val.trim()
    else if (key === 'Source') cur.source = val.trim()
  }
  return items
}

function unquote(p) {
  if (!p.startsWith('"') || !p.endsWith('"')) return p
  return p.slice(1, -1).replace(/\\(["\\])/g, '$1')
}

function parseDiff(text) {
  const files = []
  let cur = null, inHunk = false
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      cur = { paths: new Set(), lines: [] }
      files.push(cur)
      inHunk = false
      const m = line.match(/^diff --git (?:"a\/([^"]+)"|a\/(\S+)) (?:"b\/([^"]+)"|b\/(\S+))$/)
      if (m) { cur.paths.add(m[1] || m[2]); cur.paths.add(m[3] || m[4]) }
      continue
    }
    if (!cur) continue
    if (!inHunk) {
      if (line.startsWith('@@ ')) { inHunk = true; continue }
      if (line.startsWith('rename from ')) cur.paths.add(unquote(line.slice(12)))
      else if (line.startsWith('rename to ')) cur.paths.add(unquote(line.slice(10)))
      else if (line.startsWith('--- a/')) cur.paths.add(unquote(line.slice(6)))
      else if (line.startsWith('+++ b/')) cur.paths.add(unquote(line.slice(6)))
      continue
    }
    if (line.startsWith('+') || line.startsWith('-')) cur.lines.push(line.slice(1))
  }
  return files
}

function run() {
  const root = repoRoot()
  let md = null
  try {
    md = git(['show', `${base}:REVIEW.md`], root)
  } catch {
    const fallback = join(root, 'REVIEW.md')
    if (!existsSync(fallback)) {
      console.log(`note: ${base} has no REVIEW.md and none exists in working tree (observe mode)`)
      return
    }
    console.log(`note: ${base} has no REVIEW.md; using working tree REVIEW.md`)
    md = readFileSync(fallback, 'utf8')
  }

  let diffText = ''
  try {
    diffText = git(['diff', '--no-ext-diff', '--unified=0', `${base}...${head}`], root)
  } catch (err) {
    console.log(`note: could not read git diff ${base}...${head}: ${err.stderr?.trim() || err.message} (observe mode)`)
    return
  }

  const items = parseReview(md)
  const files = parseDiff(diffText)
  const hits = items.filter((item) =>
    files.some((f) =>
      [...f.paths].some((p) => item.paths.some((rx) => rx.test(p))) &&
      (!item.diff || f.lines.some((l) => item.diff.test(l))),
    ),
  )

  for (const item of hits) {
    console.log(`${item.id}  ${item.title}`)
    console.log(`  check: ${item.check}`)
    console.log(`  source: ${item.source}`)
  }
  console.log(hits.length
    ? `${hits.length} review item${hits.length === 1 ? '' : 's'} triggered for ${base}...${head} (observe mode)`
    : `no review items triggered for ${base}...${head} (observe mode)`)
}

run()
process.exitCode = 0
