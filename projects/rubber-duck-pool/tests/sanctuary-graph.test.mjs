import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARRIVAL_INTERVAL_SEC,
  GUITAR_CHORDS,
  createSanctuaryGraph,
} from '../src/sanctuary/sanctuary-graph.js';
import { createLogbook } from '../src/pool/logbook.js';

function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test('duck renaming persists and triggers Placid Plastic Duck style ARG unlocks', () => {
  const store = memoryStore();
  const g = createSanctuaryGraph({ store, seed: 101 });

  const normal = g.renameDuck('Duck_01', 'Biscuit', 'en');
  assert.equal(normal.ok, true);
  assert.equal(normal.name, 'Biscuit');
  assert.equal(normal.argUnlocked, null);

  const arg = g.renameDuck('Duck_02', 'kitsune', 'en');
  assert.equal(arg.ok, true);
  assert.equal(arg.argUnlocked?.unlocks, '20-radio');
  assert.equal(arg.argUnlocked?.isNew, true);

  // Rehydrates custom names & unlocked ARG ducks from storage
  const reloaded = createSanctuaryGraph({ store, seed: 101 });
  assert.equal(reloaded.getDuckName('Duck_01', 'Fallback'), 'Biscuit');
  assert.ok(reloaded.getState().argDucks.includes('20-radio'));
});

test('30s coastal pier fishing connects directly into logbook collectibles, 3D hats, and bottle ARG clues', () => {
  const store = memoryStore();
  const logbook = createLogbook(null);
  const g = createSanctuaryGraph({ store, seed: 202 });

  // Cast -> wait -> bite -> reel #1 yields a real Maritime Collectible recorded in logbook!
  assert.equal(g.castLine().phase, 'waiting');
  let bitten = false;
  for (let i = 0; i < 80; i++) {
    const r = g.stepFishing(0.1);
    if (r.event === 'bite') { bitten = true; break; }
  }
  assert.equal(bitten, true);

  // Tactile multi-tap reeling: biting -> reeling -> catch!
  const t1 = g.reelLine({ logbook, lang: 'en' });
  assert.equal(t1.caught, false);
  assert.equal(t1.phase, 'reeling');
  const t2 = g.reelLine({ logbook, lang: 'en' });
  assert.equal(t2.caught, false);
  const c1 = g.reelLine({ logbook, lang: 'en' });
  assert.equal(c1.caught, true);
  assert.equal(c1.reward.kind, 'collectible');
  assert.ok(logbook.pages.some((p) => p.id === c1.reward.id && p.found));

  // Catch #2 yields a Message-in-a-Bottle clue readable in the Onsen Terminal
  const c2 = g.reelLine({ logbook, lang: 'en', forceCatch: true });
  assert.equal(c2.reward.kind, 'bottle_clue');
  const cluesOut = g.runTerminalCommand('CLUES', { lang: 'en' });
  assert.ok(cluesOut.lines.some((l) => l.includes('88.4')));

  // Catch #3 unlocks a wearable 3D hat that can be equipped onto a duck
  const c3 = g.reelLine({ logbook, lang: 'en', forceCatch: true });
  assert.equal(c3.reward.kind, 'hat');
  assert.equal(g.equipHat('Duck_01', c3.reward.id), c3.reward.id);
  assert.equal(g.getDuckHat('Duck_01'), c3.reward.id);
});

test('Onsen 1960s radio terminal tunes carriers, decodes ciphers, and unlocks unexpected ducks', () => {
  const g = createSanctuaryGraph({ seed: 303 });

  const scan = g.runTerminalCommand('SCAN', { lang: 'en' });
  assert.equal(scan.ok, true);
  assert.ok(scan.lines.some((l) => l.includes('104.2')));

  const tune = g.runTerminalCommand('TUNE 104.2', { lang: 'en' });
  assert.equal(tune.ok, true);
  assert.equal(tune.unlockedDuck, '23-mosaic');

  const dec = g.runTerminalCommand('DECODE ONSEN-7', { lang: 'en' });
  assert.equal(dec.ok, true);
  assert.equal(dec.unlockedDuck, '18-ramen');

  const wx = g.runTerminalCommand('WEATHER PETALS', { lang: 'en' });
  assert.equal(wx.ok, true);
  assert.equal(wx.weatherCmd, 'petals');

  const yz = g.runTerminalCommand('YUZU', { lang: 'ja' });
  assert.equal(yz.ok, true);
  assert.equal(yz.dropYuzu, true);

  assert.ok(g.getState().argDucks.includes('23-mosaic'));
  assert.ok(g.getState().argDucks.includes('18-ramen'));
  assert.ok(g.getState().edgesFired['terminal->weather'] >= 1);
});

test('Zeigarnik arrival timer drops an undiscovered duck deterministically and guitar chords register graph edges', () => {
  const g = createSanctuaryGraph({ seed: 404 });
  const half = g.tickArrival(ARRIVAL_INTERVAL_SEC * 0.5, ['01-classic']);
  assert.equal(half.arrived, null);
  assert.ok(half.progress >= 0.49 && half.progress <= 0.51);

  const drop = g.tickArrival(ARRIVAL_INTERVAL_SEC * 0.6, ['01-classic']);
  assert.ok(drop.arrived);
  assert.notEqual(drop.arrived.id, '01-classic');

  assert.equal(GUITAR_CHORDS.length, 6);
  const strum = g.recordGuitarStrum(2);
  assert.equal(strum.chord.id, 'Em');
  assert.equal(strum.totalStrums, 1);
  assert.ok(g.getState().activeEdgeCount >= 2);
});
