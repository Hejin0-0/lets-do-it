import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSanctuaryLoop,
  classifyRoastTier,
  hearthUnlockForToast,
  ROAST_TIERS,
  MAX_CUSTOM_DUCKS,
  SANCTUARY_LOOP_KEY,
} from '../src/sanctuary/sanctuary-loop.js';
import { TOOL_ICONS, SLIDER_ICONS, BRUSH_VISUALS, PALETTE_DAB_SVG } from '../src/sanctuary/brush-icons.js';

function memoryStore(initial = null) {
  const map = new Map(initial ? [[SANCTUARY_LOOP_KEY, initial]] : []);
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    raw: () => map.get(SANCTUARY_LOOP_KEY),
  };
}

test('brush icon visuals cover all 4 tools, 10 watercolor brushes, sliders, and organic palette dab', () => {
  for (const id of ['brush', 'water', 'pen', 'lift']) {
    assert.ok(TOOL_ICONS[id]?.svg.includes('<svg'), `tool ${id} has svg icon`);
  }
  for (const id of ['size', 'water', 'load']) {
    assert.ok(SLIDER_ICONS[id]?.includes('<svg'), `slider ${id} has svg icon`);
  }
  const expectedBrushes = ['round', 'detail', 'flat', 'hake', 'mop', 'dry', 'fan', 'sponge', 'spatter', 'sumi'];
  for (const id of expectedBrushes) {
    const v = BRUSH_VISUALS[id];
    assert.ok(v, `visual entry exists for brush ${id}`);
    assert.ok(v.toolSvg.includes('<svg'), `brush ${id} has tool silhouette svg`);
    assert.ok(v.strokeSvg.includes('<svg'), `brush ${id} has stroke preview svg`);
  }
  assert.ok(PALETTE_DAB_SVG.includes('<svg'), 'palette dab svg exists');
});

test('custom watercolor duck archive persists, caps at MAX_CUSTOM_DUCKS, and recovers from corrupt storage', () => {
  const store = memoryStore();
  const loop = createSanctuaryLoop(store);

  for (let i = 1; i <= MAX_CUSTOM_DUCKS + 2; i++) {
    const added = loop.addCustomDuck({
      dataUrl: `data:image/jpeg;base64,test${i}`,
      hex: '#2338a8',
      timestamp: 1000 + i,
    });
    assert.equal(added.id, `atelier-${i}`);
  }

  assert.equal(loop.customDucks.length, MAX_CUSTOM_DUCKS);
  assert.equal(loop.customDucks[0].seq, MAX_CUSTOM_DUCKS + 2, 'newest painting first');
  assert.equal(loop.stats.customCreated, MAX_CUSTOM_DUCKS + 2);

  // Round-trip reload from storage
  const reloaded = createSanctuaryLoop(store);
  assert.equal(reloaded.customDucks.length, MAX_CUSTOM_DUCKS);
  assert.equal(reloaded.customDucks[0].id, `atelier-${MAX_CUSTOM_DUCKS + 2}`);

  // Corrupt storage falls back cleanly without throwing
  const broken = createSanctuaryLoop(memoryStore('{not-json'));
  assert.deepEqual(broken.customDucks, []);
});

test('campfire roasting classifies tiers and unlocks golden_smore and charred_ember once each', () => {
  assert.equal(classifyRoastTier(0.10), ROAST_TIERS.RAW);
  assert.equal(classifyRoastTier(0.45), ROAST_TIERS.TOASTY);
  assert.equal(classifyRoastTier(0.72), ROAST_TIERS.GOLDEN);
  assert.equal(classifyRoastTier(0.90), ROAST_TIERS.CHARRED);
  assert.equal(hearthUnlockForToast(0.50), null);
  assert.equal(hearthUnlockForToast(0.70), 'golden_smore');
  assert.equal(hearthUnlockForToast(0.92), 'charred_ember');

  const store = memoryStore();
  const loop = createSanctuaryLoop(store);

  const r1 = loop.recordRoast(0.40, 100);
  assert.equal(r1.newlyUnlocked, null);
  assert.equal(loop.hearthUnlocks.golden_smore, null);

  const r2 = loop.recordRoast(0.68, 200);
  assert.equal(r2.newlyUnlocked?.id, 'golden_smore');
  assert.equal(loop.stats.perfectRoasts, 1);

  // Re-hitting golden does not duplicate unlock or double-count
  const r3 = loop.recordRoast(0.75, 300);
  assert.equal(r3.newlyUnlocked, null);
  assert.equal(loop.stats.perfectRoasts, 1);

  const r4 = loop.recordRoast(0.91, 400);
  assert.equal(r4.newlyUnlocked?.id, 'charred_ember');

  const reloaded = createSanctuaryLoop(store);
  assert.equal(reloaded.hearthUnlocks.golden_smore, 200);
  assert.equal(reloaded.hearthUnlocks.charred_ember, 400);
});
