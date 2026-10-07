import { test } from 'node:test'
import assert from 'node:assert/strict'
import { campaignMods } from '../../src/game/Campaign.ts'

test('campaign: each result bends the next chapter, the first is unbent', () => {
  assert.deepEqual(campaignMods({ chapter: 0, won: [] }), { he: 0, morale: 0 })
  assert.deepEqual(campaignMods({ chapter: 1, won: [true] }), { he: 1, morale: 0 })
  assert.deepEqual(campaignMods({ chapter: 1, won: [false] }), { he: -1, morale: 0 })
  assert.deepEqual(campaignMods({ chapter: 2, won: [false, true] }), { he: 0, morale: 1 })
  assert.deepEqual(campaignMods({ chapter: 2, won: [true, false] }), { he: 0, morale: -1 })
})
