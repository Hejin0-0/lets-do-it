import assert from 'node:assert/strict'
import { buildLayout, placedBusinesses, signStyleOf } from '../src/world/placement.ts'

/**
 * Prompt 4, point 3:
 *
 *   "duplicate BAR signs — the BAR COLD BEER neon sign appears multiple times
 *    down the street. keep it on one building only. vary the other shopfronts
 *    with different signs."
 *
 * That was a screenshot finding, spotted in about a second by someone who was
 * not looking for it, after the shopfront prefab had been reused down the whole
 * block without anyone noticing. It is now a build failure instead of a thing
 * to remember.
 */

const layout = buildLayout()
const placed = placedBusinesses(layout)

const counts = new Map()
for (const b of placed) counts.set(b.id, (counts.get(b.id) ?? 0) + 1)

const dupes = [...counts.entries()].filter(([, n]) => n > 1)
assert.deepEqual(
  dupes,
  [],
  `the street advertises the same business twice: ${dupes
    .map(([id, n]) => `${id} x${n}`)
    .join(', ')}`,
)

assert.equal(
  counts.get('bar') ?? 0,
  1,
  'the bar is the hero neon sign and must appear exactly once',
)

assert.ok(placed.length >= 10, `only ${placed.length} shopfronts on the street`)

const neon = placed.filter((b) => b.neon).length
assert.ok(neon >= 3, `only ${neon} neon signs — the street needs more glow sources`)
assert.ok(neon <= placed.length - 3, 'every shopfront is neon; vary the signage')

/**
 * Five sign trades on the block, not one house style in 28 colours.
 *
 * The style comes from `hashId(id) % 4`, so it is a branch that can silently
 * collapse — rename a few businesses and every unlit sign could come out the
 * same trade with nothing to show for it but a duller street. Cheaper to assert
 * than to notice.
 */
const styles = new Map()
for (const b of placed) {
  const st = signStyleOf(b)
  styles.set(st, (styles.get(st) ?? 0) + 1)
}
for (const want of ['neon', 'painted', 'lightbox', 'vinyl', 'enamel']) {
  assert.ok(
    (styles.get(want) ?? 0) > 0,
    `no ${want} signs on the block — the trades collapsed to ` +
      `${[...styles.keys()].join(', ')}`,
  )
}

console.log(
  `signcount: ${placed.length} shopfronts, all distinct ` +
    `(${[...styles.entries()].map(([k, n]) => `${n} ${k}`).join(', ')})`,
)
console.log(`  ${placed.map((b) => b.id).join(' · ')}`)
