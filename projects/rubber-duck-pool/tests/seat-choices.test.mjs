import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/pool/world.js';
import * as choices from '../src/pool/seat-choices.js';
const { clockText, createDuckChoice, chooseDuck, chooseHour } = choices;

const world = () => createWorld({ seed: 3, ducks: 0, arrivals: false });

test('slider spans quarter hours without a second midnight', () => {
  assert.equal(choices.HOUR_STEP, .25); assert.equal(choices.HOUR_MAX, 23.75);
});

test('running world clock takes 1800 seconds per day', () => {
  const W=world(), start=W.day.hour; W.step(120);
  near(W.day.hour-start,24/1800);
});

test('clock text wraps hours and floors minutes', () => {
  for (const [hour, text] of [[0,'00:00'],[5.999,'05:59'],[11.9999,'11:59'],[12,'12:00'],[23.99999,'23:59'],[24,'00:00'],[30,'06:00'],[-.5,'23:30']]) assert.equal(clockText(hour), text);
});

test('live duck labels are unique, including repeated names and existing suffixes', () => {
  const W = world(); W.addDucks(40); while (W.ducks.length < 40) W.step();
  const choice = createDuckChoice(), names = ['Pip','Pip','Pip','Pip (2)'];
  names.forEach((name, i) => { W.ducks[i].name = name; });
  const options = choice.view(W.ducks, null).options;
  assert.equal(options.length, 40); assert.deepEqual(options.map(o => o.id), W.ducks.map(d => d.id));
  assert.equal(options[0].label, 'Pip'); assert.equal(options[3].label, 'Pip (2)');
  assert.equal(new Set(options.map(o => o.label)).size, 40);
  W.ducks[3].name = 'Other';
  assert.deepEqual(choice.view(W.ducks.slice(0,3), null).options.map(o => o.label), ['Pip','Pip (2)','Pip (3)']);
});

test('selection identity, removal notice, deselection and forget', () => {
  const W = world(); W.addDucks(2); while (W.ducks.length < 2) W.step();
  const [a, b] = W.ducks, choice = createDuckChoice();
  assert.equal(choice.view(W.ducks, null).value, null);
  assert.equal(chooseDuck(W, a.id), true); assert.equal(W.selected, a);
  assert.equal(choice.view(W.ducks, W.selected).value, a.id);
  assert.equal(chooseDuck(W, -1), false); assert.equal(W.selected, a);
  assert.equal(chooseDuck(W, null), true); assert.equal(W.selected, null);
  assert.equal(choice.view(W.ducks, W.selected).notice, null);
  assert.equal(choice.view(W.ducks, {...a}).value, null);
  chooseDuck(W, a.id); choice.view(W.ducks, W.selected);
  assert.equal(W.removeDuck(), true); assert.equal(W.selected, null);
  assert.equal(choice.view(W.ducks, W.selected).notice, 'The duck you were watching has left.');
  assert.equal(choice.view(W.ducks, null).notice, 'The duck you were watching has left.');
  chooseDuck(W, b.id); assert.equal(choice.view(W.ducks, W.selected).notice, null);
  W.removeDuck(); assert.equal(choice.view(W.ducks, null).notice, 'The duck you were watching has left.');
  choice.forget(); assert.equal(choice.view(W.ducks, null).notice, null);
});

test('reset replaces objects even when ids are reused', () => {
  const W = createWorld({seed: 3, ducks: 1, arrivals: false}), choice = createDuckChoice();
  const old = W.ducks[0]; choice.view(W.ducks, old); W.reset();
  assert.equal(W.ducks[0].id, old.id); assert.notEqual(W.ducks[0], old);
  assert.equal(choice.view(W.ducks, old).value, null);
  assert.equal(choice.view(W.ducks, old).notice, 'The duck you were watching has left.');
});

test('hour choice wraps finite numbers and preserves run state', () => {
  const W = world();
  for (const run of [true, false]) {
    W.setDayRun(run);
    for (const [hour, expected] of [[0,0],[6.25,6.25],[23.75,23.75],[24,0],[25.5,1.5],[-.5,23.5]]) {
      assert.equal(chooseHour(W, hour), expected); assert.equal(W.day.hour, expected); assert.equal(W.day.run, run);
    }
    for (const invalid of [NaN, Infinity, -Infinity, '6.25', '', null, undefined, {}, true]) {
      const before = {...W.day}; assert.equal(chooseHour(W, invalid), null); assert.deepEqual(W.day, before);
    }
  }
  let set = 0; const stub = { day: { hour: 0, run: true }, setHour(h) { set++; this.day.hour = h; }, setDayRun() { assert.fail('must not change run state'); } };
  assert.equal(chooseHour(stub, -0.5), 23.5); assert.equal(set, 1);
});

const direction = c => [Math.cos(c.el)*Math.sin(c.az), Math.sin(c.el), Math.cos(c.el)*Math.cos(c.az)];
const eyeOf = c => c.target.map((v,i) => v + c.dist * direction(c)[i]);
const near = (a,b,eps=1e-9) => assert.ok(Math.abs(a-b)<eps, `${a} vs ${b}`);
const samePoint = (a,b,eps=1e-9) => a.forEach((v,i) => near(v,b[i],eps));

test('gaze keeps the eye fixed, preserves its inputs and starts without turning', () => {
  const eye = [4,-2,7], at = [-3,5,1];
  for (const cam of [{az: .4, el: -.3, dist: 8, target: [1,2,3]}, {az: -3, el: 1.4, dist: .2, target: [-9,0,4]}]) {
    const before = structuredClone(cam);
    for (const k of [0,.001,.2,.75,1]) {
      const result = choices.gaze(cam,eye,at,k);
      samePoint(eyeOf(result),eye); assert.notEqual(result,cam); assert.notEqual(result.target,cam.target);
      if (k === 0) { assert.equal(result.az,cam.az); assert.equal(result.el,cam.el); assert.equal(result.dist,cam.dist); }
    }
    assert.deepEqual(cam,before);
  }
});

test('gaze reaches a point at k=1 and converges for small repeated steps', () => {
  const eye=[1,2,3], at=[-4,5,-6], start={az: 2,el: -.4,dist: 9,target:[0,0,0]};
  const unit=eye.map((v,i)=>(v-at[i])/Math.hypot(...eye.map((x,j)=>x-at[j])));
  samePoint(direction(choices.gaze(start,eye,at,1)),unit);
  let c=start; for(let i=0;i<500;i++) c=choices.gaze(c,eye,at,.05);
  samePoint(direction(c),unit,1e-8); samePoint(eyeOf(c),eye); samePoint(c.target,at,1e-8);
});

test('gaze crosses the azimuth seam by the short way', () => {
  const eye=[0,0,0], az=-Math.PI+.1, at=[-Math.sin(az),0,-Math.cos(az)];
  const c=choices.gaze({az:Math.PI-.1,el:0,dist:1,target:[0,0,0]},eye,at,.5);
  near(c.az,Math.PI); samePoint(eyeOf(c),eye);
});

test('gaze keeps a positive distance and handles vertical and coincident targets', () => {
  const eye=[2,3,4], start={az:.7,el:0,dist:2,target:[0,0,0]};
  for(const at of [[2,13,4],[2,-7,4],eye]) {
    const c=choices.gaze(start,eye,at,1);
    assert.ok([c.az,c.el,c.dist,...c.target].every(Number.isFinite));
    assert.ok(Math.abs(c.el)<Math.PI/2); assert.ok(c.dist>0); samePoint(eyeOf(c),eye);
  }
  const floor=choices.gaze(start,eye,eye,1).dist;
  const nearby=choices.gaze(start,eye,[2+floor/10,3,4],1);
  near(nearby.dist,floor); samePoint(eyeOf(nearby),eye);
});

test('a stale selection never removes the wrong duck or leaves its body behind', () => {
  const W = world(); W.addDucks(3); while (W.ducks.length < 3) W.step();
  const ghost = W.ducks[0]; W.reset(); W.addDucks(3); while (W.ducks.length < 3) W.step();
  const newest = W.ducks[2], kept = W.ducks.slice(0, 2), bodies = W.floaters.bodies.length;
  W.selected = ghost;   // an object from before the reset: not a live duck
  assert.ok(W.removeDuck());
  assert.deepEqual(W.ducks, kept); assert.ok(!W.floaters.bodies.includes(newest.body)); assert.equal(W.floaters.bodies.length, bodies - 1);
  assert.equal(W.selected, null);
});
