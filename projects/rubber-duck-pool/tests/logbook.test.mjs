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
 assert.equal(b.stamps.find(s=>s.id==='fireworks').at,.01);w.time=.02;b.observe(w,[{type:'burst'}]);assert.equal(b.stamps.find(s=>s.id==='fireworks').at,.01);
});
test('forty at once, newest first, absence and bounded visit history',()=>{
 const b=createLogbook(null),w=world(Array.from({length:40},(_,i)=>duck(i+1)));b.observe(w,[]);assert.ok(earned(b,'full-house'));assert.equal(b.ducks[0].id,40);
 w.ducks=w.ducks.slice(1);w.time=1;b.observe(w,[]);assert.equal(b.ducks.find(d=>d.id===1).here,false);
 w.ducks.push(duck(41));w.time=2;b.observe(w,[]);assert.equal(b.ducks.length,40);assert.equal(b.ducks[0].id,41);assert.ok(!b.ducks.some(d=>d.id===1));
 w.time=3;b.observe(w,[]);assert.equal(b.ducks[0].id,41);
});
test('a whole forward day is required; midnight alone and clock scrubbing do not count',()=>{
 const b=createLogbook(null),w=world();w.day.hour=23.9;b.observe(w,[]);
 for(let i=1;i<=359;i++){w.time=i*5;w.day.hour=(23.9+i/15)%24;b.observe(w,[]);assert.equal(earned(b,'day-and-night'),false);}
 w.time=1800;w.day.hour=23.9;b.observe(w,[]);assert.equal(earned(b,'day-and-night'),true);
 const other=createLogbook(null);w.time=0;w.day.hour=0;other.observe(w,[]);
 for(let i=1;i<=100;i++){w.time+=.01;w.day.hour=(i*.25)%24;other.observe(w,[]);assert.equal(earned(other,'day-and-night'),false);}
});
test('versioned persistence keeps collections and records, never visiting ducks',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[]);
 for(let i=1;i<100;i++){w.time=i/60;b.observe(w,[]);}assert.equal(s.writes,1);
 w.time=2;b.observe(w,[{type:'lap',id:1,time:FAST_LAP_SECONDS-1},{type:'burst'}]);
 const restored=createLogbook(s);assert.deepEqual(restored.designs,b.designs);assert.deepEqual(restored.stamps,b.stamps);assert.deepEqual(restored.records,b.records);
 assert.deepEqual(restored.ducks,[]);assert.ok(s.value.length<3000);assert.equal(JSON.parse(s.value).version,3);
});
test('ordinary progress saves after five seconds and new stamps save immediately',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[]);const writes=s.writes;
 w.ducks[0].hat=1;w.time=1;b.observe(w,[]);assert.equal(s.writes,writes);w.time=5;b.observe(w,[]);assert.equal(s.writes,writes+1);
 w.time=5.01;b.observe(w,[{type:'burst'}]);assert.equal(s.writes,writes+2);assert.ok(createLogbook(s).hats[0].worn);
});
test('two tabs on one book: a save keeps what the other tab saved since, and the pool takes only its own summons and returns',()=>{
 const s=store(),w=world(),[x,y,z]=COLLECTIBLES.map(c=>c.id),summoned=id=>({type:'summoned',id,x:0,z:0});
 const seed=createLogbook(s);seed.observe(w,[{type:'collected',ids:[x,y]},summoned(y)]);
 const a=createLogbook(s),b=createLogbook(s);
 w.time=1;a.observe(w,[summoned(x),{type:'sendBack',id:y}]);assert.deepEqual(a.inPool,[x]);
 w.time=2;b.observe(w,[{type:'collected',ids:[z]}]);
 const after=createLogbook(s);
 assert.deepEqual(after.inPool,[x],'the summon in one tab and the return in the other both stand');
 assert.ok([x,y,z].every(id=>after.found(id)),'each tab keeps what the other found');
 w.time=3;b.observe(w,[summoned(z)]);assert.deepEqual(createLogbook(s).inPool,[x,z]);
});
test('two tabs: a tab that took in the other tab\'s summon still keeps its own summon and return of that item, in order',()=>{
 const s=store(),w=world(),[x,y]=COLLECTIBLES.map(c=>c.id),sum=id=>({type:'summoned',id,x:0,z:0}),back=id=>({type:'sendBack',id});
 createLogbook(s).observe(w,[{type:'collected',ids:[x,y]}]);
 const a=createLogbook(s),b=createLogbook(s);
 w.time=1;a.observe(w,[sum(x)]);
 w.time=2;b.observe(w,[{type:'burst'}]);assert.deepEqual(b.inPool,[x],'b took in a\'s summon');
 w.time=3;a.observe(w,[back(x)]);
 w.time=4;b.observe(w,[sum(x)]);assert.deepEqual(createLogbook(s).inPool,[x],'b\'s own summon of it stands');
 w.time=5;a.observe(w,[sum(y)]);assert.deepEqual(createLogbook(s).inPool,[x,y]);
 w.time=6;b.observe(w,[back(x),sum(x)]);assert.deepEqual(createLogbook(s).inPool,[y,x],'sent back and summoned again: last');
});
test('two tabs: a write that fails leaves the tab as it was, and its retry does not bring back what the other sent back',()=>{
 const s=store(),w=world(),[x]=COLLECTIBLES.map(c=>c.id);
 createLogbook(s).observe(w,[{type:'collected',ids:[x]}]);
 const a=createLogbook(s),b=createLogbook(s);
 w.time=1;a.observe(w,[{type:'summoned',id:x,x:0,z:0}]);
 const set=s.setItem;s.setItem=()=>{throw Error('full');};
 w.time=2;b.observe(w,[{type:'burst'}]);assert.deepEqual(b.inPool,[],'the failed write took nothing in');
 s.setItem=set;
 w.time=3;a.observe(w,[{type:'sendBack',id:x}]);
 b.flush();const after=createLogbook(s);assert.deepEqual(after.inPool,[]);assert.ok(earned(after,'fireworks'),'the retry wrote b\'s own stamp');
});
test('a missing, corrupt or older stored book does not empty the pool this tab holds',()=>{
 const s=store(),w=world(),[x,y]=COLLECTIBLES.map(c=>c.id),b=createLogbook(s);
 b.observe(w,[{type:'collected',ids:[x,y]},{type:'summoned',id:x,x:0,z:0},{type:'summoned',id:y,x:0,z:0}]);
 const older=JSON.parse(s.value);older.version=2;older.pages={[x]:7};delete older.pool;
 [null,'{not json',JSON.stringify(older)].forEach((stored,i)=>{
  s.value=stored;w.time=1+i;w.ducks=[duck(i+2)];b.observe(w,[]);b.flush();
  const after=createLogbook(s);assert.deepEqual(after.inPool,[x,y],`stored ${i}`);assert.ok(after.designs[i+1].seen);
 });
});
test('two tabs: a race won in each counts twice',()=>{
 const s=store(),w=world(),a=createLogbook(s),b=createLogbook(s);
 a.observe(w,[{type:'raceFinish',id:1,place:1,time:20}]);b.observe(w,[{type:'raceFinish',id:2,place:1,time:21}]);
 a.flush();b.flush();assert.equal(createLogbook(s).records.racesWon,2);
});
test('an event the hidden page handed over is not taken again by the frame, even after the other tab changed the pool',()=>{
 const s=store(),w=world(),[x]=COLLECTIBLES.map(c=>c.id),summon={type:'summoned',id:x,x:0,z:0};
 createLogbook(s).observe(w,[{type:'collected',ids:[x]}]);
 const b=createLogbook(s);b.observe(w,[summon]);
 const a=createLogbook(s);w.time=1;a.observe(w,[{type:'sendBack',id:x}]);
 w.time=2;b.observe(w,[{type:'burst'}]);assert.deepEqual(b.inPool,[]);
 b.observe(w,[summon]);b.flush();assert.deepEqual(createLogbook(s).inPool,[]);
});
test('flush saves at once what the five-second cadence still held, and only once',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[]);const writes=s.writes;
 w.ducks[0].hat=1;w.time=1;b.observe(w,[]);assert.equal(s.writes,writes);
 b.flush();assert.equal(s.writes,writes+1);assert.ok(createLogbook(s).hats[0].worn);
 b.flush();w.time=6;b.observe(w,[]);assert.equal(s.writes,writes+1);
});
test('garbage, foreign versions, malformed v1 and throwing stores never escape',()=>{
 for(const value of [null,'{','null','[]','42','{"version":2}',JSON.stringify({version:1,designs:[-1],hats:[],stamps:{},records:{}})]){
 const b=createLogbook(store(value));assert.ok(b.stamps.every(s=>!s.earned));b.observe(world([duck(1)]),[]);}
 const bad={getItem(){throw Error('blocked');},setItem(){throw Error('full');},removeItem(){throw Error('blocked');}};
 const b=createLogbook(bad);b.observe(world([duck(1)]),[{type:'burst'}]);
});
test('forty ducks scan at most four times per second within the observation budget',()=>{
 const b=createLogbook(null),w=world(Array.from({length:40},(_,i)=>duck(i+1))),ducks=w.ducks;let reads=0;
 Object.defineProperty(w,'ducks',{get(){reads++;return ducks;}});const start=performance.now();
 for(let i=0;i<36000;i++){w.time=i/60;b.observe(w,[]);}assert.ok(reads<=2400,`${reads} reads`);assert.ok(performance.now()-start<budget(250));
});
test('invalid persisted fields reject the entire book instead of trusting partial data',()=>{
 const s=store(),b=createLogbook(s);b.observe(world([duck(1)]),[{type:'burst'}]);const valid=JSON.parse(s.value);
 const corrupt=[v=>v.pages['bottle-first']=-1,v=>v.designs[0]=-1,v=>v.hats[0]='yes',v=>v.stamps[0]='earned',v=>v.records.bestLap=0,v=>v.records.mostLaps=1.5,v=>v.records.racesWon=-1];
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
 assert.deepEqual(b.pages,COLLECTIBLES.filter(c=>c.shelf===1).map(({id,kind,shelf})=>({id,kind,shelf,found:false,at:null,date:null})));  assert.equal(b.found('unknown'),false);
 w.time=2; const e={type:'collected',ids:['bottle-first','bottle-first','unknown']}; b.observe(w,[e,e]);
 assert.equal(b.found('bottle-first'),true); assert.equal(b.pages[0].at,2); assert.equal(JSON.parse(s.value).version,3); assert.deepEqual(JSON.parse(s.value).pages['bottle-first'],{at:2,date:null});
 const writes=s.writes, stamps=b.stamps; w.time=3; b.observe(w,[e]); assert.equal(s.writes,writes); assert.deepEqual(b.stamps,stamps);
 b.pages[0].at=99; assert.equal(b.pages[0].at,2); assert.deepEqual(createLogbook(s).pages,b.pages);
});
test('invalid page storage and blocked storage leave a usable in-memory find',()=>{
 for(const value of ['garbage',JSON.stringify({version:3}),JSON.stringify({version:2,pages:{'bottle-first':-1}})]) assert.equal(createLogbook(store(value)).found('bottle-first'),false);
 const blocked={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}}; const b=createLogbook(blocked),w=world(); w.time=7;
 b.observe(w,[{type:'collected',ids:['bottle-first']}]); assert.equal(b.found('bottle-first'),true); assert.equal(b.pages[0].at,7);
});

test('a v2 book missing a newly added page keeps existing progress',()=>{
 const s=store(), b=createLogbook(s); b.observe(world([duck(1)]),[{type:'burst'}]); const stored=JSON.parse(s.value); stored.version=2; stored.pages={};
 const restored=createLogbook(store(JSON.stringify(stored))); assert.deepEqual(restored.stamps,b.stamps); assert.deepEqual(restored.designs,b.designs); assert.equal(restored.found('bottle-first'),false);
});

test('book pages reflect empty, restored and storage-blocked visits',()=>{
 const s=store(), b=createLogbook(s), w=world();
 assert.equal(bookPage(b.pages,0).state,'empty');
 b.observe(w,[{type:'collected',ids:['bottle-first']}]);
 const restored=bookPage(createLogbook(s).pages,0);
 assert.equal(restored.state,'filled'); assert.equal(restored.title,'Sailboat in a bottle');
 const blocked={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
 const visit=createLogbook(blocked); assert.equal(bookPage(visit.pages,0).state,'empty');
 visit.observe(w,[{type:'collected',ids:['bottle-first']}]);
 assert.equal(bookPage(visit.pages,0).state,'filled'); assert.equal(bookPage(visit.pages,0).title,'Sailboat in a bottle');
});

test('slider jumps do not count as a day, but a continuous day after a jump does', async()=>{
 const {createWorld}=await import('../src/pool/world.js');
 const {chooseHour}=await import('../src/pool/seat-choices.js');
 const s=store(),b=createLogbook(s),w=createWorld({seed:3,ducks:0,arrivals:false});
 b.observe(w,[]);
 for(let i=0;i<12;i++){
  chooseHour(w,[6.25,12,18,23.75][i%4]);w.step(4);b.observe(w,w.events.splice(0));
  assert.equal(earned(b,'day-and-night'),false);
 }
 for(let i=0;i<30*1800-1;i++){w.step(4);b.observe(w,w.events.splice(0));}
 assert.equal(earned(b,'day-and-night'),false);
 w.step(4);b.observe(w,w.events.splice(0));
 const dayStamp=b.stamps.find(stamp=>stamp.id==='day-and-night');
 assert.equal(dayStamp.earned,true);assert.equal(dayStamp.at,w.time);
 assert.equal(earned(createLogbook(s),'day-and-night'),true);
 w.step(4);b.observe(w,w.events.splice(0));assert.equal(b.stamps.find(stamp=>stamp.id==='day-and-night').at,dayStamp.at);
});

test('old v2 progress grows into ordered pages and completion survives reload',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[{type:'burst'},{type:'collected',ids:[COLLECTIBLES[0].id]}]);
 const old=JSON.parse(s.value);old.version=2;old.pages={[COLLECTIBLES[0].id]:old.pages[COLLECTIBLES[0].id].at};s.value=JSON.stringify(old);
 const restored=createLogbook(s);assert.deepEqual(restored.records,b.records);assert.deepEqual(restored.stamps,b.stamps);assert.deepEqual(restored.pages.map(p=>p.found),COLLECTIBLES.filter(c=>c.shelf===1).map((_,i)=>i===0));assert.equal(restored.complete,false);
 for(const [i,item] of COLLECTIBLES.slice(1).entries()){w.time++;const e={type:'collected',ids:[item.id,item.id,'unknown']};restored.observe(w,[e,e]);restored.observe(w,[e]);assert.equal(restored.pages.filter(p=>p.found).length,i+2);assert.equal(restored.pages.length,i+2<6?6:12,'the second shelf opens once the first is full');assert.equal(restored.complete,i===COLLECTIBLES.length-2);}
 assert.equal(createLogbook(s).complete,true);assert.deepEqual(createLogbook(s).pages,restored.pages);
});

test('a page whose id left the list is dropped, and the rest of the book is kept',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[{type:'burst'},{type:'collected',ids:['bottle-first']}]);
 const v=JSON.parse(s.value);v.pages['a-retired-item']=12;   // saved by a visit whose list still had it
 const restored=createLogbook(store(JSON.stringify(v)));
 assert.deepEqual(restored.pages.map(p=>p.id),COLLECTIBLES.filter(c=>c.shelf===1).map(c=>c.id));assert.ok(restored.found('bottle-first'));
 assert.ok(restored.stamps.some(s=>s.earned));assert.ok(restored.designs.some(d=>d.seen));
 const again=store(JSON.stringify(v)),kept=createLogbook(again);kept.observe(w,[{type:'collected',ids:['bottle-second']}]);
 assert.ok(!Object.hasOwn(JSON.parse(again.value).pages,'a-retired-item'));assert.ok(JSON.parse(again.value).stamps.some(t=>t!==null));
});


test('a v2 book with the former three item ids keeps every find',()=>{
 const s=store(), original=createLogbook(s), w=world([duck(1)]);
 original.observe(w,[{type:'burst'},{type:'collected',ids:['bottle-first','bottle-second','diorama-first']}]);
 const old=JSON.parse(s.value); old.version=2; old.pages={'bottle-first':1,'bottle-second':2,'diorama-first':3};
 const restored=createLogbook(store(JSON.stringify(old)));
 assert.deepEqual(restored.pages.filter(p=>p.found).map(p=>[p.id,p.at]),[['bottle-first',1],['bottle-second',2],['diorama-first',3]]);
 assert.equal(restored.pages.length,6); assert.equal(restored.complete,false); assert.deepEqual(restored.stamps,original.stamps);
});


test('find dates use the caller clock once, survive saves and reload, and are optional',()=>{
 const s=store(),w=world(),date=Date.UTC(2026,10,4),calls=[];const b=createLogbook(s,{now:()=>{calls.push(true);return date;}});
 w.time=2;b.observe(w,[{type:'collected',ids:['bottle-first','bottle-first']}]);assert.equal(calls.length,1);assert.equal(b.pages[0].at,2);assert.equal(b.pages[0].date,date);
 w.time=8;b.observe(w,[{type:'collected',ids:['bottle-first']}]);assert.equal(calls.length,1);assert.deepEqual(createLogbook(s).pages,b.pages);
 const noClock=createLogbook(null);noClock.observe(w,[{type:'collected',ids:['bottle-first']}]);assert.equal(noClock.pages[0].date,null);
});

test('v2 dates migrate as unknown without losing other progress',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[{type:'burst'},{type:'lap',time:12}]);const old=JSON.parse(s.value);old.version=2;old.pages={'bottle-first':7,'retired':3};
 const migrated=createLogbook(store(JSON.stringify(old)));assert.equal(migrated.pages[0].found,true);assert.equal(migrated.pages[0].at,7);assert.equal(migrated.pages[0].date,null);
 for(const field of ['designs','hats','stamps','records'])assert.deepEqual(migrated[field],b[field]);
 const saved=store(JSON.stringify(old)),again=createLogbook(saved,{now:()=>42});w.time=9;again.observe(w,[{type:'collected',ids:['bottle-second']}]);assert.equal(JSON.parse(saved.value).version,3);assert.deepEqual(createLogbook(saved).pages,again.pages);
});

test('malformed v3 dates reject corrupt books, invalid clock values become unknown',()=>{
 const s=store(),b=createLogbook(s),w=world([duck(1)]);b.observe(w,[{type:'burst'},{type:'collected',ids:['bottle-first']}]);const valid=JSON.parse(s.value);
 for(const date of ['2026-11-04',{},1.5,8640000000000001]){const corrupt=structuredClone(valid);corrupt.pages['bottle-first'].date=date;const restored=createLogbook(store(JSON.stringify(corrupt)));assert.equal(restored.found('bottle-first'),false);assert.ok(restored.stamps.every(x=>!x.earned));}
 for(const date of [NaN,Infinity,'bad',1.5,8640000000000001]){const book=createLogbook(null,{now:()=>date});book.observe(w,[{type:'collected',ids:['bottle-first']}]);assert.equal(book.pages[0].date,null);}
});

test('what is in the pool is saved at once, read back in summon order, and Send it back takes it out',()=>{
 const s=store(),w=world(),b=createLogbook(s),summoned=id=>({type:'summoned',id,x:0,z:0});
 b.observe(w,[{type:'collected',ids:['bottle-first','diorama-first']}]);
 b.observe(w,[summoned('diorama-first'),summoned('bottle-first'),summoned('bottle-first'),summoned('bottle-second')]);
 assert.deepEqual(b.inPool,['diorama-first','bottle-first']); assert.deepEqual(createLogbook(s).inPool,['diorama-first','bottle-first']);
 b.inPool.push('x'); assert.deepEqual(b.inPool,['diorama-first','bottle-first']);
 w.time=.1; b.observe(w,[{type:'sendBack',id:'diorama-first'},{type:'sendBack',id:'bottle-third'}]);
 assert.deepEqual(createLogbook(s).inPool,['bottle-first'],'saved at the press, not five seconds on');
 b.observe(w,[{type:'sentBack',id:'bottle-first'}]); assert.deepEqual(b.inPool,['bottle-first'],'the press takes it out, not the gull leaving');
 assert.deepEqual(createLogbook(s).pages,b.pages);
});

test('an older book has nothing in the pool, and a bad pool list is dropped without losing the book',()=>{
 const s=store(),w=world(),b=createLogbook(s); b.observe(w,[{type:'collected',ids:['bottle-first']}]);
 const saved=JSON.parse(s.value); delete saved.pool; s.value=JSON.stringify(saved);
 let r=createLogbook(s); assert.deepEqual(r.inPool,[]); assert.equal(r.found('bottle-first'),true);
 for(const pool of [['bottle-first','bottle-first','diorama-first','nope',7,null],'junk',{a:1},null]){
  s.value=JSON.stringify({...saved,pool}); r=createLogbook(s); assert.deepEqual(r.inPool,Array.isArray(pool)?['bottle-first']:[]); assert.equal(r.found('bottle-first'),true);
 }
 s.value=JSON.stringify({...saved,version:2,pages:{'bottle-first':3},pool:['bottle-first']}); r=createLogbook(s); assert.deepEqual(r.inPool,[]); assert.equal(r.found('bottle-first'),true);
});

test('startVisit reloads a current stored book and replays pending changes without writing, or stays on missing/corrupt/older',()=>{
 const s=store(),w=world(),[x,y]=COLLECTIBLES.map(c=>c.id);
 createLogbook(s).observe(w,[{type:'collected',ids:[x,y]}]);
 const a=createLogbook(s),b=createLogbook(s);
 w.ducks=[duck(1,1)];b.observe(w,[]);   // hat 1 worn and saved on frame 0
 w.ducks[0].hat=2;w.time=1;b.observe(w,[]);   // hat 2 worn within 5s, still pending
 const writes=s.writes;
 a.observe(w,[{type:'summoned',id:x,x:0,z:0}]);
 assert.equal(s.writes,writes+1);
 b.startVisit();
 assert.equal(s.writes,writes+1,'startVisit does not write');
 assert.deepEqual(b.inPool,[x]);assert.equal(b.hats[1].worn,true);
 // pending was kept, so flushing now replays it onto whatever another tab saved since
 a.observe(w,[{type:'summoned',id:y,x:0,z:0}]);
 b.flush();
 const after=createLogbook(s);assert.deepEqual(after.inPool,[x,y]);assert.equal(after.hats[1].worn,true);
 // missing, corrupt or older stored book leaves live book intact
 const older=JSON.parse(s.value);older.version=2;delete older.pool;
 for(const value of [null,'{bad',JSON.stringify(older)]){
  s.value=value;b.startVisit();assert.deepEqual(b.inPool,[x,y]);assert.equal(b.hats[1].worn,true);
 }
});

test('a throwing read does not overwrite stored progress, keeps pending for retry, and leaves startVisit intact',()=>{
 const s=store(),w=world(),[x,y]=COLLECTIBLES.map(c=>c.id);
 const a=createLogbook(s),b=createLogbook(s);
 b.observe(w,[{type:'collected',ids:[x]}]);
 w.time=1;a.observe(w,[{type:'collected',ids:[y]}]);
 const get=s.getItem;let failRead=true;
 s.getItem=k=>{if(failRead){failRead=false;throw Error('blocked');}return get.call(s,k);};
 const writes=s.writes;
 w.time=2;b.observe(w,[{type:'burst'}]);
 assert.equal(s.writes,writes,'failed read writes nothing');
 failRead=true;b.startVisit();
 assert.equal(b.found(x),true);assert.ok(earned(b,'fireworks'));
 b.flush();assert.equal(s.writes,writes+1);
 const after=createLogbook(s);
 assert.ok(after.found(x)&&after.found(y)&&earned(after,'fireworks'));
});

test('a valid older stored book migrates as the base while keeping this tab\'s live pool',()=>{
 const s=store(),w=world(),[x,y]=COLLECTIBLES.map(c=>c.id);
 const b=createLogbook(s);
 b.observe(w,[{type:'collected',ids:[x]},{type:'summoned',id:x,x:0,z:0}]);
 const v2=JSON.parse(s.value);v2.version=2;v2.pages={[x]:1,[y]:2};delete v2.pool;
 s.value=JSON.stringify(v2);
 w.time=3;b.observe(w,[{type:'burst'}]);
 const after=createLogbook(s);
 assert.ok(after.found(x)&&after.found(y)&&earned(after,'fireworks'));
 assert.deepEqual(after.inPool,[x]);
 const v1=JSON.parse(s.value);v1.version=1;delete v1.pages;delete v1.pool;v1.hats[0]=true;
 s.value=JSON.stringify(v1);
 w.time=4;b.observe(w,[{type:'takeoff'}]);
 const afterV1=createLogbook(s);
 assert.equal(afterV1.hats[0].worn,true);assert.ok(earned(afterV1,'takeoff'));assert.deepEqual(afterV1.inPool,[x]);
});
