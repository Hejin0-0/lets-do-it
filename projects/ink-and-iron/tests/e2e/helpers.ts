// Shared driving code for the e2e suite: boot, wait for the table, and play orders through REAL
// canvas clicks at the pixels the game reports for each hex (hooks only answer questions; every
// order goes through the mouse or keyboard, like a player's would).
import type { Page } from '@playwright/test'

export type Act =
  | { t: 'move'; unit: string; to: number } | { t: 'assault' | 'fire' | 'cut'; unit: string; target: number }
  | { t: 'pivot'; unit: string; facing: number } | { t: 'barrage'; target: number; shell: string }
  | { t: 'creep' | 'sluice' | 'endOrders' }

export interface Diag {
  frame: number; round: number; phase: string; mode: string; ordersLeft: number; selected: string | null
  morale: Record<string, number>; winner: string | null; busy: boolean; aiMs: number; lastFeedbackMs: number
  intents: number; objectives: { hex: number; holder: string | null }[]
  renderer: { calls: number; triangles: number }
}

export async function boot(page: Page, errors: string[], url = '/'): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url)
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 60_000 })
  // "Click to wake the table" (DESIGN §7): the first real click is the wake gesture (it unlocks
  // audio and dismisses the title card) and is consumed by it. Spend it off the board, as a
  // player's first click is.
  await page.mouse.click(6, 360)
  await page.waitForTimeout(300)
}

export const diag = (page: Page): Promise<Diag> =>
  page.evaluate(() => (window as unknown as { __THREE_GAME_DIAGNOSTICS__: Diag }).__THREE_GAME_DIAGNOSTICS__)

export const hook = <T>(page: Page, fn: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(({ fn, args }) => {
    const h = (window as unknown as { __THREE_GAME_TEST_HOOKS__: Record<string, (...a: unknown[]) => unknown> }).__THREE_GAME_TEST_HOOKS__
    return h[fn](...args) as T
  }, { fn, args })

export async function waitIdle(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForTimeout(120) // let a just-started animation reach the diagnostics
  await page.waitForFunction(() => {
    const d = (window as unknown as { __THREE_GAME_DIAGNOSTICS__?: { busy: boolean; phase: string } }).__THREE_GAME_DIAGNOSTICS__
    return !!d && !d.busy && (d.phase === 'player-orders' || d.phase === 'over')
  }, null, { timeout })
}

export async function clickHex(page: Page, hex: number, delayMs = 0): Promise<void> {
  const p = await hook<{ x: number; y: number }>(page, 'hexScreen', hex)
  await page.mouse.move(p.x, p.y)
  if (delayMs) await page.waitForTimeout(delayMs)
  await page.mouse.click(p.x, p.y)
  await page.waitForTimeout(80) // diagnostics are republished once a frame
}

interface Unit { id: string; hex: number; facing: number; str: number }

// Carry out one suggested action with real input. Returns false when the action has no input
// path yet (the caller skips it and asks the AI for the next one).
export async function perform(page: Page, a: Act, delayMs = 0): Promise<boolean> {
  const s = await hook<{ units: Unit[] }>(page, 'getState')
  const d = await diag(page)
  if (a.t === 'endOrders') {
    await page.keyboard.press('Space')
    await page.waitForTimeout(150)
    const d2 = await diag(page)
    if (d2.phase === 'player-orders' && d2.round === d.round && !d2.busy) await page.keyboard.press('Space') // "ring anyway"
    return true
  }
  if (a.t === 'barrage') {
    await page.keyboard.press('b') // lays the battery (ui/Keys.ts); the next hex click fires it
    await clickHex(page, a.target, delayMs)
    return true
  }
  if (!('unit' in a)) return false // creep / sluice have no input path yet
  const u = s.units.find((x) => x.id === a.unit)
  if (!u) return false
  if (d.selected !== a.unit) await clickHex(page, u.hex, delayMs)
  if (a.t === 'pivot') {
    const steps = ((a.facing - u.facing) + 6) % 6
    const key = steps <= 3 ? 'e' : 'q'
    for (let i = 0; i < (steps <= 3 ? steps : 6 - steps); i++) await page.keyboard.press(key)
    return true
  }
  await clickHex(page, a.t === 'move' ? a.to : 'target' in a ? a.target : u.hex, delayMs)
  return true
}
