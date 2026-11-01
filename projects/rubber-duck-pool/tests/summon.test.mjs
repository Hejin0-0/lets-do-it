import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TOYS } from '../src/pool/world.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';
import { P } from '../src/pool/layout.js';
import { PLACEMENTS, PROP_FLOATS, poseProps } from '../src/pool/props.js';

const make = (seed = 3, ducks = 0) => createWorld({ seed, ducks, arrivals: false });
const [first, second, third] = COLLECTIBLES;
const body = (W, id) => W.floaters.bodies.find(b => b.summonId === id);

test('summons are distinct, idempotent, copy-only, and cleared by reset', () => {
  const W = make(), count = W.floaters.bodies.length, sea = W.collectibles.list;
  assert.equal(W.summon(first.id), 'placed');
  for (let i = 0; i < 50; i++) assert.equal(W.summon(first.id), 'present');
  assert.equal(W.floaters.bodies.length, count + 1); assert.equal(W.summons.list.length, 1);
  assert.equal(W.summon(second.id), 'placed');
  const [a,b] = W.summons.list; assert.notDeepEqual(a.at, b.at);
  assert.equal(W.floaters.bodies.length, count + 2);
  const events = W.events.slice(), snapshot = W.summons.list;
  assert.equal(W.summon('unknown'), false); assert.deepEqual(W.events, events);
  snapshot[0].at[0] = 999; snapshot[0].id = 'changed'; snapshot.pop();
  assert.equal(W.summons.has(first.id), true); assert.notEqual(W.summons.list[0].at[0], 999);
  assert.deepEqual(W.collectibles.list, sea);
  assert.deepEqual(events.filter(e => e.type === 'summoned'), [a,b].map(({id,at}) => ({type:'summoned',id,x:at[0],z:at[1]})));
  const old = [body(W, first.id), body(W, second.id)]; W.reset();
  assert.deepEqual(W.summons.list, []); assert.ok(old.every(b => !W.floaters.bodies.includes(b))); assert.equal(W.floaters.bodies.length, count);
});

test('spawn spots are clear, bodies float in the big pool, and the hand picks and throws them', () => {
  const W = make();
  for (const item of COLLECTIBLES) {
    assert.equal(W.summon(item.id), 'placed'); const b = body(W, item.id), [x,,z] = b.p;
    assert.ok(P.mainD(x,z) < -b.rad && P.terrainH(x,z) < P.LU - b.rad);
    for (const toy of TOYS) assert.ok(Math.hypot(x-toy.at[0],z-toy.at[2]) > b.rad + .45);
    assert.ok(Math.hypot(x-P.MOUTH[0], z-P.MOUTH[1]) > .6);
    assert.ok(Math.hypot(x-P.MAIN[2], z-(-.6*P.K)) > .7);
  }
  for (let n = 0; n < 5*120; n++) { W.step(); for (const item of COLLECTIBLES) { const b=body(W,item.id); assert.ok(P.inMain(b.p[0],b.p[2])); assert.ok(b.p[1] > P.LU-.2 && b.p[1] < P.LU+.3); } }
  const b=body(W, first.id), hit=W.pick([b.p[0],b.p[1]+1,b.p[2]],[0,-1,0]);
  assert.equal(hit.body, b); W.hand.grab(hit.body); assert.equal(b.state,'held'); W.hand.throw(b,[0,1,0]); assert.equal(b.state,'free');
});

test('seeded runs replay and summoning leaves existing duck identity, state and statistics intact', () => {
  for (const seed of [3, 7]) {
    const a=make(seed), b=make(seed), control=make(seed);
    for (const world of [a,b,control]) { assert.equal(world.addDucks(3),3); world.step(240); assert.equal(world.ducks.length,3); }
    const ducks=a.ducks.map(d=>({d,body:d.body,id:d.id,stats:d.stats}));
    for(const item of [first,third]) { a.summon(item.id); b.summon(item.id); }
    a.step(240); b.step(240); control.step(240);
    assert.deepEqual(a.summons.list,b.summons.list);
    assert.deepEqual(a.ducks.map(d=>({id:d.id,state:d.state,stats:d.stats})),control.ducks.map(d=>({id:d.id,state:d.state,stats:d.stats})));
    ducks.forEach((saved,i)=>{assert.equal(a.ducks[i],saved.d);assert.equal(saved.d.body,saved.body);assert.equal(saved.d.stats,saved.stats);assert.equal(saved.d.id,saved.id);});
  }
});

test('pool placement is hidden until summoned and follows its own body', () => {
  const W=make(), buf=new Float32Array(PLACEMENTS.length*PROP_FLOATS);
  const index=PLACEMENTS.findIndex(p=>p.follow==='summon' && p.summonId===first.id)*PROP_FLOATS;
  assert.equal(PLACEMENTS.filter(p=>p.follow==='summon').length,COLLECTIBLES.length);
  for (const item of COLLECTIBLES) assert.equal(PLACEMENTS.filter(p=>p.follow==='summon' && p.summonId===item.id).length,1);
  assert.ok(index>=0); const matrix=()=>{poseProps(buf,0,W);return Array.from(buf.slice(index,index+12));};
  assert.ok(matrix().every(x=>x===0)); W.summon(first.id); const b=body(W,first.id), before=matrix();
  assert.ok(before.some(x=>x!==0)); b.p[0]+=1; b.p[2]-=.5; const after=matrix();
  assert.ok(Math.abs(after[3]-before[3]-1)<1e-5); assert.ok(Math.abs(after[11]-before[11]+.5)<1e-5);
  assert.equal(PLACEMENTS[index/PROP_FLOATS].model,PLACEMENTS.find(p=>p.follow==='collectible' && p.collectibleId===first.id).model);
  W.reset(); assert.ok(matrix().every(x=>x===0));
});

test('a spot something already floats on is passed over for a clear one', () => {
  const learn = createWorld({ seed: 3, ducks: 0, arrivals: false }); learn.summon('bottle-first'); const spot = learn.summons.list[0].at;
  const W = createWorld({ seed: 3, ducks: 0, arrivals: false }), toy = W.toys[2];
  toy.p = [spot[0], toy.p[1] + 0, spot[1]];   // the beach ball floated over to the first item's spot
  assert.equal(W.summon('bottle-first'), 'placed');
  const body = W.floaters.bodies.find(b => b.summonId === 'bottle-first');
  assert.ok(Math.hypot(body.p[0] - toy.p[0], body.p[2] - toy.p[2]) >= body.rad + toy.rad, 'the summoned item was placed on top of the ball');
});

test('with every fixed spot taken, summoned items still find open water apart from everything', () => {
  const learn = createWorld({ seed: 3, ducks: 0, arrivals: false });
  for (const item of COLLECTIBLES) learn.summon(item.id);
  const spots = learn.summons.list.map(i => i.at), W = createWorld({ seed: 3, ducks: 0, arrivals: false });
  W.toys.forEach((toy, k) => { toy.p = [spots[k][0], toy.p[1], spots[k][1]]; });   // each toy floated onto one item's spot
  for (const item of COLLECTIBLES) assert.equal(W.summon(item.id), 'placed');
  const mine = COLLECTIBLES.map(item => body(W, item.id));
  for (const b of mine) {
    const [x,,z] = b.p;
    assert.ok(P.mainD(x,z) < -b.rad && P.terrainH(x,z) < P.LU - b.rad, 'in the big pool, deep enough');
    assert.ok(Math.hypot(x-P.MOUTH[0], z-P.MOUTH[1]) > .6 && Math.hypot(x-P.MAIN[2], z-(-.6*P.K)) > .7, 'clear of the mouth and the ladder');
    for (const other of W.floaters.bodies) if (other !== b) assert.ok(Math.hypot(x-other.p[0], z-other.p[2]) >= b.rad + other.rad, `summoned ${b.summonId} overlaps a body`);
  }
});
