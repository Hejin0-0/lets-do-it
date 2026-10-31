import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/pool/world.js';
import {DUCK_FLOAT} from '../src/pool/ducks.js';
import {P} from '../src/pool/layout.js';

test('the pump has no continuous upward spray emitter',()=>{
  const W=createWorld({seed:3,ducks:0,arrivals:false});
  W.step(60);
  assert.equal(W.spray?.filter(q=>q.on).length||0,0,'the area below the intake stays clear');
});

test('the pump accelerates a duck through the return tube in under 4.2 seconds and releases it safely',()=>{
  const W=createWorld({seed:3,ducks:0,arrivals:false});
  const from=[P.PUMP.at[0],P.LL,P.PUMP.at[1]],body=W.floaters.add({...DUCK_FLOAT,p:from});
  const d={stats:{ slides: 0, lifts: 0, laps: 0, bestLap: null, lastLap: null, flights: 0, seaTrips: 0, rescued: 0 },body,state:'pump',pumpFrom:from.slice(),s:0,vs:0,inRound:0,hat:0,id:1,laps:0};
  body.duck=d;body.ghost=true;W.ducks.push(d);W.floaters.grab(body);
  let elapsed=0,previous=null,initialSpeed=null,peakSpeed=0;
  while(d.state!=='float'&&elapsed<12){
    const state=d.state,s=d.s;W.step(1);elapsed+=1/120;
    assert.ok(body.p.every(Number.isFinite),'positions remain finite');
    if(state==='tube'&&d.state==='tube'){
      const speed=(d.s-s)*120;initialSpeed??=speed;peakSpeed=Math.max(peakSpeed,speed);
      if(previous!==null)assert.ok(speed>=previous-1e-8,'the entry accelerates smoothly');
      previous=speed;
    }
  }
  assert.ok(elapsed<4.2,`pump + return took ${elapsed.toFixed(2)} seconds`);
  assert.ok(peakSpeed>=1.7&&initialSpeed<peakSpeed,'the pump current accelerates to a brisk cruise');
  assert.equal(W.returns,1);assert.equal(d.laps,1);assert.equal(body.ghost,false);
  W.step(120);
  assert.ok(W.water.isWet(body.p[0],body.p[2]),'the faster exit lands inside the receiving pool');
});

test('the return outlet accelerates a duck along the mouth direction without an upward kick',()=>{
  const W=createWorld({seed:3,ducks:0,arrivals:false});
  const end=P.tube.at(P.tube.len),before=P.tube.at(P.tube.len-.08);
  const body=W.floaters.add({...DUCK_FLOAT,p:P.tube.at(P.tube.len-.75)});
  const d={stats:{ slides: 0, lifts: 0, laps: 0, bestLap: null, lastLap: null, flights: 0, seaTrips: 0, rescued: 0 },body,state:'tube',s:P.tube.len-.75,vs:1.8,inRound:0,hat:0,id:1,laps:0};
  body.duck=d;body.ghost=true;W.ducks.push(d);W.floaters.grab(body);
  const throwBody=W.floaters.throw;let releaseVelocity=null;
  W.floaters.throw=(b,v)=>{if(b===body)releaseVelocity=v.slice();return throwBody(b,v);};
  let previousSpeed=d.vs,previousS=d.s,accelerated=false;
  for(let tick=0;tick<120&&d.state==='tube';tick++){
    const from=body.p.slice();W.step(1);
    if(d.state==='tube'){
      const speed=(d.s-previousS)*120;
      assert.ok(speed>=previousSpeed-1e-8,'speed builds continuously inside the tube');
      // The first fixture step seats the centreline position on the tube floor.
      if(tick>0)assert.ok(Math.hypot(...body.p.map((v,i)=>v-from[i]))<.07,'movement has no position jump');
      previousSpeed=speed;accelerated ||= speed>3;
    }
    previousS=d.s;
  }
  assert.ok(accelerated,'the duck gains its launch speed before leaving the mouth');
  assert.equal(d.state,'float');assert.equal(body.state,'free');assert.equal(body.ghost,false);
  assert.ok(Math.hypot(body.v[0],body.v[2])>4.2,'the outlet supplies a strong forward impulse');
  assert.ok(body.v[1]<0,'the outlet adds no artificial upward kick');
  const length=Math.hypot(...end.map((v,i)=>v-before[i]));
  const dir=end.map((v,i)=>(v-before[i])/length),speed=Math.hypot(...body.v);
  assert.ok(Math.abs(Math.hypot(...releaseVelocity)-d.vs)<1e-8,'the mouth preserves speed before the release tick applies gravity');
  assert.ok(body.v.reduce((sum,v,i)=>sum+v*dir[i],0)/speed>.99,'the shot continues the full 3D outlet tangent');
  const from=body.p.slice();let peak=from[1],travel=0;
  for(let tick=0;tick<120;tick++){
    W.step(1);peak=Math.max(peak,body.p[1]);
    travel=Math.max(travel,(body.p[0]-from[0])*dir[0]+(body.p[2]-from[2])*dir[2]);
    assert.ok([...body.p,...body.q].every(Number.isFinite),'flight stays finite');
    assert.ok(W.water.isWet(body.p[0],body.p[2])&&W.water.regionAt(body.p[0],body.p[2])===P.UP,'the flight stays above the receiving pool');
  }
  assert.ok(peak<from[1]+.05,'the duck does not rise into an exaggerated arc');
  assert.ok(travel>.5,'the duck clears the mouth with momentum');
  assert.ok(body.submerged>0,'the duck lands back in the water');
  assert.equal(W.returns,1,'one exit counts once');
});

test('a queued duck stays inside the pool and enters the flume after the preceding rider',()=>{
  const W=createWorld({seed:3,ducks:0,arrivals:false});
  const add=(p,state,s)=>{
    const body=W.floaters.add({...DUCK_FLOAT,p});
    const d={stats:{ slides: 0, lifts: 0, laps: 0, bestLap: null, lastLap: null, flights: 0, seaTrips: 0, rescued: 0 },body,state,s,vs:.15,inRound:0,hat:0,id:W.ducks.length,laps:0};
    body.duck=d;W.ducks.push(d);return d;
  };
  const first=add(P.slide.at(0),'slide',0);
  W.floaters.grab(first.body);
  const next=add([P.MOUTH[0]+.07,P.LU-.015,P.MOUTH[1]+.10],'float',0);
  W.step(1);
  assert.equal(next.state,'float','the occupied intake queues the second duck');
  assert.ok(W.water.isWet(next.body.p[0],next.body.p[2]),'waiting duck stays in the water');
  let rode=false;
  for(let i=0;i<120*6;i++){
    W.step(1);rode ||= next.state==='slide';
    if(!rode)assert.ok(W.water.isWet(next.body.p[0],next.body.p[2]),'waiting duck does not spill onto the lawn');
  }
  assert.ok(rode,'the queued duck subsequently rides the flume');
  assert.equal(W.slides,2,'both ducks reach the receiving pool');
});
