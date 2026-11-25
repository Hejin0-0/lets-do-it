import assert from 'node:assert/strict';
import test from 'node:test';
import { createLogbook } from '../src/pool/logbook.js';
import { DESIGNS } from '../src/pool/ducks.js';
import { createSanctuaryPhysics } from '../src/sanctuary/physics.js';
import { createLogbookSync } from '../src/sanctuary/logbook-sync.js';

test('sanctuary ducks, hats, slide runs, and completed circuits sync live into shared logbook', () => {
  const logbook = createLogbook(null);
  const physics = createSanctuaryPhysics({ seed: 19, mode: 'circuit' });
  const sync = createLogbookSync({ logbook });

  const duckEntries = [];
  const ordinaryHats = ['party', 'tophat', 'crown', 'shades', 'bowtie', 'flower', 'pirate'];
  for (let i = 0; i < 12; i++) {
    const d = DESIGNS[i];
    const id = `Duck_${i}`;
    const physPose = physics.addDuck({ id, designId: d.id, name: d.label, u: (i / 12) * 0.92 });
    duckEntries.push({
      id,
      designId: d.id,
      name: d.label,
      hatId: ordinaryHats[i % ordinaryHats.length],
      physPose,
      obj: { visible: true },
    });
  }

  // Before syncing, designs and stamps in the shared logbook are all unseen
  assert.equal(logbook.designs.slice(0, 12).every((d) => !d.seen), true);

  let simTime = 0;
  for (let step = 0; step < 65 * 60; step++) {
    simTime += 1 / 60;
    const evs = physics.step(1 / 60, simTime, { night: 0.2 });
    sync.step(1 / 60, { simTime, simHour: 18.2, duckEntries, physEvents: evs });
  }
  sync.flush(simTime);

  assert.equal(
    logbook.designs.slice(0, 12).every((d) => d.seen),
    true,
    'all 12 classic designs swimming in the sanctuary are marked seen in logbook'
  );
  assert.equal(
    logbook.stamps.find((s) => s.id === 'all-designs')?.earned,
    true,
    'all-designs collector stamp is earned'
  );
  assert.equal(
    logbook.stamps.find((s) => s.id === 'all-hats')?.earned,
    true,
    'all-hats collector stamp is earned when all 7 ordinary hats are worn'
  );
  assert.equal(
    logbook.stamps.find((s) => s.id === 'first-slide')?.earned,
    true,
    'first-slide stamp is earned when a sanctuary duck rides the copper flume'
  );
  assert.ok(logbook.records.mostLaps >= 1, 'completed sanctuary hydro-loop laps update mostLaps');
  assert.ok(logbook.records.bestLap !== null && logbook.records.bestLap > 0, 'bestLap time is recorded in seconds');
});
