import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Reuse an installed Playwright Core; it is QA tooling, not a game dependency.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require(process.env.INKBOUND_PLAYWRIGHT_MODULE || 'playwright-core'));
} catch {
  throw new Error('Browser QA requires Playwright Core. Set INKBOUND_PLAYWRIGHT_MODULE to an existing installation.');
}
const base = process.env.INKBOUND_BASE_URL || 'http://127.0.0.1:4173';
const executablePath = process.env.INKBOUND_CHROME
  || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] });
const results = [];

async function withScenario(scenario, action, { width = 1920, freeze = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height: width === 320 ? 720 : 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/?test&capture=1&scenario=${scenario}${freeze ? '&freeze=1' : ''}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.dataset.gameReady === 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${scenario}: horizontal overflow`);
    assert.equal(await page.locator('.hotbar').isVisible(), true);
    assert.equal(await page.locator('.objective-panel').isVisible(), true);
    const evidence = await action(page);
    assert.deepEqual(errors, [], `${scenario}: console diagnostics`);
    results.push({ scenario, width, evidence, errors });
  } finally {
    await page.close();
  }
}

try {
  for (const scenario of ['lineup', 'coast', 'night', 'boss', 'victory']) {
    await withScenario(scenario, async (page) => ({ ...await page.evaluate(() => ({ ...document.body.dataset })) }));
  }
  for (const width of [1024, 768, 320]) {
    await withScenario('lineup', async (page) => ({ canvas: await page.locator('#game-canvas').boundingBox() }), { width });
  }
  await withScenario('save', async (page) => {
    await page.keyboard.press('Tab');
    await page.waitForSelector('#craft-panel.is-open');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'craft-close');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-craft')), 'axe');
    await page.locator('[data-craft="spear"]').click();
    await page.waitForFunction(() => document.body.dataset.missionStage === 'shelter');
    assert.equal(await page.locator('#wood-count').innerText(), '1');
    assert.equal(await page.locator('#stone-count').innerText(), '1');
    assert.equal(await page.locator('#fiber-count').innerText(), '1');
    return { crafting: 'spear paid for and advanced mission', nativeKeyboardFocus: true };
  });
  await withScenario('save', async (page) => {
    await page.keyboard.press('Digit5');
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(() => document.querySelector('#interaction-prompt')?.textContent?.includes('PLACE STRUCTURE'));
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => document.body.dataset.structureCount === '2');
    assert.equal(await page.locator('#wood-count').innerText(), '0');
    assert.equal(await page.locator('#fiber-count').innerText(), '2');
    return { rotatedFoundation: 'placed once, materials paid', structures: 2 };
  });
  await withScenario('tame', async (page) => {
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => document.querySelector('#comic-impact')?.textContent === 'BONDED!');
    await page.waitForFunction(() => document.querySelector('#berries-count')?.textContent === '2');
    assert.equal(await page.locator('#berries-count').innerText(), '2');
    await page.keyboard.press('KeyR');
    await page.waitForFunction(() => document.querySelector('#comic-impact')?.textContent === 'STAY');
    return { thirdFeed: 'bonded with one berry', companionCommand: 'stay' };
  });
  await withScenario('combat', async (page) => {
    assert.equal(await page.getAttribute('body', 'data-mission-stage'), 'hunt');
    const phases = new Set();
    const health = [];
    for (let index = 0; index < 30; index += 1) {
      phases.add(await page.locator('#encounter-state').innerText());
      health.push(Number(await page.locator('#health-value').innerText()));
      await page.waitForTimeout(250);
    }
    assert.ok(health.some((value) => value < 100), 'live apex must approach and damage the player');
    assert.ok(phases.size >= 3, 'attack phases must be visible before and after contact');
    return { phases: [...phases], health };
  }, { freeze: false });
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await browser.close();
}
