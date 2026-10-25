import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLING_SHAPES as S } from '../src/pool/sampling-shapes.js';
import { P } from '../src/pool/layout.js';
import { PLACEMENTS } from '../src/pool/props.js';
import { PROP_SHAPES } from '../src/pool/prop-shapes.js';
import { isleH } from '../src/pool/island.js';

const bin=readFileSync(new URL('../public/props/sampling.bin',import.meta.url));
const V=new Float32Array(bin.buffer,bin.byteOffset,S.vertices*10);
const I=new Uint32Array(bin.buffer,bin.byteOffset+S.vertices*40,S.indices);
test('all authored meshes have finite unit normals, valid local indices and matching bounds',()=>{
  assert.equal(bin.length,S.vertices*40+S.indices*4);
  for(const [name,m] of Object.entries(S.models)){
    for(let i=m.index;i<m.index+m.indices;i++) assert.ok(I[i]<m.vertices,`${name}: index ${I[i]}`);
    for(let j=m.vertex;j<m.vertex+m.vertices;j++){
      const v=V.subarray(j*10,j*10+10);
      assert.ok([...v].every(Number.isFinite),name);
      assert.ok(Math.abs(Math.hypot(...v.subarray(3,6))-1)<.002,`${name}: normal`);
      for(let k=0;k<3;k++) assert.ok(v[k]>=m.bounds[0][k]-1e-5&&v[k]<=m.bounds[1][k]+1e-5,name);
    }
  }
});

// Vertical ray/triangle intersections validate the actual exported surface, independently of its manifest.
function heights(name,x,z){
  const m=S.models[name],out=[];
  for(let i=m.index;i<m.index+m.indices;i+=3){
    const [a,b,c]=[0,1,2].map(k=>V.subarray((m.vertex+I[i+k])*10,(m.vertex+I[i+k])*10+3));
    const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(det)<1e-10)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
    const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
    if(u>=-1e-5&&v>=-1e-5&&u+v<=1+1e-5)out.push(u*a[1]+v*b[1]+(1-u-v)*c[1]);
  }
  return out;
}
test('visible basin floor and steps agree with collision and water heights',()=>{
  const x=P.POOL.at[0],z=P.POOL.at[2];
  for(const [px,pz] of [[x,z],[x-1,z+.4],[x+1,z-.5],[-1.32,-1.65],[-1.32,-2.25]]){
    const h=P.terrainH(px,pz),hits=heights('pool_structure',px,pz);
    assert.ok(hits.some(y=>Math.abs(y-h)<.012),`floor at ${px},${pz}: collision ${h}, mesh ${hits}`);
    assert.ok(h<P.LU,'floor below water');
  }
  assert.ok(Math.abs(S.models.pool_structure.bounds[1][1]-P.TER)<.001,'rim flush with terrace');
});
test('flume stays above ground, both receiving ports are open, and layout export is current',()=>{
  for(let s=0;s<P.slide.len;s+=.025){
    const [x,y,z]=P.slide.at(s);
    if(P.mainD(x,z)>.05&&P.roundD(x,z)>.12)assert.ok(y-.11>=P.terrainH(x,z)-.003,`flume buried at ${s}`);
  }
  const ports=[['pool_structure',P.MOUTH[0],P.MAIN[3]+.05],['whirlpool_bowl',.06,P.ROUND[1]]];
  for(const [model,x,z] of ports) assert.ok(!heights(model,x,z).some(y=>y>1.16&&y<1.34),`${model}: closed receiving port`);
  const layout=JSON.parse(readFileSync(new URL('../tools/map-layout.json',import.meta.url)));
  assert.deepEqual(layout.pool,P.POOL);
  for(const [i,p] of layout.slide.entries())assert.ok(Math.hypot(...p.map((v,k)=>v-P.slide.at(P.slide.len*i/(layout.slide.length-1))[k]))<1e-8);
});
test('fitted structures occur once; old overlapping shells are absent',()=>{
  for(const name of ['pool_structure','whirlpool_bowl','slide_flume','return_glass','return_fittings','flume_water','architecture_lights','mural','art_wall'])assert.equal(PLACEMENTS.filter(p=>p.model===name).length,1,name);
  for(const name of ['bowlrim','drain','spa','pump_jet'])assert.equal(PLACEMENTS.filter(p=>p.model===name).length,0,name);
});
test('pump intake is above water and its rising leg is above ground',()=>{
  assert.ok(S.models.return_glass.bounds[0][1]>P.LL+.2);
  for(let s=0;s<P.tube.len;s+=.025){const p=P.tube.at(s);assert.ok(p[1]>=P.terrainH(p[0],p[2])+.08,`buried pump at ${s}`);}
  assert.ok(P.PUMP.crest>P.TER+1.2);
  assert.equal(S.models.pump_jet,undefined,'no rising water geometry below the intake');
  for(const [x,z] of [[P.MOUTH[0],P.MAIN[3]],[.06,P.ROUND[1]]])assert.equal(heights('architecture_lights',x,z).length,0,'lights must leave the ride ports open');
});
test('all plant roots meet the local ground, including sloped coast placements',()=>{
  const plants=new Set(['palm','palm2','shrub','shrub2','flowerbush','oleander','fern','agave','tuft','potpalm','potflower','potshrub']);
  for(const p of PLACEMENTS)if(p.at&&plants.has(p.model)){
    const m=S.models[p.model]||PROP_SHAPES.models[p.model];
    assert.ok(p.at[1]+m.bounds[0][1]*p.scale<=isleH(p.at[0],p.at[2])+.001,`${p.model} floating at ${p.at}`);
  }
});
