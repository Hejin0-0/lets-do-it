import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/pool/world.js';
import {MOORING, reachable} from '../src/pool/rescue.js';
import {isleSd} from '../src/pool/island.js';
import {P} from '../src/pool/layout.js';

const make=(seed=3, collected=[])=>createWorld({seed,ducks:0,arrivals:false,collected});
const appear=W=>{ while(W.time<46 && !W.collectibles.adrift.length) W.step(120); return W.collectibles.adrift[0]; };
const finish=W=>{let aboard=false; for(let i=0;i<120*200 && W.boat.state!=='moored';i++){W.step(); aboard ||= W.collectibles.list[0].state==='aboard';} assert.equal(W.boat.state,'moored'); return aboard;};
test('seeded appearances are reproducible, bounded, offshore and reachable',()=>{
 const seen=[];
 for(const seed of [3,5,7,11]) { const a=make(seed), b=make(seed); const x=appear(a), y=appear(b);
  assert.deepEqual(x,y); assert.ok(x.t>=15 && x.t<=45); assert.ok(a.time>=x.t && a.time<=x.t+1); const dist=Math.hypot(x.at[0]-MOORING[0],x.at[1]-MOORING[2]);
  assert.ok(dist>=4 && dist<=12); assert.ok(isleSd(...x.at)>=.5); assert.ok(reachable(x.at)); seen.push(JSON.stringify(x));
 }
 assert.equal(new Set(seen).size,seen.length);
});
test('collection suppression, snapshots and a fresh visit',()=>{
 const a=make(3,['bottle-first']); a.step(120*46); assert.equal(a.collectibles.list[0].state,'collected'); assert.equal(a.collectibles.adrift.length,0);
 const b=make(); const item=appear(b); item.at[0]=999; item.state='collected'; assert.notEqual(b.collectibles.adrift[0].at[0],999);
 b.collectibles.setCollected(['bottle-first']); assert.equal(b.collectibles.list[0].state,'collected'); assert.ok(appear(make()));
});
test('dispatch and return transition once and do not record on failure',()=>{
 const W=make(); assert.equal(W.sendBoat(),false); assert.deepEqual(W.events.filter(e=>e.type==='collected'),[]);
 const item=appear(W); assert.equal(item.state,'adrift'); assert.equal(W.sendBoat(),true); assert.equal(W.sendBoat(),false);
 assert.ok(finish(W)); assert.equal(W.collectibles.list[0].state,'collected');
 assert.deepEqual(W.events.filter(e=>e.type==='collected'),[{type:'collected',ids:['bottle-first']}]);
 assert.equal(W.sendBoat(),false); W.step(120); assert.equal(W.events.filter(e=>e.type==='collected').length,1);
});
test('unreachable sea duck blocks dispatch atomically, then bottle and duck return together',()=>{
 const W=make(), item=appear(W), d=W.addFlyer(); W.floaters.grab(d.body); d.body.ghost=true; d.state='sea'; d.fly={b:[0,P.SEA,0],dir:[0,1]}; d.seaT=0; d.body.p=[0,P.SEA,0];
 assert.equal(reachable([0,0]),false); assert.equal(W.sendBoat(),false); assert.equal(W.boat.state,'moored'); assert.equal(W.collectibles.adrift[0].state,'adrift'); assert.equal(d.state,'sea'); assert.ok(!W.events.some(e=>e.type==='collected'));
 d.fly.b=[item.at[0]+.2,P.SEA,item.at[1]]; d.body.p=d.fly.b.slice();
 assert.equal(W.sendBoat(),true); assert.ok(finish(W)); assert.equal(d.state,'float'); assert.equal(d.stats.rescued,1); assert.ok(W.events.some(e=>e.type==='rescued'&&e.ids.includes(d.id))); assert.ok(W.events.some(e=>e.type==='collected'));
});

test('placeholder pose is hidden, floats and follows the boat until return', async()=>{
 const {PLACEMENTS,PROP_FLOATS,poseProps}=await import('../src/pool/props.js');
 const W=make(), buf=new Float32Array(PLACEMENTS.length*PROP_FLOATS), index=PLACEMENTS.findIndex(p=>p.collectibleId==='bottle-first')*PROP_FLOATS;
 const matrix=()=>{poseProps(buf,0,W);return Array.from(buf.slice(index,index+12));};
 assert.ok(matrix().every(x=>x===0)); const item=appear(W), floating=matrix(); assert.ok(floating.some(x=>x!==0));
 W.step(120); assert.notDeepEqual(matrix(),floating); assert.deepEqual(W.collectibles.adrift[0].at,item.at);
 assert.equal(W.sendBoat(),true); while(W.boat.state!=='moored' && W.collectibles.list[0].state!=='aboard') W.step();
 assert.equal(W.collectibles.list[0].state,'aboard');
 // aboard it rides the boat: with the time held, moving the boat moves the bottle by the same x and z (rows: tx at 3, tz at 11; the wave's tilt where the boat is shifts it a few mm)
 const aboard=matrix(), from=W.boat.p.slice(); W.boat.p[0]+=1.5; W.boat.p[2]-=.75; const moved=matrix(); W.boat.p=from;
 assert.ok(Math.abs(moved[3]-aboard[3]-1.5)<.02 && Math.abs(moved[11]-aboard[11]+.75)<.02, `the bottle did not move with the boat: ${moved[3]-aboard[3]}, ${moved[11]-aboard[11]}`);
 finish(W); assert.ok(matrix().every(x=>x===0));
});
