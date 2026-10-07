import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { shouldOpenCraftFromTab } from './ui.ts';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('accessible game shell', () => {
  it('keeps objective and inventory information available at narrow widths', () => {
    assert.doesNotMatch(styles, /\.objective-panel\s*\{\s*display:\s*none/);
    assert.doesNotMatch(styles, /\.inventory-strip\s*\{\s*display:\s*none/);
    assert.match(styles, /\.objective-panel \{ top: 126px; width: 220px;/);
    assert.match(styles, /\.objective-panel \{ top: 132px; left: 10px; width: min\(300px, calc\(100% - 20px\)\);/);
    assert.match(styles, /\.inventory-strip \{ bottom: 84px; max-width: calc\(100% - 24px\);[^}]*flex-wrap: wrap;/);
    assert.match(styles, /\.inventory-strip \{ bottom: 70px; max-width: calc\(100% - 12px\);/);
  });

  it('uses Tab for crafting only during unobstructed active gameplay', () => {
    assert.equal(shouldOpenCraftFromTab(true, false, false), true);
    assert.equal(shouldOpenCraftFromTab(true, false, true), false);

    for (const [name, activeGameplay, menuVisible] of [
      ['title', false, false],
      ['pause', false, false],
      ['settings', false, true],
      ['crafting', true, true],
      ['death', false, false],
      ['victory', false, false],
    ] as const) {
      assert.equal(shouldOpenCraftFromTab(activeGameplay, menuVisible, false), false, name);
    }
  });
});
