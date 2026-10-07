import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readStored, removeStored, writeStored } from './index.ts'

const g = globalThis as { localStorage?: unknown }

test('storage: round-trips through a working localStorage', () => {
  const m = new Map<string, string>()
  g.localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
  assert.equal(writeStored('k', '{"a":1}'), true)
  assert.deepEqual(readStored('k', (t) => JSON.parse(t ?? 'null'), null), { a: 1 })
  assert.equal(removeStored('k'), true)
  assert.equal(readStored('k', (t) => t, 'fallback'), null)
})

test('storage: a blocked or missing localStorage falls back and never throws', () => {
  g.localStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('blocked') } }
  assert.equal(readStored('k', (t) => t, 'fallback'), 'fallback')
  assert.equal(writeStored('k', 'x'), false)
  assert.equal(removeStored('k'), false)
  delete g.localStorage
  assert.equal(readStored('k', (t) => t, 'none'), 'none')
  assert.equal(readStored('k', () => { throw new Error('bad save') }, 'none'), 'none')
})
