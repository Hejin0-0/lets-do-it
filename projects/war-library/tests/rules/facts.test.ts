import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CAMPAIGN } from '../../src/ui/words.ts'

// SPEC-AAA H-08: every historical statement stands on a row of docs/history/FACTS.md.
const ledger = readFileSync(new URL('../../docs/history/FACTS.md', import.meta.url), 'utf8')
const known = new Set([...ledger.matchAll(/^\| (F\d{2}) \|/gm)].map((m) => m[1]))

test('facts: every campaign chapter cites the ledger, and every cited ID exists', () => {
  assert.ok(known.size >= 10, `ledger has ${known.size} rows`)
  for (const ch of CAMPAIGN.chapters) {
    assert.ok(ch.facts.length > 0, `${ch.head} cites no facts`)
    for (const id of ch.facts) assert.ok(known.has(id), `${ch.head} cites ${id}, not in FACTS.md`)
  }
  const words = readFileSync(new URL('../../src/ui/words.ts', import.meta.url), 'utf8')
  for (const [id] of words.matchAll(/\bF\d{2}\b/g)) assert.ok(known.has(id), `words.ts cites ${id}, not in FACTS.md`)
})

test('campaign: eight ends, one for each way the three nights fall', () => {
  const ends = new Set<string>()
  for (let m = 0; m < 8; m++) ends.add(CAMPAIGN.ending([!!(m & 4), !!(m & 2), !!(m & 1)]))
  assert.equal(ends.size, 8)
})
