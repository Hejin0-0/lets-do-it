import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/pool/world.js';
import {createLogbook, FAST_LAP_SECONDS} from '../src/pool/logbook.js';
import {COLLECTIBLES} from '../src/pool/collectibles.js';

const KEY='rubber-duck-pool.book.v2';
const store=(value=null)=>{const keys=new Map(value===null?[]:[[KEY,value]]);return {keys,writes:0,getItem(k){return keys.get(k)??null;},setItem(k,v){keys.set(k,v);this.writes++;},removeItem(k){keys.delete(k);}};};

for(const afloat of [false,true])test(`two tabs: syncing a find ${afloat?'removes the drifting item':'keeps the selected item from drifting'}`,()=>{
 const s=store(),a=createLogbook(s),b=createLogbook(s),world=createWorld({seed:3,ducks:0,arrivals:false});
 world.collectibles.arm();const item=world.collectibles.list.find(c=>c.t!==null);assert.ok(item);
 if(afloat){world.step(120*46);assert.ok(world.collectibles.adrift.some(c=>c.id===item.id));}
 b.observe(world,[{type:'collected',ids:[item.id]}]);b.flush();
 a.sync();world.collectibles.setCollected(a.pages.filter(p=>p.found).map(p=>p.id));
 assert.equal(world.collectibles.adrift.some(c=>c.id===item.id),false);
 world.step(120*46);assert.equal(world.collectibles.adrift.some(c=>c.id===item.id),false);
 assert.equal(world.sendBoat(),false);
});

test('the book observes three real minutes at seeds 3, 5, 7 before and after duck stats arrive',()=>{
 let circuits=0,fast=0;
 for(const seed of [3,5,7]){
  const w=createWorld({seed,ducks:40,arrivals:false}),book=createLogbook(null),previous=new Map(),returnedAt=new Map(),times=[];
  book.observe(w,w.events);w.events.length=0;
  for(let frame=0;frame<180*60;frame++){
   w.step(2);book.observe(w,w.events);w.events.length=0;
   for(const d of w.ducks){
    const laps=d.stats?.laps??d.laps;
    if(laps>(previous.get(d.id)??0)){
     if(d.stats)times.push(d.stats.lastLap);   // the world's own lap time (slide start to slide start)
     else if(returnedAt.has(d.id))times.push(w.time-returnedAt.get(d.id));
     returnedAt.set(d.id,w.time);
    }
    previous.set(d.id,laps);
   }
  }
  w.time+=.25;book.observe(w,[]);
  assert.ok(book.stamps.find(s=>s.id==='full-house').earned);
  assert.ok(book.stamps.find(s=>s.id==='all-designs').earned);
  assert.equal(book.ducks.length,40);assert.ok(book.ducks.every(d=>d.here));
  for(const d of w.ducks){
   const row=book.ducks.find(r=>r.id===d.id);assert.equal(row.name,d.name);assert.equal(row.laps,d.stats?.laps??d.laps);
   if(d.stats)assert.equal(row.bestLap,d.stats.bestLap);
  }
  assert.ok(w.slides>0);assert.ok(times.length>0,`seed ${seed} completed full circuits`);
  circuits+=times.length;fast+=times.filter(t=>t<FAST_LAP_SECONDS).length;
  console.log(`book calibration seed=${seed}: circuits=${times.length}, min=${Math.min(...times).toFixed(3)}s, under ${FAST_LAP_SECONDS}s=${times.filter(t=>t<FAST_LAP_SECONDS).length}`);
 }
 assert.ok(fast>0&&fast/circuits<.2,`${fast}/${circuits}: a lucky minority, not every duck`);
});

test('restoring the pool on load writes nothing to storage and puts the item in the pool',()=>{
 const s=store(),[x]=COLLECTIBLES.map(c=>c.id);
 createLogbook(s).observe(createWorld({seed:3,ducks:0,arrivals:false}),[{type:'collected',ids:[x]},{type:'summoned',id:x,x:0,z:0}]);
 s.writes=0;
 const world=createWorld({seed:3,ducks:0,arrivals:false}),book=createLogbook(s);
 for(const id of book.inPool)if(book.found(id))world.summon(id,{restore:true});
 book.observe(world,world.events);
 assert.equal(s.writes,0);
 assert.equal(world.summons.has(x),true);
 assert.deepEqual(world.events.filter(e=>e.type==='summoned'),[]);
});

test('two tabs: restoring in a background tab does not undo a send-back from the active tab',()=>{
 const s=store(),[x,y]=COLLECTIBLES.map(c=>c.id);
 createLogbook(s).observe(createWorld({seed:3,ducks:0,arrivals:false}),[{type:'collected',ids:[x]},{type:'summoned',id:x,x:0,z:0}]);
 const worldB=createWorld({seed:3,ducks:0,arrivals:false}),bookB=createLogbook(s);
 for(const id of bookB.inPool)if(bookB.found(id))worldB.summon(id,{restore:true});
 const bookA=createLogbook(s);
 bookA.observe(createWorld({seed:3,ducks:0,arrivals:false}),[{type:'sendBack',id:x}]);
 bookB.observe(worldB,worldB.events);worldB.events.length=0;
 worldB.time+=1;bookB.observe(worldB,[{type:'collected',ids:[y]}]);
 const after=createLogbook(s);
 assert.deepEqual(after.inPool,[]);
 assert.equal(after.found(y),true);
});
