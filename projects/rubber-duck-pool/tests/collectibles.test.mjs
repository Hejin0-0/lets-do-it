import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/pool/world.js';
import {COLLECTIBLES} from '../src/pool/collectibles.js';
import { LOOKDEV_SHAPES } from '../src/pool/lookdev-shapes.js';
import {createLogbook} from '../src/pool/logbook.js';
import {reachable} from '../src/pool/rescue.js';
import {P} from '../src/pool/layout.js';

const make=(visit=3, collected=[])=>createWorld({seed:3,visit,ducks:0,arrivals:false,collected});
const appear=W=>{ W.collectibles.arm(); while(W.time<46 && !W.collectibles.adrift.length) W.step(120); return W.collectibles.adrift[0]; };
const finish=(W,id)=>{let aboard=false; for(let i=0;i<120*200 && W.boat.state!=='moored';i++){W.step(); aboard ||= W.collectibles.list.find(x=>x.id===id).state==='aboard';} assert.equal(W.boat.state,'moored'); return aboard;};

test('the final catalogue has six stable ordered ids, kinds and titles',()=>{
 assert.deepEqual(COLLECTIBLES.map(({id,kind,title})=>({id,kind,title})),[
  {id:'bottle-first',kind:'bottle',title:'Sailboat in a bottle'}, {id:'bottle-second',kind:'bottle',title:'Steamboat in a bottle'}, {id:'bottle-third',kind:'bottle',title:'Pirate ship in a bottle'},
  {id:'diorama-first',kind:'diorama',title:'Volcano island'}, {id:'diorama-second',kind:'diorama',title:'Jungle island'}, {id:'diorama-third',kind:'diorama',title:'Snowy island'},
 ]);
});

test('arming starts one clock once, no second item even after collection or another sit',()=>{
 const W=make(); W.step(120*46); assert.equal(W.collectibles.adrift.length,0);
 assert.ok(W.collectibles.list.every(x=>x.state==='hidden' && x.at===null && x.t===null));
 const armedAt=W.time; W.collectibles.arm(); W.step(120*14); assert.equal(W.collectibles.adrift.length,0); W.collectibles.arm();
 W.step(120*32); const [item]=W.collectibles.adrift; assert.ok(item); assert.ok(item.t>=armedAt+15 && item.t<=armedAt+45);
 W.step(120*46); W.collectibles.arm(); assert.deepEqual(W.collectibles.adrift.map(x=>x.id),[item.id]);
 assert.equal(W.sendBoat(),true); assert.ok(finish(W,item.id)); W.step(120*46); W.collectibles.arm(); W.step(120*46);
 assert.equal(W.collectibles.adrift.length,0); assert.equal(W.collectibles.list.filter(x=>x.state==='collected').length,1);
 W.reset({visit:19}); assert.equal(W.collectibles.list.find(x=>x.id===item.id).state,'collected'); W.collectibles.arm(); W.step(120*46);
 assert.equal(W.collectibles.adrift.length,1); assert.notEqual(W.collectibles.adrift[0].id,item.id);
});

test('visit seeds choose every unfound item, repeat exactly, and skip found items',()=>{
 const found=['bottle-first','diorama-second'], missing=COLLECTIBLES.filter(x=>!found.includes(x.id)).map(x=>x.id), seen=new Set();
 const W=make(0,found);
 for(let visit=0;visit<48;visit++){
  W.reset({visit}); W.collectibles.arm(); const selected=W.collectibles.list.filter(x=>x.t!==null);
  assert.equal(selected.length,1); assert.ok(missing.includes(selected[0].id)); seen.add(selected[0].id);
 }
 assert.deepEqual(seen,new Set(missing));
 const a=make(5),b=make(5),c=make(19); const x=appear(a),y=appear(b),z=appear(c);
 assert.deepEqual(x,y); assert.notDeepEqual(x,z); assert.ok(x.t>=15&&x.t<=45);
 x.at[0]=999; assert.notEqual(a.collectibles.adrift[0].at[0],999);
 const done=make(2,COLLECTIBLES.map(x=>x.id)); done.collectibles.arm(); done.step(120*46); assert.deepEqual(done.collectibles.adrift,[]);
});

test('duck and item return together and only that item page is filled',()=>{
 const W=make(3), book=createLogbook(null), item=appear(W), d=W.addFlyer();
 W.floaters.grab(d.body); d.body.ghost=true; d.state='sea'; d.fly={b:[0,P.SEA,0],dir:[0,1]}; d.seaT=0; d.body.p=[0,P.SEA,0];
 assert.equal(reachable([0,0]),false); assert.equal(W.sendBoat(),false); assert.equal(W.boat.state,'moored'); assert.equal(W.collectibles.adrift[0].state,'adrift');
 d.fly.b=[item.at[0]+.2,P.SEA,item.at[1]]; d.body.p=d.fly.b.slice();
 assert.equal(W.sendBoat(),true); assert.equal(W.sendBoat(),false); assert.ok(finish(W,item.id)); assert.equal(d.stats.rescued,1);
 assert.ok(W.events.some(e=>e.type==='rescued'&&e.ids.includes(d.id))); assert.deepEqual(W.events.filter(e=>e.type==='collected'),[{type:'collected',ids:[item.id]}]);
 book.observe(W,W.events); assert.deepEqual(book.pages.filter(p=>p.found).map(p=>p.id),[item.id]); assert.equal(book.complete,false);
 assert.equal(W.sendBoat(),false);
});

test('an item floats and follows the boat; each item is its own model',async()=>{
 const {PLACEMENTS,PROP_FLOATS,poseProps}=await import('../src/pool/props.js');
 const W=make(3,COLLECTIBLES.slice(1).map(x=>x.id)), buf=new Float32Array(PLACEMENTS.length*PROP_FLOATS), index=PLACEMENTS.findIndex(p=>p.collectibleId==='bottle-first')*PROP_FLOATS;
 const matrix=()=>{poseProps(buf,0,W);return Array.from(buf.slice(index,index+12));};
 assert.ok(matrix().every(x=>x===0)); const item=appear(W), floating=matrix(); assert.ok(floating.some(x=>x!==0));
 W.step(120); assert.notDeepEqual(matrix(),floating); assert.deepEqual(W.collectibles.adrift[0].at,item.at);
 assert.equal(W.sendBoat(),true); while(W.boat.state!=='moored' && W.collectibles.list[0].state!=='aboard') W.step();
 const aboard=matrix(), from=W.boat.p.slice(); W.boat.p[0]+=1.5; W.boat.p[2]-=.75; const moved=matrix(); W.boat.p=from;
 assert.ok(Math.abs(moved[3]-aboard[3]-1.5)<.02 && Math.abs(moved[11]-aboard[11]+.75)<.02); finish(W,item.id); assert.ok(matrix().every(x=>x===0));
 const models=COLLECTIBLES.map(c=>PLACEMENTS.find(p=>p.collectibleId===c.id).model);
 assert.equal(new Set(models).size,COLLECTIBLES.length); for(const m of models) assert.ok(LOOKDEV_SHAPES.models[m],`${m}: drawn from lookdev.bin`);
});

test('a target removed after dispatch produces no collected event or find',()=>{
 const W=make(3), book=createLogbook(null), item=appear(W); assert.equal(W.sendBoat(),true);
 W.collectibles.setCollected([item.id]); finish(W,item.id); book.observe(W,W.events);
 assert.ok(!W.events.some(e=>e.type==='collected')); assert.equal(book.pages.filter(p=>p.found).length,0);
});

// The current visit permits one item, but the renderer's multiple-aboard contract still matters.
test('multiple items aboard stay apart and follow the boat',async()=>{
 const {PLACEMENTS,PROP_FLOATS,poseProps}=await import('../src/pool/props.js');
 const W=make(), ids=COLLECTIBLES.map(c=>c.id); W.collectibles={list:ids.map(id=>({id,state:'aboard'}))}; W.boat.aboard=ids; W.boat.state='out';
 const buf=new Float32Array(PLACEMENTS.length*PROP_FLOATS), positions=()=>{poseProps(buf,0,W);return ids.map(id=>{const n=PLACEMENTS.findIndex(p=>p.collectibleId===id)*PROP_FLOATS;return [buf[n+3],buf[n+11]];});};
 const before=positions(); assert.equal(new Set(before.map(p=>p.join(','))).size,ids.length);
 W.boat.p[0]+=1; W.boat.p[2]-=.5; const after=positions();
 before.forEach((p,i)=>{assert.ok(Math.abs(after[i][0]-p[0]-1)<.02);assert.ok(Math.abs(after[i][1]-p[1]+.5)<.02);});
});


test('default visit derives from seed and arming sees finds loaded after construction',()=>{
 const a=createWorld({seed:7,ducks:0,arrivals:false}), b=createWorld({seed:7,visit:7,ducks:0,arrivals:false});
 const other=COLLECTIBLES.slice(0,-1).map(x=>x.id);
 for (const W of [a,b]) { W.collectibles.setCollected(other); W.collectibles.arm(); }
 assert.deepEqual(a.collectibles.list,b.collectibles.list);
 assert.equal(a.collectibles.list.filter(x=>x.t!==null)[0].id,COLLECTIBLES.at(-1).id);
});
