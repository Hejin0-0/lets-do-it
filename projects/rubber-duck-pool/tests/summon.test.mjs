import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, TOYS } from '../src/pool/world.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';
import { P } from '../src/pool/layout.js';
import { PLACEMENTS, PROP_FLOATS, poseProps } from '../src/pool/props.js';
import { isleH, JETTY } from '../src/pool/island.js';
import { createCritters, CRITTER, CRITTER_MAX } from '../src/pool/critters.js';
import { srgbToLinear } from '@lid/diorama/math.js';

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

test('seeded runs replay and summoning leaves duck identity, design, state and statistics intact', () => {
  for (const seed of [3, 7]) {
    const a=make(seed), b=make(seed), control=make(seed);
    for (const world of [a,b,control]) { assert.equal(world.addDucks(3),3); world.step(240); assert.equal(world.ducks.length,3); }
    const ducks=a.ducks.map(d=>({d,body:d.body,id:d.id,stats:d.stats}));
    for(const item of [first,third]) { a.summon(item.id); b.summon(item.id); }
    a.step(240); b.step(240); control.step(240);
    assert.deepEqual(a.summons.list,b.summons.list);
    assert.deepEqual(
      a.ducks.map(d=>({id:d.id,colour:d.colour,hat:d.hat,state:d.state,stats:d.stats})),
      control.ducks.map(d=>({id:d.id,colour:d.colour,hat:d.hat,state:d.state,stats:d.stats})));
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

test('a summoned item being sent back is released, unpickable, and ignores hand actions', () => {
  const W = make(), id = first.id; W.summon(id); W.step(60);
  const b = body(W, id); W.hand.grab(b); assert.equal(b.state, 'held');
  assert.equal(W.sendBack(id), 'sent'); assert.equal(b.state, 'free');
  assert.notEqual(W.pick([b.p[0], b.p[1] + 1, b.p[2]], [0, -1, 0])?.body, b);
  W.events.length = 0;
  const p = b.p.slice();
  W.hand.grab(b); assert.equal(b.state, 'free');
  W.hand.hold(b, [0, P.LU + 1, 0]); assert.deepEqual(b.p, p);
  W.hand.throw(b, [0, 5, 0]); assert.equal(b.v[1], 0);
  W.hand.tap(b);
  assert.equal(W.events.some(e => e.type === 'plop'), false);
  while (!W.summons.carried(id)) W.step(1);
  assert.equal(W.floaters.bodies.includes(b), false);
  W.hand.tap(b); W.hand.grab(b); W.hand.hold(b, [0, P.LU + 1, 0]); W.hand.throw(b, [0, 1, 0]);
  assert.equal(W.events.some(e => e.type === 'plop'), false);
});

test('poseProps reads collectibles.list at most once per call across states', () => {
  const W = make(), buf = new Float32Array(PLACEMENTS.length * PROP_FLOATS);
  const orig = W.collectibles;
  let listReads = 0;
  W.collectibles = Object.create(orig, { list: { get() { listReads++; return orig.list; } } });
  const check = (name) => {
    listReads = 0;
    poseProps(buf, 0, W);
    assert.ok(listReads <= 1, `${name}: expected <= 1 collectibles.list read, got ${listReads}`);
  };

  check('initial');

  W.collectibles.arm();
  while (!W.collectibles.adrift.length) W.step(120);
  check('adrift');

  assert.equal(W.sendBoat(), true);
  while (W.boat.state !== 'moored' && !orig.list.some(c => c.state === 'aboard')) W.step(1);
  assert.equal(orig.list.some(c => c.state === 'aboard'), true);
  assert.equal(W.summon(first.id), 'placed');
  assert.equal(W.summon(second.id), 'placed');
  W.step(30);
  check('aboard');

  assert.equal(W.sendBack(first.id), 'sent');
  while (!W.summons.carried(first.id)) W.step(1);
  check('carried');

  while (W.boat.state !== 'moored' || W.summons.has(first.id)) W.step(120);
  check('moored');
});

test('poseProps moves the swan, radio, boat and toys with what they follow and packs tint, ring and deflate', () => {
  const W = make(), buf = new Float32Array(PLACEMENTS.length * PROP_FLOATS);
  const offsetOf = (pred) => {
    const idx = PLACEMENTS.findIndex(pred);
    assert.ok(idx >= 0);
    return idx * PROP_FLOATS;
  };
  const matAt = (out) => Array.from(buf.subarray(out, out + 12));
  const transAt = (out) => [buf[out + 3], buf[out + 7], buf[out + 11]];

  for (const [name, b] of [['swan', W.swan], ['toy0', W.toys[0]], ['toy1', W.toys[1]], ['toy2', W.toys[2]]]) {
    const out = offsetOf(p => p.follow === name);
    poseProps(buf, 0, W);
    assert.ok(matAt(out).some(v => v !== 0), `${name} is not hidden`);
    const before = transAt(out), saved = b.p.slice();
    b.p[0] += 0.4; b.p[1] += 0.2; b.p[2] -= 0.3;
    poseProps(buf, 0, W);
    const after = transAt(out);
    assert.ok(Math.abs(after[0] - before[0] - 0.4) < 1e-5, `${name} tx`);
    assert.ok(Math.abs(after[1] - before[1] - 0.2) < 1e-5, `${name} ty`);
    assert.ok(Math.abs(after[2] - before[2] + 0.3) < 1e-5, `${name} tz`);
    b.p = saved;
  }

  // Measured ocean wave heave peaks at 0.173 at the jetty and 0.166 at sea (0.235 over 30 min); 0.25 gives ~45% margin over 2 min and still rejects P.SEA + 0.4.
  const BOAT_MAX_HEAVE = 0.25;
  const boatOut = offsetOf(p => p.follow === 'boat');
  poseProps(buf, 0, W);
  const moored = transAt(boatOut);
  assert.ok(matAt(boatOut).some(v => v !== 0), 'moored boat is not hidden');
  assert.ok(Math.abs(moored[0] - (JETTY.x1 - 0.55)) < 1e-5 && Math.abs(moored[1] - P.SEA) <= BOAT_MAX_HEAVE);
  assert.ok(buf[boatOut] > 0.98 && Math.abs(buf[boatOut + 8]) < 0.15, 'moored boat lies along the jetty');
  let mooredMinY = moored[1], mooredMaxY = moored[1];
  for (let k = 0; k < 10; k++) {
    W.step(30);
    poseProps(buf, 0, W);
    const y = buf[boatOut + 7];
    assert.ok(Math.abs(y - P.SEA) <= BOAT_MAX_HEAVE, `moored boat ty ${y} stays within wave heave of sea`);
    mooredMinY = Math.min(mooredMinY, y);
    mooredMaxY = Math.max(mooredMaxY, y);
  }
  assert.ok(mooredMaxY - mooredMinY > 0.02, `moored boat bobs on waves: ${mooredMinY}..${mooredMaxY}`);
  W.collectibles.arm();
  while (!W.collectibles.adrift.length) W.step(120);
  assert.equal(W.sendBoat(), true);
  assert.notEqual(W.boat.state, 'moored');
  poseProps(buf, 0, W);
  const b0 = transAt(boatOut), savedBoat = W.boat.p.slice();
  W.boat.p[0] += 1.2; W.boat.p[2] -= 0.6;
  poseProps(buf, 0, W);
  const b1 = transAt(boatOut);
  assert.ok(Math.abs(b1[0] - b0[0] - 1.2) < 1e-5, 'boat tx moves with boat.p');
  assert.ok(Math.abs(b1[2] - b0[2] + 0.6) < 1e-5, 'boat tz moves with boat.p');
  assert.ok(Math.abs(b1[1] - P.SEA) <= BOAT_MAX_HEAVE, 'boat ty stays on the sea');
  W.boat.p = savedBoat;
  poseProps(buf, 0, W);
  const seaStart = transAt(boatOut);
  let seaMinY = seaStart[1], seaMaxY = seaStart[1];
  for (let k = 0; k < 10; k++) {
    W.step(12);
    poseProps(buf, 0, W);
    const y = buf[boatOut + 7];
    assert.ok(Math.abs(y - P.SEA) <= BOAT_MAX_HEAVE, `sailing boat ty ${y} stays within wave heave of sea`);
    seaMinY = Math.min(seaMinY, y);
    seaMaxY = Math.max(seaMaxY, y);
  }
  assert.ok(seaMaxY - seaMinY > 0.01, `sailing boat bobs on waves: ${seaMinY}..${seaMaxY}`);
  const seaEnd = transAt(boatOut);
  const dx = seaEnd[0] - seaStart[0], dz = seaEnd[2] - seaStart[2], dist = Math.hypot(dx, dz);
  const fx = buf[boatOut], fz = buf[boatOut + 8], flen = Math.hypot(fx, fz);
  assert.ok(dist > 0.2 && (fx * dx + fz * dz) / (flen * dist) > 0.95, 'sailing boat faces along its course');

  const radioOut = offsetOf(p => p.follow === 'radio');
  assert.equal(W.station, 0);
  poseProps(buf, 0, W);
  const offMat = matAt(radioOut);
  assert.ok(Math.abs(offMat[3] - P.RADIO[0]) < 1e-5 && Math.abs(offMat[7] - P.TER) < 1e-5 && Math.abs(offMat[11] - P.RADIO[1]) < 1e-5);
  for (let k = 0; k < 6; k++) {
    W.step(10);
    poseProps(buf, 0, W);
    assert.ok(matAt(radioOut).every((v, j) => Math.abs(v - offMat[j]) < 1e-6), 'radio does not bob while off');
  }
  W.tuneRadio();
  assert.ok(W.station > 0);
  let minY = Infinity, maxY = -Infinity, maxScaleY = 0;
  for (let k = 0; k < 80; k++) {
    W.step(1);
    poseProps(buf, 0, W);
    minY = Math.min(minY, buf[radioOut + 7]);
    maxY = Math.max(maxY, buf[radioOut + 7]);
    maxScaleY = Math.max(maxScaleY, Math.hypot(buf[radioOut + 1], buf[radioOut + 5], buf[radioOut + 9]));
  }
  assert.ok(minY >= P.TER - 1e-5 && maxY - P.TER > 0.008, `radio bobs when playing: ${minY}..${maxY}`);
  assert.ok(maxScaleY > 1.02, `radio squashes/stretches on beat: ${maxScaleY}`);
  while (W.tuneRadio() !== 0) {}
  poseProps(buf, 0, W);
  const stoppedMat = matAt(radioOut);
  assert.ok(Math.abs(stoppedMat[7] - P.TER) < 1e-5);
  for (let k = 0; k < 6; k++) {
    W.step(10);
    poseProps(buf, 0, W);
    assert.ok(matAt(radioOut).every((v, j) => Math.abs(v - stoppedMat[j]) < 1e-6), 'radio stops bobbing once turned off');
  }

  const chairIdx = PLACEMENTS.findIndex(p => p.model === 'chair' && p.tint);
  const chairOut = chairIdx * PROP_FLOATS, chairTint = srgbToLinear(PLACEMENTS[chairIdx].tint);
  const ballOut = offsetOf(p => p.follow === 'toy2');
  poseProps(buf, 0, W);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(buf[chairOut + 12 + k] - chairTint[k]) < 1e-5);
  assert.equal(buf[chairOut + 15], 0);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(buf[ballOut + 12 + k] - 1) < 1e-5);
  assert.equal(buf[ballOut + 15], 0);

  W.toys[0].deflate = 0.4;
  W.toys[1].deflate = 0.25;
  W.swan.deflate = 0.7;
  poseProps(buf, 0, W);
  for (const [follow, body, want] of [['toy0', W.toys[0], 0.4], ['toy1', W.toys[1], 0.25], ['swan', W.swan, 0.7]]) {
    const idx = PLACEMENTS.findIndex(p => p.follow === follow), out = idx * PROP_FLOATS;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(buf[out + 12 + k] - PLACEMENTS[idx].ring[k]) < 1e-5, `${follow} ring[${k}]`);
    assert.ok(Math.abs(buf[out + 15] - want) < 1e-5, `${follow} deflate ${buf[out + 15]} vs ${body.deflate}`);
  }
});
