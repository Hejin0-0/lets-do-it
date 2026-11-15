// Copy to the isolated preview project tests/ directory before running with node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld } from '../src/pool/world.js';
import { P } from '../src/pool/layout.js';
import { LOOKDEV_SHAPES } from '../src/pool/lookdev-shapes.js';
import { PLACEMENTS, PROP_FLOATS, poseProps } from '../src/pool/props.js';

const ids = ['bottle-first','bottle-second','bottle-third','bottle-fourth','bottle-fifth','bottle-sixth'];
const modelData = readFileSync(new URL('../public/props/lookdev.bin', import.meta.url));
const vertexBytes = LOOKDEV_SHAPES.vertices * 20;
const getBody = (world, id) => world.floaters.bodies.find(body => body.summonId === id);
const gap = (body, point) => Math.min(...body.spheres.map(([x,y,z,r]) => Math.hypot(point[0] - x, point[1] - y, point[2] - z) - r));

test('summoned bottle collider covers sampled surfaces of the six preview models', () => {
  const world = createWorld({seed: 3, ducks: 0, arrivals: false});
  const matrices = new Float32Array(PLACEMENTS.length * PROP_FLOATS);
  for (const id of ids) {
    world.summon(id);
    const body = getBody(world, id), model = LOOKDEV_SHAPES.models['collectible-' + id];
    poseProps(matrices, 0, world);
    const index = PLACEMENTS.findIndex(p => p.follow === 'summon' && p.summonId === id) * PROP_FLOATS;
    assert.ok(index >= 0);
    const scale = Math.hypot(matrices[index], matrices[index+1], matrices[index+2]);
    assert.ok(scale > 0, `${id}: visible placement has no scale`);
    let outside = 0, worst = 0;
    for (let i = model.index; i < model.index + model.indices; i+=3) {
      const vertices = [0,1,2].map(j => {
        const index = modelData.readUInt32LE(vertexBytes + 4 * (i+j));
        const offset = 20 * (model.vertex + index);
        return [0,1,2].map(axis => scale * modelData.readFloatLE(offset + 4 * axis));
      });
      const average = indices => [0,1,2].map(axis => indices.reduce((sum,j)=>sum+vertices[j][axis],0)/indices.length);
      const samples = [...vertices, average([0,1]), average([1,2]), average([2,0]), average([0,1,2])];
      for(const point of samples){const d=gap(body,point);if(d>1e-6)outside++;worst=Math.max(worst,d);}
    }
    assert.equal(outside, 0, `${id}: ${outside} sampled surface points protrude, worst ${worst}`);
  }
});

test('bottles positioned with overlapping models push apart under normal physics', () => {
  const world = createWorld({seed: 3, ducks: 0, arrivals: false});
  for (const id of ids.slice(3,5)) world.summon(id);
  const [a,b] = ids.slice(3,5).map(id => getBody(world,id));
  world.floaters.bodies = [a,b];
  a.p = [-1, P.LU + .02, -1]; b.p = [-.74, P.LU + .02, -1];
  a.q = [0,0,0,1]; b.q = [0,0,0,1];
  a.v = [0,0,0]; b.v = [0,0,0]; a.w = [0,0,0]; b.w = [0,0,0];
  world.step(1);
  const d = Math.hypot(...a.p.map((x,i) => b.p[i]-x));
  assert.ok(d > .30, `bottles remain ${d} units apart`);
});

test('a calm summoned bottle stays upright and near the original waterline', () => {
  const world = createWorld({seed: 3, ducks: 0, arrivals: false});
  world.summon('bottle-fourth');
  const body = getBody(world,'bottle-fourth');
  world.step(600);
  const up = world.floaters.up(body);
  assert.ok(up[1] > .8, `bottle flipped upside down: up.y=${up[1]}`);
  assert.ok(body.p[1] > P.LU + .02 && body.p[1] < P.LU + .065, `unexpected floating height ${body.p[1]}`);
});

test('the replacement collision cloud keeps the mass of the original floater', () => {
  const world = createWorld({seed: 3, ducks: 0, arrivals: false});
  world.summon('bottle-fourth');
  const body = getBody(world,'bottle-fourth');
  const reference = world.floaters.add({spheres:[[0,0,0,.12]], rho:.25, p:[0,P.LU,0]});
  assert.ok(Math.abs(body.m - reference.m) < reference.m * 0.001, `mass changed from ${reference.m} to ${body.m}`);
});
