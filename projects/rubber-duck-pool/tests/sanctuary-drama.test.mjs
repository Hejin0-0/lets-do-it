import assert from 'node:assert/strict';
import test from 'node:test';
import { createDramaEngine, FIELD_REQUESTS, PAL_BOND_THRESHOLD } from '../src/sanctuary/drama-engine.js';
import { createSanctuaryGraph, COASTAL_SPECIES, HARMONY_SONGS } from '../src/sanctuary/sanctuary-graph.js';

function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}

test('drama engine bonds Pool Pals after 3 collisions and completes diegetic field requests', () => {
  const store = memoryStore();
  const d = createDramaEngine({ store });

  assert.equal(d.getState().palCount, 0);
  for (let i = 1; i < PAL_BOND_THRESHOLD; i++) {
    const r = d.recordCollision('Duck_01', 'Duck_02', 'Classic', 'Mint');
    assert.equal(r.newPal, null);
  }
  const bonded = d.recordCollision('Duck_01', 'Duck_02', 'Classic', 'Mint');
  assert.ok(bonded.newPal, 'third bump forms a Pool Pals bond');
  assert.equal(d.getPartnerForDuck('Duck_01'), 'Mint');
  assert.ok(bonded.completed.some((r) => r.id === 'req_pool_pals'));

  const yz = d.recordAction('yuzu');
  assert.ok(yz.completed.some((r) => r.id === 'req_yuzu_party'));
  d.recordAction('rename');
  const styled = d.recordAction('hat');
  assert.ok(styled.completed.some((r) => r.id === 'req_duck_style'));

  // Persists across reloads
  const d2 = createDramaEngine({ store });
  assert.equal(d2.getState().palCount, 1);
  assert.equal(d2.getState().completedRequests.length, 3);
  assert.equal(d2.getAllRequests('ko').length, FIELD_REQUESTS.length);
});

test('fishing bait crafting, multi-tap tactile reeling, species records, harmony progressions, shell shop & Pomodoro connect all graph loops', () => {
  const store = memoryStore();
  const g = createSanctuaryGraph({ store, seed: 5511 });

  // 1. Crafted bait + tactile reeling (biting -> reeling -> catch with cm/kg & shells!)
  g.addBait('smore', 2, 'campfire->fishing');
  assert.equal(g.selectBait('smore'), 'smore');
  const cast = g.castLine();
  assert.equal(cast.bait, 'smore');
  for (let i = 0; i < 80; i++) {
    if (g.stepFishing(0.1).event === 'bite') break;
  }
  assert.equal(g.getState().fishing.phase, 'biting');
  const tap1 = g.reelLine({ pump: 0.34 });
  assert.equal(tap1.caught, false);
  assert.equal(tap1.phase, 'reeling');
  g.stepFishing(0.1);
  const tap2 = g.reelLine({ pump: 0.34 });
  assert.equal(tap2.caught, false);
  const tap3 = g.reelLine({ pump: 0.34 });
  assert.equal(tap3.caught, true);
  assert.ok(tap3.catchInfo.cm > 0 && tap3.catchInfo.shells > 0);
  assert.ok(COASTAL_SPECIES.some((s) => s.id === tap3.catchInfo.speciesId));
  assert.ok(g.getState().bestCatch.cm >= tap3.catchInfo.cm);

  // 2. Campfire 4-chord harmony (G=0, D=1, Em=2, C=3 -> Twilight Lullaby -> unlocks 13-teapot!)
  g.recordGuitarStrum(0, 'en');
  g.recordGuitarStrum(1, 'en');
  g.recordGuitarStrum(2, 'en');
  const fin = g.recordGuitarStrum(3, 'en');
  assert.ok(fin.harmony, '4-chord progression recognized');
  assert.equal(fin.harmony.id, HARMONY_SONGS[0].id);
  assert.equal(fin.harmony.unlocksDuck, '13-teapot');
  assert.ok(g.getState().argDucks.includes('13-teapot'));

  // 3. Cozy Sea-Glass Shell Shop purchase
  const beforeShells = g.getState().shells;
  const buy = g.buyShellItem('pack_yuzu');
  assert.equal(buy.ok, true);
  assert.equal(buy.shells, beforeShells - 8);

  // 4. Spirit City Focus Pomodoro completion awards shells + mystery duck arrival
  g.startFocusTimer(25);
  const done = g.completeFocusSession(['01-classic']);
  assert.equal(done.completed, true);
  assert.ok(done.arrived && done.shellsAwarded === 25);
  assert.ok(g.getState().edgesFired['pomodoro->arrival'] >= 1);
  assert.ok(g.getState().edgesFired['guitar->harmony'] >= 1);
  assert.ok(g.getState().edgesFired['fishing->records'] >= 1);
});
