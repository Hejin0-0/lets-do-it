import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld, COLLECTIBLE_SPACING} from '../src/pool/world.js';
import {COLLECTIBLES} from '../src/pool/collectibles.js';
import {createLogbook} from '../src/pool/logbook.js';
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
 const a=make(3,['bottle-first']); a.step(120*46); assert.equal(a.collectibles.list[0].state,'collected'); assert.deepEqual(a.collectibles.adrift.map(x=>x.id),COLLECTIBLES.slice(1).map(x=>x.id));
 const b=make(); const item=appear(b); item.at[0]=999; item.state='collected'; assert.notEqual(b.collectibles.adrift[0].at[0],999);
 b.collectibles.setCollected(['bottle-first']); assert.equal(b.collectibles.list[0].state,'collected'); assert.ok(appear(make()));
});
test('dispatch and return transition once and do not record on failure',()=>{
 const W=make(3,COLLECTIBLES.slice(1).map(x=>x.id)); assert.equal(W.sendBoat(),false); assert.deepEqual(W.events.filter(e=>e.type==='collected'),[]);
 const item=appear(W); W.collectibles.setCollected(COLLECTIBLES.filter(x=>x.id!==item.id).map(x=>x.id)); assert.equal(item.state,'adrift'); assert.equal(W.sendBoat(),true); assert.equal(W.sendBoat(),false);
 assert.ok(finish(W)); assert.equal(W.collectibles.list[0].state,'collected');
 assert.deepEqual(W.events.filter(e=>e.type==='collected'),[{type:'collected',ids:['bottle-first']}]);
 assert.equal(W.sendBoat(),false); W.step(120); assert.equal(W.events.filter(e=>e.type==='collected').length,1);
});
test('unreachable sea duck blocks dispatch atomically, then bottle and duck return together',()=>{
 const W=make(3,COLLECTIBLES.slice(1).map(x=>x.id)), item=appear(W), d=W.addFlyer(); W.collectibles.setCollected(COLLECTIBLES.filter(x=>x.id!==item.id).map(x=>x.id)); W.floaters.grab(d.body); d.body.ghost=true; d.state='sea'; d.fly={b:[0,P.SEA,0],dir:[0,1]}; d.seaT=0; d.body.p=[0,P.SEA,0];
 assert.equal(reachable([0,0]),false); assert.equal(W.sendBoat(),false); assert.equal(W.boat.state,'moored'); assert.equal(W.collectibles.adrift[0].state,'adrift'); assert.equal(d.state,'sea'); assert.ok(!W.events.some(e=>e.type==='collected'));
 d.fly.b=[item.at[0]+.2,P.SEA,item.at[1]]; d.body.p=d.fly.b.slice();
 assert.equal(W.sendBoat(),true); assert.ok(finish(W)); assert.equal(d.state,'float'); assert.equal(d.stats.rescued,1); assert.ok(W.events.some(e=>e.type==='rescued'&&e.ids.includes(d.id))); assert.ok(W.events.some(e=>e.type==='collected'));
});

test('placeholder pose is hidden, floats and follows the boat until return', async()=>{
 const {PLACEMENTS,PROP_FLOATS,poseProps}=await import('../src/pool/props.js');
 const W=make(3,COLLECTIBLES.slice(1).map(x=>x.id)), buf=new Float32Array(PLACEMENTS.length*PROP_FLOATS), index=PLACEMENTS.findIndex(p=>p.collectibleId==='bottle-first')*PROP_FLOATS;
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

test('temporary catalogue has stable unique ids, titles and both kinds',()=>{
 assert.deepEqual(COLLECTIBLES.map(x=>x.id),['bottle-first','bottle-second','diorama-first']);
 assert.equal(new Set(COLLECTIBLES.map(x=>x.id)).size,COLLECTIBLES.length);
 assert.deepEqual(new Set(COLLECTIBLES.map(x=>x.kind)),new Set(['bottle','diorama']));
 assert.ok(COLLECTIBLES.every(x=>x.title.trim()));
});
test('first item retains its original seeded time and position',()=>{
 const original=[[3,44.16157432598993,[15.067250812217367,6.689446189442977]],[5,37.54533980274573,[18.568832143222338,5.726031505172182]],[7,24.862158356700093,[17.713313891476325,-0.16107508226292122]],[11,17.763507056515664,[19.277714740955666,9.520249615337827]]];
 for(const [seed,t,at] of original){const w=make(seed);w.step(120*46);const item=w.collectibles.list[0];assert.equal(item.t,t);assert.deepEqual(item.at,at);}
});
test('all seeded spawns appear, are reproducible, separated and reachable',()=>{
 const results=[];
 for(const seed of [3,5,7,11,19,31]){
  const a=make(seed),b=make(seed);a.step(120*45+1);b.step(120*45+1);const items=a.collectibles.list;
  assert.deepEqual(items,b.collectibles.list);assert.equal(a.collectibles.adrift.length,COLLECTIBLES.length);
  for(const [i,x] of items.entries()){
   assert.ok(x.t>=15&&x.t<=45);const distance=Math.hypot(x.at[0]-MOORING[0],x.at[1]-MOORING[2]);
   assert.ok(distance>=4&&distance<=12);assert.ok(isleSd(...x.at)>=.5);assert.ok(reachable(x.at));
   for(const y of items.slice(0,i))assert.ok(Math.hypot(x.at[0]-y.at[0],x.at[1]-y.at[1])>=COLLECTIBLE_SPACING);
  }results.push(JSON.stringify(items));
 }assert.equal(new Set(results).size,results.length);
});
test('one trip returns all adrift pages, and a later visit only shows missing items',()=>{
 const store={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}}, W=make(5),book=createLogbook(store);W.step(120*46);const ids=W.collectibles.adrift.map(x=>x.id);
 assert.equal(W.sendBoat(),true);finish(W);const events=W.events.filter(e=>e.type==='collected');assert.equal(events.length,1);assert.deepEqual(new Set(events[0].ids),new Set(ids));
 book.observe(W,events);assert.deepEqual(book.pages.filter(p=>p.found).map(p=>p.id),ids);assert.equal(book.complete,true);
 const saved=JSON.parse(store.value);delete saved.pages[ids[2]];store.value=JSON.stringify(saved);const restored=createLogbook(store);
 const later=make(5,restored.pages.filter(p=>p.found).map(p=>p.id));later.step(120*46);assert.deepEqual(later.collectibles.adrift.map(x=>x.id),ids.slice(2));
});
test('a diorama alone takes the same boat path',()=>{
 const other=COLLECTIBLES.filter(x=>x.kind!=='diorama').map(x=>x.id), W=make(7,other),book=createLogbook(null);W.step(120*46);
 const [item]=W.collectibles.adrift;assert.equal(item.kind,'diorama');assert.equal(W.sendBoat(),true);finish(W);book.observe(W,W.events);
 assert.deepEqual(book.pages.filter(p=>p.found).map(p=>p.id),[item.id]);assert.equal(book.complete,false);
});
test('multiple aboard placeholders use distinct positions and each follows the boat',async()=>{
 const {PLACEMENTS,PROP_FLOATS,poseProps}=await import('../src/pool/props.js');const W=make(3);W.step(120*46);assert.equal(W.sendBoat(),true);
 for(let i=0;i<120*200&&W.boat.aboard.length<COLLECTIBLES.length&&W.boat.state!=='moored';i++)W.step();
 assert.equal(W.boat.aboard.length,COLLECTIBLES.length);
 const buf=new Float32Array(PLACEMENTS.length*PROP_FLOATS),positions=()=>{poseProps(buf,0,W);return COLLECTIBLES.map(c=>{const n=PLACEMENTS.findIndex(p=>p.collectibleId===c.id)*PROP_FLOATS;return [buf[n+3],buf[n+11]];});};
 const before=positions();assert.equal(new Set(before.map(p=>p.join(','))).size,COLLECTIBLES.length);W.boat.p[0]+=1;W.boat.p[2]-=.5;const after=positions();
 before.forEach((p,i)=>{assert.ok(Math.abs(after[i][0]-p[0]-1)<.02);assert.ok(Math.abs(after[i][1]-p[1]+.5)<.02);});
 const models=COLLECTIBLES.map(c=>PLACEMENTS.find(p=>p.collectibleId===c.id).model);assert.equal(models[0],models[1]);assert.notEqual(models[0],models[2]);
});

test('a target removed after dispatch produces no collected event or find',()=>{
 const W=make(3,COLLECTIBLES.slice(1).map(x=>x.id)), book=createLogbook(null); const item=appear(W);
 assert.equal(W.sendBoat(),true);W.collectibles.setCollected([item.id]);finish(W);book.observe(W,W.events);
 assert.ok(!W.events.some(e=>e.type==='collected'));assert.equal(book.pages.filter(p=>p.found).length,0);assert.equal(book.complete,false);
});
