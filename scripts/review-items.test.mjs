// node --test scripts/review-items.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const script = join(root, 'scripts/review-items.mjs')

const run = (args = [], cwd = root) => {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}
const idsOf = (stdout) => [...stdout.matchAll(/^(R\d+)\s{2}/gm)].map((m) => m[1])

test('06020a4~1..06020a4 triggers the Go home modal dialog check (and test check), without unrelated index.js items', () => {
  const { status, stdout, stderr } = run(['06020a4~1', '06020a4'])
  assert.equal(status, 0, stderr)
  assert.match(stdout, /no REVIEW\.md; using working tree REVIEW\.md/)
  const ids = idsOf(stdout)
  assert.ok(ids.includes('R4'), `expected R4 (Go home dialog), got: ${ids.join(', ')}\n${stdout}`)
  assert.ok(ids.includes('R13'), `expected R13 (tests), got: ${ids.join(', ')}\n${stdout}`)
  for (const noise of ['R1', 'R2', 'R3', 'R6', 'R8', 'R9', 'R14', 'R15', 'R16', 'R18', 'R19']) {
    assert.ok(!ids.includes(noise), `unexpected ${noise} on Go home dialog commit:\n${stdout}`)
  }
  assert.match(stdout, /06020a4/)
  assert.match(stdout, /role="dialog"/)
})

test('267dbcd~1..267dbcd triggers the sound first-tap/resume check and the chute/round-pool release check', () => {
  const { status, stdout, stderr } = run(['267dbcd~1', '267dbcd'])
  assert.equal(status, 0, stderr)
  const ids = idsOf(stdout)
  assert.ok(ids.includes('R1'), `expected R1 (sound first tap & resume), got: ${ids.join(', ')}\n${stdout}`)
  assert.ok(ids.includes('R6'), `expected R6 (slide chute & round pool exit), got: ${ids.join(', ')}\n${stdout}`)
  assert.ok(ids.includes('R13'), `expected R13 (tests), got: ${ids.join(', ')}\n${stdout}`)
  for (const noise of ['R2', 'R3', 'R4', 'R7', 'R10', 'R11', 'R19']) {
    assert.ok(!ids.includes(noise), `unexpected ${noise} on 267dbcd:\n${stdout}`)
  }
  assert.match(stdout, /267dbcd/)
})

test('docs-only commit 94bf77c~1..94bf77c triggers no review items', () => {
  const { status, stdout, stderr } = run(['94bf77c~1', '94bf77c'])
  assert.equal(status, 0, stderr)
  assert.deepEqual(idsOf(stdout), [], `expected zero items on docs-only commit:\n${stdout}`)
  assert.match(stdout, /no review items triggered/)
})

test('other real past incidents trigger their matching items', () => {
  // seat panel focus and Tab order
  const seat = run(['1127f9e~1', '1127f9e'])
  assert.equal(seat.status, 0, seat.stderr)
  assert.ok(idsOf(seat.stdout).includes('R3'), `expected R3 on 1127f9e:\n${seat.stdout}`)

  // pointer tap vs drag 6 px rule + shared packages/ check against jelly
  const view = run(['a75d484~1', 'a75d484'])
  assert.equal(view.status, 0, view.stderr)
  assert.ok(idsOf(view.stdout).includes('R8'), `expected R8 on a75d484:\n${view.stdout}`)
  assert.ok(idsOf(view.stdout).includes('R10'), `expected R10 on a75d484:\n${view.stdout}`)

  // seeded determinism
  const det = run(['ccedfec~1', 'ccedfec'])
  assert.equal(det.status, 0, det.stderr)
  assert.ok(idsOf(det.stdout).includes('R11'), `expected R11 on ccedfec:\n${det.stdout}`)

  // nothing loaded from site root
  const base = run(['e0b359f~1', 'e0b359f'])
  assert.equal(base.status, 0, base.stderr)
  assert.ok(idsOf(base.stdout).includes('R12'), `expected R12 on e0b359f:\n${base.stdout}`)
})

test('reads REVIEW.md from base branch so a diff cannot edit away its own checks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-items-'))
  try {
    const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
    git(['init'])
    git(['config', 'user.email', 'test@example.com'])
    git(['config', 'user.name', 'Test'])
    writeFileSync(join(dir, 'REVIEW.md'), [
      '# Review Checklist',
      '',
      '### R1 — Guard critical file',
      '- **Paths:** `src/*.js`',
      '- **Diff:** `/\\bsecret\\b/`',
      '- **Check:** Verify secret handling stays safe.',
      '- **Source:** `0000000` (fixture)',
      '',
    ].join('\n'))
    writeFileSync(join(dir, 'src-placeholder'), '')
    writeFileSync(join(dir, 'a.js'), 'export const x = 1\n')
    git(['add', '.'])
    git(['commit', '-m', 'base'])

    // Second commit touches src/app.js with "secret" AND empties REVIEW.md on the branch & working tree
    execFileSync('mkdir', ['-p', join(dir, 'src')])
    writeFileSync(join(dir, 'src/app.js'), 'export const secret = true\n')
    writeFileSync(join(dir, 'REVIEW.md'), '# Review Checklist\n\n## Items\n')
    git(['add', '.'])
    git(['commit', '-m', 'try to weaken checklist'])

    const res = run(['HEAD~1', 'HEAD'], dir)
    assert.equal(res.status, 0, res.stderr)
    assert.doesNotMatch(res.stdout, /using working tree REVIEW\.md/)
    assert.deepEqual(idsOf(res.stdout), ['R1'])
    assert.match(res.stdout, /Verify secret handling stays safe\./)

    // Restore checklist, then change only a non-secret line in src/app.js while putting "secret" in another file
    writeFileSync(join(dir, 'REVIEW.md'), [
      '# Review Checklist',
      '',
      '### R1 — Guard critical file',
      '- **Paths:** `src/*.js`',
      '- **Diff:** `/\\bsecret\\b/`',
      '- **Check:** Verify secret handling stays safe.',
      '- **Source:** `0000000` (fixture)',
      '',
    ].join('\n'))
    git(['add', 'REVIEW.md'])
    git(['commit', '-m', 'restore checklist'])

    writeFileSync(join(dir, 'src/app.js'), 'export const secret = true\nexport const ok = 2\n')
    writeFileSync(join(dir, 'other.txt'), 'secret again\n')
    git(['add', '.'])
    git(['commit', '-m', 'unrelated line in matched file and keyword in other file'])

    const isolated = run(['HEAD~1', 'HEAD'], dir)
    assert.equal(isolated.status, 0, isolated.stderr)
    assert.deepEqual(idsOf(isolated.stdout), [], `should not fire on context or cross-file keyword:\n${isolated.stdout}`)

    // Removing the line containing "secret" from src/app.js must also fire
    writeFileSync(join(dir, 'src/app.js'), 'export const ok = 2\n')
    git(['add', 'src/app.js'])
    git(['commit', '-m', 'remove secret line'])

    const removed = run(['HEAD~1', 'HEAD'], dir)
    assert.equal(removed.status, 0, removed.stderr)
    assert.deepEqual(idsOf(removed.stdout), ['R1'], `should fire on removed line:\n${removed.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('observe mode always exits 0 even on an unknown ref', () => {
  const { status, stdout } = run(['nonexistent-ref-for-test', 'HEAD'])
  assert.equal(status, 0)
  assert.match(stdout, /observe mode/)
})

test('REVIEW.md has 15 to 30 real items with valid triggers and commits in git', () => {
  const text = readFileSync(join(root, 'REVIEW.md'), 'utf8')
  const sections = text.split(/^### /m).slice(1)
  assert.ok(sections.length >= 15 && sections.length <= 30, `expected 15..30 items, got ${sections.length}`)
  sections.forEach((sec, i) => {
    const id = sec.match(/^(R\d+)\s+[—–-]\s+(.+)$/m)
    assert.ok(id, `bad heading in item ${i + 1}`)
    assert.equal(id[1], `R${i + 1}`, `non-sequential id at index ${i}: ${id[1]}`)
    const paths = sec.match(/^- \*\*Paths:\*\*\s+(.+)$/m)
    assert.ok(paths && /`[^`]+`/.test(paths[1]), `${id[1]} missing Paths globs`)
    const diff = sec.match(/^- \*\*Diff:\*\*\s+`([^`]+)`$/m)
    if (diff) {
      const m = diff[1].match(/^\/([\s\S]+)\/([dgimsuvy]*)$/)
      assert.doesNotThrow(() => new RegExp(m ? m[1] : diff[1], m ? m[2] : ''), `${id[1]} invalid Diff regex`)
    }
    assert.match(sec, /^- \*\*Check:\*\*\s+\S+/m, `${id[1]} missing Check`)
    const src = sec.match(/^- \*\*Source:\*\*\s+(.+)$/m)
    assert.ok(src, `${id[1]} missing Source`)
    const hashes = [...src[1].matchAll(/`([0-9a-f]{7,40})`/g)].map((m) => m[1])
    assert.ok(hashes.length > 0, `${id[1]} Source missing commit hash: ${src[1]}`)
    for (const h of hashes) execFileSync('git', ['cat-file', '-e', `${h}^{commit}`], { cwd: root })
  })
})
