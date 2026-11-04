import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/pool/world.js';
import {createLogbook, FAST_LAP_SECONDS} from '../src/pool/logbook.js';

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
