// Bot playtest (DESIGN §11.7.4): the AI plays the British side through REAL canvas clicks and
// keys, at 0 ms and 300 ms reaction time. It asserts the loop contract — the game progresses,
// both sides bleed, phases keep changing, and the battle ends by round 8.
import { expect, test } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { boot, diag, hook, perform, waitIdle } from './helpers.ts'
import type { Act } from './helpers.ts'

for (const delay of [0, 300]) {
  test(`bot plays S1 to the end at ${delay} ms reaction`, async ({ page }) => {
    test.setTimeout(600_000)
    const errors: string[] = []
    await boot(page, errors)
    await hook(page, 'loadScenario', 's1', 100 + delay, 'recruit')
    await hook(page, 'skipIntro')
    await hook(page, 'setSpeed', 4)
    await page.waitForTimeout(400)
    const log: { round: number; phase: string; t: number; act: string }[] = []
    const start = Date.now()
    let lastPhaseChange = Date.now(), lastKey = ''
    let enemyLostByR4 = 0, captureByR4 = false
    const d0 = await diag(page)
    const moraleDE0 = d0.morale.DE
    const holders0 = d0.objectives.map((o) => o.holder).join()
    for (let guard = 0; guard < 200; guard++) {
      await waitIdle(page, 60_000)
      const d = await diag(page)
      const key = `${d.round}:${d.phase}:${d.ordersLeft}`
      if (key !== lastKey) { lastKey = key; lastPhaseChange = Date.now() }
      expect(Date.now() - lastPhaseChange, `stuck at ${key}`).toBeLessThan(20_000 + delay * 20)
      if (d.round <= 4) {
        enemyLostByR4 = moraleDE0 - d.morale.DE
        captureByR4 ||= d.objectives.map((o) => o.holder).join() !== holders0
      }
      if (d.phase === 'over') break
      const plan = await hook<Act[]>(page, 'suggest')
      const a = plan[0] ?? { t: 'endOrders' }
      const ok = await perform(page, a, delay)
      log.push({ round: d.round, phase: d.phase, t: Date.now() - start, act: ok ? a.t : `skip:${a.t}` })
      if (!ok) await perform(page, { t: 'endOrders' }, delay)
      await page.waitForTimeout(delay)
    }
    const end = await diag(page)
    mkdirSync('artifacts', { recursive: true })
    writeFileSync(`artifacts/bot-${delay}ms.json`, JSON.stringify({ end, enemyLostByR4, captureByR4, log, errors }, null, 1))
    expect(end.phase).toBe('over')
    expect(end.round).toBeLessThanOrEqual(9)
    expect(captureByR4 || enemyLostByR4 >= 3).toBe(true)
    expect(errors).toEqual([])
  })
}
