import test from 'node:test';
import assert from 'node:assert/strict';
import {createLogbook, FAST_LAP_SECONDS} from '../src/pool/logbook.js';
import {COLLECTIBLES} from '../src/pool/collectibles.js';
import {bookPage} from '../src/pool/book-view.js';
import {DESIGNS,HATS,PROPELLER} from '../src/pool/ducks.js';
import {budget} from './budget.mjs';
const KEY='rubber-duck-pool.book.v1';
const duck=(id,hat=0)=>({id,name:`Duck ${id}`,colour:(id-1)%12,hat,stats:{slides:0,laps:0,bestLap:null,flights:0,rescued:0,seaTrips:0}});
const world=(ducks=[])=>({time:0,day:{hour:15},ducks});
const earned=(b,id)=>b.stamps.find(s=>s.id===id).earned;
const store=(value=null)=>({value,writes:0,getItem(k){assert.equal(k,KEY);return this.value;},setItem(k,v){assert.equal(k,KEY);this.value=v;this.writes++;},removeItem(k){assert.equal(k,KEY);this.value=null;}});
test('catalogues use real labels and seven wearable hat indices',()=>{
 const b=createLogbook(null),w=world([duck(1)]);b.observe(w,[]);
 assert.deepEqual(b.designs.map(d=>d.label),DESIGNS.map(d=>d.label));assert.equal(b.designs[0].first,0);assert.equal(b.designs[1].first,null);
 assert.deepEqual(b.hats.map(h=>h.index),[1,2,3,4,5,6,7]);assert.deepEqual(b.hats.map(h=>h.label),HATS.slice(1,PROPELLER).map(h=>h.label));assert.ok(b.hats.every(h=>!h.worn));
 w.ducks=Array.from({length:12},(_,i)=>duck(i+1,i%7+1));w.time=1;b.observe(w,[]);
 assert.ok(earned(b,'all-designs'));assert.ok(earned(b,'all-hats'));b.designs[0].seen=false;assert.equal(b.designs[0].seen,true);
});
test('stats award stamps at their boundaries and retain records',()=>{
 const b=createLogbook(null),d=duck(1),w=world([d]);b.observe(w,[]);
 Object.assign(d.stats,{slides:1,laps:9,bestLap:FAST_LAP_SECONDS,flights:1,seaTrips:1,rescued:1});w.time=1;b.observe(w,[]);
 for(const id of ['first-slide','takeoff','lost-at-sea','rescue'])assert.ok(earned(b,id),id);
 assert.equal(earned(b,'ten-laps'),false);assert.equal(earned(b,'fast-lap'),false);
 d.stats.laps=10;d.stats.bestLap=FAST_LAP_SECONDS-.01;w.time=2;b.observe(w,[]);
 assert.ok(earned(b,'ten-laps'));assert.ok(earned(b,'fast-lap'));assert.equal(b.ducks[0].laps,10);assert.equal(b.ducks[0].rescued,1);
 assert.equal(b.records.mostLaps,10);assert.equal(b.records.bestLap,FAST_LAP_SECONDS-.01);
});
test('events between samples award stamps and deduplicate race finish/end',()=>{
 const b=createLogbook(null),w=world([duck(1)]);b.observe(w,[]);w.time=.01;
 b.observe(w,[{type:'arrive',id:2,colour:11},{type:'voice',id:1,colour:4},{type:'takeoff',id:1},{type:'escaped',id:1},{type:'rescued',ids:[1]},
 {type:'lap',id:1,time:FAST_LAP_SECONDS-1},{type:'raceStart',ids:[1,2]},{type:'raceFinish',id:1,place:1,time:42},
 {type:'raceEnd',results:[{id:1,place:1,time:42},{id:2,place:2,time:null}]},{type:'launch'}]);
 for(const id of ['takeoff','lost-at-sea','rescue','fast-lap','race-winner','fireworks'])assert.ok(earned(b,id),id);
 assert.ok(b.designs[11].seen);assert.ok(b.designs[4].seen);assert.equal(b.ducks[0].wins,1);assert.equal(b.records.racesWon,1);
 b.observe(w,[{type:'raceStart',ids:[1]},{type:'raceEnd',results:[{id:1,place:1,time:30}]}]);assert.equal(b.ducks[0].wins,2);assert.equal(b.records.racesWon,2);
 const fresh=b.fresh;assert.ok(fresh.length);fresh.length=0;assert.ok(b.fresh.length);b.take();assert.deepEqual(b.fresh,[]);b.observe(w,[{type:'burst'}]);assert.deepEqual(b.fresh,[]);
});
test('forty at once, newest first, absence and bounded visit history',()=>{
 const b=createLogbook(null),w=world(Array.from({length:40},(_,i)=>duck(i+1)));b.observe(w,[]);assert.ok(earned(b,'full-house'));assert.equal(b.ducks[0].id,40);
 w.ducks=w.ducks.slice(1);w.time=1;b.observe(w,[]);assert.equal(b.ducks.find(d=>d.id===1).here,false);
 w.ducks.push(duck(41));w.time=2;b.observe(w,[]);assert.equal(b.ducks.length,40);assert.equal(b.ducks[0].id,41);assert.ok(!b.ducks.some(d=>d.id===1));
 w.time=3;b.observe(w,[]);assert.equal(b.ducks[0].id,41);
});
test('a whole forward day is required; midnight alone and clock scrubbing do not count',()=>{
 const b=createLogbook(null),w=world();w.day.hour=23.9;b.observe(w,[]);w.time=5;w.day.hour=.1;b.observe(w,[]);assert.equal(earned(b,'day-and-night'),false);
 for(let i=1;i<=119;i++){w.time+=5;w.day.hour=(w.day.hour+.2)%24;b.observe(w,[]);}assert.ok(earned(b,'day-and-night'));
 const other=createLogbook(null);w.time=0;w.day.hour=0;other.observe(w,[]);
 for(let i=1;i<=25;i++){w.time+=.01;w.day.hour=i%24;other.observe(w,[]);}assert.equal(earned(other,'day-and-night'),false);
});
test('versioned persistence keeps collections and records, never visiting ducks or notices',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[]);
 for(let i=1;i<100;i++){w.time=i/60;b.observe(w,[]);}assert.equal(s.writes,1);
 w.time=2;b.observe(w,[{type:'lap',id:1,time:FAST_LAP_SECONDS-1},{type:'burst'}]);
 const restored=createLogbook(s);assert.deepEqual(restored.designs,b.designs);assert.deepEqual(restored.stamps,b.stamps);assert.deepEqual(restored.records,b.records);
 assert.deepEqual(restored.ducks,[]);assert.deepEqual(restored.fresh,[]);assert.ok(s.value.length<3000);assert.equal(JSON.parse(s.value).version,2);
 b.reset();assert.equal(s.value,null);assert.ok(b.designs.every(d=>!d.seen));assert.ok(b.stamps.every(s=>!s.earned));assert.deepEqual(b.ducks,[]);assert.deepEqual(b.fresh,[]);
});
test('ordinary progress saves after five seconds and new stamps save immediately',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[]);const writes=s.writes;
 w.ducks[0].hat=1;w.time=1;b.observe(w,[]);assert.equal(s.writes,writes);w.time=5;b.observe(w,[]);assert.equal(s.writes,writes+1);
 w.time=5.01;b.observe(w,[{type:'burst'}]);assert.equal(s.writes,writes+2);assert.ok(createLogbook(s).hats[0].worn);
});
test('garbage, foreign versions, malformed v1 and throwing stores never escape',()=>{
 for(const value of [null,'{','null','[]','42','{"version":2}',JSON.stringify({version:1,designs:[-1],hats:[],stamps:{},records:{}})]){
 const b=createLogbook(store(value));assert.ok(b.stamps.every(s=>!s.earned));b.observe(world([duck(1)]),[]);b.reset();}
 const bad={getItem(){throw Error('blocked');},setItem(){throw Error('full');},removeItem(){throw Error('blocked');}};
 const b=createLogbook(bad);b.observe(world([duck(1)]),[{type:'burst'}]);b.reset();assert.deepEqual(b.fresh,[]);
});
test('forty ducks scan at most four times per second within the observation budget',()=>{
 const b=createLogbook(null),w=world(Array.from({length:40},(_,i)=>duck(i+1))),ducks=w.ducks;let reads=0;
 Object.defineProperty(w,'ducks',{get(){reads++;return ducks;}});const start=performance.now();
 for(let i=0;i<36000;i++){w.time=i/60;b.observe(w,[]);}assert.ok(reads<=2400,`${reads} reads`);assert.ok(performance.now()-start<budget(250));
});
test('invalid persisted fields reject the entire book instead of trusting partial data',()=>{
 const s=store(),b=createLogbook(s);b.observe(world([duck(1)]),[{type:'burst'}]);const valid=JSON.parse(s.value);
 const corrupt=[v=>v.pages['bottle-first']=-1,v=>v.pages.foreign=1,v=>v.designs[0]=-1,v=>v.hats[0]='yes',v=>v.stamps[0]='earned',v=>v.records.bestLap=0,v=>v.records.mostLaps=1.5,v=>v.records.racesWon=-1];
 for(const change of corrupt){const v=structuredClone(valid);change(v);const restored=createLogbook(store(JSON.stringify(v)));assert.ok(restored.designs.every(d=>!d.seen));assert.ok(restored.stamps.every(s=>!s.earned));}
});
test('failed writes retry on cadence, and another visit retains records but resets duck identity',()=>{
 const s=store(),write=s.setItem;let attempts=0;s.setItem=function(k,v){attempts++;if(attempts===1)throw Error('full');write.call(this,k,v);};
 const b=createLogbook(s),w=world([duck(1)]);b.observe(w,[]);w.time=1;b.observe(w,[]);assert.equal(attempts,1);
 w.time=5;b.observe(w,[]);assert.equal(attempts,2);assert.ok(createLogbook(s).designs[0].seen);
 b.observe(w,[{type:'raceStart',ids:[1]},{type:'raceFinish',id:1,place:1,time:12}]);
 w.time=0;w.ducks=[duck(1)];b.observe(w,[]);assert.equal(b.ducks[0].wins,0);assert.equal(b.records.racesWon,1);
});
test('empty rescue, unfinished race, propeller and invalid lap times earn nothing',()=>{
 const b=createLogbook(null),w=world([duck(1,PROPELLER)]);b.observe(w,[{type:'rescued',ids:[]},{type:'raceEnd',results:[{id:1,place:1,time:null}]},
 ...[null,0,-1,NaN,Infinity].map(time=>({type:'lap',id:1,time}))]);
 assert.ok(b.stamps.every(s=>!s.earned));assert.ok(b.hats.every(h=>!h.worn));assert.equal(b.records.bestLap,null);
});

test('v1 migrates intact and collectible pages save once and survive reload',()=>{
 const s=store(), original=createLogbook(s), w=world([duck(1)]); original.observe(w,[{type:'burst'},{type:'lap',time:12}]);
 const v1=JSON.parse(s.value); v1.version=1; delete v1.pages; s.value=JSON.stringify(v1);
 const b=createLogbook(s); assert.deepEqual(b.records,original.records); assert.deepEqual(b.designs,original.designs); assert.deepEqual(b.hats,original.hats); assert.deepEqual(b.stamps,original.stamps);
 assert.deepEqual(b.pages,COLLECTIBLES.map(({id,kind})=>({id,kind,found:false,at:null})));  assert.equal(b.found('unknown'),false);
 w.time=2; const e={type:'collected',ids:['bottle-first','bottle-first','unknown']}; b.observe(w,[e,e]);
 assert.equal(b.found('bottle-first'),true); assert.equal(b.pages[0].at,2); assert.equal(JSON.parse(s.value).version,2); assert.equal(JSON.parse(s.value).pages['bottle-first'],2);
 const writes=s.writes, stamps=b.stamps, fresh=b.fresh; w.time=3; b.observe(w,[e]); assert.equal(s.writes,writes); assert.deepEqual(b.stamps,stamps); assert.deepEqual(b.fresh,fresh);
 b.pages[0].at=99; assert.equal(b.pages[0].at,2); assert.deepEqual(createLogbook(s).pages,b.pages);
});
test('invalid page storage and blocked storage leave a usable in-memory find',()=>{
 for(const value of ['garbage',JSON.stringify({version:3}),JSON.stringify({version:2,pages:{'bottle-first':-1}})]) assert.equal(createLogbook(store(value)).found('bottle-first'),false);
 const blocked={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}}; const b=createLogbook(blocked),w=world(); w.time=7;
 b.observe(w,[{type:'collected',ids:['bottle-first']}]); assert.equal(b.found('bottle-first'),true); assert.equal(b.pages[0].at,7); b.reset(); assert.equal(b.found('bottle-first'),false);
});

test('a v2 book missing a newly added page keeps existing progress',()=>{
 const s=store(), b=createLogbook(s); b.observe(world([duck(1)]),[{type:'burst'}]); const stored=JSON.parse(s.value); stored.pages={};
 const restored=createLogbook(store(JSON.stringify(stored))); assert.deepEqual(restored.stamps,b.stamps); assert.deepEqual(restored.designs,b.designs); assert.equal(restored.found('bottle-first'),false);
});

test('book pages reflect empty, restored and storage-blocked visits',()=>{
 const s=store(), b=createLogbook(s), w=world();
 assert.equal(bookPage(b.pages,0).state,'empty');
 b.observe(w,[{type:'collected',ids:['bottle-first']}]);
 const restored=bookPage(createLogbook(s).pages,0);
 assert.equal(restored.state,'filled'); assert.equal(restored.title,'First bottle');
 const blocked={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
 const visit=createLogbook(blocked); assert.equal(bookPage(visit.pages,0).state,'empty');
 visit.observe(w,[{type:'collected',ids:['bottle-first']}]);
 assert.equal(bookPage(visit.pages,0).state,'filled'); assert.equal(bookPage(visit.pages,0).title,'First bottle');
});

test('preset jumps do not count as a day, but a continuous day after a jump does', async()=>{
 const {createWorld}=await import('../src/pool/world.js');
 const {HOURS,chooseHour}=await import('../src/pool/seat-choices.js');
 const s=store(),b=createLogbook(s),w=createWorld({seed:3,ducks:0,arrivals:false});
 b.observe(w,[]);
 for(let i=0;i<12;i++){
  chooseHour(w,HOURS[i%HOURS.length].id);w.step(4);b.observe(w,w.events.splice(0));
  assert.equal(earned(b,'day-and-night'),false);
 }
 b.take();
 for(let i=0;i<30*600-1;i++){w.step(4);b.observe(w,w.events.splice(0));}
 assert.equal(earned(b,'day-and-night'),false);
 w.step(4);b.observe(w,w.events.splice(0));
 assert.equal(earned(b,'day-and-night'),true);
 assert.equal(b.fresh.filter(stamp=>stamp.id==='day-and-night').length,1);
 assert.equal(earned(createLogbook(s),'day-and-night'),true);
 b.take();w.step(4);b.observe(w,w.events.splice(0));assert.equal(b.fresh.some(stamp=>stamp.id==='day-and-night'),false);
});

test('old v2 progress grows into ordered pages and completion survives reload',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[{type:'burst'},{type:'collected',ids:[COLLECTIBLES[0].id]}]);
 const old=JSON.parse(s.value);old.pages={[COLLECTIBLES[0].id]:old.pages[COLLECTIBLES[0].id]};s.value=JSON.stringify(old);
 const restored=createLogbook(s);assert.deepEqual(restored.records,b.records);assert.deepEqual(restored.stamps,b.stamps);assert.deepEqual(restored.pages.map(p=>p.found),[true,false,false]);assert.equal(restored.complete,false);
 for(const [i,item] of COLLECTIBLES.slice(1).entries()){w.time++;const e={type:'collected',ids:[item.id,item.id,'unknown']};restored.observe(w,[e,e]);restored.observe(w,[e]);assert.equal(restored.pages.filter(p=>p.found).length,i+2);assert.equal(restored.complete,i===1);}
 assert.equal(createLogbook(s).complete,true);assert.deepEqual(createLogbook(s).pages,restored.pages);
});
