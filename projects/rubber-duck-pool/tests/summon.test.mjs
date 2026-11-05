import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TOYS } from '../src/pool/world.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';
import { P } from '../src/pool/layout.js';
import { PLACEMENTS, PROP_FLOATS, poseProps } from '../src/pool/props.js';
import { isleH } from '../src/pool/island.js';
import { createCritters, CRITTER, CRITTER_MAX } from '../src/pool/critters.js';

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
  assert.equal(new Set(W.summons.list.map(item=>item.at.join(','))).size, COLLECTIBLES.length);
  for (const [i,a] of W.summons.list.entries()) for (const b of W.summons.list.slice(i+1)) assert.ok(Math.hypot(a.at[0]-b.at[0],a.at[1]-b.at[1]) >= .29);
  for (const [i,item] of COLLECTIBLES.entries()) { const alone=make(); alone.summon(item.id); assert.deepEqual(alone.summons.list[0].at,W.summons.list[i].at); }
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
  spots.forEach(([x,z]) => W.floaters.add({ spheres: [[0,0,0,.12]], rho: .25, p: [x,P.LU,z] })); // all six fixed spots are occupied
  for (const item of COLLECTIBLES) assert.equal(W.summon(item.id), 'placed');
  const mine = COLLECTIBLES.map(item => body(W, item.id));
  for (const b of mine) {
    const [x,,z] = b.p;
    assert.ok(P.mainD(x,z) < -b.rad && P.terrainH(x,z) < P.LU - b.rad, 'in the big pool, deep enough');
    assert.ok(Math.hypot(x-P.MOUTH[0], z-P.MOUTH[1]) > .6 && Math.hypot(x-P.MAIN[2], z-(-.6*P.K)) > .7, 'clear of the mouth and the ladder');
    for (const other of W.floaters.bodies) if (other !== b) assert.ok(Math.hypot(x-other.p[0], z-other.p[2]) >= b.rad + other.rad, `summoned ${b.summonId} overlaps a body`);
  }
});

test('Send it back: a gull comes down onto the item, takes it out of the water and flies off with it', () => {
  const W = make(), id = first.id; W.summon(id); const spot = W.summons.list[0].at.slice(); W.step(240);
  const kinds = () => W.events.filter(e => e.type === 'sendBack' || e.type === 'sentBack').map(e => e.type);
  W.events.length = 0;
  assert.equal(W.sendBack(id), 'sent'); assert.equal(W.sendBack(id), 'leaving');
  assert.equal(W.sendBack(second.id), 'absent'); assert.equal(W.sendBack('nope'), 'absent');
  assert.deepEqual(kinds(), ['sendBack']); assert.equal(W.summons.list[0].state, 'taken'); assert.equal(W.summons.leaving(id), true);
  assert.equal(W.summon(id), 'present');
  let t = 0, prev = null, jump = 0, low = Infinity, took = null;
  while (W.summons.has(id) && t < 20) {
    W.step(1); t += 1 / 120;
    const g = W.summons.gulls[0], c = W.summons.carried(id);
    if (g) { if (prev) jump = Math.max(jump, Math.hypot(g.p[0] - prev[0], g.p[1] - prev[1], g.p[2] - prev[2])); prev = g.p; low = Math.min(low, g.p[1] - isleH(g.p[0], g.p[2])); }
    if (c && took === null) { took = t; assert.equal(body(W, id), undefined, 'out of the water: no body to float or be pushed'); W.toys[0].p = c.p.slice(); }
    if (c && t > took + 0.61) assert.ok(c.p[0] === g.p[0] && c.p[2] === g.p[2] && Math.abs(c.p[1] - (g.p[1] - 0.14)) < 1e-9, 'it hangs under the gull');
  }
  assert.equal(W.summons.has(id), false); assert.ok(t > 4 && t < 7, `the gull took ${t.toFixed(2)} s`);
  assert.ok(took > 2 && took < 3, `it was taken at ${took}`); assert.deepEqual(kinds(), ['sendBack', 'sentBack']);
  assert.ok(jump < 0.25, `the gull jumped ${jump.toFixed(3)} in one step`); assert.ok(low >= 0.35 - 1e-9, `the gull flew ${low.toFixed(3)} over the ground`);
  assert.equal(W.summons.gulls.length, 0); assert.equal(W.summons.carried(id), null); assert.equal(W.summons.leaving(id), false);
  assert.equal(W.summon(id), 'placed');
  const back = W.summons.list[0].at; assert.ok(Math.hypot(back[0] - spot[0], back[1] - spot[1]) < 0.3, `summoned again at ${back}, its spot is ${spot}`);
  W.sendBack(id); W.step(400); W.reset(); assert.equal(W.summons.gulls.length, 0); assert.equal(W.summons.list.length, 0); assert.equal(W.sendBack(id), 'absent');
});

test('the same seed sends the same gull the same way, and one item sent back leaves the others floating', () => {
  const path = () => { const W = make(5); W.summon(first.id); W.summon(second.id); W.sendBack(first.id); const out = []; for (let i = 0; i < 800; i++) { W.step(1); out.push(...(W.summons.gulls[0]?.p ?? [])); } return [out, W.summons.list]; };
  const [a, left] = path(), [b] = path();
  assert.deepEqual(a, b); assert.deepEqual(left.map(i => [i.id, i.state]), [[second.id, 'floating']]);
});

test('the carried item is drawn under its gull, and the gull as the island gulls are', () => {
  const W = make(); W.summon(first.id); W.sendBack(first.id); W.step(Math.round(120 * 3.5));
  const buf = new Float32Array(PLACEMENTS.length * PROP_FLOATS), index = PLACEMENTS.findIndex(p => p.follow === 'summon' && p.summonId === first.id) * PROP_FLOATS;
  poseProps(buf, 0, W); const c = W.summons.carried(first.id); assert.ok(c, 'carried by now');
  for (const [k, v] of [[3, c.p[0]], [7, c.p[1]], [11, c.p[2]]]) assert.ok(Math.abs(buf[index + k] - v) < 1e-5, `drawn at ${buf[index + k]}, carried at ${v}`);
  const critters = createCritters(P.rng(11)), inst = new Float32Array(CRITTER_MAX * 12), n0 = critters.pack(inst, 0), n1 = critters.pack(inst, 0, W.summons.gulls), g = W.summons.gulls[0];
  assert.equal(n1, n0 + 1); assert.deepEqual(Array.from(inst.slice(n0 * 12, n0 * 12 + 3)), Array.from(new Float32Array(g.p)));
  assert.equal(inst[n0 * 12 + 8], CRITTER.gull); assert.equal(inst[n0 * 12 + 3], inst[3], 'the size of the island gulls');
});
