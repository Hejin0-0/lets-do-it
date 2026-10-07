// The campaign (SPEC-AAA P-02): the title card's link opens chapter I's card, a won night offers the
// next chapter with its bend (one shell more for Hush), and the chapter is remembered across a reload.
import { expect, test } from '@playwright/test'
import { diag, hook } from './helpers.ts'

test('campaign: title link → chapter I card → won night → chapter II with its bend, remembered', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 60_000 })
  await page.evaluate(() => localStorage.removeItem('ink-iron:campaign'))

  await page.getByRole('button', { name: 'The campaign: the Yser, 1917' }).click()
  await expect(page.locator('.ii-page.is-brief h2')).toHaveText('Chapter I · Strandfest · 10 July 1917')
  expect((await diag(page)).phase).toBe('player-orders')
  const he1 = await page.evaluate(() => (window as unknown as { __THREE_GAME_DIAGNOSTICS__: { shells: { BR: { he: number } } } }).__THREE_GAME_DIAGNOSTICS__.shells.BR.he)
  await page.getByRole('button', { name: 'To the table' }).click()

  await hook(page, 'setState', 'victory') // a won Strandfest (the fixture is S1, British victory)
  await expect(page.locator('.ii-history')).toContainText('What happened')
  await page.getByRole('button', { name: /Next: Chapter II/ }).click()
  await expect(page.locator('.ii-page.is-brief h2')).toHaveText('Chapter II · The Great Dune · August 1917')
  const d = await page.evaluate(() => (window as unknown as { __THREE_GAME_DIAGNOSTICS__: { scenario: string; shells: { BR: { he: number } } } }).__THREE_GAME_DIAGNOSTICS__)
  expect(d.scenario).toBe('s2')
  expect(he1).toBe(3)
  expect(d.shells.BR.he).toBe(8) // S2 starts with 7; Strandfest won adds one

  await page.reload()
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 60_000 })
  expect(await page.evaluate(() => localStorage.getItem('ink-iron:campaign'))).toBe('{"chapter":1,"won":[true]}')
  expect(errors).toEqual([])
})
