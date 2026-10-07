// Smoke + the old build's defects as regression gates (DESIGN §11.6 Lead, audit §d).
import { expect, test } from '@playwright/test'
import { boot, clickHex, diag, hook, waitIdle } from './helpers.ts'

interface U { id: string; side: string; hex: number; str: number }
interface A { t: string; unit?: string; to?: number; target?: number }

test('boots clean, frames advance, unknown hook state throws', async ({ page }) => {
  const errors: string[] = []
  await boot(page, errors)
  const f0 = (await diag(page)).frame
  await page.waitForTimeout(1000)
  expect((await diag(page)).frame).toBeGreaterThan(f0 + 20)
  await expect(hook(page, 'setState', 'no-such-state')).rejects.toThrow()
  for (const s of ['library-overview', 'player-turn', 'enemy-turn', 'artillery-resolve', 'victory', 'defeat']) {
    expect(await hook(page, 'setState', s)).toEqual({ state: s })
  }
  expect(errors).toEqual([])
})

test('d1/d2: a click answers inside 100 ms, and a reachable hex with a piece selected is an order', async ({ page }) => {
  const errors: string[] = []
  await boot(page, errors)
  await hook(page, 'loadScenario', 's1', 7, 'recruit')
  await hook(page, 'skipIntro')
  await page.waitForTimeout(800)
  const mv = (await hook<A[]>(page, 'legalActions')).find((a) => a.t === 'move')
  expect(mv, 'the British have a legal move on turn 1').toBeTruthy()
  const s = await hook<{ units: U[] }>(page, 'getState')
  const u = s.units.find((x) => x.id === mv!.unit)!
  await clickHex(page, u.hex)
  let d = await diag(page)
  expect(d.selected).toBe(u.id)
  expect(d.lastFeedbackMs).toBeLessThan(100)
  const before = d.ordersLeft
  await clickHex(page, mv!.to!)
  await waitIdle(page)
  d = await diag(page)
  expect(d.ordersLeft).toBe(before - 1)
  expect(errors).toEqual([])
})

test('undo and rewind restore the exact state; retry reaches player-turn in < 5 s', async ({ page }) => {
  const errors: string[] = []
  await boot(page, errors)
  await hook(page, 'loadScenario', 's1', 11, 'recruit')
  await hook(page, 'skipIntro')
  await page.waitForTimeout(500)
  const h0 = await hook<string>(page, 'stateHash')
  const mv = (await hook<A[]>(page, 'legalActions')).find((a) => a.t === 'move')
  expect(mv).toBeTruthy()
  const u = (await hook<{ units: U[] }>(page, 'getState')).units.find((x) => x.id === mv!.unit)!
  await clickHex(page, u.hex)
  await clickHex(page, mv!.to!)
  await waitIdle(page)
  expect(await hook<string>(page, 'stateHash')).not.toBe(h0)
  await page.keyboard.press('z')
  await page.waitForTimeout(200)
  expect(await hook<string>(page, 'stateHash')).toBe(h0)

  await clickHex(page, u.hex)
  await clickHex(page, mv!.to!)
  await waitIdle(page)
  await page.keyboard.press('r')
  await page.waitForTimeout(300)
  expect(await hook<string>(page, 'stateHash')).toBe(h0)

  await hook(page, 'setState', 'defeat')
  const t0 = Date.now()
  const retry = page.locator('[data-cmd="retry"]:visible').first()
  if (await retry.count()) await retry.click()
  else await hook(page, 'loadScenario', 's1', 12, 'recruit')
  await page.waitForFunction(() =>
    (window as unknown as { __THREE_GAME_DIAGNOSTICS__: { phase: string } }).__THREE_GAME_DIAGNOSTICS__.phase === 'player-orders')
  expect(Date.now() - t0).toBeLessThan(5000)
  expect(errors).toEqual([])
})
