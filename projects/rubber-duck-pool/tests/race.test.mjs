// A race of three ducks on each handoff seed runs to an ordered result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';

for (const seed of [3,5,7]) test(`race runs to an ordered result for seed ${seed}`, () => {
  const W=createWorld({seed,ducks:3,arrivals:false});
  W.startRace(W.ducks.map(d=>d.id));
  while(W.race.running) W.step(120);
  const {results,t}=W.race, finishers=results.filter(r=>r.time!==null);
  assert.equal(results.length,3); assert.ok(finishers.length>0); assert.ok(t<=601);
  finishers.forEach((r,i)=>{ assert.equal(r.place,i+1); assert.ok(r.time>20 && r.time<=t); if(i) assert.ok(r.time>=finishers[i-1].time); });
  assert.ok(results.slice(finishers.length).every(r=>r.place===null&&r.time===null));
  assert.ok(W.events.some(e=>e.type==='raceEnd'));
  console.log(`race seed ${seed}: ${JSON.stringify(results)}`);
});
