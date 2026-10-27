import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';

test('ducks expose play statistics and race controls', () => {
  const W = createWorld({ seed: 3, ducks: 3, arrivals: false });
  assert.deepEqual(W.ducks[0].stats, { slides: 0, lifts: 0, laps: 0, bestLap: null, lastLap: null, flights: 0, seaTrips: 0, rescued: 0 });
  W.startRace(W.ducks.map(d => d.id));
  assert.equal(W.race.running, true);
  assert.equal(W.events.at(-1).type, 'raceStart');
  W.hand.grab(W.ducks[0].body);
  assert.equal(W.race.results.find(r => r.id === W.ducks[0].id).time, null);
});

import { isleSd } from '../src/pool/island.js';
import { P } from '../src/pool/layout.js';

test('race restart discards prior results and pickup removes a racer', () => {
  const W = createWorld({seed:5, ducks:3, arrivals:false});
  const ids=W.ducks.map(d=>d.id);
  W.startRace(ids); W.step(120); W.hand.grab(W.ducks[0].body);
  assert.equal(W.race.results.find(r=>r.id===ids[0]).time,null);
  W.hand.throw(W.ducks[0].body,[0,0,0]);
  assert.equal(W.startRace(ids.slice(1)),true);
  assert.equal(W.race.t,0); assert.deepEqual(W.race.ids,ids.slice(1));
  assert.ok(W.race.results.every(r=>r.place===null && r.time===null));
});

test('forty ducks record rides and genuine slide-to-slide lap times', () => {
  const W=createWorld({seed:3,ducks:40,arrivals:false}), starts=new Map();
  let laps=0;
  for(let i=0;i<120*240;i++) {
    const before=new Map(W.ducks.map(d=>[d.id,d.state])); W.events.length=0; W.step();
    for(const d of W.ducks) if(d.state==='slide' && before.get(d.id)!=='slide') {
      const e=W.events.find(e=>e.type==='lap'&&e.id===d.id);
      if(e) { assert.ok(Math.abs(e.time-(W.time-1/120-starts.get(d.id)))<1e-7); laps++; }
      starts.set(d.id,W.time-1/120);
    }
  }
  assert.ok(W.ducks.reduce((n,d)=>n+d.stats.slides,0)>20);
  assert.ok(W.ducks.reduce((n,d)=>n+d.stats.lifts,0)>20);
  assert.ok(laps>0); assert.equal(W.ducks.reduce((n,d)=>n+d.stats.laps,0),laps);
});

test('a stranded flyer is collected over water and returned to the pool', () => {
  const W=createWorld({seed:3,ducks:0,arrivals:false}), d=W.addFlyer();
  for(let i=0;i<120*400 && d.state!=='sea';i++) W.step();
  assert.equal(d.state,'sea'); assert.ok(isleSd(d.body.p[0],d.body.p[2])>0);
  assert.ok(W.events.some(e=>e.type==='escaped'&&e.id===d.id));
  const other=W.addFlyer(), at=[-4,P.SEA,10];
  assert.ok(isleSd(at[0],at[2])>0);
  W.floaters.grab(other.body); other.body.ghost=true; other.state='sea'; other.fly={b:at,dir:[0,1]}; other.seaT=0;
  W.step();
  assert.equal(W.sendBoat(),true); assert.equal(W.sendBoat(),false);
  let rode=false, otherRode=false;
  for(let i=0;i<120*200 && W.boat.state!=='moored';i++) {
    W.step(); assert.ok(isleSd(W.boat.p[0],W.boat.p[2])>=0);
    rode ||= W.boat.aboard.includes(d.id); otherRode ||= W.boat.aboard.includes(other.id);
  }
  assert.ok(rode && otherRode); assert.equal(W.boat.state,'moored'); assert.equal(d.state,'float'); assert.equal(other.state,'float');
  assert.ok(P.inMain(d.body.p[0],d.body.p[2])); assert.equal(d.stats.rescued,1);
  assert.equal(other.stats.rescued,1); assert.ok(P.inMain(other.body.p[0],other.body.p[2]));
  assert.ok(W.events.some(e=>e.type==='rescued'&&e.ids.includes(d.id)&&e.ids.includes(other.id)));
});

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
