import assert from 'node:assert/strict';
import test from 'node:test';
import { computeFlipMorphWeights, buildBookSpreads, BOOK_TAB_DEFS } from '../src/sanctuary/book.js';
import { createLogbook } from '../src/pool/logbook.js';
import { createSanctuaryLoop } from '../src/sanctuary/sanctuary-loop.js';

test('4-key page-flip morph weights hit exact keyframes and stay C0-continuous without collapse', () => {
  assert.deepEqual(computeFlipMorphWeights(0.0), [0, 0, 0, 0]);
  assert.deepEqual(computeFlipMorphWeights(0.25), [1, 0, 0, 0]);
  assert.deepEqual(computeFlipMorphWeights(0.50), [0, 1, 0, 0]);
  assert.deepEqual(computeFlipMorphWeights(0.75), [0, 0, 1, 0]);
  assert.deepEqual(computeFlipMorphWeights(1.00), [0, 0, 0, 1]);

  let prev = computeFlipMorphWeights(0);
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const w = computeFlipMorphWeights(t);
    assert.equal(w.length, 4);
    const sum = w[0] + w[1] + w[2] + w[3];
    for (const v of w) assert.ok(v >= 0 && v <= 1, `weight out of range at t=${t}: ${v}`);
    if (t >= 0.25) {
      // On [0.25, 1.0], sum(w) == 1 guarantees Basis cancels cleanly between adjacent curved keyframes
      assert.ok(Math.abs(sum - 1) < 1e-9, `expected sum=1 at t=${t}, got ${sum}`);
    }
    const maxDelta = Math.max(...w.map((val, k) => Math.abs(val - prev[k])));
    assert.ok(maxDelta <= 0.05, `discontinuous morph jump ${maxDelta} at t=${t}`);
    prev = w;
  }
});

test('diegetic 3D book spreads index all 4 tabs continuously and reflect custom ducks & logbook', () => {
  const logbook = createLogbook(null);
  const loop = createSanctuaryLoop(null);
  loop.addCustomDuck({ dataUrl: 'data:image/png;base64,AAAA', hex: '#286d66', name: '테스트 수채화 덕', timestamp: 100 });
  loop.recordRoast(0.72, 200);

  const { spreads, tabStarts } = buildBookSpreads({ logbook, loop });
  assert.equal(BOOK_TAB_DEFS.length, 4);
  assert.equal(tabStarts.ducks, 0);
  assert.equal(tabStarts.atelier, 3);
  assert.ok(tabStarts.collectibles > tabStarts.atelier);
  assert.ok(tabStarts.stamps > tabStarts.collectibles);

  // Continuous odd/even page numbering across the entire bound volume
  for (let i = 0; i < spreads.length; i++) {
    assert.equal(spreads[i].leftPageNum, i * 2 + 1);
    assert.equal(spreads[i].rightPageNum, i * 2 + 2);
  }

  const atelierSpread = spreads[tabStarts.atelier];
  assert.equal(atelierSpread.tab, 'atelier');
  assert.equal(atelierSpread.activeCustom?.name, '테스트 수채화 덕');
  assert.ok(atelierSpread.unlocks.golden_smore !== null);
});
